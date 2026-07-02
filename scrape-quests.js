// scrape-quests.js
// Parses saved Kiranico HTML to update QuestData.json with correct:
//   - Monster / Monsters[] (all large monsters per quest)
//   - Main (objective text)
//   - Hyper, Prowler, Capture, Gathering, Egg, SmMonsters, LgMonster
// Preserves: Type, Level, Name, OneFaint, OnSite, ArenaWeapons, ArenaBiases
// Drops:     Sub (no longer needed)

'use strict';
const fs = require('fs');
const path = require('path');

const HTML_FILE = 'C:/Users/humph/Downloads/Quest List - MHGU - Kiranico - Monster Hunter Generations Ultimate Database.html';
const IN_FILE  = path.join(__dirname, 'QuestData.json');
const OUT_FILE = path.join(__dirname, 'QuestData_new.json');

const html    = fs.readFileSync(HTML_FILE, 'utf8');
const existing = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));

// ── HTML text helper: strip tags + decode entities ───────────────────────────
function htmlText(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Egg delivery items ────────────────────────────────────────────────────────
const EGG_ITEMS = [
  'Gargwa Egg', 'Gold Gargwa Egg', 'Wyvern Egg', 'Sootstone Ore', 'Quartz Ore',
  'Powderstone', 'Carnivore Egg', 'Meteor Chunk', 'Eternal Fossil', 'Herbivore Egg'
];

// ── Sections to SKIP (SP Demo/3DS and Training quests) ───────────────────────
// vendor-dl (DL events) is included — those are the real Event quests in our data
// s9-3 = SP Demo/3DS → skip
// s3-1, s3-2, s3-3 = Training quests → skip (none match existing data, just keep lookup clean)
const SKIP_RANGES = [];

const s9_3_pos = html.indexOf('id="s9-3"');
if (s9_3_pos > 0) SKIP_RANGES.push([s9_3_pos, html.length]);

for (const sid of ['s3-1', 's3-2', 's3-3']) {
  const start = html.indexOf(`id="${sid}"`);
  if (start < 0) continue;
  const nextMatch = html.slice(start + 1).search(/id="s[0-9]+-[0-9]+"/);
  const end = nextMatch >= 0 ? start + 1 + nextMatch : html.length;
  SKIP_RANGES.push([start, end]);
}

function inSkipRange(pos) {
  return SKIP_RANGES.some(([a, b]) => pos >= a && pos < b);
}

// ── Find all quest-link positions ────────────────────────────────────────────
const QUEST_LINK_RE = /href="https:\/\/mhgu\.kiranico\.com\/quest\/[0-9a-f]+"/g;
const questLinkPositions = [];
{
  let m;
  while ((m = QUEST_LINK_RE.exec(html)) !== null) {
    if (!inSkipRange(m.index)) questLinkPositions.push(m.index);
  }
}

// ── Parse one 2-row quest block anchored at a quest link position ─────────────
function parseQuestAt(linkPos) {
  // Find the enclosing <tr>
  const trStart = html.lastIndexOf('<tr>', linkPos);
  if (trStart < 0) return null;

  // The quest block spans two </tr> closings
  const firstTrClose = html.indexOf('</tr>', trStart);
  if (firstTrClose < 0) return null;
  const secondTrClose = html.indexOf('</tr>', firstTrClose + 5);
  if (secondTrClose < 0) return null;
  const blockEnd = secondTrClose + 5;
  const block = html.slice(trStart, blockEnd);

  // ── Quest name ─────────────────────────────────────────────────────────────
  const nameM = block.match(/href="https:\/\/mhgu\.kiranico\.com\/quest\/[0-9a-f]+">\s*([\s\S]*?)\s*<\/a>/);
  if (!nameM) return null;
  // Some quests repeat name after <br> — take only the portion before any <br>
  const rawName = htmlText(nameM[1].split(/<br\s*\/?>/i)[0]);
  if (!rawName) return null;

  // ── Prowler badge (appears before category div in first cell) ──────────────
  const firstCellEnd = block.indexOf('</td>');
  const firstCell = block.slice(0, firstCellEnd + 5);
  const prowler = firstCell.includes('>Prowler<');

  // ── Category (Hunt / Capture / Slay / Gather / Marathon / Deliver) ─────────
  const catM = block.match(/<div>(Hunt|Capture|Slay|Gather(?:ing)?|Marathon|Deliver)<\/div>/i);
  const category = catM ? catM[1] : '';

  // ── Locale (map link text) ─────────────────────────────────────────────────
  const locM = block.match(/href="https:\/\/mhgu\.kiranico\.com\/map\/[0-9a-f]+">([^<]+)<\/a>/);
  const locale = locM ? locM[1].trim() : '';

  // ── Monster cell: third rowspan td ────────────────────────────────────────
  // After the quest-name td closes, the next td is the monster cell
  const questTdClose = block.indexOf('</td>', block.indexOf('kiranico.com/quest/'));
  const monsterCellStart = block.indexOf('<td', questTdClose + 5);
  const monsterCellEnd   = block.indexOf('</td>', monsterCellStart) + 5;
  const monsterCell = block.slice(monsterCellStart, monsterCellEnd);

  // Hyper: badge-warning in the monster cell
  const hyper = monsterCell.includes('>Hyper<');

  // Monster names from /monster/ links (deduplicated, preserving order)
  // Some links have extra attributes e.g. title="Rajang in MHGU" — use [^>]* to skip them
  const monsterLinks = [...monsterCell.matchAll(/href="https:\/\/mhgu\.kiranico\.com\/monster\/[0-9a-f]+"[^>]*>([^<]+)<\/a>/g)];
  const seen = new Set();
  const monsters = [];
  for (const m of monsterLinks) {
    const name = m[1].trim();
    if (!seen.has(name)) { seen.add(name); monsters.push(name); }
  }

  // ── Main objective (first <td><small>…</small></td> in the block) ──────────
  // These appear after the 4 rowspan cells. Find them by looking past the HP cell.
  const hpCellEnd = block.indexOf('</td>', monsterCellEnd);
  const afterHp   = block.slice(hpCellEnd + 5);
  const objM = afterHp.match(/<td><small>([\s\S]*?)<\/small><\/td>/);
  const mainObj = objM ? htmlText(objM[1]) : '';

  return { rawName, monsters, mainObj, category, locale, hyper, prowler };
}

// ── Build lookup: lowercase(rawName) → parsed data ───────────────────────────
const lookup = new Map();
let parseErrors = 0;
for (const pos of questLinkPositions) {
  const data = parseQuestAt(pos);
  if (!data) { parseErrors++; continue; }
  const key = data.rawName.toLowerCase();
  if (!lookup.has(key)) lookup.set(key, data);  // first occurrence wins
}
console.log(`Parsed ${lookup.size} unique quests from HTML (${parseErrors} parse errors)`);

// ── Strip type prefix to get raw name matching the HTML ───────────────────────
// Patterns: "Type N★ // Name"  or  "Type // Name"
// SP quests have no prefix: "Redhelm I: Hunt"
// Arena:  "Arena // Grudge Match: Malfestio"
function getRawName(fullName) {
  const m = fullName.match(/\/\/ (.+)$/);
  if (m) return m[1].trim();
  return fullName.trim();
}

// ── Update each quest ─────────────────────────────────────────────────────────
let found = 0, notFound = 0;
const notFoundNames = [];

const updated = existing.map(q => {
  const rawName = getRawName(q.Name);
  const h = lookup.get(rawName.toLowerCase());

  if (!h) {
    notFound++;
    notFoundNames.push(q.Name);
    return q; // leave unchanged if no HTML match
  }
  found++;

  const obj = h.mainObj;

  // Flags derived from objective text
  const isEgg        = EGG_ITEMS.some(item => obj.includes(item));
  const isGathering  = !isEgg && /^Deliver\b/i.test(obj);
  const isSmMonsters = /^Slay 20\b/i.test(obj);
  const isCapture    = /\bCapture\b/i.test(h.category);
  // LgMonster: quest involves hunting/capturing large monsters
  const isLgMonster  = h.monsters.length > 0 && !isGathering && !isSmMonsters && !isEgg;

  const result = {
    Type:       q.Type,
    Name:       q.Name,
    Main:       obj || q.Main,
    Monster:    isLgMonster ? (h.monsters[0] || '') : '',
    Monsters:   isLgMonster ? h.monsters : [],
    Level:      q.Level,
    LgMonster:  isLgMonster,
    Prowler:    h.prowler,
    Hyper:      h.hyper,
    Egg:        isEgg,
    Gathering:  isGathering,
    SmMonsters: isSmMonsters,
    Capture:    isCapture,
    OnSite:     q.OnSite,
    OneFaint:   q.OneFaint,
    Locale:     h.locale || q.Locale,
  };

  if (q.ArenaWeapons) result.ArenaWeapons = q.ArenaWeapons;
  if (q.ArenaBiases)  result.ArenaBiases  = q.ArenaBiases;

  return result;
});

// ── Write output ──────────────────────────────────────────────────────────────
fs.writeFileSync(OUT_FILE, JSON.stringify(updated, null, 2), 'utf8');

console.log(`\nResults: ${found} updated, ${notFound} not found`);
if (notFoundNames.length) {
  console.log('\nNot found in HTML:');
  notFoundNames.forEach(n => console.log('  ', n));
}
console.log(`\nOutput written to ${OUT_FILE}`);
