#!/bin/sh

set -eu

HERMES_ENV="${HERMES_ENV:-$HOME/.hermes/.env}"
TITLE="${1:-MiMarca alerta}"
BODY="${2:-Incidencia detectada en backup o restore.}"

python3 - "$HERMES_ENV" "$TITLE" "$BODY" "$(hostname)" "$(date '+%Y-%m-%d %H:%M:%S %Z')" <<'PY'
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

env_path = sys.argv[1]
title = sys.argv[2]
body = sys.argv[3]
host = sys.argv[4]
date_str = sys.argv[5]

token = ""
chat_id = ""
allowed_users = ""
mimarca_channel = ""
mimarca_bot_token = ""

try:
    with open(env_path, "r", encoding="utf-8") as fh:
        for line in fh:
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            k, v = raw.split("=", 1)
            key = k.strip()
            value = v.strip()
            if key == "TELEGRAM_MIMARCA_BOT_TOKEN" and not mimarca_bot_token:
                mimarca_bot_token = value
            if key == "TELEGRAM_BOT_TOKEN" and not token:
                token = value
            if key == "TELEGRAM_MIMARCA_CHANNEL" and not mimarca_channel:
                mimarca_channel = value
            if key == "TELEGRAM_HOME_CHANNEL" and not chat_id:
                chat_id = value
            if key == "TELEGRAM_ALLOWED_USERS" and not allowed_users:
                allowed_users = value
except FileNotFoundError:
    raise SystemExit(f"Hermes env not found: {env_path}")

if mimarca_bot_token:
    token = mimarca_bot_token

if mimarca_channel:
    chat_id = mimarca_channel

if not chat_id:
    cfg_path = Path(env_path).with_name("config.yaml")
    if cfg_path.exists():
        for ln in cfg_path.read_text(encoding="utf-8", errors="replace").splitlines():
            raw = ln.strip()
            if not raw.startswith("TELEGRAM_HOME_CHANNEL:"):
                continue
            value = raw.split(":", 1)[1].strip().strip("'").strip('"')
            if value:
                chat_id = value
                break

if not chat_id and allowed_users:
    chat_id = allowed_users.split(",")[0].strip()

if not token or not chat_id:
    raise SystemExit(f"Missing TELEGRAM_BOT_TOKEN or TELEGRAM_HOME_CHANNEL in {env_path}")

text = f"""⚠️ {title}

{body}

Origen: MiMarca Backoffice
Host: {host}
Fecha: {date_str}"""

url = f"https://api.telegram.org/bot{token}/sendMessage"
payload = {"chat_id": chat_id, "text": text}
req = Request(url, data=json.dumps(payload).encode("utf-8"), method="POST")
req.add_header("Content-Type", "application/json")
with urlopen(req, timeout=20) as res:
    body = res.read().decode("utf-8")
    parsed = json.loads(body) if body else {}
    if not parsed.get("ok"):
        raise SystemExit(f"Telegram error: {body}")
PY
