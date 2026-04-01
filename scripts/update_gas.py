from __future__ import annotations
import re, requests
from common import now_iso, write_json, read_json, env

AAA_URL = "https://gasprices.aaa.com/?state=CA"
EIA_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
USER_AGENT = "Mozilla/5.0 (compatible; dashboard-data-bot/1.0)"

def clean_number(text: str):
    text = text.strip().replace("$","").replace(",","")
    try: return float(text)
    except ValueError: return None

def scrape_aaa():
    r = requests.get(AAA_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    html = r.text
    def row(label: str):
        m = re.search(rf"{label}</td>\s*<td[^>]*>\$?([0-9]+\.[0-9]+)", html, re.I)
        return clean_number(m.group(1)) if m else None
    # Sacramento metro: current and week ago columns
    metro = re.search(r"Sacramento[^<]*</a></td>\s*<td[^>]*>\$?([0-9]+\.[0-9]+)\s*</td>\s*<td[^>]*>\$?([0-9]+\.[0-9]+)", html, re.I)
    return {
        "currentRegular": row("Current Avg."),
        "weekAgoRegular": row("Week Ago Avg."),
        "monthAgoRegular": row("Month Ago Avg."),
        "yearAgoRegular": row("Year Ago Avg."),
        "sacramentoRegular": clean_number(metro.group(1)) if metro else None,
        "sacramentoWeekAgoRegular": clean_number(metro.group(2)) if metro else None,
    }

def fetch_eia_history(api_key: str | None):
    existing = read_json("gas-history.json", default={"series":[]}) or {"series":[]}
    if not api_key:
        return existing
    params = {"api_key":api_key,"frequency":"monthly","data[0]":"value","sort[0][column]":"period","sort[0][direction]":"desc","offset":0,"length":12}
    reg = requests.get(EIA_URL, params=params | {"facets[series][]":"EMM_EPMRU_PTE_SCA_DPG"}, timeout=30); reg.raise_for_status()
    diesel = requests.get(EIA_URL, params=params | {"facets[series][]":"EMD_EPD2D_PTE_SCA_DPG"}, timeout=30); diesel.raise_for_status()
    reg_rows = reg.json().get("response", {}).get("data", [])
    diesel_rows = diesel.json().get("response", {}).get("data", [])
    reg_map = {row["period"]: float(row["value"]) for row in reg_rows}
    diesel_map = {row["period"]: float(row["value"]) for row in diesel_rows}
    months = list(reversed(sorted(set(reg_map) & set(diesel_map))[-12:]))
    return {"lastUpdated": now_iso(),"sourceStrength":"High","freshness":"Monthly","sourceLinks":[{"label":"EIA","url":"https://www.eia.gov/"}],"series":[{"date":m,"regular":reg_map[m],"diesel":diesel_map[m]} for m in months]}

aaa = scrape_aaa()
history = fetch_eia_history(env("EIA_API_KEY"))
current = {"lastUpdated": now_iso(),"sourceStrength":"Medium","freshness":"Daily + Monthly","sourceLinks":[{"label":"AAA California Gas Prices","url":AAA_URL},{"label":"EIA","url":"https://www.eia.gov/"}],"notes":["Sacramento regular is the primary tile value.","AAA is scraped in GitHub Actions, not in the browser.","California regular and diesel remain secondary context."],**aaa}
if current.get("currentDiesel") is None and history.get("series"): current["currentDiesel"] = history["series"][-1]["diesel"]
if current.get("weekAgoDiesel") is None and history.get("series"): current["weekAgoDiesel"] = history["series"][-1]["diesel"]
write_json("gas-current.json", current)
write_json("gas-history.json", history)
