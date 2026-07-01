const WORLD = { width: 1280, height: 720 };
const DEPOT = { x: 1118, y: 594, r: 62 };
const PLAYER_START = { x: 156, y: 360 };
const MAX_DT = 1 / 30;

const TUNE = {
  accel: 650,
  boostAccel: 930,
  maxSpeed: 282,
  boostSpeed: 428,
  drag: 0.955,
  boostDrain: 14,
  baseDrain: 1.65,
  energyDrainMultiplier: 1.2,
  hitGrace: 0.65,
};

const UPGRADES = [
  { id: "engine", short: "推", title: "离子推进", maxLevel: 4 },
  { id: "shield", short: "盾", title: "相位护盾", maxLevel: 4 },
  { id: "magnet", short: "磁", title: "回收磁场", maxLevel: 3 },
  { id: "reactor", short: "能", title: "冷核电池", maxLevel: 4 },
  { id: "cargo", short: "舱", title: "压缩货舱", maxLevel: 2 },
];

const SPECIAL_STARS = [
  { id: "gold", label: "金色", color: "#ffdf8a" },
  { id: "surge", label: "充能", color: "#7cf59b" },
  { id: "guard", label: "护盾", color: "#46e6ff" },
  { id: "cargo", label: "货舱", color: "#ffb94f" },
  { id: "echo", label: "回声", color: "#d986ff" },
];

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
    combo: 0,
    comboTimer: 0,
    nextComboPrizeAt: 3,
    shake: 0,
    upgrades: { engine: 0, shield: 0, magnet: 0, reactor: 0, cargo: 0 },
    player: { x: PLAYER_START.x, y: PLAYER_START.y, vx: 0, vy: 0, r: 17, angle: 0, hitGrace: 0 },
    parcels: [],
    bonusStars: [],
    cells: [],
    asteroids: [],
    seekers: [],
    mines: [],
    particles: [],
    upgradeChoices: [],
  };
}

Page({
  data: {
    mode: "ready",
    objective: "待命",
    score: 0,
    wave: 1,
    cargo: 0,
    quota: 3,
    remaining: 3,
    energy: 100,
    shield: 100,
    energyPercent: 100,
    shieldPercent: 100,
    delivered: 0,
    upgradeTotal: 0,
    upgradeMax: 17,
    upgradeChips: UPGRADES.map((item) => ({ ...item, level: 0 })),
    upgradeChoices: [],
  },

  onReady() {
    this.state = createState();
    this.input = { axis: { x: 0, y: 0 }, boost: false, stickId: null, boostId: null, origin: null };
    this.stars = Array.from({ length: 90 }, () => ({
      x: random(0, WORLD.width),
      y: random(0, WORLD.height),
      r: random(0.8, 2.2),
      a: random(0.22, 0.82),
    }));
    this.initCanvas();
  },

  onUnload() {
    this.stopLoop();
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select("#gameCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) return;
        this.canvas = info.node;
        this.ctx = this.canvas.getContext("2d");
        this.dpr = wx.getSystemInfoSync().pixelRatio || 1;
        this.view = { width: info.width, height: info.height };
        this.canvas.width = Math.max(1, Math.floor(info.width * this.dpr));
        this.canvas.height = Math.max(1, Math.floor(info.height * this.dpr));
        this.lastTime = 0;
        this.syncHud(true);
        this.startLoop();
      });
  },

  startLoop() {
    const tick = (now) => {
      const current = now || Date.now();
      const dt = this.lastTime ? Math.min(MAX_DT, (current - this.lastTime) / 1000) : 0;
      this.lastTime = current;
      if (this.state.mode === "playing") this.update(dt);
      else this.updateAmbient(dt);
      this.render();
      this.loopId = this.canvas.requestAnimationFrame
        ? this.canvas.requestAnimationFrame(tick)
        : setTimeout(() => tick(Date.now()), 16);
    };
    tick(Date.now());
  },

  stopLoop() {
    if (!this.canvas || !this.loopId) return;
    if (this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(this.loopId);
    else clearTimeout(this.loopId);
  },

  startRun() {
    this.state = createState();
    this.state.mode = "playing";
    this.spawnLevel();
    this.syncHud(true);
  },

  spawnLevel() {
    const s = this.state;
    s.parcels = [];
    s.bonusStars = [];
    s.cells = [];
    s.asteroids = [];
    s.seekers = [];
    s.mines = [];
    s.quota = Math.max(2, 3 + Math.floor(s.wave / 2) - s.upgrades.cargo);

    for (let i = 0; i < s.quota + Math.min(2, Math.floor(s.wave / 2)); i += 1) {
      const p = this.pickSpawnPoint(62);
      s.parcels.push({ x: p.x, y: p.y, r: 13, spin: random(0, Math.PI * 2), wobble: random(0, Math.PI * 2) });
    }

    for (let i = 0; i < 2 + (s.wave > 3 ? 1 : 0); i += 1) {
      const p = this.pickSpawnPoint(58);
      s.cells.push({ x: p.x, y: p.y, r: 12, pulse: random(0, Math.PI * 2) });
    }

    for (let i = 0; i < 6 + s.wave * 2; i += 1) {
      const p = this.pickSpawnPoint(80);
      const r = random(18, 42 + Math.min(s.wave * 2, 18));
      s.asteroids.push({ x: p.x, y: p.y, vx: random(-28, 28), vy: random(-28, 28), r, angle: random(0, 7), spin: random(-0.9, 0.9) });
    }

    for (let i = 0; i < Math.min(5, Math.max(0, Math.floor((s.wave - 1) / 2))); i += 1) {
      this.spawnSeeker(false);
    }

    this.floatText(DEPOT.x, DEPOT.y - 72, `第 ${s.wave} 段航线`, "#ffb94f");
  },

  update(dt) {
    const s = this.state;
    s.time += dt;
    s.shake = Math.max(0, s.shake - dt * 1.8);
    this.updatePlayer(dt);
    this.updateBonusStars(dt);
    this.updateAsteroids(dt);
    this.updateSeekers(dt);
    this.updateMines(dt);
    this.updateParticles(dt);
    this.updateCombo(dt);
    this.checkCollections();
    this.checkDelivery();
    if (s.energy <= 0 || s.shield <= 0) {
      s.mode = "over";
      this.syncHud(true);
    } else if (Math.floor(s.time * 10) !== this.lastHudTick) {
      this.lastHudTick = Math.floor(s.time * 10);
      this.syncHud(false);
    }
  },

  updateAmbient(dt) {
    this.state.time += dt;
    this.updateParticles(dt);
  },

  updatePlayer(dt) {
    const s = this.state;
    const p = s.player;
    const moving = Math.hypot(this.input.axis.x, this.input.axis.y) > 0.05;
    const wantsBoost = moving && this.input.boost && s.energy > 4;
    const engine = 1 + s.upgrades.engine * 0.08;
    const accel = (wantsBoost ? TUNE.boostAccel : TUNE.accel) * engine;
    const maxSpeed = (wantsBoost ? TUNE.boostSpeed : TUNE.maxSpeed) * engine;
    p.vx += this.input.axis.x * accel * dt;
    p.vy += this.input.axis.y * accel * dt;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx *= maxSpeed / speed;
      p.vy *= maxSpeed / speed;
    }
    p.vx *= Math.pow(TUNE.drag, dt * 60);
    p.vy *= Math.pow(TUNE.drag, dt * 60);
    p.x = clamp(p.x + p.vx * dt, p.r, WORLD.width - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, WORLD.height - p.r);
    if (Math.hypot(p.vx, p.vy) > 14) p.angle = Math.atan2(p.vy, p.vx);
    const boostDrain = TUNE.boostDrain * Math.max(0.72, 1 - s.upgrades.engine * 0.07);
    s.energy -= (TUNE.baseDrain + (wantsBoost ? boostDrain : 0)) * TUNE.energyDrainMultiplier * dt;
    if (dist(p.x, p.y, DEPOT.x, DEPOT.y) < DEPOT.r + 18 && s.cargo === 0) {
      s.energy = Math.min(this.maxEnergy(), s.energy + (10 + s.upgrades.reactor * 1.5) * dt);
    }
    p.hitGrace = Math.max(0, p.hitGrace - dt);
    if (moving && s.time % 0.05 < dt) {
      const back = p.angle + Math.PI;
      this.addParticle(p.x + Math.cos(back) * 18, p.y + Math.sin(back) * 18, "#46e6ff", wantsBoost ? 5 : 3);
    }
  },

  updateAsteroids(dt) {
    for (const rock of this.state.asteroids) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;
      if (rock.x < -rock.r) rock.x = WORLD.width + rock.r;
      if (rock.x > WORLD.width + rock.r) rock.x = -rock.r;
      if (rock.y < -rock.r) rock.y = WORLD.height + rock.r;
      if (rock.y > WORLD.height + rock.r) rock.y = -rock.r;
      if (this.collideHazard(rock, 12 + this.state.wave * 0.8, 190, "asteroid")) break;
    }
  },

  updateSeekers(dt) {
    const s = this.state;
    const p = s.player;
    for (let i = s.seekers.length - 1; i >= 0; i -= 1) {
      const drone = s.seekers[i];
      if (drone.life != null) {
        drone.life -= dt;
        if (drone.life <= 0) {
          s.seekers.splice(i, 1);
          continue;
        }
      }
      const dx = p.x - drone.x;
      const dy = p.y - drone.y;
      const angle = Math.atan2(dy, dx);
      const alert = drone.kind === "alert";
      drone.vx += Math.cos(angle) * (alert ? 190 : 138) * dt;
      drone.vy += Math.sin(angle) * (alert ? 190 : 138) * dt;
      const max = alert ? 236 : 185;
      const speed = Math.hypot(drone.vx, drone.vy);
      if (speed > max) {
        drone.vx *= max / speed;
        drone.vy *= max / speed;
      }
      drone.vx *= Math.pow(0.972, dt * 60);
      drone.vy *= Math.pow(0.972, dt * 60);
      drone.x = clamp(drone.x + drone.vx * dt, 28, WORLD.width - 28);
      drone.y = clamp(drone.y + drone.vy * dt, 28, WORLD.height - 28);
      drone.angle = Math.atan2(drone.vy, drone.vx);
      this.collideHazard(drone, alert ? 24 : 18, alert ? 285 : 245, "seeker");
    }
  },

  updateBonusStars(dt) {
    const s = this.state;
    for (let i = s.bonusStars.length - 1; i >= 0; i -= 1) {
      const star = s.bonusStars[i];
      star.life -= dt;
      star.spin += dt * 2.4;
      if (star.life <= 0) s.bonusStars.splice(i, 1);
    }
  },

  updateMines(dt) {
    const s = this.state;
    for (let i = s.mines.length - 1; i >= 0; i -= 1) {
      const mine = s.mines[i];
      mine.life -= dt;
      mine.armTimer = Math.max(0, mine.armTimer - dt);
      if (mine.life <= 0) {
        s.mines.splice(i, 1);
        continue;
      }
      if (mine.armTimer <= 0 && this.collideHazard(mine, 24 + s.wave * 1.4, 320, "mine")) {
        s.mines.splice(i, 1);
        this.floatText(mine.x, mine.y - 32, "地雷爆炸", "#ff6b6b");
      }
    }
  },

  collideHazard(hazard, damage, knockback, source) {
    const s = this.state;
    const p = s.player;
    const d = dist(p.x, p.y, hazard.x, hazard.y);
    if (d > p.r + hazard.r || p.hitGrace > 0) return false;
    const nx = (p.x - hazard.x) / Math.max(1, d);
    const ny = (p.y - hazard.y) / Math.max(1, d);
    p.vx += nx * knockback;
    p.vy += ny * knockback;
    p.hitGrace = TUNE.hitGrace;
    s.shield = Math.max(0, s.shield - damage * Math.max(0.68, 1 - s.upgrades.shield * 0.08));
    s.combo = 0;
    s.comboTimer = 0;
    s.nextComboPrizeAt = 3;
    s.shake = 0.42;
    this.floatText(p.x, p.y - 24, "受击", "#ff6b6b");
    if (source === "asteroid") this.triggerPenalty(hazard);
    this.syncHud(false);
    return true;
  },

  checkCollections() {
    const s = this.state;
    const p = s.player;
    const reach = 8 + s.upgrades.magnet * 11;
    for (let i = s.parcels.length - 1; i >= 0; i -= 1) {
      const item = s.parcels[i];
      if (s.cargo >= s.quota) continue;
      if (dist(p.x, p.y, item.x, item.y) < p.r + item.r + reach) {
        s.parcels.splice(i, 1);
        s.cargo += 1;
        this.bumpCombo(item.x, item.y);
        this.addScore(45 + s.wave * 5, item.x, item.y, "#46e6ff", "星尘");
      }
    }
    for (let i = s.bonusStars.length - 1; i >= 0; i -= 1) {
      const star = s.bonusStars[i];
      if (dist(p.x, p.y, star.x, star.y) < p.r + star.r + reach) {
        s.bonusStars.splice(i, 1);
        this.collectSpecialStar(star);
      }
    }
    for (let i = s.cells.length - 1; i >= 0; i -= 1) {
      const cell = s.cells[i];
      if (dist(p.x, p.y, cell.x, cell.y) < p.r + cell.r + reach) {
        s.cells.splice(i, 1);
        s.energy = Math.min(this.maxEnergy(), s.energy + 28 + s.upgrades.reactor * 3);
        this.bumpCombo(cell.x, cell.y);
        this.addScore(20, cell.x, cell.y, "#7cf59b", "能量");
      }
    }
  },

  collectSpecialStar(star) {
    const s = this.state;
    this.bumpCombo(star.x, star.y, false);
    if (star.type === "gold") this.addScore(170 + s.wave * 38, star.x, star.y, star.color, "金色奇星");
    if (star.type === "surge") s.energy = Math.min(this.maxEnergy(), s.energy + 40);
    if (star.type === "guard") s.shield = Math.min(this.maxShield(), s.shield + 30);
    if (star.type === "cargo" && s.cargo < s.quota) s.cargo += 1;
    if (star.type === "echo" && s.cargo < s.quota) {
      for (let i = 0; i < 2; i += 1) {
        const p = this.pickNearbyPoint(star.x, star.y, 62, 138, 46);
        s.parcels.push({ x: p.x, y: p.y, r: 11, spin: random(0, 7), wobble: random(0, 7) });
      }
    }
    if (star.type !== "gold") this.addScore(70 + s.wave * 12, star.x, star.y, star.color, star.label);
    this.floatText(star.x, star.y - 36, star.label, star.color);
    this.syncHud(false);
  },

  checkDelivery() {
    const s = this.state;
    const p = s.player;
    if (dist(p.x, p.y, DEPOT.x, DEPOT.y) >= DEPOT.r + p.r || s.cargo < s.quota) return;
    const bonus = Math.round((s.quota * 120 + s.wave * 85 + Math.round(s.energy * 1.5)) * (1 + s.upgrades.cargo * 0.12));
    s.score += bonus;
    s.delivered += s.cargo;
    s.cargo = 0;
    s.combo = 0;
    s.comboTimer = 0;
    s.mode = "upgrade";
    s.upgradeChoices = this.pickUpgradeChoices();
    this.floatText(DEPOT.x, DEPOT.y - 72, `交付 +${bonus}`, "#ffb94f");
    this.syncHud(true);
  },

  bumpCombo(x, y, allowPrize = true) {
    const s = this.state;
    s.combo += 1;
    s.comboTimer = Math.max(3.2, 4.8 - s.combo * 0.08);
    if (allowPrize && s.combo >= s.nextComboPrizeAt && s.bonusStars.length < 4) {
      const type = SPECIAL_STARS[Math.floor(Math.random() * SPECIAL_STARS.length)];
      const p = this.pickNearbyPoint(x, y, 96, 210, 86);
      s.bonusStars.push({ x: p.x, y: p.y, r: 16, ...type, spin: random(0, 7), phase: random(0, 7), life: 12 });
      s.nextComboPrizeAt = s.combo + Math.floor(random(2, 4));
      this.floatText(p.x, p.y - 36, "奇星出现", type.color);
    }
    this.syncHud(false);
  },

  updateCombo(dt) {
    const s = this.state;
    if (s.comboTimer <= 0) {
      s.combo = 0;
      return;
    }
    s.comboTimer = Math.max(0, s.comboTimer - dt);
    if (s.comboTimer === 0) s.combo = 0;
  },

  triggerPenalty(hazard) {
    if (Math.random() < 0.55) {
      this.spawnSeeker(true, hazard.x, hazard.y);
      this.floatText(hazard.x, hazard.y - 42, "红警飞机", "#ff6b6b");
    } else {
      for (let i = 0; i < 2; i += 1) {
        const p = this.pickNearbyPoint(hazard.x, hazard.y, 90, 180, 70);
        this.state.mines.push({ x: p.x, y: p.y, r: 18, phase: random(0, 7), armTimer: 0.72, life: 18 });
      }
      this.floatText(hazard.x, hazard.y - 42, "航道布雷", "#ff6b6b");
    }
  },

  spawnSeeker(alert, x, y) {
    const p = x == null ? this.pickSpawnPoint(96) : this.pickNearbyPoint(x, y, 150, 230, 130);
    this.state.seekers.push({
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      r: alert ? 19 : 18,
      angle: 0,
      phase: random(0, 7),
      kind: alert ? "alert" : "normal",
      life: alert ? 18 : null,
    });
  },

  chooseUpgrade(event) {
    const id = event.currentTarget.dataset.id;
    const item = UPGRADES.find((upgrade) => upgrade.id === id);
    if (!item || this.state.mode !== "upgrade") return;
    this.state.upgrades[id] = Math.min(item.maxLevel, this.state.upgrades[id] + 1);
    this.state.wave += 1;
    this.state.mode = "playing";
    this.state.energy = Math.min(this.maxEnergy(), this.state.energy + 42 + this.state.upgrades.reactor * 8);
    this.state.shield = Math.min(this.maxShield(), this.state.shield + 18 + this.state.upgrades.shield * 5);
    this.spawnLevel();
    this.syncHud(true);
  },

  pickUpgradeChoices() {
    return shuffle(UPGRADES.filter((upgrade) => this.state.upgrades[upgrade.id] < upgrade.maxLevel)).slice(0, 3).map((upgrade) => ({
      ...upgrade,
      nextLevel: this.state.upgrades[upgrade.id] + 1,
    }));
  },

  addScore(base, x, y, color, label) {
    const multiplier = 1 + Math.min(1.5, Math.max(0, this.state.combo - 1) * 0.12);
    const gained = Math.round(base * multiplier);
    this.state.score += gained;
    this.floatText(x, y - 16, `+${gained} ${label}`, color);
  },

  updateParticles(dt) {
    const list = this.state.particles;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  },

  addParticle(x, y, color, size) {
    this.state.particles.push({ x, y, vx: random(-40, 40), vy: random(-40, 40), color, size, life: random(0.25, 0.55) });
  },

  floatText(x, y, text, color) {
    this.state.particles.push({ x, y, vx: 0, vy: -34, color, size: 14, text, life: 0.9 });
  },

  render() {
    if (!this.ctx || !this.view) return;
    const ctx = this.ctx;
    const s = this.state;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    const world = this.worldTransform();
    this.drawBackdrop(ctx);
    ctx.save();
    ctx.translate(world.ox + random(-s.shake * 8, s.shake * 8), world.oy + random(-s.shake * 8, s.shake * 8));
    ctx.scale(world.scale, world.scale);
    this.drawWorld(ctx);
    ctx.restore();
  },

  drawBackdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, this.view.width, this.view.height);
    g.addColorStop(0, "#082033");
    g.addColorStop(0.55, "#07111d");
    g.addColorStop(1, "#061019");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.view.width, this.view.height);
  },

  drawWorld(ctx) {
    const s = this.state;
    ctx.fillStyle = "#061019";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    for (const star of this.stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = "#dff8ff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.drawDepot(ctx);
    for (const item of s.parcels) this.drawParcel(ctx, item);
    for (const item of s.bonusStars) this.drawSpecialStar(ctx, item);
    for (const cell of s.cells) this.drawCell(ctx, cell);
    for (const rock of s.asteroids) this.drawAsteroid(ctx, rock);
    for (const mine of s.mines) this.drawMine(ctx, mine);
    for (const drone of s.seekers) this.drawSeeker(ctx, drone);
    this.drawPlayer(ctx);
    for (const p of s.particles) this.drawParticle(ctx, p);
  },

  drawDepot(ctx) {
    const pulse = 0.5 + Math.sin(this.state.time * 3.2) * 0.5;
    ctx.save();
    ctx.translate(DEPOT.x, DEPOT.y);
    ctx.strokeStyle = "#ffb94f";
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 13]);
    ctx.beginPath();
    ctx.arc(0, 0, DEPOT.r + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 185, 79, 0.2)";
    ctx.beginPath();
    ctx.arc(0, 0, DEPOT.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawParcel(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y + Math.sin(this.state.time * 3 + item.wobble) * 4);
    ctx.rotate(item.spin + this.state.time * 1.8);
    ctx.fillStyle = "#46e6ff";
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawSpecialStar(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.spin);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 18 : 8;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawCell(ctx, cell) {
    ctx.fillStyle = "#7cf59b";
    ctx.beginPath();
    ctx.arc(cell.x, cell.y, cell.r + Math.sin(this.state.time * 4 + cell.pulse) * 3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawAsteroid(ctx, rock) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.angle);
    ctx.fillStyle = "#526575";
    ctx.strokeStyle = "rgba(176,221,233,.3)";
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      const r = rock.r * (0.75 + ((i % 3) * 0.1));
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawMine(ctx, mine) {
    const armed = mine.armTimer <= 0;
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.strokeStyle = armed ? "#ff3e48" : "#ffb94f";
    ctx.fillStyle = armed ? "rgba(255,62,72,.28)" : "rgba(255,185,79,.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, mine.r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawSeeker(ctx, drone) {
    const alert = drone.kind === "alert";
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.angle);
    ctx.fillStyle = alert ? "#ff3e48" : "#ff5aa5";
    ctx.beginPath();
    ctx.moveTo(alert ? 27 : 22, 0);
    ctx.lineTo(-15, -13);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-15, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawPlayer(ctx) {
    const p = this.state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const g = ctx.createLinearGradient(-18, -16, 24, 16);
    g.addColorStop(0, "#d7f7ff");
    g.addColorStop(0.52, this.state.energy / this.maxEnergy() < 0.3 ? "#ff3e48" : "#46e6ff");
    g.addColorStop(1, "#ffb94f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-12, -17);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-19, 0);
    ctx.lineTo(-4, 5);
    ctx.lineTo(-12, 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#08121a";
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawParticle(ctx, p) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = "700 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  worldTransform() {
    const scale = this.view.width / 720;
    const visibleWidth = this.view.width / scale;
    const playerX = this.state.player.x;
    const cameraX = clamp(playerX, visibleWidth / 2, WORLD.width - visibleWidth / 2);
    return { scale, ox: this.view.width / 2 - cameraX * scale, oy: Math.max(132, (this.view.height - WORLD.height * scale) * 0.48) };
  },

  pickSpawnPoint(margin) {
    const p = this.state.player;
    for (let i = 0; i < 120; i += 1) {
      const x = random(70, WORLD.width - 70);
      const y = random(92, WORLD.height - 64);
      if (dist(x, y, p.x, p.y) > 180 + margin && dist(x, y, DEPOT.x, DEPOT.y) > 130 + margin) return { x, y };
    }
    return { x: random(160, 980), y: random(120, 600) };
  },

  pickNearbyPoint(x, y, minPlayerDistance, maxRadius, minRadius) {
    for (let i = 0; i < 60; i += 1) {
      const a = random(0, Math.PI * 2);
      const r = random(minRadius, maxRadius);
      const px = clamp(x + Math.cos(a) * r, 42, WORLD.width - 42);
      const py = clamp(y + Math.sin(a) * r, 64, WORLD.height - 42);
      if (dist(px, py, this.state.player.x, this.state.player.y) > minPlayerDistance) return { x: px, y: py };
    }
    return this.pickSpawnPoint(minPlayerDistance * 0.55);
  },

  maxEnergy() {
    return 100 + this.state.upgrades.reactor * 15;
  },

  maxShield() {
    return 100 + this.state.upgrades.shield * 20;
  },

  syncHud(force) {
    const s = this.state;
    const energy = Math.max(0, Math.round(s.energy));
    const shield = Math.max(0, Math.round(s.shield));
    const remaining = Math.max(0, s.quota - s.cargo);
    const total = UPGRADES.reduce((sum, item) => sum + s.upgrades[item.id], 0);
    const max = UPGRADES.reduce((sum, item) => sum + item.maxLevel, 0);
    const objective = s.mode === "playing" ? (remaining > 0 ? `采集 ${remaining} 份星尘` : "返回轨道港") : s.mode === "upgrade" ? "选择停靠改装" : s.mode === "over" ? "航线中断" : "待命";
    const payload = {
      mode: s.mode,
      objective: s.combo >= 2 && s.mode === "playing" ? `${objective} · ${s.combo}连击` : objective,
      score: Math.round(s.score),
      wave: s.wave,
      cargo: s.cargo,
      quota: s.quota,
      remaining,
      energy,
      shield,
      energyPercent: Math.round((energy / this.maxEnergy()) * 100),
      shieldPercent: Math.round((shield / this.maxShield()) * 100),
      delivered: s.delivered,
      upgradeTotal: total,
      upgradeMax: max,
      upgradeChips: UPGRADES.map((item) => ({ ...item, level: s.upgrades[item.id] })),
      upgradeChoices: s.upgradeChoices,
    };
    const signature = JSON.stringify(payload);
    if (force || signature !== this.hudSignature) {
      this.hudSignature = signature;
      this.setData(payload);
    }
  },

  onTouchStart(event) {
    this.readTouches(event.touches);
  },

  onTouchMove(event) {
    this.readTouches(event.touches);
  },

  onTouchEnd(event) {
    this.readTouches(event.touches || []);
  },

  readTouches(touches) {
    const list = Array.from(touches || []);
    const left = list.find((touch) => touch.x < this.view.width * 0.55);
    const right = list.find((touch) => touch.x >= this.view.width * 0.55);
    if (left) {
      if (!this.input.origin || this.input.stickId !== left.identifier) {
        this.input.origin = { x: left.x, y: left.y };
        this.input.stickId = left.identifier;
      }
      const dx = left.x - this.input.origin.x;
      const dy = left.y - this.input.origin.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const max = 56;
      this.input.axis = { x: clamp(dx / max, -1, 1), y: clamp(dy / max, -1, 1) };
      if (len > max) {
        this.input.axis.x = dx / len;
        this.input.axis.y = dy / len;
      }
    } else {
      this.input.axis = { x: 0, y: 0 };
      this.input.origin = null;
      this.input.stickId = null;
    }
    this.input.boost = Boolean(right);
  },
});

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
