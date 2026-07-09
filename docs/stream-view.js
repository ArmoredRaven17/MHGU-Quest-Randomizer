"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const RESULT_KEY = "mhgu-last-result";

  // Mirror-image of broadcastResult() in app.js — writes each field back into the
  // matching element instead of reading it.
  function hydrate(data) {
    $("placeholder").classList.add("hidden");
    $("result").classList.remove("hidden");

    $("r_name").textContent = data.name || "";
    $("r_name").style.color = data.nameColor || "";
    $("r_main").textContent = data.main || "";
    $("r_locale").textContent = data.locale || "";

    Object.entries(data.pills || {}).forEach(([id, hidden]) => {
      const el = $(id); if (el) el.classList.toggle("hidden", !!hidden);
    });

    $("r_target").src = data.targetSrc || "";
    $("r_hyperOverlay").classList.toggle("hidden", !!data.hyperHidden);

    $("r_weapon").textContent = data.weapon || "";
    $("r_weapon").style.cssText = data.weaponCss || "";
    $("r_weaponIcon").classList.toggle("hidden", !!data.weaponIconHidden);
    $("r_weaponIcon").src = data.weaponIconSrc || "";

    $("r_styleBlock").classList.toggle("hidden", !!data.styleBlockHidden);
    $("r_styleLabel").textContent = data.styleLabel || "";
    $("r_style").textContent = data.style || "";
    $("r_biasIcon").classList.toggle("hidden", !!data.biasIconHidden);
    $("r_biasIcon").src = data.biasIconSrc || "";

    const arts = $("r_arts"); arts.innerHTML = "";
    (data.arts || []).forEach(t => {
      const li = document.createElement("li"); li.textContent = t; arts.appendChild(li);
    });

    $("r_challenges").classList.toggle("hidden", !!data.challengesHidden);
    const chList = $("r_challengeList"); chList.innerHTML = "";
    (data.challenges || []).forEach(t => {
      const li = document.createElement("li"); li.textContent = t; chList.appendChild(li);
    });
  }

  function loadLatest() {
    let data; try { data = JSON.parse(localStorage.getItem(RESULT_KEY) || "null"); } catch (e) {}
    if (data) hydrate(data);
  }

  // The "storage" event only fires in OTHER same-origin windows/tabs than the one that
  // wrote the change — exactly what's needed here, since the main app window is the writer.
  window.addEventListener("storage", (e) => {
    if (e.key === RESULT_KEY && e.newValue) {
      try { hydrate(JSON.parse(e.newValue)); } catch (err) {}
    }
  });

  loadLatest();
})();
