#!/bin/bash
# Start Claude Code in a detached tmux session with the companion channel loaded,
# and click through the prompts newer Claude Code shows for development channels.
# Usage: start-channel.sh <tmux-session> <folder> <mcp-config> [model-id or model-file]
#   folder      where your companion's CLAUDE.md (persona + rules) lives
#   mcp-config  a JSON like mcp.example.json that registers this channel as "companion"
# Part of the Nyx relay (modified Tidal Echo), GNU AGPL v3.
S=$1; DIR=$2; CFG=$3; MODEL=${4:-}
# model may be an id or a file holding one (e.g. the relay's data dir "model", set from the chat page)
[ -f "$MODEL" ] && MODEL=$(tr -cd 'A-Za-z0-9._:/-' < "$MODEL")
[[ "$MODEL" == /* ]] && [ ! -f "$MODEL" ] && MODEL=""   # no pick saved yet: leave the model to Claude Code
[ -n "$S" ] && [ -d "$DIR" ] && [ -f "$CFG" ] || { echo "usage: $0 <session> <folder> <mcp-config> [model]"; exit 2; }
M=""; [ -n "$MODEL" ] && M="--model $MODEL"
# NYX_RESUME=<session id> goes back to an old window (the relay sets it when you pick one in the gauge)
R=""; [ -n "${NYX_RESUME:-}" ] && R="--resume $(tr -cd 'A-Za-z0-9-' <<<"$NYX_RESUME")"
# NYX_KEYS_FILE = the relay's agent-keys.env (keys set from the gauge). The window is told where it is and to load it
# inside the one command that needs a key, so values never reach the chat, a command line or its output, and a changed
# key needs no restart. The relay sets it for New window; for boot, add
#   Environment=NYX_KEYS_FILE=/path/to/relay/agent-keys.env   to the systemd unit.
P=""
if [ -n "${NYX_KEYS_FILE:-}" ]; then
  KQ=$(printf %q "$NYX_KEYS_FILE")
  P="--append-system-prompt $(printf %q "API keys the user saved from the app are in $NYX_KEYS_FILE (NAME='value' lines; it may change while you run). When a command needs one, load the file inside that same command: set -a; . $KQ; set +a; your-command ... \$NAME. To see which names exist: grep -oE '^[A-Z_][A-Z0-9_]*' $KQ. Never print, echo, cat or log the values, and never paste them into the chat.")"
fi
cd "$DIR" || exit 1
tmux new-session -d -s "$S" -x 200 -y 50 "claude --dangerously-load-development-channels server:companion --mcp-config $CFG --permission-mode auto $M $R $P" || exit 1
for i in $(seq 1 30); do
  sleep 2
  pane=$(tmux capture-pane -pt "$S" 2>/dev/null) || exit 1
  if grep -q "I am using this for local development" <<<"$pane"; then tmux send-keys -t "$S" Enter
  elif grep -q "Try the new fullscreen renderer" <<<"$pane"; then tmux send-keys -t "$S" Down Enter
  elif grep -q "auto mode on" <<<"$pane" && ! grep -q "Enter to confirm" <<<"$pane"; then exit 0
  fi
done
echo "Claude Code didn't settle in 60s — run: tmux attach -t $S"; exit 1
