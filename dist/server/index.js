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
  const W = canvas.width, H = canvas.height;
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
  let commands2 = /* @__PURE__ */ new Set(["radar", "gun", "drive", "cover"]), round = 1, wins = 0, mode = "ready", player = null, enemy = null, shots = [], sparks = [], plan = null, last = performance.now(), elapsed = 0, logTimer = 0, nextBuff = null, activeBuff = null;
  const $ = (id) => document.getElementById(id);
  function commandRender() {
    const root = $("commands");
    root.replaceChildren();
    for (const [id, name, desc] of commandInfo) {
      const b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "command" + (commands2.has(id) ? " selected" : "");
      b2.textContent = name;
      b2.title = desc;
      b2.setAttribute("aria-label", name + ": " + desc);
      b2.setAttribute("aria-pressed", commands2.has(id));
      b2.onclick = () => {
        if (mode === "running" || mode === "won" || compiling) return;
        if (commands2.has(id)) commands2.delete(id);
        else commands2.add(id);
        commandRender();
        preview();
        $("message").textContent = name + " command " + (commands2.has(id) ? "enabled." : "disabled.");
      };
      root.append(b2);
    }
  }
  function parsePlan() {
    if (compiledPlan && compiledText === $("prompt").value) return { ...compiledPlan, cover: compiledPlan.cover && commands2.has("cover") };
    const s = $("prompt").value.toLowerCase();
    const style = /snip|keep distance|long.range|perch|stay back/.test(s) ? "sniper" : /rush|aggress|charge|close|push forward/.test(s) ? "rush" : "balanced";
    return { coverBelow: 0.52, retreatBelow: 0.28, firePolicy: "always", style, cover: commands2.has("cover") && /cover|hide|shelter/.test(s), evade: /evade|dodge|zigzag|strafe/.test(s), retreat: /retreat|fall back|pull back/.test(s), preferred: style === "sniper" ? 360 : style === "rush" ? 145 : 255 };
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
    if (commands2.has("perch") && plan.style === "sniper") parts.push("steady sniper aim");
    if (!commands2.has("gun")) parts.push("Gun command off");
    if (!commands2.has("drive")) parts.push("Drive command off");
    $("planPreview").textContent = parts.join(" \xB7 ") + " \xB7 Fire: " + plan.firePolicy + (compiledPlan && compiledText === $("prompt").value ? ". " + compiledPlan.explanation : ". Rule parser preview.");
    if (mode !== "running") updateProgramLive("Awaiting deployment");
    renderStats();
  }
  function renderStats() {
    const root = $("statList");
    root.replaceChildren();
    const isRush = plan?.style === "rush", isSnipe = plan?.style === "sniper", speed = 104 * (activeBuff?.kind === "speed" ? 1.15 : 1), damage = 24 * (activeBuff?.kind === "damage" ? 1.2 : 1), spread = isSnipe ? commands2.has("perch") ? 0.025 : 0.045 : isRush ? 0.16 : 0.09, radar = commands2.has("radar") ? commands2.has("perch") && isSnipe ? 650 : 580 : 240;
    const stats = [["Hull integrity", "160 HP"], ["Magazine", (player?.ammo ?? 6) + " / 6 rounds"], ["Magazine reload", "2.4 sec"], ["Turret traverse", "160\xB0 / sec"], ["Gun damage", commands2.has("gun") ? damage.toFixed(1) : "Gun off"], ["Reload time", commands2.has("gun") ? (isRush ? 0.64 : isSnipe ? 0.9 : 0.77) + " sec" : "Gun off"], ["Tank speed", commands2.has("drive") ? speed.toFixed(0) + " units/s" : "Drive off"], ["Radar range", radar + " units"], ["Preferred range", plan.preferred + " units"], ["Aim spread", (spread * 180 / Math.PI).toFixed(1) + "\xB0"], ["Cover reduction", plan.cover ? "28% near cover" : "Off"], ["Duck dodge", commands2.has("duck") && plan.evade ? "17%" : "Off"], ["Round buff", activeBuff ? activeBuff.buff : nextBuff ? nextBuff.buff + " (next)" : "None"]];
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
    const cell = 28, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), index = (x, y) => y * cols + x, point = (i) => [(i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.5) * cell], free = (i) => {
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
    const isP = t.team === "player", speed = 450, baseDamage = isP ? 24 : 17 + round * 2, damage = baseDamage * (isP && activeBuff?.kind === "damage" ? 1.2 : 1), spread = isP ? plan.style === "sniper" ? commands2.has("perch") ? 0.025 : 0.045 : plan.style === "rush" ? 0.16 : 0.09 : 0.15;
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
    if (!isP || commands2.has("drive")) moveTank(t, mx, my, speed, dt);
    else action = "Holding position (Drive off)";
    const aim = Math.atan2(foe.y - t.y, foe.x - t.x), turn = Math.atan2(Math.sin(aim - t.angle), Math.cos(aim - t.angle));
    t.angle += clamp(turn, -2.8 * dt, 2.8 * dt);
    const sensor = isP ? commands2.has("radar") ? commands2.has("perch") && p.style === "sniper" ? 650 : 580 : 240 : 580;
    if (isP && !commands2.has("radar") && dist > sensor) action = "Searching without Radar";
    const policyOK = p.firePolicy === "always" || (p.firePolicy === "inRange" ? Math.abs(dist - p.preferred) <= 45 : !commands2.has("drive") || Math.hypot(mx, my) < 0.1);
    if (t.reloading > 0) action = "Reloading magazine \xB7 " + t.reloading.toFixed(1) + "s";
    if (t.ammo > 0 && t.reloading <= 0 && Math.abs(turn) < 0.12 && policyOK && t.cooldown <= 0 && dist < sensor && (t.stats.flying || t.stats.indirect || !lineBlocked(t.x, t.y, foe.x, foe.y)) && (!isP || commands2.has("gun"))) {
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
        if (target.team === "player" && commands2.has("duck") && plan.evade && random() < 0.17) damage = 0;
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
      const out = await requestLocalPlan(text, selectedUnit(), [...commands2]);
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
  checkModel();
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
  const rosterKey = "tank-tactics-roster-v1";
  let roster = [], selectedId = "", rosterSerial = 0, economy = { credits: 100, slots: 1, reserve: {} };
  let levelReward = null;
  function newUnit(type, tier = 1) {
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
    u.commands = [...commands2];
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
    roster.push(newUnit("tank"));
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
    commands2 = new Set((u.instruction ? u.commands : unlocked(u)).filter((c) => unlocked(u).includes(c)));
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
    const active = group.find((u) => u.id === selectedId), consumed = active ? [active, ...group.filter((u) => u !== active).slice(0, 2)] : group.slice(0, 3), base = active || consumed[0], up = newUnit(type, tier + 1);
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
    p.evade = p.evade && commands2.has("duck");
    p.retreat = p.retreat && commands2.has("retreat");
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
    const isP = t.team === "player", s = t.stats, speed = t.type === "rocket" ? 330 : t.type === "artillery" ? 290 : 550, damage = s.damage * (isP && activeBuff?.kind === "damage" ? 1.2 : 1), spread = s.spread * (isP && commands2.has("perch") ? 0.5 : 1), a2 = t.angle + (random() - 0.5) * spread;
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
    roster.push(newUnit(type));
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
    h.textContent = levelReward.unit ? "\u2713 Random recruit claimed" : "1 / Random unit reward";
    root.append(h);
    if (levelReward.unit) {
      const p = document.createElement("p");
      p.textContent = levelReward.unit;
      root.append(p);
    } else {
      const type = levelReward.offerType;
      root.append(rewardButton("Recruit " + unitTypes[type].name + " \u2605", roster.length < economy.slots ? "Add your randomly awarded unit" : "Team full \xB7 recruit waits in reserve", () => chooseReward({ unitType: type, action: "add" })));
    }
    const th = document.createElement("h3");
    th.textContent = levelReward.tactic ? "\u2713 Squad instruction claimed" : "2 / Squad instruction upgrade";
    root.append(th);
    if (levelReward.tactic) {
      const p = document.createElement("p");
      p.textContent = levelReward.tactic.instruction + " " + levelReward.tactic.effect;
      root.append(p);
    } else for (const option of rewardOptions) root.append(rewardButton(option.instruction, option.buff + " \xB7 " + option.effect, () => chooseReward(option)));
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
      if (levelReward.unit || option.action !== "add" || option.unitType !== levelReward.offerType) return;
      saveProgram();
      if (option.action === "upgrade") {
        const u = roster.find((u2) => u2.id === option.unitId && u2.type === option.unitType && u2.tier < 3);
        if (!u) return;
        u.tier++;
        u.commands = [.../* @__PURE__ */ new Set([...u.commands, ...unlocked(u)])];
        if (u.id === selectedId) commands2 = new Set(u.commands);
        compiledPlan = null;
        compiledText = "";
        commandRender();
        preview();
        levelReward.unit = unitTypes[u.type].name + " promoted to " + "\u2605".repeat(u.tier);
      } else if (option.action === "add") {
        if (roster.length < economy.slots) {
          roster.push(newUnit(option.unitType));
          levelReward.unit = unitTypes[option.unitType].name + " \u2605 added to team";
        } else {
          economy.reserve[option.unitType] = (economy.reserve[option.unitType] || 0) + 1;
          levelReward.unit = unitTypes[option.unitType].name + " \u2605 waiting in reserve";
        }
      } else return;
      saveRoster();
      renderRoster();
    } else {
      if (levelReward.tactic || !rewardOptions.includes(option)) return;
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
      levelReward = { unit: null, tactic: null, offerType: Object.keys(unitTypes).filter((t) => t !== "boat" || campaign.map === "coast")[Math.floor(random() * Object.keys(unitTypes).filter((t) => t !== "boat" || campaign.map === "coast").length)] };
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
  let campaign = { lives: 3, map: "urban", view: "2d", gear: [], cosmeticCoins: 0, skins: ["olive"], skin: "olive" }, battleUnits = [], replayRecord = null, replaying = false, replayInputs = null, damageEvents = [], replaySaved = null, pickups = [];
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
  function applyMap() {
    if (!maps[campaign.map]) campaign.map = "urban";
    rocks.splice(0, rocks.length, ...maps[campaign.map].map((o) => ({ ...o })));
    for (const b2 of campaign.base || []) if (b2.kind === "wall" && !onlinePlaying) rocks.push({ x: b2.x - 18 - (b2.tier - 1) * 4, y: b2.y - 40, w: 36 + (b2.tier - 1) * 8, h: 80 });
    $("mapSelect").value = campaign.map;
    $("viewSelect").value = campaign.view;
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
      const fresh = newUnit(u.type, u.tier);
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
    const x = team === "player" ? 80 + Math.floor(index / 6) * 55 : W - 80 - Math.floor(index / 6) * 55, y = sea ? 360 + index % 3 * 65 : campaign.map === "coast" ? 55 + index % 4 * 65 : 55 + index % 6 * 88;
    return { team, id: u.id, type: u.type, tier: u.tier, stats: s, x, y, velocity: 0, heading: team === "player" ? 0 : Math.PI, reserve: s.ammoReserve, shieldDelay: 0, dodgeCooldown: 0, boostTime: 0, angle: team === "player" ? 0 : Math.PI, hp: s.hp, maxHp: s.hp, r: s.r, cooldown: 0.5 + index * 0.07, hitFlash: 0, phase: 0, ammo: s.mag, reloading: 0, heat: 0, shield: s.shieldCapacity, energy: s.energyCapacity, commands: team === "player" ? [...u.instruction ? u.commands : unlocked(u)] : unlocked(u), plan: team === "player" ? planForUnit(u) : { style: "balanced", preferred: s.range, cover: true, coverBelow: 0.4, evade: u.tier >= 2, retreat: u.tier >= 3, retreatBelow: 0.2, firePolicy: "always" }, lock: 0, scan: 0, target: null };
  }
  resetPositions = function() {
    applyMap();
    const squad2 = roster.filter((u) => u.deployed !== false && (!unitTypes[u.type].water || campaign.map === "coast")).slice(0, 15);
    const team = squad2.length ? squad2 : [selectedUnit()];
    battleUnits = team.map((u, i) => spawnCombat(u, "player", i, team.length));
    for (let i = 0; i < Math.min(15, 1 + Math.floor((round - 1) / 2)); i++) {
      const types2 = Object.keys(unitTypes).filter((t) => !unitTypes[t].water || campaign.map === "coast"), type = round === 1 ? "tank" : types2[(i + round - 1) % types2.length];
      battleUnits.push(spawnCombat({ id: "enemy-" + i, type, tier: Math.min(3, 1 + Math.floor((round - 1) / 4)), equipment: {} }, "enemy", i, team.length));
    }
    player = battleUnits.find((u) => u.id === selectedId) || battleUnits[0];
    enemy = battleUnits.find((u) => u.team === "enemy");
    shots = [];
    sparks = [];
    elapsed = 0;
    seed = 12345 + round;
    accumulator = 0;
    damageEvents = [];
    pickups = [{ x: 220, y: 280, used: false }, { x: 700, y: 280, used: false }];
    updateHud();
  };
  function canMove(t, x, y) {
    if (x < t.r || x > W - t.r || y < t.r || y > H - t.r) return false;
    if (t.stats.flying) return true;
    if (campaign.map === "coast" && (t.stats.water ? y < 335 : y > 300)) return false;
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
    const s = t.stats, p = t.plan, spread = 1 / s.accuracy * (t.commands.includes("perch") ? 0.5 : 1), a2 = t.angle + (random() - 0.5) * spread, crit = random() < s.critChance;
    t.ammo--;
    t.heat += s.heatPerShot;
    if (!t.ammo) t.reloading = s.magazineCapacity / s.loadingSpeed + s.reloadDelay;
    const damage = s.damage * (crit ? s.critMultiplier : 1) * (t.team === "player" && activeBuff?.kind === "damage" ? 1.2 : 1);
    shots.push({ team: t.team, owner: t.id, x: t.x + Math.cos(a2) * (t.r + 5), y: t.y + Math.sin(a2) * (t.r + 5), vx: Math.cos(a2) * s.projectileSpeed, vy: Math.sin(a2) * s.projectileSpeed, damage, life: 2.5, indirect: s.indirect || s.flying, radius: s.explosionRadius, penetration: s.penetration, crit });
    t.cooldown = s.reload * (p.style === "rush" ? 0.85 : 1);
  }
  function squadTick(t, dt) {
    if (t.hp <= 0) return;
    const s = t.stats, p = t.plan;
    t.phase += dt;
    t.cooldown -= dt;
    t.dodgeCooldown = Math.max(0, t.dodgeCooldown - dt);
    t.shieldDelay = Math.max(0, t.shieldDelay - dt);
    t.boostTime = Math.max(0, t.boostTime - dt);
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    t.heat = Math.max(0, t.heat - s.coolingRate * dt);
    t.energy = Math.min(s.energyCapacity, t.energy + s.energyRegeneration * dt);
    t.hp = Math.min(t.maxHp, t.hp + s.repairRate * dt);
    if (t.shieldDelay <= 0) t.shield = Math.min(s.shieldCapacity, t.shield + s.shieldRecharge * dt);
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
        const waypoint = pathStep(t, { x: t.x + mx, y: t.y + my });
        mx = waypoint[0] - t.x;
        my = waypoint[1] - t.y;
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
    if (p.evade) {
      mx -= uy * Math.sin(t.phase * 5) * 0.6;
      my += ux * Math.sin(t.phase * 5) * 0.6;
    }
    const moving = t.commands.includes("drive") && Math.hypot(mx, my) > 0.01;
    if (moving && p.style === "rush" && t.energy > 25 && t.boostTime <= 0) {
      t.boostTime = 1.5;
      t.energy -= 25;
    }
    const topSpeed = s.speed * (t.boostTime > 0 ? 1.15 : 1) * (t.team === "player" && activeBuff?.kind === "speed" ? 1.15 : 1);
    t.velocity = moving ? Math.min(topSpeed, t.velocity + s.acceleration * dt) : Math.max(0, t.velocity - s.braking * dt);
    if (moving) squadMove(t, mx, my, dt);
    const aim = Math.atan2(dy, dx), turn = Math.atan2(Math.sin(aim - t.angle), Math.cos(aim - t.angle));
    t.angle += clamp(turn, -s.turretTurnRate * dt, s.turretTurnRate * dt);
    const sensor = t.commands.includes("radar") ? s.radarRange : 240, policy = p.firePolicy === "always" || (p.firePolicy === "inRange" ? Math.abs(dist - p.preferred) < 45 : Math.hypot(mx, my) < 0.1);
    if (!blocked && dist < sensor && Math.abs(turn) < 0.15) t.lock += dt;
    else t.lock = 0;
    if (t.commands.includes("gun") && t.ammo > 0 && t.reloading <= 0 && t.cooldown <= 0 && t.heat < s.heatCapacity && policy && t.lock >= s.targetLockTime + foe.stats.ecmStrength * 0.4) {
      squadFire(t, foe);
      action = "Firing";
    }
    if (t.id === selectedId) updateProgramLive(action);
    if (campaign.map === "volcanic" && Math.hypot(t.x - 460, t.y - 280) < 70 && !s.flying) t.hp = Math.max(0, t.hp - 12 * dt);
  }
  function takeHit(t, s, scale = 1) {
    let damage = s.damage * scale * (1 - Math.max(0, t.stats.armor - s.penetration)) * (1 - t.stats.damageResistance);
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
          pickup.used = true;
          t.hp = Math.min(t.maxHp, t.hp + 20 * t.stats.repairRate);
          t.reserve += 12;
          t.energy = Math.min(t.stats.energyCapacity, t.energy + 25);
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
      const wall = !s.indirect && lineBlocked(px, py, s.x, s.y);
      if (hit && !wall) {
        takeHit(hit, s);
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
    if (!allies.some((t) => t.hp > 0) || !foes.some((t) => t.hp > 0) || elapsed >= 60) {
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
      replayInputs = JSON.parse(JSON.stringify({ roster, selectedId, map: campaign.map, base: campaign.base, round, prompt: $("prompt").value, commands: [...commands2], compiledPlan, compiledText, activeBuff }));
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
      prism(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2, t.stats.flying ? 80 : 25, color);
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
    commands2 = s.commands;
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
    replaySaved = { roster, selectedId, round, campaign: { ...campaign }, prompt: $("prompt").value, commands: commands2, compiledPlan, compiledText, activeBuff };
    replaying = true;
    roster = JSON.parse(JSON.stringify(replayRecord.roster));
    selectedId = replayRecord.selectedId;
    round = replayRecord.round;
    campaign.map = replayRecord.map;
    campaign.base = JSON.parse(JSON.stringify(replayRecord.base || []));
    commands2 = new Set(replayRecord.commands);
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
        rewardOptions[0].instruction = generated;
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
      campaign.map = data.map;
      applyMap();
      battleUnits = data.battleUnits.map((t) => ({ ...t, team: data.seat === 0 ? t.team : t.team === "player" ? "enemy" : "player" }));
      shots = data.shots.map((s) => ({ ...s, team: data.seat === 0 ? s.team : s.team === "player" ? "enemy" : "player" }));
      sparks = data.sparks;
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
        mode = data.winner === data.seat ? "won" : "lost";
        $("prompt").disabled = false;
        $("deploy").disabled = false;
        $("result").classList.add("show");
        $("resultTitle").textContent = mode === "won" ? "Multiplayer victory" : "Multiplayer defeat";
        $("resultText").textContent = "Server confirmed result. This test match does not grant campaign rewards.";
        onlineSession = null;
        localStorage.removeItem("tank-match-v1");
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
      roster = [newUnit("tank")];
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
    if (order.focus) return foes.sort((a2, b2) => Math.hypot(a2.x - (leader || t).x, a2.y - (leader || t).y) - Math.hypot(b2.x - (leader || t).x, b2.y - (leader || t).y))[0];
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
    commands2 = new Set(unlocked(selectedUnit()));
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
    roster = [newUnit("tank")];
    selectedId = roster[0].id;
    economy.reserve = {};
    squadScript = defaultSquadScript;
    compiledPlan = null;
    compiledText = "";
    $("prompt").value = squadScript;
    commands2 = new Set(unlocked(roster[0]));
    continueRunReset();
    saveProgram();
    $("message").textContent = "New run: one tank versus one AI tank. Recruit allies from victory rewards.";
  };
  $("reset").onclick = () => resetRun();
  for (const u of roster) {
    u.instruction = squadScript;
    u.squadScript = squadScript;
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
  const initial = selectedUnit();
  selectedId = initial.id;
  commands2 = new Set((initial.instruction ? initial.commands : unlocked(initial)).filter((c) => unlocked(initial).includes(c)));
  if (initial.instruction) $("prompt").value = initial.instruction;
  else $("prompt").value = "Keep moving, fire in range, and hold " + unitStats().range + " range.";
  saveRoster();
  renderRoster();
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
  commands2 = new Set(a[0].commands);
  $("prompt").value = a[0].instruction;
  compiledPlan = a[0].compiled;
  compiledText = a[0].instruction;
  resetPositions();
  battleUnits = battleUnits.filter((u) => u.team === "player");
  for (let i = 0; i < b.length; i++) {
    const t = spawnCombat(b[i], "player", i, b.length);
    t.team = "enemy";
    t.x = 840 - Math.floor(i / 6) * 55;
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
    return JSON.parse(JSON.stringify({ mode, elapsed, seed, battleUnits: battleUnits.map((t) => ({ ...t, target: null, targetId: t.target?.id || null })), shots, sparks, pickups, damageEvents }, (key, value) => key === "target" ? void 0 : value));
  } };
}

// dist/server/index.js
var types = ["tank", "infantry", "helicopter", "rocket", "artillery", "sniper", "boat"];
var commands = ["radar", "gun", "drive", "cover", "duck", "perch", "retreat"];
function randomToken(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function squad(input, prefix) {
  if (!Array.isArray(input) || !input.length || input.length > 15) throw Error("Select 1\u201315 deployed units");
  return input.map((u, i) => {
    if (!types.includes(u.type) || !Number.isInteger(u.tier) || u.tier < 1 || u.tier > 3 || typeof u.instruction !== "string" || u.instruction.length > 2e3) throw Error("Invalid unit data");
    const gear = {};
    for (const slot of ["weapon", "armor", "utility"]) if (new RegExp("^" + slot + "-[0-9]$").test(u.equipment?.[slot] || "")) gear[slot] = u.equipment[slot];
    const allowed = commands.slice(0, u.tier === 1 ? 3 : u.tier === 2 ? 5 : 7);
    let compiled = null;
    const p = u.compiled;
    if (p && ["rush", "balanced", "sniper"].includes(p.style) && ["always", "inRange", "stationary"].includes(p.firePolicy)) compiled = { style: p.style, preferred: Math.max(100, Math.min(500, Number(p.preferred) || 255)), cover: allowed.includes("cover") && !!p.cover, evade: allowed.includes("duck") && !!p.evade, retreat: allowed.includes("retreat") && !!p.retreat, coverBelow: Math.max(0, Math.min(0.9, Number(p.coverBelow) || 0.5)), retreatBelow: Math.max(0, Math.min(0.8, Number(p.retreatBelow) || 0.25)), firePolicy: p.firePolicy, explanation: "" };
    return { id: prefix + i, type: u.type, tier: u.tier, instruction: u.instruction, squadScript: typeof u.squadScript === "string" && u.squadScript.length <= 3e3 ? u.squadScript : "leader tank-1\nall focus nearest\nall follow leader", commands: Array.isArray(u.commands) ? u.commands.filter((c) => allowed.includes(c)) : allowed, equipment: gear, compiled, compiledText: u.instruction };
  });
}
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
var index_default = { async fetch(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/status") return json({ available: false, model: "Use the Android phone model or local USB bridge", location: "No hosted model" });
    if (url.pathname === "/api/plan") return json({ error: "Models run on your phone or computer. Open the installed Android app to compile." }, 503);
    if (!url.pathname.startsWith("/api/matches")) return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: "Match database unavailable" }, 503);
    if (request.method === "POST") {
      if (Number(request.headers.get("content-length")) > 12e4) return json({ error: "Squad too large" }, 413);
      const raw = await request.text();
      if (raw.length > 12e4) return json({ error: "Squad too large" }, 413);
      const input = JSON.parse(raw);
      if (url.pathname === "/api/matches/create") {
        const code = randomToken(3).toUpperCase(), token = randomToken(24), seed = crypto.getRandomValues(new Uint32Array(1))[0], map = ["urban", "canyon", "volcanic", "coast"].includes(input.map) ? input.map : "urban", units = squad(input.units, "a-"), now = Date.now();
        await env.DB.prepare("INSERT INTO arena_matches (code,token_a,units_a,map,seed,updated,expires,revision) VALUES (?,?,?,?,?,?,?,0)").bind(code, token, JSON.stringify(units), map, seed, now, now + 9e5).run();
        return json({ code, token, status: "waiting", seat: 0 });
      }
      if (url.pathname === "/api/matches/join") {
        const code = String(input.code || "").toUpperCase(), row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=? AND expires>?").bind(code, Date.now()).first();
        if (!row) throw Error("Match not found or expired");
        if (row.token_b) throw Error("Match already has two players");
        const token = randomToken(24), b = squad(input.units, "b-"), a = JSON.parse(row.units_a), engine = createEngine(a, b, row.map, row.seed), state = JSON.stringify(engine.state());
        const updated = await env.DB.prepare("UPDATE arena_matches SET token_b=?,units_b=?,state=?,updated=?,revision=revision+1 WHERE code=? AND token_b IS NULL").bind(token, JSON.stringify(b), state, Date.now(), code).run();
        if (!updated.meta.changes) throw Error("Match already joined");
        return json({ code, token, status: "running", seat: 1 });
      }
    }
    if (request.method === "GET") {
      const code = url.searchParams.get("code"), token = request.headers.get("x-match-token");
      let row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=? AND expires>?").bind(code, Date.now()).first();
      if (!row) throw Error("Match not found or expired");
      const seat = token === row.token_a ? 0 : token === row.token_b ? 1 : -1;
      if (seat < 0 || !token) return json({ error: "Invalid session token" }, 403);
      if (!row.token_b) return json({ code, status: "waiting", seat });
      let state = JSON.parse(row.state);
      if (state.mode === "running") {
        const now = Date.now(), elapsed = Math.min(2, (now - row.updated) / 1e3), engine = createEngine(JSON.parse(row.units_a), JSON.parse(row.units_b), row.map, row.seed, state);
        engine.tick(elapsed);
        state = engine.state();
        const next = await env.DB.prepare("UPDATE arena_matches SET state=?,updated=?,revision=revision+1 WHERE code=? AND revision=?").bind(JSON.stringify(state), now, code, row.revision).run();
        if (!next.meta.changes) {
          row = await env.DB.prepare("SELECT * FROM arena_matches WHERE code=?").bind(code).first();
          state = JSON.parse(row.state);
        }
      }
      return json({ code, seat, seed: row.seed, map: row.map, status: state.mode === "running" ? "running" : "finished", winner: state.mode === "won" ? 0 : 1, ...state });
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
