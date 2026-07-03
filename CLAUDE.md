# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo contains two separate but parallel implementations of the same app:

1. **Web app** (`docs/`) — static GitHub Pages site, no build step, pure HTML/CSS/JS
2. **Desktop app** (`MHGU Quest Randomizer/MHGU Quest Randomizer/`) — WinUI 3 app targeting .NET 8, built with Visual Studio

Both apps share the same data files and must stay in sync: every feature added to one should be reflected in the other.

## Web App

**Live URL:** https://armoredraven17.github.io/MHGU-Quest-Randomizer/

**To develop:** open `docs/index.html` in a browser (or serve via any static file server). There is no build step.

**Files:**
- `docs/index.html` — markup + modal dialogs
- `docs/styles.css` — all styling, theme CSS variables
- `docs/app.js` — all application logic (IIFE, no modules)
- `docs/data.js` — quest/art/monster data exposed as `window.MHGU_DATA`

**Critical:** GitHub Pages CDN caches assets by full URL. Every time you push changes to `styles.css`, `app.js`, or `data.js`, you **must** increment the `?v=N` query-string version on its `<link>`/`<script>` tag in `index.html`. Without this, users won't see the update until they hard-refresh.

## Desktop App

**To build and run:** open `MHGU Quest Randomizer/MHGU Quest Randomizer.slnx` in Visual Studio 2022, set configuration to `x64 | Debug`, and press F5.

**Build from CLI:**
```
msbuild "MHGU Quest Randomizer\MHGU Quest Randomizer\MHGU Quest Randomizer.csproj" /p:Platform=x64 /p:Configuration=Debug
```

The project uses **Microsoft.WindowsAppSDK 2.2.0** and **WinUI 3**. All UI is in `MainWindow.xaml` / `MainWindow.xaml.cs`; there are no additional pages or views.

JSON data files (`QuestData.json`, `Hunter Arts.json`, `LgMonsters.json`) are marked `CopyToOutputDirectory = PreserveNewest` in the `.csproj` and loaded at runtime relative to `AppContext.BaseDirectory`. Settings persist to `%LOCALAPPDATA%\MHGU Quest Randomizer\settings.json`.

## Shared Data Files (source of truth)

The root-level JSON files are the canonical data source:

| File | Contents |
|---|---|
| `QuestData.json` | All quests — type, name, level, flags (LgMonster, Capture, Hyper, Egg, etc.) |
| `LgMonsters.json` | Monster list with species grouping |
| `Hunter Arts.json` | Hunter Art names with weapon affinity ("All" or a specific weapon) |

The desktop app reads these from `AppContext.BaseDirectory`. The web app embeds them inside `docs/data.js` as `window.MHGU_DATA`. When quest/monster/art data changes, both need to be updated.

## Architecture: How the Randomizer Works

Both apps follow the same logic:

1. **Filter quest pool** — `QuestData.json` entries are filtered by quest type, level range, and category flags (hyper, capture, egg, gathering, small monsters, one-faint, on-site). Large-monster hunts are always included; all other categories are opt-in checkboxes.

2. **Pick a quest** — random selection from the filtered pool.

3. **Roll a weapon** — random pick from the user's enabled weapon list. If Prowler mode is on, "Prowler" can be rolled. After selecting a weapon, the blacklist (weapon+style combos to avoid) is applied: if all styles are blocked for the rolled weapon, reroll up to 50 times.

4. **Roll a style** — from enabled styles minus any blacklisted for the chosen weapon.

5. **Roll Hunter Arts** — style determines slot count (Adept/Aerial/Valor = 1, Guild = 2, Striker/Alchemy = 3). `rollArt` picks from `Hunter Arts.json` filtered by weapon compatibility, excluding already-picked bases (two arts can't share the same base name, e.g. "Haste Rain I" and "Haste Rain II"). Each art has a 1/3 chance of getting the `[SP]` suffix if SP Arts is enabled.

6. **Arena quests** — skip the weapon/style/art rolls; instead pick from `ArenaWeapons` or `ArenaBiases` arrays stored on the quest object itself (parsed from quest descriptions). Prowler arena quests get a bias instead.

7. **Roll challenges** — user-defined conditions (each with its own chance % and on/off toggle) are rolled alongside the result. `rollChallenges` keeps the enabled ones that pass their chance roll, then slices to the "roll up to N" count. These are optional flavor and don't affect quest/weapon selection.

## Challenges (Web)

Custom conditions the user adds in the Challenges panel (`{ text, chance, checked }`). Four unchecked presets ship in `DEFAULT_CHALLENGES`. They persist inside the `mhgu-filters` save, are included in the clipboard copy, and survive Reset Filters (like the blacklist). The desktop app does **not** have this feature yet.

## Theme System (Web)

`applyTheme(hex)` derives all CSS custom properties from a single chosen color by shifting only its lightness (via `darken`/`lighten`), so every shade keeps the color's hue and saturation:

- `--bg` (main background): `darken(c, 0.70)`
- `--bg2` (sidebar/panels/titlebar): `darken(c, 0.95)`
- Only Khezu (`#FFFFFF`, brightness > 230) triggers the light theme branch

Theme hex is persisted to `localStorage` (`mhgu-theme` key). Filter state (all checkboxes, blacklist, challenges) is also persisted (`mhgu-filters` key) and restored on load, and can be exported to / imported from a JSON file.

## Assets

```
docs/assets/
  MonsterIcons/   MHGU-<MonsterName>_Icon.webp  (icon for each monster)
  WeaponIcons/    icon_<weapon_name>_tinted.png  (per weapon type)
  ProwlerIcons/   (prowler bias icons)
  fonts/          mhfu_font.ttf
```

Icon filenames are derived programmatically: monster name spaces → underscores, weapon name normalized similarly. Missing icons fall back to `MHGU-Question_Mark_Icon.webp`.

The desktop app mirrors this under `Assets/` within the project directory.
