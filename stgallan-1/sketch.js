// === TWO-MIC VARIABLE FONT + DOT GRID SCENE ================================
// Mic A → Center "*" (WeStacksVariable, SHPE axis reacts to volume 3 → 0
//        AND size scales smoothly around adjustable transform origin)
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

// ====================== MIC A — CENTER "*" TEXT ============================

const FONT_A = 'WeStacksVariable'; 
const FONT_B = 'WeStacksVariable'; 
const fontFamilies = [FONT_A, FONT_B];
let fontsReady = false;

// DOM
let micATextEl;

// Geometry
let baseSize;
let baseTextPx = 0;

// ================== ADJUSTABLE STAR BEHAVIOR ===============================

// 1) Base star size scale (no audio)
let TEXT_SIZE_SCALE = 1;

// 2) Audio → size scaling limits
let MIC_A_SIZE_MIN_SCALE = 0.8;
let MIC_A_SIZE_MAX_SCALE = 2.4;

// 3) TRANSFORM ORIGIN (YOU CAN CHANGE THIS)
let MIC_A_TRANSFORM_ORIGIN = "50% 15%";  
// Examples: "50% 45%", "50% 60%", "center top", "center bottom"

// ============================================================================

// Mic B grid parameters
let GRID_SCALE = 1.3;
let ROWS = 9;
let MAX_SIZE_BASE = 80;
let MIN_SIZE = 1;
let CURVE_STEEPNESS = 2;
let H_GAP_SCALE = 0.5;
let MAX_SPACING = 50;
let MIN_SPACING = 40;
let GRID_OVERSCAN = 1.1;

// Volume mapping
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

  baseSize = Math.min(windowWidth * 0.5, 400);
  baseTextPx = baseSize * TEXT_SIZE_SCALE;

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
  sensASlider = createSlider(0.2,4.0,0.7,0.01).parent(row3).style('width:120px;');
  sensALabel = createSpan('×0.7').parent(row3);
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

  // ===== CENTRAL STAR ======================================================
  micATextEl = document.createElement("div");
  micATextEl.id = "micAText";
  document.body.appendChild(micATextEl);

  Object.assign(micATextEl.style,{
    position:"fixed",
    left:"50%",
    top:"50%",
    transform:`translate(-50%, -50%) scale(1)`,
    transformOrigin: MIC_A_TRANSFORM_ORIGIN,   // <<< ADJUST THIS ANYTIME
    fontSize:`${baseTextPx}px`,
    lineHeight:"1",
    textAlign:"center",
    whiteSpace:"nowrap",
    willChange:"font-variation-settings, transform",
    fontFamily:`"${FONT_A}", system-ui, sans-serif`,
    color:"#64C5D7",
    letterSpacing:"0.04em",
    zIndex:"3",
    pointerEvents:"none"
  });
  micATextEl.textContent="*";
  micATextEl.style.fontVariationSettings=`'SHPE' 3`;

  // Font load
  if (document.fonts && document.fonts.load){
    Promise.all(fontFamilies.map(f=>document.fonts.load(`700 1em "${f}"`)))
      .then(()=>fontsReady=true).catch(()=>fontsReady=true);
  } else fontsReady=true;

  bufA = new Float32Array(1024);
  bufB = new Float32Array(1024);

  background(0);
  noStroke();
  textFont("monospace");
  textAlign(CENTER,CENTER);
}

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
  baseSize = Math.min(windowWidth*0.5,400);
  baseTextPx = baseSize * TEXT_SIZE_SCALE;

  micATextEl.style.fontSize = `${baseTextPx}px`;
  micATextEl.style.transformOrigin = MIC_A_TRANSFORM_ORIGIN;
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
  background(0);

  const rmsA = analyserRMS(anA,bufA);
  const rmsB = analyserRMS(anB,bufB);

  updateMicADesign(rmsA);
  updateMicBDesign(rmsB);
}

// ====================== MIC A STAR ========================================

function updateMicADesign(rmsA){
  const scaled = rmsA * micASensitivity;

  // SHPE mapping
  const shpe = clamp(map(scaled,0,0.25,3,0),0,3);

  // SIZE mapping
  let n = clamp(map(scaled,0,0.25,0,1),0,1);
  let sizeScale = lerp(MIC_A_SIZE_MIN_SCALE, MIC_A_SIZE_MAX_SCALE, n);

  // center-perfect scaling
  micATextEl.style.transform =
    `translate(-50%, -30%) scale(${sizeScale.toFixed(3)})`;

  micATextEl.style.fontVariationSettings = `'SHPE' ${shpe.toFixed(2)}`;
}

// ====================== MIC B DOT GRID ====================================

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
