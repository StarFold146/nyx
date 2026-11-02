/* Thinking crab: a pixel Clawd sits on the top-left edge of the chat box and follows the status line under the name.
   Thinking: scratches its head · running a tool: both claws tap a keyboard · waiting for a yes at the terminal: holds
   up a question sign · window not open: sleeps · reply done: hops.
   Tap it for a small bubble: what it is doing now (the title of the status line) and which subagents are busy.
   It watches #state itself, so it needs nothing from app.js except window.NyxChat.api for GET /app/agents. */
(function () {
  "use strict";
  var foot = document.querySelector("#room .write");
  if (!foot) return;
  var s = document.createElement("style");
  s.textContent = ""
    + ".tcrab{position:absolute;left:calc(var(--pad,16px) + 4px);bottom:100%;width:44px;height:36px;z-index:5;cursor:pointer;-webkit-tap-highlight-color:transparent}"
    + ".tcrab svg{position:absolute;left:0;bottom:-2px;width:44px;height:34px;shape-rendering:crispEdges;overflow:visible;transform-origin:50% 100%}"
    + ".tcrab .bd{fill:#d97757}.tcrab .ey{fill:#1d1712}.tcrab .sg{fill:#f4ede2;stroke:#1d1712;stroke-width:.6}.tcrab .sq{fill:#1d1712}"
    + ".tcrab .ar,.tcrab .al,.tcrab .ee,.tcrab .sn{transform-box:fill-box;transform-origin:50% 50%}"
    + ".tcrab .sn{display:none}"
    + ".tcrab .bub{position:absolute;left:40px;bottom:34px;min-width:16px;padding:1px 6px;border-radius:9px;font:600 10px/16px ui-monospace,Menlo,monospace;color:#5a4636;background:rgba(255,250,242,.92);box-shadow:0 1px 3px rgba(0,0,0,.12);white-space:nowrap;opacity:0;transform:translateY(4px);transition:opacity .3s,transform .3s;pointer-events:none}"
    + ":root[data-side=\"moon\"] .tcrab .bub{color:#f0dccb;background:rgba(40,30,26,.88)}"
    + ".tcrab .bub.on{opacity:1;transform:none}"
    + ".tcrab .tip{max-width:62vw;overflow:hidden;text-overflow:ellipsis}"
    + ".tcrab .bub.list{width:max-content;max-width:62vw;white-space:pre-line;overflow:visible;line-height:15px;padding:3px 7px}"
    /* idle: slow breathing, an occasional blink */
    + ".tcrab svg{animation:tcB 3.2s ease-in-out infinite}"
    + "@keyframes tcB{50%{transform:scaleY(.96)}}"
    /* blink by swapping open and shut eyes, not by scaling: iOS Safari puts the SVG scale origin in the wrong place */
    + ".tcrab .open{animation:tcO 5s steps(1) infinite}.tcrab .shut{opacity:0;animation:tcC 5s steps(1) infinite}"
    + "@keyframes tcO{0%,94%,97%{opacity:1}95%{opacity:0}}@keyframes tcC{0%,94%,97%{opacity:0}95%{opacity:1}}"
    /* thinking: right claw up scratching the head, eyes glancing up */
    + ".tcrab .up{display:none}.tcrab.think .ar{display:none}.tcrab.think .up{display:inline;animation:tcS .32s steps(2) infinite}"
    + "@keyframes tcS{from{transform:translateX(0)}to{transform:translateX(-1px)}}"
    + ".tcrab.think .ee{transform:translate(1px,-1px)}"
    + ".tcrab.think svg{animation:tcR 1.8s ease-in-out infinite}"
    + "@keyframes tcR{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(4deg)}}"
    /* tool states change eyes, hat and keyboard so they read at a glance */
    + ".tcrab .ef,.tcrab .eh,.tcrab .kb,.tcrab .kl,.tcrab .kr,.tcrab .hh,.tcrab .nc{display:none}"
    + ".tcrab .yh{fill:#f2c230}.tcrab .yd{fill:#c9971c}.tcrab .kb{fill:#3b332d}.tcrab .kk{fill:#cfc4b4}.tcrab .nc{fill:#6d7fa8}.tcrab .np{fill:#f4ede2}"
    /* running a tool: claws take turns tapping */
    + ".tcrab.tool .al,.tcrab.tool .ar,.tcrab.tool .ee{display:none}"
    + ".tcrab.tool .ef,.tcrab.tool .kb,.tcrab.tool .kl,.tcrab.tool .kr,.tcrab.tool .hh{display:inline}"
    + ".tcrab.tool .kl{animation:tcT .2s steps(2) infinite}.tcrab.tool .kr{animation:tcT .2s steps(2) infinite reverse}"
    + "@keyframes tcT{from{transform:translateY(0)}to{transform:translateY(1.5px)}}"
    + ".tcrab.tool svg{animation:tcW .48s ease-in-out infinite}"
    + "@keyframes tcW{50%{transform:translateX(.6px)}}"
    /* waiting for a yes at the terminal: question sign, looking left and right */
    + ".tcrab.wait .sn{display:inline}.tcrab.wait .ar{display:none}"
    + ".tcrab .hat{display:none}.tcrab.wait .hat{display:inline}.tcrab .ht{fill:#5b4fa0}.tcrab .hb{fill:#252352}.tcrab .hs{fill:#efe3c2}"
    + ".tcrab.wait .ee{animation:tcL 2.4s steps(1) infinite}"
    + "@keyframes tcL{0%,100%{transform:translateX(-1px)}50%{transform:translateX(1px)}}"
    /* window not open: lies down, eyes shut */
    + ".tcrab.sleep svg{animation:tcZ 4s ease-in-out infinite;transform:translateY(2px) scaleY(.88)}"
    + "@keyframes tcZ{50%{transform:translateY(2px) scaleY(.84)}}"
    + ".tcrab.sleep .open{display:none}.tcrab.sleep .shut{opacity:1;animation:none}.tcrab.sleep .nc{display:inline}"
    /* reply done: a little hop */
    + ".tcrab.hop .ee{display:none}.tcrab.hop .eh{display:inline}"
    + ".tcrab.hop svg{animation:tcH .62s cubic-bezier(.3,.7,.4,1) 1}"
    + "@keyframes tcH{0%{transform:none}30%{transform:translateY(-9px) scaleY(1.06)}60%{transform:translateY(0) scaleY(.9)}80%{transform:translateY(-2px)}100%{transform:none}}"
    + "@media (prefers-reduced-motion:reduce){.tcrab *{animation:none!important}}";
  document.head.appendChild(s);

  // 18×14 grid: body, eyes, two claws, four legs; the question sign only shows while waiting
  var R = function (x, y, w, h, c) { return '<rect class="' + c + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>'; };
  var svg = '<svg viewBox="0 0 18 14" aria-hidden="true">'
    + R(2, 2, 14, 8, "bd")
    + '<g class="ee"><g class="open">' + R(5, 4, 1, 2, "ey") + R(12, 4, 1, 2, "ey") + '</g>'
    + '<g class="shut">' + R(4, 5, 2, 1, "ey") + R(12, 5, 2, 1, "ey") + '</g></g>'
    + '<g class="al">' + R(0, 5, 2, 2, "bd") + '</g>'
    + '<g class="ar">' + R(16, 5, 2, 2, "bd") + '</g>'
    // wizard hat while waiting for a yes
    + '<g class="hat">' + R(1, 1, 16, 1, "ht") + R(3, 0, 12, 1, "hb") + R(4, -1, 10, 1, "ht") + R(5, -2, 8, 1, "ht") + R(6, -3, 6, 1, "ht")
    + R(7, -4, 4, 1, "ht") + R(8, -5, 3, 1, "ht") + R(10, -6, 2, 1, "ht") + R(11, -7, 2, 1, "ht") + R(12, -6, 1, 1, "ht")
    + R(6, -2, .7, .7, "hs") + R(10, -3, .7, .7, "hs") + R(8, -4, .7, .7, "hs") + R(5, 0.15, .7, .7, "hs") + R(12, 0.15, .7, .7, "hs") + '</g>'
    // running a tool: squinting > <, yellow hard hat, claws on a keyboard
    + '<g class="ef">' + R(4, 4, 1, 1, "ey") + R(5, 5, 1, 1, "ey") + R(4, 6, 1, 1, "ey") + R(13, 4, 1, 1, "ey") + R(12, 5, 1, 1, "ey") + R(13, 6, 1, 1, "ey") + '</g>'
    + '<g class="hh">' + R(4, -1, 10, 1, "yh") + R(3, 0, 12, 2, "yh") + R(8, -1, 2, 3, "yd") + R(1, 2, 16, 1, "yd") + '</g>'
    + '<g class="kb">' + R(0, 10, 18, 3, "kb") + R(2, 11, 1, 1, "kk") + R(5, 11, 1, 1, "kk") + R(8, 11, 2, 1, "kk") + R(12, 11, 1, 1, "kk") + R(15, 11, 1, 1, "kk") + '</g>'
    + '<g class="kl">' + R(1, 7, 2, 3, "bd") + '</g><g class="kr">' + R(15, 7, 2, 3, "bd") + '</g>'
    // reply done: smiling eyes ^ ^
    + '<g class="eh">' + R(4, 5, 1, 1, "ey") + R(5, 4, 1, 1, "ey") + R(6, 5, 1, 1, "ey") + R(11, 5, 1, 1, "ey") + R(12, 4, 1, 1, "ey") + R(13, 5, 1, 1, "ey") + '</g>'
    // asleep: a floppy nightcap
    + '<g class="nc">' + R(3, 0, 11, 2, "nc") + R(5, -1, 8, 1, "nc") + R(13, 0, 3, 1, "nc") + R(15, 1, 2, 2, "nc") + R(17, 2, 1, 2, "nc") + R(17, 4, 2, 2, "np") + R(3, 1, 11, 1, "np") + '</g>'
    // the claw raised to scratch the head
    + '<g class="up">' + R(16, 3, 1, 3, "bd") + R(14, 0, 3, 2, "bd") + '</g>'
    + R(3, 10, 1, 3, "bd") + R(6, 10, 1, 3, "bd") + R(11, 10, 1, 3, "bd") + R(14, 10, 1, 3, "bd")
    + '<g class="sn">' + R(16, 3, 2, 3, "bd") + R(16.7, -2, .6, 5, "ey") + '<rect class="sg" x="14.2" y="-6.6" width="5.2" height="4.8" rx=".5"/>'
    + '<text x="16.8" y="-2.9" text-anchor="middle" font-size="4" font-weight="700" font-family="ui-monospace,monospace" class="sq">?</text></g>'
    + "</svg>";
  var el = document.createElement("div");
  el.className = "tcrab"; el.setAttribute("role", "img"); el.setAttribute("aria-label", "crab");
  el.innerHTML = svg + '<span class="bub"></span>';
  foot.appendChild(el);
  var bub = el.querySelector(".bub"), mode = "", hopT = 0, tipT = 0, dotT = 0, dots = 0, agentTap = 0;

  function bubble(txt, tip) {
    bub.textContent = txt; bub.classList.toggle("tip", !!tip); bub.classList.remove("list"); bub.classList.add("on");
  }
  function unbubble() { bub.classList.remove("on"); }
  function setMode(m) {
    if (m === mode) return;
    var was = mode; mode = m;
    el.classList.remove("think", "tool", "wait", "sleep");
    clearInterval(dotT); dotT = 0;
    if (m) el.classList.add(m);
    if (m === "think" || m === "tool") {
      dots = 0;
      var paint = function () { dots = dots % 3 + 1; if (!tipT) bubble((m === "tool" ? "⌨ " : "") + "•".repeat(dots)); };
      paint(); dotT = setInterval(paint, 450);
    } else if (m === "sleep") { if (!tipT) bubble("z"); }
    else if (!tipT) unbubble();
    // from working back to idle = a reply just went out: hop
    if (!m && (was === "think" || was === "tool")) {
      clearTimeout(hopT); el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop");
      hopT = setTimeout(function () { el.classList.remove("hop"); }, 700);
    }
  }
  // Read the status line: a turning star = working; text like "Bash · 12s" = running a tool, a word ending in "…" =
  // thinking; waiting for a yes / window not open come from the words
  var st = document.getElementById("state");
  function read() {
    var em = st && st.querySelector("em"); if (!em) return;
    var txt = em.textContent || "", sp = em.querySelector(".spin + span");
    if (em.querySelector(".spin")) setMode(sp && !/\u2026\s*$/.test(sp.textContent || "") ? "tool" : "think");
    else if (/waiting for a yes|\u7b49\u4f60|\u786e\u8ba4/.test(txt)) setMode("wait");
    else if (/isn't open|\u6ca1\u5f00/.test(txt)) setMode("sleep");
    else setMode("");
  }
  if (st) { new MutationObserver(read).observe(st, { childList: true, subtree: true, characterData: true }); read(); }
  el.addEventListener("click", function () {
    var st = document.getElementById("state");
    var t = (st && st.title) || (mode === "wait" ? "waiting for a yes at the terminal" : mode === "sleep" ? "the window isn't open, asleep" : mode ? "thinking" : "idle, waiting for you");
    var mine = ++agentTap;
    function hold(ms) { clearTimeout(tipT); tipT = setTimeout(function () { tipT = 0; var m = mode; mode = "x"; setMode(m); }, ms); }
    // one bubble says it all at once (status, then busy subagents); unchanged text is not repainted
    var shown = null;
    function show(list) {
      var on = (list || []).filter(function (a) { return a.status === "moving"; }), me = t.length > 34 ? t.slice(0, 33) + "\u2026" : t, txt;
      if (!list) txt = me;
      else if (on.length) {
        var lines = on.slice(0, 4).map(function (a) { return "· " + (a.description || "working quietly"); });
        if (on.length > 4) lines.push("· and " + (on.length - 4) + " more");
        txt = me + "\n" + on.length + (on.length === 1 ? " subagent busy\n" : " subagents busy\n") + lines.join("\n");
      } else txt = me + " · no subagents busy";
      if (txt === shown) return;
      var first = shown === null; shown = txt;
      bubble(txt, !on.length); if (on.length) bub.classList.add("list");
      if (first || on.length) hold(on.length ? 7000 : 2600);
    }
    show(agentList);
    fetchAgents().then(function (l) { if (mine === agentTap && l) show(l); });
  });
  var agentList = null;
  function fetchAgents() {
    if (!window.NyxChat || !window.NyxChat.api) return Promise.resolve(null);
    return window.NyxChat.api("/app/agents").then(function (d) { agentList = (d && d.agents) || []; return agentList; }, function () { return null; });
  }
  setInterval(function () { var r = document.getElementById("room"); if (!document.hidden && r && !r.hidden) fetchAgents(); }, 20000);
  setTimeout(fetchAgents, 2000);
})();
