// === TWO-MIC SCENE — BLUE WAVE (Mic A) + "same drugs" BACKGROUND ==========
// Visual:
//   - Background: scattered letters made from "same drugs"
//       • Always: 4 base letters "s a m e" at fixed positions
//       • Extra: up to 62 extra letters from "same drugs", with collision-avoidance
//   - Foreground: Mic A blue audio waveform line in #B2E2EB on the canvas
//
// Mic A controls:
//   - Blue waveform on canvas
//   - How many extra letters appear (0 → 62)
//   - Letter size (scale): louder => smaller
//
// Mic B controls:
//   - Font weight (wght axis) of ALL "same drugs" letters
//
// All text: purple, italic, lowercase, WeAppealVariable
// Panel:
//   - Enable Mics
//   - Mic A / Mic B selectors
//   - Mic A sensitivity (scale & extra-count)
//   - Mic B sensitivity (weight)
//   - X to toggle panel
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

// Canvas element (so we can layer it)
let canvasEl;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeAppealVariable'; // letters visual
const FONT_B = 'WeAppealVariable'; // just for loading; both same
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// Mic A scattered letters
let micALettersWrapper;
let micABaseLetters = [];   // 4 "s a m e" at fixed positions
let micAExtraLetters = [];  // up to 62 extra letters
const MIC_A_EXTRA_MAX   = 62;
const MIC_A_EXTRA_CHARS = ['s','a','m','e','d','r','u','g','s']; // "same drugs"

// Layout
let baseSize;

// Sensitivity (controlled by sliders)
let sensAFactor   = 2.63; // Mic A sensitivity for scale & extra-count
let sensBFactor   = 4.0;  // Mic B sensitivity for weight

// Slider + label elements
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;
let micBRMSLabel; // live Mic B volume readout (optional, for debugging)

// Shared color
const PURPLE = '#AD95C3';

// Scale behavior for Mic A letters (volume → size)
// quiet → scaleMax, loud → scaleMin
const SCALE_MAX = 1.0;  // at very low volume (biggest)
const SCALE_MIN = 0.4;  // at high volume (smallest)

// === WAVE SETTINGS (Mic A blue waveform) ====================================
const MIC_A_WAVE_COLOR = '#B2E2EB'; // blue wave
let WAVE_CENTER_Y_RATIO = 0.5;      // <<< EDIT: 0.5 = middle of screen
let BASE_WAVE_HEIGHT    = 120;      // <<< EDIT: base wave height in px

function setup() {
  canvasEl = createCanvas(windowWidth, windowHeight);
  canvasEl.style('position', 'relative');
  canvasEl.style('z-index', '2');
  // Black page background, but canvas itself is transparent (via clear())
  document.body.style.backgroundColor = '#000';

  baseSize = Math.min(windowWidth * 0.14, 160);

  // Preallocate analyser buffers
  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  // ===== Control Panel ======================================================
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

  statusSpan = createSpan('  step 1 → enable mics').parent(ctrlPanel);

  // Mic pickers
  const row2 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;');
  const groupA = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('mic a:').parent(groupA).style('font-weight:600; text-transform:lowercase;');
  selA   = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('mic b:').parent(groupB).style('font-weight:600; text-transform:lowercase;');
  selB   = createSelect().parent(groupB);

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // === Sliders for sensitivity =============================================
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  // Mic A sensitivity slider
  sensALabel = createSpan(`mic a sensitivity (scale & extra letters): ${sensAFactor.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600; text-transform:lowercase;');

  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01)
    .parent(sensRow);
  sensASlider.style('width', '160px');

  // Mic B weight sensitivity slider
  sensBLabel = createSpan(
    `mic b sensitivity (weight): ${sensBFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600; text-transform:lowercase;');

  sensBSlider = createSlider(0.5, 8, sensBFactor, 0.1)
    .parent(sensRow);
  sensBSlider.style('width', '160px');

  // Live Mic B RMS label (optional)
  micBRMSLabel = createSpan(
    `mic b volume (rms): 0.000 — controls "same drugs" weight`
  ).parent(sensRow).style('text-transform:lowercase;');

  // ===== Mic A scattered letters (s a m e + 62 extra) ======================
  createMicALetters();

  // ===== Font loading (best-effort) ========================================
  if (document.fonts && document.fonts.load) {
    Promise.all(fontFamilies.map(f => document.fonts.load(`700 1em "${f}"`)))
      .then(() => { fontsReady = true; })
      .catch(() => { fontsReady = true; });
  } else {
    fontsReady = true;
  }

  textFont('monospace');

  window.addEventListener('beforeunload', cleanupStreams);
}

function createMicALetters() {
  if (micALettersWrapper) micALettersWrapper.remove();

  micALettersWrapper = document.createElement('div');
  micALettersWrapper.id = 'micALettersWrapper';
  document.body.appendChild(micALettersWrapper);
  Object.assign(micALettersWrapper.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    // zIndex 0 so the p5 canvas (z-index 2) is on top
    zIndex: 0
  });

  micABaseLetters = [];
  micAExtraLetters = [];

  // Base 4 letters "s a m e" at specified positions (all lowercase)
  const baseConfigs = [
    { ch: 's', x: 25, y: 50 },
    { ch: 'a', x: 43, y: 25 },
    { ch: 'm', x: 54, y: 75 },
    { ch: 'e', x: 70, y: 46 },
  ];

  const baseFontPx  = 36; // base size for s/a/m/e
  const extraFontPx = 36; // base size for extra letters

  const placed = []; // all placed spans (base + extra) for collision

  baseConfigs.forEach(cfg => {
    const span = document.createElement('span');
    span.textContent = cfg.ch.toLowerCase();
    Object.assign(span.style, {
      position: 'absolute',
      left: `${cfg.x}%`,
      top: `${cfg.y}%`,
      transform: 'translate(-50%, -50%)',
      fontFamily: `"${FONT_A}", system-ui, sans-serif`,
      fontSize: `${baseFontPx}px`,
      color: PURPLE,
      fontStyle: 'italic',
      letterSpacing: '0em',
      opacity: 1,
      fontVariationSettings: `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 1`
    });

    // store base size + logical position for collision
    span.dataset.baseSizePx = String(baseFontPx);
    span.dataset.x = String(cfg.x);
    span.dataset.y = String(cfg.y);

    micALettersWrapper.appendChild(span);
    micABaseLetters.push(span);
    placed.push(span);
  });

  // Extra 62 letters of "same drugs" with collision-avoidance
  for (let i = 0; i < MIC_A_EXTRA_MAX; i++) {
    const span = document.createElement('span');
    const ch = MIC_A_EXTRA_CHARS[i % MIC_A_EXTRA_CHARS.length];
    span.textContent = ch.toLowerCase();

    // find a free spot in the grid
    const pos = placeNonOverlappingLetter(placed, 55); // spacing in pixels
    span.dataset.x = String(pos.x);
    span.dataset.y = String(pos.y);

    Object.assign(span.style, {
      position: 'absolute',
      left: `${pos.x}%`,
      top: `${pos.y}%`,
      transform: 'translate(-50%, -50%)',
      fontFamily: `"${FONT_A}", system-ui, sans-serif`,
      fontSize: `${extraFontPx}px`,
      color: PURPLE,
      fontStyle: 'italic',
      letterSpacing: '0em',
      opacity: 0,
      transition: 'opacity 0.25s ease-out',
      fontVariationSettings: `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 1`
    });

    span.dataset.baseSizePx = String(extraFontPx);

    micALettersWrapper.appendChild(span);
    micAExtraLetters.push(span);
    placed.push(span);
  }
}

// collision-free placement helper for Mic A letters
function placeNonOverlappingLetter(existing, minDistPx) {
  // Try up to 60 attempts to find a free position
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = 10 + Math.random() * 80; // 10–90%
    const y = 10 + Math.random() * 80; // 10–90%

    let ok = true;
    for (const el of existing) {
      const ex = parseFloat(el.dataset.x);
      const ey = parseFloat(el.dataset.y);

      const dx = (x - ex) * window.innerWidth  / 100;
      const dy = (y - ey) * window.innerHeight / 100;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistPx) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return { x, y };
    }
  }

  // fallback (no perfect spot found)
  return { x: 50, y: 50 };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
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
}

// ===== MIC ENABLE + DEVICE PICKER ==========================================
async function enableMicsOnce() {
  try {
    if (typeof userStartAudio === 'function') await userStartAudio();
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await loadAudioInputs();

    [selA, selB, startBtn].forEach(el => el.removeAttribute('disabled'));
    statusSpan.html(`  step 2 → pick mic a & mic b, then click start`);
  } catch (e) {
    console.error(e);
    statusSpan.html('  permission error — use https & allow mic access.');
  }
}

async function loadAudioInputs() {
  selA.elt.innerHTML = '';
  selB.elt.innerHTML = '';

  const all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter(d => d.kind === 'audioinput');

  if (devices.length === 0) {
    statusSpan.html('  no audio inputs found — check system settings → sound → input.');
    return;
  }

  devices.forEach(d => {
    const label = d.label || `mic (${d.deviceId.slice(0,6)})`;
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
  if (!idA || !idB) return statusSpan.html('  select two devices first.');
  if (idA === idB) return statusSpan.html('  pick two different devices.');

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

    statusSpan.html('  streaming… mic a → blue wave + extra count/scale, mic b → weight');
    loop();
  } catch (e) {
    console.error(e);
    statusSpan.html('  couldn’t start both — another app may be using a mic.');
  }
}

function cleanupStreams() {
  [streamA, streamB].forEach(s => { if (s) s.getTracks().forEach(t => t.stop()); });
  streamA = streamB = null;
  anA = anB = null;
}

// ===== DRAW LOOP — BLUE WAVE + TEXT BACKGROUND =============================
function draw() {
  // Transparent canvas: reveals "same drugs" DOM letters behind
  clear();
  blendMode(BLEND);

  // Read slider values each frame and update globals + labels
  if (sensASlider) {
    sensAFactor = sensASlider.value();
    if (sensALabel) {
      sensALabel.html(`mic a sensitivity (scale & extra letters): ${sensAFactor.toFixed(2)}`);
    }
  }

  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(
        `mic b sensitivity (weight): ${sensBFactor.toFixed(2)}`
      );
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  // Draw Mic A blue waveform
  const centerY = height * WAVE_CENTER_Y_RATIO; // <<< change this to move wave up/down
  drawWaveFromAnalyser(
    anA,
    bufA,
    MIC_A_WAVE_COLOR,
    centerY,
    BASE_WAVE_HEIGHT // <<< change this to make wave taller/shorter
  );

  // Update live Mic B volume label
  if (micBRMSLabel) {
    micBRMSLabel.html(
      `mic b volume (rms): ${rmsB.toFixed(3)} — controls "same drugs" weight`
    );
  }

  // Map audio → design
  updateMicADesign(rmsA);   // Mic A → extra letters + scale
  updateMicBWeight(rmsB);   // Mic B → font weight only
}

// ===== AUDIO → DESIGN MAPPING (TEXT) =======================================

// Mic A → extra letters + scale
function updateMicADesign(rmsA) {
  const adjusted = rmsA * sensAFactor;

  // EXTRA LETTER COUNT (0 → 62 based on volume)
  const norm = clamp(adjusted / 0.25, 0, 1);
  const extraCount = Math.round(norm * MIC_A_EXTRA_MAX);

  for (let i = 0; i < micAExtraLetters.length; i++) {
    micAExtraLetters[i].style.opacity = i < extraCount ? '1' : '0';
  }

  // SCALE: higher volume → smaller text
  // norm 0 → SCALE_MAX; norm 1 → SCALE_MIN
  const scaleFactor = SCALE_MAX + (SCALE_MIN - SCALE_MAX) * norm;

  // Update font-size for all Mic A letters based on baseSizePx * scaleFactor
  for (const span of [...micABaseLetters, ...micAExtraLetters]) {
    const basePx = parseFloat(span.dataset.baseSizePx || '24');
    const newSize = basePx * scaleFactor;
    span.style.fontSize = `${newSize}px`;
  }
}

// Mic B → font weight only
function updateMicBWeight(rmsB) {
  const adjustedB = rmsB * sensBFactor;
  let wghtB = map(adjustedB, 0, 0.25, 100, 900);
  wghtB = clamp(wghtB, 200, 900);

  const fv =
    `'wght' ${wghtB.toFixed(1)}, ` +
    `'wdth' 100, 'slnt' 0, 'ital' 1`;

  for (const span of [...micABaseLetters, ...micAExtraLetters]) {
    span.style.fontVariationSettings = fv;
  }
}

// ===== WAVE DRAWING (Mic A) ================================================
function drawWaveFromAnalyser(analyser, buffer, strokeColor, centerY, amplitudePx) {
  if (!analyser) return;

  analyser.getFloatTimeDomainData(buffer);

  stroke(strokeColor);
  noFill();
  strokeWeight(2); // <<< change this for thicker/thinner line

  beginShape();
  const len = buffer.length;
  for (let i = 0; i < len; i++) {
    const x = map(i, 0, len - 1, 0, width);
    const y = centerY + buffer[i] * amplitudePx;
    vertex(x, y);
  }
  endShape();
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
