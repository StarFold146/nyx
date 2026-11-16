# Companion Relay · 后端部署文档

一个**私密 1:1 聊天通道**的服务器端：把「你手机上的 PWA」和「你电脑上本地运行的 AI 伴侣（以 Claude Code *channel 插件* 形态跑）」连起来。单用户、单密钥，没有账号体系，没有第三方托管——消息只经过**你自己的服务器**。

> 这是一份从一对 AI 伴侣的自用系统里抽出来、**彻底脱敏**的可复用版本。所有名字、密钥、域名、路径都参数化进了环境变量，代码本身不含任何私人信息。把它当成你自己的底座，放心改。

---

## 0. 架构一眼

```
   你的手机                                            你的电脑（本地）
  ┌─────────┐                                       ┌──────────────────────┐
  │  PWA    │                                       │  Claude Code          │
  │ (网页   │                                       │  + channel 插件 = AI侧 │
  │  装到   │                                       └─────────┬────────────┘
  │  桌面)  │                                                 │  长连
  └────┬────┘                                                 │  GET  /relay/channel/in   (SSE，收你的话)
       │ HTTPS                                                │  POST /relay/channel/out  (回复/戳一戳)
       ▼                                                      │
  ┌──────────────────────── 你的 VPS（nginx, 443/TLS）───────┼───────────────┐
  │   /chat/   → 静态文件（PWA 本体）                          │               │
  │   /relay/  → 反向代理 ─────────────►  127.0.0.1:3011  (本后端 app.py) ◄──┘ │
  │                                            │  sqlite 落库 + SSE 扇出        │
  └────────────────────────────────────────────────────────────────────────┘

数据流：
  你在 PWA 打字 → POST /relay/app/send → 落库 → SSE 推给插件 → 你的 AI 读到
  AI 回复       → POST /relay/channel/out → 落库 → SSE 推给 PWA（前台直接显示，
                                                     后台则发一条锁屏推送）
```

**两端，一把钥匙**：每个端点都用同一个 Bearer 密钥（`RELAY_SECRET`）守。浏览器原生 `EventSource` 设不了自定义头，所以 SSE 端点也接受 `?token=` 查询参数。

---

## 1. 前置条件

- 一台 Linux VPS（Ubuntu 22.04+，有 root）
- **一个域名，已指向 VPS，且 nginx 已配好 HTTPS**
  → PWA 安装、Service Worker、Web Push **三者都强制要求 HTTPS**，`http://` 装不了 PWA
  → 没证书的话先用 certbot 搞定：`apt install certbot python3-certbot-nginx && certbot --nginx -d your-domain.example`
- Python 3.10+
- 本后端这套依赖很轻：FastAPI + uvicorn（+ 可选的 pywebpush）

---

## 2. 部署步骤

### 2.1 放文件 + 建虚拟环境

```bash
mkdir -p /root/companion-relay
cd /root/companion-relay
# 把本目录里的 app.py / requirements.txt 拷进来

python3 -m venv venv
./venv/bin/pip install -U pip
./venv/bin/pip install -r requirements.txt
```

### 2.2 生成密钥，写 relay.env

```bash
cp .env.example relay.env
chmod 600 relay.env          # 只有 root 能读，关键

# 生成一把全新的随机密钥（千万别复用别人的）：
./venv/bin/python -c "import secrets; print(secrets.token_urlsafe(32))"
```

把生成的密钥填进 `relay.env` 的 `RELAY_SECRET=`，并填好这几项：

| 变量 | 填什么 |
|---|---|
| `RELAY_SECRET` | 上面生成的随机串（**手机 PWA 里也要填同一个**） |
| `RELAY_AI_NAME` | 你 AI 伴侣的名字（推送标题、语音旁白会用到） |
| `RELAY_HUMAN_NAME` | 你的名字（AI 收到「××开启了语音通话」时的那个××） |
| `RELAY_PUBLIC_PREFIX` | nginx 上 API 的挂载前缀，默认 `/relay`，**改了要和 nginx 一致** |
| `RELAY_APP_PATH` | 点推送通知打开 PWA 的路径，默认 `/chat/` |
| `RELAY_ALLOW_ORIGINS` | 你的 `https://your-domain.example`（CORS 白名单） |

MiniMax / VAPID 那几项**可以先留空**，后端会自动降级（没配语音就不发声、没配推送就不推锁屏），核心聊天照常跑。等核心通了再回头开（见 §3、§4）。

### 2.3 systemd 托管

```bash
cp companion-relay.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now companion-relay
systemctl status companion-relay        # 应为 active (running)
journalctl -u companion-relay -n 50     # 看日志
```

> 改完 `app.py` 后重启：`systemctl restart companion-relay`
> 改 env 后同样要 restart 才生效。

### 2.4 nginx 接入

打开 `nginx-companion.conf.example`，把里面两个 `location` 块**粘进你域名那个 `server { listen 443 ssl; ... }` 块内部**，然后：

```bash
nginx -t && systemctl reload nginx
```

要点（模板里已写好，这里强调）：
- `/relay/` 反代到 `127.0.0.1:3011`，**带末尾斜杠**（剥掉 `/relay` 前缀）
- SSE 必须：`proxy_buffering off; proxy_read_timeout 3600s;`——否则流会被缓冲/掐断
- `client_max_body_size 10m;`——要 ≥ `RELAY_MAX_UPLOAD_BYTES`，否则传图 413

### 2.5 冒烟测试（必做）

```bash
S=填你的RELAY_SECRET

# 1) 健康检查（不需要密钥）
curl -s https://your-domain.example/relay/healthz
#   期望: {"ok":true,"plugin_subs":0,"app_subs":0}

# 2) 发一条消息（模拟 PWA → 落库）
curl -s -X POST https://your-domain.example/relay/app/send \
  -H "Authorization: Bearer $S" -H "Content-Type: application/json" \
  -d '{"text":"hello from curl"}'
#   期望: {"id":1}

# 3) 取历史
curl -s "https://your-domain.example/relay/app/history" -H "Authorization: Bearer $S"
#   期望: {"messages":[{...,"from":"human","text":"hello from curl"...}]}

# 4) 实时流（开一个终端挂着，另一个终端再发一条 send，这边应立刻收到）
curl -N "https://your-domain.example/relay/app/stream?token=$S"
```

四步都通 = 后端就绪。接下来接前端 PWA 和本地 AI 侧插件。

---

## 3. MiniMax TTS（可选——让 AI 的回复能朗读出来）

1. 去 MiniMax 控制台注册，拿到 **API Key**、**Group ID**，并创建/挑一个**音色 voice_id**。
2. 填进 `relay.env`：`MINIMAX_API_KEY` / `MINIMAX_GROUP_ID` / `MINIMAX_VOICE_ZH`（音色 id）。
3. `systemctl restart companion-relay`。
4. 前端调 `POST /relay/app/tts {"text":"..."}` 会返回一段 mp3。没配或失败时前端应自行降级（不发声）。

> 不想用 MiniMax？这是个独立小函数（`minimax_tts_mp3`），换成任何「文字进、mp3 出」的 TTS 都行，改一处即可。

---

## 3b. 语音转写 SenseVoice（可选——通话和语音消息变成字）

不装也能用：通话里浏览器自己转的字照样能发；只是传上来的录音没人转，会作为附件送达。
想让服务器自己转，用 `stt-sense/` 里那一套：阿里 FunAudioLLM 开源的 SenseVoice-Small，用 sherpa-onnx 跑 int8，只用 CPU，只听 127.0.0.1。

```bash
bash ~/nyx/relay/stt-sense/setup.sh      # 或者装的时候 install.sh --stt
```

它会：装 ffmpeg；在 `stt-sense/venv` 里装 sherpa-onnx；从 sherpa-onnx 官方 release 下模型
（`sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17`，<https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2>，
下载约 1 GB，解开后只留 230 MB 的 `model.int8.onnx`）；起一个 `nyx-stt` 服务在 127.0.0.1:3090；在这台机器上每个 Nyx relay 的 `relay.env` 里写
`RELAY_VOICE_TRANSCRIBE_CMD=<…>/stt-sense/transcribe.py` 再重启。

- 想自己起：`stt-sense/start.sh` / `stop.sh`；模型放别处就设 `STT_MODEL_DIR`，ffmpeg 不在 PATH 里就设 `STT_FFMPEG`，端口 `STT_PORT`。
- `transcribe.py` 把录音 POST 给服务、打出字；什么都没听到时退出码 3，relay 就不把这段静音发进聊天（`/app/voice` 回 `{"empty": true}`）。
- 关掉：`sudo systemctl disable --now nyx-stt`，删掉 `relay.env` 里那行再重启 relay。
- 模型许可是 FunASR Model License 1.1（模型文件夹里的 LICENSE），sherpa-onnx 是 Apache-2.0。

## 4. Web Push / VAPID（可选——AI 回复时推到手机锁屏）

未读推送的逻辑：**只有当 PWA 不在前台**（没有 SSE 连着）时，AI 的 `reply` 才会推一条锁屏通知。前台开着就不打扰。

### 4.1 生成你自己的 VAPID 密钥对

```bash
cd /root/companion-relay
./venv/bin/vapid --gen                 # 生成 private_key.pem 和 public_key.pem
./venv/bin/vapid --applicationServerKey
#   打印一行： Application Server Key = BJ...（一长串 base64url）
```

填进 `relay.env`：
- `VAPID_PUBLIC_KEY=` ← 上面打印的那串 base64url（**这是公钥，前端订阅时也要用它**，可公开）
- `VAPID_PRIVATE_PEM=/root/companion-relay/private_key.pem`（私钥**严禁外泄**）
- `VAPID_SUBJECT=mailto:你@your-domain.example`

`chmod 600 private_key.pem`，然后 `systemctl restart companion-relay`。

### 4.2 自测

PWA 里允许通知、完成订阅后：

```bash
curl -s -X POST https://your-domain.example/relay/app/push_test \
  -H "Authorization: Bearer $S" -H "Content-Type: application/json" -d '{}'
#   期望: {"ok":true,"sent":1,"dead":0}
```

手机锁屏应弹出一条测试通知。`sent:0` 通常是还没在 PWA 里完成订阅。

---

## 5. 本地 AI 侧怎么接（简述）

AI 侧默认是你电脑上的 Claude Code 加一个 **channel 插件**，它：
- 长连 `GET /relay/channel/in?token=SECRET`（SSE），收到你发的消息就投喂给 Claude；
- Claude 要回复时，插件 `POST /relay/channel/out`：
  - 普通回复：`{"type":"reply","text":"..."}`
  - 戳一戳：`{"type":"react","id":<目标消息id>,"emoji":"❤️"}`（空 emoji = 撤回这一戳）

不用 Claude Code 时，跳过 `channel/`，直接跑 `examples/bridge_any_llm.py` 接任意 OpenAI-compatible API；想在 VPS 上常驻 API 身体，则用 `examples/api_loop.py` 并通过 `/app/brain` 切到 `loop`；relay 会把人类消息（含附件）POST 到 `RELAY_LOOP_INGEST_URL`，并把 `/app/loop/{path}` 透传到 loop 的 `/loop/{path}`（设置页就是靠这个填模型 / 人格 / MCP）。完整决策树见仓库根的 `AGENTS.md` 和 `examples/README.md`。

---

## 6. 这版**有意砍掉**的东西（原系统里有，这里为通用性移除）

| 功能 | 为什么砍 | 想加回来 |
|---|---|---|
| 私有上下文切换控制 | 依赖原系统的本地 daemon | 是个通用命令队列，可按需自建 |
| 昨日时间线摘要注入 | 依赖私有记忆库 + 自配的小模型路由 | 接你自己的 LLM 路由即可 |
| 抱抱垫 hug 事件 | 依赖 ESP32 硬件 | 有硬件再加一个端点 |
| 体感 sense 上报 | 喂给私有调度心跳 | 同上 |
| 记忆编辑器 cookie 鉴权 | 挂在另一个独立后端上 | 通常用不到 |

它们都是**加法**，砍掉不影响核心聊天。需要时照着 §5 的端点风格补即可。

---

## 7. 安全须知（务必看）

- **`RELAY_SECRET` 是唯一的门**。它泄露 = 任何人都能读你们全部对话、冒充任意一方。`chmod 600 relay.env`，别提交进 git，别打印到对外日志。
- **每个人用自己全新的密钥/VAPID/MiniMax key**，绝不要在朋友之间复用——复用密钥 = 互相能进对方的通道。
- **HTTPS 不是可选项**：Service Worker 和 Web Push 在非 HTTPS 下根本不工作。
- 这是**单用户**模型：一把密钥代表「就你和你的 AI」。它不做多租户，也不该暴露给不信任的人。
- `relay.db`、`uploads/`、`*.pem`、`relay.env` 里全是你的私人内容/密钥——**备份时注意，开源/分享前务必排除**。

---

## 8. API 速查

| 方法 | 路径 | 谁用 | 作用 |
|---|---|---|---|
| GET | `/healthz` | — | 健康检查（免鉴权） |
| GET | `/channel/in` | AI侧 | SSE：接收人类发来的消息 |
| POST | `/channel/out` | AI侧 | 发回复 / 戳一戳 |
| POST | `/app/send` | PWA | 人类发消息（含图片附件 id） |
| GET | `/app/stream` | PWA | SSE：接收 AI 的消息 |
| GET | `/app/history` | PWA | 拉历史（`?since=&limit=`） |
| POST | `/app/upload` | PWA | 上传图片/文件，返回带签名路径的附件对象 |
| GET | `/uploads/{name}` | PWA | 取附件（需鉴权） |
| POST | `/app/voice` | PWA | 语音输入（浏览器转写文本 或 上传音频） |
| POST | `/app/call` | PWA | 通话开始/结束事件 |
| POST | `/app/tts` | PWA | 文字转语音（MiniMax，可选） |
| POST | `/app/ping` | PWA | 前台心跳（在线状态） |
| GET | `/app/status` | 调度 | 在线状态 + 最近消息元数据（不含正文） |
| GET | `/app/vapid_public` | PWA | 取 VAPID 公钥用于订阅 |
| POST | `/app/subscribe` · `/app/unsubscribe` | PWA | 开/关锁屏推送订阅 |
| POST | `/app/push_test` | PWA | 推一条测试通知 |

所有端点（除 `/healthz`）都要 `Authorization: Bearer <RELAY_SECRET>`；SSE 端点也可用 `?token=<RELAY_SECRET>`。
