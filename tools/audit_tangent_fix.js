// Reproduce the dated frame, plotting and planning/live consistency audit.
// Run: node tools/audit_tangent_fix.js
import fs from 'node:fs';
import {LEVELS,buildCraft} from '../src/config.js';
import {Navigation} from '../src/navigation.js';
import {AU,DAY,V,atTime,propagate} from '../src/dynamics.js';
import {shipSegment,sampleSegment} from '../src/orbit-view.js';
import {eph,getPlan} from '../tests/helpers.js';
const date='2026-11-13',report={release:'v10.0.0 tangent/physics correction',launchDate:date,units:{position:'km',velocity:'km/s',coastError:'metres'},missions:[]};
for(const id of ['moon','mars','pluto']){
  const p=getPlan(id,date),level=LEVELS.find(l=>l.id===id),craft=buildCraft({engine:2,hull:2,power:2}),nav=new Navigation(level,p,eph,craft),initialStateMatchesLive=p.initial.every((x,i)=>Object.is(x,nav.state[i]));
  for(let i=0;i<120;i++)nav.advance(.5,{dv:[0,0,0]},craft.maxFuel);
  const direct=propagate(eph,p.departure,p.initial,nav.day-p.departure,{moon:id==='moon'}).at(-1).y;
  let maxDisplayCubicErrorKm=0;
  for(let i=1;i<p.points.length;i++){
    const a=p.points[i-1],b=p.points[i],time=(a.t+b.t)/2,actual=atTime(p.track,time/DAY).slice(0,3),origin=eph.body(p.frame,p.departure+time/DAY).r;
    maxDisplayCubicErrorKm=Math.max(maxDisplayCubicErrorKm,V.norm(V.sub(sampleSegment(shipSegment(a,b),.5).r,V.scale(V.sub(actual,origin),AU))));
  }
  report.missions.push({id,frame:p.frame,settings:p.settings,initialBarycentricState:p.initial,initialDisplayVelocity:p.points[0].shipVelocity,earthToDisplayVelocity:p.velocityOffset,closestKm:p.closest,good:p.good,initialStateMatchesLive,coastSimulatedDays:nav.day-p.departure,coastPositionDifferenceMetres:V.norm(V.sub(nav.state.slice(0,3),direct.slice(0,3)))*AU*1000,maxDisplayCubicErrorKm});
}
const path=new URL('../data/validation/tangent_fix_report.json',import.meta.url);fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
