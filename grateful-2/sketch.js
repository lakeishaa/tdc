// === TWO-MIC VARIABLE FONT — TEXT-ONLY REACTIVE SCENE =======================
// Mic A → Center "GRATEFUL" (WeTravelogueVariableRoman, weight reacts to volume)
// Mic B → 5 rows of "GRATEFUL" (WeStacksVariable, pink, letters appear
//           one by one in random order once mic B volume passes a threshold)
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

// Fonts (assumes CSS @font-face already set up)
const FONT_A = 'WeTravelogueVariableRoman'; // Mic A
const FONT_B = 'WeStacksVariable';          // Mic B
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM elements for text
let micATextEl;          // center "GRATEFUL"
let micBRows = [];       // 5 row containers
let micBLetters = [];    // flat array of all letter spans for random reveal

// Layout
let baseSize;

// Sensitivity / threshold (controlled by sliders)
let sensAFactor   = 2.63; // Mic A sensitivity (weight)
let micBThreshold = 0.21; // Mic B threshold (letters); lower = more sensitive

// Slider + label elements
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
  const groupA = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA   = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB   = createSelect().parent(groupB);

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // === Sliders for sensitivity / threshold =================================
  const sensRow = createDiv().parent(ctrlPanel)
    .style('margin-top:8px; display:flex; flex-direction:column; gap:4px;');

  // Mic A sensitivity slider
  sensALabel = createSpan(`Mic A sensitivity (weight): ${sensAFactor.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600;');

  sensASlider = createSlider(0.5, 5, sensAFactor, 0.01)
    .parent(sensRow);
  sensASlider.style('width', '160px');

  // Mic B threshold slider
  sensBLabel = createSpan(`Mic B threshold (letters): ${micBThreshold.toFixed(2)}`)
    .parent(sensRow)
    .style('font-weight:600;');

  // Lower value = more sensitive; 0.01–0.5 is a nice range to play with
  sensBSlider = createSlider(0.01, 0.5, micBThreshold, 0.01)
    .parent(sensRow);
  sensBSlider.style('width', '160px');

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
    fontSize: `${baseSize.toFixed(1)}px`,
    lineHeight: '1',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    willChange: 'font-variation-settings, font-stretch',
    fontOpticalSizing: 'none',
    fontFamily: `"${FONT_A}", system-ui, sans-serif`,
    color: '#ffffff',
    letterSpacing: '0.04em',
    zIndex: 3
  });
  micATextEl.textContent = 'GRATEFUL';
  micATextEl.style.fontVariationSettings =
    `'wght' 400, 'wdth' 100, 'slnt' 0, 'ital' 0`;
  micATextEl.style.fontStretch = '100%';

  // ===== 5 rows of text for Mic B ==========================================
  createMicBRows();

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

function createMicBRows() {
  const existing = document.getElementById('micBWrapper');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'micBWrapper';
  document.body.appendChild(wrapper);
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: '100vw',
    height: '100vh',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 2 // under micAText, above canvas
  });

  micBRows = [];
  micBLetters = [];

  const word = 'GRATEFUL';
  const rowCount = 5;

  for (let i = 0; i < rowCount; i++) {
    const row = document.createElement('div');
    micBRows.push(row);
    Object.assign(row.style, {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100vw',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: `"${FONT_B}", system-ui, sans-serif`,
      textTransform: 'uppercase',
      fontSize: 'min(12vw, 80px)',
      color: '#ff7ac8', // pink
      letterSpacing: '0.1em',
      opacity: 1,
      top: `${15 + i * 14}%`, // spread vertically
    });

    // Create spans per letter, all initially hidden
    for (let c = 0; c < word.length; c++) {
      const span = document.createElement('span');
      span.textContent = word[c];
      Object.assign(span.style, {
        opacity: 0,
        transition: 'opacity 0.35s ease-out'
      });
      row.appendChild(span);
      micBLetters.push(span);
    }

    wrapper.appendChild(row);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  baseSize = Math.min(windowWidth * 0.14, 160);
  micATextEl.style.fontSize = `${baseSize.toFixed(1)}px`;
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

    statusSpan.html('  Streaming… Mic A → weight, Mic B → reveal letters');
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

  // Read slider values each frame and update globals + labels
  if (sensASlider) {
    sensAFactor = sensASlider.value();
    if (sensALabel) {
      sensALabel.html(`Mic A sensitivity (weight): ${sensAFactor.toFixed(2)}`);
    }
  }

  if (sensBSlider) {
    micBThreshold = sensBSlider.value();
    if (sensBLabel) {
      sensBLabel.html(`Mic B threshold (letters): ${micBThreshold.toFixed(2)}`);
    }
  }

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  // These two functions are where you map audio → design:
  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ===== AUDIO → DESIGN MAPPING ===============================================
// Tweak THESE functions to change how reactive the visuals are.

function updateMicADesign(rmsA) {
  // Mic A: controls WEIGHT of center "GRATEFUL"
  // Apply sensitivity factor to Mic A
  const adjusted = rmsA * sensAFactor;
  // Map adjusted 0..0.25 → wght 100..900 (clamped)
  const wght = clamp(map(adjusted, 0, 0.25, 100, 900), 200, 900);
  micATextEl.style.fontVariationSettings =
    `'wght' ${wght.toFixed(1)}, 'wdth' 100, 'slnt' 0, 'ital' 0`;
}

function updateMicBDesign(rmsB) {
  // Mic B: reveal letters one by one once volume crosses threshold
  if (!anB) return;

  if (rmsB > micBThreshold) {
    // Only ever reveal 1 letter per frame
    revealRandomMicBLetter();
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

function revealRandomMicBLetter() {
  if (!micBLetters.length) return;

  // Collect indices of currently hidden letters
  const hiddenIndices = [];
  for (let i = 0; i < micBLetters.length; i++) {
    if (micBLetters[i].style.opacity === '' || micBLetters[i].style.opacity === '0') {
      hiddenIndices.push(i);
    }
  }
  if (!hiddenIndices.length) return;

  const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  micBLetters[idx].style.opacity = '1';
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// using p5.js global map()
