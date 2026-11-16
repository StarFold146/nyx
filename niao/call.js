/*!
 * call.js —— 语音通话：一张正在走纸的记录纸
 *
 * 本文件为新写（2026-11，从零写成，没有参照任何已有的通话实现）。
 * 许可：CC BY-NC 4.0（署名—非商业性使用）。署名：StarFold146。
 *
 * 对外只有 window.NyxCall：
 *   NyxCall.isOpen()      通话是否在进行（收成小条时也算）
 *   NyxCall.open()        拨出 / 接起，返回 Promise（后台应了 start 就兑现；麦克风另外要，不等它）
 *   NyxCall.close()       挂断
 *   NyxCall.speak(text)   把一段话排进朗读队列（来电第一句、流里的回话都走这里）
 * 从 window.NyxChat 取：raw(path, opt)（带钥匙的 fetch）、ai（对方名字）、on(type, fn)（订流里的事件，可无）、
 *   avatar（头像地址，可无；没有就看 body 上的 --vc-av，再没有画一枚默认邮票）。
 * 接口见同目录「接口.md」。localStorage nyx_call_barge = "0" 关掉插话打断。
 *
 * 画面：一根竖线从上到下，带刻度；蓝点是笔尖，停在靠下三分之一处，纸往上走。
 *   她的声音画在线左，铅笔灰的折线；对方的声音画在线右，蓝色的小点阵。字幕钉在各自那段波形旁边，跟着纸走。
 */
(function () {
  'use strict';
  if (window.NyxCall && window.NyxCall.paper) return;

  /* ---------- 尺寸和颜色 ---------- */
  const PPS = 14;                 // 纸每秒走多少 px
  const RING = 4096, MASK = RING - 1;   // 音量按「纸上的每一 px」存一格，环形
  let AMP = 38;                 // 她那侧折线一般最远伸出多少 px（尖会再出去一点）
  const CELL = 3; let CELLS = 8;      // 对方那侧点阵：格距、最多几格
  let GAP = 40;                 // 字幕离线多远
  let RAIL = 32;                // 纸带的轨离线多远
  const GRID = 7;                 // 轨内横格的间距（每五格一道稍深的）
  const HUSH = 0.9;               // 静下来多久算一句说完（秒）
  const PAL = {
    light: { paper: '#f1eee6', ink: '#16171c', pen: '#55575c', grey: '#97989c', blue: '#2238c0' },
    dark: { paper: '#16171c', ink: '#f1eee6', pen: '#9c9ca2', grey: '#6e6f76', blue: '#8794f2' }
  };
  const TAU = Math.PI * 2;
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + ('0' + s % 60).slice(-2); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const NC = () => window.NyxChat || {};
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- 样式 ---------- */
  const CSS = `
.nyxc{position:absolute;inset:0;z-index:60;overflow:hidden;background:var(--nc-bg);color:var(--nc-fg);
  --nc-bg:var(--bg,#f1eee6);--nc-fg:var(--fg,#16171c);--nc-fg2:var(--fg2,#55575c);--nc-fg3:var(--fg3,#97989c);--nc-blue:#2238c0;--nc-card:#fbfaf5;--lx:44%;--gap:40px;--mg:20px;
  font-family:var(--fz,"Noto Serif SC","Songti SC","STSong",serif);-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;animation:ncIn .26s ease both}
.nyxc.fix{position:fixed}
body.dark .nyxc,body.dark .nyxc-mini{--nc-bg:var(--bg,#16171c);--nc-fg:var(--fg,#f1eee6);--nc-fg2:var(--fg2,#9c9ca2);--nc-fg3:var(--fg3,#6e6f76);--nc-blue:#8794f2;--nc-card:#2b2c33}
.nyxc.away{display:none}
.nyxc.out{opacity:0;transition:opacity .24s ease}
.nyxc *{box-sizing:border-box;margin:0;padding:0}
.nyxc button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.nyxc button:focus-visible{outline:.5px solid var(--nc-fg3);outline-offset:-6px}
.nc-cv,.nc-bg{position:absolute;left:0;top:0;display:block;pointer-events:none}
.nc-caps{position:absolute;left:0;right:0;top:0;overflow:hidden;pointer-events:none;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,transparent 15%,#000 44%,#000 100%);mask-image:linear-gradient(to bottom,transparent 0,transparent 15%,#000 44%,#000 100%)}
.nc-roll{position:absolute;left:0;right:0;top:0;height:0;will-change:transform}
.nc-c{position:absolute;font-size:11.5px;line-height:1.55;letter-spacing:.03em;overflow-wrap:anywhere;word-break:break-word;text-wrap:balance;opacity:.62;transition:opacity .7s}
.nc-c.me{opacity:.8}
.nc-c.now,.nc-c.me.last{opacity:1}
.nc-c.me{right:calc(100% - var(--lx) + var(--gap));max-width:calc(var(--lx) - var(--gap) - var(--mg));color:var(--nc-fg2);font-weight:400;text-align:right}
.nc-c.ai{left:calc(var(--lx) + var(--gap));max-width:calc(100% - var(--lx) - var(--gap) - var(--mg));color:var(--nc-fg);font-weight:400}
.nc-who{position:absolute;left:22px;top:calc(24px + env(safe-area-inset-top,0px));display:flex;align-items:flex-end;gap:9px;line-height:1}
.nc-stamp{width:26px;height:32px;display:block;overflow:visible;transform:rotate(-3deg);filter:drop-shadow(0 .5px .7px rgba(22,23,28,.22))}
.nc-stamp .card{fill:var(--nc-card)}
.nc-stamp .frame{fill:none;stroke:var(--nc-blue);stroke-width:.35;opacity:.7}
.nc-stamp .sun{fill:var(--nc-blue)}
.nc-stamp .hl{fill:none;stroke:var(--nc-fg3);stroke-width:.4}
.nc-who b{display:block;font-weight:600;font-size:11px;letter-spacing:.12em;color:var(--nc-fg)}
.nc-who time{display:block;margin-top:6px;margin-bottom:1px;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:8.5px;letter-spacing:.04em;color:var(--nc-fg2)}
.nc-st{position:absolute;font-size:9px;line-height:1;letter-spacing:.24em;color:var(--nc-fg2);font-weight:300;white-space:nowrap;pointer-events:none;transition:opacity .2s}
.nyxc.ended .nc-st{opacity:0}
.nc-err{position:absolute;left:22px;bottom:calc(68px + env(safe-area-inset-bottom,0px));max-width:calc(100% - 44px);padding-left:8px;border-left:.5px solid var(--nc-blue);
  font-size:10px;line-height:14px;letter-spacing:.08em;color:var(--nc-fg2);font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nc-err[hidden]{display:none}
.nc-ctl{position:absolute;left:12px;right:10px;bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;align-items:center}
.nc-ctl i{flex:1}
.nc-ctl button{width:52px;height:52px;padding:11px;color:var(--nc-fg2);flex:none}
.nc-ctl button[hidden]{display:none}
.nc-ctl button.on{color:var(--nc-blue)}
.nc-ctl svg{width:100%;height:100%;display:block;fill:none;stroke:currentColor;stroke-width:.8;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:8;overflow:visible}
.nc-ctl svg .fb{fill:currentColor;stroke:none}
.nc-ctl svg .x{opacity:0}
.nc-ctl button.on svg .x{opacity:1}
.nc-ctl .nc-end{width:68px;padding:0;margin-left:auto;display:grid;place-items:center}
.nc-end span{width:44px;height:22px;background:var(--nc-fg);display:grid;place-items:center}
.nc-end svg{width:17px;height:17px;fill:var(--nc-bg);stroke:none}
.nyxc-mini{position:absolute;left:0;right:0;top:env(safe-area-inset-top,0px);height:0;z-index:61;pointer-events:none;
  --nc-bg:var(--bg,#f1eee6);--nc-fg2:var(--fg2,#55575c);--nc-blue:#2238c0;animation:ncIn .3s ease both}
.nyxc-mini.fix{position:fixed}
.nyxc-mini::before{content:"";position:absolute;left:0;right:0;top:5px;border-top:.5px solid var(--nc-blue);opacity:.55}
.nyxc-mini button{position:absolute;left:50%;top:0;width:104px;height:40px;margin-left:-52px;pointer-events:auto;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.nyxc-mini button::before{content:"";position:absolute;left:50%;top:5px;height:9px;border-left:.5px solid var(--nc-blue)}
.nyxc-mini button i{position:absolute;left:50%;top:13px;width:5.4px;height:5.4px;margin-left:-2.7px;border-radius:50%;background:var(--nc-blue)}
.nyxc-mini button time{position:absolute;left:calc(50% + 9px);top:11.5px;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:8.5px;line-height:9px;letter-spacing:.04em;color:var(--nc-fg2);
  background:var(--nc-bg);padding:0 3px}
@keyframes ncIn{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.nyxc,.nyxc-mini{animation:none}.nc-c{transition:none}}
`;
  /* 图标：24 的格子，细线平头，每枚带一小块实心（同聊天页页眉那两枚的刻法） */
  const ICON = {
    mute: '<path d="M9.6 6.4a2.4 2.4 0 0 1 4.8 0v4.8a2.4 2.4 0 0 1-4.8 0Z"/><path class="fb" d="M9.6 8.8h4.8v2.4a2.4 2.4 0 0 1-4.8 0Z"/><path d="M6.6 11a5.4 5.4 0 0 0 10.8 0M12 16.4v3.2M9.2 19.6h5.6"/><path class="x" d="M5 4.6 19 19.4"/>',
    out: '<path d="M4.8 9.8v4.4h3l4 3.4V6.4l-4 3.4Z"/><path class="fb" d="M4.8 9.8h3v4.4h-3Z"/><path d="M14.8 9.6c1 1.4 1 3.4 0 4.8M17.2 7.4c2 2.7 2 6.5 0 9.2"/>',
    mini: '<path d="M4.6 5.4h14.8"/><path class="fb" d="M10.2 5.4h3.6v1.9h-3.6Z"/><path d="M12 19.2v-8.4M8.4 14.2 12 10.6l3.6 3.6"/>',
    end: '<path d="M3 14.9c0-2.7 4-5.2 9-5.2s9 2.5 9 5.2v1.5h-4.9v-2.3c-1.3-.5-2.7-.7-4.1-.7s-2.8.2-4.1.7v2.3H3Z"/>'
  };

  /* ---------- 状态 ---------- */
  let on = false, sim = false, hold = false;
  let root = null, miniEl = null, cv = null, g = null, bgCv = null, strip = null, grainTile = null, grainFor = '', whoEl = null, recNo = '0142', capsEl = null, roll = null, stEl = null, errEl = null, timeEl = null, ctlEl = null;
  let W = 0, H = 0, DPR = 1, LX = 0, PENY = 0, LINE_END = 0;
  let t0 = 0, wall0 = 0, simT = 0, simRun = 0, endT = -1, snapT = 0, stampAt = 0, callId = '';
  const her = new Float32Array(RING), peer = new Float32Array(RING);
  let head = -1, lastInk = 0, tipH = 0, tipP = 0, tipPh = 0;
  let caps = [];
  let raf = 0, lastDraw = 0, dirty = true, beatT = 0, lastSec = -1, wasDark = null;
  let ctx = null, outAn = null, outBuf = null, au = null, auWired = false, auPrimed = false, stream = null, micAn = null, micBuf = null, lastTracks = [];
  let micBusy = false, micSrc = null, lastOut = 0;
  let micOk = false, muted = false, authDead = false, connected = false;
  let rec = null, utt = null, floor = 0.008, loudRun = 0, MIME = '';
  let queue = [], busy = false, gen = 0, cur = null, spk = null, ttsOff = false;
  let pending = 0, awaiting = 0, typing = 0, forced = '', label = '';
  let subbed = false, ownStream = null, seen = new Set(), wake = null, errKind = '', errT = 0;
  const stats = { start: 0, end: 0, voice: 0, tts: 0, ttsFail: 0, synth: 0, hush: 0, played: 0, blocked: 0, barge: 0, dropped: 0, remic: 0 };

  const clock = () => endT >= 0 ? endT : sim ? simT + (simRun ? (performance.now() - simRun) / 1000 : 0) : (performance.now() - t0) / 1000;
  const viewT = () => RM.matches && endT < 0 ? snapT : clock();
  const isDark = () => document.body.classList.contains('dark');

  /* ---------- 跟后台说话 ---------- */
  function raw(path, opt) {
    const n = NC();
    if (typeof n.raw === 'function') return n.raw(path, opt);
    opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + (n.key || '') }, opt.headers || {});
    return fetch((n.relay || '/relay') + path, opt);
  }
  const postJSON = (path, body, more) => raw(path, Object.assign({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, more || {}));

  /* 一行小字。kind：mic / auth 一直留着；net / soft 过几秒自己退 */
  function say(kind, text) {
    if (!errEl) return;
    errKind = kind; errEl.textContent = text; errEl.hidden = false; clearTimeout(errT);
    if (kind === 'net' || kind === 'soft') errT = setTimeout(() => unsay(kind), 7000);
  }
  function unsay(kind) { if (errEl && (!kind || errKind === kind)) { errEl.hidden = true; errKind = ''; } }
  function authFail() { authDead = true; stopRec(null); utt = null; say('auth', '钥匙失效了，回聊天页重新进门'); }

  /* ---------- 流：聊天页给了订阅口就用它的，没有就自己连一条 ---------- */
  function listen() {
    const n = NC();
    if (typeof n.on === 'function') {
      if (!subbed) { subbed = true; n.on('message', onMsg); n.on('typing', e => { typing = e && e.active ? performance.now() : 0; }); }
      return;
    }
    openOwn();
  }
  function openOwn() {
    const ctl = ownStream = new AbortController();
    raw('/app/stream', { signal: ctl.signal, cache: 'no-store' }).then(r => {
      if (r.status === 401) { authFail(); return; }
      if (!r.ok || !r.body) throw new Error('stream ' + r.status);
      unsay('net');
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      const eat = block => {
        const data = block.split('\n').filter(l => l.indexOf('data:') === 0).map(l => l.slice(5).trim()).join('\n');
        if (!data) return;
        let ev; try { ev = JSON.parse(data); } catch (e) { return; }
        if (ev.type === 'typing') typing = ev.active ? performance.now() : 0; else if (ev.id != null && ev.from) onMsg(ev);
      };
      const pump = () => rd.read().then(c => {
        if (c.done) throw new Error('closed');
        buf += dec.decode(c.value, { stream: true }).replace(/\r\n/g, '\n');
        let i; while ((i = buf.indexOf('\n\n')) >= 0) { eat(buf.slice(0, i)); buf = buf.slice(i + 2); }
        return pump();
      });
      return pump();
    }).catch(() => {
      if (ctl.signal.aborted || !on || ownStream !== ctl) return;
      say('net', '网断了，接上以后接着说');
      setTimeout(() => { if (on && ownStream === ctl) openOwn(); }, 3000);
    });
  }
  function onMsg(ev) {
    if (!on || sim || !ev || ev.from !== 'ai' || (ev.kind || 'reply') !== 'reply') return;
    if (ev.id != null) { if (seen.has(ev.id)) return; seen.add(ev.id); }
    const at = ev.ts ? new Date(ev.ts).getTime() : NaN;
    if (at === at && at < wall0 - 3000) return;   // 拨出之前的旧话不念
    awaiting = 0; typing = 0;
    speak(ev.text);
  }

  /* ---------- 纸：音量按 px 入格 ---------- */
  function advance(t) {
    const p = Math.floor(t * PPS);
    if (p <= head) return;
    for (let q = Math.max(head + 1, p - RING + 1); q <= p; q++) { her[q & MASK] = 0; peer[q & MASK] = 0; }
    head = p;
  }
  function ink(buf, a) { if (head < 0) return; const i = head & MASK; if (a > buf[i]) buf[i] = a; lastInk = performance.now(); }
  /* 一段像说话那样一顿一顿的假音量（演示页摆场景、浏览器自带朗读时用） */
  function env(t, seed) {
    const k = Math.floor(t * 3.3), syl = hash(k + seed * 131), ph = t * 3.3 - k;
    return (syl < 0.13 ? 0 : 0.22 + 0.78 * syl) * Math.pow(Math.sin(ph * Math.PI), 0.55) * (0.82 + 0.18 * Math.sin(t * 23 + seed));
  }

  /* ---------- 字幕 ---------- */
  function addCap(side, t, text) {
    if (!roll) return;
    const el = document.createElement('p'); el.className = 'nc-c ' + side; el.textContent = text;
    roll.appendChild(el);
    caps.push({ side, t0: t, el });
    while (caps.length > 40) { const c = caps.shift(); c.el.remove(); }
    caps.forEach((c, i) => c.el.classList.toggle('now', i === caps.length - 1));
    let lastMe = -1; caps.forEach((c, i) => { if (c.side === 'me') lastMe = i; }); caps.forEach((c, i) => c.el.classList.toggle('last', i === lastMe));
    layout(); snapT = clock(); dirty = true;
  }
  /* 同一侧的字不叠：从最新的往回排，旧的被往上让 */
  function layout() {
    ['me', 'ai'].forEach(side => {
      let lim = Infinity;
      for (let i = caps.length - 1; i >= 0; i--) {
        const c = caps[i]; if (c.side !== side) continue;
        const h = c.el.offsetHeight; let top = c.t0 * PPS - 9;
        if (top + h > lim - 6) top = lim - 6 - h;
        c.el.style.top = top + 'px'; lim = top; c.top = top; c.h = h;
      }
    });
  }

  /* ---------- 界面 ---------- */
  function avatar() {
    const n = NC(); let a = n.avatar || '';
    if (!a) { const m = /url\((['"]?)(.+?)\1\)/.exec(document.body.style.getPropertyValue('--vc-av') || ''); if (m) a = m[2]; }
    return /^(data:image\/|\/|https?:)/.test(a) ? a : '';
  }
  function stampSVG() {
    let holes = '';
    for (let i = 0; i < 8; i++) { const x = (1.75 + i * 3.214).toFixed(2); holes += `<circle cx="${x}" cy="0" r="1.05"/><circle cx="${x}" cy="32" r="1.05"/>`; }
    for (let i = 0; i < 10; i++) { const y = (1.6 + i * 3.2).toFixed(2); holes += `<circle cx="0" cy="${y}" r="1.05"/><circle cx="26" cy="${y}" r="1.05"/>`; }
    const av = avatar();
    const face = av ? `<image href="${esc(av)}" x="3.2" y="3.2" width="19.6" height="25.6" preserveAspectRatio="xMidYMid slice"/>`
      : '<circle class="sun" cx="13" cy="12.6" r="3.1"/><path class="hl" d="M6 20.4h14M8 23h10M10.4 25.6h5.2"/>';
    return `<defs><mask id="ncperf"><rect width="26" height="32" fill="#fff"/><g fill="#000">${holes}</g></mask></defs><g mask="url(#ncperf)"><rect class="card" width="26" height="32"/>${face}<rect class="frame" x="3.2" y="3.2" width="19.6" height="25.6"/></g>`;
  }
  function build() {
    if (!document.getElementById('nyxc-css')) { const s = document.createElement('style'); s.id = 'nyxc-css'; s.textContent = CSS; document.head.appendChild(s); }
    const host = document.getElementById('stage') || document.body;
    root = document.createElement('div'); root.className = 'nyxc' + (host === document.body ? ' fix' : '');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '语音通话');
    const btn = (a, name) => `<button data-a="${a}" aria-label="${name}" title="${name}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[a]}</svg></button>`;
    root.innerHTML = '<canvas class="nc-bg" aria-hidden="true"></canvas><canvas class="nc-cv" aria-hidden="true"></canvas>' +
      '<div class="nc-caps" aria-live="polite"><div class="nc-roll"></div></div>' +
      `<div class="nc-who"><svg class="nc-stamp" viewBox="0 0 26 32" aria-hidden="true">${stampSVG()}</svg><div><b>${esc(NC().ai || '')}</b><time>00:00</time></div></div>` +
      '<span class="nc-st"></span><p class="nc-err" role="status" hidden></p>' +
      `<div class="nc-ctl">${btn('mute', '静音')}${btn('out', '换出声的地方').replace('<button', '<button hidden')}${btn('mini', '收起')}<i></i>` +
      `<button data-a="end" class="nc-end" aria-label="挂断" title="挂断"><span><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.end}</svg></span></button></div>`;
    host.appendChild(root);
    bgCv = root.querySelector('.nc-bg'); whoEl = root.querySelector('.nc-who'); cv = root.querySelector('.nc-cv'); g = cv.getContext('2d'); capsEl = root.querySelector('.nc-caps'); roll = root.querySelector('.nc-roll');
    stEl = root.querySelector('.nc-st'); errEl = root.querySelector('.nc-err'); timeEl = root.querySelector('time'); ctlEl = root.querySelector('.nc-ctl');
    ctlEl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'end') close(); else if (a === 'mini') shrink(); else if (a === 'mute') setMute(!muted); else if (a === 'out') nextSink();
    });
    root.addEventListener('pointerdown', unlock, { passive: true });
    fit();
  }
  function fit() {
    if (!root || root.classList.contains('away')) return;
    W = root.clientWidth; H = root.clientHeight; DPR = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    LX = Math.round(W * 0.44 * DPR) / DPR; PENY = Math.round(H * 0.66); LINE_END = ctlEl.offsetTop - 30;
    const slim = W < 360;   // 窄屏把轨收窄、字幕往线靠，她那侧一行才放得下七八个字
    RAIL = slim ? 24 : 32; GAP = slim ? 30 : 40; AMP = RAIL + 6; CELLS = slim ? 7 : 8;
    root.style.setProperty('--lx', LX + 'px'); root.style.setProperty('--gap', GAP + 'px'); root.style.setProperty('--mg', (slim ? 13 : 20) + 'px');
    capsEl.style.height = LINE_END + 'px';
    stEl.style.left = (LX + 11) + 'px'; stEl.style.top = (PENY + 8) + 'px';
    layout(); bake(); dirty = true;
  }
  function setLabel() {
    let s = forced || (endT >= 0 ? '' : cur ? '在说' : muted ? '静音' : (utt && utt.voiced > 90) ? '在听' : !connected ? '拨号' : (busy || pending > 0 || (typing && performance.now() - typing < 30000) || (awaiting && performance.now() - awaiting < 45000)) ? '在想' : '在听');
    if (s !== label) { label = s; if (stEl) stEl.textContent = s; snapT = clock(); dirty = true; }
  }


  /* ---------- 底纸：纸纹、轨和格、票头、草稿线。都烤进一张不动的画布，只在尺寸或深浅变了时重画 ---------- */
  function grain(dark) {   // 同主页的办法：一张小噪点贴图铺满；页面自己有 #grain 那层时这里不再铺
    const key = (dark ? 'd' : 'l') + DPR; if (grainTile && grainFor === key) return grainTile;
    const n = 160, cell = Math.max(1, Math.round(DPR * 0.75)), a = document.createElement('canvas'); a.width = a.height = n;
    const ax = a.getContext('2d'), im = ax.createImageData(n, n), d = im.data;
    for (let i = 0; i < n * n; i++) {
      const r = hash(i * 1.37 + 5), q = hash(i * 0.73 + 91), o = i * 4; if (r < 0.42) continue;
      if (dark) { if (r < 0.8) { d[o] = 0; d[o + 1] = 0; d[o + 2] = 2; d[o + 3] = 255 * (0.03 + q * 0.1); } else { d[o] = 241; d[o + 1] = 238; d[o + 2] = 230; d[o + 3] = 255 * (0.006 + q * 0.03); } }
      else if (r < 0.8) { d[o] = 66; d[o + 1] = 66; d[o + 2] = 70; d[o + 3] = 255 * (0.012 + q * 0.07); } else { d[o] = 255; d[o + 1] = 253; d[o + 2] = 246; d[o + 3] = 255 * (0.03 + q * 0.11); }
    }
    ax.putImageData(im, 0, 0);
    const t = document.createElement('canvas'); t.width = t.height = n * cell; const tx = t.getContext('2d'); tx.imageSmoothingEnabled = false; tx.drawImage(a, 0, 0, n * cell, n * cell);
    grainFor = key; return grainTile = t;
  }
  function bake() {
    if (!bgCv || !W) return;
    const dark = isDark(), C = dark ? PAL.dark : PAL.light, b = bgCv.getContext('2d'), k = dark ? 0.8 : 1;
    bgCv.width = cv.width; bgCv.height = cv.height; bgCv.style.width = W + 'px'; bgCv.style.height = H + 'px';
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bgCv.width, bgCv.height);
    if (!document.getElementById('grain')) { b.fillStyle = b.createPattern(grain(dark), 'repeat'); b.fillRect(0, 0, bgCv.width, bgCv.height); }
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const ln = (x1, y1, x2, y2) => { b.beginPath(); b.moveTo(x1, y1); b.lineTo(x2, y2); b.stroke(); };
    // 轨：线两侧各一条淡边，轨内几道更淡的竖格
    b.strokeStyle = C.blue; b.lineWidth = 0.4; b.globalAlpha = 0.2 * k; ln(LX - RAIL, 0, LX - RAIL, LINE_END); ln(LX + RAIL, 0, LX + RAIL, LINE_END);
    b.strokeStyle = C.grey; b.lineWidth = 0.3; b.globalAlpha = 0.13 * k; for (let i = 1; i * 8 < RAIL - 2; i++) { ln(LX - i * 8, 0, LX - i * 8, LINE_END); ln(LX + i * 8, 0, LX + i * 8, LINE_END); }
    b.globalAlpha = 0.3 * k; b.lineWidth = 0.4; ln(LX - RAIL, LINE_END, LX - RAIL + 4, LINE_END); ln(LX + RAIL - 4, LINE_END, LX + RAIL, LINE_END);

    // 票头：左上那一撮下面，双线、套准十字、三行极小的等宽字、一小段比例尺
    const x0 = whoEl.offsetLeft, y0 = whoEl.offsetTop + whoEl.offsetHeight + 13, d = new Date(wall0 || Date.now()), p2 = n => ('0' + n).slice(-2);
    b.strokeStyle = C.pen; b.globalAlpha = 0.55 * k; b.lineWidth = 0.35; ln(x0, y0, x0 + 62, y0); ln(x0, y0 + 1.8, x0 + 62, y0 + 1.8);
    b.globalAlpha = 0.5 * k; b.lineWidth = 0.3; b.beginPath(); b.arc(x0 + 73, y0 + 0.9, 2.8, 0, TAU); b.stroke(); ln(x0 + 67.5, y0 + 0.9, x0 + 78.5, y0 + 0.9); ln(x0 + 73, y0 - 4.6, x0 + 73, y0 + 6.4);
    b.fillStyle = C.grey; b.globalAlpha = (dark ? 0.8 : 0.95); b.textAlign = 'left'; b.textBaseline = 'alphabetic';
    b.font = '400 7.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace,"Noto Serif SC","Songti SC"'; try { b.letterSpacing = '0.5px'; } catch (e) {}
    b.fillText('REC N°' + recNo, x0, y0 + 12.5);
    b.fillText(p2(d.getMonth() + 1) + '·' + p2(d.getDate()) + '  ' + p2(d.getHours()) + ':' + p2(d.getMinutes()), x0, y0 + 22.5);
    b.fillText('L · 手  /  R · 机', x0, y0 + 32.5);
    try { b.letterSpacing = '0px'; } catch (e) {}
    b.strokeStyle = C.grey; b.lineWidth = 0.3; b.globalAlpha = 0.7 * k; ln(x0, y0 + 40, x0 + 56, y0 + 40);
    for (let i = 0; i <= 14; i++) ln(x0 + i * 4, y0 + 40, x0 + i * 4, y0 + 40 - (i % 7 === 0 ? 4 : i % 2 ? 1.4 : 2.4));
    b.fillStyle = C.blue; b.globalAlpha = 0.85; b.fillRect(x0 + 60, y0 + 37.4, 2.6, 2.6);

    // （原来这里有几根不动的草稿线，11/16 撤了：右下角只留跟着声音走的水纹）
    if (0) {
    const R = Math.min(W - LX - 14, 210), wob = (i, s) => (hash(i * 3.1 + s) - 0.5);
    const pencil = (pts, a, lw) => { b.globalAlpha = a; b.lineWidth = lw; b.beginPath(); pts.forEach((p, i) => i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1])); b.stroke(); };
    b.strokeStyle = C.pen; b.lineCap = 'round'; b.lineJoin = 'round';
    [[0.07, 0.83, R, 1], [0.2, 0.62, R * 1.012, 2], [0.3, 0.72, R * 0.6, 3]].forEach(([a0, a1, r, s]) => {
      const pts = []; for (let i = 0; i <= 26; i++) { const a = a0 + (a1 - a0) * i / 26, rr = r + wob(i, s) * 0.7 + Math.sin(i * 0.33 + s) * 0.9; pts.push([LX + Math.cos(a) * rr, PENY + Math.sin(a) * rr]); }
      pencil(pts, (s === 2 ? 0.12 : s === 3 ? 0.16 : 0.24) * k, 0.35);
    });
    [[0.2, 0.34, 1.1, 4], [0.47, 0.22, 1.16, 5], [0.71, 0.4, 1.06, 6]].forEach(([a, f0, f1, s]) => {
      const pts = []; for (let i = 0; i <= 9; i++) { const rr = R * (f0 + (f1 - f0) * i / 9), aa = a + wob(i, s) * 0.006 + (i / 9 - 0.5) * 0.012; pts.push([LX + Math.cos(aa) * rr, PENY + Math.sin(aa) * rr]); }
      pencil(pts, (0.2 + (s % 2) * 0.06) * k, 0.35);
      const tx = LX + Math.cos(a) * R, ty = PENY + Math.sin(a) * R, nx = -Math.sin(a), ny = Math.cos(a);   // 斜线过弧的地方一小道记号
      pencil([[tx - nx * 2.6, ty - ny * 2.6], [tx + nx * 2.6, ty + ny * 2.6]], 0.34 * k, 0.35);
    });
    { const a = 0.47, x = LX + Math.cos(a) * R * 0.6, y = PENY + Math.sin(a) * R * 0.6; b.globalAlpha = 0.4 * k; b.lineWidth = 0.3; b.beginPath(); b.arc(x, y, 1.7, 0, TAU); b.stroke();
      b.fillStyle = C.grey; b.globalAlpha = 0.7 * k; b.font = 'italic 300 7px "Cormorant Garamond","Cormorant",Georgia,serif'; b.fillText('r', x + 4.5, y - 3); }
    }
    b.globalAlpha = 1;

    // 轨内的横格：单独一小条，每帧只贴一次，跟着纸走
    const P = GRID * 5; strip = strip || document.createElement('canvas');
    strip.width = Math.round(RAIL * 2 * DPR); strip.height = Math.round((H + P) * DPR);
    const sx = strip.getContext('2d'); sx.setTransform(DPR, 0, 0, DPR, 0, 0); sx.clearRect(0, 0, RAIL * 2, H + P); sx.strokeStyle = C.grey;
    for (let y = 0, i = 0; y <= H + P; y += GRID, i++) { const y5 = i % 5 === 0, yy = Math.round(y * DPR) / DPR + 0.5 / DPR; sx.globalAlpha = (y5 ? 0.2 : 0.11) * k; sx.lineWidth = 0.3; sx.beginPath(); sx.moveTo(0.5, yy); sx.lineTo(RAIL * 2 - 0.5, yy); sx.stroke(); }
  }

  /* ---------- 画 ---------- */
  const fade = y => { const v = clamp((y - H * 0.13) / (H * 0.29), 0, 1); return v * v * (3 - 2 * v); };
  function draw() {
    const C = isDark() ? PAL.dark : PAL.light, t = viewT(), np = t * PPS;
    const snap = v => Math.round(v * DPR) / DPR, yOf = p => PENY - (np - p);
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    const seg = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const yStart = yOf(0), yTop = Math.max(0, yStart);
    if (strip) {   // 横格跟着纸走
      const P = GRID * 5, oy = ((((PENY - np) % P) + P) % P) - P;
      g.save(); g.beginPath(); g.rect(LX - RAIL, 0, RAIL * 2, LINE_END); g.clip(); g.drawImage(strip, LX - RAIL, oy, RAIL * 2, strip.height / DPR); g.restore();
    }

    // 线：写过的一段实，没写到的一段虚
    g.strokeStyle = C.blue; g.lineWidth = 0.5; g.lineCap = 'butt';
    g.globalAlpha = 0.5; seg(LX, yTop, LX, PENY);
    g.globalAlpha = 0.34; g.setLineDash([1.2, 3.2]); seg(LX, PENY + 10, LX, LINE_END); g.setLineDash([]);
    g.globalAlpha = 0.5; seg(LX - 3, LINE_END, LX + 3, LINE_END);
    if (yStart > 6) { g.globalAlpha = 0.8; g.lineWidth = 0.4; g.beginPath(); g.arc(LX, yStart - 2.6, 2.2, 0, TAU); g.stroke(); }   // 起头的小圈

    // 刻度：每秒一小点头，每十秒一道，每分钟一道长的带数字
    const s1 = Math.floor(t), s0 = Math.max(0, Math.ceil(t - PENY / PPS));
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let s = s0; s <= s1; s++) {
      const y = snap(yOf(s * PPS)), f = 0.3 + 0.7 * fade(y);
      if (s % 60 === 0) {
        g.strokeStyle = C.pen; g.lineWidth = 0.5; g.globalAlpha = f; seg(LX - 9, y, LX, y);
        g.fillStyle = C.blue; g.fillRect(LX - 11.2, y - 1.5, 2.2, 3);   // 一小块蓝，分钟的记号
        if (s) { g.fillStyle = C.paper; g.strokeStyle = C.blue; g.lineWidth = 0.4; g.beginPath(); g.arc(LX, y, 2, 0, TAU); g.fill(); g.stroke(); }   // 线上一个空心圆
        g.font = '400 6px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
        { const tw = g.measureText(fmt(s)).width, ga = g.globalAlpha; g.globalAlpha = 1; g.fillStyle = C.paper; g.fillRect(LX - 13.5 - tw - 1.5, y - 4, tw + 3, 8); g.globalAlpha = ga; }   // 垫一小块纸色，轨和格不从数字底下穿过
        g.fillStyle = C.pen; g.fillText(fmt(s), LX - 13.5, y + 0.3);
      } else if (s % 10 === 0) { g.strokeStyle = C.grey; g.lineWidth = 0.5; g.globalAlpha = f; seg(LX - 5, y, LX, y); }
      else { g.strokeStyle = C.grey; g.lineWidth = 0.3; g.globalAlpha = f * 0.75; seg(LX - 1.8, y, LX, y); }
    }

    // 她：线左，地震仪那样的细密折线。每 0.7px 一个点，一出一回，幅度跟音量走，有大有小；偶尔一根尖超出轨去；轻重沿线起伏
    const pHead = Math.min(head, Math.floor(np)), pTop = Math.max(0, Math.floor(np - PENY) - 2, head - RING + 8);
    g.lineJoin = 'miter'; g.miterLimit = 3; g.lineCap = 'butt'; g.strokeStyle = C.pen; g.lineWidth = 0.42;
    const STEP = 0.7, amp = q => { const i = Math.floor(q), f = q - i, a = her[i & MASK], b2 = i + 1 <= head ? her[(i + 1) & MASK] : a; return a + (b2 - a) * f; };
    let run = [];
    const flush = () => {
      for (let i = 0; i < run.length - 2; i += 16) {   // 分小段画：越往上越淡，段和段之间轻重不一样
        const n = Math.min(run.length, i + 18), a = fade(run[i + 1]) * (0.62 + 0.38 * hash(Math.round((np - (PENY - run[i + 1])) / 5.6)));
        if (a <= 0.01) continue;
        g.globalAlpha = a; g.beginPath(); g.moveTo(run[i], run[i + 1]);
        for (let j = i + 2; j < n; j += 2) g.lineTo(run[j], run[j + 1]);
        g.stroke();
      }
      run = [];
    };
    for (let k = Math.floor(Math.min(head + 0.999, np) / STEP); k * STEP >= pTop; k--) {
      const q = k * STEP, a = amp(q);
      if (a > 0.03) {
        const n1 = hash(k * 1.7), n2 = hash(k * 0.9 + 4421), out = k & 1, spike = out && n2 > 0.95;
        const breath = 0.72 + 0.28 * Math.sin(k * 0.19 + Math.sin(k * 0.043) * 2.2);
        const m = out ? (0.34 + 0.66 * n1) * breath * (spike ? 1.6 : 1) : 0.03 + 0.2 * n1;   // 出去的那一下大小不等，回来的那一下不贴线
        if (!run.length) run.push(LX - 0.4, yOf(q) + 0.9);
        run.push(LX - 0.8 - Math.min(a * AMP * m, RAIL + 9), yOf(q) + (n2 - 0.5) * 0.3);
      } else if (run.length) { run.push(LX - 0.4, yOf(q) + 0.3); flush(); }
    }
    if (run.length) { run.push(LX - 0.4, run[run.length - 1] - 0.9); flush(); }

    // 对方：线右，蓝色小点阵，一排一排，最外一格是一道短刻线
    g.fillStyle = C.blue;
    for (let p = pHead - (pHead % CELL); p >= pTop; p -= CELL) {
      const a = Math.max(peer[p & MASK], peer[(p + 1) & MASK], peer[(p + 2) & MASK]);
      if (a <= 0.04) continue;
      const y = snap(yOf(p)), f = fade(y); if (f <= 0.01) continue;
      const n = Math.max(1, Math.round(a * CELLS));
      g.globalAlpha = f;
      for (let i = 0; i < n - 1; i++) g.fillRect(LX + 4 + i * CELL, y - 0.5, 1, 1);
      g.fillRect(LX + 4 + (n - 1) * CELL, y - 0.3, 2.6, 0.6);
    }

    // 水纹：谁出声，就从笔尖一圈圈荡出去。每一圈是一笔有粗细有虚实的线：朝右下那一段实，绕到别处慢慢化掉；声音大，实的那段张得开
    // 她的是铅笔线，对方是蓝点（实处点大而密，虚处点小而疏）
    {
      const A0 = 0.6, SPD = 2.3, GAP = 6, RR = Math.min(W - LX + 40, (LINE_END + 16 - PENY) / 0.86), rMin = endT < 0 ? 30 : 64;
      g.lineCap = 'round';
      const dang = th => { let d = Math.abs(th - A0) % TAU; return d > Math.PI ? TAU - d : d; };
      for (let q = Math.floor(Math.min(np, head) / GAP) * GAP; q >= 0 && (np - q) * SPD < RR; q -= GAP) {
        const r = (np - q) * SPD; if (r < rMin || q < head - RING + 8) continue;
        let ah = 0, ap = 0; for (let i = q; i < q + GAP && i <= head; i++) { ah = Math.max(ah, her[i & MASK]); ap = Math.max(ap, peer[i & MASK]); }
        const fall = Math.pow(1 - r / RR, 0.9) * clamp((r - rMin) / 12, 0, 1), far = clamp(1 - r / 170, 0, 1);   // far：离笔尖近才画整圈，远了只剩右下那段
        const body = (th, a) => { const half = 0.16 + 0.44 * Math.min(1, a * 1.3), d = dang(th) / half, main = Math.exp(-d * d * 0.9);
          const b0 = 0.5 + 0.5 * Math.sin(th * 2 + q * 0.21 + 1.3); return Math.max(main, 0.34 * far * b0 * b0); };
        if (ah > 0.05) {
          const n = Math.max(28, Math.round(r * 0.55)), st = TAU / n; g.strokeStyle = C.pen;
          for (let i = 0; i < n; i++) {
            const th = i * st, w = body(th, ah), al = Math.min(0.85, 0.3 + ah * 0.7) * fall * w; if (al < 0.025) continue;
            const r1 = r + (hash(q * 0.37 + i * 1.9) - 0.5) * 0.9, r2 = r + (hash(q * 0.37 + (i + 1) * 1.9) - 0.5) * 0.9;
            g.globalAlpha = al; g.lineWidth = 0.22 + ah * 0.75 * w; g.beginPath(); g.moveTo(LX + Math.cos(th) * r1, PENY + Math.sin(th) * r1); g.lineTo(LX + Math.cos(th + st * 1.08) * r2, PENY + Math.sin(th + st * 1.08) * r2); g.stroke();
          }
        }
        if (ap > 0.05) {
          const da = 4.6 / r; g.fillStyle = C.blue;
          for (let th = 0; th < TAU; th += da) {
            const w = body(th, ap), al = Math.min(0.9, 0.35 + ap * 0.6) * fall * w; if (al < 0.03) continue;
            if (w < 0.5 && hash(q * 1.3 + th * 57) > w * 2) continue;   // 虚处抽稀
            const sz = w > 0.75 ? 1.3 : 1; g.globalAlpha = al; g.fillRect(snap(LX + Math.cos(th) * (r + 2.6)) - sz / 2, snap(PENY + Math.sin(th) * (r + 2.6)) - sz / 2, sz, sz);
          }
        }
      }
    }

    // 水纹过处把字推开一点：每句按它离笔尖多远，取那一圈当时的音量，沿着离心的方向挪
    for (let i = caps.length - 1; i >= 0 && i >= caps.length - 8; i--) {
      const c = caps[i]; if (c.top == null) continue;
      let dx = 0, dy = 0;
      if (endT < 0 && !RM.matches) {
        const cx = c.side === 'me' ? -64 : 78, cy = (c.top + c.h / 2) - np, d = Math.hypot(cx, cy);
        if (d < 190) { const q = Math.floor(np - d / 2.3); if (q >= 0 && q <= head && q > head - RING + 8) {
          let a = 0; for (let k = q - 3; k <= q + 3; k++) if (k >= 0 && k <= head) a += Math.max(her[k & MASK], peer[k & MASK]); a /= 7;
          const m = 5.5 * a * Math.pow(1 - d / 190, 0.8); dx = cx / d * m; dy = cy / d * m; } }
      }
      const tr = (Math.abs(dx) + Math.abs(dy) > 0.05) ? 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)' : '';
      if (c.tr !== tr) { c.tr = tr; c.el.style.transform = tr; }
    }

    // 笔尖，或者挂断以后的邮戳
    g.globalAlpha = 1;
    // 笔尖跟着声音喘：圈是一笔有粗细有虚实的线，声音一来，粗的那段和化掉的那段沿着圈游走；对方是蓝圈，她是左边半圈铅笔
    { let ah = 0, ap = 0; if (endT < 0 && head >= 0) for (let i = Math.max(0, head - 1); i <= head; i++) { ah = Math.max(ah, her[i & MASK]); ap = Math.max(ap, peer[i & MASK]); }
      ah = Math.sqrt(ah); ap = Math.sqrt(ap);   // 小声也看得出来
      tipH += (ah - tipH) * (ah > tipH ? 0.7 : 0.2); tipP += (ap - tipP) * (ap > tipP ? 0.7 : 0.2); if (tipH < 0.004) tipH = 0; if (tipP < 0.004) tipP = 0;
      tipPh += 0.012 + (tipH + tipP) * 0.16; }
    g.fillStyle = C.blue; g.beginPath(); g.arc(LX, PENY, endT < 0 ? 2.7 + tipP * 1.3 : 2.2, 0, TAU); g.fill();
    if (endT < 0) {
      // 一圈分成小段画：每段的粗细、轻重从两道慢波里取，波跟着 tipPh 走
      const brush = (col, v, r0, grow, a0, a1, seed, baseA) => {
        const N = 56, R = r0 + v * grow; g.strokeStyle = col; g.lineCap = 'round';
        for (let i = 0; i < N; i++) {
          const th = a0 + (a1 - a0) * i / N, th2 = a0 + (a1 - a0) * (i + 1.15) / N;
          const w1 = 0.5 + 0.5 * Math.sin(th * 2 + tipPh * 1.0 + seed), w2 = 0.5 + 0.5 * Math.sin(th * 3 - tipPh * 0.63 + seed * 2.1);
          const body = w1 * w1 * (0.35 + 0.65 * w2);                          // 0..1：这一段墨多不多
          const lw = 0.3 + v * 2.0 * body, al = baseA * (1 - v) + v * clamp(body * 1.5 - 0.12, 0, 1);
          if (al < 0.02) continue;
          const rr = R + v * 1.6 * (w2 - 0.5), rr2 = R + v * 1.6 * ((0.5 + 0.5 * Math.sin(th2 * 3 - tipPh * 0.63 + seed * 2.1)) - 0.5);
          g.lineWidth = lw; g.globalAlpha = al; g.beginPath(); g.moveTo(LX + Math.cos(th) * rr, PENY + Math.sin(th) * rr); g.lineTo(LX + Math.cos(th2) * rr2, PENY + Math.sin(th2) * rr2); g.stroke();
        }
      };
      brush(C.blue, tipP, 6.2, 5, 0, TAU, 0.7, 0.6);
      if (tipP > 0.03) brush(C.blue, tipP * 0.55, 10, 11, 0, TAU, 3.9, 0);
      if (tipH > 0.03) brush(C.pen, tipH, 9, 7, Math.PI * 0.45, Math.PI * 1.55, 1.9, 0);
      g.lineCap = 'butt';
    }
    else postmark(C);
    g.globalAlpha = 1;
  }
  /* 邮戳：双圈，圈里时长和日子，右边三道波浪销票线 */
  function postmark(C) {
    const k = RM.matches ? 1 : clamp((performance.now() - stampAt) / 150, 0, 1), e = 1 - Math.pow(1 - k, 3), R = 15.5;
    const d = new Date(wall0 || Date.now()), day = (d.getMonth() + 1) + '.' + ('0' + d.getDate()).slice(-2);
    g.save(); g.translate(LX - 15, PENY + 21);   // 盖在笔尖偏左下，不压最后一段波形
    g.rotate(-0.09); g.scale(1.3 - 0.3 * e, 1.3 - 0.3 * e);
    g.strokeStyle = C.blue; g.fillStyle = C.blue; g.lineCap = 'round';
    [[R, 0.8], [R - 3.6, 0.4]].forEach(([r, lw], i) => {
      for (let q = 0; q < 2; q++) { g.globalAlpha = e * (q ? 0.4 : 0.92); g.lineWidth = lw * (q ? 0.7 : 1); const ox = (hash(i * 7 + q) - 0.5) * 0.5, oy = (hash(i * 11 + q + 3) - 0.5) * 0.5, rr = r + (hash(i + q * 5) - 0.5) * 0.3;
        (i ? [[0.5, 3.7], [3.95, TAU + 0.5]] : [[-0.9, 1.85], [2.12, 4.62], [4.74, TAU - 0.9]]).forEach(([a, b2]) => { g.beginPath(); g.arc(ox, oy, rr, a, b2); g.stroke(); }); }   // 圈上留一两处缺墨的口
    });
    g.globalAlpha = e * 0.95; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 6.6px "Noto Serif SC","Songti SC",serif'; g.fillText(fmt(endT), 0, -2.7);
    g.lineWidth = 0.3; g.globalAlpha = e * 0.7; g.beginPath(); g.moveTo(-6, 1.9); g.lineTo(6, 1.9); g.stroke();
    g.globalAlpha = e * 0.9; g.font = '400 5.4px "Noto Serif SC","Songti SC",serif'; g.fillText(day, 0, 6);
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * 4, x0 = R + 1.5 + hash(i + 40) * 1.5, x1 = R + 34 - hash(i + 50) * 6;
      g.globalAlpha = e * 0.75; g.lineWidth = 0.5; g.beginPath();
      for (let x = x0; x <= x1; x += 1) { const yy = y + 0.9 * Math.sin((x - x0) / 12 * TAU + 0.6); x === x0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    g.restore();
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!root || root.classList.contains('away') || document.hidden) return;
    if (sim) tickClock();
    const dk = isDark(); if (dk !== wasDark) { if (wasDark !== null) bake(); wasDark = dk; dirty = true; }
    const stamping = endT >= 0 && performance.now() - stampAt < 260;
    const still = RM.matches || endT >= 0 || (sim && !simRun);
    const lively = stamping || cur || utt || performance.now() - lastInk < 3200;
    if (!dirty && (still && !stamping || ts - lastDraw < (lively ? 30 : 95))) return;   // 闲着一秒十帧，有声音三十帧，不走纸时只在有变化时画
    lastDraw = ts; dirty = false;
    draw();
    roll.style.transform = 'translate3d(0,' + (PENY - viewT() * PPS).toFixed(2) + 'px,0)';
  }
  function tickClock() {
    const s = Math.floor(clock());
    if (s !== lastSec) { lastSec = s; const v = fmt(s); if (timeEl) timeEl.textContent = v; if (miniEl) miniEl.querySelector('time').textContent = v; }
  }

  /* ---------- 声音：麦克风、录音、判断一句说完 ---------- */
  /* 出声走一个 <audio> 元素（手机的音量键才管得住），量音量从它接一个 MediaElementAudioSourceNode 到音量表再到出口 */
  let SILENT = '';
  function silentURL() {   // 十分之一秒的静音 wav，只为在手势里把 <audio> 放行
    if (SILENT) return SILENT;
    const n = 800, b = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, t) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 8000, true); b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
    return SILENT = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  function ctxInit() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try { au = new Audio(); au.preload = 'auto'; au.playsInline = true; au.setAttribute('playsinline', ''); } catch (e) { au = null; }
    auWired = false; auPrimed = false;
    if (AC) { try { ctx = new AC(); outAn = ctx.createAnalyser(); outAn.fftSize = 512; outAn.connect(ctx.destination); outBuf = new Float32Array(outAn.fftSize);
      if (au) { ctx.createMediaElementSource(au).connect(outAn); auWired = true; } } catch (e) { if (!auWired && ctx && !outAn) ctx = null; } }
    unlock();
  }
  /* 系统把声音挂起了（suspended / interrupted）就接回来；<audio> 第一次要在手势里放一下才算放行 */
  function unlock() {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    if (au && !auPrimed && !cur) { try { au.src = silentURL(); const p = au.play(); if (p && p.then) p.then(() => { auPrimed = true; }, () => {}); } catch (e) {} }
  }
  function level(an, buf) {
    if (an.getFloatTimeDomainData) an.getFloatTimeDomainData(buf);
    else { const b = new Uint8Array(buf.length); an.getByteTimeDomainData(b); for (let i = 0; i < b.length; i++) buf[i] = (b[i] - 128) / 128; }
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  async function micOn(again) {
    const md = navigator.mediaDevices;
    if (micBusy) return; micBusy = true;
    try {
      if (!md || !md.getUserMedia || !ctx) { say('mic', '这个浏览器录不了音，只能听'); return; }
      let s;
      try { s = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { say('mic', again ? '麦克风没接回来，挂了重拨' : e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? '麦克风没开，去设置里允许后重拨' : '没找到麦克风，只能听'); return; }
      if (!on) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; lastTracks = s.getTracks();
      lastTracks.forEach(t => { t.enabled = !muted; t.onended = () => { if (on && stream === s) { micOk = false; stopRec(null); utt = null; if (!document.hidden) remic(); } }; });   // 轨道被系统掐了：在前台就马上接，在后台等回来再接
      try { if (micSrc) micSrc.disconnect(); } catch (e) {}
      try { micAn = ctx.createAnalyser(); micAn.fftSize = 1024; micBuf = new Float32Array(micAn.fftSize); micSrc = ctx.createMediaStreamSource(s); micSrc.connect(micAn); } catch (e) { say('mic', '这个浏览器录不了音，只能听'); return; }
      if (!window.MediaRecorder) { say('mic', '这个浏览器录不了音，只能听'); return; }
      MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';   // iPhone 只认 audio/mp4
      micOk = true; floor = 0.008; loudRun = 0; unsay('mic'); unlock(); sinkProbe();
    } finally { micBusy = false; }
  }
  /* 回到前台：声音环境被挂起就接回来；麦克风轨道不是 live 或被系统静了音，就重新要一条，重建录音和音量表，接着听 */
  function remic() {
    if (!on || sim || micBusy || authDead) return;
    const dead = !stream || !lastTracks.length || lastTracks.some(t => t.readyState !== 'live' || t.muted);
    if (!dead) return;
    stats.remic++; micOk = false; stopRec(null); utt = null; loudRun = 0;
    lastTracks.forEach(t => { try { t.onended = null; t.stop(); } catch (e) {} });
    stream = null; micAn = null;
    micOn(true);
  }
  function onShow() { if (!on || sim || document.hidden) return; unlock(); remic(); dirty = true; }
  function startRec() {
    if (!stream || !micOk) return null;
    let r;
    try { r = MIME ? new MediaRecorder(stream, { mimeType: MIME }) : new MediaRecorder(stream); }
    catch (e) { try { r = new MediaRecorder(stream); } catch (e2) { micOk = false; say('mic', '这个浏览器录不了音，只能听'); return null; } }
    const me = { r, t0: clock(), chunks: [], keep: null };
    r.ondataavailable = e => { if (e.data && e.data.size) me.chunks.push(e.data); };
    r.onstop = () => { if (me.keep) send(new Blob(me.chunks, { type: r.mimeType || MIME || 'audio/webm' }), me.keep); };
    try { r.start(); } catch (e) { return null; }
    return rec = me;
  }
  function stopRec(keep) {
    const me = rec; rec = null; if (!me) return;
    me.keep = keep || null;
    try { if (me.r.state !== 'inactive') me.r.stop(); } catch (e) {}
  }
  function endUtt() {
    const u = utt; utt = null; loudRun = 0;
    if (u.voiced < 250 || u.peak < 0.03) { stats.dropped++; stopRec(null); } else stopRec(u);   // 太短、几乎没声的不发
  }
  function vad(m, now) {
    if (!micOk || muted || authDead) return;
    if (!rec) startRec();
    const thr = Math.max(0.014, floor * 2.6);
    if (m > thr) {
      loudRun += 33;
      if (!utt && loudRun >= 90) utt = { t0: now - 0.12, voiced: 0, peak: 0, last: now };
      if (utt) { utt.voiced += 33; utt.last = now; if (m > utt.peak) utt.peak = m; }
    } else { loudRun = 0; floor += (Math.min(m, 0.05) - floor) * 0.03; }
    if (utt && (now - utt.last > HUSH || now - utt.t0 > 50)) endUtt();
    else if (!utt && rec && now - rec.t0 > 10) stopRec(null);   // 一直没人说话：隔十秒换一卷，免得一句话前面拖着长长的空白
  }
  async function send(blob, u) {
    if (!on || blob.size < 600) return;
    const type = (blob.type || 'audio/webm').split(';')[0];
    const ext = /mp4|aac|m4a/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : /wav/.test(type) ? 'wav' : 'webm';
    pending++; stats.voice++;
    try {
      const r = await raw('/app/voice?name=voice.' + ext, { method: 'POST', headers: { 'Content-Type': type }, body: blob });
      if (r.status === 401) { authFail(); return; }
      if (r.status === 413) { say('soft', '这句太长，没送出去'); return; }
      if (!r.ok) { say('soft', '这句没送到，再说一遍'); return; }
      const j = await r.json(); unsay('net');
      if (!on || !j || j.empty) return;
      addCap('me', u.t0, String(j.text || '').replace(/^🎤\s*/, '').trim() || '〔一段语音〕');
      awaiting = performance.now();
    } catch (e) { say('net', '网断了，这句没送出去'); }
    finally { pending--; }
  }
  function setMute(v) {
    muted = !!v;
    lastTracks.forEach(t => { try { t.enabled = !muted; } catch (e) {} });
    if (muted) { stopRec(null); utt = null; loudRun = 0; }
    const b = ctlEl && ctlEl.querySelector('[data-a="mute"]'); if (b) { b.classList.toggle('on', muted); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
    setLabel();
  }
  /* 换出声的地方：浏览器给得出不止一个输出、又能指定时才放这个键 */
  let sinks = [], sinkI = 0;
  function sinkProbe() {
    const md = navigator.mediaDevices;
    if (!ctx || typeof ctx.setSinkId !== 'function' || !md || !md.enumerateDevices) return;
    md.enumerateDevices().then(list => {
      sinks = list.filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      const b = ctlEl && ctlEl.querySelector('[data-a="out"]'); if (b && sinks.length > 1) b.hidden = false;
    }).catch(() => {});
  }
  function nextSink() {
    if (!ctx || sinks.length < 2) return;
    sinkI = (sinkI + 1) % sinks.length;
    ctx.setSinkId(sinks[sinkI].deviceId).then(() => { const b = ctlEl.querySelector('[data-a="out"]'); if (b) b.classList.toggle('on', sinkI > 0); }, () => say('soft', '换不过去'));
  }

  /* ---------- 念：切句、排队、取声音、放；取不到就退 ---------- */
  function clean(s) {
    return String(s || '').replace(/```[\s\S]*?```/g, ' ').replace(/\[(?:表情|画|图片|文件)[:：][^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ')
      .replace(/[*_#`>~]+/g, '').replace(/[ \t]+/g, ' ').trim();
  }
  /* 切句：只在 。！？!? 和换行处切（英文句点后面跟空格也算），省略号、逗号不切。
     短句（中文不到 8 个字，英文不到 4 个词）单独念会被念重：并到下一句；它是最后一句就并到上一句；整条只有它就原样。
     一次送出去的字不超过约 60 个，超了在逗号处再分。 */
  const CJK = /[㐀-鿿぀-ヿ가-힯]/;
  const isShort = t => CJK.test(t) ? (t.match(/[\p{L}\p{N}]/gu) || []).length < 8 : (t.match(/[\p{L}\p{N}]+/gu) || []).length < 4;
  const glue = (a, b) => a + (/[A-Za-z0-9.,!?]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? ' ' : '') + b;
  function cut(s) {
    const raw = [], ENDS = '。！？!?\n', TAIL = '”’」』）)】"\'';
    let curS = '', ended = false;
    const push = () => { const t = curS.trim(); curS = ''; ended = false; if (t && /[\p{L}\p{N}]/u.test(t)) raw.push(t); else if (t && raw.length) raw[raw.length - 1] += t; };
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1] || '';
      curS += c;
      if (ENDS.indexOf(c) >= 0 || (c === '.' && (n === ' ' || n === '') && !/\.\.$/.test(curS))) ended = true;
      if (ended && ENDS.indexOf(n) < 0 && TAIL.indexOf(n) < 0) push();
    }
    push();
    const out = []; let carry = '';
    raw.forEach((t, i) => { const c = carry ? glue(carry, t) : t; if (isShort(c) && i < raw.length - 1) carry = c; else { out.push(c); carry = ''; } });
    if (out.length > 1 && isShort(out[out.length - 1])) { const t = out.pop(); out[out.length - 1] = glue(out[out.length - 1], t); }
    const fin = [];
    out.forEach(t => {
      if (t.length <= 62) { fin.push(t); return; }
      const bits = t.match(/[^，,、；;：]+[，,、；;：]*/g) || [t], got = []; let acc = '';
      bits.forEach(b => { if (acc && (acc + b).length > 60) { got.push(acc); acc = b; } else acc += b; });
      if (acc) { if (got.length && isShort(acc)) got[got.length - 1] += acc; else got.push(acc); }
      got.forEach(x => fin.push(x.trim()));
    });
    return fin;
  }
  function speak(text) {
    if (!on) return;
    const parts = cut(clean(text)); if (!parts.length) return;
    parts.forEach(t => queue.push({ t, a: null }));
    pump();
  }
  function fetchTTS(it) {
    if (it.a) return it.a;
    if (sim || ttsOff || !au) return it.a = Promise.resolve(null);
    stats.tts++;
    return it.a = postJSON('/app/tts', { text: it.t.slice(0, 900) }).then(r => {
      if (r.status === 401) authFail();
      if (!r.ok) { stats.ttsFail++; if (r.status === 503) ttsOff = true; return null; }   // 503 是后台没配声音，这通电话后面就不再问了
      return r.blob().then(b => b && b.size ? b : null);
    }).catch(() => { stats.ttsFail++; return null; });
  }
  async function pump() {
    if (busy || !queue.length || !on) return;
    busy = true; const my = gen;
    while (on && my === gen && queue.length) {
      const it = queue.shift(), a = fetchTTS(it);
      if (queue[0]) fetchTTS(queue[0]);   // 下一句先去取着
      const buf = await a;
      while (on && my === gen && utt) await sleep(120);   // 她正说着就等她说完，不抢话
      if (!on || my !== gen) break;
      stopRec(null); loudRun = 0;
      if (!spk) spk = { t0: clock(), peak: 0, k: 0, hot: 0, loud: 0 };
      addCap('ai', clock(), it.t);
      const going = buf ? playBuf(buf) : (window.speechSynthesis && window.SpeechSynthesisUtterance) ? synth(it.t) : quiet(it.t);
      setLabel(); await going;
    }
    if (my === gen) { busy = false; spk = null; setLabel(); }
  }
  function playBuf(blob) {
    return new Promise(res => {
      let done = false, tm = 0;
      const url = URL.createObjectURL(blob);
      const fin = () => { if (done) return; done = true; clearTimeout(tm); au.onended = au.onerror = au.onloadedmetadata = null; try { URL.revokeObjectURL(url); } catch (e) {} if (cur === me) cur = null; res(); };
      const me = cur = { kind: auWired ? 'au' : 'fake', seed: Math.random() * 99, stop() { try { au.pause(); } catch (e) {} fin(); } };
      au.onended = fin; au.onerror = fin;
      au.onloadedmetadata = () => { if (isFinite(au.duration)) { clearTimeout(tm); tm = setTimeout(fin, au.duration * 1000 + 2500); } };
      tm = setTimeout(fin, 30000);
      if (ctx && ctx.state !== 'running') unlock();
      try {
        au.src = url; const p = au.play(); stats.played++;
        if (p && p.catch) p.catch(() => {   // 没被放行（还没点过屏）：说一声，这句只留字幕
          if (done) return; stats.blocked++; say('soft', '点一下屏幕，声音才放得出来'); me.kind = 'wait'; clearTimeout(tm); tm = setTimeout(fin, readMs('一二三四五六七八'));
        });
      } catch (e) { fin(); }
    });
  }
  function synth(text) {
    return new Promise(res => {
      let done = false, started = false, mute = false, tm = 0, tm2 = 0;
      const fin = () => { if (done) return; done = true; clearTimeout(tm); clearTimeout(tm2); if (cur === me) cur = null; res(); };
      const me = cur = { kind: 'wait', seed: Math.random() * 99, stop() { try { speechSynthesis.cancel(); } catch (e) {} fin(); } };
      /* 自带朗读没出声（没有声音库、被系统拦了）：这句只留字幕，停一小会儿让人看完 */
      const mum = () => { if (started || mute || done) return; mute = true; u = null; try { speechSynthesis.cancel(); } catch (e) {} stats.hush++; clearTimeout(tm); clearTimeout(tm2); tm = setTimeout(fin, readMs(text)); };
      let u;
      try {
        u = new SpeechSynthesisUtterance(text); u.lang = /[㐀-鿿]/.test(text) ? 'zh-CN' : 'en-US';
        u.onstart = () => { started = true; me.kind = 'fake'; };
        u.onend = u.onerror = () => { if (mute) return; if (started) fin(); else mum(); };
        tm = setTimeout(fin, Math.min(24000, 2000 + text.length * 340));
        tm2 = setTimeout(mum, 1200);
        speechSynthesis.cancel(); speechSynthesis.speak(u); stats.synth++;
      } catch (e) { mum(); }
    });
  }
  const readMs = text => clamp(700 + text.length * 130, 900, 4200);
  function quiet(text) {
    return new Promise(res => {
      stats.hush++;
      const fin = () => { clearTimeout(tm); if (cur === me) cur = null; res(); };
      const me = cur = { kind: 'wait', stop: fin }, tm = setTimeout(fin, readMs(text));
    });
  }
  function hushAll() { gen++; queue.length = 0; const c = cur; cur = null; if (c) c.stop(); busy = false; spk = null; }
  /* 插话：对方念着的时候接着量麦克风。开头 350 毫秒只量回声（峰值和它跟出声音量的比），之后她的声音连着高过这条线 220 毫秒就停下来听她 */
  function bargeWatch(m, o, now) {
    if (!spk || !micOk || muted || authDead || ls('nyx_call_barge') === '0') return;
    if (now - spk.t0 < 0.35) { if (m > spk.peak) spk.peak = m; if (o > 0.01 && m / o > spk.k) spk.k = m / o; return; }
    const thr = Math.max(0.045, spk.peak * 1.8, spk.k * o * 2.2, floor * 4);
    if (m > thr) {
      spk.loud = now;
      if (!spk.hot) { spk.hot = now; startRec(); }   // 先录上，真是她在说就接着用这一卷
      else if (now - spk.hot >= 0.22) {
        const t = spk.hot; stats.barge++; hushAll();
        utt = { t0: t, voiced: 220, peak: m, last: now }; loudRun = 90;
      }
    } else if (spk.hot && now - spk.loud > 0.12) { spk.hot = 0; stopRec(null); }
  }

  /* ---------- 心跳：每 33 毫秒量一次两边的音量 ---------- */
  function beat() {
    if (!on) return;
    const now = clock();
    advance(now);
    let m = 0, o = 0;
    if (micAn && micOk && !muted) m = level(micAn, micBuf);
    if (cur) o = cur.kind === 'au' ? level(outAn, outBuf) : cur.kind === 'fake' ? 0.03 + 0.07 * env(now, cur.seed) : 0;
    lastOut = o;
    if (o > 0.004) ink(peer, clamp(Math.pow(o / 0.17, 0.7), 0, 1));
    if (cur) bargeWatch(m, o, now); else vad(m, now);
    if (utt && m > Math.max(0.014, floor * 2.6)) ink(her, clamp(Math.pow((m - floor) / 0.17, 0.62), 0.08, 1));
    setLabel(); tickClock();
  }

  /* ---------- 收成小条 / 展开 ---------- */
  function shrink() {
    if (!on || miniEl || !root) return;
    root.classList.add('away');
    miniEl = document.createElement('div'); miniEl.className = 'nyxc-mini' + (root.classList.contains('fix') ? ' fix' : '');
    miniEl.innerHTML = `<button aria-label="回到通话" title="回到通话"><i></i><time>${fmt(clock())}</time></button>`;
    miniEl.querySelector('button').addEventListener('click', expand);
    root.parentNode.appendChild(miniEl);
  }
  function expand() {
    if (miniEl) { miniEl.remove(); miniEl = null; }
    if (root) { root.classList.remove('away'); fit(); }
  }

  /* ---------- 开 / 关 ---------- */
  function wipe() {
    cancelAnimationFrame(raf); clearInterval(beatT); clearTimeout(errT);
    if (miniEl) { miniEl.remove(); miniEl = null; }
    if (root) { root.remove(); root = null; }
    window.removeEventListener('resize', fit); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('pageshow', onShow);
  }
  function open(opt) {
    opt = opt || {};
    if (on) { expand(); return Promise.resolve(); }
    wipe();
    on = true; sim = !!opt.sim; hold = false; endT = -1; t0 = performance.now(); wall0 = Date.now(); simT = +opt.at || 0; simRun = 0; snapT = sim ? simT : 0;
    her.fill(0); peer.fill(0); head = sim ? Math.floor(simT * PPS) : -1; caps = []; lastSec = -1; label = ''; forced = ''; wasDark = null;
    queue = []; busy = false; cur = null; spk = null; ttsOff = false; pending = 0; awaiting = 0; typing = 0; seen = new Set();
    micBusy = false; micSrc = null; micOk = false; muted = false; authDead = false; connected = sim; rec = null; utt = null; floor = 0.008; loudRun = 0; stream = null; micAn = null;
    callId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    { const d = new Date(wall0); recNo = ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2); }   // 记录号：拨出那一刻的分和秒，不另存东西
    build(); setLabel(); tickClock();
    window.addEventListener('resize', fit); document.addEventListener('visibilitychange', onShow); window.addEventListener('pageshow', onShow);
    raf = requestAnimationFrame(frame);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); bake(); dirty = true; });
    if (document.fonts && document.fonts.load) document.fonts.load('400 8px "Noto Serif SC"', '手机').then(() => { bake(); }, () => {});   // 票头里那两个字要等字体到了再画一遍
    if (sim) return Promise.resolve();
    ctxInit(); listen(); beatT = setInterval(beat, 33);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; if (!on) w.release(); }, () => {}); } catch (e) {}
    micOn();
    stats.start++;
    return postJSON('/app/call', { action: 'start', call_id: callId }).then(r => {
      if (r.status === 401) authFail(); else if (!r.ok) say('soft', '后台没应声，先这样打着');
    }, () => { say('net', '连不上后台，接上以后再试'); }).then(() => { connected = true; setLabel(); });
  }
  function close() {
    if (!on) return;
    const wasSim = sim, me = root, shown = root && !root.classList.contains('away');
    endT = clock(); on = false; stampAt = performance.now();
    hushAll(); stopRec(null); utt = null; clearInterval(beatT);
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    lastTracks.forEach(t => { try { t.onended = null; t.stop(); } catch (e) {} }); stream = null; micAn = null; micOk = false;
    if (ownStream) { ownStream.abort(); ownStream = null; }
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    if (au) { try { au.pause(); au.removeAttribute('src'); au.load(); } catch (e) {} au = null; }
    try { if (micSrc) micSrc.disconnect(); } catch (e) {} micSrc = null;
    if (ctx) { const c = ctx; ctx = null; setTimeout(() => { try { c.close(); } catch (e) {} }, 300); }
    if (!wasSim) { stats.end++; try { postJSON('/app/call', { action: 'end', call_id: callId }, { keepalive: true }).catch(() => {}); } catch (e) {} }
    if (miniEl) { miniEl.remove(); miniEl = null; }
    if (!shown) { wipe(); return; }
    me.classList.add('ended'); unsay(); tickClock(); dirty = true;   // 纸停住，笔尖处盖一枚戳
    if (hold) return;
    setTimeout(() => { if (root !== me) return; me.classList.add('out'); setTimeout(() => { if (root === me) wipe(); }, 260); }, 150 + 800);
  }

  /* ---------- 演示页和自查用的口子（聊天页用不着） ---------- */
  const lab = {
    stats, PPS,
    ink(side, a, b, seed) {   // 往纸上补一段假声音：a–b 秒
      const buf = side === 'me' ? her : peer; seed = seed || 1;
      for (let p = Math.floor(a * PPS); p <= Math.floor(b * PPS); p++) {
        const t = p / PPS, edge = clamp(Math.min(t - a, b - t) / 0.25, 0, 1);
        buf[p & MASK] = clamp(env(t, seed) * (0.35 + 0.65 * edge) * (side === 'me' ? 1.05 : 1), 0, 1);
      }
      head = Math.max(head, Math.floor(b * PPS)); dirty = true;
    },
    feed(side, amp) { advance(clock()); ink(side === 'me' ? her : peer, clamp(amp, 0, 1)); },
    cap(side, t, text) { addCap(side, t == null ? clock() : t, text); },
    label(s) { forced = s || ''; setLabel(); },
    err(s) { if (s) say('mic', s); else unsay(); },
    run(v) { if (v && !simRun) simRun = performance.now(); else if (!v && simRun) { simT = clock(); simRun = 0; } dirty = true; },
    hold(v) { hold = !!v; },
    shrink, expand, cut: t => cut(clean(t)), tracks: () => lastTracks, ctx: () => ctx,
    state: () => ({ on, mini: !!miniEl, label, queue: queue.length, speaking: !!cur, kind: cur ? cur.kind : '', busy, muted, micOk, ttsOff, mime: MIME, recording: !!rec, utt: !!utt,
      tracks: lastTracks.map(t => t.readyState), ctx: ctx ? ctx.state : 'none', out: lastOut, audio: au ? { paused: au.paused, src: String(au.currentSrc || au.src).slice(0, 5), t: au.currentTime, wired: auWired } : null, err: errEl && !errEl.hidden ? errEl.textContent : '', caps: caps.map(c => c.side + ':' + c.el.textContent) })
  };

  window.NyxCall = { paper: true, isOpen: () => on, open, close, speak, _lab: lab };
})();
