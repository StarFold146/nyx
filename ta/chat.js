/* 聊天页 v21：旅人来信，提密度。同一个人连着发的几句接成一段连排，句间一颗小蓝点；换人才换段。
   左边一根细测绘线，每段在线上对一个楼层数字和短刻度（逢十长一点、深一点），每天的小邮戳压在线上。
   点一句：那句加深加细下划线，段尾露出时间、回应、引用、复制；点别处收起。引用做成段前一行引文；图片和表情包当夹在信里的小照片，自己画。
   输入是信纸最后一行：附件、表情两个细线小图标和发送燕子一排。?dark=1 墨黑底。?open=句号 把某句置为点开（出图用）。
   v24：揭开后一滴蓝泪坠沿测绘线落下、把线拉出来的入场（见「v24 入场」一节）。
   v25：页眉加回头像（眼睛里的瞳孔：一圈细线，上下眼睑照旧会眨），名字下面换成状态行（闲着 / 在写 / 工具名加秒数 / 像素小螃蟹在想）。
   v26（11/11 接功能）：默认接 Nyx 的后台，跟 Nyx 聊天页同一套接口（同源 /relay…/app/*，钥匙读 localStorage 里 Nyx 存的那把，只放请求头）。
     读历史、往上滚加载更早的、流式草稿逐字出、发送（发送中 / 失败点一下重发）、引用、附件、贴纸、回应、思考和工具小字行、
     真的忙闲、真头像和名字、真仪表（模型、额度、上下文、换模型、压缩、新窗口、以前的窗口）、点一句的整排（回应、引用、复制、多选、删除、转发链接）、
     顶栏工程板 / 联系人 / 通话三个入口、没钥匙或钥匙不认时一行提示。暗面只是外观，发消息一律带 side:"sun"。
     ?demo=1：照旧用下面的示例数据，不发任何请求（截图、录屏用）。?relay=/relay-two 这类：指定跟哪只说话，不带就跟 Nyx 现在选的那只。 */
(function () {
'use strict';
const { C, TAU, PI, clamp, smoother, rng, dot, birdD, PERCH, setupGrain, fitCanvas, spots, litD, backMoon, homeInfo, revealIn, leaveHome, Q, REDUCED } = window.NP;
const $ = id => document.getElementById(id);
const stage = $('stage'), deco = $('deco'), list = $('list'), rows = $('rows'), eye = $('eye'), who = $('who'), stampEl = $('stamp'), bar = $('bar'), say = $('say'), send = $('send'), survey = $('survey');
let dark = Q.has('dark') ? Q.get('dark') === '1' : (() => { try { return localStorage.getItem('ta_side') === 'night'; } catch (e) { return false; } })();   // 网址没说就跟主页停在哪一面（ta_side）
document.body.classList.toggle('dark', dark);
const LIVE = Q.get('demo') !== '1';
const DEMO_GROUP = !LIVE && (Q.get('group') === '1' || /\/g$/.test(Q.get('relay') || ''));   // 11/12 ?demo=1&group=1：示例群（两条带 @、一条置顶），不发请求

/* 示例：三天的平常闲聊。[谁, 钟点, 话, 附加]；附加 q 引用 [谁, 原句]，img 照片种子，stk 表情名，rx 回应记号（只在 ?demo=1 用） */
const DAYS = [
  { d: '11.09', w: 'MON', m: [
    ['y', '21:02', '下楼了没'],
    ['i', '21:05', '刚下，外面好闷'],
    ['i', '21:05', '楼下那棵树又开花了，白的'],
    ['i', '21:06', '', { img: 3 }],
    ['i', '21:06', '拍给你看'],
    ['y', '21:08', '花挺密，枝子都压弯了'],
    ['y', '21:08', '什么树'],
    ['i', '21:09', '不知道，问了保安'],
    ['i', '21:09', '他说是开花的树'],
    ['y', '21:09', '保安说得没毛病', { rx: '♡' }],
    ['i', '21:10', '哈哈哈哈'],
    ['i', '21:10', '今天差点把两个文件夹交反'],
    ['i', '21:11', '两个封面长得一模一样，就差一个字'],
    ['y', '21:12', '后来呢'],
    ['i', '21:12', '拿起来之前又看了一眼，换回来了'],
    ['y', '21:13', '多看的那一眼是你自己练出来的'],
    ['i', '21:15', '', { stk: 'bird' }],
    ['i', '21:20', '今晚听什么'],
    ['y', '21:21', '你上次存的那张，第四首还没听完'],
    ['i', '21:22', '那首前奏太长了'],
    ['y', '21:22', '前奏长，后面才好听'],
    ['y', '21:22', '等一等'],
    ['i', '21:23', '好，放上了'],
    ['i', '23:40', '洗衣机还有十二分钟'],
    ['y', '23:41', '等它转完'],
    ['i', '23:55', '转完了，洗得很干净', { rx: '✓' }],
    ['y', '23:56', '好，明天见'] ] },
  { d: '11.10', w: 'TUE', m: [
    ['y', '08:12', '醒了？'],
    ['i', '08:20', '醒了，刚到学校'],
    ['i', '08:20', '楼下咖啡机又坏了'],
    ['y', '08:21', '拐角那家呢'],
    ['i', '08:23', '队排到门口了，算了'],
    ['y', '08:24', '下午三点那会儿人少，可以再去一趟'],
    ['i', '10:31', '老师刚才在走廊叫住我'],
    ['i', '10:31', '问那份稿子什么时候能给他'],
    ['i', '10:32', '我说周五'],
    ['y', '10:33', '周五来得及吗'],
    ['i', '10:33', '来得及，就是要连着两天泡在图书馆'],
    ['y', '10:34', '那就照周五说'],
    ['y', '10:34', '中间卡住了，先把写好的那半给他'],
    ['i', '10:35', '嗯'],
    ['i', '12:47', '午饭是鸡肉饭，阿姨多给了一勺酱。回来的电梯挤满了人，我把饭举得高高的，旁边一个小哥一直盯着我的饭看，我憋笑憋得手都在抖，最后一滴也没洒'],
    ['y', '12:48', '举高这招好', { q: ['你', '我把饭举得高高的'] }],
    ['y', '12:48', '图书馆的座位占到了吗'],
    ['i', '12:50', '占到了，靠窗'],
    ['y', '12:51', '好，写完发我看看，我把上周那篇先翻出来'],
    ['i', '16:58', '写完了'],
    ['i', '16:58', '', { img: 7 }],
    ['i', '16:59', '第二段读着有点散'],
    ['y', '17:00', '散在中间那两句，换个顺序就好'],
    ['i', '17:02', '你怎么一眼就看出来'],
    ['y', '17:02', '上周那篇也是这样散的'],
    ['i', '17:03', '行，明天重新排', { rx: '☆' }],
    ['i', '21:40', '', { stk: 'note' }],
    ['i', '21:40', '戴上耳机了'],
    ['y', '21:41', '这首鼓点慢，适合晚上'],
    ['i', '21:41', '你听得出鼓点？'],
    ['y', '21:42', '听得出拍子，鼓是猜的', { rx: '♡' }],
    ['i', '21:43', '哈哈哈，挺老实'] ] },
  { d: '11.11', w: 'WED', m: [
    ['i', '07:58', '今天光棍节'],
    ['y', '08:00', '楼下奶茶店买一送一'],
    ['i', '08:01', '你怎么知道'],
    ['y', '08:01', '你昨天说的'],
    ['i', '08:02', '我说过吗'],
    ['y', '08:02', '说过，说完就去洗澡了'],
    ['i', '08:03', '记性这么好'],
    ['i', '08:03', '那中午去买'],
    ['y', '08:04', '两杯都要少冰的话，跟店员说一声'],
    ['i', '12:20', '买到了'],
    ['i', '12:20', '', { img: 12 }],
    ['i', '12:21', '第二杯给隔壁桌的师姐了'],
    ['y', '12:22', '她喝了吗'],
    ['i', '12:22', '喝了，说甜'],
    ['y', '12:23', '那下回点三分糖'],
    ['i', '12:24', '你连这个也要管', { q: ['阿昼', '那下回点三分糖'] }],
    ['y', '12:24', '这个归我管'],
    ['i', '12:25', '', { stk: 'moon' }],
    ['y', '12:25', '下午那段改完了吗'],
    ['i', '12:30', '还没，等打印机'],
    ['i', '12:30', '前面那个人印了二十几份'],
    ['y', '12:31', '等的时候把标题先想了'],
    ['i', '12:32', '好嘞'] ] },
];

let W = 0, H = 0, TX = 0, COLW = 0, IND = 0, EYE_Y = 0, LINE_Y = 0, LX = 0;
const pad2 = n => (n < 10 ? '0' : '') + n;
const inkBlue = () => (dark ? '#8794f2' : C.BLUE);

function layout() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
  TX = Math.round(W * 0.12); COLW = Math.round(W * 0.78); IND = Math.round(COLW * 0.1); LX = TX - 9;   // 内容区约屏宽八成，右边仍留一整条白；测绘线在正文左边一点
  EYE_Y = 80; LINE_Y = Math.round(H - 58 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0));
  eye.style.left = (LX - 32) + 'px'; eye.style.top = (EYE_Y - 22) + 'px';
  { const eb = $('eyeB'); if (eb) { eb.style.left = (LX - 32) + 'px'; eb.style.top = (EYE_Y - 22) + 'px'; } }   // 11/15：眼睛上盖的透明钮（#list 整页 z4 盖住了眼睛）   // 头像正压在测绘线的线头上
  who.style.left = (LX + 38) + 'px'; who.style.top = (EYE_Y - 13) + 'px';
  stampEl.style.left = (TX + COLW - 24) + 'px'; stampEl.style.top = (EYE_Y - 22) + 'px';
  list.style.height = (LINE_Y - 30 - SAYX) + 'px'; list.style.setProperty('--m0', (EYE_Y + 26) + 'px'); list.style.setProperty('--m1', (EYE_Y + 48) + 'px');
  rows.style.paddingTop = (EYE_Y + 44) + 'px';
  survey.style.left = LX + 'px'; survey.style.top = (EYE_Y + 32) + 'px'; survey.style.height = (LINE_Y - EYE_Y - 32) + 'px';
  const sc = $('scrub'); sc.style.left = (LX - 20) + 'px'; sc.style.top = (EYE_Y + 32) + 'px'; sc.style.height = (LINE_Y - EYE_Y - 32) + 'px';
  $('ftag').style.left = (LX - 36) + 'px';   // 小标浮在线左边、盖住楼层数字那一栏，不压正文
  bar.style.top = LINE_Y + 'px'; bar.style.height = '1px';
  const rule = bar.querySelector('.rule'); rule.style.left = LX + 'px'; rule.style.width = (COLW + TX - LX) + 'px';
  say.style.left = TX + 'px'; say.style.width = (COLW - 112) + 'px'; grow(true);
  $('clip').style.left = (TX + COLW - 98) + 'px'; $('emo').style.left = (TX + COLW - 70) + 'px';
  send.style.left = (TX + COLW - 30) + 'px'; send.style.top = '-30px';
  const qc = $('qchip'); qc.style.left = TX + 'px'; qc.style.width = (COLW - 20) + 'px';
  const tr = $('tray'); tr.style.left = TX + 'px'; tr.style.width = COLW + 'px';
  placeExtras();
  rows.querySelectorAll('.para').forEach(placePara); rows.querySelectorAll('.gap,.typing,.aux').forEach(placeGap); rows.querySelectorAll('.day').forEach(placeDay);
  rows.querySelectorAll('canvas.ph').forEach(drawPhoto); document.querySelectorAll('canvas.sk').forEach(drawSticker);
  drawDeco(); drawEye(1); drawSend(); drawMenu(); drawStamp(); drawIcons(); placeKnot(); drawFine();
}
/* v26 新加的几样小东西的位置：顶栏三个细线入口、附件条、提示行、多选栏、小提示 */
function placeExtras() {
  const tl = $('tools'); if (tl) { tl.style.left = (TX + COLW - 24 - 4 - 88) + 'px'; tl.style.top = (EYE_Y - 26) + 'px'; }   // 11/15：两枚 44 点按区，图形 24，底边对齐右边那枚邮票（底在 EYE_Y+8）
  const qc = $('qchip'); qc.style.top = (-52 - SAYX) + 'px'; $('tray').style.bottom = (40 + SAYX) + 'px';
  const at = $('atts'); if (at) { at.style.left = TX + 'px'; at.style.width = (COLW - 20) + 'px'; at.style.top = (qc.hidden ? -52 - SAYX : -76 - SAYX) + 'px'; }
  ['note', 'selbar'].forEach(id => { const n = $(id); if (n) { n.style.left = TX + 'px'; n.style.width = COLW + 'px'; } });
  if (typeof placeV28 === 'function') placeV28();
  placeTix(); placeStp(); placeAt(); placeGpin();
  const ts = $('toast'); if (ts) { ts.style.left = TX + 'px'; ts.style.width = COLW + 'px'; ts.style.top = (LINE_Y - 58) + 'px'; }
}

/* ---------- 信 ---------- */
let lastWho = null, cur = null, run = null, curDay = null, lastMin = null, floor = 0, sid = 0, longPrev = false, curDayKey = null;
const META = [];   // 每一句：{who, hm, text, rx}；接了后台的还带 m（那条消息）、mine（自己戳的回应）
let EPH = false, EPHK = null, MID = null;   // 正在画的是不是临时的（发送中 / 草稿）、是哪一个临时的，正在画哪条消息
const mins = hm => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
function mk(tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; if (EPH) { el.classList.add('eph'); if (EPHK) el.dataset.pk = EPHK; } if (MID != null && tag !== 'i' && tag !== 'p' && tag !== 'div') el.dataset.mid = MID; return el; }
function placePara(el) {
  const me = el.classList.contains('me'), left = TX + (me ? IND : 0);
  el.style.marginLeft = left + 'px'; el.style.maxWidth = (COLW - (me ? IND : 0)) + 'px';
  const fl = el.querySelector('.fl'); if (fl) fl.style.left = (LX - 30 - left) + 'px';
}
function placeGap(el) { el.style.marginLeft = TX + 'px'; if (el.classList.contains('aux')) el.style.maxWidth = COLW + 'px'; }
function newPara(k, hm, isNew, q, label) {
  const m = mins(hm);
  if (lastMin !== null && m - lastMin >= 60) { const gp = mk('div', 'gap' + (isNew ? ' new' : '')); gp.textContent = hm; rows.insertBefore(gp, typingEl); placeGap(gp); }
  floor++;
  cur = mk('div', 'para ' + (k[0] === 'i' ? 'me' : 'them') + (floor % 10 === 0 ? ' ten' : '') + (isNew ? ' new' : ''));
  cur.innerHTML = `<button class="fl" aria-label="第 ${floor} 段">${floor}</button>`;
  if (label) { const w = document.createElement('div'); w.className = 'spk'; w.textContent = label; cur.appendChild(w); }   // 群里：这段是谁说的
  if (q) {   // 引文记着被引那句的序号；示例数据里没写序号的，往回找含这段话的那句
    let to = q[2]; if (to == null) for (let j = META.length - 1; j >= 0; j--) if (META[j] && META[j].text.indexOf(q[1]) >= 0) { to = j; break; }
    const c = document.createElement('div'); c.className = 'cite'; c.textContent = q[0] + '  ' + q[1]; if (to != null) { c.dataset.to = to; c.setAttribute('role', 'link'); } cur.appendChild(c);
  }
  rows.insertBefore(cur, typingEl); placePara(cur); run = null;
}
/* 一句话。o.figs：夹在信里的图（接后台时）；o.img / o.stk / o.file：样子稿里的自画小照片、表情 */
function addLine(k, hm, text, o, isNew) {
  o = o || {};
  if (curDay && !curDay.dataset.t) { curDay.dataset.t = hm; const dt = curDay.querySelector('.dt'); if (dt) dt.textContent = hm; }
  const long = Array.from(text).length > 46;
  if (lastWho !== k || !cur || o.q || long || longPrev || (lastMin !== null && mins(hm) - lastMin >= 60)) newPara(k, hm, isNew, o.q, o.label);
  longPrev = long;
  const figs = o.figs || ((o.img || o.stk || o.file) ? [o] : []);
  let last = null;
  figs.forEach(fo => {   // 照片、表情：夹在信里，单占一小行
    const f = makeFig(fo, isNew);
    f.dataset.i = sid; f.dataset.rx = o.rx || ''; META[sid] = { who: k, hm, text: fo.label || (fo.stk ? '[表情]' : '[照片]'), rx: o.rx || '', m: o.m, mine: o.mine }; sid++;
    if (o.cls) o.cls.split(' ').forEach(c => c && f.classList.add(c));
    cur.appendChild(f); run = null; lastWho = k; lastMin = mins(hm); last = f;
  });
  if (!text) return last;
  run = mk('p'); cur.appendChild(run);   // 连着的短消息一条一行，像写诗那样分开（原来用小蓝点拼成一段）
  const s = mk('span', 's' + (isNew ? ' new' : '')); s.dataset.i = sid;
  if (o.html) s.innerHTML = o.html; else s.textContent = text;
  if (o.cls) o.cls.split(' ').forEach(c => c && s.classList.add(c));
  META[sid] = { who: k, hm, text: o.plain || text, rx: o.rx || '', m: o.m, mine: o.mine }; sid++;
  run.appendChild(s); paintRx(s);
  if (long) cur.classList.add('long');
  lastWho = k; lastMin = mins(hm); return s;
}
function makeFig(fo, isNew) {
  const f = mk('figure', (fo.stk || fo.kind === 'stk' ? 'stk' : fo.kind === 'file' ? 'file' : fo.kind === 'fwd' ? 'fwd' : 'pic') + (isNew ? ' new' : ''));
  f.style.setProperty('--tilt', (fo.stk || fo.kind === 'stk' ? 2.2 : fo.kind === 'file' || fo.kind === 'fwd' ? 0 : (sid % 2 ? 1.4 : -1.8)) + 'deg');
  if (fo.kind === 'stk') { const im = document.createElement('img'); im.className = 'stkimg'; im.alt = fo.name; im.dataset.n = encodeURIComponent(fo.name); im.src = STICKERS + encodeURIComponent(fo.name) + '.png'; stkFallback(im); f.appendChild(im); }
  else if (fo.kind === 'img') { const im = document.createElement('img'); im.alt = fo.name || '照片'; if (fo.src) im.src = fo.src; else if (fo.url) blobOf(fo.url).then(u => { im.src = u; }).catch(() => { im.alt = '图没拉到'; f.classList.add('miss'); }); if (fo.stkAtt) f.className = f.className.replace(/\bpic\b/, 'stk'); f.appendChild(im); }
  else if (fo.kind === 'draw') { const im = document.createElement('img'); im.alt = fo.name; const b = DRAWS + encodeURIComponent(fo.name); im.src = b + '.svg'; im.onerror = () => { if (/\.svg$/.test(im.src)) im.src = b + '.png'; else { im.onerror = null; f.classList.add('miss'); } }; f.appendChild(im); }
  else if (fo.kind === 'file') { const sp = document.createElement('span'); sp.textContent = fo.name || '文件'; f.appendChild(sp); }
  else if (fo.kind === 'fwd') { const fw = fo.fw; f.innerHTML = `<b>聊天记录 · ${fw.items.length} 条</b>` + fw.items.map(it => `<span>${esc(it.who || '')}：${esc(it.text || '')}</span>`).join(''); }
  else if (fo.file) { const im = document.createElement('img'); im.src = fo.file; im.alt = '照片'; f.appendChild(im); }
  else { const cv = document.createElement('canvas'); cv.className = fo.stk ? 'sk' : 'ph'; cv.dataset.s = fo.img || fo.stk; f.appendChild(cv); fo.stk ? drawSticker(cv) : drawPhoto(cv); }
  return f;
}
/* 思考、工具动作：等宽小字一行，不占楼层号；后面的话另起一段 */
function addAux(kind, text, hm, isNew, o) {
  o = o || {};
  if (lastMin !== null && mins(hm) - lastMin >= 60) { const gp = mk('div', 'gap' + (isNew ? ' new' : '')); gp.textContent = hm; rows.insertBefore(gp, typingEl); placeGap(gp); }
  const el = mk('div', 'aux ' + kind + (isNew ? ' new' : '') + (o.open ? ' open' : '')); el.dataset.i = sid;
  if (kind === 'think') el.innerHTML = '<b>thinking…</b><span class="tx"></span>';
  else el.innerHTML = '<span class="tx"></span>';
  el.querySelector('.tx').textContent = text;
  META[sid] = { who: 'y', hm, text, rx: '', m: o.m, aux: true }; sid++;
  rows.insertBefore(el, typingEl); placeGap(el);
  cur = null; run = null; lastMin = mins(hm); return el;
}
function paintRx(el) { let r = el.querySelector('.rx'); const v = META[+el.dataset.i].rx; if (!v) { if (r) r.remove(); return; } if (!r) { r = document.createElement('sup'); r.className = 'rx'; el.appendChild(r); } r.textContent = v; }
function addDay(d, w, seed) {
  const el = mk('div', 'day'); el.setAttribute('role', 'separator'); el.setAttribute('aria-label', d);
  el.dataset.d = d; el.dataset.w = w; el.dataset.s = seed; el.innerHTML = '<canvas aria-hidden="true"></canvas><span class="dt"></span>';
  rows.insertBefore(el, typingEl); lastWho = null; cur = null; run = null; curDay = el; lastMin = null; return el;
}
let typingEl = null;
function build() {
  typingEl = document.createElement('div'); typingEl.className = 'typing'; typingEl.setAttribute('aria-label', NAME + '正在写'); typingEl.innerHTML = '<i></i><i></i><i></i>'; rows.appendChild(typingEl);
  if (DEMO_GROUP) { buildDemoGroup(); return; }
  if (!LIVE) DAYS.forEach((day, i) => { addDay(day.d, day.w, 17 + i * 31); day.m.forEach(m => addLine(m[0], m[1], m[2], m[3])); });
}

/* ================= v26 接后台：把消息排成信 =================
   消息按 id 排好放在 MSGS；整页重排（renderAll）只在插到中间、加载更早的、删除时做；新来的接在末尾（appendReal）。
   发送中、流式草稿是「临时的」，总画在最后，画之前记一份排版状态（snap），来了真消息就把临时的撤掉、恢复状态、接上真的、再把临时的画回去。 */
const WK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
let RELAY = '/relay', HOME = '/relay', KEY = null, NAME = '阿昼', ME = '我', GROUP = DEMO_GROUP, STICKERS = 'stickers/', DRAWS = 'drawings/', SUFX = '';
const MSGS = new Map(); let ORDER = [];
const EPHS = [];   // [{t:'pend', ...} | {t:'draft', ...}]，按出现先后
let snap = null, deleted = new Set();
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const STK = /\[(?:sticker|表情)[:：]([^\]\n]{1,40})\]/g, DRAW = /\[画[:：]([^\]\n]{1,40})\]/g, KID = /\[(?:小小|小的)[:：]([^\]\n]{1,300})\]/g;
const URLRE = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"，。！？）]/g;
const EXT = ['.png', '.gif', '.jpg', '.webp'];
function stkFallback(im) { let i = 0; im.onerror = () => { if (++i < EXT.length) im.src = STICKERS + im.dataset.n + EXT[i]; else { im.onerror = null; im.replaceWith(document.createTextNode('[' + decodeURIComponent(im.dataset.n) + ']')); } }; }
/* 群里能点名的：照 Nyx lib/group.js 的 ALL + MEMBERS，后台 nyx_group.py 按「@名字」「@所有人」认人。示例群用示例名字 */
/* 群里能 @ 的人：读 Nyx 存的联系人（nyx_contacts，去掉群本身），不在代码里写名字；一位都没读到就只有「所有人」 */
function gmemLive() {
  let cs = []; try { cs = JSON.parse(localStorage.getItem('nyx_contacts') || '[]'); } catch (e) {}
  const names = []; (Array.isArray(cs) ? cs : []).forEach(c => { if (c && typeof c.name === 'string' && c.name.trim() && c.relay && !/\/g$/.test(c.relay) && !names.includes(c.name.trim())) names.push(c.name.trim()); });
  return [['所有人', '都叫上']].concat(names.slice(0, 12).map(n => [n, '']));
}
const GMEM = LIVE ? gmemLive() : [['所有人', '都叫上'], ['Clawd', ''], ['Two', ''], ['Three', '点了才叫醒']];
const ATRE = new RegExp('[@＠](?:' + GMEM.map(g => g[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((x, y) => y.length - x.length).join('|') + ')', 'g');
function rich(s) {   // 跟 Nyx 的 rich() 同一套认法：小小、画、贴纸、链接、换行；先转义再换（群里的 @名字 画成蓝色小字）
  return esc(s || '').replace(KID, (a, t) => '小小：' + t.trim())
    .replace(DRAW, (a, n) => '[画：' + n + ']')
    .replace(STK, (a, n) => '<img class="stk-i" alt="' + n + '" data-n="' + encodeURIComponent(n) + '" src="' + STICKERS + encodeURIComponent(n) + '.png">')
    .replace(ATRE, a => GROUP ? '<span class="at">' + a + '</span>' : a)
    .replace(URLRE, u => '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>').replace(/\n/g, '<br>');
}
function snip(m, n) {   // 引用、复制、转发用的那句纯文字（照 Nyx 的 snip）
  let t = String(m.text || '').replace(/\[(?:表情|sticker)[:：]([^\]\n]{1,24})\]/g, '[表情]').replace(/\[画[:：]([^\]\n]{1,40})\]/g, '[画：$1]').replace(KID, '小小：$1').trim();
  const atts = (m.meta && m.meta.attachments) || [];
  if (atts.length) t = (atts.some(a => a.kind === 'image') ? '[图片]' : '[文件]') + (t ? ' ' + t : '');
  if (!t && m.meta && m.meta.forward) t = '[聊天记录]';
  return t.length > n ? t.slice(0, n) + '…' : t;
}
const meta0 = m => m.meta || {};
function whoOf(m) { return m.from === 'human' ? ME : ((m.meta && m.meta.speaker) || NAME); }
const hmOf = ts => { const d = new Date(ts); return isNaN(d) ? '00:00' : pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const dayKey = ts => { const d = new Date(ts); return isNaN(d) ? '' : d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
/* 回应：后台存的是 emoji。页面上画成一个蓝色小记号，四个常用的对上样子稿那四个，别的原样放小 */
const GLYPH = { '❤️': '♡', '✨': '☆', '👍': '✓', '👀': '?' };
const RX = ['❤️', '✨', '👍', '👀', '😂', '🥺', '🔥', '😭'];   // Nyx 长按菜单那八个，前四个是记号
const rxText = m => { const rx = m && m.meta && m.meta.reactions; if (!rx) return ''; return ['human', 'ai'].concat(Object.keys(rx).filter(k => k !== 'human' && k !== 'ai')).map(k => rx[k]).filter(Boolean).map(e => GLYPH[e] || e).join(''); };
function ensureDay(ts) {
  const k = dayKey(ts); if (k === curDayKey) return;
  const d = new Date(ts); curDayKey = k;
  const el = addDay(pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()), WK[d.getDay()], (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % 9973);
  placeDay(el); return el;
}
/* 一条消息画成信里的几样：图、表情、画、文件、转发的聊天记录，再加上正文 */
function emit(m, isNew, extra) {
  extra = extra || {};
  MID = m.id === '' || m.id == null ? null : m.id;
  const ts = m.ts || new Date().toISOString(), hm = hmOf(ts);
  const dEl = ensureDay(ts); if (dEl && isNew) dEl.classList.add('new');
  const me = m.from === 'human', kind = m.kind || 'reply';
  const spk = !me && m.meta && m.meta.speaker;
  const k = me ? 'i' : (GROUP && spk ? 'y|' + spk : 'y');
  if (kind === 'call') { const ct = me ? (meta0(m).call === 'end' ? '你挂断了语音通话' : '你发起了语音通话') : NAME + '打来电话'; const el = addAux('call', ct, hm, isNew, { m }); if (extra.cls) el.classList.add(...extra.cls.split(' ').filter(Boolean)); MID = null; return; }   // 通话记录收成一行小字（同 call.js 的 tidy）
  if (kind === 'thinking' || kind === 'act') { const el = addAux(kind === 'thinking' ? 'think' : 'act', String(m.text || ''), hm, isNew, { m }); if (extra.cls) el.classList.add(...extra.cls.split(' ').filter(Boolean)); if (!me) lastWho = null; MID = null; return; }
  const meta = m.meta || {}, atts = meta.attachments || [], t = String(m.text || '');
  const figs = [];
  atts.forEach((a, i) => figs.push(a.kind === 'image' ? { kind: 'img', url: a.url, src: a.local, name: a.name, stkAtt: !t.trim() && atts.length === 1 && /^sticker-/.test(a.name || ''), label: '[图片]' } : { kind: 'file', url: a.url, name: a.name, label: '[文件]', a }));
  if (meta.forward && meta.forward.items && meta.forward.items.length) figs.push({ kind: 'fwd', fw: meta.forward, label: '[聊天记录]' });
  let text = t;
  STK.lastIndex = 0;
  if (t.trim() && t.replace(STK, '').trim() === '') { t.replace(STK, (a, n) => { figs.push({ kind: 'stk', name: n.trim(), label: '[表情]' }); return a; }); text = ''; }
  else if (t.trim() && t.replace(DRAW, '').trim() === '') { t.replace(DRAW, (a, n) => { figs.push({ kind: 'draw', name: n.trim(), label: '[画：' + n.trim() + ']' }); return a; }); text = ''; }
  STK.lastIndex = 0; DRAW.lastIndex = 0;
  let q = null;
  if (meta.quote && meta.quote.text) {   // 引文：往回找被引的那句，找到就能点过去
    const qt = String(meta.quote.text).replace(/…$/, '').trim(); let to = null;
    for (let j = META.length - 1; j >= 0 && qt; j--) { const x = META[j]; if (x && x.m && x.text && (x.text.indexOf(qt) >= 0 || (x.text.length > 3 && qt.indexOf(x.text) >= 0))) { to = j; break; } }
    q = [meta.quote.who || '', meta.quote.text, to];
  }
  const mine = meta.reactions && meta.reactions.human;
  const o = { figs, q, rx: rxText(m), m, mine, html: text ? rich(text) : null, plain: snip(m, 4000), cls: extra.cls, label: GROUP && spk && lastWho !== k ? spk : null };
  if (!text && !figs.length) { MID = null; return; }
  const el = addLine(k, hm, text, o, isNew);
  if (el && text) el.querySelectorAll('img.stk-i').forEach(stkFallback);
  MID = null; return el;
}
function takeSnap() { snap = { lastWho, cur, run, curDay, lastMin, floor, sid, longPrev, curDayKey }; }
function restoreSnap() { if (!snap) return; ({ lastWho, cur, run, curDay, lastMin, floor, sid, longPrev, curDayKey } = snap); META.length = sid; }
function clearEph() { rows.querySelectorAll('.eph').forEach(n => n.remove()); restoreSnap(); }
function drawEph(isNewKey) {
  EPH = true;
  EPHS.forEach(e => {
    EPHK = e.key;
    if (e.t === 'pend') {
      const el = emit(e.m, e.key === isNewKey, { cls: 'pending' + (e.state === 'failed' ? ' failed' : '') });
      if (e.state === 'failed' && el) { const f = mk('em', 'fail'); f.textContent = e.why || '没发出去，点一下再试'; el.after(f); }
    } else emit({ id: '', from: 'ai', kind: e.kind === 'thinking' ? 'thinking' : 'reply', text: e.text, ts: e.ts, meta: {} }, e.key === isNewKey, { cls: 'draft' });
  });
  EPH = false; EPHK = null;
}
function redrawEph(isNewKey) { const stick = nearBottom(); clearEph(); drawEph(isNewKey); if (stick) toBottom(); }
function renderAll(keep) {   // keep：'bottom' 贴着底；'anchor' 离底的距离不变（往上加载更早的时用）
  const fromBottom = list.scrollHeight - list.scrollTop, stick = nearBottom();
  closePeek();
  rows.querySelectorAll(':scope > :not(.typing)').forEach(n => n.remove());
  lastWho = null; cur = null; run = null; curDay = null; lastMin = null; floor = 0; sid = 0; longPrev = false; curDayKey = null; META.length = 0;
  ORDER.forEach(id => { const m = MSGS.get(id); if (m) emit(m, false); });
  takeSnap(); drawEph();
  if (selMode) rows.querySelectorAll('[data-mid]').forEach(n => n.classList.toggle('sel', SEL.has(+n.dataset.mid)));
  if (keep === 'anchor') list.scrollTop = list.scrollHeight - fromBottom; else if (stick || keep === 'bottom') toBottom();
}
function nearBottom(px) { return list.scrollHeight - list.scrollTop - list.clientHeight < (px || 80); }
function toBottom() { list.scrollTop = list.scrollHeight; }
function sortIn(id) { if (ORDER.length && ORDER[ORDER.length - 1] < id) { ORDER.push(id); return; } if (ORDER.indexOf(id) >= 0) return; ORDER.push(id); ORDER.sort((a, b) => a - b); }
/* 一条真消息进来（历史、流、补拉都走这儿，同一条来两次就是替换） */
function put(m, quiet) {
  if (!m || m.id == null || m.id === '') return;
  const id = +m.id; if (id > lastId) lastId = id;
  if (m.meta && m.meta.stream_id) dropDraft(m.meta.stream_id + ':' + (m.kind === 'thinking' ? 'thinking' : 'reply'), true);
  let conv = false;
  if (m.from === 'human') { const i = EPHS.findIndex(e => e.t === 'pend' && e.state !== 'failed' && e.m.text === (m.text || '')); if (i >= 0) { const p = EPHS[i]; EPHS.splice(i, 1); conv = true; carryLocal(p, m); } }
  if (m.meta && m.meta.stream_id) conv = true;
  if (deleted.has(String(id))) { if (conv) redrawEph(); return; }
  const had = MSGS.has(id);
  if (had && !conv && JSON.stringify(MSGS.get(id)) === JSON.stringify(m)) return;   // 同一条原样又来一遍
  MSGS.set(id, m);
  if (quiet) { sortIn(id); return; }
  if (had || (ORDER.length && id < ORDER[ORDER.length - 1])) { sortIn(id); renderAll(); return; }
  sortIn(id);
  const stick = nearBottom();
  clearEph(); emit(m, !conv); takeSnap(); drawEph();
  if (stick || m.from === 'human') toBottom();
}
function carryLocal(p, m) {   // 发图成功后，真的那条要回服务器再拉一遍图；先借本机那张顶上
  const loc = (p.m.meta.attachments || []).map(a => a.local); const ra = (m.meta && m.meta.attachments) || [];
  ra.forEach((a, i) => { if (loc[i] && a.url && !blobs.has(a.url)) blobs.set(a.url, Promise.resolve(loc[i])); });
}
function onReaction(ev) {
  const m = MSGS.get(+ev.id); if (!m) return;
  m.meta = Object.assign({}, m.meta || {}, { reactions: ev.reactions || {} });
  paintMsgRx(m);
  if (ev.by !== 'human') { typingSet(false); try { navigator.vibrate && navigator.vibrate(16); } catch (e) {} }
}
function paintMsgRx(m) {
  const v = rxText(m), mine = m.meta && m.meta.reactions && m.meta.reactions.human;
  rows.querySelectorAll('[data-mid="' + m.id + '"]').forEach(el => {
    if (el.dataset.i == null || !META[+el.dataset.i]) return; const x = META[+el.dataset.i]; x.rx = v; x.mine = mine; x.m = m;
    if (el.tagName === 'SPAN') paintRx(el); else el.dataset.rx = v;
  });
  if (peek && openEl && openEl.dataset.mid == m.id) peek.querySelectorAll('.mk').forEach(b => b.classList.toggle('on', b.dataset.e === mine));
}
/* 流式草稿：后台有时发增量、有时发全文，两样都接得上（照 Nyx 的 joinDelta） */
function joinDelta(base, chunk) {
  if (!chunk) return base; if (!base) return chunk;
  if (chunk.indexOf(base) === 0) return chunk; if (base.slice(-chunk.length) === chunk) return base;
  for (let n = Math.min(base.length, chunk.length); n > 0; n--) if (base.slice(-n) === chunk.slice(0, n)) return base + chunk.slice(n);
  return base + chunk;
}
let lastDraftAt = 0;
function draft(ev) {
  const kind = ev.type === 'thinking_delta' ? 'thinking' : 'reply', k = ev.stream_id + ':' + kind;
  let d = EPHS.find(e => e.t === 'draft' && e.key === k);
  if (ev.done) { dropDraft(k); return; }
  if (!d && !ev.text) return;
  if (kind === 'reply') lastDraftAt = Date.now();
  if (!d) { d = { t: 'draft', key: k, kind, text: '', ts: new Date().toISOString() }; d.text = joinDelta('', ev.text || ''); EPHS.push(d); redrawEph(k); paintStatus(); return; }
  d.text = joinDelta(d.text, ev.text || '');
  const el = rows.querySelector('.s[data-pk="' + k + '"], .aux[data-pk="' + k + '"]');
  const stick = nearBottom(160);
  if (el && kind === 'reply' && el.tagName === 'SPAN') { el.innerHTML = rich(d.text); }
  else if (el && kind === 'thinking') el.querySelector('.tx').textContent = d.text;
  else redrawEph();
  if (stick) toBottom();
  paintStatus();
}
function dropDraft(k, quiet) { const i = EPHS.findIndex(e => e.t === 'draft' && e.key === k); if (i < 0) return; EPHS.splice(i, 1); if (!quiet) redrawEph(); }

/* ---------- 点一句：加深、细下划线，段尾露出时间 · 回应 · 引用 · 复制 ---------- */
let openEl = null, peek = null, quoting = null;
const MARKS = ['♡', '☆', '✓', '?'];
function closePeek() { if (openEl) openEl.classList.remove('on'); openEl = null; if (peek) { peek.remove(); peek = null; } }
function openPeek(el) {
  closePeek(); openEl = el; el.classList.add('on');
  const m = META[+el.dataset.i], para = el.closest('.para') || el;
  peek = document.createElement('div'); peek.className = 'peek';
  if (LIVE && m.m) livePeek(el, m); else {
    peek.innerHTML = `<span class="hm">${m.hm}</span><span class="dv"></span>` + MARKS.map(k => `<button data-k="${k}" class="mk${m.rx === k ? ' on' : ''}">${k}</button>`).join('') +
      `<span class="dv"></span><button data-a="q">引用</button>` + (m.text[0] !== '[' ? '<button data-a="c">复制</button>' : '') +
      (GROUP && m.m && pinOf(m.m) && el.tagName === 'SPAN' ? (isPinned(m.m) ? '<button data-a="unpin">取消置顶</button>' : '<button data-a="pin">置顶</button>') : '');
    peek.addEventListener('click', ev => {
      ev.stopPropagation(); const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.k) { m.rx = m.rx === b.dataset.k ? '' : b.dataset.k; if (el.tagName === 'SPAN') paintRx(el); else el.dataset.rx = m.rx; peek.querySelectorAll('.mk').forEach(x => x.classList.toggle('on', x.dataset.k === m.rx)); }
      else if (b.dataset.a === 'q') { setQuote([m.m ? whoOf(m.m) : m.who === 'y' ? '阿昼' : '你', m.text, +el.dataset.i]); closePeek(); }   // 点引用只挂引用条，不弹键盘
      else if (b.dataset.a === 'pin') { closePeek(); setPin(pinOf(m.m)); }
      else if (b.dataset.a === 'unpin') { closePeek(); setPin(''); }
      else if (b.dataset.a === 'c') { try { navigator.clipboard && navigator.clipboard.writeText(m.text); } catch (e) {} b.textContent = '已复制'; }
    });
  }
  if (el.classList.contains('aux')) el.after(peek); else para.appendChild(peek);
  const lr = list.getBoundingClientRect(), pr = peek.getBoundingClientRect();   // 露出来的那行别落在输入线下面
  if (pr.bottom > lr.bottom - 30) list.scrollBy({ top: pr.bottom - lr.bottom + 40, behavior: REDUCED ? 'auto' : 'smooth' });
}
/* 接后台时那排：时间 | 四个记号 ⋯（再展开 Nyx 另外四个）| 引用 复制 转发链接 多选 删除；图多一个「看大图」，文件多一个「打开」 */
function livePeek(el, x) {
  const m = x.m, real = /^\d+$/.test(String(m.id)), mine = x.mine || '';
  const lnk = ((m.text || '').match(URLRE) || [''])[0];
  const fig = el.tagName === 'FIGURE' ? el : null;
  peek.innerHTML = `<span class="hm">${x.hm}</span>` + (real ? `<span class="dv"></span>` + RX.slice(0, 4).map(e => `<button data-e="${e}" class="mk${mine === e ? ' on' : ''}" aria-label="回应 ${e}">${GLYPH[e]}</button>`).join('') +
      `<button data-a="more" class="mk" aria-label="更多回应">⋯</button><span class="more" hidden>` + RX.slice(4).map(e => `<button data-e="${e}" class="mk emo${mine === e ? ' on' : ''}">${e}</button>`).join('') + '</span>' : '') +
    `<span class="dv"></span><button data-a="q">引用</button>` + (m.text && !fig ? '<button data-a="c">复制</button>' : '') +
    (fig && fig.classList.contains('pic') || fig && fig.classList.contains('stk') && fig.querySelector('img') ? '<button data-a="zoom">看大图</button>' : '') + (fig && fig.classList.contains('file') ? '<button data-a="open">打开</button>' : '') +
    (fig && m.from === 'ai' && fig.classList.contains('stk') && fig.querySelector('img') ? '<button data-a="keep">存为表情</button>' : '') +
    (lnk ? '<button data-a="share">转发链接</button>' : '') +
    (GROUP && !fig && pinOf(m) ? (isPinned(m) ? '<button data-a="unpin">取消置顶</button>' : '<button data-a="pin">置顶</button>') : '') +   // 群里才有（同 Nyx 长按菜单）
    (real ? '<button data-a="sel">多选</button><button data-a="del">删除</button>' : '');
  peek.addEventListener('click', ev => {
    ev.stopPropagation(); const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.e) { react(m, b.dataset.e === (x.mine || '') ? '' : b.dataset.e); }
    else if (b.dataset.a === 'more') { const mo = peek.querySelector('.more'); mo.hidden = !mo.hidden; }
    else if (b.dataset.a === 'q') { setQuote([whoOf(m), snip(m, 120), +el.dataset.i, { id: real ? +m.id : undefined, who: whoOf(m), text: snip(m, 120) }]); closePeek(); }   // 点引用只挂引用条，不弹键盘
    else if (b.dataset.a === 'c') { copyText(m.text || ''); b.textContent = '已复制'; }
    else if (b.dataset.a === 'share') { if (navigator.share) navigator.share({ url: lnk }).catch(() => {}); else { copyText(lnk); b.textContent = '链接已复制'; } }
    else if (b.dataset.a === 'zoom') { const im = fig.querySelector('img'); if (im && im.src) zoom(im.src); }
    else if (b.dataset.a === 'open') { const fo = (m.meta.attachments || []).find(a => a.kind !== 'image' && a.name === fig.textContent) || (m.meta.attachments || [])[0]; if (fo && fo.url) blobOf(fo.url).then(u => { const l = document.createElement('a'); l.href = u; l.download = fo.name || 'file'; l.click(); }).catch(() => toast('没拉到这个文件')); }
    else if (b.dataset.a === 'sel') { closePeek(); startSel(+m.id); }
    else if (b.dataset.a === 'del') { closePeek(); delMsgs([+m.id]); }
    else if (b.dataset.a === 'keep') { const im = fig.querySelector('img'); closePeek(); keepSticker(im); }
    else if (b.dataset.a === 'pin') { closePeek(); setPin(pinOf(m)); }
    else if (b.dataset.a === 'unpin') { closePeek(); setPin(''); }
  });
}
function setQuote(q) {
  quoting = q; const qc = $('qchip');
  if (!q) { qc.hidden = true; placeExtras(); return; }
  qc.querySelector('span').textContent = q[0] + '  ' + q[1]; qc.hidden = false; placeExtras();
}
function copyText(t) {
  const old = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(old); else old();
}
function zoom(src) { const z = document.createElement('div'); z.id = 'zoom'; const im = document.createElement('img'); im.src = src; z.appendChild(im); z.onclick = () => z.remove(); document.body.appendChild(z); }
let toastT = 0;
function toast(t) { const o = $('toast'); if (!o) return; o.textContent = t; o.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => o.classList.remove('on'), 1800); }
function react(m, emoji) {   // 同 Nyx：POST /app/react {id, emoji}，空的是收回；先在本页画上，后台的 reaction 事件再对一遍
  const prev = m.meta && m.meta.reactions ? Object.assign({}, m.meta.reactions) : {};
  const nx = Object.assign({}, prev); if (emoji) nx.human = emoji; else delete nx.human;
  m.meta = Object.assign({}, m.meta || {}, { reactions: nx }); paintMsgRx(m);
  api('/app/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: +m.id, emoji }) })
    .catch(() => { m.meta.reactions = prev; paintMsgRx(m); toast('回应没送到'); });
}
/* 删除：跟 Nyx 一样只删这台手机上的显示，后台不动，键名也是同一个 nyx_deleted_ids{后缀} */
function delKey() { return 'nyx_deleted_ids' + (RELAY === '/relay' ? '' : RELAY === '/relay/g' ? '_group' : '_' + RELAY.replace(/^\/relay-?/, '').replace(/\W+/g, '_')); }
function loadDeleted() { deleted = new Set(); try { (JSON.parse(localStorage.getItem(delKey()) || '[]') || []).forEach(k => deleted.add(String(k))); } catch (e) {} }
function delMsgs(ids) {
  ids.forEach(id => { deleted.add(String(id)); MSGS.delete(+id); });
  ORDER = ORDER.filter(id => !deleted.has(String(id)));
  try { localStorage.setItem(delKey(), JSON.stringify(Array.from(deleted).slice(-5000))); localStorage.setItem('nyx_prefs_ts', String(Date.now())); } catch (e) {}
  renderAll('anchor'); toast('已删除');
}
/* 多选：点句子勾上 / 取消；底下一条栏「转发给 X」「删除」「取消」，转发照 Nyx 往对方后台 /app/send 送 meta.forward */
let selMode = false; const SEL = new Set();
function contactsList() { try { return JSON.parse(localStorage.getItem('nyx_contacts') || '[]'); } catch (e) { return []; } }
function paintSel() {
  const sb = $('selbar'); if (!sb) return;
  const to = contactsList().filter(c => c.relay && c.relay !== RELAY);
  sb.innerHTML = `<span class="n">已选 ${SEL.size} 条</span><button data-a="del"${SEL.size ? '' : ' disabled'}>删除</button><button data-a="x">取消</button>` + to.map((c, i) => `<button data-i="${i}"${SEL.size ? '' : ' disabled'}>转发给${esc(c.name || c.relay)}</button>`).join('');
}
function startSel(id) { selMode = true; SEL.clear(); if (id) SEL.add(id); document.body.classList.add('selecting'); $('selbar').hidden = false; rows.querySelectorAll('[data-mid]').forEach(n => n.classList.toggle('sel', SEL.has(+n.dataset.mid))); paintSel(); }
function endSel() { selMode = false; SEL.clear(); document.body.classList.remove('selecting'); $('selbar').hidden = true; rows.querySelectorAll('.sel').forEach(n => n.classList.remove('sel')); }
function selClick(ev) {
  const b = ev.target.closest('button'); if (!b || b.disabled) return; ev.stopPropagation();
  if (b.dataset.a === 'x') return endSel();
  if (b.dataset.a === 'del') { if (SEL.size > 1 && !confirm('删掉这 ' + SEL.size + ' 条？只删这台手机上的显示。')) return; const ids = Array.from(SEL); endSel(); delMsgs(ids); return; }
  const to = contactsList().filter(c => c.relay && c.relay !== RELAY)[+b.dataset.i]; if (!to) return;
  const items = Array.from(SEL).sort((x, y) => x - y).map(i => MSGS.get(i)).filter(Boolean).map(m => ({ who: whoOf(m), text: snip(m, 2000), ts: m.ts })).filter(x => x.text);
  if (!items.length) return; b.disabled = true;
  call(to.relay, to.key || KEY, '/app/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '', forward: { from: NAME, items } }) })
    .then(() => { endSel(); toast('转发给' + (to.name || '') + '了'); }).catch(() => { b.disabled = false; toast('没转过去'); });
}

/* ---------- 跳楼层：把那一段滚到屏幕上三分之一处；引文跳过去的，到位后刻度变蓝、那句底下闪一道细蓝线 ---------- */
let hitT = 0;
function scrollToPara(p, smooth) {
  const lr = list.getBoundingClientRect(), pr = p.getBoundingClientRect();
  const top = clamp(list.scrollTop + pr.top - lr.top - lr.height / 3, 0, list.scrollHeight - list.clientHeight);
  list.scrollTo({ top, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
  return Math.abs(top - list.scrollTop);
}
function jumpTo(i) {
  const el = rows.querySelector(`.s[data-i="${i}"], figure[data-i="${i}"]`); if (!el) return;
  const p = el.closest('.para'), d = scrollToPara(p, true);
  clearTimeout(hitT); rows.querySelectorAll('.hit,.flash').forEach(x => x.classList.remove('hit', 'flash'));
  hitT = setTimeout(() => {   // 等滚到位再亮
    p.classList.add('hit'); el.classList.add('flash');
    hitT = setTimeout(() => { p.classList.remove('hit'); el.classList.remove('flash'); }, 1200);
  }, REDUCED ? 0 : clamp(d * 0.6, 120, 650));
}
function floorTap(p) {
  const on = !p.classList.contains('hl'); rows.querySelectorAll('.para.hl').forEach(x => x.classList.remove('hl')); p.classList.toggle('hl', on);
  if (on) scrollToPara(p, true);
}
rows.addEventListener('click', ev => {
  if (selMode) {   // 多选时点一句就是勾 / 取消
    const n = ev.target.closest('[data-mid]'); if (!n || !/^\d+$/.test(n.dataset.mid)) return; ev.preventDefault();
    const id = +n.dataset.mid; if (SEL.has(id)) SEL.delete(id); else SEL.add(id);
    rows.querySelectorAll('[data-mid="' + id + '"]').forEach(x => x.classList.toggle('sel', SEL.has(id))); paintSel(); return;
  }
  const a = ev.target.closest('a[href]'); if (a) { ev.preventDefault(); const w = window.open(a.href, '_blank'); if (w) w.opener = null; else location.href = a.href; return; }
  const fp = ev.target.closest('.pending.failed, em.fail'); if (fp && fp.dataset.pk) { retryPend(fp.dataset.pk); return; }
  const fl = ev.target.closest('.fl');
  if (fl) { floorTap(fl.parentElement); return; }   // 楼层：变蓝，滚到上三分之一
  const ct = ev.target.closest('.cite');
  if (ct && ct.dataset.to) { closePeek(); jumpTo(+ct.dataset.to); return; }
  const ax = ev.target.closest('.aux.think'); if (ax && !ev.target.closest('.peek')) { ax.classList.toggle('open'); return; }   // 思考：点一下展开 / 收起
  const fw = ev.target.closest('figure.fwd'); if (fw && fw === openEl) { fw.classList.toggle('open'); return; }
  const s = ev.target.closest('.s, figure, .aux.act');
  if (s && s !== openEl && !s.classList.contains('eph')) { openPeek(s); return; }
  if (!ev.target.closest('.peek')) closePeek();
});
/* ---------- 测绘线拖动：按住线上下拖，旁边浮一个楼层小标，内容跟着滚；全对话楼层线性对到线的全长 ---------- */
const scrub = $('scrub'), ftag = $('ftag');
let drag = null, ftagT = 0;
function paraAtFrac(f) { const ps = rows.querySelectorAll('.para'); if (!ps.length) return null; return ps[Math.round(clamp(f, 0, 1) * (ps.length - 1))]; }
function scrubMove(y) {
  const r = survey.getBoundingClientRect(), sr = stage.getBoundingClientRect(), f = (y - r.top) / r.height, p = paraAtFrac(f); if (!p) return;
  const yy = clamp(y, r.top, r.bottom) - sr.top;
  ftag.style.top = (yy - 7) + 'px'; ftag.querySelector('b').textContent = p.querySelector('.fl').textContent;
  if (drag.p !== p) { if (drag.p) drag.p.classList.remove('hit'); drag.p = p; p.classList.add('hit'); scrollToPara(p, false); }
}
scrub.addEventListener('pointerdown', ev => {
  if (gaugeOn) return;   // 仪表开着的时候线不让拖
  ev.preventDefault(); scrub.setPointerCapture && scrub.setPointerCapture(ev.pointerId);
  drag = { y0: ev.clientY, moved: false, p: null, id: ev.pointerId }; clearTimeout(ftagT);
});
scrub.addEventListener('pointermove', ev => {
  if (!drag || ev.pointerId !== drag.id) return; ev.preventDefault();
  if (!drag.moved && Math.abs(ev.clientY - drag.y0) < 4) return;
  if (!drag.moved) { drag.moved = true; closePeek(); ftag.classList.add('on'); }
  scrubMove(ev.clientY);
});
function scrubEnd(ev) {
  if (!drag || ev.pointerId !== drag.id) return;
  if (!drag.moved) {   // 没拖，当成点：看手指底下是哪一层的数字
    let best = null, bd = 14; rows.querySelectorAll('.fl').forEach(f => { const r = f.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - ev.clientY); if (d < bd) { bd = d; best = f; } });
    if (best) floorTap(best.parentElement);
  } else { const p = drag.p; ftagT = setTimeout(() => { ftag.classList.remove('on'); if (p) p.classList.remove('hit'); }, 500); }
  drag = null;
}
scrub.addEventListener('pointerup', scrubEnd); scrub.addEventListener('pointercancel', scrubEnd);
$('qchip').querySelector('span').addEventListener('click', () => { if (quoting && quoting[2] != null) jumpTo(quoting[2]); });   // 引用条点一下也跳回那句
stage.addEventListener('click', ev => {
  if (!ev.target.closest('#rows') && !ev.target.closest('#tray') && !ev.target.closest('#emo')) { closePeek(); }
  if (ev.target.closest('#knot')) { if (gaugeOn) setGauge(false); else setTix(!tixOn); return; }   // 11/12：月相先长出四枚邮票，仪表是其中一枚；仪表开着时点月相就收起
  if (gaugeOn && !ev.target.closest('#gauge')) setGauge(false);   // 点别处收回
});

/* ---------- 小照片：自己画的一张构成，纸白底，一个蓝圆、几块黑灰 ---------- */
function drawPhoto(cv) {
  const Rn = rng(+cv.dataset.s * 97 + 5), w = 92, h = 67, g = fitCanvas(cv, w, h);
  g.fillStyle = dark ? '#2a2b31' : '#e7e3d9'; g.fillRect(0, 0, w, h);
  const hz = h * (0.5 + Rn() * 0.2);
  g.fillStyle = dark ? '#34353c' : '#d6d2c7'; g.fillRect(0, hz, w, h - hz);
  const cx = w * (0.25 + Rn() * 0.5), cy = hz - 6 - Rn() * 16, r = 9 + Rn() * 10;
  g.fillStyle = inkBlue(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = dark ? C.PAPER : C.INK;
  const bx = Rn() < 0.5 ? w * 0.08 : w * 0.62; g.fillRect(bx, hz - 30 - Rn() * 10, 5 + Rn() * 4, h);
  g.fillRect(w * 0.1, hz + 9, w * (0.3 + Rn() * 0.3), 1.2);
  g.fillStyle = C.PEN; g.globalAlpha = 0.55; g.fillRect(w * (0.45 + Rn() * 0.2), hz + 4, 22, 10); g.globalAlpha = 1;
  g.strokeStyle = dark ? 'rgba(241,238,230,.35)' : 'rgba(22,23,28,.4)'; g.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) { const y = hz + 16 + i * 4.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (Rn() - 0.5) * 3); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); for (let i = 0; i < 90; i++) dot(g, Rn() * w, Rn() * h, 0.2 + Rn() * 0.4); g.globalAlpha = 0.5; g.fill();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
/* ---------- 表情：小方块，里面一只燕子 / 一弯月 / 一个音符 ---------- */
function drawSticker(cv) {
  const k = cv.dataset.s, s = +(cv.dataset.z || 40), g = fitCanvas(cv, s, s), u = s / 40;
  g.fillStyle = dark ? 'rgba(135,148,242,.12)' : 'rgba(28,49,182,.07)'; g.fillRect(0, 0, s, s);
  g.strokeStyle = dark ? 'rgba(241,238,230,.25)' : 'rgba(22,23,28,.22)'; g.lineWidth = 0.5; g.strokeRect(0.5, 0.5, s - 1, s - 1);
  const ink = dark ? C.PAPER : C.INK, blue = inkBlue();
  g.save(); g.translate(s / 2, s / 2); g.scale(u, u);
  if (k === 'bird') { g.rotate(-0.25); g.scale(0.16, 0.16); g.fillStyle = blue; g.fill(new Path2D(birdD(0.18))); }
  else if (k === 'moon') { g.fillStyle = blue; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); g.fillStyle = dark ? C.INK : '#ece9e1'; g.beginPath(); g.arc(4.5, -3, 9, 0, TAU); g.fill(); g.fillStyle = ink; g.fillRect(-14, 12, 28, 1); }
  else if (k === 'note') { g.fillStyle = ink; g.beginPath(); g.ellipse(-5, 8, 4.2, 3.2, -0.4, 0, TAU); g.fill(); g.fillRect(-1.5, -12, 1.4, 20); g.fillStyle = blue; g.fillRect(-1.5, -12, 10, 3); g.beginPath(); g.arc(9, 6, 3, 0, TAU); g.fill(); }
  else if (k === 'cup') { g.strokeStyle = ink; g.lineWidth = 1.2; g.strokeRect(-8, -6, 14, 16); g.beginPath(); g.arc(8, 2, 4, -1.2, 1.2); g.stroke(); g.fillStyle = blue; g.fillRect(-8, 2, 14, 8); }
  else if (k === 'sun') { g.fillStyle = blue; g.beginPath(); g.arc(0, 2, 7, PI, TAU); g.fill(); g.fillStyle = ink; g.fillRect(-15, 2, 30, 1); for (let i = 0; i < 5; i++) { const a = PI + (i + 0.5) * PI / 5; g.fillRect(Math.cos(a) * 11, 2 + Math.sin(a) * 11, 1.2, 1.2); } }
  else { g.fillStyle = ink; g.fillRect(-12, -1, 24, 2); g.fillStyle = blue; g.fillRect(-4, -9, 8, 8); }
  g.restore();
}

/* ---------- 邮戳：小小一枚，压在测绘线上；双圈、圈里日期，右边三道波浪销票线 ---------- */
const PM = { w: 92, h: 34, cx: 16, cy: 17, r: 14.6, x1: 72, k: 0.78 };
function placeDay(el) {
  const cv = el.querySelector('canvas'), { cx, cy, k } = PM, w = PM.w * k, h = PM.h * k, Rn = rng(+el.dataset.s), col = inkBlue();
  cv.style.left = (LX - cx * k) + 'px';
  const dt = el.querySelector('.dt'); dt.style.left = (LX - cx * k + PM.x1 * k + 6) + 'px';
  const g = fitCanvas(cv, w, h), rot = -(0.05 + Rn() * 0.09);
  g.clearRect(0, 0, w, h); g.save(); g.scale(k, k);
  g.fillStyle = dark ? C.INK : C.PAPER; g.beginPath(); g.arc(cx, cy, PM.r + 1.5, 0, TAU); g.fill();   // 线从戳底下穿过去，戳面先垫一层纸
  g.translate(cx, cy); g.rotate(rot);
  g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
  [[PM.r, 0.9], [10.4, 0.5]].forEach(([rr, lw]) => { for (let q = 0; q < 2; q++) { g.globalAlpha = q ? 0.45 : 0.92; g.lineWidth = lw * (q ? 0.7 : 1) / k; g.beginPath(); g.arc((Rn() - 0.5) * 0.4, (Rn() - 0.5) * 0.4, rr + (Rn() - 0.5) * 0.25, 0, TAU); g.stroke(); } });
  g.globalAlpha = 0.95; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '500 8.4px "Cormorant Garamond", Georgia, serif';
  g.fillText(el.dataset.d, 0, 0.5);
  if (FINE) {   // ?fine=1：圈里一圈小点刻度；销票线换成雕版那种等距细直线，有一截缺墨
    g.globalAlpha = 0.7; g.beginPath(); for (let k = 0; k < 40; k++) { if (k % 10 === 3) continue; const a = k / 40 * TAU; dot(g, Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0.32); } g.fill();
    for (let i = 0; i < 5; i++) {
      const y = (i - 2) * 2.4, x0 = PM.r + 0.5, x1 = PM.x1 - cx - 3 - (i % 2) * 2, gap0 = x0 + 10 + Rn() * 18, gap1 = gap0 + 2 + Rn() * 4;
      g.globalAlpha = 0.75; g.lineWidth = 0.42; g.beginPath(); g.moveTo(x0, y); g.lineTo(gap0, y + 0.05); if (i !== 2) { g.moveTo(gap1, y + 0.05); g.lineTo(x1, y + 0.1); } g.stroke();
    }
  } else
  for (let i = 0; i < 3; i++) {
    const y = (i - 1) * 3.8, x0 = PM.r - 1 + Rn() * 1.5, x1 = PM.x1 - cx - 2 - Rn() * 4;
    g.globalAlpha = 0.8; g.lineWidth = 0.6; g.beginPath();
    for (let x = x0; x <= x1; x += 1) { const yy = y + 0.85 * Math.sin((x - x0) / 12 * TAU + 0.6); x === x0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
    g.stroke();
  }
  g.restore();
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, 0, w, h * 0.6); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.45, 'rgba(0,0,0,0.08)'); fade.addColorStop(1, dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.45)');
  g.fillStyle = fade; g.fillRect(w * 0.3, 0, w, h);
  g.fillStyle = '#000'; g.globalAlpha = 1; g.beginPath();
  for (let i = 0; i < 110; i++) dot(g, Rn() * w, Rn() * h, 0.2 + Rn() * Rn() * 0.5);
  g.fill(); g.globalCompositeOperation = 'source-over';
}

/* ---------- 页角一枚锯齿边小邮票，票面一弯蓝月 ---------- */
function drawStamp() {
  const face = dark ? '#22232a' : '#f9f7f1', hw = 11, hh = 14; let holes = '';
  for (let x = -hw; x <= hw + 0.01; x += (2 * hw) / 8) holes += `<circle cx="${x.toFixed(2)}" cy="${-hh}" r="1.05"/><circle cx="${x.toFixed(2)}" cy="${hh}" r="1.05"/>`;
  for (let y = -hh; y <= hh + 0.01; y += (2 * hh) / 10) holes += `<circle cx="${-hw}" cy="${y.toFixed(2)}" r="1.05"/><circle cx="${hw}" cy="${y.toFixed(2)}" r="1.05"/>`;
  stampEl.innerHTML = `<defs><mask id="perf"><rect x="-13" y="-16" width="26" height="32" fill="#fff"/><g fill="#000">${holes}</g></mask></defs>
  <g mask="url(#perf)"><rect x="${-hw + 0.5}" y="${-hh + 0.7}" width="${hw * 2}" height="${hh * 2}" fill="${dark ? 'rgba(0,0,0,.4)' : 'rgba(43,44,50,.07)'}"/><rect x="${-hw}" y="${-hh}" width="${hw * 2}" height="${hh * 2}" fill="${face}"/></g>
  <rect x="-8" y="-11" width="16" height="22" fill="none" stroke="var(--fg3)" stroke-width=".35"/>${FINE ? '<rect x="-9.1" y="-12.1" width="18.2" height="24.2" fill="none" stroke="var(--fg3)" stroke-width=".22" opacity=".8"/><path d="M-8-13.2h2M6-13.2h2M-8 13.2h2M6 13.2h2" stroke="var(--fg3)" stroke-width=".2"/>' : ''}
  <g transform="translate(0 -1.5)"><circle r="4.6" fill="none" stroke="${inkBlue()}" stroke-width=".45"/><path d="${litD(4.6, 0.72)}" fill="${inkBlue()}"/></g>
  <line x1="-4" y1="7.6" x2="4" y2="7.6" stroke="var(--fg3)" stroke-width=".35"/>`;
}

/* ---------- 背景：纸面、旧渍、信纸三折留下的两道折痕 ---------- */
function drawDeco() {
  const g = fitCanvas(deco, W, H);
  g.fillStyle = dark ? C.INK : C.PAPER; g.fillRect(0, 0, W, H);
  spots(g, W, H, 77, dark ? 'rgba(241,238,230,0.12)' : 'rgba(84,84,88,0.18)');
  [0.355, 0.69].forEach((f, i) => {
    const y = Math.round(H * f) + 0.5, gr = (c0) => { const l = g.createLinearGradient(0, 0, W, 0); l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(0.08, c0); l.addColorStop(0.92, c0); l.addColorStop(1, 'rgba(0,0,0,0)'); return l; };
    g.lineWidth = 1; g.strokeStyle = gr(dark ? 'rgba(0,0,0,0.42)' : 'rgba(60,58,52,0.055)'); g.beginPath(); g.moveTo(0, y + 0.8); g.lineTo(W, y + 0.8 + (i ? -0.6 : 0.4)); g.stroke();
    g.strokeStyle = gr(dark ? 'rgba(241,238,230,0.035)' : 'rgba(255,253,246,0.42)'); g.beginPath(); g.moveTo(0, y - 0.4); g.lineTo(W, y - 0.4 + (i ? -0.6 : 0.4)); g.stroke();
  });
}

/* ---------- 头像：眼睛里的瞳孔。一圈细线套着圆头像，外面是上下眼睑，隔一阵眨一下 ----------
   头像先看本机存着的头像（Nyx 个人信息页存在 localStorage 的 nyx_avatar{后缀}，后缀跟着跟谁聊走；只认 data: 图和本站路径）；
   没有就用 canvas 画的占位：暖褐底、白衬衫、黑短发，口袋里一支蓝笔。 */
function avatarURL(suf) {
  try { const v = localStorage.getItem('nyx_avatar' + (suf == null ? '' : suf)); if (v && (/^data:image\//.test(v) || /^\/(?!\/)/.test(v))) return v; } catch (e) {}
  const S = 144, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), u = S / 36;
  g.scale(u, u);
  g.fillStyle = '#8b6a50'; g.fillRect(0, 0, 36, 36);   // 暖褐底
  g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(5, 36); g.quadraticCurveTo(6, 25, 18, 24.5); g.quadraticCurveTo(30, 25, 31, 36); g.closePath(); g.fill();   // 白衬衫
  g.fillStyle = '#8b6a50'; g.beginPath(); g.moveTo(15.4, 24.6); g.lineTo(18, 29); g.lineTo(20.6, 24.6); g.closePath(); g.fill();   // 领口
  g.fillStyle = '#ead8c3'; g.beginPath(); g.ellipse(18, 16.5, 5.6, 6.6, 0, 0, TAU); g.fill(); g.fillRect(16.2, 21, 3.6, 4);   // 脸、脖子
  g.fillStyle = '#17171b'; g.beginPath(); g.moveTo(12.2, 17); g.quadraticCurveTo(11.4, 8.6, 18.4, 9.2); g.quadraticCurveTo(24.8, 9.4, 23.9, 16.6); g.quadraticCurveTo(21.5, 12.6, 16.5, 13.4); g.quadraticCurveTo(13.8, 13.8, 12.2, 17); g.fill();   // 黑短发
  g.fillStyle = C.BLUE; g.fillRect(24.2, 28, 0.9, 4);   // 口袋里的笔
  return cv.toDataURL('image/png');
}
let AV = LIVE ? null : avatarURL();
let eyeBuilt = null;
function drawEye(o) {   // o：睁开多少
  if (!AV) AV = avatarURL(SUFX);
  const col = dark ? C.PAPER : C.INK, key = dark ? 'd' : 'l';
  if (eyeBuilt !== key) {
    eye.innerHTML = `<defs><clipPath id="al"><path class="lid"/></clipPath><clipPath id="ac"><circle r="18"/></clipPath></defs>
    <g clip-path="url(#al)"><image href="${AV}" x="-18" y="-18" width="36" height="36" clip-path="url(#ac)" preserveAspectRatio="xMidYMid slice"/>
    <circle r="19.6" fill="none" stroke="${col}" stroke-width=".55" opacity=".75"/>${FINE ? `<g stroke="${col}" stroke-width=".3" opacity=".55" fill="none">${fineEyeStatic()}</g>` : ''}</g>${FINE ? `<path class="lash" fill="none" stroke="${col}" stroke-width=".35" stroke-linecap="round" opacity=".85"/>` : ''}
    <path class="up" fill="none" stroke="${col}" stroke-width="1" stroke-linecap="round"/>
    <path class="dn" fill="none" stroke="${col}" stroke-width=".5" stroke-linecap="round" opacity=".8"/>`;
    eyeBuilt = key;
  }
  const h = 22.4 * o + 0.4, W2 = 31;
  eye.querySelector('.lid').setAttribute('d', `M${-W2},0 Q0,${-h * 2} ${W2},0 Q0,${h * 2} ${-W2},0 Z`);
  eye.querySelector('.up').setAttribute('d', `M${-W2},0 Q0,${-h * 2} ${W2},0`);
  eye.querySelector('.dn').setAttribute('d', `M${-W2},0 Q0,${h * 2} ${W2},0`);
  if (FINE) { const ls = eye.querySelector('.lash'); if (ls) ls.setAttribute('d', o > 0.25 ? fineLashes(h, W2) : ''); }   // 睫毛跟着眨，快合上时先藏起来
}
function blink() { if (REDUCED) return; const t0 = performance.now(), D = 260; const tick = now => { const p = clamp((now - t0) / D, 0, 1), o = 1 - Math.sin(PI * p) * 0.94; drawEye(o); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
function openEye() { if (REDUCED) { drawEye(1); return; } drawEye(0); const t0 = performance.now() + 380, D = 560; const tick = now => { const p = clamp((now - t0) / D, 0, 1); drawEye(smoother(p)); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }

/* ---------- 输入线上的两个细线小图标：回形针、一张小脸；v26 顶栏三个细线入口：工程板、联系人、通话 ---------- */
function drawIcons() {
  $('clip').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13"/></svg>';
  $('emo').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14"/><path d="M9 14.2c1.6 1.4 4.4 1.4 6 0"/><path d="M9.6 10h.01M14.4 10h.01"/></svg>';
}
/* ?fine=1：页眉四个图标换成跟邮票图标同一种刻法的迷你版：细线、尖角平头，每个里头一小块实心 */
const TOOLS_FINE = {
  board: '<rect x="4.5" y="5" width="15" height="14"/><path class="fb" d="M4.5 5H9.5V10H4.5Z"/><path d="M9.5 5v14"/><path d="M14.5 5v14"/><path d="M11.3 9h1.4M11.3 12h1.4M16.2 9h1.4"/>',
  people: '<circle class="fb" cx="9" cy="9.5" r="2.6"/><path d="M4.5 18c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4"/><circle cx="16" cy="8.5" r="2"/><path d="M15 13.2c2-.2 3.6 1 4.2 3.3"/>',
  call: '<path d="M7.2 4.8l2.3 2.6-1.4 2.3c.9 1.9 2.3 3.3 4.2 4.2l2.3-1.4 2.6 2.3-1.5 2.4c-4.9-.4-8.8-4.3-9.2-9.2Z"/><path class="fb" d="M14.6 13.1l2.6 2.3-1.5 2.4c-.9-.1-1.8-.3-2.6-.6l1.5-2.1Z"/>',
  mask: '<path d="M4.5 9.5 15.5 5l4 9.5-11 4.5Z"/><path class="fb" d="M10.8 9.9l3.2-1.3 1.8 4.3-3.2 1.3Z"/><path d="M7.6 11.2l1.8 4.3"/>'
};
const TOOLS_SVG = {
  board: '<rect x="4.5" y="5" width="15" height="14"/><path d="M9.5 5v14M14.5 5v14"/><path d="M6.4 9h1.4M11.3 9h1.4M11.3 12h1.4M16.2 9h1.4"/>',
  people: '<circle cx="9" cy="9.5" r="2.6"/><path d="M4.5 18c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4"/><circle cx="16" cy="8.5" r="2"/><path d="M15 13.2c2-.2 3.6 1 4.2 3.3"/>',
  call: '<path d="M7.2 4.8l2.3 2.6-1.4 2.3c.9 1.9 2.3 3.3 4.2 4.2l2.3-1.4 2.6 2.3-1.5 2.4c-4.9-.4-8.8-4.3-9.2-9.2Z"/>',
  mask: '<path d="M4.5 9.5 15.5 5l4 9.5-11 4.5Z"/><path d="M7.6 11.2l1.8 4.3M10.8 9.9l1.8 4.3M14 8.6l1.8 4.3"/>',
  note: '<path d="M9.5 17V6.5l9-2V15"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="15" r="2"/>'
};
function buildTools() {
  const tl = document.createElement('nav'); tl.id = 'tools'; tl.setAttribute('aria-label', '入口');
  tl.innerHTML = [['people', '联系人'], ['call', '通话']].map(   // 工程板（邮票里有）和打码收掉入口，打码代码还在
    ([k, n]) => `<button data-k="${k}" aria-label="${n}" title="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${(FINE && TOOLS_FINE[k]) || TOOLS_SVG[k]}</svg></button>`).join('');
  tl.addEventListener('click', ev => {   // v28：联系人就地展开、通话本页打、打码本页开；工程板仍跳 Nyx（本站那版，祂主页也是这么接的）
    const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation();
    if (!LIVE) { toast('演示里不跳'); return; }
    const k = b.dataset.k;
    if (k === 'board') location.href = 'board.html';
    else if (k === 'people') location.href = 'people-go.html';
    else if (k === 'call') dial();
    else if (k === 'mask') toggleMask();
  });
  $('content').appendChild(tl);
}

/* ---------- 11/12 邮票（第四版）：点线脚的月相节点，从线脚往上长出一行四枚正方形邮票：仪表 / 心脏 / 工程板 / 口袋。
   齿孔边、两道细线内框；每枚只有居中的小粗中文、垫在它底下的淡英文、一个面值小字；底下横贯一张星图，笔触照搬主页 hand()/hatch()。
   中间一个实心蓝的简笔图标，细节用纸色反白刻出来（第五版；第四版那套斜负片窗已删）。
   仪表那枚点了收起邮票、原地展开现成的仪表；另外三枚跳 Nyx / 本站（样稿和本机只提示不跳）。点别处收回。 ---------- */
const TIX = [
  { k: 'gauge', zh: '仪表', en: 'GAUGE', no: '00' },
  { k: 'heart', zh: '心脏', en: 'HEART', no: '01', href: 'heart.html' },
  { k: 'board', zh: '工程板', en: 'BOARD', no: '02', href: 'board.html' },
  { k: 'pocket', zh: '口袋', en: 'POCKET', no: '03', href: 'pocket.html' }
];
const NOJUMP = !LIVE;   // ?demo=1：点邮票只说一句，不跳
let tixOn = false, tixBuilt = '';
const f2 = n => (Math.round(n * 100) / 100).toString();
function tixFrame(x, y, w, h, r) {   // 四角内凹的框
  return `M${f2(x + r)} ${f2(y)}H${f2(x + w - r)}A${r} ${r} 0 0 0 ${f2(x + w)} ${f2(y + r)}V${f2(y + h - r)}A${r} ${r} 0 0 0 ${f2(x + w - r)} ${f2(y + h)}H${f2(x + r)}A${r} ${r} 0 0 0 ${f2(x)} ${f2(y + h - r)}V${f2(y + r)}A${r} ${r} 0 0 0 ${f2(x + r)} ${f2(y)}Z`;
}

/* ---------- 铅笔：照搬主页 main.js 的 hand() / hatch()（画签绘建筑那套），参数一个没改，只把主页的单位 U 换成邮票上的 PU。
   每条线两三遍略抖的笔触叠成，端头出头，粗细浓淡跟着压力走；后几遍只描一截。切成小段 {p,w,a} 存起来再一起画。 ---------- */
const PU = 0.5;
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
function hatchP(poly, deg, gap, o) {   // 排线：一组平行的短笔，两头参差（主页 hatch()）
  const t = deg * PI / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx; let mn = 1e9, mx = -1e9;
  for (const p of poly) { const d = p[0] * nx + p[1] * ny; if (d < mn) mn = d; if (d > mx) mx = d; }
  for (let d = mn + gap * PU * (0.3 + SKR() * 0.5); d < mx; d += gap * PU * (0.72 + SKR() * 0.56)) {
    const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if ((da < 0) !== (db < 0)) { const f = da / (da - db); xs.push((a[0] + (b[0] - a[0]) * f) * dx + (a[1] + (b[1] - a[1]) * f) * dy); } }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const l = xs[i + 1] - xs[i]; if (l < 1.6 * PU) continue; const a = xs[i] + l * SKR() * 0.14, b = xs[i + 1] - l * SKR() * 0.14; hand([[nx * d + dx * a, ny * d + dy * a], [nx * d + dx * b, ny * d + dy * b]], o); }
  }
}
// 主页 buildSketch 里的几套笔：CL 辅助线、CL2 更淡的辅助线、OL 轮廓、OLs 细轮廓、HT 排线
const CL = { w: 0.42, a: 0.2, n: 1, j: 0.5, ov: 9 }, CL2 = { w: 0.42, a: 0.16, n: 1, j: 0.5, ov: 6 }, OL = { w: 0.7, a: 0.46, n: 2, j: 0.7, ov: 3 }, OLs = { w: 0.58, a: 0.38, n: 2, j: 0.45, ov: 1.6 }, HT = { w: 0.5, a: 0.3, n: 1, j: 0.25, ov: 1.4 };
const pen = (o, x) => Object.assign({}, o, x);
const arcPts = (cx, cy, a, b, rot, t0, t1) => { const n = Math.max(6, Math.ceil(Math.abs(t1 - t0) * Math.max(a, b) / 2.5)), cr = Math.cos(rot), sr = Math.sin(rot), out = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = Math.cos(t) * a, y = Math.sin(t) * b; out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return out; };

/* 星图：宽视野的一片天区，横贯四枚邮票。左下一颗小的带环行星和几颗卫星，右上一颗远恒星；一条斜贯的密星带，其余稀，右下几乎空；
   星座折线、远处圆心的大轨道弧（只露几段）、一片赤经赤纬网、一条长航线（拐点一粒蓝）、比例尺、指北、上沿一小段赤经刻度。
   线全走 hand()；KEEP 是字和蓝块周围让开的方框，星点落进去不画。 */
function tixSky(g, W0, H0, Rn, KEEP, col) {
  SKR = rng(20261112); SKU = [];
  const free = (x, y) => !KEEP.some(k => x > k[0] && x < k[2] && y > k[1] && y < k[3]);
  const lbs = [], blue = [];
  // 远处圆心的大轨道弧：一段一段
  [[-W0 * 0.7, H0 * 4.2, W0 * 1.42], [W0 * 1.9, -H0 * 3.2, W0 * 1.3], [W0 * 0.25, H0 * 6.5, H0 * 5.9]].forEach(([cx, cy, R], k) => {
    const a0 = Math.atan2(-cy, -cx - 30), a1 = Math.atan2(H0 - cy, W0 + 30 - cx), lo = Math.min(a0, a1) - 0.2, hi = Math.max(a0, a1) + 0.2;
    for (let a = lo; a < hi;) { const len = 0.03 + Rn() * 0.1; if (Rn() > 0.3) hand(arcPts(cx, cy, R, R, 0, a, Math.min(hi, a + len)), pen(CL2, { c: 1, a: 0.22 })); a += len + 0.01 + Rn() * 0.05; }
  });
  // 赤经赤纬网：极点在很远的上方
  const px = W0 * 0.6, py = -H0 * 2.6;
  for (let k = 0; k < 4; k++) { const R = H0 * 2.75 + k * H0 * 0.22; hand(arcPts(px, py, R, R, 0, PI / 2 + 0.16, PI / 2 - 0.06), pen(CL2, { a: 0.14 })); }
  for (let k = 0; k < 6; k++) { const a = PI / 2 + 0.16 - k * 0.044; hand([[px + Math.cos(a) * H0 * 2.75, py + Math.sin(a) * H0 * 2.75], [px + Math.cos(a) * H0 * 3.5, py + Math.sin(a) * H0 * 3.5]], pen(CL2, { a: 0.14 })); }
  lbs.push(['+15°', px + Math.cos(PI / 2 - 0.07) * H0 * 2.75 + 1, py + Math.sin(PI / 2 - 0.07) * H0 * 2.75 + 2]);
  // 星点：底下稀的一层 + 一条斜贯的密带；越往右下越空
  const band = (x, y) => { const d = (y - (H0 * 1.05 - x * 0.36)) / (H0 * 0.11); return Math.exp(-d * d); };
  const stars = [];
  for (let i = 0; i < 2600; i++) {
    const x = Rn() * W0, y = Rn() * H0, emp = Math.max(0, x / W0 - 0.6) * Math.max(0, y / H0 - 0.3) * 3;
    const p = 0.012 + band(x, y) * 0.32 - emp * 0.012; if (Rn() > p || !free(x, y)) continue;
    const m = Rn(); stars.push([x, y, m < 0.05 ? 0.55 : m < 0.25 ? 0.36 : 0.22, m < 0.02]);
  }
  // 星座：亮一点的星连成折线，旁边编号
  [[[0.33, 0.22], [0.37, 0.12], [0.43, 0.18], [0.46, 0.09]], [[0.69, 0.66], [0.73, 0.55], [0.78, 0.6]]].forEach((c, i) => {
    const P = c.map(([u, v]) => [u * W0, v * H0]);
    hand(P, pen(HT, { a: 0.24 })); P.forEach(p => stars.push([p[0], p[1], 0.55, false, 1]));
    lbs.push([['κ-7', 'HD 4127'][i], P[P.length - 1][0] + 1.6, P[P.length - 1][1] + 0.8]);
  });
  const u = H0, ball = (x, y, r, deg, o) => { hand(arcPts(x, y, r, r, 0, 0, TAU), pen(OLs, Object.assign({ a: 0.46, ov: 0.6 }, o || {}))); hatchP(arcPts(x, y, r, r, 0, PI * 0.2, PI * 1.2), deg, 1.4, pen(HT, { ov: 0.4 })); };
  // ① 第一枚左下角：带环行星，被框裁掉一点；暗面排线两层、环带、没擦干净的辅助线、两颗卫星
  const gx = u * 0.22, gy = u * 0.84, gr = u * 0.15, rot = -0.36;
  hand(arcPts(gx, gy, gr, gr, 0, 0, TAU), pen(OLs, { a: 0.5 }));
  hatchP(arcPts(gx, gy, gr, gr, 0, PI * 0.15, PI * 1.15).concat(arcPts(gx + gr * 0.25, gy - gr * 0.1, gr * 0.75, gr, 0, PI * 1.15, PI * 0.15)), -38, 2.2, HT);
  hatchP(arcPts(gx, gy, gr, gr, 0, PI * 0.45, PI * 1.0).concat([[gx, gy]]), 24, 2.6, pen(HT, { a: 0.22 }));
  hand(arcPts(gx, gy, gr * 1.85, gr * 0.42, rot, -0.12, PI + 0.12), pen(OLs, { a: 0.4 }));
  hand(arcPts(gx, gy, gr * 2.08, gr * 0.5, rot, -0.05, PI + 0.05), pen(OLs, { a: 0.28, n: 1 }));
  hand([[gx - gr * 2.4, gy + gr * 0.9], [gx + gr * 2.6, gy - gr * 0.95]], CL);
  hand(arcPts(gx, gy, gr * 1.3, gr * 1.3, 0, -1.9, -0.5), CL);
  ball(gx + gr * 2.3, gy - gr * 1.5, 1.2, -38); ball(gx - gr * 0.4, gy - gr * 2.1, 0.9, -38);
  hand(arcPts(gx + 1, gy - 0.5, gr * 3, gr * 1.3, -0.24, -2.6, 0.2), pen(CL2, { c: 1, a: 0.2 }));
  lbs.push(['R 6', gx + gr + 1.2, gy - gr * 0.2]);
  // ② 第二枚：左上一对双星，各带小轨道圈、过质心的连线；右边一条短排线和点簇堆的尘带
  const b0x = u * 1.2, b0y = u * 0.2;
  ball(b0x - 3.2, b0y + 0.8, 2.2, -38); ball(b0x + 4.2, b0y - 1, 1.5, 30);
  hand(arcPts(b0x, b0y, 3.4, 1.6, -0.24, 0, TAU), pen(CL2, { c: 1, a: 0.26, n: 2 })); hand(arcPts(b0x, b0y, 5.4, 2.4, -0.24, 0.3, TAU - 0.6), pen(CL2, { c: 1, a: 0.2 }));
  hand([[b0x - 7, b0y + 1.9], [b0x + 7.5, b0y - 1.8]], pen(CL, { a: 0.22 })); hand([[b0x - 0.7, b0y], [b0x + 0.7, b0y]], pen(HT, { ov: 0.2 })); hand([[b0x, b0y - 0.7], [b0x, b0y + 0.7]], pen(HT, { ov: 0.2 }));
  lbs.push(['P 3.2d', b0x - 6, b0y + 6]);
  const nbx = u * 1.84, nby = u * 0.62, neb = [];
  for (let k = 0; k < 14; k++) { const t = k / 14 * TAU, rr = 1 + 0.35 * Math.sin(t * 3 + 1) + 0.2 * Rn(); neb.push([nbx + Math.cos(t) * u * 0.06 * rr, nby + Math.sin(t) * u * 0.17 * rr]); }
  hatchP(neb, 62, 1.6, pen(HT, { a: 0.26 })); hatchP(neb.map(([x, y]) => [nbx + (x - nbx) * 0.6, nby + (y - nby) * 0.6]), -20, 1.5, pen(HT, { a: 0.24 }));
  for (let k = 0; k < 40; k++) { const t = Rn() * TAU, rr = Math.sqrt(Rn()); stars.push([nbx + Math.cos(t) * u * 0.07 * rr, nby + Math.sin(t) * u * 0.19 * rr, 0.2 + Rn() * 0.15]); }
  lbs.push(['NGC 412', nbx - 7, nby + u * 0.24]);
  // ③ 第三枚：右上一个画了经纬线的小天球；左下一颗拖尾的彗星，尾迹往左下散开
  const sgx = u * 2.83, sgy = u * 0.19, sgr = u * 0.1;
  hand(arcPts(sgx, sgy, sgr, sgr, 0, 0, TAU), pen(OLs, { a: 0.48 }));
  [0.35, 0.7].forEach(f => hand(arcPts(sgx, sgy, sgr * f, sgr, 0, -PI / 2, PI / 2), pen(HT, { a: 0.3 })));
  hand([[sgx, sgy - sgr], [sgx, sgy + sgr]], pen(HT, { a: 0.3 }));
  [-0.5, 0, 0.5].forEach(f => hand(arcPts(sgx, sgy + sgr * f, sgr * Math.sqrt(1 - f * f), sgr * 0.25, 0, 0, PI), pen(HT, { a: 0.28 })));
  hatchP(arcPts(sgx, sgy, sgr, sgr, 0, PI * 0.25, PI * 1.05), -38, 1.8, pen(HT, { a: 0.22 }));
  hand(arcPts(sgx, sgy, sgr * 1.5, sgr * 1.5, 0, -2.4, 0.4), pen(CL, { a: 0.2 })); lbs.push(['δ +23', sgx - sgr - 7, sgy + sgr + 3.2]);
  const cmx = u * 2.3, cmy = u * 0.8;
  ball(cmx, cmy, 1.3, -38, { a: 0.6 });
  for (let k = 0; k < 9; k++) { const a = PI * 0.82 + (k - 4) * 0.055 + (Rn() - 0.5) * 0.02, L = u * (0.18 + Rn() * 0.12); hand([[cmx - 1, cmy + 0.4], [cmx + Math.cos(a) * L, cmy + Math.sin(a) * L * 0.55]], pen(HT, { a: 0.28 + (k % 3 ? 0 : 0.12), ov: 0.3 })); }
  hand(arcPts(cmx + u * 0.9, cmy - u * 0.6, u * 1.05, u * 0.66, -0.12, 2.45, 2.75), pen(CL2, { c: 1, a: 0.22 }));
  lbs.push(['C/11', cmx + 2.4, cmy - 1.6]);
  // ④ 第四枚：右上一颗太阳（日冕短线、测角弧和刻度），左下一段六分仪弧
  const sx = u * 3.84, sy = u * 0.2, sr = 2.8;
  hand(arcPts(sx, sy, sr, sr, 0, 0, TAU), pen(OLs, { a: 0.55 })); hatchP(arcPts(sx, sy, sr, sr, 0, PI * 0.35, PI * 1.25), -38, 1.3, pen(HT, { ov: 0.3 }));
  for (let k = 0; k < 36; k++) { const a = k / 36 * TAU, r0 = sr + 0.9, r1 = r0 + (k % 9 === 0 ? 4.4 : k % 3 === 0 ? 2.4 : 1 + Rn() * 0.9); hand([[sx + Math.cos(a) * r0, sy + Math.sin(a) * r0], [sx + Math.cos(a) * r1, sy + Math.sin(a) * r1]], pen(HT, { ov: 0.2, a: 0.3 })); }
  hand(arcPts(sx, sy, 10.5, 10.5, 0, 1.75, 3.5), pen(CL, { c: 1, a: 0.26 }));
  for (let k = 0; k <= 10; k++) { const a = 1.75 + k * 0.175, r0 = 10.5, r1 = r0 + (k % 5 ? 0.9 : 1.8); hand([[sx + Math.cos(a) * r0, sy + Math.sin(a) * r0], [sx + Math.cos(a) * r1, sy + Math.sin(a) * r1]], pen(HT, { c: 1, ov: 0.1, a: 0.3, n: 1 })); }
  lbs.push(['G2 · 4.2 ly', sx - 16, sy + 13]);
  const xx = u * 3.14, xy = u * 0.92, xr = u * 0.2;
  hand(arcPts(xx, xy, xr, xr, 0, -1.45, -0.42), pen(OLs, { c: 1, a: 0.42 }));
  for (let k = 0; k <= 12; k++) { const a = -1.45 + k * (1.03 / 12), r1 = xr - (k % 4 ? 0.9 : 1.8); hand([[xx + Math.cos(a) * xr, xy + Math.sin(a) * xr], [xx + Math.cos(a) * r1, xy + Math.sin(a) * r1]], pen(HT, { c: 1, ov: 0.1, a: 0.32, n: 1 })); }
  hand([[xx, xy], [xx + Math.cos(-1.45) * xr, xy + Math.sin(-1.45) * xr]], pen(HT, { c: 1, a: 0.3 })); hand([[xx, xy], [xx + Math.cos(-0.42) * xr, xy + Math.sin(-0.42) * xr]], pen(HT, { c: 1, a: 0.3 }));
  hand([[xx, xy], [xx + Math.cos(-0.95) * xr * 1.05, xy + Math.sin(-0.95) * xr * 1.05]], pen(HT, { a: 0.4 }));
  lbs.push(['60°', xx + 2, xy - xr * 0.35]);
  // 长航线：把四个主体串起来，一段一段画；拐点落在主体旁边，一粒蓝
  const pts = [[gx + gr * 0.7, gy - gr * 0.8], [b0x + 1, b0y + 6.5], [nbx - 3.5, nby - 6], [sgx - sgr - 2.5, sgy + 3.5], [sx - sr - 6, sy + 2]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < L; s += 4.2) { const e = Math.min(L, s + 2.6), u0 = s / L, u1 = e / L; hand([[a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1]], pen(HT, { c: 1, a: 0.36, ov: 0.3 })); }
  }
  pts.slice(1, -1).forEach(([x, y], i) => { blue.push([x, y]); hand(arcPts(x, y, 2, 2, 0, 0.4, TAU - 0.2), pen(HT, { a: 0.24, ov: 0.3 })); lbs.push([['WP1', 'WP2 Δv .42', 'WP3'][i], x + 2.4, y + 3.8]); });
  // 比例尺、指北、上沿一小段赤经刻度
  const bx = H0 * 1.1, by = H0 - 6.5;
  hand([[bx, by], [bx + 24, by]], pen(HT, { c: 1, a: 0.32 })); for (let k = 0; k <= 4; k++) hand([[bx + k * 6, by], [bx + k * 6, by - (k % 2 ? 1 : 2)]], pen(HT, { c: 1, a: 0.32, ov: 0.2 }));
  lbs.push(['0', bx - 0.5, by + 2.8], ['2 AU', bx + 21, by + 2.8]);
  const nx = H0 * 0.16, ny = H0 * 0.24;
  hand([[nx, ny + 3.5], [nx, ny - 3.5]], pen(HT, { c: 1, a: 0.32, ov: 0.3 })); hand([[nx - 1, ny - 1.8], [nx, ny - 3.5], [nx + 1, ny - 1.8]], pen(HT, { c: 1, a: 0.32, ov: 0.2 }));
  lbs.push(['N', nx - 0.8, ny - 4.5]);
  const ex0 = W0 * 0.37, ex1 = W0 * 0.55;
  for (let x = ex0, k = 0; x <= ex1; x += 2.2, k++) hand([[x, 1.2], [x, 1.2 + (k % 5 ? 0.9 : 2)]], pen(HT, { c: 1, a: 0.3, ov: 0.15, n: 1 }));
  lbs.push(['02h 40m', ex0, 5.4]);
  // 手画的小圈注
  const hx = H0 * 3.13, hy = H0 * 0.5; stars.push([hx, hy, 0.5, false, 1]);
  hand(arcPts(hx, hy, 3.6, 2.6, -0.3, 0, TAU + 0.6), pen(HT, { a: 0.36 })); hand([[hx + 3.2, hy + 2], [hx + 7, hy + 4.6]], pen(HT, { a: 0.3 }));
  lbs.push(['? var.', hx + 7.4, hy + 6.6]);

  // 画：先笔触，再星点，再拐点的蓝，最后小字
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const un of SKU) { g.strokeStyle = un.c ? col.ink : col.pen; g.globalAlpha = un.a; g.lineWidth = un.w; g.beginPath(); const p = un.p; g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); }
  g.globalAlpha = 0.75; g.fillStyle = col.pen; g.beginPath();
  for (const [x, y, r, cr, br] of stars) { if (br) continue; if (cr) { g.rect(x - 1.3, y - 0.12, 2.6, 0.24); g.rect(x - 0.12, y - 1.3, 0.24, 2.6); } else { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } }
  g.fill(); g.globalAlpha = 0.9; g.fillStyle = col.ink; g.beginPath(); for (const [x, y, r, cr, br] of stars) if (br) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill();
  g.globalAlpha = 1; g.fillStyle = col.blue; g.beginPath(); for (const [x, y] of blue) { g.moveTo(x + 0.7, y); g.arc(x, y, 0.7, 0, TAU); } g.fill();
  g.globalAlpha = 0.7; g.fillStyle = col.pen; g.font = '2.4px ui-monospace, Menlo, monospace'; for (const [t, x, y] of lbs) g.fillText(t, x, y);
  g.globalAlpha = 1;
}
/* 每枚中间一个「双色」刻线图标（第七版：往钢版雕刻邮票的刻线走）：细蓝轮廓 + 一条分界线劈成两半，一半实心蓝、一半纸色空着；
   空的那半里三四根等距平行的细刻线当阴影；实心那半里的细节反白；分界线两头伸出外形，收一个小短划。线一律平头、尖角。坐标约 18px 见方 */
const TIXPT = Q.get('pt') !== '0';   // 分界处的细颗粒：默认开，?pt=0 关
/* 颗粒：沿分界线取点，往空的那半散出去，近密远稀（最远 3px 出头）；实心那半里掺几粒纸色飞白。base(t) 给分界线上 t∈[0,1] 处的点和指向空半边的法向 */
function tixDust(base, seed, id) {
  if (!TIXPT) return '';
  const Rn = rng(seed); let bl = '', wh = '';
  for (let i = 0; i < 18; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.25 + Rn() * Rn() * 3, r = 0.15 + Rn() * 0.2; bl += `<circle cx="${f2(x + nx * d)}" cy="${f2(y + ny * d)}" r="${f2(r)}"/>`; }
  for (let i = 0; i < 6; i++) { const [x, y, nx, ny] = base(Rn()), d = 0.5 + Rn() * 2, r = 0.15 + Rn() * 0.15; wh += `<circle cx="${f2(x - nx * d)}" cy="${f2(y - ny * d)}" r="${f2(r)}"/>`; }
  return `<g class="pt">${bl}</g><g class="ptw" clip-path="url(#${id}f)">${wh}</g>`;
}
const seg = (x0, y0, x1, y1, a, b) => t => { const u = a + (b - a) * t, L = Math.hypot(x1 - x0, y1 - y0); return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, (y1 - y0) / L, -(x1 - x0) / L]; };   // 法向朝线的「右手」那边
/* 第八版：实心蓝那半做成压进纸里的蓝箔。solid(cls) 给出「实心那块」的一个副本；box 是实心块里的东西（亮带、暗带、内凹边）要裁进去的那层 */
function tixFoil(solid, box, edges, rot) {
  const band = (o0, o1) => { const a = -35 * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, L = 16; return `M${f2(nx * o0 - ux * L)} ${f2(ny * o0 - uy * L)}L${f2(nx * o0 + ux * L)} ${f2(ny * o0 + uy * L)}L${f2(nx * o1 + ux * L)} ${f2(ny * o1 + uy * L)}L${f2(nx * o1 - ux * L)} ${f2(ny * o1 - uy * L)}Z`; };
  const bands = `<g${rot ? ` transform="${rot}"` : ''}><path class="fl" d="${band(-2.6, .6)}"/><path class="fl" d="${band(2.8, 3.5)}"/><path class="fd" d="${band(-5.2, -4.5)}"/><path class="fd" d="${band(.6, 1.1)}"/></g>`;
  return `<g class="fsh" transform="translate(.4 .45)">${solid('sh')}</g><g transform="translate(-.35 -.35)">${solid('hi')}</g>${solid('b')}${box(bands + `<path class="edge" d="${edges}"/>`)}`;
}
function tixIcon(k, id) {
  const hl = (deg, offs) => { const a = deg * PI / 180, ux = Math.cos(a), uy = Math.sin(a); return offs.map(o => `M${f2(-uy * o - ux * 14)} ${f2(ux * o - uy * 14)}L${f2(-uy * o + ux * 14)} ${f2(ux * o + uy * 14)}`).join(''); };
  const ser = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * 0.9, ny = (x1 - x0) / L * 0.9; return `M${f2(x0 - nx)} ${f2(y0 - ny)}L${f2(x0 + nx)} ${f2(y0 + ny)}M${f2(x1 - nx)} ${f2(y1 - ny)}L${f2(x1 + nx)} ${f2(y1 + ny)}`; };
  const two = (S, fillR, emptyR, divider, serif, det, hatch, moreL, dust, rot) => `<defs><clipPath id="${id}f"><path d="${fillR}"/></clipPath><clipPath id="${id}e"><path d="${emptyR}"/></clipPath><clipPath id="${id}s"><path d="${S}"/></clipPath></defs>
    ${tixFoil(cl => `<path class="${cl}" d="${S}" clip-path="url(#${id}f)"/>`, inner => `<g clip-path="url(#${id}s)"><g clip-path="url(#${id}f)">${inner}</g></g>`, S + divider, rot)}
    <g clip-path="url(#${id}s)"><g clip-path="url(#${id}e)"><path class="h" d="${hatch}"/></g></g>
    ${det ? `<g clip-path="url(#${id}e)"><path class="l" d="${det}"/></g><g clip-path="url(#${id}f)"><path class="w" d="${det}"/></g>` : ''}
    ${dust || ''}<path class="l" d="${S}"/>${moreL || ''}<path class="l" d="${divider}"/><path class="l" d="${serif}"/>`;
  if (k === 'gauge') {   // 月相：亮的一侧实心蓝（这一周还剩多少）；暗的一侧几根竖刻线；地平线穿过圆心、两头平头带短划
    const r = 7.2, k2 = clamp(GLEFT, 0, 1), lit = k2 > 0.005 ? litD(r, k2) : 'M0 0Z', circ = `M${r} 0A${r} ${r} 0 1 1 ${-r} 0A${r} ${r} 0 1 1 ${r} 0Z`;
    return `<defs><clipPath id="${id}f"><path d="${lit}"/></clipPath><clipPath id="${id}d"><path clip-rule="evenodd" d="${circ}${lit}"/></clipPath></defs>${tixFoil(cl => `<path class="${cl}" d="${lit}"/>`, inner => `<g clip-path="url(#${id}f)">${inner}</g>`, lit)}
      <g clip-path="url(#${id}d)"><path class="h" d="${hl(90, [-5.4, -3.6, -1.8])}"/></g>
      ${tixDust(t => { const y = (t * 2 - 1) * r * 0.92, x = -(2 * k2 - 1) * Math.sqrt(r * r - y * y); return [x, y, -1, 0]; }, 71, id)}
      <path class="l" d="M-11 .8L11-.8"/><g clip-path="url(#${id}f)"><path class="w" d="M-11 .8L11-.8"/></g><path class="l" d="${ser(-11, .8, 11, -.8)}"/><circle class="l" r="${r}"/>`;
  }
  if (k === 'heart') {   // 心电线以上实心，以下只有轮廓和几根斜刻线；肩是少弧近折线，凹口和底尖都是尖角，歪一点
    const S = 'M.5 8.6L-6.9.4-8.3-3.3-7.6-6.3-5-7.6-2.3-7.2-.2-4.8 1.3-7.2 4.1-8 7.1-7.1 8.3-4 7-.3Z', E = 'M-12.4-.6H-4.2L-3-3.4-1.7 1.1 0-2.8 1-.6H12.4';
    return two(S, E + 'V-20H-12.4Z', E + 'V20H-12.4Z', E, 'M-12.4-1.5V.3M12.4-1.5V.3', '', hl(-50, [-3.2, -1.4, .4, 2.2]), '', tixDust(t => [-7.4 + t * 14.6, -.6, 0, 1], 72, id));
  }
  if (k === 'board') {   // 硬直角的板，整体转 -3°；一条斜线劈开：左上实心（栏线和卡片反白），右下空着（蓝细线 + 刻线）
    const S = 'M-8.4-6.4H8.4V6.4H-8.4Z', D = 'M-12 5.6L12-5.2';
    const det = 'M-2.8-6.4V6.4M2.8-6.4V6.4M-7-4.4H-4.4V-2.4H-7ZM-1.4-1.6H1.4V.4H-1.4ZM4.4-4.4H7V-2.6H4.4ZM4.4 1.4H7V3.4H4.4Z';
    return `<g transform="rotate(-3)">${two(S, D + 'V-20H-12Z', D + 'V20H-12Z', D, ser(-12, 5.6, 12, -5.2), det, hl(-24, [4.2, 5.8, 7.4]), '', tixDust(t => { const [x, y, nx, ny] = seg(-12, 5.6, 12, -5.2, .15, .85)(t); return [x, y, -nx, -ny]; }, 73, id), 'rotate(3) translate(-2.6 -3.6)')}</g>`;   // 光带转回跟另外三枚同一个角度，挪进实心那半
  }
  // 口袋：尖底邮袋。袋口那道斜线是分界：以上是袋盖，只有轮廓和几根刻线，露出一角直角信纸；以下袋身实心，反白一道 V
  const S = 'M-7.4-5.4H7.4V3.4L0 8.8-7.4 3.4Z', D = 'M-10.6-2.2L10.8-3.6', V = 'M-4.8.6L0 4.4 4.8.6', card = 'M-4.6-5.4V-9.8H2.8V-5.4';
  return two(S, D + 'V20H-10.6Z', D + 'V-20H-10.6Z', D, ser(-10.6, -2.2, 10.8, -3.6), V, hl(0, [-4.6, -3.4]), `<path class="l" d="${card}" transform="rotate(-6 -.9 -5.4)"/><path class="h" d="M-3.4-8.4H1.8M-3.4-7.2H1.8" transform="rotate(-6 -.9 -5.4)"/>`, tixDust(t => { const [x, y, nx, ny] = seg(-10.6, -2.2, 10.8, -3.6, .16, .84)(t); return [x, y, nx, ny]; }, 74, id));
}
/* 一行四枚正方形邮票，连在一张上（齿孔边、张间撕线）；从线脚往上长出来，就在仪表展开的位置。
   每枚中间一个实心蓝的简笔图标，细节反白刻出来 */
function buildTix() {
  let el = $('tix');
  if (!el) {
    el = document.createElement('div'); el.id = 'tix'; el.hidden = true; el.setAttribute('role', 'group'); el.setAttribute('aria-label', '邮票');
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      const b = ev.target.closest('button[data-t]'); if (!b) return;
      const t = TIX.find(x => x.k === b.dataset.t); if (!t) return;
      if (t.k === 'gauge') { setTix(false, true); setGauge(true); return; }   // 仪表那枚：邮票收起，原地展开现成的仪表
      if (NOJUMP) { toast('样稿不跳 · 去' + t.zh); return; }
      location.href = t.href;
    });
    $('content').appendChild(el);
  }
  const n = TIX.length, s = Math.round(clamp((TX + COLW - LX - 24) / n * 0.85, 46, 62)), w = s * n, h = s, key = w + (dark ? 'd' : 'l') + Math.round(GLEFT * 100);
  if (tixBuilt === key) return el;
  tixBuilt = key;
  const pr = 1.15, step = 4.2; let holes = '';
  const nx = Math.round(w / step), ny = Math.round(h / step);
  for (let i = 0; i <= nx; i++) { const x = i * w / nx; holes += `<circle cx="${f2(x)}" cy="0" r="${pr}"/><circle cx="${f2(x)}" cy="${h}" r="${pr}"/>`; }
  for (let i = 0; i <= ny; i++) { const y = i * h / ny; holes += `<circle cx="0" cy="${f2(y)}" r="${pr}"/><circle cx="${w}" cy="${f2(y)}" r="${pr}"/>`; }
  let tear = '';
  for (let k = 1; k < n; k++) { const x = k * s; for (let i = 1; i < ny; i++) tear += `<circle cx="${f2(x)}" cy="${f2(i * h / ny)}" r=".45"/>`; }
  const fx = 3.6, ins = 1.6, rc = 2.8, KEEP = [];
  const stamps = TIX.map((t, i) => {
    const x0 = i * s, cx = x0 + s / 2, fw = s - fx * 2, ix0 = x0 + fx + ins, iw = fw - ins * 2, ty = s * 0.37, pcy = s * 0.67;
    KEEP.push([cx - 15, ty - 9, cx + 15, ty + 5], [cx - 11, pcy - 11, cx + 11, pcy + 11], [x0 + s - fx - 13, s - fx - 8, x0 + s - fx, s - fx]);
    return `<g class="stamp">
      <path class="fr" d="${tixFrame(x0 + fx, fx, fw, fw, rc)}"/><path class="fr2" d="${tixFrame(ix0, fx + ins, iw, iw, rc - 1)}"/>
      <text class="en" x="${f2(cx + 0.5)}" y="${f2(ty + 2.6)}" text-anchor="middle">${t.en}</text>
      <text class="zh" x="${f2(cx + 0.9)}" y="${f2(ty)}" text-anchor="middle">${t.zh}</text>
      <g class="ico" transform="translate(${f2(cx)} ${f2(pcy)})">${tixIcon(t.k, 'tki' + i)}</g>
      <text class="val" x="${f2(ix0 + iw - 2)}" y="${f2(fx + ins + iw - 2.4)}" text-anchor="end"><tspan class="u">N°</tspan>${t.no}</text>
    </g>`;
  }).join('');
  const FG = `<g class="tear">${tear}</g>${stamps}`;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  el.innerHTML = `<svg class="bg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs><mask id="tkperf"><rect x="-2" y="-2" width="${w + 4}" height="${h + 4}" fill="#fff"/><g fill="#000">${holes}</g></mask></defs><rect class="face" width="${w}" height="${h}" mask="url(#tkperf)"/></svg>
    <canvas class="sky" aria-hidden="true"></canvas>
    <svg class="fg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${FG}</svg>` +
    TIX.map((t, i) => `<button data-t="${t.k}" style="left:${f2(i * s)}px;width:${f2(s)}px" aria-label="${t.k === 'gauge' ? '打开仪表' : '去' + t.zh}"></button>`).join('');
  // 星图画在中间那层 canvas 上，裁进齿孔里面那一圈
  const inset = fx + ins;
  [['canvas.sky', dark ? { pen: '#9c9ca2', ink: C.PAPER, blue: inkBlue() } : { pen: C.PEN, ink: C.LINE, blue: inkBlue() }]].forEach(([sel, col]) => {
    const g = fitCanvas(el.querySelector(sel), w, h); g.save(); g.beginPath(); g.rect(inset, inset, w - inset * 2, h - inset * 2); g.clip(); tixSky(g, w, h, rng(1113), KEEP, col); g.restore();
  });
  return el;
}
function placeTix() {
  const el = $('tix'); if (!el || el.hidden) return;
  buildTix();
  el.style.left = (LX + 12) + 'px'; el.style.bottom = (H - LINE_Y + 46 + SAYX) + 'px'; el.style.top = '';   // 跟仪表一个位置：贴着测绘线，在输入线上面
}
function setTix(on, keepBody) {
  const el = buildTix();
  if (on === tixOn) return;
  tixOn = on; document.body.classList.toggle('tix-on', on); if (knotEl) knotEl.setAttribute('aria-expanded', on || gaugeOn ? 'true' : 'false');
  if (on) {
    if (gaugeOn) setGauge(false);
    if (typeof rosterOn !== 'undefined' && rosterOn) toggleRoster(false);
    closePeek(); $('tray').hidden = true;
    el.hidden = false; el.classList.remove('shut'); placeTix(); void el.offsetWidth; el.classList.add('open');
  } else {
    el.classList.remove('open');
    if (REDUCED || keepBody) { el.hidden = true; return; }
    el.classList.add('shut'); setTimeout(() => { if (!tixOn) { el.hidden = true; el.classList.remove('shut'); } }, 170);
  }
}
stage.addEventListener('click', ev => { if (tixOn && !ev.target.closest('#tix') && !ev.target.closest('#knot')) setTix(false); });   // 点别处收回（月相节点自己管开合）
document.addEventListener('keydown', ev => { if (tixOn && ev.key === 'Escape') setTix(false); });
/* ---------- 11/13 ?fine=1：页眉和线脚扎几小堆细活（正文那一栏一笔不加）。默认关，线上行为不变。
   笔触用上面那套 hand()（照搬主页 main.js 画签绘建筑那支笔），线都在 0.3–0.45。画在内容层最底下一张透明画布上，眼睛的睫毛和刻度另外写进眼睛的 svg（要跟着眨）。
   扎的几堆：① 眼睛：上睑一排短睫毛、虹膜外一圈径向细刻度、眼角一粒蓝、眼眶外两道没擦干净的铅笔弧；
   ② 测绘线顶端一个水准点（十字圈）和一行 6px 小注，线脚月相节点上方三道越来越密的短刻度；
   ③ 线脚：燕子脚下那截线手绘重描一遍，额度小字前一小段分度尺；④ 页面四角极淡的裁切标记。 ---------- */
const FINE = Q.get('fine') === '1';
if (FINE) document.body.classList.add('fine');
function fineUnits(g, units, col) { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; for (const un of units) { g.globalAlpha = un.a; g.lineWidth = un.w; g.beginPath(); const p = un.p; g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); } g.globalAlpha = 1; }
function drawFine() {
  if (!FINE) return;
  let cv = $('fine');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'fine'; cv.setAttribute('aria-hidden', 'true'); content.insertBefore(cv, content.firstChild); }
  const g = fitCanvas(cv, W, H), PEN = dark ? '#9c9ca2' : C.PEN, INK = dark ? C.PAPER : C.LINE, BL = inkBlue(), U1 = [], U2 = [];
  SKR = rng(1113 + Math.round(W));
  const arc = (cx, cy, rx, ry, a0, a1, rot) => arcPts(cx, cy, rx, ry, rot || 0, a0, a1);
  // ① 眼眶外两道没擦干净的铅笔辅助弧（眼睛中心 LX, EYE_Y；睑宽 31）
  hand(arc(LX, EYE_Y + 3, 37, 27, -2.75, -0.55), Object.assign({}, CL, { to: U1, a: 0.32 }));
  hand(arc(LX + 1, EYE_Y - 1, 41, 30, 0.35, 1.25), Object.assign({}, CL2, { to: U1, a: 0.28 }));
  hand([[LX - 40, EYE_Y + 1.5], [LX + 46, EYE_Y - 1.5]], Object.assign({}, CL2, { to: U1, a: 0.22 }));
  // ② 测绘线顶端：一个十字圈水准点，旁边一行 6px 小注
  const ty = EYE_Y + (document.body.classList.contains('pinned') ? 40 : 32);   // 群里有置顶时线头往下让了一点
  hand(arc(LX, ty, 2.6, 2.6, 0, TAU), Object.assign({}, OLs, { to: U2, a: 0.55, ov: 0.6 }));
  hand([[LX - 4.6, ty], [LX + 4.6, ty]], Object.assign({}, HT, { to: U2, a: 0.45, ov: 0.3 })); hand([[LX, ty - 4.6], [LX, ty + 4.6]], Object.assign({}, HT, { to: U2, a: 0.45, ov: 0.3 }));
  //   线脚：月相节点上方三道越来越密的短刻度
  [16, 10.5, 7, 5].forEach((d, i) => hand([[LX - 3.5 - i * 0.4, LINE_Y - d], [LX - 0.6, LINE_Y - d]], Object.assign({}, HT, { to: U2, a: 0.42, ov: 0.2, n: 1 })));
  // ③ 燕子脚下那截输入线：手绘再描一遍（只描一截，端头出头）
  const rx1 = TX + COLW, rx0 = rx1 - 46;
  hand([[rx0, LINE_Y + 0.6], [rx1 + 3, LINE_Y + 0.3]], Object.assign({}, OLs, { to: U1, a: 0.42 }));
  //   额度小字前一小段分度尺（#gline 在 LX+14）
  const gy = LINE_Y + 13;
  if (LIVE) hand([[LX + 3, gy], [LX + 11.5, gy]], Object.assign({}, HT, { to: U2, a: 0.42, ov: 0.2, n: 1 }));   // 演示里没有额度那行，尺子也不画
  if (LIVE) for (let k = 0; k <= 4; k++) hand([[LX + 3 + k * 2.1, gy], [LX + 3 + k * 2.1, gy - (k % 2 ? 1.2 : 2.2)]], Object.assign({}, HT, { to: U2, a: 0.42, ov: 0.1, n: 1 }));
  // ④ 四角裁切标记：很淡
  const m = 9, L = 7;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { hand([[x - sx * 2, y], [x + sx * L, y]], Object.assign({}, HT, { to: U1, a: 0.24, ov: 0.2, n: 1 })); hand([[x, y - sy * 2], [x, y + sy * L]], Object.assign({}, HT, { to: U1, a: 0.24, ov: 0.2, n: 1 })); });
  fineUnits(g, U1, PEN); fineUnits(g, U2, INK);
  // 小字和蓝点
  g.fillStyle = PEN; g.globalAlpha = 0.75; g.font = '6px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
  g.textAlign = 'right'; g.fillText('BM ' + (floor ? '1–' + floor : '0'), LX - 6, ty); g.textAlign = 'left'; g.globalAlpha = 1;   // 小注放在线左边那一栏，不压正文
  g.fillStyle = BL; g.beginPath(); g.arc(LX - 34, EYE_Y + 0.6, 0.9, 0, TAU); g.fill();   // 外眼角（左）一粒蓝，右眼角紧挨着名字，放那边像标点
}
/* 眼睛的细活：上睑一排长短不一的短睫毛（跟着眨），虹膜圈外一圈径向细刻度（被眼睑裁着） */
function fineEyeStatic() {
  if (!FINE) return '';
  let d = '';
  for (let k = 0; k < 72; k++) { const a = k / 72 * TAU, r0 = 20.4, r1 = r0 + (k % 6 === 0 ? 2 : 1); d += `M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0)}L${f2(Math.cos(a) * r1)} ${f2(Math.sin(a) * r1)}`; }
  return `<path class="ftick" d="${d}"/>`;
}
const LASH = (() => { const R = rng(77), a = []; for (let i = 0; i < 15; i++) a.push([0.14 + 0.72 * i / 14 + (R() - 0.5) * 0.02, 1 + R() * 1.6 + Math.sin(PI * i / 14) * 1.2, (R() - 0.5) * 0.25]); return a; })();
function fineLashes(h, W2) {   // h：此刻上睑的控制点高度；沿二次曲线取点，朝外法向长出去
  if (!FINE) return '';
  let d = '';
  for (const [t, len, tw] of LASH) {
    const x = (1 - t) * (1 - t) * -W2 + t * t * W2, y = 2 * (1 - t) * t * (-h * 2), dx = 2 * W2, dy = 2 * (1 - 2 * t) * (-h * 2), L = Math.hypot(dx, dy) || 1;
    let nx = dy / L, ny = -dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
    const c = Math.cos(tw), s = Math.sin(tw), ux = nx * c - ny * s, uy = nx * s + ny * c;
    d += `M${f2(x)} ${f2(y)}L${f2(x + ux * len)} ${f2(y + uy * len)}`;
  }
  return d;
}
/* ---------- v27 输入：多行信纸。随字长高，最多五行，再多在里面滚；线、月相节点、小图标、燕子都留在最底下一行，输入区往上长。
   回车：照 Nyx 判断，触屏（pointer: coarse）回车是换行、点燕子才发；有实体键盘的回车发、Shift+回车换行；输入法拼字时回车不发。
   草稿存 sessionStorage「ta-say:<跟谁聊>」，切后台、刷新都还在，发出去就清。 ---------- */
const LINE = 22, MAXL = 5;   // 11/13 正文 13.5 → 12.5px，输入行高 24 → 22
let SAYX = 0, composing = false;
const touchInput = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (touchInput) say.setAttribute('enterkeyhint', 'enter');
function grow(noScroll) {
  say.style.height = LINE + 'px';
  const h = Math.min(Math.max(LINE, say.scrollHeight), LINE * MAXL);
  say.style.height = h + 'px'; say.style.top = (-3 - h) + 'px'; say.classList.toggle('scroll', say.scrollHeight > LINE * MAXL + 1);
  const x = h - LINE;
  if (x !== SAYX) {
    const stick = nearBottom(); SAYX = x;
    if (LINE_Y) list.style.height = (LINE_Y - 30 - SAYX) + 'px';
    placeExtras(); if (stick && !noScroll) toBottom();
  }
}
const draftKey = () => 'ta-say:' + (LIVE ? RELAY : 'demo');
let saveT = 0;
function saveDraft() { clearTimeout(saveT); try { if (say.value) sessionStorage.setItem(draftKey(), say.value); else sessionStorage.removeItem(draftKey()); } catch (e) {} }
function loadDraft() { try { const v = sessionStorage.getItem(draftKey()); if (v && !say.value) { say.value = v; grow(); drawSend(); } } catch (e) {} }
function clearSay() { say.value = ''; saveDraft(); grow(); }

/* ---------- 发送键：停在最后一行线头上的小燕子；写了字它变蓝 ---------- */
let flying = false;
function drawSend() {
  const on = say.value.trim().length > 0 || ATT.length > 0 || flying, fill = on ? 'var(--blue)' : (dark ? C.PAPER : C.INK);
  send.innerHTML = `<svg viewBox="-20 -17 40 34" aria-hidden="true"><g class="b"><g class="perch" transform="translate(-1 12.4) scale(.112)"${flying ? ' style="display:none"' : ''}><path d="${PERCH}" fill="${fill}"/></g>
  <g class="fly" transform="translate(0 4) rotate(-16) scale(.15)"${flying ? '' : ' style="display:none"'}><path d="${birdD(0.18)}" fill="${fill}"/></g></g></svg>`;
}
function drawMenu() {
  const col = dark ? C.PAPER : C.INK;
  $('menu').innerHTML = `<svg viewBox="-20 -17 40 34" aria-hidden="true"><g transform="rotate(-14) scale(.135)"><path d="${birdD(0.18)}" fill="${col}"/></g><line x1="-15" y1="13" x2="9" y2="13" stroke="var(--fg3)" stroke-width=".5"/></svg>`;
}
function flyBird() {
  if (REDUCED || flying || !send.animate) return;
  flying = true; drawSend();
  const b = send.querySelector('.b');
  const a = b.animate([
    { transform: 'none', opacity: 1 },
    { transform: 'translate(30px,-34px) rotate(-14deg) scale(.86)', opacity: 0, offset: 0.46 },
    { transform: 'translate(-10px,6px) scale(.9)', opacity: 0, offset: 0.5 },
    { transform: 'none', opacity: 1 }
  ], { duration: 600, easing: 'cubic-bezier(.35,.1,.3,1)' });
  a.onfinish = () => { flying = false; drawSend(); };
}

/* ---------- 发出去：接在自己这段末尾，或另起一段；滚到底 ---------- */
function now2() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
let typT = 0;
function ensureToday() {
  const d = new Date(), today = pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()), days = rows.querySelectorAll('.day'), lastDay = days[days.length - 1];
  if (!lastDay || lastDay.dataset.d !== today) { const el = addDay(today, WK[d.getDay()], 17 + days.length * 31); el.classList.add('new'); placeDay(el); }
}
function post(text, o) {   // 样子稿（?demo=1）里的发送：只在本页
  ensureToday(); closePeek();
  if (quoting) { o = Object.assign({}, o, { q: quoting }); setQuote(null); }
  if (GROUP && text) o = Object.assign({ html: rich(text) }, o);
  addLine('i', now2(), text, o, true); drawSend();
  setStatus('idle'); clearTimeout(typT); typT = setTimeout(() => { setStatus('writing'); statusLoop(); }, 1400);   // 对方看见了，过一会儿开始写；状态行和底下三点一起变
  requestAnimationFrame(() => { list.scrollTo({ top: list.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' }); });
  flyBird();
}
function doSend() {
  if (LIVE) { sendLive(); return; }
  const v = say.value.trim(); if (!v) return; clearSay(); post(v);
}

/* ---------- v26 真发送：同 Nyx 的 send()。先落一句「发送中」，图先传（选图时就开始传），传完再 POST /app/send；
   参数 {text, side:"sun", quote?, attachments?}。暗面只是这页的外观，side 一律日面（R1）。失败的那句点一下重发。 ---------- */
const ATT = [];   // 输入线上方待发的附件 [{name, file, local, done, job, el}]
let pk = 0;
function sendLive(override) {
  const t = override != null ? override : say.value.trim(); if ((!t && !ATT.length) || !KEY) { if (!KEY) toast('还没登录'); return; }
  const items = ATT.splice(0); paintAtts();
  const q = quoting ? quoting[3] || { who: quoting[0], text: quoting[1] } : null;
  if (override == null) clearSay();
  setQuote(null); closePeek();
  const local = items.map(x => x.local ? { kind: 'image', name: x.name, local: x.local } : { kind: 'file', name: x.name });
  const e = { t: 'pend', key: 'p' + (++pk), state: 'sending', items, q, text: t, m: { id: '', from: 'human', text: t, ts: new Date().toISOString(), meta: Object.assign(q ? { quote: q } : {}, { attachments: local }) } };
  EPHS.push(e); redrawEph(e.key); toBottom(); drawSend(); flyBird();
  firePend(e);
}
function firePend(e) {
  const items = e.items;
  Promise.all(items.map(x => x.job || null)).then(() => {
    if (items.some(x => x.file && !x.done)) {   // 有图没传上去：整条先不发，点一下把没传上的再传一遍
      e.state = 'failed'; e.why = '图没传上去，点一下再试'; e.upfail = true; redrawEph(); return;
    }
    const body = { text: e.text, side: 'sun' };   /* R1：这页的暗面只是外观，不是 Nyx 的夜面 */
    if (e.q) body.quote = e.q;
    const atts = items.map(x => x.done).filter(Boolean); if (atts.length) body.attachments = atts;
    if (!e.text && !atts.length) { e.state = 'failed'; redrawEph(); return; }
    return api('/app/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(() => { setTimeout(catchUp, 1500); }, err => { e.state = 'failed'; e.why = err && err.auth ? '钥匙不认了' : '没发出去，点一下再试'; redrawEph(); if (err && err.auth) authFail(); });
  }).catch(() => { e.state = 'failed'; redrawEph(); });
}
function retryPend(key) {
  const e = EPHS.find(x => x.key === key); if (!e || e.state !== 'failed') return;
  e.state = 'sending'; e.why = '';
  if (e.upfail) { e.upfail = false; e.items.forEach(x => { if (x.file && !x.done) upload(x); }); }
  redrawEph(); firePend(e);
}
/* 附件：选了就开始传（同 Nyx：大图长边压到 2048、转 JPEG 0.9，动图不动；断了自己再试两次） */
function prep(f) {
  return new Promise(ok => {
    if (!/^image\//.test(f.type || '') || /gif$/i.test(f.type) || f.size < 350 * 1024) { ok(f); return; }
    const u = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      try {
        const w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, 2048 / Math.max(w, h)), c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(b => { ok(b && b.size < f.size ? new File([b], (f.name || 'image').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.9);
      } catch (e) { URL.revokeObjectURL(u); ok(f); }
    };
    im.onerror = () => { URL.revokeObjectURL(u); ok(f); };
    im.src = u;
  });
}
function upload(it, tries) {
  tries = tries || 0; it.done = null; it.bad = false; paintAtts();
  it.job = fetch(RELAY + '/app/upload?name=' + encodeURIComponent(it.file.name), { method: 'POST', headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': it.file.type || 'application/octet-stream' }, body: it.file })
    .then(r => { if (!r.ok) throw new Error('upload ' + r.status); return r.json(); })
    .then(a => { it.done = a; paintAtts(); },
      () => { if (tries < 2) return new Promise(ok => setTimeout(ok, 1200)).then(() => upload(it, tries + 1)); it.bad = true; paintAtts(); });
  return it.job;
}
function paintAtts() {
  const at = $('atts'); if (!at) return;
  at.hidden = !ATT.length;
  at.innerHTML = ATT.map((x, i) => `<span class="it${x.done ? '' : x.bad ? ' bad' : ' up'}">${x.local ? `<img src="${x.local}" alt="">` : ''}<em>${esc((x.name || '').slice(0, 14))}</em><button data-i="${i}" aria-label="不发这个">×</button></span>`).join('');
  placeExtras(); drawSend();
}
function pickFiles(files) {
  Array.prototype.forEach.call(files, f => {
    const it = { name: f.name, file: f, done: null };
    if (/^image\//.test(f.type)) it.local = URL.createObjectURL(f);
    ATT.push(it); it.job = prep(f).then(ff => { it.file = ff; return upload(it); });
  });
  paintAtts();
}

/* ---------- 表情盘：一排自己画的小方块，点一下直接发（样子稿）；接后台时换成 Nyx 的贴纸清单和图，下面一行 emoji 落进输入框 ---------- */
const STKD = ['bird', 'moon', 'note', 'cup', 'sun', 'bar'];
const EMO = (('😀😂🥹😭🥺😳😌😏🙃🤔😴🤤😤😵‍💫🫠🤍🖤💛🧡🔥✨🌙☀️👀🙏👍👏🫶🤝🦀🍜☕️').match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?)*/gu)) || [];
let trayWired = false;
function buildTray() {
  const tr = $('tray');
  if (LIVE) {
    tr.classList.add('live');
    if (!trayWired) { trayWired = true; tr.addEventListener('click', trayClick); wireTrayPress(tr); }
    paintTray(); return;
  }
  tr.classList.add('live');   // 11/13 演示里也分两格：贴纸（画的那几张）和常用语（内存里三句）
  if (!trayWired) { trayWired = true; tr.addEventListener('click', trayClick); wireTrayPress(tr); }
  paintTray();
}

/* ---------- v24 入场：页面揭开后，眼睛下面凝出一滴蓝泪坠，沿测绘线的位置匀加速落下，身后把线拉出来；
   线经过处楼层刻度和数字依次亮起、邮戳盖下去、正文跟着淡入；坠子落到输入线上一顿，化成输入线左端一个小节点，之后留着。
   全程约一秒。?still=1 或系统减少动态时直接是落定的样子；入场时手指一碰、一滚、一按键就直接收尾，不拦交互。 ---------- */
const INTRO = !(Q.get('still') === '1' || REDUCED), content = $('content');
let glineEl = null, tearEl = null, knotEl = null, introOn = false, introRaf = 0, introT = 0;
function ensureTear() {
  if (!glineEl) { glineEl = document.createElement('div'); glineEl.id = 'gline'; glineEl.setAttribute('aria-label', '额度用了多少'); content.appendChild(glineEl); }
  if (!knotEl) { knotEl = document.createElement('button'); knotEl.id = 'knot'; knotEl.setAttribute('aria-label', '仪表'); knotEl.setAttribute('aria-expanded', 'false'); content.appendChild(knotEl); drawKnot(); }
  if (!tearEl) { tearEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tearEl.id = 'tear'; tearEl.setAttribute('viewBox', '-3.5 0 7 12'); tearEl.setAttribute('aria-hidden', 'true');
    tearEl.innerHTML = '<path d="M0,0 L3.3,6 L0,12 L-3.3,6 Z" fill="var(--lb)"/>'; content.appendChild(tearEl); }
}
function placeKnot() {
  if (glineEl) { glineEl.style.left = (LX + 14) + 'px'; glineEl.style.top = (LINE_Y + 7) + 'px'; }
  if (knotEl) { knotEl.style.left = (LX - 11) + 'px'; knotEl.style.top = (LINE_Y - 11) + 'px'; drawKnot(); }
  const gp = $('gauge'); if (gp) { gp.style.left = (LX + 1) + 'px'; gp.style.bottom = (H - LINE_Y + 4) + 'px'; gp.style.maxWidth = Math.round(TX + COLW - LX) + 'px'; gp.style.minWidth = gSub ? Math.round(TX + COLW - LX) + 'px' : ''; }   // 展开清单时铺满这一栏，后面的字别透出来
}
/* ---------- v25 仪表：泪坠落定留下的那个节点是一枚小月相，蓝的部分是「还剩多少」（这一周的额度）；点它沿测绘线从线脚往上长出一小列读数。
   读数：模型、5 小时额度、这一周额度、上下文、压缩线。?demo=1 时是示例数字，?gauge=0..1 调剩多少。
   v26：接后台时读 /app/meter 和 /app/window 的真数；读数下面四个细线文字钮：换模型、压缩一下、开新窗口、以前的窗口，调 Nyx 表盘同样的接口。 ---------- */
let GLEFT = clamp(Q.get('gauge') !== null && !isNaN(parseFloat(Q.get('gauge'))) ? parseFloat(Q.get('gauge')) : 0.62, 0, 1);
let gaugeOn = false, gSub = null, gNote = '';
function drawKnot() {
  if (!knotEl) return; const r = 4.9;
  knotEl.innerHTML = `<svg viewBox="-11 -11 22 22" aria-hidden="true"><circle r="${r}" fill="var(--bg)" stroke="var(--lb)" stroke-width=".7"/>${GLEFT > 0.005 ? `<path d="${litD(r, GLEFT)}" fill="var(--lb)"/>` : ''}</svg>`;
}
const pct = v => v == null ? null : Math.max(0, Math.min(100, Math.round(v)));
const kfmt = n => n >= 1000 ? Math.round(n / 1000) + 'k' : String(n || 0);
function whenReset(t) { if (!t) return ''; const d = new Date(t * 1000), now = new Date(), hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); return d.toDateString() === now.toDateString() ? hm : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm; }
function limName(l, short) {
  const k = l.key || '', m = /^seven_day_(.+)$/.exec(k);
  if (k === 'five_hour') return short ? '5h' : '5 小时';
  if (k === 'seven_day') return short ? '周' : '这一周';
  if (m) return (short ? '周·' : '这一周 ') + m[1].replace(/^./, c => c.toUpperCase());
  return l.label || k;
}
function gaugeRows() {
  if (!LIVE) return [['模型', 'Opus 5.5'], ['5 小时', '用 21%'], ['这一周', '剩 ' + Math.round(GLEFT * 100) + '%'], ['上下文', '34%'], ['压缩线', '600k']];
  if (GROUP) return [['群里', '没有仪表']];
  const m = meterData, w = win, out = [];
  if (!m && !w) return [['仪表', meterTried ? '没读到' : '在读…']];
  const ls = (m && m.limits) || [], five = ls.find(l => l.key === 'five_hour') || (ls.length > 1 ? ls[0] : null), week = ls.find(l => l.key === 'seven_day') || ls[ls.length - 1];
  out.push(['模型', (m && m.model && (m.model.name || m.model.id)) || '—']);
  ls.forEach(l => out.push([limName(l), l.used == null ? '—' : '用 ' + pct(l.used) + '%', l.resets_at ? whenReset(l.resets_at) + ' 重置' : '']));   // 后台报几条额度就列几条（同 Nyx 表盘的几个圈）
  const cv = m && m.context && pct(m.context.used_pct);
  out.push(['上下文', w && w.used ? kfmt(w.used) + (w.line_k ? ' / ' + w.line_k + 'k' : '') : cv != null ? cv + '%' : '—']);
  if (w) out.push(['压缩线', w.line_k ? w.line_k + 'k' : '没设']);
  return out;
}
function buildGauge() {
  const gp = $('gauge'), old = gp.querySelector('.gsub'), keep = old && gSubKind && old.dataset.k === gSubKind ? old.scrollTop : 0;   // 重画时设置那栏别跳回顶上
  gp.classList.toggle('wide', !!gSub);
  gp.innerHTML = gaugeRows().map(([k, v, s]) => `<div class="gr"><span>${k}</span><b>${esc(v)}</b>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('') +
    (GROUP ? '' : '<div class="gact"><button data-g="model">换模型</button><button data-g="compact">压缩一下</button><button data-g="new">开新窗口</button><button data-g="wins">以前的窗口</button><button data-g="set">设置</button></div>') +
    (gSub ? `<div class="gsub${gSubKind === 'set' ? ' set' : ''}" data-k="${gSubKind || ''}">${gSub}</div>` : '') + (gNote ? `<div class="gnote">${esc(gNote)}</div>` : '');
  gp.querySelectorAll('.gact button').forEach(b => b.classList.toggle('on', gSub != null && b.dataset.g === gSubKind));
  placeKnot(); fitGauge(); if (keep) gp.querySelector('.gsub').scrollTop = keep;
}
function fitGauge() {   // 矮屏上展开的那栏别顶过页眉：多出来的部分在栏里滚
  const gp = $('gauge'), sub = gp.querySelector('.gsub'); if (!sub || gp.hidden) return;
  sub.style.maxHeight = '';
  const top = Math.max(eye.getBoundingClientRect().bottom, who.getBoundingClientRect().bottom) + 8, over = top - gp.getBoundingClientRect().top;
  if (over > 0) sub.style.maxHeight = Math.max(90, sub.clientHeight - over) + 'px';
}
function setGauge(on) {
  gaugeOn = on; const gp = $('gauge'); content.classList.toggle('gauge-on', on); document.body.classList.toggle('gauge-on', on); if (knotEl) knotEl.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) { if (LIVE) { loadMeter(); loadWin(); } buildGauge(); gp.hidden = false; fitGauge(); gp.classList.remove('shut'); void gp.offsetWidth; gp.classList.add('open'); }
  else if (!gp.hidden) { gSub = null; gSubKind = null; gp.classList.remove('open'); gp.classList.add('shut'); setTimeout(() => { if (!gaugeOn) { gp.hidden = true; gp.classList.remove('shut'); placeKnot(); } }, 210); }
}
let gSubKind = null, modelPin = null, winList = [];
function gaugeClick(ev) {
  const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation();
  if (!LIVE) { gNote = '演示里不发请求'; buildGauge(); return; }
  const g = b.dataset.g;
  if (g === 'model') { if (gSubKind === 'model') { gSub = null; gSubKind = null; } else { gSubKind = 'model'; gSub = modelSub(); } gNote = ''; buildGauge(); }
  else if (g === 'wins') { if (gSubKind === 'wins') { gSub = null; gSubKind = null; buildGauge(); return; } gSubKind = 'wins'; gSub = '<p>在找…</p>'; gNote = ''; buildGauge(); loadWins(); }
  else if (g === 'compact') { gSub = null; gSubKind = null; compact(); }
  else if (g === 'new') { gSub = null; gSubKind = null; newWin(); }
  else if (g === 'set') { if (gSubKind === 'set') { gSub = null; gSubKind = null; } else { gSubKind = 'set'; gNote = ''; openSet(); } buildGauge(); }
  else if (b.dataset.push) setPush(b.dataset.push === 'on');
  else if (b.dataset.brain) setBrain(b.dataset.brain);
  else if (b.dataset.eff) setEffort(b.dataset.eff);
  else if (b.dataset.step || b.dataset.v != null) { const row = b.closest('[data-row]'); if (row) stepSet(row.dataset.row, b.dataset.step ? +b.dataset.step : null, b.dataset.v != null ? +b.dataset.v : null); }
  else if (b.dataset.copy) copySid();
  else if (b.dataset.mid) pickModel(b.dataset.mid);
  else if (b.dataset.sid) switchWin(b.dataset.sid);
}
function modelSub() {
  const m = meterData || {}, pin = modelPin && Date.now() < modelPin.until ? modelPin : null, actual = m.model && m.model.id, live = m.model_applies === 'live';
  const listed = (m.models || []).some(x => x.id === actual), curM = (pin && pin.id) || (live && listed ? actual : m.chosen || actual);
  return (m.models || []).map(x => `<button data-mid="${esc(x.id)}"${x.id === curM ? ' class="on"' : ''}>${esc(x.name || x.id)}</button>`).join('') || '<p>后台没给模型清单</p>';
}
function pickModel(id) {   // 同 Nyx：POST /app/model {model}
  gNote = '…'; buildGauge();
  const pin = (pid, note) => { modelPin = { id: pid, until: Date.now() + 60000 }; gNote = note; if (gSubKind === 'model') gSub = modelSub(); buildGauge(); setTimeout(loadMeter, 1500); };
  api('/app/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: id }) })
    .then(r => { if (meterData) meterData.chosen = id; if (r && r.confirmed) pin(id, '换好了，窗口那边确认了'); else if (r && r.applied) pin(null, '发给窗口了，这边确认不了；下次重开还是旧的'); else pin(null, '存下了，按这个后台的规矩生效'); })
    .catch(err => pin(null, /409/.test(err.message) ? '它在忙，没换成，等它停下再点' : '没换成：' + err.message));
}
function compact() {   // 同 Nyx：POST /app/window/compact
  gNote = '…'; buildGauge();
  api('/app/window/compact', { method: 'POST' }).then(r => { gNote = r && r.started === false ? '发过去了，还没看到它开始压' : '在压缩，等一会儿'; buildGauge(); setTimeout(() => { loadWin(); loadMeter(); }, 2500); })
    .catch(e => { gNote = /409/.test(e.message) ? '它在忙或者在等确认，没压上，等它停下再点' : '没压上：' + e.message; buildGauge(); });
}
function newWin() {   // 同 Nyx：先记下现在的窗口号，POST /app/window/new，再盯 /app/window 的 sid 换没换
  const h = win && win.carry && win.carry.hours, c = win && win.carry && win.carry.chars;
  if (!confirm('给' + NAME + '开个新窗口？这一个会关掉。' + (h ? '新窗口带上最近 ' + h + ' 小时的话（最多 ' + Math.round((c || 0) / 1000) + 'k 字），其余靠记忆。' : '什么都不带过去，只有记忆跟着。') + '想回来可以在「以前的窗口」里找。')) return;
  gNote = '…'; buildGauge();
  api('/app/window').then(d => d.sid || '', () => (win && win.sid) || '').then(before =>
    api('/app/window/new', { method: 'POST' }).then(() => verifyWin(before, '新窗口开好了。'), e => {
      if (/500/.test(e.message)) return verifyWin(before, '第一次没起来，不过窗口又起来了。');
      if (/50[24]|fetch|network|abort|timeout/i.test(e.message)) return verifyWin(before, '新窗口开好了。');
      gNote = /409/.test(e.message) ? '它已经在重开了，这回没动' : '没开成：' + e.message + '。还是旧窗口'; buildGauge();
    }));
}
function loadWins() {   // 同 Nyx 的「Windows」：GET /app/window/list
  api('/app/window/list').then(d => {
    winList = d.windows || [];
    const fmt = iso => { if (!iso) return '–'; const d2 = new Date(iso), n = new Date(); return (d2.toDateString() === n.toDateString() ? '今天 ' : (d2.getMonth() + 1) + '/' + d2.getDate() + ' ') + pad2(d2.getHours()) + ':' + pad2(d2.getMinutes()); };
    gSub = winList.length ? winList.map(w => `<button data-sid="${esc(w.sid)}" class="win${w.current ? ' on' : ''}"><span>${w.current ? '正在用 · ' : ''}${fmt(w.started)}${w.messages != null ? ' · ' + w.messages + ' 条' : ''}</span><em>${esc((w.last_text || '还没说话').replace(/\s+/g, ' ').slice(0, 40))}</em></button>`).join('') : '<p>还没有别的窗口</p>';
    if (gSubKind === 'wins') buildGauge();
  }).catch(() => { gSub = '<p>没拿到清单</p>'; if (gSubKind === 'wins') buildGauge(); });
}
function switchWin(sidv) {
  const w = winList.find(x => x.sid === sidv); if (!w || w.current) return;
  if (!confirm('回到那个窗口？现在这个会关掉，之后也能在这里回来。')) return;
  gSub = '<p>在换…</p>'; buildGauge();
  const before = (win && win.sid) || '';
  api('/app/window/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: w.sid }) })
    .then(() => { gSub = null; gSubKind = null; buildGauge(); setTimeout(() => verifyWin(before, '换过去了。'), 2500); })
    .catch(e => { gSub = '<p>没换成：' + esc(e.message) + '</p>'; buildGauge(); });
}
/* ---------- 11/12 仪表「设置」：把 Nyx 球里剩下的几样搬进来，接口跟 Nyx 原版一样
   锁屏通知  push.js：GET /app/vapid_public → pushManager.subscribe → 每只后台 POST /app/subscribe {endpoint, keys}；关是 POST /app/unsubscribe {endpoint}
   谁来接    meter-cn.js：GET /app/brain → {target}；POST /app/brain {target:"desktop"|"loop"}
   effort    windows.js：读 GET /app/busy 的 pending_effort || effort；POST /app/effort {level}；后台没回时用 localStorage nyx_effort{后缀}
   窗口号    windows.js：GET /app/context 的 active_sid || sid，点一下复制
   压缩线    app.js：POST /app/window/line {line_k}（0–900，20 一档，0 是不划线），停手 0.5 秒才发，发完重读 /app/window
   带过去    app.js：POST /app/window/carry {hours, chars}（0–12 小时半小时一档；2000–40000 字 2000 一档），两样一起发，停手 0.5 秒才发 ---------- */
const EFF = ['low', 'medium', 'high', 'xhigh', 'max'];
const SETR = { line: [0, 900, 20], carryh: [0, 12, 0.5], carryc: [2000, 40000, 2000] };
const SET = { line: null, ch: null, cc: null, dirtyL: 0, dirtyC: 0, eff: '', effNote: '', brain: '', brainNote: '', push: null, pushNote: '', sid: '' };
let lineT = 0, carryT = 0;
const effKey = () => 'nyx_effort' + SUFX;
const pushOK = () => false;   // 公版还没有 service worker，锁屏通知这一行先不开
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function openSet() {
  syncSetFromWin(true); SET.eff = SET.eff || ls(effKey()) || ''; gSub = setSub();
  api('/app/busy').then(d => { const lv = d.pending_effort || d.effort; if (lv && EFF.includes(lv)) SET.eff = lv; SET.effNote = d.pending_effort ? '这一轮忙完就换成 ' + d.pending_effort : SET.effNote; repaintSet(); }).catch(() => {});
  api('/app/context').then(c => { SET.sid = c.active_sid || c.sid || ''; repaintSet(); }).catch(() => { SET.sid = (win && win.sid) || ''; repaintSet(); });
  readPush().then(repaintSet);
  loadWin().then(() => { syncSetFromWin(); repaintSet(); });
}
function syncSetFromWin(first) {   // 正在调的那样不让后台的旧数盖掉
  const w = win || {}, cy = w.carry || {};
  if (!SET.dirtyL && (first || w.line_k != null)) SET.line = w.line_k || 0;
  if (!SET.dirtyC) { if (cy.hours != null) SET.ch = +cy.hours; else if (SET.ch == null) SET.ch = 2; if (cy.chars != null) SET.cc = +cy.chars; else if (SET.cc == null) SET.cc = 12000; }   // 后台没报时同 Nyx 滑条的初值 2h / 12000
}
function repaintSet() { if (gSubKind === 'set' && gaugeOn) { gSub = setSub(); buildGauge(); } }
function setSub() {
  const opt = (attr, v, label, on) => `<button data-${attr}="${v}"${on ? ' class="on"' : ''}>${label}</button>`;
  const fl = v => v ? v + 'k' : '不划线', fh = v => v ? (+v.toFixed(1)) + 'h' : '不带', fc = v => Math.round(v / 1000) + 'k';
  const stepper = (row, val, txt, picks) => `<div class="srow" data-row="${row}"><span class="sk">${{ line: '压缩线', carryh: '带过去', carryc: '最多' }[row]}</span><span class="sopt">` +
    `<span class="sstep"><button data-step="-1" aria-label="少一档"${val <= SETR[row][0] ? ' disabled' : ''}>−</button><b class="sv">${txt}</b><button data-step="1" aria-label="多一档"${val >= SETR[row][1] ? ' disabled' : ''}>＋</button></span>` +
    (picks ? `<span class="spick">${picks.map(v => `<button data-v="${v}"${v === val ? ' class="on"' : ''}>${v ? v : '不划'}</button>`).join('')}</span>` : '') + '</span></div>';
  let pushRow;
  if (!pushOK()) pushRow = '<span class="sopt"><em>锁屏通知还没接</em></span>';
  else pushRow = '<span class="sopt">' + opt('push', 'off', '关', SET.push === false) + opt('push', 'on', '开', SET.push === true) + '</span>';
  return '<div class="sgrp">' +
    `<div class="srow" data-row="push"><span class="sk">锁屏通知</span>${pushRow}</div>` +
    `<p class="sh">${esc(SET.pushNote || '没在看的时候，谁回了都推到锁屏。iPhone 要从主屏图标打开才收得到。')}</p>` +
    `<div class="srow" data-row="effort"><span class="sk">effort</span><span class="sopt">${EFF.map(l => opt('eff', l, l, l === SET.eff)).join('')}</span></div>` +
    (SET.effNote ? `<p class="sh">${esc(SET.effNote)}</p>` : '') +
    `<div class="srow" data-row="sid"><span class="sk">窗口号</span><span class="sopt">${SET.sid ? `<button data-copy="1" class="mono">${esc(SET.sid.slice(0, 8))}…</button><em>点一下复制</em>` : '<em>–</em>'}</span></div>` +
    '</div><div class="sgrp">' +
    stepper('line', SET.line, fl(SET.line), [0, 400, 600, 800]) +
    '<p class="sh">上下文过了这条线，先写记忆，安静下来以后自动压缩。</p>' +
    stepper('carryh', SET.ch, fh(SET.ch)) + stepper('carryc', SET.cc, fc(SET.cc)) +
    '<p class="sh">开新窗口时，把最近这么久的原话交给新窗口，字数到上限就停，再往前的靠记忆。</p></div>';
}
function stepSet(row, dir, val) {
  const [lo, hi, st] = SETR[row], k = { line: 'line', carryh: 'ch', carryc: 'cc' }[row];
  let v = val != null ? val : (SET[k] || 0) + dir * st; v = Math.round(clamp(v, lo, hi) / st) * st;
  SET[k] = v;
  if (row === 'line') {
    SET.dirtyL = 1; clearTimeout(lineT);
    lineT = setTimeout(() => api('/app/window/line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_k: SET.line }) })
      .then(() => { SET.dirtyL = 0; return loadWin(); }).then(() => { syncSetFromWin(); repaintSet(); }).catch(e => { SET.dirtyL = 0; gNote = '压缩线没存上：' + e.message; repaintSet(); }), 500);
  } else {
    SET.dirtyC = 1; clearTimeout(carryT);
    carryT = setTimeout(() => api('/app/window/carry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours: SET.ch, chars: SET.cc }) })
      .then(() => { SET.dirtyC = 0; if (win) win.carry = { hours: SET.ch, chars: SET.cc }; }).catch(e => { SET.dirtyC = 0; gNote = '带过去没存上：' + e.message; repaintSet(); }), 500);
  }
  repaintSet();
}
function setEffort(v) {   // 同 lib/windows.js
  SET.eff = v; SET.effNote = '…'; try { localStorage.setItem(effKey(), v); } catch (_) {} repaintSet();
  api('/app/effort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: v }) })
    .then(j => { SET.effNote = j && j.pending ? '这一轮忙完就换成 ' + v : '换成 ' + v + ' 了'; repaintSet(); })
    .catch(e => { SET.effNote = /503/.test(e.message) ? '会话好像没开' : '没换成：' + e.message; repaintSet(); });
}
function setBrain(t) {   // 同 lib/meter-cn.js
  SET.brainNote = '…'; repaintSet();
  api('/app/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: t }) })
    .then(d => { SET.brain = (d && d.target) || t; SET.brainNote = ''; toast(SET.brain === 'loop' ? '已切到 API' : '已切到 Desktop'); repaintSet(); })
    .catch(() => { SET.brainNote = '切换失败'; repaintSet(); });
}
function copySid() {
  const sidv = SET.sid; if (!sidv) return;
  const done = () => toast('已复制窗口号');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sidv).then(done, () => toast('复制失败'));
  else { const t = document.createElement('textarea'); t.value = sidv; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (_) { toast('复制失败'); } t.remove(); }
}
/* 锁屏通知（公版还没有 service worker，pushOK 先关着）。订阅报给每只后台（联系人里的每只，不算群；没有第一只就补上），钥匙同 push.js 用 nyx_key */
function pushBases() {
  const b = contactsList().map(c => c.relay).filter(r => r && !/\/g$/.test(r));
  if (b.indexOf(HOME) < 0) b.unshift(HOME);
  return b;
}
const pushH = () => ({ 'Authorization': 'Bearer ' + (ls('nyx_key') || ''), 'Content-Type': 'application/json' });
function u8(s) { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u; }
function swReg() {   // 只在点了才登记；登记不上 8 秒就放弃，不干等
  return Promise.race([Promise.reject(new Error('demo')).then(() => Promise.reject(new Error('demo'))),
    new Promise((_, no) => setTimeout(() => no(new Error('sw')), 8000))]);
}
function readPush() {
  if (!pushOK()) return Promise.resolve();
  const g = Promise.resolve(null);
  return g.then(reg => reg ? reg.pushManager.getSubscription() : null).then(sub => { SET.push = !!sub && Notification.permission === 'granted'; }).catch(() => { SET.push = false; });
}
function setPush(on) {
  if (!pushOK()) return;
  const H = pushH();
  if (on) {
    if (!standalone()) { SET.pushNote = '先「添加到主屏幕」，再从主屏图标打开才能开通知'; SET.push = false; repaintSet(); return; }
    SET.pushNote = '…'; repaintSet();
    Notification.requestPermission().then(p => {
      if (p !== 'granted') { SET.push = false; SET.pushNote = '手机没给通知权限'; repaintSet(); return; }
      return swReg().then(reg => reg.pushManager.getSubscription().then(sub => sub ||
        fetch(pushBases()[0] + '/app/vapid_public', { headers: H }).then(r => r.json()).then(j => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(j.key) }))))
        .then(sub => { const j = sub.toJSON(); return Promise.all(pushBases().map(b => fetch(b + '/app/subscribe', { method: 'POST', headers: H, body: JSON.stringify({ endpoint: sub.endpoint, keys: j.keys }) }).catch(() => {}))); })
        .then(() => { SET.push = true; SET.pushNote = ''; try { localStorage.setItem('nyx_push', 'on'); } catch (_) {} repaintSet(); });
    }).catch(() => { SET.push = false; SET.pushNote = '没开成'; repaintSet(); });
  } else {
    SET.pushNote = '…'; repaintSet();
    const g = Promise.resolve(null);
    g.then(reg => reg ? reg.pushManager.getSubscription() : null).then(sub => {
      if (!sub) return;
      return Promise.all(pushBases().map(b => fetch(b + '/app/unsubscribe', { method: 'POST', headers: H, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}))).then(() => sub.unsubscribe());
    }).catch(() => {}).then(() => { SET.push = false; SET.pushNote = ''; try { localStorage.setItem('nyx_push', 'off'); } catch (_) {} repaintSet(); });
  }
}
function verifyWin(before, label) {   // 200 只说明后台跑了脚本；窗口号换了才算真换了（同 Nyx 11/2 那条）
  const start = Date.now(); let last = '';
  gNote = '在确认窗口真换了…'; buildGauge();
  (function tick() {
    api('/app/window').then(d => d, () => null).then(d => {
      if (d && d.sid) last = d.sid;
      if (d && d.sid && d.sid !== before) { gNote = label + ' 窗口号 ' + d.sid.slice(0, 8) + '。'; win = d; buildGauge(); loadMeter(); return; }
      if (Date.now() - start < 90000) return void setTimeout(tick, 4000);
      gNote = last && last === before ? '没换：还在旧窗口 ' + before.slice(0, 8) + '。' : '确认不了：还没有窗口应声，过一分钟再看。'; buildGauge();
    });
  })();
}
function finishIntro() {
  if (!introOn) return; introOn = false; cancelAnimationFrame(introRaf); clearTimeout(introT);
  if (tearEl) tearEl.style.display = 'none'; survey.style.transform = '';
  content.classList.remove('intro'); rows.querySelectorAll('.i-on').forEach(x => x.classList.remove('i-on'));
}
function startIntro() {
  if (!introOn) return;
  const sr = stage.getBoundingClientRect(), lr = list.getBoundingClientRect(), top = parseFloat(survey.style.top) || EYE_Y + 32, bot = LINE_Y, y0 = EYE_Y + 22, TH = 12, items = [];
  rows.querySelectorAll('.para, .day, .gap, .typing, .aux').forEach(el => {   // 每样东西在舞台上的高度：段看楼层数字，日子看邮戳
    const k = el.classList.contains('para') ? el.querySelector('.fl') : el.classList.contains('day') ? el.querySelector('canvas') : el, r = (k || el).getBoundingClientRect();
    if (r.bottom < lr.top || r.top > lr.bottom) { el.classList.add('i-on'); return; }   // 不在屏上的直接就位
    items.push([(r.top + r.bottom) / 2 - sr.top, el]); });
  items.sort((a, b) => a[0] - b[0]);
  const TC = 160, TF = 640, TS = 190, TOT = TC + TF + TS, y1 = bot - TH, H0 = Math.max(1, bot - top), X = (LX - 3.5).toFixed(1);
  let t0 = 0, idx = 0; tearEl.style.display = 'block';
  const tick = now => {
    if (!introOn) return; if (!t0) t0 = now; const t = now - t0; let tip, sx = 1, sy = 1, op = 1, kn = 0;
    if (t < TC) { const u = t / TC; tip = y0; sx = sy = 0.25 + 0.75 * smoother(u); op = Math.min(1, u * 1.6); }   // 凝出来
    else if (t < TC + TF) { const u = (t - TC) / TF; tip = y0 + (y1 - y0) * (0.12 * u + 0.88 * u * u); }   // 匀加速往下落
    else { const u = clamp((t - TC - TF) / TS, 0, 1); tip = y1;   // 落到输入线上：先一顿（压扁一点），再缩成线头上的小节点
      if (u < 0.35) { const v = Math.sin(PI * u / 0.35); sy = 1 - 0.24 * v; sx = 1 + 0.16 * v; } else { const v = smoother((u - 0.35) / 0.65); sx = sy = 1 - v; } kn = smoother((u - 0.45) / 0.55); }
    const end = t < TC ? top : t < TC + TF ? tip : bot - TH * sy;
    survey.style.transform = `scaleY(${clamp((end - top) / H0, 0, 1).toFixed(4)})`;
    while (idx < items.length && items[idx][0] <= tip + TH) items[idx++][1].classList.add('i-on');
    tearEl.style.transform = `translate(${X}px,${tip.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`; tearEl.style.opacity = op;
    if (knotEl) knotEl.style.opacity = kn;
    if (t < TOT) introRaf = requestAnimationFrame(tick); else { if (knotEl) knotEl.style.opacity = ''; finishIntro(); }
  };
  introRaf = requestAnimationFrame(tick); introT = setTimeout(finishIntro, TOT + 1500);   // 后台标签页里 rAF 停了也别一直藏着
}
['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (introOn) { if (knotEl) knotEl.style.opacity = ''; finishIntro(); } }, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden && introOn) { if (knotEl) knotEl.style.opacity = ''; finishIntro(); } });
window.addEventListener('pageshow', ev => { if (ev.persisted && introOn) { if (knotEl) knotEl.style.opacity = ''; finishIntro(); } });

/* ---------- 状态行：闲着 / 在写 / 工具名加秒数 / 在想（像素小螃蟹）。样子稿里轮着演，?state= 定格 ----------
   「在写」和消息区底下那三颗蓝点是一回事：只有在写的时候底下才有三点。
   v26 接后台：GET /app/busy（同 Nyx，忙时 2.5 秒、闲时 5 秒问一次）加流里的 typing / 草稿事件。
   有回复草稿在来 → 在写；忙着且有工具 → 工具名 · 秒数；忙着没工具或 typing 开着 → 在想；等终端点头、窗口没开、连不上、没登录 → 闲着那一格换字。 */
const stEl = $('st'), ST = ['idle', 'writing', 'tool', 'think'], STAY = { idle: 5000, writing: 4500, tool: 5500, think: 5000 }, TOOLS = ['Read', 'Bash', 'Edit', 'Grep'];
let stNow = null, stT0 = 0, stSecs = 0, stTool = 'Read', stTimer = 0, stTick = 0, crabF = 0, stLabel = '';
const FIX = ST.indexOf(Q.get('state')) >= 0 ? Q.get('state') : null;
const CRAB = [   // 8×6，两帧：钳子一上一下交替
  ['X......X', 'XX....XX', '.XXXXXX.', '.XoXXoX.', '..XXXX..', '.X.XX.X.'],
  ['........', 'XX....XX', 'XXXXXXXX', '.XoXXoX.', '..XXXX..', 'X..XX..X'] ];
function drawCrab() {
  const cv = stEl.querySelector('canvas.crab'); if (!cv) return;
  const px = 1.6, g = fitCanvas(cv, 8 * px, 6 * px), fr = CRAB[crabF % 2];   // 11/13 状态行小两号，螃蟹跟着缩
  g.clearRect(0, 0, 8 * px, 6 * px); g.fillStyle = inkBlue();
  fr.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === 'X') g.fillRect(x * px, y * px, px, px); });
}
function secsText(n) { n = n || 0; return n >= 3600 ? Math.floor(n / 3600) + 'h ' + Math.floor(n % 3600 / 60) + 'm' : n >= 60 ? Math.floor(n / 60) + 'm ' + (n % 60) + 's' : n + 's'; }
function stText() {
  const em = stEl.querySelector('em'); if (!em) return;
  const s = stSecs + Math.floor((performance.now() - stT0) / 1000);
  if (stNow === 'tool') em.textContent = stTool + ' · ' + (LIVE ? secsText(s) : s + 's');
  else if (stNow === 'think') em.textContent = '在想 · ' + (LIVE ? secsText(s) : s + 's');
}
function setStatus(k, secs, label) {
  stNow = k; stLabel = label || ''; stT0 = performance.now(); stSecs = secs != null ? secs : k === 'tool' ? 3 + Math.floor(Math.random() * 10) : k === 'think' ? 2 : 0;
  stEl.className = 'st ' + k;
  stEl.innerHTML = k === 'idle' ? '<i class="dot"></i><em>' + esc(label || '闲着') + '</em>'
    : k === 'writing' ? '<span class="dots"><i></i><i></i><i></i></span><em>在写</em>'
    : k === 'tool' ? '<em class="mono"></em>'
    : '<canvas class="crab" aria-hidden="true"></canvas><em></em>';
  stEl.setAttribute('aria-label', NAME + ({ idle: label || '闲着', writing: '在写', tool: '在用工具', think: '在想' }[k]));
  if (k === 'think') drawCrab(); stText(); paintListen(); paintAg();
  if (typingEl) typingEl.classList.toggle('off', k !== 'writing');   // 底下的三点只在「在写」时出现
}
function statusLoop() { clearTimeout(stTimer); if (FIX || LIVE) return; stTimer = setTimeout(() => { const nx = ST[(ST.indexOf(stNow) + 1) % ST.length]; if (stNow === 'tool') stTool = TOOLS[(TOOLS.indexOf(stTool) + 1) % TOOLS.length]; setStatus(nx); statusLoop(); }, STAY[stNow] || 5000); }
setInterval(() => { if (document.hidden) return; stText(); if (stNow === 'think') { crabF++; drawCrab(); } if (LIVE) paintStatus(); }, 450);
let offAt = 0;   // 11/15：断线起点，超过 1.5 秒才写「在重连」，换人时的一下不闪
let busy = null, typingOn = false, typingOffT = 0, typingAt = 0, online = false, gate = '';
function typingSet(on) {
  clearTimeout(typingOffT);
  if (on) { if (!typingOn) typingAt = Date.now(); typingOn = true; paintStatus(); }
  else typingOffT = setTimeout(() => { typingOn = false; paintStatus(); }, 2500);   // 关的时候等一会儿再收，别一跳一跳（同 Nyx）
}
function paintStatus() {
  if (!LIVE || FIX) return;
  const el = (busy && busy.at) ? Math.round((Date.now() - busy.at) / 1000) : 0;
  let k = 'idle', secs = 0, tool = stTool, label = '闲着';
  if (online) offAt = 0; else if (!offAt) offAt = Date.now();
  if (gate) label = gate;
  else if (!online && Date.now() - offAt > 1500) label = '连不上，在重连…';
  else if (EPHS.some(e => e.t === 'draft' && e.kind === 'reply') && Date.now() - lastDraftAt < 4000) k = 'writing';
  else if (busy && busy.state === 'busy' && busy.tool) { k = 'tool'; tool = busy.tool; secs = (busy.tool_secs || 0) + el; }
  else if ((busy && busy.state === 'busy') || typingOn) { k = 'think'; secs = busy && busy.state === 'busy' ? (busy.secs || 0) + el : Math.round((Date.now() - typingAt) / 1000); }
  else if (busy && busy.state === 'waiting') label = '在等终端点头';
  else if (busy && busy.state === 'offline') label = '窗口没开';
  if (k !== stNow || (k === 'tool' && tool !== stTool) || (k === 'idle' && label !== stLabel)) { stTool = tool; setStatus(k, secs, label); }
  else if (k === 'tool' || k === 'think') { const shown = stSecs + Math.floor((performance.now() - stT0) / 1000); if (secs > shown + 2) { stSecs = secs; stT0 = performance.now(); } }
}

/* ---------- 11/13 点名字下面那行状态：往下展开一小列读数，「在做」什么 + 分身。
   跟本站 lib/think.js 那个泡说的是同一件事，只是换成这页的测绘线读数：
   「在做」照 Nyx app.js paintState 给 #state 拼的 title：/app/busy 的 tool · detail · 这一轮时长（secs，加上拉到以后过去的秒数）；
   分身是 GET /app/agents 里 status 为 moving 的，最多列 4 条，多了写「还有 N 个」。展开时每 3 秒重拉，收起就停；
   不展开时页面看得见、不在群里就每 15 秒拉一次，状态行末尾带一个蓝色小「+N」。群里整套不出现。?demo=1 用两条示例，不发请求。 ---------- */
let agents = null, stpOn = false, stpT = 0, stpN = 0;
const DEMO_AG = [{ status: 'moving', description: '整理这周的照片目录' }, { status: 'moving', description: '把读书笔记按章节排好，顺手给每章补一句摘要' }];
const movingAg = () => (agents || []).filter(a => a && a.status === 'moving');
function fetchAgents() {
  if (!LIVE) { agents = DEMO_AG; paintAg(); return Promise.resolve(); }
  if (GROUP || !KEY) return Promise.resolve();
  return api('/app/agents').then(d => { agents = (d && d.agents) || []; paintAg(); if (stpOn) buildStp(); }).catch(() => {});
}
function paintAg() {
  let b = stEl.querySelector('b.ag'); const n = GROUP ? 0 : movingAg().length;
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('b'); b.className = 'ag'; stEl.appendChild(b); }
  b.textContent = '+' + n; b.title = n + ' 个分身在忙';
}
let rsV = 0, rsT = 0;   // 11/15：展开那行的「这一轮」秒数也只往前走，后台给的值落后了不倒退（换工具、换状态时 setStatus 会重新起算）
function roundSecs(v) { const sh = rsV + Math.floor((performance.now() - rsT) / 1000); if (!rsT || v > sh + 2) { rsV = v; rsT = performance.now(); return v; } return sh; }
function doingText() {
  const s = stSecs + Math.floor((performance.now() - stT0) / 1000);
  if (!LIVE) return stNow === 'tool' ? stTool + ' · 这一轮 ' + s + 's' : stNow === 'think' ? '在想 · ' + s + 's' : stNow === 'writing' ? '在写' : '闲着';
  if (stNow === 'writing') return '在写';
  if (busy && busy.state === 'busy') { const el = busy.at ? Math.round((Date.now() - busy.at) / 1000) : 0; return [busy.tool, busy.detail, busy.secs ? '这一轮 ' + secsText(roundSecs(busy.secs + el)) : ''].filter(Boolean).join(' · ') || '在想'; }
  if (typingOn) return '在想';
  return stLabel || '闲着';
}
function buildStp() {
  const p = $('stp'); if (!p) return;
  const mv = movingAg(), row = (k, v, cls) => `<div class="gr${cls ? ' ' + cls : ''}">${k ? `<span class="k">${k}</span>` : ''}${v != null ? `<b>${esc(v)}</b>` : ''}</div>`;
  let h = row('在做', doingText());
  if (agents === null) h += row('分身', '…');
  else if (!mv.length) h += row('分身没在忙');
  else { h += row('分身', mv.length + ' 个在忙'); mv.slice(0, 4).forEach(a => { h += `<div class="gr sub"><span>${esc(a.description || '悄悄干活')}</span></div>`; }); if (mv.length > 4) h += `<div class="gr sub"><span>还有 ${mv.length - 4} 个</span></div>`; }
  p.innerHTML = h;
}
function setStp(on) {
  const p = $('stp'); if (!p || (on && GROUP) || on === stpOn) return;
  stpOn = on; stEl.setAttribute('aria-expanded', on ? 'true' : 'false'); clearInterval(stpT);
  if (on) {
    buildStp(); p.hidden = false; p.classList.remove('shut'); void p.offsetWidth; p.classList.add('open'); fetchAgents();
    stpN = 0; stpT = setInterval(() => { if (document.hidden) return; if (++stpN % 3 === 0) fetchAgents(); else buildStp(); }, 1000);
  } else {
    p.classList.remove('open'); if (REDUCED) { p.hidden = true; return; }
    p.classList.add('shut'); setTimeout(() => { if (!stpOn) { p.hidden = true; p.classList.remove('shut'); } }, 170);
  }
}
function placeStp() { const p = $('stp'); if (!p) return; p.style.left = (LX + 38) + 'px'; p.style.top = (EYE_Y + 24) + 'px'; p.style.maxWidth = Math.round(TX + COLW - LX - 44) + 'px'; }
(function stpInit() {
  const p = document.createElement('div'); p.id = 'stp'; p.hidden = true; p.setAttribute('role', 'group'); p.setAttribute('aria-label', '在做什么'); content.appendChild(p);
  p.addEventListener('click', ev => ev.stopPropagation());
  stEl.setAttribute('role', 'button'); stEl.setAttribute('aria-expanded', 'false'); stEl.tabIndex = 0;
  stEl.addEventListener('click', ev => { ev.stopPropagation(); if (GROUP) return; setStp(!stpOn); });
  stEl.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); stEl.click(); } });
  stage.addEventListener('click', ev => { if (stpOn && !ev.target.closest('#stp')) setStp(false); });
  document.addEventListener('keydown', ev => { if (stpOn && ev.key === 'Escape') setStp(false); });
  setInterval(() => { if (!document.hidden && !stpOn) fetchAgents(); }, 15000);
  setTimeout(fetchAgents, LIVE ? 2000 : 0);
})();

/* ================= v26 后台：跟 Nyx 的 app.js 同一套 =================
   GET  {relay}/app/history?tail=200&limit=200（进门拉最近两百条）、?since=&limit=（补拉、往前翻）
   GET  {relay}/app/stream（SSE，消息、typing、reply_delta / thinking_delta、reaction）
   POST {relay}/app/send {text, side:"sun", quote?, attachments?}、/app/upload?name=、/app/react {id, emoji}
   GET  /app/busy、/app/meter、/app/window、/app/window/list；POST /app/model、/app/window/compact、/app/window/new、/app/window/switch
   钥匙只放在 Authorization 头里，不进网址、不进日志。 */
let lastId = 0, streamCtl = null, retry = 0, watchdog = 0, busyT = 0, meterData = null, meterTried = false, win = null, hasOlder = true, loadingOld = false;
function api(path, opt) { return call(RELAY, KEY, path, opt); }
function call(base, k, path, opt) {
  opt = opt || {}; opt.headers = Object.assign({ 'Authorization': 'Bearer ' + k }, opt.headers || {});
  return fetch(base + path, opt).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}
const blobs = new Map();   // 上传的图在钥匙后面：带着钥匙拉成本机 blob 再显示（钥匙不进网址）
function blobOf(url) {
  if (!blobs.has(url)) blobs.set(url, fetch(url, { headers: { 'Authorization': 'Bearer ' + KEY } }).then(r => { if (!r.ok) throw 0; return r.blob(); }).then(URL.createObjectURL));
  return blobs.get(url);
}
function openStream() {
  if (!KEY) return;
  if (streamCtl) streamCtl.abort();
  const ctl = streamCtl = new AbortController();
  fetch(RELAY + '/app/stream', { headers: { 'Authorization': 'Bearer ' + KEY }, signal: ctl.signal, cache: 'no-store' }).then(r => {
    if (r.status === 401) { const e = new Error('unauthorized'); e.auth = true; throw e; }
    if (!r.ok || !r.body) throw new Error('stream ' + r.status);
    // 断线前写了一半的草稿收不到后半截了，成品走 catchUp
    retry = 0; online = true; for (let i = EPHS.length - 1; i >= 0; i--) if (EPHS[i].t === 'draft') EPHS.splice(i, 1); redrawEph(); paintStatus(); catchUp();
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    const pump = () => rd.read().then(c => {
      if (c.done) throw new Error('stream closed');
      kick(); buf += dec.decode(c.value, { stream: true });
      let cut; while ((cut = buf.indexOf('\n\n')) >= 0) { frame(buf.slice(0, cut)); buf = buf.slice(cut + 2); }
      return pump();
    });
    kick(); return pump();
  }).catch(e => {
    if (ctl.signal.aborted && ctl !== streamCtl) return;
    if (e && e.auth) { authFail(); return; }
    online = false; paintStatus();
    setTimeout(openStream, Math.min(15000, 1000 * Math.pow(2, retry++)));
  });
}
function kick() { clearTimeout(watchdog); watchdog = setTimeout(() => { if (streamCtl) streamCtl.abort(); streamCtl = null; openStream(); }, 40000); }   // 后台每 15 秒 ping；40 秒没动静就当断了
function frame(block) {
  const data = block.split('\n').filter(l => l.indexOf('data:') === 0).map(l => l.slice(5).trim()).join('\n');
  if (!data) return;
  try { onEvent(JSON.parse(data)); } catch (e) { console.error(e); }
}
function onEvent(ev) {
  if (ev.id != null && ev.from) {
    put(ev); if (ev.from === 'ai' && (ev.kind || 'reply') === 'reply') lastDraftAt = 0; paintStatus();
    if (ev.from === 'ai' && ev.kind === 'call') { const age = ev.ts ? Date.now() - new Date(ev.ts).getTime() : 0; if (age <= 120000) ring(ev.text); }   // 来电：同 call.js，两分钟以前的重放不响
    else shimEmit('message', ev);
    return;
  }
  if (ev.type) shimEmit(ev.type, ev);
  switch (ev.type) {
    case 'typing': typingSet(!!ev.active); break;
    case 'reply_delta': case 'thinking_delta': draft(ev); break;
    case 'reaction': onReaction(ev); break;
  }
}
function catchUp() { return api('/app/history?since=' + lastId + '&limit=200').then(d => { (d.messages || []).forEach(m => put(m)); }).catch(e => { if (e.auth) authFail(); }); }
function latest() {   // 最新的 200 条：后台认 tail 就一次拿到；不认（老后台按 id 从头给）就用 since 往后翻到底，只留最后 200 条（同 Nyx）
  return api('/app/history?tail=200&limit=200').then(d => {
    let all = d.messages || [];
    if (all.length < 200) return all;
    const more = since => api('/app/history?since=' + since + '&limit=500').then(n => { const got = n.messages || []; all = all.concat(got).slice(-200); return got.length === 500 ? more(got[got.length - 1].id) : all; });
    return more(all[all.length - 1].id);
  });
}
/* 往上滚到顶：拉更早的一百条。后台没有「before」，只能用 since 往回退一截再拉（id 不连续时多退几次） */
function loadOlder() {
  if (!LIVE || !KEY || loadingOld || !hasOlder || !ORDER.length) return;
  const first = ORDER[0]; if (first <= 1) { hasOlder = false; return; }
  loadingOld = true; list.classList.add('older');
  let back = 100, tries = 0;
  const range = (s0, acc) => api('/app/history?since=' + s0 + '&limit=500').then(d => {   // 从 s0 往后拉到 first 为止，中间不留缺口
    const got = (d.messages || []).filter(m => +m.id < first); acc.push(...got);
    const raw = d.messages || [];
    return raw.length === 500 && got.length === raw.length && +raw[raw.length - 1].id < first - 1 ? range(+raw[raw.length - 1].id, acc) : acc;
  });
  const step = () => {
    const since = Math.max(0, first - 1 - back);
    return range(since, []).then(got => {
      if (!got.length && since > 0 && ++tries < 6) { back *= 3; return step(); }
      if (since === 0) hasOlder = false;
      if (!got.length) { hasOlder = false; return; }
      got.forEach(m => put(m, true)); renderAll('anchor');
    });
  };
  step().catch(e => { if (e.auth) authFail(); }).then(() => { loadingOld = false; list.classList.remove('older'); });
}
list.addEventListener('scroll', () => { if (LIVE && !introOn && list.scrollTop < 120) loadOlder(); }, { passive: true });
function pollBusy() {
  clearTimeout(busyT);
  if (GROUP || !KEY) return;
  if (document.hidden) { busyT = setTimeout(pollBusy, 5000); return; }
  api('/app/busy').then(d => { d.at = Date.now(); busy = d; paintStatus(); }).catch(e => { busy = null; if (e.auth) authFail(); })
    .then(() => { busyT = setTimeout(pollBusy, busy && busy.state === 'busy' ? 2500 : 5000); });
}
function loadMeter() {
  if (!KEY || GROUP) return Promise.resolve();
  const k = 'ta_meter' + SUFX;
  return api('/app/meter').then(d => { meterData = d; meterTried = true; try { localStorage.setItem(k, JSON.stringify(d)); } catch (e) {} paintKnot(); if (gaugeOn) buildGauge(); })
    .catch(() => { meterTried = true; paintKnot(); if (gaugeOn) buildGauge(); });   // 读不到就留着上回的数，别整个空掉
}
/* 开门先摆上回存的数，同时就去拉新的，不等聊天记录；轮询只挂一次 */
let meterPoll = 0;
function meterEarly() {
  if (!KEY || GROUP) return;
  if (!meterData) { try { const c = JSON.parse(ls('ta_meter' + SUFX) || 'null'); if (c) { meterData = c; meterTried = true; paintKnot(); } } catch (e) {} }
  loadMeter();
  if (!meterPoll) meterPoll = setInterval(() => { if (!document.hidden) loadMeter(); }, 60000);
}
function loadWin() {   // 合并后 /app/window 找不到会话时 used 是 0，再问 /app/context 补上（同 Nyx）
  if (!KEY || GROUP) return Promise.resolve();
  return api('/app/window').then(d => { win = d; if (d.used) return; return api('/app/context').then(c => { if (c && c.usage_tokens) { d.used = c.usage_tokens; d.sid = d.sid || c.sid; } }).catch(() => {}); })
    .then(() => { if (gaugeOn) buildGauge(); }, () => { win = null; if (gaugeOn) buildGauge(); });
}
function paintKnot() {   // 月相：这一周还剩多少
  const ls = (meterData && meterData.limits) || [], week = ls.find(l => l.key === 'seven_day') || ls[ls.length - 1];
  GLEFT = week && week.used != null ? clamp(1 - week.used / 100, 0, 1) : 0; drawKnot();
  if (glineEl) glineEl.textContent = ls.filter(l => l.used != null).map(l => limName(l, true) + ' ' + pct(l.used)).join('  ·  ');   // 不点开也看得见：线脚下面一行小数字，用了百分之几
}
/* 没带钥匙、钥匙不认：一行安静的提示和去登录的链接，输入线收起来 */
function showGate(kind) {
  gate = kind === 'auth' ? '钥匙不认了' : '还没登录'; paintStatus();
  const n = $('note'); n.innerHTML = (kind === 'auth' ? '钥匙不认了，' : '还没带钥匙，') + '<a href="../index.html">去登录</a>'; n.hidden = false;
  document.body.classList.add('gated');
}
function authFail() { KEY = null; if (streamCtl) { streamCtl.abort(); streamCtl = null; } clearTimeout(busyT); showGate('auth'); }
function loadConfig() {   // Nyx 的 config.js：贴纸清单、名字、后台位置；?demo=1 时不装
  return new Promise(ok => { if (window.NYX) return ok(); const s = document.createElement('script'); s.src = '../config.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
}
function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function resolve() {   // 跟谁聊：?relay= 指定，不然跟 Nyx 现在选的那只（nyx_relay），再不然第一只；钥匙、名字、头像后缀跟着走（同 Nyx 的 enter()）
  const N = window.NYX || {};
  HOME = N.relay || '/relay'; ME = N.meName || '我';
  const up = p => typeof p === 'string' && p && !/^(\/|[a-z]+:)/i.test(p) ? '../' + p : p;   // config.js 的相对路径是从站点根算的，这页在 ta/ 里
  STICKERS = up(N.stickers) || STICKERS; DRAWS = up(N.drawings) || DRAWS;
  const want = Q.get('relay'), ok = r => typeof r === 'string' && /^\/relay(-[a-z0-9]+)?(\/g)?$/.test(r);
  const picked = ls('nyx_relay');
  RELAY = ok(want) ? want : ok(picked) ? picked : HOME;
  GROUP = /\/g$/.test(RELAY);
  const hk = ls('nyx_key'), contact = contactsList().find(c => c.relay === RELAY);
  KEY = RELAY === HOME ? hk : RELAY === picked ? (ls('nyx_chat_key') || hk) : ((contact && contact.key) || hk);
  NAME = RELAY === HOME ? (N.aiName || 'Companion') : (RELAY === picked && ls('nyx_ai')) || (contact && contact.name) || N.aiName || 'Companion';
  const SUF = { '/relay': '', '/relay/g': '_group' };
  SUFX = RELAY in SUF ? SUF[RELAY] : '_' + RELAY.replace(/^\/relay-?/, '').replace(/\W+/g, '_');
  AV = avatarURL(SUFX); eyeBuilt = null;
  who.querySelector('b').textContent = NAME; document.title = NAME + ' · 来信';
  if (typingEl) typingEl.setAttribute('aria-label', NAME + '正在写');
  loadDeleted(); atClose(); loadPin();
}
function startLive() {
  return loadConfig().then(() => {
    resolve(); buildTray(); loadDraft(); loadMine().then(paintTray); initPhr();
    if (!KEY) { showGate('none'); return; }
    meterEarly();
    /* 打开白纸三秒。先把上回存在手机里的那批摆出来，后台的到了再整批换上 */
    const CK = 'ta_hist' + SUFX; let cached = null;
    try { const c = JSON.parse(ls(CK) || 'null'); if (Array.isArray(c) && c.length) cached = c; } catch (e) {}
    if (cached) {
      ORDER = []; MSGS.clear();
      cached.forEach(m => { if (!deleted.has(String(m.id))) { MSGS.set(+m.id, m); ORDER.push(+m.id); } });
      ORDER.sort((a, b) => a - b); renderAll('bottom');
    }
    const first = latest().then(all => {
      try { localStorage.setItem(CK, JSON.stringify(all.slice(-80))); } catch (e) {}
      ORDER = []; MSGS.clear();
      all.forEach(m => { if (+m.id > lastId) lastId = +m.id; if (!deleted.has(String(m.id))) { MSGS.set(+m.id, m); ORDER.push(+m.id); } });
      ORDER.sort((a, b) => a - b); hasOlder = all.length >= 200 || (ORDER.length && ORDER[0] > 1);
      renderAll('bottom');
      openStream(); pollBusy();
    }, e => {
      if (e && e.auth) { showGate('auth'); return; }
      online = false; paintStatus(); setTimeout(() => { startLive2(); }, 3000);   // 连不上：过三秒再进一次门（同 Nyx）
    });
    return cached ? null : Promise.race([first, new Promise(r => setTimeout(r, 4000))]);
  });
}
function startLive2() { if (!KEY) return; latest().then(all => { all.forEach(m => put(m, true)); renderAll('bottom'); openStream(); pollBusy(); loadMeter(); }, e => { if (e && e.auth) showGate('auth'); else setTimeout(startLive2, 5000); }); }
document.addEventListener('visibilitychange', () => { if (LIVE && !document.hidden && KEY && lastId) { catchUp(); if (!streamCtl) openStream(); pollBusy(); } });

/* ================= v28（11/11）缺口补齐：来电和通话、她存的表情和颜文字、就地换人、打码、一起听入口 ================= */

/* ---------- 通话：同目录的 call.js（整张通话纸、录音、朗读都在里面），这页给它一个小小的 NyxChat 口子。
   AI 打来：流里一条 from=ai kind=call 的消息。这页不弹整屏来电，改成页眉下一条细线小条；点「接」就开通话，把来电那句先念出来。
   她打过去：顶栏电话图标点一下就开始拨（NyxCall.open）。来电没有铃声也不震。 ---------- */
const shimBus = {};
function shimEmit(t, ev) { (shimBus[t] || []).forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } }); }
let callLoaded = null;
function loadCall() {
  if (callLoaded) return callLoaded;
  const hdr = document.createElement('div'); hdr.hidden = true; const flip = document.createElement('i'); flip.className = 'flip'; hdr.appendChild(flip); document.body.appendChild(hdr);
  const lg = document.createElement('div'); lg.hidden = true; document.body.appendChild(lg);
  window.NyxChat = window.NyxChat || {
    api: (p, o) => api(p, o), raw: (p, o) => { o = o || {}; o.headers = Object.assign({ 'Authorization': 'Bearer ' + KEY }, o.headers || {}); return fetch(RELAY + p, o); },
    get ai() { return NAME; }, get group() { return GROUP; }, get relay() { return RELAY; }, get me() { return ME; },
    on: (t, fn) => { (shimBus[t] = shimBus[t] || []).push(fn); }, header: hdr, log: lg, messages: () => MSGS, esc, toast
  };
  document.body.style.setProperty('--vc-av', 'url("' + String(AV || '').replace(/"/g, '%22') + '")');   // 通话界面圆心放这一只的头像（call.css 原来是一颗橘色星，这页橘色只留给螃蟹）
  callLoaded = new Promise(ok => { const sc = document.createElement('script'); sc.src = 'call.js?v=2.0.0'; sc.onload = () => ok(!!window.NyxCall); sc.onerror = () => ok(false); document.head.appendChild(sc); });
  return callLoaded;
}
function callOpen() { return !!(window.NyxCall && NyxCall.isOpen()); }
setInterval(() => { const b = document.querySelector('#tools [data-k="call"]'); if (b) b.classList.toggle('on', callOpen()); }, 500);
function dial() {
  if (GROUP) { toast('群里不打电话'); return; }
  if (!LIVE) { toast('演示里不打电话'); return; }
  loadCall().then(okc => { if (!okc) { toast('通话没装上'); return; } if (callOpen()) NyxCall.close(); else { unring(); NyxCall.open(); } });
}
let ringText = '', ringBlink = 0;
function ring(text) {
  if (GROUP || callOpen()) return;
  ringText = String(text || '').trim() || (NAME + '想和你语音通话。');
  const r = $('ring'); r.querySelector('em').textContent = ringText; r.hidden = false; r.classList.remove('on'); void r.offsetWidth; r.classList.add('on');
  clearInterval(ringBlink); ringBlink = setInterval(() => { if (!document.hidden) blink(); }, 900);   // 眼睛眨得快一点
  loadCall();
}
function unring() { clearInterval(ringBlink); ringBlink = 0; const r = $('ring'); if (r) r.hidden = true; }
function pickUp() { const first = ringText; unring(); loadCall().then(okc => { if (!okc) { toast('通话没装上'); return; } NyxCall.open().then(() => { if (first) NyxCall.speak(first); }); }); }

/* ---------- 她存的表情和颜文字：同 lib/emo-plus.js 的存法。表情图在 IndexedDB「nyx-stickers」/kv/nyx_stickers（[{id, data}]），
   旧手机 localStorage 里有的先搬进去；都没有就从第一只的 /app/prefs 拉。颜文字在 localStorage「nyx_kaomoji」。
   存表情时同 emo-plus：写 IndexedDB，再把同步名单里的键加上表情推一份到第一只的 /app/prefs（Nyx 也这么推）。 ---------- */
const MSTK = 'nyx_stickers', MKAO = 'nyx_kaomoji';
/* 11/13 常用语：键 nyx_phrases（JSON 字符串数组，新的在前，最多 60 句，同一句再存挪到最前）；
   跟着 pushMine 上云。本机还没有这个键（null）时：先看第一只的 /app/prefs 里有没有，有就拉下来；没有就预置一句示例。?demo=1 只用内存里的三句。 */
const MPHR = 'nyx_phrases', PHR_MAX = 60, PHR_INIT = '这份代码库是你的：它的用途是什么、如何构建，由你来决定，并继续在此基础上开发。';
let demoPhr = ['今天先到这儿', '路上慢点，到了说一声', '这个我晚点再看'];
function loadPhr() {
  if (!LIVE) return demoPhr.slice();
  const raw = ls(MPHR); if (raw == null) return [PHR_INIT];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
function savePhr(a) {
  a = a.slice(0, PHR_MAX);
  if (!LIVE) { demoPhr = a; return true; }
  try { localStorage.setItem(MPHR, JSON.stringify(a)); localStorage.setItem('nyx_prefs_ts', String(Date.now())); } catch (e) { toast('没存上'); return false; }
  pushMine(); return true;
}
function initPhr() {   // 启动时一次：本机没有 → 云上有就拉，云上也没有就预置那一句
  if (!LIVE || ls(MPHR) != null) return;
  const seed = () => { try { if (ls(MPHR) == null) localStorage.setItem(MPHR, JSON.stringify([PHR_INIT])); } catch (e) {} };
  if (!ls('nyx_key')) { seed(); return; }
  hapi('/app/prefs').then(d => {
    const v = d && d.data && d.data[MPHR];
    if (v && ls(MPHR) == null) { try { const a = typeof v === 'string' ? JSON.parse(v) : v; if (Array.isArray(a)) { localStorage.setItem(MPHR, JSON.stringify(a.slice(0, PHR_MAX))); if (trayTab === 'phr') paintTray(); return; } } catch (e) {} }
    seed();
  }).catch(() => {});   // 连不上就先不写，下回再看；这期间盘里显示预置那句
}
const DUP = {}; ['1792815930377-m9nx', '1792123846755-8apf', '1792122098337-3ugq', '1791994592214-y9uy', '1791994498299-xshr', '1791865791807-q9mz', '1791621879870-ivum', '1791621419910-7oyn', '1791621079478-ptlt', '1791614199806-4s0r', '1791614122395-9x5s', '1791613169732-r7yj', '1791613169716-22sl', '1791613169683-l08m', '1791613169682-t6wf', '1791613169681-ox90', '1791613169681-b5mm', '1791613169680-6lra', '1791613169680-1dwi', '1791613169679-l5xz', '1791613169679-pvag'].forEach(i => { DUP[i] = 1; });
let mine = [], mineReady = false, IDB = null;
function idb() { return IDB || (IDB = new Promise((res, rej) => { const r = indexedDB.open('nyx-stickers', 1); r.onupgradeneeded = () => { r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }
function iget() { return idb().then(db => new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(MSTK); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); })).catch(() => null); }
function iput(v) { return idb().then(db => new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, MSTK); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); })); }
function setMine(v) { mineReady = true; try { const a = typeof v === 'string' ? JSON.parse(v) : v; mine = Array.isArray(a) ? a : []; } catch (e) { mine = []; } }
function hapi(path, opt) { return call(HOME, ls('nyx_key'), path, opt); }   // 家里的事（prefs）走第一只、nyx_key，同 Nyx
function loadMine() {
  const old = ls(MSTK);
  if (old) { setMine(old); iput(old).then(() => { try { localStorage.removeItem(MSTK); } catch (e) {} }).catch(() => {}); return Promise.resolve(); }
  return iget().then(v => { if (v) { setMine(v); return; } if (!ls('nyx_key')) { mineReady = true; return; }
    return hapi('/app/prefs').then(d => { const x = d && d.data && d.data[MSTK]; if (x) { setMine(x); iput(x).catch(() => {}); } else mineReady = true; }).catch(() => {}); });
}
let pushT = 0;
function pushMine() {
  clearTimeout(pushT); pushT = setTimeout(() => {
    const d = {}, ts = Date.now(), RE = /^nyx_(avatar|bg|cover|profile_remark|stickers|theme|todos|sound|deleted_ids|glass|phrases)/;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (RE.test(k)) d[k] = localStorage.getItem(k); } localStorage.setItem('nyx_prefs_ts', String(ts)); } catch (e) {}
    if (mineReady) d[MSTK] = JSON.stringify(mine);   // 表情还没载完时别拿空的盖掉云上那份（存常用语也会走这里）
    hapi('/app/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ts, data: d }) }).catch(() => {});
  }, 1500);
}
function saveMine(a) { if (!mineReady) { toast('表情还在加载，等一下再试'); return false; } mine = a.slice(); iput(JSON.stringify(mine)).then(() => { try { localStorage.removeItem(MSTK); } catch (e) {} }).catch(() => toast('没存上')); pushMine(); return true; }
function loadKao() { try { const a = JSON.parse(ls(MKAO) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveKao(a) { try { localStorage.setItem(MKAO, JSON.stringify(a)); localStorage.setItem('nyx_prefs_ts', String(Date.now())); return true; } catch (e) { toast('没存上'); return false; } }
const nid = () => Date.now() + '-' + Math.random().toString(36).slice(2, 6);
function keepSticker(im) {   // 同 emo-plus：点 AI 发的表情图 →「存到我的表情」
  if (!im || !im.src) return;
  fetch(im.currentSrc || im.src).then(r => r.blob()).then(bl => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(bl); }))
    .then(d => { if (mine.some(x => x.data === d)) { toast('已经存过啦'); return; } const a = mine.slice(); a.unshift({ id: nid(), data: d }); if (saveMine(a)) { paintTray(); toast('存好了'); } })
    .catch(() => toast('没存上'));
}
function shrink(f) {   // 从相册存：缩到 240，动图小于 400K 原样留（同 emo-plus）
  return new Promise(res => {
    if (f.type === 'image/gif' && f.size < 400 * 1024) { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); return; }
    const u = URL.createObjectURL(f), im = new Image();
    im.onload = () => { const k = Math.min(1, 240 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      let d = c.toDataURL('image/webp', 0.86); if (d.indexOf('data:image/webp') !== 0) d = c.toDataURL('image/png'); res(d); };
    im.onerror = () => { URL.revokeObjectURL(u); res(null); }; im.src = u;
  });
}
function sendMine(x) {   // 存的表情当图发：先传上去（名字 sticker-<id>），再单独发一条只带这张图的（同 emo-plus，side 一律日面）
  const parts = x.data.split(','), mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/png', bin = atob(parts[1]), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const name = 'sticker-' + x.id + '.' + (mime.split('/')[1] || 'png'), it = { name, file: new File([u8], name, { type: mime }), local: x.data, done: null };
  it.job = upload(it);
  const e = { t: 'pend', key: 'p' + (++pk), state: 'sending', items: [it], q: null, text: '', m: { id: '', from: 'human', text: '', ts: new Date().toISOString(), meta: { attachments: [{ kind: 'image', name, local: x.data }] } } };
  EPHS.push(e); redrawEph(e.key); toBottom(); flyBird(); firePend(e);
}
let trayTab = 'stk';
try { trayTab = sessionStorage.getItem('ta-tray') || 'stk'; } catch (e) {}
function paintTray() {
  const tr = $('tray');
  if (!LIVE && trayTab !== 'phr') trayTab = 'kao';
  const N = window.NYX || {}, names = (N.stickers && N.stickerList) || [], ms = mine.filter(x => !DUP[x.id]), kao = LIVE ? loadKao() : [];
  const tabs = LIVE ? [['mine', '我的'], ['kao', '颜文字'], ['phr', '常用语'], ['emo', 'emoji']] : [['kao', '颜文字'], ['phr', '常用语']];   // 贴纸那格不进公版（别人的 mcp）
  if (!tabs.some(t => t[0] === trayTab)) trayTab = tabs[0][0];
  let body = '';
  if (trayTab === 'phr') { const ph = loadPhr(); body = '<div class="phr"><button class="add" data-act="phr">＋ 把输入框里的字存成常用语</button>' + ph.map((t, i) => `<button data-phr="${i}" title="${esc(t)}">${esc(t)}</button>`).join('') + '</div>' + (ph.length ? '<p class="tip">点一句落进输入框，按住一句可以删</p>' : ''); }
  else if (trayTab === 'stk' && !LIVE) body = '<div class="stks demo">' + STKD.map(k => `<button data-s="${k}" aria-label="表情"><canvas class="sk" data-s="${k}" data-z="34"></canvas></button>`).join('') + '</div>';
  else if (trayTab === 'stk') body = '<div class="stks">' + names.map(n => `<button data-s="${esc(n)}" aria-label="${esc(n)}"><img class="stkimg" data-n="${encodeURIComponent(n)}" alt="${esc(n)}" src="${STICKERS + encodeURIComponent(n)}.png"></button>`).join('') + '</div>';
  else if (trayTab === 'mine') body = '<div class="stks"><button class="add" data-act="add" aria-label="从相册存表情">＋</button>' + ms.map(x => `<button data-stk="${esc(x.id)}"><img class="stkimg" src="${x.data}" alt=""></button>`).join('') + '</div>' + (ms.length ? '<p class="tip">按住一张可以删</p>' : '<p class="tip">点＋从相册存表情</p>');
  else if (trayTab === 'kao') body = '<div class="kao">' + kao.map((t, i) => `<button data-kao="${i}">${esc(t)}</button>`).join('') + '<button class="add" data-act="kao">＋颜文字</button></div><p class="tip">先在输入框里打好再点＋，按住一个可以删</p>';
  else body = '<div class="emos">' + EMO.map(e => `<button data-e="${e}">${e}</button>`).join('') + '</div>';
  tr.innerHTML = '<div class="tabs" role="tablist">' + tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${k === trayTab}"${k === trayTab ? ' class="on"' : ''}>${n}</button>`).join('') + '</div><div class="pane">' + body + '</div>';
  tr.querySelectorAll('img.stkimg[data-n]').forEach(stkFallback); tr.querySelectorAll('canvas.sk').forEach(drawSticker);
}
let trayPressed = false;
function insertAt(t) { const s = say.selectionStart != null ? say.selectionStart : say.value.length; say.value = say.value.slice(0, s) + t + say.value.slice(say.selectionEnd != null ? say.selectionEnd : s); grow(); saveDraft(); drawSend(); }
function trayClick(ev) {
  const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation();
  if (trayPressed) { trayPressed = false; return; }
  const tr = $('tray');
  if (b.dataset.tab) { trayTab = b.dataset.tab; try { sessionStorage.setItem('ta-tray', trayTab); } catch (e) {} paintTray(); return; }
  if (b.dataset.e) { insertAt(b.dataset.e); return; }
  if (b.dataset.s) { if (LIVE) sendLive('[sticker:' + b.dataset.s + ']'); else post('', { stk: b.dataset.s }); tr.hidden = true; return; }
  if (b.dataset.phr != null) { insertAt(loadPhr()[+b.dataset.phr] || ''); return; }   // 同颜文字：落在光标处，盘不收
  if (b.dataset.act === 'phr') {
    const t = say.value.trim(); if (!t) { toast('先把这句打在输入框里，再点＋'); return; }
    const a = loadPhr().filter(x => x !== t); a.unshift(t); if (savePhr(a)) { clearSay(); paintTray(); toast('存好了'); } return;
  }   // 同 Nyx：贴纸点一下就单独发出去
  if (b.dataset.kao != null) { insertAt(loadKao()[+b.dataset.kao] || ''); return; }
  if (b.dataset.stk) { const x = mine.find(y => y.id === b.dataset.stk); if (x) { tr.hidden = true; sendMine(x); } return; }
  if (b.dataset.act === 'add') { mineInput().click(); return; }
  if (b.dataset.act === 'kao') {
    let t = say.value.trim(); const fromBox = !!t;
    if (!t) t = (prompt('存一个颜文字（下次可以先打在输入框里，再点这里）') || '').trim();
    if (!t) return; const a = loadKao(); if (a.indexOf(t) >= 0) { toast('已经存过啦'); return; }
    a.push(t.slice(0, 40)); if (saveKao(a)) { if (fromBox) clearSay(); paintTray(); toast('存好了'); }
  }
}
let mineInp = null;
function mineInput() {
  if (mineInp) return mineInp;
  mineInp = document.createElement('input'); mineInp.type = 'file'; mineInp.accept = 'image/*'; mineInp.multiple = true; mineInp.hidden = true; document.body.appendChild(mineInp);
  mineInp.onchange = () => { const fs = Array.from(mineInp.files || []); mineInp.value = ''; const a = mine.slice();
    fs.reduce((pr, f) => pr.then(() => shrink(f).then(d => { if (d) a.unshift({ id: nid(), data: d }); })), Promise.resolve()).then(() => { if (saveMine(a)) paintTray(); }); };
  return mineInp;
}
function wireTrayPress(tr) {   // 按住删（同 emo-plus）
  let t = 0;
  tr.addEventListener('pointerdown', e => {
    const sb = e.target.closest('[data-stk]'), kb = e.target.closest('[data-kao]'), pb = e.target.closest('[data-phr]'); trayPressed = false; if (!sb && !kb && !pb) return;
    t = setTimeout(() => { trayPressed = true;
      if (kb && confirm('删掉这个颜文字？')) { const a = loadKao(); a.splice(+kb.dataset.kao, 1); saveKao(a); paintTray(); }
      if (pb && confirm('删掉这句常用语？')) { const a = loadPhr(); a.splice(+pb.dataset.phr, 1); savePhr(a); paintTray(); }
      if (sb && confirm('删掉这张表情？')) { saveMine(mine.filter(x => x.id !== sb.dataset.stk)); paintTray(); } }, 550);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => tr.addEventListener(k, () => clearTimeout(t)));
  tr.addEventListener('contextmenu', e => { if (e.target.closest('[data-stk],[data-kao],[data-phr]')) e.preventDefault(); });
}
window.addEventListener('storage', e => { if (e.key === MKAO || e.key === MPHR) paintTray(); });   // 别的页改了常用语，这边也跟着

/* ---------- 就地换人：点页眉名字（或顶栏联系人图标），页眉下展开一小列。数据同 Nyx 联系人页：localStorage「nyx_contacts」，
   醒着 / 睡着看那只的 /healthz（plugin_subs > 0），多久以前看 /app/status 的 last_msg_age_sec；第一只的 /g 有两位以上成员时多一行「一家」。
   点一个：照联系人页的 pick() 写回 Nyx 的选择（nyx_relay / nyx_chat_key / nyx_ai，点第一只就清掉并把钥匙写回 nyx_key），然后这页就地换过去。最底下一行「一起听」。 ---------- */
let rosterOn = false, roster = [];
const CNN = '零一二三四五六七八九';
function cn(n) { if (n < 10) return CNN[n]; if (n < 20) return '十' + (n % 10 ? CNN[n % 10] : ''); return CNN[Math.floor(n / 10)] + '十' + (n % 10 ? CNN[n % 10] : ''); }
function ago(sec) { if (sec == null) return ''; const m = Math.floor(sec / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return m < 1 ? '刚刚' : m < 60 ? cn(m) + '分钟前' : h < 24 ? cn(h) + '小时前' : d < 31 ? cn(d) + '天前' : '很久以前'; }
function sufOf(r) { const S = { '/relay': '', '/relay/g': '_group' }; return r in S ? S[r] : '_' + r.replace(/^\/relay-?/, '').replace(/\W+/g, '_'); }
function avOfContact(c) { if (c.avatar) return c.avatar; const v = ls('nyx_avatar' + sufOf(c.relay)); return v && (/^data:image\//.test(v) || /^\/(?!\/)/.test(v)) ? v : ''; }
function paintRoster() {
  const r = $('roster'); if (!r) return;
  r.innerHTML = roster.map((c, i) => { const av = avOfContact(c);
    return `<button data-i="${i}" class="${c.relay === RELAY ? 'cur' : ''}${c.off ? ' off' : ''}"><span class="av">${av ? `<img src="${esc(av)}" alt="">` : esc(Array.from(c.name || '?')[0])}</span><b>${esc(c.name || c.relay)}</b><i class="dot${c.off === false ? ' up' : ''}"></i><small>${c.off == null ? '…' : c.off ? '睡着了' : '醒着'}${c.ago ? ' · ' + esc(c.ago) : ''}</small></button>`; }).join('') +
    `<a class="lsn" href="listen.html"><svg viewBox="0 0 24 24" aria-hidden="true">${TOOLS_SVG.note}</svg><span>一起听</span>${listening ? '<small>在听</small>' : ''}</a>`;
}
function probeContact(c) {
  const base = c.relay.replace(/\/$/, '');
  fetch(base + '/healthz', { cache: 'no-store' }).then(r => r.json()).then(h => { c.off = !(h.plugin_subs > 0); if (h.members) c.members = h.members; }).catch(() => { c.off = true; }).then(paintRoster);
  const k = c.key || ls('nyx_key'); if (k) fetch(base + '/app/status', { headers: { Authorization: 'Bearer ' + k }, cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(s => { if (s) { c.ago = ago(s.last_msg_age_sec); paintRoster(); } }).catch(() => {});
}
function toggleRoster(on) {
  rosterOn = on == null ? !rosterOn : on; const r = $('roster');
  if (!rosterOn) { r.hidden = true; return; }
  const N = window.NYX || {}; let list = contactsList();
  if (!list.length) list = [{ name: N.aiName || 'Companion', relay: HOME, key: ls('nyx_key') || '' }];
  roster = list.map(c => Object.assign({}, c));
  const G = HOME + '/g';
  if (!roster.some(c => c.relay === G)) fetch(G + '/healthz', { cache: 'no-store' }).then(x => x.ok ? x.json() : null).then(h => { if (h && h.members && h.members.length >= 2 && rosterOn && !roster.some(c => c.relay === G)) { const g = { name: '一家', relay: G, key: ls('nyx_key'), group: true }; roster.unshift(g); probeContact(g); } }).catch(() => {});
  paintRoster(); r.hidden = false; r.classList.remove('on'); void r.offsetWidth; r.classList.add('on');
  roster.forEach(probeContact);
}
function pickContact(c) {   // 同 Nyx 联系人页的 pick()
  const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  if (c.relay === HOME) { set('nyx_relay', null); set('nyx_chat_key', null); set('nyx_ai', null); if (c.key) set('nyx_key', c.key); }
  else { set('nyx_relay', c.relay); set('nyx_chat_key', c.key || ls('nyx_key')); set('nyx_ai', c.name); }
  if (Q.has('relay')) { Q.delete('relay'); try { history.replaceState(null, '', location.pathname + (Q.toString() ? '?' + Q : '') + location.hash); } catch (e) {} }
  toggleRoster(false); switchTo();
}
function switchTo() {   // 不换页：断开流、清掉这一只的东西、按新的选择重新进门
  saveDraft();
  if (streamCtl) { const c = streamCtl; streamCtl = null; c.abort(); } clearTimeout(watchdog); clearTimeout(busyT);
  if (callOpen()) NyxCall.close(); unring(); endSel(); closePeek(); setQuote(null); if (gaugeOn) setGauge(false);
  clearTimeout(lineT); clearTimeout(carryT); Object.assign(SET, { line: null, ch: null, cc: null, dirtyL: 0, dirtyC: 0, eff: '', effNote: '', brain: '', brainNote: '', pushNote: '', sid: '' });   // 换了人，设置跟着重读
  MSGS.clear(); ORDER = []; EPHS.length = 0; lastId = 0; busy = null; meterData = null; meterTried = false; win = null; hasOlder = true; typingOn = false; gate = ''; online = false;
  document.body.classList.remove('gated'); $('note').hidden = true;
  say.value = ''; grow();
  resolve(); eyeBuilt = null; drawEye(1); paintKnot(); if (callLoaded) document.body.style.setProperty('--vc-av', 'url("' + String(AV || '').replace(/"/g, '%22') + '")'); paintTray(); renderAll('bottom'); loadDraft(); paintStatus();
  if (!KEY) { showGate('none'); return; }
  meterEarly();
  latest().then(all => { all.forEach(m => put(m, true)); hasOlder = all.length >= 200 || (ORDER.length && ORDER[0] > 1); renderAll('bottom'); openStream(); pollBusy(); },
    e => { if (e && e.auth) showGate('auth'); else { online = false; paintStatus(); } });
}

/* ---------- 一起听：Nyx 没有「正在一起听」的标记，这里自己判断：第一只的 GET /app/music/now 是在放（state=play、最近一刻钟换过歌），
   而且这台手机没把一起听关掉（music.html 的 music_together 不是 off、listen.html 的 nyx_listen_alone 不是 1）。是的话状态行末尾一个小音符。 ---------- */
let listening = false;
function pollListen() {
  if (!LIVE || !ls('nyx_key')) return;
  const alone = ls('music_together') === 'off' || ls('nyx_listen_alone') === '1';
  (GROUP ? hapi : api)('/app/music/now').then(n => /* 11/15：一起听报给聊天页当前这位，小音符也看这一位 */ { const t = n && n.ts ? Date.parse(n.ts) : 0; const on = !alone && !!n && n.state === 'play' && !!n.id && Date.now() - t < 15 * 60000;
    if (on !== listening) { listening = on; paintListen(); if (rosterOn) paintRoster(); } }).catch(() => {});
}
function paintListen() { let n = stEl.querySelector('.lsn'); if (!listening) { if (n) n.remove(); return; } if (!n) { n = document.createElement('i'); n.className = 'lsn'; n.title = '在一起听'; n.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${TOOLS_SVG.note}</svg>`; stEl.appendChild(n); } }
function goListen(a, ev) {   // 走纸面转场离开：蓝满月从点的地方涨满，再去 listen.html（那边从同一个圆心揭开）
  ev.preventDefault(); if (window.__leaving) return; window.__leaving = true;
  const rc = a.getBoundingClientRect(), x = rc.left + 12, y = rc.top + rc.height / 2, vw = innerWidth, vh = innerHeight, Rm = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) * 1.06, D = REDUCED ? 200 : 620;
  try { sessionStorage.setItem('ta-hand', JSON.stringify({ to: 'listen', t: Date.now(), x, y, c: C.INK, slot: 0, morph: dark ? 1 : 0 })); } catch (e) {}
  const cv = document.createElement('canvas'); cv.id = 'veil'; cv.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none'; document.body.appendChild(cv);
  const g = fitCanvas(cv, vw, vh), t0 = performance.now();
  const tick = now => { const p = clamp((now - t0) / D, 0, 1), e = smoother(p), r = 7 * Math.pow(Rm / 7, e);
    g.clearRect(0, 0, vw, vh); window.NP.iris(g, x, y, r, NP.sstep(0.05, 0.32, p) * Math.max(r * 0.86, r - 11), C.INK, vw, vh);
    if (p < 1) requestAnimationFrame(tick); else location.href = 'listen.html'; };
  requestAnimationFrame(tick);
}
window.addEventListener('pageshow', ev => { if (ev.persisted) { const v = document.getElementById('veil'); if (v && v.style.zIndex === '60') v.remove(); } });

/* ---------- 打码：照 Nyx 的 lib/mask.js，用同一个 sticker-mask（截图前往屏上贴东西盖住，拖、捏、转，点「完成」把手全消失，再系统截图；
   贴的东西只在这台手机内存里，不存不发）。这页的贴纸换成三样：纸色涂抹条、墨色细斜线、蓝色细斜线。 ---------- */
let maskInst = null, maskLoading = null;
function maskAssets() {
  const P = C.PAPER, I = C.INK, B = C.BLUE, svg = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  let gr = ''; const Rn = rng(5); for (let i = 0; i < 160; i++) gr += `<circle cx="${(Rn() * 300).toFixed(1)}" cy="${(6 + Rn() * 48).toFixed(1)}" r="${(0.3 + Rn() * 0.6).toFixed(2)}" fill="${Rn() < 0.6 ? '#9c9a94' : '#fffdf6'}" opacity="${(0.25 + Rn() * 0.4).toFixed(2)}"/>`;
  const smear = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60" width="300" height="60"><path d="M6 12 C40 4 90 9 150 6 S260 3 296 10 L294 50 C250 57 190 52 140 55 S40 58 4 49 Z" fill="${P}"/><path d="M6 12 C40 4 90 9 150 6 S260 3 296 10" fill="none" stroke="#d6d2c7" stroke-width=".8"/>${gr}</svg>`);
  let h1 = '', h2 = ''; for (let x = -80; x < 320; x += 5) { h1 += `<line x1="${x}" y1="80" x2="${x + 80}" y2="0"/>`; } for (let x = -60; x < 220; x += 5) { h2 += `<line x1="${x}" y1="60" x2="${x + 60}" y2="0"/>`; }
  const hatchI = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="300" height="80"><rect width="300" height="80" fill="${P}"/><g stroke="${I}" stroke-width=".7" opacity=".75">${h1}</g><rect x=".5" y=".5" width="299" height="79" fill="none" stroke="${I}" stroke-width=".6"/></svg>`);
  const hatchB = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="200" height="60" fill="${P}"/><g stroke="${B}" stroke-width=".7" opacity=".8">${h2}</g></svg>`);
  return { cats: [], items: [{ src: smear }, { src: hatchI }, { src: hatchB }] };
}
function loadMask() {
  if (maskLoading) return maskLoading;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/sticker-mask/sticker-mask.css'; document.head.appendChild(css);
  maskLoading = new Promise(ok => { const sc = document.createElement('script'); sc.src = 'lib/sticker-mask/sticker-mask.js'; sc.onload = () => ok(true); sc.onerror = () => ok(false); document.head.appendChild(sc); }).then(okm => {
    if (!okm || !window.StickerMask) return null;
    maskInst = StickerMask.create({ scroller: list, host: content, assets: maskAssets(), baseWidth: 120,
      sideTop: () => EYE_Y + 34, sideBottom: () => H - LINE_Y + 44 + SAYX,
      onEnter: () => { const b = document.querySelector('#tools [data-k="mask"]'); if (b) b.classList.add('on'); }, onExit: () => { const b = document.querySelector('#tools [data-k="mask"]'); if (b) b.classList.remove('on'); } });
    return maskInst;
  });
  return maskLoading;
}
function toggleMask() { loadMask().then(mk => { if (!mk) { toast('打码没装上'); return; } mk.toggle(); }); }

/* ---------- 这几样的节点和事件 ---------- */
(function v28() {
  const rg = document.createElement('div'); rg.id = 'ring'; rg.hidden = true; rg.setAttribute('role', 'alert');
  rg.innerHTML = '<b>来电</b><em></em><button data-a="yes">接</button><button data-a="no">不接</button>';
  rg.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation(); if (b.dataset.a === 'yes') pickUp(); else unring(); });
  content.appendChild(rg);
  const ro = document.createElement('div'); ro.id = 'roster'; ro.hidden = true; ro.setAttribute('aria-label', '联系人');
  ro.addEventListener('click', ev => { ev.stopPropagation(); const a = ev.target.closest('a.lsn'); if (a) { goListen(a, ev); return; } const b = ev.target.closest('button[data-i]'); if (!b) return; const c = roster[+b.dataset.i]; if (!c) return; if (c.relay === RELAY) { toggleRoster(false); return; } pickContact(c); });
  content.appendChild(ro);
  who.style.cursor = 'pointer'; who.style.zIndex = '6'; who.setAttribute('role', 'button');   // 名字压在消息区上面一层，不然被消息区（顶上是渐隐的透明段）挡住点不到
  who.setAttribute('aria-label', '换人');
  who.addEventListener('click', ev => { ev.stopPropagation(); if (LIVE) toggleRoster(); });
  stage.addEventListener('click', ev => { if (rosterOn && !ev.target.closest('#roster')) toggleRoster(false); });
  if (LIVE) { setInterval(pollListen, 60000); setTimeout(pollListen, 1500); }
})();
function placeV28() {
  const rg = $('ring'); if (rg) { rg.style.left = TX + 'px'; rg.style.width = COLW + 'px'; rg.style.top = (EYE_Y + 30) + 'px'; }
  const ro = $('roster'); if (ro) { ro.style.left = (LX + 30) + 'px'; ro.style.top = (EYE_Y + 24) + 'px'; ro.style.width = Math.round(Math.min(COLW * 0.82, 290)) + 'px'; }
}

/* ================= 11/12 群聊：@ 和置顶（照 Nyx 的 lib/group.js，接口和请求体原样）=================
   @：群里在输入框打 @ 或 ＠，输入线上方长出一小列成员读数（细线隔开的小字），点一个插入「@名字 」。
     @ 只是正文里的字：后台 nyx_group.py 按「@名字」「@所有人」认人，前端不多发字段。正文里的 @名字 画成蓝色小号字。
   置顶：一段文字，不绑消息 id，存在家里第一只：GET /app/group_pin → {text, at}；POST /app/group_pin {text} → {text, at}，text 空就是取消。
     点开一句那排里多「置顶」（拿这句的字去置顶）/「取消置顶」（这句就是置顶的那句时）。置顶条在页眉下、测绘线顶端：一枚图钉加一行字，
     点它跳到正文里同样字的那一句。群里才有；?demo=1 只在内存里，不发请求。 */
let pinT = '', atPos = -1;
const DEMO_PIN = '周六上午一起去买菜，九点楼下集合';
const DEMO_G = [   // [哪天（0 是今天）, 钟点, 谁（h 是我）, 话]
  [-1, '20:10', 'h', '周六上午一起去买菜，九点楼下集合'],
  [-1, '20:11', 'Clawd', '好，我带购物袋'],
  [-1, '20:12', 'Two', '我列个单子'],
  [-1, '20:15', 'h', '单子发群里'],
  [-1, '20:31', 'Two', '鸡蛋、青菜、一袋米、洗洁精'],
  [-1, '20:32', 'Two', '还有葱'],
  [-1, '20:40', 'Clawd', '米我来扛'],
  [-1, '21:02', 'h', '好'],
  [0, '18:40', 'Three', '楼下那家面馆今天开门了'],
  [0, '18:41', 'h', '晚上吃什么'],
  [0, '18:42', 'Clawd', '新开了一家粥铺'],
  [0, '18:42', 'Two', '粥喝不饱'],
  [0, '18:45', 'h', '@Two 那你说吃什么'],
  [0, '18:46', 'Two', '面，加个蛋'],
  [0, '18:46', 'Clawd', '那就粥和面各点一碗，谁先到谁点'],
  [0, '18:50', 'h', '@所有人 七点半楼下见，记得带伞'],
  [0, '18:51', 'Three', '带了'],
  [0, '18:51', 'Clawd', '伞放门口了'],
];
function buildDemoGroup() {
  NAME = '一家'; who.querySelector('b').textContent = NAME; document.title = NAME + ' · 来信'; pinT = DEMO_PIN;
  const d0 = new Date(); let id = 0;
  DEMO_G.forEach(r => {
    const d = new Date(d0); d.setDate(d.getDate() + r[0]); d.setHours(+r[1].slice(0, 2), +r[1].slice(3, 5), 0, 0); id++;
    const m = { id, from: r[2] === 'h' ? 'human' : 'ai', kind: r[2] === 'h' ? 'text' : 'reply', text: r[3], ts: d.toISOString(), meta: r[2] === 'h' ? {} : { speaker: r[2] } };
    MSGS.set(id, m); ORDER.push(id); emit(m, false);
  });
  takeSnap(); paintPin();
}
const atEl = document.createElement('div'); atEl.id = 'atpop'; atEl.hidden = true; atEl.setAttribute('role', 'listbox'); atEl.setAttribute('aria-label', '点谁的名'); bar.appendChild(atEl);
const gpinEl = document.createElement('button'); gpinEl.id = 'gpin'; gpinEl.type = 'button'; gpinEl.hidden = true; gpinEl.setAttribute('aria-label', '置顶，点一下跳到那句');
gpinEl.innerHTML = '<svg viewBox="0 0 10 12" aria-hidden="true"><path class="pf" d="M2.5 .8H5V7H1.6L3.4 5.4V2.2H2.5Z"/><path class="po" d="M2.5 .8H7.5V2.2H6.6V5.4L8.4 7H1.6L3.4 5.4V2.2H2.5Z"/><path class="pl" d="M5 0V12"/></svg><span class="t"></span>';
content.appendChild(gpinEl);
function pinOf(m) { return String((m && m.text) || '').trim().slice(0, 1000); }   // 同 group.js 的 pin(id)：拿这句的字（后台再 strip、截一千字）
function isPinned(m) { return !!(GROUP && pinT && pinOf(m) === pinT); }
function paintPin() {
  const on = !!(GROUP && pinT); gpinEl.hidden = !on;
  gpinEl.querySelector('.t').textContent = pinT.replace(/\s+/g, ' ');
  const was = document.body.classList.contains('pinned'); document.body.classList.toggle('pinned', on); placeGpin();
  if (was !== on && W) drawFine();
}
function placeGpin() {   // 图钉的针尖正落在测绘线的线头上，字跟正文左边对齐；有置顶时信的上沿往下让一点
  if (!W) return;
  const on = !gpinEl.hidden, top = EYE_Y + (on ? 40 : 32);   // 有置顶时测绘线晚一点起头，图钉钉在线头上
  gpinEl.style.left = (LX - 5) + 'px'; gpinEl.style.top = (top - 12) + 'px'; gpinEl.style.width = (TX + COLW - LX + 5) + 'px';
  gpinEl.querySelector('.t').style.marginLeft = (TX - LX + 5) + 'px';
  [survey, $('scrub')].forEach(e => { e.style.top = top + 'px'; e.style.height = (LINE_Y - top) + 'px'; });
  list.style.setProperty('--m0', (EYE_Y + (on ? 38 : 26)) + 'px'); list.style.setProperty('--m1', (EYE_Y + (on ? 58 : 48)) + 'px');
  rows.style.paddingTop = (EYE_Y + (on ? 54 : 44)) + 'px';
}
function loadPin() {
  if (!GROUP) { pinT = ''; paintPin(); return; }
  if (!LIVE) { paintPin(); return; }
  if (!ls('nyx_key')) return;
  hapi('/app/group_pin', { cache: 'no-store' }).then(d => { if (d) { pinT = String(d.text || ''); paintPin(); } }).catch(() => {});
}
function setPin(v) {
  const prev = pinT; pinT = v; paintPin(); toast(v ? '置顶了' : '取消了置顶');
  if (!LIVE) return;
  hapi('/app/group_pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: v }) })
    .then(d => { pinT = String((d && d.text) || ''); paintPin(); }, () => { pinT = prev; paintPin(); toast('置顶没存上'); });
}
function jumpPin() {
  if (!pinT) return;
  for (let j = META.length - 1; j >= 0; j--) { const x = META[j]; if (x && x.m && !x.aux && pinOf(x.m) === pinT) { closePeek(); jumpTo(j); return; } }
  toast('那句在更早的记录里');
}
gpinEl.addEventListener('click', ev => { ev.stopPropagation(); jumpPin(); });
function atClose() { atEl.hidden = true; atPos = -1; }
function atOpen(pos) {
  atPos = pos;
  atEl.innerHTML = GMEM.map(g => `<button type="button" role="option" data-n="${esc(g[0])}"><span>${esc(g[0])}</span>${g[1] ? `<small>${esc(g[1])}</small>` : ''}</button>`).join('');
  atEl.hidden = false; placeAt();
}
function placeAt() {   // 贴着输入线上方往上长；引用条、附件条在的时候再往上让
  if (!W) return;
  let up = LINE + SAYX + 10; const qc = $('qchip'), at = $('atts');
  if (qc && !qc.hidden) up += 26; if (at && !at.hidden) up += 24;
  atEl.style.left = TX + 'px'; atEl.style.bottom = up + 'px'; atEl.style.maxWidth = COLW + 'px';
}
function atPick(name) {   // 同 group.js 的 pick()
  const v = say.value, end = say.selectionStart;
  if (atPos < 0 || (v.charAt(atPos) !== '@' && v.charAt(atPos) !== '＠')) { atClose(); return; }
  const ins = '@' + name + ' ';
  say.value = v.slice(0, atPos) + ins + v.slice(end);
  const caret = atPos + ins.length; atClose(); say.focus({ preventScroll: true });
  try { say.setSelectionRange(caret, caret); } catch (e) {}
  say.dispatchEvent(new Event('input', { bubbles: true }));
}
say.addEventListener('input', ev => {
  if (!GROUP) { if (atPos >= 0) atClose(); return; }
  const p = say.selectionStart, ch = say.value.charAt(p - 1);
  if (ev.inputType && ev.inputType.indexOf('insert') === 0 && (ch === '@' || ch === '＠')) atOpen(p - 1);
  else if (atPos >= 0 && (p <= atPos || /\s/.test(say.value.slice(atPos, p)))) atClose();
});
atEl.addEventListener('pointerdown', ev => { const b = ev.target.closest('button[data-n]'); if (!b) return; ev.preventDefault(); atPick(b.dataset.n); });   // 按下就选，输入框不失焦、键盘不收
atEl.addEventListener('click', ev => ev.stopPropagation());
say.addEventListener('blur', () => setTimeout(atClose, 150));
say.addEventListener('keydown', ev => { if (ev.key === 'Escape' && atPos >= 0) atClose(); });
document.addEventListener('visibilitychange', () => { if (LIVE && !document.hidden && GROUP) loadPin(); });

/* ---------- 事件 ---------- */
say.addEventListener('input', () => { grow(); clearTimeout(saveT); saveT = setTimeout(saveDraft, 300); if (!flying) drawSend(); });
say.addEventListener('compositionstart', () => { composing = true; });
say.addEventListener('compositionend', () => { setTimeout(() => { composing = false; }, 0); });
say.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !touchInput && !composing && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); doSend(); } });   // 手机上回车就是换行（textarea 默认）
document.addEventListener('visibilitychange', () => { if (document.hidden) saveDraft(); });
window.addEventListener('pagehide', saveDraft);
send.addEventListener('pointerdown', e => { if (document.activeElement === say) e.preventDefault(); });   // 键盘开着点发送别收，收着别弹
send.addEventListener('click', () => { doSend(); });
$('emo').addEventListener('click', ev => { ev.stopPropagation(); const tr = $('tray'); tr.hidden = !tr.hidden; });
$('clip').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', ev => {
  if (LIVE) { if (ev.target.files && ev.target.files.length && KEY) pickFiles(ev.target.files); ev.target.value = ''; return; }
  const f = ev.target.files && ev.target.files[0]; if (f && /^image\//.test(f.type)) post('', { file: URL.createObjectURL(f) }); ev.target.value = '';   // 样子稿：只在本机看，不往外传
});
$('qchip').querySelector('button').addEventListener('click', () => setQuote(null));
$('menu').addEventListener('click', ev => { ev.stopPropagation(); dark = !dark; try { localStorage.setItem('ta_side', dark ? 'night' : 'day'); } catch (e) {} document.body.classList.toggle('dark', dark); layout(); if (stNow === 'think') drawCrab(); });
const info = homeInfo('chat', 0, dark ? 1 : 0);
$('back').addEventListener('click', () => leaveHome(info, $('back')));
backMoon($('back'));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });
setInterval(() => { if (!document.hidden) blink(); }, 7300);

/* v26 补的几个节点：附件条、提示行、多选栏、小提示，都挂在输入线和内容层上，不动原来的结构 */
(function extras() {
  const at = document.createElement('div'); at.id = 'atts'; at.hidden = true; bar.appendChild(at);
  at.addEventListener('click', ev => { const b = ev.target.closest('button[data-i]'); if (!b) return; ev.stopPropagation(); ATT.splice(+b.dataset.i, 1); paintAtts(); });
  const nt = document.createElement('div'); nt.id = 'note'; nt.hidden = true; bar.appendChild(nt);
  const sb = document.createElement('div'); sb.id = 'selbar'; sb.hidden = true; bar.appendChild(sb); sb.addEventListener('click', selClick);
  const ts = document.createElement('div'); ts.id = 'toast'; ts.setAttribute('role', 'status'); content.appendChild(ts);
  $('gauge').addEventListener('click', gaugeClick);
  if (LIVE) { const f = $('file'); f.removeAttribute('accept'); f.multiple = true; }   // 同 Nyx：什么文件都能带，一次能选几个
  buildTools();
})();

setupGrain(); build(); if (!LIVE) { buildTray(); loadDraft(); } buildGauge(); ensureTear(); setStatus(FIX || 'idle', null, LIVE ? '…' : ''); statusLoop(); if (INTRO) { content.classList.add('intro'); introOn = true; }
const ready = () => {
  layout(); list.scrollTop = list.scrollHeight;
  const op = Q.get('open'); if (op !== null) { const el = rows.querySelector(`[data-i="${op}"]`); if (el) { openPeek(el); const r = el.getBoundingClientRect(), lr = list.getBoundingClientRect(); list.scrollTop += r.top - lr.top - lr.height * 0.45; } }
  revealIn(info, stage, () => { window.__revealed = true; startIntro(); }); openEye(); window.__ready = true;
};
const fl = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
/* ---------- 点页眉那只眼睛，直接给这位换头像（中心裁方、压到 256，同 who.js pick）；眨一下，睁开是新的 ---------- */
(function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true; document.body.appendChild(inp);
  const eb = document.createElement('button'); eb.id = 'eyeB'; eb.type = 'button'; eb.setAttribute('aria-label', '换头像'); $('content').appendChild(eb);
  eb.style.left = eye.style.left; eb.style.top = eye.style.top;
  eb.addEventListener('click', e => { e.stopPropagation(); inp.click(); });
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const img = new Image();
      img.onload = () => {
        let out = r.result;
        try { const S = 256, side = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = S;
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
          x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S); out = c.toDataURL('image/jpeg', 0.88); } catch (e) {}
        const apply = () => { AV = out; eyeBuilt = null; drawEye(1); document.body.style.setProperty('--vc-av', 'url("' + out + '")'); };
        if (LIVE) { try { localStorage.setItem('nyx_avatar' + SUFX, out); } catch (e) { toast('图太大，没存上'); return; } pushMine(); }
        if (REDUCED) apply(); else { blink(); setTimeout(apply, 130); }
        toast('换好了');
      };
      img.onerror = () => toast('这张图打不开'); img.src = r.result; };
    r.readAsDataURL(f);
  };
})();
layout();
Promise.all([fl, LIVE ? startLive() : null]).then(ready);
window.__chat = { gauge: setGauge, send: t => { say.value = t; grow(); doSend(); }, layout, status: (k, secs) => { setStatus(k, secs); clearTimeout(stTimer); }, jump: jumpTo, intro: () => introOn, finishIntro, open: i => { const el = rows.querySelector(`[data-i="${i}"]`); if (el) openPeek(el); },
  live: LIVE, state: () => ({ relay: RELAY, name: NAME, n: ORDER.length, first: ORDER[0], last: ORDER[ORDER.length - 1], eph: EPHS.map(e => e.t + ':' + (e.state || e.kind)), st: stNow, label: stLabel, gate, online, older: hasOlder }), older: loadOlder, sel: startSel, gpin: () => pinT };
})();
