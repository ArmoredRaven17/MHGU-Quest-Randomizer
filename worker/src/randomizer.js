// Pure (no DOM) port of the roll logic in docs/app.js — randomize()/renderResult()/
// rollArt()/maybeSP() and the copyResultBtn clipboard formatter.
// Keep this in sync by hand if the corresponding logic in docs/app.js changes; there is
// no automated sync between the two.
//
// Unlike the web app, this is a single fixed, stateless pool with no per-caller
// customization: Large Monster hunts + Hyper + Capture, across every rank, SP Arts on,
// no Prowler, no Key-only restriction, no challenges. Simplified deliberately so the
// bot-facing endpoint has no per-streamer settings to store (and nothing to tamper with).

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

const WEAPONS = ["Great Sword","Long Sword","Sword & Shield","Dual Blades",
  "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe","Charge Blade",
  "Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"];

const STYLES = ["Guild","Striker","Adept","Aerial","Valor","Alchemy"];

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

function rollArt(DATA, weapon, ex1, ex2) {
  const wn = normWeapon(weapon);
  const b1 = ex1 ? artBase(ex1) : null, b2 = ex2 ? artBase(ex2) : null;
  for (let i = 0; i < 1000; i++) {
    const a = DATA.arts[rand(DATA.arts.length)];
    const aw = a.Weapon.toLowerCase();
    if (aw !== "all" && aw !== wn) continue;
    const b = artBase(a.HunterArtName);
    if (b === b1 || b === b2) continue;
    return a.HunterArtName;
  }
  return null;
}

const maybeSP = (art) => !art ? "" : (Math.random() < 1/3 ? art + " SP" : art);

// Fixed pool: Large Monster hunts + Hyper + Capture, every rank, no Key-only, no
// Prowler. Returns null if (implausibly) nothing matches.
export function rollQuest(DATA) {
  const pool = DATA.quests.filter(q => {
    if (allRank(q) < 0) return false;
    if (q.Prowler) return false;
    if (q.LgMonster && !q.Capture) return true;
    if (q.Capture) return true;
    return false;
  });

  const quest = pool.length ? pick(pool) : null;
  if (!quest) return null;

  const iconMonster = (quest.Type === "Special Permits" && quest.Name)
    ? spDeviant(quest.Name, quest.Monster)
    : (quest.Monster || "");
  const monsters = (quest.Monsters && quest.Monsters.length) ? quest.Monsters.join(", ") : iconMonster;

  const result = {
    name: quest.Name || "", main: quest.Main || "", locale: quest.Locale || "—",
    monsters, styleHidden: false, styleLabel: "Style", style: "", weapon: "", arts: [],
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

  const weapon = pick(WEAPONS);
  result.weapon = weapon;

  const style = pick(STYLES);
  result.styleLabel = "Style";
  result.style = style;

  // Slot count by style: Alchemy/Striker = 3, Guild = 2, everything else = 1.
  // SP rule mirrors the game: Alchemy may SP every art independently, but Guild and
  // Striker allow at most ONE SP art — once an earlier art rolls SP, the rest skip
  // the SP roll (pass the plain art through instead of calling maybeSP again).
  let spPicks = [];
  if (style === "Alchemy") {
    const a = rollArt(DATA, weapon, null, null);
    const b = rollArt(DATA, weapon, a, null);
    const c = rollArt(DATA, weapon, a, b);
    spPicks = [a, b, c].map(maybeSP);
  } else if (style === "Striker") {
    const a = rollArt(DATA, weapon, null, null);
    const b = rollArt(DATA, weapon, a, null);
    const c = rollArt(DATA, weapon, a, b);
    const aSP = maybeSP(a);
    const bSP = aSP.endsWith(" SP") ? b : maybeSP(b);
    const cSP = (aSP.endsWith(" SP") || (bSP && bSP.endsWith(" SP"))) ? c : maybeSP(c);
    spPicks = [aSP, bSP, cSP];
  } else if (style === "Guild") {
    const a = rollArt(DATA, weapon, null, null);
    const b = rollArt(DATA, weapon, a, null);
    const aSP = maybeSP(a);
    spPicks = [aSP, aSP.endsWith(" SP") ? b : maybeSP(b)];
  } else {
    spPicks = [maybeSP(rollArt(DATA, weapon, null, null))];
  }
  result.arts = spPicks.filter(Boolean);

  return result;
}

// Mirrors the exact copyResultBtn format in docs/app.js (the " |\n" join separator and
// conditional Monster:/Style:/Hunter Art(s): lines).
export function formatForChat(result) {
  const lines = [`Quest: ${result.name}`];
  if (result.monsters) lines.push(`Monster: ${result.monsters}`);
  lines.push(`Locale: ${result.locale}`, `Weapon: ${result.weapon}`);
  if (!result.styleHidden) lines.push(`${result.styleLabel}: ${result.style}`);
  if (result.arts.length) lines.push(`Hunter Art(s): ${result.arts.join(" / ")}`);
  return lines.join(" |\n");
}
