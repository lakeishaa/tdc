// === TWO-MIC VARIABLE FONT + DOT GRID SCENE ================================
// Mic A → 12 × "<3" stack (We Spur Outline Variable thin, y-spread by volume)
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
let sensBSlider, sensBLabel;
let micBSensitivity = 1.0; // <<< Mic B: multiplier for Mic B loudness

// Rotation speed slider
let rotSlider, rotLabel;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB; // analyser buffers for A & B

// ====================== FONTS / LAYOUT =====================================

// Fonts (assumes CSS @font-face already set up)
/*
@font-face {
  font-family: "We Spur Outline Variable";
  src: url("./assets/WeSpurOutlineVariable-Thin.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "WeStacksVariable";
  src: url("./assets/WeStacksVariable.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
*/
const FONT_A = 'We Spur Outline Variable'; // Mic A → hearts
const FONT_B = 'WeStacksVariable';        // Mic B → dots
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// Layout
let baseSize;

// ===== GLOBAL TEXT SIZE CONTROL ============================================
// Base size that hearts use: baseSize * TEXT_SIZE_SCALE * HEART_TEXT_SCALE
let TEXT_SIZE_SCALE = 1.0; // <<< MAIN KNOB for overall text size
// ============================================================================

// ====================== MIC A — 12 × "<3" STACK ============================

// Number of "<3" lines in the column
let HEART_COUNT = 12;              // <<< how many "<3" you want

// The actual heart text
const HEART_TEXT = '^o^';          // <<< change text if needed

// Font family used for hearts
const HEART_FONT = FONT_A;         // <<< main font for Mic A

// Extra Mic-A-only scaling on top of TEXT_SIZE_SCALE
let HEART_TEXT_SCALE = 1.0;        // <<< bigger/smaller hearts

// Heart color (same as your "*" script)
const HEART_COLOR = '#64C5D7';     // <<< heart color

// Volume→spacing mapping
let HEART_RMS_MIN = 0.0;           // <<< quiet RMS mapped to min spread
let HEART_RMS_MAX = 0.25;          // <<< loud RMS mapped to max spread

// Vertical spacing between hearts:
// - At quiet, spread = HEART_SPREAD_MIN  (all overlap if 0)
// - At loud,  spread = HEART_SPREAD_MAX  (tall column)
let HEART_SPREAD_MIN = 0;          // <<< px between hearts at quiet (0 = overlap)
let HEART_SPREAD_MAX = 30;         // <<< px between hearts at loud

// NEW: Vertical offset for the whole blue heart stack
// Positive = move DOWN, Negative = move UP
let HEART_Y_OFFSET = 35;            // <<< tweak this, e.g. -120 or +80
// ==========================================================================

// RMS threshold (kept in case you want to reuse later for Mic B logic)
const MIC_B_THRESHOLD = 0.1;

// ====================== MIC B — ROTATING DOT GRID ==========================
// (MATCHED TO YOUR REFERENCE SCRIPT)

// ====== ADJUSTABLE DOT GRID PARAMETERS =====================================

// Master scale for entire dot group size (0.1 small → 1.5 huge)
let GRID_SCALE = 1.3;   // <<< MAIN KNOB — adjust this anytime

// How many horizontal rows of dots
let ROWS = 9; // <<< Mic B dot grid: number of rows

// Base maximum dot size (center row) BEFORE audio scaling
let MAX_SIZE_BASE = 80;   // <<< make this bigger/smaller for overall dot size

// Minimum dot size (outer rows)
let MIN_SIZE = 1;         // <<< tiny outer dots

// How quickly dot size falls off from center rows to outer rows
let CURVE_STEEPNESS = 2;  // <<< higher = more dramatic difference

// Vertical spacing between rows (as fraction of window height)
let H_GAP_SCALE = 0.5;    // <<< lower = rows closer together

// Horizontal spacing range (outer rows → center rows)
let MAX_SPACING = 50;     // <<< spacing for outer rows
let MIN_SPACING = 40;     // <<< spacing for center rows

// How much extra distance beyond the screen corners the grid covers
let GRID_OVERSCAN = 1.1;  // <<< 1.0 = to corners, >1 = extends beyond

// ====== AUDIO → DOT SIZE MAPPING (Mic B) ===================================

// Expected Mic B RMS (volume) range
let RMS_MIN = 0.0;        // <<< Mic B RMS value considered "quiet"
let RMS_MAX = 0.25;       // <<< Mic B RMS value considered "loud"

// Size scaling range applied to MAX_SIZE_BASE
// At quiet → MAX_SIZE_BASE * SIZE_SCALE_MIN
// At loud  → MAX_SIZE_BASE * SIZE_SCALE_MAX
let SIZE_SCALE_MIN = 0.4; // <<< dots at minimum volume ~40% of base
let SIZE_SCALE_MAX = 1.4; // <<< dots at max volume ~140% of base

// ====== ROTATION SETTINGS ===================================================

// Base rotation speed (radians per frame)
let ROT_SPEED_BASE = 0.005; // <<< default rotation speed
let rotationSpeed = ROT_SPEED_BASE;

// Current rotation angle
let angle = 0;

// ============================================================================

function setup() {
  // Make page truly full-screen & centered relative to viewport
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';

  createCanvas(windowWidth, windowHeight);

  // Base size derived from window; will be multiplied by TEXT_SIZE_SCALE
  baseSize = Math.min(windowWidth * 0.5, 400); // bigger base than before

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
  hideBtn.mousePressed(() => { ctrlPanel.hide(); });

  const topRow = createDiv().parent(ctrlPanel)
    .style('display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan('  Step 1 → Enable Mics').parent(ctrlPanel);

  // Mic pickers
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

  // === Mic A Sensitivity slider row ========================================
  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensALabelText = createSpan('Mic A sensitivity:').parent(row3);
  sensALabelText.style('font-weight:600;');

  // Slider: min 0.2x (less reactive) to 4x (super reactive)
  sensASlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(row3);
  sensASlider.style('width:120px;');

  sensALabel = createSpan('×1.00').parent(row3);
  sensALabel.style('min-width:40px; text-align:right;');

  micASensitivity = sensASlider.value();
  sensASlider.input(() => {
    micASensitivity = sensASlider.value();
    sensALabel.html('×' + micASensitivity.toFixed(2));
  });

  // === Mic B Sensitivity slider row ========================================
  const row4 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensBLabelText = createSpan('Mic B sensitivity:').parent(row4);
  sensBLabelText.style('font-weight:600;');

  // Slider: 0.2x to 4x
  sensBSlider = createSlider(0.2, 4.0, 2.0, 0.01).parent(row4);
  sensBSlider.style('width:120px;');

  sensBLabel = createSpan('×2.0').parent(row4);
  sensBLabel.style('min-width:40px; text-align:right;');

  micBSensitivity = sensBSlider.value();
  sensBSlider.input(() => {
    micBSensitivity = sensBSlider.value();
    sensBLabel.html('×' + micBSensitivity.toFixed(2));
  });

  // === Rotation speed slider row ===========================================
  const row5 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const rotLabelText = createSpan('Rotation speed:').parent(row5);
  rotLabelText.style('font-weight:600;');

  // Slider: 0 → 0.1 radians per frame
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
  textAlign(CENTER, CENTER);

  window.addEventListener('beforeunload', cleanupStreams);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.5, 400);
}

// ===== KEYBOARD TOGGLE: 'X' SHOW/HIDE PANEL ================================
function keyPressed() {
  if (key === 'x' || key === 'X') {
    if (ctrlPanel) {
      const disp = ctrlPanel.elt.style.display;
      if (disp === 'none') ctrlPanel.show();
      else ctrlPanel.hide();
    }
  }
  
   if (key === 'm' || key === 'M'){
    startMicsFromKeyboard();
  }
}

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

// ===== MIC ENABLE + DEVICE PICKER (TWO MICS) ================================
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

    statusSpan.html('  Streaming… Mic A → "<3" stack, Mic B → rotating dots');
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

// ===== DRAW LOOP — COMBINED =================================================
function draw() {
  background(0); // black background

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateMicADesign(rmsA); // Mic A → "<3" stack
  updateMicBDesign(rmsB); // Mic B → rotating dot grid
}

// ===== AUDIO → DESIGN MAPPING (MIC A HEART STACK) ==========================
function updateMicADesign(rmsA) {
  // 1) Apply Mic A sensitivity
  const scaled = rmsA * micASensitivity;

  // 2) Map RMS → 0..1 range, then clamp
  let norm = 0;
  if (HEART_RMS_MAX > HEART_RMS_MIN) {
    norm = (scaled - HEART_RMS_MIN) / (HEART_RMS_MAX - HEART_RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  // 3) Map normalized volume → vertical spacing between hearts
  const spread = lerp(HEART_SPREAD_MIN, HEART_SPREAD_MAX, norm);

  // 4) Set text size & font (same size/color logic as your "*" script)
  const txtSize = baseSize * TEXT_SIZE_SCALE * HEART_TEXT_SCALE;
  textFont(HEART_FONT);
  textSize(txtSize);
  fill(HEART_COLOR);
  textAlign(CENTER, CENTER);

  // 5) Compute vertical layout
  const cx = width / 2;

  // Center of the stack + adjustable offset
  const cy = height / 2 + HEART_Y_OFFSET;   // <<< edit HEART_Y_OFFSET up top

  const totalHeight = (HEART_COUNT - 1) * spread;
  const startY = cy - totalHeight / 2;

  // 6) Draw all hearts
  for (let i = 0; i < HEART_COUNT; i++) {
    const y = startY + i * spread;
    text(HEART_TEXT, cx, y);
  }
}

// ===== AUDIO → DESIGN MAPPING (MIC B DOT GRID) =============================
function updateMicBDesign(rmsB) {
  // Sensitivity multiplies RMS
  const scaledB = rmsB * micBSensitivity;

  // Map scaled RMS to a 0..1 normalized value
  let norm = 0;
  if (RMS_MAX > RMS_MIN) {
    norm = (scaledB - RMS_MIN) / (RMS_MAX - RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  // Map normalized volume to size scale (quiet → small, loud → big)
  const sizeScale = lerp(SIZE_SCALE_MIN, SIZE_SCALE_MAX, norm);
  const MAX_SIZE = MAX_SIZE_BASE * sizeScale;

  // Update rotation
  rotationSpeed = rotSlider ? rotSlider.value() : ROT_SPEED_BASE;
  angle += rotationSpeed;

  push();
  translate(width / 2, height / 2);
  rotate(angle);
  scale(GRID_SCALE);   // <<< SCALE ENTIRE DOT GRID GROUP

  fill(255);
  textFont('monospace');
  textAlign(CENTER, CENTER);

  const center = floor((ROWS - 1) / 2);
  const rowGap = (height / (ROWS + 1)) * H_GAP_SCALE;

  // Use half of the canvas diagonal so dots still cover the screen when rotated
  const halfDiag = 0.5 * Math.sqrt(width * width + height * height) * GRID_OVERSCAN;

  for (let r = 0; r < ROWS; r++) {
    const dist = abs(r - center) / center;

    // Gaussian-like falloff per row
    const factor = exp(-CURVE_STEEPNESS * dist * dist);

    const fontSize = lerp(MIN_SIZE, MAX_SIZE, factor);
    textSize(fontSize);

    const y = (r - center) * rowGap;

    // Horizontal spacing per row (slightly fewer dots in middle)
    const spacing = lerp(MAX_SPACING, MIN_SPACING, factor);

    // Draw dots across the full diagonal span so rotation never exposes gaps
    for (let x = -halfDiag; x <= halfDiag; x += spacing) {
      text(".", x, y);
    }
  }

  pop();
}

// ===== HELPERS ==============================================================

function analyserRMS(analyser, buf) {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(buf);
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return Math.sqrt(sumSq / buf.length);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// p5's map() is used globally
