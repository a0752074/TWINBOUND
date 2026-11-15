import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,buildCraft} from '../src/config.js';
import {AU,DAY,V,propagate,closestEncounter,collisionBody,interpolateState} from '../src/dynamics.js';
import {predictForDate,predictFuture} from '../src/planning-v10.js';
import {shipSegment,sampleSegment,departureGlyph,projectedLaunch,steerLaunch} from '../src/orbit-view.js';
import {Navigation} from '../src/navigation.js';
import {OrbitMap} from '../src/render.js';
import {eph,getPlan,linkedFlight,advance} from './helpers.js';

test('map initial tangents agree with independently propagated frame-relative motion',()=>{
  for(const id of ['moon','mars','pluto']){
    const p=getPlan(id,'2026-11-13'),step=.5,track=propagate(eph,p.departure,p.initial,step/DAY,{moon:id==='moon'});
    const a=V.sub(p.initial.slice(0,3),eph.body(p.frame,p.departure).r),b=V.sub(track.at(-1).y.slice(0,3),eph.body(p.frame,p.departure+step/DAY).r);
    const finiteDifference=V.scale(V.sub(b,a),AU/step);
    assert.ok(V.norm(V.sub(p.points[0].shipVelocity,finiteDifference))<.0002,id+' km/s');
    const projected=projectedLaunch(p.settings,p.velocityOffset);
    assert.ok(Math.hypot(projected[0]-p.points[0].shipVelocity[0],projected[1]-p.points[0].shipVelocity[1])<1e-10,id);
  }
});

test('Mars requires adding Earth orbital velocity before drawing the solar-frame direction',()=>{
  const p=getPlan('mars','2026-11-13'),v=p.points[0].shipVelocity;
  const display=Math.atan2(v[1],v[0])*180/Math.PI;
  assert.ok(Math.abs(display-p.settings.heading)>10);
  assert.deepEqual(p.velocityOffset,eph.body('earth',p.departure).v.map((x,i)=>(x-eph.body('sun',p.departure).v[i])*AU/DAY));
});

test('rocket lies on the actual visible green curve and its axis follows the local tangent in XY and XZ',()=>{
  for(const id of ['moon','mars','pluto','proxima'])for(const vertical of [1,2]){
    const p=getPlan(id,'2026-11-13'),scale=id==='moon'?.00035:id==='mars'?8e-7:id==='pluto'?2e-8:3e-12;
    const map=r=>[200+r[0]*scale,180-r[vertical]*scale],earth=map(p.points[0].earth),glyph=departureGlyph(p.points,map,vertical,earth);
    if(id==='proxima'&&vertical===2){assert.equal(glyph,null);continue;}
    assert.ok(glyph,id);const control=shipSegment(p.points[glyph.segment],p.points[glyph.segment+1]);
    const before=map(sampleSegment(control,Math.max(0,glyph.u-1e-6)).r),after=map(sampleSegment(control,Math.min(1,glyph.u+1e-6)).r),point=map(sampleSegment(control,glyph.u).r);
    const dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy);
    assert.ok(Math.hypot(glyph.x-point[0],glyph.y-point[1])<1e-7,id);
    assert.ok((glyph.dx*dx+glyph.dy*dy)/length>1-1e-8,id+' tangent');
    assert.ok(Math.hypot(glyph.x-earth[0],glyph.y-earth[1])>=39-1e-6,id+' visible');
  }
});

test('Bezier start derivative equals the physical relative velocity, including nonzero Z',()=>{
  for(const id of ['moon','mars','pluto']){
    const p=getPlan(id),[a,b]=p.points,control=shipSegment(a,b),derivative=sampleSegment(control,0).tangent.map(x=>x/(b.t-a.t));
    assert.ok(V.norm(V.sub(derivative,a.shipVelocity))<1e-7,id);
  }
});

test('actual Canvas rocket rotation follows its visible curve even while new slider values are pending',()=>{
  const originalWindow=globalThis.window;globalThis.window={devicePixelRatio:1};
  try{
    const route=getPlan('mars','2026-11-13'),level=LEVELS.find(l=>l.id==='mars'),rotations=[];
    const gradient={addColorStop(){}},ctx=new Proxy({rotate(a){rotations.push(a);},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}},{get:(target,key)=>key in target?target[key]:(()=>{})});
    const canvas={width:580,height:342,addEventListener(){},getContext(){return ctx;},getBoundingClientRect(){return {width:580,height:342,left:0,top:0};}};
    const m=new OrbitMap(canvas,()=>({level,route,settings:{...route.settings,heading:route.settings.heading+40}}),()=>{});m.draw();
    const g=m.glyphCache.glyph,control=shipSegment(route.points[g.segment],route.points[g.segment+1]);
    const a=sampleSegment(control,g.u-1e-6).r,b=sampleSegment(control,g.u+1e-6).r;
    const tangent=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);
    assert.ok(Math.abs(rotations.at(-1)-(tangent+Math.PI/2))<1e-6);
    assert.equal(m.arrow.x,g.x);assert.equal(m.arrow.y,g.y);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('dragging the current arrow preserves controls instead of interpreting total velocity as relative heading',()=>{
  for(const id of ['moon','mars','pluto','proxima'])for(const projection of ['xy','xz']){
    const p=getPlan(id,'2026-11-13'),v=projectedLaunch(p.settings,p.velocityOffset,projection,id==='proxima');
    if(Math.hypot(...v)<1e-8)continue;
    const q=steerLaunch(p.settings,p.velocityOffset,projection,Math.atan2(v[1],v[0]),p.settings.speed,id==='proxima');
    const key=projection==='xy'?'heading':'pitch';assert.ok(Math.abs(q[key]-p.settings[key])<1e-5,id+' '+projection);
    assert.equal(q.speed,p.settings.speed);
  }
});

test('drag inversion can reach a physically attainable different XY direction',()=>{
  for(const id of ['moon','mars','pluto']){
    const p=getPlan(id),desired={...p.settings,heading:(p.settings.heading+9)%360},v=projectedLaunch(desired,p.velocityOffset);
    const q=steerLaunch(p.settings,p.velocityOffset,'xy',Math.atan2(v[1],v[0]),p.settings.speed),actual=projectedLaunch({...p.settings,...q},p.velocityOffset);
    assert.ok(V.dot(actual,v)/V.norm(actual)/V.norm(v)>1-1e-10,id);
  }
});

test('stellar preview and actual arrival use the same 0.2 percent encounter radius',()=>{
  const base=getPlan('proxima'),p=predictForDate('proxima',{...base.settings,heading:90.5},null);
  assert.ok(p.closest>p.near);assert.equal(p.good,false);assert.equal(base.good,true);
});

test('a live maneuver invalidates old forecasts, including a late worker response',()=>{
  const f=linkedFlight(),n=f.navigation,request=n.forecastRequest();
  const result={...predictFuture(eph,'moon',request.day,request.state,request.duration),sourceRevision:request.revision};
  n.setForecast(result);assert.equal(n.future,result);advance(f,.2,{right:true});assert.equal(n.future,null);
  n.setForecast(result);assert.equal(n.future,null);
});

test('a forecast whose encounter is already in the past cannot affect current navigation risk',()=>{
  const n=linkedFlight().navigation;n.setForecast({closest:0,day:n.day-.1,sourceRevision:n.maneuverRevision});assert.equal(n.future,null);
});

test('closest-approach relative speed is finite when the nearest point is an endpoint',()=>{
  const p=getPlan('moon'),track=propagate(eph,p.departure,p.initial,.001,{moon:true}),q=closestEncounter(eph,'moon',p.departure,track);
  assert.ok(Number.isFinite(q.relativeSpeed));assert.ok(q.relativeSpeed>0);
});

test('a fast surface crossing is detected and localized even with negligible gravity',()=>{
  const ephem={n:1,size:6,names:['body'],end:10,mu:[1e-30],meta:{bodies:[{radius_km:1000}]},state(_t,out=new Float64Array(6)){return out.fill(0);},body(){return {r:[0,0,0],v:[0,0,0]};},acceleration(){return [0,0,0];}};
  const initial=[-10000/AU,0,0,20000/AU,0,0],track=propagate(ephem,0,initial,1,{maxStep:1}),last=track.at(-1);
  assert.equal(collisionBody(ephem,last.t,last.y),'body');assert.ok(Math.abs(last.t-.45)<1e-10);
  assert.ok(Math.abs(V.norm(last.y.slice(0,3))*AU-1000)<1e-6);
});

test('live coasting and preflight integration agree at the same simulated time on each planetary mission',()=>{
  for(const id of ['moon','mars','pluto']){
    const p=getPlan(id),level=LEVELS.find(l=>l.id===id),craft=buildCraft({engine:2,hull:2,power:2}),n=new Navigation(level,p,eph,craft);
    for(let i=0;i<120;i++)n.advance(.5,{dv:[0,0,0]},craft.maxFuel);
    const reference=propagate(eph,p.departure,p.initial,n.day-p.departure,{moon:id==='moon'}).at(-1).y;
    const error=V.norm(V.sub(n.state.slice(0,3),reference.slice(0,3)))*AU;
    assert.ok(error<.1,id+' divergence km: '+error);
  }
});
