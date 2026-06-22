from __future__ import annotations
import requests
from common import env, now_iso, preserve_with_failure, write_json, with_refresh_metadata

OBS = "https://api.stlouisfed.org/fred/series/observations"
MATERIALS = {
    "pulp.json": {
        "series_id": "WPU0911",
        "label": "FRED Pulp, Paper, and Allied Products PPI",
        "title": "pulp/paper proxy",
        "freshness": "Monthly proxy",
        "source_link": "https://fred.stlouisfed.org/series/WPU0911",
        "limitations": [
            "This is a FRED/BLS PPI proxy, not paid-grade spot pulp or corrugated input pricing.",
            "Monthly PPI data can lag current supplier quotes.",
        ],
    },
    "resin.json": {
        "series_id": "PCU325211325211",
        "label": "FRED Plastics Material and Resin Manufacturing PPI",
        "title": "resin/plastics proxy",
        "freshness": "Monthly proxy",
        "source_link": "https://fred.stlouisfed.org/series/PCU325211325211",
        "limitations": [
            "This is a FRED/BLS PPI proxy, not paid-grade spot resin pricing.",
            "Monthly PPI data can lag current supplier quotes.",
        ],
    },
}

def fetch_series(series_id: str, api_key: str, limit: int = 12):
    r = requests.get(
        OBS,
        params={
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        },
        timeout=30,
    )
    r.raise_for_status()
    rows = []
    for obs in reversed(r.json().get("observations", [])):
        value = obs.get("value")
        if value in (None, "."):
            continue
        rows.append({"date": obs["date"][:7], "value": float(value)})
    return rows

api_key = env("FRED_API_KEY")
if not api_key:
    for name, meta in MATERIALS.items():
        write_json(name, preserve_with_failure(name, f"FRED_API_KEY is required for update_materials.py. Preserved previous {meta['title']} data.", source_type="proxy", limitations=meta["limitations"]))
    raise SystemExit(0)

for name, meta in MATERIALS.items():
    try:
        series = fetch_series(meta["series_id"], api_key)
        if len(series) < 2:
            raise RuntimeError(f"Not enough observations for {meta['series_id']}")
        latest = series[-1]
        prev = series[-2]
        delta = latest["value"] - prev["value"]
        stamp = now_iso()
        write_json(
            name,
            with_refresh_metadata(
                {
                    "lastUpdated": stamp,
                    "sourceStrength": "High",
                    "freshness": meta["freshness"],
                    "whatChanged": f"{meta['title'].title()} moved {delta:+.1f} index points versus the prior published month.",
                    "sourceLinks": [{"label": meta["label"], "url": meta["source_link"]}],
                    "notes": [f"Refreshed from {meta['label']}.", "Use as directional pricing context only."],
                    "currentDeltaIndex": round(delta, 2),
                    "series": series,
                },
                source_type="proxy",
                refresh_status="success",
                attempted_at=stamp,
                successful_at=stamp,
                limitations=meta["limitations"],
            ),
        )
    except Exception as exc:
        write_json(name, preserve_with_failure(name, f"Materials refresh failed for {meta['series_id']}: {exc}. Preserved previous data.", source_type="proxy", limitations=meta["limitations"]))
        raise
