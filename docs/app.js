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

  const DEVIANT_FULL = {
    redhelm:"Redhelm Arzuros", snowbaron:"Snowbaron Lagombi", stonefist:"Stonefist Hermitaur",
    dreadqueen:"Dreadqueen Rathian", drilltusk:"Drilltusk Tetsucabra", silverwind:"Silverwind Nargacuga",
    crystalbeard:"Crystalbeard Uragaan", deadeye:"Deadeye Yian Garuga", dreadking:"Dreadking Rathalos",
    thunderlord:"Thunderlord Zinogre", grimclaw:"Grimclaw Tigrex", hellblade:"Hellblade Glavenus",
    nightcloak:"Nightcloak Malfestio", rustrazor:"Rustrazor Ceanataur", soulseer:"Soulseer Mizutsune",
    boltreaver:"Boltreaver Astalos", elderfrost:"Elderfrost Gammoth", bloodbath:"Bloodbath Diablos",
  };

  const SP_TIERS = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,G1:11,G2:12,G3:13,G4:14,G5:15,EX:100};

  const LEVELS = {
    Village: [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8],["9★",9],["10★",10],["10★ Advanced",11]],
    Hub:     [["1★",1],["2★",2],["3★",3],["4★",4],["5★",5],["6★",6],["7★",7],["8★",8]],
    Pub:     [["G1★",1],["G2★",2],["G3★",3],["G4★",4],["G4★ (HR13+)",5]],
    Arena:   [["All",0],["Normal",1],["Challenge",2]],
    "Special Permits": [["I",1],["II",2],["III",3],["IV",4],["V",5],["VI",6],["VII",7],["VIII",8],["IX",9],["X",10],["G1",11],["G2",12],["G3",13],["G4",14],["G5",15],["EX",100]],
    Events:  [["Low Rank",1],["High Rank",2],["G Rank",3]],
  };

  const COLORS = [
    ["Red","#E74C3C"],["Orange","#E67E22"],["Amber","#F39C12"],["Gold","#F1C40F"],
    ["Green","#27AE60"],["Teal","#1ABC9C"],["Sky Blue","#3498DB"],["Blue","#2980B9"],
    ["Indigo","#5C6BC0"],["Purple","#9B59B6"],["Magenta","#D81B60"],["Pink","#E91E63"],
    ["White","#FFFFFF"],["Silver","#BDC3C7"],["Gray","#95A5A6"],["Charcoal","#4A4A4A"],
  ];

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
  function rollArt(weapon, ex1, ex2) {
    const wn = normWeapon(weapon);
    for (let i = 0; i < 1000; i++) {
      const a = DATA.arts[rand(DATA.arts.length)];
      if (a.HunterArtName === ex1 || a.HunterArtName === ex2) continue;
      const aw = a.Weapon.toLowerCase();
      if (aw !== "all" && aw !== wn) continue;
      return a.HunterArtName;
    }
    return null;
  }
  const maybeSP = (art) => !art ? "" : (Math.random() < 1/3 ? art + " [SP]" : art);

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
      wrap.className = "species open";
      const head = document.createElement("div");
      head.innerHTML = `<span class="twist">▾</span>`;
      const lbl = document.createElement("label");
      lbl.className = "chk";
      lbl.innerHTML = `<input type="checkbox" class="sp" checked>${escapeHtml(species)}`;
      head.style.display = "flex"; head.style.alignItems = "center";
      head.appendChild(lbl);
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
          spInput.checked = childInputs.some(i => i.checked);
          updateRollBtn();
        });
        children.appendChild(cl);
      });
      const spInput = lbl.querySelector("input");
      spInput.addEventListener("change", () => {
        childInputs.forEach(i => i.checked = spInput.checked);
        updateRollBtn();
      });
      head.querySelector(".twist").addEventListener("click", () => wrap.classList.toggle("open"));
      wrap.appendChild(head); wrap.appendChild(children);
      tree.appendChild(wrap);
    });
  })();
  const includedMonsters = () => new Set(monsterChecks.filter(m => m.input.checked).map(m => m.name.toLowerCase()));
  function setAllMonsters(v) {
    document.querySelectorAll("#monsterTree input").forEach(i => i.checked = v);
    updateRollBtn();
  }

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
      pQuests: $("p_quests").checked, hyper: $("f_hyper").checked,
      egg: $("f_egg").checked, gathering: $("f_gathering").checked, small: $("f_small").checked,
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

      const include = q.LgMonster
        || (q.Prowler && f.pQuests) || (q.Hyper && f.hyper)
        || (q.Egg && f.egg) || (q.Gathering && f.gathering) || (q.SmMonsters && f.small);
      if (!include) return false;

      if (q.LgMonster && q.Monster && anyFiltered && !inc.has(q.Monster.toLowerCase())) return false;
      return true;
    });

    const quest = pool.length ? pick(pool) : {};
    renderResult(quest, type);
  }

  function renderResult(quest, type) {
    $("placeholder").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("r_name").textContent = quest.Name || "";
    $("r_main").textContent = quest.Main || "";

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
        w.textContent = "Prowler"; w.style.color = WEAPON_COLORS["Prowler"];
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
        w.textContent = weapon; w.style.color = WEAPON_COLORS[weapon] || "var(--text)";
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
    }
    const wEl = $("r_weapon");
    wEl.textContent = weapon;
    wEl.style.color = WEAPON_COLORS[weapon] || "var(--text)";
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
      if (!styles.length) styles = ["Guild"];
      const style = pick(styles);
      styleLabel.textContent = "Style";
      styleEl.textContent = style;

      let picks = [];
      if (style === "Striker" || style === "Alchemy") {
        const a = rollArt(weapon, null, null), b = rollArt(weapon, a, null), c = rollArt(weapon, a, b);
        picks = [a, b, c];
      } else if (style === "Guild") {
        const a = rollArt(weapon, null, null); picks = [a, rollArt(weapon, a, null)];
      } else {
        picks = [rollArt(weapon, null, null)];
      }
      picks.map(maybeSP).filter(Boolean).forEach(t => {
        const li = document.createElement("li"); li.textContent = t; arts.appendChild(li);
      });
    }
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  const hexRgb = (h) => { h = h.replace("#",""); return [0,2,4].map(i => parseInt(h.substr(i,2),16)); };
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const darken = (rgb, f) => rgb.map(c => clamp(c*f));
  const lighten = (rgb, b) => rgb.map(c => clamp(c + (255-c)*b));
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    r.setProperty("--bg", css(darken(c,0.18)));
    r.setProperty("--bg2", css(darken(c,0.13)));
    r.setProperty("--hover", css(darken(c,0.24)));
    r.setProperty("--accent", css(lighten(c,0.20)));
    r.setProperty("--accent-hover", css(lighten(c,0.38)));
    try { localStorage.setItem("mhgu-theme", hex); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s.dataset.hex === hex));
  }
  (function buildSwatches() {
    const wrap = $("swatches");
    COLORS.forEach(([name, hex]) => {
      const d = document.createElement("div");
      d.className = "swatch"; d.dataset.hex = hex; d.style.background = hex;
      d.title = name; d.innerHTML = `<span>${name}</span>`;
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
  $("p_prowler").addEventListener("change", updateRollBtn);
  $("rollBtn").addEventListener("click", randomize);
  $("monAll").addEventListener("click", () => setAllMonsters(true));
  $("monNone").addEventListener("click", () => setAllMonsters(false));
  $("themeBtn").addEventListener("click", () => $("themeModal").classList.remove("hidden"));
  $("themeClose").addEventListener("click", () => $("themeModal").classList.add("hidden"));
  $("themeModal").addEventListener("click", (e) => { if (e.target.id === "themeModal") $("themeModal").classList.add("hidden"); });

  $("resetBtn").addEventListener("click", () => {
    ["f_hyper","f_egg","f_gathering","f_small","p_prowler","p_quests"].forEach(id => $(id).checked = false);
    document.querySelectorAll("#weaponList input,#styleList input,#biasList input").forEach(i => i.checked = true);
    setAllMonsters(true);
    updateRollBtn();
  });

  updateRollBtn();
})();
