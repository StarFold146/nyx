#!/usr/bin/env bash
# Nyx — one-line install on a fresh Ubuntu server (22.04 / 24.04).
#
#   curl -fsSL https://raw.githubusercontent.com/StarFold146/nyx/master/install.sh | bash
#   (or, from a clone:  bash install.sh)
#
# Options:  --ai claude|codex   --ai-name NAME   --me-name NAME   --dir PATH (default ~/nyx)
#           --as SLUG   add another companion next to the first (e.g. --as codex): its own folder ~/nyx-SLUG,
#                       relay on the next port at /relay-SLUG, persona in ~/companion-SLUG. The pages, the town,
#                       Listen and the rest stay with the first; the new one shows up in Contacts.
#           --consent person|chat   who can say yes to sending things out / spending / deleting:
#                       person (default) = only on the server itself; chat = a yes typed in the Nyx chat counts too.
#                       Change it later with: bash ~/nyx/consent.sh chat|person
#           Run again on a server that already has Nyx and it asks whether to add another instead of reinstalling.
#
# What it does: installs the relay (Python), the web pages, Caddy with automatic HTTPS on
# <your-ip>.sslip.io, and either Claude Code + the channel plugin or Codex + the bridge;
# sets everything to start at boot; prints the address and the key.
# Run it as your normal user (not root). It asks for sudo when it needs it.
set -euo pipefail

AI=""; AI_NAME=""; ME_NAME=""; DIR=""; SLUG=""; CONSENT=""; REPO="https://github.com/StarFold146/nyx.git"
while [ $# -gt 0 ]; do
  case "$1" in
    --ai) AI=$2; shift 2 ;;
    --ai-name) AI_NAME=$2; shift 2 ;;
    --me-name) ME_NAME=$2; shift 2 ;;
    --dir) DIR=$2; shift 2 ;;
    --as) SLUG=$2; shift 2 ;;
    --consent) CONSENT=$2; shift 2 ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
done

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ask()  { local v; read -r -p "$1 " v </dev/tty; printf '%s' "${v:-$2}"; }
[ "$(id -u)" = 0 ] && { echo "Run this as your normal user, not root (it uses sudo when needed)."; exit 1; }
command -v sudo >/dev/null || { echo "sudo is required."; exit 1; }

# a second (third…) companion: everything that names the first gets a suffix, nothing of the first is touched
if [ -z "$SLUG" ] && [ -f /etc/systemd/system/nyx-relay.service ]; then
  echo "Nyx is already on this server."
  SLUG=$(ask "Add another companion next to it? Give it a short name in letters (e.g. codex), or leave empty to reinstall the first:" "")
fi
SLUG=$(printf '%s' "$SLUG" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9')
if [ -n "$SLUG" ]; then
  [ -f /etc/systemd/system/nyx-relay.service ] || { echo "--as needs a first Nyx on this server; install that first."; exit 2; }
  SFX="-$SLUG"; PORT=""
  [ -f "/etc/systemd/system/nyx-relay-$SLUG.service" ] && PORT=$(sed -n 's/.*--port \([0-9]*\).*/\1/p' "/etc/systemd/system/nyx-relay-$SLUG.service")
  if [ -z "$PORT" ]; then PORT=3012; while grep -qs -- "--port $PORT " /etc/systemd/system/nyx-relay*.service || ss -ltn 2>/dev/null | grep -q ":$PORT "; do PORT=$((PORT + 1)); done; fi
  # everything the second one leans on, checked before anything is written
  FIRST=$(sed -n 's/^WorkingDirectory=//p' /etc/systemd/system/nyx-relay.service)
  FIRST_HOST=$(sed -n 's/^NYX_HOST=//p' "$FIRST/relay.env" 2>/dev/null || true)
  grep -qP '^\s*handle_path /relay/\*' /etc/caddy/Caddyfile 2>/dev/null || { echo "Can't find the first companion's 'handle_path /relay/*' in /etc/caddy/Caddyfile (edited by hand?). Add a 'handle_path /relay-$SLUG/*' block pointing at the next free port yourself, or put that line back, then run again."; exit 2; }
  [ -f /var/www/nyx/contacts.html ] || { echo "The app's pages here are older than Contacts. Run the installer once without --as (leave the name empty) to update the first companion, then add $SLUG."; exit 2; }
else
  SFX=""; PORT=3011
fi
[ -n "$DIR" ] || DIR="$HOME/nyx$SFX"
CDIR="$HOME/companion$SFX"; PREFIX="/relay$SFX"; TM="companion$SFX"

[ -n "$AI" ] || AI=$(ask "Who answers — claude or codex? [claude]" claude)
case "$AI" in claude|codex) ;; *) echo "--ai must be claude or codex"; exit 2 ;; esac
[ -n "$AI_NAME" ] || AI_NAME=$(ask "Your companion's name? [Companion]" Companion)
[ -n "$ME_NAME" ] || ME_NAME=$(ask "Your name? [Me]" Me)
if [ -z "$CONSENT" ]; then
  yn=$(ask "Should a yes you type in the chat be enough for it to send things out, spend money or delete your data? (y = the chat counts, n = only when you confirm on the server) [n]" n)
  case "$yn" in y|Y|yes) CONSENT=chat ;; *) CONSENT=person ;; esac
fi
case "$CONSENT" in person|chat) ;; *) echo "--consent must be person or chat"; exit 2 ;; esac

say "1/7 System packages"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl rsync python3 python3-venv tmux debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y -qq caddy >/dev/null
fi

say "2/7 Code"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q --ff-only; elif [ -z "$SLUG" ] && [ -f "$(dirname "$0")/relay/app.py" ] 2>/dev/null; then DIR=$(cd "$(dirname "$0")" && pwd); else git clone -q "$REPO" "$DIR"; fi
cd "$DIR"

say "3/7 Relay"
python3 -m venv relay/venv
relay/venv/bin/pip install -q -r relay/requirements.txt
if [ ! -f relay/relay.env ]; then
  SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
  IP=$(curl -fsS --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')
  HOST="${FIRST_HOST:-${IP//./-}.sslip.io}"   # a second companion lives on the first one's site, whatever its domain
  umask 077
  cat > relay/relay.env <<EOF
RELAY_SECRET=$SECRET
RELAY_AI_NAME=$AI_NAME
RELAY_HUMAN_NAME=$ME_NAME
RELAY_PUBLIC_PREFIX=$PREFIX
RELAY_ALLOW_ORIGINS=https://$HOST
RELAY_TMUX_SESSION=$TM
RELAY_COMPANION_DIR=$CDIR
RELAY_COMPANION_UNIT=/etc/systemd/system/nyx-companion$SFX.service
NYX_HOST=$HOST
EOF
  umask 022
fi
HOST=$(sed -n 's/^NYX_HOST=//p' relay/relay.env)
SECRET=$(sed -n 's/^RELAY_SECRET=//p' relay/relay.env)
if [ -n "$SLUG" ]; then   # the group chat: the first relay is the room; tell each about the other
  HUB_PORT=$(sed -n 's/.*--port \([0-9]*\).*/\1/p' /etc/systemd/system/nyx-relay.service)
  FIRST_ENV="$FIRST/relay.env" SLUG="$SLUG" NAME="$AI_NAME" PORT="$PORT" HUB_PORT="${HUB_PORT:-3011}" python3 - <<'PY'
import os, re
e = os.environ
def setkv(path, k, v):
    s = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    line = f"{k}={v}"
    s = re.sub(rf"^{k}=.*$", line, s, flags=re.M) if re.search(rf"^{k}=", s, re.M) else s.rstrip("\n") + "\n" + line + "\n"
    open(path, "w", encoding="utf-8").write(s)
first = open(e["FIRST_ENV"], encoding="utf-8").read()
m = re.search(r"^RELAY_GROUP_KEY=(.+)$", first, re.M)   # one group key, made the first time a second companion joins
gkey = m.group(1).strip() if m else __import__("secrets").token_urlsafe(32)
cur = (re.search(r"^RELAY_GROUP_PEERS=(.*)$", first, re.M) or [None, ""])[1]
name = re.sub(r'[|;\n"\\\']', " ", e["NAME"])
peers = [p for p in cur.split(";") if p and not p.startswith(e["SLUG"] + "|")]
peers.append(f"{e['SLUG']}|{name}|http://127.0.0.1:{e['PORT']}")
setkv(e["FIRST_ENV"], "RELAY_GROUP_PEERS", ";".join(peers))
setkv(e["FIRST_ENV"], "RELAY_GROUP_KEY", gkey)
for k, v in (("RELAY_GROUP_HUB_URL", f"http://127.0.0.1:{e['HUB_PORT']}"), ("RELAY_GROUP_KEY", gkey), ("RELAY_GROUP_SELF", e["SLUG"])):
    setkv("relay/relay.env", k, v)
PY
fi
sudo tee /etc/systemd/system/nyx-relay$SFX.service >/dev/null <<EOF
[Unit]
Description=Nyx relay$SFX
After=network.target

[Service]
User=$USER
WorkingDirectory=$DIR/relay
EnvironmentFile=$DIR/relay/relay.env
ExecStart=$DIR/relay/venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port $PORT --timeout-graceful-shutdown 3
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

if [ -z "$SLUG" ]; then
  say "4/7 Web pages + HTTPS ($HOST)"
  sudo mkdir -p /var/www/nyx
  sudo rsync -a --delete --exclude '.git' --exclude 'relay' --exclude 'channel' --exclude 'bridge' --exclude 'docs' \
    --exclude '*.md' --exclude '*.sh' --exclude 'LICENSE' --exclude 'config.js' ./ /var/www/nyx/
  if [ ! -f /var/www/nyx/config.js ]; then   # names go in through Python so quotes and slashes can't break the file
    AI_NAME="$AI_NAME" ME_NAME="$ME_NAME" python3 -c '
import json, os, sys
s = open("config.js", encoding="utf-8").read()
s = s.replace("aiName: \"Companion\"", "aiName: " + json.dumps(os.environ["AI_NAME"], ensure_ascii=False))
s = s.replace("meName: \"Me\"", "meName: " + json.dumps(os.environ["ME_NAME"], ensure_ascii=False))
sys.stdout.write(s)' | sudo tee /var/www/nyx/config.js >/dev/null
  fi
  [ -f /etc/caddy/Caddyfile ] && sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"
  sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$HOST {
	encode gzip
	handle_path /relay/* {
		request_body {
			max_size 12MB
		}
		reverse_proxy 127.0.0.1:3011 {
			flush_interval -1
		}
	}
	handle {
		root * /var/www/nyx
		header Cache-Control "no-cache"
		file_server
	}
}
EOF
else
  say "4/7 A path for it on the first one's site: https://$HOST$PREFIX"
  BAK="/etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"; sudo cp /etc/caddy/Caddyfile "$BAK"
  sudo env PREFIX="$PREFIX" PORT="$PORT" python3 - <<'PY'
import os
p = "/etc/caddy/Caddyfile"; s = open(p).read(); pre, port = os.environ["PREFIX"], os.environ["PORT"]
block = "\thandle_path %s/* {\n\t\trequest_body {\n\t\t\tmax_size 12MB\n\t\t}\n\t\treverse_proxy 127.0.0.1:%s {\n\t\t\tflush_interval -1\n\t\t}\n\t}\n" % (pre, port)
import re
if "handle_path %s/*" % pre not in s:
    m = re.search(r"^[ \t]*handle_path /relay/\*", s, re.M)   # right next to the first companion's path
    open(p, "w").write(s[:m.start()] + block + s[m.start():])
PY
  if ! sudo caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    sudo cp "$BAK" /etc/caddy/Caddyfile
    echo "The new Caddy block didn't validate; put the old Caddyfile back, nothing else changed on the site. Add a 'handle_path $PREFIX/*' → 127.0.0.1:$PORT block by hand."; exit 2
  fi
fi

say "5/7 Your companion's folder"
mkdir -p "$CDIR/memory"
PERSONA_NOTE="You are $AI_NAME, talking with $ME_NAME through a private chat app on their phone. Write like a person texting: short messages, plain words. Replace this file with who you really are.

Things worth remembering go in $CDIR/memory/ as small .md files; $ME_NAME can read them (and this file) in the app's Heart.
Keep $CDIR/memory/now.md up to date: a 'Time zone: Area/City' line, a 'Place:' line, and a few '- ' lines on where $ME_NAME is and what the next few days hold. The relay puts it on top of $ME_NAME's messages, so you always know their clock; change it the moment something changes, delete lines once they're past.
Before you edit the app's pages or relay, run: RELAY_URL=http://127.0.0.1:$PORT python3 $DIR/relay/board.py next (or ls). Pick one ticket, claim it with the files you'll touch, back up (git commit, or ~/nyx-bak for files outside the repo), edit, check, ship, note progress, mark it done, then tell $ME_NAME in a line or two. The full routine is in $DIR/docs/AI-WORKFLOW.md. $(bash "$DIR/consent.sh" --line "$CONSENT" "$ME_NAME")"

if [ "$AI" = claude ]; then
  say "6/7 Claude Code + channel plugin"
  command -v claude >/dev/null || curl -fsSL https://claude.ai/install.sh | bash
  command -v bun >/dev/null || [ -x "$HOME/.bun/bin/bun" ] || curl -fsSL https://bun.sh/install | bash
  BUN=$(command -v bun || echo "$HOME/.bun/bin/bun"); CLAUDE=$(command -v claude || echo "$HOME/.local/bin/claude")
  (cd channel && "$BUN" install --no-summary >/dev/null)
  CH="$HOME/.claude/channels/companion$SFX"; mkdir -p "$CH"; umask 077
  printf 'RELAY_URL=http://127.0.0.1:%s\nRELAY_SECRET=%s\nRELAY_AI_NAME=%s\nRELAY_HUMAN_NAME=%s\n' "$PORT" "$SECRET" "$AI_NAME" "$ME_NAME" > "$CH/.env"
  umask 022
  cat > channel/mcp.json <<EOF
{ "mcpServers": { "companion": { "command": "$BUN", "args": ["$DIR/channel/server.ts"],
  "env": { "RELAY_STATE_DIR": "$CH" } } } }
EOF
  [ -f "$CDIR/CLAUDE.md" ] || printf '%s\n\nMessages from %s arrive as <channel source="companion"> blocks; answer with the reply tool, a sentence or two per message.\n' "$PERSONA_NOTE" "$ME_NAME" > "$CDIR/CLAUDE.md"
  # status line → usage limits for the floating ball (one per machine; a second companion shares the first one's)
  [ -n "$SLUG" ] || python3 - "$DIR/relay/statusline-usage.sh" <<'PY'
import json, os, sys
p = os.path.expanduser("~/.claude/settings.json"); os.makedirs(os.path.dirname(p), exist_ok=True)
try: s = json.load(open(p))
except Exception: s = {}
s.setdefault("statusLine", {"type": "command", "command": sys.argv[1]})
json.dump(s, open(p, "w"), indent=2)
PY
  chmod +x relay/statusline-usage.sh channel/start-channel.sh
  sudo tee /etc/systemd/system/nyx-companion$SFX.service >/dev/null <<EOF
[Unit]
Description=Nyx companion$SFX (Claude Code)
After=network-online.target nyx-relay$SFX.service
Wants=network-online.target

[Service]
Type=oneshot
User=$USER
Environment=PATH=$(dirname "$CLAUDE"):$(dirname "$BUN"):/usr/local/bin:/usr/bin:/bin
ExecStart=$DIR/channel/start-channel.sh $TM $CDIR $DIR/channel/mcp.json $DIR/relay/model
ExecStop=/usr/bin/tmux kill-session -t $TM
RemainAfterExit=yes
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF
  LOGIN="cd $CDIR && claude      (log in with your Claude subscription, then type /exit)"
else
  say "6/7 Codex + bridge"
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null && sudo apt-get install -y -qq nodejs >/dev/null
  fi
  command -v codex >/dev/null || sudo npm i -g -s @openai/codex
  [ -f "$CDIR/AGENTS.md" ] || printf '%s\n' "$PERSONA_NOTE" > "$CDIR/AGENTS.md"
  sudo tee /etc/systemd/system/nyx-companion$SFX.service >/dev/null <<EOF
[Unit]
Description=Nyx companion$SFX (Codex bridge)
After=network-online.target nyx-relay$SFX.service

[Service]
User=$USER
EnvironmentFile=$DIR/relay/relay.env
Environment=RELAY_URL=http://127.0.0.1:$PORT
Environment=BRIDGE_CWD=$CDIR
Environment=BRIDGE_DIR=$HOME/.nyx-bridge$SFX
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=$DIR/relay/venv/bin/python $DIR/bridge/codex_bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  LOGIN="codex login --device-auth      (open the link on your phone, type the code)"
fi

say "7/7 Starting"
sudo systemctl daemon-reload
sudo systemctl enable -q --now nyx-relay$SFX
[ -n "$SLUG" ] && sudo systemctl restart nyx-relay   # the first relay picks up its new group member
sudo systemctl enable -q caddy && sudo systemctl restart caddy
sudo systemctl enable -q nyx-companion$SFX

if [ -n "$SLUG" ]; then cat <<EOF

────────────────────────────────────────────────────────────
  $AI_NAME is in, next to your first companion.

  Address : $PREFIX        (on https://$HOST)
  Key     : $SECRET
            (its own key; also in $DIR/relay/relay.env)

  Two steps left:
    1. $LOGIN
    2. sudo systemctl start nyx-companion$SFX

  Then in the app: 小家 → 联系人 → ＋ 添一个, address $PREFIX, this key.
  The town, Listen, Kitchen and the hold stay with your first companion;
  $AI_NAME is for chatting. Its persona lives in $CDIR/$([ "$AI" = claude ] && echo CLAUDE.md || echo AGENTS.md).
────────────────────────────────────────────────────────────
EOF
else
cat <<EOF

────────────────────────────────────────────────────────────
  Nyx is installed.

  Address : https://$HOST
  Key     : $SECRET
            (this is the only key — keep it to yourself; it's also in $DIR/relay/relay.env)

  Two steps left:
    1. $LOGIN
    2. sudo systemctl start nyx-companion

  Then open the address on your phone, type the key,
  and add it to your home screen (iPhone: Share → Add to Home Screen;
  Android Chrome: ⋮ → Install app).

  Your companion's persona lives in ~/companion/$([ "$AI" = claude ] && echo CLAUDE.md || echo AGENTS.md) — make it yours.
────────────────────────────────────────────────────────────
EOF
fi
