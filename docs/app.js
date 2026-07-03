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
    ["Forbidden","#1E2025","Question Mark"],["Khezu","#FFFFFF"],                                                                     // white
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

      if (type === "ALL") {
        if (rank < fromLv || rank > toLv) return false;
      } else {
        if (qType.toLowerCase() !== type.toLowerCase()) return false;
        if (type === "Arena") {
          if (q.Level < fromLv || q.Level > toLv) return false;
        } else {
          if (q.Level < fromLv || q.Level > toLv) return false;
        }
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
  }

  $("copyResultBtn").addEventListener("click", () => {
    const name   = $("r_name").textContent;
    const weapon = $("r_weapon").textContent;
    const styleHidden = $("r_styleBlock").classList.contains("hidden");
    const styleLabel  = $("r_styleLabel").textContent;
    const style       = $("r_style").textContent;
    const artItems    = Array.from($("r_arts").children).map(li => li.textContent);

    const lines = [`Quest: ${name}`, `Locale: ${$("r_locale").textContent}`, `Weapon: ${weapon}`];
    if (!styleHidden) lines.push(`${styleLabel}: ${style}`);
    if (artItems.length) lines.push(`Hunter Art(s): ${artItems.join(" / ")}`);

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
  const darken     = (rgb, f) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l*f)]); };
  const lighten    = (rgb, b) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l+(1-l)*b)]); };
  const desaturate = (rgb, f) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, clamp01(s*f), l]); };
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const deriveBg = (rgb) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, clamp01(s*0.74), clamp01(l*0.35)]); };
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    const bright = c[0]*0.299 + c[1]*0.587 + c[2]*0.114;
    const isLight = bright > 230;
    if (isLight) {
      r.setProperty("--bg",          css(darken(c,0.95)));
      r.setProperty("--bg1",          css(darken(c,.80)));
      r.setProperty("--bg2",         css(darken(c,0.90)));
      r.setProperty("--hover",       css(darken(c,0.30)));
      r.setProperty("--accent",     css(darken(c,0.5)));
      r.setProperty("--accent-hover",css(lighten(c,0.1)));
      r.setProperty("--accent-color",css(darken(c,0.1)));
    } else {
      r.setProperty("--bg",          css(darken(c,.70)));
      r.setProperty("--bg1",         css(darken(c,.80)));
      r.setProperty("--bg2",         css(darken(c,0.95)));
      r.setProperty("--hover",       css(darken(c,0.30)));
      r.setProperty("--accent",     css(darken(c,0.7)));
      r.setProperty("--accent-hover",css(darken(c,0.7)));
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
      d.addEventListener("click", () => applyTheme(hex));
      wrap.appendChild(d);
    });
  })();
  let saved = "#1E2025";
  try { saved = localStorage.getItem("mhgu-theme") || saved; } catch (e) {}
  applyTheme(saved);

  // ── Guild card background picker ─────────────────────────────────────────
  const GUILD_BG_FILES = [
    "HD_ui_guild_01_ID.PNG","HD_ui_guild_02_ID.PNG","HD_ui_guild_03_ID.PNG",
    "HD_ui_guild_04_ID.PNG","HD_ui_guild_05_ID.PNG","HD_ui_guild_06_ID.PNG",
    "HD_ui_guild_07_ID.PNG","HD_ui_guild_08_ID.PNG","HD_ui_guild_09_ID.PNG",
    "HD_ui_guild_10_ID.PNG","HD_ui_guild_11_ID.PNG","HD_ui_guild_12_ID.PNG",
    "HD_ui_guild_13_ID.PNG","HD_ui_guild_14_ID.PNG","HD_ui_guild_15_ID.PNG",
    "HD_ui_guild_16_ID.PNG","HD_ui_guild_17_ID.PNG","HD_ui_guild_18_ID.PNG",
    "HD_ui_guild_19_ID.PNG","HD_ui_guild_20_ID.PNG","HD_ui_guild_21_ID.PNG",
    "HD_ui_guild_22_ID.PNG","HD_ui_guild_23_ID.PNG","HD_ui_guild_24_ID.PNG",
    "HD_ui_guild_25_ID.PNG","HD_ui_guild_26_ID.PNG","HD_ui_guild_27_ID.PNG",
    "HD_ui_guild_28_ID.PNG","HD_ui_guild_29_ID.PNG","HD_ui_guild_30_ID.PNG",
    "HD_ui_guild_31_ID.PNG","HD_ui_guild_32_ID.PNG","HD_ui_guild_33_ID.PNG",
    "HD_ui_guild_34_ID.PNG","HD_ui_guild_35_ID.PNG","HD_ui_guild_36_ID.PNG",
    "HD_ui_guild_37_ID.PNG","HD_ui_guild_38_ID.PNG","HD_ui_guild_39_ID.PNG",
    "HD_ui_guild_40_ID.PNG","HD_ui_guild_41_ID.PNG","HD_ui_guild_42_ID.PNG",
    "HD_ui_guild_43_ID.PNG","HD_ui_guild_44_ID.PNG","HD_ui_guild_45_ID.PNG",
    "HD_ui_guild_46_ID.PNG","HD_ui_guild_47_ID.PNG","HD_ui_guild_48_ID.PNG",
    "HD_ui_guild_49_ID.PNG","HD_ui_guild_50_ID.PNG","HD_ui_guild_51_ID.PNG",
    "HD_ui_guild_52_ID.PNG","HD_ui_guild_53_ID.PNG","HD_ui_guild_54_ID.PNG",
    "HD_ui_guild_55_ID.PNG","HD_ui_guild_57_ID.PNG","HD_ui_guild_58_ID.PNG",
    "HD_ui_guild_64_ID.PNG","HD_ui_guild_68_ID.PNG",
    "HD_ui_guild_95_ID.PNG","HD_ui_guild_96_ID.PNG","HD_ui_guild_97_ID.PNG",
    "HD_ui_guild_98_ID.PNG","HD_ui_guild_99_ID.PNG","HD_ui_guild_100_ID.PNG",
    "HD_ui_guild_102_ID.PNG","HD_ui_guild_103_ID.PNG","HD_ui_guild_104_ID.PNG",
    "HD_ui_guild_105_ID.PNG","HD_ui_guild_106_ID.PNG","HD_ui_guild_107_ID.PNG",
    "HD_ui_guild_108_ID.PNG","HD_ui_guild_109_ID.PNG","HD_ui_guild_110_ID.PNG",
    "HD_ui_guild_111_ID.PNG","HD_ui_guild_112_ID.PNG","HD_ui_guild_113_ID.PNG",
    "HD_ui_guild_114_ID.PNG","HD_ui_guild_115_ID.PNG",
  ];
  function applyBg(file) {
    const el = document.querySelector(".content");
    if (!el) return;
    if (!file) {
      el.style.backgroundImage = "";
    } else {
      const url = `assets/GuildCardBG/${encodeURIComponent(file)}`;
      const img = new Image();
      img.src = url;
      if (img.complete) {
        el.style.backgroundImage = `url('${url}')`;
      } else {
        img.onload = () => { el.style.backgroundImage = `url('${url}')`; };
      }
    }
    try { localStorage.setItem("mhgu-bg", file || ""); } catch (e) {}
    document.querySelectorAll(".bg-thumb").forEach(t => t.classList.toggle("sel", t.dataset.file === (file || "")));
  }
  (function buildBgGrid() {
    const grid = $("bgGrid");
    const none = document.createElement("div");
    none.className = "bg-thumb none-thumb"; none.dataset.file = "";
    none.textContent = "None";
    none.addEventListener("click", () => applyBg(""));
    grid.appendChild(none);
    GUILD_BG_FILES.forEach(f => {
      const url = `assets/GuildCardBG/${encodeURIComponent(f)}`;
      const d = document.createElement("div");
      d.className = "bg-thumb"; d.dataset.file = f;
      d.style.backgroundImage = `url('${url}')`;
      d.addEventListener("mouseenter", () => { const p = new Image(); p.src = url; });
      d.addEventListener("click", () => applyBg(f));
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
  $("aboutBtn").addEventListener("click", () => $("aboutModal").classList.remove("hidden"));
  $("aboutClose").addEventListener("click", () => $("aboutModal").classList.add("hidden"));
  $("aboutModal").addEventListener("click", (e) => { if (e.target.id === "aboutModal") $("aboutModal").classList.add("hidden"); });
  $("helpBtn").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
  $("helpClose").addEventListener("click", () => $("helpModal").classList.add("hidden"));
  $("helpModal").addEventListener("click", (e) => { if (e.target.id === "helpModal") $("helpModal").classList.add("hidden"); });

  function doReset() {
    $("f_large").checked = true;
    ["f_hyper","f_capture","f_egg","f_gathering","f_small","f_multi","f_oneFaint","f_onSite","p_prowler","p_quests"].forEach(id => $(id).checked = false);
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
      t: {
        large: $("f_large").checked,
        hyper: $("f_hyper").checked, capture: $("f_capture").checked,
        egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
        multi: $("f_multi").checked,
        oneFaint: $("f_oneFaint").checked, onSite: $("f_onSite").checked,
        spArts: $("f_spArts").checked,
        prowler: $("p_prowler").checked, pQuests: $("p_quests").checked,
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
    refreshMonsterGroups(); refreshArtGroups();
  }
  // Save on any user-driven filter change (event delegation over the sidebar).
  document.querySelector(".sidebar").addEventListener("change", saveFilters);

  loadFilters();
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
