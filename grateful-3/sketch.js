// === TWO-MIC VARIABLE FONT — DOT REACTIVE SCENE ============================
// Both Mic A & Mic B → WeStacksVariable
// Mic A → Center "." (SHPE: loud → 1, quiet → 5, very big)
// Mic B → Many pink "." across the ENTIRE screen, random positions, ticker to
//         the right with individual speeds, SHPE mapped same as Mic A.
//         About 70% of Mic B dots are IN FRONT of Mic A; the rest are behind.
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let panelVisible = true; // <<< panel visibility flag
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
let micATextEl;                 // center "."
// Split Mic B wrapper into BACK and FRONT to get true z-index layering
let micBWrapperFront = null;    // front-layer dots (above white)
let micBWrapperBack  = null;    // back-layer dots (behind white)
let micBDots = [];              // { elt, x, y, speed, isFront }

// Layout
let baseSize;
let baseFontSize;        // <<< base font size for center star (before scaling)

// Audio → shape mapping parameters
const RMS_MAX = 0.15;    // base sensitivity (higher = less sensitive)
const SHAPE_MIN = 1;     // loud
const SHAPE_MAX = 5;     // quiet

// ===== CENTER STAR SIZE SCALE (LOUDER = BIGGER) ============================
// <<< EDIT THESE TO CONTROL HOW MUCH THE WHITE STAR GROWS WITH VOLUME >>>
let MIC_A_SCALE_MIN = 1.3;  // quietest scale (smaller)
let MIC_A_SCALE_MAX = 1.6;  // loudest scale (bigger)
// ==========================================================================

// Sensitivity for Mic A & B (multipliers)
let sensAFactor = 0.5;
let sensBFactor = 1.0;

// Slider + labels
let sensALabel, sensASlider;
let sensBLabel, sensBSlider;

// ===== MIC B DOTS — EDITABLE SETTINGS ======================================

// <<< EDIT MIC B SPEED HERE: min & max ticker speed (pixels per frame) >>>
let MIC_B_SPEED_MIN = 0.5;   // slowest dots
let MIC_B_SPEED_MAX = 4.0;   // fastest dots


// ===== Center Dot Y-Offset Slider (for white "*") ===========================
let centerDotY = 25;  // <<< DEFAULT: push downward a bit (adjust anytime)

let centerRow = createDiv().parent(ctrlPanel).style('margin-top', '6px');

let centerYLabel = createSpan(`Center "*" Y-position (%): ${centerDotY.toFixed(1)}%`)
  .parent(centerRow)
  .style('font-weight:600;');

let centerYSlider = createSlider(0, 50, centerDotY, 0.1)
  .parent(centerRow)
  .style('width', '160px');

centerYSlider.input(() => {
  centerDotY = centerYSlider.value();
  centerYLabel.html(`Center "*" Y-position (%): ${centerDotY.toFixed(1)}%`);
  micATextEl.style.top = `${centerDotY}%`;    // <<< update position live
});



// ===========================================================================

function setup() {
  createCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);
  baseFontSize = baseSize * 7;  // <<< base font size for center star

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
  hideBtn.mousePressed(() => {
    ctrlPanel.hide();
    panelVisible = false; // <<< keep state in sync
  });

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
  top: `${centerDotY}%`,     // <<< now controlled by slider
  transform: 'translate(-50%, -50%)',
  fontSize: `${baseFontSize.toFixed(1)}px`,
  fontFamily: `"${FONT_A}", system-ui, sans-serif`,
  color: '#ffffff',
  willChange: 'font-variation-settings, transform',
  zIndex: 3
});


  micATextEl.textContent = '.';
  micATextEl.style.fontVariationSettings = `'SHPE' ${SHAPE_MAX}`; // quiet default

  // ===== Dots for Mic B — NOW FULL SCREEN VERTICALLY ========================
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
  // Remove old wrappers if any
  if (micBWrapperFront) micBWrapperFront.remove();
  if (micBWrapperBack)  micBWrapperBack.remove();

  // BACK layer (behind white center dot)
  micBWrapperBack = document.createElement('div');
  micBWrapperBack.id = 'micBWrapperBack';
  document.body.appendChild(micBWrapperBack);

  Object.assign(micBWrapperBack.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: 2, // behind micAText (zIndex 3)
    overflow: 'hidden'
  });

  // FRONT layer (in front of white center dot)
  micBWrapperFront = document.createElement('div');
  micBWrapperFront.id = 'micBWrapperFront';
  document.body.appendChild(micBWrapperFront);

  Object.assign(micBWrapperFront.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: 4, // in front of micAText (zIndex 3)
    overflow: 'hidden'
  });

  micBDots = [];

  const h = windowHeight;

  // <<< NOW FULL HEIGHT: use entire screen vertically for dots >>>
  const yMin = 0;
  const yMax = h;

  // Exactly 70% of dots in the FRONT layer, 30% in the BACK
  const frontCount = Math.round(count * 0.7);

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = '.';

    // Random position across entire screen
    let x = Math.random() * windowWidth;
    let y = yMin + Math.random() * (yMax - yMin);

    // Random speed between MIC_B_SPEED_MIN and MIC_B_SPEED_MAX
    const speed = MIC_B_SPEED_MIN + Math.random() * (MIC_B_SPEED_MAX - MIC_B_SPEED_MIN);

    const isFront = i < frontCount; // first 70% front, rest back

    Object.assign(span.style, {
      position: 'absolute',
      fontFamily: `"${FONT_B}", system-ui, sans-serif`,
      fontSize: 'min(18vw, 108px)',
      color: '#ff7ac8',
      willChange: 'transform, font-variation-settings',
      transform: `translate(${x}px, ${y}px)`,
      fontVariationSettings: `'SHPE' ${SHAPE_MAX}`,
      zIndex: 1 // zIndex inside each wrapper; wrapper decides front/back
    });

    // Attach to the appropriate layer wrapper
    (isFront ? micBWrapperFront : micBWrapperBack).appendChild(span);

    micBDots.push({ elt: span, x, y, speed, isFront });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);
  baseFontSize = baseSize * 7; // <<< recompute base font size on resize
  micATextEl.style.fontSize = `${baseFontSize.toFixed(1)}px`;

  // Recreate dots to stay full-screen in the new window
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

function keyPressed() {
  // Press X (or x) to toggle the control panel
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

// ===== AUDIO → DESIGN MAPPING ==============================================

function audioToShape(effectiveRms) {
  // Map (scaled) RMS 0..RMS_MAX → SHAPE_MAX..SHAPE_MIN (quiet → 5, loud → 1)
  const s = map(effectiveRms, 0, RMS_MAX, SHAPE_MAX, SHAPE_MIN);
  return clamp(s, SHAPE_MIN, SHAPE_MAX);
}

function updateMicADesign(rmsA) {
  const effective = rmsA * sensAFactor;
  const shape = audioToShape(effective);

  // SHPE axis
  micATextEl.style.fontVariationSettings = `'SHPE' ${shape.toFixed(2)}`;

  // ===== SIZE REACTIVITY (LOUDER = BIGGER) =================================
  let scale = map(effective, 0, RMS_MAX, MIC_A_SCALE_MIN, MIC_A_SCALE_MAX);
  scale = clamp(scale, MIC_A_SCALE_MIN, MIC_A_SCALE_MAX);

  // <<< KEEP DOT VISUALLY CENTERED EVEN WHEN SCALING >>>
  micATextEl.style.transformOrigin = "50% 76%";
  micATextEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}


function updateMicBDesign(rmsB) {
  // Apply Mic B sensitivity
  const effective = rmsB * sensBFactor;
  const shape = audioToShape(effective);

  // Apply shape to all dots
  for (const d of micBDots) {
    d.elt.style.fontVariationSettings = `'SHPE' ${shape.toFixed(2)}`;
  }

  const w = windowWidth;

  // Each dot uses its OWN speed (between MIC_B_SPEED_MIN and MIC_B_SPEED_MAX)
  for (const d of micBDots) {
    d.x += d.speed;
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
