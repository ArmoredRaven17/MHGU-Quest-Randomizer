(function () {
  const $ = (id) => document.getElementById(id);
  const DATA = window.MHGU_DATA;

  const WEAPONS = ["Great Sword","Long Sword","Sword & Shield","Dual Blades",
    "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe","Charge Blade",
    "Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"];
  const STYLES = ["Guild","Striker","Adept","Aerial","Valor","Alchemy"];
  const BIAS_NAMES = ["Charisma","Fighting","Protection","Assisting","Healing","Bombing","Gathering","Beast"];

  // Group label -> item labels, in the exact order allRank() in randomizer.js assumes
  // (Village 0-10, Hub 11-18, G-Rank/Pub 19-23, Special Permits 24-39, Events 40-42, Arena 43-44).
  const RANK_GROUPS = [
    { label: "Village", items: ["1★","2★","3★","4★","5★","6★","7★","8★","9★","10★","10★ Adv."] },
    { label: "Hub", items: ["1★","2★","3★","4★","5★","6★","7★","8★"] },
    { label: "G-Rank", items: ["G1★","G2★","G3★","G4★","G4★ HR13+"] },
    { label: "Special Permits", items: ["Deviant I","Deviant II","Deviant III","Deviant IV","Deviant V",
      "Deviant VI","Deviant VII","Deviant VIII","Deviant IX","Deviant X",
      "Deviant G1","Deviant G2","Deviant G3","Deviant G4","Deviant G5","Deviant EX"] },
    { label: "Events", items: ["Event Low Rank","Event High Rank","Event G Rank"] },
    { label: "Arena", items: ["Arena Normal","Arena Challenge"] },
  ];

  const normWeapon = (w) => w.toLowerCase().replace(/ & /g, " and ");
  const artBase = (n) => n.replace(/ (III|II|I)$/, "");

  let blacklist = [];
  let challenges = [];
  let chaosMode = false;

  // ── Group (parent) checkboxes: a "select all" toggle over a set of leaf checkboxes,
  // tri-state (checked / unchecked / indeterminate) to reflect partial selection. Every
  // group is independent — it recomputes its own state purely from its own leaves, so
  // nested groups (Hunter Arts weapon -> base-art) don't need special-case wiring beyond
  // recomputing every registered group whenever any leaf changes.
  const groupRegistry = []; // {input, leaves: [...leafInputs]}

  function syncGroup(g) {
    const on = g.leaves.filter((l) => l.checked).length;
    g.input.checked = on === g.leaves.length;
    g.input.indeterminate = on > 0 && on < g.leaves.length;
  }
  function refreshAllGroups() { groupRegistry.forEach(syncGroup); }
  function onLeafChanged() { refreshAllGroups(); }
  function onGroupToggled(g) {
    g.leaves.forEach((l) => { l.checked = g.input.checked; });
    refreshAllGroups();
  }

  function makeLeaf(name, id) {
    const label = document.createElement("label");
    label.className = "chk";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.className = "leaf";
    input.dataset.name = name;
    input.id = id;
    input.addEventListener("change", onLeafChanged);
    label.appendChild(input);
    label.appendChild(document.createTextNode(name));
    return { label, input };
  }

  function makeGroupHead(labelText, extraClass) {
    const head = document.createElement("label");
    head.className = "grphead" + (extraClass ? " " + extraClass : "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    const span = document.createElement("span");
    span.className = "grp-name";
    span.textContent = labelText;
    head.appendChild(input);
    head.appendChild(span);
    return { head, input };
  }

  function buildChecklist(container, names, prefix) {
    container.innerHTML = "";
    names.forEach((name, i) => {
      const { label } = makeLeaf(name, `${prefix}_${i}`);
      // These lists (weapons/styles/biases) have no grouping, so leaf change doesn't
      // need to feed into groupRegistry — remove the group-oriented listener overhead.
      container.appendChild(label);
    });
  }

  function buildRankGroups() {
    const container = $("rankGroups");
    container.innerHTML = "";
    let idx = 0;
    RANK_GROUPS.forEach((group) => {
      const wrap = document.createElement("div");
      wrap.className = "grp";
      const { head, input: groupInput } = makeGroupHead(group.label);
      wrap.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "grid";
      const leaves = [];
      group.items.forEach((label) => {
        const rank = idx++;
        const lbl = document.createElement("label");
        lbl.className = "chk";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.className = "leaf";
        input.id = `lv_${rank}`;
        input.dataset.rank = String(rank);
        input.addEventListener("change", onLeafChanged);
        lbl.appendChild(input);
        lbl.appendChild(document.createTextNode(label));
        grid.appendChild(lbl);
        leaves.push(input);
      });
      wrap.appendChild(grid);
      container.appendChild(wrap);

      const g = { input: groupInput, leaves };
      groupRegistry.push(g);
      groupInput.addEventListener("change", () => onGroupToggled(g));
    });
  }

  function buildMonsterList() {
    const container = $("monsterList");
    container.innerHTML = "";
    const bySpecies = new Map();
    DATA.monsters.forEach((m) => {
      if (!bySpecies.has(m.Species)) bySpecies.set(m.Species, []);
      bySpecies.get(m.Species).push(m.MonsterName);
    });
    let i = 0;
    for (const [species, names] of bySpecies) {
      const wrap = document.createElement("div");
      wrap.className = "grp";
      const { head, input: groupInput } = makeGroupHead(species);
      wrap.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "grid";
      const leaves = [];
      names.forEach((name) => {
        const { label, input } = makeLeaf(name, `mon_${i++}`);
        grid.appendChild(label);
        leaves.push(input);
      });
      wrap.appendChild(grid);
      container.appendChild(wrap);

      const g = { input: groupInput, leaves };
      groupRegistry.push(g);
      groupInput.addEventListener("change", () => onGroupToggled(g));
    }
  }

  // Hunter Arts: Weapon group -> (base-art group, when it has multiple I/II/III levels,
  // else a plain leaf) -> individual art leaves. Matches the desktop/web app's grouping
  // exactly, just without the collapsible tree chrome.
  function buildArtList() {
    const container = $("artList");
    container.innerHTML = "";
    const byWeapon = new Map();
    DATA.arts.forEach((a) => {
      if (!byWeapon.has(a.Weapon)) byWeapon.set(a.Weapon, new Map());
      const baseMap = byWeapon.get(a.Weapon);
      const base = artBase(a.HunterArtName);
      if (!baseMap.has(base)) baseMap.set(base, []);
      baseMap.get(base).push(a.HunterArtName);
    });

    const order = ["All", ...WEAPONS.map((w) => {
      const norm = normWeapon(w);
      for (const key of byWeapon.keys()) if (normWeapon(key) === norm) return key;
      return null;
    }).filter(Boolean)];
    for (const key of byWeapon.keys()) if (!order.includes(key)) order.push(key);

    let i = 0;
    order.forEach((weaponKey) => {
      const baseMap = byWeapon.get(weaponKey);
      if (!baseMap) return;

      const wrap = document.createElement("div");
      wrap.className = "grp";
      const { head, input: wGroupInput } = makeGroupHead(weaponKey);
      wrap.appendChild(head);

      // One row per base art — single-level arts are just a plain checkbox; leveled
      // arts (I/II/III) lay their levels out horizontally in the same row instead of
      // wrapping in a grid, so a weapon with an odd count of arts never leaves a lone
      // item stranded on its own row.
      const kids = document.createElement("div");
      kids.className = "art-rows";
      const wLeaves = [];

      Array.from(baseMap.keys()).sort().forEach((base) => {
        const fulls = baseMap.get(base).slice().sort();
        const row = document.createElement("div");
        row.className = "art-row";

        if (fulls.length === 1) {
          const { label, input } = makeLeaf(fulls[0], `art_${i++}`);
          row.appendChild(label);
          wLeaves.push(input);
        } else {
          // Base art with multiple levels — its own group toggle lets a streamer drop
          // the whole tiered art in one click instead of per-level.
          const { head: rowHead, input: bGroupInput } = makeGroupHead(base, "sub");
          row.appendChild(rowHead);
          const levelsWrap = document.createElement("div");
          levelsWrap.className = "art-row-levels";
          const bLeaves = [];
          fulls.forEach((name) => {
            const suffix = name.slice(base.length).trim();
            const label = document.createElement("label");
            label.className = "chk";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = true;
            input.className = "leaf";
            input.dataset.name = name;
            input.id = `art_${i++}`;
            input.addEventListener("change", onLeafChanged);
            label.appendChild(input);
            label.appendChild(document.createTextNode(suffix));
            levelsWrap.appendChild(label);
            bLeaves.push(input);
            wLeaves.push(input);
          });
          row.appendChild(levelsWrap);

          const bGroup = { input: bGroupInput, leaves: bLeaves };
          groupRegistry.push(bGroup);
          bGroupInput.addEventListener("change", () => onGroupToggled(bGroup));
        }

        kids.appendChild(row);
      });

      wrap.appendChild(kids);
      container.appendChild(wrap);

      const wGroup = { input: wGroupInput, leaves: wLeaves };
      groupRegistry.push(wGroup);
      wGroupInput.addEventListener("change", () => onGroupToggled(wGroup));
    });
  }

  function renderBlacklist() {
    const list = $("blList");
    list.innerHTML = "";
    blacklist.forEach((b, i) => {
      const row = document.createElement("div");
      row.className = "bl-item";
      row.innerHTML = `<span>${b.weapon} + ${b.style}</span>`;
      const rm = document.createElement("button");
      rm.textContent = "Remove";
      rm.addEventListener("click", () => { blacklist.splice(i, 1); renderBlacklist(); });
      row.appendChild(rm);
      list.appendChild(row);
    });
  }

  function initBlacklistSelects() {
    const wSel = $("blWeapon"), sSel = $("blStyle");
    wSel.innerHTML = WEAPONS.map(w => `<option value="${w}">${w}</option>`).join("");
    sSel.innerHTML = STYLES.map(s => `<option value="${s}">${s}</option>`).join("");
    $("blAdd").addEventListener("click", () => {
      const weapon = wSel.value, style = sSel.value;
      if (blacklist.some(b => b.weapon === weapon && b.style === style)) return;
      blacklist.push({ weapon, style });
      renderBlacklist();
    });
  }

  // Challenges: mirrors docs/app.js's renderChallenges()/rollChallenges() UI exactly
  // (add/edit/remove rows, Chaos Mode disabling the manual checkboxes) — this page has
  // no auto-save-to-localStorage, so edits just mutate the in-memory array until the
  // streamer clicks Save & Publish, same as the Restrictions blacklist above.
  function renderChallenges() {
    const el = $("chList");
    el.innerHTML = "";
    if (!challenges.length) {
      el.innerHTML = '<p class="muted" style="margin:0">No conditions added yet.</p>';
      return;
    }
    challenges.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "bl-tag";

      const chk = document.createElement("label");
      chk.className = "chk";
      chk.style.flexShrink = "0";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = c.checked !== false;
      cb.disabled = chaosMode;
      chk.appendChild(cb);

      const txt = document.createElement("input");
      txt.type = "text";
      txt.className = "ch-edit-text";
      txt.value = c.text;
      txt.maxLength = 21;
      if (c.checked === false) txt.style.opacity = ".45";

      const num = document.createElement("input");
      num.type = "number";
      num.className = "ch-edit-chance";
      num.value = c.chance;
      num.min = 1; num.max = 100;

      const pct = document.createElement("span");
      pct.className = "ch-pct";
      pct.textContent = "%";

      const btn = document.createElement("button");
      btn.title = "Remove";
      btn.setAttribute("aria-label", "Remove");
      btn.textContent = "×";

      cb.addEventListener("change", function () {
        challenges[i].checked = this.checked;
        txt.style.opacity = this.checked ? "" : ".45";
      });
      txt.addEventListener("change", function () {
        const v = this.value.trim();
        if (v) challenges[i].text = v;
        else this.value = challenges[i].text;
      });
      num.addEventListener("change", function () {
        const v = Math.min(100, Math.max(1, parseInt(this.value) || 1));
        this.value = v;
        challenges[i].chance = v;
      });
      btn.addEventListener("click", () => {
        challenges.splice(i, 1);
        renderChallenges();
      });

      row.append(chk, txt, num, pct, btn);
      el.appendChild(row);
    });
  }

  function wireChallenges() {
    $("chAdd").addEventListener("click", () => {
      const text = $("chText").value.trim();
      const chance = Math.min(100, Math.max(1, parseInt($("chChance").value) || 10));
      if (!text) return;
      challenges.push({ checked: false, text, chance });
      renderChallenges();
      $("chText").value = "";
    });
    $("chText").addEventListener("keydown", (e) => { if (e.key === "Enter") $("chAdd").click(); });
    $("chChaosMode").addEventListener("change", function () {
      chaosMode = this.checked;
      renderChallenges();
    });
  }

  const uncheckedNames = (sel) => [...document.querySelectorAll(sel)].filter(i => !i.checked).map(i => i.dataset.name);

  function assembleFilters() {
    const disabledRanks = [];
    document.querySelectorAll("#rankGroups input.leaf").forEach((cb) => {
      if (!cb.checked) disabledRanks.push(parseInt(cb.dataset.rank, 10));
    });
    return {
      weapons: uncheckedNames("#weaponList input"),
      styles: uncheckedNames("#styleList input"),
      biases: uncheckedNames("#biasList input"),
      monsters: uncheckedNames("#monsterList input.leaf"),
      arts: uncheckedNames("#artList input.leaf"),
      blacklist: blacklist.slice(),
      challenges: challenges.slice(),
      challengeCount: Math.min(8, Math.max(1, parseInt($("challengeCount").value, 10) || 1)),
      t: {
        keysOnly: $("qf_keysOnly").checked,
        large: $("qf_large").checked,
        hyper: $("qf_hyper").checked,
        capture: $("qf_capture").checked,
        egg: $("qf_egg").checked,
        gathering: $("qf_gathering").checked,
        small: $("qf_small").checked,
        multi: $("qf_multi").checked,
        oneFaint: $("qf_oneFaint").checked,
        onSite: $("qf_onSite").checked,
        spArts: $("qf_spArts").checked,
        prowler: $("qf_prowler").checked,
        pQuests: $("qf_pQuests").checked,
        rollBias: $("qf_rollBias").checked,
        chaosMode: $("chChaosMode").checked,
        allLevels: disabledRanks,
      },
    };
  }

  function applyFilters(filters) {
    const t = filters.t || {};
    const applyUnchecked = (sel, names) => {
      const set = new Set(names || []);
      document.querySelectorAll(sel).forEach((i) => { i.checked = !set.has(i.dataset.name); });
    };
    applyUnchecked("#weaponList input", filters.weapons);
    applyUnchecked("#styleList input", filters.styles);
    applyUnchecked("#biasList input", filters.biases);
    applyUnchecked("#monsterList input.leaf", filters.monsters);
    applyUnchecked("#artList input.leaf", filters.arts);

    $("qf_keysOnly").checked = !!t.keysOnly;
    $("qf_large").checked = t.large !== false;
    $("qf_hyper").checked = t.hyper !== false;
    $("qf_capture").checked = t.capture !== false;
    $("qf_egg").checked = t.egg !== false;
    $("qf_gathering").checked = t.gathering !== false;
    $("qf_small").checked = t.small !== false;
    $("qf_multi").checked = t.multi !== false;
    $("qf_oneFaint").checked = t.oneFaint !== false;
    $("qf_onSite").checked = t.onSite !== false;
    $("qf_spArts").checked = t.spArts !== false;
    $("qf_prowler").checked = !!t.prowler;
    $("qf_pQuests").checked = !!t.pQuests;
    $("qf_rollBias").checked = t.rollBias !== false;

    const disabled = new Set(t.allLevels || []);
    document.querySelectorAll("#rankGroups input.leaf").forEach((cb) => {
      cb.checked = !disabled.has(parseInt(cb.dataset.rank, 10));
    });

    blacklist = Array.isArray(filters.blacklist) ? filters.blacklist.slice() : [];
    renderBlacklist();

    challenges = Array.isArray(filters.challenges) ? filters.challenges.map((c) => ({ ...c })) : [];
    chaosMode = !!t.chaosMode;
    $("chChaosMode").checked = chaosMode;
    if (filters.challengeCount) $("challengeCount").value = filters.challengeCount;
    renderChallenges();

    refreshAllGroups();
  }

  function setStatus(text, kind) {
    const el = $("statusMsg");
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
    if (text) setTimeout(() => { el.textContent = ""; el.className = "status"; }, 3000);
  }

  async function loadFiltersFromServer() {
    const res = await fetch("/api/filters");
    if (!res.ok) return;
    const filters = await res.json();
    applyFilters(filters);
  }

  // Accordion: only one section panel expanded at a time, to cut down on scrolling
  // through e.g. the Monsters/Hunter Arts lists to reach the other sections. Sections
  // vary hugely in height (Hunter Arts open is ~4x Prowler open), so swapping which one
  // is open can shrink or grow .main-scroll's content by thousands of pixels in a single
  // synchronous DOM update — enough that the browser immediately clamps an out-of-range
  // scroll position, which happens *before* any deferred (rAF/timeout) scroll adjustment
  // gets a chance to run. The fix is to reorder it: scroll the clicked header to the top
  // of .main-scroll FIRST — while it still has its old (pre-toggle) height to scroll
  // within — and only apply the open/close toggle once that settles.
  function wireAccordion() {
    const scrollEl = document.querySelector(".main-scroll");
    const panels = [...document.querySelectorAll(".panel.accordion")];
    panels.forEach((panel) => {
      const head = panel.querySelector(".acc-head");
      head.addEventListener("click", () => {
        const toggle = () => {
          const wasOpen = panel.classList.contains("open");
          panels.forEach((p) => p.classList.remove("open"));
          if (!wasOpen) panel.classList.add("open");
        };

        // Already near the top of the scroll area — no scroll needed, toggle instantly.
        const top = head.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top;
        if (top >= 0 && top <= 100) { toggle(); return; }

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          scrollEl.removeEventListener("scrollend", finish);
          toggle();
        };
        scrollEl.addEventListener("scrollend", finish, { once: true });
        setTimeout(finish, 500); // fallback for browsers without the scrollend event
        head.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function wireActions() {
    $("monCheckAll").addEventListener("click", () => {
      document.querySelectorAll("#monsterList input.leaf").forEach(i => i.checked = true);
      refreshAllGroups();
    });
    $("monUncheckAll").addEventListener("click", () => {
      document.querySelectorAll("#monsterList input.leaf").forEach(i => i.checked = false);
      refreshAllGroups();
    });
    $("artCheckAll").addEventListener("click", () => {
      document.querySelectorAll("#artList input.leaf").forEach(i => i.checked = true);
      refreshAllGroups();
    });
    $("artUncheckAll").addEventListener("click", () => {
      document.querySelectorAll("#artList input.leaf").forEach(i => i.checked = false);
      refreshAllGroups();
    });
    function artLvBulk(checked) {
      const suffix = " " + $("artLvSel").value;
      document.querySelectorAll("#artList input.leaf").forEach((i) => {
        if (i.dataset.name.endsWith(suffix)) i.checked = checked;
      });
      refreshAllGroups();
    }
    $("artLvCheck").addEventListener("click", () => artLvBulk(true));
    $("artLvUncheck").addEventListener("click", () => artLvBulk(false));

    $("previewBtn").addEventListener("click", async () => {
      $("resultBox").textContent = "Rolling…";
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assembleFilters()),
        });
        $("resultBox").textContent = await res.text();
      } catch (e) {
        $("resultBox").textContent = "Preview failed — try again.";
      }
    });

    $("saveBtn").addEventListener("click", async () => {
      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assembleFilters()),
        });
        if (res.ok) setStatus("Saved!", "ok");
        else setStatus("Save failed.", "err");
      } catch (e) {
        setStatus("Save failed.", "err");
      }
    });

    // Export/Import use the exact same JSON shape as the main site's Export/Import (this
    // page just never reads/writes the challenges/challengeCount/chaosMode fields), so a
    // file from either side loads cleanly into the other.
    $("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(assembleFilters())], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mhgu-filters.json"; a.click();
      URL.revokeObjectURL(url);
    });

    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const d = JSON.parse(e.target.result);
          applyFilters(d);
          setStatus("Imported! Click Save & Publish to keep it.", "ok");
        } catch (err) {
          setStatus("Invalid file!", "err");
        }
      };
      reader.readAsText(file);
      this.value = "";
    });
  }

  // Modals — Bot Commands / Export-Import / Help — opened from the top bar rather than
  // permanently docked, since once a streamer has copied their URLs they don't need to
  // keep looking at them.
  function wireModal(modalId, openBtnId, closeBtnId) {
    const modal = $(modalId);
    $(openBtnId).addEventListener("click", () => modal.classList.remove("hidden"));
    $(closeBtnId).addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  }
  function wireModals() {
    wireModal("botCmdModal", "botCmdBtn", "botCmdClose");
    wireModal("exportImportModal", "exportImportBtn", "exportImportClose");
    wireModal("helpModal", "helpBtn", "helpClose");
  }

  async function init() {
    buildChecklist($("weaponList"), WEAPONS, "wpn");
    buildChecklist($("styleList"), STYLES, "sty");
    buildChecklist($("biasList"), BIAS_NAMES, "bias");
    buildRankGroups();
    buildMonsterList();
    buildArtList();
    refreshAllGroups();
    initBlacklistSelects();
    renderBlacklist();
    wireChallenges();
    renderChallenges();
    wireActions();
    wireAccordion();
    wireModals();

    const authArea = $("authArea");
    const meRes = await fetch("/api/me");
    if (!meRes.ok) {
      authArea.innerHTML = "";
      $("loginBtn").addEventListener("click", () => { window.location.href = "/auth/login"; });
      return;
    }
    const me = await meRes.json();
    $("loginGate").classList.add("hidden");
    $("appArea").classList.remove("hidden");
    $("botCmdBtn").classList.remove("hidden");
    $("exportImportBtn").classList.remove("hidden");
    authArea.innerHTML = `<span class="muted">Configuring settings for <strong>${me.login}</strong></span> `
      + `<button id="logoutBtn" class="btn secondary tiny">Logout</button>`;
    $("logoutBtn").addEventListener("click", async () => {
      await fetch("/auth/logout", { method: "POST" });
      window.location.reload();
    });

    document.querySelectorAll(".cmd-row[data-path]").forEach((row) => {
      const url = `${location.origin}${row.dataset.path}?channel=${encodeURIComponent(me.login)}`;
      const value = row.dataset.format === "nightbot" ? `$(urlfetch ${url})` : url;
      row.querySelector(".botCmdCode").textContent = value;
      row.querySelector(".botCmdCopy").dataset.copy = value;
    });
    document.querySelectorAll(".copy-snippet").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.copy).then(() => {
          const orig = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => { btn.textContent = orig; }, 1500);
        });
      });
    });

    await loadFiltersFromServer();
  }

  init();
})();
