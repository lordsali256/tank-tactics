# Tank Tactics

A combined-arms arena roguelite inspired by Robocode. Play on PC or Android. Every run starts with one tank against one AI tank with 120 HP. Hero units remain a future update.

## Play and scripts

Deploy sits above the battlefield and stays accessible while scrolling. No model connection is required. Ten unit types unlock gradually, including helicopters at Round 6. AI damage is reduced 20%; enemy count grows every four rounds and tiers every eight.

Each unit has an independent basic nearest-target/range script. There is no in-game programming chatbot or stance compiler. Open **Paste scripts**, select an individual unit or the optional squad coordination script, paste plain SquadScript, then **Validate & save script**. Copy the complete reference at **Function documentation** to any external LLM you prefer. Invalid scripts cannot replace saved scripts. Unit scripts and squad orders share the latest 3/5/7 active command slots; squad orders run after unit orders. Default units do not follow/protect/concentrate fire automatically.

[Grouped function reference](docs/SQUADSCRIPT.md), also bundled as `functions.html`, explains every core command and 50 additional functions, conditions, selectors, priorities, examples and fixed costs/cooldowns. The reference page includes a full-text copy button and manual-copy fallback.

Victory offers three recruit choices and three permanent upgrade choices. Select the unit to receive the upgrade. Permanent bonuses are smaller (+2% damage/speed, +1% resistance, etc.), capped at twenty purchases per category, and never added to scripts. Maxed choices grant thirty credits. Bonuses stay with that unit across rounds and combining; a new run assembles a new squad. Gear, slots, currencies and field bases persist across runs.

The store sells slots, unlocked recruits, weapons, armor and utility equipment. Each unit has its own name, script, equipment, cosmetic paint and upgrades. Combining preserves the selected unit's identity. Retiring awards at most five cosmetic tokens. Collection import/export and latest-battle replays are available.

## Graphics and combat

Three.js WebGL 3D ships offline in the APK. Four maps cover ten times the original arena area. Four building styles have varied roofs, stepped towers and industrial details. Destroyed buildings break into four or five animated chunks, then remain as rubble. A projected compatibility renderer allows campaign play when WebGL is unavailable.

Eight initial pickups, thirty-percent building loot and a ten-unused-drop cap keep the battlefield readable. Health, ammo, shield and overdrive affect actual combat and have visible feedback. Dead unit meshes disappear. Infantry rifles are weak against armored tanks; dedicated rocket troops retain antiarmor damage. Thirty-nine distinct stats are shown in Unit stats.

## Multiplayer and leaderboard

Publish a defense in Multiplayer, then attack a random real player's saved defense on the same map within 35% of your squad strength. Defenders can be offline. When no eligible player exists, the game saves your defense and reports the empty pool. Invite matches remain available.

The server controls combat and records wins/losses once per random match. A leaderboard lists published player defenses ordered by wins, losses and last update. Profile edit tokens never appear in leaderboard output. Sessions expire after fifteen minutes. Local collections and imported progression are trusted prototype data, so this is not a competitive ranked economy. Internet play follows the Site's existing sharing settings. Android multiplayer uses the local bridge over USB; campaign and bundled documentation work offline.

## Build and test

`node local/build-function-docs.mjs` generates Markdown and the documentation webpage. `npm run build` bundles the renderer, unit script workshop, Worker and client pages. Drizzle migrations are append-only under `drizzle/`.

Run `npm test`, `node local/arena.test.mjs`, `node local/squad-language.test.mjs`, `node local/workshop.test.mjs`, `node local/cloud.test.mjs`, and `npm run test:matches` (with the local bridge running). Tests cover actual combat, script effects, independent units, HTML control IDs, permanent upgrades, store transactions, persistent defenses, nearby-strength pairing, profile authorization and idempotent scores.

`android/build.ps1` requires JDK 17 and Android build-tools 36. It builds `android/build/TankTactics-debug.apk`, an ARM64 debug test APK. The game and function guide ship as bundled pages. The previous llama.cpp library/model infrastructure remains in the development package but is not used by the game; there is no automatic model request or download. Existing phone model files survive updates.

`local/bridge.mjs` serves the game on loopback port 8878. The match database persists under `%LOCALAPPDATA%/TankTactics/arena.sqlite`. Existing local model endpoints are retained as development tools and are not connected to game UI.
