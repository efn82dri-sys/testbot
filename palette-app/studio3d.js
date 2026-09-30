/* ============================================================
   رواق — استودیو سه‌بعدی
   Three.js + PBR + نورپردازی واقعی + دوربین چرخان
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- پایه ---------- */
const tg = window.Telegram?.WebApp || null;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const toPN = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const haptic = {
  light()  { try { tg?.HapticFeedback?.impactOccurred('light'); } catch (e) {} },
  medium() { try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (e) {} },
  select() { try { tg?.HapticFeedback?.selectionChanged(); } catch (e) {} },
  success(){ try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {} },
};
function getGlobalState() {
  if (typeof window !== 'undefined' && window.state) return window.state;
  try { if (typeof state !== 'undefined') return state; } catch (e) {}
  return null;
}
function hexToRgb(h) { const s = h.replace('#',''); return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)]; }
function rgbToHex(r,g,b){ const f=n=>clamp(Math.round(n),0,255).toString(16).padStart(2,'0'); return `#${f(r)}${f(g)}${f(b)}`; }
function mixHex(a,b,t){ const A=hexToRgb(a),B=hexToRgb(b); return rgbToHex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t); }
function srgbToLinear(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function relLum(hex){const[r,g,b]=hexToRgb(hex);return 0.2126*srgbToLinear(r)+0.7152*srgbToLinear(g)+0.0722*srgbToLinear(b);}
const lrv = (hex) => Math.round(relLum(hex) * 100);
function contrast(a,b){const la=relLum(a),lb=relLum(b);const hi=Math.max(la,lb),lo=Math.min(la,lb);return (hi+0.05)/(lo+0.05);}

/* ============================================================
   بافت‌های رویه‌ای (Procedural)
   همه خاکستری — رنگ از material.color می‌آید
   ============================================================ */
const TEX = {};
function makeCanvasTexture(key, draw, opts = {}) {
  if (TEX[key]) return TEX[key];
  const size = opts.size || 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 8;
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  TEX[key] = t;
  return t;
}

function woodGrainTexture() {
  return makeCanvasTexture('wood', (ctx, S) => {
    ctx.fillStyle = '#B8B8B8'; ctx.fillRect(0, 0, S, S);
    // رگه‌های افقی نامنظم
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * S;
      const amp = 1 + Math.random() * 3;
      const w = 0.4 + Math.random() * 2.2;
      const d = Math.random() < 0.5 ? 0.08 + Math.random() * 0.22 : -0.05 - Math.random() * 0.14;
      ctx.strokeStyle = d > 0 ? `rgba(40,40,40,${d})` : `rgba(240,240,240,${-d})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 4) {
        const yy = y + Math.sin(x * 0.014 + i) * amp + Math.sin(x * 0.06 + i * 2) * 0.6;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // نویز ریز
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  });
}

function marbleTexture() {
  return makeCanvasTexture('marble', (ctx, S) => {
    ctx.fillStyle = '#E8E8E8'; ctx.fillRect(0, 0, S, S);
    // رگه‌های ارگانیک با Fractal Noise ساده
    for (let i = 0; i < 30; i++) {
      const y0 = Math.random() * S;
      const amp = 20 + Math.random() * 80;
      const w = 0.5 + Math.random() * 2;
      const a = 0.15 + Math.random() * 0.35;
      ctx.strokeStyle = `rgba(80,80,80,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      let prevX = 0, prevY = y0;
      for (let x = 0; x <= S; x += 6) {
        const y = y0 + Math.sin(x * 0.02 + i) * amp * 0.4 + (Math.random() - 0.5) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // رگه‌های نازک‌تر و روشن‌تر
    for (let i = 0; i < 20; i++) {
      const y0 = Math.random() * S;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.5 + Math.random() * 1;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const y = y0 + Math.sin(x * 0.05 + i) * 30 + (Math.random() - 0.5) * 6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function plasterTexture() {
  return makeCanvasTexture('plaster', (ctx, S) => {
    ctx.fillStyle = '#EDEDED'; ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  });
}

function fabricTexture() {
  return makeCanvasTexture('fabric', (ctx, S) => {
    ctx.fillStyle = '#C8C8C8'; ctx.fillRect(0, 0, S, S);
    // تار و پود
    for (let y = 0; y < S; y += 3) {
      ctx.strokeStyle = `rgba(60,60,60,${0.05 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    for (let x = 0; x < S; x += 3) {
      ctx.strokeStyle = `rgba(240,240,240,${0.05 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
  });
}

function concreteTexture() {
  return makeCanvasTexture('concrete', (ctx, S) => {
    ctx.fillStyle = '#B4B4B4'; ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // لکه‌های بزرگ‌تر
    for (let i = 0; i < 60; i++) {
      const r = 10 + Math.random() * 40;
      const g = ctx.createRadialGradient(Math.random()*S,Math.random()*S,0,0,0,r);
      // ساده‌شده
      ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.06})`;
      ctx.beginPath();
      ctx.arc(Math.random()*S, Math.random()*S, r, 0, Math.PI*2);
      ctx.fill();
    }
  });
}

function tileTexture() {
  return makeCanvasTexture('tile', (ctx, S) => {
    ctx.fillStyle = '#E0E0E0'; ctx.fillRect(0, 0, S, S);
    const n = 4, step = S / n;
    ctx.strokeStyle = 'rgba(80,80,80,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i*step, 0); ctx.lineTo(i*step, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*step); ctx.lineTo(S, i*step); ctx.stroke();
    }
    // تنوع تن در هر کاشی
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = (Math.random() - 0.5) * 0.08;
      ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`;
      ctx.fillRect(i*step+2, j*step+2, step-4, step-4);
    }
  });
}

function rugTexture() {
  return makeCanvasTexture('rug', (ctx, S) => {
    ctx.fillStyle = '#C4C4C4'; ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // حاشیه
    ctx.strokeStyle = 'rgba(60,60,60,0.35)';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, S - 40, S - 40);
  });
}

/* ============================================================
   سیستم متریال — PBR
   ============================================================ */
const MAT_CACHE = new Map();
const KIND = {
  wall:      { rough: 0.94, metal: 0.00, tex: 'plaster',  texScale: 3,  bump: 0.02 },
  wallGloss: { rough: 0.55, metal: 0.00, tex: 'plaster',  texScale: 3,  bump: 0.02 },
  stucco:    { rough: 0.96, metal: 0.00, tex: 'plaster',  texScale: 4,  bump: 0.04 },
  concrete:  { rough: 0.88, metal: 0.00, tex: 'concrete', texScale: 2,  bump: 0.06 },
  wood:      { rough: 0.55, metal: 0.00, tex: 'wood',     texScale: 2,  bump: 0.04 },
  woodDark:  { rough: 0.48, metal: 0.00, tex: 'wood',     texScale: 2,  bump: 0.04 },
  marble:    { rough: 0.18, metal: 0.00, tex: 'marble',   texScale: 1,  bump: 0.01 },
  tile:      { rough: 0.24, metal: 0.00, tex: 'tile',     texScale: 1,  bump: 0.02 },
  fabric:    { rough: 0.98, metal: 0.00, tex: 'fabric',   texScale: 4,  bump: 0.06 },
  velvet:    { rough: 0.42, metal: 0.00, tex: 'fabric',   texScale: 3,  bump: 0.05 },
  leather:   { rough: 0.36, metal: 0.00, tex: 'concrete', texScale: 3,  bump: 0.03 },
  metal:     { rough: 0.22, metal: 1.00, tex: null,       texScale: 1,  bump: 0.00 },
  brass:     { rough: 0.26, metal: 1.00, tex: null,       texScale: 1,  bump: 0.00 },
  plant:     { rough: 0.82, metal: 0.00, tex: null,       texScale: 1,  bump: 0.00 },
  art:       { rough: 0.45, metal: 0.00, tex: 'fabric',   texScale: 2,  bump: 0.01 },
  rug:       { rough: 0.99, metal: 0.00, tex: 'rug',      texScale: 1,  bump: 0.10 },
  glass:     { rough: 0.06, metal: 0.00, tex: null,       texScale: 1,  bump: 0.00, transparent: true, opacity: 0.18 },
  paper:     { rough: 0.90, metal: 0.00, tex: 'plaster',  texScale: 6,  bump: 0.01 },
  terracotta:{ rough: 0.68, metal: 0.00, tex: 'concrete', texScale: 3,  bump: 0.03 },
  ceiling:   { rough: 0.95, metal: 0.00, tex: 'plaster',  texScale: 4,  bump: 0.01 },
  ceramic:   { rough: 0.14, metal: 0.00, tex: null,       texScale: 1,  bump: 0.00 },
};

function makeMaterial(kind, colorHex, override = {}) {
  const key = kind + '|' + colorHex + '|' + JSON.stringify(override);
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  const k = KIND[kind] || KIND.wall;
  const opts = {
    color: new THREE.Color(colorHex),
    roughness: k.rough,
    metalness: k.metal,
  };
  if (k.transparent) { opts.transparent = true; opts.opacity = k.opacity; }
  if (k.tex) {
    let tex;
    if (k.tex === 'wood') tex = woodGrainTexture();
    else if (k.tex === 'marble') tex = marbleTexture();
    else if (k.tex === 'plaster') tex = plasterTexture();
    else if (k.tex === 'fabric') tex = fabricTexture();
    else if (k.tex === 'concrete') tex = concreteTexture();
    else if (k.tex === 'tile') tex = tileTexture();
    else if (k.tex === 'rug') tex = rugTexture();
    if (tex) {
      const cloned = tex.clone();
      cloned.needsUpdate = true;
      cloned.repeat.set(k.texScale, k.texScale);
      opts.map = cloned;
      // Bump map از همان map برای عمق بیشتر
      if (k.bump > 0 && kind !== 'marble') {
        opts.bumpMap = cloned;
        opts.bumpScale = k.bump;
      }
    }
  }
  Object.assign(opts, override);
  const mat = new THREE.MeshStandardMaterial(opts);
  mat.userData.baseColor = colorHex;
  MAT_CACHE.set(key, mat);
  return mat;
}

/* ============================================================
   وضعیت
   ============================================================ */
const st = {
  palette: null,
  sceneId: 'living',
  asg: {},              // layerId -> palette index
  selected: null,
  time: 13,             // 6..21
  weather: 'آفتابی',
  windowDir: 'جنوبی',
  lampOn: null,
  lampKelvin: 3000,
  view: 'three_quarter',
  locked: new Set(),
  history: [],
  future: [],
};

/* ============================================================
   صحنه‌های قابل ساخت
   ============================================================ */
const SCENES = {
  living:   { name: 'نشیمن مدرن',     build: buildLivingRoom,   cam: [5.2, 2.4, 6.2], target: [0, 1.1, -0.5], windowPos: [0, 1.6, -2.5] },
  bedroom:  { name: 'اتاق خواب',      build: buildBedroom,      cam: [4.6, 2.6, 5.8], target: [0, 1.0, -0.6], windowPos: [-2.5, 1.8, 0] },
  kitchen:  { name: 'آشپزخانه',       build: buildKitchen,      cam: [4.2, 2.4, 5.4], target: [0, 1.1, -1.2], windowPos: [0, 1.8, -2.5] },
  bathroom: { name: 'حمام',           build: buildBathroom,     cam: [3.2, 2.2, 4.8], target: [0, 1.1, -1.2], windowPos: [0, 2.0, -2.5] },
  office:   { name: 'دفتر کار',       build: buildOffice,       cam: [4.4, 2.2, 5.4], target: [0, 1.1, -0.8], windowPos: [-2.5, 1.7, 0] },
  cafe:     { name: 'کافه',           build: buildCafe,         cam: [4.8, 2.4, 6.0], target: [0, 1.0, -0.8], windowPos: [0, 1.9, -2.5] },
};

/* ============================================================
   ابزار صحنه
   ============================================================ */
const ROOM_W = 7, ROOM_D = 5, ROOM_H = 2.8;
let _pickables = [];
function pickable(mesh, layerId) {
  mesh.userData.layerId = layerId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  _pickables.push(mesh);
  return mesh;
}

function box(w, h, d, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(...pos); m.rotation.set(...rot);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function rbox(w, h, d, r, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.position.set(...pos); m.rotation.set(...rot);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cylinder(rt, rb, h, mat, pos = [0, 0, 0], seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(...pos); m.castShadow = m.receiveShadow = true;
  return m;
}

/* ============================================================
   ساخت پوسته‌ی اتاق (کف، دیوارها، سقف، پنجره)
   ============================================================ */
function buildRoomShell(palette) {
  const g = new THREE.Group();

  // کف
  const floorMat = makeMaterial('wood', palette.asg.floor ?? '#8a6a48');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.layerId = 'floor';
  _pickables.push(floor);
  g.add(floor);

  // سقف
  const ceilMat = makeMaterial('ceiling', '#f2efe8');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM_H;
  ceil.userData.layerId = 'ceiling';
  g.add(ceil);

  // دیوار پشت (با پنجره)
  const wallMat = makeMaterial('wall', palette.asg.wall ?? '#e8e2d4');
  const backShape = new THREE.Shape();
  backShape.moveTo(-ROOM_W/2, 0);
  backShape.lineTo( ROOM_W/2, 0);
  backShape.lineTo( ROOM_W/2, ROOM_H);
  backShape.lineTo(-ROOM_W/2, ROOM_H);
  backShape.lineTo(-ROOM_W/2, 0);
  // سوراخ پنجره
  const winW = 2.6, winH = 1.5, winY0 = 0.9, winX0 = -1.3;
  const hole = new THREE.Path();
  hole.moveTo(winX0, winY0);
  hole.lineTo(winX0 + winW, winY0);
  hole.lineTo(winX0 + winW, winY0 + winH);
  hole.lineTo(winX0, winY0 + winH);
  hole.lineTo(winX0, winY0);
  backShape.holes.push(hole);
  const backGeo = new THREE.ExtrudeGeometry(backShape, { depth: 0.12, bevelEnabled: false });
  const backWall = new THREE.Mesh(backGeo, wallMat);
  backWall.position.set(0, 0, -ROOM_D/2 - 0.12);
  backWall.receiveShadow = true;
  backWall.userData.layerId = 'wall';
  _pickables.push(backWall);
  g.add(backWall);

  // دیوار چپ
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, ROOM_H, ROOM_D), wallMat);
  leftWall.position.set(-ROOM_W/2, ROOM_H/2, 0);
  leftWall.receiveShadow = true;
  leftWall.userData.layerId = 'wall';
  _pickables.push(leftWall);
  g.add(leftWall);

  // دیوار راست
  const rightWall = leftWall.clone();
  rightWall.position.x = ROOM_W/2;
  rightWall.userData.layerId = 'wall';
  _pickables.push(rightWall);
  g.add(rightWall);

  // پنجره — شیشه و قاب
  const glassMat = makeMaterial('glass', '#ffffff');
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW - 0.12, winH - 0.12), glassMat);
  glass.position.set(winX0 + winW/2, winY0 + winH/2, -ROOM_D/2 - 0.06);
  glass.userData.layerId = 'window';
  _pickables.push(glass);
  g.add(glass);

  // قابِ پنجره (chunky + ظریف)
  const frameMat = makeMaterial('woodDark', '#3a2c20');
  const fT = 0.08, fW = 0.1;
  const mk = (w, h, x, y) => {
    const m = box(w, h, fW, frameMat, [x, y, -ROOM_D/2 - 0.05]);
    m.userData.layerId = 'window';
    _pickables.push(m);
    return m;
  };
  g.add(mk(winW + 0.16, fT, winX0 + winW/2, winY0));
  g.add(mk(winW + 0.16, fT, winX0 + winW/2, winY0 + winH));
  g.add(mk(fT, winH + 0.16, winX0, winY0 + winH/2));
  g.add(mk(fT, winH + 0.16, winX0 + winW, winY0 + winH/2));
  // میله‌ی وسط
  g.add(mk(fT*0.6, winH, winX0 + winW/2, winY0 + winH/2));

  // آسمانِ بیرون (پشت پنجره)
  const skyGeo = new THREE.PlaneGeometry(20, 10);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xb8cce0 });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(winX0 + winW/2, winY0 + winH/2 + 1, -ROOM_D/2 - 3.5);
  sky.userData.isSky = true;
  g.add(sky);

  return g;
}

/* ============================================================
   قطعات مبل
   ============================================================ */
function addSofa(parent, pos, palette) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const baseColor = palette.asg.sofa ?? '#8a7a68';
  const mat = makeMaterial('fabric', baseColor);
  const legs = makeMaterial('woodDark', '#2a1e14');

  // پایه‌ی چوبی
  [[-0.85, 0.05, -0.35], [0.85, 0.05, -0.35], [-0.85, 0.05, 0.35], [0.85, 0.05, 0.35]].forEach(p => {
    const leg = cylinder(0.03, 0.03, 0.1, legs, p, 12);
    leg.userData.layerId = 'sofa';
    _pickables.push(leg);
    g.add(leg);
  });

  // بدنه‌ی نشیمن
  const body = rbox(1.9, 0.42, 0.85, 0.07, mat, [0, 0.31, 0]);
  pickable(body, 'sofa');
  g.add(body);

  // پشت
  const back = rbox(1.9, 0.55, 0.22, 0.06, mat, [0, 0.78, -0.32]);
  pickable(back, 'sofa');
  g.add(back);

  // دسته‌ها
  const armL = rbox(0.22, 0.55, 0.85, 0.06, mat, [-0.84, 0.63, 0]);
  const armR = rbox(0.22, 0.55, 0.85, 0.06, mat, [ 0.84, 0.63, 0]);
  pickable(armL, 'sofa'); pickable(armR, 'sofa');
  g.add(armL); g.add(armR);

  // کوسن‌ها
  const cMat = makeMaterial('velvet', palette.asg.cushions ?? '#b89878');
  [-0.55, 0, 0.55].forEach(x => {
    const c = rbox(0.5, 0.14, 0.62, 0.06, cMat, [x, 0.58, 0.02]);
    pickable(c, 'cushions');
    g.add(c);
  });

  parent.add(g);
  return g;
}

function addCoffeeTable(parent, pos, palette) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const mat = makeMaterial('woodDark', palette.asg.table ?? '#4a3324');
  const top = rbox(0.9, 0.05, 0.55, 0.015, mat, [0, 0.35, 0]);
  pickable(top, 'table');
  g.add(top);
  // پایه‌ها
  const legMat = makeMaterial('metal', '#1a1a1a');
  [[-0.38, 0.18, -0.22], [0.38, 0.18, -0.22], [-0.38, 0.18, 0.22], [0.38, 0.18, 0.22]].forEach(p => {
    const leg = cylinder(0.012, 0.012, 0.35, legMat, p, 10);
    leg.userData.layerId = 'table';
    _pickables.push(leg);
    g.add(leg);
  });
  // کتاب روی میز
  const bookMat = makeMaterial('paper', palette.asg.accent ?? '#a85040');
  const b1 = box(0.22, 0.04, 0.3, bookMat, [0.15, 0.395, 0]);
  b1.userData.layerId = 'accent';
  _pickables.push(b1);
  g.add(b1);
  const b2 = box(0.2, 0.03, 0.28, bookMat, [0.17, 0.43, 0.02]);
  b2.userData.layerId = 'accent';
  _pickables.push(b2);
  g.add(b2);
  // گلدان کوچک
  const potMat = makeMaterial('terracotta', '#a85a3a');
  const pot = cylinder(0.06, 0.05, 0.09, potMat, [-0.2, 0.42, 0], 16);
  pot.userData.layerId = 'accent';
  _pickables.push(pot);
  g.add(pot);
  parent.add(g);
}

function addRug(parent, palette, size = [2.6, 0.02, 1.8]) {
  const mat = makeMaterial('rug', palette.asg.rug ?? '#7a5a44');
  const rug = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  rug.position.set(0, 0.01, 0.2);
  rug.receiveShadow = true;
  rug.castShadow = false;
  rug.userData.layerId = 'rug';
  _pickables.push(rug);
  parent.add(rug);
}

function addFloorLamp(parent, pos, palette) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const baseMat = makeMaterial('metal', '#141414');
  const base = cylinder(0.14, 0.16, 0.03, baseMat, [0, 0.015, 0], 24);
  base.userData.layerId = 'lamp';
  _pickables.push(base);
  g.add(base);
  const pole = cylinder(0.012, 0.012, 1.45, baseMat, [0, 0.74, 0], 12);
  pole.userData.layerId = 'lamp';
  _pickables.push(pole);
  g.add(pole);
  const shadeMat = makeMaterial('fabric', palette.asg.lamp ?? '#e8dcc4');
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.28, 32, 1, true), shadeMat);
  shade.material.side = THREE.DoubleSide;
  shade.position.set(0, 1.58, 0);
  shade.userData.layerId = 'lamp';
  shade.userData.isLampShade = true;
  _pickables.push(shade);
  g.add(shade);
  // نور نقطه‌ای داخل آباژور
  const pl = new THREE.PointLight(0xffc88e, 0, 5, 1.6);
  pl.position.set(0, 1.5, 0);
  pl.userData.isLampLight = true;
  g.add(pl);
  parent.add(g);
}

function addPlant(parent, pos, palette, scale = 1) {
  const g = new THREE.Group();
  g.position.set(...pos); g.scale.setScalar(scale);
  const potMat = makeMaterial('terracotta', '#9a5a3a');
  const pot = cylinder(0.16, 0.13, 0.28, potMat, [0, 0.14, 0], 24);
  pot.userData.layerId = 'plant_pot';
  _pickables.push(pot);
  g.add(pot);
  const soil = cylinder(0.15, 0.15, 0.02, makeMaterial('terracotta', '#3a2418'), [0, 0.28, 0], 24);
  g.add(soil);
  const leafMat = makeMaterial('plant', '#3e6b3e');
  // برگ‌های مخروطی
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const len = 0.35 + Math.random() * 0.25;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, len, 8), leafMat);
    leaf.position.set(Math.cos(angle) * 0.06, 0.28 + len / 2, Math.sin(angle) * 0.06);
    leaf.rotation.z = Math.cos(angle) * 0.35;
    leaf.rotation.x = Math.sin(angle) * 0.35;
    leaf.castShadow = true;
    leaf.userData.layerId = 'plant_leaf';
    _pickables.push(leaf);
    g.add(leaf);
  }
  parent.add(g);
}

function addWallArt(parent, pos, size, palette, colorKey) {
  const [w, h] = size;
  const frameMat = makeMaterial('woodDark', '#1a1410');
  const frame = box(w + 0.08, h + 0.08, 0.04, frameMat, pos);
  frame.userData.layerId = 'art_frame';
  _pickables.push(frame);
  parent.add(frame);
  const artMat = makeMaterial('art', palette.asg[colorKey] ?? '#c8b898');
  const canvas = box(w, h, 0.02, artMat, [pos[0], pos[1], pos[2] + 0.025]);
  canvas.userData.layerId = 'art';
  _pickables.push(canvas);
  parent.add(canvas);
}

function addCurtains(parent, palette, winW, winY0, winH, xCenter, zPos) {
  const mat = makeMaterial('fabric', palette.asg.curtain ?? '#d8c8a8');
  const left = new THREE.Mesh(new THREE.PlaneGeometry(0.5, winH + 0.3, 12, 4), mat);
  // چین‌های موجی
  const pos = left.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const wave = Math.sin(x * 22) * 0.03;
    pos.setZ(i, wave);
  }
  left.geometry.computeVertexNormals();
  left.position.set(xCenter - winW/2 - 0.22, winY0 + winH/2, zPos);
  left.userData.layerId = 'curtain';
  left.castShadow = true;
  _pickables.push(left);
  parent.add(left);

  const right = left.clone();
  right.position.x = xCenter + winW/2 + 0.22;
  right.userData.layerId = 'curtain';
  _pickables.push(right);
  parent.add(right);
}

/* ============================================================
   ساخت اتاق‌ها
   ============================================================ */
function buildLivingRoom(palette) {
  const g = buildRoomShell(palette);
  addRug(g, palette, [3.2, 0.02, 2.2]);
  addSofa(g, [0, 0, 0.6], palette);
  addCoffeeTable(g, [0, 0, -0.1], palette);
  addFloorLamp(g, [-2.7, 0, -1.6], palette);
  addPlant(g, [2.9, 0, -1.8], palette, 1.3);
  addWallArt(g, [0, 1.9, -ROOM_D/2 - 0.03], [0.8, 0.6], palette, 'art');
  addCurtains(g, palette, 2.6, 0.9, 1.5, 0, -ROOM_D/2 - 0.16);
  // کنسول پشت مبل
  const conMat = makeMaterial('woodDark', palette.asg.table ?? '#3a2a1e');
  const con = box(1.6, 0.32, 0.32, conMat, [0, 0.16, 1.3]);
  con.userData.layerId = 'table';
  _pickables.push(con);
  g.add(con);
  return g;
}

function buildBedroom(palette) {
  const g = buildRoomShell(palette);
  addRug(g, palette, [2.4, 0.02, 1.8]);

  // تخت
  const bedG = new THREE.Group();
  bedG.position.set(0, 0, 0);
  const frameMat = makeMaterial('wood', palette.asg.frame ?? '#5a4230');
  const headMat = makeMaterial('velvet', palette.asg.headboard ?? '#3e2a3a');
  const bedBody = rbox(1.7, 0.32, 2.1, 0.05, frameMat, [0, 0.16, 0]);
  pickable(bedBody, 'bedbody');
  g.add(bedBody);
  const headboard = rbox(1.7, 0.9, 0.12, 0.06, headMat, [0, 0.75, -1.02]);
  pickable(headboard, 'headboard');
  g.add(headboard);
  const mattressMat = makeMaterial('fabric', palette.asg.mattress ?? '#e8dcc4');
  const mattress = rbox(1.6, 0.22, 1.95, 0.05, mattressMat, [0, 0.43, 0]);
  pickable(mattress, 'mattress');
  g.add(mattress);
  // بالش‌ها
  const pillowMat = makeMaterial('fabric', '#f0e8d8');
  [-0.42, 0.42].forEach(x => {
    const p = rbox(0.62, 0.14, 0.4, 0.06, pillowMat, [x, 0.6, -0.72]);
    pickable(p, 'pillow');
    g.add(p);
  });
  // پتوی تزئینی
  const throwMat = makeMaterial('velvet', palette.asg.throw ?? '#a85050');
  const throwB = rbox(1.55, 0.04, 0.65, 0.03, throwMat, [0, 0.56, 0.55]);
  pickable(throwB, 'throw');
  g.add(throwB);

  // پاتختی‌ها
  const nightMat = makeMaterial('wood', palette.asg.night ?? '#5a4230');
  [-1.15, 1.15].forEach(x => {
    const body = box(0.45, 0.42, 0.35, nightMat, [x, 0.21, -0.9]);
    body.userData.layerId = 'night';
    _pickables.push(body);
    g.add(body);
    // آباژور
    const baseMat = makeMaterial('brass', '#a88850');
    const base = cylinder(0.05, 0.07, 0.05, baseMat, [x, 0.45, -0.9], 20);
    base.userData.layerId = 'lamp';
    _pickables.push(base);
    g.add(base);
    const pole = cylinder(0.008, 0.008, 0.15, baseMat, [x, 0.55, -0.9], 10);
    pole.userData.layerId = 'lamp';
    _pickables.push(pole);
    g.add(pole);
    const shadeMat = makeMaterial('fabric', '#e8d8b8');
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 24, 1, true), shadeMat);
    shade.material.side = THREE.DoubleSide;
    shade.position.set(x, 0.71, -0.9);
    shade.userData.layerId = 'lamp';
    _pickables.push(shade);
    g.add(shade);
    const pl = new THREE.PointLight(0xffc88e, 0, 3, 1.8);
    pl.position.set(x, 0.7, -0.9);
    pl.userData.isLampLight = true;
    g.add(pl);
  });
  addWallArt(g, [0, 2.0, -ROOM_D/2 - 0.03], [0.7, 0.5], palette, 'art');
  addCurtains(g, palette, 2.6, 0.9, 1.5, 0, -ROOM_D/2 - 0.16);
  return g;
}

function buildKitchen(palette) {
  const g = buildRoomShell(palette);
  const cabMat = makeMaterial('wallGloss', palette.asg.cabinet ?? '#e8e4d8');
  const counterMat = makeMaterial('marble', palette.asg.counter ?? '#d8d0c0');
  const backMat = makeMaterial('tile', palette.asg.splash ?? '#c8c0b0');
  const hwMat = makeMaterial('brass', '#a88850');

  // کابینت پایین
  const lower = box(6.4, 0.85, 0.6, cabMat, [0, 0.425, -ROOM_D/2 + 0.35]);
  lower.userData.layerId = 'lower';
  _pickables.push(lower);
  g.add(lower);

  // کانتر (سنگ)
  const counter = box(6.5, 0.05, 0.65, counterMat, [0, 0.875, -ROOM_D/2 + 0.35]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);

  // میان‌کابینتی
  const splash = box(6.4, 0.6, 0.02, backMat, [0, 1.2, -ROOM_D/2 + 0.06]);
  splash.userData.layerId = 'splash';
  _pickables.push(splash);
  g.add(splash);

  // کابینت‌های بالا
  const upper = box(6.4, 0.7, 0.35, cabMat, [0, 1.85, -ROOM_D/2 + 0.2]);
  upper.userData.layerId = 'upper';
  _pickables.push(upper);
  g.add(upper);

  // دستگیره‌ها
  for (let x = -2.8; x <= 2.8; x += 0.5) {
    const h = box(0.02, 0.15, 0.02, hwMat, [x, 0.5, -ROOM_D/2 + 0.66]);
    h.userData.layerId = 'hardware';
    _pickables.push(h);
    g.add(h);
  }

  // سینک
  const sink = box(0.75, 0.02, 0.42, makeMaterial('metal', '#1a1a1a'), [0, 0.9, -ROOM_D/2 + 0.35]);
  sink.userData.layerId = 'counter';
  _pickables.push(sink);
  g.add(sink);
  const faucet = cylinder(0.02, 0.02, 0.28, hwMat, [0, 1.04, -ROOM_D/2 + 0.15], 12);
  faucet.userData.layerId = 'hardware';
  _pickables.push(faucet);
  g.add(faucet);

  // هود
  const hood = box(0.7, 0.1, 0.5, makeMaterial('metal', '#c0c0c0'), [0, 2.4, -ROOM_D/2 + 0.3]);
  hood.userData.layerId = 'upper';
  _pickables.push(hood);
  g.add(hood);

  // دو صندلی
  [-1.5, 1.5].forEach(x => {
    const sMat = makeMaterial('leather', palette.asg.stool ?? '#5a4030');
    const seat = cylinder(0.18, 0.18, 0.05, sMat, [x, 0.68, -0.6], 24);
    seat.userData.layerId = 'stool';
    _pickables.push(seat);
    g.add(seat);
    const legMat = makeMaterial('metal', '#1a1a1a');
    const l1 = cylinder(0.015, 0.015, 0.68, legMat, [x, 0.34, -0.6], 10);
    l1.userData.layerId = 'stool';
    _pickables.push(l1);
    g.add(l1);
  });

  return g;
}

function buildBathroom(palette) {
  const g = buildRoomShell(palette);
  const wallMat = makeMaterial('tile', palette.asg.wall ?? '#e8e4dc');
  // بازسازی دیوار پشت با کاشی
  // (دیوار پایه از قبل هست)

  // کابینت روشویی
  const vanityMat = makeMaterial('wood', palette.asg.vanity ?? '#5a4030');
  const vanity = box(1.0, 0.55, 0.45, vanityMat, [0, 0.5, -ROOM_D/2 + 0.28]);
  vanity.userData.layerId = 'vanity';
  _pickables.push(vanity);
  g.add(vanity);

  // کانتر سنگی
  const counterMat = makeMaterial('marble', palette.asg.counter ?? '#e8e0d0');
  const counter = box(1.05, 0.04, 0.5, counterMat, [0, 0.79, -ROOM_D/2 + 0.28]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);

  // روشویی
  const basinMat = makeMaterial('ceramic', '#f8f8f4');
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.1, 32), basinMat);
  basin.position.set(0, 0.86, -ROOM_D/2 + 0.28);
  basin.userData.layerId = 'basin';
  _pickables.push(basin);
  g.add(basin);

  // شیر
  const hwMat = makeMaterial('brass', '#a88850');
  const f = cylinder(0.015, 0.015, 0.2, hwMat, [0, 1.0, -ROOM_D/2 + 0.14], 12);
  f.userData.layerId = 'hardware';
  _pickables.push(f);
  g.add(f);

  // آینه
  const mirrorMat = makeMaterial('glass', '#c8d4e0');
  mirrorMat.opacity = 0.5;
  const mirror = box(0.8, 0.9, 0.03, mirrorMat, [0, 1.55, -ROOM_D/2 + 0.08]);
  mirror.userData.layerId = 'mirror';
  _pickables.push(mirror);
  g.add(mirror);
  const frameMat = makeMaterial('metal', '#2a2a2a');
  const mf = box(0.86, 0.96, 0.04, frameMat, [0, 1.55, -ROOM_D/2 + 0.06]);
  mf.userData.layerId = 'mirror_frame';
  _pickables.push(mf);
  g.add(mf);

  // حوله
  const towelMat = makeMaterial('fabric', palette.asg.towel ?? '#e8dcc4');
  [-0.7, 0.7].forEach(x => {
    const t = box(0.28, 0.55, 0.03, towelMat, [x, 1.5, -ROOM_D/2 + 0.08]);
    t.userData.layerId = 'towel';
    _pickables.push(t);
    g.add(t);
  });

  // زیرپایی
  addRug(g, palette, [1.0, 0.02, 0.7]);
  return g;
}

function buildOffice(palette) {
  const g = buildRoomShell(palette);
  // میز
  const deskMat = makeMaterial('woodDark', palette.asg.desk ?? '#3a2a1e');
  const top = rbox(1.8, 0.05, 0.85, 0.015, deskMat, [0, 0.74, 0]);
  pickable(top, 'desk');
  g.add(top);
  [[-0.82, 0.37, -0.35], [0.82, 0.37, -0.35], [-0.82, 0.37, 0.35], [0.82, 0.37, 0.35]].forEach(p => {
    const leg = box(0.05, 0.74, 0.05, deskMat, p);
    leg.userData.layerId = 'desk';
    _pickables.push(leg);
    g.add(leg);
  });

  // مانیتور
  const monitorMat = makeMaterial('metal', '#141414');
  const mBase = box(0.25, 0.02, 0.15, monitorMat, [0, 0.77, -0.05]);
  mBase.userData.layerId = 'monitor';
  _pickables.push(mBase);
  g.add(mBase);
  const mStand = cylinder(0.02, 0.02, 0.25, monitorMat, [0, 0.9, -0.05], 12);
  mStand.userData.layerId = 'monitor';
  _pickables.push(mStand);
  g.add(mStand);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2e, roughness: 0.15, emissive: 0x0a2038, emissiveIntensity: 0.5 });
  const screen = box(0.65, 0.38, 0.03, screenMat, [0, 1.2, -0.05]);
  screen.userData.layerId = 'monitor';
  _pickables.push(screen);
  g.add(screen);

  // صندلی
  const chairMat = makeMaterial('velvet', palette.asg.chair ?? '#3a3a4a');
  const seat = rbox(0.5, 0.08, 0.5, 0.03, chairMat, [0, 0.5, 0.7]);
  pickable(seat, 'chair');
  g.add(seat);
  const back = rbox(0.5, 0.55, 0.07, 0.03, chairMat, [0, 0.8, 0.92]);
  pickable(back, 'chair');
  g.add(back);
  const legMat = makeMaterial('metal', '#1a1a1a');
  const c1 = cylinder(0.03, 0.03, 0.5, legMat, [0, 0.25, 0.7], 12);
  c1.userData.layerId = 'chair';
  _pickables.push(c1);
  g.add(c1);
  // چرخ
  const baseC = cylinder(0.3, 0.3, 0.02, legMat, [0, 0.02, 0.7], 24);
  baseC.userData.layerId = 'chair';
  _pickables.push(baseC);
  g.add(baseC);

  // کتابخانه
  const shelfMat = makeMaterial('wood', palette.asg.shelf ?? '#5a4230');
  const shelf = box(0.8, 1.8, 0.35, shelfMat, [2.9, 0.9, -1.8]);
  shelf.userData.layerId = 'shelf';
  _pickables.push(shelf);
  g.add(shelf);
  // کتاب‌ها
  const bookMat = makeMaterial('paper', palette.asg.book ?? '#a85040');
  for (let y = 0.2; y < 1.7; y += 0.22) {
    for (let x = -0.32; x < 0.3; x += 0.06) {
      const b = box(0.05, 0.18, 0.22, bookMat, [2.9 + x, y, -1.78]);
      b.userData.layerId = 'book';
      _pickables.push(b);
      g.add(b);
    }
  }

  // آباژور رومیزی
  const lampMat = makeMaterial('metal', '#1a1a1a');
  const lBase = cylinder(0.06, 0.06, 0.03, lampMat, [0.7, 0.78, -0.3], 20);
  lBase.userData.layerId = 'lamp';
  _pickables.push(lBase);
  g.add(lBase);
  const lPole = cylinder(0.008, 0.008, 0.3, lampMat, [0.7, 0.94, -0.3], 10);
  lPole.userData.layerId = 'lamp';
  _pickables.push(lPole);
  g.add(lPole);
  const lShadeMat = makeMaterial('fabric', '#e8d8b8');
  const lShade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 24, 1, true), lShadeMat);
  lShade.material.side = THREE.DoubleSide;
  lShade.position.set(0.7, 1.15, -0.3);
  lShade.userData.layerId = 'lamp';
  _pickables.push(lShade);
  g.add(lShade);
  const pl = new THREE.PointLight(0xffc88e, 0, 3, 1.8);
  pl.position.set(0.7, 1.15, -0.3);
  pl.userData.isLampLight = true;
  g.add(pl);

  addRug(g, palette, [2.6, 0.02, 1.8]);
  addWallArt(g, [0, 2.0, -ROOM_D/2 - 0.03], [0.9, 0.6], palette, 'art');
  addPlant(g, [-2.9, 0, -1.8], palette, 1.1);
  return g;
}

function buildCafe(palette) {
  const g = buildRoomShell(palette);
  // کانتر
  const counterMat = makeMaterial('wood', palette.asg.counter ?? '#5a4230');
  const counter = box(5.5, 1.05, 0.9, counterMat, [0, 0.525, 0.3]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);
  // رویه سنگ
  const topMat = makeMaterial('marble', palette.asg.top ?? '#d8d0c0');
  const top = box(5.6, 0.05, 0.95, topMat, [0, 1.075, 0.3]);
  top.userData.layerId = 'top';
  _pickables.push(top);
  g.add(top);

  // قفسه
  const shelfMat = makeMaterial('woodDark', palette.asg.shelf ?? '#3a2a1e');
  const shelf1 = box(5.5, 0.05, 0.35, shelfMat, [0, 2.1, -ROOM_D/2 + 0.25]);
  shelf1.userData.layerId = 'shelf';
  _pickables.push(shelf1);
  g.add(shelf1);
  const shelf2 = shelf1.clone(); shelf2.position.y = 1.75;
  shelf2.userData.layerId = 'shelf';
  _pickables.push(shelf2);
  g.add(shelf2);

  // بطری‌ها
  const bottleMat = makeMaterial('glass', '#3a8a6a');
  bottleMat.opacity = 0.85;
  for (let x = -2.4; x <= 2.4; x += 0.18) {
    const h = 0.15 + Math.random() * 0.15;
    const b = cylinder(0.03, 0.04, h, bottleMat, [x, 2.13 + h/2, -ROOM_D/2 + 0.25], 12);
    b.userData.layerId = 'bottle';
    _pickables.push(b);
    g.add(b);
  }

  // چهار صندلی
  const stoolMat = makeMaterial('leather', palette.asg.stool ?? '#5a4030');
  const legMat = makeMaterial('metal', '#1a1a1a');
  [-1.6, -0.5, 0.6, 1.7].forEach(x => {
    const seat = cylinder(0.18, 0.18, 0.06, stoolMat, [x, 0.75, -0.35], 24);
    seat.userData.layerId = 'stool';
    _pickables.push(seat);
    g.add(seat);
    const leg = cylinder(0.02, 0.02, 0.75, legMat, [x, 0.375, -0.35], 10);
    leg.userData.layerId = 'stool';
    _pickables.push(leg);
    g.add(leg);
  });

  // چراغ‌های آویز
  const pendMat = makeMaterial('brass', '#a88850');
  [-1.6, 0, 1.6].forEach(x => {
    const wire = cylinder(0.004, 0.004, 1.5, pendMat, [x, 2.05, 0.5], 8);
    wire.userData.layerId = 'pendant';
    _pickables.push(wire);
    g.add(wire);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 24, 1, true), pendMat);
    cone.material.side = THREE.DoubleSide;
    cone.position.set(x, 1.3, 0.5);
    cone.rotation.x = Math.PI;
    cone.userData.layerId = 'pendant';
    _pickables.push(cone);
    g.add(cone);
    // نور
    const pl = new THREE.PointLight(0xffc88e, 0, 3.5, 1.8);
    pl.position.set(x, 1.25, 0.5);
    pl.userData.isLampLight = true;
    g.add(pl);
  });

  return g;
}

/* ============================================================
   نورپردازی
   ============================================================ */
let scene, camera, renderer, controls, sunLight, hemiLight, ambientLight, sunTarget;
let clock, skyMesh, allLampLights = [];
let currentRoomGroup = null;

function setupLighting(threeScene) {
  // آسمان/زمین (Ambient)
  hemiLight = new THREE.HemisphereLight(0xc8d4e8, 0x4a4438, 0.35);
  threeScene.add(hemiLight);

  // Ambient کلی
  ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
  threeScene.add(ambientLight);

  // خورشید
  sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -8;
  sunLight.shadow.camera.right = 8;
  sunLight.shadow.camera.top = 8;
  sunLight.shadow.camera.bottom = -8;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.radius = 2.5;
  sunTarget = new THREE.Object3D();
  threeScene.add(sunTarget);
  sunLight.target = sunTarget;
  threeScene.add(sunLight);
}

function updateSunPosition() {
  const t = st.time;
  const weather = st.weather;
  const dir = st.windowDir;
  const sv = t >= 20 || t < 5.5 ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
  const dayAmt = clamp(sv * 1.1, 0, 1);

  // زاویه: ارتفاع و آزیموت
  const elevation = clamp(sv * Math.PI * 0.75, 0, Math.PI / 2.2);
  let azimuthOffset = 0;
  if (dir === 'شرقی') azimuthOffset = Math.PI * 0.4;
  else if (dir === 'غربی') azimuthOffset = -Math.PI * 0.4;
  else if (dir === 'شمالی') azimuthOffset = Math.PI * 0.6;
  // جنوبی = روبرو = زاویه پیش‌فرض

  const r = 12;
  const az = Math.PI + azimuthOffset + (t - 13) * 0.05;
  const x = Math.sin(az) * Math.cos(elevation) * r;
  const y = Math.sin(elevation) * r + 0.5;
  const z = -Math.cos(az) * Math.cos(elevation) * r;

  sunLight.position.set(x, Math.max(y, 0.2), z);
  sunTarget.position.set(0, 1, 0);

  // شدت
  sunLight.intensity = dayAmt * (weather === 'ابری' ? 0.6 : 1.8) * (dir === 'شمالی' ? 0.5 : 1);

  // رنگ نور
  let sunColorHex = '#ffffff';
  if (t < 8)      sunColorHex = '#ffb878';
  else if (t < 10) sunColorHex = '#ffd0a0';
  else if (t < 16) sunColorHex = '#fff6e8';
  else if (t < 18) sunColorHex = '#ffc890';
  else if (t < 20) sunColorHex = '#ff9868';
  else             sunColorHex = '#5a6a98';
  sunLight.color.set(sunColorHex);

  // آسمان
  const skyTint = new THREE.Color();
  if (dayAmt < 0.05) skyTint.setHex(0x1a2038);
  else if (t < 8) skyTint.setHex(0xffc898);
  else if (t < 16) skyTint.setHex(0xc8dcf0);
  else if (t < 18) skyTint.setHex(0xffb890);
  else skyTint.setHex(0x4a5a88);
  if (weather === 'ابری') skyTint.lerp(new THREE.Color(0x808898), 0.4);
  if (skyMesh && skyMesh.material) skyMesh.material.color.copy(skyTint);

  // hemi
  hemiLight.intensity = 0.12 + dayAmt * 0.4;
  if (dayAmt < 0.1) {
    hemiLight.color.setHex(0x304060);
    hemiLight.groundColor.setHex(0x101018);
  } else {
    hemiLight.color.copy(skyTint);
    hemiLight.groundColor.setHex(0x4a4038);
  }
  ambientLight.intensity = 0.05 + dayAmt * 0.05;

  // لوستر/آباژور
  const lampsShouldBeOn = st.lampOn === null ? (dayAmt < 0.25) : st.lampOn;
  allLampLights.forEach(pl => {
    pl.intensity = lampsShouldBeOn ? (pl.userData.baseIntensity || 1.6) : 0;
    pl.color.setHex(KELVIN_MAP[st.lampKelvin] || 0xffc88e);
  });
}

const KELVIN_MAP = { 2700: 0xffa860, 3000: 0xffc88e, 4000: 0xffe4c6, 6500: 0xe6eeff };

/* ============================================================
   دوربین — نماهای آماده
   ============================================================ */
const CAM_VIEWS = {
  three_quarter: { pos: [5.2, 2.4, 6.2], target: [0, 1.1, -0.5] },
  front:         { pos: [0, 1.65, 7.5],  target: [0, 1.3, 0] },
  corner:        { pos: [-5.5, 2.6, 5.8], target: [0.5, 1.2, -0.6] },
  top:           { pos: [0, 8.5, 0.01],   target: [0, 0, 0] },
  eye:           { pos: [0, 1.65, 4.2],   target: [0, 1.6, -2] },
};

let camAnim = null;
function setView(name, animate = true) {
  st.view = name;
  const v = CAM_VIEWS[name]; if (!v) return;
  if (!animate) {
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    controls.update();
    return;
  }
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(...v.pos);
  const endTarget = new THREE.Vector3(...v.target);
  const t0 = performance.now();
  const dur = 700;
  camAnim = () => {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();
    if (p >= 1) camAnim = null;
  };
}

/* ============================================================
   ساخت/بازسازی اتاق
   ============================================================ */
function rebuildRoom() {
  if (!scene || !st.palette) return;
  if (currentRoomGroup) {
    scene.remove(currentRoomGroup);
    currentRoomGroup.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  }
  _pickables = [];
  allLampLights = [];
  const sceneDef = SCENES[st.sceneId];
  const room = sceneDef.build(buildPaletteMap());
  currentRoomGroup = room;
  scene.add(room);
  // جمع‌آوری چراغ‌ها و آسمان
  room.traverse(o => {
    if (o.userData.isLampLight) {
      o.userData.baseIntensity = 1.6;
      allLampLights.push(o);
    }
    if (o.userData.isSky) skyMesh = o;
  });
  updateSunPosition();
}

function buildPaletteMap() {
  // تبدیل asg (layerId -> index) به map با رنگ‌ها
  const map = { asg: {} };
  if (!st.palette) return map;
  for (const k in st.asg) {
    map.asg[k] = st.palette.colors[st.asg[k]] || '#888888';
  }
  return map;
}

/* ============================================================
   تخصیص پیش‌فرض رنگ‌ها
   ============================================================ */
const ROLE_WEIGHTS = {
  wall: 0.92, floor: 0.25, accent: 0.75, sofa: 0.55, cushions: 0.7, table: 0.15,
  rug: 0.35, lamp: 0.82, plant_pot: 0.45, plant_leaf: 0.35, art: 0.85,
  curtain: 0.75, night: 0.2, headboard: 0.4, mattress: 0.9, pillow: 0.95,
  bedbody: 0.2, throw: 0.7, cabinet: 0.9, counter: 0.85, splash: 0.7,
  upper: 0.88, lower: 0.88, hardware: 0.35, stool: 0.3, vanity: 0.25,
  basin: 0.95, mirror: 0.9, towel: 0.8, desk: 0.2, monitor: 0.1,
  chair: 0.4, shelf: 0.25, book: 0.6, top: 0.88, bottle: 0.5,
  frame: 0.2, pendant: 0.35,
};

function ensureAssignment() {
  if (!st.palette) return;
  const keys = Object.keys(ROLE_WEIGHTS);
  const colors = st.palette.colors;
  // برای هر لایه‌ی نقش، یک رنگ انتخاب کن که نماینده‌ی آن نقش باشد
  // از آخر به اول: L1 (پایه‌ی روشن) تا accent (تیره‌ترین)
  const sorted = [...colors].sort((a, b) => relLum(b) - relLum(a)); // روشن به تیره
  for (const k of keys) {
    const w = ROLE_WEIGHTS[k];
    // w=1 → روشن‌ترین (نزدیک به رنگِ پایه)، w=0 → تیره‌ترین
    const idx = clamp(Math.round((1 - w) * (sorted.length - 1)), 0, sorted.length - 1);
    const chosen = sorted[idx];
    st.asg[k] = colors.indexOf(chosen);
  }
  // چند لایه‌ی مهم را به رنگ‌های خاص‌تر وصل کن
  st.asg.floor = colors.indexOf(sorted[clamp(2, 0, sorted.length - 1)]);      // کمی روشن‌تر
  st.asg.rug = colors.indexOf(sorted[sorted.length - 2]);                    // تیره‌تر
  st.asg.accent = colors.indexOf(sorted[1] || sorted[0]);                    // روشن‌ترین accent
}

/* ============================================================
   انتخاب سطح با Raycaster
   ============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downXY = null;

function pickAt(clientX, clientY) {
  if (!renderer) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(_pickables, false);
  if (!hits.length) return;
  const hit = hits[0];
  let obj = hit.object;
  while (obj && !obj.userData.layerId) obj = obj.parent;
  if (!obj) return;
  const layerId = obj.userData.layerId;
  setSelected(layerId);
}

let selectedHighlight = null;
function setSelected(layerId) {
  st.selected = layerId;
  // پاک کردن هایلایت قبلی
  if (selectedHighlight) {
    selectedHighlight.traverse(o => {
      if (o.material && o.material.emissive) {
        o.material.emissive.setHex(o.userData._emissive || 0x000000);
        o.material.emissiveIntensity = o.userData._emissiveIntensity ?? 0;
      }
    });
  }
  if (layerId) {
    const found = [];
    currentRoomGroup.traverse(o => {
      if (o.userData.layerId === layerId && o.material && o.material.emissive) found.push(o);
    });
    found.forEach(o => {
      o.userData._emissive = o.material.emissive.getHex();
      o.userData._emissiveIntensity = o.material.emissiveIntensity;
      o.material.emissive.setHex(0x6fe3c4);
      o.material.emissiveIntensity = 0.35;
    });
    selectedHighlight = currentRoomGroup;
  } else {
    selectedHighlight = null;
  }
  haptic.select();
  renderColorPane();
  renderChips();
}

/* ============================================================
   اعمال رنگ
   ============================================================ */
function applyColorToSelected(colorIndex) {
  if (!st.selected || !st.palette) return;
  st.asg[st.selected] = colorIndex;
  const hex = st.palette.colors[colorIndex];
  // پیدا کردن همه‌ی متریال‌های آن لایه و تغییر رنگ
  currentRoomGroup.traverse(o => {
    if (o.userData.layerId === st.selected && o.material) {
      // متریال مشترک است — پس از MAT_CACHE نسخه‌ی جدید بساز
      const oldKind = detectKind(o.material);
      const newMat = makeMaterial(oldKind, hex);
      o.material = newMat;
      if (o.isLight) { /* skip */ }
    }
  });
  haptic.medium();
  renderColorPane();
  renderChips();
}

function detectKind(mat) {
  // بر اساس userData ذخیره‌شده در ساخت
  return mat.userData.kind || 'fabric';
}

/* ============================================================
   رندر رابط کاربری
   ============================================================ */
let root, stageEl, toastTimer;

function buildShell() {
  const el = document.createElement('div');
  el.className = 'stu3d';
  el.hidden = true;
  el.innerHTML = `
    <div class="s3-panel">
      <header class="s3-head">
        <div class="s3-title"><span class="s3-dot"></span><div><h3 id="s3Name">—</h3><span id="s3Meta">—</span></div></div>
        <div class="s3-actions">
          <button class="s3-icon" data-a="close" aria-label="بستن">✕</button>
        </div>
      </header>
      <div class="s3-body">
        <section class="s3-main">
          <div class="s3-scenes" id="s3Scenes"></div>
          <div class="s3-stage-wrap">
            <div class="s3-stage" id="s3Stage"></div>
            <div class="s3-hint"><span id="s3Hover">برای چرخش دوربین، بکش · برای انتخاب سطح، کلیک کن</span><span id="s3Clock"></span></div>
          </div>
          <div class="s3-viewbar" id="s3Views"></div>
        </section>
        <aside class="s3-side">
          <div class="s3-tabs" id="s3Tabs">
            <button data-tab="color" aria-selected="true">رنگ</button>
            <button data-tab="light">نور</button>
            <button data-tab="an">تحلیل</button>
          </div>
          <div class="s3-pane on" data-pane="color">
            <div class="s3-sel" id="s3Sel"></div>
            <div class="s3-block">
              <div class="s3-head-sm"><span>پالت</span><span class="s3-hint-sm" id="s3PalHint">روی رنگ بزن تا اعمال شود</span></div>
              <div class="s3-palette" id="s3Palette"></div>
            </div>
            <div class="s3-block">
              <div class="s3-head-sm"><span>بخش‌های صحنه</span></div>
              <div class="s3-chips" id="s3Chips"></div>
            </div>
          </div>
          <div class="s3-pane" data-pane="light">
            <div class="s3-block">
              <div class="s3-head-sm"><span>ساعت روز</span><span class="s3-hint-sm" id="s3TimeLbl"></span></div>
              <input type="range" id="s3Time" min="6" max="21" step="0.25" value="13">
            </div>
            <div class="s3-block">
              <div class="s3-head-sm"><span>هوا</span></div>
              <div class="s3-pills" id="s3Wx"></div>
            </div>
            <div class="s3-block">
              <div class="s3-head-sm"><span>جهت پنجره</span></div>
              <div class="s3-pills" id="s3Dir"></div>
            </div>
            <div class="s3-block">
              <div class="s3-head-sm"><span>چراغ</span></div>
              <div class="s3-pills" id="s3Kel"></div>
              <button class="s3-btn" id="s3LampBtn" aria-pressed="false">لوستر</button>
            </div>
          </div>
          <div class="s3-pane" data-pane="an">
            <div class="s3-analysis" id="s3An"></div>
          </div>
        </aside>
      </div>
      <div class="s3-toast" id="s3Toast"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function injectCSS() {
  if (document.getElementById('stu3d-css')) return;
  const s = document.createElement('style');
  s.id = 'stu3d-css';
  s.textContent = `
  .stu3d{position:fixed;inset:0;z-index:90;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);display:flex;align-items:stretch;justify-content:center;padding:max(env(safe-area-inset-top,0px),8px) 8px max(env(safe-area-inset-bottom,0px),8px);animation:s3in .3s var(--ease)}
  .stu3d[hidden]{display:none}
  @keyframes s3in{from{opacity:0;transform:translateY(10px)}}
  .stu3d *{box-sizing:border-box}
  .s3-panel{position:relative;width:min(1400px,100%);background:var(--bg-elev);color:var(--ink);border-radius:20px;box-shadow:var(--shadow-lg),inset 0 0 0 1px var(--line);display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
  .s3-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line-soft)}
  .s3-title{display:flex;align-items:center;gap:12px;min-width:0}
  .s3-title h3{margin:0;font-size:16px;font-weight:800;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .s3-title span{display:block;font-size:11.5px;color:var(--ink-dim)}
  .s3-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent);flex:none}
  .s3-actions{display:flex;gap:6px}
  .s3-icon{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);display:inline-grid;place-items:center;cursor:pointer;font:800 15px inherit}
  .s3-icon:hover{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,var(--line))}
  .s3-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,420px);flex:1;min-height:0}
  .s3-main{padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0}
  .s3-side{border-inline-start:1px solid var(--line-soft);display:flex;flex-direction:column;min-height:0;overflow-y:auto;background:color-mix(in srgb,var(--bg-sunk) 40%,transparent)}
  @media(max-width:899px){
    .s3-body{display:block;overflow-y:auto}
    .s3-main{overflow:visible;padding:10px 10px 0}
    .s3-side{border-inline-start:0;border-top:1px solid var(--line-soft);overflow:visible;margin-top:10px}
  }
  .s3-scenes{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .s3-scenes::-webkit-scrollbar,.s3-chips::-webkit-scrollbar,.s3-tabs::-webkit-scrollbar{display:none}
  .s3-scene{flex:none;padding:7px 14px;border-radius:10px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font:600 12.5px inherit;font-family:inherit;cursor:pointer;transition:all .16s}
  .s3-scene:hover{color:var(--ink)}
  .s3-scene.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
  .s3-stage-wrap{position:relative;border-radius:16px;overflow:hidden;background:#0a0a0a;box-shadow:inset 0 0 0 1px var(--line-soft),0 18px 40px -22px rgba(0,0,0,.6);flex:1;min-height:0}
  .s3-stage{position:relative;width:100%;height:100%;aspect-ratio:16/10;direction:ltr}
  .s3-stage canvas{display:block;width:100%;height:100%}
  .s3-hint{position:absolute;bottom:8px;inset-inline:8px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
  .s3-hint span{background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:3px 10px;border-radius:99px;backdrop-filter:blur(6px)}
  .s3-viewbar{display:flex;gap:6px;flex-wrap:wrap}
  .s3-view{flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font:600 12px inherit;font-family:inherit;cursor:pointer;transition:all .16s}
  .s3-view:hover{color:var(--ink)}
  .s3-view.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
  .s3-tabs{display:flex;border-bottom:1px solid var(--line-soft);position:sticky;top:0;background:var(--bg-elev);z-index:2}
  .s3-tabs button{flex:1;padding:12px 10px;background:none;border:0;color:var(--ink-dim);font-family:inherit;font-size:13px;cursor:pointer;position:relative}
  .s3-tabs button[aria-selected=true]{color:var(--ink);font-weight:700}
  .s3-tabs button[aria-selected=true]:after{content:"";position:absolute;inset-inline:22%;bottom:-1px;height:2px;background:var(--accent);border-radius:2px}
  .s3-pane{display:none;padding:14px;gap:14px;flex-direction:column}
  .s3-pane.on{display:flex}
  .s3-block{display:flex;flex-direction:column;gap:8px}
  .s3-head-sm{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:700}
  .s3-hint-sm{font-size:11px;font-weight:500;color:var(--ink-dim)}
  .s3-sel{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--bg-sunk)}
  .s3-sel .big{width:56px;height:56px;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35)}
  .s3-sel b{font-size:14px}
  .s3-sel p{margin:0;font-size:11px;color:var(--ink-dim);font-variant-numeric:tabular-nums;line-height:1.7}
  .s3-palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(50px,1fr));gap:8px}
  .s3-sw{position:relative;aspect-ratio:1;border-radius:12px;border:2px solid var(--line-soft);background:var(--c);cursor:pointer;overflow:hidden;transition:transform .2s}
  .s3-sw:hover{transform:translateY(-2px)}
  .s3-sw.on{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent)}
  .s3-sw span{position:absolute;inset:auto 0 3px 0;text-align:center;font-size:9px;font-weight:800;color:#fff;mix-blend-mode:difference}
  .s3-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .s3-chip{flex:none;display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:99px;border:1px solid var(--line);background:var(--bg-elev);color:var(--ink);font-family:inherit;font-size:12px;cursor:pointer;text-align:start}
  .s3-chip i{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35);flex:none}
  .s3-chip b{font-weight:600;display:block;line-height:1.35}
  .s3-chip em{font-style:normal;font-size:10px;color:var(--ink-dim);display:block;line-height:1.3}
  .s3-chip.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--bg-elev))}
  .s3-pills{display:flex;gap:6px;flex-wrap:wrap}
  .s3-pill{padding:6px 14px;border-radius:99px;border:1px solid var(--line);background:transparent;color:var(--ink);font-family:inherit;font-size:12px;cursor:pointer}
  .s3-pill.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
  .s3-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .16s}
  .s3-btn:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
  .s3-btn[aria-pressed=true]{color:var(--accent-text);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--glass))}
  .s3-analysis{display:flex;flex-direction:column;gap:14px}
  .s3-score{display:flex;gap:14px;align-items:center;padding:12px;border-radius:16px;background:var(--bg-sunk);border:1px solid var(--line)}
  .s3-ring{width:64px;height:64px;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--s)*1%),var(--line) 0);display:grid;place-items:center;flex:none}
  .s3-ring b{width:50px;height:50px;border-radius:50%;background:var(--bg-sunk);display:grid;place-items:center;font-size:16px}
  .s3-score p{margin:0;font-size:12px;color:var(--ink-dim)}
  .s3-bar3{display:grid;gap:4px;font-size:11.5px;color:var(--ink-dim)}
  .s3-bar3>div{display:flex;height:16px;border-radius:8px;overflow:hidden;direction:ltr;background:var(--bg-sunk);box-shadow:inset 0 0 0 1px var(--line-soft)}
  .s3-bar3>div s{display:block;transition:width .4s var(--ease)}
  .s3-bar3>span{display:flex;justify-content:space-between;gap:8px}
  .s3-bar3 b{font-weight:600;color:var(--ink)}
  .s3-tbl{width:100%;border-collapse:collapse;font-size:12px}
  .s3-tbl th{font-weight:500;color:var(--ink-dim);text-align:right;padding:4px 6px;font-size:11px}
  .s3-tbl td{padding:6px;border-top:1px solid var(--line-soft);vertical-align:middle}
  .s3-tbl .d{display:inline-block;width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.4);vertical-align:-3px;margin-inline-end:6px}
  .s3-toast{position:absolute;inset-inline:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:340px;margin:auto;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:14px;font-size:13px;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .26s,transform .26s;pointer-events:none;z-index:9}
  .s3-toast.on{opacity:1;transform:none}
  @media(prefers-reduced-motion:reduce){.stu3d,.stu3d *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(s);
}

/* ============================================================
   رندر پنل‌های UI
   ============================================================ */
const ROLE_FA = {
  wall: 'دیوار', floor: 'کف', accent: 'تأکیدی', sofa: 'مبل', cushions: 'کوسن',
  table: 'میز', rug: 'فرش', lamp: 'آباژور', plant_pot: 'گلدان', plant_leaf: 'برگ',
  art: 'تابلو', art_frame: 'قاب', curtain: 'پرده', night: 'پاتختی', headboard: 'تاجِ تخت',
  mattress: 'تشک', pillow: 'بالش', bedbody: 'بدنه‌ی تخت', throw: 'پتو',
  cabinet: 'کابینت', counter: 'کانتر', splash: 'میان‌کابینتی', upper: 'کابینتِ بالا',
  lower: 'کابینتِ پایین', hardware: 'دستگیره', stool: 'صندلی', vanity: 'روشویی',
  basin: 'سینک', mirror: 'آینه', mirror_frame: 'قابِ آینه', towel: 'حوله',
  desk: 'میز', monitor: 'مانیتور', chair: 'صندلی', shelf: 'کتابخانه',
  book: 'کتاب', top: 'رویه', bottle: 'بطری', frame: 'قاب', pendant: 'چراغِ آویز',
  ceiling: 'سقف',
};

function renderHeader() {
  $('#s3Name', root).textContent = st.palette.name;
  $('#s3Meta', root).textContent = SCENES[st.sceneId].name;
}

function renderScenes() {
  $('#s3Scenes', root).innerHTML = Object.entries(SCENES).map(([id, s]) =>
    `<button class="s3-scene ${id === st.sceneId ? 'on' : ''}" data-scene="${id}">${s.name}</button>`
  ).join('');
  $('#s3Views', root).innerHTML = Object.entries(CAM_VIEWS).map(([id]) => {
    const labels = { three_quarter: 'سه‌چهارم', front: 'روبرو', corner: 'گوشه', top: 'بالا', eye: 'ایستاده' };
    return `<button class="s3-view ${id === st.view ? 'on' : ''}" data-view="${id}">${labels[id]}</button>`;
  }).join('');
}

function renderChips() {
  const ids = [...new Set(_pickables.map(p => p.userData.layerId).filter(Boolean))];
  $('#s3Chips', root).innerHTML = ids.map(id => {
    const hex = st.palette.colors[st.asg[id]] || '#888';
    return `<button class="s3-chip ${st.selected === id ? 'on' : ''}" data-chip="${id}">
      <i style="background:${hex}"></i><span><b>${ROLE_FA[id] || id}</b></span></button>`;
  }).join('');
}

function renderColorPane() {
  const sel = $('#s3Sel', root);
  if (!st.selected) {
    sel.innerHTML = `<div class="big" style="background:var(--glass)"></div><div><b>سطحی انتخاب نشده</b><p>روی هر بخشِ صحنه کلیک کن.</p></div>`;
  } else {
    const hex = st.palette.colors[st.asg[st.selected]] || '#888';
    const rgb = hexToRgb(hex);
    sel.innerHTML = `<div class="big" style="background:${hex}"></div><div><b>${ROLE_FA[st.selected] || st.selected}</b>
      <p style="direction:ltr;text-align:right">${hex.toUpperCase()} · RGB ${rgb.join(',')}</p>
      <p>LRV ${toPN(lrv(hex))}</p></div>`;
  }
  $('#s3Palette', root).innerHTML = st.palette.colors.map((hex, i) => {
    const on = st.selected && st.asg[st.selected] === i;
    return `<button class="s3-sw ${on ? 'on' : ''}" data-pick="${i}" style="--c:${hex}"><span>${hex.slice(1).toUpperCase()}</span></button>`;
  }).join('');
}

function renderLightPane() {
  $('#s3Time', root).value = st.time;
  const h = Math.floor(st.time), m = Math.round((st.time - h) * 60);
  $('#s3TimeLbl', root).textContent = `${toPN(h)}:${toPN(String(m).padStart(2,'0'))}`;
  $('#s3Wx', root).innerHTML = ['آفتابی', 'ابری'].map(v =>
    `<button class="s3-pill ${st.weather === v ? 'on' : ''}" data-wx="${v}">${v}</button>`).join('');
  $('#s3Dir', root).innerHTML = ['شمالی', 'جنوبی', 'شرقی', 'غربی'].map(v =>
    `<button class="s3-pill ${st.windowDir === v ? 'on' : ''}" data-dir="${v}">${v}</button>`).join('');
  $('#s3Kel', root).innerHTML = [2700, 3000, 4000, 6500].map(v =>
    `<button class="s3-pill ${st.lampKelvin === v ? 'on' : ''}" data-kel="${v}">${toPN(v)}K</button>`).join('');
  const lampOn = st.lampOn === null ? (st.time >= 20 || st.time < 6) : st.lampOn;
  const lb = $('#s3LampBtn', root);
  lb.setAttribute('aria-pressed', lampOn ? 'true' : 'false');
  lb.textContent = lampOn ? 'لوستر روشن' : 'لوستر خاموش';
  $('#s3Clock', root).textContent = `${toPN(h)}:${toPN(String(m).padStart(2,'0'))}`;
}

function renderAnalysis() {
  // تحلیل ساده
  const colors = [...new Set(Object.values(st.asg).map(i => st.palette.colors[i]).filter(Boolean))];
  const lrvs = colors.map(lrv);
  const range = Math.max(...lrvs) - Math.min(...lrvs);
  const balance = clamp(100 - Math.abs(range - 55) * 0.8, 30, 98);
  const harmony = clamp(90 - Math.abs(colors.length - 5) * 5, 60, 98);
  const score = Math.round((balance + harmony) / 2);
  $('#s3An', root).innerHTML = `
    <div class="s3-score"><div class="s3-ring" style="--s:${score}"><b>${toPN(score)}</b></div>
      <div><b>تحلیل پالت</b><p>تعادل ${toPN(Math.round(balance))}٪ · تنوع رنگی ${toPN(harmony)}٪</p></div></div>
    <div class="s3-bar3">
      <span><b>محدوده‌ی روشنایی (LRV)</b><span>${toPN(Math.min(...lrvs))} تا ${toPN(Math.max(...lrvs))}</span></span>
      <div><s style="width:${range}%;background:linear-gradient(90deg,#000,#fff)"></s></div>
    </div>
    <div class="s3-block">
      <div class="s3-head-sm"><span>رنگ‌های استفاده‌شده</span></div>
      <table class="s3-tbl">
        <tr><th>رنگ</th><th>LRV</th><th>سطح</th></tr>
        ${[...new Set(Object.entries(st.asg).map(([k, v]) => st.palette.colors[v] ? `${k}|${v}` : null).filter(Boolean))].slice(0, 12).map(pair => {
          const [k, i] = pair.split('|');
          const hex = st.palette.colors[+i];
          return `<tr><td><span class="d" style="background:${hex}"></span><span style="direction:ltr;display:inline-block">${hex.toUpperCase()}</span></td><td>${toPN(lrv(hex))}</td><td>${ROLE_FA[k] || k}</td></tr>`;
        }).join('')}
      </table>
    </div>`;
}

/* ============================================================
   رندر کل
   ============================================================ */
function renderAll() {
  if (!st.palette) return;
  renderHeader();
  renderScenes();
  renderChips();
  renderColorPane();
  renderLightPane();
  renderAnalysis();
  rebuildRoom();
}

/* ============================================================
   رویدادها
   ============================================================ */
function bindEvents() {
  root.addEventListener('click', (e) => {
    const t = e.target;
    const scene = t.closest('[data-scene]');
    if (scene) { switchScene(scene.dataset.scene); return; }
    const view = t.closest('[data-view]');
    if (view) { setView(view.dataset.view); renderScenes(); haptic.light(); return; }
    const chip = t.closest('[data-chip]');
    if (chip) { setSelected(st.selected === chip.dataset.chip ? null : chip.dataset.chip); return; }
    const pick = t.closest('[data-pick]');
    if (pick) { applyColorToSelected(+pick.dataset.pick); return; }
    const wx = t.closest('[data-wx]');
    if (wx) { st.weather = wx.dataset.wx; updateSunPosition(); renderLightPane(); haptic.select(); return; }
    const dir = t.closest('[data-dir]');
    if (dir) { st.windowDir = dir.dataset.dir; updateSunPosition(); renderLightPane(); haptic.select(); return; }
    const kel = t.closest('[data-kel]');
    if (kel) { st.lampKelvin = +kel.dataset.kel; updateSunPosition(); renderLightPane(); haptic.select(); return; }
    const tab = t.closest('[data-tab]');
    if (tab) {
      $$('.s3-tabs button', root).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab.dataset.tab));
      $$('.s3-pane', root).forEach(p => p.classList.toggle('on', p.dataset.pane === tab.dataset.tab));
      return;
    }
    const action = t.closest('[data-a]');
    if (action && action.dataset.a === 'close') close();
    if (t.closest('#s3LampBtn')) {
      st.lampOn = !(st.lampOn === null ? (st.time >= 20 || st.time < 6) : st.lampOn);
      updateSunPosition(); renderLightPane(); haptic.select();
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.id === 's3Time') {
      st.time = +e.target.value;
      updateSunPosition(); renderLightPane();
    }
  });

  // کلیک روی canvas
  const stage = $('#s3Stage', root);
  stage.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
  stage.addEventListener('pointerup', (e) => {
    if (!downXY) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    if (Math.hypot(dx, dy) < 5) pickAt(e.clientX, e.clientY);
    downXY = null;
  });

  document.addEventListener('keydown', (e) => {
    if (!root || root.hidden) return;
    if (e.key === 'Escape') {
      if (st.selected) setSelected(null);
      else close();
    }
  });
}

function switchScene(id) {
  if (id === st.sceneId) return;
  st.sceneId = id;
  ensureAssignment();
  setSelected(null);
  renderAll();
  setView(SCENES[id].view || 'three_quarter', false);
  haptic.light();
}

/* ============================================================
   حلقه‌ی رندر
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  if (camAnim) camAnim();
  if (controls) controls.update();
  if (renderer) renderer.render(scene, camera);
}

/* ============================================================
   راه‌اندازی اولیه
   ============================================================ */
function initThree() {
  if (renderer) return;
  const stage = $('#s3Stage', root);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 15, 35);

  camera = new THREE.PerspectiveCamera(42, 16/10, 0.1, 100);
  camera.position.set(5.2, 2.4, 6.2);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, -0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minPolarAngle = 0.15;
  controls.enablePan = true;
  controls.panSpeed = 0.4;
  controls.update();

  // محیط PBR
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  setupLighting(scene);
  clock = new THREE.Clock();
  animate();

  // resize
  const resize = () => {
    const r = stage.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
}

/* ============================================================
   باز/بسته
   ============================================================ */
function open(paletteId) {
  const gs = getGlobalState();
  const palettes = gs && Array.isArray(gs.palettes) ? gs.palettes : [];
  const p = palettes.find(x => x.id === paletteId);
  if (!p || !Array.isArray(p.colors) || p.colors.length < 2) {
    try { tg?.showAlert?.('پالت پیدا نشد'); } catch (e) {}
    return;
  }
  if (!root) {
    injectCSS();
    root = buildShell();
    bindEvents();
    initThree();
  }
  Object.assign(st, {
    palette: p, asg: {}, selected: null, time: 13, weather: 'آفتابی',
    windowDir: 'جنوبی', lampOn: null, lampKelvin: 3000, view: 'three_quarter',
  });
  const tags = (p.tags || []).join(' ');
  if (tags.includes('اتاق خواب')) st.sceneId = 'bedroom';
  else if (tags.includes('آشپزخانه')) st.sceneId = 'kitchen';
  else if (tags.includes('حمام')) st.sceneId = 'bathroom';
  else if (tags.includes('اداری') || tags.includes('کتابخانه')) st.sceneId = 'office';
  else if (tags.includes('کافه')) st.sceneId = 'cafe';
  else st.sceneId = 'living';

  ensureAssignment();
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  renderAll();
  setView('three_quarter', false);
  // resize بعد از نمایش
  setTimeout(() => {
    const stage = $('#s3Stage', root);
    if (stage && renderer) {
      const r = stage.getBoundingClientRect();
      if (r.width > 0) {
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      }
    }
  }, 60);
  haptic.medium();
}

function close() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.style.overflow = '';
  haptic.light();
}

/* ============================================================
   اتصال به کارت‌ها
   ============================================================ */
function decorate() {
  $$('.pal').forEach(card => {
    const box = $('.pal-actions', card);
    if (!box || $('.act-studio', box)) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'act act-studio';
    b.dataset.studio = card.dataset.id;
    b.innerHTML = '<span>مشاهده در فضای سه‌بعدی</span>';
    box.appendChild(b);
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-studio]');
  if (!b) return;
  const gs = getGlobalState();
  if (!gs || !Array.isArray(gs.palettes) || !gs.palettes.length) return;
  open(b.dataset.studio);
});
const list = document.getElementById('list');
if (list) {
  new MutationObserver(decorate).observe(list, { childList: true });
  decorate();
}

window.__ravaq3D = { open, close, get state() { return st; } };