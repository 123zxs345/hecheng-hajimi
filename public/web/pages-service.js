(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HajimiPagesService=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  const day=ms=>Math.floor((ms+28800000)/86400000);
  const nickname=value=>typeof value==='string'?value.trim():'';
  const maxScore=100000;
  const eligible=value=>Number.isSafeInteger(value)&&value>=0&&value<=maxScore;
  const bestOf=state=>Math.max(eligible(state.baseBest)?state.baseBest:0,...Object.values(state.runs).filter(run=>!run.excluded&&eligible(run.score)).map(run=>run.score));
  return class PagesService {
    constructor(options={}){
      this.storage=options.storage||globalThis.localStorage;this.cloud=options.cloud||null;
      this.now=options.now||Date.now;this.uuid=options.uuid||(()=>crypto.randomUUID());
      this.key='hajimi.pages.v1:'+(this.cloud?.prefix||'hajimi_v1_');
      this.supportQr=options.supportQr||'./support/wechat-pay.jpg';
      this.initialized=false;this.inviteSync=null;this.profileSync=null;
    }
    read(){
      let state;try{state=JSON.parse(this.storage.getItem(this.key)||'null');}catch{}
      if(!state||!validId(state.id)||!state.ledger||!state.runs){
        const id=this.uuid();state={id,nickname:'猫友'+id.slice(-4),best:0,baseBest:0,ledger:{},runs:{},createdAt:this.now(),ref:'',inviteSent:false,dirty:false};
        this.storage.setItem(this.key,JSON.stringify(state));
      }
      if(state.baseBest===undefined){state.baseBest=eligible(state.best)?state.best:0;state.best=bestOf(state);state.dirty=true;this.storage.setItem(this.key,JSON.stringify(state));}
      return state;
    }
    mutate(change){const state=this.read();change(state);this.storage.setItem(this.key,JSON.stringify(state));return state;}
    player(){const state=this.read();return {id:state.id,nickname:state.nickname,best:state.best,coins:Math.max(0,1+Object.values(state.ledger).reduce((sum,item)=>sum+item.delta,0))};}
    async syncInvites(){
      if(!this.cloud?.configured)return;
      if(this.inviteSync)return this.inviteSync;
      const id=this.read().id;
      this.inviteSync=(async()=>{
        const rows=await this.cloud.all(this.cloud.prefix+'invite_'+id+'_');
        const valid=rows.map(r=>r.value).filter(r=>r.inviter===id&&validId(r.invitee)&&r.invitee!==id&&Number.isSafeInteger(r.createdAt)&&r.createdAt>0&&r.createdAt<=this.now()+60000);
        valid.sort((a,b)=>a.createdAt-b.createdAt||a.invitee.localeCompare(b.invitee));
        const perDay=new Map(),credited=new Set();
        this.mutate(state=>{
          for(const row of valid){
            if(credited.has(row.invitee))continue;credited.add(row.invitee);
            const date=day(row.createdAt),count=perDay.get(date)||0;
            if(count>=5)continue;perDay.set(date,count+1);
            const key='invite:'+row.invitee;
            if(!state.ledger[key])state.ledger[key]={delta:1,createdAt:row.createdAt};
          }
        });
      })().finally(()=>{this.inviteSync=null;});
      return this.inviteSync;
    }
    async publishProfile(){
      if(!this.cloud?.configured)throw new Error('排行榜暂未连接，成绩已保存在本机');
      if(this.profileSync)await this.profileSync;
      const state=this.read();if((state.best<=0&&!state.dirty)||(!state.dirty&&(!state.ref||state.inviteSent)))return;
      this.profileSync=(async()=>{
        if(state.dirty){
          await this.cloud.write(this.cloud.prefix+'player_'+state.id,{id:state.id,nickname:state.nickname,best:state.best,updatedAt:this.now()});
          this.mutate(current=>{if(current.best===state.best&&current.nickname===state.nickname)current.dirty=false;});
        }
        if(state.best>0&&validId(state.ref)&&state.ref!==state.id&&!state.inviteSent){
          const tag=this.cloud.prefix+'invite_'+state.ref+'_'+state.id;
          const existing=await this.cloud.all(tag);
          if(!existing.some(r=>r.tag===tag))await this.cloud.write(tag,{inviter:state.ref,invitee:state.id,createdAt:this.now()});
          this.mutate(current=>{current.inviteSent=true;});
        }
      })().finally(()=>{this.profileSync=null;});
      return this.profileSync;
    }
    async request(path,body){
      const writing=body!==undefined;let state=this.read();
      if(path==='session'){
        if(!this.initialized){
          this.initialized=true;
          if(writing&&validId(body.ref)&&body.ref!==state.id&&state.best===0&&!Object.keys(state.runs).length&&!state.ref)this.mutate(current=>{current.ref=body.ref;});
        }
        let online=!!this.cloud?.configured;
        if(online){try{await this.publishProfile();await this.syncInvites();}catch{online=false;}}
        return {player:this.player(),supportQr:this.supportQr,shareLimit:5,online};
      }
      if(path==='ranking'){
        if(!this.cloud?.configured)throw new Error('排行榜暂未连接，请稍后再来');
        const entries=await this.cloud.all(this.cloud.prefix+'player_');
        const profiles=entries.map(r=>r.value).filter(r=>validId(r.id)&&typeof r.nickname==='string'&&r.nickname&&Array.from(r.nickname).length<=12&&eligible(r.best)&&r.best>0);
        profiles.sort((a,b)=>b.best-a.best||(a.updatedAt||0)-(b.updatedAt||0)||a.id.localeCompare(b.id));
        return {rows:profiles.slice(0,20).map((p,i)=>({rank:i+1,nickname:p.nickname,score:p.best}))};
      }
      if(path==='profile'&&writing){
        const name=nickname(body.nickname);if(!name||Array.from(name).length>12||/[<>\x00-\x1f]/.test(name))throw new Error('昵称请用1至12个正常文字');
        this.mutate(current=>{current.nickname=name;current.dirty=true;});
        if(this.cloud?.configured)try{await this.publishProfile();}catch{}
        return {player:this.player()};
      }
      if(path==='runs'&&writing){
        const id=this.uuid(),now=this.now();
        this.mutate(current=>{current.runs[id]={startedAt:now,score:0,drops:0};const ids=Object.keys(current.runs);for(const old of ids.slice(0,-20)){const run=current.runs[old];if(!run.excluded&&eligible(run.score))current.baseBest=Math.max(current.baseBest,run.score);delete current.runs[old];}});
        return {id};
      }
      if(path==='score'&&writing){
        const run=state.runs[body.runId];if(!run)throw new Error('本局记录不存在');
        if(!Number.isSafeInteger(body.score)||body.score<0||!Number.isSafeInteger(body.drops)||body.drops<0)throw new Error('分数记录不正确');
        if(body.score>maxScore||run.excluded){
          this.mutate(current=>{current.runs[body.runId].excluded=true;current.best=bestOf(current);current.dirty=true;});
          if(this.cloud?.configured)await this.publishProfile();
          return {accepted:false,reason:'score-limit',player:this.player()};
        }
        if(body.drops<run.drops||body.drops>5000||body.score>body.drops*888)throw new Error('分数记录不正确');
        this.mutate(current=>{const r=current.runs[body.runId];r.score=Math.max(r.score,body.score);r.drops=Math.max(r.drops,body.drops);const best=bestOf(current);if(best!==current.best){current.best=best;current.dirty=true;}});
        if(body.score>0)await this.publishProfile();
        return {accepted:true,player:this.player()};
      }
      if(path==='spend'&&writing){
        if(!state.runs[body.runId])throw new Error('本局记录不存在');
        if(typeof body.requestId!=='string'||!body.requestId||body.requestId.length>80)throw new Error('请求编号不正确');
        const key='revive:'+body.runId,existing=state.ledger[key];
        if(existing){if(existing.requestId!==body.requestId)throw new Error('本局已经复活过一次');return {coins:this.player().coins};}
        if(this.player().coins<1)throw new Error('复活币不足，邀请朋友可以领取');
        this.mutate(current=>{current.ledger[key]={delta:-1,requestId:body.requestId,createdAt:this.now()};});
        return {coins:this.player().coins};
      }
      if(path==='support'){
        const key='support:'+day(this.now()),alreadyClaimed=!!state.ledger[key];
        if(!writing)return {claimedToday:alreadyClaimed};
        if(!alreadyClaimed)this.mutate(current=>{current.ledger[key]={delta:1,createdAt:this.now()};});
        return {ok:true,claimedToday:true,alreadyClaimed,player:this.player()};
      }
      if(path==='health')return {ok:true};
      throw new Error('页面不存在');
    }
  };
});
