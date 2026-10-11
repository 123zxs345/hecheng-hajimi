(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CatFriendRanking = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class FriendRanking {
    constructor(wx) {
      this.wx = wx;
      this.context = null;
      this.enabled = false;
      this.visible = false;
      this.lastScore = -1;
      this.permissionRequest = 0;
      try { if (wx && typeof wx.getOpenDataContext === 'function') this.context = wx.getOpenDataContext(); } catch (_) {}
    }
    get available() { return !!(this.context && this.context.canvas && this.wx && typeof this.wx.authorize === 'function'); }
    get canvas() { return this.visible && this.enabled && this.context ? this.context.canvas : null; }
    restore() {
      if (!this.available || typeof this.wx.getSetting !== 'function') return Promise.resolve(false);
      const request = ++this.permissionRequest;
      return new Promise(resolve => {
        try { this.wx.getSetting({ success: result => { if (request !== this.permissionRequest) { resolve(false); return; } this.enabled = !!(result.authSetting && result.authSetting['scope.WxFriendInteraction']); resolve(this.enabled); }, fail: () => resolve(false) }); }
        catch (_) { resolve(false); }
      });
    }
    authorize() {
      if (!this.available) return Promise.resolve(false);
      const request = ++this.permissionRequest;
      return new Promise(resolve => {
        let settled = false;
        const finish = allowed => { if (settled) return; settled = true; clearTimeout(timer); if (request !== this.permissionRequest) { resolve(false); return; } this.enabled = allowed; resolve(allowed); };
        const timer = setTimeout(() => finish(false), 15000);
        try { this.wx.authorize({ scope: 'scope.WxFriendInteraction', success: () => finish(true), fail: () => finish(false) }); }
        catch (_) { finish(false); }
      });
    }
    send(message) {
      try { this.context.postMessage(message); } catch (_) { this.visible = false; return false; }
      return true;
    }
    show(score) {
      if (!this.available || !this.enabled) return;
      this.visible = true;
      this.lastScore = Math.max(this.lastScore, score);
      this.context.canvas.width = 576; this.context.canvas.height = 500;
      this.send({ type: 'show', score, width: 288, height: 250, dpr: 2 });
    }
    update(score) {
      if (!this.enabled || !this.available || score <= this.lastScore) return;
      this.lastScore = score;
      this.send({ type: 'score', score });
    }
    page(delta) { if (this.visible && this.enabled) this.send({ type: 'page', delta }); }
    hide() { if (this.context && (this.visible || this.enabled)) this.send({ type: 'hide' }); this.visible = false; }
    disable() { this.permissionRequest++; if (this.context && this.enabled) this.send({ type: 'hide', revoke: true }); this.enabled = false; this.visible = false; this.lastScore = -1; }
  }
  return FriendRanking;
});
