import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('client/squad-language.js','utf8');
const catalog=vm.runInNewContext(source.match(/const squadFunctions=([\s\S]*?)\.map\(/)[1]);
const types={Tank:'tank',Infantry:'infantry',Helicopter:'helicopter',Rocket:'rocket',Artillery:'artillery',Sniper:'sniper',Boat:'boat',Medic:'medic',Engineer:'engineer',Scout:'scout'};
let doc=`# SquadScript 2 function reference

SquadScript is a custom language interpreted as data by the game. It cannot execute JavaScript or access files. The game has no built-in LLM or programming chat. Use any external LLM you prefer, or write scripts yourself.

## Copy, ask, paste

1. Copy this whole reference using the webpage's Copy documentation button.
2. Paste it into your chosen LLM and include your unit types, star tiers and desired tactics. Ask for plain script text without JSON or Markdown fences.
3. Open **Paste scripts** in the game and select a unit or **Squad coordination**.
4. Paste the result, then **Validate & save script**. Invalid lines never replace saved scripts.
5. Deploy. Every unit starts with its own basic nearest-target/range script and has no automatic squad formation.

A unit script affects only that unit: **all** means that unit. Optional squad orders affect the whole team and run after unit scripts. Both share the unit's latest 3 / 5 / 7 active order slots. Saving a unit script does not change another unit's script. Renaming changes the display name, not its stable callsign. Each pasted script may contain up to 3000 characters.

### Example request for your LLM

Return only SquadScript. My team is tank-1 (two stars), infantry-1 (one star), and medic-1 (one star). Have infantry protect the tank and have the medic heal injured foot troops. Keep each unit within its order capacity. Do not include stat buffs or invented functions.

### Basic unit script

all focus nearest
all hold 255

The preferred range differs by type: tank 255, infantry 215, rocket 320, artillery 420, sniper 390, helicopter 290, boat 340, medic 180, engineer 195 and scout 245.

## Syntax, selectors and priority

\
selector function [when hp|ammo|energy|heat below|above N%]
\

Put one order on each line. Selectors are **all**, a unit type, or a stable callsign such as **tank-1**, **infantry-2**, or **medic-1**. Unit types: tank, infantry, helicopter, rocket, artillery, sniper, boat, medic, engineer, scout. Names are case insensitive. Blank lines and comments beginning with # are ignored.

Conditions use that unit's current resource percentage. Example: **all seek-health when hp below 50%**. Conditions can also gate core orders. Values must be 0–100%. Inactive conditional orders and retreat orders locked below ★★★ do not use a slot.

★ executes the latest **3** matching active orders, ★★ the latest **5**, and ★★★ the latest **7**. Leader designation is free. Later matching settings win; movement functions override the normal movement plan. Functions unique to a unit run only on that type, even with **all**. A mismatched explicit type, such as **infantry brace**, is rejected. Combining three matching units upgrades stars and capacity. Put your most important orders last. Stationary orders (stop, hover, steady, siege and field-hospital) suppress automatic dodging and zigzag while holding position. An active emergency retreat or cover condition takes priority; a later movement order can replace the stationary order.

Callsigns remain stable during a fight when units die. The dead unit disappears; its simulation record remains for results. Leader orders fall back to a surviving tank or another surviving ally.

## General: core functions

| Order | Effect |
|---|---|
| leader tank-1 | Designate the squad leader. Free slot; takes a callsign. |
| all follow leader | Follow the leader in formation. A callsign can replace leader. |
| infantry protect tank-1 | Screen the specified ally and prioritize nearby threats. |
| helicopter flank leader | Move around the leader's target. |
| all focus nearest | Independently attack the nearest enemy to this unit. Use focus leader for shared targeting. |
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

The 50 additional functions have fixed effects, energy costs and cooldowns. Healing never revives a dead unit. Repair/supply and triage work within their documented radii. Weapon and armor modifiers combine with equipment; bonuses do not compound again every simulation tick. Unit and squad scripts each have a 3000-character limit. Permanent victory upgrades are separate saved stats and never added to scripts. Unknown functions and arbitrary code are rejected.
`;
// Fence text is generated without embedding template-literal backticks.
doc=doc.replace('selector function [when hp|ammo|energy|heat below|above N%]','```text\nselector function [when hp|ammo|energy|heat below|above N%]\n```').replace('leader tank-1\nall focus nearest\ntank brace','```text\nleader tank-1\nall focus nearest\ntank brace').replace('scout mark\n\nEach type','scout mark\n```\n\nEach type');
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/SQUADSCRIPT.md',doc);
console.log('Documented '+catalog.length+' additional functions and all core orders.');

const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let table=false,code=false,html='';for(const line of doc.split('\n')){if(line.startsWith('~~~')||line.startsWith(String.fromCharCode(96).repeat(3))){if(table){html+='</tbody></table>';table=false}code=!code;html+=code?'<pre><code>':'</code></pre>';continue}if(code){html+=escape(line)+'\n';continue}if(line.startsWith('|')){if(/^[| -]+$/.test(line))continue;if(!table){html+='<table><tbody>';table=true}html+='<tr>'+line.split('|').slice(1,-1).map(s=>'<td>'+escape(s.trim())+'</td>').join('')+'</tr>';continue}if(table){html+='</tbody></table>';table=false}const heading=line.match(/^(#{1,3}) (.*)$/);html+=heading?'<h'+heading[1].length+'>'+escape(heading[2])+'</h'+heading[1].length+'>':line.trim()?'<p>'+escape(line).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')+'</p>':''}
fs.writeFileSync('dist/functions.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SquadScript · Complete function documentation</title><style>body{margin:0;background:#0e1912;color:#e5efdf;font:16px/1.6 system-ui}main{max-width:950px;margin:auto;padding:22px}nav{position:sticky;top:0;background:#17291e;padding:12px;display:flex;gap:12px;flex-wrap:wrap}a,button{color:#d7fb75}button{background:#263e2b;border:1px solid #7d955e;padding:9px;border-radius:8px;cursor:pointer}table{width:100%;border-collapse:collapse;margin:20px 0}td{border:1px solid #3f5843;padding:10px}pre{background:#203626;padding:15px;overflow:auto}h2{margin-top:42px;border-top:1px solid #4e644d;padding-top:20px}textarea{width:100%;min-height:160px}</style><nav><a href="./play.html">← Back to game</a><button id="copy">Copy full documentation for an LLM</button><span id="status"></span></nav><main>'+html+'<details><summary>Plain text to copy manually</summary><textarea id="reference" readonly>'+escape(doc)+'</textarea></details></main><script>document.getElementById("copy").onclick=async()=>{const t=document.getElementById("reference");try{await navigator.clipboard.writeText(t.value);document.getElementById("status").textContent="Copied"}catch{t.parentElement.open=true;t.focus();t.select();document.getElementById("status").textContent="Select and copy the reference below"}};</script></html>');
