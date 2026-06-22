from __future__ import annotations
import re, requests
from common import now_iso, write_json, read_json, env, with_refresh_metadata
AAA_URL = "https://gasprices.aaa.com/?state=CA"
EIA_CA_URL = "https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_sca_w.htm"
EIA_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
EIA_CA_REGULAR_SERIES = "EMM_EPMR_PTE_SCA_DPG"
EIA_CA_DIESEL_SERIES = "EMD_EPD2D_PTE_SCA_DPG"
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
    sac_values = {}
    sac_table = re.search(r"<h3[^>]*>\s*Sacramento\s*</h3>.*?<tbody>(.*?)</tbody>", html, re.I | re.S)
    if sac_table:
        rows = re.findall(
            r"<tr>\s*<td>\s*(.*?)\s*</td>\s*"
            r"<td[^>]*>\s*\$?([0-9]+\.[0-9]+)\s*</td>\s*"
            r"<td[^>]*>\s*\$?([0-9]+\.[0-9]+)\s*</td>\s*"
            r"<td[^>]*>\s*\$?([0-9]+\.[0-9]+)\s*</td>\s*"
            r"<td[^>]*>\s*\$?([0-9]+\.[0-9]+)\s*</td>",
            sac_table.group(1),
            re.I | re.S,
        )
        for label, regular, _mid, _premium, diesel in rows:
            key = re.sub(r"[^a-z]", "", label.lower())
            sac_values[key] = {"regular": clean_number(regular), "diesel": clean_number(diesel)}
    sac_current = sac_values.get("currentavg", {})
    sac_week = sac_values.get("weekagoavg", {})
    return {
        "currentRegular": row("Current Avg."),
        "weekAgoRegular": row("Week Ago Avg."),
        "monthAgoRegular": row("Month Ago Avg."),
        "yearAgoRegular": row("Year Ago Avg."),
        "sacramentoRegular": sac_current.get("regular"),
        "sacramentoDiesel": sac_current.get("diesel"),
        "sacramentoWeekAgoRegular": sac_week.get("regular"),
        "sacramentoWeekAgoDiesel": sac_week.get("diesel"),
    }
def fetch_eia_history(api_key: str | None):
    existing = read_json("gas-history.json", default={"series": []}) or {"series": []}
    if not api_key:
        return with_refresh_metadata({**existing, "notes": (existing.get("notes", []) + ["EIA_API_KEY unavailable. Preserved previous California weekly history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA California weekly backup/context requires EIA_API_KEY; previous history is preserved when unavailable."])
    params = {"api_key": api_key,"frequency":"weekly","data[0]":"value","sort[0][column]":"period","sort[0][direction]":"desc","offset":0,"length":12}
    reg = requests.get(EIA_URL, params=params | {"facets[series][]":EIA_CA_REGULAR_SERIES}, timeout=30); reg.raise_for_status()
    diesel = requests.get(EIA_URL, params=params | {"facets[series][]":EIA_CA_DIESEL_SERIES}, timeout=30); diesel.raise_for_status()
    reg_rows = reg.json().get("response", {}).get("data", [])
    diesel_rows = diesel.json().get("response", {}).get("data", [])
    if not reg_rows or not diesel_rows:
        if existing.get("series"): return with_refresh_metadata({**existing, "lastUpdated": now_iso(), "notes": (existing.get("notes", []) + ["EIA returned no California weekly rows on this run. Preserved previous history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA returned no California weekly rows; previous history was preserved."])
        raise RuntimeError("EIA returned no California weekly gasoline or diesel history rows.")
    reg_map = {row["period"]: float(row["value"]) for row in reg_rows}
    diesel_map = {row["period"]: float(row["value"]) for row in diesel_rows}
    months = list(reversed(sorted(set(reg_map) & set(diesel_map))[-12:]))
    if not months:
        if existing.get("series"): return with_refresh_metadata({**existing, "lastUpdated": now_iso(), "notes": (existing.get("notes", []) + ["EIA returned no overlapping California gasoline/diesel periods. Preserved previous history."])[-5:]}, source_type="automated", refresh_status="source_limited", limitations=["EIA returned no overlapping California weekly gasoline/diesel periods; previous history was preserved."])
        raise RuntimeError("EIA returned no overlapping California weekly gasoline/diesel periods.")
    stamp = now_iso()
    return with_refresh_metadata({"lastUpdated": stamp,"sourceStrength":"High","freshness":"Weekly backup/context","sourceLinks":[{"label":"EIA California weekly gasoline and diesel prices","url":EIA_CA_URL}],"notes":["California backup/context history refreshed from EIA weekly retail gasoline and diesel prices."],"series":[{"date":m,"regular":reg_map[m],"diesel":diesel_map[m]} for m in months]}, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["EIA California weekly prices are not Sacramento metro prices; they are backup/context for the Sacramento-first AAA view."])
aaa = scrape_aaa()
history = fetch_eia_history(env("EIA_API_KEY"))
stamp = now_iso()
current = {"lastUpdated": stamp,"sourceStrength":"Medium","freshness":"Daily Sacramento + weekly CA backup","sourceLinks":[{"label":"AAA California Gas Prices","url":AAA_URL},{"label":"EIA California weekly gasoline and diesel prices","url":EIA_CA_URL}],"notes":["Sacramento regular is the primary tile value.","AAA is scraped in GitHub Actions, not in the browser.","EIA California weekly gasoline and diesel prices are retained as backup/context, not Sacramento-specific pricing."], **aaa}
if history.get("series"):
    latest_eia = history["series"][-1]
    prior_eia = history["series"][-2] if len(history["series"]) > 1 else {}
    current["eiaCaliforniaRegular"] = latest_eia.get("regular")
    current["eiaCaliforniaDiesel"] = latest_eia.get("diesel")
    current["eiaCaliforniaWeekAgoRegular"] = prior_eia.get("regular")
    current["eiaCaliforniaWeekAgoDiesel"] = prior_eia.get("diesel")
if current.get("currentRegular") is None and current.get("eiaCaliforniaRegular") is not None: current["currentRegular"] = current["eiaCaliforniaRegular"]
if current.get("weekAgoRegular") is None and current.get("eiaCaliforniaWeekAgoRegular") is not None: current["weekAgoRegular"] = current["eiaCaliforniaWeekAgoRegular"]
if current.get("currentDiesel") is None and current.get("eiaCaliforniaDiesel") is not None: current["currentDiesel"] = current["eiaCaliforniaDiesel"]
if current.get("weekAgoDiesel") is None and current.get("eiaCaliforniaWeekAgoDiesel") is not None: current["weekAgoDiesel"] = current["eiaCaliforniaWeekAgoDiesel"]
write_json("gas-current.json", with_refresh_metadata(current, source_type="automated", refresh_status="success", attempted_at=stamp, successful_at=stamp, limitations=["Sacramento AAA values are primary. EIA California weekly prices are used as backup/context only because they are statewide, not Sacramento metro."]))
write_json("gas-history.json", history)
