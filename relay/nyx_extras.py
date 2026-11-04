"""Nyx extras for the Tidal Echo relay: the rooms the Nyx pages need beyond chat.

  Attic   GET  /app/attic · POST /app/attic/cat · POST /app/attic/item
  Listen  POST /app/music/<action> · GET|POST /app/music/now
  Clawd   POST /app/clawd                (only if ANTHROPIC_API_KEY is set)
  Usage   GET  /app/usage                (only if a status-line script saves Claude Code's JSON)
  Meter   GET  /app/meter · POST /app/meter   model, usage limits and context for the chat page's floating ball
  Model   GET  /app/model · POST /app/model   which model the companion should use
  Board   GET  /app/board · POST /app/board · POST /app/board/<id>   the engineering board (relay/board.py for the AI)
  Heart   GET  /app/heart · GET /app/heart/file?path=   read-only: the persona, the memory folder, the relay code
  Busy    GET  /app/busy · POST /app/busy   what the companion is doing right now: thinking, which tool for how long,
          or waiting for someone to say yes at the terminal (Claude Code: read off tmux; Codex: the bridge reports it)
  Kitchen GET  /app/kitchen · POST /app/kitchen/{pantry,ask,recipe,photo,photo/comment,log,cooked}
          your pots, seasonings and fridge; recipes your companion writes; what you ate, day by day
  Window  GET  /app/window · POST /app/window/{line,carry,compact,new,switch} · GET /app/window/list
          the context line (past it: save memory, then compact), compact now, a new window (it is handed the last
          hours of talk, word for word, up to a set length), go back to an old one.
          Claude Code: done here through tmux. Codex: the bridge picks the command up (GET/POST /app/window/cmd).
  Keys    GET  /app/keys · POST /app/keys · POST /app/keys/delete · GET /channel/keys   API keys for the companion's
          environment, set from the gauge so they never go through the chat (see nyx_keys.py)

Everything is optional: a room whose pieces aren't installed just answers 503.
Mounted from app.py with `nyx_extras.register(app, globals())`.

This file is part of the Nyx relay, a modified version of Tidal Echo, and is
licensed under the GNU AGPL v3 (see LICENSE and NOTICE in this folder).
"""
import asyncio
import fcntl
import json
import os
import re
import secrets
import shlex
import sqlite3
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, Request

# --- Listen: a tiny NetEase bridge on 127.0.0.1 (see docs/listen-netease.md) ---
NCM_DIR = Path(os.environ.get("RELAY_NCM_DIR", str(Path.home() / "ncm")))
NCM_PORT = int(os.environ.get("RELAY_NCM_PORT", "3020"))
NCM_URL = f"http://127.0.0.1:{NCM_PORT}"
NODE = os.environ.get("RELAY_NODE", "node")
MUSIC_ACTIONS = {   # page action -> (bridge endpoint, params the page may pass)
    "search":    ("cloudsearch",        {"keywords", "limit", "offset", "type"}),
    "playlists": ("user_playlist",      {"uid", "limit", "offset"}),
    "tracks":    ("playlist_track_all", {"id", "limit", "offset"}),
    "daily":     ("recommend_songs",    set()),
    "recent":    ("record_recent_song", {"limit"}),
    "url":       ("song_url_v1",        {"id", "level"}),
    "lyric":     ("lyric",              {"id"}),
    "detail":    ("song_detail",        {"ids"}),
    "me":        ("login_status",       set()),
}

# --- Clawd: a small quick model behind the crab's text box ---
CLAWD_MODEL = os.environ.get("RELAY_CLAWD_MODEL", "claude-sonnet-5-5")
CLAWD_PERSONA = os.environ.get("RELAY_CLAWD_PERSONA", (
    "You are Clawd, a small pixel crab who lives on the home page of a chat app. "
    "Answer in one to three short sentences, warm and a little dry. You can point the user to the rooms on the page."))

# --- Usage: where a Claude Code status-line script drops its JSON (see relay/README.md) ---
USAGE_FILE = Path(os.environ.get("RELAY_USAGE_FILE", str(Path.home() / ".claude" / "usage" / "latest.json")))

# --- Model: the companion's model, picked from the floating ball ---
# --- Heart: the companion's folder (persona + memory/) and this code, shown read-only ---
COMPANION_DIR = Path(os.environ.get("RELAY_COMPANION_DIR", str(Path.home() / "companion")))
NYX_DIR = Path(__file__).resolve().parent.parent
HEART_REDACT = re.compile(r"((?:sk|ghp|gho|xox[bp]|AIza)[-_A-Za-z0-9]{12,})|((?:SECRET|TOKEN|PASSWORD|API_KEY)\s*=\s*)(\S+)")

# --- Window: the Claude Code session in tmux, and how to start it again (the systemd unit's ExecStart) ---
TMUX = os.environ.get("RELAY_TMUX_SESSION", "companion")
COMPANION_UNIT = Path(os.environ.get("RELAY_COMPANION_UNIT", "/etc/systemd/system/nyx-companion.service"))
CLAUDE_PROJECT = Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(COMPANION_DIR))
QUIET_SEC = 45          # after the memory note, compact once the AI has answered and been quiet this long
WATCH_LOCK = Path(os.environ.get("RELAY_WATCH_LOCK", "/tmp/window-watch.lock"))   # held while the window restarts, so a window watcher sharing this flock can't start a second one
STARTUP_PROMPT = "Teach auto mode about your environment"
MODEL_SET_MARK = "Set model to"   # what Claude Code prints once /model has taken
START_ENV_KEYS = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"}   # all a window gets from the relay: its secrets stay here, and could otherwise reach a tmux server this start brings up
PROMPT_MARKS = ("Esc to cancel", "Enter to confirm", "Do you want", "\u276f 1.")   # a box is waiting: typing would answer it

CLAUDE_MODELS = os.environ.get("RELAY_MODEL_OPTIONS",
                               "claude-opus-5-5:Opus 5.5,claude-sonnet-5-5:Sonnet 5.5,claude-haiku-5-5:Haiku 5.5")


def live_session_meta(tmux_name):
    """sessions/<pid>.json of the Claude Code process running in a tmux session. A dead process can leave its file
    behind, so only live ones count, newest first."""
    best = {}
    for meta in (Path.home() / ".claude" / "sessions").glob("*.json"):
        try:
            d = json.loads(meta.read_text())
        except Exception:
            continue
        if str(d.get("tmux", "")).split(":")[0] != tmux_name or not d.get("sessionId"):
            continue
        try:
            os.kill(int(d.get("pid") or meta.stem), 0)
        except PermissionError:
            pass
        except (OSError, ValueError):
            continue
        if not best or (d.get("startedAt") or 0) > (best.get("startedAt") or 0):
            best = d
    return best


KEYS_FILE = None   # set in register(): the keys file a new window is told about (nyx_keys.py, start-channel.sh)


def window_env(path=None, resume=""):
    env = {k: v for k, v in os.environ.items() if k in START_ENV_KEYS or k.startswith("LC_")}
    if KEYS_FILE:
        env["NYX_KEYS_FILE"] = str(KEYS_FILE)
    return dict(env, **({"PATH": path} if path else {}), **({"NYX_RESUME": resume} if resume else {}))


def input_box_showing(pane):
    """A confirmation box replaces the ── ❯ ── input box; the marks alone can just be scrolled-by text."""
    lines = [l for l in (pane or "").rstrip().splitlines() if l.strip()]
    return any(lines[i].startswith("───") and lines[i + 1].startswith("❯") and lines[i + 2].startswith("───")
               for i in range(max(0, len(lines) - 20), len(lines) - 2))


def register(app, g):
    import nyx_town   # the memory town: /app/memtown*
    nyx_town.register(app, g)
    import nyx_group   # the group chat: /g on the first companion's relay, /channel/inject on every relay
    nyx_group.register(app, g)
    import nyx_keys   # keys for the companion's environment: /app/keys, /channel/keys
    nyx_keys.register(app, g)
    global KEYS_FILE
    KEYS_FILE = nyx_keys.keys_file(g)
    check_auth, broadcast, now_iso = g["check_auth"], g["broadcast"], g["now_iso"]
    plugin_subs, human = g["plugin_subs"], g["HUMAN_NAME"]
    upload_dir, clean_filename = g["UPLOAD_DIR"], g["clean_filename"]
    attic_file = Path(g["DB_PATH"]).parent / "attic.json"

    # ---- Attic: categories and notes for uploaded pictures (files go through /app/upload) ----
    def load():
        try:
            d = json.loads(attic_file.read_text(encoding="utf-8"))
        except Exception:
            d = {}
        d.setdefault("cats", []); d.setdefault("items", [])
        return d

    def save(d):
        tmp = attic_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(attic_file)

    def fname(x):
        return clean_filename(str(x or "").split("/")[-1].split("?")[0])

    @app.get("/app/attic")
    async def attic_get(request: Request):
        check_auth(request)
        return load()

    @app.post("/app/attic/cat")
    async def attic_cat(request: Request):
        """{op: add, name} · {op: rename, id, name} · {op: del, id} (pictures go back to unsorted) · {op: order, ids}"""
        check_auth(request)
        b = await request.json()
        op, d = str(b.get("op") or ""), load()
        name, cid = str(b.get("name") or "").strip()[:40], str(b.get("id") or "")
        if op == "add":
            if not name:
                raise HTTPException(status_code=400, detail="no name")
            c = {"id": secrets.token_hex(4), "name": name, "at": now_iso()}
            d["cats"].append(c); save(d)
            return {"ok": True, "cat": c}
        if op == "rename":
            for c in d["cats"]:
                if c["id"] == cid and name:
                    c["name"] = name; save(d)
                    return {"ok": True}
            raise HTTPException(status_code=404, detail="no such category")
        if op == "del":
            d["cats"] = [c for c in d["cats"] if c["id"] != cid]
            for it in d["items"]:
                if it.get("cat") == cid:
                    it["cat"] = ""
            save(d)
            return {"ok": True}
        if op == "order":
            ids = [str(x) for x in (b.get("ids") or [])]
            d["cats"].sort(key=lambda c: ids.index(c["id"]) if c["id"] in ids else 999)
            save(d)
            return {"ok": True}
        raise HTTPException(status_code=400, detail="bad op")

    @app.post("/app/attic/item")
    async def attic_item(request: Request):
        """{op: add|move, files, cat} · {op: del, files} · {op: note, file, note} · {op: pick, file, who, on}"""
        check_auth(request)
        b = await request.json()
        op, d = str(b.get("op") or ""), load()
        files = [fname(f) for f in (b.get("files") or [])][:200]
        cat = str(b.get("cat") or "")
        if cat and not any(c["id"] == cat for c in d["cats"]):
            cat = ""
        if op == "add":
            have = {it["file"] for it in d["items"]}
            for f in files:
                if f and f not in have and (upload_dir / f).is_file():
                    d["items"].append({"file": f, "cat": cat, "note": "", "at": now_iso()})
            save(d)
            return {"ok": True, "n": len(d["items"])}
        if op in ("move", "del"):
            fs = set(files)
            if op == "move":
                for it in d["items"]:
                    if it["file"] in fs:
                        it["cat"] = cat
            else:
                d["items"] = [it for it in d["items"] if it["file"] not in fs]
            save(d)
            return {"ok": True}
        f = fname(b.get("file"))
        for it in d["items"]:
            if it["file"] != f:
                continue
            if op == "note":
                it["note"] = str(b.get("note") or "")[:500]
            elif op == "pick":
                who = str(b.get("who") or "")[:20]
                picks = [p for p in (it.get("picks") or []) if p != who]
                if b.get("on", True) and who:
                    picks.append(who)
                it["picks"] = picks
            else:
                raise HTTPException(status_code=400, detail="bad op")
            save(d)
            return {"ok": True}
        raise HTTPException(status_code=404, detail="no such picture")

    # ---- Listen: proxy to the NetEase bridge; tell the AI what's on ----
    state = {"proc": None, "now": {"id": None, "name": "", "artist": "", "state": "", "ts": None}}

    async def ensure_ncm(client):
        try:
            await client.get(f"{NCM_URL}/ping", timeout=2)
            return
        except Exception:
            pass
        if not (NCM_DIR / "server.js").is_file():
            raise HTTPException(status_code=503, detail="NetEase bridge not installed (docs/listen-netease.md)")
        p = state["proc"]
        if p is None or p.poll() is not None:
            state["proc"] = subprocess.Popen([NODE, str(NCM_DIR / "server.js")], cwd=str(NCM_DIR),
                                             env={**os.environ, "NCM_PORT": str(NCM_PORT)},
                                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(30):
            await asyncio.sleep(0.3)
            try:
                await client.get(f"{NCM_URL}/ping", timeout=2)
                return
            except Exception:
                continue
        raise HTTPException(status_code=502, detail="NetEase bridge didn't start")

    @app.get("/app/music/now")
    async def music_now_get(request: Request):
        check_auth(request)
        return state["now"]

    @app.post("/app/music/now")
    async def music_now(request: Request):
        """The player reports a song change. With `together` on, the AI hears about it once per song."""
        check_auth(request)
        b = await request.json()
        now, sid = state["now"], b.get("id")
        changed = sid and (str(sid) != str(now["id"]) or b.get("force"))
        now.update({"id": sid, "name": b.get("name", ""), "artist": b.get("artist", ""),
                    "state": b.get("state", "play"), "ts": datetime.now(timezone.utc).isoformat()})
        if changed and b.get("together"):
            await broadcast(plugin_subs, {
                "content": (f"(Listening together — not typed by {human}.) {human} is playing "
                            f"《{now['name']}》 - {now['artist']}, NetEase song id {sid}. "
                            "Say a line or two if you like; no reply is fine too."),
                "user": "listen", "ts": now_iso(), "attachments": [],
            })
        return {"ok": True}

    @app.post("/app/music/{action}")
    async def music_call(request: Request, action: str):
        check_auth(request)
        if action not in MUSIC_ACTIONS:
            raise HTTPException(status_code=404, detail="unknown action")
        import httpx
        name, allowed = MUSIC_ACTIONS[action]
        try:
            body = await request.json()
        except Exception:
            body = {}
        params = {k: v for k, v in (body or {}).items() if k in allowed}
        async with httpx.AsyncClient() as client:
            await ensure_ncm(client)
            r = await client.post(f"{NCM_URL}/{name}", json=params, timeout=20)
        data = r.json()
        if action == "url":   # an https page can't play http audio on iOS
            for d in data.get("data") or []:
                if (d.get("url") or "").startswith("http://"):
                    d["url"] = "https://" + d["url"][7:]
        return data

    # ---- Clawd: the crab on the home page ----
    @app.post("/app/clawd")
    async def clawd(request: Request):
        check_auth(request)
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise HTTPException(status_code=503, detail="Clawd needs ANTHROPIC_API_KEY on the relay")
        try:
            from anthropic import AsyncAnthropic
        except ImportError:
            raise HTTPException(status_code=503, detail="pip install anthropic")
        b = await request.json()
        msgs = [{"role": m["role"], "content": str(m["content"])[:2000]} for m in (b.get("history") or [])
                if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")]
        if not msgs or msgs[-1]["role"] != "user":
            msgs.append({"role": "user", "content": str(b.get("text") or "")[:2000]})
        system = CLAWD_PERSONA + (" It's the night side now: lower your voice." if b.get("side") == "moon" else "")
        r = await AsyncAnthropic().messages.create(model=CLAWD_MODEL, max_tokens=300, system=system, messages=msgs[-12:])
        return {"reply": "".join(x.text for x in r.content if x.type == "text")}

    # ---- Meter + model: what the floating ball on the chat page shows ----
    data_dir = Path(g["DB_PATH"]).parent
    meter_file, model_file = data_dir / "meter.json", data_dir / "model"

    def claude_meter():
        try:
            d = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return None
        rl, cw, m = d.get("rate_limits") or {}, d.get("context_window") or {}, d.get("model") or {}
        labels = {"five_hour": "5h", "seven_day": "week"}
        return {
            "backend": "claude",
            "model": {"id": m.get("id"), "name": m.get("display_name") or m.get("id")},
            "limits": [{"key": k, "label": labels[k], "used": rl[k].get("used_percentage"),
                        "resets_at": rl[k].get("resets_at")} for k in labels if isinstance(rl.get(k), dict)],
            "context": {"used_pct": cw.get("used_percentage"), "size": cw.get("context_window_size")} if cw else None,
            "models": [{"id": a, "name": b} for a, _, b in (x.partition(":") for x in CLAUDE_MODELS.split(",")) if a],
            "model_applies": "live",
            "ts": time.time(),
        }

    def current_meter():
        try:
            m = json.loads(meter_file.read_text(encoding="utf-8"))
            if time.time() - float(m.get("ts") or 0) < 3 * 86400:
                return m
        except Exception:
            pass
        return claude_meter()

    window_ctx_size = {}   # sid -> context size, remembered from the turns where the shared usage file was this window's

    def window_model():
        """(model id, unix time) of this window's last real reply, from its own transcript."""
        m = session_meta()
        if not m:
            return "", 0
        f = CLAUDE_PROJECT / f"{m['sessionId']}.jsonl"
        try:
            with f.open("rb") as fh:
                fh.seek(max(0, f.stat().st_size - 600_000))
                lines = fh.read().decode("utf-8", "ignore").splitlines()
        except OSError:
            return "", 0
        for line in reversed(lines):
            if '"assistant"' not in line or '"model"' not in line:
                continue
            try:
                d = json.loads(line)
                mid = d["message"]["model"]
                if d.get("type") != "assistant" or d.get("isSidechain") or not mid or mid.startswith("<"):
                    continue
                return mid, datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00")).timestamp()
            except (KeyError, TypeError, ValueError, AttributeError):
                continue
        return "", 0

    def window_meter(m):
        """The usage file is shared by every window on the machine: whoever refreshed last. The limits are the account's,
        so they can stay; the model and context have to be this window's own."""
        u = claude_usage()
        sid = u.get("sid") or ""
        mid, at = window_model()
        try:   # a confirmed pick is written here, and can be newer than the last reply
            if model_file.stat().st_mtime > at and (at or not mid):
                mid = model_file.read_text(encoding="utf-8").strip() or mid
        except OSError:
            pass
        names = {x["id"]: x["name"] for x in m.get("models") or []}
        m["model"] = {"id": mid or None, "name": names.get(mid) or mid or None}
        try:
            shared = json.loads(USAGE_FILE.read_text(encoding="utf-8"))
            if sid and shared.get("session_id") == sid:
                window_ctx_size[sid] = (shared.get("context_window") or {}).get("context_window_size")
        except (OSError, ValueError):
            pass
        size, used = window_ctx_size.get(sid), u.get("used")
        m["context"] = {"used_pct": round(used * 100 / size, 1), "size": size} if size and used else None
        return m

    # ---- subagents: what the window's Agent-tool helpers are up to (tap the chat crab or the home Clawd) ----
    # A helper counts as moving if its transcript changed in the last three minutes; an estimate, not a signal.
    def agents_now():
        sid = str(live_session_meta(TMUX).get("sessionId") or "")
        if not re.fullmatch(r"[0-9a-f-]{36}", sid):
            return []
        now, out = time.time(), []
        for meta in (CLAUDE_PROJECT / sid / "subagents").glob("agent-*.meta.json"):
            log = meta.with_name(meta.name[:-len(".meta.json")] + ".jsonl")
            try:
                last = log.stat().st_mtime
                if now - last > 86400:
                    continue
                desc = str(json.loads(meta.read_text()).get("description") or "")[:80]
                started = meta.stat().st_mtime
            except (OSError, ValueError):
                continue
            out.append({"description": desc, "status": "moving" if now - last < 180 else "stopped",
                        "last_active": datetime.fromtimestamp(last, timezone.utc).isoformat(),
                        "started_at": datetime.fromtimestamp(started, timezone.utc).isoformat()})
        out.sort(key=lambda a: a["last_active"], reverse=True)
        return out[:20]

    @app.get("/app/agents")
    async def agents_list(request: Request):
        check_auth(request)
        return {"agents": await asyncio.to_thread(agents_now)}

    @app.get("/app/meter")
    async def meter_get(request: Request):
        check_auth(request)
        m = current_meter()
        if not m:
            raise HTTPException(status_code=503, detail="nothing reported yet")
        if m.get("model_applies") == "live":
            m = await asyncio.to_thread(window_meter, m)
        try:
            m["chosen"] = model_file.read_text(encoding="utf-8").strip() or None
        except Exception:
            m["chosen"] = None
        return m

    @app.post("/app/meter")
    async def meter_post(request: Request):
        """A bridge (e.g. bridge/codex_bridge.py) reports its model, limits and context."""
        check_auth(request)
        b = await request.json()
        b["ts"] = time.time()
        tmp = meter_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(b, ensure_ascii=False), encoding="utf-8"); tmp.replace(meter_file)
        return {"ok": True}

    @app.get("/app/model")
    async def model_get(request: Request):
        check_auth(request)
        try:
            return {"model": model_file.read_text(encoding="utf-8").strip() or None}
        except Exception:
            return {"model": None}

    @app.post("/app/model")
    async def model_post(request: Request):
        """{model: "<id>"} — a bridge picks it up on the next message. Claude Code: typed into the running window, 409 when
        it's not idle, and then nothing is written. confirmed is true only when the window printed its own confirmation."""
        check_auth(request)
        b = await request.json()
        mid = str(b.get("model") or "").strip()[:80]
        if backend() == "codex":
            if mid and not all(c.isalnum() or c in "-._:/" for c in mid):
                raise HTTPException(status_code=400, detail="bad model id")
            model_file.write_text(mid, encoding="utf-8")
            return {"ok": True, "model": mid or None}
        if mid not in {x.partition(":")[0] for x in CLAUDE_MODELS.split(",")}:
            raise HTTPException(status_code=400, detail="bad model id")
        st = await asyncio.to_thread(claude_busy)
        pane = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
        if st.get("state") != "idle" or pane.returncode != 0 or not input_box_showing(pane.stdout):
            raise HTTPException(status_code=409, detail=st.get("state") or "busy")
        seen = pane.stdout.count(MODEL_SET_MARK)
        proc = await asyncio.to_thread(tmux, "send-keys", "-t", TMUX, "C-u", "/model " + mid, "Enter")
        if proc.returncode != 0:
            raise HTTPException(status_code=502, detail="couldn't reach the window")
        confirmed = False
        for _ in range(10):
            await asyncio.sleep(0.5)
            now = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
            if now.returncode == 0 and now.stdout.count(MODEL_SET_MARK) > seen:
                confirmed = True
                break
        if confirmed:   # the next start reads this file; an unconfirmed pick must not be what it finds
            model_file.write_text(mid, encoding="utf-8")
        return {"ok": True, "model": mid, "applied": True, "confirmed": confirmed}

    # ---- Usage: Claude Code's 5-hour / weekly limits, as saved by a status-line script ----
    @app.get("/app/usage")
    async def usage(request: Request):
        check_auth(request)
        try:
            rl = json.loads(USAGE_FILE.read_text(encoding="utf-8")).get("rate_limits") or {}
        except Exception:
            raise HTTPException(status_code=503, detail="no status-line data yet")
        return {k: {"used": rl[k].get("used_percentage"), "resets_at": rl[k].get("resets_at")}
                for k in ("five_hour", "seven_day") if isinstance(rl.get(k), dict)}

    # ---- Board: tickets you jot down; the AI claims one before it edits files and closes it after ----
    board_file, board_lock = Path(os.environ.get("RELAY_BOARD_FILE") or data_dir / "board.json"), asyncio.Lock()
    BOARD_ST = ("todo", "doing", "done")

    def clip(x, n):
        return str(x or "").strip()[:n]

    def board_load():
        try:
            return json.loads(board_file.read_text(encoding="utf-8"))
        except Exception:
            return []

    def board_save(items):
        tmp = board_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8"); tmp.replace(board_file)

    @app.get("/app/board")
    async def board_list(request: Request):
        check_auth(request)
        return {"items": board_load()}

    @app.post("/app/board")
    async def board_add(request: Request):
        check_auth(request)
        b = await request.json()
        title = clip(b.get("title"), 120)
        if not title:
            raise HTTPException(status_code=400, detail="title required")
        async with board_lock:
            items = board_load()
            no = max([it.get("no", 0) for it in items] + [0]) + 1
            it = {"id": f"T{no:03d}", "no": no, "title": title, "body": clip(b.get("body"), 4000),
                  "pri": b.get("pri") if b.get("pri") in ("p0", "p1", "p2") else "p1",
                  "size": b.get("size") if b.get("size") in ("S", "M", "L") else "M",
                  "status": "todo", "owner": "", "files": [], "by": clip(b.get("by") or human, 20),
                  "to": clip(b.get("to"), 20), "day": bool(b.get("day")),   # who it's for, and whether the AI may do it on its own in the daytime
                  "wait": bool(b.get("wait")), "proof": clip(b.get("proof"), 400),
                  "ts": now_iso(), "updated": now_iso(), "log": []}
            items.append(it); board_save(items)
        return it

    @app.post("/app/board/{tid}")
    async def board_edit(request: Request, tid: str):
        check_auth(request)
        b = await request.json()
        async with board_lock:
            items = board_load()
            it = next((x for x in items if x.get("id") == tid), None)
            if not it:
                raise HTTPException(status_code=404, detail="no such ticket")
            if b.get("delete"):
                items.remove(it); board_save(items)
                return {"ok": True}
            who = clip(b.get("who") or human, 20)
            for k, n in (("title", 120), ("body", 4000), ("owner", 20), ("proof", 400)):
                if k in b:
                    it[k] = clip(b[k], n)
            if b.get("pri") in ("p0", "p1", "p2"):
                it["pri"] = b["pri"]
            if b.get("size") in ("S", "M", "L"):
                it["size"] = b["size"]
            if "to" in b:
                it["to"] = clip(b["to"], 20)
            for k in ("day", "wait"):
                if k in b:
                    it[k] = bool(b[k])
            if b.get("status") in BOARD_ST and b["status"] != it["status"]:
                it["log"].append({"ts": now_iso(), "who": who, "text": f"{it['status']} → {b['status']}"})
                it["status"] = b["status"]
                if b["status"] != "doing" and "files" not in b:
                    it["files"] = []
            if isinstance(b.get("files"), list):
                it["files"] = [clip(f, 200) for f in b["files"]][:20]
            if b.get("note"):
                it["log"].append({"ts": now_iso(), "who": who, "text": clip(b["note"], 1000)})
            it["updated"] = now_iso()
            board_save(items)
        return it

    # ---- Heart: read-only. The persona and memory the companion lives by, and the code it runs on; no keys ----
    def heart_files():
        groups = [
            ("Persona", [COMPANION_DIR / "CLAUDE.md", COMPANION_DIR / "AGENTS.md"]),
            ("Memory", sorted((COMPANION_DIR / "memory").glob("*.md"))),
            ("Relay", sorted((NYX_DIR / "relay").glob("*.py")) + [NYX_DIR / "channel" / "server.ts"]
             + sorted((NYX_DIR / "bridge").glob("*.py"))),
        ]
        out = []
        for name, paths in groups:
            files = []
            for p in paths:
                if not p.is_file() or re.search(r"env|secret|token|key|\.bak", p.name, re.I):
                    continue
                st = p.stat()
                base = COMPANION_DIR if COMPANION_DIR in p.parents else NYX_DIR
                files.append({"path": ("companion/" if base == COMPANION_DIR else "nyx/") + str(p.relative_to(base)),
                              "size": st.st_size, "mtime": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()})
            if files:
                out.append({"name": name, "files": files})
        return out

    @app.get("/app/heart")
    async def heart_list(request: Request):
        check_auth(request)
        return {"groups": heart_files()}

    @app.get("/app/heart/file")
    async def heart_file(request: Request, path: str):
        check_auth(request)
        if path not in {f["path"] for g in heart_files() for f in g["files"]}:
            raise HTTPException(status_code=404, detail="not in the heart")
        real = (COMPANION_DIR / path[len("companion/"):]) if path.startswith("companion/") else (NYX_DIR / path[len("nyx/"):])
        text = real.read_text(encoding="utf-8", errors="replace")
        return {"path": path, "text": HEART_REDACT.sub(lambda m: (m.group(2) + "***") if m.group(2) else "***", text)}

    # ---- Window: the context line, compact, a new window, old windows ----
    line_file, cmd_file, carry_file = data_dir / "context_line.json", data_dir / "window_cmd.json", data_dir / "window_carry.json"

    def carry_cfg():   # what a new window takes along from the last one: the last N hours of talk, at most M characters
        try:
            c = json.loads(carry_file.read_text())
            return {"hours": max(0.0, min(48.0, float(c.get("hours", 2)))), "chars": max(0, min(60000, int(c.get("chars", 12000))))}
        except Exception:
            return {"hours": 2.0, "chars": 12000}

    def carry_text(hours, chars):
        """The tail of the conversation, from the relay's own log, so it works the same for Claude Code and Codex.
        Only what the two of you said; thinking and tool calls are left out. Two gates, whichever comes first."""
        if not hours or not chars:
            return ""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        conn = sqlite3.connect(g["DB_PATH"])
        try:
            rows = conn.execute("SELECT ts, direction, text FROM messages WHERE ts >= ? AND kind IN ('user', 'reply') ORDER BY id DESC LIMIT 2000", (since,)).fetchall()
        finally:
            conn.close()
        out, used, ai = [], 0, g.get("AI_NAME", "AI")
        for ts, d, text in rows:
            text = (text or "").strip()
            if not text:
                continue
            line = f"[{ts[5:16].replace('T', ' ')}] {human if d == 'in' else ai}: {text}"
            if used + len(line) > chars and out:
                break
            out.append(line); used += len(line) + 1
        return "\n".join(reversed(out))

    async def hand_over(text):
        """After a new window starts: wait until it is listening, then give it the tail of the last one as its first note."""
        if not text:
            return
        before = time.time()
        while time.time() - before < 180:
            await asyncio.sleep(5)
            if plugin_subs and time.time() - before > 12:
                break
        await broadcast(plugin_subs, {"content": (
            f"(An automatic note from the app, not typed by {human}.) This is a new window. Here is how the last one ended, "
            f"word for word, so you can pick up where you left off. Your memory has the rest. No need to reply to this note.\n\n" + text),
            "user": "app", "ts": now_iso(), "attachments": []})
    ctx = {"nudged_sid": "", "nudged_at": None}
    SID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    win_cache = {}

    def line_k():
        try:
            return int(json.loads(line_file.read_text())["line_k"])
        except Exception:
            return 0

    def backend():
        m = current_meter() or {}
        return "codex" if m.get("backend") == "codex" else "claude"

    def last_reply_at():
        try:
            with g["db"]() as conn:
                r = conn.execute("SELECT ts FROM messages WHERE direction='out' AND kind='reply' ORDER BY id DESC LIMIT 1").fetchone()
            return datetime.fromisoformat(r[0].replace("Z", "+00:00")) if r else None
        except Exception:
            return None

    def tmux(*a, timeout=10):
        return subprocess.run(["tmux", *a], capture_output=True, text=True, timeout=timeout)

    def session_meta():
        return live_session_meta(TMUX)

    def claude_usage():
        m = session_meta()
        if not m:
            return {}
        f = CLAUDE_PROJECT / f"{m['sessionId']}.jsonl"
        out = {"sid": m["sessionId"], "started_at": m.get("startedAt"), "used": 0}
        try:
            with f.open("rb") as fh:
                fh.seek(max(0, f.stat().st_size - 600_000))
                lines = fh.read().decode("utf-8", "ignore").splitlines()
        except Exception:
            return out
        for line in reversed(lines):
            try:
                if '"compact_boundary"' in line:
                    out["used"] = int(json.loads(line)["compactMetadata"]["postTokens"]); break
                if '"usage"' in line:
                    u = json.loads(line)["message"]["usage"]
                    out["used"] = int(u.get("input_tokens", 0)) + int(u.get("cache_read_input_tokens", 0)) + int(u.get("cache_creation_input_tokens", 0)); break
            except Exception:
                continue
        return out

    def usage_now():
        if backend() == "codex":
            c = (current_meter() or {}).get("context") or {}
            return {"sid": (current_meter() or {}).get("thread"), "used": c.get("used") or 0}
        return claude_usage()

    async def claude_compact():
        pane = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
        if pane.returncode != 0:
            raise HTTPException(status_code=503, detail="the window isn't running")
        if any(s in "\n".join(pane.stdout.rstrip().splitlines()[-15:]) for s in PROMPT_MARKS):
            raise HTTPException(status_code=409, detail="the window is waiting on a question; answer it in the terminal first")
        await asyncio.to_thread(tmux, "send-keys", "-t", TMUX, "C-u", "/compact", "Enter")

    restart_lock = asyncio.Lock()

    async def hold_watch_lock():
        """Take the window watcher's flock for the restart. Best effort: None means carry on without it."""
        try:
            f = WATCH_LOCK.open("a")
        except OSError:
            return None
        for _ in range(5):
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return f
            except OSError:
                await asyncio.sleep(1)
        f.close()
        return None

    async def dismiss_startup_prompts():
        """The start script handles the first boxes; this one shows up later."""
        for _ in range(40):
            await asyncio.sleep(3)
            pane = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
            if pane.returncode != 0:
                return
            if STARTUP_PROMPT in pane.stdout and not input_box_showing(pane.stdout):
                await asyncio.to_thread(tmux, "send-keys", "-t", TMUX, "2", "Enter")
                return

    async def run_start(cmd, env):
        """Returns "" when the start command says it worked, otherwise why it didn't."""
        try:
            proc = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, text=True, timeout=120, env=env)
        except (subprocess.TimeoutExpired, OSError) as e:
            return type(e).__name__
        return "" if proc.returncode == 0 else (proc.stdout + proc.stderr)[-200:] or "it exited with an error"

    async def window_up(old, fresh):
        """A start command returning 0 proves little: wait until a live session answers, and isn't sitting on a box."""
        for _ in range(15):
            await asyncio.sleep(2)
            pane = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
            if pane.returncode != 0:
                return False
            if STARTUP_PROMPT in pane.stdout and not input_box_showing(pane.stdout):
                await asyncio.to_thread(tmux, "send-keys", "-t", TMUX, "2", "Enter")
                continue
            sid = session_meta().get("sessionId")
            tail = "\n".join(pane.stdout.rstrip().splitlines()[-15:])
            stuck = any(s in tail for s in PROMPT_MARKS) and not input_box_showing(pane.stdout)
            if sid and (sid != old or not fresh) and not stuck:
                return True
        return False

    async def claude_restart(resume=""):
        """Closes the window and opens the next. If the next one doesn't come up, the old one is brought back and this raises 500."""
        if restart_lock.locked():
            raise HTTPException(status_code=409, detail="the window is already restarting")
        async with restart_lock:
            try:
                unit = COMPANION_UNIT.read_text().splitlines()
                cmd = shlex.split(next(l for l in unit if l.startswith("ExecStart="))[len("ExecStart="):])
            except Exception:
                raise HTTPException(status_code=503, detail="don't know how to start the window (" + str(COMPANION_UNIT) + ")")
            unit_path = next((l[len("Environment=PATH="):] for l in unit if l.startswith("Environment=PATH=")), None)   # where claude and bun live
            def start_env(sid):
                return window_env(unit_path, sid)
            old = session_meta().get("sessionId", "")
            watch = await hold_watch_lock()
            try:
                await asyncio.to_thread(tmux, "kill-session", "-t", TMUX)
                ctx.update(nudged_sid="", nudged_at=None)
                await asyncio.sleep(1)
                why = await run_start(cmd, start_env(resume))
                if not why and not await window_up(old, not resume):
                    why = "it never came up"
                if not why:
                    asyncio.get_running_loop().create_task(dismiss_startup_prompts())
                    return
                await asyncio.to_thread(tmux, "kill-session", "-t", TMUX)
                await asyncio.sleep(1)
                back = not await run_start(cmd, start_env(old)) and await window_up(old, False)
                if back:
                    asyncio.get_running_loop().create_task(dismiss_startup_prompts())
                raise HTTPException(status_code=500, detail="the window didn't start: " + why + (
                    "; the old one is back" if back else "; the old one didn't come back either"))
            finally:
                if watch:
                    watch.close()

    def claude_windows():
        tag = '<channel source=\\"companion\\"'
        msg_re = re.compile(re.escape(tag) + r'[^>]*user=\\"human\\"[^>]*>\\n(.*?)\\n</channel>')
        cur, out, cutoff = session_meta().get("sessionId", ""), [], time.time() - 30 * 86400
        for f in CLAUDE_PROJECT.glob("*.jsonl"):
            if not SID_RE.match(f.stem):
                continue
            try:
                mt = f.stat().st_mtime
            except OSError:
                continue
            if mt < cutoff:
                continue
            hit = win_cache.get(f.stem)
            if not hit or hit[0] != mt:
                first, last, n, used = None, "", 0, 0
                try:
                    with f.open("r", encoding="utf-8", errors="ignore") as fh:
                        for line in fh:
                            if first is None and '"timestamp"' in line:
                                m = re.search(r'"timestamp":"([^"]+)"', line); first = m and m.group(1)
                            if tag in line and '"type":"user"' in line:
                                for m in msg_re.finditer(line):
                                    n += 1; last = m.group(1)
                            if '"usage"' in line and '"assistant"' in line:
                                try:
                                    u = json.loads(line)["message"]["usage"]
                                    used = int(u.get("input_tokens", 0)) + int(u.get("cache_read_input_tokens", 0)) + int(u.get("cache_creation_input_tokens", 0))
                                except Exception:
                                    pass
                except Exception:
                    continue
                try:
                    last = json.loads('"' + last + '"')
                except Exception:
                    pass
                info = {"sid": f.stem, "started": first, "last": datetime.fromtimestamp(mt, timezone.utc).isoformat(),
                        "messages": n, "usage_tokens": used, "last_text": last[:60]} if n else None
                win_cache[f.stem] = hit = (mt, info)
            if hit[1]:
                out.append({**hit[1], "current": f.stem == cur})
        if cur and not any(w["current"] for w in out):
            out.append({"sid": cur, "started": None, "last": None, "messages": 0, "usage_tokens": 0, "last_text": "", "current": True})
        out.sort(key=lambda w: w["last"] or "9", reverse=True)
        return out[:20]

    def queue_cmd(action, **kw):   # for the Codex bridge
        cmd_file.write_text(json.dumps({"action": action, "ts": time.time(), **kw}))

    @app.get("/app/window")
    async def window_get(request: Request):
        check_auth(request)
        u = await asyncio.to_thread(usage_now)
        m = current_meter() or {}
        return {"backend": backend(), "line_k": line_k(), "used": u.get("used") or 0, "sid": u.get("sid"),
                "started_at": u.get("started_at"), "size": ((m.get("context") or {}).get("size")), "nudged": bool(ctx["nudged_at"]), "carry": carry_cfg()}

    @app.post("/app/window/line")
    async def window_line(request: Request):
        check_auth(request)
        try:
            k = max(0, min(2000, int((await request.json()).get("line_k") or 0)))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="line_k must be a number")
        line_file.write_text(json.dumps({"line_k": k}))
        return {"ok": True, "line_k": k}

    @app.post("/app/window/compact")
    async def window_compact(request: Request):
        check_auth(request)
        if backend() == "codex":
            queue_cmd("compact")
            return {"ok": True}
        st = await asyncio.to_thread(claude_busy)
        pane = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
        if st.get("state") == "offline" or pane.returncode != 0:
            raise HTTPException(status_code=503, detail="the window isn't running")
        if st.get("state") != "idle" or not input_box_showing(pane.stdout):
            raise HTTPException(status_code=409, detail=st.get("state") or "busy")
        seen = pane.stdout.count("Compacting")
        proc = await asyncio.to_thread(tmux, "send-keys", "-t", TMUX, "C-u", "/compact", "Enter")
        if proc.returncode != 0:
            raise HTTPException(status_code=502, detail="couldn't reach the window")
        started = False
        for _ in range(8):   # started says whether the window visibly took it
            await asyncio.sleep(0.5)
            now = await asyncio.to_thread(tmux, "capture-pane", "-pt", TMUX)
            if now.returncode == 0 and now.stdout.count("Compacting") > seen:
                started = True
                break
        return {"ok": True, "applied": True, "started": started}

    @app.post("/app/window/carry")
    async def window_carry(request: Request):
        check_auth(request)
        b = await request.json()
        carry_file.write_text(json.dumps({"hours": b.get("hours", 2), "chars": b.get("chars", 12000)}))
        return {"ok": True, **carry_cfg()}

    @app.post("/app/window/new")
    async def window_new(request: Request):
        check_auth(request)
        c = carry_cfg()
        text = await asyncio.to_thread(carry_text, c["hours"], c["chars"])
        if backend() == "codex":
            queue_cmd("new")
        else:
            await claude_restart()   # the note waits for this: a failed restart must not tell the old window it's a new one
        asyncio.get_running_loop().create_task(hand_over(text))
        return {"ok": True}

    @app.get("/app/window/list")
    async def window_list(request: Request):
        check_auth(request)
        if backend() == "codex":
            return {"windows": (current_meter() or {}).get("windows") or []}
        return {"windows": await asyncio.to_thread(claude_windows)}

    @app.post("/app/window/switch")
    async def window_switch(request: Request):
        check_auth(request)
        sid = str((await request.json()).get("sid") or "")
        if backend() == "codex":
            if not any(w.get("sid") == sid for w in (current_meter() or {}).get("windows") or []):
                raise HTTPException(status_code=404, detail="no such window")
            queue_cmd("switch", sid=sid)
            return {"ok": True}
        if not SID_RE.match(sid) or not (CLAUDE_PROJECT / f"{sid}.jsonl").exists():
            raise HTTPException(status_code=404, detail="no such window")
        await claude_restart(sid)
        return {"ok": True}

    @app.get("/app/window/cmd")
    async def window_cmd_get(request: Request):
        """The Codex bridge asks for a waiting command (compact / new / switch) and clears it."""
        check_auth(request)
        try:
            c = json.loads(cmd_file.read_text()); cmd_file.unlink()
        except Exception:
            return {}
        return c if time.time() - c.get("ts", 0) < 600 else {}

    async def line_watch():
        """Past the line: one note asking the AI to save what it wants to keep; once it has answered and gone quiet, compact."""
        while True:
            await asyncio.sleep(60)
            try:
                line = line_k() * 1000
                if not line:
                    continue
                u = await asyncio.to_thread(usage_now)
                used, sid, now = u.get("used") or 0, u.get("sid") or "", datetime.now(timezone.utc)
                if used < line:
                    ctx.update(nudged_sid="", nudged_at=None)
                    continue
                if ctx["nudged_sid"] != sid or ctx["nudged_at"] is None:
                    ctx.update(nudged_sid=sid, nudged_at=now)
                    await broadcast(plugin_subs, {"content": (
                        f"(An automatic note from the app, not typed by {human}.) The context is at {used // 1000}k, past the "
                        f"{line // 1000}k line {human} set. Save what you want to keep to your memory now (memory/ in your "
                        f"folder), then tell {human} in a sentence. Once you've gone quiet, the app compacts this window."),
                        "user": "app", "ts": now_iso(), "attachments": []})
                    continue
                last = last_reply_at()
                if last and last > ctx["nudged_at"] and (now - last).total_seconds() >= QUIET_SEC:
                    if backend() == "codex":
                        queue_cmd("compact")
                    else:
                        await claude_compact()
                    ctx["nudged_at"] = now + timedelta(minutes=10)   # give it time to shrink
            except Exception:
                pass

    g.setdefault("NYX_STARTUP", []).append(line_watch)


    # ---- Busy: what it's doing right now, for the line under its name in the chat ----
    TOOL_NAMES = {"Bash": "running a command", "Read": "reading a file", "Edit": "editing a file", "Write": "writing a file",
                  "WebFetch": "reading a web page", "WebSearch": "searching the web", "Agent": "sent a helper",
                  "Skill": "reading instructions", "ToolSearch": "looking for a tool", "Monitor": "watching a job"}
    SPIN_RE = re.compile(r"^\s*\S\s+([^\s(]+\u2026)\s*\(([^)]*)\)")
    bridge_busy = {"state": "idle", "ts": 0}

    def secs(t):
        return sum(int(v) * {"h": 3600, "m": 60, "s": 1}[u] for v, u in re.findall(r"(\d+)\s*([hms])", t or ""))

    def current_tool():
        """The last tool call in the transcript that hasn't had its result yet."""
        m = session_meta()
        f = CLAUDE_PROJECT / f"{m.get('sessionId')}.jsonl" if m else None
        try:
            with f.open("rb") as fh:
                fh.seek(max(0, f.stat().st_size - 400_000))
                lines = fh.read().decode("utf-8", "ignore").splitlines()
        except Exception:
            return None
        done = set()
        for line in reversed(lines):
            if '"tool_use' not in line and '"tool_result' not in line:
                continue
            try:
                d = json.loads(line); content = d["message"]["content"]
            except Exception:
                continue
            if not isinstance(content, list):
                continue
            for c in reversed(content):
                if c.get("type") == "tool_result":
                    done.add(c.get("tool_use_id"))
                elif c.get("type") == "tool_use":
                    if c.get("id") in done:
                        return None
                    name, inp = c.get("name", ""), c.get("input") or {}
                    if name in ("mcp__companion__reply", "mcp__companion__react"):
                        label = "writing to you"
                    elif name.startswith("mcp__"):
                        label = "using " + name.split("__")[-1]
                    else:
                        label = TOOL_NAMES.get(name, "using " + name)
                    detail = inp.get("description") or inp.get("file_path") or inp.get("url") or inp.get("query") or ""
                    if isinstance(detail, str) and "/" in detail and len(detail) > 40:
                        detail = "\u2026/" + detail.rsplit("/", 1)[-1]
                    try:
                        since = datetime.fromisoformat(d.get("timestamp", "").replace("Z", "+00:00")).timestamp()
                    except Exception:
                        since = None
                    return {"tool": label, "detail": str(detail)[:60], "since": since}
        return None

    EFFORT_FILE, EFFORT_PENDING = data_dir / "effort_now", data_dir / "effort_pending"   # last effort level typed in / one waiting for an idle moment
    EFFORT_RE = re.compile(r"\u25cf\s*(low|medium|high|xhigh|max)\s*\u00b7\s*/effort")   # the badge on the pane, it fades after a while
    WAIT_DEBOUNCE = 45      # auto mode shows a confirm box for a few seconds before it lets the command through; only a box that stays is "waiting"
    wait_since = {"t": None}

    def claude_busy():
        pane = tmux("capture-pane", "-pt", TMUX)
        if pane.returncode != 0:
            return {"state": "offline"}
        lines = [l for l in pane.stdout.rstrip().splitlines() if l.strip()]
        tail = "\n".join(lines[-15:])
        m = EFFORT_RE.search(tail)
        eff = m.group(1) if m else None
        if not eff:
            try:
                eff = EFFORT_FILE.read_text().strip() or None
            except Exception:
                eff = None
        out = {"effort": eff}
        # A confirm box replaces the input box at the bottom ("\u2500\u2500 \u276f \u2500\u2500"). Old command output scrolling by can contain the same words,
        # so if the input box is still there nobody is being asked anything.
        input_box = any(lines[i].startswith("\u2500\u2500\u2500") and lines[i + 1].startswith("\u276f") and lines[i + 2].startswith("\u2500\u2500\u2500")
                        for i in range(max(0, len(lines) - 8), len(lines) - 2))
        if not input_box and any(s in "\n".join(lines[-12:]) for s in PROMPT_MARKS):
            if wait_since["t"] is None:
                wait_since["t"] = time.time()
            if time.time() - wait_since["t"] >= WAIT_DEBOUNCE:
                out["state"] = "waiting"
                return out
        else:
            wait_since["t"] = None
        # Newer Claude Code no longer prints "esc to interrupt"; the spinner line ("\u273b Thinking\u2026 (5m 59s \u00b7 ...)") is the sign of a running turn.
        spinning = any(SPIN_RE.match(l) for l in lines[-20:])
        if "esc to interrupt" not in tail and not spinning:
            out["state"] = "idle"
            return out
        out["state"] = "busy"
        for l in reversed(lines[-20:]):
            m = SPIN_RE.match(l)
            if m:
                out.update(verb=m.group(1), secs=secs(m.group(2).split("\u00b7")[0])); break
        t = current_tool()
        if t:
            out.update(tool=t["tool"], detail=t["detail"])
            if t["since"]:
                out["tool_secs"] = max(0, int(time.time() - t["since"]))
        return out

    @app.get("/app/busy")
    async def busy_get(request: Request):
        check_auth(request)
        if backend() == "codex":
            b = dict(bridge_busy)
            if b.get("state") == "busy" and time.time() - b.get("ts", 0) > 900:
                b = {"state": "idle"}
            now = time.time()
            if b.get("turn_since"):
                b["secs"] = int(now - b["turn_since"])
            if b.get("tool_since"):
                b["tool_secs"] = int(now - b["tool_since"])
            return b
        st = await asyncio.to_thread(claude_busy)
        try:
            st["pending_effort"] = EFFORT_PENDING.read_text().strip() or None
        except Exception:
            st["pending_effort"] = None
        return st

    @app.post("/app/busy")
    async def busy_post(request: Request):
        """The Codex bridge says what it's doing: {state: busy|idle, tool?, detail?}."""
        check_auth(request)
        b = await request.json(); now = time.time()
        st = b.get("state") if b.get("state") in ("busy", "idle") else "idle"
        if st == "idle":
            bridge_busy.clear(); bridge_busy.update(state="idle", ts=now)
        else:
            if bridge_busy.get("state") != "busy":
                bridge_busy.clear(); bridge_busy.update(state="busy", turn_since=now)
            bridge_busy["ts"] = now
            if b.get("tool"):
                bridge_busy.update(tool=clip(b["tool"], 40), detail=clip(b.get("detail"), 60), tool_since=now)
            elif "tool" in b:
                for k in ("tool", "detail", "tool_since"):
                    bridge_busy.pop(k, None)
        return {"ok": True}


    # ---- Kitchen: the pantry, recipes the companion writes, photos of what got made, a timeline of meals ----
    kitchen_file, ai = data_dir / "kitchen.json", g.get("AI_NAME", "AI")
    pub = g.get("PUBLIC_PREFIX", "")

    def kload():
        try:
            d = json.loads(kitchen_file.read_text(encoding="utf-8"))
        except Exception:
            d = {}
        d.setdefault("pantry", {"tools": [], "seasonings": [], "ingredients": []})
        d["pantry"].setdefault("staples", [])
        d.setdefault("recipes", []); d.setdefault("log", [])
        return d

    def ksave(d):
        tmp = kitchen_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8"); tmp.replace(kitchen_file)

    def strs(v, n=80):
        return [str(x).strip()[:40] for x in (v if isinstance(v, list) else []) if str(x).strip()][:n]

    async def tell_ai(text, attachments=None):
        await broadcast(plugin_subs, {"content": text, "user": "kitchen", "ts": now_iso(), "attachments": attachments or []})

    @app.get("/app/kitchen")
    async def kitchen_get(request: Request):
        check_auth(request)
        return kload()

    @app.post("/app/kitchen/pantry")
    async def kitchen_pantry(request: Request):
        check_auth(request)
        b = await request.json(); d = kload()
        d["pantry"] = {k: strs(b.get(k)) for k in ("tools", "seasonings", "ingredients", "staples")}
        ksave(d)
        return {"ok": True, "pantry": d["pantry"]}

    @app.post("/app/kitchen/ask")
    async def kitchen_ask(request: Request):
        """Nothing in the recipes fits what they picked: the companion gets a note and writes one."""
        check_auth(request)
        picked = strs((await request.json()).get("picked"), 20)
        if not picked:
            raise HTTPException(status_code=400, detail="empty")
        p = kload()["pantry"]
        await tell_ai(f"(Kitchen, not typed by {human}.) {human} picked: {', '.join(picked)} — no recipe for that yet. "
                      f"Pots: {', '.join(p['tools']) or 'not listed'}; seasonings: {', '.join(p['seasonings']) or 'not listed'}; "
                      f"in the fridge: {', '.join(p['ingredients']) or 'not listed'}. Write one into {kitchen_file} under "
                      f"recipes (or POST /app/kitchen/recipe with name, ingredients, seasonings, tools, steps, tip), then tell {human} in the chat.")
        return {"ok": True}

    @app.post("/app/kitchen/recipe")
    async def kitchen_recipe(request: Request):
        check_auth(request)
        b = await request.json()
        name = str(b.get("name") or "").strip()[:60]
        steps = [str(x).strip()[:400] for x in (b.get("steps") or []) if str(x).strip()][:30]
        if not name or not steps:
            raise HTTPException(status_code=400, detail="name and steps required")
        d = kload()
        r = {"id": secrets.token_hex(4), "name": name, "ingredients": strs(b.get("ingredients"), 20), "seasonings": strs(b.get("seasonings"), 20),
             "tools": strs(b.get("tools"), 10), "steps": steps, "tip": str(b.get("tip") or "").strip()[:400], "at": now_iso()}
        d["recipes"].append(r); ksave(d)
        return {"ok": True, "recipe": r}

    @app.post("/app/kitchen/photo")
    async def kitchen_photo(request: Request):
        """A photo of the finished dish (uploaded first through /app/upload); the companion is asked for a word on it."""
        check_auth(request)
        b = await request.json()
        rid, file = str(b.get("id") or ""), fname(b.get("file"))
        if not file or not (upload_dir / file).is_file():
            raise HTTPException(status_code=400, detail="no such upload")
        d = kload()
        for r in d["recipes"]:
            if r.get("id") == rid:
                ph = {"file": file, "at": now_iso(), "comment": str(b.get("comment") or "").strip()[:400]}
                r.setdefault("photos", []).append(ph); ksave(d)
                if not ph["comment"]:
                    await tell_ai(f"(Kitchen, not typed by {human}.) {human} made 「{r['name']}」 and sent a photo. Look at it and write a line back: "
                                  f"POST /app/kitchen/photo/comment {{id: {rid}, file: {file}, comment}} (or edit {kitchen_file}), then say something in the chat.",
                                  [{"url": f"{pub}/uploads/{file}", "name": file, "kind": "image", "mime": "image/jpeg"}])
                return {"ok": True, "photo": ph}
        raise HTTPException(status_code=404, detail="no such recipe")

    @app.post("/app/kitchen/photo/comment")
    async def kitchen_photo_comment(request: Request):
        check_auth(request)
        b = await request.json()
        rid, file, d = str(b.get("id") or ""), str(b.get("file") or ""), kload()
        for r in d["recipes"]:
            if r.get("id") == rid:
                for ph in r.get("photos", []):
                    if ph.get("file") == file:
                        ph["comment"] = str(b.get("comment") or "").strip()[:400]; ksave(d)
                        return {"ok": True, "photo": ph}
        raise HTTPException(status_code=404, detail="no such photo")

    @app.post("/app/kitchen/log")
    async def kitchen_log(request: Request):
        """A meal on the timeline (takeaway counts); {delete: <at>} removes one."""
        check_auth(request)
        b = await request.json(); d = kload()
        if b.get("delete"):
            d["log"] = [x for x in d["log"] if x.get("at") != str(b["delete"])]
        else:
            name = str(b.get("name") or "").strip()[:80]
            if not name:
                raise HTTPException(status_code=400, detail="empty")
            e = {"at": str(b.get("at") or now_iso())[:40], "name": name, "ingredients": strs(b.get("ingredients"), 20)}
            if b.get("note"):
                e["note"] = str(b["note"]).strip()[:200]
            d["log"].append(e)
        d["log"].sort(key=lambda x: x.get("at", "")); ksave(d)
        return {"ok": True, "log": d["log"]}

    @app.post("/app/kitchen/cooked")
    async def kitchen_cooked(request: Request):
        check_auth(request)
        rid, d = str((await request.json()).get("id") or ""), kload()
        for r in d["recipes"]:
            if r.get("id") == rid:
                r["cooked"] = int(r.get("cooked") or 0) + 1; r["lastCooked"] = now_iso()
                d["log"].append({"at": now_iso(), "name": r["name"], "recipe": rid, "ingredients": r.get("ingredients", [])})
                ksave(d)
                return {"ok": True, "recipe": r}
        raise HTTPException(status_code=404, detail="no such recipe")
