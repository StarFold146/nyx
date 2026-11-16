/* 联系人页（11/13 第三版，朴素列表）：一人一行往下排。
   每行行首一颗雕版小星球（直径约 28px）：顺着球面走的弧形排线压出体积（暗面密、亮面留一条白，明暗交界清楚），每种画法各有一样表面特征：
     同心圈的环形坑、排线的交叉排线和嵌着的小方、月牙的几个坑、带环的（环从球后绕到前、环上有缝）、纬向条带、裂纹、刻度和极冠。
   画法按联系人的 relay 哈希定，跟列表顺序无关；撞了就顺延。有真头像时嵌在星球中心的小圆里。
   左边一根贯穿的测绘线（同聊天页那根：蓝灰细线、小刻度），每行一截短横接到星球；当前那一行线上一颗实心蓝节点，名字是蓝的。
   醒着：星球画全；睡着：淡的线稿、名字变灰；在忙：星球外一圈小卫星轨道，一颗实心蓝点慢慢绕（减少动态时不动）。
   群单独一行，行首两三颗更小的星球用一根短铅笔线连着，名字后面极小的人数。右上角一处很小的铅笔装饰，是这页独一的图。
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
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('niao_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（niao_side）
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

const INK = 'var(--fg)';
const P = pts => 'M' + pts.map(p => f2(p[0]) + ',' + f2(p[1])).join('L');
const ln = (x0, y0, x1, y1) => `M${f2(x0)},${f2(y0)}L${f2(x1)},${f2(y1)}`;
// 顺着球面走的排线（光从 -x 来）：k 是明暗交界的位置（-1..1），隔行长短不一，暗面密、交界外留一条白
function shadeD(r, k, sp) {
  let d = '', i = 0;
  for (let o = -r + sp * 0.3; o < r; o += sp * 0.62, i++) {
    const h = Math.sqrt(r * r - o * o); if (h < 0.7) continue;
    const xt = k * h, x0 = i % 2 === 0 ? xt - (i % 4 === 0 ? 0.3 : 0.07) * h : xt + 0.45 * (h - xt);
    const pts = []; for (let j = 0; j <= 6; j++) { const x = x0 + (h + 0.8 - x0) * j / 6; pts.push([x, o + 0.13 * Math.sqrt(Math.max(0, h * h - x * x))]); }
    d += P(pts);
  }
  return d;
}
function termD(r, k) { const pts = []; for (let j = 0; j <= 14; j++) { const y = -r + 2 * r * j / 14, h = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([k * h, y]); } return P(pts); }
const regionD = (r, k) => termD(r, k) + `A${f2(r)},${f2(r)} 0 0 0 0,${f2(-r)}Z`;   // 交界线到暗面边缘那一块
function chords(r, ang, gap) { const ca = Math.cos(ang), sa = Math.sin(ang); let d = ''; for (let o = -r + gap * 0.5; o < r; o += gap) { const h = Math.sqrt(r * r - o * o); if (h < 0.5) continue; const px = -sa * o, py = ca * o; d += ln(px - ca * h, py - sa * h, px + ca * h, py + sa * h); } return d; }
function latArc(r, y0, tilt) {   // 一道纬线的前半截（轴竖直、向观者倾 tilt）
  const s = Math.sqrt(Math.max(0, r * r - y0 * y0)), pts = []; for (let j = 0; j <= 16; j++) { const th = PI * j / 16; pts.push([s * Math.cos(th), y0 + tilt * s * Math.sin(th)]); } return pts;
}
function planetBody(o) {   // o: {r, kind, seed, line（只画线稿）, id}
  const r = o.r, Rn = rng(o.seed), L = 40 + Rn() * 14, sp = clamp(r * 0.1, 1, 1.45), line = o.line, id = o.id;
  const kind = KINDS[o.kind], kk = { conc: 0.16, hatch: 0.04, cres: -0.36, ring: 0.12, grat: 0.1, phase: 0, tick: 0.22 }[kind];
  const sw = '.24', clip = `clip-path="url(#${id}c)"`;
  let defs = `<clipPath id="${id}c"><circle r="${f2(r)}"/></clipPath>`, under = '', inClip = '', over = '', after = '';
  const shade = line ? '' : `<path d="${shadeD(r, kk, sp)}" stroke="${INK}" stroke-width="${sw}" opacity=".92" stroke-linecap="round"/>`;
  const term = `<path d="${termD(r, kk)}" stroke="${INK}" stroke-width=".3" fill="none" ${line ? 'stroke-dasharray=".8 1.1" opacity=".8"' : 'opacity=".75"'}/>`;
  let lightG = `<g transform="rotate(${f2(L)})">${shade}${term}`;
  const bgF = line ? 'none' : 'var(--bg)';
  switch (kind) {
    case 'conc': {   // 同心圈：亮面上一个环形坑，三道同心环、芯里一颗点，外环暗侧压一道深弧
      const cx = -0.4 * r, cy = -0.06 * r;
      lightG += [0.36, 0.25, 0.14].map((s, j) => `<ellipse cx="${f2(cx)}" cy="${f2(cy)}" rx="${f2(s * r * 0.78)}" ry="${f2(s * r)}" fill="${j ? 'none' : bgF}" stroke="${INK}" stroke-width="${j ? '.28' : '.34'}"/>`).join('')
        + `<path d="M${f2(cx + 0.28 * r * Math.cos(-1.1))},${f2(cy + 0.36 * r * Math.sin(-1.1))}A${f2(0.28 * r)},${f2(0.36 * r)} 0 0 1 ${f2(cx + 0.28 * r * Math.cos(1.1))},${f2(cy + 0.36 * r * Math.sin(1.1))}" fill="none" stroke="${INK}" stroke-width=".55"/>`
        + `<circle cx="${f2(cx)}" cy="${f2(cy)}" r=".55" fill="${INK}"/>`;
      break; }
    case 'hatch': {   // 排线：暗面再压一层交叉排线；亮面嵌一小块纸、纸上一颗实心方
      if (!line) { defs += `<clipPath id="${id}d"><path d="${regionD(r, kk + 0.45 * (1 - kk))}"/></clipPath>`; lightG += `<g clip-path="url(#${id}d)"><path d="${chords(r, 1.05, sp * 1.1)}" stroke="${INK}" stroke-width=".24"/></g>`; }
      const q = 0.25 * r, cx = -0.42 * r, cy = 0.04 * r;
      lightG += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(q)}" fill="${bgF}" stroke="${INK}" stroke-width=".3"/><rect x="${f2(cx - q * 0.42)}" y="${f2(cy - q * 0.42)}" width="${f2(q * 0.84)}" height="${f2(q * 0.84)}" fill="${INK}" transform="rotate(${f2(-L)} ${f2(cx)} ${f2(cy)})"/>`;
      break; }
    case 'cres': {   // 月牙：大半在暗里，亮的一弯上三个坑，每个坑朝光那侧压一道深弧
      [[-0.74, -0.3, 0.17], [-0.8, 0.26, 0.11], [-0.6, 0.55, 0.085], [-0.5, -0.66, 0.07]].forEach(([x, y, s]) => {
        const cx = x * r, cy = y * r, rx = s * r * 0.7, ry = s * r;
        lightG += `<ellipse cx="${f2(cx)}" cy="${f2(cy)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="${bgF}" stroke="${INK}" stroke-width=".28"/><path d="M${f2(cx)},${f2(cy - ry)}A${f2(rx)},${f2(ry)} 0 0 0 ${f2(cx)},${f2(cy + ry)}" fill="none" stroke="${INK}" stroke-width=".5"/>`;
      });
      break; }
    case 'ring': {   // 带环的：环从球后面绕到前面，环上三道线、一道缝
      const ra = -20 + (Rn() - 0.5) * 12, mul = [1.36, 1.56, 1.64, 1.9], ryf = 0.27;
      const half = (m, front) => { const rx = m * r, ry = m * r * ryf; return `M${f2(-rx)},0A${f2(rx)},${f2(ry)} 0 0 ${front ? 0 : 1} ${f2(rx)},0`; };
      under = `<g transform="rotate(${f2(ra)})" fill="none" stroke="${INK}">${mul.map((m, j) => `<path d="${half(m, false)}" stroke-width="${j === 3 ? '.38' : '.28'}"/>`).join('')}<path d="${half(1.46, false)}" stroke-width=".26" stroke-dasharray=".4 .9"/></g>`;
      over = `<g transform="rotate(${f2(ra)})" fill="none">${line ? '' : mul.map(m => `<path d="${half(m, true)}" stroke="var(--bg)" stroke-width="1.1"/>`).join('')}
        ${mul.map((m, j) => `<path d="${half(m, true)}" stroke="${INK}" stroke-width="${j === 3 ? '.42' : '.3'}"/>`).join('')}<path d="${half(1.46, true)}" stroke="${INK}" stroke-width=".26" stroke-dasharray=".4 .9"/></g>`;
      break; }
    case 'grat': {   // 纬向条带：两条带子，带里竖着细排线；一道淡经线
      const ax = 18 + (Rn() - 0.5) * 16, tl = 0.24;
      let s = '';
      [[-0.52, -0.36], [0.16, 0.3]].forEach(([a, b]) => {
        const A = latArc(r, a * r, tl), B = latArc(r, b * r, tl);
        s += `<path d="${P(A)}${P(B)}" fill="none" stroke="${INK}" stroke-width=".3"/>`;
        if (!line) { let h = ''; for (let j = 1; j < A.length - 1; j++) h += ln(A[j][0], A[j][1], B[j][0], B[j][1]); s += `<path d="${h}" stroke="${INK}" stroke-width=".24"/>`; }
      });
      s += `<ellipse rx="${f2(r * 0.42)}" ry="${f2(r)}" fill="none" stroke="${INK}" stroke-width=".24" opacity=".55"/>`;
      inClip = `<g transform="rotate(${f2(ax)})">${s}</g>`;
      break; }
    case 'phase': {   // 半明半暗，亮面几道裂纹（一折一叉）
      let s = '';
      for (let j = 0; j < 3; j++) {
        let x = -r * (0.25 + Rn() * 0.5), y = -r * 0.6 + j * r * 0.55 + (Rn() - 0.5) * r * 0.2; const pts = [[x, y]], a0 = (Rn() - 0.5) * 1.2 + (j === 1 ? PI : 0);
        for (let q = 0; q < 4; q++) { const a = a0 + (Rn() - 0.5) * 1.4; x += Math.cos(a) * r * 0.16; y += Math.sin(a) * r * 0.16; pts.push([x, y]); }
        s += P(pts); const m = pts[2]; s += ln(m[0], m[1], m[0] + (Rn() - 0.5) * r * 0.3, m[1] + r * 0.18);
      }
      lightG += `<path d="${s}" fill="none" stroke="${INK}" stroke-width=".3" stroke-linejoin="miter"/>`;
      break; }
    default: {   // 刻度：边上一圈刻，逢三长一点；顶上一块极冠留白，边是一道虚的纬线
      const ax = -14 + (Rn() - 0.5) * 16, cap = latArc(r, -0.68 * r, 0.24), capD = P(cap) + `A${f2(r)},${f2(r)} 0 0 0 ${f2(cap[0][0])},${f2(cap[0][1])}Z`;
      inClip = `<g transform="rotate(${f2(ax)})">${line ? '' : `<path d="${capD}" fill="var(--bg)"/>`}<path d="${P(cap)}" fill="none" stroke="${INK}" stroke-width=".3" stroke-dasharray=".7 .9"/></g>`;
      let t = ''; for (let k = 0; k < 36; k++) { const a = k / 36 * TAU, l = k % 3 === 0 ? 0.2 * r : 0.1 * r, ca = Math.cos(a), sa = Math.sin(a); t += ln(ca * r, sa * r, ca * (r - l), sa * (r - l)); }
      after = `<path d="${t}" stroke="${INK}" stroke-width=".28"/>`;
    }
  }
  lightG += '</g>';
  return { defs, body: `${under}<circle r="${f2(r)}" fill="var(--bg)"/><g ${clip}>${lightG}${inClip}</g>${after}`, over };
}
function planetSVG(o) {   // o: {r, kind, seed, id, st, cur, av, S}
  const r = o.r, line = o.st === 'off' || o.st === 'wait', pb = planetBody({ r, kind: o.kind, seed: o.seed, line, id: o.id });
  let sat = '', ring = '';
  if (o.st === 'busy') {   // 在忙：一圈小卫星轨道，一颗实心蓝点慢慢绕
    const ringK = KINDS[o.kind] === 'ring', rx = ringK ? r * 2.15 : r + 7, ry = rx * (ringK ? 0.36 : 0.44), path = `M${f2(rx)},0A${f2(rx)},${f2(ry)} 0 1 1 ${f2(-rx)},0A${f2(rx)},${f2(ry)} 0 1 1 ${f2(rx)},0`;
    sat = `<g class="sat" transform="rotate(${ringK ? 12 : -30})"><path d="${path}" fill="none" stroke="var(--fg2)" stroke-width=".3" stroke-dasharray="${f2(TAU * rx * 0.55)} 1.2 .6 1.2"/>
      <circle class="moon" r="1.35" fill="var(--lb)" ${REDUCED ? `cx="${f2(-rx * 0.62)}" cy="${f2(ry * 0.78)}"` : ''}>${REDUCED ? '' : `<animateMotion dur="36s" repeatCount="indefinite" path="${path}" begin="${-(o.seed % 30)}s"/>`}</circle></g>`;
  }
  if (o.cur) {   // 当前这位：外面一段刻度弧和一小段双线（不用蓝，蓝留给名字和起航线）
    const R1 = r + 3.4; let t = '';
    for (let k = 0, a = 140; a <= 400.01; a += 8, k++) { const l = k % 4 === 0 ? 2.4 : 1.2, q = a * PI / 180, ca = Math.cos(q), sa = Math.sin(q); t += ln(ca * R1, sa * R1, ca * (R1 + l), sa * (R1 + l)); }
    const arc = (rr, b0, b1) => { const Pp = q => f2(Math.cos(q * PI / 180) * rr) + ',' + f2(Math.sin(q * PI / 180) * rr); return `M${Pp(b0)}A${f2(rr)},${f2(rr)} 0 ${b1 - b0 > 180 ? 1 : 0} 1 ${Pp(b1)}`; };
    ring = `<g class="mark" fill="none"><path d="${arc(R1, 140, 400)}" stroke="var(--fg3)" stroke-width=".3"/><path d="${t}" stroke="var(--fg2)" stroke-width=".3"/><path d="${arc(R1 + 5, 52, 88)}" stroke="var(--fg2)" stroke-width=".3"/><path d="${arc(R1 + 6.2, 52, 88)}" stroke="var(--fg3)" stroke-width=".3"/></g>`;
  }
  const rim = line ? `stroke-dasharray=".9 1.3"` : '';
  const ar = r * 0.34, avEl = o.av ? `<defs><clipPath id="${o.id}a"><circle r="${f2(ar)}"/></clipPath></defs><circle r="${f2(ar + 0.9)}" fill="var(--bg)"/>
    <image href="${o.av}" x="${f2(-ar)}" y="${f2(-ar)}" width="${f2(ar * 2)}" height="${f2(ar * 2)}" clip-path="url(#${o.id}a)" preserveAspectRatio="xMidYMid slice"/><circle r="${f2(ar)}" fill="none" stroke="${INK}" stroke-width=".3"/>` : '';
  const S = o.S;
  return `<svg viewBox="${-S / 2} ${-S / 2} ${S} ${S}" width="${S}" height="${S}" aria-hidden="true"><defs>${pb.defs}</defs>
    <circle r="${f2(r + 1.8)}" fill="var(--bg)"/>
    <g class="body">${pb.body}<circle class="rim" r="${f2(r)}" fill="none" stroke="${INK}" stroke-width=".5" ${rim}/>${pb.over}${avEl}</g>${ring}${sat}</svg>`;
}
function svgFor(c, r, id) {
  const st = stateOf(c).k, kind = KIND.get(c.relay) || 0;
  return planetSVG({ r, kind, seed: hstr(c.relay), id, st, cur: false, av: avOf(c), S: Math.ceil(KINDS[kind] === 'ring' ? r * 4.2 : r * 2 + 30) });
}
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
const LX = 22, PX = 58, ROWH = 60, PR = 14;   // 测绘线的横坐标、星球圆心横坐标、行高、星球半径
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
    const sig = [st.k, avOf(c).length, cur].join('|');
    if (b.dataset.sig !== sig) { b.dataset.sig = sig; b.innerHTML = svgFor(c, PR, 'p' + c.i) + `<span class="tag"><b></b><i></i></span><span class="no" aria-hidden="true"></span>`; }
    b.querySelector('.tag b').textContent = c.name;
    b.querySelector('.tag i').textContent = st.t;
  }
  b.querySelector('.no').textContent = ROMAN[j] || '';
}
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function groupSVG(ms, k) {   // 群：两三颗更小的星球挨着，一根短铅笔线连着
  const pos = [[-9, 3.5], [1.5, -4], [11, 3]], S = 64, n = Math.max(2, Math.min(3, ms.length || 3)), line = k === 'off' || k === 'wait';
  let s = '';
  const pts = pos.slice(0, n);
  const pen = (dx, dy, op, w) => `<path d="${P(pts.map(p => [p[0] + dx, p[1] + dy]))}" fill="none" stroke="var(--fg2)" stroke-width="${w}" opacity="${op}" stroke-linejoin="round"/>`;
  s += pen(0, 0, 0.55, 0.45) + pen(0.35, -0.25, 0.3, 0.35);
  pts.forEach((p, j) => {
    const m = PEOPLE.find(c => c.name === ms[j]), kind = m ? (KIND.get(m.relay) || 0) : j * 2, r = 5.4, pb = planetBody({ r, kind: KINDS[kind] === 'ring' ? (kind + 1) % KINDS.length : kind, seed: 77 + j * 13 + kind, line, id: 'g' + j });
    s += `<g transform="translate(${p[0]} ${p[1]})"><defs>${pb.defs}</defs><circle r="${r + 1.4}" fill="var(--bg)"/><g class="body">${pb.body}<circle r="${r}" fill="none" stroke="${INK}" stroke-width=".45" ${line ? 'stroke-dasharray=".8 1.1"' : ''}/></g></g>`;
  });
  return `<svg viewBox="${-S / 2} ${-S / 2} ${S} ${S}" width="${S}" height="${S}" aria-hidden="true">${s}</svg>`;
}
/* 左边一根测绘线（同聊天页那根：蓝灰细线、小刻度）：每一行一截短横接到星球，当前那一行一颗实心蓝节点；线顶一个起点记号，线尾收住 */
function drawSurvey() {
  const svy = $('svy'), rows = [...list.querySelectorAll('.pl, .grp')];
  if (!rows.length) { svy.innerHTML = ''; return; }
  const ys = rows.map(r => r.offsetTop + ROWH / 2), y0 = ys[0] - 30, y1 = ys[ys.length - 1] + 30, Hh = y1 + 40;
  let tk = '', k = 0; for (let y = y0 + 8; y < y1 - 2; y += 12, k++) { const l = k % 4 === 0 ? 4 : 2; tk += `M${LX},${y + 0.5}H${LX + l}`; }
  let nd = '', cn = '', blue = '';
  rows.forEach((r, j) => {
    const y = ys[j] + 0.5, isG = r.classList.contains('grp'), x1 = isG ? PX - 18 : PX - PR - 3.5;
    cn += `M${LX},${y}H${x1.toFixed(1)}`;
    if (r.classList.contains('cur')) blue += `<circle cx="${LX}" cy="${y}" r="2.3" fill="var(--lb)"/>`;
    else nd += `<rect x="${LX - 0.9}" y="${y - 0.9}" width="1.8" height="1.8" fill="var(--fg)"/>`;
  });
  svy.setAttribute('width', 60); svy.setAttribute('height', Hh); svy.setAttribute('viewBox', `0 0 60 ${Hh}`);
  svy.innerHTML = `<g class="ln"><path d="M${LX},${y0}V${y1}" stroke="var(--lb)" stroke-width=".5"/><path d="${tk}" stroke="var(--lb)" stroke-width=".4"/>
      <circle cx="${LX}" cy="${y0 - 2.4}" r="2.2" fill="none" stroke="var(--lb)" stroke-width=".45"/><path d="M${LX - 3.5},${y1 + 0.5}H${LX + 3.5}M${LX - 2},${y1 + 2.5}H${LX + 2}" stroke="var(--lb)" stroke-width=".45"/></g>
    <path d="${cn}" stroke="var(--fg3)" stroke-width=".4"/>${nd}${blue}`;
  const end = $('endnote'); end.style.top = (y1 + 14) + 'px';
}
/* 右上角独一的一处图：一小段轨道弧、两三颗星点、一根甩出去的铅笔起航线。尺寸固定，不随人数变，不承载信息 */
function drawOrn() {
  const cv = $('orn'), w = 128, h = 92, g = fitCanvas(cv, w, h), INKc = dark ? C.PAPER : C.INK, PEN = dark ? '#9c9ca2' : C.PEN, R = rng(1113);
  cv.style.left = Math.round(W - w - 12) + 'px';
  const cx = 70, cy = 42, a = 46, b = 17, rot = -0.42;
  g.strokeStyle = INKc; g.lineWidth = 0.4; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(cx, cy, a, b, rot, 2.2, 5.9); g.stroke();
  g.globalAlpha = 0.32; g.setLineDash([1.2, 2.4]); g.beginPath(); g.ellipse(cx, cy, a, b, rot, 5.9, 2.2 + TAU); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 0.25; g.beginPath(); g.ellipse(cx, cy, a * 0.55, b * 0.55, rot, 0, TAU); g.setLineDash([0.6, 2]); g.stroke(); g.setLineDash([]);
  // 弧上一段刻度
  const at = t => { const x = a * Math.cos(t), y = b * Math.sin(t), cr = Math.cos(rot), sr = Math.sin(rot); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  g.globalAlpha = 0.5; g.lineWidth = 0.32; g.beginPath(); for (let q = 0; q <= 9; q++) { const t = 3.3 + q * 0.09, p = at(t), p2 = at(t + 0.001), dx = p2[0] - p[0], dy = p2[1] - p[1], l = Math.hypot(dx, dy) || 1, L = q % 3 ? 1.4 : 2.8; g.moveTo(p[0], p[1]); g.lineTo(p[0] + dy / l * L, p[1] - dx / l * L); } g.stroke();
  // 弧心一个小十字，弧上一颗实心小点
  g.globalAlpha = 0.55; g.beginPath(); g.moveTo(cx - 2.5, cy); g.lineTo(cx + 2.5, cy); g.moveTo(cx, cy - 2.5); g.lineTo(cx, cy + 2.5); g.stroke();
  const pp = at(5.1); g.fillStyle = INKc; g.globalAlpha = 0.85; g.beginPath(); g.arc(pp[0], pp[1], 1.5, 0, TAU); g.fill();
  // 星点
  g.fillStyle = PEN; g.globalAlpha = 0.55; g.beginPath(); for (let i = 0; i < 16; i++) { const t = R() * TAU, q = Math.pow(R(), 1.3); dot(g, 96 + Math.cos(t) * 20 * q, 22 + Math.sin(t) * 12 * q, 0.22 + R() * 0.4); } g.fill();
  g.globalAlpha = 0.5; g.strokeStyle = PEN; g.lineWidth = 0.4; g.beginPath(); g.moveTo(112, 14); g.lineTo(117, 14); g.moveTo(114.5, 11.5); g.lineTo(114.5, 16.5); g.stroke();
  // 起航线：从那颗小点顺着切线甩出去，往左下弯，末端一个开口小箭头
  const p0 = at(5.1), p1 = at(5.12), dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), d = [-dx / l, -dy / l];
  const s0 = [p0[0] + d[0] * 4, p0[1] + d[1] * 4], end = [12, 84], c = [s0[0] + d[0] * 40, s0[1] + d[1] * 40], pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, m = 1 - t; pts.push([m * m * s0[0] + 2 * m * t * c[0] + t * t * end[0], m * m * s0[1] + 2 * m * t * c[1] + t * t * end[1]]); }
  g.strokeStyle = PEN; hand(g, pts, { w: 0.45, a: 0.45, n: 1, j: 0.3, ov: 1.5 }, R);
  const ang = Math.atan2(end[1] - pts[21][1], end[0] - pts[21][0]); g.strokeStyle = INKc; g.globalAlpha = 0.5; g.lineWidth = 0.4; g.beginPath();
  g.moveTo(end[0] - Math.cos(ang - 0.42) * 3.6, end[1] - Math.sin(ang - 0.42) * 3.6); g.lineTo(end[0], end[1]); g.lineTo(end[0] - Math.cos(ang + 0.42) * 3.6, end[1] - Math.sin(ang + 0.42) * 3.6); g.stroke(); g.globalAlpha = 1;
}

/* ---------- 页眉一行读数、安静的提示 ---------- */
/* 垫在名单底下的铅笔底纹：右上那处小图的轨道一圈圈往外放大，从右上铺到名单后面去。
   全是很淡的铅笔弧（hand），带几段刻度、几粒星点、一根穿过整页的长轴点线。不随人数变，不承载信息 */
function drawUnder(g) {
  const PEN = dark ? '#9c9ca2' : C.PEN, INKc = dark ? C.PAPER : C.INK, R = rng(20261113);
  const cx = W - 70, cy = 56, rot = -0.42, cr = Math.cos(rot), sr = Math.sin(rot), k = 17 / 46;
  const at = (a, t) => { const x = a * Math.cos(t), y = a * k * 1.9 * Math.sin(t); return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  const rings = [96, 150, 214, 290, 380, 486, 610];
  g.save();
  rings.forEach((a, i) => {
    // 只画朝左下的那一段（扫过名单的那边），每圈起止错开一点，像没擦干净的作图线
    const t0 = 1.15 + R() * 0.25, t1 = 3.55 + R() * 0.35, pts = []; for (let q = 0; q <= 90; q++) pts.push(at(a, t0 + (t1 - t0) * q / 90));
    g.strokeStyle = PEN; hand(g, pts, { w: 0.42, a: (i % 2 ? 0.17 : 0.24) * (dark ? 0.8 : 1), n: i % 3 === 0 ? 2 : 1, j: 0.5, ov: 2.5 }, R);
    // 圈上一小段刻度
    const tt = t0 + (t1 - t0) * (0.25 + R() * 0.5); g.strokeStyle = INKc; g.globalAlpha = 0.22; g.lineWidth = 0.32; g.beginPath();
    for (let q = 0; q < 8; q++) { const t = tt + q * 9 / a, p = at(a, t), p2 = at(a, t + 0.002), dx = p2[0] - p[0], dy = p2[1] - p[1], l = Math.hypot(dx, dy) || 1, L = q % 4 ? 1.6 : 3.2; g.moveTo(p[0], p[1]); g.lineTo(p[0] - dy / l * L, p[1] + dx / l * L); } g.stroke();
    // 圈上一两粒小星、偶尔一个小十字
    g.fillStyle = PEN; g.globalAlpha = 0.5; g.beginPath(); for (let q = 0; q < 2; q++) { const p = at(a, t0 + (t1 - t0) * R()); dot(g, p[0] + (R() - 0.5) * 3, p[1] + (R() - 0.5) * 3, 0.3 + R() * 0.45); } g.fill();
    if (i % 2) { const p = at(a, t0 + (t1 - t0) * (0.15 + R() * 0.7)); g.strokeStyle = PEN; g.globalAlpha = 0.4; g.lineWidth = 0.35; g.beginPath(); g.moveTo(p[0] - 2.4, p[1]); g.lineTo(p[0] + 2.4, p[1]); g.moveTo(p[0], p[1] - 2.4); g.lineTo(p[0], p[1] + 2.4); g.stroke(); }
  });
  // 长轴：从圆心往左下穿过整页的一根点线，再叠一根只画了半截的铅笔线
  const ax = Math.PI - 0.02, e0 = at(40, ax), e1 = at(700, ax);
  g.strokeStyle = INKc; g.globalAlpha = 0.2; g.lineWidth = 0.35; g.setLineDash([0.8, 3.2]); g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.stroke(); g.setLineDash([]);
  const f0 = at(120, ax + 0.5), f1 = at(520, ax + 0.34), fp = []; for (let q = 0; q <= 30; q++) fp.push([f0[0] + (f1[0] - f0[0]) * q / 30, f0[1] + (f1[1] - f0[1]) * q / 30]);
  g.strokeStyle = PEN; hand(g, fp, { w: 0.4, a: 0.16, n: 1, j: 0.5, ov: 2 }, R);
  g.restore(); g.globalAlpha = 1;
}
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
  drawUnder(g); drawOrn(); render();
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
window.addEventListener('pageshow', ev => { if (ev.persisted) { window.__leaving = false; const v = document.querySelector('#veil[style*="z-index: 60"]'); if (v) v.remove(); } });

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
  sample: (kind, r, st) => planetSVG({ r, kind, seed: 9173 + kind * 31, id: 's' + kind + (st || ''), st: st || 'on', cur: false, av: '', S: Math.ceil(KINDS[kind] === 'ring' ? r * 4.2 : r * 2 + 30) }),
  KINDS
};
})();
