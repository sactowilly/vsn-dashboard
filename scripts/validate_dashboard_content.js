const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const appPath = path.join(root, "app.js");

const dataFiles = {
  buildMeta: "build-meta.json",
  unemployment: "unemployment.json",
  fed: "fed.json",
  stocks: "stocks.json",
  disasters: "disasters.json",
  labor: "labor.json",
  pulp: "pulp.json",
  resin: "resin.json",
  gasCurrent: "gas-current.json",
  gasHistory: "gas-history.json",
  competitors: "competitors.json",
  news: "news.json"
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
}

function makeElement() {
  return {
    innerHTML: "",
    textContent: "",
    disabled: false,
    dataset: {},
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    addEventListener() {},
    querySelectorAll() { return []; }
  };
}

const elements = new Map();
const context = {
  console,
  Date,
  Intl,
  Math,
  Number,
  String,
  setTimeout() { return 0; },
  setInterval() { return 0; },
  clearTimeout() {},
  clearInterval() {},
  window: {
    DASHBOARD_CONFIG: {
      timezone: "America/Los_Angeles",
      dataFiles: Object.fromEntries(Object.entries(dataFiles).map(([key, file]) => [key, `data/${file}`]))
    }
  },
  document: {
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; }
  }
};

const appSource = fs.readFileSync(appPath, "utf8");
vm.runInNewContext(
  `${appSource}\n` +
    `globalThis.__dashboardAudit = { state, buildCards, openDetail, freshnessInfo };`,
  context,
  { filename: appPath }
);

for (const [key, file] of Object.entries(dataFiles)) {
  context.__dashboardAudit.state.data[key] = readJson(file);
}

context.__dashboardAudit.buildCards();

const cards = context.__dashboardAudit.state.cards;
const expectedIds = [
  "unemployment",
  "fed",
  "stocks",
  "disasters",
  "labor",
  "pulp",
  "resin",
  "gas",
  "competitors",
  "news"
];

const errors = [];

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

if (cards.length !== expectedIds.length) {
  errors.push(`expected ${expectedIds.length} cards, found ${cards.length}`);
}

for (const id of expectedIds) {
  const card = cards.find(item => item.id === id);
  if (!card) {
    errors.push(`${id}: missing card`);
    continue;
  }

  for (const field of ["executiveRead", "recommendedAction", "history", "why", "use"]) {
    if (wordCount(card[field]) < 8) errors.push(`${id}: ${field} is missing or too thin`);
  }

  if (wordCount(card.plainRead || card.executiveRead) < 8) {
    errors.push(`${id}: plain read is missing or too thin`);
  }

  if (wordCount(card.analysis || card.recommendedAction) < 8) {
    errors.push(`${id}: analysis is missing or too thin`);
  }

  for (const field of ["question", "trigger", "move"]) {
    if (wordCount(card.ownershipLens?.[field]) < 5) errors.push(`${id}: ownershipLens.${field} is missing or too thin`);
  }

  if (!Array.isArray(card.playbook) || card.playbook.length < 3) {
    errors.push(`${id}: playbook needs at least 3 items`);
  } else {
    card.playbook.forEach((item, index) => {
      if (wordCount(item) < 7) errors.push(`${id}: playbook item ${index + 1} is too thin`);
    });
  }

  context.__dashboardAudit.openDetail(id);
  const html = elements.get("detailContent").innerHTML;
  for (const heading of [
    "Plain Read",
    "AI Analysis",
    "Recommended Action",
    "Ownership Decision Lens",
    "History / Trend",
    "Operating Playbook",
    "Why This Matters",
    "How Vision Packaging Can Use This",
    "Research &amp; Findings",
    "Data Quality",
    "Sources"
  ]) {
    if (!html.includes(heading)) errors.push(`${id}: flyout missing ${heading}`);
  }

  const hiddenLevelTerms = new RegExp(["6th", "8th", ["grade", "level"].join(" ")].join("|"), "i");
  if (hiddenLevelTerms.test(html)) {
    errors.push(`${id}: flyout should not mention internal audience-level labels`);
  }
}

if (errors.length) {
  console.error("Dashboard content validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated dashboard content for ${cards.length} cards.`);
