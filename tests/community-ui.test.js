import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM,until} from './support/dom-harness.js';
import {FlightArchive,FlightService} from '../src/flight-service.js';
import {CommunityUI} from '../src/community-ui.js';
import {makeFlightRecord} from '../src/flight-record.js';
import {LEVELS,buildCraft} from '../src/config.js';
import {configureMission} from '../src/mission.js';
import {Flight} from '../src/physics.js';
import {Navigation} from '../src/navigation.js';
import {eph,getPlan} from './helpers.js';
function record(id,playerId,seconds){
 const level=LEVELS[0],craft=configureMission(buildCraft({}),{},level.id),plan=getPlan(),f=new Flight(level,craft,12,new Navigation(level,plan,eph,craft));
 for(let i=0;i<seconds*30;i++)f.step({},1/30);f.finish('aborted','Flight ended by player');
 return makeFlightRecord(f,{playerId,flightId:id,launch:plan.settings,plan,ephemeris:eph});
}
test('community UI shows both players, opens another player report, isolates history and guards flight-time switching',async t=>{
 const {doc,close}=await setupDOM();t.after(close);const el=id=>doc.getElementById(id),archive=new FlightArchive(),service=new FlightService(archive);let canSwitch=true;
 const ui=new CommunityUI({archive,service,onPlayer:()=>{},canSwitch:()=>canSwitch,legacyRecords:()=>[{level:'moon',date:'2026-11-14',score:999999,status:'failed'}]});
 const enter=id=>{el('playerInput').value=id;el('playerForm').dispatch('submit');};
 enter(' Alice ');await archive.put(record('a','alice',1));enter('bob');await archive.put(record('b','bob',2));enter('ALICE');
 ui.show();await until(()=>el('recordList').querySelectorAll('tr').length===3);assert.ok(el('recordList').textContent.includes('alice'));assert.ok(el('recordList').textContent.includes('bob'));assert.equal(el('boardPagination').hidden,true);
 el('recordList').querySelector('[data-flight-id="b"]').click();await until(()=>el('flightReportContent').textContent.includes('Flight Summary'));assert.ok(el('flightReportContent').textContent.includes('bob'));assert.ok(el('flightReportContent').textContent.includes('Trajectory Analysis'));el('flightReportDialog').close();
 el('myFlightsBtn').click();await until(()=>el('boardStatus').textContent==='1 flights saved on this device');assert.ok(el('recordList').textContent.includes('alice'));assert.ok(!el('recordList').textContent.includes('bob'));
 enter('bob');await ui.refresh();assert.ok(el('recordList').textContent.includes('bob'));assert.ok(!el('recordList').textContent.includes('alice'));
 el('legacyFlightsBtn').click();assert.ok(el('recordList').textContent.includes('999,999'));el('localBoardBtn').click();await until(()=>el('boardStatus').textContent.includes('2 players'));assert.ok(!el('recordList').textContent.includes('999,999'));
 canSwitch=false;ui.flightState(true);el('switchPlayerBtn').click();assert.equal(el('playerDialog').open,false);enter('charlie');assert.equal(ui.playerId,'bob');
 assert.ok(!/Playing offline|Pending sync|Shared records|Saved to shared|Server disconnected/i.test(el('recordsDialog').textContent));
});
