import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
function modules(){
  assert.ok(existsSync(new URL('public/web/tinywebdb.js',root)),'TinyWebDB transport is missing');
  assert.ok(existsSync(new URL('public/web/pages-service.js',root)),'Pages service is missing');
  return {TinyWebDB:require('../public/web/tinywebdb.js'),PagesService:require('../public/web/pages-service.js')};
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value))};}
async function fixture(t){
  const records=new Map(),requests=[];
  const server=createServer(async(req,res)=>{
    res.setHeader('access-control-allow-origin','*');res.setHeader('content-type','application/json');
    let body='';for await(const chunk of req)body+=chunk;
    const form=new URLSearchParams(body);requests.push(Object.fromEntries(form));
    if(form.get('user')!=='test-game'||form.get('secret')!=='public-test-key'){res.writeHead(403);res.end(JSON.stringify({error:'wrong account'}));return;}
    if(form.get('action')==='update'){records.set(form.get('tag'),form.get('value'));res.end();return;}
    if(form.get('action')==='search'){
      const entries=[...records].reverse().filter(([tag])=>tag.startsWith(form.get('tag')));
      const start=Math.max(0,Number(form.get('no'))-1);res.end(JSON.stringify(Object.fromEntries(entries.slice(start,start+Number(form.get('count'))))));return;
    }
    res.writeHead(400);res.end(JSON.stringify({error:'unsupported action'}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const {TinyWebDB}=modules();
  const cloud=new TinyWebDB({endpoint:'http://127.0.0.1:'+server.address().port+'/api',user:'test-game',secret:'public-test-key',prefix:'test_hajimi_'});
  return {cloud,records,requests};
}

test('Pages export preserves repository paths, real QR and absolute sharing metadata',async()=>{
  const build=new URL('scripts/build.mjs',root);assert.ok(existsSync(build),'GitHub Pages exporter is missing');
  const {exportPages}=await import(build);const output=await mkdtemp(join(tmpdir(),'hajimi-pages-'));
  try{
    await exportPages({outDir:output,siteUrl:'https://example.github.io/hecheng-hajimi/'});
    const html=await readFile(join(output,'index.html'),'utf8');
    assert.match(html,/https:\/\/example.github.io\/hecheng-hajimi\/share-cover.jpg/);
    assert.doesNotMatch(html,/(?:src|href)="\/(?!\/)|__ORIGIN__|chatgpt\.site/);
    assert.match(html,/\.\/web\/pages-service.js/);assert.ok(existsSync(join(output,'.nojekyll')));
    assert.deepEqual(await readFile(join(output,'support/wechat-pay.jpg')),await readFile(new URL('public/support/wechat-pay.jpg',root)));
    const js=await readFile(join(output,'web/site.js'),'utf8');assert.doesNotMatch(js,/fetch\('\/api\//);
    assert.match(js,/new URL\('\.\/'/);assert.doesNotMatch(js,/prefix:'\/minigame|assetPrefix:'\/minigame/);
    const config=await readFile(join(output,'hosting-config.js'),'utf8');assert.doesNotMatch(config,/SUPPORT_ADMIN_TOKEN|test-game|public-test-key/);
  }finally{await rm(output,{recursive:true,force:true});}
});

test('TinyWebDB accepts its documented empty update acknowledgement',async t=>{
  const {cloud}=await fixture(t);const tag='test_hajimi_player_'+id(1);
  await cloud.write(tag,{id:id(1),nickname:'猫友',best:3});
  const rows=await cloud.all('test_hajimi_player_');assert.equal(rows.length,1);assert.equal(rows[0].value.best,3);
});

test('history-wide top 20 includes older scores past the first cloud page',async t=>{
  const {cloud,records,requests}=await fixture(t);const {PagesService}=modules();
  for(let n=1;n<=130;n++)records.set('test_hajimi_player_'+id(n),JSON.stringify({id:id(n),nickname:'猫友'+n,best:1000-n,updatedAt:n}));
  records.set('test_hajimi_player_bad','not json');
  const service=new PagesService({storage:storage(),cloud,uuid:()=>id(999)});
  const {rows}=await service.request('ranking');assert.equal(rows.length,20);assert.equal(rows[0].nickname,'猫友1');assert.equal(rows[19].score,980);
  assert.ok(requests.some(r=>r.no==='101'));assert.ok(requests.every(r=>r.tag.startsWith('test_hajimi_')));
});

test('support gift persists and is granted once per Beijing day without a transaction number',async()=>{
  const {PagesService}=modules();const saved=storage();let now=Date.parse('2026-10-11T15:59:59Z');
  const options={storage:saved,now:()=>now,uuid:()=>id(1)};
  const a=new PagesService(options);assert.equal((await a.request('session',{})).player.coins,1);
  assert.equal((await a.request('support',{})).player.coins,2);
  const b=new PagesService(options);const repeat=await b.request('support',{});assert.equal(repeat.player.coins,2);assert.equal(repeat.alreadyClaimed,true);
  now+=2000;assert.equal((await b.request('support',{})).player.coins,3);
});

test('revive spending is idempotent and cannot exceed one use in a run',async()=>{
  const {PagesService}=modules();let next=1;const service=new PagesService({storage:storage(),uuid:()=>id(next++)});
  await service.request('session',{});const run=await service.request('runs',{});
  assert.equal((await service.request('spend',{runId:run.id,requestId:'first'})).coins,0);
  assert.equal((await service.request('spend',{runId:run.id,requestId:'first'})).coins,0);
  await assert.rejects(()=>service.request('spend',{runId:run.id,requestId:'second'}),/已经复活/);
  const nextRun=await service.request('runs',{});await assert.rejects(()=>service.request('spend',{runId:nextRun.id,requestId:'third'}),/不足/);
});

test('invites qualify after a real positive score; opening and self invites give no coin',async t=>{
  const {cloud,records}=await fixture(t);const {PagesService}=modules();let next=1;const inviterStorage=storage();
  const inviter=new PagesService({storage:inviterStorage,cloud,uuid:()=>id(next++)});
  const inviterId=(await inviter.request('session',{})).player.id;
  const invitee=new PagesService({storage:storage(),cloud,uuid:()=>id(next++)});
  await invitee.request('session',{ref:inviterId});assert.equal((await inviter.request('session')).player.coins,1);
  const run=await invitee.request('runs',{});await invitee.request('score',{runId:run.id,score:3,drops:2});
  assert.equal((await inviter.request('session')).player.coins,2);
  assert.equal((await new PagesService({storage:inviterStorage,cloud}).request('session')).player.coins,2);
  const self=new PagesService({storage:storage(),cloud,uuid:()=>id(20)});await self.request('session',{ref:id(20)});
  const selfRun=await self.request('runs',{});await self.request('score',{runId:selfRun.id,score:3,drops:2});
  assert.equal([...records.keys()].filter(k=>k.startsWith('test_hajimi_invite_')).length,1);
});

test('at most five qualified invitations credit each Beijing day, including retries',async t=>{
  const {cloud,records}=await fixture(t);const {PagesService}=modules();const now=Date.parse('2026-10-11T04:00:00Z');
  const service=new PagesService({storage:storage(),cloud,now:()=>now,uuid:()=>id(1)});
  await service.request('session',{});
  for(let n=2;n<=9;n++)records.set('test_hajimi_invite_'+id(1)+'_'+id(n),JSON.stringify({inviter:id(1),invitee:id(n),createdAt:now+n}));
  records.set('test_hajimi_invite_'+id(1)+'_self',JSON.stringify({inviter:id(1),invitee:id(1),createdAt:now}));
  assert.equal((await service.request('session')).player.coins,6);assert.equal((await service.request('session')).player.coins,6);
  records.set('test_hajimi_invite_'+id(1)+'_'+id(10),JSON.stringify({inviter:id(1),invitee:id(10),createdAt:now-86400000}));
  assert.equal((await service.request('session')).player.coins,7);
});

test('an unavailable cloud leaves the local wallet, support gift and best score usable',async()=>{
  const {PagesService}=modules();const cloud={configured:true,prefix:'outage_',async all(){throw new Error('offline');},async write(){throw new Error('offline');}};
  let next=1;const service=new PagesService({storage:storage(),cloud,uuid:()=>id(next++)});
  assert.equal((await service.request('session',{})).player.coins,1);
  const run=await service.request('runs',{});await assert.rejects(()=>service.request('score',{runId:run.id,score:3,drops:2}),/offline/);
  assert.equal((await service.request('session')).player.best,3);assert.equal((await service.request('support',{})).player.coins,2);
  await assert.rejects(()=>service.request('ranking'),/offline/);
});

test('a failed invitation write is retried after the score was already uploaded',async t=>{
  const {cloud,records}=await fixture(t);const {PagesService}=modules();
  const original=cloud.write.bind(cloud);let failed=false;
  cloud.write=async(tag,value)=>{if(tag.includes('invite_')&&!failed){failed=true;throw new Error('temporary invitation outage');}return original(tag,value);};
  let next=2;const service=new PagesService({storage:storage(),cloud,uuid:()=>id(next++)});
  await service.request('session',{ref:id(1)});const run=await service.request('runs',{});
  await assert.rejects(()=>service.request('score',{runId:run.id,score:3,drops:2}),/temporary/);
  await service.request('session');
  assert.equal([...records.keys()].filter(k=>k.includes('invite_')).length,1);
});
