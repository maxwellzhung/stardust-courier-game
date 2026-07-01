(() => {
  const WORLD = { width: 1280, height: 720 };
  const DEPOT = { x: 1118, y: 594, r: 62 };
  const PLAYER_START = { x: 156, y: 360 };
  const MAX_DT = 1 / 30;
  const LEADERBOARD_KEY = "star-courier-leaderboard-v1";
  const PLAYER_NAME_KEY = "star-courier-player-name";

  const TUNE = {
    accel: 650,
    boostAccel: 930,
    maxSpeed: 282,
    boostSpeed: 428,
    drag: 0.955,
    boostDrain: 14,
    baseDrain: 1.65,
    energyDrainMultiplier: 1.8,
    hitGrace: 0.65,
  };

  const SPECIAL_STAR_TYPES = [
    { id: "gold", label: "金色奇星", color: "#ffdf8a" },
    { id: "surge", label: "充能奇星", color: "#7cf59b" },
    { id: "guard", label: "护盾奇星", color: "#46e6ff" },
    { id: "cargo", label: "压缩奇星", color: "#ffb94f" },
    { id: "echo", label: "回声奇星", color: "#d986ff" },
  ];

  const UPGRADE_POOL = [
    {
      id: "engine",
      code: "1",
      title: "离子推进",
      description: "航速和加速提升，推进耗能降低。",
      maxLevel: 4,
    },
    {
      id: "shield",
      code: "2",
      title: "相位护盾",
      description: "护盾上限提升，碰撞伤害降低。",
      maxLevel: 4,
    },
    {
      id: "magnet",
      code: "3",
      title: "回收磁场",
      description: "星尘和能量核心的拾取范围扩大。",
      maxLevel: 3,
    },
    {
      id: "reactor",
      code: "4",
      title: "冷核电池",
      description: "能量上限提升，停靠补给更多。",
      maxLevel: 4,
    },
    {
      id: "cargo",
      code: "5",
      title: "压缩货舱",
      description: "交付所需星尘减少，交付奖金提高。",
      maxLevel: 2,
    },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const bg = new Image();
  bg.src = "assets/starfield-background.png";

  const dom = {
    shell: document.querySelector(".game-shell"),
    score: document.getElementById("score"),
    wave: document.getElementById("wave"),
    cargo: document.getElementById("cargo"),
    cargoStat: document.querySelector(".cargo-stat"),
    objective: document.getElementById("objective"),
    remainingBadge: document.getElementById("remainingBadge"),
    remainingCount: document.getElementById("remainingCount"),
    energyBar: document.getElementById("energyBar"),
    shieldBar: document.getElementById("shieldBar"),
    energyValue: document.getElementById("energyValue"),
    shieldValue: document.getElementById("shieldValue"),
    comboMeter: document.getElementById("comboMeter"),
    comboCount: document.getElementById("comboCount"),
    comboMultiplier: document.getElementById("comboMultiplier"),
    comboTimerBar: document.getElementById("comboTimerBar"),
    comboHint: document.getElementById("comboHint"),
    upgradeTotal: document.getElementById("upgradeTotal"),
    upgradeTiers: {
      engine: document.getElementById("engineTier"),
      shield: document.getElementById("shieldTier"),
      magnet: document.getElementById("magnetTier"),
      reactor: document.getElementById("reactorTier"),
      cargo: document.getElementById("cargoTier"),
    },
    upgradeChips: [...document.querySelectorAll("[data-upgrade-tier]")],
    startOverlay: document.getElementById("startOverlay"),
    gameOverOverlay: document.getElementById("gameOverOverlay"),
    runSummary: document.getElementById("runSummary"),
    rankForm: document.getElementById("rankForm"),
    playerName: document.getElementById("playerName"),
    rankMessage: document.getElementById("rankMessage"),
    saveRankButton: document.getElementById("saveRankButton"),
    clearRankButton: document.getElementById("clearRankButton"),
    leaderboardList: document.getElementById("leaderboardList"),
    startLeaderboardList: document.getElementById("startLeaderboardList"),
    startButton: document.getElementById("startButton"),
    restartButton: document.getElementById("restartButton"),
    pauseButton: document.getElementById("pauseButton"),
    upgradeOverlay: document.getElementById("upgradeOverlay"),
    upgradeSummary: document.getElementById("upgradeSummary"),
    upgradeChoices: document.getElementById("upgradeChoices"),
    stickZone: document.getElementById("stickZone"),
    stickKnob: document.getElementById("stickKnob"),
    rightStickZone: document.getElementById("rightStickZone"),
    rightStickKnob: document.getElementById("rightStickKnob"),
  };

  const input = {
    keys: new Set(),
    touchAxes: {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    },
  };

  const audio = {
    armed: false,
    ctx: null,
  };

  const view = {
    width: 0,
    height: 0,
    dpr: 1,
    scale: 1,
    ox: 0,
    oy: 0,
    mode: "fit",
  };

  let state = createState();
  let lastTime = 0;
  const stickPointers = {
    left: null,
    right: null,
  };

  function createState() {
    return {
      mode: "ready",
      time: 0,
      score: 0,
      wave: 1,
      cargo: 0,
      quota: 3,
      delivered: 0,
      energy: 100,
      shield: 100,
      shake: 0,
      flash: 0,
      scoreSubmitted: false,
      combo: 0,
      comboTimer: 0,
      nextComboPrizeAt: 3,
      contract: null,
      upgradeChoices: [],
      upgrades: {
        engine: 0,
        shield: 0,
        magnet: 0,
        reactor: 0,
        cargo: 0,
      },
      player: {
        x: PLAYER_START.x,
        y: PLAYER_START.y,
        vx: 0,
        vy: 0,
        r: 17,
        angle: 0,
        hitGrace: 0,
      },
      parcels: [],
      bonusStars: [],
      cells: [],
      asteroids: [],
      seekers: [],
      mines: [],
      particles: [],
      floaters: [],
    };
  }

  function startRun() {
    armAudio();
    state = createState();
    state.mode = "playing";
    spawnLevel();
    dom.startOverlay.classList.add("hidden");
    dom.gameOverOverlay.classList.add("hidden");
    dom.upgradeOverlay.classList.add("hidden");
    dom.pauseButton.classList.remove("is-paused");
    dom.rankMessage.textContent = "成绩只保存在当前浏览器。";
    dom.saveRankButton.disabled = false;
    playCue("start");
    updateHud();
  }

  function spawnLevel() {
    state.parcels = [];
    state.bonusStars = [];
    state.cells = [];
    state.asteroids = [];
    state.seekers = [];
    state.mines = [];
    state.contract = createContract();

    const parcelCount = state.quota + Math.min(2, Math.floor(state.wave / 2));
    for (let i = 0; i < parcelCount; i += 1) {
      const p = pickSpawnPoint(62);
      state.parcels.push({
        x: p.x,
        y: p.y,
        r: 13,
        spin: random(0, Math.PI * 2),
        wobble: random(0, Math.PI * 2),
      });
    }

    const cellCount = 2 + (state.wave > 3 ? 1 : 0);
    for (let i = 0; i < cellCount; i += 1) {
      const p = pickSpawnPoint(58);
      state.cells.push({
        x: p.x,
        y: p.y,
        r: 12,
        pulse: random(0, Math.PI * 2),
      });
    }

    const asteroidCount = 6 + state.wave * 2;
    for (let i = 0; i < asteroidCount; i += 1) {
      const p = pickSpawnPoint(80);
      const radius = random(18, 42 + Math.min(state.wave * 2, 18));
      state.asteroids.push({
        x: p.x,
        y: p.y,
        vx: random(-28, 28) * (1 + state.wave * 0.06),
        vy: random(-28, 28) * (1 + state.wave * 0.06),
        r: radius,
        angle: random(0, Math.PI * 2),
        spin: random(-0.9, 0.9),
        shape: makeRockShape(radius),
      });
    }

    const seekerCount = Math.min(5, Math.max(0, Math.floor((state.wave - 1) / 2)));
    for (let i = 0; i < seekerCount; i += 1) {
      const p = pickSpawnPoint(96);
      state.seekers.push({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        r: 18,
        angle: 0,
        phase: random(0, Math.PI * 2),
      });
    }

    burst(DEPOT.x, DEPOT.y, 22, "#ffb94f", 1.2);
    floatText(state.player.x, state.player.y - 48, `合约: ${state.contract.label}`, "#ffb94f", 1.25);
  }

  function createContract() {
    const options = [
      {
        type: "speed",
        label: `${Math.max(32, 54 - state.wave * 2)}秒内交付`,
        target: Math.max(32, 54 - state.wave * 2),
        startedAt: state.time,
        failed: false,
      },
      {
        type: "shield",
        label: "护盾保持70%",
        target: 70,
        failed: false,
      },
      {
        type: "energy",
        label: "返航能量40%",
        target: 40,
        failed: false,
      },
    ];

    return options[Math.floor(Math.random() * options.length)];
  }

  function pickSpawnPoint(margin) {
    for (let i = 0; i < 120; i += 1) {
      const x = random(70, WORLD.width - 70);
      const y = random(92, WORLD.height - 64);
      const farFromPlayer = dist(x, y, state.player.x, state.player.y) > 180 + margin;
      const farFromDepot = dist(x, y, DEPOT.x, DEPOT.y) > 130 + margin;
      if (farFromPlayer && farFromDepot) {
        return { x, y };
      }
    }

    return { x: random(160, 980), y: random(120, 600) };
  }

  function makeRockShape(radius) {
    const sides = Math.floor(random(8, 13));
    const points = [];
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      points.push({
        x: Math.cos(a) * radius * random(0.68, 1.1),
        y: Math.sin(a) * radius * random(0.68, 1.1),
      });
    }
    return points;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    view.width = rect.width;
    view.height = rect.height;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.mode = view.width < 700 && view.height > view.width * 1.15 ? "portrait" : "fit";

    if (view.mode === "portrait") {
      const edgePadding = view.width < 560 ? 16 : 24;
      view.scale = Math.max(view.width / WORLD.height, (view.height - edgePadding * 2) / WORLD.height);
      view.ox = 0;
      view.oy = (view.height - WORLD.height * view.scale) / 2;
    } else {
      view.scale = Math.min(view.width / WORLD.width, view.height / WORLD.height);
      view.ox = (view.width - WORLD.width * view.scale) / 2;
      view.oy = (view.height - WORLD.height * view.scale) / 2;
    }

    canvas.width = Math.max(1, Math.round(view.width * view.dpr));
    canvas.height = Math.max(1, Math.round(view.height * view.dpr));
  }

  function loop(now) {
    const dt = lastTime ? Math.min(MAX_DT, (now - lastTime) / 1000) : 0;
    lastTime = now;

    if (state.mode === "playing") {
      update(dt);
    } else {
      updateAmbient(dt);
    }

    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    state.time += dt;
    state.flash = Math.max(0, state.flash - dt);
    state.shake = Math.max(0, state.shake - dt * 1.8);

    updatePlayer(dt);
    updateBonusStars(dt);
    updateAsteroids(dt);
    updateSeekers(dt);
    updateMines(dt);
    updateParticles(dt);
    updateFloaters(dt);
    updateCombo(dt);
    updateContract();
    checkCollections();
    checkDelivery();
    updateHud();

    if (state.energy <= 0 || state.shield <= 0) {
      endRun();
    }
  }

  function updateAmbient(dt) {
    state.time += dt;
    updateParticles(dt);
    updateFloaters(dt);
  }

  function updateCombo(dt) {
    if (state.comboTimer <= 0) {
      resetCombo();
      return;
    }

    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) {
      resetCombo();
    }
  }

  function updateContract() {
    const contract = state.contract;
    if (!contract || contract.failed) {
      return;
    }

    if (contract.type === "speed" && state.time - contract.startedAt > contract.target) {
      contract.failed = true;
      floatText(state.player.x, state.player.y - 42, "合约超时", "#ff6b6b", 1.05);
      return;
    }

    if (contract.type === "shield" && shieldPercent() < contract.target) {
      contract.failed = true;
      floatText(state.player.x, state.player.y - 42, "合约失败", "#ff6b6b", 1.05);
    }
  }

  function updatePlayer(dt) {
    const axis = readAxis();
    const p = state.player;
    const moving = Math.hypot(axis.x, axis.y) > 0.05;
    const wantsBoost = moving && readBoost() && state.energy > 4;
    const engine = engineScale();
    const accel = (wantsBoost ? TUNE.boostAccel : TUNE.accel) * engine;
    const maxSpeed = (wantsBoost ? TUNE.boostSpeed : TUNE.maxSpeed) * engine;

    p.vx += axis.x * accel * dt;
    p.vy += axis.y * accel * dt;

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      p.vx *= s;
      p.vy *= s;
    }

    const drag = Math.pow(TUNE.drag, dt * 60);
    p.vx *= drag;
    p.vy *= drag;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (Math.hypot(p.vx, p.vy) > 14) {
      p.angle = Math.atan2(p.vy, p.vx);
    }

    clampPlayer();

    state.energy -= (TUNE.baseDrain + (wantsBoost ? boostDrain() : 0)) * TUNE.energyDrainMultiplier * dt;
    if (dist(p.x, p.y, DEPOT.x, DEPOT.y) < DEPOT.r + 18 && state.cargo === 0) {
      state.energy = Math.min(maxEnergy(), state.energy + (10 + state.upgrades.reactor * 1.5) * dt);
    }

    p.hitGrace = Math.max(0, p.hitGrace - dt);

    if (moving && state.time % 0.04 < dt) {
      const back = p.angle + Math.PI;
      addParticle(
        p.x + Math.cos(back) * 16,
        p.y + Math.sin(back) * 16,
        Math.cos(back + random(-0.4, 0.4)) * random(40, 120),
        Math.sin(back + random(-0.4, 0.4)) * random(40, 120),
        wantsBoost ? shipEnergyPalette().boostTrail : shipEnergyPalette().trail,
        random(2, wantsBoost ? 5 : 4),
        random(0.22, 0.42)
      );
    }
  }

  function clampPlayer() {
    const p = state.player;
    const bounce = 0.36;
    if (p.x < p.r) {
      p.x = p.r;
      p.vx = Math.abs(p.vx) * bounce;
    }
    if (p.x > WORLD.width - p.r) {
      p.x = WORLD.width - p.r;
      p.vx = -Math.abs(p.vx) * bounce;
    }
    if (p.y < p.r) {
      p.y = p.r;
      p.vy = Math.abs(p.vy) * bounce;
    }
    if (p.y > WORLD.height - p.r) {
      p.y = WORLD.height - p.r;
      p.vy = -Math.abs(p.vy) * bounce;
    }
  }

  function updateAsteroids(dt) {
    for (const rock of state.asteroids) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;

      if (rock.x < -rock.r) rock.x = WORLD.width + rock.r;
      if (rock.x > WORLD.width + rock.r) rock.x = -rock.r;
      if (rock.y < -rock.r) rock.y = WORLD.height + rock.r;
      if (rock.y > WORLD.height + rock.r) rock.y = -rock.r;

      collideHazard(rock, 12 + state.wave * 0.8, 190, "asteroid");
    }
  }

  function updateSeekers(dt) {
    const p = state.player;
    for (let i = state.seekers.length - 1; i >= 0; i -= 1) {
      const drone = state.seekers[i];
      if (drone.life != null) {
        drone.life -= dt;
        if (drone.life <= 0) {
          state.seekers.splice(i, 1);
          burst(drone.x, drone.y, 14, "#ff3e48", 0.75);
          continue;
        }
      }

      const dx = p.x - drone.x;
      const dy = p.y - drone.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const alert = drone.kind === "alert";
      const aggro = d < (alert ? 640 : 460);
      const accel = aggro ? (alert ? 190 + state.wave * 15 : 138 + state.wave * 12) : alert ? 62 : 38;
      const targetAngle = aggro ? Math.atan2(dy, dx) : drone.phase + Math.sin(state.time * 0.7) * 1.2;

      drone.vx += Math.cos(targetAngle) * accel * dt;
      drone.vy += Math.sin(targetAngle) * accel * dt;

      const max = aggro ? (alert ? 236 + state.wave * 11 : 185 + state.wave * 9) : alert ? 118 : 88;
      const speed = Math.hypot(drone.vx, drone.vy);
      if (speed > max) {
        const s = max / speed;
        drone.vx *= s;
        drone.vy *= s;
      }

      drone.vx *= Math.pow(0.972, dt * 60);
      drone.vy *= Math.pow(0.972, dt * 60);
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;
      drone.angle = Math.atan2(drone.vy, drone.vx);

      if (drone.x < 28 || drone.x > WORLD.width - 28) drone.vx *= -0.82;
      if (drone.y < 28 || drone.y > WORLD.height - 28) drone.vy *= -0.82;
      drone.x = clamp(drone.x, 28, WORLD.width - 28);
      drone.y = clamp(drone.y, 28, WORLD.height - 28);

      collideHazard(drone, alert ? 24 + state.wave * 1.2 : 18 + state.wave, alert ? 285 : 245, "seeker");
    }
  }

  function updateBonusStars(dt) {
    for (let i = state.bonusStars.length - 1; i >= 0; i -= 1) {
      const star = state.bonusStars[i];
      star.life -= dt;
      star.spin += dt * star.spinSpeed;
      if (star.life <= 0) {
        state.bonusStars.splice(i, 1);
        burst(star.x, star.y, 10, star.color, 0.55);
      }
    }
  }

  function updateMines(dt) {
    for (let i = state.mines.length - 1; i >= 0; i -= 1) {
      const mine = state.mines[i];
      mine.life -= dt;
      mine.armTimer = Math.max(0, mine.armTimer - dt);
      if (mine.life <= 0) {
        state.mines.splice(i, 1);
        burst(mine.x, mine.y, 12, "#ff6b6b", 0.6);
        continue;
      }

      if (mine.armTimer <= 0 && collideHazard(mine, 24 + state.wave * 1.4, 320, "mine")) {
        state.mines.splice(i, 1);
        burst(mine.x, mine.y, 34, "#ff3e48", 1.2);
        floatText(mine.x, mine.y - 34, "地雷爆炸", "#ff6b6b", 0.95);
      }
    }
  }

  function collideHazard(hazard, damage, knockback, source = "hazard") {
    const p = state.player;
    const d = dist(p.x, p.y, hazard.x, hazard.y);
    if (d > p.r + hazard.r || p.hitGrace > 0) {
      return false;
    }

    const nx = (p.x - hazard.x) / Math.max(1, d);
    const ny = (p.y - hazard.y) / Math.max(1, d);
    p.vx += nx * knockback;
    p.vy += ny * knockback;
    p.hitGrace = TUNE.hitGrace;
    const finalDamage = damageFor(damage);
    state.shield = Math.max(0, state.shield - finalDamage);
    state.shake = 0.42;
    if (state.combo >= 2) {
      floatText(p.x, p.y - 44, "连击中断", "#ff6b6b", 0.9);
    }
    resetCombo();
    playCue("hit");
    floatText(p.x, p.y - 24, `-${Math.round(finalDamage)}`, "#ff6b6b");
    burst(p.x, p.y, 18, "#ff6b6b", 1);
    if (source === "asteroid") {
      triggerCollisionPenalty(hazard);
    }
    return true;
  }

  function checkCollections() {
    const p = state.player;

    for (let i = state.parcels.length - 1; i >= 0; i -= 1) {
      const item = state.parcels[i];
      if (state.cargo >= state.quota) {
        continue;
      }
      if (dist(p.x, p.y, item.x, item.y) < p.r + item.r + collectReach()) {
        state.parcels.splice(i, 1);
        state.cargo += 1;
        bumpCombo(item.x, item.y);
        addScore(45 + state.wave * 5, item.x, item.y, "#46e6ff", "星尘");
        playCue("collect");
        burst(item.x, item.y, 18, "#46e6ff", 1.1);
      }
    }

    for (let i = state.bonusStars.length - 1; i >= 0; i -= 1) {
      const star = state.bonusStars[i];
      if (dist(p.x, p.y, star.x, star.y) < p.r + star.r + collectReach()) {
        state.bonusStars.splice(i, 1);
        collectSpecialStar(star);
      }
    }

    for (let i = state.cells.length - 1; i >= 0; i -= 1) {
      const cell = state.cells[i];
      if (dist(p.x, p.y, cell.x, cell.y) < p.r + cell.r + collectReach()) {
        state.cells.splice(i, 1);
        state.energy = Math.min(maxEnergy(), state.energy + 28 + state.upgrades.reactor * 3);
        bumpCombo(cell.x, cell.y);
        addScore(20, cell.x, cell.y, "#7cf59b", "能量");
        playCue("energy");
        burst(cell.x, cell.y, 14, "#7cf59b", 0.9);
      }
    }
  }

  function collectSpecialStar(star) {
    bumpCombo(star.x, star.y, false);
    playCue("bonus");

    if (star.type === "gold") {
      addScore(170 + state.wave * 38, star.x, star.y, star.color, "金色奇星");
    } else if (star.type === "surge") {
      state.energy = Math.min(maxEnergy(), state.energy + 40 + state.upgrades.reactor * 5);
      addScore(48 + state.wave * 6, star.x, star.y, star.color, "充能奇星");
      floatText(star.x, star.y - 42, "能量回涌", star.color, 0.9);
    } else if (star.type === "guard") {
      state.shield = Math.min(maxShield(), state.shield + 30 + state.upgrades.shield * 4);
      addScore(46 + state.wave * 6, star.x, star.y, star.color, "护盾奇星");
      floatText(star.x, star.y - 42, "护盾修复", star.color, 0.9);
    } else if (star.type === "cargo") {
      if (state.cargo < state.quota) {
        state.cargo += 1;
        floatText(star.x, star.y - 42, "货舱 +1", star.color, 0.9);
      } else {
        floatText(star.x, star.y - 42, "满载奖金", star.color, 0.9);
      }
      addScore(92 + state.wave * 16, star.x, star.y, star.color, "压缩奇星");
    } else if (star.type === "echo") {
      if (state.cargo < state.quota) {
        spawnEchoParcels(star.x, star.y);
      } else {
        state.energy = Math.min(maxEnergy(), state.energy + 22);
      }
      addScore(70 + state.wave * 12, star.x, star.y, star.color, "回声奇星");
      floatText(star.x, star.y - 42, state.cargo < state.quota ? "星尘回声" : "回声充能", star.color, 0.9);
    }

    burst(star.x, star.y, 28, star.color, 1.3);
    updateHud();
  }

  function checkDelivery() {
    const p = state.player;
    const atDepot = dist(p.x, p.y, DEPOT.x, DEPOT.y) < DEPOT.r + p.r;
    if (!atDepot || state.cargo < state.quota) {
      return;
    }

    const bonus = Math.round((state.quota * 120 + state.wave * 85 + Math.round(state.energy * 1.5)) * cargoBonus());
    const contractBonus = awardContractBonus();
    const totalBonus = bonus + contractBonus;
    state.score += totalBonus;
    state.delivered += state.cargo;
    playCue("delivery");
    floatText(DEPOT.x, DEPOT.y - 72, `+${totalBonus}`, "#ffb94f", 1.2);
    burst(DEPOT.x, DEPOT.y, 46, "#ffb94f", 1.5);

    resetCombo();
    state.flash = 0.5;
    state.mode = "upgrade";
    state.upgradeChoices = pickUpgradeChoices();
    showUpgradeOverlay(totalBonus);
    updateHud();
  }

  function bumpCombo(x = state.player.x, y = state.player.y, allowPrize = true) {
    state.combo += 1;
    state.comboTimer = comboWindow();
    if (allowPrize) {
      maybeSpawnComboPrize(x, y);
    }
  }

  function resetCombo() {
    state.combo = 0;
    state.comboTimer = 0;
    state.nextComboPrizeAt = 3;
  }

  function maybeSpawnComboPrize(x, y) {
    if (state.combo < 3 || state.bonusStars.length >= 4) {
      return;
    }

    const reachedPrize = state.combo >= state.nextComboPrizeAt;
    const surpriseRoll = state.combo >= 6 && Math.random() < Math.min(0.34, 0.12 + state.combo * 0.015);
    if (!reachedPrize && !surpriseRoll) {
      return;
    }

    spawnSpecialStar(x, y);
    state.nextComboPrizeAt = state.combo + Math.floor(random(2, 4));
  }

  function spawnSpecialStar(originX, originY) {
    const type = SPECIAL_STAR_TYPES[Math.floor(Math.random() * SPECIAL_STAR_TYPES.length)];
    const p = pickNearbyPoint(originX, originY, 96, 210, 86);
    const star = {
      x: p.x,
      y: p.y,
      r: 16,
      type: type.id,
      label: type.label,
      color: type.color,
      phase: random(0, Math.PI * 2),
      spin: random(0, Math.PI * 2),
      spinSpeed: random(1.8, 3.8),
      life: 11 + Math.min(4, state.combo * 0.25),
    };

    state.bonusStars.push(star);
    playCue("bonus");
    burst(star.x, star.y, 22, star.color, 1);
    floatText(star.x, star.y - 36, `${state.combo}连击 奇星出现`, star.color, 0.95);
  }

  function spawnEchoParcels(x, y) {
    const count = state.cargo >= state.quota ? 1 : 2;
    for (let i = 0; i < count; i += 1) {
      const p = pickNearbyPoint(x, y, 62, 138, 46);
      state.parcels.push(makeParcel(p.x, p.y, 11));
      burst(p.x, p.y, 10, "#d986ff", 0.7);
    }
  }

  function makeParcel(x, y, radius = 13) {
    return {
      x,
      y,
      r: radius,
      spin: random(0, Math.PI * 2),
      wobble: random(0, Math.PI * 2),
    };
  }

  function triggerCollisionPenalty(hazard) {
    const alertCount = state.seekers.filter((drone) => drone.kind === "alert").length;
    const canSpawnAlert = alertCount < 4 + Math.floor(state.wave / 3);
    const canSpawnMines = state.mines.length < 10;
    const spawnAlert = canSpawnAlert && (!canSpawnMines || Math.random() < 0.55);

    if (spawnAlert) {
      spawnAlertSeeker(hazard.x, hazard.y);
    } else if (canSpawnMines) {
      spawnMineCluster(hazard.x, hazard.y);
    }
  }

  function spawnAlertSeeker(x, y) {
    const p = pickNearbyPoint(x, y, 150, 230, 130);
    state.seekers.push({
      x: p.x,
      y: p.y,
      vx: random(-42, 42),
      vy: random(-42, 42),
      r: 19,
      angle: 0,
      phase: random(0, Math.PI * 2),
      kind: "alert",
      life: 16 + Math.min(10, state.wave * 1.2),
    });
    playCue("alarm");
    burst(p.x, p.y, 22, "#ff3e48", 1);
    floatText(p.x, p.y - 34, "红警飞机", "#ff6b6b", 0.96);
  }

  function spawnMineCluster(x, y) {
    const count = Math.min(3, 1 + Math.ceil(state.wave / 4));
    for (let i = 0; i < count; i += 1) {
      if (state.mines.length >= 10) {
        return;
      }
      const p = pickNearbyPoint(x, y, 92, 190, 70);
      state.mines.push({
        x: p.x,
        y: p.y,
        r: 18,
        phase: random(0, Math.PI * 2),
        armTimer: 0.72,
        life: 18,
      });
      burst(p.x, p.y, 12, "#ff6b6b", 0.62);
    }
    playCue("alarm");
    floatText(x, y - 40, "航道布雷", "#ff6b6b", 0.96);
  }

  function pickNearbyPoint(originX, originY, minPlayerDistance, maxRadius, minRadius = 70) {
    for (let i = 0; i < 60; i += 1) {
      const angle = random(0, Math.PI * 2);
      const radius = random(minRadius, maxRadius);
      const x = clamp(originX + Math.cos(angle) * radius, 42, WORLD.width - 42);
      const y = clamp(originY + Math.sin(angle) * radius, 64, WORLD.height - 42);
      const farFromPlayer = dist(x, y, state.player.x, state.player.y) > minPlayerDistance;
      const farFromDepot = dist(x, y, DEPOT.x, DEPOT.y) > 88;
      if (farFromPlayer && farFromDepot) {
        return { x, y };
      }
    }

    return pickSpawnPoint(minPlayerDistance * 0.55);
  }

  function comboMultiplier() {
    return 1 + Math.min(1.5, Math.max(0, state.combo - 1) * 0.12);
  }

  function comboWindow(combo = state.combo) {
    return Math.max(3.2, 4.8 - combo * 0.08);
  }

  function addScore(base, x, y, color, label) {
    const multiplier = comboMultiplier();
    const gained = Math.round(base * multiplier);
    state.score += gained;
    const comboLabel = state.combo >= 2 ? ` x${multiplier.toFixed(1)}` : "";
    floatText(x, y - 16, `+${gained} ${label}${comboLabel}`, color);
    if (state.combo === 4 || state.combo === 8 || state.combo === 12) {
      floatText(state.player.x, state.player.y - 46, `${state.combo}连击`, "#ffb94f", 0.95);
    }
    return gained;
  }

  function awardContractBonus() {
    const contract = state.contract;
    if (!contract || contract.failed) {
      floatText(DEPOT.x, DEPOT.y - 98, "合约未完成", "#ff6b6b", 1.05);
      return 0;
    }

    if (contract.type === "energy" && energyPercent() < contract.target) {
      contract.failed = true;
      floatText(DEPOT.x, DEPOT.y - 98, "合约未完成", "#ff6b6b", 1.05);
      return 0;
    }

    const remaining = contract.type === "speed" ? Math.max(0, contract.target - (state.time - contract.startedAt)) : 0;
    const bonus =
      contract.type === "speed"
        ? Math.round(180 + state.wave * 55 + remaining * 9)
        : Math.round(220 + state.wave * 65);

    contract.awarded = true;
    floatText(DEPOT.x, DEPOT.y - 98, `合约 +${bonus}`, "#7cf59b", 1.15);
    return bonus;
  }

  function continueAfterUpgrade(upgradeId) {
    if (state.mode !== "upgrade") {
      return;
    }

    applyUpgrade(upgradeId);
    state.wave += 1;
    state.cargo = 0;
    state.quota = nextQuota();
    state.energy = Math.min(maxEnergy(), state.energy + 42 + state.upgrades.reactor * 8);
    state.shield = Math.min(maxShield(), state.shield + 18 + state.upgrades.shield * 5);
    state.mode = "playing";
    dom.upgradeOverlay.classList.add("hidden");
    playCue("upgrade");
    spawnLevel();
    updateHud();
  }

  function endRun() {
    state.mode = "over";
    dom.gameOverOverlay.classList.remove("hidden");
    dom.upgradeOverlay.classList.add("hidden");
    dom.pauseButton.classList.remove("is-paused");
    dom.runSummary.textContent = `完成 ${state.delivered} 份星尘交付，抵达第 ${state.wave} 段航线，得分 ${Math.round(state.score)}。`;
    prepareRankingForm();
    renderLeaderboards();
    updateHud();
  }

  function prepareRankingForm() {
    dom.playerName.value = loadPlayerName();
    const rank = projectedRank(Math.round(state.score));
    dom.rankMessage.textContent =
      rank <= 10 ? `预计进入第 ${rank} 名，成绩只保存在当前浏览器。` : "未进入前 10，成绩仍可保存到本地记录。";
    dom.saveRankButton.disabled = state.scoreSubmitted;
  }

  function projectedRank(score) {
    const board = loadLeaderboard();
    const lowerCount = board.filter((entry) => entry.score > score).length;
    return lowerCount + 1;
  }

  function submitRanking(event) {
    event.preventDefault();
    if (state.mode !== "over" || state.scoreSubmitted) {
      return;
    }

    const name = normalizePlayerName(dom.playerName.value);
    const entry = {
      name,
      score: Math.round(state.score),
      wave: state.wave,
      delivered: state.delivered,
      date: new Date().toISOString(),
    };
    const board = [...loadLeaderboard(), entry]
      .sort((a, b) => b.score - a.score || b.wave - a.wave || b.delivered - a.delivered)
      .slice(0, 10);

    savePlayerName(name);
    saveLeaderboard(board);
    state.scoreSubmitted = true;
    dom.saveRankButton.disabled = true;
    dom.rankMessage.textContent = `已保存 ${name} 的成绩。`;
    renderLeaderboards();
  }

  function clearLeaderboard() {
    if (!window.confirm("清空当前浏览器里的排行榜？")) {
      return;
    }

    localStorage.removeItem(LEADERBOARD_KEY);
    dom.rankMessage.textContent = "排行榜已清空。";
    renderLeaderboards();
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isRankEntry).slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  function saveLeaderboard(board) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    } catch {
      dom.rankMessage.textContent = "浏览器拒绝保存本地排行榜。";
    }
  }

  function isRankEntry(entry) {
    return (
      entry &&
      typeof entry.name === "string" &&
      Number.isFinite(entry.score) &&
      Number.isFinite(entry.wave) &&
      Number.isFinite(entry.delivered)
    );
  }

  function loadPlayerName() {
    try {
      return normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) || "飞行员");
    } catch {
      return "飞行员";
    }
  }

  function savePlayerName(name) {
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } catch {
      // Ranking still works for this run even if the remembered name cannot be saved.
    }
  }

  function normalizePlayerName(value) {
    const name = String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12);
    return name || "飞行员";
  }

  function renderLeaderboards() {
    const board = loadLeaderboard();
    renderLeaderboardList(dom.leaderboardList, board);
    renderLeaderboardList(dom.startLeaderboardList, board);
  }

  function renderLeaderboardList(list, board) {
    list.innerHTML = "";

    if (!board.length) {
      const empty = document.createElement("li");
      empty.className = "empty-rank";
      empty.textContent = "还没有成绩，完成一局后上榜。";
      list.appendChild(empty);
      return;
    }

    board.forEach((entry, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("em");
      const pilot = document.createElement("span");
      const name = document.createElement("b");
      const meta = document.createElement("small");
      const score = document.createElement("strong");

      rank.textContent = `#${index + 1}`;
      name.textContent = entry.name;
      meta.textContent = `航段 ${entry.wave} · 交付 ${entry.delivered}`;
      score.textContent = String(entry.score);
      pilot.append(name, meta);
      item.append(rank, pilot, score);
      list.appendChild(item);
    });
  }

  function pickUpgradeChoices() {
    const available = UPGRADE_POOL.filter((upgrade) => state.upgrades[upgrade.id] < upgrade.maxLevel);
    const pool = available.length >= 3 ? available : UPGRADE_POOL;
    return shuffle(pool).slice(0, 3);
  }

  function showUpgradeOverlay(bonus) {
    dom.upgradeSummary.textContent = `交付奖金 +${bonus}。选择一项改装，继续第 ${state.wave + 1} 段航线。`;
    dom.upgradeChoices.innerHTML = "";

    state.upgradeChoices.forEach((upgrade, index) => {
      const level = state.upgrades[upgrade.id] + 1;
      const button = document.createElement("button");
      button.className = "upgrade-card";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.innerHTML = `<span>${index + 1}</span><b>${upgrade.title} Lv.${level}</b><small>${upgrade.description}</small>`;
      dom.upgradeChoices.appendChild(button);
    });

    dom.upgradeOverlay.classList.remove("hidden");
  }

  function applyUpgrade(upgradeId) {
    const upgrade = UPGRADE_POOL.find((item) => item.id === upgradeId);
    if (!upgrade) {
      return;
    }

    state.upgrades[upgradeId] = Math.min(upgrade.maxLevel, state.upgrades[upgradeId] + 1);
    const label = upgrade.title.replace("离子", "").replace("相位", "").replace("冷核", "");
    floatText(state.player.x, state.player.y - 36, `${label}+`, "#ffb94f");
  }

  function maxEnergy() {
    return 100 + state.upgrades.reactor * 15;
  }

  function maxShield() {
    return 100 + state.upgrades.shield * 20;
  }

  function energyPercent() {
    return energyRatio() * 100;
  }

  function shieldPercent() {
    return (state.shield / maxShield()) * 100;
  }

  function energyRatio() {
    return clamp(state.energy / maxEnergy(), 0, 1);
  }

  function shipEnergyPalette() {
    const ratio = energyRatio();
    const criticalPulse = 0.68 + Math.sin(state.time * 10) * 0.18;

    if (ratio < 0.3) {
      return {
        nose: "#ffe4e4",
        core: "#ff3e48",
        tail: "#8f1720",
        glow: `rgba(255, 62, 72, ${criticalPulse})`,
        flame: "rgba(255, 62, 48, 0.48)",
        trail: "#ff6b6b",
        boostTrail: "#ff3e48",
        cockpit: "#25060b",
        reactor: "#ff3e48",
        stroke: "rgba(255, 235, 235, 0.92)",
      };
    }

    if (ratio < 0.55) {
      return {
        nose: "#fff4d6",
        core: "#ffb94f",
        tail: "#c86f24",
        glow: "rgba(255, 185, 79, 0.7)",
        flame: "rgba(255, 185, 79, 0.42)",
        trail: "#ffb94f",
        boostTrail: "#ffd166",
        cockpit: "#180f08",
        reactor: "#ffb94f",
        stroke: "rgba(255, 245, 219, 0.86)",
      };
    }

    if (ratio < 0.75) {
      return {
        nose: "#efffe8",
        core: "#7cf59b",
        tail: "#38cbd5",
        glow: "rgba(124, 245, 155, 0.64)",
        flame: "rgba(124, 245, 155, 0.32)",
        trail: "#7cf59b",
        boostTrail: "#46e6ff",
        cockpit: "#071611",
        reactor: "#7cf59b",
        stroke: "rgba(234, 255, 241, 0.84)",
      };
    }

    return {
      nose: "#d7f7ff",
      core: "#46e6ff",
      tail: "#ffb94f",
      glow: "rgba(70, 230, 255, 0.7)",
      flame: "rgba(70, 230, 255, 0.28)",
      trail: "#46e6ff",
      boostTrail: "#ffb94f",
      cockpit: "#08121a",
      reactor: "#7cf59b",
      stroke: "rgba(255, 255, 255, 0.8)",
    };
  }

  function contractStatus() {
    const contract = state.contract;
    if (!contract) {
      return "";
    }
    if (contract.failed) {
      return "合约失败";
    }
    if (contract.type === "speed") {
      const left = Math.max(0, Math.ceil(contract.target - (state.time - contract.startedAt)));
      return `合约${left}秒`;
    }
    if (contract.type === "shield") {
      return `合约护盾${Math.round(shieldPercent())}%`;
    }
    return `合约能量${Math.round(energyPercent())}%`;
  }

  function engineScale() {
    return 1 + state.upgrades.engine * 0.08;
  }

  function boostDrain() {
    return TUNE.boostDrain * Math.max(0.72, 1 - state.upgrades.engine * 0.07);
  }

  function collectReach() {
    return 8 + state.upgrades.magnet * 11;
  }

  function damageFor(value) {
    return value * Math.max(0.68, 1 - state.upgrades.shield * 0.08);
  }

  function cargoBonus() {
    return 1 + state.upgrades.cargo * 0.12;
  }

  function nextQuota() {
    const base = Math.min(8, 3 + Math.floor((state.wave - 1) / 2));
    return Math.max(2, base - state.upgrades.cargo);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function readAxis() {
    let x = 0;
    let y = 0;
    if (input.keys.has("ArrowLeft") || input.keys.has("KeyA")) x -= 1;
    if (input.keys.has("ArrowRight") || input.keys.has("KeyD")) x += 1;
    if (input.keys.has("ArrowUp") || input.keys.has("KeyW")) y -= 1;
    if (input.keys.has("ArrowDown") || input.keys.has("KeyS")) y += 1;

    x += input.touchAxes.left.x + input.touchAxes.right.x;
    y += input.touchAxes.left.y + input.touchAxes.right.y;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  function readBoost() {
    return input.keys.has("Space");
  }

  function updateHud() {
    const energy = clamp(state.energy, 0, maxEnergy());
    const shield = clamp(state.shield, 0, maxShield());
    const remaining = Math.max(0, state.quota - state.cargo);
    dom.score.textContent = Math.round(state.score).toString();
    dom.wave.textContent = state.wave.toString();
    dom.cargo.textContent = `${state.cargo}/${state.quota}`;
    dom.cargoStat?.classList.toggle("is-full", remaining === 0);
    if (dom.remainingBadge && dom.remainingCount) {
      const showRemaining = state.mode === "playing" && remaining > 0;
      dom.remainingBadge.hidden = !showRemaining;
      dom.remainingCount.textContent = remaining.toString();
    }
    dom.energyValue.textContent = Math.round(energy).toString();
    dom.shieldValue.textContent = Math.round(shield).toString();
    dom.energyBar.style.transform = `scaleX(${energy / maxEnergy()})`;
    dom.shieldBar.style.transform = `scaleX(${shield / maxShield()})`;
    updateUpgradeReadout();
    updateComboReadout();

    let objectiveText = "待命";
    if (state.mode === "paused") {
      objectiveText = "暂停";
    } else if (state.mode === "over") {
      objectiveText = "航线中断";
    } else if (state.mode === "upgrade") {
      objectiveText = "选择停靠改装";
    } else if (state.mode === "playing" && state.cargo >= state.quota) {
      objectiveText = "返回轨道港";
    } else if (state.mode === "playing") {
      objectiveText = `采集 ${state.quota - state.cargo} 份星尘`;
    }

    const status = state.mode === "playing" ? contractStatus() : "";
    const combo = state.mode === "playing" && state.combo >= 2 ? ` · ${state.combo}连击` : "";
    dom.objective.textContent = `${objectiveText}${status ? ` · ${status}` : ""}${combo}`;
  }

  function updateComboReadout() {
    if (!dom.comboMeter) {
      return;
    }

    const active = state.mode === "playing" && state.combo >= 2 && state.comboTimer > 0;
    dom.comboMeter.hidden = !active;
    if (!active) {
      return;
    }

    const progress = clamp(state.comboTimer / comboWindow(), 0, 1);
    const untilPrize = Math.max(0, state.nextComboPrizeAt - state.combo);
    dom.comboCount.textContent = state.combo.toString();
    dom.comboMultiplier.textContent = `x${comboMultiplier().toFixed(1)}`;
    dom.comboTimerBar.style.transform = `scaleX(${progress})`;
    dom.comboHint.textContent = untilPrize > 0 ? `奇星还差 ${untilPrize}` : "奇星临界";
    dom.comboMeter.classList.toggle("is-hot", untilPrize <= 1 || state.combo >= 6);
  }

  function updateUpgradeReadout() {
    let total = 0;
    let maxTotal = 0;
    for (const upgrade of UPGRADE_POOL) {
      const level = state.upgrades[upgrade.id] || 0;
      total += level;
      maxTotal += upgrade.maxLevel;
      if (dom.upgradeTiers[upgrade.id]) {
        dom.upgradeTiers[upgrade.id].textContent = `Lv.${level}`;
      }
    }

    if (dom.upgradeTotal) {
      dom.upgradeTotal.textContent = `${total}/${maxTotal}`;
    }

    for (const chip of dom.upgradeChips) {
      const id = chip.dataset.upgradeTier;
      const upgrade = UPGRADE_POOL.find((item) => item.id === id);
      const level = state.upgrades[id] || 0;
      const progress = upgrade ? (level / upgrade.maxLevel) * 100 : 0;
      chip.style.setProperty("--fill", `${progress}%`);
      chip.classList.toggle("is-active", level > 0);
      chip.classList.toggle("is-max", Boolean(upgrade && level >= upgrade.maxLevel));
      chip.title = upgrade ? `${upgrade.title} Lv.${level}/${upgrade.maxLevel}` : "";
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#061019";
    ctx.fillRect(0, 0, view.width, view.height);
    drawViewportBackdrop();

    ctx.save();
    const shake = state.shake > 0 ? state.shake * 8 : 0;
    const world = worldTransform();
    updateHudAvoidance(world);
    ctx.translate(world.ox + random(-shake, shake), world.oy + random(-shake, shake));
    ctx.scale(world.scale, world.scale);

    drawBackground();
    drawDepot();

    for (const cell of state.cells) drawCell(cell);
    for (const item of state.parcels) drawParcel(item);
    for (const star of state.bonusStars) drawSpecialStar(star);
    for (const rock of state.asteroids) drawAsteroid(rock);
    for (const mine of state.mines) drawMine(mine);
    for (const drone of state.seekers) drawSeeker(drone);
    drawPlayer();
    for (const particle of state.particles) drawParticle(particle);
    for (const floater of state.floaters) drawFloater(floater);

    if (state.flash > 0) {
      ctx.globalAlpha = state.flash * 0.35;
      ctx.fillStyle = "#ffdf8a";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    drawScreenGuidance(world);
  }

  function updateHudAvoidance(world) {
    if (!dom.shell) {
      return;
    }

    const active = state.mode === "playing" || state.mode === "paused";
    if (!active) {
      dom.shell.classList.remove("hud-fade-top", "hud-fade-bottom");
      return;
    }

    const playerScreen = worldToScreen(state.player.x, state.player.y, world);
    const playerRadius = state.player.r * world.scale;
    const compact = view.mode === "portrait" || view.width < 780;
    const topClearance = compact ? 178 : 122;
    const bottomClearance = compact ? 286 : 152;

    dom.shell.classList.toggle("hud-fade-top", playerScreen.y - playerRadius < topClearance);
    dom.shell.classList.toggle(
      "hud-fade-bottom",
      playerScreen.y + playerRadius > view.height - bottomClearance,
    );
  }

  function drawScreenGuidance(world) {
    if (state.mode !== "playing" && state.mode !== "paused") {
      return;
    }

    const target = objectiveTarget();
    if (target) {
      drawTargetIndicator(target, world);
    }

    if (view.width >= 760 && view.height >= 560) {
      drawRadar();
    }
  }

  function objectiveTarget() {
    const p = state.player;
    if (state.energy < maxEnergy() * 0.28 && state.cells.length) {
      const cell = nearest(p, state.cells);
      return { x: cell.x, y: cell.y, label: "能量", color: "#7cf59b" };
    }

    if (state.cargo >= state.quota) {
      return { x: DEPOT.x, y: DEPOT.y, label: "轨道港", color: "#ffb94f" };
    }

    if (state.bonusStars.length) {
      const star = nearest(p, state.bonusStars);
      return { x: star.x, y: star.y, label: "奇星", color: star.color };
    }

    if (!state.parcels.length) {
      return { x: DEPOT.x, y: DEPOT.y, label: "轨道港", color: "#ffb94f" };
    }

    const parcel = nearest(p, state.parcels);
    return { x: parcel.x, y: parcel.y, label: "星尘", color: "#46e6ff" };
  }

  function nearest(origin, items) {
    let best = items[0];
    let bestDistance = Infinity;
    for (const item of items) {
      const d = dist(origin.x, origin.y, item.x, item.y);
      if (d < bestDistance) {
        best = item;
        bestDistance = d;
      }
    }
    return best;
  }

  function drawTargetIndicator(target, world) {
    const screen = worldToScreen(target.x, target.y, world);
    const topMargin = view.width < 560 ? 154 : 86;
    const bottomMargin = view.width < 560 ? 138 : 78;
    const margin = 34;
    const visible =
      screen.x > margin &&
      screen.x < view.width - margin &&
      screen.y > topMargin &&
      screen.y < view.height - bottomMargin;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (visible) {
      const pulse = 1 + Math.sin(state.time * 6) * 0.18;
      ctx.strokeStyle = target.color;
      ctx.shadowColor = target.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 20 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(5, 13, 20, 0.68)";
      roundRect(screen.x - 30, screen.y - 44, 60, 22, 8);
      ctx.fill();
      ctx.fillStyle = target.color;
      ctx.fillText(target.label, screen.x, screen.y - 33);
    } else {
      const cx = view.width / 2;
      const cy = view.height / 2;
      const dx = screen.x - cx;
      const dy = screen.y - cy;
      const halfW = view.width / 2 - 38;
      const halfH = view.height / 2 - Math.max(topMargin, bottomMargin) * 0.55;
      const ratio = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 1);
      const x = clamp(cx + dx * ratio, margin, view.width - margin);
      const y = clamp(cy + dy * ratio, topMargin, view.height - bottomMargin);
      const angle = Math.atan2(dy, dx);
      const meters = Math.round(dist(state.player.x, state.player.y, target.x, target.y));

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = target.color;
      ctx.shadowColor = target.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-angle);
      ctx.fillStyle = "rgba(5, 13, 20, 0.74)";
      roundRect(-38, 18, 76, 24, 8);
      ctx.fill();
      ctx.fillStyle = target.color;
      ctx.fillText(`${target.label} ${meters}`, 0, 30);
    }

    ctx.restore();
  }

  function drawRadar() {
    const size = 94;
    const x = view.width - size - 16;
    const y = 148;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size / 2;

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "rgba(7, 18, 28, 0.66)";
    ctx.strokeStyle = "rgba(159, 217, 234, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - radius + 8, cy);
    ctx.lineTo(cx + radius - 8, cy);
    ctx.moveTo(cx, cy - radius + 8);
    ctx.lineTo(cx, cy + radius - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const plot = (xw, yw, color, dot = 3) => {
      const px = cx + (xw / WORLD.width - 0.5) * size * 0.82;
      const py = cy + (yw / WORLD.height - 0.5) * size * 0.82;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fill();
    };

    plot(DEPOT.x, DEPOT.y, "#ffb94f", 4);
    for (const item of state.parcels) plot(item.x, item.y, "#46e6ff", 2.5);
    for (const star of state.bonusStars) plot(star.x, star.y, star.color, 3.5);
    for (const cell of state.cells) plot(cell.x, cell.y, "#7cf59b", 2.5);
    for (const mine of state.mines) plot(mine.x, mine.y, "#ff3e48", 3);
    for (const drone of state.seekers) plot(drone.x, drone.y, drone.kind === "alert" ? "#ff3e48" : "#ff5aa5", 3);
    plot(state.player.x, state.player.y, "#f8fbff", 4);

    ctx.restore();
  }

  function worldToScreen(x, y, world) {
    return {
      x: world.ox + x * world.scale,
      y: world.oy + y * world.scale,
    };
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function worldTransform() {
    if (view.mode !== "portrait") {
      return { scale: view.scale, ox: view.ox, oy: view.oy };
    }

    const visibleWidth = view.width / view.scale;
    const playerX = state.player?.x ?? PLAYER_START.x;
    const cameraX = clamp(playerX, visibleWidth / 2, WORLD.width - visibleWidth / 2);
    return {
      scale: view.scale,
      ox: view.width / 2 - cameraX * view.scale,
      oy: view.oy,
    };
  }

  function drawViewportBackdrop() {
    if (!(bg.complete && bg.naturalWidth)) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = view.mode === "portrait" ? 0.9 : 0.3;
    ctx.filter = view.mode === "portrait" ? "blur(2px)" : "none";
    drawImageCover(bg, -10, -10, view.width + 20, view.height + 20);
    ctx.filter = "none";
    ctx.fillStyle = view.mode === "portrait" ? "rgba(3, 9, 15, 0.26)" : "rgba(3, 9, 15, 0.08)";
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.restore();
  }

  function drawBackground() {
    if (bg.complete && bg.naturalWidth) {
      drawImageCover(bg, 0, 0, WORLD.width, WORLD.height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
      gradient.addColorStop(0, "#082033");
      gradient.addColorStop(0.5, "#07111d");
      gradient.addColorStop(1, "#0e1f2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    ctx.fillStyle = "rgba(2, 8, 13, 0.18)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(70, 230, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 26]);
    ctx.beginPath();
    ctx.ellipse(630, 382, 410, 118, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 185, 79, 0.18)";
    ctx.beginPath();
    ctx.ellipse(846, 356, 530, 168, 0.27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawDepot() {
    const pulse = 0.5 + Math.sin(state.time * 3.2) * 0.5;
    ctx.save();
    ctx.translate(DEPOT.x, DEPOT.y);
    ctx.shadowColor = "#ffb94f";
    ctx.shadowBlur = 24 + pulse * 12;

    const zone = ctx.createRadialGradient(0, 0, 12, 0, 0, DEPOT.r + 30);
    zone.addColorStop(0, "rgba(255, 185, 79, 0.22)");
    zone.addColorStop(0.55, "rgba(70, 230, 255, 0.12)");
    zone.addColorStop(1, "rgba(255, 185, 79, 0)");
    ctx.fillStyle = zone;
    ctx.beginPath();
    ctx.arc(0, 0, DEPOT.r + 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 185, 79, 0.85)";
    ctx.setLineDash([18, 13]);
    ctx.beginPath();
    ctx.arc(0, 0, DEPOT.r + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(70, 230, 255, 0.76)";
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 185, 79, 0.86)";
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -44);
      ctx.lineTo(8, -28);
      ctx.lineTo(-8, -28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParcel(item) {
    const wobble = Math.sin(state.time * 3 + item.wobble) * 4;
    ctx.save();
    ctx.translate(item.x, item.y + wobble);
    ctx.rotate(item.spin + state.time * 1.8);
    ctx.shadowColor = "#46e6ff";
    ctx.shadowBlur = 18;

    const g = ctx.createLinearGradient(-12, -12, 12, 12);
    g.addColorStop(0, "#eaffff");
    g.addColorStop(0.42, "#46e6ff");
    g.addColorStop(1, "#ff5aa5");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawSpecialStar(star) {
    const agePulse = 0.5 + Math.sin(state.time * 6 + star.phase) * 0.5;
    const expireAlpha = clamp(star.life / 3, 0.38, 1);
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.rotate(star.spin);
    ctx.globalAlpha = expireAlpha;
    ctx.shadowColor = star.color;
    ctx.shadowBlur = 20 + agePulse * 14;

    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 32);
    aura.addColorStop(0, star.color);
    aura.addColorStop(0.34, "rgba(255, 255, 255, 0.22)");
    aura.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + agePulse * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = star.color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? star.r + agePulse * 2 : star.r * 0.42;
      const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.rotate(-star.spin);
    ctx.fillStyle = "rgba(5, 13, 20, 0.72)";
    roundRect(-34, -44, 68, 22, 8);
    ctx.fill();
    ctx.fillStyle = star.color;
    ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(star.label.replace("奇星", ""), 0, -33);
    ctx.restore();
  }

  function drawCell(cell) {
    const pulse = 0.5 + Math.sin(state.time * 4.2 + cell.pulse) * 0.5;
    ctx.save();
    ctx.translate(cell.x, cell.y);
    ctx.shadowColor = "#7cf59b";
    ctx.shadowBlur = 16 + pulse * 10;
    ctx.fillStyle = "rgba(124, 245, 155, 0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, 24 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7cf59b";
    ctx.beginPath();
    ctx.arc(0, 0, cell.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4fff7";
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }

  function drawAsteroid(rock) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.angle);
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 12;

    const g = ctx.createLinearGradient(-rock.r, -rock.r, rock.r, rock.r);
    g.addColorStop(0, "#8092a0");
    g.addColorStop(0.45, "#344252");
    g.addColorStop(1, "#171f2a");
    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(176, 221, 233, 0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    rock.shape.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "rgba(255, 185, 79, 0.22)";
    ctx.beginPath();
    ctx.moveTo(-rock.r * 0.35, -rock.r * 0.2);
    ctx.lineTo(rock.r * 0.28, rock.r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  function drawMine(mine) {
    const armed = mine.armTimer <= 0;
    const pulse = 0.5 + Math.sin(state.time * (armed ? 9 : 4) + mine.phase) * 0.5;
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.globalAlpha = armed ? 0.92 : 0.55;
    ctx.shadowColor = armed ? "#ff3e48" : "#ffb94f";
    ctx.shadowBlur = armed ? 18 + pulse * 12 : 10;

    ctx.strokeStyle = armed ? "#ff3e48" : "#ffb94f";
    ctx.lineWidth = 2;
    ctx.setLineDash(armed ? [8, 6] : [4, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, mine.r + 6 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = armed ? "rgba(255, 62, 72, 0.32)" : "rgba(255, 185, 79, 0.2)";
    ctx.beginPath();
    ctx.arc(0, 0, mine.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = armed ? "#ff3e48" : "#ffb94f";
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-2, -mine.r - 4, 4, 10);
    }

    ctx.fillStyle = "#f8fbff";
    ctx.beginPath();
    ctx.arc(0, 0, 4 + pulse * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSeeker(drone) {
    const alert = drone.kind === "alert";
    const color = alert ? "#ff3e48" : "#ff5aa5";
    const auraColor = alert ? "rgba(255, 62, 72, 0.24)" : "rgba(255, 90, 165, 0.18)";
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = alert ? 24 : 18;
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(0, 0, (alert ? 38 : 32) + Math.sin(state.time * 7 + drone.phase) * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(alert ? 27 : 22, 0);
    ctx.lineTo(alert ? -18 : -15, alert ? -15 : -13);
    ctx.lineTo(-9, 0);
    ctx.lineTo(alert ? -18 : -15, alert ? 15 : 13);
    ctx.closePath();
    ctx.fill();

    if (alert) {
      ctx.strokeStyle = "rgba(255, 223, 138, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(12, 0);
      ctx.lineTo(-4, 10);
      ctx.stroke();
    }

    ctx.fillStyle = "#f8fbff";
    ctx.beginPath();
    ctx.arc(5, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const upgrades = state.upgrades;
    const palette = shipEnergyPalette();
    const flicker = p.hitGrace > 0 && Math.floor(state.time * 20) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    drawShipAuras(upgrades);
    ctx.rotate(p.angle);
    ctx.globalAlpha = flicker ? 0.55 : 1;

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 30 || upgrades.engine > 0) {
      const engineLevel = upgrades.engine;
      const flameScale = 1 + engineLevel * 0.18;
      const flameLength = -42 - speed * 0.04 - engineLevel * 7;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 16 + engineLevel * 5;
      ctx.fillStyle = palette.flame;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(flameLength, -8 * flameScale);
      ctx.lineTo(flameLength * 0.78, 0);
      ctx.lineTo(flameLength, 8 * flameScale);
      ctx.closePath();
      ctx.fill();
    }

    drawShipUpgradeHardware(upgrades, palette);

    const body = ctx.createLinearGradient(-18, -16, 24, 16);
    body.addColorStop(0, palette.nose);
    body.addColorStop(0.52, palette.core);
    body.addColorStop(1, palette.tail);
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-12, -17);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-19, 0);
    ctx.lineTo(-4, 5);
    ctx.lineTo(-12, 17);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = palette.cockpit;
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (upgrades.reactor > 0) {
      ctx.shadowColor = palette.reactor;
      ctx.shadowBlur = 10 + upgrades.reactor * 5;
      ctx.fillStyle = palette.reactor;
      ctx.beginPath();
      ctx.arc(-5, 0, 2.5 + upgrades.reactor * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (state.cargo >= state.quota) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 185, 79, 0.66)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 12 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShipAuras(upgrades) {
    if (upgrades.shield > 0) {
      const radius = 25 + upgrades.shield * 4 + Math.sin(state.time * 4.5) * 1.4;
      ctx.save();
      ctx.rotate(state.time * 0.45);
      ctx.globalAlpha = 0.34 + upgrades.shield * 0.08;
      ctx.strokeStyle = upgrades.shield >= 3 ? "#ff5aa5" : "#46e6ff";
      ctx.lineWidth = 1.5 + upgrades.shield * 0.35;
      ctx.setLineDash([8, 6]);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 14 + upgrades.shield * 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (upgrades.magnet > 0) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (let i = 0; i < upgrades.magnet + 1; i += 1) {
        const a = state.time * (1.5 + upgrades.magnet * 0.12) + (i / (upgrades.magnet + 1)) * Math.PI * 2;
        const r = 29 + upgrades.magnet * 5;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        ctx.shadowColor = "#46e6ff";
        ctx.shadowBlur = 12;
        ctx.fillStyle = i % 2 ? "#7cf59b" : "#46e6ff";
        ctx.beginPath();
        ctx.arc(x, y, 2.5 + upgrades.magnet * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawShipUpgradeHardware(upgrades, palette) {
    if (upgrades.engine > 0) {
      ctx.save();
      ctx.shadowColor = "#ffb94f";
      ctx.shadowBlur = 10 + upgrades.engine * 2;
      ctx.fillStyle = "#ffb94f";
      for (const y of [-12, 12]) {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(-31 - upgrades.engine * 2, y * 1.2);
        ctx.lineTo(-18, y * 0.45);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (upgrades.cargo > 0) {
      ctx.save();
      ctx.fillStyle = "#b9c6d8";
      ctx.strokeStyle = "#ffb94f";
      ctx.lineWidth = 1.2;
      for (const y of [-21, 21]) {
        roundRect(-12, y - 6, 22 + upgrades.cargo * 4, 11, 4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    if (upgrades.reactor > 0) {
      ctx.save();
      ctx.globalAlpha = 0.22 + upgrades.reactor * 0.08;
      ctx.fillStyle = palette.reactor;
      ctx.shadowColor = palette.reactor;
      ctx.shadowBlur = 18 + upgrades.reactor * 5;
      ctx.beginPath();
      ctx.arc(-4, 0, 16 + upgrades.reactor * 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.94, dt * 60);
      p.vy *= Math.pow(0.94, dt * 60);
      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  function drawParticle(p) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function addParticle(x, y, vx, vy, color, size, life) {
    state.particles.push({
      x,
      y,
      vx,
      vy,
      color,
      size,
      life,
      maxLife: life,
    });
  }

  function burst(x, y, amount, color, force) {
    for (let i = 0; i < amount; i += 1) {
      const a = random(0, Math.PI * 2);
      const speed = random(45, 190) * force;
      addParticle(
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        color,
        random(2, 5),
        random(0.28, 0.72)
      );
    }
  }

  function floatText(x, y, label, color, life = 0.9) {
    state.floaters.push({
      x,
      y,
      label,
      color,
      life,
      maxLife: life,
    });
  }

  function updateFloaters(dt) {
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) {
        state.floaters.splice(i, 1);
      }
    }
  }

  function drawFloater(f) {
    const alpha = clamp(f.life / f.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillStyle = f.color;
    ctx.fillText(f.label, f.x, f.y);
    ctx.restore();
  }

  function drawImageCover(image, x, y, width, height) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      dom.pauseButton.classList.add("is-paused");
    } else if (state.mode === "paused") {
      state.mode = "playing";
      dom.pauseButton.classList.remove("is-paused");
    }
    updateHud();
  }

  function resetTouchStick(side, knob) {
    input.touchAxes[side].x = 0;
    input.touchAxes[side].y = 0;
    stickPointers[side] = null;
    knob.style.transform = "translate(-50%, -50%)";
  }

  function updateTouchStick(event, side, zone, knob) {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.34;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const length = Math.hypot(dx, dy);

    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }

    input.touchAxes[side].x = dx / max;
    input.touchAxes[side].y = dy / max;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function setupTouchStick(side, zone, knob) {
    zone.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stickPointers[side] = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      updateTouchStick(event, side, zone, knob);
    });

    zone.addEventListener("pointermove", (event) => {
      if (event.pointerId === stickPointers[side]) {
        updateTouchStick(event, side, zone, knob);
      }
    });

    zone.addEventListener("pointerup", () => resetTouchStick(side, knob));
    zone.addEventListener("pointercancel", () => resetTouchStick(side, knob));
  }

  function setupEvents() {
    window.addEventListener("resize", resize);

    document.addEventListener("keydown", (event) => {
      if (isTextInput(event.target)) {
        return;
      }

      const gameKey = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
        "Space",
        "KeyP",
        "KeyR",
        "Digit1",
        "Digit2",
        "Digit3",
        "Enter",
      ].includes(event.code);

      if (gameKey) {
        event.preventDefault();
      }

      if (event.code === "Enter" && (state.mode === "ready" || state.mode === "over")) {
        startRun();
        return;
      }
      if (event.code === "KeyP") {
        togglePause();
        return;
      }
      if (event.code === "KeyR" && state.mode === "over") {
        startRun();
        return;
      }
      if (state.mode === "upgrade" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        const upgrade = state.upgradeChoices[index];
        if (upgrade) {
          continueAfterUpgrade(upgrade.id);
        }
        return;
      }

      input.keys.add(event.code);
    });

    document.addEventListener("keyup", (event) => {
      input.keys.delete(event.code);
    });

    dom.startButton.addEventListener("click", startRun);
    dom.restartButton.addEventListener("click", startRun);
    dom.pauseButton.addEventListener("click", togglePause);
    dom.rankForm.addEventListener("submit", submitRanking);
    dom.clearRankButton.addEventListener("click", clearLeaderboard);
    dom.upgradeChoices.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-upgrade]");
      if (button) {
        continueAfterUpgrade(button.dataset.upgrade);
      }
    });

    setupTouchStick("left", dom.stickZone, dom.stickKnob);
    setupTouchStick("right", dom.rightStickZone, dom.rightStickKnob);
  }

  function isTextInput(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    );
  }

  function armAudio() {
    if (audio.armed) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    audio.ctx = new AudioContext();
    audio.armed = true;
    audio.ctx.resume?.();
  }

  function playCue(name) {
    if (!audio.armed || !audio.ctx) {
      return;
    }

    const patterns = {
      start: [[220, 0, 0.07], [330, 0.06, 0.08]],
      collect: [[740, 0, 0.055], [980, 0.045, 0.05]],
      energy: [[520, 0, 0.08], [660, 0.06, 0.08]],
      hit: [[120, 0, 0.12]],
      delivery: [[330, 0, 0.09], [520, 0.08, 0.1], [780, 0.17, 0.12]],
      upgrade: [[460, 0, 0.08], [690, 0.08, 0.1]],
      bonus: [[880, 0, 0.055], [1180, 0.05, 0.075], [1480, 0.12, 0.065]],
      alarm: [[170, 0, 0.08], [118, 0.08, 0.11]],
    };

    for (const [frequency, offset, duration] of patterns[name] || []) {
      tone(frequency, offset, duration, name === "hit" ? 0.08 : 0.045);
    }
  }

  function tone(frequency, offset, duration, volume) {
    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = frequency < 180 ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(frequency, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
    osc.connect(gain).connect(audio.ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + duration + 0.02);
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  resize();
  setupEvents();
  renderLeaderboards();
  updateHud();
  requestAnimationFrame(loop);
})();
