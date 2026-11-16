#!/usr/bin/env python3
"""The relay's RELAY_VOICE_TRANSCRIBE_CMD for the SenseVoice server next to this file.

  transcribe.py <audio_file> <mime>
    prints the transcript and exits 0;
    exits 3 when the server heard nothing (silence, a cough): the relay then drops that bit of audio instead of
    posting it to the chat (see relay/app.py, transcribe_with_command);
    exits 1 when the server can't be reached or can't decode the file: the relay keeps the audio as an attachment.

STT_URL overrides where the server is (default http://127.0.0.1:3090/transcribe). Part of the Nyx relay, GNU AGPL v3.
"""
import json
import os
import sys
import urllib.request

URL = os.environ.get("STT_URL", "http://127.0.0.1:3090/transcribe")


def main():
    if len(sys.argv) < 2:
        print("usage: transcribe.py <audio_file> [mime]", file=sys.stderr)
        return 2
    with open(sys.argv[1], "rb") as f:
        data = f.read()
    req = urllib.request.Request(URL, data=data, method="POST",
                                 headers={"Content-Type": sys.argv[2] if len(sys.argv) > 2 else "application/octet-stream"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            out = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"stt: {type(e).__name__}", file=sys.stderr)
        return 1
    text = (out.get("text") or "").strip()
    if not any(c.isalnum() for c in text):   # nothing, or a lone "。": nothing was said
        return 3
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
