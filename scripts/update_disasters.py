from __future__ import annotations
import requests
from common import now_iso, write_json, with_refresh_metadata
USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
NWS_URL = "https://api.weather.gov/alerts/active?area=CA"
r = requests.get(USGS_URL, timeout=30); r.raise_for_status()
usgs = []
for f in r.json().get("features", [])[:8]:
    p = f.get("properties", {}); mag = p.get("mag")
    if mag is None: continue
    usgs.append({"type":"Earthquake","region":p.get("place") or "Unknown","severity":"High" if mag >= 5 else "Medium" if mag >= 3 else "Low"})
r = requests.get(NWS_URL, headers={"User-Agent":"dashboard-data-bot/1.0"}, timeout=30); r.raise_for_status()
nws = []
for f in r.json().get("features", [])[:8]:
    p = f.get("properties", {}); sev = p.get("severity") or "Unknown"
    nws.append({"type":p.get("headline") or p.get("event") or "Alert","region":p.get("areaDesc") or "California","severity": sev.title() if isinstance(sev,str) else "Unknown"})
stamp = now_iso()
write_json("disasters.json", with_refresh_metadata({"lastUpdated": stamp,"sourceStrength":"High","freshness":"Live mirror","whatChanged":"USGS and NWS published data were mirrored into local JSON by GitHub Actions.","sourceLinks":[{"label":"USGS","url":"https://earthquake.usgs.gov/earthquakes/feed/"},{"label":"NWS Alerts API","url":"https://www.weather.gov/documentation/services-web-api"}],"notes":["This tile is event-card driven rather than using a synthetic single score."],"events":(usgs+nws)[:12]}, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["Mirrors public USGS and NWS feeds; it is not a full supply-chain disruption model."]))
