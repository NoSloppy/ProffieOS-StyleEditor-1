////////////// Add Sound PR ///////////
// Preload defaultFontSounds + buffers + durations
let defaultFontSounds = {};
const fontSoundBuffers = {};
let fontSoundDurations = {};
const fontSoundFilenames = {};
let fontSounds = {};

// If wanted, a "loading" overlay could show until load done,
//  but annoying, esp if not doing sound
// let fontIsLoaded  = false;
// let waitingForFont = false;
// let fontPromises   = null;

// Track which index was played for each effect (noRepeatRandom() use)
const lastPlayedSoundIndex = {};
let soundOn = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let activeOneShots = [];
let lastSmoothGainL = 0;
let lastSmoothGainH = 0;

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
      fontSoundBuffers[effect]   = [];
      fontSoundDurations[effect] = [];

      urlList.forEach((url, idx) => {
        fetch(url)
          .then(r => r.arrayBuffer())
          .then(data => audioCtx.decodeAudioData(data))
          .then(buffer => {
            // store decoded AudioBuffer
            fontSoundBuffers[effect][idx] = buffer;
            // store duration for WavLen & timing
            fontSoundDurations[effect][idx] = Math.round(buffer.duration * 1000);
            // Track filenames for each buffer index - really just for logging.
            fontSoundFilenames[effect] ||= [];
            fontSoundFilenames[effect][idx] = url.split('/').pop();
            console.log(`Default font: ${fontSoundFilenames[effect][idx]} - duration ${fontSoundDurations[effect][idx]} ms`);
          })
          .catch(err => console.error(`Error loading default sound ${url}:`, err));
      });
    }
  })
  .catch(err => console.error("Could not load default_font_urls.txt:", err));

const volumeSlider = document.getElementById('VOLUME_SLIDER');
const volumeValue = document.getElementById('VOLUME_VALUE');
let globalVolume = Number(volumeSlider.value) / 100;

volumeSlider.addEventListener('input', function() {
  volumeValue.textContent = this.value;
  globalVolume = Number(this.value) / 100;

  // Update gain for hum and lockup
  if (window.humAudio && window.humAudio.gainNode)
    window.humAudio.gainNode.gain.value = globalVolume;

  if (window.lockupGainNode)
    window.lockupGainNode.gain.value = globalVolume;

  // Update smoothswing volumes relative to global
  if (window.smoothLoopL && window.smoothLoopL.gainNode)
    window.smoothLoopL.gainNode.gain.value = lastSmoothGainL * globalVolume;
  if (window.smoothLoopH && window.smoothLoopH.gainNode)
    window.smoothLoopH.gainNode.gain.value = lastSmoothGainH * globalVolume;

  // Update any currently active HTMLAudio one-shots (for effect sounds)
  if (window.activeOneShots && Array.isArray(window.activeOneShots)) {
    window.activeOneShots.forEach(obj => {
      if (obj.gainNode) obj.gainNode.gain.value = globalVolume;
      if (obj.audio)    obj.audio.volume         = globalVolume;
    });
  }
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
  stopAllLoops();
  stopAllOneShots();

  fileInput.value = '';
  fileInput.click();
});

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

  fontSounds = {};
  fontSoundDurations = {};
  for (let k in fontSoundBuffers) delete fontSoundBuffers[k];
  const promises = [];

  for (const file of selectedFiles) {
    const m = file.name.match(/^([a-z]+)[0-9]*\.wav$/i);
    if (!m) continue;
    const effect = m[1].toLowerCase();

    fontSounds[effect] ||= [];
    fontSoundDurations[effect] = fontSoundDurations[effect] || [];
    const idx = fontSounds[effect].length;
    fontSounds[effect].push(file);
    fontSoundDurations[effect][idx] = null;
    fontSoundFilenames[effect] ||= [];
    fontSoundFilenames[effect][idx] = file.name;
    if (!fontSoundBuffers[effect]) fontSoundBuffers[effect] = [];
    fontSoundBuffers[effect][idx] = null;

    const reader = new FileReader();
    reader.onload = ev => {
      audioCtx.decodeAudioData(ev.target.result)
        .then(buffer => {
          fontSoundBuffers[effect][idx] = buffer;
          const dur = Math.round(buffer.duration * 1000);
          fontSoundDurations[effect][idx] = dur;
          console.log(`Custom font: ${folderName} ${file.name} - duration ${dur} ms`);
        })
        .catch(err => console.error("Decode error:", err));
    };
    reader.readAsArrayBuffer(file);

    promises.push(
      getAudioFileDuration(file).then(ms => {
        fontSoundDurations[effect][idx] = ms;
      })
    );
  }

  Promise.all(promises)
    .catch(err => console.error("Error loading durations:", err))
    .then(() => hideLoadingOverlay && hideLoadingOverlay());
});

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

function playRandomEffect(effectName) {
if (!soundOn) return;
  // console.log(`playRandomEffect() called for '${effectName}'`);
  // console.log("  fontSoundBuffers:", fontSoundBuffers[effectName]);
  // console.log("  fontSoundDurations:", fontSoundDurations[effectName]);
  // console.log("  lastPlayedSoundIndex:", lastPlayedSoundIndex[effectName]);

  // Resume AudioContext if necessary (iOS/Safari)
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // Try WebAudio buffers first
  const buffers = fontSoundBuffers[effectName] || [];
  const useBuffers = buffers.length > 0 && buffers.every(b => b instanceof AudioBuffer);

  if (useBuffers) {
    const last = lastPlayedSoundIndex[effectName] ?? -1;
    const idx  = noRepeatRandom(buffers.length, last);
    lastPlayedSoundIndex[effectName] = idx;

    const fname = fontSoundFilenames?.[effectName]?.[idx] || "(unknown)";
    console.log(
      `▶ [WebAudio] playing: ${fname} - duration=${fontSoundDurations[effectName]?.[idx]} ms`
    );

    const src = audioCtx.createBufferSource();
    src.buffer = buffers[idx];
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = globalVolume;
    src.connect(gainNode).connect(audioCtx.destination);
    src.start(0);
    // Track the one-shot
    activeOneShots.push({src, gainNode});

    // Remove from activeOneShots when done
    src.onended = () => {
      // Remove only this entry
      activeOneShots = activeOneShots.filter(e => e.src !== src);
      gainNode.disconnect();
    };
    return;
  }

  // Fallback to files/URLs
  let arr = fontSounds[effectName];
  console.log("▶ [Fallback] fontSounds before default:", arr);
  if (!arr || arr.length === 0) arr = defaultFontSounds[effectName];
  console.log("▶ [Fallback] fontSounds after default:", arr);
  if (!arr || arr.length === 0) {
    // Special case: If effectName is "slash", play swing as fallback and warn
    if (effectName === "slash") {
      const msg = `[Warning] No slash.wav available for EFFECT_ACCENT_SLASH – playing swing sound instead.`;
      console.warn(msg);
      const errorDiv = FIND("error_message");
      if (errorDiv) {
        errorDiv.innerHTML = msg;
        errorDiv.style.color = "orange";
        if (window.errorMessageTimeout) {
          clearTimeout(window.errorMessageTimeout);
        }
        const lastMsg = msg;
        window.errorMessageTimeout = setTimeout(() => {
          if (errorDiv.innerHTML === lastMsg) {
            errorDiv.innerHTML = "";
          }
          window.errorMessageTimeout = null;
        }, 3000);
      }
      playRandomEffect("swing");
      return;
    }

    // For other missing sounds, warn as usual
    const effectStr = effectName.toUpperCase();
    const effectKey = Object.keys(window)
      .find(k => window[k] === effectName || k.replace(/^EFFECT_/, '').toLowerCase() === effectName.toLowerCase());
    const effectId  = effectKey ? ` (${effectKey})` : "";
    const msg = `[Warning] No sound available for effect: "${effectName}"${effectId}.`;
    console.error(msg);

    // Show in the error_message area as well (with timeout reset)
    const errorDiv = FIND("error_message");
    if (errorDiv) {
      errorDiv.innerHTML = msg;
      errorDiv.style.color = "orange";
      if (window.errorMessageTimeout) {
        clearTimeout(window.errorMessageTimeout);
      }
      const lastMsg = msg;
      window.errorMessageTimeout = setTimeout(() => {
        if (errorDiv.innerHTML === lastMsg) {
          errorDiv.innerHTML = "";
        }
        window.errorMessageTimeout = null;
      }, 3000);
    }
    return;
  }

  const last = lastPlayedSoundIndex[effectName];
  const idx  = noRepeatRandom(arr.length, last);
  lastPlayedSoundIndex[effectName] = idx;

  const fname = fontSoundFilenames?.[effectName]?.[idx] || '(unknown)';
  console.log(
    `▶ [Fallback] playing: ${fname} - duration=${fontSoundDurations[effectName]?.[idx]} ms`
  );

  const fileOrUrl = arr[idx];
  if (fileOrUrl instanceof File) {
    console.log(`** Playing file: ${fileOrUrl.name}`);
    const audio = new Audio(URL.createObjectURL(fileOrUrl));
    audio.volume = globalVolume;
    audio.play();
    // Track and clean up
    activeOneShots.push({audio});
    audio.onended = () => {
      activeOneShots = activeOneShots.filter(e => e.audio !== audio);
    };
  } else if (typeof fileOrUrl === "string") {
    const name = fileOrUrl.split('/').pop().split('?')[0].split('#')[0];
    console.log(`** Playing URL: ${name}`);
    const audio = new Audio(fileOrUrl);
    audio.volume = globalVolume;
    audio.play();
  }
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

function stopAllLoops(fadeTime = 200) {
  // first stop any lockup
  endLockupLoop(false);

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

  const bufs = fontSoundBuffers[bufferKey] || [];
  if (!bufs.length) return;

  const idx = Math.floor(Math.random()*bufs.length);
  lastPlayedSoundIndex[bufferKey] = idx;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = initialGain;
  gainNode.connect(audioCtx.destination);

  const src = audioCtx.createBufferSource();
  src.buffer = bufs[idx];
  src.loop   = shouldLoop;
  src.connect(gainNode);
  src.start();

  window[loopRefName] = { src, gainNode };
}

function ToggleHum() {
  if (!soundOn) {
    stopAllLoops();
    return;
  }
  if (!fontSoundBuffers['hum']?.length) return;

  if (STATE_ON) {
    startAudioLoop('hum',    'humAudio',    globalVolume, true);
    startAudioLoop('swingl', 'smoothLoopL', 0,           true);
    startAudioLoop('swingh', 'smoothLoopH', 0,           true);
  } else {
    stopAllLoops();
  }
}

let lockupGainNode = null, lockupLoopSrc = null, lockupEndBuffer = null;

function startLockupLoop(lockupType, skipBegin = false) {
  window.currentLockupType = lockupType;
  if (!soundOn) return;
  const m = {
    [EFFECT_LOCKUP_BEGIN]: {b:'bgnlock', l:'lock', e:'endlock'},
    [EFFECT_DRAG_BEGIN]:   {b:'bgndrag', l:'drag', e:'enddrag'},
    [EFFECT_MELT_BEGIN]:   {b:'bgnmelt', l:'melt', e:'endmelt'},
    [EFFECT_LB_BEGIN]:     {b:'bgnlb',   l:'lb',   e:'endlb'},
  }[lockupType];
  if (!m) return;

  const B = fontSoundBuffers[m.b]||[], L = fontSoundBuffers[m.l]||[];
  if (!B.length||!L.length) return;
  lockupEndBuffer = (fontSoundBuffers[m.e]||[])[0]||null;

  lockupGainNode = audioCtx.createGain();
  lockupGainNode.gain.value = globalVolume;
  lockupGainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (!skipBegin) {
    const bsrc = audioCtx.createBufferSource();
    bsrc.buffer = B[Math.floor(Math.random()*B.length)];
    bsrc.connect(lockupGainNode);
    bsrc.start(now);

    lockupLoopSrc = audioCtx.createBufferSource();
    lockupLoopSrc.buffer = L[Math.floor(Math.random()*L.length)];
    lockupLoopSrc.loop = true;
    lockupLoopSrc.connect(lockupGainNode);
    lockupLoopSrc.start(now + bsrc.buffer.duration);
  } else {
    lockupLoopSrc = audioCtx.createBufferSource();
    lockupLoopSrc.buffer = L[Math.floor(Math.random()*L.length)];
    lockupLoopSrc.loop = true;
    lockupLoopSrc.connect(lockupGainNode);
    lockupLoopSrc.start(now);
  }

  window.lockupLoopSrc  = lockupLoopSrc;
  window.lockupGainNode = lockupGainNode;
}

function endLockupLoop(effectType, endEffectName) {
  // Stop the looping
  if (window.lockupLoopSrc) {
    try {
      window.lockupLoopSrc.stop();
      window.lockupLoopSrc.disconnect();
    } catch(_) {}
    window.lockupLoopSrc = null;
  }

  // Play endlock if exists
  if (endEffectName) {
    const buffers = fontSoundBuffers[endEffectName] || [];
    if (buffers.length) {
      const idx = Math.floor(Math.random() * buffers.length);
      const buf = buffers[idx];

      // create a fresh gain for this one-shot
      const g = audioCtx.createGain();
      g.gain.value = globalVolume;
      g.connect(audioCtx.destination);

      const s = audioCtx.createBufferSource();
      s.buffer = buf;
      s.connect(g);
      s.start();

      // when it’s done, clean up that gain
      s.onended = () => {
        try { g.disconnect(); } catch(_) {}
      };
    }
  }

  // Now drop the old lockup gain node itself
  if (window.lockupGainNode) {
    try { window.lockupGainNode.disconnect(); } catch(_) {}
    window.lockupGainNode = null;
  }

  // Clear the type so resumeLoops() won’t auto-replay it
  // Only clear if this was a real user action (lockup ended)
  if (effectType && effectType !== false) {
    // e.g. called from AddEffect for END event
    window.currentLockupType = null;
  }
}


function resumeLoops() {
  if (STATE_ON) ToggleHum();
  if (window.currentLockupType && !window.lockupLoopSrc)
    startLockupLoop(window.currentLockupType, true);
}
window.addEventListener('focus', () => { if (soundOn) resumeLoops(); });
