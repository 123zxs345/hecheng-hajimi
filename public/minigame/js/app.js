(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../config.js'), require('./core.js'), require('./renderer.js'), require('./ad-service.js'), require('./friend-ranking.js'));
  else root.GoofyApp = factory(root.GoofyConfig, root.GoofyCore, root.GoofyRenderer, root.GoofyAdService, root.CatFriendRanking);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (config, GameCore, Renderer, AdService, FriendRanking) {
  'use strict';
  const saveKey = 'goofy-merge.save.v1';
  class GameApp {
    constructor(platform) {
      this.platform = platform;
      this.renderer = new Renderer(platform.canvas);
      this.best = 0;
      this.discovered = 0;
      this.muted = false;
      this.coins = 1;
      this.musicEnabled = true;
      this.soundEnabled = true;
      this.rankingAllowed = false;
      this.rankBusy = false;
      this.rankRequest = 0;
      this.skin = config.defaultSkin || 'original';
      this.sprites = [];
      this.assetErrors = [];
      try {
        const saved = platform.load(saveKey) || {};
        this.best = Number.isFinite(saved.best) && saved.best >= 0 ? Math.floor(saved.best) : 0;
        this.discovered = Number.isFinite(saved.discovered) ? Math.max(0, Math.min(10, Math.floor(saved.discovered))) : 0;
        this.muted = saved.muted === true;
        this.musicEnabled = saved.musicEnabled === undefined ? !this.muted : saved.musicEnabled === true;
        this.soundEnabled = saved.soundEnabled === undefined ? !this.muted : saved.soundEnabled === true;
        this.rankingAllowed = saved.rankingAllowed === true;
        if (Object.prototype.hasOwnProperty.call(saved, 'coins')) this.coins = Number.isFinite(saved.coins) ? Math.min(99, Math.max(0, Math.floor(saved.coins))) : 0;
        // 升级为哈吉米主题时保留最高分、静音等设置，旧皮肤选择迁移到新素材。
      } catch (_) {}
      this.aimX = 200;
      this.modal = '';
      this.paused = false;
      this.hidden = false;
      this.adBusy = false;
      this.audioUnlocked = platform.kind !== 'web';
      this.particles = [];
      this.mergeBursts = [];
      this.popups = [];
      this.joke = '';
      this.jokeLife = 0;
      this.toast = '';
      this.toastLife = 0;
      this.dragging = false;
      this.downAction = null;
      this.ads = new AdService({ wx: platform.wx, config: config.ads });
      this.ranking = new FriendRanking(platform.wx);
      this.core = new GameCore({ onMerge: event => this.mergeEffect(event) });
      this.lastTime = null;
      this.accumulator = 0;
      this.alive = true;
      this.resize();
      this.loadSprites();
      this.renderer.render(this);
      this.syncMusic();
      this.save();
      if (this.rankingAllowed) {
        const restoring = this.rankRequest;
        this.ranking.restore().then(allowed => {
          if (restoring !== this.rankRequest) return;
          if (allowed && this.alive && this.rankingAllowed) this.ranking.update(this.best);
          else this.ranking.disable();
        });
      }
      this.tick = time => this.frame(time);
      this.frameId = platform.requestFrame(this.tick);
    }

    loadSprites() {
      config.referenceAssets.forEach((file, tier) => {
        const sprite = { image: this.platform.createImage(), ready: false, file };
        this.sprites[tier] = sprite;
        sprite.image.onload = () => { sprite.ready = true; this.assetErrors = this.assetErrors.filter(item => item.tier !== tier); };
        sprite.image.onerror = () => {
          sprite.ready = false;
          if (!this.assetErrors.some(item => item.tier === tier)) this.assetErrors.push({ tier, file });
          this.notify('猫咪图片加载失败，请重新打开游戏');
          if (this.platform.assetError) this.platform.assetError(file);
        };
        sprite.image.src = this.platform.assetPrefix + 'assets/' + file;
      });
    }

    resize() {
      const s = this.platform.size();
      this.renderer.resize(s.width, s.height, Math.min(3, s.dpr || 1), s.safeTop, s.safeBottom);
    }

    characterName(tier) {
      return config.referenceNames[tier];
    }

    syncMusic() {
      if (this.platform.music) this.platform.music.setPlaying(this.audioUnlocked && !this.muted && this.musicEnabled && !this.paused && !this.hidden && !this.adBusy && this.alive);
    }

    save() {
      try { this.platform.save(saveKey, { best: this.best, discovered: this.discovered, muted: this.muted, skin: this.skin, coins: this.coins, musicEnabled: this.musicEnabled, soundEnabled: this.soundEnabled, rankingAllowed: this.rankingAllowed }); } catch (_) {}
      if (this.rankingAllowed && this.ranking) this.ranking.update(this.best);
    }

    frame(timestamp) {
      if (!this.alive) return;
      const time = typeof timestamp === 'number' ? timestamp : Date.now();
      const elapsed = this.lastTime === null ? 0 : Math.min(66, Math.max(0, time - this.lastTime));
      this.lastTime = time;
      const running = !this.hidden && !this.paused && !this.modal && !this.adBusy && this.core.state === 'playing';
      if (running) {
        this.accumulator += elapsed;
        while (this.accumulator >= 1000 / 60) {
          this.core.step(1000 / 60);
          this.accumulator -= 1000 / 60;
        }
      } else this.accumulator = 0;
      if (this.core.score > this.best || this.core.highestTier > this.discovered) {
        this.best = Math.max(this.best, this.core.score);
        this.discovered = Math.max(this.discovered, this.core.highestTier);
        this.save();
      }
      if (running) {
        this.particles.forEach(p => { p.x += p.vx * elapsed / 16.667; p.y += p.vy * elapsed / 16.667; p.vy += 0.07 * elapsed / 16.667; p.life -= elapsed; });
        this.particles = this.particles.filter(p => p.life > 0);
        this.mergeBursts.forEach(burst => { burst.life -= elapsed; });
        this.mergeBursts = this.mergeBursts.filter(burst => burst.life > 0);
        this.popups.forEach(p => { p.life -= elapsed; p.y -= elapsed * 0.025; });
        this.popups = this.popups.filter(p => p.life > 0);
        this.jokeLife -= elapsed;
      }
      if (!this.hidden) {
        this.toastLife -= elapsed;
        this.renderer.render(this);
        if (this.platform.status) this.platform.status(this);
      }
      this.frameId = this.platform.requestFrame(this.tick);
    }

    mergeEffect(event) {
      const effects = config.mergeEffects;
      const palette = ['#ed99b9', '#98d7c0', '#f2cd68'];
      this.mergeBursts.push({ x: event.x, y: event.y, radius: this.core.radius(event.tier), life: effects.durationMs, maxLife: effects.durationMs });
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 2;
        const startRadius = this.core.radius(event.tier) * 0.75;
        const sparkle = i % 3 === 0;
        this.particles.push({ x: event.x + Math.cos(angle) * startRadius, y: event.y + Math.sin(angle) * startRadius,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
          radius: (sparkle ? 3 : 2) + Math.random() * 2, sparkle, color: palette[i % palette.length], life: effects.durationMs, maxLife: effects.durationMs });
      }
      this.popups.push({ x: event.x, y: event.y - 20, points: event.points, life: 900 });
      this.mergeBursts.splice(0, Math.max(0, this.mergeBursts.length - effects.maxBursts));
      this.particles.splice(0, Math.max(0, this.particles.length - effects.maxParticles));
      this.popups.splice(0, Math.max(0, this.popups.length - effects.maxBursts));
      this.joke = event.final ? '妙脆角猫集合！+888' : `合出${this.characterName(event.tier)}！萌力 +${event.points}`;
      this.jokeLife = 2600;
      if (!this.muted && this.soundEnabled && this.platform.sound) this.platform.sound(event);
    }

    blocked() { return !!this.modal || this.paused || this.hidden || this.adBusy || this.core.state !== 'playing'; }

    pointerDown(x, y) {
      this.audioUnlocked = true;
      if (this.platform.unlockAudio) this.platform.unlockAudio();
      this.syncMusic();
      this.downAction = this.renderer.hit(x, y);
      this.dragging = !this.downAction && !this.blocked() && y >= config.board.top && y <= config.board.floor;
      if (this.dragging) this.aimX = this.core.clampX(x);
    }

    pointerMove(x, y) {
      if (this.dragging || (!this.blocked() && y >= config.board.top && y <= config.board.floor)) this.aimX = this.core.clampX(x);
    }

    pointerUp(x, y) {
      if (this.downAction && this.renderer.hit(x, y) === this.downAction) this.action(this.downAction);
      else if (this.dragging && !this.blocked()) {
        this.aimX = this.core.clampX(x);
        this.core.drop(this.aimX);
      }
      this.dragging = false;
      this.downAction = null;
      this.renderer.render(this);
    }

    pointerCancel() { this.dragging = false; this.downAction = null; }

    key(key) {
      this.audioUnlocked = true;
      if (key === 'Escape') { if (this.modal) this.action('close'); else this.paused = !this.paused; }
      else if (key.toLowerCase() === 'p') this.action('pause');
      else if (key.toLowerCase() === 'r') this.action('restart');
      else if (!this.blocked()) {
        if (key === 'ArrowLeft') this.aimX = this.core.clampX(this.aimX - 15);
        else if (key === 'ArrowRight') this.aimX = this.core.clampX(this.aimX + 15);
        else if (key === ' ' || key === 'Enter') this.core.drop(this.aimX);
      }
      if (this.paused && this.platform.stopSounds) this.platform.stopSounds();
      this.syncMusic();
      this.renderer.render(this);
    }

    notify(message) { this.toast = message; this.toastLife = 3200; }

    action(id) {
      if (this.adBusy) return;
      if (id === 'sound') { this.muted = !this.muted; this.musicEnabled = !this.muted; this.soundEnabled = !this.muted; if (this.muted && this.platform.stopSounds) this.platform.stopSounds(); this.save(); }
      else if (id === 'settings-music' || id === 'settings-sound') {
        const property = id === 'settings-music' ? 'musicEnabled' : 'soundEnabled';
        this[property] = !this[property]; this.muted = !this.musicEnabled && !this.soundEnabled;
        if (!this.soundEnabled && this.platform.stopSounds) this.platform.stopSounds(); this.save();
      } else if (id === 'settings-ranking') {
        if (this.rankingAllowed) { this.rankingAllowed = false; this.rankRequest++; this.ranking.disable(); this.save(); }
        else { this.modal = 'ranking'; }
      } else if (id === 'items' || id === 'settings' || id === 'ranking') {
        if (this.modal === 'ranking' && id !== 'ranking') { this.rankRequest++; this.ranking.hide(); }
        this.modal = id;
        if (id === 'ranking' && this.rankingAllowed) this.enableRanking();
      } else if (id === 'authorize-ranking' || id === 'rank-refresh') this.enableRanking();
      else if (id === 'rank-next' || id === 'rank-prev') this.ranking.page(id === 'rank-next' ? 1 : -1);
      else if (id === 'claim-coin') this.claimCoin();
      else if (id === 'share-game') {
        if (this.platform.share) { this.platform.share(); this.notify('普通分享不发币，请使用官方领奖入口'); }
        else this.notify('请在微信小游戏中分享给朋友');
      }
      else if (id === 'open-permissions' && this.platform.openPermissions) this.platform.openPermissions();
      else if (id === 'pause') { this.modal = ''; this.paused = !this.paused; if (this.paused && this.platform.stopSounds) this.platform.stopSounds(); }
      else if (id === 'resume') this.paused = false;
      else if (id === 'restart') this.modal = 'restart';
      else if (id === 'confirm-restart') {
        this.core.reset(); this.modal = ''; this.paused = false; this.aimX = 200;
        this.particles = []; this.mergeBursts = []; this.popups = []; this.jokeLife = 0;
      } else if (id === 'help' || id === 'collection') this.modal = id;
      else if (id === 'close') { this.rankRequest++; this.ranking.hide(); this.modal = ''; }
      else if (id === 'revive') this.revive();
      this.syncMusic();
    }

    async revive() {
      if (this.core.revived || this.adBusy || this.core.state !== 'gameover') return;
      if (this.coins < 1) { this.modal = 'items'; this.notify('复活币不足，前往道具小铺'); return; }
      if (this.core.revive()) { this.coins--; this.modal = ''; this.paused = this.hidden; this.save(); this.notify('消耗1枚复活币，本局继续'); }
      this.syncMusic();
    }

    async claimCoin() {
      if (this.adBusy || !this.alive) return;
      if (this.coins >= 99) { this.notify('复活币已满，先使用再领取'); return; }
      if (this.platform.kind === 'web' || !this.ads.available) { this.notify('领奖尚未开通，请稍后再来'); return; }
      this.adBusy = true;
      this.syncMusic();
      if (this.platform.stopSounds) this.platform.stopSounds();
      let result;
      try { result = await this.ads.play(); } catch (_) { result = { rewarded: false, reason: 'unavailable' }; }
      this.adBusy = false;
      if (!this.alive) return;
      if (result.rewarded) { this.coins = Math.min(99, this.coins + 1); this.save(); this.notify('领取成功，复活币 +1'); }
      else this.notify(result.reason === 'cancelled' ? '领奖未完成，没有发放复活币' : '暂时无法领奖，请稍后再试');
      this.syncMusic();
    }

    async enableRanking() {
      if (this.rankBusy || !this.alive) return;
      if (!this.ranking.available) { this.notify('好友排名请在微信小游戏内查看'); return; }
      this.rankBusy = true;
      const request = ++this.rankRequest;
      const allowed = await this.ranking.authorize();
      this.rankBusy = false;
      if (!this.alive || request !== this.rankRequest || this.modal !== 'ranking') { this.ranking.disable(); return; }
      if (allowed) { this.rankingAllowed = true; this.save(); this.ranking.show(this.best); }
      else { this.rankingAllowed = false; this.ranking.disable(); this.save(); this.notify('未获得好友排名授权，可在微信设置中调整'); }
    }

    setSkin() {
      this.skin = 'reference';
      this.save();
      this.renderer.render(this);
    }

    setVisible(visible) {
      this.hidden = !visible;
      this.lastTime = null;
      this.pointerCancel();
      if (!visible && this.core.state === 'playing') this.paused = true;
      if (!visible && this.platform.stopSounds) this.platform.stopSounds();
      if (!visible) this.ranking.hide();
      if (visible && this.modal === 'ranking' && this.rankingAllowed) this.enableRanking();
      this.syncMusic();
      // 回到前台立即更新按钮，第一下点击也能命中「继续合成」。
      if (visible) this.renderer.render(this);
    }

    destroy() {
      this.alive = false;
      this.platform.cancelFrame(this.frameId);
      this.ads.destroy();
      this.rankRequest++; this.ranking.disable();
      if (this.platform.destroySounds) this.platform.destroySounds();
      if (this.platform.music) this.platform.music.destroy();
      this.save();
    }
  }
  return GameApp;
});
