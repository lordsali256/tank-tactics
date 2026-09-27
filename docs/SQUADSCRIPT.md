# SquadScript 2 function reference

SquadScript is a custom language for coordinating a whole squad. The local Qwen chatbot translates natural-language requests into this language. The game interprets validated orders as data; scripts cannot run JavaScript, access files, or change combat rules.

## Program with natural language

1. Open **Squad programming chat** in the game.
2. Describe a tactic, for example: “Keep my tank at sniper range. Have the medic heal infantry and rocket soldiers lock onto armored targets.”
3. Tap **Generate squad orders**. Android uses Qwen2.5 on the phone; the USB game uses computer-local Qwen3.5. The hosted website has no hosted model.
4. Review the generated script. Invalid output is shown with errors and cannot be applied. Edit the preview if needed.
5. Tap **Apply reviewed script**, then deploy. Follow-up chat requests can refine a draft. A model draft never changes your active script until you apply it.

The script editor works without an LLM. The older **Compile with local AI** button interprets a tactical stance; the programming chat creates actual squad orders.

## Syntax, selectors and priority

```text
selector function [when hp|ammo|energy|heat below|above N%]
```

Put one order on each line. Selectors are **all**, a unit type, or a stable callsign such as **tank-1**, **infantry-2**, or **medic-1**. Unit types: tank, infantry, helicopter, rocket, artillery, sniper, boat, medic, engineer, scout. Names are case insensitive. Blank lines and comments beginning with # are ignored.

Conditions use that unit's current resource percentage. Example: **all seek-health when hp below 50%**. Conditions can also gate core orders. Values must be 0–100%. Inactive conditional orders do not use a slot.

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

| Order | Effect |
|---|---|
| all advance | Advance toward the nearest enemy. |
| all withdraw | Move away from the nearest enemy. |
| all stop | Stop moving and fire from the current position. |
| all patrol | Patrol a 180-unit circle around the starting position. |
| all rally | Move within 60 units of the surviving leader. |
| all spread | Separate from nearby allies to reduce splash exposure. |
| all tighten | Stay within 45 units of the leader. |
| all kite | Keep 330 range while firing. |
| all orbit | Circle the nearest enemy at about 220 range. |
| all zigzag | Add alternating lateral evasion to movement. |
| all seek-health | Route toward the nearest health drop when damaged. |
| all seek-ammo | Route toward the nearest ammo drop when low. |
| all seek-shield | Route toward an available shield drop. |
| all seek-boost | Route toward an overdrive drop. |
| all reload | Reload a partial magazine when below half capacity. |
| all cooldown | Hold fire above 40% heat until the weapon cools. |
| all reserve-fire | Fire only in preferred range when ammo reserves are below 30. |
| all anti-air | Prioritize flying enemies. |
| all avoid-danger | Evade incoming projectiles and the volcanic crater. |
| all guard-point | Hold the starting position and defend it. |

## Tank unique functions

| Order | Effect |
|---|---|
| tank brace | Take 20% less damage; move 35% slower. |
| tank ram | Deal 18 collision damage every 3 seconds within contact range. |
| tank hull-down | Seek cover at all health levels; armor improves near cover. |
| tank armor-piercing | Gain 25% penetration; fire 20% slower. |
| tank smoke | Create a 130-radius smoke screen for 3 seconds; 12-second cooldown, 20 energy. |

## Infantry unique functions

| Order | Effect |
|---|---|
| infantry sprint | Move 30% faster; fire 25% slower. |
| infantry ambush | Deal 35% more damage while near cover. |
| infantry suppress | Hits add 15 weapon heat to the target. |
| infantry grenade | Throw a 30-damage grenade within 180 range; splash 65, cooldown 8 seconds, 15 energy. |

## Helicopter unique functions

| Order | Effect |
|---|---|
| helicopter strafe | Fly perpendicular attack passes around the enemy. |
| helicopter hover | Hold position with twice the aim accuracy. |
| helicopter flare | Reduce incoming rocket damage 60% while energy is available; cooldown 5 seconds. |
| helicopter rocket-pod | Add 40 splash and 15% damage; fire 40% slower. |

## Rocket unique functions

| Order | Effect |
|---|---|
| rocket lock-on | Double accuracy, add 15% penetration, and require a longer target lock. |
| rocket backblast | Move backward after each rocket shot. |
| rocket bunker-buster | Gain 70 splash radius; deal double damage to buildings. |

## Artillery unique functions

| Order | Effect |
|---|---|
| artillery barrage | Fire 40% faster at 70% shell damage. |
| artillery siege | Hold position and deal triple damage to buildings. |
| artillery displace | Move perpendicular to the target while reloading after a shot. |

## Sniper unique functions

| Order | Effect |
|---|---|
| sniper steady | Stop moving and double aim accuracy. |
| sniper headshot | Gain 25 percentage points of critical chance against foot troops. |
| sniper camouflage | Halve radar signature until 2 seconds after firing. |

## Boat unique functions

| Order | Effect |
|---|---|
| boat broadside | Circle the target at naval firing range. |
| boat depth-charge | Deal 35 splash damage to nearby boats within 90 range; cooldown 8 seconds, 15 energy. |

## Medic unique functions

| Order | Effect |
|---|---|
| medic triage | Heal the most injured foot ally by 25 within 150 range; cooldown 6 seconds, 15 energy. |
| medic field-hospital | Stop and heal nearby allies 3 HP/second within 110 range; drain 4 energy/second. |

## Engineer unique functions

| Order | Effect |
|---|---|
| engineer repair | Repair the most injured vehicle by 25 within 150 range; cooldown 6 seconds, 15 energy. |
| engineer supply | Give a low-ammo ally 25 reserve rounds within 140 range; cooldown 8 seconds, 10 energy. |

## Scout unique functions

| Order | Effect |
|---|---|
| scout scan | Boost nearby allies’ radar 30% for 4 seconds; cooldown 8 seconds, 15 energy. |
| scout mark | Mark a target for 20% extra squad damage for 4 seconds; cooldown 8 seconds, 15 energy. |

## Example squad script

```text
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
```

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
