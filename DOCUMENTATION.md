# MHGU Quest Randomizer — Codebase Documentation

This document explains every part of the web app so you can make manual changes confidently. The desktop app mirrors the same logic in C#/WinUI 3 but is not covered here.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Data Files (source of truth)](#data-files)
3. [HTML Structure (index.html)](#html-structure)
4. [Styles (styles.css)](#styles)
5. [Application Logic (app.js)](#application-logic)
   - [Constants & Config](#constants--config)
   - [Helper Utilities](#helper-utilities)
   - [DOM Builders](#dom-builders)
   - [Level System](#level-system)
   - [Randomize Flow](#randomize-flow)
   - [Challenges](#challenges)
   - [Theme System](#theme-system)
   - [Background Picker](#background-picker)
   - [Filter Persistence](#filter-persistence)
   - [Export / Import](#export--import)
6. [localStorage Keys](#localstorage-keys)
7. [Asset Naming Conventions](#asset-naming-conventions)
8. [How to Add Things](#how-to-add-things)

---

## Project Structure

```
docs/               ← Static GitHub Pages site (no build step)
  index.html        ← All markup and modal dialogs
  styles.css        ← All styling + CSS variables
  app.js            ← All application logic (single IIFE)
  data.js           ← Quest/monster/art data as window.MHGU_DATA
  assets/
    MonsterIcons/   ← MHGU-<MonsterName>_Icon.webp
    WeaponIcons/    ← icon_<weapon_name>_tinted.png
    ProwlerIcons/   ← Palico bias icon files
    GuildCardBG/    ← HD_ui_guild_##_ID.PNG (content area backgrounds)
    fonts/          ← mhfu_font.ttf

QuestData.json      ← Canonical quest list
LgMonsters.json     ← Monster list with species grouping
Hunter Arts.json    ← Hunter Art names with weapon affinity
```

**Cache busting:** Every time `styles.css`, `app.js`, or `data.js` changes, increment the `?v=N` query string on its `<link>`/`<script>` tag in `index.html`. GitHub Pages CDN caches by full URL — without the version bump, users see stale files until they hard-refresh.

Currently: `styles.css?v=95`, `data.js?v=27`, `app.js?v=109`

---

## Data Files

All three root-level JSON files are the canonical data source. The web app embeds them in `docs/data.js` as `window.MHGU_DATA = { quests: [...], monsters: [...], arts: [...] }`.

### QuestData.json

An array of quest objects. Every quest has:

| Field | Type | Description |
|---|---|---|
| `Type` | string | `"Village"`, `"Hub"`, `"Pub"`, `"Special Permits"`, `"Events"`, `"Arena"` |
| `Name` | string | Full quest name (e.g. `"Village 1★ // Find the Ferns"`) |
| `Main` | string | Main objective text (e.g. `"Slay a Rathalos"`) |
| `Monster` | string | Primary monster name (empty string if none) |
| `Monsters` | string[] | All monsters involved (used for multi-monster filter) |
| `Level` | number | Quest rank level within its type (1-based for all types) |
| `LgMonster` | boolean | Quest involves at least one large monster |
| `Prowler` | boolean | Prowler-only quest |
| `Hyper` | boolean | Hyper monster quest |
| `Egg` | boolean | Egg delivery quest |
| `Gathering` | boolean | Gathering quest |
| `SmMonsters` | boolean | Small monster slaying quest |
| `Capture` | boolean | Capture quest |
| `OnSite` | boolean | Special Permit: on-site items restriction |
| `OneFaint` | boolean | Special Permit: one-faint restriction |
| `Locale` | string | Map location (e.g. `"Misty Peaks"`, `"Arena"`) |
| `ArenaWeapons` | string[] | (Arena only) Preset weapon options the player can bring |
| `ArenaBiases` | string[] | (Arena/Prowler only) Preset bias options |

**Special Permits naming convention:** `"<DeviantName> <Tier>: <QuestName>"` — e.g. `"Redhelm IX: ..."`. The tier (I–EX) is parsed from the name by `spTier()`.

### LgMonsters.json

An array of monster objects:

```json
{ "MonsterName": "Rathalos", "Species": "Flying Wyvern" }
```

Used to build the Monsters filter tree, grouped by `Species`.

### Hunter Arts.json

An array of art objects:

```json
{ "HunterArtName": "Absolute Evasion", "Weapon": "All" }
{ "HunterArtName": "Haste Rain I",      "Weapon": "Bow" }
```

`Weapon` is either `"All"` (any hunter can use it) or a specific weapon name using `"Sword and Shield"` (note: `and`, not `&`). Arts come in up to three levels (e.g. `"Haste Rain I"`, `"Haste Rain II"`, `"Haste Rain III"`).

---

## HTML Structure

`docs/index.html` — single page, no JavaScript frameworks.

### Page skeleton

```
#app (flex column, full viewport)
├── header.titlebar.titlebar-header   ← Title bar + icon buttons
└── main.layout (flex row)
    ├── aside.sidebar                 ← All filter panels
    └── section.content               ← Quest pickers + result card
```

### Title bar buttons (by ID)

| ID | Icon | Opens |
|---|---|---|
| `helpBtn` | `?` | `#helpModal` |
| `statsBtn` | `∑` | `#statsModal` |
| `aboutBtn` | `ⓘ` | `#aboutModal` |
| `themeBtn` | `⚙` | `#themeModal` |

### Sidebar panels

Each panel is a `<section class="panel" data-open="false">` with a `<button class="panel-head">` toggle and a `<div class="panel-body">`. Opening/closing is driven by `data-open` — CSS shows `panel-body` only when `data-open="true"`. The panels act as an **accordion**: the click handler in `app.js` closes every panel before opening the clicked one, so only one is ever open at a time.

Above the panels is the **Reset Filters** button plus **Export** / **Import** buttons (with a hidden `#importFile` input).

| Panel | Key IDs inside |
|---|---|
| Quest Filters | `f_large`, `f_hyper`, `f_capture`, `f_multi`, `f_egg`, `f_gathering`, `f_small`, `f_oneFaint`, `f_onSite`, `#allTypeTree` |
| Monsters | `#monsterTree`, `monExpand`, `monCollapse` |
| Weapons | `#weaponList` (built by JS) |
| Styles | `#styleList` (built by JS) |
| Hunter Arts | `f_spArts`, `artLvSel`, `artLvCheck`, `artLvUncheck`, `#artTree`, `artExpand`, `artCollapse` |
| Restrictions | `blWeapon`, `blStyle`, `blAdd`, `#blList` |
| Challenges | `chText`, `chChance`, `chAdd`, `challengeCount`, `#chList` |
| Prowler | `p_prowler`, `p_quests`, `#biasList` |

### Content area

```
section.content
├── div.quest-pickers
│   ├── label.field → select#questType
│   ├── label.field#fromField → select#fromLevel
│   ├── label.field → select#toLevel  (span#toLabel shows "Up to Level")
│   └── button#rollBtn ("Randomize!")
└── div.result-card
    ├── p#placeholder (shown before first roll)
    └── div#result.hidden (shown after roll)
        ├── div.rc-title → span#r_name + badge pills
        ├── div.rc-locale → div#r_locale
        ├── div.rc-main → div#r_main
        ├── div.rc-icon → img#r_target + img#r_hyperOverlay
        ├── div.rc-loadout → weapon row + #r_styleBlock (style + arts)
        ├── div#r_challenges.hidden → label + ul#r_challengeList (rolled challenges)
        └── div.rc-footer → button#copyResultBtn
```

### Modals

All modals use class `modal hidden` (fixed overlay). They show/hide via toggling `hidden`. Clicking the backdrop (the modal itself, not the card) closes them.

| Modal ID | Purpose |
|---|---|
| `helpModal` | How-to instructions |
| `resetConfirmModal` | Confirmation before resetting filters |
| `statsModal` | Possible combinations math |
| `aboutModal` | Attributions / credits |
| `themeModal` | Color swatch picker + content background picker |

---

## Styles

`docs/styles.css` — no preprocessor, plain CSS.

### CSS Custom Properties (variables)

All set at runtime by `applyTheme()` in `app.js`. The `:root` defaults are a neutral grey fallback.

| Variable | Role |
|---|---|
| `--bg` | Main background (content area, body) |
| `--bg1` | Panel body background (slightly lighter/different from `--bg2`) |
| `--bg2` | Sidebar / panel header / titlebar / modal card background |
| `--hover` | Hover state background |
| `--accent` | Accent color (buttons, checkbox fill, active states) |
| `--accent-hover` | Accent hover state |
| `--text` | Primary text color |
| `--text-dim` | Dimmed text (subtext, secondary labels) |
| `--text-hint` | Hint text color (`.hint` paragraphs) |
| `--line` | Border/divider color |
| `--card` | Subtle card overlay (result card tint) |

### Background image layers

Several elements use multi-layer `background-image` with a semi-transparent color overlay over a texture. The pattern is always:

```css
background-image:
  linear-gradient(color-mix(in srgb, var(--bg2) 80%, transparent),
                  color-mix(in srgb, var(--bg2) 80%, transparent)),
  url('assets/texture.png');
```

The `linear-gradient` with the same color for both stops acts as a solid color layer. `color-mix()` makes it semi-transparent. This goes in `background-image` (not `background-color`) because CSS only supports one `background-image` stack.

| Element | Texture | Overlay variable |
|---|---|---|
| `.titlebar-header` | `titlebar-background.png` | `--bg2` at 70% |
| `.sidebar` | `sidebar-background-texture1.png` | `--bg2` at 50% |
| `.panel-head` | `banner-background.png` | `--bg2` at 80% |
| `.panel-body` | `panel-body-bg.png` | `--bg1` at 60% |
| `.result-card` | `result-card-bg.png` | none (pure image) |

### Key layout classes

| Class | Role |
|---|---|
| `.layout` | `display:flex; flex-direction:row` — sidebar + content side by side |
| `.sidebar` | Fixed 300px width, scrollable, flex column |
| `.content` | `flex:1`, receives guild card `background-image` via JS |
| `.panel` | Collapsible section container |
| `.panel-head` | Clickable panel toggle (full-width button) |
| `.panel-body` | Hidden until `data-open="true"` on parent `.panel` |
| `.quest-pickers` | Flex row, `justify-content:center` |
| `.result-card` | Fixed aspect ratio (775:480), `position:relative`, container for absolutely-positioned result elements |
| `.tree` | Collapsible checkbox tree (monsters and hunter arts) |
| `.agrp` / `.akids` | Hunter arts tree group and its children |
| `.species` / `.children` | Monster tree group and its children |

### Result card positioning

Everything inside `.result-card` is `position:absolute` with percentage-based `top`/`left`/`right`. Sizes use `cqi` (container query inline units) so they scale with card width:

| Element | Position |
|---|---|
| `.rc-title` (quest name + badges) | `top:18%` |
| `.rc-icon` (monster icon) | `top:30%; left:43%; width:13%` |
| `.rc-locale` | `top:61%; left:7%; width:22%` |
| `.rc-main` (main objective) | `top:64%; left:40%` |
| `.rc-loadout` (weapon/style/arts) | `top:67%; left:6.5%` |
| `.rc-footer` (copy button) | `bottom:1%; right:1.5%` |

### Theme modal CSS

| Class | Role |
|---|---|
| `.swatches` | 4-column grid of color swatches |
| `.swatch` | Individual color tile; `.sel` adds white border |
| `.swatch-icon` | Monster icon overlaid on swatch |
| `.modal-divider` | `<hr>` styled as a thin line |
| `.bg-grid` | 4-column grid of background thumbnails, scrollable |
| `.bg-thumb` | Individual background tile (16:9 aspect); `.sel` adds white border |
| `.bg-thumb.none-thumb` | "None" tile (no image) |

---

## Application Logic

`docs/app.js` — one large IIFE (`(function(){ ... })()`). No modules, no imports. All state is local to the IIFE except `window.MHGU_DATA` which comes from `data.js`.

### Constants & Config

```js
const DATA = window.MHGU_DATA   // { quests:[], arts:[], monsters:[] }
const $ = id => document.getElementById(id)
const rand = n => Math.floor(Math.random() * n)
const pick = arr => arr[rand(arr.length)]
```

**`WEAPONS`** — ordered array of the 14 weapon types (strings). Order matches the sidebar display.

**`WEAPON_COLORS`** — map of weapon name → hex color string. Used by `setWeaponStyle()` to color the weapon chip on the result card. Also has `"Prowler"` entry.

**`STYLES`** — `["Guild","Striker","Adept","Aerial","Valor","Alchemy"]`

**`WEAPON_ABBREV`** — weapon name → short form for the Restrictions panel (e.g. `"Great Sword"` → `"GS"`).

**`BIASES`** — array of `[name, iconFilename]` pairs for Prowler biases. Eight entries.

**`BIAS_FILE`** — `Object.fromEntries(BIASES)` — name → icon filename lookup.

**`DEVIANT_FULL`** — maps deviant prefix (lowercase) to full monster name. Used by `spDeviant()` to determine which monster icon to show for a Special Permit quest.

**`SP_TIERS`** — maps tier label to numeric value: `{I:1, II:2, ..., EX:16}`.

**`LEVELS`** — level dropdown options for each quest type. Each entry is `[displayLabel, numericValue]`.

```js
LEVELS.ALL    // 45 entries covering every rank across all types, with numeric values 0–44
LEVELS.Village // ["1★",1] through ["10★ Advanced",11]
LEVELS.Hub     // ["1★",1] through ["8★",8]
LEVELS.Pub     // ["G1★",1] through ["G4★ (HR13+)",5]
LEVELS.Arena   // ["Normal",1], ["Challenge",2]
LEVELS["Special Permits"]  // ["I",1] through ["EX",16]
LEVELS.Events  // ["Low Rank",1], ["High Rank",2], ["G Rank",3]
```

**`COLORS`** — array of `[displayName, hexColor]` (or `[displayName, hex, iconName]` where icon name differs from display name). The theme color swatches. Named after monsters associated with each hue.

**`COLORS_HEX`** — hex → display name lookup (used to update the title bar icon on theme change).

**`COLORS_ICON`** — display name → icon name override (for swatches with shortened labels like "G. Magala" → icon file uses "Gore Magala").

**`GUILD_BG_FILES`** — array of 79 PNG filenames in `assets/GuildCardBG/`, generated as `HD_ui_guild_01_ID.PNG` … `HD_ui_guild_79_ID.PNG` (sequential, no gaps). The order reflects the user's own curated groupings, not the original in-game asset IDs.

---

### Helper Utilities

**`escapeHtml(s)`** — escapes `&`, `<`, `>`, `"` for safe DOM insertion.

**`normWeapon(w)`** — lowercases and converts ` & ` to ` and ` so weapon names match art weapon fields (arts use `"Sword and Shield"`, weapons use `"Sword & Shield"`).

**`artBase(name)`** — strips trailing level suffix: `"Haste Rain III"` → `"Haste Rain"`. Used to prevent two arts of the same base from being rolled together.

**`allRank(quest)`** — maps a quest object to its unified 0–44 rank in `LEVELS.ALL`:
- Village levels 1–11 → ranks 0–10
- Hub levels 1–8 → ranks 11–18
- Pub (G-Rank) levels 1–5 → ranks 19–23
- Special Permits tiers I–EX → ranks 24–39
- Events levels 1–3 → ranks 40–42
- Arena levels 1–2 → ranks 43–44

**`typeValToAllRank(type, val)`** — same mapping but takes a quest type string and the dropdown value rather than a quest object. Used by `fillLevels()` and `syncTypeOptions()`.

**`spTier(name)`** — parses the tier from a Special Permit quest name (e.g. `"Redhelm IX: ..."` → `9`).

**`spDeviant(name, monster)`** — extracts the full deviant monster name from a Special Permit quest name for icon lookup. Falls back to `DEVIANT_FULL` lookup.

**Color math (all take `[r,g,b]` array, return `[r,g,b]` array):**

| Function | What it does |
|---|---|
| `hexRgb(hex)` | `"#rrggbb"` → `[r,g,b]` |
| `rgbToHsl([r,g,b])` | RGB → `[h,s,l]` (all 0–1) |
| `hslToRgb([h,s,l])` | HSL → `[r,g,b]` (0–255) |
| `darken(rgb, f)` | Multiplies lightness by `f` (0 = black, 1 = same) |
| `lighten(rgb, b)` | Lightness += `(1 - l) * b` |
| `css([r,g,b])` | Returns `"rgb(r,g,b)"` string for CSS |

**`clamp(n)`** — clamps to 0–255 (integer).  
**`clamp01(n)`** — clamps to 0–1.

---

### DOM Builders

These functions run once at startup to build all dynamic UI from data.

**`buildChecklist(container, items, idPrefix, withIcon)`** — creates `<label class="chk"><input ...></label>` for each item. Used for Weapons (`w_0`…`w_13`) and Styles (`s_0`…`s_5`). IDs are `idPrefix + index`.

**`initBlacklist()` (IIFE)** — populates the Restrictions dropdowns (`blWeapon`, `blStyle`) and wires up the Add button. The blacklist array lives in the outer scope as `let blacklist = []`.

**`renderBlacklist()`** — re-renders the `#blList` container from the current `blacklist` array. Each row has a `×` button that splices its entry out.

**`buildTree()` (IIFE, monsters)** — builds the collapsible monster tree in `#monsterTree`. Groups monsters by `Species`, sorts alphabetically. Each group has a twist toggle (`▸`/`▾`), a group-level checkbox, and individual monster checkboxes. Clicking the species name or twist expands/collapses.

**`includedMonsters()`** — returns a `Set` of lowercased monster names whose checkboxes are checked.

**`setAllMonsters(v)`** — sets every monster checkbox to `v`, resets indeterminate states.

**`buildArtTree()` (IIFE)** — builds the 3-level Hunter Arts tree in `#artTree`: Weapon → Art Base → Level. Arts with only one level appear as direct leaves (no sub-group). Syncing between group checkboxes and leaves uses `onArtLeaf()` / `onArtGroup()`.

**`refreshArtGroups()`** — recomputes checked/indeterminate state of all art group checkboxes from their leaves. Called after any leaf change.

**`excludedArts()`** — returns a `Set` of art names whose checkboxes are unchecked.

**`setAllArts(v)`** — sets all art leaves to `v` and refreshes groups.

**`artLvBulk(checked)`** — checks/unchecks all arts whose name ends with the suffix from `artLvSel` (e.g. `" I"`, `" II"`, `" III"`). Used by the "Check All" / "Uncheck All" level buttons.

**`buildBgGrid()` (IIFE)** — builds the background picker grid in `#bgGrid`. First tile is "None" (clears the background), then one tile per `GUILD_BG_FILES` entry.

**`buildSwatches()` (IIFE)** — builds the color swatch grid in `#swatches`. One swatch per `COLORS` entry.

**`buildAllTypeTree()` (IIFE)** — builds the Quest Type Filters tree in `#allTypeTree`. Six groups (Village, Hub, G-Rank, Special Permits, Events, Arena). Each group contains per-level leaf checkboxes with IDs `f_all_lv_0` through `f_all_lv_44`. Group checkbox IDs: `f_all_grp_village`, `f_all_grp_hub`, `f_all_grp_pub`, `f_all_grp_sp`, `f_all_grp_events`, `f_all_grp_arena`. Arena is off by default; all others on.

---

### Level System

**`fillLevels()`** — populates `#fromLevel` and `#toLevel` dropdowns based on the current `questType` value. Filters out any levels whose `f_all_lv_N` checkbox is unchecked. Sets From to index 0, To to the last option.

**`syncTypeOptions()`** — hides/shows each `<option>` in `#questType` based on whether any levels are enabled for that type. If the current selection is hidden, clears it.

**`syncLevels(changed)`** — enforces From ≤ To: if From moves past To, To follows; if To moves before From, From follows.

**`updateRollBtn()`** — enables/disables `#rollBtn`. Disabled if: no type selected, no level, no weapon checked (for non-Arena), no style checked, no monster checked, or Prowler mode on with no bias checked.

---

### Randomize Flow

**`randomize()`** — called when the Randomize button is clicked.

1. Reads `questType`, `fromLevel`, `toLevel` values.
2. Builds the filter state object `f` with booleans for each checkbox.
3. Builds `f.allLevels` — a `Set<number>` of all enabled level ranks (0–44).
4. Filters `DATA.quests` into a `pool`:
   - `allRank(q)` must be in `f.allLevels` (global level gate — applies to every quest type).
   - If type is `"ALL"`: rank must be within `fromLv`–`toLv`.
   - Otherwise: quest type must match, and level within `fromLv`–`toLv`.
   - Quest category must pass: `LgMonster && !Capture` (always included), or `Capture && f.capture`, or `Prowler && f.pQuests`, etc.
   - Gate flags: Hyper, OneFaint, OnSite, MultiMonster each exclude the quest if their flag is off.
   - Monster filter: if any monsters are excluded, the quest's `Monsters` array must be a subset of included monsters.
5. Picks a random quest from the pool. If pool is empty, uses `{}` (renders empty result).
6. Calls `renderResult(quest, type)`.

**`renderResult(quest, type)`** — populates the result card DOM.
- Sets name, main objective, locale, badge pills.
- Special Permit EX quests get a magenta name color.
- Monster icon: for SP quests, `spDeviant()` resolves the deviant name; uses `monsterIcon()`.
- **Arena path:** rolls from `ArenaWeapons` (hunter) or `ArenaBiases` (Prowler arena), skips style/arts. Falls back to `"Set " + rand(5)` if neither field exists.
- **Weapon roll:** from checked weapons + optionally "Prowler" if enabled. Rerolls up to 50× if the blacklist blocks all styles for the chosen weapon.
- **Prowler weapon:** shows bias instead of style. Picks from enabled biases, shows the bias icon.
- **Style roll:** from checked styles, minus blacklisted styles for the chosen weapon.
- **Art roll:** slot count by style — Adept/Aerial/Valor = 1, Guild = 2, Striker/Alchemy = 3.
  - SP Arts: each art has 1/3 chance of `" SP"` suffix. Striker/Guild: at most one SP art per roll (subsequent arts skip SP if an earlier one got it). Alchemy: each art rolls independently.

**`rollArt(weapon, ex1, ex2, excl)`** — picks a random art compatible with `weapon`, excluding names in `excl` Set and arts sharing a base name with `ex1` or `ex2`. Tries up to 1000 times.

**`maybeSP(art)`** — returns `art + " SP"` with 1/3 probability if SP Arts is enabled.

**`setWeaponStyle(el, name)`** — applies color chip styling to an element using `WEAPON_COLORS`. If no color found, just sets `color: var(--text)`.

**`copyResultBtn` listener** — reads displayed result and formats it as `Quest: ... | Locale: ... | Weapon: ... | Style: ... | Hunter Art(s): ... | Challenges: ...` for clipboard. Lines only appear if they have content (e.g. no `Challenges:` line if none rolled).

---

### Challenges

User-defined conditions (e.g. "No Armor") that roll alongside the quest. Each entry is `{ text, chance, checked }` where `chance` is a percentage (1–100) and `checked` toggles it on/off.

**`DEFAULT_CHALLENGES`** — the four presets ("No Armor", "No Items", "No Active Skills", "Use Joke Weapon"), each at 10% and unchecked. `challenges` is initialized to a copy of these, so a first-time visitor sees them before any save exists. `loadFilters()` overwrites `challenges` only if the saved state actually contains a `challenges` array.

**`renderChallenges()`** — rebuilds the `#chList` rows. Each row is an enable checkbox, an editable text input (`maxLength` 21), an editable chance number input, a `%` label, and a `×` remove button. Editing any field writes straight back into `challenges[i]` and calls `saveFilters()`.

**`rollChallenges()`** — returns the challenges to display for a roll: keeps only enabled ones, rolls each against its own `chance`, shuffles, and slices to the "roll up to N" count (`#challengeCount`, capped at 8). Called at the end of `renderResult()`; the `#r_challenges` block is shown only when at least one rolled.

**Presets and Reset:** `doReset()` deliberately does **not** touch `challenges` — user-authored content survives a filter reset, same as the blacklist.

---

### Theme System

**`applyTheme(hex)`** — derives all CSS variables from a single hex color and writes them to `document.documentElement.style`.

Brightness is computed as: `r*0.299 + g*0.587 + b*0.114`. If `> 230`, uses the light branch.

| Variable | Dark branch | Light branch |
|---|---|---|
| `--bg` | `darken(c, 0.70)` | `darken(c, 0.95)` |
| `--bg1` | `darken(c, 0.80)` | `darken(c, 0.80)` |
| `--bg2` | `darken(c, 0.95)` | `darken(c, 0.90)` |
| `--hover` | `darken(c, 0.30)` | `darken(c, 0.30)` |
| `--accent` | `darken(c, 0.7)` | `darken(c, 0.5)` |
| `--accent-hover` | `darken(c, 0.7)` | `lighten(c, 0.1)` |
| `--accent-color` | *(not set)* | `darken(c, 0.1)` |
| `--text` | `#ffffff` | `#000000` |
| `--hint` | `#ffffff` | `#000000` |
| `--text-dim` | `#fffffff5` | `#000000` |
| `--line` | `rgba(11,8,8,0.12)` | `rgba(0,0,0,0.15)` |
| `--card` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.12)` |

Also: saves hex to `localStorage["mhgu-theme"]`, marks the matching swatch `.sel`, and updates the title bar icon to the monster associated with that hex.

---

### Background Picker

**`applyBg(file)`** — sets `backgroundImage` on `.content`. If `file` is non-empty, uses `url('assets/GuildCardBG/${encodeURIComponent(file)}')`. Saves to `localStorage["mhgu-bg"]`. Updates `.bg-thumb.sel`.

The "None" tile passes `""` to `applyBg`, which clears the background image (just the theme color shows).

---

### Filter Persistence

**`saveFilters()`** — serializes all filter state to `localStorage["mhgu-filters"]` as JSON:
```js
{
  weapons: [...unchecked weapon names],
  styles: [...unchecked style names],
  biases: [...unchecked bias names],
  monsters: [...unchecked monster names],
  arts: [...unchecked art names],
  blacklist: [{weapon, style}, ...],
  challenges: [{text, chance, checked}, ...],
  challengeCount: <number>,
  t: {
    large, hyper, capture, egg, gathering, small, multi,
    oneFaint, onSite, spArts, prowler, pQuests,
    allLevels: [...rank indices that are unchecked]
  }
}
```

Saves unchecked names (not checked) so that newly added data defaults to included. `challenges` is the full array (text/chance/checked), so the whole condition list travels with the save.

**`loadFilters()`** — reads and applies the saved state. Called once at startup. Old saves without `allLevels` just skip that section and use defaults.

**`refreshMonsterGroups()`** — recomputes indeterminate state of monster species group checkboxes. Called after `loadFilters()`.

A single delegated `change` listener on `.sidebar` calls `saveFilters()` on any input change, so saves happen automatically.

**`doReset()`** — restores all filters to defaults:
- Checks all quest category flags (Large Monsters, Hyper, Capture, Multi, Egg, Gathering, Small, One Faint, On-Site); turns Prowler options off.
- Sets all level checkboxes: Village/Hub/Pub/SP/Events on, Arena off.
- Re-checks all weapons, styles, biases.
- Re-checks all monsters and arts.
- Clears blacklist.
- Enables SP Arts.
- **Does not** clear challenges — user-authored conditions are preserved.

---

### Export / Import

Sit above the sidebar panels as two `.btn.tiny` buttons plus a hidden `#importFile` input.

**Export** (`exportBtn`) — calls `saveFilters()` to flush current state, then downloads `localStorage["mhgu-filters"]` verbatim as `mhgu-filters.json` via a temporary `Blob` + object URL.

**Import** (`importBtn`) — clicking it opens the hidden file picker. On file selection, the JSON is parsed; all weapon/style/bias/monster/art checkboxes are reset to checked first (so the loaded "unchecked names" apply cleanly), the parsed object is written to `localStorage["mhgu-filters"]`, and `loadFilters()` re-applies everything. A malformed file briefly flashes "Invalid file!" on the button instead of throwing.

---

## localStorage Keys

| Key | Format | Description |
|---|---|---|
| `mhgu-theme` | `"#rrggbb"` | Active theme hex color |
| `mhgu-bg` | `"HD_ui_guild_##_ID.PNG"` or `""` | Active content background filename |
| `mhgu-filters` | JSON string | Full filter state (see `saveFilters` above) |

Location on Windows: `%APPDATA%\..\Local\<browser>\User Data\Default\Local Storage\leveldb\`

---

## Asset Naming Conventions

### Monster icons
`assets/MonsterIcons/MHGU-<MonsterName>_Icon.webp`

Spaces in the monster name become underscores. Example: `"Yian Garuga"` → `MHGU-Yian_Garuga_Icon.webp`

Built by `monsterIcon(name)`. Falls back to `MHGU-Question_Mark_Icon.webp` on 404.

### Weapon icons
`assets/WeaponIcons/icon_<weapon_name>_tinted.png`

Name is lowercased, ` & ` becomes `_and_`, spaces become `_`. Example: `"Sword & Shield"` → `icon_sword_and_shield_tinted.png`

Built by `weaponIcon(w)`. Falls back to hidden if 404.

### Prowler bias icons
`assets/ProwlerIcons/<filename>`

Filenames stored directly in the `BIASES` array (e.g. `"FourthGen-Palico_Icon_Blue.webp"`).

### Guild card backgrounds
`assets/GuildCardBG/HD_ui_guild_##_ID.PNG`

Numbered sequentially 01–79, no gaps. `GUILD_BG_FILES` generates the list rather than hardcoding it. A matching WebP thumbnail (192×108, quality 72) lives in `assets/GuildCardBG/thumbs/` under the same base name — used by the picker grid, while the full PNG is preloaded on hover and applied on click. Renumbering the set means renaming both the PNG and its thumbnail to keep them paired.

---

## How to Add Things

### Add a new quest
Edit `QuestData.json` (root-level), then copy the updated array into `docs/data.js` (replacing the existing `quests` array inside `window.MHGU_DATA = {...}`). Bump `data.js?v=N` in `index.html`.

### Add a new monster
Add to `LgMonsters.json` and mirror in the `monsters` array in `docs/data.js`. It will automatically appear in the Monsters filter tree, grouped by its `Species`. Add an icon at `assets/MonsterIcons/MHGU-<Name>_Icon.webp`. Bump `data.js?v=N`.

### Add a new Hunter Art
Add to `Hunter Arts.json` and mirror in the `arts` array in `docs/data.js`. It will automatically appear in the Hunter Arts tree under the correct weapon group. If it's a leveled art (e.g. adding a level IV), the existing base-group sub-node will expand. Bump `data.js?v=N`.

### Add a new theme color
Add an entry to the `COLORS` array in `app.js`:
```js
["MonsterName", "#rrggbb"]            // display name, hex
["MonsterName", "#rrggbb", "IconName"] // optional 3rd field if icon name differs
```
Place it in the correct hue position (array is ordered chromatically). Bump `app.js?v=N`.

### Add a new guild card background
Drop the PNG into `docs/assets/GuildCardBG/` and add the filename to `GUILD_BG_FILES` in `app.js`. Bump `app.js?v=N`.

### Add a new weapon
Add to the `WEAPONS` array (and `WEAPON_ABBREV`, `WEAPON_COLORS`). Add the icon at `assets/WeaponIcons/icon_<name>_tinted.png`. Update the combinations math in `#statsModal` in `index.html`. Both web and desktop app need updating. Bump `app.js?v=N`.

### Change the level filter defaults
In `buildAllTypeTree()`, each group has `on: true/false`. Set `on: false` to disable that entire group by default. Individual levels can't have different defaults per-level in the current code — they all follow the group default.

### Change theme variable derivation
Edit `applyTheme()` in `app.js`. Modify the `darken`/`lighten` factor for the relevant variable — these only shift lightness, so hue and saturation stay tied to the chosen color. (If you need saturation control, add a small `desaturate` helper alongside `darken`/`lighten`: `[h, clamp01(s*f), l]` where `f` is the saturation multiplier, 0 = full grey, 1 = no change.)

### Modify panel textures
Replace the PNG at `docs/assets/`. The filename is referenced in `styles.css`. If you change the filename, update the `url(...)` in `styles.css` and bump `styles.css?v=N`.

---

## Deployment

The site deploys automatically via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `master`. The workflow:
1. Checks out the repo
2. Configures GitHub Pages
3. Uploads the `docs/` folder as the artifact
4. Deploys to Pages

`cancel-in-progress: true` ensures that if two pushes queue up, the second cancels the first's upload before it can conflict.

The live URL is: https://armoredraven17.github.io/MHGU-Quest-Randomizer/
