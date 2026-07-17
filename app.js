const cfg = window.DASHBOARD_CONFIG;
const APP_VERSION = "v0.5";

const state = {
  data: {},
  cards: [],
  chart: null,
  loadErrors: [],
  lastClientRefresh: null
};

const els = {
  tileGrid: document.getElementById("tileGrid"),
  detailDrawer: document.getElementById("detailDrawer"),
  detailOverlay: document.getElementById("detailOverlay"),
  detailContent: document.getElementById("detailContent"),
  detailCloseButton: document.getElementById("detailCloseButton"),
  refreshButton: document.getElementById("refreshButton"),
  clockDisplay: document.getElementById("clockDisplay"),
  globalLastUpdated: document.getElementById("globalLastUpdated"),
  footerLastChanged: document.getElementById("footerLastChanged"),
  statusToast: document.getElementById("statusToast"),
  overviewSummary: document.getElementById("overviewSummary"),
  overviewStats: document.getElementById("overviewStats"),
  appVersion: document.getElementById("appVersion")
};

if (els.appVersion) els.appVersion.textContent = APP_VERSION;

const TILE_SOURCE = {
  unemployment: { key: "unemployment", maxAgeDays: 45 },
  fed: { key: "fed", maxAgeDays: 5 },
  stocks: { key: "stocks", maxAgeDays: 5 },
  disasters: { key: "disasters", maxAgeDays: 4 },
  labor: { key: "labor", maxAgeDays: 14 },
  pulp: { key: "pulp", maxAgeDays: 45 },
  resin: { key: "resin", maxAgeDays: 45 },
  gas: { key: "gasCurrent", maxAgeDays: 5 },
  competitors: { key: "competitors", maxAgeDays: 30 },
  news: { key: "news", maxAgeDays: 14 }
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(dateLike, options = {}) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    ...options
  }).format(date);
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value));
}

function pct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "Unavailable";
  return `${Number(value).toFixed(digits)}%`;
}

function signedPct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "Unavailable";
  const sign = Number(value) > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(digits)}%`;
}

function num(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "Unavailable";
  return Number(value).toFixed(digits);
}

function signedNum(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "Unavailable";
  const sign = Number(value) > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(digits)}`;
}

function marketActionLabel(action) {
  if (!action) return "";
  if (action.label) return action.label;
  if (action.amount == null || !action.unit) return action.market || "Market action";
  const abs = Math.abs(Number(action.amount));
  const sign = Number(action.amount) > 0 ? "+" : Number(action.amount) < 0 ? "-" : "";
  const value = action.unit === "USD/lb" ? `$${abs.toFixed(2)}/lb` : action.unit === "USD/ST" ? `$${abs.toFixed(0)}/ST` : `${abs} ${action.unit}`;
  return `${action.market || "Market"} ${sign}${value}`;
}

function percentChange(current, previous) {
  if (current == null || previous == null || Number(previous) === 0) return null;
  return ((Number(current) - Number(previous)) / Number(previous)) * 100;
}

function chip(text, tone = "") {
  return `<span class="chip ${esc(tone)}">${esc(text)}</span>`;
}

function trendWord(value, threshold = 0) {
  if (value == null || Number.isNaN(Number(value))) return "unavailable";
  if (Number(value) > threshold) return "up";
  if (Number(value) < -threshold) return "down";
  return "flat";
}

function riskLabel(risk) {
  return risk === "high" ? "High" : risk === "medium" ? "Medium" : "Low";
}

function latest(series) {
  return (series || [])[series.length - 1] || {};
}

function previous(series) {
  return (series || [])[Math.max(0, (series || []).length - 2)] || {};
}

function sourceFor(tileId) {
  const meta = TILE_SOURCE[tileId];
  return meta ? state.data[meta.key] || {} : {};
}

function publishedAt() {
  return state.data.buildMeta?.publishedAt || state.data.buildMeta?.lastUpdated || new Date().toISOString();
}

function freshnessInfo(tileId) {
  const meta = TILE_SOURCE[tileId];
  if (!meta) return { updated: null, stale: false, ageDays: null, strength: null, freshness: null, sourceType: "unknown", refreshStatus: "unknown", qualityGroup: "current" };
  const src = state.data[meta.key] || {};
  const updated = src.lastUpdated || null;
  const strength = src.sourceStrength || "Unknown";
  const freshness = src.freshness || "Unspecified";
  const sourceType = src.sourceType || "unknown";
  const refreshStatus = src.refreshStatus || "unknown";
  let ageDays = null;
  let stale = false;
  let qualityGroup = "current";

  if (updated) {
    ageDays = (Date.now() - new Date(updated).getTime()) / 86400000;
    stale = ageDays > meta.maxAgeDays && sourceType !== "manual";
  } else {
    stale = sourceType !== "manual";
  }

  if (refreshStatus === "failed") qualityGroup = "failed";
  else if (sourceType === "manual" || refreshStatus === "manual") qualityGroup = "manual";
  else if (sourceType === "proxy" || refreshStatus === "source_limited") qualityGroup = "limited";
  else if (stale) qualityGroup = "stale";

  return { updated, stale, ageDays, strength, freshness, maxAgeDays: meta.maxAgeDays, sourceType, refreshStatus, qualityGroup };
}

function sourceQuality(tileId) {
  const info = freshnessInfo(tileId);
  const src = sourceFor(tileId);
  const limitations = src.sourceLimitations || [];
  if (info.refreshStatus === "failed") return `Refresh failed. ${limitations[0] || "Use preserved data until the next successful workflow run."}`;
  if (info.sourceType === "manual") return `Manual/curated source. ${limitations[0] || "Review this source before treating it as current."}`;
  if (info.sourceType === "proxy") return `Proxy indicator. ${limitations[0] || "Use directionally, not as exact market pricing."}`;
  if (info.refreshStatus === "source_limited") return `Source limited. ${limitations[0] || "The latest run preserved usable prior data."}`;
  if (!info.updated) return "No timestamp. Treat as source-limited until verified.";
  const age = Math.max(0, Math.round(info.ageDays || 0));
  const status = info.stale ? "Stale" : "Current";
  return `${status}: ${info.strength} source, updated ${age} day(s) ago, expected freshness ${info.freshness}.`;
}

function titleCase(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function dateLabel(dateLike) {
  if (!dateLike) return "Date unavailable";
  return fmt(dateLike, { month: "short", day: "numeric", year: "numeric" });
}

function stampInfo(dateLike) {
  if (!dateLike) return { text: "\u{1F44E} No data timestamp", tone: "bad" };
  const ageDays = (Date.now() - new Date(dateLike).getTime()) / 86400000;
  if (Number.isNaN(ageDays)) return { text: "\u{1F44E} Invalid timestamp", tone: "bad" };
  const label = fmt(dateLike, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (ageDays < 1) return { text: `\u{1F44D} Updated today, ${label}`, tone: "good" };
  if (ageDays <= 30) return { text: `\u26A0\uFE0F Updated ${label}`, tone: "caution" };
  return { text: `\u{1F44E} Updated ${label}`, tone: "bad" };
}

function signalTitle(item) {
  return typeof item === "string" ? item : item?.title || "Signal";
}

function signalUrl(item, fallback = "") {
  return typeof item === "object" && item?.url ? item.url : fallback;
}

function signalDate(item, fallback = "") {
  return typeof item === "object" && item?.publishedAt ? item.publishedAt : fallback;
}

function signalItemHtml(item, fallbackUrl = "") {
  const title = signalTitle(item);
  const url = signalUrl(item, fallbackUrl);
  const date = signalDate(item);
  const source = typeof item === "object" && item?.source ? ` | ${item.source}` : "";
  const statusText = typeof item === "object" && item?.linkStatus === "direct_job_link_unavailable"
    ? " | direct job link unavailable"
    : typeof item === "object" && item?.linkStatus === "listing_source_signal"
      ? " | listing-source signal"
      : "";
  const note = typeof item === "object" && item?.notes
    ? `<span class="signal-note">${esc(item.notes)}</span>`
    : "";
  const linked = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
    : esc(title);
  return `<li>${linked}<span class="signal-meta">${esc(dateLabel(date))}${esc(source)}${esc(statusText)}</span>${note}</li>`;
}

function showToast(message) {
  els.statusToast.textContent = message;
  els.statusToast.className = "toast show";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.statusToast.className = "toast";
  }, 2800);
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
  els.refreshButton.textContent = isLoading ? "Refreshing..." : "Refresh Published Data";
  els.tileGrid.classList.toggle("loading", isLoading);
  if (isLoading && !state.cards.length) {
    els.tileGrid.innerHTML = `<div class="loading-card">Loading published data...</div>`;
  }
}

async function loadPublishedData() {
  const entries = Object.entries(cfg.dataFiles);
  const cacheBust = `v=${Date.now()}`;
  const results = await Promise.allSettled(
    entries.map(async ([key, path]) => {
      const separator = path.includes("?") ? "&" : "?";
      const res = await fetch(`${path}${separator}${cacheBust}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try {
        return [key, await res.json()];
      } catch (e) {
        throw new Error("invalid JSON");
      }
    })
  );

  const out = {};
  const errors = [];
  results.forEach((result, i) => {
    const [key, path] = entries[i];
    if (result.status === "fulfilled") {
      out[result.value[0]] = result.value[1];
    } else {
      errors.push({ key, path, reason: result.reason?.message || "load failed" });
    }
  });

  state.data = out;
  state.loadErrors = errors;
  state.lastClientRefresh = new Date().toISOString();
}

function chartConfig(labels, series, title) {
  if (!labels?.length || !series?.length) return null;
  return { labels, series, title };
}

function buildLineChartFromSeries(series, fields, title) {
  if (!series?.length) return null;
  return chartConfig(
    series.map(row => row.date || ""),
    fields.map(field => ({
      label: field.label,
      data: series.map(row => row[field.key])
    })),
    title
  );
}

function buildCompetitorSignals(companies) {
  return (companies || [])
    .map(company => {
      const signals = company.signals || {};
      const news = signals.news || [];
      const hiring = signals.hiring || [];
      const moves = signals.moves || [];
      return {
        ...company,
        signalUpdated: signals.lastUpdated || "",
        news,
        hiring,
        moves,
        total: news.length + hiring.length + moves.length
      };
    })
    .filter(company => company.total > 0);
}

function box(title, body, className = "") {
  return `<section class="box ${esc(className)}"><h3>${esc(title)}</h3>${body}</section>`;
}

function ownershipLensHtml(card) {
  const lens = card.ownershipLens || {};
  const rows = [
    ["Decision question", lens.question],
    ["Trigger", lens.trigger],
    ["Owner move", lens.move]
  ].filter(([, value]) => value);
  if (!rows.length) return "";
  return box("Ownership Decision Lens",
    `<div class="quality-grid compact ownership-grid">` +
    rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("") +
    `</div>`,
    "decision-box"
  );
}

function paragraphList(items) {
  const usable = (items || []).filter(Boolean);
  if (!usable.length) return `<p>Unavailable.</p>`;
  return `<ul>${usable.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function linkList(links) {
  if (!links?.length) return `<p>No source links published for this tile.</p>`;
  return `<div class="detail-links">${links.map(link =>
    `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.url)}</a>`
  ).join("")}</div>`;
}

function notesHtml(notes) {
  return notes?.length ? paragraphList(notes) : `<p>No notes published.</p>`;
}

function sourceHtml(card) {
  const src = sourceFor(card.id);
  const f = freshnessInfo(card.id);
  const updated = f.updated
    ? fmt(f.updated, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "No timestamp";
  return (
    `<div class="quality-grid">` +
    `<div><span>Status</span><strong>${esc(titleCase(f.refreshStatus))}</strong></div>` +
    `<div><span>Source type</span><strong>${esc(titleCase(f.sourceType))}</strong></div>` +
    `<div><span>Source strength</span><strong>${esc(f.strength || "Unknown")}</strong></div>` +
    `<div><span>Freshness</span><strong>${esc(f.freshness || "Unspecified")}</strong></div>` +
    `<div><span>Updated</span><strong>${esc(updated)}</strong></div>` +
    `<div><span>Last attempt</span><strong>${esc(src.lastAttemptedAt ? fmt(src.lastAttemptedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable")}</strong></div>` +
    `<div><span>Last success</span><strong>${esc(src.lastSuccessfulAt ? fmt(src.lastSuccessfulAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable")}</strong></div>` +
    `</div>` +
    `<p>${esc(sourceQuality(card.id))}</p>` +
    (f.sourceType === "proxy"
      ? `<p><strong>What proxy means:</strong> This is a credible directional indicator from a public index. It helps show pressure and trend, but it is not the same as a supplier quote, contract price, or paid spot-market feed.</p>`
      : "") +
    (src.sourceLimitations?.length ? `<p><strong>Limitations:</strong></p>${paragraphList(src.sourceLimitations)}` : "") +
    notesHtml(src.notes)
  );
}

function buildCards() {
  const unemployment = state.data.unemployment || {};
  const uSeries = unemployment.series || [];
  const uLast = latest(uSeries);
  const uPrev = previous(uSeries);
  const unemploymentDelta = uLast.sacramento != null && uPrev.sacramento != null
    ? Number(uLast.sacramento) - Number(uPrev.sacramento)
    : null;
  const unemploymentRisk = unemploymentDelta != null && unemploymentDelta > 0.2 ? "medium" : "low";

  const fed = state.data.fed || {};
  const fSeries = fed.series || [];
  const fLast = latest(fSeries);
  const fPrev = previous(fSeries);
  const fedDelta = fLast.value != null && fPrev.value != null ? Number(fLast.value) - Number(fPrev.value) : null;

  const stocks = state.data.stocks || {};
  const sLast = stocks.latest || {};
  const sSeries = stocks.series || [];
  const vixRisk = Number(sLast.vix) >= 30 ? "high" : Number(sLast.vix) >= 20 ? "medium" : "low";

  const disasters = state.data.disasters || {};
  const disasterEvents = disasters.events || [];
  const severeEvents = disasterEvents.filter(event => /severe|extreme|high/i.test(event.severity || ""));
  const disasterRisk = severeEvents.length >= 4 || disasterEvents.length >= 8
    ? "high"
    : severeEvents.length >= 1 || disasterEvents.length >= 3 ? "medium" : "low";

  const labor = state.data.labor || {};
  const laborActions = labor.actions || [];
  const laborRisk = laborActions.length >= 4 ? "high" : laborActions.length >= 2 ? "medium" : "low";

  const pulp = state.data.pulp || {};
  const pSeries = pulp.series || [];
  const pLast = latest(pSeries);
  const pPrev = previous(pSeries);
  const pulpDelta = pLast.value != null && pPrev.value != null ? Number(pLast.value) - Number(pPrev.value) : null;
  const pulpTon = pulp.currentDeltaTon != null ? Number(pulp.currentDeltaTon) : null;
  const pulpProxyDelta = pulp.currentDeltaIndex != null ? Number(pulp.currentDeltaIndex) : pulpDelta;
  const pulpAction = pulp.marketAction || null;
  const pulpActionAmount = pulpAction?.amount != null ? Number(pulpAction.amount) : null;
  const pulpRisk = Math.abs(pulpActionAmount || 0) >= 40 || Math.abs(pulpTon || 0) >= 40 || Math.abs(pulpProxyDelta || 0) >= 1 ? "medium" : "low";

  const resin = state.data.resin || {};
  const rSeries = resin.series || [];
  const rLast = latest(rSeries);
  const rPrev = previous(rSeries);
  const resinDelta = rLast.value != null && rPrev.value != null ? Number(rLast.value) - Number(rPrev.value) : null;
  const resinAction = resin.marketAction || null;
  const resinActionAmount = resinAction?.amount != null ? Number(resinAction.amount) : null;
  const resinRisk = Math.abs(resinActionAmount || 0) >= 0.05 || Math.abs(resinDelta || 0) >= 1 ? "medium" : "low";

  const gas = state.data.gasCurrent || {};
  const gasHistory = state.data.gasHistory || {};
  const sacHistory = gas.sacramentoHistory || [];
  const caHistory = gasHistory.series || [];
  const gasGeo = "Sacramento";
  const gasHeadlineRegular = gas.sacramentoRegular;
  const gasHeadlineDiesel = gas.sacramentoDiesel;
  const sacGasDelta = percentChange(gas.sacramentoRegular, gas.sacramentoWeekAgoRegular);
  const sacDieselDelta = percentChange(gas.sacramentoDiesel, gas.sacramentoWeekAgoDiesel);
  const caGasDelta = percentChange(gas.currentRegular, gas.weekAgoRegular);
  const caDieselDelta = percentChange(gas.currentDiesel, gas.weekAgoDiesel);
  const eiaCaGasDelta = percentChange(gas.eiaCaliforniaRegular, gas.eiaCaliforniaWeekAgoRegular);
  const eiaCaDieselDelta = percentChange(gas.eiaCaliforniaDiesel, gas.eiaCaliforniaWeekAgoDiesel);
  const maxFuelMove = Math.max(
    Math.abs(sacGasDelta || 0),
    Math.abs(sacDieselDelta || 0),
    Math.abs(caGasDelta || 0),
    Math.abs(caDieselDelta || 0)
  );
  const gasRisk = maxFuelMove >= 5 ? "high" : maxFuelMove >= 2 ? "medium" : "low";
  const fuelChartRows = sacHistory.length ? sacHistory : caHistory;
  const fuelChartGeo = sacHistory.length ? "Sacramento" : "California";
  const fuelChart = fuelChartRows.length
    ? buildLineChartFromSeries(fuelChartRows, [
        { key: "regular", label: `${fuelChartGeo} gas` },
        { key: "diesel", label: `${fuelChartGeo} diesel` }
      ], "Fuel price trend")
    : null;

  const competitors = state.data.competitors || {};
  const competitorCompanies = competitors.companies || [];
  const competitorSignals = buildCompetitorSignals(competitorCompanies);
  const competitorSignalCount = competitorSignals.reduce((sum, row) => sum + row.total, 0);
  const competitorHiringCount = competitorSignals.reduce((sum, row) => sum + row.hiring.length, 0);
  const competitorMovesCount = competitorSignals.reduce((sum, row) => sum + row.moves.length, 0);
  const competitorNewsCount = competitorSignals.reduce((sum, row) => sum + row.news.length, 0);
  const competitorRisk = competitorSignalCount >= 6 ? "high" : competitorSignalCount >= 3 ? "medium" : "low";

  const news = state.data.news || {};
  const stories = news.stories || [];
  const mediumImpactStories = stories.filter(story => /medium|high/i.test(story.impact || ""));

  state.cards = [
    {
      id: "unemployment",
      title: "Unemployment Rate",
      risk: unemploymentRisk,
      value: uLast.sacramento != null ? pct(uLast.sacramento) : "Unavailable",
      secondary: `CA ${pct(uLast.california)} | US ${pct(uLast.us)}`,
      subtext: `Sacramento ${trendWord(unemploymentDelta, 0.05)} ${signedNum(unemploymentDelta, 1)} pts vs prior period`,
      freshness: unemployment.freshness || "Monthly",
      executiveRead: `Sacramento unemployment is ${pct(uLast.sacramento)} for ${uLast.date || "the latest period"}, versus California at ${pct(uLast.california)} and the U.S. at ${pct(uLast.us)}.`,
      recommendedAction: unemploymentRisk === "medium"
        ? "Review staffing plans and customer-demand assumptions; a local labor softening signal can pressure discretionary packaging demand."
        : "Keep hiring and customer demand assumptions steady; no immediate labor-market escalation is visible in the published data.",
      ownershipLens: {
        question: "Is local demand softening enough to change staffing, credit, or sales focus?",
        trigger: "Escalate if Sacramento unemployment rises more than 0.2 pts month over month or moves above California.",
        move: "Ask sales leaders which customer segments are slowing orders before changing capacity assumptions."
      },
      history: `The latest month moved ${signedNum(unemploymentDelta, 1)} percentage points versus the prior published Sacramento reading.`,
      why: "Regional labor conditions influence production activity, local customer health, and the pressure customers may feel on purchasing decisions.",
      use: "Use this as a demand-temperature signal when reviewing pipeline quality, credit exposure, and staffing plans for local accounts.",
      chart: buildLineChartFromSeries(uSeries, [
        { key: "sacramento", label: "Sacramento" },
        { key: "california", label: "California" },
        { key: "us", label: "U.S." }
      ], "Unemployment trend"),
      links: unemployment.sourceLinks || []
    },
    {
      id: "fed",
      title: "Federal Funds Rate",
      risk: Number(fLast.value) >= 5 ? "medium" : "low",
      value: fLast.value != null ? pct(fLast.value, 2) : "Unavailable",
      secondary: fedDelta === 0 ? "Stable vs prior point" : `${signedNum(fedDelta, 2)} pts vs prior point`,
      subtext: "Borrowing-cost and macro-demand backdrop",
      freshness: fed.freshness || "Daily",
      executiveRead: `The effective federal funds rate is ${pct(fLast.value, 2)} on ${fLast.date || "the latest published day"}.`,
      recommendedAction: Number(fLast.value) >= 5
        ? "Keep margin discipline tight on longer quotes and financing-sensitive accounts."
        : "Use rates as context, but do not over-weight this tile unless customer financing or inventory behavior changes.",
      ownershipLens: {
        question: "Should quote validity, credit terms, or inventory bets tighten because capital is expensive?",
        trigger: "Escalate when fed funds are at or above 5% or when direction changes after a long pause.",
        move: "Review long-dated quotes and payment exposure for customers carrying inventory or financing growth."
      },
      history: fedDelta === 0 ? "The latest published point is unchanged from the prior observation." : `The latest point changed ${signedNum(fedDelta, 2)} percentage points.`,
      why: "Rates shape borrowing conditions, capital spending, inventory behavior, and confidence among packaging buyers.",
      use: "Use this tile to frame pricing patience, large-account terms, and demand risk in rate-sensitive verticals.",
      chart: buildLineChartFromSeries(fSeries, [{ key: "value", label: "Fed funds" }], "Fed funds trend"),
      links: fed.sourceLinks || []
    },
    {
      id: "stocks",
      title: "Markets & VIX",
      risk: vixRisk,
      value: `S&P ${sLast.sp500 != null ? num(sLast.sp500, 0) : "Unavailable"}`,
      secondary: `Dow ${sLast.dow != null ? num(sLast.dow, 0) : "Unavailable"} | VIX ${sLast.vix != null ? num(sLast.vix, 1) : "Unavailable"}`,
      subtext: vixRisk === "high" ? "High market volatility" : vixRisk === "medium" ? "Elevated volatility" : "Stable volatility backdrop",
      freshness: stocks.freshness || "Daily",
      executiveRead: `Market context shows S&P ${num(sLast.sp500, 0)}, Dow ${num(sLast.dow, 0)}, and VIX ${num(sLast.vix, 1)}.`,
      recommendedAction: vixRisk === "high"
        ? "Flag customer demand and payment-risk conversations; high VIX often coincides with cautious purchasing behavior."
        : "Treat market tone as supporting context only; no direct operational action is required from this tile alone.",
      ownershipLens: {
        question: "Is broader market stress likely to slow customer buying or increase payment risk?",
        trigger: "Escalate if VIX moves above 20, and treat 30+ as a management-review signal.",
        move: "Pressure-test pipeline, receivables, and large customer timing assumptions in the next sales review."
      },
      history: stocks.whatChanged || "No market history is published in the current JSON, so this tile is a point-in-time sentiment read.",
      why: "Markets and volatility are not direct packaging inputs, but they help explain management confidence and buyer caution.",
      use: "Use this as an executive context tile when discussing pipeline risk, quote timing, and large customer sentiment.",
      chart: buildLineChartFromSeries(sSeries, [{ key: "vix", label: "VIX" }], "Market volatility trend"),
      links: stocks.sourceLinks || []
    },
    {
      id: "disasters",
      title: "Natural Disasters",
      risk: disasterRisk,
      value: String(disasterEvents.length),
      secondary: severeEvents.length ? `${severeEvents.length} severe event(s)` : "No severe events flagged",
      subtext: "Freight, utility, supplier, and West Coast corridor watch",
      freshness: disasters.freshness || "Live mirror",
      executiveRead: `${disasterEvents.length} active or recent relevant event(s) are published; ${severeEvents.length} are marked severe/high.`,
      recommendedAction: severeEvents.length
        ? "Check affected freight corridors, supplier lead times, and customers near the severe-event regions before promising tight delivery windows."
        : "Keep normal logistics assumptions, while monitoring the event list for any California corridor escalation.",
      ownershipLens: {
        question: "Could an event interrupt inbound material, outbound delivery, utilities, or customer receiving?",
        trigger: "Escalate any severe/high event touching California, West Coast ports, major freight lanes, or key suppliers.",
        move: "Have operations confirm routes, lead times, and backup suppliers before making expedited commitments."
      },
      history: disasters.whatChanged || "This event-card tile reflects the latest mirrored alerts rather than a long historical series.",
      why: "Natural disasters matter when they interrupt ports, highways, utilities, supplier operations, or customer receiving capacity.",
      use: "Use this panel in daily ops review before committing expedited deliveries or supplier-dependent timelines.",
      extraHtml: box("Event Watch", disasterEvents.length
        ? `<div class="event-list">${disasterEvents.map(event =>
            `<div class="event-row"><strong>${esc(event.severity || "Unknown")}</strong><span>${esc(event.type || "Event")}</span><em>${esc(event.region || "Region unavailable")}</em></div>`
          ).join("")}</div>`
        : `<p>No active published events.</p>`),
      links: disasters.sourceLinks || []
    },
    {
      id: "labor",
      title: "Strikes & Labor",
      risk: laborRisk,
      value: String(laborActions.length),
      secondary: laborActions[0]?.headline || "No active items",
      subtext: "Port, warehouse, manufacturing, and freight relevance",
      freshness: labor.freshness || "Daily",
      executiveRead: `${laborActions.length} labor action(s) are published in the current set.`,
      recommendedAction: laborActions.length
        ? "Review whether any action touches logistics, manufacturing, ports, or key customers before locking delivery commitments."
        : "No immediate labor escalation is published; continue routine monitoring.",
      ownershipLens: {
        question: "Could a labor action constrain a customer, supplier, warehouse, port, or freight lane?",
        trigger: "Escalate when two or more relevant actions are active or any action touches logistics/manufacturing.",
        move: "Assign one owner to verify customer/supplier exposure and update delivery promises if risk is real."
      },
      history: labor.whatChanged || "The current labor dataset is starter/manual until additional live refresh jobs are added.",
      why: "Labor actions can disrupt freight, customer production schedules, and the reliability of warehouse or manufacturing operations.",
      use: "Use this to prompt supplier/customer check-ins when logistics or manufacturing sectors appear in the action list.",
      extraHtml: box("Published Actions", laborActions.length
        ? `<div class="event-list">${laborActions.map(action =>
            `<div class="event-row"><strong>${esc(action.sector || "Sector unavailable")}</strong><span>${esc(action.headline || "Labor action")}</span><em>${esc(action.region || "Region unavailable")}</em></div>`
          ).join("")}</div>`
        : `<p>No active published labor items.</p>`),
      links: labor.sourceLinks || []
    },
    {
      id: "pulp",
      title: "Pulp & Paperboard Market",
      risk: pulpRisk,
      value: pulpAction ? marketActionLabel(pulpAction) : pLast.value != null ? `Index ${num(pLast.value, 1)}` : pulpTon == null ? "Unavailable" : pulpTon > 0 ? `Up ${money(Math.abs(pulpTon))}/ton` : pulpTon < 0 ? `Down ${money(Math.abs(pulpTon))}/ton` : "Flat",
      secondary: `Proxy ${signedNum(pulpProxyDelta, 1)} pts | ${pLast.date || "latest"}`,
      subtext: pulpAction ? `${pulpAction.market || "Market action"} effective ${pulpAction.effectiveDate || "latest period"}` : `${trendWord(pulpProxyDelta, 0.05)} ${signedNum(pulpProxyDelta, 1)} index pts vs prior period`,
      freshness: pulp.freshness || "Monthly",
      executiveRead: pulpAction
        ? `${marketActionLabel(pulpAction)} is the current operating signal. The FRED pulp/paper proxy is ${num(pLast.value, 1)}, up ${signedNum(pulpProxyDelta, 1)} index points.`
        : `The pulp proxy index is ${num(pLast.value, 1)}. This is a directional proxy, not a paid spot pulp price.`,
      recommendedAction: pulpRisk === "medium"
        ? "Prepare account teams for firmer corrugated pricing conversations and protect margin on longer-running quotes."
        : "Keep pulp in the pricing watchlist, but no immediate corrugated escalation is indicated by the proxy.",
      ownershipLens: {
        question: "Do containerboard economics require quote, margin, or supplier-cost action now?",
        trigger: "Escalate any recognized containerboard move of $40/ST or more, especially +$50/ST mill/sheet-plant actions.",
        move: "Shorten quote windows, review corrugated-heavy accounts, and pre-brief sales on pass-through timing."
      },
      history: pulpAction ? `${pulpAction.source || "Market reporting"}: ${pulpAction.notes?.[0] || marketActionLabel(pulpAction)} FRED proxy moved ${signedNum(pulpProxyDelta, 1)} points versus the prior month.` : `The proxy index moved ${signedNum(pulpProxyDelta, 1)} points versus the prior published period.`,
      why: "Containerboard pricing is the number mills and sheet plants use to drive corrugated sheet and box pricing; the proxy index is only supporting context.",
      use: "Use this tile when deciding whether to hold quote expirations short, recheck supplier costs, or pre-brief sales on containerboard-driven price movement.",
      chart: buildLineChartFromSeries(pSeries, [{ key: "value", label: "Pulp proxy" }], "Pulp proxy trend"),
      links: pulp.sourceLinks || []
    },
    {
      id: "resin",
      title: "Resin Market",
      risk: resinRisk,
      value: resinAction ? marketActionLabel(resinAction) : rLast.value != null ? num(rLast.value, 1) : "Unavailable",
      secondary: `Proxy ${signedNum(resinDelta, 1)} pts | ${rLast.date || "latest"}`,
      subtext: resinAction ? `${resinAction.market || "Market action"} effective ${resinAction.effectiveDate || "latest period"}` : "Stretch film, poly, and resin-linked packaging signal",
      freshness: resin.freshness || "Monthly",
      executiveRead: resinAction
        ? `${marketActionLabel(resinAction)} is the current operating signal for resin-linked packaging. The FRED resin proxy is ${num(rLast.value, 1)}, ${trendWord(resinDelta, 0.05)} ${signedNum(resinDelta, 1)} index points.`
        : `The resin proxy is ${num(rLast.value, 1)} for ${rLast.date || "the latest period"}.`,
      recommendedAction: resinRisk === "medium"
        ? "Recheck resin-linked product margins and flag accounts with large stretch-film, poly, or other resin-linked exposure."
        : "Maintain normal resin-linked pricing posture while watching for a sharper monthly move.",
      ownershipLens: {
        question: "Should resin-linked SKUs be repriced, protected, or used as a margin opportunity?",
        trigger: "Escalate resin moves of $0.05/lb or more, up or down, because film/poly costs can reset quickly.",
        move: "Review stretch film, poly bag, and resin-linked SKU margins against supplier replacement cost."
      },
      history: resinAction ? `${resinAction.source || "Market reporting"}: ${resinAction.notes?.[0] || marketActionLabel(resinAction)} FRED proxy moved ${signedNum(resinDelta, 1)} points versus the prior month.` : `The resin proxy moved ${signedNum(resinDelta, 1)} points versus the prior published period.`,
      why: "Resin market moves flow into stretch film, poly bags, strapping, and other plastic packaging costs faster than broad PPI proxy data.",
      use: "Use this as a monthly prompt to review resin-sensitive SKU margins, supplier replacement costs, and customer price-change timing.",
      chart: buildLineChartFromSeries(rSeries, [{ key: "value", label: "Resin proxy" }], "Resin proxy trend"),
      links: resin.sourceLinks || []
    },
    {
      id: "gas",
      title: "Gas & Diesel Prices",
      risk: gasRisk,
      value: gasHeadlineRegular == null ? "Sac Gas Unavailable" : `${gasGeo} Gas ${money(gasHeadlineRegular)}`,
      secondary: `${gasGeo} Diesel ${money(gasHeadlineDiesel)}`,
      subtext: gasHeadlineRegular == null
        ? "Sacramento metro data unavailable from AAA; California values are shown in the flyout only."
        : `Sac weekly move: gas ${signedPct(sacGasDelta)} | diesel ${signedPct(sacDieselDelta)}`,
      freshness: gas.freshness || "Daily + Monthly",
      executiveRead: `Sacramento gas is ${money(gasHeadlineRegular)} and Sacramento diesel is ${money(gasHeadlineDiesel)}. California averages and EIA weekly values are retained below as backup/context only.`,
      recommendedAction: gasRisk === "high"
        ? "Review delivery surcharges, route efficiency, and expedited freight exposure immediately."
        : gasRisk === "medium"
          ? "Watch freight-sensitive quotes and consider shorter validity windows if the move persists."
          : "Fuel is not flashing an immediate escalation signal, but keep it visible for logistics and delivery pricing.",
      ownershipLens: {
        question: "Do delivery, freight, or surcharge assumptions need to change this week?",
        trigger: "Escalate if Sacramento gas or diesel moves 2%+ weekly; treat 5%+ as immediate surcharge review.",
        move: "Review route density, expedited freight exposure, and delivery-charge assumptions before quoting."
      },
      history: `Sacramento gas moved ${signedPct(sacGasDelta)} versus a week ago; Sacramento diesel moved ${signedPct(sacDieselDelta)}. California gas moved ${signedPct(caGasDelta)} and California diesel moved ${signedPct(caDieselDelta)}. EIA weekly California backup moved gas ${signedPct(eiaCaGasDelta)} and diesel ${signedPct(eiaCaDieselDelta)} when available.`,
      why: "Fuel is one of the clearest operating-cost indicators for local delivery, inbound supplier freight, and customer logistics sensitivity.",
      use: "Use this tile for delivery-charge review, route planning, and deciding when freight-sensitive quotes need updated assumptions.",
      chart: fuelChart,
      extraHtml: box("Sacramento Primary / CA Backup",
        `<div class="quality-grid compact">` +
        `<div><span>Sac gas</span><strong>${esc(money(gas.sacramentoRegular))}</strong></div>` +
        `<div><span>Sac diesel</span><strong>${esc(money(gas.sacramentoDiesel))}</strong></div>` +
        `<div><span>AAA CA gas</span><strong>${esc(money(gas.currentRegular))}</strong></div>` +
        `<div><span>AAA CA diesel</span><strong>${esc(money(gas.currentDiesel))}</strong></div>` +
        `<div><span>EIA CA gas</span><strong>${esc(money(gas.eiaCaliforniaRegular))}</strong></div>` +
        `<div><span>EIA CA diesel</span><strong>${esc(money(gas.eiaCaliforniaDiesel))}</strong></div>` +
        `</div><p class="fineprint">EIA is statewide weekly backup/context. Sacramento AAA values remain the dashboard's primary gas and diesel signal.</p>`),
      links: gas.sourceLinks || []
    },
    {
      id: "competitors",
      title: "Competitor Watch",
      risk: competitorRisk,
      value: String(competitorSignalCount),
      secondary: competitorSignalCount ? `${competitorHiringCount} hiring | ${competitorMovesCount} moves | ${competitorNewsCount} news` : `${competitorCompanies.length} tracked companies`,
      subtext: "Expansion, hiring, pricing, and account-defense cues",
      freshness: competitors.freshness || "Manual + published JSON",
      executiveRead: `${competitorSignalCount} competitive signal(s) are published across ${competitorCompanies.length} tracked companies.`,
      recommendedAction: competitorSignalCount
        ? "Assign owner follow-up for high-priority accounts touched by competitor hiring, regional moves, or relevant news."
        : "Keep the tracked list current; no active competitive moves are published right now.",
      ownershipLens: {
        question: "Which accounts or territories need defensive action because competitors are hiring, expanding, or signaling focus?",
        trigger: "Escalate any direct local hiring, expansion, acquisition, or pricing signal from a high-priority competitor.",
        move: "Assign account owners to verify overlap, prepare talk tracks, and update competitor watchlist relevance."
      },
      history: competitors.whatChanged || "Competitor tracking is curated in the published JSON and should be treated as manual intelligence.",
      why: "Competitor hiring and operating moves can indicate price pressure, territory focus, service investments, or account-targeting risk.",
      use: "Use this tile for sales meeting prep, account-defense planning, and deciding where to refresh competitive positioning.",
      extraHtml:
        box("Competitive Signals", competitorSignals.length
          ? `<div class="signal-list">${competitorSignals.map(row =>
              `<article class="signal-card">` +
              `<h4>${esc(row.name)}</h4>` +
              `<p>${esc(row.city || "Region unavailable")} | ${esc(row.category || "Category unavailable")} | ${esc(row.priority || "Priority unavailable")}</p>` +
              `<p>${esc(row.notes || "No notes published.")}</p>` +
                (row.news.length ? `<strong>News</strong><ul>${row.news.map(item => signalItemHtml(item, row.googleNews || row.search || row.website || "")).join("")}</ul>` : "") +
                (row.hiring.length ? `<strong>Hiring</strong><ul>${row.hiring.map(item => signalItemHtml(item)).join("")}</ul>` : "") +
                (row.moves.length ? `<strong>Moves</strong><ul>${row.moves.map(item => signalItemHtml(item, row.googleNews || row.search || row.website || "")).join("")}</ul>` : "") +
              `<div class="mini-links">` +
              (row.website ? `<a href="${esc(row.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : "") +
              (row.googleNews ? `<a href="${esc(row.googleNews)}" target="_blank" rel="noopener noreferrer">News</a>` : "") +
              (row.search ? `<a href="${esc(row.search)}" target="_blank" rel="noopener noreferrer">Search</a>` : "") +
              `</div>` +
              `</article>`
            ).join("")}</div>`
          : `<p>No active competitive signals are published.</p>`) +
        box("Tracked Companies", competitorCompanies.length
          ? `<div class="tracked-grid">${competitorCompanies.map(company =>
              `<div><strong>${esc(company.name)}</strong><span>${esc(company.city || "Region unavailable")} | ${esc(company.category || "Category unavailable")}</span></div>`
            ).join("")}</div>`
          : `<p>No tracked competitors are published.</p>`),
      links: []
    },
    {
      id: "news",
      title: "Industry News",
      risk: mediumImpactStories.length >= 4 ? "medium" : "low",
      value: String(stories.length),
      secondary: stories[0]?.title || "No published stories",
      subtext: "Packaging, materials, and market narrative cues",
      freshness: news.freshness || "Daily",
      executiveRead: `${stories.length} packaging story/stories are published; ${mediumImpactStories.length} are marked medium or higher impact.`,
      recommendedAction: stories.length
        ? "Use the story list to brief sales on pricing narratives, sustainability themes, and customer talking points."
        : "No action until current packaging news is published.",
      ownershipLens: {
        question: "Is there a market narrative sales should use with customers this week?",
        trigger: "Escalate medium/high impact stories tied to pricing, sustainability, capacity, freight, or regulation.",
        move: "Turn the top story into a customer-ready talking point and decide whether it changes quote posture."
      },
      history: news.whatChanged || "The news dataset is starter/manual in this phase unless the published JSON is refreshed upstream.",
      why: "Industry news helps translate material-price moves and market changes into customer-ready talking points.",
      use: "Use this panel before customer meetings to connect market context to practical packaging recommendations.",
      extraHtml: box("Published Stories", stories.length
        ? `<div class="event-list">${stories.map(story =>
            `<div class="event-row"><strong>${esc(story.impact || "Impact unavailable")}</strong><span>${esc(story.title || "Untitled story")}</span><em>${esc(story.source || "Source unavailable")}</em></div>`
          ).join("")}</div>`
        : `<p>No published stories.</p>`),
      links: news.sourceLinks || []
    }
  ];
}

function renderOverview() {
  const high = state.cards.filter(card => card.risk === "high").length;
  const medium = state.cards.filter(card => card.risk === "medium").length;
  const sourceIssues = state.cards.filter(card => ["failed", "stale"].includes(freshnessInfo(card.id).qualityGroup)).length;
  const errors = state.loadErrors.length;
  const leadingRisk = high ? `${high} high-risk tile(s)` : medium ? `${medium} medium-risk tile(s)` : "No high-risk tiles";

  els.overviewSummary.textContent =
    `${leadingRisk}. ${sourceIssues} automated source issue(s). This is ${APP_VERSION}: a data reliability release with source-type and refresh-status labels.`;

  els.overviewStats.innerHTML =
    `<div><span>High</span><strong>${high}</strong></div>` +
    `<div><span>Medium</span><strong>${medium}</strong></div>` +
    `<div><span>Source issues</span><strong>${sourceIssues}</strong></div>` +
    `<div><span>Load errors</span><strong>${errors}</strong></div>`;
}

function renderTiles() {
  buildCards();
  renderOverview();

  const loadErrors = state.loadErrors || [];
  const qualityRows = state.cards.map(card => ({ title: card.title, f: freshnessInfo(card.id) }));
  const failedTiles = qualityRows.filter(item => item.f.qualityGroup === "failed");
  const staleTiles = qualityRows.filter(item => item.f.qualityGroup === "stale");
  const manualTiles = qualityRows.filter(item => item.f.qualityGroup === "manual");
  const limitedTiles = qualityRows.filter(item => item.f.qualityGroup === "limited");

  let banner = "";
  if (loadErrors.length || failedTiles.length || staleTiles.length || manualTiles.length || limitedTiles.length) {
    const parts = [];
    if (loadErrors.length) {
      parts.push(`<strong>${loadErrors.length} data file(s) failed:</strong> ${loadErrors.map(e => `${esc(e.key)} (${esc(e.reason)})`).join(", ")}`);
    }
    if (failedTiles.length) {
      parts.push(`<strong>Failed automated refresh:</strong> ${failedTiles.map(s => esc(s.title)).join(", ")}`);
    }
    if (staleTiles.length) {
      parts.push(`<strong>Stale automated data:</strong> ${staleTiles.map(s => `${esc(s.title)}${s.f.updated ? ` (${Math.round(s.f.ageDays)}d old)` : " (no timestamp)"}`).join(", ")}`);
    }
    if (manualTiles.length) {
      parts.push(`<strong>Manual / curated source:</strong> ${manualTiles.map(s => esc(s.title)).join(", ")}`);
    }
    if (limitedTiles.length) {
      parts.push(`<strong>Proxy / source-limited:</strong> ${limitedTiles.map(s => esc(s.title)).join(", ")}`);
    }
    banner = `<div class="data-quality-banner" role="alert">${parts.map(part => `<div>${part}</div>`).join("")}</div>`;
  }

  els.tileGrid.innerHTML = banner + state.cards.map(card => {
    const f = freshnessInfo(card.id);
    const stamp = stampInfo(f.updated);
    return (
      `<button class="tile ${esc(card.risk)}${f.stale ? " stale" : ""}" data-id="${esc(card.id)}">` +
      `<div class="tile-head"><span>${esc(card.title)}</span><em>${esc(riskLabel(card.risk))}</em></div>` +
      `<div class="chips">${chip(card.freshness)}${chip(titleCase(f.sourceType))}${chip(titleCase(f.refreshStatus), f.qualityGroup === "failed" || f.qualityGroup === "stale" ? "warn" : f.qualityGroup === "current" ? "ok" : "limited")}</div>` +
      `<div class="val">${esc(card.value)}</div>` +
      `<div class="sec">${esc(card.secondary || "")}</div>` +
      `<div class="sub">${esc(card.subtext || "")}</div>` +
      `<div class="stamp ${esc(stamp.tone)}">${esc(stamp.text)}</div>` +
      `</button>`
    );
  }).join("");

  Array.from(els.tileGrid.querySelectorAll("[data-id]")).forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

function openDetail(id) {
  const card = state.cards.find(item => item.id === id);
  if (!card) return;

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  const chartHtml = card.chart
    ? box("History / Trend", `<p>${esc(card.history)}</p><div class="chart-wrap"><canvas id="detailChart"></canvas></div>`)
    : box("History / Trend", `<p>${esc(card.history || "No published history is available for this tile.")}</p>`);

  els.detailContent.innerHTML =
    `<div class="panel-header">` +
    `<div><div class="eyebrow">Dashboard ${esc(APP_VERSION)}</div><h2 id="detailTitle">${esc(card.title)}</h2></div>` +
    `<div class="risk-pill ${esc(card.risk)}">${esc(riskLabel(card.risk))} risk</div>` +
    `</div>` +
    `<div class="chips detail-chip-row">${chip(card.freshness)}${chip(titleCase(freshnessInfo(card.id).sourceType))}${chip(titleCase(freshnessInfo(card.id).refreshStatus), freshnessInfo(card.id).qualityGroup === "current" ? "ok" : freshnessInfo(card.id).qualityGroup === "failed" || freshnessInfo(card.id).qualityGroup === "stale" ? "warn" : "limited")}</div>` +
    box("Executive Read", `<p>${esc(card.executiveRead)}</p>`, "hero-box") +
    box("Recommended Action", `<p>${esc(card.recommendedAction)}</p>`, "action-box") +
    ownershipLensHtml(card) +
    chartHtml +
    box("Why This Matters", `<p>${esc(card.why)}</p>`) +
    box("How Vision Packaging Can Use This", `<p>${esc(card.use)}</p>`) +
    (card.extraHtml || "") +
    box("Data Quality", sourceHtml(card)) +
    box("Sources", linkList(card.links));

  els.detailDrawer.classList.add("open");
  els.detailDrawer.setAttribute("aria-hidden", "false");

  if (card.chart && window.Chart) {
    const canvas = document.getElementById("detailChart");
    if (canvas) {
      state.chart = new Chart(canvas, {
        type: "line",
        data: {
          labels: card.chart.labels,
          datasets: card.chart.series.map((series, index) => ({
            label: series.label,
            data: series.data,
            tension: 0.35,
            fill: false,
            pointRadius: 2,
            borderWidth: 2,
            borderColor: ["#6ee7f9", "#9f7aea", "#49c989", "#e1b757"][index % 4],
            backgroundColor: ["#6ee7f9", "#9f7aea", "#49c989", "#e1b757"][index % 4]
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#dbeafe" } },
            title: { display: true, text: card.chart.title, color: "#f8fafc" }
          },
          scales: {
            x: { ticks: { color: "#cbd5e1", maxRotation: 0, autoSkip: true }, grid: { color: "rgba(148,163,184,.12)" } },
            y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(148,163,184,.12)" } }
          }
        }
      });
    }
  }
}

function closeDetail() {
  els.detailDrawer.classList.remove("open");
  els.detailDrawer.setAttribute("aria-hidden", "true");
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
}

function tickClock() {
  els.clockDisplay.textContent = fmt(new Date(), {
    hour: "numeric",
    minute: "2-digit"
  });
}

async function refreshAll() {
  setLoading(true);
  try {
    await loadPublishedData();
    els.globalLastUpdated.textContent = fmt(publishedAt(), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    if (els.footerLastChanged) {
      els.footerLastChanged.textContent = fmt(publishedAt(), {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
    renderTiles();
    showToast(`Published data refreshed for ${APP_VERSION}`);
  } catch (error) {
    showToast(`Refresh failed: ${error.message || "unknown error"}`);
  } finally {
    setLoading(false);
  }
}

els.detailOverlay.addEventListener("click", closeDetail);
els.detailCloseButton.addEventListener("click", closeDetail);
els.refreshButton.addEventListener("click", refreshAll);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDetail();
});

tickClock();
setInterval(tickClock, 60000);
refreshAll();
