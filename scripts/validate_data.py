from __future__ import annotations
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REQUIRED = {"sourceType", "refreshStatus", "lastAttemptedAt", "lastSuccessfulAt", "sourceLimitations"}
VALID_SOURCE_TYPES = {"automated", "manual", "proxy", "hybrid"}
VALID_STATUSES = {"success", "failed", "manual", "source_limited"}
INVALID_HIRING_LINK_HOSTS = {"google.com", "www.google.com", "news.google.com", "bing.com", "www.bing.com"}

errors = []
for path in sorted(DATA.glob("*.json")):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{path.name}: invalid JSON ({exc})")
        continue
    missing = sorted(REQUIRED - payload.keys())
    if missing:
        errors.append(f"{path.name}: missing metadata fields {', '.join(missing)}")
    if payload.get("sourceType") not in VALID_SOURCE_TYPES:
        errors.append(f"{path.name}: invalid sourceType {payload.get('sourceType')!r}")
    if payload.get("refreshStatus") not in VALID_STATUSES:
        errors.append(f"{path.name}: invalid refreshStatus {payload.get('refreshStatus')!r}")
    if not payload.get("lastUpdated") and not payload.get("publishedAt") and payload.get("refreshStatus") not in {"manual", "source_limited"}:
        errors.append(f"{path.name}: needs lastUpdated/publishedAt unless intentionally manual/source_limited")
    if not isinstance(payload.get("sourceLimitations"), list):
        errors.append(f"{path.name}: sourceLimitations must be a list")
    if path.name == "competitors.json":
        for company in payload.get("companies", []):
            for item in (company.get("signals") or {}).get("hiring", []):
                if not isinstance(item, dict):
                    continue
                url = item.get("url") or ""
                host = urlparse(url).netloc.lower()
                if host in INVALID_HIRING_LINK_HOSTS:
                    errors.append(f"{path.name}: {company.get('name', 'Unknown company')} hiring item uses non-direct search/news URL")

if errors:
    print("Data validation failed:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print(f"Validated {len(list(DATA.glob('*.json')))} data files.")
