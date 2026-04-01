window.DASHBOARD_CONFIG = {
  appTitle: 'Vision Packaging Dashboard',
  timezone: 'America/Los_Angeles',
  tileDefinitions: [
    { id: 'unemployment', title: 'Unemployment Rate', type: 'metric', refreshMode: 'published-json' },
    { id: 'fed', title: 'Federal Funds Rate', type: 'metric', refreshMode: 'published-json' },
    { id: 'stocks', title: 'Markets & VIX', type: 'metric', refreshMode: 'published-json' },
    { id: 'disasters', title: 'Natural Disasters', type: 'intelligence', refreshMode: 'published-json' },
    { id: 'labor', title: 'Strikes & Labor', type: 'intelligence', refreshMode: 'published-json' },
    { id: 'pulp', title: 'Pulp Market', type: 'proxy', refreshMode: 'published-json' },
    { id: 'resin', title: 'Resin Market', type: 'proxy', refreshMode: 'published-json' },
    { id: 'gas', title: 'Gas & Diesel Prices', type: 'metric', refreshMode: 'published-json' },
    { id: 'competitors', title: 'Competitor Watch', type: 'intelligence', refreshMode: 'published-json' },
    { id: 'news', title: 'Industry News', type: 'intelligence', refreshMode: 'published-json' }
  ],
  riskThresholds: {
    vix: { medium: 20, high: 30 },
    gasWeeklyDeltaPct: { medium: 2, high: 5 },
    dieselWeeklyDeltaPct: { medium: 2, high: 5 },
    laborActionCount: { medium: 2, high: 4 },
    disasterEventCount: { medium: 2, high: 4 }
  },
  dataFiles: {
    buildMeta: './data/build-meta.json',
    unemployment: './data/unemployment.json',
    fed: './data/fed.json',
    stocks: './data/stocks.json',
    gasCurrent: './data/gas-current.json',
    gasHistory: './data/gas-history.json',
    disasters: './data/disasters.json',
    labor: './data/labor.json',
    pulp: './data/pulp.json',
    resin: './data/resin.json',
    competitors: './data/competitors.json',
    news: './data/news.json',
    newsSources: './data/news-sources.json'
  }
};
