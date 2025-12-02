// === TWO-MIC VARIABLE FONT — DUAL WAVEFORM SCENE ===========================
// Mic A → Thin waveform line in #B2E2EB (blue), drawn ON TOP
// Mic B → Thin waveform line in #AD95C3 (purple), behind
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
let BASE_WAVE_HEIGHT = 120; // <<< EDITABLE: default base wave height (px)

// Mic A sensitivity (vertical amplitude multiplier)
let sensASlider, sensALabel;
let waveASensitivity = 1.0; // <<< Mic A loudness → wave height

// Mic B sensitivity (vertical amplitude multiplier)
let sensBSlider, sensBLabel;
let waveBSensitivity = 1.0; // <<< Mic B loudness → wave height

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

  // === Wave sensitivity sliders ============================================
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

  // Disable selects + Start until mics are enabled
  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  background(0);
  noFill();
  strokeWeight(2);

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

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html('  Streaming… Mic A → blue wave (front), Mic B → purple wave (back)');
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

// ===== DRAW LOOP — OVERLAPPED WAVEFORMS ====================================
function draw() {
  background(0); // black

  // Same Y for both, so they overlap perfectly
  const centerY = height * WAVE_CENTER_Y_RATIO; // <<< EDIT HERE to move both

  // Draw Mic B FIRST (purple, back)
  drawWaveFromAnalyser(
    anB,
    bufB,
    MIC_B_COLOR,
    centerY,
    BASE_WAVE_HEIGHT * waveBSensitivity
  );

  // Then draw Mic A (blue) ON TOP
  drawWaveFromAnalyser(
    anA,
    bufA,
    MIC_A_COLOR,
    centerY,
    BASE_WAVE_HEIGHT * waveASensitivity
  );
}

// Draws a thin waveform line across the screen for a given analyser
function drawWaveFromAnalyser(analyser, buffer, strokeColor, centerY, amplitudePx) {
  if (!analyser) return;

  analyser.getFloatTimeDomainData(buffer);

  stroke(strokeColor);
  noFill();
  strokeWeight(2); // <<< EDITABLE: line thickness

  beginShape();
  const len = buffer.length;
  for (let i = 0; i < len; i++) {
    const x = map(i, 0, len - 1, 0, width);
    // buffer[i] is roughly -1..+1 → scale to pixels
    const y = centerY + buffer[i] * amplitudePx;
    vertex(x, y);
  }
  endShape();
}

// ===== PANEL TOGGLE + KEY HANDLER ==========================================
// EDIT HERE if you want a different key than "x" to toggle the panel
function keyPressed() {
  if (key === 'x' || key === 'X') {
    togglePanel();
  }
  
  ////// added this
   if (key === 'm' || key === 'M'){
    startMicsFromKeyboard();
  }

  //////added this
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
