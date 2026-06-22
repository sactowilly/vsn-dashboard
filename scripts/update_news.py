from __future__ import annotations
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus
import xml.etree.ElementTree as ET
import requests
from common import now_iso, preserve_with_failure, write_json, with_refresh_metadata

QUERY = "packaging industry OR containerboard OR corrugated OR resin OR plastics packaging when:30d"
URL = f"https://news.google.com/rss/search?q={quote_plus(QUERY)}&hl=en-US&gl=US&ceid=US:en"
LIMITATIONS = [
    "Public Google News RSS results are a signal feed, not a complete industry news database.",
    "Headlines are not manually verified before publication to this dashboard.",
]

def impact_for(title: str) -> str:
    text = title.lower()
    high_terms = ("shutdown", "strike", "bankrupt", "acquires", "acquisition", "fire", "disaster", "mill")
    medium_terms = ("pricing", "containerboard", "resin", "pulp", "corrugated", "supply", "epr", "regulation")
    if any(term in text for term in high_terms):
        return "High"
    if any(term in text for term in medium_terms):
        return "Medium"
    return "Low"

try:
    r = requests.get(URL, headers={"User-Agent": "dashboard-data-bot/1.0"}, timeout=30)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    stories = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source = item.find("source")
        source_name = source.text.strip() if source is not None and source.text else "Google News"
        pub_date = item.findtext("pubDate") or ""
        published = ""
        if pub_date:
            try:
                published = parsedate_to_datetime(pub_date).isoformat(timespec="minutes")
            except Exception:
                published = pub_date
        if title:
            stories.append({"title": title, "source": source_name, "url": link, "publishedAt": published, "impact": impact_for(title)})
        if len(stories) >= 8:
            break
    if not stories:
        raise RuntimeError("Google News RSS returned no items.")
    stamp = now_iso()
    write_json(
        "news.json",
        with_refresh_metadata(
            {
                "lastUpdated": stamp,
                "sourceStrength": "Medium",
                "freshness": "Daily signal feed",
                "whatChanged": "Packaging news signal feed refreshed from public Google News RSS.",
                "notes": ["Packaging-focused public signal feed for management context."],
                "sourceLinks": [{"label": "Google News RSS packaging query", "url": URL}],
                "stories": stories,
            },
            source_type="automated",
            refresh_status="success",
            attempted_at=stamp,
            successful_at=stamp,
            limitations=LIMITATIONS,
        ),
    )
except Exception as exc:
    write_json("news.json", preserve_with_failure("news.json", f"News refresh failed: {exc}. Preserved previous stories.", source_type="automated", limitations=LIMITATIONS))
    raise
