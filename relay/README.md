# Nyx relay · 后台

手机上的 Nyx 页面和服务器上的 AI 之间传话的那一层，加上 Claude Code 那头的 channel 插件（在 `../channel`）。

**出处**：这一层是 [Tidal Echo](https://github.com/anhe2021212-spec/Tidal_Echo)（作者 anhe2021212-spec）的修改版。原作者已经停更，我们接着维护，改了哪些写在 [CHANGES.md](CHANGES.md)。
这一层按原作者的许可走 **GNU AGPL v3**（见 [LICENSE](LICENSE)、[NOTICE](NOTICE)）；仓库根目录的 Nyx 网页是另外一块，署名-非商业性使用 4.0（CC BY-NC 4.0，见根目录 LICENSE）。

> The relay and channel plugin are a modified version of Tidal Echo by anhe2021212-spec, licensed GNU AGPL v3.
> The Nyx web pages in the repository root are separate work under CC BY-NC 4.0 (see the root LICENSE).

## 里面有什么

| 文件 | |
|---|---|
| `app.py` | 原作者的后台：存聊天、两头 SSE 推送、上传、锁屏通知。改了三处，标着 `[Nyx]` |
| `nyx_extras.py` | Nyx 多出来的房间：阁楼、一起听、小螃蟹、额度 |
| `statusline-usage.sh` | Claude Code 状态栏脚本，把五小时 / 一周额度存下来给 `/app/usage` |
| `DEPLOY.md` | 原作者的部署说明（nginx 版）。我们的一行安装脚本做好以前，照它装 |

## 要设的环境变量

原作者那些照旧（`RELAY_SECRET` 必填，其余见 `DEPLOY.md`），Nyx 多加的都是可选：

| 变量 | 默认 | |
|---|---|---|
| `RELAY_NIGHT_MARK` | `【夜面】` | 夜里那面发的消息，AI 收到时开头带的记号；设成空就不加 |
| `RELAY_NCM_DIR` | `~/ncm` | 网易云小桥在哪（`docs/listen-netease.md`） |
| `ANTHROPIC_API_KEY` | 空 | 设了小螃蟹才会说话 |
| `RELAY_CLAWD_MODEL` | `claude-sonnet-5-5` | 小螃蟹用的模型 |
| `RELAY_CLAWD_PERSONA` | 一只像素小螃蟹 | 小螃蟹的人设 |
| `RELAY_USAGE_FILE` | `~/.claude/usage/latest.json` | 状态栏脚本存额度的地方 |

额度要在 `~/.claude/settings.json` 里接上状态栏：

```json
"statusLine": { "type": "command", "command": "/path/to/nyx/relay/statusline-usage.sh" }
```
