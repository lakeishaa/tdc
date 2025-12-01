// === TWO-MIC VARIABLE FONT — "HIT ME" + HASHES SCENE =======================
// Mic A → Center "HIT ME" (WeSuperGolfVariable, white; flips white↔pink
//          whenever volume crosses a threshold; also scales & weight-reactive)
// Mic B → Spawns "#" on screen whenever volume crosses a threshold; all "#"
//          scale & weight-reactive; each new "#" flips ALL # colors between
//          #71ECE2 and #EAEFB5
// Extra: Each "#" fades out and is removed after 1 second, and positions are
//        constrained inside a 20% margin around the browser window.
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
let hitWrapper;   // Mic A wrapper (center)
let hitEl;        // Mic A "HIT ME" text

let hashWrapper;  // Mic B wrapper (full screen)
// Now stores objects: { el, x, y, createdAt }
let hashEls = [];

// Layout
let baseSize;

// ===== USER TWEAK BLOCKS ====================================================

// === MIC A: "HIT ME" VOLUME THRESHOLD & SCALE (EDIT HERE) ==================

// Volume threshold for Mic A that flips "HIT ME" color white ↔ pink
const HIT_TRIGGER_LEVEL = 0.12; // <<< EDIT: Mic A volume threshold

// Volume range → scale mapping for Mic A
const HIT_SCALE_MIN_LEVEL = 0.00; // <<< EDIT: quiet volume (input)
const HIT_SCALE_MAX_LEVEL = 0.30; // <<< EDIT: loud volume (input)

// Visual scale range for "HIT ME"
const HIT_SCALE_MIN = 1.0;  // <<< EDIT: smallest scale
const HIT_SCALE_MAX = 2.4;  // <<< EDIT: largest scale

// Volume range → WEIGHT mapping for "HIT ME"
const HIT_WGHT_MIN_LEVEL = 0.00; // <<< EDIT: quiet volume (input)
const HIT_WGHT_MAX_LEVEL = 0.30; // <<< EDIT: loud volume (input)

// Visual weight range for "HIT ME"
const HIT_WGHT_MIN = 200;  // <<< EDIT: thinnest weight
const HIT_WGHT_MAX = 900;  // <<< EDIT: thickest weight
// ============================================================================

// === MIC B: "#" VOLUME THRESHOLD & SCALE (EDIT HERE) ========================

// Volume threshold for Mic B that spawns a new "#"
const HASH_TRIGGER_LEVEL = 0.15; // <<< EDIT: Mic B volume threshold

// Volume range → scale mapping for ALL "#"
const HASH_SCALE_MIN_LEVEL = 0.00; // <<< EDIT: quiet volume (input)
const HASH_SCALE_MAX_LEVEL = 0.30; // <<< EDIT: loud volume (input)

// Visual scale range for ALL "#"
const HASH_SCALE_MIN = 2.0;  // <<< EDIT: smallest scale
const HASH_SCALE_MAX = 2.2;  // <<< EDIT: largest scale

// Volume range → WEIGHT mapping for ALL "#"
const HASH_WGHT_MIN_LEVEL = 0.00; // <<< EDIT: quiet volume (input)
const HASH_WGHT_MAX_LEVEL = 0.30; // <<< EDIT: loud volume (input)

// Visual weight range for ALL "#"
const HASH_WGHT_MIN = 200;  // <<< EDIT: thinnest weight
const HASH_WGHT_MAX = 900;  // <<< EDIT: thickest weight
// ============================================================================

// === HASH PLACEMENT & LIFETIME SETTINGS ====================================
// Safe inner box so there's a 20% margin all around the browser window:
//   X: 20vw → 80vw
//   Y: 20vh → 80vh
// === HASH PLACEMENT & LIFETIME SETTINGS ====================================
// We scale the whole hashWrapper up to HASH_SCALE_MAX, so we need to keep
// centers close enough to the viewport center that even at max scale they
// don't hit the screen edge.
//
// With HASH_SCALE_MAX = 2.2 and wanting them to stay within ~20–80 vw/vh,
// a safe range for centers is ~37–63 vw/vh in both axes.

const HASH_X_MIN = 37;  // <<< EDIT: min X in vw (center of "#")
const HASH_X_MAX = 63;  // <<< EDIT: max X in vw
const HASH_Y_MIN = 37;  // <<< EDIT: min Y in vh
const HASH_Y_MAX = 63;  // <<< EDIT: max Y in vh


// Minimum distance between hashes (in vw/vh units)
const HASH_MIN_DIST = 8; // <<< EDIT: how far apart hashes must be

// How many random tries to find a non-overlapping position
const HASH_MAX_ATTEMPTS = 40;

// Lifetime of each "#" in milliseconds
const HASH_LIFETIME = 1000; // <<< EDIT: fade-out duration in ms (1s)
// ============================================================================

// Colors
const HIT_COLOR_WHITE = '#FFFFFF';
const HIT_COLOR_PINK  = '#FF5ACD';

const HASH_COLORS = ['#71ECE2', '#EAEFB5']; // Mic B hash colors

// State for MIC A ("HIT ME")
let sensAFactor = 0.5; // multiplier for Mic A RMS → color/scale/weight
let sensALabel, sensASlider;

let hitIsPink = false; // current color state (false = white, true = pink)
let hitWasAbove = false; // edge detector for HIT_TRIGGER_LEVEL

// State for MIC B ("#")
let sensBFactor = 1.5; // multiplier for Mic B RMS → spawn/scale/weight
let sensBLabel, sensBSlider;

let hashWasAbove = false;  // edge detector for HASH_TRIGGER_LEVEL
let hashColorIndex = 0;    // which color from HASH_COLORS currently used

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
    `Mic B sensitivity (#): ${sensBFactor.toFixed(2)}`
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
  if (hashWrapper && hashWrapper.parentNode) hashWrapper.parentNode.removeChild(hashWrapper);

  hashEls = [];

  // ===== Mic A — "HIT ME" in center ========================================
  hitWrapper = document.createElement('div');
  document.body.appendChild(hitWrapper);
  Object.assign(hitWrapper.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%) scale(1)',
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
    fontVariationSettings: `'wght' ${HIT_WGHT_MIN}`, // start at minimum
    fontOpticalSizing: 'none'
  });
  hitWrapper.appendChild(hitEl);

  // Reset Mic A color state
  hitIsPink = false;
  hitWasAbove = false;

  // ===== Mic B — "#" full-screen layer =====================================
  hashWrapper = document.createElement('div');
  document.body.appendChild(hashWrapper);
  Object.assign(hashWrapper.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    transform: 'scale(1)',
    transformOrigin: '50% 50%',
    pointerEvents: 'none',
    zIndex: 2
  });

  hashWasAbove = false;
  hashColorIndex = 0;
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

    statusSpan.html('  Streaming… Mic A → "HIT ME", Mic B → "#" hashes');
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
      sensBLabel.html(`Mic B sensitivity (#): ${sensBFactor.toFixed(2)}`);
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  updateHitDesign(rmsA);   // Mic A: "HIT ME" color + scale + weight
  updateHashDesign(rmsB);  // Mic B: "#" spawn + scale + weight + fade
}

// ===== MIC A — "HIT ME" COLOR, SCALE & WEIGHT ==============================
function updateHitDesign(rmsA) {
  if (!hitEl || !hitWrapper) return;

  // Sensitivity multiplier for Mic A
  const effectiveA = rmsA * sensAFactor;

  // --- COLOR FLIP on threshold crossing -----------------------------------
  if (effectiveA >= HIT_TRIGGER_LEVEL && !hitWasAbove) {
    // Just crossed ABOVE threshold → flip color state
    hitIsPink = !hitIsPink;
    hitWasAbove = true;
  } else if (effectiveA < HIT_TRIGGER_LEVEL * 0.7) {
    // Go back to "ready" state when comfortably below threshold
    hitWasAbove = false;
  }

  // Apply color
  hitEl.style.color = hitIsPink ? HIT_COLOR_PINK : HIT_COLOR_WHITE;

  // --- SCALE mapping -------------------------------------------------------
  let s = map(
    effectiveA,
    HIT_SCALE_MIN_LEVEL,
    HIT_SCALE_MAX_LEVEL,
    HIT_SCALE_MIN,
    HIT_SCALE_MAX
  );
  s = clamp(s, HIT_SCALE_MIN, HIT_SCALE_MAX);

  hitWrapper.style.transform = `translate(-50%, -50%) scale(${s})`;

  // --- WEIGHT mapping ------------------------------------------------------
  let w = map(
    effectiveA,
    HIT_WGHT_MIN_LEVEL,
    HIT_WGHT_MAX_LEVEL,
    HIT_WGHT_MIN,
    HIT_WGHT_MAX
  );
  w = clamp(w, HIT_WGHT_MIN, HIT_WGHT_MAX);

  hitEl.style.fontVariationSettings = `'wght' ${w.toFixed(0)}`;
}

// ===== MIC B — "#" SPAWN, SCALE, WEIGHT & FADE =============================
function updateHashDesign(rmsB) {
  if (!hashWrapper) return;

  const effectiveB = rmsB * sensBFactor;

  // --- SPAWN new "#" when crossing threshold -------------------------------
  if (effectiveB >= HASH_TRIGGER_LEVEL && !hashWasAbove) {
    spawnHash();
    // Flip color index each time we add a "#" and recolor all existing ones
    hashColorIndex = (hashColorIndex + 1) % HASH_COLORS.length;
    const newColor = HASH_COLORS[hashColorIndex];
    hashEls.forEach(h => { h.el.style.color = newColor; });

    hashWasAbove = true;
  } else if (effectiveB < HASH_TRIGGER_LEVEL * 0.7) {
    hashWasAbove = false;
  }

  // --- SCALE all "#" together ----------------------------------------------
  let s = map(
    effectiveB,
    HASH_SCALE_MIN_LEVEL,
    HASH_SCALE_MAX_LEVEL,
    HASH_SCALE_MIN,
    HASH_SCALE_MAX
  );
  s = clamp(s, HASH_SCALE_MIN, HASH_SCALE_MAX);

  hashWrapper.style.transform = `scale(${s})`;

  // --- WEIGHT all "#" together ---------------------------------------------
  let w = map(
    effectiveB,
    HASH_WGHT_MIN_LEVEL,
    HASH_WGHT_MAX_LEVEL,
    HASH_WGHT_MIN,
    HASH_WGHT_MAX
  );
  w = clamp(w, HASH_WGHT_MIN, HASH_WGHT_MAX);

  hashEls.forEach(h => {
    h.el.style.fontVariationSettings = `'wght' ${w.toFixed(0)}`;
  });

  // --- FADE & REMOVE old "#" -----------------------------------------------
  const now = millis();
  for (let i = hashEls.length - 1; i >= 0; i--) {
    const h = hashEls[i];
    const age = now - h.createdAt;

    if (age >= HASH_LIFETIME) {
      // Remove from DOM and array
      if (h.el && h.el.parentNode === hashWrapper) {
        hashWrapper.removeChild(h.el);
      }
      hashEls.splice(i, 1);
    } else {
      // Linear fade: 1 → 0 over HASH_LIFETIME
      let alpha = 1 - age / HASH_LIFETIME;
      alpha = Math.max(0, Math.min(1, alpha));
      h.el.style.opacity = alpha.toFixed(2);
    }
  }
}

function spawnHash() {
  if (!hashWrapper) return;

  // Try to find a non-overlapping position inside the safe inner box
  let xPercent = 50;
  let yPercent = 50;
  let ok = false;

  for (let attempt = 0; attempt < HASH_MAX_ATTEMPTS && !ok; attempt++) {
    xPercent = HASH_X_MIN + Math.random() * (HASH_X_MAX - HASH_X_MIN);
    yPercent = HASH_Y_MIN + Math.random() * (HASH_Y_MAX - HASH_Y_MIN);

    ok = true;
    for (let i = 0; i < hashEls.length; i++) {
      const h = hashEls[i];
      const dx = xPercent - h.x;
      const dy = yPercent - h.y;
      if (dx * dx + dy * dy < HASH_MIN_DIST * HASH_MIN_DIST) {
        ok = false;
        break;
      }
    }
  }

  if (!ok) {
    // Couldn't find a non-overlapping spot → skip spawning this one
    return;
  }

  const span = document.createElement('span');
  span.textContent = '#';

  Object.assign(span.style, {
    position: 'absolute',
    left: `${xPercent}vw`,
    top: `${yPercent}vh`,
    transform: 'translate(-50%, -50%)',
    fontFamily: `"${FONT_MAIN}", system-ui, sans-serif`,
    fontSize: 'min(10vw, 120px)',
    lineHeight: '1',
    letterSpacing: '0.02em',
    color: HASH_COLORS[hashColorIndex],
    whiteSpace: 'nowrap',
    fontVariationSettings: `'wght' ${HASH_WGHT_MIN}`, // start at min weight
    fontOpticalSizing: 'none',
    opacity: '1' // start fully visible
  });

  hashWrapper.appendChild(span);
  hashEls.push({
    el: span,
    x: xPercent,
    y: yPercent,
    createdAt: millis() // <<< used for fade-out timing
  });
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
}
// ===========================================================================

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
