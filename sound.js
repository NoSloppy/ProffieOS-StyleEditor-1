// Preload defaultFontSounds + buffers + durations
let defaultFontSounds = {};
const defaultFontSoundBuffers   = {};
const defaultFontSoundDurations = {};
const defaultFontSoundFilenames = {};
const customFontSoundBuffers = {};
let customFontSoundDurations = {};
const customFontSoundFilenames = {};
let customFontSounds = {};
let currentFontName = "Default";
let useDefaultFontFallback = false;
// Track which index was played for each effect (noRepeatRandom() use)
const lastPlayedSoundIndex = {};
let soundOn = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const volumeSlider = document.getElementById('VOLUME_SLIDER');
const volumeValue = document.getElementById('VOLUME_VALUE');
let globalVolume = Number(volumeSlider.value) / 100;

// master gain for global volume
const masterGain = audioCtx.createGain();
masterGain.gain.value = globalVolume;
masterGain.connect(audioCtx.destination);

let lockupGainNode = null;
let lockupLoopSrc  = null;
let lockupEndBuffer = null;

let activeOneShots = [];
let focusAllowsHum = true;
// Load default font.
fetch('default_font_urls.txt')
  .then(r => r.text())
  .then(text => {
    const urls = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Group URLs by effect name
    urls.forEach(url => {
      const m = url.match(/([a-z]+)[0-9]*\.wav$/i);
      if (!m) return;
      const effect = m[1].toLowerCase();
      defaultFontSounds[effect] ||= [];
      defaultFontSounds[effect].push(url);
    });

    // For each effect, create buffer + duration slots
    for (const [effect, urlList] of Object.entries(defaultFontSounds)) {
      defaultFontSoundBuffers[effect]   = [];
      defaultFontSoundDurations[effect] = [];
      defaultFontSoundFilenames[effect]  = [];

      urlList.forEach((url, idx) => {
        fetch(url)
          .then(r => r.arrayBuffer())
          .then(data => audioCtx.decodeAudioData(data))
          .then(buffer => {
            // store decoded AudioBuffer into default maps
            defaultFontSoundBuffers[effect][idx]   = buffer;
            // store duration
            const dur = Math.round(buffer.duration * 1000);
            defaultFontSoundDurations[effect][idx] = dur;
            // track filename
            defaultFontSoundFilenames[effect][idx] = url.split('/').pop();

            console.log(`Default font: ${defaultFontSoundFilenames[effect][idx]} - duration ${dur} ms`);
          })
          .catch(err => console.error(`Error loading default sound ${url}:`, err));
      });
    }
  })
  .catch(err => console.error("Could not load default_font_urls.txt:", err));

volumeSlider.addEventListener('input', function() {
  volumeValue.textContent = this.value;
  globalVolume = Number(this.value) / 100;

  // Update master volume
  masterGain.gain.value = globalVolume;

  // Update smoothswing volumes relative to global
  if (window.smoothLoopL && window.smoothLoopL.gainNode)
    window.smoothLoopL.gainNode.gain.value = lastSmoothGainL * globalVolume;
  if (window.smoothLoopH && window.smoothLoopH.gainNode)
    window.smoothLoopH.gainNode.gain.value = lastSmoothGainH * globalVolume;
});

function showLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.innerText = 'Loading, please stand by…';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '1.5em',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: '9999',
    textAlign: 'center',
  });
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) document.body.removeChild(overlay);
  if (window.lockupLoopSrc) {
    endLockupLoop(window.currentLockupType, null, false);
  }
  resumeLoops();
}

const chooseLocalFontBtn = document.getElementById('choose_local_font');
const fileInput          = document.getElementById('files');
const localFontName      = document.getElementById('local_font_name');

chooseLocalFontBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

// Load custom font.
fileInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) {
    // user hit “Cancel” — do nothing, keep current font
    return;
  }

  showLoadingOverlay();

  selectedFiles = Array.from(files);
  const folderName = files[0].webkitRelativePath
    ? files[0].webkitRelativePath.split('/')[0]
    : files[0].name;

  // Set the button's label to the folder name
  document.getElementById('choose_local_font_label').textContent = folderName;
  currentFontName = folderName;
  // Reset to defaults (so fallback is always there)
  customFontSounds = {};
  // Wipe out any old custom mappings
  Object.keys(customFontSoundBuffers).forEach(e => delete customFontSoundBuffers[e]);
  Object.keys(customFontSoundDurations).forEach(e => delete customFontSoundDurations[e]);
  Object.keys(customFontSoundFilenames).forEach(e => delete customFontSoundFilenames[e]);

  const promises = [];

  for (const file of selectedFiles) {
    const m = file.name.match(/^([a-z]+)[0-9]*\.wav$/i);
    if (!m) continue;
    const effect = m[1].toLowerCase();

    customFontSounds[effect] ||= [];
    customFontSoundDurations[effect] = customFontSoundDurations[effect] || [];
    const idx = customFontSounds[effect].length;
    customFontSounds[effect].push(file);
    customFontSoundDurations[effect][idx] = null;
    customFontSoundFilenames[effect] ||= [];
    customFontSoundFilenames[effect][idx] = file.name;
    if (!customFontSoundBuffers[effect]) customFontSoundBuffers[effect] = [];
    customFontSoundBuffers[effect][idx] = null;

    const reader = new FileReader();
    reader.onload = ev => {
      audioCtx.decodeAudioData(ev.target.result)
        .then(buffer => {
          customFontSoundBuffers[effect][idx] = buffer;
          const dur = Math.round(buffer.duration * 1000);
          customFontSoundDurations[effect][idx] = dur;
          console.log(`Custom font: ${folderName} ${file.name} - duration ${dur} ms`);
        })
        .catch(err => console.error("Decode error:", err));
    };
    reader.readAsArrayBuffer(file);

    promises.push(
      getAudioFileDuration(file).then(ms => {
        customFontSoundDurations[effect][idx] = ms;
      })
    );
  }

  Promise.all(promises)
    .catch(err => console.error("Error loading durations:", err))
    .then(() => hideLoadingOverlay && hideLoadingOverlay());
});

//   Promise.all(promises)
//     .catch(err => console.error("Error loading durations:", err))
//     .then(() => {
//       hideLoadingOverlay && hideLoadingOverlay();
//       const fullStyleFocused =
//         !current_focus ||
//         current_focus_url === '$' ||
//         (current_focus && current_focus.constructor.name === 'LayersClass');
//       if (STATE_ON && fullStyleFocused) {
//         focusAllowsHum = true;
//         console.log('[FontLoad] resuming hum & smooth-swings');
//         resumeLoops();
//       }
//     });
// });

// SmoothSwing and swing sounds
let swingSpeed = 0;
window.swingMotionPeak = 0;
window.swingMotionActive = false;
window.swingLastEffect = 0;

const swingThreshold = 280;
const slashThreshold = 5000;
const effectCooldown = 250; // ms
const swingLowerThreshold = swingThreshold * 0.5;

let lastSwingUpdate = 0;
let lastSwingSpeed = 0;

let lastSmoothGainL = 0;
let lastSmoothGainH = 0;
let smoothswingIdle = false;

// Accel/slash state
let lastAccelSpeed = 0;
let lastAccelTime  = performance.now();
let swingTriggered = false;

// SmoothSwing V2 rotating‐buffer files
const swinglFiles = defaultFontSoundBuffers['swingl'] || [];
const swinghFiles = defaultFontSoundBuffers['swingh'] || [];
let currentFileIdx = 0;

// SmoothSwing V2 rotating‐buffer state
let swingMidpoint     = 0;
const swingWidth      = 60;    // degrees of full crossfade window
const swingSeparation = 180;   // degrees offset on each swap
let lastMidTime       = performance.now();


// Accent‐swing vs slash
// Accent‐swing vs slash (acceleration‐based, with lower‐reset)
function triggerAccentEvent(speed) {
  if (!STATE_ON) return;
  // only the swing check is scaled for fullscreen; slash accel is constant
  const dynSwingThreshold = document.fullscreenElement
    ? swingThreshold * 0.7
    : swingThreshold;
  const dynSlashAccelThr  = slashThreshold;

  // compute accel (Δspeed / Δtime)
  const nowMs = performance.now();
  const dt    = (nowMs - lastAccelTime) / 1000;    // seconds
  const accel = dt > 0
    ? (speed - lastAccelSpeed) / dt
    : 0;
  lastAccelTime  = nowMs;
  lastAccelSpeed = speed;

  // console.log(`[triggerAccentEvent] speed=${speed.toFixed(1)}, accel=${accel.toFixed(1)}, swingThr=${dynSwingThreshold}, slashAccelThr=${dynSlashAccelThr}`);

  if (speed > dynSwingThreshold) {
    if (!swingTriggered) {
      // high‐accel -> slash, else swing
      if (accel > dynSlashAccelThr) {
        blade.addEffect(EFFECT_ACCENT_SLASH, 0);
      } else {
        blade.addEffect(EFFECT_ACCENT_SWING, 0);
      }
      swingTriggered = true;
    }
  }
  // only reset once we slow down past the lower threshold:
  else if (speed <= swingLowerThreshold) {
    swingTriggered = false;
  }
}

// const updateSmoothSwingGains = (() => {
//   const STALL_TIMEOUT    = 200;  // ms without a mouse_move → treat speed as 0
//   const STOP_THRESHOLD   =   8;
//   const START_THRESHOLD  =  12;
//   const STOP_DEBOUNCE    = 50;  // ms you must stay ≤ STOP_THRESHOLD before stopping

//   const SwingMin   =  15.0;
//   const SwingLPeak =  100.0;
//   const SwingMax   = 150.0;
//   const rampTime   =   0.3;  // seconds for cross-fade

//   let lastState   = 'stopped';
//   let staleLogged = false;
//   let belowSince  = null;

//   function frame() {
//     const nowMs = Date.now();
//     const dt    = nowMs - lastSwingUpdate;
//     let   speed = dt > STALL_TIMEOUT
//                   ? (staleLogged ? 0 : (staleLogged = true, 0))
//                   : (staleLogged = false, lastSwingSpeed);

//     // —— debounce logic ——  
//     let next = lastState;
//     if (speed <= STOP_THRESHOLD) {
//       if (belowSince === null) belowSince = nowMs;
//       else if (nowMs - belowSince >= STOP_DEBOUNCE) {
//         next = 'stopped';
//       }
//     } else {
//       belowSince = null;
//       if (speed >= START_THRESHOLD) {
//         next = 'running';
//       }
//     }

//     if (next !== lastState) {
//       const t = new Date().toISOString().substr(11,8);
//       if (next === 'stopped') {
//         console.log(`[SmoothSwing] ✋ stroke ended @${t} (speed ${speed.toFixed(1)} ≤ ${STOP_THRESHOLD})`);
//         fadeAndStop('smoothLoopL', 100);
//         fadeAndStop('smoothLoopH', 100);
//       } else {
//         console.log(`[SmoothSwing] ↻ new swing pair @ speed ${speed.toFixed(1)}`);
//         startAudioLoop('swingl','smoothLoopL',0,true);
//         startAudioLoop('swingh','smoothLoopH',0,true);
//       }
//       lastState = next;
//     }

//     // — crossfade gains when running —
//     if (lastState === 'running' && window.smoothLoopL && window.smoothLoopH) {
//       let gainL = 0, gainH = 0;
//       if (speed > SwingMin) {
//         if      (speed < SwingLPeak) gainL = (speed - SwingMin)/(SwingLPeak - SwingMin);
//         else if (speed < SwingMax)   gainL = (SwingMax   - speed)/(SwingMax   - SwingLPeak);

//         if      (speed < SwingLPeak) gainH = 0;
//         else if (speed < SwingMax)   gainH = (speed - SwingLPeak)/(SwingMax   - SwingLPeak);
//         else                          gainH = 1;
//       }

//       gainL *= globalVolume;
//       gainH *= globalVolume;

//       const ct = audioCtx.currentTime;
//       const gL = window.smoothLoopL.gainNode.gain;
//       const gH = window.smoothLoopH.gainNode.gain;
//       gL.cancelScheduledValues(ct);
//       gL.setValueAtTime(gL.value, ct);
//       gL.linearRampToValueAtTime(gainL, ct + rampTime);
//       gH.cancelScheduledValues(ct);
//       gH.setValueAtTime(gH.value, ct);
//       gH.linearRampToValueAtTime(gainH, ct + rampTime);
//     }

//     if (STATE_ON) requestAnimationFrame(frame);
//   }

//   return frame;
// })();


// const updateSmoothSwingGains = (() => {
//   const STALL_TIMEOUT    = 200;  // ms without a mouse_move → treat speed as 0
//   const STOP_THRESHOLD   =   8;
//   const START_THRESHOLD  =  12;
//   const STOP_DEBOUNCE    = 50;  // ms you must stay ≤ STOP_THRESHOLD before stopping

//   const SwingMin   =  15.0;
//   const SwingLPeak =  100.0;
//   const SwingMax   = 150.0;
//   const rampTime   =   0.3;  // seconds for cross-fade

//   let lastState   = 'stopped';
//   let staleLogged = false;
//   let belowSince  = null;

//   function frame() {
//     const nowMs = Date.now();
//     const dt    = nowMs - lastSwingUpdate;
//     let   speed = dt > STALL_TIMEOUT
//                   ? (staleLogged ? 0 : (staleLogged = true, 0))
//                   : (staleLogged = false, lastSwingSpeed);

//     // —— debounce logic ——  
//     let next = lastState;
//     if (speed <= STOP_THRESHOLD) {
//       if (belowSince === null) belowSince = nowMs;
//       else if (nowMs - belowSince >= STOP_DEBOUNCE) {
//         next = 'stopped';
//       }
//     } else {
//       belowSince = null;
//       if (speed >= START_THRESHOLD) {
//         next = 'running';
//       }
//     }

//     if (next !== lastState) {
//       const t = new Date().toISOString().substr(11,8);
//       if (next === 'stopped') {
//         console.log(`[SmoothSwing] ✋ stroke ended @${t} (speed ${speed.toFixed(1)} ≤ ${STOP_THRESHOLD})`);
//         fadeAndStop('smoothLoopL', 100);
//         fadeAndStop('smoothLoopH', 100);
//       } else {
//         console.log(`[SmoothSwing] ↻ new swing pair @ speed ${speed.toFixed(1)}`);
//         startAudioLoop('swingl','smoothLoopL',0,true);
//         startAudioLoop('swingh','smoothLoopH',0,true);
//       }
//       lastState = next;
//     }

//     // — crossfade gains when running —
//     if (lastState === 'running' &&
//         window.smoothLoopL && window.smoothLoopH) {

//       // clamp speed into [SwingMin … SwingMax]
//       let s = Math.max(SwingMin, Math.min(speed, SwingMax));

//       // compute normalized cross-fade factor 0→1 over the entire window
//       let t = (s - SwingMin) / (SwingMax - SwingMin);

//       // now L and H are perfect complements
//       let gainL = (1 - t) * globalVolume;
//       let gainH =         t  * globalVolume;

//       // apply to your gainNodes exactly as before
//       const now = audioCtx.currentTime;
//       const gL  = window.smoothLoopL.gainNode.gain;
//       const gH  = window.smoothLoopH.gainNode.gain;

//       gL.cancelScheduledValues(now);
//       gL.setValueAtTime(gL.value, now);
//       gL.linearRampToValueAtTime(gainL, now + rampTime);

//       gH.cancelScheduledValues(now);
//       gH.setValueAtTime(gH.value, now);
//       gH.linearRampToValueAtTime(gainH, now + rampTime);
//     }

//     if (STATE_ON) requestAnimationFrame(frame);
//   }

//   return frame;
// })();

const updateSmoothSwingGains = (() => {
  const STALL_TIMEOUT    = 200;  // ms without a mouse_move → treat speed as 0
  const STOP_THRESHOLD   =   8;  // deg/s → below this, we’ll stop (after debounce)
  const START_THRESHOLD  =  12;  // deg/s → must exceed this to start
  const STOP_DEBOUNCE    =  50;  // ms you must stay ≤ STOP_THRESHOLD before stopping

  const SwingLPeak = 60.0;    // also kept
  const SwingMax   = 150.0;    // deg/s → at or above this, envelope = 1
  const rampTime   =   0.3;    // seconds for the cross-fade ramp

  let lastState   = 'stopped';
  let staleLogged = false;
  let belowSince  = null;

  function frame() {
    const nowMs = Date.now();
    const dt    = nowMs - lastSwingUpdate;
    let   speed;

    // Stall detection
    if (dt > STALL_TIMEOUT) {
      if (!staleLogged) {
        console.log(`[SmoothSwing][DEBUG] no mouse_move for ${dt}ms → speed=0`);
        staleLogged = true;
      }
      speed = 0;
    } else {
      staleLogged = false;
      speed = lastSwingSpeed;
    }

    // Debounce logic: decide next state
    let next = lastState;
    if (speed <= STOP_THRESHOLD) {
      if (belowSince === null) belowSince = nowMs;
      else if (nowMs - belowSince >= STOP_DEBOUNCE) next = 'stopped';
    } else {
      belowSince = null;
      if (speed >= START_THRESHOLD) next = 'running';
    }

    // On state change → start or stop loops
    if (next !== lastState) {
      if (next === 'stopped') {
        console.log(`[SmoothSwing] ✋ STOPPED (speed ${speed.toFixed(1)} ≤ ${STOP_THRESHOLD})`);
        fadeAndStop('smoothLoopL', 100);
        fadeAndStop('smoothLoopH', 100);
      } else {
        console.log(`[SmoothSwing] ↻ RUNNING (speed ${speed.toFixed(1)} ≥ ${START_THRESHOLD})`);
// ↻ RUNNING (speed …)
const swingBufsL = pickLoopBuffers('swingl');
const swingBufsH = pickLoopBuffers('swingh');
if (swingBufsL.length && swingBufsH.length) {
  // choose a single random index and remember it for no‐repeat
  const idx = noRepeatRandom(swingBufsL.length, lastPlayedSoundIndex['swingl']);
  lastPlayedSoundIndex['swingl'] = lastPlayedSoundIndex['swingh'] = idx;

  // stop whatever was playing
  stopLoop('smoothLoopL');
  stopLoop('smoothLoopH');

  // play both L+H at the same index
  const { src: srcL, gainNode: gL } = playBuffer(swingBufsL[idx], 0, true, 0, masterGain);
  window.smoothLoopL = { src: srcL, gainNode: gL };
  const { src: srcH, gainNode: gH } = playBuffer(swingBufsH[idx], 0, true, 0, masterGain);
  window.smoothLoopH = { src: srcH, gainNode: gH };
}
      }
      lastState = next;
    }

    if (lastState === 'running' && window.smoothLoopL && window.smoothLoopH) {
      // overall envelope: 0 at STOP_THRESHOLD → 1 at SwingMax
      const env = speed > STOP_THRESHOLD
        ? Math.min((speed - STOP_THRESHOLD) / (SwingMax - STOP_THRESHOLD), 1)
        : 0;

      let gainL, gainH;

      // FULL LOW until SwingLPeak
      if (speed <= SwingLPeak) {
        gainL = env;
        gainH = 0;
      }
      // FULL HIGH above SwingMax
      else if (speed >= SwingMax) {
        gainL = 0;
        gainH = env;
      }
      // NARROW BLEND between SwingLPeak → SwingMax
      else {
        const x = (speed - SwingLPeak) / (SwingMax - SwingLPeak);
        gainL = (1 - x) * env;
        gainH = x         * env;
      }

      // apply master volume
      gainL *= globalVolume;
      gainH *= globalVolume;

      const ct = audioCtx.currentTime;
      const gL = window.smoothLoopL.gainNode.gain;
      const gH = window.smoothLoopH.gainNode.gain;

      gL.cancelScheduledValues(ct);
      gL.setValueAtTime(gL.value, ct);
      gL.linearRampToValueAtTime(gainL, ct + rampTime);

      gH.cancelScheduledValues(ct);
      gH.setValueAtTime(gH.value, ct);
      gH.linearRampToValueAtTime(gainH, ct + rampTime);
    }
    // 5) Loop
    if (STATE_ON) requestAnimationFrame(frame);
  }

  return frame;
})();


// Get duration (ms) from a File
function getAudioFileDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', function() {
      const ms = Math.round(audio.duration * 1000);
      URL.revokeObjectURL(url);
      resolve(ms);
    });
  });
}

function pickLoopBuffers(key) {
  const custom = (customFontSoundBuffers[key] || []).filter(b => b instanceof AudioBuffer);
  if (custom.length > 0 && currentFontName !== "Default") {
    return custom;
  }
  // either Default font, or custom empty + fallback enabled
  if (currentFontName === "Default" || useDefaultFontFallback) {
    return defaultFontSoundBuffers[key] || [];
  }
  return [];
}

function playBuffer(buffer, when = 0, loop = false, gain = 1, destination = masterGain) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop   = loop;

  const g = audioCtx.createGain();
  g.gain.value = gain;
  g.connect(destination);

  src.connect(g);
  src.start(audioCtx.currentTime + when);

  return { src, gainNode: g };
}

function noRepeatRandom(n, lastIndex) {
  if (n < 2) return 0;
  let idx = Math.floor(Math.random() * n);
  for (let i = 0; i < 3 && idx === lastIndex; i++) {
    idx = Math.floor(Math.random() * n);
  }
  return idx;
}

function playEffectByType(effectType) {
  const effectName = EFFECT_SOUND_MAP[effectType];
  if (!effectName) return;
  playRandomEffect(effectName, true);
}

function playRandomEffect(effectName, isAllowed = true) {
  if (!soundOn) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const customBufs = (customFontSoundBuffers[effectName] || [])
    .filter(b => b instanceof AudioBuffer);

  // 2) default fallback only when allowed
  const defaultBufs = (currentFontName === "Default" || useDefaultFontFallback)
    ? (defaultFontSoundBuffers[effectName] || [])
    : [];

  const total = customBufs.length + defaultBufs.length;

  // No sound file exists, show orange message
  if (total === 0) {
    const key = Object.keys(window).find(
      k => window[k] === effectName ||
           k.replace(/^EFFECT_/, '').toLowerCase() === effectName.toLowerCase()
    );
    const id  = key ? ` (${key})` : "";
    const msg = `No sound available for effect: "${effectName}"${id}.`;
    console.error(msg);
    const err = FIND("error_message");
    if (err) {
      err.innerHTML = msg;
      err.style.color = "orange";
      clearTimeout(window.errorMessageTimeout);
      window.errorMessageTimeout = setTimeout(() => {
        if (err.innerHTML === msg) err.innerHTML = "";
      }, 3000);
    }
    return;
  }

  // Suppressed by focus, just log it.
  if (!isAllowed) {
    console.log(`Suppressed sound '${effectName}'. Not in current focus.`);
    return;
  }

  // Pick & play
  const fontLabel = currentFontName === "Default" ? "Default Font" : currentFontName;
  const pickIndex = arr => {
    const i = noRepeatRandom(arr.length, lastPlayedSoundIndex[effectName]);
    lastPlayedSoundIndex[effectName] = i;
    return i;
  };

  let buf, fname, dur;
  if (customBufs.length > 0) {
    const i = pickIndex(customBufs);
    buf   = customBufs[i];
    fname = customFontSoundFilenames[effectName]?.[i] || "(unknown)";
    dur   = customFontSoundDurations   [effectName]?.[i] || 0;
  } else {
    const i = pickIndex(defaultBufs);
    buf   = defaultBufs[i];
    fname = defaultFontSoundFilenames[effectName]?.[i] || "(unknown)";
    dur   = defaultFontSoundDurations   [effectName]?.[i] || 0;
  }

  console.log(`▶ ${fontLabel}: ** playing ${fname} – ${dur}ms`);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain(); g.gain.value = globalVolume;
  src.connect(g).connect(masterGain);
  src.start();
  activeOneShots.push({ src, gainNode: g });
  src.onended = () => {
    activeOneShots = activeOneShots.filter(e => e.src !== src);
    g.disconnect();
  };
}

function stopLoop(refName) {
  if (!window[refName]) return;

  // smooth-swing & lockup: objects {src, gainNode}
  if (window[refName].src && window[refName].gainNode) {
    try { window[refName].src.stop();      window[refName].src.disconnect();   } catch(_) {}
    try { window[refName].gainNode.disconnect();                          } catch(_) {}
  }
  // humAudio & lockupLoopSrc: plain AudioBufferSourceNode
  else if (typeof window[refName].stop === 'function') {
    try { window[refName].stop();       window[refName].disconnect();        } catch(_) {}
    const gain = window[refName.replace(/(Audio|LoopSrc)$/, 'GainNode')];
    if (gain) try { gain.disconnect(); } catch(_) {}
  }
  // HTMLAudioElement fallback
  else if (window[refName] instanceof HTMLAudioElement) {
    try { window[refName].pause(); window[refName].src = ''; } catch(_) {}
  }

  window[refName] = null;
}

function fadeAndStop(loopRefName, fadeTime = 200) {
  const loop = window[loopRefName];
  if (loop && loop.gainNode) {
    // Remember which exact src we’re fading out
    const { src, gainNode } = loop;
    const g = gainNode.gain;
    const now = audioCtx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fadeTime / 1000);

    // Only stop *this* src after fadeTime, if it hasn't been replaced
    setTimeout(() => {
      if (window[loopRefName] && window[loopRefName].src === src) {
        stopLoop(loopRefName);
      }
    }, fadeTime);
  } else {
    stopLoop(loopRefName);
  }
}

function stopAllLoops(fadeTime = 200, clearLockup = true, context = '') {
  // First stop any lockup
  endLockupLoop(undefined, undefined, clearLockup);  // Power off: clear lockup state
  // Then fade out hum + smooth swings
  ['humAudio','smoothLoopL','smoothLoopH'].forEach(ref => {
        console.log(`[stopAllLoops] STOPPING Loops`);
    if (window[ref]) fadeAndStop(ref, fadeTime);
  });

  console.log("All audio loops stopped (with fade)");
}

function stopAllOneShots(fadeTime = 150) {
  activeOneShots.forEach(e => {
    if (e.gainNode && e.src) {
      const g   = e.gainNode.gain;
      const now = audioCtx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fadeTime/1000);
      setTimeout(() => {
        try { e.src.stop();       } catch(_) {}
        try { e.gainNode.disconnect(); } catch(_) {}
      }, fadeTime);
    } else if (e.audio instanceof HTMLAudioElement) {
      const a = e.audio, orig = a.volume;
      const steps = 10, interval = fadeTime/steps;
      let i = 0;
      const fade = setInterval(() => {
        a.volume = orig * (1 - (++i/steps));
        if (i >= steps) {
          clearInterval(fade);
          a.pause(); a.currentTime = 0; a.volume = orig;
        }
      }, interval);
    } else {
      if (e.src)       try { e.src.stop(); } catch(_) {}
      if (e.audio)     try { e.audio.pause(); e.audio.currentTime = 0; } catch(_) {}
      if (e.gainNode)  try { e.gainNode.disconnect(); } catch(_) {}
    }
  });
  activeOneShots = [];
}

function startAudioLoop(bufferKey, loopRefName, initialGain = 0, shouldLoop = true) {
  console.debug(
    `[SwingDebug][startAudioLoop] key=${bufferKey}, ref=${loopRefName}, ` +
    `initialGain=${initialGain}, shouldLoop=${shouldLoop}`
  );
  stopLoop(loopRefName);

  const startBuffers = pickLoopBuffers(bufferKey);
  if (!startBuffers.length) return;

  const startIdx = noRepeatRandom(startBuffers.length, lastPlayedSoundIndex[bufferKey]);
  lastPlayedSoundIndex[bufferKey] = startIdx;

  const { src, gainNode } = playBuffer(startBuffers[startIdx], 0, shouldLoop, initialGain, masterGain);
  window[loopRefName] = { src, gainNode };
}

function startHum() {
  if (!soundOn) return;
  // Kill any zombie loops.
  // if (window.humAudio) fadeAndStop('humAudio', 0);
  //       console.log(`[startHum] STOPPING and STARTING LOOPS`);
        console.log(`[startHum] __________ STARTING LOOPS`);
          startAudioLoop('hum',    'humAudio',    globalVolume, true);

}

function startLockupLoop(lockupType, skipBgn = false) {
  const mapEntry = ({
    [EFFECT_LOCKUP_BEGIN]: { b: 'bgnlock', l: 'lock', e: 'endlock' },
    [EFFECT_DRAG_BEGIN]:   { b: 'bgndrag', l: 'drag', e: 'enddrag' },
    [EFFECT_MELT_BEGIN]:   { b: 'bgnmelt', l: 'melt', e: 'endmelt' },
    [EFFECT_LB_BEGIN]:     { b: 'bgnlb',   l: 'lb',   e: 'endlb' },
  })[lockupType];
  if (!mapEntry) return;

  const { b, l, e } = mapEntry;

  window.currentLockupType = lockupType;
  if (!soundOn) return;


  const beginBuffers = pickLoopBuffers(b) || [];
  const loopBuffers  = pickLoopBuffers(l) || [];
  if (!beginBuffers.length || !loopBuffers.length) return;
  lockupEndBuffer = (pickLoopBuffers(e) || [])[0] || null;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = globalVolume;
  gainNode.connect(masterGain);

  const now = audioCtx.currentTime;
  let startOffset = 0;

  // Play the "begin" sound first, if we're not skipping it
  if (!skipBgn) {
    const bgnIdx = noRepeatRandom(beginBuffers.length, lastPlayedSoundIndex[b]);
    lastPlayedSoundIndex[b] = bgnIdx;
    const { src: bgnSrc } = playBuffer(beginBuffers[bgnIdx], 0, false, globalVolume, gainNode);
    startOffset = bgnSrc.buffer.duration;
  }

  // Play lockup loop
  const loopIdx = noRepeatRandom(loopBuffers.length, lastPlayedSoundIndex[l]);
  lastPlayedSoundIndex[l] = loopIdx;
  const { src: loopSrc } = playBuffer(loopBuffers[loopIdx], startOffset, true, globalVolume, gainNode);
  window.lockupLoopSrc  = loopSrc;
  window.lockupGainNode = gainNode;
}

function endLockupLoop(effectType, endEffectName, shouldClear) {
  // console.log("[Lockup] ▶ endLockupLoop called;", {
  //   effectType,
  //   endEffectName,
  //   shouldClear,
  //   isLoopRunning: !!window.lockupLoopSrc
  // });

    if (window.lockupLoopSrc) {
    try {
      window.lockupLoopSrc.stop();
      window.lockupLoopSrc.disconnect();
    } catch(_) {}
    window.lockupLoopSrc = null;
  }
  // Play endlock if exists, with fallback to default font when needed
  if (endEffectName) {
    const fontLabel = currentFontName === "Default"
      ? "Default Font"
      : (currentFontName || "Custom Font");

    // Try custom sound.
    const customBufs = (customFontSoundBuffers[endEffectName] || [])
      .filter(b => b instanceof AudioBuffer);

    if (customBufs.length > 0) {
      const endIdx = noRepeatRandom(customBufs.length, lastPlayedSoundIndex[endEffectName]);
      lastPlayedSoundIndex[endEffectName] = endIdx;
      const buf   = customBufs[endIdx];
      const fname = customFontSoundFilenames[endEffectName]?.[endIdx] || "(unknown)";
      const dur   = customFontSoundDurations[endEffectName]?.[endIdx]
                 ? Math.round(customFontSoundDurations[endEffectName][endIdx]) : "???";
      console.log(`▶ ${fontLabel}: ** playing ${fname} – ${dur}ms`);
      playBuffer(buf, 0, false, globalVolume, masterGain);
      // Continue after playing custom.
      // Now drop the old lockup gain node itself
      if (window.lockupGainNode) {
        try { window.lockupGainNode.disconnect(); } catch(_) {}
        window.lockupGainNode = null;
      }
      if (shouldClear) window.currentLockupType = null;
      return;
    }

    // If we're on Default font OR fallback is enabled, try default buffers.
    if (currentFontName === "Default" || useDefaultFontFallback) {
      const defaultBufs = defaultFontSoundBuffers[endEffectName] || [];
      if (defaultBufs.length > 0) {
        const endIdx = noRepeatRandom(defaultBufs.length, lastPlayedSoundIndex[endEffectName]);
        lastPlayedSoundIndex[endEffectName] = endIdx;
        const buf   = defaultBufs[endIdx];
        const fname = defaultFontSoundFilenames[endEffectName]?.[endIdx] || "(unknown)";
        const dur   = defaultFontSoundDurations[endEffectName]?.[endIdx]
                   ? Math.round(defaultFontSoundDurations[endEffectName][endIdx]) : "???";
        console.log(`▶ Default Font: ** playing ${fname} – ${dur}ms`);
        playBuffer(buf, 0, false, globalVolume, masterGain);
      }
    }
  }
  if (window.lockupGainNode) {
    try { window.lockupGainNode.disconnect(); } catch(_) {}
    window.lockupGainNode = null;
  }
  // Only clear on true END event (user ends lockup or power actually turns off)
  if (shouldClear) window.currentLockupType = null;
}

function resumeLoops() {
  if (STATE_ON && focusAllowsHum) startHum();
  if (window.currentLockupType && !window.lockupLoopSrc) startLockupLoop(window.currentLockupType, true);
}

window.addEventListener('focus', () => { if (soundOn) resumeLoops(); });
