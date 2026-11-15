import test from 'node:test';
import assert from 'node:assert/strict';
import {Flight,Random,segmentDistance} from '../src/physics.js';
import {LEVELS,buildCraft,G0,DURATION} from '../src/config.js';
import {emptySave,recordFlight} from '../src/storage.js';
const level=LEVELS[0],kit={engine:1,hull:1,power:1};
function flight(k=kit){const f=new Flight(level,buildCraft(k),12345);f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=Infinity;return f;}
function advance(f,seconds,input={}){for(let t=0;t<seconds-1e-8;t+=1/120)f.step(input,Math.min(1/120,seconds-t));return f;}
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} should be close to ${b}`);

test('coasting preserves velocity and spends no fuel',()=>{
  const f=flight();f.vx=42;const fuel=f.fuel;advance(f,3);
  close(f.vx,42);close(f.vy,level.speed);close(f.x,126);close(f.y,level.speed*3);close(f.fuel,fuel);
});
test('down cuts all thrust without erasing momentum',()=>{
  const f=flight();f.vx=-31;advance(f,2,{left:true,up:true,down:true});
  close(f.vx,-31);close(f.vy,level.speed);close(f.fuel,f.craft.maxFuel);close(f.thrustX,0);close(f.thrustY,0);
});
test('thrust conserves the fuel/mass/impulse relation',()=>{
  const f=flight(),c=f.craft,m0=c.dryMass+f.fuel;advance(f,2,{right:true});
  const used=c.engine.thrust/(c.engine.isp*G0)*2;
  close(f.fuel,c.maxFuel-used,1e-7);assert.ok(f.x>0);
  const exact=c.engine.isp*G0*Math.log(m0/(m0-used));close(f.vx,exact,.00001);close(f.vy,level.speed);
});
test('diagonal input does not double fuel use or total impulse',()=>{
  const straight=advance(flight(),2,{right:true}),diagonal=advance(flight(),2,{right:true,up:true});
  close(straight.fuel,diagonal.fuel);close(straight.vx,Math.hypot(diagonal.vx,diagonal.vy-level.speed),.001);
});
test('opposite lateral inputs cancel thrust',()=>{const f=advance(flight(),1,{left:true,right:true});close(f.fuel,f.craft.maxFuel);close(f.vx,0);});
test('empty tank coasts and cannot generate free thrust',()=>{
  const f=flight();f.fuel=0;f.vx=9;advance(f,1,{right:true,up:true});close(f.vx,9);close(f.vy,level.speed);assert.equal(f.status,'playing');
});
test('partial final fuel burn scales actual thrust',()=>{
  const f=flight();f.fuel=.0001;f.step({right:true},1/120);assert.equal(f.fuel,0);assert.ok(f.vx>0&&f.vx<.002);
});
test('battery uses watt-hours, without free generation',()=>{
  const f=flight({engine:1,hull:2,power:0});advance(f,10);close(f.energy,100-1800*10/3600,1e-7);
});
test('higher Isp consumes less propellant for the configured thrust',()=>{
  const low=advance(flight({engine:0,hull:1,power:1}),4,{up:true}),high=advance(flight({engine:2,hull:1,power:1}),4,{up:true});
  assert.ok(low.fuelUsed>high.fuelUsed*1.9);
});
test('basic hull fails on the first direct collision',()=>{
  const f=flight({engine:1,hull:0,power:1});f.add('rock',0,1,{radius:20});f.step({},1/120);
  assert.equal(f.status,'failed');assert.equal(f.health,0);assert.equal(f.hits,1);
});
test('temporary collision protection prevents multiple immediate hits',()=>{
  const f=flight();f.add('rock',0,1);f.add('rock',0,1);f.step({},1/120);assert.equal(f.health,2);assert.equal(f.hits,1);
});
test('swept collision catches a high-speed pass',()=>{
  const f=flight();f.vy=20000;f.add('rock',0,70,{radius:10});f.step({},1/120);assert.equal(f.hits,1);
});
test('capture core is fatal even with armor and invulnerability',()=>{
  const f=flight({engine:2,hull:2,power:2});f.invincible=10;f.add('hole',0,1,{radius:30,mu:1e6,range:600});f.step({},1/120);assert.equal(f.status,'failed');assert.equal(f.health,0);
});
test('gravity bends a coasting trajectory without consuming fuel',()=>{
  const f=flight();f.add('hole',200,100,{mu:1e6,range:610,radius:30});const fuel=f.fuel;f.step({},1/120);assert.ok(f.vx>0);assert.ok(f.vy>level.speed);close(f.fuel,fuel);
});
test('comet ring gives one supply, never repeated free resources',()=>{
  const f=flight();f.fuel=5;f.energy=20;const comet=f.add('comet',75,0,{radius:27,deposit:0});advance(f,.3);
  assert.equal(comet.harvested,true);assert.equal(f.collected,1);assert.ok(f.fuel>5);assert.ok(f.energy>20);advance(f,.3);assert.equal(f.collected,1);
});
test('resource collection never exceeds capacity',()=>{
  const f=flight();f.collect('comet',{x:0,y:0});assert.equal(f.fuel,f.craft.maxFuel);assert.equal(f.energy,f.craft.maxEnergy);
});
test('electrical depletion ends the mission',()=>{
  const f=flight({engine:2,hull:2,power:0});f.energy=.001;advance(f,.1);assert.equal(f.status,'failed');assert.equal(f.energy,0);
});
test('600 elapsed seconds alone never grant arrival',()=>{
  const f=flight({engine:2,hull:2,power:2});advance(f,601);assert.equal(f.status,'playing');assert.ok(f.time>600);assert.equal(f.progress,0);
});
test('same seed produces identical encounters with identical controls',()=>{
  const a=new Flight(level,buildCraft({engine:2,hull:2,power:2}),991),b=new Flight(level,buildCraft({engine:2,hull:2,power:2}),991);
  advance(a,25);advance(b,25);assert.deepEqual(a.objects,b.objects);assert.equal(a.score,b.score);assert.equal(a.status,b.status);
});
test('harder levels increase pacing and all-basic gear increases scoring',()=>{
  assert.ok(LEVELS[3].density>LEVELS[0].density);assert.equal(LEVELS[0].blackholes,false);
  close(buildCraft({engine:0,hull:0,power:0}).multiplier,2.05);assert.equal(buildCraft({engine:2,hull:2,power:2}).multiplier,1);
});
test('failure cannot unlock a future photo',()=>{
  const save=emptySave(),record={level:'mars',score:300,status:'failed'};recordFlight(save,record,{id:'mars-photo'});assert.deepEqual(save.photos,[]);assert.deepEqual(save.completed,[]);
  const good={level:'mars',score:900,status:'arrived'};const result=recordFlight(save,good,{id:'mars-photo'});assert.equal(result.isNewPhoto,true);assert.equal(save.photos.length,1);assert.equal(save.completed[0],'mars');recordFlight(save,good,{id:'mars-photo'});assert.equal(save.photos.length,1);
});
test('swept geometry handles stationary and crossing segments',()=>{close(segmentDistance(0,0,-5,0,5,0),0);close(segmentDistance(0,0,3,4,3,4),5);});
