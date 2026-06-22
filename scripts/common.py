from __future__ import annotations
import json, os
from datetime import datetime, timezone
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
def now_iso() -> str: return datetime.now(timezone.utc).astimezone().isoformat(timespec="minutes")
def write_json(name: str, payload: dict) -> None: (DATA_DIR / name).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
def read_json(name: str, default=None):
    path = DATA_DIR / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default
def env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else value

def with_refresh_metadata(
    payload: dict,
    *,
    source_type: str,
    refresh_status: str,
    attempted_at: str | None = None,
    successful_at: str | None = None,
    limitations: list[str] | None = None,
) -> dict:
    attempted = attempted_at or now_iso()
    successful = successful_at if successful_at is not None else (attempted if refresh_status == "success" else payload.get("lastSuccessfulAt"))
    return {
        **payload,
        "sourceType": source_type,
        "refreshStatus": refresh_status,
        "lastAttemptedAt": attempted,
        "lastSuccessfulAt": successful,
        "sourceLimitations": limitations or payload.get("sourceLimitations", []),
    }

def preserve_with_failure(name: str, message: str, *, source_type: str, limitations: list[str] | None = None) -> dict:
    existing = read_json(name, default={}) or {}
    notes = (existing.get("notes", []) + [message])[-5:]
    return with_refresh_metadata(
        {**existing, "notes": notes},
        source_type=source_type,
        refresh_status="failed",
        attempted_at=now_iso(),
        successful_at=existing.get("lastSuccessfulAt") or existing.get("lastUpdated"),
        limitations=limitations,
    )
