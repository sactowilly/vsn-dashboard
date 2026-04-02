window.DASHBOARD_CONFIG={
  timezone:'America/Los_Angeles',
  tileDefinitions:[
    {id:'unemployment',title:'Unemployment Rate'},
    {id:'fed',title:'Federal Funds Rate'},
    {id:'stocks',title:'Markets & VIX'},
    {id:'disasters',title:'Natural Disasters'},
    {id:'labor',title:'Strikes & Labor'},
    {id:'pulp',title:'Pulp Market'},
    {id:'resin',title:'Resin Market'},
    {id:'gas',title:'Gas & Diesel Prices'},
    {id:'competitors',title:'Competitor Watch'},
    {id:'news',title:'Industry News'}
  ],
  riskThresholds:{
    vix:{medium:20,high:30},
    gasWeeklyDeltaPct:{medium:2,high:5},
    laborActionCount:{medium:2,high:4},
    disasterEventCount:{medium:2,high:4}
  },
  dataFiles:{
    buildMeta:'./data/build-meta.json',
    unemployment:'./data/unemployment.json',
    fed:'./data/fed.json',
    stocks:'./data/stocks.json',
    gasCurrent:'./data/gas-current.json',
    gasHistory:'./data/gas-history.json',
    disasters:'./data/disasters.json',
    labor:'./data/labor.json',
    pulp:'./data/pulp.json',
    resin:'./data/resin.json',
    competitors:'./data/competitors.json',
    news:'./data/news.json'
  }
};