// Default font data loaded from GitHub
const defaultFontSoundBuffers   = {};
const defaultFontSoundDurations = {};
const defaultFontSoundFilenames = {};

// Custom font data, user-loaded
const customFontSoundBuffers    = {};
const customFontSoundDurations  = {};
const customFontSoundFilenames  = {};

const DEFAULT_FONT_NAME         = "Default";
const DEFAULT_FONT_LABEL        = "Liquid Static";
const DEMO_FONT_MANIFEST_PATH   = "demo_fonts.json";
const SAFE_DEMO_FONT_KEY        = /^[A-Za-z0-9_-]+$/;
const SAFE_DEMO_FONT_PATH       = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*:\/\/)(?!.*[?#])[A-Za-z0-9._/-]+$/;

// State tracking
let currentFontName             = DEFAULT_FONT_NAME;
const lastPlayedSoundIndex      = {};

// Audio setup
const audioCtx                  = new (window.AudioContext || window.webkitAudioContext)();
const masterGain                = audioCtx.createGain();
const volumeSlider              = FIND('VOLUME_SLIDER');
const volumeValue               = FIND('VOLUME_VALUE');
const fontMetaButton            = FIND('font_meta_button');
const fontMetaLogo              = FIND('font_meta_logo');
const fontMetaInfo              = FIND('font_meta_info');
const fontMetaOverlay           = FIND('font_meta_overlay');
const fontMetaPopupLogo         = FIND('font_meta_popup_logo');
const fontMetaPopupReadme       = FIND('font_meta_popup_readme');
const fontMetaPopupClose        = FIND('font_meta_popup_close');
let globalVolume                = volumeSlider.value / 100;
masterGain.gain.value           = globalVolume;
masterGain.connect(audioCtx.destination);

let activeFontMetadata = {
  logoUrl: '',
  readmeText: '',
  fontName: DEFAULT_FONT_LABEL,
  logoObjectUrl: false,
};
let defaultFontMetadata = { logoUrl: '', readmeText: '', logoObjectUrl: false };
let currentFontLoadToken = 0;
let pendingFontAnnouncement = null;
let currentMetadataObjectUrl = null;

const CREATOR_LOGO_REGISTRY = [
  { names: ['kyberphonic'], domains: ['kyberphonic'], logoUrl: 'https://kyberphonic.bigcartel.com/favicon.ico' },
  { names: ['ksith', 'k-sith'], domains: ['ksith'], logoUrl: 'https://www.ksithsaberfonts.com/favicon.ico' },
  { names: ['jaydalorian'], domains: ['jaydalorian'], logoUrl: 'https://jaydalorian.com/favicon.ico' },
  { names: ['bk sabers', 'bksabers'], domains: ['bksabers'], logoUrl: 'https://www.bksabersounds.com/favicon.ico' },
  { names: ['mountain sabers', 'mountainsabers'], domains: ['mountainsabers'], logoUrl: 'https://www.mountainsabersfonts.com/favicon.ico' },
];

// Lockup/loop sources
let lockupGainNode              = null;
let lockupLoopSrc               = null;
let currentLockupType = null;
/* The SaberBase::LOCKUP_* whose sounds are playing. LOCKUP_ARMED shares its
effects with a normal lockup, so this is what tells them apart once the dropdown
has cleared STATE_LOCKUP. */
let activeLockup = null;
let errorMessageTimeout = null;
// Thermal Detonator sounds are monophonic, so they mask the hum while playing.
let humMasked                   = false;
let humMaskTimeout              = null;

// All sound folder/filename bases that ProffieOS recognises as valid effects.
const VALID_EFFECTS = new Set([
  'battlevl', 'bladein', 'bladeout', 'blast', 'blst', 'blstbgn', 'blstend',
  'bmbegin', 'bmend', 'boom', 'boot',
  'ccchange', 'clipin', 'clipout', 'clsh',
  'destruct', 'dim',
  'empty',
  'fastout', 'font', 'force', 'full',
  'in',
  'jam',
  'mode',
  'out',
  'plion', 'plioff', 'poweron', 'poweroff', 'preon', 'pstoff',
  'quote',
  'range', 'reload',
  'slsh', 'spin', 'stab', 'stun', 'swng', 'swingl', 'swingh',
  'tr', 'trloop',
  'unjam',
  'volup',
  // looping mid-sounds
  'hum', 'lock', 'drag', 'melt', 'lb',
  'bmlock', 'bgnlock', 'endlock',
  'bgndrag', 'enddrag',
  'bgnmelt', 'endmelt',
  'bgnlb', 'endlb',
  'auto', 'bgnauto', 'endauto',
  'bgnarm', 'armhum', 'endarm',
]);

function clearCustomFontData() {
  Object.keys(customFontSoundBuffers).forEach(effect => {
    delete customFontSoundBuffers[effect];
    delete customFontSoundDurations[effect];
    delete customFontSoundFilenames[effect];
  });
}

function setDefaultFontSelection() {
  currentFontName = DEFAULT_FONT_NAME;
  FIND('choose_local_font_label').textContent = DEFAULT_FONT_LABEL;
}

function setCustomFontSelection(fontName) {
  currentFontName = fontName;
  FIND('choose_local_font_label').textContent = fontName;
}

function clearFontLoadMessage() {
  const err = FIND("error_message");
  clearTimeout(errorMessageTimeout);
  errorMessageTimeout = null;
  if (!err) return;
  err.textContent = "";
  err.style.color = "";
}

function showFontLoadMessage(message, color = "orange") {
  const err = FIND("error_message");
  clearTimeout(errorMessageTimeout);
  errorMessageTimeout = null;
  if (!err) return;
  err.textContent = message;
  err.style.color = color;
}

function extractEffectFromSoundUrl(url) {
  const filename = new URL(url, window.location.href).pathname.split('/').pop();
  const m = filename && filename.match(/([a-z]+)[0-9]*\.wav$/i);
  return m ? m[1].toLowerCase() : null;
}

function normalizeReadmeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\.txt$/i, '')
    .replace(/[\s_-]+/g, '');
}

function isReadmeFilename(name) {
  return /\.txt$/i.test(name || '') && normalizeReadmeName(name).startsWith('readme');
}

function safeTrimText(text) {
  return (text || '').replace(/\r\n/g, '\n').trim();
}

function extractDomainsFromReadme(readmeText) {
  const text = readmeText || '';
  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  return matches.map(url => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }).filter(Boolean);
}

function creatorFallbackLogoFromReadme(readmeText) {
  if (!readmeText) return '';
  const readmeLower = readmeText.toLowerCase();
  const domains = extractDomainsFromReadme(readmeText);

  for (const entry of CREATOR_LOGO_REGISTRY) {
    if (domains.some(domain => entry.domains.some(known => domain.includes(known)))) {
      return entry.logoUrl;
    }
  }
  for (const entry of CREATOR_LOGO_REGISTRY) {
    if (entry.names.some(name => readmeLower.includes(name))) {
      return entry.logoUrl;
    }
  }
  return '';
}

function sanitizeLogoUrl(urlValue) {
  if (!urlValue) return '';
  try {
    const url = new URL(urlValue, window.location.href);
    if (url.protocol === 'blob:') return url.href;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function clearCurrentMetadataObjectUrl() {
  if (!currentMetadataObjectUrl) return;
  URL.revokeObjectURL(currentMetadataObjectUrl);
  currentMetadataObjectUrl = null;
}

function hideFontMetadataPopup() {
  if (!fontMetaOverlay) return;
  fontMetaOverlay.style.display = 'none';
}

function showFontMetadataPopup() {
  const safeLogoUrl = sanitizeLogoUrl(activeFontMetadata.logoUrl);
  const hasLogo = !!safeLogoUrl;
  const hasReadme = !!activeFontMetadata.readmeText;
  if (!hasLogo && !hasReadme) return;
  if (fontMetaPopupLogo) {
    if (hasLogo) {
      fontMetaPopupLogo.src = safeLogoUrl;
      fontMetaPopupLogo.style.display = 'block';
    } else {
      fontMetaPopupLogo.removeAttribute('src');
      fontMetaPopupLogo.style.display = 'none';
    }
  }
  if (fontMetaPopupReadme) {
    fontMetaPopupReadme.textContent = hasReadme
      ? activeFontMetadata.readmeText
      : `No README found for ${activeFontMetadata.fontName}.`;
  }
  if (fontMetaOverlay) {
    fontMetaOverlay.style.display = 'flex';
  }
}

function updateFontMetadataUi(metadata, showPopup = false) {
  const safeLogoUrl = sanitizeLogoUrl(metadata.logoUrl || '');
  if (metadata.logoObjectUrl) {
    clearCurrentMetadataObjectUrl();
    currentMetadataObjectUrl = safeLogoUrl || null;
  } else if (currentMetadataObjectUrl && currentMetadataObjectUrl !== safeLogoUrl) {
    clearCurrentMetadataObjectUrl();
  }

  activeFontMetadata = {
    logoUrl: safeLogoUrl,
    readmeText: metadata.readmeText || '',
    fontName: metadata.fontName || DEFAULT_FONT_LABEL,
    logoObjectUrl: !!metadata.logoObjectUrl,
  };

  const hasLogo = !!activeFontMetadata.logoUrl;
  const hasReadme = !!activeFontMetadata.readmeText;
  if (!fontMetaButton || !fontMetaLogo || !fontMetaInfo) return;

  if (!hasLogo && !hasReadme) {
    fontMetaButton.style.display = 'none';
    fontMetaButton.title = '';
    fontMetaLogo.removeAttribute('src');
    fontMetaLogo.style.display = 'none';
    fontMetaInfo.style.display = 'none';
    hideFontMetadataPopup();
    return;
  }

  fontMetaButton.title = hasReadme ? activeFontMetadata.readmeText : `Font info for ${activeFontMetadata.fontName}`;
  if (hasLogo) {
    fontMetaLogo.src = safeLogoUrl;
    fontMetaButton.style.display = 'inline-block';
    fontMetaLogo.style.display = 'block';
    fontMetaInfo.style.display = 'none';
    fontMetaLogo.onerror = () => {
      fontMetaLogo.style.display = 'none';
      fontMetaInfo.style.display = 'inline-flex';
    };
    fontMetaLogo.onload = () => {
      fontMetaLogo.style.display = 'block';
      fontMetaInfo.style.display = 'none';
    };
  } else {
    fontMetaLogo.removeAttribute('src');
    fontMetaLogo.style.display = 'none';
    fontMetaButton.style.display = 'inline-block';
    fontMetaInfo.style.display = 'inline-flex';
  }

  if (showPopup) showFontMetadataPopup();
}

function nextFontLoadToken() {
  currentFontLoadToken += 1;
  return currentFontLoadToken;
}

function selectAnnouncementBuffersForLoad(isDefaultLoad) {
  if (isDefaultLoad) {
    return {
      buffers: defaultFontSoundBuffers.font || [],
      filenames: defaultFontSoundFilenames.font || [],
      durations: defaultFontSoundDurations.font || [],
      fontLabel: "Default Font",
    };
  }
  return {
    buffers: customFontSoundBuffers.font || [],
    filenames: customFontSoundFilenames.font || [],
    durations: customFontSoundDurations.font || [],
    fontLabel: currentFontName,
  };
}

function playFontLoadAnnouncement(token, isDefaultLoad) {
  if (!playFontLoadState.get() || !soundOnState.get()) return;
  if (token !== currentFontLoadToken) return;

  const { buffers, filenames, durations, fontLabel } = selectAnnouncementBuffersForLoad(isDefaultLoad);
  if (!buffers.length) return;

  if (audioCtx.state === 'suspended') {
    pendingFontAnnouncement = { token, isDefaultLoad };
    return;
  }

  pendingFontAnnouncement = null;
  const idx = noRepeatRandom(buffers.length, lastPlayedSoundIndex.font);
  lastPlayedSoundIndex.font = idx;
  const filename = filenames[idx] || 'font.wav';
  const duration = durations[idx] || 0;
  console.log(`▶ ${fontLabel}: ** ${soundOnState.get() ? 'Playing' : 'Muted'} ${filename} – ${duration}ms`);

  const src = audioCtx.createBufferSource();
  src.buffer = buffers[idx];
  src.connect(masterGain);
  src.start();
}

async function flushPendingFontAnnouncement() {
  if (!pendingFontAnnouncement) return;
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (err) {
      return;
    }
  }
  if (!pendingFontAnnouncement) return;
  const { token, isDefaultLoad } = pendingFontAnnouncement;
  playFontLoadAnnouncement(token, isDefaultLoad);
}

async function loadFontUrlList(urlListPath, targetBuffers, targetDurations, targetFilenames) {
  const listUrl = new URL(urlListPath, window.location.href);
  const response = await fetch(listUrl);
  if (!response.ok) {
    throw new Error(`Could not load ${urlListPath}.`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  let loadedCount = 0;
  const failures = [];
  let logoUrl = '';
  let readmeUrl = '';

  await Promise.all(lines.map(async line => {
    const resolvedUrl = new URL(line, listUrl).href;
    const pathname = new URL(resolvedUrl, window.location.href).pathname;
    const filename = pathname.split('/').pop() || '';
    if (!logoUrl && /\.(jpe?g)$/i.test(filename)) {
      logoUrl = resolvedUrl;
    }
    if (!readmeUrl && isReadmeFilename(filename)) {
      readmeUrl = resolvedUrl;
    }

    const effect = extractEffectFromSoundUrl(resolvedUrl);
    if (!effect || !VALID_EFFECTS.has(effect)) return;

    try {
      const wavResponse = await fetch(resolvedUrl);
      if (!wavResponse.ok) {
        throw new Error(`HTTP ${wavResponse.status}`);
      }
      const data = await wavResponse.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(data);

      targetBuffers  [effect] ||= [];
      targetDurations[effect] ||= [];
      targetFilenames[effect] ||= [];

      const displayName = new URL(resolvedUrl).pathname.split('/').pop();
      targetFilenames[effect].push(displayName);
      targetBuffers[effect].push(buffer);
      targetDurations[effect].push(Math.round(buffer.duration * 1000));
      loadedCount += 1;
    } catch (err) {
      failures.push(`${resolvedUrl}: ${err.message}`);
      console.error(`Error loading ${resolvedUrl}:`, err);
    }
  }));

  let readmeText = '';
  if (readmeUrl) {
    try {
      const readmeResponse = await fetch(readmeUrl);
      if (readmeResponse.ok) {
        readmeText = safeTrimText(await readmeResponse.text());
      }
    } catch (err) {
      console.error(`Error loading README ${readmeUrl}:`, err);
    }
  }

  if (!logoUrl) {
    logoUrl = creatorFallbackLogoFromReadme(readmeText);
  }

  return { loadedCount, failures, metadata: { logoUrl, readmeText, logoObjectUrl: false } };
}

function readDemoFontPresets(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error("demo_fonts.json must contain an object.");
  }
  if ('presets' in manifest) {
    if (!manifest.presets || typeof manifest.presets !== 'object' || Array.isArray(manifest.presets)) {
      throw new Error("demo_fonts.json presets must be an object.");
    }
    return manifest.presets;
  }
  return manifest;
}

function resolveDemoFontPath(pathValue, fieldName) {
  if (typeof pathValue !== 'string' || !SAFE_DEMO_FONT_PATH.test(pathValue)) {
    throw new Error(`Preset ${fieldName} must be a safe repo-local path.`);
  }
  return new URL(pathValue, new URL('./', window.location.href)).href;
}

async function loadJsonObject(pathValue, description) {
  const response = await fetch(pathValue);
  if (!response.ok) {
    throw new Error(`Could not load ${description}.`);
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (trimmed.startsWith('<') || (contentType && !contentType.includes('json'))) {
    throw new Error(`${description} was not served as JSON.`);
  }

  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${description} must contain an object.`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`${description} is not valid JSON.`);
  }
}

async function loadDemoFontPresetFromQuery() {
  const params = new URL(window.location.href).searchParams;
  const presetKey = params.get("font");
  if (!presetKey) return false;

  clearFontLoadMessage();

  if (!SAFE_DEMO_FONT_KEY.test(presetKey)) {
    showFontLoadMessage(`Demo font preset "${presetKey}" is not valid. Using ${DEFAULT_FONT_LABEL}.`);
    return false;
  }
  const fontLoadToken = nextFontLoadToken();

  showLoadingOverlay(`Loading demo font "${presetKey}"…`);

  try {
    const manifest = await loadJsonObject(DEMO_FONT_MANIFEST_PATH, "demo font manifest");
    const presetMap = readDemoFontPresets(manifest);
    const preset = presetMap[presetKey];
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
      throw new Error(`Unknown demo font preset "${presetKey}".`);
    }

    const presetName = typeof preset.name === 'string' ? preset.name.trim() : "";
    if (!presetName) {
      throw new Error(`Preset "${presetKey}" is missing a display name.`);
    }

    const listPath = resolveDemoFontPath(preset.font_urls, "font_urls");
    const styleOverride = params.get("S");
    let presetStyleText = null;

    if (!styleOverride) {
      const stylePath = resolveDemoFontPath(preset.style, "style");
      const styleResponse = await fetch(stylePath);
      if (!styleResponse.ok) {
        throw new Error(`Could not load default style for "${presetName}".`);
      }
      presetStyleText = normalizeIncomingStyleText(await styleResponse.text());
      if (!presetStyleText) {
        throw new Error(`Default style for "${presetName}" is empty.`);
      }
    }

    clearCustomFontData();
    const { loadedCount, failures, metadata } = await loadFontUrlList(
      listPath,
      customFontSoundBuffers,
      customFontSoundDurations,
      customFontSoundFilenames
    );

    if (loadedCount === 0) {
      throw new Error(`No playable WAV files were loaded for "${presetName}".`);
    }
    if (fontLoadToken !== currentFontLoadToken) {
      return false;
    }

    setCustomFontSelection(presetName);

    if (!styleOverride && presetStyleText) {
      ApplyStyleText(presetStyleText);
    }

    updateLockupDropdown();
    handleDestructControls();
    if (fontLoadToken === currentFontLoadToken) {
      updateFontMetadataUi({ ...metadata, fontName: presetName }, true);
      playFontLoadAnnouncement(fontLoadToken, false);
    }

    if (failures.length > 0) {
      showFontLoadMessage(`Loaded demo font "${presetName}" with ${failures.length} unavailable sound file(s).`, "orange");
    }

    return true;
  } catch (err) {
    if (fontLoadToken !== currentFontLoadToken) {
      return false;
    }
    clearCustomFontData();
    setDefaultFontSelection();
    updateLockupDropdown();
    handleDestructControls();
    if (fontLoadToken === currentFontLoadToken) {
      updateFontMetadataUi({ ...defaultFontMetadata, fontName: DEFAULT_FONT_LABEL }, false);
    }
    showFontLoadMessage(`Could not load demo font "${presetKey}". Using ${DEFAULT_FONT_LABEL}. ${err.message}`, "orange");
    console.error(`Could not load demo font "${presetKey}":`, err);
    return false;
  } finally {
    hideLoadingOverlay();
  }
}

async function loadDefaultFontAssets() {
  const fontLoadToken = nextFontLoadToken();
  try {
    const result = await loadFontUrlList(
      'demo_fonts/default_font_urls.txt',
      defaultFontSoundBuffers,
      defaultFontSoundDurations,
      defaultFontSoundFilenames
    );
    defaultFontMetadata = result.metadata;
    if (fontLoadToken !== currentFontLoadToken || currentFontName !== DEFAULT_FONT_NAME) return;
    updateFontMetadataUi({ ...result.metadata, fontName: DEFAULT_FONT_LABEL }, true);
    playFontLoadAnnouncement(fontLoadToken, true);
  } catch (err) {
    console.error("Could not load default_font_urls.txt:", err);
  }
}

loadDefaultFontAssets();

const chooseLocalFontBtn = FIND('choose_local_font');
const fileInput          = FIND('files');

chooseLocalFontBtn.addEventListener('click', () => {
  fileInput.value = "";
  fileInput.click();
});

if (fontMetaButton) {
  fontMetaButton.addEventListener('click', showFontMetadataPopup);
}
if (fontMetaPopupClose) {
  fontMetaPopupClose.addEventListener('click', hideFontMetadataPopup);
}
if (fontMetaOverlay) {
  fontMetaOverlay.addEventListener('click', (e) => {
    if (e.target === fontMetaOverlay) hideFontMetadataPopup();
  });
}

document.addEventListener('pointerdown', flushPendingFontAnnouncement, { passive: true });
document.addEventListener('keydown', flushPendingFontAnnouncement, { passive: true });

// Load custom font
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;           // user cancelled

  const fontLoadToken = nextFontLoadToken();
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (err) {
      // Autoplay policies can still block; announcement stays deferred.
    }
  }
  clearFontLoadMessage();
  showLoadingOverlay();

  // Determine folder / font name
  const folderName = files[0].webkitRelativePath
    ? files[0].webkitRelativePath.split('/')[0]
    : files[0].name;
  setCustomFontSelection(folderName);

  // Clear out any old custom data
  clearCustomFontData();

   if (fontLoadToken === currentFontLoadToken) {
    updateFontMetadataUi({ logoUrl: '', readmeText: '', fontName: folderName, logoObjectUrl: false }, false);
  }

  let firstLogoFile = null;
  let readmeFile = null;
  for (const file of files) {
    if (!firstLogoFile && /\.(jpe?g)$/i.test(file.name)) {
      firstLogoFile = file;
    }
    if (!readmeFile && isReadmeFilename(file.name)) {
      readmeFile = file;
    }
    if (firstLogoFile && readmeFile) break;
  }

  let readmeText = '';
  if (readmeFile) {
    try {
      readmeText = safeTrimText(await readmeFile.text());
    } catch (err) {
      console.error(`Error reading README file ${readmeFile.name}:`, err);
    }
  }

  let logoUrl = '';
  let logoObjectUrl = false;
  if (firstLogoFile) {
    logoUrl = URL.createObjectURL(firstLogoFile);
    logoObjectUrl = true;
  } else {
    logoUrl = creatorFallbackLogoFromReadme(readmeText);
  }

  // Build an array of Promises—one per file—to decode & stash buffers
  // Also account for sub-sub sounds
  const loadPromises = files.map(file => {
    const relPath = file.webkitRelativePath || file.name;

    // Only process WAVs
    if (!/\.wav$/i.test(file.name)) return Promise.resolve();

    // // Prefer effect name from the filename (e.g., clsh01.wav); if missing,
    // // fall back to the top-level effect folder (e.g., clsh/01/000.wav → "clsh").
    // const nameMatch = file.name.match(/^([a-z]+)[0-9]*\.wav$/i);
    // let effect = nameMatch ? nameMatch[1].toLowerCase() : null;

    // if (!effect && relPath.includes('/')) {
    //   const parts = relPath.split('/');          // [font, effectDir, maybe subdir, filename]
    //   const effectDir = parts[1] || '';
    //   effect = effectDir.replace(/[^a-z]/gi, '').toLowerCase();  // "clsh." → "clsh"
    // }

    // // Still unknown? Skip.
    // if (!effect) return Promise.resolve();

    // Determine effect from path:
    //   - Root-level file (font/clsh01.wav): derive from filename base
    //   - Any subfolder (font/clsh/..., font/swng/01/000.wav): depth-1 folder decides
    // Files inside non-effect folders (e.g., font/Extras/...) are rejected.
    const parts = relPath.split('/');
    let effect = null;
    const nameMatch = file.name.match(/^([a-z]+)[0-9]*\.wav$/i);
    const effectFromName = nameMatch ? nameMatch[1].toLowerCase() : null;

    if (parts.length === 2) {
      // Root-level: use filename base (e.g., clsh01.wav → "clsh")
      effect = effectFromName;
    } else {
      // Any subfolder depth: only the depth-1 folder name matters
      effect = (parts[1] || '').replace(/[^a-z]/gi, '').toLowerCase();
      if ((!effect || !VALID_EFFECTS.has(effect)) && effectFromName) {
        effect = effectFromName;
      }
    }

    // Reject if not a recognised ProffieOS effect
    if (!effect || !VALID_EFFECTS.has(effect)) return Promise.resolve();

    customFontSoundBuffers  [effect] ||= [];
    customFontSoundDurations[effect] ||= [];
    customFontSoundFilenames[effect] ||= [];

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        audioCtx.decodeAudioData(reader.result)
          .then(buffer => {
            const idx = customFontSoundFilenames[effect].length;

            // Store a nicer display name that includes subdirs (e.g., "clsh/01/000.wav")
            const displayName = relPath.split('/').slice(1).join('/');

            customFontSoundFilenames[effect][idx] = displayName;
            customFontSoundBuffers[effect][idx]   = buffer;
            const dur = Math.round(buffer.duration * 1000);
            customFontSoundDurations[effect][idx] = dur;

            console.log(`Custom font: ${folderName} ${displayName} – ${dur} ms`);
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
  try {
    await Promise.all(loadPromises);
    hideLoadingOverlay();
    if (fontLoadToken !== currentFontLoadToken) {
      if (logoObjectUrl && logoUrl) URL.revokeObjectURL(logoUrl);
      return;
    }
    /* Which lockups the dropdown offers can depend on the font, so a
    Thermal Detonator font adds "Arm" as soon as it has loaded. */
    updateLockupDropdown();
    // Whether the countdown time is used depends on the font too.
    handleDestructControls();
    updateFontMetadataUi({ logoUrl, readmeText, fontName: folderName, logoObjectUrl }, true);
    playFontLoadAnnouncement(fontLoadToken, false);
  } catch (err) {
    console.error("Error loading custom font files:", err);
    hideLoadingOverlay();
    if (logoObjectUrl && logoUrl) URL.revokeObjectURL(logoUrl);
  }
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

// Accent‐swing vs slash
function triggerAccentEvent(speed) {
  if (!STATE_ON) return;
  // Only the swing check is scaled for fullscreen; slash accel is constant
  const dynSwingThreshold = document.fullscreenElement
    ? swingThreshold * 0.7
    : swingThreshold;

  // Compute accel
  const accel = performance.now() > lastAccelTime
    ? (speed - lastAccelSpeed) / ((performance.now() - lastAccelTime) / 1000)
    : 0;

  lastAccelTime  = performance.now();
  lastAccelSpeed = speed;

  // console.log(`[triggerAccentEvent] speed=${speed.toFixed(1)}, accel=${accel.toFixed(1)}, swingThr=${dynSwingThreshold}, slashAccelThr=${slashThreshold}`);

  if (speed > dynSwingThreshold) {
    if (!swingTriggered) {
      // High‐accel, do slash, else swing
      if (accel > slashThreshold) {
        blade.addEffect(EFFECT_ACCENT_SLASH, 0);
      } else {
        blade.addEffect(EFFECT_ACCENT_SWING, 0);
      }
      swingTriggered = true;
    }
  } else if (speed <= swingLowerThreshold) {
    // Only reset once we slow down past the lower threshold:
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
    let speed;
    // Stall detection
    if (performance.now() - lastSwingUpdate > STALL_TIMEOUT) {
      staleLogged = true;
      speed = 0;
    } else {
      staleLogged = false;
      speed = lastSwingSpeed;
    }
    // Debounce - decide next state
    let next = lastState;
    if (speed <= STOP_THRESHOLD) {
      if (belowSince === null) {
        belowSince = performance.now();
      } else if (performance.now() - belowSince >= STOP_DEBOUNCE) {
        next = 'stopped';
      }
    } else {
      belowSince = null;
      if (speed >= START_THRESHOLD) next = 'running';
    }

    // On state change, start or stop loops
    if (next !== lastState) {
      if (next === 'stopped') {
        // console.log(`[SmoothSwing] STOPPED (speed ${speed.toFixed(1)} ≤ ${STOP_THRESHOLD})`);
        fadeAndStop('smoothLoopL', 100);
        fadeAndStop('smoothLoopH', 100);
      } else if (soundOnState.get()) {
        // console.log(`[SmoothSwing] RUNNING (speed ${speed.toFixed(1)} ≥ ${START_THRESHOLD})`);
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
    if (STATE_ON && outerMostBracket) requestAnimationFrame(frame);
  }

  return frame;
})();

volumeSlider.addEventListener('input', function() {
  volumeValue.textContent = this.value;
  globalVolume = Number(this.value) / 100;
  masterGain.gain.value = globalVolume;
});

function showLoadingOverlay(message = 'Loading, please stand by…') {
  let loadingOverlay = FIND('loading_overlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading_overlay';
    loadingOverlay.className = 'loading-overlay';
    document.body.appendChild(loadingOverlay);
  }
  loadingOverlay.innerText = message;
}

function hideLoadingOverlay() {
  const loadingOverlay = FIND('loading_overlay');
  if (loadingOverlay) document.body.removeChild(loadingOverlay);
  if (lockupLoopSrc) {
    endLockupLoop(currentLockupType, null, false);
  }
  resumeLoops();
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
  if (currentFontName === "Default" || fontFallbackState.get()) {
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
  const effectName = soundKeyForEffect(effectType);
  if (!effectName) return;
  playRandomEffect(effectName, true);
}

function playRandomEffect(effectName, isAllowed = true) {
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const customBufs  = customFontSoundBuffers[effectName]  || [];

  // Default fallback only when allowed
  const defaultBufs = (currentFontName === "Default" || fontFallbackState.get())
    ? (defaultFontSoundBuffers[effectName] || [])
    : [];

  const total = customBufs.length + defaultBufs.length;

  // No sound file exists, show orange message
  if (total === 0) {
    const key = effectConstantForSound(effectName);
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

  console.log(`▶ ${fontLabel}: ** ${soundOnState.get() ? 'Playing' : 'Muted'} ${fname} – ${dur}ms`);
  if (!soundOnState.get()) return;

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(masterGain);
  src.start();
}

// Reverse-map a sound key back to its EFFECT_* constant name, e.g. "blast" → "EFFECT_FIRE"
function effectConstantForSound(effectName) {
  for (const [type, name] of Object.entries(EFFECT_SOUND_MAP)) {
    if (name === effectName) return EFFECT_ENUM_BUILDER.value_to_name[type];
  }
  for (const [type, names] of Object.entries(EFFECT_SOUND_ALIASES)) {
    if (names.includes(effectName)) return EFFECT_ENUM_BUILDER.value_to_name[type];
  }
  return null;
}

/* Duration in ms of the sound last played for a key, using the same
custom/default font precedence as pickLoopBuffers(). */
function soundDurationFor(effectName, fallback = 0) {
  if (!effectName) return fallback;

  const custom = customFontSoundDurations[effectName] || [];
  let durations = [];
  if (custom.length > 0 && currentFontName !== "Default") {
    durations = custom;
  } else if (currentFontName === "Default" || fontFallbackState.get()) {
    durations = defaultFontSoundDurations[effectName] || [];
  }

  const rawIdx = lastPlayedSoundIndex[effectName];
  const idx = (typeof rawIdx === 'number' && rawIdx >= 0 && rawIdx < durations.length) ? rawIdx : 0;
  const duration = durations[idx];
  return (typeof duration === 'number' && duration > 0) ? duration : fallback;
}

function showNoSoundMsg(effectName, idText = "") {
  const msg = `No sound available for effect: "${effectName}"${idText}.`;
  console.log(msg);
  const err = FIND("error_message");
  if (err) {
    err.innerHTML = msg;
    err.style.color = "orange";
    clearTimeout(errorMessageTimeout);
    errorMessageTimeout = setTimeout(() => {
      if (err.innerHTML === msg) err.innerHTML = "";
    }, 3000);
  }
}

function stopLoop(refName) {
  const ref = window[refName];
  if (!ref) return;
  ref.src.stop();
  ref.src.disconnect();
  ref.gainNode.disconnect();
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
  endLockupLoop(undefined, undefined, clearLockup);  // Power off: clear lockup state
  if (clearLockup) clearHumMask();  // TD
  ['humAudio','smoothLoopL','smoothLoopH'].forEach(ref => {
  if (window[ref]) fadeAndStop(ref, fadeTime);
});

  console.log("All audio loops stopped (with fade)");
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
  if (!soundOnState.get()) return;
  // A monophonic Thermal Detonator sound is playing in place of the hum.
  if (humMasked) return;
  startAudioLoop('hum', 'humAudio', 1, true);
}

/* Thermal Detonator sounds are monophonic on the real prop: bgnarm, armhum,
endarm, destruct and boom play instead of the hum, not on top of it.
Smoothswings are left alone and keep playing over them. */
function maskHum() {
  humMasked = true;
  clearTimeout(humMaskTimeout);
  humMaskTimeout = null;
  fadeAndStop('humAudio', 100);
}

// Bring the hum back, optionally once the monophonic sound has finished.
function unmaskHum(delay = 0) {
  clearTimeout(humMaskTimeout);
  humMaskTimeout = null;
  if (delay > 0) {
    humMaskTimeout = setTimeout(() => unmaskHum(), delay);
    return;
  }
  if (!humMasked) return;
  humMasked = false;
  if (STATE_ON && outerMostBracket) startHum();
}

// Drop the mask without restarting the hum, used when powering off.
function clearHumMask() {
  clearTimeout(humMaskTimeout);
  humMaskTimeout = null;
  humMasked = false;
}

function startLockupLoop(lockupType, skipBgn = false) {
  // Which lockup this is decides the sounds, the same way hybrid_font does it.
  const lockup = lockupTypeForEffect(lockupType);
  const mapEntry = LOCKUP_SOUNDS[lockup];
  if (!mapEntry) return;

  const { bgn: b, loop: l } = mapEntry;

  currentLockupType = lockupType;
  activeLockup = lockup;
  if (!soundOnState.get()) return;

  const beginBuffers = pickLoopBuffers(b) || [];
  const loopBuffers  = pickLoopBuffers(l) || [];
  if (!loopBuffers.length) {
    showNoSoundMsg(mapEntry.label, "");
    return;
  }

  // The armed hum replaces the hum on the real prop, so kill the idle hum.
  if (mapEntry.mono) maskHum();

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = globalVolume;
  gainNode.connect(masterGain);

  let startOffset = 0;

  // Play the "begin" sound first, if we're not skipping it and if it exists
  if (!skipBgn && beginBuffers.length > 0) {
    const bgnIdx = noRepeatRandom(beginBuffers.length, lastPlayedSoundIndex[b]);
    lastPlayedSoundIndex[b] = bgnIdx;
    const { src: bgnSrc } = playBuffer(beginBuffers[bgnIdx], 0, false, 1, gainNode);
    startOffset = bgnSrc.buffer.duration;
  }

  // Play lockup loop
  const loopIdx = noRepeatRandom(loopBuffers.length, lastPlayedSoundIndex[l]);
  lastPlayedSoundIndex[l] = loopIdx;
  const { src: loopSrc } = playBuffer(loopBuffers[loopIdx], startOffset, true, 1, gainNode);
  lockupLoopSrc  = loopSrc;
  lockupGainNode = gainNode;
}

function endLockupLoop(effectType, endEffectName, shouldClear) {
  // console.log("******************** [Lockup] ▶ endLockupLoop called;", {
  //   effectType,
  //   endEffectName,
  //   shouldClear,
  //   isLoopRunning: !!lockupLoopSrc
  // });
  if (lockupLoopSrc) { lockupLoopSrc.stop(); lockupLoopSrc.disconnect(); lockupLoopSrc = null; }

  // If sound is OFF, do not play the end sound; just clean up state  //
  if (!soundOnState.get()) {
    if (lockupGainNode) { lockupGainNode.disconnect(); lockupGainNode = null; }
    if (shouldClear) { currentLockupType = null; activeLockup = null; }
    return;
  }
  
  // Play endlock if exists, with fallback to default font when needed
  if (endEffectName) {
    function tryPlayBuffers(bufs, fnames, durs, fontLabel) {
      if (bufs.length > 0) {
        const endIdx = noRepeatRandom(bufs.length, lastPlayedSoundIndex[endEffectName]);
        lastPlayedSoundIndex[endEffectName] = endIdx;
        const buf = bufs[endIdx];
        if (!buf) return false;  // Decoding failure
        const fname = fnames[endIdx];
        const dur   = Math.round(durs[endIdx]);
        console.log(`▶ ${fontLabel}: ** playing ${fname} – ${dur}ms`);
        playBuffer(buf, 0, false, globalVolume, masterGain);
        if (shouldClear) { currentLockupType = null; activeLockup = null; }
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
      currentFontName === "Default" ? "Default Font" : currentFontName
    )) { if (lockupGainNode) { lockupGainNode.disconnect(); lockupGainNode = null; } return; }

    // Then try default font fallback if needed
    if (currentFontName === "Default" || fontFallbackState.get()) {
      tryPlayBuffers(
        defaultFontSoundBuffers[endEffectName] || [],
        defaultFontSoundFilenames[endEffectName],
        defaultFontSoundDurations[endEffectName],
        "Default Font"
      );
    }
  }
  if (lockupGainNode) { lockupGainNode.disconnect(); lockupGainNode = null; }
  if (shouldClear) { currentLockupType = null; activeLockup = null; }
}

function resumeLoops() {
  if (STATE_ON && outerMostBracket) {
    startHum();
    updateSmoothSwingGains();
  }
  if (currentLockupType && !lockupLoopSrc) startLockupLoop(currentLockupType, true);
}

window.addEventListener('focus', () => { if (soundOnState.get()) resumeLoops(); });
window.loadDemoFontPresetFromQuery = loadDemoFontPresetFromQuery;
