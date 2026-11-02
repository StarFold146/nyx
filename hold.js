/* Nyx — the hold: the engineering board and the heart, as sheets over any page (the hold: 底舱).
   Board: jot down bugs and ideas; the AI claims a ticket before it edits files and closes it after (relay/board.py).
   Heart: read-only — the persona and memory your companion lives by, and the relay code it runs on. Keys are blanked.
   NyxHold(api, names) → { board(), heart(), folder(app, open) }. api(path, opt) is the house relay call; names.chat is the one you're chatting with (old windows follow it). */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(ts) { var d = new Date(ts); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  window.NyxHold = function (api, names) {
    names = names || {};
    var ME = names.me || "Me";
    function sheet(title) {
      var el = document.createElement("div"); el.className = "hold"; el.hidden = true;
      el.innerHTML = '<div class="sheet" role="dialog"><div class="hh"><b></b><button type="button" class="x">Done</button></div><div class="hb"></div></div>';
      document.body.appendChild(el);
      var S = { el: el, head: el.querySelector(".hh b"), body: el.querySelector(".hb"),
        open: function () { el.hidden = false; }, close: function () { el.hidden = true; } };
      S.head.innerHTML = title;
      el.addEventListener("click", function (e) { if (e.target === el || e.target.closest(".x")) S.close(); });
      return S;
    }

    /* ---------- board ---------- */
    var ST = [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]], PRI = { p0: "P0", p1: "P1", p2: "P2" };
    var B = null, items = [], tab = "todo";
    function boardLoad() { return api("/app/board").then(function (d) { items = d.items || []; }).catch(function () { items = []; }).then(boardPaint); }
    function boardPaint() {
      var cnt = function (k) { return items.filter(function (x) { return x.status === k; }).length; };
      var shown = items.filter(function (x) { return x.status === tab; }).sort(function (a, b) { return a.pri.localeCompare(b.pri) || b.updated.localeCompare(a.updated); });
      B.body.innerHTML = '<div class="tabs">' + ST.map(function (s) { return '<button type="button" data-tab="' + s[0] + '"' + (tab === s[0] ? ' class="on"' : "") + ">" + s[1] + "<i>" + cnt(s[0]) + "</i></button>"; }).join("") + "</div>"
        + (shown.length ? shown.map(function (it) {
          return '<div class="tk" data-id="' + it.id + '"><div class="top"><span class="id">' + it.id + '</span><span class="pri ' + it.pri + '">' + PRI[it.pri] + "</span><span>" + it.size + " · " + esc(it.by) + " · " + fmt(it.ts) + "</span>"
            + '<span class="acts"><button type="button" data-act="pri">priority</button><button type="button" data-act="st">' + (it.status === "done" ? "reopen" : it.status === "doing" ? "finish" : "start") + '</button><button type="button" data-act="del">delete</button></span></div>'
            + '<div class="tt">' + esc(it.title) + "</div>"
            + (it.wait ? '<div class="tags"><span>waits for ' + esc(ME) + "</span></div>" : "")
            + (it.owner ? '<div class="who">' + esc(it.owner) + " on it</div>" : "")
            + (it.proof ? '<a class="proof" href="' + esc(it.proof) + '" target="_blank" rel="noopener">see what it looks like ›</a>' : "")
            + (it.files && it.files.length ? '<div class="files">editing: ' + it.files.map(esc).join(", ") + "</div>" : "")
            + (it.body ? '<div class="more">' + esc(it.body) + "</div>" : "")
            + '<div class="more row"><button type="button" data-act="wait">' + (it.wait ? "don't wait for me" : "wait for me") + "</button>"
            + (it.status === "done" ? '<button type="button" data-act="back">send back</button>' : "") + "</div>"
            + (it.log && it.log.length ? '<div class="more log">' + it.log.slice(-8).map(function (l) { return fmt(l.ts) + " " + esc(l.who) + ": " + esc(l.text); }).join("\n") + "</div>" : "")
            + "</div>";
        }).join("") : '<p class="none">' + (tab === "todo" ? "Nothing to do. Write down what comes to mind." : tab === "doing" ? "Nobody's at work right now." : "Nothing finished yet.") + "</p>")
        + '<form class="add"><input name="t" placeholder="A bug or an idea…" autocomplete="off"><textarea name="b" rows="2" placeholder="Details, how to make it happen (optional)"></textarea>'
        + '<div class="row"><select name="p"><option value="p0">P0 urgent</option><option value="p1" selected>P1</option><option value="p2">P2 whenever</option></select>'
        + '<select name="s"><option value="S">small</option><option value="M" selected>medium</option><option value="L">large</option></select>'
        + '<select name="w"><option value="">go ahead</option><option value="1">wait for me</option></select><button type="submit">Add</button></div></form>';
    }
    function board() {
      if (!B) {
        B = sheet('Yard <small>船坞</small>');   // the engineering board: where the hold's work gets done
        B.body.addEventListener("click", function (e) {
          var t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; boardPaint(); return; }
          var card = e.target.closest(".tk"); if (!card) return;
          var act = e.target.closest("[data-act]");
          if (!act) { card.classList.toggle("open"); return; }
          var it = items.find(function (x) { return x.id === card.dataset.id; }); if (!it) return;
          var body, a = act.dataset.act;
          if (a === "wait") body = { wait: !it.wait, who: ME };
          else if (a === "back") { var why = prompt("Send " + it.id + " back — what's wrong?", ""); if (why == null) return; body = { status: "todo", owner: "", who: ME, note: "sent back: " + (why || "no reason given") }; }
          else if (a === "del") { if (!confirm("Delete " + it.id + "?")) return; body = { delete: true }; }
          else if (a === "pri") body = { pri: { p0: "p1", p1: "p2", p2: "p0" }[it.pri], who: ME };
          else body = Object.assign({ status: it.status === "todo" ? "doing" : it.status === "doing" ? "done" : "todo", who: ME }, it.status === "todo" ? { owner: ME } : {});
          api("/app/board/" + it.id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(function () {}).then(boardLoad);
        });
        B.body.addEventListener("submit", function (e) {
          e.preventDefault(); var f = e.target, title = f.t.value.trim(); if (!title) return;
          api("/app/board", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title, body: f.b.value.trim(), pri: f.p.value, size: f.s.value, by: ME, wait: !!f.w.value }) })
            .then(function () { tab = "todo"; boardLoad(); }).catch(function () { alert("Didn't go through. Try again?"); });
        });
      }
      B.open(); boardPaint(); boardLoad();
    }

    /* ---------- heart ---------- */
    var H = null;
    function heartList() {
      H.head.innerHTML = 'Heart <small>心脏</small>'; H.body.innerHTML = '<p class="none">Reading…</p>';
      api("/app/heart").then(function (d) {
        H.body.innerHTML = (d.groups || []).map(function (g) {
          return '<div class="grp">' + esc(g.name) + "</div>" + g.files.map(function (f) {
            return '<button type="button" class="file" data-path="' + esc(f.path) + '">' + esc(f.path) + "<span>" + fmt(f.mtime) + " · " + (f.size > 1024 ? Math.round(f.size / 1024) + "K" : f.size + "B") + "</span></button>";
          }).join("");
        }).join("") || '<p class="none">Nothing here yet.</p>';
      }).catch(function () { H.body.innerHTML = '<p class="none">Couldn’t read it.</p>'; });
    }
    function heartOpen(path) {
      H.head.innerHTML = '<button type="button" class="bk">‹ Heart</button>'; H.body.innerHTML = '<p class="none">Reading…</p>';
      api("/app/heart/file?path=" + encodeURIComponent(path)).then(function (d) {
        H.body.innerHTML = '<div class="grp">' + esc(path) + ' · read-only</div><pre class="view' + (/\.md$/.test(path) ? " md" : "") + '">' + esc(d.text || "") + "</pre>";
        H.body.scrollTop = 0;
      }).catch(function () { H.body.innerHTML = '<p class="none">Couldn’t read it.</p>'; });
    }
    function heart() {
      if (!H) {
        H = sheet("");
        H.el.addEventListener("click", function (e) {
          if (e.target.closest(".bk")) { heartList(); return; }
          var f = e.target.closest(".file"); if (f) heartOpen(f.dataset.path);
        });
      }
      H.open(); heartList();
    }

    /* ---------- a folder of rooms (NYX.apps entry with apps: [...]) ---------- */
    var F = null;
    var ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"], CN = "一二三四五六七八九十";
    function folder(app, open) {   // a table of contents: an ink river down the left, a roman numeral per room on it; the room you went into last time is red
      if (!F) { F = sheet(""); F.el.classList.add("fold"); }
      var last = null; try { last = localStorage.getItem("nyx_room_" + app.id); } catch (e) {}
      F.head.innerHTML = esc(app.zh || app.en) + (app.zh ? " <small>" + esc(app.en) + "</small>" : "") + '<span class="cnt">' + (CN.charAt(app.apps.length - 1) || app.apps.length) + " 间</span>";
      F.body.innerHTML = '<div class="toc">' + app.apps.map(function (a, i) {
        return '<button type="button" class="it' + (a.id === last ? " cur" : "") + '" data-i="' + i + '"><span class="n">' + (ROMAN[i] || i + 1) + '</span><span class="tx"><b>' + esc(a.zh || a.en) + (a.zh ? "<small>" + esc(a.en) + "</small>" : "") + "</b>" + (a.d ? "<em>" + esc(a.d) + "</em>" : "") + '</span><span class="ar">›</span></button>';
      }).join("") + "</div>";
      F.body.onclick = function (e) { var b = e.target.closest("[data-i]"); if (!b) return; var r = app.apps[+b.dataset.i]; try { localStorage.setItem("nyx_room_" + app.id, r.id); } catch (e2) {} F.close(); open(r); };
      F.open();
    }

    /* ---------- old windows: every conversation with the companion here; tap one to go back to it ---------- */
    var Wn = null;
    function when(iso) { if (!iso) return ""; var d = new Date(iso), n = new Date(), hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      return (d.toDateString() === n.toDateString() ? "today " : (d.getMonth() + 1) + "/" + d.getDate() + " ") + hm; }
    function windows(after) {
      if (!Wn) Wn = sheet('Windows <small>窗口</small>');
      Wn.body.innerHTML = '<p class="none">Looking…</p>'; Wn.open();
      (names.chat || api)("/app/window/list").then(function (d) {
        var ws = d.windows || [];
        var known = ws.some(function (w) { return w.current; });
        Wn.body.innerHTML = (ws.length && !known ? '<p class="none">Can\u2019t tell which window is running right now, so none is marked.</p>' : "") + (ws.length ? ws.map(function (w, i) {
          return '<button type="button" class="file win' + (w.current ? " cur" : "") + '" data-i="' + i + '"><span class="wt">' + (w.current ? '<b class="now">● in use now</b> · ' : "") + "opened " + esc(when(w.started) || "–")
            + (w.messages != null ? " · " + w.messages + " messages" : "") + "</span><span>" + (w.usage_tokens ? Math.round(w.usage_tokens / 1000) + "k · " : "") + "last " + esc(when(w.last) || "just now") + "</span>"
            + '<span class="wx">' + esc((w.last_text || "(nothing said yet)").replace(/\s+/g, " ")) + "</span></button>";
        }).join("") : '<p class="none">No windows yet.</p>');
        Wn.body.onclick = function (e) {
          var b = e.target.closest("[data-i]"); if (!b) return; var w = ws[+b.dataset.i]; if (w.current) return;
          if (!confirm("Go back to the window opened " + when(w.started) + "? The one in use closes; you can come back to it here too.")) return;
          Wn.body.innerHTML = '<p class="none">Switching…</p>';
          (names.chat || api)("/app/window/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: w.sid }) })
            .then(function () { Wn.close(); if (after) setTimeout(after, 2500); }).catch(function (e) { Wn.body.innerHTML = '<p class="none">Didn\u2019t switch: ' + esc(e.message) + "</p>"; });
        };
      }).catch(function () { Wn.body.innerHTML = '<p class="none">Couldn\u2019t get the list.</p>'; });
    }

    /* ---------- memory, when there's none wired up yet: how to get one ---------- */
    var Mm = null;
    function memory() {
      if (!Mm) Mm = sheet('Memory <small>记忆</small>');
      Mm.body.innerHTML = '<div class="memo">'
        + "<p>There's no memory wired up here yet. Out of the box, your companion keeps notes in <code>~/companion/memory/</code> on the server (you can read them in the Heart). For a real memory, two layers:</p>"
        + '<p><b>1 · Ombre-Brain</b> — the memory itself: a store your companion writes to and recalls from by meaning, with feelings and time attached. '
        + 'By P0luz, MIT. <a href="https://github.com/P0luz/Ombre-Brain" target="_blank" rel="noopener">github.com/P0luz/Ombre-Brain</a></p>'
        + "<p><b>2 · Memory Galaxy</b> — a view on top of Ombre-Brain: the memories as a starfield you can wander. By baci on Xiaohongshu (小红书 baci老师), who has a video walking through the setup. Install Ombre-Brain first, then this.</p>"
        + "<p>Once it's running, put its address in <code>config.js</code> as <code>href</code> on the Memory entry, and this row opens it.</p>"
        + "<p class=\"zh\">还没接记忆。默认是写在服务器上的 <code>~/companion/memory/</code>（心脏里能看）。要真的记忆，分两层：先装 <b>Ombre-Brain</b>（记忆本身，P0luz，MIT），再在上面接<b>记忆星图</b>（小红书 baci老师 做的美化，有教学视频）。装好以后把地址写进 <code>config.js</code> 里 Memory 那一行的 <code>href</code>。</p></div>";
      Mm.open();
    }

    return { board: board, heart: heart, folder: folder, windows: windows, memory: memory };
  };
})();
