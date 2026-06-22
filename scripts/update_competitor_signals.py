from __future__ import annotations
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus
import time
import xml.etree.ElementTree as ET
import requests
from common import now_iso, preserve_with_failure, read_json, write_json, with_refresh_metadata

LIMITATIONS = [
    "Competitor list is curated manually; this script only refreshes public news signals for listed companies.",
    "Google News RSS can miss relevant account-level activity and can include false positives.",
]

def google_news_items(query: str, limit: int = 3):
    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    r = requests.get(url, headers={"User-Agent": "dashboard-data-bot/1.0"}, timeout=30)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    out = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue
        source = item.find("source")
        source_name = source.text.strip() if source is not None and source.text else "Google News"
        pub_date = item.findtext("pubDate") or ""
        published = ""
        if pub_date:
            try:
                published = parsedate_to_datetime(pub_date).isoformat(timespec="minutes")
            except Exception:
                published = pub_date
        out.append({"title": title, "source": source_name, "url": (item.findtext("link") or "").strip(), "publishedAt": published})
        if len(out) >= limit:
            break
    return out

def classify_moves(items):
    moves = []
    for item in items:
        title = item["title"]
        text = title.lower()
        if any(term in text for term in ("acquires", "acquisition", "expands", "expansion", "opens", "facility", "plant", "distribution")):
            moves.append(title)
    return moves[:3]

data = read_json("competitors.json", default={}) or {}
companies = data.get("companies", [])
if not companies:
    write_json("competitors.json", preserve_with_failure("competitors.json", "No curated companies found for competitor signal refresh.", source_type="hybrid", limitations=LIMITATIONS))
    raise SystemExit(0)

try:
    stamp = now_iso()
    updated = []
    for company in companies:
        name = company.get("name", "")
        category = company.get("category", "packaging")
        query = f'"{name}" packaging OR corrugated OR distribution when:30d'
        items = google_news_items(query, limit=3)
        news_titles = [item["title"] for item in items[:3]]
        moves = classify_moves(items)
        existing_signals = company.get("signals", {}) or {}
        updated.append(
            {
                **company,
                "signals": {
                    "lastUpdated": stamp,
                    "news": news_titles,
                    "hiring": existing_signals.get("hiring", []),
                    "moves": moves,
                    "items": items,
                    "query": query,
                    "categoryContext": category,
                },
            }
        )
        time.sleep(0.2)
    write_json(
        "competitors.json",
        with_refresh_metadata(
            {
                **data,
                "lastUpdated": stamp,
                "sourceStrength": "Medium",
                "freshness": "Curated list + daily public signals",
                "whatChanged": "Curated competitor list retained; public news signals refreshed from Google News RSS.",
                "notes": ["Company list is manually curated.", "Public signals are refreshed automatically and should be reviewed before account action."],
                "companies": updated,
            },
            source_type="hybrid",
            refresh_status="success",
            attempted_at=stamp,
            successful_at=stamp,
            limitations=LIMITATIONS,
        ),
    )
except Exception as exc:
    write_json("competitors.json", preserve_with_failure("competitors.json", f"Competitor signal refresh failed: {exc}. Preserved previous curated list and signals.", source_type="hybrid", limitations=LIMITATIONS))
    raise
