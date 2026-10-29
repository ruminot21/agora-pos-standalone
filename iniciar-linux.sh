#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo 'Abre http://localhost:8000 en el navegador.'
python3 -m http.server 8000
