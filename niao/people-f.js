/* 联系人页 · F 版「邮票夹」（11/13，主人自己的灵感：「联系人像翻文件夹一样，上下滑动出不同联系人，每一个都是一张邮票，到那个人的时候这个邮票就是在屏幕上正的明显的」「长邮票」）。
   从 people.js 拷来改样子：数据、探测、写回选择、进聊天的转场、演示、提示都照旧；档案页 who.js 的功能并到邮票背面。
   一屏只摆一枚竖长的大邮票（宽约屏宽三分之二、高约宽的 1.85 倍），端端正正：齿孔边、两道细线套框（四角内凹）、拱窗里一片铅笔星图，
     星图中间是这位的画像：有头像嵌圆窗，没有就是一颗按人固定的铅笔小星球，一条直线劈两半（一半排线、一半只留轮廓加几根平行刻线，分界线两头出头带短划）；
     拱窗两肩一颗星芒、一弯小月，左边一列小刻度，右边竖排一行极小的赤纬；底下一行拉丁小型大写（这颗星球的名目 · 这位的名字）和面值式编号 N° 03。
   邮票右边竖排名字（中文小号加粗）、一行极小的状态。
   摆法：只有一沓邮票，从屏幕底下长上来（最前面那枚的脚落在底边上）。当前这位正对着人、往上抽出一截，是整页独一一整张；
     后几位在它背后一层层往上退、各露一截顶，前两位朝人微倾、压住它的下部。不画夹子、褶、扣、绳，也不另画页码（邮票上有 N° 编号，页眉有总数）。
   上下划（或滚轮、上下键）一格格翻过去：只改 transform，松手吸附到一位；快划可以连翻；到头有一点阻尼回弹。
   蓝：划到谁谁带蓝——每枚的画像底稿是铅笔排线，另有一层蓝箔（有头像、睡着的是右肩一弯蓝月），离正中越近这层越亮。
   状态：睡着 = 整枚褪淡、画像只剩虚线轮廓（旧票）；在忙 = 右上角压一段蓝邮戳弧加一颗蓝点；正在聊的那位 = 名字上头一粒蓝点。
   群也是一页：拱窗里两三枚更小的邮票叠着，名字后面极小的人数。
   点正中那枚：绕竖轴翻到背面（背胶纸、水印、齿孔照旧），背面是这位的档案：名字、备注（可改）、模型、此刻、换头像、换我的头像、查岗（只第一只有）。
   右下角外停着一只铅笔燕子（pages.js 的 PERCH / birdD），点它：燕子起飞，蓝满月从起飞的地方涨满，去聊天页。右上角一个小切换钮去 A 版（小星球名单）。
   数据同 Nyx 联系人页（../contacts.html）：localStorage「nyx_contacts」[{name, relay, key, avatar?}]，没有就用 config.js 的第一只；
     醒没醒 GET <relay>/healthz 的 plugin_subs > 0（不带钥匙）；多久以前 GET <relay>/app/status 的 last_msg_age_sec；
     忙不忙 GET <relay>/app/busy 的 state（同聊天页 pollBusy，群不问）；群：列表里 /g 结尾的那条，没有就看第一只的 /g/healthz 有两位以上 members。
   背面（照搬 who.js）：localStorage nyx_avatar{后缀}、nyx_avatar_me、nyx_profile_remark{后缀}、nyx_prefs_ts；
     模型 GET <relay>/app/meter 的 model.name（翻到背面时才问，群不问）；上云 GET/POST 家里那只的 /app/prefs {ts, data}（翻到背面时才对一次）；
     查岗只在 /relay 上有，盖一层 iframe 开查岗页（地址照 who.js）。
   点燕子：照 contacts.html 的 pick() 写回 nyx_relay / nyx_chat_key / nyx_ai（点第一只就清掉这三个、把钥匙写回 nyx_key），然后去 chat.html。
   底纹：纸纹之上一层很淡的「航线」——从这沓邮票底边聚向的那一点往上放出去的七根起航线、几道纬线和定位点；燕子头前接出独一一根蓝的。不画轨道和圆弧。
   ?demo=1 示例数据，一个请求都不发；改备注、换头像只存在内存里（只有切换钮记一个 niao_people_look）。?dark=1 墨黑底。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, smoother, sstep, rng, Q, REDUCED, dot, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome, iris, ssSet, birdD, PERCH, litD } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco'), deck = $('deck'), note = $('note');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('niao_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（niao_side）
document.body.classList.toggle('dark', dark);
document.body.classList.toggle('rm', REDUCED);
const LIVE = Q.get('demo') !== '1';
const f2 = v => (Math.round(v * 100) / 100).toString();
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- 存取：接后台时是 localStorage；演示时是一张内存表（同 who.js） ---------- */
const MEM = new Map();
function ls(k) { if (!LIVE) return MEM.has(k) ? MEM.get(k) : null; try { return localStorage.getItem(k); } catch (e) { return null; } }
function lset(k, v) {
  if (!LIVE) { if (v == null) MEM.delete(k); else MEM.set(k, v); return; }
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { toast('存不下，图太大了'); }
}

/* ---------- 示例（只在 ?demo=1）：四位、一个群，中性的名字 ---------- */
const DEMO = {
  home: '/relay', cur: '/relay-three',
  people: [
    { name: '甲', relay: '/relay', off: false, age: 40 },
    { name: '乙', relay: '/relay-two', off: false, age: 600, busy: 'Bash' },
    { name: '丙', relay: '/relay-three', off: false, age: 95 },
    { name: '丁', relay: '/relay-four', off: true, age: 172800 }],
  group: { name: '一家', relay: '/relay/g', members: ['甲', '乙', '丙'], off: false, age: 18000 }
};

const hstr = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
function sufOf(r) { const S = { '/relay': '', '/relay/g': '_group' }; return r in S ? S[r] : '_' + r.replace(/^\/relay-?/, '').replace(/\W+/g, '_'); }
const okURL = v => typeof v === 'string' && (/^data:image\//.test(v) || /^\/(?!\/)/.test(v));
function avOf(c) {   // 这位的头像：档案页存的 nyx_avatar{后缀} 优先（背面换了正面要跟着变），再是联系人自带的；都没有就不嵌，画星球
  if (!c || !c.relay) return '';
  const v = ls('nyx_avatar' + sufOf(c.relay)); if (okURL(v)) return v;
  if (LIVE && okURL(c.avatar)) return c.avatar;
  return '';
}
const remarkOf = c => (ls('nyx_profile_remark' + sufOf(c.relay)) || '').trim();
const shown = c => remarkOf(c) || c.name || '';

/* ---------- 数据（同 people.js） ---------- */
let HOME = '/relay', CUR = null, PEOPLE = [], GROUP = null, keyless = false, ME = '我';
function loadList() {
  if (!LIVE) {
    HOME = DEMO.home; CUR = DEMO.cur;
    PEOPLE = DEMO.people.map((c, i) => Object.assign({ i }, c));
    GROUP = Object.assign({ group: true, pos: PEOPLE.length }, DEMO.group);
  } else {
    const N = window.NYX || {};
    HOME = N.relay || '/relay'; ME = N.meName || '我';
    let list = []; try { list = JSON.parse(ls('nyx_contacts') || '[]'); } catch (e) {}
    if (!Array.isArray(list)) list = [];
    list = list.filter(c => c && typeof c.relay === 'string' && /^\//.test(c.relay));
    if (!list.length) list = [{ name: N.aiName || '家里', relay: HOME, key: ls('nyx_key') || '' }];   // 同 contacts.html：没有列表就是装的那一只
    PEOPLE = list.filter(c => !/\/g$/.test(c.relay)).map((c, i) => ({ i, name: c.name || c.relay, relay: c.relay.replace(/\/$/, ''), key: c.key || '', avatar: c.avatar, off: null }));
    const g = list.find(c => /\/g$/.test(c.relay));
    GROUP = g ? { group: true, name: g.name || '一家', relay: g.relay, key: g.key || ls('nyx_key') || '', off: null, pos: list.slice(0, list.indexOf(g)).filter(c => !/\/g$/.test(c.relay)).length } : null;
    CUR = ls('nyx_relay') || HOME;
    keyless = !ls('nyx_key');
  }
  assignKinds();
}
function call(base, k, path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + k }, opt.headers || {}); opt.cache = 'no-store';
  return fetch(base + path, opt).then(r => {
    if (r.status === 401 || r.status === 403) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  });
}
function health(c) {
  return fetch(c.relay + '/healthz', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}
function probe(c) {
  const k = c.key || ls('nyx_key');
  health(c).then(h => { c.off = !(h && h.plugin_subs > 0); c.err = ''; if (h && h.members) c.members = h.members; })
    .catch(() => { c.off = true; c.err = 'down'; }).then(paint);
  if (!k) return;
  call(c.relay, k, '/app/status').then(s => { c.age = s && s.last_msg_age_sec; c.auth = false; paint(); }).catch(e => { if (e.auth) { c.auth = true; paint(); } });
  if (!c.group) call(c.relay, k, '/app/busy').then(b => { c.busy = b && b.state === 'busy' ? (b.tool || '在忙') : null; paint(); }).catch(() => {});
}
function probeAll() {
  if (!LIVE) return;
  PEOPLE.forEach(probe);
  if (GROUP) probe(GROUP);
  else {   // 同 contacts.html：列表里没有群，第一只的 /g 有两位以上成员时才有「一家」
    const G = { group: true, name: '一家', relay: HOME + '/g', key: ls('nyx_key') || '', off: null };
    health(G).then(h => { if (h && h.members && h.members.length >= 2 && !GROUP) { G.members = h.members; G.off = !(h.plugin_subs > 0); GROUP = G; paint(); probe(G); } }).catch(() => {});
  }
}

/* ---------- 文字 ---------- */
function short(sec) { if (sec == null || isNaN(sec)) return ''; const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? '刚刚' : m < 60 ? m + 'm' : h < 24 ? h + 'h' : d < 60 ? d + 'd' : '很久'; }
function shortL(sec) { if (sec == null || isNaN(sec)) return ''; const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? '刚刚' : m < 60 ? m + ' 分钟前' : h < 24 ? h + ' 小时前' : d < 60 ? d + ' 天前' : '很久以前'; }
function stateOf(c) {
  if (c.off == null) return { k: 'wait', t: '…' };
  if (c.err) return { k: 'off', t: '没应门' };
  if (c.auth) return { k: c.off ? 'off' : 'on', t: '钥匙不认' };
  const a = short(c.age);
  if (c.off) return { k: 'off', t: '睡着' + (a ? ' · ' + a : '') };
  if (c.busy) return { k: 'busy', t: '在忙 · ' + String(c.busy).slice(0, 12) };
  return { k: 'on', t: '醒着' + (a ? ' · ' + a : '') };
}

/* ---------- 画法绑人：按 relay 的哈希挑，撞了顺延（同 A 版，跟列表顺序无关） ---------- */
const KINDS = ['conc', 'hatch', 'cres', 'ring', 'grat', 'phase', 'tick'];
const LATIN = { conc: 'CRATER', hatch: 'PVLVIS', cres: 'LVNVLA', ring: 'ANVLVS', grat: 'ZONAE', phase: 'RIMAE', tick: 'POLVS' };
const KIND = new Map();
function assignKinds() {
  KIND.clear();
  const all = PEOPLE.slice().sort((a, b) => a.relay < b.relay ? -1 : a.relay > b.relay ? 1 : 0), used = [];
  all.forEach(c => {
    let k = hstr(c.relay + '*') % KINDS.length;
    const avoid = all.length <= KINDS.length ? used : used.slice(-3);
    for (let n = 0; n < KINDS.length && avoid.indexOf(k) >= 0; n++) k = (k + 1) % KINDS.length;
    used.push(k); KIND.set(c.relay, k);
  });
}
const slugOf = r => r === '/relay' ? 'DOMVS' : /\/g$/.test(r) ? 'FAMILIA' : (r.replace(/^\/relay-?/, '').replace(/\W+/g, ' ').trim().toUpperCase().replace(/U/g, 'V') || 'DOMVS').slice(0, 10);

/* ---------- 颜色 ---------- */
const COL = dark
  ? { ink: C.PAPER, pen: '#9c9ca2', grey: '#6e6f76', blue: '#8794f2', face: '#202127', old: '#1d1e23', gum: '#26272d', sh1: 'rgba(0,0,0,.55)', sh2: 'rgba(0,0,0,.38)', fsh: 'rgba(0,0,0,.45)', fhi: 'rgba(255,255,255,.1)', fl: '#95a1f4', fd: '#707bc7', fe: '#616aa9' }
  : { ink: C.INK, pen: C.PEN, grey: C.GREY, blue: C.BLUE, face: '#f8f6f0', old: '#f3f0e8', gum: '#ebe7dc', sh1: 'rgba(43,44,50,.16)', sh2: 'rgba(43,44,50,.075)', fsh: 'rgba(22,23,28,.11)', fhi: '#fffdf7', fl: '#4959c0', fd: '#1b2c97', fe: '#1a2882' };
const DPR = () => Math.min(window.devicePixelRatio || 1, 3);

/* ---------- 铅笔：主页 hand() / hatch() 那套（两三遍略抖的细笔，一截截深浅不一，端头出头） ---------- */
function hand(g, pts, o, R) {
  o = o || {}; const w = o.w || 0.5, al = o.a || 0.4, n = o.n || 2, jit = o.j == null ? 0.6 : o.j, ov = o.ov == null ? 3 : o.ov;
  const m = pts.length, Ls = [0]; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.6)) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * R(), s1 = L + ov * R();
    if (ps) { const span = 0.4 + 0.6 * R(), st = R() * (1 - span); s0 = L * st; s1 = L * (st + span); }
    const off = (R() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = R() * TAU, p2 = R() * TAU, p3 = R() * TAU, fa = TAU / (70 + R() * 90), fb = TAU / (16 + R() * 20), fc = TAU / (36 + R() * 60), pa = ps ? 0.5 + 0.4 * R() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = 10 + R() * 16;
    for (let guard = 0; guard < 8000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * fa + p1) + 0.4 * Math.sin(s * fb + p2));
      cur.push([a[0] + tx * f - ty * d, a[1] + ty * f + tx * d]);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 2) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * fc + p3)) * (0.85 + 0.3 * R());
          g.globalAlpha = Math.min(0.95, al * pa * (0.5 + 0.75 * pr)); g.lineWidth = w * (0.55 + 0.7 * pr); g.beginPath(); g.moveTo(cur[0][0], cur[0][1]); for (let q = 1; q < cur.length; q++) g.lineTo(cur[q][0], cur[q][1]); g.stroke(); }
        if (s >= s1) break; cur = cur.slice(-1); acc = 0; segL = 10 + R() * 16;
      }
      const stp = Math.max(0.01, Math.min(1.6, s1 - s)); s += stp; acc += stp;
    }
  }
  g.globalAlpha = 1;
}
function hatchP(g, poly, deg, gap, o, R) {   // 排线：一组平行的短笔，两头参差、间距不等（主页 hatch()）
  const t = deg * PI / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * (0.3 + R() * 0.5); d < mx; d += gap * (0.72 + R() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.2) continue; const a = xs[i] + l * R() * 0.12, b = xs[i + 1] - l * R() * 0.12; hand(g, [[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o, R); }
  }
}
const arcPts = (cx, cy, a, b, rot, t0, t1) => { const n = Math.max(6, Math.ceil(Math.abs(t1 - t0) * Math.max(a, b) / 2)), cr = Math.cos(rot), sr = Math.sin(rot), out = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = Math.cos(t) * a, y = Math.sin(t) * b; out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return out; };
const polyPath = (g, poly) => { g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
const pen = (o, x) => Object.assign({}, o, x);
// 主页 buildSketch 的几套笔：CL 辅助线、CL2 更淡的辅助线、OLs 细轮廓、HT 排线
const CL = { w: 0.42, a: 0.2, n: 1, j: 0.4, ov: 5 }, CL2 = { w: 0.4, a: 0.15, n: 1, j: 0.4, ov: 4 }, OLs = { w: 0.56, a: 0.5, n: 2, j: 0.3, ov: 1.6 }, HT = { w: 0.46, a: 0.3, n: 1, j: 0.18, ov: 1 };

/* ---------- 一枚邮票的版式（跟着邮票宽走） ---------- */
let W = 0, H = 0, SW = 190, SH = 308, CX = 0, CY = 0;
const PAD = 18;
function geo() {
  const fo = Math.round(SW * 0.047), fi = fo + 2.6, wx0 = Math.round(SW * 0.125), wx1 = SW - wx0, wy0 = wx0 + 1, wy1 = Math.round(SH - SW * 0.25), rad = (wx1 - wx0) / 2;
  return { fo, fi, wx0, wx1, wy0, wy1, rad, acy: wy0 + rad, pr: SW * 0.185, pcx: SW / 2, pcy: Math.round(wy0 + (wy1 - wy0) * 0.47), ty: Math.round(SH - fi - SW * 0.085) };
}
function framePath(g, x, y, w, h, r) {   // 四角内凹的框（同聊天页 tixFrame）
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w, y, r, PI, PI / 2, true); g.lineTo(x + w, y + h - r); g.arc(x + w, y + h, r, -PI / 2, -PI, true);
  g.lineTo(x + r, y + h); g.arc(x, y + h, r, 0, -PI / 2, true); g.lineTo(x, y + r); g.arc(x, y, r, PI / 2, 0, true); g.closePath();
}
function archPath(g, G, ins) { const x0 = G.wx0 + ins, x1 = G.wx1 - ins, y1 = G.wy1 - ins; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, G.acy); g.arc((x0 + x1) / 2, G.acy, (x1 - x0) / 2, PI, 0); g.lineTo(x1, y1); g.closePath(); }
function perfSheet(w, h, fill, dpr, step, pr) {   // 齿孔边的一张纸（离屏）
  const o = document.createElement('canvas'); o.width = Math.ceil((w + 2) * dpr); o.height = Math.ceil((h + 2) * dpr);
  const g = o.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, dpr, dpr);
  g.fillStyle = fill; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out'; g.beginPath();
  const nx = Math.max(2, Math.round(w / step)), ny = Math.max(2, Math.round(h / step));
  for (let i = 0; i <= nx; i++) { const x = i * w / nx; g.moveTo(x + pr, 0); g.arc(x, 0, pr, 0, TAU); g.moveTo(x + pr, h); g.arc(x, h, pr, 0, TAU); }
  for (let i = 1; i < ny; i++) { const y = i * h / ny; g.moveTo(pr, y); g.arc(0, y, pr, 0, TAU); g.moveTo(w + pr, y); g.arc(w, y, pr, 0, TAU); }
  g.fill(); return o;
}
function laySheet(g, sheet, x, y, dpr, soft) {   // 纸放上去：一道贴身的细影、一层很淡的远影
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const X = (x - 1) * dpr, Y = (y - 1) * dpr;
  g.shadowColor = COL.sh2; g.shadowBlur = (soft ? 5 : 11) * dpr; g.shadowOffsetY = (soft ? 2 : 6) * dpr; g.drawImage(sheet, X, Y);
  g.shadowColor = COL.sh1; g.shadowBlur = 1.1 * dpr; g.shadowOffsetY = 0.5 * dpr; g.drawImage(sheet, X, Y);
  g.restore();
}

/* 拱窗里的一片天：远处圆心的几段大轨道弧、一角赤经赤纬网、一条斜贯的星带（越远越乱）、一个小星座、比例尺、指北、几行极小的读数。keep：画像周围让开 */
function sky(g, G, R, f, keep) {
  const x0 = G.wx0, x1 = G.wx1, y0 = G.wy0, y1 = G.wy1, w = x1 - x0, h = y1 - y0, lbs = [];
  const inWin = (x, y) => x > x0 + 1.5 && x < x1 - 1.5 && y < y1 - 1.5 && (y > G.acy || Math.hypot(x - G.pcx, y - G.acy) < G.rad - 1.5);
  const free = (x, y) => inWin(x, y) && Math.hypot(x - G.pcx, y - G.pcy) > keep;
  g.strokeStyle = COL.pen;
  // 远处圆心的大轨道弧：一段一段
  for (let k = 0; k < 3; k++) {
    const cx = k === 0 ? x0 - w * (0.6 + R() * 0.5) : k === 1 ? x1 + w * (0.7 + R() * 0.6) : G.pcx + (R() - 0.5) * w, cy = k === 2 ? y1 + h * (1.1 + R() * 0.5) : y0 + h * (R() * 1.2 - 0.1);
    const tx = x0 + w * (0.15 + R() * 0.7), ty = y0 + h * (0.12 + R() * 0.76), Rr = Math.hypot(tx - cx, ty - cy), a = Math.atan2(ty - cy, tx - cx), sp = (w + h) / Rr * 0.7;
    for (let t = a - sp; t < a + sp;) { const len = 0.02 + R() * 0.07; if (R() > 0.28) hand(g, arcPts(cx, cy, Rr, Rr, 0, t, Math.min(a + sp, t + len)), pen(CL2, { a: 0.2 * f }), R); t += len + 0.006 + R() * 0.03; }
  }
  // 赤经赤纬网：极点在右上很远处，只露左上一角
  const px = x1 + w * 0.3, py = y0 - h * 0.7, r0 = Math.hypot(px - (x0 + w * 0.2), py - (y0 + h * 0.18));
  for (let k = 0; k < 3; k++) { const rr = r0 + k * h * 0.07, a0 = Math.atan2(y0 - py, x0 - 6 - px); hand(g, arcPts(px, py, rr, rr, 0, a0 - 0.05, a0 + 0.42), pen(CL2, { a: 0.13 * f }), R); }
  for (let k = 0; k < 5; k++) { const a = Math.atan2(y0 + h * 0.18 - py, x0 + w * 0.2 - px) - 0.12 + k * 0.07; hand(g, [[px + Math.cos(a) * (r0 - 4), py + Math.sin(a) * (r0 - 4)], [px + Math.cos(a) * (r0 + h * 0.17), py + Math.sin(a) * (r0 + h * 0.17)]], pen(CL2, { a: 0.12 * f }), R); }
  // 星：底下稀的一层 + 一条斜贯的密带；离带越远越稀越乱
  const ba = (-38 + R() * 30) * PI / 180, bx = G.pcx + (R() - 0.5) * w * 0.3, by = G.pcy + (R() - 0.5) * h * 0.2, bw = h * (0.08 + R() * 0.05);
  const stars = [];
  for (let i = 0, N = Math.round(2400 * clamp(w * h / 33500, 1, 2.6)); i < N; i++) {   // 星的密度照最初那版的窗（窗大了星跟着多）
    const x = x0 + R() * w, y = y0 + R() * h, dd = ((x - bx) * Math.sin(ba) - (y - by) * Math.cos(ba)) / bw, p = 0.02 + Math.exp(-dd * dd) * 0.36;
    if (R() > p || !free(x, y)) continue;
    const m = R(); stars.push([x, y, m < 0.04 ? 0.6 : m < 0.22 ? 0.38 : 0.22, m < 0.015]);
  }
  // 小星座：拱顶附近四颗亮一点的星连成折线，旁边编号
  const cs = [], ca = R() * TAU;
  for (let k = 0; k < 4; k++) { const a = ca + k * 1.25 + (R() - 0.5) * 0.5, d = G.rad * (0.28 + R() * 0.22); const x = G.pcx + Math.cos(a) * d * 1.1, y = G.acy - G.rad * 0.18 + Math.sin(a) * d * 0.55; if (free(x, y)) cs.push([x, y]); }
  if (cs.length >= 3) { hand(g, cs, pen(HT, { a: 0.26 * f, n: 1 }), R); cs.forEach(p => stars.push([p[0], p[1], 0.62, false, 1])); const e = cs[cs.length - 1]; lbs.push([['κ-7', 'HD 4127', 'β 2', 'ζ-11', 'NGC 412'][hstr(String(ba)) % 5], e[0] + 1.8, e[1] + 1]); }
  // 比例尺（窗底左边）
  const sx = x0 + 6, sy = y1 - 6.5;
  hand(g, [[sx, sy], [sx + 22, sy]], pen(HT, { a: 0.34 * f, ov: 0.3 }), R); for (let k = 0; k <= 4; k++) hand(g, [[sx + k * 5.5, sy], [sx + k * 5.5, sy - (k % 2 ? 1 : 2)]], pen(HT, { a: 0.32 * f, ov: 0.1 }), R);
  lbs.push(['0', sx - 0.4, sy + 3.2], ['2 AU', sx + 18.5, sy + 3.2]);
  // 指北（窗底右边）
  const nx = x1 - 8, ny = y1 - 11;
  hand(g, [[nx, ny + 4], [nx, ny - 4]], pen(HT, { a: 0.34 * f, ov: 0.3 }), R); hand(g, [[nx - 1.2, ny - 2], [nx, ny - 4], [nx + 1.2, ny - 2]], pen(HT, { a: 0.34 * f, ov: 0.1 }), R);
  lbs.push(['N', nx - 0.9, ny - 5.2]);
  // 一颗拖尾的小彗星（窗的右下），尾迹往左下散开
  {
    const cmx = x0 + w * (0.66 + R() * 0.1), cmy = y0 + h * (0.72 + R() * 0.06);
    g.strokeStyle = COL.ink; hand(g, arcPts(cmx, cmy, 1.3, 1.3, 0, 0, TAU + 0.3), pen(HT, { a: 0.6 * f, ov: 0.2 }), R);
    g.strokeStyle = COL.pen; for (let k = 0; k < 9; k++) { const a = PI * 0.8 + (k - 4) * 0.05 + (R() - 0.5) * 0.02, L = h * (0.07 + R() * 0.06); hand(g, [[cmx - 1, cmy + 0.4], [cmx + Math.cos(a) * L, cmy + Math.sin(a) * L * 0.55]], pen(HT, { a: (0.26 + (k % 3 ? 0 : 0.12)) * f, ov: 0.3 }), R); }
    lbs.push(['C/11', cmx + 2.6, cmy - 1.8]);
  }
  // 画星
  g.fillStyle = COL.pen; g.globalAlpha = 0.72 * f; g.beginPath();
  for (const [x, y, r, cr, br] of stars) { if (br) continue; if (cr) { g.rect(x - 1.4, y - 0.12, 2.8, 0.24); g.rect(x - 0.12, y - 1.4, 0.24, 2.8); } else dot(g, x, y, r); }
  g.fill(); g.globalAlpha = 0.85 * f; g.fillStyle = COL.ink; g.beginPath(); for (const [x, y, r, , br] of stars) if (br) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill();
  g.globalAlpha = 1;
  return lbs;
}
function labels(g, lbs, f) { g.save(); g.fillStyle = COL.pen; g.globalAlpha = 0.66 * f; g.font = '2.8px ui-monospace, Menlo, monospace'; g.textBaseline = 'alphabetic'; for (const [t, x, y] of lbs) g.fillText(t, x, y); g.restore(); }

/* 蓝箔：实心蓝的那半压进纸里（同聊天页 tixFoil：一道落影、一道亮边、斜的亮带暗带、内凹的边），再沿分界线往空的那半散一点蓝颗粒 */
function foil(g, poly, cx, cy, r, ux, uy, R) {
  g.save(); g.translate(0.8, 0.9); polyPath(g, poly); g.fillStyle = COL.fsh; g.fill(); g.restore();
  g.save(); g.translate(-0.55, -0.55); polyPath(g, poly); g.fillStyle = COL.fhi; g.fill(); g.restore();
  polyPath(g, poly); g.fillStyle = COL.blue; g.fill();
  g.save(); polyPath(g, poly); g.clip();
  const k = r / 7.2, a = -35 * PI / 180, bx = Math.cos(a), by = Math.sin(a), nx = -by, ny = bx;
  const band = (o0, o1, col) => { const L = r * 2.4; g.beginPath(); g.moveTo(cx + nx * o0 * k - bx * L, cy + ny * o0 * k - by * L); g.lineTo(cx + nx * o0 * k + bx * L, cy + ny * o0 * k + by * L); g.lineTo(cx + nx * o1 * k + bx * L, cy + ny * o1 * k + by * L); g.lineTo(cx + nx * o1 * k - bx * L, cy + ny * o1 * k - by * L); g.closePath(); g.fillStyle = col; g.fill(); };
  band(-1.7, 0.15, COL.fl); band(2.9, 3.15, COL.fl); band(-5.1, -4.85, COL.fd); band(0.15, 0.4, COL.fd);
  // 实心那半的远边：四根纸色细刻线反白（和空的那半四根墨线对着）
  const nX0 = -uy, nY0 = ux; g.strokeStyle = COL.face; g.globalAlpha = 0.75; g.lineWidth = 0.3; g.lineCap = 'butt'; g.beginPath();
  for (const o of [0.62, 0.72, 0.81, 0.89]) { const px = cx - nX0 * o * r, py = cy - nY0 * o * r; g.moveTo(px - ux * r, py - uy * r); g.lineTo(px + ux * r, py + uy * r); }
  g.stroke(); g.globalAlpha = 1;
  polyPath(g, poly); g.strokeStyle = COL.fe; g.lineWidth = 1.1; g.stroke();
  g.restore();
  // 分界处的颗粒：往空的那半散出去，近密远稀；实心那半里掺几粒纸色飞白
  const nX = -uy, nY = ux;
  g.fillStyle = COL.blue; g.beginPath();
  for (let i = 0; i < 46; i++) { const s = (R() * 2 - 1) * r * 0.9, d = 0.4 + R() * R() * 8, x = cx + ux * s + nX * d, y = cy + uy * s + nY * d; if (Math.hypot(x - cx, y - cy) < r - 0.6) { const q = 0.2 + R() * 0.34; g.moveTo(x + q, y); g.arc(x, y, q, 0, TAU); } }
  g.fill();
  g.fillStyle = COL.face; g.beginPath();
  for (let i = 0; i < 14; i++) { const s = (R() * 2 - 1) * r * 0.85, d = 0.8 + R() * 5, x = cx + ux * s - nX * d, y = cy + uy * s - nY * d; if (Math.hypot(x - cx, y - cy) < r - 1) { const q = 0.2 + R() * 0.22; g.moveTo(x + q, y); g.arc(x, y, q, 0, TAU); } }
  g.fill();
}

/* 两张画布同一笔：方法和属性同时落到 a、b 上（读的时候读 a）。蓝层用它跟着底稿描蓝箔上面压着的那几笔 */
function dual(a, b) {
  return new Proxy(a, {
    get(t, k) { const v = t[k]; return typeof v === 'function' ? (...x) => { b[k](...x); return v.apply(t, x); } : v; },
    set(t, k, v) { t[k] = v; b[k] = v; return true; }
  });
}
/* 画像：一颗铅笔小星球，一条直线劈两半。实心那半：底稿是铅笔排线（中灰，不是一块黑），蓝层（md.fg）上是蓝箔，
   划到谁谁的蓝层亮起来；空的那半只留轮廓加四根平行刻线，再加各自一样特征。分界线两头出头、带短划。睡着：只剩虚线轮廓和分界线 */
function planet(g, cx, cy, r, K, R, md) {
  const fg = !md.line && md.fg;
  if (fg) fg.save();
  const out = planet0(g, cx, cy, r, K, R, md);
  if (fg) fg.restore();
  return out;
}
function planet0(g, cx, cy, r, K, R, md) {
  const f = md.f, line = md.line, ink = COL.ink;
  const thd = md.thd != null ? md.thd : -(30 + R() * 28), th = thd * PI / 180, ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
  const solid = arcPts(cx, cy, r, r, 0, th - PI, th), empty = arcPts(cx, cy, r, r, 0, th, th + PI);
  const ringRot = (-14 + (R() - 0.5) * 10) * PI / 180, RM = [1.5, 1.66], RYF = 0.25;
  g.strokeStyle = ink;
  if (K === 'ring') {   // 环的后半截：先画，球面盖住
    RM.forEach((m, j) => hand(g, arcPts(cx, cy, m * r, m * r * RYF, ringRot, PI, TAU), pen(OLs, { a: (j ? 0.32 : 0.42) * f, n: 1, ov: 0.4 }), R));
    g.save(); g.strokeStyle = COL.pen; g.globalAlpha = 0.5 * f; g.lineWidth = 0.35; g.setLineDash([0.4, 1.4]); g.beginPath(); arcPts(cx, cy, 1.58 * r, 1.58 * r * RYF, ringRot, PI, TAU).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
  }
  const big = r > 20, orb = big && K !== 'ring', oRot = (8 + R() * 14) * PI / 180, oA = r * 1.9, oB = r * 0.5;
  if (orb) { g.save(); g.strokeStyle = COL.pen; g.globalAlpha = (line ? 0.3 : 0.5) * f; g.lineWidth = 0.35; g.setLineDash([0.5, 1.6]); g.beginPath(); arcPts(cx, cy, oA, oB, oRot, PI, TAU).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore(); }
  g.fillStyle = line ? COL.old : COL.face; g.beginPath(); g.arc(cx, cy, r + 0.8, 0, TAU); g.fill();
  if (!line) {
    // 铅笔排线压出那半的灰：两层，交叉，不等距
    g.save(); polyPath(g, solid); g.clip(); g.strokeStyle = COL.pen;
    hatchP(g, solid, thd + 66, 1.35, pen(HT, { a: 0.42, w: 0.44 }), R);
    hatchP(g, solid.filter((p, i) => i < solid.length * 0.7).concat([[cx, cy]]), thd - 26, 1.9, pen(HT, { a: 0.24, w: 0.4 }), R);
    g.restore();
    if (md.fg) {   // 蓝层：同一个位置压一片蓝箔；之后压在实心那半上的笔（分界线、环、轨道）两张一起画，蓝层只留实心那半里的
      const fg = md.fg; fg.setTransform(g.getTransform());
      foil(fg, solid, cx, cy, r, ux, uy, R);
      polyPath(fg, solid); fg.clip();
      g = dual(g, fg);
    }
    // 空的那半：四根等距平行的细刻线（硬直线），贴着远边
    g.save(); polyPath(g, empty); g.clip(); g.strokeStyle = ink; g.globalAlpha = 0.6; g.lineWidth = 0.32; g.lineCap = 'butt'; g.beginPath();
    for (const o of [0.6, 0.7, 0.8, 0.9]) { const px = cx + nx * o * r, py = cy + ny * o * r; g.moveTo(px - ux * r, py - uy * r); g.lineTo(px + ux * r, py + uy * r); }
    g.stroke(); g.restore();
    // 各自的特征：都在空的那半
    const at = (d, s) => [cx + nx * d * r + ux * s * r, cy + ny * d * r + uy * s * r];
    g.strokeStyle = ink;
    const crater = (p, s, deep) => { hand(g, arcPts(p[0], p[1], s, s * 0.78, th, 0, TAU + 0.4), pen(HT, { a: 0.5, w: 0.4, ov: 0.3 }), R); if (deep) hand(g, arcPts(p[0], p[1], s * 0.72, s * 0.52, th, PI * 0.55, PI * 1.4), pen(HT, { a: 0.6, w: 0.5, ov: 0.2 }), R); };
    switch (K) {
      case 'conc': { const p = at(0.36, -0.12); crater(p, r * 0.24, true); hand(g, arcPts(p[0], p[1], r * 0.13, r * 0.1, th, 0, TAU + 0.3), pen(HT, { a: 0.4, ov: 0.2 }), R); g.fillStyle = ink; g.globalAlpha = 0.6; g.beginPath(); g.arc(p[0], p[1], 0.5, 0, TAU); g.fill(); g.globalAlpha = 1; crater(at(0.3, 0.5), r * 0.08, false); break; }
      case 'hatch': {   // 点：近远边越来越密的一片细点
        g.fillStyle = COL.pen; g.globalAlpha = 0.7; g.beginPath();
        for (let i = 0; i < 140; i++) { const d = Math.pow(R(), 0.6) * 0.95, s = (R() * 2 - 1) * Math.sqrt(Math.max(0, 1 - d * d)) * 0.95, p = at(d, s); if (R() < d * 0.9 + 0.1) dot(g, p[0], p[1], 0.18 + R() * 0.24); }
        g.fill(); g.globalAlpha = 1; crater(at(0.34, -0.2), r * 0.11, true); break; }
      case 'cres': crater(at(0.28, -0.28), r * 0.15, true); crater(at(0.5, 0.18), r * 0.1, true); crater(at(0.22, 0.48), r * 0.065, false); break;
      case 'grat': {   // 纬向条带：两道带子（两根弧夹一条），带里几根短竖笔
        g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); polyPath(g, empty); g.clip();
        const ax = (10 + (R() - 0.5) * 12) * PI / 180, lat = (y0, tl) => { const s = Math.sqrt(Math.max(0, r * r - y0 * y0)), pts = []; for (let j = 0; j <= 20; j++) { const t = PI * j / 20; const x = s * Math.cos(t), y = y0 + tl * s * Math.sin(t); pts.push([cx + x * Math.cos(ax) - y * Math.sin(ax), cy + x * Math.sin(ax) + y * Math.cos(ax)]); } return pts; };
        const A = lat(-0.5 * r, 0.2), B = lat(-0.36 * r, 0.2), C2 = lat(0.2 * r, 0.2), D = lat(0.34 * r, 0.2);
        [A, B, C2, D].forEach((L, j) => hand(g, L, pen(HT, { a: j % 2 ? 0.4 : 0.5, ov: 0.6 }), R));
        for (let j = 3; j <= 17; j += 2) hand(g, [C2[j], D[j]], pen(HT, { a: 0.34, ov: 0.1 }), R);
        g.restore(); break; }
      case 'phase': {   // 两道裂纹，一折一叉（硬折角）
        for (let q = 0; q < 2; q++) { let p = at(0.2 + q * 0.18, -0.5 + q * 0.5); const pts = [p.slice()], a0 = th + PI / 2 + (q ? 0.5 : -0.4);
          for (let j = 0; j < 4; j++) { const a = a0 + (R() - 0.5) * 1.3; p = [p[0] + Math.cos(a) * r * 0.13, p[1] + Math.sin(a) * r * 0.13]; pts.push(p.slice()); }
          g.globalAlpha = 0.62; g.lineWidth = 0.38; g.lineJoin = 'miter'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); const m = pts[2]; g.moveTo(m[0], m[1]); g.lineTo(m[0] + (R() - 0.5) * r * 0.2, m[1] + r * 0.14); g.stroke(); g.globalAlpha = 1; }
        break; }
      case 'tick': {   // 极冠：远边上一道断续的纬线围出一块白，边上一排小刻
        const c0 = at(0.62, 0), s = Math.sqrt(1 - 0.62 * 0.62) * r;
        g.save(); g.strokeStyle = ink; g.globalAlpha = 0.5; g.lineWidth = 0.34; g.setLineDash([1.2, 1]); g.beginPath(); arcPts(c0[0], c0[1], s, s * 0.26, th, 0, PI).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
        g.globalAlpha = 0.55; g.lineWidth = 0.3; g.beginPath(); for (let j = 0; j <= 12; j++) { const a = th + 0.12 + j * (PI - 0.24) / 12, l = j % 4 === 0 ? 0.14 * r : 0.07 * r; g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * (r - l), cy + Math.sin(a) * (r - l)); } g.stroke(); g.globalAlpha = 1;
        break; }
    }
  }
  // 轮廓
  if (line) { g.save(); g.strokeStyle = COL.pen; g.globalAlpha = 0.55; g.lineWidth = 0.45; g.setLineDash([1.1, 1.7]); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); g.restore(); }
  else { g.strokeStyle = ink; const a0 = R() * TAU; hand(g, arcPts(cx, cy, r, r * (0.99 + R() * 0.02), 0, a0, a0 + TAU + 0.35), pen(OLs, { a: 0.6 }), R); }
  // 分界线：一根硬直线穿过去，两头出头，收一个小短划
  const L = r + 8.5;
  g.save(); g.strokeStyle = ink; g.globalAlpha = line ? 0.4 : 0.82; g.lineWidth = 0.48; g.lineCap = 'butt'; g.beginPath();
  g.moveTo(cx - ux * L, cy - uy * L); g.lineTo(cx + ux * L, cy + uy * L);
  [-1, 1].forEach(sg => { const ex = cx + ux * L * sg, ey = cy + uy * L * sg; g.moveTo(ex - nx * 1.7, ey - ny * 1.7); g.lineTo(ex + nx * 1.7, ey + ny * 1.7); });
  g.stroke(); g.restore();
  if (K === 'ring') {   // 环的前半截压在球上：底下垫一道纸色让开
    const fr = arcPts(cx, cy, RM[1] * r, RM[1] * r * RYF, ringRot, 0, PI);
    if (!line) { g.save(); g.strokeStyle = md.cur ? COL.face : COL.face; g.globalAlpha = 1; g.lineWidth = 2.2; g.beginPath(); arcPts(cx, cy, 1.58 * r, 1.58 * r * RYF, ringRot, 0.05, PI - 0.05).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore(); }
    g.strokeStyle = ink; RM.forEach((m, j) => hand(g, arcPts(cx, cy, m * r, m * r * RYF, ringRot, 0, PI), pen(OLs, { a: (line ? 0.3 : j ? 0.42 : 0.55) * f, n: line ? 1 : 2, ov: 0.4 }), R));
    void fr;
  }
  if (orb) {   // 一道斜的轨道：后半截点线（被球挡住），前半截铅笔；轨道上一颗劈开的小月
    g.strokeStyle = COL.pen; hand(g, arcPts(cx, cy, oA, oB, oRot, 0.05, PI - 0.05), pen(OLs, { a: (line ? 0.25 : 0.42) * f, n: 1, ov: 0.6, w: 0.45 }), R);
    if (!line) {
      const ma = PI * (0.62 + R() * 0.12), mx = cx + Math.cos(ma) * oA * Math.cos(oRot) - Math.sin(ma) * oB * Math.sin(oRot), my = cy + Math.cos(ma) * oA * Math.sin(oRot) + Math.sin(ma) * oB * Math.cos(oRot), mr = r * 0.11;
      g.fillStyle = COL.face; g.beginPath(); g.arc(mx, my, mr + 1.4, 0, TAU); g.fill();
      const mh = arcPts(mx, my, mr, mr, 0, th - PI, th); g.save(); polyPath(g, mh); g.clip(); g.strokeStyle = COL.pen; hatchP(g, mh, thd + 66, 0.9, pen(HT, { a: 0.5, w: 0.36, ov: 0.2 }), R); g.restore();
      g.strokeStyle = ink; hand(g, arcPts(mx, my, mr, mr, 0, 0, TAU + 0.3), pen(HT, { a: 0.62, ov: 0.2 }), R);
      g.save(); g.globalAlpha = 0.7; g.lineWidth = 0.35; g.beginPath(); g.moveTo(mx - ux * (mr + 2.4), my - uy * (mr + 2.4)); g.lineTo(mx + ux * (mr + 2.4), my + uy * (mr + 2.4)); g.stroke(); g.restore();
      md.lbs = [['m I', mx - mr - 6.5, my + mr + 3.4]];
    }
  }
  if (big && !line) {   // 量角弧：球的左上一段，每 5° 一道刻，逢 15° 长一点，逢 30° 标一个极小的数
    const RP = r * 1.36, a0 = -168, a1 = -102;
    g.save(); g.strokeStyle = ink; g.globalAlpha = 0.42; g.lineWidth = 0.3; g.beginPath(); g.arc(cx, cy, RP, a0 * PI / 180, a1 * PI / 180); g.stroke(); g.beginPath();
    for (let a = a0; a <= a1 + 0.01; a += 3) { const big2 = a % 15 === 0, l = big2 ? 2.4 : 1.1, cA = Math.cos(a * PI / 180), sA = Math.sin(a * PI / 180); g.moveTo(cx + cA * RP, cy + sA * RP); g.lineTo(cx + cA * (RP + l), cy + sA * (RP + l)); }
    g.stroke(); g.fillStyle = COL.pen; g.globalAlpha = 0.6; g.font = 'italic 400 3.2px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let a = -165; a <= a1; a += 30) g.fillText(String(Math.abs(a + 90)), cx + Math.cos(a * PI / 180) * (RP + 4.6), cy + Math.sin(a * PI / 180) * (RP + 4.6));
    g.restore();
  }
  if (line) return [];
  // 作图痕迹：圆心小十字、一小段轨道弧和弧上一颗小卫星、编号
  g.strokeStyle = COL.pen; g.globalAlpha = 0.55; g.lineWidth = 0.3; g.beginPath(); g.moveTo(cx - 2.2, cy); g.lineTo(cx + 2.2, cy); g.moveTo(cx, cy - 2.2); g.lineTo(cx, cy + 2.2); g.stroke(); g.globalAlpha = 1;
  const orR = K === 'ring' ? RM[1] * r + 5 : r * 1.3, oa0 = -PI * (0.08 + R() * 0.1), oa1 = oa0 + PI * (0.3 + R() * 0.1);
  hand(g, arcPts(cx, cy, orR, orR, 0, oa0, oa1), pen(CL, { a: 0.4, ov: 2 }), R);
  const sa = oa0 + (oa1 - oa0) * 0.7, sx = cx + Math.cos(sa) * orR, sy = cy + Math.sin(sa) * orR;
  g.fillStyle = COL.face; g.beginPath(); g.arc(sx, sy, 2.2, 0, TAU); g.fill(); g.strokeStyle = ink; hand(g, arcPts(sx, sy, 1.6, 1.6, 0, 0, TAU + 0.3), pen(HT, { a: 0.6, ov: 0.2 }), R);
  g.fillStyle = COL.pen; g.globalAlpha = 0.7; g.beginPath(); g.arc(sx - 0.5, sy + 0.4, 0.8, PI * 0.2, PI * 1.2); g.fill(); g.globalAlpha = 1;
  return (md.lbs || []).concat([['R ' + (3 + hstr(K) % 7), cx + Math.cos(sa) * (orR + 4) + 1, sy + 1.2], ['θ ' + Math.round(-thd) + '°', cx - ux * L + 2.6, cy - uy * L + 4.2]]);
}

/* 群：拱窗里两三枚更小的邮票叠着，每枚一颗劈开的小星球 */
function groupArt(g, G, R, f, fg, line, n, dpr) {
  const pos = n === 2 ? [[-0.24, -0.08, -8], [0.22, 0.1, 6]] : [[-0.3, -0.2, -9], [0.27, -0.26, 7], [0.0, 0.16, -3]];
  const mw = G.rad * (n === 2 ? 0.72 : 0.64), mh = Math.round(mw * 1.3), mwR = Math.round(mw);
  pos.forEach(([dx, dy, rot], k) => {
    const cx = G.pcx + dx * G.rad * 1.6, cy = G.pcy + G.rad * 0.12 + dy * G.rad * 1.4, Rk = rng(911 + k * 37);
    g.save(); g.translate(cx, cy); g.rotate(rot * PI / 180);
    const sheet = perfSheet(mwR, mh, line ? COL.old : COL.face, dpr, 4.2, 1.05);
    const m = g.getTransform(); g.save(); g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); g.translate(-mwR / 2, -mh / 2);
    g.shadowColor = COL.sh1; g.shadowBlur = 2 * dpr; g.shadowOffsetY = 0.8 * dpr; g.drawImage(sheet, -1, -1, mwR + 2, mh + 2); g.restore();
    g.strokeStyle = COL.grey; g.globalAlpha = 0.8 * f; g.lineWidth = 0.35; framePath(g, -mwR / 2 + 3, -mh / 2 + 3, mwR - 6, mh - 6, 2); g.stroke(); g.globalAlpha = 1;
    const pr = mwR * 0.24;
    planet(g, 0, -mh * 0.07, pr, ['conc', 'grat', 'cres'][k], Rk, { fg: k === n - 1 ? fg : null, line, f });
    g.fillStyle = COL.pen; g.globalAlpha = 0.75 * f; g.font = 'italic 500 5px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'right'; g.fillText('N°0' + (k + 1), mwR / 2 - 5, mh / 2 - 5.5); g.textAlign = 'left'; g.globalAlpha = 1;
    g.restore();
  });
}

/* 有头像：圆窗嵌进去，一道铅笔圈、一道点线圈 */
function avatarArt(g, G, img, R) {
  const r = G.pr * 1.08, cx = G.pcx, cy = G.pcy;
  g.fillStyle = COL.face; g.beginPath(); g.arc(cx, cy, r + 4.5, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(2 * r / iw, 2 * r / ih); g.drawImage(img, cx - iw * s / 2, cy - ih * s / 2, iw * s, ih * s);
  g.restore();
  g.strokeStyle = COL.ink; hand(g, arcPts(cx, cy, r + 0.3, r + 0.3, 0, 0.4, TAU + 0.8), pen(OLs, { a: 0.55 }), R);
  g.save(); g.strokeStyle = COL.pen; g.globalAlpha = 0.5; g.lineWidth = 0.4; g.setLineDash([0.4, 1.6]); g.beginPath(); g.arc(cx, cy, r + 3.4, 0, TAU); g.stroke(); g.restore();
}

/* 一枚邮票的正面，画一次进这张卡自己的画布 */
const IMG = new Map();
function imgOf(url) {
  let im = IMG.get(url);
  if (!im) { im = new Image(); im.onload = () => { CARDS.forEach(cd => { if (avOf(cd.c) === url) cd.sig = ''; }); paint(); }; im.src = url; IMG.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}
/* 整张只给正中附近的几枚画（底稿一张、蓝层一张）；远的收回去，只留窄条 */
function drawFront(cd) {
  window.__draws = (window.__draws || 0) + 1;
  const c = cd.c, st = stateOf(c).k, line = st === 'off' || st === 'wait', av = avOf(c), img = av ? imgOf(av) : null;
  const dpr = DPR(), cv = cd.cv, G = geo(), f = line ? 0.5 : 1, R = rng(hstr(c.relay) ^ 0x5f3a), kind = c.group ? null : KINDS[KIND.get(c.relay) || 0];
  const sz = { left: -PAD + 'px', top: -PAD + 'px', width: (SW + PAD * 2) + 'px', height: (SH + PAD * 2) + 'px' };
  for (const k of [cv, cd.bl]) { k.width = Math.round((SW + PAD * 2) * dpr); k.height = Math.round((SH + PAD * 2) * dpr); Object.assign(k.style, sz); }
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  const fg = cd.bl.getContext('2d'); fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, cd.bl.width, cd.bl.height);
  laySheet(g, perfSheet(SW, SH, line ? COL.old : COL.face, dpr, 7, 2.1), PAD, PAD, dpr);
  g.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
  // 拱窗里的天
  const keep = c.group ? 0 : kind === 'ring' ? G.pr * 1.15 : G.pr + 3;
  g.save(); archPath(g, G, 0); g.clip();
  let lbs = sky(g, G, R, f, keep);
  if (c.group) { const n = Math.max(2, Math.min(3, (c.members || []).length || 3)); groupArt(g, G, R, f, fg, line, n, dpr); }
  else if (img) avatarArt(g, G, img, R);
  else lbs = lbs.concat(planet(g, G.pcx, G.pcy, G.pr, kind, R, { fg, line, f, thd: thdOf(c) }));
  const blueMoon = !!img || line;   // 没有蓝箔的（有头像、睡着）：蓝层上是右肩那弯小月
  cd.full = true; cd.dirty = false;
  labels(g, lbs, f);
  g.restore();
  // 拱窗的双线、窗台
  g.strokeStyle = COL.ink; g.globalAlpha = 0.5 * f; g.lineWidth = 0.5; archPath(g, G, 0); g.stroke();
  g.globalAlpha = 0.3 * f; g.lineWidth = 0.3; archPath(g, G, 2.3); g.stroke();
  g.globalAlpha = 0.5 * f; g.lineWidth = 0.45; g.beginPath(); g.moveTo(G.wx0 - 4, G.wy1 + 2); g.lineTo(G.wx1 + 4, G.wy1 + 2); g.moveTo(G.wx0 - 4, G.wy1 + 0.6); g.lineTo(G.wx0 - 4, G.wy1 + 3.4); g.moveTo(G.wx1 + 4, G.wy1 + 0.6); g.lineTo(G.wx1 + 4, G.wy1 + 3.4); g.stroke();
  // 拱顶一道小竖刻（拱心石）
  g.beginPath(); g.moveTo(G.pcx, G.wy0 - 3.2); g.lineTo(G.pcx, G.wy0 + 0.6); g.stroke();
  // 套框：外一道、内一道更细，四角内凹
  g.strokeStyle = COL.grey; g.globalAlpha = line ? 0.55 : 0.95; g.lineWidth = 0.5; framePath(g, G.fo, G.fo, SW - 2 * G.fo, SH - 2 * G.fo, 4.2); g.stroke();
  g.lineWidth = 0.3; framePath(g, G.fi, G.fi, SW - 2 * G.fi, SH - 2 * G.fi, 2.8); g.stroke();
  // 左边窗外一列小刻度（像尺），逢五长一点
  g.strokeStyle = COL.pen; g.globalAlpha = 0.45 * f; g.lineWidth = 0.3; g.beginPath();
  for (let y = G.wy1 - 2, k = 0; y > G.acy - 4; y -= 3.6, k++) { const l = k % 5 === 0 ? 2.8 : 1.4; g.moveTo(G.wx0 - 2.2, y); g.lineTo(G.wx0 - 2.2 - l, y); }
  g.stroke();
  // 右边窗外竖排一行极小的赤纬
  g.save(); g.translate(G.wx1 + (G.wx0 - G.fi) * 0.5 + 0.4, (G.acy + G.wy1) / 2); g.rotate(PI / 2); g.fillStyle = COL.pen; g.globalAlpha = 0.6 * f; g.font = '3px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
  const sd = hstr(c.relay); g.fillText('DECL +' + (10 + sd % 70) + '°' + String(sd % 60).padStart(2, '0') + '′ · RA ' + String(sd % 24).padStart(2, '0') + 'h', 0, 1); g.restore();
  // 拱窗两肩：左一颗星芒带几粒星屑，右一弯小月（没有蓝箔的那几种，蓝层上这弯月是实心蓝）
  const sh = G.rad * 0.21, lx = G.wx0 + sh * 0.95, rx = G.wx1 - sh * 0.95, yy = G.wy0 + sh * 0.95;
  g.strokeStyle = COL.ink; g.globalAlpha = 0.6 * f; g.lineWidth = 0.32; g.beginPath(); g.moveTo(lx - 3.6, yy); g.lineTo(lx + 3.6, yy); g.moveTo(lx, yy - 4.6); g.lineTo(lx, yy + 4.6); g.moveTo(lx - 1.2, yy - 1.2); g.lineTo(lx + 1.2, yy + 1.2); g.moveTo(lx - 1.2, yy + 1.2); g.lineTo(lx + 1.2, yy - 1.2); g.stroke();
  g.fillStyle = COL.pen; g.globalAlpha = 0.6 * f; g.beginPath(); for (let k = 0; k < 6; k++) { const a = R() * TAU, d = 5 + R() * 4; dot(g, lx + Math.cos(a) * d, yy + Math.sin(a) * d * 0.8, 0.22 + R() * 0.2); } g.fill();
  g.save(); g.translate(rx, yy); g.rotate(-0.5); const moon = new Path2D(litD(3.3, 0.3));
  g.strokeStyle = COL.ink; g.globalAlpha = 0.6 * f; g.lineWidth = 0.4; g.beginPath(); g.arc(0, 0, 3.3, 0, TAU); g.stroke(); g.stroke(moon);
  g.restore(); g.globalAlpha = 1;
  if (blueMoon) {
    fg.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr); fg.translate(rx, yy); fg.rotate(-0.5);
    fg.fillStyle = line ? COL.old : COL.face; fg.beginPath(); fg.arc(0, 0, 3.7, 0, TAU); fg.fill();
    fg.fillStyle = COL.blue; fg.fill(moon); fg.strokeStyle = COL.blue; fg.lineWidth = 0.42; fg.beginPath(); fg.arc(0, 0, 3.3, 0, TAU); fg.stroke();
    fg.setTransform(1, 0, 0, 1, 0, 0);
  }
  // 底下一行：拉丁小型大写（名目 · 名字）、面值式编号
  const no = String(cd.i + 1).padStart(2, '0'), lat = c.group ? 'FAMILIA · ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, (c.members || []).length)] : LATIN[kind] + ' · ' + slugOf(c.relay);
  g.fillStyle = COL.pen; g.globalAlpha = 0.9 * (line ? 0.6 : 1); g.textBaseline = 'alphabetic';
  g.font = '500 6px "Cormorant Garamond", Georgia, serif'; g.letterSpacing = '1.3px'; g.textAlign = 'left'; g.fillText(lat, G.wx0 - 1, G.ty);
  g.letterSpacing = '0px'; g.textAlign = 'right'; g.font = 'italic 500 11px "Cormorant Garamond", Georgia, serif'; g.fillText(no, G.wx1 + 1, G.ty + 0.6);
  const nw = g.measureText(no).width; g.font = 'italic 500 6px "Cormorant Garamond", Georgia, serif'; g.fillText('N°', G.wx1 + 1 - nw - 1.2, G.ty + 0.4);
  g.globalAlpha = 0.35 * f; g.strokeStyle = COL.pen; g.lineWidth = 0.3; g.setLineDash([0.3, 1.5]); g.beginPath(); g.moveTo(G.wx0 - 1, G.ty + 4.5); g.lineTo(G.wx1 + 1, G.ty + 4.5); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 1;
  // 在忙：右上角压一枚蓝邮戳的一角（两道圈、圈间一行极小的字），圈心一颗蓝点
  if (st === 'busy') {
    const ox = SW - G.fo - 3, oy = G.fo + 15, r1 = SW * 0.085, r2 = r1 + 4.2;
    g.save(); g.beginPath(); g.rect(0, 0, SW, SH); g.clip();
    g.strokeStyle = COL.blue; g.globalAlpha = 0.88; g.lineWidth = 0.5;
    g.beginPath(); g.arc(ox, oy, r2, PI * 0.42, PI * 1.32); g.stroke(); g.lineWidth = 0.4; g.beginPath(); g.arc(ox, oy, r1, PI * 0.36, PI * 1.38); g.stroke();
    g.fillStyle = COL.blue; g.font = '500 3.1px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'IN · OPERE', rr = (r1 + r2) / 2; let a0 = PI * 0.62;
    for (const ch of txt) { const a = a0; g.save(); g.translate(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr); g.rotate(a - PI / 2); g.fillText(ch, 0, 0); g.restore(); a0 += (ch === ' ' ? 1.4 : 2.6) / rr; }
    g.globalAlpha = 0.6; g.lineWidth = 0.35; g.beginPath(); for (let k = 0; k < 3; k++) { const y = oy + r2 + 3 + k * 2.2; g.moveTo(ox - r2 - 10, y); for (let x = ox - r2 - 10; x <= ox - 2; x += 1) g.lineTo(x, y + Math.sin(x * 0.7) * 0.45); } g.stroke();
    g.globalAlpha = 1; g.beginPath(); g.arc(ox, oy, 1.6, 0, TAU); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

/* 倒着的那几枚：不用位图，也不用 CSS 3D（上两轮倒着的位图在合成时被重采样，线就糊了）。
   每枚先在自己的纸面坐标里画好一套简化线稿（齿孔纸边、两道套框、拱窗双线、窗台、一列小刻度、劈开的小星球、几十粒星、底行拉丁字和编号），
   用一支「录笔」把 hand() 的抖动、断口、深浅录下来；每帧只把这些点按摆法表描到画布上再描，线永远是细线，转到什么角度都清楚。 */
function recPen() {
  const S = []; let cur = null, sub = [];
  const g = { lineCap: '', lineJoin: '', globalAlpha: 1, lineWidth: 0.5, strokeStyle: '',
    beginPath() { sub = []; cur = null; },
    moveTo(x, y) { cur = [x, y]; sub.push(cur); },
    lineTo(x, y) { if (!cur) this.moveTo(x, y); else cur.push(x, y); },
    stroke() { const pl = sub.filter(p => p.length >= 4); if (pl.length) S.push({ c: this.strokeStyle, a: this.globalAlpha, w: this.lineWidth, pl }); } };
  return { g, S };
}
function bucket(S) {   // 同色、同浓淡、同粗细的并成一笔：投影时一桶只描一次
  const M = new Map();
  for (const s of S) { const a = Math.round(s.a * 16) / 16, w = Math.round(s.w * 10) / 10, k = s.c + '|' + a + '|' + w; let b = M.get(k); if (!b) M.set(k, b = { c: s.c, a, w, pl: [] }); for (const p of s.pl) b.pl.push(Float32Array.from(p)); }
  return [...M.values()].filter(b => b.a > 0.01);
}
const line2 = (g, pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
function framePts(x, y, w, h, r) {   // 四角内凹的框，折成点
  const o = [], arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 5; i++) { const t = a0 + (a1 - a0) * i / 5; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
  arc(x + w, y, PI, PI / 2); arc(x + w, y + h, -PI / 2, -PI); arc(x, y + h, 0, -PI / 2); arc(x, y, PI / 2, 0); o.push(o[0].slice()); return o;
}
function archPts(G, ins) { const x0 = G.wx0 + ins, x1 = G.wx1 - ins, y1 = G.wy1 - ins, cx = (x0 + x1) / 2, r = (x1 - x0) / 2, o = [[x0, y1], [x0, G.acy]]; for (let i = 1; i < 28; i++) { const t = PI + PI * i / 28; o.push([cx + r * Math.cos(t), G.acy + r * Math.sin(t)]); } o.push([x1, G.acy], [x1, y1], [x0, y1]); return o; }
function perfPoly(w, h, step, pr) {   // 齿孔纸边：沿四边一口口咬进去的半圆
  const o = [], nx = Math.max(2, Math.round(w / step)), ny = Math.max(2, Math.round(h / step));
  const edge = (x0, y0, x1, y1, n, ix, iy) => {
    const l = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / l, uy = (y1 - y0) / l; o.push([x0 + ux * pr * 0.7 + ix * pr * 0.7, y0 + uy * pr * 0.7 + iy * pr * 0.7]);
    for (let i = 1; i < n; i++) { const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; for (let k = 0; k <= 4; k++) { const a = PI * k / 4; o.push([cx - ux * pr * Math.cos(a) + ix * pr * Math.sin(a), cy - uy * pr * Math.cos(a) + iy * pr * Math.sin(a)]); } }
  };
  edge(0, 0, w, 0, nx, 0, 1); edge(w, 0, w, h, ny, -1, 0); edge(w, h, 0, h, nx, 0, -1); edge(0, h, 0, 0, ny, 1, 0);
  return Float32Array.from(o.flat());
}
function chord(cx, cy, r, ang, d, n, sgn) {   // 圆里一根弦（方向 ang、离圆心 d），只留 sgn·(p-c)·n ≥ 0 那半
  const dx = Math.cos(ang), dy = Math.sin(ang), mx = -dy, my = dx, h2 = r * r - d * d; if (h2 <= 0) return null;
  const h = Math.sqrt(h2), bx = cx + mx * d, by = cy + my * d; let t0 = -h, t1 = h;
  const f0 = sgn * ((bx - cx) * n[0] + (by - cy) * n[1]), f1 = sgn * (dx * n[0] + dy * n[1]);
  if (Math.abs(f1) < 1e-6) { if (f0 < 0) return null; } else { const tz = -f0 / f1; if (f1 > 0) t0 = Math.max(t0, tz); else t1 = Math.min(t1, tz); }
  return t1 - t0 < 1.2 ? null : [[bx + dx * t0, by + dy * t0], [bx + dx * t1, by + dy * t1]];
}
const thdOf = c => -(30 + (hstr(c.relay + '/th') % 1000) / 1000 * 28);   // 画像分界线的角度：整张和线稿用同一个
function buildArt(cd) {
  const c = cd.c, st = stateOf(c).k, line = st === 'off' || st === 'wait', G = geo(), R = rng(hstr(c.relay) ^ 0x2b71), f = line ? 0.55 : 1;
  const kind = c.group ? null : KINDS[KIND.get(c.relay) || 0], av = avOf(c);
  const { g, S } = recPen(), dots = [], texts = [];
  cd.adirty = false;
  // 套框两道（尺规硬线）
  g.strokeStyle = COL.grey; g.globalAlpha = line ? 0.55 : 0.95; g.lineWidth = 0.5; line2(g, framePts(G.fo, G.fo, SW - 2 * G.fo, SH - 2 * G.fo, 4.2));
  g.lineWidth = 0.3; line2(g, framePts(G.fi, G.fi, SW - 2 * G.fi, SH - 2 * G.fi, 2.8));
  // 拱窗双线、窗台、拱心一道竖刻
  g.strokeStyle = COL.ink; g.globalAlpha = 0.55 * f; g.lineWidth = 0.5; line2(g, archPts(G, 0));
  g.globalAlpha = 0.3 * f; g.lineWidth = 0.3; line2(g, archPts(G, 2.3));
  g.globalAlpha = 0.5 * f; g.lineWidth = 0.45; line2(g, [[G.wx0 - 4, G.wy1 + 2], [G.wx1 + 4, G.wy1 + 2]]); line2(g, [[G.pcx, G.wy0 - 3.2], [G.pcx, G.wy0 + 0.6]]);
  // 左边窗外一列小刻度
  g.strokeStyle = COL.pen; g.globalAlpha = 0.45 * f; g.lineWidth = 0.3;
  for (let y = G.wy1 - 2, k = 0; y > G.acy - 4; y -= 3.6, k++) line2(g, [[G.wx0 - 2.2, y], [G.wx0 - 2.2 - (k % 5 === 0 ? 2.8 : 1.4), y]]);
  // 拱窗里的星：一条斜带密、别处稀；左肩一颗星芒，右肩一弯小月的圈
  const ba = (-30 + R() * 24) * PI / 180, keep = G.pr + 5;
  for (let i = 0; i < 520; i++) {
    const x = G.wx0 + R() * (G.wx1 - G.wx0), y = G.wy0 + R() * (G.wy1 - G.wy0), dd = ((x - G.pcx) * Math.sin(ba) - (y - G.pcy) * Math.cos(ba)) / (SH * 0.08);
    if (R() > 0.03 + Math.exp(-dd * dd) * 0.22) continue;
    if (!(x > G.wx0 + 2 && x < G.wx1 - 2 && y < G.wy1 - 2 && (y > G.acy || Math.hypot(x - G.pcx, y - G.acy) < G.rad - 2)) || Math.hypot(x - G.pcx, y - G.pcy) < keep) continue;
    dots.push(x, y, R() < 0.12 ? 0.42 : 0.26);
  }
  const sh = G.rad * 0.21, lx = G.wx0 + sh * 0.95, rx = G.wx1 - sh * 0.95, yy = G.wy0 + sh * 0.95;
  g.strokeStyle = COL.ink; g.globalAlpha = 0.6 * f; g.lineWidth = 0.32; line2(g, [[lx - 3.6, yy], [lx + 3.6, yy]]); line2(g, [[lx, yy - 4.6], [lx, yy + 4.6]]);
  hand(g, arcPts(rx, yy, 3.3, 3.3, 0, 0, TAU + 0.3), pen(HT, { a: 0.5 * f, ov: 0.2 }), R);
  // 画像
  const cx = G.pcx, cy = G.pcy;
  if (c.group) {   // 群：两三枚小邮票的框和各自的小圆
    const n = Math.max(2, Math.min(3, (c.members || []).length || 3)), ps = n === 2 ? [[-0.24, -0.08], [0.22, 0.1]] : [[-0.3, -0.2], [0.27, -0.26], [0.0, 0.16]], mw = G.rad * (n === 2 ? 0.72 : 0.64), mh = mw * 1.3;
    ps.forEach(([dx, dy]) => { const x = cx + dx * G.rad * 1.6, y = cy + G.rad * 0.12 + dy * G.rad * 1.4; g.strokeStyle = COL.grey; g.globalAlpha = 0.8 * f; g.lineWidth = 0.35; line2(g, framePts(x - mw / 2 + 3, y - mh / 2 + 3, mw - 6, mh - 6, 2)); g.strokeStyle = COL.ink; hand(g, arcPts(x, y - mh * 0.07, mw * 0.24, mw * 0.24, 0, 0, TAU + 0.3), pen(OLs, { a: 0.5 * f }), R); });
  } else if (av) {   // 有头像：两道圈
    const r = G.pr * 1.08; g.strokeStyle = COL.ink; hand(g, arcPts(cx, cy, r, r, 0, 0.4, TAU + 0.8), pen(OLs, { a: 0.55 }), R);
    g.strokeStyle = COL.pen; g.globalAlpha = 0.4; g.lineWidth = 0.4; line2(g, arcPts(cx, cy, r + 3.4, r + 3.4, 0, 0, TAU));
  } else {   // 小星球：一条直线劈两半，实心那半几道排线，空的那半四根平行刻线；带环的加两道环
    const r = G.pr, thd = thdOf(c), th = thd * PI / 180, ux = Math.cos(th), uy = Math.sin(th), nn = [-uy, ux];
    if (kind === 'ring') { g.strokeStyle = COL.ink; [1.5, 1.66].forEach((m, j) => hand(g, arcPts(cx, cy, m * r, m * r * 0.25, -0.24, 0, TAU), pen(OLs, { a: (j ? 0.3 : 0.4) * f, n: 1, ov: 0.4 }), R)); }
    if (!line) {
      g.strokeStyle = COL.pen;
      for (let d = -r + 1.6 + R(); d < r; d += 1.9 + R() * 1.1) { const ch = chord(cx, cy, r - 0.6, th + 66 * PI / 180, d, nn, -1); if (ch) hand(g, ch, pen(HT, { a: 0.4, w: 0.42 }), R); }
      g.strokeStyle = COL.ink; g.globalAlpha = 0.6; g.lineWidth = 0.32;
      for (const o of [0.6, 0.7, 0.8, 0.9]) { const ch = chord(cx, cy, r, th, o * r, nn, 1); if (ch) line2(g, ch); }
    }
    g.strokeStyle = COL.ink;
    if (line) { g.globalAlpha = 0.45; g.lineWidth = 0.4; const a = arcPts(cx, cy, r, r, 0, 0, TAU); for (let i = 0; i + 2 < a.length; i += 3) line2(g, [a[i], a[i + 1]]); }
    else { const a0 = R() * TAU; hand(g, arcPts(cx, cy, r, r, 0, a0, a0 + TAU + 0.35), pen(OLs, { a: 0.6 }), R); }
    const L = r + 8.5; g.globalAlpha = line ? 0.4 : 0.82; g.lineWidth = 0.48; line2(g, [[cx - ux * L, cy - uy * L], [cx + ux * L, cy + uy * L]]);
    [-1, 1].forEach(sg => { const ex = cx + ux * L * sg, ey = cy + uy * L * sg; line2(g, [[ex - nn[0] * 1.7, ey - nn[1] * 1.7], [ex + nn[0] * 1.7, ey + nn[1] * 1.7]]); });
    g.globalAlpha = 0.5; g.lineWidth = 0.3; line2(g, [[cx - 2.2, cy], [cx + 2.2, cy]]); line2(g, [[cx, cy - 2.2], [cx, cy + 2.2]]);
  }
  // 底行：拉丁小型大写、编号
  const no = String(cd.i + 1).padStart(2, '0'), lat = c.group ? 'FAMILIA' : LATIN[kind] + ' · ' + slugOf(c.relay);
  texts.push({ t: lat, x: G.wx0 - 1, y: G.ty, font: '500 6px "Cormorant Garamond", Georgia, serif', ls: '1.3px', al: 'left', a: 0.85 * (line ? 0.6 : 1) });
  texts.push({ t: no, x: G.wx1 + 1, y: G.ty + 0.6, font: 'italic 500 11px "Cormorant Garamond", Georgia, serif', al: 'right', a: 0.9 * (line ? 0.6 : 1) });
  cd.art = { paper: perfPoly(SW, SH, 7, 2.1), fill: line ? COL.old : COL.face, S: bucket(S), dots: Float32Array.from(dots), texts };
}

/* 背面：夜里的港，正面那层航线就是从这里出去的。一块蓝是拱窗里的夜空和水，上实下虚，下沿散成一道道水纹；窗里是负片（纸色细线）：灯塔、防波堤、远岸、一弯月亮、
   水里断断续续的倒影。窗外同一片港接着用铅笔正片画出去：堤的延长线、泊着的船、码头、测深的小数字，越往外越松。两遍用同一串随机数，线在窗边接上。
   字段长在画里：此刻是灯塔的灯（醒着亮、在忙扫、睡着灭），船名就是名字，备注和模型是码头下一页航海日志上的两行，换头像这些是日志下面的图例。 */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
function lampOf(c) { if (c.err || c.off) return 'off'; if (c.off == null || (LIVE && !keyOf(c))) return 'off'; return c.busy ? 'sweep' : 'on'; }
function backGeo(c) {
  const u = SW, v = SH, G = geo(), mL = G.fo + Math.round(u * 0.07), mR = u - mL, iw = mR - mL, hv = hstr(c.relay + '#port');
  const ax0 = mL + iw * 0.34, ax1 = u - G.fo - 5, ar = (ax1 - ax0) / 2, yTop = v * 0.088, yA = yTop + ar, yH = v * 0.335, ySb = v * 0.43;
  const lx = ax0 + iw * 0.1 + (hv % 7), th = v * 0.13, lampY = yH - 2.5 - th - 4.2;
  const hx0 = mL + iw * 0.15, hx1 = mR - iw * 0.09, ys = v * 0.49, yWl = v * 0.53, yQ = v * 0.592, yLg = yQ + 19;
  return { u, v, fo: G.fo, mL, mR, iw, hv, ax0, ax1, ar, acx: (ax0 + ax1) / 2, yTop, yA, yH, ySb, lx, th, lampY, hx0, hx1, ys, yWl, yQ, yLg,
    masts: c.group ? 3 : 1 + (hv >> 3) % 2, tilt: (-58 + (hv >> 5) % 40) * PI / 180, yAc: yLg + 37, ySy: Math.max(yLg + 58, v * 0.86) };
}
function hullPts(B) { const { hx0, hx1, ys, yWl } = B, L = hx1 - hx0; return [[hx0 - 1, ys + 1.2], [hx0 + L * 0.5, ys + 0.6], [hx1 + 4, ys - 3], [hx1 - 1, ys + (yWl - ys) * 0.55], [hx1 - L * 0.08, yWl], [hx0 + 5, yWl], [hx0 + 1.5, ys + (yWl - ys) * 0.6]]; }
function archPoly(B, rag, R) {   // 拱窗：上沿半圆，两边竖直，下沿一道参差的水线
  const { ax0, ax1, ar, acx, yA, ySb } = B, out = [[ax0, ySb]].concat(arcPts(acx, yA, ar, ar, 0, PI, TAU), [[ax1, ySb]]);
  if (rag) for (let x = ax1 - 2; x > ax0 + 2; x -= 2 + R() * 3) out.push([x, ySb + (R() - 0.3) * 2.2]);
  return out;
}
function layoutBack(B) {   // 字段的 DOM 摆到画上对应的位置（和画布同一套数）
  const S = (sel, o) => Object.assign(bq(sel).style, o), px = n => Math.round(n) + 'px';
  S('.bh', { left: px(B.mL), right: px(B.u - B.mR), top: px(B.fo + 7) });
  S('.nm', { left: px(B.mL), width: px(B.iw * 0.5), top: px(B.v * 0.105), height: '14px', justifyContent: 'flex-start', textAlign: 'left' });   // 名字和此刻站在左上的留白里
  S('.sa', { left: px(B.mL), width: px(B.iw * 0.5), top: px(B.v * 0.105 + 19), textAlign: 'left' });
  S('.rk', { left: px(B.mL), width: px(B.iw), top: px(B.yLg), height: '' });
  S('.md', { left: px(B.mL), width: px(B.iw), top: px(B.yLg + 15) });
  S('.acts', { left: px(B.mL), width: px(B.iw), top: px(B.yAc) });
  S('.sync', { left: px(B.mL), width: px(B.iw), top: px(B.ySy) });
}
function drawHarbour(g, B, H, R) {   // 两遍都走这一份：窗外墨线、窗里纸线
  const { u, v, fo, mL, ax0, ax1, yH, ySb, lx, th, hx0, hx1, ys, yWl, yQ } = B, L = hx1 - hx0;
  // 辅助线：海平线、灯塔轴、主桅轴，出头不擦
  H([[fo + 3, yH + 0.3], [u - fo - 3, yH - 0.4]], CL2); H([[lx, B.yTop - 6], [lx + 0.4, yQ + 4]], CL2);
  // 远岸：海平线上一道低低的山脊
  const sh = []; for (let x = lx + 9; x <= ax1 + 6; x += 3) sh.push([x, yH - 0.8 - 2.4 * Math.abs(Math.sin(x * 0.07 + 1.3)) * Math.min(1, (x - lx - 9) / 20)]);
  H(sh, pen(OLs, { a: 0.3, n: 1 }));
  // 防波堤：从窗外左边一路伸到灯塔脚下，堤头收圆；石缝、脚下几块乱石
  const b0 = fo + 5, bt = yH - 2.5;
  H([[b0, bt + 0.6], [lx + 6, bt]], OLs); H([[b0 + 3, yH + 1.2], [lx + 7.5, yH + 1]], pen(OLs, { a: 0.4 })); H(arcPts(lx + 6, bt + 1.7, 1.8, 1.8, 0, -PI / 2, PI / 2), pen(OLs, { a: 0.4 }));
  for (let x = b0 + 4 + R() * 3; x < lx + 4; x += 3 + R() * 4) H([[x, bt + 0.5], [x + 0.3, yH + 1]], pen(HT, { a: 0.28, ov: 0 }));
  for (let x = b0 + 8; x < lx + 8; x += 5 + R() * 9) H(arcPts(x, yH + 1.6, 1.4 + R(), 0.9, 0, PI, TAU), pen(HT, { a: 0.3, ov: 0 }));
  // 灯塔：收分的塔身、三道箍、回廊栏杆、灯室的窗棂、圆顶和顶针
  const tb = bt, tt = tb - th, w0 = u * 0.021, w1 = u * 0.014, wAt = y => w1 + (w0 - w1) * (y - tt) / (tb - tt);
  H([[lx - w0, tb], [lx - w1, tt]], OLs); H([[lx + w0, tb], [lx + w1, tt]], OLs);
  [0.3, 0.55, 0.78].forEach(f => { const y = tt + th * f; H([[lx - wAt(y), y], [lx + wAt(y), y]], pen(OLs, { a: 0.35, n: 1 })); });
  H([[lx - w1 - 2.4, tt], [lx + w1 + 2.4, tt]], OLs); H([[lx - w1 - 2.4, tt - 2.2], [lx + w1 + 2.4, tt - 2.2]], pen(OLs, { a: 0.4, n: 1 }));
  for (let k = 0; k <= 4; k++) { const x = lx - w1 - 2.4 + k * (w1 + 2.4) / 2; H([[x, tt], [x, tt - 2.2]], pen(HT, { a: 0.35, ov: 0 })); }
  const gy0 = tt - 2.2, gy1 = gy0 - 6, gw = w1 * 0.8;
  H([[lx - gw, gy0], [lx - gw, gy1]], OLs); H([[lx + gw, gy0], [lx + gw, gy1]], OLs); H([[lx, gy0], [lx, gy1]], pen(HT, { a: 0.3, ov: 0 }));
  H(arcPts(lx, gy1, gw + 0.6, 2.8, 0, PI, TAU), OLs); H([[lx - gw - 1, gy1], [lx + gw + 1, gy1]], pen(OLs, { a: 0.45, n: 1 })); H([[lx, gy1 - 2.8], [lx, gy1 - 6]], pen(OLs, { a: 0.45, n: 1, ov: 0.4 }));
  // 灯旁一根引线伸出窗外，接到那几个小字（此刻）
  H([[lx - gw - 3, B.lampY], [ax0 - 4, B.lampY + 0.6]], pen(CL, { a: 0.3 }));
  // 水：一行行断断续续的横笔，窗里纸色、窗外铅笔；越往外越稀；船身那块不画
  for (let y = yH + 2.6; y < yQ - 2; y += 2 + R() * 1.6) {
    const t = (y - yH) / (yQ - yH);
    for (let x = fo + 6 + R() * 8; x < u - fo - 6; x += 3 + R() * 9) {
      const len = 1 + R() * R() * (9 - 4 * t), inB = x > ax0 && x < ax1 && y < ySb, p = inB ? 0.2 : 0.13 * (1 - t * 0.6);
      if (R() > p) continue; if (y > ys - 1 && y < yWl + 1 && x > hx0 - 3 && x < hx1 + 5) continue;
      H([[x, y], [x + len, y + (R() - 0.5) * 0.3]], pen(HT, { a: inB ? 0.32 : 0.22, w: 0.36, ov: 0.3 }));
    }
  }
  // 泊着的船：船身（船名就写在上面）、一道护舷、水线下几笔倒影；桅、支索、收起的帆
  const hp = hullPts(B); H(hp.slice(0, 3), OLs); H(hp.slice(2, 5), OLs); H(hp.slice(4).concat([hp[0]]), pen(OLs, { a: 0.42 }));
  H([[hx0 + 1, ys + 3.4], [hx0 + L * 0.5, ys + 2.9], [hx1 + 1.5, ys - 0.4]], pen(OLs, { a: 0.3, n: 1 }));
  H([[hx0 + 3, yWl - 2.2], [hx0 + L * 0.5, yWl - 2.4], [hx1 - L * 0.06, yWl - 2.6]], pen(HT, { a: 0.22, ov: 0.4 }));   // 一道船板缝
  H([[hx1 + 4, ys - 3], [hx1 + 13, ys - 5.5]], pen(OLs, { a: 0.4, n: 1 })); H([[hx1 + 13, ys - 5.5], [hx1 - 1, ys + (yWl - ys) * 0.55]], pen(HT, { a: 0.22 }));   // 船首斜桅和它的拉索
  H([[hx0 + 1.5, ys + (yWl - ys) * 0.6], [hx0 - 1.2, yWl + 1.5], [hx0 + 4, yWl + 1.5]], pen(OLs, { a: 0.35, n: 1 }));   // 舵
  const c0 = hx0 + L * 0.3, c1 = hx0 + L * 0.47; H([[c0, ys + 0.9], [c0 + 1, ys - 3.2], [c1 - 1, ys - 3.4], [c1, ys + 0.8]], pen(OLs, { a: 0.4, n: 1 }));   // 小舱房
  for (const f of [0.35, 0.42]) H(arcPts(hx0 + L * f, ys - 1.5, 0.7, 0.7, 0, 0, TAU), pen(HT, { a: 0.4, ov: 0 }));
  for (let k = 0; k < 6; k++) { const y = yWl + 2.4 + k * 2.1, x0 = hx0 + 6 + R() * 10 + k * 3, x1 = hx1 - 8 - R() * 14 - k * 4; if (x1 - x0 > 6) H([[x0, y], [x0 + (x1 - x0) * (0.3 + R() * 0.3), y]], pen(HT, { a: 0.24 - k * 0.025, ov: 0.3 })), H([[x0 + (x1 - x0) * (0.7 + R() * 0.1), y], [x1, y]], pen(HT, { a: 0.2 - k * 0.02, ov: 0.3 })); }
  const ms = [[0.56, v * 0.15], [0.22, v * 0.29], [0.82, v * 0.33]].slice(0, B.masts);
  ms.forEach(([f, top], i) => {
    const x = hx0 + L * f, dk = ys + 0.6 - (f > 0.5 ? (f - 0.5) * 4 : 0);
    H([[x, dk], [x + 0.6, top]], pen(OLs, { a: 0.55 })); H([[x - 1.6, top + 6], [x + 1.8, top + 6]], pen(OLs, { a: 0.35, n: 1 }));
    H([[x + 0.6, top + 6], [x - L * 0.05, dk]], pen(HT, { a: 0.24, ov: 0.4 })); H([[x + 0.6, top + 6], [x + L * 0.04, dk]], pen(HT, { a: 0.2, ov: 0.4 }));
    const by = dk - (dk - top) * 0.16, bx = x - L * (i ? 0.12 : 0.26);   // 帆桁，帆卷在上面：两道线和几道绑绳
    H([[x, by], [bx, by + 1]], pen(OLs, { a: 0.45 })); H([[x - 1.2, by - 1.6], [bx + 2, by - 0.8]], pen(OLs, { a: 0.3, n: 1 }));
    for (let s = x - 4; s > bx + 3; s -= 3.4 + R() * 2) H([[s, by - 2], [s - 0.4, by + 0.6]], pen(HT, { a: 0.3, ov: 0 }));
    if (!i) { H([[x + 0.6, top], [hx1 + 13, ys - 5.5]], pen(HT, { a: 0.26 })); H([[x + 0.6, top], [hx0 - 1, ys + 1.2]], pen(HT, { a: 0.2 }));
      H([[x + 0.6, top], [x + 0.6, top - 3], [x - 4.5, top - 1.6], [x + 0.6, top - 0.6]], pen(HT, { a: 0.4, ov: 0 })); }   // 顶上一面小三角旗
  });
  // 两根缆，从船头船尾垂到码头的缆桩
  const qa = [hx0 - 6, yQ - 1.6], qb = [hx1 + 7, yQ - 1.6];
  H([[hx0, ys + 2.2], [(hx0 + qa[0]) / 2 - 1, (ys + qa[1]) / 2 + 4], qa], pen(HT, { a: 0.36 })); H([[hx1 + 3, ys - 2], [(hx1 + qb[0]) / 2 + 2, (ys + qb[1]) / 2 + 3], qb], pen(HT, { a: 0.36 }));
  // 码头：一道岸沿、一皮石头、两只缆桩
  H([[fo + 4, yQ], [u - fo - 4, yQ - 0.5]], OLs); H([[fo + 6, yQ + 3.2], [u - fo - 6, yQ + 2.8]], pen(OLs, { a: 0.3, n: 1 }));
  for (let x = fo + 9 + R() * 4; x < u - fo - 8; x += 7 + R() * 7) H([[x, yQ + 0.4], [x, yQ + 2.8]], pen(HT, { a: 0.22, ov: 0 }));
  [qa, qb].forEach(([x, y]) => { H([[x - 1.6, yQ], [x - 1.3, y - 1.6], [x + 1.3, y - 1.6], [x + 1.6, yQ]], pen(OLs, { a: 0.5, n: 1 })); H([[x - 2.3, y - 1.8], [x + 2.3, y - 1.8]], pen(OLs, { a: 0.45, n: 1, ov: 0.3 })); });
}
function drawMoon(g, x, y, r, tilt, a) {   // 这套皮的月亮：一条线劈两半，一半实心、一半只留轮廓加几根刻线，分界线两头出头
  const ux = Math.cos(tilt), uy = Math.sin(tilt), nx = -uy, ny = ux;
  g.save(); g.fillStyle = C.PAPER; g.strokeStyle = C.PAPER; g.globalAlpha = 0.92 * a;
  g.beginPath(); g.arc(x, y, r, tilt, tilt + PI); g.closePath(); g.fill();
  g.globalAlpha = 0.85 * a; g.lineWidth = 0.42; g.beginPath(); g.arc(x, y, r, tilt + PI, tilt + TAU); g.stroke();
  g.lineWidth = 0.32; g.globalAlpha = 0.7 * a; g.beginPath();
  for (const o of [0.38, 0.6, 0.8]) { const h = Math.sqrt(1 - o * o) * r * 0.9; g.moveTo(x - nx * o * r - ux * h, y - ny * o * r - uy * h); g.lineTo(x - nx * o * r + ux * h, y - ny * o * r + uy * h); }
  g.stroke(); g.lineWidth = 0.5; g.globalAlpha = 0.9 * a; g.beginPath(); g.moveTo(x - ux * (r + 3.6), y - uy * (r + 3.6)); g.lineTo(x + ux * (r + 3.6), y + uy * (r + 3.6)); g.stroke();
  g.restore();
}
/* 背面的画（11/15 重画）：左边留白，灰的水纹一道实一道虚往右聚；右边是蓝的灯塔和船。
   蓝和纸色跟着东西自己的形走（塔身的箍、船舷的一道白）；横向的碎条全从主体的边上拉出去；铅笔起稿线画密、出头不擦。 */
function drawQuay(g, B, lamp, seed, dm) {
  const { u, v, fo, mL, mR, yH, yQ } = B, R = rng(seed), Rw = rng(seed + 5), Rp = rng(seed + 9);
  const BLUE = C.BLUE, ba = (dark ? 0.82 : 1) * (lamp === 'off' ? 0.7 : 1), inkA = (dark ? 0.95 : 0.85) * (dm < 1 ? 0.8 : 1);
  const H = (pts, o) => hand(g, pts, pen(o, { a: o.a * inkA }), R);
  const x0 = fo + 4, x1 = u - fo - 4, lx = u * 0.81, tb = yH - 1.5, th = v * 0.255, tt = tb - th, w0 = u * 0.043, w1 = u * 0.024;
  const hx0 = u * 0.37, hx1 = u * 0.7, ys = v * 0.462, yWl = v * 0.508, L = hx1 - hx0;
  const hull = [[hx0 - 1, ys + 1.4], [hx0 + L * 0.5, ys + 2], [hx1 + 5, ys - 4], [hx1 - 1.5, ys + (yWl - ys) * 0.6], [hx1 - L * 0.1, yWl], [hx0 + 6, yWl], [hx0 + 1.5, ys + (yWl - ys) * 0.62]];
  const gw = w1 * 0.72, gy0 = tt - 2.6, gy1 = gy0 - 8, lampY = (gy0 + gy1) / 2;
  const towerPts = [[lx - w0, tb], [lx - w1, tt], [lx - w1 - 3, tt], [lx - w1 - 3, gy0], [lx - gw, gy0], [lx - gw, gy1], [lx - gw - 1.2, gy1]].concat(arcPts(lx, gy1, gw + 1.2, 4.2, 0, PI, TAU), [[lx + gw, gy1], [lx + gw, gy0], [lx + w1 + 3, gy0], [lx + w1 + 3, tt], [lx + w1, tt], [lx + w0, tb]]);
  const tower = c => polyPath(c, towerPts);
  const wAt = y => w1 + (w0 - w1) * clamp((y - tt) / (tb - tt), 0, 1);
  g.strokeStyle = COL.ink;
  // —— 起稿线：视平线（左虚右实）、塔的中轴、以灯为心的几道大弧、从灯往左上放出去的几根 ——
  for (let x = x0; x < u * 0.42; x += 5 + R() * 4) H([[x, yH + (R() - 0.5) * 0.3], [x + 1.5 + R() * 2, yH]], pen(HT, { a: 0.16 + 0.2 * (x - x0) / (u * 0.42), ov: 0 }));
  H([[u * 0.42, yH + 0.2], [x1 + 3, yH - 0.3]], pen(CL, { a: 0.3 })); H([[lx, fo + 6], [lx + 0.5, yQ + 5]], pen(CL2, { a: 0.2 }));
  [[v * 0.1, 0.55, 0.95, 0.26], [v * 0.17, 0.62, 1.08, 0.2], [v * 0.25, 0.7, 0.98, 0.15], [v * 0.058, 0, 1, 0.24]].forEach(([r, a0, a1, al]) => H(arcPts(lx, lampY, r, r, 0, PI * a0, PI * a1 * (a0 ? 1 : 2)), pen(CL, { a: al, ov: 2 })));
  for (let k = 0; k < 9; k++) { const a = PI * (1.0 + k * 0.04), r = v * 0.17; H([[lx + Math.cos(a) * (r - 1.5), lampY + Math.sin(a) * (r - 1.5)], [lx + Math.cos(a) * (r + (k % 4 ? 1.5 : 3.5)), lampY + Math.sin(a) * (r + (k % 4 ? 1.5 : 3.5))]], pen(HT, { a: 0.3, ov: 0 })); }   // 弧上的刻度
  // 远岸、月亮（只留铅笔的圆和一条劈开的线）
  { const sh = []; for (let x = u * 0.5; x <= x1 + 4; x += 2.6) sh.push([x, yH - 0.8 - 3.2 * Math.abs(Math.sin(x * 0.06 + 1.3)) * Math.min(1, (x - u * 0.5) / 26)]); H(sh, pen(OLs, { a: 0.26, n: 1 }));
    const mx = u * 0.58, my = v * 0.105, mr = u * 0.04, ta = B.tilt; H(arcPts(mx, my, mr, mr, 0, 0, TAU), pen(OLs, { a: 0.36, n: 1, ov: 0.6 })); H([[mx - Math.cos(ta) * (mr + 4), my - Math.sin(ta) * (mr + 4)], [mx + Math.cos(ta) * (mr + 4), my + Math.sin(ta) * (mr + 4)]], pen(OLs, { a: 0.4, n: 1 }));
    for (const o of [0.3, 0.55, 0.78]) { const h = Math.sqrt(1 - o * o) * mr * 0.92, nx = -Math.sin(ta), ny = Math.cos(ta); H([[mx - nx * o * mr - Math.cos(ta) * h, my - ny * o * mr - Math.sin(ta) * h], [mx - nx * o * mr + Math.cos(ta) * h, my - ny * o * mr + Math.sin(ta) * h]], pen(HT, { a: 0.26, ov: 0 })); } }
  // 防波堤：从右边页边伸到塔脚再往左收尖；石缝密排
  H([[lx - w0 - 16, tb + 0.8], [x1 + 3, tb + 0.2]], OLs); H([[lx - w0 - 24, yH + 2.2], [x1 + 3, yH + 1.8]], pen(OLs, { a: 0.38 })); H([[lx - w0 - 16, tb + 0.8], [lx - w0 - 24, yH + 2.2]], pen(OLs, { a: 0.4, n: 1 }));
  for (let x = lx - w0 - 14; x < x1; x += 2.2 + R() * 2.6) H([[x, tb + 0.9], [x - 0.6, yH + 1.9]], pen(HT, { a: 0.24, ov: 0 }));
  for (let x = lx - w0 - 20; x < x1; x += 4 + R() * 6) H(arcPts(x, yH + 3, 1.3 + R(), 0.9, 0, PI, TAU), pen(HT, { a: 0.28, ov: 0 }));
  // —— 重组：塔往左复制三回，一回比一回小、一回比一回虚（只剩铅笔的壳和几道箍）；船身也拖两道壳 ——
  [[0.15, 0.88, 0.46, 0], [0.285, 0.75, 0.3, 1], [0.41, 0.62, 0.17, 2]].forEach(([dx, sc, al, k]) => { const tp = towerPts.map(([x, y]) => [lx - u * dx + (x - lx) * sc, tb + (y - tb) * sc]);
    if (k < 2) H(tp.concat([tp[0]]), pen(OLs, { a: al, n: 1, ov: 1 })); else for (let i = 0; i < tp.length - 1; i += 2) H([tp[i], tp[i + 1]], pen(HT, { a: al, ov: 0 }));   // 最远那只断成几截
    [0.3, 0.42, 0.62, 0.72].forEach(f => { const y = tb - th * sc * (1 - f), w = wAt(tt + th * f) * sc; H([[lx - u * dx - w, y], [lx - u * dx + w, y]], pen(HT, { a: al * 0.8, ov: 0 })); });
    for (let q = 0; q < 5 - k * 2; q++) { const y = tb - th * sc * (0.33 + q * 0.018); H([[lx - u * dx - wAt(tt + th * 0.36) * sc, y], [lx - u * dx + wAt(tt + th * 0.36) * sc, y]], pen(HT, { a: al * 0.5, ov: 0 })); } });
  [[0.1, 0.34], [0.2, 0.18]].forEach(([dx, al]) => { const hp = hull.map(([x, y]) => [x - u * dx, y + 0.6]); H([hp[0], hp[1], hp[2]], pen(OLs, { a: al, n: 1 })); H([hp[4], hp[5], hp[6], hp[0]], pen(HT, { a: al * 0.8, ov: 0 })); });
  // 光束换成航线：从灯出去一根蓝的长虚线，带刻，往左上伸出画外；另一根铅笔的短一些
  { const a = PI * 1.075, ux = Math.cos(a), uy = Math.sin(a); g.strokeStyle = BLUE;
    if (lamp !== 'off') for (let d = gw + 7; d < u * 0.86; d += 7.5) { hand(g, [[lx + ux * d, lampY + uy * d], [lx + ux * (d + 4.6), lampY + uy * (d + 4.6)]], { w: 0.5, a: ba * (0.9 - 0.5 * d / (u * 0.86)), n: 1, j: 0.25, ov: 0.3 }, Rp); }
    g.strokeStyle = COL.ink; for (let d = 24; d < u * 0.8; d += 11 + R() * 16) { const px = lx + ux * d, py = lampY + uy * d, l = R() < 0.3 ? 3 : 1.5; H([[px - uy * l, py + ux * l], [px + uy * l * 0.4, py - ux * l * 0.4]], pen(HT, { a: 0.34, ov: 0 })); }
    const a2 = PI * 0.93; for (let d = gw + 9; d < u * 0.5; d += 9) H([[lx + Math.cos(a2) * d, lampY + Math.sin(a2) * d], [lx + Math.cos(a2) * (d + 5), lampY + Math.sin(a2) * (d + 5)]], pen(HT, { a: 0.26, ov: 0.3 })); }
  // —— 海：不用线，全用颗粒。疏密堆出明暗（左稀右密），浪是留出来的白（一层横向拉长的噪声当云）；塔和船底下的颗粒换成蓝 ——
  { const hsh = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 1442695) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hsh(xi, yi), b2 = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1); return a + (b2 - a) * sx + (c - a) * sy + (a - b2 - c + d) * sx * sy; };
    const fbm = (x, y) => 0.55 * vn(x, y) + 0.3 * vn(x * 2.1 + 7, y * 2.1 + 3) + 0.15 * vn(x * 4.3 + 1, y * 4.3 + 9);
    // 11/15 下午：海要有形。一块往左下斜出去的水面：上沿是硬的视平线，下沿是码头，左岸是一条斜边（岸里实、岸外很快散掉）；浪是横着留出来的白；
    // 黑跟着形走两处：船身在水里的倒影（一道道横条，越往下越窄越断）、塔脚下的防波堤（一只往左收尖的黑楔）。蓝只留塔、船和塔在水里的一小柱。
    const sy0 = yH + 1.5, sy1 = yQ - 1.5, SHh = sy1 - sy0, N = Math.round((x1 - x0) * SHh * 4.4), fx0 = u * 0.6, fy0 = yWl + v * 0.02, rx = u * 0.62, ry = SHh * 0.66;
    const xL = y => u * (0.5 - 0.4 * Math.pow(clamp((y - sy0) / SHh, 0, 1), 0.8));
    const wave = (x, y) => { const ty = (y - sy0) / SHh, n = fbm(x * (0.032 - 0.018 * ty) + 3, y * (0.62 - 0.4 * ty) + x * 0.004); return clamp((n - 0.43) / 0.05, 0, 1); };
    for (let i = 0; i < N; i++) { const x = x0 + Rw() * (x1 - x0), y = sy0 + Rw() * SHh, ty = (y - sy0) / SHh;
      if (y > ys - 1 && y < yWl + 0.6 && x > hx0 - 2 && x < hx1 + 5) continue;
      const e = (x - xL(y)) / (u * 0.2), edge = e >= 0 ? 0.55 + 0.45 * clamp(e, 0, 1) : 0.16 * Math.exp(e * 4.5);
      const dd = Math.hypot((x - fx0) / rx, (y - fy0) / ry), core = Math.pow(clamp(1 - dd, 0, 1), 1.2), dens = edge * (0.03 + 0.97 * wave(x, y)) * (0.5 + 0.5 * core);
      if (Rw() > dens) continue;
      const blue = Math.abs(x - lx) < wAt(tb) * (0.75 + 0.5 * ty) && ty < 0.7 && Rw() < 0.8;
      const z = (0.3 + Rw() * Rw() * 0.75) * (0.85 + 0.5 * ty); g.fillStyle = blue ? BLUE : COL.ink; g.globalAlpha = blue ? ba * (0.6 + 0.4 * Rw()) : (0.13 + 0.24 * core + 0.15 * Rw()) * inkA;
      g.fillRect(x, y, z * (1 + Rw() * 1.8), z); }
    { const Rr = rng(seed + 31), rh = (sy1 - yWl) * 0.66, n = Math.floor(rh / 1.5); g.fillStyle = COL.ink;   // 船身的倒影
      for (let k = 0; k < n; k++) { const t = k / n, y = yWl + 0.9 + k * 1.5, w = L * 0.86 * (1 - 0.52 * t), cx = hx0 + L * 0.46 + (Rr() - 0.5) * (2 + t * 18); let x = cx - w / 2; const xe = cx + w / 2;
        while (x < xe) { const seg = (7 + Rr() * 32) * (1 - 0.7 * t), gap = Rr() < t * 1.15 ? 1.5 + Rr() * 10 * t : 0, xx = Math.min(xe, x + seg);
          if (t < 0.18 || wave((x + xx) / 2, y) > 0.2) { g.globalAlpha = Math.min(1, 0.95 - 0.42 * t); g.fillRect(x, y, xx - x, 1.55 - 0.75 * t); }
          x = xx + gap; } } }
    { const jx = lx - w0 - 36, jy = tb + 0.5, pc = dark ? COL.gum : C.PAPER; g.fillStyle = COL.ink; g.globalAlpha = 0.93;   // 防波堤：黑楔
      g.beginPath(); g.moveTo(jx, jy + 1.8); g.lineTo(lx - w0 - 14, jy); g.lineTo(x1 + 5, jy - 0.3); g.lineTo(x1 + 5, jy + 9.5); g.lineTo(lx - w0 - 4, jy + 6.6); g.closePath(); g.fill();
      g.fillStyle = pc; g.globalAlpha = 0.75; for (let x = lx - w0 - 10; x < x1 + 2; x += 3.2 + Rp() * 4.4) g.fillRect(x, jy + 1.2 + Rp() * 1.5, 0.4, 2 + Rp() * 3.2);
      g.fillRect(lx - w0 - 12, jy + 1, x1 - lx + w0 + 16, 0.35);
      g.fillStyle = COL.ink; for (let k = 0; k < 8; k++) { g.globalAlpha = 0.85 - 0.09 * k; g.fillRect(jx - 3 - k * k * 1.25 - Rp() * 4, jy + 1.3 + Rp() * 1.3, (3 + Rp() * 7) * (1 - k / 9), 0.45 + Rp() * 0.5); } }
    g.globalAlpha = 1; g.strokeStyle = COL.ink; }
  // —— 船：桅和索先画（铅笔），船身是蓝的；舷上一道纸色，舱房和舷窗纸线 ——
  const ms = [[0.6, v * 0.16], [0.26, v * 0.25], [0.84, v * 0.29]].slice(0, B.masts);
  ms.forEach(([f, top], i) => { const x = hx0 + L * f, dk = ys + 1.4;
    H([[x, dk], [x + 0.7, top]], pen(OLs, { a: 0.6 })); H([[x + 1.4, dk], [x + 1.3, top + 10]], pen(HT, { a: 0.26, ov: 0 }));
    for (const fy of [0.2, 0.5]) { const yy = top + (dk - top) * fy, hw = L * (0.1 - 0.03 * i) * (1 + fy); H([[x - hw, yy + 0.6], [x + hw, yy - 0.4]], pen(OLs, { a: 0.5, n: 1 })); H([[x - hw + 1, yy + 2.6], [x + hw - 1, yy + 1.6]], pen(HT, { a: 0.3, ov: 0.3 }));
      for (let q = x - hw + 2; q < x + hw - 1; q += 2.6 + R() * 1.6) H([[q, yy - 0.4], [q - 0.3, yy + 2.4]], pen(HT, { a: 0.28, ov: 0 })); }   // 帆桁上卷着的帆和绑绳
    H([[x + 0.7, top], [hx0 - 1, ys + 1.4]], pen(HT, { a: 0.22 })); H([[x + 0.7, top], [hx1 + 15, ys - 7]], pen(HT, { a: 0.24 })); H([[x + 0.7, top + 8], [x - L * 0.09, dk]], pen(HT, { a: 0.22, ov: 0.3 })); H([[x + 0.7, top + 8], [x + L * 0.09, dk]], pen(HT, { a: 0.22, ov: 0.3 }));
    for (let k = 1; k < 7; k++) { const fy = k / 7, yy = top + 8 + (dk - top - 8) * fy; H([[x + 0.7 - L * 0.09 * fy, yy], [x + 0.7 + L * 0.09 * fy, yy]], pen(HT, { a: 0.2, ov: 0 })); }   // 绳梯
    if (!i) H([[x + 0.7, top], [x + 0.7, top - 4], [x - 5, top - 2.2], [x + 0.7, top - 0.8]], pen(HT, { a: 0.42, ov: 0 }));
  });
  H([[hx1 + 5, ys - 4], [hx1 + 15, ys - 7]], pen(OLs, { a: 0.5, n: 1 })); H([[hx1 + 15, ys - 7], [hx1 - 1.5, ys + (yWl - ys) * 0.6]], pen(HT, { a: 0.24 }));
  // 蓝的块：塔身和船身都切成几道横条，每条左右错开一点，条的左头拉出一根越来越细的线（贴着形走的碎）
  const slab = (path, yTop, yBot, n, leftAt, Rs) => { const hh = (yBot - yTop) / n;
    for (let k = 0; k < n; k++) { const ya = yTop + k * hh, dx = (Rs() - 0.5) * (k % 4 === 1 ? 7 : k % 2 ? 2.6 : 0.8);
      g.save(); g.beginPath(); g.rect(-20, ya, u + 40, hh + 0.05); g.clip(); g.translate(dx, 0); path(g); g.fillStyle = BLUE; g.globalAlpha = ba; g.fill(); g.restore();
      if (Rs() < 0.62) { const xl = leftAt(ya + hh / 2) + dx, len = (14 + Rs() * Rs() * u * 0.5), yy = ya + hh * (0.2 + Rs() * 0.6), gr = g.createLinearGradient(xl - len, 0, xl, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, BLUE); g.fillStyle = gr; g.globalAlpha = ba * (0.55 + 0.4 * Rs()); g.fillRect(xl - len, yy, len + 0.5, 0.35 + Rs() * Rs() * 2.4);
        if (Rs() < 0.5) { g.fillStyle = COL.ink; g.globalAlpha = 0.5 * inkA; g.fillRect(xl - len - 3 - Rs() * 14, yy + 0.2, 1 + Rs() * 6, 0.4); } } }
  };
  slab(tower, gy1 - 6, tb + 0.4, 17, y => lx - wAt(y), rng(seed + 21));
  slab(c => polyPath(c, hull), ys - 4.5, yWl + 0.3, 5, y => hx0 + 1, rng(seed + 23));
  g.globalAlpha = 1;
  // 纸色跟着形：塔身两道箍、回廊、灯室的窗；船舷一道白、舷窗
  g.save(); tower(g); g.clip(); g.fillStyle = dark ? COL.gum : C.PAPER; g.globalAlpha = 0.96;
  [[0.33, 0.085]].forEach(([f, h]) => g.fillRect(lx - w0 - 3, tt + th * f, w0 * 2 + 6, th * h)); [0.6, 0.63, 0.7].forEach(f => g.fillRect(lx - w0 - 3, tt + th * f, w0 * 2 + 6, 0.5));
  g.fillRect(lx - w1 - 4, tt - 0.5, w1 * 2 + 8, 0.7); g.fillRect(lx - gw + 0.9, gy1 + 1.2, gw * 2 - 1.8, gy0 - gy1 - 2.2);
  g.strokeStyle = BLUE; g.globalAlpha = ba; g.lineWidth = 0.4; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(lx + k * gw * 0.55, gy1 + 1.2); g.lineTo(lx + k * gw * 0.55, gy0 - 1); } g.stroke();
  g.fillStyle = dark ? COL.gum : C.PAPER; g.globalAlpha = 0.9; [[0.2, -0.2], [0.5, 0.3], [0.86, -0.1]].forEach(([f, o]) => g.fillRect(lx + o * w1 - 0.5, tt + th * f, 1, 2.6));
  g.restore();
  g.save(); polyPath(g, hull); g.clip(); g.fillStyle = dark ? COL.gum : C.PAPER; g.globalAlpha = 0.95; g.beginPath(); g.moveTo(hx0 - 2, ys + 4.2); g.lineTo(hx0 + L * 0.5, ys + 4.6); g.lineTo(hx1 + 6, ys - 0.6); g.lineTo(hx1 + 6, ys + 0.6); g.lineTo(hx0 + L * 0.5, ys + 5.6); g.lineTo(hx0 - 2, ys + 5.2); g.closePath(); g.fill();
  for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(hx0 + L * (0.16 + k * 0.12), ys + 8.6 - k * 0.12, 0.55, 0, TAU); g.fill(); } g.restore();
  // 灯：醒着一粒蓝点和一圈短芒；在忙多两道长光束；睡着灯室里几道暗的排线
  if (lamp === 'off') { g.strokeStyle = COL.ink; for (let k = -2; k <= 2; k++) H([[lx + k * 0.9, gy1 + 1.6], [lx + k * 0.9, gy0 - 1.4]], pen(HT, { a: 0.4, ov: 0 })); }
  else { g.fillStyle = BLUE; g.globalAlpha = 1; g.beginPath(); g.arc(lx, lampY, 1.5, 0, TAU); g.fill(); g.strokeStyle = COL.ink;
    for (let k = 0; k < 14; k++) { const a = k * TAU / 14 + 0.2, r0 = gw + 4, r1 = r0 + (k % 2 ? 2.4 : 5) + Rp() * 1.5; H([[lx + Math.cos(a) * r0, lampY + Math.sin(a) * r0], [lx + Math.cos(a) * r1, lampY + Math.sin(a) * r1]], pen(HT, { a: 0.5, ov: 0 })); }
    if (lamp === 'sweep') [[PI * 1.04, v * 0.42], [PI * 1.9, v * 0.12]].forEach(([a, len]) => { for (const sg of [-1, 1]) { const e = a + sg * 0.05; H([[lx + Math.cos(e) * (gw + 4), lampY + Math.sin(e) * (gw + 4)], [lx + Math.cos(e) * len, lampY + Math.sin(e) * len]], pen(OLs, { a: 0.42, n: 1, ov: 2 })); }
      g.fillStyle = BLUE; for (let d = gw + 8; d < len; d += 3 + Rp() * 3) { g.globalAlpha = 0.8 * (1 - d / len); g.beginPath(); g.arc(lx + Math.cos(a + (Rp() - 0.5) * 0.08) * d, lampY + Math.sin(a + (Rp() - 0.5) * 0.08) * d, 0.45, 0, TAU); g.fill(); } }); }
  // 塔和船的铅笔边：只描一侧和几处结构线，不整圈勾死
  g.strokeStyle = COL.ink; H([[lx + w0, tb], [lx + w1, tt]], pen(OLs, { a: 0.4 })); H([[lx - w1 - 3.6, tt - 2.6], [lx + w1 + 3.6, tt - 2.6]], pen(OLs, { a: 0.45, n: 1 })); H([[lx, gy1 - 4.2], [lx, gy1 - 9]], pen(OLs, { a: 0.55, n: 1, ov: 0.4 }));
  for (let k = 0; k <= 6; k++) { const x = lx - w1 - 3 + k * (w1 + 3) / 3; H([[x, tt], [x, tt - 2.6]], pen(HT, { a: 0.4, ov: 0 })); }
  H([hull[0], hull[1], hull[2]], pen(OLs, { a: 0.45 })); H([[hx0 + 1.5, ys + (yWl - ys) * 0.62], [hx0 - 1.4, yWl + 1.8], [hx0 + 5, yWl + 1.6]], pen(OLs, { a: 0.4, n: 1 }));
  { const c0 = hx0 + L * 0.34, c1 = hx0 + L * 0.5; H([[c0, ys + 1.6], [c0 + 1, ys - 3.4], [c1 - 1, ys - 3.6], [c1, ys + 1.8]], pen(OLs, { a: 0.5, n: 1 })); for (let q = c0 + 2; q < c1 - 1; q += 2.4) H([[q, ys - 2.6], [q, ys + 0.6]], pen(HT, { a: 0.3, ov: 0 })); }
  // 质感：塔左边散几粒蓝和墨的小方点，越往左越稀；蓝块里咬几粒纸色
  for (let i = 0; i < 150; i++) { const t = Math.pow(Rp(), 2.2), x = lx - w0 - 2 - t * u * 0.5, y = tt + Rp() * (th + 6), z = 0.35 + Rp() * 0.8; g.fillStyle = Rp() < 0.7 ? BLUE : COL.ink; g.globalAlpha = (0.75 - 0.6 * t) * ba; g.fillRect(x, y, z, z); }
  g.save(); tower(g); g.clip(); g.fillStyle = dark ? COL.gum : C.PAPER; for (let i = 0; i < 70; i++) { g.globalAlpha = 0.5 + 0.4 * Rp(); const z = 0.3 + Rp() * 0.5; g.fillRect(lx - w0 + Rp() * w0 * 0.9, tt + Rp() * th, z, z); } g.restore();
  // 码头：一道岸沿、一皮石头、两只缆桩、两根缆
  const qa = [hx0 - 8, yQ - 1.6], qb = [hx1 + 9, yQ - 1.6]; g.strokeStyle = COL.ink;
  H([[hx0, ys + 3], [(hx0 + qa[0]) / 2 - 1, (ys + qa[1]) / 2 + 5], qa], pen(HT, { a: 0.36 })); H([[hx1 + 3, ys - 1.5], [(hx1 + qb[0]) / 2 + 2, (ys + qb[1]) / 2 + 4], qb], pen(HT, { a: 0.36 }));
  H([[u * 0.2, yQ + 0.2], [x1 + 2, yQ - 0.4]], OLs); H([[u * 0.3, yQ + 3.2], [x1 + 1, yQ + 2.8]], pen(OLs, { a: 0.3, n: 1 }));
  for (let x = x0 + 4; x < u * 0.2; x += 4 + R() * 3) H([[x, yQ + 0.3], [x + 1.6, yQ + 0.2]], pen(HT, { a: 0.2, ov: 0 }));
  for (let x = u * 0.32 + R() * 4; x < x1 - 2; x += 5 + R() * 6) H([[x, yQ + 0.4], [x, yQ + 2.8]], pen(HT, { a: 0.24, ov: 0 }));
  [qa, qb].forEach(([x, y]) => { H([[x - 1.6, yQ], [x - 1.3, y - 1.6], [x + 1.3, y - 1.6], [x + 1.6, yQ]], pen(OLs, { a: 0.5, n: 1 })); H([[x - 2.3, y - 1.8], [x + 2.3, y - 1.8]], pen(OLs, { a: 0.45, n: 1, ov: 0.3 })); });
  g.globalAlpha = 1;
}
let backSig = '';
function drawBackCanvas(cv) {
  const c = FLIP ? FLIP.c : { relay: '/relay' }, B = backGeo(c), lamp = FLIP ? lampOf(c) : 'off'; layoutBack(B); BK.dataset.lamp = lamp;
  const dpr = DPR(), sig = [SW, SH, dpr, dark, c.relay, lamp].join('|'); if (backSig === sig && cv.width) return; backSig = sig;
  cv.width = Math.round((SW + PAD * 2) * dpr); cv.height = Math.round((SH + PAD * 2) * dpr);
  Object.assign(cv.style, { left: -PAD + 'px', top: -PAD + 'px', width: (SW + PAD * 2) + 'px', height: (SH + PAD * 2) + 'px' });
  const g = cv.getContext('2d'), G = geo(), dm = lamp === 'off' ? 0.66 : 1, seed = 5501 + (B.hv & 255);   // 灯灭：整片港淡一档
  laySheet(g, perfSheet(SW, SH, COL.gum, dpr, 7, 2.1), PAD, PAD, dpr);
  g.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
  g.strokeStyle = COL.grey; g.globalAlpha = 0.5; g.lineWidth = 0.3; framePath(g, G.fo, G.fo, SW - 2 * G.fo, SH - 2 * G.fo, 4.2); g.stroke(); g.globalAlpha = 1;
  g.save(); g.beginPath(); g.rect(3, 3, SW - 6, SH - 6); g.clip();
  drawQuay(g, B, lamp, seed, dm);
  // 航海日志：码头下面一页，两行手写的细线格，左边一道页边线
  const Rl = rng(seed + 13), lh = 15; g.strokeStyle = COL.ink;
  for (let k = 0; k < 2; k++) { const y = B.yLg + 11 + k * lh; hand(g, [[B.mL - 4 - Rl() * 3, y + 0.3], [B.mR + 2 + Rl() * 4, y - 0.2 - Rl() * 0.5]], pen(HT, { a: 0.24, w: 0.38, ov: 0.6 }), Rl); }
  hand(g, [[B.mL + 45, B.yLg - 3], [B.mL + 45.6, B.yLg + 11 + lh + 4]], pen(CL, { a: 0.22 }), Rl);
  g.restore();
  // 图版号
  g.fillStyle = COL.pen; g.globalAlpha = 0.5; g.font = '500 4.2px "Cormorant Garamond", Georgia, serif'; g.letterSpacing = '1px'; g.textAlign = 'center';
  const ix = Math.max(0, ORDER.findIndex(x => x.relay === c.relay));
  g.fillText('TAB. ' + (ROMAN[ix] || ix + 1) + ' · PORTVS · ' + slugOf(c.relay), SW / 2, SH - G.fo - 4.5); g.letterSpacing = '0px';
  g.globalAlpha = 1;
}
/* ---------- 燕子（照聊天页发送键那只：收着翅膀停在线头上）、切换钮的两个小图案 ---------- */
function birdSVG() {
  const col = dark ? C.PAPER : C.INK;
  return `<svg viewBox="-20 -17 40 34" aria-hidden="true"><path class="wire" d="M-23,12.6 C-14,13.6 -4,14.8 13.5,15.2" fill="none" stroke="var(--fg2)" stroke-width=".4" stroke-linecap="round" opacity=".7"/><path d="M-22.6,13.1 C-12,14.5 -2,15.3 9,15.6" fill="none" stroke="var(--fg3)" stroke-width=".3" opacity=".45"/>
    <g class="perch" transform="translate(-1 12.6) scale(.112)"><path d="${PERCH}" fill="${col}"/></g>
    <g fill="var(--fg3)"><circle cx="9.6" cy="5.2" r=".42"/><circle cx="12.6" cy="2.4" r=".38"/><circle cx="15.4" cy="-.1" r=".34"/><circle cx="18" cy="-2.3" r=".3"/></g></svg>`;
}
function lookSVG(on) {   // on：当前这套（'f' 邮票 / 'a' 星球）实心蓝，另一套只留轮廓
  let holes = ''; for (let i = 0; i <= 4; i++) { const x = 1 + i * 2.25; holes += `<circle cx="${f2(x)}" cy="1" r=".62"/><circle cx="${f2(x)}" cy="13" r=".62"/>`; } for (let i = 1; i < 6; i++) { const y = 1 + i * 2; holes += `<circle cx="1" cy="${y}" r=".62"/><circle cx="10" cy="${y}" r=".62"/>`; }
  const st = on === 'f' ? `<rect x="1" y="1" width="9" height="12" fill="var(--lb)" mask="url(#lkm)"/><rect x="2.9" y="2.9" width="5.2" height="8.2" fill="none" stroke="var(--bg)" stroke-width=".35"/>`
    : `<rect x="1" y="1" width="9" height="12" fill="none" stroke="var(--fg3)" stroke-width=".45" mask="url(#lkm)"/><rect x="2.9" y="2.9" width="5.2" height="8.2" fill="none" stroke="var(--fg3)" stroke-width=".3"/>`;
  const cx = 23, cy = 7, r = 4.6, th = -50 * PI / 180, ux = Math.cos(th), uy = Math.sin(th), half = `M${f2(cx + ux * r)},${f2(cy + uy * r)}A${r},${r} 0 0 0 ${f2(cx - ux * r)},${f2(cy - uy * r)}Z`;
  const nx = -uy, ny = ux, hl = [0.42, 0.68].map(o => { const h = Math.sqrt(1 - o * o) * r * 0.92; return `M${f2(cx + nx * o * r - ux * h)},${f2(cy + ny * o * r - uy * h)}L${f2(cx + nx * o * r + ux * h)},${f2(cy + ny * o * r + uy * h)}`; }).join('');   // 空的那半两根平行刻线
  const ink = on === 'a' ? 'var(--lb)' : 'var(--fg3)';
  const pl = (on === 'a' ? `<path d="${half}" fill="var(--lb)"/>` : '') + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ink}" stroke-width=".5"/><path d="${hl}" stroke="${ink}" stroke-width=".35"/>`;
  const e = r + 0.6, dv = `<path d="M${f2(cx - ux * e)},${f2(cy - uy * e)}L${f2(cx + ux * e)},${f2(cy + uy * e)}" stroke="${ink}" stroke-width=".42"/>`;   // 这么小时分界线不出头，免得像个「⌀」
  return `<svg viewBox="0 0 30 14" aria-hidden="true"><defs><mask id="lkm"><rect x="-1" y="-1" width="13" height="16" fill="#fff"/><g fill="#000">${holes}</g></mask></defs>${st}${pl}${dv}</svg>`;
}
const LOOK = 'niao_people_look';
$('look').innerHTML = lookSVG('f');
$('look').addEventListener('click', () => {
  if (window.__leaving) return;
  try { localStorage.setItem(LOOK, 'a'); } catch (e) {}
  window.__leaving = true; stage.style.transition = REDUCED ? '' : 'opacity .16s'; stage.style.opacity = '0';
  setTimeout(() => { location.href = 'people-a.html' + location.search; }, REDUCED ? 0 : 170);
});

/* ---------- 邮票夹：一沓邮票从屏幕底下长上来。上下划就是一格格翻过去（动作沿用转轮那一版）。
   当前这位正对屏幕、往上抽出一截：它是 DOM 里那张整的（只有 2D 平移），独一带蓝；别的都是线稿，按下面那张摆法表描到两张画布上
   （后面的在它底下、前面的压在它上面）。 ---------- */
let ORDER = [], ORDKEY = '', CARDS = [], pos = 0, idx = 0, firstBuild = true, FLIP = null;
function order() {   // 群照原数据里的位置插进去
  const out = PEOPLE.slice();
  if (GROUP) out.splice(clamp(GROUP.pos == null ? out.length : GROUP.pos, 0, out.length), 0, GROUP);
  return out;
}
function makeCard(c) {
  const el = document.createElement('div'); el.className = 'card';
  el.innerHTML = `<div class="clip"><div class="flip"><button class="face front" type="button"><canvas class="cv"></canvas><canvas class="bl"></canvas></button></div></div><div class="cap"><b></b><i></i></div><button class="bird" type="button">${birdSVG()}</button>`;
  const q = s => el.querySelector(s);
  const cd = { el, c, i: 0, clip: q('.clip'), cv: q('.cv'), bl: q('.bl'), front: q('.front'), flip: q('.flip'), cap: q('.cap'), bird: q('.bird'), sig: '', dirty: true, adirty: true, full: false, art: null, ps: null };
  cd.front.addEventListener('click', e => { e.stopPropagation(); if (suppress) return; const h = hitCard(e.clientX, e.clientY, true); if (h >= 0) { goTo(h); return; } tapCard(cd); });
  cd.bird.addEventListener('click', e => { e.stopPropagation(); if (suppress || cd.i !== idx || Math.abs(pos - idx) > 0.08) return; send(cd); });
  return cd;
}
function rebuild(ord) {
  const keepRel = CARDS[idx] && CARDS[idx].c.relay, old = new Map(CARDS.map(cd => [cd.c.relay, cd]));
  if (FLIP) unflip(true);
  CARDS = ord.map((c, i) => { let cd = old.get(c.relay); if (cd) { old.delete(c.relay); cd.c = c; } else cd = makeCard(c); cd.i = i; cd.sig = ''; deck.insertBefore(cd.el, FFc); return cd; });
  for (const cd of old.values()) cd.el.remove();
  ORDER = ord; ORDKEY = ord.map(c => c.relay).join(',');
  let t = firstBuild ? ord.findIndex(c => c.relay === CUR) : ord.findIndex(c => c.relay === keepRel);
  if (t < 0) t = firstBuild ? 0 : clamp(idx, 0, Math.max(0, ord.length - 1));
  firstBuild = false; pos = idx = t;
  placeCards();
}
function placeCards() {
  CARDS.forEach(cd => {
    Object.assign(cd.el.style, { left: '0px', top: '0px', width: SW + 'px', height: SH + 'px' });
    Object.assign(cd.cap.style, { left: (SW + 13) + 'px', top: Math.round(SH * 0.2) + 'px' });   // 名字竖排在邮票右肩外
    Object.assign(cd.bird.style, { left: (SW - 5) + 'px', top: Math.round(SH * 0.62 - 35) + 'px' });
  });
}
function updateCard(cd) {
  const c = cd.c, st = stateOf(c), cur = c.relay === CUR, el = cd.el, av = avOf(c), nm = shown(c);
  el.classList.toggle('cur', cur); el.classList.toggle('off', st.k === 'off'); el.classList.toggle('busy', st.k === 'busy'); el.classList.toggle('wait', st.k === 'wait'); el.classList.toggle('grp', !!c.group);
  el.dataset.relay = c.relay;
  const n = (c.members || []).length;
  cd.cap.querySelector('b').innerHTML = esc(nm) + (c.group && n ? `<small>${n} 位</small>` : '');
  cd.cap.querySelector('i').textContent = c.group ? (st.k === 'wait' ? '…' : st.k === 'off' ? st.t : c.age != null ? '上一句 · ' + short(c.age) : '') : st.t;
  const say = c.group ? nm + '，' + n + ' 位' + (st.k === 'off' ? '，' + st.t : c.age != null ? '，上一句 ' + short(c.age) : '') : nm + '，' + st.t.replace(' · ', '，');
  cd.front.setAttribute('aria-label', say + (cur ? '，正在聊' : '') + `，第 ${cd.i + 1} 位，共 ${CARDS.length} 位。点一下翻到背面看档案`);
  cd.bird.setAttribute('aria-label', '寄给' + nm + '（进聊天）');
  if (cur) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
  const sig = [st.k, av.length, av.slice(-24), av ? !!imgOf(av) : 0, SW, SH, cd.i, n].join('|');
  if (sig !== cd.sig) { cd.sig = sig; cd.dirty = true; cd.adirty = true; }
}
let fillT = 0;
const NEED = d => Math.abs(d) < 1.15;          // 要整张的：正中和正在转上来/转下去的那枚
const KEEP = d => Math.abs(d) <= 2.05;         // 闲着时先画好整张的
function drawNear() {   // 线稿全录（小）；整张只画正中附近的，别的慢慢补（每 30ms 一枚）；划的时候只投影线稿、动 transform
  CARDS.forEach(cd => { if (cd.adirty) buildArt(cd); if (cd.dirty && NEED(cd.i - pos)) drawFront(cd); });
  clearTimeout(fillT);
  const rest = () => { const cd = CARDS.find(x => x.dirty && KEEP(x.i - idx)); if (!cd) return; drawFront(cd); fillT = setTimeout(rest, 30); };
  fillT = setTimeout(rest, 60);
}
function release() {   // 远了的整张收回去（人多时省内存），回来时再画
  CARDS.forEach(cd => { if (cd.full && Math.abs(cd.i - idx) > 3) { cd.cv.width = cd.bl.width = 0; cd.full = false; cd.dirty = true; } });
}

/* 摆法：不照透视算，按「离正中几格」查一张表，格与格之间插值（划的时候就是在表里滑过去）。
   各枚的底边中点都落在底下一点（看不见的基点）的正上方；后面的一层层往上退、越退越小，各露一截顶；正中那枚正对屏幕、往上抽出一截；
   前面两枚朝人微倾（上宽下窄），一枚比一枚矮，压住正中那枚的下部、不挡星球和拱顶。每枚带一点固定的小歪斜和左右错位。
   列：d 离正中几格；t 顶边离基点多高、h 高（按邮票高）；wb / wt 底宽 / 顶宽（按邮票宽）；dx 左右错开（px）；r 歪多少度；a 浓淡 */
const LAY = [
  [-4, 1.92, 0.72, 0.72, 0.71, 0, 0.3, 0],
  [-3, 1.86, 0.775, 0.775, 0.765, -4, 0.9, 0.62],
  [-2, 1.78, 0.84, 0.84, 0.83, 5, -0.95, 0.86],
  [-1, 1.68, 0.912, 0.912, 0.905, -3.5, 0.65, 1],
  [0, 1.56, 1, 1, 1, 0, 0, 1],
  [1, 0.88, 0.6, 0.98, 1.16, 4, -0.7, 1],
  [2, 0.46, 0.32, 1.0, 1.24, -5, 0.95, 1],
  [3, 0.14, 0.16, 1.04, 1.3, 0, 0.3, 0]
];
function lay(d) {
  const x = clamp(d, LAY[0][0], LAY[LAY.length - 1][0]), i = Math.min(LAY.length - 2, Math.floor(x - LAY[0][0])), f = x - LAY[i][0], A = LAY[i], B = LAY[i + 1];
  const o = A.map((v, k) => v + (B[k] - v) * f); return { t: o[1], h: o[2], wb: o[3], wt: o[4], dx: o[5], r: o[6], a: o[7] * (d < LAY[0][0] || d > LAY[LAY.length - 1][0] ? 0 : 1) };
}
/* 基点在屏幕底边以下：平常（前面有两枚）最前面那枚的脚落在底边上面 FOOT px，不裁。
   翻到快到尾、前面的邮票不够两枚时，整沓跟着往下沉，让此刻最前面那枚的脚还落在底边；但最多比平常沉 DROP 个邮票高——
   停在最后一位（或只有一位）时当前这枚就离底边一小段，底下露出航线聚过去的那一片，上半页不至于全空 */
const FOOT = 3, DROP = 0.24;
let WG = { hub: [0, 0, 0], step: 180, s: 1, top: 0, tf: 0, hy0: 0 };
const QN = (k, v) => { const x = parseFloat(Q.get(k)); return isFinite(x) ? x : v; };
const foot = d => { const L = lay(d); return L.t - L.h; };   // 脚离基点多高（按邮票高）
function sinkTo(p) {
  const df = clamp(CARDS.length - 1 - p, 0, 2), hy0 = H - FOOT + foot(2) * SH, hy = Math.round(Math.min(H - FOOT + foot(df) * SH, hy0 + DROP * SH));
  WG.hy0 = Math.round(hy0); WG.hub[1] = hy; WG.top = Math.round(hy - LAY[4][1] * SH); CY = Math.round(WG.top + SH / 2);
  if (RTB) { const dy = hy - WG.hy0; if (dy !== rtbY) { rtbY = dy; RTB.style.transform = dy ? `translateY(${dy}px)` : ''; } }   // 蓝的那根航线跟着燕子沉（只有到尾这一段会动）
}
function wgeo() {
  WG = { hub: [CX, 0, 0], step: SH * 0.5, s: SW / 200, top: 0, tf: 0 }; sinkTo(pos);
}
let PX = 0, PY = 0, PZ = 0, PK = 1;
/* 一枚此刻的样子：底边中点 (cx, by)、高 h、底宽 / 顶宽、歪斜；朝人倾的上半截略拉长（k） */
function pose(d) {
  const L = lay(d), hx = WG.hub[0], hy = WG.hub[1], top = hy - L.t * SH, h = L.h * SH, cx = hx + L.dx * WG.s, rot = L.r * PI / 180;
  const wb = L.wb * SW, wt = L.wt * SW, k = Math.max(0, wt / wb - 1) * 2.2;
  return { d, th: d * 0.4, a: L.a, cx, by: top + h, top, h, wb, wt, k, cs: Math.cos(rot), sn: Math.sin(rot), z: d, B: [cx, top + h, 0], O: [cx - wb / 2, top, 0] };
}
function PC(ps, a, b) {
  const v0 = b / SH, v = ps.k ? v0 * (1 + ps.k) / (1 + ps.k * v0) : v0, w = ps.wt + (ps.wb - ps.wt) * v, x = (a / SW - 0.5) * w, y = -ps.h * (1 - v);
  PX = ps.cx + x * ps.cs - y * ps.sn; PY = ps.by + x * ps.sn + y * ps.cs; PK = w / SW; PZ = ps.z;
}
/* 线稿描上去：纸（不透明，挡住后面的）、一道很淡的齿孔边、录下来的笔、星、底行字（按那一处的局部仿射摆）。
   前面朝人倾的两枚：纸比纸面略灰一点，底下半截几道稀排线，齿孔边和线稿都描清楚 */
function drawV(g, cd, ps, al) {
  const A = cd.art; if (!A) return;
  const pp = A.paper, fr = clamp(ps.d, 0, 1.6); g.beginPath();
  for (let i = 0; i < pp.length; i += 2) { PC(ps, pp[i], pp[i + 1]); i ? g.lineTo(PX, PY) : g.moveTo(PX, PY); }
  g.closePath(); g.globalAlpha = Math.min(1, al * 1.5); g.fillStyle = A.fill; g.fill();
  if (fr > 0) { g.fillStyle = COL.pen; g.globalAlpha = 0.045 * Math.min(1, fr) * al; g.fill(); }
  g.strokeStyle = COL.pen; g.globalAlpha = (0.32 + 0.16 * Math.min(1, fr)) * al; g.lineWidth = 0.4; g.stroke();
  if (fr > 0.05) {   // 稀排线：靠底边一截，斜的、间距不等、两头参差
    const R = rng(4411 + cd.i * 17); g.strokeStyle = COL.pen; g.lineWidth = 0.3; g.globalAlpha = 0.2 * Math.min(1, fr) * al; g.beginPath();
    for (let x = SW * 0.1; x < SW * 0.92; x += 5 + R() * 6) { const y0 = SH * (0.66 + R() * 0.12), l = SH * (0.1 + R() * 0.12); PC(ps, x, y0); g.moveTo(PX, PY); PC(ps, x - l * 0.45, y0 + l); g.lineTo(PX, PY); }
    g.stroke();
  }
  for (const b of A.S) {
    g.strokeStyle = b.c; g.globalAlpha = Math.min(1, b.a * al * (1 + 0.25 * Math.min(1, fr))); g.lineWidth = b.w; g.beginPath();
    for (const p of b.pl) for (let i = 0; i < p.length; i += 2) { PC(ps, p[i], p[i + 1]); i ? g.lineTo(PX, PY) : g.moveTo(PX, PY); }
    g.stroke();
  }
  const D = A.dots; g.fillStyle = COL.pen; g.globalAlpha = 0.7 * al; g.beginPath();
  for (let i = 0; i < D.length; i += 3) { PC(ps, D[i], D[i + 1]); dot(g, PX, PY, D[i + 2] * Math.min(1.2, PK)); }
  g.fill();
  for (const t of A.texts) {
    PC(ps, t.x, t.y); const x0 = PX, y0 = PY; PC(ps, t.x + 10, t.y); const ax = (PX - x0) / 10, ay = (PY - y0) / 10; PC(ps, t.x, t.y + 10); const bx = (PX - x0) / 10, by = (PY - y0) / 10;
    if (Math.abs(ax * by - ay * bx) < 0.08) continue;
    g.save(); g.transform(ax, ay, bx, by, x0, y0); g.fillStyle = COL.pen; g.globalAlpha = t.a * al; g.font = t.font; g.letterSpacing = t.ls || '0px'; g.textAlign = t.al; g.textBaseline = 'alphabetic'; g.fillText(t.t, 0, 0); g.restore();
  }
  g.globalAlpha = 1;
}

let NEAR = -1;

/* 翻到背面时这枚再往上抽出一截，背面整张露出来、压到最前 */
let lift = 0, liftCd = null, liftT = 0;
function liftTo(cd, v, now) {
  cancelAnimationFrame(liftT);
  if (cd !== liftCd) { lift = 0; liftCd = cd; }
  if (now || REDUCED) { lift = v; if (!v) liftCd = null; apply(); return; }
  const a = lift, t0 = performance.now();
  const tick = tn => { const p = clamp((tn - t0) / 220, 0, 1); lift = a + (v - a) * smoother(p); if (p >= 1 && !v) liftCd = null; apply(); if (p < 1) liftT = requestAnimationFrame(tick); };
  liftT = requestAnimationFrame(tick);
}
const FBc = $('fb'), FFc = $('ff');
let GB = null, GF = null;
function apply() {
  const dpr = DPR(), items = [];
  sinkTo(pos);
  wallSoon();
  for (const cd of CARDS) {
    const d = cd.i - pos, ad = Math.abs(d), el = cd.el, ps = pose(d); cd.ps = ps;
    const dom = ad < 0.34, fo = dom ? 1 - sstep(0.05, 0.3, ad) : 0;
    if (!dom) { if (!el.hidden) el.hidden = true; }
    else {
      if (el.hidden) el.hidden = false;
      if (cd.dirty || !cd.full) drawFront(cd);
      const lf = cd === liftCd ? lift : 0, x = Math.round(ps.O[0] * dpr) / dpr, y = Math.round((ps.top - lf) * dpr) / dpr, sx = ps.wb / SW, sy = ps.h / SH;
      el.style.transform = `translate(${f2(x)}px,${f2(y)}px)` + (Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002 ? ` scale(${sx.toFixed(4)},${sy.toFixed(4)})` : '');
      el.style.opacity = fo.toFixed(3); el.style.zIndex = FLIP === cd ? '450' : '200';
      cd.bl.style.opacity = (1 - sstep(0, 0.22, ad)).toFixed(3);
      const k = clamp(1 - ad * 4, 0, 1); cd.cap.style.opacity = k.toFixed(3); cd.bird.style.opacity = k.toFixed(3);
    }
    const center = cd.i === idx && ad < 0.08;
    cd.bird.style.pointerEvents = center ? '' : 'none';
    cd.bird.tabIndex = center ? 0 : -1; cd.front.tabIndex = ad < 0.5 ? 0 : -1;
    if (ad < 0.5) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    const al = ps.a * (dom ? 1 - fo : 1);
    cd.al = al;
    if (al > 0.01 && cd.art) items.push({ z: ps.z, fr: d > 0.02, f: g => drawV(g, cd, ps, al) });
  }
  if (!GB) return;
  for (const g of [GB, GF]) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); }
  items.sort((a, b) => a.z - b.z).forEach(it => it.f(it.fr ? GF : GB));   // 前面朝人倾的压在正中那张上面，后面的在它底下
}
/* 点在画布上的哪一枚（从前往后找）；front：只找压在正中那张上面的（朝人倒过来的，画在前面那张画布上） */
function hitCard(x, y, front) {
  const L = CARDS.filter(cd => cd.ps && cd.al > 0.2 && (!front || cd.ps.th > WG.tf + 0.02) && Math.abs(cd.i - pos) >= 0.34).sort((a, b) => (b.ps.th > WG.tf) - (a.ps.th > WG.tf) || b.ps.z - a.ps.z);   // 前面那张画布上的先找
  for (const cd of L) {
    const q = [[0, 0], [SW, 0], [SW, SH], [0, SH]].map(([a, b]) => { PC(cd.ps, a, b); return [PX, PY]; });
    let s = 0, ok = true; for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4], c = (r[0] - p[0]) * (y - p[1]) - (r[1] - p[1]) * (x - p[0]); if (c !== 0) { if (s && Math.sign(c) !== s) { ok = false; break; } s = Math.sign(c); } }
    if (ok) return cd.i;
  }
  return -1;
}
const quadOf = i => { const cd = CARDS[i]; if (!cd || !cd.ps) return null; return [[0, 0], [SW, 0], [SW, SH], [0, SH], [SW / 2, SH * 0.35]].map(([a, b]) => { PC(cd.ps, a, b); return [PX, PY]; }).concat([[cd.ps.z, cd.ps.th]]); };   // 四角、中间一点、[深度, 角度]

/* ---------- 翻：跟手、吸附、快划连翻、到头阻尼回弹；滚轮和上下键也能翻 ---------- */
let anim = 0, drag = null, suppress = false;
function settle() {
  idx = clamp(Math.round(pos), 0, Math.max(0, CARDS.length - 1));
  apply(); release(); drawNear();
  const cd = CARDS[idx]; if (cd) $('live').textContent = (idx + 1) + ' / ' + CARDS.length + ' · ' + shown(cd.c) + ' · ' + stateOf(cd.c).t;
  window.__settled = true;
}
function animTo(to, dur) {
  cancelAnimationFrame(anim); window.__settled = false;
  to = clamp(to, 0, Math.max(0, CARDS.length - 1));
  if (REDUCED || dur === 0) { pos = to; settle(); return; }
  const from = pos, t0 = performance.now(), D = dur || clamp(230 + 80 * Math.abs(to - from), 240, 560);
  const tick = now => { const p = clamp((now - t0) / D, 0, 1), e = 1 - Math.pow(1 - p, 3); pos = from + (to - from) * e; apply(); if (p < 1) anim = requestAnimationFrame(tick); else { pos = to; settle(); } };
  anim = requestAnimationFrame(tick);
}
function goTo(t) { if (!CARDS.length) return; if (FLIP) unflip(); idx = clamp(t, 0, CARDS.length - 1); animTo(idx); }
const STEP = () => WG.step;   // 手指走这么远转一格
deck.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('input')) return;
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, lock: 0, s: [[performance.now(), e.clientY]] };
});
deck.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.lock) {
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag.lock = 1; cancelAnimationFrame(anim); drag.p0 = pos; drag.y0 = e.clientY; try { deck.setPointerCapture(e.pointerId); } catch (_) {} if (FLIP) unflip(); }
    else if (Math.abs(dx) > 14) { drag = null; return; }
    else return;
  }
  const n = CARDS.length, last = Math.max(0, n - 1);
  let p = drag.p0 - (e.clientY - drag.y0) / STEP();
  if (p < 0) p = -Math.min(0.32, -p * 0.3); else if (p > last) p = last + Math.min(0.32, (p - last) * 0.3);   // 到头：阻尼
  pos = p; apply();
  drag.s.push([performance.now(), e.clientY]); if (drag.s.length > 6) drag.s.shift();
  window.__settled = false;
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null;
  if (!d.lock) return;
  suppress = true; setTimeout(() => { suppress = false; }, 0);
  const a = d.s[0], b = d.s[d.s.length - 1], dt = Math.max(16, b[0] - a[0]), v = -(b[1] - a[1]) / dt / STEP();   // 位/毫秒
  let t = Math.round(pos + clamp(v * 220, -3, 3));
  if (Math.abs(v) > 0.0016 && t === Math.round(pos)) t = Math.round(pos) + Math.sign(v) * (Math.sign(v) * (pos - Math.round(pos)) < 0.05 ? 1 : 0);
  t = clamp(t, Math.round(d.p0) - 3, Math.round(d.p0) + 3);
  idx = clamp(t, 0, Math.max(0, CARDS.length - 1)); animTo(idx);
}
deck.addEventListener('pointerup', endDrag); deck.addEventListener('pointercancel', endDrag);
deck.addEventListener('click', e => {
  if (suppress) { e.stopPropagation(); return; }
  if (FLIP && !e.target.closest('.card.flipped')) { unflip(); return; }
  if (e.target.closest('.card')) return;
  const h = hitCard(e.clientX, e.clientY); if (h >= 0 && h !== idx) goTo(h);   // 点露出来的前后哪一枚：转到它
});
let wAcc = 0, wLock = 0, wT = 0;
deck.addEventListener('wheel', e => {
  e.preventDefault(); if (!CARDS.length) return;
  const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY; wAcc += dy; clearTimeout(wT); wT = setTimeout(() => { wAcc = 0; }, 180);
  const now = performance.now(); if (now < wLock || Math.abs(wAcc) < 36) return;
  wLock = now + 320; const s = Math.sign(wAcc); wAcc = 0; goTo(idx + s);
}, { passive: false });
document.addEventListener('keydown', e => {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (PH.classList.contains('on')) { if (e.key === 'Escape') phOff(); return; }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(idx + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(idx - 1); }
  else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
  else if (e.key === 'End') { e.preventDefault(); goTo(CARDS.length - 1); }
  else if (e.key === 'Escape' && FLIP) unflip();
});
function tapCard(cd) {
  if (cd.i !== idx || Math.abs(pos - idx) > 0.08) { goTo(cd.i); return; }   // 点露出来的前后那枚：翻到它
  if (FLIP === cd) unflip(); else flip(cd);
}

/* ---------- 背面：这位的档案（照搬 who.js：名字、备注、模型、此刻、换头像、换我的头像、查岗） ---------- */
const BK = document.createElement('div'); BK.className = 'face back';
BK.innerHTML = `<canvas aria-hidden="true"></canvas><div class="bk" role="group" aria-label="档案">
  <div class="bh"><span class="no"></span><button class="rt" type="button" aria-label="翻回正面"><svg viewBox="-6 -6 12 12"><path d="M3.8,-1.6A4.2,4.2 0 1 0 4.1,1.4" fill="none" stroke="var(--fg2)" stroke-width=".5"/><path d="M2.2,-3.4L4,-1.4L5.6,-3.5" fill="none" stroke="var(--fg2)" stroke-width=".5" stroke-linejoin="miter"/></svg></button></div>
  <div class="r nm"><span class="k">名字</span><span class="v vName"></span></div>
  <div class="r rk"><span class="k">备注 · <i>nota</i></span><button class="v vRemark" type="button" aria-label="改备注"></button></div>
  <div class="r md"><span class="k">模型 · <i>machina</i></span><span class="v mono vModel"></span></div>
  <div class="r sa"><span class="k"><i>nunc</i> · 此刻</span><span class="v st vState" role="status"></span></div>
  <div class="acts"><button type="button" class="bAv"><span class="me avA" aria-hidden="true"></span>换头像</button><button type="button" class="bPh" hidden>查岗</button><button type="button" class="bMe" hidden>换我的<span class="me avM" aria-hidden="true"></span></button></div>
  <p class="sync" role="status"></p></div>`;
const bq = s => BK.querySelector(s);
BK.addEventListener('click', e => { e.stopPropagation(); if (suppress) return; if (!e.target.closest('button, input, a')) unflip(); });
bq('.rt').addEventListener('click', e => { e.stopPropagation(); unflip(); });
function flip(cd) {
  if (FLIP && FLIP !== cd) unflip(true);
  FLIP = cd; cd.flip.appendChild(BK); drawBackCanvas(BK.querySelector('canvas'));
  ensureModel(cd.c); sync(); paintBack();
  void BK.offsetWidth; cd.el.classList.add('flipped'); cd.front.setAttribute('aria-expanded', 'true'); BK.inert = false; cd.front.tabIndex = -1;
  liftTo(cd, Math.round(SH * 0.1));
  window.__flipped = cd.c.relay;
}
function unflip(now) {
  const cd = FLIP; if (!cd) return; commit();
  FLIP = null; window.__flipped = null; cd.el.classList.remove('flipped'); cd.front.setAttribute('aria-expanded', 'false'); BK.inert = true;
  liftTo(cd, 0, now);
  const done = () => { if (FLIP !== cd && BK.parentNode === cd.flip) BK.remove(); };
  if (now || REDUCED) done(); else setTimeout(done, 280);
}
function keyOf(c) {   // 同 who.js resolve()：家里那只用 nyx_key，Nyx 现在选的那只用 nyx_chat_key，其余用联系人自己的
  if (!LIVE) return 'demo';
  if (c.group) return c.key || ls('nyx_key');
  const hk = ls('nyx_key'), picked = ls('nyx_relay');
  return c.relay === HOME ? hk : c.relay === picked ? (ls('nyx_chat_key') || hk) : (c.key || hk);
}
function ensureModel(c) {   // 模型：GET <relay>/app/meter 的 model.name（群不问；翻过一次就记着）
  if (c.group || c.model || c.mAsk) return;
  if (!LIVE) { c.model = 'Model Seven'; return; }
  const k = keyOf(c); if (!k) return;
  c.mAsk = true;
  call(c.relay, k, '/app/meter').then(m => { c.model = (m && m.model && (m.model.name || m.model.id)) || null; c.mErr = c.model ? '' : 'none'; paintBack(); }, e => { c.mErr = e.status === 503 ? 'none' : 'err'; c.mAsk = false; paintBack(); });
}
function initial(s) { return Array.from(s || '?')[0]; }
function paintBack() {
  const cd = FLIP; if (!cd) return; const c = cd.c, rk = remarkOf(c);
  drawBackCanvas(BK.querySelector('canvas'));   // 灯跟着此刻变；没变就不重画
  bq('.no').textContent = 'No. ' + c.relay.slice(1);
  bq('.vName').innerHTML = esc(shown(c)) + (rk ? `<small>原名 ${esc(c.name)}</small>` : '');
  if (!editing) { const v = bq('.vRemark'); v.textContent = rk || '未写'; v.classList.toggle('empty', !rk); }
  const vm = bq('.vModel'), vs = bq('.vState'), k = keyOf(c);
  vm.className = 'v mono vModel' + (c.model ? '' : ' dim');
  vm.textContent = c.group ? '—' : (LIVE && !k) ? '—' : c.model ? c.model : c.mErr === 'none' ? '还没报' : c.mErr ? '读不到' : '…';
  if (LIVE && !k) vs.innerHTML = '<span class="dim">—</span>';
  else if (c.off == null && !c.err) vs.innerHTML = '<span class="dim">…</span>';
  else if (c.err) vs.innerHTML = '<span class="dot off"></span>没应门';
  else if (c.auth) vs.innerHTML = '<span class="dot off"></span>钥匙不认';
  else { const a = shortL(c.age); vs.innerHTML = `<span class="dot${c.off ? ' off' : ''}"></span>${c.off ? '睡着' : c.busy ? '在忙 · ' + esc(String(c.busy).slice(0, 12)) : '醒着'}${a ? `<small>上一句 ${esc(a)}</small>` : ''}`; }
  const av = avOf(c) || '', me = ls(K_ME);
  bq('.avA').innerHTML = av ? `<img alt="" src="${esc(av)}">` : esc(initial(shown(c)));
  bq('.avM').innerHTML = okURL(me) ? `<img alt="" src="${esc(me)}">` : esc(initial(ME));
  bq('.bAv').setAttribute('aria-label', '换' + shown(c) + '的头像');
  bq('.bPh').hidden = true;   // 查岗只在第一只上有（同 profile.js 83 行）
  setSync(syncNote);
}
/* 备注：点了就地变一道细线输入；回车存、Esc 放弃、失焦存；空的就删掉这条备注（同 who.js） */
let editing = false, inp = null;
function startEdit() {
  if (editing || !FLIP) return; editing = true;
  const v = bq('.vRemark'), c = FLIP.c; inp = document.createElement('input'); inp.maxLength = 16; inp.autocomplete = 'off'; inp.spellcheck = false; inp.value = remarkOf(c); inp.setAttribute('aria-label', '备注'); inp.enterKeyHint = 'done';
  inp.dataset.relay = c.relay; v.hidden = true; v.after(inp); inp.focus(); try { inp.select(); } catch (e) {}
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { cancel(); } });
  inp.addEventListener('blur', commit);
  inp.addEventListener('click', e => e.stopPropagation());
}
function endEdit() { editing = false; if (inp) { const i = inp; inp = null; i.remove(); } bq('.vRemark').hidden = false; }
function cancel() { if (!editing) return; endEdit(); paintBack(); }
function commit() {
  if (!editing || !inp) return;
  const v = (inp.value || '').trim(), relay = inp.dataset.relay; endEdit();
  const c = ORDER.find(x => x.relay === relay); if (!c) return;
  if (v !== remarkOf(c)) { lset('nyx_profile_remark' + sufOf(relay), v || null); touched(); }
  paint();
}
bq('.vRemark').addEventListener('click', e => { e.stopPropagation(); startEdit(); });
/* 换头像：中心裁方、压到 256×256、白底、JPEG 0.88（同 profile.js 170–191） */
const K_ME = 'nyx_avatar_me', TS = 'nyx_prefs_ts';
function pickImg(input, keyOf2) {
  input.onchange = () => {
    const f = input.files && input.files[0]; if (!f) return; const key = keyOf2();
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let out = r.result;
        try { const S = 256, side = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S); out = c.toDataURL('image/jpeg', 0.88); } catch (e) {}
        lset(key, out); touched(); paint();
      };
      img.onerror = () => toast('这张图打不开');
      img.src = r.result;
    };
    r.readAsDataURL(f); input.value = '';
  };
}
pickImg($('f1'), () => 'nyx_avatar' + sufOf(FLIP ? FLIP.c.relay : '/relay')); pickImg($('f2'), () => K_ME);
bq('.bAv').addEventListener('click', e => { e.stopPropagation(); $('f1').click(); });
bq('.bMe').addEventListener('click', e => { e.stopPropagation(); $('f2').click(); });
/* 设置上云：照抄 who.js（profile.js 18–40）。翻到背面时才对一次 */
const SYNC_RE = /^nyx_(avatar|bg|cover|profile_remark|stickers|theme|todos|sound|deleted_ids|glass|phrases)/;
let ready = false, pushT = 0, syncNote = '', synced = false;
const hapi = (p, o) => call(HOME, ls('nyx_key'), p, o);    // 家里（prefs）走第一只、nyx_key，同 Nyx
function collect() { const d = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC_RE.test(k)) d[k] = localStorage.getItem(k); } } catch (e) {} return d; }
function push() { setSync('pushing'); hapi('/app/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ts: +ls(TS) || 0, data: collect() }) }).then(() => setSync('saved'), () => setSync('pushfail')); }
function touched() { if (!LIVE) { setSync('demo'); return; } if (!ready) { setSync(ls('nyx_key') ? 'local' : 'nokey'); return; } lset(TS, String(Date.now())); clearTimeout(pushT); pushT = setTimeout(push, 1500); setSync('wait'); }
function sync() {
  if (!LIVE) { setSync('demo'); return; }
  if (!ls('nyx_key')) { setSync('nokey'); return; }
  if (ready || synced) return; synced = true;
  hapi('/app/prefs').then(srv => {
    if (+ls(TS) > 4e12) lset(TS, '0');   // profile.js 26 行：不合理的大数当没有
    const local = +ls(TS) || 0, remote = +srv.ts || 0, data = srv.data || {}, mine = collect();
    if (remote > local && Object.keys(data).length) {
      Object.keys(mine).forEach(k => { if (!(k in data)) lset(k, null); });
      Object.keys(data).forEach(k => { if (k === 'nyx_stickers') return; lset(k, data[k]); });   // 表情住 IndexedDB，这页不碰
      lset(TS, String(remote)); ready = true; setSync('pulled'); paint(); return;
    }
    ready = true;
    let fill = false;   // 本机没有的头像和备注照样从云上补（profile.js 34–37）
    Object.keys(data).forEach(k => { if (/^nyx_(avatar|profile_remark)/.test(k) && ls(k) == null) { lset(k, data[k]); fill = true; } });
    if (fill) paint();
    if (local > remote || (!remote && Object.keys(mine).length)) { if (!local) lset(TS, String(Date.now())); push(); }
    else setSync('even');
  }).catch(e => { synced = false; setSync(e && e.auth ? 'auth' : 'syncfail'); });
}
function hm(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function setSync(k) {
  syncNote = k; const el = bq('.sync'), ts = +ls(TS) || 0;
  const T = { demo: '演示 · 只存在这一页里', local: '云上还没对上，先存在本机', even: '云上那份对上了' + (ts ? ' · ' + hm(ts) : ''), pulled: '从云上拿回来了 · ' + hm(Date.now()), wait: '一会儿存到云上…', pushing: '存到云上…', saved: '云上存好了 · ' + hm(Date.now()), pushfail: '云上没存上，本机留着', syncfail: '云上连不上，本机照旧' };
  if (k === 'nokey') el.innerHTML = '还没带钥匙，只存在本机 · <a href="../index.html">去登录</a>';
  else if (k === 'auth') el.innerHTML = '钥匙不认了 · <a href="../index.html">去登录</a>';
  else el.textContent = T[k] || '';
}
/* 查岗：盖一层纸，中间一台细线描的手机（同 who.js） */
const PH = $('ph');
function phOn() {
  const f = PH.querySelector('iframe');
  if (!f.getAttribute('src') && !f.getAttribute('srcdoc')) {
    if (LIVE) f.src = 'about:blank';
    else f.srcdoc = `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:${dark ? C.INK : '#f8f6f0'};font:300 10px serif;letter-spacing:.2em;color:${C.GREY}">演示里不开这台手机</body>`;
  }
  PH.style.display = 'flex'; requestAnimationFrame(() => PH.classList.add('on')); $('phX').focus();
}
function phOff() { PH.classList.remove('on'); setTimeout(() => { if (!PH.classList.contains('on')) PH.style.display = 'none'; }, REDUCED ? 0 : 220); }
bq('.bPh').addEventListener('click', e => { e.stopPropagation(); phOn(); });
$('phX').onclick = phOff; PH.onclick = e => { if (e.target === PH) phOff(); };
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

/* ---------- 页眉一行读数、安静的提示（同 people.js） ---------- */
function paintHead() {
  const n = PEOPLE.length, on = PEOPLE.filter(c => stateOf(c).k === 'on' || stateOf(c).k === 'busy').length, bz = PEOPLE.filter(c => stateOf(c).k === 'busy').length, wait = PEOPLE.some(c => c.off == null);
  $('cnt').innerHTML = n ? `<b>${n}</b> 位` + (wait ? ' · 敲门…' : ` · <b>${on}</b> 醒着` + (bz ? ` · <b>${bz}</b> 在忙` : '')) : '';
  let t = '';
  if (!n) t = '家里还没有人';
  else if (LIVE && keyless) t = '还没带钥匙，<a href="../index.html">去登录</a>';
  else if (!wait && PEOPLE.every(c => c.err)) t = '家里没应门，过一会儿再看';
  else if (!wait && PEOPLE.some(c => c.auth)) t = '有一位的钥匙不认了，<a href="../contacts.html">去改一改</a>';
  note.innerHTML = t; note.hidden = !t;
}

/* ---------- 底纹：航线（只画起航线，不画轨道）。画一次进 #deco，划的时候不动。
   原点看不见：就是这沓邮票底边聚向的那一点（平常停着时的基点，底边下面一点、水平居中）。七根航线从原点往上放出去，
   角度不匀（左边两根挨得近，中间一对几乎竖直），实线、长虚线、点线掺着，有的半路断开再接上、有的不到页边就收；
   线上不等距的小刻、两三处极小的拉丁标注；两三道近乎水平的纬线，和航线相交处落一粒点或一个小十字（只聚在左边两处）。
   蓝的只有一根：从燕子头前那串小点接出去、往右上伸出页面，画在单独一张小画布上（#rtb），整沓到尾往下沉时跟着燕子沉。
   页眉后面经过的线擦淡。都在邮票层底下。 ---------- */
let RTB = null, rtbY = 0, ROUTES = null;
const RT_LBL = { f: '3.6px ui-monospace, Menlo, monospace', ls: '0.35px' };
function birdTip(top) {   // 燕子头前那串小点的最后一粒（停稳时、当前这枚顶边在 top）：.bird 在卡片里的位置 + svg 里 (18, -2.3)
  return [CX - SW / 2 + (SW - 5) + 4 + 38, top + Math.round(SH * 0.62 - 35) + 5 + 14.7];
}
function rtDash(g, a, b, on, off, o, R) {   // 一截长虚线：每一划自己是一笔铅笔，长短略不等
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  for (let s = R() * off; s < L;) { const l = Math.min(L - s, on * (0.75 + R() * 0.5)); hand(g, [[a[0] + ux * s, a[1] + uy * s], [a[0] + ux * (s + l), a[1] + uy * (s + l)]], o, R); s += l + off * (0.7 + R() * 0.6); }
}
function rtDots(g, a, b, gap, al, R) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  g.globalAlpha = al; g.beginPath(); for (let s = R() * gap; s < L; s += gap * (0.8 + R() * 0.45)) dot(g, a[0] + ux * s + (R() - 0.5) * 0.3, a[1] + uy * s + (R() - 0.5) * 0.3, 0.26 + R() * 0.12); g.fill(); g.globalAlpha = 1;
}
function rtText(g, t, x, y, ux, uy, side, al) {   // 沿线写的极小字：顺着线的方向，倒过来时翻正；side：在线的哪一边
  let a = Math.atan2(uy, ux); if (a > PI / 2 || a < -PI / 2) a += PI;
  g.save(); g.translate(x - uy * side * 2.4, y + ux * side * 2.4); g.rotate(a); g.font = RT_LBL.f; g.letterSpacing = RT_LBL.ls; g.textAlign = 'center'; g.textBaseline = side > 0 ? 'top' : 'alphabetic';
  g.globalAlpha = al; g.fillText(t, 0, 0); g.restore();
}
function drawRoutes(g) {
  window.__routes = (window.__routes || 0) + 1;
  const R = rng(20261113 ^ 0x2b7), PENc = COL.pen, k = dark ? 0.85 : 1;
  const O = [CX, WG.hy0], P = birdTip(WG.hy0 - LAY[4][1] * SH), aB = Math.atan2(P[0] - O[0], O[1] - P[1]) * 180 / PI;
  // 角度从竖直量起（右为正）；end：画到哪一高（按屏高，没写就伸出页边）；from：从哪一高起笔；lb：[字, 在哪一高（按屏高）, 哪一边]
  const SPEC = [
    { a: -46, s: 'dot', al: 0.34, lb: [['RTE 11', 0.86, 1]] },
    { a: -28, s: 'dash', al: 0.17, lb: [['313°', 0.74, -1]] },
    { a: -14, s: 'solid', al: 0.17, brk: 0.7, lb: [['RTE 03', 0.47, 1], ['1 200 NM', 0.27, -1]] },
    { a: -5, s: 'dash', al: 0.19, end: 0.13, from: 0.42, lb: [['355°', 0.205, 1]] },
    { a: 3, s: 'solid', al: 0.16, end: 0.06, from: 0.36, brk: 0.45, lb: [['RTE 05', 0.25, -1]] },
    { a: aB, s: 'blue', al: 0.15, lb: [['021°', 0.5, -1]] },
    { a: 44, s: 'solid', al: 0.14, lb: [['0 860 NM', 0.79, 1]] }];
  const out = (ux, uy) => { let t = 1e9; if (uy < 0) t = Math.min(t, (O[1] + 14) / -uy); if (ux < 0) t = Math.min(t, (O[0] + 14) / -ux); if (ux > 0) t = Math.min(t, (W - O[0] + 14) / ux); return t; };
  const lines = [];
  g.save(); g.strokeStyle = PENc; g.fillStyle = PENc;
  SPEC.forEach(sp => {
    const th = sp.a * PI / 180, ux = Math.sin(th), uy = -Math.cos(th);
    let t1 = out(ux, uy); if (sp.end) t1 = Math.min(t1, (O[1] - sp.end * H) / -uy);
    let t0 = SH * (0.35 + R() * 0.5); if (sp.from) t0 = (O[1] - sp.from * H) / -uy;   // from：中间那两根从半空起笔，免得在邮票顶上收成一个尖
    const at = t => [O[0] + ux * t, O[1] + uy * t], al = sp.al * k;
    lines.push({ ux, uy, t0, t1, blue: sp.s === 'blue' });
    if (sp.s === 'blue') {   // 燕子以下这一截是铅笔（多半压在邮票后面），燕子以上蓝的另画
      const tp = Math.hypot(P[0] - O[0], P[1] - O[1]); rtDash(g, at(t0), at(tp - 8), 14, 5, { w: 0.38, a: al, n: 1, j: 0.5, ov: 1 }, R);
    } else if (sp.s === 'dot') rtDots(g, at(t0), at(t1), 3, al, R);
    else if (sp.s === 'dash') rtDash(g, at(t0), at(t1), 13 + R() * 6, 4 + R() * 2, { w: 0.4, a: al, n: 1, j: 0.5, ov: 1 }, R);
    else if (sp.brk) {   // 半路断开再接上：接上的那一笔略错开一点、先描轻再描实
      const tb = t0 + (t1 - t0) * sp.brk, gp = 7 + R() * 5, sh = 0.6 * (R() < 0.5 ? -1 : 1);
      hand(g, [at(t0), at(tb)], { w: 0.42, a: al, n: 2, j: 0.55, ov: 2 }, R);
      const b0 = at(tb + gp), b1 = at(t1); hand(g, [[b0[0] - uy * sh, b0[1] + ux * sh], [b1[0] - uy * sh * 0.3, b1[1] + ux * sh * 0.3]], { w: 0.4, a: al, n: 2, j: 0.55, ov: 3 }, R);
    } else hand(g, [at(t0), at(t1)], { w: 0.42, a: al, n: 2, j: 0.55, ov: 2 }, R);
    // 不等距的小刻：一簇一簇，偶尔一道长的
    g.lineWidth = 0.3; g.beginPath();
    for (let t = t0 + 20 + R() * 30, n = 0; t < t1 - 6; t += (R() < 0.6 ? 5 + R() * 6 : 26 + R() * 40), n++) {
      const p = at(t), l = n % 5 === 2 ? 3 : 1.5; g.moveTo(p[0] - uy * l, p[1] + ux * l); g.lineTo(p[0] + uy * l * (sp.s === 'dot' ? 1 : 0.4), p[1] - ux * l * (sp.s === 'dot' ? 1 : 0.4));
    }
    g.globalAlpha = Math.min(0.5, al * 1.6); g.stroke(); g.globalAlpha = 1;
    for (const [tx, yf, sd] of sp.lb || []) { const t = (O[1] - yf * H) / -uy, p = at(t); if (t > t0 && t < t1 && p[0] > 12 && p[0] < W - 12) rtText(g, tx, p[0], p[1], ux, uy, sd, 0.42 * k); }
  });
  // 纬线：近乎水平，很淡，有断口；只在左边两处和航线的交点上落点、十字
  const LATS = [{ y: 0.158, tilt: -0.006, al: 0.11, gap: [0.62, 0.7] }, { y: 0.292, tilt: 0.004, al: 0.13, gap: [0.36, 0.4], fix: 1 }, { y: 0.565, tilt: -0.003, al: 0.1, dash: 1, fix: 1 }];
  const fixes = [];
  LATS.forEach(L => {
    const y0 = L.y * H, ya = x => y0 + (x - W / 2) * L.tilt, al = L.al * k, o = { w: 0.36, a: al, n: 1, j: 0.35, ov: 2 };
    if (L.dash) rtDash(g, [-8, ya(-8)], [W + 8, ya(W + 8)], 22, 3.5, o, R);
    else { const g0 = L.gap[0] * W, g1 = L.gap[1] * W; hand(g, [[-8, ya(-8)], [g0, ya(g0)]], o, R); hand(g, [[g1, ya(g1)], [W + 8, ya(W + 8)]], o, R); }
    if (L.fix) lines.forEach(ln => {   // 交点：在屏幕左半、露在邮票外面的才落
      if (ln.blue) return; const t = (O[1] - y0) / -ln.uy, x = O[0] + ln.ux * t; if (t > ln.t0 && t < ln.t1 && x > 10 && x < W * 0.42) fixes.push([x, ya(x)]);
    });
  });
  fixes.forEach(([x, y], i) => {
    if (i % 2) { g.globalAlpha = 0.45 * k; g.beginPath(); dot(g, x, y, 0.6); g.fill(); }   // 定位点：一粒实点
    else { g.globalAlpha = 0.38 * k; g.lineWidth = 0.32; g.beginPath(); g.moveTo(x - 2.4, y); g.lineTo(x + 2.4, y); g.moveTo(x, y - 2.4); g.lineTo(x, y + 2.4); g.stroke(); }
    const R2 = rng(77 + i * 13); g.globalAlpha = 0.32 * k; g.beginPath(); for (let q = 0; q < 3 + (i % 3); q++) dot(g, x + (R2() - 0.5) * 16, y + (R2() - 0.5) * 9, 0.22 + R2() * 0.16); g.fill();   // 附近几粒散点（测深点）
    if (i === 0) rtText(g, 'FIX ' + String.fromCharCode(65 + (hstr(String(W)) % 6)), x + 9, y - 2.6, 1, 0, -1, 0.38 * k);
  });
  g.restore();
  ROUTES = { o: O, tip: P, n: lines.length, ang: SPEC.map(s => +s.a.toFixed(1)), lats: LATS.length, fixes: fixes.length, blue: aB };
  return { O, P, blue: lines.find(l => l.blue) };
}
/* ---------- 长廊：邮票后面的空间（从高处的廊台斜着往里看一条中殿）----------
   真透视：墙上每一点先有（进深 t，高 v），s = 1/(1+t*DD) 是它离灭点的远近，屏上 x = VPx ± s*跨度，y = VPy + s*v。
   左墙整面压墨、开一排排尖窗，墙脚碎成颗粒落到地上；右墙、地砖、尽头只用铅笔。灭点上一粒蓝。 */
let NAVE = null, NAVE_BOX = 0, NV = null, NVW = null, nvP = -1;
function drawNave(g, gp) {   // g：底纸（墨块）；gp：铅笔那张离屏纸
  const VX = W * 0.78, VY = H * 0.33, DD = 0.36, TOP = -0.16 * H, FLO = 0.82 * H, RS = (W - VX) * 1.75, R = rng(20261115);
  const sOf = t => 1 / (1 + t * DD);
  const L = (t, v) => { const s = sOf(t); return [VX * (1 - s), VY + s * v]; };       // 左墙
  const Rt = (t, v) => { const s = sOf(t); return [VX + s * RS, VY + s * v]; };       // 右墙
  const Fl = (t, u) => { const s = sOf(t); return [VX + s * (-VX + u * (VX + RS)), VY + s * FLO]; };   // 地面：u 从左墙脚 0 到右墙脚 1
  const T0 = -0.6, T1 = 70;
  const ink = COL.ink, paper = dark ? C.INK : C.PAPER;
  const poly = (c, pts) => { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); };
  const lancet = (P, t0, t1, vs, vsp, rise, n) => { const pts = [P(t0, vs)]; for (let i = 0; i <= n; i++) { const q = i / n; pts.push(P(t0 + (t1 - t0) * q, vsp - rise * (1 - Math.pow(Math.abs(2 * q - 1), 1.7)))); } pts.push(P(t1, vs)); return pts; };
  // 墙不在这里画：这里只把它拆成一块块石头记下来（NV），真画在 paintWall(cp) 里，cp = 划到第几位 / 最后一位
  const BAY = 0.55, AX = 0.9, NR = 34, RH = (FLO - TOP) / NR, BL = 0.065, TH = 0.03;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const wins = [], WSILL = 0.2 * H, WSPR = 0.0, WRISE = 0.042 * H;
  for (let k = -1; k < 14; k++) for (let j = 0; j < 2; j++) { const t0 = k + 0.17 + j * 0.37, t1 = t0 + 0.29; wins.push({ t0, t1, o: 1 - (0.62 * sm((t1 + 0.6 - 0.45 * 2.4) / 6.5) + 0.38 * sm((0.5 - 0.3) / 0.5) * sm((t1 + 1.0) / 2.6)) - 0.08, w: lancet(L, t0, t1, WSILL, WSPR, WRISE, 10) }); }
  const Rm = rng(424242), blocks = [];
  for (let r = 0; r < NR; r++) for (let i = -12; i < 164; i++) {
    const T = i * BL + (r % 2 ? BL / 2 : 0), rt = r / (NR - 1), v0 = TOP + r * RH, v1 = v0 + RH;
    const base = 0.62 * sm((T + 0.6 - rt * 2.4) / 6.5) + 0.38 * sm((0.5 - rt) / 0.5) * sm((T + 1.0) / 2.6);
    const rn = []; for (let q = 0; q < 9; q++) rn.push(Rm());
    const inWin = wins.some(w => T >= w.t0 - 0.01 && T + BL <= w.t1 + 0.01 && v0 >= WSPR + 2 && v1 <= WSILL + 0.5);
    if (inWin) continue;
    const tc = T + BL / 2, vc = (v0 + v1) / 2; let wn = 0;   // wn：2 = 这一格有一部分是窗洞（松了就直接没，不变方块）；1 = 紧挨着窗（只许往里缩，不许顶到窗前头）
    for (const w of wins) { if (vc < WSPR - WRISE - RH || vc > WSILL + RH) break; if (tc > w.t0 - BL * 0.6 && tc < w.t1 + BL * 0.6 && vc > WSPR - WRISE - RH * 0.4 && vc < WSILL + RH * 0.4) { wn = 2; break; } if (tc > w.t0 - BL * 2.2 && tc < w.t1 + BL * 1.2) wn = 1; }
    const Tn = clamp((T + 0.8) / 11.4, 0, 1);   // 拆的次序 = 砌的次序倒过来：最上一层、最远那头先拆，一层层往下、往近处退（斜着的台阶口）
    blocks.push({ T, v0, v1, wn, o: clamp(0.05 + 0.9 * (rt * 0.6 + (1 - Tn) * 0.4) + (rn[0] - 0.5) * 0.09, 0.02, 1), rel: (rn[2] - 0.5) * 0.32, rn });
  }
  const floorB = []; for (let i = 0; i < 16; i++) floorB.push({ at: 0.18 + 0.8 * Rm(), x: 0.08 + Rm() * 0.55, z: (-0.3 + Rm() * 3.2) * BAY, ry: Rm() * 3, flat: i % 3 === 0, up: i % 5 === 1 });
  blocks.sort((p, q) => q.T - p.T || q.v0 - p.v0);   // 远的先画
  const rows = []; for (const b of blocks) { const r = Math.round((b.v0 - TOP) / RH); (rows[r] = rows[r] || []).push(b); } rows.forEach(a => a.sort((p, q) => p.T - q.T));   // 每行近→远，画的时候把连着的并成一条
  NV = { VX, VY, DD, TOP, FLO, RS, BAY, AX, RH, BL, TH, rows, jnt: null, blocks, wins, floorB, WSILL, WSPR, T0, T1, W, H };
  // ---- 以下全是铅笔 ----
  const c = gp, k = dark ? 0.85 : 1; c.save(); c.strokeStyle = COL.pen; c.fillStyle = COL.pen;
  const ln = (a, b, o) => hand(c, [a, b], o, R);
  // 窗棂：每扇窗里一根中梃、一道横档（在墨墙上用纸色的反线不画，窗里是纸，铅笔正好）
  wins.forEach(wn => { if (wn.t0 > 7) return; const tm = (wn.t0 + wn.t1) / 2, a = 0.34 * k * Math.min(1, sOf(wn.t0) * 1.6);
    ln(L(tm, 0.2 * H), L(tm, -0.035 * H), { w: 0.34, a, n: 1, j: 0.3, ov: 0.5 }); ln(L(wn.t0, 0.1 * H), L(wn.t1, 0.1 * H), { w: 0.3, a: a * 0.8, n: 1, j: 0.25, ov: 0.5 }); });
  // 左墙腰线以上：一排小拱（暗楼）和高窗，只画线
  ln(L(T0, TOP), L(T1, TOP), { w: 0.5, a: 0.42 * k, n: 2, j: 0.5, ov: 3 });
  ln(L(T0, TOP - 0.035 * H), L(T1, TOP - 0.035 * H), { w: 0.34, a: 0.24 * k, n: 1, j: 0.4, ov: 2 });
  for (let kk = -1; kk < 9; kk++) { const a = 0.3 * k * Math.min(1, sOf(kk) * 1.7);
    for (let j = 0; j < 2; j++) { const t0 = kk + 0.14 + j * 0.4, w = lancet(L, t0, t0 + 0.32, TOP - 0.05 * H, TOP - 0.17 * H, 0.035 * H, 8); hand(c, w, { w: 0.34, a, n: 1, j: 0.35, ov: 1 }, R); }
    ln(L(kk, TOP - 0.035 * H), L(kk, TOP - 0.62 * H), { w: 0.4, a: a * 1.1, n: 2, j: 0.45, ov: 2 });   // 壁柱一路往上
    const hw = lancet(L, kk + 0.2, kk + 0.8, TOP - 0.3 * H, TOP - 0.5 * H, 0.06 * H, 10); hand(c, hw, { w: 0.34, a: a * 0.8, n: 1, j: 0.4, ov: 1 }, R);
  }
  ln(L(T0, TOP - 0.27 * H), L(T1, TOP - 0.27 * H), { w: 0.34, a: 0.2 * k, n: 1, j: 0.4, ov: 2 });
  // 繁复：小圆窗、齿饰、柱头、起稿的辅助线
  const ring = (P, tc, vc, rt, rv, o) => { const pts = []; for (let i = 0; i <= 22; i++) { const th = i / 22 * TAU; pts.push(P(tc + rt * Math.cos(th), vc + rv * Math.sin(th))); } hand(c, pts, o, R); };
  for (let kk = -1; kk < 7; kk++) { const a = 0.3 * k * Math.min(1, sOf(kk) * 1.7);
    ring(L, kk + 0.5, TOP - 0.215 * H, 0.09, 0.016 * H, { w: 0.32, a, n: 1, j: 0.25, ov: 0.5 }); ring(L, kk + 0.5, TOP - 0.215 * H, 0.045, 0.008 * H, { w: 0.28, a: a * 0.8, n: 1, j: 0.2, ov: 0.3 });
    ring(L, kk + 0.5, TOP - 0.56 * H, 0.16, 0.03 * H, { w: 0.32, a: a * 0.8, n: 1, j: 0.3, ov: 0.5 });
    for (let i = 0; i < 10; i++) { const t = kk + i / 10; ln(L(t, TOP - 0.035 * H), L(t, TOP - 0.012 * H), { w: 0.28, a: a * 0.7, n: 1, j: 0.15, ov: 0 }); }   // 腰线上的齿饰
    for (let i = 0; i < 7; i++) { const t = kk + 0.24 + i * 0.086; ln(L(t, TOP - 0.3 * H), L(t, TOP - 0.47 * H), { w: 0.26, a: a * 0.45, n: 1, j: 0.3, ov: 0 }); }   // 高窗里的竖排线
    [[-0.045, 0.012], [-0.062, 0.02]].forEach(([dv, dw]) => ln(L(kk - dw, TOP + dv * H), L(kk + dw + 0.02, TOP + dv * H), { w: 0.34, a: a, n: 1, j: 0.2, ov: 0.5 }));   // 壁柱的柱头
  }
  [[-0.9, 0.2], [-0.42, 0.16], [0.36, 0.14], [1.25, 0.12]].forEach(([vv, a]) => { ln(L(T0 - 1, vv * H), [VX + 40, VY + (VY - L(T0 - 1, vv * H)[1]) * 40 / (VX - L(T0 - 1, vv * H)[0])], { w: 0.3, a: a * k, n: 1, j: 0.5, ov: 4 }); });   // 过灭点的起稿线，画过头一点
  hand(c, [[-6, VY], [W + 6, VY]], { w: 0.3, a: 0.16 * k, n: 1, j: 0.4, ov: 2 }, R);   // 视平线
  for (let i = 0; i < 14; i++) { const x = W * (0.06 + i * 0.068); ln([x, VY - (i % 4 ? 1.5 : 3.2)], [x, VY + 1.5], { w: 0.28, a: 0.28 * k, n: 1, j: 0.1, ov: 0 }); }
  // 右墙：墩柱、大拱、腰线、暗楼
  ln(Rt(0, FLO), Rt(T1, FLO), { w: 0.45, a: 0.36 * k, n: 2, j: 0.5, ov: 3 });
  ln(Rt(0, TOP), Rt(T1, TOP), { w: 0.42, a: 0.34 * k, n: 2, j: 0.5, ov: 3 });
  ln(Rt(0, TOP - 0.035 * H), Rt(T1, TOP - 0.035 * H), { w: 0.32, a: 0.22 * k, n: 1, j: 0.4, ov: 2 });
  for (let kk = 0; kk < 12; kk++) { const a = 0.36 * k * Math.min(1, sOf(kk) * 2.2 + 0.12);
    ln(Rt(kk + 0.9, FLO), Rt(kk + 0.9, TOP - 0.6 * H), { w: 0.42, a, n: 2, j: 0.45, ov: 2 }); ln(Rt(kk + 1.1, FLO), Rt(kk + 1.1, TOP - 0.035 * H), { w: 0.36, a: a * 0.85, n: 1, j: 0.4, ov: 1 });
    const ar = lancet(Rt, kk + 0.1, kk + 0.9, FLO, 0.3 * H, 0.13 * H, 14); hand(c, ar.slice(1, -1), { w: 0.42, a, n: 2, j: 0.45, ov: 1 }, R);
    if (kk < 5) { const ar2 = lancet(Rt, kk + 0.16, kk + 0.84, FLO, 0.315 * H, 0.115 * H, 14); hand(c, ar2.slice(1, -1), { w: 0.3, a: a * 0.6, n: 1, j: 0.35, ov: 1 }, R); }
    if (kk < 6) for (let j = 0; j < 2; j++) { const t0 = kk + 0.14 + j * 0.4, w = lancet(Rt, t0, t0 + 0.32, TOP - 0.05 * H, TOP - 0.17 * H, 0.035 * H, 8); hand(c, w, { w: 0.32, a: a * 0.8, n: 1, j: 0.3, ov: 1 }, R); }
  }
  for (let kk = 0; kk < 5; kk++) { const a = 0.15 * k; for (let i = 1; i < 12; i++) { const q = i / 12, t = kk + 0.1 + 0.8 * q, vt = 0.3 * H - 0.13 * H * (1 - Math.pow(Math.abs(2 * q - 1), 1.7)); ln(Rt(t, vt + 0.01 * H), Rt(t, vt + (0.1 + 0.42 * ((i * 7 + kk * 3) % 5) / 5) * H), { w: 0.28, a, n: 1, j: 0.3, ov: 0 }); }
    [[0.3, 0.05], [0.285, 0.07]].forEach(([vv, dw]) => ln(Rt(kk + 0.9 - dw, vv * H), Rt(kk + 1.1 + dw, vv * H), { w: 0.34, a: 0.32 * k, n: 1, j: 0.2, ov: 0.5 }));
    ring(Rt, kk + 0.5, TOP - 0.215 * H, 0.09, 0.016 * H, { w: 0.3, a: 0.26 * k, n: 1, j: 0.25, ov: 0.5 }); }
  for (let t = -0.5; t < 7; t += 0.5) for (let i = 0; i < 8; i++) { const a = 0.13 * k * Math.min(1, sOf(t) * 1.6); if ((i + Math.round(t * 2)) % 2) ln(Fl(t, i / 8), Fl(t + 0.5, (i + 1) / 8), { w: 0.26, a, n: 1, j: 0.25, ov: 0 }); else ln(Fl(t, (i + 1) / 8), Fl(t + 0.5, i / 8), { w: 0.26, a, n: 1, j: 0.25, ov: 0 }); }   // 斜拼的砖
  // 地砖：往灭点收的纵线、越远越密的横线
  for (let i = 1; i < 8; i++) { const u = i / 8; ln(Fl(T0 - 0.6, u), Fl(T1, u), { w: 0.34, a: (i % 2 ? 0.16 : 0.24) * k, n: 1, j: 0.4, ov: 2 }); }
  for (let t = -0.5; t < 16; t += 0.5) { const a = 0.24 * k * Math.min(1, sOf(t) * 1.5 + 0.1); ln(Fl(t, 0.02), Fl(t, 1), { w: 0.34, a: (Math.round(t * 2) % 2 ? 0.6 : 1) * a, n: 1, j: 0.35, ov: 1 }); }
  // 拱顶的横肋：近处两三道，从左腰线上方跨到右边
  for (let kk = 1; kk < 7; kk++) { const s = sOf(kk), xl = VX * (1 - s), xr = VX + s * RS, ys = VY + s * (TOP - 0.6 * H), pts = []; for (let i = 0; i <= 18; i++) { const q = i / 18; pts.push([xl + (xr - xl) * q, ys - s * 0.22 * H * (1 - Math.pow(Math.abs(2 * q - 1), 1.6))]); } hand(c, pts, { w: 0.36, a: 0.22 * k * Math.min(1, s * 2), n: 1, j: 0.45, ov: 1 }, R); }
  for (let kk = 1; kk < 6; kk++) { const sa = sOf(kk), sb = sOf(kk + 1), A = [VX * (1 - sa), VY + sa * (TOP - 0.6 * H)], B = [VX + sb * RS, VY + sb * (TOP - 0.6 * H)], A2 = [VX + sa * RS, VY + sa * (TOP - 0.6 * H)], B2 = [VX * (1 - sb), VY + sb * (TOP - 0.6 * H)];
    [[A, B], [A2, B2]].forEach(([p0, p1]) => { const pts = []; for (let i = 0; i <= 14; i++) { const q = i / 14; pts.push([p0[0] + (p1[0] - p0[0]) * q, p0[1] + (p1[1] - p0[1]) * q - (sa + sb) / 2 * 0.2 * H * Math.sin(q * PI)]); } hand(c, pts, { w: 0.3, a: 0.17 * k * Math.min(1, sa * 2), n: 1, j: 0.4, ov: 1 }, R); }); }   // 拱顶的斜肋
  // 尽头：一堵小墙、一扇尖窗
  const sf = sOf(T1), ex0 = VX * (1 - sf), ex1 = VX + sf * RS, ey0 = VY + sf * (TOP - 0.6 * H), ey1 = VY + sf * FLO;
  hand(c, [[ex0, ey1], [ex0, ey0], [ex1, ey0], [ex1, ey1]], { w: 0.34, a: 0.4 * k, n: 1, j: 0.2, ov: 0.3 }, R);
  c.restore();
  NAVE = { vp: [VX, VY], wins: wins.length, top: L(0, TOP), foot: L(0, FLO) };
  return { VX, VY };
}
/* 墙：真的立体。每块石头是一只有厚度的盒子，同一台相机去看；窗洞里看得见墙厚。
   cp（0..1）= 塌到几成：每块有自己的松动次序 o，f = cp - o。f<0 还砌在墙上；刚过 0 先错缝，再离墙，顺着长廊往灭点漂、翻转、变小；漂远了就没了 */
function paintWall(cp) {
  if (!NV || !NVW) return; cp = clamp(cp, 0, 1); if (Math.abs(cp - nvP) < 0.0015) return; nvP = cp;
  const g = NVW, { VX, VY, DD, TOP, FLO, BAY, AX, RH, BL, TH, blocks, wins, floorB, WSILL, WSPR, T0, T1 } = NV, H_ = NV.H;
  g.clearRect(0, 0, NV.W, H_);
  const ink = COL.ink, paper = dark ? C.INK : C.PAPER, sOf = t => 1 / (1 + t * DD);
  const P3 = (X, Y, Z) => { const s = sOf(Z / BAY); return [VX * (1 - s) + s * X * VX / AX, VY + s * Y * H_, s]; };
  const Lp = (t, v) => { const s = sOf(t); return [VX * (1 - s), VY + s * v]; };
  const quad = (a, b, c, d) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); };
  const K = Math.pow(cp, 0.45) * 0.66, TW = TH * 0.3, LIFT = 0.42;   // 11/15：第一位整墙；第二位起就拆开一大截，越往后越多   // 11/15：第一位进来墙就已经拆开一截，没有哪一位看到整块黑板
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  // 最远的那一截不拆成体块：整的时候补上，一开拆它先没
  { const fa = clamp(1 - cp * 6, 0, 1); if (fa > 0) { g.fillStyle = ink; g.globalAlpha = (dark ? 0.9 : 1) * fa; quad(Lp(10.56, TOP - 0.3), Lp(T1, TOP - 0.3), Lp(T1, FLO + 0.3), Lp(10.56, FLO + 0.3)); g.fill(); } }
  // 整面墙就是一块块体块码起来的：每块都是一只盒子（朝外的面墨最深，朝相机的一头次之，顶面最浅），前后凹凸一点。
  // 轮到拆的那一块：原地往上提、朝外一点、变小，提到头就拿走。不转。
  const hx = TH / 2, hy = RH / H_ / 2, hz = BL * BAY / 2, EX = AX, EZ = -BAY / DD, pts = [];
  const FACES = [[4, 5, 7, 6, 0, 1, 1], [0, 2, 6, 4, 2, -1, 0.7], [0, 1, 5, 4, 1, -1, 0.34], [2, 3, 7, 6, 1, 1, 0.82]];   // 朝外、朝相机的一头、顶、底（背面和远的一头永远看不见）
  g.lineJoin = 'round';
  // 没轮到拆的：码平、严丝合缝，只画朝外那一面，一口气填完；砖缝很淡，快轮到的那几块缝亮一点
  const lift = [], soon = []; g.fillStyle = ink; g.globalAlpha = dark ? 0.9 : 1; g.beginPath();
  for (const row of NV.rows) { if (!row) continue; let t0 = null, t1 = 0, v0 = 0, v1 = 0;
    const flush = () => { if (t0 === null) return; const a = Lp(t0 - 0.003, v0 - 0.25), a2 = Lp(t1 + 0.003, v0 - 0.25), c = Lp(t1 + 0.003, v1 + 0.25), c2 = Lp(t0 - 0.003, v1 + 0.25); g.moveTo(a[0], a[1]); g.lineTo(a2[0], a2[1]); g.lineTo(c[0], c[1]); g.lineTo(c2[0], c2[1]); g.closePath(); t0 = null; };
    for (const b of row) { const f = K - b.o; if (f > 0) { flush(); if (f < LIFT) lift.push(b); continue; }
      if (f > -0.05 && b.T < 6) soon.push(b);
      if (t0 !== null && Math.abs(b.T - t1) > 0.001) flush(); if (t0 === null) { t0 = b.T; v0 = b.v0; v1 = b.v1; } t1 = b.T + BL; }
    flush(); }
  g.fill();
  // 砖缝：整面的淡缝预先画在一张离屏纸上，这里只贴到还有墙的地方；快轮到的那几块缝亮一点
  if (!NV.jnt) { const jc = document.createElement('canvas'); jc.width = g.canvas.width; jc.height = g.canvas.height; const jg = jc.getContext('2d'); jg.setTransform(g.getTransform()); jg.strokeStyle = paper; jg.lineWidth = 0.22; jg.globalAlpha = 0.17; jg.beginPath();
    for (const b of blocks) { if (b.T > 6) continue; const a = Lp(b.T, b.v0), a2 = Lp(b.T + BL, b.v0), c2 = Lp(b.T, b.v1); jg.moveTo(c2[0], c2[1]); jg.lineTo(a[0], a[1]); jg.lineTo(a2[0], a2[1]); } jg.stroke(); NV.jnt = jc; }
  g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(NV.jnt, 0, 0); g.restore();
  g.strokeStyle = paper; g.lineWidth = 0.22; g.globalAlpha = 0.6; g.beginPath();
  for (const b of soon) { const a = Lp(b.T, b.v0), a2 = Lp(b.T + BL, b.v0), c2 = Lp(b.T, b.v1); g.moveTo(c2[0], c2[1]); g.lineTo(a[0], a[1]); g.lineTo(a2[0], a2[1]); } g.stroke();
  lift.sort((p, q) => q.T - p.T);
  // 尖窗的拱尖另挖；窗洞里的墙厚
  for (const w of wins) { if (w.t0 > 9) continue; const alive = K < 0.05 + 0.9 * (0.3 * 0.6 + (1 - clamp((w.t1 + 0.8) / 11.4, 0, 1)) * 0.4) - 0.05;
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 1; g.beginPath(); w.w.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over';
    if (!alive) continue; const z1 = w.t1 * BAY, z0 = w.t0 * BAY, ys = WSILL / H_, yt = (WSPR + 2) / H_;
    g.fillStyle = ink; g.globalAlpha = 0.3; quad(P3(0, yt, z1), P3(-TW, yt, z1), P3(-TW, ys, z1), P3(0, ys, z1)); g.fill();
    g.globalAlpha = 0.12; quad(P3(0, ys, z0), P3(0, ys, z1), P3(-TW, ys, z1), P3(-TW, ys, z0)); g.fill();
  }
  // 墨墙上的纸色细线：壁柱、墙裙、窗楣（只落在还有墙的地方）
  g.save(); g.globalCompositeOperation = 'source-atop'; g.strokeStyle = paper; g.lineWidth = 0.42;
  for (let k = -1; k < 12; k++) { g.globalAlpha = 0.45 * Math.min(1, sOf(k) * 1.8 + 0.1); g.beginPath(); let a = Lp(k, TOP), b = Lp(k, FLO); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
    for (let i = 0; i <= 14; i++) { const q = i / 14, pt = Lp(k + 0.12 + 0.76 * q, -0.03 * H_ - 0.075 * H_ * (1 - Math.pow(Math.abs(2 * q - 1), 1.7))); i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]); } g.stroke(); }
  [[0.235, 0.45], [0.5, 0.4], [-0.12, 0.3]].forEach(([v, al]) => { g.globalAlpha = al; g.beginPath(); const a = Lp(T0, v * H_), b = Lp(T1, v * H_); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
  g.restore();
  // 照景深，墙越往里越透；透掉的地方只剩铅笔勾的砖缝和窗框，整面的时候也有远近。
  // 墙在屏上的 x 跟进深一一对应，所以用一条横向渐变擦；线稿预先画在离屏纸上，只留在「还有墙」的地方。
  { const sc = g.getTransform().a, cw = g.canvas.width, ch = g.canvas.height, xAt = t => Lp(t, 0)[0] * sc;
    const stops = [[0.7, 0], [2.2, 0.3], [4.5, 0.62], [7, 0.82], [10.5, 0.92]], x0g = xAt(0.7), x1g = xAt(10.5);
    const grad = c => { const gr = c.createLinearGradient(x0g, 0, x1g, 0); stops.forEach(([t, a]) => gr.addColorStop(clamp((xAt(t) - x0g) / (x1g - x0g), 0, 1), 'rgba(0,0,0,' + a + ')')); return gr; };
    if (!NV.hint) { const hc = document.createElement('canvas'); hc.width = cw; hc.height = ch; const hg = hc.getContext('2d'); hg.setTransform(g.getTransform()); hg.strokeStyle = ink; hg.lineJoin = 'round';
      hg.lineWidth = 0.3; hg.globalAlpha = 0.45; hg.beginPath(); for (const b of blocks) { if (b.T < 1.2) continue; const a = Lp(b.T, b.v0), a2 = Lp(b.T + BL, b.v0), c2 = Lp(b.T, b.v1); hg.moveTo(c2[0], c2[1]); hg.lineTo(a[0], a[1]); hg.lineTo(a2[0], a2[1]); } hg.stroke();
      hg.lineWidth = 0.5; hg.globalAlpha = 0.8; for (const w of wins) { hg.beginPath(); w.w.forEach((q, i) => i ? hg.lineTo(q[0], q[1]) : hg.moveTo(q[0], q[1])); hg.closePath(); hg.stroke(); }
      for (let k = 1; k < 12; k++) { const a = Lp(k, TOP), b = Lp(k, FLO); hg.beginPath(); hg.moveTo(a[0], a[1]); hg.lineTo(b[0], b[1]); hg.stroke(); }
      hg.beginPath(); [TOP, FLO].forEach(v => { const a = Lp(T0, v), b = Lp(T1, v); hg.moveTo(a[0], a[1]); hg.lineTo(b[0], b[1]); }); hg.stroke();
      hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalAlpha = 1; hg.globalCompositeOperation = 'destination-in'; hg.fillStyle = grad(hg); hg.fillRect(0, 0, cw, ch);   // 线稿自己也照进深显：近处没有，越远越清楚
      NV.hint = hc; }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out'; g.fillStyle = grad(g); g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'destination-over'; g.drawImage(NV.hint, 0, 0); g.restore(); }   // 线稿垫在墙底下：墙拆走以后它还在，像起稿时留下的铅笔线
  // 轮到拆的那一块：原地往上提、朝外一点、变小，提到头就拿走。不转。
  // 提起来的：前一小段直着起（守着墙的格子），之后放开——往上、往外、顺着长廊往灭点散成一股，高低远近大小都不齐，越远越稀，偶尔翻个身、偶尔一块大的
  const hex = c => { const m = /^#(..)(..)(..)$/.exec(c); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [22, 23, 28]; }, pc = hex(paper), ic = hex(ink);
  const mix = t => { t *= dark ? 0.9 : 1; return 'rgb(' + [0, 1, 2].map(k => Math.round(pc[k] + (ic[k] - pc[k]) * t)).join(',') + ')'; }, SH = { 1: mix(1), 0.34: mix(0.34), 0.82: mix(0.82), 0.7: mix(0.7) };
  const FSX = [[0.7, 0], [2.2, 0.3], [4.5, 0.62], [7, 0.82], [10.5, 0.92]].map(([t, a]) => [Lp(t, 0)[0], a]);
  const fadeT = t => { const x = Lp(Math.max(0, t), 0)[0]; if (x <= FSX[0][0]) return 0; for (let i = 1; i < FSX.length; i++) if (x <= FSX[i][0]) return FSX[i - 1][1] + (FSX[i][1] - FSX[i - 1][1]) * (x - FSX[i - 1][0]) / (FSX[i][0] - FSX[i - 1][0]); return 0.92; };   // 11/15：墙在这个进深有多浅，方块也多浅
  let nb = 0; const F6 = [[0, 1, 3, 2, 0, -1, 1], [4, 5, 7, 6, 0, 1, 1], [0, 1, 5, 4, 1, -1, 0.34], [2, 3, 7, 6, 1, 1, 0.82], [0, 2, 6, 4, 2, -1, 0.7], [1, 3, 7, 5, 2, 1, 0.7]];
  g.strokeStyle = paper; g.lineWidth = 0.26;
  for (const b of lift) { if (b.wn === 2) continue; const f = K - b.o, st = f / LIFT, r = b.rn, e0 = sm(Math.min(1, st / 0.14)), fr = Math.max(0, st - 0.08) / 0.92, e = Math.pow(fr, 1.25);
    if (r[1] < Math.pow(fr, 1.5) * 0.9) continue;
    const big = r[7] > 0.95 && fr > 0.15, sc = (1 - 0.55 * fr) * (big ? 2.1 : 0.7 + 0.6 * r[3]);
    const cx = -hx + e0 * TH * 1.2 + e * (0.04 + 0.7 * r[2] * r[2]), cy = (b.v0 + b.v1) / 2 / H_ - e0 * (RH / H_) * 1.6 - e * (0.02 + 0.6 * r[4] * r[4] * r[4]) + e * 0.12 * (r[8] - 0.5), cz = (b.T + BL / 2) * BAY + e * (0.1 + 4.2 * r[5] * r[5]);
    { const q = P3(cx, cy, cz), px = q[2] * hy * 2 * sc * H_; if (px < 2.6) {   // 又远又小的：不算八个角了，落一粒小方点
        if (q[0] > NV.W * 0.69 && q[1] > H_ * 0.38 || q[1] < H_ * 0.15) continue; g.fillStyle = SH[0.7]; g.globalAlpha = (1 - 0.85 * Math.pow(fr, 0.9)) * (1 - 0.9 * fadeT(cz / BAY)); g.fillRect(q[0] - px * 0.6, q[1] - px / 2, px * 1.25, px); nb++; continue; } }
    const ax = e * 2.4 * (r[6] - 0.5), ay = e * 3 * (r[8] - 0.5), az = e * 2 * (r[3] - 0.5), ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc2 = Math.sin(az);
    const rot = (x, y, z) => { let y1 = y * ca - z * sa, z1 = y * sa + z * ca; y = y1; z = z1; let x1 = x * cb + z * sb; z1 = -x * sb + z * cb; x = x1; z = z1; x1 = x * cc - y * sc2; y1 = x * sc2 + y * cc; return [x1, y1, z]; };
    for (let k = 0; k < 8; k++) { const q = rot((k & 4 ? hx : -hx) * sc, (k & 2 ? hy : -hy) * sc, (k & 1 ? hz : -hz) * sc); pts[k] = P3(cx + q[0], cy + q[1], cz + q[2]); }
    if ((pts[4][0] < -30 && pts[5][0] < -30) || (pts[0][0] > NV.W * 0.69 && pts[0][1] > H_ * 0.38) || pts[0][1] < H_ * 0.15) continue; nb++;   // 页眉那一带和名字旁边不落石头
    const axes = [rot(1, 0, 0), rot(0, 1, 0), rot(0, 0, 1)], vx = EX - cx, vy = -cy, vz = EZ - cz, op = (1 - 0.85 * Math.pow(fr, 0.9)) * (1 - 0.9 * fadeT(cz / BAY)), edge = pts[0][2] * sc > 0.3;   // 飘得越远越透；又远又小的不描边
    for (const F of F6) { const n = axes[F[4]]; if ((n[0] * vx + n[1] * vy + n[2] * vz) * F[5] <= 0) continue;
      quad(pts[F[0]], pts[F[1]], pts[F[2]], pts[F[3]]); g.fillStyle = SH[F[6]]; g.globalAlpha = op; g.fill(); if (edge) { g.globalAlpha = 0.55 * op; g.stroke(); } }
  }
  const boxes = { length: nb };
  g.globalAlpha = 1; NAVE_BOX = boxes.length;
}
const naveCp = () => { const n = CARDS.length; return n > 1 ? clamp(pos / (n - 1), 0, 1) : 0; };
/* 划动时别让墙拖慢邮票：上一回画了多久就至少歇两倍那么久再画；手停下以后补画最后一帧 */
let wallT = 0, wallCost = 0, wallTm = 0;
function wallSoon() {
  const now = performance.now(); clearTimeout(wallTm);
  if (now - wallT < Math.max(16, wallCost * 2)) { wallTm = setTimeout(() => { wallT = performance.now(); paintWall(naveCp()); }, 70); return; }
  paintWall(naveCp()); wallCost = performance.now() - now; wallT = now;
}
window.__paintWall = cp => { nvP = -1; paintWall(cp); return NAVE_BOX; };   // 自查用：量一帧要多久
function drawNaveBlue(g, v) { g.save(); g.fillStyle = COL.blue; g.globalAlpha = 0.95; g.beginPath(); g.arc(v.VX, v.VY, 1.5, 0, TAU); g.fill(); g.restore(); }
function drawBlueRoute(cv, O, P, ln) {   // 蓝的那根：从燕子头前的小点往外，先顺着小点的方向，一小段内拐进航线，再一直伸出页面
  const g = fitCanvas(cv, W, H); g.clearRect(0, 0, W, H);
  const R = rng(4242), d0 = Math.hypot(P[0] - O[0], P[1] - O[1]), at = t => [O[0] + ln.ux * t, O[1] + ln.uy * t];
  const tr = [0.749, -0.663], c = [P[0] + tr[0] * 3.6, P[1] + tr[1] * 3.6], c2 = [P[0] + tr[0] * 15, P[1] + tr[1] * 15], E = at(d0 + 30), pts = [];
  for (let i = 0; i <= 16; i++) { const s = i / 16, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), e = s * s; pts.push([a * c[0] + b * c2[0] + e * E[0], a * c[1] + b * c2[1] + e * E[1]]); }
  g.strokeStyle = COL.blue; g.fillStyle = COL.blue;
  g.globalAlpha = 0.7; g.beginPath(); for (let i = 0; i < 3; i++) { const p = pts[2 + i * 3]; dot(g, p[0], p[1], 0.36 - i * 0.04); } g.fill(); g.globalAlpha = 1;   // 接着燕子那串灰点，再落三粒蓝的
  rtDash(g, pts[12], E, 4, 2.6, { w: 0.4, a: 0.5, n: 1, j: 0.3, ov: 0.6 }, R);
  rtDash(g, E, at(ln.t1), 6.5, 3.2, { w: 0.42, a: 0.55, n: 1, j: 0.45, ov: 0.8 }, R);
}

/* ---------- 画一遍 ---------- */
let painted = 0;
function render() {
  const ord = order();
  if (ord.map(c => c.relay).join(',') !== ORDKEY) rebuild(ord);
  CARDS.forEach(updateCard);
  drawNear(); apply(); paintHead(); paintBack();
}
function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  SW = Math.round(clamp(Math.min(W * QN('sw', 0.56), (H - 120) / 1.9 / 1.85), QN('minw', 140), 226)); SH = Math.round(SW * 1.85);   // 长邮票；整沓高约 1.85 个邮票高
  CX = Math.round(W / 2);
  wgeo();
  GB = fitCanvas(FBc, W, H); GF = fitCanvas(FFc, W, H);
  const g = fitCanvas(deco, W, H); g.fillStyle = dark ? C.INK : C.PAPER; g.fillRect(0, 0, W, H);
  spots(g, W, H, 515, dark ? 'rgba(241,238,230,0.12)' : 'rgba(84,84,88,0.18)');
  {   // 航线先画在一张离屏纸上，页眉那一角擦淡，再落到底纸上
    const dp = Math.min(window.devicePixelRatio || 1, 3), off = document.createElement('canvas'); off.width = Math.round(W * dp); off.height = Math.round(H * dp);
    const og = off.getContext('2d'); og.setTransform(dp, 0, 0, dp, 0, 0);
    const nv = QN('nave', 1) ? drawNave(g, og) : null;
    const rt = drawRoutes(og);
    og.globalCompositeOperation = 'destination-out';
    const hg = og.createRadialGradient(110, 46, 20, 110, 46, 175); hg.addColorStop(0, 'rgba(0,0,0,.8)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); og.fillStyle = hg; og.fillRect(0, 0, W, 240);
    const lg = og.createRadialGradient(W - 32, 33, 6, W - 32, 33, 44); lg.addColorStop(0, 'rgba(0,0,0,.85)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); og.fillStyle = lg; og.fillRect(W - 90, 0, 90, 90);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(off, 0, 0, g.canvas.width, g.canvas.height); g.restore();
    if (nv) drawNaveBlue(g, nv);
    { const cv = $('nvw'); if (cv) { NVW = nv ? (() => { const d = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px'; const c2 = cv.getContext('2d'); c2.setTransform(d, 0, 0, d, 0, 0); return c2; })() : null; if (!nv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); nvP = -1; paintWall(naveCp()); } }
    RTB = $('rtb'); rtbY = 0; RTB.style.transform = ''; drawBlueRoute(RTB, rt.O, rt.P, rt.blue);
  }
  placeCards(); CARDS.forEach(cd => { cd.sig = ''; }); backSig = '';
  CARDS.forEach(cd => { cd.adirty = true; }); render();
  if (FLIP) drawBackCanvas(BK.querySelector('canvas'));
}
function paint() { cancelAnimationFrame(painted); painted = requestAnimationFrame(render); }

/* ---------- 寄出去：燕子起飞（往右上、掠出屏外），蓝满月从起飞的地方涨满，去聊天页 ---------- */
function send(cd) {
  if (window.__leaving || cd.flying) return;
  const r = cd.bird.getBoundingClientRect(), x = r.left + r.width * 0.48, y = r.top + r.height * 0.62;
  if (REDUCED) { pick(cd.c, x, y); return; }
  cd.flying = true;
  const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.id = 'flyer'; sv.setAttribute('aria-hidden', 'true');
  sv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:70;pointer-events:none;overflow:visible';
  const gEl = document.createElementNS('http://www.w3.org/2000/svg', 'g'), pth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pth.setAttribute('fill', dark ? C.PAPER : C.INK); gEl.appendChild(pth); sv.appendChild(gEl); document.body.appendChild(sv);
  cd.bird.querySelector('.perch').style.visibility = 'hidden';
  const t0 = performance.now(), D = 380; let went = false;
  const tick = now => {
    const p = clamp((now - t0) / D, 0, 1), e = p * p * (1.6 - 0.6 * p);
    const bx = x + 150 * e + 14 * Math.sin(p * PI) * 0.4, by = y - 190 * Math.pow(p, 1.15) + 10 * Math.sin(p * PI), sc = 0.15 * (1 + 0.45 * p), ph = (0.18 + p * 2.6) % 1;
    pth.setAttribute('d', birdD(ph)); gEl.setAttribute('transform', `translate(${f2(bx)} ${f2(by)}) rotate(${f2(-34 - 10 * p)}) scale(${sc.toFixed(3)})`);
    sv.style.opacity = String(1 - sstep(0.82, 1, p));
    if (!went && p > 0.3) { went = true; pick(cd.c, x, y); }
    if (p < 1) requestAnimationFrame(tick); else sv.remove();
  };
  requestAnimationFrame(tick);
}

/* ---------- 写回 Nyx 的选择（同 contacts.html 的 pick()），去聊天页（同 people.js） ---------- */
function pick(c, x, y) {
  if (window.__leaving || !c) return;
  if (LIVE) {
    if (c.group) { lset('nyx_relay', c.relay); lset('nyx_chat_key', c.key || ls('nyx_key')); lset('nyx_ai', c.name || '一家'); }
    else if (c.relay === HOME) { lset('nyx_relay', null); lset('nyx_chat_key', null); lset('nyx_ai', null); if (c.key) lset('nyx_key', c.key); }
    else { lset('nyx_relay', c.relay); lset('nyx_chat_key', c.key || ls('nyx_key')); lset('nyx_ai', c.name); }
  }
  CUR = c.relay;
  window.__picked = c.relay;
  goChat(x, y);
}
function goChat(x, y) {
  window.__leaving = true;
  const q = []; if (!LIVE) q.push('demo=1'); if (dark) q.push('dark=1');
  const href = 'chat.html' + (q.length ? '?' + q.join('&') : '');
  ssSet('niao-hand', { to: 'chat', t: Date.now(), x, y, c: dark ? C.INK : C.PAPER, slot: info.slot, morph: info.morph });
  const vw = innerWidth, vh = innerHeight, Rm = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) * 1.06, D = REDUCED ? 200 : 620;
  const cv = document.createElement('canvas'); cv.id = 'veil'; cv.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;display:block'; document.body.appendChild(cv);
  const g = fitCanvas(cv, vw, vh), t0 = performance.now(), fill = dark ? C.INK : C.PAPER;
  let held = 0;
  const tick = now => { const p = clamp((now - t0) / D, 0, 1), e = smoother(p), r = 7 * Math.pow(Rm / 7, e);
    g.clearRect(0, 0, vw, vh); iris(g, x, y, r, sstep(0.05, 0.32, p) * Math.max(r * 0.86, r - 11), fill, vw, vh);
    if (p < 1 || ++held < 3) requestAnimationFrame(tick); else location.href = href; };
  requestAnimationFrame(tick);
}
window.addEventListener('pageshow', ev => { if (ev.persisted) { window.__leaving = false; stage.style.opacity = ''; const v = document.querySelector('#veil[style*="z-index: 60"]'); if (v) v.remove(); CARDS.forEach(cd => { cd.flying = false; const p = cd.bird.querySelector('.perch'); if (p) p.style.visibility = ''; }); } });

/* ---------- 起步 ---------- */
const info = homeInfo('people', 0, dark ? 1 : 0);
$('back').addEventListener('click', () => { commit(); leaveHome(info, $('back')); });
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && LIVE) probeAll(); });
if (LIVE) setInterval(() => { if (!document.hidden && !window.__leaving) probeAll(); }, 30000);
BK.inert = true;
function loadConfig() {   // 同聊天页：Nyx 的 config.js 给第一只的地址和名字；?demo=1 时不装
  return new Promise(ok => { if (!LIVE || window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
}
function fontsReady() {   // 邮票上的拉丁小字画在画布里：等字体到了再画（最多等 1.5 秒）
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const want = ['500 6px "Cormorant Garamond"', 'italic 500 11px "Cormorant Garamond"'].map(f => document.fonts.load(f, 'ANVLVS N°03').catch(() => 0));
  return Promise.race([Promise.all(want), new Promise(r => setTimeout(r, 1500))]);
}
setupGrain();
loadConfig().then(fontsReady).then(() => {
  loadList();
  layout();
  probeAll();
  revealIn(info, stage, () => { window.__revealed = true; });
  window.__ready = true; window.__settled = true;
});
window.__people = {
  state: () => ({ cur: CUR, home: HOME, people: PEOPLE.map(c => ({ name: c.name, shown: shown(c), relay: c.relay, k: stateOf(c).k, t: stateOf(c).t, kind: KINDS[KIND.get(c.relay) || 0], remark: remarkOf(c) })),
    group: GROUP && { name: GROUP.name, relay: GROUP.relay, members: GROUP.members || [] }, loop: !!(GROUP && CARDS.some(cd => cd.c === GROUP)),
    order: ORDER.map(c => c.relay), idx, pos, viewing: CARDS[idx] && CARDS[idx].c.relay, flipped: FLIP && FLIP.c.relay, sync: syncNote, editing, geo: { SW, SH, CX, CY, STEP: WG.step, top: WG.top, hub: [WG.hub[0], WG.hub[1]], hy0: WG.hy0, near: NEAR, routes: ROUTES, rtbY },
    drawn: CARDS.filter(cd => cd.el.hidden && cd.al > 0.01).map(cd => cd.i), arts: CARDS.filter(cd => cd.art).length }),
  quad: quadOf,
  layout, goTo, flip: () => { const cd = CARDS[idx]; if (cd) flip(cd); }, unflip,
  KINDS
};
})();
