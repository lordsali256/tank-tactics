// dist/server/engine.mjs
function createEngine(a, b, map, initialSeed, restored = null) {
  const makeNode = () => ({ textContent: "", value: "", style: {}, children: [], classList: { remove() {
  }, toggle() {
  } }, replaceChildren() {
    this.children = [];
  }, append(...nodes2) {
    this.children.push(...nodes2);
  }, setAttribute() {
  }, addEventListener() {
  }, showModal() {
  }, close() {
  }, querySelector() {
    return null;
  } });
  const nodes = /* @__PURE__ */ new Map();
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, makeNode());
    return nodes.get(id);
  }, createElement: makeNode, querySelectorAll() {
    return [];
  } };
  const fakeCanvas = document.getElementById("arena");
  fakeCanvas.width = 920;
  fakeCanvas.height = 560;
  fakeCanvas.getContext = () => ({});
  const localStorage = { getItem: () => null, setItem() {
  }, removeItem() {
  } };
  const window = {};
  const performance = { now: () => 0 };
  const requestAnimationFrame = () => {
  };
  const fetch = async () => {
    throw Error("Model unavailable in multiplayer engine");
  };
  const confirm = () => false;
  const setTimeout = () => 0;
  const clearTimeout = () => {
  };
  const canvas = document.getElementById("arena"), ctx = canvas.getContext("2d");
  const WORLD_SCALE = Math.sqrt(10), W = canvas.width * WORLD_SCALE, H = canvas.height * WORLD_SCALE;
  const rocks = [{ x: 320, y: 105, w: 82, h: 132 }, { x: 520, y: 320, w: 90, h: 125 }, { x: 425, y: 242, w: 70, h: 76 }];
  const commandInfo = [
    ["radar", "Radar", "Scan for targets."],
    ["gun", "Gun", "Fire when visible."],
    ["drive", "Drive", "Move under the plan."],
    ["cover", "Cover", "Seek shelter when hurt."],
    ["duck", "Duck", "Dodge while evading."],
    ["perch", "Sniper Perch", "Hold range and aim."]
  ];
  const rewardOptions = [
    { instruction: "Use cover below half hull.", buff: "Fortified hull", effect: "Take 20% less damage next round.", kind: "armor" },
    { instruction: "Evade with zigzag movement while reloading.", buff: "Servo boost", effect: "Move 15% faster next round.", kind: "speed" },
    { instruction: "Keep distance and aim like a sniper.", buff: "Precision rounds", effect: "Deal 20% more damage next round.", kind: "damage" }
  ];
  let compiledPlan = null, compiledText = "", compileId = 0, compiling = false, seed = 12345, accumulator = 0;
  function random() {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return seed / 4294967296;
  }
  let commands = /* @__PURE__ */ new Set(["radar", "gun", "drive", "cover"]), round = 1, wins = 0, mode = "ready", player = null, enemy = null, shots = [], sparks = [], plan = null, last = performance.now(), elapsed = 0, logTimer = 0, nextBuff = null, activeBuff = null;
  const $ = (id) => document.getElementById(id);
  function commandRender() {
    const root = $("commands");
    root.replaceChildren();
    for (const [id, name, desc] of commandInfo) {
      const b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "command" + (commands.has(id) ? " selected" : "");
      b2.textContent = name;
      b2.title = desc;
      b2.setAttribute("aria-label", name + ": " + desc);
      b2.setAttribute("aria-pressed", commands.has(id));
      b2.onclick = () => {
        if (mode === "running" || mode === "won" || compiling) return;
        if (commands.has(id)) commands.delete(id);
        else commands.add(id);
        commandRender();
        preview();
        $("message").textContent = name + " command " + (commands.has(id) ? "enabled." : "disabled.");
      };
      root.append(b2);
    }
  }
  function parsePlan() {
    if (compiledPlan && compiledText === $("prompt").value) return { ...compiledPlan, cover: compiledPlan.cover && commands.has("cover") };
    const s = $("prompt").value.toLowerCase();
    const style = /snip|keep distance|long.range|perch|stay back/.test(s) ? "sniper" : /rush|aggress|charge|close|push forward/.test(s) ? "rush" : "balanced";
    return { coverBelow: 0.52, retreatBelow: 0.28, firePolicy: "always", style, cover: commands.has("cover") && /cover|hide|shelter/.test(s), evade: /evade|dodge|zigzag|strafe/.test(s), retreat: /retreat|fall back|pull back/.test(s), preferred: style === "sniper" ? 360 : style === "rush" ? 145 : 255 };
  }
  function styleLabel() {
    return plan.style === "rush" ? "Rush" : plan.style === "sniper" ? "Snipe" : "Mid range";
  }
  function updateProgramLive(action) {
    const label = "Program: " + styleLabel() + " \xB7 " + action;
    if ($("programLive").textContent !== label) $("programLive").textContent = label;
  }
  function preview() {
    plan = parsePlan();
    const parts = [styleLabel() + " at " + plan.preferred + " range"];
    if (plan.cover) parts.push("seek cover below " + Math.round(plan.coverBelow * 100) + "% hull");
    if (plan.evade) parts.push("zigzag movement");
    if (plan.retreat) parts.push("retreat below " + Math.round(plan.retreatBelow * 100) + "% hull");
    if (commands.has("perch") && plan.style === "sniper") parts.push("steady sniper aim");
    if (!commands.has("gun")) parts.push("Gun command off");
    if (!commands.has("drive")) parts.push("Drive command off");
    $("planPreview").textContent = parts.join(" \xB7 ") + " \xB7 Fire: " + plan.firePolicy + (compiledPlan && compiledText === $("prompt").value ? ". " + compiledPlan.explanation : ". Rule parser preview.");
    if (mode !== "running") updateProgramLive("Awaiting deployment");
    renderStats();
  }
  function renderStats() {
    const root = $("statList");
    root.replaceChildren();
    const isRush = plan?.style === "rush", isSnipe = plan?.style === "sniper", speed = 104 * (activeBuff?.kind === "speed" ? 1.15 : 1), damage = 24 * (activeBuff?.kind === "damage" ? 1.2 : 1), spread = isSnipe ? commands.has("perch") ? 0.025 : 0.045 : isRush ? 0.16 : 0.09, radar = commands.has("radar") ? commands.has("perch") && isSnipe ? 650 : 580 : 240;
    const stats = [["Hull integrity", "160 HP"], ["Magazine", (player?.ammo ?? 6) + " / 6 rounds"], ["Magazine reload", "2.4 sec"], ["Turret traverse", "160\xB0 / sec"], ["Gun damage", commands.has("gun") ? damage.toFixed(1) : "Gun off"], ["Reload time", commands.has("gun") ? (isRush ? 0.64 : isSnipe ? 0.9 : 0.77) + " sec" : "Gun off"], ["Tank speed", commands.has("drive") ? speed.toFixed(0) + " units/s" : "Drive off"], ["Radar range", radar + " units"], ["Preferred range", plan.preferred + " units"], ["Aim spread", (spread * 180 / Math.PI).toFixed(1) + "\xB0"], ["Cover reduction", plan.cover ? "28% near cover" : "Off"], ["Duck dodge", commands.has("duck") && plan.evade ? "17%" : "Off"], ["Round buff", activeBuff ? activeBuff.buff : nextBuff ? nextBuff.buff + " (next)" : "None"]];
    for (const [name, value] of stats) {
      const cell = document.createElement("div"), label = document.createElement("small"), number = document.createElement("b");
      cell.className = "stat-cell";
      label.textContent = name;
      number.textContent = value;
      cell.append(label, number);
      root.append(cell);
    }
  }
  function makeTank(team, x, y) {
    const isPlayer = team === "player";
    const max = isPlayer ? 160 : Math.round(115 + round * 25);
    return { team, x, y, angle: isPlayer ? 0 : Math.PI, hp: max, maxHp: max, r: 20, cooldown: 1.2, hitFlash: 0, coverTime: 0, phase: 0, ammo: 6, reloading: 0 };
  }
  function resetPositions() {
    player = makeTank("player", 145, 280);
    enemy = makeTank("enemy", 775, 280);
    shots = [];
    sparks = [];
    elapsed = 0;
    seed = 12345 + round;
    accumulator = 0;
    updateHud();
  }
  function message(s) {
    $("battleLog").textContent = s;
    logTimer = 2.7;
  }
  function updateBuffStatus() {
    $("buffStatus").textContent = activeBuff ? "Active: " + activeBuff.buff : nextBuff ? "Next: " + nextBuff.buff : "No round buff";
    renderStats();
  }
  function deploy() {
    if (mode === "running" || mode === "won" || compiling) return;
    activeBuff = nextBuff;
    nextBuff = null;
    updateBuffStatus();
    preview();
    resetPositions();
    mode = "running";
    $("result").classList.remove("show");
    $("prompt").disabled = true;
    $("deploy").disabled = true;
    $("arenaState").textContent = "Match live";
    $("message").textContent = activeBuff ? activeBuff.buff + " active for this round." : "Program locked. Battle in progress.";
    updateProgramLive("Executing " + styleLabel() + " plan");
    message("Tanks deployed.");
  }
  function resetRun() {
    round = 1;
    wins = 0;
    mode = "ready";
    nextBuff = null;
    activeBuff = null;
    updateBuffStatus();
    if ($("rewardDialog").open) $("rewardDialog").close();
    $("prompt").disabled = false;
    $("deploy").disabled = false;
    $("deploy").textContent = "Deploy squad \u2192";
    $("result").classList.remove("show");
    $("roundLabel").textContent = "Round 1";
    $("winsLabel").textContent = "Run wins: 0";
    $("arenaState").textContent = "Awaiting deployment";
    $("message").textContent = "New run ready.";
    resetPositions();
    preview();
    message("Enter a plan and deploy your tank.");
  }
  function chooseReward(option) {
    const prior = $("prompt").value.trim();
    $("prompt").value = prior + (prior ? " " : "") + option.instruction;
    nextBuff = option;
    round++;
    $("roundLabel").textContent = "Round " + round;
    $("rewardDialog").close();
    mode = "ready";
    $("arenaState").textContent = "Ready for next round";
    $("deploy").textContent = "Deploy round " + round + " \u2192";
    $("deploy").disabled = false;
    $("message").textContent = option.buff + " queued for one round. Edit your program or deploy.";
    resetPositions();
    preview();
    updateBuffStatus();
  }
  function finish(win) {
    mode = win ? "won" : "lost";
    activeBuff = null;
    updateBuffStatus();
    updateProgramLive(win ? "Victory" : "Defeat");
    $("prompt").disabled = false;
    $("deploy").disabled = false;
    $("result").classList.toggle("show", !win);
    $("arenaState").textContent = win ? "Victory" : "Defeat";
    if (win) {
      wins++;
      $("winsLabel").textContent = "Run wins: " + wins;
      const root = $("rewards");
      root.replaceChildren();
      for (const option of rewardOptions) {
        const b2 = document.createElement("button");
        b2.type = "button";
        b2.className = "reward";
        const instruction = document.createElement("strong"), buff = document.createElement("span"), effect = document.createElement("small");
        instruction.textContent = option.instruction;
        buff.textContent = option.buff;
        effect.textContent = option.effect;
        b2.append(instruction, buff, effect);
        b2.onclick = () => chooseReward(option);
        root.append(b2);
      }
      $("deploy").disabled = true;
      message("Victory! Choose a tactic and next-round buff.");
      $("rewardDialog").showModal();
      root.querySelector("button").focus();
    } else {
      $("resultTitle").textContent = "Tank destroyed";
      $("resultText").textContent = "Adjust your instruction or commands and retry this round, or start a new run.";
      $("deploy").textContent = "Retry round " + round + " \u2192";
      message("Defeat. Tune your tank and try again.");
    }
  }
  function clamp(v, a2, b2) {
    return Math.max(a2, Math.min(b2, v));
  }
  function norm(x, y) {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  }
  function inRect(x, y, r) {
    return x + r > r.x && x - r < r.x + r.w && y + r > r.y && y - r < r.y + r.h;
  }
  function collides(x, y, r) {
    if (x < r || x > W - r || y < r || y > H - r) return true;
    return rocks.some((o) => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
  }
  function nearRock(t) {
    return rocks.some((o) => {
      const px = clamp(t.x, o.x, o.x + o.w), py = clamp(t.y, o.y, o.y + o.h);
      return Math.hypot(t.x - px, t.y - py) < 65;
    });
  }
  function blockingRock(ax, ay, bx, by) {
    for (let i = 1; i < 24; i++) {
      const q = i / 24, x = ax + (bx - ax) * q, y = ay + (by - ay) * q;
      const rock = rocks.find((o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
      if (rock) return rock;
    }
    return null;
  }
  function lineBlocked(ax, ay, bx, by) {
    return !!blockingRock(ax, ay, bx, by);
  }
  function coverTarget(t, foe) {
    let best = null, score = Infinity;
    for (const o of rocks) {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const [vx, vy] = norm(cx - foe.x, cy - foe.y);
      const tx = clamp(cx + vx * (Math.max(o.w, o.h) / 2 + 35), 30, W - 30), ty = clamp(cy + vy * (Math.max(o.w, o.h) / 2 + 35), 30, H - 30);
      if (collides(tx, ty, t.r)) continue;
      const s = Math.hypot(t.x - tx, t.y - ty);
      if (s < score) {
        score = s;
        best = [tx, ty];
      }
    }
    return best;
  }
  function pathStep(t, foe) {
    const cell = 56, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), index = (x, y) => y * cols + x, point = (i) => [(i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.5) * cell], free = (i) => {
      const [x, y] = point(i);
      return !collides(x, y, t.r + 2);
    };
    const sx = clamp(Math.floor(t.x / cell), 0, cols - 1), sy = clamp(Math.floor(t.y / cell), 0, rows - 1), gx = clamp(Math.floor(foe.x / cell), 0, cols - 1), gy = clamp(Math.floor(foe.y / cell), 0, rows - 1), start = index(sx, sy), goal = index(gx, gy), prev = new Int32Array(cols * rows).fill(-1), queue = [start];
    prev[start] = start;
    for (let q = 0; q < queue.length; q++) {
      const cur2 = queue[q], cx = cur2 % cols, cy = Math.floor(cur2 / cols);
      if (cur2 === goal) break;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = index(nx, ny);
        if (prev[ni] !== -1 || !free(ni)) continue;
        prev[ni] = cur2;
        queue.push(ni);
      }
    }
    if (prev[goal] === -1) return [foe.x, foe.y];
    let cur = goal, path = [cur];
    while (cur !== start && path.length < cols * rows) {
      cur = prev[cur];
      path.push(cur);
    }
    path.reverse();
    return point(path[Math.min(3, path.length - 1)]);
  }
  function moveTank(t, dx, dy, speed, dt) {
    const [nx, ny] = norm(dx, dy), step = speed * dt;
    let x = t.x + nx * step, y = t.y + ny * step;
    if (!collides(x, t.y, t.r)) t.x = x;
    if (!collides(t.x, y, t.r)) t.y = y;
  }
  function fire(t, target) {
    const isP = t.team === "player", speed = 450, baseDamage = isP ? 24 : 17 + round * 2, damage = baseDamage * (isP && activeBuff?.kind === "damage" ? 1.2 : 1), spread = isP ? plan.style === "sniper" ? commands.has("perch") ? 0.025 : 0.045 : plan.style === "rush" ? 0.16 : 0.09 : 0.15;
    const a2 = t.angle + (random() - 0.5) * spread;
    t.ammo--;
    if (t.ammo === 0) t.reloading = 2.4;
    shots.push({ team: t.team, x: t.x + Math.cos(a2) * 27, y: t.y + Math.sin(a2) * 27, vx: Math.cos(a2) * speed, vy: Math.sin(a2) * speed, damage, life: 1.6 });
    t.cooldown = isP ? plan.style === "rush" ? 0.64 : plan.style === "sniper" ? 0.9 : 0.77 : 0.98;
    sparks.push({ x: t.x + Math.cos(a2) * 27, y: t.y + Math.sin(a2) * 27, life: 0.15, color: isP ? "#d7fb75" : "#f39c6c" });
  }
  function updateTank(t, foe, dt) {
    t.cooldown -= dt;
    if (t.reloading > 0) {
      t.reloading -= dt;
      if (t.reloading <= 0) t.ammo = t.stats.mag;
    }
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    t.phase += dt;
    const isP = t.team === "player", p = isP ? plan : { style: "balanced", cover: true, evade: true, retreat: false, preferred: t.stats.range, coverBelow: 0.34, retreatBelow: 0.25, firePolicy: "always" };
    const dx = foe.x - t.x, dy = foe.y - t.y, dist = Math.hypot(dx, dy) || 1, [ux, uy] = norm(dx, dy);
    let mx = 0, my = 0, action = "Holding range";
    const hurt = t.hp / t.maxHp < p.coverBelow, retreating = p.retreat && t.hp / t.maxHp < p.retreatBelow, shelter = p.cover && hurt && !nearRock(t) ? coverTarget(t, foe) : null, block = t.stats.flying || t.stats.indirect ? null : blockingRock(t.x, t.y, foe.x, foe.y);
    if (shelter && Math.hypot(t.x - shelter[0], t.y - shelter[1]) > 23) {
      mx = shelter[0] - t.x;
      my = shelter[1] - t.y;
      action = "Seeking cover";
    } else if (block) {
      t.pathClock = (t.pathClock || 0) - dt;
      if (t.pathClock <= 0) {
        t.pathTarget = pathStep(t, foe);
        t.pathClock = 0.25;
      }
      mx = t.pathTarget[0] - t.x;
      my = t.pathTarget[1] - t.y;
      action = "Routing around cover";
    } else if (retreating || dist < p.preferred - 45) {
      mx = -ux;
      my = -uy;
      action = retreating ? "Retreating" : "Opening distance";
    } else if (dist > p.preferred + 45) {
      mx = ux;
      my = uy;
      action = "Closing distance";
    } else if (p.firePolicy === "stationary") {
      action = "Holding to aim";
    } else {
      const sway = Math.sin(t.phase * 2.7 + (isP ? 0 : 2));
      mx = -uy * sway;
      my = ux * sway;
      action = "Strafing at " + p.preferred + " range";
    }
    if (p.evade) {
      const wave = Math.sin(t.phase * 5.4 + (isP ? 0 : 1));
      mx += -uy * wave * 0.7;
      my += ux * wave * 0.7;
      action += " \xB7 zigzag";
    }
    const speed = t.stats.speed * (isP && activeBuff?.kind === "speed" ? 1.15 : 1);
    if (!isP || commands.has("drive")) moveTank(t, mx, my, speed, dt);
    else action = "Holding position (Drive off)";
    const aim = Math.atan2(foe.y - t.y, foe.x - t.x), turn = Math.atan2(Math.sin(aim - t.angle), Math.cos(aim - t.angle));
    t.angle += clamp(turn, -2.8 * dt, 2.8 * dt);
    const sensor = isP ? commands.has("radar") ? commands.has("perch") && p.style === "sniper" ? 650 : 580 : 240 : 580;
    if (isP && !commands.has("radar") && dist > sensor) action = "Searching without Radar";
    const policyOK = p.firePolicy === "always" || (p.firePolicy === "inRange" ? Math.abs(dist - p.preferred) <= 45 : !commands.has("drive") || Math.hypot(mx, my) < 0.1);
    if (t.reloading > 0) action = "Reloading magazine \xB7 " + t.reloading.toFixed(1) + "s";
    if (t.ammo > 0 && t.reloading <= 0 && Math.abs(turn) < 0.12 && policyOK && t.cooldown <= 0 && dist < sensor && (t.stats.flying || t.stats.indirect || !lineBlocked(t.x, t.y, foe.x, foe.y)) && (!isP || commands.has("gun"))) {
      fire(t, foe);
      action = "Firing " + p.style + " plan";
      if (logTimer <= 0) message(isP ? "Your tank fires." : "Enemy tank fires.");
    }
    if (isP) updateProgramLive(action);
  }
  function update(dt) {
    if (mode !== "running") return;
    elapsed += dt;
    logTimer -= dt;
    updateTank(player, enemy, dt);
    updateTank(enemy, player, dt);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const target = s.team === "player" ? enemy : player;
      const px = s.x - s.vx * dt, py = s.y - s.vy * dt, segment = s.vx * s.vx + s.vy * s.vy, q = clamp(((target.x - px) * s.vx + (target.y - py) * s.vy) / (segment * dt), 0, 1);
      const hit = Math.hypot(px + s.vx * dt * q - target.x, py + s.vy * dt * q - target.y) < target.r;
      const wall = !s.indirect && lineBlocked(px, py, s.x, s.y);
      if (hit && !wall) {
        let damage = s.damage;
        if (target.team === "player" && plan.cover && nearRock(target)) damage *= 0.72;
        if (target.team === "player" && activeBuff?.kind === "armor") damage *= 0.8;
        if (target.team === "player" && commands.has("duck") && plan.evade && random() < 0.17) damage = 0;
        target.hp = clamp(target.hp - damage, 0, target.maxHp);
        target.hitFlash = 0.2;
        sparks.push({ x: s.x, y: s.y, life: 0.3, color: damage ? "#f8e6a6" : "#a6d7ff" });
        if (target.hp <= 0) {
          updateHud();
          finish(target.team === "enemy");
          shots.splice(i, 1);
          break;
        }
      }
      if (hit || wall || s.life <= 0 || s.x < 0 || s.x > W || s.y < 0 || s.y > H) shots.splice(i, 1);
    }
    for (const s of sparks) s.life -= dt;
    sparks = sparks.filter((s) => s.life > 0);
    updateHud();
    if (mode === "running" && elapsed > 45) {
      finish(player.hp / player.maxHp >= enemy.hp / enemy.maxHp);
      message("Time limit reached. Higher hull percentage wins.");
    }
  }
  function updateHud() {
    if (!player || !enemy) return;
    $("playerHp").style.width = player.hp / player.maxHp * 100 + "%";
    $("enemyHp").style.width = enemy.hp / enemy.maxHp * 100 + "%";
    $("playerHpText").textContent = Math.ceil(player.hp) + " / " + player.maxHp + " \xB7 Ammo " + player.ammo + "/" + player.stats.mag;
    $("enemyHpText").textContent = Math.ceil(enemy.hp) + " / " + enemy.maxHp;
  }
  function tankDraw(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.fillStyle = "#07120d88";
    ctx.beginPath();
    ctx.ellipse(2, 7, 25, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.team === "player" ? "#8fc459" : "#bd7652";
    ctx.fillRect(-22, -18, 44, 36);
    ctx.fillStyle = t.team === "player" ? "#415f34" : "#693c31";
    ctx.fillRect(-26, -23, 10, 46);
    ctx.fillRect(16, -23, 10, 46);
    ctx.fillStyle = t.hitFlash > 0 ? "#fff8dc" : t.team === "player" ? "#d7fb75" : "#f3a174";
    ctx.fillRect(-13, -13, 26, 26);
    ctx.fillStyle = "#0c170e";
    ctx.fillRect(5, -5, 31, 10);
    ctx.fillStyle = t.team === "player" ? "#d7fb75" : "#f3a174";
    ctx.fillRect(30, -3, 9, 6);
    ctx.restore();
    ctx.fillStyle = t.team === "player" ? "#d7fb75" : "#f3a174";
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((t.team === "player" ? "YOU \xB7 " : "AI \xB7 ") + unitTypes[t.type].name + " " + "\u2605".repeat(t.tier), t.x, t.y - 36);
  }
  function draw() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#183023");
    g.addColorStop(1, "#102019");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#9dbe8031";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#759e6344";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    for (const o of rocks) {
      ctx.fillStyle = "#111a14aa";
      ctx.fillRect(o.x + 7, o.y + 8, o.w, o.h);
      ctx.fillStyle = "#475e43";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "#6c8665";
      ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 10);
      ctx.strokeStyle = "#93aa7744";
      ctx.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
    }
    if (player) tankDraw(player);
    if (enemy) tankDraw(enemy);
    for (const s of shots) {
      ctx.fillStyle = s.team === "player" ? "#e4ff9c" : "#ffc191";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const s of sparks) {
      ctx.globalAlpha = clamp(s.life / 0.3, 0, 1);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8 * (1 - s.life / 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (mode !== "running") {
      ctx.fillStyle = "#06100988";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#e9f8e0";
      ctx.font = "800 32px sans-serif";
      ctx.fillText(mode === "won" ? "VICTORY" : mode === "lost" ? "TANK DESTROYED" : "ARENA READY", W / 2, H / 2 - 4);
      ctx.fillStyle = "#c5dbb9";
      ctx.font = "16px sans-serif";
      ctx.fillText(mode === "ready" ? "Set your program, then deploy." : mode === "won" ? "Choose a tactic reward." : "Tune your program and try again.", W / 2, H / 2 + 28);
    }
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1e3, 0.04);
    last = now;
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      update(1 / 60);
      accumulator -= 1 / 60;
    }
    draw();
    requestAnimationFrame(frame);
  }
  async function checkModel() {
    if (typeof PhoneAI !== "undefined" && PhoneAI.available()) {
      $("modelStatus").textContent = PhoneAI.modelName();
      $("compile").disabled = false;
      return;
    }
    try {
      const r = await fetch("/api/status", { signal: AbortSignal.timeout(4e3) });
      const s = await r.json();
      if (!r.ok || !s.available) throw Error();
      $("modelStatus").textContent = s.model + " \xB7 Computer-local Ollama";
      $("compile").disabled = false;
    } catch {
      $("modelStatus").textContent = "Rule parser active \xB7 Open the USB/local test app for qwen3.5:4b";
      $("compile").disabled = true;
    }
  }
  async function compileModel() {
    if (mode === "running" || mode === "won" || compiling) return;
    const id = ++compileId, text = $("prompt").value;
    compiling = true;
    $("deploy").disabled = true;
    $("compile").disabled = true;
    $("prompt").disabled = true;
    $("reset").disabled = true;
    $("modelStatus").textContent = "Local AI is compiling your instruction\u2026";
    try {
      const out = await requestLocalPlan(text, selectedUnit(), [...commands]);
      if (id !== compileId) return;
      compiledPlan = out.plan;
      compiledText = text;
      preview();
      $("modelStatus").textContent = out.model + " \xB7 Plan ready";
      $("message").textContent = "Review the AI plan above, then deploy.";
    } catch (e) {
      compiledPlan = null;
      preview();
      $("modelStatus").textContent = "Compile failed \xB7 Rule parser active";
      $("message").textContent = e.message;
    } finally {
      compiling = false;
      $("deploy").disabled = false;
      $("compile").disabled = false;
      $("prompt").disabled = false;
      $("reset").disabled = false;
    }
  }
  $("compile").onclick = compileModel;
  $("prompt").addEventListener("input", () => {
    compiledPlan = null;
    preview();
    $("modelStatus").textContent = "Instruction changed \xB7 Compile again to use local AI";
  });
  $("deploy").onclick = deploy;
  $("reset").onclick = resetRun;
  $("statsButton").onclick = () => {
    renderStats();
    $("statsDialog").showModal();
  };
  $("closeStats").onclick = () => $("statsDialog").close();
  $("rewardDialog").addEventListener("cancel", (e) => e.preventDefault());
  document.querySelectorAll("[data-prompt]").forEach((b2) => b2.onclick = () => {
    if (mode === "running" || mode === "won" || compiling) return;
    compiledPlan = null;
    $("prompt").value = b2.dataset.prompt;
    preview();
    $("modelStatus").textContent = "Instruction changed \xB7 Compile again to use local AI";
    $("message").textContent = "Instruction loaded. Edit it or deploy.";
  });
  const unitTypes = {
    tank: { name: "Tank", role: "Armored all-rounder", hp: 160, damage: 24, speed: 104, range: 255, reload: 0.77, mag: 6, spread: 0.09, r: 20 },
    infantry: { name: "Infantry", role: "Rifle fire, steady movement, light armor", hp: 115, damage: 13, speed: 80, range: 215, reload: 0.38, mag: 12, spread: 0.12, r: 12 },
    helicopter: { name: "Helicopter", role: "Flies over cover; rapid cannon", hp: 125, damage: 17, speed: 155, range: 290, reload: 0.5, mag: 8, spread: 0.1, r: 21, flying: true },
    rocket: { name: "Rocket soldier", role: "Heavy rockets, slow reload", hp: 110, damage: 46, speed: 93, range: 320, reload: 1.7, mag: 2, spread: 0.065, r: 13 },
    artillery: { name: "Artillery", role: "Lobs shells over cover at long range", hp: 135, damage: 58, speed: 65, range: 420, reload: 2.3, mag: 2, spread: 0.05, r: 22, indirect: true },
    boat: { name: "Boat", role: "Naval cannon; sea maps only", hp: 150, damage: 31, speed: 110, range: 340, reload: 1.1, mag: 4, spread: 0.07, r: 19, water: true },
    sniper: { name: "Sniper", role: "Accurate long-range single shots", hp: 90, damage: 39, speed: 100, range: 390, reload: 1.4, mag: 4, spread: 0.018, r: 12 }
  };
  Object.assign(unitTypes, { medic: { name: "Medic", hp: 85, damage: 9, speed: 82, range: 180, reload: 0.7, mag: 8, spread: 0.13, r: 12 }, engineer: { name: "Engineer", hp: 100, damage: 11, speed: 75, range: 195, reload: 0.65, mag: 10, spread: 0.12, r: 12 }, scout: { name: "Scout car", hp: 95, damage: 14, speed: 125, range: 245, reload: 0.6, mag: 10, spread: 0.1, r: 16 } });
  const rosterKey = "tank-tactics-roster-v1";
  let roster = [], selectedId = "", rosterSerial = 0, economy = { credits: 100, slots: 1, reserve: {} };
  let levelReward = null;
  function newUnit2(type, tier = 1) {
    return { id: "unit-" + ++rosterSerial, type, tier, instruction: "", commands: [] };
  }
  function unlocked(u) {
    return ["radar", "gun", "drive", ...u.tier >= 2 ? ["cover", "duck"] : [], ...u.tier >= 3 ? ["perch", "retreat"] : []];
  }
  function selectedUnit() {
    return roster.find((u) => u.id === selectedId) || roster[0];
  }
  function saveRoster() {
    try {
      localStorage.setItem(rosterKey, JSON.stringify({ roster, selectedId, rosterSerial, economy }));
    } catch {
    }
  }
  function saveProgram() {
    const u = selectedUnit();
    if (!u) return;
    u.instruction = $("prompt").value;
    u.commands = [...commands];
    saveRoster();
  }
  try {
    const saved = JSON.parse(localStorage.getItem(rosterKey));
    if (saved && Array.isArray(saved.roster) && saved.roster.length > 0 && saved.roster.length <= 15 && saved.roster.every((u) => unitTypes[u.type] && Number.isInteger(u.tier) && u.tier >= 1 && u.tier <= 3 && typeof u.id === "string" && typeof u.instruction === "string" && Array.isArray(u.commands)) && new Set(saved.roster.map((u) => u.id)).size === saved.roster.length) {
      roster = saved.roster;
      if (saved.economy && Number.isSafeInteger(saved.economy.credits) && saved.economy.credits >= 0 && Number.isInteger(saved.economy.slots) && saved.economy.slots >= roster.length && saved.economy.slots <= 15) {
        economy = { credits: saved.economy.credits, slots: saved.economy.slots, reserve: {} };
        for (const t of Object.keys(unitTypes)) {
          const n = saved.economy.reserve?.[t];
          if (Number.isSafeInteger(n) && n > 0) economy.reserve[t] = n;
        }
      } else economy.slots = Math.max(8, roster.length);
      selectedId = saved.selectedId;
      rosterSerial = Number.isSafeInteger(saved.rosterSerial) ? saved.rosterSerial : 100;
    }
  } catch {
  }
  if (!roster.length) {
    roster.push(newUnit2("tank"));
    selectedId = roster[0].id;
  }
  function unitStats(u = selectedUnit()) {
    const b2 = unitTypes[u.type], scale = 1 + 0.4 * (u.tier - 1);
    return { ...b2, hp: Math.round(b2.hp * scale), damage: b2.damage * scale, speed: b2.speed * (1 + 0.08 * (u.tier - 1)) };
  }
  function activateUnit(id, skipSave = false) {
    if (mode === "running" || mode === "won" || compiling) return;
    if (!skipSave) saveProgram();
    selectedId = id;
    const u = selectedUnit();
    commands = new Set((u.instruction ? u.commands : unlocked(u)).filter((c) => unlocked(u).includes(c)));
    $("prompt").value = u.instruction || "Keep moving, fire in range, and hold " + unitStats(u).range + " range.";
    compiledPlan = null;
    compiledText = "";
    saveRoster();
    commandRender();
    resetPositions();
    preview();
    renderRoster();
    $("modelStatus").textContent = "Unit changed \xB7 Compile again to use local AI";
  }
  function renderRoster() {
    const root = $("rosterGrid");
    root.replaceChildren();
    $("activeUnitLabel").textContent = unitTypes[selectedUnit().type].name + " " + "\u2605".repeat(selectedUnit().tier) + " \xB7 Team " + roster.length + "/" + economy.slots + " \xB7 " + economy.credits + " credits";
    for (const type of Object.keys(unitTypes)) {
      for (let tier = 1; tier <= 3; tier++) {
        const group = roster.filter((u) => u.type === type && u.tier === tier);
        if (!group.length) continue;
        const card = document.createElement("div");
        card.className = "unit-card" + (group.some((u) => u.id === selectedId) ? " active" : "");
        const title = document.createElement("h3");
        title.textContent = unitTypes[type].name;
        const stars = document.createElement("div");
        stars.className = "stars";
        stars.textContent = "\u2605".repeat(tier) + " \xB7 " + group.length + " owned";
        const desc = document.createElement("p");
        const s = unitStats(group[0]);
        desc.textContent = unitTypes[type].role + " \xB7 " + s.hp + " HP \xB7 " + s.damage.toFixed(0) + " damage \xB7 " + s.speed.toFixed(0) + " speed";
        const caps = document.createElement("p");
        caps.textContent = "Order capacity: " + (group[0].tier === 1 ? 3 : group[0].tier === 2 ? 5 : 7) + " \xB7 \u2605\u2605 cover/dodge \xB7 \u2605\u2605\u2605 retreat/precision";
        const select = document.createElement("button");
        select.className = "tiny";
        select.textContent = group.some((u) => u.id === selectedId) ? "Selected" : "Select unit";
        select.disabled = mode === "running" || mode === "won" || compiling;
        select.onclick = () => activateUnit(group[0].id);
        const combine = document.createElement("button");
        combine.className = "tiny";
        combine.textContent = tier === 3 ? "Maximum tier" : "Combine 3 \u2192 " + "\u2605".repeat(tier + 1);
        combine.disabled = group.length < 3 || tier === 3 || mode === "running" || mode === "won" || compiling;
        combine.onclick = () => combineUnits(type, tier);
        card.append(title, stars, desc, caps, select, combine);
        root.append(card);
      }
    }
  }
  function combineUnits(type, tier) {
    if (mode === "running" || mode === "won" || compiling || tier >= 3) return;
    saveProgram();
    const group = roster.filter((u) => u.type === type && u.tier === tier);
    if (group.length < 3) return;
    const active = group.find((u) => u.id === selectedId), consumed = active ? [active, ...group.filter((u) => u !== active).slice(0, 2)] : group.slice(0, 3), base = active || consumed[0], up = newUnit2(type, tier + 1);
    up.instruction = base.instruction;
    up.equipment = { ...base.equipment || {} };
    up.deployed = base.deployed;
    up.wins = base.wins || 0;
    up.compiled = base.compiled;
    up.compiledText = base.compiledText;
    up.commands = [.../* @__PURE__ */ new Set([...base.commands, ...unlocked(up)])];
    roster = roster.filter((u) => !consumed.some((c) => c.id === u.id));
    roster.push(up);
    const selectUpgrade = !!active;
    saveRoster();
    if (selectUpgrade) activateUnit(up.id, true);
    else renderRoster();
    $("rosterMessage").textContent = unitTypes[type].name + " upgraded to " + "\u2605".repeat(tier + 1) + ". More health, damage, speed and commands unlocked.";
    saveRoster();
  }
  commandInfo.splice(0, commandInfo.length, ["radar", "Scan", "Detect enemies."], ["gun", "Fire", "Use this unit\u2019s weapon."], ["drive", "Move", "Move under the plan."], ["cover", "Cover", "Unlocks at \u2605\u2605: shelter when hurt."], ["duck", "Dodge", "Unlocks at \u2605\u2605: evade incoming fire."], ["perch", "Precision aim", "Unlocks at \u2605\u2605\u2605: tighter aim."], ["retreat", "Retreat", "Unlocks at \u2605\u2605\u2605: fall back at low health."]);
  const originalCommands = commandRender;
  commandRender = function() {
    originalCommands();
    const available = unlocked(selectedUnit());
    for (let i = 0; i < commandInfo.length; i++) {
      const b2 = $("commands").children[i];
      if (!b2) continue;
      const locked = !available.includes(commandInfo[i][0]);
      b2.disabled = locked;
      b2.classList.toggle("locked", locked);
      if (locked) b2.textContent += " \u{1F512}";
      const click = b2.onclick;
      b2.onclick = () => {
        click();
        saveProgram();
      };
    }
  };
  const originalParse = parsePlan;
  parsePlan = function() {
    const p = originalParse();
    if (!compiledPlan || compiledText !== $("prompt").value) {
      const s = $("prompt").value.toLowerCase(), explicit = s.match(/(\d{2,3})\s*(?:range|meters|metres)/);
      if (explicit) p.preferred = clamp(Number(explicit[1]), 100, 450);
      else if (p.style === "balanced") p.preferred = unitStats().range;
    }
    p.evade = p.evade && commands.has("duck");
    p.retreat = p.retreat && commands.has("retreat");
    return p;
  };
  makeTank = function(team, x, y) {
    const isP = team === "player", u = isP ? selectedUnit() : { type: Object.keys(unitTypes)[(round - 1) % 6], tier: Math.min(3, 1 + Math.floor((round - 1) / 5)) }, s = unitStats(u), max = isP ? s.hp : Math.round(s.hp * (0.85 + round * 0.04));
    return { team, x, y, type: u.type, tier: u.tier, stats: s, angle: isP ? 0 : Math.PI, hp: max, maxHp: max, r: s.r, cooldown: 1.2, hitFlash: 0, coverTime: 0, phase: 0, ammo: s.mag, reloading: 0 };
  };
  const originalMove = moveTank;
  moveTank = function(t, dx, dy, speed, dt) {
    if (t.stats.flying) {
      const [nx, ny] = norm(dx, dy);
      t.x = clamp(t.x + nx * speed * dt, t.r, W - t.r);
      t.y = clamp(t.y + ny * speed * dt, t.r, H - t.r);
    } else originalMove(t, dx, dy, speed, dt);
  };
  fire = function(t, target) {
    const isP = t.team === "player", s = t.stats, speed = t.type === "rocket" ? 330 : t.type === "artillery" ? 290 : 550, damage = s.damage * (isP && activeBuff?.kind === "damage" ? 1.2 : 1), spread = s.spread * (isP && commands.has("perch") ? 0.5 : 1), a2 = t.angle + (random() - 0.5) * spread;
    t.ammo--;
    if (t.ammo === 0) t.reloading = 2.4;
    shots.push({ team: t.team, x: t.x + Math.cos(a2) * (t.r + 7), y: t.y + Math.sin(a2) * (t.r + 7), vx: Math.cos(a2) * speed, vy: Math.sin(a2) * speed, damage, life: 2.4, indirect: s.indirect || s.flying });
    t.cooldown = s.reload * (isP && plan.style === "rush" ? 0.85 : 1);
    sparks.push({ x: t.x, y: t.y, life: 0.15, color: isP ? "#d7fb75" : "#f39c6c" });
  };
  renderStats = function() {
    const root = $("statList");
    root.replaceChildren();
    const s = unitStats(), u = selectedUnit();
    for (const [name, value] of [["Unit", s.name + " " + "\u2605".repeat(u.tier)], ["Health", s.hp + " HP"], ["Damage", (s.damage * (activeBuff?.kind === "damage" ? 1.2 : 1)).toFixed(1)], ["Speed", (s.speed * (activeBuff?.kind === "speed" ? 1.15 : 1)).toFixed(0)], ["Magazine", (player?.ammo ?? s.mag) + " / " + s.mag], ["Shot interval", (s.reload * (plan?.style === "rush" ? 0.85 : 1)).toFixed(2) + " sec"], ["Reload", "2.4 sec"], ["Preferred range", (plan?.preferred ?? s.range) + " units"], ["Movement", s.flying ? "Flying over cover" : "Ground"], ["Fire", s.indirect ? "Arcing shells" : s.flying ? "Air cannon" : "Direct fire"], ["Command access", unlocked(u).length + " / 7"], ["Round buff", activeBuff?.buff || nextBuff?.buff || "None"]]) {
      const cell = document.createElement("div"), label = document.createElement("small"), number = document.createElement("b");
      cell.className = "stat-cell";
      label.textContent = name;
      number.textContent = value;
      cell.append(label, number);
      root.append(cell);
    }
  };
  const originalDraw = tankDraw;
  tankDraw = function(t) {
    if (t.type === "tank" || t.type === "artillery") {
      originalDraw(t);
      return;
    }
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.fillStyle = t.hitFlash > 0 ? "#fff8dc" : t.team === "player" ? "#d7fb75" : "#f3a174";
    if (t.type === "helicopter") {
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-32, -3, 28, 6);
      ctx.strokeStyle = "#c4dcc0";
      ctx.lineWidth = 3;
      ctx.rotate(t.phase * 20);
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(34, 0);
      ctx.moveTo(0, -34);
      ctx.lineTo(0, 34);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(5, -3, t.type === "sniper" ? 27 : t.type === "rocket" ? 23 : 17, t.type === "rocket" ? 9 : 5);
    }
    ctx.restore();
    ctx.font = "700 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = t.team === "player" ? "#d7fb75" : "#f3a174";
    ctx.fillText((t.team === "player" ? "YOU \xB7 " : "AI \xB7 ") + unitTypes[t.type].name + " " + "\u2605".repeat(t.tier), t.x, t.y - 38);
  };
  function slotCost() {
    return 100 + Math.max(0, economy.slots - 1) * 50;
  }
  function renderStore() {
    const cost = slotCost();
    $("storeBalance").textContent = economy.credits + " credits \xB7 Team " + roster.length + "/" + economy.slots + " slots";
    $("slotDescription").textContent = economy.slots >= 15 ? "All 15 slots unlocked." : "Unlock slot " + (economy.slots + 1) + " for " + cost + " credits. Each additional slot costs 50 more.";
    $("buySlot").textContent = economy.slots >= 15 ? "Maximum slots reached" : "Buy slot \xB7 " + cost + " credits";
    $("buySlot").disabled = economy.slots >= 15 || economy.credits < cost || mode === "running" || compiling;
    const root = $("reserveUnits");
    root.replaceChildren();
    for (const type of Object.keys(unitTypes)) {
      const count = economy.reserve[type] || 0;
      if (!count) continue;
      const b2 = document.createElement("button");
      b2.className = "reward";
      b2.textContent = unitTypes[type].name + " \u2605 \xB7 " + count + " waiting \xB7 Add to team";
      b2.disabled = roster.length >= economy.slots || mode === "running" || compiling;
      b2.onclick = () => claimReserve(type);
      root.append(b2);
    }
    if (!root.children.length) {
      const p = document.createElement("p");
      p.textContent = "No recruits waiting.";
      root.append(p);
    }
  }
  function buySlot() {
    if (economy.slots >= 15 || economy.credits < slotCost() || mode === "running" || compiling) return;
    economy.credits -= slotCost();
    economy.slots++;
    saveRoster();
    renderStore();
    renderRoster();
    if (levelReward) renderLevelRewards();
    $("storeMessage").textContent = "Team slot " + economy.slots + " unlocked.";
  }
  function claimReserve(type) {
    if (!unitTypes[type] || !(economy.reserve[type] > 0) || roster.length >= economy.slots || mode === "running" || compiling) return;
    economy.reserve[type]--;
    roster.push(newUnit2(type));
    saveRoster();
    renderStore();
    renderRoster();
    if (levelReward) renderLevelRewards();
    $("storeMessage").textContent = unitTypes[type].name + " added to your team.";
  }
  function rewardButton(title, detail, action) {
    const b2 = document.createElement("button"), strong = document.createElement("strong"), span = document.createElement("span");
    b2.type = "button";
    b2.className = "reward";
    strong.textContent = title;
    span.textContent = detail;
    b2.append(strong, span);
    b2.onclick = action;
    return b2;
  }
  function renderLevelRewards() {
    if (!levelReward) return;
    const root = $("rewards");
    root.replaceChildren();
    $("rewardTitle").textContent = "Level " + round + " rewards";
    const h = document.createElement("h3");
    h.textContent = levelReward.unit ? "\u2713 Recruit claimed" : "1 / Choose one of three recruits";
    root.append(h);
    if (levelReward.unit) {
      const p = document.createElement("p");
      p.textContent = levelReward.unit;
      root.append(p);
    } else {
      for (const type of levelReward.offerTypes) root.append(rewardButton("Recruit " + unitTypes[type].name + " \u2605", roster.length < economy.slots ? "Add to squad \xB7 combine three matching copies" : "Team full \xB7 recruit waits in reserve", () => chooseReward({ unitType: type, action: "add" })));
    }
    const th = document.createElement("h3");
    th.textContent = levelReward.tactic ? "\u2713 Squad instruction claimed" : "2 / Choose a next-round combat doctrine";
    root.append(th);
    if (levelReward.tactic) {
      const p = document.createElement("p");
      p.textContent = levelReward.tactic.instruction + " " + levelReward.tactic.effect;
      root.append(p);
    } else for (const option of levelReward.tacticOptions) root.append(rewardButton(option.instruction, option.buff + " \xB7 " + option.effect, () => chooseReward(option)));
    const store = document.createElement("button");
    store.className = "tiny";
    store.textContent = "Open store \xB7 " + economy.credits + " credits";
    store.onclick = () => {
      renderStore();
      $("storeDialog").showModal();
    };
    root.append(store);
    $("claimLevel").disabled = !(levelReward.unit && levelReward.tactic);
  }
  chooseReward = function(option) {
    if (mode !== "won" || !levelReward) return;
    if (option.unitType) {
      if (levelReward.unit || option.action !== "add" || !levelReward.offerTypes.includes(option.unitType)) return;
      saveProgram();
      if (option.action === "upgrade") {
        const u = roster.find((u2) => u2.id === option.unitId && u2.type === option.unitType && u2.tier < 3);
        if (!u) return;
        u.tier++;
        u.commands = [.../* @__PURE__ */ new Set([...u.commands, ...unlocked(u)])];
        if (u.id === selectedId) commands = new Set(u.commands);
        compiledPlan = null;
        compiledText = "";
        commandRender();
        preview();
        levelReward.unit = unitTypes[u.type].name + " promoted to " + "\u2605".repeat(u.tier);
      } else if (option.action === "add") {
        if (roster.length < economy.slots) {
          roster.push(newUnit2(option.unitType));
          levelReward.unit = unitTypes[option.unitType].name + " \u2605 added to team";
        } else {
          economy.reserve[option.unitType] = (economy.reserve[option.unitType] || 0) + 1;
          levelReward.unit = unitTypes[option.unitType].name + " \u2605 waiting in reserve";
        }
      } else return;
      saveRoster();
      renderRoster();
    } else {
      if (levelReward.tactic || !levelReward.tacticOptions.includes(option)) return;
      levelReward.tactic = option;
      nextBuff = option;
      const prior = $("prompt").value.trim();
      $("prompt").value = prior + (prior ? "\n" : "") + "# Next-round tactic: " + option.instruction;
      compiledPlan = null;
      compiledText = "";
      saveProgram();
      preview();
      updateBuffStatus();
    }
    renderLevelRewards();
  };
  function completeLevelRewards() {
    if (mode !== "won" || !levelReward?.unit || !levelReward?.tactic) return;
    levelReward = null;
    round++;
    mode = "ready";
    $("rewardDialog").close();
    $("roundLabel").textContent = "Round " + round;
    $("arenaState").textContent = "Ready for next level";
    $("deploy").disabled = false;
    $("reset").disabled = false;
    $("deploy").textContent = "Deploy level " + round + " \u2192";
    $("message").textContent = "Both rewards claimed. Visit the store, adjust your program, or deploy.";
    resetPositions();
    preview();
    updateBuffStatus();
    renderRoster();
  }
  const originalFinish = finish;
  finish = function(win) {
    if (mode !== "running") return;
    originalFinish(win);
    if (win) {
      const earnings = 50 + round * 10;
      economy.credits += earnings;
      const pool = availableTypes();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const boons = [...rewardOptions];
      for (let i = boons.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [boons[i], boons[j]] = [boons[j], boons[i]];
      }
      levelReward = { unit: null, tactic: null, offerTypes: pool.slice(0, 3), tacticOptions: boons.slice(0, 3) };
      $("reset").disabled = true;
      saveRoster();
      renderRoster();
      renderLevelRewards();
      message("Victory! +" + earnings + " credits. Choose one reward from each pool.");
    }
  };
  $("claimLevel").onclick = completeLevelRewards;
  $("storeButton").onclick = () => {
    renderStore();
    $("storeDialog").showModal();
  };
  $("closeStore").onclick = () => $("storeDialog").close();
  $("buySlot").onclick = buySlot;
  const originalDeploy = deploy;
  deploy = function() {
    saveProgram();
    originalDeploy();
    renderRoster();
  };
  $("squadButton").onclick = () => {
    renderRoster();
    $("rosterDialog").showModal();
  };
  $("closeRoster").onclick = () => $("rosterDialog").close();
  $("prompt").addEventListener("input", saveProgram);
  let campaign = { lives: 3, map: "urban", view: "3d", gear: [], cosmeticCoins: 0, skins: ["olive"], skin: "olive" }, battleUnits = [], replayRecord = null, replaying = false, replayInputs = null, damageEvents = [], replaySaved = null, pickups = [];
  try {
    const c = JSON.parse(localStorage.getItem("tank-campaign-v1"));
    if (c && Number.isInteger(c.lives) && c.lives >= 0 && c.lives <= 3 && Array.isArray(c.gear)) {
      campaign = { ...campaign, ...c };
      campaign.gear = c.gear.filter((x) => typeof x === "string");
      campaign.skin = ["olive", "arctic", "sunset", "neon"].includes(c.skin) ? c.skin : "olive";
      campaign.cosmeticCoins = Math.max(0, Number(c.cosmeticCoins) || 0);
    }
  } catch {
  }
  const saveCollection = saveRoster;
  saveRoster = function() {
    if (replaying) return;
    saveCollection();
    try {
      localStorage.setItem("tank-campaign-v1", JSON.stringify(campaign));
    } catch {
    }
  };
  const maps = { urban: [{ x: 320, y: 105, w: 82, h: 132 }, { x: 520, y: 320, w: 90, h: 125 }, { x: 425, y: 242, w: 70, h: 76 }], canyon: [{ x: 280, y: 40, w: 75, h: 180 }, { x: 550, y: 340, w: 75, h: 180 }, { x: 440, y: 170, w: 60, h: 190 }], volcanic: [{ x: 320, y: 90, w: 65, h: 125 }, { x: 550, y: 360, w: 65, h: 125 }], coast: [{ x: 355, y: 75, w: 95, h: 165 }, { x: 650, y: 70, w: 70, h: 90 }] };
  let buildings = [], worldRevision = 0;
  function applyMap() {
    if (!maps[campaign.map]) campaign.map = "urban";
    campaign.view = "3d";
    let m = 7907 + round * 1039 + ["urban", "canyon", "volcanic", "coast"].indexOf(campaign.map) * 173;
    const rnd = () => {
      m = m * 1664525 + 1013904223 >>> 0;
      return m / 4294967296;
    };
    buildings = [];
    const add = (x, y, w, h, kind, height) => {
      if (Math.abs(y + h / 2 - H * 0.45) < 145 || x < 140 || x + w > W - 140 || campaign.map === "coast" && y + h > H * 0.54) return;
      const hp = kind === "mesa" ? 260 : 100 + Math.floor(rnd() * 100);
      buildings.push({ id: "building-" + buildings.length, x, y, w, h, kind, height, hp, maxHp: hp, style: Math.floor(rnd() * 4), destroyed: false });
    };
    if (campaign.map === "urban") {
      for (let row = 0; row < 7; row++) for (let col = 0; col < 12; col++) add(240 + col * 205 + rnd() * 35, 75 + row * 235 + rnd() * 30, 65 + rnd() * 75, 65 + rnd() * 70, ["apartment", "warehouse", "church", "silo", "bunker"][Math.floor(rnd() * 5)], 40 + rnd() * 110);
    } else if (campaign.map === "canyon") {
      for (let i = 0; i < 62; i++) {
        const x = 190 + rnd() * (W - 420), y = rnd() * H;
        add(x, y, 45 + rnd() * 100, 45 + rnd() * 85, i % 5 ? "mesa" : "bunker", i % 5 ? 65 + rnd() * 130 : 32);
      }
    } else if (campaign.map === "volcanic") {
      for (let i = 0; i < 66; i++) {
        const angle = i * 2.4, r = 220 + rnd() * 750, x = W * 0.5 + Math.cos(angle) * r, y = H * 0.25 + Math.sin(angle) * r;
        if (y < 30 || y > H - 150) continue;
        add(x, y, 55 + rnd() * 65, 55 + rnd() * 65, ["mesa", "dome", "silo", "bunker"][i % 4], i % 4 === 0 ? 90 : 45 + rnd() * 40);
      }
    } else {
      for (let i = 0; i < 60; i++) {
        const row = Math.floor(i / 15), col = i % 15;
        add(170 + col * 175 + rnd() * 30, 35 + row * 180 + rnd() * 25, 60 + rnd() * 75, 55 + rnd() * 60, ["warehouse", "lighthouse", "crane", "bunker"][i % 4], 40 + rnd() * 70);
      }
    }
    rocks.splice(0, rocks.length, ...buildings);
    for (const b2 of campaign.base || []) if (b2.kind === "wall" && !onlinePlaying) rocks.push({ x: b2.x - 18 - (b2.tier - 1) * 4, y: b2.y - 40, w: 36 + (b2.tier - 1) * 8, h: 80 });
    worldRevision++;
    $("mapSelect").value = campaign.map;
    $("viewSelect").value = "3d";
  }
  function damageBuilding(b2, shot) {
    if (!b2 || b2.destroyed || !Number.isFinite(b2.hp)) return;
    b2.hp = Math.max(0, b2.hp - shot.damage * (shot.radius ? 1.7 : 1));
    sparks.push({ x: b2.x + b2.w / 2, y: b2.y + b2.h / 2, life: 0.5, color: "#ffb05e" });
    if (b2.hp === 0) {
      b2.destroyed = true;
      b2.destroyedAt = elapsed;
      const at = rocks.indexOf(b2);
      if (at >= 0) rocks.splice(at, 1);
      worldRevision++;
      if (pickups.filter((p) => !p.used).length < 10 && random() < 0.3) pickups.push({ x: b2.x + b2.w / 2, y: b2.y + b2.h / 2, kind: ["health", "ammo", "overdrive", "shield"][Math.floor(random() * 4)], used: false });
      if (shot.radius) {
        for (const other of buildings) if (other !== b2 && !other.destroyed && Math.hypot(other.x - b2.x, other.y - b2.y) < shot.radius + 45) other.hp = Math.max(1, other.hp - shot.damage * 0.4);
      }
    }
  }
  function collectPickup(t, p) {
    p.used = true;
    const kind = p.kind || "ammo";
    if (kind === "health") t.hp = Math.min(t.maxHp, t.hp + 50);
    if (kind === "ammo") {
      t.reserve = Math.min(250, t.reserve + 40);
      t.ammo = t.stats.mag;
      t.reloading = 0;
    }
    if (kind === "overdrive") t.powerTime = 10;
    if (kind === "shield") t.shield = Math.max(t.shield, 40);
    sparks.push({ x: t.x, y: t.y, life: 0.6, color: kind === "health" ? "#69f6a6" : "#72caff" });
  }
  const gearItems = [];
  const weaponNames = ["Autocannon", "Railgun", "Scattergun", "Mortar", "Guided rockets", "Burst rifle", "Laser", "Heavy cannon", "Marksman rifle", "Naval gun"];
  const armorNames = ["Steel plate", "Composite shell", "Reactive armor", "Light vest", "Flight plating", "Ceramic plate", "Shield generator", "Ablative armor", "Naval bulkhead", "Scout vest"];
  const utilityNames = ["Wide radar", "Target computer", "Turbo engine", "Reload servo", "Stealth mesh", "ECM emitter", "Repair kit", "Energy cell", "Range finder", "Dodge thruster"];
  for (let i = 0; i < 10; i++) {
    gearItems.push({ id: "weapon-" + i, name: weaponNames[i], slot: "weapon", price: 60 + i * 18, mods: { damage: 1.08 + i * 0.025, shotInterval: 1.05 + i % 3 * 0.1, penetration: i % 4 * 0.08, critChance: 0.02 + i % 3 * 0.02 } });
    gearItems.push({ id: "armor-" + i, name: armorNames[i], slot: "armor", price: 55 + i * 15, mods: { health: 1.12 + i % 4 * 0.04, speed: 0.96 - i % 3 * 0.02, armor: 0.08 + i % 5 * 0.025 } });
    gearItems.push({ id: "utility-" + i, name: utilityNames[i], slot: "utility", price: 50 + i * 14, mods: i === 0 ? { radar: 1.25 } : i === 1 ? { accuracy: 1.4 } : i === 2 ? { speed: 1.15 } : i === 3 ? { loading: 1.3 } : i === 4 ? { stealth: 1.4 } : i === 5 ? { ecm: 1.6 } : i === 6 ? { repair: 1.6 } : i === 7 ? { energy: 1.4 } : i === 8 ? { range: 1.15 } : { dodge: 1.5 } });
  }
  function unitGear(u) {
    return Object.values(u.equipment || {}).map((id) => gearItems.find((i) => i.id === id)).filter(Boolean);
  }
  const baseUnitStats = unitStats;
  unitStats = function(u = selectedUnit()) {
    const s = baseUnitStats(u), mods = {};
    for (const g of unitGear(u)) for (const [k, v] of Object.entries(g.mods)) mods[k] = (mods[k] ?? (["armor", "penetration", "critChance"].includes(k) ? 0 : 1)) * (["armor", "penetration", "critChance"].includes(k) ? 1 : v) + (["armor", "penetration", "critChance"].includes(k) ? v : 0);
    return { ...s, hp: Math.round(s.hp * (mods.health || 1)), damage: s.damage * (mods.damage || 1), speed: s.speed * (mods.speed || 1), reload: s.reload * (mods.shotInterval || 1), range: Math.min(500, s.range * (mods.range || 1)), armor: mods.armor || 0.04, penetration: mods.penetration || 0.02, critChance: 0.05 + (mods.critChance || 0), critMultiplier: 1.6, projectileSpeed: u.type === "rocket" ? 330 : u.type === "artillery" ? 290 : 550, explosionRadius: ["rocket", "artillery"].includes(u.type) ? u.type === "artillery" ? 72 : 48 : 0, accuracy: 1 / s.spread * (mods.accuracy || 1), splashFalloff: 0.65, loadingSpeed: 1.1 * (mods.loading || 1), magazineCapacity: s.mag, reloadDelay: 0.25, ammoReserve: 120, heatCapacity: 100, heatPerShot: 12, coolingRate: 20, maxHealth: Math.round(s.hp * (mods.health || 1)), shieldCapacity: u.equipment?.armor === "armor-6" ? 45 : 0, shieldRecharge: 3, damageResistance: 0.03, repairRate: 0.2 * (mods.repair || 1), impactResistance: 0.2, acceleration: 180, braking: 220, turnRate: 2.8, turretTurnRate: 2.8, reverseSpeed: s.speed * 0.65, terrainTraction: 0.9, radarRange: 580 * (mods.radar || 1), scanInterval: 0.25, targetLockTime: 0.15, visionCone: Math.PI * 2, stealthSignature: 1 / (mods.stealth || 1), ecmStrength: 0.08 * (mods.ecm || 1), energyCapacity: 100 * (mods.energy || 1), energyRegeneration: 8, abilityCooldownReduction: 0.1, pickupRadius: 40, dodgeChance: 0.1 * (mods.dodge || 1) };
  };
  function buyGear(id) {
    if (mode === "running" || compiling) return;
    const item = gearItems.find((g) => g.id === id);
    if (!item || campaign.gear.includes(id) || economy.credits < item.price) return;
    economy.credits -= item.price;
    campaign.gear.push(id);
    saveRoster();
    renderLoadout();
    renderRoster();
  }
  function equipGear(id, slot) {
    if (mode === "running" || mode === "won" || compiling) return;
    const item = gearItems.find((g) => g.id === id);
    if (!item || !campaign.gear.includes(id) || item.slot !== slot) return;
    const u = selectedUnit();
    u.equipment = { ...u.equipment || {}, [slot]: id };
    saveRoster();
    resetPositions();
    preview();
    renderLoadout();
    $("loadoutMessage").textContent = item.name + " equipped to " + unitTypes[u.type].name;
  }
  function retireUnit() {
    if (mode === "running" || mode === "won" || compiling || roster.length <= 1) return;
    const u = selectedUnit(), earned = Math.min(5, Math.max(0, u.wins || 0));
    if (!confirm("Retire " + unitTypes[u.type].name + " permanently for " + earned + " cosmetic tokens?")) return;
    roster = roster.filter((x) => x.id !== u.id);
    campaign.cosmeticCoins += earned;
    selectedId = roster[0].id;
    activateUnit(selectedId, true);
    saveRoster();
    renderLoadout();
    $("loadoutMessage").textContent = "Retired unit. Earned " + earned + " cosmetic tokens (maximum 5 wins counted).";
  }
  function renderLoadout() {
    const u = selectedUnit(), slots = $("equipmentSlots");
    slots.replaceChildren();
    for (const slot of ["weapon", "armor", "utility"]) {
      const card = document.createElement("div");
      card.className = "unit-card";
      const equipped = gearItems.find((g) => g.id === u.equipment?.[slot]);
      card.textContent = slot.toUpperCase() + ": " + (equipped?.name || "Standard");
      card.ondragover = (e) => e.preventDefault();
      card.ondrop = (e) => {
        e.preventDefault();
        equipGear(e.dataTransfer.getData("text/plain"), slot);
      };
      if (equipped) {
        const clear = document.createElement("button");
        clear.className = "tiny";
        clear.textContent = "Unequip";
        clear.onclick = () => {
          if (mode === "running" || mode === "won") return;
          delete u.equipment[slot];
          saveRoster();
          resetPositions();
          preview();
          renderLoadout();
        };
        card.append(clear);
      }
      slots.append(card);
    }
    const root = $("gearCatalog");
    root.replaceChildren();
    for (const g of gearItems) {
      const owned = campaign.gear.includes(g.id), card = document.createElement("div");
      card.className = "unit-card";
      card.draggable = owned;
      card.ondragstart = (e) => e.dataTransfer.setData("text/plain", g.id);
      const title = document.createElement("h3");
      title.textContent = g.name;
      const detail = document.createElement("p");
      detail.textContent = g.slot + " \xB7 " + Object.entries(g.mods).map(([k, v]) => k + " " + (["armor", "penetration", "critChance"].includes(k) ? Math.round(v * 100) + "%" : v.toFixed(2) + "\xD7")).join(" \xB7 ");
      const b2 = document.createElement("button");
      b2.className = "tiny";
      b2.textContent = owned ? "Equip" : "Buy \xB7 " + g.price + " credits";
      b2.disabled = mode === "running" || mode === "won" || compiling || !owned && economy.credits < g.price;
      b2.onclick = () => owned ? equipGear(g.id, g.slot) : buyGear(g.id);
      card.append(title, detail, b2);
      root.append(card);
    }
    const cosmetic = $("cosmeticsPanel");
    cosmetic.replaceChildren();
    const info = document.createElement("p");
    info.textContent = campaign.cosmeticCoins + " cosmetic tokens \xB7 Active unit credited wins: " + Math.min(5, u.wins || 0);
    cosmetic.append(info);
    for (const skin of ["olive", "arctic", "sunset", "neon"]) {
      const owned = campaign.skins.includes(skin), b2 = document.createElement("button");
      b2.className = "tiny";
      b2.textContent = (campaign.skin === skin ? "\u2713 " : "") + skin + (owned ? "" : " \xB7 3 tokens");
      b2.disabled = mode === "running" || !owned && campaign.cosmeticCoins < 3;
      b2.onclick = () => {
        if (mode === "running") return;
        if (!owned) {
          campaign.cosmeticCoins -= 3;
          campaign.skins.push(skin);
        }
        campaign.skin = skin;
        saveRoster();
        renderLoadout();
      };
      cosmetic.append(b2);
    }
    const retire = document.createElement("button");
    retire.className = "tiny";
    retire.textContent = "Retire selected unit \xB7 " + Math.min(5, u.wins || 0) + " tokens";
    retire.disabled = roster.length <= 1 || mode === "running" || mode === "won";
    retire.onclick = retireUnit;
    cosmetic.append(retire);
  }
  function safeImportedUnits(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.units) || !data.units.length || data.units.length > 15) throw Error("Use a version 1 unit collection with 1\u201315 units.");
    return data.units.map((u) => {
      if (!unitTypes[u.type] || !Number.isInteger(u.tier) || u.tier < 1 || u.tier > 3 || typeof u.instruction !== "string" || u.instruction.length > 2e3 || !Array.isArray(u.commands)) throw Error("Invalid unit type, tier or instruction.");
      const fresh = newUnit2(u.type, u.tier);
      fresh.instruction = u.instruction;
      fresh.commands = u.commands.filter((c) => unlocked(fresh).includes(c));
      fresh.equipment = {};
      for (const slot of ["weapon", "armor", "utility"]) {
        const id = u.equipment?.[slot];
        if (id && gearItems.some((g) => g.id === id && g.slot === slot)) fresh.equipment[slot] = id;
      }
      return fresh;
    });
  }
  $("exportUnits").onclick = () => {
    $("transferData").value = JSON.stringify({ version: 1, units: roster.map((u) => ({ type: u.type, tier: u.tier, instruction: u.instruction, commands: u.commands, equipment: u.equipment || {} })) }, null, 2);
    $("transferMessage").textContent = "Copy this collection to transfer it.";
  };
  $("importUnits").onclick = () => {
    if (mode === "running" || mode === "won" || compiling) return;
    try {
      const input = JSON.parse($("transferData").value);
      if (!Array.isArray(input.units) || input.units.length + roster.length > economy.slots) throw Error("Not enough team slots. Buy slots or combine units first.");
      const incoming = safeImportedUnits(input);
      for (const u of incoming) for (const id of Object.values(u.equipment)) if (!campaign.gear.includes(id)) campaign.gear.push(id);
      roster.push(...incoming);
      saveRoster();
      renderRoster();
      $("transferMessage").textContent = incoming.length + " units imported without replacing your team.";
    } catch (e) {
      $("transferMessage").textContent = e.message;
    }
  };
  function planForUnit(u) {
    if (u.id === selectedId) {
      saveProgram();
      const p2 = parsePlan();
      u.compiled = compiledPlan && compiledText === u.instruction ? compiledPlan : null;
      u.compiledText = compiledText;
      return p2;
    }
    const text = u.instruction || "Hold " + unitStats(u).range + " range", s = text.toLowerCase(), cmd = new Set(u.instruction ? u.commands : unlocked(u)), style = /snip|keep distance/.test(s) ? "sniper" : /rush|aggress|charge/.test(s) ? "rush" : "balanced", explicit = s.match(/(\d{2,3})\s*(?:range|meters)/), p = u.compiled && u.compiledText === text ? { ...u.compiled } : { style, preferred: explicit ? clamp(+explicit[1], 100, 500) : style === "rush" ? 145 : unitStats(u).range, cover: /cover|shelter/.test(s), coverBelow: 0.5, evade: /evade|zigzag|dodge/.test(s), retreat: /retreat|fall back/.test(s), retreatBelow: 0.25, firePolicy: /stationary|stand still/.test(s) ? "stationary" : "always" };
    p.cover = p.cover && cmd.has("cover");
    p.evade = p.evade && cmd.has("duck");
    p.retreat = p.retreat && cmd.has("retreat");
    return p;
  }
  function spawnCombat(u, team, index, count) {
    const s = unitStats(u), sea = s.water;
    const x = team === "player" ? 80 + Math.floor(index / 6) * 55 : W - 80 - Math.floor(index / 6) * 55, y = sea ? H * 0.76 + index % 3 * 65 : H * 0.45 + (index % 6 - (Math.min(count, 6) - 1) / 2) * 58;
    return { team, id: u.id, type: u.type, tier: u.tier, stats: s, x, y, velocity: 0, heading: team === "player" ? 0 : Math.PI, reserve: s.ammoReserve, shieldDelay: 0, dodgeCooldown: 0, boostTime: 0, angle: team === "player" ? 0 : Math.PI, hp: s.hp, maxHp: s.hp, r: s.r, cooldown: 0.5 + index * 0.07, hitFlash: 0, phase: 0, ammo: s.mag, reloading: 0, heat: 0, shield: s.shieldCapacity, energy: s.energyCapacity, commands: team === "player" ? [...u.instruction ? u.commands : unlocked(u)] : unlocked(u), plan: team === "player" ? planForUnit(u) : { style: "balanced", preferred: s.range, cover: true, coverBelow: 0.4, evade: u.tier >= 2, retreat: u.tier >= 3, retreatBelow: 0.2, firePolicy: "always" }, lock: 0, scan: 0, target: null };
  }
  resetPositions = function() {
    applyMap();
    const squad = roster.filter((u) => u.deployed !== false && (!unitTypes[u.type].water || campaign.map === "coast")).slice(0, 15);
    const team = squad.length ? squad : [selectedUnit()];
    battleUnits = team.map((u, i) => spawnCombat(u, "player", i, team.length));
    for (let i = 0; i < Math.min(15, 1 + Math.floor((round - 1) / 4)); i++) {
      const types2 = availableTypes(), type = round === 1 ? "tank" : types2[(i + round - 1) % types2.length];
      battleUnits.push(spawnCombat({ id: "enemy-" + i, type, tier: Math.min(3, 1 + Math.floor((round - 1) / 8)), equipment: {} }, "enemy", i, team.length));
    }
    player = battleUnits.find((u) => u.id === selectedId) || battleUnits[0];
    enemy = battleUnits.find((u) => u.team === "enemy");
    shots = [];
    sparks = [];
    elapsed = 0;
    seed = 12345 + round;
    accumulator = 0;
    damageEvents = [];
    pickups = Array.from({ length: 8 }, (_, i) => ({ x: W * (0.18 + i % 4 * 0.21), y: H * (i < 4 ? 0.43 : 0.49), kind: ["health", "ammo", "overdrive", "shield"][i % 4], used: false })).filter((p) => !collides(p.x, p.y, 20));
    for (const t of battleUnits) if (t.team === "player" && activeBuff?.kind === "shield") t.shield += 60;
    updateHud();
  };
  function canMove(t, x, y) {
    if (x < t.r || x > W - t.r || y < t.r || y > H - t.r) return false;
    if (t.stats.flying) return true;
    if (campaign.map === "coast" && (t.stats.water ? y < H * 0.6 : y > H * 0.56)) return false;
    return !collides(x, y, t.r);
  }
  function squadMove(t, mx, my, dt) {
    if (Math.hypot(mx, my) < 0.01) return;
    const [nx, ny] = norm(mx, my), wanted = Math.atan2(ny, nx), delta = Math.atan2(Math.sin(wanted - t.heading), Math.cos(wanted - t.heading));
    t.heading += clamp(delta, -t.stats.turnRate * dt, t.stats.turnRate * dt);
    t.reverse = Math.abs(delta) > 2.5;
    const step = t.velocity * dt * (t.reverse ? t.stats.reverseSpeed / t.stats.speed : 1) * (campaign.map === "canyon" ? t.stats.terrainTraction : 1);
    if (canMove(t, t.x + nx * step, t.y)) t.x += nx * step;
    if (canMove(t, t.x, t.y + ny * step)) t.y += ny * step;
    for (const other of battleUnits) {
      if (other === t || other.hp <= 0 || other.stats.flying !== t.stats.flying) continue;
      const d = Math.hypot(t.x - other.x, t.y - other.y), min = t.r + other.r + 2;
      if (d > 0 && d < min) {
        const [ux, uy] = norm(t.x - other.x, t.y - other.y), push = (min - d) * 0.4;
        if (canMove(t, t.x + ux * push, t.y + uy * push)) {
          t.x += ux * push;
          t.y += uy * push;
          if (other.team !== t.team) {
            t.hp = Math.max(0, t.hp - 3 * dt * (1 - t.stats.impactResistance));
            other.hp = Math.max(0, other.hp - 3 * dt * (1 - other.stats.impactResistance));
          }
        }
      }
    }
  }
  function chooseTarget(t) {
    const candidates = battleUnits.filter((u) => u.team !== t.team && u.hp > 0 && Math.hypot(u.x - t.x, u.y - t.y) < t.stats.radarRange * u.stats.stealthSignature && Math.abs(Math.atan2(Math.sin(Math.atan2(u.y - t.y, u.x - t.x) - t.angle), Math.cos(Math.atan2(u.y - t.y, u.x - t.x) - t.angle))) <= t.stats.visionCone / 2);
    return candidates.sort((a2, b2) => Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y))[0] || null;
  }
  function squadFire(t, target) {
    const s = t.stats, p = t.plan, spread = 1 / s.accuracy * (t.commands.includes("perch") ? 0.5 : 1), formation = t.type === "infantry" ? [[-10, -10], [10, -10], [-10, 10], [10, 10]] : [[0, 0]];
    t.ammo--;
    t.heat += s.heatPerShot;
    if (!t.ammo) t.reloading = s.magazineCapacity / s.loadingSpeed + s.reloadDelay;
    for (const [ox, oy] of formation) {
      const a2 = t.angle + (random() - 0.5) * spread, crit = random() < s.critChance + (t.team === "player" && activeBuff?.kind === "critical" ? 0.25 : 0), damage = s.damage / formation.length * (crit ? s.critMultiplier : 1) * (t.team === "player" && activeBuff?.kind === "damage" ? 1.2 : 1), x = t.x + ox * Math.cos(t.heading) - oy * Math.sin(t.heading), y = t.y + ox * Math.sin(t.heading) + oy * Math.cos(t.heading), muzzle = t.type === "infantry" ? 18 : t.r + 5;
      shots.push({ team: t.team, owner: t.id, sourceType: t.type, x: x + Math.cos(a2) * muzzle, y: y + Math.sin(a2) * muzzle, vx: Math.cos(a2) * s.projectileSpeed, vy: Math.sin(a2) * s.projectileSpeed, damage, life: 2.5, indirect: s.indirect || s.flying, radius: s.explosionRadius + (t.team === "player" && activeBuff?.kind === "explosive" ? 50 : 0), penetration: s.penetration, crit });
    }
    t.cooldown = s.reload * (p.style === "rush" ? 0.85 : 1) * (t.powerTime > 0 ? 0.65 : 1) * (t.team === "player" && activeBuff?.kind === "reload" ? 0.65 : 1);
  }
  function squadTick(t, dt) {
    if (t.hp <= 0) return;
    const s = t.stats, p = t.plan;
    t.phase += dt;
    t.powerTime = Math.max(0, (t.powerTime || 0) - dt);
    if (t.team === "player" && activeBuff?.kind === "repair") t.hp = Math.min(t.maxHp, t.hp + 2 * dt);
    t.cooldown -= dt;
    t.dodgeCooldown = Math.max(0, t.dodgeCooldown - dt);
    t.shieldDelay = Math.max(0, t.shieldDelay - dt);
    t.boostTime = Math.max(0, t.boostTime - dt);
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    t.heat = Math.max(0, t.heat - s.coolingRate * dt);
    t.energy = Math.min(s.energyCapacity, t.energy + s.energyRegeneration * dt);
    t.hp = Math.min(t.maxHp, t.hp + s.repairRate * dt);
    if (t.shieldDelay <= 0 && t.shield < s.shieldCapacity) t.shield = Math.min(s.shieldCapacity, t.shield + s.shieldRecharge * dt);
    if (t.reloading > 0) {
      t.reloading -= dt;
      if (t.reloading <= 0) {
        t.ammo = Math.min(s.mag, t.reserve);
        t.reserve -= t.ammo;
      }
    }
    t.scan -= dt;
    if (t.scan <= 0) {
      t.target = chooseTarget(t);
      t.scan = s.scanInterval;
    }
    const foe = t.target;
    if (!foe || foe.hp <= 0) {
      if (t.commands.includes("drive")) {
        const formation = t.aiControlled ? aiMovement(t, null) : formationVector(t, null);
        t.velocity = Math.min(s.speed, t.velocity + s.acceleration * dt);
        squadMove(t, formation ? formation.mx : t.team === "player" ? 1 : -1, formation ? formation.my : Math.sin(t.phase) * 0.3, dt);
        if (t.id === selectedId && formation) updateProgramLive(formation.action);
      }
      return;
    }
    const dx = foe.x - t.x, dy = foe.y - t.y, dist = Math.hypot(dx, dy), [ux, uy] = norm(dx, dy), blocked = !s.flying && !s.indirect && lineBlocked(t.x, t.y, foe.x, foe.y);
    let mx = 0, my = 0, action = "Holding range";
    if (p.retreat && t.hp / t.maxHp < p.retreatBelow) {
      mx = -ux;
      my = -uy;
      action = "Retreating";
    } else if (p.cover && t.hp / t.maxHp < p.coverBelow && !nearRock(t)) {
      const point = coverTarget(t, foe);
      if (point) {
        mx = point[0] - t.x;
        my = point[1] - t.y;
        action = "Seeking cover";
      }
    } else if (t.aiControlled) {
      const motion = aiMovement(t, foe);
      mx = motion.mx;
      my = motion.my;
      action = motion.action;
    } else if (formationVector(t, foe)) {
      const formation = formationVector(t, foe);
      mx = formation.mx;
      my = formation.my;
      action = formation.action;
      if ((mx || my) && !t.stats.flying && lineBlocked(t.x, t.y, t.x + mx, t.y + my)) {
        t.pathClock = (t.pathClock || 0) - dt;
        if (t.pathClock <= 0) {
          t.pathTarget = pathStep(t, { x: t.x + mx, y: t.y + my });
          t.pathClock = 0.5;
        }
        mx = t.pathTarget[0] - t.x;
        my = t.pathTarget[1] - t.y;
      }
    } else if (blocked) {
      t.pathClock = (t.pathClock || 0) - dt;
      if (t.pathClock <= 0) {
        t.pathTarget = pathStep(t, foe);
        t.pathClock = 0.4;
      }
      mx = t.pathTarget[0] - t.x;
      my = t.pathTarget[1] - t.y;
      action = "Routing around cover";
    } else if (dist < p.preferred - 40) {
      mx = -ux;
      my = -uy;
      action = "Opening distance";
    } else if (dist > p.preferred + 40) {
      mx = ux;
      my = uy;
      action = "Closing distance";
    } else if (p.firePolicy !== "stationary") {
      mx = -uy * Math.sin(t.phase * 2);
      my = ux * Math.sin(t.phase * 2);
      action = "Strafing";
    }
    if (p.evade && !t.suppressEvasion) {
      mx -= uy * Math.sin(t.phase * 5) * 0.6;
      my += ux * Math.sin(t.phase * 5) * 0.6;
    }
    const moving = t.commands.includes("drive") && Math.hypot(mx, my) > 0.01;
    if (moving && p.style === "rush" && t.energy > 25 && t.boostTime <= 0) {
      t.boostTime = 1.5;
      t.energy -= 25;
    }
    const topSpeed = s.speed * (t.powerTime > 0 ? 1.35 : 1) * (t.boostTime > 0 ? 1.15 : 1) * (t.team === "player" && activeBuff?.kind === "speed" ? 1.15 : 1);
    t.velocity = moving ? Math.min(topSpeed, t.velocity + s.acceleration * dt) : Math.max(0, t.velocity - s.braking * dt);
    if (moving) squadMove(t, mx, my, dt);
    const aim = Math.atan2(dy, dx), turn = Math.atan2(Math.sin(aim - t.angle), Math.cos(aim - t.angle));
    t.angle += clamp(turn, -s.turretTurnRate * dt, s.turretTurnRate * dt);
    const sensor = t.commands.includes("radar") ? s.radarRange : 240, policy = p.firePolicy === "always" || (p.firePolicy === "inRange" ? Math.abs(dist - p.preferred) < 45 : Math.hypot(mx, my) < 0.1);
    if (dist < sensor && Math.abs(turn) < 0.15) t.lock += dt;
    else t.lock = 0;
    if (t.commands.includes("gun") && t.ammo > 0 && t.reloading <= 0 && t.cooldown <= 0 && t.heat < s.heatCapacity && policy && t.lock >= s.targetLockTime + foe.stats.ecmStrength * 0.4) {
      squadFire(t, foe);
      action = "Firing";
    }
    if (t.id === selectedId) updateProgramLive(action);
    if (campaign.map === "volcanic" && Math.hypot(t.x - W * 0.5, t.y - H * 0.22) < 100 && !s.flying) t.hp = Math.max(0, t.hp - 12 * dt);
  }
  function takeHit(t, s, scale = 1) {
    const source = s.sourceType || battleUnits.find((u) => u.id === s.owner)?.type;
    const matchup = source === "infantry" && ["tank", "artillery", "boat"].includes(t.type) ? 0.12 : source === "tank" && ["infantry", "sniper"].includes(t.type) ? 1.35 : 1;
    let damage = matchup * s.damage * scale * (1 - Math.max(0, t.stats.armor - s.penetration)) * (1 - t.stats.damageResistance);
    if (t.plan.cover && nearRock(t)) damage *= 0.72;
    if (t.team === "player" && activeBuff?.kind === "armor") damage *= 0.8;
    if (t.commands.includes("duck") && t.plan.evade && t.energy >= 10 && t.dodgeCooldown <= 0 && random() < t.stats.dodgeChance) {
      damage = 0;
      t.energy -= 10;
      t.dodgeCooldown = 1.5 * (1 - t.stats.abilityCooldownReduction);
    }
    t.shieldDelay = 2;
    const shield = Math.min(t.shield, damage);
    t.shield -= shield;
    damage -= shield;
    t.hp = Math.max(0, t.hp - damage);
    t.hitFlash = 0.2;
    damageEvents.push({ time: +elapsed.toFixed(2), source: s.owner, target: t.id, damage: +damage.toFixed(1), crit: s.crit });
    if (damageEvents.length > 1e3) damageEvents.shift();
    sparks.push({ x: t.x, y: t.y, life: 0.3, color: s.crit ? "#ffdb70" : "#cfefa0" });
  }
  update = function(dt) {
    if (mode !== "running") return;
    elapsed += dt;
    for (const t of battleUnits) {
      fieldBaseSupport(t, dt);
      squadTick(t, dt);
      if (t.hp > 0) for (const pickup of pickups) {
        if (!pickup.used && Math.hypot(t.x - pickup.x, t.y - pickup.y) < t.stats.pickupRadius) {
          collectPickup(t, pickup);
        }
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], px = s.x, py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const targets = battleUnits.filter((t) => t.team !== s.team && t.hp > 0);
      let hit = null;
      for (const t of targets) {
        const q = clamp(((t.x - px) * s.vx + (t.y - py) * s.vy) / ((s.vx * s.vx + s.vy * s.vy) * dt), 0, 1);
        if (Math.hypot(px + s.vx * dt * q - t.x, py + s.vy * dt * q - t.y) < t.r) {
          hit = t;
          break;
        }
      }
      const wall = !s.indirect && blockingRock(px, py, s.x, s.y);
      if (wall) damageBuilding(wall, s);
      if (hit && !wall) {
        takeHit(hit, s);
        if (s.radius) {
          for (const b2 of buildings) if (!b2.destroyed && Math.hypot(Math.max(b2.x, Math.min(hit.x, b2.x + b2.w)) - hit.x, Math.max(b2.y, Math.min(hit.y, b2.y + b2.h)) - hit.y) < s.radius) damageBuilding(b2, s);
        }
        if (s.radius) for (const t of targets) {
          if (t === hit) continue;
          const d = Math.hypot(t.x - hit.x, t.y - hit.y);
          if (d < s.radius) takeHit(t, s, (1 - d / s.radius) * t.stats.splashFalloff);
        }
      }
      if (hit || wall || s.life <= 0 || s.x < 0 || s.y < 0 || s.x > W || s.y > H) shots.splice(i, 1);
    }
    for (const s of sparks) s.life -= dt;
    sparks = sparks.filter((s) => s.life > 0);
    updateHud();
    const allies = battleUnits.filter((t) => t.team === "player"), foes = battleUnits.filter((t) => t.team === "enemy");
    if (!allies.some((t) => t.hp > 0) || !foes.some((t) => t.hp > 0) || elapsed >= 180) {
      const total = (t) => t.reduce((a2, u) => a2 + u.hp, 0) / t.reduce((a2, u) => a2 + u.maxHp, 0), win = total(allies) > total(foes);
      if (replaying) {
        const count = damageEvents.length;
        restoreReplay();
        message("Replay finished \xB7 " + (win ? "victory" : "defeat") + " \xB7 " + count + " damage events");
        return;
      }
      finish(win);
    }
  };
  updateHud = function() {
    if (!battleUnits.length) return;
    for (const [team, prefix] of [["player", "player"], ["enemy", "enemy"]]) {
      const group = battleUnits.filter((u) => u.team === team), hp = group.reduce((a2, u) => a2 + u.hp, 0), max = group.reduce((a2, u) => a2 + u.maxHp, 0), alive = group.filter((u) => u.hp > 0).length;
      $(prefix + "Hp").style.width = hp / Math.max(1, max) * 100 + "%";
      $(prefix + "HpText").textContent = alive + "/" + group.length + " units \xB7 " + Math.ceil(hp) + " / " + max;
    }
    if (player) enemy = battleUnits.find((u) => u.team === "enemy" && u.hp > 0) || battleUnits.find((u) => u.team === "enemy");
  };
  const squadDeploy = deploy;
  deploy = function() {
    if (campaign.lives <= 0) {
      $("message").textContent = "Run ended. Start a new run to restore 3 lives.";
      return;
    }
    if (!roster.some((u) => u.deployed !== false && (!unitTypes[u.type].water || campaign.map === "coast"))) {
      $("message").textContent = "No compatible units deployed. Use Squad & combine or choose Coastal sea.";
      return;
    }
    squadDeploy();
    if (mode === "running") {
      replayInputs = JSON.parse(JSON.stringify({ roster, selectedId, map: campaign.map, base: campaign.base, round, prompt: $("prompt").value, commands: [...commands], compiledPlan, compiledText, activeBuff }));
      $("mapSelect").disabled = true;
    }
  };
  const campaignFinish = finish;
  finish = function(win) {
    if (mode !== "running") return;
    replayRecord = replayInputs;
    try {
      localStorage.setItem("tank-replay-v1", JSON.stringify(replayRecord));
    } catch {
    }
    if (win) for (const t of battleUnits.filter((u) => u.team === "player")) {
      const owned = roster.find((u) => u.id === t.id);
      if (owned) owned.wins = Math.min(5, (owned.wins || 0) + 1);
    }
    else campaign.lives = Math.max(0, campaign.lives - 1);
    campaignFinish(win);
    $("mapSelect").disabled = false;
    if (!win) $("resultText").textContent = campaign.lives ? "Squad defeated. " + campaign.lives + " lives remain. Adjust programs and equipment, then retry." : "Run ended. Your collection and earnings remain. Start a new run for 3 lives.";
    saveRoster();
  };
  const campaignReset = resetRun;
  resetRun = function() {
    if (typeof onlinePlaying !== "undefined") {
      onlinePlaying = false;
      onlineSession = null;
      if (onlinePoll) clearTimeout(onlinePoll);
      localStorage.removeItem("tank-match-v1");
    }
    if (replaying) restoreReplay();
    campaign.lives = 3;
    replaying = false;
    campaignReset();
    $("mapSelect").disabled = false;
    saveRoster();
    renderRoster();
  };
  const squadRoster = renderRoster;
  renderRoster = function() {
    squadRoster();
    $("activeUnitLabel").textContent = roster.filter((u) => u.deployed !== false).length + " deployed \xB7 Team " + roster.length + "/" + economy.slots + " \xB7 " + economy.credits + " credits \xB7 " + campaign.lives + " lives";
    for (const card of $("rosterGrid").children) {
      const title = card.querySelector("h3");
      if (!title) continue;
      const type = Object.keys(unitTypes).find((t) => unitTypes[t].name === title.textContent);
      if (!type) continue;
      const detail = card.querySelector(".stars");
      const tier = (detail?.textContent.match(/★/g) || []).length;
      const group = roster.filter((u) => u.type === type && u.tier === tier);
      const b2 = document.createElement("button");
      b2.className = "tiny";
      b2.textContent = group.some((u) => u.deployed !== false) ? "Bench this group" : "Deploy this group";
      b2.disabled = mode === "running" || mode === "won";
      b2.onclick = () => {
        const bench = group.some((u) => u.deployed !== false);
        for (const u of group) u.deployed = !bench;
        saveRoster();
        resetPositions();
        renderRoster();
      };
      card.append(b2);
    }
  };
  const legacyDraw = draw;
  draw = function() {
    if (campaign.view === "3d") {
      draw3D();
      return;
    }
    const priorPlayer = player, priorEnemy = enemy;
    player = null;
    enemy = null;
    legacyDraw();
    player = priorPlayer;
    enemy = priorEnemy;
    if (campaign.map === "coast") {
      ctx.fillStyle = "#287c9a66";
      ctx.fillRect(0, 320, W, H - 320);
    }
    if (campaign.map === "volcanic") {
      ctx.fillStyle = "#fb6e3340";
      ctx.beginPath();
      ctx.arc(460, 280, 70, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const t of battleUnits) {
      if (t.hp <= 0) continue;
      tankDraw(t);
      ctx.fillStyle = "#344536";
      ctx.fillRect(t.x - 18, t.y - 32, 36, 4);
      ctx.fillStyle = t.team === "player" ? { olive: "#d7fb75", arctic: "#d9f2ff", sunset: "#ffb080", neon: "#c084ff" }[campaign.skin] : "#f39c6c";
      ctx.fillRect(t.x - 18, t.y - 32, 36 * t.hp / t.maxHp, 4);
    }
  };
  function project3D(x, y, z = 0) {
    const dx = x - W / 2, depth = y + 500, scale = 600 / depth;
    return [W / 2 + dx * scale, 85 + (y * 0.62 - z) * scale];
  }
  function prism(x, y, w, d, h, color) {
    const corners = [[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0], [x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]].map((p) => project3D(...p));
    for (const face of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [4, 5, 6, 7]]) {
      ctx.beginPath();
      face.forEach((id, i) => i ? ctx.lineTo(...corners[id]) : ctx.moveTo(...corners[id]));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#09150d";
      ctx.stroke();
    }
  }
  function draw3D() {
    ctx.fillStyle = "#0d1c16";
    ctx.fillRect(0, 0, W, H);
    const floor = [[0, 0], [W, 0], [W, H], [0, H]].map((p) => project3D(...p));
    ctx.beginPath();
    floor.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.closePath();
    ctx.fillStyle = campaign.map === "coast" ? "#24434a" : "#244632";
    ctx.fill();
    for (const o of [...rocks].sort((a2, b2) => a2.y - b2.y)) prism(o.x, o.y, o.w, o.h, 55, "#526849");
    for (const t of [...battleUnits].sort((a2, b2) => a2.y - b2.y)) {
      if (t.hp <= 0) continue;
      const color = t.team === "player" ? { olive: "#b9e66b", arctic: "#cdefff", sunset: "#efaa72", neon: "#b98bea" }[campaign.skin] : "#d69067";
      if (t.type === "infantry") {
        for (const [ox, oy] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
          const x = t.x + ox * Math.cos(t.heading) - oy * Math.sin(t.heading), y = t.y + ox * Math.sin(t.heading) + oy * Math.cos(t.heading);
          prism(x - 4, y - 4, 8, 8, 24, color);
          const a2 = project3D(x, y, 20), b2 = project3D(x + Math.cos(t.angle) * 16, y + Math.sin(t.angle) * 16, 20);
          ctx.strokeStyle = "#dce4db";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(...a2);
          ctx.lineTo(...b2);
          ctx.stroke();
        }
      } else {
        prism(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2, t.stats.flying ? 80 : 25, color);
        if (t.type === "artillery") prism(t.x + 5, t.y - 3, 7, 7, 70, "#9caeac");
      }
      const p = project3D(t.x, t.y, t.stats.flying ? 100 : 40);
      ctx.fillStyle = color;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(unitTypes[t.type].name, p[0], p[1] - 8);
    }
    for (const b2 of onlinePlaying ? [] : campaign.base || []) {
      prism(b2.x - 16, b2.y - 16, 32, 32, 40, b2.kind === "repair" ? "#68bfc0" : b2.kind === "ammo" ? "#e8b66d" : "#526849");
    }
    for (const s of shots) {
      const p = project3D(s.x, s.y, s.indirect ? 50 : 15);
      ctx.fillStyle = "#fff6af";
      ctx.beginPath();
      ctx.arc(...p, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#d9ebc7";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("3D tactical view \xB7 " + campaign.map + " \xB7 " + mode, 18, H - 20);
  }
  renderStats = function() {
    const root = $("statList");
    root.replaceChildren();
    const s = unitStats(), fields = [["Damage", s.damage], ["Crit chance", s.critChance], ["Crit multiplier", s.critMultiplier], ["Armor penetration", s.penetration], ["Projectile speed", s.projectileSpeed], ["Explosion radius", s.explosionRadius], ["Aim accuracy", s.accuracy], ["Splash falloff", s.splashFalloff], ["Ammo loading speed", s.loadingSpeed], ["Magazine capacity", s.magazineCapacity], ["Reload delay", s.reloadDelay], ["Ammo reserve", s.ammoReserve], ["Heat capacity", s.heatCapacity], ["Heat per shot", s.heatPerShot], ["Cooling rate", s.coolingRate], ["Hull integrity", s.maxHealth], ["Armor", s.armor], ["Shield capacity", s.shieldCapacity], ["Shield recharge", s.shieldRecharge], ["Damage resistance", s.damageResistance], ["Repair rate", s.repairRate], ["Impact resistance", s.impactResistance], ["Tank speed", s.speed], ["Acceleration", s.acceleration], ["Braking", s.braking], ["Turn rate", s.turnRate], ["Turret turn rate", s.turretTurnRate], ["Reverse speed", s.reverseSpeed], ["Terrain traction", s.terrainTraction], ["Radar range", s.radarRange], ["Scan interval", s.scanInterval], ["Target lock time", s.targetLockTime], ["Vision cone", s.visionCone], ["Stealth signature", s.stealthSignature], ["ECM strength", s.ecmStrength], ["Energy capacity", s.energyCapacity], ["Energy regeneration", s.energyRegeneration], ["Ability cooldown reduction", s.abilityCooldownReduction], ["Pickup radius", s.pickupRadius]];
    for (const [name, value] of fields) {
      const cell = document.createElement("div"), label = document.createElement("small"), number = document.createElement("b");
      cell.className = "stat-cell";
      label.textContent = name;
      number.textContent = Number(value).toFixed(Number.isInteger(value) ? 0 : 2);
      cell.append(label, number);
      root.append(cell);
    }
  };
  $("mapSelect").onchange = () => {
    if (mode === "running" || mode === "won") return;
    campaign.map = $("mapSelect").value;
    saveRoster();
    resetPositions();
  };
  $("viewSelect").onchange = () => {
    campaign.view = $("viewSelect").value;
    saveRoster();
  };
  $("loadoutButton").onclick = () => {
    renderLoadout();
    $("loadoutDialog").showModal();
  };
  $("closeLoadout").onclick = () => $("loadoutDialog").close();
  $("transferButton").onclick = () => $("transferDialog").showModal();
  $("closeTransfer").onclick = () => $("transferDialog").close();
  function restoreReplay() {
    if (!replaySaved) return;
    const s = replaySaved;
    roster = s.roster;
    selectedId = s.selectedId;
    round = s.round;
    campaign = s.campaign;
    commands = s.commands;
    compiledPlan = s.compiledPlan;
    compiledText = s.compiledText;
    activeBuff = s.activeBuff;
    $("prompt").value = s.prompt;
    replaying = false;
    replaySaved = null;
    mode = "ready";
    resetPositions();
    preview();
    renderRoster();
    $("deploy").disabled = false;
  }
  $("replayButton").onclick = () => {
    if (mode === "running" || mode === "won") return;
    if (!replayRecord) {
      try {
        replayRecord = JSON.parse(localStorage.getItem("tank-replay-v1"));
      } catch {
      }
    }
    if (!replayRecord) {
      $("message").textContent = "Finish a battle to record a replay.";
      return;
    }
    replaySaved = { roster, selectedId, round, campaign: { ...campaign }, prompt: $("prompt").value, commands, compiledPlan, compiledText, activeBuff };
    replaying = true;
    roster = JSON.parse(JSON.stringify(replayRecord.roster));
    selectedId = replayRecord.selectedId;
    round = replayRecord.round;
    campaign.map = replayRecord.map;
    campaign.base = JSON.parse(JSON.stringify(replayRecord.base || []));
    commands = new Set(replayRecord.commands);
    compiledPlan = replayRecord.compiledPlan;
    compiledText = replayRecord.compiledText;
    activeBuff = replayRecord.activeBuff;
    $("prompt").value = replayRecord.prompt;
    resetPositions();
    mode = "running";
    $("deploy").disabled = true;
    $("message").textContent = "Replay running. No rewards or credits will be earned.";
  };
  applyMap();
  const phoneRequests = /* @__PURE__ */ new Map();
  window.onPhoneDownload = function(text) {
    $("modelStatus").textContent = text;
    if (typeof PhoneAI !== "undefined" && PhoneAI.available()) {
      checkModel();
      $("installPhoneModel").hidden = true;
    }
  };
  if (typeof PhoneAI !== "undefined" && !PhoneAI.available()) {
    const install = document.createElement("button");
    install.id = "installPhoneModel";
    install.className = "tiny";
    install.textContent = "Install free phone model \xB7 492 MB";
    install.onclick = () => {
      install.disabled = true;
      PhoneAI.installModel();
      setTimeout(() => install.disabled = false, 3e4);
    };
    $("modelStatus").parentNode.append(install);
  }
  let phoneRequestId = 0;
  if (typeof window !== "undefined") window.onPhonePlan = (id, out) => {
    const req = phoneRequests.get(id);
    if (!req) return;
    clearTimeout(req.timer);
    phoneRequests.delete(id);
    out.error ? req.reject(Error(out.error)) : req.resolve(out);
  };
  function validateClientPlan(p) {
    if (!p || !["rush", "balanced", "sniper"].includes(p.style) || !["always", "inRange", "stationary"].includes(p.firePolicy) || ["cover", "evade", "retreat"].some((k) => typeof p[k] !== "boolean") || ["preferred", "coverBelow", "retreatBelow"].some((k) => typeof p[k] !== "number" || !Number.isFinite(p[k]))) throw Error("Model returned an invalid plan. Rule parser remains available.");
    return { ...p, preferred: clamp(p.preferred, 100, 500), coverBelow: clamp(p.coverBelow, 0, 0.9), retreatBelow: clamp(p.retreatBelow, 0, 0.8), explanation: String(p.explanation || "").slice(0, 240) };
  }
  async function requestLocalPlan(text, u, cmd) {
    let out;
    if (typeof PhoneAI !== "undefined" && PhoneAI.available()) {
      out = await new Promise((resolve, reject) => {
        const id = ++phoneRequestId, timer = setTimeout(() => {
          phoneRequests.delete(id);
          reject(Error("Phone model timed out"));
        }, 9e4);
        phoneRequests.set(id, { resolve, reject, timer });
        PhoneAI.compile("Unit: " + u.type + ". Enabled commands: " + cmd.join(", ") + ". Tactic: " + text, id);
      });
    } else {
      const r = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: text, unitType: u.type, tier: u.tier, commands: cmd }), signal: AbortSignal.timeout(125e3) });
      out = await r.json();
      if (!r.ok) throw Error(out.error);
    }
    out.plan = validateClientPlan(out.plan);
    return out;
  }
  async function generateRewardTactics() {
    const reward = levelReward;
    if (!reward || reward.tactic) return;
    try {
      const u = selectedUnit(), out = await requestLocalPlan("Propose a useful next-round tactic after defeating a mixed squad on " + campaign.map + ". Favor " + (round % 2 ? "cover and distance" : "evade and retreat") + ".", u, unlocked(u)), p = out.plan;
      const generated = "Hold " + Math.round(p.preferred) + " range" + (p.cover ? ", use cover below " + Math.round(p.coverBelow * 100) + "% hull" : "") + (p.evade ? ", evade with zigzag movement" : "") + (p.retreat ? ", retreat below " + Math.round(p.retreatBelow * 100) + "% hull" : "") + ".";
      if (levelReward === reward && !reward.tactic) {
        reward.tacticOptions[0] = { ...reward.tacticOptions[0], instruction: generated };
        renderLevelRewards();
        $("message").textContent = "Tactic reward generated by " + out.model;
      }
    } catch {
    }
  }
  const modelRewardFinish = finish;
  finish = function(win) {
    modelRewardFinish(win);
    if (win && levelReward && !replaying) generateRewardTactics();
  };
  let onlineSession = null, onlinePlaying = false, onlinePoll = null;
  try {
    onlineSession = JSON.parse(localStorage.getItem("tank-match-v1"));
  } catch {
  }
  function matchSquad() {
    saveProgram();
    return roster.filter((u) => u.deployed !== false && (!unitTypes[u.type].water || campaign.map === "coast")).map((u) => ({ ...u, compiled: u.id === selectedId ? parsePlan() : planForUnit(u), compiledText: u.instruction }));
  }
  async function matchAction(action) {
    if (mode === "running" || mode === "won" || compiling) return;
    try {
      $("multiplayerMessage").textContent = "Connecting to match server\u2026";
      const r = await fetch("/api/matches/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ units: matchSquad(), map: campaign.map, code: $("matchCode").value.trim().toUpperCase() }), signal: AbortSignal.timeout(1e4) });
      const data = await r.json();
      if (!r.ok || data.error) throw Error(data.error || "Match server unavailable");
      onlineSession = data;
      localStorage.setItem("tank-match-v1", JSON.stringify(data));
      $("matchCode").value = data.code;
      $("multiplayerMessage").textContent = "Match " + data.code + " \xB7 waiting for opponent. Share this code.";
      pollMatch();
    } catch (e) {
      $("multiplayerMessage").textContent = e.message;
    }
  }
  async function pollMatch() {
    if (!onlineSession) return;
    if (onlinePoll) clearTimeout(onlinePoll);
    try {
      const r = await fetch("/api/matches?code=" + encodeURIComponent(onlineSession.code), { headers: { "x-match-token": onlineSession.token }, signal: AbortSignal.timeout(6e3) }), data = await r.json();
      if (!r.ok || data.error) throw Error(data.error || "Match disconnected");
      if (data.status === "waiting") {
        $("multiplayerMessage").textContent = "Match " + data.code + " \xB7 Waiting for opponent";
        onlinePoll = setTimeout(pollMatch, 1e3);
        return;
      }
      onlinePlaying = true;
      mode = "running";
      const mapChanged = campaign.map !== data.map;
      campaign.map = data.map;
      if (mapChanged) applyMap();
      battleUnits = data.battleUnits.map((t) => ({ ...t, team: data.seat === 0 ? t.team : t.team === "player" ? "enemy" : "player" }));
      shots = data.shots.map((s) => ({ ...s, team: data.seat === 0 ? s.team : s.team === "player" ? "enemy" : "player" }));
      sparks = data.sparks;
      pickups = data.pickups || [];
      if (data.buildings) {
        const geometryChanged = buildings.length !== data.buildings.length || buildings.some((b2, i) => b2.id !== data.buildings[i]?.id || b2.x !== data.buildings[i]?.x || b2.kind !== data.buildings[i]?.kind || b2.destroyed !== data.buildings[i]?.destroyed);
        buildings = data.buildings;
        rocks.splice(0, rocks.length, ...buildings.filter((b2) => !b2.destroyed));
        if (geometryChanged) worldRevision++;
      }
      player = battleUnits.find((u) => u.team === "player");
      enemy = battleUnits.find((u) => u.team === "enemy");
      elapsed = data.elapsed;
      $("prompt").disabled = true;
      $("deploy").disabled = true;
      $("multiplayerDialog").close();
      updateHud();
      $("arenaState").textContent = "Online \xB7 server controlled";
      if (data.status === "finished") {
        onlinePlaying = false;
        const onlineWin = data.winner === data.seat;
        mode = "ready";
        $("prompt").disabled = false;
        $("deploy").disabled = false;
        $("result").classList.add("show");
        $("resultTitle").textContent = onlineWin ? "Multiplayer victory" : "Multiplayer defeat";
        $("resultText").textContent = "Server confirmed result. Online win: 60 credits; loss: 15 credits. Open the protected online armory to refresh your balance.";
        onlineSession = null;
        localStorage.removeItem("tank-match-v1");
        showOnlineBattleResult(onlineWin, data);
        return;
      }
      onlinePoll = setTimeout(pollMatch, 150);
    } catch (e) {
      $("multiplayerMessage").textContent = e.message + " \xB7 Reconnect when the server is available.";
      if (onlinePlaying) {
        $("arenaState").textContent = "Disconnected \xB7 reconnect available";
        onlinePoll = setTimeout(pollMatch, 2e3);
      }
    }
  }
  const offlineUpdate = update;
  update = function(dt) {
    if (!onlinePlaying) offlineUpdate(dt);
  };
  $("multiplayerButton").onclick = () => {
    $("multiplayerDialog").showModal();
  };
  $("closeMultiplayer").onclick = () => $("multiplayerDialog").close();
  $("createMatch").onclick = () => matchAction("create");
  $("joinMatch").onclick = () => matchAction("join");
  $("reconnectMatch").onclick = pollMatch;
  const defaultSquadScript = "leader tank-1\nall stance balanced\nall focus nearest\nall follow leader";
  let squadScript = defaultSquadScript, orderCache = /* @__PURE__ */ new Map();
  try {
    squadScript = localStorage.getItem("tank-squad-script-v1") || defaultSquadScript;
    const migration = rosterKey + "-single-tank-v2";
    if (!localStorage.getItem(migration)) {
      localStorage.setItem(rosterKey + "-legacy-archive", JSON.stringify({ version: 1, units: roster }));
      roster = [newUnit2("tank")];
      selectedId = roster[0].id;
      economy.slots = 1;
      economy.reserve = {};
      localStorage.setItem(migration, "1");
      saveRoster();
    }
  } catch {
  }
  function parseSquadScript(text) {
    if (orderCache.has(text)) return orderCache.get(text);
    if (text.length > 3e3) throw Error("Squad script is limited to 3000 characters");
    const rules = [], errors = [];
    let leader = "tank-1";
    const selector = "(?:all|tank|infantry|helicopter|rocket|artillery|sniper|boat|(?:tank|infantry|helicopter|rocket|artillery|sniper|boat)-[1-9][0-9]?)";
    for (const [i, raw] of text.split("\n").entries()) {
      const line = raw.trim().toLowerCase();
      if (!line || line.startsWith("#")) continue;
      let m;
      if (m = line.match(/^leader ((?:tank|infantry|helicopter|rocket|artillery|sniper|boat)-[1-9][0-9]?)$/)) {
        leader = m[1];
        continue;
      }
      if (m = line.match(new RegExp("^(" + selector + ") (follow|protect|flank) (leader|(?:tank|infantry|helicopter|rocket|artillery|sniper|boat)-[1-9][0-9]?)$"))) rules.push({ selector: m[1], kind: "formation", mode: m[2], anchor: m[3] });
      else if (m = line.match(new RegExp("^(" + selector + ") focus (nearest|weakest|leader)$"))) rules.push({ selector: m[1], kind: "focus", value: m[2] });
      else if (m = line.match(new RegExp("^(" + selector + ") hold ([0-9]{2,3})$"))) rules.push({ selector: m[1], kind: "range", value: clamp(+m[2], 100, 500) });
      else if (m = line.match(new RegExp("^(" + selector + ") stance (rush|balanced|sniper)$"))) rules.push({ selector: m[1], kind: "stance", value: m[2] });
      else if (m = line.match(new RegExp("^(" + selector + ") retreat below ([0-9]{1,2})%$"))) rules.push({ selector: m[1], kind: "retreat", value: clamp(+m[2] / 100, 0.05, 0.8) });
      else errors.push("Line " + (i + 1) + ": unknown order \u201C" + raw.trim() + "\u201D");
    }
    const result = { leader, rules, errors };
    if (orderCache.size > 50) orderCache.clear();
    orderCache.set(text, result);
    return result;
  }
  function callsign(t) {
    const peers = battleUnits.filter((u) => u.team === t.team && u.type === t.type);
    return t.type + "-" + (peers.indexOf(t) + 1);
  }
  function scriptFor(t) {
    return t.squadScript || squadScript;
  }
  function leaderFor(t) {
    const own = battleUnits.filter((u) => u.team === t.team && u.hp > 0);
    const name = parseSquadScript(scriptFor(t)).leader;
    return own.find((u) => callsign(u) === name) || own.find((u) => u.type === "tank") || own[0];
  }
  function ordersFor(t) {
    const script = parseSquadScript(scriptFor(t)), name = callsign(t), capacity = t.tier === 1 ? 3 : t.tier === 2 ? 5 : 7, result = {};
    let count = 0;
    for (const rule of script.rules) {
      if (rule.selector !== "all" && rule.selector !== t.type && rule.selector !== name) continue;
      if (++count > capacity) break;
      if (rule.kind === "retreat" && t.tier < 3) continue;
      result[rule.kind] = rule;
    }
    return result;
  }
  function formationVector(t, foe) {
    const order = ordersFor(t).formation;
    if (!order) return null;
    const anchor = order.anchor === "leader" ? leaderFor(t) : battleUnits.find((u) => u.team === t.team && u.hp > 0 && callsign(u) === order.anchor);
    if (!anchor || anchor === t) return null;
    const peers = battleUnits.filter((u) => u.team === t.team && u.hp > 0 && u !== anchor), i = peers.indexOf(t), angle = anchor.heading + Math.PI + (i % 3 - 1) * 0.65;
    let x = anchor.x + Math.cos(angle) * (70 + Math.floor(i / 3) * 35), y = anchor.y + Math.sin(angle) * (70 + Math.floor(i / 3) * 35);
    if (order.mode === "protect" && foe) {
      const [nx, ny] = norm(foe.x - anchor.x, foe.y - anchor.y);
      x = anchor.x + nx * 70;
      y = anchor.y + ny * 70 + (i % 2 ? 25 : -25);
    }
    if (order.mode === "flank" && foe) {
      const [nx, ny] = norm(foe.x - anchor.x, foe.y - anchor.y);
      x = foe.x - ny * (i % 2 ? -120 : 120);
      y = foe.y + nx * (i % 2 ? -120 : 120);
    }
    const distance = Math.hypot(x - t.x, y - t.y);
    return { mx: distance > 28 ? x - t.x : 0, my: distance > 28 ? y - t.y : 0, action: order.mode === "protect" ? "Protecting " + callsign(anchor) : order.mode === "flank" ? "Flanking target" : "Following " + callsign(anchor) };
  }
  const soloTarget = chooseTarget;
  chooseTarget = function(t) {
    const order = ordersFor(t), leader = leaderFor(t), anchor = order.formation?.mode === "protect" ? order.formation.anchor === "leader" ? leader : battleUnits.find((u) => u.team === t.team && callsign(u) === order.formation.anchor) : null;
    const foes = battleUnits.filter((u) => u.team !== t.team && u.hp > 0 && Math.hypot(u.x - t.x, u.y - t.y) < t.stats.radarRange * u.stats.stealthSignature);
    if (!foes.length) return null;
    if (anchor) {
      const threatening = foes.filter((u) => Math.hypot(u.x - anchor.x, u.y - anchor.y) < 450);
      if (threatening.length) return threatening.sort((a2, b2) => Math.hypot(a2.x - anchor.x, a2.y - anchor.y) - Math.hypot(b2.x - anchor.x, b2.y - anchor.y))[0];
    }
    if (order.focus?.value === "weakest") return foes.sort((a2, b2) => a2.hp / a2.maxHp - b2.hp / b2.maxHp)[0];
    if (order.focus?.value === "leader" && leader !== t && foes.includes(leader?.target)) return leader.target;
    if (order.focus) return foes.sort((a2, b2) => Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y))[0];
    return soloTarget(t);
  };
  function aiMovement(t, foe) {
    const phase = t.phase, cycle = phase % 7;
    if (!foe) return { mx: t.team === "enemy" ? -1 : 1, my: Math.sin(phase * 0.65 + 1.2) * 0.75, action: "Patrolling an approach lane" };
    const dx = foe.x - t.x, dy = foe.y - t.y, d = Math.hypot(dx, dy), [nx, ny] = norm(dx, dy);
    if (!t.stats.flying && !t.stats.indirect && lineBlocked(t.x, t.y, foe.x, foe.y)) {
      t.pathClock = (t.pathClock || 0) - 0.0167;
      if (t.pathClock <= 0) {
        t.pathTarget = pathStep(t, foe);
        t.pathClock = 0.5;
      }
      return { mx: t.pathTarget[0] - t.x, my: t.pathTarget[1] - t.y, action: "Taking an alternate route" };
    }
    let mx = 0, my = 0, action = "Holding a firing position";
    if (t.aiPattern === "helicopter" || t.aiPattern === "boat") {
      const advance = d > 320 ? 0.65 : d < 190 ? -0.7 : 0, orbit = t.aiPattern === "helicopter" ? 1 : 0.45;
      mx = nx * advance - ny * orbit;
      my = ny * advance + nx * orbit;
      action = t.aiPattern === "helicopter" ? "Orbiting the target" : "Circling for a broadside";
    } else if (t.aiPattern === "sniper" || t.aiPattern === "artillery") {
      const preferred = t.aiPattern === "sniper" ? 390 : 340;
      if (d < preferred - 45) {
        mx = -nx;
        my = -ny;
        action = "Repositioning to the rear";
      } else if (d > preferred + 60) {
        mx = nx * 0.65;
        my = ny * 0.65;
        action = "Advancing to firing range";
      } else if (cycle > 5) {
        mx = -ny * 0.8;
        my = nx * 0.8;
        action = "Changing firing position";
      }
    } else if (t.aiPattern === "infantry" || t.aiPattern === "rocket") {
      const advance = d > 230 ? 1 : d < 135 ? -0.6 : 0, lateral = cycle < 3 ? 0.65 : -0.45;
      if (cycle < 5.5) {
        mx = nx * advance - ny * lateral;
        my = ny * advance + nx * lateral;
        action = "Moving in short attack bursts";
      }
    } else {
      if (cycle < 4.8) {
        const advance = d > 230 ? 0.85 : d < 155 ? -0.45 : 0;
        mx = nx * advance - ny * 0.45;
        my = ny * advance + nx * 0.45;
        action = "Advancing along a side lane";
      } else action = "Pausing to aim";
    }
    return { mx, my, action };
  }
  const autonomousTick = squadTick;
  squadTick = function(t, dt) {
    const order = ordersFor(t);
    if (order.range) t.plan.preferred = order.range.value;
    if (order.stance) {
      t.plan.style = order.stance.value;
      if (!order.range && !t.plan.modelApplied) t.plan.preferred = order.stance.value === "rush" ? 145 : order.stance.value === "sniper" ? 360 : t.stats.range;
    }
    if (order.retreat) {
      t.plan.retreat = true;
      t.plan.retreatBelow = order.retreat.value;
    }
    autonomousTick(t, dt);
  };
  commandRender = function() {
    commands = new Set(unlocked(selectedUnit()));
    $("commands").replaceChildren();
  };
  saveProgram = function() {
    squadScript = $("prompt").value;
    for (const u of roster) {
      u.instruction = squadScript;
      u.squadScript = squadScript;
      u.commands = unlocked(u);
      u.compiled = compiledPlan;
      u.compiledText = compiledText;
    }
    try {
      localStorage.setItem("tank-squad-script-v1", squadScript);
    } catch {
    }
    saveRoster();
  };
  activateUnit = function(id, skipSave = false) {
    if (mode === "running" || mode === "won" || compiling) return;
    if (!skipSave) saveProgram();
    selectedId = id;
    commandRender();
    $("prompt").value = squadScript;
    saveRoster();
    resetPositions();
    preview();
    renderRoster();
  };
  planForUnit = function(u) {
    const p = u.compiled && u.compiledText === u.instruction ? { ...u.compiled } : { style: "balanced", preferred: unitStats(u).range, cover: u.tier >= 2, coverBelow: 0.5, evade: u.tier >= 2, retreat: false, retreatBelow: 0.25, firePolicy: "always" };
    p.modelApplied = !!(u.compiled && u.compiledText === u.instruction);
    p.cover = p.cover && u.tier >= 2;
    p.evade = p.evade && u.tier >= 2;
    p.retreat = p.retreat && u.tier >= 3;
    return p;
  };
  const unitSpawn = spawnCombat;
  spawnCombat = function(u, team, index, count) {
    const t = unitSpawn(u, team, index, count);
    t.squadScript = u.squadScript || (team === "player" ? squadScript : "leader tank-1\nall focus weakest\nall follow leader");
    t.commands = unlocked(u);
    t.aiControlled = team === "enemy";
    if (t.aiControlled) {
      t.phase = 2.3 + index * 1.7;
      t.aiPattern = u.type;
      if (round === 1 && u.type === "tank") {
        t.hp = 120;
        t.maxHp = 120;
        t.stats = { ...t.stats, hp: 120, maxHealth: 120 };
      }
    }
    return t;
  };
  const personalPreview = preview;
  preview = function() {
    squadScript = $("prompt").value || defaultSquadScript;
    personalPreview();
    const parsed = parseSquadScript(squadScript);
    $("planPreview").textContent = parsed.errors.length ? parsed.errors.join(" \xB7 ") : parsed.rules.length + " squad orders \xB7 Leader " + parsed.leader + (compiledPlan && compiledText === squadScript ? " \xB7 Local AI stance: " + compiledPlan.style + " / " + compiledPlan.preferred + " range" : " \xB7 Deterministic orders ready");
    $("scriptRoster").textContent = "Unit callsigns: " + roster.map((u, i) => u.type + "-" + roster.slice(0, i + 1).filter((x) => x.type === u.type).length).join(", ");
  };
  const orderDeploy = deploy;
  deploy = function() {
    saveProgram();
    const parsed = parseSquadScript(squadScript);
    if (parsed.errors.length) {
      $("message").textContent = "Fix the script before deploying: " + parsed.errors.join(" \xB7 ");
      return;
    }
    orderDeploy();
  };
  $("deploy").onclick = () => deploy();
  const continueRunReset = resetRun;
  resetRun = function() {
    if (compiling) return;
    if (replaying) restoreReplay();
    roster = [newUnit2("tank")];
    selectedId = roster[0].id;
    economy.reserve = {};
    squadScript = defaultSquadScript;
    compiledPlan = null;
    compiledText = "";
    $("prompt").value = squadScript;
    commands = new Set(unlocked(roster[0]));
    continueRunReset();
    saveProgram();
    $("message").textContent = "New run: one tank versus one AI tank. Recruit allies from victory rewards.";
  };
  $("reset").onclick = () => resetRun();
  for (const u of roster) {
    u.commands = unlocked(u);
  }
  $("prompt").value = squadScript;
  const archivedButton = document.createElement("button");
  archivedButton.className = "tiny";
  archivedButton.textContent = "Export previous test collection";
  archivedButton.onclick = () => {
    try {
      $("transferData").value = localStorage.getItem(rosterKey + "-legacy-archive") || "";
      $("transferMessage").textContent = "Previous test collection preserved for export.";
    } catch {
    }
  };
  $("transferDialog").append(archivedButton);
  const exportSquad = $("exportUnits").onclick;
  $("exportUnits").onclick = () => {
    saveProgram();
    exportSquad();
  };
  if (!Array.isArray(campaign.base)) campaign.base = [];
  const baseLocations = [{ name: "North field", x: 150, y: 80 }, { name: "Central field", x: 150, y: 230 }, { name: "South field", x: 150, y: 410 }];
  const baseTypes = { repair: { name: "Repair station", price: 100, description: "Restores 2 hull per second per tier within 110 range." }, ammo: { name: "Ammo depot", price: 120, description: "Supplies 8 reserve rounds per tier every 5 seconds within 110 range." }, wall: { name: "Cover wall", price: 80, description: "Blocks direct shots and ground movement. Upgrades make the screen wider." } };
  function buildBase(site, kind) {
    if (mode === "running" || compiling) return;
    const point = baseLocations[site], type = baseTypes[kind];
    if (!point || !type || campaign.base.some((b2) => b2.site === site) || economy.credits < type.price) return;
    economy.credits -= type.price;
    campaign.base.push({ site, kind, tier: 1, x: point.x, y: point.y });
    saveRoster();
    resetPositions();
    renderBase();
    renderRoster();
    $("baseMessage").textContent = type.name + " constructed.";
  }
  function upgradeBase(site) {
    if (mode === "running" || compiling) return;
    const b2 = campaign.base.find((b3) => b3.site === site);
    if (!b2 || b2.tier >= 3) return;
    const cost = 70 * b2.tier;
    if (economy.credits < cost) return;
    economy.credits -= cost;
    b2.tier++;
    saveRoster();
    resetPositions();
    renderBase();
    renderRoster();
  }
  function renderBase() {
    const root = $("baseSites");
    root.replaceChildren();
    $("baseBalance").textContent = economy.credits + " credits \xB7 " + campaign.base.length + "/3 structures";
    for (let i = 0; i < baseLocations.length; i++) {
      const card = document.createElement("div");
      card.className = "unit-card";
      const title = document.createElement("h3");
      title.textContent = baseLocations[i].name;
      card.append(title);
      const b2 = campaign.base.find((b3) => b3.site === i);
      if (b2) {
        const p = document.createElement("p");
        p.textContent = baseTypes[b2.kind].name + " " + "\u2605".repeat(b2.tier) + " \xB7 " + baseTypes[b2.kind].description;
        const upgrade = document.createElement("button");
        upgrade.className = "tiny";
        upgrade.textContent = b2.tier === 3 ? "Maximum tier" : "Upgrade \xB7 " + 70 * b2.tier + " credits";
        upgrade.disabled = b2.tier >= 3 || economy.credits < 70 * b2.tier || mode === "running" || compiling;
        upgrade.onclick = () => upgradeBase(i);
        card.append(p, upgrade);
      } else for (const [kind, type] of Object.entries(baseTypes)) {
        const button = document.createElement("button");
        button.className = "tiny";
        button.textContent = type.name + " \xB7 " + type.price + " credits";
        button.disabled = economy.credits < type.price || mode === "running" || compiling;
        button.onclick = () => buildBase(i, kind);
        card.append(button);
      }
      root.append(card);
    }
  }
  function fieldBaseSupport(t, dt) {
    if (t.team !== "player" || t.hp <= 0) return;
    for (const b2 of campaign.base || []) {
      if (Math.hypot(t.x - b2.x, t.y - b2.y) > 110) continue;
      if (b2.kind === "repair") t.hp = Math.min(t.maxHp, t.hp + 2 * b2.tier * dt);
      if (b2.kind === "ammo" && elapsed >= (t.supplyAt || 0)) {
        t.reserve = Math.min(250, t.reserve + 8 * b2.tier);
        t.supplyAt = elapsed + 5;
      }
    }
  }
  const tacticalDraw = draw;
  draw = function() {
    tacticalDraw();
    if (campaign.view === "3d" || onlinePlaying) return;
    for (const b2 of campaign.base || []) {
      ctx.fillStyle = b2.kind === "repair" ? "#68bfc0" : b2.kind === "ammo" ? "#e8b66d" : "#526849";
      ctx.fillRect(b2.x - 14, b2.y - 14, 28, 28);
      ctx.fillStyle = "#08170d";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b2.kind === "repair" ? "+" : b2.kind === "ammo" ? "A" : "W", b2.x, b2.y + 6);
    }
  };
  $("baseButton").onclick = () => {
    renderBase();
    $("baseDialog").showModal();
  };
  $("closeBase").onclick = () => $("baseDialog").close();
  function battlePoints2(win, units, team = "player") {
    const defeated = units.filter((u) => u.team !== team && u.hp <= 0).length;
    const surviving = units.filter((u) => u.team === team && u.hp > 0).length;
    const outcome = win ? 100 : 20, eliminations = defeated * 25, survival = surviving * 10;
    return { total: outcome + eliminations + survival, outcome, eliminations, survival };
  }
  Object.assign(unitTypes, {
    medic: { name: "Medic", role: "Heals foot troops; light pistol", hp: 85, damage: 9, speed: 82, range: 180, reload: 0.7, mag: 8, spread: 0.13, r: 12 },
    engineer: { name: "Engineer", role: "Repairs vehicles and supplies ammunition", hp: 100, damage: 11, speed: 75, range: 195, reload: 0.65, mag: 10, spread: 0.12, r: 12 },
    scout: { name: "Scout car", role: "Fast reconnaissance and target marking", hp: 95, damage: 14, speed: 125, range: 245, reload: 0.6, mag: 10, spread: 0.1, r: 16 }
  });
  unitTypes.helicopter.hp = 70;
  const unitUnlocks = { tank: 1, infantry: 1, rocket: 1, sniper: 3, scout: 2, medic: 3, artillery: 4, engineer: 4, boat: 5, helicopter: 6 };
  function availableTypes() {
    return Object.keys(unitTypes).filter((type) => round >= unitUnlocks[type] && (!unitTypes[type].water || campaign.map === "coast"));
  }
  const squadFunctions = [
    ["General", "advance", "Advance toward the nearest enemy."],
    ["General", "withdraw", "Move away from the nearest enemy."],
    ["General", "stop", "Stop moving and fire from the current position."],
    ["General", "patrol", "Patrol a 180-unit circle around the starting position."],
    ["General", "rally", "Move within 60 units of the surviving leader."],
    ["General", "spread", "Separate from nearby allies to reduce splash exposure."],
    ["General", "tighten", "Stay within 45 units of the leader."],
    ["General", "kite", "Keep 330 range while firing."],
    ["General", "orbit", "Circle the nearest enemy at about 220 range."],
    ["General", "zigzag", "Add alternating lateral evasion to movement."],
    ["General", "seek-health", "Route toward the nearest health drop when damaged."],
    ["General", "seek-ammo", "Route toward the nearest ammo drop when low."],
    ["General", "seek-shield", "Route toward an available shield drop."],
    ["General", "seek-boost", "Route toward an overdrive drop."],
    ["General", "reload", "Reload a partial magazine when below half capacity."],
    ["General", "cooldown", "Hold fire above 40% heat until the weapon cools."],
    ["General", "reserve-fire", "Fire only in preferred range when ammo reserves are below 30."],
    ["General", "anti-air", "Prioritize flying enemies."],
    ["General", "avoid-danger", "Evade incoming projectiles and the volcanic crater."],
    ["General", "guard-point", "Hold the starting position and defend it."],
    ["Tank", "brace", "Take 20% less damage; move 35% slower."],
    ["Tank", "ram", "Deal 18 collision damage every 3 seconds within contact range."],
    ["Tank", "hull-down", "Seek cover at all health levels; armor improves near cover."],
    ["Tank", "armor-piercing", "Gain 25% penetration; fire 20% slower."],
    ["Tank", "smoke", "Create a 130-radius smoke screen for 3 seconds; 12-second cooldown, 20 energy."],
    ["Infantry", "sprint", "Move 30% faster; fire 25% slower."],
    ["Infantry", "ambush", "Deal 35% more damage while near cover."],
    ["Infantry", "suppress", "Hits add 15 weapon heat to the target."],
    ["Infantry", "grenade", "Throw a 30-damage grenade within 180 range; splash 65, cooldown 8 seconds, 15 energy."],
    ["Helicopter", "strafe", "Fly perpendicular attack passes around the enemy."],
    ["Helicopter", "hover", "Hold position with twice the aim accuracy."],
    ["Helicopter", "flare", "Reduce incoming rocket damage 60% while energy is available; cooldown 5 seconds."],
    ["Helicopter", "rocket-pod", "Add 40 splash and 15% damage; fire 40% slower."],
    ["Rocket", "lock-on", "Double accuracy, add 15% penetration, and require a longer target lock."],
    ["Rocket", "backblast", "Move backward after each rocket shot."],
    ["Rocket", "bunker-buster", "Gain 70 splash radius; deal double damage to buildings."],
    ["Artillery", "barrage", "Fire 40% faster at 70% shell damage."],
    ["Artillery", "siege", "Hold position and deal triple damage to buildings."],
    ["Artillery", "displace", "Move perpendicular to the target while reloading after a shot."],
    ["Sniper", "steady", "Stop moving and double aim accuracy."],
    ["Sniper", "headshot", "Gain 25 percentage points of critical chance against foot troops."],
    ["Sniper", "camouflage", "Halve radar signature until 2 seconds after firing."],
    ["Boat", "broadside", "Circle the target at naval firing range."],
    ["Boat", "depth-charge", "Deal 35 splash damage to nearby boats within 90 range; cooldown 8 seconds, 15 energy."],
    ["Medic", "triage", "Heal the most injured foot ally by 25 within 150 range; cooldown 6 seconds, 15 energy."],
    ["Medic", "field-hospital", "Stop and heal nearby allies 3 HP/second within 110 range; drain 4 energy/second."],
    ["Engineer", "repair", "Repair the most injured vehicle by 25 within 150 range; cooldown 6 seconds, 15 energy."],
    ["Engineer", "supply", "Give a low-ammo ally 25 reserve rounds within 140 range; cooldown 8 seconds, 10 energy."],
    ["Scout", "scan", "Boost nearby allies\u2019 radar 30% for 4 seconds; cooldown 8 seconds, 15 energy."],
    ["Scout", "mark", "Mark a target for 20% extra squad damage for 4 seconds; cooldown 8 seconds, 15 energy."]
  ].map(([group, name, description]) => ({ group, name, description }));
  const functionByName = new Map(squadFunctions.map((fn) => [fn.name, fn]));
  function groupType(group) {
    return { Tank: "tank", Infantry: "infantry", Helicopter: "helicopter", Rocket: "rocket", Artillery: "artillery", Sniper: "sniper", Boat: "boat", Medic: "medic", Engineer: "engineer", Scout: "scout" }[group];
  }
  function capacityFor(t) {
    return t.tier === 1 ? 3 : t.tier === 2 ? 5 : 7;
  }
  function conditionActive(t, c) {
    if (!c) return true;
    const value = c.stat === "hp" ? t.hp / t.maxHp : c.stat === "ammo" ? t.ammo / t.stats.mag : c.stat === "energy" ? t.energy / t.stats.energyCapacity : t.heat / t.stats.heatCapacity;
    return c.op === "below" ? value < c.value : value > c.value;
  }
  parseSquadScript = function(text) {
    if (orderCache.has(text)) return orderCache.get(text);
    if (typeof text !== "string" || text.length > 6001) return { leader: "tank-1", rules: [], errors: ["SquadScript is combined limit is 6001 characters."] };
    const rules = [], errors = [];
    let leader = "tank-1";
    const validSelector = (value) => value === "all" || Object.keys(unitTypes).some((type) => value === type || new RegExp("^" + type + "-[1-9][0-9]?$").test(value));
    for (const [i, raw] of text.split("\n").entries()) {
      let line = raw.trim().toLowerCase();
      if (!line || line.startsWith("#")) continue;
      let condition = null;
      const cm = line.match(/ when (hp|ammo|energy|heat) (below|above) ([0-9]{1,3})%$/);
      if (cm) {
        if (+cm[3] > 100) {
          errors.push("Line " + (i + 1) + ": percent must be 0\u2013100");
          continue;
        }
        condition = { stat: cm[1], op: cm[2], value: +cm[3] / 100 };
        line = line.slice(0, cm.index);
      }
      const words = line.split(/\s+/), selector = words.shift(), verb = words.shift(), arg = words.join(" ");
      let rule;
      if (selector === "leader" && verb && validSelector(verb) && verb !== "all" && verb.includes("-") && !arg && !condition) {
        leader = verb;
        continue;
      }
      if (!validSelector(selector)) {
        errors.push("Line " + (i + 1) + ": unknown unit selector");
        continue;
      }
      if (["follow", "protect", "flank"].includes(verb) && (arg === "leader" || validSelector(arg) && arg !== "all" && arg.includes("-"))) rule = { kind: "formation", mode: verb, anchor: arg };
      else if (verb === "focus" && ["nearest", "weakest", "leader"].includes(arg)) rule = { kind: "focus", value: arg };
      else if (verb === "hold" && /^\d{2,3}$/.test(arg) && +arg >= 100 && +arg <= 500) rule = { kind: "range", value: +arg };
      else if (verb === "stance" && ["rush", "balanced", "sniper"].includes(arg)) rule = { kind: "stance", value: arg };
      else if (verb === "retreat" && /^below [0-9]{1,2}%$/.test(arg)) rule = { kind: "retreat", value: clamp(parseInt(arg.slice(6)) / 100, 0.05, 0.8) };
      else if (functionByName.has(verb) && !arg) {
        const fn = functionByName.get(verb), type = groupType(fn.group);
        if (type && selector !== "all" && selector !== type && !selector.startsWith(type + "-")) {
          errors.push("Line " + (i + 1) + ": " + verb + " belongs to " + fn.group);
          continue;
        }
        rule = { kind: "ability:" + verb, name: verb, unitType: type || null };
      }
      if (rule) rules.push({ ...rule, selector, condition });
      else errors.push("Line " + (i + 1) + ": unknown function or arguments \u201C" + raw.trim() + "\u201D");
    }
    const parsed = { leader, rules, errors };
    if (orderCache.size > 100) orderCache.clear();
    orderCache.set(text, parsed);
    return parsed;
  };
  ordersFor = function(t) {
    const parsed = parseSquadScript(scriptFor(t)), name = callsign(t), result = {}, matching = parsed.rules.filter((r) => (r.selector === "all" || r.selector === t.type || r.selector === name) && (!r.unitType || r.unitType === t.type) && conditionActive(t, r.condition) && (r.kind !== "retreat" || t.tier >= 3));
    for (const rule of matching.slice(-capacityFor(t))) {
      if (rule.kind === "retreat" && t.tier < 3) continue;
      result[rule.kind] = rule;
    }
    return result;
  };
  const footTypes = /* @__PURE__ */ new Set(["infantry", "rocket", "sniper", "medic", "engineer"]);
  function activeFunction(t, name) {
    return !!t.activeFunctions?.includes(name);
  }
  function cooldownAbility(t, name, seconds, energy, act) {
    t.abilityTimers = t.abilityTimers || {};
    if (elapsed < (t.abilityTimers[name] || 0) || t.energy < energy) return false;
    if (act() === false) return false;
    t.energy -= energy;
    t.abilityTimers[name] = elapsed + seconds;
    sparks.push({ x: t.x, y: t.y, life: 0.4, color: "#73d8ff" });
    return true;
  }
  function nearestFoe(t) {
    return battleUnits.filter((u) => u.team !== t.team && u.hp > 0).sort((a2, b2) => Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y))[0];
  }
  function injuredAlly(t, foot, range) {
    return battleUnits.filter((u) => u.team === t.team && u.hp > 0 && u.hp < u.maxHp - 1 && (foot === null || footTypes.has(u.type) === foot) && Math.hypot(u.x - t.x, u.y - t.y) < range).sort((a2, b2) => a2.hp / a2.maxHp - b2.hp / b2.maxHp)[0];
  }
  function functionMotion(t, foe) {
    const leader = leaderFor(t), f = t.activeFunctions || [], dx = (foe?.x || t.x) - t.x, dy = (foe?.y || t.y) - t.y, [nx, ny] = norm(dx, dy);
    let motion = null;
    const toward = (x, y, stop = 25) => Math.hypot(x - t.x, y - t.y) > stop ? { mx: x - t.x, my: y - t.y, action: "Executing squad function" } : { mx: 0, my: 0, action: "Holding assigned position" };
    for (const fn of f) {
      if (["stop", "hover", "steady", "siege", "field-hospital"].includes(fn)) motion = { mx: 0, my: 0, action: fn };
      if (fn === "advance" && foe) motion = { mx: nx, my: ny, action: "Advancing" };
      if (fn === "withdraw" && foe) motion = { mx: -nx, my: -ny, action: "Withdrawing" };
      if (fn === "guard-point") motion = toward(t.homeX, t.homeY);
      if (fn === "patrol") motion = toward(t.homeX + Math.cos(t.phase * 0.25) * 180, t.homeY + Math.sin(t.phase * 0.25) * 180);
      if (["rally", "tighten"].includes(fn) && leader && leader !== t) motion = toward(leader.x, leader.y, fn === "tighten" ? 45 : 60);
      if (fn === "spread") {
        const close = battleUnits.find((a2) => a2 !== t && a2.team === t.team && a2.hp > 0 && Math.hypot(a2.x - t.x, a2.y - t.y) < 90);
        if (close) motion = { mx: t.x - close.x, my: t.y - close.y, action: "Spreading out" };
      }
      if (["orbit", "strafe", "broadside", "displace"].includes(fn) && foe && (fn !== "displace" || t.cooldown > 0.3)) {
        const range = fn === "broadside" ? 340 : fn === "strafe" ? 180 : 220, d = Math.hypot(dx, dy), advance = d > range + 35 ? 0.8 : d < range - 35 ? -0.8 : 0;
        motion = { mx: nx * advance - ny, my: ny * advance + nx, action: fn };
      }
      if (fn === "backblast" && foe && t.cooldown > t.stats.reload * 0.65) motion = { mx: -nx, my: -ny, action: "Clearing backblast" };
      if (fn.startsWith("seek-")) {
        const kind = { "seek-health": "health", "seek-ammo": "ammo", "seek-shield": "shield", "seek-boost": "overdrive" }[fn], drop = pickups.filter((p) => !p.used && p.kind === kind && pickupUseful(t, p)).sort((a2, b2) => Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y))[0];
        if (drop) motion = toward(drop.x, drop.y, 0);
      }
      if (fn === "avoid-danger") {
        const shot = shots.find((s) => s.team !== t.team && Math.hypot(s.x - t.x, s.y - t.y) < 90);
        if (shot) motion = { mx: -shot.vy, my: shot.vx, action: "Avoiding incoming fire" };
        if (campaign.map === "volcanic" && Math.hypot(t.x - W * 0.5, t.y - H * 0.22) < 150) motion = { mx: t.x - W * 0.5, my: t.y - H * 0.22, action: "Leaving hazard" };
      }
    }
    if (motion && Math.hypot(motion.mx, motion.my) > 0.01 && activeFunction(t, "zigzag") && foe) {
      motion.mx -= ny * Math.sin(t.phase * 6) * 0.7;
      motion.my += nx * Math.sin(t.phase * 6) * 0.7;
    }
    if (motion && !t.stats.flying && Math.hypot(motion.mx, motion.my) > 1 && lineBlocked(t.x, t.y, t.x + motion.mx, t.y + motion.my)) {
      if (elapsed >= (t.functionRouteAt || 0)) {
        t.functionRoute = pathStep(t, { x: clamp(t.x + motion.mx, 30, W - 30), y: clamp(t.y + motion.my, 30, H - 30) });
        t.functionRouteAt = elapsed + 0.6;
      }
      if (t.functionRoute) motion = { ...motion, mx: t.functionRoute[0] - t.x, my: t.functionRoute[1] - t.y };
    }
    t.suppressEvasion = !!motion && Math.hypot(motion.mx, motion.my) < 0.01;
    return motion;
  }
  const previousFormation = formationVector;
  formationVector = function(t, foe) {
    return functionMotion(t, foe) || previousFormation(t, foe);
  };
  const previousAiMovement = aiMovement;
  aiMovement = function(t, foe) {
    return functionMotion(t, foe) || previousAiMovement(t, foe);
  };
  const previousTarget = chooseTarget;
  chooseTarget = function(t) {
    if (activeFunction(t, "anti-air")) {
      const air = battleUnits.filter((u) => u.team !== t.team && u.hp > 0 && u.stats.flying && Math.hypot(u.x - t.x, u.y - t.y) < t.stats.radarRange).sort((a2, b2) => a2.hp - b2.hp)[0];
      if (air) return air;
    }
    return previousTarget(t);
  };
  const tickBeforeFunctions = squadTick;
  squadTick = function(t, dt) {
    if (t.hp <= 0) return;
    t.baseStats = t.baseStats || { ...t.stats };
    t.stats = { ...t.baseStats };
    t.basePlan = t.basePlan || { ...t.plan };
    t.plan = { ...t.basePlan };
    const orders = ordersFor(t);
    t.activeFunctions = Object.values(orders).filter((r) => r.name).map((r) => r.name);
    const s = t.stats, foe = t.target?.hp > 0 ? t.target : nearestFoe(t);
    t.functionFireHold = false;
    t.suppressEvasion = false;
    if (orders.range) t.plan.preferred = orders.range.value;
    if (orders.stance) {
      t.plan.style = orders.stance.value;
      if (!orders.range && !t.plan.modelApplied) t.plan.preferred = orders.stance.value === "rush" ? 145 : orders.stance.value === "sniper" ? 360 : s.range;
    }
    if (orders.retreat) {
      t.plan.retreat = true;
      t.plan.retreatBelow = orders.retreat.value;
    }
    for (const fn of t.activeFunctions) {
      switch (fn) {
        case "scan-fast":
          s.scanInterval *= 0.5;
          break;
        case "seek-cover":
          t.plan.cover = true;
          t.plan.coverBelow = 1;
          break;
        case "leave-cover":
          t.plan.cover = false;
          break;
        case "take-knee":
          s.accuracy *= 1.5;
          break;
        case "kite":
          t.plan.preferred = 330;
          break;
        case "zigzag":
          t.plan.evade = true;
          break;
        case "reload":
          if (t.ammo < s.mag / 2 && t.reloading <= 0 && t.reserve > 0) t.reloading = (s.mag - t.ammo) / s.loadingSpeed + s.reloadDelay;
          break;
        case "cooldown":
          t.functionFireHold = t.heat > s.heatCapacity * 0.4;
          break;
        case "reserve-fire":
          if (t.reserve < 30) t.plan.firePolicy = "inRange";
          break;
        case "brace":
          s.speed *= 0.65;
          s.damageResistance = 1 - (1 - s.damageResistance) * 0.8;
          break;
        case "hull-down":
          t.plan.cover = true;
          t.plan.coverBelow = 1;
          if (nearRock(t)) s.armor = Math.min(0.8, s.armor + 0.15);
          break;
        case "armor-piercing":
          s.penetration += 0.25;
          s.reload *= 1.2;
          break;
        case "sprint":
          s.speed *= 1.3;
          s.reload *= 1.25;
          break;
        case "ambush":
          if (nearRock(t)) s.damage *= 1.35;
          break;
        case "hover":
        case "steady":
          s.accuracy *= 2;
          break;
        case "rocket-pod":
          s.explosionRadius += 40;
          s.damage *= 1.15;
          s.reload *= 1.4;
          break;
        case "lock-on":
          s.accuracy *= 2;
          s.penetration += 0.15;
          s.targetLockTime = 0.4;
          break;
        case "bunker-buster":
          s.explosionRadius += 70;
          break;
        case "barrage":
          s.reload *= 0.6;
          s.damage *= 0.7;
          break;
        case "headshot":
          if (foe && footTypes.has(foe.type)) s.critChance += 0.25;
          break;
        case "camouflage":
          if (elapsed - (t.lastFiredAt ?? -10) > 2) s.stealthSignature *= 0.5;
          break;
        case "ram":
          if (foe && Math.hypot(foe.x - t.x, foe.y - t.y) < t.r + foe.r + 8) cooldownAbility(t, fn, 3, 0, () => takeHit(foe, { damage: 18, penetration: 0.3, owner: t.id, team: t.team, sourceType: t.type }));
          break;
        case "smoke":
          cooldownAbility(t, fn, 12, 20, () => {
            for (const a2 of battleUnits) if (a2.hp > 0 && a2.team !== t.team && Math.hypot(a2.x - t.x, a2.y - t.y) < 130) a2.smokedUntil = elapsed + 3;
          });
          break;
        case "grenade":
        case "depth-charge": {
          const target = fn === "depth-charge" ? battleUnits.filter((u) => u.hp > 0 && u.team !== t.team && u.stats.water && Math.hypot(u.x - t.x, u.y - t.y) < 90).sort((a2, b2) => Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y))[0] : foe;
          if (target && Math.hypot(target.x - t.x, target.y - t.y) < (fn === "grenade" ? 180 : 90)) cooldownAbility(t, fn, 8, 15, () => {
            for (const u of battleUnits) if (u.hp > 0 && u.team !== t.team && (fn !== "depth-charge" || u.stats.water) && Math.hypot(u.x - target.x, u.y - target.y) < (fn === "grenade" ? 65 : 90)) takeHit(u, { damage: fn === "grenade" ? 30 : 35, penetration: 0.05, owner: t.id, team: t.team, sourceType: t.type });
          });
          break;
        }
        case "triage":
        case "repair": {
          const a2 = injuredAlly(t, fn === "triage", 150);
          if (a2) cooldownAbility(t, fn, 6, 15, () => {
            a2.hp = Math.min(a2.maxHp, a2.hp + 25);
          });
          break;
        }
        case "field-hospital":
          if (t.energy > 4 * dt) {
            const patients = battleUnits.filter((a2) => a2.team === t.team && a2.hp > 0 && a2.hp < a2.maxHp && Math.hypot(a2.x - t.x, a2.y - t.y) < 110);
            if (patients.length) {
              for (const a2 of patients) a2.hp = Math.min(a2.maxHp, a2.hp + 3 * dt);
              t.energy -= 4 * dt;
            }
          }
          break;
        case "supply": {
          const a2 = battleUnits.find((a3) => a3.team === t.team && a3.hp > 0 && a3.reserve < 60 && Math.hypot(a3.x - t.x, a3.y - t.y) < 140);
          if (a2) cooldownAbility(t, fn, 8, 10, () => a2.reserve = Math.min(250, a2.reserve + 25));
          break;
        }
        case "scan":
          cooldownAbility(t, fn, 8, 15, () => {
            for (const a2 of battleUnits) if (a2.hp > 0 && a2.team === t.team && Math.hypot(a2.x - t.x, a2.y - t.y) < 300) a2.scanBoostUntil = elapsed + 4;
          });
          break;
        case "mark":
          if (foe && Math.hypot(foe.x - t.x, foe.y - t.y) < s.radarRange) cooldownAbility(t, fn, 8, 15, () => {
            foe.markedUntil = elapsed + 4;
            foe.markedBy = t.team;
          });
          break;
      }
    }
    if (t.scanBoostUntil > elapsed) s.radarRange *= 1.3;
    if (t.smokedUntil > elapsed) s.accuracy *= 0.6;
    if (activeFunction(t, "reload") && t.reloading > 0 && t.ammo > 0) {
      t.reserve += t.ammo;
      t.ammo = 0;
    }
    autonomousTick(t, dt);
  };
  const fireBeforeFunctions = squadFire;
  squadFire = function(t, target) {
    if (t.functionFireHold) return;
    fireBeforeFunctions(t, target);
    t.lastFiredAt = elapsed;
    const shot = shots.at(-1);
    if (shot) {
      shot.suppress = activeFunction(t, "suppress");
      shot.buildingMultiplier = activeFunction(t, "siege") ? 3 : activeFunction(t, "bunker-buster") ? 2 : 1;
    }
  };
  const hitBeforeFunctions = takeHit;
  takeHit = function(t, shot, scale = 1) {
    if (t.markedUntil > elapsed && t.markedBy === shot.team) scale *= 1.2;
    if (activeFunction(t, "flare") && shot.sourceType === "rocket" && cooldownAbility(t, "flare", 5, 10, () => true)) scale *= 0.4;
    hitBeforeFunctions(t, shot, scale);
    if (shot.suppress && t.hp > 0) t.heat = Math.min(t.stats.heatCapacity, t.heat + 15);
  };
  const buildingBeforeFunctions = damageBuilding;
  damageBuilding = function(b2, shot) {
    buildingBeforeFunctions(b2, { ...shot, damage: shot.damage * (shot.buildingMultiplier || 1) });
  };
  const spawnBeforeFunctions = spawnCombat;
  spawnCombat = function(u, team, index, count) {
    const t = spawnBeforeFunctions(u, team, index, count);
    t.homeX = t.x;
    t.homeY = t.y;
    if (t.aiControlled) {
      t.stats = { ...t.stats, damage: t.stats.damage * 0.8 };
      const special = { medic: "triage", engineer: "repair", scout: "mark", helicopter: "strafe", tank: "brace", infantry: "suppress", rocket: "lock-on", artillery: "displace", sniper: "steady", boat: "broadside" }[u.type];
      t.squadScript = "leader tank-1\nall focus nearest\n" + (special ? u.type + " " + special : "all advance");
    }
    t.baseStats = { ...t.stats };
    return t;
  };
  function pickupUseful(t, p) {
    if (p.kind === "health") return t.hp < t.maxHp - 5;
    if (p.kind === "ammo") return t.reserve < t.stats.ammoReserve || t.ammo < t.stats.mag / 2;
    if (p.kind === "shield") return t.shield < 30;
    return !(t.powerTime > 0);
  }
  collectPickup = function(t, p) {
    if (p.used || !pickupUseful(t, p)) return;
    p.used = true;
    let effect = "";
    if (p.kind === "health") {
      const healed = Math.min(50, t.maxHp - t.hp);
      t.hp += healed;
      effect = "+" + Math.round(healed) + " HP";
    }
    if (p.kind === "ammo") {
      t.reserve = Math.min(250, t.reserve + 40);
      t.ammo = t.stats.mag;
      t.reloading = 0;
      effect = "+40 ammo \xB7 magazine refilled";
    }
    if (p.kind === "overdrive") {
      t.powerTime = 10;
      effect = "Overdrive \xB7 10s speed/fire boost";
    }
    if (p.kind === "shield") {
      t.shield = Math.max(t.shield, 40);
      effect = "+40 shield";
    }
    t.pickupEffect = effect;
    t.pickupEffectUntil = elapsed + 4;
    sparks.push({ x: t.x, y: t.y, life: 0.8, color: p.kind === "health" ? "#69f6a6" : "#72caff" });
    if (t.team === "player") message(callsign(t) + " collected " + effect);
  };
  let autoRestart = false, autoRestartTimer = null;
  try {
    autoRestart = localStorage.getItem("tank-auto-restart") === "true";
  } catch {
  }
  $("autoRestart").checked = autoRestart;
  $("autoRestart").onchange = () => {
    autoRestart = $("autoRestart").checked;
    try {
      localStorage.setItem("tank-auto-restart", String(autoRestart));
    } catch {
    }
    if (!autoRestart && autoRestartTimer) clearTimeout(autoRestartTimer);
  };
  const finishBeforeRetry = finish;
  finish = function(win) {
    finishBeforeRetry(win);
    if (!win && autoRestart && !replaying && !onlinePlaying && mode === "lost" && campaign.lives > 0) {
      const retryRound = round;
      message("Retrying Round " + round + " in 3 seconds \xB7 " + campaign.lives + " lives left");
      autoRestartTimer = setTimeout(() => {
        if (autoRestart && mode === "lost" && round === retryRound && campaign.lives > 0 && !onlinePlaying && !compiling) deploy();
      }, 3e3);
    }
  };
  const deployBeforeUnlock = deploy;
  deploy = function() {
    if (roster.some((u) => u.deployed !== false && round < (unitUnlocks[u.type] || 1))) {
      $("message").textContent = "Bench locked units first. Helicopters unlock at Round 6; the function guide lists other unlocks.";
      return;
    }
    deployBeforeUnlock();
  };
  $("deploy").onclick = () => deploy();
  function renderFunctionGuide() {
    const root = $("functionGuide");
    root.replaceChildren();
    const intro = document.createElement("p");
    intro.textContent = "SquadScript 2: selector function [when hp|ammo|energy|heat below|above N%]. One order per line. All, a type, or callsign selects units. \u2605 executes the latest 3 matching active orders; \u2605\u2605 5; \u2605\u2605\u2605 7. Unsupported lines are rejected. Local AI drafts scripts; review and Apply before deploying.";
    root.append(intro);
    const legacy = document.createElement("p");
    legacy.textContent = "General core: leader tank-1; all follow leader; infantry protect leader; helicopter flank leader; all focus nearest|weakest|leader; all hold 100\u2013500; all stance rush|balanced|sniper; all retreat below 25% (\u2605\u2605\u2605). Later matching settings override earlier ones. # starts a comment.";
    root.append(legacy);
    for (const group of ["General", ...Object.keys(unitTypes).map((type) => squadFunctions.find((f) => groupType(f.group) === type)?.group).filter(Boolean)]) {
      const details = document.createElement("details"), summary = document.createElement("summary");
      summary.textContent = group === "General" ? "General" : unitTypes[groupType(group)].name + " \xB7 Round " + unitUnlocks[groupType(group)];
      details.append(summary);
      for (const fn of squadFunctions.filter((f) => f.group === group)) {
        const p = document.createElement("p");
        p.textContent = (group === "General" ? "all" : groupType(group)) + " " + fn.name + " \u2014 " + fn.description;
        details.append(p);
      }
      root.append(details);
    }
  }
  $("functionHelp").onclick = () => {
    renderFunctionGuide();
    $("functionDialog").showModal();
  };
  $("closeFunctions").onclick = () => $("functionDialog").close();
  const PythonUnit2 = /* @__PURE__ */ (() => {
    const cache = /* @__PURE__ */ new Map();
    function expression(source) {
      const tokens = [];
      let i = 0;
      while (i < source.length) {
        if (/\s/.test(source[i])) {
          i++;
          continue;
        }
        const part = source.slice(i), m = part.match(/^(?:\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?|"[^"\\]*"|'[^'\\]*'|==|!=|<=|>=|[<>+*/%(),-])/);
        if (!m) throw Error("Unsupported expression near " + part);
        tokens.push(m[0]);
        i += m[0].length;
      }
      let at = 0;
      const precedence = { or: 1, and: 2, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };
      function atom() {
        const token2 = tokens[at++];
        if (!token2) throw Error("Expected a value");
        if (token2 === "not" || token2 === "-") return { op: token2 === "not" ? "not" : "neg", value: token2 === "not" ? parse(3) : atom() };
        if (token2 === "(") {
          const value = parse(0);
          if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
          return value;
        }
        if (/^\d/.test(token2)) return { literal: Number(token2) };
        if (/^['"]/.test(token2)) return { literal: token2.slice(1, -1) };
        if (token2 === "True" || token2 === "False") return { literal: token2 === "True" };
        if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/.test(token2) || token2.includes("__")) throw Error("Unsupported value " + token2);
        if (tokens[at] === "(") {
          at++;
          const args = [];
          if (tokens[at] !== ")") do {
            args.push(parse(0));
            if (tokens[at] !== ",") break;
            at++;
          } while (true);
          if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
          return { call: token2, args };
        }
        return { name: token2 };
      }
      function parse(min) {
        let left = atom();
        while (precedence[tokens[at]] >= min) {
          if (precedence[tokens[at]] === 3) {
            const values = [left], operators = [];
            do {
              operators.push(tokens[at++]);
              values.push(parse(4));
            } while (precedence[tokens[at]] === 3);
            left = { chain: values, operators };
          } else {
            const op = tokens[at++], right = parse(precedence[op] + 1);
            left = { op, left, right };
          }
        }
        return left;
      }
      const tree = parse(0);
      if (at !== tokens.length) throw Error("Unexpected expression token");
      return tree;
    }
    function compile(text, methods2, sensors2, queries2) {
      if (cache.has(text)) return cache.get(text);
      const errors = [], body = [], names2 = /* @__PURE__ */ new Set(), calls = [];
      try {
        let checkLiteralArgs = function(name, args) {
          const types2 = ["tank", "infantry", "rocket", "scout", "sniper", "medic", "artillery", "engineer", "helicopter", "boat"], enums = { focus: ["nearest", "weakest", "leader"], stance: ["balanced", "rush", "sniper"], "unit.is_type": types2, "squad.has_type": types2, "squad.count_type": types2, "unit.map_is": ["urban", "canyon", "volcanic", "coast"] }, strings = /* @__PURE__ */ new Set(["focus", "stance", "follow", "protect", "flank", "unit.distance_to", "unit.ally_health", "unit.ally_alive", "unit.ability_ready", "unit.map_is", "unit.is_type", "squad.has_type", "squad.count_type"]);
          for (const arg of args) {
            if (!Object.hasOwn(arg, "literal")) continue;
            const value2 = arg.literal;
            if (strings.has(name)) {
              if (typeof value2 !== "string") throw Error(name + " requires a string argument");
              if (enums[name] && !enums[name].includes(value2)) throw Error(name + " accepts " + enums[name].join(", "));
              if (["follow", "protect", "flank", "unit.distance_to", "unit.ally_health", "unit.ally_alive"].includes(name) && !(["follow", "protect", "flank"].includes(name) && value2 === "leader" || new RegExp("^(" + types2.join("|") + ")-[1-9][0-9]?$").test(value2))) throw Error(name + " needs a valid callsign");
              if (name === "unit.ability_ready" && !methods2.has(value2)) throw Error("Unknown ability " + value2);
            } else if (typeof value2 !== "number" || !Number.isFinite(value2)) throw Error(name + " requires a numeric argument");
          }
        }, checkExpr = function(tree) {
          if (tree.chain) for (const value2 of tree.chain) checkExpr(value2);
          if (tree.name) {
            if (tree.name.includes(".")) {
              if (!sensors2.has(tree.name)) throw Error("Unknown read-only sensor " + tree.name);
            } else if (!names2.has(tree.name)) throw Error("Unknown local variable " + tree.name);
          }
          if (tree.call) {
            if (!queries2.has(tree.call)) throw Error("Unknown sensor function " + tree.call);
            const zero = /* @__PURE__ */ new Set(["unit.health_drop_distance", "unit.ammo_drop_distance", "unit.shield_drop_distance", "unit.boost_drop_distance", "unit.nearest_cover_distance", "unit.enemy_shield", "unit.enemy_health", "unit.has_ammo", "unit.can_fire"]);
            const expected = zero.has(tree.call) ? 0 : 1;
            if (tree.args.length !== expected) throw Error(tree.call + " needs " + expected + " arguments");
            checkLiteralArgs(tree.call, tree.args);
            for (const a2 of tree.args) checkExpr(a2);
          }
          if (tree.value) checkExpr(tree.value);
          if (tree.left) checkExpr(tree.left);
          if (tree.right) checkExpr(tree.right);
        }, value = function(source) {
          const ast = expression(source);
          checkExpr(ast);
          return ast;
        }, block = function(indent, depth) {
          if (depth > 6) throw Error("Maximum condition nesting is six");
          const result2 = [];
          while (cursor < lines.length && lines[cursor].indent >= indent) {
            const line = lines[cursor];
            if (line.indent !== indent) throw Error("Use four-space indentation at line " + line.line);
            cursor++;
            if (line.text === "return") {
              result2.push({ kind: "return" });
              continue;
            }
            if (line.text === "pass") {
              result2.push({ kind: "pass" });
              continue;
            }
            const condition = line.text.match(/^if (.+):$/);
            if (condition) {
              const branches = [{ test: value(condition[1]), body: block(indent + 4, depth + 1) }];
              if (!branches[0].body.length) throw Error("An if block needs a body");
              while (cursor < lines.length && lines[cursor].indent === indent && /^elif |^else:/.test(lines[cursor].text)) {
                const next = lines[cursor++], elif = next.text.match(/^elif (.+):$/);
                if (!elif && next.text !== "else:") throw Error("Invalid else");
                branches.push({ test: elif ? value(elif[1]) : null, body: block(indent + 4, depth + 1) });
                if (!branches.at(-1).body.length) throw Error("Empty condition block");
                if (!elif) break;
              }
              result2.push({ kind: "if", branches });
              continue;
            }
            const assignment = line.text.match(/^([a-z][a-z0-9_]*) = (.+)$/);
            if (assignment) {
              if (["unit", "squad"].includes(assignment[1]) || assignment[1].includes("__")) throw Error("Cannot replace game objects");
              const ast2 = value(assignment[2]);
              names2.add(assignment[1]);
              result2.push({ kind: "assign", name: assignment[1], value: ast2 });
              continue;
            }
            const action = line.text.match(/^unit\.([a-z][a-z0-9_]*)\((.*)\)$/);
            if (!action || !methods2.has(action[1])) throw Error("Unknown action at line " + line.line + ": " + line.text);
            const ast = expression("unit." + action[1] + "(" + action[2] + ")");
            const count = action[1] === "move_to" ? 2 : ["hold_range", "focus", "follow", "protect", "flank", "stance", "retreat_below"].includes(action[1]) ? 1 : 0;
            if (ast.args.length !== count) throw Error(action[1] + " needs " + count + " arguments");
            checkLiteralArgs(action[1], ast.args);
            for (const a2 of ast.args) checkExpr(a2);
            calls.push(action[1]);
            result2.push({ kind: "action", method: action[1], args: ast.args });
          }
          return result2;
        };
        if (typeof text !== "string" || text.length > 3e3) throw Error("Python scripts are limited to 3000 characters");
        const lines = text.split("\n").map((raw, i) => {
          if (raw.includes("	")) throw Error("Use spaces, not tabs (line " + (i + 1) + ")");
          const clean = raw.replace(/\s+#.*$/, "").trimEnd();
          return { indent: clean.length - clean.trimStart().length, text: clean.trim(), line: i + 1 };
        }).filter((l) => l.text && !l.text.startsWith("#"));
        if (lines.length > 120) throw Error("Limit: 120 nonempty lines");
        if (lines[0]?.text !== "def tick(unit, squad):" || lines[0].indent !== 0) throw Error("Begin with def tick(unit, squad):");
        let cursor = 1;
        body.push(...block(4, 0));
        if (cursor !== lines.length) throw Error("Only tick() is allowed at the top level");
        if (!calls.length) throw Error("Include at least one unit action");
      } catch (e) {
        errors.push(e.message);
      }
      const result = { body, errors, calls };
      if (cache.size > 200) cache.clear();
      cache.set(text, result);
      return result;
    }
    function execute(program, env, query, action) {
      const locals = /* @__PURE__ */ Object.create(null);
      let budget = 240;
      function read(ast) {
        if (--budget < 0) throw Error("Script instruction budget exceeded");
        if (Object.hasOwn(ast, "literal")) return ast.literal;
        if (ast.name) return ast.name.includes(".") ? env[ast.name] : locals[ast.name];
        if (ast.call) return query(ast.call, ast.args.map(read));
        if (ast.chain) {
          let a3 = read(ast.chain[0]);
          for (let i = 0; i < ast.operators.length; i++) {
            const b3 = read(ast.chain[i + 1]), op = ast.operators[i], valid = op === "==" ? a3 === b3 : op === "!=" ? a3 !== b3 : op === "<" ? a3 < b3 : op === ">" ? a3 > b3 : op === "<=" ? a3 <= b3 : a3 >= b3;
            if (!valid) return false;
            a3 = b3;
          }
          return true;
        }
        if (ast.op === "not") return !read(ast.value);
        if (ast.op === "neg") return -read(ast.value);
        const a2 = read(ast.left);
        if (ast.op === "and") return a2 && read(ast.right);
        if (ast.op === "or") return a2 || read(ast.right);
        const b2 = read(ast.right);
        switch (ast.op) {
          case "==":
            return a2 === b2;
          case "!=":
            return a2 !== b2;
          case "<":
            return a2 < b2;
          case ">":
            return a2 > b2;
          case "<=":
            return a2 <= b2;
          case ">=":
            return a2 >= b2;
          case "+":
            return Number(a2) + Number(b2);
          case "-":
            return a2 - b2;
          case "*":
            return a2 * b2;
          case "/":
            return b2 ? a2 / b2 : 0;
          case "%":
            return b2 ? a2 % b2 : 0;
        }
      }
      function block(body) {
        for (const node of body) {
          if (--budget < 0) throw Error("Script instruction budget exceeded");
          if (node.kind === "return") return true;
          if (node.kind === "assign") locals[node.name] = read(node.value);
          if (node.kind === "action") action(node.method, node.args.map(read));
          if (node.kind === "if") {
            for (const branch of node.branches) if (branch.test === null || read(branch.test)) {
              if (block(branch.body)) return true;
              break;
            }
          }
        }
        return false;
      }
      block(program.body);
    }
    return { compile, execute };
  })();
  const extraPythonActions = [
    ["General", "focus-air", "Target the nearest aircraft."],
    ["General", "focus-ground", "Target the nearest ground enemy."],
    ["General", "focus-armor", "Prioritize tanks, artillery, scout cars and boats."],
    ["General", "focus-support", "Prioritize medics and engineers."],
    ["General", "focus-farthest", "Select the farthest enemy within radar."],
    ["General", "focus-low-shield", "Select the enemy with the least shield."],
    ["General", "focus-high-damage", "Select the enemy with the highest weapon damage."],
    ["General", "focus-unmarked", "Prefer enemies not already marked by your squad."],
    ["General", "hold-fire", "Do not shoot until another branch allows firing."],
    ["General", "fire-at-will", "Use the normal firing policy."],
    ["General", "seek-cover", "Seek building cover at any health level."],
    ["General", "leave-cover", "Disable automatic cover seeking."],
    ["General", "retreat-to-spawn", "Move toward the original spawn point."],
    ["General", "scan-fast", "Scan twice as often."],
    ["General", "repair-self", "Repair 8 HP: 15-second cooldown and 30 energy."],
    ["General", "boost", "Boost movement 15% for 2 seconds: 10-second cooldown, 20 energy."],
    ["General", "vent-heat", "Remove 35 heat: 8-second cooldown, 15 energy."],
    ["General", "shield-pulse", "Add 15 shield up to 60: 12-second cooldown, 25 energy."],
    ["Infantry", "take-knee", "Stop and improve aim accuracy by 50%."],
    ["Helicopter", "breakaway", "Withdraw from the current enemy."],
    ["Artillery", "counter-battery", "Prioritize enemy artillery."],
    ["Boat", "shore-bombard", "Prioritize land enemies."],
    ["Scout", "recon-route", "Patrol a wider 260-unit route."],
    ["Rocket", "save-rockets", "Hold fire against foot troops."],
    ["Medic", "follow-patient", "Approach the most injured foot ally."],
    ["Engineer", "follow-vehicle", "Approach the most injured vehicle."],
    ["Sniper", "relocate", "Move sideways after a shot."],
    ["Tank", "cover-infantry", "Approach injured foot allies to screen them."]
  ];
  for (const [group, name, description] of extraPythonActions) {
    const fn = { group, name, description };
    squadFunctions.push(fn);
    functionByName.set(name, fn);
  }
  const pythonCore = /* @__PURE__ */ new Set(["hold_range", "focus", "follow", "protect", "flank", "stance", "retreat_below", "move_to"]);
  const pythonMethods = /* @__PURE__ */ new Set([...pythonCore, ...squadFunctions.map((f) => f.name.replaceAll("-", "_"))]);
  const pythonSensors = /* @__PURE__ */ new Set(["unit.hp_ratio", "unit.ammo_ratio", "unit.energy_ratio", "unit.heat_ratio", "unit.kind", "unit.tier", "unit.callsign", "unit.x", "unit.y", "unit.shield", "unit.reserve_ammo", "unit.reloading", "unit.enemy_distance", "unit.enemy_kind", "unit.has_enemy", "unit.in_cover", "unit.moving", "unit.cooldown", "squad.ally_count", "squad.enemy_count", "squad.leader_alive", "squad.lowest_ally_hp", "squad.elapsed", "squad.map"]);
  const pythonQueries = /* @__PURE__ */ new Set(["unit.distance_to", "unit.ally_health", "unit.ally_alive", "unit.enemies_within", "unit.allies_within", "unit.air_enemies_within", "unit.armored_enemies_within", "unit.foot_enemies_within", "unit.health_drop_distance", "unit.ammo_drop_distance", "unit.shield_drop_distance", "unit.boost_drop_distance", "unit.nearest_cover_distance", "unit.enemy_shield", "unit.enemy_health", "unit.incoming_shots", "unit.has_ammo", "unit.can_fire", "unit.can_afford", "unit.ability_ready", "unit.map_is", "unit.is_type", "squad.has_type", "squad.count_type", "squad.injured_allies"]);
  const legacyScriptParser = parseSquadScript, legacyOrders = ordersFor;
  function compilePython(text) {
    return PythonUnit2.compile(text, pythonMethods, pythonSensors, pythonQueries);
  }
  parseSquadScript = function(text) {
    if (/^\s*def tick/.test(text)) {
      const p = compilePython(text);
      return { leader: "tank-1", rules: p.calls.map((name) => ({ name })), errors: p.errors };
    }
    return legacyScriptParser(text);
  };
  function pythonFromLegacy(text, type = "tank") {
    if (/^\s*def tick/.test(text)) return text;
    const p = legacyScriptParser(text || ""), lines = ["def tick(unit, squad):"];
    for (const r of p.rules) {
      let action = r.name ? r.name.replaceAll("-", "_") + "()" : r.kind === "range" ? "hold_range(" + r.value + ")" : r.kind === "focus" ? 'focus("' + r.value + '")' : r.kind === "stance" ? 'stance("' + r.value + '")' : r.kind === "retreat" ? "retreat_below(" + r.value + ")" : r.kind === "formation" ? r.mode + '("' + r.anchor + '")' : null;
      if (!action) continue;
      const conditions = [];
      if (r.selector !== "all") {
        conditions.push(r.selector.includes("-") ? 'unit.callsign == "' + r.selector + '"' : 'unit.kind == "' + r.selector + '"');
      }
      if (r.condition) conditions.push("unit." + r.condition.stat + "_ratio " + (r.condition.op === "below" ? "<" : ">") + " " + r.condition.value);
      if (conditions.length) {
        lines.push("    if " + conditions.join(" and ") + ":");
        lines.push("        unit." + action);
      } else lines.push("    unit." + action);
    }
    return lines.length > 1 ? lines.join("\n") : 'def tick(unit, squad):\n    unit.focus("nearest")\n    unit.hold_range(' + unitTypes[type].range + ")";
  }
  basicScript = function(type) {
    return 'def tick(unit, squad):\n    unit.focus("nearest")\n    unit.hold_range(' + unitTypes[type].range + ")";
  };
  for (const u of roster) if (u.unitScript) u.unitScript = pythonFromLegacy(u.unitScript, u.type);
  if (campaign.orders) campaign.orders = pythonFromLegacy(campaign.orders);
  function pythonEnvironment(t) {
    const foe = t.target?.hp > 0 ? t.target : nearestFoe(t), allies = battleUnits.filter((u) => u.team === t.team && u.hp > 0), enemies = battleUnits.filter((u) => u.team !== t.team && u.hp > 0);
    return { foe, allies, enemies, values: { "unit.hp_ratio": t.hp / t.maxHp, "unit.ammo_ratio": t.ammo / t.stats.mag, "unit.energy_ratio": t.energy / t.stats.energyCapacity, "unit.heat_ratio": t.heat / t.stats.heatCapacity, "unit.kind": t.type, "unit.tier": t.tier, "unit.callsign": callsign(t), "unit.x": t.x, "unit.y": t.y, "unit.shield": t.shield, "unit.reserve_ammo": t.reserve, "unit.reloading": t.reloading > 0, "unit.enemy_distance": foe ? Math.hypot(foe.x - t.x, foe.y - t.y) : 99999, "unit.enemy_kind": foe?.type || "none", "unit.has_enemy": !!foe, "unit.in_cover": nearRock(t), "unit.moving": t.velocity > 1, "unit.cooldown": t.cooldown, "squad.ally_count": allies.length, "squad.enemy_count": enemies.length, "squad.leader_alive": allies.some((u) => u.type === "tank"), "squad.lowest_ally_hp": Math.min(...allies.map((u) => u.hp / u.maxHp), 1), "squad.elapsed": elapsed, "squad.map": campaign.map } };
  }
  function pythonQuery(t, context, name, args) {
    const a2 = args[0], distance = (u) => Math.hypot(u.x - t.x, u.y - t.y), ally = context.allies.find((u) => callsign(u) === a2), range = Number.isFinite(a2) ? clamp(a2, 0, 1e3) : 300;
    switch (name) {
      case "unit.distance_to":
        return ally ? distance(ally) : 99999;
      case "unit.ally_health":
        return ally ? ally.hp / ally.maxHp : 0;
      case "unit.ally_alive":
        return !!ally;
      case "unit.enemies_within":
        return context.enemies.filter((u) => distance(u) < range).length;
      case "unit.allies_within":
        return context.allies.filter((u) => u !== t && distance(u) < range).length;
      case "unit.air_enemies_within":
        return context.enemies.filter((u) => u.stats.flying && distance(u) < range).length;
      case "unit.armored_enemies_within":
        return context.enemies.filter((u) => !footTypes.has(u.type) && distance(u) < range).length;
      case "unit.foot_enemies_within":
        return context.enemies.filter((u) => footTypes.has(u.type) && distance(u) < range).length;
      case "unit.nearest_cover_distance":
        return Math.min(99999, ...rocks.map((r) => Math.hypot(r.x + r.w / 2 - t.x, r.y + r.h / 2 - t.y)));
      case "unit.enemy_shield":
        return context.foe?.shield || 0;
      case "unit.enemy_health":
        return context.foe ? context.foe.hp / context.foe.maxHp : 0;
      case "unit.incoming_shots":
        return shots.filter((s) => s.team !== t.team && Math.hypot(s.x - t.x, s.y - t.y) < range).length;
      case "unit.has_ammo":
        return t.ammo > 0 || t.reserve > 0;
      case "unit.can_fire":
        return t.ammo > 0 && t.cooldown <= 0 && t.reloading <= 0 && t.heat < t.stats.heatCapacity;
      case "unit.can_afford":
        return t.energy >= Math.max(0, Number(a2) || 0);
      case "unit.ability_ready":
        return elapsed >= (t.abilityTimers?.[String(a2).replaceAll("_", "-")] || 0);
      case "unit.map_is":
        return campaign.map === a2;
      case "unit.is_type":
        return t.type === a2;
      case "squad.has_type":
        return context.allies.some((u) => u.type === a2);
      case "squad.count_type":
        return context.allies.filter((u) => u.type === a2).length;
      case "squad.injured_allies":
        return context.allies.filter((u) => u.hp / u.maxHp < (Number(a2) || 0.5)).length;
      default: {
        const kind = { "unit.health_drop_distance": "health", "unit.ammo_drop_distance": "ammo", "unit.shield_drop_distance": "shield", "unit.boost_drop_distance": "overdrive" }[name];
        return Math.min(99999, ...pickups.filter((p) => !p.used && p.kind === kind).map(distance));
      }
    }
  }
  function pythonRules(t, text) {
    const program = compilePython(text);
    if (program.errors.length) return [];
    const context = pythonEnvironment(t), rules = [];
    PythonUnit2.execute(program, context.values, (name, args) => pythonQuery(t, context, name, args), (method, args) => {
      let rule;
      const value = args[0];
      if (method === "hold_range" && Number.isFinite(value)) rule = { kind: "range", value: clamp(value, 100, 500) };
      else if (method === "focus" && ["nearest", "weakest", "leader"].includes(value)) rule = { kind: "focus", value };
      else if (method === "stance" && ["balanced", "rush", "sniper"].includes(value)) rule = { kind: "stance", value };
      else if (["follow", "protect", "flank"].includes(method) && typeof value === "string" && /^(leader|[a-z]+-[1-9][0-9]?)$/.test(value)) rule = { kind: "formation", mode: method, anchor: value };
      else if (method === "retreat_below" && t.tier >= 3 && Number.isFinite(value)) rule = { kind: "retreat", value: clamp(value, 0.05, 0.8) };
      else if (method === "move_to" && args.length === 2 && args.every(Number.isFinite)) rule = { kind: "ability:move-to", name: "move-to", point: { x: clamp(args[0], 30, W - 30), y: clamp(args[1], 30, H - 30) } };
      else {
        const fn = functionByName.get(method.replaceAll("_", "-"));
        if (fn && (!groupType(fn.group) || groupType(fn.group) === t.type)) rule = { kind: fn.name.startsWith("focus-") || ["counter-battery", "shore-bombard"].includes(fn.name) ? "focus" : ["seek-cover", "leave-cover"].includes(fn.name) ? "cover-policy" : ["hold-fire", "fire-at-will"].includes(fn.name) ? "fire-policy" : "ability:" + fn.name, name: fn.name };
      }
      if (rule) rules.push(rule);
    });
    return rules;
  }
  ordersFor = function(t) {
    if (t.squadScript && !/^\s*def tick/.test(t.squadScript) && t.squadScript !== t.unitScript) return legacyOrders(t);
    const own = t.unitScript || scriptFor(t);
    if (!/^\s*def tick/.test(own)) return legacyOrders(t);
    try {
      const rules = [...pythonRules(t, own), ...t.squadPython ? pythonRules(t, t.squadPython) : []], result = {};
      for (const rule of rules.slice(-capacityFor(t))) result[rule.kind] = rule;
      return result;
    } catch (e) {
      t.scriptError = e.message;
      return {};
    }
  };
  const pythonMotion = functionMotion;
  functionMotion = function(t, foe) {
    let motion = pythonMotion(t, foe);
    const f = t.activeFunctions || [], toward = (a2) => a2 ? { mx: a2.x - t.x, my: a2.y - t.y, action: "Following assigned ally" } : null;
    for (const name of f) {
      if (["take-knee"].includes(name)) motion = { mx: 0, my: 0, action: "Taking a knee" };
      if (["breakaway", "retreat-to-spawn"].includes(name)) motion = name === "retreat-to-spawn" ? toward({ x: t.homeX, y: t.homeY }) : foe ? { mx: t.x - foe.x, my: t.y - foe.y, action: "Breaking away" } : motion;
      if (["follow-patient", "cover-infantry", "follow-vehicle"].includes(name)) {
        const patient = injuredAlly(t, name !== "follow-vehicle", 1500);
        if (patient && Math.hypot(patient.x - t.x, patient.y - t.y) > 80) motion = toward(patient);
      }
      if (name === "move-to") motion = toward(ordersFor(t)["ability:move-to"]?.point);
      if (name === "recon-route") motion = toward({ x: t.homeX + Math.cos(t.phase * 0.25) * 260, y: t.homeY + Math.sin(t.phase * 0.25) * 260 });
      if (name === "relocate" && foe && t.cooldown > 0.4) motion = { mx: -(foe.y - t.y), my: foe.x - t.x, action: "Relocating after shot" };
    }
    t.suppressEvasion = !!motion && Math.hypot(motion.mx, motion.my) < 0.01;
    return motion;
  };
  const pythonTarget = chooseTarget;
  chooseTarget = function(t) {
    const functions = t.activeFunctions || [];
    let foes = battleUnits.filter((u) => u.hp > 0 && u.team !== t.team && Math.hypot(u.x - t.x, u.y - t.y) < t.stats.radarRange);
    for (const name of functions) {
      const filter = { "focus-air": (u) => u.stats.flying, "focus-ground": (u) => !u.stats.flying, "focus-armor": (u) => !footTypes.has(u.type), "focus-support": (u) => ["medic", "engineer"].includes(u.type), "counter-battery": (u) => u.type === "artillery", "shore-bombard": (u) => !u.stats.water, "focus-unmarked": (u) => !(u.markedUntil > elapsed) }[name];
      if (filter) {
        const selected = foes.filter(filter);
        if (selected.length) foes = selected;
      }
    }
    if (functions.some((n) => n.startsWith("focus-") || ["counter-battery", "shore-bombard"].includes(n)) && foes.length) {
      if (functions.includes("focus-low-shield")) foes.sort((a2, b2) => a2.shield - b2.shield);
      else if (functions.includes("focus-high-damage")) foes.sort((a2, b2) => b2.stats.damage - a2.stats.damage);
      else foes.sort((a2, b2) => (Math.hypot(a2.x - t.x, a2.y - t.y) - Math.hypot(b2.x - t.x, b2.y - t.y)) * (functions.includes("focus-farthest") ? -1 : 1));
      return foes[0];
    }
    return pythonTarget(t);
  };
  const pythonTick = squadTick;
  squadTick = function(t, dt) {
    pythonTick(t, dt);
    if (t.hp <= 0) return;
    for (const name of t.activeFunctions || []) {
      if (name === "hold-fire" || name === "save-rockets" && t.target && footTypes.has(t.target.type)) t.functionFireHold = true;
      if (name === "repair-self" && t.hp < t.maxHp - 8) cooldownAbility(t, name, 15, 30, () => {
        t.hp = Math.min(t.maxHp, t.hp + 8);
      });
      if (name === "boost" && t.boostTime <= 0) cooldownAbility(t, name, 10, 20, () => {
        t.boostTime = 2;
      });
      if (name === "vent-heat" && t.heat > 35) cooldownAbility(t, name, 8, 15, () => {
        t.heat -= 35;
      });
      if (name === "shield-pulse" && t.shield < 60) cooldownAbility(t, name, 12, 25, () => {
        t.shield = Math.min(60, t.shield + 15);
      });
    }
  };
  const pythonFire = squadFire;
  squadFire = function(t, target) {
    if (activeFunction(t, "hold-fire") || activeFunction(t, "save-rockets") && footTypes.has(target.type)) return;
    pythonFire(t, target);
  };
  function basicScript(type) {
    return "all focus nearest\nall hold " + unitTypes[type].range;
  }
  const makeIndependentUnit = newUnit2;
  newUnit2 = function(type, tier = 1) {
    const u = makeIndependentUnit(type, tier);
    return { ...u, name: unitTypes[type].name, unitScript: basicScript(type), skin: "olive", upgrades: {} };
  };
  if (!campaign.scriptWorkshop) {
    for (const u of roster) {
      u.unitScript = basicScript(u.type);
      u.name = u.name || unitTypes[u.type].name;
      u.skin = u.skin || campaign.skin || "olive";
      u.upgrades = {};
      delete u.squadScript;
    }
    campaign.orders = "";
    campaign.scriptWorkshop = true;
  }
  for (const u of roster) {
    u.unitScript = typeof u.unitScript === "string" && !parseSquadScript(u.unitScript).errors.length ? u.unitScript : basicScript(u.type);
    u.name = String(u.name || unitTypes[u.type].name).slice(0, 28);
    u.skin = u.skin || "olive";
    u.upgrades = u.upgrades || {};
  }
  campaign.orders = typeof campaign.orders === "string" && !parseSquadScript(campaign.orders).errors.length ? campaign.orders : "";
  squadScript = campaign.orders;
  $("prompt").value = squadScript;
  compiledPlan = null;
  compiledText = "";
  nextBuff = null;
  activeBuff = null;
  saveProgram = function() {
    campaign.orders = $("prompt").value;
    if (campaign.orders && !/^def tick/.test(campaign.orders)) {
      campaign.orders = pythonFromLegacy(campaign.orders);
      $("prompt").value = campaign.orders;
    }
    squadScript = campaign.orders;
    for (const u of roster) {
      u.commands = unlocked(u);
      u.compiled = null;
      u.compiledText = "";
      u.instruction = u.unitScript || basicScript(u.type);
      delete u.squadScript;
    }
    saveRoster();
  };
  scriptFor = function(t) {
    return t.squadScript || t.unitScript || basicScript(t.type);
  };
  planForUnit = function(u) {
    return { style: "balanced", preferred: unitStats(u).range, cover: false, coverBelow: 0.5, evade: false, retreat: false, retreatBelow: 0.25, firePolicy: "always" };
  };
  const independentSpawn = spawnCombat;
  spawnCombat = function(u, team, index, count) {
    const t = independentSpawn(u, team, index, count);
    t.name = u.name || unitTypes[u.type].name;
    t.skin = u.skin || "olive";
    const npcScript = t.squadScript;
    t.unitScript = u.unitScript || basicScript(u.type);
    if (!t.aiControlled) t.squadScript = t.unitScript;
    t.squadPython = u.squadPython ?? campaign.orders;
    if (t.aiControlled) {
      t.unitScript = pythonFromLegacy(npcScript, u.type);
      t.squadPython = "";
    }
    t.basePlan = planForUnit(u);
    t.plan = { ...t.basePlan };
    return t;
  };
  activateUnit = function(id) {
    if (mode === "running" || mode === "won") return;
    selectedId = id;
    commands = new Set(unlocked(selectedUnit()));
    saveRoster();
    resetPositions();
    preview();
    renderRoster();
  };
  preview = function() {
    plan = planForUnit(selectedUnit());
    const p = parseSquadScript(campaign.orders);
    $("planPreview").textContent = p.errors.join(" \xB7 ") || "Independent unit scripts" + (p.rules.length ? " \xB7 " + p.rules.length + " squad orders" : " \xB7 No squad coordination");
    updateProgramLive("Ready");
    renderStats();
  };
  const workshopDeploy = deploy;
  deploy = function() {
    if (mode === "running" || mode === "won") return;
    for (const u of roster.filter((u2) => u2.deployed !== false)) {
      const p = parseSquadScript(u.unitScript || basicScript(u.type));
      if (p.errors.length) {
        $("message").textContent = u.name + ": " + p.errors.join(" \xB7 ");
        return;
      }
    }
    compiledPlan = null;
    compiling = false;
    nextBuff = null;
    activeBuff = null;
    workshopDeploy();
  };
  $("deploy").onclick = () => deploy();
  generateRewardTactics = async () => {
  };
  const permanentKinds = ["armor", "speed", "damage", "loading", "shield", "demolition", "repair", "critical"];
  const permanentNames = ["Armor training", "Engine tuning", "Weapon calibration", "Loader tuning", "Shield capacity", "Demolition training", "Field repair", "Critical targeting"];
  const permanentEffects = ["+1% damage resistance", "+2% movement speed", "+2% weapon damage", "+2.5% ammo loading speed", "+3 shield capacity", "+3 splash radius", "+0.03 HP/sec repair", "+0.5% critical chance"];
  rewardOptions.splice(0, rewardOptions.length, ...permanentKinds.map((kind, i) => ({ kind, buff: permanentNames[i], instruction: permanentNames[i], effect: permanentEffects[i] + " permanently for the chosen unit" })));
  const statsBeforePermanent = unitStats;
  unitStats = function(u = selectedUnit()) {
    const s = statsBeforePermanent(u), b2 = u.upgrades || {}, n = (k) => Math.max(0, Math.min(20, Number(b2[k]) || 0));
    return { ...s, damage: s.damage * (1 + 0.02 * n("damage")), speed: s.speed * (1 + 0.02 * n("speed")), damageResistance: Math.min(0.6, s.damageResistance + 0.01 * n("armor")), loadingSpeed: s.loadingSpeed * (1 + 0.025 * n("loading")), shieldCapacity: s.shieldCapacity + 3 * n("shield"), explosionRadius: s.explosionRadius + 3 * n("demolition"), repairRate: s.repairRate + 0.03 * n("repair"), critChance: Math.min(0.8, s.critChance + 5e-3 * n("critical")) };
  };
  const recruitReward = chooseReward;
  chooseReward = function(option) {
    if (option.unitType) return recruitReward(option);
    if (mode !== "won" || !levelReward || levelReward.tactic || !levelReward.tacticOptions.includes(option)) return;
    const u = roster.find((u2) => u2.id === levelReward.upgradeTarget) || selectedUnit();
    u.upgrades = u.upgrades || {};
    if ((u.upgrades[option.kind] || 0) >= 20) economy.credits += 30;
    else u.upgrades[option.kind] = (u.upgrades[option.kind] || 0) + 1;
    levelReward.tactic = option;
    saveRoster();
    renderLevelRewards();
    updateBuffStatus();
  };
  const rewardLayout = renderLevelRewards;
  renderLevelRewards = function() {
    rewardLayout();
    if (!levelReward.tactic) {
      const label = document.createElement("label");
      label.textContent = "Upgrade unit (maxed upgrades grant 30 credits): ";
      const select = document.createElement("select");
      for (const u of roster) {
        const o = document.createElement("option");
        o.value = u.id;
        o.textContent = u.name;
        select.append(o);
      }
      select.value = levelReward.upgradeTarget || selectedId;
      select.onchange = () => {
        levelReward.upgradeTarget = select.value;
      };
      label.append(select);
      $("rewards").append(label);
    }
    const headings = $("rewards").querySelectorAll?.("h3");
    if (headings?.[1]) headings[1].textContent = levelReward.tactic ? "\u2713 Permanent upgrade claimed" : "2 / Permanent upgrade for " + selectedUnit().name;
  };
  updateBuffStatus = function() {
    $("buffStatus").textContent = "Permanent upgrades \xB7 " + Object.values(selectedUnit()?.upgrades || {}).reduce((a2, b2) => a2 + b2, 0);
    renderStats();
  };
  renderStats = function() {
    const u = selectedUnit(), live = mode === "running" ? battleUnits.find((t) => t.id === u.id) : null, s = live?.stats || unitStats(u), p = live?.plan || planForUnit(u), root = $("statList");
    root.replaceChildren();
    for (const [label, value] of [["Unit", u.name + " \xB7 " + unitTypes[u.type].name], ["Stars", "\u2605".repeat(u.tier)], ["Health", Math.round(live?.hp ?? s.hp) + " / " + s.hp], ["Damage", s.damage.toFixed(1)], ["Speed", s.speed.toFixed(1)], ["Preferred range", p.preferred], ["Magazine", (live?.ammo ?? s.mag) + " / " + s.mag], ["Ammo loading", s.loadingSpeed.toFixed(2) + " rounds/sec"], ["Shot interval", s.reload.toFixed(2) + " sec"], ["Crit chance", (s.critChance * 100).toFixed(1) + "%"], ["Armor", (s.armor * 100).toFixed(1) + "%"], ["Resistance", (s.damageResistance * 100).toFixed(1) + "%"], ["Shield", s.shieldCapacity], ["Repair", s.repairRate.toFixed(2) + " HP/sec"], ["Radar", s.radarRange], ["Command slots", capacityFor(u)], ["Crit multiplier", s.critMultiplier], ["Penetration", s.penetration], ["Projectile speed", s.projectileSpeed], ["Explosion radius", s.explosionRadius], ["Splash falloff", s.splashFalloff], ["Accuracy", s.accuracy.toFixed(1)], ["Reload delay", s.reloadDelay], ["Ammo reserve", s.ammoReserve], ["Heat capacity", s.heatCapacity], ["Heat per shot", s.heatPerShot], ["Cooling rate", s.coolingRate], ["Shield recharge", s.shieldRecharge], ["Impact resistance", s.impactResistance], ["Acceleration", s.acceleration], ["Braking", s.braking], ["Hull turn rate", s.turnRate], ["Turret turn rate", s.turretTurnRate], ["Reverse speed", s.reverseSpeed], ["Terrain traction", s.terrainTraction], ["Scan interval", s.scanInterval], ["Target lock time", s.targetLockTime], ["Energy capacity", s.energyCapacity], ["Energy regeneration", s.energyRegeneration]]) {
      const cell = document.createElement("div"), a2 = document.createElement("small"), b2 = document.createElement("b");
      cell.className = "stat-cell";
      a2.textContent = label;
      b2.textContent = String(value);
      cell.append(a2, b2);
      root.append(cell);
    }
  };
  function workshopChoices() {
    const select = $("scriptTarget");
    select.replaceChildren();
    for (const [id, label] of [["squad", "Squad coordination (optional)"], ...roster.map((u) => [u.id, u.name + " \xB7 " + unitTypes[u.type].name])]) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = label;
      select.append(o);
    }
    select.value = selectedId;
    loadScriptTarget();
  }
  function loadScriptTarget() {
    const u = roster.find((u2) => u2.id === $("scriptTarget").value);
    $("pasteScript").value = u ? u.unitScript : campaign.orders;
    $("scriptFeedback").textContent = u ? "Only " + u.name + " executes this script. Use unit methods to address this unit." : "Squad orders apply after unit scripts and consume the same 3 / 5 / 7 command slots.";
  }
  $("scriptsButton").onclick = () => {
    workshopChoices();
    $("scriptsDialog").showModal();
  };
  $("scriptTarget").onchange = loadScriptTarget;
  $("closeScripts").onclick = () => $("scriptsDialog").close();
  $("saveScript").onclick = () => {
    if (mode === "running" || mode === "won") return;
    const text = $("pasteScript").value.trim();
    if (text.length > 3e3) {
      $("scriptFeedback").textContent = "Limit: 3000 characters.";
      return;
    }
    const parsed = parseSquadScript(text), u = roster.find((u2) => u2.id === $("scriptTarget").value);
    if (text && !/^def tick\(unit, squad\):/.test(text)) {
      $("scriptFeedback").textContent = "Paste a Python def tick(unit, squad): script.";
      return;
    }
    if (parsed.errors.length || u && !parsed.rules.length) {
      $("scriptFeedback").textContent = parsed.errors.join(" \xB7 ") || "A unit needs at least one order.";
      return;
    }
    if (u) {
      u.unitScript = text;
      u.instruction = text;
    } else {
      campaign.orders = text;
      squadScript = text;
      $("prompt").value = text;
    }
    saveRoster();
    resetPositions();
    preview();
    $("scriptFeedback").textContent = "Saved. Ready to deploy.";
  };
  $("restoreScript").onclick = () => {
    const u = roster.find((u2) => u2.id === $("scriptTarget").value);
    $("pasteScript").value = u ? basicScript(u.type) : "";
  };
  const combining = combineUnits;
  combineUnits = function(type, tier) {
    const source = roster.find((u) => u.type === type && u.tier === tier && u.id === selectedId) || roster.find((u) => u.type === type && u.tier === tier);
    if (!source) return;
    const ids = new Set(roster.map((u) => u.id)), identity = { name: source.name, skin: source.skin, unitScript: source.unitScript, upgrades: { ...source.upgrades } };
    combining(type, tier);
    const up = roster.find((u) => !ids.has(u.id));
    if (up) {
      Object.assign(up, identity);
      saveRoster();
      resetPositions();
      renderRoster();
    }
  };
  renderRoster = function() {
    const root = $("rosterGrid");
    root.replaceChildren();
    $("activeUnitLabel").textContent = roster.filter((u) => u.deployed !== false).length + " deployed \xB7 " + economy.credits + " credits \xB7 " + campaign.lives + " lives";
    for (const u of roster) {
      const card = document.createElement("div");
      card.className = "unit-card" + (u.id === selectedId ? " active" : "");
      const title = document.createElement("h3");
      title.textContent = u.name;
      const detail = document.createElement("p");
      detail.textContent = unitTypes[u.type].name + " \xB7 " + "\u2605".repeat(u.tier) + " \xB7 " + unitStats(u).hp + " HP \xB7 " + capacityFor(u) + " orders";
      card.append(title, detail);
      for (const [label, act, disabled] of [["Select", () => activateUnit(u.id), false], [u.deployed === false ? "Deploy" : "Bench", () => {
        u.deployed = u.deployed === false;
        saveRoster();
        resetPositions();
        renderRoster();
      }, false], ["Combine 3", () => combineUnits(u.type, u.tier), u.tier >= 3 || roster.filter((a2) => a2.type === u.type && a2.tier === u.tier).length < 3]]) {
        const b2 = document.createElement("button");
        b2.className = "tiny";
        b2.textContent = label;
        b2.disabled = disabled || mode === "running" || mode === "won";
        b2.onclick = act;
        card.append(b2);
      }
      root.append(card);
    }
  };
  const originalArmory = renderLoadout;
  renderLoadout = function() {
    originalArmory();
    $("renameUnit").value = selectedUnit().name;
    const panel = $("cosmeticsPanel");
    panel.replaceChildren();
    const info = document.createElement("p");
    info.textContent = campaign.cosmeticCoins + " tokens \xB7 Paint for " + selectedUnit().name;
    panel.append(info);
    for (const skin of ["olive", "arctic", "sunset", "neon"]) {
      const b2 = document.createElement("button");
      b2.className = "tiny";
      const owned = campaign.skins.includes(skin);
      b2.textContent = (selectedUnit().skin === skin ? "\u2713 " : "") + skin + (owned ? "" : " \xB7 3 tokens");
      b2.disabled = mode === "running" || mode === "won" || !owned && campaign.cosmeticCoins < 3;
      b2.onclick = () => {
        if (mode === "running" || mode === "won") return;
        if (!owned) {
          campaign.cosmeticCoins -= 3;
          campaign.skins.push(skin);
        }
        selectedUnit().skin = skin;
        saveRoster();
        resetPositions();
        renderLoadout();
      };
      panel.append(b2);
    }
    const retire = document.createElement("button");
    retire.className = "tiny";
    retire.textContent = "Retire unit \xB7 " + Math.min(5, selectedUnit().wins || 0) + " tokens";
    retire.disabled = roster.length <= 1 || mode === "running" || mode === "won";
    retire.onclick = retireUnit;
    panel.append(retire);
  };
  $("renameButton").onclick = () => {
    if (mode === "running" || mode === "won") return;
    const name = $("renameUnit").value.trim().slice(0, 28);
    if (!name) return;
    selectedUnit().name = name;
    saveRoster();
    resetPositions();
    renderLoadout();
    renderRoster();
  };
  const storeBeforeCatalog = renderStore;
  renderStore = function() {
    storeBeforeCatalog();
    const root = $("storeCatalog");
    root.replaceChildren();
    for (const item of [...availableTypes().map((type) => ({ name: "Recruit " + unitTypes[type].name, price: 110 + Object.keys(unitTypes).indexOf(type) * 15, act: () => {
      if (roster.length < economy.slots) roster.push(newUnit2(type));
      else economy.reserve[type] = (economy.reserve[type] || 0) + 1;
    } })), ...gearItems.filter((g) => !campaign.gear.includes(g.id)).map((g) => ({ name: g.name + " \xB7 " + g.slot, price: g.price, act: () => campaign.gear.push(g.id) }))]) {
      const b2 = document.createElement("button");
      b2.className = "reward";
      b2.textContent = item.name + " \xB7 " + item.price + " credits";
      b2.disabled = economy.credits < item.price || mode === "running";
      b2.onclick = () => {
        if (mode === "running" || economy.credits < item.price) return;
        economy.credits -= item.price;
        item.act();
        saveRoster();
        renderStore();
        renderRoster();
        resetPositions();
      };
      root.append(b2);
    }
  };
  const importing = safeImportedUnits;
  safeImportedUnits = function(data) {
    const units = importing(data);
    for (let i = 0; i < units.length; i++) {
      const original = data.units[i], u = units[i];
      const text = original.unitScript || original.instruction;
      if (typeof text === "string") {
        const migrated = pythonFromLegacy(text, u.type);
        if (!compilePython(migrated).errors.length) u.unitScript = migrated;
      }
      ;
      u.name = String(original.name || u.name).slice(0, 28);
      u.skin = ["olive", "arctic", "sunset", "neon"].includes(original.skin) ? original.skin : "olive";
      u.upgrades = {};
      for (const kind of permanentKinds) u.upgrades[kind] = Math.max(0, Math.min(20, Math.floor(Number(original.upgrades?.[kind]) || 0)));
    }
    return units;
  };
  const freshReset = resetRun;
  resetRun = function() {
    freshReset();
    campaign.orders = "";
    squadScript = "";
    $("prompt").value = "";
    saveRoster();
    resetPositions();
    preview();
    renderRoster();
    updateBuffStatus();
  };
  $("reset").onclick = () => resetRun();
  matchSquad = function() {
    saveProgram();
    return roster.filter((u) => u.deployed !== false && (!unitTypes[u.type].water || campaign.map === "coast")).map((u) => ({ ...u, instruction: u.unitScript, squadScript: u.unitScript, squadPython: campaign.orders, compiled: null }));
  };
  let publicProfile = null;
  try {
    publicProfile = JSON.parse(localStorage.getItem("tank-online-profile-v1"));
  } catch {
  }
  async function onlineAction(path, extra = {}) {
    const response = await fetch("/api/matches/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: publicProfile, name: $("commanderName").value.trim() || "Commander", map: campaign.map, ...extra }), signal: AbortSignal.timeout(15e3) }), data = await response.json();
    if (data.profile) {
      publicProfile = data.profile;
      localStorage.setItem("tank-online-profile-v1", JSON.stringify(publicProfile));
    }
    if (!response.ok || data.error) throw Error(data.error);
    return data;
  }
  $("publishDefense").onclick = async () => {
    try {
      $("multiplayerMessage").textContent = "Publishing defense\u2026";
      const data = await onlineAction("profile");
      $("multiplayerMessage").textContent = "Defense saved \xB7 Squad strength " + data.power + " \xB7 Other players can attack while you are offline.";
    } catch (e) {
      $("multiplayerMessage").textContent = e.message;
    }
  };
  $("randomAttack").onclick = async () => {
    if (mode === "running" || mode === "won") return;
    try {
      $("randomAttack").disabled = true;
      const data = await onlineAction("random");
      if (data.status === "empty") {
        $("multiplayerMessage").textContent = "Defense saved. No player near your strength has published a defense on this map yet.";
        return;
      }
      onlineSession = data;
      localStorage.setItem("tank-match-v1", JSON.stringify(data));
      await pollMatch();
    } catch (e) {
      $("multiplayerMessage").textContent = e.message;
    } finally {
      $("randomAttack").disabled = false;
    }
  };
  $("leaderboardButton").onclick = async () => {
    $("leaderboardDialog").showModal();
    $("leaderboardRows").textContent = "Loading\u2026";
    try {
      const response = await fetch("/api/matches/leaderboard"), data = await response.json();
      if (!response.ok || data.error) throw Error(data.error);
      const root = $("leaderboardRows");
      root.replaceChildren();
      for (const [i, row] of data.players.entries()) {
        const p = document.createElement("p");
        p.textContent = i + 1 + ". " + row.name + " \xB7 " + (row.points || 0) + " points \xB7 " + row.wins + " wins / " + row.losses + " losses \xB7 Strength " + row.power;
        root.append(p);
      }
      if (!data.players.length) root.textContent = "No published defenses yet. Publish yours in Multiplayer.";
    } catch (e) {
      $("leaderboardRows").textContent = e.message;
    }
  };
  $("closeLeaderboard").onclick = () => $("leaderboardDialog").close();
  $("menuButton").onclick = () => $("menuDialog").showModal();
  $("closeMenu").onclick = () => $("menuDialog").close();
  for (const b2 of $("menuDialog").querySelectorAll?.("[data-open]") || []) b2.addEventListener("click", () => $("menuDialog").close());
  const filteredStore = renderStore;
  renderStore = function() {
    filteredStore();
    const category = $("shopFilter").value;
    for (const b2 of $("storeCatalog").children) b2.hidden = category !== "all" && !!category && !b2.textContent.toLowerCase().includes(category === "recruit" ? "recruit" : category);
  };
  $("shopFilter").onchange = renderStore;
  const filteredArmory = renderLoadout;
  renderLoadout = function() {
    filteredArmory();
    const category = $("armoryFilter").value;
    for (const c of $("gearCatalog").children) c.hidden = category !== "all" && !!category && !c.textContent.toLowerCase().includes(category);
  };
  $("armoryFilter").onchange = renderLoadout;
  matchAction = async function(action) {
    if (mode === "running" || mode === "won") return;
    try {
      const data = await onlineAction(action, { code: $("matchCode").value.trim().toUpperCase() });
      onlineSession = data;
      localStorage.setItem("tank-match-v1", JSON.stringify(data));
      $("matchCode").value = data.code;
      await pollMatch();
    } catch (e) {
      $("multiplayerMessage").textContent = e.message;
    }
  };
  $("cancelInvite").onclick = async () => {
    try {
      await onlineAction("cancel", { code: $("matchCode").value.trim().toUpperCase() });
      onlineSession = null;
      localStorage.removeItem("tank-match-v1");
      $("multiplayerMessage").textContent = "Waiting invite cancelled.";
    } catch (e) {
      $("multiplayerMessage").textContent = e.message;
    }
  };
  async function renderOnlineShop(item, edits) {
    try {
      const data = await onlineAction(item ? "shop" : "profile", { ...item ? { item } : {}, ...edits || {} });
      $("onlineBalance").textContent = data.account.credits + " verified credits \xB7 " + data.account.roster.length + " / " + data.account.slots + " slots \xB7 Level " + data.level;
      const root = $("onlineShop");
      root.replaceChildren();
      for (const u of data.account.roster) {
        const card = document.createElement("details");
        card.className = "unit-card";
        const h = document.createElement("summary");
        h.textContent = u.name + " \xB7 " + "\u2605".repeat(u.tier) + " \xB7 Script & equipment";
        const editor = document.createElement("textarea");
        editor.value = u.unitScript;
        editor.setAttribute("aria-label", "Python script for " + u.name);
        const save2 = document.createElement("button");
        save2.textContent = "Save online script";
        save2.onclick = () => renderOnlineShop(null, { scripts: [{ id: u.id, unitScript: editor.value }] });
        card.append(h, editor, save2);
        for (const gear of data.account.gear) {
          const b2 = document.createElement("button");
          b2.textContent = "Equip " + gear;
          b2.onclick = () => renderOnlineShop("equip:" + u.id + ":" + gear);
          card.append(b2);
        }
        if (data.account.roster.filter((v) => v.type === u.type && v.tier === u.tier).length >= 3 && u.tier < 3) {
          const b2 = document.createElement("button");
          b2.textContent = "Combine 3";
          b2.onclick = () => renderOnlineShop("combine:" + u.type + ":" + u.tier);
          card.append(b2);
        }
        root.append(card);
      }
      const squad = document.createElement("textarea");
      squad.value = data.account.squadScript || "";
      squad.setAttribute("aria-label", "Online squad Python script");
      const save = document.createElement("button");
      save.textContent = "Save online squad script";
      save.onclick = () => renderOnlineShop(null, { squadScript: squad.value });
      root.append(squad, save);
      for (const offer of data.catalog) {
        const b2 = document.createElement("button");
        b2.className = "reward";
        b2.textContent = (gearItems.find((g) => "gear:" + g.id === offer.id)?.name || offer.name) + " \xB7 " + offer.price + " credits";
        b2.disabled = offer.price > data.account.credits;
        b2.onclick = () => renderOnlineShop(offer.id);
        root.append(b2);
      }
    } catch (e) {
      $("onlineBalance").textContent = e.message;
    }
  }
  $("loadOnlineShop").onclick = () => renderOnlineShop();
  saveProgram();
  let inFieldBase = false, lastBattleReport = null, coachDraft = null, coachRequest = null, coachGeneration = 0, coachAttemptedReport = null;
  if (!campaign.depotVersion) {
    for (const b2 of campaign.base || []) economy.credits += (baseTypes[b2.kind]?.price || 0) + 70 * (b2.tier - 1) * b2.tier / 2;
    campaign.base = [];
    campaign.depotVersion = 1;
    saveRoster();
  }
  function depotUpgradePrice(u, kind) {
    return 80 + 20 * (u.upgrades?.[kind] || 0);
  }
  function depotCombine(unit) {
    if (mode === "running" || compiling) return;
    const target = levelReward?.upgradeTarget === unit.id;
    depotEdit(() => combineUnits(unit.type, unit.tier));
    if (target && levelReward) levelReward.upgradeTarget = selectedId;
    renderBase();
  }
  function depotChooseUnit(id) {
    if (!roster.some((u) => u.id === id)) return;
    selectedId = id;
    saveRoster();
    if (mode !== "won") resetPositions();
    preview();
    renderBase();
  }
  function buyDepotUpgrade(kind) {
    if (mode === "running" || compiling || !permanentKinds.includes(kind)) return;
    const u = selectedUnit(), n = u.upgrades?.[kind] || 0;
    const free = mode === "won" && levelReward?.unit && !levelReward.tactic && levelReward.tacticOptions.some((o) => o.kind === kind);
    if (n >= 20 && !free) return;
    if (free) {
      levelReward.upgradeTarget = u.id;
      chooseReward(levelReward.tacticOptions.find((o) => o.kind === kind));
      depotCompleteRewards();
    } else {
      const cost = depotUpgradePrice(u, kind);
      if (economy.credits < cost) return;
      economy.credits -= cost;
      u.upgrades = u.upgrades || {};
      u.upgrades[kind] = n + 1;
      saveRoster();
      if (mode !== "won") resetPositions();
      preview();
    }
    renderBase();
    $("depotMessage").textContent = permanentNames[permanentKinds.indexOf(kind)] + " applied to " + u.name + ".";
  }
  renderBase = function() {
    const u = selectedUnit(), root = $("depotUnits");
    root.replaceChildren();
    $("depotBalance").textContent = economy.credits + " credits \xB7 Round " + round + " \xB7 " + roster.length + "/" + economy.slots + " squad slots";
    for (const unit of roster) {
      const card = document.createElement("div");
      card.className = "depot-unit" + (unit.id === selectedId ? " active" : "");
      const name = document.createElement("button");
      name.className = "unit-name";
      name.textContent = unit.name;
      name.onclick = (e) => showUnitTooltip(unit, e?.clientX || 16, e?.clientY || 120, true);
      const p = document.createElement("p");
      p.textContent = unitTypes[unit.type].name + " \xB7 " + "\u2605".repeat(unit.tier) + " \xB7 " + capacityFor(unit) + " order slots";
      const select = document.createElement("button");
      select.className = "primary";
      select.textContent = unit.id === selectedId ? "Selected" : "Select to upgrade";
      select.disabled = mode === "running";
      select.onclick = () => depotChooseUnit(unit.id);
      const combine = document.createElement("button");
      combine.textContent = "Combine 3 \xB7 upgrade stars";
      combine.disabled = unit.tier >= 3 || roster.filter((x) => x.type === unit.type && x.tier === unit.tier).length < 3 || mode === "running" || compiling;
      combine.onclick = () => {
        depotChooseUnit(unit.id);
        depotCombine(unit);
      };
      card.append(name, p, select, combine);
      attachUnitTooltip(card, unit);
      root.append(card);
    }
    $("depotUpgradeTitle").textContent = "Train " + u.name;
    const pending = mode === "won" && levelReward?.unit && !levelReward.tactic;
    $("depotRewardNote").textContent = pending ? "Choose one highlighted victory upgrade free." : "All upgrades are permanent for this unit.";
    const grid = $("depotUpgrades");
    grid.replaceChildren();
    for (let i = 0; i < permanentKinds.length; i++) {
      const kind = permanentKinds[i], n = u.upgrades?.[kind] || 0, free = pending && levelReward.tacticOptions.some((o) => o.kind === kind), cost = depotUpgradePrice(u, kind), card = document.createElement("div");
      card.className = "depot-upgrade" + (free ? " free" : "");
      const h = document.createElement("h3");
      h.textContent = permanentNames[i];
      const p = document.createElement("p");
      p.textContent = permanentEffects[i];
      const level = document.createElement("small");
      level.textContent = "Training " + n + " / 20";
      const button = document.createElement("button");
      button.className = free ? "primary" : "tiny";
      button.textContent = n >= 20 ? free ? "Claim 30 credits" : "Fully trained" : free ? "Claim free upgrade" : "Train \xB7 " + cost + " credits";
      button.disabled = mode === "running" || compiling || n >= 20 && !free || !free && economy.credits < cost;
      button.onclick = () => buyDepotUpgrade(kind);
      card.append(h, p, level, button);
      grid.append(card);
    }
    $("depotDeploy").disabled = mode === "running" || compiling || !!(mode === "won" && (!levelReward?.unit || !levelReward?.tactic)) || mode === "lost" && campaign.lives <= 0 || !!coachRequest;
    $("depotDeploy").textContent = mode === "won" ? "Deploy Round " + (round + 1) : mode === "lost" ? "Retry Round " + round : "Deploy Round " + round;
    $("depotNextNote").textContent = pending ? "Claim your free upgrade before deploying." : mode === "lost" && campaign.lives <= 0 ? "Run ended. Start a new run in Menu." : coachRequest ? "Waiting for coach analysis\u2026" : "Your squad is ready.";
  };
  function openFieldBase() {
    if (mode === "running" || compiling) return;
    if (autoRestartTimer) {
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
    hideUnitTooltip();
    $("menuDialog").close();
    $("rewardDialog").close();
    $("fieldBaseScreen").hidden = false;
    $("battleShell").hidden = true;
    inFieldBase = true;
    renderBase();
    if (coachSettings.enabled && lastBattleReport && coachAttemptedReport !== lastBattleReport && !replaying && !onlinePlaying) requestCoach();
  }
  function closeFieldBase() {
    hideUnitTooltip();
    $("fieldBaseScreen").hidden = true;
    $("battleShell").hidden = false;
    inFieldBase = false;
  }
  $("baseButton").onclick = openFieldBase;
  $("leaveDepot").onclick = () => {
    if (mode === "won" && levelReward) {
      $("depotMessage").textContent = "Claim the victory upgrade and deploy from Field Base.";
      return;
    }
    closeFieldBase();
  };
  const depotCompleteRewards = completeLevelRewards;
  $("depotDeploy").onclick = () => {
    if ($("depotDeploy").disabled) return;
    if (mode === "won") depotCompleteRewards();
    closeFieldBase();
    deploy();
  };
  $("depotArmory").onclick = () => {
    renderLoadout();
    $("loadoutDialog").showModal();
  };
  $("depotStore").onclick = () => {
    renderStore();
    $("storeDialog").showModal();
  };
  $("depotScripts").onclick = () => $("scriptsButton").onclick();
  $("depotCoach").onclick = () => openCoachSettings();
  renderLevelRewards = function() {
    if (!levelReward) return;
    const root = $("rewards");
    root.replaceChildren();
    $("rewardTitle").textContent = "Victory \xB7 Choose your recruit";
    if (levelReward.unit) {
      const p2 = document.createElement("p");
      p2.textContent = levelReward.unit;
      root.append(p2);
    } else for (const type of levelReward.offerTypes) root.append(rewardButton("Recruit " + unitTypes[type].name + " \u2605", roster.length < economy.slots ? "Add to squad \xB7 combine three matching copies" : "Squad full \xB7 waits in reserve", () => chooseReward({ unitType: type, action: "add" })));
    const p = document.createElement("p");
    p.textContent = "Your permanent upgrade is waiting at Field Base.";
    root.append(p);
    $("claimLevel").disabled = !levelReward.unit;
    $("claimLevel").textContent = "Return to Field Base";
  };
  $("claimLevel").onclick = () => {
    if (mode === "won" && levelReward?.unit) openFieldBase();
  };
  const depotReward = chooseReward;
  chooseReward = function(option) {
    depotReward(option);
    if (inFieldBase) renderBase();
  };
  const depotFinish = finish;
  finish = function(win) {
    if (mode !== "running") return;
    if (!replaying && !onlinePlaying) {
      lastBattleReport = collectBattleReport(win);
      coachDraft = null;
    }
    $("applyCoachDraft").hidden = true;
    $("coachDraftReview").hidden = true;
    depotFinish(win);
    hideUnitTooltip();
    if (!win && (!autoRestart || coachSettings.enabled) && !replaying && !onlinePlaying) openFieldBase();
  };
  const depotReset = resetRun;
  resetRun = function() {
    coachGeneration++;
    if (coachRequest) coachRequest.abort();
    coachRequest = null;
    coachDraft = null;
    lastBattleReport = null;
    closeFieldBase();
    depotReset();
  };
  $("reset").onclick = () => resetRun();
  const baseStore = renderStore;
  renderStore = function() {
    baseStore();
    if (inFieldBase) renderBase();
  };
  const baseEquipment = equipGear;
  equipGear = function(id, slot) {
    baseEquipment(id, slot);
    if (inFieldBase) renderBase();
  };
  function unitTooltipRows(u) {
    const s = u.stats || unitStats(u), percent = (v) => (100 * (v || 0)).toFixed(1) + "%", num = (v) => Number(v || 0).toFixed(1);
    return [["Health", Math.ceil(u.hp ?? s.hp) + " / " + Math.round(u.maxHp ?? s.hp)], [u.type === "infantry" ? "Volley damage" : "Damage", u.type === "infantry" ? num(s.damage) + " (4 \xD7 " + num(s.damage / 4) + ")" : num(s.damage)], ["Armor", percent(s.armor)], ["Resistance", percent(s.damageResistance)], ["Speed", num(s.speed)], [u.type === "infantry" ? "Magazine volleys" : "Magazine", (u.ammo ?? s.mag) + " / " + s.mag], ["Reload", num(s.loadingSpeed) + " rounds/sec"], ["Critical chance", percent(s.critChance)], ["Shield", num(u.shield ?? s.shieldCapacity)], ["Fighting range", Math.round(u.plan?.preferred ?? s.range)], ["Orders", capacityFor(u)], ["Shot interval", num(s.reload) + " sec"], ["Critical multiplier", num(s.critMultiplier) + "\xD7"], ["Penetration", percent(s.penetration)], ["Projectile speed", num(s.projectileSpeed)], ["Splash radius", num(s.explosionRadius)], ["Accuracy", num(s.accuracy)], ["Splash falloff", percent(s.splashFalloff)], ["Reload delay", num(s.reloadDelay)], ["Reserve ammo", Math.round(u.reserve ?? s.ammoReserve)], ["Heat", num(u.heat ?? 0) + " / " + num(s.heatCapacity)], ["Heat per shot", num(s.heatPerShot)], ["Cooling", num(s.coolingRate)], ["Shield recharge", num(s.shieldRecharge)], ["Repair / sec", num(s.repairRate)], ["Impact resistance", percent(s.impactResistance)], ["Acceleration", num(s.acceleration)], ["Braking", num(s.braking)], ["Hull turn", num(s.turnRate)], ["Turret turn", num(s.turretTurnRate)], ["Reverse speed", num(s.reverseSpeed)], ["Traction", num(s.terrainTraction)], ["Radar", num(s.radarRange)], ["Scan interval", num(s.scanInterval)], ["Lock time", num(s.targetLockTime)], ["Energy", num(u.energy ?? s.energyCapacity) + " / " + num(s.energyCapacity)], ["Energy / sec", num(s.energyRegeneration)]];
  }
  let tooltipPinned = false, tooltipTimer = null;
  function hideUnitTooltip() {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    $("unitTooltip").hidden = true;
    tooltipPinned = false;
    window.unitTooltipId = null;
  }
  function showUnitTooltip(u, x, y, pinned = false) {
    if (!u) return;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    if (tooltipPinned && !pinned) return;
    tooltipPinned = pinned;
    window.unitTooltipId = u.id;
    const tip = $("unitTooltip");
    $("tooltipName").textContent = (u.name || unitTypes[u.type].name) + " \xB7 " + unitTypes[u.type].name + " " + "\u2605".repeat(u.tier);
    $("tooltipStats").replaceChildren();
    $("tooltipMore").replaceChildren();
    for (const [i, [label, value]] of unitTooltipRows(u).entries()) {
      const div = document.createElement("div"), small = document.createElement("small"), b2 = document.createElement("b");
      small.textContent = label;
      b2.textContent = value;
      div.append(small, b2);
      $(i < 10 ? "tooltipStats" : "tooltipMore").append(div);
    }
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(x + 350 > innerWidth ? x - 350 : x + 14, innerWidth - 350)) + "px";
    tip.style.top = Math.max(8, Math.min(y + 14, innerHeight - Math.min(tip.offsetHeight || 350, innerHeight * 0.7) - 8)) + "px";
  }
  function attachUnitTooltip(card, u) {
    card.onpointerenter = (e) => {
      if (e.pointerType !== "touch") showUnitTooltip(u, e.clientX, e.clientY);
    };
    card.onpointerleave = () => {
      if (!tooltipPinned) tooltipTimer = setTimeout(hideUnitTooltip, 150);
    };
    card.setAttribute("tabindex", "0");
    card.onfocus = () => showUnitTooltip(u, 16, 120);
  }
  $("closeTooltip").onclick = hideUnitTooltip;
  $("unitTooltip").onpointerenter = () => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
  };
  $("unitTooltip").onpointerleave = () => {
    if (!tooltipPinned) hideUnitTooltip();
  };
  window.unitInspector = { show: showUnitTooltip, hide: () => {
    if (!tooltipPinned) hideUnitTooltip();
  }, dismiss: hideUnitTooltip };
  const tooltipRoster = renderRoster;
  renderRoster = function() {
    tooltipRoster();
    for (const [i, card] of [...$("rosterGrid").children].entries()) {
      attachUnitTooltip(card, roster[i]);
      card.onclick = (e) => {
        if (e.target === card) showUnitTooltip(roster[i], e.clientX, e.clientY, true);
      };
    }
  };
  function depotEdit(action) {
    const prior = mode;
    if (inFieldBase && mode === "won") mode = "ready";
    try {
      return action();
    } finally {
      mode = prior;
    }
  }
  const depotSaveScript = $("saveScript").onclick;
  $("saveScript").onclick = () => depotEdit(depotSaveScript);
  const depotLoadout = renderLoadout;
  renderLoadout = function() {
    depotEdit(depotLoadout);
    if (inFieldBase) for (const b2 of $("loadoutDialog").querySelectorAll?.("button") || []) {
      const action = b2.onclick;
      if (action) b2.onclick = (e) => depotEdit(() => action(e));
    }
  };
  const reportFire = squadFire;
  squadFire = function(t, target) {
    const ammo = t.ammo, before = shots.length;
    reportFire(t, target);
    if (t.ammo < ammo) t.reportShots = (t.reportShots || 0) + shots.length - before;
  };
  const reportHit = takeHit;
  takeHit = function(t, shot, scale = 1) {
    const before = t.hp + t.shield;
    reportHit(t, shot, scale);
    const loss = Math.max(0, before - t.hp - t.shield);
    t.reportDamageTaken = (t.reportDamageTaken || 0) + loss;
    const source = battleUnits.find((u) => u.id === shot.owner);
    if (source) {
      source.reportDamageDealt = (source.reportDamageDealt || 0) + loss;
      if (loss > 0) source.reportHits = (source.reportHits || 0) + 1;
    }
    if (t.hp <= 0 && before > 0 && source) source.reportKills = (source.reportKills || 0) + 1;
  };
  const reportPickup = collectPickup;
  collectPickup = function(t, p) {
    const before = p.used;
    reportPickup(t, p);
    if (!before && p.used) {
      t.reportPickups = t.reportPickups || {};
      t.reportPickups[p.kind] = (t.reportPickups[p.kind] || 0) + 1;
    }
  };
  function collectBattleReport(win) {
    return { version: 1, round, map: campaign.map, result: win ? "victory" : "defeat", durationSeconds: Math.round(elapsed * 10) / 10, units: battleUnits.map((t) => ({ id: t.id, side: t.team, type: t.type, tier: t.tier, callsign: callsign(t), survived: t.hp > 0, remainingHealth: Math.ceil(t.hp), maximumHealth: t.maxHp, shotsFired: t.reportShots || 0, damageDealt: Math.round(t.reportDamageDealt || 0), damageTaken: Math.round(t.reportDamageTaken || 0), hitEvents: t.reportHits || 0, kills: t.reportKills || 0, reserveAmmo: t.reserve, magazineAmmo: t.ammo, pickups: t.reportPickups || {} })) };
  }
  let coachSettings = { provider: "ollama", endpoint: "http://127.0.0.1:11434/api/chat", model: "qwen2.5-coder:7b", enabled: false, autoApply: false }, coachApiKey = "";
  try {
    const saved = JSON.parse(localStorage.getItem("tank-coach-preferences"));
    if (saved) coachSettings = { ...coachSettings, ...saved, enabled: false, autoApply: false };
  } catch {
  }
  function openCoachSettings() {
    for (const key of ["provider", "endpoint", "model"]) $("coach" + key[0].toUpperCase() + key.slice(1)).value = coachSettings[key];
    $("coachEnabled").checked = coachSettings.enabled;
    $("coachAutoApply").checked = coachSettings.autoApply;
    $("coachKey").value = coachApiKey;
    $("coachReport").textContent = lastBattleReport ? JSON.stringify(lastBattleReport, null, 2) : "Play a campaign battle first.";
    $("coachDialog").showModal();
  }
  $("coachButton").onclick = openCoachSettings;
  $("closeCoach").onclick = () => $("coachDialog").close();
  $("coachProvider").onchange = () => {
    $("coachEndpoint").value = $("coachProvider").value === "ollama" ? "http://127.0.0.1:11434/api/chat" : "";
  };
  $("saveCoach").onclick = () => {
    const endpoint = $("coachEndpoint").value.trim(), model = $("coachModel").value.trim();
    try {
      const url = new URL(endpoint);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Use a valid HTTP endpoint without embedded credentials.");
      if (!model) throw Error("Enter your model name.");
      coachSettings = { provider: $("coachProvider").value, endpoint, model, enabled: $("coachEnabled").checked, autoApply: $("coachAutoApply").checked };
      coachApiKey = $("coachKey").value.trim();
      localStorage.setItem("tank-coach-preferences", JSON.stringify({ provider: coachSettings.provider, endpoint, model }));
      if (!coachSettings.enabled) {
        coachGeneration++;
        if (coachRequest) coachRequest.abort();
        coachRequest = null;
        coachDraft = null;
        $("applyCoachDraft").hidden = true;
        $("coachDraftReview").hidden = true;
      }
      renderBase();
      $("coachMessage").textContent = coachSettings.enabled ? "Coach enabled for this session. Battle reports will be sent to " + new URL(endpoint).host + "." : "Coach is off. No reports will be sent.";
    } catch (e) {
      $("coachMessage").textContent = e.message;
    }
  };
  function coachSnapshot() {
    return JSON.stringify({ units: roster.map((u) => ({ id: u.id, script: u.unitScript })), squad: campaign.orders });
  }
  function validateCoachDraft(data) {
    if (!data || !Array.isArray(data.scripts) || data.scripts.length > 15) throw Error("Coach must return one or more unit scripts.");
    const ids = /* @__PURE__ */ new Set();
    for (const row of data.scripts) {
      if (!roster.some((u) => u.id === row.id) || ids.has(row.id) || typeof row.script !== "string") throw Error("Coach returned an unknown or duplicate unit.");
      ids.add(row.id);
      const p = compilePython(row.script);
      if (p.errors.length) throw Error("Coach script rejected: " + p.errors.join(" \xB7 "));
    }
    if (data.squadScript !== void 0 && (typeof data.squadScript !== "string" || data.squadScript && compilePython(data.squadScript).errors.length)) throw Error("Coach squad script rejected.");
    return data;
  }
  async function requestCoach() {
    if (!coachSettings.enabled) {
      $("coachMessage").textContent = "Opt in and save the connection first.";
      return;
    }
    if (!lastBattleReport || coachRequest) {
      $("coachMessage").textContent = coachRequest ? "Analysis is already running." : "Play a campaign battle first.";
      return;
    }
    const controller = new AbortController(), generation = ++coachGeneration, snapshot = coachSnapshot();
    coachAttemptedReport = lastBattleReport;
    coachRequest = controller;
    $("coachStatus").textContent = "Coach is analyzing the battle\u2026";
    $("coachMessage").textContent = "Sending battle report to your chosen model\u2026";
    renderBase();
    try {
      const units = roster.map((u) => ({ id: u.id, type: u.type, tier: u.tier, script: u.unitScript })), response = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...coachSettings, key: coachApiKey, report: lastBattleReport, units, squadScript: campaign.orders }), signal: controller.signal }), data = await response.json();
      if (!response.ok || data.error) throw Error(data.error || "Coach unavailable.");
      if (generation !== coachGeneration || !coachSettings.enabled) return;
      if (snapshot !== coachSnapshot()) throw Error("Scripts changed during analysis. Run the coach again.");
      coachDraft = validateCoachDraft(data);
      coachDraft.snapshot = snapshot;
      $("coachStatus").textContent = (data.summary || "Coach returned valid script updates.").slice(0, 400);
      $("coachMessage").textContent = "Valid draft ready.";
      $("applyCoachDraft").hidden = false;
      $("coachDraftReview").hidden = false;
      $("coachDraftText").textContent = data.scripts.map((row) => (roster.find((u) => u.id === row.id)?.name || row.id) + "\n" + row.script).join("\n\n") + (data.squadScript !== void 0 ? "\n\nSquad script\n" + data.squadScript : "");
      if (coachSettings.autoApply) applyCoachScripts();
    } catch (e) {
      if (generation === coachGeneration) {
        $("coachStatus").textContent = e.name === "AbortError" ? "Coach analysis cancelled." : e.message;
        $("coachMessage").textContent = $("coachStatus").textContent;
      }
    } finally {
      if (coachRequest === controller) coachRequest = null;
      renderBase();
    }
  }
  function applyCoachScripts() {
    if (!coachDraft || mode === "running" || coachSnapshot() !== coachDraft.snapshot) {
      $("coachStatus").textContent = "Draft is stale or a battle is running. Analyze again between battles.";
      return;
    }
    const draft = validateCoachDraft(coachDraft);
    for (const row of draft.scripts) roster.find((u) => u.id === row.id).unitScript = row.script;
    if (draft.squadScript !== void 0) {
      campaign.orders = draft.squadScript;
      squadScript = draft.squadScript;
      $("prompt").value = squadScript;
    }
    saveProgram();
    preview();
    coachDraft = null;
    $("applyCoachDraft").hidden = true;
    $("coachDraftReview").hidden = true;
    $("coachStatus").textContent = "Validated coach scripts applied. Ready for your next battle.";
  }
  $("applyCoachDraft").onclick = applyCoachScripts;
  $("runCoach").onclick = () => requestCoach();
  let scriptChangeText = campaign.coachLog || "No script changes yet.", coachActivity = "";
  $("menuButton").parentNode?.after?.($("coachMainPanel"));
  $("coachDialog").append($("coachBriefFallback"));
  function rankBadge(tier) {
    const badge = document.createElement("span");
    badge.className = "rank-stars";
    badge.setAttribute("aria-label", tier + " stars");
    for (let i = 0; i < tier; i++) {
      const star = document.createElement("span");
      star.className = "rank-star";
      badge.append(star);
    }
    return badge;
  }
  const rankedRoster = renderRoster;
  renderRoster = function() {
    rankedRoster();
    for (const [i, card] of [...$("rosterGrid").children].entries()) {
      const detail = card.children[1];
      if (detail && roster[i]) {
        detail.textContent = detail.textContent.replace(/★+ · /, "");
        detail.append(rankBadge(roster[i].tier));
      }
    }
  };
  const compactDepot = renderBase;
  renderBase = function() {
    compactDepot();
    for (const [i, card] of [...$("depotUnits").children].entries()) {
      const detail = card.children[1];
      detail.textContent = unitTypes[roster[i].type].name + " \xB7 " + capacityFor(roster[i]) + " orders";
      detail.append(rankBadge(roster[i].tier));
      if (card.children[3]) card.children[3].hidden = card.children[3].disabled;
    }
    const pending = mode === "won" && !!levelReward && !levelReward.unit;
    $("depotRecruitSection").hidden = !pending;
    const choices = $("depotRecruitChoices");
    choices.replaceChildren();
    if (pending) for (const type of levelReward.offerTypes) {
      const b2 = rewardButton(unitTypes[type].name, roster.length < economy.slots ? "Add to squad" : "Keep in reserve", () => chooseReward({ unitType: type, action: "add" }));
      b2.className = "depot-recruit";
      b2.append(rankBadge(1));
      choices.append(b2);
    }
    if (pending) {
      $("depotNextNote").textContent = "Choose your recruit, then a free upgrade.";
      $("depotRewardNote").textContent = "Choose your recruit above to unlock the free upgrade.";
    }
    syncCoachUI();
  };
  function setScriptNote(text) {
    scriptChangeText = text;
    campaign.coachLog = text;
    saveRoster();
    syncCoachUI();
  }
  function syncCoachUI() {
    if (!$("coachMainStatus")) return;
    $("coachMainStatus").textContent = coachRequest ? "Analyzing battle \xB7 Full guide included" : coachSettings.enabled ? (coachSettings.provider === "ollama" ? "Local coach \xB7 " : "Coach \xB7 ") + coachSettings.model : "Coach off \xB7 No automatic requests";
    $("scriptChangeNote").textContent = scriptChangeText;
    $("depotScriptNote").textContent = scriptChangeText;
    $("analyzeMain").textContent = coachRequest ? "Analyzing\u2026" : coachSettings.enabled ? "Analyze again" : "Set up coach";
    $("analyzeMain").disabled = !!coachRequest || mode === "running";
    $("runCoach").disabled = !!coachRequest || mode === "running";
    $("applyMainDraft").hidden = !coachDraft;
    $("applyMainDraft").disabled = mode === "running";
    $("deploy").disabled = mode === "running" || mode === "won" || !!coachRequest;
    $("coachStatus").textContent = coachActivity || (!coachSettings.enabled ? "Enable a model to analyze battles automatically." : "Full Python documentation is included in each request.");
  }
  $("analyzeMain").onclick = () => coachSettings.enabled ? requestCoach() : openCoachSettings();
  $("configureMain").onclick = openCoachSettings;
  $("applyMainDraft").onclick = () => applyCoachScripts();
  function lineChanges(before, after) {
    const a2 = before.replace(/\r/g, "").split("\n"), b2 = after.replace(/\r/g, "").split("\n");
    if (before === after) return { added: 0, removed: 0 };
    const prev = new Array(b2.length + 1).fill(0);
    for (const x of a2) {
      let diagonal = 0;
      for (let j = 1; j <= b2.length; j++) {
        const old = prev[j];
        prev[j] = x === b2[j - 1] ? diagonal + 1 : Math.max(prev[j], prev[j - 1]);
        diagonal = old;
      }
    }
    const shared = prev[b2.length];
    return { added: b2.length - shared, removed: a2.length - shared };
  }
  function coachChangeCounts(draft) {
    let added = 0, removed = 0, units = 0;
    for (const row of draft.scripts) {
      const current = roster.find((u) => u.id === row.id)?.unitScript || "", diff = lineChanges(current, row.script);
      added += diff.added;
      removed += diff.removed;
      if (diff.added || diff.removed) units++;
    }
    if (draft.squadScript !== void 0) {
      const diff = lineChanges(campaign.orders || "", draft.squadScript);
      added += diff.added;
      removed += diff.removed;
      if (diff.added || diff.removed) units++;
    }
    return { added, removed, units };
  }
  coachSnapshot = function(ids = null) {
    return JSON.stringify({ units: roster.filter((u) => !ids || ids.includes(u.id)).map((u) => ({ id: u.id, script: u.unitScript })), squad: campaign.orders });
  };
  requestCoach = async function() {
    if (!coachSettings.enabled) {
      coachActivity = "Opt in to enable automatic battle analysis.";
      syncCoachUI();
      return;
    }
    if (!lastBattleReport || coachRequest || mode === "running") {
      coachActivity = mode === "running" ? "Analysis is available after the battle." : "Play a campaign battle first.";
      syncCoachUI();
      return;
    }
    const controller = new AbortController(), generation = ++coachGeneration, ids = roster.map((u) => u.id), snapshot = coachSnapshot(ids), report = lastBattleReport;
    coachAttemptedReport = report;
    coachRequest = controller;
    coachDraft = null;
    $("applyCoachDraft").hidden = true;
    $("coachDraftReview").hidden = true;
    coachActivity = "Analyzing Round " + report.round + " \xB7 Sending full function documentation.";
    $("coachMessage").textContent = coachActivity;
    setScriptNote("Round " + report.round + " \xB7 Analyzing\u2026 scripts unchanged until validated.");
    renderBase();
    try {
      const response = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...coachSettings, key: coachApiKey, report, units: roster.map((u) => ({ id: u.id, type: u.type, tier: u.tier, script: u.unitScript })), squadScript: campaign.orders }), signal: controller.signal }), data = await response.json();
      if (!response.ok || data.error) throw Error(data.error || "Coach unavailable.");
      if (generation !== coachGeneration || !coachSettings.enabled) return;
      if (snapshot !== coachSnapshot(ids)) throw Error("Units or scripts changed during analysis. Analyze again.");
      coachDraft = validateCoachDraft(data);
      coachDraft.snapshot = snapshot;
      coachDraft.snapshotIds = ids;
      coachDraft.round = report.round;
      const diff = coachChangeCounts(coachDraft);
      coachActivity = "Full guide sent (" + (data.documentation?.characters || "all") + " characters). " + (data.summary || "Analysis complete.");
      if (!diff.units) {
        coachDraft = null;
        setScriptNote("Round " + report.round + " \xB7 No script changes.");
        $("applyCoachDraft").hidden = true;
        $("coachDraftReview").hidden = true;
      } else {
        $("coachDraftReview").hidden = false;
        $("applyCoachDraft").hidden = false;
        $("coachDraftText").textContent = data.scripts.map((row) => (roster.find((u) => u.id === row.id)?.name || row.id) + "\n" + row.script).join("\n\n") + (data.squadScript !== void 0 ? "\n\nSquad script\n" + data.squadScript : "");
        setScriptNote("Round " + report.round + " \xB7 Draft: " + diff.added + " lines added / " + diff.removed + " removed \xB7 Not applied.");
        if (coachSettings.autoApply) applyCoachScripts();
      }
      $("coachMessage").textContent = coachActivity;
    } catch (e) {
      if (generation === coachGeneration) {
        coachDraft = null;
        coachActivity = e.name === "AbortError" ? "Analysis cancelled." : e.message;
        setScriptNote("Round " + report.round + " \xB7 No script changes \xB7 " + coachActivity);
        $("coachMessage").textContent = coachActivity;
      }
    } finally {
      if (coachRequest === controller) coachRequest = null;
      renderBase();
      syncCoachUI();
    }
  };
  applyCoachScripts = function() {
    if (!coachDraft || mode === "running" || coachSnapshot(coachDraft.snapshotIds) !== coachDraft.snapshot) {
      coachActivity = "Draft is stale or a battle is running. Analyze again.";
      syncCoachUI();
      return;
    }
    const draft = validateCoachDraft(coachDraft), diff = coachChangeCounts(draft), fromRound = draft.round || lastBattleReport?.round || round;
    for (const row of draft.scripts) roster.find((u) => u.id === row.id).unitScript = row.script;
    if (draft.squadScript !== void 0) {
      campaign.orders = draft.squadScript;
      squadScript = draft.squadScript;
      $("prompt").value = squadScript;
    }
    saveProgram();
    preview();
    coachDraft = null;
    $("applyCoachDraft").hidden = true;
    $("coachDraftReview").hidden = true;
    coachActivity = "Validated scripts saved for the next battle.";
    setScriptNote(diff.units ? "Round " + fromRound + " \xB7 " + diff.added + " lines added / " + diff.removed + " removed \xB7 " + diff.units + " scripts updated." : "Round " + fromRound + " \xB7 No script changes.");
  };
  $("applyCoachDraft").onclick = applyCoachScripts;
  $("runCoach").onclick = () => requestCoach();
  const saveCoachPreferences = $("saveCoach").onclick;
  $("saveCoach").onclick = () => {
    saveCoachPreferences();
    syncCoachUI();
    if (coachSettings.enabled && lastBattleReport && coachAttemptedReport !== lastBattleReport) requestCoach();
  };
  $("coachProvider").onchange = () => {
    const presets = { ollama: [defaultLocalEndpoint, defaultLocalModel], gemini: ["https://generativelanguage.googleapis.com/v1beta", ""], openai: ["https://api.openai.com/v1/responses", ""], compatible: ["", ""] };
    const [endpoint, model] = presets[$("coachProvider").value];
    $("coachEndpoint").value = endpoint;
    $("coachModel").value = model;
    $("coachModel").placeholder = "Model ID from your provider account";
    $("coachKey").value = "";
  };
  $("copyBattleBrief").onclick = async () => {
    try {
      const response = await fetch("/api/coach/reference"), data = await response.json();
      if (!response.ok || !data.text) throw Error("Start the local server to copy the guide.");
      const brief = "Build Tank Tactics restricted Python tick(unit, squad) scripts using this guide. Suggest changes supported by the report. Return each unit script separately, labelled with its unit ID.\n\n" + data.text + "\n\nBattle and current scripts:\n" + JSON.stringify({ report: lastBattleReport, units: roster.map((u) => ({ id: u.id, type: u.type, tier: u.tier, script: u.unitScript })), squadScript: campaign.orders }, null, 2);
      $("coachBriefFallback").value = brief;
      await navigator.clipboard.writeText(brief);
      $("coachMessage").textContent = "Battle and full guide copied. Paste into ChatGPT, AI Studio or your preferred chatbot.";
    } catch (e) {
      $("coachMessage").textContent = e.message;
      if ($("coachBriefFallback").value) {
        $("coachBriefFallback").hidden = false;
        $("coachBriefFallback").select?.();
        $("coachMessage").textContent = "Copy the battle brief from the text box below.";
      }
    }
  };
  function renderBattleResult(win) {
    $("rewardTitle").textContent = win ? "Victory" : "Defeat";
    const intro = $("rewardDialog").querySelector?.("p");
    if (intro) intro.textContent = win ? "Prepare your squad and choose a recruit at Field Base." : "Regroup, adjust your scripts and prepare at Field Base.";
    const eyebrow = $("rewardDialog").querySelector?.(".eyebrow");
    if (eyebrow) eyebrow.textContent = "BATTLE COMPLETE";
    const root = $("rewards");
    root.replaceChildren();
    const report = lastBattleReport, points = campaign.lastPoints || { total: 0, outcome: 0, eliminations: 0, survival: 0 };
    for (const text of ["Round " + (report?.round || round) + " \xB7 " + Math.round(report?.durationSeconds || elapsed) + " seconds", "+" + points.total + " points \xB7 Practice run score " + (campaign.practiceScore || 0), "Outcome " + points.outcome + " \xB7 Eliminations " + points.eliminations + " \xB7 Survivors " + points.survival, win ? "Your recruit and free upgrade are waiting at Field Base." : campaign.lives > 0 ? campaign.lives + " lives remaining." : "Run ended. Start a new run from Field Base."]) {
      const p = document.createElement("p");
      p.textContent = text;
      root.append(p);
    }
    $("claimLevel").disabled = false;
    $("claimLevel").textContent = "Continue to Field Base";
  }
  renderLevelRewards = function() {
    renderBattleResult(true);
  };
  $("claimLevel").onclick = () => {
    if (mode === "won" || mode === "lost") openFieldBase();
  };
  const resultFinish = finish;
  finish = function(win) {
    if (mode !== "running") return;
    const practice = !replaying && !onlinePlaying;
    resultFinish(win);
    if (!practice) return;
    campaign.lastPoints = battlePoints2(win, battleUnits);
    campaign.practiceScore = (campaign.practiceScore || 0) + campaign.lastPoints.total;
    saveRoster();
    if (autoRestartTimer) {
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
    closeFieldBase();
    renderBattleResult(win);
    $("rewardDialog").showModal();
    if (coachSettings.enabled && coachAttemptedReport !== lastBattleReport) requestCoach();
    else if (!coachSettings.enabled) setScriptNote("Round " + round + " \xB7 No script changes (coach off).");
    if (!win && autoRestart && !coachSettings.enabled && campaign.lives > 0) autoRestartTimer = setTimeout(() => {
      $("rewardDialog").close();
      closeFieldBase();
      deploy();
    }, 3e3);
    syncCoachUI();
  };
  const clearScoreRun = resetRun;
  resetRun = function() {
    clearScoreRun();
    campaign.practiceScore = 0;
    campaign.lastPoints = null;
    coachActivity = "";
    coachAttemptedReport = null;
    setScriptNote("New run \xB7 No script changes yet.");
  };
  $("reset").onclick = () => resetRun();
  const actionDeploy = deploy;
  deploy = function() {
    if (coachRequest) {
      coachActivity = "Wait for battle analysis before deploying.";
      syncCoachUI();
      return;
    }
    const result = actionDeploy();
    syncCoachUI();
    return result;
  };
  $("deploy").onclick = deploy;
  const resultOpenBase = openFieldBase;
  openFieldBase = function() {
    resultOpenBase();
    if (inFieldBase) $("fieldBaseScreen").scrollIntoView?.({ block: "start", behavior: "instant" });
  };
  $("baseButton").onclick = openFieldBase;
  syncCoachUI();
  const scoreHud = updateHud;
  updateHud = function() {
    scoreHud();
    $("winsLabel").textContent = "Run wins: " + wins + " \xB7 Practice score " + (campaign.practiceScore || 0);
  };
  const deployFromDepot = $("depotDeploy").onclick;
  $("depotDeploy").onclick = () => {
    if (mode === "lost" && campaign.lives <= 0) {
      resetRun();
      openFieldBase();
      return;
    }
    deployFromDepot();
  };
  const endRunDepot = renderBase;
  renderBase = function() {
    endRunDepot();
    if (mode === "lost" && campaign.lives <= 0) {
      $("depotDeploy").textContent = "Start new run";
      $("depotDeploy").disabled = !!coachRequest;
      $("depotNextNote").textContent = "Run complete \xB7 Prepare a fresh squad.";
    }
  };
  let onlineResultShown = false;
  function showOnlineBattleResult(win, data) {
    onlineResultShown = true;
    $("rewardTitle").textContent = win ? "Multiplayer victory" : "Multiplayer defeat";
    const intro = $("rewardDialog").querySelector?.("p");
    if (intro) intro.textContent = "Server-confirmed battle result.";
    const root = $("rewards");
    root.replaceChildren();
    for (const text of ["+" + data.points + " leaderboard points", "Online credits: " + (win ? 60 : 15) + ". Refresh your online armory to see your balance."]) {
      const p = document.createElement("p");
      p.textContent = text;
      root.append(p);
    }
    $("claimLevel").disabled = false;
    $("claimLevel").textContent = "Return to battlefield";
    $("rewardDialog").showModal();
    syncCoachUI();
  }
  const campaignResultContinue = $("claimLevel").onclick;
  $("claimLevel").onclick = () => {
    if (onlineResultShown) {
      onlineResultShown = false;
      $("rewardDialog").close();
      return;
    }
    campaignResultContinue();
  };
  let defaultLocalEndpoint = "http://127.0.0.1:11434/api/chat", defaultLocalModel = "qwen2.5-coder:7b";
  fetch("/api/coach/config").then((r) => r.ok ? r.json() : null).then((config) => {
    if (!config) return;
    defaultLocalEndpoint = config.endpoint;
    defaultLocalModel = config.model;
    if ($("coachConnectionNote")) $("coachConnectionNote").textContent = config.location + ". Keep that computer and Ollama running. Coaching requires opt-in.";
    if (coachSettings.provider === "ollama" && !coachSettings.enabled && (!localStorage.getItem("tank-coach-preferences") || ["qwen2.5-coder:1.5b", "qwen2.5-coder:3b"].includes(coachSettings.model))) {
      coachSettings.endpoint = config.endpoint;
      coachSettings.model = config.model;
    }
  }).catch(() => {
  });
  const initial = selectedUnit();
  selectedId = initial.id;
  commands = new Set((initial.instruction ? initial.commands : unlocked(initial)).filter((c) => unlocked(initial).includes(c)));
  $("prompt").value = campaign.orders || "";
  saveRoster();
  renderRoster();
  window.arenaWorld = () => ({ W, H, buildings, pickups, battleUnits, shots, sparks, mode, elapsed, map: campaign.map, selectedId, worldRevision, skin: campaign.skin, base: onlinePlaying ? [] : campaign.base });
  const fallbackDraw = draw;
  draw = function() {
    if (!window.webglArenaActive) {
      ctx.save();
      ctx.scale(canvas.width / W, canvas.height / H);
      fallbackDraw();
      ctx.restore();
    }
  };
  commandRender();
  resetPositions();
  preview();
  updateBuffStatus();
  requestAnimationFrame(frame);
  roster = a;
  squadScript = a[0].squadScript || defaultSquadScript;
  $("prompt").value = squadScript;
  selectedId = a[0].id;
  campaign.map = map;
  round = 1;
  commands = new Set(a[0].commands);
  $("prompt").value = a[0].instruction;
  compiledPlan = a[0].compiled;
  compiledText = a[0].instruction;
  resetPositions();
  battleUnits = battleUnits.filter((u) => u.team === "player");
  for (let i = 0; i < b.length; i++) {
    const t = spawnCombat(b[i], "player", i, b.length);
    t.team = "enemy";
    t.x = W - 80 - Math.floor(i / 6) * 55;
    t.homeX = t.x;
    t.homeY = t.y;
    t.angle = Math.PI;
    t.heading = Math.PI;
    t.plan = planForUnit(b[i]);
    t.commands = b[i].commands;
    battleUnits.push(t);
  }
  enemy = battleUnits.find((u) => u.team === "enemy");
  seed = initialSeed;
  mode = "running";
  finish = function(win) {
    mode = win ? "won" : "lost";
  };
  if (restored) {
    battleUnits = restored.battleUnits;
    for (const t of battleUnits) t.target = battleUnits.find((u) => u.id === t.targetId) || null;
    shots = restored.shots;
    sparks = restored.sparks;
    pickups = restored.pickups;
    if (restored.buildings) {
      buildings = restored.buildings;
      rocks.splice(0, rocks.length, ...buildings.filter((b2) => !b2.destroyed));
      worldRevision++;
    }
    elapsed = restored.elapsed;
    seed = restored.seed;
    mode = restored.mode;
    damageEvents = restored.damageEvents || [];
    player = battleUnits.find((u) => u.team === "player");
    enemy = battleUnits.find((u) => u.team === "enemy");
  }
  return { tick(seconds) {
    const steps = Math.max(0, Math.min(120, Math.floor(seconds * 60)));
    for (let i = 0; i < steps && mode === "running"; i++) update(1 / 60);
  }, state() {
    return JSON.parse(JSON.stringify({ mode, elapsed, seed, battleUnits: battleUnits.map((t) => ({ ...t, target: null, targetId: t.target?.id || null })), shots, sparks, pickups, buildings, damageEvents }, (key, value) => key === "target" ? void 0 : value));
  } };
}

// cloud/python-policy.mjs
var PythonUnit = /* @__PURE__ */ (() => {
  const cache = /* @__PURE__ */ new Map();
  function expression(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) {
        i++;
        continue;
      }
      const part = source.slice(i), m = part.match(/^(?:\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?|"[^"\\]*"|'[^'\\]*'|==|!=|<=|>=|[<>+*/%(),-])/);
      if (!m) throw Error("Unsupported expression near " + part);
      tokens.push(m[0]);
      i += m[0].length;
    }
    let at = 0;
    const precedence = { or: 1, and: 2, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };
    function atom() {
      const token2 = tokens[at++];
      if (!token2) throw Error("Expected a value");
      if (token2 === "not" || token2 === "-") return { op: token2 === "not" ? "not" : "neg", value: token2 === "not" ? parse(3) : atom() };
      if (token2 === "(") {
        const value = parse(0);
        if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
        return value;
      }
      if (/^\d/.test(token2)) return { literal: Number(token2) };
      if (/^['"]/.test(token2)) return { literal: token2.slice(1, -1) };
      if (token2 === "True" || token2 === "False") return { literal: token2 === "True" };
      if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/.test(token2) || token2.includes("__")) throw Error("Unsupported value " + token2);
      if (tokens[at] === "(") {
        at++;
        const args = [];
        if (tokens[at] !== ")") do {
          args.push(parse(0));
          if (tokens[at] !== ",") break;
          at++;
        } while (true);
        if (tokens[at++] !== ")") throw Error("Missing closing parenthesis");
        return { call: token2, args };
      }
      return { name: token2 };
    }
    function parse(min) {
      let left = atom();
      while (precedence[tokens[at]] >= min) {
        if (precedence[tokens[at]] === 3) {
          const values = [left], operators = [];
          do {
            operators.push(tokens[at++]);
            values.push(parse(4));
          } while (precedence[tokens[at]] === 3);
          left = { chain: values, operators };
        } else {
          const op = tokens[at++], right = parse(precedence[op] + 1);
          left = { op, left, right };
        }
      }
      return left;
    }
    const tree = parse(0);
    if (at !== tokens.length) throw Error("Unexpected expression token");
    return tree;
  }
  function compile(text, methods2, sensors2, queries2) {
    if (cache.has(text)) return cache.get(text);
    const errors = [], body = [], names2 = /* @__PURE__ */ new Set(), calls = [];
    try {
      let checkLiteralArgs = function(name, args) {
        const types2 = ["tank", "infantry", "rocket", "scout", "sniper", "medic", "artillery", "engineer", "helicopter", "boat"], enums = { focus: ["nearest", "weakest", "leader"], stance: ["balanced", "rush", "sniper"], "unit.is_type": types2, "squad.has_type": types2, "squad.count_type": types2, "unit.map_is": ["urban", "canyon", "volcanic", "coast"] }, strings = /* @__PURE__ */ new Set(["focus", "stance", "follow", "protect", "flank", "unit.distance_to", "unit.ally_health", "unit.ally_alive", "unit.ability_ready", "unit.map_is", "unit.is_type", "squad.has_type", "squad.count_type"]);
        for (const arg of args) {
          if (!Object.hasOwn(arg, "literal")) continue;
          const value2 = arg.literal;
          if (strings.has(name)) {
            if (typeof value2 !== "string") throw Error(name + " requires a string argument");
            if (enums[name] && !enums[name].includes(value2)) throw Error(name + " accepts " + enums[name].join(", "));
            if (["follow", "protect", "flank", "unit.distance_to", "unit.ally_health", "unit.ally_alive"].includes(name) && !(["follow", "protect", "flank"].includes(name) && value2 === "leader" || new RegExp("^(" + types2.join("|") + ")-[1-9][0-9]?$").test(value2))) throw Error(name + " needs a valid callsign");
            if (name === "unit.ability_ready" && !methods2.has(value2)) throw Error("Unknown ability " + value2);
          } else if (typeof value2 !== "number" || !Number.isFinite(value2)) throw Error(name + " requires a numeric argument");
        }
      }, checkExpr = function(tree) {
        if (tree.chain) for (const value2 of tree.chain) checkExpr(value2);
        if (tree.name) {
          if (tree.name.includes(".")) {
            if (!sensors2.has(tree.name)) throw Error("Unknown read-only sensor " + tree.name);
          } else if (!names2.has(tree.name)) throw Error("Unknown local variable " + tree.name);
        }
        if (tree.call) {
          if (!queries2.has(tree.call)) throw Error("Unknown sensor function " + tree.call);
          const zero = /* @__PURE__ */ new Set(["unit.health_drop_distance", "unit.ammo_drop_distance", "unit.shield_drop_distance", "unit.boost_drop_distance", "unit.nearest_cover_distance", "unit.enemy_shield", "unit.enemy_health", "unit.has_ammo", "unit.can_fire"]);
          const expected = zero.has(tree.call) ? 0 : 1;
          if (tree.args.length !== expected) throw Error(tree.call + " needs " + expected + " arguments");
          checkLiteralArgs(tree.call, tree.args);
          for (const a of tree.args) checkExpr(a);
        }
        if (tree.value) checkExpr(tree.value);
        if (tree.left) checkExpr(tree.left);
        if (tree.right) checkExpr(tree.right);
      }, value = function(source) {
        const ast = expression(source);
        checkExpr(ast);
        return ast;
      }, block = function(indent, depth) {
        if (depth > 6) throw Error("Maximum condition nesting is six");
        const result2 = [];
        while (cursor < lines.length && lines[cursor].indent >= indent) {
          const line = lines[cursor];
          if (line.indent !== indent) throw Error("Use four-space indentation at line " + line.line);
          cursor++;
          if (line.text === "return") {
            result2.push({ kind: "return" });
            continue;
          }
          if (line.text === "pass") {
            result2.push({ kind: "pass" });
            continue;
          }
          const condition = line.text.match(/^if (.+):$/);
          if (condition) {
            const branches = [{ test: value(condition[1]), body: block(indent + 4, depth + 1) }];
            if (!branches[0].body.length) throw Error("An if block needs a body");
            while (cursor < lines.length && lines[cursor].indent === indent && /^elif |^else:/.test(lines[cursor].text)) {
              const next = lines[cursor++], elif = next.text.match(/^elif (.+):$/);
              if (!elif && next.text !== "else:") throw Error("Invalid else");
              branches.push({ test: elif ? value(elif[1]) : null, body: block(indent + 4, depth + 1) });
              if (!branches.at(-1).body.length) throw Error("Empty condition block");
              if (!elif) break;
            }
            result2.push({ kind: "if", branches });
            continue;
          }
          const assignment = line.text.match(/^([a-z][a-z0-9_]*) = (.+)$/);
          if (assignment) {
            if (["unit", "squad"].includes(assignment[1]) || assignment[1].includes("__")) throw Error("Cannot replace game objects");
            const ast2 = value(assignment[2]);
            names2.add(assignment[1]);
            result2.push({ kind: "assign", name: assignment[1], value: ast2 });
            continue;
          }
          const action = line.text.match(/^unit\.([a-z][a-z0-9_]*)\((.*)\)$/);
          if (!action || !methods2.has(action[1])) throw Error("Unknown action at line " + line.line + ": " + line.text);
          const ast = expression("unit." + action[1] + "(" + action[2] + ")");
          const count = action[1] === "move_to" ? 2 : ["hold_range", "focus", "follow", "protect", "flank", "stance", "retreat_below"].includes(action[1]) ? 1 : 0;
          if (ast.args.length !== count) throw Error(action[1] + " needs " + count + " arguments");
          checkLiteralArgs(action[1], ast.args);
          for (const a of ast.args) checkExpr(a);
          calls.push(action[1]);
          result2.push({ kind: "action", method: action[1], args: ast.args });
        }
        return result2;
      };
      if (typeof text !== "string" || text.length > 3e3) throw Error("Python scripts are limited to 3000 characters");
      const lines = text.split("\n").map((raw, i) => {
        if (raw.includes("	")) throw Error("Use spaces, not tabs (line " + (i + 1) + ")");
        const clean = raw.replace(/\s+#.*$/, "").trimEnd();
        return { indent: clean.length - clean.trimStart().length, text: clean.trim(), line: i + 1 };
      }).filter((l) => l.text && !l.text.startsWith("#"));
      if (lines.length > 120) throw Error("Limit: 120 nonempty lines");
      if (lines[0]?.text !== "def tick(unit, squad):" || lines[0].indent !== 0) throw Error("Begin with def tick(unit, squad):");
      let cursor = 1;
      body.push(...block(4, 0));
      if (cursor !== lines.length) throw Error("Only tick() is allowed at the top level");
      if (!calls.length) throw Error("Include at least one unit action");
    } catch (e) {
      errors.push(e.message);
    }
    const result = { body, errors, calls };
    if (cache.size > 200) cache.clear();
    cache.set(text, result);
    return result;
  }
  function execute(program, env, query, action) {
    const locals = /* @__PURE__ */ Object.create(null);
    let budget = 240;
    function read(ast) {
      if (--budget < 0) throw Error("Script instruction budget exceeded");
      if (Object.hasOwn(ast, "literal")) return ast.literal;
      if (ast.name) return ast.name.includes(".") ? env[ast.name] : locals[ast.name];
      if (ast.call) return query(ast.call, ast.args.map(read));
      if (ast.chain) {
        let a2 = read(ast.chain[0]);
        for (let i = 0; i < ast.operators.length; i++) {
          const b2 = read(ast.chain[i + 1]), op = ast.operators[i], valid = op === "==" ? a2 === b2 : op === "!=" ? a2 !== b2 : op === "<" ? a2 < b2 : op === ">" ? a2 > b2 : op === "<=" ? a2 <= b2 : a2 >= b2;
          if (!valid) return false;
          a2 = b2;
        }
        return true;
      }
      if (ast.op === "not") return !read(ast.value);
      if (ast.op === "neg") return -read(ast.value);
      const a = read(ast.left);
      if (ast.op === "and") return a && read(ast.right);
      if (ast.op === "or") return a || read(ast.right);
      const b = read(ast.right);
      switch (ast.op) {
        case "==":
          return a === b;
        case "!=":
          return a !== b;
        case "<":
          return a < b;
        case ">":
          return a > b;
        case "<=":
          return a <= b;
        case ">=":
          return a >= b;
        case "+":
          return Number(a) + Number(b);
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b ? a / b : 0;
        case "%":
          return b ? a % b : 0;
      }
    }
    function block(body) {
      for (const node of body) {
        if (--budget < 0) throw Error("Script instruction budget exceeded");
        if (node.kind === "return") return true;
        if (node.kind === "assign") locals[node.name] = read(node.value);
        if (node.kind === "action") action(node.method, node.args.map(read));
        if (node.kind === "if") {
          for (const branch of node.branches) if (branch.test === null || read(branch.test)) {
            if (block(branch.body)) return true;
            break;
          }
        }
      }
      return false;
    }
    block(program.body);
  }
  return { compile, execute };
})();
var methods = /* @__PURE__ */ new Set(["hold_range", "focus", "follow", "protect", "flank", "stance", "retreat_below", "move_to", "advance", "withdraw", "stop", "patrol", "rally", "spread", "tighten", "kite", "orbit", "zigzag", "seek_health", "seek_ammo", "seek_shield", "seek_boost", "reload", "cooldown", "reserve_fire", "anti_air", "avoid_danger", "guard_point", "brace", "ram", "hull_down", "armor_piercing", "smoke", "sprint", "ambush", "suppress", "grenade", "strafe", "hover", "flare", "rocket_pod", "lock_on", "backblast", "bunker_buster", "barrage", "siege", "displace", "steady", "headshot", "camouflage", "broadside", "depth_charge", "triage", "field_hospital", "repair", "supply", "scan", "mark", "focus_air", "focus_ground", "focus_armor", "focus_support", "focus_farthest", "focus_low_shield", "focus_high_damage", "focus_unmarked", "hold_fire", "fire_at_will", "seek_cover", "leave_cover", "retreat_to_spawn", "scan_fast", "repair_self", "boost", "vent_heat", "shield_pulse", "take_knee", "breakaway", "counter_battery", "shore_bombard", "recon_route", "save_rockets", "follow_patient", "follow_vehicle", "relocate", "cover_infantry"]);
var sensors = /* @__PURE__ */ new Set(["unit.hp_ratio", "unit.ammo_ratio", "unit.energy_ratio", "unit.heat_ratio", "unit.kind", "unit.tier", "unit.callsign", "unit.x", "unit.y", "unit.shield", "unit.reserve_ammo", "unit.reloading", "unit.enemy_distance", "unit.enemy_kind", "unit.has_enemy", "unit.in_cover", "unit.moving", "unit.cooldown", "squad.ally_count", "squad.enemy_count", "squad.leader_alive", "squad.lowest_ally_hp", "squad.elapsed", "squad.map"]);
var queries = /* @__PURE__ */ new Set(["unit.distance_to", "unit.ally_health", "unit.ally_alive", "unit.enemies_within", "unit.allies_within", "unit.air_enemies_within", "unit.armored_enemies_within", "unit.foot_enemies_within", "unit.health_drop_distance", "unit.ammo_drop_distance", "unit.shield_drop_distance", "unit.boost_drop_distance", "unit.nearest_cover_distance", "unit.enemy_shield", "unit.enemy_health", "unit.incoming_shots", "unit.has_ammo", "unit.can_fire", "unit.can_afford", "unit.ability_ready", "unit.map_is", "unit.is_type", "squad.has_type", "squad.count_type", "squad.injured_allies"]);
function validatePython(text) {
  const result = PythonUnit.compile(text, methods, sensors, queries);
  if (result.errors.length) throw Error(result.errors.join(" \xB7 "));
  return text;
}

// cloud/scoring.mjs
function battlePoints(win, units, team = "player") {
  const defeated = units.filter((u) => u.team !== team && u.hp <= 0).length;
  const surviving = units.filter((u) => u.team === team && u.hp > 0).length;
  const outcome = win ? 100 : 20, eliminations = defeated * 25, survival = surviving * 10;
  return { total: outcome + eliminations + survival, outcome, eliminations, survival };
}

// dist/server/index.js
var types = ["tank", "infantry", "rocket", "scout", "sniper", "medic", "artillery", "engineer", "boat", "helicopter"];
var unlock = { tank: 1, infantry: 1, rocket: 1, scout: 2, sniper: 3, medic: 3, artillery: 4, engineer: 4, boat: 5, helicopter: 6 };
var ranges = { tank: 255, infantry: 215, rocket: 320, scout: 245, sniper: 390, medic: 180, artillery: 420, engineer: 195, boat: 340, helicopter: 290 };
var names = { tank: "Tank", infantry: "Infantry", rocket: "Rocket soldier", scout: "Scout car", sniper: "Sniper", medic: "Medic", artillery: "Artillery", engineer: "Engineer", boat: "Boat", helicopter: "Helicopter" };
var token = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((v) => v.toString(16).padStart(2, "0")).join("");
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
var baseScript = (type) => 'def tick(unit, squad):\n    unit.focus("nearest")\n    unit.hold_range(' + ranges[type] + ")";
function newUnit(type, id) {
  return { id, type, tier: 1, name: names[type], unitScript: baseScript(type), instruction: baseScript(type), equipment: {}, upgrades: {}, skin: "olive", deployed: true, commands: ["radar", "gun", "drive"] };
}
function strength(units) {
  return Math.round(units.reduce((n, u) => n + 100 * (1 + 0.8 * (u.tier - 1)) + Object.keys(u.equipment).length * 12, 0));
}
async function account(env, input) {
  if (["units", "credits", "resources", "slots", "tier", "upgrades", "inventory", "winner", "reward", "points", "score"].some((k) => Object.hasOwn(input, k))) throw Error("Online units and resources are server-owned. Submit scripts or a store action only.");
  let row = null, id = input.profile?.id, key = input.profile?.token;
  if (id) {
    row = await env.DB.prepare("SELECT * FROM arena_profiles WHERE id=?").bind(id).first();
    if (!row || !key || row.token !== key) throw Error("Invalid player profile");
  } else {
    id = token(12);
    key = token(24);
  }
  const owned = row?.owned ? JSON.parse(row.owned) : { roster: [newUnit("tank", "online-1")], credits: 0, slots: 1, gear: [], serial: 1 };
  return { id, key, row, original: row?.owned || "", owned };
}
function catalog(a, level) {
  const list = [{ id: "slot", name: "Online team slot", price: 100 + (a.owned.slots - 1) * 50 }];
  for (const type of types) if (level >= unlock[type]) list.push({ id: "recruit:" + type, name: "Recruit " + names[type], price: 110 + types.indexOf(type) * 15 });
  for (const slot of ["weapon", "armor", "utility"]) for (let i = 0; i < 10; i++) {
    const id = slot + "-" + i;
    if (!a.owned.gear.includes(id)) list.push({ id: "gear:" + id, name: slot + " " + (i + 1), price: (slot === "weapon" ? 60 : slot === "armor" ? 55 : 50) + i * (slot === "weapon" ? 18 : slot === "armor" ? 15 : 14) });
  }
  return list;
}
async function saveAccount(env, input, item = null) {
  const a = await account(env, input), owned = a.owned, name = String(input.name || a.row?.name || "Commander").trim().slice(0, 28) || "Commander", map = ["urban", "canyon", "volcanic", "coast"].includes(input.map) ? input.map : a.row?.map || "urban";
  const score = await env.DB.prepare("SELECT COUNT(*) AS wins FROM arena_results WHERE winner=?").bind(a.id).first(), level = 1 + Math.floor((score?.wins || 0) / 2);
  if (input.scripts !== void 0) {
    if (!Array.isArray(input.scripts) || input.scripts.length > owned.roster.length) throw Error("Only owned units can receive scripts");
    const seen = /* @__PURE__ */ new Set();
    for (const edit of input.scripts) {
      if (!edit || Object.keys(edit).some((k) => !["id", "unitScript", "name", "deployed"].includes(k))) throw Error("Only scripts, names and deployment can be edited");
      const unit = owned.roster.find((u) => u.id === edit.id);
      if (!unit || seen.has(edit.id)) throw Error("Unit not owned");
      seen.add(edit.id);
      unit.unitScript = validatePython(edit.unitScript);
      unit.instruction = unit.unitScript;
      if (typeof edit.name === "string") unit.name = edit.name.slice(0, 28);
      if (typeof edit.deployed === "boolean") unit.deployed = edit.deployed;
    }
  }
  if (input.squadScript !== void 0) {
    if (typeof input.squadScript !== "string") throw Error("Invalid squad script");
    owned.squadScript = input.squadScript ? validatePython(input.squadScript) : "";
  }
  if (item) {
    if (typeof item !== "string") throw Error("Invalid store item");
    if (item.startsWith("equip:")) {
      const [, id, gear] = item.split(":"), unit = owned.roster.find((u) => u.id === id);
      if (!unit || !owned.gear.includes(gear)) throw Error("Unit or equipment not owned");
      unit.equipment[gear.split("-")[0]] = gear;
    } else if (item.startsWith("combine:")) {
      const [, type, star] = item.split(":"), tier = Number(star), matches = owned.roster.filter((u) => u.type === type && u.tier === tier);
      if (matches.length < 3 || tier >= 3 || tier < 1) throw Error("Need three owned matching units");
      const keep = matches[0];
      keep.tier++;
      keep.commands = ["radar", "gun", "drive", "cover", "duck", ...keep.tier === 3 ? ["perch", "retreat"] : []];
      owned.roster = owned.roster.filter((u) => !matches.slice(1, 3).includes(u));
    } else {
      const offer = catalog(a, level).find((o) => o.id === item);
      if (!offer) throw Error("Item locked or already owned");
      if (owned.credits < offer.price) throw Error("Not enough server credits");
      if (item === "slot" && owned.slots >= 15) throw Error("Maximum slots reached");
      if (item.startsWith("recruit:") && owned.roster.length >= owned.slots) throw Error("Buy an online team slot first");
      owned.credits -= offer.price;
      if (item === "slot") owned.slots++;
      else if (item.startsWith("recruit:")) owned.roster.push(newUnit(item.slice(8), "online-" + ++owned.serial));
      else owned.gear.push(item.slice(5));
    }
  }
  const units = owned.roster.filter((u) => u.deployed !== false && (u.type !== "boat" || map === "coast")).map((u) => ({ ...u, squadScript: u.unitScript, squadPython: owned.squadScript || "" }));
  if (!units.length) throw Error("Deploy at least one compatible owned unit");
  const power = strength(units), serialized = JSON.stringify(owned), now = Date.now();
  if (a.row) {
    const saved = await env.DB.prepare("UPDATE arena_profiles SET name=?,units=?,map=?,power=?,updated=?,owned=? WHERE id=? AND COALESCE(owned,'')=?").bind(name, JSON.stringify(units), map, power, now, serialized, a.id, a.original).run();
    if (!saved.meta.changes) throw Error("Account changed during request; reload and retry");
  } else await env.DB.prepare("INSERT INTO arena_profiles (id,token,name,units,map,power,updated,owned) VALUES (?,?,?,?,?,?,?,?)").bind(a.id, a.key, name, JSON.stringify(units), map, power, now, serialized).run();
  return { profile: { id: a.id, token: a.key }, account: owned, catalog: catalog(a, level), level, power, units, map };
}
async function activeMatch(env, id) {
  return env.DB.prepare("SELECT code FROM arena_matches WHERE (attacker=? OR defender=?) AND expires>? AND (state IS NULL OR json_extract(state,'$.mode')='running') LIMIT 1").bind(id, id, Date.now()).first();
}
async function award(env, row, state) {
  if (!row.attacker || !row.defender) return;
  const winner = state.mode === "won" ? row.attacker : row.defender, loser = state.mode === "won" ? row.defender : row.attacker;
  await env.DB.prepare("INSERT OR IGNORE INTO arena_results (code,winner,loser,completed,paid,winner_points,loser_points) VALUES (?,?,?,?,0,?,?)").bind(row.code, winner, loser, Date.now(), battlePoints(true, state.battleUnits, state.mode === "won" ? "player" : "enemy").total, battlePoints(false, state.battleUnits, state.mode === "won" ? "enemy" : "player").total).run();
  await env.DB.batch([env.DB.prepare("UPDATE arena_profiles SET owned=json_set(owned,'$.credits',json_extract(owned,'$.credits')+60) WHERE id=? AND owned IS NOT NULL AND EXISTS(SELECT 1 FROM arena_results WHERE code=? AND paid=0)").bind(winner, row.code), env.DB.prepare("UPDATE arena_profiles SET owned=json_set(owned,'$.credits',json_extract(owned,'$.credits')+15) WHERE id=? AND owned IS NOT NULL AND EXISTS(SELECT 1 FROM arena_results WHERE code=? AND paid=0)").bind(loser, row.code), env.DB.prepare("UPDATE arena_results SET paid=1 WHERE code=? AND paid=0").bind(row.code)]);
}
var index_default = { async fetch(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/status") return json({ available: false, model: "External Python script authoring", location: "No in-game model" });
    if (url.pathname === "/api/plan" || url.pathname === "/api/squad-chat") return json({ error: "Paste Python scripts generated by your own LLM." }, 410);
    if (!url.pathname.startsWith("/api/matches")) return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: "Match database unavailable" }, 503);
    if (request.method === "GET" && url.pathname === "/api/matches/leaderboard") {
      const result = await env.DB.prepare("SELECT p.name,p.power,COALESCE((SELECT SUM(winner_points) FROM arena_results WHERE winner=p.id),0)+COALESCE((SELECT SUM(loser_points) FROM arena_results WHERE loser=p.id),0) AS points,(SELECT COUNT(*) FROM arena_results WHERE winner=p.id) AS wins,(SELECT COUNT(*) FROM arena_results WHERE loser=p.id) AS losses FROM arena_profiles p WHERE p.owned IS NOT NULL ORDER BY points DESC,wins DESC,losses ASC,p.updated DESC LIMIT 30").all();
      return json({ players: result.results });
    }
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 65e3) return json({ error: "Request too large" }, 413);
      const input = JSON.parse(raw);
      if (url.pathname === "/api/matches/cancel") {
        const a = await account(env, input);
        await env.DB.prepare("UPDATE arena_matches SET expires=? WHERE code=? AND attacker=? AND token_b IS NULL").bind(Date.now(), input.code, a.id).run();
        return json({ status: "cancelled" });
      }
      if (url.pathname === "/api/matches/profile" || url.pathname === "/api/matches/shop") {
        const data = await saveAccount(env, input, url.pathname.endsWith("/shop") ? input.item : null);
        return json(data);
      }
      if (url.pathname === "/api/matches/random" || url.pathname === "/api/matches/create") {
        const defense = await saveAccount(env, input);
        if (await activeMatch(env, defense.profile.id)) throw Error("An online match is already active. Reconnect or cancel the waiting invite.");
        const code = token(3).toUpperCase(), session = token(24), seed = crypto.getRandomValues(new Uint32Array(1))[0], now = Date.now();
        if (url.pathname.endsWith("/create")) {
          await env.DB.prepare("INSERT INTO arena_matches (code,token_a,units_a,map,seed,updated,expires,revision,attacker) VALUES (?,?,?,?,?,?,?,0,?)").bind(code, session, JSON.stringify(defense.units), defense.map, seed, now, now + 9e5, defense.profile.id).run();
          return json({ ...defense, code, token: session, status: "waiting", seat: 0 });
        }
        const candidates = await env.DB.prepare("SELECT id,units,map,power FROM arena_profiles WHERE id<>? AND owned IS NOT NULL AND map=? AND power BETWEEN ? AND ? ORDER BY ABS(power-?) LIMIT 20").bind(defense.profile.id, defense.map, defense.power * 0.65, defense.power * 1.35, defense.power).all();
        if (!candidates.results.length) return json({ ...defense, status: "empty" });
        const opponent = candidates.results[crypto.getRandomValues(new Uint32Array(1))[0] % candidates.results.length], b = JSON.parse(opponent.units).map((u, i) => ({ ...u, id: "defender-" + i })), engine = createEngine(defense.units, b, defense.map, seed);
        await env.DB.prepare("INSERT INTO arena_matches (code,token_a,token_b,units_a,units_b,map,seed,state,updated,expires,revision,attacker,defender) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)").bind(code, session, token(24), JSON.stringify(defense.units), JSON.stringify(b), defense.map, seed, JSON.stringify(engine.state()), now, now + 9e5, defense.profile.id, opponent.id).run();
        return json({ ...defense, code, token: session, status: "running", seat: 0 });
      }
      if (url.pathname === "/api/matches/join") {
        const code = String(input.code || "").toUpperCase(), row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=? AND expires>?").bind(code, Date.now()).first();
        if (!row) throw Error("Match not found or expired");
        if (row.token_b) throw Error("Match already has two players");
        const defense = await saveAccount(env, { ...input, map: row.map });
        if (row.attacker === defense.profile.id) throw Error("Cannot fight your own profile");
        if (await activeMatch(env, defense.profile.id)) throw Error("An online match is already active");
        const session = token(24), b = defense.units.map((u, i) => ({ ...u, id: "defender-" + i })), engine = createEngine(JSON.parse(row.units_a), b, row.map, row.seed), result = await env.DB.prepare("UPDATE arena_matches SET token_b=?,units_b=?,state=?,updated=?,revision=revision+1,defender=? WHERE code=? AND token_b IS NULL").bind(session, JSON.stringify(b), JSON.stringify(engine.state()), Date.now(), defense.profile.id, code).run();
        if (!result.meta.changes) throw Error("Match already joined");
        return json({ ...defense, code, token: session, status: "running", seat: 1 });
      }
    }
    if (request.method === "GET") {
      const code = url.searchParams.get("code"), key = request.headers.get("x-match-token");
      let row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=? AND expires>?").bind(code, Date.now()).first();
      if (!row) throw Error("Match not found or expired");
      const seat = key === row.token_a ? 0 : key === row.token_b ? 1 : -1;
      if (seat < 0 || !key) return json({ error: "Invalid session token" }, 403);
      if (!row.token_b) return json({ code, status: "waiting", seat });
      let state = JSON.parse(row.state);
      if (state.mode === "running") {
        const now = Date.now(), engine = createEngine(JSON.parse(row.units_a), JSON.parse(row.units_b), row.map, row.seed, state);
        engine.tick(Math.min(2, (now - row.updated) / 1e3));
        state = engine.state();
        const saved = await env.DB.prepare("UPDATE arena_matches SET state=?,updated=?,revision=revision+1 WHERE code=? AND revision=?").bind(JSON.stringify(state), now, code, row.revision).run();
        if (!saved.meta.changes) {
          row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=?").bind(code).first();
          state = JSON.parse(row.state);
        }
      }
      if (state.mode !== "running") await award(env, row, state);
      return json({ code, seat, seed: row.seed, map: row.map, status: state.mode === "running" ? "running" : "finished", winner: state.mode === "won" ? 0 : 1, points: state.mode === "running" ? 0 : battlePoints((state.mode === "won" ? 0 : 1) === seat, state.battleUnits, seat === 0 ? "player" : "enemy").total, ...state });
    }
    return json({ error: "Unknown match action" }, 400);
  } catch (e) {
    console.error("Arena API:", e.message);
    return json({ error: e.message }, 400);
  }
} };
export {
  index_default as default
};
