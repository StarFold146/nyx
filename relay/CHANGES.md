# 改了什么 · What changed from Tidal Echo

底子是 [Tidal Echo](https://github.com/anhe2021212-spec/Tidal_Echo)（作者 anhe2021212-spec，commit `860e5de`）。原作者已经停更，这里接着维护，改动都写在这儿。
Based on Tidal Echo by anhe2021212-spec (commit `860e5de`). The original is no longer maintained; changes are listed here.

## `relay/app.py`（只动了四处，都标了 `[Nyx]`）

1. `/app/send` 收下 Nyx 聊天页发来的 `quote`（引用的气泡）和 `side`（`sun` 白天 / `moon` 夜里），存进消息的 `meta`。
2. 推给 AI 的那条消息里，引用写成一行「（引用谁：「…」）」放在前面；夜里发的消息开头加 `RELAY_NIGHT_MARK`（默认 `【夜面】`），AI 就知道现在是哪一面。
3. 文件末尾挂上 `nyx_extras.py`。
4. 启动时把 `nyx_extras.py` 登记的后台任务（压缩线巡查）跑起来。

## Plugin hooks on the message path (`relay/app.py`)

- `HOOKS` (in `globals()`): `inbound_meta(body, meta)`, `plugin_payload(pl, msg)` (sync, runs inside `plugin_payload()` so live messages, voice, uploads and the `/channel/in` backfill all pass through it), `inbound_payload(pl, body)` (async, `/app/send` live only), `outbound_meta(body, meta)`, `after_out(kind, text, msg)`. Plugins append functions in their `register(app, g)`; they run in registration order, and a hook that raises is logged and skipped instead of breaking the message.
- `RELAY_PLUGINS=mod1,mod2`: comma-separated module names, each imported after `nyx_extras` and mounted with `register(app, globals())`. A module that is not found is a warning, not a crash; any other error while importing or registering a plugin stops startup.
- `/app/send` accepts a message with no text if it carries a `forward`. New in `globals()`: `ai_listening()`, `message_text_by_id()`, `STARTUP_HOOKS` (coroutine functions started at startup).

## Busy and board tweaks (`relay/nyx_extras.py`)

- `GET /app/busy` (Claude Code) now also works with newer Claude Code builds that no longer print "esc to interrupt": a running turn is recognised by the spinner line. It reports `effort` (read from the pane badge, falling back to the last level in `effort_now` next to the database) and `pending_effort` (the level in `effort_pending`, if one is waiting for an idle moment). `waiting` (a confirm box) is only reported once the box has stayed for 45 seconds and the input box is gone, because auto mode flashes the box for a few seconds before letting a command through.
- `RELAY_BOARD_FILE`: where `board.json` lives (default: next to the database), so several relays can share one board.
- `GET /app/history?tail=N` (`relay/app.py`): the newest N messages, oldest first. `since=0` returns the oldest 200, so a long chat never reached its recent part. `since`/`limit` behave as before and win when `since` is given.

## `relay/nyx_extras.py`（新文件）

Nyx 其他房间要的接口，每个都可以不装，没装的那个只回 503：

- 阁楼 Attic：`GET /app/attic`、`POST /app/attic/cat`、`POST /app/attic/item`
- 一起听 Listen：`POST /app/music/<action>`、`GET|POST /app/music/now`，接本机的网易云小桥（见 `docs/listen-netease.md`）
- 小螃蟹 Clawd：`POST /app/clawd`，设了 `ANTHROPIC_API_KEY` 才开
- 额度 Usage：`GET /app/usage`，读 Claude Code 状态栏存下来的五小时 / 一周用量
- 仪表 Meter / Model：`GET|POST /app/meter`、`GET|POST /app/model`，悬浮球里的模型、额度、上下文。Claude Code 的模型当场打进窗口（窗口确认了才存），模型和上下文按当前窗口算
- 分身 Subagents：`GET /app/agents`，当前窗口用 Agent 工具开的分身，`description`、`status`（三分钟内 transcript 有动静算 `moving`，估的）、`last_active`、`started_at`；聊天框上的思考小螃蟹和主屏 Clawd 点一下会列出在忙的
- 工程板 Board：`GET|POST /app/board`、`POST /app/board/<id>`，AI 用 `relay/board.py`
- 心脏 Heart：`GET /app/heart`、`GET /app/heart/file`，只读人设、记忆文件夹、后台代码，钥匙打码
- 窗口 Window：`GET /app/window`、`POST /app/window/{line,compact,new,switch}`、`GET /app/window/list`；压缩线（过线先让 AI 写记忆，安静下来自动压缩）、压缩一下、开新窗口、回到旧窗口。Claude Code 走 tmux，Codex 由 bridge 来取命令（`GET /app/window/cmd`）

## `channel/`

`server.ts` 原样未改。新增 `start-channel.sh`（`NYX_RESUME=<会话 id>` 时接着开旧窗口） 和 `claude-companion.service`：让 Claude Code 在服务器上的 tmux 里常驻、开机自启，并自动点掉新版 Claude Code 加载开发中 channel 时弹的确认。原版假设 AI 跑在你自己电脑上。

## `bridge/`（新增）

`codex_bridge.py`：用 Codex 官方 app-server 把 ChatGPT 订阅接成后台的「AI 那一头」。一条常驻对话串、回话流式、可选主动开口。原版只有 Claude Code 插件和付费 API 两条路，这是第三条。

## 密钥（新增 `relay/nyx_keys.py`）

聊天页 Gauge 最底下的 keys：给 AI 的 API key 从手机填进服务器上的 `agent-keys.env`（600），备注另存，值不再回到页面，会改 shell/代理/Agent 行为的名字一律拒收。Claude Code 由 `start-channel.sh` 在开窗时告诉它文件位置；Codex 桥经 `/channel/keys`（只认本机直连）抄一份 600 的副本并告诉它位置。两边都是用到时在那条命令里 source，不重启。原版没有这一块。
