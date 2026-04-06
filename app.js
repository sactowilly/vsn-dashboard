const cfg = window.DASHBOARD_CONFIG;

const state = {
  data: {},
  cards: [],
  chart: null
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
  statusToast: document.getElementById("statusToast"),
  overviewSummary: document.getElementById("overviewSummary")
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(dateLike, options) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    ...options
  }).format(new Date(dateLike));
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value));
}

function pct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return `${Number(value).toFixed(digits)}%`;
}

function num(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toFixed(digits);
}

function chip(text) {
  return `<span class="chip">${esc(text)}</span>`;
}

function percentChange(current, previous) {
  if (current == null || previous == null || Number(previous) === 0) return null;
  return ((Number(current) - Number(previous)) / Number(previous)) * 100;
}

function riskClass(level) {
  return level || "low";
}

function showToast(message) {
  els.statusToast.textContent = message;
  els.statusToast.className = "toast show";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.statusToast.className = "toast";
  }, 2500);
}

async function loadPublishedData() {
  const entries = Object.entries(cfg.dataFiles);
  const results = await Promise.allSettled(
    entries.map(async ([key, path]) => {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load ${path}`);
      }
      return [key, await res.json()];
    })
  );

  const out = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      const [key, value] = result.value;
      out[key] = value;
    }
  }
  state.data = out;
}

function publishedAt() {
  return state.data.buildMeta?.publishedAt || new Date().toISOString();
}

function buildCompetitorSignals(companies) {
  const rows = [];

  for (const company of companies || []) {
    const signals = company.signals || {};
    const news = signals.news || [];
    const hiring = signals.hiring || [];
    const moves = signals.moves || [];

    if (!news.length && !hiring.length && !moves.length) continue;

    rows.push({
      name: company.name,
      city: company.city,
      category: company.category,
      priority: company.priority,
      notes: company.notes,
      website: company.website,
      googleNews: company.googleNews,
      search: company.search,
      lastUpdated: signals.lastUpdated || company.lastUpdated || "",
      news,
      hiring,
      moves,
      total: news.length + hiring.length + moves.length
    });
  }

  return rows;
}

function buildCards() {
  const unemployment = state.data.unemployment || {};
  const uSeries = unemployment.series || [];
  const uLast = uSeries[uSeries.length - 1] || {};
  const uPrev = uSeries[uSeries.length - 2] || {};

  const fed = state.data.fed || {};
  const fSeries = fed.series || [];
  const fLast = fSeries[fSeries.length - 1] || {};
  const fPrev = fSeries[fSeries.length - 2] || {};

  const stocks = state.data.stocks || {};
  const sLast = stocks.latest || {};

  const gas = state.data.gasCurrent || {};
  const gasHistory = state.data.gasHistory || {};
  const sacHistory = gas.sacramentoHistory || [];
  const caHistory = gasHistory.series || [];

  const disasters = state.data.disasters || {};
  const labor = state.data.labor || {};
  const pulp = state.data.pulp || {};
  const pSeries = pulp.series || [];
  const pLast = pSeries[pSeries.length - 1] || {};
  const resin = state.data.resin || {};
  const rSeries = resin.series || [];
  const rLast = rSeries[rSeries.length - 1] || {};
  const competitors = state.data.competitors || {};
  const news = state.data.news || {};

  const competitorCompanies = competitors.companies || [];
  const competitorSignals = buildCompetitorSignals(competitorCompanies);
  const competitorSignalCount = competitorSignals.reduce((sum, row) => sum + row.total, 0);
  const competitorHiringCount = competitorSignals.reduce((sum, row) => sum + row.hiring.length, 0);
  const competitorMovesCount = competitorSignals.reduce((sum, row) => sum + row.moves.length, 0);
  const competitorNewsCount = competitorSignals.reduce((sum, row) => sum + row.news.length, 0);

  const unemploymentDelta =
    uLast.sacramento != null && uPrev.sacramento != null
      ? uLast.sacramento - uPrev.sacramento
      : 0;

  const fedDelta =
    fLast.value != null && fPrev.value != null
      ? fLast.value - fPrev.value
      : 0;

  const sacGasDelta = percentChange(gas.sacramentoRegular, gas.sacramentoWeekAgoRegular);
  const sacDieselDelta = percentChange(gas.sacramentoDiesel, gas.sacramentoWeekAgoDiesel);
  const caGasDelta = percentChange(gas.currentRegular, gas.weekAgoRegular);
  const caDieselDelta = percentChange(gas.currentDiesel, gas.weekAgoDiesel);

  const maxFuelMove = Math.max(
    Math.abs(sacGasDelta || 0),
    Math.abs(sacDieselDelta || 0),
    Math.abs(caGasDelta || 0),
    Math.abs(caDieselDelta || 0)
  );

  const gasRisk = maxFuelMove >= 5 ? "high" : maxFuelMove >= 2 ? "medium" : "low";
  const vixRisk =
    Number(sLast.vix) >= 30 ? "high" : Number(sLast.vix) >= 20 ? "medium" : "low";

  const pulpTon = pulp.currentDeltaTon != null ? pulp.currentDeltaTon : 40;
  const pulpRisk = Math.abs(pulpTon) >= 40 ? "medium" : "low";

  const arrow = (v) => {
    if (v == null || Number.isNaN(Number(v))) return "•";
    if (Number(v) > 0.15) return "▲";
    if (Number(v) < -0.15) return "▼";
    return "•";
  };

  state.cards = [
    {
      id: "unemployment",
      title: "Unemployment Rate",
      risk: unemploymentDelta > 0.2 ? "medium" : "low",
      freshness: unemployment.freshness || "Monthly",
      value: uLast.sacramento != null ? pct(uLast.sacramento) : "N/A",
      secondary:
        uLast.california != null
          ? `CA ${pct(uLast.california)} • US ${pct(uLast.us)}`
          : "",
      subtext: "Sacramento headline with California and U.S. context",
      summary: `Sacramento unemployment is ${uLast.sacramento != null ? pct(uLast.sacramento) : "N/A"}. California is ${uLast.california != null ? pct(uLast.california) : "N/A"} and the U.S. is ${uLast.us != null ? pct(uLast.us) : "N/A"}.`,
      changed:
        unemploymentDelta === 0
          ? "Using the latest published period versus prior period, Sacramento was unchanged."
          : `Using the latest published period versus prior period, Sacramento moved ${pct(unemploymentDelta)}.`,
      why: "Regional labor conditions influence customer demand, staffing pressure, and local manufacturing activity.",
      links: unemployment.sourceLinks || []
    },
    {
      id: "fed",
      title: "Federal Funds Rate",
      risk: Number(fLast.value) >= 5 ? "medium" : "low",
      freshness: fed.freshness || "Daily",
      value: fLast.value != null ? pct(fLast.value, 2) : "N/A",
      secondary: "",
      subtext: fedDelta === 0 ? "Stable versus prior point" : `${fedDelta > 0 ? "Up" : "Down"} versus prior point`,
      summary: `The effective federal funds rate is ${fLast.value != null ? pct(fLast.value, 2) : "N/A"}.`,
      changed:
        fedDelta === 0
          ? "Over the past 72 hours, the published rate held steady."
          : `Over the past 72 hours, the published rate changed ${pct(fedDelta, 2)}.`,
      why: "Rates shape borrowing conditions and macro demand sentiment.",
      links: fed.sourceLinks || []
    },
    {
      id: "stocks",
      title: "Markets & VIX",
      risk: vixRisk,
      freshness: stocks.freshness || "Daily",
      value: `S&P ${sLast.sp500 != null ? num(sLast.sp500, 0) : "N/A"}`,
      secondary: `Dow ${sLast.dow != null ? num(sLast.dow, 0) : "N/A"} • VIX ${sLast.vix != null ? num(sLast.vix, 1) : "N/A"}`,
      subtext: "Macro sentiment and volatility context",
      summary: `The S&P is ${sLast.sp500 != null ? num(sLast.sp500, 0) : "N/A"}, the Dow is ${sLast.dow != null ? num(sLast.dow, 0) : "N/A"}, and the VIX is ${sLast.vix != null ? num(sLast.vix, 1) : "N/A"}.`,
      changed: "Use a 72-hour window here. The key story is market tone and VIX movement.",
      why: "This is supporting context, not a direct pricing input.",
      links: stocks.sourceLinks || []
    },
    {
      id: "disasters",
      title: "Natural Disasters",
      risk:
        (disasters.events || []).length >= 4
          ? "high"
          : (disasters.events || []).length >= 2
            ? "medium"
            : "low",
      freshness: disasters.freshness || "Live mirror",
      value: String((disasters.events || []).length),
      secondary:
        disasters.events && disasters.events[0]
          ? disasters.events[0].type
          : "No active published events",
      subtext: "California and West Coast freight corridor scope",
      summary: `There are ${(disasters.events || []).length} active or recent relevant published events.`,
      changed: "Use a 72-hour window for current disruptions affecting freight corridors, utilities, or supplier operations.",
      why: "Disruption events matter when they threaten ports, highways, suppliers, utilities, or regional freight movement.",
      links: disasters.sourceLinks || []
    },
    {
      id: "labor",
      title: "Strikes & Labor",
      risk: "low",
      freshness: labor.freshness || "Daily",
      value: String((labor.actions || []).length),
      secondary:
        labor.actions && labor.actions[0]
          ? labor.actions[0].headline
          : "No active items",
      subtext: "Port, warehouse, manufacturing, and freight relevance",
      summary: `This panel includes ${(labor.actions || []).length} published items.`,
      changed: "Use a 72-hour view for active labor-related items.",
      why: "Labor actions matter when they affect ports, production, transport, or regional labor stability.",
      links: labor.sourceLinks || []
    },
    {
      id: "pulp",
      title: "Pulp Market",
      risk: pulpRisk,
      freshness: pulp.freshness || "Monthly",
      value:
        pulpTon > 0
          ? `Up ${money(Math.abs(pulpTon))}/ton`
          : pulpTon < 0
            ? `Down ${money(Math.abs(pulpTon))}/ton`
            : "Flat",
      secondary: pLast.value != null ? `Index ${num(pLast.value, 1)}` : "",
      subtext: "Proxy index for pulp/corrugated market direction",
      summary: `Pulp is ${pulpTon > 0 ? "up" : pulpTon < 0 ? "down" : "flat"} ${pulpTon !== 0 ? money(Math.abs(pulpTon)) + "/ton" : ""}.`,
      changed: "Use latest published period versus prior period. If pulp is up, Pratt and International Paper have more room to support firmer local pricing.",
      why: "A meaningful upward move can support firmer local corrugated pricing from major suppliers.",
      links: pulp.sourceLinks || []
    },
    {
      id: "resin",
      title: "Resin Market",
      risk: "low",
      freshness: resin.freshness || "Monthly",
      value: rLast.value != null ? num(rLast.value, 1) : "N/A",
      secondary: "Proxy direction",
      subtext: "Proxy index for plastics/resins direction",
      summary: `Resin proxy is ${rLast.value != null ? num(rLast.value, 1) : "N/A"}.`,
      changed: "Use latest published period versus prior period for this monthly panel.",
      why: "This matters for stretch film, poly, and resin-linked packaging conversations.",
      links: resin.sourceLinks || []
    },
    {
      id: "gas",
      title: "Gas & Diesel Prices",
      risk: gasRisk,
      freshness: gas.freshness || "Daily + Monthly",
      value: `Sac Gas ${money(gas.sacramentoRegular)}`,
      secondary: `Sac Diesel ${money(gas.sacramentoDiesel)}`,
      subtext: `Sac Gas ${arrow(sacGasDelta)} ${pct(sacGasDelta)} • Sac Diesel ${arrow(sacDieselDelta)} ${pct(sacDieselDelta)} • CA Gas ${arrow(caGasDelta)} ${pct(caGasDelta)} • CA Diesel ${arrow(caDieselDelta)} ${pct(caDieselDelta)}`,
      summary: `Sacramento gas is ${money(gas.sacramentoRegular)} and Sacramento diesel is ${money(gas.sacramentoDiesel)}. California gas is ${money(gas.currentRegular)} and California diesel is ${money(gas.currentDiesel)}.`,
      changed: `Use a 72-hour and week-ago comparison window. Sacramento gas changed ${pct(sacGasDelta)}, Sacramento diesel changed ${pct(sacDieselDelta)}, California gas changed ${pct(caGasDelta)}, and California diesel changed ${pct(caDieselDelta)}.`,
      why: "This is one of the clearest operating-cost pressure indicators for local driving, supplier freight, and customer logistics sensitivity.",
      links: gas.sourceLinks || [],
      chartLabels: (sacHistory.length ? sacHistory : caHistory).map(x => x.date),
      chartSeries: sacHistory.length
        ? [
            { label: "Sacramento Gas", data: sacHistory.map(x => x.regular) },
            { label: "Sacramento Diesel", data: sacHistory.map(x => x.diesel) }
          ]
        : [
            { label: "California Gas", data: caHistory.map(x => x.regular) },
            { label: "California Diesel", data: caHistory.map(x => x.diesel) }
          ],
      extraHtml:
        `<div class="box"><h3>Sacramento vs California</h3><ul>` +
        `<li>Sacramento gas: ${esc(money(gas.sacramentoRegular))}</li>` +
        `<li>Sacramento diesel: ${esc(money(gas.sacramentoDiesel))}</li>` +
        `<li>California gas: ${esc(money(gas.currentRegular))}</li>` +
        `<li>California diesel: ${esc(money(gas.currentDiesel))}</li>` +
        `</ul></div>`
    },
    {
      id: "competitors",
      title: "Competitor Watch",
      risk: competitorSignalCount >= 6 ? "high" : competitorSignalCount >= 3 ? "medium" : "low",
      freshness: competitors.freshness || "Manual + published JSON",
      value: String(competitorSignalCount),
      secondary:
        competitorSignalCount
          ? `${competitorHiringCount} hiring • ${competitorMovesCount} moves • ${competitorNewsCount} news`
          : `${competitorCompanies.length} tracked companies`,
      subtext: competitorSignalCount
        ? "Competitive signals detected across tracked companies"
        : "Add or remove competitor profiles from the published list",
      summary: competitorSignalCount
        ? `${competitorSignalCount} competitive signals detected across tracked companies. ${competitorHiringCount} hiring signals, ${competitorMovesCount} move signals, and ${competitorNewsCount} news signals are currently in the published set.`
        : `No new competitive signals detected. ${competitorCompanies.length} competitors are currently tracked.`,
      changed: competitorSignalCount
        ? "This panel is now surfacing actionable competitive signals, including hiring, operational moves, and relevant news."
        : "This panel updates when you edit data/competitors.json and publish new JSON.",
      why: "This tile is meant to surface actionable intelligence on competitor expansion, hiring, and market moves in and around Sacramento.",
      links: [],
      extraHtml:
        `<div class="box"><h3>Competitor Watch Controls</h3>` +
        `<p>Add or remove companies by editing <code>data/competitors.json</code> in GitHub, then publish and press reload.</p>` +
        `<p><a href="./data/competitors.json" target="_blank" rel="noopener noreferrer">View competitor file</a></p>` +
        `</div>` +
        `<div class="box"><h3>Tracked Competitors</h3><ul>` +
        (competitorCompanies.map(c =>
          `<li><strong>${esc(c.name)}</strong> • ${esc(c.city)}${c.category ? ` • ${esc(c.category)}` : ""}${c.priority ? ` • ${esc(c.priority)}` : ""}</li>`
        ).join("")) +
        `</ul></div>` +
        (
          competitorSignals.length
            ? `<div class="box"><h3>Competitive Signals</h3>` +
              competitorSignals.map(row =>
                `<div style="margin-bottom:16px;">` +
                `<p><strong>${esc(row.name)}</strong>${row.city ? ` • ${esc(row.city)}` : ""}${row.category ? ` • ${esc(row.category)}` : ""}${row.priority ? ` • ${esc(row.priority)}` : ""}</p>` +
                (row.lastUpdated ? `<p>Signal updated: ${esc(row.lastUpdated)}</p>` : "") +
                (row.notes ? `<p>Notes: ${esc(row.notes)}</p>` : "") +
                (row.news.length ? `<p><strong>News</strong></p><ul>${row.news.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : "") +
                (row.hiring.length ? `<p><strong>Hiring</strong></p><ul>${row.hiring.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : "") +
                (row.moves.length ? `<p><strong>Moves</strong></p><ul>${row.moves.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : "") +
                (
                  row.website || row.googleNews || row.search
                    ? `<p>` +
                      (row.website ? `<a href="${esc(row.website)}" target="_blank" rel="noopener noreferrer">Website</a> ` : "") +
                      (row.googleNews ? `<a href="${esc(row.googleNews)}" target="_blank" rel="noopener noreferrer">Google News</a> ` : "") +
                      (row.search ? `<a href="${esc(row.search)}" target="_blank" rel="noopener noreferrer">Search</a>` : "") +
                      `</p>`
                    : ""
                ) +
                `</div>`
              ).join("") +
              `</div>`
            : ""
        )
    },
    {
      id: "news",
      title: "Industry News",
      risk: "low",
      freshness: news.freshness || "Daily",
      value: String((news.stories || []).length),
      secondary:
        news.stories && news.stories[0]
          ? news.stories[0].title
          : "No published stories",
      subtext: "Packaging-focused now; broader supply chain can come later",
      summary: `This panel includes ${(news.stories || []).length} published news items.`,
      changed: "Use a 72-hour lens for this daily news panel.",
      why: "This tile is strongest when it focuses on packaging materials, containerboard, and competitor-relevant developments.",
      links: news.sourceLinks || []
    }
  ];
}

function renderTiles() {
  buildCards();

  els.tileGrid.innerHTML = state.cards.map(card => {
    return (
      `<button class="tile ${riskClass(card.risk)}" data-id="${esc(card.id)}">` +
      `<div class="tile-title">${esc(card.title)}</div>` +
      `<div class="chips">${chip("Risk: " + card.risk)}${chip(card.freshness)}</div>` +
      `<div class="val">${esc(card.value)}</div>` +
      (card.secondary ? `<div class="sec">${esc(card.secondary)}</div>` : "") +
      `<div class="sub">${esc(card.subtext)}</div>` +
      `<div class="stamp">Published ${esc(fmt(publishedAt(), { year:"numeric", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }))}</div>` +
      `</button>`
    );
  }).join("");

  Array.from(els.tileGrid.querySelectorAll("[data-id]")).forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

function openDetail(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  const linksHtml = (card.links || []).length
    ? `<div class="box"><h3>Source Links</h3>` +
      (card.links.map(link => `<p><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}</a></p>`).join("")) +
      `</div>`
    : "";

  const chartHtml = id === "gas"
    ? `<div class="box"><h3>Historical View</h3><div class="chart-wrap"><canvas id="detailChart"></canvas></div></div>`
    : "";

  els.detailContent.innerHTML =
    `<h2>${esc(card.title)}</h2>` +
    `<div class="chips">${chip("Risk: " + card.risk)}${chip(card.freshness)}</div>` +
    `<div class="box"><h3>Executive Summary</h3><p>${esc(card.summary)}</p><p>Published data timestamp: ${esc(fmt(publishedAt(), { year:"numeric", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }))}</p></div>` +
    `<div class="box"><h3>What Changed</h3><p>${esc(card.changed)}</p></div>` +
    `<div class="box"><h3>Why This Matters</h3><p>${esc(card.why)}</p></div>` +
    (card.extraHtml || "") +
    chartHtml +
    linksHtml;

  els.detailDrawer.classList.add("open");
  els.detailDrawer.setAttribute("aria-hidden", "false");

  if (id === "gas" && window.Chart) {
    const canvas = document.getElementById("detailChart");
    if (canvas) {
      if (state.chart) state.chart.destroy();
      state.chart = new Chart(canvas, {
        type: "line",
        data: {
          labels: card.chartLabels || [],
          datasets: (card.chartSeries || []).map(ds => ({
            ...ds,
            tension: 0.3,
            fill: false,
            pointRadius: 2,
            borderWidth: 2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#fff" } },
            title: { display: true, text: "Fuel trend", color: "#fff" }
          },
          scales: {
            x: { ticks: { color: "#f2f6fc" }, grid: { color: "rgba(255,255,255,.08)" } },
            y: { ticks: { color: "#f2f6fc" }, grid: { color: "rgba(255,255,255,.08)" } }
          }
        }
      });
    }
  }
}

function closeDetail() {
  els.detailDrawer.classList.remove("open");
  els.detailDrawer.setAttribute("aria-hidden", "true");
}

function tickClock() {
  els.clockDisplay.textContent = fmt(new Date(), {
    hour: "numeric",
    minute: "2-digit"
  });
}

async function refreshAll() {
  els.refreshButton.disabled = true;
  els.refreshButton.textContent = "Reloading...";

  await loadPublishedData();

  els.globalLastUpdated.textContent = fmt(publishedAt(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  els.overviewSummary.textContent =
    "A high-level view of factors affecting the Sacramento packaging market.";

  renderTiles();

  els.refreshButton.disabled = false;
  els.refreshButton.textContent = "Reload Latest Published Data";

  showToast(
    "Published data reloaded from " +
      fmt(publishedAt(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
  );
}

els.detailOverlay.addEventListener("click", closeDetail);
els.detailCloseButton.addEventListener("click", closeDetail);
els.refreshButton.addEventListener("click", refreshAll);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeDetail();
});

tickClock();
setInterval(tickClock, 60000);
refreshAll();
