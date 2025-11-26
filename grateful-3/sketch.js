// === TWO-MIC VARIABLE FONT — DOT REACTIVE SCENE ============================
// Both Mic A & Mic B → WeStacksVariable
// Mic A → Center "." (SHPE: loud → 1, quiet → 3, very big)
// Mic B → Many pink "." in middle 1/3 screen, random positions, ticker to the
//         right with constant speed, SHPE mapped same as Mic A
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeStacksVariable';
const FONT_B = 'WeStacksVariable';
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM elements for text
let micATextEl;          // center "."
let micBWrapper = null;  // container for Mic B dots
let micBDots = [];       // { elt, x, y }

let baseSize;

// Audio → shape mapping parameters
const RMS_MAX = 0.15;    // base sensitivity (higher = less sensitive)
const SHAPE_MIN = 1;     // loud
const SHAPE_MAX = 5;     // quiet

// Sensitivity for Mic A & B (multipliers)
let sensAFactor = 1.0;
let sensBFactor = 1.0;

// Slider + labels
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;

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

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // ===== Sensitivity sliders ===============================================
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  // Mic A sensitivity
  sensALabel = createSpan(`Mic A sensitivity (center dot): ${sensAFactor.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600;');

  // 0.5–5 is a nice play range
  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01)
    .parent(sensRow);
  sensASlider.style('width', '160px');

  // Mic B sensitivity
  sensBLabel = createSpan(`Mic B sensitivity (ticker dots): ${sensBFactor.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600;');

  sensBSlider = createSlider(0.5, 5, sensBFactor, 0.01)
    .parent(sensRow);
  sensBSlider.style('width', '160px');

  // ===== Central text for Mic A (single BIG ".") ============================
  micATextEl = document.getElementById('micAText');
  if (!micATextEl) {
    micATextEl = document.createElement('div');
    micATextEl.id = 'micAText';
    document.body.appendChild(micATextEl);
  }
  Object.assign(micATextEl.style, {
    position: 'fixed',
    left: '50%',
    top: '10%',
    transform: 'translate(-50%, -50%)',
    fontSize: `${(baseSize * 7).toFixed(1)}px`,
    fontFamily: `"${FONT_A}", system-ui, sans-serif`,
    color: '#ffffff',
    willChange: 'font-variation-settings',
    zIndex: 3
  });

  micATextEl.textContent = '.';
  micATextEl.style.fontVariationSettings = `'SHPE' ${SHAPE_MAX}`; // quiet default

  // ===== Dots for Mic B in middle 1/3 of screen ============================
  createMicBDots();

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

function createMicBDots(count = 80) {
  if (micBWrapper) micBWrapper.remove();

  micBWrapper = document.createElement('div');
  micBWrapper.id = 'micBWrapper';
  document.body.appendChild(micBWrapper);

  Object.assign(micBWrapper.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: 2, // under micAText, above canvas
    overflow: 'hidden'
  });

  micBDots = [];

  const h = windowHeight;
  const yMin = h / 4;
  const yMax = (2 * h) / 3;

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = '.';
    Object.assign(span.style, {
      position: 'absolute',
      fontFamily: `"${FONT_B}", system-ui, sans-serif`,
      fontSize: 'min(18vw, 108px)',
      color: '#ff7ac8',
      willChange: 'transform, font-variation-settings'
    });

    let x = Math.random() * windowWidth;
    let y = yMin + Math.random() * (yMax - yMin);

    span.style.transform = `translate(${x}px, ${y}px)`;
    span.style.fontVariationSettings = `'SHPE' ${SHAPE_MAX}`;

    micBWrapper.appendChild(span);
    micBDots.push({ elt: span, x, y });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);
  micATextEl.style.fontSize = `${(baseSize * 7).toFixed(1)}px`;

  // Recreate dots to stay in the middle 1/3 of the new window
  createMicBDots(micBDots.length || 80);
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

    statusSpan.html('  Streaming… Mic A → center dot, Mic B → ticker dots');
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

  // Read slider values every frame and update labels
  if (sensASlider) {
    sensAFactor = sensASlider.value();
    if (sensALabel) {
      sensALabel.html(`Mic A sensitivity (center dot): ${sensAFactor.toFixed(2)}`);
    }
  }
  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(`Mic B sensitivity (ticker dots): ${sensBFactor.toFixed(2)}`);
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function audioToShape(effectiveRms) {
  // Map (scaled) RMS 0..RMS_MAX → SHAPE_MAX..SHAPE_MIN (quiet → 5, loud → 1)
  const s = map(effectiveRms, 0, RMS_MAX, SHAPE_MAX, SHAPE_MIN);
  return clamp(s, SHAPE_MIN, SHAPE_MAX);
}

function updateMicADesign(rmsA) {
  // Apply Mic A sensitivity
  const effective = rmsA * sensAFactor;
  const shape = audioToShape(effective);
  micATextEl.style.fontVariationSettings = `'SHPE' ${shape.toFixed(2)}`;
}

function updateMicBDesign(rmsB) {
  // Apply Mic B sensitivity
  const effective = rmsB * sensBFactor;
  const shape = audioToShape(effective);

  // Apply shape to all dots
  for (const d of micBDots) {
    d.elt.style.fontVariationSettings = `'SHPE' ${shape.toFixed(2)}`;
  }

  // Ticker movement to the right with CONSTANT speed (not audio-reactive)
  const speed = 3; // tweak this if you want faster/slower overall

  const w = windowWidth;
  for (const d of micBDots) {
    d.x += speed;
    if (d.x > w + 20) {
      d.x = -20; // wrap from left
    }
    d.elt.style.transform = `translate(${d.x}px, ${d.y}px)`;
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
// using p5.js global map()
