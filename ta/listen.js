/* 一起听：唱片就是从正上方看下去的旋转楼梯井。踏步沿一条对数螺线一圈圈绕向井心，播放时整盘顺时针转、踏步往井里流。
   外沿一条蓝丝带走进度（可拖），一只燕子落在丝带头上当唱针。歌词像台阶一样一行行往右下错开，随播放往上走。
   默认墨黑面；?dark=0 纸白面。
   11/12 接真歌（样子不动）：接第一只后台的网易云桥。
     POST {第一只}/app/music/{daily|me|likelist|playlists|tracks|recent|search|url|lyric|like}；
     换歌、播停、开回一起听时 POST /app/music/now {id, name, artist, state, together, force}，聊天页页眉的小音符读的就是它。
     钥匙读 localStorage 的 nyx_key，只放 Authorization 头，钥匙不进网址。
   ?demo=1：原来的样子稿，示例总长 3:40、按 5.5 倍走，不发任何请求。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, lerp, sstep, smoother, rng, hash, dot, birdP, PERCH, setupGrain, fitCanvas, spots, pencil, backMoon, homeInfo, revealIn, leaveHome, Q, REDUCED } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), cv = $('cv'), lyrEl = $('lyr'), au = $('au'), shelf = $('shelf'), rowsEl = $('rows');
const dark = Q.has('dark') ? Q.get('dark') !== '0' : (() => { try { return localStorage.getItem('ta_side') !== 'day'; } catch (e) { return true; } })();   // 网址没说就跟主页的面，没记过默认深
document.body.classList.toggle('dark', dark);
const PERCH2D = new Path2D(PERCH);
const LIVE = Q.get('demo') !== '1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

let DUR = 220; const SPEED = 5.5;   // 示例：3 分 40 秒；5.5 倍速，实际 40 秒走完
const DEMO_LYR = [   // 原创示例歌词，[开始秒数, 句子]
  [0, '楼梯往下绕了一圈'], [22, '井口有一点风'], [44, '你数到第七级就停下'], [68, '燕子从栏杆缝里穿过去'], [92, '我把钥匙放进左边口袋'],
  [116, '水声在更深的地方'], [140, '一圈一圈，月亮变小了'], [164, '你说再往下就是早晨'], [186, '那我们走慢一点'], [204, '等它绕回来']];
let LYR = LIVE ? [] : DEMO_LYR;

let W = 0, H = 0, g = null, CX = 0, CY = 0, R = 100, RB = 108, GX = 0, PY = 0, LX = 0, LY = 0, LH = 30;
const S = { t: LIVE ? 0 : 72, playing: false, phi: 0, omega: 0, flap: 0, cur: 0, drag: false, fold: 1 };

function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height; g = fitCanvas(cv, W, H);
  R = Math.round(Math.min(W * 0.31, H * 0.2)); CX = Math.round(W * 0.72); CY = Math.round(Math.max(H * 0.29, R + 96)); RB = R + 10;
  GX = Math.round(W * 0.2); PY = Math.round(H - 84);
  LX = Math.round(W * 0.1); LY = Math.round(CY + RB + Math.max(70, (PY - 150 - CY - RB) * 0.32)); LH = 24;   // v21 歌词小一档，行距跟着收
  $('song').style.top = '78px'; $('song').style.maxWidth = Math.round(CX - RB * 0.75 - 22) + 'px';
  lyrEl.style.top = (CY + RB + 34) + 'px'; lyrEl.style.height = (PY - 132 - (CY + RB + 34)) + 'px';
  $('msg').style.left = (LX + 24) + 'px'; $('msg').style.top = (LY - 10) + 'px'; $('msg').style.maxWidth = (W - LX - 40) + 'px';
  $('tog').style.left = (GX + 22) + 'px'; $('tog').style.top = (PY - 116) + 'px';
  const tg = $('tgl'); tg.style.left = (GX - 18) + 'px'; tg.style.top = (PY - 128) + 'px'; tg.style.width = '84px'; tg.style.height = '30px';
  $('tcur').style.left = Math.max(8, GX - 64) + 'px'; $('tcur').style.top = (PY + 26) + 'px';
  $('tall').style.left = (GX + 50) + 'px'; $('tall').style.top = (PY + 26) + 'px';
  $('tools').style.top = (PY + 16) + 'px';
  shelf.style.top = (CY + RB + 30) + 'px';
  const hit = (id, x, y, s) => { const e = $(id); e.style.left = Math.max(0, x - s / 2) + 'px'; e.style.top = (y - s / 2) + 'px'; e.style.width = e.style.height = s + 'px'; };
  hit('play', GX, PY + 2, 52); hit('prev', GX - 46, PY, 40); hit('next', GX + 46, PY, 40);
  RC = Math.round(R * 0.4); buildCover();
  buildLyrics(); buildBack(); draw();
}

/* ---------- 封面：裁成圆搁在正中当唱片芯，跟着盘一起转。没封面时芯里是原来的小蓝点 ---------- */
let RC = 40, coverSrc = null, coverCv = null, coverTok = 0;
function placeholderCover() {   // 样子稿的占位封面：纸白底，一个偏心蓝圆，一道墨黑竖条，几根细线，颗粒
  const n = 480, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), Rn = rng(2604);
  x.fillStyle = C.PAPER; x.fillRect(0, 0, n, n);
  x.fillStyle = C.BLUE; x.beginPath(); x.arc(n * 0.66, n * 0.33, n * 0.17, 0, TAU); x.fill();
  x.fillStyle = C.INK; x.fillRect(n * 0.3, n * 0.08, n * 0.075, n * 0.84);
  x.strokeStyle = C.INK; x.lineWidth = 1.6; x.beginPath();
  x.moveTo(n * 0.06, n * 0.7); x.lineTo(n * 0.94, n * 0.7); x.moveTo(n * 0.42, n * 0.76); x.lineTo(n * 0.9, n * 0.76); x.stroke();
  x.lineWidth = 1.2; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(n * 0.42, n * 0.15); x.lineTo(n * 0.88, n * 0.68); x.stroke();
  x.setLineDash([2, 7]); x.beginPath(); x.arc(n * 0.66, n * 0.33, n * 0.24, PI * 0.2, PI * 1.1); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
  x.fillStyle = C.INK; x.beginPath(); dot(x, n * 0.66, n * 0.33, 3.2); x.rect(n * 0.78 - 4, n * 0.7 - 4, 8, 8); x.fill();
  const dk = new Path2D(), lt = new Path2D(); for (let k = 0; k < 9000; k++) { const px = Rn() * n, py = Rn() * n, s = 0.5 + Rn() * 0.9; (Rn() < 0.6 ? dk : lt).rect(px, py, s, s); }
  x.fillStyle = 'rgba(22,23,28,0.22)'; x.fill(dk); x.fillStyle = 'rgba(255,253,246,0.4)'; x.fill(lt);
  return c;
}
function buildCover() {   // 按 object-fit: cover 裁成正方形，圆形裁切在画的时候做
  if (!coverSrc) { coverCv = null; return; }
  const sw = coverSrc.naturalWidth || coverSrc.width, sh = coverSrc.naturalHeight || coverSrc.height; if (!sw || !sh) { coverCv = null; return; }
  coverCv = document.createElement('canvas'); const x = fitCanvas(coverCv, RC * 2, RC * 2), k = Math.max(RC * 2 / sw, RC * 2 / sh);
  x.imageSmoothingQuality = 'high'; x.drawImage(coverSrc, RC - sw * k / 2, RC - sh * k / 2, sw * k, sh * k);
}
function setCover(src) {   // 网易云的封面是 https 直链（不带钥匙），跟原版一样直接当图片拉；拉不到就留井心的小蓝点
  const tok = ++coverTok;
  if (!src) { coverSrc = null; buildCover(); draw(); return; }
  if (typeof src !== 'string') { coverSrc = src; buildCover(); draw(); return; }   // 也收现成的 canvas / img
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { if (tok !== coverTok) return; coverSrc = im; buildCover(); draw(); };
  im.onerror = () => { if (tok !== coverTok) return; coverSrc = null; buildCover(); draw(); };
  im.src = src;
}
function drawCover(x) {   // 芯：一道墨黑缝把台阶切齐，封面，一圈细线，正中一个小轴孔
  const ln = C.PAPER;
  x.fillStyle = C.INK; x.beginPath(); x.arc(CX, CY, RC + 2.4, 0, TAU); x.fill();
  x.save(); x.translate(CX, CY); x.rotate(S.phi * DTH); x.beginPath(); x.arc(0, 0, RC, 0, TAU); x.clip(); x.drawImage(coverCv, -RC, -RC, RC * 2, RC * 2); x.restore();
  x.strokeStyle = ln; x.globalAlpha = dark ? 0.85 : 0.95; x.lineWidth = 0.75; x.beginPath(); x.arc(CX, CY, RC + 1.2, 0, TAU); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = C.PAPER; x.beginPath(); x.arc(CX, CY, 3.6, 0, TAU); x.fill(); x.strokeStyle = C.INK; x.globalAlpha = 0.55; x.lineWidth = 0.5; x.stroke(); x.globalAlpha = 1;
  x.fillStyle = C.BLUE; x.beginPath(); x.arc(CX, CY, 1.8, 0, TAU); x.fill();
}

/* ---------- 底：墨黑纸（或纸白），深浅颗粒，旧渍 ---------- */
let bgCv = null;
function buildBack() {
  bgCv = document.createElement('canvas'); const x = fitCanvas(bgCv, W, H), Rn = rng(8181);
  x.fillStyle = dark ? C.INK : C.PAPER; x.fillRect(0, 0, W, H);
  if (dark) { const lite = new Path2D(), dk = new Path2D(), n = Math.round(W * H / 6);
    for (let k = 0; k < n; k++) { const px = Rn() * W, py = Rn() * H, nz = 0.5 + 0.5 * Math.sin(px / 47 + Math.sin(py / 61) * 2.1) * Math.cos(py / 53 - px / 140), r = Rn();
      if (nz > 0.62 && r < (nz - 0.62) * 2.4) { const s = 0.35 + Rn() * 0.4; lite.rect(px - s, py - s, s * 2, s * 2); } else if (nz < 0.38 && r < (0.38 - nz) * 2.2) { const s = 0.4 + Rn() * 0.5; dk.rect(px - s, py - s, s * 2, s * 2); } }
    x.fillStyle = 'rgba(74,76,86,0.5)'; x.fill(lite); x.fillStyle = 'rgba(0,0,3,0.55)'; x.fill(dk); }
  spots(x, W, H, 515, dark ? 'rgba(241,238,230,0.16)' : 'rgba(84,84,88,0.2)');
  // 从唱片派生的辅助线：过井心的一根斜线（出了丝带才露）、一段点线轨道、两颗小交点
  const ln = dark ? C.PAPER : C.PEN, ax = 2.36;   // 斜轴朝左下
  x.strokeStyle = ln; x.lineWidth = 0.5; x.globalAlpha = dark ? 0.28 : 0.35;
  x.beginPath(); x.moveTo(CX + Math.cos(ax) * (RB + 16), CY + Math.sin(ax) * (RB + 16)); x.lineTo(CX + Math.cos(ax) * (RB + 120), CY + Math.sin(ax) * (RB + 120)); x.stroke();
  x.setLineDash([1, 4]); x.beginPath(); x.arc(CX, CY, RB * 1.3, PI * 0.62, PI * 1.18); x.stroke(); x.setLineDash([12, 4, 3, 4]); x.globalAlpha *= 0.7; x.beginPath(); x.arc(CX, CY, RB * 1.62, PI * 0.74, PI * 1.02); x.stroke(); x.setLineDash([]);
  x.globalAlpha = dark ? 0.6 : 0.7; x.fillStyle = ln; x.beginPath(); dot(x, CX + Math.cos(ax) * RB * 1.3, CY + Math.sin(ax) * RB * 1.3, 1.5); x.rect(CX + Math.cos(ax) * RB * 1.62 - 1.6, CY + Math.sin(ax) * RB * 1.62 - 1.6, 3.2, 3.2); x.fill(); x.globalAlpha = 1;
}

/* ---------- 唱片＝楼梯井：相机在井的正上方往下看，真透视（半径 ÷ 深度）。先画最深的，上面的一级级盖下来 ---------- */
const NT = 16, DTH = TAU / NT, RIN = 0.42, ROUT = 1, RISE = 0.052, THK = 0.07, RAILH = 0.3, LIT = -2.25;   // 一圈 16 级；光从左上来
function ann(x, r0, r1, a0, a1) { x.beginPath(); x.arc(CX, CY, r1, a0, a1); x.arc(CX, CY, Math.max(0.01, r0), a1, a0, true); x.closePath(); }
function drawWell(x) {
  const F = R * 1.22, fr = ((S.phi % 1) + 1) % 1, ln = dark ? C.PAPER : C.LINE, rHole = R * 0.075, its = [];
  const cov = !!coverCv;   // 有封面时只画最上面一圈：再往下一圈的踏步只会在封面边上露出半截，渐隐成黑，留一道干净的黑缝
  for (let i = -2; i < 400; i++) { const u = i + fr, d = 1 + u * RISE; if (d <= 0.2) continue; if (F * RIN / d < rHole * 0.9 || (cov && u > NT + 1)) break; its.push([u, d]); }
  x.save(); x.beginPath(); x.arc(CX, CY, R, 0, TAU); x.clip();
  x.fillStyle = C.INK; x.fillRect(CX - R, CY - R, 2 * R, 2 * R);   // 井壁和井底都沉在黑里（纸白面上它就是一张黑唱片）
  for (let k = its.length - 1; k >= 0; k--) {
    const [u, d] = its[k], th0 = u * DTH + 0.2, th1 = th0 + DTH, ri = F * RIN / d, ro = F * ROUT / d, turn = u / NT;
    if (F * RIN / (d - RAILH) < R * 0.02) continue;
    const kf = cov ? 1 - sstep(NT - 0.5, NT + 1, u) : 1; if (kf < 0.002) continue;
    const fog = kf * clamp(1 - Math.pow(clamp((d - 1) / 4.6, 0, 1), 0.85), 0.06, 1), lit = Math.cos(th0 + DTH / 2 - LIT - 0.42 * turn) > -0.18, near = ro > R * 0.7;
    // 朝井的板厚：踏面内沿往下一窄条，深铅笔灰
    ann(x, F * RIN / (d + THK), ri, th0, th1); x.globalAlpha = fog; x.fillStyle = lit ? '#45464d' : '#2a2b31'; x.fill();
    if (near) { x.globalAlpha = 0.45 * fog; x.strokeStyle = C.PEN; x.lineWidth = 0.45; x.beginPath(); for (let h = 1; h < 4; h++) { const a = lerp(th0, th1, h / 4); x.moveTo(CX + Math.cos(a) * ri, CY + Math.sin(a) * ri); x.lineTo(CX + Math.cos(a + 0.05) * F * RIN / (d + THK), CY + Math.sin(a + 0.05) * F * RIN / (d + THK)); } x.stroke(); }
    // 踏面
    ann(x, ri, ro, th0, th1);
    if (lit) { x.globalAlpha = fog; x.fillStyle = C.PAPER; x.fill(); x.globalAlpha = 0.55 * fog; x.strokeStyle = C.LINE; x.lineWidth = 0.5; x.stroke(); }
    else { x.globalAlpha = kf; x.fillStyle = C.INK; x.fill(); x.globalAlpha = 0.3 * fog; x.strokeStyle = C.PAPER; x.lineWidth = 0.5; x.stroke(); }
    // 前沿压一道黑，一级一级黑白相间
    ann(x, ri, ro, th1 - DTH * 0.09, th1); x.globalAlpha = (lit ? 0.92 : 1) * kf; x.fillStyle = lit ? '#2a2b31' : '#0d0e12'; x.fill();
    // 栏杆：立柱从内沿往相机长，所以在画面上朝外；扶手是一根连着的螺线
    if (ro < R * 0.2) continue; const rp = F * RIN / (d - RAILH); x.globalAlpha = (lit ? 0.85 : 0.42) * fog; x.strokeStyle = lit ? C.LINE : C.PAPER; x.lineWidth = clamp(0.9 / d, 0.3, 0.8);
    x.beginPath(); const am = th0 + DTH * 0.45; x.moveTo(CX + Math.cos(am) * ri, CY + Math.sin(am) * ri); x.lineTo(CX + Math.cos(am) * rp, CY + Math.sin(am) * rp); x.stroke();
    x.strokeStyle = lit ? C.INK : C.PAPER; x.globalAlpha = (lit ? 0.9 : 0.55) * fog; x.lineWidth = clamp(1.1 / d, 0.35, 1); x.beginPath();
    for (let q = 0; q <= 4; q++) { const f = q / 4, a = lerp(th0, th1, f), rr = F * RIN / (d - RAILH + f * RISE); q ? x.lineTo(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr) : x.moveTo(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr); }
    x.stroke();
  }
  x.globalAlpha = 1; x.restore();
  if (coverCv) drawCover(x);
  else {   // 井心：墨黑小圆里一个蓝圈白心
    x.fillStyle = C.INK; x.beginPath(); x.arc(CX, CY, R * 0.08, 0, TAU); x.fill();
    x.strokeStyle = C.BLUE; x.lineWidth = 1.6; x.beginPath(); x.arc(CX, CY, R * 0.045, 0, TAU); x.stroke();
    x.fillStyle = C.PAPER; x.beginPath(); x.arc(CX, CY, R * 0.022, 0, TAU); x.fill(); }
  // 唱片沿：一圈细线
  x.strokeStyle = ln; x.globalAlpha = dark ? 0.45 : 0.7; x.lineWidth = 0.6; x.beginPath(); x.arc(CX, CY, R, 0, TAU); x.stroke(); x.globalAlpha = 1;
}

/* ---------- 进度丝带、分钟刻度、唱针燕子 ---------- */
const angOf = p => -PI / 2 + p * TAU, NEEDLE = 2.36;
function drawRibbon(x) {
  const p = DUR > 0 ? clamp(S.t / DUR, 0, 1) : 0, a1 = angOf(p), ln = dark ? C.PAPER : C.LINE, some = !LIVE || !!cur;
  x.strokeStyle = ln; x.globalAlpha = dark ? 0.55 : 0.65; x.lineWidth = 0.6; x.beginPath(); x.arc(CX, CY, RB, a1, -PI / 2 + TAU); x.stroke(); x.globalAlpha = 1;
  if (p > 0.001) { x.fillStyle = C.BLUE; x.beginPath(); x.arc(CX, CY, RB + 2.6, -PI / 2, a1); x.arc(CX, CY, RB - 2.6, a1, -PI / 2, true); x.closePath(); x.fill();   // 走过的：蓝实面，带面上几粒纸白
    const Rn = rng(77), n = Math.round(p * 90); x.fillStyle = C.PAPER; x.globalAlpha = 0.8; x.beginPath(); for (let i = 0; i < n; i++) { const a = -PI / 2 + Rn() * (a1 + PI / 2), rr = RB + (Rn() - 0.5) * 4.4; dot(x, CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, 0.3 + Rn() * 0.35); } x.fill(); x.globalAlpha = 1;
    const Rm = rng(78); x.fillStyle = C.BLUE; x.beginPath(); for (let i = 0; i < 60; i++) { const a = a1 - Rm() * 0.07, rr = RB + (Rm() - 0.5) * 6; dot(x, CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, 0.3 + Rm() * 0.4); } x.fill(); }   // 丝带头散成颗粒
  // 分钟刻度：外侧短刻度和极小的数字（像测深数字）。长曲子分钟数隔几个标一个，小刻度放疏
  x.strokeStyle = ln; x.fillStyle = dark ? '#9c9ca2' : C.PEN; x.lineWidth = 0.5; x.font = '300 9px "Cormorant Garamond",Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const mins = some ? Math.ceil(DUR / 60 - 0.01) : 1, every = mins > 24 ? 10 : mins > 12 ? 5 : mins > 6 ? 2 : 1;
  for (let m = 0; m < mins; m += every) { const a = angOf(m * 60 / DUR), c = Math.cos(a), s = Math.sin(a); x.globalAlpha = 0.7; x.beginPath(); x.moveTo(CX + c * (RB + 5), CY + s * (RB + 5)); x.lineTo(CX + c * (RB + (m ? 9 : 13)), CY + s * (RB + (m ? 9 : 13))); x.stroke();
    const tx = CX + c * (RB + 19), ty = CY + s * (RB + 19); if (tx < W - 8) x.fillText(m ? m + '′' : '0', tx, ty); }
  if (some) { const step = DUR <= 420 ? 5 : DUR <= 1500 ? 15 : 60;
    x.globalAlpha = 0.35; x.beginPath(); for (let k = 1; k * step < DUR; k++) { if ((k * step) % 60 === 0) continue; const a = angOf(k * step / DUR), c = Math.cos(a), s = Math.sin(a); x.moveTo(CX + c * (RB + 5), CY + s * (RB + 5)); x.lineTo(CX + c * (RB + 7), CY + s * (RB + 7)); } x.stroke(); }
  x.globalAlpha = 1;
  // 唱针：一只燕子落在唱片外沿的斜轴上（唱针不动，盘在底下转），头顺着转的方向；放着时轻扇，停了收拢
  const na = NEEDLE, bx = CX + Math.cos(na) * (RB + 8), by = CY + Math.sin(na) * (RB + 8), hd = na + PI / 2, sc = clamp(R / 520, 0.17, 0.26);
  x.save(); x.translate(bx, by); x.rotate(hd); x.fillStyle = dark ? C.PAPER : C.INK;
  if (S.fold > 0.5) { x.scale(sc * 0.95, sc * 0.95); x.translate(0, -26); x.fill(PERCH2D); }
  else { x.scale(sc, sc); x.translate(0, -18); x.fill(birdP(S.flap)); }
  x.restore();
}

/* ---------- 一起听：两颗小月亮、泪线、控件。自己听时右边那颗只剩虚线，泪线淡下去 ---------- */
function drawTogether(x) {
  const ln = dark ? C.PAPER : C.LINE, my = PY - 112, fg = dark ? C.PAPER : C.INK, tg = together ? 1 : 0.35;
  x.fillStyle = C.BLUE; x.beginPath(); x.arc(GX - 8, my, 5.2, 0, TAU); x.fill();   // 一蓝一白圈
  x.strokeStyle = fg; x.lineWidth = 0.8; x.globalAlpha = tg; if (!together) x.setLineDash([1.2, 2.2]); x.beginPath(); x.arc(GX + 8, my, 5.2, 0, TAU); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
  x.strokeStyle = ln; x.lineWidth = 0.4; x.globalAlpha = 0.5 * tg; x.beginPath(); x.moveTo(GX - 2.8, my); x.lineTo(GX + 2.8, my); x.stroke(); x.globalAlpha = 1;
  // 泪线：两颗月亮中间垂下来，几颗墨点，到播放键
  x.globalAlpha = together ? 1 : 0.4; x.strokeStyle = C.BLUE; x.lineWidth = 0.8; x.beginPath(); x.moveTo(GX, my + 7); x.lineTo(GX, PY - 12); x.stroke();
  x.fillStyle = C.BLUE; x.beginPath(); [[0.32, 1.3], [0.55, 0.9], [0.7, 1.6]].forEach(([f, r]) => dot(x, GX, lerp(my + 7, PY - 12, f), r)); x.fill(); x.globalAlpha = 1;
  // 一根细横线把三个键串起来，中间断开
  x.strokeStyle = ln; x.globalAlpha = 0.45; x.lineWidth = 0.5; x.beginPath(); x.moveTo(GX - 70, PY); x.lineTo(GX - 56, PY); x.moveTo(GX - 36, PY); x.lineTo(GX - 14, PY); x.moveTo(GX + 14, PY); x.lineTo(GX + 36, PY); x.moveTo(GX + 56, PY); x.lineTo(GX + 70, PY); x.stroke(); x.globalAlpha = 1;
  // 上一首 / 下一首：一根竖刻度加一颗空心小菱形
  [[-1, GX - 46], [1, GX + 46]].forEach(([d, cx]) => { x.strokeStyle = fg; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx + d * 6, PY - 5); x.lineTo(cx + d * 6, PY + 5); x.stroke();
    x.beginPath(); x.moveTo(cx - d * 5, PY); x.lineTo(cx - d * 0.5, PY - 3.6); x.lineTo(cx + d * 4, PY); x.lineTo(cx - d * 0.5, PY + 3.6); x.closePath(); x.lineWidth = 0.7; x.stroke(); });
  // 播放键：坠子。停着是实心蓝菱形；放着是空心菱形里两笔竖线
  const hw = 6.4, hh = 11, y0 = PY - 11; x.beginPath(); x.moveTo(GX, y0); x.lineTo(GX + hw, y0 + hh); x.lineTo(GX, y0 + 2 * hh); x.lineTo(GX - hw, y0 + hh); x.closePath();
  if (S.playing) { x.strokeStyle = C.BLUE; x.lineWidth = 1; x.stroke(); x.fillStyle = C.BLUE; x.fillRect(GX - 2.2, y0 + hh - 3.6, 1.1, 7.2); x.fillRect(GX + 1.1, y0 + hh - 3.6, 1.1, 7.2); }
  else { x.fillStyle = C.BLUE; x.fill(); x.fillStyle = dark ? C.INK : C.PAPER; x.beginPath(); x.moveTo(GX - 1.6, y0 + hh - 3.4); x.lineTo(GX + 2.6, y0 + hh); x.lineTo(GX - 1.6, y0 + hh + 3.4); x.closePath(); x.fill(); }
  // 坠子底下一小段点线，往下出画
  x.strokeStyle = C.BLUE; x.globalAlpha = 0.6; x.lineWidth = 0.8; x.lineCap = 'round'; x.setLineDash([0.1, 3.4]); x.beginPath(); x.moveTo(GX, PY + 16); x.lineTo(GX, H + 4); x.stroke(); x.setLineDash([]); x.lineCap = 'butt'; x.globalAlpha = 1;
}

/* ---------- 歌词：台阶一样往右下错开；当前句前后各露几级，再远的不排 ---------- */
let LP = [];
function buildLyrics() { lyrEl.innerHTML = ''; LP = LYR.map(l => { const p = document.createElement('p'); p.textContent = l[1]; lyrEl.appendChild(p); return p; }); placeLyrics(); }
function lineAt(t) { let c = 0; for (let i = 0; i < LYR.length; i++) if (LYR[i][0] <= t + (LIVE ? 0.25 : 0)) c = i; return c; }
function placeLyrics() {
  const top = parseFloat(lyrEl.style.top) || 0, c = S.cur, ci = lineAt(S.t);
  LP.forEach((p, i) => { const d = i - c;
    if (d < -4 || d > 9) { if (p.style.display !== 'none') p.style.display = 'none'; return; } if (p.style.display) p.style.display = '';
    const x = LX + 24 + d * 14, y = LY - top + d * LH - 10, al = d < 0 ? Math.max(0, 0.55 + d * 0.22) : d < 0.5 ? 1 : Math.max(0, 1.02 - d * 0.16);
    p.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; p.style.opacity = al.toFixed(3); p.style.maxWidth = Math.max(40, W - x - 16).toFixed(0) + 'px'; p.classList.toggle('on', i === ci); });
}

/* ---------- 画 ---------- */
function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }
function draw() {
  if (!g) return; g.drawImage(bgCv, 0, 0, W, H); drawWell(g); drawRibbon(g); drawTogether(g);
  $('tcur').textContent = fmt(S.t); $('tall').textContent = LIVE && !cur ? '0:00' : fmt(DUR); placeLyrics();
}
let last = 0, raf = 0;
function frame(ms) {
  const dt = Math.min(0.05, (ms - (last || ms)) / 1000); last = ms;
  if (LIVE) { if (cur && !S.drag && !isSilent()) S.t = au.currentTime || 0; const d = au.duration; if (cur && isFinite(d) && d > 0 && !isSilent()) DUR = d; }
  else if (S.playing && !S.drag) { S.t += dt * SPEED; if (S.t >= DUR) { S.t = 0; } }
  const om = S.playing ? 0.9 : 0; S.omega += (om - S.omega) * (1 - Math.exp(-dt * 2.4)); S.phi += S.omega * dt;   // 一停下来，转盘拖着尾巴慢下来
  S.fold += ((S.playing ? 0 : 1) - S.fold) * (1 - Math.exp(-dt * 6)); S.flap += dt * (S.playing ? 0.55 : 0);
  const ct = lineAt(S.t); if (Math.abs(ct - S.cur) > 6) S.cur = ct + Math.sign(S.cur - ct) * 6; S.cur += (ct - S.cur) * (1 - Math.exp(-dt * 5));
  draw();
  if (S.playing || S.drag || Math.abs(S.omega) > 0.002 || Math.abs(ct - S.cur) > 0.002 || (S.fold > 0.01 && S.fold < 0.99)) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
}
const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
function showPlaying(v) { S.playing = v; $('play').setAttribute('aria-label', v ? '暂停' : '播放'); kick(); }

/* ---------- 一行小字：歌名底下冒一句就收（放不了、跳过了），歌词那块写空状态和提示 ---------- */
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400); }
function msg(html) { const el = $('msg'); el.innerHTML = html || ''; el.hidden = !html; }
function gateHTML(kind) { return (kind === 'auth' ? '钥匙不认了，' : '还没带钥匙，') + '<a href="../index.html">去登录</a>'; }

/* =====================================================================
   后台：家里的东西走第一只（config.js 的 relay，默认 /relay），同 Nyx app.js
   ===================================================================== */
let HOME = '/relay', KEY = null, gated = '';
function loadConfig() { return new Promise(ok => { if (window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); }); }
function req(path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + KEY }, opt.headers || {});
  return fetch(HOME + path, opt).then(r => { if (r.status === 401) { const e = new Error('401'); e.auth = true; authFail(); throw e; } if (!r.ok) throw new Error(path + ' ' + r.status); return r; });
}
/* 一起听报给聊天页现在是谁（nyx_relay，跟 people 页 pick() 写的同一份）；家里那只或群就走 HOME。歌单、歌词这些还走 HOME */
function nowTarget() { const r = ls('nyx_relay'); return (r && /^\/relay(-[a-z0-9]+)?$/.test(r) && r !== HOME) ? { relay: r, key: ls('nyx_chat_key') || KEY } : { relay: HOME, key: KEY }; }
function nowReq(path, opt) { const t = nowTarget(); opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + t.key }, opt.headers || {}); return fetch(t.relay + path, opt); }
const music = (action, params) => req('/app/music/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}) }).then(r => r.json());
function authFail() { if (gated === 'auth') return; gated = 'auth'; KEY = null; msg(gateHTML('auth')); rowsEl.innerHTML = '<p class="hint">' + gateHTML('auth') + '</p>'; }

const artists = s => s.artist != null ? s.artist : (s.ar || s.artists || []).map(a => a.name).join(' / ');
const coverOf = (s, size) => { if (s.coverUrl) return s.coverUrl; const u = (s.al || s.album || {}).picUrl || ''; return u ? u.replace(/^http:/, 'https:') + '?param=' + (size || 120) + 'y' + (size || 120) : ''; };

/* ---------- 一起听开关：开着，换歌就告诉 AI；关着只自己听。两个原版各记一个键，这里两个一起写，聊天页的小音符两个都看 ---------- */
let together = LIVE ? !(ls('music_together') === 'off' || ls('nyx_listen_alone') === '1') : true;
function paintTogether() { $('tog').innerHTML = '<span class="tiny">' + (together ? '一起听' : '自己听') + '</span>'; $('tgl').setAttribute('aria-pressed', together ? 'true' : 'false'); $('tgl').setAttribute('aria-label', together ? '一起听，点一下改成自己听' : '自己听，点一下改成一起听'); draw(); }
$('tgl').addEventListener('click', () => {
  together = !together;
  if (LIVE) { lsSet('music_together', together ? 'on' : 'off'); lsSet('nyx_listen_alone', together ? null : '1'); if (together && cur) report(true); }
  toast(together ? '一起听 · 换歌会告诉' + AI : '自己听 · 这会儿只有你'); paintTogether();
});
let AI = '祂';

/* ---------- 播放顺序：顺序（整张循环）/ 随机 / 单曲，记在这台手机（music_mode） ---------- */
const MODES = ['order', 'shuffle', 'one'], MODE_NAME = { order: '顺序', shuffle: '随机', one: '单曲' }, MODE_LONG = { order: '顺序播放', shuffle: '随机播放', one: '单曲循环' };
let mode = (() => { const m = ls('music_mode') || ls('nyx_play_mode'); return MODES.includes(m) ? m : 'order'; })(), plan = null;
function paintMode() { const b = $('mode'); b.querySelector('span').textContent = MODE_NAME[mode]; b.setAttribute('aria-label', '播放顺序：' + MODE_LONG[mode]); }
$('mode').addEventListener('click', () => { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; plan = null; ahead = null; if (LIVE) lsSet('music_mode', mode); paintMode(); toast(MODE_LONG[mode]); if (cur) fetchAhead(); });

/* ---------- 点歌：推荐 / 歌单 / 最近 / 搜索，一行一首 ---------- */
const TABS = [['daily', '推荐'], ['list', '歌单'], ['recent', '最近'], ['search', '搜索']];
const TAB_EN = { daily: 'for you', list: 'a list', recent: 'recent', search: 'found' };
let tab = (() => { const t = ls('music_tab'); return TABS.some(x => x[0] === t) ? t : 'daily'; })(), view = [], viewKind = 'songs', viewTab = tab, uid = null, likes = new Set(), lastSearch = [], plTok = null, srcTab = tab;
$('tabs').innerHTML = TABS.map(t => `<button type="button" data-t="${t[0]}">${t[1]}</button>`).join('');
function hint(t) { rowsEl.innerHTML = '<p class="hint">' + t + '</p>'; }
function renderSongs(songs, empty) {
  view = songs; viewKind = 'songs'; viewTab = tab;
  if (!songs.length) { hint(esc(empty || '这里空空的。')); return; }
  rowsEl.innerHTML = songs.map((s, i) => `<button type="button" class="row" data-i="${i}"><i>${i + 1}</i><b>${esc(s.name)}</b><small>${esc(artists(s))}</small></button>`).join('');
  markPlaying();
}
function renderPlaylists(pls) {
  view = pls; viewKind = 'playlists';
  if (!pls.length) { hint('没有歌单。'); return; }
  rowsEl.innerHTML = pls.map((p, i) => `<button type="button" class="row pl" data-i="${i}"><i>${i + 1}</i><b>${esc(p.name)}</b><small>${p.trackCount | 0} 首</small></button>`).join('');
}
function markPlaying() { rowsEl.querySelectorAll('.row').forEach(r => { const s = view[+r.dataset.i]; r.classList.toggle('cur', viewKind === 'songs' && !!cur && !!s && s.id === cur.id); }); }
function showSub(t) { $('sub').hidden = !t; $('subT').textContent = t || ''; }
async function loadTab(t) {
  plTok = null; tab = t; if (LIVE) lsSet('music_tab', t); showSub('');
  $('tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('find').hidden = t !== 'search';
  if (!LIVE) { renderSongs(t === 'search' ? lastSearch : t === 'list' ? [] : DEMO_SONGS.slice(t === 'recent' ? 3 : 0), t === 'search' ? '想听什么，搜一下。' : '示例里没有歌单。'); return; }
  if (!KEY) { hint(gateHTML(gated || 'none')); return; }
  if (t === 'search') { renderSongs(lastSearch, '想听什么，搜一下。'); return; }
  hint('在拉……');
  try {
    if (t === 'daily') { const d = await music('daily'); if (tab !== t) return; renderSongs((d.data && d.data.dailySongs) || [], '今天的推荐还没出来。'); }
    else if (t === 'recent') { const d = await music('recent', { limit: 100 }); if (tab !== t) return; renderSongs(((d.data && d.data.list) || []).map(x => x.data).filter(Boolean), '还没有最近播放。'); }
    else if (t === 'list') { await ensureMe(); const d = await music('playlists', { uid, limit: 100 }); if (tab !== t) return; renderPlaylists(d.playlist || []); }
  } catch (e) { if (tab === t) showErr(e); }
}
function showErr(e) { if (e && e.auth) return; hint('网易云那头没接上，过一会儿再试试。'); }
async function openPlaylist(p) {
  showSub(p.name + ' · ' + (p.trackCount | 0) + ' 首'); hint('在翻这张歌单……');
  const tok = Symbol(); plTok = tok; let all = [];
  try {
    for (let off = 0; off < (p.trackCount | 0); off += 300) {   // 一页三百首，先给第一页，后面的接着拉
      const d = await music('tracks', { id: p.id, limit: 300, offset: off }); if (plTok !== tok) return;
      all = all.concat(d.songs || []); renderSongs(all, '这张歌单是空的。'); if (!(d.songs || []).length) break;
    }
    if (!all.length) renderSongs([], '这张歌单是空的。');
  } catch (e) { if (!all.length) showErr(e); }
}
$('plBack').addEventListener('click', () => loadTab('list'));
$('tabs').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) { loadTab(b.dataset.t); if (b.dataset.t === 'search') setTimeout(() => $('q').focus(), 30); } });
$('find').addEventListener('submit', async ev => {
  ev.preventDefault(); const q = $('q').value.trim(); if (!q) return; $('q').blur();
  if (!LIVE) { lastSearch = DEMO_SONGS.filter(s => s.name.includes(q) || s.artist.includes(q)); renderSongs(lastSearch, '没搜到。换个说法？'); return; }
  if (!KEY) return; hint('在找「' + esc(q) + '」……');
  try { const d = await music('search', { keywords: q, limit: 40 }); if (tab !== 'search') return; lastSearch = (d.result && d.result.songs) || []; renderSongs(lastSearch, '没搜到。换个说法？'); } catch (e) { showErr(e); }
});
rowsEl.addEventListener('click', ev => {
  const r = ev.target.closest('.row'); if (!r) return; const i = +r.dataset.i;
  if (!LIVE) return;   // 示例那边自己接（见「示例」一节），不发请求
  if (viewKind === 'playlists') openPlaylist(view[i]); else { srcTab = viewTab; playList(view, i); }
});
async function ensureMe() {
  if (uid) return;
  const d = await music('me'); const p = (d.data || d).profile;
  if (p) uid = p.userId;
  try { const l = await music('likelist', { uid }); likes = new Set(l.ids || []); paintLike(); } catch (_) {}
}

/* ---------- 点歌那一页：盖在歌词和控件上，唱片还在上面转 ---------- */
let shelfOn = false;
function setShelf(v) {
  if (v === shelfOn) return; shelfOn = v; $('pick').setAttribute('aria-expanded', v ? 'true' : 'false');
  if (v) { shelf.hidden = false; void shelf.offsetWidth; shelf.classList.add('on'); if (!rowsEl.children.length || viewTab !== tab) loadTab(tab); else markPlaying(); }
  else { shelf.classList.remove('on'); setTimeout(() => { if (!shelfOn) shelf.hidden = true; }, REDUCED ? 0 : 200); }
}
$('pick').addEventListener('click', () => setShelf(true));
$('shut').addEventListener('click', () => setShelf(false));
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && shelfOn) setShelf(false); });

/* =====================================================================
   播放（先放一段无声占住 <audio>、下一首的链接提前拉好、放不了就跳过）
   ===================================================================== */
let queue = [], qi = -1, cur = null, ahead = null, blobUrl = null, repState = '', repT = 0;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const isSilent = () => au.src === SILENT || !au.src;
function pickNext() { if (mode === 'shuffle' && queue.length > 1) { let j; do { j = Math.floor(Math.random() * queue.length); } while (j === qi); return j; } return (qi + 1) % queue.length; }
function primeAudio() { if (!au.paused) return; try { au.src = SILENT; const p = au.play(); if (p) p.catch(() => {}); } catch (_) {} }
async function srcOf(s) {
  const d = await music('url', { id: s.id, level: 'exhigh' }); return (d.data && d.data[0] && d.data[0].url) || '';
}
async function fetchAhead() {
  if (!queue.length || !LIVE) return;
  if (plan == null) plan = pickNext();
  const n = queue[plan]; if (!n || (ahead && ahead.id === n.id)) return;
  try { const u = await srcOf(n); if (u) ahead = { id: n.id, url: u, t: Date.now() }; } catch (_) {}
}
function setSrc(u) { if (blobUrl && blobUrl !== u) { try { URL.revokeObjectURL(blobUrl); } catch (_) {} blobUrl = null; } if (/^blob:/.test(u)) blobUrl = u; au.src = u; }
async function playList(list, i) { queue = list.slice(); qi = i; await playCurrent(); }
async function playCurrent(fromEnd) {
  cur = queue[qi]; if (!cur) return; plan = null; const me = cur;
  if (!fromEnd) primeAudio();
  paintNow(); loadLyric(me);
  let u = '';
  try { u = await srcOf(me); } catch (e) { if (cur === me && !(e && e.auth)) toast('没拿到这首的链接'); return; }
  if (cur !== me) return;
  if (!u) { toast('这首放不了，跳过'); if (queue.length > 1) return next(); return; }
  setSrc(u);
  try { await au.play(); } catch (_) { showPlaying(false); toast('点一下播放键'); }
  report(false); fetchAhead();
}
function next(fromEnd) {
  if (!LIVE) { const c = lineAt(S.t); S.t = LYR[Math.min(LYR.length - 1, c + 1)][0]; kick(); return; }
  if (!queue.length) return;
  if (fromEnd === true && mode === 'one') { au.currentTime = 0; const p = au.play(); if (p) p.catch(() => showPlaying(false)); report(false); return; }
  qi = plan != null ? plan : pickNext(); plan = null;
  const n = queue[qi];
  if (ahead && n && ahead.id === n.id && Date.now() - ahead.t < 15 * 60e3) {   // 链接已经在手里：同一拍里换上，锁屏时也接得上
    cur = n; setSrc(ahead.url); ahead = null; const p = au.play(); if (p) p.catch(() => showPlaying(false));
    paintNow(); loadLyric(n); report(false); fetchAhead(); return;
  }
  playCurrent(fromEnd === true);
}
function prev() {
  if (!LIVE) { const c = lineAt(S.t); S.t = S.t - LYR[c][0] > 3 ? LYR[c][0] : LYR[Math.max(0, c - 1)][0]; kick(); return; }
  if (!queue.length) return; if (au.currentTime > 4) { au.currentTime = 0; return; }
  qi = (qi - 1 + queue.length) % queue.length; playCurrent();
}
function toggle() {
  if (!LIVE) { showPlaying(!S.playing); return; }
  if (!cur) { if (viewKind === 'songs' && view.length) { srcTab = viewTab; playList(view, 0); } else setShelf(true); return; }
  if (au.paused) { const p = au.play(); if (p) p.catch(() => {}); } else au.pause();
}
au.addEventListener('play', () => { if (!isSilent()) showPlaying(true); });
au.addEventListener('playing', () => { if (!isSilent()) showPlaying(true); });
au.addEventListener('pause', () => { showPlaying(false); });
au.addEventListener('ended', () => { if (!isSilent()) next(true); });
au.addEventListener('error', () => { if (cur && !isSilent()) { toast('这首卡住了，换下一首'); setTimeout(() => next(), 800); } });
au.addEventListener('loadedmetadata', () => { if (isFinite(au.duration) && au.duration > 0 && !isSilent()) DUR = au.duration; kick(); });
au.addEventListener('seeked', kick);
// 播停变了也报一声（原版只在换歌时报）：聊天页的小音符看的是 state=play，停了就该灭。抖动的连发并成一次
['play', 'pause'].forEach(e => au.addEventListener(e, () => { if (!cur || isSilent()) return; clearTimeout(repT); repT = setTimeout(() => { const st = au.paused ? 'pause' : 'play'; if (st !== repState) report(false); }, 900); }));

/* 告诉后台在放哪首；一起听开着，AI 就知道（后台同一首只说一次，force 是重新开回一起听时让它再说一次） */
function report(force) {
  if (!LIVE || !cur || !KEY) return; const st = au.paused ? 'pause' : 'play'; repState = st;
  nowReq('/app/music/now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cur.id, name: cur.name, artist: artists(cur), state: st, together, force: !!force }) }).catch(() => {});
}
// 离页不报 pause，停只听她自己按的

/* ---------- 歌名、封面、喜欢 ---------- */
function paintSong(name, by, en) {
  const b = $('song').querySelector('b'); b.textContent = name; b.classList.toggle('long', [...name].length > 6);
  $('song').querySelector('.by').textContent = by; $('song').querySelector('.en').textContent = en;
}
function paintNow() {
  paintSong(cur.name || '无题', artists(cur), (TAB_EN[srcTab] || 'side a') + ' · no. ' + (qi + 1));
  DUR = cur.dt ? cur.dt / 1000 : 240; S.t = 0; setCover(coverOf(cur, 360)); paintLike(); markPlaying(); msg('');
  if ('mediaSession' in navigator && window.MediaMetadata) try { const c = coverOf(cur, 600); navigator.mediaSession.metadata = new MediaMetadata({ title: cur.name, artist: artists(cur), album: (cur.al || {}).name || '', artwork: c && !/^\/(?!\/)/.test(c) ? [{ src: c, sizes: '600x600', type: 'image/jpeg' }] : [] }); } catch (_) {}
  kick();
}
function paintEmpty() { paintSong('还没放歌', '', 'side a'); DUR = 240; S.t = 0; setCover(null); paintLike(); if (!gated) msg('从右下「点歌」挑一首'); }
function paintLike() {
  const b = $('like'), can = LIVE ? !!cur : true, on = LIVE ? !!cur && likes.has(cur.id) : demoLiked;
  b.hidden = !can; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? '已喜欢，点一下取消' : '喜欢');
}
$('like').addEventListener('click', async () => {
  if (!LIVE) { demoLiked = !demoLiked; paintLike(); toast(demoLiked ? '放进我喜欢了' : '从我喜欢里拿掉了'); return; }
  if (!cur) return; const want = !likes.has(cur.id), id = cur.id;
  try { await music('like', { id, like: want }); want ? likes.add(id) : likes.delete(id); paintLike(); toast(want ? '放进我喜欢了' : '从我喜欢里拿掉了'); } catch (e) { if (!(e && e.auth)) toast('没点上'); }
});

/* ---------- 歌词（网易云的 lrc 文本） ---------- */
let lyrTok = 0;
async function loadLyric(s) {
  const tok = ++lyrTok; LYR = []; buildLyrics(); S.cur = 0;
  msg('…');
  let text = '';
  try { const d = await music('lyric', { id: s.id }); text = (d.lrc && d.lrc.lyric) || ''; } catch (e) { if (tok === lyrTok && !(e && e.auth)) msg('歌词没拉到。'); return; }
  if (tok !== lyrTok) return;
  const lines = [];
  text.split('\n').forEach(ln => { const tx = ln.replace(/\[[^\]]*\]/g, '').trim(); const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g; let m; while ((m = re.exec(ln))) if (tx) lines.push([+m[1] * 60 + +m[2], tx]); });
  LYR = lines.sort((a, b) => a[0] - b[0]); buildLyrics(); S.cur = lineAt(S.t);
  msg(LYR.length ? '' : '纯音乐，或者没有歌词。'); kick();
}

/* ---------- 示例（?demo=1）：点歌那页也有几首可点，点了只换歌名和起点 ---------- */
const DEMO_SONGS = [['井底有月', '晚渡'], ['晾衣绳', '南边的邻居'], ['第七级台阶', '晚渡'], ['雨停以后', '小舟'], ['旧收音机', '楼下乐队'], ['菜市场', '南边的邻居'], ['灯一盏', '小舟'], ['慢一点', '楼下乐队']]
  .map((x, i) => ({ id: 'd' + i, name: x[0], artist: x[1] }));
let dcur = null, demoLiked = false;
if (!LIVE) {
  rowsEl.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; dcur = view[+r.dataset.i]; if (!dcur) return;
    paintSong(dcur.name, dcur.artist, TAB_EN[viewTab] + ' · no. ' + (+r.dataset.i + 1)); S.t = 0; S.cur = 0; showPlaying(true);
    rowsEl.querySelectorAll('.row').forEach(x => x.classList.toggle('cur', x === r)); }, true);
}

/* ---------- 拖进度：在丝带附近按下，沿圈拖；松手才真的跳 ---------- */
const xy = ev => { const r = stage.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
function tAt(x, y) { let a = Math.atan2(y - CY, x - CX) + PI / 2; a = ((a % TAU) + TAU) % TAU; return a / TAU * DUR; }
const canSeek = () => !LIVE || (!!cur && !isSilent() && isFinite(au.duration) && au.duration > 0);
cv.addEventListener('pointerdown', ev => { const [x, y] = xy(ev), d = Math.hypot(x - CX, y - CY); if (Math.abs(d - RB) > 24 || !canSeek()) return; S.drag = true; try { cv.setPointerCapture(ev.pointerId); } catch (_) {} S.t = tAt(x, y); kick(); });
cv.addEventListener('pointermove', ev => { if (!S.drag) return; const [x, y] = xy(ev), t = tAt(x, y); if (Math.abs(t - S.t) < DUR * 0.5) S.t = clamp(t, 0, DUR - 0.5); kick(); });
const up = () => { if (S.drag) { S.drag = false; if (LIVE && canSeek()) au.currentTime = S.t; kick(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
const seekBy = s => { if (!canSeek()) return; if (LIVE) au.currentTime = clamp(au.currentTime + s, 0, DUR - 0.5); else S.t = clamp(S.t + s, 0, DUR - 0.5); kick(); };
$('play').addEventListener('click', toggle);
$('prev').addEventListener('click', prev);
$('next').addEventListener('click', () => next());
window.addEventListener('keydown', ev => { if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return; if (ev.key === ' ') { ev.preventDefault(); toggle(); } else if (ev.key === 'ArrowRight') seekBy(10); else if (ev.key === 'ArrowLeft') seekBy(-10); });
if (LIVE && 'mediaSession' in navigator) try {
  navigator.mediaSession.setActionHandler('play', () => au.play()); navigator.mediaSession.setActionHandler('pause', () => au.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', prev);
} catch (_) {}

const info = homeInfo('listen', 3, 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

setupGrain(); S.cur = lineAt(S.t); paintMode(); paintTogether();
if (!LIVE) { if (Q.get('cover') !== '0') coverSrc = placeholderCover(); $('like').hidden = false; }   // ?cover=0 看没封面的样子
else paintEmpty();
layout();
const fl = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fl.then(() => { layout(); revealIn(info, stage, () => {}); window.__ready = true; });
if (LIVE) loadConfig().then(() => {
  const N = window.NYX || {}; HOME = typeof N.relay === 'string' && /^\/relay(-[a-z0-9]+)?$/.test(N.relay) ? N.relay : '/relay';
  AI = N.aiName || AI; KEY = ls('nyx_key');
  if (nowTarget().relay !== HOME && ls('nyx_ai')) AI = ls('nyx_ai');   // 吐司里说告诉谁，也跟着聊天页
  if (!KEY) { gated = 'none'; msg(gateHTML('none')); return; }
  ensureMe().catch(() => {}); loadTab(tab);   // 先把这一栏拉着，点播放键就从第一首开始
});
window.__listen = { S, setPlay: showPlaying, draw, setCover, setShelf, loadTab, au,
  state: () => ({ live: LIVE, cur: cur ? { id: cur.id, name: cur.name } : dcur ? { id: dcur.id, name: dcur.name } : null, qi, queue: queue.length, tab, view: view.length, viewKind,
    together, mode, liked: !$('like').hidden && $('like').classList.contains('on'), shelf: shelfOn, msg: $('msg').hidden ? '' : $('msg').textContent, lyr: LYR.length, dur: DUR, t: S.t, playing: S.playing, relay: HOME }) };
})();
