from __future__ import annotations
from common import now_iso, read_json, write_json, with_refresh_metadata

LIMITATIONS = [
    "Labor data remains manual in v0.5 because no stable public Cornell/download endpoint is confirmed in this implementation.",
    "Review Cornell ILR Labor Action Tracker manually before treating this tile as complete.",
]

data = read_json("labor.json", default={}) or {}
stamp = now_iso()
write_json(
    "labor.json",
    with_refresh_metadata(
        {
            **data,
            "sourceStrength": "Medium",
            "freshness": "Manual / monitored",
            "whatChanged": "Labor remains a manually monitored source in v0.5; daily automation is not claimed.",
            "notes": ["Manual labor dataset. Use as a monitored watchlist, not a live feed."],
            "sourceLinks": data.get("sourceLinks") or [{"label": "Cornell ILR Labor Action Tracker", "url": "https://striketracker.ilr.cornell.edu/"}],
        },
        source_type="manual",
        refresh_status="manual",
        attempted_at=stamp,
        successful_at=data.get("lastSuccessfulAt") or data.get("lastUpdated"),
        limitations=LIMITATIONS,
    ),
)
