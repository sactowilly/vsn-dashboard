from __future__ import annotations
from common import now_iso, write_json, with_refresh_metadata
stamp = now_iso()
write_json("build-meta.json", with_refresh_metadata({"publishedAt": stamp, "lastUpdated": stamp, "summary": "GitHub Pages production build loaded. v0.5 data reliability metadata and refresh path are wired.", "notes": ["This dashboard is designed for GitHub Pages static hosting.","Third-party sources are mirrored into local JSON by GitHub Actions."]}, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["This timestamp is the workflow run time, not proof that every source changed."]))
