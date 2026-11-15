import test from 'node:test';
import assert from 'node:assert/strict';
import {Flight} from '../src/physics.js';
import {Flight as OldFlight} from './fixtures/v102/physics.js';
import {LEVELS,buildCraft} from '../src/config.js';
import {objectDepth,cockpitContact} from '../src/flight-3d.js';
import {CockpitRenderer} from '../src/cockpit.js';
const craft=()=>buildCraft({engine:2,hull:2,power:2});
for(const altitude of [-50000,50000])test(`3D director continues the encounter field at altitude ${altitude}`,()=>{
  const old=new OldFlight(LEVELS[1],craft(),77),f=new Flight(LEVELS[1],craft(),77);
  for(const q of [old,f]){q.setFlightMode('3d');q.pilot3D.z=altitude;q.pilot3D.vz=35;q.time=30;q.nextSpawn=q.nextSupply=q.nextComet=q.nextHole=0;q.director(1/30);}
  const newObjects=f.objects.filter(o=>o.id>1),camera={x:f.x,y:f.y,z:altitude};
  assert.ok(newObjects.some(o=>o.kind==='rock'));assert.ok(newObjects.some(o=>o.kind==='hole'));assert.ok(newObjects.some(o=>o.kind==='comet'));
  assert.ok(old.objects.filter(o=>o.id>1).every(o=>Math.abs(objectDepth(o,77)-altitude)>49000),'reproduces the original fixed-plane failure');
  for(const o of newObjects){assert.ok(Math.abs(o.z-altitude)<500);const contact=cockpitContact(o,77,camera,1200,760);assert.ok(contact.visible||contact.cue);}
  const frozen=newObjects.map(o=>o.z);f.pilot3D.z+=1000;assert.deepEqual(newObjects.map(o=>o.z),frozen,'existing objects stay fixed');
  assert.equal(f.rng.state,old.rng.state,'no added random draws');
});
test('switching views preserves assigned objects, state, momentum, resources, and score',()=>{
 const f=new Flight(LEVELS[0],craft(),99);f.setFlightMode('3d');f.pilot3D.z=25000;const o=f.add('fuel',0,900);const before={id:o.id,z:o.z,x:o.x,y:o.y,fuel:f.fuel,score:f.totalScore};
 for(let i=0;i<50;i++){f.setFlightMode('2d');f.setFlightMode('3d');}
 assert.deepEqual({id:o.id,z:o.z,x:o.x,y:o.y,fuel:f.fuel,score:f.totalScore},before);
 const later=f.setFlightMode('2d');const born2d=f.add('rock',0,1200);assert.equal(born2d.z,undefined);f.setFlightMode('3d');assert.ok(Math.abs(born2d.z-25000)<200);
});
test('offscreen, close, and vertical contacts retain finite perspective cues',()=>{
 const camera={x:0,y:0,z:20000};for(const [x,y,z] of [[0,1000,20000],[5000,100,20000],[0,100,30000],[0,100,10000],[0,2,20000]]){
  const q=cockpitContact({id:3,kind:'rock',radius:30,x,y,z},12,camera,390,680);assert.ok(q.visible||q.cue);if(q.cue)assert.ok(Number.isFinite(q.cue.x)&&Number.isFinite(q.cue.y));
 }
 const behind=cockpitContact({id:9,kind:'rock',radius:20,x:0,y:-1000,z:0},12,camera,390,680);assert.equal(behind.cue,null);
});
test('actual cockpit renderer draws the same encounter list at extreme altitude and mobile size',()=>{
 const f=new Flight(LEVELS[0],craft(),12);f.setFlightMode('3d');f.pilot3D.z=-50000;f.time=30;f.nextSpawn=f.nextSupply=f.nextComet=0;f.director(1/30);
 const renderer=new CockpitRenderer({},12),methods={createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})};
 const ctx=new Proxy(methods,{get:(o,k)=>o[k]||((...a)=>{for(const x of a)if(typeof x==='number')assert.ok(Number.isFinite(x));}),set:(o,k,v)=>(o[k]=v,true)});
 for(const [w,h] of [[390,680],[1440,900]])renderer.drawScene(ctx,w,h,f,.016);
});
