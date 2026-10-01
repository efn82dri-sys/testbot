/* رواق — سفر مصالح v2: از خاک تا دیوار */
(() => {
'use strict';
const fa = n => Number(n || 0).toLocaleString('fa-IR'), cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), R = Math.round;
const CH = [
 ['معدن', 'همه‌چیز از خاک شروع می‌شود', 'رس مناسب استخراج، خشک و دانه‌بندی می‌شود. کیفیت محصول نهایی از همین‌جا تعیین می‌شود.'],
 ['کوره', 'پختن در بیش از هزار درجه', 'داخل کوره‌ی دوار، دانه‌های رس منبسط می‌شوند و هسته‌ای پر از حفره‌های ریز می‌سازند؛ نتیجه سبک و عایق است.'],
 ['آزمون', 'قبل از بسته‌بندی، سنجیده می‌شود', 'وزن، جذب آب و مقاومت فشاری نمونه‌ها اندازه‌گیری می‌شود. برگه‌ی مشخصات فنی از همین آزمون‌ها می‌آید.'],
 ['حمل', 'پالت‌بندی و ارسال', 'محصول روی پالت بسته می‌شود و به انبار یا کارگاه می‌رسد. شرایط حمل و تاریخ تولید را همان‌جا بررسی کن.'],
 ['اجرا', 'رج به رج، سر کارگاه', 'بلوک‌ها با ملات چیده می‌شوند. جرثقیل بار را بالا می‌برد و دیوار هر روز کمی بلندتر می‌شود.'],
 ['ساختمان', 'دیوار تمام شد؛ حالا از داخل', 'وزن مرده کمتر، عایق بهتر و فضای داخلی آرام‌تر. حالا مصالح واقعی را در کاتالوگ ببین.']
];
const N = CH.length, GAP = 640;
/* دوربین: [x, z, rx, ry] برای هر ایستگاه */
const K = [[0, 140, -30, -30], [0, 160, -26, -24], [0, 220, -28, -34], [0, 60, -26, 30], [0, 110, -30, -26], [0, 230, -22, -20]].map((k, i) => [i * GAP, k[1], k[2], k[3]]);
/* ---- سازنده‌های هندسه ---- */
const B = (x, y, z, w, h, d, c, o = {}) => `<b class="cb ${o.c || ''}" style="--x:${x}px;--y:${-(y + h / 2)}px;--z:${z}px;--w:${w}px;--h:${h}px;--d:${d}px;--cc:${c};${o.s || ''}"><i></i><i></i><i></i><i></i></b>`;
const G = (x, y, z, k, s = '') => `<u class="gp" style="--x:${x}px;--y:${-y}px;--z:${z}px;${s}">${k}</u>`;
const SH = (x, z, w, d) => `<u class="sh" style="--x:${x}px;--z:${z}px;--w:${w}px;--d:${d}px"></u>`;
const CY = (x, y, z, L, r, c1, c2, n, o = {}) => G(x, y + r, z, `<u class="an spin" style="--sp:${o.sp || 4}s">${Array.from({ length: n }, (_, i) => `<b class="sl" style="--L:${L}px;--hh:${(2 * Math.PI * r / n * 1.04).toFixed(1)}px;--r:${r}px;--a:${(i * 360 / n).toFixed(1)}deg;--cc:${i % 2 ? c1 : c2}"></b>`).join('')}</u>`, o.s);
const wheel = (x, z) => CY(x, 0, z, 12, 17, '#16181b', '#23262a', 12, { sp: 1.1, s: '--ry:90deg' });
const tree = (x, z, s = 1) => B(x, 0, z, 10 * s, 28 * s, 10 * s, '#6b4a33') + B(x, 26 * s, z, 44 * s, 40 * s, 44 * s, 'var(--grn)') + B(x, 62 * s, z, 28 * s, 24 * s, 28 * s, 'var(--grn2)') + SH(x, z, 60 * s, 60 * s);
const man = (x, z) => B(x, 0, z, 12, 22, 10, '#E8743B') + B(x, 22, z, 10, 10, 10, '#E2B592') + B(x, 31, z, 13, 6, 13, '#F4F2EC') + SH(x, z, 22, 18);
const blk = (x, y, z, o) => B(x, y, z, 42, 24, 30, 'var(--blk)', o) ;
const pad = (c, w = 560, d = 440) => B(0, 0, 0, w, 8, d, c) ;
const drop = (r, n) => `--r:${r};--k:clamp(0,calc(var(--l) * ${n} - var(--r)),1)`;
const st = (i, body) => G(i * GAP, 0, 0, body, `--l:var(--l${i})`);
/* ---- ایستگاه‌ها ---- */
const S0 = pad('#6b5a4a') + B(40, 8, -30, 320, 40, 240, 'var(--earth)') + B(50, 48, -30, 240, 36, 180, 'var(--earth)') + B(60, 84, -30, 150, 32, 110, 'var(--earth2)') + SH(40, -30, 400, 320)
 + G(-190, 8, 80, B(0, 0, -32, 130, 22, 26, '#2b2d31') + B(0, 0, 32, 130, 22, 26, '#2b2d31') + B(0, 22, 0, 110, 26, 96, 'var(--yel)') + B(-26, 48, 0, 48, 36, 52, '#d59d22') + B(-26, 62, 27, 36, 16, 3, '#9CD3E6') + G(26, 54, 0, B(44, -7, 0, 92, 14, 14, 'var(--yel)') + B(96, -20, 0, 30, 24, 36, 'var(--steel)'), '--rz:calc(-42deg + var(--l) * 58deg)')) + SH(-190, 80, 160, 130)
 + B(-200, 8, -120, 110, 14 + 0, 80, 'var(--earth)', { s: '--sy:calc(.5 + var(--l) * 2.2)' }) + man(120, 120) + tree(-300, -170, 1.2) + tree(300, 170);
const gran = Array.from({ length: 6 }, (_, i) => `<u class="an fall" style="--dl:${(i * .21).toFixed(2)}s">${B(-215 + (i % 3) * 10, 70, 6 * (i % 2 ? 1 : -1), 9, 9, 9, 'var(--blk)')}</u>`).join('');
const smoke = Array.from({ length: 4 }, (_, i) => `<u class="an rise" style="--dl:${i * .85}s">${B(170, 190, -90, 26, 26, 26, '#c9cdd1')}</u>`).join('');
const S1 = pad('#4d5258') + B(-70, 8, 0, 40, 40, 80, 'var(--conc)') + B(110, 8, 0, 40, 62, 80, 'var(--conc)') + CY(-30, 58, 0, 290, 44, '#9aa1a8', '#868d94', 18, { s: '--rz:-4deg', sp: 5 }) + CY(-80, 56, 0, 14, 49, '#4b5157', '#3a3f45', 18, { s: '--rz:-4deg', sp: 5 }) + CY(40, 58, 0, 14, 49, '#4b5157', '#3a3f45', 18, { s: '--rz:-4deg', sp: 5 }) + CY(120, 60, 0, 14, 49, '#4b5157', '#3a3f45', 18, { s: '--rz:-4deg', sp: 5 })
 + B(-185, 14, 0, 70, 90, 86, 'var(--steel2)') + B(-224, 34, 0, 26, 30, 36, 'var(--fire)', { c: 'em glow' }) + B(-185, 100, 0, 70, 12, 86, 'var(--steel)')
 + B(170, 8, -90, 34, 182, 34, 'var(--conc)') + B(170, 190, -90, 40, 10, 40, 'var(--steel2)') + smoke + B(150, 118, 0, 56, 36, 56, 'var(--steel)') + B(-250, 8, 70, 80, 26, 90, 'var(--steel2)') + gran + B(-250, 34, 70, 60, 10, 60, 'var(--blk)', { s: '--sy:calc(.3 + var(--l) * 1.4)' }) + SH(-30, 0, 380, 150) + tree(300, 150) + man(-40, 150);
const lamps = [3, 5, 7].map((t, i) => B(150, 34 + i * 26, 31, 14, 14, 4, '#1c2a26') + B(150, 34 + i * 26, 33, 14, 14, 4, 'var(--accent)', { c: 'lamp', s: `--o:clamp(0,calc(var(--l) * 10 - ${t}),1)` })).join('');
const S2 = pad('#b9bcc0') + B(0, 8, 0, 220, 22, 160, 'var(--steel)') + G(0, 30, 0, B(0, 0, 0, 90, 56, 58, 'var(--blk)') + B(-20, 56, 0, 24, 1, 36, '#3a2a20') + B(20, 56, 0, 24, 1, 36, '#3a2a20'), '--ry:calc(var(--l) * 220deg)')
 + B(-96, 30, -30, 16, 150, 16, 'var(--steel2)') + B(96, 30, -30, 16, 150, 16, 'var(--steel2)') + B(0, 172, -30, 208, 18, 18, 'var(--steel2)') + `<u class="an pr">${B(0, 100, 0, 110, 12, 70, 'var(--steel)') + B(0, 112, -30, 10, 60, 10, 'var(--steel2)')}</u>`
 + B(150, 8, 20, 70, 110, 34, 'var(--steel2)') + lamps + B(-170, 8, 90, 70, 36, 50, '#e9e6df') + B(-170, 44, 90, 52, 6, 36, 'var(--accent)') + SH(0, 0, 280, 220) + man(-130, -10);
const wh = B(-300, 8, -90, 170, 100, 130, 'var(--conc)') + B(-300, 108, -90, 182, 12, 142, 'var(--steel2)') + B(-214, 8, -90, 4, 62, 66, '#33363b');
const S3 = B(0, 0, 60, 1500, 4, 130, 'var(--asph)') + Array.from({ length: 12 }, (_, i) => B(-560 + i * 100, 4, 60, 44, 1, 5, '#cfd1d4')).join('') + wh + SH(-300, -90, 200, 170) + tree(-60, -120, 1.2) + tree(160, -150) + tree(330, -90, .9) + tree(60, 190, .9) + tree(-380, 190, 1.1)
 + `<u class="an mv">${SH(0, 60, 270, 100) + B(-20, 14, 60, 200, 10, 72, 'var(--steel)') + [0, 1, 2, 3].map(i => [0, 1].map(j => blk(-90 + i * 46, 24 + j * 26, 60 + (j ? 0 : 0), {})).join('')).join('') + B(95, 14, 60, 62, 58, 70, '#E9E6DF') + B(118, 40, 60, 14, 22, 62, '#9CD3E6') + wheel(-85, 22) + wheel(-85, 98) + wheel(-25, 22) + wheel(-25, 98) + wheel(95, 22) + wheel(95, 98)}</u>`;
const wallS4 = Array.from({ length: 4 }, (_, r) => Array.from({ length: 7 }, (_, c) => blk(-130 + c * 43 + (r % 2 ? 21 : 0), 10 + r * 24, -70, { c: 'dr', s: `--x:${-130 + c * 43 + (r % 2 ? 21 : 0)}px;--y:${-(10 + r * 24 + 12)}px;--z:-70px;${drop(r + (c % 3) * .12, 6)}` })).join('')).join('');
const S4 = pad('#8a8f95') + B(0, 8, -20, 330, 10, 220, '#9da2a8') + wallS4 + SH(0, -70, 300, 60)
 + B(170, 8, 60, 28, 90, 28, 'var(--yel)') + B(170, 98, 60, 28, 90, 28, 'var(--yel)') + B(170, 188, 60, 28, 90, 28, 'var(--yel)') + B(40, 278, 60, 320, 14, 20, 'var(--yel)') + B(210, 262, 60, 60, 36, 28, 'var(--conc)') + SH(170, 60, 120, 120)
 + B(-70, 160, 60, 3, 118, 3, '#111', { c: 'cab', s: '--sy:calc(.3 + var(--l) * .6)' }) + `<u class="an ld">${B(-70, 254, 60, 38, 22, 30, 'var(--blk)')}</u>` + [0, 1, 2].map(i => blk(110 + i * 46, 8, 140, {})).join('') + [0, 1].map(i => blk(132 + i * 46, 32, 140, {})).join('') + man(-120, 90) + man(60, 70) + tree(-300, 130, 1.1) + tree(310, -150);
const win = (r, c) => r >= 2 && r <= 3 && c >= 3 && c <= 4;
const back = Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (_, c) => win(r, c) ? '' : B(0, 0, 0, 44, 26, 30, 'var(--blk)', { c: 'dr', s: `--x:${-154 + c * 44}px;--y:${-(10 + r * 26 + 13)}px;--z:-125px;${drop(r + (c % 3) * .15, 7.4)}` })).join('')).join('');
const side = Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => B(0, 0, 0, 30, 26, 50, 'var(--blk2)', { c: 'dr', s: `--x:-176px;--y:${-(10 + r * 26 + 13)}px;--z:${-100 + c * 50}px;${drop(r + (c % 2) * .15, 7.4)}` })).join('')).join('');
const S5 = pad('#7d838a', 600, 470) + B(0, 8, 0, 380, 10, 280, '#d4bfa3') + back + side + B(0, 62, -122, 84, 52, 4, '#9CD3E6', { c: 'em', s: '--cc:#FFD58A' })
 + B(-90, 18, 30, 150, 20, 80, '#4a5a6a') + B(-90, 38, -10, 150, 36, 18, '#4a5a6a') + B(40, 18, 40, 70, 24, 50, '#8a6a4a') + B(40, 42, 40, 80, 4, 60, '#a07a56') + B(120, 18, -90, 36, 70, 36, '#e9e6df')
 + B(120, 88, -90, 22, 16, 22, '#FFD58A', { c: 'em glow' }) + B(130, 18, 80, 90, 3, 70, '#a8534a') + B(-120, 18, -40, 30, 46, 30, 'var(--grn2)') + SH(0, 0, 440, 340) + tree(310, 150) + tree(-300, 170, 1.2) + tree(300, -140);
const SCENE = `<div class="gd"></div>` + [S0, S1, S2, S3, S4, S5].map((s, i) => st(i, s)).join('');
const RO = [
 l => `<span>برداشت رس</span><u style="--w:${l}"><i></i></u><b>${fa(R(l * 100))}٪</b>`,
 l => `<span>دمای کوره</span><u style="--w:${l}"><i></i></u><b dir="ltr">${fa(R(20 + l * 1080))} °C</b>`,
 l => ['وزن', 'جذب آب', 'مقاومت'].map((t, i) => `<em class="${l * 10 > [3, 5, 7][i] ? 'ok' : ''}">${l * 10 > [3, 5, 7][i] ? '✓ ' : ''}${t}</em>`).join(''),
 l => `<span>انبار</span><u style="--w:${l}"><i></i></u><span>کارگاه</span>`,
 l => `<span>رج چیده‌شده</span><u style="--w:${l}"><i></i></u><b>${fa(Math.min(4, Math.floor(l * 6)))} از ${fa(4)}</b>`,
 l => `<span>وضعیت</span><b>${l > .85 ? 'آماده‌ی تحویل' : 'در حال چیدن دیوار'}</b>`
];
let host, built, off;
function build(D) {
  const prod = D.companies.reduce((n, c) => n + c.products.length, 0);
  host.innerHTML = `<div class="jr" data-s="0"><div class="jr-pin"><div class="jr-stage"><div class="jr-fl">${Array.from({ length: 16 }, (_, i) => `<i style="--x:${(i * 37) % 96};--y:${(i * 53) % 80};--v:${.4 + (i % 4) * .3}"></i>`).join('')}</div><div class="jr-cam"><div class="jr-world">${SCENE}</div></div><div class="jr-vig"></div></div>
<nav class="jr-rail" aria-label="مراحل">${CH.map((c, i) => `<button type="button" data-jr="${i}">${c[0]}</button>`).join('')}</nav><span class="jr-hint">اسکرول کن؛ دوربین مسیر را نشانت می‌دهد</span>
<div class="jr-info">${CH.map((c, i) => `<div class="jr-ch ${i ? '' : 'on'}"><small>مرحله ${fa(i + 1)} از ${fa(N)}</small><h2>${c[1]}</h2><p>${c[2]}</p>${i === N - 1 ? `<button type="button" class="jr-go" data-jr="go">دیدن ${fa(prod)} محصول از ${fa(D.companies.length)} برند</button>` : ''}</div>`).join('')}<div class="jr-ro"></div></div></div></div>`;
  host.onclick = e => {
    const b = e.target.closest('[data-jr]'); if (!b) return; const v = b.dataset.jr, jr = host.querySelector('.jr');
    if (v === 'go') { const f = document.getElementById('filters'); f && f.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    scrollTo({ top: jr.getBoundingClientRect().top + scrollY + (jr.offsetHeight - innerHeight) * (Number(v) + .5) / N, behavior: 'smooth' });
  };
}
function listen() {
  const jr = host.querySelector('.jr'), world = jr.querySelector('.jr-world'), chs = [...jr.querySelectorAll('.jr-ch')], bars = [...jr.querySelectorAll('.jr-rail button')], ro = jr.querySelector('.jr-ro');
  let raf = 0, tp = 0, pt = 0, pc = 0, mx = 0, my = 0, cx = 0, cy = 0, last = -1, lastRo = '';
  const ss = t => t * t * (3 - 2 * t);
  const apply = () => {
    const c = cl(pc * N - .5, 0, N - 1), a = Math.min(N - 2, Math.floor(c)), t = ss(c - a), A = K[a], Bk = K[a + 1], m = i => A[i] + (Bk[i] - A[i]) * t;
    world.style.transform = `translate3d(0,70px,0) rotateX(${(m(2) + cy * 3).toFixed(2)}deg) rotateY(${(m(3) + cx * 6).toFixed(2)}deg) translate3d(${-m(0)}px,0,${m(1) + (innerWidth < 640 ? -440 : -190)}px)`;
    const s = Math.min(N - 1, Math.floor(pc * N)); jr.style.setProperty('--p', pc.toFixed(4));
    for (let i = 0; i < N; i++) jr.style.setProperty('--l' + i, cl(pc * N - i).toFixed(4));
    const l = cl(pc * N - s);
    bars.forEach((b, i) => { b.style.setProperty('--f', i < s ? 1 : i === s ? l.toFixed(3) : 0); b.classList.toggle('on', i === s); });
    if (s !== last) { last = s; jr.dataset.s = s; chs.forEach((x, i) => x.classList.toggle('on', i === s)); }
    const h = RO[s](l); if (h !== lastRo) { lastRo = h; ro.innerHTML = h; }
    if (pc > .008) jr.classList.add('moved');
  };
  const frame = ts => {
    raf = 0; const dt = Math.min(400, ts - (tp || ts - 16)); tp = ts; const kk = 1 - Math.exp(-dt / 120); const r = jr.getBoundingClientRect(); pt = cl(-r.top / Math.max(1, r.height - innerHeight));
    pc += (pt - pc) * kk; cx += (mx - cx) * kk * .8; cy += (my - cy) * kk * .8;
    const busy = Math.abs(pt - pc) > .0004 || Math.abs(mx - cx) > .004 || Math.abs(my - cy) > .004;
    if (!busy) pc = pt; apply(); if (busy) raf = requestAnimationFrame(frame); else tp = 0;
  };
  const kick = () => { raf || (raf = requestAnimationFrame(frame)); };
  const mv = e => { const r = jr.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * 2 - 1; my = (e.clientY - r.top) / r.height * 2 - 1; kick(); };
  addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick); jr.addEventListener('pointermove', mv);
  pc = pt = cl(-jr.getBoundingClientRect().top / Math.max(1, jr.offsetHeight - innerHeight)); apply();
  return () => { removeEventListener('scroll', kick); removeEventListener('resize', kick); jr.removeEventListener('pointermove', mv); raf && cancelAnimationFrame(raf); };
}
window.RQJourney = {
  sync(D, show) {
    host = host || document.getElementById('journey'); if (!host || !D) return;
    if (show && !built) { build(D); built = true; }
    host.hidden = !show || !built;
    if (show && !off) off = listen(); else if (!show && off) { off(); off = null; }
  }
};
})();