from __future__ import annotations
import requests
from common import now_iso, write_json, env, with_refresh_metadata, preserve_with_failure
URL = "https://api.stlouisfed.org/fred/series/observations"
api_key = env("FRED_API_KEY")
if not api_key:
    write_json("fed.json", preserve_with_failure("fed.json", "FRED_API_KEY is required for update_fed.py. Preserved previous federal funds data.", source_type="automated", limitations=["Daily federal funds data may publish with a short FRED lag."]))
    raise SystemExit(0)
r = requests.get(URL, params={"series_id":"DFF","api_key":api_key,"file_type":"json","sort_order":"desc","limit":12}, timeout=30)
r.raise_for_status()
obs = r.json().get("observations", []); obs.reverse()
# DFF is a DAILY series. Keep the full YYYY-MM-DD date; truncating to YYYY-MM
# collapses every observation onto the same month label and makes the
# point-over-point delta meaningless.
series = [{"date": o["date"], "value": float(o["value"])} for o in obs if o.get("value") not in (".", None)]
stamp = now_iso()
write_json("fed.json", with_refresh_metadata({"lastUpdated": stamp, "sourceStrength":"High","freshness":"Daily","sourceLinks":[{"label":"FRED Effective Federal Funds Rate","url":"https://fred.stlouisfed.org/series/DFF"}],"notes":["This file is refreshed by GitHub Actions using the FRED API."],"series":series}, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["Daily federal funds data may publish with a short FRED lag."]))
