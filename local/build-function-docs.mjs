import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('client/squad-language.js','utf8');
const catalog=vm.runInNewContext(source.match(/const squadFunctions=([\s\S]*?)\.map\(/)[1]);
const types={Tank:'tank',Infantry:'infantry',Helicopter:'helicopter',Rocket:'rocket',Artillery:'artillery',Sniper:'sniper',Boat:'boat',Medic:'medic',Engineer:'engineer',Scout:'scout'};
let doc=`# SquadScript 2 function reference

SquadScript is a custom language for coordinating a whole squad. The local Qwen chatbot translates natural-language requests into this language. The game interprets validated orders as data; scripts cannot run JavaScript, access files, or change combat rules.

## Program with natural language

1. Open **Squad programming chat** in the game.
2. Describe a tactic, for example: “Keep my tank at sniper range. Have the medic heal infantry and rocket soldiers lock onto armored targets.”
3. Tap **Generate squad orders**. Android uses Qwen2.5 on the phone; the USB game uses computer-local Qwen3.5. The hosted website has no hosted model.
4. Review the generated script. Invalid output and drafts without any unit orders are shown with errors and cannot be applied. Edit the preview if needed.
5. Tap **Apply reviewed script**, then deploy. Follow-up chat requests can refine a draft. A model draft never changes your active script until you apply it.

The script editor works without an LLM. The older **Compile with local AI** button interprets a tactical stance; the programming chat creates actual squad orders.

## Syntax, selectors and priority

\
selector function [when hp|ammo|energy|heat below|above N%]
\

Put one order on each line. Selectors are **all**, a unit type, or a stable callsign such as **tank-1**, **infantry-2**, or **medic-1**. Unit types: tank, infantry, helicopter, rocket, artillery, sniper, boat, medic, engineer, scout. Names are case insensitive. Blank lines and comments beginning with # are ignored.

Conditions use that unit's current resource percentage. Example: **all seek-health when hp below 50%**. Conditions can also gate core orders. Values must be 0–100%. Inactive conditional orders and retreat orders locked below ★★★ do not use a slot.

★ executes the latest **3** matching active orders, ★★ the latest **5**, and ★★★ the latest **7**. Leader designation is free. Later matching settings win; movement functions override the normal movement plan. Functions unique to a unit run only on that type, even with **all**. A mismatched explicit type, such as **infantry brace**, is rejected. Combining three matching units upgrades stars and capacity. Put your most important orders last.

Callsigns remain stable during a fight when units die. The dead unit disappears; its simulation record remains for results. Leader orders fall back to a surviving tank or another surviving ally.

## General: core functions

| Order | Effect |
|---|---|
| leader tank-1 | Designate the squad leader. Free slot; takes a callsign. |
| all follow leader | Follow the leader in formation. A callsign can replace leader. |
| infantry protect tank-1 | Screen the specified ally and prioritize nearby threats. |
| helicopter flank leader | Move around the leader's target. |
| all focus nearest | Concentrate on the nearest enemy to the leader. |
| all focus weakest | Prioritize the lowest enemy health fraction. |
| all focus leader | Reuse the leader's current target when available. |
| all hold 360 | Preferred range, 100–500 units. |
| all stance balanced | balanced, rush or sniper. Changes movement/fire preferences. |
| all retreat below 25% | Retreat when health drops below a fraction; requires ★★★. |

## General: 20 additional functions

`;
for(const group of [...new Set(catalog.map(row=>row[0]))]){if(group!=='General')doc+='\n## '+group+' unique functions\n\n';doc+='| Order | Effect |\n|---|---|\n';for(const [g,name,effect]of catalog.filter(row=>row[0]===group))doc+='| '+(types[g]||'all')+' '+name+' | '+effect+' |\n'}
doc+=`
## Example squad script

\
leader tank-1
all focus nearest
tank brace
tank seek-health when hp below 45%
infantry protect leader
infantry suppress
rocket lock-on
medic triage
engineer repair
scout mark
\

Each type sees only its matching orders. The example stays within three slots per unit. Change a unit-specific selector to a callsign to specialize one unit.

## Unit unlocks and balance

| Type | First campaign round | Base HP | Role |
|---|---:|---:|---|
| Tank | 1 | 160 | Armor, cannon and screening |
| Infantry | 1 | 115 | Foot fire and suppression; weak against heavy armor |
| Rocket soldier | 1 | 110 | Antiarmor rockets |
| Scout car | 2 | 95 | Radar and target marking |
| Sniper | 3 | 90 | Long-range precision |
| Medic | 3 | 85 | Foot-troop healing |
| Artillery | 4 | 135 | Indirect fire and demolition |
| Engineer | 4 | 100 | Vehicle repair and ammunition |
| Boat | 5 | 150 | Coastal maps only |
| Helicopter | 6 | 70 | Fragile air attacker |

Both recruits and computer opponents respect these unlocks. Previously owned locked units must be benched before a campaign deployment. Invite matches use the submitted squads rather than campaign unlocks. Computer units deal 20% less damage; opponents add one unit every four rounds and upgrade a star every eight rounds. Round 1 remains one AI tank with 120 HP. Human multiplayer opponents do not receive the AI damage reduction.

## Powerups

The battlefield starts with eight drops. Destroyed buildings have a 30% loot chance, capped at ten unused drops. A healthy/full unit leaves an unneeded pickup for another unit.

| Drop | Effect |
|---|---|
| Green health | Restore up to 50 HP; collected only when missing more than 5 HP. |
| Orange ammo | Add up to 40 reserve rounds and refill the magazine; collected only when supplies are low. |
| Purple overdrive | 10 seconds of 35% extra top speed and 35% shorter shot interval. |
| Blue shield | Raise bonus shield to at least 40. Remains until consumed by damage. |

Pickup effects appear in the battle log and over the selected unit's 3D view. Drops are shared by both sides. Units must move close to collect them; use seek-* functions to assign that task.

## Auto Restart Level

The checkbox is off by default and saved on this device. When enabled, campaign defeat retries the same round after three seconds if lives remain. It stops after three defeats. Turn it off to edit tactics between retries. Victories wait for both reward choices; replays and online matches never automatically restart.

## Limits and support actions

The 50 additional functions have fixed effects, energy costs and cooldowns. Healing never revives a dead unit. Repair/supply and triage work within their documented radii. Weapon and armor modifiers combine with equipment; bonuses do not compound again every simulation tick. Generated scripts are limited to 3000 characters; chat messages to 1200 characters. Unknown functions and arbitrary code are rejected.
`;
// Fence text is generated without embedding template-literal backticks.
doc=doc.replace('selector function [when hp|ammo|energy|heat below|above N%]','```text\nselector function [when hp|ammo|energy|heat below|above N%]\n```').replace('leader tank-1\nall focus nearest\ntank brace','```text\nleader tank-1\nall focus nearest\ntank brace').replace('scout mark\n\nEach type','scout mark\n```\n\nEach type');
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/SQUADSCRIPT.md',doc);
console.log('Documented '+catalog.length+' additional functions and all core orders.');
