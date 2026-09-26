# Tank Tactics: Prompt Arena

An Android multiplayer roguelite concept inspired by Robocode. The companion project board is in `dist/index.html`.

## Game loop

1. Assemble a squad of up to 15 programmable tanks from chassis, weapons, sensors, movement, and behavior items.
2. Give each unit a short natural-language tactical instruction. A free local model converts it into a bounded behavior plan.
3. Test the squad against basic computer controlled tanks, then enter multiplayer arena runs.
4. Win rounds to earn new prompt fragments and item choices. Lose a run and restart with the permanent unlocks allowed by the progression rules.

The local model generates structured behavior plans before a match. The deterministic combat simulation executes only validated actions, keeping multiplayer matches fair and replayable. Players can edit instructions and see a preview of the parsed behavior before locking a squad.

## First playable milestone

- Android 2D top-down arena with one programmable tank versus a basic AI tank.
- Local prompt generation and interpretation with an offline free model.
- Equip a Tank Body, Gun, Radar, and one movement or defense item.
- Stats, health, ammo, cover, win/loss, and a prompt reward after victory.
- Expand to squads, multiplayer, and roguelite progression after the single-tank loop works.

## Future scope

- 3D presentation, potentially in Unity.
- Drag-and-drop tank inventory slots and a larger weapon and armor catalog.
- Three matching units of the same type and tier can merge into an upgraded unit.
- Retirement cosmetics currency based on at most five wins per tank.

The board contains the milestone and feature backlog, including 36 distinct candidate stats and implementation notes.
