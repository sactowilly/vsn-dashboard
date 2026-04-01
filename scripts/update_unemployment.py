from __future__ import annotations
import requests
from common import now_iso, write_json, env

OBS = "https://api.stlouisfed.org/fred/series/observations"
SEARCH = "https://api.stlouisfed.org/fred/series/search"

def fetch_series(series_id: str, api_key: str, limit: int = 12):
    r = requests.get(OBS, params={"series_id":series_id,"api_key":api_key,"file_type":"json","sort_order":"desc","limit":limit}, timeout=30)
    r.raise_for_status()
    rows = r.json().get("observations", [])
    rows.reverse()
    return [{"date": o["date"][:7], "value": float(o["value"])} for o in rows if o.get("value") not in (".", None)]

api_key = env("FRED_API_KEY")
if not api_key:
    raise SystemExit("FRED_API_KEY is required for update_unemployment.py")

sac_id = env("FRED_SACRAMENTO_UR_SERIES_ID")
if not sac_id:
    r = requests.get(SEARCH, params={"search_text":"Unemployment Rate in Sacramento County, CA","api_key":api_key,"file_type":"json","limit":1,"order_by":"search_rank","sort_order":"desc"}, timeout=30)
    r.raise_for_status()
    items = r.json().get("seriess", [])
    if not items:
        raise SystemExit("Could not discover Sacramento unemployment series from FRED search.")
    sac_id = items[0]["id"]

us = fetch_series("UNRATE", api_key)
ca = fetch_series("CAUR", api_key)
sac = fetch_series(sac_id, api_key)
by_month = {}
for row in us: by_month.setdefault(row["date"], {})["us"] = row["value"]
for row in ca: by_month.setdefault(row["date"], {})["california"] = row["value"]
for row in sac: by_month.setdefault(row["date"], {})["sacramento"] = row["value"]
months = sorted(by_month.keys())[-12:]
merged = [{"date":m,"us":by_month[m]["us"],"california":by_month[m]["california"],"sacramento":by_month[m]["sacramento"]} for m in months if {"us","california","sacramento"} <= by_month[m].keys()]
write_json("unemployment.json", {"lastUpdated": now_iso(),"sourceStrength":"High","freshness":"Monthly","sourceLinks":[{"label":"FRED UNRATE","url":"https://fred.stlouisfed.org/series/UNRATE"},{"label":"FRED CAUR","url":"https://fred.stlouisfed.org/series/CAUR"},{"label":"FRED Sacramento unemployment search","url":"https://fred.stlouisfed.org/tags/series?t=sacramento%3Bunemployment"}],"notes":["This file is refreshed by GitHub Actions using FRED-hosted BLS series.", f"Sacramento series id used: {sac_id}"],"series":merged})
