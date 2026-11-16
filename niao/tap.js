/* 点触特效（祂）：指尖落下，一粒蓝点，外面一圈铅笔细线带四道小刻度散开，约半秒淡掉。
   用法：任何页面末尾 <script src="tap.js"></script> 即可；不拦事件、不挡点击（pointer-events:none）。
   深色：body 带 dark 类时线换成纸色。减少动态：只留蓝点淡出。localStorage niao_tap = "0" 可关。 */
(function () {
  try { if (localStorage.getItem('niao_tap') === '0') return; } catch (e) {}
  var NS = 'http://www.w3.org/2000/svg', BLUE = '#2238c0';
  var css = document.createElement('style');
  css.textContent =
    '.ntap{position:fixed;left:0;top:0;width:56px;height:56px;margin:-28px 0 0 -28px;pointer-events:none;z-index:2147483000;overflow:visible}' +
    '.ntap .d{transform-origin:28px 28px;animation:ntapD .5s ease-out forwards}' +
    '.ntap .r{transform-origin:28px 28px;animation:ntapR .55s cubic-bezier(.2,.7,.2,1) forwards}' +
    '.ntap .t{transform-origin:28px 28px;animation:ntapT .55s cubic-bezier(.2,.7,.2,1) forwards}' +
    '@keyframes ntapD{0%{transform:scale(.4);opacity:0}18%{transform:scale(1);opacity:1}60%{opacity:1}100%{transform:scale(.8);opacity:0}}' +
    '@keyframes ntapR{0%{transform:scale(.35);opacity:0}20%{opacity:.75}100%{transform:scale(1);opacity:0}}' +
    '@keyframes ntapT{0%{transform:scale(.5) rotate(-8deg);opacity:0}25%{opacity:.8}100%{transform:scale(1.12) rotate(0deg);opacity:0}}' +
    '@media (prefers-reduced-motion: reduce){.ntap .r,.ntap .t{display:none}.ntap .d{animation:ntapF .4s linear forwards}@keyframes ntapF{0%{opacity:1}100%{opacity:0}}}';
  document.head.appendChild(css);
  function mk(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function tap(x, y) {
    var ink = document.body.classList.contains('dark') ? '#e9e6dd' : '#3a3b40';
    var s = mk('svg', { 'class': 'ntap', viewBox: '0 0 56 56' });
    s.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    var r = mk('g', { 'class': 'r' });
    r.appendChild(mk('circle', { cx: 28, cy: 28, r: 17, fill: 'none', stroke: ink, 'stroke-width': .5 }));
    r.appendChild(mk('circle', { cx: 28, cy: 28, r: 21.5, fill: 'none', stroke: ink, 'stroke-width': .3, 'stroke-dasharray': '1.2 3.4' }));
    var t = mk('g', { 'class': 't' });
    [0, 90, 180, 270].forEach(function (a) { t.appendChild(mk('line', { x1: 28, y1: 3.5, x2: 28, y2: 9, stroke: ink, 'stroke-width': .5, transform: 'rotate(' + (a + 12) + ' 28 28)' })); });
    var d = mk('circle', { 'class': 'd', cx: 28, cy: 28, r: 2.6, fill: BLUE });
    s.appendChild(r); s.appendChild(t); s.appendChild(d);
    document.body.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
  }
  var last = 0;
  window.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    var now = Date.now(); if (now - last < 40) return; last = now;
    tap(ev.clientX, ev.clientY);
  }, { capture: true, passive: true });
})();
