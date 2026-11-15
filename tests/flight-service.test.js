import test from 'node:test';import assert from 'node:assert/strict';
import {FlightArchive,FlightService,normalizePlayerId} from '../src/flight-service.js';
import {readSave,readPlayerSave,writePlayerSave} from '../src/storage.js';
function storage(){const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};return map;}
const record=(flightId,playerId='alice')=>({flightId,playerId,date:'2026-11-14T10:00:00Z',scoreVersion:'10.3.0-1',totalScore:123});
test('Player IDs normalize consistently and reject invalid values',()=>{assert.equal(normalizePlayerId(' BOWEI '),'bowei');for(const s of ['x','has spaces','<img>','a'.repeat(21),'_start'])assert.throws(()=>normalizePlayerId(s));});
test('saved flights survive an archive restart and duplicate IDs keep the original report',async()=>{
 storage();const a=new FlightArchive();await a.put(record('test-1'));
 const restart=new FlightArchive();assert.equal((await restart.get('test-1')).state,'saved');
 await restart.put({...record('test-1'),totalScore:999});
 assert.equal((await restart.get('test-1')).record.totalScore,123);
});
test('old archive states preserve reports without requiring a service',async()=>{
 storage();const a=new FlightArchive();await a.put(record('a','alice'));await a.put(record('b','bob'));
 await a.mark('a','pending');await a.mark('b','synced');
 const svc=new FlightService(a);assert.equal((await svc.flight('a')).totalScore,123);
 assert.equal((await svc.history('alice')).rows.length,1);assert.equal((await svc.history('bob')).rows.length,1);
 await assert.rejects(()=>svc.flight('missing'),/not saved/);
});
test('first player adopts old settings and photos while later players have separate profiles',()=>{
 const map=storage();const legacy={version:10,kit:{engine:0,hull:2,power:1},photos:['PIA00407'],completed:['mars'],records:[{level:'moon',score:12,time:5,status:'failed'}]};
 map.set('twinbound-v10-little-expedition',JSON.stringify(legacy));const before=map.get('twinbound-v10-little-expedition'),alice=readPlayerSave('alice');assert.deepEqual(alice.photos,['PIA00407']);assert.equal(alice.legacyRecords.length,1);writePlayerSave('alice',alice);
 const bob=readPlayerSave('bob');assert.equal(bob.photos.length,0);assert.equal(bob.records.length,0);bob.kit.engine=2;writePlayerSave('bob',bob);
 assert.equal(readPlayerSave('alice').kit.engine,0);assert.equal(readPlayerSave('bob').kit.engine,2);assert.equal(map.get('twinbound-v10-little-expedition'),before);
});
