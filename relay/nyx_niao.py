"""Doors the 祂 (niao/) pages use that the rest of Nyx doesn't need.

  POST /app/react                 {id, emoji}           the human's reaction on a message; empty emoji takes it back
  GET|POST /app/prefs             {ts, data}            a copy of the phone's settings (avatars, stickers, kaomoji…), last writer wins
  GET|POST /app/group_pin         {text}                one pinned line on top of the group chat
  GET /app/pocket?q=&status=      POST /app/pocket {text|url, title?, by?}   POST /app/pocket/{id} {status|text|title|delete}
                                  口袋: things shared from the phone; shared ones (by != "note") reach the AI in one batched note
  GET /app/todo-inbox             POST /app/todo-inbox {text, by}   POST /app/todo-inbox/ack {ids}
                                  a mailbox: the AI drops to-dos, the phone picks them up into its own list
  POST /app/stash/chunk?id=&off=  POST /app/stash/done?id=&size=&name=&mime=   GET /app/stash/list
  GET /app/stash/file/{id}        POST /app/stash/delete?id=
                                  a few big files (recordings, videos) parked on the server; Listen plays recordings from here

Everything sits next to the database (RELAY_DB's folder), never in the web folder.
Mounted from nyx_extras.register. Part of the Nyx relay (a modified version of Tidal Echo), GNU AGPL v3.
"""
import asyncio
import json
import os
import re
import secrets
import shutil
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse

PREFS_MAX_BYTES = 12 * 1024 * 1024
# keys a push that simply doesn't mention them must not wipe (a phone that lost its storage would otherwise blank them)
PREFS_KEEP = ("nyx_avatar", "nyx_stickers", "nyx_kaomoji", "nyx_phrases")
POCKET_NOTIFY_DELAY = int(os.environ.get("RELAY_POCKET_NOTIFY_DELAY", "180"))
TODO_MAX_TEXT, TODO_MAX_BY, TODO_MAX_ITEMS = 200, 20, 100
STASH_CHUNK = 9 * 1024 * 1024
URL_RE = re.compile(r"https?://[^\s<>\"'，。]+")
POCKET_SOURCES = (("xiaohongshu", "小红书"), ("xhslink", "小红书"), ("taobao", "淘宝"), ("tb.cn", "淘宝"), ("163.com", "网易云"),
                  ("163cn", "网易云"), ("jd.com", "京东"), ("bilibili", "B站"), ("b23.tv", "B站"), ("youtube", "YouTube"),
                  ("youtu.be", "YouTube"), ("github", "GitHub"), ("weibo", "微博"), ("douyin", "抖音"), ("zhihu", "知乎"))


def _write_json(path: Path, data, private=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    if private:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    else:
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def register(app, g):
    check_auth, broadcast, now_iso = g["check_auth"], g["broadcast"], g["now_iso"]
    app_subs, plugin_subs = g["app_subs"], g["plugin_subs"]
    db, brain_target, set_reaction = g["db"], g["brain_target"], g["set_reaction"]
    human = g.get("HUMAN_NAME", "对方")
    data_dir = Path(g["DB_PATH"]).parent

    # ---- reactions ----
    @app.post("/app/react")
    async def app_react(request: Request):
        check_auth(request)
        body = await request.json()
        try:
            target_id = int(body.get("id"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="react: numeric id required")
        emoji = str(body.get("emoji") or "").strip()[:16]
        reactions = set_reaction(target_id, "human", emoji)
        if reactions is None:
            raise HTTPException(status_code=404, detail="react: message not found")
        await broadcast(app_subs, {"type": "reaction", "id": target_id, "reactions": reactions, "by": "human"})
        if emoji and brain_target() == "desktop":
            # tell the AI; no "id" in the frame so the channel cursor stays put
            with db() as conn:
                row = conn.execute("SELECT text FROM messages WHERE id = ?", (target_id,)).fetchone()
            snippet = ((row["text"] if row else "") or "").strip().replace("\n", " ")[:40]
            await broadcast(plugin_subs, {"content": f"({human} reacted {emoji} to your message #{target_id}: 「{snippet}」)",
                                          "user": "human", "ts": now_iso(), "attachments": []})
        return {"id": target_id, "reactions": reactions}

    # ---- prefs: one JSON blob {ts, data:{key: string}}, last writer wins by its ts ----
    prefs_file = Path(os.environ.get("RELAY_PREFS_FILE", str(data_dir / "prefs.json")))

    @app.get("/app/prefs")
    async def get_prefs(request: Request):
        check_auth(request)
        return _read_json(prefs_file, {"ts": 0, "data": {}})

    @app.post("/app/prefs")
    async def put_prefs(request: Request):
        check_auth(request)
        raw = await request.body()
        if len(raw) > PREFS_MAX_BYTES:
            raise HTTPException(status_code=413, detail="prefs too large")
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            raise HTTPException(status_code=400, detail="bad json")
        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in data.items()):
            raise HTTPException(status_code=400, detail="data must be {key: string}")
        try:
            ts = int(body.get("ts") or 0)
        except (TypeError, ValueError):
            ts = 0
        ts = min(ts, int(time.time() * 1000))   # a clock from the future would win forever
        old = (_read_json(prefs_file, {}) or {}).get("data") or {}
        for k, v in old.items():
            if k not in data and k.startswith(PREFS_KEEP):
                data[k] = v
        if prefs_file.exists():
            try:
                prefs_file.with_suffix(".prev").write_bytes(prefs_file.read_bytes())
            except Exception:
                pass
        _write_json(prefs_file, {"ts": ts, "data": data}, private=True)
        return {"ok": True, "ts": ts}

    # ---- group pin ----
    pin_file = data_dir / "group_pin.json"

    @app.get("/app/group_pin")
    async def group_pin_get(request: Request):
        check_auth(request)
        return _read_json(pin_file, {"text": "", "at": ""})

    @app.post("/app/group_pin")
    async def group_pin_set(request: Request):
        check_auth(request)
        b = await request.json()
        d = {"text": str(b.get("text") or "").strip()[:1000], "at": now_iso()}
        _write_json(pin_file, d)
        return d

    # ---- 口袋 pocket ----
    pocket_file = data_dir / "pocket.json"
    pending, state = [], {"task": None}

    def pocket_load():
        d = _read_json(pocket_file, [])
        return d if isinstance(d, list) else []

    def pocket_save(items):
        _write_json(pocket_file, items, private=True)

    def pocket_number(items):
        """Every item gets a stable number in the order they came in. True if anything changed."""
        top = max([it.get("no") or 0 for it in items] + [0])
        changed = False
        for it in sorted([it for it in items if not it.get("no")], key=lambda x: x.get("ts", "")):
            top += 1
            it["no"] = top
            changed = True
        return changed

    def pocket_source(url):
        u = (url or "").lower()
        for key, name in POCKET_SOURCES:
            if key in u:
                return name
        return "链接" if u else "笔记"

    async def notify_later():
        await asyncio.sleep(POCKET_NOTIFY_DELAY)
        items, pending[:] = list(pending), []
        state["task"] = None
        if not items:
            return
        lines = []
        for it in items[:8]:
            head = (it.get("title") or it.get("text") or it.get("url") or "").strip().replace("\n", " ")[:80]
            lines.append(f"· [{it['source']}] {head}" + (f"  {it['url']}" if it.get("url") else ""))
        more = f"\n… and {len(items) - 8} more" if len(items) > 8 else ""
        await broadcast(plugin_subs, {
            "content": (f"(Pocket: {human} just dropped {len(items)} thing(s) in; not typed by {human}.)\n" + "\n".join(lines) + more +
                        "\nBring up whatever you're curious about, when it fits. No need to answer each one."),
            "user": "pocket", "ts": now_iso(), "attachments": []})
        ids = {it["id"] for it in items}
        all_items = pocket_load()
        for it in all_items:
            if it.get("id") in ids and it.get("status") == "unread":
                it["status"] = "seen"
        pocket_save(all_items)

    @app.get("/app/pocket")
    async def pocket_list(request: Request, q: str = "", status: str = ""):
        check_auth(request)
        items = pocket_load()
        if pocket_number(items):
            pocket_save(items)
        if status:
            items = [i for i in items if i.get("status") == status]
        if q:
            ql = q.lower()
            items = [i for i in items if ql in (i.get("text", "") + i.get("title", "") + i.get("url", "") + i.get("source", "")).lower()]
        return {"items": items}

    @app.post("/app/pocket")
    async def pocket_add(request: Request):
        check_auth(request)
        ctype = request.headers.get("content-type", "")
        raw = (await request.body()).decode("utf-8", "ignore")
        if "json" in ctype:
            try:
                body = json.loads(raw or "{}")
            except Exception:
                body = {}
        elif "form" in ctype:
            body = dict(urllib.parse.parse_qsl(raw))
        else:
            body = {"text": raw}
        if not isinstance(body, dict):
            body = {}
        text, url, title = (str(body.get(k) or "").strip() for k in ("text", "url", "title"))
        if not url:
            m = URL_RE.search(text)
            if m:
                url = m.group(0)
        if not (text or url):
            raise HTTPException(status_code=400, detail="empty")
        items = pocket_load()
        now = datetime.now(timezone.utc)
        for it in items[:20]:   # the same thing shared twice within ten minutes is one item
            try:
                age = (now - datetime.fromisoformat(it["ts"])).total_seconds()
            except Exception:
                continue
            if age < 600 and ((url and it.get("url") == url) or (not url and it.get("text") == text)):
                return {"ok": True, "id": it["id"], "merged": True}
        item = {"id": secrets.token_hex(6), "ts": now.isoformat(), "text": text[:20000], "url": url[:2000], "title": title[:300],
                "source": pocket_source(url), "status": "unread", "by": str(body.get("by") or "share")[:20]}
        items.insert(0, item)
        pocket_number(items)
        pocket_save(items)
        if item["by"] != "note":
            pending.append(item)
            if state["task"] is None:
                state["task"] = asyncio.create_task(notify_later())
        return {"ok": True, "id": item["id"]}

    @app.post("/app/pocket/{item_id}")
    async def pocket_update(request: Request, item_id: str):
        check_auth(request)
        body = await request.json()
        items = pocket_load()
        for i, it in enumerate(items):
            if it.get("id") == item_id:
                if body.get("delete"):
                    items.pop(i)
                else:
                    for k in ("status", "text", "title"):
                        if isinstance(body.get(k), str):
                            it[k] = body[k][:20000]
                pocket_save(items)
                return {"ok": True}
        raise HTTPException(status_code=404, detail="not found")

    # ---- to-do inbox ----
    todo_file = Path(os.environ.get("NYX_TODO_INBOX", str(data_dir / "todo-inbox.json")))

    def todo_load():
        d = _read_json(todo_file, [])
        return [x for x in d if isinstance(x, dict) and x.get("id")] if isinstance(d, list) else []

    @app.get("/app/todo-inbox")
    async def todo_inbox_list(request: Request):
        check_auth(request)
        return {"items": todo_load()}

    @app.post("/app/todo-inbox")
    async def todo_inbox_add(request: Request):
        check_auth(request)
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="bad json")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="bad body")
        text = " ".join(str(body.get("text") or "").split())[:TODO_MAX_TEXT]
        if not text:
            raise HTTPException(status_code=400, detail="text required")
        by = " ".join(str(body.get("by") or "").split())[:TODO_MAX_BY]
        items = todo_load()
        if len(items) >= TODO_MAX_ITEMS:
            raise HTTPException(status_code=429, detail="inbox full")
        item = {"id": "ti" + secrets.token_hex(5), "text": text, "by": by, "ts": int(time.time() * 1000)}
        items.append(item)
        _write_json(todo_file, items, private=True)
        return {"ok": True, "item": item}

    @app.post("/app/todo-inbox/ack")
    async def todo_inbox_ack(request: Request):
        check_auth(request)
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="bad json")
        ids = body.get("ids") if isinstance(body, dict) else None
        if not isinstance(ids, list):
            raise HTTPException(status_code=400, detail="ids required")
        drop = {str(i) for i in ids}
        items = todo_load()
        keep = [x for x in items if x.get("id") not in drop]
        if len(keep) != len(items):
            _write_json(todo_file, keep, private=True)
        return {"ok": True, "removed": len(items) - len(keep)}

    # ---- stash: big files sent up in chunks, read back only with the key (not under /uploads) ----
    stash_dir = Path(os.environ.get("RELAY_STASH_DIR", str(data_dir / "stash")))
    stash_dir.mkdir(parents=True, exist_ok=True)
    stash_meta = stash_dir / "stash.json"

    def stash_load():
        d = _read_json(stash_meta, {"items": []})
        return d if isinstance(d, dict) and isinstance(d.get("items"), list) else {"items": []}

    def stash_id(v):
        v = str(v or "")
        if not re.fullmatch(r"[0-9a-f]{12}", v):
            raise HTTPException(status_code=400, detail="bad id")
        return v

    @app.post("/app/stash/chunk")
    async def stash_chunk(request: Request):
        check_auth(request)
        q = request.query_params
        sid = stash_id(q.get("id") or secrets.token_hex(6))
        try:
            off = int(q.get("off") or 0)
        except ValueError:
            raise HTTPException(status_code=400, detail="bad off")
        body = await request.body()
        if not body or len(body) > STASH_CHUNK:
            raise HTTPException(status_code=413, detail="chunk size")
        part = stash_dir / (sid + ".part")
        have = part.stat().st_size if part.exists() else 0
        if off != have:
            raise HTTPException(status_code=409, detail=f"expected off {have}")
        with open(part, "ab") as f:
            f.write(body)
        return {"ok": True, "id": sid, "have": have + len(body)}

    @app.post("/app/stash/done")
    async def stash_done(request: Request):
        check_auth(request)
        q = request.query_params
        sid = stash_id(q.get("id"))
        part = stash_dir / (sid + ".part")
        if not part.exists():
            raise HTTPException(status_code=404, detail="no part")
        size = part.stat().st_size
        if str(q.get("size") or "") != str(size):
            raise HTTPException(status_code=409, detail=f"size {size}")
        name = re.sub(r"[\\/\x00-\x1f]", "_", str(q.get("name") or "file"))[:120]
        m = re.search(r"\.([A-Za-z0-9]{1,6})$", name)
        ext = m.group(1).lower() if m else "bin"
        mime = (q.get("mime") or "application/octet-stream")[:80]
        part.rename(stash_dir / f"{sid}.{ext}")
        d = stash_load()
        d["items"].insert(0, {"id": sid, "file": f"{sid}.{ext}", "name": name, "size": size, "mime": mime, "at": now_iso()})
        _write_json(stash_meta, d)
        return {"ok": True, "id": sid}

    @app.get("/app/stash/list")
    async def stash_list(request: Request):
        check_auth(request)
        return {"items": stash_load()["items"], "free": shutil.disk_usage(stash_dir).free}

    @app.get("/app/stash/file/{sid}")
    async def stash_file(request: Request, sid: str):
        check_auth(request)
        sid = stash_id(sid)
        it = next((x for x in stash_load()["items"] if x.get("id") == sid), None)
        if not it:
            raise HTTPException(status_code=404, detail="not found")
        dl = request.query_params.get("dl")
        return FileResponse(stash_dir / it["file"], media_type=it["mime"], filename=it["name"] if dl else None,
                            content_disposition_type="attachment" if dl else "inline")

    @app.post("/app/stash/delete")
    async def stash_delete(request: Request):
        check_auth(request)
        sid = stash_id(request.query_params.get("id"))
        d = stash_load()
        it = next((x for x in d["items"] if x.get("id") == sid), None)
        for f in ([stash_dir / it["file"]] if it else []) + [stash_dir / (sid + ".part")]:
            try:
                f.unlink()
            except FileNotFoundError:
                pass
        d["items"] = [x for x in d["items"] if x.get("id") != sid]
        _write_json(stash_meta, d)
        return {"ok": True}
