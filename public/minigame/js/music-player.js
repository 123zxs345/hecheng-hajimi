(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HajimiMusic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class MusicPlayer {
    constructor(options) {
      this.options = options;
      this.audio = null;
      this.playing = false;
      this.destroyed = false;
      this.generation = 0;
    }

    setPlaying(allowed) {
      if (this.destroyed || this.playing === !!allowed) return;
      const generation = ++this.generation;
      if (!allowed) {
        this.playing = false;
        try { if (this.audio) this.audio.pause(); } catch (_) {}
        return;
      }
      try {
        if (!this.audio) {
          this.audio = this.options.createAudio();
          this.audio.src = this.options.file;
          this.audio.loop = true;
          this.audio.volume = this.options.volume === undefined ? 0.18 : this.options.volume;
          this.audio.preload = 'auto';
          this.audio.obeyMuteSwitch = true;
          if (this.audio.onError) this.audio.onError(() => { this.playing = false; });
        }
        this.playing = true;
        const result = this.audio.play();
        if (result && result.catch) result.catch(() => {
          if (generation === this.generation) this.playing = false;
        });
      } catch (_) { this.playing = false; }
    }

    setTrack(file) {
      if(this.destroyed||!file||file===this.options.file)return;
      const resume=this.playing;this.setPlaying(false);++this.generation;this.options.file=file;
      if(this.audio){try{this.audio.src=file;this.audio.currentTime=0;}catch(_){}}
      if(resume)this.setPlaying(true);
    }

    destroy() {
      if (this.destroyed) return;
      this.setPlaying(false);
      this.destroyed = true;
      ++this.generation;
      if (!this.audio) return;
      try {
        if (this.audio.destroy) this.audio.destroy();
        else { this.audio.removeAttribute('src'); this.audio.load(); }
      } catch (_) {}
    }
  }
  return MusicPlayer;
});
