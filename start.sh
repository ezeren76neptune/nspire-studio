#!/bin/bash
# Launch Nspire Studio as a desktop app. Use --browser to run it in a web browser instead.
cd "$(dirname "$0")"
if [ "$1" = "--browser" ]; then exec python3 server.py; fi
exec python3 app.py
