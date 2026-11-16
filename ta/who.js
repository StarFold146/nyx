/* 个人信息页（初稿，11/12）：这位的档案，像一张标本签。
   上面一只大眼睛（聊天页页眉那只放大），头像在瞳孔里；虹膜一圈径向刻度、上睑一排短睫毛、铅笔辅助弧、量角弧、颗粒，扎成整页独一一堆细活。
   眼睑上垂下一根蓝灰测绘线，线上挂读数：名字、备注（点了就地变一道细线输入）、模型、此刻；再往下挂几枚细线文字钮：换头像、换我的头像。
   线脚一滴劈开的蓝泪。页脚一行：云上那份的状态，右边「回换皮页」。
   功能照搬 Nyx 的 lib/profile.js（只读）：
     localStorage  nyx_avatar{后缀}（这位的头像 dataURL）、nyx_avatar_me（我的头像，所有联系人共用）、
                   nyx_profile_remark{后缀}（备注）、nyx_prefs_ts（上云的时间戳）
     后缀：/relay → ""，/relay/g → "_group"，其余 "_" + 去掉 /relay- 的部分（同 profile.js 11 行）
     头像：中心裁方、压到 256×256、白底、JPEG 0.88（同 profile.js 170–191）
     上云：GET/POST 家里那只（config.js 的 relay，钥匙 nyx_key）的 /app/prefs {ts, data}；data 是 localStorage 里匹配 SYNC_RE 的全部键；
           谁的 ts 新听谁的，本机改了 1.5 秒后推一份（同 profile.js 18–40，连 4e12 那条保护、补头像备注那条都照抄）
   读数另外问两个口子（跟联系人页、聊天页仪表一样）：GET <relay>/healthz（不带钥匙，plugin_subs > 0 是醒着）、GET <relay>/app/status 的 last_msg_age_sec、
     GET <relay>/app/meter 的 model.name（群不问）。
   ?demo=1 示例数据，一个请求都不发、不动 localStorage（换头像、改备注只存在内存里）。?dark=1 墨黑底。?relay=/relay-xx 指定看哪一位，不带就看 Nyx 现在选的那只。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, smoother, rng, Q, REDUCED, dot, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco'), eye = $('eye');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('ta_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（ta_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = n => (Math.round(n * 100) / 100).toString();

/* ---------- 存取：接后台时是 localStorage（键名同 profile.js）；演示时是一张内存表 ---------- */
const MEM = new Map();
function ls(k) { if (!LIVE) return MEM.has(k) ? MEM.get(k) : null; try { return localStorage.getItem(k); } catch (e) { return null; } }
function lset(k, v) {
  if (!LIVE) { if (v == null) MEM.delete(k); else MEM.set(k, v); return; }
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { toast('存不下，图太大了'); }
}

/* ---------- 这一位是谁（同聊天页 resolve()：?relay= 指定，不然 Nyx 现在选的那只 nyx_relay，再不然第一只） ---------- */
let HOME = '/relay', RELAY = '/relay', NAME = '甲', ME = '我', GROUP = false, KEY = null, SUF = '', K_AV = '', K_RK = '', DEFAULT_AV = '';
const K_ME = 'nyx_avatar_me', TS = 'nyx_prefs_ts';
const SYNC_RE = /^nyx_(avatar|bg|cover|profile_remark|stickers|theme|todos|sound|deleted_ids|glass|phrases)/;
function contacts() { try { const a = JSON.parse(ls('nyx_contacts') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function resolve() {
  if (!LIVE) { HOME = '/relay'; RELAY = '/relay'; NAME = '丙'; ME = '我'; KEY = 'demo'; }
  else {
    const N = window.NYX || {};
    HOME = N.relay || '/relay'; ME = N.meName || '我';
    const want = Q.get('relay'), ok = r => typeof r === 'string' && /^\/relay(-[a-z0-9]+)?(\/g)?$/.test(r), picked = ls('nyx_relay');
    RELAY = ok(want) ? want : ok(picked) ? picked : HOME;
    const hk = ls('nyx_key'), ct = contacts().find(c => c && c.relay === RELAY);
    KEY = RELAY === HOME ? hk : RELAY === picked ? (ls('nyx_chat_key') || hk) : ((ct && ct.key) || hk);
    NAME = RELAY === HOME ? (N.aiName || '甲') : (RELAY === picked && ls('nyx_ai')) || (ct && ct.name) || N.aiName || '甲';
  }
  GROUP = /\/g$/.test(RELAY);
  SUF = RELAY === '/relay' ? '' : RELAY === '/relay/g' ? '_group' : '_' + RELAY.replace(/^\/relay-?/, '').replace(/\W+/g, '_');   // 同 profile.js 11 行
  K_AV = 'nyx_avatar' + SUF; K_RK = 'nyx_profile_remark' + SUF;
  DEFAULT_AV = '';
  $('no').textContent = 'No. ' + RELAY.slice(1);
}

/* ---------- 后台 ---------- */
function call(base, k, path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + k }, opt.headers || {}); opt.cache = 'no-store';
  return fetch(base + path, opt).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  });
}
const api = (p, o) => call(RELAY, KEY, p, o);              // 这一位
const hapi = (p, o) => call(HOME, ls('nyx_key'), p, o);    // 家里（prefs）走第一只、nyx_key，同 Nyx

/* ---------- 设置上云：照抄 profile.js 18–40 ---------- */
let ready = false, pushT = 0, syncNote = '';
function collect() { const d = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC_RE.test(k)) d[k] = localStorage.getItem(k); } } catch (e) {} return d; }
function push() {
  setSync('pushing');
  hapi('/app/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ts: +ls(TS) || 0, data: collect() }) })
    .then(() => setSync('saved'), () => setSync('pushfail'));
}
function touched() { if (!LIVE) { setSync('demo'); return; } if (!ready) { setSync(ls('nyx_key') ? 'local' : 'nokey'); return; } lset(TS, String(Date.now())); clearTimeout(pushT); pushT = setTimeout(push, 1500); setSync('wait'); }
function sync() {
  if (ready || !LIVE || !ls('nyx_key')) return;
  hapi('/app/prefs').then(srv => {
    if (+ls(TS) > 4e12) lset(TS, '0');   // profile.js 26 行：不合理的大数当没有
    const local = +ls(TS) || 0, remote = +srv.ts || 0, data = srv.data || {}, mine = collect();
    if (remote > local && Object.keys(data).length) {
      Object.keys(mine).forEach(k => { if (!(k in data)) lset(k, null); });
      Object.keys(data).forEach(k => { if (k === 'nyx_stickers') return; lset(k, data[k]); });   // 表情住 IndexedDB，这页不碰（profile.js 交给 emo-plus 的 NyxStkSet；这里没有那个口子）
      lset(TS, String(remote)); ready = true; setSync('pulled'); paint(); return;
    }
    ready = true;
    let fill = false;   // 本机没有的头像和备注照样从云上补（profile.js 34–37）
    Object.keys(data).forEach(k => { if (/^nyx_(avatar|profile_remark)/.test(k) && ls(k) == null) { lset(k, data[k]); fill = true; } });
    if (fill) paint();
    if (local > remote || (!remote && Object.keys(mine).length)) { if (!local) lset(TS, String(Date.now())); push(); }
    else setSync('even');
  }).catch(e => setSync(e && e.auth ? 'auth' : 'syncfail'));   // 没连上：下次再试，本机照旧
}
function hm(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function setSync(k) {
  syncNote = k;
  const el = $('sync'), ts = +ls(TS) || 0;
  const T = {
    demo: '演示 · 只存在这一页里', nokey: '', auth: '', local: '云上还没对上，先存在本机',
    even: '云上那份对上了' + (ts ? ' · ' + hm(ts) : ''), pulled: '从云上拿回来了 · ' + hm(Date.now()), wait: '一会儿存到云上…', pushing: '存到云上…',
    saved: '云上存好了 · ' + hm(Date.now()), pushfail: '云上没存上，本机留着', syncfail: '云上连不上，本机照旧'
  };
  if (k === 'nokey') el.innerHTML = '还没带钥匙，只存在本机 · <a href="../index.html">去登录</a>';
  else if (k === 'auth') el.innerHTML = '钥匙不认了 · <a href="../index.html">去登录</a>';
  else el.textContent = T[k] || '';
}

/* ---------- 头像 ---------- */
function okURL(v) { return typeof v === 'string' && (/^data:image\//.test(v) || /^\/(?!\/)/.test(v)); }
function remark() { return (ls(K_RK) || '').trim(); }
function shown() { return remark() || NAME; }
function initial(s) { return Array.from(s || '?')[0]; }
function geoAv() {   // 示例头像：纸白、墨黑、浅灰三色的几何小版画
  const P = C.PAPER, I = C.INK, L = C.LGREY;
  let h = ''; for (let x = -36; x < 36; x += 2.4) h += `<path d="M${f2(x)} 36 L${f2(x + 36)} 0"/>`;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" fill="${P}"/><g stroke="${L}" stroke-width=".5">${h}</g><circle cx="16.5" cy="19" r="11" fill="${I}"/><circle cx="21.5" cy="15.2" r="9.4" fill="${P}"/><path d="M0 30.5H36" stroke="${I}" stroke-width=".45"/><circle cx="26" cy="11" r=".8" fill="${I}"/><circle cx="28.5" cy="16.5" r=".5" fill="${I}"/><circle cx="24.6" cy="24.6" r=".45" fill="${I}"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
function avNow() { const v = ls(K_AV); return okURL(v) ? v : DEFAULT_AV; }

/* ---------- 版面 ---------- */
let W = 0, H = 0, ES = 3, EX = 0, EY = 0, LX = 0, Y0 = 0, YT = 0, lineTop = 0;
const EW = 31, HOPEN = 22.4;
function lidY(x, o) { const u = clamp((x - EX) / ES, -EW, EW), t = (u + EW) / (2 * EW), h = HOPEN * o + 0.4; return EY + 2 * t * (1 - t) * 2 * h * ES; }   // 下睑在 x 处的高度
function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  ES = clamp(W * 0.5 / 64, 2.3, 3.15); EX = Math.round(W / 2); EY = Math.round(clamp(H * 0.29, 196, 262));
  const vb = [-48, -38, 96, 76];
  eye.setAttribute('viewBox', vb.join(' '));
  Object.assign(eye.style, { left: (EX + vb[0] * ES) + 'px', top: (EY + vb[1] * ES) + 'px', width: (vb[2] * ES) + 'px', height: (vb[3] * ES) + 'px' });
  Object.assign($('eyeB').style, { left: (EX - EW * ES) + 'px', top: (EY - 22 * ES) + 'px', width: (2 * EW * ES) + 'px', height: (44 * ES) + 'px' });
  Object.assign($('eyeF').style, { left: (EX - 14 * ES) + 'px', top: (EY + 24 * ES) + 'px', width: (28 * ES) + 'px' });
  LX = Math.round(W * 0.34); lineTop = Math.round(lidY(LX, 1)) + 3;
  Y0 = Math.round(EY + 23 * ES + Math.min(78, H * 0.085));
  const RS = Math.round(clamp(H * 0.038, 26, 34)), AS = Math.round(clamp(H * 0.033, 24, 29));
  const rows = ['rName', 'rRemark', 'rModel', 'rState'], acts = ['aAv', 'aMe'];
  let y = Y0;
  rows.forEach(id => { place($(id), y); y += RS; });
  y += Math.round(RS * 0.7);
  acts.forEach(id => { place($(id), y); y += AS; });
  YT = y + 6;
  Object.assign($('line').style, { left: LX + 'px', top: lineTop + 'px', height: (YT - lineTop) + 'px' });
  const tf = $('tearF'); tf.setAttribute('viewBox', '-6 -2 12 16'); Object.assign(tf.style, { left: (LX - 6) + 'px', top: (YT - 2) + 'px', width: '12px', height: '16px' });
  tf.innerHTML = `<path d="M0,1L3.1,6.2L0,11.4L-3.1,6.2Z" fill="none" stroke="var(--lb)" stroke-width=".45" stroke-linejoin="miter"/><path d="M0,1L-3.1,6.2L0,11.4Z" fill="var(--lb)"/><path d="M0,-1.6V13.4" stroke="var(--lb)" stroke-width=".4" stroke-linecap="butt"/>`;
  const ft = $('foot'); ft.style.top = Math.round(H - 34) + 'px'; ft.style.padding = '0 20px 0 ' + Math.max(20, LX - 64) + 'px';
  $('toast').style.top = Math.round(H - 64) + 'px';
  buildEye(); lids(eo); drawDeco();
}
function place(el, y) { Object.assign(el.style, { left: LX + 'px', top: (y - 8) + 'px', height: '16px', maxWidth: (W - LX - 16) + 'px' }); el.dataset.y = y; }

/* ---------- 大眼睛：聊天页页眉那只的画法放大。虹膜一圈径向刻度、一圈点线（都被眼睑裁着），上睑一排短睫毛，外眼角一粒蓝 ---------- */
const LASH = (() => { const R = rng(77), a = []; for (let i = 0; i < 19; i++) a.push([0.12 + 0.76 * i / 18 + (R() - 0.5) * 0.02, 1.1 + R() * 1.7 + Math.sin(PI * i / 18) * 1.6, (R() - 0.5) * 0.28]); return a; })();
let eo = 1, eyeSig = '';
function buildEye() {
  const ink = dark ? C.PAPER : C.INK, av = avNow(), sig = [ink, av.length, av.slice(-40), shown()].join('|');
  if (sig === eyeSig) return; eyeSig = sig;
  let tk = '';
  for (let k = 0; k < 120; k++) { const a = k / 120 * TAU, r0 = 20.5, r1 = r0 + (k % 10 === 0 ? 2.6 : k % 5 === 0 ? 1.8 : 1.1); tk += `M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0)}L${f2(Math.cos(a) * r1)} ${f2(Math.sin(a) * r1)}`; }
  const pupil = av ? `<image href="${esc(av)}" x="-18" y="-18" width="36" height="36" clip-path="url(#wc)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle r="18" fill="var(--bg)"/><text y=".5" text-anchor="middle" dominant-baseline="central" font-family="Noto Serif SC, Songti SC, serif" font-weight="300" font-size="13" fill="${ink}" opacity=".7">${esc(initial(shown()))}</text>`;
  eye.innerHTML = `<defs><clipPath id="wl"><path class="lid"/></clipPath><clipPath id="wc"><circle r="18"/></clipPath></defs>
    <g clip-path="url(#wl)">
      <g class="pup">${pupil}</g>
      <circle r="19.6" fill="none" stroke="${ink}" stroke-width=".5" opacity=".75" vector-effect="non-scaling-stroke"/>
      <path d="${tk}" fill="none" stroke="${ink}" stroke-width=".35" opacity=".6" vector-effect="non-scaling-stroke"/>
      <circle r="24.6" fill="none" stroke="${ink}" stroke-width=".45" stroke-dasharray=".3 1.5" opacity=".5" vector-effect="non-scaling-stroke"/>
      <circle r="27.2" fill="none" stroke="${ink}" stroke-width=".3" opacity=".3" vector-effect="non-scaling-stroke"/>
    </g>
    <path class="lash" fill="none" stroke="${ink}" stroke-width=".45" stroke-linecap="butt" opacity=".8" vector-effect="non-scaling-stroke"/>
    <path class="up" fill="none" stroke="${ink}" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path class="dn" fill="none" stroke="${ink}" stroke-width=".5" stroke-linecap="round" opacity=".8" vector-effect="non-scaling-stroke"/>
    <circle cx="-34.2" cy=".2" r=".42" fill="var(--lb)"/>`;
  lids(eo);
}
function lashes(h) {
  let d = '';
  for (const [t, len, tw] of LASH) {
    const x = (1 - t) * (1 - t) * -EW + t * t * EW, y = 2 * (1 - t) * t * (-h * 2), dx = 2 * EW, dy = 2 * (1 - 2 * t) * (-h * 2), L = Math.hypot(dx, dy) || 1;
    let nx = dy / L, ny = -dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
    const c = Math.cos(tw), s = Math.sin(tw), ux = nx * c - ny * s, uy = nx * s + ny * c;
    d += `M${f2(x)} ${f2(y)}L${f2(x + ux * len)} ${f2(y + uy * len)}`;
  }
  return d;
}
function lids(o) {
  eo = o; const h = HOPEN * o + 0.4, q = s => eye.querySelector(s); if (!q('.lid')) return;
  q('.lid').setAttribute('d', `M${-EW},0 Q0,${-h * 2} ${EW},0 Q0,${h * 2} ${-EW},0 Z`);
  q('.up').setAttribute('d', `M${-EW},0 Q0,${-h * 2} ${EW},0`);
  q('.dn').setAttribute('d', `M${-EW},0 Q0,${h * 2} ${EW},0`);
  q('.lash').setAttribute('d', o > 0.25 ? lashes(h) : '');
}
let tw = 0;
function tweenEye(to, D, done) {
  if (REDUCED || D <= 0) { lids(to); done && done(); return; }
  const from = eo, t0 = performance.now(), id = ++tw;
  const tick = now => { if (id !== tw) return; const p = clamp((now - t0) / D, 0, 1); lids(from + (to - from) * smoother(p)); if (p < 1) requestAnimationFrame(tick); else done && done(); };
  requestAnimationFrame(tick);
}
function blink() { if (REDUCED || document.hidden || eo < 0.99) return; tweenEye(0.06, 120, () => tweenEye(1, 160)); }
function swapEye(fn) { if (REDUCED) { fn(); return; } tweenEye(0.02, 150, () => { fn(); setTimeout(() => tweenEye(1, 260), 70); }); }   // 换头像：眨一下，睁开是新的

/* ---------- 纸面和那一堆细活：铅笔线是主页 hand() 那套（两三遍略抖的细笔，一截截深浅不一，端头出头） ---------- */
function hand(g, pts, o, R) {
  o = o || {}; const w = o.w || 0.5, al = o.a || 0.4, n = o.n || 2, jit = o.j == null ? 0.6 : o.j, ov = o.ov == null ? 3 : o.ov;
  const m = pts.length, Ls = [0]; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8)) return;
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
      const stp = Math.max(0.01, Math.min(3.2, s1 - s)); s += stp; acc += stp;
    }
  }
  g.globalAlpha = 1;
}
const arcPts = (cx, cy, r, a0, a1) => { const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 5)), o = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return o; };
const D2R = PI / 180;
function drawDeco() {
  const g = fitCanvas(deco, W, H), INK = dark ? C.PAPER : C.INK, PEN = dark ? '#9c9ca2' : C.PEN, GR = dark ? '#6e6f76' : C.GREY, BL = dark ? '#8794f2' : C.BLUE;
  g.fillStyle = dark ? C.INK : C.PAPER; g.fillRect(0, 0, W, H);
  spots(g, W, H, 1112, dark ? 'rgba(241,238,230,0.12)' : 'rgba(84,84,88,0.18)');
  const R = rng(20261112), RE = EW * ES, inEye = (x, y) => ((x - EX) / (RE + 2)) ** 2 + ((y - EY) / (HOPEN * ES + 4)) ** 2 < 1;
  // 中轴：一道过眼心的硬虚线，两头各一道短竖刻；眼角外各一截
  g.strokeStyle = GR; g.lineWidth = 0.4; g.globalAlpha = 0.45; g.setLineDash([2.2, 2.8]);
  g.beginPath(); g.moveTo(EX - RE - 34, EY + 0.5); g.lineTo(EX + RE + 34, EY + 0.5); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 0.6; g.beginPath(); [-1, 1].forEach(sx => { const x = EX + sx * RE + 0.5; g.moveTo(x, EY - 3); g.lineTo(x, EY + 4); const x2 = EX + sx * (RE + 34) + 0.5; g.moveTo(x2, EY - 1.5); g.lineTo(x2, EY + 2.5); }); g.stroke();
  // 量角弧：眼睛上方一段圆弧，每 2.5° 一道刻，逢 15° 长一点、标一个极小的数
  const RP = RE + 6, a0 = 236, a1 = 304;
  g.globalAlpha = 0.55; g.strokeStyle = INK; g.lineWidth = 0.35; g.beginPath(); g.arc(EX, EY, RP, a0 * D2R, a1 * D2R); g.stroke();
  g.beginPath();
  for (let a = a0; a <= a1 + 0.01; a += 2.5) { const big = Math.abs((a - 270) % 15) < 0.01, mid = !big && Math.abs((a - 270) % 5) < 0.01, l = big ? 4.2 : mid ? 2.6 : 1.5, c = Math.cos(a * D2R), s = Math.sin(a * D2R); g.moveTo(EX + c * RP, EY + s * RP); g.lineTo(EX + c * (RP + l), EY + s * (RP + l)); }
  g.stroke();
  g.globalAlpha = 0.7; g.fillStyle = GR; g.font = 'italic 400 6.5px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let a = 240; a <= 300; a += 15) { const c = Math.cos(a * D2R), s = Math.sin(a * D2R), t = String(Math.abs(a - 270)); g.fillText(t, EX + c * (RP + 9), EY + s * (RP + 9)); }
  // 弧顶一颗小十字准星
  g.globalAlpha = 0.6; g.strokeStyle = INK; g.lineWidth = 0.35; const ty = EY - RP - 17; g.beginPath(); g.moveTo(EX - 3.5, ty); g.lineTo(EX + 3.5, ty); g.moveTo(EX, ty - 3.5); g.lineTo(EX, ty + 3.5); g.stroke();
  g.beginPath(); g.arc(EX, ty, 1.6, 0, TAU); g.stroke();
  // 圆规弧：以眼心为圆心的几段铅笔弧，左下右上各一组
  g.strokeStyle = PEN;
  hand(g, arcPts(EX, EY, RE + 15, 152 * D2R, 196 * D2R), { w: 0.5, a: 0.34, n: 1, j: 0.4, ov: 5 }, R);
  hand(g, arcPts(EX, EY, RE + 21, 160 * D2R, 184 * D2R), { w: 0.42, a: 0.22, n: 1, j: 0.4, ov: 3 }, R);
  hand(g, arcPts(EX, EY, RE + 13, 318 * D2R, 352 * D2R), { w: 0.45, a: 0.3, n: 1, j: 0.4, ov: 4 }, R);
  hand(g, arcPts(EX, EY, RE + 13, 22 * D2R, 40 * D2R), { w: 0.42, a: 0.22, n: 1, j: 0.4, ov: 3 }, R);
  // 下半一圈点线
  g.strokeStyle = GR; g.lineWidth = 0.45; g.globalAlpha = 0.55; g.setLineDash([0.5, 2.4]); g.beginPath(); g.arc(EX, EY, RE + 7, 28 * D2R, 152 * D2R); g.stroke(); g.setLineDash([]);
  // 眼睑的铅笔底稿：顺着睁开的上下睑多描一两遍，眼角外出头
  const lidPts = (sg) => { const o = []; for (let i = 0; i <= 24; i++) { const t = -0.06 + 1.12 * i / 24, x = (1 - t) * (1 - t) * -EW + 2 * (1 - t) * t * 0 + t * t * EW, y = 2 * (1 - t) * t * (sg * (HOPEN + 0.4) * 2); o.push([EX + x * ES, EY + y * ES + sg * 1.2]); } return o; };
  g.strokeStyle = INK; hand(g, lidPts(-1), { w: 0.5, a: 0.26, n: 2, j: 0.5, ov: 4 }, R); hand(g, lidPts(1), { w: 0.42, a: 0.18, n: 1, j: 0.5, ov: 3 }, R);
  // 右下一小片铅笔排线（眼睛落在纸上的一点影）
  for (let k = 0; k < 9; k++) { const x0 = EX + RE * 0.55 + k * 3.1, y0 = EY + HOPEN * ES * 0.9 + 6 + Math.sin(k / 8 * PI) * -4; hand(g, [[x0, y0 + 7], [x0 + 6, y0]], { w: 0.42, a: 0.28, n: 1, j: 0.25, ov: 1 }, R); }
  // 颗粒：眼睛四周一圈，右上和左下密，往外疏；几颗十字星
  g.fillStyle = PEN; g.globalAlpha = 0.55; g.beginPath();
  for (let i = 0; i < 260; i++) {
    const side = R() < 0.55 ? -0.6 : 2.4, a = side + (R() - 0.5) * 1.6, q = RE + 10 + Math.pow(R(), 1.7) * 70, x = EX + Math.cos(a) * q, y = EY + Math.sin(a) * q * 0.72;
    if (!inEye(x, y) && y > 54) dot(g, x, y, 0.2 + R() * R() * 0.5);
  }
  for (let i = 0; i < 40; i++) { const x = 18 + R() * (W - 36), y = 70 + R() * (H - 120); if (!inEye(x, y)) dot(g, x, y, 0.22 + R() * 0.3); }
  g.fill();
  g.globalAlpha = 0.6; g.strokeStyle = PEN; g.lineWidth = 0.4; g.beginPath();
  [[0.78, -0.42], [0.86, 0.3], [0.17, 0.46], [0.24, -0.5]].forEach(([fx, fy]) => { const x = W * fx, y = EY + fy * RE, l = 1.8 + R() * 1.4; g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); });
  g.stroke();
  // 外眼角一粒蓝已经在 SVG 里；测绘线上的小刻度：每 12px 一道，逢四长一点（只画在左边）
  g.globalAlpha = 0.45; g.strokeStyle = GR; g.lineWidth = 0.4; g.beginPath();
  let k = 0; for (let y = lineTop + 10; y < YT - 4; y += 12, k++) { const l = k % 4 === 0 ? 4 : 2; g.moveTo(LX - l, y + 0.5); g.lineTo(LX, y + 0.5); }
  g.stroke();
  // 线头：挂在下睑上的一个小结
  g.globalAlpha = 0.9; g.fillStyle = BL; g.beginPath(); g.arc(LX + 0.25, lineTop - 0.5, 1.1, 0, TAU); g.fill();
  g.globalAlpha = 1;
}

/* ---------- 读数 ---------- */
let ST = { off: null, age: null, err: '', auth: false, model: null, mErr: '' };
function short(sec) { if (sec == null || isNaN(sec)) return ''; const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? '刚刚' : m < 60 ? m + ' 分钟前' : h < 24 ? h + ' 小时前' : d < 60 ? d + ' 天前' : '很久以前'; }
function paintReadings() {
  const vs = $('vState'), vm = $('vModel');
  if (LIVE && !KEY) { vs.className = 'v dim'; vs.textContent = '—'; vm.className = 'v mono dim'; vm.textContent = '—'; return; }
  if (ST.off == null && !ST.err) vs.innerHTML = '<span class="dim">…</span>';
  else if (ST.err) vs.innerHTML = '<span class="dot off"></span>没应门';
  else if (ST.auth) vs.innerHTML = '<span class="dot off"></span>钥匙不认';
  else { const a = short(ST.age); vs.innerHTML = `<span class="dot${ST.off ? ' off' : ''}"></span>${ST.off ? '睡着' : '醒着'}${a ? `<small>上一句 ${esc(a)}</small>` : ''}`; }
  vs.className = 'v';
  vm.className = 'v mono' + (ST.model ? '' : ' dim');
  vm.textContent = GROUP ? '—' : ST.model ? ST.model : ST.mErr === 'none' ? '还没报' : ST.mErr ? '读不到' : '…';
}
function probe() {
  if (!LIVE) { ST = { off: false, age: 40, err: '', auth: false, model: 'Model Seven', mErr: '' }; paintReadings(); return; }
  if (!KEY) { paintReadings(); return; }
  fetch(RELAY + '/healthz', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(h => { ST.off = !(h && h.plugin_subs > 0); ST.err = ''; }, () => { ST.off = true; ST.err = 'down'; }).then(paintReadings);
  api('/app/status').then(s => { ST.age = s && s.last_msg_age_sec; ST.auth = false; paintReadings(); }, e => { if (e.auth) { ST.auth = true; paintReadings(); } });
  if (!GROUP) api('/app/meter').then(m => { ST.model = (m && m.model && (m.model.name || m.model.id)) || null; ST.mErr = ST.model ? '' : 'none'; paintReadings(); }, e => { ST.mErr = e.status === 503 ? 'none' : 'err'; paintReadings(); });
}

/* ---------- 名字、备注、我的头像 ---------- */
function paint() {
  $('vName').textContent = shown();
  const o = $('vOri'); o.hidden = !remark(); o.textContent = remark() ? '原名 ' + NAME : '';
  if (!editing) { const v = $('vRemark'); v.textContent = remark() || '未写'; v.classList.toggle('empty', !remark()); }
  const me = ls(K_ME), mel = $('meAv');
  mel.innerHTML = okURL(me) ? `<img alt="" src="${esc(me)}">` : esc(initial(ME));
  $('eyeB').setAttribute('aria-label', '换' + shown() + '的头像');
  document.title = shown() + ' · 档案';
  buildEye();
}
let editing = false, inp = null;
function startEdit() {
  if (editing) return; editing = true;
  const v = $('vRemark'); inp = document.createElement('input'); inp.maxLength = 16; inp.autocomplete = 'off'; inp.spellcheck = false; inp.value = remark(); inp.setAttribute('aria-label', '备注'); inp.enterKeyHint = 'done';
  v.hidden = true; v.after(inp); inp.focus(); try { inp.select(); } catch (e) {}
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.stopPropagation(); cancel(); } });
  inp.addEventListener('blur', commit);
}
function endEdit() { editing = false; if (inp) { const i = inp; inp = null; i.remove(); } $('vRemark').hidden = false; }
function cancel() { if (!editing) return; endEdit(); paint(); }
function commit() {   // 同 profile.js commit()：空的就删掉这条备注
  if (!editing || !inp) return;
  const v = (inp.value || '').trim(); endEdit();
  if (v !== remark()) { lset(K_RK, v || null); touched(); }
  paint();
}
$('vRemark').addEventListener('click', startEdit);

/* ---------- 换头像：中心裁方、压到 256（同 profile.js 170–191） ---------- */
function pick(input, keyOf, isAi) {   // keyOf：现取键名（这位的键要等 resolve() 之后才定）
  input.onchange = () => {
    const f = input.files && input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let out = r.result;
        try {
          const S = 256, side = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = S;
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
          x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
          out = c.toDataURL('image/jpeg', 0.88);
        } catch (e) {}
        const apply = () => { lset(keyOf(), out); touched(); paint(); };
        if (isAi) swapEye(apply); else apply();
      };
      img.onerror = () => toast('这张图打不开');
      img.src = r.result;
    };
    r.readAsDataURL(f); input.value = '';
  };
}
pick($('f1'), () => K_AV, true); pick($('f2'), () => K_ME, false);
$('eyeB').onclick = () => $('f1').click();
$('bAv').onclick = () => $('f1').click();
$('bMe').onclick = () => $('f2').click();

/* ---------- 小提示 ---------- */
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

/* ---------- 起步 ---------- */
const info = homeInfo('who', 0, dark ? 1 : 0);
$('back').addEventListener('click', () => { commit(); leaveHome(info, $('back')); });
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
setInterval(() => { if (!window.__leaving && Math.random() < 0.6) blink(); }, 4200);
document.addEventListener('visibilitychange', () => { if (!document.hidden && LIVE) { probe(); sync(); } });
function loadConfig() {   // 同聊天页：Nyx 的 config.js 给第一只的地址和名字；?demo=1 时不装
  return new Promise(ok => { if (!LIVE || window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
}
setupGrain();
loadConfig().then(() => {
  resolve();
  if (!LIVE) MEM.set(K_AV, geoAv());
  paint(); layout(); paintReadings();
  if (!LIVE) setSync('demo'); else if (!ls('nyx_key')) setSync('nokey'); else setSync('');
  probe(); sync(); if (LIVE) setTimeout(sync, 1500);
  revealIn(info, stage, () => { window.__revealed = true; });
  window.__ready = true;
});
window.__who = { state: () => ({ relay: RELAY, home: HOME, name: NAME, shown: shown(), remark: remark(), kAv: K_AV, kRk: K_RK, av: avNow().slice(0, 30), avLen: (ls(K_AV) || '').length, me: (ls(K_ME) || '').slice(0, 30), sync: syncNote, ready, st: ST, eo, editing }), layout, blink };
})();
