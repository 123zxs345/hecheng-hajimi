import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Music=require('../public/minigame/js/music-player.js');
test('switching tracks pauses the old recording and applies the new file without duplicate playback',()=>{
  let pauses=0,plays=0;const audio={src:'',pause(){pauses++;},play(){plays++;return Promise.resolve();},currentTime:8};
  const music=new Music({file:'first.mp3',createAudio:()=>audio});music.setPlaying(true);music.setTrack('second.mp3');
  assert.equal(audio.src,'second.mp3');assert.equal(audio.currentTime,0);assert.equal(pauses,1);assert.equal(plays,2);
  music.setPlaying(false);music.setTrack('third.mp3');assert.equal(plays,2);assert.equal(audio.src,'third.mp3');
});
test('a rejected old play promise cannot cancel the replacement track',async()=>{
  let reject,plays=0;const audio={pause(){},play(){plays++;return plays===1?new Promise((_,r)=>{reject=r;}):Promise.resolve();}};
  const music=new Music({file:'one.mp3',createAudio:()=>audio});music.setPlaying(true);music.setTrack('two.mp3');reject(Error('old blocked'));await Promise.resolve();
  assert.equal(music.playing,true);music.destroy();assert.equal(music.playing,false);
});
test('a user volume applies before playback, changes immediately, and survives switching tracks',()=>{
  let plays=0;const audio={pause(){},play(){plays++;return Promise.resolve();}};
  const music=new Music({file:'one.mp3',volume:.36,createAudio:()=>audio});
  music.setVolume(.62);music.setPlaying(true);assert.equal(audio.volume,.62);
  music.setVolume(0);assert.equal(audio.volume,0);assert.equal(plays,1);
  music.setTrack('two.mp3');assert.equal(audio.volume,0);
  music.setVolume(.41);assert.equal(audio.volume,.41);assert.equal(music.playing,true);
});
