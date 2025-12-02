// === TWO-MIC VARIABLE FONT + SCRIPT A / SCRIPT B SCENE ======================
// Mic A → Script A: 7-row star block (WeStacksVariable), SHPE + wght react to volume
//         and each blue star character rotates individually in place.
// Mic B → Script B: 10 vertical "::-::-::-::-::-" columns (WeSpoliaVariable),
//         audio-reactive via font weight, endless vertical scroll,
//         and each character rotates on the spot.
// ============================================================================

// ================== PANEL & AUDIO GLOBALS (BOTH MICS) ======================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Mic A sensitivity slider UI + value
let sensASlider, sensALabel;
let micASensitivity = 1.0; // <<< Script A loudness multiplier

// Mic B sensitivity slider UI + value
let sensBSlider, sensBLabel;
let micBSensitivity = 1.0; // <<< Script B loudness multiplier

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB; // analyser buffers for A & B

// ====================== FONTS / GLOBALS ====================================

// Fonts (assumes CSS @font-face already set up)
/*
@font-face {
  font-family: "WeStacksVariable";
  src: url("WeStacksVariable.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "WeSpoliaVariable";
  src: url("WeSpoliaVariable.ttf") format("truetype");
  font-weight: 10 900;
  font-style: normal;
  font-display: swap;
}
*/

const FONT_A = 'WeStacksVariable';   // Script A (star block, blue)
const FONT_B = 'WeSpoliaVariable';   // Script B (vertical columns, white)
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// ============================================================================
// ================== SCRIPT A (MIC A) — STAR BLOCK ===========================
// ============================================================================

// ================== ADJUSTABLE LAYOUT SETTINGS =====================

// How big the whole star block is relative to screen height
let BLOCK_SIZE_RATIO = 1.5;

// Vertical spacing between rows (relative to per-row height)
// 1.0 = rows touching, >1 = more space, <1 = overlapping (negative = heavy overlap)
let ROW_SPACING_MULT = -1;

// Text size relative to each row slot
let TEXT_SIZE_FACTOR = 0.8;

// Kerning / letter spacing relative to font size
// 1 = very spaced, 0 = normal, negative = tighter
let LETTER_SPACING_RATIO = 1;

// Line-height inside each row
let LINE_HEIGHT_MULT = 0.9;

// X offset (px) — Positive = move right, Negative = move left (BASE pos)
let BLOCK_X_OFFSET = 0;

// Y offset (px) — Positive = move down, Negative = move up
let BLOCK_Y_OFFSET = 0;

// ==== STAR BLOCK HORIZONTAL LOOP (Mic A blue text) ==========================
// Speed in pixels per second: positive = move right, negative = move left
let STAR_SCROLL_SPEED = 40;     // <<< edit this for faster/slower infinite loop
let starScrollOffset = 0;       // internal accumulator
let STAR_SCROLL_ENABLED = true; // toggle on/off

// The 7 rows of stars
let STAR_ROWS = [
  "********",
  "*********",
  "********",
  "*********",
  "********",
  "*********",
  "********"
];

let starWrapper;    // first copy
let starWrapper2;   // second copy
let starWrapper3;   // third copy (to overfill width)
let baseSize;       // reused for Script A layout
let starWidth = 0;  // measured pixel width of one block

// Store every individual blue star character <span> so we can rotate each
let starCharSpans = []; // <<< all blue characters (from all 3 copies) live here

// ===== Mic A AUDIO → VARIABLE FONT MAPPING (EDIT THESE) =====================

// Expected RMS range from Mic A (input loudness range)
let A_RMS_MIN = 0.0;    // <<< RMS considered "quiet"
let A_RMS_MAX = 0.25;   // <<< RMS considered "loud"

// SHPE axis range
// quiet → A_SHPE_MAX, loud → A_SHPE_MIN (so it "inverts" as you get louder)
let A_SHPE_MIN = 0.0;   // <<< SHPE minimum (default 0)
let A_SHPE_MAX = 3.0;   // <<< SHPE maximum (default 3)

// Weight axis range (for wght axis on WeStacksVariable)
let A_WGHT_MIN = 200;   // <<< lightest weight
let A_WGHT_MAX = 900;   // <<< heaviest weight

// ==== BLUE STAR CHARACTER ROTATION (Script A / Mic A) ======================

// Rotation speed (radians per second) for each blue star character
// Increase for faster spin, decrease for slower
let BLUE_CHAR_ROT_SPEED = 1.0;   // <<< EDIT THIS for blue star rotation speed

// Y-offset for the rotation center of each blue character (in pixels)
// Positive = nudge rotation origin down, Negative = nudge it up
let BLUE_CHAR_Y_ORIGIN_OFFSET = -6; // <<< EDIT THIS to tweak center origin Y

// ============================================================================
// ================== SCRIPT B (MIC B) — VERTICAL COLUMNS =====================
// ============================================================================

// ================= ADJUSTABLE LAYOUT SETTINGS =====================

// How many columns
let NUM_COLS = 10;

// The text in each column
const TEXT_STRING = "::-::-::-::-::-";

// TEXT SIZE CONTROL:
// 1.0  → make the vertical length ≈ full screen height
// 0.5  → about half the screen height, etc.
let TEXT_SCALE = 1.0;

// SPACING CONTROL (HORIZONTAL):
// 0.05 → 5% margin left & right (columns spread across the middle 90%)
// increase = more side margin, columns packed tighter
let COL_MARGIN = 0.05;

// Variable font name
const VARIABLE_FONT = "WeSpoliaVariable";

// ==== VERTICAL SCROLL FOR WHITE COLUMNS (Mic B) =============================
// Speed in pixels per second (how fast the white columns move down)
let COL_SCROLL_SPEED = 40;      // <<< edit this to make columns fall faster/slower
let colScrollOffset = 0;        // internal scroll accumulator

// ==== CHARACTER ROTATION (Script B) ========================================

// Character rotation speed in radians per second
// Increase for faster spin, decrease for slower spin
let CHAR_ROT_SPEED = 1.2;  // <<< EDIT THIS for white column rotation speed

// Small Y-offset tweak for the character's rotation center
// Positive = move origin down a bit, Negative = move up
let CHAR_Y_ORIGIN_OFFSET = -5; // <<< EDIT THIS to adjust white char center origin Y

// ===== Mic B AUDIO → FONT WEIGHT MAPPING (EDIT THESE) =======================

// Expected RMS range from Mic B
let B_RMS_MIN = 0.0;    // <<< Mic B quiet RMS
let B_RMS_MAX = 0.25;   // <<< Mic B loud RMS

// Weight range for vertical columns
let B_WGHT_MIN = 50;    // <<< font-weight when quiet
let B_WGHT_MAX = 500;   // <<< font-weight when loud

// ============================================================================

function setup() {
  // Make page truly full-screen & centered relative to viewport
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';

  createCanvas(windowWidth, windowHeight);

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

  // Tiny "X" close button
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

  const groupA = createDiv().parent(row2)
    .style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA = createSelect().parent(groupA);

  const groupB = createDiv().parent(row2)
    .style('display:flex; align-items:center; gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB = createSelect().parent(groupB);

  // Mic A sensitivity slider row
  const row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensALabelText = createSpan('Mic A sensitivity:').parent(row3);
  sensALabelText.style('font-weight:600;');

  sensASlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(row3);
  sensASlider.style('width:120px;');

  sensALabel = createSpan('×1.0').parent(row3);
  sensALabel.style('min-width:40px; text-align:right;');

  micASensitivity = sensASlider.value();
  sensASlider.input(() => {
    micASensitivity = sensASlider.value();
    sensALabel.html('×' + micASensitivity.toFixed(2));
  });

  // Mic B sensitivity slider row
  const row4 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;');

  const sensBLabelText = createSpan('Mic B sensitivity:').parent(row4);
  sensBLabelText.style('font-weight:600;');

  sensBSlider = createSlider(0.2, 4.0, 1.0, 0.01).parent(row4);
  sensBSlider.style('width:120px;');

  sensBLabel = createSpan('×1.0').parent(row4);
  sensBLabel.style('min-width:40px; text-align:right;');

  micBSensitivity = sensBSlider.value();
  sensBSlider.input(() => {
    micBSensitivity = sensBSlider.value();
    sensBLabel.html('×' + micBSensitivity.toFixed(2));
  });

  [selA, selB, startBtn].forEach(el => el.attribute('disabled', true));

  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // ===== SCRIPT A: STAR BLOCK DOM (THREE COPIES FOR LOOP) ===================
  starWrapper = createDiv();
  starWrapper.id('starBlock');
  buildStarBlock(starWrapper); // <<< build char spans for copy 1

  starWrapper2 = createDiv();
  starWrapper2.id('starBlock2');
  buildStarBlock(starWrapper2); // <<< copy 2

  starWrapper3 = createDiv();
  starWrapper3.id('starBlock3');
  buildStarBlock(starWrapper3); // <<< copy 3

  layoutStars();

  // ===== Font loading (best-effort) ========================================
  if (document.fonts && document.fonts.load) {
    Promise.all(fontFamilies.map(f => document.fonts.load(`700 1em "${f}"`)))
      .then(() => {
        fontsReady = true;
        // After fonts load, recompute width to remove any gap due to font swap
        layoutStars();
      })
      .catch(() => { fontsReady = true; });
  } else {
    fontsReady = true;
  }

  // Analyser buffers
  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  background(0);
  noStroke();
  textAlign(CENTER, CENTER);

  window.addEventListener('beforeunload', cleanupStreams);
}

function draw() {
  background(0); // black canvas

  const rmsA = analyserRMS(anA, bufA);
  const rmsB = analyserRMS(anB, bufB);

  // Time in seconds since last frame
  let dt = deltaTime / 1000.0;

  // === UPDATE SCROLL OFFSET FOR WHITE COLUMNS (Mic B) ======================
  colScrollOffset += COL_SCROLL_SPEED * dt;

  // === UPDATE SCROLL OFFSET FOR BLUE STAR BLOCK (Mic A) ====================
  if (STAR_SCROLL_ENABLED && starWidth > 0) {
    // Endless rightward scroll by one block width
    starScrollOffset = (starScrollOffset + STAR_SCROLL_SPEED * dt) % starWidth;

    // Base X includes your BLOCK_X_OFFSET
    let baseX = -starWidth + starScrollOffset + BLOCK_X_OFFSET;

    // Three tiled copies: [..., block1, block2, block3, ...]
    if (starWrapper) {
      starWrapper.style(
        'transform',
        `translate(${baseX}px, -50%)`
      );
    }
    if (starWrapper2) {
      starWrapper2.style(
        'transform',
        `translate(${baseX + starWidth}px, -50%)`
      );
    }
    if (starWrapper3) {
      starWrapper3.style(
        'transform',
        `translate(${baseX + 2 * starWidth}px, -50%)`
      );
    }
  }

  // Mic A → Script A (star block, audio-reactive)
  updateMicADesign(rmsA);

  // === BLUE STAR PER-CHARACTER ROTATION ====================================
  let tBlue = millis() / 1000.0;
  let angleBlue = tBlue * BLUE_CHAR_ROT_SPEED; // <<< rotation speed for blue stars

  for (let i = 0; i < starCharSpans.length; i++) {
    const span = starCharSpans[i];
    // translateY nudges the "center" up/down before rotation
    span.style(
      'transform',
      `translateY(${BLUE_CHAR_Y_ORIGIN_OFFSET}px) rotate(${angleBlue}rad)`
    );
  }

  // Mic B → Script B (vertical columns, endless downward + per-char spin)
  updateMicBDesign(rmsB);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutStars();
}

// ===== BUILD STAR BLOCK (DOM) — PER-CHARACTER SPANS ========================
// This replaces the old logic that just put the row text directly in one div.
// Now each character is its own <span>, so we can rotate them individually.
function buildStarBlock(wrapper) {
  STAR_ROWS.forEach(rowText => {
    const rowDiv = createDiv().parent(wrapper);
    rowDiv.style('white-space', 'nowrap');

    for (let i = 0; i < rowText.length; i++) {
      const ch = rowText[i];
      const span = createSpan(ch).parent(rowDiv);
      span.style('display', 'inline-block'); // needed so transform applies per char
      // no transform yet; we set it every frame in draw()
      starCharSpans.push(span); // store so we can rotate later
    }
  });
}

// ===== LAYOUT LOGIC FOR SCRIPT A (APPLIED TO ALL COPIES) ====================
function layoutStars() {
  if (!starWrapper) return;

  baseSize = Math.min(windowWidth, windowHeight) * BLOCK_SIZE_RATIO;

  const numRows = STAR_ROWS.length;
  const rowSlotHeight = baseSize / numRows;
  const fontSizePx = rowSlotHeight * TEXT_SIZE_FACTOR;
  const gapPx = rowSlotHeight * (ROW_SPACING_MULT - 1);

  // Kerning in px
  const letterSpacingPx = fontSizePx * LETTER_SPACING_RATIO;

  // We anchor at left:0 and move horizontally via translateX()
  const styleBlock = `
    position: fixed;
    left: 0px;
    top: calc(50% + ${BLOCK_Y_OFFSET}px);
    transform: translate(0, -50%);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    width: fit-content;
    height: ${baseSize}px;

    gap: ${gapPx}px;
    font-family: "${FONT_A}", system-ui, sans-serif;
    font-size: ${fontSizePx}px;
    line-height: ${LINE_HEIGHT_MULT};
    letter-spacing: ${letterSpacingPx}px;

    color: #B2E2EA;  /* blue */
    font-variation-settings: 'wght' ${A_WGHT_MIN}, 'SHPE' ${A_SHPE_MAX};
    font-optical-sizing: none;
    pointer-events: none;
    z-index: 3;
  `;

  starWrapper.style(styleBlock);
  if (starWrapper2) starWrapper2.style(styleBlock);
  if (starWrapper3) starWrapper3.style(styleBlock);

  // Measure actual pixel width of ONE block for perfect tiling
  const rect = starWrapper.elt.getBoundingClientRect();
  starWidth = rect.width || 0;
}

// ===== KEYBOARD TOGGLE: 'X' SHOW/HIDE PANEL ================================
function keyPressed() {
  if (key === 'x' || key === 'X') {
    if (ctrlPanel) {
      const disp = ctrlPanel.elt.style.display;
      if (disp === 'none') {
        ctrlPanel.show();
      } else {
        ctrlPanel.hide();
      }
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

//////////////// i added this

// ===== MIC ENABLE + DEVICE PICKER (TWO MICS) ================================
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
  if (idxIPhone >= 0 && idxIPhone !== idxBuiltIn) selB.selected(devices[idxIPhone]);
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

    statusSpan.html('  Streaming… Mic A → star block, Mic B → vertical columns');
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

// ===== AUDIO → DESIGN MAPPING (SCRIPT A / MIC A) ============================
function updateMicADesign(rmsA) {
  if (!starWrapper) return;

  const scaled = rmsA * micASensitivity;

  // Normalize 0..1 using A_RMS_MIN / A_RMS_MAX
  let norm = 0;
  if (A_RMS_MAX > A_RMS_MIN) {
    norm = (scaled - A_RMS_MIN) / (A_RMS_MAX - A_RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  // quiet → SHPE = A_SHPE_MAX, loud → SHPE = A_SHPE_MIN (inverted)
  const shpe = lerp(A_SHPE_MAX, A_SHPE_MIN, norm);
  const wght = lerp(A_WGHT_MIN, A_WGHT_MAX, norm);

  // Apply variable font axes to all copies so they stay identical
  const fvs = `'wght' ${wght.toFixed(1)}, 'SHPE' ${shpe.toFixed(2)}`;
  starWrapper.style('font-variation-settings', fvs);
  if (starWrapper2) starWrapper2.style('font-variation-settings', fvs);
  if (starWrapper3) starWrapper3.style('font-variation-settings', fvs);
}

// ===== AUDIO → DESIGN MAPPING (SCRIPT B / MIC B) ============================
function updateMicBDesign(rmsB) {
  // Sensitivity multiplies RMS
  let scaledB = rmsB * micBSensitivity;

  // Normalize 0..1 using B_RMS_MIN / B_RMS_MAX
  let norm = 0;
  if (B_RMS_MAX > B_RMS_MIN) {
    norm = (scaledB - B_RMS_MIN) / (B_RMS_MAX - B_RMS_MIN);
  }
  norm = constrain(norm, 0, 1);

  // Map volume → weight
  const weight = lerp(B_WGHT_MIN, B_WGHT_MAX, norm);

  // ==== Drawing logic from Script B ===================
  fill(255);
  textAlign(CENTER, CENTER);
  textFont(VARIABLE_FONT);

  // Measure width at reference size
  textSize(100);
  let baseWidth = textWidth(TEXT_STRING);

  // Target "height" when rotated = screen height * TEXT_SCALE
  let targetHeight = height * TEXT_SCALE;
  let txtSize = targetHeight;
  if (baseWidth > 0) {
    txtSize = (targetHeight * 100.0) / baseWidth;
  }

  textSize(txtSize);

  // Force variable font with current audio-reactive weight
  drawingContext.font = `${weight} ${txtSize}px ${VARIABLE_FONT}`;

  // Column placement across width
  let innerWidth = width * (1 - 2 * COL_MARGIN);
  let startX = width * COL_MARGIN;
  let stepX = (NUM_COLS > 1) ? innerWidth / (NUM_COLS - 1) : 0;

  // === Endless vertical loop with extra rows (no gaps) =====================
  let span = targetHeight; // vertical span of one rotated string
  if (span <= 0) span = height; // fallback

  // offset in [0, span)
  let offset = ((colScrollOffset % span) + span) % span;

  // Time in seconds for character rotation animation
  let t = millis() / 1000.0;

  // Pre-compute total width of the full TEXT_STRING at this size
  let totalStringWidth = textWidth(TEXT_STRING);
  if (totalStringWidth <= 0) totalStringWidth = targetHeight;

  for (let i = 0; i < NUM_COLS; i++) {
    let x = startX + i * stepX;

    // We tile from a bit above the screen to a bit below
    for (let yStart = -span; yStart < height + span; yStart += span) {
      let y = yStart + offset;

      push();
      translate(x, y);

      // Column orientation: alternate -90 / +90 degrees
      if (i % 2 === 0) {
        rotate(-HALF_PI); // -90 degrees
      } else {
        rotate(HALF_PI);  // +90 degrees
      }

      // Center the full string horizontally around (0,0)
      let startCharX = -totalStringWidth / 2;

      // Draw each character individually, rotating on its own center
      let runningX = startCharX;

      let angleWhite = t * CHAR_ROT_SPEED; // <<< rotation speed for white chars

      for (let cIndex = 0; cIndex < TEXT_STRING.length; cIndex++) {
        let ch = TEXT_STRING.charAt(cIndex);
        let cw = textWidth(ch);

        // Center of this character along the string
        let cx = runningX + cw / 2;

        push();
        // Move to character center, with a small Y-offset tweak
        translate(cx, CHAR_Y_ORIGIN_OFFSET); // <<< adjust CHAR_Y_ORIGIN_OFFSET above
        // Rotate this single character in place
        rotate(angleWhite);
        text(ch, 0, 0);
        pop();

        runningX += cw;
      }

      pop();
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

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// p5's map(), lerp(), constrain() are used from p5
