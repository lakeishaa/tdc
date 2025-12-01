// === TWO-MIC VARIABLE FONT — STARFIELD "*" SCENE ===========================
// Mic A → "weight" (SHPE axis) of all "*" (WeStacksVariable, audio reactive)
// Mic B → Reserved (no visual yet, but fully wired up for future use)
// Press "Z" to start spawning stars.
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Panel visibility flag
let panelVisible = true;

// Sensitivity slider UI + value
let sensSlider, sensLabel;

// <<< CHANGE THIS to set the *default* Mic A sensitivity slider value
const DEFAULT_MIC_A_SENS = 0.51; // e.g. 2.0 = twice as reactive

let micASensitivity = DEFAULT_MIC_A_SENS; // multiplier for Mic A loudness

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up in your HTML)
const FONT_A = 'WeStacksVariable'; // Mic A → "*"
const FONT_B = 'WeStacksVariable'; // Mic B (kept for future use)
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// // ============================================================================
// === STAR GRID & SCALE CONTROLS (EDIT THESE TO TUNE THE LOOK) ==============

// Maximum number of stars on screen
const MAX_STARS = 21;

// How many columns/rows for the even grid layout
const STAR_GRID_COLS = 7;
const STAR_GRID_ROWS = 3;

// Margin around the canvas where no stars appear (as a fraction of width/height)
const STAR_MARGIN_X_RATIO = 0.08; // 8% margin left/right
const STAR_MARGIN_Y_RATIO = 0.10; // 10% margin top/bottom

// <<< POSITION JITTER (HOW RANDOM INSIDE EACH CELL) >>>
// 0.0 = perfectly centered in each cell
// 0.5 = can move up to half a cell from the center (~maximum before crossing cells)
const STAR_JITTER_X_RATIO = 0.25; // EDIT THIS for more/less x randomness
const STAR_JITTER_Y_RATIO = 0.35; // EDIT THIS for more/less y randomness

// <<< SIZE MIN/MAX for "*" (edit these)
const STAR_SCALE_MIN = 0.2;  // MIN star scale (smaller)
const STAR_SCALE_MAX = 0.7;  // MAX star scale (smaller)

// How long it takes a star to fade in (seconds)
const STAR_FADE_DURATION_SEC = 0.6;

// How often a new star appears (seconds)
const STAR_APPEAR_INTERVAL_SEC = 0.4;

// Base star font size in px (you can tweak or make it responsive)
const STAR_BASE_FONT_PX = 80;

// <<< GLOBAL DRAWING TRANSFORM (EDIT THESE) >>>
// Overall scale for the whole star layout
const DRAWING_SCALE = 1.4;   // 1.0 = original size, >1 = bigger, <1 = smaller

// Where the *center* of the layout sits, as a fraction of the screen
// X: 0 = left, 0.5 = center, 1 = right
// Y: 0 = top, 0.5 = center, 1 = bottom
const DRAWING_TARGET_X_RATIO = 0.5;  // center horizontally
const DRAWING_TARGET_Y_RATIO = 0.4;  // bottom edge (try 0.85–0.9 if you want slightly above bottom)

// ============================================================================
// === MIC A → SHPE MAPPING CONTROLS =========================================

// <<< Mic A RMS range max (edit this)
// RMS 0 → quietest, RMS MIC_A_RMS_MAX → "loudest" we care about
const MIC_A_RMS_MAX = 0.15;

// <<< Quietest / loudest SHPE values for Mic A (edit these)
// Quietest → SHPE 3, Loudest → SHPE 0 (reversed)
const MIC_A_SHPE_QUIET = 3.0; // quiet → more "weight"
const MIC_A_SHPE_LOUD  = 0.0; // loud  → less "weight"

// Each star:
// { x, y, scale, createdAt, element, active, opacity }
let stars = [];

// When the "Z" sequence started
let starsSequenceActive = false;
let starsSequenceStartTime = 0;

// ============================================================================

function setup() {
  createCanvas(windowWidth, windowHeight);

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

  hideBtn.mousePressed(() => {
    togglePanel();
  });

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
  selA = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB = createSelect().parent(groupB);

  // === Mic A sensitivity slider row =======================================
  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensLabelText = createSpan('Mic A sensitivity:').parent(row3);
  sensLabelText.style('font-weight:600;');

  // Slider: min 0.2x (less reactive) to 4x (super reactive)
  sensSlider = createSlider(0.2, 4.0, DEFAULT_MIC_A_SENS, 0.01).parent(row3);
  sensSlider.style('width:120px;');

  sensLabel = createSpan('×' + DEFAULT_MIC_A_SENS.toFixed(2)).parent(row3);
  sensLabel.style('min-width:40px; text-align:right;');

  micASensitivity = sensSlider.value();

  sensSlider.input(() => {
    micASensitivity = sensSlider.value();
    sensLabel.html('×' + micASensitivity.toFixed(2));
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

  window.addEventListener('beforeunload', cleanupStreams);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ============================================================================
// === MIC ENABLE + DEVICE PICKER ============================================

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
    const label = d.label || `Mic (${d.deviceId.slice(0, 6)})`;
    selA.option(label, d.deviceId);
    selB.option(label, d.deviceId);
  });

  const idxBuiltIn = devices.findIndex(d => /built.?in/i.test(d.label));
  const idxIPhone  = devices.findIndex(d => /iphone|continuity|external/i.test(d.label));
  if (idxBuiltIn >= 0) selA.selected(devices[idxBuiltIn].deviceId);
  if (idxIPhone >= 0 && idxIPhone !== idxBuiltIn) selB.selected(devices[idxIPhone].deviceId);
  else if (devices.length > 1) selB.selected(devices[1].deviceId);
}

// ============================================================================
// === START BOTH STREAMS =====================================================

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

    statusSpan.html('  Streaming… Mic A → "*" SHPE (Mic B reserved)');
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

// ============================================================================
// === DRAW LOOP ==============================================================

function draw() {
  background(0); // black background

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB); // not used visually yet

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB); // currently unused

  updateStars();
}

// ============================================================================
// === AUDIO → DESIGN MAPPING =================================================

function updateMicADesign(rmsA) {
  // Mic A: controls "weight" via SHPE axis of all "*" stars
  const scaled = rmsA * micASensitivity;

  // Clamp RMS into 0..MIC_A_RMS_MAX
  const clampedRms = clamp(scaled, 0, MIC_A_RMS_MAX);

  // Map 0..MIC_A_RMS_MAX → SHPE_QUIET..SHPE_LOUD (reversed)
  const shpe = map(
    clampedRms,
    0, MIC_A_RMS_MAX,
    MIC_A_SHPE_QUIET, // quiet → 3
    MIC_A_SHPE_LOUD   // loud  → 0
  );

  const shpeStr = shpe.toFixed(2);

  // If your axis is 'wght' instead of 'SHPE', change 'SHPE' to 'wght' here.
  const variation = `'SHPE' ${shpeStr}`;

  stars.forEach(star => {
    if (star.element) {
      star.element.style.fontVariationSettings = variation;
    }
  });
}

function updateMicBDesign(rmsB) {
  // Reserved — you can map Mic B here later if you want.
}

// ============================================================================
// === STAR LOGIC =============================================================

function startStarsSequence() {
  // Remove any existing star elements from DOM
  stars.forEach(star => {
    if (star.element && star.element.parentNode) {
      star.element.parentNode.removeChild(star.element);
    }
  });
  stars = [];

  // Prepare new star slots
  prepareStarSlots();

  starsSequenceActive = true;
  starsSequenceStartTime = millis();
}

function prepareStarSlots() {
  const innerWidth  = windowWidth  * (1 - 2 * STAR_MARGIN_X_RATIO);
  const innerHeight = windowHeight * (1 - 2 * STAR_MARGIN_Y_RATIO);
  const marginX = windowWidth  * STAR_MARGIN_X_RATIO;
  const marginY = windowHeight * STAR_MARGIN_Y_RATIO;

  const cellW = innerWidth / STAR_GRID_COLS;
  const cellH = innerHeight / STAR_GRID_ROWS;

  let slots = [];
  for (let row = 0; row < STAR_GRID_ROWS; row++) {
    for (let col = 0; col < STAR_GRID_COLS; col++) {
      const centerX = marginX + (col + 0.5) * cellW;
      const centerY = marginY + (row + 0.5) * cellH;

      // --- JITTER INSIDE EACH CELL (MORE RANDOM X/Y) -----------------------
      const maxJitterX = cellW * STAR_JITTER_X_RATIO;
      const maxJitterY = cellH * STAR_JITTER_Y_RATIO;

      const jitterX = random(-maxJitterX, maxJitterX);
      const jitterY = random(-maxJitterY, maxJitterY);

      const jitteredX = centerX + jitterX;
      const jitteredY = centerY + jitterY;

      slots.push({ x: jitteredX, y: jitteredY });
    }
  }

  // === APPLY GLOBAL DRAWING SCALE + ALIGNMENT ==============================
  // Compute bounding box of the jittered layout
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  slots.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const layoutCenterX = (minX + maxX) * 0.5;
  const layoutCenterY = (minY + maxY) * 0.5;

  const targetCenterX = windowWidth  * DRAWING_TARGET_X_RATIO;
  const targetCenterY = windowHeight * DRAWING_TARGET_Y_RATIO;

  const offsetX = targetCenterX - layoutCenterX;
  const offsetY = targetCenterY - layoutCenterY;

  slots = slots.map(p => {
    const dx = p.x - layoutCenterX;
    const dy = p.y - layoutCenterY;

    // Scale around the layout center
    const scaledX = layoutCenterX + dx * DRAWING_SCALE;
    const scaledY = layoutCenterY + dy * DRAWING_SCALE;

    // Then shift so the center moves to the target
    return {
      x: scaledX + offsetX,
      y: scaledY + offsetY
    };
  });

  // Shuffle and limit to MAX_STARS
  shuffle(slots, true);
  slots = slots.slice(0, MAX_STARS);

  const now = millis();

  stars = slots.map((slot, index) => {
    const appearOffsetMs = index * STAR_APPEAR_INTERVAL_SEC * 800;

    const s = random(STAR_SCALE_MIN, STAR_SCALE_MAX);

    const el = document.createElement('div');
    el.textContent = '*';
    Object.assign(el.style, {
      position: 'fixed',
      left: `${slot.x}px`,
      top: `${slot.y}px`,
      transform: `translate(-50%, -50%) scale(${s})`,
      fontFamily: `"${FONT_A}", system-ui, sans-serif`,
      fontSize: `${STAR_BASE_FONT_PX}px`,
      lineHeight: '1',
      textAlign: 'center',
      color: '#FFFFFF',
      opacity: '0',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      willChange: 'transform, opacity, font-variation-settings',
      zIndex: 3
    });

    // Initial SHPE variation at quiet shape
    el.style.fontVariationSettings = `'SHPE' ${MIC_A_SHPE_QUIET.toFixed(2)}`;

    document.body.appendChild(el);

    return {
      x: slot.x,
      y: slot.y,
      scale: s,
      createdAt: now + appearOffsetMs,
      element: el,
      active: false,
      opacity: 0
    };
  });
}

function updateStars() {
  if (!starsSequenceActive) return;

  const currentTimeMs = millis();

  stars.forEach(star => {
    const t = currentTimeMs - star.createdAt;

    if (t >= 0) {
      star.active = true;
      const fadeT = t / (STAR_FADE_DURATION_SEC * 1000);
      star.opacity = clamp(fadeT, 0, 1);

      if (star.element) {
        const centerX = windowWidth / 2;
        const centerY = windowHeight; // bottom center for rotation reference
        const dx = centerX - star.x;
        const dy = centerY - star.y;

        const angle = Math.atan2(dy, dx);
        const rotation = angle + Math.PI / 2; // tweak if you want a different curve

        star.element.style.transform =
          `translate(-50%, -50%) scale(${star.scale}) rotate(${rotation}rad)`;
        star.element.style.opacity = star.opacity.toFixed(2);
      }
    }
  });

  const allDone = stars.every(
    star => currentTimeMs >= star.createdAt + STAR_FADE_DURATION_SEC * 1000
  );
  if (allDone) {
    starsSequenceActive = false;
  }
}

// ============================================================================
// === PANEL TOGGLE + KEY HANDLER ============================================

function keyPressed() {
  if (key === 'x' || key === 'X') {
    togglePanel();
  } else if (key === 'z' || key === 'Z') {
    startStarsSequence();
  }
}

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

// ============================================================================
// === HELPERS ================================================================

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
// using p5.js global map(), lerp(), shuffle(), random()
// ============================================================================
