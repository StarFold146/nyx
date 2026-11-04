#!/usr/bin/env python3
"""Nyx · Codex bridge — let a ChatGPT-subscription Codex be the companion behind the relay.

It sits where the Claude Code channel plugin sits:

    phone ──▶ relay ──(SSE /channel/in)──▶ this bridge ──(JSON-RPC, stdio)──▶ codex app-server
    phone ◀── relay ◀──(POST /channel/out, streamed)──┘

One long-lived `codex app-server` keeps one conversation thread. Each message from the phone
becomes a new turn in that same thread, so the context stays; the reply streams back word by word.
The thread id is saved, so a restart resumes the same conversation.

Setup (once):  codex login --device-auth      (open the link on your phone, type the code)
Run:           RELAY_URL=http://127.0.0.1:3011 RELAY_SECRET=... python3 codex_bridge.py

Settings (environment):
  RELAY_URL, RELAY_SECRET   the relay, same secret as the relay's relay.env (required)
  CODEX_BIN                 path to codex (default: codex on PATH)
  BRIDGE_DIR                state + downloaded pictures (default: ~/.nyx-bridge)
  BRIDGE_CWD                the folder Codex works in; an AGENTS.md there is read as its persona
                            (default: BRIDGE_DIR/home)
  BRIDGE_PERSONA            optional extra persona file, passed as developer instructions
  BRIDGE_SANDBOX            read-only (default) | workspace-write (Codex may edit files in BRIDGE_CWD)
                            | danger-full-access (no sandbox; see README troubleshooting)
  BRIDGE_MODEL, BRIDGE_EFFORT   optional model / reasoning effort overrides
  BRIDGE_THINKING           1 = also show Codex's reasoning summary as a thinking bubble (default 1)
  BRIDGE_NUDGE_MIN          if set (minutes), when the chat has been quiet that long, Codex gets a
                            chance to say something first; it can stay silent
  RELAY_HUMAN_NAME          how the bridge refers to you in those nudges (default: "they")

Keys: API keys saved from the chat page's gauge (relay/nyx_keys.py). The bridge copies them from the relay's
GET /channel/keys (same machine only, RELAY_URL on 127.0.0.1) into BRIDGE_DIR/keys.env (600) every half minute and
tells Codex to load that file inside the one command that needs a key. Nothing restarts; values never reach the chat.

Part of the Nyx relay (a modified version of Tidal Echo), GNU AGPL v3.
"""
import asyncio
import itertools
import json
import os
import shlex
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

RELAY = os.environ.get("RELAY_URL", "").rstrip("/")
SECRET = os.environ.get("RELAY_SECRET", "")
CODEX = os.environ.get("CODEX_BIN", "codex")
DIR = Path(os.environ.get("BRIDGE_DIR", str(Path.home() / ".nyx-bridge")))
CWD = Path(os.environ.get("BRIDGE_CWD", str(DIR / "home")))
PERSONA = os.environ.get("BRIDGE_PERSONA", "")
SANDBOX = os.environ.get("BRIDGE_SANDBOX", "read-only")
MODEL = os.environ.get("BRIDGE_MODEL") or None
EFFORT = os.environ.get("BRIDGE_EFFORT") or None
THINKING = os.environ.get("BRIDGE_THINKING", "1") == "1"
NUDGE_MIN = float(os.environ.get("BRIDGE_NUDGE_MIN") or 0)
HUMAN = os.environ.get("RELAY_HUMAN_NAME", "they")
KEYS_COPY = DIR / "keys.env"   # the bridge's own copy of the keys from the gauge (600)
SILENT = "<quiet>"
AUTH = {"Authorization": f"Bearer {SECRET}"}
IMAGE_TYPES = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)


# Ubuntu 24.04 blocks unprivileged user namespaces by default, so Codex's bwrap sandbox
# (read-only / workspace-write) fails before any command runs. Spot it and say how to fix it.
SANDBOX_HINT = ("（Codex 的沙箱在这台机器上起不来（bwrap），命令都没跑成。修法见 bridge/README.md 的「排障」一节。"
                " / Codex's sandbox can't start on this machine (bwrap), so no command ran. "
                "See \"Troubleshooting\" in bridge/README.md.）")


def sandbox_broken(text):
    return "bwrap" in text and any(s in text for s in ("Operation not permitted", "RTM_NEWADDR", "uid map"))


def userns_restricted():
    try:
        return Path("/proc/sys/kernel/apparmor_restrict_unprivileged_userns").read_text().strip() == "1"
    except OSError:
        return False


class Codex:
    """A tiny JSON-RPC client for `codex app-server` over stdio (one JSON object per line)."""

    def __init__(self, on_note):
        self.on_note, self.ids, self.wait, self.proc = on_note, itertools.count(1), {}, None

    async def start(self):
        self.proc = await asyncio.create_subprocess_exec(
            CODEX, "app-server", stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=16 * 1024 * 1024)
        asyncio.create_task(self._read())
        await self.call("initialize", {"clientInfo": {"name": "nyx-bridge", "version": "0.1"}})
        await self._send({"method": "initialized"})

    async def _send(self, obj):
        self.proc.stdin.write((json.dumps(obj) + "\n").encode())
        await self.proc.stdin.drain()

    async def call(self, method, params):
        rid = next(self.ids)
        fut = asyncio.get_running_loop().create_future()
        self.wait[rid] = fut
        await self._send({"id": rid, "method": method, "params": params})
        return await fut

    async def _read(self):
        while True:
            line = await self.proc.stdout.readline()
            if not line:
                for f in self.wait.values():
                    if not f.done():
                        f.set_exception(RuntimeError("codex app-server exited"))
                log("codex app-server exited")
                return
            try:
                msg = json.loads(line)
            except ValueError:
                continue
            if "id" in msg and "method" not in msg:          # a response to one of our calls
                f = self.wait.pop(msg["id"], None)
                if f and not f.done():
                    if "error" in msg:
                        f.set_exception(RuntimeError(json.dumps(msg["error"], ensure_ascii=False)))
                    else:
                        f.set_result(msg.get("result"))
            elif "id" in msg:                                 # codex asks us something (approvals)
                await self._send({"id": msg["id"], "result": {"decision": "decline"}})
            else:
                try:
                    await self.on_note(msg.get("method", ""), msg.get("params") or {})
                except Exception as e:
                    log("note handler:", e)


class Bridge:
    def __init__(self):
        self.http = httpx.AsyncClient(timeout=30)
        self.codex = Codex(self.on_note)
        self.thread = None
        self.queue = asyncio.Queue()
        self.turn_done = asyncio.Event()
        self.last_activity = time.time()
        self.nudging = False
        self.chat = None   # "group" while answering a line from the group chat
        self.seen = 0
        self.ctx, self.models, self.model, self.default_model = None, [], MODEL, None
        self.sandbox_hinted = False
        self.keys_version, self.keys_warned = None, False

    # ---- state: thread id + the last relay message we've handled ----
    def state(self):
        try:
            return json.loads((DIR / "state.json").read_text())
        except Exception:
            return {}

    def save_state(self, **kw):
        st = self.state(); st.update(kw)
        (DIR / "state.json").write_text(json.dumps(st))

    # ---- relay side ----
    async def out(self, body):
        if self.chat == "group":   # in the group chat: no live drafts, just the finished line, sent back to the room
            if body.get("type") in ("thinking_delta",):
                return
            if body.get("type") == "reply_delta":
                if not body.get("done") or not (body.get("final_text") or "").strip():
                    return
                body = {"type": "reply", "text": body["final_text"]}
            body = {**body, "chat_id": "group"}
        try:
            await self.http.post(f"{RELAY}/channel/out", headers=AUTH, json=body)
        except Exception as e:
            log("relay out:", e)

    async def listen_relay(self):
        while True:
            try:
                # resume after the last message we handled; on a first run, skip the old backlog
                since = self.state().get("lastInId", 10 ** 12)
                async with self.http.stream("GET", f"{RELAY}/channel/in", params={"since": since},
                                            headers=AUTH, timeout=None) as r:
                    r.raise_for_status()
                    log("connected to relay")
                    async for line in r.aiter_lines():
                        if line.startswith("data:"):
                            try:
                                m = json.loads(line[5:].strip())
                            except ValueError:
                                continue
                            mid = m.get("id")
                            if isinstance(mid, int):
                                if mid <= self.seen:
                                    continue
                                self.seen = mid
                            if m.get("content") or m.get("attachments"):
                                await self.queue.put(m)
            except Exception as e:
                log("relay stream:", e)
            await asyncio.sleep(3)

    async def fetch_attachment(self, a):
        name = str(a.get("url") or a.get("name") or "").split("/")[-1].split("?")[0]
        if not name:
            return None
        dst = DIR / "inbox" / name
        if not dst.exists():
            r = await self.http.get(f"{RELAY}/uploads/{name}", headers=AUTH)
            r.raise_for_status()
            dst.write_bytes(r.content)
        return dst

    # ---- keys: set from the gauge, handed to codex app-server as environment variables (relay/nyx_keys.py) ----
    async def fetch_keys(self):
        """(version, {name: value}) from the relay, or (None, None) if it can't be read right now."""
        try:
            r = await self.http.get(f"{RELAY}/channel/keys", headers=AUTH)
        except Exception:
            return None, None
        if r.status_code == 404:
            return None, None    # an older relay without keys
        if r.status_code != 200:
            if not self.keys_warned:
                self.keys_warned = True
                log(f"keys: the relay said {r.status_code}; keys from the gauge only reach a bridge on the same machine "
                    "(RELAY_URL=http://127.0.0.1:...)")
            return None, None
        d = r.json() or {}
        return str(d.get("version") or ""), {k: str(v) for k, v in (d.get("keys") or {}).items()}

    def keys_note(self):
        f = shlex.quote(str(KEYS_COPY))
        return (f"API keys the user saved from the app are in {KEYS_COPY} (NAME='value' lines; it may change while you run). "
                f"When a command needs one, load the file inside that same command: set -a; . {f}; set +a; your-command ... $NAME. "
                f"To see which names exist: grep -oE '^[A-Z_][A-Z0-9_]*' {f}. Never print, echo, cat or log the values, "
                "and never paste them into the chat.")

    async def sync_keys(self):
        """Keep BRIDGE_DIR/keys.env (600) the same as the relay's keys. Nothing restarts: Codex loads it when it needs it."""
        ver, keys = await self.fetch_keys()
        if ver is None or ver == self.keys_version:
            return
        tmp = KEYS_COPY.with_name(KEYS_COPY.name + ".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            for k in sorted(keys):
                f.write(f"{k}={shlex.quote(keys[k])}\n")
        tmp.replace(KEYS_COPY)
        self.keys_version = ver
        log("keys:", len(keys), "saved for Codex")

    async def keys_poller(self):
        while True:
            await asyncio.sleep(30)
            await self.sync_keys()

    # ---- codex side ----
    async def open_thread(self):
        acct = await self.codex.call("account/read", {})
        if not (acct or {}).get("account"):
            log("Codex isn't logged in. Run:  codex login --device-auth")
        persona = Path(PERSONA).read_text(encoding="utf-8") if PERSONA else None
        if self.keys_version is not None:
            note = self.keys_note()
            persona = (persona + "\n\n" + note) if persona else note
        opts = {"cwd": str(CWD), "sandbox": SANDBOX, "approvalPolicy": "never",
                "developerInstructions": persona, "model": MODEL}
        tid = self.state().get("threadId")
        if tid:
            try:
                await self.codex.call("thread/resume", {"threadId": tid, "excludeTurns": True, **opts})
                self.thread = tid
                log("resumed thread", tid)
                return
            except Exception as e:
                if "active writer" in str(e):
                    sys.exit("Another bridge is already using this thread — stop it first (one bridge per BRIDGE_DIR).")
                log("resume failed, starting a new thread:", e)
        res = await self.codex.call("thread/start", opts)
        self.thread = res["thread"]["id"]
        self.save_state(threadId=self.thread)
        log("new thread", self.thread)

    # what it's doing right now, for the line under its name on the chat page (POST /app/busy)
    TOOLS = {"commandExecution": "running a command", "fileChange": "editing a file", "mcpToolCall": "using a tool",
             "dynamicToolCall": "using a tool", "webSearch": "searching the web", "imageView": "looking at a picture",
             "imageGeneration": "drawing", "contextCompaction": "compacting", "agentMessage": "writing to you"}

    async def busy(self, **b):
        if self.nudging and b.get("state") == "busy":
            return
        try:
            await self.http.post(f"{RELAY}/app/busy", headers=AUTH, json=b)
        except Exception:
            pass

    async def on_note(self, method, p):
        if method == "item/started":
            it = p.get("item") or {}
            if it.get("type") in self.TOOLS:
                cmd = it.get("command")
                detail = (" ".join(cmd) if isinstance(cmd, list) else cmd) or it.get("query") or it.get("path") or ""
                await self.busy(state="busy", tool=self.TOOLS[it["type"]], detail=str(detail)[:60])
            elif it.get("type") == "reasoning":
                await self.busy(state="busy", tool=None)
        if method == "item/agentMessage/delta":
            await self.out({"type": "reply_delta", "stream_id": p["itemId"], "text": p["delta"]})
        elif method == "item/reasoning/summaryTextDelta" and THINKING and not self.nudging:
            await self.out({"type": "thinking_delta", "stream_id": p["itemId"] + ":t", "text": p.get("delta", "")})
        elif method == "item/completed":
            it = p.get("item") or {}
            if it.get("type") == "commandExecution" and not self.sandbox_hinted and sandbox_broken(json.dumps(it)):
                self.sandbox_hinted = True   # once per bridge run
                log("Codex's sandbox can't start on this machine (bwrap). See bridge/README.md, troubleshooting.")
                await self.out({"type": "reply", "text": SANDBOX_HINT})
            if it.get("type") == "agentMessage":
                text = it.get("text") or ""
                if (self.nudging or self.chat == "group") and text.strip() == SILENT:
                    text = ""            # it chose to stay quiet; an empty final text saves nothing
                await self.out({"type": "reply_delta", "stream_id": it["id"], "text": "", "done": True, "final_text": text})
            elif it.get("type") == "reasoning" and THINKING and not self.nudging:
                await self.out({"type": "thinking_delta", "stream_id": it["id"] + ":t", "text": "", "done": True})
        elif method == "turn/completed":
            await self.busy(state="idle")
            turn = p.get("turn") or {}
            if turn.get("status") == "failed":
                err = (turn.get("error") or {}).get("message") or "Codex couldn't answer this time."
                await self.out({"type": "reply", "text": f"（{err}）"})
            self.turn_done.set()
        elif method == "thread/tokenUsage/updated":
            u = p.get("tokenUsage") or {}
            self.ctx = {"used": (u.get("last") or {}).get("totalTokens"), "size": u.get("modelContextWindow")}
        elif method == "error":
            log("codex error:", json.dumps(p, ensure_ascii=False)[:300])

    async def report(self):
        """Tell the relay our model, usage limits and context, for the chat page's floating ball."""
        try:
            rl = (await self.codex.call("account/rateLimits/read", {}) or {}).get("rateLimits") or {}
            if not self.models:
                data = (await self.codex.call("model/list", {}) or {}).get("data") or []
                self.models = [{"id": m.get("id"), "name": m.get("displayName") or m.get("id")} for m in data]
                self.default_model = next((m.get("id") for m in data if m.get("isDefault")), None)
        except Exception as e:
            log("report:", e)
            return
        limits = []
        for key in ("primary", "secondary"):
            w = rl.get(key)
            if w:
                mins = w.get("windowDurationMins") or 0
                label = "5h" if mins == 300 else "week" if mins == 10080 else f"{round(mins / 1440)}d" if mins >= 1440 else f"{mins}m"
                limits.append({"key": key, "label": label, "used": w.get("usedPercent"), "resets_at": w.get("resetsAt")})
        mid = self.model or self.default_model
        ctx = self.ctx or {}
        await self.http.post(f"{RELAY}/app/meter", headers=AUTH, json={
            "backend": "codex", "plan": rl.get("planType"),
            "model": {"id": mid, "name": next((m["name"] for m in self.models if m["id"] == mid), mid)},
            "limits": limits,
            "context": {"used_pct": round(100 * ctx["used"] / ctx["size"]) if ctx.get("used") and ctx.get("size") else None,
                        "used": ctx.get("used"), "size": ctx.get("size")},
            "models": self.models, "model_applies": "next",
            "thread": self.thread, "windows": await self.windows()})

    async def pick_model(self):
        """The model chosen on the chat page (POST /app/model on the relay), if any."""
        try:
            r = await self.http.get(f"{RELAY}/app/model", headers=AUTH)
            self.model = (r.json() or {}).get("model") or MODEL
        except Exception:
            self.model = MODEL

    async def run_turn(self, inputs, nudge=False):
        self.nudging = nudge
        self.turn_done.clear()
        await self.pick_model()
        params = {"threadId": self.thread, "input": inputs}
        if self.model:
            params["model"] = self.model
        if EFFORT:
            params["effort"] = EFFORT
        await self.busy(state="busy", tool=None)
        try:
            await self.codex.call("turn/start", params)
            await asyncio.wait_for(self.turn_done.wait(), timeout=900)
        except Exception as e:
            log("turn:", e)
            if not nudge:
                await self.out({"type": "reply", "text": f"（the bridge hit a problem: {str(e)[:200]}）"})
        finally:
            await self.busy(state="idle")
            self.nudging = False
            self.last_activity = time.time()
            await self.report()

    async def logged_in(self):
        try:
            return bool((await self.codex.call("account/read", {}) or {}).get("account"))
        except Exception:
            return False

    async def handle(self, m):
        if not await self.logged_in():
            await self.out({"type": "reply", "text": "（Codex isn't logged in yet. On the server, run: codex login --device-auth）"})
            return
        inputs, notes = [], []
        for a in m.get("attachments") or []:
            try:
                path = await self.fetch_attachment(a)
            except Exception as e:
                log("attachment:", e)
                continue
            if path and path.suffix.lower() in IMAGE_TYPES:
                inputs.append({"type": "localImage", "path": str(path)})
            elif path:
                notes.append(f"[file: {path}]")
        text = "\n".join(x for x in [m.get("content") or ""] + notes if x)
        self.chat = m.get("chat_id") if m.get("chat_id") == "group" else None
        if self.chat:
            text += f"\n(If you have nothing to add in the group, reply with exactly {SILENT}.)"
        inputs.insert(0, {"type": "text", "text": text or "(a picture)"})
        await self.run_turn(inputs)

    # ---- windows: the gauge on the chat page can compact, start a new thread, or go back to an old one ----
    async def windows(self):
        try:
            data = (await self.codex.call("thread/list", {"cwd": str(CWD), "limit": 20, "sortKey": "updated_at"}) or {}).get("data") or []
        except Exception as e:
            log("thread/list:", e)
            return []
        iso = lambda t: datetime.fromtimestamp(t, timezone.utc).isoformat() if t else None
        return [{"sid": t["id"], "started": iso(t.get("createdAt")), "last": iso(t.get("updatedAt")), "messages": None,
                 "usage_tokens": None, "last_text": (t.get("name") or t.get("preview") or "")[:60], "current": t["id"] == self.thread}
                for t in data]

    async def cmd_poller(self):
        while True:
            await asyncio.sleep(5)
            try:
                c = (await self.http.get(f"{RELAY}/app/window/cmd", headers=AUTH)).json() or {}
            except Exception:
                continue
            if c.get("action"):
                await self.queue.put({"cmd": c["action"], "sid": c.get("sid")})

    async def window_cmd(self, m):
        try:
            if m["cmd"] == "compact":
                await self.codex.call("thread/compact/start", {"threadId": self.thread})
                log("compacting", self.thread)
            elif m["cmd"] == "new":
                self.save_state(threadId=None)
                await self.open_thread()
            elif m["cmd"] == "switch" and m.get("sid"):
                self.save_state(threadId=m["sid"])
                await self.open_thread()
            self.ctx = None
        except Exception as e:
            log("window", m["cmd"], e)
        await self.report()

    async def nudger(self):
        while NUDGE_MIN > 0:
            await asyncio.sleep(60)
            if self.queue.empty() and time.time() - self.last_activity > NUDGE_MIN * 60 and await self.logged_in():
                await self.queue.put({"nudge": True})

    async def worker(self):
        while True:
            m = await self.queue.get()
            if m.get("cmd"):
                await self.window_cmd(m)
                continue
            self.chat = None
            if m.get("nudge"):
                await self.run_turn([{"type": "text", "text": (
                    f"(Not a message — nobody typed. It's been quiet for a while. If there's something you want to say to "
                    f"{HUMAN} right now, say it. If not, reply with exactly {SILENT} and nothing else.)")}], nudge=True)
            else:
                self.last_activity = time.time()
                await self.handle(m)
                if isinstance(m.get("id"), int):
                    self.save_state(lastInId=m["id"])

    async def main(self):
        if not RELAY or not SECRET:
            sys.exit("RELAY_URL and RELAY_SECRET are required")
        (DIR / "inbox").mkdir(parents=True, exist_ok=True)
        CWD.mkdir(parents=True, exist_ok=True)
        if SANDBOX != "danger-full-access" and userns_restricted():
            log("warning: kernel.apparmor_restrict_unprivileged_userns=1, Codex's sandbox will likely fail. "
                "See bridge/README.md, troubleshooting.")
        await self.sync_keys()
        await self.codex.start()
        await self.open_thread()
        await self.report()
        await asyncio.gather(self.listen_relay(), self.worker(), self.nudger(), self.cmd_poller(), self.keys_poller())


if __name__ == "__main__":
    asyncio.run(Bridge().main())
