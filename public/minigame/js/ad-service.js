(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GoofyAdService = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class AdService {
    constructor(options) {
      const settings = options || {};
      this.config = settings.config || {};
      this.ad = null;
      this.pending = null;
      this.destroyed = false;
      this.timer = null;
      const wx = settings.wx;
      if (this.config.enabled && this.config.rewardedVideoAdUnitId && wx && typeof wx.createRewardedVideoAd === 'function') {
        try {
          this.ad = wx.createRewardedVideoAd({
            adUnitId: this.config.rewardedVideoAdUnitId,
            disableFallbackSharePage: false,
          });
          this.closeHandler = result => this.finish(!!result && result.isEnded === true, result && result.isEnded === true ? 'completed' : 'cancelled');
          this.errorHandler = () => this.finish(false, 'unavailable');
          this.ad.onClose(this.closeHandler);
          this.ad.onError(this.errorHandler);
        } catch (_) { this.ad = null; }
      }
    }

    get available() { return !!this.ad && !this.destroyed; }

    play() {
      if (!this.available) return Promise.resolve({ rewarded: false, reason: this.destroyed ? 'destroyed' : 'not-configured' });
      if (this.pending) return Promise.resolve({ rewarded: false, reason: 'busy' });
      return new Promise(resolve => {
        const request = { resolve };
        this.pending = request;
        this.timer = setTimeout(() => {
          this.finish(false, 'timeout');
          // 超时后无法区分迟到的关闭回调与新请求，销毁当前连接避免误发奖励。
          this.destroy();
        }, this.config.timeoutMs || 120000);
        const active = () => this.pending === request && !this.destroyed;
        Promise.resolve().then(() => {
          if (active()) return this.ad.show();
        }).catch(() => {
          if (!active()) return;
          return this.ad.load().then(() => { if (active()) return this.ad.show(); });
        }).catch(() => { if (active()) this.finish(false, 'unavailable'); });
      });
    }

    finish(rewarded, reason) {
      if (!this.pending) return;
      clearTimeout(this.timer);
      this.timer = null;
      const request = this.pending;
      this.pending = null;
      request.resolve({ rewarded, reason });
    }

    destroy() {
      this.destroyed = true;
      this.finish(false, 'destroyed');
      if (this.ad) {
        if (this.ad.offClose) this.ad.offClose(this.closeHandler);
        if (this.ad.offError) this.ad.offError(this.errorHandler);
        if (this.ad.destroy) this.ad.destroy();
      }
      this.ad = null;
    }
  }
  return AdService;
});
