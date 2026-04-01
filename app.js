const config = window.DASHBOARD_CONFIG;

const appState = {
  tiles: {},
  charts: {},
  selectedTileId: null,
  globalLastUpdated: null,
  refreshInProgress: false,
  datasets: {}
};

const els = {
  tileGrid: document.getElementById('tileGrid'),
  detailDrawer: document.getElementById('detailDrawer'),
  detailOverlay: document.getElementById('detailOverlay'),
  detailContent: document.getElementById('detailContent'),
  detailCloseButton: document.getElementById('detailCloseButton'),
  refreshButton: document.getElementById('refreshButton'),
  clockDisplay: document.getElementById('clockDisplay'),
  globalLastUpdated: document.getElementById('globalLastUpdated'),
  statusToast: document.getElementById('statusToast'),
  overviewSummary: document.getElementById('overviewSummary')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(digits);
}

function formatCurrency(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Number(value).toFixed(digits)}%`;
}

function formatDateTimeMinute(dateLike = new Date()) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatTimeMinute(dateLike = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateLike));
}

function showStatus(message, variant = 'success') {
  els.statusToast.textContent = message;
  els.statusToast.className = `status-toast status-toast--${variant} is-visible`;
  window.clearTimeout(showStatus.timeout);
  showStatus.timeout = window.setTimeout(() => {
    els.statusToast.className = 'status-toast';
  }, 2500);
}

function riskClass(riskLevel) {
  return `tile-card--${riskLevel || 'low'}`;
}

function buildLabelChip(text) {
  return `<span class="label-chip">${escapeHtml(text)}</span>`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function baseTile(id) {
  const definition = config.tileDefinitions.find((tile) => tile.id === id);
  return {
    id,
    title: definition?.title || id,
    type: definition?.type || 'metric',
    refreshMode: definition?.refreshMode || 'published-json',
    sourceStrength: 'Medium',
    freshness: 'Published JSON',
    businessImpact: 'Medium',
    riskLevel: 'low',
    summaryValue: 'Pending',
    summarySecondaryValue: '',
    summarySubtext: 'Awaiting published data',
    takeaway: 'Published dataset not loaded yet.',
    trendLabel: '',
    lastUpdated: null,
    stale: false,
    partial: false,
    error: null,
    sourceLinks: [],
    chartConfig: null,
    detailData: {}
  };
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

async function loadPublishedData() {
  const entries = Object.entries(config.dataFiles);
  const results = await Promise.allSettled(entries.map(([key, path]) => loadJson(path)));
  const loaded = {};
  results.forEach((result, index) => {
    const [key] = entries[index];
    loaded[key] = result.status === 'fulfilled' ? result.value : null;
  });
  appState.datasets = loaded;
}

function makeLineChartConfig(title, labels, datasets) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((dataset) => ({
        ...dataset,
        tension: 0.3,
        fill: false,
        pointRadius: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e8eef7' } },
        title: { display: Boolean(title), text: title, color: '#e8eef7' }
      },
      scales: {
        x: { ticks: { color: '#a4b3c8' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: '#a4b3c8' }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  };
}

function getBuildTimestamp() {
  return appState.datasets.buildMeta?.publishedAt || new Date().toISOString();
}

function loadUnemploymentTile() {
  const tile = baseTile('unemployment');
  const data = appState.datasets.unemployment;
  const series = data?.series || [];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const delta = latest && previous ? latest.sacramento - previous.sacramento : 0;
  tile.sourceStrength = data?.sourceStrength || 'High';
  tile.freshness = data?.freshness || 'Monthly';
  tile.businessImpact = 'High';
  tile.riskLevel = delta > 0.2 ? 'medium' : 'low';
  tile.summaryValue = latest ? formatPercent(latest.sacramento, 1) : 'N/A';
  tile.summarySecondaryValue = latest ? `CA ${formatPercent(latest.california, 1)} • US ${formatPercent(latest.us, 1)}` : '';
  tile.summarySubtext = 'Sacramento headline with California and U.S. context';
  tile.takeaway = 'Regional labor conditions influence customer demand, staffing pressure, and local manufacturing activity.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.chartConfig = makeLineChartConfig('Unemployment trend', series.map((row) => row.date), [
    { label: 'Sacramento', data: series.map((row) => row.sacramento) },
    { label: 'California', data: series.map((row) => row.california) },
    { label: 'U.S.', data: series.map((row) => row.us) }
  ]);
  tile.detailData = {
    executiveSummary: `Sacramento unemployment is ${tile.summaryValue} in the published dataset.`,
    whatChanged: delta === 0 ? 'No month-over-month change in the published dataset.' : `Moved ${formatPercent(delta, 1)} versus prior month.`,
    plainEnglish: 'Higher unemployment can signal softer business activity, while very low unemployment can signal tighter labor conditions.',
    visionImpact: 'For Vision, this helps frame the local operating environment around demand, hiring, and customer production stability.',
    watchList: ['Monitor Sacramento trend monthly', 'Compare with California', 'Watch for sharp reversals in regional data'],
    notes: data?.notes || []
  };
  return tile;
}

function loadFedTile() {
  const tile = baseTile('fed');
  const data = appState.datasets.fed;
  const series = data?.series || [];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const delta = latest && previous ? latest.value - previous.value : 0;
  tile.sourceStrength = data?.sourceStrength || 'High';
  tile.freshness = data?.freshness || 'Daily';
  tile.businessImpact = 'Medium';
  tile.riskLevel = latest?.value >= 5 ? 'medium' : 'low';
  tile.summaryValue = latest ? formatPercent(latest.value, 2) : 'N/A';
  tile.summarySubtext = delta === 0 ? 'Stable versus prior point' : `${delta > 0 ? 'Up' : 'Down'} versus prior point`;
  tile.takeaway = 'Rates shape borrowing conditions and macro demand sentiment for capital-sensitive customers.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.chartConfig = makeLineChartConfig('Federal funds rate', series.map((row) => row.date), [
    { label: 'Effective Rate', data: series.map((row) => row.value) }
  ]);
  tile.detailData = {
    executiveSummary: `The published series shows a current effective federal funds rate of ${tile.summaryValue}.`,
    whatChanged: delta === 0 ? 'No change in the published series.' : `Changed ${formatPercent(delta, 2)} from the prior point.`,
    plainEnglish: 'The Fed funds rate influences the cost of money in the economy. Higher rates usually cool borrowing and spending.',
    visionImpact: 'This matters to customer demand, inventory decisions, and the general tone of business spending.',
    watchList: ['Watch next Fed move', 'Track whether rates stay elevated', 'Pair with customer demand signals'],
    notes: data?.notes || []
  };
  return tile;
}

function loadStockTile() {
  const tile = baseTile('stocks');
  const data = appState.datasets.stocks;
  const latest = data?.latest || {};
  tile.sourceStrength = data?.sourceStrength || 'Medium';
  tile.freshness = data?.freshness || 'Daily';
  tile.businessImpact = 'Low';
  tile.riskLevel = latest.vix >= config.riskThresholds.vix.high ? 'high' : latest.vix >= config.riskThresholds.vix.medium ? 'medium' : 'low';
  tile.summaryValue = `S&P ${formatNumber(latest.sp500, 0)}`;
  tile.summarySecondaryValue = `Dow ${formatNumber(latest.dow, 0)} • VIX ${formatNumber(latest.vix, 1)}`;
  tile.summarySubtext = 'Macro sentiment and volatility context';
  tile.takeaway = 'This tile is supporting context, with VIX included as the main market-risk signal.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.detailData = {
    executiveSummary: 'Published market values are loaded from local JSON files for GitHub Pages compatibility.',
    whatChanged: data?.whatChanged || 'Published market dataset reloaded.',
    plainEnglish: 'S&P and Dow show broad market direction. VIX helps gauge fear and volatility in the market.',
    visionImpact: 'This is indirect context, not a direct pricing input, but it can help frame overall business sentiment.',
    watchList: ['Add richer chart later', 'Keep VIX threshold logic', 'Avoid over-weighting market moves operationally'],
    notes: data?.notes || []
  };
  return tile;
}

function loadGasTile() {
  const tile = baseTile('gas');
  const current = appState.datasets.gasCurrent || {};
  const history = appState.datasets.gasHistory?.series || [];
  const deltaPct = current.currentRegular && current.weekAgoRegular ? ((current.currentRegular - current.weekAgoRegular) / current.weekAgoRegular) * 100 : 0;
  const dieselDeltaPct = current.currentDiesel && current.weekAgoDiesel ? ((current.currentDiesel - current.weekAgoDiesel) / current.weekAgoDiesel) * 100 : 0;
  const maxDelta = Math.max(deltaPct, dieselDeltaPct);
  tile.sourceStrength = current.sourceStrength || 'Medium';
  tile.freshness = current.freshness || 'Daily + Weekly';
  tile.businessImpact = 'High';
  tile.riskLevel = maxDelta >= config.riskThresholds.gasWeeklyDeltaPct.high ? 'high' : maxDelta >= config.riskThresholds.gasWeeklyDeltaPct.medium ? 'medium' : 'low';
  tile.summaryValue = `Reg ${formatCurrency(current.currentRegular)}`;
  tile.summarySecondaryValue = `Diesel ${formatCurrency(current.currentDiesel)}`;
  tile.summarySubtext = current.sacramentoRegular ? `Sacramento regular ${formatCurrency(current.sacramentoRegular)}` : 'California state average focus';
  tile.takeaway = 'Fuel and diesel prices affect freight cost pressure, supplier economics, and customer operations.';
  tile.lastUpdated = current.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = current.sourceLinks || [];
  tile.chartConfig = makeLineChartConfig('Fuel trend', history.map((row) => row.date), [
    { label: 'Regular', data: history.map((row) => row.regular) },
    { label: 'Diesel', data: history.map((row) => row.diesel) }
  ]);
  tile.detailData = {
    executiveSummary: `California regular is ${formatCurrency(current.currentRegular)} and diesel is ${formatCurrency(current.currentDiesel)} in the published dataset.`,
    whatChanged: `Regular moved ${formatPercent(deltaPct, 1)} and diesel moved ${formatPercent(dieselDeltaPct, 1)} versus a week ago.`,
    plainEnglish: 'Gas affects general driving and service costs. Diesel matters more directly for trucking and freight-intensive operations.',
    visionImpact: 'This is one of the clearest operating-cost pressure indicators for distribution, supplier freight, and customer logistics sensitivity.',
    watchList: ['Update AAA snapshot via workflow', 'Keep EIA history current', 'Keep diesel visible in both tile and detail'],
    notes: current.notes || []
  };
  return tile;
}

function loadDisasterTile() {
  const tile = baseTile('disasters');
  const data = appState.datasets.disasters;
  const events = data?.events || [];
  tile.sourceStrength = data?.sourceStrength || 'High';
  tile.freshness = data?.freshness || 'Live mirror';
  tile.businessImpact = 'High';
  tile.riskLevel = events.length >= config.riskThresholds.disasterEventCount.high ? 'high' : events.length >= config.riskThresholds.disasterEventCount.medium ? 'medium' : 'low';
  tile.summaryValue = `${events.length}`;
  tile.summarySecondaryValue = events[0]?.type || 'No active published events';
  tile.summarySubtext = 'California and West Coast freight corridor scope';
  tile.takeaway = 'Disruption events matter when they threaten ports, highways, suppliers, utilities, or regional freight movement.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.detailData = {
    executiveSummary: `The published dataset includes ${events.length} active or recent relevant events.`,
    whatChanged: data?.whatChanged || 'Published disaster dataset reloaded.',
    plainEnglish: 'This tile tracks disruption risk from earthquakes, severe weather, wildfire, flooding, and similar events.',
    visionImpact: 'Even when Vision is not directly affected, corridor and supplier disruption can create inbound or outbound friction.',
    watchList: events.length ? events.map((event) => `${event.type}: ${event.region}`) : ['No published events'],
    notes: data?.notes || []
  };
  return tile;
}

function loadLaborTile() {
  const tile = baseTile('labor');
  const data = appState.datasets.labor;
  const actions = data?.actions || [];
  tile.sourceStrength = data?.sourceStrength || 'High';
  tile.freshness = data?.freshness || 'Daily';
  tile.businessImpact = 'High';
  tile.riskLevel = actions.length >= config.riskThresholds.laborActionCount.high ? 'high' : actions.length >= config.riskThresholds.laborActionCount.medium ? 'medium' : 'low';
  tile.summaryValue = `${actions.length}`;
  tile.summarySecondaryValue = actions[0]?.headline || 'No active published actions';
  tile.summarySubtext = 'Port, warehouse, manufacturing, and freight relevance';
  tile.takeaway = 'Labor actions matter when they affect ports, production, transport, or regional labor stability.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.detailData = {
    executiveSummary: `The published labor dataset includes ${actions.length} relevant actions.`,
    whatChanged: data?.whatChanged || 'Published labor dataset reloaded.',
    plainEnglish: 'Strikes and labor actions can disrupt flow of goods, labor availability, and contract stability.',
    visionImpact: 'This matters most when freight nodes, ports, large manufacturers, or major supply-chain labor groups are involved.',
    watchList: actions.length ? actions.map((action) => action.headline) : ['No published labor actions'],
    notes: data?.notes || []
  };
  return tile;
}

function loadPulpTile() {
  const tile = baseTile('pulp');
  const data = appState.datasets.pulp;
  const series = data?.series || [];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const delta = latest && previous ? latest.value - previous.value : 0;
  tile.sourceStrength = data?.sourceStrength || 'Medium';
  tile.freshness = data?.freshness || 'Monthly';
  tile.businessImpact = 'High';
  tile.riskLevel = delta > 1 ? 'medium' : 'low';
  tile.summaryValue = latest ? formatNumber(latest.value, 1) : 'N/A';
  tile.summarySecondaryValue = delta === 0 ? 'Flat' : delta > 0 ? 'Up' : 'Down';
  tile.summarySubtext = 'Proxy index for pulp/corrugated market direction';
  tile.takeaway = 'This tile is intentionally labeled as a market proxy, not direct benchmark settlement pricing.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.chartConfig = makeLineChartConfig('Pulp proxy', series.map((row) => row.date), [
    { label: 'Pulp Proxy', data: series.map((row) => row.value) }
  ]);
  tile.detailData = {
    executiveSummary: `Published pulp proxy is ${formatNumber(latest?.value, 1)}.`,
    whatChanged: delta === 0 ? 'No change in the latest published point.' : `Moved ${formatNumber(delta, 1)} points from the prior point.`,
    plainEnglish: 'This is a directional signal to help track the market environment around paper and corrugated inputs.',
    visionImpact: 'Corrugated and related paper cost movement can pressure margins and customer pricing conversations.',
    watchList: ['Keep proxy label visible', 'Update commentary links', 'Optionally add a public PPI-based workflow'],
    notes: data?.notes || []
  };
  return tile;
}

function loadResinTile() {
  const tile = baseTile('resin');
  const data = appState.datasets.resin;
  const series = data?.series || [];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const delta = latest && previous ? latest.value - previous.value : 0;
  tile.sourceStrength = data?.sourceStrength || 'Medium';
  tile.freshness = data?.freshness || 'Monthly';
  tile.businessImpact = 'High';
  tile.riskLevel = delta > 1 ? 'medium' : 'low';
  tile.summaryValue = latest ? formatNumber(latest.value, 1) : 'N/A';
  tile.summarySecondaryValue = delta === 0 ? 'Flat' : delta > 0 ? 'Up' : 'Down';
  tile.summarySubtext = 'Proxy index for plastics/resins direction';
  tile.takeaway = 'This proxy matters for stretch film, poly, and related material exposure.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.chartConfig = makeLineChartConfig('Resin proxy', series.map((row) => row.date), [
    { label: 'Resin Proxy', data: series.map((row) => row.value) }
  ]);
  tile.detailData = {
    executiveSummary: `Published resin proxy is ${formatNumber(latest?.value, 1)}.`,
    whatChanged: delta === 0 ? 'No change in the latest published point.' : `Moved ${formatNumber(delta, 1)} points from the prior point.`,
    plainEnglish: 'This is a directional proxy for resin market pressure, not direct contract benchmark pricing.',
    visionImpact: 'This matters where Vision is exposed to poly, stretch, and resin-linked materials.',
    watchList: ['Keep proxy label visible', 'Update commentary links', 'Optionally add a public PPI-based workflow'],
    notes: data?.notes || []
  };
  return tile;
}

function loadCompetitorTile() {
  const tile = baseTile('competitors');
  const data = appState.datasets.competitors;
  const competitors = data?.companies || [];
  tile.sourceStrength = data?.sourceStrength || 'Medium';
  tile.freshness = data?.freshness || 'Manual + published JSON';
  tile.businessImpact = 'Medium';
  tile.riskLevel = 'low';
  tile.summaryValue = `${competitors.length}`;
  tile.summarySecondaryValue = 'Tracked competitors';
  tile.summarySubtext = 'Sacramento, Stockton/Modesto, and Bay overlap';
  tile.takeaway = 'This tile uses a curated competitor list with outbound news and search links.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = competitors.slice(0, 6).map((c) => ({ label: `${c.name} site`, url: c.website }));
  tile.detailData = {
    executiveSummary: `The published competitor dataset currently tracks ${competitors.length} profiles.`,
    whatChanged: data?.whatChanged || 'Published competitor dataset reloaded.',
    plainEnglish: 'This is a curated watchlist, not a scraped live competitor feed.',
    visionImpact: 'The goal is faster situational awareness around overlap, specialties, and current news visibility.',
    watchList: competitors.map((competitor) => `${competitor.name} • ${competitor.city}`),
    notes: data?.notes || []
  };
  tile.detailData.competitors = competitors;
  return tile;
}

function loadIndustryNewsTile() {
  const tile = baseTile('news');
  const data = appState.datasets.news;
  const stories = data?.stories || [];
  tile.sourceStrength = data?.sourceStrength || 'Medium';
  tile.freshness = data?.freshness || 'Daily';
  tile.businessImpact = 'Medium';
  tile.riskLevel = 'low';
  tile.summaryValue = `${stories.length}`;
  tile.summarySecondaryValue = stories[0]?.title || 'No published stories';
  tile.summarySubtext = 'Packaging-focused now; broader supply chain can come later';
  tile.takeaway = 'This published tile is set up for packaging news first, with broader supply-chain expansion deferred.';
  tile.lastUpdated = data?.lastUpdated || getBuildTimestamp();
  tile.sourceLinks = data?.sourceLinks || [];
  tile.detailData = {
    executiveSummary: `The published industry-news dataset currently includes ${stories.length} packaging-focused stories.`,
    whatChanged: data?.whatChanged || 'Published industry-news dataset reloaded.',
    plainEnglish: 'Industry news is strongest when it shows what changed, why it matters, and how it might affect Vision.',
    visionImpact: 'For phase one, focus on packaging materials, manufacturers, containerboard, innovation, and competitor-relevant developments.',
    watchList: stories.map((story) => story.title),
    notes: data?.notes || []
  };
  tile.detailData.stories = stories;
  return tile;
}

function renderTiles() {
  els.tileGrid.innerHTML = config.tileDefinitions.map((definition) => {
    const tile = appState.tiles[definition.id] || baseTile(definition.id);
    const staleClass = tile.stale ? ' tile-card--stale' : '';
    return `
      <button class="tile-card ${riskClass(tile.riskLevel)}${staleClass}" type="button" data-tile-id="${escapeHtml(tile.id)}">
        <div class="tile-card__top">
          <h3 class="tile-card__title">${escapeHtml(tile.title)}</h3>
        </div>
        <div class="tile-card__labels">
          ${buildLabelChip(`Risk: ${capitalize(tile.riskLevel)}`)}
          ${buildLabelChip(tile.freshness)}
          ${tile.stale ? buildLabelChip('Stale') : ''}
        </div>
        <div class="tile-card__value">${escapeHtml(tile.summaryValue)}</div>
        ${tile.summarySecondaryValue ? `<div class="tile-card__secondary">${escapeHtml(tile.summarySecondaryValue)}</div>` : ''}
        <div class="tile-card__subtext">${escapeHtml(tile.summarySubtext)}</div>
        <div class="tile-card__footer">
          <div class="tile-card__timestamp">${tile.lastUpdated ? `Updated ${escapeHtml(formatDateTimeMinute(tile.lastUpdated))}` : 'Awaiting update'}</div>
        </div>
      </button>
    `;
  }).join('');

  [...els.tileGrid.querySelectorAll('[data-tile-id]')].forEach((button) => {
    button.addEventListener('click', () => openDetail(button.dataset.tileId));
  });
}

function renderChart(canvasId, configObject) {
  if (appState.charts[canvasId]) {
    appState.charts[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  appState.charts[canvasId] = new Chart(ctx, configObject);
}

function renderNotes(notes) {
  if (!notes || !notes.length) return '';
  return `
    <section class="detail-section">
      <h3>Published Data Notes</h3>
      <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
    </section>
  `;
}

function renderExtraDetail(tile) {
  if (tile.id === 'competitors') {
    const competitors = tile.detailData.competitors || [];
    if (!competitors.length) return '';
    return `
      <section class="detail-section">
        <h3>Competitor Profiles</h3>
        <ul>
          ${competitors.map((c) => `
            <li>
              <strong>${escapeHtml(c.name)}</strong> • ${escapeHtml(c.city)} • ${escapeHtml((c.specialties || []).join(', '))}
            </li>
          `).join('')}
        </ul>
      </section>
    `;
  }

  if (tile.id === 'news') {
    const stories = tile.detailData.stories || [];
    if (!stories.length) return '';
    return `
      <section class="detail-section">
        <h3>Published Stories</h3>
        <ul>
          ${stories.map((story) => `
            <li>
              <strong>${escapeHtml(story.title)}</strong> • ${escapeHtml(story.source)} • ${escapeHtml(story.impact)}
            </li>
          `).join('')}
        </ul>
      </section>
    `;
  }

  return '';
}

function renderDetail(tile) {
  const linksHtml = tile.sourceLinks?.length
    ? tile.sourceLinks
        .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`)
        .join('')
    : '<div class="empty-state">No source links yet.</div>';

  els.detailContent.innerHTML = `
    <div class="detail-headline">
      <div>
        <h2 id="detailTitle" class="detail-title">${escapeHtml(tile.title)}</h2>
        <div class="detail-meta">
          ${buildLabelChip(`Risk: ${capitalize(tile.riskLevel)}`)}
          ${buildLabelChip(`Source Strength: ${tile.sourceStrength}`)}
          ${buildLabelChip(`Freshness: ${tile.freshness}`)}
          ${buildLabelChip(`Business Impact: ${tile.businessImpact}`)}
          ${tile.stale ? buildLabelChip('Stale') : ''}
          ${tile.partial ? buildLabelChip('Partial') : ''}
        </div>
      </div>
      <div>
        <div class="detail-value">${escapeHtml(tile.summaryValue)}</div>
        ${tile.summarySecondaryValue ? `<div class="tile-card__secondary">${escapeHtml(tile.summarySecondaryValue)}</div>` : ''}
        <div class="tile-card__timestamp">${tile.lastUpdated ? `Updated ${escapeHtml(formatDateTimeMinute(tile.lastUpdated))}` : 'Awaiting update'}</div>
      </div>
    </div>

    <section class="detail-summary">
      <h3>Executive Summary</h3>
      <p>${escapeHtml(tile.detailData?.executiveSummary || tile.takeaway)}</p>
      <p class="detail-note">This GitHub Pages build reads published JSON files from the repository. It does not fetch third-party sources directly at runtime.</p>
    </section>

    <section class="detail-takeaway">
      <h3>What Vision Should Watch This Week</h3>
      <p>${escapeHtml(tile.takeaway)}</p>
    </section>

    ${tile.chartConfig ? `
      <section class="detail-chart-wrap">
        <h3>Historical View</h3>
        <div style="height:320px; position:relative;">
          <canvas id="detailChartCanvas"></canvas>
        </div>
      </section>
    ` : ''}

    <section class="detail-section">
      <h3>What Changed</h3>
      <p>${escapeHtml(tile.detailData?.whatChanged || 'No change summary available.')}</p>
    </section>

    <section class="detail-section">
      <h3>What This Means in Plain English</h3>
      <p>${escapeHtml(tile.detailData?.plainEnglish || 'Plain-language explanation not available.')}</p>
    </section>

    <section class="detail-section">
      <h3>Why This Matters to Sacramento Packaging</h3>
      <p>${escapeHtml(tile.detailData?.visionImpact || 'Vision-specific impact note not available.')}</p>
    </section>

    <section class="detail-section">
      <h3>Watch List</h3>
      <ul>
        ${(tile.detailData?.watchList || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>

    ${renderExtraDetail(tile)}
    ${renderNotes(tile.detailData?.notes)}

    <section class="detail-section">
      <h3>Source Links</h3>
      <div class="detail-links">${linksHtml}</div>
    </section>

    ${tile.error ? `
      <section class="detail-section">
        <h3>Fallback Note</h3>
        <p>${escapeHtml(tile.error)}</p>
      </section>
    ` : ''}
  `;

  if (tile.chartConfig) renderChart('detailChartCanvas', tile.chartConfig);
}

function openDetail(tileId) {
  const tile = appState.tiles[tileId];
  if (!tile) return;
  appState.selectedTileId = tileId;
  renderDetail(tile);
  els.detailDrawer.classList.add('is-open');
  els.detailDrawer.setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  els.detailDrawer.classList.remove('is-open');
  els.detailDrawer.setAttribute('aria-hidden', 'true');
  appState.selectedTileId = null;
}

async function refreshAllTiles() {
  if (appState.refreshInProgress) return;
  appState.refreshInProgress = true;
  els.refreshButton.disabled = true;
  els.refreshButton.textContent = 'Reloading...';
  showStatus('Reloading latest published JSON...', 'warning');

  await loadPublishedData();

  const loaderMap = {
    unemployment: loadUnemploymentTile,
    fed: loadFedTile,
    stocks: loadStockTile,
    disasters: loadDisasterTile,
    labor: loadLaborTile,
    pulp: loadPulpTile,
    resin: loadResinTile,
    gas: loadGasTile,
    competitors: loadCompetitorTile,
    news: loadIndustryNewsTile
  };

  config.tileDefinitions.forEach((definition) => {
    try {
      appState.tiles[definition.id] = loaderMap[definition.id]();
    } catch (error) {
      appState.tiles[definition.id] = { ...baseTile(definition.id), stale: true, error: error.message || 'Tile refresh failed.' };
    }
  });

  appState.globalLastUpdated = getBuildTimestamp();
  els.globalLastUpdated.textContent = formatDateTimeMinute(appState.globalLastUpdated);
  renderTiles();

  if (appState.selectedTileId && appState.tiles[appState.selectedTileId]) {
    renderDetail(appState.tiles[appState.selectedTileId]);
  }

  const dataNotes = appState.datasets.buildMeta?.summary || 'Published GitHub Pages datasets reloaded.';
  els.overviewSummary.textContent = dataNotes;

  appState.refreshInProgress = false;
  els.refreshButton.disabled = false;
  els.refreshButton.textContent = 'Reload Latest Published Data';
  showStatus('✓ Published data reloaded', 'success');
}

function startClock() {
  const updateClock = () => {
    els.clockDisplay.textContent = formatTimeMinute(new Date());
  };
  updateClock();
  window.setInterval(updateClock, 60000);
}

function bindEvents() {
  els.refreshButton.addEventListener('click', refreshAllTiles);
  els.detailOverlay.addEventListener('click', closeDetail);
  els.detailCloseButton.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.detailDrawer.classList.contains('is-open')) {
      closeDetail();
    }
  });
}

async function bootstrap() {
  try {
    startClock();
    bindEvents();
    await refreshAllTiles();
  } catch (error) {
    console.error(error);
    showStatus('Dashboard failed to initialize', 'error');
    els.overviewSummary.textContent = 'Initialization failed. Check the console and JSON files.';
  }
}

bootstrap();
