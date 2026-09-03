#!/usr/bin/env bash
# Serve this game locally (games need HTTP; file:// won't work).
PORT="${1:-8080}"
python3 -m http.server "$PORT" --bind 0.0.0.0
