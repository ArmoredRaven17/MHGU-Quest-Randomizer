# MHGU Quest Randomizer

A randomizer for Monster Hunter Generations Ultimate quests.

**[Open the web app →](https://armoredraven17.github.io/MHGU-Quest-Randomizer/)**

Pick a quest type and level range, filter by monsters, weapons, styles, and Hunter Arts, then hit Randomize to get a quest and a full loadout.

## Features

- **Randomize a full hunt** — quest, weapon, style, and Hunter Arts, with Arena weapon sets and Prowler biases handled automatically.
- **Deep filtering** — by quest category, individual level, monster, weapon, style, and Hunter Art (down to the individual level of each art).
- **Restrictions** — blacklist weapon + style combos you never want rolled together.
- **Challenges** — add your own extra conditions (e.g. "No Armor") that roll alongside the quest, each with its own chance and on/off toggle.
- **Themes & backgrounds** — recolor the whole app from a monster-themed palette and set a Guild Card background.
- **Export / Import** — save your filters and challenges to a file and load them back later.
- Everything is saved in your browser between visits.

## Repository layout

This repo holds two parallel implementations of the same app:

- **Web app** (`docs/`) — static GitHub Pages site, no build step. See [DOCUMENTATION.md](DOCUMENTATION.md) for a full code walkthrough.
- **Desktop app** (`MHGU Quest Randomizer/`) — WinUI 3 / .NET 8, built with Visual Studio.

Both read the same canonical data files: `QuestData.json`, `LgMonsters.json`, and `Hunter Arts.json`.
