from __future__ import annotations
import requests
from common import now_iso, write_json, env
URL = "https://api.stlouisfed.org/fred/series/observations"
api_key = env("FRED_API_KEY")
if not api_key: raise SystemExit("FRED_API_KEY is required for update_fed.py")
r = requests.get(URL, params={"series_id":"DFF","api_key":api_key,"file_type":"json","sort_order":"desc","limit":12}, timeout=30)
r.raise_for_status()
obs = r.json().get("observations", []); obs.reverse()
series = [{"date": o["date"][:7], "value": float(o["value"])} for o in obs if o.get("value") not in (".", None)]
write_json("fed.json", {"lastUpdated": now_iso(), "sourceStrength":"High","freshness":"Daily","sourceLinks":[{"label":"FRED Effective Federal Funds Rate","url":"https://fred.stlouisfed.org/series/DFF"}],"notes":["This file is refreshed by GitHub Actions using the FRED API."],"series":series})
