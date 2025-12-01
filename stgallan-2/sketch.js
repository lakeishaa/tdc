// === TWO-MIC VARIABLE FONT + DOT GRID SCENE ================================
// Mic A → Bottom row of rectangles (gradient widths across screen).
//         At quietest: same layout logic as the standalone rectangle sketch,
//         but with more bars / tighter spacing so it looks continuous.
//         As volume increases: rectangles get thinner, same x/y baseline.
// Mic B → Rotating audio-reactive dot grid ('.' size + rotation)
// ============================================================================

// ================== PANEL & AUDIO GLOBALS (BOTH MICS) ======================

let ctrlPanel, statusSpan, enableBtn, startBtn;
let hideBtn;
let selA, selB;

// Mic A sensitivity slider UI + value
let sensASlider, sensALabel;
let micASensitivity = 1.0; // <<< Mic A: multiplier for Mic A loudness

// Mic B sensitivity slider UI + value
let sensBSlider, sensBLabel;
let micBSensitivity = 1.0; // <<< Mic B: multiplier for Mic B loudness

// Rotation speed slider
let rotSlider, rotLabel;

let devices = [];
let streamA = null, streamB = null;
let anA = null, anB = null;
let bufA, bufB; // analyser buffers for A & B

// ====================== MIC A — RECTANGLE STRIP ============================

// (Fonts kept just in case you want them later)
const FONT_A = 'WeStacksVariable';
const FONT_B = 'WeStacksVariable';
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// ================== ADJUSTABLE RECT SETTINGS ===============================

// Number of rectangles — more bars so there's no visible gap
let NUM_RECTS = 17;

// Height of all rectangles as a fraction of screen height
let RECT_HEIGHT_RATIO = 0.5; // <<< move strip up/down

// Gradient base weights (left → right)
let MIN_WIDTH_WEIGHT = 1; // thinnest
let MAX_WIDTH_WEIGHT = 12; // thickest

// Rectangle spacing (in pixels) — smaller = tighter, more continuous
let RECT_SPACING = 28;

// How much the group extends beyond the canvas at quiet
let RECT_OVERFILL = 1.15;

// Colors
let BG_COLOR = "#000000";
let RECT_COLOR = "#B2E2EA";

// MIC A: smoothing + loudness mapping
let micAVisualLevel = 0;
let MIC_A_SMOOTHING = 0.9;
let MIC_A_RMS_MAX = 0.25;

// How thin rectangles get at maximum loudness (relative to quiet layout)
let RECT_THIN_SCALE_AT_MAX = 0.3;


// ==================== MIC B DOT GRID PARAMETERS (UNCHANGED) ===============

let GRID_SCALE = 1.3;
let ROWS = 9;
let MAX_SIZE_BASE = 80;
let MIN_SIZE = 1;
let CURVE_STEEPNESS = 2;
let H_GAP_SCALE = 0.5;
let MAX_SPACING = 50;
let MIN_SPACING = 40;
let GRID_OVERSCAN = 1.1;

// Volume mapping for Mic B
let RMS_MIN = 0.0;
let RMS_MAX = 0.25;
let SIZE_SCALE_MIN = 0.4;
let SIZE_SCALE_MAX = 1.4;

// Rotation
let ROT_SPEED_BASE = 0.005;
let rotationSpeed = ROT_SPEED_BASE;
let angle = 0;

// ============================================================================


function setup() {
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';

  createCanvas(windowWidth, windowHeight);

  // ========================================================================
  // PANEL
  // ========================================================================
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
    top:4px;
    right:6px;
    background:transparent;
    border:none;
    font-size:14px;
    cursor:pointer;
  `);
  hideBtn.mousePressed(()=>ctrlPanel.hide());

  const topRow = createDiv().parent(ctrlPanel)
    .style('display:flex;gap:6px;align-items:center;margin-top:14px;');

  enableBtn = createButton("Enable Mics").parent(topRow);
  startBtn = createButton("Start").parent(topRow);

  statusSpan = createSpan(' Step 1 → Enable Mics').parent(ctrlPanel);

  const row2 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px;display:flex;gap:10px;');

  let groupA = createDiv().parent(row2).style('display:flex;gap:4px;');
  createSpan('Mic A:').parent(groupA).style('font-weight:600;');
  selA = createSelect().parent(groupA);

  let groupB = createDiv().parent(row2).style('display:flex;gap:4px;');
  createSpan('Mic B:').parent(groupB).style('font-weight:600;');
  selB = createSelect().parent(groupB);

  // Mic A sensitivity
  let row3 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px;display:flex;gap:6px;');
  createSpan('Mic A sensitivity:').parent(row3).style('font-weight:600;');
  sensASlider = createSlider(0.2,4.0,1.0,0.01).parent(row3).style('width:120px;');
  sensALabel = createSpan('×1.00').parent(row3);
  sensASlider.input(()=>{
    micASensitivity = sensASlider.value();
    sensALabel.html('×'+micASensitivity.toFixed(2));
  });

  // Mic B sensitivity
  let row4 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px;display:flex;gap:6px;');
  createSpan('Mic B sensitivity:').parent(row4).style('font-weight:600;');
  sensBSlider = createSlider(0.2,4.0,1.0,0.01).parent(row4).style('width:120px;');
  sensBLabel = createSpan('×1.00').parent(row4);
  sensBSlider.input(()=>{
    micBSensitivity = sensBSlider.value();
    sensBLabel.html('×'+micBSensitivity.toFixed(2));
  });

  // Rotation
  let row5 = createDiv().parent(ctrlPanel)
    .style('margin-top:6px;display:flex;gap:6px;');
  createSpan('Rotation speed:').parent(row5).style('font-weight:600;');
  rotSlider = createSlider(0,0.1,ROT_SPEED_BASE,0.001).parent(row5).style('width:120px;');
  rotLabel = createSpan(ROT_SPEED_BASE.toFixed(3)).parent(row5);
  rotSlider.input(()=>{
    rotationSpeed = rotSlider.value();
    rotLabel.html(rotationSpeed.toFixed(3));
  });

  [selA, selB, startBtn].forEach(el=>el.attribute('disabled',true));
  enableBtn.mousePressed(enableMicsOnce);
  startBtn.mousePressed(startStreams);

  // Font load (kept, but not required for rects)
  if (document.fonts && document.fonts.load){
    Promise.all(fontFamilies.map(f=>document.fonts.load(`700 1em "${f}"`)))
      .then(()=>fontsReady=true).catch(()=>fontsReady=true);
  } else {
    fontsReady = true;
  }

  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  background(0);
  noStroke();
  textFont("monospace");
  textAlign(CENTER,CENTER);
}

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
}

// X toggles panel
function keyPressed(){
  if (key==='x' || key==='X'){
    if (ctrlPanel.elt.style.display==='none') ctrlPanel.show();
    else ctrlPanel.hide();
  }
}

// ======================= AUDIO SETUP ======================================

async function enableMicsOnce(){
  try{
    await navigator.mediaDevices.getUserMedia({audio:true});
    await loadAudioInputs();
    [selA, selB, startBtn].forEach(el=>el.removeAttribute('disabled'));
    statusSpan.html(" Step 2 → Select mics, then Start");
  } catch(e){
    statusSpan.html(" Mic access denied.");
  }
}

async function loadAudioInputs(){
  selA.elt.innerHTML="";
  selB.elt.innerHTML="";

  let all = await navigator.mediaDevices.enumerateDevices();
  devices = all.filter(d=>d.kind==="audioinput");

  devices.forEach(d=>{
    let label = d.label || `Mic (${d.deviceId.slice(0,6)})`;
    selA.option(label,d.deviceId);
    selB.option(label,d.deviceId);
  });
}

async function startStreams(){
  let idA = selA.value();
  let idB = selB.value();
  if (!idA || !idB) return;

  cleanupStreams();
  try{
    const ctx = new AudioContext();
    let cA = await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:idA}}});
    let cB = await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:idB}}});

    streamA=cA; streamB=cB;
    let srcA = ctx.createMediaStreamSource(streamA);
    let srcB = ctx.createMediaStreamSource(streamB);

    anA = ctx.createAnalyser();
    anB = ctx.createAnalyser();
    anA.fftSize=1024;
    anB.fftSize=1024;

    srcA.connect(anA);
    srcB.connect(anB);

    statusSpan.html(" Streaming…");
    loop();

  }catch(e){
    statusSpan.html(" Error starting streams.");
  }
}

function cleanupStreams(){
  [streamA,streamB].forEach(s=>{
    if (s) s.getTracks().forEach(t=>t.stop());
  });
  streamA=streamB=null;
  anA=anB=null;
}

// =========================== DRAW =========================================

function draw(){
  background(BG_COLOR);

  const rmsA = analyserRMS(anA,bufA);
  const rmsB = analyserRMS(anB,bufB);

  updateMicBDesign(rmsB);
  updateMicADesign(rmsA);

}

// ====================== MIC A RECTANGLES (REVERSED REACTIVITY) ============
// QUIET → thinnest bars
// LOUD → widest bars (baseline quiet layout)
// Always centered, always covers edges (no gaps)

function updateMicADesign(rmsA){
  // Apply sensitivity
  let scaled = rmsA * micASensitivity;

  // Smooth the response
  micAVisualLevel = lerp(micAVisualLevel, scaled, 1 - MIC_A_SMOOTHING);

  // Normalized loudness 0 → 1
  let audioNorm = clamp(map(micAVisualLevel, 0, MIC_A_RMS_MAX, 0, 1), 0, 1);

  // Geometry
  let rectH = height * RECT_HEIGHT_RATIO;
  // centered vertically
  let y = (height - rectH) / 2;

  // --- BASE QUIET LAYOUT (same shape as your standalone sketch) ---

  let preWidthsQuiet = [];
  let totalWidthWeightsQuiet = 0;

  for (let i = 0; i < NUM_RECTS; i++) {
    let baseWeight = map(i, 0, NUM_RECTS - 1, MIN_WIDTH_WEIGHT, MAX_WIDTH_WEIGHT);
    preWidthsQuiet.push(baseWeight);
    totalWidthWeightsQuiet += baseWeight;
  }

  let totalSpacing = RECT_SPACING * (NUM_RECTS - 1);
  let usableWidth = width - totalSpacing;

  // quiet baseline scale
  let scaleFactorQuiet = usableWidth / totalWidthWeightsQuiet;

  // quiet pixel widths (baseline)
  let basePixelWidths = [];
  let baseTotalQuiet = 0;
  for (let i = 0; i < NUM_RECTS; i++) {
    let rectWquiet = preWidthsQuiet[i] * scaleFactorQuiet;
    basePixelWidths.push(rectWquiet);
    baseTotalQuiet += rectWquiet;
  }

  // --- REVERSED LOGIC ------------------------------------------------------
  // PREVIOUS: quiet=wide (1), loud=thin (thinMin)
  // NOW: quiet=thin (thinMin), loud=wide (1)

  let thinMin = RECT_THIN_SCALE_AT_MAX;   // e.g. 0.3
  let thickMax = 1.0;

  // audioNorm 0→1 maps quiet→thinMin, loud→1
  let loudFactor = lerp(thinMin, thickMax, audioNorm);

  // Overfill to guarantee full coverage even at minimum width
  let neededOverfill =
    (width - totalSpacing) / (baseTotalQuiet * thinMin);
  let effectiveOverfill = Math.max(RECT_OVERFILL, neededOverfill);

  // Compute widths for this frame
  let totalRectWidth = baseTotalQuiet * effectiveOverfill * loudFactor;
  let groupWidth = totalRectWidth + totalSpacing;

  // Always CENTERED around canvas
  let startX = (width - groupWidth) / 2;

  // --- DRAW ----------------------------------------------------------------
  noStroke();
  fill(RECT_COLOR);

  let x = startX;
  for (let i = 0; i < NUM_RECTS; i++) {
    let rectW = basePixelWidths[i] * effectiveOverfill * loudFactor;
    rect(x, y, rectW, rectH);
    x += rectW + RECT_SPACING;
  }
}






// ====================== MIC B DOT GRID (UNCHANGED) ========================

function updateMicBDesign(rmsB){
  const scaled = rmsB * micBSensitivity;

  let norm = (scaled-RMS_MIN)/(RMS_MAX-RMS_MIN);
  norm = constrain(norm,0,1);

  const sizeScale = lerp(SIZE_SCALE_MIN,SIZE_SCALE_MAX,norm);
  const MAX_SIZE = MAX_SIZE_BASE * sizeScale;

  rotationSpeed = rotSlider.value();
  angle += rotationSpeed;

  push();
  translate(width/2,height/2);
  rotate(angle);
  scale(GRID_SCALE);

  fill(255);
  textFont("monospace");
  textAlign(CENTER,CENTER);

  const center = floor((ROWS-1)/2);
  const rowGap = (height/(ROWS+1))*H_GAP_SCALE;
  const halfDiag = 0.5*Math.sqrt(width*width+height*height)*GRID_OVERSCAN;

  for (let r=0; r<ROWS; r++){
    let dist = abs(r-center)/center;
    let factor = exp(-CURVE_STEEPNESS*dist*dist);

    let fontSize = lerp(MIN_SIZE,MAX_SIZE,factor);
    textSize(fontSize);

    let y = (r-center)*rowGap;
    let spacing = lerp(MAX_SPACING,MIN_SPACING,factor);

    for (let x=-halfDiag; x<=halfDiag; x+=spacing){
      text(".",x,y);
    }
  }

  pop();
}

// ====================== HELPERS ===========================================

function analyserRMS(an,buf){
  if (!an) return 0;
  an.getFloatTimeDomainData(buf);
  let sumSq=0;
  for (let i=0;i<buf.length;i++) sumSq+=buf[i]*buf[i];
  return Math.sqrt(sumSq/buf.length);
}

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
