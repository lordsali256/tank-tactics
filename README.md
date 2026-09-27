# Tank Tactics

A combined-arms arena roguelite inspired by Robocode. Play on PC or Android. Every run starts with one tank against one AI tank with 120 HP. Hero units remain a future update.

## Play locally first

Open http://127.0.0.1:8878/play on this PC. The project board is http://127.0.0.1:8878/ and the reference is http://127.0.0.1:8878/functions.html. Start the server with `node local/bridge.mjs` from this folder if it is stopped. It binds to loopback only.

## Docker on the home server

The LAN deployment lives at `/mnt/serverdata/docker/testing-environment/tank-tactics` on `192.168.1.10`. From that folder run `docker compose up -d --build`. Play at http://192.168.1.10:8878/play; the board is at http://192.168.1.10:8878/ and the full script guide is at http://192.168.1.10:8878/functions.html. Compose binds port 8878 only to the server's LAN address. The SQLite multiplayer database persists in `./data/arena.sqlite`. Keep that folder when rebuilding. `docker compose ps` shows health and `docker compose logs --tail=100` shows errors.

Campaign progress, scripts and coach preferences live in each browser's local storage. Browsers treat the former `127.0.0.1` address and the Docker address as separate saves; the PC save remains available at its old address. The multiplayer database is portable and can be migrated separately. The Docker game uses Qwen2.5-Coder 7B on the PC through a private SSH reverse tunnel: server `127.0.0.1:11435` forwards to PC `127.0.0.1:11434`. Ollama is not exposed on the PC's LAN interfaces. Run `local/install-pc-ollama-tunnel.ps1` once on Windows to install the hidden reconnecting helper for the current user's startup. Keep the PC and Ollama running. The server-only Ollama service is retained under the optional `server-ai` Compose profile; it is stopped by default. Google AI Studio and OpenAI API coaching remain explicit opt-in with player supplied keys.

The server CPU could not complete full-guide coach requests within five minutes, so the default now uses the PC model through the tunnel. The game shows the model location in its settings. Coaching stays off by default; copy/paste scripts and gameplay work without it. Provider protocol tests passed with test responses, but no paid provider account has been exercised.

Verified through the Docker coach endpoint: the PC's Qwen2.5-Coder 7B returned a validated battle analysis in 13 seconds with the complete 24,943-character guide. It elected to keep the fixture's scripts unchanged. The current user's Windows startup shortcut reconnects the private tunnel automatically.

## Play and scripts

Deploy sits above the battlefield and stays accessible while scrolling. No model connection is required. Ten unit types unlock gradually, including helicopters at Round 6. AI damage is reduced 20%; enemy count grows every four rounds and tiers every eight.

Each unit has an independent basic nearest-target/range script. The optional battle coach uses local Ollama, Google AI Studio/Gemini, OpenAI API or another compatible provider only after explicit session opt-in. Auto-applying validated drafts requires a separate choice; API keys are memory-only. Open **Paste scripts**, select an individual unit or the optional squad coordination script, paste restricted Python, then **Validate & save script**. Copy the complete reference at **Function documentation** to any external LLM you prefer. Invalid scripts cannot replace saved scripts. Unit scripts and squad orders share the latest 3/5/7 active command slots; squad orders run after unit orders. Default units do not follow/protect/concentrate fire automatically.

[Grouped function reference](docs/SQUADSCRIPT.md), also bundled as `functions.html`, explains every core command and 78 general/type actions, eight core calls, 24 read-only sensors, 25 queries, conditions, priorities, examples and fixed costs/cooldowns. The reference page includes a full-text copy button and manual-copy fallback.

A victory/defeat screen shows battle points. Continue to Field Base to choose from three recruits and then three free permanent upgrade choices. All eight training categories are displayed in the depot, with paid training starting at 80 credits plus 20 per existing level. Select the unit to receive the upgrade. Permanent bonuses are smaller (+2% damage/speed, +1% resistance, etc.), capped at twenty purchases per category, and never added to scripts. Maxed choices grant thirty credits. Bonuses stay with that unit across rounds and combining; a new run assembles a new squad. Gear, slots and currencies persist across runs. The depot replaces battlefield base structures; previous purchases are refunded once.

The store sells slots, unlocked recruits, weapons, armor and utility equipment. Each unit has its own name, script, equipment, cosmetic paint and upgrades. Combining preserves the selected unit's identity. Retiring awards at most five cosmetic tokens. Collection import/export is hidden as a future feature. Latest-battle replays remain available.

## Graphics and combat

Infantry is one four-soldier unit with four smaller rifle models. Each rifle fires a quarter of the squad's listed damage, with its own spread and critical roll; the four-shot volley consumes one squad ammo charge and preserves total expected damage, cooldown and heat. The squad shares its existing health, script and roster slot. Artillery barrels are elevated 72 degrees above horizontal for a predominantly vertical silhouette.

Three.js WebGL 3D ships offline in the APK. Four maps cover ten times the original arena area. Round-varying maps have city blocks, canyon mesas/outposts, volcanic domes/silos, and harbor piers/cranes/lighthouses. Building geometry differs by structure type. Destroyed buildings break into four or five animated chunks, then remain as rubble. A projected compatibility renderer allows campaign play when WebGL is unavailable.

Eight initial pickups, thirty-percent building loot and a ten-unused-drop cap keep the battlefield readable. Health, ammo, shield and overdrive affect actual combat and have visible feedback. Dead unit meshes disappear. Infantry rifles are weak against armored tanks; dedicated rocket troops retain antiarmor damage. Unit stats appear on hover or tap, with expanded specifications. The technical arena counter is removed.

## Multiplayer and leaderboard

Publish a defense in Multiplayer, then attack a random real player's saved defense on the same map within 35% of your squad strength. Defenders can be offline. When no eligible player exists, the game saves your defense and reports the empty pool. Invite matches remain available.

The server controls combat and records wins/losses once per random match. A leaderboard lists published player defenses ordered by wins, losses and last update. Profile edit tokens never appear in leaderboard output. Sessions expire after fifteen minutes. Online accounts begin with one server-issued tank and zero credits. Leaderboards rank by server-awarded points: 100 victory / 20 defeat, plus 25 per defeated enemy and 10 per surviving ally. Local practice points are shown separately. Only verified match results grant online credits (60 win / 15 loss). Owned gear, roster, tiers and currency are validated by the server; practice saves/imports cannot enter online matches. Pasted Python is interpreted as bounded data and cannot grant resources. Editable local practice saves and anonymous-account collusion cannot be made cheat-proof. Internet play follows the Site's existing sharing settings. Android multiplayer uses the local bridge over USB; campaign and bundled documentation work offline.

## Build and test

`node local/build-function-docs.mjs` generates Markdown and the documentation webpage. `npm run build` bundles the renderer, unit script workshop, Worker and client pages. Drizzle migrations are append-only under `drizzle/`.

Run `node local/depot.test.mjs`, `node local/coach.test.mjs`, `npm test`, `node local/arena.test.mjs`, `node local/squad-language.test.mjs`, `node local/workshop.test.mjs`, `node local/cloud.test.mjs`, `node local/python.test.mjs`, and `npm run test:matches` (with the local bridge running). Tests cover actual combat, script effects, independent units, HTML control IDs, permanent upgrades, store transactions, persistent defenses, nearby-strength pairing, profile authorization and idempotent scores.

`android/build.ps1` requires JDK 17 and Android build-tools 36. It builds `android/build/TankTactics-debug.apk`, an ARM64 debug test APK. The game and function guide ship as bundled pages. The previous llama.cpp library/model infrastructure remains in the development package but is not used by the game; there is no automatic model request or download. Existing phone model files survive updates.

`local/bridge.mjs` serves the game on loopback port 8878. The match database persists under `%LOCALAPPDATA%/TankTactics/arena.sqlite`. Enabled coaching analyzes automatically after each campaign battle; main-screen notes show true added/removed script lines or no changes. Every request includes the full guide. Google uses [generateContent](https://ai.google.dev/api/generate-content); OpenAI uses [Responses structured output](https://developers.openai.com/api/docs/guides/structured-outputs), with session-only keys. Web chatbot users can copy the full battle brief. The optional coach calls /api/coach through the local bridge, forwarding only the selected report/script context. The hosted Site does not support this local proxy. Local Qwen2.5-Coder 7B generated a validated script from a test battle report in 34 seconds. Hosted-provider protocol tests use a stub; a paid provider account has not been tested.
