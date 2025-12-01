// === TWO-MIC VARIABLE FONT — SINGLE JAZZ OVERLAP SCENE =====================
// Mic A → Top "JAZZ" (WeSpoliaVariable, white fill;
//          louder = thicker *outer* black stroke via text-shadow)
// Mic B → Bottom "JAZZ" (WeSpoliaExplodeVariable, pink/purple;
//          louder = larger scale from center + more EXPL axis;
//          when loud enough, color toggles ONCE (pink ↔ purple)
//          with a 1s cooldown, and stays that color until the next loud hit)
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
const FONT_A = 'WeSpoliaVariable';
const FONT_B = 'WeSpoliaExplodeVariable';
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM
let micAWrapper, micBWrapper;
let micARows = [];
let micBRows = [];

// ===== Mic A stroke settings ===============================================

const MIC_A_MIN_LEVEL   = 0.01;
const MIC_A_MAX_LEVEL   = 0.50;
const MIC_A_MIN_STROKE  = 0.0;
const MIC_A_MAX_STROKE  = 12.0;   // stroke at loudest (px)

// ===== Mic B scale & color settings ========================================

const SCALE_MIN_LEVEL   = 0.00;
const SCALE_MAX_LEVEL   = 0.30;

const SCALE_MIN         = 1.0;
const SCALE_MAX         = 3.0;

const COLOR_MIC_A_FILL   = '#FFFFFF';
const COLOR_MIC_B_ALT_1  = '#E2BAFF'; // purple-ish
const COLOR_MIC_B_ALT_2  = '#FBAFCE'; // pink

// volume threshold to *trigger* color change
const MIC_B_COLOR_THRESHOLD = 0.18;

// cooldown between color toggles (ms)
const MIC_B_COOLDOWN_MS = 1000;

// color toggle state
let micBColorToggle = false;              // false → ALT_2, true → ALT_1
let micBLastToggleTime = 0;               // millis() of last toggle

// sensitivities
let sensAFactor = 1.0;
let sensBFactor = 1.0;
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;

// ===== Mic B EXPL axis settings ============================================

const EXPL_AXIS       = "EXPL"; // confirmed axis tag
const EXPL_MIN_LEVEL  = 0.00;   // input volume lower bound
const EXPL_MAX_LEVEL  = 0.30;   // input volume upper bound (tweak)
const EXPL_MIN        = 0.0;    // axis min
const EXPL_MAX        = 100.0;  // axis max (tweak to taste)

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

  sensALabel = createSpan(
    `Mic A sensitivity (stroke): ${sensAFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');
  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01).parent(sensRow);
  sensASlider.style('width', '160px');

  sensBLabel = createSpan(
    `Mic B sensitivity (scale + color + EXPL): ${sensBFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');
  sensBSlider = createSlider(0.5, 5, sensBFactor, 0.01).parent(sensRow);
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
  const word = 'JAZZ';

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
    row.style.fontVariationSettings = `"wght" 400`;
  } else {
    // Mic B starts with EXPL = 0
    row.style.fontVariationSettings = `"wght" 400, "${EXPL_AXIS}" 0`;
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

    statusSpan.html('  Streaming… Mic A → stroke, Mic B → scale + EXPL + color toggle');
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
    sensALabel.html(`Mic A sensitivity (stroke): ${sensAFactor.toFixed(2)}`);
  }
  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    sensBLabel.html(`Mic B sensitivity (scale + color + EXPL): ${sensBFactor.toFixed(2)}`);
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ===== AUDIO → DESIGN MAPPING ===============================================

function updateMicADesign(rmsA) {
  if (!micARows.length) return;

  const effectiveA = rmsA * sensAFactor;

  let strokeWidth = map(
    effectiveA,
    MIC_A_MIN_LEVEL,
    MIC_A_MAX_LEVEL,
    MIC_A_MIN_STROKE,
    MIC_A_MAX_STROKE
  );
  strokeWidth = clamp(strokeWidth, MIC_A_MIN_STROKE, MIC_A_MAX_STROKE);

  micARows.forEach(row => {
    applyOuterStroke(row, strokeWidth);
  });
}

function updateMicBDesign(rmsB) {
  if (!micBWrapper) return;

  const effectiveB = rmsB * sensBFactor;

  // Scale from center
  let s = map(
    effectiveB,
    SCALE_MIN_LEVEL,
    SCALE_MAX_LEVEL,
    SCALE_MIN,
    SCALE_MAX
  );
  s = clamp(s, SCALE_MIN, SCALE_MAX);
  micBWrapper.style.transform = `translate(-50%, -50%) scale(${s})`;

  // Top stays fixed scale
  if (micAWrapper) {
    micAWrapper.style.transform = `translate(-50%, -50%) scale(1)`;
  }

  // Color toggling with 1s cooldown.
  if (effectiveB > MIC_B_COLOR_THRESHOLD) {
    const now = millis();
    if (now - micBLastToggleTime >= MIC_B_COOLDOWN_MS) {
      micBColorToggle = !micBColorToggle;
      micBLastToggleTime = now;
    }
  }

  const currentColor = micBColorToggle ? COLOR_MIC_B_ALT_1 : COLOR_MIC_B_ALT_2;

  // Map volume → EXPL axis
  let explVal = map(
    effectiveB,
    EXPL_MIN_LEVEL,
    EXPL_MAX_LEVEL,
    EXPL_MIN,
    EXPL_MAX
  );
  explVal = clamp(explVal, EXPL_MIN, EXPL_MAX);

  micBRows.forEach(row => {
    row.style.color = currentColor;
    row.style.fontVariationSettings =
      `"wght" 400, "${EXPL_AXIS}" ${explVal.toFixed(1)}`;
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
