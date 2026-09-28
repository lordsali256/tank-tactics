# Tank Tactics

A combined-arms arena roguelite inspired by Robocode. Play on PC or Android. Every run starts with one tank against one AI tank with 120 HP. Hero units remain a future update.

## Play locally first

Open http://127.0.0.1:8878/play on this PC. The project board is http://127.0.0.1:8878/ and the reference is http://127.0.0.1:8878/functions.html. Start the server with `node local/bridge.mjs` from this folder if it is stopped. It binds to loopback only.

## Docker on the home server

The LAN deployment lives at `/mnt/serverdata/docker/testing-environment/tank-tactics` on `192.168.1.10`. From that folder run `docker compose up -d --build`. Play at http://192.168.1.10:8878/play; the board is at http://192.168.1.10:8878/ and the full script guide is at http://192.168.1.10:8878/functions.html. Compose binds port 8878 only to the server's LAN address. The SQLite multiplayer database persists in `./data/arena.sqlite`. Keep that folder when rebuilding. `docker compose ps` shows health and `docker compose logs --tail=100` shows errors.

Campaign progress, scripts and coach preferences live in each browser's local storage. Browsers treat the former `127.0.0.1` address and the Docker address as separate saves; the PC save remains available at its old address. The multiplayer database is portable and can be migrated separately. No model connection is required to play. The server-only Ollama service is retained under the optional `server-ai` Compose profile; it is stopped by default.

## Connect your own LLM

Open **Model setup**, choose Ollama, LM Studio / compatible API, Google AI Studio or OpenAI API, enter your endpoint/key, and press **Test connection & find models**. Choose an available text model, explicitly enable battle analysis, then save. Model discovery sends no battle reports. No model is imposed and no connection runs on page load. Auto-application requires a separate opt-in; keys remain in memory.

For Ollama/LM Studio choose **This device** to connect directly from the player's browser. Here localhost means that player's PC or phone. The app must allow the game origin (Ollama's OLLAMA_ORIGINS or LM Studio's CORS setting); Connection help gives the exact current origin and instructions. A phone's localhost cannot reach a model on a PC. Choose **Game server or local network** and enter that PC's private-network IP instead; the model must explicitly serve on the LAN and allow the server through its firewall. In this route localhost means the Docker server. Remote providers require HTTPS; private-network HTTP is supported. Browser permissions and HTTPS mixed-content rules may also restrict direct local access.

The complete [model setup guide](docs/SQUADSCRIPT.md) covers platform settings and troubleshooting. Direct mode requests the full documented battle prompt from the game, calls the model in the browser, and sends the reply back for validation. Server mode makes the model request from Docker. Both paths validate every proposed script before application. Provider protocols are tested with fixtures; no paid provider account has been exercised.

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
