// === TWO-MIC VARIABLE FONT — TEXT-ONLY REACTIVE SCENE =======================
// Mic A → Center "GRATEFUL" (WeTravelogueVariableRoman, weight reacts to volume)
// Mic B → (no visual design mapped right now; just available as a second input)
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// NEW: flag to track if panel is visible
let panelVisible = true;

// NEW: sensitivity slider UI + value
let sensSlider, sensLabel;
let micASensitivity = 1.0; // multiplier for Mic A loudness

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeTravelogueVariableRoman'; // Mic A
const FONT_B = 'WeStacksVariable';          // Mic B (kept for future use)
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM elements for text
let micATextEl; // center "GRATEFUL"

// ============================================================================
// === FONT SIZE CONTROLS (EDIT THESE TO CHANGE HOW BIG "GRATEFUL" IS) ========
// Base font size relative to window width.
// Bigger value = generally bigger text. Example: 0.14 → 14% of window width.
let BASE_FONT_RATIO = 0.14;

// Maximum base font size in pixels (cap so it doesn’t get too huge on big screens)
let BASE_FONT_MAX_PX = 160;

// NOTE: size animation is no longer used when X is pressed
// but these are kept here in case you want to reuse later.
let SIZE_ANIM_START_SCALE = 0.3;
let SIZE_ANIM_DURATION_SEC = 10.0;
let SIZE_ANIM_TARGET_SCALE = 1.0;
// ============================================================================

// Layout
let baseSize;

// Internal animation state (no longer triggered by X)
let sizeAnimActive = false;
let sizeAnimStartTime = 0;
let currentSizeScale = 1.0;

// RMS threshold (kept in case you want to reuse later for Mic B)
const MIC_B_THRESHOLD = 0.1;

// ============================================================================
// === FADE TO BLACK CONTROLS (TRIGGERED BY "Z") ==============================
// Duration of fade (seconds)
let FADE_DURATION_SEC = 4.0;

let fadeActive = false;
let fadeStartTime = 0;

// NEW: once this is true, screen stays black forever
let fullyBlack = false;
// ============================================================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  // === BASE FONT SIZE CALCULATION (USES THE CONTROLS ABOVE) ================
  baseSize = Math.min(windowWidth * BASE_FONT_RATIO, BASE_FONT_MAX_PX);
  currentSizeScale = 1.0; // start at original scale

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

  // UPDATED: use togglePanel() instead of directly hiding
  hideBtn.mousePressed(() => {
    togglePanel();
  });

  const topRow = createDiv().parent(ctrlPanel).style('display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan('  Step 1 → Enable Mics').parent(ctrlPanel);

  // Mic pickers
  const row2 = createDiv().parent(ctrlPanel).style('margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;');
  const groupA = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA   = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB   = createSelect().parent(groupB);

  // === NEW: Sensitivity slider row =========================================
  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensLabelText = createSpan('Mic A sensitivity:').parent(row3);
  sensLabelText.style('font-weight:600;');

  // Slider: min 0.2x (less reactive) to 4x (super reactive)
  sensSlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(row3);
// to change mic a default sensitivity : 
// sensSlider = createSlider(0.2, 4.0, 2.0, 0.01).parent(row3);

  sensSlider.style('width:120px;');

  sensLabel = createSpan('×1.00').parent(row3);
  sensLabel.style('min-width:40px; text-align:right;');

  micASensitivity = sensSlider.value();

  sensSlider.input(() => {
    micASensitivity = sensSlider.value();
    sensLabel.html('×' + micASensitivity.toFixed(2));
  });

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

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
    // fontSize is set via applyTextSize()
    lineHeight: '1',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    willChange: 'font-variation-settings, font-stretch, font-size, opacity',
    fontOpticalSizing: 'none',
    fontFamily: `"${FONT_A}", system-ui, sans-serif`,
    color: '#ffffff',
    letterSpacing: '0.04em',
    zIndex: 3
  });
  micATextEl.textContent = 'GRATEFUL';
  micATextEl.style.fontVariationSettings = `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 0`;
  micATextEl.style.fontStretch = '100%';
  micATextEl.style.opacity = '1';

  // Set initial text size based on baseSize and currentSizeScale
  applyTextSize();

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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // Recompute baseSize when the window changes,
  // still using your editable font controls.
  baseSize = Math.min(windowWidth * BASE_FONT_RATIO, BASE_FONT_MAX_PX);
  applyTextSize(); // keep scale + new baseSize in sync
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

    statusSpan.html('  Streaming… Mic A → weight (Mic B reserved, no design mapped)');
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
  background(0); // black background always

  // If we've already finished fading, keep everything black & invisible forever.
  if (fullyBlack) {
    if (micATextEl) micATextEl.style.opacity = '0';
    return;
  }

  // If you ever re-enable size animation, you can hook it here
  if (sizeAnimActive) {
    updateSizeAnimation();
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB); // still measured, but not used visually

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB); // currently does nothing (Mic B visual removed)

  // === FADE TO BLACK ON "Z" ================================================
  if (fadeActive) {
    const elapsedSec = (millis() - fadeStartTime) / 1000;
    let t = clamp(elapsedSec / FADE_DURATION_SEC, 0, 1);

    // Canvas overlay
    noStroke();
    fill(0, t * 255);
    rect(0, 0, width, height);

    // Fade out the white "GRATEFUL" text (DOM element)
    const textOpacity = 1 - t;
    micATextEl.style.opacity = textOpacity.toFixed(3);

    if (t >= 1) {
      fadeActive = false;
      fullyBlack = true;        // <<< lock into black forever
      micATextEl.style.opacity = '0';
    }
  } else {
    // Ensure fully visible when not fading (before the permanent black)
    micATextEl.style.opacity = '1';
  }
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function updateMicADesign(rmsA) {
  // Mic A: controls WEIGHT of center "GRATEFUL"
  // Sensitivity slider multiplies the RMS before mapping.
  const scaled = rmsA * micASensitivity;

  // Map RMS 0..0.25 → wght 100..900, then clamp 200..900
  const wght = clamp(map(scaled, 0, 0.25, 100, 900), 200, 900);

  micATextEl.style.fontVariationSettings =
    `'wght' ${wght.toFixed(1)}, 'wdth' 100, 'slnt' 0, 'ital' 0`;
}

function updateMicBDesign(rmsB) {
  // Intentionally empty — Mic B has no visual design mapped for now.
  // You can use `rmsB` later if you want to add something.
}

// ===== SIZE ANIMATION HELPERS (NOT USED BY X ANYMORE) ======================

function startSizeAnimation() {
  // NOTE: not called from togglePanel anymore.
  sizeAnimActive = true;
  sizeAnimStartTime = millis();
  currentSizeScale = SIZE_ANIM_START_SCALE;
  applyTextSize();
}

function updateSizeAnimation() {
  const elapsedSec = (millis() - sizeAnimStartTime) / 1000;
  const rawT = elapsedSec / SIZE_ANIM_DURATION_SEC;
  const t = clamp(rawT, 0, 1);

  // Smooth easing (ease-out cubic)
  const eased = easeOutCubic(t);

  currentSizeScale = lerp(SIZE_ANIM_START_SCALE, SIZE_ANIM_TARGET_SCALE, eased);
  applyTextSize();

  if (t >= 1) {
    sizeAnimActive = false;
  }
}

// Apply text size based on baseSize × currentSizeScale
function applyTextSize() {
  const px = baseSize * currentSizeScale;
  micATextEl.style.fontSize = `${px.toFixed(1)}px`;
}

// Simple easing function for nicer motion
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ===== PANEL TOGGLE + KEY HANDLER ==========================================

function keyPressed() {
  // X → just toggle panel, NO scale-up animation anymore
  if (key === 'x' || key === 'X') {
    togglePanel();
  }

  // Z → start fade to black (only if not already permanently black)
  if ((key === 'z' || key === 'Z') && !fullyBlack) {
    fadeActive = true;
    fadeStartTime = millis();
  }
}

// This function handles open/close of the control panel.
// NOTE: size animation removed when panel is hidden.
function togglePanel() {
  if (!ctrlPanel) return;

  if (panelVisible) {
    ctrlPanel.hide();
    panelVisible = false;
  } else {
    ctrlPanel.show();
    panelVisible = true;
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

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// using p5.js global map() and lerp()
