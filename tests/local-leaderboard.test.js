import test from 'node:test';
import assert from 'node:assert/strict';
import {FlightArchive,FlightService,compareFlights} from '../src/flight-service.js';
import {SCORE_VERSION} from '../src/mission-score.js';
const make=(flightId,playerId='alice',totalScore=100,level='moon',extra={})=>({flightId,playerId,totalScore,level,arcadeScore:totalScore-10,missionBonus:10,scoreVersion:SCORE_VERSION,date:'2026-11-15T10:00:00.000Z',missionGrade:'Partial',status:'aborted',science:{generatedMB:2},navigation:{history:[{day:12}]},...extra});
function setup(){const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};const archive=new FlightArchive();return {archive,service:new FlightService(archive),map};}

test('A and B share a local board; lower and higher retries preserve all reports',async()=>{
 const {archive,service}=setup();
 await archive.put(make('a1'));await archive.put(make('b1','bob',150));
 assert.deepEqual((await service.leaderboard('moon','alice')).rows.map(r=>r.playerId),['bob','alice']);
 await archive.put(make('a-low','alice',50));assert.equal((await service.leaderboard('moon','alice')).ownBest.flightId,'a1');
 await archive.put(make('a-high','alice',200));const board=await service.leaderboard('moon','alice');
 assert.equal(board.ownBest.flightId,'a-high');assert.equal(board.ownBest.rank,1);
 assert.equal((await archive.all()).length,4);assert.equal((await service.history('alice')).total,3);assert.equal((await service.history('bob')).total,1);
 assert.deepEqual(await service.flight('b1'),make('b1','bob',150));
});
test('four destinations rank independently and a new archive instance reuses the saved data',async()=>{
 const {archive}=setup();for(const l of ['moon','mars','pluto','proxima'])await archive.put(make(l,'alice',100,l));
 const service=new FlightService(new FlightArchive());for(const l of ['moon','mars','pluto','proxima']){const r=await service.leaderboard(l,'alice');assert.equal(r.rows.length,1);assert.equal(r.rows[0].level,l);}
 assert.equal((await service.history('alice')).total,4);
});
test('top 50 uses one best per normalized ID; all lower scores and personal history remain',async()=>{
 const {archive,service}=setup();for(let i=0;i<60;i++)await archive.put(make('f'+i,'player'+i,1000-i));
 await archive.put(make('other-case','PLAYER0',1200));await archive.put(make('lower','player0',20));
 const r=await service.leaderboard('moon','player59');assert.equal(r.total,60);assert.equal(r.rows.length,50);assert.equal(r.rows[0].playerId,'player0');assert.equal(r.ownBest.rank,60);
 assert.equal((await archive.all()).length,62);
});
test('same-score ordering is bonus descending, flight date ascending, then Flight ID ascending',async()=>{
 const {archive,service}=setup();
 const records=[make('z','bob',100,'moon',{missionBonus:30}),make('a','alice',100,'moon',{missionBonus:30}),make('b','earlier',100,'moon',{missionBonus:30,date:'2026-11-14T10:00:00.000Z'}),make('c','less-bonus',100,'moon',{missionBonus:10})];
 for(const r of records)await archive.put(r);
 const expected=['b','a','z','c'];for(let i=0;i<4;i++)assert.deepEqual((await service.leaderboard('moon','alice')).rows.map(r=>r.flightId),expected);
 assert.equal(compareFlights(records[0],records[0]),0);
});
test('legacy and other score versions never enter Final Score rankings; old saved states do',async()=>{
 const {archive,service}=setup();await archive.put(make('normal'));await archive.mark('normal','pending');
 await archive.put(make('legacy','legacy',99999,'moon',{scoreVersion:undefined}));
 await archive.put(make('other-version','other',99999,'moon',{scoreVersion:'future'}));
 await archive.put(make('missing-score','invalid',NaN));
 const board=await service.leaderboard('moon','alice');assert.deepEqual(board.rows.map(r=>r.flightId),['normal']);assert.equal((await archive.all()).length,4);
});
test('history paginates all records without truncating the archive',async()=>{
 const {archive,service}=setup();for(let i=0;i<75;i++)await archive.put(make('f'+i));
 const page1=await service.history('alice'),page2=await service.history('alice',50);
 assert.equal(page1.total,75);assert.equal(page1.rows.length,50);assert.equal(page2.rows.length,25);assert.equal(new Set([...page1.rows,...page2.rows].map(r=>r.flightId)).size,75);
});
test('all local operations work with networking disabled',async t=>{
 const before=globalThis.fetch;t.after(()=>{globalThis.fetch=before;});let calls=0;globalThis.fetch=()=>{calls++;throw Error('No API exists');};
 const {archive,service}=setup();await archive.put(make('one'));await service.leaderboard('moon','alice');await service.history('alice');await service.flight('one');assert.equal(calls,0);
});
test('a separate browser storage area has no records from the first',async()=>{
 const first=setup();await first.archive.put(make('private'));const second=setup();assert.equal((await second.archive.all()).length,0);
 globalThis.localStorage={getItem:k=>first.map.get(k)??null,setItem:(k,v)=>first.map.set(k,v)};assert.equal((await new FlightArchive().all()).length,1);
});
test('storage failure is reported while keeping the report available in the live archive',async()=>{
 const {archive}=setup();globalThis.localStorage.setItem=()=>{throw Error('quota');};
 await assert.rejects(()=>archive.put(make('quota')),/storage is full/);assert.equal((await archive.get('quota')).record.flightId,'quota');
});
