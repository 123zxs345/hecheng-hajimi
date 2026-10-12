(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const hosting=window.HajimiHosting||{};
  const cloud=new window.HajimiTinyWebDB(hosting.tinywebdb);
  const pages=new window.HajimiPagesService({cloud});
  window.hajimiPagesService=pages;
  const analytics=window.hajimiAnalytics=new window.HajimiAnalytics({cloud,id:pages.player().id});
  let app,player,runId,drops=0,lastUploaded=0,sending=false,scoreTimer,pollTimer,toastTimer,focusBeforePanel,previousModal='',supportQr=null,supportClaimedToday=false,supportPending=false,runGeneration=0,reviveRequest=null,runRejected=false;
  const sampleActivity=()=>analytics.sample(!!app&&!document.hidden&&document.hasFocus()&&!app.paused&&!app.modal&&!app.adBusy&&app.core.state==='playing');
  const syncActivity=options=>analytics.flush(options).catch(()=>{});
  async function api(path,body){
    return pages.request(path,body);
  }
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
  function updatePlayer(p){player=p;app.coins=p.coins;app.best=p.best;app.save();$('wallet-count').textContent=p.coins;$('wallet-detail').textContent=p.coins;$('nickname-button').textContent=p.nickname+' · 改名 ✎';$('nickname').value=p.nickname;$('service-status').textContent=cloud.configured?'新朋友首次合成，邀请者得 1 币':'复活币保存在当前浏览器，合成照常进行';}
  async function startRun(){const generation=++runGeneration;runId=null;reviveRequest=null;lastUploaded=0;runRejected=false;try{const r=await api('runs',{});if(generation===runGeneration)runId=r.id;}catch{$('service-status').textContent='小金库暂时离线，合成照常进行';}}
  async function connect(){try{const s=await api('session',{ref:new URLSearchParams(location.search).get('ref')||''});updatePlayer(s.player);supportQr=s.supportQr;await startRun();if(app.core.score>0)scheduleScore();}catch{$('wallet-count').textContent='—';$('service-status').textContent='小金库暂时离线，合成照常进行';}}
  async function flushScore(){
    clearTimeout(scoreTimer);scoreTimer=null;if(!runId||sending||runRejected||app.core.score<=lastUploaded)return;
    const score=app.core.score,currentRun=runId,currentDrops=drops,generation=runGeneration;sending=true;
    try{const r=await api('score',{runId:currentRun,score,drops:currentDrops});if(generation===runGeneration){lastUploaded=score;runRejected=r.accepted===false;updatePlayer(r.player);if(runRejected)$('service-status').textContent='本局超过 100000 分，异常成绩不计入排行榜';}refreshRanking(false);}catch{$('service-status').textContent='成绩还在本机，联网后再同步';}finally{sending=false;}
  }
  function scheduleScore(){if(!scoreTimer)scoreTimer=setTimeout(flushScore,2000);}
  function invitation(){const link=new URL('./',location.href);if(player)link.searchParams.set('ref',player.id);return link.href;}
  function configureSupport(){const ready=!!supportQr;$('support-empty').hidden=ready;$('support-qr').hidden=!ready;$('support-instructions').hidden=!ready;$('submit-support').disabled=!ready||!player||supportClaimedToday||supportPending;$('submit-support').textContent=supportClaimedToday?'今天已领取 1 枚感谢复活币':'我已支持，领取 1 枚复活币';$('support-status').textContent=supportClaimedToday?'今天的感谢复活币已领取，谢谢你的支持 ♡':'确认支持后立即赠币，每位玩家每天可领取一次。';if(ready){$('support-qr').src=supportQr;$('support-qr').onerror=()=>{$('support-qr').hidden=true;$('support-empty').hidden=false;$('support-empty').textContent='收款码暂时未能加载，请稍后再来。';$('submit-support').disabled=true;};}}
  function openPanel(type){
    if(app.adBusy)return;sampleActivity();focusBeforePanel=document.activeElement;
    if(!$('panel').open)previousModal=app.modal;
    app.modal='web-panel';app.pointerCancel();if(app.platform.stopSounds)app.platform.stopSounds();app.syncMusic();
    ['share','wallet','ranking','nickname','support','help','restart'].forEach(id=>$(id+'-panel').hidden=id!==type);
    $('panel-title').textContent={share:'把快乐分享出去',wallet:'复活小金库',ranking:'哈基米高手榜 · 前20名',nickname:'我的猫友昵称',support:'送作者一包辣条',help:'小猫合成指南',restart:'重新开始？'}[type];
    if(type==='share'){$('share-link').value=invitation();$('copy-link').disabled=!player;$('native-share').disabled=!player;}
    if(type==='wallet')$('wallet-detail').textContent=player?player.coins:'暂时离线';
    if(type==='ranking')refreshRanking(true);
    if(type==='support'){configureSupport();refreshSupport();}
    if(!$('panel').open)$('panel').showModal();
  }
  function closePanel(){if($('panel').open){app.modal=previousModal;app.syncMusic();$('panel').close();}}
  $('panel').addEventListener('cancel',event=>{event.preventDefault();closePanel();});
  $('panel').addEventListener('close',()=>{if($('panel').open)return;app.modal=previousModal;app.syncMusic();app.renderer.render(app);if(document.activeElement===document.body||$('panel').contains(document.activeElement))focusBeforePanel?.focus({preventScroll:true});});
  $('panel').addEventListener('click',e=>{if(e.target===$('panel')){const b=$('panel').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closePanel();}});
  $('dialog-close').onclick=closePanel;
  const opens={'share-button':'share','wallet-share':'share','open-wallet':'wallet','open-ranking':'ranking','nickname-button':'nickname','open-support':'support','wallet-support':'support','result-share':'share','result-support':'support','help-game':'help','restart-game':'restart'};
  Object.entries(opens).forEach(([id,type])=>$(id).onclick=()=>openPanel(type));
  function renderRanking(rows,full){
    if(full){$('ranking-rows').replaceChildren();rows.forEach(p=>{const tr=document.createElement('tr');[String(p.rank).padStart(2,'0'),p.nickname,p.score.toLocaleString()].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});$('ranking-rows').append(tr);});$('ranking-count').textContent='已有 '+rows.length+' 位上榜';$('ranking-empty').hidden=rows.length>0;$('ranking-error').hidden=true;}
  }
  async function refreshRanking(full){if(!full)return;try{const r=await api('ranking');renderRanking(r.rows,full);}catch{$('ranking-error').hidden=false;$('ranking-empty').hidden=true;}}
  $('refresh-ranking').onclick=()=>refreshRanking(true);
  $('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(invitation());toast('邀请链接已复制，发给朋友一起玩吧');}catch{$('share-link').focus();$('share-link').select();toast('请长按或按 Ctrl+C 复制链接');}};
  $('native-share').onclick=async()=>{if(!navigator.share){$('copy-link').click();return;}try{await navigator.share({title:'合成哈基米',text:'小猫碰一碰，快乐翻倍。一起合出大哈基米！',url:invitation()});}catch(error){if(error.name!=='AbortError')toast('可以复制链接和保存封面来分享');}};
  $('save-nickname').onclick=async()=>{const button=$('save-nickname');button.disabled=true;try{const r=await api('profile',{nickname:$('nickname').value});updatePlayer(r.player);closePanel();toast('昵称保存好啦');refreshRanking(false);}catch(e){toast(e.message);}finally{button.disabled=false;}};
  async function refreshSupport(){if(!player)return;try{const r=await api('support');supportClaimedToday=r.claimedToday;configureSupport();}catch{}}
  $('submit-support').onclick=async()=>{if(supportPending||supportClaimedToday)return;supportPending=true;configureSupport();try{const r=await api('support',{});updatePlayer(r.player);supportClaimedToday=r.claimedToday;toast(r.alreadyClaimed?'今天的感谢复活币已经领取过啦':'已赠送 1 枚复活币，谢谢你的支持 ♡');}catch(e){toast(e.message);}finally{supportPending=false;configureSupport();}};
  const canvas=$('game');
  const sounds=new window.FrogSoundBank({prefix:'./minigame/assets/audio/',createAudio:()=>new Audio(),volume:.55});
  const music=new window.HajimiMusic({file:'./minigame/'+window.GoofyConfig.music.file,volume:window.GoofyConfig.music.volume,createAudio:()=>new Audio()});
  let musicVolume=window.GoofyConfig.music.volume;
  try{const stored=localStorage.getItem('hajimi.music.volume.v1');if(stored!==null&&stored.trim()!==''&&Number.isFinite(Number(stored)))musicVolume=Math.max(0,Math.min(1,Number(stored)));}catch{}
  music.setVolume(musicVolume);
  function showMusicVolume(){const percent=Math.round(musicVolume*100);$('music-volume').value=String(percent);$('music-volume-value').textContent=percent+'%';}
  showMusicVolume();
  const tracks=window.GoofyConfig.music.tracks;let selectedTrack=tracks[0];
  try{selectedTrack=tracks.find(track=>track.id===localStorage.getItem('hajimi.music.track.v1'))||selectedTrack;}catch{}
  for(const track of [...tracks,{id:'off',label:'关闭音乐'}]){const option=document.createElement('option');option.value=track.id;option.textContent=track.label;$('music-select').append(option);}
  music.setTrack('./minigame/'+selectedTrack.file);
  function updateControls(current){
    $('score-current').textContent=current.core.score.toLocaleString();
    $('score-best').textContent=Math.max(player?.best??pages.player().best,current.core.score<=100000&&!runRejected?current.core.score:0).toLocaleString();
    const soundOn=current.soundEnabled&&!current.muted;$('sound-toggle').textContent='音效：'+(soundOn?'开':'关');$('sound-toggle').setAttribute('aria-pressed',String(soundOn));
    $('music-select').value=current.musicEnabled&&!current.muted?selectedTrack.id:'off';
    for(const [id,tier] of [['current-cat',current.core.currentTier],['next-cat',current.core.nextTier]]){const image=$(id);if(image.dataset.tier!==String(tier)){image.dataset.tier=tier;image.src='./minigame/assets/'+window.GoofyConfig.referenceAssets[tier];image.alt=window.GoofyConfig.referenceNames[tier];}}
    $('current-cat-name').textContent=window.GoofyConfig.referenceNames[current.core.currentTier];
    const ended=current.core.state==='gameover';$('game-result').hidden=!ended;$('result-score').textContent=current.core.score.toLocaleString();$('score-warning').hidden=current.core.score<=100000&&!runRejected;
    $('result-revive').disabled=current.core.revived||current.adBusy||!player;$('result-revive').textContent=current.core.revived?'本局已用过复活':current.coins?'使用复活币（'+current.coins+'）':'领取复活币';
    $('paused-screen').hidden=!current.paused||ended||!!current.modal;$('pause-game').textContent=current.paused?'继续':'暂停';$('pause-game').disabled=ended;
  }
  let lastScore=-1,lastState='';
  try{
    app=window.gameApp=new window.GoofyApp({kind:'web',canvas,assetPrefix:'./minigame/',size:()=>({width:canvas.clientWidth,height:canvas.clientHeight,dpr:devicePixelRatio||1}),load:key=>{const saved=JSON.parse(localStorage.getItem(key)||'null')||{};return {...saved,best:pages.player().best,coins:0};},save:(key,value)=>localStorage.setItem(key,JSON.stringify(value)),createImage:()=>new Image(),requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),sounds,music,sound:e=>sounds.play(e),stopSounds:()=>sounds.stop(),destroySounds:()=>sounds.destroy(),status(current){if(current.core.score!==lastScore){lastScore=current.core.score;if(current.core.score>0)scheduleScore();}if(current.core.state!==lastState){lastState=current.core.state;if(lastState==='gameover'){sampleActivity();flushScore();syncActivity();}}updateControls(current);$('game-status').textContent=`本局 ${current.core.score} 分，个人最高 ${player?.best||0} 分`;}});
    const originalDrop=app.core.drop.bind(app.core);app.core.drop=x=>{const success=originalDrop(x);if(success){drops++;const first=!analytics.started;analytics.start();if(first)syncActivity();}return success;};
    const originalAction=app.action.bind(app);
    app.action=async id=>{
      if(app.adBusy)return;
      if(id==='items'||id==='claim-coin'){openPanel('wallet');return;}
      if(id==='ranking'){openPanel('ranking');return;}
      if(id==='share-game'){openPanel('share');return;}
      if(id==='restart'||id==='help'){openPanel(id);return;}
      if(id==='confirm-restart'){
        // 网络请求在后台执行，新一局的本地玩法立即开始。
        const pending=flushScore();closePanel();originalAction(id);drops=0;lastScore=0;runRejected=false;
        pending.finally(()=>startRun());return;
      }
      originalAction(id);
    };
    $('pause-game').onclick=()=>{sampleActivity();app.action('pause');};$('resume-game').onclick=()=>{analytics.interact();app.action('resume');};
    $('result-restart').onclick=$('confirm-restart').onclick=()=>app.action('confirm-restart');$('result-revive').onclick=()=>app.revive();
    $('sound-toggle').onclick=()=>{app.audioUnlocked=true;app.action('settings-sound');updateControls(app);};
    $('music-volume').oninput=()=>{musicVolume=Number($('music-volume').value)/100;music.setVolume(musicVolume);showMusicVolume();try{localStorage.setItem('hajimi.music.volume.v1',String(musicVolume));}catch{}app.audioUnlocked=true;app.syncMusic();};
    $('music-select').onchange=()=>{const track=tracks.find(track=>track.id===$('music-select').value);app.audioUnlocked=true;app.musicEnabled=!!track;if(track){selectedTrack=track;music.setTrack('./minigame/'+track.file);try{localStorage.setItem('hajimi.music.track.v1',track.id);}catch{}}app.muted=!app.musicEnabled&&!app.soundEnabled;app.syncMusic();app.save();updateControls(app);};
    app.revive=async()=>{
      if(app.core.state!=='gameover'||app.core.revived||app.adBusy)return;
      if(!player||!runId){toast('小金库暂时离线，联网后可以使用复活币');return;}
      if(app.coins<1){openPanel('wallet');return;}
      app.adBusy=true;app.syncMusic();reviveRequest=reviveRequest||crypto.randomUUID();
      try{const r=await api('spend',{runId,requestId:reviveRequest});app.coins=r.coins;player.coins=r.coins;$('wallet-count').textContent=r.coins;$('wallet-detail').textContent=r.coins;if(app.core.revive()){app.modal='';app.paused=app.hidden;app.save();toast('使用了 1 枚复活币，再合一会儿！');}}catch(e){toast(e.message);}finally{app.adBusy=false;app.syncMusic();}
    };
    const point=e=>{const b=canvas.getBoundingClientRect();return app.renderer.point(e.clientX-b.left,e.clientY-b.top);};
    canvas.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;analytics.interact();e.preventDefault();canvas.focus({preventScroll:true});try{canvas.setPointerCapture(e.pointerId);}catch{}const p=point(e);app.pointerDown(p.x,p.y);});
    canvas.addEventListener('pointermove',e=>{const p=point(e);app.pointerMove(p.x,p.y);});canvas.addEventListener('pointerup',e=>{e.preventDefault();const p=point(e);app.pointerUp(p.x,p.y);});canvas.addEventListener('pointercancel',()=>app.pointerCancel());
    document.addEventListener('keydown',e=>{if($('panel').open||['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement.tagName))return;if(['ArrowLeft','ArrowRight',' ','Enter','Escape','p','P','r','R'].includes(e.key)){e.preventDefault();app.key(e.key);}});
    addEventListener('resize',()=>app.resize());document.addEventListener('visibilitychange',()=>{sampleActivity();app.setVisible(!document.hidden);if(document.hidden){flushScore();syncActivity({keepalive:true});}else if(player)api('session').then(s=>updatePlayer(s.player)).catch(()=>{});});addEventListener('pagehide',()=>{sampleActivity();app.save();syncActivity({keepalive:true});});
    setInterval(sampleActivity,1000);setInterval(()=>syncActivity(),30000);syncActivity();
    connect();refreshRanking(false);pollTimer=setInterval(async()=>{if(document.hidden||!player||app.adBusy)return;try{const s=await api('session');updatePlayer(s.player);if(app.core.score>lastUploaded)flushScore();if(!$('support-panel').hidden)refreshSupport();}catch{}},15000);
    addEventListener('online',()=>{if(!player)connect();else{api('session').then(s=>{updatePlayer(s.player);flushScore();}).catch(()=>{});}refreshRanking(false);});
  }catch(error){$('load-error').hidden=false;console.error(error);}
})();
