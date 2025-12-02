// === TWO-MIC VARIABLE FONT — TEXT-ONLY REACTIVE SCENE =======================
// Mic A → Center "GRATEFUL" (WeTravelogueVariableRoman, weight + letter-spacing
//        both react to volume; louder = heavier + more spaced out)
// Mic B → 5 rows of "GRATEFUL" (WeStacksVariable, pink, letters appear
//           one by one in random order at a regular interval when you press Z,
//           AND SHPE axis (pink stars) is audio-reactive 0 → 3)
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Panel visibility flag (for X key + close button)
let panelVisible = true;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeTravelogueVariableRoman'; // Mic A
const FONT_B = 'WeStacksVariable';          // Mic B
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM elements for text
let micATextEl;          // center "GRATEFUL"
let micBRows = [];       // 5 row containers
let micBLetters = [];    // flat array of all letter spans for random reveal

// Layout
let baseSize;

// Sensitivity (controlled by slider)
let sensAFactor   = 0.50; // Mic A sensitivity (weight)

// === Mic A LETTER-SPACING RANGE (EDIT THESE) ================================
// Quiet = LETTER_SPACING_MIN (em), Loud = LETTER_SPACING_MAX (em)
const LETTER_SPACING_MIN = 0.02; // <<< smaller spacing at low volume
const LETTER_SPACING_MAX = 0.30; // <<< bigger spacing at high volume

// === Mic B LETTER REVEAL (TIME-BASED, TRIGGERED BY Z) ======================
// Time gap between each new letter (in milliseconds)
// (Can be adjusted via slider)
let micBRevealCooldownMs = 200; // <<< default: 1 second between reveals

let lastMicBRevealTime = -Infinity;
let micBRevealActive = false; // <<< true = letters currently popping up

// === Mic B SHPE mapping for pink stars =====================================
// Quietest → SHPE = MICB_SHAPE_MIN
// Loudest  → SHPE = MICB_SHAPE_MAX
// You can tweak these three values.
const MICB_SHAPE_MIN     = 0.0;  // <<< quietest shape value
const MICB_SHAPE_MAX     = 3.0;  // <<< loudest shape value
const MICB_SHAPE_RMS_MAX = 0.25; // <<< volume level where the pink SHPE animation reaches its maximum shape

// Slider + label elements
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;   // now controls interval
let micBRMSLabel;              // live Mic B volume readout

function setup() {
  createCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);

  // ===== Control Panel (minimal, no debug/metadata) =========================
  ctrlPanel = createDiv();
  ctrlPanel.id('ctrlPanel');
  ctrlPanel.style(`
    position: fixed;
    top: 10px; left: 10px;
    z-index: 9999;
    background: rgba(255,255,255,0.9);
    border-radius: 10px;
    padding: 8px 10px 10px 10px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 12px;
    color: #111;
    box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    max-width: 92vw;
  `);

  // Tiny "X" close button inside the panel
  hideBtn = createButton("×").parent(ctrlPanel);
  hideBtn.style(`
    position:absolute;
    top:4px;
    right:6px;
    width:20px;
    height:20px;
    padding:0;
    border-radius:999px;
    border: none;
    background: transparent;
    font-size:14px;
    line-height:20px;
    text-align:center;
    cursor:pointer;
  `);
  hideBtn.mousePressed(togglePanel);

  const topRow = createDiv().parent(ctrlPanel)
    .style('display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan('  Step 1 → Enable Mics').parent(ctrlPanel);

  // Mic pickers
  const row2 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;');
  const groupA = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA   = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB   = createSelect().parent(groupB);

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // === Sliders for sensitivity / interval ==================================
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  // Mic A sensitivity slider
  sensALabel = createSpan(`Mic A sensitivity (weight): ${sensAFactor.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600;');

  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01)
    .parent(sensRow);
  sensASlider.style('width', '160px');

  // Pink letter interval slider (for Z-triggered reveal)
  sensBLabel = createSpan(
    `Pink letter interval (ms): ${micBRevealCooldownMs}`
  ).parent(sensRow).style('font-weight:600;');

  // 100 ms (very fast) → 2000 ms (very slow)
  sensBSlider = createSlider(100, 2000, micBRevealCooldownMs, 50)
    .parent(sensRow);
  sensBSlider.style('width', '160px');

  // Live Mic B RMS label so you can see actual volume value
  micBRMSLabel = createSpan(
    `Mic B volume (RMS): 0.000 — controls pink stars (SHPE axis)`
  ).parent(sensRow);

  // ===== Central text for Mic A ============================================
  micATextEl = document.getElementById('micAText');
  if (!micATextEl) {
    micATextEl = document.createElement('div');
    micATextEl.id = 'micAText';
    document.body.appendChild(micATextEl);
  }
  Object.assign(micATextEl.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: `${baseSize.toFixed(1)}px`,
    lineHeight: '1',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    willChange: 'font-variation-settings, font-stretch, letter-spacing',
    fontOpticalSizing: 'none',
    fontFamily: `"${FONT_A}", system-ui, sans-serif`,
    color: '#ffffff',
    letterSpacing: `${LETTER_SPACING_MIN}em`, // <<< initial spacing = quiet value
    zIndex: 3
  });
  micATextEl.textContent = 'GRATEFUL';
  micATextEl.style.fontVariationSettings =
    `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 0`;
  micATextEl.style.fontStretch = '100%';

  // ===== 5 rows of text for Mic B ==========================================
  createMicBRows();

  // ===== Font loading (best-effort) ========================================
  if (document.fonts && document.fonts.load) {
    Promise.all(fontFamilies.map(f => document.fonts.load(`700 1em "${f}"`)))
      .then(() => { fontsReady = true; })
      .catch(() => { fontsReady = true; });
  } else {
    fontsReady = true;
  }

  // Analyser buffers
  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  background(0);
  noStroke();
  textFont('monospace');

  window.addEventListener('beforeunload', cleanupStreams);
}

function createMicBRows() {
  const existing = document.getElementById('micBWrapper');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'micBWrapper';
  document.body.appendChild(wrapper);
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: '100vw',
    height: '100vh',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 2 // under micAText, above canvas
  });

  micBRows = [];
  micBLetters = [];

  const word = 'GRATEFUL';
  const rowCount = 5;

  for (let i = 0; i < rowCount; i++) {
    const row = document.createElement('div');
    micBRows.push(row);
    Object.assign(row.style, {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100vw',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: `"${FONT_B}", system-ui, sans-serif`,
      textTransform: 'uppercase',
      fontSize: 'min(35vw, 150px)',
      color: '#ff7ac8', // pink
      letterSpacing: '0.1em',
      opacity: 1,
      top: `${4 + i * 18}%`, // spread vertically

      // Default SHPE value for pink stars — quietest
      fontVariationSettings: `'SHPE' ${MICB_SHAPE_MIN}, 'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 0`
    });

    // Create spans per letter, all initially hidden
    for (let c = 0; c < word.length; c++) {
      const span = document.createElement('span');
      span.textContent = word[c];
      Object.assign(span.style, {
        opacity: 0,
        transition: 'opacity 0.35s ease-out'
      });
      row.appendChild(span);
      micBLetters.push(span);
    }

    wrapper.appendChild(row);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);
  micATextEl.style.fontSize = `${baseSize.toFixed(1)}px`;
}

// ===== PANEL TOGGLE (button + X key) =======================================
function togglePanel() {
  if (!ctrlPanel) return;
  panelVisible = !panelVisible;
  if (panelVisible) ctrlPanel.show();
  else ctrlPanel.hide();
}

function keyPressed() {
  if (key === 'x' || key === 'X') {
    togglePanel();
  }
  if (key === 'p' || key === 'p') {
    startMicBLetterReveal();
  }
  if (key === 'm' || key === 'M'){
    startMicsFromKeyboard();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// Start mics via "M" key, even if panel is hidden
async function startMicsFromKeyboard() {
  try {
    // 1) Make sure we have permission + device list
    if (!devices.length) {
      await enableMicsOnce(); // this will also call loadAudioInputs()
    }

    // 2) Auto-select default devices if none chosen in the dropdowns
    if (devices.length) {
      // Mic A: first device
      if (!selA.value()) {
        selA.value(devices[0].deviceId);
      }

      // Mic B: second device if available, otherwise also first
      if (!selB.value()) {
        const idxB = (devices.length > 1) ? 1 : 0;
        selB.value(devices[idxB].deviceId);
      }
    }

    // 3) If streams not already running, start them
    if (!streamA || !streamB) {
      await startStreams();
    }

    if (statusSpan) {
      statusSpan.html(" Streaming… (started with 'M')");
    }
  } catch (e) {
    console.error(e);
    if (statusSpan) {
      statusSpan.html(" Error starting mics with 'M'.");
    }
  }
}


// Start a new time-based reveal run when Z is pressed
function startMicBLetterReveal() {
  if (!micBLetters.length) return;
  // Reset all letters to hidden
  for (const span of micBLetters) {
    span.style.opacity = '0';
  }
  micBRevealActive = true;
  lastMicBRevealTime = millis();
}

// ===== MIC ENABLE + DEVICE PICKER ==========================================
async function enableMicsOnce() {
  try {
    if (typeof userStartAudio === 'function') await userStartAudio();
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await loadAudioInputs();

    [selA, selB, startBtn].forEach(el => el.removeAttribute('disabled'));
    statusSpan.html(`  Step 2 → Pick Mic A & Mic B, then click Start`);
  } catch (e) {
    console.error(e);
    statusSpan.html('  Permission error — use HTTPS & allow mic access.');
  }
}

async function loadAudioInputs() {
  selA.elt.innerHTML = '';
  selB.elt.innerHTML = '';

  const all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter(d => d.kind === 'audioinput');

  if (devices.length === 0) {
    statusSpan.html('  No audio inputs found — check System Settings → Sound → Input.');
    return;
  }

  devices.forEach(d => {
    const label = d.label || `Mic (${d.deviceId.slice(0,6)})`;
    selA.option(label, d.deviceId);
    selB.option(label, d.deviceId);
  });

  const idxBuiltIn = devices.findIndex(d => /built.?in/i.test(d.label));
  const idxIPhone  = devices.findIndex(d => /iphone|continuity|external/i.test(d.label));
  if (idxBuiltIn >= 0) selA.selected(devices[idxBuiltIn].deviceId);
  if (idxIPhone >= 0 && idxIPhone !== idxBuiltIn) selB.selected(devices[idxIPhone].deviceId);
  else if (devices.length > 1) selB.selected(devices[1].deviceId);
}

// ===== START BOTH STREAMS ===================================================
async function startStreams() {
  const idA = selA.value();
  const idB = selB.value();
  if (!idA || !idB) return statusSpan.html('  Select two devices first.');
  if (idA === idB) return statusSpan.html('  Pick two different devices.');

  cleanupStreams();

  try {
    const ctx = (typeof getAudioContext === 'function')
      ? getAudioContext()
      : (window.__sharedCtx ||= new (window.AudioContext || window.webkitAudioContext)());

    const cA = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: idA } }, video: false
    });
    const cB = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: idB } }, video: false
    });

    streamA = cA; streamB = cB;
    const srcA = ctx.createMediaStreamSource(streamA);
    const srcB = ctx.createMediaStreamSource(streamB);

    anA = ctx.createAnalyser();
    anB = ctx.createAnalyser();
    anA.fftSize = 1024;
    anB.fftSize = 1024;

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html('  Streaming… Mic A → weight + spacing, Mic B → pink stars (SHPE)');
    loop();
  } catch (e) {
    console.error(e);
    statusSpan.html('  Couldn’t start both — another app may be using a mic.');
  }
}

function cleanupStreams() {
  [streamA, streamB].forEach(s => { if (s) s.getTracks().forEach(t => t.stop()); });
  streamA = streamB = null;
  anA = anB = null;
}

// ===== DRAW LOOP — TEXT ONLY ===============================================
function draw() {
  background(0); // black background

  // Read slider values each frame and update globals + labels
  if (sensASlider) {
    sensAFactor = sensASlider.value();
    if (sensALabel) {
      sensALabel.html(`Mic A sensitivity (weight): ${sensAFactor.toFixed(2)}`);
    }
  }

  if (sensBSlider) {
    micBRevealCooldownMs = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(
        `Pink letter interval (ms): ${micBRevealCooldownMs}`
      );
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  // Update live Mic B volume label
  if (micBRMSLabel) {
    micBRMSLabel.html(
      `Mic B volume (RMS): ${rmsB.toFixed(3)} — controls pink stars (SHPE axis)`
    );
  }

  // Map audio → design
  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function updateMicADesign(rmsA) {
  const adjusted = rmsA * sensAFactor;

  // Weight mapping (same as before)
  const wght = clamp(map(adjusted, 0, 0.25, 100, 900), 200, 900);
  micATextEl.style.fontVariationSettings =
    `'wght' ${wght.toFixed(1)}, 'wdth' 100, 'slnt' 0, 'ital' 0`;

  // === LETTER-SPACING MAPPING (LOUDER = MORE SPACED) =======================
  // Map adjusted volume 0 → 0.25 to LETTER_SPACING_MIN → LETTER_SPACING_MAX
  let spacing = map(
    adjusted,
    0,
    0.25,
    LETTER_SPACING_MIN,
    LETTER_SPACING_MAX
  );
  spacing = clamp(spacing, LETTER_SPACING_MIN, LETTER_SPACING_MAX);
  micATextEl.style.letterSpacing = `${spacing.toFixed(3)}em`;
}

function updateMicBDesign(rmsB) {
  // === 1) LETTER REVEAL — TIME-BASED, TRIGGERED BY Z =======================
  if (micBRevealActive) {
    const now = millis();
    const elapsed = now - lastMicBRevealTime;

    if (elapsed >= micBRevealCooldownMs) {
      const revealed = revealRandomMicBLetter();
      lastMicBRevealTime = now;

      // If no more hidden letters, stop the reveal run
      if (!revealed) {
        micBRevealActive = false;
      }
    }
  }

  // === 2) Pink "stars" SHPE audioreactivity (Mic B) ========================
  // Map rmsB 0..MICB_SHAPE_RMS_MAX → SHPE MICB_SHAPE_MIN..MICB_SHAPE_MAX
  let shpeVal = map(
    rmsB,
    0,
    MICB_SHAPE_RMS_MAX,
    MICB_SHAPE_MIN,
    MICB_SHAPE_MAX
  );
  shpeVal = clamp(shpeVal, MICB_SHAPE_MIN, MICB_SHAPE_MAX);

  const fv =
    `'SHPE' ${shpeVal.toFixed(2)}, ` +
    `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 0`;

  for (const row of micBRows) {
    row.style.fontVariationSettings = fv;
  }
}

// ===== HELPERS ==============================================================

function analyserRMS(analyser, buf) {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return Math.sqrt(sumSq / buf.length);
}

// Returns true if a letter was revealed, false if there were none left
function revealRandomMicBLetter() {
  if (!micBLetters.length) return false;

  const hiddenIndices = [];
  for (let i = 0; i < micBLetters.length; i++) {
    if (micBLetters[i].style.opacity === '' || micBLetters[i].style.opacity === '0') {
      hiddenIndices.push(i);
    }
  }
  if (!hiddenIndices.length) return false;

  const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  micBLetters[idx].style.opacity = '1';
  return true;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// using p5.js global map()
