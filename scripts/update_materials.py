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
        "plain_read": "Paper costs are up. The number to watch is containerboard +$50 per short ton in June 2026. That is the number mills and sheet plants use in corrugated pricing conversations.",
        "analysis": "The public record shows a choppy 2026: down $20/ST in February, then up $40/ST in March, up $30/ST in April, flat in May, and up $50/ST in June. Packaging Dive reported the net recognized increase for 2026 at $100/ST. International Paper and Pratt both joined the 2026 increase cycle, so California buyers should verify which suppliers are passing the move through, when it starts, and whether any customer-specific exceptions apply.",
        "market_history": [
            {
                "period": "2026-02",
                "label": "Containerboard index decrease",
                "amount": -20,
                "unit": "USD/ST",
                "source": "Packaging Dive / Fastmarkets RISI",
                "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
                "notes": "Fastmarkets RISI recognized a February decrease before later 2026 increases."
            },
            {
                "period": "2026-03",
                "label": "Containerboard index increase",
                "amount": 40,
                "unit": "USD/ST",
                "source": "Packaging Dive / Fastmarkets RISI",
                "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
                "notes": "March moved higher as producers pushed a new increase cycle."
            },
            {
                "period": "2026-04",
                "label": "Containerboard index increase",
                "amount": 30,
                "unit": "USD/ST",
                "source": "Packaging Dive / Fastmarkets RISI",
                "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
                "notes": "April added to the recovery after the February decline."
            },
            {
                "period": "2026-05",
                "label": "Containerboard index flat",
                "amount": 0,
                "unit": "USD/ST",
                "source": "Packaging Dive / Fastmarkets RISI",
                "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
                "notes": "May was reported flat before the June increase."
            },
            {
                "period": "2026-06",
                "label": "Containerboard index increase",
                "amount": 50,
                "unit": "USD/ST",
                "source": "Packaging Dive / Fastmarkets RISI",
                "sourceUrl": "https://www.packagingdive.com/news/containerboard-pricing-june-2026-fastmarkets-risi-increase-demand-supply/823172/",
                "notes": "June recognized a $50/ST month-over-month containerboard increase."
            }
        ],
        "company_actions": [
            {
                "company": "International Paper",
                "californiaRelevance": "West Sacramento recycling facility handles cardboard/OCC and other recovered materials; pricing action is North American, not a California-only public price letter.",
                "action": "Announced a $70/ST North American linerboard and corrugating medium increase effective March 1, 2026; public reporting also lists IP among producers announcing June 2026 increases.",
                "source": "Fastmarkets; Packaging Dive; International Paper",
                "sourceUrls": [
                    "https://www.fastmarkets.com/insights/ip-is-second-out-with-70-per-ton-north-american-linerboard-price-increase-effective-march-1/",
                    "https://www.packagingdive.com/news/containerboard-price-increases-june-2026-supply-demand/819166/",
                    "https://www.internationalpaper.com/recycling/locations/west-sacramento-recycling"
                ]
            },
            {
                "company": "Pratt Industries",
                "californiaRelevance": "Pratt lists California operations including Lathrop corrugating, Salinas converting, and Stockton retail specialties.",
                "action": "Packaging Dive reported Pratt announced a $50/ST June 2026 containerboard increase. Pratt also describes itself as vertically integrated, which can affect how it manages board supply and customer timing.",
                "source": "Packaging Dive; Pratt Industries",
                "sourceUrls": [
                    "https://www.packagingdive.com/news/containerboard-price-increases-june-2026-supply-demand/819166/",
                    "https://www.prattindustries.com/locations-packaging-manufacturing/",
                    "https://www.prattindustries.com/custom-packaging-solutions-agriculture/"
                ]
            }
        ],
        "research_findings": [
            "BLS PPI measures average selling prices received by domestic producers. It is useful for direction, but it is not a supplier quote.",
            "FRED WPU0911 is a monthly national pulp/paper PPI proxy. It supports trend context; containerboard market action remains the operating number for corrugated decisions.",
            "Public reporting says only a small open-market share is captured by index moves; contracts, geography, freight, grade, and customer mix can change the actual price paid.",
            "No public California-only International Paper or Pratt customer price letter was found in free sources. Treat company actions as North American signals and verify California pass-through with supplier quotes."
        ],
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
        "plain_read": "Resin is giving buyers more room right now. The public operating signal is polyethylene down about $0.15 per pound in June 2026, but California pricing still needs supplier quote confirmation.",
        "analysis": "The resin proxy rose sharply into May, then fell in June. Public resin reporting points to inventory builds, weaker demand, lower feedstock pressure, and no broad July increase initiatives. That means resin-linked products may create margin opportunity, but the dashboard should not claim a California-only resin price because no free public California-specific resin index was found.",
        "market_history": [
            {
                "period": "2026-02",
                "label": "Resin PPI proxy",
                "amount": 308.307,
                "change": 4.8,
                "unit": "PPI index",
                "source": "FRED / BLS",
                "sourceUrl": "https://fred.stlouisfed.org/series/PCU325211325211",
                "notes": "National plastics material and resin manufacturing PPI."
            },
            {
                "period": "2026-03",
                "label": "Resin PPI proxy",
                "amount": 312.707,
                "change": 4.4,
                "unit": "PPI index",
                "source": "FRED / BLS",
                "sourceUrl": "https://fred.stlouisfed.org/series/PCU325211325211",
                "notes": "Proxy increased month over month."
            },
            {
                "period": "2026-04",
                "label": "Resin PPI proxy",
                "amount": 331.419,
                "change": 18.7,
                "unit": "PPI index",
                "source": "FRED / BLS",
                "sourceUrl": "https://fred.stlouisfed.org/series/PCU325211325211",
                "notes": "Proxy increased sharply month over month."
            },
            {
                "period": "2026-05",
                "label": "Resin PPI proxy",
                "amount": 377.974,
                "change": 46.6,
                "unit": "PPI index",
                "source": "FRED / BLS",
                "sourceUrl": "https://fred.stlouisfed.org/series/PCU325211325211",
                "notes": "Proxy reached the highest point in the published series window."
            },
            {
                "period": "2026-06",
                "label": "Resin PPI proxy",
                "amount": 368.751,
                "change": -9.2,
                "unit": "PPI index",
                "source": "FRED / BLS",
                "sourceUrl": "https://fred.stlouisfed.org/series/PCU325211325211",
                "notes": "Proxy declined while public PE resin reporting pointed to lower June pricing."
            },
            {
                "period": "2026-06",
                "label": "PE resin market action",
                "amount": -0.15,
                "unit": "USD/lb",
                "source": "Plastics News / PlasticsToday",
                "sourceUrl": "https://www.plasticstoday.com/resin-pricing/resin-price-report-resin-buyers-face-closing-window-on-pricing-leverage",
                "notes": "Public resin reporting cited June PE price relief; use as North American market signal, not a California-only price."
            }
        ],
        "california_context": [
            "No credible free California-only resin spot or contract index was found during implementation.",
            "Use North American PE/PP market action, the national resin PPI, and supplier quotes for California customer decisions.",
            "California delivered cost can differ because of supplier location, freight, grade, contract terms, and product conversion timing."
        ],
        "research_findings": [
            "BLS PPI measures average selling prices received by domestic producers. It is useful for trend direction, not delivered California quotes.",
            "FRED PCU325211325211 is a national plastics material and resin manufacturing PPI; FRED WPU072A01 can help compare whether resin relief is showing up in plastics packaging products.",
            "PlasticsToday reported buyer leverage, weaker demand, inventory pressure, and no July increase initiatives in mid-2026 resin markets.",
            "Because public California-only resin pricing was not found, the dashboard must call this a proxy/signal and require supplier quote verification before customer repricing."
        ],
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
    for collection in ("market_history", "company_actions"):
        for item in meta.get(collection, []):
            for url in item.get("sourceUrls", [item.get("sourceUrl")]):
                if url and not any(link.get("url") == url for link in source_links):
                    source_links = [*source_links, {"label": item.get("source", item.get("company", "Source")), "url": url}]
    return {
        **payload,
        "freshness": meta["freshness"],
        "marketAction": action,
        "plainRead": meta.get("plain_read"),
        "analysis": meta.get("analysis"),
        "marketHistory": meta.get("market_history", []),
        "companyActions": meta.get("company_actions", []),
        "californiaContext": meta.get("california_context", []),
        "researchFindings": meta.get("research_findings", []),
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
        for collection in ("market_history", "company_actions"):
            for item in meta.get(collection, []):
                for url in item.get("sourceUrls", [item.get("sourceUrl")]):
                    if url and not any(link.get("url") == url for link in source_links):
                        source_links.append({"label": item.get("source", item.get("company", "Source")), "url": url})
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
                    "plainRead": meta.get("plain_read"),
                    "analysis": meta.get("analysis"),
                    "marketHistory": meta.get("market_history", []),
                    "companyActions": meta.get("company_actions", []),
                    "californiaContext": meta.get("california_context", []),
                    "researchFindings": meta.get("research_findings", []),
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
