#!/usr/bin/env python3
"""Local speech-to-text for calls: SenseVoice-Small (FunAudioLLM / FunASR) run in int8 by sherpa-onnx. Listens on 127.0.0.1 only.

  POST /transcribe   body = raw audio bytes (m4a / mp4 / webm / ogg / wav; ffmpeg turns it into 16 kHz mono)
    -> {"text": "...", "lang": "zh", "dur": 1.9, "ms": 300, "emotion": "NEUTRAL", "event": "Speech"}
       text is "" for audio that is too short or almost silent.
  GET  /health       -> {"ok": true, "model": "sensevoice-small-int8"}

Settings (environment):
  STT_MODEL_DIR  folder with model.int8.onnx and tokens.txt
                 (default: sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 next to this file; get-model.sh puts it there)
  STT_PORT       default 3090        STT_THREADS  default 2        STT_LANG  auto | zh | en | ja | ko | yue (default auto)
  STT_FFMPEG     ffmpeg to use (default: the one on PATH)

The model is SenseVoice-Small by FunAudioLLM, under the FunASR Model License 1.1; sherpa-onnx is Apache-2.0.
Part of the Nyx relay, GNU AGPL v3.
"""
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = int(os.environ.get("STT_PORT", "3090"))
THREADS = int(os.environ.get("STT_THREADS", "2"))
LANG = os.environ.get("STT_LANG", "auto")
FFMPEG = os.environ.get("STT_FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
MDIR = os.environ.get("STT_MODEL_DIR") or os.path.join(HERE, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
MAX_BYTES = 12 * 1024 * 1024
MIN_SEC = 0.25

rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
    model=os.path.join(MDIR, "model.int8.onnx"), tokens=os.path.join(MDIR, "tokens.txt"),
    num_threads=THREADS, use_itn=True, language=LANG)
lock = threading.Lock()


def to_wav(src, dst):
    subprocess.run([FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                    "-ac", "1", "-ar", "16000", "-f", "wav", dst], check=True, timeout=30, capture_output=True)


def load_pcm(path):
    with wave.open(path, "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def tag(s):
    return (s or "").strip("<|>")


def transcribe(data):
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="stt-") as d:
        src, wav = os.path.join(d, "in.bin"), os.path.join(d, "in.wav")
        with open(src, "wb") as f:
            f.write(data)
        to_wav(src, wav)
        pcm = load_pcm(wav)
    dur = len(pcm) / 16000.0
    out = {"text": "", "lang": "", "dur": round(dur, 2), "emotion": "", "event": ""}
    if dur >= MIN_SEC and pcm.size and float(np.abs(pcm).max()) > 0.004:   # too short or nearly silent: don't run the model
        with lock:
            st = rec.create_stream()
            st.accept_waveform(16000, pcm)
            rec.decode_stream(st)
            r = st.result
        out.update(text=(r.text or "").strip(), lang=tag(getattr(r, "lang", "")),
                   emotion=tag(getattr(r, "emotion", "")), event=tag(getattr(r, "event", "")))
    out["ms"] = int((time.time() - t0) * 1000)
    return out


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "model": "sensevoice-small-int8"})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.split("?")[0] != "/transcribe":
            return self._send(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._send(413 if n else 400, {"error": "bad length"})
        data = self.rfile.read(n)
        try:
            self._send(200, transcribe(data))
        except subprocess.CalledProcessError:
            self._send(415, {"error": "ffmpeg could not decode audio"})
        except Exception as e:
            self._send(500, {"error": type(e).__name__})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"stt ready model=sensevoice-small-int8 on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
