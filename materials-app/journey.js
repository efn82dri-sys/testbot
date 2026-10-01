/* رواق — سفر مصالح v3: انیمیشن سه‌بعدی خودکار و لوپ (WebGL) */
(() => {
'use strict';
const BASE = document.currentScript ? document.currentScript.src.replace(/[^/]*$/, '') : '/materials/', VER = (document.currentScript && document.currentScript.src.split('?')[1]) || '';
const fa = n => Number(n || 0).toLocaleString('fa-IR'), cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const CH = [
 ['معدن', 'همه‌چیز از خاک شروع می‌شود', 'رس مناسب استخراج و به کارخانه حمل می‌شود. کیفیت محصول نهایی از همین‌جا تعیین می‌شود.'],
 ['کوره', 'پختن در بیش از هزار درجه', 'داخل کوره‌ی دوار، دانه‌های رس منبسط می‌شوند و هسته‌ای پر از حفره‌های ریز می‌سازند؛ نتیجه سبک و عایق است.'],
 ['آزمون', 'قبل از ارسال، سنجیده می‌شود', 'وزن، جذب آب و مقاومت فشاری نمونه‌ها اندازه‌گیری می‌شود. برگه‌ی مشخصات فنی از همین آزمون‌ها می‌آید.'],
 ['حمل', 'پالت‌بندی و ارسال', 'محصول روی پالت بسته می‌شود و به کارگاه می‌رسد. شرایط حمل و تاریخ تولید را همان‌جا بررسی کن.'],
 ['اجرا', 'رج به رج، سر کارگاه', 'بلوک‌ها با ملات چیده می‌شوند. جرثقیل بار را بالا می‌برد و دیوار هر روز کمی بلندتر می‌شود.'],
 ['ساختمان', 'دیوار تمام شد؛ حالا از داخل', 'وزن مرده کمتر، عایق بهتر و فضای داخلی آرام‌تر. حالا مصالح واقعی را در کاتالوگ ببین.']
];
const N = CH.length, DUR = 7.5, TOTAL = N * DUR, TR = 2.4;
const RO = [
 u => `<span>برداشت رس</span><u style="--w:${u}"><i></i></u><b>${fa(Math.round(u * 100))}٪</b>`,
 u => `<span>دمای کوره</span><u style="--w:${u}"><i></i></u><b dir="ltr">${fa(Math.round(20 + Math.min(1, u * 1.6) * 1080))} °C</b>`,
 u => ['وزن', 'جذب آب', 'مقاومت'].map((t, i) => { const on = u > [.25, .45, .68][i]; return `<em class="${on ? 'ok' : ''}">${on ? '✓ ' : ''}${t}</em>`; }).join(''),
 u => `<span>انبار</span><u style="--w:${cl((u - .45) * 1.8)}"><i></i></u><span>کارگاه</span>`,
 u => `<span>رج چیده‌شده</span><u style="--w:${u}"><i></i></u><b>${fa(Math.min(11, Math.floor(u * 11.5)))} از ${fa(11)}</b>`,
 u => `<span>وضعیت</span><b>${u > .4 ? 'آماده‌ی تحویل' : 'نصب نهایی'}</b>`
];
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
let host, built, running = false, vis = true, paused = false, t = 0, last = 0, raf = 0, scene = null, ui = {}, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, obs, lastS = -1, lastRo = '', errN = 0;
function build(D) {
  const prod = D.companies.reduce((n, c) => n + c.products.length, 0);
  host.innerHTML = `<div class="jr" data-s="0"><div class="jr-stage"><canvas class="jr-cv" aria-label="انیمیشن سه‌بعدی مسیر ساخت مصالح از معدن تا ساختمان" role="img"></canvas><div class="jr-load"><i></i><span>در حال ساخت صحنه‌ی سه‌بعدی…</span></div><div class="jr-fade"></div><div class="jr-vig"></div></div>
<nav class="jr-rail" aria-label="مراحل">${CH.map((c, i) => `<button type="button" data-jr="${i}"><span>${c[0]}</span></button>`).join('')}</nav>
<button type="button" class="jr-pp" data-jr="pp" aria-label="توقف و پخش">${PAUSE}</button>
<div class="jr-info">${CH.map((c, i) => `<div class="jr-ch ${i ? '' : 'on'}"><small>مرحله ${fa(i + 1)} از ${fa(N)}</small><h2>${c[1]}</h2><p>${c[2]}</p>${i === N - 1 ? `<button type="button" class="jr-go" data-jr="go">دیدن ${fa(prod)} محصول از ${fa(D.companies.length)} برند</button>` : ''}</div>`).join('')}<div class="jr-ro"></div></div></div>`;
  const jr = host.querySelector('.jr'); ui = { jr, cv: jr.querySelector('canvas'), stage: jr.querySelector('.jr-stage'), fade: jr.querySelector('.jr-fade'), load: jr.querySelector('.jr-load'), chs: [...jr.querySelectorAll('.jr-ch')], bars: [...jr.querySelectorAll('.jr-rail button')], ro: jr.querySelector('.jr-ro'), pp: jr.querySelector('.jr-pp') };
  jr.onclick = e => {
    const b = e.target.closest('[data-jr]'); if (!b) return; const v = b.dataset.jr;
    if (v === 'go') { const f = document.getElementById('filters'); f && f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (v === 'pp') { paused = !paused; ui.pp.innerHTML = paused ? PLAY : PAUSE; }
    else { t = Number(v) * DUR + TR; last = 0; if (reduce) tick(0); }
  };
  if (reduce) { paused = true; ui.pp.innerHTML = PLAY; }
  if ('IntersectionObserver' in window) { obs = new IntersectionObserver(es => { vis = es[0].isIntersecting; vis ? start() : stop(); }, { threshold: .15 }); obs.observe(jr); }
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : (vis && running !== null && start()));
  addEventListener('resize', () => scene && scene.resize());
  loadScene();
}
async function loadScene() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); if (!gl) throw 0;
    const m = await import(BASE + 'journey-scene.js' + (VER ? '?' + VER : '')); scene = m.createScene(ui.cv, ui.stage); ui.jr.classList.add('ready'); ui.load.hidden = true;
    new ResizeObserver(() => scene.resize()).observe(ui.stage);
  } catch (e) { ui.jr.classList.add('nogl'); ui.load.hidden = true; console.warn('RQJourney: WebGL unavailable', e); }
}
function tick(now) {
  raf = 0; if (!running) return;
  raf = requestAnimationFrame(tick);
  const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; if (!paused) t = (t + dt) % TOTAL;
  const s = Math.min(N - 1, Math.floor(t / DUR)), lt = t - s * DUR, u = lt / DUR, tr = cl(lt / TR);
  const f = Math.max(cl((t - (TOTAL - .6)) / .6), 1 - cl(t / .6)); ui.fade.style.opacity = f.toFixed(3);
  if (s !== lastS) { lastS = s; ui.jr.dataset.s = s; ui.chs.forEach((x, i) => x.classList.toggle('on', i === s)); ui.bars.forEach((b, i) => b.classList.toggle('on', i === s)); }
  ui.bars.forEach((b, i) => b.style.setProperty('--f', i < s ? 1 : i === s ? u.toFixed(3) : 0));
  const h = RO[s](u); if (h !== lastRo) { lastRo = h; ui.ro.innerHTML = h; }
  if (scene) { try { scene.frame(s, u, t, dt, tr); errN = 0; } catch (e) { console.warn('RQJourney frame error', e); if (++errN > 30) { scene = null; ui.jr.classList.remove('ready'); ui.jr.classList.add('nogl'); } } }
}
function start() { if (running || !built) return; running = true; last = 0; raf = requestAnimationFrame(tick); }
function stop() { running = false; raf && cancelAnimationFrame(raf); raf = 0; }
window.RQJourney = {
  sync(D, show) {
    host = host || document.getElementById('journey'); if (!host || !D) return;
    if (show && !built) { build(D); built = true; }
    host.hidden = !show || !built;
    if (show && vis && !document.hidden) { start(); } else stop();
  },
  seek(x) { t = x % TOTAL; }
};
})();