(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../libs/matter.min.js'), require('../config.js'));
  else root.GoofyCore = factory(root.Matter, root.GoofyConfig);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Matter, config) {
  'use strict';
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  class GameCore {
    constructor(options) {
      this.random = (options && options.random) || Math.random;
      this.onMerge = (options && options.onMerge) || function () {};
      this.reset();
    }

    reset() {
      if (this.engine) {
        Events.off(this.engine);
        Composite.clear(this.engine.world, false);
        Engine.clear(this.engine);
      }
      this.engine = Engine.create({ positionIterations: 8, velocityIterations: 8 });
      this.engine.gravity.y = 1.15;
      this.bodies = [];
      this.mergeQueue = [];
      this.score = 0;
      this.time = 0;
      this.cooldownUntil = 0;
      this.state = 'playing';
      this.revived = false;
      this.danger = 0;
      this.highestTier = 0;
      this.currentTier = this.roll();
      this.nextTier = this.roll();
      const b = config.board;
      Composite.add(this.engine.world, [
        Bodies.rectangle(b.left - 20, 350, 40, 900, { isStatic: true, label: 'wall' }),
        Bodies.rectangle(b.right + 20, 350, 40, 900, { isStatic: true, label: 'wall' }),
        Bodies.rectangle(200, b.floor + 30, 440, 60, { isStatic: true, label: 'floor' }),
      ]);
      const collisions = (event) => {
        event.pairs.forEach(({ bodyA, bodyB }) => {
          [bodyA, bodyB].forEach(body => {
            if (body.label === 'character') body.plugin.landed = true;
          });
          if (bodyA.label === 'character' && bodyB.label === 'character' && bodyA.plugin.tier === bodyB.plugin.tier) {
            this.mergeQueue.push([bodyA, bodyB]);
          }
        });
      };
      Events.on(this.engine, 'collisionStart', collisions);
      Events.on(this.engine, 'collisionActive', collisions);
    }

    roll() {
      // 新投放只有前四级；高级角色必须合成得到。
      return Math.min(3, Math.floor(Math.max(0, Math.min(0.999999, this.random())) * 4));
    }

    radius(tier) { return config.characters[tier].radius * config.characterScale; }

    clampX(x, tier) {
      const radius = this.radius(tier === undefined ? this.currentTier : tier);
      return Math.max(config.board.left + radius + 2, Math.min(config.board.right - radius - 2, x));
    }

    spawn(tier, x, y) {
      const body = Bodies.circle(this.clampX(x, tier), y, this.radius(tier), {
        label: 'character', restitution: 0.12, friction: 0.2,
        frictionStatic: 0.7, frictionAir: 0.006, density: 0.001,
      });
      body.plugin = { tier, landed: false, bornAt: this.time, overMs: 0, removed: false };
      this.bodies.push(body);
      Composite.add(this.engine.world, body);
      this.highestTier = Math.max(this.highestTier, tier);
      return body;
    }

    drop(x) {
      if (this.state !== 'playing' || this.time < this.cooldownUntil) return false;
      this.spawn(this.currentTier, x, config.dropY);
      this.currentTier = this.nextTier;
      this.nextTier = this.roll();
      this.cooldownUntil = this.time + config.dropCooldownMs;
      return true;
    }

    remove(body) {
      body.plugin.removed = true;
      Composite.remove(this.engine.world, body);
      const i = this.bodies.indexOf(body);
      if (i >= 0) this.bodies.splice(i, 1);
    }

    flushMerges() {
      const pairs = this.mergeQueue;
      this.mergeQueue = [];
      pairs.forEach(([a, b]) => {
        if (a.plugin.removed || b.plugin.removed) return;
        const tier = a.plugin.tier;
        let x = (a.position.x + b.position.x) / 2;
        let y = (a.position.y + b.position.y) / 2;
        const vx = (a.velocity.x + b.velocity.x) / 2;
        const bounce = config.mergeEffects.bounceSpeed;
        const vy = Math.max(-bounce * 1.4, Math.min(-bounce, (a.velocity.y + b.velocity.y) / 2 - bounce));
        this.remove(a);
        this.remove(b);
        const final = tier === config.characters.length - 1;
        const points = final ? config.ultimatePoints : config.characters[tier + 1].points;
        this.score += points;
        if (!final) {
          const radius = this.radius(tier + 1);
          const merged = this.spawn(tier + 1, x, Math.min(y, config.board.floor - radius));
          merged.plugin.landed = true;
          merged.plugin.mergedAt = this.time;
          Body.setVelocity(merged, { x: vx, y: vy });
          Body.setAngularVelocity(merged, (a.angularVelocity + b.angularVelocity) / 2);
          x = merged.position.x; y = merged.position.y;
        }
        this.onMerge({ x, y, tier: final ? tier : tier + 1, points, final });
      });
    }

    step(deltaMs) {
      if (this.state !== 'playing') return;
      const dt = Math.min(1000 / 60, Math.max(0, deltaMs));
      this.time += dt;
      Engine.update(this.engine, dt);
      this.flushMerges();
      this.danger = 0;
      this.bodies.forEach(body => {
        const p = body.plugin;
        const above = body.position.y - this.radius(p.tier) < config.board.dangerY;
        if (p.landed && this.time - p.bornAt > 350 && above && body.speed < 1.8) p.overMs += dt;
        else p.overMs = Math.max(0, p.overMs - dt * 2);
        this.danger = Math.max(this.danger, p.overMs / config.dangerDurationMs);
        if (p.overMs >= config.dangerDurationMs) this.state = 'gameover';
      });
    }

    revive() {
      if (this.state !== 'gameover' || this.revived) return false;
      this.bodies.slice().forEach(body => {
        if (body.position.y - this.radius(body.plugin.tier) < config.board.dangerY + 100) this.remove(body);
        else {
          body.plugin.overMs = 0;
          Body.setVelocity(body, { x: 0, y: 0 });
          Body.setAngularVelocity(body, 0);
        }
      });
      this.revived = true;
      this.state = 'playing';
      this.danger = 0;
      this.cooldownUntil = this.time + config.dropCooldownMs;
      return true;
    }
  }
  return GameCore;
});
