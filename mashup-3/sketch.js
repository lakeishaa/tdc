// === TWO-MIC VARIABLE FONT — 21 TEXT-ON-SINE PATHS (ITALIC VERSION) =======
// (cleaned version: TEXT_SIZE slider removed, debug removed; now per-character)
// ============================================================================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

let panelVisible = true;

// === GLOBAL ITALIC SETTINGS ================================================
const ITALIC_SHEAR = -0.30;

// === LAYOUT =================================================================
const NUM_LINES = 21;

let LINE_TOP_MARGIN_RATIO = 0.05;
let LINE_BOTTOM_MARGIN_RATIO = 0.05;

let BASE_WAVE_HEIGHT = 30;

let sensASlider, sensALabel;
let waveASensitivity = 1.0;

let sensBSlider, sensBLabel;
// Mic B now used as *color* sensitivity, name kept to minimize changes
let weightSensitivity = 1.0; 

let TEXT_SIZE = 22; // fixed, not in panel
let PHRASE_SPACING = 120; // base spacing from slider (acts like letter-spacing)

let WAVE_SPEED = 1.5;
const TWO_PI_FIXED = Math.PI * 2;

// ============================================================================
// COLOR SETTINGS
// ============================================================================

// base / quiet color (purple-ish)
const QUIET_COLOR = '#AD95C3';   // <<< quiet base color

// Mic B loud palette (cycles when Mic B hits peak loudness)
const MIC_B_COLORS = [
  '#AD95C3', // index 0
  '#B2E2EB', // index 1
  '#FBAFCE'  // index 2
];
// <<< You can change / reorder these hexes to adjust the cycling palette

// Mic B peak detection for color changes
const MIC_B_PEAK_THRESHOLD   = 0.75; // <<< how loud (0–1) Mic B must be to trigger a color change
const MIC_B_PEAK_COOLDOWN_MS = 100;  // <<< min ms between color changes so it doesn't flicker too fast

let micBColorIndex = 0;          // <<< current target color index (0..MIC_B_COLORS.length-1)
let micBLastPeakState = false;   // internal edge-detect state
let micBLastPeakChangeTime = 0;  // last millis() when color changed

// (MIC B weight constants kept but unused, safe to delete if you want)
const MIC_B_MIN_WEIGHT = 100;
const MIC_B_MAX_WEIGHT = 900;
const MIC_B_GAIN       = 40.0;


// === CANVAS SCALE ===========================================================
let canvasScale = 1.5;   // <<< CANVAS SCALE FACTOR
let scaleSlider, scaleLabel;

// === AUDIO ==================================================================
let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB;

let audioCtx = null;

// ============================================================================
// AUDIO CONTEXT HANDLER
// ============================================================================
async function getOrCreateAudioContext() {
  if (audioCtx) return audioCtx;
  if (typeof getAudioContext === "function") {
    audioCtx = getAudioContext();
  } else {
    audioCtx = window.__sharedCtx ||
      (window.__sharedCtx = new (window.AudioContext || window.webkitAudioContext)());
  }
  return audioCtx;
}

// ============================================================================
// SETUP
// ============================================================================
function setup() {
  createCanvas(windowWidth, windowHeight);

  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  // use the ITALIC family you defined in CSS
  textFont("WeAppealVariableItalic");

  // PANEL ===============================================================
  ctrlPanel = createDiv();
  ctrlPanel.id('ctrlPanel');
  ctrlPanel.style(`
    position: fixed;
    top: 10px; left: 10px;
    z-index: 9999;
    background: rgba(255,255,255,0.9);
    border-radius: 10px;
    padding: 8px 10px 10px 10px;
    font-family: system-ui;
    font-size: 12px;
    color: #111;
  `);

  hideBtn = createButton("×").parent(ctrlPanel);
  hideBtn.style(`
    position:absolute;
    top:4px; right:6px;
    background:transparent; border:none;
    width:20px; height:20px; cursor:pointer;
  `);
  hideBtn.mousePressed(togglePanel);

  const topRow = createDiv().parent(ctrlPanel)
    .style("display:flex; gap:6px; margin-top:14px;");

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn  = createButton("Start").parent(topRow);

  statusSpan = createSpan(' Step 1 → Enable Mics').parent(ctrlPanel);

  const row2 = createDiv().parent(ctrlPanel)
    .style("margin-top:6px; display:flex; gap:12px;");

  const groupA = createDiv().parent(row2).style("display:flex; gap:4px;");
  createSpan("Mic A:").parent(groupA);
  selA = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2).style("display:flex; gap:4px;");
  createSpan("Mic B:").parent(groupB);
  selB = createSelect().parent(groupB);

  // Mic A slider
  const row3 = createDiv().parent(ctrlPanel)
    .style("margin-top:6px;");

  const rowA = createDiv().parent(row3).style("display:flex; gap:6px;");
  createSpan("Mic A wave height:").parent(rowA);
  sensASlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(rowA);
  sensALabel = createSpan("×1.00").parent(rowA);
  sensASlider.input(() => {
    waveASensitivity = sensASlider.value();
    sensALabel.html("×" + waveASensitivity.toFixed(2));
  });

  // Mic B slider (now COLOR sensitivity)
  const rowB = createDiv().parent(row3).style("display:flex; gap:6px;");
  createSpan("Mic B color sens:").parent(rowB); // <<< label updated
  sensBSlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(rowB);
  sensBLabel = createSpan("×1.00").parent(rowB);
  sensBSlider.input(() => {
    weightSensitivity = sensBSlider.value();
    sensBLabel.html("×" + weightSensitivity.toFixed(2));
  });

  // Row 4 (spacing / base height / scale)
  const row4 = createDiv().parent(ctrlPanel)
    .style("display:flex; flex-direction:column; gap:6px; margin-top:6px;");

  // SPACING (acts as base letter-spacing factor)
  const sp = createDiv().parent(row4).style("display:flex; gap:6px;");
  createSpan("PHRASE_SPACING:").parent(sp);
  spacingSlider = createSlider(40, 260, PHRASE_SPACING, 1).parent(sp);
  spacingValueLabel = createSpan(PHRASE_SPACING + " (base spacing)").parent(sp);
  spacingSlider.input(() => {
    PHRASE_SPACING = spacingSlider.value();
    spacingValueLabel.html(PHRASE_SPACING + " (base spacing)");
  });

  // BASE HEIGHT
  const bh = createDiv().parent(row4).style("display:flex; gap:6px;");
  createSpan("BASE_WAVE_HEIGHT:").parent(bh);
  baseHeightSlider = createSlider(5, 80, BASE_WAVE_HEIGHT, 1).parent(bh);
  baseHeightValueLabel = createSpan(BASE_WAVE_HEIGHT + "px").parent(bh);
  baseHeightSlider.input(() => {
    BASE_WAVE_HEIGHT = baseHeightSlider.value();
    baseHeightValueLabel.html(BASE_WAVE_HEIGHT + "px");
  });

  // CANVAS SCALE
  const sc = createDiv().parent(row4).style("display:flex; gap:6px;");
  createSpan("CANVAS_SCALE:").parent(sc);
  scaleSlider = createSlider(0.5, 2.0, canvasScale, 0.01).parent(sc);
  scaleLabel = createSpan("×" + canvasScale.toFixed(2)).parent(sc);
  scaleSlider.input(() => {
    canvasScale = scaleSlider.value();
    scaleLabel.html("×" + canvasScale.toFixed(2));
  });

  [selA, selB, startBtn].forEach(el => el.attribute("disabled", true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  background(0);
  noStroke();
}

// ============================================================================
// ENABLE MICS
// ============================================================================
async function enableMicsOnce() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach(t => t.stop());

    const ctx = await getOrCreateAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    await loadAudioInputs();
    [selA, selB, startBtn].forEach(el => el.removeAttribute("disabled"));
    statusSpan.html(" Step 2 → Pick Mic A & Mic B, then press Start");

  } catch (e) {
    statusSpan.html(" Mic permission error.");
  }
}

// ============================================================================
// LOAD AUDIO DEVICES
// ============================================================================
async function loadAudioInputs() {
  selA.elt.innerHTML = "";
  selB.elt.innerHTML = "";

  const all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter(d => d.kind === "audioinput");

  devices.forEach(d => {
    const label = d.label || `Mic (${d.deviceId.slice(0,6)})`;
    selA.option(label, d.deviceId);
    selB.option(label, d.deviceId);
  });
}

// ============================================================================
// START MICROPHONE STREAMS
// ============================================================================
async function startStreams() {
  const idA = selA.value();
  const idB = selB.value();

  if (!idA || !idB || idA === idB) {
    statusSpan.html(" Pick two different devices.");
    return;
  }

  cleanupStreams();

  try {
    const ctx = await getOrCreateAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    const cA = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: idA } } });
    const cB = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: idB } } });

    streamA = cA;
    streamB = cB;

    const srcA = ctx.createMediaStreamSource(cA);
    const srcB = ctx.createMediaStreamSource(cB);

    anA = ctx.createAnalyser();
    anB = ctx.createAnalyser();

    anA.fftSize = 1024;
    anB.fftSize = 1024;

    anA.smoothingTimeConstant = 0.85;
    anB.smoothingTimeConstant = 0.85;

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html(" Streaming…");

    loop();

  } catch (e) {
    statusSpan.html(" Could not start streams.");
  }
}

function cleanupStreams() {
  [streamA, streamB].forEach(s => s?.getTracks().forEach(t => t.stop()));
  streamA = streamB = null;
  anA = anB = null;
}

function getRMS(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

// ============================================================================
// DRAW LOOP — NOW PER-CHARACTER, NOT PER-PHRASE
// ============================================================================
function draw() {
  background(0);

  // --- READ AUDIO ----------------------------------------------------------
  let loudA = 0;
  let loudB = 0;

  if (anA) {
    anA.getFloatTimeDomainData(bufA);
    loudA = getRMS(bufA);
  }
  if (anB) {
    anB.getFloatTimeDomainData(bufB);
    loudB = getRMS(bufB);
  }

  const NOISE_FLOOR = 0.005;

  // Mic A → ONLY wave height
  let volA = Math.max(0, loudA - NOISE_FLOOR) * waveASensitivity;
  volA = constrain(volA, 0, 1);

  // Mic B → ONLY COLOR (0–1)
  let volB = Math.max(0, loudB - NOISE_FLOOR);
  volB *= MIC_B_GAIN * weightSensitivity;   // gain + sensitivity slider
  volB = constrain(volB, 0, 1);

  // --- MIC B PEAK COLOR CYCLING --------------------------------------------
  const now = millis();
  const isPeak = volB >= MIC_B_PEAK_THRESHOLD; // <<< loudest zone flag

  // rising edge AND outside cooldown → advance color index
  if (isPeak && !micBLastPeakState &&
      (now - micBLastPeakChangeTime > MIC_B_PEAK_COOLDOWN_MS)) {

    micBColorIndex = (micBColorIndex + 1) % MIC_B_COLORS.length;
    micBLastPeakChangeTime = now;
  }
  micBLastPeakState = isPeak;

  // --- MAP TO VISUALS ------------------------------------------------------

  // Mic A controls amplitude of the sine
  const amplitude = BASE_WAVE_HEIGHT * (0.2 + volA * 20.0);

  // Keep font weight constant (just italic)
  const currentWeight = 400;

  drawingContext.font =
    `italic ${currentWeight} ${TEXT_SIZE}px "WeAppealVariableItalic"`;

  // Mic B controls color:
  // quiet → QUIET_COLOR
  // loud → lerp from QUIET_COLOR to the current palette color (index)
  const cQuiet = color(QUIET_COLOR);
  const cTarget = color(MIC_B_COLORS[micBColorIndex]);
  const cMix   = lerpColor(cQuiet, cTarget, volB);
  fill(cMix);

  noStroke();
  textAlign(CENTER, CENTER);

  // PHRASE_SPACING now PURELY from slider (no Mic B influence)
  const reactiveSpacing = PHRASE_SPACING;          // <<< only slider
  const spacingFactor   = reactiveSpacing / 120.0;

  // --- CANVAS TRANSFORM (unchanged) ----------------------------------------
  push();
  translate(width / 2, height / 2);
  scale(canvasScale);
  translate(-width / 2, -height / 2);

  const topMargin    = height * LINE_TOP_MARGIN_RATIO;
  const bottomMargin = height * LINE_BOTTOM_MARGIN_RATIO;

  const t      = millis() * 0.001;
  const phase  = t * WAVE_SPEED;

  for (let line = 0; line < NUM_LINES; line++) {
    const baseY = map(line, 0, NUM_LINES - 1, topMargin, height - bottomMargin);

    const phrase      = (line % 2 === 0) ? "same drugs" : "see you there";
    const phraseBlock = phrase + "   ";
    const blockLen    = phraseBlock.length;

    let xCursor   = -width;
    let charIndex = 0;

    while (xCursor < width + width) {
      const ch = phraseBlock[charIndex];

      const charW   = textWidth(ch) * spacingFactor;
      const centerX = xCursor + charW / 2;

      if (centerX > -50 && centerX < width + 50) {
        const u       = map(centerX, 0, width, 0, TWO_PI_FIXED);
        const yOffset = Math.sin(u + phase) * amplitude;
        const dy_dx   = amplitude * Math.cos(u + phase) * (TWO_PI_FIXED / width);
        const angle   = Math.atan2(dy_dx, 1);

        push();
        translate(centerX, baseY + yOffset);

        // italic shear (extra slant on top of italic font;
        // you can set ITALIC_SHEAR to 0 if it's too much)
        drawingContext.transform(1, 0, ITALIC_SHEAR, 1, 0, 0);

        rotate(angle);
        text(ch, 0, 0);
        pop();
      }

      xCursor   += charW;
      charIndex  = (charIndex + 1) % blockLen;
    }
  }

  pop();
}


// ============================================================================
// KEY HANDLER
// ============================================================================
function keyPressed(){
  if (key === 'x' || key === 'X'){
    if (ctrlPanel.elt.style.display === 'none') ctrlPanel.show();
    else ctrlPanel.hide();
  }

  if (key === 'm' || key === 'M'){
    startMicsFromKeyboard();
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


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
  if (panelVisible) ctrlPanel.hide();
  else ctrlPanel.show();
  panelVisible = !panelVisible;
}
