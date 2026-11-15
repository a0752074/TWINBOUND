import {LEVELS, C, G0, YEAR, LY_KM, clamp} from './config.js';
const AU=149597870.7, DAY=86400, DEG=Math.PI/180;
const mag=a=>Math.hypot(...a);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const direction=(h,p)=>[Math.cos(h*DEG)*Math.cos(p*DEG),Math.sin(h*DEG)*Math.cos(p*DEG),Math.sin(p*DEG)];

export class Ephemeris {
  constructor(meta,buffer){this.meta=meta;this.data=new Float64Array(buffer);this.mu=meta.mu_au3_day2;this.names=meta.names;}
  state(t,out=new Float64Array(60)){
    const step=this.meta.step_days, max=this.meta.samples-1;
    if(t<0||t>max*step+1e-8)throw Error('Outside the bundled ephemeris interval');
    const i=Math.min(max-1,Math.max(0,Math.floor(t/step))),u=clamp(t/step-i,0,1),u2=u*u,u3=u2*u;
    const a=i*60,b=(i+1)*60,d=this.data;
    const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
    const dh00=(6*u2-6*u)/step,dh10=3*u2-4*u+1,dh01=(-6*u2+6*u)/step,dh11=3*u2-2*u;
    for(let j=0;j<30;j++){
      out[j]=h00*d[a+j]+h10*step*d[a+30+j]+h01*d[b+j]+h11*step*d[b+30+j];
      out[j+30]=dh00*d[a+j]+dh10*d[a+30+j]+dh01*d[b+j]+dh11*d[b+30+j];
    }
    return out;
  }
}
// Dormand–Prince embedded 5(4), with a local dynamical time step ceiling.
// AU/day units keep a common absolute tolerance useful in all three dimensions.
const A=[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]];
const B=[35/384,0,500/1113,125/192,-2187/6784,11/84,0];
const E=[35/384-5179/57600,0,500/1113-7571/16695,125/192-393/640,-2187/6784+92097/339200,11/84-187/2100,-1/40];
const T=[0,1/5,3/10,4/5,8/9,1,1];
export function integrate(rhs,y0,duration,options={}){
  let y=y0.slice(),t=0,h=options.initialStep??Math.min(options.maxStep||.25,duration/400),iterations=0;
  const accepted=[{t:0,y:y.slice()}],rtol=options.rtol||1e-9,atol=options.atol??2e-12;
  while(t<duration){
    if(++iterations>180000)throw Error('Integrator step limit reached; load the reference settings');
    h=Math.min(h,duration-t,options.ceiling?options.ceiling(t,y):Infinity);
    if(h<1e-11)break;
    const k=[];
    for(let s=0;s<7;s++){
      const z=y.map((v,j)=>v+h*A[s].reduce((sum,a,l)=>sum+a*k[l][j],0));
      k.push(rhs(t+T[s]*h,z));
    }
    const next=y.map((v,j)=>v+h*B.reduce((sum,b,l)=>sum+b*k[l][j],0));
    const err=Math.max(...y.map((v,j)=>Math.abs(h*E.reduce((sum,e,l)=>sum+e*k[l][j],0))/(atol+rtol*Math.max(Math.abs(v),Math.abs(next[j])))));
    if(!Number.isFinite(err)||next.some(v=>!Number.isFinite(v)))throw Error('Trajectory integration did not converge');
    if(err<=1){t+=h;y=next;accepted.push({t,y:y.slice()});if(options.stop?.(t,y))break;}
    h*=clamp(err? .9*Math.pow(1/err,.2):4,.15,4);
    h=Math.min(h,options.maxStep||.25);
  }
  return accepted;
}
export function relativisticLeg(distanceKm,betaCap=.8,a=G0){
  const distance=distanceKm*1000,gCap=1/Math.sqrt(1-betaCap*betaCap),gamma=Math.min(1+a*distance/(2*C*C),gCap);
  const u=Math.sqrt((gamma-1)*(gamma+1)),beta=u/gamma,ta=C/a*u,taua=C/a*Math.acosh(gamma),xa=C*C/a*(gamma-1);
  const tc=Math.max(0,distance-2*xa)/(beta*C),duration=2*ta+tc,proper=2*taua+tc/gamma;
  return {duration,proper,beta,gamma,ta,taua,xa,tc,distance,a,sample(f){
    const t=clamp(f,0,1)*duration;
    if(t<=ta){const q=a*t/C,g=Math.hypot(1,q);return {earth:t,ship:C/a*Math.asinh(q),distance:C*C/a*q*q/(g+1)/1000,beta:q/g};}
    if(t<=ta+tc)return {earth:t,ship:taua+(t-ta)/gamma,distance:(xa+beta*C*(t-ta))/1000,beta};
    const rem=duration-t,q=a*rem/C,g=Math.hypot(1,q);
    return {earth:t,ship:proper-C/a*Math.asinh(q),distance:(distance-C*C/a*q*q/(g+1))/1000,beta:q/g};
  }};
}
function rotateOffset(offset,dh,dp){
  const r=mag(offset),h=Math.atan2(offset[1],offset[0])/DEG+dh,p=Math.asin(offset[2]/r)/DEG+dp;
  return direction(h,p).map(v=>v*r/AU);
}
export function predictNBody(level,settings,ephem){
  const departure=level.departure,earthIndex=ephem.names.indexOf('earth'),targetIndex=ephem.names.indexOf(level.id),zero=ephem.state(departure);
  const pos=zero.slice(earthIndex*3,earthIndex*3+3),vel=zero.slice(30+earthIndex*3,33+earthIndex*3);
  const offset=rotateOffset(level.offset,settings.heading-level.default.heading,settings.pitch-level.default.pitch);
  const vector=direction(settings.heading,settings.pitch).map(v=>v*settings.speed*DAY/AU);
  const y0=[...pos.map((v,j)=>v+offset[j]),...vel.map((v,j)=>v+vector[j])];
  const state=new Float64Array(60),mu=ephem.mu;let collision=null,nearest={distance:Infinity,t:0};
  function rhs(t,y){
    ephem.state(departure+t,state);const a=[0,0,0];
    for(let i=0;i<mu.length;i++){
      const dx=state[3*i]-y[0],dy=state[3*i+1]-y[1],dz=state[3*i+2]-y[2],r2=dx*dx+dy*dy+dz*dz,f=mu[i]/(r2*Math.sqrt(r2));
      a[0]+=f*dx;a[1]+=f*dy;a[2]+=f*dz;
    }
    return [...y.slice(3),...a];
  }
  const track=integrate(rhs,y0,level.durationDays,{maxStep:level.id==='moon'?.035:.2,ceiling(t,y){
    ephem.state(departure+t,state);let step=.2;
    for(let i=0;i<mu.length;i++){
      const r=Math.hypot(y[0]-state[3*i],y[1]-state[3*i+1],y[2]-state[3*i+2]);
      step=Math.min(step,.12*Math.sqrt(r*r*r/mu[i]));
    }
    return step;
  },stop(t,y){
    ephem.state(departure+t,state);
    for(let i=0;i<mu.length;i++)if(Math.hypot(y[0]-state[i*3],y[1]-state[i*3+1],y[2]-state[i*3+2])*AU<ephem.meta.radii_km[i]){collision=ephem.names[i];return true;}
    return false;
  }});
  const frame=level.id==='moon'?earthIndex:0;
  function point(p){
    const world=ephem.state(departure+p.t),origin=world.slice(frame*3,frame*3+3);
    const target=sub(Array.from(world.slice(targetIndex*3,targetIndex*3+3)),origin).map(v=>v*AU);
    const ship=sub(p.y.slice(0,3),origin).map(v=>v*AU),earth=sub(Array.from(world.slice(earthIndex*3,earthIndex*3+3)),origin).map(v=>v*AU);
    const distance=mag(sub(ship,target));if(distance<nearest.distance)nearest={distance,t:p.t,ship,target};
    return {t:p.t*DAY,ship,target,earth};
  }
  // Check every accepted integration point; display is resampled separately.
  const full=track.map(point),stride=Math.max(1,Math.floor(full.length/700));
  const points=full.filter((_,i)=>i%stride===0);if(points.at(-1)!==full.at(-1))points.push(full.at(-1));
  const pathLength=full.slice(1).reduce((sum,p,i)=>sum+mag(sub(p.ship,full[i].ship)),0);
  return {points,closest:nearest.distance,closestTime:nearest.t*DAY,encounter:{ship:nearest.ship,target:nearest.target},duration:full.at(-1).t,pathLength,collision,model:'nbody',good:nearest.distance<=level.near,frame:frame===earthIndex?'earth':'sun',handoff:mag(level.offset),note:'Legacy Newtonian model / JPL initial states / three-hour interpolation'};
}
export function predictKepler(level,settings){
  const mu=.0002959122082855911,r2=39.482,a=(1+r2)/2,periodHalf=Math.PI*Math.sqrt(a*a*a/mu),omega=Math.sqrt(mu/(r2*r2*r2));
  const initialPhase=Math.PI-omega*periodHalf;
  const h=(settings.heading-90)*DEG,p=settings.pitch*DEG;
  const start=[Math.cos(h),Math.sin(h),0],v=direction(settings.heading,settings.pitch).map(x=>x*settings.speed*DAY/AU);
  const raw=integrate((t,y)=>{const r=Math.hypot(...y.slice(0,3));return [...y.slice(3),...y.slice(0,3).map(x=>-mu*x/(r*r*r))];},[...start,...v],periodHalf,{maxStep:8,rtol:1e-10});
  let closest=Infinity,encounter=null,closestTime=0;
  const samples=raw.filter((_,i)=>i%Math.max(1,Math.floor(raw.length/700))===0);if(samples.at(-1)!==raw.at(-1))samples.push(raw.at(-1));
  const points=samples.map(q=>{
    const phase=initialPhase+omega*q.t,target=[r2*Math.cos(phase)*AU,r2*Math.sin(phase)*AU,0],ship=q.y.slice(0,3).map(x=>x*AU);
    const distance=mag(sub(ship,target));if(distance<closest){closest=distance;closestTime=q.t*DAY;encounter={ship,target};}
    return {t:q.t*DAY,ship,target,earth:[AU*Math.cos(Math.sqrt(mu)*q.t),AU*Math.sin(Math.sqrt(mu)*q.t),0]};
  });
  let pathLength=0;for(let i=1;i<points.length;i++)pathLength+=mag(sub(points[i].ship,points[i-1].ship));
  return {points,closest,closestTime,encounter,duration:periodHalf*DAY,pathLength,model:'kepler',good:closest<level.near,frame:'sun',note:'Legacy circular orbit / solar two-body approximation'};
}
export function predictStar(level,settings){
  const leg=relativisticLeg(level.distance,settings.speed),dir=direction(settings.heading,settings.pitch),target=[0,level.distance,0];
  const points=Array.from({length:301},(_,i)=>{const q=leg.sample(i/300);return {t:q.earth,ship:dir.map(x=>x*q.distance),shipVelocity:dir.map(x=>x*q.beta*C/1000),target,earth:[0,0,0]};});
  const final=points.at(-1),closest=mag(sub(final.ship,target));
  return {points,velocityOffset:[0,0,0],closest,closestTime:leg.duration,encounter:{ship:final.ship,target},duration:leg.duration,properDuration:leg.proper,pathLength:level.distance,model:'relativistic',good:closest<=level.distance*.002,frame:'earth',beta:leg.beta,note:'1g proper acceleration / cruise / deceleration / ideal external drive'};
}
export function predict(levelId,settings,ephem){
  const level=LEVELS.find(l=>l.id===levelId);if(!level)throw Error('Unknown destination');
  if(!Object.values(settings).every(Number.isFinite))throw Error('Enter finite heading parameters');
  if(settings.speed<level.range[0]||settings.speed>level.range[1]||settings.pitch< -45||settings.pitch>45||settings.heading<0||settings.heading>360)throw Error('Heading parameters are outside the allowed range');
  if(level.orbit==='nbody')return predictNBody(level,settings,ephem);
  return level.orbit==='kepler'?predictKepler(level,settings):predictStar(level,settings);
}
