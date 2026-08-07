#!/usr/bin/env python3
"""
Persistent Kokoro TTS worker.

Loads the Kokoro ONNX model once, then reads one JSON request per line from
stdin and writes one JSON response per line to stdout. This avoids paying the
~3s model-load cost per sentence (there are ~90 sentences to synthesize).

Request:  {"id": "0", "text": "...", "outPath": "/abs/path.wav"}
Response: {"id": "0", "ok": true, "numSamples": 123456, "sampleRate": 24000}
       or {"id": "0", "ok": false, "error": "..."}

Voice and speed are fixed for the whole process (passed as argv).
"""

import sys
import json
import argparse

import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper

EspeakWrapper.set_library(espeakng_loader.get_library_path())

from kokoro_onnx import Kokoro
import soundfile as sf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--lang", default="en-us")
    args = parser.parse_args()

    kokoro = Kokoro(args.model, args.voices)

    # Signal readiness to the parent process.
    print(json.dumps({"ready": True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        req_id = req.get("id")
        try:
            samples, sr = kokoro.create(
                req["text"], voice=args.voice, speed=args.speed, lang=args.lang
            )
            sf.write(req["outPath"], samples, sr, subtype="PCM_16")
            resp = {
                "id": req_id,
                "ok": True,
                "numSamples": int(len(samples)),
                "sampleRate": int(sr),
            }
        except Exception as e:  # noqa: BLE001
            resp = {"id": req_id, "ok": False, "error": str(e)}
        print(json.dumps(resp), flush=True)


if __name__ == "__main__":
    main()
