// Shared by planning, live flight and future prediction. Units AU and TDB days.
import {integrate} from './orbit.js';
export const AU=149597870.7,DAY=86400,MS=AU*1000/DAY;
export const V={add:(a,b)=>a.map((x,i)=>x+b[i]),sub:(a,b)=>a.map((x,i)=>x-b[i]),scale:(a,k)=>a.map(x=>x*k),dot:(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>Math.hypot(...a),unit(a){const r=this.norm(a);return r>1e-18?this.scale(a,1/r):[1,0,0];}};
export const dateDay=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw Error('Select a valid launch date');const t=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error('Invalid launch date');return (t-Date.UTC(2025,0,1))/86400000;};
export function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export const direction=(h,p)=>[Math.cos(h*Math.PI/180)*Math.cos(p*Math.PI/180),Math.sin(h*Math.PI/180)*Math.cos(p*Math.PI/180),Math.sin(p*Math.PI/180)];
export function vectorAngles(v){const n=V.norm(v);return {heading:(Math.atan2(v[1],v[0])*180/Math.PI+360)%360,pitch:Math.asin(v[2]/n)*180/Math.PI,speed:n*AU/DAY};}

export class JplEphemeris {
  constructor(manifest,buffers){
    this.meta=manifest;this.names=manifest.bodies.map(b=>b.name);this.n=this.names.length;this.size=this.n*6;
    this.mu=manifest.bodies.map(b=>b.gm_km3_s2*DAY**2/AU**3);
    this.end=manifest.end_jd-manifest.start_jd;
    this.data=manifest.bodies.map(b=>new Float64Array(buffers[b.name]));
    for(let i=0;i<this.n;i++)if(this.data[i].length!==manifest.bodies[i].samples*6)throw Error('Incomplete ephemeris data: '+this.names[i]);
  }
  validateLaunch(date,duration=0){
    const t=dateDay(date);
    if(date<this.meta.launch_min||date>this.meta.launch_max||t+duration>this.end)throw Error(`Available launch dates: ${this.meta.launch_min} to ${this.meta.launch_max}; the flight must end before 2051-01-01 TDB.`);
    return t;
  }
  state(day,out=new Float64Array(this.size)){
    if(!Number.isFinite(day)||day< -1e-10||day>this.end+1e-10)throw Error('Outside the NASA/JPL data interval. Integration stopped without extrapolation.');
    for(let b=0;b<this.n;b++){
      const spec=this.meta.bodies[b],dt=spec.step_days,i=Math.min(spec.samples-2,Math.max(0,Math.floor(day/dt))),u=Math.max(0,Math.min(1,day/dt-i)),u2=u*u,u3=u2*u,a=i*6,z=a+6,d=this.data[b];
      const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
      for(let j=0;j<3;j++){
        out[b*3+j]=h00*d[a+j]+h10*dt*d[a+3+j]+h01*d[z+j]+h11*dt*d[z+3+j];
        out[this.n*3+b*3+j]=(6*u2-6*u)/dt*d[a+j]+(3*u2-4*u+1)*d[a+3+j]+(-6*u2+6*u)/dt*d[z+j]+(3*u2-2*u)*d[z+3+j];
      }
    }return out;
  }
  body(name,day){const i=this.names.indexOf(name);if(i<0)throw Error('Unknown body: '+name);const s=this.state(day);return {r:Array.from(s.slice(i*3,i*3+3)),v:Array.from(s.slice(this.n*3+i*3,this.n*3+i*3+3))};}
  acceleration(day,r){const s=this.state(day),a=[0,0,0];for(let i=0;i<this.n;i++){const d=[s[i*3]-r[0],s[i*3+1]-r[1],s[i*3+2]-r[2]],r2=V.dot(d,d),f=this.mu[i]/Math.max(1e-30,r2*Math.sqrt(r2));for(let j=0;j<3;j++)a[j]+=d[j]*f;}return a;}
}
let ephemerisPromise;
export function loadEphemeris(){
  if(!ephemerisPromise)ephemerisPromise=(async()=>{
    const base=new URL('../data/horizons_v10/',import.meta.url),r=await fetch(new URL('manifest.json',base));if(!r.ok)throw Error('Cannot load the ephemeris manifest');const manifest=await r.json();
    const pairs=await Promise.all(manifest.bodies.map(async b=>{const f=await fetch(new URL(b.file,base));if(!f.ok)throw Error('Cannot load ephemeris: '+b.name);return [b.name,await f.arrayBuffer()];}));
    return new JplEphemeris(manifest,Object.fromEntries(pairs));
  })().catch(e=>{ephemerisPromise=null;throw e;});return ephemerisPromise;
}
export function propagate(ephem,startDay,initial,durationDays,options={}){
  if(durationDays<=0||collisionBody(ephem,startDay,initial))return [{t:0,y:initial.slice()}];
  if(startDay+durationDays>ephem.end+1e-9)throw Error('Flight exceeds the bundled ephemeris interval');
  const state=new Float64Array(ephem.size),maxStep=options.maxStep??(options.moon?.025:3);
  const rhs=(t,y)=>[...y.slice(3),...ephem.acceleration(startDay+t,y.slice(0,3))];
  const track=integrate(rhs,initial,durationDays,{maxStep,initialStep:Math.min(maxStep,durationDays),rtol:options.rtol??1e-10,atol:options.atol??2e-13,ceiling(t,y){
    ephem.state(startDay+t,state);let h=maxStep;
    for(let i=0;i<ephem.n;i++){
      const r=Math.hypot(y[0]-state[i*3],y[1]-state[i*3+1],y[2]-state[i*3+2]);
      const speed=Math.hypot(y[3]-state[ephem.n*3+i*3],y[4]-state[ephem.n*3+i*3+1],y[5]-state[ephem.n*3+i*3+2]);
      // The gravitational timescale alone is too long for a fast fly-through.
      h=Math.min(h,.12*Math.sqrt(r*r*r/ephem.mu[i]),speed>0?.12*r/speed:Infinity);
    }return h;
  },stop(t,y){if(options.stop?.(startDay+t,y))return true;return Boolean(collisionBody(ephem,startDay+t,y));}});
  // Localize the first surface crossing instead of stopping deep inside a body.
  if(track.length>1&&collisionBody(ephem,startDay+track.at(-1).t,track.at(-1).y)){
    const a=track.at(-2),b=track.at(-1);let first=b.t;
    for(let i=0;i<ephem.n;i++){
      const body=ephem.names[i],radius=ephem.meta.bodies[i].radius_km;
      const inside=t=>V.norm(V.sub(interpolateState(a,b,t).slice(0,3),ephem.body(body,startDay+t).r))*AU<=radius;
      if(!inside(b.t))continue;
      let lo=a.t,hi=b.t;for(let n=0;n<45;n++){const mid=(lo+hi)/2;if(inside(mid))hi=mid;else lo=mid;}
      first=Math.min(first,hi);
    }
    track[track.length-1]={t:first,y:interpolateState(a,b,first)};
  }
  return track;
}
export function collisionBody(ephem,day,y){const s=ephem.state(day);for(let i=0;i<ephem.n;i++)if(Math.hypot(y[0]-s[i*3],y[1]-s[i*3+1],y[2]-s[i*3+2])*AU<=ephem.meta.bodies[i].radius_km)return ephem.names[i];return null;}
export function interpolateState(a,b,time){
  const dt=b.t-a.t;if(dt<=0)return a.y.slice();const u=Math.max(0,Math.min(1,(time-a.t)/dt)),u2=u*u,u3=u2*u,r=[];
  for(let j=0;j<3;j++)r[j]=(2*u3-3*u2+1)*a.y[j]+(u3-2*u2+u)*dt*a.y[j+3]+(-2*u3+3*u2)*b.y[j]+(u3-u2)*dt*b.y[j+3];
  for(let j=0;j<3;j++)r[j+3]=(6*u2-6*u)/dt*a.y[j]+(3*u2-4*u+1)*a.y[j+3]+(-6*u2+6*u)/dt*b.y[j]+(3*u2-2*u)*b.y[j+3];
  return r;
}
export function atTime(track,t){
  if(t<=track[0].t)return track[0].y.slice();if(t>=track.at(-1).t)return track.at(-1).y.slice();let lo=0,hi=track.length-1;
  while(hi-lo>1){const m=(hi+lo)>>1;if(track[m].t<=t)lo=m;else hi=m;}return interpolateState(track[lo],track[hi],t);
}
export function encounterBetween(ephem,target,startDay,a,b){
  const distance=t=>V.norm(V.sub(interpolateState(a,b,t).slice(0,3),ephem.body(target,startDay+t).r))*AU;
  // Golden-section search is used only on short candidate intervals.
  let lo=a.t,hi=b.t,x1=hi-(hi-lo)*.61803398875,x2=lo+(hi-lo)*.61803398875,f1=distance(x1),f2=distance(x2);
  for(let k=0;k<22;k++){if(f1<f2){hi=x2;x2=x1;f2=f1;x1=hi-(hi-lo)*.61803398875;f1=distance(x1);}else{lo=x1;x1=x2;f1=f2;x2=lo+(hi-lo)*.61803398875;f2=distance(x2);}}
  const candidates=[a.t,b.t,(lo+hi)/2].map(t=>({t,distance:distance(t)})).sort((x,y)=>x.distance-y.distance),best=candidates[0];
  const y=interpolateState(a,b,best.t),body=ephem.body(target,startDay+best.t);
  return {...best,y,target:body.r,relativeSpeed:V.norm(V.sub(y.slice(3),body.v))*MS};
}
export function closestEncounter(ephem,target,startDay,track){
  let best={distance:Infinity,t:0},index=0;
  for(let i=0;i<track.length;i++){const d=V.norm(V.sub(track[i].y.slice(0,3),ephem.body(target,startDay+track[i].t).r))*AU;if(d<best.distance){best={distance:d,t:track[i].t,y:track[i].y,target:ephem.body(target,startDay+track[i].t).r};index=i;}}
  for(let i=Math.max(0,index-2);i<Math.min(track.length-1,index+2);i++){const q=encounterBetween(ephem,target,startDay,track[i],track[i+1]);if(q.distance<best.distance)best=q;}
  const body=ephem.body(target,startDay+best.t);
  return {...best,relativeSpeed:V.norm(V.sub(best.y.slice(3),body.v))*MS};
}
export function localBasis(ephem,level,day,state){
  const origin=ephem.body(level.id==='moon'?'earth':'sun',day),r=V.sub(state.slice(0,3),origin.r),v=V.sub(state.slice(3),origin.v),forward=V.unit(v);
  let normal=V.unit(V.cross(r,v));if(V.norm(V.cross(r,v))<1e-15)normal=[0,0,1];
  const right=V.unit(V.cross(forward,normal));normal=V.unit(V.cross(right,forward));return {forward,right,normal};
}
