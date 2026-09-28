# Python unit programming

Use any external LLM you like. No connection is required; the optional battle coach can use your chosen model after explicit opt-in. Copy this reference, describe your units and tactics to your LLM, then paste its Python into **Scripts**. Each unit starts with an independent basic script. Coordination must be supplied explicitly.

## Field Base and optional battle coach

After victory or defeat, a result screen shows the outcome, duration and points. Continue to Field Base. After victory, choose one of three recruits there, then claim one of three highlighted permanent upgrades. All eight training categories are laid out there for the selected unit. Paid training starts at 80 credits and increases by 20 per existing level, capped at twenty levels. Combine three matching units to raise their star tier and order capacity. Equipment, paint and scripts are available from the depot. Old purchased battlefield structures are removed and their purchase/training credits refunded once.

Hover over units on PC or tap their model/name on a phone for stats. Collection import/export is hidden and remains a future update.

**Optional LLM coach** supports your own Ollama, LM Studio / compatible API, Google AI Studio (Gemini API) or OpenAI (Responses API) model. Test the connection, choose an available model, then explicitly enable sending battle reports and save. Nothing is sent by default. Opt-in resets when the page reloads; endpoint/model/location preferences persist, but keys remain only in memory. Private-network HTTP is supported; public provider endpoints require HTTPS. Each player chooses their own model and location.

The coach receives the grouped function reference, owned units' scripts/types/tiers, optional squad script, and the last battle report: map, round, outcome, duration, shots, damage dealt/taken, hit events, kills, survival, remaining ammo/health and collected pickups. It does not receive your API key as prompt text. Your chosen hosted provider may charge for requests; its normal privacy terms apply. No provider requests happen until opt-in.

Analysis starts automatically at the end of each campaign battle while enabled. The main screen exposes model setup, reanalysis and draft application without opening Menu. A visible note distinguishes analyzing, unapplied drafts, applied scripts and no changes. Added and removed lines are counted with a line comparison, not inferred from the model summary. The complete function guide is loaded by the local server and included in every request; successful replies show its character count.

Valid drafts can be applied manually. **Automatically apply valid scripts** is a separate opt-in. The interpreter validates every returned unit script and optional squad script before any changes; unknown units or invalid actions reject the whole draft. Changing an analyzed unit’s scripts, combining it away, or resetting a run during analysis makes the reply stale. Adding a recruit does not invalidate the surviving units’ draft; new recruits use their starter script until the next analysis. The coach cannot award units, credits, upgrades or equipment. A failed request leaves existing scripts intact. Server-routed Ollama gets one retry for temporary startup errors; Ollama stays loaded for fifteen minutes after a request. Direct browser and hosted requests are not retried automatically. Multiplayer combat and accounts remain server-controlled; the coach is a campaign feature.

## Connect your model

1. Open **Model setup** on the main screen. Select your model app or API provider.
2. For Ollama or LM Studio, choose **This device** or **Game server or local network**. Enter the model API address, not its chat website.
3. Press **Test connection & find models**. This only lists model names; it sends no battle report and generates no text. Choose a text/chat model your machine or account can run. If the list is empty, load/install a model or enter its name manually.
4. Enable sending battle reports and save. To use every validated draft automatically, enable the separate application checkbox. Otherwise review and apply drafts yourself.

### Ollama on this device

Use http://127.0.0.1:11434 (the game adds /api/chat). Keep Ollama running. Direct mode connects from the browser, so localhost means the device running that browser. The complete reference and sanitized battle report are prepared by the game server and sent by your browser to your model. The reply returns to the game server for validation before application.

If a browser connection is blocked, open **Connection help** for your exact game origin. Ollama permits additional origins through OLLAMA_ORIGINS. On Windows the game displays a PowerShell command to set it for your user; quit Ollama from its tray icon and reopen it afterward. For the current LAN deployment:

~~~powershell
[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'http://192.168.1.10:8878', 'User')
~~~

On macOS run launchctl setenv OLLAMA_ORIGINS http://192.168.1.10:8878 and restart Ollama. On Linux add Environment="OLLAMA_ORIGINS=http://192.168.1.10:8878" to the Ollama service override, reload systemd and restart the service. Use your actual game origin if it differs. Preserve any existing allowed origins by adding this one to the comma-separated list. Allow browser local-network access if prompted. An HTTPS game may block HTTP model access; use a permitted HTTPS model endpoint or the server route. See the official Ollama FAQ: https://docs.ollama.com/faq.

### LM Studio or a compatible API

Start its API server and use http://127.0.0.1:1234/v1 for LM Studio. The game adds /chat/completions. In LM Studio server settings enable CORS for direct browser connections; supply the API token if authentication is enabled. Load a text model before testing. Compatible APIs should support GET /v1/models and POST /v1/chat/completions. An API without a models listing may still work when you enter its model ID manually. See https://lmstudio.ai/docs/developer/core/server/settings.

### Model on the server or another LAN computer

Select **Game server or local network**. localhost now means the Docker host. To reach your PC use its private-network IP, for example http://192.168.1.50:11434 for Ollama. A phone using localhost cannot reach a PC model. Ollama must be configured to listen on the LAN with OLLAMA_HOST; LM Studio has **Serve on Local Network**. Allow the game server through that machine's firewall. Enable authentication if the model app supports it. Browser CORS is not needed for this route because the game server makes the request. Do not expose a local unauthenticated model API to the public internet. This route does not install any PC helper or require an SSH connection.

### Google AI Studio, OpenAI and other providers

Use your own provider API key. Gemini uses https://generativelanguage.googleapis.com/v1beta and OpenAI uses https://api.openai.com/v1/responses. Other compatible providers use their documented HTTPS base address. Model discovery authenticates to the provider and lists available models; select a text model suitable for your account. Not every listed model supports the required structured text response. Automatic requests go through the game server, include the complete function guide and use your session-only key. Web chatbot logins/subscriptions are separate; use **Copy battle + full guide** when using a chat website. Hosted providers may charge for generated requests.

## Points and leaderboard

Each battle awards 100 points for victory or 20 for defeat, plus 25 for each defeated enemy and 10 for each surviving friendly unit. Practice score is local and shown on the result screen and battlefield. Online leaderboard points come only from authoritative server matches, are recorded once per match and sort highest first. Previous recorded online results start at 100 points per win and 20 per loss because old combat bonuses were not retained. Local practice scores cannot be submitted to the online leaderboard.

## ChatGPT and AI Studio web chats

Use **Copy battle + full guide for web chatbot** to copy the reference, report and current unit scripts. Paste the brief into the website you choose, then paste its Python into Scripts. Web-chat subscriptions/logins are separate from automatic API connections. For automatic Gemini/OpenAI coaching, select the provider, enter a model ID available to your API account and a session-only API key, then opt in. Google uses generateContent with structured JSON; OpenAI uses Responses with a strict schema and store:false. Native provider protocols are tested with fixtures; paid accounts are not contacted during development.

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

## Infantry squad and artillery models

An infantry unit contains four smaller rifle soldiers. It still counts as one unit and uses one script and shared health. Each rifle deals one quarter of the listed squad damage; four shots form one volley and consume one squad ammo charge. Damage, spread and critical hits are computed for each shot. Artillery has a barrel elevated 72 degrees above horizontal and retains indirect fire.
