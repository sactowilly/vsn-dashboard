from __future__ import annotations
from common import now_iso, write_json
write_json("build-meta.json", {"publishedAt": now_iso(), "summary": "GitHub Pages production build loaded. Sacramento-first gas logic, high-contrast UI, and live GitHub Actions refresh path are wired.", "notes": ["This dashboard is designed for GitHub Pages static hosting.","Third-party sources are mirrored into local JSON by GitHub Actions."]})
