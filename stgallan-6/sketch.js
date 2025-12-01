// === TWO-MIC VARIABLE FONT + DOT GRID SCENE ================================
// Mic A → 5 columns of "/" (equalizer-style, bottom aligned, audio reactive)
// Mic B → Rotating audio-reactive dot grid ('.' size + rotation)
// ============================================================================

// ================== PANEL & AUDIO GLOBALS (BOTH MICS) ======================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Mic A sensitivity slider UI + value
let sensASlider, sensALabel;
let micASensitivity = 1.0; // <<< Mic A: multiplier for Mic A loudness

// Mic B sensitivity slider UI + value
let sensBSilder, sensBLabel;
let micBSensitivity = 1.0; // <<< Mic B: multiplier for Mic B loudness

// Rotation speed slider
let rotSlider, rotLabel;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB; // analyser buffers for A & B

// ====================== FONTS / LAYOUT =====================================

const FONT_A = 'WeSpoliaVariable'; // Mic A → "/" columns
const FONT_B = 'WeStacksVariable'; // Mic B → dots
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// Layout
let baseSize;

// ===== GLOBAL TEXT SIZE CONTROL ============================================
let TEXT_SIZE_SCALE = 1.0; // <<< global text-size knob
// ============================================================================


// ====================== MIC A — SLASH COLUMNS (EQUALIZER STYLE) ============

const MIC_A_CHAR = '/'; // <<< character for Mic A

let MIC_A_FONT_WEIGHT = 40;       // <<< weight value (WeSpoliaVariable axis)
let MIC_A_TEXT_SIZE_SCALE = 1.5;  // <<< text size knob for "/"
let MIC_A_BOTTOM_OFFSET = 10;     // <<< LOWER VALUE = closer to bottom
let MIC_A_BASELINE_OFFSET = 200;  // <<< bigger = lower "/" visually

// Number of columns
let NUM_COLS = 5; // <<< set how many columns you want

// X-span across the screen (fractions of width)
let COL_X_MIN_FRAC = 0.05; // <<< leftmost column base position
let COL_X_MAX_FRAC = 0.95; // <<< rightmost column base position

// NEW: global horizontal offset for all Mic A columns
// Negative = shift left, Positive = shift right
let MIC_A_X_OFFSET_FRAC = -0.04; // <<< try -0.03, -0.1, etc.

// Per-column row counts
let COL_ROWS = [
  7,   // Column 0
  10,  // Column 1
  13,  // Column 2
  16,  // Column 3
  19   // Column 4
];

// Per-column max heights as fraction of screen height
let COL_MAX_HEIGHT_RATIOS = [
  0.20, // Col 0
  0.40, // Col 1
  0.60, // Col 2
  0.75, // Col 3
  0.90  // Col 4
];

let MIC_A_RMS_MIN = 0.0;
let MIC_A_RMS_MAX = 0.25;

const MIC_A_COLOR = "#B2E2EA";

// ==========================================================================

const MIC_B_THRESHOLD = 0.1;

// ====================== MIC B — ROTATING DOT GRID ==========================

// Master scale for entire dot group size (0.1 small → 1.5 huge)
let GRID_SCALE = 1.3;

// How many horizontal rows of dots
let ROWS = 39;

// Base maximum dot size (center row) BEFORE audio scaling
let MAX_SIZE_BASE = 180;

// Minimum dot size (outer rows)
let MIN_SIZE = 1;

// How quickly dot size falls off from center rows to outer rows
let CURVE_STEEPNESS = 2;

// Vertical spacing between rows (as fraction of window height)
let H_GAP_SCALE = 0.8;

// Horizontal spacing range (outer rows → center rows)
let MAX_SPACING = 80;
let MIN_SPACING = 15;

// How much extra distance beyond the screen corners the grid covers
let GRID_OVERSCAN = 1.1;

// Audio → dot size
let RMS_MIN = 0.0;
let RMS_MAX = 0.25;
let SIZE_SCALE_MIN = 0.4;
let SIZE_SCALE_MAX = 1.4;

// Rotation
let ROT_SPEED_BASE = 0.005;
let rotationSpeed = ROT_SPEED_BASE;
let angle = 0;

// ============================================================================

function setup() {
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';

  createCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.5, 400);

  // Panel
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
  hideBtn.mousePressed(() => { ctrlPanel.hide(); });

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

  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensALabelText = createSpan('Mic A sensitivity:').parent(row3);
  sensALabelText.style('font-weight:600;');

  sensASlider = createSlider(0.2, 4.0, 0.7, 0.01).parent(row3);
  sensASlider.style('width:120px;');

  sensALabel = createSpan('×0.7').parent(row3);
  sensALabel.style('min-width:40px; text-align:right;');

  micASensitivity = sensASlider.value();
  sensASlider.input(() => {
    micASensitivity = sensASlider.value();
    sensALabel.html('×' + micASensitivity.toFixed(2));
  });

  const row4 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensBLabelText = createSpan('Mic B sensitivity:').parent(row4);
  sensBLabelText.style('font-weight:600;');

  sensBSilder = createSlider(0.2, 4.0, 0.7, 0.01).parent(row4);
  sensBSilder.style('width:120px;');

  sensBLabel = createSpan('×0.7').parent(row4);
  sensBLabel.style('min-width:40px; text-align:right;');

  micBSensitivity = sensBSilder.value();
  sensBSilder.input(() => {
    micBSensitivity = sensBSilder.value();
    sensBLabel.html('×' + micBSensitivity.toFixed(2));
  });

  const row5 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const rotLabelText = createSpan('Rotation speed:').parent(row5);
  rotLabelText.style('font-weight:600;');

  rotSlider = createSlider(0.0, 0.1, ROT_SPEED_BASE, 0.001).parent(row5);
  rotSlider.style('width:120px;');

  rotLabel = createSpan(ROT_SPEED_BASE.toFixed(3)).parent(row5);
  rotLabel.style('min-width:40px; text-align:right;');

  rotSlider.input(() => {
    rotationSpeed = rotSlider.value();
    rotLabel.html(rotationSpeed.toFixed(3));
  });

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

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
  textAlign(CENTER, CENTER);

  window.addEventListener('beforeunload', cleanupStreams);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.5, 400);
}

function keyPressed() {
  if (key === 'x' || key === 'X') {
    if (ctrlPanel) {
      const disp = ctrlPanel.elt.style.display;
      if (disp === 'none') ctrlPanel.show();
      else ctrlPanel.hide();
    }
  }
}

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

    const cA = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: idA } }, video: false });
    const cB = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: idB } }, video: false });

    streamA = cA; streamB = cB;
    const srcA = ctx.createMediaStreamSource(streamA);
    const srcB = ctx.createMediaStreamSource(streamB);

    anA = ctx.createAnalyser();
    anB = ctx.createAnalyser();
    anA.fftSize = 1024;
    anB.fftSize = 1024;

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html('  Streaming… Mic A → "/" columns, Mic B → rotating dots');
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

function draw() {
  background(0);

  const rmsB = analyserRMS(anB, bufB);
  const rmsA = analyserRMS(anA, bufA);


  updateMicBDesign(rmsB);
  updateMicADesign(rmsA);
}

// ===== Mic A — "/" columns ==================================================
function updateMicADesign(rmsA) {
  const scaled = rmsA * micASensitivity;

  let norm = 0;
  if (MIC_A_RMS_MAX > MIC_A_RMS_MIN) {
    norm = (scaled - MIC_A_RMS_MIN) / (MIC_A_RMS_MAX - MIC_A_RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  const txtSize = baseSize * TEXT_SIZE_SCALE * MIC_A_TEXT_SIZE_SCALE;
  const ctx = drawingContext;

  ctx.save();
  ctx.font = `normal ${MIC_A_FONT_WEIGHT} ${txtSize}px "${FONT_A}"`;
  ctx.fillStyle = MIC_A_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const bottomY = height - MIC_A_BOTTOM_OFFSET;

  function drawColumn(xFrac, rowCount, maxHeightRatio) {
    if (rowCount <= 0) return;

    // Apply global horizontal offset here
    const x = width * (xFrac + MIC_A_X_OFFSET_FRAC);
    const maxHeight = maxHeightRatio * height;

    const step = (rowCount > 1) ? (maxHeight / (rowCount - 1)) : 0;

    for (let i = 0; i < rowCount; i++) {
      const offset = step * i * norm;
      const y = bottomY - offset + MIC_A_BASELINE_OFFSET;
      ctx.fillText(MIC_A_CHAR, x, y);
    }
  }

  for (let c = 0; c < NUM_COLS; c++) {
    const t = (NUM_COLS === 1) ? 0.5 : c / (NUM_COLS - 1);
    const xFrac = lerp(COL_X_MIN_FRAC, COL_X_MAX_FRAC, t);

    const rows = COL_ROWS[c % COL_ROWS.length];
    const maxRatio = COL_MAX_HEIGHT_RATIOS[c % COL_MAX_HEIGHT_RATIOS.length];

    drawColumn(xFrac, rows, maxRatio);
  }

  ctx.restore();
}

// ===== Mic B — rotating dot grid ===========================================
function updateMicBDesign(rmsB) {
  const scaledB = rmsB * micBSensitivity;

  let norm = 0;
  if (RMS_MAX > RMS_MIN) {
    norm = (scaledB - RMS_MIN) / (RMS_MAX - RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  const sizeScale = lerp(SIZE_SCALE_MIN, SIZE_SCALE_MAX, norm);
  const MAX_SIZE = MAX_SIZE_BASE * sizeScale;

  rotationSpeed = rotSlider ? rotSlider.value() : ROT_SPEED_BASE;
  angle += rotationSpeed;

  push();
  translate(width / 2, height / 2);
  rotate(angle);
  scale(GRID_SCALE);

  fill(255);
  textFont('monospace');
  textAlign(CENTER, CENTER);

  const center = floor((ROWS - 1) / 2);
  const rowGap = (height / (ROWS + 1)) * H_GAP_SCALE;
  const halfDiag = 0.5 * Math.sqrt(width * width + height * height) * GRID_OVERSCAN;

  for (let r = 0; r < ROWS; r++) {
    const dist = abs(r - center) / center;
    const factor = exp(-CURVE_STEEPNESS * dist * dist);

    const fontSize = lerp(MIN_SIZE, MAX_SIZE, factor);
    textSize(fontSize);

    const y = (r - center) * rowGap;
    const spacing = lerp(MAX_SPACING, MIN_SPACING, factor);

    for (let x = -halfDiag; x <= halfDiag; x += spacing) {
      text(".", x, y);
    }
  }

  pop();
}

// ===== Helpers ==============================================================
function analyserRMS(analyser, buf) {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return Math.sqrt(sumSq / buf.length);
}
