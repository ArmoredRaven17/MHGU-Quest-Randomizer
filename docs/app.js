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
    Village: [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8],["9★",9],["10★",10],["10★ Advanced",11]],
    Hub:     [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8]],
    Pub:     [["G1★",1],["G2★",2],["G3★",3],["G4★",4],["G4★ (HR13+)",5]],
    Arena:   [["All",0],["Normal",1],["Challenge",2]],
    "Special Permits": [["I",1],["II",2],["III",3],["IV",4],["V",5],["VI",6],["VII",7],["VIII",8],["IX",9],["X",10],["G1",11],["G2",12],["G3",13],["G4",14],["G5",15],["EX",16]],
    Events:  [["Low Rank",1],["High Rank",2],["G Rank",3]],
  };

  // Theme colors named after MHGU monsters that evoke each hue. Label = monster (and its
  // icon filename); the hex values are unchanged so saved themes keep matching.
  const COLORS = [
    ["Teostra","#701010"],["Rathalos","#C23D3D"],["Agnaktor","#E86020"],["Tigrex","#C49040"],
    ["Rajang","#FFDD00"],["Najarala","#BBFF00"],["Deviljho","#217500"],["Rathian","#34CB34"],
    ["Zinogre","#1ABC9C"],["Lagiacrus","#0099FF"],["Brachydios","#1A3A6C"],["Gore Magala","#3E487E"],
    ["Nerscylla","#543091"],["Chameleos","#9C85B2"],["Mizutsune","#D86EA7"],["Duramboros","#987367"],
    ["Khezu","#FFFFFF"],["Kushala Daora","#BDC3C7"],["Basarios","#95A5A6"],["Question Mark","#4A4A4A"],
  ];
  const COLORS_HEX = Object.fromEntries(COLORS.map(([name, hex]) => [hex.toUpperCase(), name]));

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

  // ── Hunter arts ──────────────────────────────────────────────────────────
  // Arts list uses "Sword and Shield"; weapon list uses "Sword & Shield" — normalize.
  const normWeapon = (w) => w.toLowerCase().replace(/ & /g, " and ");
  // Strip a trailing level suffix so "Haste Rain I" and "Haste Rain III" compare equal —
  // the same art can't be equipped at two levels.
  const artBase = (n) => n.replace(/ (III|II|I)$/, "");
  function rollArt(weapon, ex1, ex2, excl) {
    const wn = normWeapon(weapon);
    const b1 = ex1 ? artBase(ex1) : null, b2 = ex2 ? artBase(ex2) : null;
    for (let i = 0; i < 1000; i++) {
      const a = DATA.arts[rand(DATA.arts.length)];
      if (excl && excl.has(a.HunterArtName)) continue;   // filtered out by the user
      const aw = a.Weapon.toLowerCase();
      if (aw !== "all" && aw !== wn) continue;
      const b = artBase(a.HunterArtName);
      if (b === b1 || b === b2) continue;
      return a.HunterArtName;
    }
    return null;
  }
  const maybeSP = (art) => !art ? "" : ($("f_spArts").checked && Math.random() < 1/3 ? art + " [SP]" : art);

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
    const baseName = (n) => n.replace(/ (III|II|I)$/, "");
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
    DATA.arts.forEach(a => { (byW[a.Weapon] = byW[a.Weapon] || {}); const b = baseName(a.HunterArtName); (byW[a.Weapon][b] = byW[a.Weapon][b] || []).push(a.HunterArtName); });
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
    const opts = LEVELS[type] || [];
    const from = $("fromLevel"), to = $("toLevel");
    const isArena = type === "Arena";
    from.innerHTML = ""; to.innerHTML = "";
    opts.forEach(([lbl, val]) => {
      from.add(new Option(lbl, val));
      to.add(new Option(lbl, val));
    });
    from.selectedIndex = 0;
    // Arena is a single category pick (All/Normal/Challenge), not a range —
    // hide the From field, relabel, and default the selector to "All".
    $("fromField").classList.toggle("hidden", isArena);
    $("toLabel").textContent = isArena ? "Arena Type" : "Up to Level";
    to.selectedIndex = isArena ? 0 : Math.max(0, opts.length - 1);
    updateRollBtn();
  }

  // Keep From ≤ To (compared by list position, same ordered options in both).
  function syncLevels(changed) {
    const from = $("fromLevel"), to = $("toLevel");
    if ($("questType").value === "Arena") { updateRollBtn(); return; }
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
      pQuests: $("p_quests").checked, hyper: $("f_hyper").checked, capture: $("f_capture").checked,
      egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
      oneFaint: $("f_oneFaint").checked, onSite: $("f_onSite").checked,
    };

    const pool = DATA.quests.filter(q => {
      if ((q.Type || "").toLowerCase() !== type.toLowerCase()) return false;

      if (type === "Special Permits") {
        const t = spTier(q.Name || "");
        if (t < fromLv || t > toLv) return false;
      } else if (type === "Arena") {
        if (toLv !== 0 && q.Level !== toLv) return false;
      } else {
        if (q.Level < fromLv || q.Level > toLv) return false;
      }

      const include = (q.LgMonster && !q.Capture)
        || (q.Capture && f.capture)
        || (q.Prowler && f.pQuests) || (q.Hyper && f.hyper)
        || (q.Egg && f.egg) || (q.Gathering && f.gathering) || (q.SmMonsters && f.small);
      if (!include) return false;

      // Gate flags: unchecked = exclude quests of that type (same pattern for all three).
      if (q.Hyper && !f.hyper) return false;
      if (q.OneFaint && !f.oneFaint) return false;
      if (q.OnSite && !f.onSite) return false;

      if (q.LgMonster && q.Monster && anyFiltered && !inc.has(q.Monster.toLowerCase())) return false;
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
    $("r_name").style.color = (type === "Special Permits" && / EX: /.test(quest.Name)) ? "#ff00ff" : "";
    $("r_main").textContent = quest.Main || "";
    $("r_capturePill").classList.toggle("hidden", !quest.Capture);
    $("r_hyperPill").classList.toggle("hidden", !quest.Hyper);
    $("r_hyperOverlay").classList.toggle("hidden", !quest.Hyper);

    const iconMonster = (type === "Special Permits" && quest.Name)
      ? spDeviant(quest.Name, quest.Monster) : (quest.Monster || "");
    const img = $("r_target");
    img.src = monsterIcon(iconMonster);
    img.onerror = () => { img.onerror = null; img.src = FALLBACK_ICON; };

    // Arena: preset equipment sets from the quest description. Hunter arenas offer a
    // fixed weapon list; Prowler arenas a fixed bias list. Roll within the set; style
    // and arts are part of the set, so we don't roll them.
    if (type === "Arena") {
      const w = $("r_weapon");
      $("r_arts").innerHTML = "";
      if (quest.ArenaBiases && quest.ArenaBiases.length) {
        const bias = pick(quest.ArenaBiases);
        $("r_weaponLabel").textContent = "Weapon";
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
        $("r_weaponLabel").textContent = "Weapon";
        w.textContent = weapon; setWeaponStyle(w, weapon);
        const wi = $("r_weaponIcon");
        wi.classList.remove("hidden"); wi.src = weaponIcon(weapon);
        wi.onerror = () => { wi.onerror = null; wi.classList.add("hidden"); };
        $("r_styleBlock").classList.add("hidden");
      } else {
        $("r_weaponLabel").textContent = "Loadout";
        w.textContent = "Set " + (1 + rand(5)); w.style.color = "var(--text)";
        $("r_weaponIcon").classList.add("hidden");
        $("r_styleBlock").classList.add("hidden");
      }
      return;
    }
    $("r_weaponLabel").textContent = "Weapon";
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
      let picks = [];
      if (style === "Striker" || style === "Alchemy") {
        const a = rollArt(weapon, null, null, excl), b = rollArt(weapon, a, null, excl), c = rollArt(weapon, a, b, excl);
        picks = [a, b, c];
      } else if (style === "Guild") {
        const a = rollArt(weapon, null, null, excl); picks = [a, rollArt(weapon, a, null, excl)];
      } else {
        picks = [rollArt(weapon, null, null, excl)];
      }
      picks.map(maybeSP).filter(Boolean).forEach(t => {
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

    const lines = [`Quest: ${name}`, `Weapon: ${weapon}`];
    if (!styleHidden) lines.push(`${styleLabel}: ${style}`);
    if (artItems.length) lines.push(`Hunter Art(s): ${artItems.join(" / ")}`);

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
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
  const darken  = (rgb, f) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l*f)]); };
  const lighten = (rgb, b) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l+(1-l)*b)]); };
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const deriveBg = (rgb) => { const [h,s,l] = rgbToHsl(rgb); return hslToRgb([h, clamp01(s*0.74), clamp01(l*0.35)]); };
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    const bright = c[0]*0.299 + c[1]*0.587 + c[2]*0.114;
    const isLight = bright > 230;
    if (isLight) {
      r.setProperty("--bg",          css(darken(c,0.95)));
      r.setProperty("--bg2",         css(darken(c,0.90)));
      r.setProperty("--hover",       css(darken(c,0.80)));
      r.setProperty("--accent",      css(darken(c,0.70)));
      r.setProperty("--accent-hover",css(darken(c,0.78)));
    } else {
      r.setProperty("--bg",          css(deriveBg(c)));
      r.setProperty("--bg2",         css(darken(c,0.70)));
      r.setProperty("--hover",       css(darken(c,0.30)));
      r.setProperty("--accent",      css(darken(lighten(c,0.25),0.81)));
      r.setProperty("--accent-hover",css(darken(lighten(c,0.36),0.81)));
    }
    r.setProperty("--text",     isLight ? "#111111" : "#f3f3f3");
    r.setProperty("--text-dim", isLight ? "#444444" : "#b8b8b8");
    r.setProperty("--line",     isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)");
    r.setProperty("--card",     isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)");
    try { localStorage.setItem("mhgu-theme", hex); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s.dataset.hex === hex));
    const titleIcon = document.querySelector(".title-icon");
    if (titleIcon) {
      const name = COLORS_HEX[hex.toUpperCase()];
      titleIcon.src = name ? monsterIcon(name) : FALLBACK_ICON;
    }
  }
  (function buildSwatches() {
    const wrap = $("swatches");
    COLORS.forEach(([name, hex]) => {
      const d = document.createElement("div");
      d.className = "swatch"; d.dataset.hex = hex; d.style.background = hex;
      d.title = name;
      d.innerHTML = `<img class="swatch-icon" src="${monsterIcon(name)}" alt=""><span>${name}</span>`;
      d.addEventListener("click", () => applyTheme(hex));
      wrap.appendChild(d);
    });
  })();
  let saved = "#4A4A4A";
  try { saved = localStorage.getItem("mhgu-theme") || saved; } catch (e) {}
  applyTheme(saved);

  // ── Wiring ───────────────────────────────────────────────────────────────
  document.querySelectorAll(".panel-head").forEach(h =>
    h.addEventListener("click", () => {
      const p = h.parentElement; p.dataset.open = p.dataset.open === "true" ? "false" : "true";
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
  $("monExpand").addEventListener("click", () => setMonstersOpen(true));
  $("monCollapse").addEventListener("click", () => setMonstersOpen(false));
  $("artExpand").addEventListener("click", () => setArtsOpen(true));
  $("artCollapse").addEventListener("click", () => setArtsOpen(false));
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
    ["f_hyper","f_capture","f_egg","f_gathering","f_small","f_oneFaint","f_onSite","p_prowler","p_quests"].forEach(id => $(id).checked = false);
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
        hyper: $("f_hyper").checked, capture: $("f_capture").checked,
        egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
        oneFaint: $("f_oneFaint").checked, onSite: $("f_onSite").checked,
        spArts: $("f_spArts").checked,
        prowler: $("p_prowler").checked, pQuests: $("p_quests").checked,
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
      $("f_hyper").checked = !!d.t.hyper; $("f_capture").checked = !!d.t.capture;
      $("f_egg").checked = !!d.t.egg; $("f_gathering").checked = !!d.t.gathering; $("f_small").checked = !!d.t.small;
      $("f_oneFaint").checked = !!d.t.oneFaint; $("f_onSite").checked = !!d.t.onSite;
      $("f_spArts").checked = d.t.spArts !== false;
      $("p_prowler").checked = !!d.t.prowler; $("p_quests").checked = !!d.t.pQuests;
    }
    if (Array.isArray(d.blacklist)) { blacklist = d.blacklist; renderBlacklist(); }
    refreshMonsterGroups(); refreshArtGroups();
  }
  // Save on any user-driven filter change (event delegation over the sidebar).
  document.querySelector(".sidebar").addEventListener("change", saveFilters);

  loadFilters();
  syncProwlerQuests();
  updateRollBtn();
})();
