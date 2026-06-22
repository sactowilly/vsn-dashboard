from __future__ import annotations
import re, requests
from common import now_iso, write_json, read_json, env, with_refresh_metadata
AAA_URL = "https://gasprices.aaa.com/?state=CA"
EIA_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
USER_AGENT = "Mozilla/5.0 (compatible; dashboard-data-bot/1.0)"
def clean_number(text: str):
    text = text.strip().replace("$","").replace(",","")
    try: return float(text)
    except ValueError: return None
def scrape_aaa():
    r = requests.get(AAA_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status(); html = r.text
    def row(label: str):
        # Tolerant of attributes/whitespace between the label cell and the value cell.
        m = re.search(rf"{re.escape(label)}\s*</td>\s*<td[^>]*>\s*\$?([0-9]+\.[0-9]+)", html, re.I)
        return clean_number(m.group(1)) if m else None
    # Sacramento metro row: grab the next up-to-two price-like numbers that follow
    # the "Sacramento" label, tolerant of the exact tag layout (which AAA changes).
    sac_reg = sac_week = None
    sac_block = re.search(r"Sacramento.{0,400}", html, re.I | re.S)
    if sac_block:
        prices = re.findall(r"\$?([0-9]\.[0-9]{2,3})", sac_block.group(0))
        if prices:
            sac_reg = clean_number(prices[0])
        if len(prices) > 1:
            sac_week = clean_number(prices[1])
    return {
        "currentRegular": row("Current Avg."),
        "weekAgoRegular": row("Week Ago Avg."),
        "monthAgoRegular": row("Month Ago Avg."),
        "yearAgoRegular": row("Year Ago Avg."),
        "sacramentoRegular": sac_reg,
        "sacramentoWeekAgoRegular": sac_week,
    }
def fetch_eia_history(api_key: str | None):
    existing = read_json("gas-history.json", default={"series": []}) or {"series": []}
    if not api_key:
        return with_refresh_metadata({**existing, "notes": (existing.get("notes", []) + ["EIA_API_KEY unavailable. Preserved previous history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA history requires EIA_API_KEY; previous history is preserved when unavailable."])
    params = {"api_key": api_key,"frequency":"monthly","data[0]":"value","sort[0][column]":"period","sort[0][direction]":"desc","offset":0,"length":12}
    reg = requests.get(EIA_URL, params=params | {"facets[series][]":"EMM_EPMRU_PTE_SCA_DPG"}, timeout=30); reg.raise_for_status()
    diesel = requests.get(EIA_URL, params=params | {"facets[series][]":"EMD_EPD2D_PTE_SCA_DPG"}, timeout=30); diesel.raise_for_status()
    reg_rows = reg.json().get("response", {}).get("data", [])
    diesel_rows = diesel.json().get("response", {}).get("data", [])
    if not reg_rows or not diesel_rows:
        if existing.get("series"): return with_refresh_metadata({**existing, "lastUpdated": now_iso(), "notes": (existing.get("notes", []) + ["EIA returned no rows on this run. Preserved previous history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA returned no rows; previous history was preserved."])
        raise RuntimeError("EIA returned no gasoline or diesel history rows.")
    reg_map = {row["period"]: float(row["value"]) for row in reg_rows}
    diesel_map = {row["period"]: float(row["value"]) for row in diesel_rows}
    months = list(reversed(sorted(set(reg_map) & set(diesel_map))[-12:]))
    if not months:
        if existing.get("series"): return with_refresh_metadata({**existing, "lastUpdated": now_iso(), "notes": (existing.get("notes", []) + ["EIA returned no overlapping gasoline/diesel periods. Preserved previous history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA returned no overlapping gasoline/diesel periods; previous history was preserved."])
        raise RuntimeError("EIA returned no overlapping gasoline/diesel periods.")
    stamp = now_iso()
    return with_refresh_metadata({"lastUpdated": stamp,"sourceStrength":"High","freshness":"Monthly","sourceLinks":[{"label":"EIA","url":"https://www.eia.gov/"}],"notes":["History refreshed from EIA."],"series":[{"date":m,"regular":reg_map[m],"diesel":diesel_map[m]} for m in months]}, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["Monthly EIA data can lag daily AAA prices."])
aaa = scrape_aaa()
history = fetch_eia_history(env("EIA_API_KEY"))
stamp = now_iso()
current = {"lastUpdated": stamp,"sourceStrength":"Medium","freshness":"Daily + Monthly","sourceLinks":[{"label":"AAA California Gas Prices","url":AAA_URL},{"label":"EIA","url":"https://www.eia.gov/"}],"notes":["Sacramento regular is the primary tile value.","AAA is scraped in GitHub Actions, not in the browser.","California regular and diesel remain secondary context."], **aaa}
if current.get("currentDiesel") is None and history.get("series"): current["currentDiesel"] = history["series"][-1]["diesel"]
if current.get("weekAgoDiesel") is None and history.get("series"): current["weekAgoDiesel"] = history["series"][-1]["diesel"]
write_json("gas-current.json", with_refresh_metadata(current, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["AAA values are scraped from public pages; Sacramento metro values may be unavailable and fall back to California averages."]))
write_json("gas-history.json", history)
