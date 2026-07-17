from __future__ import annotations
import requests
from common import env, now_iso, preserve_with_failure, write_json, with_refresh_metadata

OBS = "https://api.stlouisfed.org/fred/series/observations"
MATERIALS = {
    "pulp.json": {
        "series_id": "WPU0911",
        "label": "FRED Pulp, Paper, and Allied Products PPI",
        "title": "containerboard and pulp/paper market",
        "freshness": "Monthly market action + proxy",
        "source_link": "https://fred.stlouisfed.org/series/WPU0911",
        "market_action": {
            "label": "Containerboard +$50/ST",
            "market": "North American containerboard",
            "effectiveDate": "2026-06",
            "amount": 50,
            "unit": "USD/ST",
            "direction": "increase",
            "source": "Packaging Dive / Fastmarkets RISI",
            "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
            "confidence": "High",
            "notes": [
                "Fastmarkets RISI recognized a $50 per ton month-over-month North American containerboard price increase in June 2026.",
                "This is the operational pricing signal mills and sheet plants use for corrugated pricing conversations.",
            ],
        },
        "limitations": [
            "Containerboard market action is curated from public market reporting; FRED/BLS PPI remains a proxy trend only.",
            "This is not a supplier-specific quote and may not match every mill, sheet plant, grade, or customer contract.",
            "Monthly PPI data can lag current supplier quotes.",
        ],
    },
    "resin.json": {
        "series_id": "PCU325211325211",
        "label": "FRED Plastics Material and Resin Manufacturing PPI",
        "title": "resin market",
        "freshness": "Monthly market action + proxy",
        "source_link": "https://fred.stlouisfed.org/series/PCU325211325211",
        "market_action": {
            "label": "PE resin -$0.15/lb",
            "market": "North American polyethylene resin",
            "effectiveDate": "2026-06",
            "amount": -0.15,
            "unit": "USD/lb",
            "direction": "decrease",
            "source": "Plastics News / PlasticsToday",
            "sourceUrl": "https://www.plasticstoday.com/resin-pricing/resin-price-report-resin-buyers-face-closing-window-on-pricing-leverage",
            "confidence": "Medium",
            "notes": [
                "Public resin reporting points to June/July PE and PP relief after inventory builds and weaker demand.",
                "Plastics News public social reporting cited North American PE resin prices down $0.15/lb in June; PlasticsToday reported PE moving down double-digit cents per pound and no July increase initiatives.",
            ],
        },
        "limitations": [
            "Resin market action is curated from public market reporting; FRED/BLS PPI remains a proxy trend only.",
            "Resin pricing varies by polymer, grade, supplier, contract, and spot-versus-contract market.",
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

def apply_market_context(payload: dict, meta: dict) -> dict:
    action = meta.get("market_action")
    if not action:
        return payload
    source_links = payload.get("sourceLinks", [])
    if not any(link.get("url") == action["sourceUrl"] for link in source_links):
        source_links = [*source_links, {"label": action["source"], "url": action["sourceUrl"]}]
    return {
        **payload,
        "freshness": meta["freshness"],
        "marketAction": action,
        "sourceLinks": source_links,
        "sourceLimitations": meta["limitations"],
    }

api_key = env("FRED_API_KEY")
if not api_key:
    for name, meta in MATERIALS.items():
        write_json(name, apply_market_context(preserve_with_failure(name, f"FRED_API_KEY is required for update_materials.py. Preserved previous {meta['title']} data.", source_type="proxy", limitations=meta["limitations"]), meta))
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
        source_links = [{"label": meta["label"], "url": meta["source_link"]}]
        if meta.get("market_action"):
            source_links.append({"label": meta["market_action"]["source"], "url": meta["market_action"]["sourceUrl"]})
        write_json(
            name,
            with_refresh_metadata(
                {
                    "lastUpdated": stamp,
                    "sourceStrength": "High",
                    "freshness": meta["freshness"],
                    "whatChanged": f"{meta['market_action']['label']} is the operating market action; proxy moved {delta:+.1f} index points versus the prior published month.",
                    "sourceLinks": source_links,
                    "notes": [f"Market action curated from {meta['market_action']['source']}.", f"Proxy refreshed from {meta['label']}.", "Use market action for pricing conversations; use proxy as directional context only."],
                    "currentDeltaIndex": round(delta, 2),
                    "marketAction": meta["market_action"],
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
        write_json(name, apply_market_context(preserve_with_failure(name, f"Materials refresh failed for {meta['series_id']}: {exc}. Preserved previous data.", source_type="proxy", limitations=meta["limitations"]), meta))
        raise
