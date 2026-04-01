from __future__ import annotations
import json, os
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="minutes")

def write_json(name: str, payload: dict) -> None:
    (DATA_DIR / name).write_text(json.dumps(payload, indent=2), encoding="utf-8")

def read_json(name: str, default=None):
    path = DATA_DIR / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value
