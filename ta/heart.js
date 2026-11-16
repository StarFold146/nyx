/* 心脏页（11/12 初稿）：这位 AI「里面」的东西，只读。
   右上扎一颗医学插图式的铅笔心脏（主页 hand()/hatch() 那套笔触：轮廓、排线、血管断口、冠脉细枝），一条蓝色心电线横贯整页当测绘线；
   心脏上几处落一个小圈，尺规细引线往左走到页边，再顺着往下，各自落到一组文件的组头。
   点一件文件，在那一行底下展开一张信纸读全文（左边一根蓝细线）；再点收起。打开的那组，引线和小圈变蓝。
   接口照原版（hold.js heart / board.js 心脏页）原样：GET {第一只}/app/heart → {groups:[{name, files:[{path, mtime, size}]}]}；
   GET {第一只}/app/heart/file?path= → {text}。钥匙读 localStorage 的 nyx_key，只放 Authorization 头。?demo=1 用示例数据，不发任何请求。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, rng, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome, Q, REDUCED } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), scroll = $('scroll'), plate = $('plate'), art = $('art'), leads = $('leads'), groupsEl = $('groups'), msg = $('msg'), deco = $('deco');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('ta_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（ta_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f2 = n => (Math.round(n * 100) / 100).toString();
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
/* 读数照原版 board.js 的 fmt 和大小写法 */
const fmt = (ts) => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const size = n => n > 1024 ? Math.round(n / 1024) + 'K' : n + 'B';

/* ---------- 示例（只在 ?demo=1）：三组，中性的日常句子 ---------- */
const hAgo = h => new Date(Date.now() - h * 3600e3).toISOString();
const DEMO = [
  { name: '样子', files: [{ path: '样子/口气.md', mtime: hAgo(3), size: 412 }, { path: '样子/称呼.md', mtime: hAgo(50), size: 96 }] },
  { name: '记性', files: [{ path: 'memory/此刻.md', mtime: hAgo(0.4), size: 1830 }, { path: 'memory/口味.md', mtime: hAgo(26), size: 640 }, { path: 'memory/书单.md', mtime: hAgo(170), size: 2310 }] },
  { name: '骨架', files: [{ path: '~/relay/server.py', mtime: hAgo(12), size: 5420 }, { path: '~/start.sh', mtime: hAgo(900), size: 188 }] }
];
const DEMO_TEXT = {
  '样子/口气.md': '# 口气\n\n平常说话就像隔壁邻居打招呼。\n见面问一句吃了没，下雨天说一句路滑。\n\n- 话说短一点，一句一条。\n- 不知道的事就说不知道。\n',
  '样子/称呼.md': '# 称呼\n\n名字叫全，别加后缀。\n',
  'memory/此刻.md': '# 此刻\n\n这几天在家，周末去一趟菜市场。\n冰箱里还有半颗白菜和两个蛋。\n\n## 这周\n\n周三晒被子。\n周五把借的伞还回去。\n周六下午去买一盆薄荷，放在窗台上。\n\n## 记着\n\n楼下面馆周一歇业。\n快递柜的码是早上发来的那条。\n' + Array.from({ length: 14 }, (_, i) => '第 ' + (i + 1) + ' 天：早上开窗，烧水，把昨天的杯子洗了。').join('\n') + '\n',
  'memory/口味.md': '# 口味\n\n面要软一点，汤别太咸。\n粥里放南瓜会太甜，放一半就好。\n咖啡不加糖，奶可以多一点。\n',
  'memory/书单.md': '# 书单\n\n- 一本讲园艺的\n- 一本旅行随笔\n- 一本菜谱，看图多过看字\n',
  '~/relay/server.py': '# 一个很小的示例服务\nimport time\n\n\ndef hello(name):\n    """打个招呼，顺便报个时间"""\n    return "你好，%s，现在是 %s" % (name, time.strftime("%H:%M"))\n\n\nif __name__ == "__main__":\n    print(hello("邻居"))\n',
  '~/start.sh': '#!/bin/sh\n# 启动前先等网络\nsleep 2\necho "开始了"\n'
};

/* ---------- 后台：家里的东西走第一只（config.js 的 relay，默认 /relay），钥匙 nyx_key（同 Nyx app.js、原版心脏） ---------- */
let HOME = '/relay', KEY = null;
function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function loadConfig() { return new Promise(ok => { if (window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); }); }
function api(path) {
  return fetch(HOME + path, { headers: { 'Authorization': 'Bearer ' + KEY }, cache: 'no-store' }).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

/* ---------- 页眉的小心脏：照抄 chat.js 的 tixIcon('heart')（心电线以上实心蓝，以下只有轮廓和几根斜刻线），连同 tixFoil / tixDust ---------- */
function tixFoil(solid, box, edges, rot) {
  const band = (o0, o1) => { const a = -35 * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = 16; return `M${f2(nx * o0 - ux * L)} ${f2(ny * o0 - uy * L)}L${f2(nx * o0 + ux * L)} ${f2(ny * o0 + uy * L)}L${f2(nx * o1 + ux * L)} ${f2(ny * o1 + uy * L)}L${f2(nx * o1 - ux * L)} ${f2(ny * o1 - uy * L)}Z`; };
  const bands = `<g${rot ? ` transform="${rot}"` : ''}><path class="fl" d="${band(-2.6, .6)}"/><path class="fl" d="${band(2.8, 3.5)}"/><path class="fd" d="${band(-5.2, -4.5)}"/><path class="fd" d="${band(.6, 1.1)}"/></g>`;
  return `<g class="fsh" transform="translate(.4 .45)">${solid('sh')}</g><g transform="translate(-.35 -.35)">${solid('hi')}</g>${solid('b')}${box(bands + `<path class="edge" d="${edges}"/>`)}`;
}
function tixDust(base, seed, id) {
  const Rn = rng(seed); let bl = '', wh = '';
  for (let i = 0; i < 18; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.25 + Rn() * Rn() * 3, r = 0.15 + Rn() * 0.2; bl += `<circle cx="${f2(x + nx * d)}" cy="${f2(y + ny * d)}" r="${f2(r)}"/>`; }
  for (let i = 0; i < 6; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.5 + Rn() * 2, r = 0.15 + Rn() * 0.15; wh += `<circle cx="${f2(x - nx * d)}" cy="${f2(y - ny * d)}" r="${f2(r)}"/>`; }
  return `<g class="pt">${bl}</g><g class="ptw" clip-path="url(#${id}f)">${wh}</g>`;
}
function heartIcon(id) {
  const hl = (deg, offs) => { const a = deg * PI / 180, ux = Math.cos(a), uy = Math.sin(a); return offs.map(o => `M${f2(-uy * o - ux * 14)} ${f2(ux * o - uy * 14)}L${f2(-uy * o + ux * 14)} ${f2(ux * o + uy * 14)}`).join(''); };
  const two = (S, fillR, emptyR, divider, serif, det, hatch, moreL, dust, rot) => `<defs><clipPath id="${id}f"><path d="${fillR}"/></clipPath><clipPath id="${id}e"><path d="${emptyR}"/></clipPath><clipPath id="${id}s"><path d="${S}"/></clipPath></defs>
    ${tixFoil(cl => `<path class="${cl}" d="${S}" clip-path="url(#${id}f)"/>`, inner => `<g clip-path="url(#${id}s)"><g clip-path="url(#${id}f)">${inner}</g></g>`, S + divider, rot)}
    <g clip-path="url(#${id}s)"><g clip-path="url(#${id}e)"><path class="h" d="${hatch}"/></g></g>
    ${det ? `<g clip-path="url(#${id}e)"><path class="l" d="${det}"/></g><g clip-path="url(#${id}f)"><path class="w" d="${det}"/></g>` : ''}
    ${dust || ''}<path class="l" d="${S}"/>${moreL || ''}<path class="l" d="${divider}"/><path class="l" d="${serif}"/>`;
  const S = 'M.5 8.6L-6.9.4-8.3-3.3-7.6-6.3-5-7.6-2.3-7.2-.2-4.8 1.3-7.2 4.1-8 7.1-7.1 8.3-4 7-.3Z', E = 'M-12.4-.6H-4.2L-3-3.4-1.7 1.1 0-2.8 1-.6H12.4';
  return two(S, E + 'V-20H-12.4Z', E + 'V20H-12.4Z', E, 'M-12.4-1.5V.3M12.4-1.5V.3', '', hl(-50, [-3.2, -1.4, .4, 2.2]), '', tixDust(t => [-7.4 + t * 14.6, -.6, 0, 1], 72, id));
}

/* ---------- 铅笔：照搬主页 main.js 的 hand() / hatch()（chat.js 邮票那份），单位 PU 取 1（主页手机上 U≈0.9）。
   笔触先按层收起来：每层先用纸色把自己的外形填掉（挡住后面的线），再画自己的线，像一张一张叠上去 ---------- */
const PU = 1;
let SKR = rng(1), CUR = null, LAYERS = [];
function layer(...fills) { CUR = { f: fills.filter(Boolean), s: [], d: [], b: [], t: [] }; LAYERS.push(CUR); return CUR; }
function hand(pts, o) {
  o = o || {}; const list = CUR.s, w = o.w || 0.6, al = o.a || 0.45, n = o.n || 2, jit = (o.j === undefined ? 0.7 : o.j) * PU, ov = (o.ov === undefined ? 3 : o.ov) * PU, c = o.c || 0, fd = o.fade || [1, 1];
  const m = pts.length; if (m < 2) return; const Ls = new Array(m); Ls[0] = 0; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8 * PU)) return;
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * SKR(), s1 = L + ov * SKR();
    if (ps) { const span = 0.4 + 0.6 * SKR(), st = SKR() * (1 - span); s0 = L * st - ov * 0.4 * SKR(); s1 = L * (st + span) + ov * 0.4 * SKR(); }
    const off = (SKR() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = SKR() * TAU, p2 = SKR() * TAU, p3 = SKR() * TAU, f1 = TAU / ((70 + SKR() * 90) * PU), fq2 = TAU / ((16 + SKR() * 20) * PU), f3 = TAU / ((36 + SKR() * 60) * PU), pa = ps ? 0.5 + 0.4 * SKR() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = (10 + SKR() * 16) * PU;
    for (let guard = 0; guard < 8000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * fq2 + p2));
      cur.push(a[0] + tx * f - ty * d, a[1] + ty * f + tx * d);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 4) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * SKR()), ff = fd[0] + (fd[1] - fd[0]) * clamp(sm / L, 0, 1);
          let lw = 1, la = 1, keep = true;
          if (o.sd) { const k = clamp((-ty * 0.55 + tx * 0.83) * o.sd, -1, 1); lw = 0.88 + 0.36 * k; la = 0.9 + 0.3 * k; if (k < -0.72 && ps && SKR() < 0.6) keep = false; }
          if (keep) list.push({ p: cur, w: w * (0.55 + 0.7 * pr) * Math.sqrt(PU) * lw, a: Math.min(0.95, al * pa * ff * (0.5 + 0.75 * pr) * la), c }); }
        if (s >= s1) break; cur = cur.slice(-2); acc = 0; segL = (10 + SKR() * 16) * PU;
      }
      const stp = Math.max(0.01, Math.min(3.2 * PU, s1 - s)); s += stp; acc += stp;
    }
  }
}
function hatchP(poly, deg, gap, o) {   // 排线：一组平行的短笔，两头参差（主页 hatch()）
  const t = deg * PI / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * PU * (0.3 + SKR() * 0.5); d < mx; d += gap * PU * (0.72 + SKR() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.6 * PU) continue; const a = xs[i] + l * SKR() * 0.14, b = xs[i + 1] - l * SKR() * 0.14; hand([[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o); }
  }
}
// 笔：CL 辅助线、OL 轮廓、OLs 细轮廓、HT 排线
const CL = { w: 0.36, a: 0.15, n: 1, j: 0.4, ov: 7 }, OL = { w: 0.56, a: 0.56, n: 2, j: 0.55, ov: 2.4 }, OLs = { w: 0.46, a: 0.38, n: 2, j: 0.35, ov: 1.4 }, HT = { w: 0.4, a: 0.27, n: 1, j: 0.2, ov: 0.8 };
const pen = (o, x) => Object.assign({}, o, x);
const arcPts = (cx, cy, a, b, rot, t0, t1) => { const n = Math.max(8, Math.ceil(Math.abs(t1 - t0) * Math.max(a, b) / 1.6)), cr = Math.cos(rot), sr = Math.sin(rot), out = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = Math.cos(t) * a, y = Math.sin(t) * b; out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return out; };
function cm(pts, k, closed) {   // Catmull-Rom 把几颗控制点连成顺的曲线
  k = k || 8; const out = [], n = pts.length, P = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < k; j++) { const t = j / k, t2 = t * t, t3 = t2 * t, f = q => 0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3); out.push([f(0), f(1)]); } }
  out.push(closed ? out[0] : pts[n - 1]); return out;
}
function resample(pts, step) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { let a = pts[i - 1]; const b = pts[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + d >= step) { const f = (step - acc) / d; a = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; out.push(a); d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0; }
    acc += d; }
  const last = pts[pts.length - 1], e = out[out.length - 1]; if (Math.hypot(last[0] - e[0], last[1] - e[1]) > step * 0.3) out.push(last);
  return out;
}
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

/* ---------- 心脏：前视的解剖图，单位格子约 160×210（y 向下），T() 换成页面像素。光从左上来，右下一侧排线 ---------- */
let S = 1, OX = 0, OY = 0, ART_H = 0, ECG_Y = 0, ECG_X = 0, PERF = null;
const T = p => [OX + p[0] * S, OY + p[1] * S];
const U = pts => pts.map(T);
function tube(ctrl, w0, w1) {   // 一截血管：中线 + 两条边，宽度从 w0 渐到 w1（单位格）
  const R = resample(cm(U(ctrl), 10), 1.6), n = R.length, N = [], W = [], L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, w = (w0 + (w1 - w0) * i / Math.max(1, n - 1)) * S;
    N.push([nx, ny]); W.push(w); L.push([R[i][0] + nx * w / 2, R[i][1] + ny * w / 2]); Rt.push([R[i][0] - nx * w / 2, R[i][1] - ny * w / 2]);
  }
  return { C: R, N, W, L, R: Rt, poly: L.concat(Rt.slice().reverse()) };
}
function capGeo(tb, end) { const i = end ? tb.C.length - 1 : 0, c = tb.C[i], nv = tb.N[i], w = tb.W[i]; return { c, rot: Math.atan2(nv[1], nv[0]), a: w / 2, b: Math.max(1.1, w * 0.22) }; }
function capPoly(tb, end) { const k = capGeo(tb, end); return arcPts(k.c[0], k.c[1], k.a, k.b, k.rot, 0, TAU); }
function drawCap(tb, end, blue) {   // 断口：椭圆截面，外圈 + 内圈一道壁厚，壁上一排很短的径向刻线；管腔里排暗线，静脉的（只在心电线以下）填实心蓝
  const { c, rot, a, b } = capGeo(tb, end), ia = a * 0.76, ib = b * 0.62;
  hand(arcPts(c[0], c[1], a, b, rot, 0.3, TAU + 0.45), pen(OLs, { ov: 0.6 }));
  const inner = arcPts(c[0], c[1], ia, ib, rot, 0, TAU);
  stroke(arcPts(c[0], c[1], ia, ib, rot, 0, TAU + 0.12), 0.32, 0.5, 1);
  const cr = Math.cos(rot), sr = Math.sin(rot), ep = (A, B, t) => { const x = Math.cos(t) * A, y = Math.sin(t) * B; return [c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]; };
  for (let t = 0.15; t < PI - 0.1; t += 0.26) stroke([ep(a * 0.97, b * 0.94, t), ep(ia * 1.04, ib * 1.06, t)], 0.28, 0.32, 1);   // 下半圈的壁
  if (blue) CUR.b.push(arcPts(c[0], c[1], ia * 0.92, ib * 0.86, rot, 0, TAU));
  else hatchP(inner, rot * 180 / PI, 0.8, { w: 0.3, a: 0.42, n: 1, j: 0.06, ov: 0, c: 1 });
}
const nrm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function offsetLine(P, hw, sg) { const n = P.length; return P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1]]), h = typeof hw === 'number' ? hw : hw[i]; return [p[0] - t[1] * h * sg, p[1] + t[0] * h * sg]; }); }
function ribbon(P, hw) { return offsetLine(P, hw, 1).concat(offsetLine(P, hw, -1).reverse()); }
function stroke(P, w, a, c) {   // 刻刀的线：不抖、平头，按三四个点一段推进去（宽度、浓淡可以跟着段变）
  for (let i = 0; i + 1 < P.length; i += 3) { const seg = P.slice(i, i + 4); if (seg.length < 2) break; CUR.s.push({ p: seg.flat(), w: typeof w === 'function' ? w(i) : w, a: typeof a === 'function' ? a(i) : a, c: c || 0, k: 1 }); }
}
const cutR = (p, from, to) => p.slice(Math.floor((from || 0) * (p.length - 1)), Math.ceil((to === undefined ? 1 : to) * (p.length - 1)) + 1);
function edges(tb, o, from, to) {   // 两条边，可以只画一截（0–1）；L 边外法向是 +N，R 边是 −N，背光的那边自动压重
  hand(cutR(tb.L, from, to), pen(o, { sd: 1 })); hand(cutR(tb.R, from, to), pen(o, { sd: -1 }));
}
function tubeHatch(tb, gap, frac, o, from, to) {   // 管子背光一侧切一条带子，带子里的排线跟着管轴斜 55°（转弯处跟着转）
  const n = tb.C.length, i0 = Math.floor((from || 0) * (n - 1)), i1 = Math.ceil((to === undefined ? 1 : to) * (n - 1)), sd = i => { const v = tb.N[i]; return v[0] * 0.55 + v[1] * 0.83 > 0.12 ? 1 : v[0] * 0.55 + v[1] * 0.83 < -0.12 ? -1 : 0; };
  let run = [];
  const flush = () => {
    if (run.length >= 3 && sd(run[0])) {
      const q = sd(run[0]);
      for (let s0 = 0; s0 < run.length - 2; s0 += 7) {   // 一小段一小段地排，弯管上的线跟着转
        const part = run.slice(s0, s0 + 9); if (part.length < 3) break;
        const out = part.map(i => q > 0 ? tb.L[i] : tb.R[i]), inn = part.map((i, k) => { const v = tb.N[i], e = q > 0 ? tb.L[i] : tb.R[i], l = tb.W[i] * frac * (0.8 + 0.35 * Math.sin((s0 + k) * 0.5 + i)); return [e[0] - v[0] * q * l, e[1] - v[1] * q * l]; });
        const a = tb.C[part[0]], b = tb.C[part[part.length - 1]], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / PI;
        hatchP(out.concat(inn.reverse()), ang + 55 * q, gap, o);
      }
    }
    run = [];
  };
  for (let i = i0; i <= i1; i++) { if (run.length && sd(i) !== sd(run[run.length - 1])) flush(); run.push(i); }
  flush();
}
function arcHatch(poly, c, gap, o) {   // 绕着体积转的排线：以 c 为圆心的一圈圈弧，只留落在 poly 里的那几截
  let r0 = 1e9, r1 = 0; const angs = poly.map(p => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); r0 = Math.min(r0, d); r1 = Math.max(r1, d); return Math.atan2(p[1] - c[1], p[0] - c[0]); });
  const m = angs.reduce((s, a) => s + Math.cos(a), 0), mm = angs.reduce((s, a) => s + Math.sin(a), 0), mid = Math.atan2(mm, m);
  let a0 = 1e9, a1 = -1e9; angs.forEach(a => { let d = a - mid; while (d > PI) d -= TAU; while (d < -PI) d += TAU; a0 = Math.min(a0, d); a1 = Math.max(a1, d); });
  if (inPoly(c[0], c[1], poly)) { a0 = -PI; a1 = PI; r0 = 0; }
  for (let r = r0 + gap * SKR(); r < r1; r += gap * (0.75 + 0.5 * SKR())) {
    const st = 1.3 / Math.max(r, 1); let run = [];
    const fl = () => { if (run.length >= 3) { const k = run.length, t0 = Math.floor(k * 0.12 * SKR()), t1 = k - Math.floor(k * 0.12 * SKR()); if (t1 - t0 >= 3) hand(run.slice(t0, t1), o); } run = []; };
    for (let a = mid + a0 - st; a <= mid + a1 + st; a += st) { const x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r; if (inPoly(x, y, poly)) run.push([x, y]); else fl(); }
    fl();
  }
}
function crinkle(pts, amp, freq) {   // 心耳的边：沿法向加一点细碎的起伏
  const R = resample(pts, 1.2), n = R.length;
  return R.map((p, i) => { const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = amp * (Math.sin(i * freq) * 0.7 + Math.sin(i * freq * 2.3 + 1) * 0.3); return [p[0] - (b[1] - a[1]) / l * k, p[1] + (b[0] - a[0]) / l * k]; });
}
function serrate(pts, amp, per, sg, seed) {   // 心耳的锯齿褶边：不对称的小齿（缓上陡下），齿高一颗一颗不一样；两头（贴着心房的根部）收平
  sg = sg || areaSd(pts); const R = resample(pts, 0.45), n = R.length, Rn = rng(seed); let Ltot = 0; const s = [0]; for (let i = 1; i < n; i++) { Ltot += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]); s.push(Ltot); }
  const H = []; for (let k = 0; k < Ltot / per + 2; k++) H.push(0.55 + 0.9 * Rn());
  const out = R.map((p, i) => { const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.floor(s[i] / per), f = s[i] / per - k, sh = f < 0.7 ? f / 0.7 : (1 - f) / 0.3, env = Math.pow(Math.max(0, Math.sin(PI * s[i] / Ltot)), 0.7), d = amp * H[k] * sh * env * sg; return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d]; });
  const valleys = []; for (let k = 1; k < Ltot / per; k++) { const i = s.findIndex(v => v >= k * per); if (i > 0 && i < n - 1) { const env = Math.sin(PI * s[i] / Ltot); if (env > 0.35) { const a = R[i - 1], b = R[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; valleys.push([out[i], [(b[1] - a[1]) / l * sg, -(b[0] - a[0]) / l * sg], env, H[k]]); } } }
  return { pts: out, valleys };
}
function stipple(poly, n, rmax) { const Rn = SKR; let xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let k = 0, got = 0; k < n * 8 && got < n; k++) { const x = x0 + Rn() * (x1 - x0), y = y0 + Rn() * (y1 - y0); if (!inPoly(x, y, poly)) continue; CUR.d.push([x, y, 0.22 + Rn() * Rn() * rmax]); got++; } }
const areaSd = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? -1 : 1; };   // 屏幕坐标里绕向 → 外法向在 (−ty,tx) 的哪一侧

/* 引线落点（单位格）：主动脉弓、右心房、左心室、肺动脉干、上腔静脉、右心室、下腔静脉；组少就取前几个，再按高低排 */
const ANCHORS = [[123, 31], [44, 124], [177, 166], [127, 80], [56, 62], [104, 160], [47, 186]];

/* 一张铅笔草稿的心。整颗都用主页 hand() 的笔，构造线留在图上。
   暗处是一组组绕着心室鼓起来的铅笔弧。
   血：线以上，冠脉是两条松的管壁，管里两三股细血线像拧得很松的绳子交错着走——动脉红（这一页特许的独一一处红），静脉蓝；大血管里也露一段。
   线以下（心电线挪到心室中段偏上），铅笔的心照旧画下去，只有血变了：每股血线过线先变虚、落几粒点，再散成一串很小的数字顺着原路往下走，越往下越松越淡。
   数字用这页的真数据（三组文件的字节数和修改时间），没数据时只有点和短划。
   解剖：前面观，心室是斜放的钝圆锥，长轴约 55°，心尖圆钝指向观者右下、左边一道小切迹；右缘是右心房，下缘一条往右下倾的缓弧，左缘饱满外凸再收进心尖。
   肺动脉干从右室圆锥发出、往右上斜，压在升主动脉根部前面；弓上三支从左到右头臂干、左颈总、左锁骨下；上腔静脉在右上进右房；右心耳盖在主动脉根右前方，左心耳在肺动脉干右侧。 */
let SEAM = 140;   // 心电线在图里的高度（图内单位）。线可以上下拖：往上拖，线下的数字多；往下拖，线上的血多
const SEAM_MIN = 62, SEAM_MAX = 196, SEAM_KEY = 'ta_heart_seam';
try { const v = parseFloat(localStorage.getItem(SEAM_KEY)); if (v >= SEAM_MIN && v <= SEAM_MAX && !new URLSearchParams(location.search).has('demo')) SEAM = v; } catch (e) {}
const BODY = [[52, 94], [44, 106], [39.5, 124], [38.5, 141], [40.5, 156], [45.5, 168], [54, 175], [68, 180], [88, 185.5], [110, 190.5], [132, 195.5], [149, 200], [157.5, 202.8], [161.5, 202.2], [165.5, 204.4], [172, 207], [177.5, 202], [182.5, 191], [186.2, 174.5], [187.2, 157], [184.5, 139], [178, 126], [169, 115.5], [161, 110.5], [148, 105], [132, 104], [112, 106], [94, 104], [74, 98]];
const AVG = [[77, 103], [71, 121], [63.5, 141], [56, 159], [51, 173]];   // 右房室沟
const LADP = [[131, 108], [139.5, 124], [147, 142], [153, 160], [157.5, 178], [160.5, 194], [161.5, 202.2]];   // 前室间沟，落到心尖切迹
const AP = [166, 201], AX0 = [104, 101], AX1 = [172.5, 207];   // 长轴：心底中点 → 心尖
let BODYU = [], DIG = '', DIGI = 0, SINCE = null, STREAMS = [];
const hole = () => false;
const yU = p => (p[1] - OY) / S;

function buildArt() {
  SKR = rng(20261113); LAYERS = []; CUR = null; STREAMS = []; DIGI = 0;
  BODYU = cm(BODY, 8, true);
  // 0 · 没擦的构造线：长轴、框成锥形的几根直线、外接椭圆几段、中心十字
  layer();
  hand(U([[90, 80], [184, 222]]), CL);
  hand(U([[34, 112], [178, 214]]), pen(CL, { a: 0.12 })); hand(U([[192, 118], [168, 216]]), pen(CL, { a: 0.12 })); hand(U([[36, 100], [190, 114]]), pen(CL, { a: 0.11 }));
  for (let a = -0.3; a < TAU - 0.6;) { const len = 0.25 + SKR() * 0.5; hand(arcPts(...T([113, 152]), 88 * S, 58 * S, 1.0, a, a + len), CL); a += len + 0.14 + SKR() * 0.3; }
  [[113, 152], [93, 108], [113, 116], [57, 62], [122, 33], AX1].forEach(q => { const c = T(q), r = 3 + SKR() * 1.5; hand([[c[0] - r, c[1]], [c[0] + r, c[1]]], pen(CL, { a: 0.22, ov: 0.6 })); hand([[c[0], c[1] - r], [c[0], c[1] + r]], pen(CL, { a: 0.22, ov: 0.6 })); });
  // 1 · 最后面：弓上三支、下腔静脉
  const bt = tube([[104, 37], [101.5, 24], [97.5, 12], [93.5, 3]], 10, 8.6), lcc = tube([[118, 31], [118.6, 19], [119.8, 7]], 6.2, 5.6), lsa = tube([[129.5, 32], [132.5, 21], [137, 10]], 7.2, 6.3);
  const ivc = tube([[47.5, 170], [46.8, 180], [46.2, 188]], 13.5, 13);
  layer(bt.poly, lcc.poly, lsa.poly, capPoly(bt, 1), capPoly(lcc, 1), capPoly(lsa, 1), ivc.poly, capPoly(ivc, 1));
  [bt, lcc, lsa].forEach(b => { edges(b, OLs); tubeLines(b, 3); capPencil(b); });
  edges(ivc, OLs, 0.3, 1); tubeLines(ivc, 3, 0.3, 1); capPencil(ivc);
  // 2 · 右肺动脉：在升主动脉后面，弓下露一小截
  const rpa = tube([[138, 66], [124, 63.5], [108, 64], [96, 65.5]], 11, 10);
  layer(rpa.poly); edges(rpa, pen(OLs, { a: 0.32 })); tubeLines(rpa, 3);
  // 3 · 主动脉（升部、弓、降部起头）和上腔静脉
  const ao = tube([[93, 108], [90.5, 88], [91, 68], [95, 51], [104, 39], [116, 32], [129, 31.5], [140, 37], [147, 47], [150, 60]], 21, 17);
  const svc = tube([[58, 104], [57.5, 82], [56.2, 60], [55.2, 40]], 19.5, 17.5);
  layer(ao.poly, svc.poly, capPoly(svc, 1));
  edges(ao, OL); hand(cutR(ao.R, 0, 0.45), pen(OLs, { sd: -1, n: 1, a: 0.32 })); tubeLines(ao, 5); xArcs(ao, [0.5, 0.78]);
  edges(svc, OL, 0.05, 1); tubeLines(svc, 4, 0.05, 1); xArcs(svc, [0.55]); capPencil(svc);
  hand(cm(U([[96, 50], [104, 44], [113, 41]]), 6), pen(HT, { a: 0.22 }));   // 弓前面一道淡的形体线
  { const e = U([[100, 102], [101.5, 92], [104, 84], [108, 77]]), f = U([[96, 103], [97, 92], [99.5, 83], [103.5, 75]]); hatchP(e.concat(f.reverse()), 70, 1.5, pen(HT, { a: 0.34 })); }   // 肺动脉干压在升主动脉上的影
  arcHatch(U([[100, 46], [112, 40.5], [126, 40], [138, 44], [142, 52], [130, 50], [116, 50], [104, 54]]), T([122, 90]), 2.2, pen(HT, { a: 0.24 }));   // 弓下内侧的暗
  // 4 · 心脏本体
  const body = cm(U(BODY), 8, true), bsd = areaSd(body);
  layer(body);
  hand(cm(U(BODY.slice(0, 24)), 8), pen(OL, { sd: bsd }));
  hand(cm(U(BODY.slice(0, 7)), 8), pen(OLs, { sd: bsd, n: 1, a: 0.34 }));   // 右缘再描一遍
  hand(cm(U(BODY.slice(0, 24)), 8).filter((_, i) => i > 44 && i < 150), pen(OL, { sd: bsd, n: 1, a: 0.42 }));   // 下缘、心尖、左缘下半再压一遍
  hand(cm(U([[161, 110.5], [154, 106.5], [147, 105]]), 6), pen(OLs, { sd: bsd }));
  hand(cm(U(AVG), 8), pen(OLs, { a: 0.34 })); hand(cm(U(LADP), 8), pen(OLs, { a: 0.3 }));   // 两道沟
  hand(cm(U([[60, 128], [92, 134], [124, 136], [154, 131], [182, 124]]), 8), pen(CL, { a: 0.16 }));   // 两道很淡的横截形体线
  hand(cm(U([[48, 162], [84, 172], [120, 177], [152, 175], [184, 166]]), 8), pen(CL, { a: 0.14 }));
  // 暗处的几组铅笔弧：绕着心室鼓起来
  const W = pen(HT, { w: 0.48, a: 0.46, n: 1, j: 0.3, ov: 2.2 });
  wrapGroup(0.5, 0.96, 0.42, 1.06, 12, 0.32, W);                          // 左室缘下半和心尖背光一侧
  wrapGroup(0.58, 0.95, -1.04, -0.6, 10, 0.3, W);                         // 下缘
  wrapGroup(0.07, 0.17, -0.25, 0.8, 7, 0.22, pen(W, { a: 0.3 }));         // 大血管根部下面
  wrapGroup(0.8, 0.98, 0.0, 0.5, 5, 0.3, pen(W, { a: 0.32 }));            // 心尖再压几笔
  sulcus(AVG, 0.05, 0.75, 9); sulcus(LADP, 0.03, 0.4, 6);                 // 沟里短短的一撮
  { const L = 4; for (let k = 0; k < L; k++) { const y = 150 + k * 5 + SKR() * 2, x0 = xAt([[39.5, 124], [38.5, 141], [40.5, 156], [45.5, 168], [54, 177]], y) - 0.5, x1 = xAt(AVG, y) - 1; if (x1 > x0 + 2) hand(cm(U([[x0, y], [(x0 + x1) / 2, y + 1.6], [x1, y + 0.4]]), 5), pen(W, { a: 0.3 })); } }   // 右房下端靠下腔静脉
  // 5 · 冠脉只留两条很淡的示意：右冠贴着右房室沟、前降支贴着前室间沟，不上色
  { const o = pen(HT, { w: 0.36, a: 0.24, n: 1, j: 0.2, ov: 0.6 }); [[AVG, 1.6], [LADP, -1.6]].forEach(([pl, d]) => { const P = U(cm(pl, 8)); hand(offsetLine(P, d * S, 1), o); hand(offsetLine(P, d * S * 0.1, 1), pen(o, { a: 0.18 })); }); }
  // 6 · 右心耳、左心耳：锯齿褶边，几笔松的排线
  const rau = serrate(cm(U([[53, 99], [61, 90], [72, 84.5], [86, 82.5], [97, 85], [89, 92], [79, 99], [66, 104.5]]), 8, true), 1.3 * S, 2.5 * S, 0, 31);
  arcHatch(U([[64, 106], [78, 101], [90, 94], [97, 92], [92, 100], [80, 107], [66, 110]]), T([60, 60]), 2.1, pen(HT, { a: 0.22 }));
  layer(rau.pts); hand(rau.pts, pen(OLs, { sd: areaSd(rau.pts), j: 0.25 }));
  folds(rau.valleys);
  hatchP(U([[60, 99], [74, 95], [88, 89], [95, 86], [89, 92], [79, 99], [66, 104.5]]), 28, 1.9, pen(HT, { a: 0.26 }));
  const lau = serrate(cm(U([[160, 110], [150, 106], [141, 100], [137, 95.5], [145, 94.5], [155, 97], [163, 103]]), 8, true), 1.15 * S, 2.2 * S, 0, 32);
  layer(lau.pts); hand(lau.pts, pen(OLs, { sd: areaSd(lau.pts), j: 0.25 }));
  folds(lau.valleys);
  hatchP(U([[160, 110], [150, 106], [146, 103], [156, 103], [163, 104]]), 30, 1.8, pen(HT, { a: 0.28 }));
  // 7 · 左肺动脉、8 · 肺动脉干（最前面，走的是静脉血：蓝）
  const lpa = tube([[134, 66], [148, 61], [161, 60.5], [173, 63]], 12, 10.4);
  layer(lpa.poly, capPoly(lpa, 1));
  edges(lpa, OL, 0.15, 1); tubeLines(lpa, 3, 0.15, 1); capPencil(lpa);
  const pt = tube([[112, 116], [114.5, 100], [120, 86], [128, 74], [138, 64.5]], 26, 21);
  layer(pt.poly);
  hand(pt.L, pen(OL, { sd: 1, fade: [0.1, 1] })); hand(pt.R, pen(OL, { sd: -1, fade: [0.1, 1] }));
  hand(arcPts(...T([139.5, 63.5]), 10.4 * S, 2.6 * S, Math.atan2(pt.N[pt.N.length - 1][1], pt.N[pt.N.length - 1][0]), PI * 1.05, PI * 1.95), pen(OLs, { ov: 0.4 }));   // 分叉口的上沿
  tubeLines(pt, 5, 0.1, 1); xArcs(pt, [0.4, 0.7]);
  hand(cm(U([[106, 104], [110, 92], [116, 82]]), 6), pen(CL, { a: 0.2 }));   // 圆锥上一道淡的形体线
  // 9 · 瓣口的淡记号，最后是两条主血流（压在所有铅笔线上面；被挡住的段落自己变虚）
  layer(); valveRings();
  drawFlows();
}

/* ---------- 草稿的几样工具 ---------- */
function xAt(pl, y) { let i = 1; while (i < pl.length - 1 && pl[i][1] < y) i++; const a = pl[i - 1], b = pl[i]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); }
const region = (x, y) => x < xAt(AVG, y) ? 0 : x > xAt(LADP, y) ? 2 : 1;
function nearSeg(p, pl, closed) {   // 到折线最近的距离和那一段的走向
  let best = 1e18, tx = 1, ty = 0; const n = pl.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = pl[i], b = pl[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = a[0] + dx * t - p[0], ey = a[1] + dy * t - p[1], d = ex * ex + ey * ey; if (d < best) { best = d; const l = Math.sqrt(l2); tx = dx / l; ty = dy / l; } }
  return [Math.sqrt(best), tx, ty];
}
function rayLen(o, d) {   // 从 o 沿 d 走到心室外缘的距离
  let best = 0; const P = BODYU;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-9) continue; const wx = a[0] - o[0], wy = a[1] - o[1], t = (wx * ey - wy * ex) / den, s = (wx * d[1] - wy * d[0]) / den; if (t > 0 && s >= 0 && s <= 1) best = Math.max(best, t); }
  return best;
}
function wrapGroup(t0, t1, s0, s1, n, bow, o) {   // 一组横截弧：在长轴上一站一站，每站一道垂直于长轴、往心尖弯的弧，只画 s0..s1 那一截
  const D = nrm([AX1[0] - AX0[0], AX1[1] - AX0[1]]), Nn = [D[1], -D[0]], L = Math.hypot(AX1[0] - AX0[0], AX1[1] - AX0[1]);
  for (let k = 0; k < n; k++) {
    const t = t0 + (t1 - t0) * (k + 0.85 * SKR()) / n, c = [AX0[0] + D[0] * L * t, AX0[1] + D[1] * L * t], wR = rayLen(c, Nn), wL = rayLen(c, [-Nn[0], -Nn[1]]);
    if (wR < 1 || wL < 1) continue;
    const a = s0 + (SKR() - 0.3) * 0.2, b = s1 + (SKR() - 0.6) * 0.2, pts = [];
    for (let q = 0; q <= 16; q++) { const s = a + (b - a) * q / 16, w = s >= 0 ? wR : wL, bw = bow * Math.sqrt(Math.max(0, 1 - s * s)) * (wR + wL) * 0.5 * 0.45; pts.push([c[0] + Nn[0] * s * w + D[0] * bw, c[1] + Nn[1] * s * w + D[1] * bw]); }
    hand(U(pts), pen(o, { a: o.a * (0.75 + 0.5 * SKR()) }));
  }
}
function sulcus(pl, f0, f1, n) {   // 沟里的暗：几笔短的斜撇，贴着沟
  const P = resample(cm(pl, 8), 0.8), m = P.length;
  for (let k = 0; k < n; k++) { const i = clamp(Math.floor((f0 + (f1 - f0) * (k + SKR() * 0.6) / n) * (m - 1)), 1, m - 2), a = P[i - 1], b = P[i + 1], t = nrm([b[0] - a[0], b[1] - a[1]]), nn = [-t[1], t[0]], c = P[i], l = 2.2 + SKR() * 2; hand(U([[c[0] - nn[0] * l * 0.5 - t[0] * 0.8, c[1] - nn[1] * l * 0.5 - t[1] * 0.8], [c[0] + nn[0] * l * 0.5 + t[0] * 0.8, c[1] + nn[1] * l * 0.5 + t[1] * 0.8]]), pen(HT, { a: 0.32, ov: 0.6 })); }
}
function tubeLines(tb, k, from, to) {   // 大血管：背光一侧几根顺着管身的弧线，长短不齐
  const n = tb.C.length, i0 = Math.floor((from || 0) * (n - 1)), i1 = Math.ceil((to === undefined ? 1 : to) * (n - 1)), m = i => { const v = tb.N[i]; return v[0] * 0.55 + v[1] * 0.83; };
  for (let j = 0; j < k; j++) {
    const o = 0.9 - 0.55 * j / Math.max(1, k - 1), need = 0.15 + 0.4 * (1 - o), a0 = i0 + Math.floor((i1 - i0) * SKR() * 0.25), a1 = i1 - Math.floor((i1 - i0) * SKR() * 0.3); let run = [], sg = 0;
    const fl = () => { if (run.length >= 5) hand(run, pen(HT, { w: 0.44, a: 0.42 - 0.12 * j / k, j: 0.3, ov: 1.6 })); run = []; };
    for (let i = a0; i <= a1; i++) { const q = m(i), s = q > 0 ? 1 : -1; if (Math.abs(q) < need || (sg && s !== sg)) { fl(); sg = Math.abs(q) < need ? 0 : s; if (Math.abs(q) < need) continue; } sg = s; const v = tb.N[i], w = tb.W[i] / 2 * o * s; run.push([tb.C[i][0] + v[0] * w, tb.C[i][1] + v[1] * w]); }
    fl();
  }
}
function xArcs(tb, fr) {   // 一两道截面弧：半个扁椭圆，背光那半深一点
  const n = tb.C.length;
  for (const f of fr) { const i = clamp(Math.round(f * (n - 1)), 1, n - 2), c = tb.C[i], N = tb.N[i], t = [N[1], -N[0]], w = tb.W[i] / 2, sb = Math.abs(t[1]) > 0.2 ? Math.sign(t[1]) : 1, pts = [];
    for (let q = 0; q <= 16; q++) { const th = -PI / 2 + PI * q / 16; pts.push([c[0] + N[0] * Math.sin(th) * w + t[0] * Math.cos(th) * w * 0.22 * sb, c[1] + N[1] * Math.sin(th) * w + t[1] * Math.cos(th) * w * 0.22 * sb]); }
    hand(pts, pen(HT, { w: 0.42, a: 0.3, j: 0.2, ov: 1.2 })); }
}
function capPencil(tb) {   // 断口：椭圆带一圈壁厚，管腔里几笔；外面一个没擦的草稿圈
  const { c, rot, a, b } = capGeo(tb, 1);
  hand(arcPts(c[0], c[1], a * 1.25, a * 1.25, 0, 0.4, TAU + 0.2), pen(CL, { a: 0.14, ov: 1 }));
  hand(arcPts(c[0], c[1], a, b, rot, 0.3, TAU + 0.45), pen(OLs, { ov: 0.6 }));
  hand(arcPts(c[0], c[1], a * 0.74, b * 0.6, rot, 0.2, TAU + 0.3), pen(HT, { a: 0.36, ov: 0.3 }));
  hatchP(arcPts(c[0], c[1], a * 0.7, b * 0.55, rot, 0, TAU), rot * 180 / PI + 20, 1.1, pen(HT, { a: 0.34, ov: 0.2 }));
}
function folds(vs) { vs.forEach(([p, d, e, h]) => { const L = (1.3 + 2 * e * h) * S, bend = (SKR() - 0.5) * 0.9; hand(cm([p, [p[0] + d[0] * L * 0.5 - d[1] * bend, p[1] + d[1] * L * 0.5 + d[0] * bend], [p[0] + d[0] * L, p[1] + d[1] * L]], 4), pen(HT, { a: 0.3, ov: 0.3 })); }); }
/* ---------- 血 ---------- */
function fillDigits() {   // 等所有数字流都排好了再填字：有数据用这页的真数字，没数据就用短划；最靠心尖那一串留给 ta_heart_since
  let near = null, bd = 1e9; const ap = T(AP);
  STREAMS.forEach(st => { if (!st.pts.length) return; const d = Math.min(...st.all.map(p => Math.hypot(p[0] - ap[0], p[1] - ap[1]))); if (d < bd) { bd = d; near = st; } });
  STREAMS.forEach(st => {
    const src = st === near && SINCE !== null ? String(SINCE) + ' ' : DIG;
    st.pts.forEach((it, k) => { if (!src) { it.ch = k % 3 === 2 ? null : '-'; if (!it.ch) { it.r = 0.3; } return; } const ch = src[(st === near && SINCE !== null ? k : DIGI++) % src.length]; if (ch === ' ') { it.ch = null; it.r = 0.26; } else it.ch = ch; });
  });
}
/* ---------- 两条主血流（前面观，观者左 = 心的右侧） ----------
   蓝：上腔静脉自上而下、下腔静脉自下而上，汇进右心房 → 过三尖瓣往观者右下进右心室 → 在右室下部 U 形折返往上 → 右室流出道 → 肺动脉瓣 → 肺动脉干往观者右上 →
       分叉：左肺动脉往观者右出画；右肺动脉往观者左，钻到升主动脉和上腔静脉后面（虚、淡出）。
   红：肺静脉从后面进左心房（看不见，从左心耳后面淡入）→ 二尖瓣（在后面，虚）→ 左心室：顺左缘往下到心尖 → 折返往上，走室间隔左边，被右室前壁挡着（虚）→
       左室流出道 → 主动脉瓣（在肺动脉干根部后面，虚）→ 升主动脉在肺动脉干的观者左侧露出来往上 → 弓 → 分三股进头臂干、左颈总、左锁骨下，主干绕去后下（降主动脉，淡出）。
   节点：[x, y, 半束宽, 浓淡, 在后面(0–1)]，节点之间平滑过渡，浓淡和宽窄都是慢慢变的。 */
const FLOWS = [
  { c: 2, ns: 4, lam: 15, nodes: [[55.4, 41, 1.6, 0.08, 0], [56, 52, 2.2, 0.62, 0], [57, 74, 2.5, 0.72, 0], [57.8, 92, 2.9, 0.68, 0.2], [58, 101, 3.4, 0.55, 0.7], [57.4, 114, 4.2, 0.55, 0.15], [60, 128, 4.6, 0.52, 0], [66.5, 140, 3.6, 0.56, 0], [80, 156, 4.6, 0.52, 0], [98, 171, 5.2, 0.5, 0], [117, 181, 5.6, 0.48, 0], [133, 178.5, 6, 0.48, 0], [139, 164, 5.4, 0.5, 0], [131, 146, 4.4, 0.55, 0], [121.5, 129, 3.6, 0.62, 0], [114, 117, 3, 0.68, 0], [115, 101, 3.2, 0.74, 0], [120, 87, 3.2, 0.78, 0], [128, 75, 3, 0.78, 0], [137, 66.5, 2.8, 0.74, 0], [148, 61.6, 2.4, 0.68, 0], [161, 60.6, 2.2, 0.5, 0], [171.5, 62.6, 1.8, 0.06, 0]] },
  { c: 2, ns: 3, lam: 14, nodes: [[137, 66.5, 2.4, 0.74, 0], [129, 64.6, 2.2, 0.66, 0], [117, 63.9, 2, 0.58, 0], [104, 64.4, 1.8, 0.48, 0.3], [95, 65.6, 1.6, 0.36, 1], [86, 66.6, 1.4, 0.05, 1]] },   // 右肺动脉
  { c: 2, ns: 3, lam: 14, nodes: [[46.3, 190, 1.8, 0.06, 0], [46.7, 181, 2.4, 0.5, 0], [47.6, 171, 2.8, 0.52, 0], [50, 158, 3.4, 0.5, 0], [54.5, 146, 3.8, 0.5, 0], [60, 134, 4.2, 0.5, 0]] },   // 下腔静脉
  { c: 3, ns: 4, lam: 16, nodes: [[159, 101, 1.8, 0.04, 1], [158.5, 110, 2.6, 0.32, 1], [164, 121, 3.2, 0.42, 0.8], [174, 136, 3.8, 0.52, 0], [179.5, 155, 4.2, 0.52, 0], [179, 175, 4.6, 0.52, 0], [173.5, 193, 4.8, 0.5, 0], [165, 198.5, 5, 0.48, 0.2], [158, 186, 4.6, 0.45, 0.85], [152.5, 166, 4, 0.44, 1], [146, 147, 3.6, 0.44, 1], [136, 131, 3.2, 0.46, 1], [120, 120, 2.9, 0.48, 1], [104, 112.5, 2.8, 0.52, 1], [95.5, 106, 2.9, 0.6, 0.9], [92, 95, 3, 0.72, 0.2], [90.8, 80, 3.2, 0.8, 0], [91.5, 64, 3.2, 0.82, 0], [95.5, 50, 3.2, 0.82, 0], [104, 39.5, 3, 0.8, 0], [116, 32.5, 3, 0.78, 0], [129, 32, 3, 0.74, 0], [140, 37.5, 2.8, 0.68, 0], [147, 47, 2.6, 0.45, 0.3], [150, 59, 2.4, 0.05, 1]] },
  { c: 3, ns: 3, lam: 13, nodes: [[104, 39.5, 2, 0.78, 0], [102, 26, 1.8, 0.62, 0], [98, 13, 1.6, 0.45, 0], [94.2, 5, 1.4, 0.06, 0]] },   // 头臂干
  { c: 3, ns: 2, lam: 12, nodes: [[117.5, 32.4, 1.4, 0.74, 0], [118.5, 20, 1.2, 0.55, 0], [119.6, 9, 1.1, 0.06, 0]] },   // 左颈总
  { c: 3, ns: 2, lam: 12, nodes: [[129.5, 32.2, 1.5, 0.72, 0], [132.5, 21, 1.4, 0.55, 0], [136.4, 12, 1.3, 0.06, 0]] }   // 左锁骨下
];
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function flowSamples(nodes) {   // 节点 → 一串平滑的点（位置 Catmull-Rom，属性 smoothstep 过渡），再按 0.5 单位等弧长重采样
  const n = nodes.length, P = i => nodes[clamp(i, 0, n - 1)], raw = [], K = 14;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < K; j++) {
    const t = j / K, t2 = t * t, t3 = t2 * t, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), f = q => 0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3), st = t2 * (3 - 2 * t);
    raw.push([f(0), f(1), p1[2] + (p2[2] - p1[2]) * st, p1[3] + (p2[3] - p1[3]) * st, p1[4] + (p2[4] - p1[4]) * st]);
  }
  raw.push(nodes[n - 1].slice());
  const out = [raw[0]]; let acc = 0;
  for (let i = 1; i < raw.length; i++) { const a = raw[i - 1], b = raw[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += d; if (acc >= 0.5) { out.push(b); acc = 0; } }
  if (out[out.length - 1] !== raw[raw.length - 1]) out.push(raw[raw.length - 1]);
  return out;
}
function drawFlows() {
  layer();
  FLOWS.forEach((fl, fi) => {
    const A = flowSamples(fl.nodes), m = A.length, P = A.map(q => T(q)), nd = Math.min(fl.ns, fl.c === 2 && fi === 0 || fl.c === 3 && fi === 3 ? 3 : 2), LANE = 4.4 * S;
    const Ls = [0]; for (let i = 1; i < m; i++) Ls.push(Ls[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tan = i => nrm([P[Math.min(m - 1, i + 1)][0] - P[Math.max(0, i - 1)][0], P[Math.min(m - 1, i + 1)][1] - P[Math.max(0, i - 1)][1]]);
    for (let j = 0; j < fl.ns; j++) {
      const ph = TAU * j / fl.ns + fi * 1.3, amp = [0.72, 0.9, 0.55, 0.8, 0.65][j], lane = j < nd ? (j - (nd - 1) / 2) * LANE : 0, w = [0.4, 0.34, 0.38, 0.32, 0.36][j], lam = fl.lam * 1.6 * S;
      const Q = A.map((q, i) => { const t = tan(i), y = q[1], f = sstep(SEAM - 1, SEAM + 4.5, y), so = q[2] * S * amp * (0.72 + 0.28 * Math.sin(Ls[i] * TAU / (lam * 4.3) + j * 1.9)) * Math.sin(ph + Ls[i] * TAU / (lam * (0.82 + 0.13 * j)) + 0.9 * Math.sin(Ls[i] * TAU / (lam * 3.1) + j * 1.7)), o = so + (lane - so) * f; return [P[i][0] - t[1] * o, P[i][1] + t[0] * o]; });
      // 线：心电线以上；贴着线那两三个单位断成短划；在后面的地方虚、淡；没进数字的那几股在线前慢慢淡掉
      let run = [], ra = [];
      const flush = () => { if (run.length >= 2) stroke(run, w, k => ra[Math.min(ra.length - 1, k + 1)], fl.c); run = []; ra = []; };
      for (let i = 0; i < m; i++) {
        const q = A[i], y = q[1], hid = q[4], seamBand = y > SEAM - 2.6, fade = j < nd ? 1 : 1 - sstep(SEAM - 4, SEAM - 0.5, y);
        let on = y < SEAM - 0.15 && fade > 0.02;
        if (on && hid > 0.5 && Math.floor(Ls[i] / 2.1) % 2) on = false;
        if (on && seamBand && Math.floor(Ls[i] / 1.2) % 2) on = false;
        if (on) { run.push(Q[i]); ra.push(0.8 * q[3] * fade * (1 - 0.5 * hid) * (seamBand ? 0.75 : 1) * (j ? 0.85 : 1)); } else flush();
      }
      flush();
      // 数字：线以下，同一股沿同一条路松开成一串，字距稳定；进出线的地方各两粒点
      if (j >= nd) continue;
      let r0 = -1;
      for (let i = 0; i <= m; i++) {
        const below = i < m && A[i][1] >= SEAM;
        if (below && r0 < 0) r0 = i;
        if (!below && r0 >= 0) { digitRun(Q.slice(r0, i), A.slice(r0, i), Ls.slice(r0, i), fl.c, r0 > 0, i < m); r0 = -1; }
      }
    }
  });
  fillDigits();
}
function digitRun(Q, A, Ls, c, inDots, outDots) {
  const L0 = Ls[0], tot = Ls[Ls.length - 1] - L0; if (tot < 3) return;
  const at = s => { let i = 1; while (i < Q.length - 1 && Ls[i] - L0 < s) i++; const a = Q[i - 1], b = Q[i], f = clamp((s - (Ls[i - 1] - L0)) / ((Ls[i] - Ls[i - 1]) || 1), 0, 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0]), A[i]]; };
  const st = { pts: [], c, all: [] }; STREAMS.push(st);
  const dot = (s, a) => { const p = at(s); CUR.t.push({ x: p[0], y: p[1], r: 0.3, c, a: p[3][3] * a }); st.all.push(p); };
  let s = 0;
  if (inDots) { dot(0.6, 0.8); dot(1.9, 0.8); s = 3.4; }
  const end = tot - (outDots ? 3.2 : 0.5);
  /* 散一点：离线越远越乱。字离开河道一点、歪一点、大小深浅不齐，偶尔漏一个；靠近心电线的两头收拢 */
  while (s < end) {
    const p = at(s), q = p[3], m = Math.sin(PI * clamp(s / tot, 0, 1)), k = 0.35 + 0.65 * m;
    const nx = -Math.sin(p[2]), ny = Math.cos(p[2]), off = (SKR() - 0.5) * 2 * (0.5 + 3.4 * m), along = (SKR() - 0.5) * 1.6 * k;
    const item = { x: p[0] + nx * off + Math.cos(p[2]) * along, y: p[1] + ny * off + Math.sin(p[2]) * along, rot: p[2] + (SKR() - 0.5) * 1.1 * k, ch: null, c,
      a: Math.min(0.78, q[3] * 0.95) * (1 - 0.45 * q[4]) * (0.5 + 0.5 * SKR()), size: 3.8 * (0.72 + 0.62 * SKR()) };
    if (SKR() > 0.13 * k) { CUR.t.push(item); st.pts.push(item); }
    st.all.push(p); s += 3.7 * (0.8 + 0.75 * SKR() * k);
  }
  if (outDots) { dot(tot - 1.9, 0.8); dot(tot - 0.6, 0.8); }
}
function valveRings() {   // 瓣口：铅笔淡淡一小段弧加两三根短线；在后面的（二尖瓣、主动脉瓣）用虚的
  const V = [[66.5, 140, 6.2, 1.5, 110, 0], [114, 117, 10, 2.4, 9, 0], [95.5, 106.5, 7, 1.8, 15, 1], [162, 119, 6.5, 1.6, 40, 1]];
  V.forEach(([x, y, a, b, deg, hid]) => {
    const c = T([x, y]), rot = deg * PI / 180, A = arcPts(c[0], c[1], a * S, b * S, rot, 0.15 * PI, 1.05 * PI);
    if (hid) { for (let i = 0; i + 1 < A.length; i += 4) hand(A.slice(i, i + 3), pen(CL, { a: 0.3, ov: 0 })); }
    else hand(A, pen(HT, { a: 0.4, ov: 0.6 }));
    for (let k = -1; k <= 1; k++) { const t = 0.6 * PI + k * 0.28, p = [c[0] + Math.cos(t) * a * S * Math.cos(rot) - Math.sin(t) * b * S * Math.sin(rot), c[1] + Math.cos(t) * a * S * Math.sin(rot) + Math.sin(t) * b * S * Math.cos(rot)], nn = [-Math.sin(rot), Math.cos(rot)]; hand([[p[0] - nn[0] * 1.2, p[1] - nn[1] * 1.2], [p[0] + nn[0] * 1.6, p[1] + nn[1] * 1.6]], pen(HT, { a: hid ? 0.18 : 0.3, ov: 0.2 })); }
  });
}
function buildDig() {   // 数字流的字：这页三组文件的字节数和修改时间（月日 时分），循环用；没数据就空着
  const p2 = n => String(n).padStart(2, '0'), out = [];
  GROUPS.forEach(g => g.files.forEach(f => { const d = new Date(f.mtime); if (Number.isFinite(+f.size)) out.push(String(Math.round(+f.size))); if (!isNaN(d)) out.push(p2(d.getMonth() + 1) + p2(d.getDate()), p2(d.getHours()) + p2(d.getMinutes())); }));
  DIG = out.length ? out.join(' ') + ' ' : '';
}
function readPrivate() {   // 自家的两个口子：ta_heart_since（日期）→ 最靠心尖那串数字显示到今天的天数；ta_heart_motto → 替换铭文下那行小字。都没有就什么也不多
  const s = ls('ta_heart_since'), m = ls('ta_heart_motto');
  SINCE = null; MOTTO = m && m.trim() ? m.trim().slice(0, 40) : null;
  if (s) { const d = new Date(s.trim() + (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? 'T00:00:00' : '')); if (!isNaN(d)) { const t = new Date(); t.setHours(0, 0, 0, 0); const n = Math.floor((t - d) / 86400000); if (n >= 0) SINCE = n; } }
}
let MOTTO = null;
function renderArt() {
  const W = stage.clientWidth, g = fitCanvas(art, W, Math.ceil(ART_H));
  const ink = dark ? C.PAPER : C.INK, pn = dark ? '#a3a3a9' : C.PEN, bg = dark ? C.INK : C.PAPER, blue = dark ? '#8794f2' : C.BLUE; const red = (getComputedStyle(document.body).getPropertyValue('--red') || '').trim() || '#b3261e', col = c => c === 3 ? red : c === 2 ? blue : c ? ink : pn;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle'; let FZ = ''; const DPR = g.getTransform().a;
  for (const L of LAYERS) {
    if (L.clip) { g.save(); g.beginPath(); L.clip.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip(); }
    if (L.f.length) { g.globalAlpha = 1; g.fillStyle = bg; for (const poly of L.f) { g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); } }
    for (const un of L.s) { g.strokeStyle = col(un.c); g.lineCap = un.k ? 'butt' : 'round'; g.lineJoin = un.k === 2 ? 'miter' : 'round'; g.globalAlpha = dark ? Math.min(0.95, un.a * 1.15) : un.a; g.lineWidth = un.w; g.beginPath(); const p = un.p; g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); }
    if (L.d.length) { g.globalAlpha = 0.5; g.fillStyle = pn; g.beginPath(); for (const [x, y, r] of L.d) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill(); }
    if (L.b.length) { g.globalAlpha = 1; g.fillStyle = blue; for (const poly of L.b) { g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); } }
    for (const it of L.t) { g.globalAlpha = dark ? Math.min(1, it.a * 1.1) : it.a; g.fillStyle = col(it.c);
      if (it.ch) { let r = it.rot; if (r > PI / 2) r -= PI; else if (r < -PI / 2) r += PI; const fz = it.size.toFixed(1); if (fz !== FZ) { FZ = fz; g.font = fz + 'px ui-monospace,Menlo,Consolas,monospace'; } g.setTransform(DPR * Math.cos(r), DPR * Math.sin(r), -DPR * Math.sin(r), DPR * Math.cos(r), DPR * it.x, DPR * it.y); g.fillText(it.ch, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
      else { g.beginPath(); g.arc(it.x, it.y, it.r || 0.3, 0, TAU); g.fill(); } }
    if (L.clip) g.restore();
  }
  g.globalAlpha = 1;
}

/* ---------- 心电线：硬直线，一个 PQRST 落在心脏正中；线下一排测绘刻度，两头一小截竖的收口，R 波两边几粒蓝 ---------- */
function ecgPath(W) {
  const k = S, y = ECG_Y, x0 = 14, x1 = W - 14, c = ECG_X, pts = [[x0, y]];
  const bump = (xa, wd, h) => { for (let i = 0; i <= 8; i++) pts.push([xa + wd * i / 8, y - Math.sin(PI * i / 8) * h]); };
  let x = c - 34 * k; pts.push([x, y]);
  bump(x, 11 * k, 3.4 * k); x += 11 * k + 5 * k; pts.push([x, y]);
  pts.push([x + 2 * k, y + 2.6 * k]); pts.push([x + 4.6 * k, y - 36 * k]); pts.push([x + 7.8 * k, y + 8.5 * k]); pts.push([x + 10 * k, y]); x += 10 * k + 8 * k; pts.push([x, y]);
  bump(x, 19 * k, 6.5 * k); x += 19 * k; pts.push([x1, y]);
  return { pts, d: 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L'), rx: c - 34 * k + 16 * k + 4.6 * k };
}

/* ---------- 引线：从心脏上的小圈往左走到页边那一束竖线，再往下落到各自的组头 ---------- */
let GROUPS = [], openKey = null, LIST_L = 46, LIST_T = 0;
function gutter(n) { const st = Math.min(6, 26 / Math.max(1, n)); return i => 17 + i * st; }
function pickAnchors(n) { const out = []; for (let i = 0; i < n; i++) out.push(ANCHORS[i % ANCHORS.length]); return n <= ANCHORS.length ? out.sort((a, b) => a[1] - b[1]) : out; }
function seamX() {   // 心电线和心脏外形的两个交点（像素）
  const xs = []; for (let i = 0; i < BODYU.length; i++) { const a = BODYU[i], b = BODYU[(i + 1) % BODYU.length]; if ((a[1] - SEAM) * (b[1] - SEAM) < 0) xs.push(a[0] + (b[0] - a[0]) * (SEAM - a[1]) / (b[1] - a[1])); }
  return xs.length >= 2 ? [OX + Math.min(...xs) * S, OX + Math.max(...xs) * S] : [ECG_X, ECG_X];
}
function drawLeads() {
  const W = stage.clientWidth, H = Math.max(plate.offsetHeight, ART_H + 40);
  leads.setAttribute('width', W); leads.setAttribute('height', H); leads.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const e = ecgPath(W), hx = seamX(), xL = hx[0], xR = hx[1], seg = (a, b) => { const q = [[a, ECG_Y]].concat(e.pts.filter(p => p[0] > a && p[0] < b), [[b, ECG_Y]]); return 'M' + q.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L'); };
  let s = `<path class="ecg" d="${seg(14, xL)}"/><path class="ecg in" d="${seg(xL, xR)}"/><path class="ecg" d="${seg(xR, W - 14)}"/>`;   // 穿过心脏那一段细、淡
  s += `<path class="ecg" d="M14 ${f2(ECG_Y - 2.2)}V${f2(ECG_Y + 2.2)}M${W - 14} ${f2(ECG_Y - 2.2)}V${f2(ECG_Y + 2.2)}"/>`;
  s += `<path class="ecg tri" d="M${f2(W - 9.6)} ${f2(ECG_Y - 3.2)}l1.9 -2.6l1.9 2.6ZM${f2(W - 9.6)} ${f2(ECG_Y + 3.2)}l1.9 2.6l1.9 -2.6Z"/>`;   // 一上一下两枚小三角：这条线可以拖
  let tk = '', tki = ''; for (let x = 21, i = 0; x < W - 18; x += 7, i++) { const t = `M${x} ${f2(ECG_Y + 1.4)}V${f2(ECG_Y + (i % 5 ? 2.8 : 4.2))}`; if (x > xL && x < xR) tki += t; else tk += t; }
  s += `<path class="tk" d="${tk}"/><path class="tk in" d="${tki}"/><text class="tl" x="16" y="${f2(ECG_Y - 4)}">II</text>`;
  const Rn = rng(77); let dots = ''; for (let i = 0; i < 9; i++) { const t = Rn(), yy = ECG_Y - t * 34 * S, side = Rn() < 0.5 ? -1 : 1, d = 0.4 + Rn() * Rn() * 4; dots += `<circle cx="${f2(e.rx + side * (d + t * 1.4))}" cy="${f2(yy)}" r="${f2(0.18 + Rn() * 0.26)}"/>`; }
  s += `<g class="pt in">${dots}</g>`;
  const n = GROUPS.length, gx = gutter(n), an = pickAnchors(n), og = openKey ? +openKey.split(':')[0] : -1;
  groupsEl.querySelectorAll('.grp').forEach((el, i) => {
    const a = T(an[i]), x = gx(i), hy = LIST_T + el.offsetTop + 9, on = i === og ? ' on' : '';
    s += `<path class="ld${on}" d="M${f2(a[0] - 2)} ${f2(a[1])}H${f2(x)}V${f2(hy)}H${f2(LIST_L - 5)}"/>`;
    s += `<circle class="an${on}" cx="${f2(a[0])}" cy="${f2(a[1])}" r="1.9"/><circle class="ak" cx="${f2(a[0])}" cy="${f2(a[1])}" r=".55"/>`;
    s += `<circle class="ed" cx="${f2(LIST_L - 5)}" cy="${f2(hy)}" r=".9"/>`;
  });
  // 图版底下的铭文：小号衬线大写；上面一个图版号夹在两道短线里；铭文右下一行小字中文
  const ix = OX + 112 * S, iy = OY + 220.2 * S;
  s += `<g class="insc"><text class="tab" x="${f2(ix)}" y="${f2(OY + 213.8 * S)}" text-anchor="middle">TAB. I</text><path class="tr" d=""/><text class="lat" x="${f2(ix)}" y="${f2(iy)}" text-anchor="middle">COR SILICEUM · AMORE HUMANO PALPITAT</text><text class="egg" x="0" y="0" transform="">${esc(MOTTO || '硅基心脏因人之爱跳动')}</text></g>`;
  leads.innerHTML = s;
  fitInsc(W);
}
function fitInsc(W) {   // 量一下铭文多宽：不出屏、不碰左边的引线；放不下先收字距
  const lat = leads.querySelector('.lat'), tab = leads.querySelector('.tab'), tr = leads.querySelector('.tr'), egg = leads.querySelector('.egg'); if (!lat || !lat.getComputedTextLength) return;
  const lo = 44, hi = W - 14; let ls = 0.22, w = 0;
  for (let k = 0; k < 6; k++) { lat.style.letterSpacing = ls + 'em'; w = lat.getComputedTextLength(); if (w <= hi - lo || ls < 0.1) break; ls -= 0.03; }
  const cx = clamp(OX + 112 * S, lo + w / 2, hi - w / 2), y = +lat.getAttribute('y');
  lat.setAttribute('x', f2(cx)); tab.setAttribute('x', f2(cx));
  const tw = tab.getComputedTextLength ? tab.getComputedTextLength() : 18, ty = +tab.getAttribute('y') - 2.2;
  tr.setAttribute('d', `M${f2(cx - tw / 2 - 11)} ${f2(ty)}H${f2(cx - tw / 2 - 4)}M${f2(cx + tw / 2 + 4)} ${f2(ty)}H${f2(cx + tw / 2 + 11)}`);
  egg.setAttribute('transform', `translate(${f2(cx + w / 2 - 2)} ${f2(y + 4.6)}) scale(.45)`); egg.setAttribute('text-anchor', 'end');
}

/* ---------- 排版 ---------- */
function layout() {
  const W = stage.clientWidth;
  S = clamp(W * 0.52 / 155, 0.86, 1.13);
  OX = W - 14 - 188 * S; OY = 76 + 6 * S; ART_H = OY + 209 * S; ECG_Y = OY + SEAM * S; ECG_X = OX + 110 * S;
  const n = Math.max(1, GROUPS.length), gx = gutter(n);
  LIST_L = Math.max(44, Math.round(gx(n - 1) + 22)); LIST_T = Math.round(ART_H + 36);
  groupsEl.style.left = LIST_L + 'px'; groupsEl.style.top = LIST_T + 'px';
  msg.style.left = LIST_L + 'px'; msg.style.top = LIST_T + 'px';
  buildDig(); const t0 = performance.now(); buildArt(); const t1 = performance.now(); renderArt(); PERF = { build: Math.round(t1 - t0), render: Math.round(performance.now() - t1), strokes: LAYERS.reduce((a, L) => a + L.s.length, 0) }; fitPlate();
  const g = fitCanvas(deco, W, stage.clientHeight); spots(g, W, stage.clientHeight, 61, dark ? 'rgba(241,238,230,0.1)' : 'rgba(84,84,88,0.16)');
}
/* 拖心电线：一条横贯的透明把手压在线上，上下拖改 SEAM，整颗心按新的线重画（静态部分一帧内画完） */
const grip = document.getElementById('seamgrip');
function placeGrip() { if (grip) grip.style.top = (ECG_Y - 15) + 'px'; }
if (grip) {
  let dragging = false, raf = 0, want = SEAM;
  const apply = () => { raf = 0; if (want === SEAM) return; SEAM = want; ECG_Y = OY + SEAM * S; buildArt(); renderArt(); drawLeads(); placeGrip(); };
  grip.addEventListener('pointerdown', ev => { dragging = true; grip.classList.add('on'); try { grip.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); });
  grip.addEventListener('pointermove', ev => {
    if (!dragging) return; const top = plate.getBoundingClientRect().top;
    want = Math.round(clamp((ev.clientY - top - OY) / S, SEAM_MIN, SEAM_MAX) * 2) / 2; if (!raf) raf = requestAnimationFrame(apply);
  });
  const end = () => { if (!dragging) return; dragging = false; grip.classList.remove('on'); if (raf) { cancelAnimationFrame(raf); apply(); } try { if (LIVE) localStorage.setItem(SEAM_KEY, String(SEAM)); } catch (e) {} };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', ev => { const d = ev.key === 'ArrowUp' ? -4 : ev.key === 'ArrowDown' ? 4 : 0; if (!d) return; ev.preventDefault(); want = clamp(SEAM + d, SEAM_MIN, SEAM_MAX); apply(); try { if (LIVE) localStorage.setItem(SEAM_KEY, String(SEAM)); } catch (e) {} });
}
function fitPlate() { plate.style.height = Math.max(stage.clientHeight, LIST_T + groupsEl.offsetHeight + 72) + 'px'; drawLeads(); placeGrip(); }

/* ---------- 文件清单和信纸 ---------- */
function nameHTML(p) { const k = p.lastIndexOf('/'); return k < 0 ? `<em>${esc(p)}</em>` : `<i>${esc(p.slice(0, k + 1))}</i><em>${esc(p.slice(k + 1))}</em>`; }
function paint(groups) {
  GROUPS = Array.isArray(groups) ? groups.filter(g => g && Array.isArray(g.files)) : [];
  openKey = null;
  if (!GROUPS.length) { groupsEl.innerHTML = ''; say('这里还空着'); layout(); return; }
  say('');
  groupsEl.innerHTML = GROUPS.map((g, i) => `<div class="grp" role="listitem"><div class="gh"><span class="n">${ROMAN[i] || i + 1}</span><b>${esc(g.name)}</b><small>${g.files.length} 件</small></div>` +
    g.files.map((f, j) => `<button type="button" class="fi" data-k="${i}:${j}" aria-expanded="false"><span class="fr"><span class="nm">${nameHTML(f.path)}</span><span class="dl"></span><span class="mt">${esc(fmt(f.mtime))} · ${esc(size(f.size))}</span></span></button><div class="sht" data-k="${i}:${j}"><div></div></div>`).join('') + '</div>').join('');
  layout();
}
function say(html) { msg.innerHTML = html; msg.hidden = !html; }
const TXT = new Map();
function fileAt(k) { const [i, j] = k.split(':').map(Number); return GROUPS[i] && GROUPS[i].files[j]; }
function readText(path) {
  if (TXT.has(path)) return Promise.resolve(TXT.get(path));
  const p = LIVE ? api('/app/heart/file?path=' + encodeURIComponent(path)).then(d => d.text || '') : Promise.resolve(DEMO_TEXT[path] || '');
  return p.then(t => { TXT.set(path, t); return t; });
}
function textHTML(path, t) {
  if (!/\.md$/i.test(path)) return esc(t);
  return t.split('\n').map(l => /^#\s/.test(l) ? `<span class="h1">${esc(l)}</span>` : /^#{2,}\s/.test(l) ? `<span class="h2">${esc(l)}</span>` : esc(l)).join('\n');
}
function closeOpen() {
  if (!openKey) return;
  const k = openKey, b = groupsEl.querySelector(`.fi[data-k="${k}"]`), sh = groupsEl.querySelector(`.sht[data-k="${k}"]`);
  openKey = null;
  if (b) { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); }
  if (sh) { sh.classList.remove('open'); setTimeout(() => { if (openKey !== k) sh.firstChild.innerHTML = ''; fitPlate(); }, REDUCED ? 0 : 230); }
  drawLeads();
}
function openFile(k) {
  if (openKey === k) { closeOpen(); return; }
  closeOpen();
  const f = fileAt(k), b = groupsEl.querySelector(`.fi[data-k="${k}"]`), sh = groupsEl.querySelector(`.sht[data-k="${k}"]`);
  if (!f || !b || !sh) return;
  openKey = k; b.classList.add('on'); b.setAttribute('aria-expanded', 'true');
  const code = /\.(py|ts|js|sh|json|mjs|css|html)$/i.test(f.path);
  sh.firstChild.innerHTML = `<div class="lt"><div class="lh">${esc(f.path)} · 只读</div><div class="tx${code ? ' code' : ''}"><span class="q">读 着 …</span></div></div>`;
  void sh.offsetHeight; sh.classList.add('open'); drawLeads();
  const tx = sh.querySelector('.tx');
  readText(f.path).then(t => {
    if (openKey !== k) return;
    tx.innerHTML = t ? textHTML(f.path, t) : '<span class="q">这一件是空的</span>'; tx.scrollTop = 0; markMore(tx); settleOpen(b);
  }).catch(e => {
    if (openKey !== k) return;
    if (e && e.auth) { gate('auth'); }
    tx.innerHTML = '<span class="q">没 读 到</span>';
  });
  settleOpen(b);
}
function markMore(tx) { const up = () => tx.classList.toggle('more', tx.scrollHeight - tx.scrollTop - tx.clientHeight > 4); up(); tx.onscroll = up; }
function settleOpen(b) {   // 展开以后这一行别沉到屏幕底下：往上挪到上三分之一
  setTimeout(() => {
    const r = b.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
    if (r.top > sr.top + sr.height * 0.45 || r.top < sr.top + 40) scroll.scrollTo({ top: scroll.scrollTop + r.top - sr.top - Math.min(140, sr.height * 0.22), behavior: REDUCED ? 'auto' : 'smooth' });
  }, REDUCED ? 0 : 210);
}
scroll.addEventListener('scroll', () => scroll.classList.toggle('down', scroll.scrollTop > 30), { passive: true });
groupsEl.addEventListener('click', ev => { const b = ev.target.closest('.fi'); if (b) openFile(b.dataset.k); });
if (window.ResizeObserver) new ResizeObserver(() => fitPlate()).observe(groupsEl);

/* ---------- 没钥匙、钥匙不认 ---------- */
function gate(kind) { say((kind === 'auth' ? '钥匙不认了，' : '还没带钥匙，') + '<a href="../index.html">去登录</a>'); }

async function start() {
  if (!LIVE) { paint(DEMO); return; }
  await loadConfig();
  const N = window.NYX || {}; HOME = typeof N.relay === 'string' && /^\/relay(-[a-z0-9]+)?$/.test(N.relay) ? N.relay : '/relay';
  KEY = ls('nyx_key');
  if (!KEY) { gate('none'); return; }
  say('读 着 …');
  try { const d = await api('/app/heart'); paint(d.groups || []); }
  catch (e) { groupsEl.innerHTML = ''; GROUPS = []; layout(); if (e && e.auth) gate('auth'); else say('没 读 到'); }
}

/* ---------- 进出 ---------- */
$('hico').innerHTML = heartIcon('hi0');
const info = homeInfo('heart', 0, dark ? 1 : 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
readPrivate(); setupGrain(); layout();
const fl = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fl.then(() => { layout(); revealIn(info, stage, () => { window.__revealed = true; }); window.__ready = true; start(); });
window.__heart = { open: openFile, close: closeOpen, layout, state: () => ({ groups: GROUPS.length, files: GROUPS.reduce((a, g) => a + g.files.length, 0), open: openKey, msg: msg.hidden ? '' : msg.textContent, live: LIVE, relay: HOME }), perf: () => PERF, blood: () => ({ streams: STREAMS.length, digits: STREAMS.reduce((a, s) => a + s.pts.filter(p => p.ch && p.ch !== '-').length, 0), since: SINCE, near: (() => { const ap = T(AP); let b = null, d = 1e9; STREAMS.forEach(s => { if (!s.pts.length) return; const e = Math.min(...s.all.map(p => Math.hypot(p[0] - ap[0], p[1] - ap[1]))); if (e < d) { d = e; b = s; } }); return b ? b.pts.map(p => p.ch || ' ').join('') : ''; })(), motto: MOTTO }) };
})();
