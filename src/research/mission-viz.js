import {V,AU,DAY,atTime} from '../dynamics.js';
import {cite} from './sources.js';

const TAU=2*Math.PI,wrap=x=>(x%TAU+TAU)%TAU,limit=x=>Math.max(-1,Math.min(1,x));
const finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function rotateX(v,a){const c=Math.cos(a),s=Math.sin(a);return [v[0],c*v[1]-s*v[2],s*v[1]+c*v[2]];}
export function rotateY(v,a){const c=Math.cos(a),s=Math.sin(a);return [c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];}
export function rotateZ(v,a){const c=Math.cos(a),s=Math.sin(a);return [c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];}
export function tutorialRotation(v,{pitch=0,yaw=0,roll=0}){return rotateX(rotateZ(rotateY(v,pitch),yaw),roll);}
export function tutorialPoint({a,e,pitch=0,yaw=0,roll=0},E){
  if(!(a>0&&e>=0&&e<1))throw Error('The tutorial ellipse requires a > 0 and 0 <= e < 1.');
  return tutorialRotation([a*(Math.cos(E)-e),a*Math.sqrt(1-e*e)*Math.sin(E),0],{pitch,yaw,roll});
}
export function solveKepler(meanAnomaly,e){
  if(!Number.isFinite(meanAnomaly)||!(e>=0&&e<1))throw Error('Finite mean anomaly and elliptic eccentricity are required.');
  const M=wrap(meanAnomaly);let lo=0,hi=TAU,E=e<.8?M:Math.PI;
  for(let k=0;k<80;k++){
    const residual=E-e*Math.sin(E)-M;if(Math.abs(residual)<2e-14)return E;
    if(residual>0)hi=E;else lo=E;
    const candidate=E-residual/(1-e*Math.cos(E));E=candidate>lo&&candidate<hi?candidate:(lo+hi)/2;
  }
  throw Error('Kepler solver did not converge.');
}
export function elementsToState({a,e,i=0,raan=0,argPeriapsis=0,trueAnomaly=0,p},mu){
  const semilatus=p??a*(1-e*e),denom=1+e*Math.cos(trueAnomaly);
  if(!(mu>0&&semilatus>0&&denom>0))throw Error('Invalid conic parameters.');
  const r=semilatus/denom,q=Math.sqrt(mu/semilatus),orient=v=>rotateZ(rotateX(rotateZ(v,argPeriapsis),i),raan);
  return {r:orient([r*Math.cos(trueAnomaly),r*Math.sin(trueAnomaly),0]),v:orient([-q*Math.sin(trueAnomaly),q*(e+Math.cos(trueAnomaly)),0])};
}
export function stateToElements(r,v,mu){
  if(!finite(r)||!finite(v)||!(mu>0))throw Error('Finite 3D position/velocity and positive GM are required.');
  const radius=V.norm(r),h=V.cross(r,v),H=V.norm(h);if(radius<=0||H<1e-12)throw Error('Radial or zero states have undefined orbital elements.');
  const n=V.cross([0,0,1],h),N=V.norm(n),ev=V.sub(V.scale(V.cross(v,h),1/mu),V.scale(r,1/radius)),e=V.norm(ev),energy=V.dot(v,v)/2-mu/radius;
  const a=Math.abs(energy)>1e-13?-mu/(2*energy):null,i=Math.acos(limit(h[2]/H)),equatorial=N/H<1e-10,circular=e<1e-10;
  const angle=(a,b)=>wrap(Math.atan2(V.dot(V.cross(a,b),h)/H,V.dot(a,b)));
  const raan=equatorial?0:wrap(Math.atan2(n[1],n[0]));
  const argPeriapsis=circular?0:equatorial?wrap(Math.atan2((h[2]<0?-1:1)*ev[1],ev[0])):angle(n,ev);
  const trueAnomaly=circular?(equatorial?wrap(Math.atan2((h[2]<0?-1:1)*r[1],r[0])):angle(n,r)):angle(ev,r);
  const elliptic=e<1&&a>0,E=elliptic?wrap(Math.atan2(Math.sqrt(1-e*e)*Math.sin(trueAnomaly),e+Math.cos(trueAnomaly))):null;
  return {a,e,i,raan,argPeriapsis,trueAnomaly,p:H*H/mu,specificEnergyKm2S2:energy,eccentricAnomaly:E,meanAnomaly:elliptic?wrap(E-e*Math.sin(E)):null,periodSeconds:elliptic?TAU*Math.sqrt(a*a*a/mu):null,conic:elliptic?'elliptic':e>1?'hyperbolic':'parabolic',singularConventions:{equatorial,circular,angles:'Radians; circular periapsis and equatorial RAAN set to zero'}};
}
export function tutorialAngles(elements){
  const orient=v=>rotateZ(rotateX(rotateZ(v,elements.argPeriapsis),elements.i),elements.raan);
  const columns=[[1,0,0],[0,1,0],[0,0,1]].map(orient),m=[0,1,2].map(j=>columns.map(c=>c[j]));
  const yaw=Math.asin(limit(-m[0][1])),cos=Math.cos(yaw);
  if(Math.abs(cos)>1e-10)return {pitch:Math.atan2(m[0][2],m[0][0]),yaw,roll:Math.atan2(m[2][1],m[1][1])};
  const sign=Math.sin(yaw);return {pitch:0,yaw,roll:Math.atan2(sign*m[2][0],sign*m[1][0])};
}
export function planElements({plan,level,ephemeris,timeDays=0}){
  if(level.id==='proxima')return {status:'Not Applicable',reason:'Ideal relativistic trajectory; Newtonian Kepler elements are not used.'};
  const body=level.id==='moon'?'earth':'sun',center=ephemeris.body(body,plan.departure+timeDays),state=atTime(plan.track,timeDays),mu=ephemeris.meta.bodies.find(b=>b.name===body).gm_km3_s2;
  const r=V.scale(V.sub(state.slice(0,3),center.r),AU),v=V.scale(V.sub(state.slice(3),center.v),AU/DAY),elements=stateToElements(r,v,mu);
  return {status:'Analyzed',frame:'Ecliptic J2000',origin:body,timeScale:'TDB',epochJD:ephemeris.meta.start_jd+plan.departure+timeDays,positionKm:r,velocityKmS:v,gmKm3S2:mu,elements,tutorialEuler:elements.conic==='elliptic'?tutorialAngles(elements):null,interpretation:'Instantaneous osculating conic, not a replacement for the 11-body trajectory.'};
}
export function missionVizExport(context){
  const initial=planElements(context);if(initial.status==='Not Applicable')return {schema:'twinbound-mission-viz-v1',...initial,source:cite('viz')};
  const samples=Array.from({length:33},(_,j)=>planElements({...context,timeDays:context.plan.goalDay*j/32}));
  const e=initial.elements,ellipse=e.conic==='elliptic'?Array.from({length:81},(_,j)=>tutorialPoint({a:e.a,e:e.e,...initial.tutorialEuler},TAU*j/80)):[];
  const reconstructed=e.conic==='elliptic'?tutorialPoint({a:e.a,e:e.e,...initial.tutorialEuler},e.eccentricAnomaly):null;
  return {schema:'twinbound-mission-viz-v1',implementation:'Tutorial-derived Implementation',source:cite('viz'),initial,osculatingStates:samples,tutorialEllipsePointsKm:ellipse,tutorialReconstructionErrorKm:reconstructed?V.norm(V.sub(reconstructed,initial.positionKm)):null,columns:['x_km','y_km','z_km'],format:'Project-defined JSON and XYZ CSV; the NASA tutorial does not define an interchange API.',scope:'Flat focus-centered ellipse, sequential Y/Z/X rotations and Kepler timing follow the tutorial method. Classical elements use the standard Z/X/Z orbital convention; an explicit Euler conversion connects the conventions. Independent source implementation; no NASA repository code copied.'};
}
