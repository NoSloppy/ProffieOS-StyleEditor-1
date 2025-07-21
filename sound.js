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


// SmoothSwing and swing sounds
let swingSpeed = 0;
window.swingMotionPeak = 0;
window.swingMotionActive = false;
window.swingLastEffect = 0;
const swingThreshold = 150;
const slashThreshold = 230;
const effectCooldown = 250; // ms

let lastSwingUpdate = 0;
let lastSwingSpeed = 0;
let lastSmoothGainL = 0;
let lastSmoothGainH = 0;
let smoothswingIdle = false;

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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9999',
    textAlign: 'center',
  });
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) document.body.removeChild(overlay);
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

const updateSmoothSwingGains = (() => {
  let lastGainL, lastGainH, lastSpeed;
  return function() {
    if (!STATE_ON) {
      if (!smoothswingIdle) {
        fadeAndStop('smoothLoopL', 200);
        fadeAndStop('smoothLoopH', 200);
        console.log('[SmoothSwing] POWER OFF → stopping loops');
        smoothswingIdle = true;
      }
      requestAnimationFrame(updateSmoothSwingGains);
      return;
    }
    swingSpeed = lastSwingSpeed;
    if (Date.now() - lastSwingUpdate > 50) swingSpeed = 0;

    if (STATE_ON) {
      if (swingSpeed === 0) {
        if (!smoothswingIdle) {
          fadeAndStop('smoothLoopL', 200);
          fadeAndStop('smoothLoopH', 200);
          console.log(`[SmoothSwing] --- STOPPING LOOPS`);
          smoothswingIdle = true;
        }
      } else {
        if (smoothswingIdle) {
          startAudioLoop('swingl', 'smoothLoopL', 0, true);
          startAudioLoop('swingh', 'smoothLoopH', 0, true);
          console.log(`[SmoothSwing] +++ STARTING LOOPS`);
        }
        smoothswingIdle = false;
      }
    }

    if (window.smoothLoopL && window.smoothLoopH) {
      const SwingStrengthThreshold    = 5.0;
      const AccentSwingSpeedThreshold = 150.0;
      let gainL = 0, gainH = 0;
      if (swingSpeed > SwingStrengthThreshold) {
        let t = (swingSpeed - SwingStrengthThreshold) / (AccentSwingSpeedThreshold - SwingStrengthThreshold);
        t = Math.max(0, Math.min(1, t));
        gainL = t;
        gainH = t * t;
      }
      const now = audioCtx.currentTime;
      let ramp = 0.2;
      let gL = window.smoothLoopL.gainNode.gain;
      let gH = window.smoothLoopH.gainNode.gain;
      gL.cancelScheduledValues(now);
      gL.setValueAtTime(gL.value, now);
      gL.linearRampToValueAtTime(gainL, now + ramp);
      gH.cancelScheduledValues(now);
      gH.setValueAtTime(gH.value, now);
      gH.linearRampToValueAtTime(gainH, now + ramp);

      // Remember raw gains so volume slider can reapply them later
      lastSmoothGainL = gainL;
      lastSmoothGainH = gainH;

      // Log on change.
      if (gainL !== lastGainL || gainH !== lastGainH || swingSpeed !== lastSpeed) {
        console.log(`[SmoothSwing] speed=${swingSpeed.toFixed(1)} gainL=${gainL.toFixed(2)} gainH=${gainH.toFixed(2)}`);
        lastGainL = gainL;
        lastGainH = gainH;
        lastSpeed = swingSpeed;
      }
    }
    requestAnimationFrame(updateSmoothSwingGains);
  }
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
  playRandomEffect(effectName);
}

function playRandomEffect(effectName) {
  if (!soundOn) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const fontLabel = currentFontName === "Default"
    ? "Default Font"
    : currentFontName;

  // Try custom sound.
  const customBufs = (customFontSoundBuffers[effectName] || [])
    .filter(b => b instanceof AudioBuffer);
  if (customBufs.length > 0) {
    const effectIdx = noRepeatRandom(customBufs.length, lastPlayedSoundIndex[effectName]);
    lastPlayedSoundIndex[effectName] = effectIdx;
    const buf   = customBufs[effectIdx];
    const fname = customFontSoundFilenames[effectName]?.[effectIdx] || "(unknown)";
    console.log(`▶ ${fontLabel}: ** playing ${fname} – ${customFontSoundDurations[effectName][effectIdx]}ms`);

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.value = globalVolume;
    src.connect(g).connect(masterGain);
    src.start();
    activeOneShots.push({ src, gainNode: g });
    src.onended = () => {
      activeOneShots = activeOneShots.filter(e => e.src !== src);
      g.disconnect();
    };
    return;
  }

  // If we're on Default font OR fallback is enabled, try default buffers.
  if (currentFontName === "Default" || useDefaultFontFallback) {
    const defaultBufs = defaultFontSoundBuffers[effectName] || [];
    if (defaultBufs.length > 0) {
      const effectIdx = noRepeatRandom(defaultBufs.length, lastPlayedSoundIndex[effectName]);
      lastPlayedSoundIndex[effectName] = effectIdx;
      const buf   = defaultBufs[effectIdx];
      const fname = defaultFontSoundFilenames[effectName]?.[effectIdx] || "(unknown)";
      console.log(`▶ Default Font: ** playing ${fname} – ${defaultFontSoundDurations[effectName][effectIdx]}ms`);

      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const g = audioCtx.createGain();
      g.gain.value = globalVolume;
      src.connect(g).connect(masterGain);
      src.start();
      activeOneShots.push({ src, gainNode: g });
      src.onended = () => {
        activeOneShots = activeOneShots.filter(e => e.src !== src);
        g.disconnect();
      };
      return;
    }
  }

  // No sound available, show orange message.
  const effectKey = Object.keys(window).find(
    k => window[k] === effectName ||
         k.replace(/^EFFECT_/, '').toLowerCase() === effectName.toLowerCase()
  );
  const effectId = effectKey ? ` (${effectKey})` : "";
  const msg = `No sound available for effect: "${effectName}"${effectId}.`;
  console.error(msg);
  const errorDiv = FIND("error_message");
  if (errorDiv) {
    errorDiv.innerHTML = msg;
    errorDiv.style.color = "orange";
    clearTimeout(window.errorMessageTimeout);
    window.errorMessageTimeout = setTimeout(() => {
      if (errorDiv.innerHTML === msg) errorDiv.innerHTML = "";
    }, 3000);
  }
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
    const g   = loop.gainNode.gain;
    const now = audioCtx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fadeTime/1000);
    setTimeout(() => stopLoop(loopRefName), fadeTime);
  } else {
    // fallback to immediate stop
    stopLoop(loopRefName);
  }
}

function stopAllLoops(fadeTime = 200, clearLockup = true, context = '') {
  // first stop any lockup
  endLockupLoop(undefined, undefined, clearLockup);  // Power off: clear lockup state
  // then fade out hum + smooth swings
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

function ToggleHum() {
  if (!soundOn) return;
  if (window.humAudio) fadeAndStop('humAudio', 0);

  startAudioLoop('hum',    'humAudio',    globalVolume, true);
  startAudioLoop('swingl', 'smoothLoopL', 0,           true);
  startAudioLoop('swingh', 'smoothLoopH', 0,           true);
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
  console.log("[endLockupLoop] effectType:", effectType, "endEffectName:", endEffectName, "shouldClear:", shouldClear);
  console.log("customFontSoundBuffers[endEffectName]:", customFontSoundBuffers[endEffectName]);
  console.log("defaultFontSoundBuffers[endEffectName]:", defaultFontSoundBuffers[endEffectName]);
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
  // Now drop the old lockup gain node itself
  if (window.lockupGainNode) {
    try { window.lockupGainNode.disconnect(); } catch(_) {}
    window.lockupGainNode = null;
  }
  // Only clear on true END event (user ends lockup or power actually turns off)
  if (shouldClear) window.currentLockupType = null;
}

function resumeLoops() {
  if (STATE_ON) ToggleHum();
  if (window.currentLockupType && !window.lockupLoopSrc)
    startLockupLoop(window.currentLockupType, true);
}

window.addEventListener('focus', () => { 
  if (soundOn) resumeLoops(); 
});
