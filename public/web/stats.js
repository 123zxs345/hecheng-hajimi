(function(){
  'use strict';
  const $=id=>document.getElementById(id),cloud=new window.HajimiTinyWebDB(window.HajimiHosting?.tinywebdb),analytics=new window.HajimiAnalytics({cloud});
  const duration=ms=>{const seconds=Math.floor(ms/1000);return seconds>=3600?`${(seconds/3600).toFixed(1)} 小时`:seconds>=60?`${(seconds/60).toFixed(1)} 分钟`:`${seconds} 秒`;};
  async function refresh(){
    $('stats-refresh').disabled=true;$('stats-status').textContent='正在读取云端记录…';
    try{
      const data=await analytics.summary();$('stat-players').textContent=data.players.toLocaleString();$('stat-active').textContent=data.today.players.toLocaleString();$('stat-time').textContent=duration(data.totalPlayMs);$('stat-today-time').textContent=duration(data.today.playMs);
      const rows=data.daily.map(day=>{const tr=document.createElement('tr');for(const text of [day.date.slice(0,4)+'-'+day.date.slice(4,6)+'-'+day.date.slice(6),day.players.toLocaleString(),duration(day.playMs)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;});$('stats-days').replaceChildren(...rows);
      $('stats-status').textContent='更新于 '+new Date(data.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
    }catch(error){$('stats-status').textContent='统计暂时连不上，请稍后刷新。';}finally{$('stats-refresh').disabled=false;}
  }
  $('stats-refresh').onclick=refresh;refresh();
})();
