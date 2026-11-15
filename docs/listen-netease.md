# Listen · 接网易云

> English summary: the Listen page can play from your own NetEase Cloud Music account through a tiny bridge on your server.
> One account is enough — you play, the page tells your relay what's on, and your companion hears about it.
> No second account, no in-app "listen together" invite.

## 为什么一个号就够

网易云自带的「一起听」要两个号：你开房，对方的号进来。让 AI 陪你听的时候，一般做法是给它开个副号、你去邀请它。

这里不走那条路。歌是**你自己的号**在放，页面每换一首就告诉你的中转（relay）「现在在放什么」，中转再把这句话转给 AI。
AI 不需要进房间，它要的只是歌名、歌手和歌词，这些用你的号就能查到。

```
手机上的 Listen 页 ──(换歌)──▶ 你的 relay ──▶ 告诉 AI：她在放《xx》
        │                        │
        └──(搜歌/歌单/取播放地址)──▶ 网易云小桥（只在服务器本机）──▶ 网易云
```

## 要准备的

- 一台你自己的服务器（relay 已经跑在上面的那台）
- Node.js 18+
- 你的网易云账号（VIP 歌要 VIP 才放得出来）

## 1. 装小桥

```bash
mkdir -p ~/ncm && cd ~/ncm
npm init -y
npm install NeteaseCloudMusicApi qrcode
```

`NeteaseCloudMusicApi` 是社区做的非官方接口，原作者已经不维护了，能用但随时可能变；用之前自己掂量。

`server.js`，只听本机端口，cookie 不出这台机器：

```js
const n = require('NeteaseCloudMusicApi'), fs = require('fs'), http = require('http');
const ALLOW = new Set(['cloudsearch', 'user_playlist', 'playlist_track_all', 'recommend_songs',
  'song_url_v1', 'lyric', 'song_detail', 'record_recent_song', 'login_status']);
const cookie = () => fs.readFileSync(__dirname + '/cookie.txt', 'utf8').trim();
http.createServer((req, res) => {
  const action = req.url.replace(/^\//, '').split('?')[0]; let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    res.setHeader('Content-Type', 'application/json');
    if (!ALLOW.has(action)) { res.statusCode = 404; return res.end('{"error":"not allowed"}'); }
    try {
      const q = { ...(body ? JSON.parse(body) : {}), cookie: cookie(), timestamp: Date.now() };
      let r;
      try { r = await n[action](q); } catch (e) {
        // 海外服务器上 song_url_v1 常被风控挡（-460「网络环境存在风险」），改走老接口 song_url，返回结构一样
        if (action !== 'song_url_v1' || !(e && e.body && e.body.code === -460)) throw e;
        r = await n.song_url({ ...q, br: { standard: 128000, higher: 192000, exhigh: 320000 }[q.level] || 999000 });
      }
      res.end(JSON.stringify(r.body));
    } catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: (e && e.body) || String(e) })); }
  });
}).listen(3020, '127.0.0.1');
```

白名单里只放读的东西。点赞、改歌单这类写操作想要再自己加。

## 2. 扫码登录

`login.js`，生成一张二维码图片，用手机网易云扫：

```js
const n = require('NeteaseCloudMusicApi'), QR = require('qrcode'), fs = require('fs');
(async () => {
  const key = (await n.login_qr_key({ timestamp: Date.now() })).body.data.unikey;
  const url = (await n.login_qr_create({ key, timestamp: Date.now() })).body.data.qrurl;
  await QR.toFile('login.png', url, { width: 600, margin: 3 });
  console.log('scan login.png with the NetEase app');
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    const r = (await n.login_qr_check({ key, timestamp: Date.now(), noCookie: true })).body;
    if (r.code === 800) { console.log('expired, run again'); process.exit(1); }
    if (r.code === 803) { fs.writeFileSync('cookie.txt', r.cookie, { mode: 0o600 }); console.log('logged in'); process.exit(0); }
  }
})();
```

```bash
node login.js        # 把 login.png 拿到手机上扫，确认登录
rm login.png
node server.js       # 之后让它常驻：systemd、pm2 都行
```

`cookie.txt` 等于你的登录态，别提交进 git，别放进网站目录，别贴给任何人（包括聊天里的 AI）。过期了重扫一次就行。

## 3. relay 上开几条路

页面认这几条，全部带 `Authorization: Bearer <key>`：

| 页面调用 | 转给小桥 | 用途 |
|---|---|---|
| `POST /app/music/search {keywords, limit}` | `cloudsearch` | 搜歌 |
| `POST /app/music/daily` | `recommend_songs` | 每日推荐 |
| `POST /app/music/recent {limit}` | `record_recent_song` | 最近播放（手机上听过的也在） |
| `POST /app/music/me` | `login_status` | 拿你的 uid（歌单要用） |
| `POST /app/music/playlists {uid}` | `user_playlist` | 你的歌单 |
| `POST /app/music/tracks {id}` | `playlist_track_all` | 歌单里的歌 |
| `POST /app/music/url {id, level}` | `song_url_v1` | 播放地址 |
| `POST /app/music/lyric {id}` | `lyric` | 歌词（lrc） |
| `POST /app/music/now {id, name, artist, state, together}` | — | 页面报「现在在放什么」 |

Python（FastAPI）的样子：

```python
import httpx
ACTIONS = {"me": "login_status", "search": "cloudsearch", "daily": "recommend_songs", "recent": "record_recent_song",
           "playlists": "user_playlist", "tracks": "playlist_track_all", "url": "song_url_v1", "lyric": "lyric"}
now = {"id": None}

@app.post("/app/music/now")
async def music_now(request: Request):
    check_key(request)
    b = await request.json()
    if b.get("id") and b["id"] != now["id"] and b.get("together"):
        await tell_companion(f"(Listen) She's playing {b.get('name')} — {b.get('artist')}. Song id {b['id']}.")
    now.update(b)
    return {"ok": True}

@app.post("/app/music/{action}")
async def music_call(request: Request, action: str):
    check_key(request)
    if action not in ACTIONS: raise HTTPException(404)
    async with httpx.AsyncClient() as c:
        r = await c.post(f"http://127.0.0.1:3020/{ACTIONS[action]}", json=await request.json(), timeout=20)
    data = r.json()
    if action == "url":  # iOS won't play http audio inside an https page
        for d in data.get("data") or []:
            if (d.get("url") or "").startswith("http://"): d["url"] = "https://" + d["url"][7:]
    return data
```

`tell_companion` 换成你家 relay 往 AI 那边推消息的方法。想让它顺手看歌词，就再给它一个能调 `/app/music/lyric` 的工具。

## 4. 打开

`config.js` 里：

```js
listen: { source: "netease" },
```

Listen 页右上「一起听 / 自己听」：一起听开着，每换一首 AI 就知道；切到自己听，页面照放，只是不再告诉它。

## 常见坑

- **放不出来**：VIP 歌、版权下架的歌拿不到地址；海外 IP 也有一部分歌是灰的。
- **iPhone 后台断了**：PWA 切到后台久了会被系统停掉，回来点一下继续。
- **最近播放空的**：网易云那边要隔一会儿才同步手机上的记录。
