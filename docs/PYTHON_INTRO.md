# Python unit programming

Use any external LLM you like. There is no built-in model or programming chat. Copy this reference, describe your units and tactics to your LLM, then paste its Python into **Scripts**. Each unit starts with an independent basic script. Coordination must be supplied explicitly.

## Ask your LLM

Return only a Python script defining tick(unit, squad), using this game's documented subset. No imports, loops, Markdown fences, resource changes or invented APIs. My tank should protect medic-1, conserve ammunition, and seek cover below 40% health. My tank is two stars, so keep active orders within five slots. Explain any tradeoff separately.

## Supported Python subset

This is a restricted Python interpreter, not full CPython. Define exactly **def tick(unit, squad):**. Use four spaces per indentation level. Supported: if / elif / else, local variables, return, pass, numbers, strings without escapes, True / False, arithmetic, comparisons, and / or / not, parentheses, sensors and approved calls. Local variables reset each tick. Comments start with #. No imports, loops, functions other than tick, classes, lists, comprehensions, filesystem, network, arbitrary attributes or assignment to unit/squad fields.

Scripts are limited to 3000 characters, 120 nonempty lines, six nesting levels and 240 interpreter steps per tick. Invalid scripts cannot replace saved programs. Scripts request fixed combat actions; they cannot set stats, spawn units, grant credits or alter inventories. Online units, tiers, gear and credits are server-owned. Practice saves on a player's own device remain editable; this does not grant online possessions. Anonymous accounts are not protection against players creating multiple accounts.

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
