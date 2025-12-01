// === TWO-MIC VARIABLE FONT — DUAL TEXT-WAVE SCENE ==========================
// Mic A → "same drugs" text along audio path, in #B2E2EB (blue), front
// Mic B → "same drugs" text along audio path, in #AD95C3 (purple), behind
// Both overlap on the same vertical center line.
// Panel: Enable Mics → pick Mic A & Mic B → Start
// Press "X" to toggle panel visibility.
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Panel visibility
let panelVisible = true;

// === WAVE LAYOUT / HEIGHT CONTROLS =========================================
// Vertical placement of both waves as a fraction of canvas height.
// 0.5 = middle, 0.4 = slightly above center, etc.
let WAVE_CENTER_Y_RATIO = 0.5; // <<< EDITABLE: move overlapped waves up/down

// Base vertical height in pixels before sensitivity multipliers.
// Bigger = taller waves overall.
let BASE_WAVE_HEIGHT = 120; // <<< EDITABLE + SLIDER: default base wave height (px)

// Mic A sensitivity (vertical amplitude multiplier)
let sensASlider, sensALabel;
let waveASensitivity = 1.0; // <<< Mic A loudness → wave height

// Mic B sensitivity (vertical amplitude multiplier)
let sensBSlider, sensBLabel;
let waveBSensitivity = 1.0; // <<< Mic B loudness → wave height

// === TEXT ALONG PATH CONTROLS ==============================================
// The string to repeat along the wave.
let TEXT_STRING = "same drugs "; // <<< EDITABLE: text repeated along path

// Text size in pixels.
let TEXT_SIZE = 22; // <<< EDITABLE + SLIDER: font size

// How many analyser samples to skip between characters.
// Smaller = denser text along the wave, larger = more spaced out.
let SAMPLE_STEP = 8; // <<< EDITABLE + SLIDER: spacing of characters along the path

// === SMOOTHING CONTROLS ====================================================
// Neighborhood size (in samples) for spatial smoothing along the wave.
// Larger = smoother, but also more laggy / less detailed.
let SMOOTH_NEIGHBORHOOD = 4; // <<< EDITABLE: 0 = raw, 2–8 = nice & smooth

// === SLIDER HANDLES FOR TEXT / WAVE CONTROLS ===============================
let textSizeSlider, textSizeValueLabel;     // <<< TEXT_SIZE SLIDER
let sampleStepSlider, sampleStepValueLabel; // <<< SAMPLE_STEP SLIDER
let baseHeightSlider, baseHeightValueLabel; // <<< BASE_WAVE_HEIGHT SLIDER

// Audio globals
let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Colors
const MIC_A_COLOR = '#B2E2EB'; // blue, front
const MIC_B_COLOR = '#AD95C3'; // purple, back

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Preallocate analyser buffers
  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  // Use WeAppealVariable for the canvas text (assumes @font-face in CSS)
  textFont("WeAppealVariable"); // <<< ensure this family name matches your CSS

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

  // Small close button
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
  hideBtn.mousePressed(() => togglePanel());

  // Top row: buttons
  const topRow = createDiv().parent(ctrlPanel)
    .style('display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan('  Step 1 → Enable Mics').parent(ctrlPanel);

  // Mic selectors
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

  // === Wave sensitivity sliders (Mic A & Mic B) ============================
  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; flex-direction:column; gap:4px;');

  // Mic A slider
  const rowA = createDiv().parent(row3)
    .style('display:flex; align-items:center; gap:6px; flex-wrap:wrap;');
  const sensALabelText = createSpan('Mic A wave height:').parent(rowA);
  sensALabelText.style('font-weight:600;');
  sensASlider = createSlider(0.2, 4.0, 2.0, 0.01).parent(rowA); // <<< range
  sensASlider.style('width:120px;');
  sensALabel = createSpan('×2.00').parent(rowA);
  sensALabel.style('min-width:40px; text-align:right;');
  waveASensitivity = sensASlider.value();
  sensASlider.input(() => {
    waveASensitivity = sensASlider.value();
    sensALabel.html('×' + waveASensitivity.toFixed(2));
  });

  // Mic B slider
  const rowB = createDiv().parent(row3)
    .style('display:flex; align-items:center; gap:6px; flex-wrap:wrap;');
  const sensBLabelText = createSpan('Mic B wave height:').parent(rowB);
  sensBLabelText.style('font-weight:600;');
  sensBSlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(rowB); // <<< range
  sensBSlider.style('width:120px;');
  sensBLabel = createSpan('×1.00').parent(rowB);
  sensBLabel.style('min-width:40px; text-align:right;');
  waveBSensitivity = sensBSlider.value();
  sensBSlider.input(() => {
    waveBSensitivity = sensBSlider.value();
    sensBLabel.html('×' + waveBSensitivity.toFixed(2));
  });

  // === TEXT & WAVE DETAIL SLIDERS ==========================================
  const row4 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; flex-direction:column; gap:4px;');

  // --- TEXT_SIZE SLIDER ----------------------------------------------------
  const textSizeRow = createDiv().parent(row4)
    .style('display:flex; align-items:center; gap:6px; flex-wrap:wrap;');
  const textSizeLabel = createSpan('TEXT_SIZE (font size):').parent(textSizeRow);
  textSizeLabel.style('font-weight:600;');
  textSizeSlider = createSlider(10, 80, TEXT_SIZE, 1).parent(textSizeRow);
  textSizeSlider.style('width:120px;');
  textSizeValueLabel = createSpan(TEXT_SIZE + 'px').parent(textSizeRow);
  textSizeValueLabel.style('min-width:50px; text-align:right;');
  textSizeSlider.input(() => {
    TEXT_SIZE = textSizeSlider.value();
    textSizeValueLabel.html(TEXT_SIZE + 'px');
  });

  // --- SAMPLE_STEP SLIDER --------------------------------------------------
  const stepRow = createDiv().parent(row4)
    .style('display:flex; align-items:center; gap:6px; flex-wrap:wrap;');
  const stepLabel = createSpan('SAMPLE_STEP (spacing):').parent(stepRow);
  stepLabel.style('font-weight:600;');
  // Smaller = more characters → denser ribbon
  sampleStepSlider = createSlider(2, 40, SAMPLE_STEP, 1).parent(stepRow);
  sampleStepSlider.style('width:120px;');
  sampleStepValueLabel = createSpan(SAMPLE_STEP.toString()).parent(stepRow);
  sampleStepValueLabel.style('min-width:50px; text-align:right;');
  sampleStepSlider.input(() => {
    SAMPLE_STEP = int(sampleStepSlider.value());
    sampleStepValueLabel.html(SAMPLE_STEP.toString());
  });

  // --- BASE_WAVE_HEIGHT SLIDER --------------------------------------------
  const baseHeightRow = createDiv().parent(row4)
    .style('display:flex; align-items:center; gap:6px; flex-wrap:wrap;');
  const baseHeightLabel = createSpan('BASE_WAVE_HEIGHT:').parent(baseHeightRow);
  baseHeightLabel.style('font-weight:600;');
  baseHeightSlider = createSlider(40, 260, BASE_WAVE_HEIGHT, 1).parent(baseHeightRow);
  baseHeightSlider.style('width:120px;');
  baseHeightValueLabel = createSpan(BASE_WAVE_HEIGHT + 'px').parent(baseHeightRow);
  baseHeightValueLabel.style('min-width:60px; text-align:right;');
  baseHeightSlider.input(() => {
    BASE_WAVE_HEIGHT = baseHeightSlider.value();
    baseHeightValueLabel.html(BASE_WAVE_HEIGHT + 'px');
  });

  // Disable selects + Start until mics are enabled
  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  background(0);
  noStroke();
  textAlign(CENTER, CENTER);

  window.addEventListener('beforeunload', cleanupStreams);
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

  // Try helpful defaults (built-in vs iPhone/Continuity)
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

    // === SMOOTHING OVER TIME (less jitter frame-to-frame) ==================
    anA.smoothingTimeConstant = 0.85; // <<< EDITABLE: 0.0 (raw) → 0.9 (very smooth)
    anB.smoothingTimeConstant = 0.85; // <<< same for Mic B

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html('  Streaming… Mic A → blue text-wave (front), Mic B → purple text-wave (back)');
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

// ===== DRAW LOOP — OVERLAPPED TEXT-WAVES ===================================
function draw() {
  background(0); // black

  // Same Y for both, so they overlap perfectly
  const centerY = height * WAVE_CENTER_Y_RATIO; // <<< EDIT HERE to move both

  // Draw Mic B FIRST (purple, back)
  drawTextWaveFromAnalyser(
    anB,
    bufB,
    MIC_B_COLOR,
    centerY,
    BASE_WAVE_HEIGHT * waveBSensitivity
  );

  // Then draw Mic A (blue) ON TOP
  drawTextWaveFromAnalyser(
    anA,
    bufA,
    MIC_A_COLOR,
    centerY,
    BASE_WAVE_HEIGHT * waveASensitivity
  );
}

// ===== HELPER: SPATIAL SMOOTHING OF SAMPLES ================================
// Returns an averaged sample around index `idx` using SMOOTH_NEIGHBORHOOD.
// This smooths out jagged local changes → less jiggly path.
function getSmoothedSample(buffer, idx) {
  if (SMOOTH_NEIGHBORHOOD <= 0) return buffer[idx]; // no smoothing

  let sum = 0;
  let count = 0;
  const start = max(0, idx - SMOOTH_NEIGHBORHOOD);
  const end   = min(buffer.length - 1, idx + SMOOTH_NEIGHBORHOOD);

  for (let i = start; i <= end; i++) {
    sum += buffer[i];
    count++;
  }
  return count > 0 ? sum / count : buffer[idx];
}

// ===== TEXT-ALONG-PATH RENDERING ===========================================
// Draws "same drugs" along the waveform path for a given analyser.
function drawTextWaveFromAnalyser(analyser, buffer, fillColor, centerY, amplitudePx) {
  if (!analyser) return;

  analyser.getFloatTimeDomainData(buffer);

  fill(fillColor);
  noStroke();
  textSize(TEXT_SIZE); // uses TEXT_SIZE (slider-controlled)
  textAlign(CENTER, CENTER);

  const len = buffer.length;
  const chars = TEXT_STRING;
  let charIndex = 0; // local per-wave so both start at left

  for (let i = 0; i < len - 1; i += SAMPLE_STEP) { // uses SAMPLE_STEP (slider)
    // === SMOOTHED SAMPLES instead of raw buffer ============================
    const sample1 = getSmoothedSample(buffer, i);
    const nextIndex = min(i + SAMPLE_STEP, len - 1);
    const sample2 = getSmoothedSample(buffer, nextIndex);

    const x  = map(i,           0, len - 1, 0, width);
    const x2 = map(nextIndex,   0, len - 1, 0, width);
    const y  = centerY + sample1 * amplitudePx;
    const y2 = centerY + sample2 * amplitudePx;

    // Direction of the path segment → rotate text along the wave
    const angle = Math.atan2(y2 - y, x2 - x);

    const ch = chars[charIndex % chars.length];
    charIndex++;

    push();
    translate(x, y);
    rotate(angle);
    text(ch, 0, 0);
    pop();
  }
}

// ===== PANEL TOGGLE + KEY HANDLER ==========================================
// EDIT HERE if you want a different key than "x" to toggle the panel
function keyPressed() {
  if (key === 'x' || key === 'X') {
    togglePanel();
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
