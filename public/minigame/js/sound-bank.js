(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FrogSoundBank = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const cues = [
  {
    "id": "mambo",
    "tier": 1,
    "final": false,
    "file": "01-mambo.wav",
    "label": "礼貌猫 · 曼波",
    "phrase": "曼波",
    "sourceUrl": "https://www.myinstants.com/en/instant/mamboman-bo-shi-ge-ju-matikanetannhauser-9173/"
  },
  {
    "id": "hachimi",
    "tier": 2,
    "final": false,
    "file": "02-hachimi.wav",
    "label": "胖橘猫 · 哈吉米",
    "phrase": "哈吉米短声",
    "sourceUrl": "https://www.myinstants.com/en/instant/tokai-teio-hachimi-short-11583/"
  },
  {
    "id": "duang",
    "tier": 3,
    "final": false,
    "file": "03-duang.wav",
    "label": "圆头耄耋 · Duang",
    "phrase": "诗歌剧 Duang",
    "sourceUrl": "https://www.myinstants.com/en/instant/duang-shi-ge-ju-matikanetannhauser-14560/"
  },
  {
    "id": "wow",
    "tier": 4,
    "final": false,
    "file": "04-wow.wav",
    "label": "柠檬猫 · 哇哦",
    "phrase": "诗歌剧哇哦",
    "sourceUrl": "https://www.myinstants.com/en/instant/wow-shi-ge-ju-matikanetannhauser-39118/"
  },
  {
    "id": "oh-yeah",
    "tier": 5,
    "final": false,
    "file": "05-oh-yeah.wav",
    "label": "蜜蜂猫 · 欧耶",
    "phrase": "诗歌剧欧耶",
    "sourceUrl": "https://www.myinstants.com/en/instant/ohyeyou-ye-shi-ge-ju-matikanetannhauser-43408/"
  },
  {
    "id": "mambo-laugh",
    "tier": 6,
    "final": false,
    "file": "06-mambo-laugh.wav",
    "label": "花花猫 · 曼波轻笑",
    "phrase": "曼波轻笑",
    "sourceUrl": "https://www.myinstants.com/en/instant/mambo-laugh-matikanetannhauser-50758/"
  },
  {
    "id": "mambo-mambo",
    "tier": 7,
    "final": false,
    "file": "07-mambo-mambo.wav",
    "label": "熊猫猫 · 曼波曼波",
    "phrase": "曼波曼波双声",
    "sourceUrl": "https://www.myinstants.com/en/instant/mambo-mambo-11021/"
  },
  {
    "id": "hachimi-chant",
    "tier": 8,
    "final": false,
    "file": "08-hachimi-chant.wav",
    "label": "向日葵猫 · 哈吉米连喊",
    "phrase": "哈吉米连喊",
    "sourceUrl": "https://www.myinstants.com/en/instant/hachimi-12910/"
  },
  {
    "id": "festival-mambo",
    "tier": 9,
    "final": false,
    "file": "09-festival-mambo.wav",
    "label": "圆头妙脆角 · 曼波小曲",
    "phrase": "曼波小曲",
    "sourceUrl": "https://www.myinstants.com/en/instant/mambo-matikanetannhauser-9303/"
  },
  {
    "id": "mambo-reaction",
    "tier": 10,
    "final": false,
    "file": "10-mambo-reaction.wav",
    "label": "妙脆角猫 · 曼波反应",
    "phrase": "曼波反应音",
    "sourceUrl": "https://www.myinstants.com/en/instant/matikanetannhauser-59857/"
  },
  {
    "id": "hajimi-finale",
    "tier": 10,
    "final": true,
    "file": "11-hajimi-finale.wav",
    "label": "终极合成 · 哈吉米曼波",
    "phrase": "哈吉米曼波清场",
    "sourceUrl": "https://www.myinstants.com/en/instant/hachimi-chimici-mambo-18876/"
  }
];

  function select(event) {
    if (event && event.final) return cues[cues.length - 1];
    return cues.find(cue => !cue.final && cue.tier === (event && event.tier)) || null;
  }

  class SoundBank {
    constructor(options) {
      this.prefix = options.prefix || '';
      this.createAudio = options.createAudio;
      this.volume = options.volume === undefined ? 0.55 : options.volume;
      this.players = {};
      this.active = [];
      this.lastCue = null;
    }

    static get cues() { return cues; }
    static select(event) { return select(event); }

    player(cue) {
      if (!this.players[cue.id]) {
        const audio = this.createAudio();
        audio.src = this.prefix + cue.file;
        audio.volume = this.volume;
        if ('preload' in audio) audio.preload = 'auto';
        this.players[cue.id] = audio;
      }
      return this.players[cue.id];
    }

    stopPlayer(audio) {
      if (!audio) return;
      try {
        if (typeof audio.stop === 'function') audio.stop();
        else { audio.pause(); audio.currentTime = 0; }
      } catch (_) {}
    }

    play(event) {
      const cue = select(event);
      if (!cue) return false;
      try {
        if (cue.final) this.stop();
        const audio = this.player(cue);
        this.active = this.active.filter(player => player !== audio);
        this.stopPlayer(audio);
        while (this.active.length >= 3) this.stopPlayer(this.active.shift());
        this.active.push(audio);
        this.lastCue = cue;
        const playing = audio.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        return true;
      } catch (_) { return false; }
    }

    stop() { this.active.forEach(audio => this.stopPlayer(audio)); this.active = []; }

    destroy() {
      this.stop();
      Object.keys(this.players).forEach(id => {
        const audio = this.players[id];
        if (audio.destroy) audio.destroy();
        else { audio.removeAttribute('src'); if (audio.load) audio.load(); }
      });
      this.players = {};
    }
  }
  return SoundBank;
});
