#!/bin/sh
# Start the SenseVoice server by hand (127.0.0.1:${STT_PORT:-3090}). setup.sh installs it as a service instead.
cd "$(dirname "$0")"
if [ -f stt.pid ] && kill -0 "$(cat stt.pid)" 2>/dev/null; then echo "already running pid $(cat stt.pid)"; exit 0; fi
PY=${STT_PYTHON:-venv/bin/python}
nohup "$PY" -I server.py >> stt.log 2>&1 &
echo $! > stt.pid; echo "started pid $(cat stt.pid)"
