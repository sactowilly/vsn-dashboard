from __future__ import annotations
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus, urlparse
import time
import xml.etree.ElementTree as ET
import requests
from common import now_iso, preserve_with_failure, read_json, write_json, with_refresh_metadata

LIMITATIONS = [
    "Competitor list is curated manually; this script only refreshes public news signals for listed companies.",
    "Google News RSS can miss relevant account-level activity and can include false positives.",
    "Hiring links are included only when a direct job advertisement or hiring announcement URL is available; generic search-result URLs are intentionally suppressed.",
]

GENERIC_SEARCH_HOSTS = {"google.com", "www.google.com", "news.google.com", "bing.com", "www.bing.com"}
GOOGLE_HOSTS = {"google.com", "www.google.com", "news.google.com"}

def is_generic_search_url(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()
    return host in GENERIC_SEARCH_HOSTS and ("/search" in path or "/rss/search" in path or "q=" in parsed.query)

def is_google_url(url: str) -> bool:
    return bool(url) and urlparse(url).netloc.lower() in GOOGLE_HOSTS

def direct_hiring_item(item, fallback_date: str = ""):
    if isinstance(item, str):
        return {
            "title": item,
            "source": "Curated",
            "url": "",
            "publishedAt": fallback_date,
            "linkStatus": "direct_job_link_unavailable",
        }
    cleaned = {
        "title": item.get("title", "Hiring signal"),
        "source": item.get("source", "Curated"),
        "url": item.get("url", ""),
        "publishedAt": item.get("publishedAt") or item.get("date") or fallback_date,
    }
    explicit_status = item.get("linkStatus", "")
    if explicit_status == "listing_source_signal":
        cleaned["linkStatus"] = explicit_status
        if item.get("notes"):
            cleaned["notes"] = item.get("notes", "")
    elif is_generic_search_url(cleaned["url"]) or is_google_url(cleaned["url"]):
        cleaned["url"] = ""
        cleaned["linkStatus"] = "direct_job_link_unavailable"
    elif cleaned["url"]:
        cleaned["linkStatus"] = "direct_job_link"
    else:
        cleaned["linkStatus"] = explicit_status or "direct_job_link_unavailable"
        if item.get("notes"):
            cleaned["notes"] = item.get("notes", "")
    return cleaned

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
            moves.append(item)
    return moves[:3]

def classify_hiring(items):
    hiring = []
    for item in items:
        title = item["title"]
        text = title.lower()
        if any(term in text for term in ("hiring", "jobs", "job fair", "career", "recruit", "new jobs")):
            hiring.append(item)
    return hiring[:3]

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
        news_items = items[:3]
        moves = classify_moves(items)
        hiring = classify_hiring(items)
        existing_signals = company.get("signals", {}) or {}
        existing_hiring = existing_signals.get("hiring", [])
        if existing_hiring and not hiring:
            hiring = [direct_hiring_item(item, existing_signals.get("lastUpdated") or "") for item in existing_hiring]
        else:
            hiring = [direct_hiring_item(item, item.get("publishedAt", "") if isinstance(item, dict) else "") for item in hiring]
        updated.append(
            {
                **company,
                "signals": {
                    "lastUpdated": stamp,
                    "news": news_items,
                    "hiring": hiring,
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
