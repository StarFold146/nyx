/* 口袋页（连同待办）初稿，11/12。
   一只摊开的口袋倒出来的纸片：每条是一张细线框的小纸条，宽窄随字数、歪一点，角上一枚极小的衬线斜体面值号（N°035），
   沿左边一道手绘缝线排下去（没看过的那条，缝线上一颗蓝点）。右上扎一堆细活：衬衫口袋插一支笔、露一角纸条，旁边一张票根、一枚回形针、一颗掉了的扣子。
   页眉的「纸条 / 待办」切到第二态：一张细线的清单纸，小方框勾掉变成半实半空的蓝块，字划一道线；AI 塞来的新待办在顶上带一颗蓝点。
   接口：
     口袋  GET /app/pocket?q=   POST /app/pocket {text, by:"note"}   POST /app/pocket/{id} {status} | {text} | {delete:true}
           「发」：往当前聊天对象 POST /app/send {text:"口袋：003", side:"sun"}（原版是塞进聊天输入发出去，这页没有聊天输入）
     待办  本机 localStorage nyx_todos [{id,text,done,ts,from?,inbox_id?}]，和本站同一份
           收件箱 GET /app/todo-inbox → 追加、按 inbox_id 去重 → 存进本机后 POST /app/todo-inbox/ack {ids}
   家里的东西走第一只后台（Nyx config 的 relay，默认 /relay），钥匙 nyx_key，只放 Authorization 头。
   ?demo=1 示例数据、不发任何请求、不写 localStorage；?dark=1 墨黑面；?v=td 直接开待办。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, rng, hash, dot, setupGrain, fitCanvas, spots, backMoon, homeInfo, revealIn, leaveHome, Q, REDUCED } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco');
const dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('ta_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（ta_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pad3 = n => String(n).padStart(3, '0');
const inkBlue = () => (dark ? '#8794f2' : C.BLUE);
function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* ---------- 示例（只在 ?demo=1 用） ---------- */
const now = Date.now(), dago = d => new Date(now - d * 86400000).toISOString();
/* 实际放进口袋的大多是小红书分享来的链接：标题长、带表情和「｜」、话题标签，网址很长；示例照这个样子编（全是虚构的中性内容，网址都是 example.com） */
const XU = (path, tok) => 'https://example.com/discovery/item/' + path + '?app_platform=ios&app_version=8.62&share_from_user_hidden=true&xsec_source=app_share&type=normal&xsec_token=' + tok + '&author_share=1&shareRedId=' + tok.slice(0, 12) + '&apptime=1731400000&share_id=' + tok.slice(4, 20);
const DEMO_PK = [
  ['', 0.1, 'unread', { title: '一锅出的番茄牛腩🍅｜冬天就靠它了，汤汁拌饭能吃两碗 #家常菜[话题]# #一人食[话题]#', text: '牛腩冷水下锅焯一遍，番茄分两次放，一次炖化、一次留点形状，最后撒葱花。高压锅二十五分钟，砂锅一个半小时。', url: XU('6f3a1c0e000000001d03b2a7', 'ABk3Lq0vT9zXcR2mY7pQwE5sJ8hN1dFgUo4='), source: '小红书' }],
  ['伞在门后', 0.4, 'unread'],
  ['', 1, 'seen', { title: '京都三天两晚不踩雷路线🍁｜红叶季人少的寺都在这了，附交通和每天的步数', text: '第一天岚山，早上七点前到竹林；第二天东福寺和伏见稻荷，下午去鸭川边坐着；第三天留给锦市场和书店。', url: XU('6f2e9b44000000001e01c9d3', 'ABa8Fh2kL0pQx7Vn3cZrT6yWm9sE4uJdGi1='), source: '小红书' }],
  ['', 1.5, 'talked', { title: '出租屋收纳｜二十块钱改出一整面墙的挂物区✨ 租房的可以直接抄作业 #收纳[话题]# #租房改造[话题]#', text: '洞洞板加无痕钉，不打孔；挂钩按常用顺序排，钥匙和耳机放最右边出门顺手。', url: XU('6f1d07a2000000001b02e4f8', 'ABq5Wn8xC2vR0tL7mK4pZs9yH3fD6jUeGo1='), source: '小红书' }],
  ['周末想把衣柜理一遍：夏天的收进箱子，厚外套挂出来，袜子按颜色分，旧的那几件拿去捐。理完拍一张给你看。', 2, 'seen'],
  ['', 3, 'unread', { title: '这周末的展览合集📍｜三个免费、一个要提前预约，雨天也能逛 #周末去哪儿[话题]#', text: '', url: XU('6f0c5e19000000001c00a7b1', 'ABz1Pq4wE7rT0yU3iO6pAs9dF2gH5jKlZx8='), source: '小红书' }],
  ['', 4, 'done', { title: '冬天的汤怎么煮：十种家常汤的火候、配料和下锅顺序（收藏版）', text: '萝卜排骨、冬瓜丸子、玉米胡萝卜……每种都写了先放什么后放什么，什么时候关火焖着。', url: 'https://example.com/recipes/winter/soups/ten-home-style-soups-heat-and-order-collection?from=share&utm_source=copy_link&utm_medium=app', source: '链接' }],
  ['下雨天的歌单🌧️｜适合一个人在家理房间的时候放，一共二十三首 #歌单分享[话题]# 一键收藏 http://example.com/a/Xk2pQ9vLmT3wZr 复制本条信息，打开【小红书】App查看精彩内容！', 5, 'seen', { source: '小红书' }],
  ['', 6, 'talked', { title: '新手养绿萝别再这样浇水了🪴｜叶子发黄的三个原因，第二个最多人中招', text: '盆土表面干两指再浇；冬天放窗边但别贴着玻璃；黄叶直接剪掉，别等它自己掉。', url: XU('6efa7710000000001f03d2c6', 'ABm7Kj2hG5fD8sA1qW4eR0tY3uI6oPlZx9='), source: '小红书' }],
  ['电费单在抽屉最上面', 8, 'done']
].map((r, i) => Object.assign({ id: 'd' + i, ts: dago(r[1]), text: r[0], url: '', title: '', source: '笔记', status: r[2], by: r[3] ? 'share' : 'note', no: 35 - i }, r[3] || {}));
const DEMO_TD = [
  { id: 'a1', text: '订下周回来的车票', done: false, ts: now - 3600000, from: '阿昼', inbox_id: 'ti01' },
  { id: 'a2', text: '买牛奶和一袋面包', done: false, ts: now - 86400000 },
  { id: 'a3', text: '还图书馆的两本书', done: false, ts: now - 2 * 86400000 },
  { id: 'a8', text: '照着那篇番茄牛腩🍅｜冬天就靠它了 买菜：牛腩一斤半、番茄四个、洋葱一个、葱一把，顺路看看有没有砂锅 https://example.com/discovery/item/6f3a1c0e000000001d03b2a7?xsec_token=ABk3Lq0vT9zXcR2mY7pQwE5sJ8hN1dFgUo4%3D&share_from=app', done: false, ts: now - 5 * 3600000, from: '阿昼', inbox_id: 'ti03' },
  { id: 'a9', text: '把京都那篇路线里的三家寺查一下红叶季的开放时间和要不要预约，写在备忘录里，顺便看一下回程那天的车次', done: false, ts: now - 1.5 * 86400000 },
  { id: 'a4', text: '周五前把表交上去', done: false, ts: now - 2 * 86400000 },
  { id: 'a5', text: '给绿萝换个大一点的盆', done: true, ts: now - 3 * 86400000 },
  { id: 'a6', text: '换床单', done: true, ts: now - 4 * 86400000 },
  { id: 'a7', text: '查一下快递到哪了', done: false, ts: now - 600000, from: '阿昼', inbox_id: 'ti02' }
];

/* ---------- 后台：同 chat.js 的 call()；家里的东西走第一只 ---------- */
let HOME = '/relay';
function call(base, k, path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + k }, opt.headers || {});
  return fetch(base + path, opt).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}
const hapi = (p, o) => call(HOME, ls('nyx_key'), p, o);
const jpost = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function chatTarget() {   // 「发」发给 Nyx 现在选的那只（同 chat.js resolve()）
  const ok = r => typeof r === 'string' && /^\/relay(-[a-z0-9]+)?(\/g)?$/.test(r), picked = ls('nyx_relay'), hk = ls('nyx_key');
  const relay = ok(picked) ? picked : HOME;
  return { relay, key: relay === HOME ? hk : (ls('nyx_chat_key') || hk) };
}
function loadConfig() {
  return new Promise(ok => { if (window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
}

let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

/* =================================================================== 口袋 =================================================================== */
const PK_ST = [['unread', '没看'], ['seen', '看过了'], ['talked', '聊过了'], ['done', '完成了']];
const pkLabel = st => (PK_ST.find(x => x[0] === st) || PK_ST[0])[1];
const stOf = it => it.status || 'unread';
let pocketItems = [], pocketQ = '', pocketTab = '', pkState = 'loading', openId = null, editId = null, armDel = null, armSend = null, armT = 0;
const demoPk = DEMO_PK.map(x => Object.assign({}, x));

function pkFetch() {
  if (!LIVE) {
    const q = pocketQ.toLowerCase();
    pocketItems = demoPk.filter(i => !q || (i.text + i.title + i.url + i.source).toLowerCase().includes(q)); pkState = 'ok'; paintPocket(); return Promise.resolve();
  }
  if (!ls('nyx_key')) { pkState = 'nokey'; paintPocket(); return Promise.resolve(); }
  if (!pocketItems.length) { pkState = 'loading'; paintPocket(); }
  const myQ = pocketQ;
  return hapi('/app/pocket?q=' + encodeURIComponent(pocketQ), { cache: 'no-store' })
    .then(d => { if (myQ !== pocketQ) return; pocketItems = (d && d.items) || []; pkState = 'ok'; })
    .catch(e => { if (myQ !== pocketQ) return; pkState = e && e.auth ? 'auth' : 'fail'; })
    .then(paintPocket);
}
function pkUpdate(it, body) {
  if (!LIVE) {
    const i = demoPk.findIndex(x => x.id === it.id); if (i < 0) return Promise.resolve();
    if (body.delete) demoPk.splice(i, 1); else Object.assign(demoPk[i], body);
    return pkFetch();
  }
  return hapi('/app/pocket/' + encodeURIComponent(it.id), jpost(body)).catch(e => { toast(e && e.auth ? '钥匙不认了' : '没改上'); }).then(pkFetch);
}
const fmt = ts => { const d = new Date(ts); if (isNaN(d)) return ''; return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
/* 长链接收拾：网址整条不露，收成角上一行「来源 · 域名」；分享文案里夹的网址和「复制本条信息…」那句尾巴去掉；
   表情和话题标签照留，但表情褪成灰、话题标签淡一档 */
const URL_RE = /https?:\/\/[^\s<>"'，。！？；、（）【】「」]+/g;
const BOILER = /复制(?:本条|这条)?信息[^\n]{0,40}?(?:查看精彩内容|App[^\n]{0,12}?查看(?:精彩内容)?)[!！。]?/g;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const linkOf = it => it.url || ((String(it.text || '').match(URL_RE) || [])[0] || '');
const clean = t => String(t || '').replace(BOILER, '').replace(URL_RE, '').replace(/[ \t\u3000]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
const TOK = /(#[^\s#]{1,30}?\[话题\]#?|#[^\s#]{1,30}|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\uFE0F?)/gu;
const rich = t => String(t || '').split(TOK).map((p, i) => i % 2 ? (p[0] === '#' ? `<span class="tg">${esc(p.replace(/\[话题\]#?/g, ''))}</span>` : `<span class="em">${esc(p)}</span>`) : esc(p)).join('');
/* 纸条的宽窄、偏移、角度：跟着 id 走，刷新也不乱跳；长的直接拉满，不再歪多少 */
function idSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function slipGeo(it, maxW) {
  const n = Array.from((it.title || '') + clean(it.text)).length, h0 = idSeed(String(it.id)), h1 = hash(h0 * 9973 + 3), h2 = hash(h0 * 31 + 7);
  const w = clamp(64 + n * 12.6 + h1 * 16, 150, maxW), x = Math.round(h2 * Math.max(0, Math.min(22, maxW - w))), r = ((h1 - 0.5) * (n > 20 ? 0.5 : 1.4)).toFixed(2), gap = Math.round(17 + h2 * 8);
  return { w: Math.round(w), x, r, gap };
}
function paintTabs() {
  const cnt = k => pocketItems.filter(x => stOf(x) === k).length;
  $('tabs').innerHTML = [['', '全部', pocketItems.length]].concat(PK_ST.map(p => [p[0], p[1], cnt(p[0])]))
    .map(p => `<button type="button" role="tab" data-tab="${p[0]}" class="${pocketTab === p[0] ? 'on' : ''}" aria-selected="${pocketTab === p[0]}">${p[1]}<i>${p[2]}</i></button>`).join('');
  $('nPk').textContent = pocketItems.length || '';
  $('qn').textContent = pocketQ ? (pocketItems.length + ' found') : '';
}
function paintPocket() {
  paintTabs();
  const el = $('slips'), pane = $('pkRows'), maxW = Math.max(150, Math.min(pane.clientWidth - 40 - 24, pane.clientWidth * 0.76));
  const add = $('pkAdd');
  add.hidden = pkState === 'nokey' || pkState === 'auth';
  if (pkState !== 'ok') {
    el.innerHTML = '<p class="quiet">' + ({
      loading: '翻口袋……',
      fail: '没翻出来 · <button type="button" data-act="retry">再翻一次</button>',
      nokey: '还没带钥匙，<a href="../index.html">去登录</a>',
      auth: '钥匙不认了，<a href="../index.html">去登录</a>'
    })[pkState] + '</p>';
    drawSeam(); return;
  }
  const shown = pocketTab ? pocketItems.filter(x => stOf(x) === pocketTab) : pocketItems;
  if (!shown.length) { el.innerHTML = '<p class="quiet">' + (pocketQ ? '没搜到' : pocketTab ? '这一格还空着' : '口袋是空的，从分享菜单丢点东西进来') + '</p>'; drawSeam(); return; }
  const prev = new Set([...el.querySelectorAll('.slip')].map(s => s.dataset.id));
  el.innerHTML = shown.map(it => {
    const g = slipGeo(it, maxW), st = stOf(it), open = openId === it.id, ed = editId === it.id;
    const u = linkOf(it), ex = clean(it.text), head = it.title || ex, sub = it.title && ex && ex !== it.title ? ex : '';
    const acts = ed
      ? `<button type="button" data-act="save">好</button><span class="dv"></span><button type="button" data-act="cancel">算了</button>`
      : (it.no ? `<button type="button" data-act="send" class="${armSend === it.id ? 'warn' : ''}">${armSend === it.id ? '再点一下发出去' : '发'}</button><span class="dv"></span>` : '') + `<button type="button" data-act="edit">改</button><span class="dv"></span><button type="button" data-act="del" class="${armDel === it.id ? 'warn' : ''}">${armDel === it.id ? '再点一下删掉' : '删'}</button>` +
        (u ? `<a class="og" href="${esc(u)}" target="_blank" rel="noopener noreferrer">原文<i>↗</i></a>` : '');
    const src = esc(it.source || (u ? '链接' : '笔记')), hs = u ? host(u) : '';
    return `<article class="slip ${st}${open ? ' open' : ''}${u ? ' lk' : ''}${prev.size && !prev.has(String(it.id)) ? ' new' : ''}" data-id="${esc(it.id)}" style="--w:${g.w}px;--x:${40 + g.x}px;--r:${g.r}deg;--gap:${g.gap}px" tabindex="0" aria-expanded="${open}">` +
      (it.no ? `<span class="no"><i>N°</i>${pad3(it.no)}</span>` : '') +
      (ed ? `<textarea rows="2" aria-label="改这条">${esc(it.text || '')}</textarea>` : (head ? `<div class="tx${it.title ? ' ti' : ''}">${rich(head)}</div>` : '')) +
      (!ed && sub ? `<div class="ex">${rich(sub)}</div>` : '') +
      `<div class="mt">` + (u ? `<a class="src" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${src}${hs ? `<i>${esc(hs)}</i>` : ''}<b>↗</b></a>` : `<span class="src">${src}</span>`) +
      `<span class="dt">${fmt(it.ts)}</span><button type="button" class="st" data-act="st" aria-label="状态：${pkLabel(st)}，点一下换下一档">${pkLabel(st)}</button></div>` +
      `<div class="acts">${acts}</div></article>`;
  }).join('');
  const ta = el.querySelector('.slip textarea'); if (ta) { fitTa(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  drawSeam();
}
const fitTa = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(220, ta.scrollHeight) + 'px'; };

$('slips').addEventListener('click', ev => {
  const rt = ev.target.closest('[data-act="retry"]'); if (rt) { pkFetch(); return; }
  const row = ev.target.closest('.slip'); if (!row) return;
  if (ev.target.closest('a')) return;
  const act = ev.target.closest('[data-act]'), it = pocketItems.find(x => String(x.id) === row.dataset.id); if (!it) return;
  if (!act) { if (editId === it.id) return; openId = openId === it.id ? null : it.id; armDel = armSend = null; paintPocket(); return; }
  const a = act.dataset.act;
  if (a === 'st') { const i = PK_ST.findIndex(x => x[0] === stOf(it)); pkUpdate(it, { status: PK_ST[(i + 1) % PK_ST.length][0] }); return; }
  if (a === 'edit') { editId = it.id; openId = it.id; paintPocket(); return; }
  if (a === 'cancel') { editId = null; paintPocket(); return; }
  if (a === 'save') { const v = row.querySelector('textarea').value.trim(); editId = null; if (v === (it.text || '').trim()) { paintPocket(); return; } if (!v && !it.url && !it.title) { toast('空着放不回去'); paintPocket(); return; } pkUpdate(it, { text: v }); return; }
  if (a === 'del') {
    if (armDel !== it.id) { armDel = it.id; armSend = null; clearTimeout(armT); armT = setTimeout(() => { armDel = null; paintPocket(); }, 2600); paintPocket(); return; }
    armDel = null; clearTimeout(armT); openId = null; pkUpdate(it, { delete: true }); return;
  }
  if (a === 'send') {   // 「口袋：003」当普通消息发出去，后台替 AI 把那条展开
    if (armSend !== it.id) { armSend = it.id; armDel = null; clearTimeout(armT); armT = setTimeout(() => { armSend = null; paintPocket(); }, 2600); paintPocket(); return; }
    armSend = null; clearTimeout(armT); paintPocket();
    const text = '口袋：' + pad3(it.no);
    if (!LIVE) { toast('样稿不发 · ' + text); return; }
    const t = chatTarget(); if (!t.key) { toast('还没带钥匙'); return; }
    call(t.relay, t.key, '/app/send', jpost({ text, side: 'sun' })).then(() => toast('发过去了 · ' + text)).catch(() => toast('没发出去'));
  }
});
$('slips').addEventListener('input', ev => { if (ev.target.matches('.slip textarea')) { fitTa(ev.target); drawSeam(); } });
$('slips').addEventListener('keydown', ev => {
  if (ev.target.matches('.slip textarea')) { if (ev.key === 'Escape') { editId = null; paintPocket(); } else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ev.target.closest('.slip').querySelector('[data-act="save"]').click(); } return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.slip')) { ev.preventDefault(); ev.target.click(); }
});
$('tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (!b) return; pocketTab = b.dataset.tab; openId = null; paintPocket(); });
let qt = 0;
$('q').addEventListener('input', ev => { pocketQ = ev.target.value.trim(); clearTimeout(qt); qt = setTimeout(pkFetch, 300); });
const pin = $('pkIn'), pkAdd = $('pkAdd');
pin.addEventListener('input', () => { fitTa(pin); pkAdd.classList.toggle('has', !!pin.value.trim()); });
pin.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); pkAdd.requestSubmit(); } });
pkAdd.addEventListener('submit', ev => {
  ev.preventDefault();
  const text = pin.value.trim(); if (!text) return;
  const done = () => { pin.value = ''; fitTa(pin); pkAdd.classList.remove('has'); };
  if (!LIVE) { const top = Math.max(0, ...demoPk.map(x => x.no || 0)); demoPk.unshift({ id: 'd' + Date.now(), ts: new Date().toISOString(), text, url: '', title: '', source: '笔记', status: 'unread', by: 'note', no: top + 1 }); done(); pkFetch().then(() => { $('pkScroll').scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }); return; }
  hapi('/app/pocket', jpost({ text, by: 'note' }))
    .then(() => { done(); return pkFetch(); }).then(() => $('pkScroll').scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }))
    .catch(e => toast(e && e.auth ? '钥匙不认了' : '没放进去'));
});

/* 缝线：一道手绘的针脚线顺着纸条排下去，每张纸条在线上打一个小叉、伸一小截短刻度；没看过的那条换成一颗蓝点 */
function drawSeam() {
  const rowsEl = $('pkRows'), cv = $('seam'), w = 40, h = Math.max(rowsEl.scrollHeight, rowsEl.clientHeight);
  const g = fitCanvas(cv, w, h), ink = dark ? C.PAPER : C.LINE, sx = 22, Rn = rng(4242);
  const slips = [...$('slips').querySelectorAll('.slip')];
  const y0 = 6, y1 = h - 40;
  // 测绘线：一根很淡的蓝硬线
  g.strokeStyle = inkBlue(); g.globalAlpha = 0.3; g.lineWidth = 0.5; g.beginPath(); g.moveTo(sx + 0.25, y0); g.lineTo(sx + 0.25, y1); g.stroke();
  // 针脚：贴着测绘线右侧一道短划，长短略不齐
  g.strokeStyle = ink; g.lineWidth = 0.55; g.lineCap = 'butt'; g.globalAlpha = 0.5; g.beginPath();
  for (let y = y0 + 2; y < y1;) { const L = 2.6 + Rn() * 1.2, dx = (Rn() - 0.5) * 0.5; g.moveTo(sx + 3 + dx, y); g.lineTo(sx + 3 + dx + (Rn() - 0.5) * 0.4, y + L); y += L + 2.4 + Rn() * 0.8; }
  g.stroke();
  g.globalAlpha = 1;
  slips.forEach((s, i) => {
    const y = s.offsetTop + Math.min(13, s.offsetHeight / 2), unread = s.classList.contains('unread');
    // 一根细线从缝线牵到纸条左边，代替整框；离纸条留一点空
    const xe = s.offsetLeft - 5;
    g.strokeStyle = ink; g.globalAlpha = 0.5; g.lineWidth = 0.45; g.beginPath(); g.moveTo(sx + 6, y); g.lineTo(sx + 11, y); g.stroke();
    if (xe > sx + 14) { g.globalAlpha = 0.28; g.lineWidth = 0.35; g.setLineDash([0.9, 1.9]); g.beginPath(); g.moveTo(sx + 13, y); g.lineTo(xe, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 0.5; g.fillStyle = ink; g.beginPath(); dot(g, xe + 1.6, y, 0.55); g.fill(); }
    if (unread) { g.globalAlpha = 1; g.fillStyle = inkBlue(); g.beginPath(); g.arc(sx + 0.25, y, 1.7, 0, TAU); g.fill(); }
    else { g.globalAlpha = 0.6; g.beginPath(); g.moveTo(sx - 1.6, y - 1.6); g.lineTo(sx + 1.9, y + 1.6); g.moveTo(sx + 1.9, y - 1.6); g.lineTo(sx - 1.6, y + 1.6); g.stroke(); }
  });
  // 线尾：一个线结，几粒线头
  g.globalAlpha = 0.55; g.fillStyle = ink; g.beginPath(); dot(g, sx + 3, y1 + 3, 1.3); for (let k = 0; k < 6; k++) dot(g, sx + 3 + (Rn() - 0.4) * 8, y1 + 6 + Rn() * 10, 0.3 + Rn() * 0.3); g.fill(); g.globalAlpha = 1;
}

/* =================================================================== 待办 =================================================================== */
const TODO_KEY = 'nyx_todos', SEEN_KEY = 'ta_todo_seen';
let demoTd = DEMO_TD.map(x => Object.assign({}, x));
function loadTodos() { if (!LIVE) return demoTd.map(x => Object.assign({}, x)); try { const a = JSON.parse(localStorage.getItem(TODO_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function saveTodos(l) { if (!LIVE) { demoTd = l.map(x => Object.assign({}, x)); return; } try { localStorage.setItem(TODO_KEY, JSON.stringify(l)); } catch (_) {} }
const pulledNow = new Set();
let seenMark = LIVE ? (+ls(SEEN_KEY) || 0) : now - 2 * 3600000;
const isNew = t => !!t.inbox_id && !t.done && (pulledNow.has(t.id) || (+t.ts || 0) > seenMark);
const BOX = '<svg class="bx" viewBox="0 0 10 10" aria-hidden="true"><path d="M.5 .5H9.5V9.5H.5Z" fill="none" stroke="var(--fg2)" stroke-width=".6"/></svg>';
const BOXON = '<svg class="bx" viewBox="0 0 10 10" aria-hidden="true"><path d="M.5 9.5L9.5 .5V9.5Z" fill="var(--lb)"/><path d="M.5 .5H9.5V9.5H.5Z" fill="none" stroke="var(--lb)" stroke-width=".6"/><path d="M-1.3 11.3L11.3-1.3" stroke="var(--lb)" stroke-width=".5"/></svg>';
const XS = '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M.5 .5L6.5 6.5M6.5 .5L.5 6.5" stroke="var(--fg2)" stroke-width=".6"/></svg>';
let lastTdIds = null;
const tdFull = new Set();   // 折了两行的，点一下字先展开，再点才勾
/* 待办里夹的网址一样收成「域名 ↗」 */
const tdText = t => { const parts = String(t || '').replace(BOILER, '').split(URL_RE), us = String(t || '').replace(BOILER, '').match(URL_RE) || [];
  return parts.map((p, i) => rich(p) + (us[i] ? `<a class="u" href="${esc(us[i])}" target="_blank" rel="noopener noreferrer">${esc(host(us[i]) || '链接')}<b>↗</b></a>` : '')).join(''); };
function paintTodo() {
  const all = loadTodos(), undone = all.filter(t => !t.done), fresh = undone.filter(isNew), rest = undone.filter(t => !isNew(t));
  const list = fresh.concat(rest, all.filter(t => t.done));
  const prev = lastTdIds; lastTdIds = new Set(list.map(t => t.id));
  $('tdRows').innerHTML = list.length ? list.map(t => `<div class="td${t.done ? ' done' : ''}${tdFull.has(t.id) ? ' full' : ''}${prev && !prev.has(t.id) ? ' in' : ''}" data-id="${esc(t.id)}" role="checkbox" aria-checked="${!!t.done}" tabindex="0">` +
    (isNew(t) ? '<i class="nw" aria-label="新塞来的"></i>' : '') + (t.done ? BOXON : BOX) +
    `<span class="t"><span class="s">${tdText(t.text)}</span></span>${t.from ? `<span class="fr">· ${esc(t.from)}</span>` : ''}` +
    `<button class="x" type="button" data-act="del" aria-label="删掉">${XS}</button></div>`).join('')
    : '<p class="quiet">没有待办</p>';
  $('nTd').textContent = undone.length || '';
  $('tdDot').hidden = !fresh.length;
}
$('tdRows').addEventListener('click', ev => {
  const row = ev.target.closest('.td'); if (!row) return;
  if (ev.target.closest('a')) return;
  const sp = row.querySelector('.s');
  if (ev.target.closest('.t') && !row.classList.contains('full') && sp && sp.scrollHeight > sp.clientHeight + 1) { tdFull.add(row.dataset.id); row.classList.add('full'); return; }
  let l = loadTodos();
  if (ev.target.closest('[data-act="del"]')) l = l.filter(t => t.id !== row.dataset.id);
  else l.forEach(t => { if (t.id === row.dataset.id) t.done = !t.done; });
  saveTodos(l); paintTodo();
});
$('tdRows').addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.td')) { ev.preventDefault(); ev.target.click(); } });
const tin = $('tdIn'), tdAdd = $('tdAdd');
tin.addEventListener('input', () => tdAdd.classList.toggle('has', !!tin.value.trim()));
tdAdd.addEventListener('submit', ev => {
  ev.preventDefault();
  const text = tin.value.trim(); if (!text) return;
  const l = loadTodos(); l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, done: false, ts: Date.now() });
  saveTodos(l); tin.value = ''; tdAdd.classList.remove('has'); paintTodo();
});
/* 收件箱：打开和切回前台时拉一次；只往后追加，按 inbox_id 去重；先存进本机再 ack，没存进去就不 ack（同 sheets.js pullInbox） */
let inboxBusy = false;
function pullInbox() {
  if (!LIVE || inboxBusy || document.hidden || !ls('nyx_key')) return;
  inboxBusy = true;
  hapi('/app/todo-inbox', { cache: 'no-store' }).then(d => {
    const items = (d && Array.isArray(d.items)) ? d.items : [];
    if (!items.length) return;
    const l = loadTodos(), have = {}, ids = []; let added = 0;
    l.forEach(t => { if (t && t.inbox_id) have[t.inbox_id] = 1; });
    items.forEach(it => {
      if (!it || !it.id || typeof it.text !== 'string') return;
      ids.push(it.id);
      if (have[it.id]) return;
      have[it.id] = 1; added++;
      const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: it.text.slice(0, 200), done: false, ts: +it.ts || Date.now(), from: it.by ? String(it.by).slice(0, 20) : '', inbox_id: it.id };
      pulledNow.add(t.id); l.push(t);
    });
    if (added) {
      saveTodos(l);
      if (JSON.stringify(loadTodos()) !== JSON.stringify(l)) return;   // 没存进去（满了之类）就先别 ack，下次再来
      paintTodo();
      try { window.dispatchEvent(new StorageEvent('storage', { key: TODO_KEY })); } catch (_) {}
    }
    if (ids.length) return hapi('/app/todo-inbox/ack', jpost({ ids }));
  }).catch(() => {}).then(() => { inboxBusy = false; });
}
function markSeen() { if (!LIVE) return; seenMark = Date.now(); try { localStorage.setItem(SEEN_KEY, String(seenMark)); } catch (_) {} }
window.addEventListener('storage', ev => { if (!ev.key || ev.key === TODO_KEY) paintTodo(); });

/* ---------- 两态切换 ---------- */
let view = Q.get('v') === 'td' ? 'td' : 'pk';
function setView(v) {
  if (view === 'td' && v !== 'td') { markSeen(); pulledNow.clear(); }
  view = v; document.body.classList.toggle('v-td', v === 'td');
  document.querySelectorAll('#tog button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('pk').inert = v !== 'pk'; $('td').inert = v !== 'td';
  if (v === 'td') paintTodo();
}
$('tog').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b && b.dataset.v !== view) setView(b.dataset.v); });
let sx0 = null;   // 往左翻一页 / 往右翻回来
$('panes').addEventListener('touchstart', ev => { const t = ev.touches[0]; sx0 = [t.clientX, t.clientY]; }, { passive: true });
$('panes').addEventListener('touchend', ev => {
  if (!sx0) return; const t = ev.changedTouches[0], dx = t.clientX - sx0[0], dy = t.clientY - sx0[1]; sx0 = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && !ev.target.closest('textarea,input')) setView(dx < 0 ? 'td' : 'pk');
}, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (view === 'td') markSeen(); } else { pullInbox(); if (LIVE && ls('nyx_key')) pkFetch(); } });

/* =================================================================== 画 =================================================================== */
/* 标题图标：聊天页 tixIcon 的口袋那枚（只读照抄，蓝箔、反白 V 缝、露一角直角信纸） */
const f2 = n => (Math.round(n * 100) / 100).toString();
function tixDust(base, seed, id) {
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
function pocketIcon(id) {
  const hl = (deg, offs) => { const a = deg * PI / 180, ux = Math.cos(a), uy = Math.sin(a); return offs.map(o => `M${f2(-uy * o - ux * 14)} ${f2(ux * o - uy * 14)}L${f2(-uy * o + ux * 14)} ${f2(ux * o + uy * 14)}`).join(''); };
  const ser = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * 0.9, ny = (x1 - x0) / L * 0.9; return `M${f2(x0 - nx)} ${f2(y0 - ny)}L${f2(x0 + nx)} ${f2(y0 + ny)}M${f2(x1 - nx)} ${f2(y1 - ny)}L${f2(x1 + nx)} ${f2(y1 + ny)}`; };
  const two = (S, fillR, emptyR, divider, serif, det, hatch, moreL, dust, rot) => `<defs><clipPath id="${id}f"><path d="${fillR}"/></clipPath><clipPath id="${id}e"><path d="${emptyR}"/></clipPath><clipPath id="${id}s"><path d="${S}"/></clipPath></defs>
    ${tixFoil(cl => `<path class="${cl}" d="${S}" clip-path="url(#${id}f)"/>`, inner => `<g clip-path="url(#${id}s)"><g clip-path="url(#${id}f)">${inner}</g></g>`, S + divider, rot)}
    <g clip-path="url(#${id}s)"><g clip-path="url(#${id}e)"><path class="h" d="${hatch}"/></g></g>
    ${det ? `<g clip-path="url(#${id}e)"><path class="l" d="${det}"/></g><g clip-path="url(#${id}f)"><path class="w" d="${det}"/></g>` : ''}
    ${dust || ''}<path class="l" d="${S}"/>${moreL || ''}<path class="l" d="${divider}"/><path class="l" d="${serif}"/>`;
  const S = 'M-7.4-5.4H7.4V3.4L0 8.8-7.4 3.4Z', D = 'M-10.6-2.2L10.8-3.6', V = 'M-4.8.6L0 4.4 4.8.6', card = 'M-4.6-5.4V-9.8H2.8V-5.4';
  return two(S, D + 'V20H-10.6Z', D + 'V-20H-10.6Z', D, ser(-10.6, -2.2, 10.8, -3.6), V, hl(0, [-4.6, -3.4]), `<path class="l" d="${card}" transform="rotate(-6 -.9 -5.4)"/><path class="h" d="M-3.4-8.4H1.8M-3.4-7.2H1.8" transform="rotate(-6 -.9 -5.4)"/>`, tixDust(t => { const [x, y, nx, ny] = seg(-10.6, -2.2, 10.8, -3.6, .16, .84)(t); return [x, y, nx, ny]; }, 74, id));
}

/* ---------- 铅笔：照搬 chat.js 的 hand() / hatchP()（主页签绘建筑那套），PU 换成屏幕像素 ---------- */
const PU = 1;
let SKR = rng(1), SKU = [];
function hand(pts, o) {
  o = o || {}; const list = o.to || SKU, w = o.w || 0.7, al = o.a || 0.45, n = o.n || 2, jit = (o.j === undefined ? 0.7 : o.j) * PU, ov = (o.ov === undefined ? 3 : o.ov) * PU, c = o.c || 0, fd = o.fade || [1, 1];
  const m = pts.length, Ls = new Array(m); Ls[0] = 0; for (let i = 1; i < m; i++) Ls[i] = Ls[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const L = Ls[m - 1]; if (!(L > 0.8 * PU)) return;
  for (let ps = 0; ps < n; ps++) {
    let s0 = -ov * SKR(), s1 = L + ov * SKR();
    if (ps) { const span = 0.4 + 0.6 * SKR(), st = SKR() * (1 - span); s0 = L * st - ov * 0.4 * SKR(); s1 = L * (st + span) + ov * 0.4 * SKR(); }
    const off = (SKR() - 0.5) * (ps ? 1.6 : 0.4) * jit, p1 = SKR() * TAU, p2 = SKR() * TAU, p3 = SKR() * TAU, f1 = TAU / ((70 + SKR() * 90) * PU), fq2 = TAU / ((16 + SKR() * 20) * PU), f3 = TAU / ((36 + SKR() * 60) * PU), pa = ps ? 0.5 + 0.4 * SKR() : 1;
    let s = s0, i = 1, cur = [], acc = 0, segL = (10 + SKR() * 16) * PU;
    for (let guard = 0; guard < 6000; guard++) {
      while (i < m - 1 && Ls[i] < s) i++;
      const a = pts[i - 1], b = pts[i], sl = (Ls[i] - Ls[i - 1]) || 1, tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl, f = s - Ls[i - 1];
      const d = off + jit * (0.6 * Math.sin(s * f1 + p1) + 0.4 * Math.sin(s * fq2 + p2));
      cur.push(a[0] + tx * f - ty * d, a[1] + ty * f + tx * d);
      if (acc >= segL || s >= s1) {
        if (cur.length >= 4) { const sm = s - acc / 2, uu = clamp((sm - s0) / (s1 - s0), 0, 1), tap = Math.min(1, uu * 5 + 0.4, (1 - uu) * 5 + 0.4), pr = tap * (0.62 + 0.38 * Math.sin(sm * f3 + p3)) * (0.85 + 0.3 * SKR()), ff = fd[0] + (fd[1] - fd[0]) * clamp(sm / L, 0, 1);
          list.push({ p: cur, w: w * (0.55 + 0.7 * pr) * Math.sqrt(PU), a: Math.min(0.95, al * pa * ff * (0.5 + 0.75 * pr)), c }); }
        if (s >= s1) break; cur = cur.slice(-2); acc = 0; segL = (10 + SKR() * 16) * PU;
      }
      const stp = Math.max(0.01, Math.min(3.2 * PU, s1 - s)); s += stp; acc += stp;
    }
  }
}
function hatchP(poly, deg, gap, o) {
  const t = deg * PI / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * PU * (0.3 + SKR() * 0.5); d < mx; d += gap * PU * (0.72 + SKR() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.6 * PU) continue; const a = xs[i] + l * SKR() * 0.14, b = xs[i + 1] - l * SKR() * 0.14; hand([[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o); }
  }
}
const CL = { w: 0.42, a: 0.2, n: 1, j: 0.5, ov: 9 }, OL = { w: 0.7, a: 0.46, n: 2, j: 0.7, ov: 3 }, OLs = { w: 0.58, a: 0.38, n: 2, j: 0.45, ov: 1.6 }, HT = { w: 0.5, a: 0.3, n: 1, j: 0.25, ov: 1.4 };
const pen = (o, x) => Object.assign({}, o, x);
const arcPts = (cx, cy, a, b, rot, t0, t1) => { const n = Math.max(6, Math.ceil(Math.abs(t1 - t0) * Math.max(a, b) / 2.5)), cr = Math.cos(rot), sr = Math.sin(rot), out = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = Math.cos(t) * a, y = Math.sin(t) * b; out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return out; };
function flush(g, cols) {   // 把攒下的小段一起画；c 0 墨、1 蓝
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of SKU) { g.strokeStyle = cols[s.c] || cols[0]; g.globalAlpha = s.a; g.lineWidth = s.w; g.beginPath(); g.moveTo(s.p[0], s.p[1]); for (let i = 2; i < s.p.length; i += 2) g.lineTo(s.p[i], s.p[i + 1]); g.stroke(); }
  g.globalAlpha = 1; SKU = [];
}
/* 把一组局部坐标的点转到画布上：平移、缩放、转一点 */
const xf = (ox, oy, s, rot) => { const c = Math.cos(rot || 0), si = Math.sin(rot || 0); return p => [ox + (p[0] * c - p[1] * si) * s, oy + (p[0] * si + p[1] * c) * s]; };
const poly = (T, pts, close) => { const q = pts.map(T); if (close) q.push(q[0]); return q; };
function stitches(T, pts, o, dash, gap) {   // 沿一条折线走短针脚
  const P = pts.map(T); let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let s = carry;
    while (s < L) { const e = Math.min(L, s + dash); if (e - s > 0.8) hand([[a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L], [a[0] + (b[0] - a[0]) * e / L, a[1] + (b[1] - a[1]) * e / L]], o); s = e + gap; }
    carry = s - L;
  }
}

/* 右上那一堆：衬衫口袋插一支笔、口袋里露一角纸条；左下一张票根、一枚回形针；口袋右下一颗掉了的扣子；比例尺；一点线头粒子 */
function drawCluster(g, W) {
  const s = clamp(W / 390, 0.8, 1.05) * 0.8, ox = W - 150 * s - 4, oy = 14;
  const ink = dark ? C.PAPER : C.LINE, blue = inkBlue(), bg = dark ? C.INK : C.PAPER, cols = [ink, blue];
  const T = xf(ox, oy, s, -0.035);
  SKR = rng(1112);
  // 衬衫：门襟两道淡线，两颗扣子
  hand(poly(T, [[6, -6], [5.2, 108]]), pen(CL, { a: 0.26, fade: [0.4, 1] })); hand(poly(T, [[15, -6], [14.4, 108]]), pen(CL, { a: 0.22, fade: [0.4, 1] }));
  [[10.2, 26], [9.8, 84]].forEach(([bx, by]) => { const c = T([bx, by]); hand(arcPts(c[0], c[1], 3.1 * s, 3.1 * s, 0, 0, TAU + 0.3), OLs); });
  // 肩线 / 胸省：一根很淡的长弧
  hand(arcPts(...T([150, 160]), 150 * s, 150 * s, 0, -2.25, -1.62), pen(CL, { a: 0.18 }));
  // 口袋：尖底的贴袋
  const PK = [[38, 40], [112, 36], [113, 98], [76.5, 112], [40, 101]];
  // 先画口袋里伸出来的东西（底色压住口袋上沿以下的部分由口袋前片挡住：只画上沿以上）
  // 纸条：一角直角纸，转一点，上面两道字线
  const slipT = xf(...T([52, 41]), s, -0.12), SL = [[0, 0], [0, -21], [24, -21], [24, 0]];
  g.fillStyle = bg; g.beginPath(); SL.map(slipT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  hand(poly(slipT, SL), OLs); hand(poly(slipT, [[4, -15.5], [19, -15.5]]), pen(HT, { a: 0.34 })); hand(poly(slipT, [[4, -11.5], [16, -11.5]]), pen(HT, { a: 0.3 }));
  g.font = `italic 500 ${f2(5.6 * s)}px "Cormorant Garamond",Georgia,serif`; g.fillStyle = ink; g.globalAlpha = 0.6; g.save(); const sp = slipT([10.5, -6.2]); g.translate(sp[0], sp[1]); g.rotate(-0.155); g.fillText('N°036', 0, 0); g.restore(); g.globalAlpha = 1;
  // 笔：往右斜一点；笔帽实心蓝、笔杆只留轮廓，帽口一道分界线两头出头；笔夹压在口袋前片外面
  const pr = 0.16, penT = xf(...T([90, 40]), s, pr);
  const barrel = [[-3.6, 0], [-3.6, -18], [3.6, -18], [3.6, 0]], cap = [[-3.6, -18], [-3.6, -36], [-1.6, -38.5], [1.6, -38.5], [3.6, -36], [3.6, -18]];
  g.fillStyle = bg; g.beginPath(); barrel.map(penT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  g.fillStyle = blue; g.beginPath(); cap.map(penT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  // 帽上反白一道细高光
  g.strokeStyle = bg; g.globalAlpha = 0.55; g.lineWidth = 0.6 * s; g.beginPath(); { const a = penT([-1.5, -21]), b = penT([-1.5, -35.5]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); g.globalAlpha = 1;
  hand(poly(penT, barrel), OL); hand(poly(penT, cap), pen(OL, { c: 1, a: 0.7 }));
  hand(poly(penT, [[-6.2, -18], [6.2, -18]]), pen(OLs, { a: 0.6 }));   // 分界线，两头伸出去
  hatchP(poly(penT, [[0.6, -1], [0.6, -17], [3.3, -17], [3.3, -1]]), 90 + pr * 180 / PI, 2.1, pen(HT, { a: 0.28 }));
  // 口袋前片（盖住笔和纸条的下半截）
  g.fillStyle = bg; g.beginPath(); PK.map(T).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  hand(poly(T, PK, true), OL);
  hand(poly(T, [[38.4, 49], [112.2, 45]]), pen(OLs, { a: 0.34 }));   // 袋口折边
  stitches(T, [[41.5, 52.5], [109.6, 48.7], [110.2, 96.6], [76.6, 108.8], [43, 99.2], [41.5, 52.5]], pen(HT, { a: 0.36, j: 0.15 }), 2.4 * s, 1.9 * s);
  stitches(T, [[41, 43.5], [109.8, 39.8]], pen(HT, { a: 0.3, j: 0.15 }), 2.4 * s, 1.9 * s);
  // 口袋右侧和下尖的阴影排线
  hatchP(poly(T, [[96, 58], [110, 57], [110.4, 95.4], [86, 104]]), -58, 3.2, HT);
  hatchP(poly(T, [[101, 66], [110, 65.5], [110.3, 93], [96, 99]]), 24, 3.8, pen(HT, { a: 0.22 }));   // 第二层，交叉一点
  hatchP(poly(T, [[39, 44], [112, 40], [112.1, 46.6], [39, 50.5]]), 66, 2.3, pen(HT, { a: 0.2 }));   // 袋口折边里一窄条
  stitches(T, [[8.6, 2], [8, 104]], pen(HT, { a: 0.26, j: 0.1 }), 2 * s, 2.2 * s);   // 门襟的明线
  // 笔夹：一条窄蓝，压在口袋外，下头一个小圆珠
  const clipT = xf(...T([90, 40]), s, pr);
  g.fillStyle = blue; g.beginPath(); [[2.4, -32], [3.7, -32], [3.7, 12], [2.4, 12]].map(clipT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  { const c = clipT([3.05, 13.2]); g.beginPath(); g.arc(c[0], c[1], 1.6 * s, 0, TAU); g.fill(); }
  
  // 掉出来的扣子：四个孔，一截线头
  { const bc = T([132, 120]); hand(arcPts(bc[0], bc[1], 4.4 * s, 4.4 * s, 0, 0.2, TAU + 0.5), OLs); hand(arcPts(bc[0], bc[1], 3.2 * s, 3.2 * s, 0, 1, 4.6), pen(HT, { a: 0.24 }));
    g.fillStyle = ink; g.globalAlpha = 0.7; g.beginPath(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => dot(g, bc[0] + a * 1.2 * s, bc[1] + b * 1.2 * s, 0.55 * s)); g.fill(); g.globalAlpha = 1;
    hand([[bc[0] + 3 * s, bc[1] - 3.2 * s], [bc[0] + 7 * s, bc[1] - 9 * s], [bc[0] + 5 * s, bc[1] - 14 * s]], pen(HT, { c: 1, a: 0.6 })); }
  // 票根：左下，转一点，一列齿孔，一条蓝的面值条
  const tkT = xf(...T([-38, 92]), s, 0.13), TK = [[0, 0], [40, 0], [40, 18], [0, 18]];
  g.fillStyle = dark ? '#1c1d23' : '#f6f4ee'; g.beginPath(); TK.map(tkT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  hand(poly(tkT, TK, true), OLs);
  g.fillStyle = ink; g.globalAlpha = 0.55; g.beginPath(); for (let k = 1; k < 9; k++) { const p = tkT([29, k * 2]); dot(g, p[0], p[1], 0.42 * s); } g.fill(); g.globalAlpha = 1;
  g.fillStyle = blue; g.beginPath(); [[3, 12], [26, 12], [26, 14.2], [3, 14.2]].map(tkT).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  g.save(); { const p = tkT([3.2, 7.6]); g.translate(p[0], p[1]); g.rotate(0.13 - 0.035); g.fillStyle = ink; g.globalAlpha = 0.72; g.font = `500 ${f2(5.2 * s)}px "Cormorant Garamond",Georgia,serif`; g.fillText('ADMIT', 0, 0); g.font = `italic 500 ${f2(5.4 * s)}px "Cormorant Garamond",Georgia,serif`; g.fillText('N°12', 30.4 * s, 4 * s); } g.restore(); g.globalAlpha = 1;
  // 回形针：搭在票根上沿
  const cpT = xf(...T([-14, 84]), s, -0.5);
  const clipPts = [[0, 0], [0, -16]].concat(arcPts(2.6, -16, 2.6, 2.6, 0, PI, TAU).slice(1), [[5.2, -3]], arcPts(3.3, -3, 1.9, 1.9, 0, 0, PI).slice(1), [[1.4, -13]], arcPts(2.8, -13, 1.4, 1.4, 0, PI, TAU).slice(1), [[4.2, -6]]);
  hand(poly(cpT, clipPts), pen(OLs, { n: 1, a: 0.55, j: 0.2 }));
  // 标注：笔帽外一圈虚线小圆，一根引线往右上拉到一个小字母
  { const c = penT([0, -30]), r = 10 * s, e = [c[0] + 26 * s, c[1] - 12 * s];
    g.strokeStyle = ink; g.lineWidth = 0.4; g.globalAlpha = 0.45; g.setLineDash([1.2, 1.8]); g.beginPath(); g.arc(c[0], c[1], r, 0, TAU); g.stroke(); g.setLineDash([]);
    const a0 = Math.atan2(e[1] - c[1], e[0] - c[0]); g.beginPath(); g.moveTo(c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r); g.lineTo(e[0], e[1]); g.lineTo(e[0] + 7 * s, e[1]); g.stroke();
    g.globalAlpha = 0.65; g.fillStyle = ink; g.font = `italic 400 ${f2(7.5 * s)}px "Cormorant Garamond",Georgia,serif`; g.fillText('a.', e[0] + 8.5 * s, e[1] + 2.2 * s); g.globalAlpha = 1; }
  // 比例尺：口袋下面一根硬直线，两头短竖，一个小字
  const r0 = T([40, 124]), r1 = T([113, 121.5]);
  g.strokeStyle = ink; g.globalAlpha = 0.42; g.lineWidth = 0.45; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]);
  [r0, r1].forEach(p => { g.moveTo(p[0], p[1] - 2.6); g.lineTo(p[0], p[1] + 2.6); }); for (let k = 1; k < 6; k++) { const p = [r0[0] + (r1[0] - r0[0]) * k / 6, r0[1] + (r1[1] - r0[1]) * k / 6]; g.moveTo(p[0], p[1] - 1.2); g.lineTo(p[0], p[1]); } g.stroke();
  g.globalAlpha = 0.6; g.fillStyle = ink; g.font = `italic 300 ${f2(7 * s)}px "Cormorant Garamond",Georgia,serif`; g.textAlign = 'center'; { const m = [(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2]; g.fillText('12 cm', m[0], m[1] + 8.5); } g.textAlign = 'left'; g.globalAlpha = 1;
  flush(g, cols);
  // 线头和布屑：口袋周围一小撮粒子，笔尖附近几粒蓝
  const Rn = rng(77); g.fillStyle = ink; g.globalAlpha = 0.45; g.beginPath();
  for (let k = 0; k < 70; k++) { const a = Rn() * TAU, q = 20 + Math.pow(Rn(), 0.6) * 70, c = T([76 + Math.cos(a) * q, 70 + Math.sin(a) * q * 0.8]); dot(g, c[0], c[1], 0.25 + Rn() * 0.35); }
  g.fill(); g.fillStyle = blue; g.globalAlpha = 0.75; g.beginPath(); for (let k = 0; k < 9; k++) { const c = penT([(Rn() - 0.5) * 16, -40 - Rn() * 9]); dot(g, c[0], c[1], 0.3 + Rn() * 0.35); } g.fill(); g.globalAlpha = 1;
}
let W = 0, H = 0;
function drawDeco() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  const g = fitCanvas(deco, W, H);
  spots(g, W, H, 3131, dark ? 'rgba(241,238,230,0.12)' : 'rgba(84,84,88,0.16)');
  drawCluster(g, W);
  // 标题下一小段淡的测绘刻度：从图标往右，到切换那排为止
  g.strokeStyle = dark ? C.PAPER : C.LINE; g.globalAlpha = 0.28; g.lineWidth = 0.45; g.beginPath(); g.moveTo(24, 98.5); g.lineTo(Math.min(160, W * 0.42), 98.5); for (let k = 0; k <= 8; k++) { const x = 24 + k * (Math.min(160, W * 0.42) - 24) / 8; g.moveTo(x, 98.5); g.lineTo(x, k % 4 ? 100 : 101.5); } g.stroke(); g.globalAlpha = 1;
  g.fillStyle = inkBlue(); g.beginPath(); g.arc(24, 98.5, 1.2, 0, TAU); g.fill();
}

/* ---------- 起 ---------- */
$('ico').innerHTML = pocketIcon('pki');
const td = new Date(); $('tdDate').textContent = (td.getMonth() + 1) + '.' + String(td.getDate()).padStart(2, '0');
const info = homeInfo('pocket', 4, 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { drawDeco(); paintPocket(); }, 120); });
setupGrain();
setView(view);
paintTodo();
const boot = LIVE ? loadConfig().then(() => { const N = window.NYX || {}; HOME = N.relay || '/relay'; }) : Promise.resolve();
const fl = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
drawDeco(); paintPocket();
Promise.all([boot, fl]).then(() => {
  drawDeco();
  pkFetch(); pullInbox();
  revealIn(info, stage, () => { window.__revealed = true; });
  window.__ready = true;
});
window.__pocket = { pkFetch, paintPocket, paintTodo, pullInbox, setView, get items() { return pocketItems; } };
})();
