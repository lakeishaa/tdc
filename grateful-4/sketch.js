// === TWO-MIC VARIABLE FONT — 3-ROW OVERLAP SCENE ===========================
// Mic A → Top layer "GRATEFUL" (WeStacksVariable, white fill, #FF5ACD stroke,
//          stroke width reacts to volume, SHPE 3)
// Mic B → Bottom layer "GRATEFUL" (WeStacksVariable, solid #FBAFCE, SHPE 1)
// Shared → 3 rows overlap in center; Mic B volume scales both layers
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// === PANEL VISIBILITY FLAG (X to toggle) ===================================
let panelVisible = true; // true = panel shown, false = hidden
// ============================================================================

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeStacksVariable'; // Mic A
const FONT_B = 'WeStacksVariable'; // Mic B (same family)
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM elements for layered text
let micAWrapper, micBWrapper;
let micARows = [];
let micBRows = [];

// Layout
let baseSize;

// ===== USER TWEAK BLOCKS ====================================================

// Mic A stroke reactivity
const MIC_A_MIN_LEVEL   = 0.01; // level that starts stroke
const MIC_A_MAX_LEVEL   = 0.50; // level that gives max stroke
const MIC_A_MIN_STROKE  = 0.0;  // stroke at silence (px)
const MIC_A_MAX_STROKE  = 8.0;  // stroke at loudest (px)

// === Mic B SCALE MAPPING — EDIT THESE 4 FOR SCALE BEHAVIOR =================
// Mic B volume → scale thresholds (input range)
const SCALE_MIN_LEVEL   = 0.00; // MIC B SCALE MIN LEVEL  (quiet)
const SCALE_MAX_LEVEL   = 0.30; // MIC B SCALE MAX LEVEL  (loud)

// Mic B visual scale range (output range)
const SCALE_MIN         = 0.9;  // MIC B SCALE MIN (smaller text)
const SCALE_MAX         = 2.7;  // MIC B SCALE MAX (bigger text)
// ============================================================================

// Colors
const COLOR_MIC_A_FILL   = '#FFFFFF'; // Mic A fill (white)
const COLOR_MIC_A_STROKE = '#FF5ACD'; // Mic A stroke color (pink)
const COLOR_MIC_B_FILL   = '#FBAFCE'; // Mic B fill

// Mic A offset relative to Mic B (position)
const MIC_A_OFFSET_X = '-15px';  // horizontal offset
const MIC_A_OFFSET_Y = '-15px';  // vertical offset

// ===== NEW: Sensitivity sliders for Mic A & Mic B ==========================

let sensAFactor = 1.0; // multiplier for Mic A RMS → stroke
let sensBFactor = 1.0; // multiplier for Mic B RMS → scale

let sensALabel, sensASlider;
let sensBLabel, sensBSlider;

function setup() {
  createCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);

  // ===== Control Panel (minimal) ===========================================
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

  // Close button should also update the flag
  hideBtn.mousePressed(() => {
    ctrlPanel.hide();
    panelVisible = false; // <<< keep in sync with X toggle
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
  selA   = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2)
    .style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB   = createSelect().parent(groupB);

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // ===== Sensitivity sliders ===============================================
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  sensALabel = createSpan(
    `Mic A sensitivity (stroke): ${sensAFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01).parent(sensRow);
  sensASlider.style('width', '160px');

  sensBLabel = createSpan(
    `Mic B sensitivity (scale): ${sensBFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  sensBSlider = createSlider(0.5, 5, sensBFactor, 0.01).parent(sensRow);
  sensBSlider.style('width', '160px');

  // ===== Create layered text for both mics =================================
  createLayeredText();

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

function createLayeredText() {
  // Clean up old wrappers if re-running
  if (micAWrapper && micAWrapper.parentNode) micAWrapper.parentNode.removeChild(micAWrapper);
  if (micBWrapper && micBWrapper.parentNode) micBWrapper.parentNode.removeChild(micBWrapper);

  micARows = [];
  micBRows = [];

  // Shared layout for wrappers (center of viewport)
  const wrapperBaseStyle = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: '100vw',
    height: '100vh',
    transform: 'translate(-50%, -50%) scale(1)',
    pointerEvents: 'none'
  };

  // ===== Mic B (bottom layer) ==============================================
  micBWrapper = document.createElement('div');
  micBWrapper.id = 'micBWrapper';
  document.body.appendChild(micBWrapper);
  Object.assign(micBWrapper.style, wrapperBaseStyle, {
    zIndex: 2 // under Mic A, above canvas
  });

  createRowsForWrapper(micBWrapper, micBRows, false);

  // ===== Mic A (top layer) =================================================
  micAWrapper = document.createElement('div');
  micAWrapper.id = 'micAWrapper';
  document.body.appendChild(micAWrapper);
  Object.assign(micAWrapper.style, wrapperBaseStyle, {
    zIndex: 3 // on top of Mic B
  });

  createRowsForWrapper(micAWrapper, micARows, true);
}

function createRowsForWrapper(wrapper, rowsArray, isMicA) {
  const word = 'GRATEFUL';
  const rowCount = 3;

  // ===== USER TWEAK: VERTICAL SPACING BETWEEN ROWS =========================
  const SPACING_EM = 0.8;  // adjust vertical spacing size
  const offsetsEm = [-SPACING_EM, 0, SPACING_EM];
  // ========================================================================

  for (let i = 0; i < rowCount; i++) {
    const row = document.createElement('div');
    rowsArray.push(row);

    const offset = offsetsEm[i] || 0;
    const fillColor = isMicA ? COLOR_MIC_A_FILL : COLOR_MIC_B_FILL;

    Object.assign(row.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) translateY(${offset}em)`,
      fontFamily: `"${FONT_A}", system-ui, sans-serif`,
      textTransform: 'uppercase',
      fontSize: 'min(18vw, 220px)', // base font size
      lineHeight: '1',
      letterSpacing: '0.06em',
      color: fillColor,
      whiteSpace: 'nowrap',
      willChange: 'transform, font-variation-settings',
      fontOpticalSizing: 'none'
    });

    if (isMicA) {
      // Mic A top → SHPE 3
      row.style.fontVariationSettings = `'SHPE' 3, 'wght' 400`;
      row.style.webkitTextStroke = `${MIC_A_MIN_STROKE}px ${COLOR_MIC_A_STROKE}`;
    } else {
      // Mic B bottom → SHPE 1
      row.style.fontVariationSettings = `'SHPE' 1, 'wght' 400`;
      row.style.webkitTextStroke = `0px transparent`;
    }

    row.textContent = word;
    wrapper.appendChild(row);
  }
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

  // Try helpful defaults
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

    statusSpan.html('  Streaming… Mic A → stroke, Mic B → scale');
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

  // Update sensitivity from sliders each frame
  if (sensASlider) {
    sensAFactor = sensASlider.value();
    if (sensALabel) {
      sensALabel.html(`Mic A sensitivity (stroke): ${sensAFactor.toFixed(2)}`);
    }
  }
  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(`Mic B sensitivity (scale): ${sensBFactor.toFixed(2)}`);
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  // AUDIO → DESIGN MAPPING
  updateMicADesign(rmsA); // Mic A: stroke width
  updateMicBDesign(rmsB); // Mic B: scale of both layers
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function updateMicADesign(rmsA) {
  if (!micARows.length) return;

  // Sensitivity multiplier for Mic A
  const effectiveA = rmsA * sensAFactor;

  // Map effective RMS → stroke width (clamped)
  let strokeWidth = map(
    effectiveA,
    MIC_A_MIN_LEVEL,
    MIC_A_MAX_LEVEL,
    MIC_A_MIN_STROKE,
    MIC_A_MAX_STROKE
  );
  strokeWidth = clamp(strokeWidth, MIC_A_MIN_STROKE, MIC_A_MAX_STROKE);

  micARows.forEach(row => {
    row.style.webkitTextStroke = `${strokeWidth.toFixed(2)}px ${COLOR_MIC_A_STROKE}`;
  });
}

function updateMicBDesign(rmsB) {
  // Sensitivity multiplier for Mic B
  const effectiveB = rmsB * sensBFactor;

  // Mic B controls the SCALE of the PINK layer
  let s = map(
    effectiveB,
    SCALE_MIN_LEVEL,
    SCALE_MAX_LEVEL,
    SCALE_MIN,
    SCALE_MAX
  );
  s = clamp(s, SCALE_MIN, SCALE_MAX);

  // White layer stays locked at the quietest scale
  const sWhite = SCALE_MIN; // <<< this keeps quiet-look identical
//   or this
// const sWhite = 1.0;


  if (micBWrapper) {
    // Pink GRATEFUL scales with Mic B like original
    micBWrapper.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  if (micAWrapper) {
    // White GRATEFUL: same offset as original, but fixed scale
    micAWrapper.style.transform =
      `translate(calc(-50% + ${MIC_A_OFFSET_X}), calc(-50% + ${MIC_A_OFFSET_Y})) scale(${sWhite})`;
  }
}


// ===== KEYBOARD HANDLER — TOGGLE PANEL WITH "X" ============================
// Press "x" or "X" to open/close the control panel
function keyPressed() {
  if (key === 'x' || key === 'X') {
    panelVisible = !panelVisible;
    if (panelVisible) {
      ctrlPanel.show();
    } else {
      ctrlPanel.hide();
    }
  }
   if (key === 'm' || key === 'M'){
    startMicsFromKeyboard();
  }
  
}
// ===========================================================================

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
