# Tank Tactics: Prompt Arena

An Android multiplayer roguelite concept inspired by Robocode. The companion project board is in `dist/index.html`, and a playable phone-friendly browser prototype is in `dist/play.html`.

The prototype is an early 1-versus-AI mixed-unit test. The Android USB/local build compiles instructions with **qwen3.5:4b in computer-local Ollama**. The hosted browser uses a rule parser fallback. Multiplayer, phone-native model inference, and 15-unit mixed squads remain planned.

## Test on the connected Android phone

The installed app is **Tank Tactics**. Keep the phone connected by USB for AI testing. Write an instruction, tap **Compile with local AI**, review its range, thresholds and firing policy, then tap **Deploy unit**. Compilation occurs before battle; the model never runs arbitrary code or controls the simulation directly. After editing an instruction or accepting a reward, compile again.

Run `local/start-phone-test.ps1` to restart the computer bridge and USB forwarding after reconnecting. Requires Node, Ollama running on localhost:11434 with qwen3.5:4b installed, and Android platform tools at `%LOCALAPPDATA%/TankTactics/tools/platform-tools`. The bridge listens only on computer loopback at port 8878 and rejects foreign browser origins. Disconnecting USB makes new compilations unavailable; the bundled game can still run using its rule parser.

Build: `android/build.ps1` uses JDK 17, Android platform 36 and build tools 36.0.0 under `%LOCALAPPDATA%/TankTactics`. Output: `android/build/TankTactics-debug.apk`. This is a debug WebView test APK, not a release package. No model is downloaded to the phone. It requests only Internet access, with cleartext restricted to localhost.

Combat now uses a seeded 60 Hz simulation, unit-specific magazines, 2.4-second magazine reloads, turret traverse, projectile segment hits, cover and command gates. `node local/combat.test.mjs` checks replay consistency and materially different tactic behavior. Model plans are validated and numeric values are bounded. The preview lets testers inspect model interpretation before deployment; this small model can still misunderstand complex instructions.

## Game loop

1. Assemble a squad of up to 15 programmable units. Planned types include infantry, tanks, helicopters, and boats for sea maps.
2. Give each unit a natural-language tactical instruction and a set of program commands. Radar, Gun, Drive, Duck, Cover, and Sniper Perch are commands, separate from the instruction text.
3. Test the squad against basic computer controlled units, then enter multiplayer arena runs.
4. Win rounds to earn new instructions and temporary buffs. Lose a run and restart with the permanent unlocks allowed by the progression rules.

The planned local model will generate structured behavior plans before a match. The deterministic combat simulation will execute only validated actions, keeping multiplayer matches fair and replayable. The current tank prototype uses a local rule parser and shows its interpretation and live actions during battle.

## First playable milestone

- Android 2D top-down arena with one programmable tank versus a basic AI tank.
- Show the interpreted instruction and actual tank actions during combat.
- Program tank actions through commands rather than equipment-style tactical items.
- Show the active tank stats in the arena and offer an instruction plus one-round buff after victory.
- Computer-local model compilation is available for USB testing. Generated reward instructions and phone-native inference remain future work.
- Expand to squads, multiplayer, and roguelite progression after the single-tank loop works.

## Future scope

- 3D presentation, potentially in Unity.
- Infantry, helicopters, and boats with unit-specific programming commands and sea maps.
- Drag-and-drop tank inventory slots and a larger weapon and armor catalog.
- Three matching units of the same type and tier can merge into an upgraded unit.
- Retirement cosmetics currency based on at most five wins per tank.

The board contains the milestone and feature backlog, including 36 distinct candidate stats and implementation notes.

## Collection and upgrades

Six playable types: tank, infantry, helicopter, rocket soldier, artillery and sniper. Open **Squad & combine** to select a unit for an arena duel or combine three copies of the same type and star tier. Maximum tier is three stars. Two stars unlock Cover and Dodge; three stars unlock Precision aim and Retreat. Each upgrade increases base health and damage by 40% and speed by 8% of the one-star base. These are available actions: instructions still determine when they are used. The model receives the unit type and enabled commands, and the game enforces command gates.

Victory rewards include one-star recruits as alternatives to instruction buffs. Collection capacity is 15. Starter pack: one of each type plus two extra infantry, allowing an immediate first combine. Collections and per-unit programs persist on the device across app restarts and new runs. A full collection must take a tactic reward and combine before recruiting more. Battles currently deploy one selected unit at a time; simultaneous squad combat and sea units remain planned.
