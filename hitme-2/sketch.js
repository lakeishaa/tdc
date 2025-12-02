// === TWO-MIC VARIABLE FONT — "HIT ME" CENTER + RADIAL BURST SCENE =========
// Mic A → Center "HIT ME" (WeSuperGolfVariable, white; fixed scale,
//          weight- + width-reactive (NO BLACK STROKE ANYMORE))
// Mic B → 10 extra "HIT ME" texts, same center + size as Mic A,
//          in pastel colors; at quiet volume all stacked in the middle,
//          and as volume increases they spread out radially from center.
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// === PANEL VISIBILITY FLAG (X to toggle) ===================================
let panelVisible = true; // true = panel shown, false = hidden
// ============================================================================

let devices = [];
let streamA = null, streamB = null;
let anA, anB;
let bufA, bufB;

// Font (assumes CSS @font-face already set up in your HTML)
/*
@font-face {
  font-family: "WeSuperGolfVariable";
  src: url("./assets/WeSuperGolfVariable.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
*/
const FONT_MAIN = 'WeSuperGolfVariable';
const fontFamilies = [FONT_MAIN];
let fontsReady = false;

// DOM elements
let hitWrapper;   // Mic A wrapper (center, main HIT ME)
let hitEl;        // Mic A "HIT ME" text

let burstWrapper;  // Mic B wrapper (for 10 "HIT ME" clones)
let burstHits = []; // [{ el, angle }]
let burstRadiusCurrent = 0; // <<< SMOOTHED radius value for Mic B burst

// Layout
let baseSize;

// ===== USER TWEAK BLOCKS ===================================================

// === MIC A: "HIT ME" SCALE + WEIGHT (STROKE REMOVED) =======================

// Fixed scale for the main "HIT ME"
// 1.0 = as designed, increase to make it larger, decrease to make it smaller
const HIT_FIXED_SCALE = 1.0; // <<< EDIT: fixed scale for main HIT ME

// Volume range → WEIGHT mapping for "HIT ME"
const HIT_WGHT_MIN_LEVEL = 0.00; // <<< EDIT: quiet volume (input)
const HIT_WGHT_MAX_LEVEL = 0.30; // <<< EDIT: loud volume (input)

// Visual weight range for "HIT ME"
const HIT_WGHT_MIN = 200;  // <<< EDIT: thinnest weight
const HIT_WGHT_MAX = 900;  // <<< EDIT: thickest weight

// === NEW: MIC A WIDTH (wdth axis) ==========================================
// Same volume range as weight
const HIT_WDTH_MIN_LEVEL = 0.00; // quiet volume (input)
const HIT_WDTH_MAX_LEVEL = 0.30; // loud volume (input)

// Visual width range for "HIT ME" (tweak to taste)
const HIT_WDTH_MIN = 80;   // narrower at quiet
const HIT_WDTH_MAX = 130;  // wider at loud
// ===========================================================================

// Volume range → STROKE WIDTH mapping for "HIT ME" (KEPT FOR LATER IF NEEDED)
const HIT_STROKE_MIN_LEVEL = 0.00; // quiet volume (input)
const HIT_STROKE_MAX_LEVEL = 0.30; // loud volume (input)

// Visual stroke-width range (in px) for "HIT ME"
// >>> STROKE DISABLED BY SETTING BOTH TO 0 <<<
const HIT_STROKE_MIN = 0;   // <<< EDIT: keep 0 to have no outline
const HIT_STROKE_MAX = 0;   // <<< EDIT: keep 0 to have no outline
// ============================================================================

// === MIC B: 10 "HIT ME" CLONES RADIAL SPREAD (EDIT HERE) ===================

// Volume range → spread radius mapping for clones
const BURST_RADIUS_MIN_LEVEL = 0.00; // quiet volume (input)
const BURST_RADIUS_MAX_LEVEL = 0.30; // loud volume (input)

// How far they spread from center (fraction of min(screenWidth, screenHeight))
const BURST_RADIUS_MIN = 0.00;  // <<< EDIT: at quietest, all stacked in center
const BURST_RADIUS_MAX = 0.45;  // <<< EDIT: at loudest, how far out they go

// How quickly the burst radius follows volume changes
// 0.0 = no movement, 1.0 = super fast (no smoothing)
const BURST_SMOOTHING = 0.15; // <<< EDIT: smoothing factor for X/Y motion

// Colors for 10 HIT ME clones (2 of each color)
const BURST_COLORS = [
  '#FBAFCE', '#FBAFCE',
  '#D8FFD6', '#D8FFD6',
  '#DBFFA8', '#DBFFA8',
  '#F7FF9D', '#F7FF9D',
  '#EAEFB5', '#EAEFB5'
]; // <<< EDIT: Mic B burst colors (10 items)
// ============================================================================

// Colors
const HIT_COLOR_WHITE = '#000000';

// DEFAULT SLIDER State for MIC A ("HIT ME")
let sensAFactor = 2.0; // multiplier for Mic A RMS → weight + stroke
let sensALabel, sensASlider;

// DEFAULT SLIDER State for MIC B (radial burst)
let sensBFactor = 2.0; // multiplier for Mic B RMS → spread radius
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
    `Mic A sensitivity (HIT ME): ${sensAFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01).parent(sensRow);
  sensASlider.style('width', '160px');

  sensBLabel = createSpan(
    `Mic B sensitivity (burst): ${sensBFactor.toFixed(2)}`
  ).parent(sensRow).style('font-weight:600;');

  sensBSlider = createSlider(0.5, 5, sensBFactor, 0.01).parent(sensRow);
  sensBSlider.style('width', '160px');

  // ===== Create scene elements =============================================
  createSceneElements();

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

function createSceneElements() {
  // Clean up old wrappers if re-running
  if (hitWrapper && hitWrapper.parentNode) hitWrapper.parentNode.removeChild(hitWrapper);
  if (burstWrapper && burstWrapper.parentNode) burstWrapper.parentNode.removeChild(burstWrapper);

  burstHits = [];
  burstRadiusCurrent = 0; // reset smooth radius when recreating

  // ===== Mic A — "HIT ME" in center ========================================
  hitWrapper = document.createElement('div');
  document.body.appendChild(hitWrapper);
  Object.assign(hitWrapper.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) scale(${HIT_FIXED_SCALE})`,
    transformOrigin: '50% 50%',
    pointerEvents: 'none',
    zIndex: 3
  });

  hitEl = document.createElement('div');
  hitEl.textContent = 'HIT ME';
  Object.assign(hitEl.style, {
    fontFamily: `"${FONT_MAIN}", system-ui, sans-serif`,
    fontSize: 'min(18vw, 220px)',
    lineHeight: '1',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: HIT_COLOR_WHITE,
    whiteSpace: 'nowrap',
    fontVariationSettings: `'wght' ${HIT_WGHT_MIN}, 'wdth' ${HIT_WDTH_MIN}`, // start at min weight + min width
    fontOpticalSizing: 'none'
    // NOTE: OUTLINE REMOVED → no WebkitTextStroke / textStroke here
  });
  hitWrapper.appendChild(hitEl);

  // ===== Mic B — 10 HIT ME clones (radial burst) ===========================
  burstWrapper = document.createElement('div');
  document.body.appendChild(burstWrapper);
  Object.assign(burstWrapper.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: 2
  });

  createBurstHits();
}

function createBurstHits() {
  if (!burstWrapper) return;

  burstHits = [];

  const count = BURST_COLORS.length;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('div');
    span.textContent = 'HIT ME';
    Object.assign(span.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      fontFamily: `"${FONT_MAIN}", system-ui, sans-serif`,
      fontSize: 'min(18vw, 220px)', // same size as main HIT ME
      lineHeight: '1',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: BURST_COLORS[i],
      whiteSpace: 'nowrap',
      fontVariationSettings: `'wght' ${HIT_WGHT_MIN}`, // can adjust if needed
      fontOpticalSizing: 'none'
    });

    burstWrapper.appendChild(span);

    // Evenly distribute angles around the circle
    const angle = (Math.PI * 2 * i) / count;
    burstHits.push({ el: span, angle });
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

    statusSpan.html('  Streaming… Mic A → center HIT ME, Mic B → radial burst');
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
      sensALabel.html(`Mic A sensitivity (HIT ME): ${sensAFactor.toFixed(2)}`);
    }
  }
  if (sensBSlider) {
    sensBFactor = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(`Mic B sensitivity (burst): ${sensBFactor.toFixed(2)}`);
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateHitDesign(rmsA);    // Mic A: main HIT ME (weight + width, no stroke)
  updateBurstDesign(rmsB);  // Mic B: 10 colored HIT ME clones
}

// ===== MIC A — "HIT ME" WEIGHT + WIDTH (NO STROKE) =========================
function updateHitDesign(rmsA) {
  if (!hitEl || !hitWrapper) return;

  // Sensitivity multiplier for Mic A
  const effectiveA = rmsA * sensAFactor;

  // Keep "HIT ME" centered with fixed scale (no audio-reactive scale)
  hitWrapper.style.transform = `translate(-50%, -50%) scale(${HIT_FIXED_SCALE})`;
  hitEl.style.color = HIT_COLOR_WHITE; // always white

  // --- WEIGHT mapping ------------------------------------------------------
  let w = map(
    effectiveA,
    HIT_WGHT_MIN_LEVEL,
    HIT_WGHT_MAX_LEVEL,
    HIT_WGHT_MIN,
    HIT_WGHT_MAX
  );
  w = clamp(w, HIT_WGHT_MIN, HIT_WGHT_MAX);

  // --- WIDTH (wdth axis) mapping -------------------------------------------
  let wd = map(
    effectiveA,
    HIT_WDTH_MIN_LEVEL,
    HIT_WDTH_MAX_LEVEL,
    HIT_WDTH_MIN,
    HIT_WDTH_MAX
  );
  wd = clamp(wd, HIT_WDTH_MIN, HIT_WDTH_MAX);

  // Apply both weight + width
  hitEl.style.fontVariationSettings =
    `'wght' ${w.toFixed(0)}, 'wdth' ${wd.toFixed(0)}`;

  // --- STROKE WIDTH mapping (NO VISIBLE EFFECT WHILE MIN & MAX = 0) -------
  let strokeW = map(
    effectiveA,
    HIT_STROKE_MIN_LEVEL,
    HIT_STROKE_MAX_LEVEL,
    HIT_STROKE_MIN,
    HIT_STROKE_MAX
  );
  strokeW = clamp(strokeW, HIT_STROKE_MIN, HIT_STROKE_MAX);

  // Keeping these lines in case you want to re-enable stroke later
  hitEl.style.WebkitTextStrokeWidth = `${strokeW}px`;
  hitEl.style.textStrokeWidth = `${strokeW}px`;
}

// ===== MIC B — RADIAL BURST OF 10 HIT ME ===================================
function updateBurstDesign(rmsB) {
  if (!burstWrapper || burstHits.length === 0) return;

  const effectiveB = rmsB * sensBFactor;

  // Map volume → normalized radius target
  let rNorm = map(
    effectiveB,
    BURST_RADIUS_MIN_LEVEL,
    BURST_RADIUS_MAX_LEVEL,
    BURST_RADIUS_MIN,
    BURST_RADIUS_MAX
  );
  rNorm = clamp(rNorm, BURST_RADIUS_MIN, BURST_RADIUS_MAX);

  const base = Math.min(windowWidth, windowHeight);
  const targetRadiusPx = rNorm * base;

  // === SMOOTHING: slowly move current radius toward target =================
  burstRadiusCurrent = lerp(
    burstRadiusCurrent,
    targetRadiusPx,
    BURST_SMOOTHING
  );

  for (let i = 0; i < burstHits.length; i++) {
    const { el, angle } = burstHits[i];
    const offsetX = burstRadiusCurrent * Math.cos(angle);
    const offsetY = burstRadiusCurrent * Math.sin(angle);

    el.style.transform =
      `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
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
