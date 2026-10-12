(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HajimiAnalytics=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
  const date=ms=>new Date(ms+28800000).toISOString().slice(0,10).replaceAll('-','');
  const dayStart=ms=>Math.floor((ms+28800000)/86400000)*86400000-28800000;
  return class Analytics {
    constructor(options={}){
      this.cloud=options.cloud;this.storage=options.storage||globalThis.localStorage;this.id=options.id;
      this.now=options.now||Date.now;this.uuid=options.uuid||(()=>crypto.randomUUID());
      this.key='hajimi.analytics.v1:'+(this.cloud?.prefix||'')+':'+this.id;
      this.session=this.uuid().replaceAll('-','').slice(-12);this.lastSample=this.now();this.lastInteraction=0;this.started=false;this.pending=null;
    }
    read(){let value;try{value=JSON.parse(this.storage.getItem(this.key)||'null');}catch{}return value&&value.entries?value:{entries:{},firstPlayedAt:0,visitorSent:false};}
    change(fn){const state=this.read();fn(state);this.storage.setItem(this.key,JSON.stringify(state));return state;}
    add(at,ms){
      if(!validId(this.id))return;
      this.change(state=>{
        if(!state.firstPlayedAt)state.firstPlayedAt=at;
        const day=date(at),key=day+'_'+this.session;
        const entry=state.entries[key]||(state.entries[key]={id:this.id,date:day,session:this.session,playMs:0,firstPlayedAt:at,updatedAt:at});
        entry.playMs=Math.min(86400000,entry.playMs+ms);entry.updatedAt=this.now();entry.dirty=true;
      });
    }
    start(){if(!this.started){this.started=true;this.lastSample=this.now();this.add(this.now(),0);}this.interact();}
    interact(){this.lastInteraction=this.now();}
    sample(active){
      const now=this.now(),previous=this.lastSample;this.lastSample=now;
      if(!this.started||!active||now<=previous||now-previous>5000)return;
      const end=Math.min(now,this.lastInteraction+60000);let cursor=previous;
      while(cursor<end){const boundary=dayStart(cursor)+86400000,stop=Math.min(end,boundary);this.add(cursor,stop-cursor);cursor=stop;}
    }
    async flush(options={}){
      if(this.pending)return this.pending;
      if(!validId(this.id)||!Object.values(this.read().entries).some(row=>row.dirty))return;
      if(!this.cloud?.configured)throw new Error('统计暂时离线，记录将在联网后补交');
      this.pending=(async()=>{
        if(!this.read().visitorSent){await this.cloud.write(this.cloud.prefix+'visitor_'+this.id,{id:this.id,firstPlayedAt:this.read().firstPlayedAt},options);this.change(state=>{state.visitorSent=true;});}
        const entries=Object.values(this.read().entries).filter(row=>row.dirty);
        for(const entry of entries){
          const {dirty,...row}=entry,tag=this.cloud.prefix+'activity_'+row.date+'_'+row.id+'_'+row.session;
          await this.cloud.write(tag,row,options);
          this.change(state=>{const current=state.entries[row.date+'_'+row.session];if(current&&current.playMs===row.playMs&&current.updatedAt===row.updatedAt)current.dirty=false;});
        }
      })().finally(()=>{this.pending=null;});return this.pending;
    }
    async summary(){
      if(!this.cloud?.configured)throw new Error('数据统计暂时未连接');
      const [visitors,activities]=await Promise.all([this.cloud.all(this.cloud.prefix+'visitor_'),this.cloud.all(this.cloud.prefix+'activity_')]);
      const today=date(this.now()),players=new Set(),days=new Map();let totalPlayMs=0;
      for(const {tag,value} of visitors)if(validId(value.id)&&tag===this.cloud.prefix+'visitor_'+value.id&&Number.isSafeInteger(value.firstPlayedAt)&&value.firstPlayedAt>0)players.add(value.id);
      for(const {tag,value:row} of activities){
        if(!validId(row.id)||!/^\d{8}$/.test(row.date)||row.date>today||!/^[a-f0-9]{12}$/.test(row.session)||!Number.isSafeInteger(row.playMs)||row.playMs<0||row.playMs>86400000||tag!==this.cloud.prefix+'activity_'+row.date+'_'+row.id+'_'+row.session)continue;
        players.add(row.id);totalPlayMs+=row.playMs;
        const daily=days.get(row.date)||{ids:new Set(),playMs:0};daily.ids.add(row.id);daily.playMs+=row.playMs;days.set(row.date,daily);
      }
      const daily=[];for(let n=0;n<30;n++){const key=date(this.now()-n*86400000),row=days.get(key);daily.push({date:key,players:row?.ids.size||0,playMs:row?.playMs||0});}
      return {players:players.size,totalPlayMs,today:daily[0],daily,updatedAt:this.now()};
    }
  };
});
