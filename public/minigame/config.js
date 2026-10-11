(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GoofyConfig = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    title: '合成哈基米',
    // 基于网上猫咪二创精修的透明贴图；原图与处理记录见 assets/hajimi/manifest.json。
    defaultSkin: 'reference',
    referenceNames: ['香蕉猫', '礼貌猫', '胖橘猫', '圆头耄耋', '柠檬猫', '蜜蜂猫', '花花猫', '熊猫猫', '向日葵猫', '圆头妙脆角', '妙脆角猫'],
    referenceAssets: ['hajimi/01-banana.png', 'hajimi/02-polite.png', 'hajimi/03-orange.png', 'hajimi/04-maodie.png', 'hajimi/05-lemon.png', 'hajimi/06-bee.png', 'hajimi/07-flower.png', 'hajimi/08-panda.png', 'hajimi/09-sunflower.png', 'hajimi/10-round-miaocuijiao.png', 'hajimi/11-miaocuijiao.png'],
    music: { file: 'assets/music/hajimi-loop.mp3', volume: 0.18 },
    width: 400,
    height: 800,
    board: { left: 24, right: 376, top: 232, floor: 653, dangerY: 291 },
    dropY: 288,
    // 所有角色按原尺寸的三分之二显示，碰撞半径采用同一比例。
    characterScale: 2 / 3,
    mergeEffects: { durationMs: 420, bounceSpeed: 1.8, maxBursts: 24, maxParticles: 192 },
    dropCooldownMs: 480,
    dangerDurationMs: 1500,
    ultimatePoints: 888,
    // 开通流量主并创建激励视频广告位后，填入真实 ID，再把 enabled 改为 true。
    ads: { enabled: false, rewardedVideoAdUnitId: '', timeoutMs: 120000 },
    characters: [
      { name: '豆豆眼', radius: 33, color: '#8dd4df', shade: '#42aabc', points: 0, joke: '小小的脑袋，大大的疑惑。' },
      { name: '啵嘴团', radius: 38, color: '#f6acc4', shade: '#e371a0', points: 3, joke: '嘴硬，也是硬实力。' },
      { name: '龅牙仔', radius: 43, color: '#b7d989', shade: '#80af55', points: 6, joke: '笑出强大，牙出边界。' },
      { name: '打工兽', radius: 48, color: '#ffc479', shade: '#e6a047', points: 10, joke: '只想下班，不想下落。' },
      { name: '炸毛怪', radius: 53, color: '#c7b4f2', shade: '#9b7cd5', points: 15, joke: '头发不多，情绪不少。' },
      { name: '歪嘴侠', radius: 58, color: '#f8e082', shade: '#d8b94a', points: 21, joke: '这嘴角，有自己的想法。' },
      { name: '摆烂团', radius: 63, color: '#9fd9c1', shade: '#61b495', points: 28, joke: '地心引力？我先躺会。' },
      { name: '显眼包', radius: 68, color: '#f9ad89', shade: '#df7c60', points: 36, joke: '场子可以冷，我必须热。' },
      { name: '大聪明', radius: 73, color: '#a8c5ef', shade: '#6d99d2', points: 45, joke: '智慧不详，体积很大。' },
      { name: '离谱大王', radius: 78, color: '#efabd6', shade: '#cf78b0', points: 55, joke: '离谱有边界，大王没有。' },
      { name: '宇宙大冤种', radius: 84, color: '#f9d576', shade: '#dbb34c', points: 66, joke: '合到最后，还是我扛下所有。' },
    ],
  };
});
