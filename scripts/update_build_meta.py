from __future__ import annotations
from common import now_iso, write_json

write_json("build-meta.json", {
    "publishedAt": now_iso(),
    "summary": "GitHub Pages scaffold loaded. The first live GitHub Actions refresh path is wired for unemployment, federal funds, Sacramento gas and diesel, and natural disasters.",
    "notes": [
        "This dashboard is designed for GitHub Pages static hosting.",
        "Third-party sources are mirrored into local JSON by GitHub Actions."
    ]
})
