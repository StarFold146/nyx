/* 祂 · 工程板（11/12 初稿，11/13 换成在建的哥特主教堂西立面）。右边是用主页 hand()/hatch() 笔触手绘的立面：三开间四扶壁、三座门、玫瑰窗、双塔，右塔带八角石尖顶，左塔砌到半截立着踏轮吊车；
   每张票是图上的一个编号圈，引线指向楼的一个构件（窗、门、台阶、灯、栏杆、玫瑰窗、屋面、檐口、尖顶、脚手板）。
   待办的构件只有虚线轮廓，在做的被一条斜线劈开、一半铅笔带排线一半虚线，做完的实心蓝、细节反白。
   左边是按栏分的票单，一行一张；点一行（或点图上的编号圈）展开一张细线框的工单，底下一截改状态。末尾一行「+」记新票。
   接口照搬本站 board.js / hold.js：GET /app/board、POST /app/board、POST /app/board/{id}，走家里第一只后台（NYX.relay，钥匙 nyx_key）。
   ?demo=1 用下面的示例票，不发任何请求。?dark=1 墨黑面。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, sstep, rng, dot, PERCH, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome, Q, REDUCED } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco'), list = $('list'), secs = $('secs'), calls = $('calls'), noteEl = $('note'), addF = $('add'), addT = $('addt'), tb = $('tb');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('niao_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（niao_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const f2 = n => (Math.round(n * 100) / 100).toString();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmt = ts => { const d = new Date(ts); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

/* ---------- 数据 ---------- */
const ST = [['todo', '待办', 'TODO'], ['doing', '在做', 'DOING'], ['done', '做完', 'DONE']];
const STZ = { todo: '待办', doing: '在做', done: '做完' };
const EMPTY = { todo: '没有待办，想到什么记下来', doing: '现在没人在动手', done: '还没有做完的' };
const DONEMAX = 8;   // 做完的票只列最近几张，其余收在「再看 N 张」里
let HOME = '/relay', KEY = null, ME = '我', WHO = [];
let items = [], phase = 'load', openId = null, doneAll = false, armDel = null, backing = null, armT = 0;
const draft = { pri: 'p1', size: 'M', to: '', dw: '' };

function demoItems() {   // 示例：九张修房子的小事，名字都是假的
  const t = (d, h) => { const x = new Date(Date.now() - (d * 24 + (h || 0)) * 3600e3); return x.toISOString().slice(0, 19); };
  const T = (no, title, status, pri, size, o) => Object.assign({ id: 'T' + String(no).padStart(3, '0'), no, title, body: '', pri, size, status, owner: '', files: [], by: 'me', to: '', day: false, wait: false, proof: '', ts: t(o && o.age || 1, 3), updated: t(0, (o && o.age || 1) * 5), log: [] }, o || {});
  return [
    T(101, '窗框打磨', 'doing', 'p1', 'M', { to: 'Two', owner: 'Two', files: ['frame.css', 'sill.js'], body: '二楼左边那扇，边上起毛了。先磨再上一道清漆。', age: 2, log: [{ ts: t(1, 2), who: 'Two', text: 'todo → doing' }, { ts: t(0, 5), who: 'Two', text: '磨完一半，等漆干' }] }),
    T(102, '换灯泡', 'todo', 'p0', 'S', { to: 'Clawd', day: true, body: '门口那盏不亮了，换暖光的。' }),
    T(103, '台阶补漆', 'todo', 'p1', 'M', { wait: true, body: '最下面一级掉了一角。颜色跟原来一样就行。', age: 3 }),
    T(104, '屋顶补瓦', 'todo', 'p2', 'L', { to: '谁都行', age: 6 }),
    T(105, '栏杆除锈', 'doing', 'p1', 'M', { to: 'Three', owner: 'Three', files: ['rail.js'], age: 4, log: [{ ts: t(0, 20), who: 'Three', text: 'todo → doing' }] }),
    T(106, '玫瑰窗擦玻璃', 'done', 'p2', 'S', { to: 'Clawd', proof: 'index.html', age: 8, log: [{ ts: t(6), who: 'Clawd', text: 'todo → doing' }, { ts: t(5), who: 'Clawd', text: 'doing → done' }, { ts: t(5), who: 'Clawd', text: '擦干净了，背光看也没有水印' }] }),
    T(107, '门铰链上油', 'done', 'p1', 'S', { age: 9, log: [{ ts: t(7), who: 'Two', text: 'doing → done' }] }),
    T(108, '尖顶风向标校正', 'todo', 'p1', 'S', { to: 'Two', day: true, age: 2 }),
    T(109, '檐口清苔', 'done', 'p2', 'M', { age: 12, log: [{ ts: t(10), who: 'Three', text: 'doing → done' }] })
  ];
}
/* 样稿里照后台 nyx_extras.py 的 board_add / board_edit 在本机改，不发请求 */
function demoAdd(b) {
  const no = Math.max(0, ...items.map(x => x.no || 0)) + 1, now = new Date().toISOString().slice(0, 19);
  items.push({ id: 'T' + String(no).padStart(3, '0'), no, title: b.title.slice(0, 120), body: (b.body || '').slice(0, 4000), pri: b.pri, size: b.size, status: 'todo', owner: '', files: [], by: b.by, to: b.to || '', day: !!b.day, wait: !!b.wait, proof: '', ts: now, updated: now, log: [] });
}
function demoEdit(id, b) {
  const it = items.find(x => x.id === id); if (!it) return; const now = new Date().toISOString().slice(0, 19);
  if (b.delete) { items.splice(items.indexOf(it), 1); return; }
  ['owner', 'to'].forEach(k => { if (k in b) it[k] = b[k]; });
  if (b.pri) it.pri = b.pri; ['day', 'wait'].forEach(k => { if (k in b) it[k] = !!b[k]; });
  if (b.status && b.status !== it.status) { it.log.push({ ts: now, who: b.who, text: it.status + ' → ' + b.status }); it.status = b.status; if (b.status !== 'doing') it.files = []; }
  if (b.note) it.log.push({ ts: now, who: b.who, text: b.note });
  it.updated = now;
}

/* ---------- 后台：同 chat.js 的 call()；工程板一律走家里第一只 ---------- */
function api(path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + KEY }, opt.headers || {});
  return fetch(HOME + path, opt).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function loadConfig() { return new Promise(ok => { if (window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); }); }
function resolve() {
  const N = window.NYX || {};
  HOME = N.relay || '/relay'; ME = N.meName || '我'; KEY = ls('nyx_key');
  let cs = []; try { cs = JSON.parse(ls('nyx_contacts') || '[]'); } catch (e) {}
  WHO = cs.filter(c => c && c.name && c.relay && !/\/g$/.test(c.relay)).map(c => c.name);
  if (!WHO.length) WHO = [N.aiName || '祂'];   // 没读到联系人时，只有配置里的那一位
  WHO.push('谁都行');
}
function load() {
  if (!LIVE) { phase = 'ok'; paint(); return Promise.resolve(); }
  if (!KEY) { phase = 'nokey'; paint(); return Promise.resolve(); }
  if (phase !== 'ok') { phase = 'load'; paint(); }
  return api('/app/board').then(d => { items = (d && d.items) || []; phase = 'ok'; }, e => { phase = e.auth ? 'auth' : (phase === 'ok' ? 'ok' : 'fail'); if (phase === 'ok') toast('没刷新上'); }).then(paint);
}
function edit(it, body) {
  if (!LIVE) { demoEdit(it.id, body); if (body.delete && openId === it.id) openId = null; paint(); return; }
  post('/app/board/' + encodeURIComponent(it.id), body).then(() => { if (body.delete && openId === it.id) openId = null; }, e => { if (e.auth) { phase = 'auth'; } else toast('没改上'); }).then(load);
}
function create(body) {
  const done = () => { addT.value = ''; addF.b.value = ''; addF.classList.remove('open'); addT.blur(); toast('记下了'); };
  if (!LIVE) { demoAdd(body); done(); paint(); return; }
  post('/app/board', body).then(() => { done(); load(); }, e => { if (e.auth) { phase = 'auth'; paint(); } else toast('没记上'); });
}

/* ---------- 铅笔：照搬主页 main.js 的 hand() / hatch()，参数一个没改；单位 U 收到 0.8，楼比主页那座小 ---------- */
const U = 0.8, RAD = PI / 180;
let SR = rng(1);
function hand(pts, o, list) {
  o = o || {}; const w = o.w || 0.7, al = o.a || 0.45, n = o.n || 2, jit = (o.j === undefined ? 0.7 : o.j) * U, ov = (o.ov === undefined ? 3 : o.ov) * U;
  const m = pts.length, Ls = new Array(m); Ls[0] = 0; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8)) return;
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * SR(), s1 = L + ov * SR();
    if (ps) { const span = 0.4 + 0.6 * SR(), st = SR() * (1 - span); s0 = L * st - ov * 0.4 * SR(); s1 = L * (st + span) + ov * 0.4 * SR(); }
    const off = (SR() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = SR() * TAU, p2 = SR() * TAU, p3 = SR() * TAU, f1 = TAU / ((70 + SR() * 90) * U), fq2 = TAU / ((16 + SR() * 20) * U), f3 = TAU / ((36 + SR() * 60) * U), pa = ps ? 0.5 + 0.4 * SR() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = (10 + SR() * 16) * U;
    for (let guard = 0; guard < 6000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * fq2 + p2));
      cur.push(a[0] + tx * f - ty * d, a[1] + ty * f + tx * d);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 4) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * SR());
          list.push({ p: cur, w: w * (0.55 + 0.7 * pr) * Math.sqrt(U), a: Math.min(0.95, al * pa * (0.5 + 0.75 * pr)) }); }
        if (s >= s1) break; cur = cur.slice(-2); acc = 0; segL = (10 + SR() * 16) * U;
      }
      const stp = Math.max(0.01, Math.min(3.2 * U, s1 - s)); s += stp; acc += stp;
    }
  }
}
function hatch(poly, deg, gap, o, list) {   // 排线：一组平行的短笔，两头参差
  const t = deg * RAD, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * U * (0.3 + SR() * 0.5); d < mx; d += gap * U * (0.72 + SR() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.6 * U) continue; const a = xs[i] + l * SR() * 0.14, b = xs[i + 1] - l * SR() * 0.14; hand([[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o, list); }
  }
}
const OL = { w: 0.7, a: 0.46, n: 2, j: 0.7, ov: 3 }, OLs = { w: 0.58, a: 0.38, n: 2, j: 0.45, ov: 1.6 }, HT = { w: 0.5, a: 0.3, n: 1, j: 0.25, ov: 1.4 }, CL = { w: 0.42, a: 0.2, n: 1, j: 0.5, ov: 9 };
const op = (o, a) => Object.assign({}, o, a);

/* ---------- 楼：一座在建的哥特主教堂西立面（11/13 第二轮）。横向三开间、四道通高扶壁；纵向自下而上：三座尖拱门、雕像龛带、
   正中玫瑰窗配两侧双尖拱窗、透空小连拱廊、双钟楼。右塔完工带八角石尖顶，左塔砌到半截，墙头马牙槎上立着木踏轮吊车，
   左塔剖开一块露出拱顶肋和旋转楼梯。构件一个个是「槽」，票挂在槽上 ---------- */
let W = 0, H = 0, g = null, G = null;
const arc = (cx, cy, r, a0, a1, n) => { const pts = []; n = n || Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 3)); for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return pts; };
function parch(cx, yb, ys, hw, r, n) {   // 尖拱：两段半径 r 的圆弧在中线相交（r = 2hw 是等边尖拱）。屏幕像素；yb 为 null 时只要拱头
  n = n || 8; const cl = cx - hw + r, cr = cx + hw - r, aa = Math.acos(clamp((hw - r) / r, -1, 1)), pts = yb == null ? [] : [[cx - hw, yb]];
  for (let i = 0; i <= n; i++) { const a = PI - (PI - aa) * i / n; pts.push([cl + r * Math.cos(a), ys - r * Math.sin(a)]); }
  for (let i = 1; i <= n; i++) { const b = (PI - aa) * (1 - i / n); pts.push([cr + r * Math.cos(b), ys - r * Math.sin(b)]); }
  if (yb != null) pts.push([cx + hw, yb]);
  return pts;
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const closed = p => p.concat([p[0]]);
function geometry() {
  const FW = Math.round(clamp(W * 0.47, 138, 190)), fx1 = W - 24, fx0 = fx1 - FW, yg = H - 84, yT = 58;
  const m = Math.min(FW / 17, (yg - yT - 26) / 50), X = v => fx0 + v * m, Y = v => yg - v * m, P = (x, z) => [X(x), Y(z)], M = v => v * m;
  const PA = (cx, zb, zs, hw, r, n) => parch(X(cx), zb == null ? null : Y(zb), Y(zs), M(hw), M(r), n);   // 米单位的尖拱
  const apexZ = (zs, hw, r) => zs + Math.sqrt(r * r - (r - hw) * (r - hw));
  const halfW = (zs, hw, r, z) => z <= zs ? hw : hw - r + Math.sqrt(Math.max(0, r * r - (z - zs) * (z - zs)));
  const slots = [];
  const slot = (k, polys, details, o) => { const all = polys.flat(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; all.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    slots.push(Object.assign({ k, polys, details, extras: [], hatch: null, solid: true, box: [x0, y0, x1, y1], anchor: [(x0 + x1) / 2, (y0 + y1) / 2] }, o || {})); };
  // 扶壁：四道，自下而上三次退台，越高越窄
  const BUT = [[0, 1], [4.6, 5.6], [11.4, 12.4], [16, 17]], SET = [[1, 0], [11.8, 0.08], [21, 0.17], [24, 0.25]];
  const bAt = (i, z) => { let ins = 0; SET.forEach(s => { if (z >= s[0]) ins = s[1]; }); return [BUT[i][0] + ins, BUT[i][1] - ins]; };
  const bayX = (b, z) => [bAt(b, z)[1], bAt(b + 1, z)[0]];   // 第 b 开间（0 左塔、1 中、2 右塔）两扶壁之间
  const CXc = 8.5, CXl = 2.8, CXr = 14.2, ZT = 35.2, CAP = 29.4;   // 中轴；左右塔中线；塔顶；左塔砌到的高度

  // 门：中门最大（五圈线脚、门楣、三层门楣浮雕带、中柱），两侧门小一号；门上三角楣带卷叶小凸起
  { const hw = 1.8, zs = 5.6, r = 3.6, L = PA(CXc, 1.0, zs, hw, r), det = [[P(CXc - hw, 5.0), P(CXc + hw, 5.0)]];
    [6.1, 7.1].forEach(z => { const w = halfW(zs, hw, r, z); det.push([P(CXc - w, z), P(CXc + w, z)]); });
    det.push([P(CXc - 0.16, 1.0), P(CXc - 0.16, 5.0)], [P(CXc + 0.16, 1.0), P(CXc + 0.16, 5.0)], [P(CXc - 0.95, 1.0), P(CXc - 0.95, 5.0)], [P(CXc + 0.95, 1.0), P(CXc + 0.95, 5.0)]);
    [1.8, 3.0, 4.2].forEach(z => [-1, 1].forEach(s => det.push([P(CXc + s * (hw - 0.05), z), P(CXc + s * 0.9, z), P(CXc + s * 0.75, z + 0.12), P(CXc + s * 0.75, z - 0.12), P(CXc + s * 0.9, z)])));
    slot('door', [L], det, { solid: false, hatch: [[P(CXc - hw + 0.05, 1.05), P(CXc + hw - 0.05, 1.05), P(CXc + hw - 0.05, 4.95), P(CXc - hw + 0.05, 4.95)], -58, 3], anchor: [X(CXc - 1.25), Y(3.2)] }); }
  // 门前台阶：四级，越往下越宽
  { const sh = 0.25, ws = [6.0, 6.6, 7.2, 7.8], p = []; for (let i = 3; i >= 0; i--) { const z0 = (3 - i) * sh, z1 = z0 + sh; p.push(P(CXc - ws[i] / 2, z0), P(CXc - ws[i] / 2, z1)); } for (let i = 0; i < 4; i++) { const z1 = (3 - i) * sh + sh, z0 = z1 - sh; p.push(P(CXc + ws[i] / 2, z1), P(CXc + ws[i] / 2, z0)); }
    const det = []; for (let i = 0; i < 4; i++) { const z = (3 - i) * sh + sh - 0.06; det.push([P(CXc - ws[i] / 2, z), P(CXc + ws[i] / 2, z)]); }
    slot('steps', [p], det, { solid: false, anchor: [X(CXc - ws[3] / 2 + 0.5), Y(0.4)] }); }
  // 门边的灯：挂在中门右边那道扶壁上
  { const lx = X((BUT[2][0] + BUT[2][1]) / 2), ly = Y(3.9), p = [[lx - 3.6, ly - 3.4], [lx, ly - 6.4], [lx + 3.6, ly - 3.4], [lx + 2.6, ly - 3.4], [lx + 1.9, ly + 3.8], [lx - 1.9, ly + 3.8], [lx - 2.6, ly - 3.4]];
    slot('lamp', [p], [[[lx, ly - 3.1], [lx, ly + 3.8]], [[lx - 2.4, ly], [lx + 2.4, ly]]], { extras: [[[lx, ly - 6.4], [lx, ly - 9.4]], [[lx - 1, ly + 3.8], [lx, ly + 5.4], [lx + 1, ly + 3.8]]], anchor: [lx, ly] }); }
  // 雕像龛带（中开间那段挂票）：一排小尖拱龛
  const niches = (x0, x1, z0, z1) => { const n = Math.max(1, Math.round((x1 - x0) / 0.78)), w = (x1 - x0) / n, out = []; for (let i = 0; i < n; i++) { const c = x0 + w * (i + 0.5), hw = w * 0.36; out.push(PA(c, z0 + 0.15, z1 - 0.72, hw, hw * 1.9, 5)); } return out; };
  { const [x0, x1] = bayX(1, 12), det = niches(x0, x1, 11.8, 13.6); det.push([P(x0, 12.0), P(x1, 12.0)], [P(x0, 13.35), P(x1, 13.35)]);
    slot('cornice', [rect(X(x0), Y(13.6), X(x1), Y(11.8))], det, { solid: false, anchor: [X(x0 + 0.55), Y(12.7)] }); }
  // 玫瑰窗：中心圆、十二根辐条、一圈尖瓣、外圈十二个小圆，双层外框
  { const cx = X(CXc), cy = Y(17.4), R = M(2.45), det = [arc(cx, cy, R * 0.955, 0, TAU, 40), arc(cx, cy, R * 0.17, 0, TAU, 14), arc(cx, cy, R * 0.56, 0, TAU, 32)], D = TAU / 12;
    for (let i = 0; i < 12; i++) { const a = i * D - PI / 2, c = Math.cos(a), s = Math.sin(a); det.push([[cx + c * R * 0.17, cy + s * R * 0.17], [cx + c * R * 0.56, cy + s * R * 0.56]]);
      const pt = (t, rr) => [cx + Math.cos(t) * R * rr, cy + Math.sin(t) * R * rr]; det.push([pt(a, 0.56), pt(a + D * 0.12, 0.7), pt(a + D * 0.32, 0.8), pt(a + D * 0.5, 0.86), pt(a + D * 0.68, 0.8), pt(a + D * 0.88, 0.7), pt(a + D, 0.56)]);
      det.push([pt(a + D * 0.5, 0.56), pt(a + D * 0.5, 0.7)]); det.push(arc(cx + Math.cos(a + D * 0.5) * R * 0.92, cy + Math.sin(a + D * 0.5) * R * 0.92, R * 0.045, 0, TAU, 7)); det.push([pt(a, 0.86), pt(a, 0.955)]); }
    slot('rose', [arc(cx, cy, R, 0, TAU, 48).slice(0, -1)], det, { anchor: [cx - R * 0.62, cy] }); }
  // 两侧塔楼开间：各一对细高尖拱窗（四个窗槽）
  const lancetSlot = (k, cx) => { const hw = 0.46, zs = 18.2, r = 0.92, L = PA(cx, 14.4, zs, hw, r), Li = PA(cx, null, zs + 0.15, hw * 0.55, r * 0.55, 5);
    slot(k, [L], [Li, [P(cx - hw, 15.7), P(cx + hw, 15.7)], [P(cx - hw, 17.0), P(cx + hw, 17.0)]], { hatch: [L, 62, 2.2], anchor: [X(cx), Y(16.4)] }); };
  lancetSlot('w2l', CXl - 0.62); lancetSlot('w3l', CXl + 0.62); lancetSlot('w2r', CXr - 0.62); lancetSlot('w3r', CXr + 0.62);
  // 透空连拱廊（中开间那段挂票）：细柱加尖拱，后面是天
  const arcade = (x0, x1, z0, z1) => { const n = Math.max(2, Math.round((x1 - x0) / 0.52)), w = (x1 - x0) / n, out = []; for (let i = 0; i <= n; i++) { const x = x0 + w * i; out.push([P(x, z0 + 0.25), P(x, z1 - 1.0)]); if (i < n) out.push(PA(x + w / 2, null, z1 - 1.0, w / 2, w * 0.95, 4)); } out.push([P(x0, z1 - 0.5), P(x1, z1 - 0.5)]); return out; };
  { const [x0, x1] = bayX(1, 21.5), det = arcade(x0, x1, 21, 24);
    slot('rail', [rect(X(x0), Y(24), X(x1), Y(21.1))], det, { solid: false, anchor: [X(x0 + 0.5), Y(22.2)] }); }
  // 右塔八角尖顶上的风向标
  const SPA = ZT + 12.4;
  { const x = X(CXr), y = Y(SPA + 1.5), fl = [[x, y - 1.6], [x + 6, y - 1.3], [x + 4.6, y + 0.1], [x + 6, y + 1.4], [x, y + 1.2]];
    slot('spire', [fl], [[[x + 1.4, y - 1.45], [x + 1.4, y + 1.25]]], { extras: [[P(CXr, SPA + 0.15), [x, y + 2.6]], [[x - 2.6, y + 3.4], [x + 2.6, y + 3.4]]], anchor: [x + 2.2, y] }); }
  // 中殿屋顶：在两塔之间从连拱廊后面露出来的那面山墙屋面（瓦缝、屋脊上一排小花饰）
  { const tri = [P(5.62, 24), P(CXc, 30.4), P(11.38, 24)], det = [];
    for (let i = 1; i < 8; i++) { const z = 24 + 6.4 * i / 8, w = 2.88 * (1 - i / 8); det.push([P(CXc - w + 0.08, z), P(CXc + w - 0.08, z)]); }
    for (let i = 1; i < 6; i++) { const z = 24 + 6.4 * (i - 0.5) / 8; [-1, 1].forEach(s => det.push([P(CXc + s * 0.9 * i / 3, z), P(CXc + s * 0.9 * i / 3, z + 0.4)])); }
    det.push([P(CXc, 30.4), P(CXc, 31.0)], [P(CXc - 0.25, 30.75), P(CXc + 0.25, 30.75)]);
    slot('roof', [tri], det, { solid: false, hatch: [[P(CXc + 0.1, 30.0), P(11.25, 24.05), P(CXc + 0.1, 24.05)], 72, 2.2], anchor: [X(7.9), Y(28.2)] }); }
  // 左塔的脚手板（吊车底下那层）
  { const y = Y(CAP + 0.05); slot('board', [rect(X(1.0), y - 2.6, X(4.2), y)], [[[X(1.8), y - 2.6], [X(1.8), y]], [[X(2.8), y - 2.6], [X(2.8), y]], [[X(3.6), y - 2.6], [X(3.6), y]]], { anchor: [X(1.35), y - 1.3] }); }

  // ———— 底图 ————
  let base = []; SR = rng(20261113);
  const LN = op(OLs, { a: 0.42, ov: 0.6, j: 0.3 }), TL = op(LN, { ov: 0.35, j: 0.18 }), SJ = op(CL, { a: 0.27, ov: 0.4, j: 0.28 }), PO = op(HT, { a: 0.36, ov: 0.25, j: 0.15 }), SH = op(HT, { a: 0.2, ov: 0.4 }), DK = op(HT, { a: 0.32, ov: 0.25, j: 0.18 }), FN = op(OLs, { a: 0.36, n: 1, ov: 0.5, j: 0.25 }), FN2 = op(OLs, { a: 0.28, n: 1, ov: 0.4, j: 0.2 });
  const segs = (pts, o, L) => { for (let i = 0; i + 1 < pts.length; i++) hand([pts[i], pts[i + 1]], o, L || base); };
  const poche = p => { segs(closed(p), TL); hatch(p, 45, 1.25, PO, base); };
  const HL = (x0, x1, z, o) => hand([P(x0, z), P(x1, z)], o || OLs, base), VL = (x, z0, z1, o) => hand([P(x, z0), P(x, z1)], o || OLs, base);
  const shade = (x0, z0, x1, z1, deg, gap, o) => hatch([P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], deg, gap, o || SH, base);
  const dash = [];   // 未砌部分的虚线骨架（屏幕坐标折线），尺规那层画
  const tooth = (x0, zTop, zBot, dir, ch) => { const pts = []; let k = 0; for (let z = zBot; z < zTop - 0.01; z += ch, k++) { const zn = Math.min(zTop, z + ch), x = x0 + (k % 2 ? dir * 0.22 : 0); pts.push(P(x, z), P(x, zn)); } return pts; };
  const capOf = x => x < 1.1 ? 30.6 : x < 4.6 ? CAP + (x > 3.9 ? 0.25 : 0) : 29.9;   // 左塔各处砌到的高（扶壁略高）
  // 外轮廓：两侧和各层横线脚（线脚下面一道影）
  [[1.0, 0, 17, 1], [11.8, 0, 17, 1], [13.6, 0, 17, 0], [21, 0, 17, 1], [24, 0, 17, 1], [34.0, 11.4, 17, 1], [ZT, 11.4, 17, 0]].forEach(([z, a, b, s]) => { HL(a, b, z, OL); HL(a, b, z - 0.16, op(OLs, { a: 0.24 })); if (s) shade(a + 0.05, z - 0.18, b - 0.05, z - 0.42, -60, 2.2, op(SH, { a: 0.17 })); });
  HL(0, 17, 0.62, op(OLs, { a: 0.24 }));
  // 扶壁：正面两条竖线、每次退台一道斜肩、右侧面一窄条暗面
  BUT.forEach((b, i) => { const top = i < 2 ? capOf(i ? 5 : 0.5) : ZT;
    for (let s = 0; s < SET.length; s++) { const z0 = s ? SET[s][0] + 0.45 : 0, z1 = Math.min(top, s + 1 < SET.length ? SET[s + 1][0] : top), ins = SET[s][1]; if (z1 <= z0) continue;
      VL(b[0] + ins, z0, z1, OL); VL(b[1] - ins, z0, z1, OL);
      const sx = b[1] - ins; hand([P(sx + 0.24, z0), P(sx + 0.24, z1)], op(OLs, { a: 0.3 }), base); shade(sx + 0.02, z0 + 0.05, sx + 0.22, z1 - 0.05, 72, 1.5, op(HT, { a: 0.34, ov: 0.2 }));
      if (s) { const pi = SET[s - 1][1]; segs([P(b[0] + pi, SET[s][0]), P(b[0] + ins, SET[s][0] + 0.45)], FN); segs([P(b[1] - pi, SET[s][0]), P(b[1] - ins, SET[s][0] + 0.45)], FN); shade(b[0] + ins, SET[s][0] + 0.05, b[1] - ins, SET[s][0] + 0.4, 0, 1.3, op(HT, { a: 0.18 })); } }
    if (i < 2) { const [w0, w1] = bAt(i, top), wm = (w0 + w1) / 2; segs([P(w0, top), P(w0, top + 0.22), P(wm, top + 0.22), P(wm, top - 0.12), P(w1, top - 0.12)], TL); } });   // 左塔扶壁还没砌完的墙头
  // 三座门：线脚一圈圈往里收；右半边的线脚压一层影；侧门里面最暗
  const portal = (cx, hw, zs, r, rings, d, lin, regs, isC) => {
    for (let i = rings; i >= 0; i--) { const h = hw + i * d, rr = r + i * d, o = i === rings ? OL : op(OLs, { a: 0.36 - i * 0.02, n: 1 }); hand(PA(cx, 1.0, zs, h, rr, 10), o, base); }
    const hO = hw + rings * d, rO = r + rings * d, rp = PA(cx, null, zs, hw + 0.04, r + 0.04, 8).slice(8), ro = PA(cx, null, zs, hO - 0.02, rO - 0.02, 8).slice(8).reverse();
    hatch(rp.concat(ro), -60, 1.4, op(HT, { a: 0.24, ov: 0.2 }), base); shade(cx + hw + 0.05, 1.05, cx + hO - 0.05, zs, -60, 1.4, op(HT, { a: 0.24, ov: 0.2 }));
    if (!isC) { HL(cx - hw, cx + hw, lin, OLs); regs.forEach(z => { const w = halfW(zs, hw, r, z); HL(cx - w, cx + w, z, FN2); });
      const dp = [P(cx - hw + 0.05, 1.05), P(cx + hw - 0.05, 1.05), P(cx + hw - 0.05, lin - 0.05), P(cx - hw + 0.05, lin - 0.05)]; hatch(dp, 62, 1.25, DK, base); hatch(dp, -48, 1.8, op(HT, { a: 0.2 }), base); VL(cx, 1.0, lin, FN2); } };
  portal(CXc, 1.8, 5.6, 3.6, 5, 0.2, 5.0, [], true); portal(CXl, 1.05, 4.4, 2.1, 4, 0.18, 4.0, [5.0], false); portal(CXr, 1.05, 4.4, 2.1, 4, 0.18, 4.0, [5.0], false);
  const gable = (cx, hw, z0, za) => { const th = 0.28; hand([P(cx - hw, z0), P(cx, za)], OLs, base); hand([P(cx + hw, z0), P(cx, za)], OLs, base); hand([P(cx - hw + th, z0), P(cx, za - th * 1.6)], FN2, base); hand([P(cx + hw - th, z0), P(cx, za - th * 1.6)], FN2, base);
    const n = Math.floor(Math.hypot(hw, za - z0) / 0.55); for (let i = 1; i < n; i++) { const t = i / n; [-1, 1].forEach(s => { const x = cx + s * hw * (1 - t), z = z0 + (za - z0) * t; segs([P(x, z), P(x + s * 0.2, z + 0.12), P(x + s * 0.1, z + 0.28)], op(FN, { ov: 0.15 })); }); }   // 卷叶小凸起
    segs([P(cx, za), P(cx, za + 0.45)], FN); segs([P(cx - 0.22, za + 0.3), P(cx, za + 0.45), P(cx + 0.22, za + 0.3)], FN);
    hatch([P(cx + 0.05, za - 0.5), P(cx + hw - 0.4, z0 + 0.15), P(cx + 0.05, z0 + 0.15)], 70, 2.2, op(SH, { a: 0.14 }), base); };
  gable(CXc, 2.95, 7.1, 11.45); gable(CXl, 1.75, 5.7, 8.95); gable(CXr, 1.75, 5.7, 8.95);
  { const c = P(CXc, 10.45); hand(arc(c[0], c[1], M(0.42), 0, TAU, 12), FN, base); hatch(arc(c[0], c[1], M(0.36), 0, TAU, 10), 62, 1.2, DK, base); }
  // 雕像龛带：两侧开间（中开间是槽）
  [0, 2].forEach(b => { const [x0, x1] = bayX(b, 12); niches(x0, x1, 11.8, 13.6).forEach(p => { hand(p, FN, base); hatch(p, 62, 1.35, op(DK, { a: 0.24 }), base); }); HL(x0, x1, 12.0, FN2); HL(x0, x1, 13.35, FN2); });
  // 玫瑰窗外的卸荷尖拱、窗台带
  { const L1 = PA(CXc, 14.5, 16.0, 2.75, 5.5, 12), L2 = PA(CXc, null, 16.0, 3.0, 5.75, 12); hand(L1, OL, base); hand(L2, op(OLs, { a: 0.32, n: 1 }), base);
    hatch(L1.slice(13, 24).concat(L2.slice(13).reverse()), -60, 1.4, op(HT, { a: 0.24, ov: 0.2 }), base); HL(CXc - 2.75, CXc + 2.75, 14.5, OLs); HL(CXc - 2.75, CXc + 2.75, 14.75, FN2); }
  // 两侧双尖拱窗外的总拱和拱头小圆窗
  [CXl, CXr].forEach(bc => { const L = PA(bc, 14.4, 17.6, 1.35, 2.7, 10); hand(L, OLs, base); const c = P(bc, 19.3); hand(arc(c[0], c[1], M(0.3), 0, TAU, 10), FN, base); hatch(arc(c[0], c[1], M(0.24), 0, TAU, 8), 62, 1.2, DK, base);
    hatch(PA(bc + 0.02, null, 17.6, 1.33, 2.68, 10).slice(10).concat([P(bc + 1.33, 14.45), P(bc + 1.15, 14.45), P(bc + 1.15, 17.6)]), -62, 1.5, op(SH, { a: 0.16 }), base); HL(bc - 1.35, bc + 1.35, 14.4, OLs); });
  // 连拱廊两侧段：后面是塔身，透空处排一层暗
  [0, 2].forEach(b => { const [x0, x1] = bayX(b, 21.5); arcade(x0, x1, 21, 24).forEach(p => hand(p, FN, base)); shade(x0 + 0.05, 21.3, x1 - 0.05, 22.9, 90, 1.7, op(HT, { a: 0.16 })); });
  // 中殿屋脊：在两塔之间从连拱廊后面露出来
  // 右钟楼：一对高窄百叶尖拱窗、总拱、檐下小拱、透空栏杆、角上小尖塔
  const bell = (bc, built) => { [-0.74, 0.74].forEach(o => { const cx = bc + o, hw = 0.55, zs = 31.2, r = 1.1;
      if (built) { const L = PA(cx, 25.2, zs, hw, r, 7); hand(L, OLs, base); hatch(L, 62, 1.3, DK, base); for (let z = 25.6; z < zs + 0.4; z += 0.36) { const w = halfW(zs, hw, r, z); if (w > 0.12) segs([P(cx - w + 0.05, z), P(cx + w - 0.05, z - 0.1)], op(FN2, { a: 0.3, ov: 0.1 })); } } });
    if (built) { const L = PA(bc, 25.2, 30.6, 1.55, 3.1, 10); hand(L, OLs, base); HL(bc - 1.55, bc + 1.55, 25.2, OLs); shade(bc - 1.4, 24.35, bc + 1.4, 25.1, 0, 1.5, op(SH, { a: 0.14 })); } };
  bell(CXr, true);
  { const [x0, x1] = [bAt(2, 30)[1], bAt(3, 30)[0]]; for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.5) segs([P(x - 0.18, 34.0), P(x - 0.18, 33.85), P(x, 33.7), P(x + 0.18, 33.85), P(x + 0.18, 34.0)], op(SJ, { a: 0.36, ov: 0.15 }));
    for (let x = 11.4 + 0.3; x < 17 - 0.15; x += 0.5) { segs(parch(X(x), Y(34.3), Y(34.75), M(0.17), M(0.32), 3).concat([P(x + 0.17, 34.3)]), op(FN2, { ov: 0.1 })); } HL(11.4, 17, 34.3, FN2); }
  const pinnacle = (cx, z0, o, L) => { const w = 0.36, zs = z0 + 1.2, za = zs + 2.1, pts = [P(cx - w, z0), P(cx - w, zs), P(cx, za), P(cx + w, zs), P(cx + w, z0)];   // 小尖塔：方身 + 四面小山花 + 粗短的锥（底宽约为高的三分之一）
    if (L) { L.push(pts, [P(cx - w, zs), P(cx, zs + 0.5), P(cx + w, zs)]); return; }
    segs(pts, o); segs([P(cx - w, zs), P(cx, zs + 0.5), P(cx + w, zs)], FN2); for (let t = 0.25; t < 0.95; t += 0.24) [-1, 1].forEach(s => segs([P(cx + s * w * (1 - t), zs + (za - zs) * t), P(cx + s * (w * (1 - t) + 0.16), zs + (za - zs) * t + 0.1)], op(FN, { ov: 0.1 })));
    segs([P(cx, za), P(cx, za + 0.3)], FN); hatch([P(cx + 0.02, za - 0.2), P(cx + w - 0.03, zs + 0.05), P(cx + w - 0.03, z0 + 0.05), P(cx + 0.02, z0 + 0.05)], 72, 1.4, op(HT, { a: 0.26 }), base); };
  [2, 3].forEach(i => pinnacle((BUT[i][0] + BUT[i][1]) / 2, ZT, OLs));
  // 右塔八角石尖顶：底宽约等于塔宽，高约塔身一倍二；三个面看得见，棱上卷叶、正面和侧面开小老虎窗、背光两面排线
  { const a = 2.55, zb = ZT, za = SPA, xe = t => [CXr - a * (1 - t), CXr - a * 0.414 * (1 - t), CXr + a * 0.414 * (1 - t), CXr + a * (1 - t)];
    [0, 1, 2, 3].forEach(k => hand([P(xe(0)[k], zb), P(CXr, za)], k % 3 ? OLs : OL, base));
    for (let z = zb + 0.9; z < za - 0.6; z += 0.9) { const t = (z - zb) / (za - zb), e = xe(t); hand([P(e[2], z), P(e[3], z - 0.12)], op(SJ, { a: 0.24 }), base); if ((z / 0.9 | 0) % 2) hand([P(e[0], z - 0.1), P(e[1], z)], op(SJ, { a: 0.14 }), base); }
    for (let t = 0.07; t < 0.93; t += 0.085) { const z = zb + (za - zb) * t, e = xe(t); [[0, -1], [3, 1]].forEach(([k, s]) => segs([P(e[k], z), P(e[k] + s * 0.24, z + 0.16), P(e[k] + s * 0.14, z + 0.36)], op(FN, { ov: 0.12 }))); [1, 2].forEach(k => segs([P(e[k], z), P(e[k] + (k === 1 ? -0.12 : 0.12), z + 0.2)], op(FN2, { ov: 0.1 }))); }
    hatch([P(xe(0)[2] + 0.04, zb + 0.05), P(xe(0)[3] - 0.05, zb + 0.05), P(CXr + 0.05, za - 0.4)], 74, 1.35, op(HT, { a: 0.3, ov: 0.2 }), base); hatch([P(xe(0)[1] + 0.05, zb + 0.05), P(xe(0)[2] - 0.05, zb + 0.05), P(CXr, za - 0.4)], 74, 3.2, op(HT, { a: 0.12 }), base);
    const lucarne = (cx, z, w, h) => { const p = [P(cx - w, z), P(cx - w, z + h), P(cx, z + h + w * 1.3), P(cx + w, z + h), P(cx + w, z)]; segs(p.concat([p[0]]), FN); const q = [P(cx - w * 0.6, z + 0.05), P(cx - w * 0.6, z + h * 0.85), P(cx, z + h * 0.85 + w * 0.7), P(cx + w * 0.6, z + h * 0.85), P(cx + w * 0.6, z + 0.05)]; segs(q, FN2); hatch(q, 62, 1.1, DK, base); segs([P(cx, z + h + w * 1.3), P(cx, z + h + w * 1.3 + 0.3)], FN2); };
    lucarne(CXr, zb + 2.6, 0.5, 1.2); { const t = 0.36, e = xe(t); lucarne((e[0] + e[1]) / 2, zb + (za - zb) * t, 0.22, 0.75); lucarne((e[2] + e[3]) / 2, zb + (za - zb) * t, 0.22, 0.75); }
    const k = P(CXr, za); hand(arc(k[0], k[1] - M(0.18), M(0.18), 0, TAU, 8), FN, base); }
  // 左钟楼：只砌到半截。右窗的两边窗框砌起来了、还没收拱；墙头马牙槎；剖开的那块露出拱顶肋、楼板和旋转楼梯
  const cutX0 = 1.1, cutX1 = 3.95, cutZ0 = 21.25;
  { const zc = CAP, cz = [X(cutX0 + 0.03), X(cutX1 - 0.03), Y(zc + 1), Y(cutZ0 + 0.02)];   // 剖口里原来画上的立面线先抹掉
    { const out = []; base.forEach(u => { let run = []; const flush = () => { if (run.length >= 4) out.push({ p: run, w: u.w, a: u.a }); run = []; }; for (let i = 0; i < u.p.length; i += 2) { const x = u.p[i], y = u.p[i + 1]; if (x > cz[0] && x < cz[1] && y > cz[2] && y < cz[3]) flush(); else run.push(x, y); } flush(); }); base = out; }
    segs(tooth(cutX1, zc + 0.25, cutZ0, -1, 0.42), TL); segs(tooth(cutX0 + 0.02, zc - 0.6, cutZ0, 1, 0.42), TL);
    const cx = CXl + 0.74; [cx - 0.55, cx + 0.55].forEach(x => { if (x > cutX1) VL(x, 25.2, zc, OLs); }); HL(cutX1, 4.6, 25.2, OLs);
    let cap = [], k = 0; for (let x = cutX1; x < 4.62; x += 0.34, k++) { const z = zc + (k % 2 ? 0.2 : 0); cap.push(P(x, z), P(Math.min(4.62, x + 0.34), z)); } segs(cap, TL);
    // 剖口：底下一道楼板，顶上一道尖肋拱顶（拱顶石、两条往里退的斜肋），中间一座旋转楼梯拧一圈半上去
    const zF = 21.6, sl = 0.3, mx = (cutX0 + cutX1) / 2, xa = cutX0 + 0.22, xb = cutX1, hwV = (xb - xa) / 2, rV = hwV * 1.25, zV = zc - 0.55 - Math.sqrt(rV * rV - (rV - hwV) * (rV - hwV)) - 0.25;
    poche([P(cutX0, cutZ0), P(xa, cutZ0), P(xa, zc - 0.6), P(cutX0, zc - 0.6)]); poche([P(xa, cutZ0), P(xb, cutZ0), P(xb, zF + sl), P(xa, zF + sl)]);
    const ribI = PA(mx + 0.11, null, zV, hwV, rV, 10), ribE = ribI.map(p => [p[0], p[1] - M(0.22)]);
    hand(ribI, OL, base); hand(ribE, op(OLs, { a: 0.36 }), base); hatch(ribE.concat([P(xb, zc - 0.62), P(xa, zc - 0.62)]), 45, 1.35, op(PO, { a: 0.3 }), base);   // 拱顶上面的填充，剖到的
    VL(xa + 0.02, zV - 0.6, zV, FN); VL(xb - 0.02, zV - 0.6, zV, FN); HL(xa, xa + 0.3, zV, FN); HL(xb - 0.3, xb, zV, FN);   // 起拱处的小柱头
    const crown = zV + Math.sqrt(rV * rV - (rV - hwV) * (rV - hwV));
    [0.45, 0.75].forEach(f => { const p = []; for (let i = 0; i <= 12; i++) { const t = i / 12, x = xa + (xb - xa) * t, z = zV + (crown - zV) * f * Math.pow(Math.sin(PI * t), 0.7); p.push(P(x, z)); } hand(p, op(FN2, { a: 0.32 }), base); });   // 斜肋
    { const c = P(mx + 0.11, zV + (crown - zV) * 0.75); hand(arc(c[0], c[1], 1.3, 0, TAU, 8), FN, base); }
    shade(xa + 0.05, zV + 0.05, xb - 0.05, zV - 0.55, 0, 1.4, op(SH, { a: 0.2 }));   // 拱脚下的影
    const R = M(Math.min(1.25, hwV - 0.1)), xc = X(mx + 0.1), y0 = Y(zF + sl), y1 = Y(zV - 0.65);
    shade(xa + 0.05, zF + sl + 0.05, xa + 0.4, zV - 0.7, 80, 1.6, op(SH, { a: 0.18 }));
    const n = Math.max(9, Math.round((y0 - y1) / 4.8)), rs = (y0 - y1) / n, D = 45 * RAD, t0 = -PI / 2 + 0.3, Xs = (t, r) => xc + r * Math.sin(t), fr = t => Math.cos(t) > 0.02;
    const F = op(OL, { a: 0.78, n: 2, ov: 0.4, j: 0.2 }), Bk = op(OLs, { a: 0.32, n: 1, ov: 0.3, j: 0.2 });
    hand([[xc - 0.9, y0], [xc - 0.9, y1]], op(OL, { a: 0.55, ov: 0.3 }), base); hand([[xc + 0.9, y0], [xc + 0.9, y1]], op(OLs, { a: 0.42, ov: 0.3 }), base);
    for (let k2 = 0; k2 < n; k2++) { const t = t0 + k2 * D, y = y0 - (k2 + 1) * rs, f = fr(t + D / 2);
      hand([[Xs(t, 1.1), y], [Xs(t, R), y]], fr(t) ? F : Bk, base); hand([[Xs(t, R), y], [Xs(t + D / 2, R), y], [Xs(t + D, R), y]], f ? F : Bk, base); hand([[Xs(t, R), y], [Xs(t, R), y + rs]], fr(t) ? F : Bk, base);
      if (fr(t) && fr(t + D)) hatch([[Xs(t, 1.4), y + 0.5], [Xs(t + D, R - 0.4), y + 0.5], [Xs(t + D, R - 0.4), y + 2.6], [Xs(t, 1.4), y + 2.6]], -60, 1.1, op(HT, { a: 0.34, ov: 0.1 }), base); }
    const run = (fy, o, oB) => { let cur = [], cf = null; const out = () => { if (cur.length > 1 && (cf ? o : oB)) hand(cur, cf ? o : oB, base); };
      for (let t = t0; t <= t0 + n * D + 1e-6; t += 5 * RAD) { const y = fy(t), f = fr(t); if (y < y1) break; if (cf !== null && f !== cf) { out(); cur = [cur[cur.length - 1]]; } cf = f; cur.push([Xs(t, R - 0.4), y]); } out(); };
    run(t => y0 - ((t - t0) / D + 1) * rs - 7, op(OL, { a: 0.6, n: 1, ov: 0.3 }), op(HT, { a: 0.2 }));
    run(t => y0 - ((t - t0) / D) * rs + 2.4, op(OLs, { a: 0.4, n: 1, ov: 0.3 }), op(HT, { a: 0.14 }));
    // 木踏轮吊车：立在墙头，踏轮、辐条、A 字架、斜伸的吊臂，绳子吊着一块石头
    const wc = P(3.3, zc + 1.45), wr = M(1.2), WD = op(OLs, { a: 0.46, n: 2, ov: 0.4, j: 0.25 }), WT = op(OLs, { a: 0.32, n: 1, ov: 0.3, j: 0.2 });
    hand(arc(wc[0], wc[1], wr, 0, TAU, 28), WD, base); hand(arc(wc[0], wc[1], wr - 1.3, 0, TAU, 24), WT, base);
    for (let i = 0; i < 8; i++) { const a = i * PI / 4 + 0.2; hand([[wc[0] + Math.cos(a) * 1.2, wc[1] + Math.sin(a) * 1.2], [wc[0] + Math.cos(a) * (wr - 1.3), wc[1] + Math.sin(a) * (wr - 1.3)]], WT, base); }
    for (let i = 0; i < 22; i++) { const a = i * TAU / 22; hand([[wc[0] + Math.cos(a) * (wr - 1.3), wc[1] + Math.sin(a) * (wr - 1.3)], [wc[0] + Math.cos(a) * wr, wc[1] + Math.sin(a) * wr]], op(WT, { a: 0.26, ov: 0.1 }), base); }
    hand([wc, P(2.45, zc + 0.02)], WD, base); hand([wc, P(4.15, zc + 0.02)], WD, base); hand([P(2.6, zc + 0.6), P(4.0, zc + 0.6)], WT, base);
    const mt = P(3.3, zc + 3.3), tip = P(0.55, zc + 6.6); hand([wc, mt], WD, base); hand([P(3.0, zc + 0.9), tip], WD, base); hand([mt, tip], WT, base); hand([tip, P(0.55, zc + 2.6)], op(WT, { a: 0.4 }), base); hand([tip, [wc[0] - 1, wc[1] - 1]], op(WT, { a: 0.22 }), base);
    const st = rect(X(0.3), Y(zc + 2.6), X(0.8), Y(zc + 2.2)); segs(closed(st), FN); hatch(st, 62, 1.1, DK, base); segs([P(0.55, zc + 2.6), P(0.3, zc + 2.6)], FN2);
    // 虚线骨架：塔还要往上砌的部分
    const DL = (x0, z0, x1, z1) => dash.push([P(x0, z0), P(x1, z1)]);
    [0, 1].forEach(i => { const b = bAt(i, 30); DL(b[0], capOf(i ? 5 : 0.5), b[0], ZT); DL(b[1], capOf(i ? 5 : 0.5), b[1], ZT); });
    DL(0, 34.0, 5.6, 34.0); DL(0, ZT, 5.6, ZT); DL(0, 34.3, 5.6, 34.3);
    dash.push(PA(CXl, null, 30.6, 1.55, 3.1, 8));
    [0, 1].forEach(i => pinnacle((BUT[i][0] + BUT[i][1]) / 2, ZT, null, dash)); }
  // 石缝：只在扶壁右边那一窄条背光里、和右塔右角扎堆；门窗洞四周让开
  { const Rs = rng(77), ch = 0.55, avoid = slots.map(s => [s.box[0] - 3, s.box[1] - 3, s.box[2] + 3, s.box[3] + 3]);
    const free = (x, z) => { const p = P(x, z); if (avoid.some(b => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3])) return false;
      if (z > 13.5 && z < 21.1 && Math.abs(x - CXc) < 3.1) return false; if (z < 10 && (Math.abs(x - CXc) < 3.0 || Math.abs(x - CXl) < 1.85 || Math.abs(x - CXr) < 1.85)) return false;
      if (z > 13.6 && z < 20.6 && (Math.abs(x - CXl) < 1.45 || Math.abs(x - CXr) < 1.45)) return false; if ((z > 11.7 && z < 13.7) || (z > 20.9 && z < 24.1)) return false;
      if (z > 24.3 && z < 33.9 && x > 11.4 && Math.abs(x - CXr) < 1.65) return false; if (x < 5.6 && z > 21) return false; if (z > 24 && x < 11.4) return false; if (z > 34) return false; return true; };
    for (let z = 1.0 + ch; z < 34; z += ch) { let x = (Math.round(z / ch) % 2 ? 0.2 : 0.5);
      while (x < 17) { const x2 = Math.min(17, x + 0.7 + Rs() * 0.5); let d = 9; BUT.forEach(b => { const e = bAt(BUT.indexOf(b), z)[1]; if (x > e) d = Math.min(d, x - e); });
        const p = clamp((d < 0.9 ? 0.8 - d * 0.6 : 0) + (x > 15.6 ? 0.6 : 0), 0, 0.9);
        if (Rs() < p && free(x, z) && free(x2, z) && free((x + x2) / 2, z)) hand([P(x, z), P(x2, z)], SJ, base);
        if (Rs() < p * 0.8 && free(x2, z + 0.1) && free(x2, z + ch - 0.1)) hand([P(x2, z), P(x2, z + ch)], SJ, base);
        x = x2; } } }
  // 地面：土的短斜笔、几簇草、台阶边一小堆砖
  const Rg = rng(31); for (let x = fx0 - 40; x < W - 10; x += 3 + Rg() * 4) { const l = 2 + Rg() * 4, y = yg + 2 + Rg() * 6; hand([[x, y], [x - l * 0.6, y + l * 0.7]], op(HT, { a: 0.18 + Rg() * 0.1, ov: 0.3 }), base); }
  { const x0 = X(CXc + 4.2), BR = op(OLs, { a: 0.34, n: 1, ov: 0.3, j: 0.2 }); [[0, 0], [5.4, 0], [10.8, 0], [2.7, 1], [8.1, 1], [5.4, 2]].forEach(([dx, r]) => segs(closed(rect(x0 + dx, yg - 2.1 * (r + 1), x0 + dx + 5, yg - 2.1 * r)), BR)); hatch(rect(x0 + 0.4, yg - 2, x0 + 15.4, yg - 0.3), 70, 1.6, op(HT, { a: 0.18 }), base);
    const Rt = rng(58); [X(17) + 4, X(17) + 8.5, X(0.6), X(4.4)].forEach(gx => { for (let i = 0; i < 4; i++) { const a = -PI / 2 + (Rt() - 0.5) * 1.2, l = 1.6 + Rt() * 2.2; hand([[gx + i * 0.7, yg - 0.2], [gx + i * 0.7 + Math.cos(a) * l, yg - 0.2 + Math.sin(a) * l]], op(HT, { a: 0.3, ov: 0.1, j: 0.1 }), base); } }); }
  // 楼层线往右拉到尺寸线
  const LV = [1.0, 11.8, 21, 24, ZT];
  LV.slice(1).forEach(z => hand([[X(17) + 4, Y(z)], [W - 11, Y(z)]], op(CL, { ov: 2 }), base));
  // 编号圈的引线落在构件上：落点四周把底图的线让开一点
  { const AN = slots.map(s => s.anchor), out = [];
    base.forEach(u => { let run = []; const flush = () => { if (run.length >= 4) out.push({ p: run, w: u.w, a: u.a }); run = []; };
      for (let i = 0; i < u.p.length; i += 2) { const x = u.p[i], y = u.p[i + 1]; if (AN.some(a => (x - a[0]) * (x - a[0]) + (y - a[1]) * (y - a[1]) < 12)) flush(); else run.push(x, y); } flush(); });
    base = out; }
  // 每个槽自己的铅笔稿（没挂票时它就是楼的一部分；在做时只画一半）
  slots.forEach((s, i) => { SR = rng(900 + i * 37); const un = []; s.polys.forEach(p => hand(closed(p), s.k === 'board' || s.k === 'lamp' || s.k === 'spire' ? OLs : OL, un)); s.details.forEach(d => hand(d, op(OLs, { a: 0.3, n: 1, ov: 0.6 }), un)); s.extras.forEach(d => hand(d, op(OLs, { a: 0.34, ov: 0.6 }), un));
    if (s.hatch) hatch(s.hatch[0], s.hatch[1], s.hatch[2], op(HT, { a: 0.26 }), un); s.un = un; });
  // 点：脚手架底下一撮灰、尖顶边上几颗星、剖口里几粒浮尘、台阶边碎屑
  const dust = [], Rd = rng(4040);
  for (let i = 0; i < 40; i++) { const a = Rd() * PI, q = Math.pow(Rd(), 1.6) * 20; dust.push([X(2.6) + Math.cos(a) * q * 1.4, Y(CAP) - 0.5 - Math.sin(a) * q * 0.2, 0.22 + Rd() * 0.35]); }
  for (let i = 0; i < 12; i++) dust.push([X(CXr) - 30 + Rd() * 60, Y(SPA + 2) - Rd() * 50, 0.25 + Rd() * 0.35]);
  for (let i = 0; i < 8; i++) dust.push([X(cutX0 + 0.5) + Rd() * M(2.2), Y(28.4) + Rd() * M(3.4), 0.22 + Rd() * 0.2]);
  for (let i = 0; i < 26; i++) { const q = Math.pow(Rd(), 1.4); dust.push([X(CXc + 3.6) + q * 34 * (Rd() - 0.3), yg - 0.8 - Rd() * Rd() * 3, 0.22 + Rd() * 0.3]); }
  const ccx = fx0 - 14;
  return { fx0, fx1, FW, m, X, Y, cx: X(CXc), yg, yT, slots, base, dust, dash, ccx, tbx: ccx - 11, ZT, SPA, CAP, BUT, bAt, LV, perch: P(4.35, CAP + 0.2) };
}

/* ---------- 票挂到哪个构件：标题里有「窗」「灯」「台阶」这类字就挂过去，不然按编号散开。在做 > 待办 > 最近做完 ---------- */
const KW = [[/玫瑰|圆窗|花窗/, ['rose']], [/窗/, ['w2l', 'w3l', 'w2r', 'w3r']], [/灯/, ['lamp']], [/台阶|楼梯|踏步/, ['steps']], [/门/, ['door']], [/栏杆|阳台|扶手/, ['rail']],
  [/尖顶|塔|风向/, ['spire']], [/瓦|屋顶|屋面/, ['roof']], [/檐|线脚/, ['cornice']], [/脚手|踏板|木板/, ['board']]];
let MAP = new Map();   // slot k -> ticket
function assign() {
  MAP = new Map(); if (!G) return;
  const order = items.filter(x => x.status === 'doing').concat(items.filter(x => x.status === 'todo'), items.filter(x => x.status === 'done').sort((a, b) => String(b.updated).localeCompare(String(a.updated))));
  const ks = G.slots.map(s => s.k), free = new Set(ks);
  const take = (it, k) => { free.delete(k); MAP.set(k, it); };
  const rest = [];
  order.forEach(it => { const kw = KW.find(([re]) => re.test(it.title || '')); const k = kw && kw[1].find(x => free.has(x)); if (k) take(it, k); else rest.push(it); });
  rest.forEach(it => { if (!free.size) return; const n = (it.no || parseInt(String(it.id).slice(1), 10) || 0); let i = (n * 5) % ks.length; for (let g2 = 0; g2 < ks.length && !free.has(ks[i]); g2++) i = (i + 1) % ks.length; take(it, ks[i]); });
}
const slotOf = id => { for (const [k, it] of MAP) if (it.id === id) return G.slots.find(s => s.k === k); return null; };

/* ---------- 画 ---------- */
function cols() {
  const cs = getComputedStyle(document.body);
  return { pen: dark ? '#9c9ca2' : C.PEN, ink: dark ? C.PAPER : C.LINE, fg3: cs.getPropertyValue('--fg3').trim() || C.GREY, blue: cs.getPropertyValue('--lb').trim() || C.BLUE, bg: dark ? C.INK : C.PAPER };
}
function strokeUN(x, un, col, al) { x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; for (const u of un) { x.globalAlpha = Math.min(1, u.a * (al || 1)); x.lineWidth = u.w; x.beginPath(); x.moveTo(u.p[0], u.p[1]); for (let i = 2; i < u.p.length; i += 2) x.lineTo(u.p[i], u.p[i + 1]); x.stroke(); } x.globalAlpha = 1; }
function pathOf(x, pts, close) { x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); if (close) x.closePath(); }
function ruled(x, poly, deg, gap) {   // 尺规排线：硬直的等距平行线，裁在外面
  const t = deg * RAD, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9, a0 = 1e9, a1 = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny, e = p[0] * dx + p[1] * dy; mn = Math.min(mn, d); mx = Math.max(mx, d); a0 = Math.min(a0, e); a1 = Math.max(a1, e); }
  for (let d = mn + gap / 2; d < mx; d += gap) { x.moveTo(nx * d + dx * a0, ny * d + dy * a0); x.lineTo(nx * d + dx * a1, ny * d + dy * a1); }
}
function splitQuads(s) {   // 在做：一条斜线劈开构件，左上那半是铅笔稿
  const b = s.box, c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], a = -28 * RAD, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = 400;
  const q = sg => [[c[0] + ux * L, c[1] + uy * L], [c[0] - ux * L, c[1] - uy * L], [c[0] - ux * L + sg * nx * L, c[1] - uy * L + sg * ny * L], [c[0] + ux * L + sg * nx * L, c[1] + uy * L + sg * ny * L]];
  const up = (-1 * nx + -1 * ny) > 0 ? 1 : -1;   // 指向左上的那一侧
  const ext = Math.min((b[2] - b[0]) / 2 / Math.abs(ux), (b[3] - b[1]) / 2 / Math.abs(uy)) + 3.5;
  return { pen: q(up), dash: q(-up), line: [[c[0] - ux * ext, c[1] - uy * ext], [c[0] + ux * ext, c[1] + uy * ext]], n: [up * nx, up * ny] };
}
function drawSlot(x, s, it, col, sel) {
  const st = it ? it.status : null;
  if (!st) { strokeUN(x, s.un, col.pen); return; }
  const dashed = () => { x.save(); x.setLineDash([2, 1.7]); x.strokeStyle = col.ink; x.globalAlpha = dark ? 0.55 : 0.6; x.lineWidth = 0.5; x.beginPath(); s.polys.forEach(p => pathOf(x, p, true)); x.stroke(); x.globalAlpha *= 0.7; x.beginPath(); s.extras.forEach(p => pathOf(x, p)); x.stroke(); x.restore(); };
  if (st === 'todo') { dashed(); }
  else if (st === 'doing') {
    const sq = splitQuads(s);
    x.save(); x.beginPath(); pathOf(x, sq.pen, true); x.clip(); strokeUN(x, s.un, col.pen, 1.25); x.restore();
    x.save(); x.beginPath(); pathOf(x, sq.dash, true); x.clip(); dashed(); x.restore();
    // 分界线两头伸出构件一点，平头带短划；分界处一撮细粒往虚线那半散开
    x.strokeStyle = col.ink; x.globalAlpha = 0.75; x.lineWidth = 0.4; x.lineCap = 'butt'; x.beginPath(); pathOf(x, sq.line); x.stroke();
    const [p, q] = sq.line, L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = -(q[1] - p[1]) / L * 1.1, ny = (q[0] - p[0]) / L * 1.1; x.beginPath(); x.moveTo(p[0] - nx, p[1] - ny); x.lineTo(p[0] + nx, p[1] + ny); x.moveTo(q[0] - nx, q[1] - ny); x.lineTo(q[0] + nx, q[1] + ny); x.stroke();
    const R = rng(s.k.length * 131 + 7); x.fillStyle = col.ink; x.globalAlpha = 0.55; x.beginPath(); for (let i = 0; i < 14; i++) { const t = 0.15 + R() * 0.7, d = 0.4 + R() * R() * 3.4; dot(x, p[0] + (q[0] - p[0]) * t - sq.n[0] * d, p[1] + (q[1] - p[1]) * t - sq.n[1] * d, 0.22 + R() * 0.2); } x.fill(); x.globalAlpha = 1;
  } else {   // 做完：实心蓝，细节反白；栏杆这种细的只描实
    x.save(); x.lineCap = 'butt'; x.lineJoin = 'miter';
    if (s.solid) { x.fillStyle = col.blue; x.beginPath(); s.polys.forEach(p => pathOf(x, p, true)); x.fill('evenodd'); x.save(); x.clip('evenodd'); x.strokeStyle = col.bg; x.lineWidth = 0.5; x.beginPath(); s.details.forEach(p => pathOf(x, p)); x.stroke(); x.restore(); }
    else { x.strokeStyle = col.blue; x.lineWidth = 0.45; x.beginPath(); s.details.forEach(p => pathOf(x, p)); x.stroke(); if (s.hatch) { x.save(); x.beginPath(); pathOf(x, s.hatch[0], true); x.clip(); x.globalAlpha = 0.55; x.lineWidth = 0.35; x.beginPath(); ruled(x, s.hatch[0], s.hatch[1], 2.2); x.stroke(); x.restore(); } }
    x.strokeStyle = col.blue; x.lineWidth = 0.5; x.beginPath(); s.polys.forEach(p => pathOf(x, p, true)); x.stroke(); x.beginPath(); s.extras.forEach(p => pathOf(x, p)); x.stroke(); x.restore();
  }
  if (sel) {   // 选中：四角四个小直角
    const b = s.box, m = 3, l = 3.4; x.strokeStyle = col.blue; x.lineWidth = 0.5; x.lineCap = 'butt'; x.beginPath();
    [[b[0] - m, b[1] - m, 1, 1], [b[2] + m, b[1] - m, -1, 1], [b[0] - m, b[3] + m, 1, -1], [b[2] + m, b[3] + m, -1, -1]].forEach(([cx, cy, sx, sy]) => { x.moveTo(cx + sx * l, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + sy * l); });
    x.stroke();
  }
}
let CALLS = [];
function layoutCalls() {   // 编号圈排成一列，按构件的高低放，挤了就往下推，出了地面再整体往上收
  const arr = []; for (const [k, it] of MAP) { const s = G.slots.find(z => z.k === k); arr.push({ it, s, ay: s.anchor[1], y: s.anchor[1] }); }
  arr.sort((a, b) => a.ay - b.ay); const gap = 19, top = 84, bot = G.yg - 12;
  for (let i = 0; i < arr.length; i++) arr[i].y = Math.max(arr[i].ay, i ? arr[i - 1].y + gap : top);
  for (let i = arr.length - 1; i >= 0; i--) arr[i].y = Math.min(arr[i].y, i < arr.length - 1 ? arr[i + 1].y - gap : bot);
  CALLS = arr;
}
function drawCalls(x, col) {
  const r = 7.4, cx0 = G.ccx;
  x.font = '400 6.4px ui-monospace, "SF Mono", Menlo, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  // 引线底下先垫一道纸色，楼上的细活从这里让开，引线一眼找得到；离落点还有几像素就停，不吃构件
  x.save(); x.strokeStyle = col.bg; x.globalAlpha = 0.86; x.lineWidth = 1.8; x.lineCap = 'butt'; x.lineJoin = 'round'; x.beginPath();
  CALLS.forEach(c => { const x1 = cx0 + r + 5, dx = c.s.anchor[0] - x1, dy = c.s.anchor[1] - c.y, dl = Math.hypot(dx, dy) || 1, k = Math.max(0, (dl - 4.5) / dl); x.moveTo(cx0 + r, c.y); x.lineTo(x1, c.y); x.lineTo(x1 + dx * k, c.y + dy * k); });
  x.stroke(); x.restore();
  CALLS.forEach(c => {
    const sel = c.it.id === openId, st = c.it.status, ax = c.s.anchor[0], ay = c.s.anchor[1], cy = c.y, lc = sel ? col.blue : col.ink;
    // 引线：先平出一小截，再斜着去构件；构件那头一颗点
    x.save(); x.strokeStyle = lc; x.globalAlpha = sel ? 0.9 : 0.42; x.lineWidth = sel ? 0.5 : 0.38; x.lineCap = 'butt'; if (st === 'todo' && !sel) x.setLineDash([1.6, 1.6]);
    x.beginPath(); x.moveTo(cx0 + r, cy); x.lineTo(cx0 + r + 5, cy); x.lineTo(ax, ay); x.stroke(); x.restore();
    x.fillStyle = lc; x.globalAlpha = sel ? 1 : 0.7; x.beginPath(); dot(x, ax, ay, sel ? 1.25 : 0.85); x.fill(); x.globalAlpha = 1;
    // 圈
    x.save(); x.lineWidth = 0.5;
    if (st === 'done') { x.fillStyle = col.blue; x.beginPath(); x.arc(cx0, cy, r, 0, TAU); x.fill(); }
    else {
      x.fillStyle = col.bg; x.beginPath(); x.arc(cx0, cy, r, 0, TAU); x.fill();
      if (st === 'doing') { x.save(); x.beginPath(); x.arc(cx0, cy, r, 0, TAU); x.clip(); x.strokeStyle = col.pen; x.globalAlpha = 0.45; x.lineWidth = 0.35; x.beginPath(); for (let k = -3; k <= 0; k++) { const o = k * 2.3 - 1.4; x.moveTo(cx0 - r + o, cy + r); x.lineTo(cx0 + r + o, cy - r); } x.stroke(); x.restore();
        x.strokeStyle = col.ink; x.globalAlpha = 0.6; x.lineWidth = 0.4; x.beginPath(); x.moveTo(cx0 - r - 2, cy + r * 0.5 + 1); x.lineTo(cx0 + r + 2, cy - r * 0.5 - 1); x.stroke(); x.globalAlpha = 1; }
      x.strokeStyle = sel ? col.blue : col.ink; x.globalAlpha = st === 'todo' ? 0.62 : 0.85; if (st === 'todo') x.setLineDash([1.5, 1.3]); x.beginPath(); x.arc(cx0, cy, r, 0, TAU); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
    }
    if (sel) { x.strokeStyle = col.blue; x.lineWidth = 0.4; x.beginPath(); x.arc(cx0, cy, r + 2.4, 0, TAU); x.stroke(); }
    x.restore();
    x.fillStyle = st === 'done' ? col.bg : st === 'todo' ? col.pen : col.ink; x.globalAlpha = 1;
    x.fillText(String(c.it.no || String(c.it.id).replace(/^T0*/, '')).padStart(3, '0'), cx0, cy + 0.3);
  });
}
function hard(x, col) {   // 尺规的硬线：中轴、地面线、右边的高度尺寸、±0.000
  const { cx, yg, Y, yT, tbx, LV, SPA } = G; x.save(); x.lineCap = 'butt';
  x.strokeStyle = col.ink; x.globalAlpha = 0.28; x.lineWidth = 0.35; x.setLineDash([7, 2, 1, 2]); x.beginPath(); x.moveTo(cx, yg + 14); x.lineTo(cx, Y(32.6)); x.stroke(); x.setLineDash([]);
  x.globalAlpha = 0.6; x.lineWidth = 0.5; x.beginPath(); x.moveTo(tbx, yg); x.lineTo(W - 6, yg); x.stroke();
  const dx = W - 11, zs = [0].concat(LV, [SPA]), ys = zs.map(Y);
  x.globalAlpha = 0.5; x.lineWidth = 0.4; x.beginPath(); x.moveTo(dx, yg + 3); x.lineTo(dx, ys[ys.length - 1] - 3); ys.forEach(y => { x.moveTo(dx - 2.2, y + 2.2); x.lineTo(dx + 2.2, y - 2.2); x.moveTo(dx - 3, y); x.lineTo(dx + 1.5, y); }); x.stroke();
  x.fillStyle = col.ink; x.globalAlpha = 0.5; x.font = '400 6px ui-monospace, "SF Mono", Menlo, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  for (let i = 0; i + 1 < ys.length; i++) { if (ys[i] - ys[i + 1] < 26) continue; const mm = Math.round((zs[i + 1] - zs[i]) * 2400 / 50) * 50, my = (ys[i] + ys[i + 1]) / 2; x.save(); x.translate(dx - 2.4, my); x.rotate(-PI / 2); x.fillText(String(mm).replace(/(\d)(\d{3})$/, '$1 $2'), 0, 0); x.restore(); }
  x.textAlign = 'left'; x.globalAlpha = 0.55; x.fillText('±0.000', tbx, yg + 9); x.font = 'italic 300 7px "Cormorant Garamond", serif'; x.fillText('CL', cx + 2, Y(32.6) + 1);
  x.beginPath(); x.moveTo(tbx + 26, yg + 4); x.lineTo(tbx + 29, yg + 1); x.lineTo(tbx + 32, yg + 4); x.closePath(); x.globalAlpha = 0.5; x.lineWidth = 0.4; x.strokeStyle = col.ink; x.stroke();
  x.restore();
}
function drafting(x, col) {   // 尺规的那一层：左塔脚手架、未砌部分的虚线骨架、轴线圈和总尺寸、标高三角、比例尺、指北针
  const { X, Y, yg, CAP, BUT, LV, dash, tbx } = G, L = (a, w, f, d) => { x.globalAlpha = a; x.lineWidth = w; x.setLineDash(d || []); x.beginPath(); f(); x.stroke(); x.setLineDash([]); };
  const M2 = (a, b, c, d) => { x.moveTo(a, b); x.lineTo(c, d); };
  x.save(); x.lineCap = 'butt'; x.lineJoin = 'miter'; x.strokeStyle = col.ink; x.fillStyle = col.ink;
  // 脚手架：立在连拱廊顶上，两根立杆贴着剖口两边；墙头以上一层层横杆、十字撑、护栏
  { const p0 = X(0.95), p1 = X(4.2), lifts = [CAP, CAP + 1.55, CAP + 3.1, CAP + 4.6].map(Y), top = Y(CAP + 5.4);
    L(0.5, 0.4, () => { M2(p0, Y(CAP - 0.3), p0, top); M2(p1, Y(CAP - 0.3), p1, top); });
    L(0.4, 0.35, () => lifts.forEach(y => M2(p0 - 3, y, p1 + 3, y)));
    L(0.26, 0.3, () => { for (let i = 0; i + 1 < lifts.length; i++) { M2(p0, lifts[i], p1, lifts[i + 1]); if (i % 2) M2(p1, lifts[i], p0, lifts[i + 1]); } M2(p0, top + 3.5, p1, top + 3.5); });
    x.globalAlpha = 0.6; x.beginPath(); lifts.forEach(y => [p0, p1].forEach(p => x.rect(p - 0.6, y - 0.6, 1.2, 1.2))); x.fill(); }
  // 虚线骨架：左塔还要往上砌的扶壁、窗、檐口、栏杆、角上小尖塔
  L(0.5, 0.4, () => dash.forEach(p => { x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); }), [1.6, 1.4]);
  // 轴线圈（四道扶壁）和三段总尺寸（顶上），标高三角（右边尺寸线上）
  { const ya = 40, yd = 51.5, axs = BUT.map(b => X((b[0] + b[1]) / 2)); x.font = 'italic 400 7.5px "Cormorant Garamond", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    L(0.5, 0.4, () => axs.forEach(ax => { x.moveTo(ax + 4.4, ya); x.arc(ax, ya, 4.4, 0, TAU); }));
    L(0.2, 0.3, () => axs.forEach(ax => M2(ax, ya + 4.4, ax, Y(39.4))), [6, 1.6, 0.8, 1.6]);
    x.globalAlpha = 0.7; axs.forEach((ax, i) => x.fillText(String(i + 1), ax, ya + 0.4));
    L(0.45, 0.35, () => { M2(axs[0] - 3, yd, axs[3] + 3, yd); axs.forEach(t => { M2(t - 1.8, yd + 1.8, t + 1.8, yd - 1.8); M2(t, yd - 2.6, t, yd + 2.6); }); });
    x.font = '400 6px ui-monospace, "SF Mono", Menlo, Consolas, monospace'; x.textBaseline = 'alphabetic'; x.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) { const mm = Math.round((axs[i + 1] - axs[i]) / G.m * 2400 / 50) * 50 + ''; x.fillText(mm.replace(/(\d)(\d{3})$/, '$1 $2'), (axs[i] + axs[i + 1]) / 2, yd - 2); }
    L(0.5, 0.35, () => LV.slice(1).forEach(z => { const y = Y(z), tx = W - 16; x.moveTo(tx - 1.6, y - 2.2); x.lineTo(tx + 1.6, y - 2.2); x.lineTo(tx, y); x.closePath(); })); }
  // 图签底下：比例尺、指北针
  { const yS = yg + 16 + (tb.offsetHeight || 28) + 11, x0 = tbx; if (yS < H - 6) {
      x.globalAlpha = 0.55; x.beginPath(); for (let i = 0; i < 4; i += 2) x.rect(x0 + i * 10, yS - 0.9, 10, 1.8); x.fill();
      L(0.5, 0.35, () => { x.rect(x0, yS - 0.9, 40, 1.8); M2(x0, yS - 2.6, x0, yS + 0.9); M2(x0 + 20, yS - 2.6, x0 + 20, yS + 0.9); M2(x0 + 40, yS - 2.6, x0 + 40, yS + 0.9); });
      x.font = 'italic 400 7px "Cormorant Garamond", serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.globalAlpha = 0.6; x.fillText('0', x0, yS + 8); x.fillText('5', x0 + 20, yS + 8); x.fillText('10 m', x0 + 43, yS + 8);
      const ax = x0 + 64; L(0.4, 0.35, () => { x.moveTo(ax + 4.6, yS - 1); x.arc(ax, yS - 1, 4.6, 0, TAU); });
      x.globalAlpha = 0.75; x.beginPath(); x.moveTo(ax, yS - 7.4); x.lineTo(ax - 2, yS + 2.4); x.lineTo(ax, yS + 1); x.closePath(); x.fill();
      L(0.7, 0.35, () => { x.moveTo(ax, yS - 7.4); x.lineTo(ax + 2, yS + 2.4); x.lineTo(ax, yS + 1); M2(ax, yS - 8.6, ax, yS + 3.2); });
      x.globalAlpha = 0.6; x.textAlign = 'left'; x.fillText('N', ax + 5.4, yS - 4.6); } }
  x.restore(); x.globalAlpha = 1;
}
let STAT = null;   // 不随票变的那几层（纸、尺规线、铅笔底图、点）画一次存起来
function draw() {
  if (!g || !G) return;
  const col = cols(); g.clearRect(0, 0, W, H);
  if (!STAT) {
    STAT = document.createElement('canvas'); const s = fitCanvas(STAT, W, H); spots(s, W, H, 512, dark ? 'rgba(200,200,205,0.12)' : 'rgba(84,84,88,0.2)');
    hard(s, col); drafting(s, col); strokeUN(s, G.base, col.pen);
    s.fillStyle = col.pen; s.globalAlpha = 0.55; s.beginPath(); G.dust.forEach(d => dot(s, d[0], d[1], d[2])); s.fill(); s.globalAlpha = 1;
    { const sx = G.X(16.4), sy = G.Y(45.5); s.strokeStyle = col.pen; s.lineWidth = 0.35; s.globalAlpha = 0.6; s.beginPath(); s.moveTo(sx - 2, sy); s.lineTo(sx + 2, sy); s.moveTo(sx, sy - 2); s.lineTo(sx, sy + 2); s.stroke(); s.globalAlpha = 1; }
  }
  g.drawImage(STAT, 0, 0, W, H);
  const sel = openId && slotOf(openId);
  G.slots.forEach(s => drawSlot(g, s, MAP.get(s.k), col, sel === s));
  // 檐口左头停一只收着翅膀的燕子
  g.save(); g.translate(G.perch[0], G.perch[1] - 0.6); g.scale(0.072, 0.072); g.fillStyle = col.ink; g.globalAlpha = 0.92; g.fill(new Path2D(PERCH)); g.restore();
  drawCalls(g, col);
}
function paintCalls() {
  calls.innerHTML = CALLS.map(c => `<button type="button" data-id="${esc(c.it.id)}" style="left:${f2(G.ccx)}px;top:${f2(c.y)}px" aria-label="${esc(c.it.id + ' ' + c.it.title + ' · ' + STZ[c.it.status])}"></button>`).join('');
}
function paintTB() {
  const n = k => items.filter(x => x.status === k).length, d = new Date();
  tb.innerHTML = `<div><b>立面</b><span class="en">elevation</span></div><div>${phase === 'ok' ? ST.map(([k, zh]) => zh + '<em>' + n(k) + '</em>').join('') : '<span class="n">— · — · —</span>'}<span class="en">sheet ${String(d.getMonth() + 1).padStart(2, '0')} · ${pad(d.getDate())}</span></div><div><span class="n">1:50</span><span class="en">N°02</span></div>`;
}

/* ---------- 票单和票面 ---------- */
const sortIn = arr => arr.sort((a, b) => String(a.pri).localeCompare(String(b.pri)) || String(b.updated).localeCompare(String(a.updated)));
const nextSt = { todo: 'doing', doing: 'done', done: 'todo' }, stBtn = { todo: '开工', doing: '做完了', done: '重开' };
function cardHTML(it) {
  const meta = [esc(it.by || '') + ' 记 · ' + fmt(it.ts)];
  if (it.to) meta.push('指给 ' + esc(it.to)); if (it.owner) meta.push(esc(it.owner) + ' 在做');
  if (it.day) meta.push('<em>白天能做</em>'); if (it.wait) meta.push('<em>等 ' + esc(ME) + '</em>');
  const tos = [''].concat(WHO); if (it.to && tos.indexOf(it.to) < 0) tos.push(it.to);
  return `<div class="card${REDUCED ? '' : ' in'}" data-id="${esc(it.id)}"><svg class="fr" aria-hidden="true"></svg>
    <div class="top"><span class="num"><small>N°</small>${esc(it.id)}</span><span class="stt">${STZ[it.status] || esc(it.status)} · <b class="${it.pri}">${String(it.pri || '').toUpperCase()}</b> · <b>${esc(it.size || '')}</b></span></div>
    <h3>${esc(it.title)}</h3>
    <div class="meta">${meta.map(m => '<span>' + m + '</span>').join(' · ')}</div>
    ${it.files && it.files.length ? `<div class="files">在改 ${it.files.map(esc).join('、')}</div>` : ''}
    ${it.body ? `<div class="body">${esc(it.body)}</div>` : ''}
    ${it.proof ? `<a class="proof" href="${esc(it.proof)}" target="_blank" rel="noopener">看看做成什么样 ›</a>` : ''}
    ${it.log && it.log.length ? `<div class="log">${it.log.slice(-8).map(l => esc(fmt(l.ts) + ' ' + l.who + '  ' + l.text)).join('\n')}</div>` : ''}
    <div class="stub">
      <div class="to"><span>指给</span>${tos.map(w => `<button type="button" data-to="${esc(w)}" class="${(it.to || '') === w ? 'on' : ''}">${w ? esc(w) : '没指定'}</button>`).join('')}</div>
      <div class="acts"><button type="button" class="main" data-act="st">${stBtn[it.status] || '开工'}</button><button type="button" data-act="pri">优先级</button><button type="button" data-act="day">${it.day ? '取消白天' : '白天能做'}</button><button type="button" data-act="wait">${it.wait ? '不用等我' : '等我'}</button>${it.status === 'done' ? '<button type="button" data-act="back">打回</button>' : ''}<button type="button" data-act="del" class="${armDel === it.id ? 'arm' : ''}">${armDel === it.id ? '再点一下删掉' : '删'}</button></div>
      ${backing === it.id ? '<form class="why"><input name="why" placeholder="哪里不行" aria-label="打回的原因" maxlength="300"><button type="submit">送回</button></form>' : ''}
    </div></div>`;
}
function rowHTML(it) {
  return `<button type="button" class="row ${esc(it.pri)}${openId === it.id ? ' on' : ''}" data-id="${esc(it.id)}" aria-expanded="${openId === it.id}"><span class="no">${esc(it.id)}</span><span class="tt">${esc(it.title)}</span></button>` + (openId === it.id ? cardHTML(it) : '');
}
function paint() {
  noteEl.hidden = phase === 'ok';
  noteEl.innerHTML = phase === 'load' ? '在翻图纸…' : phase === 'fail' ? '没读到图纸 · <button type="button" id="retry">再试一次</button>' : phase === 'nokey' ? '还没带钥匙，<a href="../index.html">去登录</a>' : phase === 'auth' ? '钥匙不认了，<a href="../index.html">去登录</a>' : '';
  addF.hidden = phase !== 'ok';
  if (phase !== 'ok') { secs.innerHTML = ''; items = phase === 'auth' || phase === 'nokey' ? [] : items; }
  else {
    if (openId && !items.some(x => x.id === openId)) openId = null;
    secs.innerHTML = ST.map(([k, zh, en]) => {
      const arr = sortIn(items.filter(x => x.status === k)), cap = k === 'done' && !doneAll ? DONEMAX : 1e9, show = arr.filter((x, i) => i < cap || x.id === openId);
      return `<section class="sec ${k}"><div class="sh"><span class="en" aria-hidden="true">${en}</span><b>${zh}</b><i>${arr.length}</i></div>`
        + (show.length ? show.map(rowHTML).join('') : `<p class="none">${EMPTY[k]}</p>`)
        + (arr.length > show.length ? `<button type="button" class="more">再看 ${arr.length - show.length} 张</button>` : '') + '</section>';
    }).join('');
  }
  assign(); if (G) { layoutCalls(); paintCalls(); } paintTB(); frames(); draw();
}
/* 票面的线框：四角内凹，两侧一对半圆缺口，缺口之间一道撕线；外框里面再套一道更细的 */
function frames() {
  secs.querySelectorAll('.card').forEach(cd => {
    const w = cd.offsetWidth, h = cd.offsetHeight, stub = cd.querySelector('.stub'), ty = stub ? stub.offsetTop - 4 : h - 30, r = 3, nr = 4.2, i = 0.5, j = 3;
    const P = (o, rr, nn) => { const x0 = o, y0 = o, x1 = w - o, y1 = h - o, R = Math.max(0.5, rr - o * 0.3);
      return `M${f2(x0 + R)} ${f2(y0)}H${f2(x1 - R)}A${R} ${R} 0 0 0 ${f2(x1)} ${f2(y0 + R)}V${f2(ty - nn)}A${nn} ${nn} 0 0 0 ${f2(x1)} ${f2(ty + nn)}V${f2(y1 - R)}A${R} ${R} 0 0 0 ${f2(x1 - R)} ${f2(y1)}H${f2(x0 + R)}A${R} ${R} 0 0 0 ${f2(x0)} ${f2(y1 - R)}V${f2(ty + nn)}A${nn} ${nn} 0 0 0 ${f2(x0)} ${f2(ty - nn)}V${f2(y0 + R)}A${R} ${R} 0 0 0 ${f2(x0 + R)} ${f2(y0)}Z`; };
    let dots = ''; for (let x = 14; x < w - 14; x += 9) dots += `<circle cx="${f2(x)}" cy="${f2(h - j - 2.2)}" r=".35"/>`;
    const sv = cd.querySelector('svg.fr'); sv.setAttribute('viewBox', `0 0 ${w} ${h}`);
    sv.innerHTML = `<path class="o" d="${P(i, r, nr)}"/><path class="i" d="${P(j, r + 1.5, nr + 2.5)}"/><path class="t" d="M${f2(nr + 3)} ${f2(ty)}H${f2(w - nr - 3)}"/><g class="dt">${dots}</g>`;
  });
}
function ensureVisible(el) {
  if (!el) return; const lr = list.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.bottom > lr.bottom - 30) list.scrollTop += Math.min(r.bottom - lr.bottom + 34, r.top - lr.top - 20);
  else if (r.top < lr.top + 14) list.scrollTop -= lr.top + 18 - r.top;
}
function openTicket(id, fromDrawing) {
  openId = openId === id ? null : id; armDel = null; backing = null;   // 再点同一张（票单或图上的编号）就合上
  if (openId) { const it = items.find(x => x.id === openId); if (it && it.status === 'done') { const done = sortIn(items.filter(x => x.status === 'done')); if (done.indexOf(it) >= DONEMAX) doneAll = true; } }
  paint();
  if (openId) { const cd = secs.querySelector('.card'); ensureVisible(cd ? (fromDrawing ? cd.previousElementSibling : cd) : null); if (fromDrawing && cd) ensureVisible(cd); }
}
secs.addEventListener('click', ev => {
  const row = ev.target.closest('.row'); if (row) { openTicket(row.dataset.id); return; }
  if (ev.target.closest('.more')) { doneAll = true; paint(); return; }
  const cd = ev.target.closest('.card'); if (!cd) return;
  const it = items.find(x => x.id === cd.dataset.id); if (!it) return;
  const tb2 = ev.target.closest('[data-to]');
  if (tb2) { if ((it.to || '') !== tb2.dataset.to) edit(it, { to: tb2.dataset.to, who: ME }); return; }
  const a = ev.target.closest('[data-act]'); if (!a) return;
  const k = a.dataset.act;
  if (k !== 'del') armDel = null;
  if (k === 'st') edit(it, Object.assign({ status: nextSt[it.status] || 'doing', who: ME }, it.status === 'todo' ? { owner: ME } : {}));
  else if (k === 'pri') edit(it, { pri: { p0: 'p1', p1: 'p2', p2: 'p0' }[it.pri] || 'p1', who: ME });
  else if (k === 'day') edit(it, { day: !it.day, who: ME });
  else if (k === 'wait') edit(it, { wait: !it.wait, who: ME });
  else if (k === 'back') { backing = backing === it.id ? null : it.id; paint(); const inp = secs.querySelector('.why input'); if (inp) inp.focus(); }
  else if (k === 'del') {
    if (armDel === it.id) { armDel = null; clearTimeout(armT); edit(it, { delete: true }); }
    else { armDel = it.id; paint(); clearTimeout(armT); armT = setTimeout(() => { if (armDel === it.id) { armDel = null; paint(); } }, 3200); }
  }
});
secs.addEventListener('submit', ev => {
  ev.preventDefault(); const f = ev.target; if (!f.classList.contains('why')) return;
  const cd = f.closest('.card'), it = cd && items.find(x => x.id === cd.dataset.id); if (!it) return;
  const why = f.why.value.trim(); backing = null;
  edit(it, { status: 'todo', owner: '', who: ME, note: '打回：' + (why || '没说原因') });
});
noteEl.addEventListener('click', ev => { if (ev.target.id === 'retry') load(); });
calls.addEventListener('click', ev => { const b = ev.target.closest('button[data-id]'); if (b) openTicket(b.dataset.id, true); });

/* 新票：一行标题，点进去展开几样可选的 */
const DW = { '': '白天不动', day: '白天能做', wait: '等我点头' };
function paintAdd() {
  const o = k => addF.querySelector(`[data-o="${k}"]`);
  o('pri').innerHTML = '优先 <b>' + draft.pri.toUpperCase() + '</b>'; o('size').innerHTML = '大小 <b>' + draft.size + '</b>';
  o('to').textContent = draft.to ? '指给 ' + draft.to : '没指定'; o('dw').textContent = DW[draft.dw];
}
addT.addEventListener('focus', () => { addF.classList.add('open'); setTimeout(() => ensureVisible(addF), 60); });
addF.addEventListener('click', ev => {
  const b = ev.target.closest('[data-o]'); if (!b) return; const k = b.dataset.o;
  if (k === 'pri') draft.pri = { p1: 'p2', p2: 'p0', p0: 'p1' }[draft.pri];
  else if (k === 'size') draft.size = { M: 'L', L: 'S', S: 'M' }[draft.size];
  else if (k === 'to') { const tos = [''].concat(WHO); draft.to = tos[(tos.indexOf(draft.to) + 1) % tos.length]; }
  else if (k === 'dw') draft.dw = { '': 'day', day: 'wait', wait: '' }[draft.dw];
  paintAdd();
});
addF.addEventListener('submit', ev => {
  ev.preventDefault(); const title = addT.value.trim(); if (!title) { addT.focus(); return; }
  create({ title, body: addF.b.value.trim(), pri: draft.pri, size: draft.size, by: ME, to: draft.to, day: draft.dw === 'day', wait: draft.dw === 'wait' });
});
document.addEventListener('pointerdown', ev => { if (!addF.contains(ev.target) && !addT.value.trim() && !addF.b.value.trim()) addF.classList.remove('open'); });
/* 点开一张以后，点卡片以外的空处（右边的建筑、纸）也合上；正在卡片里写字时不合 */
document.addEventListener('click', ev => {
  if (!openId) return; const t = ev.target;
  if (!t.isConnected) return;   // 这一下点的东西已经被重画换掉了（比如刚点开的编号圈、票单行）
  if (t.closest('.card') || t.closest('.row') || t.closest('#calls button') || t.closest('#add') || t.closest('#back') || t.closest('#hd')) return;
  const a = document.activeElement; if (a && a.closest && a.closest('.card') && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.value.trim()) return;
  openId = null; armDel = null; backing = null; paint();
});
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

/* ---------- 页眉图标：chat.js 的 tixIcon('board') 原样照抄（tixFoil / tixDust / seg 一起） ---------- */
const TIXPT = Q.get('pt') !== '0';
function tixDust(base, seed, id) {
  if (!TIXPT) return '';
  const Rn = rng(seed); let bl = '', wh = '';
  for (let i = 0; i < 18; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.25 + Rn() * Rn() * 3, r = 0.15 + Rn() * 0.2; bl += `<circle cx="${f2(x + nx * d)}" cy="${f2(y + ny * d)}" r="${f2(r)}"/>`; }
  for (let i = 0; i < 6; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.5 + Rn() * 2, r = 0.15 + Rn() * 0.15; wh += `<circle cx="${f2(x - nx * d)}" cy="${f2(y - ny * d)}" r="${f2(r)}"/>`; }
  return `<g class="pt">${bl}</g><g class="ptw" clip-path="url(#${id}f)">${wh}</g>`;
}
const seg = (x0, y0, x1, y1, a, b) => t => { const u = a + (b - a) * t, L = Math.hypot(x1 - x0, y1 - y0); return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, (y1 - y0) / L, -(x1 - x0) / L]; };
function tixFoil(solid, box, edges, rot) {
  const band = (o0, o1) => { const a = -35 * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = 16; return `M${f2(nx * o0 - ux * L)} ${f2(ny * o0 - uy * L)}L${f2(nx * o0 + ux * L)} ${f2(ny * o0 + uy * L)}L${f2(nx * o1 + ux * L)} ${f2(ny * o1 + uy * L)}L${f2(nx * o1 - ux * L)} ${f2(ny * o1 - uy * L)}Z`; };
  const bands = `<g${rot ? ` transform="${rot}"` : ''}><path class="fl" d="${band(-2.6, .6)}"/><path class="fl" d="${band(2.8, 3.5)}"/><path class="fd" d="${band(-5.2, -4.5)}"/><path class="fd" d="${band(.6, 1.1)}"/></g>`;
  return `<g class="fsh" transform="translate(.4 .45)">${solid('sh')}</g><g transform="translate(-.35 -.35)">${solid('hi')}</g>${solid('b')}${box(bands + `<path class="edge" d="${edges}"/>`)}`;
}
function boardIcon(id) {
  const hl = (deg, offs) => { const a = deg * PI / 180, ux = Math.cos(a), uy = Math.sin(a); return offs.map(o => `M${f2(-uy * o - ux * 14)} ${f2(ux * o - uy * 14)}L${f2(-uy * o + ux * 14)} ${f2(ux * o + uy * 14)}`).join(''); };
  const ser = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * 0.9, ny = (x1 - x0) / L * 0.9; return `M${f2(x0 - nx)} ${f2(y0 - ny)}L${f2(x0 + nx)} ${f2(y0 + ny)}M${f2(x1 - nx)} ${f2(y1 - ny)}L${f2(x1 + nx)} ${f2(y1 + ny)}`; };
  const two = (S, fillR, emptyR, divider, serif, det, hatch, moreL, dust, rot) => `<defs><clipPath id="${id}f"><path d="${fillR}"/></clipPath><clipPath id="${id}e"><path d="${emptyR}"/></clipPath><clipPath id="${id}s"><path d="${S}"/></clipPath></defs>
    ${tixFoil(cl => `<path class="${cl}" d="${S}" clip-path="url(#${id}f)"/>`, inner => `<g clip-path="url(#${id}s)"><g clip-path="url(#${id}f)">${inner}</g></g>`, S + divider, rot)}
    <g clip-path="url(#${id}s)"><g clip-path="url(#${id}e)"><path class="h" d="${hatch}"/></g></g>
    ${det ? `<g clip-path="url(#${id}e)"><path class="l" d="${det}"/></g><g clip-path="url(#${id}f)"><path class="w" d="${det}"/></g>` : ''}
    ${dust || ''}<path class="l" d="${S}"/>${moreL || ''}<path class="l" d="${divider}"/><path class="l" d="${serif}"/>`;
  const S = 'M-8.4-6.4H8.4V6.4H-8.4Z', D = 'M-12 5.6L12-5.2';
  const det = 'M-2.8-6.4V6.4M2.8-6.4V6.4M-7-4.4H-4.4V-2.4H-7ZM-1.4-1.6H1.4V.4H-1.4ZM4.4-4.4H7V-2.6H4.4ZM4.4 1.4H7V3.4H4.4Z';
  return `<g transform="rotate(-3)">${two(S, D + 'V-20H-12Z', D + 'V20H-12Z', D, ser(-12, 5.6, 12, -5.2), det, hl(-24, [4.2, 5.8, 7.4]), '', tixDust(t => { const [x, y, nx, ny] = seg(-12, 5.6, 12, -5.2, .15, .85)(t); return [x, y, -nx, -ny]; }, 73, id), 'rotate(3) translate(-2.6 -3.6)')}</g>`;
}

/* ---------- 版面 ---------- */
function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height; g = fitCanvas(deco, W, H); STAT = null;
  G = geometry();
  const lt = 62, lw = G.ccx + 35;
  list.style.top = lt + 'px'; list.style.height = (H - lt - 14) + 'px'; list.style.width = lw + 'px';
  stage.style.setProperty('--rw', Math.max(90, G.ccx - 16 - 20) + 'px');
  stage.style.setProperty('--cw', (lw - 20 + 2) + 'px');
  tb.style.left = G.tbx + 'px'; tb.style.top = (G.yg + 16) + 'px'; tb.style.width = (W - 8 - G.tbx) + 'px'; tb.classList.toggle('narrow', W - 8 - G.tbx < 196);
  $('toast').style.top = (H - 30) + 'px';
  paint();
}

/* ---------- 起 ---------- */
$('hd').querySelector('svg').innerHTML = boardIcon('bdi');
const info = homeInfo('board', 4, dark ? 1 : 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
setupGrain(); paintAdd();
const start = () => {
  if (!LIVE) { const N = window.NYX || {}; ME = 'me'; WHO = ['Clawd', 'Two', 'Three', '谁都行']; items = demoItems(); phase = 'ok'; return Promise.resolve(); }
  return loadConfig().then(() => { resolve(); paintAdd(); return load(); });
};
layout();
const fl = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
Promise.all([fl, start()]).then(() => {
  layout();
  const op2 = Q.get('open'); if (op2) openTicket(op2, true);
  revealIn(info, stage, () => { window.__revealed = true; }); window.__ready = true;
});
window.__board = { state: () => ({ phase, n: items.length, open: openId, map: [...MAP].map(([k, it]) => k + ':' + it.id + ':' + it.status), calls: CALLS.map(c => c.it.id) }), open: id => openTicket(id, true), reload: load, layout };
})();
