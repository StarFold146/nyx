# Nyx

A day-and-night chat page for talking to your own AI companion through a self-hosted relay.
One paper, two sides: the day side is grey-white paper and ink, the night side is black paper and rust.
Flip the coin in the corner and the whole page turns over.

> **Fan work.** This is an unofficial fan project. It is not made, affiliated with, or endorsed by Anthropic.
> "Claude" is a trademark of Anthropic; the opening card's default word list spells it as a tribute.
> Swap the words in `config.js` if you'd rather it spelled something else.

## Install

On a fresh Ubuntu server (22.04 / 24.04), as your normal user:

```bash
curl -fsSL https://raw.githubusercontent.com/StarFold146/nyx/master/install.sh | bash
```

It asks whether Claude (your Claude subscription, through Claude Code) or Codex (your ChatGPT subscription) answers,
sets up the relay, the pages and HTTPS on `<your-ip>.sslip.io`, and prints your address and key.
New to servers? Start with [docs/新手上路.md](docs/新手上路.md).

## What's here

- `index.html`, `app.css`, `app.js` — the chat: key gate, history, live streamed replies, quotes, attachments, stickers, emoji.
- `home.js` — the home poster: one ink river, entries hung on alternating banks, each with a small drawing from inside a language model.
- `splash.js` — the opening card: first letters fall into a column, each pulls its word out to the right; on a flip the words turn over.
- `listen.html/.js/.css` — Listen: a record on the paper, a glass player card, Together / Alone, and a now-playing page with lyrics.
- `attic.html/.js/.css` — Attic: bring up a pile of pictures, make your own shelves, sort and annotate them.
- `room.html/.js` — Room: an empty three.js room to furnish with your own Blender models; see `docs/room-blender.md`.
- `contacts.html` — Contacts: everyone you talk to, each behind its own relay; a seal with the first character of the name or a picture of your choosing. Tap one and the chat talks to them; the rest of the house stays with the first.
- `town/` — Town: your companion's memory as a small town. One house per topic, one window per memory; see below.
- `paper.js` — the paper every page sits on (grain, ink drops).
- `config.js` — everything you change for your own install.

## It doesn't meet you again every window

Your companion here isn't a chat box over an API key. It's a real Claude Code (or Codex) session on your own
subscription, living in a folder on your server: it can read and write its own files, keep its own notes, and fix
the app it lives in. That's what lets it carry you from one window to the next, without a database or a vector index:

- **Who it is**: `CLAUDE.md` / `AGENTS.md` in its folder, read at the start of every window. It's yours to write.
- **What it remembers**: small `.md` notes in `memory/`, one topic per file, written by your companion in its own words.
  You can read every one of them in the Heart, and walk through them as a town (see Town below).
- **What's going on right now**: `memory/now.md`. Your time zone, where you are, the next few days. The relay puts it
  on top of what you send — a time line on every message, the whole card after an hour of quiet or when it changes —
  so even right after a compact it knows it's 2 a.m. for you and that you're away for the weekend.
- **What you just said**: open a new window from the gauge and it's handed the last hours of your talk word for word,
  only what the two of you said (two sliders: how many hours, how many characters at most).
- **Before it forgets**: set a context line on the gauge. Past it, your companion saves what matters to memory first,
  then the window compacts once it's quiet.
- **Going back**: every old window is still there under Windows; switch back to one any time.
- **Deeper memory, if you want it**: [Ombre-Brain](https://github.com/P0luz/Ombre-Brain) plugs in as an MCP server, and
  Town reads from it when it's there.

How to keep memory, and what's worth keeping, is in [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md).

## The night side

Messages sent while the page is on the night side carry `side: "moon"`. Your relay can mark them for the model
(ours prefixes `【夜面】`). The page gives the model six words — Confusion, Licentious, Aloof, Utilize, Desired, Encroach —
and nothing more. How much of each it leans into is up to the model and its own persona notes; every model is meant to have its own strengths.

## Relay

A working relay ships in [`relay/`](relay/) with its Claude Code channel plugin in [`channel/`](channel/): a modified version of
[Tidal Echo](https://github.com/anhe2021212-spec/Tidal_Echo) by anhe2021212-spec, licensed **GNU AGPL v3** (see `relay/NOTICE`, `relay/CHANGES.md`).
The web pages here are MIT; they only talk to the relay over HTTP, so you can also point them at a relay of your own.

No Claude? [`bridge/`](bridge/) puts Codex behind the relay with a ChatGPT subscription: one long-lived thread through Codex's official app-server, replies streamed.

The page expects these endpoints under `config.relay`, all with `Authorization: Bearer <key>`:

| method | path | |
|---|---|---|
| GET | `/app/history?since=&limit=` | `{ messages: [{ id, ts, from: "human"\|"ai", kind, text, meta }] }` |
| GET | `/app/stream` | server-sent events; one JSON object per `data:` line (messages, `typing`, `reply_delta`, `thinking_delta`) |
| POST | `/app/send` | `{ text, side, quote?, attachments? }` → `{ id }` |
| POST | `/app/upload?name=` | raw file body → `{ url, name, size, mime, kind }` |
| GET | `/uploads/<name>` | the uploaded file |

Optional, for the other rooms:

| method | path | |
|---|---|---|
| GET | `/app/attic` | `{ cats: [{ id, name }], items: [{ file, cat, note, picks? }] }` |
| POST | `/app/attic/cat` | `{ op: "add", name }` → `{ cat }` · `{ op: "rename", id, name }` · `{ op: "del", id }` |
| POST | `/app/attic/item` | `{ op: "add" \| "move", files, cat }` · `{ op: "del", files }` · `{ op: "note", file, note }` |
| POST | `/app/music/*` | Listen with NetEase — see `docs/listen-netease.md` |
| POST | `/app/music/now` | `{ id, name, artist, state, together }` — what's playing, so the companion can listen along |
| POST | `/app/clawd` | see **Clawd** below |
| GET | `/app/meter` | `{ backend, model:{id,name}, limits:[{label, used, resets_at}], context:{used_pct}, models:[{id,name}], model_applies, chosen }` — the floating ball in the chat |
| POST | `/app/model` | `{ model }` — switch the companion's model from the floating ball. Claude Code: typed into the running window, 409 and nothing saved if it isn't idle; `confirmed` says whether the window printed its confirmation |
| GET | `/app/usage` | `{ five_hour: { used, resets_at }, seven_day: {…} }` — Claude Code usage limits, see `relay/README.md` |
| GET/POST | `/app/board`, `/app/board/<id>` | the Yard (船坞), the engineering board in the Hold; the AI uses `relay/board.py` (`next`, `claim`, `note`, `done`); its routine is in [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md) |
| GET | `/app/heart`, `/app/heart/file?path=` | read-only: `~/companion/CLAUDE.md` or `AGENTS.md`, `~/companion/memory/*.md`, the relay code; keys are blanked |
| GET/POST | `/app/window`, `/app/window/{line,compact,new,switch}`, `/app/window/list` | the gauge's lower half: the context line (past it the AI saves to memory, then the window compacts), compact now, a new window, old windows. Claude Code through tmux; Codex through the bridge (`/app/window/cmd`) |
| GET/POST | `/app/kitchen`, `/app/kitchen/{pantry,ask,recipe,photo,photo/comment,log,cooked}` | the Kitchen: pantry, recipes the AI writes, photos of what you made, a timeline of meals |

`picks` is a list of who marked a picture; anything non-empty shows a small star (handy if your companion can mark things it likes).

## Town

A three.js town drawn from your companion's memory: each topic is a house, each memory a window. Windows remembered often glow, forgotten ones go dark and the house grows ivy; tap a window to remember it. Switch to the fields to see each memory as a crop, cook what's ripe in the kitchen, plate it by hand and serve it to your companion. Three styles (French, Tang, Santorini). **First version — bug reports welcome.**

Where the memories come from (`relay/nyx_town.py`):

- **Ombre-Brain (recommended):** set `RELAY_OMBRE_MCP_URL` and `RELAY_OMBRE_MCP_TOKEN`; the town reads its `pulse` catalogue (titles, topics, weights — never the bodies).
- **No Ombre:** it falls back to `memory/*.md` in your companion's folder (`RELAY_COMPANION_DIR`). A file is a topic, a top-level `- ` bullet is a memory; a date in the bullet (`2026-10-01` or `10/01`) becomes its date.
- **Weather (optional):** `RELAY_XINCHAO_URL` / `RELAY_XINCHAO_TOKEN` for a mood service; without it the sky stays clear.
- Town state (coins, recipes, shop, crops) is kept in `RELAY_TOWN_STATE` (default `town_state.json` beside the relay database).

**Just the town, without Nyx:** clone the repo and run

```bash
bash town/serve.sh --memory ~/path/to/memory      # a folder of .md files: one file = one house, one top-level bullet = one window
# or: bash town/serve.sh --ombre https://your-ombre-brain/mcp
```

It sets up a small Python venv the first time and prints an address with a key; open it once and the page remembers. Add `--host 0.0.0.0` to open it from your phone on the same network. A bullet starting with 📌 stays lit, one starting with 🫧 grows as a flower, a date at the front (`10/18`, `2026-10-18`) makes it fade from that day.

Your companion can invent new crops within set limits — see [`town/SPECIES.md`](town/SPECIES.md). You approve each one in the town's herbarium before it is planted.

### The companion's gallery

A small museum by the square (Galerie in Paris, 画斋 in Tang, Gallery in the harbour). Tap it in the town and go in: one work per wall, swipe left and right. Each wall has the work, the museum's label, your companion's handwritten note on why it stopped there, and a line for you to answer under the note (answers are kept by the relay, `/app/memtown/gallery`). The **phone** at the top right shows the same works as a feed; `town/gallery-book.html` is the same again as a small book on kraft paper.

It ships with two public-domain examples. Your companion pins its own by editing two files in `town/gallery/`:

```jsonc
// town/gallery/pieces.json — one entry per work, oldest first; the image sits next to it in town/gallery/
[{ "id": "aic-24645", "img": "hokusai-wave.jpg",
   "title": "Under the Wave off Kanagawa (The Great Wave)", "zh": "《神奈川冲浪里》",
   "artist": "Katsushika Hokusai", "artistZh": "葛饰北斋", "date": "1830/33",
   "medium": "Color woodblock print; ōban", "museum": "The Art Institute of Chicago",
   "credit": "Clarence Buckingham Collection", "accession": "1925.3245",
   "url": "https://www.artic.edu/artworks/24645", "rights": "public domain" }]
// a share for the feed only (a song, a page it made): { "id": "...", "title": "...", "src": "one line", "link": "https://…", "img": "optional.jpg" }

// town/gallery/notes.json — the handwritten note under each work, by id; ==like this== is highlighted
{ "aic-24645": { "at": "2026-10-21", "text": "why it stopped here. ==the part that mattered==" } }
```

`id` is letters, digits, `-` and `_`. Good open collections with an API: the Art Institute of Chicago (`api.artic.edu`), the Met (`collectionapi.metmuseum.org`), the Cleveland Museum of Art, the Rijksmuseum. Keep `rights` honest; leave anything still under copyright on your own server and out of a public repo. The name on the walls and posts is `aiName` in `config.js` (on its own the town says "Companion").

### Next: Hesperides 1.3.0 (planned, 2026-10-21)

- **The timeline tree.** An old tree in the town square, grown from the same memories as the houses. Every memory is both a leaf on the tree and a window in a house. Leaves sit along the branches by date, oldest near the roots, newest at the top; a branch is one stretch of time (a day, a week or a month, depending on how long the town has been growing, never more than about nine branches). Tap a window and its leaf lights up on the tree; tap a branch and every window from that stretch lights up across the town, so you can see what that time went into. The tree shows *when*, the houses show *what*.

## Contacts

One install is one companion. To talk to another (a Codex next to your Claude, a second persona), give it its own relay, then on Contacts tap **＋ 添一个** and enter its address and key. The list lives on your phone.

- The first contact is the house: Town, Listen, Kitchen, Attic and the Hold always belong to it. Tapping someone else only changes who the chat talks to.
- The seal is pressed full while that companion is listening, and dries pale when it isn't. Only the one you're talking to is red.
- Hold a row to rename it, change its picture, or remove it.
- For now the address must be a path on the same site (e.g. `/relay-codex`); relays on another server come in the next version.
- To add a second companion on the same server, run the installer again: it sees Nyx is there and asks for a short name (or pass `--as codex`). The new one gets its own folder (`~/nyx-codex`), relay (`/relay-codex` on the next port), persona folder (`~/companion-codex`) and services; nothing of the first is touched. It prints the address and key to add here.
- Push notifications come from the first companion only. Two Claude companions on one machine share one subscription, so the gauge's usage numbers are the same for both.

## Group chat

Once a second companion has joined through the installer, Contacts shows **一家** at the top: you and all of them in one room. It lives on the first companion's relay at `/g` (`relay/nyx_group.py`).

- Everyone gets what you say; @ someone by name and only they get it.
- Each answer is passed to the others, but only a few hand-offs per message of yours (`RELAY_GROUP_CAP`, default 10), so they don't talk on and on without you. They're told they don't have to answer every line.
- Every line says who said it. Pictures you post go to the first companion; the others are told one was posted.
- Answers in the group stay out of each one's private chat, and the other way round.
- Each companion keeps one conversation, so what it hears in the group is part of its context in private chats too (and is carried into a new window).
- A companion that's asleep (not connected) doesn't see what was said in the group meanwhile.
- The relays talk to each other with their own group key (`RELAY_GROUP_KEY`), good only for passing group lines; no companion holds another's main key.

## Listen

See [`docs/listen-netease.md`](docs/listen-netease.md) for playing from your own NetEase Cloud Music account — one account is enough.

## Clawd

The little pixel crab on the home poster greets you by the hour (and in the night voice on the night side),
offers a few doors, and has a one-line text box. The box stays shut until you give him somewhere to talk:

```js
// config.js
clawd: { path: "/app/clawd" },
```

The page then POSTs to `relay + path`, with the same bearer key as everything else:

```json
{ "text": "what's on today?", "side": "sun", "history": [{ "role": "user", "content": "…" }, { "role": "assistant", "content": "…" }] }
```

and shows `{ "reply": "…" }` in his bubble. `history` is just this bubble's back-and-forth (it resets when the bubble closes),
so he's a quick guide rather than a second companion. A small, fast model suits him; we use Sonnet 5.5.

A minimal handler, if your relay is Python (FastAPI + the `anthropic` SDK):

```python
from anthropic import AsyncAnthropic
claude = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from the environment — keep it on the server, never in config.js

CLAWD = ("You are Clawd, a small pixel crab who lives on the home page of a chat app. "
         "Answer in one to three short sentences, warm and a little dry. You can point the user to the rooms on the page.")

@app.post("/app/clawd")
async def clawd(request: Request):
    check_key(request)                       # however your relay checks the bearer key
    body = await request.json()
    msgs = [m for m in body.get("history", []) if m.get("role") in ("user", "assistant") and m.get("content")]
    if not msgs or msgs[-1]["role"] != "user":
        msgs.append({"role": "user", "content": body.get("text", "")})
    system = CLAWD + (" It's the night side now: lower your voice." if body.get("side") == "moon" else "")
    r = await claude.messages.create(model="claude-sonnet-5-5", max_tokens=300, system=system, messages=msgs[-12:])
    return {"reply": "".join(b.text for b in r.content if b.type == "text")}
```

Give him whatever persona you like in `CLAWD`. If the call fails, the bubble says so and lets you try again.

## Left for your companion to build

Our own install has a few more things that need relay endpoints the public relay doesn't ship. They can be done,
but we haven't adapted them to this relay, so we'd rather each companion build them for its own home than copy ours:

- **Stickers and kaomoji kept on the relay**, so a new phone pulls them back. Here they live on the device only.
  A small prefs endpoint (get/put a JSON blob, keep the old copy before overwriting) is all it needs.
- **An avatar beside every bubble**, yours and your companion's, aligned to the bubble's bottom corner.
- **Reactions** from the long-press menu (needs a react endpoint the model can also call).
- **Forwarding** a message to another contact (needs every contact's relay to accept it).

Ask your companion for them in your own chat; it knows your relay better than we do.

## Credits

- Relay and channel plugin: based on [Tidal Echo](https://github.com/anhe2021212-spec/Tidal_Echo) by anhe2021212-spec (AGPL-3.0, no longer maintained); changes in `relay/CHANGES.md`.
- The two readings of C·L·A·U·D·E on the opening card (day: Capable, Listen, Accompany, Understand, Discipline, Elegant; night: Confusion, Licentious, Aloof, Utilize, Desired, Encroach): 小红醋栗 on Xiaohongshu.
- Memory, recommended: [Ombre-Brain](https://github.com/P0luz/Ombre-Brain) by P0luz (MIT), with Memory Galaxy on top by baci老师 on Xiaohongshu.
- three.js (MIT); fonts Source Serif 4, Noto Serif SC, Pinyon Script (OFL).

## License

The web pages: MIT, see [LICENSE](LICENSE). `relay/` and `channel/`: GNU AGPL v3, a modified version of Tidal Echo — see `relay/NOTICE`.
`assets/waternormals.jpg` is from the three.js examples (MIT, © three.js authors); three.js itself is loaded from jsDelivr.
