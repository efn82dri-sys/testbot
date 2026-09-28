/* ============================================================
   رواق — استودیو چیدمان (نسخه ۳.۱ — اصلاح‌شده)
   رفع باگ: window.state + تداخل IDهای SVG در چند SVG هم‌زمان
   ============================================================ */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const tg = window.Telegram?.WebApp || null;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ============================================================
     ۱) ابزارهای پایه
     ============================================================ */
  const haptic = {
    light()  { try { tg?.HapticFeedback?.impactOccurred('light'); } catch (e) {} },
    medium() { try { tg?.HapticFeedback?.impactOccurred('medium'); } catch (e) {} },
    soft()   { try { tg?.HapticFeedback?.impactOccurred('soft'); } catch (e) {} },
    select() { try { tg?.HapticFeedback?.selectionChanged(); } catch (e) {} },
    success(){ try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (e) {} },
  };

  // دسترسی مطمئن به state سراسری — چون در script.js با const تعریف شده و روی window نمی‌نشیند
  function getGlobalState() {
    if (typeof window !== 'undefined' && window.state) return window.state;
    try {
      // eslint-disable-next-line no-undef
      if (typeof state !== 'undefined') return state;
    } catch (e) { /* ignore */ }
    return null;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hexToRgb(h) {
    const s = String(h).replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    const f = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return `#${f(r)}${f(g)}${f(b)}`;
  }
  function mixHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  const lighten = (h, t) => mixHex(h, '#FFFFFF', t);
  const darken  = (h, t) => mixHex(h, '#000000', t);

  // Relative Luminance → LRV (0..100)
  function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function relLum(hex) {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }
  const lrv = (hex) => Math.round(relLum(hex) * 100);

  function saturation(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  }

  function toHSV(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d !== 0) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const s = mx === 0 ? 0 : d / mx;
    return { h, s, v: mx };
  }

  function toLAB(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255).map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    let X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    X = f(X); Y = f(Y); Z = f(Z);
    return { L: 116 * Y - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
  }
  function deltaE(a, b) {
    const A = toLAB(a), B = toLAB(b);
    return Math.sqrt((A.L - B.L) ** 2 + (A.a - B.a) ** 2 + (A.b - B.b) ** 2);
  }

  function contrast(a, b) {
    const la = relLum(a), lb = relLum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ============================================================
     ۲) سیستم متریال
     ============================================================ */
  const MATERIALS = {
    wall:      { name: 'دیوارِ مات',       rough: 0.85, hl: 0.14, warm: 0.02, texture: 'none' },
    wallGloss: { name: 'نیمه‌براق',        rough: 0.55, hl: 0.28, warm: 0.02, texture: 'none' },
    stucco:    { name: 'استوکو',            rough: 0.95, hl: 0.08, warm: 0.03, texture: 'grain' },
    concrete:  { name: 'بتن',              rough: 0.90, hl: 0.10, warm: -0.05, texture: 'grain' },
    wood:      { name: 'چوب',              rough: 0.60, hl: 0.22, warm: 0.06, texture: 'wood' },
    woodDark:  { name: 'چوب تیره',         rough: 0.55, hl: 0.20, warm: 0.05, texture: 'wood' },
    marble:    { name: 'سنگ مرمر',         rough: 0.30, hl: 0.45, warm: 0.01, texture: 'marble' },
    tile:      { name: 'سرامیک',           rough: 0.20, hl: 0.55, warm: 0.00, texture: 'tile' },
    fabric:    { name: 'پارچه',            rough: 0.95, hl: 0.06, warm: 0.03, texture: 'fabric' },
    velvet:    { name: 'مخمل',             rough: 0.55, hl: 0.32, warm: 0.05, texture: 'fabric' },
    leather:   { name: 'چرم',              rough: 0.45, hl: 0.40, warm: 0.04, texture: 'grain' },
    metal:     { name: 'فلز',              rough: 0.25, hl: 0.62, warm: 0.03, texture: 'none' },
    brass:     { name: 'برنج',             rough: 0.30, hl: 0.55, warm: 0.12, texture: 'none' },
    plant:     { name: 'گیاه',             rough: 0.85, hl: 0.10, warm: 0.00, texture: 'none' },
    art:       { name: 'قاب',              rough: 0.40, hl: 0.35, warm: 0.02, texture: 'none' },
    rug:       { name: 'فرش',              rough: 0.98, hl: 0.04, warm: 0.04, texture: 'rug' },
    glass:     { name: 'شیشه',             rough: 0.10, hl: 0.70, warm: -0.02, texture: 'none' },
  };

  /* ============================================================
     ۳) اتاق پایه (پرسپکتیو یک‌نقطه‌ای) — viewBox = 0 0 800 500
     ============================================================ */
  const ROOM = {
    ceiling: 'M0,0 L800,0 L700,60 L100,60 Z',
    wallL:   'M0,0 L100,60 L100,340 L0,400 Z',
    wallR:   'M800,0 L700,60 L700,340 L800,400 Z',
    wallB:   'M100,60 L700,60 L700,340 L100,340 Z',
    floor:   'M0,400 L100,340 L700,340 L800,400 L800,500 L0,500 Z',
  };

  /* ============================================================
     ۴) کتابخانه‌ی صحنه‌ها
     ============================================================ */
  const SCENES = {
    living: {
      name: 'نشیمنِ مدرن',
      subtitle: 'پرسپکتیو ۳۵mm — پنجره‌یِ جنوبی',
      layers: [
        { id: 'ceiling',  name: 'سقف',        role: 'L1', mat: 'wall',   parts: [ROOM.ceiling] },
        { id: 'wall_l',   name: 'دیوارِ کناری', role: 'L2', mat: 'wall',   parts: [ROOM.wallL] },
        { id: 'wall_r',   name: 'دیوارِ کناری', role: 'L2', mat: 'wall',   parts: [ROOM.wallR] },
        { id: 'wall_b',   name: 'دیوارِ اصلی',  role: 'L1', mat: 'wall',   parts: [ROOM.wallB] },
        { id: 'floor',    name: 'کف پارکت',     role: 'M',  mat: 'wood',   parts: [ROOM.floor], texture: 'wood-plank' },
        { id: 'rug',      name: 'فرش',          role: 'L2', mat: 'rug',    parts: ['M180,420 L620,420 L660,470 L140,470 Z'] },
        { id: 'sofa',     name: 'مبل',          role: 'D',  mat: 'fabric',
          parts: [
            'M200,270 Q200,255 215,255 L585,255 Q600,255 600,270 L600,320 L200,320 Z',
            'M190,315 Q190,300 205,300 L595,300 Q610,300 610,315 L610,360 Q610,378 592,378 L208,378 Q190,378 190,360 Z',
            'M175,290 Q175,270 195,270 L205,270 L205,378 L175,378 Z',
            'M625,290 Q625,270 605,270 L595,270 L595,378 L625,378 Z',
          ],
          ao: ['M200,320 L600,320 L600,335 L200,335 Z'],
        },
        { id: 'cushions', name: 'کوسن',         role: 'P',  mat: 'velvet',
          parts: [
            'M225,278 L275,278 L282,318 L218,318 Z',
            'M300,278 L355,278 L360,318 L295,318 Z',
            'M445,278 L500,278 L505,318 L440,318 Z',
            'M525,278 L575,278 L582,318 L518,318 Z',
          ],
        },
        { id: 'coffee',   name: 'میزِ جلومبلی',  role: 'K',  mat: 'woodDark',
          parts: [
            'M320,410 L480,410 L500,425 L300,425 Z',
            'M330,425 L470,425 L470,440 L330,440 Z',
          ],
        },
        { id: 'curtainL', name: 'پرده',         role: 'P',  mat: 'fabric',
          parts: ['M220,60 Q240,65 235,120 Q230,180 245,240 Q250,290 235,340 L200,340 Q215,290 205,240 Q200,180 210,120 Q215,80 205,60 Z'] },
        { id: 'curtainR', name: 'پرده',         role: 'P',  mat: 'fabric',
          parts: ['M580,60 Q565,65 570,120 Q575,180 560,240 Q555,290 570,340 L600,340 Q590,290 600,240 Q605,180 595,120 Q590,80 600,60 Z'] },
        { id: 'window',   name: 'پنجره',        role: 'L1', mat: 'glass',
          parts: ['M250,95 L550,95 L550,245 L250,245 Z'] },
        { id: 'art',      name: 'تابلو',         role: 'P',  mat: 'art',
          parts: ['M355,140 L445,140 L445,210 L355,210 Z'] },
        { id: 'plant',    name: 'گیاه',          role: 'P',  mat: 'plant',
          parts: [
            'M650,360 L685,360 L680,395 L655,395 Z',
            'M665,360 Q655,335 645,325 Q665,340 667,355 Z',
            'M670,360 Q678,330 690,320 Q676,340 673,358 Z',
            'M668,360 Q670,335 668,320 Q665,338 665,355 Z',
          ],
        },
        { id: 'lamp',     name: 'آباژور',        role: 'L2', mat: 'metal',
          parts: [
            'M150,290 L170,290 L168,375 L152,375 Z',
            'M145,275 L175,275 L172,295 L148,295 Z',
          ],
        },
      ],
      aoShapes: [
        { d: 'M100,60 L200,60 L200,340 L100,340 Z', opacity: 0.06, color: '#000' },
        { d: 'M600,60 L700,60 L700,340 L600,340 Z', opacity: 0.06, color: '#000' },
        { d: 'M100,60 L700,60 L700,140 L100,140 Z', opacity: 0.04, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 385, rx: 220, ry: 18, opacity: 0.30 },
        { cx: 400, cy: 448, rx: 170, ry: 10, opacity: 0.22 },
        { cx: 667, cy: 395, rx: 20, ry: 6, opacity: 0.25 },
      ],
      details: [
        { d: 'M250,95 L550,95 L550,245 L250,245 Z', stroke: '#000', strokeOpacity: 0.15, fill: 'none', sw: 1.5 },
        { d: 'M400,95 L400,245 M250,170 L550,170', stroke: '#000', strokeOpacity: 0.12, fill: 'none', sw: 1 },
        { d: 'M100,60 L700,60', stroke: '#000', strokeOpacity: 0.10, fill: 'none', sw: 1 },
        { d: 'M100,340 L700,340', stroke: '#000', strokeOpacity: 0.12, fill: 'none', sw: 1 },
      ],
      lightSide: 'right',
    },

    bedroom: {
      name: 'اتاقِ خوابِ گرم',
      subtitle: 'نمای نزدیکِ دیوارِ تخت — نورِ عصر',
      layers: [
        { id: 'ceiling', name: 'سقف',         role: 'L1', mat: 'wall',  parts: [ROOM.ceiling] },
        { id: 'wall_l',  name: 'دیوارِ کناری', role: 'L2', mat: 'wall',  parts: [ROOM.wallL] },
        { id: 'wall_r',  name: 'دیوارِ کناری', role: 'L2', mat: 'wall',  parts: [ROOM.wallR] },
        { id: 'wall_b',  name: 'دیوارِ پشت تخت', role: 'D', mat: 'wallGloss', parts: [ROOM.wallB] },
        { id: 'floor',   name: 'کف',          role: 'M',  mat: 'wood',  parts: [ROOM.floor], texture: 'wood-plank' },
        { id: 'rug',     name: 'فرش',          role: 'L2', mat: 'rug',
          parts: ['M140,410 L660,410 L690,470 L110,470 Z'] },
        { id: 'bed',     name: 'تخت',          role: 'M',  mat: 'fabric',
          parts: ['M180,300 Q180,285 195,285 L605,285 Q620,285 620,300 L620,375 L180,375 Z'] },
        { id: 'bedding', name: 'روتختی',       role: 'L1', mat: 'fabric',
          parts: ['M180,300 L620,300 L620,340 L180,340 Z'] },
        { id: 'headboard', name: 'تاجِ تخت',  role: 'K',  mat: 'velvet',
          parts: [
            'M200,180 L600,180 L600,300 L200,300 Z',
            'M200,180 L220,155 L580,155 L600,180 Z',
          ] },
        { id: 'pillow1', name: 'بالش',         role: 'P',  mat: 'fabric',
          parts: ['M225,265 L305,265 L305,300 L225,300 Z'] },
        { id: 'pillow2', name: 'بالش',         role: 'P',  mat: 'fabric',
          parts: ['M495,265 L575,265 L575,300 L495,300 Z'] },
        { id: 'throw',   name: 'پتو',           role: 'P',  mat: 'velvet',
          parts: ['M370,300 L520,300 L530,375 L360,375 Z'] },
        { id: 'nightL',  name: 'پاتختی',        role: 'K',  mat: 'wood',
          parts: ['M100,290 L160,290 L160,378 L100,378 Z'] },
        { id: 'nightR',  name: 'پاتختی',        role: 'K',  mat: 'wood',
          parts: ['M640,290 L700,290 L700,378 L640,378 Z'] },
        { id: 'lampL',   name: 'آباژور',         role: 'P',  mat: 'brass',
          parts: [
            'M122,265 L138,265 L136,290 L124,290 Z',
            'M115,248 L145,248 L141,268 L119,268 Z',
          ] },
        { id: 'lampR',   name: 'آباژور',         role: 'P',  mat: 'brass',
          parts: [
            'M662,265 L678,265 L676,290 L664,290 Z',
            'M655,248 L685,248 L681,268 L659,268 Z',
          ] },
        { id: 'art',     name: 'تابلو',          role: 'P',  mat: 'art',
          parts: ['M340,90 L460,90 L460,150 L340,150 Z'] },
      ],
      aoShapes: [
        { d: 'M100,60 L200,60 L200,340 L100,340 Z', opacity: 0.07, color: '#000' },
        { d: 'M600,60 L700,60 L700,340 L600,340 Z', opacity: 0.07, color: '#000' },
        { d: 'M200,280 L600,280 L600,300 L200,300 Z', opacity: 0.15, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 380, rx: 230, ry: 20, opacity: 0.32 },
        { cx: 400, cy: 445, rx: 190, ry: 12, opacity: 0.20 },
      ],
      details: [
        { d: 'M200,180 L600,180', stroke: '#000', strokeOpacity: 0.12, fill: 'none', sw: 1.2 },
        { d: 'M180,300 L620,300', stroke: '#000', strokeOpacity: 0.10, fill: 'none', sw: 1 },
      ],
      lightSide: 'left',
    },

    kitchen: {
      name: 'آشپزخانه‌یِ مدرن',
      subtitle: 'نمایِ روبه‌رو — نورِ روز',
      layers: [
        { id: 'wall',    name: 'دیوار',         role: 'L1', mat: 'wall', parts: ['M0,0 L800,0 L800,340 L0,340 Z'] },
        { id: 'splash',  name: 'میان‌کابینتی',   role: 'L2', mat: 'tile', parts: ['M40,140 L760,140 L760,200 L40,200 Z'] },
        { id: 'upper',   name: 'کابینتِ بالا',   role: 'L2', mat: 'wallGloss',
          parts: [
            'M40,45 L250,45 L250,130 L40,130 Z',
            'M280,45 L490,45 L490,130 L280,130 Z',
            'M520,45 L760,45 L760,130 L520,130 Z',
          ] },
        { id: 'counter', name: 'سنگِ کانتر',    role: 'M',  mat: 'marble',
          parts: ['M20,225 L780,225 L780,245 L20,245 Z'] },
        { id: 'lower',   name: 'کابینتِ پایین', role: 'D',  mat: 'wallGloss',
          parts: ['M40,245 L760,245 L760,400 L40,400 Z'] },
        { id: 'floor',   name: 'کف',            role: 'K',  mat: 'tile',
          parts: ['M0,400 L800,400 L800,500 L0,500 Z'], texture: 'tile' },
        { id: 'hardware',name: 'دستگیره‌ها',    role: 'P',  mat: 'brass',
          parts: [
            'M235,80 L240,80 L240,105 L235,105 Z',
            'M485,80 L490,80 L490,105 L485,105 Z',
            'M265,80 L270,80 L270,105 L265,105 Z',
            'M515,80 L520,80 L520,105 L515,105 Z',
            'M120,300 L128,300 L128,340 L120,340 Z',
            'M170,300 L178,300 L178,340 L170,340 Z',
            'M620,300 L628,300 L628,340 L620,340 Z',
            'M670,300 L678,300 L678,340 L670,340 Z',
          ] },
        { id: 'hood',    name: 'هود',           role: 'P',  mat: 'metal',
          parts: ['M320,20 L480,20 L460,60 L340,60 Z'] },
        { id: 'faucet',  name: 'شیرآلات',       role: 'P',  mat: 'brass',
          parts: ['M395,200 L405,200 L405,228 L395,228 Z M400,200 Q400,180 415,180 L430,180 L430,188 L418,188 Q407,188 407,200 Z'] },
      ],
      aoShapes: [
        { d: 'M0,0 L80,0 L80,340 L0,340 Z', opacity: 0.06, color: '#000' },
        { d: 'M720,0 L800,0 L800,340 L720,340 Z', opacity: 0.06, color: '#000' },
        { d: 'M40,200 L760,200 L760,225 L40,225 Z', opacity: 0.18, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 410, rx: 380, ry: 15, opacity: 0.25 },
        { cx: 400, cy: 470, rx: 300, ry: 20, opacity: 0.15 },
      ],
      details: [
        { d: 'M250,45 L250,400 M490,45 L490,400', stroke: '#000', strokeOpacity: 0.10, fill: 'none', sw: 1.2 },
        { d: 'M20,245 L780,245', stroke: '#000', strokeOpacity: 0.15, fill: 'none', sw: 1 },
      ],
      lightSide: 'top',
    },

    bathroom: {
      name: 'حمامِ اسپا',
      subtitle: 'نمایِ روبه‌رو — نورِ پنهان',
      layers: [
        { id: 'wall',   name: 'دیوار',          role: 'L1', mat: 'tile', parts: ['M0,0 L800,0 L800,340 L0,340 Z'] },
        { id: 'floor',  name: 'کفِ سرامیک',     role: 'M',  mat: 'tile', parts: ['M0,340 L800,340 L800,500 L0,500 Z'], texture: 'tile' },
        { id: 'accent', name: 'دیوارِ تأکیدی',  role: 'D',  mat: 'tile',
          parts: ['M240,60 L560,60 L560,340 L240,340 Z'] },
        { id: 'vanity', name: 'کابینتِ روشویی', role: 'L2', mat: 'wood',
          parts: ['M300,240 L500,240 L500,360 L300,360 Z'] },
        { id: 'basin',  name: 'روشویی',         role: 'P',  mat: 'marble',
          parts: ['M310,225 L490,225 Q495,225 495,235 L495,255 L305,255 L305,235 Q305,225 310,225 Z'] },
        { id: 'mirror', name: 'آینه',           role: 'L1', mat: 'glass',
          parts: ['M330,90 L470,90 L470,210 L330,210 Z'] },
        { id: 'faucet', name: 'شیرآلات',        role: 'P',  mat: 'brass',
          parts: ['M395,195 L405,195 L405,228 L395,228 Z M400,195 Q400,175 415,175 L430,175 L430,183 L418,183 Q407,183 407,195 Z'] },
        { id: 'towels', name: 'حوله‌ها',         role: 'P',  mat: 'fabric',
          parts: [
            'M595,120 L675,120 L675,180 L595,180 Z',
            'M600,180 L670,180 L670,235 L600,235 Z',
          ] },
        { id: 'mat',    name: 'زیرپایی',         role: 'P',  mat: 'rug',
          parts: ['M320,430 L480,430 L510,470 L290,470 Z'] },
      ],
      aoShapes: [
        { d: 'M0,0 L120,0 L120,340 L0,340 Z', opacity: 0.05, color: '#000' },
        { d: 'M680,0 L800,0 L800,340 L680,340 Z', opacity: 0.05, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 365, rx: 120, ry: 10, opacity: 0.30 },
        { cx: 400, cy: 455, rx: 120, ry: 8, opacity: 0.20 },
      ],
      details: [
        { d: 'M240,60 L560,60', stroke: '#000', strokeOpacity: 0.10, fill: 'none', sw: 1 },
        { d: 'M330,90 L470,210', stroke: '#FFF', strokeOpacity: 0.10, fill: 'none', sw: 1 },
      ],
      lightSide: 'top',
    },

    office: {
      name: 'اتاقِ کارِ مینیمال',
      subtitle: 'نمایِ روبه‌رو — نورِ شمالی',
      layers: [
        { id: 'ceiling', name: 'سقف',           role: 'L1', mat: 'wall', parts: [ROOM.ceiling] },
        { id: 'wall_l',  name: 'دیوارِ کناری',  role: 'L2', mat: 'wall', parts: [ROOM.wallL] },
        { id: 'wall_r',  name: 'دیوارِ کناری',  role: 'L2', mat: 'wall', parts: [ROOM.wallR] },
        { id: 'wall_b',  name: 'دیوارِ اصلی',   role: 'L1', mat: 'wall', parts: [ROOM.wallB] },
        { id: 'floor',   name: 'کف',            role: 'M',  mat: 'wood', parts: [ROOM.floor], texture: 'wood-plank' },
        { id: 'rug',     name: 'فرش',           role: 'L2', mat: 'rug',
          parts: ['M220,400 L580,400 L620,455 L180,455 Z'] },
        { id: 'desk',    name: 'میزِ کار',       role: 'D',  mat: 'woodDark',
          parts: [
            'M180,330 L620,330 L640,345 L160,345 Z',
            'M175,345 L185,345 L185,405 L175,405 Z',
            'M615,345 L625,345 L625,405 L615,405 Z',
          ] },
        { id: 'shelf',   name: 'کتابخانه',       role: 'K',  mat: 'wood',
          parts: ['M620,90 L760,90 L760,340 L620,340 Z'] },
        { id: 'books',   name: 'کتاب‌ها',        role: 'P',  mat: 'fabric',
          parts: [
            'M635,130 L735,130 L735,175 L635,175 Z',
            'M640,180 L730,180 L730,225 L640,225 Z',
            'M645,230 L725,230 L725,275 L645,275 Z',
          ] },
        { id: 'chair',   name: 'صندلی',          role: 'K',  mat: 'velvet',
          parts: [
            'M360,330 Q360,315 375,315 L425,315 Q440,315 440,330 L440,390 L360,390 Z',
            'M380,405 L390,405 L390,430 L380,430 Z',
            'M410,405 L420,405 L420,430 L410,430 Z',
          ] },
        { id: 'monitor', name: 'مانیتور',        role: 'P',  mat: 'metal',
          parts: [
            'M340,245 L460,245 L460,300 L340,300 Z',
            'M390,300 L410,300 L410,320 L390,320 Z',
            'M370,320 L430,320 L430,328 L370,328 Z',
          ] },
        { id: 'plant',   name: 'گیاه',           role: 'P',  mat: 'plant',
          parts: [
            'M90,340 L125,340 L120,395 L95,395 Z',
            'M108,340 Q98,315 88,305 Q108,320 110,335 Z',
            'M112,340 Q120,310 132,300 Q118,320 115,338 Z',
            'M110,340 Q112,315 110,300 Q107,318 107,335 Z',
          ] },
        { id: 'art',     name: 'تابلو',          role: 'P',  mat: 'art',
          parts: ['M330,120 L470,120 L470,200 L330,200 Z'] },
      ],
      aoShapes: [
        { d: 'M100,60 L200,60 L200,340 L100,340 Z', opacity: 0.06, color: '#000' },
        { d: 'M600,60 L700,60 L700,340 L600,340 Z', opacity: 0.06, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 408, rx: 240, ry: 15, opacity: 0.28 },
        { cx: 400, cy: 428, rx: 220, ry: 8, opacity: 0.20 },
      ],
      details: [
        { d: 'M620,90 L760,90 L760,340 L620,340 Z', stroke: '#000', strokeOpacity: 0.15, fill: 'none', sw: 1.2 },
        { d: 'M620,175 L760,175 M620,225 L760,225 M620,275 L760,275', stroke: '#000', strokeOpacity: 0.10, fill: 'none', sw: 1 },
      ],
      lightSide: 'left',
    },

    cafe: {
      name: 'کافه‌یِ گرم',
      subtitle: 'نمایِ داخلی — نورِ آویز',
      layers: [
        { id: 'wall',    name: 'دیوار',          role: 'L1', mat: 'stucco', parts: ['M0,0 L800,0 L800,340 L0,340 Z'] },
        { id: 'brick',   name: 'دیوارِ آجری',    role: 'D',  mat: 'concrete',
          parts: ['M0,0 L800,0 L800,110 L0,110 Z'] },
        { id: 'floor',   name: 'کف',             role: 'K',  mat: 'tile', parts: ['M0,340 L800,340 L800,500 L0,500 Z'], texture: 'tile' },
        { id: 'counter', name: 'کانترِ چوبی',    role: 'M',  mat: 'wood',
          parts: ['M80,265 L720,265 L720,340 L80,340 Z'] },
        { id: 'top',     name: 'سنگِ روی کانتر', role: 'L2', mat: 'marble',
          parts: ['M70,255 L730,255 L730,268 L70,268 Z'] },
        { id: 'shelf',   name: 'قفسه‌یِ بالا',    role: 'D',  mat: 'woodDark',
          parts: [
            'M120,120 L680,120 L680,140 L120,140 Z',
            'M120,180 L680,180 L680,200 L120,200 Z',
          ] },
        { id: 'bottles', name: 'بطری‌ها',         role: 'P',  mat: 'glass',
          parts: [
            'M150,90 L165,90 L165,120 L150,120 Z',
            'M180,85 L195,85 L195,120 L180,120 Z',
            'M215,95 L230,95 L230,120 L215,120 Z',
            'M250,88 L265,88 L265,120 L250,120 Z',
            'M500,92 L515,92 L515,120 L500,120 Z',
            'M540,85 L555,85 L555,120 L540,120 Z',
            'M575,95 L590,95 L590,120 L575,120 Z',
          ] },
        { id: 'stool1',  name: 'صندلی',           role: 'K',  mat: 'leather',
          parts: [
            'M180,340 Q180,325 195,325 L245,325 Q260,325 260,340 L260,420 L180,420 Z',
            'M200,420 L210,420 L210,450 L200,450 Z',
            'M235,420 L245,420 L245,450 L235,450 Z',
          ] },
        { id: 'stool2',  name: 'صندلی',           role: 'K',  mat: 'leather',
          parts: [
            'M320,340 Q320,325 335,325 L385,325 Q400,325 400,340 L400,420 L320,420 Z',
            'M340,420 L350,420 L350,450 L340,450 Z',
            'M375,420 L385,420 L385,450 L375,450 Z',
          ] },
        { id: 'stool3',  name: 'صندلی',           role: 'K',  mat: 'leather',
          parts: [
            'M460,340 Q460,325 475,325 L525,325 Q540,325 540,340 L540,420 L460,420 Z',
            'M480,420 L490,420 L490,450 L480,450 Z',
            'M515,420 L525,420 L525,450 L515,450 Z',
          ] },
        { id: 'stool4',  name: 'صندلی',           role: 'K',  mat: 'leather',
          parts: [
            'M600,340 Q600,325 615,325 L665,325 Q680,325 680,340 L680,420 L600,420 Z',
            'M620,420 L630,420 L630,450 L620,450 Z',
            'M655,420 L665,420 L665,450 L655,450 Z',
          ] },
        { id: 'lights',  name: 'چراغ‌هایِ آویز',    role: 'P',  mat: 'brass',
          parts: [
            'M180,0 L180,55 M162,55 L198,55 L192,85 L168,85 Z',
            'M400,0 L400,55 M382,55 L418,55 L412,85 L388,85 Z',
            'M620,0 L620,55 M602,55 L638,55 L632,85 L608,85 Z',
          ] },
        { id: 'glow1',   name: 'نورِ چراغ',       role: 'L2', mat: 'glass', isGlow: true,
          parts: ['M155,85 Q180,120 205,85 Z'] },
      ],
      aoShapes: [
        { d: 'M0,0 L100,0 L100,340 L0,340 Z', opacity: 0.05, color: '#000' },
        { d: 'M700,0 L800,0 L800,340 L700,340 Z', opacity: 0.05, color: '#000' },
        { d: 'M80,265 L720,265 L720,290 L80,290 Z', opacity: 0.16, color: '#000' },
      ],
      shadows: [
        { cx: 400, cy: 345, rx: 330, ry: 12, opacity: 0.28 },
        { cx: 220, cy: 455, rx: 55, ry: 8, opacity: 0.30 },
        { cx: 360, cy: 455, rx: 55, ry: 8, opacity: 0.30 },
        { cx: 500, cy: 455, rx: 55, ry: 8, opacity: 0.30 },
        { cx: 640, cy: 455, rx: 55, ry: 8, opacity: 0.30 },
      ],
      details: [
        { d: 'M0,110 L800,110', stroke: '#000', strokeOpacity: 0.18, fill: 'none', sw: 1.5 },
        { d: 'M70,255 L730,255', stroke: '#000', strokeOpacity: 0.15, fill: 'none', sw: 1 },
      ],
      lightSide: 'top',
    },
  };

  /* ============================================================
     ۵) سناریوهای نور
     ============================================================ */
  const LIGHTS = {
    dawn:  { name: 'صبح',   icon: 'sunrise', tint: 'rgba(255, 210, 160, 0.10)', shadowTint: 'rgba(120, 90, 70, 0.20)',  warmth: 'warm' },
    day:   { name: 'روز',   icon: 'sun',     tint: 'rgba(255, 250, 240, 0.00)', shadowTint: 'rgba(60, 60, 60, 0.18)',   warmth: 'neutral' },
    dusk:  { name: 'عصر',   icon: 'sunset',  tint: 'rgba(255, 170, 100, 0.14)', shadowTint: 'rgba(140, 80, 50, 0.24)',  warmth: 'warm' },
    night: { name: 'شب',    icon: 'moon',    tint: 'rgba(70, 90, 140, 0.30)',   shadowTint: 'rgba(10, 20, 50, 0.35)',   warmth: 'cool' },
  };

  /* ============================================================
     ۶) موتور رندر — با پیشوند یگانه برای همه‌ی IDهای SVG
     ============================================================ */
  let _svgUid = 0;

  function buildSVG(scene, asg, palette, lightKey, opts = {}) {
    // پیشوند یگانه برای جلوگیری از تداخل IDها وقتی چند SVG هم‌زمان در DOM هستند
    // (Timeline، Before/After، پیش‌نمایش…) — این باگ باعث می‌شد همه‌ی مینیاتورها
    // یک رنگ ثابت داشته باشند و url(#grad-...) اشتباه رزولوشن شود.
    const uid = `u${++_svgUid}`;
    const id = (name) => `${uid}-${name}`;

    const light = LIGHTS[lightKey] || LIGHTS.day;
    const defs = [];

    // ---------- فیلترها و پترن‌ها ----------
    defs.push(`
      <filter id="${id('blur-lg')}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="9"/>
      </filter>
      <filter id="${id('blur-md')}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
      <filter id="${id('blur-sm')}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.8"/>
      </filter>
      <pattern id="${id('wood-plank')}" x="0" y="0" width="140" height="24"
               patternUnits="userSpaceOnUse" patternTransform="skewX(-18)">
        <rect width="140" height="24" fill="none"/>
        <path d="M0,23 L140,23" stroke="rgba(0,0,0,0.15)" stroke-width="0.8"/>
        <path d="M0,6 L140,6 M0,12 L140,12 M0,18 L140,18" stroke="rgba(0,0,0,0.05)" stroke-width="0.4"/>
      </pattern>
      <pattern id="${id('tile')}" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M0,0 L60,0 L60,60 L0,60 Z" fill="none" stroke="rgba(0,0,0,0.14)" stroke-width="0.7"/>
      </pattern>
    `);

    // ---------- لایه‌ها ----------
    const layersHtml = [];

    for (const layer of scene.layers) {
      if (asg[layer.id] === undefined || asg[layer.id] === null) continue;
      const colorRaw = palette[asg[layer.id]];
      if (!colorRaw) continue;
      const mat = MATERIALS[layer.mat] || MATERIALS.wall;

      // تنظیم گرمی/سردی رنگ بر اساس متریال
      const color = mat.warm > 0
        ? mixHex(colorRaw, '#F2C08A', mat.warm * 0.5)
        : mat.warm < 0
          ? mixHex(colorRaw, '#A8C0E0', -mat.warm * 0.4)
          : colorRaw;

      // گرادیان هر لایه (یگانه)
      const gradId = id(`grad-${layer.id}`);
      const topC = lighten(color, mat.hl * 0.55);
      const botC = darken(color, mat.hl * 0.35 + 0.06);
      defs.push(`
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${topC}"/>
          <stop offset="0.45" stop-color="${color}"/>
          <stop offset="1" stop-color="${botC}"/>
        </linearGradient>
      `);

      const paths = layer.parts.map(d => `<path d="${d}" fill="url(#${gradId})"/>`).join('');

      // هایلایت شیشه‌ای برای متریال‌های صاف
      const isFlat = mat.rough < 0.5;
      const sheenId = id(`sheen-${layer.id}`);
      if (isFlat) {
        defs.push(`
          <linearGradient id="${sheenId}" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stop-color="#FFF" stop-opacity="0.55"/>
            <stop offset="0.35" stop-color="#FFF" stop-opacity="0"/>
            <stop offset="1" stop-color="#FFF" stop-opacity="0"/>
          </linearGradient>
        `);
      }
      const sheen = isFlat
        ? `<g pointer-events="none" opacity="${mat.hl}">${layer.parts.map(d => `<path d="${d}" fill="url(#${sheenId})"/>`).join('')}</g>`
        : '';

      // AO داخل لایه
      const ao = layer.ao
        ? layer.ao.map(d => `<path d="${d}" fill="#000" opacity="0.18" pointer-events="none"/>`).join('')
        : '';

      // بافت
      const texId = layer.texture ? id(layer.texture) : null;
      const tex = layer.texture
        ? `<g pointer-events="none" opacity="0.55">${layer.parts.map(d => `<path d="${d}" fill="url(#${texId})"/>`).join('')}</g>`
        : '';

      // درخشش چراغ‌ها
      const glow = layer.isGlow
        ? `<g pointer-events="none" filter="url(#${id('blur-md')})" opacity="0.75">${layer.parts.map(d => `<path d="${d}" fill="${color}"/>`).join('')}</g>`
        : '';

      const sel = opts.selected === layer.id ? ' sel' : '';

      layersHtml.push(`
        <g class="ly${sel}" data-l="${layer.id}" style="--ly-color:${color}">
          ${glow}
          ${paths}
          ${sheen}
          ${tex}
          ${ao}
        </g>
      `);
    }

    // ---------- AO سراسری ----------
    const aoGlobal = (scene.aoShapes || []).map(s =>
      `<path d="${s.d}" fill="${s.color}" opacity="${s.opacity}" pointer-events="none"/>`
    ).join('');

    // ---------- سایه‌های نرم ----------
    const shadows = (scene.shadows || []).map(s =>
      `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="#000" opacity="${s.opacity}" filter="url(#${id('blur-lg')})" pointer-events="none"/>`
    ).join('');

    // ---------- جزئیات (خطوط لبه) ----------
    const details = (scene.details || []).map(d =>
      `<path d="${d.d}" fill="${d.fill || 'none'}" stroke="${d.stroke || 'none'}" stroke-opacity="${d.strokeOpacity ?? 1}" stroke-width="${d.sw || 1}" pointer-events="none"/>`
    ).join('');

    // ---------- وینیت ----------
    defs.push(`
      <radialGradient id="${id('vignette')}" cx="0.5" cy="0.45" r="0.9">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
      </radialGradient>
    `);

    // رنگ پس‌زمینه‌ی SVG (برای پرکردن لبه‌ها)
    const bgFill = palette[asg.wall_b ?? asg.wall ?? asg.ceiling ?? 0] || '#222';

    return `<svg viewBox="0 0 800 500" xmlns="${NS}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${scene.name}">
      <defs>${defs.join('')}</defs>
      <rect width="800" height="500" fill="${bgFill}"/>
      <g class="stage-layer">
        ${layersHtml.join('')}
      </g>
      ${aoGlobal}
      ${shadows}
      ${details}
      <rect width="800" height="500" fill="${light.tint}" pointer-events="none"/>
      <rect width="800" height="500" fill="url(#${id('vignette')})" pointer-events="none"/>
    </svg>`;
  }

  /* ============================================================
     ۷) تحلیل زنده
     ============================================================ */
  function computeAnalysis(scene, asg, palette) {
    let totalArea = 0;
    const WEIGHTS = { L1: 1.0, L2: 0.6, M: 0.7, D: 0.5, K: 0.3, P: 0.15 };

    const roleTotals = { L1: 0, L2: 0, M: 0, D: 0, K: 0, P: 0 };
    const colorRoleSum = {};
    const roleColor = {};

    for (const layer of scene.layers) {
      if (!layer.role) continue;
      const color = palette[asg[layer.id]];
      if (!color) continue;
      const w = WEIGHTS[layer.role] || 0.3;
      roleTotals[layer.role] = (roleTotals[layer.role] || 0) + w;
      totalArea += w;
      colorRoleSum[color] = (colorRoleSum[color] || 0) + w;
      if (!roleColor[layer.role]) roleColor[layer.role] = color;
    }

    const roles = ['L1', 'L2', 'D', 'K', 'P', 'M'];
    const roleInfo = roles.map(r => {
      const sum = roleTotals[r] || 0;
      const pct = totalArea > 0 ? (sum / totalArea) * 100 : 0;
      return { role: r, pct, color: roleColor[r] || null, weight: sum };
    }).filter(r => r.pct > 0.5);

    // هارمونی رنگ بر اساس چرخه‌ی HSV
    const uniqueColors = Object.keys(colorRoleSum);
    const hues = uniqueColors.map(c => toHSV(c).h).filter(h => !isNaN(h));
    let harmonyType = 'تک‌رنگ';
    let harmonyScore = 65;

    if (hues.length >= 2) {
      const diffs = [];
      for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          let d = Math.abs(hues[i] - hues[j]);
          if (d > 180) d = 360 - d;
          diffs.push(d);
        }
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      if (avgDiff < 20)      { harmonyType = 'تک‌رنگ (Monochromatic)'; harmonyScore = 92; }
      else if (avgDiff < 50) { harmonyType = 'آنالوگ (Analogous)';       harmonyScore = 88; }
      else if (avgDiff < 100){ harmonyType = 'مکملِ نزدیک';              harmonyScore = 78; }
      else if (avgDiff < 150){ harmonyType = 'سه‌گانه (Triadic)';        harmonyScore = 82; }
      else                   { harmonyType = 'مکمل (Complementary)';     harmonyScore = 74; }
    }

    const lrvs = uniqueColors.map(lrv);
    const lrvRange = Math.max(...lrvs) - Math.min(...lrvs);
    if (lrvRange > 40) harmonyScore += 6;
    if (lrvRange < 15) harmonyScore -= 10;
    harmonyScore = clamp(harmonyScore, 0, 100);

    const l1Pct = totalArea ? (roleTotals.L1 / totalArea) * 100 : 0;
    const l2Pct = totalArea ? (roleTotals.L2 / totalArea) * 100 : 0;
    const dev = Math.abs(l1Pct - 60) + Math.abs(l2Pct - 30);
    const balanceScore = clamp(100 - dev, 0, 100);

    const warnings = [];
    const wallLrv = roleColor.L1 ? lrv(roleColor.L1) : 50;
    if (wallLrv < 25) warnings.push({ level: 'warn', text: 'LRV دیوارِ اصلی کمتر از ۲۵٪ است — برای فضاهایِ کوچک ممکن است تیره به‌نظر بیاید.' });
    if (wallLrv > 88) warnings.push({ level: 'warn', text: 'LRV دیوارِ اصلی بالای ۸۸٪ است — ممکن است در نورِ شدید شسته به‌نظر بیاید.' });

    const contrastWallFloor = roleColor.L1 && roleColor.M
      ? contrast(roleColor.L1, roleColor.M) : null;
    if (contrastWallFloor && contrastWallFloor < 1.3) {
      warnings.push({ level: 'info', text: 'کنتراستِ دیوار و کف کم است — فضا یکدست‌تر می‌شود.' });
    }

    const wcagPairs = [];
    if (roleColor.L1 && roleColor.M) wcagPairs.push({ a: roleColor.L1, b: roleColor.M, label: 'دیوار / کف' });
    if (roleColor.L1 && roleColor.D) wcagPairs.push({ a: roleColor.L1, b: roleColor.D, label: 'دیوار / مبل' });

    const colorStats = uniqueColors.map(hex => {
      const l = lrv(hex);
      const isLight = l > 60;
      const use = isLight ? 'رنگِ پایه' : 'رنگِ تأکیدی';
      const refMap = roleInfo.find(r => r.color === hex);
      return {
        hex, lrv: l,
        share: totalArea ? (colorRoleSum[hex] / totalArea * 100) : 0,
        role: refMap ? refMap.role : 'M',
        usage: use,
      };
    }).sort((a, b) => b.share - a.share);

    return {
      colorStats, roleInfo, harmonyType, harmonyScore, balanceScore,
      warnings, wcagPairs, totalWeight: totalArea,
    };
  }

  /* ============================================================
     ۸) بُر هوشمند بر اساس تئوری رنگ
     ============================================================ */
  function smartShuffle(scene, palette, locked = {}) {
    const roles = scene.layers.filter(l => l.role && !locked[l.id]);
    if (!roles.length) return null;

    const strategies = ['mono', 'analogous', 'complementary', 'triadic'];
    const strat = strategies[Math.floor(Math.random() * strategies.length)];

    const pivot = Math.floor(Math.random() * palette.length);
    const pHSV = toHSV(palette[pivot]);
    const idxs = [pivot];

    function nearestIdx(targetHue) {
      let best = 0, bestD = 999;
      for (let i = 0; i < palette.length; i++) {
        if (idxs.includes(i)) continue;
        const h = toHSV(palette[i]).h;
        let d = Math.abs(h - targetHue);
        if (d > 180) d = 360 - d;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    if (strat === 'mono') {
      idxs.push(nearestIdx(pHSV.h), nearestIdx((pHSV.h + 15) % 360));
    } else if (strat === 'analogous') {
      idxs.push(nearestIdx((pHSV.h + 30) % 360), nearestIdx((pHSV.h - 30 + 360) % 360));
    } else if (strat === 'complementary') {
      idxs.push(nearestIdx((pHSV.h + 180) % 360), nearestIdx(pHSV.h));
    } else {
      idxs.push(nearestIdx((pHSV.h + 120) % 360), nearestIdx((pHSV.h + 240) % 360));
    }
    while (idxs.length < palette.length) idxs.push(nearestIdx(pHSV.h));

    const ROLE_MAP = {
      L1: [idxs[3] ?? idxs[0], idxs[4] ?? idxs[0]],
      L2: [idxs[2] ?? idxs[0]],
      M:  [idxs[1] ?? idxs[0]],
      D:  [idxs[1] ?? idxs[0], idxs[2] ?? idxs[0]],
      K:  [idxs[0]],
      P:  [idxs[Math.min(2, idxs.length - 1)]],
    };

    const result = {};
    for (const layer of scene.layers) {
      if (!layer.role) continue;
      if (locked[layer.id]) continue;
      const pool = ROLE_MAP[layer.role] || [idxs[0]];
      result[layer.id] = pool[Math.floor(Math.random() * pool.length)];
    }
    return { result, strategy: strat, pivot };
  }

  /* ============================================================
     ۹) وضعیت
     ============================================================ */
  const st = {
    palette: null,
    sceneId: 'living',
    asgByScene: {},
    lock: new Set(),
    history: [],
    future: [],
    selected: null,
    light: 'day',
    before: false,
    splitX: 50,
  };

  let root, stageEl;

  /* ============================================================
     ۱۰) HTML Shell
     ============================================================ */
  function buildShell() {
    const el = document.createElement('div');
    el.className = 'stu-v3';
    el.hidden = true;
    el.innerHTML = `
      <div class="stu-panel" role="dialog" aria-modal="true" aria-label="استودیو چیدمان">
        <header class="stu-head">
          <div class="stu-title">
            <div class="stu-dot" aria-hidden="true"></div>
            <div>
              <h3 id="stuName">—</h3>
              <span id="stuMeta">—</span>
            </div>
          </div>
          <div class="stu-head-actions">
            <button type="button" class="stu-icon" data-a="compare" aria-label="مقایسه قبل/بعد" title="قبل/بعد">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>
            </button>
            <button type="button" class="stu-icon" data-a="export" aria-label="ذخیره تصویر" title="ذخیره PNG">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
            <button type="button" class="stu-icon stu-icon-close" data-a="close" aria-label="بستن">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </div>
        </header>

        <div class="stu-grid">
          <section class="stu-canvas-col">
            <div class="stu-scenes" id="stuScenes" role="tablist" aria-label="انتخاب صحنه"></div>

            <div class="stu-stage" id="stuStage" aria-live="polite"></div>

            <div class="stu-lights" id="stuLights" role="tablist" aria-label="سناریوی نور"></div>

            <div class="stu-timeline" id="stuTimeline" aria-label="تاریخچه چیدمان">
              <div class="stu-tl-inner" id="stuTlInner"></div>
            </div>

            <div class="stu-actions">
              <button type="button" class="stu-btn stu-btn-primary" data-a="shuffle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
                <span>بُر هوشمند</span>
              </button>
              <button type="button" class="stu-btn" data-a="undo" aria-label="مرحله‌ی قبل">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5M4 9h10a7 7 0 0 1 0 14h-3"/></svg>
              </button>
              <button type="button" class="stu-btn" data-a="redo" aria-label="مرحله‌ی بعد">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5M20 9H10a7 7 0 0 0 0 14h3"/></svg>
              </button>
              <button type="button" class="stu-btn" data-a="reset" aria-label="بازنشانی">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg>
              </button>
            </div>
          </section>

          <aside class="stu-side">
            <div class="stu-side-block">
              <div class="stu-side-head">
                <span>پالتِ فعال</span>
                <span class="stu-hint-sm" id="stuSelHint">یک بخش را انتخاب کن</span>
              </div>
              <div class="stu-palette" id="stuPalette" role="listbox" aria-label="پالت رنگ"></div>
            </div>

            <div class="stu-side-block stu-side-grow">
              <div class="stu-side-head">
                <span>لایه‌ها</span>
                <span class="stu-hint-sm" id="stuLayerCount">—</span>
              </div>
              <div class="stu-layers" id="stuLayers"></div>
            </div>

            <div class="stu-side-block">
              <div class="stu-side-head">
                <span>تحلیل زنده</span>
                <span class="stu-hint-sm" id="stuAnalyBadge">—</span>
              </div>
              <div class="stu-analysis" id="stuAnalysis"></div>
            </div>
          </aside>
        </div>

        <div class="stu-compare-bar" id="stuCompareBar" hidden>
          <span>قبل</span>
          <input type="range" min="0" max="100" value="50" id="stuSplit" aria-label="مقایسه">
          <span>بعد</span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  /* ============================================================
     ۱۱) CSS
     ============================================================ */
  function injectCSS() {
    if (document.getElementById('stu-v3-css')) return;
    const s = document.createElement('style');
    s.id = 'stu-v3-css';
    s.textContent = `
    .stu-v3{position:fixed;inset:0;z-index:90;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);display:flex;align-items:stretch;justify-content:center;padding:max(env(safe-area-inset-top,0px),8px) 8px max(env(safe-area-inset-bottom,0px),8px);animation:stuIn .3s var(--ease)}
    .stu-v3[hidden]{display:none}
    @keyframes stuIn{from{opacity:0;transform:translateY(10px)}}
    @media(prefers-reduced-motion:reduce){.stu-v3{animation:none}}

    .stu-panel{position:relative;width:min(1200px,100%);max-height:100%;background:var(--bg-elev);color:var(--ink);border-radius:20px;box-shadow:var(--shadow-lg);border:1px solid var(--line-soft);display:flex;flex-direction:column;overflow:hidden}

    .stu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line-soft);background:color-mix(in srgb,var(--bg-elev) 80%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
    .stu-title{display:flex;align-items:center;gap:12px;min-width:0}
    .stu-title h3{margin:0;font-size:16px;font-weight:800;line-height:1.2;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stu-title span{display:block;font-size:11.5px;color:var(--ink-dim);font-weight:500;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stu-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent);flex-shrink:0}
    .stu-head-actions{display:flex;gap:6px}
    .stu-icon{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s var(--ease)}
    .stu-icon:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 45%,var(--line));background:var(--glass-strong)}
    .stu-icon:active{transform:scale(.92)}
    .stu-icon svg{width:17px;height:17px}
    .stu-icon-close:hover{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,var(--line))}

    .stu-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:0;flex:1;min-height:0}
    @media(max-width:900px){.stu-grid{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}}

    .stu-canvas-col{padding:16px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto}
    .stu-side{padding:16px;border-inline-start:1px solid var(--line-soft);display:flex;flex-direction:column;gap:14px;min-height:0;overflow-y:auto;background:color-mix(in srgb,var(--bg-sunk) 40%,transparent)}
    @media(max-width:900px){.stu-side{border-inline-start:0;border-top:1px solid var(--line-soft);max-height:45dvh}}

    .stu-scenes{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
    .stu-scenes::-webkit-scrollbar{display:none}
    .stu-scene{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:11px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s var(--ease);white-space:nowrap}
    .stu-scene:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 30%,var(--line-soft))}
    .stu-scene.on{background:var(--accent);color:var(--accent-ink);border-color:transparent;box-shadow:0 8px 22px -12px var(--accent)}
    .stu-scene svg{width:14px;height:14px}

    .stu-stage{position:relative;border-radius:16px;overflow:hidden;background:var(--bg-sunk);box-shadow:inset 0 0 0 1px var(--line-soft),0 18px 40px -22px rgba(0,0,0,.55);aspect-ratio:8/5}
    .stu-stage svg{width:100%;height:100%;display:block}
    .stu-stage .ly{cursor:pointer;transition:opacity .2s var(--ease)}
    .stu-stage .ly:hover{opacity:.94}
    .stu-stage .ly.sel{stroke:#fff;stroke-width:1.6;paint-order:stroke;stroke-dasharray:5 4;animation:selPulse 1.6s ease-in-out infinite}
    @keyframes selPulse{50%{stroke-opacity:.5}}

    .stu-lights{display:flex;gap:6px;background:var(--glass);border:1px solid var(--line-soft);border-radius:12px;padding:4px;width:fit-content}
    .stu-light{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:0;background:transparent;color:var(--ink-dim);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s var(--ease)}
    .stu-light:hover{color:var(--ink)}
    .stu-light.on{background:var(--bg-elev);color:var(--ink);box-shadow:var(--shadow-sm)}
    .stu-light svg{width:14px;height:14px}

    .stu-timeline{margin-top:2px}
    .stu-tl-inner{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;min-height:46px;align-items:center}
    .stu-tl-inner::-webkit-scrollbar{display:none}
    .stu-tl-item{flex:0 0 auto;width:46px;height:44px;border-radius:9px;border:1.5px solid var(--line-soft);background:var(--glass);overflow:hidden;cursor:pointer;transition:all .15s var(--ease);position:relative}
    .stu-tl-item:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--line-soft))}
    .stu-tl-item.on{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent)}
    .stu-tl-item svg{width:100%;height:100%;display:block}
    .stu-tl-empty{font-size:11.5px;color:var(--ink-faint);padding:14px 0}

    .stu-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .stu-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:var(--glass);color:var(--ink-dim);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s var(--ease);min-height:40px}
    .stu-btn:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
    .stu-btn:active{transform:scale(.96)}
    .stu-btn:disabled{opacity:.35;cursor:default;transform:none}
    .stu-btn svg{width:14px;height:14px}
    .stu-btn-primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:700}
    .stu-btn-primary:hover{background:var(--accent);color:var(--accent-ink);filter:brightness(1.05)}

    .stu-side-block{display:flex;flex-direction:column;gap:8px}
    .stu-side-grow{flex:1;min-height:0}
    .stu-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.4px}
    .stu-hint-sm{font-size:11px;font-weight:500;color:var(--ink-faint);text-transform:none;letter-spacing:0}

    .stu-palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px}
    .stu-sw{position:relative;aspect-ratio:1;border-radius:10px;border:2px solid var(--line-soft);background:var(--c);cursor:pointer;overflow:hidden;transition:all .15s var(--ease)}
    .stu-sw:hover{transform:translateY(-2px);box-shadow:0 8px 18px -10px rgba(0,0,0,.5)}
    .stu-sw.on{border-color:var(--ink);box-shadow:0 0 0 3px var(--accent)}
    .stu-sw .stu-sw-label{position:absolute;inset:auto 0 3px 0;text-align:center;font-size:9px;font-weight:800;color:var(--ink);mix-blend-mode:difference;letter-spacing:.3px;font-variant-numeric:tabular-nums}

    .stu-layers{display:flex;flex-direction:column;gap:4px;overflow-y:auto;max-height:260px;padding-inline-end:4px}
    .stu-layer{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:9px;border:1px solid transparent;background:transparent;cursor:pointer;transition:all .12s var(--ease);font-size:12.5px}
    .stu-layer:hover{background:var(--glass)}
    .stu-layer.on{background:var(--glass-strong);border-color:var(--accent)}
    .stu-layer i{width:18px;height:18px;border-radius:6px;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
    .stu-layer b{flex:1;font-weight:600;color:var(--ink)}
    .stu-layer span{font-size:10.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums;direction:ltr}
    .stu-layer button{background:none;border:0;color:var(--ink-faint);cursor:pointer;padding:2px;border-radius:5px;transition:color .12s}
    .stu-layer button:hover{color:var(--ink)}
    .stu-layer button.locked{color:var(--accent-text)}
    .stu-layer button svg{width:13px;height:13px}

    .stu-analysis{display:flex;flex-direction:column;gap:10px}
    .stu-an-row{display:flex;flex-direction:column;gap:5px}
    .stu-an-label{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-dim);font-weight:600}
    .stu-an-bar{height:6px;border-radius:4px;background:var(--glass-strong);overflow:hidden;display:flex}
    .stu-an-bar span{height:100%;transition:width .3s var(--ease)}
    .stu-an-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--glass-strong);font-size:11px;font-weight:700;color:var(--ink-dim)}
    .stu-an-pill b{color:var(--ink);font-weight:800}
    .stu-an-warn{display:flex;gap:8px;padding:8px 10px;border-radius:9px;font-size:11.5px;line-height:1.6;background:color-mix(in srgb,var(--danger) 12%,var(--glass));color:var(--ink-dim);border:1px solid color-mix(in srgb,var(--danger) 25%,transparent)}
    .stu-an-warn.info{background:color-mix(in srgb,var(--accent) 10%,var(--glass));border-color:color-mix(in srgb,var(--accent) 25%,transparent)}
    .stu-an-warn svg{width:14px;height:14px;flex-shrink:0;margin-top:2px}
    .stu-swatches{display:flex;gap:4px;flex-wrap:wrap}
    .stu-swatch-chip{width:22px;height:22px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}

    .stu-compare-bar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid var(--line-soft);background:var(--glass);font-size:12px;font-weight:600;color:var(--ink-dim)}
    .stu-compare-bar input[type=range]{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:var(--line);outline:none}
    .stu-compare-bar input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--accent);cursor:pointer;box-shadow:0 2px 8px -2px rgba(0,0,0,.4)}
    .stu-compare-bar input[type=range]::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:var(--accent);cursor:pointer}

    @media(max-width:520px){
      .stu-head{padding:10px 12px}
      .stu-canvas-col{padding:10px}
      .stu-side{padding:10px}
      .stu-title span{font-size:10.5px}
      .stu-tl-item{width:40px;height:38px}
    }
    `;
    document.head.appendChild(s);
  }

  /* ============================================================
     ۱۲) آیکون‌ها
     ============================================================ */
  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    sunrise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M5.6 8.6 8 11M2 15h4M18 15h4M16 11l2.4-2.4M3 20h18M6 15a6 6 0 0 1 12 0"/></svg>',
    sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9V3M5.6 12.6 3.2 15M2 20h4M18 20h4M16 12.6l2.4 2.4M3 20h18M6 20a6 6 0 0 1 12 0"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17V8a2 2 0 0 1 2-2h12a4 4 0 0 1 4 4v7M2 13h20M2 21v-4M22 21v-4"/></svg>',
    kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V3h16v18M4 12h16M9 7h.01M9 17h.01"/></svg>',
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V5a2 2 0 0 1 4 0M2 12h20v4a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM7 20v2M17 20v2"/></svg>',
    office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 20h8M12 17v3"/></svg>',
    cafe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/></svg>',
  };
  const SCENE_ICON = { living: 'home', bedroom: 'bed', kitchen: 'kitchen', bathroom: 'bath', office: 'office', cafe: 'cafe' };

  function toPersianNum(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  /* ============================================================
     ۱۳) تخصیص پیش‌فرض نقش‌ها
     ============================================================ */
  function ensureAssignment(sceneId) {
    const scene = SCENES[sceneId];
    if (!scene || !st.palette) return null;
    if (st.asgByScene[sceneId]) return st.asgByScene[sceneId];

    const auto = {};
    const pool = st.palette.colors;
    for (const layer of scene.layers) {
      if (!layer.role) continue;
      const idx = { L1: 4, L2: 3, M: 2, D: 1, K: 0, P: 2 }[layer.role] ?? 2;
      auto[layer.id] = Math.min(idx, pool.length - 1);
    }
    st.asgByScene[sceneId] = auto;
    return auto;
  }

  /* ============================================================
     ۱۴) رندر UI
     ============================================================ */
  function renderStage() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;

    stageEl.innerHTML = buildSVG(scene, asg, st.palette.colors, st.light, { selected: st.selected });

    // اتصال کلیک روی لایه‌ها
    stageEl.querySelectorAll('.ly').forEach(g => {
      g.addEventListener('click', () => {
        const id = g.dataset.l;
        st.selected = st.selected === id ? null : id;
        haptic.select();
        renderStage();
        renderLayers();
        renderPalette();
        updateSelHint();
      });
    });
  }

  function renderScenes() {
    const wrap = $('#stuScenes', root);
    wrap.innerHTML = Object.entries(SCENES).map(([id, s]) => `
      <button type="button" class="stu-scene ${id === st.sceneId ? 'on' : ''}" data-scene="${id}" role="tab" aria-selected="${id === st.sceneId}">
        ${ICONS[SCENE_ICON[id] || 'home']}
        <span>${s.name}</span>
      </button>
    `).join('');
  }

  function renderLights() {
    const wrap = $('#stuLights', root);
    wrap.innerHTML = Object.entries(LIGHTS).map(([id, l]) => `
      <button type="button" class="stu-light ${id === st.light ? 'on' : ''}" data-light="${id}" role="tab" aria-selected="${id === st.light}">
        ${ICONS[l.icon]}
        <span>${l.name}</span>
      </button>
    `).join('');
  }

  function renderPalette() {
    const wrap = $('#stuPalette', root);
    const asg = ensureAssignment(st.sceneId);
    if (!asg) { wrap.innerHTML = ''; return; }
    const currentIdx = st.selected ? asg[st.selected] : -1;
    wrap.innerHTML = st.palette.colors.map((hex, i) => `
      <button type="button" class="stu-sw ${i === currentIdx ? 'on' : ''}" data-pick="${i}" style="--c:${hex}" aria-label="رنگ ${hex}">
        <span class="stu-sw-label">${hex.replace('#','').toUpperCase()}</span>
      </button>
    `).join('');
  }

  function renderLayers() {
    const wrap = $('#stuLayers', root);
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;

    wrap.innerHTML = scene.layers.filter(l => l.role).map(l => {
      const hex = st.palette.colors[asg[l.id]] || '#888';
      const locked = st.lock.has(l.id);
      return `
        <div class="stu-layer ${st.selected === l.id ? 'on' : ''}" data-row="${l.id}">
          <i style="background:${hex}"></i>
          <b>${l.name}</b>
          <span>${hex.replace('#','').toUpperCase()}</span>
          <button type="button" data-lock="${l.id}" class="${locked ? 'locked' : ''}" aria-label="${locked ? 'بازکردن قفل' : 'قفل کردن'}">
            ${locked ? ICONS.lock : ICONS.unlock}
          </button>
        </div>
      `;
    }).join('');

    $('#stuLayerCount', root).textContent = `${scene.layers.filter(l => l.role).length} لایه`;
  }

  function renderAnalysis() {
    const wrap = $('#stuAnalysis', root);
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) { wrap.innerHTML = ''; return; }

    const an = computeAnalysis(scene, asg, st.palette.colors);

    const l1 = an.roleInfo.find(r => r.role === 'L1')?.pct || 0;
    const l2 = an.roleInfo.find(r => r.role === 'L2')?.pct || 0;
    const accent = an.roleInfo.find(r => r.role === 'P')?.pct || 0;

    let html = '';

    html += `
      <div class="stu-an-row">
        <div class="stu-an-label"><span>نسبتِ سطوح (هدف ۶۰/۳۰/۱۰)</span><span>${Math.round(l1 + l2 + accent)}٪</span></div>
        <div class="stu-an-bar">
          <span style="width:${l1}%;background:var(--accent)"></span>
          <span style="width:${l2}%;background:color-mix(in srgb,var(--accent) 55%,transparent)"></span>
          <span style="width:${accent}%;background:color-mix(in srgb,var(--accent) 30%,transparent)"></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums">
          <span>پایه ${Math.round(l1)}٪</span>
          <span>ثانویه ${Math.round(l2)}٪</span>
          <span>تأکید ${Math.round(accent)}٪</span>
        </div>
      </div>
    `;

    html += `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="stu-an-pill">هماهنگی <b>${toPersianNum(an.harmonyScore)}٪</b></span>
        <span class="stu-an-pill">${an.harmonyType}</span>
        <span class="stu-an-pill">تعادل <b>${toPersianNum(Math.round(an.balanceScore))}٪</b></span>
      </div>
    `;

    html += `<div class="stu-swatches">`;
    for (const c of an.colorStats.slice(0, 6)) {
      html += `<div class="stu-swatch-chip" style="background:${c.hex}" title="${c.hex} — LRV ${c.lrv}"></div>`;
    }
    html += `</div>`;

    if (an.warnings.length) {
      for (const w of an.warnings.slice(0, 3)) {
        const cls = w.level === 'warn' ? '' : 'info';
        html += `<div class="stu-an-warn ${cls}">${ICONS[w.level === 'warn' ? 'alert' : 'info']}<span>${w.text}</span></div>`;
      }
    } else {
      html += `<div class="stu-an-warn info" style="background:color-mix(in srgb,var(--accent) 10%,var(--glass));border-color:color-mix(in srgb,var(--accent) 25%,transparent)">${ICONS.info}<span>همه‌چیز متعادل است — LRV، کنتراست و نسبتِ سطوح در محدوده‌ی مطلوب.</span></div>`;
    }

    wrap.innerHTML = html;
    $('#stuAnalyBadge', root).textContent = `${an.harmonyType} · ${an.harmonyScore}٪`;
  }

  function renderTimeline() {
    const inner = $('#stuTlInner', root);
    if (!st.history.length) {
      inner.innerHTML = `<span class="stu-tl-empty">با اولین تغییر رنگ، تاریخچه اینجا ظاهر می‌شود.</span>`;
      return;
    }
    // هر مینیاتور با پیشوند یگانه رندر می‌شود تا با SVG اصلی تداخل ID نداشته باشد
    inner.innerHTML = st.history.map((h, i) => {
      const scene = SCENES[h.sceneId];
      const mini = buildSVG(scene, h.asg, st.palette.colors, st.light);
      return `<button type="button" class="stu-tl-item ${i === st.history.length - 1 ? 'on' : ''}" data-tl="${i}" aria-label="مرحله ${i + 1}">${mini}</button>`;
    }).join('');
    requestAnimationFrame(() => {
      inner.scrollTo({ left: inner.scrollWidth, behavior: 'smooth' });
    });
  }

  function updateSelHint() {
    const hint = $('#stuSelHint', root);
    if (!st.selected) {
      hint.textContent = 'روی صحنه یا لایه بزن';
      return;
    }
    const scene = SCENES[st.sceneId];
    const layer = scene.layers.find(l => l.id === st.selected);
    hint.textContent = layer ? `انتخاب: ${layer.name}` : 'انتخاب';
  }

  function renderAll() {
    if (!st.palette) return;
    renderScenes();
    renderStage();
    renderLights();
    renderPalette();
    renderLayers();
    renderAnalysis();
    renderTimeline();
    updateSelHint();

    const nameEl = $('#stuName', root);
    const metaEl = $('#stuMeta', root);
    if (nameEl) nameEl.textContent = st.palette.name;
    if (metaEl) metaEl.textContent = SCENES[st.sceneId].name + ' — ' + SCENES[st.sceneId].subtitle;

    const undoBtn = $('[data-a=undo]', root);
    const redoBtn = $('[data-a=redo]', root);
    if (undoBtn) undoBtn.disabled = !st.history.length;
    if (redoBtn) redoBtn.disabled = !st.future.length;
  }

  /* ============================================================
     ۱۵) عملیات
     ============================================================ */
  function pushHistory() {
    const sceneId = st.sceneId;
    const asg = JSON.parse(JSON.stringify(st.asgByScene[sceneId] || {}));
    st.history.push({ sceneId, asg });
    st.future = [];
    if (st.history.length > 12) st.history.shift();
  }

  function commitAssignment(newAsg) {
    pushHistory();
    st.asgByScene[st.sceneId] = newAsg;
    haptic.light();
    renderStage();
    renderPalette();
    renderLayers();
    renderAnalysis();
    renderTimeline();
  }

  function setLayerColor(layerId, idx) {
    const asg = ensureAssignment(st.sceneId);
    if (!asg || asg[layerId] === idx) return;
    const next = { ...asg, [layerId]: idx };
    commitAssignment(next);
    haptic.medium();
  }

  function doShuffle() {
    const scene = SCENES[st.sceneId];
    const locked = {};
    for (const id of st.lock) locked[id] = true;
    const out = smartShuffle(scene, st.palette.colors, locked);
    if (!out) return;
    const asg = ensureAssignment(st.sceneId);
    const next = { ...asg, ...out.result };
    commitAssignment(next);
    haptic.success();
    const label = out.strategy === 'mono' ? 'تک‌رنگ'
      : out.strategy === 'analogous' ? 'آنالوگ'
      : out.strategy === 'complementary' ? 'مکمل'
      : 'سه‌گانه';
    showStuToast(`بُر هوشمند اعمال شد — استراتژی: ${label}`);
  }

  function doUndo() {
    if (!st.history.length) return;
    const current = {
      sceneId: st.sceneId,
      asg: JSON.parse(JSON.stringify(st.asgByScene[st.sceneId] || {})),
    };
    st.future.push(current);
    const prev = st.history.pop();
    st.sceneId = prev.sceneId;
    st.asgByScene[prev.sceneId] = prev.asg;
    st.selected = null;
    haptic.light();
    renderAll();
  }

  function doRedo() {
    if (!st.future.length) return;
    const current = {
      sceneId: st.sceneId,
      asg: JSON.parse(JSON.stringify(st.asgByScene[st.sceneId] || {})),
    };
    st.history.push(current);
    const next = st.future.pop();
    st.sceneId = next.sceneId;
    st.asgByScene[next.sceneId] = next.asg;
    haptic.light();
    renderAll();
  }

  function doReset() {
    pushHistory();
    st.asgByScene[st.sceneId] = null;
    ensureAssignment(st.sceneId);
    st.lock.clear();
    st.selected = null;
    haptic.light();
    renderAll();
  }

  function jumpToHistory(idx) {
    if (idx < 0 || idx >= st.history.length) return;
    const target = st.history[idx];
    st.sceneId = target.sceneId;
    st.asgByScene[target.sceneId] = JSON.parse(JSON.stringify(target.asg));
    st.history = st.history.slice(0, idx);
    st.future = [];
    st.selected = null;
    haptic.light();
    renderAll();
  }

  function doCompare() {
    st.before = !st.before;
    const bar = $('#stuCompareBar', root);
    if (bar) bar.hidden = !st.before;
    if (st.before) {
      applyBeforeAfterPreview();
    } else {
      renderStage();
    }
    haptic.light();
  }

  function applyBeforeAfterPreview() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;

    // پالت خاکستری: نسخه‌ی neutral برای نمایش «قبل»
    const greyPalette = st.palette.colors.map((_, i) => {
      const v = Math.round(30 + (i / Math.max(1, st.palette.colors.length - 1)) * 170);
      return rgbToHex(v, v, v);
    });

    // هر دو با پیشوند یگانه رندر می‌شوند → تداخل ID ندارند
    const afterSvg = buildSVG(scene, asg, st.palette.colors, st.light);
    const beforeSvg = buildSVG(scene, asg, greyPalette, st.light);

    stageEl.innerHTML = `
      <div style="position:relative;width:100%;height:100%">
        <div style="position:absolute;inset:0">${afterSvg}</div>
        <div style="position:absolute;inset:0;clip-path:inset(0 ${100 - st.splitX}% 0 0)">${beforeSvg}</div>
        <div style="position:absolute;top:0;bottom:0;left:${st.splitX}%;width:2px;background:#fff;opacity:.6;box-shadow:0 0 8px rgba(0,0,0,.4);pointer-events:none"></div>
      </div>
    `;
  }

  async function doExport() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;

    const svg = buildSVG(scene, asg, st.palette.colors, st.light);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>${svg}`], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });

    const W = 2400, H = 1500;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);

    // قاب برند
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, H - 200, W, 200);
    ctx.fillStyle = '#fff';
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = '900 60px Vazirmatn, sans-serif';
    ctx.fillText(st.palette.name, W - 60, H - 120);
    ctx.font = '500 30px Vazirmatn, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`${scene.name} — ${LIGHTS[st.light].name}`, W - 60, H - 70);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.font = '800 40px Vazirmatn, sans-serif';
    ctx.fillStyle = '#6FE3C4';
    ctx.fillText('RAVAQ', 60, H - 90);

    // نوار پالت
    const swatchW = W / st.palette.colors.length;
    st.palette.colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * swatchW, H - 40, swatchW, 40);
    });

    URL.revokeObjectURL(url);
    cv.toBlob(async (b) => {
      const file = new File([b], `ravaq-${st.palette.id}-${st.sceneId}.png`, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: st.palette.name });
          haptic.success();
          return;
        }
      } catch (e) { if (e.name === 'AbortError') return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = file.name;
      a.click();
      showStuToast('تصویر با قاب برند رواق ذخیره شد');
      haptic.success();
    }, 'image/png');
  }

  let toastTimer = null;
  function showStuToast(msg) {
    let t = $('#stuToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'stuToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(60px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);background:var(--glass-strong);border:1px solid var(--line);color:var(--ink);padding:11px 18px;border-radius:999px;font-size:13px;font-weight:700;z-index:100;opacity:0;transition:all .3s var(--ease);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:var(--shadow-md);pointer-events:none;max-width:calc(100vw - 40px)';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translate(-50%,0)';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translate(-50%,20px)';
    }, 2200);
  }

  /* ============================================================
     ۱۶) مدیریت رویدادها
     ============================================================ */
  function bindEvents() {
    root.addEventListener('click', (e) => {
      const sceneBtn = e.target.closest('[data-scene]');
      if (sceneBtn) {
        const id = sceneBtn.dataset.scene;
        if (id !== st.sceneId) {
          pushHistory();
          st.sceneId = id;
          st.selected = null;
          ensureAssignment(id);
          haptic.light();
          renderAll();
        }
        return;
      }

      const lightBtn = e.target.closest('[data-light]');
      if (lightBtn) {
        st.light = lightBtn.dataset.light;
        haptic.light();
        renderStage();
        renderLights();
        if (st.before) applyBeforeAfterPreview();
        return;
      }

      const pickBtn = e.target.closest('[data-pick]');
      if (pickBtn) {
        const i = +pickBtn.dataset.pick;
        if (!st.selected) {
          showStuToast('اول یک لایه از لیست یا روی صحنه انتخاب کن');
          return;
        }
        setLayerColor(st.selected, i);
        return;
      }

      const lockBtn = e.target.closest('[data-lock]');
      if (lockBtn) {
        e.stopPropagation();
        const id = lockBtn.dataset.lock;
        st.lock.has(id) ? st.lock.delete(id) : st.lock.add(id);
        haptic.select();
        renderLayers();
        return;
      }

      const rowBtn = e.target.closest('[data-row]');
      if (rowBtn) {
        st.selected = st.selected === rowBtn.dataset.row ? null : rowBtn.dataset.row;
        haptic.select();
        renderStage();
        renderPalette();
        renderLayers();
        updateSelHint();
        return;
      }

      const tlBtn = e.target.closest('[data-tl]');
      if (tlBtn) {
        jumpToHistory(+tlBtn.dataset.tl);
        return;
      }

      const action = e.target.closest('[data-a]');
      if (action) {
        const a = action.dataset.a;
        if (a === 'close')    return close();
        if (a === 'shuffle')  return doShuffle();
        if (a === 'undo')     return doUndo();
        if (a === 'redo')     return doRedo();
        if (a === 'reset')    return doReset();
        if (a === 'compare')  return doCompare();
        if (a === 'export')   return doExport();
      }
    });

    // اسلایدر مقایسه (رویداد input در سطح document چون اسلایدر داخل stage تزریق نمی‌شود)
    document.addEventListener('input', (e) => {
      if (e.target?.id === 'stuSplit') {
        st.splitX = +e.target.value;
        if (st.before) applyBeforeAfterPreview();
      }
    });

    // کیبورد
    document.addEventListener('keydown', (e) => {
      if (!root || root.hidden) return;
      if (e.key === 'Escape') {
        if (st.selected) {
          st.selected = null;
          renderStage();
          renderLayers();
          renderPalette();
          updateSelHint();
        } else {
          close();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      }
    });
  }

  /* ============================================================
     ۱۷) باز/بسته
     ============================================================ */
  function open(paletteId) {
    // رفع باگ: در script.js، state با const تعریف شده و روی window نمی‌نشیند.
    // قبلاً این‌جا فقط window.state چک می‌شد که همیشه undefined بود → پنل باز نمی‌شد.
    const globalState = getGlobalState();
    const palettes = globalState && Array.isArray(globalState.palettes) ? globalState.palettes : [];
    const p = palettes.find(x => x.id === paletteId);

    if (!p) {
      showStuToast('پالت پیدا نشد');
      // لاگ مفید برای دیباگ
      try { console.warn('[ravaq-studio] palette not found:', paletteId, '| total palettes:', palettes.length); } catch (e) {}
      return;
    }

    if (!root) {
      root = buildShell();
      injectCSS();
      stageEl = $('#stuStage', root);
      bindEvents();
    }

    st.palette = p;
    st.sceneId = 'living';
    st.asgByScene = {};
    st.history = [];
    st.future = [];
    st.lock = new Set();
    st.selected = null;
    st.light = 'day';
    st.before = false;
    st.splitX = 50;

    // انتخاب صحنه‌ی مناسب بر اساس تگ‌های پالت
    const tags = (p.tags || []).join(' ');
    if (tags.includes('اتاق خواب')) st.sceneId = 'bedroom';
    else if (tags.includes('آشپزخانه')) st.sceneId = 'kitchen';
    else if (tags.includes('حمام')) st.sceneId = 'bathroom';
    else if (tags.includes('اداری') || tags.includes('کتابخانه')) st.sceneId = 'office';
    else if (tags.includes('کافه')) st.sceneId = 'cafe';

    ensureAssignment(st.sceneId);

    root.hidden = false;
    document.body.style.overflow = 'hidden';
    renderAll();
    haptic.medium();
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    document.body.style.overflow = '';
    // بستن مقایسه‌ی قبل/بعد
    st.before = false;
    const bar = $('#stuCompareBar', root);
    if (bar) bar.hidden = true;
    haptic.light();
  }

  /* ============================================================
     ۱۸) اتصال به کارت‌های پالت
     ============================================================ */
  function decorate() {
    $$('.pal').forEach(card => {
      const box = $('.pal-actions', card);
      if (!box || $('.act-studio', box)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act act-studio';
      b.dataset.studio = card.dataset.id;
      b.innerHTML = '<span>امتحان در فضا</span>';
      box.appendChild(b);
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-studio]');
    if (!b) return;
    // محافظت: اگر palettes هنوز بارگذاری نشده، به کاربر پیام می‌دهیم
    const gs = getGlobalState();
    if (!gs || !Array.isArray(gs.palettes) || gs.palettes.length === 0) {
      showStuToast('هنوز پالت‌ها بارگذاری نشده‌اند — یک لحظه صبر کن');
      return;
    }
    open(b.dataset.studio);
  });

  const list = document.getElementById('list');
  if (list) {
    new MutationObserver(decorate).observe(list, { childList: true });
    decorate();
  }

  // API عمومی برای دیباگ
  window.__ravaqStudio = {
    open,
    close,
    get SCENES() { return SCENES; },
    get LIGHTS() { return LIGHTS; },
    get state() { return st; },
  };
})();