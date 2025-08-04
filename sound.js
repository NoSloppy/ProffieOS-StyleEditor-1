// Default font data loaded from GitHub
const defaultFontSoundBuffers   = {};
const defaultFontSoundDurations = {};
const defaultFontSoundFilenames = {};

// Custom font data, user-loaded
const customFontSoundBuffers    = {};
const customFontSoundDurations  = {};
const customFontSoundFilenames  = {};

// State tracking
let currentFontName             = "Default";
let useDefaultFontFallback      = false;  // Checkbox
const lastPlayedSoundIndex      = {};

// Audio setup
let soundOn                     = true;  // Checkbox
const audioCtx                  = new (window.AudioContext || window.webkitAudioContext)();
const masterGain                = audioCtx.createGain();
const volumeSlider              = FIND('VOLUME_SLIDER');
const volumeValue               = FIND('VOLUME_VALUE');
let globalVolume                = volumeSlider.value / 100;
masterGain.gain.value           = globalVolume;
masterGain.connect(audioCtx.destination);

// Lockup/loop sources
let lockupGainNode              = null;
let lockupLoopSrc               = null;
let lockupEndBuffer             = null;

// Active sounds and state
let activeOneShots              = [];
let focusAllowsHum              = true;

// Load default font.
fetch('default_font_urls.txt')
  .then(r => r.text())
  .then(text => {
    text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(url => {
        const m = url.match(/([a-z]+)[0-9]*\.wav$/i);
        if (!m) return;
        const effect = m[1].toLowerCase();

        defaultFontSoundBuffers  [effect] ||= [];
        defaultFontSoundDurations[effect] ||= [];
        defaultFontSoundFilenames[effect] ||= [];

        const idx = defaultFontSoundFilenames[effect].length;
        defaultFontSoundFilenames[effect][idx] = url.split('/').pop();

        fetch(url)
          .then(r => r.arrayBuffer())
          .then(data => audioCtx.decodeAudioData(data))
          .then(buffer => {
            defaultFontSoundBuffers[effect][idx]   = buffer;
            defaultFontSoundDurations[effect][idx] = Math.round(buffer.duration * 1000);
//            console.log(`Default font: ${defaultFontSoundFilenames[effect][idx]} - duration ${defaultFontSoundDurations[effect][idx]} ms`);
          })
          .catch(err => console.error(`Error loading ${url}:`, err));
      });
  })
  .catch(err => console.error("Could not load default_font_urls.txt:", err));

const chooseLocalFontBtn = FIND('choose_local_font');
const fileInput          = FIND('files');

chooseLocalFontBtn.addEventListener('click', () => {
  fileInput.value = "";
  fileInput.click();
});

// Load custom font
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;           // user cancelled

  showLoadingOverlay();

  // Determine folder / font name
  const folderName = files[0].webkitRelativePath
    ? files[0].webkitRelativePath.split('/')[0]
    : files[0].name;
  FIND('choose_local_font_label').textContent = folderName;
  currentFontName = folderName;

  // Clear out any old custom data
  Object.keys(customFontSoundBuffers).forEach(effect => {
    delete customFontSoundBuffers[effect];
    delete customFontSoundDurations[effect];
    delete customFontSoundFilenames[effect];
  });

  // Build an array of Promises—one per file—to decode & stash buffers
  const loadPromises = files.map(file => {
    const m = file.name.match(/^([a-z]+)[0-9]*\.wav$/i);
    // skip non-wav or unrecognized
    if (!m) return Promise.resolve();

    const effect = m[1].toLowerCase();
    customFontSoundBuffers  [effect] ||= [];
    customFontSoundDurations[effect] ||= [];
    customFontSoundFilenames[effect] ||= [];

    // Next index for this effect
    const idx = customFontSoundFilenames[effect].length;
    customFontSoundFilenames[effect][idx] = file.name;

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        audioCtx.decodeAudioData(reader.result)
          .then(buffer => {
            customFontSoundBuffers[effect][idx]   = buffer;
            const dur = Math.round(buffer.duration * 1000);
            customFontSoundDurations[effect][idx] = dur;
            console.log(`Custom font: ${folderName} ${file.name} – ${dur} ms`);
            resolve();
          })
          .catch(err => {
            console.error(`Decode error for ${file.name}:`, err);
            resolve();
          });
      };
      reader.onerror = err => {
        console.error(`FileReader error for ${file.name}:`, err);
        resolve();
      };
      reader.readAsArrayBuffer(file);
    });
  });

  // When loading finishes, hide overlay
  Promise.all(loadPromises)
    .then(() => hideLoadingOverlay())
    .catch(err => {
      console.error("Error loading custom font files:", err);
      hideLoadingOverlay();
    });
});

// SmoothSwing and swing sounds
const swingThreshold       = 240;  // deg/s threshold to trigger a swing effect
const slashThreshold       = 4000; // deg/s² acceleration threshold to trigger a slash
const swingLowerThreshold  = swingThreshold * 0.5; // deg/s reset threshold after a swing

let lastSwingUpdate        = 0;    // last timestamp (ms) when swing was updated
let lastSwingSpeed         = 0;    // rotation speed recorded at last update

// Accel/slash state
let lastAccelSpeed         = 0;    // previous speed for acceleration computation
let lastAccelTime          = performance.now(); // last timestamp for accel calc
let swingTriggered         = false;// prevents retriggering while above threshold

// SmoothSwing V2 rotating‐buffer files
const swinglFiles          = defaultFontSoundBuffers['swingl'] || []; // L channel buffers
const swinghFiles          = defaultFontSoundBuffers['swingh'] || []; // H channel buffers
let currentFileIdx         = 0;    // rotating index into swinglFiles/swinghFiles

// SmoothSwing V2 rotating‐buffer state
let swingMidpoint          = 0;    // current rotation midpoint for crossfade
const swingWidth           = 60;   // degrees over which to crossfade L→H
const swingSeparation      = 180;  // degrees before swapping L/H channels

// Accent‐swing vs slash
function triggerAccentEvent(speed) {
  if (!STATE_ON) return;
  // Only the swing check is scaled for fullscreen; slash accel is constant
  const dynSwingThreshold = document.fullscreenElement
    ? swingThreshold * 0.7
    : swingThreshold;
  const dynSlashAccelThr  = slashThreshold;

  // Compute accel
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
      // High‐accel, do slash, else swing
      if (accel > dynSlashAccelThr) {
        blade.addEffect(EFFECT_ACCENT_SLASH, 0);
      } else {
        blade.addEffect(EFFECT_ACCENT_SWING, 0);
      }
      swingTriggered = true;
    }
  }
  // Only reset once we slow down past the lower threshold:
  else if (speed <= swingLowerThreshold) {
    swingTriggered = false;
  }
}

const updateSmoothSwingGains = (() => {
  const STALL_TIMEOUT    = 200;  // ms without a mouse_move, treat speed as 0
  const STOP_THRESHOLD   =   8;  // deg/s. Below this, we’ll stop (after debounce)
  const START_THRESHOLD  =  12;  // deg/s. Must exceed this to start
  const STOP_DEBOUNCE    =  50;  // ms required to stay ≤ STOP_THRESHOLD before stopping

  const swingLPeak = 60.0;
  const swingMax   = 150.0;    // deg/s. At or above this, envelope = 1
  const rampTime   =   0.3;    // Seconds for the cross-fade ramp

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

    // Debounce - decide next state
    let next = lastState;
    if (speed <= STOP_THRESHOLD) {
      if (belowSince === null) belowSince = nowMs;
      else if (nowMs - belowSince >= STOP_DEBOUNCE) next = 'stopped';
    } else {
      belowSince = null;
      if (speed >= START_THRESHOLD) next = 'running';
    }

    // On state change, start or stop loops
    if (next !== lastState) {
      if (next === 'stopped') {
        console.log(`[SmoothSwing] ✋ STOPPED (speed ${speed.toFixed(1)} ≤ ${STOP_THRESHOLD})`);
        fadeAndStop('smoothLoopL', 100);
        fadeAndStop('smoothLoopH', 100);
      } else if (soundOn) {
        console.log(`[SmoothSwing] RUNNING (speed ${speed.toFixed(1)} ≥ ${START_THRESHOLD})`);
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
      // overall envelope: 0 at STOP_THRESHOLD → 1 at swingMax
      const env = speed > STOP_THRESHOLD
        ? min((speed - STOP_THRESHOLD) / (swingMax - STOP_THRESHOLD), 1)
        : 0;
      let gainL, gainH;
      if (speed <= swingLPeak) {
        // FULL LOW until swingLPeak
        gainL = env;
        gainH = 0;
      } else if (speed >= swingMax) {
        // FULL HIGH above swingMax
        gainL = 0;
        gainH = env;
      } else {
        // NARROW BLEND between swingLPeak → swingMax
        const x = (speed - swingLPeak) / (swingMax - swingLPeak);
        gainL = (1 - x) * env;
        gainH = x         * env;
      }

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
    // Loop
    if (STATE_ON && focusAllowsHum) requestAnimationFrame(frame);
  }

  return frame;
})();

volumeSlider.addEventListener('input', function() {
  volumeValue.textContent = this.value;
  globalVolume = Number(this.value) / 100;
  // Update master volume
  masterGain.gain.value = globalVolume;
});

function showLoadingOverlay() {
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading_overlay';
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.innerText = 'Loading, please stand by…';
  document.body.appendChild(loadingOverlay);
}

function hideLoadingOverlay() {
  const loadingOverlay = FIND('loading_overlay');
  if (loadingOverlay) document.body.removeChild(loadingOverlay);
  if (window.lockupLoopSrc) {
    endLockupLoop(window.currentLockupType, null, false);
  }
  resumeLoops();
}

// Get duration from font file
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

// Recursively sum all transition durations from any:
// - WavLen<> that uses either font sound or global value
// - MILLIS
// - Nested args
function sumTransitionDurations(node) {
  if (!node) return 0;
  const ctor = node.constructor.name;
  if (ctor === 'WavLenClass') {
    return Number(node.getInteger(0));
  }
  if (node.MILLIS) {
    return Number(node.MILLIS.getInteger(0));
  }
  if (Array.isArray(node.args)) {
    return node.args.reduce((sum, child) => sum + sumTransitionDurations(child), 0);
  }
  return 0;
}

function pickLoopBuffers(key) {
  const custom = customFontSoundBuffers[key] || [];
  if (custom.length > 0 && currentFontName !== "Default") {
    return custom;
  }
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
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const customBufs  = customFontSoundBuffers[effectName]  || [];

  // Default fallback only when allowed
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
    showNoSoundMsg(effectName, key ? ` (${key})` : "");
    return;
  }

  // Suppressed by focus, just log it.
  if (!isAllowed) {
    console.log(`Suppressed sound '${effectName}'. Not in current focus.`);
    return;
  }

  // Pick & play
  const fontLabel = currentFontName === "Default" ? "Default Font" : currentFontName;
  let bufs, fnames, durs;
  if (customBufs.length > 0) {
    bufs   = customBufs;
    fnames = customFontSoundFilenames[effectName];
    durs   = customFontSoundDurations[effectName];
  } else {
    bufs   = defaultBufs;
    fnames = defaultFontSoundFilenames[effectName];
    durs   = defaultFontSoundDurations[effectName];
  }

  const idx = noRepeatRandom(bufs.length, lastPlayedSoundIndex[effectName]);
  lastPlayedSoundIndex[effectName] = idx;

  const buf   = bufs[idx];
  const fname = fnames[idx];
  const dur   = durs[idx];

  console.log(`▶ ${fontLabel}: ** ${soundOn ? 'Playing' : 'Muted'} ${fname} – ${dur}ms`);
  if (!soundOn) return;
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

function showNoSoundMsg(effectName, idText = "") {
  const msg = `No sound available for effect: "${effectName}"${idText}.`;
  console.log(msg);
  const err = FIND("error_message");
  if (err) {
    err.innerHTML = msg;
    err.style.color = "orange";
    clearTimeout(window.errorMessageTimeout);
    window.errorMessageTimeout = setTimeout(() => {
      if (err.innerHTML === msg) err.innerHTML = "";
    }, 3000);
  }
}

function stopLoop(refName) {
  const ref = window[refName];
  if (!ref) return;

  if (ref.src) {
    ref.src.stop?.();
    ref.src.disconnect?.();
  }
  ref.stop?.();
  ref.disconnect?.();
  ref.gainNode?.disconnect();

  // Disconnect paired GainNode if exists (for hum/lockup)
  const gainName = refName.replace(/(Audio|LoopSrc)$/, 'GainNode');
  window[gainName]?.disconnect?.();

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
  if (!beginBuffers.length || !loopBuffers.length) {
    // Find lockup display name for the message
    const lockupLabel = ({
      [EFFECT_LOCKUP_BEGIN]: "Lockup",
      [EFFECT_DRAG_BEGIN]:   "Drag",
      [EFFECT_MELT_BEGIN]:   "Melt",
      [EFFECT_LB_BEGIN]:     "Lightning Block"
    })[lockupType] || lockupType;
    showNoSoundMsg(lockupLabel, "");
    return;
  }
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
  // console.log("******************** [Lockup] ▶ endLockupLoop called;", {
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
    function tryPlayBuffers(bufs, fnames, durs, fontLabel) {
      if (bufs.length > 0) {
        const endIdx = noRepeatRandom(bufs.length, lastPlayedSoundIndex[endEffectName]);
        lastPlayedSoundIndex[endEffectName] = endIdx;
        const buf = bufs[endIdx];
        const fname = fnames?.[endIdx] || "(unknown)";
        const dur = durs?.[endIdx] ? Math.round(durs[endIdx]) : "???";
        console.log(`▶ ${fontLabel}: ** playing ${fname} – ${dur}ms`);
        playBuffer(buf, 0, false, globalVolume, masterGain);
        if (window.lockupGainNode) {
          try { window.lockupGainNode.disconnect(); } catch(_) {}
          window.lockupGainNode = null;
        }
        if (shouldClear) window.currentLockupType = null;
        return true;
      }
      return false;
    }

    // Try custom font first
    const customBufs = (customFontSoundBuffers[endEffectName] || []).filter(b => b instanceof AudioBuffer);
    if (tryPlayBuffers(
      customBufs,
      customFontSoundFilenames[endEffectName],
      customFontSoundDurations[endEffectName],
      currentFontName === "Default" ? "Default Font" : (currentFontName || "Custom Font")
    )) return;

    // Then try default font fallback if needed
    if (currentFontName === "Default" || useDefaultFontFallback) {
      tryPlayBuffers(
        defaultFontSoundBuffers[endEffectName] || [],
        defaultFontSoundFilenames[endEffectName],
        defaultFontSoundDurations[endEffectName],
        "Default Font"
      );
    }
  }
  if (window.lockupGainNode) {
    try { window.lockupGainNode.disconnect(); } catch(_) {}
    window.lockupGainNode = null;
  }
  if (shouldClear) window.currentLockupType = null;
}

function resumeLoops() {
  if (STATE_ON && focusAllowsHum) {
    startHum();
    updateSmoothSwingGains();
  }
  if (window.currentLockupType && !window.lockupLoopSrc) startLockupLoop(window.currentLockupType, true);
}

window.addEventListener('focus', () => { if (soundOn) resumeLoops(); });
