"""Nyx keys: API keys you hand your companion from the phone, without pasting them into the chat.

  GET  /app/keys           each key's label, name and last four characters; never a value
  POST /app/keys           {"name": "GEMINI_API_KEY", "value": "...", "label": "Gemini, the free one"}   add or replace
                           one; leave out value to change only the label of one that's there
  POST /app/keys/delete    {"name": "GEMINI_API_KEY"}
  GET  /channel/keys       the values, for the companion's process only (see below)

Why: some models refuse, or get the whole thread blocked, when they are asked to read out or handle a password in
chat. Here the key goes from a settings box straight into a file on the server. The companion is told where the file
is and loads it inside the one command that needs it (set -a; . <file>; set +a; cmd ... $NAME), so values never
appear in the chat, on a command line or in its output, and nothing has to restart when a key changes.

Where: agent-keys.env next to the relay's database, mode 600, written as shell lines (NAME='value') so a start
script can source it. Values are never logged and never sent back to the page. Labels (yours to read, the companion
never sees them) sit beside it in agent-keys.labels.json, so changing one doesn't restart anything.

Who gets the values: GET /channel/keys answers only a request made on this machine straight to the relay port, with
no proxy in between (no X-Forwarded-For / Forwarded / X-Real-IP header), and with the relay secret. The phone always
comes in through the web server, so even with the secret it cannot read them back.

  Claude  channel/start-channel.sh tells the window where the file is (NYX_KEYS_FILE) and how to load it on use.
  Codex   the bridge may run as another user, so it keeps its own 600 copy (BRIDGE_DIR/keys.env), refreshed from
          /channel/keys every half minute, and tells Codex that path the same way.

Mounted from nyx_extras.register. Part of the Nyx relay (a modified version of Tidal Echo), GNU AGPL v3.
"""
import json
import os
import re
from pathlib import Path

from fastapi import HTTPException, Request

NAME_RE = re.compile(r"^[A-Z_][A-Z0-9_]{0,63}$")
MAX_KEYS = 40
MAX_VALUE = 8192
MAX_LABEL = 60
# names the agent's environment needs for itself; a key may not shadow them
RESERVED = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "PWD", "TMUX", "RELAY_SECRET", "RELAY_URL",
            "NYX_RESUME", "NYX_KEYS_FILE", "LD_PRELOAD", "LD_LIBRARY_PATH", "PYTHONPATH", "NODE_OPTIONS"}
# prefixes that change how the shell, Claude Code, Node, Python, git or a proxy behave: never a key's name
RESERVED_PREFIX = ("BASH", "ENV", "PROMPT_COMMAND", "IFS", "PS1", "PS4", "SHELLOPTS", "LD_", "DYLD_", "PYTHON", "NODE_", "NPM_",
                   "ANTHROPIC_", "CLAUDE", "GIT_", "SSH_", "TMUX", "XDG_", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
                   "RELAY_", "NYX_", "MCP_")
PROXY_HEADERS = ("x-forwarded-for", "forwarded", "x-real-ip", "x-forwarded-host")


def keys_file(g):
    return Path(os.environ.get("RELAY_KEYS_FILE", str(Path(g["DB_PATH"]).parent / "agent-keys.env")))


def quote(v):
    return "'" + v.replace("'", "'\\''") + "'"


def unquote(s):
    if len(s) >= 2 and s[0] == "'" and s[-1] == "'":
        return s[1:-1].replace("'\\''", "'")
    return s


def load(path):
    out = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    for line in lines:
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        if NAME_RE.match(k):
            out[k] = unquote(v.strip())
    return out


def labels_file(path):
    return path.with_name(path.stem + ".labels.json")


def load_labels(path):
    try:
        d = json.loads(labels_file(path).read_text(encoding="utf-8"))
        return {k: str(v) for k, v in d.items() if NAME_RE.match(k)} if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def save_labels(path, labels):
    f = labels_file(path)
    tmp = f.with_name(f.name + ".tmp")
    tmp.write_text(json.dumps(labels, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(f)


def save(path, keys):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("# Nyx agent keys. Written by the relay; edit from the chat page's gauge.\n")
        for k in sorted(keys):
            f.write(f"{k}={quote(keys[k])}\n")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def version(path):
    try:
        return str(path.stat().st_mtime_ns)
    except OSError:
        return "0"


def tail(v):
    return "••••" + (v[-4:] if len(v) >= 12 else "")


def register(app, g):
    check_auth = g["check_auth"]
    path = keys_file(g)
    if path.exists():
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass

    async def body(request):
        try:
            b = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="bad json")
        return b if isinstance(b, dict) else {}

    def listing():
        keys, labels = load(path), load_labels(path)
        return {"keys": [{"name": k, "label": labels.get(k, ""), "tail": tail(v)} for k, v in sorted(keys.items())],
                "version": version(path)}

    @app.get("/app/keys")
    async def keys_list(request: Request):
        check_auth(request)
        return listing()

    @app.post("/app/keys")
    async def keys_set(request: Request):
        check_auth(request)
        b = await body(request)
        name = str(b.get("name") or "").strip().upper()
        value = str(b.get("value") or "").strip()
        label = " ".join(str(b.get("label") or "").split())[:MAX_LABEL]
        if not NAME_RE.match(name) or name in RESERVED or name.startswith(RESERVED_PREFIX):
            raise HTTPException(status_code=400, detail="name: capital letters, digits and _ only, and not a system name")
        keys = load(path)
        if value:
            if len(value) > MAX_VALUE or "\n" in value or "\r" in value or "\0" in value:
                raise HTTPException(status_code=400, detail="value: one line")
            if name not in keys and len(keys) >= MAX_KEYS:
                raise HTTPException(status_code=400, detail="too many keys")
            keys[name] = value
            save(path, keys)
        elif name not in keys:
            raise HTTPException(status_code=400, detail="value: not empty")
        if "label" in b:
            labels = load_labels(path)
            if label:
                labels[name] = label
            else:
                labels.pop(name, None)
            save_labels(path, labels)
        return listing()

    @app.post("/app/keys/delete")
    async def keys_delete(request: Request):
        check_auth(request)
        name = str((await body(request)).get("name") or "").strip().upper()
        keys = load(path)
        if keys.pop(name, None) is None:
            raise HTTPException(status_code=404, detail="no such key")
        save(path, keys)
        labels = load_labels(path)
        if labels.pop(name, None) is not None:
            save_labels(path, labels)
        return listing()

    @app.get("/channel/keys")
    async def keys_for_agent(request: Request):
        check_auth(request)
        host = request.client.host if request.client else ""
        if host not in ("127.0.0.1", "::1") or any(h in request.headers for h in PROXY_HEADERS):
            raise HTTPException(status_code=403, detail="only the companion's process on this machine")
        return {"version": version(path), "keys": load(path)}
