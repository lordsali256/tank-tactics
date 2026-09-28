# Tank Tactics agent guide

## Goal

Maintain the browser and Android combined-arms roguelite. A run begins with one tank. Players paste restricted Python scripts for individual units and optional squad coordination. Hero units remain a future feature.

## Project layout

- `client/`: editable browser game, UI, combat renderer, scripts, and styles.
- `local/`: local server, multiplayer service, model connectors, build scripts, and tests.
- `docs/PYTHON_INTRO.md`: editable source for the player scripting reference.
- `dist/`: generated web and server output. Commit regenerated output with source changes.
- `android/`: Android wrapper and build scripts.
- `drizzle/`: append-only database migrations.

## Generated files

Do not hand-edit generated files in `dist/` or `cloud/python-policy.mjs`. Change their source, then run:

```sh
node local/build-function-docs.mjs
npm run build
```

## Setup and verification

```sh
npm ci
npm run verify
```

`npm run verify` builds the game and runs the self-contained regression suite. Run `npm run test:matches` separately while `npm start` is running when multiplayer behavior changes.

The canonical deployment is `/mnt/serverdata/docker/testing-environment/tank-tactics` on `192.168.1.10`. Use Docker there and open `http://192.168.1.10:8878/play`. The project board is at the root URL and the script reference is at `/functions.html`. Do not create a separate PC-local deployment.

## Product constraints

- Keep the first battle to one player tank versus one AI tank with 120 HP.
- Unit and squad programs use the documented restricted Python subset. They must never execute arbitrary Python or grant units, gear, upgrades, score, or resources.
- Units begin with independent starter scripts. Coordination requires an explicit squad script.
- Model connections are optional and require explicit player opt-in. Support player-owned local endpoints and provider API keys without requiring SSH tunnels.
- Provider keys stay in memory and must never be committed, logged, or included in prompts.
- Preserve mobile usability and test controls at narrow phone widths when changing the UI.
- Keep hero units on the future roadmap unless the product owner changes that decision.

## Deployment safety

- Copy `.env.example` to `.env` and set the deployment address locally. Never commit `.env` or API keys.
- Preserve `data/` during deployments; it contains the multiplayer database.
- `ollama/`, Android build output, archives, databases, and local logs are ignored.
- Hosted provider tests use fixtures by default. Do not spend paid API credits without an explicit request.

## Change discipline

- Make focused commits against `main`; do not force-push shared branches.
- Add a regression test for combat, economy, authorization, or persistence bugs when practical.
- Keep database migrations append-only.
- Update this guide and `README.md` when commands, architecture, or deployment steps change.
