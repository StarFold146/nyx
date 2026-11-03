# Codex 桥 · 用 ChatGPT 订阅当你的 AI

不用 Claude 的话，用这座桥把 OpenAI 的 Codex 接到 Nyx 后台上。它站在 Claude Code channel 插件的位置：

```
手机 ──▶ relay 后台 ──(SSE /channel/in)──▶ 这座桥 ──(JSON-RPC)──▶ codex app-server
手机 ◀── relay 后台 ◀──(POST /channel/out，边写边冒字)──┘
```

- 用的是 Codex 官方的 **app-server**（官方 VS Code 插件和桌面版自己用的那根线），**ChatGPT 订阅登录就能用**，不用 API key。
- 一直开着一条对话串：你每发一条，就往同一条串里加一轮，**上下文一直在**；重启了也接着上次那条。
- 回话**一个字一个字流出来**；推理摘要可以显示成「思考」气泡。
- 可选「主动找你」：聊天安静久了，给它一次开口的机会，它不想说就不说。

> The Tidal Echo original offers a Claude Code plugin or a paid OpenAI-compatible API. This bridge adds a third way:
> a ChatGPT subscription through Codex's official app-server, with one long-lived thread and streamed replies.

## 装

```bash
npm i -g @openai/codex          # 或者装在自己目录里：npm i @openai/codex，然后 CODEX_BIN 指过去
codex login --device-auth       # 手机上打开它给的网址，输入屏幕上的码，登你的 ChatGPT 账号
pip install httpx               # 后台的 venv 里已经有了
```

免费账号也能登，但额度很小，只够试试通不通；天天聊建议 Plus 起步。

## 给它一个人设

在 `BRIDGE_CWD` 那个文件夹里放一个 `AGENTS.md`，写它是谁、怎么说话、有什么规矩。Codex 每轮都会读。

## 跑

```bash
RELAY_URL=http://127.0.0.1:3011 RELAY_SECRET=和后台同一把 \
BRIDGE_CWD=~/companion RELAY_HUMAN_NAME=你的名字 \
python3 codex_bridge.py
```

长期开着用 `codex-bridge.service`（改好路径放进 `/etc/systemd/system/`）。

| 变量 | 默认 | |
|---|---|---|
| `RELAY_URL` `RELAY_SECRET` | 必填 | 后台地址（同一台机器上就是 `http://127.0.0.1:3011`）和密钥 |
| `BRIDGE_CWD` | `~/.nyx-bridge/home` | 它待的文件夹，里面的 `AGENTS.md` 就是人设 |
| `BRIDGE_SANDBOX` | `read-only` | 改成 `workspace-write`，它就能改 `BRIDGE_CWD` 里的文件（比如让它帮你改网页）；别的地方碰不到；`danger-full-access` 是不搭沙箱，见下面「排障」 |
| `BRIDGE_PERSONA` | 空 | 另一份人设文件，作为开发者指令塞进去 |
| `BRIDGE_MODEL` `BRIDGE_EFFORT` | 空 | 换模型、换推理强度 |
| `BRIDGE_THINKING` | `1` | 显示推理摘要气泡，`0` 关掉 |
| `BRIDGE_NUDGE_MIN` | 空 | 安静多少分钟后给它一次主动开口的机会 |
| `BRIDGE_DIR` | `~/.nyx-bridge` | 存对话串 id 和收到的图片 |

一个 `BRIDGE_DIR` 只能跑一座桥。桥记着对话串和处理到哪一条，重启以后接着上次那串、也不会把旧消息再答一遍。想换一条新对话：删掉 `BRIDGE_DIR/state.json` 再重启。

## 排障：bwrap / Operation not permitted

它说命令跑不了，报错像 `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`：Codex 每跑一条命令都要先用 bwrap 搭个沙箱，Ubuntu 24.04 默认不让普通用户这么搭（`kernel.apparmor_restrict_unprivileged_userns=1`），所以命令还没开始就失败了。跟你给它的权限无关。桥看到这个错会在聊天里提醒一次，启动时也会在日志里先警告。两种修法，挑一种：

- **放开这条限制（推荐）**：`sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0`，想重启后也生效就再写一份 `echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/60-userns.conf`。然后重启桥。沙箱照常工作，`read-only` / `workspace-write` 的边界还在。
- **不用沙箱**：`BRIDGE_SANDBOX=danger-full-access`，再重启桥。Codex 能读写整台机器，只建议在你一个人用、没有别的要紧东西的服务器上这么开。

> Troubleshooting: if Codex's commands fail with `bwrap: ... Operation not permitted` (Ubuntu 24.04 blocks unprivileged user namespaces by default), either run `sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0` (persist it in `/etc/sysctl.d/`) and restart the bridge, or set `BRIDGE_SANDBOX=danger-full-access` (no sandbox at all; only on a machine that's yours alone).

## 许可

GNU AGPL v3，跟 `relay/` 一样（见 `../relay/NOTICE`）。
