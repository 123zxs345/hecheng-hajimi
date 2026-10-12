import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
  const values=new Map(),records=new Map();let now=Date.parse('2026-10-11T15:59:40Z'),next=1;
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const cloud={prefix:'metrics_',configured:true,async write(tag,value){records.set(tag,structuredClone(value));},async all(prefix){return [...records].filter(([tag])=>tag.startsWith(prefix)).map(([tag,value])=>({tag,value}));}};
  return {storage,cloud,records,now:()=>now,advance:ms=>{now+=ms;},uuid:()=>id(next++)};
}
function create(f,player=id(9)){
  const Analytics=require('../public/web/analytics.js');
  return new Analytics({storage:f.storage,cloud:f.cloud,id:player,now:f.now,uuid:f.uuid});
}
function play(f,tracker,seconds){for(let n=0;n<seconds;n++){f.advance(1000);tracker.sample(true);}}

test('opening alone is not a player; reloads deduplicate people and retain every session duration',async()=>{
  const f=fixture(),a=create(f);await a.flush();assert.equal(f.records.size,0);
  a.start();play(f,a,5);await a.flush();await a.flush();
  const b=create(f);b.start();play(f,b,7);await b.flush();
  const summary=await b.summary();assert.equal(summary.players,1);assert.equal(summary.daily[0].players,1);assert.equal(summary.totalPlayMs,12000);
  assert.ok([...f.records.keys()].every(tag=>tag.length<=100));
});

test('Beijing midnight splits play time and counts the same person once per day',async()=>{
  const f=fixture(),a=create(f);a.start();play(f,a,30);await a.flush();
  const summary=await a.summary();assert.equal(summary.players,1);assert.equal(summary.daily[0].date,'20261012');assert.equal(summary.daily[0].playMs,10000);
  assert.equal(summary.daily[1].date,'20261011');assert.equal(summary.daily[1].playMs,20000);assert.equal(summary.daily[1].players,1);
});

test('pauses, background gaps and idle time do not inflate the play duration',async()=>{
  const f=fixture(),a=create(f);a.start();play(f,a,5);
  for(let n=0;n<10;n++){f.advance(1000);a.sample(false);}
  f.advance(3600000);a.sample(true);play(f,a,70);
  a.interact();play(f,a,3);await a.flush();assert.equal((await a.summary()).totalPlayMs,8000);
});

test('failed uploads stay in the outbox; retry and reload never double count',async()=>{
  const f=fixture(),a=create(f);a.start();play(f,a,9);const write=f.cloud.write;f.cloud.write=async()=>{throw Error('offline');};
  await assert.rejects(()=>a.flush(),/offline/);f.cloud.write=write;
  const b=create(f);await b.flush();await b.flush();assert.equal((await b.summary()).totalPlayMs,9000);assert.equal((await b.summary()).players,1);
});

test('a heartbeat sends one snapshot and keeps newer play time queued for the next heartbeat',async()=>{
  const f=fixture(),a=create(f);a.start();play(f,a,5);const write=f.cloud.write;let activities=0;
  f.cloud.write=async(tag,value)=>{if(tag.includes('activity_')){activities++;if(activities>1)throw Error('unbounded heartbeat');await write(tag,value);play(f,a,1);}else await write(tag,value);};
  await a.flush();assert.equal(activities,1);assert.equal((await a.summary()).totalPlayMs,5000);
  f.cloud.write=write;await a.flush();assert.equal((await a.summary()).totalPlayMs,6000);
});
