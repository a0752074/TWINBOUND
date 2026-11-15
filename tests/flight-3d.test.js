import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {Flight} from '../src/physics.js';import {Flight as BaselineFlight} from './fixtures/v101/physics.js';
import {LEVELS,buildCraft,G0} from '../src/config.js';import {configureMission} from '../src/mission.js';import {Navigation} from '../src/navigation.js';import {V,MS} from '../src/dynamics.js';
import {createPilot3D,objectDepth,segmentDistance3D,perspectivePoint,cockpitGuidance} from '../src/flight-3d.js';import {eph,getPlan,advance} from './helpers.js';
const plain=f=>{const r=f.snapshot();delete r.date;return r;};
const craft=()=>buildCraft({engine:2,hull:2,power:2});
function local(){const f=new Flight(LEVELS[0],craft(),77);f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;return f;}
test('protected v10.1 dynamics, navigation, renderers, art, audio, styles and NASA data remain byte-identical',()=>{const locks=JSON.parse(fs.readFileSync(new URL('./fixtures/v101/locks.json',import.meta.url)));for(const [name,hash]of Object.entries(locks).filter(([name])=>name!=='src/storage.js'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex'),hash,name);});
test('the default 2D game has exact v10.1 outcomes for identical seeds, equipment and input',()=>{
 for(const level of LEVELS)for(const seed of [12,77]){
  const a=new Flight(level,craft(),seed),b=new BaselineFlight(level,craft(),seed);
  for(let i=0;i<7200&&a.status==='playing';i++){const input={left:i%1100<70,right:i%1100>550&&i%1100<620,up:i%900>850,down:i%700<15};a.step(input,1/120);b.step(input,1/120);}
  assert.deepEqual(plain(a),plain(b),level.id+' '+seed);assert.deepEqual(a.objects,b.objects);assert.deepEqual(a.events,b.events);
 }
});
test('2D linked navigation and science preserve the complete baseline result on all four destinations',()=>{
 for(const level of LEVELS){const c=configureMission(craft(),{budget:'expanded',launcher:'dedicated'},level.id),plan=getPlan(level.id);const a=new Flight(level,c,12,new Navigation(level,plan,eph,c)),b=new BaselineFlight(level,c,12,new Navigation(level,plan,eph,c));for(let i=0;i<900;i++){const input={right:i<20,down:i>200&&i<300};a.step(input,1/30);b.step(input,1/30);}assert.deepEqual(plain(a),plain(b),level.id);}
});
test('3D uses the same single-engine fuel flow for normalized three-axis input',()=>{
 const a=local(),b=local();a.setFlightMode('3d');b.setFlightMode('3d');advance(a,1,{right:true,up:true,rise:true});advance(b,1,{up:true});
 assert.ok(Math.abs(a.fuelUsed-b.fuelUsed)<1e-9);assert.ok(Math.abs(a.fuelUsed-craft().engine.thrust/(craft().engine.isp*G0))<1e-9);assert.ok(a.pilot3D.z>0&&a.pilot3D.vz>0);
});
test('forward and reverse, and ascend and descend, cancel without free impulse',()=>{const f=local();f.setFlightMode('3d');advance(f,1,{up:true,reverse:true,rise:true,fall:true});assert.equal(f.fuelUsed,0);assert.equal(f.pilot3D.z,0);assert.equal(f.pilot3D.vz,0);});
test('coasting preserves local vertical momentum without fuel use',()=>{const f=local();f.setFlightMode('3d');advance(f,1,{rise:true});const used=f.fuelUsed,v=f.pilot3D.vz,z=f.pilot3D.z;advance(f,1,{coast:true});assert.equal(f.fuelUsed,used);assert.equal(f.pilot3D.vz,v);assert.ok(Math.abs(f.pilot3D.z-z-v)<1e-8);});
test('3D vertical thrust changes the real 3D trajectory and spends fuel',()=>{
 const c=configureMission(craft(),{},'moon'),plan=getPlan(),a=new Flight(LEVELS[0],c,12,new Navigation(LEVELS[0],plan,eph,c)),b=new Flight(LEVELS[0],c,12,new Navigation(LEVELS[0],plan,eph,c));
 for(const f of [a,b]){f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;}a.setFlightMode('3d');const normal=a.navigation.basis.normal.slice();advance(a,1,{rise:true});advance(b,1,{});
 assert.ok(V.dot(V.sub(a.navigation.state.slice(3),b.navigation.state.slice(3)),normal)*MS>10);assert.ok(a.fuelUsed>0);
 const before=a.navigation.state.slice(),fuel=a.fuel;a.setFlightMode('2d');assert.deepEqual(a.navigation.state,before);assert.equal(a.fuel,fuel);
});
test('3D swept collisions and pickups require actual spatial proximity',()=>{
 const f=local();f.setFlightMode('3d');f.add('rock',0,f.y+2,{radius:20,z:1000});f.add('energy',0,f.y+2,{radius:13,z:1000});f.step({},1/30);assert.equal(f.hits,0);assert.equal(f.collected,0);
 f.add('energy',f.x,f.y+2,{radius:13,z:f.pilot3D.z});f.step({},1/30);assert.equal(f.collected,1);
 f.add('rock',f.x,f.y+2,{radius:20,z:f.pilot3D.z});f.step({},1/30);assert.equal(f.hits,1);
 assert.equal(segmentDistance3D([-10,0,0],[10,0,0]),0);assert.equal(segmentDistance3D([-10,0,30],[10,0,30]),30);
});
test('cockpit bonus applies only to earned points while active and cannot be farmed by toggling',()=>{
 const f=local();f.points(100);const base=f.score;for(let i=0;i<50;i++){f.setFlightMode('3d');f.setFlightMode('2d');}assert.equal(f.totalScore,base);assert.equal(f.pilot3D.bonus,0);
 f.setFlightMode('3d');f.points(100);assert.equal(f.pilot3D.bonus,(f.score-base)*.25);const bonus=f.pilot3D.bonus;f.setFlightMode('2d');f.points(100);assert.equal(f.pilot3D.bonus,bonus);
 const r=f.snapshot();assert.equal(r.score,r.baseScore+r.threeDBonus);assert.equal(r.threeDBonusRaw,bonus);
});
test('depth allocation is deterministic and does not consume the obstacle random stream',()=>{const f=local(),before=f.rng.state,o={id:8,kind:'rock'};assert.equal(objectDepth(o,77),objectDepth(o,77));assert.equal(f.rng.state,before);assert.equal(objectDepth({id:1},77),0);assert.equal(objectDepth({id:9,z:123},77),123);});
test('perspective projection distinguishes vertical and forward depth with a near-plane guard',()=>{const c={x:0,y:0,z:0},a=perspectivePoint({x:10,y:100,z:10},c,1000,700),b=perspectivePoint({x:10,y:200,z:10},c,1000,700);assert.ok(a.x>b.x);assert.ok(a.y<b.y);assert.equal(perspectivePoint({x:0,y:0,z:0},c,1000,700),null);assert.equal(createPilot3D().bonus,0);});

test('3D guidance includes vertical corrections and preserves safe-route hints',()=>{const n={rawRisk:1,correction:[0,1,-10],basis:{normal:[0,0,1],right:[1,0,0],forward:[0,1,0]},guidance:'up'};assert.equal(cockpitGuidance(n),'fall');n.correction[2]=10;assert.equal(cockpitGuidance(n),'rise');n.rawRisk=.1;assert.equal(cockpitGuidance(n),'up');});

for(const level of LEVELS)test(`a complete controlled 3D mission reaches ${level.id} and preserves its base award`,()=>{
 const reference=JSON.parse(fs.readFileSync(new URL('../data/evidence/'+level.id+'/record.json',import.meta.url))),c=configureMission(craft(),reference.science.selection,level.id),plan=getPlan(level.id,'2026-11-14'),f=new Flight(level,c,12,new Navigation(level,plan,eph,c));
 f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;f.setFlightMode('3d');advance(f,1000);const r=f.snapshot();
 assert.equal(r.status,'arrived');assert.equal(r.science.complete,true);assert.equal(r.baseScore,reference.score);assert.ok(Math.abs(r.threeDBonusRaw-f.score*.25)<1e-6);assert.ok(r.score>reference.score);assert.ok(r.threeDSeconds>200);
});
