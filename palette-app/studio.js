/* ============================================================
   رواق — استودیو چیدمان (نسخه ۷ — رئالِ معماری)
   ساختار و API حفظ شده — فقط موتور رندر و صحنه‌ها بازنویسی شدند
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
     متریال‌ها — با پارامترهای واقع‌گرایانه و بافتِ اختصاصی
     ============================================================ */
  const MAT = {
    wall:      { hl: 0.06, warm: 0.00, rough: 0.95, spec: 0.00, tex: 'plaster'  },
    wallGloss: { hl: 0.10, warm: 0.01, rough: 0.55, spec: 0.06, tex: 'plaster'  },
    stucco:    { hl: 0.05, warm: 0.02, rough: 0.97, spec: 0.00, tex: 'stucco'   },
    concrete:  { hl: 0.06, warm: -0.03, rough: 0.90, spec: 0.02, tex: 'concrete'},
    wood:      { hl: 0.12, warm: 0.03, rough: 0.55, spec: 0.08, tex: 'wood'     },
    woodDark:  { hl: 0.10, warm: 0.02, rough: 0.48, spec: 0.12, tex: 'wood'     },
    marble:    { hl: 0.20, warm: 0.00, rough: 0.14, spec: 0.55, tex: 'marble'   },
    tile:      { hl: 0.14, warm: 0.00, rough: 0.22, spec: 0.35, tex: 'tile'     },
    fabric:    { hl: 0.05, warm: 0.02, rough: 0.98, spec: 0.00, tex: 'fabric'   },
    velvet:    { hl: 0.15, warm: 0.05, rough: 0.45, spec: 0.05, tex: 'velvet'   },
    leather:   { hl: 0.18, warm: 0.04, rough: 0.40, spec: 0.18, tex: 'leather'  },
    metal:     { hl: 0.30, warm: 0.00, rough: 0.22, spec: 0.75, tex: 'metal'    },
    brass:     { hl: 0.28, warm: 0.10, rough: 0.28, spec: 0.65, tex: 'metal'    },
    plant:     { hl: 0.08, warm: 0.00, rough: 0.85, spec: 0.02, tex: 'leaf'     },
    art:       { hl: 0.10, warm: 0.02, rough: 0.50, spec: 0.04, tex: 'canvas'   },
    rug:       { hl: 0.04, warm: 0.03, rough: 0.99, spec: 0.00, tex: 'rug'      },
    glass:     { hl: 0.55, warm: -0.02, rough: 0.04, spec: 1.00, tex: 'glass'   },
    paper:     { hl: 0.06, warm: 0.02, rough: 0.90, spec: 0.00, tex: 'paper'    },
    terracotta:{ hl: 0.08, warm: 0.05, rough: 0.72, spec: 0.05, tex: 'clay'     },
  };

  /* ============================================================
     فیلترهای بافت — نسخه‌ی دقیق برای هر متریال
     ============================================================ */
  function textureFilters(id) {
    const filters = [];

    // گچ دیوار: نویز ریز + ناهمواریِ خیلی ملایم (شبیه گچ‌کاری دستی)
    filters.push(`
      <filter id="${id('tex-plaster')}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="2.8" numOctaves="4" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // استوکو: ناهمواریِ درشت
    filters.push(`
      <filter id="${id('tex-stucco')}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="5" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.55  0 0 0 0 0.55  0 0 0 0.14 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // بتن: نویز چندلایه با لکه‌های بزرگ
    filters.push(`
      <filter id="${id('tex-concrete')}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 1.1" numOctaves="5" seed="5" result="n1"/>
        <feTurbulence type="fractalNoise" baseFrequency="5" numOctaves="2" seed="3" result="n2"/>
        <feMerge result="nm">
          <feMergeNode in="n1"/>
          <feMergeNode in="n2"/>
        </feMerge>
        <feColorMatrix in="nm" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.11 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // چوب: رگه‌های جهت‌دار (افقی) — شبیه پارکت
    filters.push(`
      <filter id="${id('tex-wood')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.35" numOctaves="5" seed="17" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.38  0 0 0 0 0.22  0 0 0 0 0.10  0 0 0 0.42 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // مرمر: رگه‌های ارگانیک با کنتراست کم
    filters.push(`
      <filter id="${id('tex-marble')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.6 0.08" numOctaves="4" seed="23" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.44  0 0 0 0 0.42  0 0 0 0.42 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // سرامیک: بافتِ خیلی ملایم + درز از گرافیک
    filters.push(`
      <filter id="${id('tex-tile')}" x="-1%" y="-1%" width="102%" height="102%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="8" numOctaves="2" seed="2" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.035 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // پارچه: تار و پود
    filters.push(`
      <filter id="${id('tex-fabric')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="turbulence" baseFrequency="1.4 1.4" numOctaves="3" seed="6" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.13 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // مخمل: بافت جهت‌دار + براقیتِ نقطه‌ای
    filters.push(`
      <filter id="${id('tex-velvet')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.5 1.8" numOctaves="3" seed="9" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // چرم: بافتِ ارگانیک با سلول‌های ریز
    filters.push(`
      <filter id="${id('tex-leather')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.35 0.42" numOctaves="4" seed="14" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0 0.26  0 0 0 0.22 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // فلز: نویز ریز + بازتاب
    filters.push(`
      <filter id="${id('tex-metal')}" x="-1%" y="-1%" width="102%" height="102%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="12" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.02 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // برگ: رگبرگ
    filters.push(`
      <filter id="${id('tex-leaf')}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.4 1.6" numOctaves="3" seed="8" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.28  0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0.16 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // بوم: بافتِ کتان درشت
    filters.push(`
      <filter id="${id('tex-canvas')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="turbulence" baseFrequency="2.2 2.2" numOctaves="2" seed="19" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0.16 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // فرش: پشمیِ درشت با ضخامت
    filters.push(`
      <filter id="${id('tex-rug')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.8 1.5" numOctaves="4" seed="21" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0.20 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // شیشه: فقط یک درخشش ملایم
    filters.push(`
      <filter id="${id('tex-glass')}" x="-2%" y="-2%" width="104%" height="104%">
        <feGaussianBlur stdDeviation="0.25"/>
      </filter>`);

    // کاغذ: الیافِ ریز
    filters.push(`
      <filter id="${id('tex-paper')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="6" numOctaves="3" seed="3" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0.07 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    // سفال: نویز با لکه‌های گرم
    filters.push(`
      <filter id="${id('tex-clay')}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="4" seed="12" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.38  0 0 0 0 0.26  0 0 0 0.16 0" result="m"/>
        <feComposite in="m" in2="SourceGraphic" operator="over"/>
      </filter>`);

    return filters.join('');
  }

  /* ============================================================
     صحنه‌ها — هر فضا ابعاد و نسبت‌های واقعی خودش را دارد
     ============================================================ */
  const SCENES = {

    /* ------------------------------------------------ نشیمن */
    living: {
      name: 'نشیمنِ مدرن',
      subtitle: 'دیوارِ پنجره — نورِ جنوبی',
      // 5.5m عرض × 3.2m ارتفاع دیوار
      refs: { wallTop: 40, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        // لایه‌ی ۱: دیوارِ پشت
        { id: 'wall', name: 'دیوار', role: 'L1', mat: 'wall',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        // قرنیزِ سقف (پروفیل سه‌پله)
        { id: 'crown', name: 'قرنیزِ سقف', role: 'K', mat: 'wood',
          parts: [
            'M0,0 L800,0 L800,8 L0,8 Z',
            'M0,8 L800,8 L800,14 L0,14 Z',
            'M0,14 L800,14 L800,20 L0,20 Z'
          ] },
        // قرنیزِ کف (baseboard)
        { id: 'baseboard', name: 'قرنیزِ کف', role: 'K', mat: 'wood',
          parts: ['M0,332 L800,332 L800,340 L0,340 Z','M0,340 L800,340 L800,348 L0,348 Z'] },
        // پنجره‌ی عمیق — قابِ چهارلایه
        { id: 'window_frame_outer', name: 'قابِ بیرونیِ پنجره', role: 'L2', mat: 'woodDark',
          parts: ['M60,70 L268,70 L268,308 L60,308 Z'] },
        { id: 'window', name: 'شیشه', role: 'L2', mat: 'glass',
          parts: ['M76,86 L252,86 L252,292 L76,292 Z'] },
        // میله‌های پنجره
        { id: 'window_mullions', name: 'میله‌های پنجره', role: 'K', mat: 'woodDark',
          parts: [
            'M162,86 L168,86 L168,292 L162,292 Z',
            'M76,186 L252,186 L252,192 L76,192 Z'
          ] },
        // پرده‌های چین‌دار
        { id: 'curtain_l', name: 'پرده‌ی چپ', role: 'P', mat: 'fabric',
          parts: [
            'M28,60 Q34,180 30,320 L48,334 L96,334 L98,320 Q92,180 96,60 Z',
            'M48,60 Q44,180 50,320 L92,320 Q88,180 92,60 Z'
          ] },
        { id: 'curtain_r', name: 'پرده‌ی راست', role: 'P', mat: 'fabric',
          parts: [
            'M232,60 Q228,180 234,320 L240,334 L288,334 L290,320 Q284,180 288,60 Z',
            'M244,60 Q240,180 246,320 L288,320 Q284,180 288,60 Z'
          ] },
        // کف پارکت (پرسپکتیو)
        { id: 'floor', name: 'کف پارکت', role: 'M', mat: 'wood',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'wood-plank' },
        // فرش
        { id: 'rug', name: 'فرش دستباف', role: 'L2', mat: 'rug',
          parts: ['M120,430 L680,430 L716,482 L84,482 Z'] },
        // مبل سه‌نفره — با درز و چینِ واقعی
        { id: 'sofa_back', name: 'پشتِ مبل', role: 'D', mat: 'fabric',
          parts: [
            'M226,252 Q226,246 234,246 L566,246 Q574,246 574,252 L574,346 L226,346 Z'
          ] },
        { id: 'sofa_arm_l', name: 'دسته‌ی چپ', role: 'D', mat: 'fabric',
          parts: ['M198,266 Q198,248 218,248 L242,248 L242,412 L198,412 Z'] },
        { id: 'sofa_arm_r', name: 'دسته‌ی راست', role: 'D', mat: 'fabric',
          parts: ['M558,248 L582,248 Q602,248 602,266 L602,412 L558,412 Z'] },
        { id: 'sofa_seat', name: 'نشیمن', role: 'L2', mat: 'fabric',
          parts: [
            'M218,338 Q218,334 224,334 L390,334 L390,412 L218,412 Z',
            'M410,334 L582,334 Q588,334 588,338 L588,412 L410,412 Z'
          ] },
        { id: 'cushions', name: 'کوسن‌ها', role: 'P', mat: 'velvet',
          parts: [
            'M244,300 Q248,294 256,294 L306,294 Q314,294 318,300 L324,346 L240,346 Z',
            'M482,300 Q486,294 494,294 L544,294 Q552,294 556,300 L560,346 L478,346 Z'
          ] },
        // میز جلومبلی
        { id: 'coffee_top', name: 'رویه‌یِ میز', role: 'K', mat: 'woodDark',
          parts: ['M286,440 Q288,434 296,434 L504,434 Q512,434 514,440 L526,462 L274,462 Z'] },
        { id: 'coffee_leg', name: 'پایه‌یِ میز', role: 'K', mat: 'woodDark',
          parts: ['M300,462 L500,462 L500,492 L300,492 Z'] },
        // گلدانِ سفالی + برگ‌های ارگانیک
        { id: 'plant_pot', name: 'گلدان', role: 'P', mat: 'terracotta',
          parts: ['M688,386 Q690,380 696,380 L734,380 Q740,380 742,386 L736,458 L694,458 Z'] },
        { id: 'plant_leaf', name: 'برگ‌ها', role: 'P', mat: 'plant',
          parts: [
            'M716,380 Q698,348 678,336 Q700,356 712,378 Z',
            'M718,380 Q734,342 752,330 Q732,354 722,378 Z',
            'M716,380 Q718,348 714,324 Q710,350 712,378 Z',
            'M714,380 Q726,350 740,340 Q722,362 718,378 Z'
          ] },
        // آباژورِ ایستاده
        { id: 'lamp_base', name: 'پایه‌یِ آباژور', role: 'K', mat: 'metal',
          parts: [
            'M116,462 Q116,458 120,458 L166,458 Q170,458 170,462 L170,480 L116,480 Z',
            'M140,296 L146,296 L146,458 L140,458 Z'
          ] },
        { id: 'lamp_shade', name: 'شفره‌یِ آباژور', role: 'L2', mat: 'fabric',
          parts: ['M108,254 L178,254 L194,296 L92,296 Z'] },
        // تابلو با قاب
        { id: 'art_frame', name: 'قابِ تابلو', role: 'K', mat: 'woodDark',
          parts: ['M340,102 L460,102 L460,214 L340,214 Z'] },
        { id: 'art', name: 'تابلو', role: 'P', mat: 'art',
          parts: ['M348,110 L452,110 L452,206 L348,206 Z'] },
      ],
    },

    /* ------------------------------------------------ اتاق خواب */
    bedroom: {
      name: 'اتاقِ خوابِ گرم',
      subtitle: 'دیوارِ تأکیدیِ تاج — نورِ عصر',
      refs: { wallTop: 40, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        { id: 'wall', name: 'دیوار', role: 'L1', mat: 'wall',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        // دیوارِ تأکیدی (پشتِ تخت) — با لبه‌های نرم
        { id: 'accent', name: 'دیوارِ تأکیدی', role: 'D', mat: 'wallGloss',
          parts: ['M180,30 Q180,24 188,24 L612,24 Q620,24 620,30 L620,348 L180,348 Z'] },
        { id: 'crown', name: 'قرنیزِ سقف', role: 'K', mat: 'wood',
          parts: ['M0,0 L800,0 L800,8 L0,8 Z','M0,8 L800,8 L800,16 L0,16 Z'] },
        { id: 'baseboard', name: 'قرنیزِ کف', role: 'K', mat: 'wood',
          parts: ['M0,332 L800,332 L800,340 L0,340 Z','M0,340 L800,340 L800,348 L0,348 Z'] },
        { id: 'floor', name: 'کف', role: 'M', mat: 'wood',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'wood-plank' },
        { id: 'rug', name: 'فرش', role: 'L2', mat: 'rug',
          parts: ['M100,432 L700,432 L730,484 L70,484 Z'] },
        // تخت با تاجِ مخملی
        { id: 'headboard', name: 'تاجِ تخت', role: 'K', mat: 'velvet',
          parts: [
            'M198,160 Q198,154 206,154 L594,154 Q602,154 602,160 L602,286 L198,286 Z',
            'M198,160 L214,140 Q400,132 586,140 L602,160 Z'
          ] },
        { id: 'bedbody', name: 'بدنه‌یِ تخت', role: 'D', mat: 'fabric',
          parts: ['M198,286 Q198,282 204,282 L596,282 Q602,282 602,286 L602,414 L198,414 Z'] },
        { id: 'mattress', name: 'تشک', role: 'M', mat: 'fabric',
          parts: ['M198,308 Q198,304 204,304 L596,304 Q602,304 602,308 L602,414 L198,414 Z'] },
        { id: 'pillow_l', name: 'بالشِ چپ', role: 'L1', mat: 'fabric',
          parts: ['M222,254 Q226,248 234,248 L336,248 Q344,248 348,254 L352,306 L216,306 Z'] },
        { id: 'pillow_r', name: 'بالشِ راست', role: 'L1', mat: 'fabric',
          parts: ['M452,254 Q456,248 464,248 L566,248 Q574,248 578,254 L582,306 L448,306 Z'] },
        { id: 'throw', name: 'پتو', role: 'P', mat: 'velvet',
          parts: ['M360,308 Q360,304 366,304 L520,304 Q526,304 526,308 L536,398 L354,398 Z'] },
        // پاتختی‌ها
        { id: 'night_l', name: 'پاتختی چپ', role: 'K', mat: 'wood',
          parts: ['M100,322 L182,322 L182,412 L100,412 Z'] },
        { id: 'night_r', name: 'پاتختی راست', role: 'K', mat: 'wood',
          parts: ['M618,322 L700,322 L700,412 L618,412 Z'] },
        // آباژورهای برنجی
        { id: 'lamp_l', name: 'آباژورِ چپ', role: 'P', mat: 'brass',
          parts: [
            'M136,308 L146,308 L146,322 L136,322 Z',
            'M114,272 L168,272 L162,308 L120,308 Z'
          ] },
        { id: 'lamp_r', name: 'آباژورِ راست', role: 'P', mat: 'brass',
          parts: [
            'M654,308 L664,308 L664,322 L654,322 Z',
            'M632,272 L686,272 L680,308 L638,308 Z'
          ] },
        // تابلو
        { id: 'art', name: 'تابلو', role: 'P', mat: 'art',
          parts: ['M348,86 Q348,80 354,80 L446,80 Q452,80 452,86 L452,148 L348,148 Z'] },
      ],
    },

    /* ------------------------------------------------ آشپزخانه */
    kitchen: {
      name: 'آشپزخانه‌یِ مدرن',
      subtitle: 'کانترِ مرمری — نورِ روز',
      refs: { wallTop: 30, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        { id: 'wall', name: 'دیوار', role: 'L1', mat: 'wall',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        // کابینت‌های بالا (سه بخش)
        { id: 'upper', name: 'کابینتِ بالا', role: 'L2', mat: 'wallGloss',
          parts: [
            'M40,36 Q40,32 46,32 L252,32 L252,148 L40,148 Z',
            'M280,32 L488,32 Q494,32 494,36 L494,148 L280,148 Z',
            'M522,32 L752,32 Q758,32 758,36 L758,148 L522,148 Z'
          ] },
        // میان‌کابینتی
        { id: 'splash', name: 'میان‌کابینتی', role: 'L1', mat: 'tile',
          parts: ['M40,148 L760,148 L760,224 L40,224 Z'] },
        // کف سرامیک
        { id: 'floor', name: 'کف', role: 'K', mat: 'tile',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'tile' },
        // سنگ کانتر (مرمر)
        { id: 'counter', name: 'سنگِ کانتر', role: 'M', mat: 'marble',
          parts: ['M20,224 Q20,220 26,220 L774,220 Q780,220 780,224 L780,244 L20,244 Z'] },
        // کابینت پایین
        { id: 'lower', name: 'کابینتِ پایین', role: 'D', mat: 'wallGloss',
          parts: ['M40,244 Q40,240 46,240 L754,240 Q760,240 760,244 L760,404 L40,404 Z'] },
        // دستگیره‌های برنجی
        { id: 'hardware', name: 'دستگیره‌ها', role: 'P', mat: 'brass',
          parts: [
            'M118,302 Q118,300 120,300 L126,300 Q128,300 128,302 L128,344 L118,344 Z',
            'M160,302 Q160,300 162,300 L168,300 Q170,300 170,302 L170,344 L160,344 Z',
            'M398,302 Q398,300 400,300 L406,300 Q408,300 408,302 L408,344 L398,344 Z',
            'M440,302 Q440,300 442,300 L448,300 Q450,300 450,302 L450,344 L440,344 Z',
            'M560,302 Q560,300 562,300 L568,300 Q570,300 570,302 L570,344 L560,344 Z',
            'M602,302 Q602,300 604,300 L610,300 Q612,300 612,302 L612,344 L602,344 Z',
            'M718,302 Q718,300 720,300 L726,300 Q728,300 728,302 L728,344 L718,344 Z'
          ] },
        // هود فلزی
        { id: 'hood', name: 'هود', role: 'P', mat: 'metal',
          parts: ['M316,4 L484,4 L468,42 L332,42 Z'] },
        // شیر برنجی
        { id: 'faucet', name: 'شیرآلات', role: 'P', mat: 'brass',
          parts: [
            'M394,200 L406,200 L406,222 L394,222 Z',
            'M400,200 Q400,176 418,176 L438,176 Q442,176 442,180 L442,186 Q442,190 438,190 L422,190 Q412,190 412,200 Z'
          ] },
        // زیرپایی
        { id: 'rug', name: 'زیرپایی', role: 'L2', mat: 'rug',
          parts: ['M294,428 L506,428 L534,480 L266,480 Z'] },
      ],
    },

    /* ------------------------------------------------ حمام */
    bathroom: {
      name: 'حمامِ اسپا',
      subtitle: 'کاشیِ سرتاسری — روشوییِ مرمری',
      refs: { wallTop: 30, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        { id: 'wall', name: 'دیوارِ کاشی', role: 'L1', mat: 'tile',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        { id: 'accent', name: 'دیوارِ تأکیدی', role: 'D', mat: 'tile',
          parts: ['M240,40 L560,40 L560,348 L240,348 Z'] },
        { id: 'floor', name: 'کفِ کاشی', role: 'M', mat: 'tile',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'tile' },
        // آینه با قاب
        { id: 'mirror_frame', name: 'قابِ آینه', role: 'K', mat: 'brass',
          parts: ['M310,70 Q310,66 314,66 L486,66 Q490,66 490,70 L490,232 L310,232 Z'] },
        { id: 'mirror', name: 'آینه', role: 'L2', mat: 'glass',
          parts: ['M318,78 L482,78 L482,224 L318,224 Z'] },
        // کابینتِ روشویی
        { id: 'vanity', name: 'کابینتِ روشویی', role: 'L2', mat: 'wood',
          parts: ['M296,244 Q296,240 302,240 L498,240 Q504,240 504,244 L504,404 L296,404 Z'] },
        // روشویی سنگی
        { id: 'basin', name: 'روشویی', role: 'P', mat: 'marble',
          parts: ['M306,222 Q308,216 316,216 L484,216 Q492,216 494,222 L500,236 L500,262 L300,262 L300,236 Z'] },
        // شیر
        { id: 'faucet', name: 'شیرآلات', role: 'P', mat: 'brass',
          parts: [
            'M394,196 L406,196 L406,228 L394,228 Z',
            'M400,196 Q400,174 416,174 L432,174 Q436,174 436,178 L436,184 Q436,188 432,188 L420,188 Q410,188 410,196 Z'
          ] },
        // حوله‌ها
        { id: 'towel_1', name: 'حوله‌ها', role: 'P', mat: 'fabric',
          parts: ['M632,148 Q632,142 638,142 L680,142 Q686,142 686,148 L686,212 L632,212 Z'] },
        { id: 'towel_2', name: 'حوله‌ها', role: 'P', mat: 'fabric',
          parts: ['M636,220 Q636,214 640,214 L676,214 Q682,214 682,220 L682,286 L636,286 Z'] },
        // زیرپایی
        { id: 'mat', name: 'زیرپایی', role: 'P', mat: 'rug',
          parts: ['M300,422 L500,422 L528,472 L272,472 Z'] },
      ],
    },

    /* ------------------------------------------------ دفتر کار */
    office: {
      name: 'دفترِ کار',
      subtitle: 'میزِ چوبی — قفسه‌یِ کتاب',
      refs: { wallTop: 40, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        { id: 'wall', name: 'دیوار', role: 'L1', mat: 'wall',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        { id: 'crown', name: 'قرنیزِ سقف', role: 'K', mat: 'wood',
          parts: ['M0,0 L800,0 L800,8 L0,8 Z','M0,8 L800,8 L800,14 L0,14 Z'] },
        { id: 'baseboard', name: 'قرنیزِ کف', role: 'K', mat: 'wood',
          parts: ['M0,332 L800,332 L800,340 L0,340 Z','M0,340 L800,340 L800,348 L0,348 Z'] },
        { id: 'floor', name: 'کف', role: 'M', mat: 'wood',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'wood-plank' },
        { id: 'rug', name: 'فرش', role: 'L2', mat: 'rug',
          parts: ['M220,438 L580,438 L606,484 L194,484 Z'] },
        // تابلو
        { id: 'art', name: 'تابلو', role: 'P', mat: 'art',
          parts: ['M320,106 Q320,100 328,100 L472,100 Q480,100 480,106 L480,214 L320,214 Z'] },
        // کتابخانه
        { id: 'shelf', name: 'کتابخانه', role: 'K', mat: 'wood',
          parts: ['M612,72 L764,72 L764,404 L612,404 Z'] },
        // کتاب‌ها
        { id: 'books', name: 'کتاب‌ها', role: 'P', mat: 'paper',
          parts: [
            'M626,108 Q626,104 630,104 L654,104 Q658,104 658,108 L658,178 L626,178 Z',
            'M662,116 L686,116 L686,178 L662,178 Z',
            'M690,102 L712,102 L712,178 L690,178 Z',
            'M716,112 L740,112 L740,178 L716,178 Z',
            'M626,198 L650,198 L650,258 L626,258 Z',
            'M654,208 L678,208 L678,258 L654,258 Z',
            'M682,194 L706,194 L706,258 L682,258 Z',
            'M626,286 L652,286 L652,344 L626,344 Z',
            'M656,296 L680,296 L680,344 L656,344 Z'
          ] },
        // میزِ کار
        { id: 'desk', name: 'میزِ کار', role: 'D', mat: 'woodDark',
          parts: [
            'M160,322 Q160,316 168,316 L632,316 Q640,316 640,322 L640,342 L160,342 Z',
            'M170,342 L182,342 L182,414 L170,414 Z',
            'M618,342 L630,342 L630,414 L618,414 Z'
          ] },
        // مانیتور
        { id: 'monitor', name: 'مانیتور', role: 'P', mat: 'metal',
          parts: [
            'M340,236 Q340,232 344,232 L456,232 Q460,232 460,236 L460,310 L340,310 Z',
            'M390,310 L410,310 L410,322 L390,322 Z',
            'M360,322 L440,322 L440,330 L360,330 Z'
          ] },
        // صندلی اداری
        { id: 'chair', name: 'صندلی', role: 'K', mat: 'velvet',
          parts: [
            'M362,350 Q362,344 368,344 L432,344 Q438,344 438,350 L438,402 L362,402 Z',
            'M352,398 Q352,392 358,392 L442,392 Q448,392 448,398 L448,418 L352,418 Z',
            'M368,418 L378,418 L378,442 L368,442 Z',
            'M422,418 L432,418 L432,442 L422,442 Z'
          ] },
        // گلدان
        { id: 'plant_pot', name: 'گلدان', role: 'P', mat: 'terracotta',
          parts: ['M86,326 Q88,320 94,320 L146,320 Q152,320 154,326 L148,414 L92,414 Z'] },
        { id: 'plant_leaf', name: 'برگ‌ها', role: 'P', mat: 'plant',
          parts: [
            'M120,326 Q104,290 84,278 Q106,300 116,324 Z',
            'M122,326 Q138,286 156,274 Q136,300 126,324 Z',
            'M120,326 Q122,290 118,268 Q112,296 114,324 Z',
            'M121,326 Q134,296 146,286 Q128,308 124,324 Z'
          ] },
        // آباژور رومیزی
        { id: 'lamp', name: 'آباژورِ رومیزی', role: 'L2', mat: 'metal',
          parts: [
            'M472,296 Q472,294 474,294 L486,294 Q488,294 488,296 L488,326 L472,326 Z',
            'M462,266 L496,266 L492,296 L466,296 Z'
          ] },
      ],
    },

    /* ------------------------------------------------ کافه */
    cafe: {
      name: 'کافه',
      subtitle: 'کانترِ چوبی — نورِ آویز',
      refs: { wallTop: 20, wallBottom: 348, floorBottom: 500, cx: 400 },
      layers: [
        { id: 'wall', name: 'دیوار', role: 'L1', mat: 'stucco',
          parts: ['M0,0 L800,0 L800,348 L0,348 Z'] },
        // نوارِ آجریِ بالای دیوار
        { id: 'brick', name: 'نوارِ آجری', role: 'D', mat: 'concrete',
          parts: ['M0,0 L800,0 L800,110 L0,110 Z'] },
        { id: 'floor', name: 'کفِ کافه', role: 'K', mat: 'tile',
          parts: ['M0,348 L800,348 L800,500 L0,500 Z'], texture: 'tile' },
        // قفسه‌یِ بطری‌ها
        { id: 'shelf', name: 'قفسه', role: 'D', mat: 'woodDark',
          parts: [
            'M110,116 Q110,112 116,112 L684,112 Q690,112 690,116 L690,132 L110,132 Z',
            'M110,176 L690,176 L690,192 L110,192 Z'
          ] },
        // بطری‌ها
        { id: 'bottles', name: 'بطری‌ها', role: 'P', mat: 'glass',
          parts: [
            'M144,72 Q146,68 152,68 L162,68 Q168,68 170,72 L170,112 L144,112 Z',
            'M182,84 L196,84 L196,112 L182,112 Z',
            'M214,78 L228,78 L228,112 L214,112 Z',
            'M250,92 L264,92 L264,112 L250,112 Z',
            'M498,80 L512,80 L512,112 L498,112 Z',
            'M538,90 L552,90 L552,112 L538,112 Z',
            'M574,84 L588,84 L588,112 L574,112 Z'
          ] },
        // کانتر
        { id: 'counter', name: 'کانترِ چوبی', role: 'M', mat: 'wood',
          parts: ['M80,240 L720,240 L720,400 L80,400 Z'] },
        { id: 'counter_top', name: 'سنگِ کانتر', role: 'L2', mat: 'marble',
          parts: ['M70,224 Q70,220 78,220 L722,220 Q730,220 730,224 L730,242 L70,242 Z'] },
        // صندلی‌های چرمی
        { id: 'stool_1', name: 'صندلی', role: 'K', mat: 'leather',
          parts: [
            'M148,400 Q148,394 154,394 L196,394 Q202,394 202,400 L202,416 L148,416 Z',
            'M156,416 L164,416 L164,468 L156,468 Z',
            'M184,416 L192,416 L192,468 L184,468 Z'
          ] },
        { id: 'stool_2', name: 'صندلی', role: 'K', mat: 'leather',
          parts: [
            'M298,400 Q298,394 304,394 L346,394 Q352,394 352,400 L352,416 L298,416 Z',
            'M306,416 L314,416 L314,468 L306,468 Z',
            'M334,416 L342,416 L342,468 L334,468 Z'
          ] },
        { id: 'stool_3', name: 'صندلی', role: 'K', mat: 'leather',
          parts: [
            'M448,400 Q448,394 454,394 L496,394 Q502,394 502,400 L502,416 L448,416 Z',
            'M456,416 L464,416 L464,468 L456,468 Z',
            'M484,416 L492,416 L492,468 L484,468 Z'
          ] },
        { id: 'stool_4', name: 'صندلی', role: 'K', mat: 'leather',
          parts: [
            'M598,400 Q598,394 604,394 L646,394 Q652,394 652,400 L652,416 L598,416 Z',
            'M606,416 L614,416 L614,468 L606,468 Z',
            'M634,416 L642,416 L642,468 L634,468 Z'
          ] },
        // چراغ‌های آویزِ برنجی
        { id: 'pendant_1', name: 'چراغِ آویز', role: 'P', mat: 'brass',
          parts: [
            'M178,0 L178,58 L182,58 L182,0 Z',
            'M156,58 L206,58 L216,102 L146,102 Z'
          ] },
        { id: 'pendant_2', name: 'چراغِ آویز', role: 'P', mat: 'brass',
          parts: [
            'M398,0 L398,58 L402,58 L402,0 Z',
            'M376,58 L426,58 L436,102 L366,102 Z'
          ] },
        { id: 'pendant_3', name: 'چراغِ آویز', role: 'P', mat: 'brass',
          parts: [
            'M618,0 L618,58 L622,58 L622,0 Z',
            'M596,58 L646,58 L656,102 L586,102 Z'
          ] },
      ],
    },
  };

  /* ============================================================
     نور
     ============================================================ */
  const LIGHTS = {
    dawn:  { name: 'صبح', icon: 'sunrise' },
    day:   { name: 'روز',  icon: 'sun' },
    dusk:  { name: 'عصر',  icon: 'sunset' },
    night: { name: 'شب',   icon: 'moon' },
  };

  const KELVIN = { 2700: '#FFB070', 3000: '#FFC88E', 4000: '#FFE4C6', 6500: '#E6EEFF' };

  function lightParams(t, dir, wx, lampOn, lampKelvin) {
    const sv = (t >= 20 || t < 5) ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
    const dayAmt = clamp(sv * 1.15, 0, 1);
    let skyTint = '#FFFFFF';
    if (t < 9)      skyTint = mixHex('#B8D0E8', '#FFE8C8', clamp((t - 6) / 3, 0, 1));
    else if (t < 15) skyTint = mixHex('#FFE8C8', '#FFFFFF', clamp((t - 9) / 6, 0, 1));
    else if (t < 18) skyTint = mixHex('#FFFFFF', '#FFC088', clamp((t - 15) / 3, 0, 1));
    else if (t < 20) skyTint = mixHex('#FFC088', '#8A5A48', clamp((t - 18) / 2, 0, 1));
    else             skyTint = '#3A4460';
    let lx = 0.55;
    if (dir === 'شمالی') lx = 0;
    if (dir === 'شرقی')  lx = 0.85;
    if (dir === 'غربی')  lx = -0.85;
    if (wx === 'ابری') { lx *= 0.5; skyTint = mixHex(skyTint, '#98A0B0', 0.35); }
    const lampC = lampOn ? (KELVIN[lampKelvin] || KELVIN[3000]) : null;
    return { dayAmt, skyTint, lx, lampOn, lampC };
  }

  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function bbox(parts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    parts.forEach(d => {
      const n = d.match(/-?\d+\.?\d*/g).map(Number);
      for (let i = 0; i + 1 < n.length; i += 2) {
        x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
        y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
      }
    });
    return { x0, y0, x1, y1 };
  }

  /* ============================================================
     موتور رندر
     ============================================================ */
  let _svgUid = 0;

  function realismKit(scene, asg, pal, opts, id, lite) {
    const L = opts.light || { t: 13, lamp: null, kelvin: 3000, dir: 'جنوبی', wx: 'آفتابی' };
    const LP = lightParams(L.t, L.dir || 'جنوبی', L.wx || 'آفتابی', L.lamp === null ? (L.t >= 20 || L.t < 5.5) : !!L.lamp, L.kelvin || 3000);
    const { dayAmt, skyTint, lx, lampOn, lampC } = LP;

    const f = n => (+n).toFixed(1);
    const defs = [];
    const byId = {};
    scene.layers.forEach(l => byId[l.id] = l);
    const win = byId.window, wb = win ? bbox(win.parts) : null;

    const NOP = ['floor', 'rug', 'wall', 'accent', 'crown', 'window', 'mirror', 'baseboard', 'window_frame_outer', 'window_mullions', 'brick'];
    const NOB = ['wall', 'floor', 'crown', 'window', 'accent', 'rug', 'window_frame_outer', 'window_mullions', 'baseboard'];
    const isProp = l => {
      if (NOP.includes(l.id)) return false;
      const b = bbox(l.parts);
      return b.y1 > 350 && b.y1 <= 500;
    };

    const cpOf = (l, n) => {
      const c = id('cp-' + n);
      defs.push(`<clipPath id="${c}">${l.parts.map(d => `<path d="${d}"/>`).join('')}</clipPath>`);
      return c;
    };
    const grad = (n, x1, y1, x2, y2, stops, user) => {
      defs.push(`<linearGradient id="${id(n)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2]}"/>`).join('')}</linearGradient>`);
      return `url(#${id(n)})`;
    };
    const rad = (n, cx, cy, r, col, o) => {
      defs.push(`<radialGradient id="${id(n)}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"><stop offset="0" stop-color="${col}" stop-opacity="${o}"/><stop offset="0.55" stop-color="${col}" stop-opacity="${f(o * 0.22)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`);
      return `url(#${id(n)})`;
    };

    defs.push(`<filter id="${id('rb')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>`);
    defs.push(`<filter id="${id('rbSoft')}" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>`);
    defs.push(`<filter id="${id('rbHuge')}" x="-50%" y="-30%" width="200%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>`);

    const fl = byId.floor;
    const gl = (opts.gloss && opts.gloss.floor !== undefined) ? opts.gloss.floor
              : (fl && (MAT[fl.mat] || MAT.wood).rough < 0.5 ? 0.32 : 0.05);

    /* -------- کفِ پرسپکتیو با تخته‌ها یا کاشی‌های واقعی -------- */
    function floorTex(l) {
      const isTile = l.texture === 'tile', rn = rng(isTile ? 5 : 9);
      const vx = 400, vy = 140, ya = 348, yb = 500;
      const step = isTile ? 100 : 56;
      const zmax = (yb - vy) / (ya - vy);
      const px = (X, y) => vx + (X - vx) * (y - vy) / (yb - vy);
      const yz = z => vy + (yb - vy) / z;
      const cp = cpOf(l, 'floor');
      let h = '';
      // شیارِ تخته/کاشی با پرسپکتیو
      for (let i = 0; i < 80; i++) {
        const X0 = -1400 + i * step, X1 = X0 + step;
        if (px(X1, ya) < -30 || px(X0, ya) > 830) continue;
        const cuts = [1]; let z = isTile ? 1 + 0.14 : 1 + ((i * 0.137) % 1) * 0.42;
        for (; z < zmax; z += isTile ? 0.14 : 0.42) cuts.push(z);
        cuts.push(zmax);
        for (let k = 0; k + 1 < cuts.length; k++) {
          const A = yz(cuts[k]), B = yz(cuts[k + 1]), r = rn();
          const tone = r < 0.5 ? `rgba(0,0,0,${f((0.5 - r) * 0.20)})` : `rgba(255,255,255,${f((r - 0.5) * 0.14)})`;
          h += `<path d="M${f(px(X0, A))},${f(A)} L${f(px(X1, A))},${f(A)} L${f(px(X1, B))},${f(B)} L${f(px(X0, B))},${f(B)} Z" fill="${tone}" stroke="rgba(0,0,0,${isTile ? 0.30 : 0.22})" stroke-width="${isTile ? 1.2 : 0.8}"/>`;
        }
      }
      return `<g pointer-events="none" clip-path="url(#${cp})">${h}</g>`;
    }

    /* -------- منظره‌ی بیرون از پنجره -------- */
    function sky(l) {
      const b = wb, W = b.x1 - b.x0, H = b.y1 - b.y0, cp = cpOf(l, 'sky');
      const a = clamp(dayAmt * 4, 0, 1), d = clamp((dayAmt - 0.25) / 0.5, 0, 1);
      const top = mixHex(mixHex('#0A1428', '#4A4A8A', a), '#4F9BE6', d);
      const bot = mixHex(mixHex('#1A2A55', '#F6B27A', a), '#CFE7FB', d);
      const g = grad('sky', 0, 0, 0, 1, [[0, top, 1], [1, bot, 1]]);
      const rr = rng(5);
      let bld = '', x = b.x0;
      while (x < b.x1) {
        const w = 8 + rr() * 20, hh = H * (0.08 + rr() * 0.30);
        bld += `<rect x="${f(x)}" y="${f(b.y1 - hh)}" width="${f(w)}" height="${f(hh + 2)}"/>`;
        x += w + 1;
      }
      const ph = clamp((L.t - 6) / 14, 0.05, 0.95);
      const sunPos = [b.x0 + W * ph, b.y0 + H * (0.75 - 0.5 * Math.sin(Math.PI * ph))];
      const sun = dayAmt > 0.02 ? `<rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${rad('sun', sunPos[0], sunPos[1], W * 1.1, '#FFF3D6', f(0.4 + dayAmt * 0.55))}"/>` : '';
      let stars = '';
      if (dayAmt < 0.08) for (let i = 0; i < 16; i++) stars += `<circle cx="${f(b.x0 + rr() * W)}" cy="${f(b.y0 + rr() * H * 0.5)}" r="${f(0.4 + rr() * 0.7)}" fill="#fff" opacity="${f(0.35 + rr() * 0.55)}"/>`;
      const tint = pal[asg.window] || '#fff';
      return `<g pointer-events="none" clip-path="url(#${cp})">
        <rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${g}"/>
        ${sun}${stars}
        <g fill="${mixHex(bot, '#0A0F1E', 0.55)}" opacity="0.9">${bld}</g>
        <rect x="${b.x0}" y="${b.y0}" width="${W}" height="${H}" fill="${tint}" opacity="0.10"/>
        <path d="M${b.x0 + W * 0.12},${b.y1} L${b.x0 + W * 0.42},${b.y0} L${b.x0 + W * 0.58},${b.y0} L${b.x0 + W * 0.28},${b.y1} Z" fill="#fff" opacity="0.07"/>
      </g>`;
    }

    /* -------- نقشِ فرشِ دستباف -------- */
    function rugMotif(l) {
      const n = l.parts[0].match(/-?\d+\.?\d*/g).map(Number);
      const A = [n[0], n[1]], B = [n[2], n[3]], C = [n[4], n[5]], D = [n[6], n[7]];
      const P = (u, v) => {
        const tx = A[0] + (B[0] - A[0]) * u, ty = A[1] + (B[1] - A[1]) * u;
        const bx = D[0] + (C[0] - D[0]) * u, by = D[1] + (C[1] - D[1]) * u;
        return [tx + (bx - tx) * v, ty + (by - ty) * v];
      };
      const poly = (pts, fill, stroke, sw, op) => `<path d="M${pts.map(p => P(p[0], p[1]).map(f).join(',')).join(' L')} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
      const base = pal[asg.rug] || '#888';
      const c1 = lighten(base, 0.32), c2 = darken(base, 0.36);
      const ac = pal[popIndex(pal)] || c1;
      let h = '';
      // حاشیه‌ی بیرونی
      h += poly([[.02, .05], [.98, .05], [.98, .95], [.02, .95]], 'none', c1, 2.6, 0.9);
      // حاشیه‌ی داخلی
      h += poly([[.06, .14], [.94, .14], [.94, .86], [.06, .86]], darken(base, 0.18), c2, 1.6, 0.55);
      // ترنج مرکزی
      h += poly([[.5, .2], [.72, .5], [.5, .8], [.28, .5]], c1, ac, 1.6, 0.7);
      h += poly([[.5, .32], [.6, .5], [.5, .68], [.4, .5]], ac, 'none', 0, 0.9);
      // گل‌های گوشه
      [[.14, .3], [.86, .3], [.14, .7], [.86, .7]].forEach(([u, v]) => {
        h += poly([[u, v - .08], [u + .032, v], [u, v + .08], [u - .032, v]], c1, c2, 0.9, 0.65);
      });
      // حاشیه‌ی نقطه‌ای
      for (let k = 0; k < 26; k++) {
        const u = 0.035 + k * 0.038;
        [.075, .885].forEach(v => {
          h += poly([[u, v], [u + .02, v], [u + .02, v + .035], [u, v + .035]], k % 2 ? ac : c1, 'none', 0, 0.75);
        });
      }
      return `<g pointer-events="none">${h}</g>`;
    }

    /* -------- سایه‌ی تماسی + پرتوِ نور + بازتابِ کف -------- */
    function under() {
      let h = '';
      // پرتوِ نور از پنجره
      if (wb && dayAmt > 0.05 && L.wx !== 'ابری' && !lite) {
        const sunC = mixHex(skyTint, '#FFF6E6', 0.35);
        const g = grad('shaft', 0, 0, 0, 1, [[0, sunC, f(0.42 * dayAmt)], [1, sunC, 0]]);
        const s = -lx * 200;
        h += `<path d="M${wb.x0 + 6},350 L${wb.x1 - 6},350 L${wb.x1 - 6 + s},500 L${wb.x0 + 6 + s},500 Z" fill="${g}" filter="url(#${id('rbHuge')})" style="mix-blend-mode:screen" pointer-events="none"/>`;
      }
      const darkness = 0.55 + 0.45 * Math.max(dayAmt, lampOn ? 0.5 : 0);
      // سایه‌ی هر شیء
      scene.layers.filter(isProp).forEach(l => {
        const b = bbox(l.parts), w = b.x1 - b.x0;
        const cx = (b.x0 + b.x1) / 2 - lx * w * 0.14;
        const soft = `<ellipse cx="${f(cx)}" cy="${f(b.y1 + 4)}" rx="${f(w * 0.60)}" ry="${f(Math.min(18, 5 + (b.y1 - b.y0) * 0.06))}" fill="#000" opacity="${f(0.36 * darkness)}"${lite ? '' : ` filter="url(#${id('rbSoft')})"`}/>`;
        const tight = `<ellipse cx="${f((b.x0 + b.x1) / 2)}" cy="${f(b.y1)}" rx="${f(w * 0.44)}" ry="3" fill="#000" opacity="0.45"${lite ? '' : ` filter="url(#${id('rb')})"`}/>`;
        h += `<g pointer-events="none">${soft}${tight}</g>`;
        // بازتابِ روی کف (برای سطوح با gloss بالا)
        if (!lite && gl > 0.05) {
          const hh = Math.min(90, (b.y1 - b.y0) * 0.7);
          const gd = grad('rg-' + l.id, 0, b.y1, 0, b.y1 + hh, [[0, '#fff', 1], [1, '#000', 1]], true);
          const mk = id('rm-' + l.id);
          defs.push(`<mask id="${mk}" maskUnits="userSpaceOnUse" x="0" y="${b.y1}" width="800" height="${f(hh)}"><rect x="0" y="${b.y1}" width="800" height="${f(hh)}" fill="${gd}"/></mask>`);
          h += `<g mask="url(#${mk})" pointer-events="none"><use href="#${id('L-' + l.id)}" transform="translate(0 ${2 * b.y1}) scale(1 -1)" opacity="${f(Math.min(0.40, 0.10 + gl * 0.5))}"/></g>`;
        }
      });
      return h;
    }

    return {
      defs: () => defs.join(''),
      tex: l => (l.texture ? floorTex(l) : ''),
      matFilter(l) {
        const mat = MAT[l.mat] || MAT.wall;
        if (!mat.tex || mat.tex === 'glass' || lite) return '';
        const cp = cpOf(l, 'tx-' + l.id);
        return `<g pointer-events="none" clip-path="url(#${cp})" opacity="${f(clamp(0.65 + mat.rough * 0.3, 0, 1))}"><rect x="0" y="0" width="800" height="500" fill="#FFF" filter="url(#${id('tex-' + mat.tex)})"/></g>`;
      },
      bevel(l, mat) {
        if (lite || NOB.includes(l.id)) return '';
        const cp = cpOf(l, 'bv-' + l.id);
        const s = (c, o, dx, dy) => `<g transform="translate(${dx},${dy})" opacity="${o}">${l.parts.map(d => `<path d="${d}" fill="none" stroke="${c}" stroke-width="7"/>`).join('')}</g>`;
        return `<g clip-path="url(#${cp})" pointer-events="none"><g filter="url(#${id('rb')})">${s('#FFF', f(0.26 + mat.hl), -lx * 3, 3)}${s('#000', 0.34, lx * 3, -3)}</g></g>`;
      },
      sheen(l, mat) {
        if (lite || mat.spec < 0.08) return '';
        const cp = cpOf(l, 'sh-' + l.id);
        const g = grad('shg-' + l.id, 0, 0, 0.8, 1, [
          [0, '#FFF', f(mat.spec * 0.55)],
          [0.35, '#FFF', 0],
          [0.7, '#FFF', 0],
          [1, '#FFF', f(mat.spec * 0.16)]
        ]);
        return `<g pointer-events="none" clip-path="url(#${cp})"><rect x="0" y="0" width="800" height="500" fill="${g}"/></g>`;
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
        // AO زیرِ قرنیز سقف
        h += rc(0, 20, 800, 50, grad('aoCrown', 0, 0, 0, 1, [[0, '#000', 0.20], [1, '#000', 0]]));
        // AO لبه‌ی کف
        h += rc(0, 348, 800, 70, grad('aoF', 0, 0, 0, 1, [[0, '#000', 0.26], [1, '#000', 0]]));
        // AO دیوارهای کناری
        h += rc(0, 0, 32, 500, grad('aoL', 0, 0, 1, 0, [[0, '#000', 0.24], [1, '#000', 0]]));
        h += rc(768, 0, 32, 500, grad('aoR', 0, 0, 1, 0, [[0, '#000', 0], [1, '#000', 0.24]]));
        // AO بالای دیوار
        h += rc(0, 0, 800, 60, grad('aoTop', 0, 0, 0, 1, [[0, '#000', 0.16], [1, '#000', 0]]));
        // نورِ محیطی از سمت پنجره
        const wc = wb ? [(wb.x0 + wb.x1) / 2, (wb.y0 + wb.y1) / 2] : [120, 180];
        if (dayAmt > 0.05) {
          h += `<rect width="800" height="500" fill="${rad('wl', wc[0], wc[1], 660, skyTint, f(0.20 * dayAmt))}" style="mix-blend-mode:screen" pointer-events="none"/>`;
        }
        // هاله‌ی چراغ‌ها
        if (lampOn) {
          scene.layers.filter(l => /^lamp(_shade|_l|_r)?$/.test(l.id) || /^pendant_/.test(l.id)).forEach(l => {
            const b = bbox(l.parts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
            h += `<rect width="800" height="500" fill="${rad('lg-' + l.id, cx, cy, 220, lampC, 0.65)}" style="mix-blend-mode:screen" pointer-events="none"/>`;
            h += `<g pointer-events="none" opacity="0.30">${l.parts.map(d => `<path d="${d}" fill="${lampC}"/>`).join('')}</g>`;
          });
        }
        // نورِ سقف
        if (!lite) {
          h += `<rect width="800" height="320" fill="${grad('ceilL', 0, 0, 0, 1, [[0, '#FFF6E0', f(0.08 + 0.10 * dayAmt)], [1, '#FFF6E0', 0]])}" style="mix-blend-mode:screen" pointer-events="none"/>`;
        }
        // فیلم گرین
        if (!lite) {
          defs.push(`<filter id="${id('gr')}" filterUnits="userSpaceOnUse" x="0" y="0" width="800" height="500">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1.3 0 0 0 -0.55"/>
          </filter>`);
          h += `<rect width="800" height="500" fill="#000" filter="url(#${id('gr')})" opacity="0.30" pointer-events="none"/>`;
        }
        return h;
      },
    };
  }

  /* ============================================================
     ساخت SVG
     ============================================================ */
  function buildSVG(scene, asg, palette, lightKey, opts = {}) {
    const uid = `u${++_svgUid}`;
    const id = (name) => `${uid}-${name}`;
    const defs = [];

    const R = realismKit(scene, asg, palette, opts, id, !!opts.lite);
    const L = opts.light || { t: 13, dir: 'جنوبی', wx: 'آفتابی', lamp: null, kelvin: 3000 };
    const LP = lightParams(L.t, L.dir, L.wx, L.lamp === null ? (L.t >= 20 || L.t < 5.5) : !!L.lamp, L.kelvin);

    defs.push(textureFilters(id));

    defs.push(`
      <pattern id="${id('wood-plank')}" x="0" y="0" width="240" height="22" patternUnits="userSpaceOnUse">
        <path d="M0,21 L240,21" stroke="rgba(0,0,0,0.10)" stroke-width="0.8"/>
        <path d="M0,10 L240,10" stroke="rgba(0,0,0,0.04)" stroke-width="0.4"/>
      </pattern>
      <pattern id="${id('tile')}" x="0" y="0" width="55" height="55" patternUnits="userSpaceOnUse">
        <path d="M0,0 L55,0 L55,55 L0,55 Z" fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="0.6"/>
      </pattern>
    `);

    const layerHtml = [];
    for (const layer of scene.layers) {
      const idx = asg[layer.id];
      if (idx === undefined || idx === null) continue;
      const raw = palette[idx];
      if (!raw) continue;

      const mat = MAT[layer.mat] || MAT.wall;
      let color = raw;
      if (mat.warm > 0) color = mixHex(color, '#F2C08A', mat.warm * 0.4);
      else if (mat.warm < 0) color = mixHex(color, '#A8C0E0', -mat.warm * 0.35);
      // شب — تیره‌تر
      if (LP.dayAmt < 0.3 && !LP.lampOn) color = mixHex(color, '#1A2438', 0.18);

      // گرادیان عمودی
      const gradId = id(`g-${layer.id}`);
      const top = lighten(color, mat.hl * 0.6 + 0.03);
      const bot = darken(color, mat.hl * 0.5 + 0.05);
      defs.push(`
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${top}"/>
          <stop offset="0.55" stop-color="${color}"/>
          <stop offset="1" stop-color="${bot}"/>
        </linearGradient>
      `);

      // گرادیان افقی (از سمت نور)
      const gradH = id(`gh-${layer.id}`);
      const hx1 = LP.lx > 0 ? '0' : '1', hx2 = LP.lx > 0 ? '1' : '0';
      defs.push(`
        <linearGradient id="${gradH}" x1="${hx1}" y1="0" x2="${hx2}" y2="0">
          <stop offset="0" stop-color="${lighten(color, mat.hl * 0.4)}" stop-opacity="0.14"/>
          <stop offset="0.5" stop-color="${color}" stop-opacity="0"/>
          <stop offset="1" stop-color="${darken(color, mat.hl * 0.3)}" stop-opacity="0.16"/>
        </linearGradient>
      `);

      const paths = layer.parts.map(d => `<path class="b" d="${d}" fill="url(#${gradId})"/>`).join('');
      const hPaths = layer.parts.map(d => `<path d="${d}" fill="url(#${gradH})"/>`).join('');

      const tex = layer.texture ? R.tex(layer) : '';
      const matTex = R.matFilter(layer);
      const sheen = R.sheen(layer, mat);

      const sel = opts.selected === layer.id ? ' sel' : '';

      layerHtml.push(`
        <g class="ly${sel}" id="${id('L-' + layer.id)}" data-l="${layer.id}" data-n="${layer.name}">
          ${paths}
          ${hPaths}
          ${sheen}
          ${matTex}
          ${tex}
          ${R.bevel(layer, mat)}
        </g>
      `);
      layerHtml.push(R.after(layer));
    }

    const shadows = '';
    const details = '';

    defs.push(`
      <radialGradient id="${id('vig')}" cx="0.5" cy="0.45" r="1.05">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
      </radialGradient>
    `);

    let finalTint = null;
    if (LP.dayAmt < 0.15 && LP.lampOn) finalTint = 'rgba(60, 90, 140, 0.10)';
    else if (LP.dayAmt < 0.15 && !LP.lampOn) finalTint = 'rgba(40, 60, 110, 0.30)';
    else if (L.wx === 'ابری') finalTint = 'rgba(140, 150, 168, 0.10)';

    const topHtml = R.top();
    return `<svg viewBox="0 0 800 500" xmlns="${NS}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${scene.name}">
      <defs>${defs.join('')}${R.defs()}</defs>
      <rect width="800" height="500" fill="${palette[asg.wall] || '#222'}"/>
      <g class="stage-layer">${layerHtml.join('')}</g>
      ${shadows}${details}
      ${topHtml}
      ${finalTint ? `<rect width="800" height="500" fill="${finalTint}" pointer-events="none"/>` : ''}
      <rect width="800" height="500" fill="url(#${id('vig')})" pointer-events="none"/>
    </svg>`;
  }

  /* ============================================================
     تحلیل / بُر / جدول
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
    if (wallLrv < 25) warnings.push({ level: 'warn', text: 'LRV دیوارِ اصلی کمتر از ۲۵٪ است — فضا تیره به‌نظر می‌آید.' });
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

  const toPN = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
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
    paper: 'کاغذ', terracotta: 'سفال',
  };
  const ROLE_FA = { L1: 'سطح غالب', L2: 'سطح ثانویه', M: 'کف / میانی', D: 'تیره', K: 'مبلمان', P: 'تأکید' };
  const PAINT_MATS = new Set(['wall', 'wallGloss', 'stucco', 'concrete']);
  const M_PER_UNIT = 2.8 / 320;

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
        if (h <= 0 || o.g.minY >= 348) continue;
        sub += o.area * Math.min(1, (348 - o.g.minY) / h);
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
    gloss: {}, cb: '', tab: 'color', why: '', size: 2400, fast: false,
  };
  let root, stageEl, lastFocus = null, cmp = null, dragging = false, toastTimer = null;

  const nearestPreset = (t) => t < 10 ? 'dawn' : t < 16 ? 'day' : t < 19.5 ? 'dusk' : 'night';
  const svOf = (t) => (t >= 20 || t < 5) ? 0 : Math.max(0, Math.sin(Math.PI * (t - 6) / 14));
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
     UI Shell — دقیقاً همان ساختار قبلی
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
              <p class="stu-why">مساحت‌ها از روی نمای روبه‌رو برآورد می‌شوند (ارتفاع دیوار ≈ ۲.۸ متر) و فقط برای برآورد اولیه‌اند؛ پوشش رنگ ۱۰ متر مربع در لیتر فرض شده است.</p>
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
      ? 'نور شمالی سرد و یکنواخت است؛ رنگ‌ها آبی‌تر و تیره‌تر دیده می‌شوند.'
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
    st.asgByScene[st.sceneId] = next;
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
        if (!b) { showStuToast('ساخت تصویر ناموفق بود'); return; }
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
      gloss: {}, cb: '', tab: 'color', why: '', size: 2400, fast: false,
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