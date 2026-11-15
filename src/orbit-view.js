// Geometry in the map's translated (Earth/Sun), non-rotating frame.
// Positions are km, times seconds and derivatives km/s. No flight state is
// modified to fit the illustration or the deliberately oversized planet art.
import {clamp,C} from './config.js';
import {direction} from './dynamics.js';

export function shipSegment(a,b){
  const dt=b.t-a.t;
  const chord=a.ship.map((x,j)=>(b.ship[j]-x)/Math.max(dt,1e-30));
  const va=a.shipVelocity||chord,vb=b.shipVelocity||chord;
  return [a.ship,a.ship.map((x,j)=>x+va[j]*dt/3),b.ship.map((x,j)=>x-vb[j]*dt/3),b.ship];
}

export function sampleSegment(control,u){
  const [a,b,c,d]=control,v=1-u;
  return {
    r:a.map((x,j)=>v*v*v*x+3*v*v*u*b[j]+3*v*u*u*c[j]+u*u*u*d[j]),
    tangent:a.map((x,j)=>3*v*v*(b[j]-x)+6*v*u*(c[j]-b[j])+3*u*u*(d[j]-c[j]))
  };
}

// Put the glyph on the real curve. If its initial state is hidden inside the
// enlarged Earth icon, locate the first visible point on that same curve.
export function departureGlyph(points,map,vertical,earth,radius=25){
  const projected=p=>map(p),first=projected(points[0].ship),clearance=radius+14;
  let fallback=null;
  for(let i=1;i<points.length;i++){
    const control=shipSegment(points[i-1],points[i]);
    const at=u=>{const q=sampleSegment(control,u),p=projected(q.r);return {x:p[0],y:p[1],dx:q.tangent[0],dy:-q.tangent[vertical],magnitude:Math.hypot(...q.tangent),segment:i-1,u};};
    let previous=0;
    for(let k=0;k<=16;k++){
      const u=k/16,q=at(u),visible=Math.hypot(q.x-earth[0],q.y-earth[1])>=clearance;
      if(Math.hypot(q.dx,q.dy)>Math.max(1e-18,q.magnitude*1e-10)){
        fallback??=q;
        if(visible){
          let lo=previous,hi=u;
          if(k>0)for(let n=0;n<36;n++){const m=(lo+hi)/2,p=at(m);if(Math.hypot(p.x-earth[0],p.y-earth[1])>=clearance)hi=m;else lo=m;}
          const anchor=at(hi),length=Math.hypot(anchor.dx,anchor.dy);
          if(length>1e-18)return {...anchor,dx:anchor.dx/length,dy:anchor.dy/length};
        }
      }
      previous=u;
    }
  }
  // A projection can collapse to a point (e.g. Proxima along Y in XZ).
  // A fabricated radial arrow would falsely imply motion in that plane.
  if(!fallback)return null;
  const length=Math.hypot(fallback.dx,fallback.dy);
  return {...fallback,x:first[0],y:first[1],dx:fallback.dx/length,dy:fallback.dy/length};
}

export function projectedLaunch(settings,offset=[0,0,0],projection='xy',stellar=false){
  const speed=settings.speed*(stellar?C/1000:1),v=direction(settings.heading,settings.pitch).map((x,i)=>x*speed+offset[i]);
  return [v[0],v[projection==='xy'?1:2]];
}

// The sliders still specify Earth-relative injection speed and direction.
// A heliocentric arrow includes Earth's orbital velocity, so dragging must
// solve the inverse projection rather than assign atan2(totalV) to heading.
export function steerLaunch(settings,offset,projection,angle,speed,stellar=false){
  const key=projection==='xy'?'heading':'pitch',lo=key==='heading'?0:-45,hi=key==='heading'?360:45;
  const ux=Math.cos(angle),uy=Math.sin(angle),current=settings[key];
  const cost=value=>{
    const v=projectedLaunch({...settings,speed,[key]:value},offset,projection,stellar),n=Math.hypot(...v);
    return n>1e-14?1-(v[0]*ux+v[1]*uy)/n:2;
  };
  let best=clamp(current,lo,hi),error=cost(best);
  const distance=x=>key==='heading'?Math.abs(((x-current+540)%360)-180):Math.abs(x-current);
  // Include the current exact solution to avoid a jump on pointer-down.
  for(let value=lo;value<=hi;value+=1){const q=cost(value);if(q<error-1e-13||(Math.abs(q-error)<=1e-13&&distance(value)<distance(best))){best=value;error=q;}}
  let a=Math.max(lo,best-1),b=Math.min(hi,best+1);
  for(let i=0;i<40;i++){const c=a+(b-a)/3,d=b-(b-a)/3;if(cost(c)<cost(d))b=d;else a=c;}
  const candidate=(a+b)/2;
  if(cost(candidate)<error-1e-14)best=candidate;
  return {[key]:key==='heading'?(best+360)%360:best,speed};
}
