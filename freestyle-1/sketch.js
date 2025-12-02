// === TWO-MIC VARIABLE FONT — SINGLE JAZZ OVERLAP SCENE =====================
// Mic A → Top "JAZZY" (WeSpoliaExplodeVariable, white fill;
//          reacts to volume with its own EXPLODE axis
//          and is 50% less sensitive than the big pink JAZZ)
// Mic B → Bottom "JAZZ" (WeSpoliaExplodeVariable, pink/purple;
//          louder = larger scale from center + more "explode";
//          when loud enough, color toggles ONCE (pink ↔ purple)
//          with a cooldown, and stays that color until the next loud hit)
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

let panelVisible = true;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts
// <<< Mic A font uses the explode version too
const FONT_A = 'WeSpoliaExplodeVariable';
const FONT_B = 'WeSpoliaExplodeVariable';
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM
let micAWrapper, micBWrapper;
let micARows = [];
let micBRows = [];

// ===== FONT WEIGHT SETTINGS (EDIT HERE) ====================================
// <<< Mic A "JAZZY" font weight (lighter look). Try 100–400
const MIC_A_FONT_WEIGHT = 200;

// <<< Mic B "JAZZ" font weight (boldest look). Try 700–900
const MIC_B_FONT_WEIGHT = 900;

// ===== Mic A stroke settings (EDIT MIN/MAX HERE) ===========================

const MIC_A_MIN_LEVEL   = 0.01;
const MIC_A_MAX_LEVEL   = 0.50;
const MIC_A_MIN_STROKE  = 0.0;
const MIC_A_MAX_STROKE  = 0.0;   // stroke at loudest (px)

// ===== Mic B scale & color settings ========================================

// Base scale of Mic A (top "JAZZY")
const MIC_A_BASE_SCALE = 1.0; // <<< change if you want Mic A bigger/smaller

// At quietest volume, Mic B scale (1.5 = 150% of Mic A)
const MIC_B_SCALE_QUIET = 1.5; // <<< Mic B size when quiet (relative to Mic A)

// At loudest volume, Mic B scale
const MIC_B_SCALE_LOUD  = 3.0; // <<< Mic B size when loudest

// These are the input volume bounds for scaling
const SCALE_MIN_LEVEL   = 0.00; // <<< lower RMS bound for scaling
const SCALE_MAX_LEVEL   = 0.30; // <<< upper RMS bound for scaling

// Derived scale constants
const SCALE_MIN         = MIC_B_SCALE_QUIET;
const SCALE_MAX         = MIC_B_SCALE_LOUD;

const COLOR_MIC_A_FILL   = '#FFFFFF';
const COLOR_MIC_B_ALT_1  = '#E2BAFF'; // purple-ish
const COLOR_MIC_B_ALT_2  = '#FBAFCE'; // pink

// volume threshold to *trigger* color toggle
const MIC_B_COLOR_THRESHOLD = 0.18; // <<< change when color toggles

// cooldown between color toggles (ms)
const MIC_B_COOLDOWN_MS = 5000; // <<< time between color toggles

// color toggle state
let micBColorToggle = false;              // false → ALT_2, true → ALT_1
let micBLastToggleTime = 0;               // millis() of last toggle

// ===== Mic sensitivity + slider ranges (EDIT HERE) =========================

// <<< Mic A sensitivity slider range
const SENS_A_MIN = 0.5;
const SENS_A_MAX = 5.0;

// <<< Mic B sensitivity slider range
const SENS_B_MIN = 0.5;
const SENS_B_MAX = 5.0;

// <<< DEFAULT slider values:
// Mic B is the "reference" (1.0×), Mic A is 0.5× = 50% less sensitive
let sensAFactor = 0.5; // <<< default Mic A sensitivity (half of Mic B)
let sensBFactor = 1.0; // <<< default Mic B sensitivity

// Slider DOM refs
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;

// ===== EXPLODE AXIS TAG ====================================================

// 🔧 Change this if the axis tag is different in your font (e.g. "EXPL", "SPLO", etc.)
const EXPLODE_AXIS = "EXPL";

// ===== Mic A EXPLODE settings (EDIT HERE) ==================================
// <<< Mic A explode mapping: RMS → axis value
const EXPLODE_A_MIN_LEVEL = 0.00;  // <<< quiet bound for Mic A explode
const EXPLODE_A_MAX_LEVEL = 0.30;  // <<< loud bound for Mic A explode

const EXPLODE_A_MIN = 0.0;         // <<< min explode for Mic A
const EXPLODE_A_MAX = 60.0;        // <<< max explode for Mic A (smaller than Mic B)

// ===== Mic B EXPLODE settings (EDIT HERE) ==================================
// <<< Min/max RMS that drive the explode axis for Mic B
const EXPLODE_MIN_LEVEL = 0.00; 
const EXPLODE_MAX_LEVEL = 0.30; 

// <<< Explode axis value range for Mic B (adjust to taste)
const EXPLODE_MIN = 0.0;        
const EXPLODE_MAX = 100.0;      

// 🔴 TEST MODE: if true, ignore mic & force a big explode value for BOTH mics
const TEST_EXPLODE_MODE = false;
const TEST_EXPLODE_VALUE = 120; // try 80, 120, 200, etc.

function setup() {
  createCanvas(windowWidth, windowHeight);

  // ===== Control Panel =====================================================
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
  hideBtn.mousePressed(() => {
    ctrlPanel.hide();
    panelVisible = false;
  });

  const topRow = createDiv().parent(ctrlPanel)
    .style('display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan('  Step 1 → Enable Mics').parent(ctrlPanel);

  const row2 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;');

  const groupA = createDiv().parent(row2)
    .style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2)
    .style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB = createSelect().parent(groupB);

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // Sensitivity sliders
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  // <<< THIS LABEL UPDATES LIVE; DEFAULT VALUE IS sensAFactor ABOVE
  sensALabel = createSpan(
    `Mic A sensitivity (stroke + explode): ${sensAFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  // <<< CHANGE RANGE VIA SENS_A_MIN / SENS_A_MAX, DEFAULT VIA sensAFactor
  sensASlider = createSlider(SENS_A_MIN, SENS_A_MAX, sensAFactor, 0.01).parent(sensRow);
  sensASlider.style('width', '160px');

  sensBLabel = createSpan(
    `Mic B sensitivity (scale + color + explode): ${sensBFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  // <<< CHANGE RANGE VIA SENS_B_MIN / SENS_B_MAX, DEFAULT VIA sensBFactor
  sensBSlider = createSlider(SENS_B_MIN, SENS_B_MAX, sensBFactor, 0.01).parent(sensRow);
  sensBSlider.style('width', '160px');

  // Text layers
  createLayeredText();

  // Fonts
  if (document.fonts && document.fonts.load) {
    Promise.all(fontFamilies.map(f => document.fonts.load(`700 1em "${f}"`)))
      .then(() => { fontsReady = true; })
      .catch(() => { fontsReady = true; });
  } else {
    fontsReady = true;
  }

  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  background(0);
  noStroke();
  textFont('monospace');

  window.addEventListener('beforeunload', cleanupStreams);
}

function createLayeredText() {
  if (micAWrapper && micAWrapper.parentNode) micAWrapper.parentNode.removeChild(micAWrapper);
  if (micBWrapper && micBWrapper.parentNode) micBWrapper.parentNode.removeChild(micBWrapper);

  micARows = [];
  micBRows = [];

  const wrapperBaseStyle = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: '100vw',
    height: '100vh',
    transform: 'translate(-50%, -50%) scale(1)',
    pointerEvents: 'none'
  };

  // Bottom layer (Mic B)
  micBWrapper = document.createElement('div');
  micBWrapper.id = 'micBWrapper';
  document.body.appendChild(micBWrapper);
  Object.assign(micBWrapper.style, wrapperBaseStyle, { zIndex: 2 });
  createRowsForWrapper(micBWrapper, micBRows, false);

  // Top layer (Mic A)
  micAWrapper = document.createElement('div');
  micAWrapper.id = 'micAWrapper';
  document.body.appendChild(micAWrapper);
  Object.assign(micAWrapper.style, wrapperBaseStyle, { zIndex: 3 });
  createRowsForWrapper(micAWrapper, micARows, true);
}

function createRowsForWrapper(wrapper, rowsArray, isMicA) {
  // <<< MIC A / MIC B TEXT CONTENT
  // Mic A: "JAZZY", Mic B: "JAZZ"
  const word = isMicA ? 'JAZZY' : 'JAZZ';

  const row = document.createElement('div');
  rowsArray.push(row);

  const fillColor = isMicA ? COLOR_MIC_A_FILL : COLOR_MIC_B_ALT_2; // start pink
  const fontForThisRow = isMicA ? FONT_A : FONT_B; 

  Object.assign(row.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%)`,
    fontFamily: `"${fontForThisRow}", system-ui, sans-serif`,
    textTransform: 'uppercase',
    fontSize: 'min(18vw, 220px)',
    lineHeight: '1',
    letterSpacing: '0.06em',
    color: fillColor,
    whiteSpace: 'nowrap',
    willChange: 'transform, font-variation-settings, color, text-shadow',
    fontOpticalSizing: 'none'
  });

  if (isMicA) {
    // Mic A: lighter weight + explode axis starts at 0
    row.style.fontVariationSettings =
      `"wght" ${MIC_A_FONT_WEIGHT}, "${EXPLODE_AXIS}" 0`;
  } else {
    // Mic B: bold weight + explode axis starts at 0
    row.style.fontVariationSettings =
      `"wght" ${MIC_B_FONT_WEIGHT}, "${EXPLODE_AXIS}" 0`;
  }

  if (isMicA) {
    row.style.webkitTextStroke = `0px transparent`;
    applyOuterStroke(row, MIC_A_MIN_STROKE);
  } else {
    row.style.webkitTextStroke = `0px transparent`;
    row.style.textShadow = 'none';
  }

  row.textContent = word;
  wrapper.appendChild(row);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
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

    statusSpan.html('  Streaming… Mic A → explode + stroke, Mic B → scale + explode + color toggle');
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

// ===== DRAW LOOP ============================================================
function draw() {
  background(0);

  if (sensASlider) {
    sensAFactor = sensASlider.value();
    sensALabel.html(`Mic A sensitivity (stroke + explode): ${sensAFactor.toFixed(2)}`);
  }
  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    sensBLabel.html(`Mic B sensitivity (scale + color + explode): ${sensBFactor.toFixed(2)}`);
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function updateMicADesign(rmsA) {
  if (!micARows.length) return;

  // Mic A: 50% less sensitive by default via sensAFactor (0.5 vs 1.0 for B)
  const effectiveA = rmsA * sensAFactor;

  // Stroke width mapping (Mic A)
  let strokeWidth = map(
    effectiveA,
    MIC_A_MIN_LEVEL,
    MIC_A_MAX_LEVEL,
    MIC_A_MIN_STROKE,
    MIC_A_MAX_STROKE
  );
  strokeWidth = clamp(strokeWidth, MIC_A_MIN_STROKE, MIC_A_MAX_STROKE);

  // ===== Mic A EXPLODE mapping ============================================
  let explodeAVal;
  if (TEST_EXPLODE_MODE) {
    explodeAVal = TEST_EXPLODE_VALUE;
  } else {
    explodeAVal = map(
      effectiveA,
      EXPLODE_A_MIN_LEVEL,
      EXPLODE_A_MAX_LEVEL,
      EXPLODE_A_MIN,
      EXPLODE_A_MAX
    );
    explodeAVal = clamp(explodeAVal, EXPLODE_A_MIN, EXPLODE_A_MAX);
  }

  micARows.forEach(row => {
    // weight + explode axis from Mic A
    row.style.fontVariationSettings =
      `"wght" ${MIC_A_FONT_WEIGHT}, "${EXPLODE_AXIS}" ${explodeAVal.toFixed(1)}`;
    applyOuterStroke(row, strokeWidth);
  });
}

function updateMicBDesign(rmsB) {
  if (!micBWrapper) return;

  const effectiveB = rmsB * sensBFactor;

  // Scale from center (Mic B)
  let s = map(
    effectiveB,
    SCALE_MIN_LEVEL,
    SCALE_MAX_LEVEL,
    MIC_B_SCALE_QUIET,
    MIC_B_SCALE_LOUD
  );
  s = clamp(s, MIC_B_SCALE_QUIET, MIC_B_SCALE_LOUD);
  micBWrapper.style.transform = `translate(-50%, -50%) scale(${s})`;

  // Top stays fixed scale (Mic A)
  if (micAWrapper) {
    micAWrapper.style.transform =
      `translate(-50%, -50%) scale(${MIC_A_BASE_SCALE})`;
  }

  // Color toggling with cooldown
  if (effectiveB > MIC_B_COLOR_THRESHOLD) {
    const now = millis();
    if (now - micBLastToggleTime >= MIC_B_COOLDOWN_MS) {
      micBColorToggle = !micBColorToggle;
      micBLastToggleTime = now;
    }
  }

  const currentColor = micBColorToggle ? COLOR_MIC_B_ALT_1 : COLOR_MIC_B_ALT_2;

  // ===== Mic B EXPLODE mapping ============================================
  let explodeVal;
  if (TEST_EXPLODE_MODE) {
    explodeVal = TEST_EXPLODE_VALUE;
  } else {
    explodeVal = map(
      effectiveB,
      EXPLODE_MIN_LEVEL,
      EXPLODE_MAX_LEVEL,
      EXPLODE_MIN,
      EXPLODE_MAX
    );
    explodeVal = clamp(explodeVal, EXPLODE_MIN, EXPLODE_MAX);
  }

  micBRows.forEach(row => {
    row.style.color = currentColor;
    // Mic B: bold weight + explode axis
    row.style.fontVariationSettings =
      `"wght" ${MIC_B_FONT_WEIGHT}, "${EXPLODE_AXIS}" ${explodeVal.toFixed(1)}`;
  });
}

// ===== OUTER STROKE VIA TEXT-SHADOW ========================================
function applyOuterStroke(el, widthPx) {
  if (widthPx <= 0.05) {
    el.style.textShadow = 'none';
    return;
  }
  const w = widthPx.toFixed(1);
  el.style.textShadow = `
    0 ${w}px 0 black,
    0 -${w}px 0 black,
    ${w}px 0 0 black,
    -${w}px 0 0 black,
    ${w}px ${w}px 0 black,
    ${w}px -${w}px 0 black,
    -${w}px ${w}px 0 black,
    -${w}px -${w}px 0 black
  `;
}

// ===== KEYBOARD HANDLER =====================================================
function keyPressed() {
  if (key === 'x' || key === 'X') {
    panelVisible = !panelVisible;
    if (panelVisible) ctrlPanel.show();
    else ctrlPanel.hide();
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


// ===== HELPERS ==============================================================

function analyserRMS(analyser, buf) {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return Math.sqrt(sumSq / buf.length);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
// using p5.js global map()
