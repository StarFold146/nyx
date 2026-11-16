/* 联系人页 · A 版「铅笔草稿的小星球」（11/13，从 people.js 第三版拷来只改样子；数据、探测、点一位进聊天、演示、提示都没动）。
   一人一行往下排。行首一颗很小的星球（直径约 20px）：hand() 那支铅笔画的轮廓（一圈加半圈错开的重描），
   暗面几根顺着球面走的弧，再加各自一样特征（环形坑、交叉排线、月牙、两根环、纬向条带、裂纹、极冠）；
   旁边留着没擦的作图痕迹：圆心小十字、一小段轨道弧和弧上一粒点、一两粒星屑、一根极短的引线接到左边测绘线上。
   画法按联系人的 relay 哈希定，跟列表顺序无关；撞了就顺延。有真头像时嵌在星球中心的小圆里。
   左边一根贯穿的测绘线（同聊天页那根：蓝灰细线、小刻度、左边压着序号小字）；当前那一行线上一颗实心蓝节点，名字是蓝的。
   醒着：星球画全；睡着：只剩一圈更淡的虚线轮廓、名字变灰；在忙：星球外一圈铅笔小轨道，一颗实心蓝点慢慢走（减少动态时不动）。整页的蓝只这两处（加测绘线本身）。
   群单独一行，行首两三颗更小的铅笔圈用一根铅笔线连成小星座，名字后面极小的人数。底纹是一圈圈很淡的铅笔轨道，圆心在屏外右边，扫过整张名单。
   数据同 Nyx 联系人页（../contacts.html）：localStorage「nyx_contacts」[{name, relay, key, avatar?}]，没有就用 config.js 的第一只；
     醒没醒 GET <relay>/healthz 的 plugin_subs > 0（不带钥匙）；多久以前 GET <relay>/app/status 的 last_msg_age_sec；
     忙不忙 GET <relay>/app/busy 的 state（同聊天页 pollBusy，群不问）；群：列表里 /g 结尾的那条，没有就看第一只的 /g/healthz 有两位以上 members。
   点一位：照 contacts.html 的 pick() 写回 nyx_relay / nyx_chat_key / nyx_ai（点第一只就清掉这三个、把钥匙写回 nyx_key），
     然后蓝满月从那颗星球涨满，去 chat.html（那边从同一个圆心揭开）。
   ?demo=1 示例数据，一个请求都不发、不动 localStorage。?dark=1 墨黑底。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, smoother, sstep, rng, Q, REDUCED, dot, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome, iris, ssSet } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco'), list = $('list'), note = $('note');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('ta_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（ta_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lset = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
const f2 = v => v.toFixed(2);

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
function avOf(c) {   // 同聊天页 avOfContact：联系人自带的头像，或 Nyx 个人信息页存的 nyx_avatar{后缀}；都没有就不嵌，星球只画图案
  if (!LIVE || !c.relay) return '';
  if (c.avatar && (/^data:image\//.test(c.avatar) || /^\/(?!\/)/.test(c.avatar))) return c.avatar;
  const v = ls('nyx_avatar' + sufOf(c.relay)); if (v && (/^data:image\//.test(v) || /^\/(?!\/)/.test(v))) return v;
  return '';
}

/* ---------- 数据 ---------- */
let HOME = '/relay', CUR = null, PEOPLE = [], GROUP = null, keyless = false;
function loadList() {
  if (!LIVE) {
    HOME = DEMO.home; CUR = DEMO.cur;
    PEOPLE = DEMO.people.map((c, i) => Object.assign({ i }, c));
    GROUP = Object.assign({ group: true, pos: PEOPLE.length }, DEMO.group);
  } else {
    const N = window.NYX || {};
    HOME = N.relay || '/relay';
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
function call(base, k, path) {
  return fetch(base + path, { headers: { 'Authorization': 'Bearer ' + k }, cache: 'no-store' }).then(r => {
    if (r.status === 401 || r.status === 403) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
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
    health(G).then(h => { if (h && h.members && h.members.length >= 2 && !GROUP) { G.members = h.members; G.off = !(h.plugin_subs > 0); GROUP = G; layout(); probe(G); } }).catch(() => {});
  }
}

/* ---------- 文字 ---------- */
function short(sec) { if (sec == null || isNaN(sec)) return ''; const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? '刚刚' : m < 60 ? m + 'm' : h < 24 ? h + 'h' : d < 60 ? d + 'd' : '很久'; }
function stateOf(c) {
  if (c.off == null) return { k: 'wait', t: '…' };
  if (c.err) return { k: 'off', t: '没应门' };
  if (c.auth) return { k: c.off ? 'off' : 'on', t: '钥匙不认' };
  const a = short(c.age);
  if (c.off) return { k: 'off', t: '睡着' + (a ? ' · ' + a : '') };
  if (c.busy) return { k: 'busy', t: '在忙 · ' + String(c.busy).slice(0, 12) };
  return { k: 'on', t: '醒着' + (a ? ' · ' + a : '') };
}

/* ---------- 画法绑人：按 relay 的哈希挑，撞了顺延（按 relay 排序处理，跟列表顺序无关） ---------- */
const KINDS = ['conc', 'hatch', 'cres', 'ring', 'grat', 'phase', 'tick'];
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

/* ---------- 铅笔：主页 hand() 的 SVG 版。每笔切成小段；同样粗淡的小段并进一条 path ---------- */
const INK = 'var(--fg)', PENC = 'var(--fg2)';
const P = pts => 'M' + pts.map(p => f2(p[0]) + ',' + f2(p[1])).join('L');
const ln = (x0, y0, x1, y1) => `M${f2(x0)},${f2(y0)}L${f2(x1)},${f2(y1)}`;
function pencil(seed) {
  const R = rng(seed), B = new Map();
  function line(pts, o) {
    o = o || {}; const w = o.w || 0.4, al = o.a || 0.4, n = o.n || 1, jit = o.j == null ? 0.18 : o.j, ov = o.ov == null ? 1 : o.ov, sg = o.sg || 0.35;
    const m = pts.length, Ls = [0]; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const L = Ls[m - 1]; if (!(L > 0.4)) return;
    for (let ps = 0; ps < n; ps++) {
      let s0 = -ov * R(), s1 = L + ov * R();
      if (ps) { const span = 0.35 + 0.5 * R(), st = R() * (1 - span); s0 = L * st; s1 = L * (st + span); }   // 后几遍只描一截
      const off = (R() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = R() * TAU, p2 = R() * TAU, p3 = R() * TAU, f1 = TAU / ((70 + R() * 90) * sg), f2_ = TAU / ((16 + R() * 20) * sg), f3 = TAU / ((36 + R() * 60) * sg), pa = ps ? 0.55 + 0.35 * R() : 1;
      let s = s0, i = 1, cur = [], acc = 0, segL = (10 + R() * 16) * sg;
      for (let guard = 0; guard < 4000; guard++) {
        while (i < m - 1 && Ls[i] < s) i++;
        const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
        const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * f2_ + p2));
        cur.push([a[0] + tx * f - ty * d, a[1] + ty * f + tx * d]);
        if (acc >= segL || s >= s1) {
          if (cur.length >= 2) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * R());
            const ww = Math.round(Math.min(0.6, w * (0.55 + 0.7 * pr)) * 20) / 20, aa = Math.floor(Math.min(0.7, al * pa * (0.5 + 0.75 * pr)) * 25) / 25, key = ww.toFixed(2) + '|' + aa.toFixed(2);
            if (aa > 0) B.set(key, (B.get(key) || '') + P(cur)); }
          if (s >= s1) break; cur = cur.slice(-1); acc = 0; segL = (10 + R() * 16) * sg;
        }
        const stp = Math.max(0.01, Math.min(1.1, s1 - s)); s += stp; acc += stp;
      }
    }
  }
  function flush(cls, col) {   // 把攒下的笔触吐成一组 path
    let s = ''; for (const [k, d] of B) { const [w, a] = k.split('|'); s += `<path d="${d}" stroke-width="${w}" stroke-opacity="${a}"/>`; }
    B.clear();
    return s ? `<g class="${cls}" fill="none" stroke="${col || INK}" stroke-linecap="round" stroke-linejoin="round">${s}</g>` : '';
  }
  return { R, line, flush };
}
const arcPts = (cx, cy, rx, ry, a0, a1, rot, st) => { const c = Math.cos(rot || 0), s = Math.sin(rot || 0), n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / (st || 0.9))), out = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n, x = rx * Math.cos(t), y = ry * Math.sin(t); out.push([cx + x * c - y * s, cy + x * s + y * c]); } return out; };
const rotP = (pts, th) => { const c = Math.cos(th), s = Math.sin(th); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };

/* ---------- 一颗铅笔速写的小星球（直径 17–20px）。
   光从左上来；轮廓一遍圈加半遍错开的重描，暗面几根顺着球面走的弧，再加各自的一样特征。
   旁边留着作图痕迹：圆心一个小十字、外面一小段轨道弧和弧上一粒点、一两粒星屑。
   睡着/敲门中：只剩一圈更淡的虚线轮廓（带环的连环一起虚掉）和圆心十字。 ---------- */
const OUTL = { w: 0.48, a: 0.64, j: 0.12, ov: 1.6 }, SHD = { w: 0.34, a: 0.52, j: 0.1, ov: 0.9 }, FEAT = { w: 0.36, a: 0.56, j: 0.08, ov: 0.5 }, AUX = { w: 0.3, a: 0.36, j: 0.08, ov: 0.8 };
function planetSVG(o) {   // o: {r, kind, seed, id, st, av, S}
  const K = KINDS[o.kind], r = K === 'ring' ? o.r * 0.84 : o.r, pn = pencil(o.seed), R = pn.R, line = o.st === 'off' || o.st === 'wait';
  const th = (32 + R() * 22) * PI / 180, LF = pts => rotP(pts, th);   // 光坐标系：光在 -x，转 th 到左上
  const ringRot = (-20 + (R() - 0.5) * 10) * PI / 180, RM = [1.42, 1.58], RYF = 0.27;
  let body = '', over = '', rim = '';
  const crater = (cx, cy, s, full) => {   // 小坑：一圈，朝光那侧一道内弧
    const c = rotP([[cx, cy]], th)[0];
    pn.line(arcPts(c[0], c[1], s, s * 0.8, R() * TAU, R() * TAU + TAU + 0.5, th), FEAT);
    if (full) pn.line(arcPts(c[0], c[1], s * 0.7, s * 0.55, PI * 0.6, PI * 1.35, th), Object.assign({}, FEAT, { a: 0.4 }));
  };
  if (!line) {
    // 明暗：交界线往暗边一根根松弧，步子越走越小；带极冠的不往冠里画
    const kt = { conc: 0.14, hatch: 0.3, cres: -0.4, ring: 0.12, grat: 0.12, phase: 0.02, tick: 0.18 }[K];
    let k = kt + 0.05 + R() * 0.08;
    for (let q = 0; k < 0.95 && q < 8; q++) {
      const ya = K === 'tick' ? -r * (0.42 + R() * 0.1) : -r * (0.5 + R() * 0.45), yb = r * (0.62 + R() * 0.36), pts = [];
      for (let j = 0; j <= 12; j++) { const y = ya + (yb - ya) * j / 12, h = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([k * h, y]); }
      pn.line(LF(pts), Object.assign({}, SHD, { a: SHD.a * (0.7 + 0.45 * k) }));
      k += (0.08 + R() * 0.1) * (1.2 - k * 0.7);
    }
    // 暗边上几根短斜笔，顺一个方向，有的出了轮廓
    const nh = 5 + (R() * 3 | 0), dv = [Math.cos(th + 1.25), Math.sin(th + 1.25)];
    for (let q = 0; q < nh; q++) { const ph = -0.75 + q * (1.6 / nh) + R() * 0.15, rr = r * (0.82 + R() * 0.08), c = rotP([[Math.cos(ph) * rr, Math.sin(ph) * rr]], th)[0], l = 1.2 + R() * 1.1;
      pn.line([[c[0] - dv[0] * l, c[1] - dv[1] * l], [c[0] + dv[0] * l * 1.1, c[1] + dv[1] * l * 1.1]], Object.assign({}, SHD, { a: 0.46, ov: 0.3 })); }
    body += pn.flush('shade');
    // 各自的特征
    switch (K) {
      case 'conc':   // 亮面一个环形坑（两圈、芯里一粒），下面一颗小的
        crater(-0.36 * r, -0.14 * r, 0.27 * r, true); crater(-0.05 * r, 0.52 * r, 0.1 * r, false);
        { const c = rotP([[-0.36 * r, -0.14 * r]], th)[0]; body += `<circle class="pt" cx="${f2(c[0])}" cy="${f2(c[1])}" r=".42" fill="${INK}" opacity=".5"/>`; }
        break;
      case 'hatch': {   // 暗面压一层交叉排线（只在交界线以外）
        const xc = 0.28 * r, a2 = th + 2.1, d = [Math.cos(a2), Math.sin(a2)], nrm = [-d[1], d[0]];
        for (let off = -r * 0.85; off < r * 0.9; off += r * (0.2 + R() * 0.09)) {
          const h = Math.sqrt(Math.max(0, r * r - off * off)); if (h < 1) continue;
          const seg = []; for (let j = 0; j <= 10; j++) { const t = -h + 2 * h * j / 10, x = nrm[0] * off + d[0] * t, y = nrm[1] * off + d[1] * t, l = rotP([[x, y]], -th)[0]; if (l[0] > xc * Math.sqrt(Math.max(0, r * r - l[1] * l[1])) / r) seg.push([x, y]); }
          if (seg.length >= 3) { const cut = seg.slice(R() < 0.5 ? 1 : 0, seg.length - (R() < 0.5 ? 1 : 0)); pn.line(cut, Object.assign({}, SHD, { a: 0.3, ov: 0.4 })); }
        }
        crater(-0.44 * r, 0.08 * r, 0.17 * r, false);
        break; }
      case 'cres':   // 月牙：大半在暗里，亮的一弯上两颗小坑
        crater(-0.7 * r, -0.28 * r, 0.13 * r, true); crater(-0.64 * r, 0.4 * r, 0.085 * r, false);
        break;
      case 'grat': {   // 纬向条带：两道带子，下面那道里几根竖的短笔
        const ax = (12 + (R() - 0.5) * 14) * PI / 180, lat = (y0, tl) => { const s = Math.sqrt(Math.max(0, r * r - y0 * y0)), pts = []; for (let j = 0; j <= 16; j++) { const t = PI * j / 16; pts.push([s * Math.cos(t), y0 + tl * s * Math.sin(t)]); } return pts; };
        const A = lat(-0.44 * r, 0.22), B = lat(-0.3 * r, 0.22), C2 = lat(0.16 * r, 0.22), D = lat(0.3 * r, 0.22);
        [A, B, C2, D].forEach((L, j) => pn.line(rotP(L, ax), Object.assign({}, FEAT, { a: j % 2 ? 0.36 : 0.44 })));
        for (let j = 4; j <= 12; j += 2 + (R() * 2 | 0)) pn.line(rotP([C2[j], D[j]], ax), Object.assign({}, SHD, { a: 0.32, ov: 0.2 }));
        break; }
      case 'phase': {   // 亮面两道裂纹，一折一叉
        for (let q = 0; q < 2; q++) {
          let x = -r * (0.5 + R() * 0.2), y = -r * 0.35 + q * r * 0.6; const pts = [[x, y]], a0 = (R() - 0.5) * 1.1 + (q ? PI * 0.15 : -PI * 0.1);
          for (let j = 0; j < 4; j++) { const a = a0 + (R() - 0.5) * 1.5; x += Math.cos(a) * r * 0.15; y += Math.sin(a) * r * 0.15; pts.push([x, y]); }
          const L2 = LF(pts); pn.line(L2, Object.assign({}, FEAT, { ov: 0.2, j: 0.04 })); const m = L2[2]; pn.line([m, [m[0] + (R() - 0.5) * r * 0.25, m[1] + r * 0.16]], Object.assign({}, FEAT, { a: 0.36, ov: 0.1, j: 0.03 }));
        }
        break; }
      case 'tick': {   // 极冠：顶上一道断续的纬线围出一块白，边上一排小刻
        const ax = (-12 + (R() - 0.5) * 14) * PI / 180, y0 = -0.56 * r, s = Math.sqrt(r * r - y0 * y0);
        for (let j = 0; j < 6; j++) { const t0 = PI * j / 6 + 0.06, t1 = t0 + PI / 6 * 0.55, pts = []; for (let q = 0; q <= 4; q++) { const t = t0 + (t1 - t0) * q / 4; pts.push([s * Math.cos(t), y0 + 0.24 * s * Math.sin(t)]); } pn.line(rotP(pts, ax), Object.assign({}, FEAT, { ov: 0.1, a: 0.42 })); }
        for (let j = 0; j < 9; j++) { const a = -PI * 0.86 + j * PI * 0.72 / 8 + ax, l = j % 4 === 0 ? 0.26 * r : 0.14 * r; pn.line([[Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * (r - l), Math.sin(a) * (r - l)]], Object.assign({}, FEAT, { a: 0.4, ov: 0.15, j: 0.02 })); }
        break; }
    }
    body += pn.flush('feat');
  }
  // 轮廓：醒着是一圈加半圈错开的重描；睡着是一圈淡虚线
  if (line) rim = `<circle class="rim" r="${f2(r)}" fill="none" stroke="${PENC}" stroke-width=".4" stroke-dasharray=".9 1.5" opacity=".6"/>`;
  else {
    const a0 = R() * TAU, a1 = R() * TAU, dx = (R() - 0.5) * 0.7, dy = (R() - 0.5) * 0.7;
    pn.line(arcPts(0, 0, r, r * (0.985 + R() * 0.03), a0, a0 + TAU + 0.3 + R() * 0.3, R()), OUTL);
    pn.line(arcPts(dx, dy, r + 0.3, r + 0.2, a1, a1 + PI * (0.7 + R() * 0.6)), Object.assign({}, OUTL, { a: 0.3, w: 0.36 }));
    rim = pn.flush('rim');
  }
  // 带环的：两根细椭圆弧，后半截被球挡住，前半截压在球上（底下垫一道纸色把球的线让开）
  if (K === 'ring') {
    if (line) over = RM.map(m => `<ellipse rx="${f2(m * r)}" ry="${f2(m * r * RYF)}" transform="rotate(${f2(ringRot * 180 / PI)})" fill="none" stroke="${PENC}" stroke-width=".35" stroke-dasharray=".9 1.5" opacity=".5"/>`).join('');
    else {
      let gap = '';
      RM.forEach((m, j) => {
        const pts = arcPts(0, 0, m * r, m * r * RYF, 0, TAU, ringRot, 0.5), runs = [[]], fr = [];
        pts.forEach((p, q) => { const t = q / (pts.length - 1) * TAU, back = Math.sin(t) < 0, hid = back && Math.hypot(p[0], p[1]) < r + 0.5; if (hid) { if (runs[runs.length - 1].length) runs.push([]); } else runs[runs.length - 1].push(p); if (!back && Math.hypot(p[0], p[1]) < r + 0.8) fr.push(p); });
        runs.filter(x => x.length > 2).forEach(x => pn.line(x, Object.assign({}, FEAT, { a: j ? 0.4 : 0.48, ov: 0.3 })));
        if (fr.length > 1) gap += P(fr);
      });
      over = `<path d="${gap}" fill="none" stroke="var(--bg)" stroke-width="1.5" stroke-linecap="round"/>` + pn.flush('ringl');
    }
  }
  // 作图痕迹：圆心十字、一小段轨道弧和弧上一粒点、一两粒星屑（在忙时轨道换成卫星那一圈）
  const cx0 = (R() - 0.5) * 0.5, cy0 = (R() - 0.5) * 0.5, ca = 1.7;
  pn.line([[cx0 - ca, cy0], [cx0 + ca, cy0]], Object.assign({}, AUX, { ov: 0.2, j: 0.02, a: 0.42 })); pn.line([[cx0, cy0 - ca], [cx0, cy0 + ca]], Object.assign({}, AUX, { ov: 0.2, j: 0.02, a: 0.42 }));
  const cross = pn.flush('mk cx', PENC);   // 圆心十字压在球面上面（球底下垫着纸色）
  const orR = K === 'ring' ? RM[1] * r + 2.4 : r + 4, oa0 = -PI * (0.36 + R() * 0.08), oa1 = oa0 + PI * (0.34 + R() * 0.14);   // 右上那一侧
  let dots = '';
  if (o.st !== 'busy') {
    pn.line(arcPts(0, 0, orR, orR, oa0, oa1), Object.assign({}, AUX, { a: line ? 0.3 : 0.48, ov: 1.4 }));
    const t = oa0 + (oa1 - oa0) * (0.62 + R() * 0.25); dots += `<circle cx="${f2(Math.cos(t) * orR)}" cy="${f2(Math.sin(t) * orR)}" r=".62" fill="${PENC}" opacity="${line ? '.4' : '.7'}"/>`;
  }
  for (let q = 0; q < 1 + (R() < 0.5 ? 1 : 0); q++) { const t = PI * (0.2 + R() * 0.5), d = orR + 2.5 + R() * 3; dots += `<circle cx="${f2(Math.cos(t) * d)}" cy="${f2(Math.sin(t) * d)}" r="${f2(0.3 + R() * 0.25)}" fill="${PENC}" opacity=".55"/>`; }
  const aux = `<g class="aux">${pn.flush('mk', PENC)}${dots}</g>`;
  let sat = '';
  if (o.st === 'busy') {   // 在忙：一圈铅笔小轨道，一颗实心蓝点沿它慢慢走（减少动态时停着）
    const rx = K === 'ring' ? RM[1] * r + 2.6 : r + 5, ry = rx * (K === 'ring' ? 0.62 : 0.76), rot = -24, path = `M${f2(rx)},0A${f2(rx)},${f2(ry)} 0 1 1 ${f2(-rx)},0A${f2(rx)},${f2(ry)} 0 1 1 ${f2(rx)},0`;
    sat = `<g class="sat"><g transform="rotate(${rot})"><path class="orb" d="${path}" fill="none" stroke="${PENC}" stroke-width=".42" stroke-dasharray=".1 1.5" stroke-linecap="round" opacity=".8"/><circle class="moon" r="1.3" fill="var(--lb)" ${REDUCED ? `cx="${f2(-rx * 0.72)}" cy="${f2(ry * 0.7)}"` : ''}>${REDUCED ? '' : `<animateMotion dur="40s" repeatCount="indefinite" path="${path}" begin="${-(o.seed % 30)}s"/>`}</circle></g></g>`;
  }
  const ar = r * 0.42, avEl = o.av ? `<defs><clipPath id="${o.id}a"><circle r="${f2(ar)}"/></clipPath></defs><circle r="${f2(ar + 0.9)}" fill="var(--bg)"/>
    <image href="${o.av}" x="${f2(-ar)}" y="${f2(-ar)}" width="${f2(ar * 2)}" height="${f2(ar * 2)}" clip-path="url(#${o.id}a)" preserveAspectRatio="xMidYMid slice"/><circle r="${f2(ar)}" fill="none" stroke="${INK}" stroke-width=".3" opacity=".5"/>` : '';
  const S = o.S;
  return `<svg viewBox="${-S / 2} ${-S / 2} ${S} ${S}" width="${S}" height="${S}" aria-hidden="true">${aux}
    <g class="body"><circle r="${f2(r + 0.6)}" fill="var(--bg)"/>${body}${rim}${over}${avEl}</g>${cross}${sat}</svg>`;
}
const PS = 50;   // 每颗星球那块 svg 的边长
function svgFor(c, r, id) {
  const st = stateOf(c).k, kind = KIND.get(c.relay) || 0;
  return planetSVG({ r, kind, seed: hstr(c.relay), id, st, av: avOf(c), S: PS });
}
/* 底纹用的画布铅笔（同主页 hand()） */
function hand(g, pts, o, R) {
  o = o || {}; const w = o.w || 0.5, al = o.a || 0.4, n = o.n || 2, jit = o.j == null ? 0.6 : o.j, ov = o.ov == null ? 3 : o.ov;
  const m = pts.length, Ls = [0]; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8)) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * R(), s1 = L + ov * R();
    if (ps) { const span = 0.4 + 0.6 * R(), st = R() * (1 - span); s0 = L * st; s1 = L * (st + span); }
    const off = (R() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = R() * TAU, p2 = R() * TAU, p3 = R() * TAU, f1 = TAU / (70 + R() * 90), f2_ = TAU / (16 + R() * 20), f3 = TAU / (36 + R() * 60), pa = ps ? 0.5 + 0.4 * R() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = 10 + R() * 16;
    for (let guard = 0; guard < 8000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * f2_ + p2));
      cur.push([a[0] + tx * f - ty * d, a[1] + ty * f + tx * d]);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 2) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * R());
          g.globalAlpha = Math.min(0.95, al * pa * (0.5 + 0.75 * pr)); g.lineWidth = w * (0.55 + 0.7 * pr); g.beginPath(); g.moveTo(cur[0][0], cur[0][1]); for (let q = 1; q < cur.length; q++) g.lineTo(cur[q][0], cur[q][1]); g.stroke(); }
        if (s >= s1) break; cur = cur.slice(-1); acc = 0; segL = 10 + R() * 16;
      }
      const stp = Math.max(0.01, Math.min(3.2, s1 - s)); s += stp; acc += stp;
    }
  }
  g.globalAlpha = 1;
}

/* ---------- 一人一行 ---------- */
let W = 0, H = 0;
const LX = 24, PX = 58, ROWH = 56, PR = 11;   // 测绘线的横坐标、星球圆心横坐标、行高、星球半径
const ROWS = new Map();   // relay → 这一行
let gRow = null;
function order() {   // 群照原数据里的位置插进去
  const out = PEOPLE.slice();
  if (GROUP) out.splice(clamp(GROUP.pos == null ? out.length : GROUP.pos, 0, out.length), 0, GROUP);
  return out;
}
function buildRow(c, j) {
  const st = stateOf(c), cur = c.relay === CUR;
  let b = c.group ? gRow : ROWS.get(c.relay);
  if (!b) {
    b = document.createElement('button'); b.type = 'button'; b.className = c.group ? 'grp' : 'pl'; b.dataset.relay = c.relay;
    b.addEventListener('click', () => { const r = (b.querySelector('svg') || b).getBoundingClientRect(); pick(c, r.left + r.width / 2, r.top + r.height / 2); });
    if (c.group) gRow = b; else ROWS.set(c.relay, b);
  }
  list.appendChild(b);   // 按顺序重排
  b.classList.toggle('cur', cur); b.classList.toggle('off', st.k === 'off'); b.classList.toggle('busy', st.k === 'busy'); b.classList.toggle('wait', st.k === 'wait');
  if (cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  if (c.group) {
    const ms = c.members || [], n = ms.length;
    b.setAttribute('aria-label', (c.name || '一家') + '，' + n + ' 位' + (st.k === 'off' ? '，' + st.t : c.age != null ? '，' + short(c.age) : '') + (cur ? '，正在聊' : ''));
    const sig = ['g', ms.join(','), st.k].join('|');
    if (b.dataset.sig !== sig) { b.dataset.sig = sig; b.innerHTML = groupSVG(ms, st.k) + `<span class="tag"><b></b><i></i></span><span class="no" aria-hidden="true"></span>`; }
    b.querySelector('.tag b').innerHTML = esc(c.name || '一家') + (n ? `<small>${n} 位</small>` : '');
    b.querySelector('.tag i').textContent = st.k === 'wait' ? '…' : st.k === 'off' ? st.t : c.age != null ? '上一句 · ' + short(c.age) : '';
  } else {
    b.setAttribute('aria-label', c.name + '，' + st.t.replace(' · ', '，') + (cur ? '，正在聊' : ''));
    const sig = [st.k, avOf(c).length].join('|');
    if (b.dataset.sig !== sig) { b.dataset.sig = sig; b.innerHTML = svgFor(c, PR, 'p' + c.i) + `<span class="tag"><b></b><i></i></span><span class="no" aria-hidden="true"></span>`; }
    b.querySelector('.tag b').textContent = c.name;
    b.querySelector('.tag i').textContent = st.t;
  }
  b.querySelector('.no').textContent = ROMAN[j] || '';
}
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
/* 群：两三颗更小的铅笔圈，一根铅笔线连成小星座（线断在每颗外面一点）；每颗只有轮廓加一笔明暗 */
function groupSVG(ms, k) {
  const n = Math.max(2, Math.min(3, ms.length || 3)), line = k === 'off' || k === 'wait', pn = pencil(4241 + n), S = PS;
  const pos = n === 2 ? [[-7.5, 3, 4], [7.5, -3.5, 3.5]] : [[-11.5, 4, 3.8], [-0.5, -5.5, 3.1], [11, 2.5, 4.3]];
  for (let j = 0; j + 1 < pos.length; j++) {
    const [x0, y0, r0] = pos[j], [x1, y1, r1] = pos[j + 1], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    pn.line([[x0 + ux * (r0 + 1.7), y0 + uy * (r0 + 1.7)], [x1 - ux * (r1 + 1.7), y1 - uy * (r1 + 1.7)]], { w: 0.32, a: line ? 0.26 : 0.42, j: 0.06, ov: 0.6 });
  }
  let s = pn.flush('lk', PENC), dots = '';
  pos.forEach(([x, y, r], j) => {
    if (line) { s += `<circle class="rim" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${PENC}" stroke-width=".38" stroke-dasharray=".8 1.3" opacity=".6"/>`; return; }
    const a0 = pn.R() * TAU;
    pn.line(arcPts(x, y, r, r, a0, a0 + TAU + 0.35), { w: 0.44, a: 0.64, j: 0.06, ov: 0.8 });
    const th = 0.75, pts = []; for (let q = 0; q <= 8; q++) { const yy = -r * 0.7 + r * 1.5 * q / 8, h = Math.sqrt(Math.max(0, r * r - yy * yy)); pts.push([0.5 * h, yy]); }
    pn.line(rotP(pts, th).map(p => [p[0] + x, p[1] + y]), { w: 0.4, a: 0.66, j: 0.04, ov: 0.6 });
  });
  s += pn.flush('body');
  // 星座边上一个小十字、两粒星屑
  pn.line([[2.6, 9.6], [6, 9.6]], AUX); pn.line([[4.3, 7.9], [4.3, 11.3]], AUX);
  dots = `<circle cx="-4.5" cy="-9" r=".45" fill="${PENC}" opacity=".6"/><circle cx="16" cy="-6" r=".35" fill="${PENC}" opacity=".5"/>`;
  return `<svg viewBox="${-S / 2} ${-S / 2} ${S} ${S}" width="${S}" height="${S}" aria-hidden="true"><g class="aux">${pn.flush('mk', PENC)}${dots}</g><g class="body">${s}</g></svg>`;
}
/* 左边一根测绘线（同聊天页那根：蓝灰细线、小刻度）：每一行一根极短的铅笔引线接到星球；当前那一行线上一颗实心蓝节点，别的行只一道短横。
   线顶一个十字圈水准点，线尾两道短横收住；序号小字压在线左边，像聊天页的楼层 */
function drawSurvey() {
  const svy = $('svy'), rows = [...list.querySelectorAll('.pl, .grp')];
  if (!rows.length) { svy.innerHTML = ''; return; }
  const ys = rows.map(r => r.offsetTop + ROWH / 2), y0 = ys[0] - 34, y1 = ys[ys.length - 1] + 30, Hh = y1 + 40, pn = pencil(9090 + rows.length);
  let tk = '', k = 0; for (let y = y0 + 9; y < y1 - 2; y += 7, k++) { const l = k % 4 === 0 ? 3 : 1.6; tk += `M${LX},${f2(y + 0.5)}H${f2(LX + l)}`; }
  let nd = '', blue = '';
  rows.forEach((r, j) => {
    const y = ys[j] + 0.5, isG = r.classList.contains('grp'), x1 = isG ? PX - 17 : PX - PR - 3.2;
    pn.line([[LX + 2, y + 0.2], [x1, y - 0.15]], { w: 0.34, a: 0.42, j: 0.06, ov: 1.2 });
    if (r.classList.contains('cur')) blue += `<circle cx="${LX}" cy="${f2(y)}" r="2.1" fill="var(--lb)"/>`;
    else nd += `M${LX - 3.5},${f2(y)}H${LX + 1.2}`;
  });
  svy.setAttribute('width', 60); svy.setAttribute('height', Hh); svy.setAttribute('viewBox', `0 0 60 ${Hh}`);
  svy.innerHTML = `<g class="ln"><path d="M${LX},${y0}V${y1}" stroke="var(--lb)" stroke-width=".5"/><path d="${tk}" stroke="var(--lb)" stroke-width=".35"/>
      <circle cx="${LX}" cy="${y0 - 3}" r="2.3" fill="none" stroke="var(--lb)" stroke-width=".45"/><path d="M${LX - 4.4},${y0 - 3}H${LX + 4.4}M${LX},${y0 - 7.4}V${y0 + 1.4}" stroke="var(--lb)" stroke-width=".35"/>
      <path d="M${LX - 3.5},${y1 + 0.5}H${LX + 3.5}M${LX - 2},${y1 + 2.5}H${LX + 2}" stroke="var(--lb)" stroke-width=".45"/></g>
    ${pn.flush('ld', PENC)}<path d="${nd}" stroke="${INK}" stroke-width=".45" opacity=".55"/>${blue}`;
}

/* ---------- 底纹：很淡的铅笔轨道，圆心在屏外右边，一圈圈往外放大，左半边扫过整张名单。
   每圈起止错开、偶尔重描一截，圈上一小段刻度、一两粒星屑，偶尔一个小十字；一根穿过圆心的长轴点线。不随人数变，不承载信息 ---------- */
function drawUnder(g) {
  const PEN = dark ? '#9c9ca2' : C.PEN, INKc = dark ? C.PAPER : C.INK, R = rng(20261113);
  const cx = W + 40, cy = -150, rot = -0.3, cr = Math.cos(rot), sr = Math.sin(rot), k = 0.66;
  const at = (a, t) => { const x = a * Math.cos(t), y = a * k * Math.sin(t); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  const rings = [300, 372, 452, 545, 650, 770, 905, 1060, 1230];
  g.save();
  rings.forEach((a, i) => {
    const t0 = PI * (0.38 + R() * 0.1), t1 = PI * (1.12 + R() * 0.1), pts = []; for (let q = 0; q <= 120; q++) pts.push(at(a, t0 + (t1 - t0) * q / 120));
    g.strokeStyle = PEN; hand(g, pts, { w: 0.4, a: (i % 2 ? 0.13 : 0.18) * (dark ? 0.8 : 1), n: i % 3 === 0 ? 2 : 1, j: 0.5, ov: 2.5 }, R);
    const tt = t0 + (t1 - t0) * (0.3 + R() * 0.45); g.strokeStyle = INKc; g.globalAlpha = 0.16; g.lineWidth = 0.3; g.beginPath();
    for (let q = 0; q < 8; q++) { const t = tt + q * 9 / a, p = at(a, t), p2 = at(a, t + 0.002), dx = p2[0] - p[0], dy = p2[1] - p[1], l = Math.hypot(dx, dy) || 1, L = q % 4 ? 1.5 : 3; g.moveTo(p[0], p[1]); g.lineTo(p[0] - dy / l * L, p[1] + dx / l * L); } g.stroke();
    g.fillStyle = PEN; g.globalAlpha = 0.42; g.beginPath(); for (let q = 0; q < 2; q++) { const p = at(a, t0 + (t1 - t0) * R()); dot(g, p[0] + (R() - 0.5) * 3, p[1] + (R() - 0.5) * 3, 0.3 + R() * 0.4); } g.fill();
    if (i % 2) { const p = at(a, t0 + (t1 - t0) * (0.15 + R() * 0.7)); g.strokeStyle = PEN; g.globalAlpha = 0.3; g.lineWidth = 0.32; g.beginPath(); g.moveTo(p[0] - 2.2, p[1]); g.lineTo(p[0] + 2.2, p[1]); g.moveTo(p[0], p[1] - 2.2); g.lineTo(p[0], p[1] + 2.2); g.stroke(); }
  });
  const e0 = at(200, PI * 0.72), e1 = at(1300, PI * 0.72);
  g.strokeStyle = INKc; g.globalAlpha = 0.14; g.lineWidth = 0.32; g.setLineDash([0.8, 3.2]); g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.stroke(); g.setLineDash([]);
  g.restore(); g.globalAlpha = 1;
}

/* ---------- 页眉一行读数、安静的提示 ---------- */
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

/* ---------- 画一遍 ---------- */
let painted = 0;
function render() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  order().forEach(buildRow);
  for (const [k, b] of ROWS) if (!PEOPLE.some(c => c.relay === k)) { b.remove(); ROWS.delete(k); }
  if (gRow && !GROUP) { gRow.remove(); gRow = null; }
  drawSurvey(); paintHead();
}
function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  const g = fitCanvas(deco, W, H); g.fillStyle = dark ? C.INK : C.PAPER; g.fillRect(0, 0, W, H);
  spots(g, W, H, 515, dark ? 'rgba(241,238,230,0.12)' : 'rgba(84,84,88,0.18)');
  drawUnder(g); render();
}
function paint() { cancelAnimationFrame(painted); painted = requestAnimationFrame(render); }

/* ---------- 点一位：写回 Nyx 的选择（同 contacts.html 的 pick()），蓝满月从这颗星球涨满，去聊天页 ---------- */
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
  ssSet('ta-hand', { to: 'chat', t: Date.now(), x, y, c: dark ? C.INK : C.PAPER, slot: info.slot, morph: info.morph });
  const vw = innerWidth, vh = innerHeight, Rm = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) * 1.06, D = REDUCED ? 200 : 620;
  const cv = document.createElement('canvas'); cv.id = 'veil'; cv.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;display:block'; document.body.appendChild(cv);
  const g = fitCanvas(cv, vw, vh), t0 = performance.now(), fill = dark ? C.INK : C.PAPER;
  let held = 0;
  const tick = now => { const p = clamp((now - t0) / D, 0, 1), e = smoother(p), r = 7 * Math.pow(Rm / 7, e);
    g.clearRect(0, 0, vw, vh); iris(g, x, y, r, sstep(0.05, 0.32, p) * Math.max(r * 0.86, r - 11), fill, vw, vh);
    if (p < 1 || ++held < 3) requestAnimationFrame(tick); else location.href = href; };
  requestAnimationFrame(tick);
}
window.addEventListener('pageshow', ev => { if (ev.persisted) { window.__leaving = false; const v = document.querySelector('#veil[style*="z-index: 60"]'); if (v) v.remove(); } });

/* ---------- 右上的切换钮（11/13 F 版加的）：去邮票夹（people-f.html），带上查询参数；选了哪套记在 ta_people_look ---------- */
function lookSVG(on) {   // on：当前这套（'f' 邮票 / 'a' 星球）实心蓝，另一套只留轮廓（同 people-f.js）
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
if ($('look')) {
  $('look').innerHTML = lookSVG('a');
  $('look').addEventListener('click', () => {
    if (window.__leaving) return;
    try { localStorage.setItem('ta_people_look', 'f'); } catch (e) {}
    window.__leaving = true; stage.style.transition = REDUCED ? '' : 'opacity .16s'; stage.style.opacity = '0';
    setTimeout(() => { location.href = 'people-f.html' + location.search; }, REDUCED ? 0 : 170);
  });
}

/* ---------- 起步 ---------- */
const info = homeInfo('people', 0, dark ? 1 : 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && LIVE) probeAll(); });
if (LIVE) setInterval(() => { if (!document.hidden && !window.__leaving) probeAll(); }, 30000);

function loadConfig() {   // 同聊天页：Nyx 的 config.js 给第一只的地址和名字；?demo=1 时不装
  return new Promise(ok => { if (!LIVE || window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
}
setupGrain();
loadConfig().then(() => {
  loadList();
  layout();
  probeAll();
  revealIn(info, stage, () => { window.__revealed = true; });
  window.__ready = true;
});
window.__people = {
  state: () => ({ cur: CUR, home: HOME, people: PEOPLE.map(c => ({ name: c.name, relay: c.relay, k: stateOf(c).k, t: stateOf(c).t, kind: KINDS[KIND.get(c.relay) || 0] })),
    group: GROUP && { name: GROUP.name, relay: GROUP.relay, members: GROUP.members || [] }, loop: !!(GROUP && gRow) }),
  layout,
  sample: (kind, r, st) => planetSVG({ r, kind, seed: 9173 + kind * 31, id: 's' + kind + (st || ''), st: st || 'on', av: '', S: PS }),
  KINDS
};
})();
