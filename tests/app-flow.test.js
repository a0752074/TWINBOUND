import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM,until} from './support/dom-harness.js';
const signIn=(doc,id)=>{doc.getElementById('playerInput').value=id;doc.getElementById('playerForm').dispatch('submit');};

test('welcome, mission configuration, both views, automatic save, reports and player isolation use the actual workers',async t=>{
 const {doc,close,tick}=await setupDOM();t.after(close);await import('../src/app.js');const el=id=>doc.getElementById(id);
 assert.equal(el('playerDialog').open,true);signIn(doc,'bad id');assert.equal(el('playerDialog').open,true);assert.ok(el('playerError').textContent);
 signIn(doc,' Bowei ');assert.equal(el('playerDialog').open,false);assert.equal(el('playerTag').textContent,'bowei');
 await until(()=>el('orbitBusy').hidden);assert.equal(el('startBtn').disabled,false);
 el('equipmentBtn').click();assert.equal(el('equipmentDialog').open,true);
 let objective=doc.querySelector('[data-mission="objective"]');objective.value='composition';objective.dispatch('change');
 assert.ok(el('missionDesign').textContent.includes('requires spectral composition'));
 let instrument=doc.querySelector('[data-mission="instrument"]');instrument.value='spectrometer';instrument.dispatch('change');
 assert.equal(el('missionDesign').querySelectorAll('.issue').length,0);
 await until(()=>el('tradeEstimate').textContent.includes('REFERENCE TRANSFER ESTIMATE'));
 el('saveEquipment').click();assert.equal(el('equipmentDialog').open,false);assert.ok(el('missionBrief').textContent.includes('composition'));
 el('sourcesBtn').click();await until(()=>el('sourcesContent').innerHTML.includes('NASA/JPL Horizons'));
 assert.ok(!el('sourcesContent').textContent.includes('Verification data'));el('sourcesDialog').close();
 el('viewBtn').click();assert.ok(el('viewBtn').textContent.includes('XZ'));el('viewBtn').click();
 el('startBtn').click();await until(()=>!el('flightScreen').hidden);assert.ok(el('scienceHud').textContent.includes('SCIENCE'));
 assert.equal(el('switchPlayerBtn').disabled,true);el('switchPlayerBtn').click();assert.equal(el('playerDialog').open,false);
 el('modeBtn').click();assert.equal(el('modeBtn').textContent,'3D COCKPIT');
 window.dispatchEvent({type:'keydown',key:'q',repeat:false});const now=performance.now();tick(now+100);tick(now+200);window.dispatchEvent({type:'keyup',key:'q'});
 window.dispatchEvent({type:'keydown',key:'v',repeat:false});assert.equal(el('modeBtn').textContent,'2D VIEW');
 el('pauseBtn').click();el('resumeBtn').click();assert.equal(el('pauseDialog').open,false);
 el('pauseBtn').click();el('quitBtn').click();assert.equal(el('resultScreen').hidden,false);assert.ok(el('resultScreen').textContent.includes('Science mission review'));
 await until(()=>Boolean(localStorage.getItem('twinbound-v103-flights')));
 const saved=Object.values(JSON.parse(localStorage.getItem('twinbound-v103-flights')))[0],r=saved.record;
 assert.equal(r.status,'aborted');assert.equal(r.release,'10.3.1');assert.equal(r.playerId,'bowei');assert.equal(r.science.complete,false);assert.ok(r.threeDSeconds>0);assert.ok(r.threeDBonus>0);assert.ok(r.localDepth.position<0);assert.ok(r.fuelUsed>0);assert.equal(r.arcadeScore,r.baseScore+r.threeDBonus);assert.equal(r.score,r.arcadeScore);assert.equal(r.totalScore,r.arcadeScore+r.missionBonus);
 assert.equal(doc.getElementById('reportExportBtn'),null);assert.equal(doc.getElementById('exportBtn'),null);
 el('recordsBtn').click();await until(()=>el('recordList').textContent.includes('Ended by player'));
 const reportButton=el('recordList').querySelector('[data-flight-id]');reportButton.click();await until(()=>el('flightReportContent').textContent.includes('Flight Summary'));
 assert.ok(el('flightReportContent').textContent.includes('Trajectory Analysis'));el('flightReportDialog').close();el('recordsDialog').close();
 el('returnBtn').click();el('switchPlayerBtn').click();signIn(doc,'bob');assert.equal(el('playerTag').textContent,'bob');
 el('recordsBtn').click();await until(()=>el('boardStatus').textContent.includes('flights saved on this device'));assert.ok(!el('recordList').textContent.includes('bowei'));el('recordsDialog').close();
 el('switchPlayerBtn').click();signIn(doc,'BOWEI');await until(()=>el('orbitBusy').hidden);assert.ok(el('missionBrief').textContent.includes('composition'));
 for(const id of ['moon','mars','pluto','proxima']){
  doc.querySelector(`[data-level="${id}"]`).click();await until(()=>el('orbitBusy').hidden);assert.equal(el('startBtn').disabled,false,id);
  el('startBtn').click();await until(()=>!el('flightScreen').hidden);el('modeBtn').click();assert.equal(el('modeBtn').textContent,'3D COCKPIT');el('modeBtn').click();el('pauseBtn').click();el('quitBtn').click();el('returnBtn').click();
 }
});
test('missing NASA reference metadata does not block a complete local save',async t=>{
 const {doc,close}=await setupDOM();t.after(close);const localFetch=globalThis.fetch;
 globalThis.fetch=async url=>String(url)==='data/nasa-resources.json'?new Response('',{status:404}):localFetch(url);
 await import('../src/app.js?reference-fault');const el=id=>doc.getElementById(id);signIn(doc,'offline-player');await until(()=>el('orbitBusy').hidden);
 el('startBtn').click();await until(()=>!el('flightScreen').hidden);el('pauseBtn').click();el('quitBtn').click();assert.equal(el('resultScreen').hidden,false);
 await until(()=>Boolean(localStorage.getItem('twinbound-v103-flights')));const saved=Object.values(JSON.parse(localStorage.getItem('twinbound-v103-flights')));assert.equal(saved[0].state,'saved');
});
