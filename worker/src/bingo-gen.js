// Server-side bingo card generation, so `!bingo` can hand chat a brand-new card without
// anyone having the app open.
//
// THIS IS A MIRROR of the generation half of MHGU-Bingo's docs/app.js, in the same way
// randomizer.js mirrors the Quest Randomizer's docs/app.js. It has to stay byte-faithful:
// the seed printed in chat only rebuilds the same card in the app if both sides draw in
// exactly the same order. If you change a pool, a default, an ordering, or the RNG in one
// place, change it in the other and re-run the parity check in worker/test/.
//
// Cards are always generated from the app's DEFAULT settings — the bot has no login and
// therefore no user config to read. That's also what makes the seed useful in chat: a
// viewer opening the app fresh has those same defaults, so pasting the seed reproduces
// the card exactly.

// ── Static config (mirrors docs/app.js) ──────────────────────────────────────
const WEAPONS = ["Great Sword","Long Sword","Sword & Shield","Dual Blades",
  "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe","Charge Blade",
  "Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"];

const WEAPON_COLORS = {
  "Great Sword":"#ff505b","Long Sword":"#9beaf1","Sword & Shield":"#dfd65f",
  "Dual Blades":"#6ac083","Hammer":"#c3a3d2","Hunting Horn":"#f89a64",
  "Lance":"#9fbcff","Gunlance":"#f4baf5","Switch Axe":"#aaaaaa",
  "Charge Blade":"#fc5800","Insect Glaive":"#f5f5f5","Light Bowgun":"#acd56b",
  "Heavy Bowgun":"#f8899c","Bow":"#55edc4","Prowler":"#c29930",
};

const STYLES = ["Guild","Striker","Adept","Aerial","Valor","Alchemy"];

// Prowler biases. Order is load-bearing: the goal list must come out identical to the app's.
const BIASES = [
  ["Charisma",  "FourthGen-Palico_Icon_Blue.webp"],
  ["Fighting",  "Palico_Weapon_Cutting_Icon_Red.webp"],
  ["Protection","FourthGen-Down_Arrow_Icon_Blue.webp"],
  ["Assisting", "MH4G-Trap_Icon_Purple.webp"],
  ["Healing",   "MH4G-Horn_Icon_Green.webp"],
  ["Bombing",   "MH4G-Barrel_Icon_Brown.webp"],
  ["Gathering", "MH4G-Boomerang_Icon_Blue.webp"],
  ["Beast",     "FourthGen-Claw_Icon_Dark_Red.webp"],
];
const BIAS_NAMES = BIASES.map(b => b[0]);
const prowlerIcon = (f) => "assets/ProwlerIcons/" + f;

// Border colour is keyed on the filter category a square came from — the same axis as
// questCategory and the Quest Filters checkboxes — so the colour always matches the
// filter that put it on the card. Ranks run warm and escalating (yellow to red);
// the categories on their own filter axis get their own hues.
const CATEGORY_COLORS = {
  Low: "#f2c53d", High: "#f5851f", G: "#e5383b",
  SP: "#8b31d9", Event: "#2456c7", Arena: "#8a8f98", "": "#8a8f98",
};
const POOL_COLORS = { objective: "#9b8cff", custom: "#5ec9a0", free: "#8a8f98" };

const SP_TIERS = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,G1:11,G2:12,G3:13,G4:14,G5:15,EX:16};

const FALLBACK_ICON = "assets/MonsterIcons/MHGU-Question_Mark_Icon.webp";
const monsterIcon = (name) => name
  ? "assets/MonsterIcons/MHGU-" + name.replace(/ /g, "_") + "_Icon.webp"
  : FALLBACK_ICON;
const weaponIcon = (w) => "assets/WeaponIcons/icon_" +
  w.toLowerCase().replace(/ & /g, "_and_").replace(/ /g, "_") + "_tinted.png";

const DEFAULT_CFG = { size: 5, free: true, cats: { monster: 4, weapon: 3, objective: 2, custom: 3 } };

const DEFAULT_POOL = [
  "Cart to a monster you already hunted",
  "Moxie saved you, then you died anyway",
  "Get carted by a small monster",
  "Clear with under 5 minutes left",
  "Sharpen mid-combo and get hit for it",
  "Trip another hunter with your own attack",
  "Finish a quest without eating first",
  "Run out of Whetstones",
  "Capture a monster by accident",
  "Faint in the first two minutes",
].map(text => ({ text, weight: 5, checked: true }));

// What the app's controls read as on a first visit (see doReset in docs/app.js): every
// rank category enabled.
const FLAG_ORDER = ["large","keysOnly","hyper","capture","egg","gathering","small",
  "multi","oneFaint","onSite","pQuests"];
const DEFAULT_FLAGS = {
  large: true, keysOnly: false, hyper: true, capture: true, egg: true, gathering: true,
  small: true, multi: true, oneFaint: true, onSite: true, pQuests: false,
};

// ── Seeded RNG (mirrors docs/app.js) ─────────────────────────────────────────
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const makeRng = (seedStr) => ({ next: mulberry32(hashStr(seedStr)) });

function weightedShuffle(items, rng) {
  return items
    .map(it => ({ it, k: Math.pow(rng.next(), 1 / (it.w || 1)) }))
    .sort((a, b) => a.k - b.k)
    .map(e => e.it);
}

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const b32 = (n, len) => { let s = ""; for (let i = 0; i < len; i++) { s = B32[n & 31] + s; n = n >>> 5; } return s; };
const CAT_LETTER = { monster:"M", weapon:"W", objective:"O", custom:"C" };

// The only unseeded draw: a fresh card token per !bingo. Uses Web Crypto rather than
// Math.random since Workers isolates can share a seeded PRNG state across requests.
function newToken() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += B32[x & 31];
  return s;
}

const effFree = (c) => !!c.free && c.size % 2 === 1;

function seedBody(c, token) {
  const cats = CATS.filter(x => (c.cats[x.id] | 0) > 0)
    .map(x => CAT_LETTER[x.id] + c.cats[x.id]).join("");
  return "MHGU-" + c.size + (effFree(c) ? "F" : "N") + "-" + cats + "-" + token;
}

function fingerprint(DATA, f, customPool) {
  return [
    "d" + DATA.dataVersion,
    "R" + [...f.ranks].sort().join("."),
    "M" + [...f.includedMonsters].sort().join("."),
    "W" + f.weapons.slice().sort().join("."),
    "S" + f.styles.slice().sort().join(".") ,
    "P" + f.biases.slice().sort().join("."),
    "F" + FLAG_ORDER.map(k => f[k] ? 1 : 0).join(""),
    "C" + customPool.filter(c => c.checked).map(c => c.text + "@" + c.weight).sort().join("."),
  ].join("|");
}

// ── Quest pool (mirrors docs/app.js) ─────────────────────────────────────────
function spTier(name) {
  const c = name.indexOf(":"); if (c < 1) return 0;
  const s = name.lastIndexOf(" ", c - 1); if (s < 0) return 0;
  return SP_TIERS[name.slice(s + 1, c)] || 0;
}
function baseRank(q) {
  switch (q.Type) {
    case "Village":         return "Low";
    case "Hub":             return q.Level <= 3 ? "Low" : "High";
    case "Pub":             return "G";
    case "Special Permits": return spTier(q.Name || "") >= 11 ? "G" : "High";
    case "Events":          return q.Level === 1 ? "Low" : q.Level === 2 ? "High" : "G";
    default:                return "";
  }
}

function rankLabel(q) {
  const r = baseRank(q);
  if (!r) return "";
  const prefix = q.Type === "Events" ? "Event · "
    : q.Type === "Special Permits" ? "Permit · " : "";
  return prefix + r + " Rank";
}

// What the quest filters switch on. Village / Hub / Pub / Events are just delivery
// mechanisms for a rank, so they collapse into Low / High / G; Special Permits and Arena
// stay separate. rankLabel above remains the *display* rank.
function questCategory(q) {
  if (q.Type === "Special Permits") return "SP";
  if (q.Type === "Arena") return "Arena";
  if (q.Type === "Events") return "Event";
  return baseRank(q);
}
const ALL_RANKS = ["Low", "High", "G", "SP", "Event", "Arena"];

function buildQuestPool(DATA, f) {
  return DATA.quests.filter(q => {
    if (!f.ranks.has(questCategory(q))) return false;

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

    if (q.LgMonster && f.monsterFilterActive) {
      const qmons = (q.Monsters && q.Monsters.length) ? q.Monsters : (q.Monster ? [q.Monster] : []);
      if (qmons.length > 0 && !qmons.every(m => f.includedMonsters.has(m.toLowerCase()))) return false;
    }
    return true;
  });
}

// ── Goal pools (mirrors docs/app.js) ─────────────────────────────────────────
const RANK_ORDER = ["Low Rank", "High Rank", "G Rank",
  "Event · Low Rank", "Event · High Rank", "Event · G Rank",
  "Permit · Low Rank", "Permit · High Rank", "Permit · G Rank", ""];
function monsterGoals(pool) {
  const seen = new Map();
  for (const q of pool) {
    if (!q.LgMonster) continue;
    const label = rankLabel(q), cat = questCategory(q);
    const list = (q.Monsters && q.Monsters.length) ? q.Monsters : (q.Monster ? [q.Monster] : []);
    for (const m of list) {
      if (!m) continue;
      if (!seen.has(m)) seen.set(m, new Map());
      if (label) seen.get(m).set(label, cat);
    }
  }
  const out = [];
  for (const [name, labels] of seen) {
    const have = labels.size ? labels : new Map([["", "Arena"]]);
    for (const label of RANK_ORDER) {
      if (!have.has(label)) continue;
      out.push({
        key: "m:" + name + ":" + label,
        cat: "monster",
        text: "Hunt " + name,
        sub: label,
        icon: monsterIcon(name),
        tint: CATEGORY_COLORS[have.get(label)],
      });
    }
  }
  return out;
}

function weaponGoals(pool, f) {
  const out = [];
  for (const w of f.weapons) {
    if (!f.styles.length) {
      out.push({ key: "w:" + w, cat: "weapon", text: "Clear with " + w, sub: "", icon: weaponIcon(w), tint: WEAPON_COLORS[w] });
    } else {
      for (const s of f.styles) {
        out.push({ key: "w:" + w + "|" + s, cat: "weapon", text: "Clear with " + w, sub: s, icon: weaponIcon(w), tint: WEAPON_COLORS[w] });
      }
    }
  }
  if (f.pQuests && pool.some(q => q.Prowler)) {
    for (const [name, file] of BIASES) {
      if (!f.biases.includes(name)) continue;
      out.push({ key: "w:Prowler|" + name, cat: "weapon", text: "Clear as a Prowler",
                 sub: name, icon: prowlerIcon(file), tint: WEAPON_COLORS.Prowler });
    }
  }
  return out;
}

const OBJECTIVES = [
  { id:"capture",  text:"Capture a monster",             icon:"", ok:p => p.some(q => q.Capture) },
  { id:"hyper",    text:"Clear a Hyper quest",           icon:"assets/MonsterIcons/MHGU-Hyper_Monster_Icon.png", ok:p => p.some(q => q.Hyper) },
  { id:"egg",      text:"Clear an Egg Delivery",         icon:"assets/MonsterIcons/MHGU-Egg_Quest_Icon.webp", ok:p => p.some(q => q.Egg) },
  { id:"gather",   text:"Clear a Gathering quest",       icon:"assets/MonsterIcons/MHGU-Wycademy_Quest_Icon.png", ok:p => p.some(q => q.Gathering) },
  { id:"small",    text:"Clear a Small Monster quest",   icon:"", ok:p => p.some(q => q.SmMonsters) },
  { id:"key",      text:"Clear a Key quest",             icon:"", ok:p => p.some(q => q.Key) },
  { id:"sp",       text:"Clear a Special Permit",        icon:"", ok:p => p.some(q => q.Type === "Special Permits") },
  { id:"arena",    text:"Clear an Arena quest",          icon:"", ok:p => p.some(q => q.Type === "Arena") },
  { id:"event",    text:"Clear an Event quest",          icon:"", ok:p => p.some(q => q.Type === "Events") },
  { id:"prowler",  text:"Clear a quest as a Prowler",    icon:"", ok:p => p.some(q => q.Prowler) },
  { id:"onefaint", text:"Clear a One-Faint quest",       icon:"", ok:p => p.some(q => q.OneFaint) },
  { id:"onsite",   text:"Clear an On-Site Items quest",  icon:"", ok:p => p.some(q => q.OnSite) },
  { id:"multi",    text:"Clear a Multi-Monster quest",   icon:"", ok:p => p.some(q => q.Monsters && q.Monsters.length > 1) },
  { id:"nofaint",  text:"Clear a quest without fainting",icon:"", ok:() => true },
];
const objectiveGoals = (pool) => OBJECTIVES.filter(o => o.ok(pool))
  .map(o => ({ key: "o:" + o.id, cat: "objective", text: o.text, sub: "", icon: o.icon, tint: POOL_COLORS.objective }));

const customGoals = (customPool) => customPool.filter(c => c.checked && c.text.trim())
  .map(c => ({ key: "c:" + c.text, cat: "custom", text: c.text, sub: "", icon: "",
               tint: POOL_COLORS.custom, w: c.weight || 1 }));

const CATS = [
  { id:"monster",   items:(pool)       => monsterGoals(pool) },
  { id:"weapon",    items:(pool, f)    => weaponGoals(pool, f) },
  { id:"objective", items:(pool)       => objectiveGoals(pool) },
  { id:"custom",    items:(pool, f, cp) => customGoals(cp) },
];

// ── Card construction (mirrors docs/app.js) ──────────────────────────────────
function buildCells(rng, c, pool, f, customPool) {
  const n = c.size * c.size;
  const freeIdx = effFree(c) ? (n - 1) / 2 : -1;
  const need = n - (freeIdx >= 0 ? 1 : 0);
  const active = CATS.filter(x => (c.cats[x.id] | 0) > 0);

  const bags = {};
  for (const x of active) bags[x.id] = weightedShuffle(x.items(pool, f, customPool), rng);

  const used = new Set(), drawn = [];
  while (drawn.length < need) {
    const live = active.filter(x => bags[x.id].length);
    if (!live.length) break;
    const total = live.reduce((s, x) => s + c.cats[x.id], 0);
    let r = rng.next() * total, chosen = live[live.length - 1];
    for (const x of live) { r -= c.cats[x.id]; if (r < 0) { chosen = x; break; } }
    const goal = bags[chosen.id].pop();
    if (used.has(goal.key)) continue;
    used.add(goal.key);
    drawn.push(goal);
  }

  const cells = [];
  let di = 0;
  for (let i = 0; i < n; i++) {
    if (i === freeIdx) cells.push({ key: "free", cat: "free", text: "FREE", sub: "", icon: "", tint: POOL_COLORS.free });
    else if (di < drawn.length) cells.push(drawn[di++]);
    else cells.push({ key: "empty:" + i, cat: "empty", text: "—", sub: "", icon: "", tint: "" });
  }
  return { cells, freeIdx };
}

// Builds a card using the app's default settings. Pass a token to reproduce a specific
// card; omit it for a fresh one. Returns the same payload shape the app POSTs to /bingo.
export function generateCard(DATA, token) {
  const cfg = DEFAULT_CFG;
  const customPool = DEFAULT_POOL;
  const f = {
    ...DEFAULT_FLAGS,
    ranks: new Set(ALL_RANKS),
    includedMonsters: new Set(DATA.monsters.map(m => m.MonsterName.toLowerCase())),
    // Every monster is checked by default, so the per-monster gate is inactive.
    monsterFilterActive: false,
    weapons: WEAPONS,
    styles: STYLES,
    biases: BIAS_NAMES,
  };
  const pool = buildQuestPool(DATA, f);
  const tok = token || newToken();
  const body = seedBody(cfg, tok);
  const fp = b32(hashStr(fingerprint(DATA, f, customPool)), 4);
  // Seeded on the body only — never the fingerprint. See docs/app.js's generate().
  const built = buildCells(makeRng(body), cfg, pool, f, customPool);

  return {
    seed: body + "-" + fp,
    size: cfg.size,
    freeIdx: built.freeIdx,
    cells: built.cells.map(c => ({
      cat: c.cat, key: c.key, text: c.text, sub: c.sub || "", icon: c.icon || "", tint: c.tint || "",
    })),
  };
}
