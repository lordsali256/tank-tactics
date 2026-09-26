# Tank Tactics: Prompt Arena

An Android multiplayer roguelite concept inspired by Robocode. The companion project board is in `dist/index.html`, and a playable phone-friendly browser prototype is in `dist/play.html`.

The browser prototype is an early 1-versus-AI tank test. It interprets tactical text with local rules, not an LLM. The project board explicitly shows **LLM in game: None**. Native Android packaging, a free local language model, multiplayer, and 15-unit mixed squads remain planned.

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
- Integrate local prompt generation with an offline free model after the deterministic command loop is solid.
- Expand to squads, multiplayer, and roguelite progression after the single-tank loop works.

## Future scope

- 3D presentation, potentially in Unity.
- Infantry, helicopters, and boats with unit-specific programming commands and sea maps.
- Drag-and-drop tank inventory slots and a larger weapon and armor catalog.
- Three matching units of the same type and tier can merge into an upgraded unit.
- Retirement cosmetics currency based on at most five wins per tank.

The board contains the milestone and feature backlog, including 36 distinct candidate stats and implementation notes.
