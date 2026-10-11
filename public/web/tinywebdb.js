(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HajimiTinyWebDB=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return class TinyWebDB {
    constructor(options={}){
      this.endpoint=options.endpoint||'https://tinywebdb.appinventor.space/api';
      this.user=options.user||'';this.secret=options.secret||'';this.prefix=options.prefix||'hajimi_v1_';
      this.fetch=options.fetch||globalThis.fetch.bind(globalThis);this.configured=!!this.user&&!!this.secret;
    }
    async call(fields){
      if(!this.configured)throw new Error('排行榜暂未连接，请稍后再来');
      const response=await this.fetch(this.endpoint,{method:'POST',body:new URLSearchParams({user:this.user,secret:this.secret,...fields}),signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('排行榜暂时连不上，请稍后重试');
      const result=await response.json();
      if(result&&typeof result==='object'&&(result.error||result.status==='error'))throw new Error('排行榜连接配置需要更新');
      return result;
    }
    async write(tag,value){
      if(!tag.startsWith(this.prefix))throw new Error('数据记录不正确');
      await this.call({action:'update',tag,value:JSON.stringify(value)});
    }
    async all(tag){
      if(!tag.startsWith(this.prefix))throw new Error('数据记录不正确');
      const seen=new Map();
      for(let offset=1;offset<=10001;offset+=100){
        const result=await this.call({action:'search',no:String(offset),count:'100',tag,type:'both'});
        if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('榜单返回格式不正确');
        const entries=Object.entries(result).filter(([key])=>key.startsWith(tag));
        for(const [key,value]of entries){try{const decoded=typeof value==='string'?JSON.parse(value):value;if(decoded&&typeof decoded==='object'&&!Array.isArray(decoded))seen.set(key,decoded);}catch{}}
        if(entries.length<100)return [...seen].map(([tag,value])=>({tag,value}));
      }
      throw new Error('榜单记录过多，请稍后再试');
    }
  };
});
