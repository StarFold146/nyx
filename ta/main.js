/* 鸟 · 月 · 眼 v13（第二态：莫比乌斯厚圈当井口；背后一整座铅笔灰的旋转楼梯当底图，最里面几圈落在洞里）—— 眼睛：蓝色的月亮当瞳孔，十七只燕子围成眼眶横压过它（负片换色）。
   黑和灰是眼睛身后的底图：一块墨黑从上边框垂下来、贴右被裁，里面是白描的窗棂和一扇跟着轨道转的玫瑰窗；铅笔灰的拱廊从黑块的直边长出来，一跨接一跨往左退远。
   开屏只有一道闭着的眼；点一下：泪线一松一紧地垂下去（线头那只燕子跟着线速忽大忽小）、几何线一道道闩上、燕子挣脱往上飞、鸟群涌进来落成眼眶、黑块垂下、月亮长开、线稿一笔笔画出来。
   形变：底下的黑带拿掉，泪线下端吊一个小坠子；按住坠子往下拉，鸟群朝两边飞开，月亮缩成井底的瞳孔，带子长成一圈莫比乌斯环，踏步从井心一级级转出来，黑块收进洞里当阴影（第二页，入口照旧，换到带子上）；再拉一次变回眼睛。
   ?morph=0..1 把形变定在某个进度（配 ?still=1）   ?splash=0 直接主页   ?still=1 冻结   ?t=0..1 把衔接定在某个进度   ?slot=0..4 哪一项落在焦点   ?orb=度数 入口轨道多转这么多   ?dial=home|life|hold 直接开转盘   ?rot=度数 定住转盘 */
(() => {
'use strict';
const Q = new URLSearchParams(location.search);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const backOut = x => { x = clamp(x, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const settle = (u, px) => { u = clamp(u, 0, 1); return [u < 0.84 ? 1 - Math.pow(1 - u / 0.84, 3) : 1, u < 0.84 ? 0 : Math.sin((u - 0.84) / 0.16 * Math.PI) * px]; };   // 到位时轻轻过一点再回来
const TAU = Math.PI * 2, PI = Math.PI, RAD = PI / 180;
const TPIN = Q.has('t') ? clamp(+Q.get('t') || 0, 0, 1) : null;
const DIALQ = Q.get('dial'), ROTQ = Q.has('rot') ? +Q.get('rot') || 0 : null, SLOTQ = Q.has('slot') ? clamp(Math.round(+Q.get('slot') || 0), 0, 4) : null;
const STILL = Q.get('still') === '1' || TPIN !== null;
const NOSPLASH = Q.get('splash') === '0' || !!DIALQ;
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const DUR = REDUCED ? 0.9 : 5.7;
const INK = '#16171c', LINE = '#2b2c32', SIDE = '#3c3d44', RISER = '#303137', BLUE = '#1c31b6', RIM = '#8a98c4', PAPER = '#f1eee6', PEN = '#55575c', GREY = '#97989c', FACE = '#f8f6f0', LGREY = '#c6c3bb';
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const h2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ax = fx * fx * (3 - 2 * fx), ay = fy * fy * (3 - 2 * fy); return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), ax), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), ax), ay); }

/* ---------- 鸟：定稿剪影 e1 俯冲 / e2 上冲，扇翅帧给飞行和转盘 ---------- */
const E1 = new Path2D('M50.0,4.1 L42.6,0.4 C42.6,-5.7 36.9,-10.2 29.5,-10.7 C26.2,-11.1 23.0,-10.7 19.7,-9.8 C8.2,-19.7 -24.6,-42.6 -60.7,-57.4 L-95.1,-72.1 C-57.4,-54.1 -32.8,-32.8 -47.5,-9.8 C-73.8,-7.4 -101.6,-9.8 -124.6,-16.4 C-104.9,-8.2 -86.9,-2.5 -77.0,-0.8 C-90.2,1.6 -108.2,4.9 -129.5,11.5 C-103.3,8.2 -75.4,7.4 -49.2,9.0 C-29.5,36.1 -62.3,82.0 -114.8,116.4 C-57.4,96.7 3.3,52.5 19.7,9.8 C23.0,9.4 25.4,8.6 28.7,8.6 C32.8,9.0 36.9,9.4 40.6,7.4 Z');
const E2 = new Path2D('M-8.2,-11.5 C-24.6,-41.0 -65.6,-68.9 -118.0,-80.3 C-73.8,-54.1 -50.8,-36.1 -60.7,-8.2 Z M-50.8,-6.6 C-73.8,-4.9 -101.6,0.0 -126.2,6.6 C-104.9,4.1 -86.9,3.3 -73.8,4.1 C-88.5,8.2 -104.9,14.8 -119.7,24.6 C-98.4,18.0 -73.8,11.5 -50.8,6.6 Z M50.0,4.1 L42.6,0.4 C42.6,-5.7 36.9,-10.2 29.5,-10.7 C26.2,-11.1 23.0,-10.7 19.7,-9.8 C24.6,-42.6 0.0,-86.9 -52.5,-124.6 C-21.3,-85.2 -13.1,-45.9 -42.6,-16.4 L-60.7,-6.6 L-57.4,8.2 C-29.5,19.7 3.3,18.0 19.7,9.8 C23.0,9.4 25.4,8.6 28.7,8.6 C32.8,9.0 36.9,9.4 40.6,7.4 Z');
const NFR = 48, FB = []; for (let i = 0; i < NFR; i++) { const f = window.flap(i / NFR); FB.push(new Path2D(f.far + ' ' + f.body + ' ' + f.near)); }
const fidx = ph => ((Math.round(ph * NFR) % NFR) + NFR) % NFR;
function bird(g, path, x, y, sc, hd, col, syy) { g.save(); g.translate(x, y); g.rotate(hd); g.scale(sc, sc * (syy === undefined ? 1 : syy)); g.fillStyle = col; g.fill(path); g.restore(); }

/* ---------- 画布与版面 ---------- */
const stage = document.getElementById('stage'), cv = document.getElementById('c'), g = cv.getContext('2d');
const navEl = document.getElementById('nav'), goEl = document.getElementById('go');
let W = 0, H = 0, dpr = 1, U = 1, UF = 1, US = 1, R = 100, RR = 130;
const C = { x: 0, y: 0 };
const ENTRY = [   // 每格里的房间：祂自己的页在同目录，其余回 Nyx 原版那一间（../）
  { k: 'chat', en: 'Chat', zh: '聊天', items: [['进入', 'chat.html'], ['联系人', 'people-go.html'], ['原版聊天', '../index.html#chat']] },
  { k: 'home', en: 'Home', zh: '小家', items: [['杂物间', '../attic.html'], ['房间', '../room.html']] },
  { k: 'life', en: 'Life', zh: '生活', items: [['厨房', '../kitchen.html']] },
  { k: 'listen', en: 'Listen', zh: '一起听', items: [['进入', 'listen.html'], ['原版一起听', '../listen.html']] },
  { k: 'hold', en: 'Hold', zh: '底舱', items: [['记忆小镇', '../town/index.html'], ['口袋', 'pocket.html'], ['工程板', 'board.html'], ['心脏', 'heart.html']] },
];
const ZHALL = '进入鸟月眼轻触睁聊天小家生活一起听底舱房间杂物厨记忆小镇口袋工程板心脏原版联系人换皮肤·';
const dot = (g, x, y, r) => { if (r < 0.03) return; if (r < 0.6) g.rect(x - r, y - r, r * 2, r * 2); else { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((w || W) * dpr)); c.height = Math.max(1, Math.round((h || H) * dpr)); const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; }
const P = (dx, dy) => [C.x + dx * US, C.y + dy * US];   // 玫瑰窗的设计坐标：相对圆心，窗的外半径记作 185

/* ---------- 铅笔：每条线切成小段存起来，可以按顺序一笔笔画 ---------- */
let UN = [], NPRE = 0, SR = rng(1), RT = [], skN = 0, pcv = null, pcx = null, wcv = null, wcx = null, BX = { x: 0, y: 0, w: 1, h: 1 };
const FD1 = [1, 1];
function hand(pts, o) {
  o = o || {}; const list = o.to || UN, w = o.w || 0.7, al = o.a || 0.45, n = o.n || 2, jit = (o.j === undefined ? 0.7 : o.j) * U, ov = (o.ov === undefined ? 3 : o.ov) * U, k = o.k || 0, fd = o.fade || FD1;
  const m = pts.length, Ls = new Array(m); Ls[0] = 0; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8)) return;
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * SR(), s1 = L + ov * SR();
    if (ps) { const span = 0.4 + 0.6 * SR(), st = SR() * (1 - span); s0 = L * st - ov * 0.4 * SR(); s1 = L * (st + span) + ov * 0.4 * SR(); }   // 后几遍只描一截
    const off = (SR() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = SR() * TAU, p2 = SR() * TAU, p3 = SR() * TAU, f1 = TAU / ((70 + SR() * 90) * U), f2 = TAU / ((16 + SR() * 20) * U), f3 = TAU / ((36 + SR() * 60) * U), pa = ps ? 0.5 + 0.4 * SR() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = (10 + SR() * 16) * U;
    for (let guard = 0; guard < 6000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * f2 + p2));
      cur.push(a[0] + tx * f - ty * d, a[1] + ty * f + tx * d);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 4) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * SR()), ff = lerp(fd[0], fd[1], clamp(sm / L, 0, 1));
          list.push({ p: cur, w: w * (0.55 + 0.7 * pr) * Math.sqrt(U), a: Math.min(0.95, al * pa * ff * (0.5 + 0.75 * pr)), k }); }
        if (s >= s1) break; cur = cur.slice(-2); acc = 0; segL = (10 + SR() * 16) * U;
      }
      const stp = Math.max(0.01, Math.min(3.2 * U, s1 - s)); s += stp; acc += stp;
    }
  }
}
function hatch(poly, deg, gap, o) {   // 排线：一组平行的短笔，两头参差
  const t = deg * RAD, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * U * (0.3 + SR() * 0.5); d < mx; d += gap * U * (0.72 + SR() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.6 * U) continue; const a = xs[i] + l * SR() * 0.14, b = xs[i + 1] - l * SR() * 0.14; hand([[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o); }
  }
}
let ARCH = { cx: 0, cy: 0, r: 1 }, GEO = {}, bcv = null, bcx = null, BB = { x: 0, y: 0, w: 1, h: 1 }, RO = 100;
const BLK = { x: 0, y1: 0 };   // 顶上的黑块；第二态里它收进环的洞里，成了井里的阴影
const S2 = (x, y) => [x * U, C.y + (y - 280) * U];   // 底图的设计坐标：430 宽，月亮圆心在 y=280
function buildSketch() {
  UN = []; RT = []; SR = rng(20261110);
  const Rd = 185, cxd = C.x / U, X0 = BLK.x / U, ROd = RO / U;
  const arcP = (cx, cy, r, a0, a1) => { const n = Math.max(5, Math.ceil(Math.abs(a1 - a0) * RAD * r / 5)), pts = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * RAD; pts.push(P(cx + Math.cos(t) * r, cy + Math.sin(t) * r)); } return pts; };
  const A = (cx, cy, r, a0, a1, o) => hand(arcP(cx, cy, r, a0, a1), o);
  const QC = (p0, c, p1, o) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, m = 1 - t; pts.push(P(m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1])); } hand(pts, o); return pts; };
  const SL = (x0, y0, x1, y1, o) => hand([S2(x0, y0), S2(x1, y1)], o);
  const SQ = (p0, c, p1, o) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, m = 1 - t; pts.push(S2(m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1])); } hand(pts, o); };
  const SA = (cx, cy, r, a0, a1, o) => { const n = Math.max(5, Math.ceil(Math.abs(a1 - a0) * RAD * r / 4)), pts = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * RAD; pts.push(S2(cx + Math.cos(t) * r, cy + Math.sin(t) * r)); } hand(pts, o); };
  const CL = { w: 0.42, a: 0.2, n: 1, j: 0.5, ov: 9 }, CL2 = { w: 0.42, a: 0.16, n: 1, j: 0.5, ov: 6 }, OL = { w: 0.7, a: 0.46, n: 2, j: 0.7, ov: 3 }, OLs = { w: 0.58, a: 0.38, n: 2, j: 0.45, ov: 1.6 }, HT = { w: 0.5, a: 0.3, n: 1, j: 0.25, ov: 1.4 };
  const W1 = { w: 0.62, a: 0.8, n: 2, j: 0.5, ov: 2, k: 1 }, W0 = { w: 0.45, a: 0.42, n: 1, j: 0.5, ov: 3, k: 1 }, B1 = { w: 0.6, a: 0.66, n: 2, j: 0.5, ov: 2, k: 2 }, B0 = { w: 0.45, a: 0.36, n: 1, j: 0.5, ov: 3, k: 2 };
  const fd = (o, a, b) => Object.assign({}, o, { fade: [a, b] });
  // 开屏就在的两笔：中轴线、一小段圆规弧
  SL(cxd, 36, cxd, 258, { w: 0.5, a: 0.3, n: 1, j: 0.5, ov: 0 });
  A(0, 0, 1.22 * Rd, 198, 222, { w: 0.5, a: 0.32, n: 1, j: 0.4, ov: 5 });
  NPRE = UN.length;
  // 灭点在左边画框外的视平线上；一层层的横线都往它收
  const VX = -180, HY = 280, D0 = X0 - VX, py = (y0, x) => HY + (y0 - HY) * (x - VX) / D0, lv = (y0, x1, o) => SL(X0, y0, x1, py(y0, x1), o);
  lv(440, -4, CL2); lv(362, 40, CL2); lv(134, 60, CL); lv(235, 20, CL2);
  lv(610, -6, fd(OL, 1, 0.25)); lv(622, 10, fd(OLs, 1, 0.2)); lv(330, -6, fd(OL, 1, 0.25)); lv(323, 30, fd(OLs, 1, 0.2)); lv(158, -6, fd(OL, 1, 0.25)); lv(151, 24, fd(OLs, 1, 0.2));
  // 黑块里的白描：竖棂、尖拱头、柱头、一道横带，和罩着玫瑰窗的大拱
  [20, 48, 76, 104, 132].forEach((dx, i, arr) => { const x = X0 + dx, dd = ROd * ROd - (x - cxd) * (x - cxd), h = dd > 0 ? Math.sqrt(dd) + 5 : -1;
    if (h < 0) SL(x, -340, x, 392, fd(B0, 1, 0.3)); else { SL(x, -340, x, 280 - h, i % 2 ? B0 : B1); SL(x, 280 + h, x, 398, fd(B0, 0.9, 0.2)); }
    SL(x - 3.5, 92, x + 3.5, 92, B1); if (i < arr.length - 1) { const xn = X0 + arr[i + 1], xm = (x + xn) / 2, o = SR() < 0.7 ? B1 : B0; SQ([x, 70], [x, 44], [xm, 30], o); if (SR() < 0.8) SQ([xn, 70], [xn, 44], [xm, 30], o); } });
  SL(X0 + 2, 100, 434, 100, B0); SL(X0 + 2, 105, 434, 105, B0);
  SA(cxd - 70, 300, 215, 289, 346, B1); SA(cxd - 70, 300, 207, 291, 344, B0); SA(cxd + 70, 300, 215, 234, 251, B0);
  // 玫瑰窗（纸白，和月亮同心，比月亮大一圈；月亮盖在它中心，外圈花瓣从四周露出来；只画六七成）
  for (let i = 0; i < 12; i++) { const d = i * 30 * RAD, cs = Math.cos(d), sn = Math.sin(d), r = SR(), full = r < 0.65, end = full ? 0.965 : 0.72 + 0.2 * SR(); if (r > 0.94) continue;
    const pts = [P(cs * Rd * 0.6, sn * Rd * 0.6), P(cs * Rd * end, sn * Rd * end)]; hand(pts, full ? W1 : W0); RT.push(pts); }
  A(0, 0, 0.66 * Rd, 0, 372, W1);
  for (let i = 0; i < 12; i++) { const d = (i * 30 + 15) * RAD, cx = Math.cos(d) * 0.81 * Rd, cy = Math.sin(d) * 0.81 * Rd, r = SR();
    if (r < 0.62) { const s = SR() * 360; A(cx, cy, 0.135 * Rd, s, s + 372, W1); if (SR() < 0.6) A(cx, cy, 0.05 * Rd, 0, 380, W0); RT.push(arcP(cx, cy, 0.135 * Rd, s, s + 360)); }
    else if (r < 0.88) { const s = SR() * 360; A(cx, cy, 0.135 * Rd, s, s + 150 + SR() * 90, W0); } }
  { const d = 315 * RAD, c = P(Math.cos(d) * 0.81 * Rd, Math.sin(d) * 0.81 * Rd), e = P(Math.cos(345 * RAD) * 1.07 * Rd, Math.sin(345 * RAD) * 1.07 * Rd);   // 记号：一片花瓣填实，外圈一颗小点，转起来看得出
    UN.push({ p: [c[0], c[1], c[0] + 0.01, c[1]], w: 0.25 * Rd * US, a: 0.92, k: 1 }); UN.push({ p: [e[0], e[1], e[0] + 0.01, e[1]], w: 4.4 * U, a: 0.95, k: 1 }); }
  A(0, 0, 0.965 * Rd, 0, 250, W1); A(0, 0, 0.965 * Rd, 262, 352, W1); A(0, 0, 1.0 * Rd, 30, 300, W0);
  // 反复的拱廊：尖拱 + 柱 + 小花窗一跨接一跨，从黑块的直边长出来往左退远；上面一排小一号的高侧窗
  const xs = [X0]; for (let i = 0, w = 58; i < 10; i++, w *= 0.86) xs.push(xs[i] - w);
  const bays = [];
  for (let i = 0; i < 10; i++) { const xr = xs[i], xl = xs[i + 1], w = xr - xl, xm = (xr + xl) / 2, fa = 1 - 0.078 * i, o = Object.assign({}, i < 4 ? OL : OLs, { a: (i < 4 ? 0.5 : 0.42) * fa, ov: 2 }), ot = Object.assign({}, o, { w: 0.5, n: 1 }), sk = () => SR() < 0.065 * i;
    if (!sk()) SL(xl, py(440, xl), xl, py(610, xl), o); if (!sk()) SL(xl + 2.6 * fa, py(438, xl), xl + 2.6 * fa, py(610, xl), ot); if (!sk()) SL(xl - 2, py(440, xl), xl + 5, py(440, xl), o);
    if (!sk()) SQ([xr, py(440, xr)], [xr - 0.03 * w, py(385, xr)], [xm, py(362, xm)], o); if (!sk()) SQ([xl + 2.6 * fa, py(440, xl)], [xl + 2.6 * fa + 0.03 * w, py(385, xl)], [xm, py(362, xm)], o);
    if (i < 3) { SQ([xr - 4, py(440, xr)], [xr - 4 - 0.03 * w, py(392, xr)], [xm, py(370, xm)], ot); SQ([xl + 6.6, py(440, xl)], [xl + 6.6 + 0.03 * w, py(392, xl)], [xm, py(370, xm)], ot); }
    if (i < 8 && !sk()) { const s = SR() * 360; SA(xl + 1, py(378, xl), 0.115 * w, s, s + 375, ot); if (i < 4) SA(xl + 1, py(378, xl), 0.045 * w, 0, 380, ot); }   // 拱肩上的小花窗
    if (!sk()) SL(xl + 1, py(330, xl), xl + 1, py(158, xl), ot);
    [xm - w * 0.24, xm + w * 0.24].forEach((c, k) => { if (sk() || (i > 6 && k)) return; const hw = w * 0.13;
      SL(c - hw, py(310, c), c - hw, py(235, c), ot); SL(c + hw, py(310, c), c + hw, py(235, c), ot); SQ([c - hw, py(235, c)], [c - hw, py(210, c)], [c, py(198, c)], ot); SQ([c + hw, py(235, c)], [c + hw, py(210, c)], [c, py(198, c)], ot);
      if (i < 4) hatch([S2(c - hw + 1, py(308, c)), S2(c - hw + 1, py(236, c)), S2(c, py(205, c)), S2(c + hw - 1, py(236, c)), S2(c + hw - 1, py(308, c))], -62, 3, Object.assign({}, HT, { a: 0.25 * fa })); });
    bays.push([xr, xl, xm, fa]); }
  // 尖塔和远处一座小的
  { const bx = 118, by = py(158, bx); SL(bx - 10, by + 4, bx - 10, 150, OL); SL(bx + 10, by + 2, bx + 10, 150, OL); SL(bx - 13, 150, bx + 13, 150, OL); SL(bx - 13, 145, bx + 13, 145, OLs);
    SL(bx - 10, 145, bx, 104, OL); SL(bx + 10, 145, bx, 104, OL); SL(bx - 10, 145, bx, 128, OLs); SL(bx + 10, 145, bx, 128, OLs); SL(bx, 104, bx, 93, OLs); SL(bx - 3.5, 98, bx + 3.5, 98, OLs);
    [[-1, 136], [1, 128], [-1, 120]].forEach(c => { const x = bx + c[0] * 10 * (c[1] - 104) / 41; hand([S2(x, c[1]), S2(x + c[0] * 3, c[1] - 2.5), S2(x + c[0] * 4, c[1] - 5.5)], OLs); });
    hatch([S2(bx + 1, 148), S2(bx + 9, 148), S2(bx + 9, by), S2(bx + 1, by + 2)], 30, 3, Object.assign({}, HT, { a: 0.26 })); GEO.spire = S2(bx, 104);
    const tx = 51, ty = py(158, tx), ol = Object.assign({}, OLs, { a: 0.26 }); SL(tx - 5, ty + 2, tx - 5, 205, ol); SL(tx + 5, ty + 1, tx + 5, 205, ol); SL(tx - 5, 205, tx, 186, ol); SL(tx + 5, 205, tx, 186, ol); }
  // 排线的暗面：拱洞里、黑块直边旁、黑块底下化进纸里的那一段
  bays.forEach((b, i) => { if (i > 5) return; const xr = b[0] - 2, xl = b[1] + 4.5, xm = b[2], fa = b[3], o = Object.assign({}, HT, { a: 0.3 * fa });
    hatch([S2(xr, py(438, xr)), S2(xm, py(372, xm)), S2(xl, py(438, xl)), S2(xl, py(590, xl)), S2(xr, py(574, xr))], 62 + i * 3, 3.3 + 0.4 * i, o);
    if (i < 2) hatch([S2(xr, py(438, xr)), S2(xm, py(372, xm)), S2(xl, py(438, xl)), S2(xl, py(500, xl)), S2(xr, py(486, xr))], -30, 3.8, Object.assign({}, o, { a: 0.22 * fa })); });
  hatch([S2(X0 - 16, 150), S2(X0 - 1, 150), S2(X0 - 1, 398), S2(X0 - 16, 436)], 74, 3.1, Object.assign({}, HT, { a: 0.34 }));
  hatch([S2(X0 - 26, 404), S2(434, 398), S2(434, 448), S2(X0 - 10, 462)], 66, 3.3, Object.assign({}, HT, { a: 0.32 }));
  hatch([S2(X0 + 10, 398), S2(434, 398), S2(434, 430), S2(X0 + 30, 436)], -24, 3.8, Object.assign({}, HT, { a: 0.22 }));
  // 画布
  [pcv, pcx] = mkCanvas(); pcx.strokeStyle = PEN; pcx.lineCap = 'round'; pcx.lineJoin = 'round';
  BX = { x: Math.floor(C.x - RO - 3), y: Math.floor(C.y - RO - 3), w: Math.ceil(2 * RO + 6), h: Math.ceil(2 * RO + 6) };
  [wcv, wcx] = mkCanvas(BX.w, BX.h); wcx.translate(-BX.x, -BX.y); wcx.strokeStyle = PAPER; wcx.lineCap = 'round'; wcx.lineJoin = 'round';
  BB = { x: Math.floor(BLK.x - 40 * U), y: 0, w: Math.ceil(W - BLK.x + 40 * U), h: Math.ceil(BLK.y1 + 70 * U) };
  [bcv, bcx] = mkCanvas(BB.w, BB.h); bcx.translate(-BB.x, -BB.y); bcx.strokeStyle = PAPER; bcx.lineCap = 'round'; bcx.lineJoin = 'round';
  skN = 0;
}
function unit(x, un) { x.globalAlpha = un.a; x.lineWidth = un.w; x.beginPath(); const p = un.p; x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.stroke(); }
function sketchTo(n) { if (!pcv) return; n = Math.min(n | 0, UN.length); for (; skN < n; skN++) { const un = UN[skN]; unit(un.k === 1 ? wcx : un.k === 2 ? bcx : pcx, un); } }
/* 两条滑进来的铅笔长线：过月亮圆心的视平线、它下面一条平行线 */
let AUXA = [], AUXB = [];
function buildAux() { const s = SR; SR = rng(4711); AUXA = []; AUXB = []; const o = { w: 0.48, a: 0.3, n: 2, j: 0.6, ov: 5 }, X0 = BLK.x / U;
  hand([S2(2, 280), S2(X0 + 34, 280)], Object.assign({ to: AUXA }, o)); hand([S2(16, 326), S2(X0 + 34, 326)], Object.assign({ to: AUXB }, o)); SR = s; }
function drawAux(g, K) { g.strokeStyle = PEN; g.lineCap = 'round';
  if (K.axOn) { g.save(); g.translate(K.ax, 0); for (const un of AUXA) unit(g, un); g.restore(); }
  if (K.bxOn) { g.save(); g.translate(K.bx, 0); for (const un of AUXB) unit(g, un); g.restore(); }
  g.globalAlpha = 1; }

/* ---------- 纸：细噪点一张小贴图铺满，再零星几处复印斑 ---------- */
let paperPat = null, SPOTS = [], HAIRS = [];
function buildPaper() {
  const n = 200, cell = Math.max(1, Math.round(dpr * 0.75)), Rn = rng(99), a = document.createElement('canvas'); a.width = a.height = n; const ax = a.getContext('2d'), im = ax.createImageData(n, n), d = im.data;
  for (let i = 0; i < n * n; i++) { const r = Rn(), o = i * 4; if (r < 0.42) continue;
    if (r < 0.8) { d[o] = 66; d[o + 1] = 66; d[o + 2] = 70; d[o + 3] = 255 * (0.012 + Rn() * 0.07); } else { d[o] = 255; d[o + 1] = 253; d[o + 2] = 246; d[o + 3] = 255 * (0.03 + Rn() * 0.11); } }
  ax.putImageData(im, 0, 0);
  const t = document.createElement('canvas'); t.width = t.height = n * cell; const tx = t.getContext('2d'); tx.imageSmoothingEnabled = false; tx.drawImage(a, 0, 0, n * cell, n * cell);
  paperPat = g.createPattern(t, 'repeat');
  SPOTS = []; HAIRS = [];
  for (let i = 0; i < 15; i++) { const x = Rn() * W, y = Rn() * H, rr = (1.5 + Rn() * Rn() * 5) * U, m = 4 + Math.floor(Rn() * 22); for (let j = 0; j < m; j++) { const a2 = Rn() * TAU, q = Math.pow(Rn(), 0.7) * rr; SPOTS.push(x + Math.cos(a2) * q, y + Math.sin(a2) * q * 0.8, (0.3 + Rn() * 0.5) * U); } }
  for (let i = 0; i < 90; i++) SPOTS.push(Rn() * W, Rn() * H, (0.3 + Rn() * 0.35) * U);
  for (let i = 0; i < 3; i++) { const x = Rn() * W, y = Rn() * H, an = Rn() * TAU, l = (7 + Rn() * 9) * U; HAIRS.push([x, y, x + Math.cos(an) * l * 0.5 + Math.sin(an) * 2.5 * U, y + Math.sin(an) * l * 0.5 - Math.cos(an) * 2.5 * U, x + Math.cos(an) * l, y + Math.sin(an) * l]); }
}
function drawSpots(g) { g.fillStyle = 'rgba(84,84,88,0.2)'; g.beginPath(); for (let i = 0; i < SPOTS.length; i += 3) dot(g, SPOTS[i], SPOTS[i + 1], SPOTS[i + 2]); g.fill(); drawHairs(g); }
function drawHairs(g) { g.strokeStyle = 'rgba(84,84,88,0.2)'; g.lineWidth = 0.4; g.beginPath(); for (const h of HAIRS) { g.moveTo(h[0], h[1]); g.quadraticCurveTo(h[2], h[3], h[4], h[5]); } g.stroke(); }
function grainOver() { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = paperPat; g.fillRect(0, 0, cv.width, cv.height); g.setTransform(dpr, 0, 0, dpr, 0, 0); }

/* ---------- 黑：垫在眼睛后面的一块墨黑，贴着上边和右边被裁掉。左边是利落的直边，底下用颗粒化进纸里 ---------- */
let blockCv = null;
function buildBlock() {
  const Rn = rng(8080); let x; [blockCv, x] = mkCanvas(BB.w, BB.h); x.translate(-BB.x, -BB.y);
  x.fillStyle = INK; x.fillRect(BLK.x, -2, W - BLK.x + 2, BLK.y1 + 2);
  const lite = new Path2D(), dark = new Path2D(), pap = new Path2D(), ink = new Path2D(), rect = (p, px, py, s) => p.rect(px - s, py - s, s * 2, s * 2), bw = W - BLK.x;
  for (let k = 0; k < 12000; k++) { const px = BLK.x + Rn() * bw, py = Rn() * BLK.y1, nz = vnoise(px / (60 * U) + 7, py / (60 * U) + 3) * 0.7 + vnoise(px / (22 * U) + 1, py / (22 * U) + 5) * 0.3, r = Rn();
    if (nz > 0.56 && r < (nz - 0.56) * 3.2) rect(lite, px, py, (0.35 + Rn() * 0.4) * U); else if (nz < 0.42 && r < (0.42 - nz) * 3) rect(dark, px, py, (0.4 + Rn() * 0.5) * U); else if (r > 0.997) rect(pap, px, py, (0.3 + Rn() * 0.35) * U); }
  for (let k = 0; k < 11000; k++) { const d = Rn(), py = BLK.y1 - d * 100 * U; if (Rn() < Math.pow(1 - d, 2.3)) rect(pap, BLK.x + Rn() * bw, py, (0.4 + Rn() * 0.6) * U); }   // 底边：纸白颗粒往上咬
  for (let k = 0; k < 5000; k++) { const d = Rn(), py = BLK.y1 + d * 62 * U; if (Rn() < Math.pow(1 - d, 2.2)) rect(ink, BLK.x + Rn() * bw, py, (0.4 + Rn() * 0.6) * U); }   // 墨点往下散
  for (let k = 0; k < 260; k++) rect(Rn() < 0.5 ? ink : pap, BLK.x + (Rn() - 0.5) * 1.6 * U, Rn() * BLK.y1, (0.3 + Rn() * 0.35) * U);   // 直边略毛
  x.fillStyle = 'rgba(74,76,86,0.5)'; x.fill(lite); x.fillStyle = 'rgba(0,0,3,0.55)'; x.fill(dark); x.fillStyle = INK; x.fill(ink); x.fillStyle = PAPER; x.fill(pap);
}
const blkY = k => -(1 - k) * (BLK.y1 + 70 * U);   // 黑块从上边框垂下来
function drawBlock(g, k) { if (k < 0.01) return; const dy = blkY(k);
  if (EC <= 0) { g.drawImage(blockCv, BB.x, BB.y + dy, BB.w, BB.h); if (bcv) g.drawImage(bcv, BB.x, BB.y + dy, BB.w, BB.h); return; }
  if (MP >= 1) return; g.drawImage(blockCv, BB.x, BB.y, BB.w, BB.h);   // 形变里黑块不退：墨从井底漫开把它吞进去，窗棂先淡掉
  const a = 1 - sstep(0.08, 0.5, MP); if (bcv && a > 0.01) { g.globalAlpha = a; g.drawImage(bcv, BB.x, BB.y, BB.w, BB.h); g.globalAlpha = 1; } }

/* ---------- 月亮（瞳孔）：蓝色实心，左上被纸白颗粒由密到疏咬进去，灰蓝一弯边；一部分压在黑上、一部分在纸上 ---------- */
const NG = 3800;
let EGU = null, EGV = null, EGS = null, EGM = null;
function buildDisc() {
  const Rn = rng(4242), sd = -2.25, cd = Math.cos(sd), sn = Math.sin(sd); EGU = new Float32Array(NG); EGV = new Float32Array(NG); EGS = new Float32Array(NG); EGM = new Float32Array(NG);
  let i = 0; for (let guard = 0; i < NG && guard < 600000; guard++) { const a = Rn() * TAU, q = Math.sqrt(Rn()), u = Math.cos(a) * q, v = Math.sin(a) * q, t = u * cd + v * sn, pr = Math.pow(sstep(-0.3, 1.0, t), 2.3) * (0.35 + 0.65 * q * q) * 1.15, m = pr - Rn();
    if (m < -0.07 || q < 0.33) continue; EGU[i] = u; EGV[i] = v; EGS[i] = 0.4 + Rn() * 0.5; EGM[i] = m; i++; }
  for (; i < NG; i++) EGM[i] = -1;
}
function drawMoon(g, r, k, T) {   // k：黑块露出多少（月亮压在黑上的那截描一圈细边托出来）
  if (r < 0.4) return; const q = r / R;
  g.fillStyle = RIM; g.beginPath(); g.arc(C.x - 0.055 * r, C.y + 0.047 * r, r, 0, TAU); g.fill();
  g.fillStyle = BLUE; g.beginPath(); g.arc(C.x, C.y, r, 0, TAU); g.fill();
  const lo = STILL ? 0 : 0.045 * Math.sin(T * 0.45); g.fillStyle = PAPER; g.beginPath(); for (let i = 0; i < NG; i++) if (EGM[i] > lo) dot(g, C.x + EGU[i] * r, C.y + EGV[i] * r, EGS[i] * U * Math.min(1, q * 1.4)); g.fill();
  if (k > 0.01) { g.save(); blackClip(g, k); g.strokeStyle = PAPER; g.globalAlpha = 0.8; g.lineWidth = 0.7; g.beginPath(); g.arc(C.x, C.y, r + 0.4, 0, TAU); g.stroke(); g.restore(); }
}
function pupil(g, pm) { if (pm < 0.01) return; g.fillStyle = PAPER; g.beginPath(); g.arc(C.x, C.y, 0.235 * R * pm, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(C.x, C.y, 0.105 * R * pm, 0, TAU); g.fill(); }

/* ---------- 眼：十七只燕子首尾相接围成眼眶，横着压过月亮；压在月亮和黑块上的部分纸白，纸上的部分蓝 ---------- */
const EP = { A: 640, HU: 262, HL: 176, TILT: -7 * RAD };
let EK = 1, ECX = 0, ECY = 0, RING = [], ODD = -1, BIG = null, FL = [];
const lidQ = x => Math.max(0, 1 - (x / EP.A) * (x / EP.A));
const toW = (x, y) => [ECX + (x * Math.cos(EP.TILT) - y * Math.sin(EP.TILT)) * EK, ECY + (x * Math.sin(EP.TILT) + y * Math.cos(EP.TILT)) * EK];
const hUp = o => EP.HL * (1 - o) - EP.HU * o;
function almond(g, o) { const n = 48, h = hUp(o);   // 眼眶里露得出来的那一块（只加路径）
  for (let i = 0; i <= n; i++) { const x = -EP.A + 2 * EP.A * i / n, w = toW(x, h * lidQ(x)); i ? g.lineTo(w[0], w[1]) : g.moveTo(w[0], w[1]); }
  for (let i = n; i >= 0; i--) { const x = -EP.A + 2 * EP.A * i / n, w = toW(x, EP.HL * lidQ(x)); g.lineTo(w[0], w[1]); }
  g.closePath(); }
function buildEye() {
  EK = 0.3575 * W / EP.A; const ct = Math.cos(EP.TILT), st = Math.sin(EP.TILT), A = EP.A; ECX = C.x - (92 * ct + 8 * st) * EK; ECY = C.y - (92 * st - 8 * ct) * EK; RING = [];
  const lidLine = up => { const N = 600, pts = []; for (let i = 0; i <= N; i++) { const x = (up ? -1 : 1) * A * (1 - 2 * i / N); pts.push([x, up ? -EP.HU * lidQ(x) : EP.HL * lidQ(x)]); }
    const L = [0]; for (let i = 1; i <= N; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { len: L[N], at(s) { let i = 1; while (i < N && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1), a = pts[i - 1], b = pts[i]; return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } }; };
  const walk = up => { const ln = lidLine(up), smax = up ? 1.62 : 1.26, SMIN = 0.40, GAP = 1.12, LEN = 150, sz = u => SMIN + (smax - SMIN) * Math.pow(Math.sin(PI * clamp(u, 0, 1)), 0.85); let s = sz(0) * LEN * 0.5, guard = 0;
    while (s < ln.len - SMIN * LEN * 0.35 && guard++ < 60) { const u = s / ln.len, k = sz(u), p = ln.at(s), w = toW(p.x, p.y);
      RING.push({ x: w[0], y: w[1], hd: p.ang + EP.TILT, sc: k * EK, syy: 1, ph: up ? 0.90 + 0.22 * u : 0.66 + 0.12 * u, path: null, halo: 1, al: 1, up });
      const kn = sz((s + k * LEN * GAP) / ln.len); s += (k + kn) / 2 * LEN * GAP; } };
  walk(true); walk(false);
  if (RING[1]) { RING[1].hd += PI; RING[1].syy = -1; RING[1].grey = 1; }   // 特异的那只：灰，朝外
  let bi = 0; RING.forEach((b, i) => { if (b.up && !b.grey && b.sc > RING[bi].sc) bi = i; }); RING.unshift(RING.splice(bi, 1)[0]);
  BIG = RING[0]; ODD = RING.findIndex(b => b.grey);   // 领头那只（泪线上吊过的）落在上睑最大的位置
  const Rn = rng(515), n = RING.length, ord = []; for (let i = 1; i < n; i++) ord.push(i);
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(Rn() * (i + 1)), t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
  FL = new Array(n); let t = T_BRK;   // 鸟群从左、左下、上方画框外陆续进来，一只接一只落位，先慢后快
  ord.forEach((b, k) => { const side = k % 3, st2 = side === 0 ? [-50 * U, H * (0.2 + 0.5 * Rn())] : side === 1 ? [W * (0.05 + 0.5 * Rn()), H * 0.75 + 50 * U] : [W * (0.05 + 0.55 * Rn()), -50 * U];
    FL[b] = { td: t, dur: 0.85 + Rn() * 0.2, x: st2[0], y: st2[1], p3: Rn() }; t += lerp(0.1, 0.04, k / Math.max(1, ord.length - 1)); });
}
const wrapA = a => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
function ringT(i, t) {
  const d = FL[i], s = RING[i], u = (t - d.td) / d.dur; if (u <= 0) return null; if (u >= 1) return s;
  const h0 = Math.atan2(C.y - d.y, C.x - d.x), q = Math.hypot(s.x - d.x, s.y - d.y) * 0.42, c1x = d.x + Math.cos(h0) * q, c1y = d.y + Math.sin(h0) * q, c2x = s.x - Math.cos(s.hd) * q * 0.6, c2y = s.y - Math.sin(s.hd) * q * 0.6;
  const pos = uu => { const e = smoother(uu), m = 1 - e; return [m * m * m * d.x + 3 * m * m * e * c1x + 3 * m * e * e * c2x + e * e * e * s.x, m * m * m * d.y + 3 * m * m * e * c1y + 3 * m * e * e * c2y + e * e * e * s.y]; };
  const p = pos(u), pa = pos(Math.max(0, u - 0.006)), pb = pos(Math.min(1, u + 0.006)); let hd = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]); hd += wrapA(s.hd - hd) * sstep(0.82, 1, u);
  let syy = lerp(clamp(Math.cos(hd) * 5, -1, 1), s.syy, sstep(0.5, 1, u)); if (Math.abs(syy) < 0.08) syy = syy < 0 ? -0.08 : 0.08;
  const run = d.p3 + (t - d.td) * 2.1, end = d.p3 + d.dur * 2.1, tgt = s.ph + Math.ceil(end - s.ph);
  return { x: p[0], y: p[1], hd, sc: lerp(s.sc * 0.55, s.sc, smoother(u)), syy, ph: lerp(run, tgt, sstep(0.5, 1, u)), path: null, halo: sstep(0.8, 1, u), al: 1, grey: s.grey };
}
/* 燕子：纸上是蓝；压在黑块上、压在月亮上的那截换成纸白（负片）。落了位的在周围留一圈擦过的细缝 */
function birdFill(g, p, col, solid) { if (p.col) col = p.col; const gc = p.grey && !solid ? GREY : col; if (p.dotr) { g.fillStyle = gc; g.beginPath(); g.arc(p.x, p.y, p.dotr, 0, TAU); g.fill(); return; } g.save(); birdTf(g, p); g.fillStyle = gc; g.fill(p.path || FB[fidx(p.ph)]); g.restore(); }   // solid：压在亮面上的那截不用浅灰，免得化进纸白里
function ringDraw(g, PL, S) {
  const pass = (fill, halo) => { for (const p of PL) { if (!p || p.al < 0.01) continue; g.globalAlpha = p.al;
    if (p.halo > 0.02 && !p.dotr) { const k = p.m ? Math.sqrt(Math.abs(p.m[0] * p.m[3] - p.m[1] * p.m[2])) || 1 : p.sc; if (k > 1e-4) { g.save(); birdTf(g, p); g.strokeStyle = halo; g.lineWidth = 3 * U * p.halo / k; g.lineJoin = 'round'; g.stroke(p.path || FB[fidx(p.ph)]); g.restore(); } }
    birdFill(g, p, fill); } g.globalAlpha = 1; };
  pass(BLUE, PAPER);
  if (S.blk > 0.01) { g.save(); blackClip(g, S.blk); pass(PAPER, INK); g.restore(); }
  if (LITN) { g.save(); g.clip(LITP); pass(BLUE, PAPER); g.restore(); }   // 黑里压在亮踏步上的那截再换回蓝
  if (S.r > 0.6) { g.save(); g.beginPath(); g.arc(C.x, C.y, S.r, 0, TAU); g.clip(); pass(PAPER, BLUE); g.restore(); }
}
function ribbon(g, pts) { const n = pts.length; g.beginPath();
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) { const i = pass ? n - 1 - k : k, a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, h = pts[i][2] / 2 * (pass ? -1 : 1), x = pts[i][0] + nx * h, y = pts[i][1] + ny * h; pass || k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill(); }
/* 合着的眼：一弯两头尖的睫毛线；睁开时上下分开、变细、没了 */
function lids(g, o, col) {
  const th = 12 * EK * (1 - o); if (th < 0.2) return; const n = 44; g.fillStyle = col;
  [EP.HL, hUp(o)].forEach((hh, k) => { if (k && o < 0.002) return; const pts = []; for (let i = 0; i <= n; i++) { const x = -EP.A + 2 * EP.A * i / n, q = lidQ(x), w = toW(x, hh * q); pts.push([w[0], w[1], th * Math.pow(q, 0.7)]); } ribbon(g, pts); });
}
const lidY = () => toW(92, EP.HL * lidQ(92))[1];

/* ---------- 几何线：入口轨道、斜轴（过圆心，120°，出了轨道变成虚线航迹）、点线弧、钉子、星轨，和外面几圈会被一起带动的轨道 ---------- */
const AX = 120 * RAD, AXC = Math.cos(AX), AXS = Math.sin(AX);
let TRL_ = [], ND = [], RDOT = 300, SB = [], TD = [], TSY = 0, TY0 = 0, HANG = 0, RG = [];
function buildGeo() {
  const Rn = rng(606); TRL_ = []; let r = R * 1.9;
  for (let i = 0; i < 4; i++) { const f = i / 3, deep = i === 1, segs = []; let a = Rn() * 8;
    while (a < 360) { const len = (2.5 + Rn() * Rn() * 20) * (1 - 0.3 * f), gap = 1.5 + Rn() * (3.5 + 11 * f); if (Rn() > 0.06 + 0.24 * f) segs.push([a, a + len, Rn() < 0.3]); a += len + gap; }
    TRL_.push({ r, w: deep ? 0.9 : 0.4 + Rn() * Rn() * 0.6 * (1 - 0.4 * f), deep, segs, a0: 208 + 4 * f + Rn() * 3, a1: 234 - 4 * f - Rn() * 3 }); r += R * (0.07 + Rn() * 0.06); }
  const sp = GEO.spire, pa = Math.atan2(sp[1] - C.y, sp[0] - C.x); RDOT = Math.hypot(sp[0] - C.x, sp[1] - C.y); GEO.d0 = pa - 17 * RAD; GEO.d1 = pa + 13 * RAD;   // 点线弧过塔尖
  ND = [[C.x + AXC * RR, C.y + AXS * RR, 0, 2.76], [C.x, C.y + RR, 0, 2.92], [C.x + Math.cos(165 * RAD) * RR, C.y + Math.sin(165 * RAD) * RR, 1, 1.95], [C.x, C.y + 46 * U, 0, 3.05], [sp[0], sp[1], 0, 5.1],
    [C.x + Math.cos(GEO.d0) * RDOT, C.y + Math.sin(GEO.d0) * RDOT, 1, 1.72], [C.x + Math.cos(GEO.d1) * RDOT, C.y + Math.sin(GEO.d1) * RDOT, 1, 2.3]];
  SB = [[RR + 100 * U, 13, E2, 0.08], [RR + 146 * U, 9, E1, -0.06]].map(s => ({ x: C.x + AXC * s[0], y: C.y + AXS * s[0], sc: s[1] / 190 * U, path: s[2], hd: AX + PI + s[3] }));
  HANG = Math.max(0.75 * H, C.y + R + 150 * U);
  const l0 = lidY(), sp2 = HANG - l0;   // 泪线上的墨点：线每顿一次留一颗
  TD = [[l0 + 0.30 * sp2, 2.1, 0], [l0 + 0.64 * sp2, 0.9, 0], [l0 + 0.585 * sp2, 1.6, 0], [l0 + 0.93 * sp2, 2.3, 0], [l0 + 0.79 * sp2, 0.8, -4.5], [l0 + 0.86 * sp2, 0.6, 3.2]]; TSY = l0 + 0.93 * sp2 + 5 * U; TY0 = C.y + 0.235 * R;
  const names = ['VII', '15', '0.6', 'III', '30', 'XII', '09', '45'];
  RG = [[62, 35, 172, 0, 0.6, 0.25, 14, 0.5], [88, 45, 185, 1, -0.35, -0.4, 9, 0.55], [120, 60, 195, 2, 1.6, 0.18, 6, 0.42], [158, 85, 150, 3, -0.8, -0.12, 4.5, 0.5]].map((q, j) => {
    const items = [], n = 7; for (let i = 0; i < n; i++) items.push({ a: i * 360 / n + Rn() * 24, t: (i + j) % 5, s: names[(i * 3 + j) % names.length] });
    return { r: RR + q[0] * U, a0: q[1], a1: q[2], kind: q[3], mul: q[4], drift: q[5], lam: q[6], al: q[7], cur: 0, items }; });
}
function drawTrails(g, k, T) {   // k：一条一条由内向外扫出来；常态整束极慢地转
  const rot = STILL ? 0 : T * 0.14, n = TRL_.length; g.lineCap = 'butt';
  TRL_.forEach((t, i) => { const kk = clamp(k * (n + 2) - i, 0, 1); if (kk <= 0) return; const lo = t.a0, hi = t.a0 + (t.a1 - t.a0) * kk;
    g.strokeStyle = t.deep ? BLUE : PEN; g.globalAlpha = t.deep ? 0.9 : 0.5; g.fillStyle = g.strokeStyle; g.lineWidth = t.w * (0.9 + 0.1 * U); g.beginPath();
    for (const s of t.segs) { const a = ((s[0] + rot * (1 - 0.3 * i / n)) % 360 + 360) % 360, b = a + (s[1] - s[0]), A = Math.max(a, lo), B = Math.min(b, hi); if (B - A < 0.3) continue;
      g.moveTo(C.x + Math.cos(A * RAD) * t.r, C.y + Math.sin(A * RAD) * t.r); g.arc(C.x, C.y, t.r, A * RAD, B * RAD);
      if (s[2] && B === b) for (let j = 1; j <= 4; j++) { const aa = (B + j * 0.5 + hash(i * 7 + j) * 0.3) * RAD, rr = t.r + (hash(i * 3 + j * 5) - 0.5) * 2.4; g.rect(C.x + Math.cos(aa) * rr - 0.45, C.y + Math.sin(aa) * rr - 0.45, 0.9, 0.9); } }
    g.stroke(); });
  g.globalAlpha = 1;
}
function geoLines(g, K) {
  g.strokeStyle = LINE; g.lineWidth = 0.5; g.lineCap = 'butt';
  if (K.rail > 0.002) { g.beginPath(); g.arc(C.x, C.y, RR, 165 * RAD, (165 - 125 * K.rail) * RAD, true); g.stroke(); }   // 只在眼眶下方露一段
  if (K.dot > 0.002) { g.fillStyle = LINE; g.beginPath(); const n = Math.round((GEO.d1 - GEO.d0) * RDOT / (4.6 * U)); for (let i = 1; i < n * K.dot; i++) { const a = lerp(GEO.d0, GEO.d1, i / n); dot(g, C.x + Math.cos(a) * RDOT, C.y + Math.sin(a) * RDOT, 0.55 * U); } g.fill(); }
}
function slanted(g, K, col) { if (!K.line) return; const ox = AXC * K.lo, oy = AXS * K.lo, t = (W + 6 - C.x) / -AXC; g.strokeStyle = col; g.lineWidth = 0.6 * U; g.globalAlpha = K.la === undefined ? 1 : K.la; g.beginPath(); const r0 = K.r0 === undefined ? RR : K.r0; g.moveTo(C.x + AXC * r0 + ox, C.y + AXS * r0 + oy); g.lineTo(C.x - AXC * t + ox, C.y - AXS * t + oy); g.stroke(); g.globalAlpha = 1; }
function nodes(g, K, col) { g.fillStyle = col; g.beginPath(); ND.forEach((n, i) => { const s = (K.nd ? K.nd[i] : 1); if (s < 0.03) return; if (n[2]) { const r = 1.5 * U * s; g.moveTo(n[0] + r, n[1]); g.arc(n[0], n[1], r, 0, TAU); } else { const h = 1.8 * U * s; g.rect(n[0] - h, n[1] - h, h * 2, h * 2); } }); g.fill(); }
/* 泪线：一根铅垂线，线每顿一次留一颗墨点，一处拖痕，末端两三个离线的小点 */
function tear(g, S, col, lc) {   // S.tk：主页里线是整根绷着的，墨点跟着线长按比例挪；衔接动画里线一截截放下去，墨点原地冒出来
  const tipY = S.tipY, y0 = S.y0; if (tipY <= y0 + 0.5) return; g.save(); if (S.sw) { g.translate(C.x, y0); g.rotate(S.sw); g.translate(-C.x, -y0); }
  g.strokeStyle = lc || col; g.fillStyle = col; g.lineWidth = 0.8 * U * (S.lwk || 1); g.lineCap = 'butt'; g.beginPath(); g.moveTo(C.x, y0); g.lineTo(C.x, tipY); g.stroke(); g.beginPath();
  if (S.tk) { const k = (tipY - y0) / (HANG - TY0), w = 1.2 * U, ys = y0 + (TSY - TY0) * k, sl = 18 * U * k;
    for (const d of TD) { const y = y0 + (d[0] - TY0) * k; if (y < y0 + 3 * U) continue; g.moveTo(C.x + d[2] * U + d[1] * U, y); g.arc(C.x + d[2] * U, y, d[1] * U, 0, TAU); }
    if (ys > y0) { g.moveTo(C.x - w, ys); g.lineTo(C.x + w, ys); g.lineTo(C.x + 0.3 * U, ys + sl); g.lineTo(C.x - 0.3 * U, ys + sl); g.closePath(); } }
  else { const pop = y => backOut(clamp((tipY - y) / (16 * U), 0, 1));
    for (const d of TD) { if (d[0] < y0) continue; const s = pop(d[0] + (d[2] ? 10 * U : 0)); if (s > 0.02) { g.moveTo(C.x + d[2] * U + d[1] * U * s, d[0]); g.arc(C.x + d[2] * U, d[0], d[1] * U * s, 0, TAU); } }
    const sl = clamp(tipY - TSY, 0, 18 * U); if (sl > 1 && TSY > y0) { const w = 1.2 * U; g.moveTo(C.x - w, TSY); g.lineTo(C.x + w, TSY); g.lineTo(C.x + 0.3 * U, TSY + sl); g.lineTo(C.x - 0.3 * U, TSY + sl); g.closePath(); } }
  g.fill();
  if (S.pd > 0.02) { const s = Math.min(S.pd, 1.15), hw = 3.3 * U * s, hh = 6 * U * s;   // 坠子：一颗小实心菱形，底下挂一只很小的燕子
    g.beginPath(); g.moveTo(C.x, tipY); g.lineTo(C.x + hw, tipY + hh); g.lineTo(C.x, tipY + 2 * hh); g.lineTo(C.x - hw, tipY + hh); g.closePath(); g.fill();
    bird(g, E2, C.x - 7 * U, tipY + 2 * hh + 8 * U, 12 / 190 * U * s, -0.5, lc || col); }
  g.restore();
}
/* 外面几圈轨道：各只露一段弧，线型不同，带几个小件。拖入口或拨转盘时各按自己的倍率被带着转，松手各自拖着尾巴停下；平时极慢地漂 */
const n360 = a => ((a % 360) + 360) % 360;
function stepRings(dt, rot) { for (const q of RG) { const tg = rot * q.mul; q.cur = STILL || dt <= 0 ? tg : q.cur + (tg - q.cur) * (1 - Math.exp(-dt * q.lam)); } }
function drawRings(g, a, T) {   // 第二态里整组退掉，只剩玫瑰窗最外那一圈当辅助弧
  a *= 1 - sstep(0, 0.6, EC); if (a < 0.01) return; g.lineCap = 'butt';
  const rp = (t, r) => [C.x + Math.cos(t) * r, C.y + Math.sin(t) * r];
  for (const q of RG) { const ph = q.cur + (STILL ? 0 : T * q.drift), r = q.r, a0 = q.a0, a1 = q.a1, al = a * q.al;
    g.globalAlpha = al; g.strokeStyle = LINE; g.fillStyle = LINE; g.lineWidth = 0.5;
    if (q.kind === 0 || q.kind === 3) { g.beginPath(); g.arc(C.x, C.y, r, a0 * RAD, a1 * RAD); g.stroke(); }
    if (q.kind === 1) { const sd = 5 * U / r / RAD; g.beginPath(); for (let k = Math.ceil((a0 - ph) / sd); ph + k * sd <= a1; k++) { const p = rp((ph + k * sd) * RAD, r); dot(g, p[0], p[1], 0.55 * U); } g.fill(); }
    if (q.kind === 2) { g.setLineDash([7 * U, 5 * U]); g.lineDashOffset = -ph * RAD * r; g.beginPath(); g.arc(C.x, C.y, r, a0 * RAD, a1 * RAD); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0; }
    if (q.kind === 3) { g.beginPath(); for (let k = Math.ceil((a0 - ph) / 3); ph + k * 3 <= a1; k++) { const t = (ph + k * 3) * RAD, l = (((k % 5) + 5) % 5 ? 3 : 7) * U, p = rp(t, r), p1 = rp(t, r - l); g.moveTo(p[0], p[1]); g.lineTo(p1[0], p1[1]); } g.stroke(); }
    for (const it of q.items) { const ang = n360(it.a + ph); if (ang < a0 || ang > a1) continue; const fdk = clamp(Math.min(ang - a0, a1 - ang) / 5, 0, 1), t = ang * RAD, p = rp(t, r), x = p[0], y = p[1]; g.globalAlpha = a * Math.min(1, q.al + 0.3) * fdk;
      if (it.t === 0) { g.beginPath(); g.arc(x, y, 1.7 * U, 0, TAU); g.fill(); }
      else if (it.t === 1) { g.fillStyle = PAPER; g.beginPath(); g.arc(x, y, 2.8 * U, 0, TAU); g.fill(); g.stroke(); g.fillStyle = LINE; }
      else if (it.t === 2) { g.beginPath(); g.arc(x, y, 3 * U, t - PI / 2, t + PI / 2); g.fill(); }
      else if (it.t === 3) { g.fillRect(x - 1.6 * U, y - 1.6 * U, 3.2 * U, 3.2 * U); }
      else { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(t) * 4 * U, y + Math.sin(t) * 4 * U); g.stroke(); txt(g, it.s, x + Math.cos(t) * 10 * U, y + Math.sin(t) * 10 * U + 2 * U, fe(6.2), LINE, 0.6, 'center'); } } }
  g.globalAlpha = 1;
}
function twoTone(g, S, fn) { fn(false); if (S.blk > 0.01) { g.save(); blackClip(g, S.blk); fn(true); g.restore(); } if (LITN) { g.save(); g.clip(LITP); fn(false); g.restore(); } if (S.r > 0.6) { g.save(); g.beginPath(); g.arc(C.x, C.y, S.r, 0, TAU); g.clip(); fn(true); g.restore(); } }   // 压在黑块和月亮上的那截换成纸白

/* ---------- 轨道上的入口：大小和月相只看它离焦点多远。焦点在斜轴和轨道的交点（圆心左下 120°），两侧各露两颗 ---------- */
const FS = 2, STEP = 18, angOf = se => 120 + (se - FS) * STEP;
let BD = [];
const ORBQ = Q.has('orb') ? (+Q.get('orb') || 0) / STEP : 0;
const rail = { off: FS - (SLOTQ || 0) + ORBQ, tgt: FS - (SLOTQ || 0) + ORBQ, v: 0, br: 0, drag: false, la: 0, lt: 0, moved: 0, t0: 0, hit: -1, sx: 0, sy: 0 };
function beads() {
  BD = ENTRY.map((e, j) => { const s = (((j + rail.off) % 5) + 5) % 5, se = s > 4.5 ? s - 5 : s, d1 = Math.abs(se - FS), rl0 = se - FS, rel = rl0 < -0.5 ? rl0 + 5 : rl0, d = lerp(d1, Math.abs(rel), EM);   // 转出一头的缩没，从另一头长出来
    const sc1 = se < 0 ? smoother((se + 0.5) / 0.5) : se > 4 ? 1 - smoother((se - 4) / 0.5) : 1, sc2 = rel < 0 ? smoother((rel + 0.5) / 0.5) : rel > 4 ? 1 - smoother((rel - 4) / 0.5) : 1, sc = lerp(sc1, sc2, EM), a1 = angOf(se) * RAD + rail.br;
    let x = C.x + Math.cos(a1) * RR, y = C.y + Math.sin(a1) * RR, r = 20 * U * (0.22 + 0.78 * Math.exp(-1.2 * d1)), bk = 0, ox = 0, oy = 0;
    if (EM > 0) { const kp = Math.max(KF + SPK * rel + rail.br * 3, KFR + 1.2 + 1.5 * (rel + 0.5)), q = SPW(kp, RLR, RLH), o = SPW(kp, ROUT + 0.34, -0.1), em = smoother((MP - 0.22) / 0.36);   // 蓝带还没长到的时候，月亮先落到带子正在长的那一头，跟着它一起滑到位   // 第二态：沿蓝带排开，焦点在最近最大的那一处，往井里按透视缩小；字放到这一级踏步外沿再往外的黑里
      ox = o[0]; oy = o[1]; x = lerp(x, q[0], em); y = lerp(y, q[1], em); r = lerp(r, clamp(0.095 * FL3 / q[2], 4 * U, 21 * U), em); bk = ribFront(kp) ? 0 : 1; }
    const ang = Math.atan2(y - C.y, x - C.x);
    return { x, y, ang, bk, ox, oy, se, r, k: lerp(1, 0.07, Math.pow(clamp(d / 2.2, 0, 1), 0.8)), m: se < FS ? 1 : -1, sc, c: clamp(1 - d, 0, 1), s, d, e, j, rank: 0 }; });
  BD.slice().sort((a, b) => a.d - b.d).forEach((b, i) => { b.rank = i; });
  BD.forEach(b => { const q = b.r * b.sc + (14 + 9 * b.c) * U;   // 字：第一态沿径向放在轨道外侧；第二态放到踏步外
    b.lx = clamp(lerp(b.x + Math.cos(b.ang) * q, b.ox, EM), lerp(24, 32, EM) * U, W - lerp(20, 30, EM) * U); b.ly = lerp(b.y + Math.sin(b.ang) * q + 6 * U, clamp(b.oy, 40 * U, H - 60 * U), EM);
    if (EM > 0) { let dx = b.lx - b.x, dy = b.ly + 4 * U - b.y, dl = Math.hypot(dx, dy); const mn = b.r * b.sc + (17 + 8 * b.c) * U; if (dl < 1) { dx = Math.cos(b.ang); dy = Math.sin(b.ang); dl = 1; } if (dl < mn) { b.lx += dx / dl * (mn - dl) * EM; b.ly += dy / dl * (mn - dl) * EM; } }
    const hw = 30 * UF, dxl = b.lx - C.x; if (EM > 0 && Math.abs(dxl) < hw && b.ly > C.y) b.lx += ((dxl < 0 ? -hw : hw) - dxl) * EM;   // 让开泪线
    if (EM > 0.5 && LQ.length) { const o = freeSpot(b); b.lx += o[0] * EM; b.ly += o[1] * EM; } });   // 第二态的字别压在亮踏步上
  return BD;
}
function inQ(x, y, p) { let s = 0; for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) & 3], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c === 0) continue; const sg = c > 0 ? 1 : -1; if (s && sg !== s) return false; s = sg; } return true; }
function labelHits(b, x, y) { const fs = lerp(10.5, 16, b.c) * UF, x0 = x - fs * 1.5, x1 = x + fs * 1.5, y0 = y - fs * 0.85, y1 = y + fs * 0.2 + lerp(10.5, 14, b.c) * UF;
  if (x0 < 8 * U || x1 > W - 8 * U || Math.abs(x - C.x) < 26 * UF + fs) return true;
  for (const q of LQ) { if (q.x1 < x0 || q.x0 > x1 || q.y1 < y0 || q.y0 > y1) continue; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) if (inQ(lerp(x0, x1, i / 4), lerp(y0, y1, j / 2), q.p)) return true; }
  return false; }
function freeSpot(b) { if (!labelHits(b, b.lx, b.ly)) return [0, 0]; for (let r = 4 * U; r < 120 * U; r += 4 * U) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, dx = Math.cos(a) * r, dy = Math.sin(a) * r; if (Math.hypot(b.lx + dx - b.x, b.ly + dy - b.y) > 90 * U) continue; if (!labelHits(b, b.lx + dx, b.ly + dy)) return [dx, dy]; } return [0, 0]; }   // 由近到远找一块黑地
function kNear(x, y) { let bk = KF, bd = 1e9; for (let kw = KF - 0.5 * SPK - 1; kw <= KF + 4.5 * SPK + 1; kw += 0.25) { const q = SPW(kw, RLR, RLH), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bk = kw; } } return [bk, bd]; }   // 手指落在蓝带的哪一处
const slotTh = rel => rel >= 0 ? 66 * rel : rel > -1 ? 62 * rel : -62 + 88 * (rel + 1);   // 带子上各格的角：右下那一侧跨过拧转处，不让月亮盖住它
const railDelta = s => { let dlt = FS - s; if (dlt > 2.5) dlt -= 5; if (dlt < -2.5) dlt += 5; return dlt; };
function litPath(g, r, k) { g.beginPath(); if (k >= 0.995) { g.arc(0, 0, r, 0, TAU); return; } g.arc(0, 0, r, -PI / 2, PI / 2); g.ellipse(0, 0, Math.max(0.001, r * Math.abs(1 - 2 * k)), r, 0, PI / 2, PI * 1.5, k < 0.5); g.closePath(); }
const NM = 3000, N = NM, F = () => new Float32Array(N);
const PX = F(), PY = F(), VX = F(), VY = F(), RX = F(), RY = F(), SZ = F(), GU = F(), GV = F(), GT = F(), GS = F();
const ST = new Uint8Array(N), MI = new Uint8Array(N);
let awake = 0;
function syncRail() {
  beads();
  for (let i = 0; i < NM; i++) {   // 月相暗面的颗粒跟着月相走：候选点固定，过了明暗线、够得上疏密的才亮
    const b = BD[MI[i]], u = GU[i], v = GV[i], hw = Math.sqrt(1 - v * v), xt = -(2 * b.k - 1) * hw; let vis = b.k < 0.985 && u <= xt && b.sc > 0.02;
    if (vis) { const dd = (xt - u) / (xt + hw + 1e-6), pr = Math.pow(1 - dd, 1.9) * 0.85 + 0.25 * Math.pow(u * u + v * v, 7); vis = pr > GT[i]; }
    const r = b.r * b.sc, ro = b.ang - PI / 2, ct = Math.cos(ro), st = Math.sin(ro), uu = u * b.m;
    RX[i] = b.x + (uu * ct - v * st) * r; RY[i] = b.y + (uu * st + v * ct) * r; SZ[i] = vis ? GS[i] * U * clamp(b.r / (17 * U), 0.7, 1.2) * Math.min(1, b.sc * 1.5) : 0;
    if (ST[i] === 2) { PX[i] = RX[i]; PY[i] = RY[i]; }
  }
  for (let j = 0; j < navEl.children.length; j++) { const a = navEl.children[j], b = BD[j], h = Math.max(48, b.r * 2 + 12); a.style.left = (b.x - h / 2) + 'px'; a.style.top = (b.y - h / 2) + 'px'; a.style.width = h + 'px'; a.style.height = h + 'px'; }
}
function drawRail(g, S) {   // S.bov：衔接时每颗的位置和大小；S.txa：标签的显隐
  const ta = S.txa === undefined ? 1 : S.txa;
  BD.forEach(b => { const o = S.bov ? S.bov[b.j] : null, k = (o ? o.sc : 1) * b.sc; if (k <= 0.01) return;
    if (EM > 0.01) { g.globalAlpha = EM; g.fillStyle = PAPER; g.beginPath(); g.arc(b.x, b.y, b.r * k + 1.7 * U, 0, TAU); g.fill();   // 压在带子上：垫一圈纸白；转到背面的再描一道蓝圈
      if (b.bk > 0.02) { g.globalAlpha = EM * b.bk; g.strokeStyle = BLUE; g.lineWidth = 0.9; g.beginPath(); g.arc(b.x, b.y, b.r * k + 1.2 * U, 0, TAU); g.stroke(); } g.globalAlpha = 1; }
    g.save(); g.translate(o ? o.x : b.x, o ? o.y : b.y); g.rotate((o ? o.ang : b.ang) - PI / 2); g.scale(b.m, 1); g.fillStyle = BLUE; litPath(g, b.r * k, b.k); g.fill(); g.restore(); });
  HALO = true; /* 形变途中只留焦点的字 */ const hm = MP <= 0 ? 1 : MP < 0.8 ? 1 - sstep(0, 0.06, MP) : sstep(0.8, 0.95, MP); if (ta > 0.01) BD.forEach(b => { const al = ta * b.sc * lerp(0.88, 1, b.c) * (1 - (1 - b.c) * 0.8 * Math.sin(PI * EM)) * lerp(hm, 1, sstep(0.5, 0.9, b.c)); if (al < 0.02) return; const fs = lerp(10.5, 16, b.c) * UF; const dk = FLK >= 1 || (FLK > 0 && Math.hypot(b.lx - C.x, b.ly - C.y) < FLR * 0.93);   // 落在黑里的字换成纸白，垫的那一小块也换成墨黑（压在亮踏步上时像一张小签）
    g.globalAlpha = al * 0.88 * (2 * EM - 1) * (2 * EM - 1); if (!dk) { g.fillStyle = PAPER; g.fillRect(b.lx - fs * 1.45, b.ly - fs * 0.82, fs * 2.9, fs * 0.95 + lerp(10.5, 14, b.c) * UF + 3 * U); } g.globalAlpha = al; HALOC = dk ? INK : PAPER;
    const foc = b.c > 0.5, col = dk ? PAPER : foc ? BLUE : LINE, bw = f => foc ? f.replace('300 ', '400 ') : f; txt(g, b.e.en, b.lx, b.ly, bw(fe(lerp(10.5, 16.5, b.c), 1)), col, 0, 'center'); txt(g, b.e.zh, b.lx + 1.5, b.ly + lerp(10.5, 14, b.c) * UF, bw(fz(lerp(7, 9.2, b.c))), col, 2.8 * UF, 'center'); });
  HALO = false; HALOC = PAPER; g.globalAlpha = 1;
}
function railHit(x, y) {
  let best = -1, bd = 1e9; BD.forEach(b => { if (b.sc < 0.3) return; const dd = Math.hypot(x - b.x, y - b.y), inLabel = Math.abs(x - b.lx) < 24 * UF && Math.abs(y - b.ly - 4 * U) < 16 * U; if ((dd < Math.max(24 * U, b.r + 12 * U) || inLabel) && dd < bd) { bd = dd; best = b.j; } });
  if (best >= 0) return best;
  if (EM > 0.5) return kNear(x, y)[1] < 26 * U ? -2 : -1;
  const dx = x - C.x, dy = y - C.y, a = Math.atan2(dy, dx) / RAD; return Math.abs(Math.hypot(dx, dy) - RR) < 34 * U && a > 42 && a < 168 ? -2 : -1;
}
const railAng = (x, y) => EM > 0.5 ? kNear(x, y)[0] * STEP2 / SPK : Math.atan2(y - C.y, x - C.x) / RAD;
function railDown(x, y, now) { rail.drag = true; rail.la = railAng(x, y); rail.sx = x; rail.sy = y; rail.lt = now; rail.t0 = now; rail.moved = 0; rail.v = 0; }
function railMove(x, y, now) { let a = railAng(x, y), da = a - rail.la; if (da > 180) da -= 360; if (da < -180) da += 360; const dd = da / (EM > 0.5 ? STEP2 : STEP), dt = Math.max(0.004, now - rail.lt);
  rail.moved = Math.max(rail.moved, Math.hypot(x - rail.sx, y - rail.sy)); rail.off += dd; rail.v = lerp(rail.v, dd / dt, 0.45); rail.la = a; rail.lt = now; syncRail(); }
function railUp(x, y, now, ok) {
  rail.drag = false; if (now - rail.lt > 0.09) rail.v = 0;
  if (ok && rail.moved < 9 * U && now - rail.t0 < 0.45) { rail.v = 0; rail.tgt = Math.round(rail.off); if (rail.hit >= 0) navEl.children[rail.hit].click(); return; }
  rail.v = clamp(rail.v, -14, 14); rail.tgt = Math.round(rail.off + rail.v * 0.16);
}
function stepRail(dt) { if (rail.drag || (rail.off === rail.tgt && rail.v === 0)) return;
  rail.v += (-150 * (rail.off - rail.tgt) - 20 * rail.v) * dt; rail.off += rail.v * dt;
  if (Math.abs(rail.off - rail.tgt) < 0.002 && Math.abs(rail.v) < 0.03) { rail.off = rail.tgt; rail.v = 0; } }
const railBusy = () => rail.drag || rail.off !== rail.tgt || rail.v !== 0;
function initParticles() { const Rn = rng(777); for (let i = 0; i < NM; i++) { const a = Rn() * TAU, q = Math.sqrt(Rn()) * 0.985; MI[i] = i % 5; GU[i] = Math.cos(a) * q; GV[i] = Math.sin(a) * q; GT[i] = Rn() * 0.62; GS[i] = 0.3 + Rn() * 0.34; } restAll(); }
function restAll() { syncRail(); for (let i = 0; i < N; i++) { ST[i] = 2; PX[i] = RX[i]; PY[i] = RY[i]; VX[i] = VY[i] = 0; } awake = 0; }
const ptr = { x: -999, y: -999, on: false, last: -9, down: false };
function step(dt) {   // 手指划过会把月面的颗粒拨开
  const RC = 54 * U, R2 = RC * RC, pOn = ptr.on && mode === 'home' && !dial.open && !rail.drag; let n = 0;
  for (let i = 0; i < N; i++) {
    if (ST[i] === 2) { if (!pOn) continue; const dx = PX[i] - ptr.x, dy = PY[i] - ptr.y; if (dx * dx + dy * dy > R2) continue; ST[i] = 1; }
    n++; const x = PX[i], y = PY[i]; let ax = (RX[i] - x) * 15, ay = (RY[i] - y) * 15;
    if (pOn) { const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy; if (d2 < R2 && d2 > 0.01) { const dd = Math.sqrt(d2), f = (1 - dd / RC) * 4200 * U; ax += dx / dd * f; ay += dy / dd * f; } }
    const dm = Math.exp(-dt * 7);
    VX[i] = (VX[i] + ax * dt) * dm; VY[i] = (VY[i] + ay * dt) * dm; PX[i] = x + VX[i] * dt; PY[i] = y + VY[i] * dt;
    if (Math.abs(RX[i] - PX[i]) + Math.abs(RY[i] - PY[i]) < 0.3 && Math.abs(VX[i]) + Math.abs(VY[i]) < 3 && !(pOn && (PX[i] - ptr.x) ** 2 + (PY[i] - ptr.y) ** 2 < R2)) { ST[i] = 2; PX[i] = RX[i]; PY[i] = RY[i]; VX[i] = VY[i] = 0; n--; }
  }
  awake = n;
}
function drawParticles(g) { g.fillStyle = BLUE; g.beginPath(); for (let i = 0; i < N; i++) dot(g, PX[i], PY[i], SZ[i]); g.fill(); }

/* ---------- 第二态：把泪线往下拉，眼睛拆开，底色从纸白翻成墨黑，一座真三维的旋转楼梯往井底拧下去，扶手是一条每圈拧半周的蓝带，入口和燕子都在带子上。全部按进度 MP（0..1）连续插值 ---------- */
const MORPHQ = Q.has('morph') ? clamp(+Q.get('morph') || 0, 0, 1) : null;
const mor = { p: MORPHQ || 0, v: 0, base: MORPHQ !== null && MORPHQ >= 0.5 ? 1 : 0, tgt: 0 }; mor.tgt = STILL ? mor.p : mor.base;
/* 主页两面 = 祂的浅/深。停在哪面记进 ta_side，各页开门照它；主页开门也先露那一面 */
const setSide = d => { try { localStorage.setItem('ta_side', d ? 'night' : 'day'); } catch (e) {} };
if (MORPHQ === null) { try { if (localStorage.getItem('ta_side') === 'night') { mor.p = 1; mor.base = 1; mor.tgt = 1; } } catch (e) {} }
const pull = { drag: false, sy: 0, sx: 0, ext: 0, v: 0, dx: 0 };
let MP = 0, EC = 0, EM = 0, GK = 0, WK = 0, LK = 0, SK = 0, C0x = 0, MX = 0, Rm = 80, BW = 24, sE = 0.64, cE = 0.77, sR = 0, cR = 1, rollA = 0, blueSign = 1, PULLD = 100, Rs = 60, DOFF = 16, PH = 0, FLK = 0, FLR = 0, RMAX = 900, RDX = 0, RDY = 0;
const RC = { x: 0, y: 0 };   // 环心。形变时从瞳孔边上沿斜轴滑到井的左下，洞不套在井上
const THF = PI / 2, TS = -170 * RAD, mE = 40 * RAD, mRho = 28 * RAD, A0 = mE + PI / 2 + 25 * RAD, OMG = 0.11, STEP2 = 66, TWK = 0.09;
const QS = 0.56, SMAXS = 5.25 * TAU, DSS = 16 * RAD, GAPS = 0.3, VT = 0.55, AS0 = 100 * RAD, LAMS = 20 * RAD, TWSS = 0.35, KB = 0.8, OM = 0.55, NLZ = 6.5, E1X = Math.cos(AX - PI / 2), E1Y = Math.sin(AX - PI / 2);
function setPose(T, still) { const wb = still ? 0 : 1, e = mE + wb * 2.2 * RAD * Math.sin(T * 0.23); rollA = mRho + wb * 1.6 * RAD * Math.sin(T * 0.17 + 1); sE = Math.sin(e); cE = Math.cos(e); sR = Math.sin(rollA); cR = Math.cos(rollA); RC.x = C.x + lerp(-DOFF * sR, RDX, EM); RC.y = C.y + lerp(DOFF * cR, RDY, EM); }
const ringXY = (th, rad) => { const X = rad * Math.cos(th), sy = rad * Math.sin(th) * sE; return [RC.x + X * cR - sy * sR, RC.y + X * sR + sy * cR]; };
/* 墨黑：从井底往外漫开铺满全屏，边缘是颗粒化开的湿边。第一态右上的黑块是它的起点 */
const FLT = new Float32Array(128), NFG = 3600, FGA = new Float32Array(NFG), FGD = new Float32Array(NFG), FGZ = new Float32Array(NFG);
{ const Rn = rng(5151); for (let i = 0; i < NFG; i++) { FGA[i] = Rn() * TAU; FGD[i] = -Math.log(1 - 0.97 * Rn()) * 0.3 * (i % 3 ? 1 : -0.6); FGZ[i] = 0.35 + Rn() * 0.75; } }
function floodPath(g) { for (let i = 0; i < 128; i++) { const th = i / 128 * TAU, x = C.x + Math.cos(th) * FLT[i], y = C.y + Math.sin(th) * FLT[i]; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
let darkCv = null;
function darkBase() {   // 黑纸：墨黑上深深浅浅的细颗粒
  if (darkCv) return darkCv; const Rn = rng(8181); let x; [darkCv, x] = mkCanvas(); x.fillStyle = INK; x.fillRect(0, 0, W, H);
  const lite = new Path2D(), dark = new Path2D(), pap = new Path2D(), n = Math.round(W * H / 5);
  for (let k = 0; k < n; k++) { const px = Rn() * W, py = Rn() * H, nz = vnoise(px / (60 * U) + 7, py / (60 * U) + 3) * 0.7 + vnoise(px / (22 * U) + 1, py / (22 * U) + 5) * 0.3, r = Rn();
    if (nz > 0.56 && r < (nz - 0.56) * 3.2) { const s = (0.35 + Rn() * 0.4) * U; lite.rect(px - s, py - s, s * 2, s * 2); } else if (nz < 0.42 && r < (0.42 - nz) * 3) { const s = (0.4 + Rn() * 0.5) * U; dark.rect(px - s, py - s, s * 2, s * 2); } else if (r > 0.9975) { const s = (0.3 + Rn() * 0.35) * U; pap.rect(px - s, py - s, s * 2, s * 2); } }
  x.fillStyle = 'rgba(74,76,86,0.5)'; x.fill(lite); x.fillStyle = 'rgba(0,0,3,0.55)'; x.fill(dark); x.globalAlpha = 0.55; x.fillStyle = PAPER; x.fill(pap); x.globalAlpha = 1; return darkCv;
}
function drawFlood(g) {
  if (FLK <= 0) return; if (FLK >= 1) { g.drawImage(darkBase(), 0, 0, W, H); return; }
  g.save(); g.beginPath(); floodPath(g); g.clip(); g.drawImage(darkBase(), 0, 0, W, H); g.restore();
  const bw = clamp(FLR * 0.28, 5 * U, 58 * U), pi = new Path2D(), pp = new Path2D();
  for (let i = 0; i < NFG; i++) { const th = FGA[i], r = FLT[Math.floor(th / TAU * 128) & 127] + FGD[i] * bw, x = C.x + Math.cos(th) * r, y = C.y + Math.sin(th) * r; if (x < -2 || x > W + 2 || y < -2 || y > H + 2) continue; const z = FGZ[i] * U; (FGD[i] > 0 ? pi : pp).rect(x - z, y - z, z * 2, z * 2); }
  g.fillStyle = INK; g.fill(pi); g.fillStyle = PAPER; g.fill(pp);
}
function dual(g, fn) { if (FLK <= 0) fn(false); else if (FLK >= 1) fn(true); else { fn(false); g.save(); g.beginPath(); floodPath(g); g.clip(); fn(true); g.restore(); } }   // 落在黑里的那截换成浅色再画一遍
function blkClip(g, k) { g.beginPath(); g.rect(BLK.x, -4, W + 4 - BLK.x, Math.max(0, BLK.y1 + (EC <= 0 ? blkY(k) : 0) + 4)); g.clip(); }
function blackClip(g, k) { g.beginPath(); g.rect(BLK.x, -4, W + 4 - BLK.x, Math.max(0, BLK.y1 + (EC <= 0 ? blkY(k) : 0) + 4)); if (FLK > 0) floodPath(g); g.clip(); }   // 黑：右上的方块，加上漫开的那一片
const poly = (g, p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); };
/* 楼梯：真三维再投影。一圈 NPT 级、每级降一个踢高的圆井楼梯（内沿 RIN 是敞开的井，外沿 ROUT），相机在井口上方偏一侧斜着往下看，广角。
   几何定在楼梯自己的坐标里不动（第 j 级：角 j·DT3 起，踏面高 -j·RISE）；往井里流 = 相机绕井轴反着拧（转角加抬升），每帧只重算相机再投影。
   井底那一点平移到瞳孔圆心 C。明暗：太阳定在楼梯坐标里，踏面被上面的圈和踢面挡住的落进黑里；画家算法由远到近，近的盖远的。
   扶手是井侧的一条蓝带，每圈拧半周：正面蓝，翻过来是纸白加蓝描边 */
const NPT = 22, NST = 110, DT3 = TAU / NPT, RISE = 0.16, RIN = 1.5, ROUT = 2.5, SLB = 0.05, RLH = 0.9, RLR = RIN + 0.04, RBW = 0.13, KF = 2.2, SPK = 5, RK0 = 0.9, LIT0 = 10 * RAD, ZB = -(NST + 2) * RISE, NLZ3 = 0.45, KW0 = -0.3;
const CE = [1.2, -0.2, 1.62], CFW = [-0.1658, 0.0276, -0.9858], CRT = [0.1644, 0.9864, 0], CUP = [-0.9724, 0.1621, 0.1681], SUN = [0.723, 0.506, 0.469];
const CAM = { e: [0, 0, 1], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] };
let FL3 = 258, OX3 = 0, OY3 = 0, PHC = 0, LQ = [], RQ = [], IT = [], JTOP = 1e9, KFR = 0, LITN = 0, LITP = null;
const LITM = new Map();
function P3(x, y, z) { const e = CAM.e, f = CAM.f, r = CAM.r, u = CAM.u, a = x - e[0], b = y - e[1], c = z - e[2], d = Math.max(0.12, a * f[0] + b * f[1] + c * f[2]), k = FL3 / d; return [OX3 - k * (a * r[0] + b * r[1] + c * r[2]), OY3 - k * (a * u[0] + b * u[1] + c * u[2]), d]; }   // 左右镜像：近处的踏步落在井的左下
const F3 = (th, r, z) => P3(r * Math.cos(th), r * Math.sin(th), z);
function setCam(ph) { PHC = ph; const a = -ph * DT3, c = Math.cos(a), s = Math.sin(a), rot = (v, o) => { o[0] = v[0] * c - v[1] * s; o[1] = v[0] * s + v[1] * c; o[2] = v[2]; };
  rot(CE, CAM.e); CAM.e[2] += ph * RISE; rot(CFW, CAM.f); rot(CRT, CAM.r); rot(CUP, CAM.u); OX3 = OY3 = 0; const o = P3(0, 0, ZB + ph * RISE); OX3 = C.x - o[0]; OY3 = C.y - o[1]; }
const SPW = (kw, rr, h) => { const kf = kw - PHC; return F3(kf * DT3, rr, -kf * RISE + h); };   // kw：从楼梯顶端数起第几级（可带小数）；h：离踏面多高
function hit3(x, y, z, dx, dy, dz, tmax) {   // 从一点朝一个方向走，会不会撞上哪一级的板
  const jb = JTOP + NST + 1;
  for (let t = 0.12; t < tmax; t += 0.13) { const px = x + dx * t, py = y + dy * t, pz = z + dz * t, r2 = px * px + py * py; if (r2 > ROUT * ROUT) { if (px * dx + py * dy > 0) return false; continue; } if (r2 < RIN * RIN) continue;
    let th = Math.atan2(py, px); if (th < 0) th += TAU; const u = Math.floor(th / DT3), i = u + Math.round((-pz / RISE - u) / NPT) * NPT; if (i < JTOP || i >= jb) continue; const zt = -i * RISE; if (pz <= zt + 0.001 && pz >= zt - RISE - SLB) return true; }
  return false; }
function litOf(j, sub) { const k = j * 3 + sub; let v = LITM.get(k); if (v === undefined) { const th = (j + 0.5) * DT3, r = RIN + (sub + 0.5) / 3 * (ROUT - RIN); v = Math.cos(th - LIT0 - 0.3 * j / NPT - 0.1 * sub) < -0.12 || hit3(r * Math.cos(th), r * Math.sin(th), -j * RISE + 0.012, SUN[0], SUN[1], SUN[2], 7) ? 0 : 1; LITM.set(k, v); } return v; }   // 背着光的那半口井整个沉在暗里（分界每往下一圈再拧一点），受光的半边再扣掉上面的圈投下来的影子
function visW(kw, rr, h) { const kf = kw - PHC, th = kf * DT3, x = rr * Math.cos(th), y = rr * Math.sin(th), z = -kf * RISE + h, dx = CAM.e[0] - x, dy = CAM.e[1] - y, dz = CAM.e[2] - z, l = Math.hypot(dx, dy, dz) || 1; return !hit3(x, y, z, dx / l, dy / l, dz / l, l - 0.15); }
function ribFront(kw) { const kf = kw - PHC, th = kf * DT3, c = Math.cos(th), s = Math.sin(th), psi = (kw - KF) * DT3 / 2 + PI / 2, cp = Math.cos(psi), sp = Math.sin(psi); return -cp * c * (CAM.e[0] - RLR * c) - cp * s * (CAM.e[1] - RLR * s) + sp * (CAM.e[2] + kf * RISE - RLH) > 0; }
function wellCompute(T) {   // 踏步和蓝带从井底一级级往近处长出来（每级像扇骨一样张开）；常态极慢地往井里流，拨入口和转盘时跟着走一点
  PH = (STILL ? 0.35 : T * 0.08) + ROT() * 0.02; setCam(PH); const jt = Math.ceil(KW0 - PH) - 1; if (jt !== JTOP) { JTOP = jt; LITM.clear(); }
  KFR = SK >= 1 ? -9 : NST * (1 - Math.pow(SK, 0.8)); IT = []; const ex = CAM.e[0], ey = CAM.e[1], ez = CAM.e[2];
  for (let j = jt; j + PH < NST; j++) { const kw = j + PH, a0 = Math.max(j, KW0 - PH) * DT3, a1 = Math.min(j + 1, NST - PH) * DT3; if (a1 - a0 < 0.004) continue;
    const ap = clamp((kw + 0.5 - KFR) / 4, 0, 1); if (ap <= 0) continue;
    const zt = -j * RISE, Lz = clamp(1 - ((a0 + a1) / 2 / DT3 + PH + 0.3) / NLZ3, 0, 1), am = (a0 + a1) / 2, cm = Math.cos(am), sm = Math.sin(am);
    if (Lz > 0) { if (Lz > 0.9) continue;   // 最近的那两三级：松开、缩小、往井里掉
      const shr = 1 - 0.72 * sstep(0.05, 0.9, Lz), rm = (RIN + ROUT) / 2, mx = rm * cm, my = rm * sm, z = zt - 1.2 * Lz * Lz, pt = (r, a) => P3(mx + (r * Math.cos(a) - mx) * shr, my + (r * Math.sin(a) - my) * shr, z), p = [pt(RIN, a0), pt(ROUT, a0), pt(ROUT, a1), pt(RIN, a1)];
      IT.push({ d: (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4, t: 7, p, al: ap * (1 - sstep(0.6, 0.9, Lz)), lit: litOf(j, 1) && Lz < 0.5 }); continue; }
    const ae = a0 + (a1 - a0) * (1 - (1 - ap) * (1 - ap)), c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(ae), s1 = Math.sin(ae);
    const A = P3(RIN * c0, RIN * s0, zt), B = P3(ROUT * c0, ROUT * s0, zt), Cq = P3(ROUT * c1, ROUT * s1, zt), D = P3(RIN * c1, RIN * s1, zt);
    if (cm * (ex - RIN * cm) + sm * (ey - RIN * sm) < 0) { const zb = zt - RISE - SLB, A2 = P3(RIN * c0, RIN * s0, zb), D2 = P3(RIN * c1, RIN * s1, zb); IT.push({ d: (A[2] + D[2] + A2[2] + D2[2]) / 4 + 0.02, t: 0, p: [A, D, D2, A2], al: ap }); }   // 朝井的侧面
    { const rm = (RIN + ROUT) / 2; if (-s1 * (ex - rm * c1) + c1 * (ey - rm * s1) > 0) { const z2 = zt - RISE, D2 = P3(RIN * c1, RIN * s1, z2), C2 = P3(ROUT * c1, ROUT * s1, z2); IT.push({ d: (D[2] + Cq[2] + D2[2] + C2[2]) / 4 + 0.01, t: 1, p: [D, Cq, C2, D2], al: ap, sun: -s1 * SUN[0] + c1 * SUN[1] > 0.2 }); } }   // 踢面
    const l0 = litOf(j, 0), l1 = litOf(j, 1), l2 = litOf(j, 2), dT = (A[2] + B[2] + Cq[2] + D[2]) / 4;
    if (l0 === l1 && l1 === l2) IT.push({ d: dT, t: l0 ? 2 : 3, p: [A, B, Cq, D], al: ap, id: j, big: FL3 / dT });
    else { IT.push({ d: dT + 0.002, t: 3, p: [A, B, Cq, D], al: ap }); const ls = [l0, l1, l2];   // 影子切过这一级：受光的那一截单独涂
      for (let q = 0; q < 3; q++) { if (!ls[q]) continue; let q1 = q; while (q1 < 2 && ls[q1 + 1]) q1++; const r0 = RIN + q / 3 * (ROUT - RIN), r1 = RIN + (q1 + 1) / 3 * (ROUT - RIN); IT.push({ d: dT, t: 2, p: [P3(r0 * c0, r0 * s0, zt), P3(r1 * c0, r1 * s0, zt), P3(r1 * c1, r1 * s1, zt), P3(r0 * c1, r0 * s1, zt)], al: ap, id: j, big: 0 }); q = q1; } }
    if (kw > 0.3 && ap >= 1) { const zr = zt - 0.5 * RISE + RLH - RBW * 0.4, pk = sstep(6.5, 9.5, kw), q0 = P3(RLR * cm, RLR * sm, lerp(zr - 0.11, zt, pk)), q1 = P3(RLR * cm, RLR * sm, zr); IT.push({ d: (q0[2] + q1[2]) / 2 - 0.01, t: 4, p: [q0, q1], al: 1 }); }   // 栏杆（离相机最近的七级只留扶手底下一小截，免得长线划过大踏步）
  }
  let pv = null;   // 蓝带
  for (let kw = Math.max(RK0, KFR - 2); kw <= NST + 0.01; kw += 0.5) { const kf = kw - PH, th = kf * DT3, c = Math.cos(th), s = Math.sin(th), z = -kf * RISE + RLH, psi = (kw - KF) * DT3 / 2 + PI / 2, cp = Math.cos(psi), sp = Math.sin(psi);
    const tw = RBW / 2 * clamp((kw - RK0) / 1.3, 0, 1) * clamp((kw - KFR + 2) / 3, 0, 1), cx = RLR * c, cy = RLR * s, ux = sp * c * tw, uy = sp * s * tw, uz = cp * tw;
    const cur = { a: P3(cx + ux, cy + uy, z + uz), b: P3(cx - ux, cy - uy, z - uz), f: -cp * c * (ex - cx) - cp * s * (ey - cy) + sp * (ez - z) > 0 };
    if (pv) IT.push({ d: (pv.a[2] + pv.b[2] + cur.a[2] + cur.b[2]) / 4 - 0.03, t: pv.f ? 5 : 6, p: [pv.a, cur.a, cur.b, pv.b], id: kw }); pv = cur; }
}
function sortWell() {   // 鸟也插进来一起排远近；再把垫在下面的亮面（受光踏面、蓝带背面）记一份，给栏杆和鸟换色用
  IT.sort((a, b) => b.d - a.d); { let n = 0; for (let i = IT.length - 1; i >= 0 && n < 2; i--) { const it = IT[i]; if ((it.t === 2 || (it.t === 7 && it.lit)) && (it.al === undefined || it.al > 0.6)) { it.grain = 1; n++; } } }   // 最近的两级亮踏面：外侧三分之一化成颗粒
  LQ = []; RQ = [];   // v19：这一句以前误落在上一行的注释里，亮面表每帧越攒越长、还停在第一帧的旧形状上，鸟和栏杆按旧位置换色，转久了白鸟就落进白台阶
  IT.forEach((it, i) => { const fr = it.t === 5; if (!(fr || it.t === 2 || it.t === 6 || (it.t === 7 && it.lit))) return; const p = it.p; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } (fr ? RQ : LQ).push({ i, p, x0, y0, x1, y1 }); });
}
function litUnder(idx, x0, y0, x1, y1, A) { const o = []; for (const q of A || LQ) { if (q.i >= idx) break; if (q.x1 < x0 || q.x0 > x1 || q.y1 < y0 || q.y0 > y1) continue; o.push(q.p); } return o; }
const BLUE3 = [0x1c, 0x31, 0xb6], INK3 = [0x16, 0x17, 0x1c];
function litBirdCol(b) {   // 鸟身后是受光的纸白踏面时的颜色：按远近在蓝和墨黑之间连续插值（不按帧切换，转着也不跳）；墨还没漫满时偏蓝，跟着形变一起过去
  const k = (1 - sstep(0.16, 0.2, b.sc / U)) * FLK; if (k <= 0.001) return BLUE; if (k >= 0.999) return INK;
  return 'rgb(' + BLUE3.map((v, i) => Math.round(lerp(v, INK3[i], k))).join(',') + ')'; }
const quadAdd = (g, p) => { g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.lineTo(p[2][0], p[2][1]); g.lineTo(p[3][0], p[3][1]); g.closePath(); };
function hatchQ(g, p, gap, sl) {   // 板厚和踢面上的铅笔排线：上沿一点连到下沿错开一点的地方
  const w = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), n = Math.min(14, Math.floor(w / gap)); if (n < 2) return;
  for (let k = 1; k < n; k++) { const t = k / n, t2 = clamp(t - sl, 0, 1); g.moveTo(lerp(p[0][0], p[1][0], t), lerp(p[0][1], p[1][1], t)); g.lineTo(lerp(p[3][0], p[2][0], t2), lerp(p[3][1], p[2][1], t2)); } }
function quad(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.lineTo(p[2][0], p[2][1]); g.lineTo(p[3][0], p[3][1]); g.closePath(); }
function drawStairs(g) {
  if (!IT.length) return; g.lineJoin = 'round'; g.lineCap = 'round';
  for (let ii = 0; ii < IT.length; ii++) { const it = IT[ii], p = it.p, al = it.al === undefined ? 1 : it.al; g.globalAlpha = al;
    switch (it.t) {
      case 0: quad(g, p); g.fillStyle = g.strokeStyle = SIDE; g.lineWidth = 0.5; g.fill(); g.stroke(); g.strokeStyle = PEN; g.globalAlpha = al * 0.7; g.beginPath(); hatchQ(g, p, 3.4 * U, 0.12); g.stroke();   // 朝井的板厚：深铅笔灰加排线，一级压一级的锯齿边就靠它
        g.globalAlpha = al * 0.45; g.strokeStyle = PAPER; g.lineWidth = 0.5; g.beginPath(); g.moveTo(p[2][0], p[2][1]); g.lineTo(p[3][0], p[3][1]); g.stroke(); break;
      case 1: quad(g, p); g.fillStyle = g.strokeStyle = it.sun ? SIDE : RISER; g.fill(); g.lineWidth = 0.5; g.stroke(); g.strokeStyle = PEN; g.globalAlpha = al * (it.sun ? 0.6 : 0.45); g.beginPath(); hatchQ(g, p, 4 * U, 0.18); g.stroke(); break;   // 踢面：比板厚再暗一档
      case 2: { if (it.grain) { grainTread(g, it); break; } quad(g, p); g.fillStyle = PAPER; g.fill(); g.strokeStyle = LINE; g.lineWidth = 0.5; g.stroke();
        if (it.big) { const f = 0.15; g.fillStyle = INK; g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.lineTo(p[1][0] + (p[2][0] - p[1][0]) * f, p[1][1] + (p[2][1] - p[1][1]) * f); g.lineTo(p[0][0] + (p[3][0] - p[0][0]) * f, p[0][1] + (p[3][1] - p[0][1]) * f); g.closePath(); g.fill(); }   // 受光的踏面：纸白实面
        if (it.big > 70 * U && al >= 1) { const id = it.id, L2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], nh = 2 + ((hash(id * 3.1) * 3) | 0); g.strokeStyle = PEN; g.lineWidth = 0.5; g.globalAlpha = 0.55; g.beginPath();   // 近处的加铅笔排线和几粒旧渍
          for (let j = 0; j < nh; j++) { const f = 0.93 - 0.075 * j - 0.03 * hash(id * 5 + j), a = L2(p[0], p[3], f), b = L2(p[1], p[2], f), q0 = L2(a, b, 0.04 + 0.25 * hash(id + j * 9) * j / nh), q1 = L2(a, b, 0.96 - 0.5 * hash(id * 7 + j) * (j + 1) / nh); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); }
          g.stroke(); g.fillStyle = PEN; g.globalAlpha = 0.5; g.beginPath(); for (let j = 0; j < 6; j++) { const a = L2(p[0], p[3], hash(id * 1.7 + j * 3.3)), b = L2(p[1], p[2], hash(id * 1.7 + j * 3.3)), q = L2(a, b, hash(id * 2.3 + j * 5.1)); dot(g, q[0], q[1], (0.35 + 0.5 * hash(id + j)) * U); } g.fill(); }
        break; }
      case 3: quad(g, p); g.fillStyle = INK; g.fill(); g.globalAlpha = al * 0.36; g.strokeStyle = PAPER; g.lineWidth = 0.5; g.stroke(); break;   // 落在影子里的踏面：墨黑，只勾细边
      case 4: { const ln = () => { g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.stroke(); }, L = litUnder(ii, Math.min(p[0][0], p[1][0]) - 1, Math.min(p[0][1], p[1][1]) - 1, Math.max(p[0][0], p[1][0]) + 1, Math.max(p[0][1], p[1][1]) + 1);   // 栏杆：黑里纸白，压在亮踏面上的那截换墨黑
        g.globalAlpha = 0.85; g.strokeStyle = PAPER; g.lineWidth = clamp(1.5 / p[0][2], 0.45, 0.9); ln();
        if (L.length) { g.save(); g.beginPath(); for (const q of L) quadAdd(g, q); g.clip(); g.globalAlpha = clamp(p[0][2] / 3, 0.4, 0.85); g.strokeStyle = LINE; ln(); g.restore(); } break; }
      case 8: { const b = it.b, rr = b.sc * 140; g.globalAlpha = b.al; if (b.al < 0.01) break;   // 鸟：黑里纸白，压在亮踏面和蓝带背面上换蓝
        if (FLK >= 1) birdFill(g, b, PAPER); else { birdFill(g, b, BLUE); g.save(); blackClip(g, 1); birdFill(g, b, PAPER); g.restore(); }
        const L = litUnder(ii, b.x - rr, b.y - rr, b.x + rr, b.y + rr); if (L.length) { g.save(); g.beginPath(); for (const q of L) quadAdd(g, q); g.clip(); birdFill(g, b, litBirdCol(b), true); g.restore(); }   // 压在亮踏面上：近处的大鸟照旧蓝，往深处的小鸟渐渐换墨黑
        const L2 = litUnder(ii, b.x - rr, b.y - rr, b.x + rr, b.y + rr, RQ); if (L2.length) { g.save(); g.beginPath(); for (const q of L2) quadAdd(g, q); g.clip(); birdFill(g, b, PAPER); g.restore(); } break; }   // 蓝带正面盖在亮踏面上，压在它上面的那截回到纸白
      case 5: case 6: { const fr = it.t === 5; quad(g, p); g.fillStyle = g.strokeStyle = fr ? BLUE : PAPER; g.lineWidth = 0.6; g.fill(); g.stroke();
        g.strokeStyle = fr ? PAPER : BLUE; g.lineWidth = fr ? 0.6 : 1; g.globalAlpha = fr ? 0.75 : 1; g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.moveTo(p[3][0], p[3][1]); g.lineTo(p[2][0], p[2][1]); g.stroke();
        const wd = Math.hypot(p[0][0] - p[3][0], p[0][1] - p[3][1]); if (wd > 7 * U) { g.globalAlpha = 0.85; g.fillStyle = fr ? PAPER : BLUE; g.beginPath(); const n = Math.min(7, (wd / (5 * U)) | 0);   // 带面上的颗粒
          for (let j = 0; j < n; j++) { const a = hash(it.id * 7.3 + j * 1.9), b = Math.pow(hash(it.id * 3.7 + j * 4.1), 2.2) * (j % 2 ? 1 : -1) * 0.5 + 0.5, x0 = lerp(p[0][0], p[1][0], a), y0 = lerp(p[0][1], p[1][1], a), x1 = lerp(p[3][0], p[2][0], a), y1 = lerp(p[3][1], p[2][1], a); dot(g, lerp(x0, x1, b), lerp(y0, y1, b), (0.35 + 0.45 * hash(j + it.id)) * U); } g.fill(); }
        break; }
      case 7: if (it.grain) { g.globalAlpha = al; grainTread(g, it); break; } quad(g, p); if (it.lit) { g.fillStyle = PAPER; g.fill(); } else { g.fillStyle = INK; g.fill(); } g.strokeStyle = PAPER; g.lineWidth = 0.6; g.globalAlpha = al * 0.8; g.stroke(); break;
    } }
  g.globalAlpha = 1;
}
function grainTread(g, it) {   // 近处的大踏面：里侧三分之二实白，外侧三分之一从实白散成稀疏颗粒，只留一圈细轮廓
  it = Object.assign({}, it, { id: it.id === undefined ? 7.7 : it.id }); const p = it.p, L2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], f0 = 0.66, A = p[0], B = p[1], Cq = p[2], D = p[3], m0 = L2(A, B, f0), m1 = L2(D, Cq, f0);
  g.fillStyle = INK; quad(g, p); g.fill();
  g.fillStyle = PAPER; g.beginPath(); g.moveTo(A[0], A[1]); for (let k = 0; k <= 12; k++) { const v = k / 12, e = f0 - 0.07 + 0.09 * (vnoise(v * 7 + it.id, 3.3) - 0.5), a = L2(A, B, e), b = L2(D, Cq, e), q = L2(a, b, v); g.lineTo(q[0], q[1]); } g.lineTo(D[0], D[1]); g.closePath(); g.fill();
  const ar = Math.abs((B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0])), n = Math.min(9000, Math.round(ar * (1 - f0 + 0.1) * 0.9 / (U * U))), Rn = rng(Math.round(it.id * 977) + 13); g.beginPath();
  for (let i = 0; i < n; i++) { const v = Rn(), u0 = Math.pow(Rn(), 1.35), edge = 0.09 * (vnoise(v * 7 + it.id, 3.3) - 0.5), u = f0 - 0.07 + edge + (1.07 - f0) * u0, pr = Math.pow(1 - u0, 2.2) * 1.0 + 0.03; if (Rn() > pr) continue; const a = L2(A, B, u), b = L2(D, Cq, u), q = L2(a, b, v); dot(g, q[0], q[1], (0.3 + 0.6 * Rn() * (1 - 0.5 * u0)) * U); }
  g.fill();
  g.fillStyle = INK; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); { const f = 0.15; g.lineTo(B[0] + (Cq[0] - B[0]) * f, B[1] + (Cq[1] - B[1]) * f); g.lineTo(A[0] + (D[0] - A[0]) * f, A[1] + (D[1] - A[1]) * f); } g.closePath(); g.fill();
  g.strokeStyle = PAPER; g.globalAlpha = 0.5; g.lineWidth = 0.5; quad(g, p); g.stroke(); g.globalAlpha = 1;
}
function wellEye(g) { const k = sstep(0.4, 0.9, MP); if (k < 0.01) return; g.fillStyle = INK; g.beginPath(); g.arc(C.x, C.y, 8 * U * k, 0, TAU); g.fill(); g.fillStyle = BLUE; g.beginPath(); g.arc(C.x, C.y, 5.2 * U * k, 0, TAU); g.fill(); g.fillStyle = PAPER; g.beginPath(); g.arc(C.x, C.y, 2.1 * U * k, 0, TAU); g.fill(); }   // 井底：月亮瞳孔缩成的小圆
/* 最近那几级松开以后再往下：纸白线框小方块和颗粒慢慢往下落、淡掉、再补上；止于测深图上沿之上，到那儿只剩几粒 */
let DB = [];
function cubeSegs(P, c) { const ex = [0.866 * c, 0.5 * c], ey = [-0.866 * c, 0.5 * c], ad = (p, v) => [p[0] + v[0], p[1] + v[1]], dn = [0, c], Px = ad(P, ex), Py = ad(P, ey), Pf = ad(Px, ey); return [[P, Px], [Px, Pf], [Pf, Py], [Py, P], [Px, ad(Px, dn)], [Pf, ad(Pf, dn)], [Py, ad(Py, dn)], [ad(Py, dn), ad(Pf, dn)], [ad(Pf, dn), ad(Px, dn)]]; }
function buildDebris() { const Rn = rng(909); DB = []; for (let i = 0; i < 170; i++) { const cube = i < 8; DB.push({ cube, s: 0.2 + 3.4 * Rn(), rr: RIN + Rn() * (ROUT - RIN), fall: (40 + 110 * Rn()) * U, dx: (-30 + 50 * Rn()) * U, per: (cube ? 11 : 7) + Rn() * 8, off: Rn(), sz: cube ? (5 + 5 * Rn()) * U : (0.35 + 0.75 * Rn() * Rn()) * U, grey: Rn() < 0.3, wob: Rn() * TAU }); } }
function drawDebris(g, T) {
  if (LK < 0.01) return; g.lineWidth = 0.6; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = PAPER;
  for (const d of DB) { const ph = (d.off + (STILL ? 3 : T) / d.per) % 1, al = LK * sstep(0, 0.12, ph) * (1 - sstep(0.45, 1, ph)); if (al < 0.02) continue;
    const o = SPW(d.s, d.rr, -0.4), x = o[0] + d.dx * ph + Math.sin(d.wob + ph * 5) * 3 * U, y = o[1] + d.fall * Math.pow(ph, 1.4), lim = 1 - sstep(0.67 * H, 0.745 * H, y), al2 = al * (d.cube ? lim : Math.max(lim, d.wob > 5.75 ? 0.6 : 0)); if (al2 < 0.02 || x < -10 || x > W + 10) continue;
    if (d.cube) { g.globalAlpha = al2 * 0.75; g.beginPath(); for (const s of cubeSegs([x, y], d.sz * (1 - 0.35 * ph))) { g.moveTo(s[0][0], s[0][1]); g.lineTo(s[1][0], s[1][1]); } g.stroke(); }
    else { g.globalAlpha = al2 * 0.8; g.fillStyle = d.grey ? GREY : PAPER; g.fillRect(x - d.sz, y - d.sz, 2 * d.sz, 2 * d.sz); } }
  g.globalAlpha = 1;
}
/* 燕子：眼眶上的十七只先朝左右两边散开，再一只对一只汇进第二态的鸟链。
   鸟链在三维里算：从左下画框外飞进来，贴着近处的大踏步上方掠过，沿一圈比扶手略高略宽的螺旋绕一圈，再往井心收、往下扎，最里面淡掉，再从起点补进来。
   一条路线按「走一个鸟身长」切成刻度，十七只等距排开，近大远小；一起往前挪，一圈约半分钟 */
let BDL = [], BSC = [], BSD = [], BK = [], CHO = [], mkA = null, mxA = null, mkB = null, mxB = null, RB = 100;
const CHM = 160, CHX = new Float32Array(CHM + 1), CHY = new Float32Array(CHM + 1), CHD = new Float32Array(CHM + 1), CHP = new Float32Array(CHM + 1), CHL = new Float32Array(CHM + 1);
const BCH = { W0: 0.6, W1: 28, RA: 3.1, RB: 1.3, RC: 0.4, HA: 0.5, HB: 0.6, HC: -7, U0: 0.55, U1: 0.06, K: 0.3, V: 0.75 }, BPX = 176;
let LT = 1, LT0 = 0, BM = [];
function buildMorph() {
  const n = RING.length, Rn = rng(2718); BDL = []; BK = []; BSD = [];
  for (let i = 0; i < n; i++) { const s = RING[i]; BDL[i] = 0.14 * Rn(); BSD[i] = s.x < ECX ? -1 : 1; BK[i] = [(70 + 80 * Rn()) * U, (s.up ? -1 : 1) * (18 + 50 * Rn()) * U, (36 + 50 * Rn()) * U, Rn()]; }
  const ord = RING.map((_, i) => i).sort((a, b) => RING[b].sc - RING[a].sc); CHO = []; ord.forEach((i, k) => { CHO[i] = (k + 0.5) / n; });   // 大的排在链头（近处），小的排在后面
}
function chainCompute() {
  const b = BCH; let L = 0;
  for (let k = 0; k <= CHM; k++) { const u = k / CHM, kw = b.W0 + (b.W1 - b.W0) * u, r = b.RB + (b.RA - b.RB) * (1 - sstep(0, b.U1, u)) - (b.RB - b.RC) * sstep(b.U0, 1, u), h = b.HA + (b.HB - b.HA) * sstep(0.02, 0.4, u) + (b.HC - b.HB) * sstep(b.U0, 1, u), q = SPW(kw, r, h);
    CHX[k] = q[0]; CHY[k] = q[1]; CHD[k] = q[2]; CHP[k] = b.K * FL3 / q[2];
    if (k) L += Math.hypot(q[0] - CHX[k - 1], q[1] - CHY[k - 1]) / ((CHP[k] + CHP[k - 1]) / 2); CHL[k] = L; }
  LT = L; if (!LT0) LT0 = L;
}
function chainAt(i, T) {   // 第 i 只此刻在链上的哪儿
  const f = (((CHO[i] + (STILL ? 0.02 : T * BCH.V / LT0)) % 1) + 1) % 1, L = f * LT; let lo = 0, hi = CHM;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CHL[m] < L) lo = m; else hi = m; }
  const t = clamp((L - CHL[lo]) / (CHL[hi] - CHL[lo] || 1), 0, 1), a = Math.max(0, lo - 1), c = Math.min(CHM, hi + 1);
  return { x: lerp(CHX[lo], CHX[hi], t), y: lerp(CHY[lo], CHY[hi], t), d: lerp(CHD[lo], CHD[hi], t), px: lerp(CHP[lo], CHP[hi], t), hd: Math.atan2(CHY[c] - CHY[a], CHX[c] - CHX[a]), al: sstep(0, 0.03, f) * (1 - sstep(0.86, 0.99, f)) };
}
function birdM(i, T) {
  const s = RING[i], e0 = clamp((MP - BDL[i]) / 0.8, 0, 1); if (e0 <= 0) return s;
  const e = smoother(e0), m = 1 - e, k = BK[i], q = chainAt(i, T), sb = q.px / BPX, hdT = q.hd;
  const k1x = s.x + BSD[i] * k[0], k1y = s.y + k[1], ol = Math.hypot(q.x - C.x, q.y - C.y) || 1, kk = k[2] * 1.4, k2x = q.x + (q.x - C.x) / ol * kk, k2y = q.y + (q.y - C.y) / ol * kk;
  const x = m * m * m * s.x + 3 * m * m * e * k1x + 3 * m * e * e * k2x + e * e * e * q.x, y = m * m * m * s.y + 3 * m * m * e * k1y + 3 * m * e * e * k2y + e * e * e * q.y;
  const vx = 3 * m * m * (k1x - s.x) + 6 * m * e * (k2x - k1x) + 3 * e * e * (q.x - k2x), vy = 3 * m * m * (k1y - s.y) + 6 * m * e * (k2y - k1y) + 3 * e * e * (q.y - k2y);
  let hd = s.hd + wrapA(Math.atan2(vy, vx) - s.hd) * sstep(0, 0.22, e); hd += wrapA(hdT - hd) * sstep(0.7, 1, e);
  const sc = lerp(s.sc, sb, e); const cs = Math.cos(hd), ry = (cs < 0 ? -1 : 1) * Math.max(0.45, Math.min(1, Math.abs(cs) * 3)); let syy = lerp(s.syy, ry, sstep(0, 0.3, e)); if (Math.abs(syy) < 0.08) syy = syy < 0 ? -0.08 : 0.08;
  return { x, y, hd, sc, syy, ph: s.ph + sstep(0, 0.1, e) * (k[3] + (STILL ? 3 : T) * 1.5), path: null, halo: s.halo * (1 - sstep(0, 0.3, e)), al: lerp(1, q.al, sstep(0.6, 1, e)), grey: s.grey, e0, d3: q.d };
}
function birdTf(g, p) { g.translate(p.x, p.y); if (p.m) g.transform(p.m[0], p.m[1], p.m[2], p.m[3], 0, 0); else { g.rotate(p.hd); g.scale(p.sc, p.sc * p.syy); } }
/* 纸上的灰尘：第二态里绕着环慢慢转，离环近的密、远的稀 */
let DTH = null, DRR = null, DOM = null, DDL = null;
function buildDust() { const n = SPOTS.length / 3, Rn = rng(1414); DTH = new Float32Array(n); DRR = new Float32Array(n); DOM = new Float32Array(n); DDL = new Float32Array(n);
  for (let i = 0; i < n; i++) { const h = Rn(), q = Rn(); DTH[i] = Rn() * TAU; DRR[i] = h < 0.18 ? Rm - BW - (4 + 26 * q) * U : Rm + BW + (4 + 190 * Math.pow(q, 2.4)) * U; DOM[i] = 0.07 * Math.pow(Rm / DRR[i], 1.5); DDL[i] = 0.06 + 0.3 * Rn(); } }
function drawDust(g, T, light) { g.fillStyle = light ? 'rgba(241,238,230,0.2)' : 'rgba(84,84,88,0.2)'; g.beginPath(); const n = SPOTS.length / 3;
  for (let i = 0; i < n; i++) { const e = smoother((MP - DDL[i]) / 0.6), o = i * 3; if (e <= 0) { dot(g, SPOTS[o], SPOTS[o + 1], SPOTS[o + 2]); continue; }
    const q = ringXY(DTH[i] + (STILL ? 0 : DOM[i] * T), DRR[i]); dot(g, lerp(SPOTS[o], q[0], e), lerp(SPOTS[o + 1], q[1], e), SPOTS[o + 2]); }
  g.fill(); }
/* 线稿：拱廊和塔的笔画拆开，一笔对一笔地挪过去，搭成一圈走回原地的楼梯；没被挑中的笔画擦掉 */
let UN2 = [], MN = 0, MA = null, MB = null, MW = null, MAL = null, MD = null, MOF = null, MSK = null, pcvA = null, pcv2 = null;
function buildStairs() {   // 形变时拱廊的笔画要挪成的样子：最近一圈多踏步的边（定在一个相位上；到位以后换成每帧现画的那套）
  const sv = SR; SR = rng(31415); UN2 = []; const O = { to: UN2, w: 0.6, a: 0.5, n: 1, j: 0.3, ov: 2 }, O0 = { to: UN2, w: 0.5, a: 0.42, n: 1, j: 0.2, ov: 0.8 }, on = q => q[0] > -20 && q[0] < W + 20 && q[1] > -20 && q[1] < H + 20, xy = q => [q[0], q[1]];
  setCam(0.35);
  for (let j = 3; j < 30; j++) { const a0 = j * DT3, a1 = (j + 1) * DT3, zt = -j * RISE, A = F3(a0, RIN, zt), B = F3(a0, ROUT, zt), D = F3(a1, RIN, zt), Cq = F3(a1, ROUT, zt); if (!on(A) && !on(B)) continue;
    hand([xy(A), xy(B)], O); hand([xy(A), xy(D)], O0); if (j % 2) hand([xy(B), xy(Cq)], O0); }
  SR = sv;
}
function resamp(p, K) { const m = p.length / 2, Ls = [0]; for (let i = 1; i < m; i++) Ls.push(Ls[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1])); const out = [], tot = Ls[m - 1] || 1; let j = 1;
  for (let k = 0; k < K; k++) { const s = tot * k / (K - 1); while (j < m - 1 && Ls[j] < s) j++; const f = clamp((s - Ls[j - 1]) / (Ls[j] - Ls[j - 1] || 1), 0, 1); out.push(lerp(p[j * 2 - 2], p[j * 2], f), lerp(p[j * 2 - 1], p[j * 2 + 1], f)); } return out; }
function inAlmond(x, y) { const dx = (x - ECX) / EK, dy = (y - ECY) / EK, ct = Math.cos(EP.TILT), st = Math.sin(EP.TILT), lx = dx * ct + dy * st, ly = -dx * st + dy * ct; if (Math.abs(lx) >= EP.A) return false; const q = lidQ(lx); return ly > -EP.HU * q - 6 && ly < EP.HL * q + 6; }
function buildMorphSketch() {
  buildStairs(); const M = 3, n2 = UN2.length, cand = []; MSK = new Uint8Array(UN.length); pcvA = pcv2 = null;
  for (let i = NPRE; i < UN.length; i++) { const un = UN[i], p = un.p; if (un.k || un.w > 3 * U || inAlmond(p[0], p[1]) || inAlmond(p[p.length - 2], p[p.length - 1])) continue; cand.push(i); }
  MN = Math.min(n2 * M, cand.length); MN -= MN % M; const pick = []; for (let k = 0; k < MN; k++) pick.push(cand[Math.floor((k + 0.5) * cand.length / MN)]);
  const mx = p => (p[0] + p[p.length - 2]) / 2; pick.sort((a, b) => mx(UN[a].p) - mx(UN[b].p)); const nw = []; for (let i = 0; i < n2; i++) nw.push(i); nw.sort((a, b) => mx(UN2[a].p) - mx(UN2[b].p));
  MA = new Float32Array(MN * 8); MB = new Float32Array(MN * 8); MW = new Float32Array(MN * 2); MAL = new Float32Array(MN * 2); MD = new Float32Array(MN); MOF = new Float32Array(MN * 2);
  for (let k = 0; k < MN; k++) { const o = UN[pick[k]], t = UN2[nw[Math.min(n2 - 1, Math.floor(k / M))]], a = resamp(o.p, 4); let b = resamp(t.p, 4); MSK[pick[k]] = 1;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(a[6] - b[6], a[7] - b[7]) > Math.hypot(a[0] - b[6], a[1] - b[7]) + Math.hypot(a[6] - b[0], a[7] - b[1])) b = [b[6], b[7], b[4], b[5], b[2], b[3], b[0], b[1]];
    for (let j = 0; j < 8; j++) { MA[k * 8 + j] = a[j]; MB[k * 8 + j] = b[j]; }
    MW[k * 2] = o.w; MW[k * 2 + 1] = t.w; MAL[k * 2] = o.a; MAL[k * 2 + 1] = t.a * 1.15 / M; MD[k] = 0.02 + 0.34 * k / MN + 0.03 * hash(k); const an = hash(k + 77) * TAU, r = (6 + 22 * hash(k + 5)) * U; MOF[k * 2] = Math.cos(an) * r; MOF[k * 2 + 1] = Math.sin(an) * r; }
}
function morphCv() { if (pcvA) return; let x; [pcvA, x] = mkCanvas(); x.strokeStyle = PEN; x.lineCap = 'round'; x.lineJoin = 'round'; for (let i = 0; i < UN.length; i++) if (!UN[i].k && !MSK[i]) unit(x, UN[i]);
  [pcv2, x] = mkCanvas(); x.strokeStyle = PEN; x.lineCap = 'round'; x.lineJoin = 'round'; for (const un of UN2) unit(x, un); }
function drawMapped(g, p, col) { g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < MN; i++) { const e = smoother((p - MD[i]) / 0.6), o = i * 8, bl = Math.sin(PI * e), ox = MOF[i * 2] * bl, oy = MOF[i * 2 + 1] * bl; g.globalAlpha = lerp(MAL[i * 2], MAL[i * 2 + 1], e) * MFADE * (col === PEN ? 1 : sstep(0.6, 0.95, e) * sstep(0.62, 0.8, p)); g.lineWidth = lerp(MW[i * 2], MW[i * 2 + 1], e); g.beginPath();
    for (let k = 0; k < 8; k += 2) { const x = lerp(MA[o + k], MB[o + k], e) + ox, y = lerp(MA[o + k + 1], MB[o + k + 1], e) + oy; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.globalAlpha = 1; }
const almondOut = g => { g.beginPath(); g.rect(0, 0, W, H); almond(g, 1); g.clip('evenodd'); };
let MFADE = 1;
function sceneBaseM(g, p, T) {   // 形变途中的底：每帧现画。纸、拱廊线稿、黑块，再是漫开的墨；挪动的笔画落在黑里的那截换成浅灰
  MFADE = 1 - sstep(0.8, 0.97, p); morphCv(); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); drawDust(g, T, false); drawHairs(g);
  g.save(); almondOut(g); drawAux(g, { axOn: 1, ax: -EC * 1.2 * W, bxOn: 1, bx: EC * 1.2 * W }); const fa = 1 - sstep(0.02, 0.55, p); if (fa > 0.01) { g.globalAlpha = fa; g.drawImage(pcvA, 0, 0, W, H); g.globalAlpha = 1; } g.restore();
  geoLines(g, { rail: 1 - sstep(0, 0.5, p), dot: 1 - sstep(0, 0.4, p) }); drawBlock(g, 1); drawFlood(g);
  if (FLK > 0) { g.save(); g.beginPath(); floodPath(g); g.clip(); drawDust(g, T, true); g.restore(); }
  drawMapped(g, p, PEN); g.save(); blackClip(g, 1); drawMapped(g, p, PAPER); g.restore();
}
function applyMorph(T) {
  MP = mode === 'home' ? clamp(mor.p, 0, 1) : 0; EC = smoother(MP); EM = smoother((MP - 0.22) / 0.66); GK = sstep(0.2, 0.92, MP); WK = 0.3 + 0.7 * sstep(0.25, 0.85, MP); SK = sstep(0.27, 0.93, MP); LK = sstep(0.75, 1, MP); C.x = lerp(C0x, MX, EC);
  FLK = clamp((MP - 0.25) / 0.5, 0, 1); FLR = FLK > 0 ? RMAX * 1.2 * Math.pow(FLK, 1.1) : 0;
  if (FLK >= 1) FLT.fill(RMAX * 1.3); else if (FLK > 0) for (let i = 0; i < 128; i++) { const th = i / 128 * TAU, c = Math.cos(th), sn = Math.sin(th); FLT[i] = FLR * (1 + 0.08 * (vnoise(3 + 1.5 * c, 7 + 1.5 * sn + FLK * 2) - 0.5) + 0.05 * (vnoise(11 + 6 * c, 4 + 6 * sn) - 0.5)); }
  setPose(T, STILL); if (MP > 0) { wellCompute(T); chainCompute(); BM = RING.map((_, i) => birdM(i, T)); BM.forEach(o => { if (o.e0 >= 0.5) IT.push({ t: 8, d: lerp(0.05, o.d3, sstep(0.75, 1, o.e0)), b: o }); }); sortWell(); } else { IT = []; LQ = []; }   // 走过一半的鸟交给楼梯一起排远近
}
/* 下半屏的测深点：大小不一的小圆，旁边标极小的数字，配三条断断续续的等深线。只有坠子正下方那颗是蓝的。
   第二态里左边几颗漂到旋转楼梯散开的颗粒再往下，当最远的一层；右边三颗留在原地 */
const SND = [[0.70, 0.835, 9, 3, '12', 1], [0.615, 0.80, 5, 0, '4.5', 0, 0.40, 352], [0.775, 0.795, 4, 1, '7', 1], [0.56, 0.862, 16, 1, '37', 1], [0.47, 0.815, 12, 2, '21', 0, 0.31, 372], [0.36, 0.878, 22, 1, '58', 0, 0.20, 402], [0.24, 0.835, 5, 0, '9', 0, 0.12, 356], [0.15, 0.888, 10, 2, '64', 0, 0.09, 422]];
const SNC = [[0.30, [46, 7, 18, 5, 80, 10]], [0.42, [90, 8, 30, 6, 24, 12]], [0.55, [26, 9, 110, 7, 50, 14]]];
function drawSound(g, T, al, light) {
  if (al < 0.01) return; const c1 = light ? LGREY : PEN, e = EC, cx = lerp(0.62, 0.30, e) * W, cy = lerp(0.90, 0.875, e) * H, ks = lerp(1, 0.72, e);
  g.strokeStyle = c1; g.lineWidth = 0.5; g.lineCap = 'butt'; g.globalAlpha = al * 0.3;
  SNC.forEach((c, i) => { const rx = c[0] * W * ks; g.setLineDash(c[1].map(v => v * U)); g.lineDashOffset = STILL ? 0 : T * 0.6 * (i % 2 ? 1 : -1); g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.38, 0, 188 * RAD, (300 - 12 * i) * RAD); g.stroke(); });
  g.setLineDash([]); g.lineDashOffset = 0;
  SND.forEach((s, i) => { const em = s[5] ? 0 : smoother((MP - 0.1 - 0.04 * i) / 0.6); let x = s[0] * W, y = s[1] * H + 0.022 * H * EC; if (em > 0) { x = lerp(x, s[6] * W, em); y = lerp(y, C.y + (s[7] + 64) * U, em); }
    if (!STILL) { x += 1.5 * U * Math.sin(T * 0.31 + i * 1.7); y += 1.2 * U * Math.cos(T * 0.27 + i * 2.3); }   // 极慢地漂
    const r = s[2] / 2 * U * (STILL ? 1 : 1 + 0.05 * Math.sin(T * 0.5 + i)), blue = s[3] === 3; g.globalAlpha = al * (blue ? 1 : 0.75); g.strokeStyle = g.fillStyle = blue ? BLUE : c1; g.lineWidth = 0.6;
    g.beginPath(); g.arc(x, y, r, 0, TAU); if (s[3] === 0 || blue) g.fill(); else g.stroke(); if (s[3] === 2) { g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.stroke(); } if (blue && light) { g.strokeStyle = PAPER; g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, r + 1.6 * U, 0, TAU); g.stroke(); }
    g.globalAlpha = al * 0.8; txt(g, s[4], x + r + 3 * U, y + 3 * U, fe(8.2), c1, 0.4);
    if (blue) { const y0 = HANG + pull.ext + 28 * U; if (y - r - y0 > 6 * U) { g.globalAlpha = al * 0.7; g.strokeStyle = light ? PAPER : BLUE; g.lineWidth = 0.8; g.lineCap = 'round'; g.setLineDash([0.1, 3.4 * U]); g.beginPath(); g.moveTo(C.x, y0); g.lineTo(x, y - r - 2 * U); g.stroke(); g.setLineDash([]); g.lineCap = 'butt'; } } });
  g.globalAlpha = 1;
}
/* 拉手：泪线下端的小坠子。按住往下拖，进度跟手；松手过半自己走完，没过半弹回去 */
const pullHit = (x, y) => Math.hypot(x - C.x - pull.dx * 0.6, y - (HANG + pull.ext + 8 * U)) < 32 * U;
function pullMove(x, y) { let d = Math.max(0, y - pull.sy); if (d > PULLD) d = PULLD + (d - PULLD) * 0.3; pull.ext = d; pull.v = 0; pull.dx = clamp(x - pull.sx, -50 * U, 50 * U); const q = clamp(d / PULLD, 0, 1); mor.p = mor.base ? 1 - q : q; mor.v = 0; mor.tgt = mor.p; }
function pullUp() { pull.drag = false; const q = mor.base ? 1 - mor.p : mor.p; if (q > 0.5) mor.base = 1 - mor.base; mor.tgt = mor.base; setSide(mor.base === 1); }
function stepMorph(dt) { if (pull.drag) return;
  pull.v += (-260 * pull.ext - 15 * pull.v) * dt; pull.ext += pull.v * dt; pull.dx *= Math.exp(-dt * 9); if (Math.abs(pull.ext) < 0.05 && Math.abs(pull.v) < 0.6) { pull.ext = 0; pull.v = 0; pull.dx = 0; }
  mor.v += (-58 * (mor.p - mor.tgt) - 11.5 * mor.v) * dt; mor.p += mor.v * dt; if (Math.abs(mor.p - mor.tgt) < 0.0006 && Math.abs(mor.v) < 0.01) { mor.p = mor.tgt; mor.v = 0; } }
const morBusy = () => pull.drag || pull.ext !== 0 || mor.p !== mor.tgt || mor.p > 0;

/* ---------- 文字 ---------- */
const FE = '"Cormorant Garamond","Cormorant",Georgia,"Times New Roman",serif', FZ = '"Noto Serif SC","Songti SC","STSong","SimSun",serif';
const fe = (px, it) => (it ? 'italic ' : '') + '300 ' + (px * UF).toFixed(1) + 'px ' + FE;
const fz = px => '300 ' + (px * UF).toFixed(1) + 'px ' + FZ;
let HALO = false, HALOC = PAPER;   // 压在线稿上的字，先垫一圈纸色
function txt(g, s, x, y, font, col, sp, align) {
  g.font = font; g.fillStyle = col; g.textBaseline = 'alphabetic'; if (HALO) { g.strokeStyle = HALOC; g.lineWidth = 3 * U; g.lineJoin = 'round'; }
  if (!sp) { g.textAlign = align || 'left'; if (HALO) g.strokeText(s, x, y); g.fillText(s, x, y); return; }
  const cs = Array.from(s), ws = cs.map(c => g.measureText(c).width), w = ws.reduce((a, b) => a + b, 0) + sp * (cs.length - 1);
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; g.textAlign = 'left';
  if (HALO) { let hx = cx; cs.forEach((c, i) => { g.strokeText(c, hx, y); hx += ws[i] + sp; }); }
  cs.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + sp; });
}
const p2 = n => (n < 10 ? '0' : '') + n;
function clock() { const t = new Date(); return { hm: p2(t.getHours()) + ':' + p2(t.getMinutes()), ss: p2(t.getSeconds()),
  en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][t.getDay()] + ' · ' + t.getDate() + ' ' + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][t.getMonth()],
  num: t.getFullYear() + ' · ' + p2(t.getMonth() + 1) + ' · ' + p2(t.getDate()) }; }
const moonAge = () => { const d = (Date.now() / 86400000 + 2440587.5 - 2451550.1) / 29.530588853; return (d - Math.floor(d)) * 29.530588853; };
function homeTexts(g, ta, light) {
  if (ta < 0.01) return; const c1 = light ? PAPER : LINE, c2 = light ? LGREY : PEN, ck = clock(), f = fe(7.6), sp = 1.1 * UF; g.globalAlpha = ta;
  txt(g, ck.hm, 27 * U, 56 * U, fe(15), c1, 1.2 * UF); const w = g.measureText(ck.hm).width + 1.2 * UF * 5;
  txt(g, ck.ss, 27 * U + w + 3 * U, 56 * U, fe(8), c2, 1 * UF); txt(g, ck.en, 28 * U, 69 * U, fe(7.8), c2, 1.9 * UF);   // 走动的秒跟在钟后面
  txt(g, 'age ' + moonAge().toFixed(1) + ' d   ' + ck.num, 28 * U, H - 26 * U, f, c2, sp);   // 左下角一行小字，和钟对齐
  if (light) { g.globalAlpha = 1; return; }
  g.globalAlpha = ta * (1 - EC);
  g.fillStyle = BLUE; g.fillRect(12 * U, C.y - 2 * U, 20 * U, 4 * U);   // 压在视平线上的小色片
  g.fillStyle = LINE; g.beginPath(); g.arc(28 * U, C.y + 46 * U, 3.2 * U, PI, TAU); g.fill();   // 半圆小片
  g.globalAlpha = ta;
  g.globalAlpha = 1;
}
function smallBirds(g, a) {   // 斜轴出了轨道变成虚线航迹，上面落两只掉队的
  if (a < 0.01) return; g.globalAlpha = a * 0.8; g.strokeStyle = LINE; g.lineWidth = 0.5; g.setLineDash([5 * U, 4.5 * U]); g.beginPath(); g.moveTo(C.x + AXC * (RR + 74 * U), C.y + AXS * (RR + 74 * U)); g.lineTo(C.x + AXC * (RR + 142 * U), C.y + AXS * (RR + 142 * U)); g.stroke(); g.setLineDash([]);
  g.globalAlpha = a; SB.forEach(s => bird(g, s.path, s.x, s.y, s.sc, s.hd, BLUE)); g.globalAlpha = 1;
}

/* ---------- 一帧画面：S 是这一刻的状态（主页就是 FIN）。底下不动的一层可以缓存；玫瑰窗会转，和它上面的月亮、线、燕子每帧画 ---------- */
function sceneBase(g, S) {
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H); drawSpots(g);
  g.save(); if (S.o > 0.01) { g.beginPath(); g.rect(0, 0, W, H); almond(g, S.o); g.clip('evenodd'); } drawAux(g, S.K); if (pcv) g.drawImage(pcv, 0, 0, W, H); g.restore();   // 眼眶里不留线稿
  geoLines(g, S.K); drawBlock(g, S.blk);
}
function sceneEye(g, S, T) {
  if (S.blk > 0.01 && wcv) { g.save(); blkClip(g, S.blk); g.translate(C.x, C.y); g.rotate(S.rot * RAD); g.translate(-C0x, -C.y); const ra = S.ra === undefined ? 1 : S.ra; g.globalAlpha = ra; if (ra > 0.01) g.drawImage(wcv, BX.x, BX.y, BX.w, BX.h); g.globalAlpha = 1;   // 玫瑰窗只在黑块里露出来，跟着轨道转
    if (S.rt && ra > 0.99) { const pts = S.rt.pts, n = pts.length - 1, e = S.rt.pr * n; g.strokeStyle = PAPER; g.globalAlpha = S.rt.al; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= n; i++) { if (i <= e) g.lineTo(pts[i][0], pts[i][1]); else { const f = e - (i - 1); if (f > 0) g.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); break; } } g.stroke(); }
    g.restore(); }
  if (S.band) drawStairs(g);   // 楼梯垫在最底下，缩小的瞳孔压在它的井心上
  drawMoon(g, S.r, S.blk, T);
  twoTone(g, S, inn => { slanted(g, S.K, inn ? PAPER : LINE);
    if (S.cq > 0.01) { g.globalAlpha = S.cq * 0.75; g.strokeStyle = inn ? PAPER : LINE; g.lineWidth = 0.5; g.beginPath(); g.arc(C.x, C.y, 0.965 * RO, 152 * RAD, 398 * RAD); g.stroke(); g.globalAlpha = 1; }   // 玫瑰窗退掉，只剩它最外那一圈当同心辅助线
    if (inn && FLK > 0) { g.save(); g.beginPath(); g.rect(0, 0, W, H); floodPath(g); g.clip('evenodd'); tear(g, S, PAPER); g.restore(); g.save(); g.beginPath(); floodPath(g); g.clip(); tear(g, S, BLUE, PAPER); g.restore(); } else tear(g, S, inn ? PAPER : BLUE); nodes(g, S.K, inn ? PAPER : LINE); lids(g, S.o, inn ? PAPER : INK); });
  pupil(g, S.pm);
  if (S.band) { wellEye(g); drawDebris(g, T); }
  ringDraw(g, S.PL, S);
}
const KFIN = { line: 1, lo: 0, rail: 1, dot: 1, ax: 0, bx: 0, axOn: 1, bxOn: 1, nd: null };
let FIN = null, homeCv = null, splashCv = null, dialAcc = 0;
const OFF0 = FS - (SLOTQ || 0);
const ROT = () => (rail.off - OFF0) * STEP + dialAcc + (dial.k >= 0 ? dispRot() * 0.25 : 0);   // 入口轨道转了多少度（转盘拨动也带一点）
function homeCache() {
  if (homeCv) return homeCv; sketchTo(UN.length); const ec = EC, cx = C.x; EC = 0; C.x = C0x;
  const [c, x] = mkCanvas(); FIN = { K: KFIN, tipY: HANG, y0: C.y + 0.235 * R, o: 1, r: R, blk: 1, pm: 1, rot: 0, PL: RING, tk: 1, pd: 1 };
  sceneBase(x, FIN); homeCv = c; EC = ec; C.x = cx; return c;
}
function splashText(g, a) { if (a < 0.01) return; const c = clock(), x = 28 * U, y = H - 74 * U; g.globalAlpha = a;
  g.fillStyle = LINE; g.fillRect(x, y - 15 * U, 22 * U, 0.6);
  txt(g, 'touch, and the eye opens', x, y, fe(12.5, 1), LINE, 0.3); txt(g, '轻触 · 睁眼', x, y + 15 * U, fz(8), LINE, 3 * UF); txt(g, c.num + '   ' + c.hm, x, y + 30 * U, fe(8.5), PEN, 1.6 * UF); g.globalAlpha = 1; }
function paintSplash() {
  if (!splashCv) { const [c, x] = mkCanvas(); x.fillStyle = PAPER; x.fillRect(0, 0, W, H); drawSpots(x); x.drawImage(pcv, 0, 0, W, H); lids(x, 0, INK); splashCv = c; }
  g.drawImage(splashCv, 0, 0, W, H); splashText(g, 1); grainOver();
}
function paintHome(T) {
  const p = MP; if (!FIN) homeCache();
  if (p <= 0) g.drawImage(homeCache(), 0, 0, W, H); else if (p >= 1) { drawFlood(g); drawDust(g, T, true); } else sceneBaseM(g, p, T);
  const L = HANG + pull.ext - C.y, S = Object.assign({}, FIN, { rot: ROT(), tipY: HANG + pull.ext, sw: pull.drag || pull.ext !== 0 ? Math.atan2(pull.dx * 0.6, L) : STILL ? 0 : 0.0065 * Math.sin(T * 0.9) + 0.003 * Math.sin(T * 1.9 + 1) });   // 坠子平时很轻地摆
  if (p > 0) {
    S.r = lerp(R, 5.5 * U, smoother((p - 0.04) / 0.5)); S.pm = 1 - sstep(0, 0.3, p); S.y0 = C.y + lerp(0.235 * R, 5.5 * U, sstep(0, 0.35, p)); S.ra = 1 - sstep(0.08, 0.6, p); S.cq = 0; S.band = GK > 0.001;
    S.PL = BM.map(o => o.e0 >= 0.5 ? null : o); const nf = 1 - sstep(0, 0.35, p); S.K = Object.assign({}, KFIN, { nd: ND.map(() => nf), r0: RR, la: 1 - EM });
  } else if (!STILL) { const cyc = (T + 4) % 10.4; if (cyc < 0.85) { S.PL = RING.slice(); S.PL[ODD] = Object.assign({}, RING[ODD], { ph: RING[ODD].ph + smoother(cyc / 0.85) }); }   // 灰的那只隔一阵扇一下
    if (RT.length) { const cy = T % 15, al = 0.85 * (1 - sstep(9, 13, cy)); if (al > 0.01) S.rt = { pts: RT[Math.floor(T / 15) % RT.length], pr: clamp(cy / 8, 0, 1), al }; } }   // 窗棂里有一根被极慢地重描一遍
  if (LV) { S.PL = []; IT = IT.filter(q => q.t !== 8); }   // 飞进圆里的燕子另画
  dual(g, l => drawSound(g, T, 1, l)); drawRings(g, 1, T); drawTrails(g, 1 - sstep(0, 0.45, p), T);
  sceneEye(g, S, T);
  if (!STILL && p <= 0 && pull.ext === 0 && !pull.drag) { const cz = T % 26; if (cz < 6) { const y = lerp(TD[0][0], TD[2][0], Math.pow(cz / 6, 2)); g.fillStyle = BLUE; g.beginPath(); g.arc(C.x, y, 1.3 * U * Math.min(1, cz * 2), 0, TAU); g.fill(); } }   // 泪线上的墨点很久才往下滑一颗
  smallBirds(g, 1 - sstep(0, 0.4, p)); dual(g, l => homeTexts(g, 1, l));
  drawRail(g, dial.open ? { txa: 1 - 0.9 * clamp(dial.e, 0, 1) } : {}); drawParticles(g);   // 转盘开着时入口的字让开
}

/* ---------- 衔接 ---------- */
const T_BRK = 3.0, T_FLY = 3.35, T_OPEN = 3.85, T_SK = 4.6, T_B = 4.5;
const TKEY = [[0.1, 0], [0.5, 0.30], [0.82, 0.30], [1.2, 0.64], [1.45, 0.585], [1.75, 0.585], [2.15, 0.93], [2.5, 0.93], [2.8, 1], [99, 1]];   // 泪线一松一紧：快放、顿住、再放、回弹一点、再放
function tipF(t) { if (t <= TKEY[0][0]) return 0; for (let i = 1; i < TKEY.length; i++) if (t < TKEY[i][0]) return lerp(TKEY[i - 1][1], TKEY[i][1], smoother((t - TKEY[i - 1][0]) / (TKEY[i][0] - TKEY[i - 1][0]))); return 1; }
let BS = { t: 0, x: 0.16, v: 0 };
function birdSc(t) {   // 线头那只的大小跟着线速走：放得快时被拉大，顿住时缩回去，弹簧式地过冲
  if (t < BS.t) BS = { t: 0, x: 0.16, v: 0 }; const h = 1 / 240;
  while (BS.t + h <= t) { const sp = (tipF(BS.t + h) - tipF(BS.t)) / h, tg = lerp(0.16, 0.45, clamp(sp / 1.45, 0, 1)); BS.v += (-230 * (BS.x - tg) - 13 * BS.v) * h; BS.x += BS.v * h; BS.t += h; }
  return clamp(BS.x, 0.1, 0.52);
}
function tbird(t, tipY) {   // 领头那只：吊在线头被一松一紧地放下去、挣脱、沿泪线往上、穿过闭眼弧、落在上睑
  const y1 = lidY(), o = { path: null, syy: 1, halo: 0, al: 1 };
  if (t < T_BRK) { if (t < 0.12) return null; const k = sstep(0.12, 0.3, t), sc = birdSc(t), rl = clamp((sc - 0.27) / 0.05, -1, 1), len = 100 * sc * U;   // 大的时候是俯冲的剪影，小的时候收翅；在最薄的一帧上换形
    const tw = Math.exp(-Math.pow((t - 0.66) / 0.08, 2)) + Math.exp(-Math.pow((t - 1.6) / 0.08, 2)) + Math.exp(-Math.pow((t - 2.35) / 0.08, 2)) + 0.8 * Math.exp(-Math.pow((t - 2.88) / 0.07, 2));   // 顿住时挣一下
    const hd = PI / 2 + Math.sin(t * 2.6) * 0.08 + tw * 0.16 * Math.sin(t * 40);
    return Object.assign(o, { x: C.x + Math.cos(hd) * len * k, y: tipY + Math.sin(hd) * len * k, hd, sc: sc * U * k, ph: 0.7 + tw * 0.5, path: rl > 0 ? E1 : null, syy: Math.abs(rl) < 0.08 ? (rl < 0 ? -0.08 : 0.08) : rl }); }
  const s0 = birdSc(T_BRK) * U, len = 100 * s0;
  if (t < T_FLY) { const v = (t - T_BRK) / (T_FLY - T_BRK), hd = PI / 2 + PI * sstep(0.35, 1, v), l = len * (1 - sstep(0.4, 1, v)), sh = Math.sin(t * 55) * 2 * U * (1 - v);   // 最小的时候猛地变大，扇两下掉过头
    return Object.assign(o, { x: C.x + Math.cos(hd) * l + sh, y: tipY + Math.sin(hd) * l, hd, sc: lerp(s0, 0.36 * U, backOut(v)), ph: 0.7 + 2 * smoother(v), syy: -1 + 2 * sstep(0, 0.3, v) || 0.08 }); }
  if (t < T_OPEN) { const v = (t - T_FLY) / (T_OPEN - T_FLY), e = v * v * 0.72 + v * 0.28;   // 沿泪线冲上去
    return Object.assign(o, { x: C.x + Math.sin(v * TAU) * 4 * U * (1 - v), y: lerp(tipY, y1, e), hd: -PI / 2 + Math.cos(v * TAU) * 0.08 * (1 - v), sc: 0.36 * U, ph: 2.7 + (t - T_FLY) * 6.5 }); }
  const v = clamp((t - T_OPEN) / 0.9, 0, 1); if (v >= 1) return BIG;
  const e = 1 - Math.pow(1 - v, 2.1), m = 1 - e, c1 = [C.x, y1 - 70 * U], c2 = [BIG.x - Math.cos(BIG.hd) * 70 * U, BIG.y - Math.sin(BIG.hd) * 70 * U];
  const x = m * m * m * C.x + 3 * m * m * e * c1[0] + 3 * m * e * e * c2[0] + e * e * e * BIG.x, y = m * m * m * y1 + 3 * m * m * e * c1[1] + 3 * m * e * e * c2[1] + e * e * e * BIG.y;
  const dx = 3 * m * m * (c1[0] - C.x) + 6 * m * e * (c2[0] - c1[0]) + 3 * e * e * (BIG.x - c2[0]), dy = 3 * m * m * (c1[1] - y1) + 6 * m * e * (c2[1] - c1[1]) + 3 * e * e * (BIG.y - c2[1]);
  const run = 2.7 + (T_OPEN - T_FLY) * 6.5 + 4.4 * (v - 0.55 * v * v), tgt = BIG.ph + Math.ceil(2.7 + (T_OPEN - T_FLY) * 6.5 + 4.4 * 0.45 - BIG.ph);
  return Object.assign(o, { x, y, hd: Math.atan2(dy, dx), sc: lerp(0.36 * U, BIG.sc, sstep(0, 1, v)), ph: lerp(run, tgt, sstep(0.5, 1, v)), halo: sstep(0.85, 1, v) });
}
function tr(t) {
  const S = { rot: 0 };
  S.o = smoother((t - T_OPEN) / 0.55); S.y0 = lerp(lidY(), C.y + 0.235 * R, S.o);
  S.tipY = lerp(lidY(), HANG, tipF(t)); S.pd = t > T_SK ? backOut((t - T_SK) / 0.4) : 0;   // 线放到头，末端冒出小坠子
  const ln = settle((t - 0.6) / 0.9, 1.8 * U), aa = settle((t - 1.2) / 0.8, 1.6 * U), bb = settle((t - 2.3) / 0.75, -1.6 * U);
  S.K = { line: t > 0.6 ? 1 : 0, lo: (ln[0] - 1) * 960 * U + ln[1], rail: sstep(1.9, 3.0, t) * 0.4 + clamp((t - 1.9) / 1.1, 0, 1) * 0.6, dot: clamp((t - 1.7) / 0.6, 0, 1),
    axOn: t > 1.2 ? 1 : 0, ax: (aa[0] - 1) * 1.15 * W + aa[1], bxOn: t > 2.3 ? 1 : 0, bx: (1 - bb[0]) * 1.2 * W + bb[1], nd: ND.map(n => t < n[3] ? 0 : backOut((t - n[3]) / 0.24)) };
  S.blk = smoother((t - (T_OPEN - 0.15)) / 0.55);   // 先是黑块从上边框垂下来，再月亮从瞳仁处长开
  S.r = R * (1 - Math.pow(1 - clamp((t - T_OPEN - 0.25) / 0.8, 0, 1), 1.7)); S.pm = t < T_OPEN + 0.45 ? 0 : backOut((t - T_OPEN - 0.45) / 0.26);
  S.PL = []; for (let i = 1; i < RING.length; i++) S.PL.push(ringT(i, t)); S.PL.push(tbird(t, S.tipY));
  S.sk = NPRE + (UN.length - NPRE) * (sstep(T_SK, T_SK + 1.0, t) * 0.5 + clamp((t - T_SK) / 1.0, 0, 1) * 0.5);
  const fb = BD.find(b => b.rank === 0);
  S.bov = BD.map(b => { if (b === fb) return { x: b.x, y: b.y, ang: b.ang, sc: t < T_B ? 0 : backOut((t - T_B) / 0.4) };   // 焦点那颗先长出来，其余从它身上沿轨道滑开
    const e = smoother((t - (T_B + 0.15 + b.rank * 0.08)) / 0.45), ang = angOf(FS + (b.se - FS) * e) * RAD; return { x: C.x + Math.cos(ang) * RR, y: C.y + Math.sin(ang) * RR, ang, sc: e }; });
  S.txa = sstep(4.95, 5.6, t); S.sba = sstep(4.85, 5.35, t); S.tra = clamp((t - 4.7) / 0.8, 0, 1); S.sta = 1 - sstep(0.1, 0.9, t);
  return S;
}
function paintTrans(p, T) {
  if (REDUCED) { paintSplash(); g.globalAlpha = smoother(p); paintHome(T); g.globalAlpha = 1; grainOver(); return; }
  const t = p * DUR, S = tr(t);
  sketchTo(S.sk); sceneBase(g, S);
  splashText(g, S.sta);
  if (S.tra > 0.002) { drawRings(g, S.tra, T); drawTrails(g, S.tra, T); }
  sceneEye(g, S, T);
  drawSound(g, T, S.txa); smallBirds(g, S.sba); homeTexts(g, S.txa);
  drawRail(g, S);
  g.fillStyle = BLUE; g.beginPath();
  for (let i = 0; i < NM; i++) { const b = BD[MI[i]], o = S.bov[b.j]; if (o.sc < 0.05 || SZ[i] <= 0) continue; const ca = Math.cos(o.ang - b.ang), sa = Math.sin(o.ang - b.ang), dx = RX[i] - b.x, dy = RY[i] - b.y; dot(g, o.x + (dx * ca - dy * sa) * o.sc, o.y + (dx * sa + dy * ca) * o.sc, SZ[i] * o.sc); }
  g.fill();
}

/* ---------- 转盘：纸白的大圆盘从左下角转进来，只露右上一段扇面。盘沿十二只燕子连拍、内圈月相，字沿盘边径向排 ---------- */
const dial = { open: false, k: -1, e: 0, ev: 0, to: 0, rot: 0, rv: 0, tgt: 0, drag: false, la: 0, lt: 0, moved: 0, sx0: 0, sy0: 0, t0: 0, inDisc: false };
const PA = -45, kOf = m => (1 - Math.cos(TAU * m / 12)) / 2;
let DR = 208, DRD = 360, DRM = 150, DCX = 0, DCY = 0, MOONS = null;
function moonGrain(g, r, k, col, Rn) {
  g.fillStyle = col; if (k > 0.004) { litPath(g, r, Math.min(k, 0.9999)); g.fill(); }
  if (k >= 0.985) return; const n = Math.round(r * r * 5); g.beginPath();
  for (let i = 0; i < n; i++) { const a = Rn() * TAU, q = Math.sqrt(Rn()), u = Math.cos(a) * q, v = Math.sin(a) * q, hw = Math.sqrt(1 - v * v), xt = -(2 * k - 1) * hw; if (u > xt) continue;
    const dd = (xt - u) / (xt + hw + 1e-6), pr = k < 0.02 ? 0.10 + 0.5 * Math.pow(q, 9) : Math.pow(1 - dd, 1.7) * 0.85 + 0.25 * Math.pow(q, 14); if (Rn() > pr) continue; dot(g, u * r, v * r, (0.3 + Rn() * 0.35) * U); }
  g.fill();
}
function buildDial() { const Rn = rng(20261110), rm = 9 * U, s = rm * 2 + 6; MOONS = [];
  for (let m = 0; m < 12; m++) { const [c, x] = mkCanvas(s, s); x.translate(s / 2, s / 2); if (m > 6) x.rotate(PI); moonGrain(x, rm, kOf(m), BLUE, Rn); c._s = s; MOONS.push(c); } }
const dItems = () => dial.k >= 0 ? ENTRY[dial.k].items : [];
const rotMin = () => -(dItems().length - 1) * 30;
const dispRot = () => { const r = dial.rot, mn = rotMin(); return r > 0 ? r * 0.35 : r < mn ? mn + (r - mn) * 0.35 : r; };
const activeIdx = () => clamp(Math.round(-dispRot() / 30), 0, Math.max(0, dItems().length - 1));
const dialCx = () => DCX - (1 - dial.e) * DRD * 0.9;
const dialCy = () => DCY + (1 - dial.e) * DRD * 0.9;
function openDial(k, rot) { if (!MOONS) buildDial(); if (dial.k >= 0) dialAcc += dispRot() * 0.25; dial.open = true; dial.k = k; dial.to = 1; dial.rot = rot || 0; dial.tgt = clamp(Math.round((rot || 0) / 30) * 30, rotMin(), 0); dial.rv = 0; dial.drag = false; document.body.classList.add('dial'); syncGo(); }
function closeDial() { dial.to = 0; dial.drag = false; document.body.classList.remove('dial'); }
function syncGo() { const it = dItems()[activeIdx()]; if (it) goEl.setAttribute('href', it[1]); }
function stepDial(dt) {
  const K = 120, Cc = dial.to ? 13.5 : 22; dial.ev += (-K * (dial.e - dial.to) - Cc * dial.ev) * dt; dial.e += dial.ev * dt;
  if (!dial.to && dial.e < 0.004 && Math.abs(dial.ev) < 0.05) { dialAcc += dispRot() * 0.25; dial.rot = dial.tgt = 0; dial.open = false; dial.e = 0; dial.ev = 0; dial.k = -1; return; }
  if (!dial.drag) { dial.rv += (-150 * (dial.rot - dial.tgt) - 17 * dial.rv) * dt; dial.rot += dial.rv * dt; if (Math.abs(dial.rot - dial.tgt) < 0.02 && Math.abs(dial.rv) < 0.3) { dial.rot = dial.tgt; dial.rv = 0; } }
  syncGo();
}
const dialBusy = () => dial.open && (dial.drag || Math.abs(dial.e - dial.to) > 0.0015 || Math.abs(dial.ev) > 0.01 || dial.rot !== dial.tgt);
const norm = a => { a %= 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; };
function drawDial() {
  const cx = dialCx(), cy = dialCy(), rd = dispRot() + (1 - dial.e) * -150, en = ENTRY[dial.k], ek = clamp(dial.e, 0, 1), seen = a => { a = norm(a); return a > -118 && a < 28; };
  const dk = FLK > 0.5; g.globalAlpha = (dk ? 0.6 : 0.46) * ek; g.fillStyle = dk ? INK : PAPER; g.fillRect(0, 0, W, H); g.globalAlpha = 1;   // 主体那一侧退淡一档（黑底上是压暗）
  g.fillStyle = FACE; g.beginPath(); g.arc(cx, cy, DRD, 0, TAU); g.fill();
  g.strokeStyle = LINE; g.lineWidth = 0.9; g.beginPath(); g.arc(cx, cy, DRD, 0, TAU); g.stroke();
  g.lineWidth = 0.4; g.beginPath(); g.arc(cx, cy, DRD - 4.5 * U, 0, TAU); g.moveTo(cx + DR - 36 * U, cy); g.arc(cx, cy, DR - 36 * U, 0, TAU); g.stroke();
  g.strokeStyle = GREY; g.lineWidth = 0.5; g.beginPath(); g.arc(cx, cy, DR + 32 * U, 0, TAU); g.moveTo(cx + DRM - 24 * U, cy); g.arc(cx, cy, DRM - 24 * U, 0, TAU); g.stroke();
  g.strokeStyle = LINE; g.lineWidth = 0.5; g.beginPath();   // 盘沿的刻度跟着盘转
  for (let i = 0; i < 60; i++) { const a = PA + rd + i * 6; if (!seen(a)) continue; const c = Math.cos(a * RAD), s = Math.sin(a * RAD), l = (i % 5 ? 3 : 8) * U; g.moveTo(cx + c * (DRD - 4.5 * U), cy + s * (DRD - 4.5 * U)); g.lineTo(cx + c * (DRD - 4.5 * U - l), cy + s * (DRD - 4.5 * U - l)); }
  g.stroke();
  g.fillStyle = LINE; g.beginPath(); for (let i = 0; i < 120; i++) { const a = (PA + rd + i * 3) * RAD; if (!seen(PA + rd + i * 3)) continue; dot(g, cx + Math.cos(a) * (DRM - 40 * U), cy + Math.sin(a) * (DRM - 40 * U), 0.5 * U); } g.fill();
  for (let k = 0; k < 12; k++) { const a = PA + rd + k * 30; if (!seen(a)) continue; const m = ((-k % 12) + 12) % 12, mc = MOONS[m];   // 一圈十二帧：盘每过一格，同一个位置上的燕子换一帧
    g.save(); g.translate(cx, cy); g.rotate((a + 90) * RAD);
    g.save(); g.translate(0, -DR); g.scale(0.21 * U, 0.21 * U); g.fillStyle = BLUE; g.fill(FB[m * NFR / 12]); g.restore();
    g.drawImage(mc, -mc._s / 2, -DRM - mc._s / 2, mc._s, mc._s); g.restore(); }
  dItems().forEach((it, j) => {   // 只有正对指针的那一格看得清
    const a = norm(j * 30 + rd), al = 0.03 + 0.97 * Math.exp(-Math.pow(Math.abs(a) / 24, 2)); if (al < 0.045 || !seen(PA + a)) return;
    g.save(); g.translate(cx, cy); g.rotate((PA + a) * RAD); g.globalAlpha = al; txt(g, it[0], DR + 42 * U, 4.5 * UF, fz(12.5), LINE, 2 * UF); g.restore(); });
  g.globalAlpha = 1;
  const pc = Math.cos(PA * RAD), ps = Math.sin(PA * RAD);
  g.strokeStyle = LINE; g.lineWidth = 0.4; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(cx + pc * (DRM - 40 * U), cy + ps * (DRM - 40 * U)); g.lineTo(cx + pc * (DR + 40 * U), cy + ps * (DR + 40 * U)); g.stroke(); g.globalAlpha = 1;
  g.save(); g.translate(cx + pc * (DRD + 5 * U), cy + ps * (DRD + 5 * U)); g.rotate(PA * RAD); g.fillStyle = dk ? PAPER : BLUE; g.beginPath(); g.moveTo(0, 0); g.lineTo(9 * U, -4.5 * U); g.lineTo(9 * U, 4.5 * U); g.closePath(); g.fill(); g.restore();
  const hx = cx + pc * (DRD + 24 * U), hy = cy + ps * (DRD + 24 * U) + 4 * U; g.globalAlpha = ek;
  txt(g, en.en, hx, hy, fe(16, 1), dk ? PAPER : BLUE, 0.4); txt(g, en.zh, hx + 0.5, hy + 14 * U, fz(8.5), dk ? PAPER : LINE, 3.2 * UF); txt(g, (activeIdx() + 1) + ' / ' + dItems().length, hx, hy + 27 * U, fe(9.5, 1), dk ? LGREY : PEN, 1); g.globalAlpha = 1;
}
const dAng = (x, y) => Math.atan2(y - dialCy(), x - dialCx()) / RAD;
function dialDown(x, y, now) { const d = dial; d.sx0 = x; d.sy0 = y; d.t0 = now; d.moved = 0; d.inDisc = Math.hypot(x - dialCx(), y - dialCy()) <= DRD; if (d.inDisc) { d.drag = true; d.rot = dispRot(); d.la = dAng(x, y); d.lt = now; d.rv = 0; } }
function dialMove(x, y, now) { const d = dial; d.moved = Math.max(d.moved, Math.hypot(x - d.sx0, y - d.sy0)); if (!d.drag) return;
  let a = dAng(x, y), da = a - d.la; if (da > 180) da -= 360; if (da < -180) da += 360;
  d.rot += da; d.la = a; const dt = Math.max(0.004, now - d.lt); d.rv = lerp(d.rv, da / dt, 0.45); d.lt = now; }
function dialUp(x, y, now) { const d = dial, n = dItems().length;
  if (d.drag) { d.drag = false; if (now - d.lt > 0.09) d.rv = 0; d.rot = dispRot(); d.rv = clamp(d.rv, -900, 900); d.tgt = -clamp(Math.round(-(d.rot + d.rv * 0.16) / 30), 0, n - 1) * 30; }   // 只吸附到有内容的格
  const tap = d.moved < 9 * U && now - d.t0 < 0.4;
  if (tap && d.inDisc) { const a = norm(dAng(x, y) - PA), j = Math.round((a - d.rot) / 30), rr = Math.hypot(x - dialCx(), y - dialCy());
    if (Math.abs(a) < 13 && rr > DR * 1.1 && Math.abs(d.rot - d.tgt) < 3) { syncGo(); goEl.click(); }
    else if (j >= 0 && j < n && rr > DR * 0.7) d.tgt = -j * 30; }
  else if (!d.inDisc && (tap || (y - d.sy0 > 60 * U && Math.abs(y - d.sy0) > Math.abs(x - d.sx0) * 1.4))) closeDial();
}

/* ---------- 进出聊天页、听歌页：焦点月亮鼓成满月一直放大到盖满全屏，燕子朝圆心飞进去；回来时满屏的圆缩回成那颗入口月亮 ---------- */
const LVD = 0.82, BKD = 0.68, PAGES = { 'chat.html': 'chat', 'listen.html': 'listen' };
let LV = null, BKV = null, FONTOK = false;
const ssGet = k => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const ssSet = (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
function leaveTo(href, now) {
  if (LV) return; const j = dial.k >= 0 ? dial.k : BD.reduce((a, b) => b.c > a.c ? b : a, BD[0]).j, b = BD[j], kind = PAGES[href], dkHome = mor.base === 1 && mor.p > 0.5;
  const pageDark = dkHome;
  LV = { t0: now, href, kind, j, x: b.x, y: b.y, r: Math.max(6 * U, b.r * b.sc), fill: pageDark ? INK : PAPER, dkHome, pageDark, done: false, Rm: Math.hypot(Math.max(b.x, W - b.x), Math.max(b.y, H - b.y)) * 1.06 };
  if (dial.open) closeDial(); ptr.on = false;
}
function wetDisc(g, x, y, r, col, seed, k) {   // 一个圆：实心，边上一圈颗粒由密到疏化开（湿边）
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (r < 2 || k <= 0) return;
  const bw = clamp(r * 0.09, 3 * U, 26 * U) * k, n = Math.min(2600, Math.round(r * 2.2)), Rn = rng(seed); g.beginPath();
  for (let i = 0; i < n; i++) { const a = Rn() * TAU, q = Math.pow(Rn(), 1.8), rr = r + q * bw, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (px < -4 || px > W + 4 || py < -4 || py > H + 4) { Rn(); continue; } dot(g, px, py, (0.35 + 0.6 * Rn() * (1 - q)) * U); }
  g.fill();
}
function irisDisc(g, x, y, r, rin, fill, T) {   // 蓝的满月，里面一圈目标页的底色往外长，最后只剩一道颗粒蓝边
  wetDisc(g, x, y, r, BLUE, 31, 1);
  if (rin > 0.5) { wetDisc(g, x, y, rin, fill, 57, 1); }
  if (rin > 0.5 && r - rin > 1.5 * U) { g.fillStyle = fill; g.beginPath(); const n = Math.min(1600, Math.round((r - rin) * r * 0.25)), Rn = rng(91); for (let i = 0; i < n; i++) { const a = Rn() * TAU, q = Rn(); if (Rn() > Math.pow(1 - q, 3) * 0.7) continue; const rr = rin + q * (r - rin); dot(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (0.3 + 0.4 * Rn()) * U); } g.fill(); }
}
function flyIn(g, list, cx, cy, p, inR, onDark, fill) {   // 燕子一只只朝圆心飞进去，越飞越小
  list.forEach((o, i) => { if (!o || o.al < 0.01 || o.dotr) return; const dl = 0.04 + 0.32 * hash(i * 3.7 + 1), e = smoother((p - dl) / 0.55); if (e >= 0.995) return;
    const dx = cx - o.x, dy = cy - o.y, L = Math.hypot(dx, dy) || 1, bend = Math.sin(PI * e) * L * 0.22 * (hash(i) > 0.5 ? 1 : -1), x = o.x + dx * e - dy / L * bend, y = o.y + dy * e + dx / L * bend;
    const hdT = Math.atan2(dy, dx), hd = o.hd + wrapA(hdT - o.hd) * sstep(0, 0.35, e), sc = o.sc * Math.pow(1 - e, 1.3), cs = Math.cos(hd), syy = (cs < 0 ? -1 : 1) * Math.max(0.5, Math.min(1, Math.abs(cs) * 3));
    const inside = Math.hypot(x - cx, y - cy) < inR, col = inside ? (fill === PAPER ? BLUE : PAPER) : onDark ? PAPER : BLUE;
    g.globalAlpha = o.al; birdFill(g, { x, y, hd, sc, syy, ph: o.ph + p * 3, path: null, grey: o.grey }, col); });
  g.globalAlpha = 1;
}
function drawLeave(now, pin) {
  const L = LV, p = pin !== undefined ? pin : clamp((now - L.t0) / LVD, 0, 1), e = smoother(p), r = L.r * Math.pow(L.Rm / L.r, e), rin = sstep(0.04, 0.3, p) * Math.max(r * 0.86, r - 11 * U);   // 先鼓成一颗蓝满月，再从里往外换成目标页的底色，只剩一道细蓝边
  irisDisc(g, L.x, L.y, r, rin, L.fill);
  flyIn(g, L.dkHome ? (BM.length ? BM : RING) : RING, L.x, L.y, p, rin, L.dkHome, L.fill);
  if (p >= 1 && pin === undefined && L.done && !L.went && ++L.held >= 3) { L.went = true;   // 满屏的那一帧已经画上屏两帧了，再跳
    const rc = cv.getBoundingClientRect();
    ssSet('ta-hand', { to: L.kind, x: rc.left + L.x, y: rc.top + L.y, morph: L.dkHome ? 1 : 0, slot: L.j, dark: L.pageDark ? 1 : 0, c: L.fill, t: Date.now() });
    setSide(L.dkHome); const q = '?dark=' + (L.pageDark ? 1 : 0); location.href = L.href + q; }
  else if (p >= 1 && pin === undefined && !L.done) { L.done = true; L.held = 0; }
}
function drawBack(now, pin) {
  const B = BKV; if (B.t0 === null && FONTOK) B.t0 = now; const p = pin !== undefined ? pin : B.t0 === null ? 0 : clamp((now - B.t0) / BKD, 0, 1), b = BD[B.slot] || BD[0], r0 = Math.max(6 * U, b.r * b.sc), Rm = Math.hypot(Math.max(b.x, W - b.x), Math.max(b.y, H - b.y)) * 1.06;
  const e = smoother(p), r = Rm * Math.pow(r0 / Rm, e), fill = B.dark ? INK : PAPER, rim = r * lerp(0.02, 0.5, sstep(0.55, 1, p));
  g.globalAlpha = 1 - sstep(0.82, 1, p); irisDisc(g, b.x, b.y, r, Math.max(0, r - rim), fill); g.globalAlpha = 1;
  if (p >= 1 && pin === undefined) BKV = null;
}
{ const h = ssGet('ta-back'); if (h && Date.now() - h.t < 20000 && NOSPLASH) { BKV = { t0: null, slot: clamp(h.slot | 0, 0, 4), dark: !!h.morph }; } ssSet('ta-back', null); }
goEl.addEventListener('click', ev => { const h = goEl.getAttribute('href'); if (PAGES[h]) { ev.preventDefault(); leaveTo(h, performance.now() / 1000); } });

/* ---------- 入口的 a 标签（Tab 可达；触摸走画布，再转给它们） ---------- */
function placeNav() {
  if (!navEl.children.length) ENTRY.forEach((e, i) => { const a = document.createElement('a'); a.href = e.items[0][1]; a.textContent = e.en + ' ' + e.zh; a.setAttribute('aria-label', e.en + ' ' + e.zh);
    a.addEventListener('click', ev => { const b = BD[i];
      if (b.c < 0.9 || Math.abs(rail.off - rail.tgt) > 0.02) { ev.preventDefault(); rail.v = 0; rail.tgt = Math.round(rail.off + railDelta(b.s)); return; }   // 不在焦点：先转过去
      if (e.items.length > 1) { ev.preventDefault(); if (!dial.open) openDial(i); } });
    navEl.appendChild(a); });
}
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  W = Math.round(Math.min(vw, vh * 0.62)); H = vh; stage.style.width = W + 'px';
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  U = clamp(W / 430, 0.6, 1.8); UF = clamp(U, 0.92, 1.3);
  R = 0.195 * W; RO = 1.55 * R; US = RO / 185; C.x = C0x = 0.70 * W; MX = C0x + 0.034 * W; MP = EC = EM = GK = SK = LK = 0; Rm = 0.175 * W; BW = 0.045 * W; DOFF = 0.045 * W; Rs = 0.69 * W; PULLD = 0.18 * H; C.y = Math.max(0.35 * H, 250 * U); RR = 1.8 * R; RDX = RDY = 0; FL3 = 0.6 * W; JTOP = 1e9; LT0 = 0; RMAX = Math.hypot(Math.max(C.x, W - C.x), Math.max(C.y, H - C.y)); FLK = FLR = 0; setPose(0, true);   // 月亮直径约屏宽 39%，在右上；第二态的环宽约屏宽五成
  BLK.x = 0.68 * W; BLK.y1 = C.y + 120 * U;   // 黑块：左边直边正好切过月亮，底在月亮下面一点
  DR = 172 * U; DRD = 298 * U; DRM = 124 * U; DCX = -30 * U; DCY = H + 20 * U;
  buildEye(); buildSketch(); buildAux(); buildGeo(); buildPaper(); buildBlock(); buildDisc(); buildMorph(); buildDust(); buildDebris(); buildMorphSketch(); MOONS = null; homeCv = splashCv = darkCv = null;
  sketchTo(NPRE); beads(); placeNav();
}

/* ---------- 状态与循环 ---------- */
let mode = 'splash', t0 = 0, lastMs = 0, raf = 0, T0 = performance.now() / 1000, FT = 0;
function setHome() { mode = 'home'; document.body.classList.add('home'); homeCache(); splashCv = null; }
function startTrans(now) { if (mode !== 'splash') return; mode = 'trans'; t0 = now; }
function frame(ms) {
  raf = requestAnimationFrame(frame);
  const now = ms / 1000, active = !!LV || !!BKV || mode === 'trans' || awake > 0 || now - ptr.last < 1.2 || dialBusy() || railBusy() || morBusy();
  if (!active && ms - lastMs < 32) return;
  const dt = Math.min(0.05, Math.max(0.001, (ms - lastMs) / 1000)); lastMs = ms;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const T = Math.max(0, now - T0);
  if (mode === 'splash') { paintSplash(); return; }
  if (mode === 'trans') { const p = (now - t0) / DUR; if (p >= 1) { restAll(); setHome(); } else { paintTrans(p, T); if (!REDUCED) grainOver(); return; } }
  const f0 = performance.now(); stepMorph(Math.min(dt, 0.034)); applyMorph(T);
  stepRail(Math.min(dt, 0.034)); rail.br = rail.drag ? rail.br : Math.sin(T * 0.3) * RAD; syncRail();   // 入口月亮 ±1° 极慢地来回
  step(dt); stepRings(dt, ROT());
  paintHome(T);
  if (dial.open) { stepDial(Math.min(dt, 0.034)); if (dial.open) drawDial(); }
  if (LV) drawLeave(now); if (BKV) drawBack(now);
  grainOver(); FT += (performance.now() - f0 - FT) * 0.1;
  if (window.__taUnpre) { const u = window.__taUnpre; window.__taUnpre = null; requestAnimationFrame(() => requestAnimationFrame(u)); }   // 从子页回来：盖满的第一帧已画好，才让 body 显出来
}
function renderStill() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); const T = 3;
  if (TPIN !== null && TPIN < 1) { mode = 'trans'; paintTrans(TPIN, T); grainOver(); navEl.style.display = 'none'; }
  else if (TPIN !== null || NOSPLASH) {
    setHome(); applyMorph(T); restAll(); stepRings(0, ROT()); paintHome(T);
    if (DIALQ) { const k = ENTRY.findIndex(e => e.k === DIALQ && e.items.length > 1); if (k >= 0) { openDial(k, ROTQ || 0); dial.rot = ROTQ || 0; dial.e = 1; dial.ev = 0; drawDial(); } }
    if (Q.has('lvp')) { leaveTo((Q.get('lvto') || 'chat') + '.html', 0); g.setTransform(dpr, 0, 0, dpr, 0, 0); paintHome(T); drawLeave(0, clamp(+Q.get('lvp'), 0, 1)); }
    if (Q.has('bkp') && !BKV) BKV = { t0: 0, slot: SLOTQ || 0, dark: MORPHQ !== null && MORPHQ >= 0.5 };
    if (BKV && Q.has('bkp')) drawBack(0, clamp(+Q.get('bkp'), 0, 1));
    grainOver();
  } else paintSplash();
}
function boot() { layout(); initParticles(); if (NOSPLASH && TPIN === null) setHome(); }
function go() { if (STILL) renderStill(); else { cancelAnimationFrame(raf); lastMs = performance.now(); raf = requestAnimationFrame(frame); } }
const xy = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
cv.addEventListener('pointerdown', ev => {
  if (STILL || LV || BKV) return; const [x, y] = xy(ev), now = performance.now() / 1000;
  if (mode === 'splash') { startTrans(now); return; }
  if (mode !== 'home') return;
  if (dial.open) { try { cv.setPointerCapture(ev.pointerId); } catch (_) {} dialDown(x, y, now); ptr.down = true; return; }
  if (pullHit(x, y)) { try { cv.setPointerCapture(ev.pointerId); } catch (_) {} pull.drag = true; pull.sy = y - pull.ext; pull.sx = x - pull.dx; pull.v = 0; ptr.on = false; ptr.last = now; return; }
  rail.hit = railHit(x, y);
  if (rail.hit !== -1) { try { cv.setPointerCapture(ev.pointerId); } catch (_) {} railDown(x, y, now); ptr.last = now; return; }
  ptr.x = x; ptr.y = y; ptr.on = true; ptr.last = now;
});
cv.addEventListener('pointermove', ev => { if (mode !== 'home') return; const [x, y] = xy(ev), now = performance.now() / 1000;
  if (dial.open) { if (ptr.down) dialMove(x, y, now); return; } if (pull.drag) { pullMove(x, y); ptr.last = now; return; } if (rail.drag) { railMove(x, y, now); ptr.last = now; return; } ptr.x = x; ptr.y = y; ptr.on = true; ptr.last = now; });
const ptrEnd = ev => { const [x, y] = xy(ev), now = performance.now() / 1000;
  if (pull.drag) { pullUp(); return; }
  if (rail.drag) { railUp(x, y, now, ev.type === 'pointerup'); return; }
  if (ptr.down) { ptr.down = false; if (dial.open) { if (ev.type === 'pointerup') dialUp(x, y, now); else { dial.drag = false; dial.rot = dispRot(); } } }
  if (ev.pointerType !== 'mouse' || ev.type === 'pointerleave') ptr.on = false; };
cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd); cv.addEventListener('pointerleave', () => { if (!ptr.down && !rail.drag) ptr.on = false; });
window.addEventListener('keydown', ev => {
  if (STILL) return;
  if (mode === 'splash' && (ev.key === 'Enter' || ev.key === ' ')) startTrans(performance.now() / 1000);
  else if (dial.open) { const n = dItems().length, i = Math.round(-dial.tgt / 30);
    if (ev.key === 'Escape') closeDial(); else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') dial.tgt = -clamp(i + 1, 0, n - 1) * 30; else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') dial.tgt = -clamp(i - 1, 0, n - 1) * 30; else if (ev.key === 'Enter') { syncGo(); goEl.click(); } }
  else if (mode === 'home' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) rail.tgt = Math.round(rail.off) + (ev.key === 'ArrowRight' ? 1 : -1);
  else if (mode === 'home' && (ev.key === 'ArrowDown' || ev.key === 'm')) { mor.base = 1 - mor.base; mor.tgt = mor.base; setSide(mor.base === 1); }   // 键盘也能翻到第二态
});
document.addEventListener('visibilitychange', () => { if (STILL) return; if (document.hidden) cancelAnimationFrame(raf); else go(); });
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const m = mode; layout(); initParticles(); if (m !== 'splash') setHome(); go(); }, 120); });
window.__ta = { get mode() { return mode; }, get ft() { return FT; }, dial, rail, mor, pull, activeIdx, href: () => goEl.getAttribute('href'), units: () => [UN.length, NPRE, skN], rot: () => ({ rose: ROT(), rings: RG.map(q => q.cur) }),
  beads: () => BD.map(b => ({ j: b.j, x: b.x, y: b.y, r: b.r, s: b.s, c: b.c, lx: b.lx, ly: b.ly })), geo: () => ({ cx: dialCx(), cy: dialCy(), R: DR, RD: DRD, PA, W, H, C: { x: C.x, y: C.y, R }, RR }) };

boot(); go();
const fl = document.fonts && document.fonts.load ? Promise.all(['300 20px "Cormorant Garamond"', 'italic 300 20px "Cormorant Garamond"', 'italic 400 20px "Cormorant Garamond"', '400 12px "Noto Serif SC"', '300 12px "Noto Serif SC"'].map(f => document.fonts.load(f, 'touch 0123456789' + ZHALL).catch(() => 0))) : Promise.resolve();
Promise.race([fl, new Promise(r => setTimeout(r, 2800))]).then(() => { if (STILL) renderStill(); window.__ready = true; });
Promise.race([fl, new Promise(r => setTimeout(r, 1800))]).then(() => { FONTOK = true; });
/* 浏览器返回键从页面缓存恢复时，满屏的遮罩可能还停着：复位 */
window.addEventListener('pageshow', ev => { if (ev.persisted && LV) { LV = null; BKV = null; awake = 30; } if (ev.persisted && window.__taUnpre) window.__taUnpre(); });

/* ---------- 右下角的换皮肤邮票：入口从「小家」挪到这儿，跟左下角的日期对着 ---------- */
(() => {
  const W = 15, H = 19, n = 5, m = 6, r = W / (n * 2), r2 = H / (m * 2);
  let d = 'M0 0';   // 齿孔边：四边一串小半圆
  for (let i = 0; i < n; i++) d += ` a${r} ${r} 0 0 0 ${2 * r} 0`;
  for (let i = 0; i < m; i++) d += ` a${r2} ${r2} 0 0 0 0 ${2 * r2}`;
  for (let i = 0; i < n; i++) d += ` a${r} ${r} 0 0 0 ${-2 * r} 0`;
  for (let i = 0; i < m; i++) d += ` a${r2} ${r2} 0 0 0 0 ${-2 * r2}`;
  const COL = { day: ['#8b8b8b', '#a9a7a0', '#2238c0'], night: ['#b9b6ad', '#7d7b76', '#f1eee6'] };
  const a = document.createElement('a');   // 点按范围 44，邮票本身照样 15×19
  a.href = 'skin.html'; a.setAttribute('aria-label', '换皮肤');
  a.style.cssText = 'position:absolute;right:' + (26 - (44 - W) / 2) + 'px;bottom:' + (20 - (44 - H) / 2) + 'px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;z-index:5';
  a.innerHTML = `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" style="width:${W}px;height:${H}px;overflow:visible;transform:rotate(4deg)">
    <path class="sp-e" d="${d}Z" fill="none" stroke-width=".45"/>
    <rect class="sp-f" x="2.6" y="2.8" width="${W - 5.2}" height="${H - 5.6}" fill="none" stroke-width=".3"/>
    <path class="sp-m" d="M${W / 2 + 1.6} ${H / 2 - 2.6} a3.1 3.1 0 1 0 0 5.2 a2.3 2.3 0 1 1 0 -5.2Z"/>
  </svg>`;
  const [e, f, mo] = ['.sp-e', '.sp-f', '.sp-m'].map(q => a.querySelector(q));
  let side = null;
  const paint = () => { const s = mor.p >= 0.5 ? 'night' : 'day'; if (s === side) return; side = s; document.body.classList.toggle('dark', s === 'night'); const c = COL[s]; e.setAttribute('stroke', c[0]); f.setAttribute('stroke', c[1]); mo.setAttribute('fill', c[2]); };
  paint(); setInterval(paint, 150);   // 翻面时跟着换色；不进主循环，省得动 frame
  a.addEventListener('click', ev => { ev.preventDefault(); const night = mor.p >= 0.5; setSide(night); location.href = 'skin.html?dark=' + (night ? 1 : 0); });
  stage.appendChild(a);
})();
})();
