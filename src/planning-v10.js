import {LEVELS} from './config.js';
import {predictStar} from './orbit.js';
import {AU,DAY,MS,V,direction,vectorAngles,dateDay,propagate,closestEncounter,collisionBody} from './dynamics.js';

function stumpff(z){
  if(Math.abs(z)<1e-5)return {c:.5-z/24+z*z/720-z*z*z/40320,s:1/6-z/120+z*z/5040-z*z*z/362880};
  if(z>0){const q=Math.sqrt(z);return {c:(1-Math.cos(q))/z,s:(q-Math.sin(q))/(q*q*q)};}
  const q=Math.sqrt(-z);return {c:(Math.cosh(q)-1)/(-z),s:(Math.sinh(q)-q)/(q*q*q)};
}
export function lambert(r1,r2,days,mu){
  const a=V.norm(r1),b=V.norm(r2),cos=Math.max(-1,Math.min(1,V.dot(r1,r2)/(a*b))),cross=V.cross(r1,r2);
  const sin=(cross[2]>=0?1:-1)*Math.sqrt(Math.max(0,1-cos*cos)),A=sin*Math.sqrt(a*b/(1-cos));
  if(Math.abs(A)<1e-10)throw Error('Degenerate Lambert geometry');
  function fn(z){const {c,s}=stumpff(z);if(c<=0)return null;const y=a+b+A*(z*s-1)/Math.sqrt(c);if(y<0)return null;return {f:Math.pow(y/c,1.5)*s+A*Math.sqrt(y)-Math.sqrt(mu)*days,y};}
  let lo=null,hi=null,prev=null;
  for(let z=-39;z<39.45;z+=.25){const q=fn(z);if(q){if(prev&&prev.f*q.f<=0){lo=prev.z;hi=z;break;}prev={...q,z};}}
  if(lo===null)throw Error('No single-revolution Lambert solution for this transfer');
  let q;
  for(let i=0;i<70;i++){const z=(lo+hi)/2;q=fn(z);if(!q){lo=z;continue;}if(fn(lo).f*q.f<=0)hi=z;else lo=z;}
  q=fn((lo+hi)/2);const f=1-q.y/a,g=A*Math.sqrt(q.y/mu);
  return V.scale(V.sub(r2,V.scale(r1,f)),1/g);
}
function solve3(matrix,b){
  const a=matrix.map((row,i)=>[...row,b[i]]);
  for(let i=0;i<3;i++){let pivot=i;for(let k=i+1;k<3;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;[a[i],a[pivot]]=[a[pivot],a[i]];if(Math.abs(a[i][i])<1e-15)throw Error('Singular trajectory correction matrix');const d=a[i][i];for(let j=i;j<4;j++)a[i][j]/=d;for(let k=0;k<3;k++)if(k!==i){const v=a[k][i];for(let j=i;j<4;j++)a[k][j]-=v*a[i][j];}}
  return a.map(row=>row[3]);
}
function rotateZ(v,angle){return [v[0]*Math.cos(angle)-v[1]*Math.sin(angle),v[0]*Math.sin(angle)+v[1]*Math.cos(angle),v[2]];}
function refineVelocity(ephem,level,day,r,v,target,days){
  let velocity=v.slice(),error=Infinity;
  for(let i=0;i<7;i++){
    const solve=vel=>{const track=propagate(ephem,day,[...r,...vel],days,{moon:level.id==='moon'});if(track.at(-1).t<days-1e-7)throw Error('Candidate trajectory intersects a body');return track.at(-1).y.slice(0,3);};
    const end=solve(velocity),delta=V.sub(target,end);error=V.norm(delta)*AU;
    if(error<Math.min(500,level.near*.025))break;
    const eps=1e-7,columns=[];
    for(let j=0;j<3;j++){const q=velocity.slice();q[j]+=eps;columns.push(V.scale(V.sub(solve(q),end),1/eps));}
    let correction=solve3([0,1,2].map(i=>columns.map(col=>col[i])),delta),n=V.norm(correction);
    if(n>.004)correction=V.scale(correction,.004/n);velocity=V.add(velocity,correction);
  }
  return {v:velocity,error};
}
const presetCache=new Map();
export function presetForDate(levelId,launchDate,ephem){
  const level=LEVELS.find(l=>l.id===levelId);if(levelId==='proxima')return {...level.default,launchDate};
  const key=levelId+launchDate;if(presetCache.has(key))return structuredClone(presetCache.get(key));
  const day=ephem.validateLaunch(launchDate),earth=ephem.body('earth',day),sun=ephem.body('sun',day),candidates=[];
  const times=levelId==='moon'?[4,5,6]:levelId==='mars'?[160,220,280,360,480,600]:[365.25*7,365.25*9,365.25*12,365.25*15,365.25*18];
  for(const days of times){
    if(day+days*1.15>ephem.end)continue;
    try{
      const dest=ephem.body(levelId,day+days),earthEnd=ephem.body('earth',day+days),sunEnd=ephem.body('sun',day+days);
      const orbitNormal=V.unit(V.cross(V.sub(dest.r,levelId==='moon'?earthEnd.r:sunEnd.r),V.sub(dest.v,levelId==='moon'?earthEnd.v:sunEnd.v)));
      const aim=V.add(dest.r,V.scale(orbitNormal,level.near*.32/AU));let offset,r,v;
      if(levelId==='moon'){
        const relative=V.sub(aim,earthEnd.r);offset=V.scale(V.unit(rotateZ(relative,-.28)),50000/AU);r=V.add(earth.r,offset);
        v=V.add(earth.v,lambert(offset,relative,days,ephem.mu[ephem.names.indexOf('earth')]));
      }else{
        offset=V.scale(V.unit(V.sub(dest.r,earth.r)),750000/AU);
        for(let k=0;k<4;k++){r=V.add(earth.r,offset);v=V.add(sun.v,lambert(V.sub(r,sun.r),V.sub(aim,sunEnd.r),days,ephem.mu[0]));offset=V.scale(V.unit(V.sub(v,earth.v)),750000/AU);}
        r=V.add(earth.r,offset);
      }
      candidates.push({days,r,v,aim,offset,cost:V.norm(V.sub(v,earth.v))});
    }catch{}
  }
  candidates.sort((a,b)=>a.cost-b.cost);
  for(const candidate of candidates){
    try{
      const q=refineVelocity(ephem,level,day,candidate.r,candidate.v,candidate.aim,candidate.days),angles=vectorAngles(V.sub(q.v,earth.v));
      if(angles.speed<level.range[0]||angles.speed>level.range[1]||Math.abs(angles.pitch)>45)continue;
      const result={...angles,launchDate,durationDays:candidate.days,offsetKm:V.scale(candidate.offset,AU),baseHeading:angles.heading,basePitch:angles.pitch,presetFor:launchDate};
      presetCache.set(key,result);return structuredClone(result);
    }catch{}
  }
  throw Error('No reference transfer fits the injection limits on this date. Try another date.');
}
export function initialState(level,settings,ephem){
  const day=ephem.validateLaunch(settings.launchDate),earth=ephem.body('earth',day),offset=settings.offsetKm||level.offset||[750000,0,0];
  const angle=vectorAngles(V.scale(offset,DAY/AU));
  const rOffset=V.scale(direction(angle.heading+settings.heading-(settings.baseHeading??level.default.heading),angle.pitch+settings.pitch-(settings.basePitch??level.default.pitch)),V.norm(offset)/AU);
  const relative=V.scale(direction(settings.heading,settings.pitch),settings.speed*DAY/AU);
  return {day,state:[...V.add(earth.r,rOffset),...V.add(earth.v,relative)]};
}
export function predictForDate(levelId,settings,ephem){
  const level=LEVELS.find(l=>l.id===levelId);if(!level)throw Error('Unknown destination');
  for(const k of ['heading','pitch','speed'])if(!Number.isFinite(settings[k]))throw Error('Enter finite launch parameters');
  if(settings.speed<level.range[0]||settings.speed>level.range[1]||Math.abs(settings.pitch)>45||settings.heading<0||settings.heading>360)throw Error('Launch parameters are outside the allowed range');
  if(levelId==='proxima'){dateDay(settings.launchDate);return {...predictStar(level,settings),launchDate:settings.launchDate,settings,model:'relativistic',near:level.distance*.002,target:[0,level.distance,0]};}
  const {day,state}=initialState(level,settings,ephem),duration=settings.durationDays??(levelId==='moon'?6:levelId==='mars'?280:365.25*12),horizon=duration*1.12;
  ephem.validateLaunch(settings.launchDate,horizon);
  const track=propagate(ephem,day,state,horizon,{moon:levelId==='moon'}),nearest=closestEncounter(ephem,levelId,day,track),central=levelId==='moon'?'earth':'sun';
  const stride=Math.max(1,Math.floor(track.length/700)),display=track.filter((_,i)=>i%stride===0);if(display.at(-1)!==track.at(-1))display.push(track.at(-1));
  const points=display.map(p=>{
    const origin=ephem.body(central,day+p.t).r,target=ephem.body(levelId,day+p.t).r,earth=ephem.body('earth',day+p.t).r;
    const centerVelocity=ephem.body(central,day+p.t).v;
    return {t:p.t*DAY,ship:V.scale(V.sub(p.y.slice(0,3),origin),AU),shipVelocity:V.scale(V.sub(p.y.slice(3),centerVelocity),AU/DAY),target:V.scale(V.sub(target,origin),AU),earth:V.scale(V.sub(earth,origin),AU)};
  });
  const origin=ephem.body(central,day+nearest.t).r,collision=collisionBody(ephem,day+track.at(-1).t,track.at(-1).y);
  let pathLength=0;const cumulative=[0];for(let i=1;i<track.length;i++){
    const a=V.sub(track[i-1].y.slice(0,3),ephem.body(central,day+track[i-1].t).r),b=V.sub(track[i].y.slice(0,3),ephem.body(central,day+track[i].t).r);
    pathLength+=V.norm(V.sub(b,a))*AU;cumulative.push(pathLength);
  }
  const velocityOffset=V.scale(V.sub(ephem.body('earth',day).v,ephem.body(central,day).v),AU/DAY);
  return {points,velocityOffset,closest:nearest.distance,closestTime:nearest.t*DAY,encounter:{ship:V.scale(V.sub(nearest.y.slice(0,3),origin),AU),target:V.scale(V.sub(nearest.target,origin),AU)},relativeSpeed:nearest.relativeSpeed,duration:horizon*DAY,pathLength,collision,model:'jpl-nbody',good:nearest.distance<=level.near,frame:central,handoff:V.norm(settings.offsetKm||level.offset||[750000,0,0]),launchDate:settings.launchDate,settings:{...settings},departure:day,initial:state,track,cumulative,goalDay:nearest.t,near:level.near,note:'NASA/JPL Horizons / 11-body gravity / post-injection initial state'};
}
export function predictFuture(ephem,levelId,day,state,duration){
  const level=LEVELS.find(l=>l.id===levelId),days=Math.max(.005,Math.min(duration,ephem.end-day));
  const track=propagate(ephem,day,state,days,{moon:levelId==='moon',rtol:3e-9}),q=closestEncounter(ephem,levelId,day,track);
  return {closest:q.distance,day:day+q.t,ship:q.y.slice(0,3),target:q.target,relativeSpeed:q.relativeSpeed,collision:collisionBody(ephem,day+track.at(-1).t,track.at(-1).y)};
}
