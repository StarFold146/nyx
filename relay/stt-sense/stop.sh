#!/bin/sh
cd "$(dirname "$0")"
[ -f stt.pid ] && kill "$(cat stt.pid)" 2>/dev/null && echo "stopped $(cat stt.pid)"; rm -f stt.pid
