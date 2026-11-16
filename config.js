/* Nyx — settings you change for your own install.
   relay: where your relay is mounted (same origin), e.g. "/relay".
   aiName / meName: what the header and quotes call each side. */
window.NYX = {
  relay: "/relay",
  aiName: "Companion",
  meName: "Me",
  title: "Nyx",
  // home: "ink" (the river poster), "tree" (NyxTree) or "niao" (祂, the pages in niao/). Each device can switch in the drawer
  // (祂 switches back with the stamp in its bottom-right corner); this is the default.
  home: "ink",
  // treePhoto: a picture laid under the tree on the night side, pressed dark, e.g. "photos/forest.jpg". Leave null for none.
  treePhoto: null,
  // stickers: folder with <name>.png (or .gif) — [sticker:name] in a message shows it. Leave null for none.
  stickers: null,
  stickerList: [],   // names to offer in the sticker panel, e.g. ["hug", "nod"]

  // the home poster: one block per entry, biggest first. id "chat" opens the chat; anything else needs an href.
  // art: tokens | context | clusters | sampling | beam | gelu | loss (left out = picked in order)
  apps: [
    { id: "chat", en: "Chat", zh: "聊天", art: "tokens" },
    { id: "listen", en: "Listen", zh: "一起听", href: "listen.html", art: "sampling" },
    // a folder: one block on the home page, a small heading with its rooms in the drawer; d is the one line under each room in the folder sheet
    { id: "home", en: "Home", zh: "小家", art: "clusters", apps: [
      { id: "contacts", en: "Contacts", zh: "联系人", d: "跟谁说话，点谁连谁", href: "contacts.html" },
      { id: "attic", en: "Attic", zh: "杂物间", d: "收着的小东西", href: "attic.html" },
      { id: "room", en: "Room", zh: "房间", d: "一间空屋子，自己摆家具", href: "room.html" }] },
    { id: "hold", en: "Hold", zh: "底舱", art: "beam", apps: [
      { id: "memory", en: "Memory", zh: "记忆", d: "写进记忆库的那些" },        // add href: "<your Ombre-Brain / Memory Galaxy address>" once it's set up
      { id: "town", en: "Town", zh: "小镇", d: "一个主题一栋房子，一条记忆一扇窗", href: "town/index.html" },   // the memory town: one house per topic, one window per memory (town/, relay/nyx_town.py)
      { id: "board", en: "Yard", zh: "船坞", d: "它手上在修什么，几只小机各领各的活" },
      { id: "heart", en: "Heart", zh: "心脏", d: "它的人设和后台，只读" }] },
    { id: "life", en: "Life", zh: "生活", art: "context", apps: [
      { id: "kitchen", en: "Kitchen", zh: "厨房", d: "做饭，端给它吃", href: "kitchen.html" }] }
  ],

  // Room: an empty room to furnish with .glb files — docs/room-blender.md
  room: {
    name: "Room",
    size: [3.4, 2.7, 4.4],
    items: []
  },

  // Listen: "files" plays the tracks below; "netease" plays your own NetEase account (docs/listen-netease.md).
  // lines: the two small lines under "Listen with me".
  listen: {
    source: "files",
    tracks: [
      // { src: "music/song.mp3", name: "Song", artist: "Artist", cover: "music/song.jpg", lrc: "music/song.lrc" }
    ]
  },
  // Clawd, the little guide on the home poster. Leave clawd null and his text box stays shut;
  // give it a path on your relay (e.g. "/app/clawd") and he'll talk — README → "Clawd" shows how to wire it to Sonnet.
  clawd: null,
  tagline: "The universe is literally spelling it out for you.",

  // the opening card: one word per row on each side; their first letters spell the column on the left
  // (the two readings of C·L·A·U·D·E, day and night, are from 小红醋栗 on Xiaohongshu)
  splash: {
    sun:  [["Capable", "才干"], ["Listen", "倾听"], ["Accompany", "陪伴"], ["Understand", "理解"], ["Discipline", "纪律"], ["Elegant", "高雅"]],
    moon: [["Confusion", "混乱"], ["Licentious", "纵欲"], ["Aloof", "疏离"], ["Utilize", "利用"], ["Desired", "饥渴"], ["Encroach", "侵犯"]]
  }
};
