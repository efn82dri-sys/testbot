/* ============================================================
   رواق — استودیو سه‌بعدی (نسخه ۳ — کامل و پایدار)
   Three.js + PBR + نورپردازی واقعی + صحنه‌های معماری
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ============================================================
   پایه — Telegram، ابزارها، رنگ
   ============================================================ */
const tg = window.Telegram?.WebApp || null;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const toPN = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const fmt = (n, d = 0) => toPN(Number(n).toFixed(d)).replace('.', '٫');
const DEG = Math.PI / 180;

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

/* ---------- رنگ ---------- */
function hexToRgb(h) {
  const s = String(h).replace('#', '');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}
function rgbToHex(r, g, b) {
  const f = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t);
}
function srgbToLinear(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
function relLum(hex){ const [r,g,b]=hexToRgb(hex); return 0.2126*srgbToLinear(r)+0.7152*srgbToLinear(g)+0.0722*srgbToLinear(b); }
const lrv = (hex) => Math.round(relLum(hex) * 100);
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function saturation(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v/255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
function toHSV(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v/255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}
function popIndex(palette) {
  let best = 1, bestSat = -1;
  for (let i = 0; i < palette.length; i++) {
    const s = saturation(palette[i]);
    if (s > bestSat) { bestSat = s; best = i; }
  }
  return best;
}
function toCMYK(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v/255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1-r-k)/(1-k), (1-g-k)/(1-k), (1-b-k)/(1-k), k].map(v => Math.round(v*100));
}
function toLAB(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16/116;
  const x = f((0.4124*r + 0.3576*g + 0.1805*b) / 0.95047);
  const y = f(0.2126*r + 0.7152*g + 0.0722*b);
  const z = f((0.0193*r + 0.1192*g + 0.9505*b) / 1.089);
  return [116*y - 16, 500*(x-y), 200*(y-z)].map(Math.round);
}

/* ============================================================
   سیستم بافت رویه‌ای (Procedural Textures)
   همه بافت‌ها خاکستری/خنثی — رنگ از material.color می‌آید
   ============================================================ */
const TEX_CACHE = new Map();

function makeTexture(key, draw, opts = {}) {
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const size = opts.size || 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 8;
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  TEX_CACHE.set(key, t);
  return t;
}

/* ---------- چوب — رگه‌های افقی نامنظم ---------- */
function texWood() {
  return makeTexture('wood', (ctx, S) => {
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, S, S);
    // رگه‌های اصلی
    for (let i = 0; i < 180; i++) {
      const y = Math.random() * S;
      const amp = 1 + Math.random() * 4;
      const w = 0.4 + Math.random() * 2.5;
      const d = Math.random() < 0.5 ? 0.06 + Math.random() * 0.20 : -0.04 - Math.random() * 0.14;
      ctx.strokeStyle = d > 0 ? `rgba(30,30,30,${d})` : `rgba(245,245,245,${-d})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 3) {
        const yy = y + Math.sin(x * 0.011 + i) * amp + Math.sin(x * 0.055 + i * 2.3) * 0.7;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // رگه‌های ریز پراکنده
    for (let i = 0; i < 400; i++) {
      const y = Math.random() * S;
      ctx.strokeStyle = `rgba(60,60,60,${Math.random() * 0.08})`;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
    // نویز ریز
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 20;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, { size: 1024 });
}

/* ---------- مرمر — رگه‌های ارگانیک ---------- */
function texMarble() {
  return makeTexture('marble', (ctx, S) => {
    ctx.fillStyle = '#ECECEC';
    ctx.fillRect(0, 0, S, S);
    // رگه‌های اصلی تیره
    for (let i = 0; i < 22; i++) {
      const y0 = Math.random() * S;
      const amp = 30 + Math.random() * 90;
      const w = 0.6 + Math.random() * 2.4;
      const a = 0.20 + Math.random() * 0.35;
      ctx.strokeStyle = `rgba(70,70,70,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 5) {
        const y = y0 + Math.sin(x * 0.017 + i) * amp * 0.5 + (Math.random() - 0.5) * 5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // رگه‌های روشن ثانویه
    for (let i = 0; i < 30; i++) {
      const y0 = Math.random() * S;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.4 + Math.random() * 1.2;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 7) {
        const y = y0 + Math.sin(x * 0.042 + i) * 35 + (Math.random() - 0.5) * 7;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // نقاط کوارتز
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 0.3 + Math.random() * 1.5;
      ctx.fillStyle = `rgba(140,140,140,${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { size: 1024 });
}

/* ---------- گچ — نویز یکنواخت ریز ---------- */
function texPlaster() {
  return makeTexture('plaster', (ctx, S) => {
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // لکه‌های بسیار ملایم
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 20 + Math.random() * 80;
      const a = Math.random() * 0.03;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { size: 512 });
}

/* ---------- استوکو — بافتِ درشت‌تر ---------- */
function texStucco() {
  return makeTexture('stucco', (ctx, S) => {
    ctx.fillStyle = '#DDDDDD';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 32;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // دانه‌های درشت
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() < 0.5
        ? `rgba(255,255,255,${Math.random() * 0.4})`
        : `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { size: 1024 });
}

/* ---------- بتن — نویز چند لایه با لکه ---------- */
function texConcrete() {
  return makeTexture('concrete', (ctx, S) => {
    ctx.fillStyle = '#ABABAB';
    ctx.fillRect(0, 0, S, S);
    // لکه‌های بزرگ
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 30 + Math.random() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = Math.random() * 0.08;
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // حفره‌های هوا
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 0.5 + Math.random() * 3;
      ctx.fillStyle = `rgba(60,60,60,${Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // نویز ریز
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 24;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, { size: 1024 });
}

/* ---------- پارچه — تار و پود ---------- */
function texFabric() {
  return makeTexture('fabric', (ctx, S) => {
    ctx.fillStyle = '#C8C8C8';
    ctx.fillRect(0, 0, S, S);
    const step = 4;
    for (let y = 0; y < S; y += step) {
      ctx.strokeStyle = `rgba(55,55,55,${0.06 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(S, y);
      ctx.stroke();
    }
    for (let x = 0; x < S; x += step) {
      ctx.strokeStyle = `rgba(235,235,235,${0.06 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
    }
    // نویز ریز
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, { size: 512 });
}

/* ---------- مخمل — بافتِ جهت‌دار ---------- */
function texVelvet() {
  return makeTexture('velvet', (ctx, S) => {
    ctx.fillStyle = '#C4C4C4';
    ctx.fillRect(0, 0, S, S);
    // الیافِ عمودی
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const len = 2 + Math.random() * 5;
      ctx.strokeStyle = Math.random() < 0.5
        ? `rgba(255,255,255,${Math.random() * 0.20})`
        : `rgba(40,40,40,${Math.random() * 0.15})`;
      ctx.lineWidth = 0.4 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 1.5, y + len);
      ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- چرم — سلول‌های ارگانیک ---------- */
function texLeather() {
  return makeTexture('leather', (ctx, S) => {
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, S, S);
    // سلول‌های چرم
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 3 + Math.random() * 8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = Math.random() * 0.16;
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // شکاف‌های ریز
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.strokeStyle = `rgba(60,60,60,${Math.random() * 0.15})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      const len = 4 + Math.random() * 12;
      const ang = Math.random() * Math.PI * 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }, { size: 1024 });
}

/* ---------- فلز — نویز ریز با براقیت ---------- */
function texMetal() {
  return makeTexture('metal', (ctx, S) => {
    ctx.fillStyle = '#DADADA';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, { size: 512 });
}

/* ---------- سرامیک/کاشی — بافتِ ریز + درز ---------- */
function texTile() {
  return makeTexture('tile', (ctx, S) => {
    ctx.fillStyle = '#E4E4E4';
    ctx.fillRect(0, 0, S, S);
    // بافتِ ریز داخل کاشی
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // درزها
    const n = 2, step = S / n;
    ctx.strokeStyle = 'rgba(70,70,70,0.35)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(S, i * step); ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- فرش — پشمی درشت ---------- */
function texRug() {
  return makeTexture('rug', (ctx, S) => {
    ctx.fillStyle = '#BDBDBD';
    ctx.fillRect(0, 0, S, S);
    // الیافِ درهم
    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const a = Math.random() * Math.PI * 2;
      const len = 1 + Math.random() * 4;
      ctx.strokeStyle = Math.random() < 0.5
        ? `rgba(255,255,255,${Math.random() * 0.28})`
        : `rgba(30,30,30,${Math.random() * 0.28})`;
      ctx.lineWidth = 0.5 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- برگ — رگبرگ ---------- */
function texLeaf() {
  return makeTexture('leaf', (ctx, S) => {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(0, 0, S, S);
    // رگبرگ‌های افقی
    for (let i = 0; i < 30; i++) {
      const y = (i / 30) * S;
      ctx.strokeStyle = `rgba(80,80,80,${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 0.6 + Math.random() * 1;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 6) {
        const yy = y + Math.sin(x * 0.03 + i) * 8;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- بوم — کتان درشت ---------- */
function texCanvas() {
  return makeTexture('canvas', (ctx, S) => {
    ctx.fillStyle = '#C8C8C8';
    ctx.fillRect(0, 0, S, S);
    const step = 3;
    for (let y = 0; y < S; y += step) {
      ctx.strokeStyle = `rgba(60,60,60,${0.10 + Math.random() * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    for (let x = 0; x < S; x += step) {
      ctx.strokeStyle = `rgba(240,240,240,${0.10 + Math.random() * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- کاغذ — الیاف ریز ---------- */
function texPaper() {
  return makeTexture('paper', (ctx, S) => {
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // الیاف
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      ctx.strokeStyle = `rgba(80,80,80,${Math.random() * 0.10})`;
      ctx.lineWidth = 0.3;
      const len = 3 + Math.random() * 10;
      const ang = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }, { size: 512 });
}

/* ---------- سفال — بافتِ گرم ---------- */
function texClay() {
  return makeTexture('clay', (ctx, S) => {
    ctx.fillStyle = '#D0B8A0';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      p[i] += n; p[i+1] += n; p[i+2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // لکه‌های سوخته
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 10 + Math.random() * 40;
      ctx.fillStyle = `rgba(120,60,30,${Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { size: 512 });
}

/* ---------- آرایه‌ی بافت‌سازها ---------- */
const TEX_MAKER = {
  wood: texWood,
  marble: texMarble,
  plaster: texPlaster,
  stucco: texStucco,
  concrete: texConcrete,
  fabric: texFabric,
  velvet: texVelvet,
  leather: texLeather,
  metal: texMetal,
  tile: texTile,
  rug: texRug,
  leaf: texLeaf,
  canvas: texCanvas,
  paper: texPaper,
  clay: texClay,
};

/* ============================================================
   تعریف متریال‌ها
   هر نوع متریال: rough، metal، tex (نام بافت)، texScale، bump
   ============================================================ */
const KIND = {
  wall:      { rough: 0.94, metal: 0.00, tex: 'plaster',  texScale: [3, 3], bump: 0.02 },
  wallGloss: { rough: 0.55, metal: 0.00, tex: 'plaster',  texScale: [3, 3], bump: 0.02 },
  stucco:    { rough: 0.96, metal: 0.00, tex: 'stucco',   texScale: [4, 4], bump: 0.05 },
  concrete:  { rough: 0.88, metal: 0.00, tex: 'concrete', texScale: [2, 2], bump: 0.08 },
  wood:      { rough: 0.55, metal: 0.00, tex: 'wood',     texScale: [1, 1], bump: 0.05 },
  woodDark:  { rough: 0.48, metal: 0.00, tex: 'wood',     texScale: [1, 1], bump: 0.05 },
  marble:    { rough: 0.18, metal: 0.00, tex: 'marble',   texScale: [1, 1], bump: 0.01 },
  tile:      { rough: 0.22, metal: 0.00, tex: 'tile',     texScale: [1, 1], bump: 0.02 },
  fabric:    { rough: 0.98, metal: 0.00, tex: 'fabric',   texScale: [4, 4], bump: 0.08 },
  velvet:    { rough: 0.42, metal: 0.00, tex: 'velvet',   texScale: [3, 3], bump: 0.05 },
  leather:   { rough: 0.38, metal: 0.00, tex: 'leather',  texScale: [2, 2], bump: 0.03 },
  metal:     { rough: 0.20, metal: 1.00, tex: 'metal',    texScale: [2, 2], bump: 0.00 },
  brass:     { rough: 0.26, metal: 1.00, tex: 'metal',    texScale: [2, 2], bump: 0.00 },
  plant:     { rough: 0.85, metal: 0.00, tex: 'leaf',     texScale: [1, 1], bump: 0.02 },
  art:       { rough: 0.45, metal: 0.00, tex: 'canvas',   texScale: [1, 1], bump: 0.01 },
  rug:       { rough: 0.99, metal: 0.00, tex: 'rug',      texScale: [1, 1], bump: 0.15 },
  glass:     { rough: 0.04, metal: 0.00, tex: null,       texScale: [1, 1], bump: 0.00, transparent: true, opacity: 0.22 },
  paper:     { rough: 0.90, metal: 0.00, tex: 'paper',    texScale: [3, 3], bump: 0.01 },
  terracotta:{ rough: 0.72, metal: 0.00, tex: 'clay',     texScale: [1, 1], bump: 0.03 },
  ceiling:   { rough: 0.95, metal: 0.00, tex: 'plaster',  texScale: [4, 4], bump: 0.01 },
  ceramic:   { rough: 0.12, metal: 0.00, tex: null,       texScale: [1, 1], bump: 0.00 },
  screen:    { rough: 0.15, metal: 0.00, tex: null,       texScale: [1, 1], bump: 0.00, emissive: true },
};

/* ============================================================
   کش متریال — برای جلوگیری از ساخته‌شدن هزاران متریال یکسان
   ============================================================ */
const MAT_CACHE = new Map();
function makeMaterial(kindName, colorHex, override = {}) {
  const key = kindName + '|' + colorHex + '|' + JSON.stringify(override);
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  const k = KIND[kindName] || KIND.wall;
  const opts = {
    color: new THREE.Color(colorHex),
    roughness: k.rough,
    metalness: k.metal,
  };
  if (k.transparent) { opts.transparent = true; opts.opacity = k.opacity; }
  if (k.emissive) { opts.emissive = new THREE.Color(colorHex); opts.emissiveIntensity = 0.6; }
  if (k.tex && TEX_MAKER[k.tex]) {
    const base = TEX_MAKER[k.tex]();
    const cloned = base.clone();
    cloned.needsUpdate = true;
    cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(k.texScale[0], k.texScale[1]);
    opts.map = cloned;
    // bump map از همان map برای عمق بیشتر
    if (k.bump > 0) {
      opts.bumpMap = cloned;
      opts.bumpScale = k.bump;
    }
  }
  Object.assign(opts, override);
  const mat = new THREE.MeshStandardMaterial(opts);
  mat.userData.kind = kindName;
  mat.userData.baseHex = colorHex;
  MAT_CACHE.set(key, mat);
  return mat;
}

/* ============================================================
   وضعیت برنامه
   ============================================================ */
const st = {
  palette: null,
  sceneId: 'living',
  asg: {},
  selected: null,
  time: 13,
  weather: 'آفتابی',
  windowDir: 'جنوبی',
  lampOn: null,
  lampKelvin: 3000,
  view: 'three_quarter',
  viewLocked: false,
};

/* ============================================================
   تعریف صحنه‌ها — هر فضا با ابعاد واقعی خودش
   ============================================================ */
const SCENES = {
  living: {
    name: 'نشیمنِ مدرن',
    subtitle: 'نمایِ پنجره — نورِ جنوبی',
    dims: { w: 6.0, d: 4.6, h: 2.9 },
    cam: { pos: [4.8, 2.0, 5.5], target: [0, 1.1, -0.4] },
    build: buildLiving,
  },
  bedroom: {
    name: 'اتاقِ خواب',
    subtitle: 'تاجِ تخت — نورِ عصر',
    dims: { w: 4.6, d: 4.2, h: 2.8 },
    cam: { pos: [3.8, 2.0, 4.8], target: [0, 1.0, -0.4] },
    build: buildBedroom,
  },
  kitchen: {
    name: 'آشپزخانه‌یِ مدرن',
    subtitle: 'کانترِ مرمری — نورِ روز',
    dims: { w: 4.2, d: 3.6, h: 2.7 },
    cam: { pos: [3.4, 1.9, 4.0], target: [0, 1.0, -1.0] },
    build: buildKitchen,
  },
  bathroom: {
    name: 'حمامِ اسپا',
    subtitle: 'کاشی سرتاسری — روشوییِ مرمری',
    dims: { w: 2.8, d: 2.6, h: 2.6 },
    cam: { pos: [2.2, 1.9, 3.2], target: [0, 1.0, -0.8] },
    build: buildBathroom,
  },
  office: {
    name: 'دفترِ کار',
    subtitle: 'میزِ چوبی — قفسه‌یِ کتاب',
    dims: { w: 4.0, d: 3.6, h: 2.8 },
    cam: { pos: [3.2, 1.9, 4.2], target: [0, 1.0, -0.6] },
    build: buildOffice,
  },
  cafe: {
    name: 'کافه',
    subtitle: 'کانترِ چوبی — نورِ آویز',
    dims: { w: 7.5, d: 4.5, h: 3.2 },
    cam: { pos: [4.5, 2.2, 5.8], target: [0, 1.0, -0.5] },
    build: buildCafe,
  },
};

/* ============================================================
   ابزارهای ساخت
   ============================================================ */
const _pickables = [];
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
function cyl(rt, rb, h, mat, pos = [0, 0, 0], seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(...pos);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ============================================================
   پوسته‌ی اتاق — کف، دیوارها، سقف، پنجره
   ============================================================ */
function buildShell(dims, palette, opts = {}) {
  const { w, d, h } = dims;
  const g = new THREE.Group();
  const WIN_W = opts.winW ?? Math.min(w * 0.55, 2.6);
  const WIN_H = opts.winH ?? 1.5;
  const WIN_Y0 = opts.winY0 ?? 0.9;
  const WIN_X0 = opts.winX0 ?? -WIN_W / 2;

  // ---- کف ----
  const floorKind = opts.floorKind || 'wood';
  const floorMat = makeMaterial(floorKind, palette.asg.floor ?? '#8a6a48');
  floorMat.map.repeat.set(w * 0.8, d * 0.8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.layerId = 'floor';
  _pickables.push(floor);
  g.add(floor);

  // ---- سقف ----
  const ceilMat = makeMaterial('ceiling', '#f5f2ec');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  ceil.userData.layerId = 'ceiling';
  _pickables.push(ceil);
  g.add(ceil);

  // ---- دیوار پشت با سوراخ پنجره ----
  const wallMat = makeMaterial('wall', palette.asg.wall ?? '#e8e2d4');
  wallMat.map.repeat.set(w * 0.6, h * 0.6);
  const shape = new THREE.Shape();
  shape.moveTo(-w/2, 0);
  shape.lineTo( w/2, 0);
  shape.lineTo( w/2, h);
  shape.lineTo(-w/2, h);
  shape.lineTo(-w/2, 0);
  const hole = new THREE.Path();
  hole.moveTo(WIN_X0, WIN_Y0);
  hole.lineTo(WIN_X0 + WIN_W, WIN_Y0);
  hole.lineTo(WIN_X0 + WIN_W, WIN_Y0 + WIN_H);
  hole.lineTo(WIN_X0, WIN_Y0 + WIN_H);
  hole.lineTo(WIN_X0, WIN_Y0);
  shape.holes.push(hole);
  const backGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
  const backWall = new THREE.Mesh(backGeo, wallMat);
  backWall.position.set(0, 0, -d/2 - 0.14);
  backWall.receiveShadow = true;
  backWall.userData.layerId = 'wall';
  _pickables.push(backWall);
  g.add(backWall);

  // ---- دیوار چپ ----
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, d), wallMat);
  leftWall.position.set(-w/2, h/2, 0);
  leftWall.receiveShadow = true;
  leftWall.userData.layerId = 'wall';
  _pickables.push(leftWall);
  g.add(leftWall);

  // ---- دیوار راست ----
  const rightWall = leftWall.clone();
  rightWall.position.x = w/2;
  rightWall.userData.layerId = 'wall';
  _pickables.push(rightWall);
  g.add(rightWall);

  // ---- شیشه‌ی پنجره ----
  const glassMat = makeMaterial('glass', '#e8f0f4');
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W - 0.1, WIN_H - 0.1), glassMat);
  glass.position.set(WIN_X0 + WIN_W/2, WIN_Y0 + WIN_H/2, -d/2 - 0.07);
  glass.userData.layerId = 'window';
  _pickables.push(glass);
  g.add(glass);

  // ---- قابِ پنجره ----
  const frameMat = makeMaterial('woodDark', palette.asg.frame ?? '#2a1e14');
  const fT = 0.10, fW = 0.12;
  const mk = (w2, h2, x, y) => {
    const m = box(w2, h2, fW, frameMat, [x, y, -d/2 - 0.06]);
    m.userData.layerId = 'frame';
    _pickables.push(m);
    return m;
  };
  g.add(mk(WIN_W + 0.20, fT, WIN_X0 + WIN_W/2, WIN_Y0 - 0.02));
  g.add(mk(WIN_W + 0.20, fT, WIN_X0 + WIN_W/2, WIN_Y0 + WIN_H + 0.02));
  g.add(mk(fT, WIN_H + 0.20, WIN_X0 - 0.02, WIN_Y0 + WIN_H/2));
  g.add(mk(fT, WIN_H + 0.20, WIN_X0 + WIN_W + 0.02, WIN_Y0 + WIN_H/2));
  // میله‌ی وسط
  g.add(mk(fT * 0.55, WIN_H, WIN_X0 + WIN_W/2, WIN_Y0 + WIN_H/2));

  // ---- طاقچه‌ی پنجره ----
  const sill = box(WIN_W + 0.30, 0.04, 0.20, wallMat, [WIN_X0 + WIN_W/2, WIN_Y0 - 0.04, -d/2 - 0.02]);
  sill.userData.layerId = 'frame';
  _pickables.push(sill);
  g.add(sill);

  // ---- آسمان بیرون ----
  const skyGeo = new THREE.PlaneGeometry(40, 20);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xb8cce0 });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(WIN_X0 + WIN_W/2, WIN_Y0 + WIN_H/2 + 2, -d/2 - 6);
  sky.userData.isSky = true;
  g.add(sky);

  return g;
}

/* ============================================================
   مبل — با روکشِ واقعی و بالشتک‌های نرم
   ============================================================ */
function addSofa(parent, palette, opts = {}) {
  const g = new THREE.Group();
  g.position.set(opts.pos?.[0] ?? 0, 0, opts.pos?.[2] ?? 0.5);
  if (opts.rot) g.rotation.y = opts.rot;
  const W = opts.w ?? 2.1;
  const H = 0.42, D = 0.88;
  const color = palette.asg.sofa ?? '#8a7a68';
  const mat = makeMaterial('fabric', color);
  const legMat = makeMaterial('woodDark', '#2a1e14');

  // پاها
  const legOffsetX = W/2 - 0.15;
  const legOffsetZ = D/2 - 0.15;
  [[-legOffsetX, legOffsetZ], [legOffsetX, legOffsetZ], [-legOffsetX, -legOffsetZ], [legOffsetX, -legOffsetZ]].forEach(([x, z]) => {
    const leg = cyl(0.03, 0.03, 0.12, legMat, [x, 0.06, z], 12);
    leg.userData.layerId = 'sofa';
    _pickables.push(leg);
    g.add(leg);
  });

  // نشیمن
  const body = rbox(W, H, D, 0.08, mat, [0, 0.33, 0]);
  pickable(body, 'sofa');
  g.add(body);

  // پشتی
  const back = rbox(W, 0.58, 0.22, 0.07, mat, [0, 0.78, -D/2 + 0.12]);
  pickable(back, 'sofa');
  g.add(back);

  // دسته‌ها
  const armW = 0.22;
  const armL = rbox(armW, 0.55, D, 0.07, mat, [-W/2 + armW/2, 0.62, 0]);
  const armR = rbox(armW, 0.55, D, 0.07, mat, [ W/2 - armW/2, 0.62, 0]);
  pickable(armL, 'sofa'); pickable(armR, 'sofa');
  g.add(armL); g.add(armR);

  // کوسن‌ها
  const cMat = makeMaterial('velvet', palette.asg.cushions ?? '#b89878');
  const cushionW = (W - armW * 2 - 0.10) / 2;
  [-cushionW/2 - 0.05, cushionW/2 + 0.05].forEach(x => {
    const c = rbox(cushionW, 0.16, D - 0.25, 0.06, cMat, [x, 0.58, 0]);
    pickable(c, 'cushions');
    g.add(c);
  });

  parent.add(g);
  return g;
}

/* ============================================================
   میز جلومبلی
   ============================================================ */
function addCoffeeTable(parent, palette, opts = {}) {
  const g = new THREE.Group();
  g.position.set(opts.pos?.[0] ?? 0, 0, opts.pos?.[2] ?? -0.4);
  const W = 1.0, H = 0.42, D = 0.6;
  const mat = makeMaterial('woodDark', palette.asg.table ?? '#4a3324');
  const legMat = makeMaterial('metal', '#161616');

  const top = rbox(W, 0.05, D, 0.02, mat, [0, H - 0.025, 0]);
  pickable(top, 'table');
  g.add(top);

  // پایه‌ها
  const legX = W/2 - 0.09, legZ = D/2 - 0.09;
  [[-legX, legZ], [legX, legZ], [-legX, -legZ], [legX, -legZ]].forEach(([x, z]) => {
    const leg = cyl(0.014, 0.014, H - 0.05, legMat, [x, (H-0.05)/2, z], 12);
    leg.userData.layerId = 'table';
    _pickables.push(leg);
    g.add(leg);
  });

  // کتاب روی میز
  const bookMat = makeMaterial('paper', palette.asg.accent ?? '#a85040');
  const b1 = box(0.24, 0.045, 0.32, bookMat, [0.18, H + 0.02, 0]);
  b1.userData.layerId = 'accent';
  _pickables.push(b1);
  g.add(b1);
  const b2 = box(0.22, 0.035, 0.30, bookMat, [0.20, H + 0.065, 0.02]);
  b2.userData.layerId = 'accent';
  _pickables.push(b2);
  g.add(b2);

  parent.add(g);
  return g;
}

/* ============================================================
   فرش
   ============================================================ */
function addRug(parent, palette, opts = {}) {
  const W = opts.w ?? 3.0, D = opts.d ?? 2.0;
  const color = palette.asg.rug ?? '#7a5a44';
  const mat = makeMaterial('rug', color);
  mat.map.repeat.set(1, 1);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, D), mat);
  rug.position.set(opts.pos?.[0] ?? 0, 0.008, opts.pos?.[2] ?? 0.3);
  rug.receiveShadow = true;
  rug.userData.layerId = 'rug';
  _pickables.push(rug);
  parent.add(rug);
}

/* ============================================================
   آباژور ایستاده
   ============================================================ */
function addFloorLamp(parent, palette, pos) {
  const g = new THREE.Group();
  g.position.set(...pos);
  const baseMat = makeMaterial('metal', '#141414');
  const poleMat = makeMaterial('brass', palette.asg.lamp ?? '#a88850');

  const base = cyl(0.16, 0.18, 0.025, baseMat, [0, 0.0125, 0], 32);
  base.userData.layerId = 'lamp';
  _pickables.push(base);
  g.add(base);

  const pole = cyl(0.014, 0.014, 1.45, poleMat, [0, 0.74, 0], 12);
  pole.userData.layerId = 'lamp';
  _pickables.push(pole);
  g.add(pole);

  const shadeMat = makeMaterial('fabric', '#e8dcc4');
  shadeMat.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.30, 32, 1, true), shadeMat);
  shade.position.set(0, 1.58, 0);
  shade.userData.layerId = 'lamp';
  shade.userData.isLampShade = true;
  _pickables.push(shade);
  g.add(shade);

  const pl = new THREE.PointLight(0xffc88e, 0, 5, 1.8);
  pl.position.set(0, 1.5, 0);
  pl.userData.isLampLight = true;
  g.add(pl);

  parent.add(g);
  return g;
}

/* ============================================================
   گیاه — سفال + برگ‌های مخروطی
   ============================================================ */
function addPlant(parent, palette, pos, scale = 1) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.scale.setScalar(scale);

  const potMat = makeMaterial('terracotta', palette.asg.pot ?? '#9a5a3a');
  const pot = cyl(0.17, 0.13, 0.30, potMat, [0, 0.15, 0], 32);
  pot.userData.layerId = 'plant_pot';
  _pickables.push(pot);
  g.add(pot);

  const soil = cyl(0.155, 0.155, 0.02, makeMaterial('clay', '#3a2418'), [0, 0.30, 0], 32);
  g.add(soil);

  const leafMat = makeMaterial('plant', palette.asg.leaf ?? '#3e6b3e');
  const nLeaves = 8;
  for (let i = 0; i < nLeaves; i++) {
    const angle = (i / nLeaves) * Math.PI * 2;
    const len = 0.4 + Math.random() * 0.3;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, len, 8), leafMat);
    const rad = 0.05 + Math.random() * 0.04;
    leaf.position.set(Math.cos(angle) * rad, 0.30 + len/2, Math.sin(angle) * rad);
    leaf.rotation.z = Math.cos(angle) * 0.4;
    leaf.rotation.x = Math.sin(angle) * 0.4;
    leaf.castShadow = true;
    leaf.userData.layerId = 'plant_leaf';
    _pickables.push(leaf);
    g.add(leaf);
  }

  parent.add(g);
  return g;
}

/* ============================================================
   تابلو با قاب
   ============================================================ */
function addWallArt(parent, palette, opts) {
  const w = opts.w ?? 0.9, h = opts.h ?? 0.65;
  const pos = opts.pos ?? [0, 2.0, -2.0];
  const frameMat = makeMaterial('woodDark', '#1a1410');
  const frame = box(w + 0.10, h + 0.10, 0.05, frameMat, pos);
  frame.userData.layerId = 'frame';
  _pickables.push(frame);
  parent.add(frame);

  const artMat = makeMaterial('art', palette.asg.art ?? '#c8b898');
  const canvas = box(w, h, 0.025, artMat, [pos[0], pos[1], pos[2] + 0.03]);
  canvas.userData.layerId = 'art';
  _pickables.push(canvas);
  parent.add(canvas);
}

/* ============================================================
   پرده — با چین‌های موجی
   ============================================================ */
function addCurtains(parent, palette, opts) {
  const winX0 = opts.winX0, winW = opts.winW, winY0 = opts.winY0, winH = opts.winH;
  const zPos = opts.zPos;
  const color = palette.asg.curtain ?? '#d8c8a8';
  const mat = makeMaterial('fabric', color);
  mat.side = THREE.DoubleSide;

  const cW = 0.55, cH = winH + 0.40;

  // چپ
  const left = new THREE.Mesh(new THREE.PlaneGeometry(cW, cH, 16, 4), mat);
  const posL = left.geometry.attributes.position;
  for (let i = 0; i < posL.count; i++) {
    const x = posL.getX(i);
    posL.setZ(i, Math.sin(x * 26) * 0.035);
  }
  left.geometry.computeVertexNormals();
  left.position.set(winX0 - cW/2 + 0.02, winY0 + winH/2, zPos);
  left.userData.layerId = 'curtain';
  left.castShadow = true;
  _pickables.push(left);
  parent.add(left);

  // راست
  const right = new THREE.Mesh(new THREE.PlaneGeometry(cW, cH, 16, 4), mat);
  const posR = right.geometry.attributes.position;
  for (let i = 0; i < posR.count; i++) {
    const x = posR.getX(i);
    posR.setZ(i, Math.sin(x * 26) * 0.035);
  }
  right.geometry.computeVertexNormals();
  right.position.set(winX0 + winW + cW/2 - 0.02, winY0 + winH/2, zPos);
  right.userData.layerId = 'curtain';
  right.castShadow = true;
  _pickables.push(right);
  parent.add(right);
}

/* ============================================================
   صحنه‌ها
   ============================================================ */
function buildLiving(palette) {
  const dims = SCENES.living.dims;
  const g = buildShell(dims, palette, { winW: 2.8, winH: 1.6, winY0: 0.85 });
  addRug(g, palette, { w: 3.4, d: 2.4, pos: [0, 0, 0.6] });
  addSofa(g, palette, { pos: [0, 0, 0.3], w: 2.2, rot: 0 });
  addCoffeeTable(g, palette, { pos: [0, 0, -0.9] });
  addFloorLamp(g, palette, [-dims.w/2 + 0.5, 0, -dims.d/2 + 0.6]);
  addPlant(g, palette, [dims.w/2 - 0.55, 0, -dims.d/2 + 0.6], 1.2);
  addWallArt(g, palette, { pos: [0, 2.05, -dims.d/2 - 0.02], w: 1.0, h: 0.7 });

  // کنسول پشت مبل
  const conMat = makeMaterial('woodDark', palette.asg.table ?? '#3a2a1e');
  const con = box(1.8, 0.34, 0.35, conMat, [0, 0.17, dims.d/2 - 0.25]);
  con.userData.layerId = 'console';
  _pickables.push(con);
  g.add(con);

  return g;
}

function buildBedroom(palette) {
  const dims = SCENES.bedroom.dims;
  const g = buildShell(dims, palette, { winW: 2.2, winH: 1.4, winY0: 0.9 });

  // دیوار تأکیدی پشتِ تخت
  const accentMat = makeMaterial('wallGloss', palette.asg.accent ?? '#7a5a44');
  accentMat.map.repeat.set(2, 2);
  const accent = new THREE.Mesh(new THREE.PlaneGeometry(3.2, dims.h), accentMat);
  accent.position.set(0, dims.h/2, -dims.d/2 + 0.05);
  accent.userData.layerId = 'accent';
  _pickables.push(accent);
  g.add(accent);

  addRug(g, palette, { w: 2.6, d: 1.9, pos: [0, 0, 0.4] });

  // تخت
  const bedG = new THREE.Group();
  bedG.position.set(0, 0, 0);
  const frameMat = makeMaterial('wood', palette.asg.frame ?? '#5a4230');
  const headMat = makeMaterial('velvet', palette.asg.headboard ?? '#3e2a3a');
  const bedBody = rbox(1.7, 0.30, 2.05, 0.05, frameMat, [0, 0.15, 0]);
  pickable(bedBody, 'bedbody');
  bedG.add(bedBody);
  const headboard = rbox(1.7, 0.95, 0.14, 0.06, headMat, [0, 0.78, -1.00]);
  pickable(headboard, 'headboard');
  bedG.add(headboard);
  const mattressMat = makeMaterial('fabric', palette.asg.mattress ?? '#e8dcc4');
  const mattress = rbox(1.6, 0.22, 1.90, 0.05, mattressMat, [0, 0.41, 0]);
  pickable(mattress, 'mattress');
  bedG.add(mattress);

  // بالش‌ها
  const pillowMat = makeMaterial('fabric', '#f0e8d8');
  [-0.40, 0.40].forEach(x => {
    const p = rbox(0.60, 0.14, 0.40, 0.06, pillowMat, [x, 0.58, -0.72]);
    pickable(p, 'pillow');
    bedG.add(p);
  });

  // پتوی تزئینی
  const throwMat = makeMaterial('velvet', palette.asg.throw ?? '#a85050');
  const throwB = rbox(1.55, 0.04, 0.65, 0.03, throwMat, [0, 0.54, 0.55]);
  pickable(throwB, 'throw');
  bedG.add(throwB);

  g.add(bedG);

  // پاتختی‌ها
  const nightMat = makeMaterial('wood', palette.asg.night ?? '#5a4230');
  const lampMat = makeMaterial('brass', '#a88850');
  [-1.15, 1.15].forEach(x => {
    const night = box(0.45, 0.42, 0.38, nightMat, [x, 0.21, -0.90]);
    night.userData.layerId = 'night';
    _pickables.push(night);
    g.add(night);

    // آباژور
    const base = cyl(0.05, 0.07, 0.04, lampMat, [x, 0.44, -0.90], 20);
    base.userData.layerId = 'lamp';
    _pickables.push(base);
    g.add(base);

    const pole = cyl(0.010, 0.010, 0.14, lampMat, [x, 0.53, -0.90], 10);
    pole.userData.layerId = 'lamp';
    _pickables.push(pole);
    g.add(pole);

    const shadeMat = makeMaterial('fabric', '#e8d8b8');
    shadeMat.side = THREE.DoubleSide;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.16, 24, 1, true), shadeMat);
    shade.position.set(x, 0.68, -0.90);
    shade.userData.layerId = 'lamp';
    _pickables.push(shade);
    g.add(shade);

    const pl = new THREE.PointLight(0xffc88e, 0, 3, 1.8);
    pl.position.set(x, 0.68, -0.90);
    pl.userData.isLampLight = true;
    g.add(pl);
  });

  addWallArt(g, palette, { pos: [0, 2.05, -dims.d/2 + 0.06], w: 0.8, h: 0.55 });

  return g;
}

function buildKitchen(palette) {
  const dims = SCENES.kitchen.dims;
  const g = buildShell(dims, palette, { winW: 2.0, winH: 1.3, winY0: 1.0, floorKind: 'tile' });

  const cabMat = makeMaterial('wallGloss', palette.asg.cabinet ?? '#e8e4d8');
  const counterMat = makeMaterial('marble', palette.asg.counter ?? '#d8d0c0');
  const splashMat = makeMaterial('tile', palette.asg.splash ?? '#c8c0b0');
  const hwMat = makeMaterial('brass', palette.asg.hardware ?? '#a88850');

  const counterW = dims.w - 0.3;
  const counterZ = -dims.d/2 + 0.35;

  // کابینت پایین
  const lower = box(counterW, 0.85, 0.62, cabMat, [0, 0.425, counterZ]);
  lower.userData.layerId = 'lower';
  _pickables.push(lower);
  g.add(lower);

  // کانتر سنگی
  const counter = box(counterW + 0.05, 0.05, 0.68, counterMat, [0, 0.875, counterZ]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);

  // میان‌کابینتی
  splashMat.map.repeat.set(2, 2);
  const splash = box(counterW, 0.60, 0.02, splashMat, [0, 1.2, counterZ - 0.31]);
  splash.userData.layerId = 'splash';
  _pickables.push(splash);
  g.add(splash);

  // کابینت بالا
  const upper = box(counterW, 0.70, 0.36, cabMat, [0, 1.85, counterZ - 0.13]);
  upper.userData.layerId = 'upper';
  _pickables.push(upper);
  g.add(upper);

  // درزهای کابینت
  const lineMat = makeMaterial('woodDark', '#0a0806');
  const nDivisions = 4;
  for (let i = 1; i < nDivisions; i++) {
    const x = -counterW/2 + (i / nDivisions) * counterW;
    const line = box(0.006, 0.70, 0.37, lineMat, [x, 1.85, counterZ - 0.13]);
    g.add(line);
  }

  // دستگیره‌ها
  for (let i = 0; i < nDivisions * 2; i++) {
    const x = -counterW/2 + 0.3 + i * (counterW - 0.6) / (nDivisions * 2 - 1);
    const h = box(0.018, 0.16, 0.018, hwMat, [x, 0.55, counterZ + 0.32]);
    h.userData.layerId = 'hardware';
    _pickables.push(h);
    g.add(h);
  }

  // سینک
  const sinkMat = makeMaterial('metal', '#a8a8a8');
  const sink = box(0.72, 0.02, 0.40, sinkMat, [-0.7, 0.89, counterZ]);
  sink.userData.layerId = 'counter';
  _pickables.push(sink);
  g.add(sink);

  // شیر
  const faucetBase = cyl(0.025, 0.025, 0.20, hwMat, [-0.7, 1.0, counterZ - 0.15], 16);
  faucetBase.userData.layerId = 'hardware';
  _pickables.push(faucetBase);
  g.add(faucetBase);
  const faucetArm = cyl(0.018, 0.018, 0.20, hwMat, [-0.7, 1.15, counterZ - 0.05], 16);
  faucetArm.rotation.x = Math.PI / 2;
  faucetArm.userData.layerId = 'hardware';
  _pickables.push(faucetArm);
  g.add(faucetArm);

  // هود
  const hoodMat = makeMaterial('metal', '#d0d0d0');
  const hood = box(0.75, 0.10, 0.55, hoodMat, [0.7, 2.45, counterZ - 0.13]);
  hood.userData.layerId = 'hood';
  _pickables.push(hood);
  g.add(hood);
  const hoodStack = box(0.35, 0.25, 0.35, hoodMat, [0.7, 2.63, counterZ - 0.13]);
  hoodStack.userData.layerId = 'hood';
  _pickables.push(hoodStack);
  g.add(hoodStack);

  // دو صندلی
  const stoolMat = makeMaterial('leather', palette.asg.stool ?? '#5a4030');
  const legMat = makeMaterial('metal', '#141414');
  [-1.2, 1.2].forEach(x => {
    const seat = cyl(0.19, 0.19, 0.06, stoolMat, [x, 0.68, counterZ + 0.6], 32);
    seat.userData.layerId = 'stool';
    _pickables.push(seat);
    g.add(seat);
    const leg = cyl(0.018, 0.018, 0.68, legMat, [x, 0.34, counterZ + 0.6], 12);
    leg.userData.layerId = 'stool';
    _pickables.push(leg);
    g.add(leg);
  });

  return g;
}

function buildBathroom(palette) {
  const dims = SCENES.bathroom.dims;
  const g = buildShell(dims, palette, { winW: 1.4, winH: 1.1, winY0: 1.3, floorKind: 'tile' });

  // کاشی روی دیوارها
  const tileMat = makeMaterial('tile', palette.asg.wall ?? '#e8e4dc');
  tileMat.map.repeat.set(2, 2);

  // دیوار تأکیدی
  const accentMat = makeMaterial('tile', palette.asg.accent ?? '#7a8a94');
  accentMat.map.repeat.set(2, 2);
  const accent = new THREE.Mesh(new THREE.PlaneGeometry(1.6, dims.h), accentMat);
  accent.position.set(0, dims.h/2, -dims.d/2 + 0.05);
  accent.userData.layerId = 'accent';
  _pickables.push(accent);
  g.add(accent);

  const vanityMat = makeMaterial('wood', palette.asg.vanity ?? '#5a4030');
  const counterMat = makeMaterial('marble', palette.asg.counter ?? '#e8e0d0');
  const hwMat = makeMaterial('brass', palette.asg.hardware ?? '#a88850');

  const vanityZ = -dims.d/2 + 0.30;

  // کابینت
  const vanity = box(0.95, 0.55, 0.48, vanityMat, [0, 0.48, vanityZ]);
  vanity.userData.layerId = 'vanity';
  _pickables.push(vanity);
  g.add(vanity);

  // کانتر
  const counter = box(1.00, 0.045, 0.52, counterMat, [0, 0.78, vanityZ]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);

  // روشویی
  const basinMat = makeMaterial('ceramic', '#f8f8f4');
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.15, 0.10, 32), basinMat);
  basin.position.set(0, 0.84, vanityZ);
  basin.userData.layerId = 'basin';
  _pickables.push(basin);
  g.add(basin);

  // شیر
  const fBase = cyl(0.018, 0.018, 0.18, hwMat, [0, 0.95, vanityZ - 0.14], 16);
  fBase.userData.layerId = 'hardware';
  _pickables.push(fBase);
  g.add(fBase);
  const fArm = cyl(0.014, 0.014, 0.14, hwMat, [0, 1.04, vanityZ - 0.07], 16);
  fArm.rotation.x = Math.PI / 2;
  fArm.userData.layerId = 'hardware';
  _pickables.push(fArm);
  g.add(fArm);

  // آینه
  const mirrorFrameMat = makeMaterial('brass', '#a88850');
  const frame = box(0.82, 0.92, 0.035, mirrorFrameMat, [0, 1.55, -dims.d/2 + 0.10]);
  frame.userData.layerId = 'mirror_frame';
  _pickables.push(frame);
  g.add(frame);

  const mirrorMat = makeMaterial('glass', '#c8d4e0', { opacity: 0.55 });
  const mirror = box(0.76, 0.86, 0.015, mirrorMat, [0, 1.55, -dims.d/2 + 0.13]);
  mirror.userData.layerId = 'mirror';
  _pickables.push(mirror);
  g.add(mirror);

  // حوله‌ها
  const towelMat = makeMaterial('fabric', palette.asg.towel ?? '#e8dcc4');
  [-0.75, 0.75].forEach(x => {
    const t = box(0.28, 0.55, 0.02, towelMat, [x, 1.5, -dims.d/2 + 0.10]);
    t.userData.layerId = 'towel';
    _pickables.push(t);
    g.add(t);
    const bar = cyl(0.012, 0.012, 0.35, hwMat, [x, 1.5, -dims.d/2 + 0.10], 12);
    bar.rotation.z = Math.PI / 2;
    bar.userData.layerId = 'hardware';
    _pickables.push(bar);
    g.add(bar);
  });

  // زیرپایی
  addRug(g, palette, { w: 1.1, d: 0.75, pos: [0, 0, 0.4] });

  return g;
}

function buildOffice(palette) {
  const dims = SCENES.office.dims;
  const g = buildShell(dims, palette, { winW: 2.2, winH: 1.4, winY0: 0.9 });

  // میز
  const deskMat = makeMaterial('woodDark', palette.asg.desk ?? '#3a2a1e');
  const top = rbox(1.85, 0.05, 0.85, 0.015, deskMat, [0, 0.74, -0.2]);
  pickable(top, 'desk');
  g.add(top);

  const legPos = [[-0.85, -0.55], [0.85, -0.55], [-0.85, 0.15], [0.85, 0.15]];
  legPos.forEach(([x, z]) => {
    const leg = box(0.05, 0.72, 0.05, deskMat, [x, 0.36, z - 0.2]);
    leg.userData.layerId = 'desk';
    _pickables.push(leg);
    g.add(leg);
  });

  // مانیتور
  const monMat = makeMaterial('metal', '#141414');
  const mBase = box(0.30, 0.02, 0.20, monMat, [0, 0.77, -0.35]);
  mBase.userData.layerId = 'monitor';
  _pickables.push(mBase);
  g.add(mBase);

  const mStand = cyl(0.025, 0.025, 0.25, monMat, [0, 0.90, -0.35], 16);
  mStand.userData.layerId = 'monitor';
  _pickables.push(mStand);
  g.add(mStand);

  const screenMat = makeMaterial('screen', '#0a1a2e');
  const screen = box(0.68, 0.40, 0.03, screenMat, [0, 1.22, -0.35]);
  screen.userData.layerId = 'monitor';
  _pickables.push(screen);
  g.add(screen);

  // صندلی اداری
  const chairMat = makeMaterial('velvet', palette.asg.chair ?? '#3a3a4a');
  const seat = rbox(0.52, 0.10, 0.52, 0.04, chairMat, [0, 0.50, 0.45]);
  pickable(seat, 'chair');
  g.add(seat);

  const back = rbox(0.52, 0.60, 0.10, 0.04, chairMat, [0, 0.82, 0.68]);
  pickable(back, 'chair');
  g.add(back);

  const cLegMat = makeMaterial('metal', '#1a1a1a');
  const cStand = cyl(0.03, 0.03, 0.42, cLegMat, [0, 0.24, 0.45], 16);
  cStand.userData.layerId = 'chair';
  _pickables.push(cStand);
  g.add(cStand);

  const cBase = cyl(0.32, 0.32, 0.025, cLegMat, [0, 0.04, 0.45], 32);
  cBase.userData.layerId = 'chair';
  _pickables.push(cBase);
  g.add(cBase);

  // کتابخانه
  const shelfMat = makeMaterial('wood', palette.asg.shelf ?? '#5a4230');
  const shelf = box(0.85, 1.9, 0.36, shelfMat, [dims.w/2 - 0.45, 0.95, -dims.d/2 + 0.20]);
  shelf.userData.layerId = 'shelf';
  _pickables.push(shelf);
  g.add(shelf);

  // قفسه‌ها
  for (let y = 0.3; y < 1.85; y += 0.38) {
    const s = box(0.81, 0.02, 0.34, shelfMat, [dims.w/2 - 0.45, y, -dims.d/2 + 0.20]);
    g.add(s);
  }

  // کتاب‌ها
  const bookColors = [palette.asg.book1 ?? '#a85040', palette.asg.book2 ?? '#3a6b5a', palette.asg.book3 ?? '#b89850'];
  const shelfX0 = dims.w/2 - 0.45;
  const shelfZ0 = -dims.d/2 + 0.20;
  for (let level = 0; level < 4; level++) {
    const y = 0.3 + level * 0.38 + 0.14;
    let xOffset = -0.35;
    while (xOffset < 0.32) {
      const bW = 0.04 + Math.random() * 0.04;
      const bH = 0.18 + Math.random() * 0.06;
      const bMat = makeMaterial('paper', bookColors[Math.floor(Math.random() * bookColors.length)]);
      const b = box(bW, bH, 0.24, bMat, [shelfX0 + xOffset, y + (bH - 0.24) / 2, shelfZ0]);
      b.userData.layerId = 'book';
      _pickables.push(b);
      g.add(b);
      xOffset += bW + 0.004;
    }
  }

  // آباژور رومیزی
  const lampBaseMat = makeMaterial('metal', '#1a1a1a');
  const lBase = cyl(0.07, 0.07, 0.03, lampBaseMat, [0.7, 0.78, -0.55], 24);
  lBase.userData.layerId = 'lamp';
  _pickables.push(lBase);
  g.add(lBase);

  const lPole = cyl(0.010, 0.010, 0.30, lampBaseMat, [0.7, 0.94, -0.55], 12);
  lPole.userData.layerId = 'lamp';
  _pickables.push(lPole);
  g.add(lPole);

  const lShadeMat = makeMaterial('fabric', '#e8d8b8');
  lShadeMat.side = THREE.DoubleSide;
  const lShade = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.15, 24, 1, true), lShadeMat);
  lShade.position.set(0.7, 1.16, -0.55);
  lShade.userData.layerId = 'lamp';
  _pickables.push(lShade);
  g.add(lShade);

  const pl = new THREE.PointLight(0xffc88e, 0, 3, 1.8);
  pl.position.set(0.7, 1.16, -0.55);
  pl.userData.isLampLight = true;
  g.add(pl);

  addRug(g, palette, { w: 2.8, d: 1.9, pos: [0, 0, 0.2] });
  addWallArt(g, palette, { pos: [0, 2.1, -dims.d/2 + 0.06], w: 1.0, h: 0.7 });
  addPlant(g, palette, [-dims.w/2 + 0.5, 0, -dims.d/2 + 0.5], 1.1);

  return g;
}

function buildCafe(palette) {
  const dims = SCENES.cafe.dims;
  const g = buildShell(dims, palette, { winW: 3.2, winH: 1.8, winY0: 0.9, floorKind: 'tile' });

  const counterMat = makeMaterial('wood', palette.asg.counter ?? '#5a4230');
  const topMat = makeMaterial('marble', palette.asg.top ?? '#d8d0c0');
  const shelfMat = makeMaterial('woodDark', palette.asg.shelf ?? '#3a2a1e');

  const counterW = dims.w - 1.0;
  const counterZ = 0.3;

  // کانتر
  const counter = box(counterW, 1.05, 0.9, counterMat, [0, 0.525, counterZ]);
  counter.userData.layerId = 'counter';
  _pickables.push(counter);
  g.add(counter);

  // رویه سنگ
  const top = box(counterW + 0.1, 0.05, 0.95, topMat, [0, 1.075, counterZ]);
  top.userData.layerId = 'top';
  _pickables.push(top);
  g.add(top);

  // قفسه پشت
  const shelf1 = box(counterW - 0.3, 0.05, 0.32, shelfMat, [0, 2.2, -dims.d/2 + 0.25]);
  shelf1.userData.layerId = 'shelf';
  _pickables.push(shelf1);
  g.add(shelf1);

  const shelf2 = shelf1.clone();
  shelf2.position.y = 1.8;
  shelf2.userData.layerId = 'shelf';
  _pickables.push(shelf2);
  g.add(shelf2);

  // بطری‌ها
  const bottleColors = ['#3a8a6a', '#8a3a3a', '#3a5a8a', '#b89850'];
  for (let i = 0; i < 24; i++) {
    const x = -counterW/2 + 0.2 + i * (counterW - 0.4) / 23;
    const shelfY = i < 12 ? 2.23 : 1.83;
    const bMat = makeMaterial('glass', bottleColors[i % bottleColors.length], { opacity: 0.78 });
    const bH = 0.18 + Math.random() * 0.12;
    const b = cyl(0.035, 0.045, bH, bMat, [x, shelfY + bH/2, -dims.d/2 + 0.25], 16);
    b.userData.layerId = 'bottle';
    _pickables.push(b);
    g.add(b);
    // گردنِ بطری
    const neck = cyl(0.015, 0.020, 0.06, bMat, [x, shelfY + bH + 0.03, -dims.d/2 + 0.25], 12);
    neck.userData.layerId = 'bottle';
    _pickables.push(neck);
    g.add(neck);
  }

  // صندلی‌ها
  const stoolMat = makeMaterial('leather', palette.asg.stool ?? '#5a4030');
  const legMat = makeMaterial('metal', '#141414');
  const nStools = 4;
  for (let i = 0; i < nStools; i++) {
    const x = -counterW/2 + 0.4 + i * (counterW - 0.8) / (nStools - 1);
    const z = counterZ + 0.7;
    const seat = cyl(0.19, 0.19, 0.06, stoolMat, [x, 0.72, z], 32);
    seat.userData.layerId = 'stool';
    _pickables.push(seat);
    g.add(seat);
    const leg = cyl(0.022, 0.022, 0.72, legMat, [x, 0.36, z], 12);
    leg.userData.layerId = 'stool';
    _pickables.push(leg);
    g.add(leg);
  }

  // چراغ‌های آویز
  const pendantMat = makeMaterial('brass', '#a88850');
  const nPendants = 3;
  for (let i = 0; i < nPendants; i++) {
    const x = -counterW/2 + 0.6 + i * (counterW - 1.2) / (nPendants - 1);
    const wire = cyl(0.004, 0.004, 1.4, pendantMat, [x, dims.h - 0.7, counterZ + 0.3], 8);
    wire.userData.layerId = 'pendant';
    _pickables.push(wire);
    g.add(wire);

    const shadeMat = makeMaterial('metal', '#2a1e14');
    shadeMat.side = THREE.DoubleSide;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.22, 24, 1, true), shadeMat);
    cone.rotation.x = Math.PI;
    cone.position.set(x, dims.h - 1.4, counterZ + 0.3);
    cone.userData.layerId = 'pendant';
    _pickables.push(cone);
    g.add(cone);

    const pl = new THREE.PointLight(0xffc88e, 0, 4, 1.8);
    pl.position.set(x, dims.h - 1.5, counterZ + 0.3);
    pl.userData.isLampLight = true;
    g.add(pl);
  }

  return g;
}

/* ============================================================
   سه‌بعدی — متغیرهای سراسری
   ============================================================ */
let renderer, scene, camera, controls;
let sunLight, hemiLight, ambientLight, sunTarget;
let currentRoom = null;
let allLampLights = [];
let skyMesh = null;
let animationId = null;
let isDragging = false;
let downXY = null;
let raycaster, pointer;
let resizeObserver = null;

/* ============================================================
   نورپردازی
   ============================================================ */
function setupLighting() {
  hemiLight = new THREE.HemisphereLight(0xc8d4e8, 0x4a4438, 0.35);
  scene.add(hemiLight);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.10);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -10;
  sunLight.shadow.camera.right = 10;
  sunLight.shadow.camera.top = 10;
  sunLight.shadow.camera.bottom = -10;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 40;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.radius = 3;
  sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sunLight.target = sunTarget;
  scene.add(sunLight);
}

const KELVIN_MAP = { 2700: 0xffa860, 3000: 0xffc88e, 4000: 0xffe4c6, 6500: 0xe6eeff };

function updateSun() {
  const t = st.time;
  const weather = st.weather;
  const dir = st.windowDir;
  const sv = (t >= 20 || t < 5) ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
  const dayAmt = clamp(sv * 1.1, 0, 1);

  const elevation = clamp(sv * Math.PI * 0.72, 0.05, Math.PI / 2.2);
  let azimuthOffset = 0;
  if (dir === 'شرقی') azimuthOffset = Math.PI * 0.4;
  else if (dir === 'غربی') azimuthOffset = -Math.PI * 0.4;
  else if (dir === 'شمالی') azimuthOffset = Math.PI * 0.6;

  const r = 14;
  const az = Math.PI + azimuthOffset + (t - 13) * 0.05;
  const x = Math.sin(az) * Math.cos(elevation) * r;
  const y = Math.sin(elevation) * r + 0.5;
  const z = -Math.cos(az) * Math.cos(elevation) * r;

  sunLight.position.set(x, Math.max(y, 0.3), z);
  sunTarget.position.set(0, 1, 0);

  sunLight.intensity = dayAmt * (weather === 'ابری' ? 0.6 : 1.8) * (dir === 'شمالی' ? 0.55 : 1);

  // رنگ خورشید
  let sunHex = '#ffffff';
  if (t < 8)      sunHex = '#ffb878';
  else if (t < 10) sunHex = '#ffd0a0';
  else if (t < 16) sunHex = '#fff6e8';
  else if (t < 18) sunHex = '#ffc890';
  else if (t < 20) sunHex = '#ff9868';
  else             sunHex = '#5a6a98';
  sunLight.color.set(sunHex);

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
  hemiLight.intensity = 0.14 + dayAmt * 0.40;
  if (dayAmt < 0.1) {
    hemiLight.color.setHex(0x304060);
    hemiLight.groundColor.setHex(0x101018);
  } else {
    hemiLight.color.copy(skyTint);
    hemiLight.groundColor.setHex(0x4a4038);
  }
  ambientLight.intensity = 0.06 + dayAmt * 0.06;

  // چراغ‌ها
  const lampsShouldBeOn = st.lampOn === null ? (dayAmt < 0.25) : st.lampOn;
  allLampLights.forEach(pl => {
    pl.intensity = lampsShouldBeOn ? (pl.userData.baseIntensity || 1.6) : 0;
    pl.color.setHex(KELVIN_MAP[st.lampKelvin] || 0xffc88e);
  });
}

/* ============================================================
   دوربین — نماهای آماده
   ============================================================ */
function setView(name, animate = true) {
  st.view = name;
  const sceneDef = SCENES[st.sceneId];
  const { w, d, h } = sceneDef.dims;
  let pos, target;

  const basePos = sceneDef.cam.pos;
  const baseTarget = sceneDef.cam.target;

  switch (name) {
    case 'front':
      pos = [0, h * 0.55, d * 1.6];
      target = [0, h * 0.5, 0];
      break;
    case 'corner':
      pos = [-w * 0.9, h * 0.85, d * 1.15];
      target = [w * 0.1, h * 0.42, -d * 0.15];
      break;
    case 'top':
      pos = [0, Math.max(w, d) * 1.6, 0.01];
      target = [0, 0, 0];
      break;
    case 'eye':
      pos = [0, 1.65, d * 0.85];
      target = [0, 1.55, -d * 0.5];
      break;
    case 'three_quarter':
    default:
      pos = basePos;
      target = baseTarget;
  }

  if (!animate) {
    camera.position.set(...pos);
    controls.target.set(...target);
    controls.update();
    return;
  }

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(...pos);
  const endTarget = new THREE.Vector3(...target);
  const t0 = performance.now();
  const dur = 700;

  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update();
    if (p < 1) requestAnimationFrame(step);
  }
  step();
}

/* ============================================================
   ساخت/بازسازی اتاق
   ============================================================ */
function disposeRoom(room) {
  if (!room) return;
  room.traverse(obj => {
    if (obj.geometry) {
      try { obj.geometry.dispose(); } catch (e) {}
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => { try { m.dispose(); } catch (e) {} });
      } else {
        // متریال‌ها در کش هستند — dispose نکن
      }
    }
  });
}

function buildPaletteMap() {
  const map = { asg: {} };
  if (!st.palette) return map;
  for (const k in st.asg) {
    map.asg[k] = st.palette.colors[st.asg[k]] || '#888888';
  }
  return map;
}

function rebuildRoom() {
  if (!scene || !st.palette) return;
  if (currentRoom) {
    scene.remove(currentRoom);
    disposeRoom(currentRoom);
  }
  _pickables.length = 0;
  allLampLights = [];
  skyMesh = null;

  const sceneDef = SCENES[st.sceneId];
  const palette = buildPaletteMap();
  currentRoom = sceneDef.build(palette);
  scene.add(currentRoom);

  currentRoom.traverse(o => {
    if (o.userData.isLampLight) {
      o.userData.baseIntensity = 1.6;
      allLampLights.push(o);
    }
    if (o.userData.isSky) skyMesh = o;
  });

  updateSun();
}

/* ============================================================
   تخصیص پیش‌فرض رنگ‌ها بر اساس نقش
   ============================================================ */
const ROLE_WEIGHT = {
  // مقادیر 0-1 (1 = روشن‌ترین)
  wall: 0.92, floor: 0.25, accent: 0.70, sofa: 0.55, cushions: 0.72,
  table: 0.20, rug: 0.30, lamp: 0.80, plant_pot: 0.45, plant_leaf: 0.30,
  art: 0.85, frame: 0.20, curtain: 0.78, night: 0.22, headboard: 0.35,
  mattress: 0.88, pillow: 0.95, bedbody: 0.20, throw: 0.68,
  cabinet: 0.90, counter: 0.85, splash: 0.72, upper: 0.88, lower: 0.88,
  hardware: 0.35, stool: 0.30, vanity: 0.22, basin: 0.95,
  mirror: 0.90, mirror_frame: 0.35, towel: 0.82,
  desk: 0.20, monitor: 0.10, chair: 0.42, shelf: 0.22,
  book: 0.55, book1: 0.55, book2: 0.40, book3: 0.70,
  top: 0.88, bottle: 0.50, hood: 0.10, pendant: 0.30,
  ceiling: 1.00, console: 0.20,
};

function ensureAssignment() {
  if (!st.palette) return;
  const colors = st.palette.colors;
  const sorted = [...colors].sort((a, b) => relLum(b) - relLum(a));
  for (const k in ROLE_WEIGHT) {
    const w = ROLE_WEIGHT[k];
    const idx = clamp(Math.round((1 - w) * (sorted.length - 1)), 0, sorted.length - 1);
    const chosen = sorted[idx];
    st.asg[k] = colors.indexOf(chosen);
  }
  // مقادیر ثابت
  st.asg.floor = colors.indexOf(sorted[clamp(2, 0, sorted.length - 1)]);
  st.asg.rug = colors.indexOf(sorted[sorted.length - 2]);
  st.asg.accent = colors.indexOf(sorted[1] || sorted[0]);
}

/* ============================================================
   انتخاب سطح با Raycaster
   ============================================================ */
function setupRaycaster() {
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
}

function pickAt(clientX, clientY) {
  if (!renderer) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(_pickables, false);
  if (!hits.length) return;

  let obj = hits[0].object;
  let layerId = null;
  while (obj && !layerId) {
    if (obj.userData.layerId) layerId = obj.userData.layerId;
    obj = obj.parent;
  }
  if (layerId) setSelected(layerId);
}

let _highlighted = [];
function setSelected(layerId) {
  // پاک کردن هایلایت قبلی
  _highlighted.forEach(o => {
    if (o.material && o.material.emissive) {
      o.material.emissive.setHex(o.userData._emissive || 0x000000);
      o.material.emissiveIntensity = o.userData._emissiveIntensity ?? 0;
    }
  });
  _highlighted = [];

  st.selected = layerId;

  if (layerId && currentRoom) {
    currentRoom.traverse(o => {
      if (o.userData.layerId === layerId && o.material && o.material.emissive) {
        o.userData._emissive = o.material.emissive.getHex();
        o.userData._emissiveIntensity = o.material.emissiveIntensity;
        // کلونِ متریال برای اینکه بقیه‌ی اشیای هم‌متریال هم هایلایت نشوند
        if (!o.userData._highlightMat) {
          o.material = o.material.clone();
          o.userData._highlightMat = true;
        }
        o.material.emissive.setHex(0x6fe3c4);
        o.material.emissiveIntensity = 0.35;
        _highlighted.push(o);
      }
    });
  }

  haptic.select();
  renderColorPane();
  renderChips();
}

/* ============================================================
   اعمال رنگ روی لایه‌ی انتخاب‌شده
   ============================================================ */
function applyColorToSelected(colorIndex) {
  if (!st.selected || !st.palette) return;
  st.asg[st.selected] = colorIndex;
  const hex = st.palette.colors[colorIndex];

  if (currentRoom) {
    currentRoom.traverse(o => {
      if (o.userData.layerId === st.selected && o.material) {
        const oldKind = o.material.userData.kind || 'fabric';
        const newMat = makeMaterial(oldKind, hex);
        // اگر کلون شده بود (هایلایت)، از نسخه‌ی اصلی استفاده کن
        o.material = newMat.clone();
        o.material.userData.kind = oldKind;
        o.userData._highlightMat = false;
        // نگه‌داشتن هایلایت
        if (st.selected === o.userData.layerId) {
          o.material.emissive.setHex(0x6fe3c4);
          o.material.emissiveIntensity = 0.35;
          _highlighted.push(o);
        }
      }
    });
  }

  haptic.medium();
  renderColorPane();
  renderChips();
}

/* ============================================================
   UI Shell — ساختار قبلی حفظ می‌شود
   ============================================================ */
let root, stageEl, toastTimer;

const CB_DEFS = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <filter id="stu-f-pro" color-interpolation-filters="sRGB"><feColorMatrix values=".567 .433 0 0 0  .558 .442 0 0 0  0 .242 .758 0 0  0 0 0 1 0"/></filter>
    <filter id="stu-f-deu" color-interpolation-filters="sRGB"><feColorMatrix values=".625 .375 0 0 0  .7 .3 0 0 0  0 .3 .7 0 0  0 0 0 1 0"/></filter>
    <filter id="stu-f-tri" color-interpolation-filters="sRGB"><feColorMatrix values=".95 .05 0 0 0  0 .433 .567 0 0  0 .475 .525 0 0  0 0 0 1 0"/></filter>
  </defs></svg>`;

const IC = {
  undo: '<path d="M9 14 4 9l5-5M4 9h10a7 7 0 0 1 0 14h-3"/>',
  redo: '<path d="m15 14 5-5-5-5M20 9H10a7 7 0 0 0 0 14h3"/>',
  save: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  split: '<path d="M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
};
const svgI = (p, sw = 1.9) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

function buildShell() {
  const el = document.createElement('div');
  el.className = 'stu-v3';
  el.hidden = true;
  el.innerHTML = `
    <div class="stu-panel" role="dialog" aria-modal="true" aria-label="استودیو چیدمان">
      <header class="stu-head">
        <div class="stu-title">
          <div class="stu-dot" aria-hidden="true"></div>
          <div><h3 id="stuName">—</h3><span id="stuMeta">—</span></div>
        </div>
        <div class="stu-head-actions">
          <button type="button" class="stu-icon" data-a="undo" aria-label="بازگردانی" title="بازگردانی">${svgI(IC.undo)}</button>
          <button type="button" class="stu-icon" data-a="redo" aria-label="ازنو" title="ازنو">${svgI(IC.redo)}</button>
          <button type="button" class="stu-icon" data-a="export" aria-label="خروجی" title="خروجی">${svgI(IC.save)}</button>
          <button type="button" class="stu-icon stu-icon-close" data-a="close" aria-label="بستن">${svgI(IC.close, 2)}</button>
        </div>
      </header>

      <div class="stu-body">
        <section class="stu-main">
          <div class="stu-scenes" id="stuScenes" role="tablist" aria-label="نوع فضا"></div>
          <div class="stu-sticky">
            <div class="stu-stage-box">
              <div class="stu-stage" id="stuStage" aria-live="polite"></div>
              <div class="stu-hint"><span id="stuHover">برای چرخش بکش · برای انتخاب کلیک کن</span><span id="stuClock"></span></div>
            </div>
            <div class="stu-viewbar" id="stuViews"></div>
            <div class="stu-chips" id="stuChips" role="group" aria-label="بخش‌های قابل‌رنگ"></div>
          </div>
        </section>

        <aside class="stu-side">
          <div class="stu-tabs" id="stuTabs" role="tablist" aria-label="ابزارها">
            <button type="button" role="tab" data-tab="color">رنگ</button>
            <button type="button" role="tab" data-tab="light">نور</button>
            <button type="button" role="tab" data-tab="an">تحلیل</button>
            <button type="button" role="tab" data-tab="exp">خروجی</button>
          </div>

          <div class="stu-pane" data-pane="color" role="tabpanel">
            <div class="stu-sel" id="stuSel"></div>
            <div class="stu-block">
              <div class="stu-side-head"><span>پالت</span><span class="stu-hint-sm" id="stuSelHint"></span></div>
              <div class="stu-palette" id="stuPalette"></div>
            </div>
            <div class="stu-actions">
              <button type="button" class="stu-btn stu-btn-primary" data-a="shuffle">${svgI(IC.shuffle)}<span>بُر هوشمند</span></button>
              <button type="button" class="stu-btn" data-a="reset" aria-label="بازنشانی چیدمان">${svgI(IC.reset)}</button>
            </div>
            <p class="stu-why" id="stuWhy"></p>
          </div>

          <div class="stu-pane" data-pane="light" role="tabpanel">
            <div class="stu-lights" id="stuLights" role="group" aria-label="حالت نور"></div>
            <div class="stu-block">
              <div class="stu-side-head"><span>ساعت روز</span><span class="stu-hint-sm" id="stuTimeLbl"></span></div>
              <input type="range" class="stu-range" id="stuTime" min="6" max="21" step="0.25" aria-label="ساعت روز">
            </div>
            <div class="stu-block"><div class="stu-side-head"><span>جهت پنجره</span></div><div class="stu-pills" id="stuDir"></div></div>
            <div class="stu-block"><div class="stu-side-head"><span>هوا</span></div><div class="stu-pills" id="stuWx"></div></div>
            <div class="stu-block">
              <div class="stu-side-head"><span>چراغ</span><span class="stu-hint-sm">دمای رنگ</span></div>
              <div class="stu-pills" id="stuKel"></div>
              <button type="button" class="stu-btn" data-a="lamp" id="stuLampBtn" aria-pressed="false"><span>لوستر</span></button>
            </div>
            <p class="stu-why" id="stuLightWhy"></p>
          </div>

          <div class="stu-pane" data-pane="an" role="tabpanel">
            <div class="stu-analysis" id="stuAnalysis"></div>
          </div>

          <div class="stu-pane" data-pane="exp" role="tabpanel">
            <div class="stu-block">
              <div class="stu-side-head"><span>خروجی تصویر</span></div>
              <div class="stu-pills" id="stuSize"></div>
            </div>
            <div class="stu-actions">
              <button type="button" class="stu-btn stu-btn-primary" data-a="export"><span>ذخیره تصویر</span></button>
              <button type="button" class="stu-btn" data-a="copyall"><span>کپی همه کدها</span></button>
            </div>
            <p class="stu-why">برای ذخیره تصویر، از صحنه‌ی سه‌بعدی فعلی یک عکس با کیفیت بالا گرفته می‌شود.</p>
          </div>
        </aside>
      </div>

      <div class="stu-toast" id="stuToast" role="status" aria-live="polite"></div>
      ${CB_DEFS}
    </div>`;
  document.body.appendChild(el);
  return el;
}

/* ============================================================
   CSS استودیو
   ============================================================ */
function injectCSS() {
  if (document.getElementById('stu-v3-css')) return;
  const s = document.createElement('style');
  s.id = 'stu-v3-css';
  s.textContent = `
  .stu-v3{--stu-warn:#F2C14E;position:fixed;inset:0;z-index:90;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);display:flex;align-items:stretch;justify-content:center;padding:max(env(safe-area-inset-top,0px),8px) 8px max(env(safe-area-inset-bottom,0px),8px);animation:stuIn .3s var(--ease)}
  @media(prefers-color-scheme:light){:root:not([data-theme="dark"]) .stu-v3{--stu-warn:#9A6B00}}
  :root[data-theme="light"] .stu-v3{--stu-warn:#9A6B00}
  .stu-v3[hidden],.stu-v3 [hidden]{display:none!important}
  @keyframes stuIn{from{opacity:0;transform:translateY(10px)}}
  .stu-v3 *{box-sizing:border-box}
  .stu-v3 button:focus-visible,.stu-v3 input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .stu-panel{position:relative;width:min(1400px,100%);min-height:0;background:var(--bg-elev);color:var(--ink);border-radius:20px;box-shadow:var(--shadow-lg),inset 0 0 0 1px var(--line);display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
  .stu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line-soft);flex:none}
  .stu-title{display:flex;align-items:center;gap:12px;min-width:0}
  .stu-title h3{margin:0;font-size:16px;font-weight:800;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stu-title span{display:block;font-size:11.5px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .stu-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent);flex:none}
  .stu-head-actions{display:flex;gap:6px;flex:none}
  .stu-icon{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);display:inline-grid;place-items:center;cursor:pointer;transition:transform .16s var(--ease),color .16s,border-color .16s}
  .stu-icon:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
  .stu-icon:active{transform:scale(.92)}
  .stu-icon:disabled{opacity:.35;cursor:default;transform:none}
  .stu-icon svg{width:17px;height:17px}
  .stu-icon-close:hover{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,var(--line))}
  .stu-body{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(340px,1fr);flex:1;min-height:0}
  .stu-main{padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto}
  .stu-side{border-inline-start:1px solid var(--line-soft);display:flex;flex-direction:column;min-height:0;overflow-y:auto;background:color-mix(in srgb,var(--bg-sunk) 45%,transparent)}
  @media(max-width:899px){
    .stu-body{display:block;overflow-y:auto;overscroll-behavior:contain}
    .stu-main{overflow:visible;padding:10px 10px 0}
    .stu-side{border-inline-start:0;border-top:1px solid var(--line-soft);overflow:visible;margin-top:10px}
    .stu-sticky{position:sticky;top:0;z-index:5;background:var(--bg-elev);padding-bottom:6px}
  }
  .stu-scenes{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .stu-scenes::-webkit-scrollbar,.stu-chips::-webkit-scrollbar,.stu-tabs::-webkit-scrollbar{display:none}
  .stu-scene{flex:none;padding:8px 14px;border-radius:11px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font:600 12.5px inherit;font-family:inherit;cursor:pointer;transition:all .16s var(--ease)}
  .stu-scene:hover{color:var(--ink)}
  .stu-scene.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
  .stu-stage-box{position:relative;border-radius:16px;overflow:hidden;background:#0a0a0a;box-shadow:inset 0 0 0 1px var(--line-soft),0 18px 40px -22px rgba(0,0,0,.6)}
  .stu-stage{position:relative;aspect-ratio:16/10;direction:ltr;user-select:none;-webkit-user-select:none;cursor:grab;touch-action:none}
  .stu-stage:active{cursor:grabbing}
  .stu-stage canvas{display:block;width:100%;height:100%}
  .stu-hint{position:absolute;bottom:8px;inset-inline:8px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
  .stu-hint span{background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:3px 10px;border-radius:99px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  .stu-viewbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .stu-view{flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font:600 12px inherit;font-family:inherit;cursor:pointer;transition:all .16s;white-space:nowrap}
  .stu-view:hover{color:var(--ink)}
  .stu-view.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
  .stu-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:10px 2px 2px}
  .stu-chip{flex:none;display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:99px;border:1px solid var(--line);background:var(--bg-elev);color:var(--ink);font-family:inherit;font-size:12px;cursor:pointer;text-align:start;transition:border-color .16s,background .16s}
  .stu-chip i{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35);flex:none}
  .stu-chip b{font-weight:600;display:block;line-height:1.35}
  .stu-chip em{font-style:normal;font-size:10px;color:var(--ink-dim);display:block;line-height:1.3}
  .stu-chip[aria-pressed=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--bg-elev))}
  .stu-tabs{display:flex;border-bottom:1px solid var(--line-soft);overflow-x:auto;scrollbar-width:none;position:sticky;top:0;background:var(--bg-elev);z-index:2;flex:none}
  .stu-tabs button{flex:1;padding:12px 10px;background:none;border:0;color:var(--ink-dim);font-family:inherit;font-size:13px;white-space:nowrap;cursor:pointer;position:relative}
  .stu-tabs button[aria-selected=true]{color:var(--ink);font-weight:700}
  .stu-tabs button[aria-selected=true]:after{content:"";position:absolute;inset-inline:22%;bottom:-1px;height:2px;background:var(--accent);border-radius:2px}
  .stu-pane{display:none;padding:14px;gap:14px;flex-direction:column}
  .stu-pane.on{display:flex}
  .stu-block{display:flex;flex-direction:column;gap:8px}
  .stu-side-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:700;color:var(--ink)}
  .stu-hint-sm{font-size:11px;font-weight:500;color:var(--ink-dim)}
  .stu-sel{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--bg-sunk)}
  .stu-sel .big{width:56px;height:56px;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35)}
  .stu-sel b{font-size:14px}
  .stu-sel p{margin:0;font-size:11px;color:var(--ink-dim);font-variant-numeric:tabular-nums;line-height:1.7}
  .stu-sel .ltr{direction:ltr;text-align:right;unicode-bidi:isolate}
  .stu-palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:8px}
  .stu-sw{position:relative;aspect-ratio:1;border-radius:12px;border:2px solid var(--line-soft);background:var(--c);cursor:pointer;overflow:hidden;transition:transform .2s var(--ease)}
  .stu-sw:hover{transform:translateY(-2px)}
  .stu-sw:active{transform:scale(.94)}
  .stu-sw.on{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent)}
  .stu-sw span{position:absolute;inset:auto 0 3px 0;text-align:center;font-size:9px;font-weight:800;color:#fff;mix-blend-mode:difference}
  .stu-actions{display:flex;gap:6px;flex-wrap:wrap}
  .stu-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .16s var(--ease)}
  .stu-btn:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
  .stu-btn:active{transform:scale(.96)}
  .stu-btn[aria-pressed=true]{color:var(--accent-text);border-color:var(--accent)}
  .stu-btn svg{width:14px;height:14px}
  .stu-btn-primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700}
  .stu-btn-primary:hover{color:var(--accent-ink);filter:brightness(1.05)}
  .stu-why{margin:0;font-size:12px;line-height:1.85;color:var(--ink-dim);border-inline-start:2px solid var(--accent);padding-inline-start:10px}
  .stu-why:empty{display:none}
  .stu-why b{color:var(--ink);font-weight:600}
  .stu-pills{display:flex;gap:6px;flex-wrap:wrap}
  .stu-pill{padding:5px 12px;border-radius:99px;border:1px solid var(--line);background:transparent;color:var(--ink);font-family:inherit;font-size:12px;cursor:pointer}
  .stu-pill[aria-pressed=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
  .stu-range{width:100%;accent-color:var(--accent);height:28px;margin:0}
  .stu-lights{display:flex;gap:4px;background:var(--glass);border:1px solid var(--line-soft);border-radius:12px;padding:4px}
  .stu-light{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 8px;border-radius:8px;border:0;background:transparent;color:var(--ink-dim);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
  .stu-light.on{background:var(--bg-elev);color:var(--ink);box-shadow:var(--shadow-sm)}
  .stu-light svg{width:14px;height:14px}
  .stu-analysis{display:flex;flex-direction:column;gap:14px}
  .stu-score{display:flex;gap:14px;align-items:center;padding:12px;border-radius:16px;background:var(--bg-sunk);border:1px solid var(--line)}
  .stu-ring{width:64px;height:64px;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--s)*1%),var(--line) 0);display:grid;place-items:center;flex:none}
  .stu-ring b{width:50px;height:50px;border-radius:50%;background:var(--bg-sunk);display:grid;place-items:center;font-size:16px}
  .stu-score p{margin:0;font-size:12px;color:var(--ink-dim)}
  .stu-bar3{display:grid;gap:4px;font-size:11.5px;color:var(--ink-dim)}
  .stu-bar3>div{display:flex;height:16px;border-radius:8px;overflow:hidden;direction:ltr;background:var(--bg-sunk);box-shadow:inset 0 0 0 1px var(--line-soft)}
  .stu-bar3>div s{display:block;transition:width .4s var(--ease)}
  .stu-bar3>span{display:flex;justify-content:space-between;gap:8px}
  .stu-bar3 b{font-weight:600;color:var(--ink)}
  .stu-alert{display:flex;gap:8px;padding:9px 12px;border-radius:12px;font-size:12px;line-height:1.7;background:color-mix(in srgb,var(--stu-warn) 14%,transparent);border:1px solid color-mix(in srgb,var(--stu-warn) 40%,transparent)}
  .stu-alert.info{background:color-mix(in srgb,var(--accent) 10%,transparent);border-color:color-mix(in srgb,var(--accent) 25%,transparent)}
  .stu-alert svg{width:14px;height:14px;flex:none;margin-top:3px}
  .stu-scroll{overflow-x:auto}
  .stu-tbl{width:100%;border-collapse:collapse;font-size:12px}
  .stu-tbl th{font-weight:500;color:var(--ink-dim);text-align:right;padding:4px 6px;font-size:11px;white-space:nowrap}
  .stu-tbl td{padding:7px 6px;border-top:1px solid var(--line-soft);vertical-align:middle;white-space:nowrap}
  .stu-tbl .d{display:inline-block;width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.4);vertical-align:-3px;margin-inline-end:6px}
  .stu-tbl .n{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate;display:inline-block}
  .stu-tag{padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700}
  .stu-tag.ok{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--accent-text)}
  .stu-tag.mid{background:color-mix(in srgb,var(--stu-warn) 22%,transparent);color:var(--stu-warn)}
  .stu-tag.no{background:color-mix(in srgb,var(--danger) 22%,transparent);color:var(--danger)}
  .stu-toast{position:absolute;inset-inline:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:340px;margin:auto;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:14px;font-size:13px;text-align:center;opacity:0;transform:translateY(12px);transition:opacity .26s var(--ease),transform .26s var(--ease);pointer-events:none;z-index:9}
  .stu-toast.on{opacity:1;transform:none}
  @media(max-width:520px){.stu-head{padding:10px 12px}.stu-pane{padding:12px}}
  @media(prefers-reduced-motion:reduce){.stu-v3,.stu-v3 *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(s);
}

/* ============================================================
   آیکون‌ها
   ============================================================ */
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  sunrise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M5.6 8.6 8 11M2 15h4M18 15h4M16 11l2.4-2.4M3 20h18M6 15a6 6 0 0 1 12 0"/></svg>',
  sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9V3M5.6 12.6 3.2 15M2 20h4M18 20h4M16 12.6l2.4 2.4M3 20h18M6 20a6 6 0 0 1 12 0"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
};
const LIGHTS_META = {
  dawn:  { name: 'صبح', icon: 'sunrise' },
  day:   { name: 'روز',  icon: 'sun' },
  dusk:  { name: 'عصر',  icon: 'sunset' },
  night: { name: 'شب',   icon: 'moon' },
};
const PRESET_T = { dawn: 7.5, day: 13, dusk: 18, night: 21 };
const nearestPreset = (t) => t < 10 ? 'dawn' : t < 16 ? 'day' : t < 19.5 ? 'dusk' : 'night';
const svOf = (t) => (t >= 20 || t < 5) ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
const lampIsOn = () => st.lampOn === null ? svOf(st.time) < 0.2 : !!st.lampOn;

/* ============================================================
   رندر UI
   ============================================================ */
const ROLE_FA = {
  wall: 'دیوار', floor: 'کف', accent: 'دیوارِ تأکیدی', sofa: 'مبل', cushions: 'کوسن',
  table: 'میز', rug: 'فرش', lamp: 'آباژور', plant_pot: 'گلدان', plant_leaf: 'برگ',
  art: 'تابلو', frame: 'قاب', curtain: 'پرده', night: 'پاتختی', headboard: 'تاجِ تخت',
  mattress: 'تشک', pillow: 'بالش', bedbody: 'بدنه‌ی تخت', throw: 'پتو',
  cabinet: 'کابینت', counter: 'کانتر', splash: 'میان‌کابینتی', upper: 'کابینتِ بالا',
  lower: 'کابینتِ پایین', hardware: 'دستگیره', stool: 'صندلی', vanity: 'روشویی',
  basin: 'سینک', mirror: 'آینه', mirror_frame: 'قابِ آینه', towel: 'حوله',
  desk: 'میز', monitor: 'مانیتور', chair: 'صندلی', shelf: 'کتابخانه',
  book: 'کتاب', book1: 'کتابِ ۱', book2: 'کتابِ ۲', book3: 'کتابِ ۳',
  top: 'رویه', bottle: 'بطری', hood: 'هود', pendant: 'چراغِ آویز',
  ceiling: 'سقف', console: 'کنسول', window: 'شیشه', pot: 'گلدان', leaf: 'برگ',
};
const MAT_FA = {
  wall: 'رنگ مات', wallGloss: 'رنگ نیمه‌براق', stucco: 'استوکو', concrete: 'بتن', wood: 'چوب',
  woodDark: 'چوب تیره', marble: 'مرمر', tile: 'سرامیک', fabric: 'پارچه', velvet: 'مخمل',
  leather: 'چرم', metal: 'فلز', brass: 'برنج', plant: 'گیاه', art: 'تابلو', rug: 'فرش', glass: 'شیشه',
  paper: 'کاغذ', terracotta: 'سفال', ceramic: 'سرامیک', screen: 'نمایشگر',
};

const pill = (attr, val, label, on) => `<button type="button" class="stu-pill" data-${attr}="${val}" aria-pressed="${on}">${label}</button>`;

function renderHeader() {
  $('#stuName', root).textContent = st.palette.name;
  $('#stuMeta', root).textContent = SCENES[st.sceneId].name + ' — ' + SCENES[st.sceneId].subtitle;
}

function renderScenes() {
  $('#stuScenes', root).innerHTML = Object.entries(SCENES).map(([id, s]) =>
    `<button type="button" class="stu-scene ${id === st.sceneId ? 'on' : ''}" data-scene="${id}" role="tab" aria-selected="${id === st.sceneId}">${s.name}</button>`
  ).join('');
}

function renderViews() {
  const labels = { three_quarter: 'سه‌چهارم', front: 'روبرو', corner: 'گوشه', top: 'بالا', eye: 'ایستاده' };
  $('#stuViews', root).innerHTML = Object.keys(labels).map(id =>
    `<button type="button" class="stu-view ${id === st.view ? 'on' : ''}" data-view="${id}">${labels[id]}</button>`
  ).join('');
}

function renderChips() {
  const ids = [...new Set(_pickables.map(p => p.userData.layerId).filter(Boolean))];
  const order = ['wall', 'accent', 'floor', 'ceiling', 'rug', 'sofa', 'cushions', 'table', 'bedbody',
    'headboard', 'mattress', 'pillow', 'throw', 'night', 'lamp', 'curtain', 'art', 'frame',
    'cabinet', 'upper', 'lower', 'counter', 'splash', 'hardware', 'hood', 'stool',
    'vanity', 'basin', 'mirror', 'mirror_frame', 'towel', 'desk', 'monitor', 'chair', 'shelf',
    'book', 'book1', 'book2', 'book3', 'top', 'bottle', 'pendant', 'plant_pot', 'plant_leaf', 'console'];
  const sorted = ids.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  $('#stuChips', root).innerHTML = sorted.map(id => {
    const hex = st.palette.colors[st.asg[id]] || '#888888';
    return `<button type="button" class="stu-chip" data-chip="${id}" aria-pressed="${st.selected === id}">
      <i style="background:${hex}"></i><span><b>${ROLE_FA[id] || id}</b></span></button>`;
  }).join('');
}

function renderColorPane() {
  const sel = $('#stuSel', root);
  if (!st.selected) {
    sel.innerHTML = `<div class="big" style="background:var(--glass)"></div><div><b>سطحی انتخاب نشده</b><p>روی هر بخشِ صحنه کلیک کن.</p></div><span></span>`;
  } else {
    const hex = st.palette.colors[st.asg[st.selected]] || '#888888';
    const rg = hexToRgb(hex), cm = toCMYK(hex), lb = toLAB(hex);
    sel.innerHTML = `<div class="big" style="background:${hex}"></div>
      <div><b>${ROLE_FA[st.selected] || st.selected}</b>
      <p class="ltr">${hex.toUpperCase()} · RGB ${rg.join(',')}<br>CMYK ${cm.join('/')} · LAB ${lb.join(',')}</p>
      <p>LRV ${toPN(lrv(hex))}</p></div>
      <button type="button" class="stu-icon" data-a="copy" aria-label="کپی کد رنگ">${svgI(IC.copy)}</button>`;
  }
  $('#stuPalette', root).innerHTML = st.palette.colors.map((hex, i) => {
    const on = st.selected && st.asg[st.selected] === i;
    return `<button type="button" class="stu-sw ${on ? 'on' : ''}" data-pick="${i}" style="--c:${hex}" aria-label="رنگ ${hex}" aria-pressed="${on}">
      <span>${hex.replace('#','').toUpperCase()}</span></button>`;
  }).join('');
  $('#stuSelHint', root).textContent = st.selected ? 'روی رنگ بزن تا اعمال شود' : '';
  $('#stuWhy', root).innerHTML = st.why || whyDefault();
  $('[data-a=undo]', root).disabled = true;
  $('[data-a=redo]', root).disabled = true;
}

function whyDefault() {
  if (!st.palette) return '';
  const colors = [...new Set(Object.values(st.asg).map(i => st.palette.colors[i]))];
  if (colors.length < 2) return '';
  const c1 = colors[0], c2 = colors[1];
  const r = contrast(c1, c2);
  const txt = r >= 3 ? 'سطوح از هم واضح جدا می‌شوند.' : r >= 1.5 ? 'جداسازی ملایم و آرام است.' : 'سطوح در هم محو می‌شوند.';
  return `<b>چرا این چیدمان؟</b> کنتراست بین رنگ‌های اصلی ${fmt(r, 1)}:۱ است؛ ${txt}`;
}

function renderLightPane() {
  $('#stuLights', root).innerHTML = Object.entries(LIGHTS_META).map(([id, l]) =>
    `<button type="button" class="stu-light ${id === st.light ? 'on' : ''}" data-light="${id}" aria-pressed="${id === st.light}">${ICONS[l.icon]}<span>${l.name}</span></button>`
  ).join('');
  $('#stuTime', root).value = st.time;
  updateTimeLbl();
  $('#stuDir', root).innerHTML = ['شمالی', 'جنوبی', 'شرقی', 'غربی'].map(v => pill('dir', v, v, st.dir === v)).join('');
  $('#stuWx', root).innerHTML = ['آفتابی', 'ابری'].map(v => pill('wx', v, v, st.wx === v)).join('');
  $('#stuKel', root).innerHTML = [2700, 3000, 4000, 6500].map(v => pill('kel', v, toPN(v) + 'K', st.lampKelvin === v)).join('');
  const on = lampIsOn(), b = $('#stuLampBtn', root);
  b.setAttribute('aria-pressed', on);
  b.firstElementChild.textContent = on ? 'لوستر روشن' : 'لوستر خاموش';
  $('#stuLightWhy', root).textContent = st.dir === 'شمالی'
    ? 'نور شمالی سرد و یکنواخت است؛ رنگ‌ها آبی‌تر دیده می‌شوند.'
    : st.dir === 'جنوبی'
      ? 'نور جنوبی گرم و پرشدت است؛ رنگ‌های سرد در آن زنده‌تر می‌مانند.'
      : st.dir === 'شرقی'
        ? 'نور شرقی صبح گرم و عصر ملایم است.'
        : 'نور غربی عصر طلایی و گرم است.';
}

function updateTimeLbl() {
  const t = st.time;
  const h = Math.floor(t), m = Math.round((t - h) * 60);
  const label = t < 9 ? 'صبح زود' : t < 12 ? 'صبح' : t < 15 ? 'ظهر' : t < 18 ? 'عصر' : t < 20 ? 'غروب' : 'شب';
  $('#stuTimeLbl', root).textContent = `${label} · ${toPN(h)}:${toPN(String(m).padStart(2, '0'))}`;
  $('#stuClock', root).textContent = `${toPN(h)}:${toPN(String(m).padStart(2, '0'))}`;
}

function renderAnalysis() {
  const wrap = $('#stuAnalysis', root);
  if (!st.palette) { wrap.innerHTML = ''; return; }
  // محاسبه‌ی ساده‌ی هماهنگی رنگ‌های استفاده‌شده
  const used = [...new Set(Object.values(st.asg).map(i => st.palette.colors[i]))];
  const hues = used.map(c => toHSV(c).h);
  let harmonyType = 'تک‌رنگ', harmonyScore = 90;
  if (hues.length >= 2) {
    const diffs = [];
    for (let i = 0; i < hues.length; i++)
      for (let j = i + 1; j < hues.length; j++) {
        let d = Math.abs(hues[i] - hues[j]);
        if (d > 180) d = 360 - d;
        diffs.push(d);
      }
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    if (avg < 20)      { harmonyType = 'تک‌رنگ';   harmonyScore = 92; }
    else if (avg < 50) { harmonyType = 'آنالوگ';    harmonyScore = 88; }
    else if (avg < 100){ harmonyType = 'مکمل نزدیک'; harmonyScore = 80; }
    else if (avg < 150){ harmonyType = 'سه‌گانه';   harmonyScore = 82; }
    else               { harmonyType = 'مکمل';      harmonyScore = 76; }
  }
  const lrvs = used.map(lrv);
  const lrvRange = Math.max(...lrvs) - Math.min(...lrvs);
  const balance = clamp(100 - Math.abs(lrvRange - 55) * 0.7, 30, 98);
  const score = Math.round((harmonyScore + balance) / 2);

  let html = `
    <div class="stu-score">
      <div class="stu-ring" style="--s:${score}"><b>${toPN(score)}</b></div>
      <div><b>${harmonyType}</b><p>هماهنگی ${toPN(harmonyScore)}٪ · تعادل ${toPN(Math.round(balance))}٪</p></div>
    </div>
    <div class="stu-bar3">
      <span><b>محدوده‌ی روشنایی (LRV)</b><span>${toPN(Math.min(...lrvs))} تا ${toPN(Math.max(...lrvs))}</span></span>
      <div><s style="width:${lrvRange}%;background:linear-gradient(90deg,#000,#fff)"></s></div>
    </div>`;

  // هشدارها
  const wallLrv = lrv(st.palette.colors[st.asg.wall] || '#888');
  const warns = [];
  if (wallLrv < 25) warns.push({ level: 'warn', text: 'LRV دیوارِ اصلی کمتر از ۲۵٪ است — فضا تیره به‌نظر می‌آید.' });
  if (wallLrv > 88) warns.push({ level: 'warn', text: 'LRV دیوارِ اصلی بالای ۸۸٪ است — در نورِ شدید شسته می‌شود.' });
  if (!warns.length) warns.push({ level: 'info', text: 'هشداری برای این چیدمان وجود ندارد.' });
  html += warns.map(w => `<div class="stu-alert ${w.level === 'warn' ? '' : 'info'}">${ICONS[w.level === 'warn' ? 'alert' : 'info']}<span>${w.text}</span></div>`).join('');

  // جدول رنگ‌ها
  html += `<div class="stu-block"><div class="stu-side-head"><span>رنگ‌های استفاده‌شده</span></div><div class="stu-scroll"><table class="stu-tbl">
    <tr><th>رنگ</th><th>LRV</th><th>نقش</th></tr>
    ${used.slice(0, 10).map(hex => {
      const roles = Object.entries(st.asg).filter(([_, i]) => st.palette.colors[i] === hex).map(([k]) => ROLE_FA[k] || k);
      return `<tr><td><span class="d" style="background:${hex}"></span><span class="n">${hex.toUpperCase()}</span></td>
        <td>${toPN(lrv(hex))}</td>
        <td>${roles.slice(0, 3).join('، ')}${roles.length > 3 ? '…' : ''}</td></tr>`;
    }).join('')}
  </table></div></div>`;

  wrap.innerHTML = html;
}

function renderExportPane() {
  $('#stuSize', root).innerHTML = [[1600, 'HD'], [2400, '2K'], [3600, '4K']].map(([v, n]) => pill('size', v, n, st.size === v)).join('');
  if (!st.size) st.size = 2400;
}

function renderTabs() {
  $$('#stuTabs button', root).forEach(b => {
    const on = b.dataset.tab === st.tab;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  });
  $$('.stu-pane', root).forEach(p => p.classList.toggle('on', p.dataset.pane === st.tab));
}
function setTab(t) { st.tab = t; renderTabs(); }

function renderAll() {
  if (!st.palette) return;
  renderHeader();
  renderScenes();
  renderViews();
  renderChips();
  renderColorPane();
  renderLightPane();
  renderAnalysis();
  renderExportPane();
  renderTabs();
}

/* ============================================================
   بُر هوشمند
   ============================================================ */
function smartShuffle() {
  if (!st.palette) return;
  const colors = st.palette.colors;
  const strategies = ['mono', 'analogous', 'complementary', 'triadic'];
  const strat = strategies[Math.floor(Math.random() * strategies.length)];
  const pivot = Math.floor(Math.random() * colors.length);
  const pH = toHSV(colors[pivot]).h;
  const idxs = [pivot];
  function nearest(hue) {
    let best = 0, bestD = 999;
    for (let i = 0; i < colors.length; i++) {
      if (idxs.includes(i)) continue;
      const h = toHSV(colors[i]).h;
      let d = Math.abs(h - hue);
      if (d > 180) d = 360 - d;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  if (strat === 'mono')              idxs.push(nearest(pH), nearest((pH + 15) % 360));
  else if (strat === 'analogous')    idxs.push(nearest((pH + 30) % 360), nearest((pH + 330) % 360));
  else if (strat === 'complementary') idxs.push(nearest((pH + 180) % 360), nearest(pH));
  else                                idxs.push(nearest((pH + 120) % 360), nearest((pH + 240) % 360));
  while (idxs.length < colors.length) idxs.push(nearest(pH));

  const pIdx = popIndex(colors);
  const newAsg = {};
  const roles = Object.keys(st.asg);
  roles.forEach((k, i) => {
    let pool;
    if (k === 'wall' || k === 'ceiling') pool = [idxs[3] ?? idxs[0], idxs[4] ?? idxs[0]];
    else if (k === 'floor') pool = [idxs[1] ?? idxs[0]];
    else if (k === 'accent' || k === 'art') pool = [pIdx];
    else pool = [idxs[i % idxs.length]];
    newAsg[k] = pool[Math.floor(Math.random() * pool.length)];
  });
  st.asg = newAsg;
  applyAllColors();
  haptic.success();
  const label = strat === 'mono' ? 'تک‌رنگ' : strat === 'analogous' ? 'آنالوگ' : strat === 'complementary' ? 'مکمل' : 'سه‌گانه';
  showToast(`بُر هوشمند — ${label}`);
}

function applyAllColors() {
  if (!currentRoom) return;
  currentRoom.traverse(o => {
    if (o.userData.layerId && o.material) {
      const idx = st.asg[o.userData.layerId];
      if (idx === undefined) return;
      const hex = st.palette.colors[idx];
      const oldKind = o.material.userData.kind || 'fabric';
      const newMat = makeMaterial(oldKind, hex);
      o.material = newMat.clone();
      o.material.userData.kind = oldKind;
      o.userData._highlightMat = false;
    }
  });
  _highlighted = [];
  st.selected = null;
  renderColorPane();
  renderChips();
  renderAnalysis();
}

/* ============================================================
   Toast
   ============================================================ */
function showToast(msg) {
  const t = (root && $('#stuToast', root)) || null;
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ============================================================
   کپی
   ============================================================ */
function copyText(text, msg) {
  const done = () => showToast(msg || 'کپی شد');
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    } catch (e) { showToast('کپی نشد'); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

/* ============================================================
   خروجی تصویر
   ============================================================ */
function doExport() {
  if (!renderer) { showToast('صحنه آماده نیست'); return; }
  // رندر با کیفیت بالا
  const oldSize = new THREE.Vector2();
  renderer.getSize(oldSize);
  const oldPR = renderer.getPixelRatio();
  const targetW = st.size || 2400;
  const targetH = Math.round(targetW * 10 / 16);
  renderer.setPixelRatio(1);
  renderer.setSize(targetW, targetH, false);
  camera.aspect = targetW / targetH;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  renderer.domElement.toBlob(async (b) => {
    // برگرداندن اندازه
    const stageRect = stageEl.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(stageRect.width, stageRect.height, false);
    camera.aspect = stageRect.width / stageRect.height;
    camera.updateProjectionMatrix();

    if (!b) { showToast('ساخت تصویر ناموفق'); return; }
    const file = new File([b], `ravaq-${st.palette.id}-${st.sceneId}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: st.palette.name });
        haptic.success();
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('تصویر ذخیره شد');
    haptic.success();
  }, 'image/png', 0.95);
}

/* ============================================================
   رویدادها
   ============================================================ */
function bindEvents() {
  root.addEventListener('click', (e) => {
    const t = e.target;

    const sceneBtn = t.closest('[data-scene]');
    if (sceneBtn) { switchScene(sceneBtn.dataset.scene); return; }

    const viewBtn = t.closest('[data-view]');
    if (viewBtn) { setView(viewBtn.dataset.view); renderViews(); haptic.light(); return; }

    const chip = t.closest('[data-chip]');
    if (chip) { setSelected(st.selected === chip.dataset.chip ? null : chip.dataset.chip); return; }

    const pick = t.closest('[data-pick]');
    if (pick) {
      if (!st.selected) { showToast('اول یک بخش انتخاب کن'); return; }
      applyColorToSelected(+pick.dataset.pick);
      return;
    }

    const lightBtn = t.closest('[data-light]');
    if (lightBtn) {
      st.light = lightBtn.dataset.light;
      st.time = PRESET_T[st.light];
      updateSun(); renderLightPane(); haptic.light();
      return;
    }

    const dir = t.closest('[data-dir]');
    if (dir) { st.windowDir = dir.dataset.dir; updateSun(); renderLightPane(); haptic.select(); return; }

    const wx = t.closest('[data-wx]');
    if (wx) { st.weather = wx.dataset.wx; updateSun(); renderLightPane(); haptic.select(); return; }

    const kel = t.closest('[data-kel]');
    if (kel) { st.lampKelvin = +kel.dataset.kel; updateSun(); renderLightPane(); haptic.select(); return; }

    const sz = t.closest('[data-size]');
    if (sz) { st.size = +sz.dataset.size; renderExportPane(); return; }

    const tab = t.closest('[data-tab]');
    if (tab) { haptic.select(); setTab(tab.dataset.tab); return; }

    const action = t.closest('[data-a]');
    if (action) {
      const a = action.dataset.a;
      if (a === 'close')   return closeStudio();
      if (a === 'shuffle') return smartShuffle();
      if (a === 'export')  return doExport();
      if (a === 'reset')   { ensureAssignment(); applyAllColors(); return; }
      if (a === 'lamp') {
        st.lampOn = !lampIsOn();
        updateSun(); renderLightPane(); haptic.select();
        return;
      }
      if (a === 'copy' && st.selected) {
        const hex = st.palette.colors[st.asg[st.selected]] || '#888';
        copyText(hex.toUpperCase(), 'کد رنگ کپی شد');
        return;
      }
      if (a === 'copyall') {
        const lines = Object.entries(st.asg).map(([k, i]) =>
          `${ROLE_FA[k] || k}: ${(st.palette.colors[i] || '').toUpperCase()}`
        );
        copyText(lines.join('\n'), 'همه‌ی کدها کپی شد');
      }
    }
  });

  root.addEventListener('input', (e) => {
    if (e.target.id === 'stuTime') {
      st.time = +e.target.value;
      st.light = nearestPreset(st.time);
      updateSun();
      updateTimeLbl();
      $$('.stu-light', root).forEach(b => {
        const on = b.dataset.light === st.light;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      });
      const on = lampIsOn(), b = $('#stuLampBtn', root);
      b.setAttribute('aria-pressed', on);
      b.firstElementChild.textContent = on ? 'لوستر روشن' : 'لوستر خاموش';
    }
  });

  // کلیک روی canvas
  const stage = $('#stuStage', root);
  stage.addEventListener('pointerdown', (e) => {
    downXY = [e.clientX, e.clientY];
  });
  stage.addEventListener('pointerup', (e) => {
    if (!downXY) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    if (Math.hypot(dx, dy) < 5) {
      pickAt(e.clientX, e.clientY);
    }
    downXY = null;
  });

  document.addEventListener('keydown', (e) => {
    if (!root || root.hidden) return;
    if (e.key === 'Escape') {
      if (st.selected) setSelected(null);
      else closeStudio();
    }
  });
}

function switchScene(id) {
  if (id === st.sceneId) return;
  st.sceneId = id;
  ensureAssignment();
  st.selected = null;
  _highlighted = [];
  rebuildRoom();
  renderAll();
  // موقعیت دوربین مناسب این صحنه
  const cam = SCENES[id].cam;
  camera.position.set(...cam.pos);
  controls.target.set(...cam.target);
  controls.update();
  haptic.light();
}

/* ============================================================
   Three.js — راه‌اندازی و حلقه‌ی رندر
   ============================================================ */
function initThree() {
  if (renderer) return;
  const stage = $('#stuStage', root);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 20, 45);

  camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.05, 100);
  camera.position.set(4.8, 2.0, 5.5);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, -0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minPolarAngle = 0.15;
  controls.enablePan = false;
  controls.update();

  // محیط PBR
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  setupLighting();
  setupRaycaster();

  // حلقه‌ی رندر
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
  animate();

  // ResizeObserver
  resizeObserver = new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(stage);

  // اندازه‌ی اولیه
  setTimeout(() => {
    const r = stage.getBoundingClientRect();
    if (r.width > 0) {
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
  }, 50);
}

/* ============================================================
   باز/بسته کردن
   ============================================================ */
function openStudio(paletteId) {
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
    stageEl = $('#stuStage', root);
    bindEvents();
    initThree();
  }

  // ریست state
  st.palette = p;
  st.sceneId = 'living';
  st.asg = {};
  st.selected = null;
  st.time = 13;
  st.light = 'day';
  st.weather = 'آفتابی';
  st.windowDir = 'جنوبی';
  st.lampOn = null;
  st.lampKelvin = 3000;
  st.view = 'three_quarter';
  st.tab = 'color';
  st.size = st.size || 2400;
  st.why = '';

  // انتخاب صحنه بر اساس تگ‌های پالت
  const tags = (p.tags || []).join(' ');
  if (tags.includes('اتاق خواب')) st.sceneId = 'bedroom';
  else if (tags.includes('آشپزخانه')) st.sceneId = 'kitchen';
  else if (tags.includes('حمام')) st.sceneId = 'bathroom';
  else if (tags.includes('اداری') || tags.includes('کتابخانه')) st.sceneId = 'office';
  else if (tags.includes('کافه') || tags.includes('رستوران')) st.sceneId = 'cafe';

  ensureAssignment();
  rebuildRoom();

  root.hidden = false;
  document.body.style.overflow = 'hidden';

  // موقعیت دوربین
  const cam = SCENES[st.sceneId].cam;
  camera.position.set(...cam.pos);
  controls.target.set(...cam.target);
  controls.update();

  renderAll();
  haptic.medium();

  // اطمینان از درست بودن اندازه پس از نمایش
  setTimeout(() => {
    const stage = $('#stuStage', root);
    if (stage && renderer) {
      const r = stage.getBoundingClientRect();
      if (r.width > 0) {
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      }
    }
  }, 80);

  const closeBtn = $('[data-a=close]', root);
  if (closeBtn) closeBtn.focus();
}

function closeStudio() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.style.overflow = '';
  haptic.light();
  // توقف رندر برای صرفه‌جویی
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/* ============================================================
   اتصال به کارت‌های پالت
   ============================================================ */
function decorateCards() {
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
  openStudio(b.dataset.studio);
});

const listEl = document.getElementById('list');
if (listEl) {
  new MutationObserver(decorateCards).observe(listEl, { childList: true });
  decorateCards();
}

window.__ravaqStudio = {
  open: openStudio,
  close: closeStudio,
  get SCENES() { return SCENES; },
  get state() { return st; },
};