import test from 'node:test';import assert from 'node:assert/strict';
import {Flight} from '../src/physics.js';import {Flight as Baseline} from './fixtures/v102/physics.js';
import {LEVELS,buildCraft} from '../src/config.js';
import {objectDepth} from '../src/flight-3d.js';
const snapshot=f=>{const r=f.snapshot();delete r.date;return r;};
test('v10.2 identical seeds, all equipment tiers and 2D input produce exact arcade and encounter results',()=>{
 for(const l of LEVELS)for(const seed of [12,77])for(const tier of [0,1,2]){
  const c=buildCraft({engine:tier,hull:tier,power:tier}),a=new Flight(l,c,seed),b=new Baseline(l,c,seed);
  for(let i=0;i<3600&&a.status==='playing';i++){const input={left:i%900<30,right:i%900>450&&i%900<480,up:i%1200>1180};a.step(input,1/120);b.step(input,1/120);}
  assert.deepEqual(snapshot(a),snapshot(b));assert.deepEqual(a.objects,b.objects);
 }
});
test('3D at the original lane height preserves v10.2 awards and encounters',()=>{
 const c=buildCraft({engine:2,hull:2,power:2}),a=new Flight(LEVELS[0],c,77),b=new Baseline(LEVELS[0],c,77);a.setFlightMode('3d');b.setFlightMode('3d');
 for(let i=0;i<3600;i++){a.step({},1/120);b.step({},1/120);}
 assert.deepEqual(snapshot(a),snapshot(b));
 const normalized=f=>f.objects.map(o=>({...o,z:objectDepth(o,f.seed)}));assert.deepEqual(normalized(a),normalized(b));
});
test('energy pickups do not erase the measured minimum battery reserve',()=>{
 const f=new Flight(LEVELS[0],buildCraft({engine:2,hull:2,power:2}),12);f.energy=5;f.objects=[];f.add('energy',0,2,{radius:13});f.step({},1/30);assert.equal(f.collected,1);assert.ok(f.energy>40);assert.ok(f.minEnergy<5);
});
