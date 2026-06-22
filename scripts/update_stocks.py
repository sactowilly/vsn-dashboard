from __future__ import annotations
import requests
from common import env, now_iso, preserve_with_failure, write_json, with_refresh_metadata

OBS = "https://api.stlouisfed.org/fred/series/observations"
SERIES = {
    "sp500": ("SP500", "S&P 500"),
    "dow": ("DJIA", "Dow Jones Industrial Average"),
    "vix": ("VIXCLS", "CBOE VIX"),
}

def fetch_series(series_id: str, api_key: str, limit: int = 20):
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
        rows.append({"date": obs["date"], "value": float(value)})
    return rows

api_key = env("FRED_API_KEY")
limitations = ["FRED market series can lag live market quotes and should be treated as daily context, not intraday trading data."]
if not api_key:
    write_json("stocks.json", preserve_with_failure("stocks.json", "FRED_API_KEY is required for update_stocks.py. Preserved previous market data.", source_type="automated", limitations=limitations))
    raise SystemExit(0)

try:
    fetched = {key: fetch_series(series_id, api_key) for key, (series_id, _) in SERIES.items()}
    latest = {}
    for key, rows in fetched.items():
        if not rows:
            raise RuntimeError(f"No rows returned for {SERIES[key][0]}")
        latest[key] = rows[-1]["value"]

    dates = sorted(set.intersection(*(set(row["date"] for row in rows) for rows in fetched.values())))[-12:]
    by_key = {key: {row["date"]: row["value"] for row in rows} for key, rows in fetched.items()}
    series = [{"date": date, **{key: by_key[key][date] for key in SERIES}} for date in dates]
    stamp = now_iso()
    write_json(
        "stocks.json",
        with_refresh_metadata(
            {
                "lastUpdated": stamp,
                "sourceStrength": "High",
                "freshness": "Daily",
                "whatChanged": "Market indices refreshed from FRED daily series.",
                "sourceLinks": [
                    {"label": label, "url": f"https://fred.stlouisfed.org/series/{series_id}"}
                    for series_id, label in (value for value in SERIES.values())
                ],
                "notes": ["Context only; not a direct pricing input."],
                "latest": latest,
                "series": series,
            },
            source_type="automated",
            refresh_status="success",
            attempted_at=stamp,
            successful_at=stamp,
            limitations=limitations,
        ),
    )
except Exception as exc:
    write_json("stocks.json", preserve_with_failure("stocks.json", f"Market refresh failed: {exc}. Preserved previous market data.", source_type="automated", limitations=limitations))
    raise
