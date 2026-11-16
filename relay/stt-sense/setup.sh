#!/usr/bin/env bash
# Optional: turn on SenseVoice transcription for calls and voice messages.
#   bash ~/nyx/relay/stt-sense/setup.sh            (or install.sh --stt)
# Installs ffmpeg, a venv with sherpa-onnx, the model (a download of about 1 GB, about 230 MB kept), a service nyx-stt on 127.0.0.1:3090,
# and points every Nyx relay on this server at it (RELAY_VOICE_TRANSCRIBE_CMD in relay.env), then restarts them.
# Undo: sudo systemctl disable --now nyx-stt, and delete the RELAY_VOICE_TRANSCRIBE_CMD line from relay.env.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE"
command -v ffmpeg >/dev/null || sudo apt-get install -y -qq ffmpeg >/dev/null
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -q -r requirements.txt
sh get-model.sh
chmod +x transcribe.py
sudo tee /etc/systemd/system/nyx-stt.service >/dev/null <<UNIT
[Unit]
Description=Nyx speech-to-text (SenseVoice, 127.0.0.1:3090)
After=network.target

[Service]
User=$USER
WorkingDirectory=$HERE
Environment=STT_PORT=3090
ExecStart=$HERE/venv/bin/python -I $HERE/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable -q --now nyx-stt
for unitfile in /etc/systemd/system/nyx-relay*.service; do   # every Nyx relay on this server (first one and any added with --as)
  [ -f "$unitfile" ] || continue
  env="$(sed -n 's/^WorkingDirectory=//p' "$unitfile")/relay.env"
  [ -f "$env" ] || continue
  sed -i '/^RELAY_VOICE_TRANSCRIBE_CMD=/d' "$env"
  echo "RELAY_VOICE_TRANSCRIBE_CMD=$HERE/transcribe.py" >> "$env"
  sudo systemctl restart "$(basename "$unitfile" .service)" && echo "restarted $(basename "$unitfile" .service)"
done
echo "SenseVoice is on: calls and voice messages are transcribed on this server."
