"use strict";
(function () {
  const DATA = window.MHGU_DATA || { quests: [], arts: [], monsters: [] };
  const $ = (id) => document.getElementById(id);
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];

  // ── Static config (mirrors the desktop app) ──────────────────────────────
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

  const WEAPON_ABBREV = {
    "Great Sword":"GS","Long Sword":"LS","Sword & Shield":"SnS","Dual Blades":"DB",
    "Hammer":"Hammer","Hunting Horn":"HH","Lance":"Lance","Gunlance":"GL",
    "Switch Axe":"SA","Charge Blade":"CB","Insect Glaive":"IG",
    "Light Bowgun":"LBG","Heavy Bowgun":"HBG","Bow":"Bow",
  };

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
  const BIAS_FILE = Object.fromEntries(BIASES);

  // ── Blacklist ────────────────────────────────────────────────────────────
  // Each entry: {weapon, style}. When a weapon is rolled whose blacklisted styles
  // cover all available styles, the weapon itself is rerolled.
  let blacklist = [];
  const DEFAULT_CHALLENGES = [
    { text: "No Armor",         chance: 10, checked: false },
    { text: "No Items",         chance: 10, checked: false },
    { text: "No Active Skills", chance: 10, checked: false },
    { text: "Use Joke Weapon",  chance: 10, checked: false },
  ];
  let challenges = DEFAULT_CHALLENGES.map(c => Object.assign({}, c));
  let chaosMode = false;

  const DEVIANT_FULL = {
    redhelm:"Redhelm Arzuros", snowbaron:"Snowbaron Lagombi", stonefist:"Stonefist Hermitaur",
    dreadqueen:"Dreadqueen Rathian", drilltusk:"Drilltusk Tetsucabra", silverwind:"Silverwind Nargacuga",
    crystalbeard:"Crystalbeard Uragaan", deadeye:"Deadeye Yian Garuga", dreadking:"Dreadking Rathalos",
    thunderlord:"Thunderlord Zinogre", grimclaw:"Grimclaw Tigrex", hellblade:"Hellblade Glavenus",
    nightcloak:"Nightcloak Malfestio", rustrazor:"Rustrazor Ceanataur", soulseer:"Soulseer Mizutsune",
    boltreaver:"Boltreaver Astalos", elderfrost:"Elderfrost Gammoth", bloodbath:"Bloodbath Diablos",
  };

  const SP_TIERS = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,G1:11,G2:12,G3:13,G4:14,G5:15,EX:16};

  const LEVELS = {
    "ALL": [
      ["Village 1★",0],["Village 2★",1],["Village 3★",2],["Village 4★",3],
      ["Village 5★",4],["Village 6★",5],["Village 7★",6],["Village 8★",7],
      ["Village 9★",8],["Village 10★",9],["Village 10★ Adv.",10],
      ["Hub 1★",11],["Hub 2★",12],["Hub 3★",13],["Hub 4★",14],
      ["Hub 5★",15],["Hub 6★",16],["Hub 7★",17],["Hub 8★",18],
      ["G1★",19],["G2★",20],["G3★",21],["G4★",22],["G4★ HR13+",23],
      ["Deviant I",24],["Deviant II",25],["Deviant III",26],["Deviant IV",27],
      ["Deviant V",28],["Deviant VI",29],["Deviant VII",30],["Deviant VIII",31],
      ["Deviant IX",32],["Deviant X",33],["Deviant G1",34],["Deviant G2",35],
      ["Deviant G3",36],["Deviant G4",37],["Deviant G5",38],["Deviant EX",39],
      ["Event Low Rank",40],["Event High Rank",41],["Event G Rank",42],
      ["Arena Normal",43],["Arena Challenge",44],
    ],
    Village: [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8],["9★",9],["10★",10],["10★ Advanced",11]],
    Hub:     [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8]],
    Pub:     [["G1★",1],["G2★",2],["G3★",3],["G4★",4],["G4★ (HR13+)",5]],
    Arena:   [["Normal",1],["Challenge",2]],
    "Special Permits": [["I",1],["II",2],["III",3],["IV",4],["V",5],["VI",6],["VII",7],["VIII",8],["IX",9],["X",10],["G1",11],["G2",12],["G3",13],["G4",14],["G5",15],["EX",16]],
    Events:  [["Low Rank",1],["High Rank",2],["G Rank",3]],
  };

  // Theme colors — each named after the monster assigned to that hue in the theme picker.
  // Ordered chromatically: hue 0°→360°, dark→light within each hue; earth tones; neutrals dark→light; white.
  const COLORS = [
    ["Teostra","#570B0B"],["Rathalos","#b51717"], // red ~0°
    ["Tetsucabra","#c65900"], ["Agnaktor","#fc933e"],  // orange ~30°
    ["Tigrex","#C8A319"],["Rajang","#f1d364"],                       // amber ~47°
    ["Deviljho","#0B570F"],["Rathian","#3a9b3f"],    // green ~124°
    ["Astalos","#14503d"], ["Zinogre","#2dae85"],
    ["Zamtrios","#005984"], ["Plesioth","#0080c1"],                                        // sky blue ~204°
    ["Brachydios","#0B2757"],["Lagiacrus","#0b3f97"],  // cobalt ~222°
    ["G. Magala","#1F0B57","Gore Magala"],["Nerscylla","#4e2fa2"],    // indigo ~256°
    ["Y. Garuga","#62008f","Yian Garuga"],["Chameleos","#8e50ab"],                          // violet ~298°
    ["Mizutsune","#D84696"],["Congalala","#ce79a8"],                                        // pink ~327°
    ["Duramboros","#5a411f"],["Diablos","#997c54"],
    ["Barroth","#B57C45"],["Bulldrome","#cfaa87"], 
    ["K. Daora","#505358","Kushala Daora"],["Valstrax","#aeb5c1"],  // neutrals dark→light
    ["Forbidden","#1E2025","Question Mark"],["Gypceros","#FFFFFF"],                                                                  // white
  ];
  const COLORS_HEX = Object.fromEntries(COLORS.map(([name, hex]) => [hex.toUpperCase(), name]));
  // Display name → icon name override (for swatches with shortened labels)
  const COLORS_ICON = Object.fromEntries(COLORS.filter(c => c[2]).map(([name,,icon]) => [name, icon]));

  // ── Icon path helpers ────────────────────────────────────────────────────
  const monsterIcon = (name) => name
    ? "assets/MonsterIcons/MHGU-" + name.replace(/ /g, "_") + "_Icon.webp"
    : FALLBACK_ICON;
  const FALLBACK_ICON = "assets/MonsterIcons/MHGU-Question_Mark_Icon.webp";
  const weaponIcon = (w) => "assets/WeaponIcons/icon_" +
    w.toLowerCase().replace(/ & /g, "_and_").replace(/ /g, "_") + "_tinted.png";
  const prowlerIcon = (f) => "assets/ProwlerIcons/" + f;

  // ── Special Permits parsing ──────────────────────────────────────────────
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

  function typeValToAllRank(type, val) {
    switch (type) {
      case "Village":         return val - 1;
      case "Hub":             return 10 + val;
      case "Pub":             return 18 + val;
      case "Special Permits": return 23 + val;
      case "Events":          return 39 + val;
      case "Arena":           return 42 + val;
      case "ALL":             return val;
      default:                return -1;
    }
  }

  // ── Hunter arts ──────────────────────────────────────────────────────────
  // Arts list uses "Sword and Shield"; weapon list uses "Sword & Shield" — normalize.
  const normWeapon = (w) => w.toLowerCase().replace(/ & /g, " and ");
  // Strip a trailing level suffix so "Haste Rain I" and "Haste Rain III" compare equal —
  // the same art can't be equipped at two levels.
  const artBase = (n) => n.replace(/ (III|II|I)$/, "");
  // Parse a small monster name from quest objective for icon lookup.
  const smMonsterName = (main) => {
    if (!main) return "";
    const KEEP_S = new Set(["Cephalos"]);
    const depl = (n) => KEEP_S.has(n) ? n : n.replace(/xes$/, "x").replace(/s$/, "");
    // "Slay/Defeat a total of N MonsterA or/and MonsterB" → first monster
    let m = main.match(/(?:Slay|Defeat) a total of \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) return depl(m[1]);
    // "Slay N Name" — capital letter excludes "before time expires" etc.
    m = main.match(/Slay \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) return depl(m[1]);
    return "";
  };
  // Pick the quest-category icon for gathering/egg quests based on the delivered item keyword.
  function gatheringIcon(main) {
    const m = (main || "").toLowerCase();
    if (m.includes("egg"))                                                                           return "assets/MonsterIcons/MHGU-Egg_Quest_Icon.webp";
    if (m.includes("mushroom"))                                                                      return "assets/MonsterIcons/MHGU-Mushroom_Quest_Icon.webp";
    if (m.includes("fish") || m.includes("sashimi") || m.includes("piscine"))                       return "assets/MonsterIcons/MHGU-Fish_Quest_Icon.webp";
    if (m.includes("moth") || m.includes("cricket") || m.includes("rhino") || m.includes("honey")) return "assets/MonsterIcons/MHGU-Bug_Quest_Icon.webp";
    if (m.includes("ore") || m.includes("coal") || m.includes("stone") || m.includes("chunk") || m.includes("rock")) return "assets/MonsterIcons/MHGU-Ore_Quest_Icon.webp";
    if (m.includes("bone") || m.includes("fossil") || m.includes("amber") || m.includes("shell") ||
        m.includes("horn") || m.includes("brain") || m.includes("husk") || m.includes("gut")  ||
        m.includes("tongue") || m.includes("liver") || m.includes("oil") || m.includes("fur"))      return "assets/MonsterIcons/MHGU-Bone_Quest_Icon.webp";
    return "assets/MonsterIcons/MHGU-Wycademy_Quest_Icon.png";
  }
  function rollArt(weapon, ex1, ex2, excl) {
    const wn = normWeapon(weapon);
    const b1 = ex1 ? artBase(ex1) : null, b2 = ex2 ? artBase(ex2) : null;
    for (let i = 0; i < 1000; i++) {
      const a = DATA.arts[rand(DATA.arts.length)];
      if (excl && excl.has(a.HunterArtName)) continue;
      const aw = a.Weapon.toLowerCase();
      if (aw !== "all" && aw !== wn) continue;
      const b = artBase(a.HunterArtName);
      if (b === b1 || b === b2) continue;
      return a.HunterArtName;
    }
    return null;
  }
  const maybeSP = (art) => !art ? "" : ($("f_spArts").checked && Math.random() < 1/3 ? art + " SP" : art);

  // ── DOM build: weapons / styles / biases ─────────────────────────────────
  function buildChecklist(container, items, idPrefix, withIcon) {
    container.innerHTML = "";
    items.forEach((name, i) => {
      const id = idPrefix + i;
      const label = document.createElement("label");
      label.className = "chk";
      let inner = `<input type="checkbox" id="${id}" data-name="${name}" checked>`;
      if (withIcon) inner += `<img class="wicon" src="${weaponIcon(name)}" alt="">`;
      inner += escapeHtml(name);
      label.innerHTML = inner;
      container.appendChild(label);
    });
  }
  function escapeHtml(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

  buildChecklist($("weaponList"), WEAPONS, "w_", true);
  buildChecklist($("styleList"), STYLES, "s_", false);

  // Blacklist UI
  function renderBlacklist() {
    const el = $("blList"); el.innerHTML = "";
    if (!blacklist.length) {
      el.innerHTML = '<p class="hint" style="margin:0">No restrictions added yet.</p>';
      return;
    }
    blacklist.forEach((b, i) => {
      const row = document.createElement("div"); row.className = "bl-tag";
      row.innerHTML = `<span>${escapeHtml(WEAPON_ABBREV[b.weapon] || b.weapon)} + ${escapeHtml(b.style)}</span>` +
        `<button data-i="${i}" title="Remove" aria-label="Remove">×</button>`;
      row.querySelector("button").addEventListener("click", () => {
        blacklist.splice(i, 1); renderBlacklist(); saveFilters();
      });
      el.appendChild(row);
    });
  }
  (function initBlacklist() {
    const wSel = $("blWeapon"), sSel = $("blStyle");
    WEAPONS.forEach(w => wSel.add(new Option(WEAPON_ABBREV[w] || w, w)));
    STYLES.forEach(s => sSel.add(new Option(s, s)));
    $("blAdd").addEventListener("click", () => {
      const w = wSel.value, s = sSel.value;
      if (!w || !s) return;
      if (!blacklist.some(b => b.weapon === w && b.style === s)) {
        blacklist.push({ weapon: w, style: s });
        renderBlacklist();
        saveFilters();
      }
    });
    renderBlacklist();
  })();

  // Challenges UI
  function renderChallenges() {
    const el = $("chList"); el.innerHTML = "";
    if (!challenges.length) {
      el.innerHTML = '<p class="hint" style="margin:0">No conditions added yet.</p>';
      return;
    }
    challenges.forEach((c, i) => {
      const row = document.createElement("div"); row.className = "bl-tag";

      const chk = document.createElement("label"); chk.className = "chk"; chk.style.flexShrink = "0";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = c.checked !== false;
      cb.disabled = chaosMode;
      chk.appendChild(cb);

      const txt = document.createElement("input"); txt.type = "text"; txt.className = "ch-edit-text";
      txt.value = c.text; txt.maxLength = 21;
      if (c.checked === false) txt.style.opacity = ".45";

      const num = document.createElement("input"); num.type = "number"; num.className = "ch-edit-chance";
      num.value = c.chance; num.min = 1; num.max = 100;

      const pct = document.createElement("span"); pct.className = "ch-pct"; pct.textContent = "%";

      const btn = document.createElement("button"); btn.title = "Remove"; btn.setAttribute("aria-label", "Remove"); btn.textContent = "×";

      cb.addEventListener("change", function() {
        challenges[i].checked = this.checked; saveFilters();
        txt.style.opacity = this.checked ? "" : ".45";
      });
      txt.addEventListener("change", function() {
        const v = this.value.trim();
        if (v) { challenges[i].text = v; saveFilters(); }
        else this.value = challenges[i].text;
      });
      num.addEventListener("change", function() {
        const v = Math.min(100, Math.max(1, parseInt(this.value) || 1));
        this.value = v; challenges[i].chance = v; saveFilters();
      });
      btn.addEventListener("click", () => {
        challenges.splice(i, 1); renderChallenges(); saveFilters();
      });

      row.append(chk, txt, num, pct, btn);
      el.appendChild(row);
    });
  }
  (function initChallenges() {
    $("chAdd").addEventListener("click", () => {
      const text = $("chText").value.trim();
      const chance = Math.min(100, Math.max(1, parseInt($("chChance").value) || 10));
      if (!text) return;
      challenges.push({ checked: false, text, chance });
      renderChallenges();
      saveFilters();
      $("chText").value = "";
    });
    $("chText").addEventListener("keydown", e => { if (e.key === "Enter") $("chAdd").click(); });
    $("chChaosMode").addEventListener("change", function() {
      chaosMode = this.checked;
      renderChallenges();
      saveFilters();
    });
    renderChallenges();
  })();
  // Rolls each enabled challenge against its own chance %, then keeps a random subset
  // capped at the user's "roll up to N" count. Disabled conditions never roll.
  // In Chaos Mode, a hidden -20..+20% base roll is blended into each condition's own
  // chance to decide its checked state for this roll instead of reading the manual
  // checkbox; the condition still needs to pass its own chance-roll on top of that.
  function rollChallenges() {
    if (!challenges.length) return [];
    const count = Math.min(8, Math.max(1, parseInt($("challengeCount").value) || 1));
    let eligible;
    if (chaosMode) {
      const baseChaos = (Math.random() * 40) - 20;
      const chaosChecked = challenges.map(c => Math.random() * 100 < Math.max(0, Math.min(100, baseChaos + c.chance)));
      syncChaosCheckboxes(chaosChecked);
      eligible = challenges.filter((c, i) => chaosChecked[i] && Math.random() * 100 < c.chance);
    } else {
      eligible = challenges.filter(c => c.checked === true && Math.random() * 100 < c.chance);
    }
    eligible.sort(() => Math.random() - 0.5);
    return eligible.slice(0, count);
  }
  // Chaos-mode-only visual preview: flips each row's checkbox/opacity to reflect this
  // roll's RNG decision. Never writes to challenges[i].checked and never calls
  // saveFilters() — the user's real saved preference is untouched underneath.
  function syncChaosCheckboxes(chaosChecked) {
    const rows = $("chList").querySelectorAll(".bl-tag");
    rows.forEach((row, i) => {
      if (i >= chaosChecked.length) return;
      const cb = row.querySelector(".chk input");
      const txt = row.querySelector(".ch-edit-text");
      if (cb) cb.checked = chaosChecked[i];
      if (txt) txt.style.opacity = chaosChecked[i] ? "" : ".45";
    });
  }
  // Biases (default ON)
  (function () {
    const c = $("biasList"); c.innerHTML = "";
    BIASES.forEach(([name, file], i) => {
      const label = document.createElement("label");
      label.className = "chk";
      label.innerHTML = `<input type="checkbox" id="b_${i}" data-name="${name}" checked>` +
        `<img class="wicon" src="${prowlerIcon(file)}" alt="">${name}`;
      c.appendChild(label);
    });
  })();

  // ── Monster tree ─────────────────────────────────────────────────────────
  const monsterChecks = []; // {input, name}
  (function buildTree() {
    const tree = $("monsterTree");
    const bySpecies = {};
    DATA.monsters.forEach(m => { (bySpecies[m.Species] = bySpecies[m.Species] || []).push(m.MonsterName); });
    Object.keys(bySpecies).sort().forEach(species => {
      const wrap = document.createElement("div");
      wrap.className = "species";
      const head = document.createElement("div");
      head.className = "grphead";
      const twist = document.createElement("span"); twist.className = "twist"; twist.textContent = "▸";
      const spInput = document.createElement("input"); spInput.type = "checkbox"; spInput.className = "sp"; spInput.checked = true;
      const nameEl = document.createElement("span"); nameEl.className = "grp-name"; nameEl.textContent = species;
      head.appendChild(twist); head.appendChild(spInput); head.appendChild(nameEl);
      // Clicking the group name (or twist) expands/collapses; the checkbox still toggles selection.
      const toggleOpen = () => { wrap.classList.toggle("open"); twist.textContent = wrap.classList.contains("open") ? "▾" : "▸"; };
      twist.addEventListener("click", toggleOpen);
      nameEl.addEventListener("click", toggleOpen);
      const children = document.createElement("div");
      children.className = "children";
      const childInputs = [];
      bySpecies[species].sort().forEach(name => {
        const cl = document.createElement("label");
        cl.className = "chk";
        cl.innerHTML = `<input type="checkbox" checked>${escapeHtml(name)}`;
        const input = cl.querySelector("input");
        input.dataset.name = name;
        childInputs.push(input);
        monsterChecks.push({ input, name });
        input.addEventListener("change", () => {
          const n = childInputs.filter(i => i.checked).length;
          spInput.checked = n === childInputs.length;
          spInput.indeterminate = n > 0 && n < childInputs.length;
          updateRollBtn();
        });
        children.appendChild(cl);
      });
      spInput.addEventListener("change", () => {
        childInputs.forEach(i => i.checked = spInput.checked);
        spInput.indeterminate = false;
        updateRollBtn();
      });
      wrap.appendChild(head); wrap.appendChild(children);
      tree.appendChild(wrap);
    });
  })();
  const includedMonsters = () => new Set(monsterChecks.filter(m => m.input.checked).map(m => m.name.toLowerCase()));
  function setAllMonsters(v) {
    document.querySelectorAll("#monsterTree input").forEach(i => { i.checked = v; i.indeterminate = false; });
    updateRollBtn();
    saveFilters();
  }

  // ── Hunter Arts tree (3-level: Weapon → Art → Levels) ─────────────────────
  const artLeaves = [];   // {input, name}
  const artGroups = [];   // {input, leaves:[leafInput,...]}  (weapon and base-art groups)
  let artSyncing = false;
  function refreshArtGroups() {
    for (const g of artGroups) {
      const on = g.leaves.filter(l => l.checked).length;
      g.input.checked = on === g.leaves.length;
      g.input.indeterminate = on > 0 && on < g.leaves.length;
    }
  }
  function onArtLeaf() { if (artSyncing) return; artSyncing = true; refreshArtGroups(); artSyncing = false; }
  function onArtGroup(g) {
    if (artSyncing) return;
    artSyncing = true;
    g.leaves.forEach(l => l.checked = g.input.checked);
    refreshArtGroups();
    artSyncing = false;
  }
  const excludedArts = () => new Set(artLeaves.filter(l => !l.input.checked).map(l => l.name));
  function setAllArts(v) { artLeaves.forEach(l => l.input.checked = v); refreshArtGroups(); saveFilters(); }
  (function buildArtTree() {
    const tree = $("artTree");
    function leafEl(name) {
      const lbl = document.createElement("label"); lbl.className = "chk";
      lbl.innerHTML = `<input type="checkbox" checked>${escapeHtml(name)}`;
      const input = lbl.querySelector("input"); input.dataset.name = name;
      input.addEventListener("change", onArtLeaf);
      artLeaves.push({ input, name });
      return { el: lbl, input };
    }
    function groupEl(label) {
      const wrap = document.createElement("div"); wrap.className = "agrp";
      const head = document.createElement("div"); head.className = "ahead";
      const tw = document.createElement("span"); tw.className = "twist"; tw.textContent = "▸";
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = true;
      const nameEl = document.createElement("span"); nameEl.className = "grp-name"; nameEl.textContent = label;
      // Clicking the group name (or twist) expands/collapses; the checkbox still toggles selection.
      const toggleOpen = () => { wrap.classList.toggle("open"); tw.textContent = wrap.classList.contains("open") ? "▾" : "▸"; };
      tw.addEventListener("click", toggleOpen);
      nameEl.addEventListener("click", toggleOpen);
      head.appendChild(tw); head.appendChild(input); head.appendChild(nameEl);
      const kids = document.createElement("div"); kids.className = "akids";
      wrap.appendChild(head); wrap.appendChild(kids);
      return { wrap, input, kids };
    }
    const byW = {};
    DATA.arts.forEach(a => { (byW[a.Weapon] = byW[a.Weapon] || {}); const b = artBase(a.HunterArtName); (byW[a.Weapon][b] = byW[a.Weapon][b] || []).push(a.HunterArtName); });
    const WPN_ORDER = ["Great Sword","Long Sword","Sword and Shield","Dual Blades","Hammer","Hunting Horn","Lance","Gunlance","Switch Axe","Charge Blade","Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"];
    const weapons = Object.keys(byW).sort((x, y) => x === "All" ? -1 : y === "All" ? 1 : WPN_ORDER.indexOf(x) - WPN_ORDER.indexOf(y));
    for (const w of weapons) {
      const wg = groupEl(w);
      const wLeaves = [];
      for (const b of Object.keys(byW[w]).sort()) {
        const fulls = byW[w][b].slice().sort();
        if (fulls.length === 1) {
          const lf = leafEl(fulls[0]); wg.kids.appendChild(lf.el); wLeaves.push(lf.input);
        } else {
          const bg = groupEl(b); const bLeaves = [];
          for (const f of fulls) { const lf = leafEl(f); bg.kids.appendChild(lf.el); bLeaves.push(lf.input); wLeaves.push(lf.input); }
          const grp = { input: bg.input, leaves: bLeaves };
          artGroups.push(grp); bg.input.addEventListener("change", () => onArtGroup(grp));
          wg.kids.appendChild(bg.wrap);
        }
      }
      const wgrp = { input: wg.input, leaves: wLeaves };
      artGroups.push(wgrp); wg.input.addEventListener("change", () => onArtGroup(wgrp));
      tree.appendChild(wg.wrap);
    }
    refreshArtGroups();
  })();

  // ── Level dropdowns ──────────────────────────────────────────────────────
  function fillLevels() {
    const type = $("questType").value;
    let opts = LEVELS[type] || [];
    opts = opts.filter(([, val]) => {
      const rank = typeValToAllRank(type, val);
      if (rank < 0) return true;
      const cb = $("f_all_lv_" + rank);
      return !cb || cb.checked;
    });
    const from = $("fromLevel"), to = $("toLevel");
    from.innerHTML = ""; to.innerHTML = "";
    opts.forEach(([lbl, val]) => {
      from.add(new Option(lbl, val));
      to.add(new Option(lbl, val));
    });
    from.selectedIndex = 0;
    $("fromField").classList.remove("hidden");
    $("toLabel").textContent = "Up to Level";
    to.selectedIndex = Math.max(0, opts.length - 1);
    updateRollBtn();
  }

  function syncTypeOptions() {
    const qt = $("questType");
    for (const opt of Array.from(qt.options)) {
      if (!opt.value || opt.value === "ALL") continue;
      const anyOn = (LEVELS[opt.value] || []).some(([, val]) => {
        const rank = typeValToAllRank(opt.value, val);
        if (rank < 0) return true;
        const cb = $("f_all_lv_" + rank);
        return cb && cb.checked;
      });
      opt.hidden = !anyOn;
    }
    const sel = qt.selectedIndex >= 0 ? qt.options[qt.selectedIndex] : null;
    if (sel && sel.hidden) { qt.value = ""; fillLevels(); }
  }

  // Keep From ≤ To (compared by list position, same ordered options in both).
  function syncLevels(changed) {
    const from = $("fromLevel"), to = $("toLevel");
    if (from.selectedIndex < 0 || to.selectedIndex < 0) { updateRollBtn(); return; }
    if (changed === "from" && from.selectedIndex > to.selectedIndex) to.selectedIndex = from.selectedIndex;
    if (changed === "to" && to.selectedIndex < from.selectedIndex) from.selectedIndex = to.selectedIndex;
    updateRollBtn();
  }

  // ── Enable/disable Randomize ─────────────────────────────────────────────
  const anyChecked = (sel) => Array.from(document.querySelectorAll(sel)).some(i => i.checked);
  function updateRollBtn() {
    const hasType = !!$("questType").value;
    const hasLevel = $("toLevel").value !== "";
    const isArena = $("questType").value === "Arena";
    const hasWeapon = isArena || anyChecked("#weaponList input");
    const hasStyle = isArena || anyChecked("#styleList input");
    const hasMonster = monsterChecks.some(m => m.input.checked);
    const biasOk = !$("p_prowler").checked || anyChecked("#biasList input");
    $("rollBtn").disabled = !(hasType && hasLevel && hasWeapon && hasStyle && hasMonster && biasOk);
  }

  // ── Randomize ────────────────────────────────────────────────────────────
  function randomize() {
    const type = $("questType").value;
    const toLv = parseInt($("toLevel").value, 10);
    const fromLv = $("fromLevel").value !== "" ? parseInt($("fromLevel").value, 10) : toLv;
    const inc = includedMonsters();
    const anyFiltered = inc.size < DATA.monsters.length;

    const f = {
      pQuests: $("p_quests").checked, large: $("f_large").checked,
      hyper: $("f_hyper").checked, capture: $("f_capture").checked,
      egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
      multi: $("f_multi").checked,
      oneFaint: $("f_oneFaint").checked, onSite: $("f_onSite").checked,
      allLevels: new Set(Array.from({length:45},(_,i)=>i).filter(i=>{ const cb=$("f_all_lv_"+i); return cb&&cb.checked; })),
    };

    const pool = DATA.quests.filter(q => {
      const qType = q.Type || "";

      const rank = allRank(q);
      if (rank < 0 || !f.allLevels.has(rank)) return false;

      // ALL mode ranges over the unified 0–44 rank; a specific type ranges over that
      // type's own 1-based Level (fromLv/toLv are read in whichever space applies).
      if (type === "ALL") {
        if (rank < fromLv || rank > toLv) return false;
      } else {
        if (qType.toLowerCase() !== type.toLowerCase()) return false;
        if (q.Level < fromLv || q.Level > toLv) return false;
      }

      if (q.LgMonster && !f.large) return false;

      const include = (q.LgMonster && !q.Capture)
        || (q.Capture && f.capture)
        || (q.Prowler && f.pQuests) || (q.Hyper && f.hyper)
        || (q.Egg && f.egg) || (q.Gathering && f.gathering) || (q.SmMonsters && f.small);
      if (!include) return false;

      // Gate flags: unchecked = exclude quests of that type (same pattern for all three).
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

    const quest = pool.length ? pick(pool) : {};
    renderResult(quest, type);
  }

  function setWeaponStyle(el, name) {
    const wHex = WEAPON_COLORS[name];
    el.style.cssText = "";
    if (wHex) {
      el.style.color = "#fff";
      el.style.textShadow = "-1px 0 rgba(0,0,0,0.55), 1px 0 rgba(0,0,0,0.55), 0 -1px rgba(0,0,0,0.55), 0 1px rgba(0,0,0,0.55)";
      el.style.background = wHex;
      el.style.padding = "3px 14px";
      el.style.borderRadius = "999px";
      el.style.display = "inline-block";
    } else {
      el.style.color = "var(--text)";
    }
  }

  function renderResult(quest, type) {
    $("placeholder").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("r_name").textContent = quest.Name || "";
    $("r_name").style.color = (quest.Type === "Special Permits" && / EX: /.test(quest.Name)) ? "#ff00ff" : "";
    $("r_main").textContent = quest.Main || "";
    $("r_locale").textContent = quest.Locale || "—";
    const isDeviant = quest.Type === "Special Permits";
    const isMultiMonster = quest.Monsters && quest.Monsters.length > 1;
    $("r_huntPill").classList.toggle("hidden", !quest.LgMonster || quest.Capture || quest.Type === "Special Permits");
    $("r_smPill").classList.toggle("hidden", !quest.SmMonsters);
    $("r_eggPill").classList.toggle("hidden", !quest.Egg);
    $("r_gatheringPill").classList.toggle("hidden", !quest.Gathering);
    $("r_spPill").classList.toggle("hidden", quest.Type !== "Special Permits");
    $("r_capturePill").classList.toggle("hidden", !quest.Capture);
    $("r_hyperPill").classList.toggle("hidden", !quest.Hyper);
    $("r_prowlerPill").classList.toggle("hidden", !quest.Prowler);
    $("r_arenaPill").classList.toggle("hidden", quest.Type !== "Arena");
    $("r_eventPill").classList.toggle("hidden", quest.Type !== "Events");
    $("r_hyperOverlay").classList.toggle("hidden", !quest.Hyper || isDeviant || isMultiMonster);

    const iconMonster = (quest.Type === "Special Permits" && quest.Name)
      ? spDeviant(quest.Name, quest.Monster)
      : (quest.Monster || (quest.SmMonsters ? smMonsterName(quest.Main) : ""));
    const img = $("r_target");
    img.src = (quest.Egg || quest.Gathering)
      ? gatheringIcon(quest.Main)
      : monsterIcon(iconMonster);
    img.onerror = () => { img.onerror = null; img.src = FALLBACK_ICON; };
    // Stashed for Copy to Clipboard — lists every monster for multi-monster quests,
    // else falls back to the single resolved name used for the icon (empty for
    // gathering/egg quests, which have no target monster).
    img.dataset.monsters = (quest.Monsters && quest.Monsters.length) ? quest.Monsters.join(", ") : iconMonster;

    // Arena: preset equipment sets from the quest description. Hunter arenas offer a
    // fixed weapon list; Prowler arenas a fixed bias list. Roll within the set; style
    // and arts are part of the set, so we don't roll them.
    if (type === "Arena" || quest.Type === "Arena") {
      const w = $("r_weapon");
      $("r_arts").innerHTML = "";
      if (quest.ArenaBiases && quest.ArenaBiases.length) {
        const bias = pick(quest.ArenaBiases);
        w.textContent = "Prowler"; setWeaponStyle(w, "Prowler");
        $("r_weaponIcon").classList.add("hidden");
        $("r_styleBlock").classList.remove("hidden");
        $("r_styleLabel").textContent = "Bias";
        $("r_style").textContent = bias;
        const bi = $("r_biasIcon");
        if (BIAS_FILE[bias]) { bi.src = prowlerIcon(BIAS_FILE[bias]); bi.classList.remove("hidden"); }
        else bi.classList.add("hidden");
      } else if (quest.ArenaWeapons && quest.ArenaWeapons.length) {
        const weapon = pick(quest.ArenaWeapons);
        w.textContent = weapon; setWeaponStyle(w, weapon);
        const wi = $("r_weaponIcon");
        wi.classList.remove("hidden"); wi.src = weaponIcon(weapon);
        wi.onerror = () => { wi.onerror = null; wi.classList.add("hidden"); };
        $("r_styleBlock").classList.add("hidden");
      } else {
        w.textContent = "Set " + (1 + rand(5)); w.style.color = "var(--text)";
        $("r_weaponIcon").classList.add("hidden");
        $("r_styleBlock").classList.add("hidden");
      }
      broadcastResult();
      return;
    }
    $("r_styleBlock").classList.remove("hidden");

    // Weapon
    let weapon;
    if (quest.Prowler) {
      weapon = "Prowler";
    } else {
      const chosen = Array.from(document.querySelectorAll("#weaponList input"))
        .filter(i => i.checked).map(i => i.dataset.name);
      if ($("p_prowler").checked) chosen.push("Prowler");
      weapon = chosen.length ? pick(chosen) : "Great Sword";
      // Reroll weapon if the blacklist blocks all available styles for it
      if (weapon !== "Prowler" && blacklist.length) {
        const baseStyles = STYLES.filter((_, i) => $("s_" + i).checked);
        for (let t = 0; t < 50; t++) {
          const blS = new Set(blacklist.filter(b => b.weapon === weapon).map(b => b.style));
          if (baseStyles.some(s => !blS.has(s))) break;
          weapon = chosen.length ? pick(chosen) : "Great Sword";
        }
      }
    }
    const wEl = $("r_weapon");
    wEl.textContent = weapon;
    setWeaponStyle(wEl, weapon);
    const wIcon = $("r_weaponIcon");
    if (weapon === "Prowler") { wIcon.classList.add("hidden"); }
    else {
      wIcon.classList.remove("hidden");
      wIcon.src = weaponIcon(weapon);
      wIcon.onerror = () => { wIcon.onerror = null; wIcon.classList.add("hidden"); };
    }

    const biasIcon = $("r_biasIcon"), arts = $("r_arts"), styleLabel = $("r_styleLabel"), styleEl = $("r_style");
    arts.innerHTML = "";

    if (weapon === "Prowler") {
      let avail = BIASES.filter((_, i) => $("b_" + i).checked);
      if (!avail.length) avail = [BIASES[0]];
      const [name, file] = pick(avail);
      styleLabel.textContent = "Bias";
      styleEl.textContent = name;
      biasIcon.src = prowlerIcon(file);
      biasIcon.classList.remove("hidden");
    } else {
      biasIcon.classList.add("hidden");
      let styles = STYLES.filter((_, i) => $("s_" + i).checked);
      const blS = new Set(blacklist.filter(b => b.weapon === weapon).map(b => b.style));
      const filtered = styles.filter(s => !blS.has(s));
      if (filtered.length) styles = filtered;
      if (!styles.length) styles = ["Guild"];
      const style = pick(styles);
      styleLabel.textContent = "Style";
      styleEl.textContent = style;

      // Slot count by style: Alchemy/Striker = 3, Guild = 2, everything else = 1.
      // SP rule mirrors the game: Alchemy may SP every art independently, but Guild and
      // Striker allow at most ONE SP art — so once an earlier art rolls SP, the rest skip
      // the SP roll (pass the plain art through instead of calling maybeSP again).
      const excl = excludedArts();
      let spPicks = [];
      if (style === "Alchemy") {
        const a = rollArt(weapon, null, null, excl), b = rollArt(weapon, a, null, excl), c = rollArt(weapon, a, b, excl);
        spPicks = [a, b, c].map(maybeSP);
      } else if (style === "Striker") {
        const a = rollArt(weapon, null, null, excl), b = rollArt(weapon, a, null, excl), c = rollArt(weapon, a, b, excl);
        const aSP = maybeSP(a);
        const bSP = aSP.endsWith(" SP") ? b : maybeSP(b);
        const cSP = (aSP.endsWith(" SP") || (bSP && bSP.endsWith(" SP"))) ? c : maybeSP(c);
        spPicks = [aSP, bSP, cSP];
      } else if (style === "Guild") {
        const a = rollArt(weapon, null, null, excl), b = rollArt(weapon, a, null, excl);
        const aSP = maybeSP(a);
        spPicks = [aSP, aSP.endsWith(" SP") ? b : maybeSP(b)];
      } else {
        spPicks = [maybeSP(rollArt(weapon, null, null, excl))];
      }
      spPicks.filter(Boolean).forEach(t => {
        const li = document.createElement("li"); li.textContent = t; arts.appendChild(li);
      });
    }
    // Roll challenges
    const rolled = rollChallenges();
    const chDiv  = $("r_challenges");
    const chList = $("r_challengeList");
    chList.innerHTML = "";
    rolled.forEach(c => {
      const li = document.createElement("li"); li.textContent = c.text; chList.appendChild(li);
    });
    chDiv.classList.toggle("hidden", rolled.length === 0);
    broadcastResult();
  }
  // Serializes the just-rendered #result DOM (not the quest object — the DOM already
  // reflects every roll decision) so the stream-view popup can mirror it via localStorage
  // and the "storage" event, which never fires back in this same window.
  function broadcastResult() {
    const pillIds = ["r_huntPill","r_smPill","r_eggPill","r_gatheringPill","r_spPill",
      "r_capturePill","r_hyperPill","r_prowlerPill","r_arenaPill","r_eventPill"];
    const data = {
      name: $("r_name").textContent, nameColor: $("r_name").style.color,
      main: $("r_main").textContent, locale: $("r_locale").textContent,
      pills: Object.fromEntries(pillIds.map(id => [id, $(id).classList.contains("hidden")])),
      targetSrc: $("r_target").src, hyperHidden: $("r_hyperOverlay").classList.contains("hidden"),
      weapon: $("r_weapon").textContent, weaponCss: $("r_weapon").style.cssText,
      weaponIconHidden: $("r_weaponIcon").classList.contains("hidden"), weaponIconSrc: $("r_weaponIcon").src,
      styleBlockHidden: $("r_styleBlock").classList.contains("hidden"),
      styleLabel: $("r_styleLabel").textContent, style: $("r_style").textContent,
      biasIconHidden: $("r_biasIcon").classList.contains("hidden"), biasIconSrc: $("r_biasIcon").src,
      arts: Array.from($("r_arts").children).map(li => li.textContent),
      challengesHidden: $("r_challenges").classList.contains("hidden"),
      challenges: Array.from($("r_challengeList").children).map(li => li.textContent),
    };
    try { localStorage.setItem("mhgu-last-result", JSON.stringify(data)); } catch (e) {}
  }

  $("copyResultBtn").addEventListener("click", () => {
    const name   = $("r_name").textContent;
    const monsters = $("r_target").dataset.monsters || "";
    const weapon = $("r_weapon").textContent;
    const styleHidden = $("r_styleBlock").classList.contains("hidden");
    const styleLabel  = $("r_styleLabel").textContent;
    const style       = $("r_style").textContent;
    const artItems    = Array.from($("r_arts").children).map(li => li.textContent);

    const chItems = Array.from($("r_challengeList").children).map(li => li.textContent);

    const lines = [`Quest: ${name}`];
    if (monsters) lines.push(`Monster: ${monsters}`);
    lines.push(`Locale: ${$("r_locale").textContent}`, `Weapon: ${weapon}`);
    if (!styleHidden) lines.push(`${styleLabel}: ${style}`);
    if (artItems.length) lines.push(`Hunter Art(s): ${artItems.join(" / ")}`);
    if (chItems.length) lines.push(`Challenges: ${chItems.join(", ")}`);

    navigator.clipboard.writeText(lines.join(" |\n")).then(() => {
      const btn = $("copyResultBtn");
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  });

  // ── Theme ────────────────────────────────────────────────────────────────
  const hexRgb = (h) => { h = h.replace("#",""); return [0,2,4].map(i => parseInt(h.substr(i,2),16)); };
  const clamp   = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    const l = (max + min) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2*l - 1));
    const h = max===r ? ((g-b)/d + (g<b?6:0))/6
            : max===g ? ((b-r)/d + 2)/6
            :           ((r-g)/d + 4)/6;
    return [h, s, l];
  };
  const hslToRgb = ([h, s, l]) => {
    const c = (1 - Math.abs(2*l - 1)) * s, x = c*(1 - Math.abs((h*6)%2 - 1)), m = l - c/2;
    const hi = Math.floor(h*6) % 6;
    const [r,g,b] = hi===0?[c,x,0]:hi===1?[x,c,0]:hi===2?[0,c,x]:hi===3?[0,x,c]:hi===4?[x,0,c]:[c,0,x];
    return [r+m, g+m, b+m].map(v => clamp(v*255));
  };
  // darken/lighten only nudge lightness in HSL space, so the hue and saturation of the
  // chosen theme color are preserved — every derived shade stays "in family."
  const darken     = (rgb, f) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l*f)]); };
  const lighten    = (rgb, b) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l+(1-l)*b)]); };
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    const bright = c[0]*0.299 + c[1]*0.587 + c[2]*0.114;
    const isLight = bright > 230;
    if (isLight) {
      r.setProperty("--bg", css(darken(c, .99)));
      r.setProperty("--bg1", css(darken(c, .99)));
      r.setProperty("--bg2", css(darken(c, .99)));
      r.setProperty("--hover", css(darken(c, .99)));
      r.setProperty("--accent", css(darken(c, .99)));
      r.setProperty("--accent-hover",css(lighten(c,0.1)));
      r.setProperty("--accent-color",css(darken(c,0.1)));
      r.setProperty("--titlebar-overlay", "rgba(0,0,0,0.02)");
    } else {
      r.setProperty("--bg",          css(darken(c,.70)));
      r.setProperty("--bg1",         css(darken(c,.80)));
      r.setProperty("--bg2",         css(darken(c,0.95)));
      r.setProperty("--hover",       css(darken(c,0.30)));
      r.setProperty("--accent",     css(darken(c,0.7)));
      r.setProperty("--accent-hover",css(darken(c,0.7)));
      r.setProperty("--titlebar-overlay", "rgba(0,0,0,0.18)");
    }
    r.setProperty("--text",     isLight ? "#000000" : "#ffffff");
    r.setProperty("--hint",     isLight ? "#000000" : "#ffffff");
    r.setProperty("--text-dim", isLight ? "#000000" : "#fffffff5");
    r.setProperty("--line",     isLight ? "rgba(0,0,0,0.15)" : "rgba(11, 8, 8, 0.12)");
    r.setProperty("--card",     isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)");
    try { localStorage.setItem("mhgu-theme", hex); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s.dataset.hex === hex));
    const titleIcon = document.querySelector(".title-icon");
    if (titleIcon) {
      const name = COLORS_HEX[hex.toUpperCase()];
      titleIcon.src = name ? monsterIcon(COLORS_ICON[name] || name) : FALLBACK_ICON;
    }
  }
  (function buildSwatches() {
    const wrap = $("swatches");
    COLORS.forEach(([name, hex]) => {
      const d = document.createElement("div");
      d.className = "swatch"; d.dataset.hex = hex; d.style.background = hex;
      d.title = name;
      d.innerHTML = `<img class="swatch-icon" src="${monsterIcon(COLORS_ICON[name] || name)}" alt=""><span>${name}</span>`;
      d.addEventListener("click", () => {
        applyTheme(hex);
        // Gypceros (white theme) clears the guild card background and closes the
        // Theme modal on active selection only — a busy background photo fights with
        // the bright theme. Scoped to the click handler (not inside applyTheme itself)
        // so restoring this theme on page load never silently wipes out a previously
        // saved background choice or auto-closes a modal the user didn't just open.
        if (hex.toUpperCase() === "#FFFFFF") {
          applyBg("");
          $("themeModal").classList.add("hidden");
        }
      });
      wrap.appendChild(d);
    });
  })();
  let saved = "#1E2025";
  try { saved = localStorage.getItem("mhgu-theme") || saved; } catch (e) {}
  applyTheme(saved);

  // ── Guild card background picker ─────────────────────────────────────────
  // Files are numbered sequentially 01-79 with no gaps (renumbered per the user's
  // curated Group1-6 ordering), so the list is generated rather than hardcoded.
  const GUILD_BG_FILES = Array.from({length: 79}, (_, i) => `HD_ui_guild_${String(i + 1).padStart(2, "0")}_ID.PNG`);
  // Bump whenever GuildCardBG image *content* changes (e.g. renumbering/regenerating
  // thumbnails) without the filenames themselves changing — otherwise browsers/CDN
  // keep serving old cached bytes at the same "HD_ui_guild_NN_ID" URL.
  const BG_ASSET_V = 2;
  // Flat colors for green-screen/chroma-key recording — requested by a user who wanted
  // to composite themselves over the app. Values, not filenames, so applyBg() branches
  // on a leading "#" to tell a solid color apart from a GuildCardBG image filename.
  const SOLID_BG_COLORS = [
    ["Digital Blue", "#0000FF"],
    ["Digital Green", "#00FF00"],
  ];
  function applyBg(value) {
    const el = document.querySelector(".content");
    if (!el) return;
    if (!value) {
      el.style.backgroundImage = ""; el.style.backgroundColor = "";
    } else if (value.startsWith("#")) {
      el.style.backgroundImage = ""; el.style.backgroundColor = value;
    } else {
      el.style.backgroundColor = "";
      const url = `assets/GuildCardBG/${encodeURIComponent(value)}?v=${BG_ASSET_V}`;
      const img = new Image();
      img.src = url;
      if (img.complete) {
        el.style.backgroundImage = `url('${url}')`;
      } else {
        img.onload = () => { el.style.backgroundImage = `url('${url}')`; };
      }
    }
    try { localStorage.setItem("mhgu-bg", value || ""); } catch (e) {}
    document.querySelectorAll(".bg-thumb").forEach(t => t.classList.toggle("sel", t.dataset.file === (value || "")));
  }
  (function buildBgGrid() {
    const grid = $("bgGrid");
    const none = document.createElement("div");
    none.className = "bg-thumb none-thumb"; none.dataset.file = "";
    none.textContent = "None";
    none.addEventListener("click", () => applyBg(""));
    grid.appendChild(none);
    GUILD_BG_FILES.forEach(f => {
      const thumbUrl = `assets/GuildCardBG/thumbs/${encodeURIComponent(f.replace(/\.PNG$/i, ".webp"))}?v=${BG_ASSET_V}`;
      const fullUrl  = `assets/GuildCardBG/${encodeURIComponent(f)}?v=${BG_ASSET_V}`;
      const d = document.createElement("div");
      d.className = "bg-thumb"; d.dataset.file = f;
      d.style.backgroundImage = `url('${thumbUrl}')`;
      d.addEventListener("mouseenter", () => { const p = new Image(); p.src = fullUrl; });
      d.addEventListener("click", () => applyBg(f));
      grid.appendChild(d);
    });
    SOLID_BG_COLORS.forEach(([name, hex]) => {
      const d = document.createElement("div");
      d.className = "bg-thumb"; d.dataset.file = hex;
      d.style.background = hex;
      d.title = name;
      d.addEventListener("click", () => applyBg(hex));
      grid.appendChild(d);
    });
  })();
  try { const savedBg = localStorage.getItem("mhgu-bg") || ""; if (savedBg) applyBg(savedBg); } catch (e) {}

  // ── Quest type / level filter tree ──────────────────────────────────────
  (function buildAllTypeTree() {
    const tree = $("allTypeTree");
    const ALL_GROUPS = [
      { label:"Village",         id:"village", levels:LEVELS.ALL.filter(([,v])=>v<=10),           on:true  },
      { label:"Hub",             id:"hub",     levels:LEVELS.ALL.filter(([,v])=>v>=11&&v<=18),     on:true  },
      { label:"G-Rank",          id:"pub",     levels:LEVELS.ALL.filter(([,v])=>v>=19&&v<=23),     on:true  },
      { label:"Special Permits", id:"sp",      levels:LEVELS.ALL.filter(([,v])=>v>=24&&v<=39),     on:true  },
      { label:"Events",          id:"events",  levels:LEVELS.ALL.filter(([,v])=>v>=40&&v<=42),     on:true  },
      { label:"Arena",           id:"arena",   levels:LEVELS.ALL.filter(([,v])=>v>=43),            on:false },
    ];
    for (const grp of ALL_GROUPS) {
      const wrap = document.createElement("div"); wrap.className = "agrp";
      const head = document.createElement("div"); head.className = "ahead";
      const tw = document.createElement("span"); tw.className = "twist"; tw.textContent = "▸";
      const grpInput = document.createElement("input"); grpInput.type = "checkbox";
      grpInput.id = "f_all_grp_" + grp.id; grpInput.checked = grp.on;
      const nameEl = document.createElement("span"); nameEl.className = "grp-name"; nameEl.textContent = grp.label;
      const toggleOpen = () => { wrap.classList.toggle("open"); tw.textContent = wrap.classList.contains("open") ? "▾" : "▸"; };
      tw.addEventListener("click", toggleOpen); nameEl.addEventListener("click", toggleOpen);
      head.appendChild(tw); head.appendChild(grpInput); head.appendChild(nameEl);
      const kids = document.createElement("div"); kids.className = "akids";
      const leafInputs = [];
      for (const [lbl, val] of grp.levels) {
        const lf = document.createElement("label"); lf.className = "chk";
        const input = document.createElement("input"); input.type = "checkbox";
        input.id = "f_all_lv_" + val; input.checked = grp.on;
        lf.appendChild(input); lf.appendChild(document.createTextNode(lbl));
        leafInputs.push(input);
        input.addEventListener("change", () => {
          const n = leafInputs.filter(i => i.checked).length;
          grpInput.checked = n === leafInputs.length;
          grpInput.indeterminate = n > 0 && n < leafInputs.length;
          fillLevels();
          syncTypeOptions();
        });
        kids.appendChild(lf);
      }
      grpInput.addEventListener("change", () => {
        leafInputs.forEach(i => i.checked = grpInput.checked);
        grpInput.indeterminate = false;
        fillLevels();
        syncTypeOptions();
      });
      wrap.appendChild(head); wrap.appendChild(kids);
      tree.appendChild(wrap);
    }
    syncTypeOptions();
  })();

  // ── Wiring ───────────────────────────────────────────────────────────────
  // Sidebar panels behave as an accordion: opening one closes all the others.
  document.querySelectorAll(".panel-head").forEach(h =>
    h.addEventListener("click", () => {
      const p = h.parentElement;
      const opening = p.dataset.open !== "true";
      document.querySelectorAll(".panel").forEach(panel => panel.dataset.open = "false");
      p.dataset.open = opening ? "true" : "false";
    }));
  $("questType").addEventListener("change", fillLevels);
  $("fromLevel").addEventListener("change", () => syncLevels("from"));
  $("toLevel").addEventListener("change", () => syncLevels("to"));
  document.querySelectorAll("#weaponList,#styleList,#biasList").forEach(c =>
    c.addEventListener("change", updateRollBtn));
  // "Prowler Quests?" only applies when "Prowler?" is on — only Prowlers can take them.
  function syncProwlerQuests() {
    const on = $("p_prowler").checked;
    $("p_quests").disabled = !on;
    if (!on) $("p_quests").checked = false;
  }
  $("p_prowler").addEventListener("change", () => { syncProwlerQuests(); updateRollBtn(); });
  $("rollBtn").addEventListener("click", randomize);
  // Expand/Collapse all groups (selection is managed by the checkboxes; at least one
  // monster and one art should stay selected, so there are no All/None shortcuts).
  function setMonstersOpen(open) {
    document.querySelectorAll("#monsterTree .species").forEach(s => {
      s.classList.toggle("open", open);
      const tw = s.querySelector(".twist"); if (tw) tw.textContent = open ? "▾" : "▸";
    });
  }
  function setArtsOpen(open) {
    document.querySelectorAll("#artTree .agrp").forEach(g => {
      g.classList.toggle("open", open);
      const tw = g.querySelector(":scope > .ahead > .twist"); if (tw) tw.textContent = open ? "▾" : "▸";
    });
  }
  function setAllTypesOpen(open) {
    document.querySelectorAll("#allTypeTree .agrp").forEach(g => {
      g.classList.toggle("open", open);
      const tw = g.querySelector(":scope > .ahead > .twist"); if (tw) tw.textContent = open ? "▾" : "▸";
    });
  }
  $("monExpand").addEventListener("click", () => setMonstersOpen(true));
  $("monCollapse").addEventListener("click", () => setMonstersOpen(false));
  $("artExpand").addEventListener("click", () => setArtsOpen(true));
  $("artCollapse").addEventListener("click", () => setArtsOpen(false));
  function artLvBulk(checked) {
    const suffix = " " + $("artLvSel").value;
    artLeaves.forEach(l => { if (l.name.endsWith(suffix)) l.input.checked = checked; });
    refreshArtGroups(); saveFilters();
  }
  $("artLvCheck").addEventListener("click", () => artLvBulk(true));
  $("artLvUncheck").addEventListener("click", () => artLvBulk(false));
  $("allExpand").addEventListener("click", () => setAllTypesOpen(true));
  $("allCollapse").addEventListener("click", () => setAllTypesOpen(false));
  $("statsBtn").addEventListener("click", () => $("statsModal").classList.remove("hidden"));
  $("statsClose").addEventListener("click", () => $("statsModal").classList.add("hidden"));
  $("statsModal").addEventListener("click", (e) => { if (e.target.id === "statsModal") $("statsModal").classList.add("hidden"); });
  $("themeBtn").addEventListener("click", () => $("themeModal").classList.remove("hidden"));
  $("themeClose").addEventListener("click", () => $("themeModal").classList.add("hidden"));
  $("themeModal").addEventListener("click", (e) => { if (e.target.id === "themeModal") $("themeModal").classList.add("hidden"); });
  // Fixed window name means clicking this again refocuses the existing popup instead
  // of spawning a duplicate.
  $("streamViewBtn").addEventListener("click", () => {
    window.open("stream-view.html?v=2", "mhguStreamView", "width=775,height=520,menubar=no,toolbar=no,location=no,status=no");
  });
  $("aboutBtn").addEventListener("click", () => $("aboutModal").classList.remove("hidden"));
  $("aboutClose").addEventListener("click", () => $("aboutModal").classList.add("hidden"));
  $("aboutModal").addEventListener("click", (e) => { if (e.target.id === "aboutModal") $("aboutModal").classList.add("hidden"); });
  $("helpBtn").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
  $("helpClose").addEventListener("click", () => $("helpModal").classList.add("hidden"));
  $("helpModal").addEventListener("click", (e) => { if (e.target.id === "helpModal") $("helpModal").classList.add("hidden"); });

  function doReset() {
    ["f_large","f_hyper","f_capture","f_egg","f_gathering","f_small","f_multi","f_oneFaint","f_onSite"].forEach(id => $(id).checked = true);
    ["p_prowler","p_quests"].forEach(id => $(id).checked = false);
    document.querySelectorAll("#allTypeTree .akids input").forEach(cb => {
      cb.checked = parseInt(cb.id.replace("f_all_lv_",""), 10) < 43; // Arena (43-44) off by default
    });
    document.querySelectorAll("#allTypeTree .agrp").forEach(g => {
      const leaves = [...g.querySelectorAll(".akids input")];
      const n = leaves.filter(i => i.checked).length;
      const gc = g.querySelector(":scope>.ahead>input");
      if (gc) { gc.checked = n === leaves.length; gc.indeterminate = n > 0 && n < leaves.length; }
    });
    fillLevels();
    syncTypeOptions();
    $("f_spArts").checked = true;
    document.querySelectorAll("#weaponList input,#styleList input,#biasList input").forEach(i => i.checked = true);
    setAllMonsters(true);
    setAllArts(true);
    blacklist = []; renderBlacklist();
    chaosMode = false; $("chChaosMode").checked = false; renderChallenges();
    syncProwlerQuests();
    updateRollBtn();
    saveFilters();
  }
  $("resetBtn").addEventListener("click", () => $("resetConfirmModal").classList.remove("hidden"));
  $("resetConfirmOk").addEventListener("click", () => { $("resetConfirmModal").classList.add("hidden"); doReset(); });
  $("resetConfirmCancel").addEventListener("click", () => $("resetConfirmModal").classList.add("hidden"));
  $("resetConfirmModal").addEventListener("click", (e) => { if (e.target.id === "resetConfirmModal") $("resetConfirmModal").classList.add("hidden"); });

  // ── Persist filter state (localStorage), like the theme ──────────────────
  const FILTER_KEY = "mhgu-filters";
  function refreshMonsterGroups() {
    document.querySelectorAll("#monsterTree .species").forEach(sp => {
      const spIn = sp.querySelector("input.sp");
      const kids = [...sp.querySelectorAll(".children input")];
      const n = kids.filter(i => i.checked).length;
      spIn.checked = n === kids.length;
      spIn.indeterminate = n > 0 && n < kids.length;
    });
  }
  const uncheckedNames = (sel) => [...document.querySelectorAll(sel)].filter(i => !i.checked).map(i => i.dataset.name);
  function saveFilters() {
    const d = {
      weapons: uncheckedNames("#weaponList input"),
      styles: uncheckedNames("#styleList input"),
      biases: uncheckedNames("#biasList input"),
      monsters: monsterChecks.filter(m => !m.input.checked).map(m => m.name),
      arts: artLeaves.filter(l => !l.input.checked).map(l => l.name),
      blacklist: blacklist.slice(),
      challenges: challenges.slice(),
      challengeCount: parseInt($("challengeCount").value) || 1,
      t: {
        large: $("f_large").checked,
        hyper: $("f_hyper").checked, capture: $("f_capture").checked,
        egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
        multi: $("f_multi").checked,
        oneFaint: $("f_oneFaint").checked, onSite: $("f_onSite").checked,
        spArts: $("f_spArts").checked,
        prowler: $("p_prowler").checked, pQuests: $("p_quests").checked,
        chaosMode: $("chChaosMode").checked,
        allLevels: Array.from({length:45},(_,i)=>i).filter(i=>{ const cb=$("f_all_lv_"+i); return cb&&!cb.checked; }),
      },
    };
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function loadFilters() {
    let d; try { d = JSON.parse(localStorage.getItem(FILTER_KEY) || "null"); } catch (e) {}
    if (!d) return;
    const applyUnchecked = (sel, names) => { const s = new Set(names || []); document.querySelectorAll(sel).forEach(i => { if (s.has(i.dataset.name)) i.checked = false; }); };
    applyUnchecked("#weaponList input", d.weapons);
    applyUnchecked("#styleList input", d.styles);
    applyUnchecked("#biasList input", d.biases);
    const ms = new Set(d.monsters || []); monsterChecks.forEach(m => { if (ms.has(m.name)) m.input.checked = false; });
    const as = new Set(d.arts || []);     artLeaves.forEach(l => { if (as.has(l.name)) l.input.checked = false; });
    if (d.t) {
      $("f_large").checked = d.t.large !== false;
      $("f_hyper").checked = !!d.t.hyper; $("f_capture").checked = !!d.t.capture;
      $("f_egg").checked = !!d.t.egg; $("f_gathering").checked = !!d.t.gathering; $("f_small").checked = !!d.t.small;
      $("f_multi").checked = !!d.t.multi;
      $("f_oneFaint").checked = !!d.t.oneFaint; $("f_onSite").checked = !!d.t.onSite;
      $("f_spArts").checked = d.t.spArts !== false;
      $("p_prowler").checked = !!d.t.prowler; $("p_quests").checked = !!d.t.pQuests;
      chaosMode = !!d.t.chaosMode; $("chChaosMode").checked = chaosMode;
      if (Array.isArray(d.t.allLevels)) {
        const off = new Set(d.t.allLevels);
        for (let i = 0; i < 45; i++) { const cb = $("f_all_lv_"+i); if (cb) cb.checked = !off.has(i); }
        document.querySelectorAll("#allTypeTree .agrp").forEach(g => {
          const leaves = [...g.querySelectorAll(".akids input")];
          const n = leaves.filter(i => i.checked).length;
          const gc = g.querySelector(":scope>.ahead>input");
          if (gc) { gc.checked = n === leaves.length; gc.indeterminate = n > 0 && n < leaves.length; }
        });
      }
    }
    syncTypeOptions();
    if (Array.isArray(d.blacklist)) { blacklist = d.blacklist; renderBlacklist(); }
    challenges = Array.isArray(d.challenges) ? d.challenges : DEFAULT_CHALLENGES.map(c => Object.assign({}, c));
    renderChallenges();
    if (d.challengeCount) $("challengeCount").value = d.challengeCount;
    refreshMonsterGroups(); refreshArtGroups();
  }
  // Save on any user-driven filter change (event delegation over the sidebar).
  document.querySelector(".sidebar").addEventListener("change", saveFilters);

  // Export filters
  $("exportBtn").addEventListener("click", () => {
    saveFilters();
    const data = localStorage.getItem(FILTER_KEY) || "{}";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mhgu-filters.json"; a.click();
    URL.revokeObjectURL(url);
  });

  // Import filters
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        // Reset all to checked before applying the loaded unchecked sets
        document.querySelectorAll("#weaponList input, #styleList input, #biasList input").forEach(i => i.checked = true);
        monsterChecks.forEach(m => m.input.checked = true);
        artLeaves.forEach(l => l.input.checked = true);
        localStorage.setItem(FILTER_KEY, JSON.stringify(d));
        loadFilters();
      } catch (_) {
        const btn = $("importBtn");
        const orig = btn.textContent;
        btn.textContent = "Invalid file!";
        setTimeout(() => btn.textContent = orig, 2000);
      }
    };
    reader.readAsText(file);
    this.value = "";
  });

  loadFilters();
  fillLevels();
  syncProwlerQuests();
  updateRollBtn();

  // Force a repaint after the MHFU custom font loads to prevent select text clipping.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll("select").forEach(s => {
        s.style.display = "none"; s.offsetHeight; s.style.display = "";
      });
    });
  }
})();
