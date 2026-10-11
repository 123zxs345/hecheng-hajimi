(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../config.js'));
  else root.GoofyRenderer = factory(root.GoofyConfig);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (config) {
  'use strict';
  const ink = '#654958';
  const green = '#ba6685';
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buttons = [];
      this.viewport = { scale: 1, x: 0, y: 0, dpr: 1 };
    }

    resize(width, height, dpr, safeTop, safeBottom) {
      const top = safeTop || 0;
      const bottom = safeBottom || 0;
      const scale = Math.min(width / config.width, (height - top - bottom) / config.height);
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.viewport = { scale, x: (width - config.width * scale) / 2, y: top + (height - top - bottom - config.height * scale) / 2, dpr };
    }

    point(x, y) {
      return { x: (x - this.viewport.x) / this.viewport.scale, y: (y - this.viewport.y) / this.viewport.scale };
    }

    box(x, y, w, h, r, fill, stroke) {
      const c = this.ctx;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
    }

    text(value, x, y, size, color, weight, align) {
      const c = this.ctx;
      c.font = `${weight || 500} ${size || 14}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      c.fillStyle = color || ink;
      c.textAlign = align || 'left';
      c.textBaseline = 'middle';
      c.fillText(String(value), x, y);
    }

    line(x1, y1, x2, y2, color, width) {
      const c = this.ctx;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
      c.lineWidth = width || 2; c.strokeStyle = color || ink; c.stroke();
    }

    circle(x, y, r, fill, stroke) {
      const c = this.ctx;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = 1.4; c.strokeStyle = stroke; c.stroke(); }
    }

    character(tier, x, y, radius, angle, app, mergeAge) {
      const c = this.ctx;
      const sprite = app && app.sprites[tier];
      c.save(); c.translate(x, y); c.rotate(angle || 0);
      if (mergeAge >= 0 && mergeAge < config.mergeEffects.durationMs) {
        const progress = mergeAge / config.mergeEffects.durationMs;
        const squash = 0.12 * Math.cos(progress * Math.PI * 3) * (1 - progress) * (1 - progress);
        c.scale(1 + squash, 1 - squash);
      }
      if (sprite && sprite.ready) {
        const width = sprite.image.width || 1;
        const height = sprite.image.height || 1;
        const scale = radius * config.characterScale * 2.12 / Math.max(width, height);
        c.drawImage(sprite.image, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
      } else {
        this.text('…', 0, 0, Math.max(9, radius / 2), '#b3909d', 500, 'center');
      }
      c.restore();
    }

    button(id, label, x, y, w, h, primary, disabled) {
      this.box(x, y + 3, w, h, 13, primary ? '#98516e' : '#ecd9df');
      this.box(x, y, w, h, 13, disabled ? '#e5e3da' : primary ? green : '#fffafb', primary ? null : '#f0dee4');
      this.text(label, x + w / 2, y + h / 2, 15, disabled ? '#a5a79d' : primary ? '#fffdf5' : ink, 650, 'center');
      if (!disabled) this.buttons.push({ id, x, y, w, h });
    }

    hit(x, y) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
      }
      return null;
    }

    render(app) {
      const c = this.ctx;
      const v = this.viewport;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#fff4f5'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.x * v.dpr, v.y * v.dpr);
      this.buttons = [];
      this.text(config.title, 24, 42, 27, ink, 850);
      this.text('小猫碰一碰，可爱长大一点。', 25, 74, 13, '#7b8272', 500);
      this.button('items', '道具', 252, 64, 40, 23);
      this.button('ranking', '排名', 296, 64, 40, 23);
      this.button('settings', '设置', 340, 64, 40, 23);
      this.box(303, 26, 72, 25, 12, '#f8dfe9');
      this.text(app.platform.kind === 'web' ? '哈吉米版' : '吸猫实验', 339, 39, 10, green, 650, 'center');
      this.box(24, 96, 170, 78, 18, '#f9e0e9');
      this.box(206, 96, 170, 78, 18, '#eff8f3', '#dcebe3');
      this.text('本局萌力值', 40, 117, 12, '#70816b');
      this.text(app.core.score.toLocaleString(), 40, 148, 30, green, 800);
      this.text('我的最高纪录', 222, 117, 12, '#8b8778');
      this.text(app.best.toLocaleString(), 222, 148, 30, ink, 800);
      this.text('正在排队', 26, 204, 12, '#747f71');
      this.character(app.core.currentTier, 109, 203, 18, 0, app);
      this.text(app.characterName(app.core.currentTier), 136, 204, 13, ink, 650);
      this.text('下一只', 288, 204, 11, '#8c9286');
      this.character(app.core.nextTier, 353, 203, 17, 0, app);

      this.box(21, 234, 358, 425, 23, '#eddbe1');
      this.box(24, 232, 352, 421, 20, '#fffdfb', '#efdee3');
      c.save();
      this.box(24, 232, 352, 421, 20); c.clip();
      c.fillStyle = '#f0eddd';
      for (let x = 40; x < 370; x += 24) for (let y = 306; y < 650; y += 24) this.circle(x, y, 0.9, '#f3e5e9');
      const danger = app.core.danger;
      c.setLineDash([6, 6]);
      this.line(34, 291, 366, 291, danger > 0 ? '#d77e67' : '#e3b4c4', 1.4);
      c.setLineDash([]);
      this.text(danger > 0 ? '快合成！马上堆满了' : '别让小猫堆过这条线', 200, 357, 10, danger > 0 ? '#bb6754' : '#b0ae99', 500, 'center');
      if (!app.core.bodies.length) {
        this.character(10, 200, 453, 53, -0.08, app);
        this.text('今天也要吸一口哈吉米', 200, 542, 17, '#9eaa93', 650, 'center');
        this.text('拖动瞄准 · 松手投放', 200, 569, 12, '#b2b6a5', 500, 'center');
      }
      app.core.bodies.forEach(body => {
        const age = typeof body.plugin.mergedAt === 'number' ? app.core.time - body.plugin.mergedAt : undefined;
        this.character(body.plugin.tier, body.position.x, body.position.y, config.characters[body.plugin.tier].radius, body.angle, app, age);
      });
      if (app.core.state === 'playing' && !app.modal && !app.paused) {
        const radius = app.core.radius(app.core.currentTier);
        const x = app.core.clampX(app.aimX);
        c.save(); c.globalAlpha = app.core.time < app.core.cooldownUntil ? 0.35 : 0.86;
        c.setLineDash([3, 7]); this.line(x, config.dropY + radius + 5, x, 632, '#d2a2b5', 1.2); c.setLineDash([]);
        this.character(app.core.currentTier, x, config.dropY, config.characters[app.core.currentTier].radius, 0, app);
        c.restore();
      }
      app.mergeBursts.forEach(burst => {
        const progress = 1 - burst.life / burst.maxLife;
        c.globalAlpha = 0.16 * (1 - progress);
        this.circle(burst.x, burst.y, burst.radius * (0.7 + progress * 0.5), '#fff6c8');
        c.globalAlpha = 0.85 * (1 - progress);
        this.circle(burst.x, burst.y, burst.radius * (0.95 + progress * 0.65), null, '#eda5c1');
      });
      app.particles.forEach(p => {
        c.globalAlpha = Math.max(0, p.life / p.maxLife);
        if (p.sparkle) {
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 4;
            const radius = p.radius * (i % 2 ? 0.3 : 1);
            const x = p.x + Math.cos(angle) * radius, y = p.y + Math.sin(angle) * radius;
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
          }
          c.closePath(); c.fillStyle = p.color; c.fill();
        } else this.circle(p.x, p.y, p.radius, p.color);
      });
      c.globalAlpha = 1;
      app.popups.forEach(p => { c.globalAlpha = Math.max(0, p.life / 900); this.text('+' + p.points, p.x, p.y, 20, green, 800, 'center'); });
      c.globalAlpha = 1;
      c.restore();
      if (app.jokeLife > 0) this.text(app.joke, 200, 634, 12, '#5c7151', 600, 'center');

      this.box(24, 676, 352, 50, 16, '#f8e5ed');
      for (let i = 0; i < config.characters.length; i++) {
        c.globalAlpha = i <= app.discovered ? 1 : 0.35;
        this.character(i, 44 + i * 31.1, 698, 11.5, 0, app);
      }
      c.globalAlpha = 1;
      this.buttons.push({ id: 'collection', x: 24, y: 676, w: 352, h: 50 });
      this.text('相同碰一碰，可爱升一级  ·  点开图鉴', 200, 732, 10, '#8b9181', 500, 'center');
      this.button('sound', app.muted ? '声音关' : '声音开', 24, 741, 82, 31);
      this.button('pause', '暂停', 114, 741, 82, 31);
      this.button('restart', '重开', 204, 741, 82, 31);
      this.button('help', '怎么玩', 294, 741, 82, 31);
      this.text('哈吉米音乐陪你合成 · 11只猫咪', 200, 789, 9, '#a2a58f', 500, 'center');

      const modal = app.modal || (app.core.state === 'gameover' ? 'gameover' : app.paused ? 'paused' : '');
      if (modal) this.overlay(app, modal);
      if (app.toastLife > 0) {
        this.box(36, 599, 328, 45, 13, '#755362');
        this.text(app.toast, 200, 622, 12, '#fffdfb', 500, 'center');
      }
    }

    overlay(app, type) {
      const c = this.ctx;
      c.fillStyle = 'rgba(33,54,45,.25)'; c.fillRect(0, 0, 400, 800);
      this.buttons = [];
      if (type === 'items' || type === 'ranking' || type === 'settings') {
        this.systemPage(app, type);
        return;
      }
      if (type === 'collection') {
        this.box(25, 130, 350, 541, 23, '#fffdfb');
        this.text('哈吉米收集图鉴', 200, 161, 23, ink, 800, 'center');
        this.text(`已发现 ${Math.min(11, app.discovered + 1)} / 11 只 · 合成解锁新角色`, 200, 191, 12, '#8a907e', 500, 'center');
        config.characters.forEach((info, i) => {
          const x = 89 + (i % 3) * 111;
          const y = 245 + Math.floor(i / 3) * 92;
          c.globalAlpha = i <= app.discovered ? 1 : 0.3;
          this.character(i, x, y, 26 + i * 0.8, 0, app);
          c.globalAlpha = 1;
          this.text(app.characterName(i), x, y + 46, 11, i <= app.discovered ? ink : '#abae9f', 600, 'center');
        });
        this.button('close', '继续合成', 57, 611, 286, 39, true);
        return;
      }
      if (type === 'help') {
        this.box(32, 236, 336, 325, 23, '#fffdfb');
        this.text('小猫合成指南', 200, 275, 21, ink, 800, 'center');
        ['① 拖动瞄准，松手掉下一只小猫咪。', '② 相同角色碰撞，会合成更大的角色。', '③ 在警戒线上方停留太久，本局结束。', '④ 用1枚复活币复活，每局最多一次。'].forEach((line, i) => this.text(line, 53, 324 + i * 36, 13, '#6e7c69'));
        this.text('电脑：← → 瞄准 · 空格投放 · P 暂停', 200, 481, 11, '#939981', 500, 'center');
        this.button('close', '懂了，开合！', 54, 513, 292, 39, true);
        return;
      }
      this.box(32, 253, 336, 316, 23, '#fffdfb');
      this.character(type === 'gameover' ? 6 : 0, 200, 291, 29, -0.08, app);
      if (type === 'restart') {
        this.text('这局要重新开始吗？', 200, 354, 22, ink, 800, 'center');
        this.text('本局分数会归零，最高纪录会保留', 200, 398, 13, '#839078', 500, 'center');
        this.button('confirm-restart', '重新开始', 54, 455, 292, 40, true);
        this.button('close', '再合一会儿', 54, 509, 292, 39);
      } else if (type === 'paused') {
        this.text('小猫打个盹', 200, 354, 23, ink, 800, 'center');
        this.text('小猫咪们等你回来', 200, 392, 14, '#839078', 500, 'center');
        this.button('resume', '继续合成', 54, 410, 292, 43, true);
        this.button('restart', '重新开始', 54, 478, 292, 40);
      } else {
        this.text('今天也吸够小猫啦', 200, 348, 22, ink, 800, 'center');
        this.text(`本局 ${app.core.score}  ·  最高 ${app.best}`, 200, 389, 17, green, 750, 'center');
        const rewardHint = `复活币剩余 ${app.coins} 枚 · 消耗1枚清理上层`;
        this.text(app.core.revived ? '复活机会已用完，下局再冲！' : rewardHint, 200, 422, 12, '#839078', 500, 'center');
        const label = app.adBusy ? '等待领取结果…' : app.coins > 0 ? `使用复活币（${app.coins}）` : '复活币不足，去领取';
        this.button('revive', label, 54, 455, 292, 40, true, app.core.revived || app.adBusy);
        this.button('confirm-restart', '再来一局', 54, 509, 292, 39, false, app.adBusy);
      }
    }

    systemPage(app, type) {
      this.box(22, 119, 356, 565, 23, '#fffdfb');
      this.text({ items: '道具小铺', ranking: '微信好友排名', settings: '小猫设置' }[type], 200, 153, 23, ink, 800, 'center');
      this.text(config.title, 200, 182, 11, '#ab8997', 500, 'center');
      if (type === 'items') {
        this.circle(200, 245, 41, '#f7d675', '#dbb550');
        this.circle(200, 245, 32, '#ffe9a6', '#e8c15a');
        this.text('喵', 200, 245, 28, '#b38638', 850, 'center');
        this.text(`复活币 × ${app.coins}`, 200, 309, 24, green, 800, 'center');
        this.text('完整观看视频，领取1枚复活币', 200, 343, 12, '#84907a', 500, 'center');
        this.text('无广告时，可按微信提示分享领奖', 200, 362, 11, '#84907a', 500, 'center');
        const unavailable = app.platform.kind === 'web' || !app.ads.available;
        this.button('claim-coin', app.adBusy ? '等待领奖结果…' : unavailable ? '领奖暂未开通' : '看视频 / 官方分享领奖 +1', 46, 377, 308, 43, true, app.adBusy || unavailable || app.coins >= 99);
        this.text('当前余额保存在本设备，上限99枚', 200, 443, 11, '#a38c96', 500, 'center');
        const canRevive = app.core.state === 'gameover' && !app.core.revived && app.coins > 0;
        this.button('revive', '用1枚复活币继续本局', 46, 463, 308, 43, false, !canRevive || app.adBusy);
        this.text('清理上层猫咪并保留分数，每局最多一次', 200, 526, 11, '#84907a', 500, 'center');
        this.button('share-game', '分享游戏给朋友', 46, 549, 308, 36, false, !app.platform.share || app.adBusy);
        this.text('普通分享不直接发币；首次赠送1枚', 200, 604, 10, '#a38c96', 500, 'center');
      } else if (type === 'settings') {
        this.text('舒服地吸猫，按你喜欢的方式来', 200, 225, 12, '#84907a', 500, 'center');
        for (const [id, title, subtitle, enabled, y] of [
          ['settings-music', '背景音乐', '哈吉米循环音乐', app.musicEnabled && !app.muted, 294],
          ['settings-sound', '合成音效', '曼波等猫咪合成原声', app.soundEnabled && !app.muted, 374],
          ['settings-ranking', '好友排名', '关闭后停止读取和同步', app.rankingAllowed, 454],
        ]) {
          this.box(42, y - 30, 316, 66, 15, '#fcf0f5');
          this.text(title, 58, y - 6, 15, ink, 700);
          this.text(subtitle, 58, y + 16, 10, '#a38c96');
          this.button(id, enabled ? '开启' : '关闭', 267, y - 18, 73, 36, enabled, id === 'settings-ranking' && !app.ranking.available);
        }
        this.text('开关和复活币余额自动保存在本设备', 200, 546, 11, '#84907a', 500, 'center');
        this.text('暂停或切到后台时，游戏和声音暂停', 200, 568, 11, '#84907a', 500, 'center');
        this.text('好友排名需要微信授权，可随时关闭', 200, 590, 11, '#a38c96', 500, 'center');
      } else {
        this.text('按同玩好友的历史最高分排列', 200, 217, 12, '#84907a', 500, 'center');
        if (app.ranking.canvas && app.rankingAllowed) {
          this.ctx.drawImage(app.ranking.canvas, 56, 259, 288, 250);
          this.button('rank-prev', '上一页', 46, 532, 92, 36);
          this.button('rank-refresh', '刷新', 154, 532, 92, 36, true, app.rankBusy);
          this.button('rank-next', '下一页', 262, 532, 92, 36);
        } else {
          this.character(1, 200, 300, 46, 0, app);
          const supported = app.ranking.available;
          this.text(supported ? '同意后查看微信同玩好友的纪录' : '好友排名请在微信小游戏内查看', 200, 381, 13, ink, 650, 'center');
          this.text('仅为排名展示使用好友昵称及最高分', 200, 414, 11, '#84907a', 500, 'center');
          this.text('不读取通讯录，不向开发者服务器上传', 200, 437, 11, '#84907a', 500, 'center');
          this.button('authorize-ranking', app.rankBusy ? '正在申请授权…' : '同意并查看好友排名', 46, 473, 308, 43, true, !supported || app.rankBusy);
          if (supported && app.platform.openPermissions) this.button('open-permissions', '微信授权设置', 94, 531, 212, 35);
          else this.text(supported ? '拒绝授权仍可正常玩游戏' : '网页试玩无法读取微信好友数据', 200, 546, 11, '#a38c96', 500, 'center');
        }
        this.text('只有玩过本游戏并有成绩的好友会显示', 200, 600, 10, '#a38c96', 500, 'center');
      }
      this.button('close', '返回合成', 46, 622, 308, 39, true, app.adBusy);
    }
  }
  return Renderer;
});
