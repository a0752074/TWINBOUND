import test from 'node:test';import assert from 'node:assert/strict';
import {LEVELS,buildCraft,G0} from '../src/config.js';
import {V,AU,MS,propagate,localBasis} from '../src/dynamics.js';
import {predictFuture} from '../src/planning-v10.js';
import {Navigation,stabilityStep} from '../src/navigation.js';
import {eph,getPlan,linkedFlight,advance} from './helpers.js';

test('live 3D state starts at exactly the predicted injection state',()=>{const f=linkedFlight();assert.deepEqual(f.navigation.state,getPlan().initial);assert.equal(f.navigation.plan.launchDate,'2026-11-12');});
test('one real second of thrust changes physical 3D velocity and uses one second of propellant',()=>{
  const a=linkedFlight(),b=linkedFlight();advance(a,1,{right:true});advance(b,1,{});
  const used=a.craft.engine.thrust/(a.craft.engine.isp*G0);
  assert.ok(Math.abs(a.fuelUsed-used)<1e-7);assert.ok(V.norm(V.sub(a.navigation.state.slice(3),b.navigation.state.slice(3)))*MS>20);
  assert.ok(a.navigation.playerBurnSeconds>.99&&a.navigation.playerBurnSeconds<1.01);assert.ok(a.navigation.day-a.navigation.startDay>.01);
});
test('the same thrust changes the future real target encounter',()=>{
  const a=linkedFlight(),b=linkedFlight();advance(a,2,{right:true});advance(b,2);
  const qa=predictFuture(eph,'moon',a.navigation.day,a.navigation.state,5.2),qb=predictFuture(eph,'moon',b.navigation.day,b.navigation.state,5.2);
  assert.ok(Math.abs(qa.closest-qb.closest)>500);a.navigation.setForecast(qa);assert.equal(a.navigation.future.closest,qa.closest);
});
test('coasting is genuinely accelerated by moving celestial bodies',()=>{
  const f=linkedFlight(),r=f.navigation.state.slice(),v=r.slice(3);advance(f,3);
  assert.ok(V.norm(V.sub(f.navigation.state.slice(3),v))*MS>20);assert.equal(f.fuelUsed,0);assert.ok(V.norm(V.sub(f.navigation.state.slice(0,3),r.slice(0,3)))>0);
});
test('relative speed comes from 3D physical velocities, not sprite pixels',()=>{
  const f=linkedFlight();advance(f,1,{right:true});const n=f.navigation,actual=V.norm(V.sub(n.state.slice(3),n.reference().slice(3)))*MS;
  assert.ok(Math.abs(n.localSpeed-actual)<.02);const before=n.localSpeed;f.vx=99999;f.x+=100000;f.navigation.updateMetrics(f.fuel,.01);assert.ok(Math.abs(f.navigation.localSpeed-before)<.02);
});
test('small evasive maneuver does not suddenly drain navigation health',()=>{const f=linkedFlight();advance(f,2,{right:true});advance(f,12);assert.ok(f.stability>95);assert.equal(f.status,'playing');});
test('ordinary short evasive burns remain safe on long interplanetary missions',()=>{for(const id of ['mars','pluto']){const f=linkedFlight(id);advance(f,2,{right:true});advance(f,20);assert.ok(f.stability>95,id);assert.equal(f.status,'playing');}});
test('holding down explicitly suppresses even automatic corrective thrust',()=>{const f=linkedFlight();advance(f,1,{right:true});const used=f.fuelUsed;advance(f,10,{down:true});assert.equal(f.fuelUsed,used);});
test('continued wrong-way thrust drains navigation health and gives the physical opposite hint',()=>{
  const f=linkedFlight();advance(f,15,{right:true});assert.ok(f.stability<95);assert.equal(f.navigation.guidance,'left');advance(f,40,{right:true});assert.equal(f.status,'failed');assert.equal(f.reason,'Course deviation exceeds the mission limit');assert.ok(f.score>0);assert.equal(f.stability,0);
});
test('actual counter-thrust improves physical risk and gradually restores health',()=>{
  const f=linkedFlight();advance(f,12,{right:true});const riskBefore=f.navigation.rawRisk;advance(f,12,{left:true});const low=f.stability;advance(f,22);
  assert.ok(f.navigation.rawRisk<riskBefore*.5);assert.ok(f.stability>low+5);assert.ok(f.stability>95);
});
test('remaining corrective delta-v is included in physical risk',()=>{
  const f=linkedFlight();advance(f,10,{right:true});const n=f.navigation;n.updateMetrics(260,0);const high=n.rawRisk;n.updateMetrics(.01,0);assert.ok(n.rawRisk>high);
});
test('finite navigation assistance is charged fuel and cannot override full user thrust',()=>{
  const f=linkedFlight();advance(f,1,{right:true});advance(f,40);assert.ok(f.navigation.autoFuelUsed>0);assert.ok(f.fuelUsed>f.navigation.autoFuelUsed);
  const n=f.navigation;assert.equal(n.automaticBurn(f.fuel,1,1),null);assert.equal(n.automaticBurn(0,1,0),null);
});
test('navigation zero ends through the ordinary scored failure result state',()=>{
  const f=linkedFlight();f.score=1000;f.navigation.stability=0;f.navigation.rawRisk=10;f.step({},1/30);assert.equal(f.status,'failed');assert.equal(f.reason,'Course deviation exceeds the mission limit');assert.ok(f.snapshot().score>=1000);
});
test('displaying progress 100% cannot grant an unearned arrival',()=>{const f=linkedFlight();f.progress=1;f.navigation.progress=1;f.step({},1/30);assert.equal(f.status,'playing');assert.ok(f.navigation.targetDistance>f.level.near);});
test('risk health has recovery and smoothing, with no ten-second countdown',()=>{
  let h=100,r=0;for(let i=0;i<100;i++){const q=stabilityStep(h,r,3,.1);h=q.health;r=q.risk;}assert.ok(h>60&&h<100);const low=h;for(let i=0;i<300;i++){const q=stabilityStep(h,r,0,.1);h=q.health;r=q.risk;}assert.ok(h>low);assert.equal(h,100);
});
test('actual arrival is gated by a physical distance threshold',()=>{
  const f=linkedFlight();advance(f,400);assert.equal(f.status,'arrived');assert.ok(f.navigation.targetDistance<=f.level.near);assert.ok(f.time>240&&f.time<360);assert.equal(f.progress,1);
  const snapshot=f.snapshot(),score=f.score;advance(f,10);assert.equal(f.time,snapshot.time);assert.equal(f.score,score);
});
test('coast integration converges when max step is reduced',()=>{
  const p=getPlan(),a=propagate(eph,p.departure,p.initial,4,{moon:true,maxStep:.025}),b=propagate(eph,p.departure,p.initial,4,{moon:true,maxStep:.00625});
  const error=V.norm(V.sub(a.at(-1).y.slice(0,3),b.at(-1).y.slice(0,3)))*AU;assert.ok(error<.25,'position error km: '+error);
});
test('burn-and-coast solutions remain close at 30 Hz and 120 Hz',()=>{
  const a=linkedFlight(),b=linkedFlight();advance(a,1,{right:true},1/30);advance(b,1,{right:true},1/120);advance(a,30,{},1/30);advance(b,30,{},1/120);
  const error=V.norm(V.sub(a.navigation.state.slice(0,3),b.navigation.state.slice(0,3)))*AU;
  assert.ok(error<3,'coupled stepping error km: '+error);assert.ok(Math.abs(a.fuelUsed-b.fuelUsed)<.03);
});
test('stellar mode keeps sublight ideal clocks separate from local maneuver velocities',()=>{
  const f=linkedFlight('proxima');advance(f,2,{right:true});assert.ok(f.navigation.localSpeed<200);assert.ok(f.navigation.earthTime>f.navigation.shipTime);assert.ok(f.navigation.state.slice(3).every(Number.isFinite));
  const coast=linkedFlight('proxima');advance(coast,900);assert.equal(coast.status,'arrived');assert.ok(coast.time>600&&coast.time<900);
});
test('all planetary missions finish only at their real encounter, at distinct reasonable play times',()=>{
  for(const [id,lo,hi] of [['moon',240,360],['mars',360,540],['pluto',480,720]]){
    const f=linkedFlight(id),n=f.navigation;
    for(let i=0;i<12000&&n.status==='flying';i++)n.advance(.1,{dv:[0,0,0]},f.fuel);
    assert.equal(n.status,'arrived',id);assert.ok(n.elapsed>lo&&n.elapsed<hi,id+' '+n.elapsed);assert.ok(n.targetDistance<=f.level.near,id);assert.equal(n.progress,1);
  }
});
