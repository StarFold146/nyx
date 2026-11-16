#!/bin/sh
# Download SenseVoice-Small for sherpa-onnx (zh / en / ja / ko / yue) next to this script.
# From the sherpa-onnx project's own release page (k2-fsa/sherpa-onnx, "asr-models"). The package holds model.onnx and
# model.int8.onnx; the server uses only model.int8.onnx, so the full-size one is deleted after unpacking.
# The model is SenseVoice-Small by FunAudioLLM, under the FunASR Model License 1.1 (LICENSE inside the folder).
set -eu
cd "$(dirname "$0")"
NAME=sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$NAME.tar.bz2"
if [ -f "$NAME/model.int8.onnx" ]; then echo "already here: $NAME"; exit 0; fi
echo "downloading $URL"
curl -fL --retry 3 -o "$NAME.tar.bz2" "$URL"
tar xjf "$NAME.tar.bz2"
rm -f "$NAME.tar.bz2" "$NAME/model.onnx"
echo "ok: $(pwd)/$NAME"
