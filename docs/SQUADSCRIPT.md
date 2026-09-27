# Python unit programming

Use any external LLM you like. No connection is required; the optional battle coach can use your chosen model after explicit opt-in. Copy this reference, describe your units and tactics to your LLM, then paste its Python into **Scripts**. Each unit starts with an independent basic script. Coordination must be supplied explicitly.

## Field Base and optional battle coach

After victory, choose a recruit, then enter Field Base to claim one of three highlighted permanent upgrades. All eight training categories are laid out there for the selected unit. Paid training starts at 80 credits and increases by 20 per existing level, capped at twenty levels. Combine three matching units to raise their star tier and order capacity. Equipment, paint and scripts are available from the depot. Old purchased battlefield structures are removed and their purchase/training credits refunded once.

Hover over units on PC or tap their model/name on a phone for stats. Collection import/export is hidden and remains a future update.

**Optional LLM coach** is available when playing through the local bridge. Select local Ollama or a provider exposing a compatible chat-completions API. Enter an endpoint and model, optionally a provider key, then explicitly enable sending battle reports. Nothing is sent by default. Opt-in resets when the page reloads; endpoint/model preferences persist, but keys remain only in memory. HTTP is restricted to loopback; remote providers require HTTPS. Ollama runs on this computer. The default is Qwen2.5-Coder 7B, verified locally with a real battle-report fixture.

The coach receives the grouped function reference, owned units' scripts/types/tiers, optional squad script, and the last battle report: map, round, outcome, duration, shots, damage dealt/taken, hit events, kills, survival, remaining ammo/health and collected pickups. It does not receive your API key as prompt text. Your chosen hosted provider may charge for requests; its normal privacy terms apply. No provider requests happen until opt-in.

Valid drafts can be applied manually. **Automatically apply valid scripts** is a separate opt-in. The interpreter validates every returned unit script and optional squad script before any changes; unknown units or invalid actions reject the whole draft. Changing scripts or resetting a run while a request is underway makes its reply stale. The coach cannot award units, credits, upgrades or equipment. A failed request leaves existing scripts intact. Multiplayer combat and accounts remain server-controlled; the coach is a campaign feature.

## Ask your LLM

Return only a Python script defining tick(unit, squad), using this game's documented subset. No imports, loops, Markdown fences, resource changes or invented APIs. My tank should protect medic-1, conserve ammunition, and seek cover below 40% health. My tank is two stars, so keep active orders within five slots. Explain any tradeoff separately.

## Supported Python subset

This is a restricted Python interpreter, not full CPython. Define exactly **def tick(unit, squad):**. Use four spaces per indentation level. Supported: if / elif / else, local variables, return, pass, numbers, strings without escapes, True / False, arithmetic, comparisons, and / or / not, parentheses, sensors and approved calls. Local variables reset each tick. Comments start with #. No imports, loops, functions other than tick, classes, lists, comprehensions, filesystem, network, arbitrary attributes or assignment to unit/squad fields.

Scripts are limited to 3000 characters, 120 nonempty lines, six nesting levels and 240 interpreter steps per tick. Invalid scripts cannot replace saved programs. Scripts request fixed combat actions; they cannot set stats, spawn units, grant credits or alter inventories. Online units, tiers, gear and credits are server-owned. Practice saves on a player's own device remain editable; this does not grant online possessions. Anonymous accounts are not protection against players creating multiple accounts.

Python comparison chains work normally: **0.25 < unit.hp_ratio < 0.75** means health is between 25% and 75%, excluding the endpoints. They evaluate intermediate sensors once and stop after a failed comparison. Literal argument mistakes, such as unit.focus("closest"), unit.hold_range("255") or unit.protect("tank-0"), are rejected when saving. Use documented option strings, numeric distances, and real callsigns.

## Orders and priority

The game evaluates tick once per simulation step. Each unit's own script runs first, then the optional squad script runs for that same unit. Later active orders have priority. One star keeps the latest three orders, two stars five, three stars seven. Opposing settings use the later setting. Unit-specific calls affect only the matching type. Conditional inactive branches consume no slots. Combining three of a kind increases tier. Healing never revives dead units.

The squad script can use **unit.kind** and **unit.callsign** to choose orders for each unit. Callsigns such as tank-1 and medic-1 stay stable during a fight; renamed display names do not change callsigns. The leader is a surviving tank, or another surviving ally. Missing anchors fall back to the leader.

## Core calls

| Call | Meaning |
|---|---|
| unit.focus("nearest") | Target nearest enemy; alternatives "weakest" and "leader". |
| unit.hold_range(255) | Preferred fighting distance, clamped to 100–500 world units. |
| unit.follow("tank-1") | Follow a stable callsign or "leader". |
| unit.protect("medic-1") | Screen the named ally from enemies. |
| unit.flank("leader") | Offset around the named ally while engaging. |
| unit.stance("balanced") | Alternatives "rush" and "sniper". |
| unit.retreat_below(0.25) | Three-star emergency retreat below a health fraction; clamped 0.05–0.8. |
| unit.move_to(900, 700) | Request a world coordinate, clamped within map boundaries; obstacles still apply. |

Default range: tank 255, infantry 215, rocket 320, scout 245, sniper 390, medic 180, artillery 420, engineer 195, helicopter 290, boat 340. Coordinates are world units, not phone pixels. Health/ammo/energy/heat ratios are fractions from 0 to 1. Distance queries return 99999 when their target is absent.

Supported unit-type strings: "tank", "infantry", "rocket", "scout", "sniper", "medic", "artillery", "engineer", "helicopter", "boat". Supported map strings: "urban", "canyon", "volcanic", "coast". Callsign arguments and action names must be strings, such as unit.ally_alive("medic-1") and unit.ability_ready("vent_heat"). Range and energy arguments are numbers, such as unit.enemies_within(300) and unit.can_afford(15). Count queries return integers; health queries return fractions.

### Sensor meanings

| Sensor | Type and meaning |
|---|---|
| unit.hp_ratio / ammo_ratio / energy_ratio / heat_ratio | Fractions of maximum health, magazine capacity, energy capacity and heat capacity. Reserve ammunition is separate. |
| unit.kind / tier / callsign | Unit type string, star count (1–3), and stable battle callsign. |
| unit.x / y | World position. unit.move_to cannot leave map boundaries. |
| unit.shield / reserve_ammo | Current shield hit points and reserve rounds. |
| unit.reloading / moving | True while reloading or moving faster than one world unit per second. |
| unit.cooldown | Seconds until the weapon can fire; may be negative when ready. |
| unit.enemy_distance / enemy_kind / has_enemy | Distance/type of current target or nearest living enemy; "none" and False if absent. Distance is 99999 if absent. These do not guarantee a clear firing line. |
| unit.in_cover | True when near a blocking obstacle; the cover action still follows movement rules. |
| squad.ally_count / enemy_count | Living units on each side, including this unit in ally_count. |
| squad.leader_alive | True when a living allied tank exists; fallback leaders may be another type. |
| squad.lowest_ally_hp | Lowest allied health fraction, including this unit. |
| squad.elapsed / map | Battle time in seconds and map identifier string. |

### Query details

unit.distance_to, ally_health and ally_alive look up a living ally by callsign. ally_health returns 0 if absent; ally_alive returns True/False. allies_within excludes the current unit. enemies_within includes all enemy types; air_enemies_within counts aircraft, armored_enemies_within counts vehicles and boats, foot_enemies_within counts infantry, snipers, rocket soldiers, medics and engineers. Radius arguments are clamped to 0–1000 world units.

Health/ammo/shield/boost drop distance queries return the closest unused drop. nearest_cover_distance measures to an obstacle center. enemy_shield returns shield hit points, enemy_health returns a health fraction, and incoming_shots counts enemy projectiles inside the radius (it does not predict impact). has_ammo is True when magazine or reserve contains rounds. can_fire checks ammo, reload, cooldown and heat; aiming and line of sight may still prevent a shot. can_afford checks current energy. ability_ready checks the action timer; separately check energy with can_afford. map_is and is_type compare identifiers. squad.has_type returns True/False, count_type returns a living count, and injured_allies counts allies below the supplied health fraction, including this unit.

## Sample: independent starter tank

```python
def tick(unit, squad):
    unit.focus("nearest")
    unit.hold_range(255)
```

## Sample: two-star escort with conditional supplies

```python
def tick(unit, squad):
    unit.focus("nearest")
    unit.hold_range(255)
    if unit.ally_alive("medic-1"):
        unit.protect("medic-1")
    if unit.ammo_ratio < 0.2:
        unit.seek_ammo()
    elif unit.hp_ratio < 0.4:
        unit.seek_health()
    if unit.heat_ratio > 0.75:
        unit.vent_heat()
```

## Sample: rocket soldier saves antiarmor ammunition

```python
def tick(unit, squad):
    unit.focus_armor()
    unit.hold_range(320)
    unit.save_rockets()
    if unit.air_enemies_within(500) > 0:
        unit.focus_air()
```

## Sample: sniper moves after firing

```python
def tick(unit, squad):
    unit.focus("weakest")
    unit.hold_range(390)
    if unit.cooldown > 0.4:
        unit.relocate()
    else:
        unit.steady()
```

## Sample: optional squad coordination

```python
def tick(unit, squad):
    if unit.kind == "infantry":
        unit.protect("tank-1")
    elif unit.kind == "medic":
        unit.follow_patient()
        unit.triage()
    elif unit.kind == "engineer":
        unit.follow_vehicle()
        unit.repair()
    elif unit.kind == "artillery":
        unit.counter_battery()
    elif unit.kind == "helicopter":
        if unit.hp_ratio < 0.35:
            unit.breakaway()
        else:
            unit.focus_support()
    else:
        unit.focus("weakest")
```

## Debug your tactics

Start with two calls and add one condition at a time. Watch health, ammo and action feedback. If a script seems ignored, check the unit type, missing ally, inactive condition, energy, cooldown and latest-order capacity. A stationary call can be replaced by later movement, emergency retreat or cover. Special abilities consume fixed energy and use cooldowns. Read each action description below. Scripts do not guarantee victory.

Online play starts with one verified tank and zero credits. Wins earn 60 server credits and losses 15, once per completed match. Use **Menu → Store → Protected online armory** to buy online slots, recruits and equipment, and edit verified unit or squad scripts. Practice purchases do not transfer online. Never share your saved online profile token.

## General actions

| Python call | Behavior |
|---|---|
| unit.advance() | Advance toward the nearest enemy. |
| unit.withdraw() | Move away from the nearest enemy. |
| unit.stop() | Stop moving and fire from the current position. |
| unit.patrol() | Patrol a 180-unit circle around the starting position. |
| unit.rally() | Move within 60 units of the surviving leader. |
| unit.spread() | Separate from nearby allies to reduce splash exposure. |
| unit.tighten() | Stay within 45 units of the leader. |
| unit.kite() | Keep 330 range while firing. |
| unit.orbit() | Circle the nearest enemy at about 220 range. |
| unit.zigzag() | Add alternating lateral evasion to movement. |
| unit.seek_health() | Route toward the nearest health drop when damaged. |
| unit.seek_ammo() | Route toward the nearest ammo drop when low. |
| unit.seek_shield() | Route toward an available shield drop. |
| unit.seek_boost() | Route toward an overdrive drop. |
| unit.reload() | Reload a partial magazine when below half capacity. |
| unit.cooldown() | Hold fire above 40% heat until the weapon cools. |
| unit.reserve_fire() | Fire only in preferred range when ammo reserves are below 30. |
| unit.anti_air() | Prioritize flying enemies. |
| unit.avoid_danger() | Evade incoming projectiles and the volcanic crater. |
| unit.guard_point() | Hold the starting position and defend it. |
| unit.focus_air() | Target the nearest aircraft. |
| unit.focus_ground() | Target the nearest ground enemy. |
| unit.focus_armor() | Prioritize tanks, artillery, scout cars and boats. |
| unit.focus_support() | Prioritize medics and engineers. |
| unit.focus_farthest() | Select the farthest enemy within radar. |
| unit.focus_low_shield() | Select the enemy with the least shield. |
| unit.focus_high_damage() | Select the enemy with the highest weapon damage. |
| unit.focus_unmarked() | Prefer enemies not already marked by your squad. |
| unit.hold_fire() | Do not shoot until another branch allows firing. |
| unit.fire_at_will() | Use the normal firing policy. |
| unit.seek_cover() | Seek building cover at any health level. |
| unit.leave_cover() | Disable automatic cover seeking. |
| unit.retreat_to_spawn() | Move toward the original spawn point. |
| unit.scan_fast() | Scan twice as often. |
| unit.repair_self() | Repair 8 HP: 15-second cooldown and 30 energy. |
| unit.boost() | Boost movement 15% for 2 seconds: 10-second cooldown, 20 energy. |
| unit.vent_heat() | Remove 35 heat: 8-second cooldown, 15 energy. |
| unit.shield_pulse() | Add 15 shield up to 60: 12-second cooldown, 25 energy. |

## Tank actions

| Python call | Behavior |
|---|---|
| unit.brace() | Take 20% less damage; move 35% slower. |
| unit.ram() | Deal 18 collision damage every 3 seconds within contact range. |
| unit.hull_down() | Seek cover at all health levels; armor improves near cover. |
| unit.armor_piercing() | Gain 25% penetration; fire 20% slower. |
| unit.smoke() | Create a 130-radius smoke screen for 3 seconds; 12-second cooldown, 20 energy. |
| unit.cover_infantry() | Approach injured foot allies to screen them. |

## Infantry actions

| Python call | Behavior |
|---|---|
| unit.sprint() | Move 30% faster; fire 25% slower. |
| unit.ambush() | Deal 35% more damage while near cover. |
| unit.suppress() | Hits add 15 weapon heat to the target. |
| unit.grenade() | Throw a 30-damage grenade within 180 range; splash 65, cooldown 8 seconds, 15 energy. |
| unit.take_knee() | Stop and improve aim accuracy by 50%. |

## Helicopter actions

| Python call | Behavior |
|---|---|
| unit.strafe() | Fly perpendicular attack passes around the enemy. |
| unit.hover() | Hold position with twice the aim accuracy. |
| unit.flare() | Reduce incoming rocket damage 60% while energy is available; cooldown 5 seconds. |
| unit.rocket_pod() | Add 40 splash and 15% damage; fire 40% slower. |
| unit.breakaway() | Withdraw from the current enemy. |

## Rocket actions

| Python call | Behavior |
|---|---|
| unit.lock_on() | Double accuracy, add 15% penetration, and require a longer target lock. |
| unit.backblast() | Move backward after each rocket shot. |
| unit.bunker_buster() | Gain 70 splash radius; deal double damage to buildings. |
| unit.save_rockets() | Hold fire against foot troops. |

## Artillery actions

| Python call | Behavior |
|---|---|
| unit.barrage() | Fire 40% faster at 70% shell damage. |
| unit.siege() | Hold position and deal triple damage to buildings. |
| unit.displace() | Move perpendicular to the target while reloading after a shot. |
| unit.counter_battery() | Prioritize enemy artillery. |

## Sniper actions

| Python call | Behavior |
|---|---|
| unit.steady() | Stop moving and double aim accuracy. |
| unit.headshot() | Gain 25 percentage points of critical chance against foot troops. |
| unit.camouflage() | Halve radar signature until 2 seconds after firing. |
| unit.relocate() | Move sideways after a shot. |

## Boat actions

| Python call | Behavior |
|---|---|
| unit.broadside() | Circle the target at naval firing range. |
| unit.depth_charge() | Deal 35 splash damage to nearby boats within 90 range; cooldown 8 seconds, 15 energy. |
| unit.shore_bombard() | Prioritize land enemies. |

## Medic actions

| Python call | Behavior |
|---|---|
| unit.triage() | Heal the most injured foot ally by 25 within 150 range; cooldown 6 seconds, 15 energy. |
| unit.field_hospital() | Stop and heal nearby allies 3 HP/second within 110 range; drain 4 energy/second. |
| unit.follow_patient() | Approach the most injured foot ally. |

## Engineer actions

| Python call | Behavior |
|---|---|
| unit.repair() | Repair the most injured vehicle by 25 within 150 range; cooldown 6 seconds, 15 energy. |
| unit.supply() | Give a low-ammo ally 25 reserve rounds within 140 range; cooldown 8 seconds, 10 energy. |
| unit.follow_vehicle() | Approach the most injured vehicle. |

## Scout actions

| Python call | Behavior |
|---|---|
| unit.scan() | Boost nearby allies’ radar 30% for 4 seconds; cooldown 8 seconds, 15 energy. |
| unit.mark() | Mark a target for 20% extra squad damage for 4 seconds; cooldown 8 seconds, 15 energy. |
| unit.recon_route() | Patrol a wider 260-unit route. |

## Read-only sensors

- unit.hp_ratio — Current fraction from 0 to 1.
- unit.ammo_ratio — Current fraction from 0 to 1.
- unit.energy_ratio — Current fraction from 0 to 1.
- unit.heat_ratio — Current fraction from 0 to 1.
- unit.kind — Current combat value; cannot be assigned.
- unit.tier — Current combat value; cannot be assigned.
- unit.callsign — Current combat value; cannot be assigned.
- unit.x — Current combat value; cannot be assigned.
- unit.y — Current combat value; cannot be assigned.
- unit.shield — Current combat value; cannot be assigned.
- unit.reserve_ammo — Current combat value; cannot be assigned.
- unit.reloading — Current combat value; cannot be assigned.
- unit.enemy_distance — Current combat value; cannot be assigned.
- unit.enemy_kind — Current combat value; cannot be assigned.
- unit.has_enemy — Current combat value; cannot be assigned.
- unit.in_cover — Current combat value; cannot be assigned.
- unit.moving — Current combat value; cannot be assigned.
- unit.cooldown — Current combat value; cannot be assigned.
- squad.ally_count — Count of living units.
- squad.enemy_count — Count of living units.
- squad.leader_alive — Current combat value; cannot be assigned.
- squad.lowest_ally_hp — Current combat value; cannot be assigned.
- squad.elapsed — Current combat value; cannot be assigned.
- squad.map — Current combat value; cannot be assigned.

## Read-only queries

| Query | Argument and result |
|---|---|
| unit.distance_to(callsign) | World distance; 99999 if absent. |
| unit.ally_health(callsign) | Health fraction, 0 if absent. |
| unit.ally_alive(callsign) | Current status or value. |
| unit.enemies_within(range) | Number of matching living units. |
| unit.allies_within(range) | Number of matching living units. |
| unit.air_enemies_within(range) | Number of matching living units. |
| unit.armored_enemies_within(range) | Number of matching living units. |
| unit.foot_enemies_within(range) | Number of matching living units. |
| unit.health_drop_distance() | World distance; 99999 if absent. |
| unit.ammo_drop_distance() | World distance; 99999 if absent. |
| unit.shield_drop_distance() | World distance; 99999 if absent. |
| unit.boost_drop_distance() | World distance; 99999 if absent. |
| unit.nearest_cover_distance() | World distance; 99999 if absent. |
| unit.enemy_shield() | Current status or value. |
| unit.enemy_health() | Health fraction, 0 if absent. |
| unit.incoming_shots(range) | Current status or value. |
| unit.has_ammo() | Current status or value. |
| unit.can_fire() | Current status or value. |
| unit.can_afford(energy cost) | Current status or value. |
| unit.ability_ready(action name) | Current status or value. |
| unit.map_is(map name) | Current status or value. |
| unit.is_type(unit type) | Current status or value. |
| squad.has_type(unit type) | Current status or value. |
| squad.count_type(unit type) | Number of matching living units. |
| squad.injured_allies(health fraction) | Number of matching living units. |

## Battlefield and progression

Buildings block movement and line of sight until destroyed. Cities have blocks of apartments and churches; canyons have mesa clusters and bunkers; volcanic maps have research domes and silos; harbors have cranes, warehouses, piers and lighthouses. Layouts change with the round. Destruction breaks buildings into four or five chunks. Helicopters fly over obstacles; artillery fires indirectly. Boats stay in coastal water.

Eight initial drops: health restores up to 50 HP, ammo adds up to 40 reserve rounds and refills the magazine, overdrive gives 10 seconds of faster movement/fire, shield raises bonus shield to at least 40. Unneeded drops remain. Building loot has a 30% chance with ten unused drops maximum. Seek actions move toward pickups.

Victory offers one recruit and one small permanent unit upgrade. Upgrades are stored separately and never inserted into Python. Combining three matching units increases tier and command capacity. Hero units and sound are future features.
