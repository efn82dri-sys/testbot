/* ============================================================
   رواق — استودیو چیدمان (نسخه ۵ — واقع‌گرایی)
   سبک: نمای روبه‌روی flat illustration، هندسه تمیز
   ============================================================ */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const tg = window.Telegram?.WebApp || null;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- ابزارهای پایه ---------- */
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
    return { h, s: mx === 0 ? 0 : d / mx, v: mx };
  }

  function contrast(a, b) {
    const la = relLum(a), lb = relLum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function popIndex(palette) {
    let best = 1, bestSat = -1;
    for (let i = 0; i < palette.length; i++) {
      const s = saturation(palette[i]);
      if (s > bestSat) { bestSat = s; best = i; }
    }
    return best;
  }

  /* ============================================================
     متریال — سیستم سبک برای هدایت گرادیان‌ها و هایلایت
     ============================================================ */
  const MAT = {
    wall:      { hl: 0.10, warm: 0.00, rough: 0.95 },
    wallGloss: { hl: 0.18, warm: 0.02, rough: 0.55 },
    stucco:    { hl: 0.08, warm: 0.02, rough: 0.95 },
    concrete:  { hl: 0.10, warm: -0.03, rough: 0.90 },
    wood:      { hl: 0.16, warm: 0.05, rough: 0.60 },
    woodDark:  { hl: 0.14, warm: 0.04, rough: 0.60 },
    marble:    { hl: 0.30, warm: 0.01, rough: 0.30 },
    tile:      { hl: 0.22, warm: 0.00, rough: 0.30 },
    fabric:    { hl: 0.08, warm: 0.02, rough: 0.95 },
    velvet:    { hl: 0.20, warm: 0.05, rough: 0.55 },
    leather:   { hl: 0.24, warm: 0.04, rough: 0.45 },
    metal:     { hl: 0.40, warm: 0.02, rough: 0.25 },
    brass:     { hl: 0.35, warm: 0.10, rough: 0.30 },
    plant:     { hl: 0.12, warm: 0.00, rough: 0.85 },
    art:       { hl: 0.18, warm: 0.02, rough: 0.40 },
    rug:       { hl: 0.06, warm: 0.03, rough: 0.98 },
    glass:     { hl: 0.55, warm: -0.02, rough: 0.10 },
  };

  /* ============================================================
     قاب اتاق — نمای روبه‌رو
     ============================================================ */
  const FR = {
    wall:      'M0,0 L800,0 L800,340 L0,340 Z',
    baseboard: 'M0,318 L800,318 L800,340 L0,340 Z',
    floor:     'M0,340 L800,340 L800,500 L0,500 Z',
    crown:     'M0,0 L800,0 L800,14 L0,14 Z',
  };

  /* ============================================================
     صحنه‌ها — همه در فریم روبه‌رو، گرید ۸۰۰×۵۰۰
     ============================================================ */
  const SCENES = {
    /* ------------------------------------------------ نشیمن */
    living: {
      name: 'نشیمنِ مدرن',
      subtitle: 'نمایِ روبه‌رو — پنجره‌یِ جنوبی',
      layers: [
        // ---- پایه ----
        { id: 'wall',      name: 'دیوار',        role: 'L1', mat: 'wall',
          parts: [FR.wall] },
        { id: 'crown',     name: 'قرنیزِ سقف',   role: 'K',  mat: 'wood',
          parts: [FR.crown] },
        { id: 'window',    name: 'پنجره',         role: 'L2', mat: 'glass',
          parts: ['M80,90 L250,90 L250,300 L80,300 Z'] },
        { id: 'curtain_l', name: 'پرده‌یِ چپ',    role: 'P',  mat: 'fabric',
          parts: ['M45,75 L95,75 L95,315 L45,315 Z'] },
        { id: 'curtain_r', name: 'پرده‌یِ راست',  role: 'P',  mat: 'fabric',
          parts: ['M235,75 L285,75 L285,315 L235,315 Z'] },
        { id: 'art',       name: 'تابلو',          role: 'P',  mat: 'art',
          parts: ['M345,110 L455,110 L455,205 L345,205 Z'] },
        { id: 'floor',     name: 'کف پارکت',      role: 'M',  mat: 'wood',
          parts: [FR.floor], texture: 'wood-plank' },
        { id: 'rug',       name: 'فرش',            role: 'L2', mat: 'rug',
          parts: ['M140,428 L660,428 L700,478 L100,478 Z'] },
        // ---- مبل ----
        { id: 'sofa',      name: 'مبل',            role: 'D',  mat: 'fabric',
          parts: [
            'M240,255 L560,255 L560,345 L240,345 Z',           // پشتِ مبل
            'M200,270 Q200,255 215,255 L240,255 L240,410 L200,410 Z', // دسته‌ی چپ
            'M560,255 L585,255 Q600,255 600,270 L600,410 L560,410 Z', // دسته‌ی راست
          ] },
        { id: 'sofa_seat', name: 'نشیمنِ مبل',    role: 'L2', mat: 'fabric',
          parts: [
            'M215,335 L390,335 L390,410 L215,410 Z',
            'M410,335 L585,335 L585,410 L410,410 Z',
          ] },
        { id: 'cushions',  name: 'کوسن',           role: 'P',  mat: 'velvet',
          parts: [
            'M250,300 L315,300 L322,345 L245,345 Z',
            'M485,300 L550,300 L557,345 L480,345 Z',
          ] },
        // ---- میز و دکور ----
        { id: 'table',     name: 'میزِ جلومبلی',   role: 'K',  mat: 'woodDark',
          parts: [
            'M295,442 L505,442 L520,462 L280,462 Z',
            'M305,462 L495,462 L495,490 L305,490 Z',
          ] },
        { id: 'plant_pot', name: 'گلدان',          role: 'P',  mat: 'plant',
          parts: ['M690,390 L740,390 L735,458 L695,458 Z'] },
        { id: 'plant_leaf', name: 'برگ‌ها',         role: 'P',  mat: 'plant',
          parts: [
            'M715,390 Q700,360 685,350 Q705,365 713,388 Z',
            'M718,390 Q730,355 745,345 Q730,365 722,388 Z',
            'M716,390 Q718,360 715,340 Q712,362 712,388 Z',
            'M714,390 Q725,362 735,352 Q722,372 718,388 Z',
          ] },
        { id: 'lamp_base', name: 'پایه‌یِ آباژور',  role: 'K',  mat: 'metal',
          parts: [
            'M118,465 L168,465 L168,478 L118,478 Z',
            'M140,300 L146,300 L146,465 L140,465 Z',
          ] },
        { id: 'lamp_shade', name: 'شفره‌یِ آباژور', role: 'L2', mat: 'fabric',
          parts: ['M112,258 L174,258 L188,300 L98,300 Z'] },
      ],
      shadows: [
        { cx: 400, cy: 412, rx: 200, ry: 8,  op: 0.20 },   // زیر مبل
        { cx: 400, cy: 492, rx: 110, ry: 6,  op: 0.18 },   // زیر میز
        { cx: 715, cy: 460, rx: 28,  ry: 5,  op: 0.18 },   // زیر گلدان
        { cx: 143, cy: 480, rx: 30,  ry: 4,  op: 0.18 },   // زیر آباژور
      ],
      details: [
        // لبه‌یِ بیرونیِ پنجره
        { d: 'M80,90 L250,90 L250,300 L80,300 Z', stroke: '#000', strokeOp: 0.20, sw: 1.5 },
        // صلیبِ پنجره
        { d: 'M165,90 L165,300 M80,195 L250,195', stroke: '#000', strokeOp: 0.18, sw: 1.2 },
        // خطوطِ داخلِ پرده
        { d: 'M60,90 Q70,150 60,220 Q50,280 62,310', stroke: '#000', strokeOp: 0.10, sw: 1 },
        { d: 'M270,90 Q260,150 270,220 Q280,280 268,310', stroke: '#000', strokeOp: 0.10, sw: 1 },
        // خطِ قابِ تابلو
        { d: 'M345,110 L455,110 L455,205 L345,205 Z', stroke: '#000', strokeOp: 0.15, sw: 1 },
        // خطِ قرنیز
        { d: 'M0,318 L800,318', stroke: '#000', strokeOp: 0.15, sw: 1 },
        // جداکننده‌یِ کوسن‌های پشتِ مبل
        { d: 'M400,255 L400,345', stroke: '#000', strokeOp: 0.10, sw: 1 },
        // خطِ میزِ چوبی
        { d: 'M280,462 L520,462', stroke: '#000', strokeOp: 0.12, sw: 1 },
      ],
    },

    /* ------------------------------------------------ اتاق خواب */
    bedroom: {
      name: 'اتاقِ خوابِ گرم',
      subtitle: 'دیوارِ تخت با تاجِ مخملی — نورِ عصر',
      layers: [
        { id: 'wall',      name: 'دیوار',        role: 'L1', mat: 'wall',
          parts: [FR.wall] },
        { id: 'accent',    name: 'دیوارِ تأکیدی', role: 'D',  mat: 'wallGloss',
          parts: ['M180,60 L620,60 L620,340 L180,340 Z'] },
        { id: 'crown',     name: 'قرنیزِ سقف',   role: 'K',  mat: 'wood',
          parts: [FR.crown] },
        { id: 'art',       name: 'تابلو',          role: 'P',  mat: 'art',
          parts: ['M345,90 L455,90 L455,150 L345,150 Z'] },
        { id: 'floor',     name: 'کف',             role: 'M',  mat: 'wood',
          parts: [FR.floor], texture: 'wood-plank' },
        { id: 'rug',       name: 'فرش',            role: 'L2', mat: 'rug',
          parts: ['M120,430 L680,430 L710,478 L90,478 Z'] },
        // ---- تخت ----
        { id: 'headboard', name: 'تاجِ تخت',      role: 'K',  mat: 'velvet',
          parts: [
            'M200,180 L600,180 L600,285 L200,285 Z',
            'M200,180 L215,165 L585,165 L600,180 Z',
          ] },
        { id: 'bedbody',   name: 'بدنه‌یِ تخت',   role: 'D',  mat: 'fabric',
          parts: ['M200,285 L600,285 L600,410 L200,410 Z'] },
        { id: 'duvet',     name: 'روتختی',        role: 'M',  mat: 'fabric',
          parts: ['M200,310 L600,310 L600,410 L200,410 Z'] },
        { id: 'pillow_l',  name: 'بالشِ چپ',      role: 'L1', mat: 'fabric',
          parts: ['M225,255 L340,255 L345,305 L220,305 Z'] },
        { id: 'pillow_r',  name: 'بالشِ راست',    role: 'L1', mat: 'fabric',
          parts: ['M455,255 L570,255 L575,305 L450,305 Z'] },
        { id: 'throw',     name: 'پتویِ تزئینی',  role: 'P',  mat: 'velvet',
          parts: ['M365,310 L525,310 L535,395 L355,395 Z'] },
        // ---- پاتختی‌ها ----
        { id: 'night_l',   name: 'پاتختی چپ',     role: 'K',  mat: 'wood',
          parts: ['M110,320 L180,320 L180,412 L110,412 Z'] },
        { id: 'night_r',   name: 'پاتختی راست',   role: 'K',  mat: 'wood',
          parts: ['M620,320 L690,320 L690,412 L620,412 Z'] },
        // ---- آباژورها ----
        { id: 'lamp_l',    name: 'آباژورِ چپ',    role: 'P',  mat: 'brass',
          parts: [
            'M138,308 L152,308 L152,320 L138,320 Z',
            'M120,278 L170,278 L165,308 L125,308 Z',
          ] },
        { id: 'lamp_r',    name: 'آباژورِ راست',  role: 'P',  mat: 'brass',
          parts: [
            'M648,308 L662,308 L662,320 L648,320 Z',
            'M630,278 L680,278 L675,308 L635,308 Z',
          ] },
      ],
      shadows: [
        { cx: 400, cy: 415, rx: 210, ry: 9, op: 0.22 },
        { cx: 400, cy: 492, rx: 160, ry: 7, op: 0.16 },
        { cx: 145, cy: 415, rx: 40,  ry: 5, op: 0.18 },
        { cx: 655, cy: 415, rx: 40,  ry: 5, op: 0.18 },
      ],
      details: [
        { d: 'M200,180 L600,180 L600,285 L200,285 Z', stroke: '#000', strokeOp: 0.12, sw: 1.2 },
        { d: 'M200,285 L600,285', stroke: '#000', strokeOp: 0.15, sw: 1 },
        { d: 'M200,310 L600,310', stroke: '#000', strokeOp: 0.10, sw: 1 },
        { d: 'M0,318 L800,318', stroke: '#000', strokeOp: 0.12, sw: 1 },
        { d: 'M110,320 L110,412 M180,320 L180,412', stroke: '#000', strokeOp: 0.10, sw: 0.8 },
        { d: 'M620,320 L620,412 M690,320 L690,412', stroke: '#000', strokeOp: 0.10, sw: 0.8 },
        { d: 'M345,90 L455,90 L455,150 L345,150 Z', stroke: '#000', strokeOp: 0.15, sw: 1 },
      ],
    },

    /* ------------------------------------------------ آشپزخانه */
    kitchen: {
      name: 'آشپزخانه‌یِ مدرن',
      subtitle: 'نمایِ روبه‌رو — نورِ روز',
      layers: [
        { id: 'wall',      name: 'دیوار',         role: 'L1', mat: 'wall',
          parts: [FR.wall] },
        { id: 'upper',     name: 'کابینتِ بالا',   role: 'L2', mat: 'wallGloss',
          parts: [
            'M40,40 L250,40 L250,140 L40,140 Z',
            'M280,40 L490,40 L490,140 L280,140 Z',
            'M520,40 L760,40 L760,140 L520,140 Z',
          ] },
        { id: 'splash',    name: 'میان‌کابینتی',   role: 'L1', mat: 'tile',
          parts: ['M40,140 L760,140 L760,220 L40,220 Z'] },
        { id: 'floor',     name: 'کف',             role: 'K',  mat: 'tile',
          parts: [FR.floor], texture: 'tile' },
        { id: 'counter',   name: 'سنگِ کانتر',    role: 'M',  mat: 'marble',
          parts: ['M20,220 L780,220 L780,242 L20,242 Z'] },
        { id: 'lower',     name: 'کابینتِ پایین', role: 'D',  mat: 'wallGloss',
          parts: ['M40,242 L760,242 L760,400 L40,400 Z'] },
        { id: 'hardware',  name: 'دستگیره‌ها',    role: 'P',  mat: 'brass',
          parts: [
            'M120,300 L127,300 L127,345 L120,345 Z',
            'M162,300 L169,300 L169,345 L162,345 Z',
            'M400,300 L407,300 L407,345 L400,345 Z',
            'M442,300 L449,300 L449,345 L442,345 Z',
            'M562,300 L569,300 L569,345 L562,345 Z',
            'M604,300 L611,300 L611,345 L604,345 Z',
            'M720,300 L727,300 L727,345 L720,345 Z',
          ] },
        { id: 'hood',      name: 'هود',            role: 'P',  mat: 'metal',
          parts: ['M320,8 L480,8 L460,45 L340,45 Z'] },
        { id: 'faucet',    name: 'شیرآلات',        role: 'P',  mat: 'brass',
          parts: [
            'M395,200 L405,200 L405,222 L395,222 Z',
            'M400,200 Q400,178 418,178 L435,178 L435,188 L423,188 Q412,188 412,200 Z',
          ] },
        { id: 'rug',       name: 'زیرپایی',        role: 'L2', mat: 'rug',
          parts: ['M300,430 L500,430 L530,478 L270,478 Z'] },
      ],
      shadows: [
        { cx: 400, cy: 402, rx: 380, ry: 6, op: 0.20 },
        { cx: 400, cy: 482, rx: 130, ry: 5, op: 0.18 },
      ],
      details: [
        // جداکننده‌یِ کابینت‌های بالا
        { d: 'M250,40 L250,140 M280,40 L280,140 M490,40 L490,140 M520,40 L520,140',
          stroke: '#000', strokeOp: 0.12, sw: 1 },
        // خطِ کفِ کابینت‌هایِ بالا
        { d: 'M40,140 L760,140', stroke: '#000', strokeOp: 0.14, sw: 1 },
        // لبه‌یِ بالایِ سنگ کانتر
        { d: 'M20,220 L780,220', stroke: '#000', strokeOp: 0.14, sw: 1 },
        // جداکننده‌یِ درهایِ کابینتِ پایین
        { d: 'M250,242 L250,400 M490,242 L490,400', stroke: '#000', strokeOp: 0.10, sw: 1 },
      ],
    },

    /* ------------------------------------------------ حمام */
    bathroom: {
      name: 'حمامِ اسپا',
      subtitle: 'دیوارِ کاشی — روشوییِ مرمری',
      layers: [
        { id: 'wall',     name: 'دیوارِ کاشی',   role: 'L1', mat: 'tile',
          parts: [FR.wall] },
        { id: 'accent',   name: 'دیوارِ تأکیدی', role: 'D',  mat: 'tile',
          parts: ['M240,60 L560,60 L560,340 L240,340 Z'] },
        { id: 'mirror',   name: 'آینه',           role: 'L2', mat: 'glass',
          parts: ['M320,80 L480,80 L480,220 L320,220 Z'] },
        { id: 'floor',    name: 'کفِ کاشی',      role: 'M',  mat: 'tile',
          parts: [FR.floor], texture: 'tile' },
        { id: 'vanity',   name: 'کابینتِ روشویی', role: 'L2', mat: 'wood',
          parts: ['M300,242 L500,242 L500,400 L300,400 Z'] },
        { id: 'basin',    name: 'روشویی',         role: 'P',  mat: 'marble',
          parts: ['M310,225 L490,225 Q495,225 495,235 L495,258 L305,258 L305,235 Q305,225 310,225 Z'] },
        { id: 'faucet',   name: 'شیرآلات',        role: 'P',  mat: 'brass',
          parts: [
            'M395,200 L405,200 L405,228 L395,228 Z',
            'M400,200 Q400,180 415,180 L430,180 L430,190 L420,190 Q410,190 410,200 Z',
          ] },
        { id: 'towel_1',  name: 'حوله‌ها',         role: 'P',  mat: 'fabric',
          parts: ['M632,155 L682,155 L682,215 L632,215 Z'] },
        { id: 'towel_2',  name: 'حوله‌ها',         role: 'P',  mat: 'fabric',
          parts: ['M635,220 L678,220 L678,285 L635,285 Z'] },
        { id: 'mat',      name: 'زیرپایی',         role: 'P',  mat: 'rug',
          parts: ['M310,420 L490,420 L520,470 L280,470 Z'] },
      ],
      shadows: [
        { cx: 400, cy: 405, rx: 130, ry: 7, op: 0.22 },
        { cx: 400, cy: 475, rx: 120, ry: 5, op: 0.16 },
      ],
      details: [
        { d: 'M320,80 L480,80 L480,220 L320,220 Z', stroke: '#000', strokeOp: 0.18, sw: 1.4 },
        { d: 'M240,60 L560,60', stroke: '#000', strokeOp: 0.10, sw: 1 },
        { d: 'M300,242 L500,242', stroke: '#000', strokeOp: 0.12, sw: 1 },
        { d: 'M632,155 L632,290 M632,155 L695,155', stroke: '#000', strokeOp: 0.20, sw: 1.6 },
      ],
    },

    /* ------------------------------------------------ اتاق کار */
    office: {
      name: 'اتاقِ کارِ مینیمال',
      subtitle: 'میزِ چوبی — قفسه‌یِ کتاب',
      layers: [
        { id: 'wall',      name: 'دیوار',        role: 'L1', mat: 'wall',
          parts: [FR.wall] },
        { id: 'crown',     name: 'قرنیزِ سقف',   role: 'K',  mat: 'wood',
          parts: [FR.crown] },
        { id: 'art',       name: 'تابلو',          role: 'P',  mat: 'art',
          parts: ['M325,110 L475,110 L475,215 L325,215 Z'] },
        { id: 'floor',     name: 'کف',             role: 'M',  mat: 'wood',
          parts: [FR.floor], texture: 'wood-plank' },
        { id: 'rug',       name: 'فرش',            role: 'L2', mat: 'rug',
          parts: ['M230,438 L570,438 L600,483 L200,483 Z'] },
        // قفسه‌یِ کتاب
        { id: 'shelf',     name: 'کتابخانه',      role: 'K',  mat: 'wood',
          parts: ['M620,80 L760,80 L760,400 L620,400 Z'] },
        { id: 'books',     name: 'کتاب‌ها',        role: 'P',  mat: 'fabric',
          parts: [
            'M635,110 L660,110 L660,175 L635,175 Z',
            'M665,120 L685,120 L685,175 L665,175 Z',
            'M690,105 L710,105 L710,175 L690,175 Z',
            'M715,115 L735,115 L735,175 L715,175 Z',
            'M635,200 L655,200 L655,255 L635,255 Z',
            'M660,210 L680,210 L680,255 L660,255 Z',
            'M685,195 L710,195 L710,255 L685,255 Z',
            'M635,285 L660,285 L660,340 L635,340 Z',
            'M665,295 L685,295 L685,340 L665,340 Z',
          ] },
        // میزِ کار
        { id: 'desk',      name: 'میزِ کار',       role: 'D',  mat: 'woodDark',
          parts: [
            'M170,325 L630,325 L630,342 L170,342 Z',
            'M180,342 L192,342 L192,412 L180,412 Z',
            'M608,342 L620,342 L620,412 L608,412 Z',
          ] },
        { id: 'monitor',   name: 'مانیتور',        role: 'P',  mat: 'metal',
          parts: [
            'M345,240 L455,240 L455,308 L345,308 Z',
            'M392,308 L408,308 L408,320 L392,320 Z',
            'M365,320 L435,320 L435,328 L365,328 Z',
          ] },
        { id: 'chair',     name: 'صندلی',          role: 'K',  mat: 'velvet',
          parts: [
            'M365,352 L435,352 L435,398 L365,398 Z',
            'M355,395 L445,395 L445,415 L355,415 Z',
            'M370,415 L378,415 L378,440 L370,440 Z',
            'M422,415 L430,415 L430,440 L422,440 Z',
          ] },
        { id: 'plant_pot', name: 'گلدان',          role: 'P',  mat: 'plant',
          parts: ['M90,330 L150,330 L145,412 L95,412 Z'] },
        { id: 'plant_leaf', name: 'برگ‌ها',         role: 'P',  mat: 'plant',
          parts: [
            'M120,330 Q105,300 88,290 Q108,308 116,328 Z',
            'M122,330 Q135,295 152,285 Q136,308 126,328 Z',
            'M120,330 Q122,300 118,278 Q114,304 114,328 Z',
            'M121,330 Q132,303 142,295 Q128,315 124,328 Z',
          ] },
        { id: 'lamp',      name: 'آباژورِ رومیزی', role: 'L2', mat: 'metal',
          parts: [
            'M475,300 L485,300 L485,325 L475,325 Z',
            'M465,272 L495,272 L490,302 L470,302 Z',
          ] },
      ],
      shadows: [
        { cx: 400, cy: 415, rx: 240, ry: 7, op: 0.20 },
        { cx: 400, cy: 443, rx: 55,  ry: 5, op: 0.20 },
        { cx: 690, cy: 403, rx: 80,  ry: 6, op: 0.18 },
        { cx: 120, cy: 415, rx: 35,  ry: 5, op: 0.18 },
      ],
      details: [
        { d: 'M325,110 L475,110 L475,215 L325,215 Z', stroke: '#000', strokeOp: 0.15, sw: 1 },
        { d: 'M620,175 L760,175 M620,255 L760,255 M620,340 L760,340', stroke: '#000', strokeOp: 0.10, sw: 1 },
        { d: 'M170,325 L630,325', stroke: '#000', strokeOp: 0.12, sw: 1 },
        { d: 'M345,240 L455,240 L455,308 L345,308 Z', stroke: '#000', strokeOp: 0.15, sw: 1.2 },
        { d: 'M0,318 L800,318', stroke: '#000', strokeOp: 0.12, sw: 1 },
      ],
    },

    /* ------------------------------------------------ کافه */
    cafe: {
      name: 'کافه‌یِ گرم',
      subtitle: 'کانترِ چوبی — نورِ آویز',
      layers: [
        { id: 'wall',      name: 'دیوار',        role: 'L1', mat: 'stucco',
          parts: [FR.wall] },
        { id: 'brick',     name: 'دیوارِ آجری',  role: 'D',  mat: 'concrete',
          parts: ['M0,0 L800,0 L800,115 L0,115 Z'] },
        { id: 'floor',     name: 'کفِ کافه',     role: 'K',  mat: 'tile',
          parts: [FR.floor], texture: 'tile' },
        // قفسه و بطری‌ها
        { id: 'shelf',     name: 'قفسه',          role: 'D',  mat: 'woodDark',
          parts: [
            'M120,120 L680,120 L680,140 L120,140 Z',
            'M120,180 L680,180 L680,200 L120,200 Z',
          ] },
        { id: 'bottles',   name: 'بطری‌ها',        role: 'P',  mat: 'glass',
          parts: [
            'M150,80 L165,80 L165,120 L150,120 Z',
            'M180,90 L195,90 L195,120 L180,120 Z',
            'M215,85 L230,85 L230,120 L215,120 Z',
            'M250,95 L265,95 L265,120 L250,120 Z',
            'M500,85 L515,85 L515,120 L500,120 Z',
            'M540,95 L555,95 L555,120 L540,120 Z',
            'M575,90 L590,90 L590,120 L575,120 Z',
          ] },
        // کانتر
        { id: 'counter',   name: 'کانترِ چوبی',  role: 'M',  mat: 'wood',
          parts: ['M80,240 L720,240 L720,398 L80,398 Z'] },
        { id: 'counter_top', name: 'سنگِ کانتر', role: 'L2', mat: 'marble',
          parts: ['M70,228 L730,228 L730,242 L70,242 Z'] },
        // صندلی‌ها
        { id: 'stool_1',   name: 'صندلی',         role: 'K',  mat: 'leather',
          parts: [
            'M150,400 L200,400 L200,415 L150,415 Z',
            'M158,415 L166,415 L166,465 L158,465 Z',
            'M184,415 L192,415 L192,465 L184,465 Z',
          ] },
        { id: 'stool_2',   name: 'صندلی',         role: 'K',  mat: 'leather',
          parts: [
            'M300,400 L350,400 L350,415 L300,415 Z',
            'M308,415 L316,415 L316,465 L308,465 Z',
            'M334,415 L342,415 L342,465 L334,465 Z',
          ] },
        { id: 'stool_3',   name: 'صندلی',         role: 'K',  mat: 'leather',
          parts: [
            'M450,400 L500,400 L500,415 L450,415 Z',
            'M458,415 L466,415 L466,465 L458,465 Z',
            'M484,415 L492,415 L492,465 L484,465 Z',
          ] },
        { id: 'stool_4',   name: 'صندلی',         role: 'K',  mat: 'leather',
          parts: [
            'M600,400 L650,400 L650,415 L600,415 Z',
            'M608,415 L616,415 L616,465 L608,465 Z',
            'M634,415 L642,415 L642,465 L634,465 Z',
          ] },
        // چراغ‌هایِ آویز
        { id: 'pendant_1', name: 'چراغِ آویز',    role: 'P',  mat: 'brass',
          parts: [
            'M180,0 L180,55 L184,55 L184,0 Z',
            'M160,55 L204,55 L212,100 L152,100 Z',
          ] },
        { id: 'pendant_2', name: 'چراغِ آویز',    role: 'P',  mat: 'brass',
          parts: [
            'M400,0 L400,55 L404,55 L404,0 Z',
            'M380,55 L424,55 L432,100 L372,100 Z',
          ] },
        { id: 'pendant_3', name: 'چراغِ آویز',    role: 'P',  mat: 'brass',
          parts: [
            'M620,0 L620,55 L624,55 L624,0 Z',
            'M600,55 L644,55 L652,100 L592,100 Z',
          ] },
      ],
      shadows: [
        { cx: 400, cy: 400, rx: 330, ry: 8, op: 0.22 },
        { cx: 175, cy: 466, rx: 28,  ry: 4, op: 0.20 },
        { cx: 325, cy: 466, rx: 28,  ry: 4, op: 0.20 },
        { cx: 475, cy: 466, rx: 28,  ry: 4, op: 0.20 },
        { cx: 625, cy: 466, rx: 28,  ry: 4, op: 0.20 },
      ],
      details: [
        { d: 'M0,115 L800,115', stroke: '#000', strokeOp: 0.18, sw: 1.5 },
        { d: 'M120,120 L680,120', stroke: '#000', strokeOp: 0.15, sw: 1 },
        { d: 'M120,180 L680,180', stroke: '#000', strokeOp: 0.12, sw: 1 },
        { d: 'M70,228 L730,228 L730,242 L70,242 Z', stroke: '#000', strokeOp: 0.12, sw: 1 },
        // خطوطِ عمودیِ کانتر
        { d: 'M240,240 L240,398 M400,240 L400,398 M560,240 L560,398',
          stroke: '#000', strokeOp: 0.08, sw: 1 },
      ],
    },
  };

  const LIGHTS = {
    dawn:  { name: 'صبح', icon: 'sunrise', tint: 'rgba(255, 210, 160, 0.08)' },
    day:   { name: 'روز',  icon: 'sun',     tint: 'rgba(255, 250, 240, 0.00)' },
    dusk:  { name: 'عصر', icon: 'sunset',  tint: 'rgba(255, 170, 100, 0.12)' },
    night: { name: 'شب',  icon: 'moon',    tint: 'rgba(60, 80, 130, 0.28)' },
  };

  /* ============================================================
     موتور رندر
     ============================================================ */
  const KELVIN = { 2700: '#FFB46B', 3000: '#FFC98E', 4000: '#FFE3C2', 6500: '#E4EEFF' };

  function lightOverlay(c, id) {
    const t = c.t;
    const sv = t >= 20 ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
    const k = Math.min(1, sv * 2);
    const warm = (0.24 * (1 - k) * (t > 13 ? 1.3 : 1)).toFixed(3);
    const night = (0.32 * (1 - Math.min(1, sv * 3.2))).toFixed(3);
    const R = (fill) => `<rect width="800" height="500" fill="${fill}" pointer-events="none"/>`;
    let html = R(`rgba(255,170,100,${warm})`) + R(`rgba(45,65,125,${night})`);
    if (c.wx === 'ابری') html += R('rgba(140,150,168,0.12)');
    if (c.dir === 'شمالی') html += R('rgba(110,140,205,0.07)');
    else if (c.dir === 'جنوبی') html += R('rgba(255,214,150,0.05)');
    const lampOn = (c.lamp === null || c.lamp === undefined) ? sv < 0.2 : !!c.lamp;
    let defs = '';
    if (lampOn) {
      const col = KELVIN[c.kelvin] || KELVIN[3000];
      defs = `<radialGradient id="${id('lamp')}" cx="0.5" cy="0" r="0.75"><stop offset="0" stop-color="${col}" stop-opacity="0.85"/><stop offset="0.45" stop-color="${col}" stop-opacity="0.25"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
      html += `<rect width="800" height="500" fill="url(#${id('lamp')})" style="mix-blend-mode:screen" opacity="0.35" pointer-events="none"/>`;
    }
    return { defs, html };
  }

  /* ============================================================
     پکیج واقع‌گرایی — نور، سایه، بازتاب، بافت (نسخه ۵)
     ============================================================ */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function bbox(parts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    parts.forEach(d => { const n = d.match(/-?\d+\.?\d*/g).map(Number);
      for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); } });
    return { x0, y0, x1, y1 };
  }

  function realismKit(scene, asg, pal, opts, id, lite) {
    const L = opts.light || { t: 13, lamp: null, kelvin: 3000 };
    const sv = L.t >= 20 ? 0 : Math.max(0, Math.sin(Math.PI * (L.t - 6) / 14));
    const lampOn = (L.lamp === null || L.lamp === undefined) ? sv < 0.2 : !!L.lamp;
    const lampC = KELVIN[L.kelvin] || KELVIN[3000];
    const f = n => (+n).toFixed(1);
    const defs = [];
    const byId = {}; scene.layers.forEach(l => byId[l.id] = l);
    const win = byId.window, wb = win ? bbox(win.parts) : null;
    const lx = wb && (wb.x0 + wb.x1) / 2 > 400 ? 1 : -1;            // سمتِ نور
    const NOP = ['floor', 'rug', 'wall', 'accent', 'crown', 'window', 'mirror'];
    const NOB = ['wall', 'floor', 'crown', 'window', 'accent', 'rug'];
    const isProp = l => { if (NOP.includes(l.id)) return false; const b = bbox(l.parts); return b.y1 > 350 && b.y1 <= 500; };
    const cpOf = (l, n) => { const c = id('cp-' + n); defs.push(`<clipPath id="${c}">${l.parts.map(d => `<path d="${d}"/>`).join('')}</clipPath>`); return c; };
    const grad = (n, x1, y1, x2, y2, stops, user) => { defs.push(`<linearGradient id="${id(n)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2]}"/>`).join('')}</linearGradient>`); return `url(#${id(n)})`; };
    const rad = (n, cx, cy, r, col, o) => { defs.push(`<radialGradient id="${id(n)}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"><stop offset="0" stop-color="${col}" stop-opacity="${o}"/><stop offset="0.5" stop-color="${col}" stop-opacity="${f(o * 0.3)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`); return `url(#${id(n)})`; };
    defs.push(`<filter id="${id('rb')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="${id('rb4')}" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>`);
    const fl = byId.floor;
    const gl = (opts.gloss && opts.gloss.floor !== undefined) ? opts.gloss.floor : (fl && (MAT[fl.mat] || MAT.wood).rough < 0.55 ? 0.4 : 0.06);

    /* --- کف: تخته/کاشی با پرسپکتیو و تنوع تُن --- */
    function floorTex(l) {
      const tile = l.texture === 'tile', rn = rng(tile ? 5 : 9);
      const vx = 400, vy = 150, ya = 340, yb = 500, step = tile ? 110 : 62, zmax = (yb - vy) / (ya - vy);
      const px = (X, y) => vx + (X - vx) * (y - vy) / (yb - vy);
      const yz = z => vy + (yb - vy) / z;
      const cp = cpOf(l, 'floor'); let h = '';
      for (let i = 0; i < 60; i++) {
        const X0 = -1000 + i * step, X1 = X0 + step;
        if (px(X1, ya) < -20 || px(X0, ya) > 820) continue;
        const cuts = [1]; let z = tile ? 1 + 0.16 : 1 + ((i * 0.137) % 1) * 0.35;
        for (; z < zmax; z += tile ? 0.16 : 0.35) cuts.push(z);
        cuts.push(zmax);
        for (let k = 0; k + 1 < cuts.length; k++) {
          const A = yz(cuts[k]), B = yz(cuts[k + 1]), r = rn();
          const fill = r < 0.5 ? `rgba(0,0,0,${f((0.5 - r) * 0.2)})` : `rgba(255,255,255,${f((r - 0.5) * 0.16)})`;
          h += `<path d="M${f(px(X0, A))},${f(A)} L${f(px(X1, A))},${f(A)} L${f(px(X1, B))},${f(B)} L${f(px(X0, B))},${f(B)} Z" fill="${fill}" stroke="rgba(0,0,0,${tile ? 0.28 : 0.2})" stroke-width="${tile ? 1.1 : 0.7}"/>`;
        }
      }
      return `<g pointer-events="none" clip-path="url(#${cp})">${h}</g>`;
    }

    /* --- آسمان و منظره‌ی پشتِ پنجره بر پایه‌ی ساعت --- */
    function sky(l) {
      const b = wb, W = b.x1 - b.x0, H = b.y1 - b.y0, cp = cpOf(l, 'sky');
      const a = clamp(sv * 4, 0, 1), d = clamp((sv - 0.25) / 0.5, 0, 1);
      const top = mixHex(mixHex('#0d1633', '#4a4a8a', a), '#4f9be6', d);
      const bot = mixHex(mixHex('#1b2a55', '#f6b27a', a), '#cfe7fb', d);
      const g = grad('sky', 0, 0, 0, 1, [[0, top, 1], [1, bot, 1]]);
      const rr = rng(5); let bld = '', x = b.x0;
      while (x < b.x1) { const w = 10 + rr() * 22, hh = H * (0.1 + rr() * 0.26); bld += `<rect x="${f(x)}" y="${f(b.y1 - hh)}" width="${f(w)}" height="${f(hh + 2)}"/>`; x += w + 1; }
      const ph = clamp((L.t - 6) / 14, 0.05, 0.95);
      const sun = sv > 0.02 ? `<rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${rad('sun', b.x0 + W * ph, b.y0 + H * (0.8 - 0.6 * Math.sin(Math.PI * ph)), W * 0.9, '#FFF3D6', f(0.35 + sv * 0.6))}"/>` : '';
      let stars = ''; if (sv < 0.08) for (let i = 0; i < 14; i++) stars += `<circle cx="${f(b.x0 + rr() * W)}" cy="${f(b.y0 + rr() * H * 0.5)}" r="${f(0.5 + rr() * 0.6)}" fill="#fff" opacity="${f(0.4 + rr() * 0.5)}"/>`;
      const tint = pal[asg.window] || '#fff';
      return `<g pointer-events="none" clip-path="url(#${cp})"><rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${g}"/>${sun}${stars}<g fill="${mixHex(bot, '#0a0f1e', 0.6)}" opacity="0.9">${bld}</g><rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${tint}" opacity="0.14"/><path d="M${b.x0 + W * 0.15},${b.y1} L${b.x0 + W * 0.45},${b.y0} L${b.x0 + W * 0.62},${b.y0} L${b.x0 + W * 0.32},${b.y1} Z" fill="#fff" opacity="0.10"/></g>`;
    }

    /* --- نقشِ فرش (پرسپکتیو دو‌خطی) --- */
    function rugMotif(l) {
      const n = l.parts[0].match(/-?\d+\.?\d*/g).map(Number);
      const A = [n[0], n[1]], B = [n[2], n[3]], C = [n[4], n[5]], D = [n[6], n[7]];
      const P = (u, v) => { const tx = A[0] + (B[0] - A[0]) * u, ty = A[1] + (B[1] - A[1]) * u, bx = D[0] + (C[0] - D[0]) * u, by = D[1] + (C[1] - D[1]) * u; return [tx + (bx - tx) * v, ty + (by - ty) * v]; };
      const poly = (pts, fill, stroke, sw, op) => `<path d="M${pts.map(p => P(p[0], p[1]).map(f).join(',')).join(' L')} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
      const base = pal[asg.rug] || '#888', c1 = lighten(base, 0.32), c2 = darken(base, 0.38), ac = pal[popIndex(pal)] || c1;
      let h = poly([[.02, .06], [.98, .06], [.98, .94], [.02, .94]], 'none', c1, 2.2, 0.85)
        + poly([[.06, .16], [.94, .16], [.94, .84], [.06, .84]], darken(base, 0.14), c2, 1.4, 0.55)
        + poly([[.5, .2], [.72, .5], [.5, .8], [.28, .5]], c1, ac, 1.4, 0.6)
        + poly([[.5, .32], [.6, .5], [.5, .68], [.4, .5]], ac, 'none', 0, 0.85);
      [[.14, .3], [.86, .3], [.14, .7], [.86, .7]].forEach(([u, v]) => { h += poly([[u, v - .09], [u + .035, v], [u, v + .09], [u - .035, v]], c1, c2, 0.8, 0.6); });
      for (let k = 0; k < 24; k++) { const u = 0.04 + k * 0.04; [.075, .885].forEach(v => { h += poly([[u, v], [u + .022, v], [u + .022, v + .04], [u, v + .04]], k % 2 ? ac : c1, 'none', 0, 0.7); }); }
      return `<g pointer-events="none">${h}</g>`;
    }

    /* --- سایه‌ی تماسی، پرتوِ خورشید و بازتابِ کف --- */
    function under() {
      let h = '';
      if (wb && sv > 0.05 && L.wx !== 'ابری') {
        const sunC = mixHex('#FFD9A0', '#FFF6E6', clamp((sv - 0.2) / 0.5, 0, 1));
        const g = grad('shaft', 0, 0, 0, 1, [[0, sunC, f(0.42 * sv)], [1, sunC, 0]]);
        const s = -lx * 150;
        h += `<path d="M${wb.x0 + 10},342 L${wb.x1 - 10},342 L${wb.x1 - 10 + s},500 L${wb.x0 + 10 + s},500 Z" fill="${g}" filter="url(#${id('rb4')})" style="mix-blend-mode:screen" pointer-events="none"/>`;
      }
      const dark = 0.5 + 0.5 * Math.max(sv, lampOn ? 0.4 : 0);
      scene.layers.filter(isProp).forEach(l => {
        const b = bbox(l.parts), w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2 - lx * w * 0.12;
        const soft = `<ellipse cx="${f(cx)}" cy="${f(b.y1 + 2)}" rx="${f(w * 0.56)}" ry="${f(Math.min(14, 4 + (b.y1 - b.y0) * 0.05))}" fill="#000" opacity="${f(0.3 * dark)}"${lite ? '' : ` filter="url(#${id('rb4')})"`}/>`;
        const tight = `<ellipse cx="${f((b.x0 + b.x1) / 2)}" cy="${f(b.y1)}" rx="${f(w * 0.48)}" ry="3" fill="#000" opacity="0.35"${lite ? '' : ` filter="url(#${id('rb')})"`}/>`;
        h += `<g pointer-events="none">${soft}${tight}</g>`;
        if (!lite && gl > 0.05) {
          const hh = Math.min(70, (b.y1 - b.y0) * 0.6), gd = grad('rg-' + l.id, 0, b.y1, 0, b.y1 + hh, [[0, '#fff', 1], [1, '#000', 1]], true), mk = id('rm-' + l.id);
          defs.push(`<mask id="${mk}" maskUnits="userSpaceOnUse" x="0" y="${b.y1}" width="800" height="${f(hh)}"><rect x="0" y="${b.y1}" width="800" height="${f(hh)}" fill="${gd}"/></mask>`);
          h += `<g mask="url(#${mk})" pointer-events="none"><use href="#${id('L-' + l.id)}" transform="translate(0 ${2 * b.y1}) scale(1 -1)" opacity="${f(Math.min(0.35, 0.08 + gl * 0.4))}"/></g>`;
        }
      });
      return h;
    }

    return {
      defs: () => defs.join(''),
      tex: l => (l.texture ? floorTex(l) : ''),
      bevel(l, mat) {
        if (lite || NOB.includes(l.id)) return '';
        const cp = cpOf(l, 'bv-' + l.id);
        const s = (c, o, dx, dy) => `<g transform="translate(${dx},${dy})" opacity="${o}">${l.parts.map(d => `<path d="${d}" fill="none" stroke="${c}" stroke-width="7"/>`).join('')}</g>`;
        return `<g clip-path="url(#${cp})" pointer-events="none"><g filter="url(#${id('rb')})">${s('#fff', f(0.28 + mat.hl), -lx * 2.5, 2.5)}${s('#000', 0.32, lx * 2.5, -2.5)}</g></g>`;
      },
      after(l) {
        let h = '';
        if (l.id === 'window' && wb) h += sky(l);
        if (l.id === 'rug') h += rugMotif(l);
        if (l.id === (byId.rug ? 'rug' : 'floor')) h += under();
        return h;
      },
      top() {
        let h = '';
        const rc = (x, y, w, hh, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${fill}" pointer-events="none"/>`;
        h += rc(0, 296, 800, 46, grad('aoB', 0, 0, 0, 1, [[0, '#000', 0], [1, '#000', 0.2]]));
        h += rc(0, 340, 800, 70, grad('aoF', 0, 0, 0, 1, [[0, '#000', 0.22], [1, '#000', 0]]));
        h += rc(0, 0, 800, 56, grad('aoT', 0, 0, 0, 1, [[0, '#000', 0.18], [1, '#000', 0]]));
        h += rc(0, 0, 80, 500, grad('aoL', 0, 0, 1, 0, [[0, '#000', 0.16], [1, '#000', 0]]));
        h += rc(720, 0, 80, 500, grad('aoR', 0, 0, 1, 0, [[0, '#000', 0], [1, '#000', 0.16]]));
        const wc = wb ? [(wb.x0 + wb.x1) / 2, (wb.y0 + wb.y1) / 2] : [120, 180];
        if (sv > 0.05) h += `<rect width="800" height="500" fill="${rad('wl', wc[0], wc[1], 560, '#FFF6E0', f(0.2 * sv))}" style="mix-blend-mode:screen" pointer-events="none"/>`;
        if (lampOn) scene.layers.filter(l => /^lamp(_shade|_l|_r)?$/.test(l.id)).forEach(l => {
          const b = bbox(l.parts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
          h += `<rect width="800" height="500" fill="${rad('lg-' + l.id, cx, cy, 190, lampC, 0.6)}" style="mix-blend-mode:screen" pointer-events="none"/>`;
          h += `<g pointer-events="none" opacity="0.3">${l.parts.map(d => `<path d="${d}" fill="${lampC}"/>`).join('')}</g>`;
        });
        if (!lite) {
          defs.push(`<filter id="${id('gr')}" filterUnits="userSpaceOnUse" x="0" y="0" width="800" height="500"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1.4 0 0 0 -0.55"/></filter>`);
          h += `<rect width="800" height="500" fill="#000" filter="url(#${id('gr')})" opacity="0.4" pointer-events="none"/>`;
        }
        return h;
      },
    };
  }

  let _svgUid = 0;

  function buildSVG(scene, asg, palette, lightKey, opts = {}) {
    const uid = `u${++_svgUid}`;
    const id = (name) => `${uid}-${name}`;
    const light = LIGHTS[lightKey] || LIGHTS.day;
    const lo = opts.light ? lightOverlay(opts.light, id) : null;
    const defs = [];
    const R = realismKit(scene, asg, palette, opts, id, !!opts.lite);

    // فیلتر بلور (فقط برای سایه‌های زیر مبلمان)
    defs.push(`
      <filter id="${id('blur')}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5"/>
      </filter>
      <filter id="${id('blur-lg')}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8"/>
      </filter>
      <pattern id="${id('wood-plank')}" x="0" y="0" width="240" height="22"
               patternUnits="userSpaceOnUse">
        <path d="M0,21 L240,21" stroke="rgba(0,0,0,0.10)" stroke-width="0.8"/>
        <path d="M0,10 L240,10" stroke="rgba(0,0,0,0.04)" stroke-width="0.4"/>
      </pattern>
      <pattern id="${id('tile')}" x="0" y="0" width="55" height="55" patternUnits="userSpaceOnUse">
        <path d="M0,0 L55,0 L55,55 L0,55 Z" fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="0.6"/>
      </pattern>
    `);

    // ---- لایه‌ها ----
    const layerHtml = [];
    for (const layer of scene.layers) {
      const idx = asg[layer.id];
      if (idx === undefined || idx === null) continue;
      const raw = palette[idx];
      if (!raw) continue;

      const mat = MAT[layer.mat] || MAT.wall;

      // تنظیم گرمی/سردی رنگ
      const color = mat.warm > 0
        ? mixHex(raw, '#F2C08A', mat.warm * 0.5)
        : mat.warm < 0
          ? mixHex(raw, '#A8C0E0', -mat.warm * 0.4)
          : raw;

      // گرادیانِ عمودیِ نرم
      const gradId = id(`g-${layer.id}`);
      const top = lighten(color, mat.hl * 0.6);
      const bot = darken(color, mat.hl * 0.3 + 0.04);
      defs.push(`
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${top}"/>
          <stop offset="0.55" stop-color="${color}"/>
          <stop offset="1" stop-color="${bot}"/>
        </linearGradient>
      `);

      const paths = layer.parts.map(d => `<path class="b" d="${d}" fill="url(#${gradId})"/>`).join('');

      // بافت روی سطح
      const tex = layer.texture ? R.tex(layer) : '';

      // هایلایتِ شیشه‌ای برای متریال صاف
      const gOv = opts.gloss ? opts.gloss[layer.id] : undefined;
      const isFlat = gOv !== undefined ? gOv > 0.05 : mat.rough < 0.55;
      const sheenOp = gOv !== undefined ? clamp(gOv * 1.4, 0, 0.95) : 0.55;
      const sheenId = id(`s-${layer.id}`);
      if (isFlat) {
        defs.push(`
          <linearGradient id="${sheenId}" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" stop-color="#FFF" stop-opacity="0.35"/>
            <stop offset="0.4" stop-color="#FFF" stop-opacity="0"/>
            <stop offset="1" stop-color="#FFF" stop-opacity="0"/>
          </linearGradient>
        `);
      }
      const sheen = isFlat
        ? `<g pointer-events="none" opacity="${sheenOp}">${layer.parts.map(d => `<path d="${d}" fill="url(#${sheenId})"/>`).join('')}</g>`
        : '';

      const sel = opts.selected === layer.id ? ' sel' : '';

      layerHtml.push(`
        <g class="ly${sel}" id="${id('L-' + layer.id)}" data-l="${layer.id}" data-n="${layer.name}">
          ${paths}
          ${sheen}
          ${tex}${R.bevel(layer, mat)}
        </g>
      `);
      layerHtml.push(R.after(layer));
    }

    // ---- سایه‌ها ----
    const shadows = (scene.shadows || []).map(s =>
      `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="#000" opacity="${s.op}" filter="url(#${id('blur')})" pointer-events="none"/>`
    ).join('');

    // ---- جزئیات ----
    const details = (scene.details || []).map(d =>
      `<path d="${d.d}" fill="${d.fill || 'none'}" stroke="${d.stroke || '#000'}" stroke-opacity="${d.strokeOp ?? 1}" stroke-width="${d.sw || 1}" pointer-events="none"/>`
    ).join('');

    // ---- وینیت ----
    defs.push(`
      <radialGradient id="${id('vig')}" cx="0.5" cy="0.45" r="1.05">
        <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
      </radialGradient>
    `);

    if (lo && lo.defs) defs.push(lo.defs);

    const topHtml = R.top();
    return `<svg viewBox="0 0 800 500" xmlns="${NS}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${scene.name}">
      <defs>${defs.join('')}${R.defs()}</defs>
      <rect width="800" height="500" fill="${palette[asg.wall] || '#222'}"/>
      <g class="stage-layer">${layerHtml.join('')}</g>
      ${shadows}
      ${details}
      ${topHtml}
      ${lo ? lo.html : `<rect width="800" height="500" fill="${light.tint}" pointer-events="none"/>`}
      <rect width="800" height="500" fill="url(#${id('vig')})" pointer-events="none"/>
    </svg>`;
  }

  /* ============================================================
     تحلیل
     ============================================================ */
  const WEIGHTS = { L1: 1.0, L2: 0.6, M: 0.7, D: 0.5, K: 0.3, P: 0.15 };

  function computeAnalysis(scene, asg, palette) {
    let total = 0;
    const roleTotals = { L1: 0, L2: 0, M: 0, D: 0, K: 0, P: 0 };
    const colorRoleSum = {};
    const roleColor = {};

    for (const layer of scene.layers) {
      if (!layer.role) continue;
      const color = palette[asg[layer.id]];
      if (!color) continue;
      const w = WEIGHTS[layer.role] || 0.3;
      roleTotals[layer.role] += w;
      total += w;
      colorRoleSum[color] = (colorRoleSum[color] || 0) + w;
      if (!roleColor[layer.role]) roleColor[layer.role] = color;
    }

    const roleInfo = ['L1', 'L2', 'M', 'D', 'K', 'P'].map(r => {
      const sum = roleTotals[r] || 0;
      const pct = total ? (sum / total) * 100 : 0;
      return { role: r, pct, color: roleColor[r] || null };
    }).filter(r => r.pct > 0.5);

    const uniqueColors = Object.keys(colorRoleSum);
    const hues = uniqueColors.map(c => toHSV(c).h).filter(h => !isNaN(h));
    let harmonyType = 'تک‌رنگ (Monochromatic)';
    let harmonyScore = 90;

    if (hues.length >= 2) {
      const diffs = [];
      for (let i = 0; i < hues.length; i++)
        for (let j = i + 1; j < hues.length; j++) {
          let d = Math.abs(hues[i] - hues[j]);
          if (d > 180) d = 360 - d;
          diffs.push(d);
        }
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      if (avg < 20)      { harmonyType = 'تک‌رنگ (Monochromatic)'; harmonyScore = 92; }
      else if (avg < 50) { harmonyType = 'آنالوگ (Analogous)';       harmonyScore = 88; }
      else if (avg < 100){ harmonyType = 'مکملِ نزدیک';              harmonyScore = 78; }
      else if (avg < 150){ harmonyType = 'سه‌گانه (Triadic)';        harmonyScore = 82; }
      else               { harmonyType = 'مکمل (Complementary)';     harmonyScore = 74; }
    }

    const lrvs = uniqueColors.map(lrv);
    const lrvRange = Math.max(...lrvs) - Math.min(...lrvs);
    if (lrvRange > 40) harmonyScore += 6;
    if (lrvRange < 15) harmonyScore -= 10;
    harmonyScore = clamp(harmonyScore, 0, 100);

    const l1Pct = total ? (roleTotals.L1 / total) * 100 : 0;
    const l2Pct = total ? (roleTotals.L2 / total) * 100 : 0;
    const dev = Math.abs(l1Pct - 60) + Math.abs(l2Pct - 30);
    const balanceScore = clamp(100 - dev, 0, 100);

    const warnings = [];
    const wallLrv = roleColor.L1 ? lrv(roleColor.L1) : 50;
    if (wallLrv < 25) warnings.push({ level: 'warn', text: 'LRV دیوارِ اصلی کمتر از ۲۵٪ است — فضا ممکن است تیره به‌نظر بیاید.' });
    if (wallLrv > 88) warnings.push({ level: 'warn', text: 'LRV دیوارِ اصلی بالای ۸۸٪ است — در نورِ شدید شسته می‌شود.' });
    if (roleColor.L1 && roleColor.M && contrast(roleColor.L1, roleColor.M) < 1.3)
      warnings.push({ level: 'info', text: 'کنتراستِ دیوار و کف کم است — فضا یکدست‌تر می‌شود.' });

    const colorStats = uniqueColors.map(hex => ({
      hex, lrv: lrv(hex),
      share: total ? (colorRoleSum[hex] / total * 100) : 0,
      usage: lrv(hex) > 60 ? 'رنگِ پایه' : 'رنگِ تأکیدی',
    })).sort((a, b) => b.share - a.share);

    return { colorStats, roleInfo, harmonyType, harmonyScore, balanceScore, warnings };
  }

  /* ============================================================
     بُر هوشمند
     ============================================================ */
  function smartShuffle(scene, palette, locked = {}) {
    const strategies = ['mono', 'analogous', 'complementary', 'triadic'];
    const strat = strategies[Math.floor(Math.random() * strategies.length)];
    const pivot = Math.floor(Math.random() * palette.length);
    const pHSV = toHSV(palette[pivot]);
    const idxs = [pivot];

    function nearest(hue) {
      let best = 0, bestD = 999;
      for (let i = 0; i < palette.length; i++) {
        if (idxs.includes(i)) continue;
        const h = toHSV(palette[i]).h;
        let d = Math.abs(h - hue);
        if (d > 180) d = 360 - d;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    if (strat === 'mono')         idxs.push(nearest(pHSV.h), nearest((pHSV.h + 15) % 360));
    else if (strat === 'analogous') idxs.push(nearest((pHSV.h + 30) % 360), nearest((pHSV.h + 330) % 360));
    else if (strat === 'complementary') idxs.push(nearest((pHSV.h + 180) % 360), nearest(pHSV.h));
    else                          idxs.push(nearest((pHSV.h + 120) % 360), nearest((pHSV.h + 240) % 360));
    while (idxs.length < palette.length) idxs.push(nearest(pHSV.h));

    const pIdx = popIndex(palette);
    const map = {
      L1: [idxs[3] ?? idxs[0], idxs[4] ?? idxs[0]],
      L2: [idxs[2] ?? idxs[0]],
      M:  [idxs[1] ?? idxs[0]],
      D:  [idxs[1] ?? idxs[0], idxs[2] ?? idxs[0]],
      K:  [idxs[0]],
      P:  [pIdx, idxs[2] ?? idxs[0]],
    };

    const result = {};
    for (const layer of scene.layers) {
      if (!layer.role || locked[layer.id]) continue;
      const pool = map[layer.role] || [idxs[0]];
      result[layer.id] = pool[Math.floor(Math.random() * pool.length)];
    }
    return { result, strategy: strat };
  }

  /* ============================================================
     ابزارهای رنگ برای جدول مشخصات
     ============================================================ */
  const fmt = (n, d = 0) => toPN(Number(n).toFixed(d)).replace('.', '٫');
  function toCMYK(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255);
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return [0, 0, 0, 100];
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map(v => Math.round(v * 100));
  }
  function toLAB(hex) {
    const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)].map(Math.round);
  }

  const MAT_FA = {
    wall: 'رنگ مات', wallGloss: 'رنگ نیمه‌براق', stucco: 'استوکو', concrete: 'بتن', wood: 'چوب',
    woodDark: 'چوب تیره', marble: 'مرمر', tile: 'سرامیک', fabric: 'پارچه', velvet: 'مخمل',
    leather: 'چرم', metal: 'فلز', brass: 'برنج', plant: 'گیاه', art: 'تابلو', rug: 'فرش', glass: 'شیشه',
  };
  const ROLE_FA = { L1: 'سطح غالب', L2: 'سطح ثانویه', M: 'کف / میانی', D: 'تیره', K: 'مبلمان', P: 'تأکید' };
  const PAINT_MATS = new Set(['wall', 'wallGloss', 'stucco', 'concrete']);
  const M_PER_UNIT = 2.7 / 340; // ارتفاع دیوار در نما ≈ ۲٫۷ متر

  function geom(parts) {
    let area = 0, minY = Infinity, maxY = -Infinity;
    for (const d of parts) {
      const n = (String(d).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const pts = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        s += p[0] * q[1] - q[0] * p[1];
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      }
      area += Math.abs(s) / 2;
    }
    return { area, minY: isFinite(minY) ? minY : 0, maxY: isFinite(maxY) ? maxY : 0 };
  }

  function buildSchedule() {
    const scene = SCENES[st.sceneId], asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return [];
    const k = M_PER_UNIT * M_PER_UNIT;
    const rows = scene.layers
      .filter(l => l.role && asg[l.id] !== undefined && st.palette.colors[asg[l.id]])
      .map(l => {
        const g = geom(l.parts);
        return { l, hex: st.palette.colors[asg[l.id]], area: g.area * k, g, paint: PAINT_MATS.has(l.mat) };
      });
    for (const r of rows) {
      if (!r.paint) continue;
      let sub = 0;
      for (const o of rows) {
        if (o === r || o.paint || o.l.texture) continue;
        const h = o.g.maxY - o.g.minY;
        if (h <= 0 || o.g.minY >= 340) continue;
        sub += o.area * Math.min(1, (340 - o.g.minY) / h);
      }
      r.area = Math.max(r.area * 0.3, r.area - sub);
    }
    rows.forEach(r => { r.liters = r.paint ? r.area * 2 / 10 * 1.1 : null; });
    return rows;
  }

  function layerLabel(scene, l) {
    const same = scene.layers.filter(x => x.name === l.name);
    return same.length > 1 ? `${l.name} ${toPN(same.indexOf(l) + 1)}` : l.name;
  }

  function roleColors(scene, asg) {
    const o = {};
    for (const l of scene.layers) {
      if (!l.role || o[l.role]) continue;
      const c = st.palette.colors[asg[l.id]];
      if (c) o[l.role] = c;
    }
    return o;
  }
  function pairsInfo(scene, asg) {
    const rc = roleColors(scene, asg);
    return [['L1', 'M'], ['L1', 'L2'], ['L1', 'P'], ['M', 'K'], ['L1', 'K'], ['M', 'P']]
      .filter(([a, b]) => rc[a] && rc[b])
      .map(([a, b]) => ({ ca: rc[a], cb: rc[b], r: contrast(rc[a], rc[b]), label: `${ROLE_FA[a]} و ${ROLE_FA[b]}` }))
      .slice(0, 5);
  }

  /* ============================================================
     وضعیت
     ============================================================ */
  const PRESET_T = { dawn: 7.5, day: 13, dusk: 18, night: 21 };
  const st = {
    palette: null, sceneId: 'living', asgByScene: {},
    lock: new Set(), history: [], future: [],
    selected: null, light: 'day',
    before: false, splitX: 50,
    t: 13, dir: 'جنوبی', wx: 'آفتابی', lamp: null, kelvin: 3000,
    gloss: {}, cb: '', tab: 'color', why: '', size: 2400,
  };

  let root, stageEl, lastFocus = null, cmp = null, dragging = false, toastTimer = null;

  const nearestPreset = (t) => t < 10 ? 'dawn' : t < 16 ? 'day' : t < 19.5 ? 'dusk' : 'night';
  const svOf = (t) => t >= 20 ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
  const lampIsOn = () => st.lamp === null ? svOf(st.t) < 0.2 : !!st.lamp;
  const glossKey = (sceneId, layerId) => `${sceneId}:${layerId}`;
  function glossMap(sceneId) {
    const o = {}, pre = sceneId + ':';
    for (const k in st.gloss) if (k.startsWith(pre)) o[k.slice(pre.length)] = st.gloss[k];
    return o;
  }
  function ropts(sceneId, extra) {
    return Object.assign({
      selected: st.selected,
      light: { t: st.t, dir: st.dir, wx: st.wx, lamp: st.lamp, kelvin: st.kelvin },
      gloss: glossMap(sceneId || st.sceneId),
      lite: !!st.fast,
    }, extra || {});
  }
  function defaultSel(sceneId) {
    const sc = SCENES[sceneId];
    return (sc.layers.find(l => l.role === 'L1') || sc.layers[0]).id;
  }
  function layerGloss(scene, l) {
    const v = st.gloss[glossKey(st.sceneId, l.id)];
    if (v !== undefined) return v;
    return (MAT[l.mat] || MAT.wall).rough < 0.55 ? 0.4 : 0.04;
  }

  /* ============================================================
     Shell
     ============================================================ */
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
            <button type="button" class="stu-icon" data-a="goexport" aria-label="خروجی" title="خروجی">${svgI(IC.save)}</button>
            <button type="button" class="stu-icon stu-icon-close" data-a="close" aria-label="بستن">${svgI(IC.close, 2)}</button>
          </div>
        </header>

        <div class="stu-body">
          <section class="stu-main">
            <div class="stu-scenes" id="stuScenes" role="tablist" aria-label="نوع فضا"></div>
            <div class="stu-sticky">
              <div class="stu-stage-box">
                <div class="stu-stage" id="stuStage" aria-live="polite"></div>
                <div class="stu-hint"><span id="stuHover">روی هر بخش بزن تا انتخاب شود</span><span id="stuClock"></span></div>
              </div>
              <div class="stu-chips" id="stuChips" role="group" aria-label="بخش‌های قابل‌رنگ"></div>
            </div>
          </section>

          <aside class="stu-side">
            <div class="stu-tabs" id="stuTabs" role="tablist" aria-label="ابزارها">
              <button type="button" role="tab" data-tab="color">رنگ</button>
              <button type="button" role="tab" data-tab="mat">متریال</button>
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
                <button type="button" class="stu-btn" data-a="lock" id="stuLockBtn" aria-pressed="false"><span>قفل بخش</span></button>
                <button type="button" class="stu-btn" data-a="compare" id="stuCmpBtn" aria-pressed="false">${svgI(IC.split)}<span>قبل / بعد</span></button>
                <button type="button" class="stu-btn" data-a="reset" aria-label="بازنشانی چیدمان">${svgI(IC.reset)}</button>
              </div>
              <p class="stu-why" id="stuWhy"></p>
              <div class="stu-block">
                <div class="stu-side-head"><span>تاریخچه</span><span class="stu-hint-sm" id="stuTlCount"></span></div>
                <div class="stu-tl-inner" id="stuTlInner"></div>
              </div>
            </div>

            <div class="stu-pane" data-pane="mat" role="tabpanel">
              <div class="stu-block">
                <div class="stu-side-head"><span id="stuMatTitle">متریال</span><span class="stu-hint-sm" id="stuMatSub"></span></div>
                <div class="stu-pills" id="stuFinish"></div>
              </div>
              <div class="stu-block">
                <div class="stu-side-head"><span>میزان براقی</span><span class="stu-hint-sm" id="stuGlossV"></span></div>
                <input type="range" class="stu-range" id="stuGloss" min="0" max="100" step="1" aria-label="میزان براقی">
              </div>
              <p class="stu-why" id="stuMatWhy"></p>
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
                <div class="stu-side-head"><span>چراغ</span><span class="stu-hint-sm">دمای رنگ (کلوین)</span></div>
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
                <div class="stu-side-head"><span>جدول مشخصات</span><span class="stu-hint-sm">۲ دست و ۱۰٪ پرت</span></div>
                <div class="stu-scroll"><table class="stu-tbl" id="stuFin"></table></div>
              </div>
              <div class="stu-block">
                <div class="stu-side-head"><span>اندازه تصویر</span></div>
                <div class="stu-pills" id="stuSize"></div>
              </div>
              <div class="stu-actions">
                <button type="button" class="stu-btn stu-btn-primary" data-a="export">${svgI(IC.save)}<span>ذخیره تصویر</span></button>
                <button type="button" class="stu-btn" data-a="csv"><span>جدول مشخصات (CSV)</span></button>
                <button type="button" class="stu-btn" data-a="copyall"><span>کپی همه کدها</span></button>
              </div>
              <p class="stu-why">مساحت‌ها از روی نمای روبه‌رو برآورد می‌شوند (ارتفاع دیوار ≈ ۲٫۷ متر) و فقط برای برآورد اولیه‌اند؛ پوشش رنگ ۱۰ متر مربع در لیتر فرض شده است.</p>
            </div>
          </aside>
        </div>

        <div class="stu-compare-bar" id="stuCompareBar" hidden>
          <span>بدون رنگ</span>
          <input type="range" dir="ltr" min="0" max="100" value="50" id="stuSplit" aria-label="مقایسه قبل و بعد">
          <span>با پالت</span>
        </div>
        <div class="stu-toast" id="stuToast" role="status" aria-live="polite"></div>
        ${CB_DEFS}
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  /* ============================================================
     CSS
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
    .stu-panel{position:relative;width:min(1200px,100%);min-height:0;background:var(--bg-elev);color:var(--ink);border-radius:20px;box-shadow:var(--shadow-lg),inset 0 0 0 1px var(--line);display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
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

    .stu-body{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(340px,1fr);flex:1;min-height:0}
    .stu-main{padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto}
    .stu-side{border-inline-start:1px solid var(--line-soft);display:flex;flex-direction:column;min-height:0;overflow-y:auto;background:color-mix(in srgb,var(--bg-sunk) 45%,transparent)}
    @media(max-width:899px){
      .stu-body{display:block;overflow-y:auto;overscroll-behavior:contain}
      .stu-main{overflow:visible;padding:10px 10px 0}
      .stu-side{border-inline-start:0;border-top:1px solid var(--line-soft);overflow:visible;margin-top:10px}
      .stu-sticky{position:sticky;top:0;z-index:5;background:var(--bg-elev);padding-bottom:6px}
    }

    .stu-scenes{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .stu-scenes::-webkit-scrollbar,.stu-chips::-webkit-scrollbar,.stu-tl-inner::-webkit-scrollbar,.stu-tabs::-webkit-scrollbar{display:none}
    .stu-scene{flex:none;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:11px;border:1px solid var(--line-soft);background:var(--glass);color:var(--ink-dim);font:600 12.5px inherit;font-family:inherit;cursor:pointer;transition:all .16s var(--ease)}
    .stu-scene:hover{color:var(--ink)}
    .stu-scene.on{background:var(--accent);color:var(--accent-ink);border-color:transparent}
    .stu-scene svg{width:14px;height:14px}

    .stu-stage-box{position:relative;border-radius:16px;overflow:hidden;background:var(--bg-sunk);box-shadow:inset 0 0 0 1px var(--line-soft),0 18px 40px -22px rgba(0,0,0,.6)}
    .stu-stage{position:relative;aspect-ratio:8/5;direction:ltr;user-select:none;-webkit-user-select:none;transition:filter .3s}
    .stu-stage.cmp{touch-action:none;cursor:ew-resize}
    .stu-stage svg{width:100%;height:100%;display:block}
    .stu-stage .ly{cursor:pointer}
    .stu-stage .ly:hover path.b{stroke:var(--accent);stroke-width:1.4;stroke-linejoin:round;paint-order:stroke}
    .stu-stage .ly.sel path.b{stroke:var(--accent);stroke-width:2;stroke-linejoin:round;paint-order:stroke}
    .stu-cmp{position:absolute;inset:0}
    .stu-cmp>div{position:absolute;inset:0}
    .stu-cmp-h{inset:0 auto 0 50%!important;width:2px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);pointer-events:none}
    .stu-cmp-h:after{content:"";position:absolute;top:50%;left:50%;width:30px;height:30px;margin:-15px;border-radius:50%;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.4)}
    .stu-cmp-t{position:absolute;top:8px;font-size:11px;padding:2px 10px;border-radius:99px;background:rgba(0,0,0,.55);color:#fff;direction:rtl}
    .stu-cmp-t.l{left:8px}.stu-cmp-t.r{right:8px}
    .stu-hint{position:absolute;bottom:8px;inset-inline:8px;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
    .stu-hint span{background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 10px;border-radius:99px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}

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

    .stu-tl-inner{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;min-height:46px;align-items:center}
    .stu-tl-item{flex:none;width:56px;height:36px;border-radius:9px;border:2px solid var(--line-soft);background:var(--glass);overflow:hidden;cursor:pointer;padding:0}
    .stu-tl-item.on{border-color:var(--accent)}
    .stu-tl-item svg{width:100%;height:100%;display:block}
    .stu-tl-empty{font-size:11.5px;color:var(--ink-faint)}

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

    .stu-compare-bar{display:flex;align-items:center;gap:12px;padding:10px 18px;border-top:1px solid var(--line-soft);background:var(--glass);font-size:12px;font-weight:600;color:var(--ink-dim);direction:ltr;flex:none}
    .stu-compare-bar input{flex:1;accent-color:var(--accent)}
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
  const toPN = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

  /* ============================================================
     تخصیص پیش‌فرض
     ============================================================ */
  function ensureAssignment(sceneId) {
    const scene = SCENES[sceneId];
    if (!scene || !st.palette) return null;
    if (st.asgByScene[sceneId]) return st.asgByScene[sceneId];
    const pool = st.palette.colors;
    const pIdx = popIndex(pool);
    const base = { L1: 4, L2: 3, M: 2, D: 1, K: 0, P: pIdx };
    const auto = {};
    for (const layer of scene.layers) {
      if (!layer.role) continue;
      auto[layer.id] = Math.min(base[layer.role] ?? 2, pool.length - 1);
    }
    st.asgByScene[sceneId] = auto;
    return auto;
  }

  /* ============================================================
     رندر UI
     ============================================================ */
  const pill = (attr, val, label, on) => `<button type="button" class="stu-pill" data-${attr}="${val}" aria-pressed="${on}">${label}</button>`;

  function renderStage() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;
    stageEl.style.filter = st.cb ? `url(#stu-f-${st.cb})` : '';
    stageEl.classList.toggle('cmp', st.before);
    updateClock();
    if (st.before) { applyBeforeAfter(); return; }
    cmp = null;
    stageEl.innerHTML = buildSVG(scene, asg, st.palette.colors, st.light, ropts());
    stageEl.querySelectorAll('.ly').forEach(g => {
      g.addEventListener('click', () => selectLayer(st.selected === g.dataset.l ? null : g.dataset.l));
    });
  }

  function updateClock() {
    const h = Math.floor(st.t), m = Math.round((st.t - h) * 60);
    const el = $('#stuClock', root);
    if (el) el.textContent = `${toPN(h)}:${toPN(String(m).padStart(2, '0'))}`;
  }

  function selectLayer(id) {
    st.selected = id;
    haptic.select();
    renderStage(); renderChips(); renderColor(); renderMat();
  }

  function renderScenes() {
    $('#stuScenes', root).innerHTML = Object.entries(SCENES).map(([id, s]) => `
      <button type="button" class="stu-scene ${id === st.sceneId ? 'on' : ''}" data-scene="${id}" role="tab" aria-selected="${id === st.sceneId}">
        ${ICONS[SCENE_ICON[id] || 'home']}<span>${s.name}</span>
      </button>`).join('');
  }

  function renderChips() {
    const scene = SCENES[st.sceneId], asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;
    $('#stuChips', root).innerHTML = scene.layers.filter(l => l.role).map(l => {
      const hex = st.palette.colors[asg[l.id]] || '#888888';
      return `<button type="button" class="stu-chip" data-chip="${l.id}" aria-pressed="${st.selected === l.id}">
        <i style="background:${hex}"></i><span><b>${layerLabel(scene, l)}</b><em>${st.lock.has(l.id) ? 'قفل · ' : ''}${ROLE_FA[l.role] || ''}</em></span></button>`;
    }).join('');
  }

  function renderColor() {
    const scene = SCENES[st.sceneId], asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;
    const layer = scene.layers.find(l => l.id === st.selected);
    const sel = $('#stuSel', root);
    if (!layer) {
      sel.innerHTML = `<div class="big" style="background:var(--glass)"></div><div><b>بخشی انتخاب نشده</b><p>روی تصویر یا یکی از بخش‌ها بزن.</p></div><span></span>`;
    } else {
      const hex = st.palette.colors[asg[layer.id]] || '#888888';
      const rg = hexToRgb(hex), cm = toCMYK(hex), lb = toLAB(hex);
      sel.innerHTML = `<div class="big" style="background:${hex}"></div>
        <div><b>${layerLabel(scene, layer)}</b>
        <p class="ltr">${hex.toUpperCase()} · RGB ${rg.join(',')}<br>CMYK ${cm.join('/')} · LAB ${lb.join(',')}</p>
        <p>LRV ${toPN(lrv(hex))} · ${ROLE_FA[layer.role] || ''}</p></div>
        <button type="button" class="stu-icon" data-a="copy" aria-label="کپی کد رنگ">${svgI(IC.copy)}</button>`;
    }
    const cur = layer ? asg[layer.id] : -1;
    $('#stuPalette', root).innerHTML = st.palette.colors.map((hex, i) => `
      <button type="button" class="stu-sw ${i === cur ? 'on' : ''}" data-pick="${i}" style="--c:${hex}" aria-label="رنگ ${hex}" aria-pressed="${i === cur}">
        <span>${hex.replace('#', '').toUpperCase()}</span></button>`).join('');
    $('#stuSelHint', root).textContent = layer ? 'روی رنگ بزن تا اعمال شود' : '';
    const lk = $('#stuLockBtn', root), locked = !!layer && st.lock.has(layer.id);
    lk.setAttribute('aria-pressed', locked);
    lk.disabled = !layer;
    lk.firstElementChild.textContent = locked ? 'باز کردن قفل' : 'قفل بخش';
    $('#stuWhy', root).innerHTML = st.why || whyDefault(scene, asg);
    $('[data-a=undo]', root).disabled = !st.history.length;
    $('[data-a=redo]', root).disabled = !st.future.length;
  }

  function whyDefault(scene, asg) {
    const p = pairsInfo(scene, asg)[0];
    if (!p) return '';
    const txt = p.r >= 3 ? 'سطوح از هم واضح جدا می‌شوند.' : p.r >= 1.5 ? 'جداسازی ملایم و آرام است.' : 'سطوح در هم محو می‌شوند؛ یکی را روشن‌تر یا تیره‌تر کن.';
    return `<b>چرا این چیدمان؟</b> کنتراست ${p.label} ${fmt(p.r, 1)}:۱ است؛ ${txt}`;
  }

  function renderMat() {
    const scene = SCENES[st.sceneId];
    const layer = scene.layers.find(l => l.id === st.selected);
    const slider = $('#stuGloss', root);
    if (!layer) {
      $('#stuMatTitle', root).textContent = 'متریال';
      $('#stuMatSub', root).textContent = '';
      $('#stuFinish', root).innerHTML = '';
      slider.disabled = true; slider.value = 0;
      $('#stuGlossV', root).textContent = '';
      $('#stuMatWhy', root).textContent = 'اول یک بخش را انتخاب کن.';
      return;
    }
    const g = layerGloss(scene, layer);
    slider.disabled = false; slider.value = Math.round(g * 100);
    $('#stuMatTitle', root).textContent = layerLabel(scene, layer);
    $('#stuMatSub', root).textContent = MAT_FA[layer.mat] || '';
    $('#stuGlossV', root).textContent = toPN(Math.round(g * 100)) + '٪';
    const FIN = [['مات', 0.02], ['ساتن', 0.2], ['نیمه‌براق', 0.4], ['براق', 0.65]];
    const near = FIN.reduce((a, b) => Math.abs(b[1] - g) < Math.abs(a[1] - g) ? b : a);
    $('#stuFinish', root).innerHTML = FIN.map(([n, v]) => pill('fin', v, n, near[0] === n)).join('');
    $('#stuMatWhy', root).textContent = g > 0.25
      ? 'سطح براق نور پنجره را بازتاب می‌دهد و همان رنگ را روشن‌تر نشان می‌دهد؛ برای فضای کوچک مناسب است.'
      : 'سطح مات نور را پخش می‌کند و رنگ آرام‌تر و عمیق‌تر دیده می‌شود.';
  }

  function renderLight() {
    $('#stuLights', root).innerHTML = Object.entries(LIGHTS).map(([id, l]) => `
      <button type="button" class="stu-light ${id === st.light ? 'on' : ''}" data-light="${id}" aria-pressed="${id === st.light}">${ICONS[l.icon]}<span>${l.name}</span></button>`).join('');
    $('#stuTime', root).value = st.t;
    updateTimeLbl();
    $('#stuDir', root).innerHTML = ['شمالی', 'جنوبی', 'شرقی', 'غربی'].map(v => pill('dir', v, v, st.dir === v)).join('');
    $('#stuWx', root).innerHTML = ['آفتابی', 'ابری'].map(v => pill('wx', v, v, st.wx === v)).join('');
    $('#stuKel', root).innerHTML = [2700, 3000, 4000, 6500].map(v => pill('kel', v, toPN(v), st.kelvin === v)).join('');
    const on = lampIsOn(), b = $('#stuLampBtn', root);
    b.setAttribute('aria-pressed', on);
    b.firstElementChild.textContent = on ? 'لوستر روشن' : 'لوستر خاموش';
    $('#stuLightWhy', root).textContent = st.dir === 'شمالی'
      ? 'نور شمالی سرد و یکنواخت است؛ رنگ‌ها آبی‌تر و تیره‌تر دیده می‌شوند. برای این فضا فام گرم‌تر بهتر جواب می‌دهد.'
      : st.dir === 'جنوبی'
        ? 'نور جنوبی گرم و پرشدت است؛ رنگ‌های سرد در آن زنده‌تر می‌مانند.'
        : 'نور شرقی صبح گرم و عصر ملایم است؛ اتاق خواب را با آن بسنج.';
  }
  function updateTimeLbl() {
    const t = st.t;
    $('#stuTimeLbl', root).textContent = t < 9 ? 'صبح زود' : t < 12 ? 'صبح' : t < 15 ? 'ظهر' : t < 18 ? 'عصر' : t < 20 ? 'غروب' : 'شب';
  }

  function renderAnalysis() {
    const wrap = $('#stuAnalysis', root);
    const scene = SCENES[st.sceneId], asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) { wrap.innerHTML = ''; return; }
    const an = computeAnalysis(scene, asg, st.palette.colors);
    const rc = roleColors(scene, asg);
    const g = { base: 0, sec: 0, acc: 0 };
    an.roleInfo.forEach(r => { if (r.role === 'L1') g.base += r.pct; else if (r.role === 'K' || r.role === 'P') g.acc += r.pct; else g.sec += r.pct; });
    const cols = [rc.L1, rc.L2 || rc.M, rc.P || rc.K];
    const seg = (v, c) => `<s style="width:${v}%;background:${c || 'var(--line)'}"></s>`;
    const pairs = pairsInfo(scene, asg);
    const score = Math.round(clamp((an.harmonyScore + an.balanceScore) / 2, 0, 100));

    let html = `
      <div class="stu-score"><div class="stu-ring" style="--s:${score}"><b>${toPN(score)}</b></div>
        <div><b>${an.harmonyType}</b><p>هماهنگی ${toPN(an.harmonyScore)}٪ · تعادل ${toPN(Math.round(an.balanceScore))}٪</p></div></div>
      <div class="stu-bar3">
        <span><b>سطح واقعی</b><span>پایه ${toPN(Math.round(g.base))}٪ · ثانویه ${toPN(Math.round(g.sec))}٪ · تأکید ${toPN(Math.round(g.acc))}٪</span></span>
        <div>${seg(g.base, cols[0])}${seg(g.sec, cols[1])}${seg(g.acc, cols[2])}</div>
      </div>
      <div class="stu-bar3">
        <span><b>هدف ۶۰-۳۰-۱۰</b><span>پایه ۶۰٪ · ثانویه ۳۰٪ · تأکید ۱۰٪</span></span>
        <div>${seg(60, cols[0])}${seg(30, cols[1])}${seg(10, cols[2])}</div>
      </div>`;

    if (an.warnings.length) {
      html += an.warnings.slice(0, 3).map(w => `<div class="stu-alert ${w.level === 'warn' ? '' : 'info'}">${ICONS[w.level === 'warn' ? 'alert' : 'info']}<span>${w.text}</span></div>`).join('');
    } else {
      html += `<div class="stu-alert info">${ICONS.info}<span>هشداری برای این چیدمان وجود ندارد.</span></div>`;
    }

    html += `<div class="stu-block"><div class="stu-side-head"><span>رنگ‌ها و LRV</span></div><div class="stu-scroll"><table class="stu-tbl">
      <tr><th>رنگ</th><th>LRV</th><th>سهم</th><th>نقش</th></tr>
      ${an.colorStats.map(c => `<tr><td><span class="d" style="background:${c.hex}"></span><span class="n">${c.hex.toUpperCase()}</span></td><td>${toPN(c.lrv)}</td><td>${toPN(Math.round(c.share))}٪</td><td>${c.usage}</td></tr>`).join('')}
      </table></div></div>`;

    if (pairs.length) {
      html += `<div class="stu-block"><div class="stu-side-head"><span>کنتراست سطوح</span><span class="stu-hint-sm">WCAG</span></div><div class="stu-scroll"><table class="stu-tbl">
        <tr><th>جفت</th><th>رنگ‌ها</th><th>نسبت</th><th></th></tr>
        ${pairs.map(p => `<tr><td>${p.label}</td><td><span class="d" style="background:${p.ca}"></span><span class="d" style="background:${p.cb}"></span></td><td>${fmt(p.r, 1)}:۱</td>
          <td><span class="stu-tag ${p.r >= 3 ? 'ok' : p.r >= 1.5 ? 'mid' : 'no'}">${p.r >= 3 ? 'واضح' : p.r >= 1.5 ? 'ملایم' : 'ضعیف'}</span></td></tr>`).join('')}
        </table></div></div>`;
    }

    html += `<div class="stu-block"><div class="stu-side-head"><span>شبیه‌سازی کوررنگی</span></div><div class="stu-pills">
      ${[['', 'عادی'], ['pro', 'پروتانوپی'], ['deu', 'دوترانوپی'], ['tri', 'تریتانوپی']].map(([k, n]) => pill('cb', k, n, st.cb === k)).join('')}</div></div>`;
    wrap.innerHTML = html;
  }

  function renderExport() {
    const rows = buildSchedule();
    const total = rows.reduce((a, r) => a + (r.liters || 0), 0);
    $('#stuFin', root).innerHTML = `<tr><th>عنصر</th><th>رنگ</th><th>LRV</th><th>متریال</th><th>m² ≈</th><th>رنگ (لیتر)</th></tr>` +
      rows.map(r => `<tr><td>${layerLabel(SCENES[st.sceneId], r.l)}</td><td><span class="d" style="background:${r.hex}"></span><span class="n">${r.hex.toUpperCase()}</span></td><td>${toPN(lrv(r.hex))}</td><td>${MAT_FA[r.l.mat] || ''}</td><td>${fmt(r.area, 1)}</td><td>${r.liters ? fmt(r.liters, 1) : '—'}</td></tr>`).join('') +
      `<tr><td colspan="5"><b>جمع رنگ دیوار</b></td><td><b>${fmt(total, 1)}</b></td></tr>`;
    $('#stuSize', root).innerHTML = [[1600, '۱K'], [2400, '۲K'], [3600, '۴K']].map(([v, n]) => pill('size', v, n, st.size === v)).join('');
  }

  function renderTimeline() {
    const inner = $('#stuTlInner', root);
    $('#stuTlCount', root).textContent = st.history.length ? `${toPN(st.history.length)} مرحله` : '';
    if (!st.history.length) {
      inner.innerHTML = `<span class="stu-tl-empty">با اولین تغییر رنگ، تاریخچه اینجا ظاهر می‌شود.</span>`;
      return;
    }
    inner.innerHTML = st.history.map((h, i) => {
      const scene = SCENES[h.sceneId];
      const mini = buildSVG(scene, h.asg, st.palette.colors, st.light, ropts(h.sceneId, { selected: null, lite: true }));
      return `<button type="button" class="stu-tl-item ${i === st.history.length - 1 ? 'on' : ''}" data-tl="${i}" aria-label="مرحله ${toPN(i + 1)}">${mini}</button>`;
    }).join('');
    requestAnimationFrame(() => { try { inner.scrollTo({ left: inner.scrollWidth, behavior: 'smooth' }); } catch (e) {} });
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

  function renderHeader() {
    $('#stuName', root).textContent = st.palette.name;
    $('#stuMeta', root).textContent = SCENES[st.sceneId].name + ' — ' + SCENES[st.sceneId].subtitle;
  }

  function renderAll() {
    if (!st.palette) return;
    renderHeader(); renderScenes(); renderStage(); renderChips();
    renderColor(); renderMat(); renderLight(); renderAnalysis(); renderExport();
    renderTimeline(); renderTabs();
  }
  /* بعد از تغییر رنگ/چیدمان */
  function renderChanged() {
    renderStage(); renderChips(); renderColor(); renderAnalysis(); renderExport(); renderTimeline();
  }

  /* ============================================================
     عملیات
     ============================================================ */
  const snapAsg = () => JSON.parse(JSON.stringify(st.asgByScene[st.sceneId] || {}));
  function pushHistory() {
    st.history.push({ sceneId: st.sceneId, asg: snapAsg() });
    st.future = [];
    if (st.history.length > 12) st.history.shift();
  }

  function commitAssignment(next) {
    pushHistory();
    st.asgByScene[st.sceneId] = next;
    haptic.light();
    renderChanged();
  }

  function setLayerColor(layerId, idx) {
    const asg = ensureAssignment(st.sceneId);
    if (!asg || asg[layerId] === idx) return;
    if (st.lock.has(layerId)) { showStuToast('این بخش قفل است'); return; }
    st.why = '';
    commitAssignment({ ...asg, [layerId]: idx });
    haptic.medium();
  }

  function doShuffle() {
    const scene = SCENES[st.sceneId];
    const locked = {};
    for (const id of st.lock) locked[id] = true;
    const out = smartShuffle(scene, st.palette.colors, locked);
    if (!out) return;
    const next = { ...ensureAssignment(st.sceneId), ...out.result };
    const label = out.strategy === 'mono' ? 'تک‌رنگ' : out.strategy === 'analogous' ? 'آنالوگ' : out.strategy === 'complementary' ? 'مکمل' : 'سه‌گانه';
    const asgPrev = st.asgByScene[st.sceneId];
    st.asgByScene[st.sceneId] = next; // برای محاسبه‌ی متن توضیح
    const p = pairsInfo(scene, next)[0];
    st.asgByScene[st.sceneId] = asgPrev;
    st.why = `<b>چرا این چیدمان؟</b> هارمونی ${label}` + (p ? `؛ کنتراست ${p.label} ${fmt(p.r, 1)}:۱ است.` : '.');
    commitAssignment(next);
    haptic.success();
    showStuToast(`بُر هوشمند — استراتژی: ${label}`);
  }

  function afterJump() {
    const sc = SCENES[st.sceneId];
    if (!sc.layers.some(l => l.id === st.selected)) st.selected = defaultSel(st.sceneId);
    st.why = '';
    haptic.light();
    renderAll();
  }

  function doUndo() {
    if (!st.history.length) return;
    st.future.push({ sceneId: st.sceneId, asg: snapAsg() });
    const prev = st.history.pop();
    st.sceneId = prev.sceneId;
    st.asgByScene[prev.sceneId] = prev.asg;
    afterJump();
  }

  function doRedo() {
    if (!st.future.length) return;
    st.history.push({ sceneId: st.sceneId, asg: snapAsg() });
    const nx = st.future.pop();
    st.sceneId = nx.sceneId;
    st.asgByScene[nx.sceneId] = nx.asg;
    afterJump();
  }

  function doReset() {
    pushHistory();
    st.asgByScene[st.sceneId] = null;
    ensureAssignment(st.sceneId);
    st.lock.clear();
    for (const k of Object.keys(st.gloss)) if (k.startsWith(st.sceneId + ':')) delete st.gloss[k];
    afterJump();
  }

  function jumpToHistory(idx) {
    if (idx < 0 || idx >= st.history.length) return;
    const t = st.history[idx];
    st.sceneId = t.sceneId;
    st.asgByScene[t.sceneId] = JSON.parse(JSON.stringify(t.asg));
    st.history = st.history.slice(0, idx);
    st.future = [];
    afterJump();
  }

  function doCompare() {
    st.before = !st.before;
    $('#stuCompareBar', root).hidden = !st.before;
    $('#stuCmpBtn', root).setAttribute('aria-pressed', st.before);
    renderStage();
    haptic.light();
  }

  function setSplit(v) {
    st.splitX = clamp(v, 0, 100);
    if (cmp) { cmp.b.style.clipPath = `inset(0 ${100 - st.splitX}% 0 0)`; cmp.h.style.left = st.splitX + '%'; }
    const r = $('#stuSplit', root);
    if (r) r.value = st.splitX;
  }

  function applyBeforeAfter() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;
    const n = st.palette.colors.length;
    const grey = st.palette.colors.map((_, i) => {
      const v = Math.round(35 + (i / Math.max(1, n - 1)) * 160);
      return rgbToHex(v, v, v);
    });
    const o = ropts(null, { selected: null });
    stageEl.innerHTML = `<div class="stu-cmp">
        <div>${buildSVG(scene, asg, st.palette.colors, st.light, o)}</div>
        <div class="stu-cmp-b">${buildSVG(scene, asg, grey, st.light, o)}</div>
        <div class="stu-cmp-h"></div>
        <span class="stu-cmp-t l">بدون رنگ</span><span class="stu-cmp-t r">با پالت</span>
      </div>`;
    cmp = { b: $('.stu-cmp-b', stageEl), h: $('.stu-cmp-h', stageEl) };
    setSplit(st.splitX);
  }

  /* ---------- خروجی ---------- */
  async function doExport() {
    const scene = SCENES[st.sceneId];
    const asg = ensureAssignment(st.sceneId);
    if (!scene || !asg) return;
    try {
      let svg = buildSVG(scene, asg, st.palette.colors, st.light, ropts(null, { selected: null }));
      svg = svg.replace('<svg ', '<svg width="800" height="500" ');
      const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>${svg}`], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
      try { await document.fonts.load('900 58px Vazirmatn'); } catch (e) {}

      const BW = 2400, BH = 1500, sc = st.size / BW;
      const cv = document.createElement('canvas');
      cv.width = Math.round(BW * sc); cv.height = Math.round(BH * sc);
      const ctx = cv.getContext('2d');
      ctx.scale(sc, sc);
      ctx.drawImage(img, 0, 0, BW, BH);
      URL.revokeObjectURL(url);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, BH - 200, BW, 200);
      ctx.direction = 'rtl'; ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = '900 58px Vazirmatn, sans-serif';
      ctx.fillText(st.palette.name, BW - 60, BH - 120);
      ctx.font = '500 28px Vazirmatn, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`${scene.name} — ${LIGHTS[st.light].name}`, BW - 60, BH - 70);
      ctx.direction = 'ltr'; ctx.textAlign = 'left';
      ctx.font = '800 40px Vazirmatn, sans-serif';
      ctx.fillStyle = '#6FE3C4';
      ctx.fillText('RAVAQ', 60, BH - 90);
      const w = BW / st.palette.colors.length;
      st.palette.colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, BH - 40, w, 40); });

      cv.toBlob(async (b) => {
        if (!b) { showStuToast('ساخت تصویر ناموفق بود؛ اندازه‌ی کوچک‌تری امتحان کن'); return; }
        const file = new File([b], `ravaq-${st.palette.id}-${st.sceneId}.png`, { type: 'image/png' });
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: st.palette.name });
            haptic.success(); return;
          }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        downloadBlob(b, file.name);
        showStuToast('تصویر با قاب برند رواق ذخیره شد');
        haptic.success();
      }, 'image/png');
    } catch (e) {
      showStuToast('ذخیره‌ی تصویر ناموفق بود');
      try { console.warn('[ravaq-studio] export failed', e); } catch (_) {}
    }
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function doCSV() {
    const scene = SCENES[st.sceneId];
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['عنصر', 'HEX', 'RGB', 'CMYK', 'LAB', 'LRV', 'متریال', 'مساحت تقریبی m2', 'رنگ دیوار (لیتر)'];
    const lines = buildSchedule().map(r => [
      layerLabel(scene, r.l), r.hex.toUpperCase(), hexToRgb(r.hex).join(' '), toCMYK(r.hex).join(' '), toLAB(r.hex).join(' '),
      lrv(r.hex), MAT_FA[r.l.mat] || '', r.area.toFixed(1), r.liters ? r.liters.toFixed(1) : '',
    ]);
    const csv = '\ufeff' + [head, ...lines].map(r => r.map(q).join(',')).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `ravaq-${st.palette.id}-${st.sceneId}-schedule.csv`);
    showStuToast('جدول مشخصات ذخیره شد');
    haptic.success();
  }

  function copyText(text, msg) {
    const done = () => showStuToast(msg || 'کپی شد');
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); done();
      } catch (e) { showStuToast(text.split('\n')[0]); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function showStuToast(msg) {
    const t = (root && $('#stuToast', root)) || null;
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* ============================================================
     رویدادها
     ============================================================ */
  function focusables() {
    return $$('button:not([disabled]),input:not([disabled])', root).filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function bindEvents() {
    root.addEventListener('click', (e) => {
      const t = e.target;
      const sceneBtn = t.closest('[data-scene]');
      if (sceneBtn) {
        const id = sceneBtn.dataset.scene;
        if (id !== st.sceneId) {
          pushHistory();
          st.sceneId = id;
          ensureAssignment(id);
          st.selected = defaultSel(id);
          st.why = '';
          haptic.light();
          renderAll();
        }
        return;
      }
      const chip = t.closest('[data-chip]');
      if (chip) { selectLayer(st.selected === chip.dataset.chip ? null : chip.dataset.chip); return; }

      const tab = t.closest('[data-tab]');
      if (tab) { haptic.select(); setTab(tab.dataset.tab); return; }

      const lightBtn = t.closest('[data-light]');
      if (lightBtn) {
        st.light = lightBtn.dataset.light;
        st.t = PRESET_T[st.light];
        haptic.light();
        renderStage(); renderLight(); renderTimeline();
        return;
      }
      const pick = t.closest('[data-pick]');
      if (pick) {
        if (!st.selected) { showStuToast('اول یک بخش انتخاب کن'); return; }
        setLayerColor(st.selected, +pick.dataset.pick);
        return;
      }
      const fin = t.closest('[data-fin]');
      if (fin && st.selected) {
        st.gloss[glossKey(st.sceneId, st.selected)] = +fin.dataset.fin;
        haptic.select(); renderStage(); renderMat(); renderTimeline();
        return;
      }
      const dir = t.closest('[data-dir]');
      if (dir) { st.dir = dir.dataset.dir; haptic.select(); renderStage(); renderLight(); renderTimeline(); return; }
      const wx = t.closest('[data-wx]');
      if (wx) { st.wx = wx.dataset.wx; haptic.select(); renderStage(); renderLight(); renderTimeline(); return; }
      const kel = t.closest('[data-kel]');
      if (kel) { st.kelvin = +kel.dataset.kel; haptic.select(); renderStage(); renderLight(); renderTimeline(); return; }
      const cbBtn = t.closest('[data-cb]');
      if (cbBtn) { st.cb = cbBtn.dataset.cb; haptic.select(); renderStage(); renderAnalysis(); return; }
      const sz = t.closest('[data-size]');
      if (sz) { st.size = +sz.dataset.size; renderExport(); return; }

      const tl = t.closest('[data-tl]');
      if (tl) { jumpToHistory(+tl.dataset.tl); return; }

      const action = t.closest('[data-a]');
      if (action) {
        const a = action.dataset.a;
        if (a === 'close')    return close();
        if (a === 'shuffle')  return doShuffle();
        if (a === 'undo')     return doUndo();
        if (a === 'redo')     return doRedo();
        if (a === 'reset')    return doReset();
        if (a === 'compare')  return doCompare();
        if (a === 'export')   return doExport();
        if (a === 'csv')      return doCSV();
        if (a === 'goexport') { setTab('exp'); return; }
        if (a === 'lock' && st.selected) {
          st.lock.has(st.selected) ? st.lock.delete(st.selected) : st.lock.add(st.selected);
          haptic.select(); renderColor(); renderChips();
          return;
        }
        if (a === 'lamp') {
          st.lamp = !lampIsOn();
          haptic.select(); renderStage(); renderLight(); renderTimeline();
          return;
        }
        if (a === 'copy' && st.selected) {
          const asg = ensureAssignment(st.sceneId);
          copyText(st.palette.colors[asg[st.selected]].toUpperCase(), 'کد رنگ کپی شد');
          return;
        }
        if (a === 'copyall') {
          const scene = SCENES[st.sceneId], asg = ensureAssignment(st.sceneId);
          copyText(scene.layers.filter(l => l.role && asg[l.id] !== undefined)
            .map(l => `${layerLabel(scene, l)}: ${st.palette.colors[asg[l.id]].toUpperCase()}`).join('\n'), 'همه‌ی کدها کپی شد');
        }
      }
    });

    /* اسلایدرها */
    root.addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'stuSplit') { setSplit(+e.target.value); return; }
      if (id === 'stuTime') {
        st.fast = true;
        st.t = +e.target.value;
        st.light = nearestPreset(st.t);
        updateTimeLbl();
        renderStage();
        $$('.stu-light', root).forEach(b => { const on = b.dataset.light === st.light; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        const on = lampIsOn(), b = $('#stuLampBtn', root);
        b.setAttribute('aria-pressed', on);
        b.firstElementChild.textContent = on ? 'لوستر روشن' : 'لوستر خاموش';
        return;
      }
      if (id === 'stuGloss' && st.selected) {
        st.fast = true;
        const v = +e.target.value / 100;
        st.gloss[glossKey(st.sceneId, st.selected)] = v;
        $('#stuGlossV', root).textContent = toPN(Math.round(v * 100)) + '٪';
        renderStage();
      }
    });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'stuTime') { st.fast = false; renderStage(); renderTimeline(); }
      if (e.target.id === 'stuGloss') { st.fast = false; renderStage(); renderMat(); renderTimeline(); }
    });

    /* هاور و کشیدنِ مقایسه */
    const splitFrom = (e) => {
      const r = stageEl.getBoundingClientRect();
      if (r.width > 0) setSplit((e.clientX - r.left) / r.width * 100);
    };
    stageEl.addEventListener('pointerdown', (e) => {
      if (!st.before) return;
      dragging = true;
      try { stageEl.setPointerCapture(e.pointerId); } catch (_) {}
      splitFrom(e);
    });
    stageEl.addEventListener('pointermove', (e) => {
      if (st.before) { if (dragging) splitFrom(e); return; }
      const g = e.target.closest ? e.target.closest('.ly') : null;
      $('#stuHover', root).textContent = g ? g.dataset.n : 'روی هر بخش بزن تا انتخاب شود';
    });
    const endDrag = () => { dragging = false; };
    stageEl.addEventListener('pointerup', endDrag);
    stageEl.addEventListener('pointercancel', endDrag);
    stageEl.addEventListener('pointerleave', () => { if (!st.before) $('#stuHover', root).textContent = 'روی هر بخش بزن تا انتخاب شود'; });

    /* کیبورد: تب‌ها با فلش، تله‌ی فوکوس، Esc و Ctrl+Z */
    root.addEventListener('keydown', (e) => {
      const tabBtn = e.target.closest && e.target.closest('#stuTabs [data-tab]');
      if (tabBtn && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const tabs = $$('#stuTabs [data-tab]', root);
        const i = tabs.indexOf(tabBtn);
        const n = tabs[(i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length];
        e.preventDefault(); setTab(n.dataset.tab); n.focus();
        return;
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (!root || root.hidden) return;
      if (e.key === 'Escape') {
        if (st.selected) { selectLayer(null); }
        else close();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
      }
    });

    try { if (tg && tg.BackButton) tg.BackButton.onClick(() => { if (root && !root.hidden) close(); }); } catch (_) {}
  }

  /* ============================================================
     باز/بسته
     ============================================================ */
  function open(paletteId) {
    const gs = getGlobalState();
    const palettes = gs && Array.isArray(gs.palettes) ? gs.palettes : [];
    const p = palettes.find(x => x.id === paletteId);

    if (!p || !Array.isArray(p.colors) || p.colors.length < 2) {
      if (root) showStuToast('پالت پیدا نشد');
      try { console.warn('[ravaq-studio] palette not found or invalid:', paletteId, '| total:', palettes.length); } catch (e) {}
      return;
    }

    lastFocus = document.activeElement;
    if (!root) {
      injectCSS();
      root = buildShell();
      stageEl = $('#stuStage', root);
      bindEvents();
    }

    Object.assign(st, {
      palette: p, sceneId: 'living', asgByScene: {}, history: [], future: [], lock: new Set(),
      selected: null, light: 'day', before: false, splitX: 50,
      t: 13, dir: 'جنوبی', wx: 'آفتابی', lamp: null, kelvin: 3000,
      gloss: {}, cb: '', tab: 'color', why: '', size: 2400,
    });
    cmp = null;
    $('#stuCompareBar', root).hidden = true;
    $('#stuCmpBtn', root).setAttribute('aria-pressed', 'false');

    const tags = (p.tags || []).join(' ');
    if (tags.includes('اتاق خواب')) st.sceneId = 'bedroom';
    else if (tags.includes('آشپزخانه')) st.sceneId = 'kitchen';
    else if (tags.includes('حمام')) st.sceneId = 'bathroom';
    else if (tags.includes('اداری') || tags.includes('کتابخانه')) st.sceneId = 'office';
    else if (tags.includes('کافه')) st.sceneId = 'cafe';

    ensureAssignment(st.sceneId);
    st.selected = defaultSel(st.sceneId);

    root.hidden = false;
    document.body.style.overflow = 'hidden';
    renderAll();
    haptic.medium();
    try { if (tg && tg.BackButton) tg.BackButton.show(); } catch (_) {}
    const closeBtn = $('[data-a=close]', root);
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.style.overflow = '';
    st.before = false; cmp = null; dragging = false;
    $('#stuCompareBar', root).hidden = true;
    haptic.light();
    try { if (tg && tg.BackButton) tg.BackButton.hide(); } catch (_) {}
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (_) {}
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
      b.innerHTML = '<span>امتحان در فضا</span>';
      box.appendChild(b);
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-studio]');
    if (!b) return;
    const gs = getGlobalState();
    if (!gs || !Array.isArray(gs.palettes) || gs.palettes.length === 0) {
      try { tg && tg.showAlert ? tg.showAlert('هنوز پالت‌ها بارگذاری نشده‌اند') : alert('هنوز پالت‌ها بارگذاری نشده‌اند'); } catch (_) {}
      return;
    }
    open(b.dataset.studio);
  });

  const list = document.getElementById('list');
  if (list) {
    new MutationObserver(decorate).observe(list, { childList: true });
    decorate();
  }

  window.__ravaqStudio = {
    open, close,
    get SCENES() { return SCENES; },
    get LIGHTS() { return LIGHTS; },
    get state() { return st; },
  };
})();