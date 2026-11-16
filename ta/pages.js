/* 聊天页、听歌页共用的一小套：颜色、纸面颗粒、燕子、返回月亮、进出的转场。
   进来：主页把圆心和当时的态记在 sessionStorage「ta-hand」，这里从同一个圆心把页面一圈圈显出来；没有记录就只淡入。
   回去：点左上的返回月亮，月亮放大盖满全屏（圆是主页那一态的底色），再跳 index.html?splash=0&morph=&slot=，主页那边把满屏的圆缩回成入口月亮。 */
(function () {
'use strict';
const C = { PAPER: '#f1eee6', INK: '#16171c', LINE: '#2b2c32', PEN: '#55575c', GREY: '#97989c', LGREY: '#c6c3bb', BLUE: '#1c31b6' };
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const Q = new URLSearchParams(location.search);
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const dot = (g, x, y, r) => { if (r < 0.6) g.rect(x - r, y - r, r * 2, r * 2); else { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } };

/* 燕子：flap.js 的十二帧（这里取四十八个相位），头朝 +x，身长 100 */
const BIRD = []; for (let i = 0; i < 48; i++) { const f = window.flap(i / 48); BIRD.push(f.far + ' ' + f.body + ' ' + f.near); }
const birdD = ph => BIRD[((Math.round(ph * 48) % 48) + 48) % 48];
const BIRD2D = BIRD.map(d => new Path2D(d));
const birdP = ph => BIRD2D[((Math.round(ph * 48) % 48) + 48) % 48];
/* 收着翅膀停住的那一只（坠子底下那种小燕子的剪影） */
const PERCH = 'M-8.2,-11.5 C-24.6,-41.0 -65.6,-68.9 -118.0,-80.3 C-73.8,-54.1 -50.8,-36.1 -60.7,-8.2 Z M-50.8,-6.6 C-73.8,-4.9 -101.6,0.0 -126.2,6.6 C-104.9,4.1 -86.9,3.3 -73.8,4.1 C-88.5,8.2 -104.9,14.8 -119.7,24.6 C-98.4,18.0 -73.8,11.5 -50.8,6.6 Z M50.0,4.1 L42.6,0.4 C42.6,-5.7 36.9,-10.2 29.5,-10.7 C26.2,-11.1 23.0,-10.7 19.7,-9.8 C24.6,-42.6 0.0,-86.9 -52.5,-124.6 C-21.3,-85.2 -13.1,-45.9 -42.6,-16.4 L-60.7,-6.6 L-57.4,8.2 C-29.5,19.7 3.3,18.0 19.7,9.8 C23.0,9.4 25.4,8.6 28.7,8.6 C32.8,9.0 36.9,9.4 40.6,7.4 Z';

/* 纸面颗粒：和主页 grainOver 同一套（深灰和亮白的极淡小点），铺在最上面 */
function grainURL() {
  const n = 200, Rn = rng(99), a = document.createElement('canvas'); a.width = a.height = n; const ax = a.getContext('2d'), im = ax.createImageData(n, n), d = im.data;
  for (let i = 0; i < n * n; i++) { const r = Rn(), o = i * 4; if (r < 0.42) continue;
    if (r < 0.8) { d[o] = 66; d[o + 1] = 66; d[o + 2] = 70; d[o + 3] = 255 * (0.012 + Rn() * 0.07); } else { d[o] = 255; d[o + 1] = 253; d[o + 2] = 246; d[o + 3] = 255 * (0.03 + Rn() * 0.11); } }
  ax.putImageData(im, 0, 0); return a.toDataURL('image/png');
}
function setupGrain() { let el = document.getElementById('grain'); if (!el) { el = document.createElement('div'); el.id = 'grain'; document.body.appendChild(el); } el.style.backgroundImage = 'url(' + grainURL() + ')'; el.style.backgroundSize = (200 / Math.min(2, window.devicePixelRatio || 1) * 0.75) + 'px'; }

/* 一张随舞台大小走的画布 */
function fitCanvas(cv, w, h) { const dpr = Math.min(window.devicePixelRatio || 1, 3); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return g; }

/* 纸上的旧渍：几小撮颗粒，一两根细毛 */
function spots(g, w, h, seed, col) {
  const Rn = rng(seed); g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 9; i++) { const x = Rn() * w, y = Rn() * h, rr = 1.5 + Rn() * Rn() * 5, m = 4 + Math.floor(Rn() * 18); for (let j = 0; j < m; j++) { const a = Rn() * TAU, q = Math.pow(Rn(), 0.7) * rr; dot(g, x + Math.cos(a) * q, y + Math.sin(a) * q * 0.8, 0.3 + Rn() * 0.5); } }
  for (let i = 0; i < 60; i++) dot(g, Rn() * w, Rn() * h, 0.3 + Rn() * 0.35);
  g.fill();
}

/* 铅笔线：两三遍略抖的细笔，两头参差 */
function pencil(g, pts, o) {
  o = o || {}; const Rn = o.rng || Math.random, n = o.n || 2, j = o.j === undefined ? 0.6 : o.j;
  g.lineWidth = o.w || 0.5; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < n; k++) { g.globalAlpha = (o.a || 0.3) * (k ? 0.6 : 1); g.beginPath(); const ox = (Rn() - 0.5) * j, oy = (Rn() - 0.5) * j;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], jx = (Rn() - 0.5) * j * 0.6, jy = (Rn() - 0.5) * j * 0.6; i ? g.lineTo(p[0] + ox + jx, p[1] + oy + jy) : g.moveTo(p[0] + ox - (Rn() * 3), p[1] + oy); }
    g.stroke(); }
  g.globalAlpha = 1;
}

/* 一个圆：实心，边上一圈颗粒由密到疏化开 */
function wetDisc(g, x, y, r, col, seed, vw, vh) {
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (r < 2) return;
  const bw = clamp(r * 0.08, 3, 24), n = Math.min(2400, Math.round(r * 2.2)), Rn = rng(seed); g.beginPath();
  for (let i = 0; i < n; i++) { const a = Rn() * TAU, q = Math.pow(Rn(), 1.8), rr = r + q * bw, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr, s = (0.35 + 0.6 * Rn() * (1 - q)); if (px < -4 || px > vw + 4 || py < -4 || py > vh + 4) continue; dot(g, px, py, s); }
  g.fill();
}
/* 蓝的满月，里面一圈目标那一面的底色往外长，最后只剩一道颗粒蓝边 */
function iris(g, x, y, r, rin, fill, vw, vh) {
  wetDisc(g, x, y, r, C.BLUE, 31, vw, vh);
  if (rin > 0.5) wetDisc(g, x, y, rin, fill, 57, vw, vh);
}

/* 返回月亮：一颗盈凸的小蓝月，外面一圈极细的铅笔圈 */
function litD(r, k) {   // 和主页 litPath 一样的月相：k 是亮的比例，亮面在右
  if (k >= 0.995) return `M${r},0 A${r},${r} 0 1 1 ${-r},0 A${r},${r} 0 1 1 ${r},0 Z`;
  const ex = Math.max(0.001, r * Math.abs(1 - 2 * k)), sweep = k < 0.5 ? 0 : 1;
  return `M0,${-r} A${r},${r} 0 0 1 0,${r} A${ex},${r} 0 0 ${sweep} 0,${-r} Z`;
}
function backMoon(el) {
  el.innerHTML = `<svg viewBox="-18 -18 36 36" aria-hidden="true"><circle r="10.5" fill="none" stroke="var(--fg3)" stroke-width=".5" stroke-dasharray="1.2 2.4"/><circle r="6.6" fill="var(--bg)" stroke="var(--blue)" stroke-width=".7"/><path d="${litD(6.6, 0.72)}" fill="var(--blue)"/><line x1="-14" y1="0" x2="-11.5" y2="0" stroke="var(--fg3)" stroke-width=".6"/></svg>`;
}

/* ---------- 转场 ---------- */
const ssGet = k => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const ssSet = (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
let veil = null, vg = null;
function veilCanvas() { if (!veil) { veil = document.createElement('canvas'); veil.id = 'veil'; document.body.appendChild(veil); } vg = fitCanvas(veil, innerWidth, innerHeight); veil.style.display = 'block'; return vg; }
function hideVeil() { if (veil) { vg.clearRect(0, 0, innerWidth, innerHeight); veil.style.display = 'none'; } }

/* 这一页回主页时用哪一态、哪个入口 */
function homeInfo(page, defSlot, defMorph) {
  const h = ssGet('ta-hand'); let info = null;
  if (h && h.to === page && Date.now() - h.t < 15000) { info = { slot: h.slot | 0, morph: h.morph ? 1 : 0, x: h.x, y: h.y, fresh: true }; ssSet('ta-hand', null); }
  const keep = ssGet('ta-ret-' + page);
  if (!info) info = keep ? { slot: keep.slot | 0, morph: keep.morph ? 1 : 0, fresh: false } : { slot: defSlot, morph: defMorph, fresh: false };
  ssSet('ta-ret-' + page, { slot: info.slot, morph: info.morph });
  return info;
}

/* 新页从第一帧起就是盖满的遮罩色（各页 <head> 里的内联脚本给 html 设了底色并加了 pre 类，body 先藏着）；
   外部样式、字体、第一帧画布都好了，先把遮罩层画满，再去掉 pre，再开始揭开。 */
function unpre() { const d = document.documentElement; d.classList.remove('pre'); d.style.background = ''; }
function settle(stage, go) {
  const left = Math.max(300, 2400 - performance.now()), txt = (stage.innerText || '').slice(0, 500) + 'touch 0123456789';
  const fl = document.fonts && document.fonts.load ? Promise.all(['300 20px "Cormorant Garamond"', 'italic 300 20px "Cormorant Garamond"', '400 12px "Noto Serif SC"', '300 12px "Noto Serif SC"'].map(f => document.fonts.load(f, txt).catch(() => 0))).then(() => document.fonts.ready) : Promise.resolve();
  Promise.race([fl, new Promise(r => setTimeout(r, left))]).then(() => requestAnimationFrame(() => requestAnimationFrame(go)));
}
function revealIn(info, stage, onDone) {   // 页面内容从圆心往外显出来；返回月亮最后从一个点长出来
  const back = document.getElementById('back');
  settle(stage, () => {
    if (!info.fresh || REDUCED) { stage.style.transition = 'none'; stage.style.opacity = '0'; void stage.offsetWidth; unpre(); requestAnimationFrame(() => requestAnimationFrame(() => { stage.style.transition = 'opacity .22s ease-out'; stage.style.opacity = '1'; })); setTimeout(() => { stage.style.transition = ''; onDone && onDone(); }, 280); return; }
    const g = veilCanvas(), vw = innerWidth, vh = innerHeight, x = info.x, y = info.y, Rm = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) * 1.04, r0 = 10, D = 640;
    const sr = stage.getBoundingClientRect();
    g.fillStyle = (window.__pre && window.__pre.c) || getComputedStyle(document.body).backgroundColor; g.fillRect(0, 0, vw, vh); veil.style.visibility = 'visible';   // 遮罩层先画满（body 还藏着，它自己显出来）
    if (back) { back.style.transform = 'scale(0)'; back.style.transformOrigin = '50% 50%'; }
    stage.style.clipPath = `circle(${r0}px at ${(x - sr.left).toFixed(1)}px ${(y - sr.top).toFixed(1)}px)`;
    let fin = false, t0 = 0;
    const end = () => { if (fin) return; fin = true; stage.style.clipPath = ''; hideVeil(); if (back) back.style.transform = ''; onDone && onDone(); };
    const tick = now => { if (!t0) t0 = now; const p = clamp((now - t0) / D, 0, 1), e = smoother(p), r = r0 * Math.pow(Rm / r0, e);
      stage.style.clipPath = `circle(${r.toFixed(1)}px at ${(x - sr.left).toFixed(1)}px ${(y - sr.top).toFixed(1)}px)`;
      g.clearRect(0, 0, vw, vh); const al = 1 - sstep(0.7, 1, p); if (al > 0.01) { g.globalAlpha = al; g.save(); g.beginPath(); g.rect(0, 0, vw, vh); g.arc(x, y, Math.max(0, r - 1.2), 0, TAU, true); g.clip(); wetDisc(g, x, y, r + lerp(5, 1.4, e), C.BLUE, 31, vw, vh); g.restore(); g.globalAlpha = 1; }
      if (back) { const k = sstep(0.62, 1, p), s = k < 1 ? k * (1 + 0.25 * Math.sin(PI * k)) : 1; back.style.transform = `scale(${s.toFixed(3)})`; }
      if (p < 1 && !fin) requestAnimationFrame(tick); else end(); };
    setTimeout(end, D + 900);   // 后台标签页里 rAF 停了也别让页面一直被圆裁着
    requestAnimationFrame(() => { unpre(); requestAnimationFrame(tick); });   // 遮罩已画满的下一帧才让 body 显出来，再下一帧开始揭
  });
}

function leaveHome(info, fromEl) {   // 返回月亮放大盖满全屏，圆里是主页那一态的底色
  if (window.__leaving) return; window.__leaving = true;
  const rc = fromEl.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2, vw = innerWidth, vh = innerHeight, Rm = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) * 1.06, r0 = 7, fill = info.morph ? C.INK : C.PAPER, D = REDUCED ? 200 : 680, t0 = performance.now(), g = veilCanvas();
  const go = () => { ssSet('ta-back', { slot: info.slot, morph: info.morph, t: Date.now() }); location.href = 'index.html?splash=0&morph=' + info.morph + '&slot=' + info.slot; };
  const tick = now => { const p = clamp((now - t0) / D, 0, 1), e = smoother(p), r = r0 * Math.pow(Rm / r0, e), rin = sstep(0.05, 0.32, p) * Math.max(r * 0.86, r - 11);
    g.clearRect(0, 0, vw, vh); iris(g, x, y, r, rin, fill, vw, vh);
    if (p < 1 || ++held < 3) requestAnimationFrame(tick); else go(); };   // 满屏的那一帧多停两帧，确认已经画上屏再跳
  let held = 0; requestAnimationFrame(tick);
}
/* 从后台回到这一页（浏览器返回键的页面缓存）时把遮罩收掉 */
window.addEventListener('pageshow', ev => { if (ev.persisted) { window.__leaving = false; hideVeil(); unpre(); const st = document.getElementById('stage'); if (st) { st.style.clipPath = ''; st.style.opacity = ''; st.style.transition = ''; } const bk = document.getElementById('back'); if (bk) bk.style.transform = ''; } });

window.NP = { C, TAU, PI, clamp, lerp, sstep, smoother, rng, hash, Q, REDUCED, dot, birdD, birdP, PERCH, setupGrain, fitCanvas, spots, pencil, wetDisc, iris, litD, backMoon, homeInfo, revealIn, leaveHome, ssGet, ssSet };
})();

/* 边缘右划返回（从邮票进了心脏/工程板/口袋以后，能划回聊天页）。
   手指从屏幕左边缘（24px 内）起手往右划，纸跟着手指让开一点；划过 84px 松手，就回来的那一页：
   有同源的来路就 history.back()（从聊天页来的回聊天页，从主页来的回主页），没有来路（直接开的网址）就去 chat.html。
   没划够就缩回去。只认左边缘起手，所以不抢页面里别的横向手势（一起听的进度、心电线是竖着拖的）。
   左上的月亮不变，照旧回主页。主页和聊天页自己不挂这段。用法：接在 pages.js 末尾，或各页在 pages.js 之后引这个文件。 */
(function () {
  const st = document.getElementById('stage'); if (!st) return;
  if (/\/(index|chat)\.html$|\/$/.test(location.pathname)) return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches, EDGE = 24, GO = 84;
  let on = false, lock = 0, x0 = 0, y0 = 0, dx = 0;
  const set = v => { if (REDUCED) return; st.style.transform = v ? 'translate3d(' + v.toFixed(1) + 'px,0,0)' : ''; st.style.opacity = v ? String(1 - Math.min(v / 320, 0.35)) : ''; };
  const settle = () => { st.style.transition = REDUCED ? '' : 'transform .2s ease,opacity .2s ease'; };
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || window.__leaving) return; const t = e.touches[0]; if (t.clientX > EDGE) return;
    on = true; lock = 0; x0 = t.clientX; y0 = t.clientY; dx = 0; st.style.transition = 'none';
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!on) return; const t = e.touches[0], ax = t.clientX - x0, ay = t.clientY - y0;
    if (!lock) { if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return; lock = ax > 0 && Math.abs(ax) > Math.abs(ay) * 1.2 ? 1 : -1; }
    if (lock < 0) { on = false; settle(); set(0); return; }
    dx = Math.max(0, ax); set(dx * 0.6);
  }, { passive: true });
  const leave = () => {
    let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (_) {}
    if (same && history.length > 1) history.back(); else location.href = 'chat.html';
  };
  addEventListener('touchend', () => {
    if (!on) return; on = false; settle();
    if (dx > GO) { window.__leaving = true; if (!REDUCED) { st.style.transform = 'translate3d(' + Math.round(innerWidth * 0.6) + 'px,0,0)'; st.style.opacity = '0'; } setTimeout(leave, REDUCED ? 0 : 170); }
    else set(0);
  }, { passive: true });
  addEventListener('touchcancel', () => { if (on) { on = false; settle(); set(0); } }, { passive: true });
  /* 浏览器把这一页从缓存里拿回来时（比如又点了前进），把让开的纸放回原位 */
  addEventListener('pageshow', ev => { if (ev.persisted) { st.style.transition = ''; st.style.transform = ''; st.style.opacity = ''; } });
})();
