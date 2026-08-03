// Pure (no DOM) port of the roll logic in docs/app.js — randomize()/renderResult()/
// rollArt()/maybeSP() and the copyResultBtn clipboard formatter.
// Keep this in sync by hand if the corresponding logic in docs/app.js changes; there is
// no automated sync between the two.

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

const WEAPONS = ["Great Sword","Long Sword","Sword & Shield","Dual Blades",
  "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe","Charge Blade",
  "Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"];

const STYLES = ["Guild","Striker","Adept","Aerial","Valor","Alchemy"];

const BIAS_NAMES = ["Charisma","Fighting","Protection","Assisting","Healing","Bombing","Gathering","Beast"];

const DEVIANT_FULL = {
  redhelm:"Redhelm Arzuros", snowbaron:"Snowbaron Lagombi", stonefist:"Stonefist Hermitaur",
  dreadqueen:"Dreadqueen Rathian", drilltusk:"Drilltusk Tetsucabra", silverwind:"Silverwind Nargacuga",
  crystalbeard:"Crystalbeard Uragaan", deadeye:"Deadeye Yian Garuga", dreadking:"Dreadking Rathalos",
  thunderlord:"Thunderlord Zinogre", grimclaw:"Grimclaw Tigrex", hellblade:"Hellblade Glavenus",
  nightcloak:"Nightcloak Malfestio", rustrazor:"Rustrazor Ceanataur", soulseer:"Soulseer Mizutsune",
  boltreaver:"Boltreaver Astalos", elderfrost:"Elderfrost Gammoth", bloodbath:"Bloodbath Diablos",
};

const SP_TIERS = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,G1:11,G2:12,G3:13,G4:14,G5:15,EX:16};

function spTier(name) {
  const c = name.indexOf(":"); if (c < 1) return 0;
  const s = name.lastIndexOf(" ", c - 1); if (s < 0) return 0;
  return SP_TIERS[name.slice(s + 1, c)] || 0;
}

function spDeviant(name, monster) {
  const c = name.indexOf(":");
  if (c > 0) {
    const s = name.lastIndexOf(" ", c - 1);
    if (s > 0) {
      const prefix = name.slice(0, s);
      if (monster && monster.toLowerCase().startsWith(prefix.toLowerCase())) return monster;
      const full = DEVIANT_FULL[prefix.toLowerCase()];
      if (full) return full;
    }
  }
  return monster || "";
}

// Maps each quest to its position in the unified 0-44 ALL range.
function allRank(q) {
  switch (q.Type) {
    case "Village":         return q.Level - 1;
    case "Hub":             return 10 + q.Level;
    case "Pub":             return 18 + q.Level;
    case "Special Permits": return 23 + spTier(q.Name || "");
    case "Events":          return 39 + q.Level;
    case "Arena":           return 42 + q.Level;
    default:                return -1;
  }
}

const normWeapon = (w) => w.toLowerCase().replace(/ & /g, " and ");
const artBase = (n) => n.replace(/ (III|II|I)$/, "");

const smMonsterName = (main) => {
  if (!main) return "";
  const KEEP_S = new Set(["Cephalos"]);
  const depl = (n) => KEEP_S.has(n) ? n : n.replace(/xes$/, "x").replace(/s$/, "");
  let m = main.match(/(?:Slay|Defeat) a total of \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (m) return depl(m[1]);
  m = main.match(/Slay \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (m) return depl(m[1]);
  return "";
};

// Rolls a Hunter Art in two stages: first pick a distinct base art uniformly (so an
// "All"-weapon art like Castle Walls has the same odds as a weapon-specific art like
// Moonbreaker, regardless of how many levels either has), then roll a level uniformly
// among that base's remaining levels. Uniformly sampling raw data rows instead (the old
// approach) skewed toward leveled arts 3:1, since each level is its own row.
function rollArt(DATA, weapon, ex1, ex2, excl) {
  const wn = normWeapon(weapon);
  const b1 = ex1 ? artBase(ex1) : null, b2 = ex2 ? artBase(ex2) : null;
  const byBase = new Map();
  for (const a of DATA.arts) {
    const aw = a.Weapon.toLowerCase();
    if (aw !== "all" && aw !== wn) continue;
    if (excl && excl.has(a.HunterArtName)) continue;
    const b = artBase(a.HunterArtName);
    if (b === b1 || b === b2) continue;
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(a.HunterArtName);
  }
  const bases = [...byBase.keys()];
  if (!bases.length) return null;
  const levels = byBase.get(pick(bases));
  return pick(levels);
}

const maybeSP = (art, spArtsEnabled) => !art ? "" : (spArtsEnabled && Math.random() < 1/3 ? art + " SP" : art);

function normalizeFilters(filters) {
  const f2 = filters || {};
  const t = f2.t || {};
  return {
    t,
    uncheckedWeapons: new Set(f2.weapons || []),
    uncheckedStyles: new Set(f2.styles || []),
    uncheckedBiases: new Set(f2.biases || []),
    uncheckedMonsters: new Set(f2.monsters || []),
    excludedArtNames: new Set(f2.arts || []),
    blacklist: f2.blacklist || [],
    spArtsEnabled: t.spArts !== false,
    challenges: Array.isArray(f2.challenges) ? f2.challenges : [],
    challengeCount: f2.challengeCount || 1,
    chaosMode: !!t.chaosMode,
  };
}

// Mirrors docs/app.js's rollChallenges(): rolls each enabled challenge against its own
// chance %, then keeps a random subset capped at the "roll up to N" count. Disabled
// conditions never roll. In Chaos Mode, a hidden -20..+20% base roll is blended into
// each condition's own chance to decide its checked state for this roll instead of
// reading the manual checkbox; the condition still needs to pass its own chance-roll
// on top of that. There's no live UI here to sync back to (unlike the main app's
// chaos-mode checkbox preview), since this just runs headless on each request.
function rollChallenges(nf) {
  const { challenges, challengeCount, chaosMode } = nf;
  if (!challenges.length) return [];
  const count = Math.min(8, Math.max(1, challengeCount || 1));
  let eligible;
  if (chaosMode) {
    const baseChaos = (Math.random() * 40) - 20;
    eligible = challenges.filter((c) => {
      const chaosChecked = Math.random() * 100 < Math.max(0, Math.min(100, baseChaos + c.chance));
      return chaosChecked && Math.random() * 100 < c.chance;
    });
  } else {
    eligible = challenges.filter((c) => c.checked === true && Math.random() * 100 < c.chance);
  }
  eligible.sort(() => Math.random() - 0.5);
  return eligible.slice(0, count).map((c) => c.text);
}

// Picks a single quest from DATA.quests respecting every quest-pool filter. Returns null
// if nothing matches (caller shows a "no quests match" message).
function pickFilteredQuest(DATA, nf) {
  const { t, uncheckedMonsters } = nf;
  const inc = new Set(DATA.monsters.filter(m => !uncheckedMonsters.has(m.MonsterName)).map(m => m.MonsterName.toLowerCase()));
  const anyFiltered = inc.size < DATA.monsters.length;

  // t.allLevels stores the DISABLED rank indices (inverse of the "enabled" set used
  // here) — matches the saveFilters()/randomize() relationship in docs/app.js exactly.
  const disabledLevels = new Set(t.allLevels || []);
  const allLevels = new Set(Array.from({ length: 45 }, (_, i) => i).filter(i => !disabledLevels.has(i)));

  const f = {
    pQuests: !!t.pQuests, large: t.large !== false, keysOnly: !!t.keysOnly,
    hyper: !!t.hyper, capture: !!t.capture,
    egg: !!t.egg, gathering: !!t.gathering, small: !!t.small,
    multi: !!t.multi, oneFaint: !!t.oneFaint, onSite: !!t.onSite,
  };

  const pool = DATA.quests.filter(q => {
    const rank = allRank(q);
    if (rank < 0 || !allLevels.has(rank)) return false;

    if (q.LgMonster && !f.large) return false;
    if (f.keysOnly && !q.Key) return false;

    const include = (q.LgMonster && !q.Capture)
      || (q.Capture && f.capture)
      || (q.Prowler && f.pQuests) || (q.Hyper && f.hyper)
      || (q.Egg && f.egg) || (q.Gathering && f.gathering) || (q.SmMonsters && f.small);
    if (!include) return false;

    if (q.Prowler && !f.pQuests) return false;
    if (q.Hyper && !f.hyper) return false;
    const isMultiMonster = (q.Monsters && q.Monsters.length > 1) ||
      (q.LgMonster && /\b[2-9]\b/.test(q.Main || ""));
    if (isMultiMonster && !f.multi) return false;
    if (q.OneFaint && !f.oneFaint) return false;
    if (q.OnSite && !f.onSite) return false;

    if (q.LgMonster && anyFiltered) {
      const qmons = (q.Monsters && q.Monsters.length) ? q.Monsters : (q.Monster ? [q.Monster] : []);
      if (qmons.length > 0 && !qmons.every(m => inc.has(m.toLowerCase()))) return false;
    }
    return true;
  });

  return pool.length ? pick(pool) : null;
}

function questInfo(quest) {
  const iconMonster = (quest.Type === "Special Permits" && quest.Name)
    ? spDeviant(quest.Name, quest.Monster)
    : (quest.Monster || (quest.SmMonsters ? smMonsterName(quest.Main) : ""));
  const monsters = (quest.Monsters && quest.Monsters.length) ? quest.Monsters.join(", ") : iconMonster;
  return { name: quest.Name || "", main: quest.Main || "", locale: quest.Locale || "—", monsters };
}

// Decides a weapon (forced Prowler quests aside — this never returns anything but a
// normal roll, since it has no quest to force Prowler from).
function rollWeapon(nf) {
  const { t, uncheckedWeapons, uncheckedStyles, blacklist } = nf;
  const chosen = WEAPONS.filter(w => !uncheckedWeapons.has(w));
  if (t.prowler) chosen.push("Prowler");
  let weapon = chosen.length ? pick(chosen) : "Great Sword";
  // Reroll weapon if the blacklist blocks all available styles for it
  if (weapon !== "Prowler" && blacklist.length) {
    const baseStyles = STYLES.filter(s => !uncheckedStyles.has(s));
    for (let i = 0; i < 50; i++) {
      const blS = new Set(blacklist.filter(b => b.weapon === weapon).map(b => b.style));
      if (baseStyles.some(s => !blS.has(s))) break;
      weapon = chosen.length ? pick(chosen) : "Great Sword";
    }
  }
  return weapon;
}

// Given a weapon (already decided — forced by a Prowler quest, or freely rolled), rolls
// the bias (if Prowler) or style + Hunter Arts. Returns {styleLabel, style, arts}.
function rollLoadoutForWeapon(DATA, weapon, nf) {
  const { uncheckedBiases, uncheckedStyles, blacklist, excludedArtNames, spArtsEnabled } = nf;

  if (weapon === "Prowler") {
    let avail = BIAS_NAMES.filter(name => !uncheckedBiases.has(name));
    if (!avail.length) avail = [BIAS_NAMES[0]];
    return { styleLabel: "Bias", style: pick(avail), arts: [] };
  }

  let styles = STYLES.filter(s => !uncheckedStyles.has(s));
  const blS = new Set(blacklist.filter(b => b.weapon === weapon).map(b => b.style));
  const filteredStyles = styles.filter(s => !blS.has(s));
  if (filteredStyles.length) styles = filteredStyles;
  if (!styles.length) styles = ["Guild"];
  const style = pick(styles);

  // Slot count by style: Alchemy/Striker = 3, Guild = 2, everything else = 1.
  // SP rule mirrors the game: Alchemy may SP every art independently, but Guild and
  // Striker allow at most ONE SP art — once an earlier art rolls SP, the rest skip
  // the SP roll (pass the plain art through instead of calling maybeSP again).
  let spPicks = [];
  if (style === "Alchemy") {
    const a = rollArt(DATA, weapon, null, null, excludedArtNames);
    const b = rollArt(DATA, weapon, a, null, excludedArtNames);
    const c = rollArt(DATA, weapon, a, b, excludedArtNames);
    spPicks = [a, b, c].map(x => maybeSP(x, spArtsEnabled));
  } else if (style === "Striker") {
    const a = rollArt(DATA, weapon, null, null, excludedArtNames);
    const b = rollArt(DATA, weapon, a, null, excludedArtNames);
    const c = rollArt(DATA, weapon, a, b, excludedArtNames);
    const aSP = maybeSP(a, spArtsEnabled);
    const bSP = aSP.endsWith(" SP") ? b : maybeSP(b, spArtsEnabled);
    const cSP = (aSP.endsWith(" SP") || (bSP && bSP.endsWith(" SP"))) ? c : maybeSP(c, spArtsEnabled);
    spPicks = [aSP, bSP, cSP];
  } else if (style === "Guild") {
    const a = rollArt(DATA, weapon, null, null, excludedArtNames);
    const b = rollArt(DATA, weapon, a, null, excludedArtNames);
    const aSP = maybeSP(a, spArtsEnabled);
    spPicks = [aSP, aSP.endsWith(" SP") ? b : maybeSP(b, spArtsEnabled)];
  } else {
    spPicks = [maybeSP(rollArt(DATA, weapon, null, null, excludedArtNames), spArtsEnabled)];
  }

  return { styleLabel: "Style", style, arts: spPicks.filter(Boolean) };
}

// filters: the exact JSON shape produced by docs/app.js's saveFilters(). Returns
// null if no quest matches the pool (caller should show a "no quests match" message).
export function rollQuest(DATA, filters) {
  const nf = normalizeFilters(filters);
  const quest = pickFilteredQuest(DATA, nf);
  if (!quest) return null;

  const result = {
    ...questInfo(quest),
    styleHidden: false, styleLabel: "Style", style: "", weapon: "", arts: [],
    challenges: rollChallenges(nf),
  };

  // Arena: preset equipment/bias sets from the quest description — style/arts aren't rolled.
  if (quest.Type === "Arena") {
    if (quest.ArenaBiases && quest.ArenaBiases.length) {
      result.weapon = "Prowler";
      result.styleLabel = "Bias"; result.style = pick(quest.ArenaBiases);
    } else if (quest.ArenaWeapons && quest.ArenaWeapons.length) {
      result.weapon = pick(quest.ArenaWeapons);
      result.styleHidden = true;
    } else {
      result.weapon = "Set " + (1 + rand(5));
      result.styleHidden = true;
    }
    return result;
  }

  const weapon = quest.Prowler ? "Prowler" : rollWeapon(nf);
  result.weapon = weapon;
  Object.assign(result, rollLoadoutForWeapon(DATA, weapon, nf));
  return result;
}

// Quest only — no weapon/style/arts rolled or shown at all.
export function rollQuestOnly(DATA, filters) {
  const nf = normalizeFilters(filters);
  const quest = pickFilteredQuest(DATA, nf);
  if (!quest) return null;
  return questInfo(quest);
}

// Weapon only — no quest involved, so there's no Arena/Prowler-quest special-casing to
// apply; it's always a normal weapon+style/bias+arts roll.
export function rollWeaponOnly(DATA, filters) {
  const nf = normalizeFilters(filters);
  const weapon = rollWeapon(nf);
  return { weapon, ...rollLoadoutForWeapon(DATA, weapon, nf) };
}

// Challenge only — no quest DATA is needed at all, since challenges live entirely in
// filters; unlike rollQuestOnly/rollWeaponOnly this takes just filters, no DATA param.
export function rollChallengeOnly(filters) {
  const nf = normalizeFilters(filters);
  return { challenges: rollChallenges(nf) };
}

// The Worker's original fixed pool (Large Monster hunts + Hyper + Capture, every rank,
// SP Arts on, no Prowler, no Key-only) — kept as an explicit filters object so bare
// GET /quest (no channel) is byte-for-byte unchanged from before per-channel filters
// existed, rather than relying on the general engine to happen to reproduce it.
const DEFAULT_FILTERS = {
  weapons: [], styles: [], biases: [], monsters: [], arts: [], blacklist: [],
  t: {
    keysOnly: false, large: true, hyper: true, capture: true,
    egg: false, gathering: false, small: false, multi: false,
    oneFaint: false, onSite: false, spArts: true,
    prowler: false, pQuests: false, allLevels: [],
  },
};

export function rollDefaultQuest(DATA) {
  return rollQuest(DATA, DEFAULT_FILTERS);
}

export function defaultFilters() {
  return DEFAULT_FILTERS;
}

// Mirrors the exact copyResultBtn format in docs/app.js (the " |\n" join separator and
// conditional Monster:/Style:/Hunter Art(s): lines).
export function formatForChat(result) {
  const lines = [`Quest: ${result.name}`];
  if (result.monsters) lines.push(`Monster: ${result.monsters}`);
  lines.push(`Locale: ${result.locale}`, `Weapon: ${result.weapon}`);
  if (!result.styleHidden) lines.push(`${result.styleLabel}: ${result.style}`);
  if (result.arts.length) lines.push(`Hunter Art(s): ${result.arts.join(" / ")}`);
  if (result.challenges && result.challenges.length) lines.push(`Challenges: ${result.challenges.join(", ")}`);
  return lines.join(" |\n");
}

export function formatQuestOnly(result) {
  const lines = [`Quest: ${result.name}`];
  if (result.monsters) lines.push(`Monster: ${result.monsters}`);
  lines.push(`Locale: ${result.locale}`);
  return lines.join(" |\n");
}

export function formatWeaponOnly(result) {
  const lines = [`Weapon: ${result.weapon}`, `${result.styleLabel}: ${result.style}`];
  if (result.arts.length) lines.push(`Hunter Art(s): ${result.arts.join(" / ")}`);
  return lines.join(" |\n");
}

export function formatChallengeOnly(result) {
  if (!result.challenges.length) return "No challenges rolled this time.";
  return `Challenges: ${result.challenges.join(", ")}`;
}
