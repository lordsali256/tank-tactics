# Tank Tactics: Prompt Arena

A playable Android and browser combined-arms roguelite inspired by Robocode.

## Play

Open Tank Tactics on the phone, write a squad order script, tap **Compile with local AI**, review the interpreted plan, then deploy. Use **Squad & combine** to select, bench or upgrade units; **Armory** for equipment; **Store** to buy team slots. Each campaign victory grants a choice of three distinct recruits and a separate choice of three next-round doctrines. Three defeats end the run; equipment, purchased slots and currencies remain; each new run assembles a fresh squad from one tank. The previous test collection is archived for export.

- Up to 15 simultaneous units: tanks, infantry, helicopters, rocket soldiers, artillery, snipers and coastal boats.
- Infantry base speed reduced from 125 to 80.
- Four maps with exactly 10× the previous battlefield area, up to 72 destructible buildings, rubble, and 36 initial ammo/health/overdrive/shield drops. Destroying a building releases an additional drop. Battles last at most 180 seconds. Rifle infantry damage against armored tanks is reduced by 88%; rockets remain antiarmor. There are 39 distinct displayed stats and 30 equipment choices.
- Every run starts with one tank versus one AI tank. A shared script assigns leader, follow, protect, focus, hold range, flank and retreat orders. Three matching units combine, increasing order capacity from 3 to 5 to 7. No command-toggle section. Hero units are on the future-update board.
- Drag equipment onto weapon/armor/utility slots or tap Equip. Retire a unit for at most five cosmetic tokens; four color schemes are available.
- Latest-battle replay, collection import/export, and real Three.js WebGL 3D graphics. Procedural tracked tanks, soldiers, helicopters with animated rotors, artillery, snipers and boats. Squad follow camera, orbit/zoom, whole-map view and tappable minimap. The renderer ships offline in the APK.
- Invite multiplayer uses an authoritative server and persistent match database. Two players submit squads, share a code, reconnect with saved session tokens and receive server-confirmed results. These test matches give no campaign rewards. Collections and imported progression are device-local, so this is not a ranked economy.

## Free local models

Android uses **Qwen2.5-0.5B-Instruct Q4_K_M** through native llama.cpp, CPU only. The 491,400,032-byte model is installed on the test Pixel. Other Android installations offer a verified download button. SHA-256: `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.

Model source: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF (Apache 2.0). Native inference uses four CPU threads, 2048 context tokens and at most 230 generated tokens. It runs before combat, not every frame. The model can misinterpret instructions; inspect the plan before deploying. Local AI also generates a reward tactic when available. Preset tactics and a clearly labeled rule parser remain usable without a model.

Computer testing optionally uses **qwen3.5:4b** in Ollama via the loopback bridge on port 8878. `local/start-phone-test.ps1` starts the bridge and USB forwarding. The hosted site does not send prompts to ChatGPT or a hosted AI provider. Its multiplayer accessibility follows the site's existing private sharing settings.

## Build and test

`npm run build` generates a Cloudflare-compatible bundled Worker and client assets. `node local/combat.test.mjs`, `node local/arena.test.mjs`, `node local/matches.test.mjs` and `node local/cloud.test.mjs` verify deterministic combat, command tiers, separate rewards, slot purchases, gear effects, import validation, retirement caps, lives and match/session/database rules. Drizzle schema migrations live in `drizzle/`; append migrations rather than changing deployed history.

`android/build.ps1` requires JDK 17, Android platform/build-tools 36 and the native library at `android/build/native/libtank_ai.so`. The output is `android/build/TankTactics-debug.apk`, a debug-signed ARM64 test APK. It bundles the game and library; model data is stored in private app files separately and survives app updates. Internet permission supports model download and USB tests.

Native dependencies under `%LOCALAPPDATA%/TankTactics`: NDK 27.2.12479018, CMake 3.22.1, llama.cpp commit `95887577ab5fead779581a7030a83c7752ff3234`. Configure `android/native` with the Android toolchain, ARM64 ABI, Android 26, `ANDROID_STL=c++_static`, `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON`, and `LLAMA_SOURCE` pointing at that checkout. Build target `tank_ai`. The shared library and APK use 16 KB alignment. Upstream license notices are included under `android/native` and in APK assets.

## Squad order example

```text
leader tank-1
all focus nearest
all follow leader
infantry protect leader
sniper hold 360
helicopter flank leader
```

Use one order per line. Selectors are `all`, unit types, or callsigns such as `tank-1`. Later matching orders override earlier settings, within each unit’s order capacity. Unknown lines prevent deployment. Comments begin with `#`. Leaders switch to a surviving ally when lost. Retiring and combining units remain separate actions.

Field bases are campaign structures: build repair stations, ammo depots and cover walls in three fixed rear areas, then upgrade them with credits. They persist across runs and are recorded in campaign replays. Invite matches exclude field-base bonuses.
