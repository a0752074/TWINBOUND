export const COCKPIT_BONUS_RATE=.25;
export function objectDepth(object,seed){
  if(Number.isFinite(object.z))return object.z;
  if(object.id===1)return 0;
  let h=Math.imul((object.id^seed)>>>0,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);h=(h^(h>>>16))>>>0;
  return (h/4294967296-.5)*(object.kind==='hole'?240:380);
}
export function segmentDistance3D(a,b){
  const d=b.map((x,i)=>x-a[i]),den=d.reduce((s,x)=>s+x*x,0),t=den?Math.max(0,Math.min(1,-a.reduce((s,x,i)=>s+x*d[i],0)/den)):0;
  return Math.hypot(...a.map((x,i)=>x+d[i]*t));
}
export function createPilot3D(){return {active:true,z:0,vz:0,thrustZ:0,activeSeconds:0,bonus:0};}
export function cockpitGuidance(nav){
  if(!nav?.correction||!nav.basis||nav.rawRisk<=.58)return nav?.guidance??null;
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),vertical=dot(nav.correction,nav.basis.normal),side=dot(nav.correction,nav.basis.right),forward=dot(nav.correction,nav.basis.forward);
  return Math.abs(vertical)>Math.max(2,Math.abs(side),Math.abs(forward))?(vertical>0?'rise':'fall'):nav.guidance;
}
export function perspectivePoint({x,y,z},camera,width,height){
  const depth=y-camera.y;if(depth<=8)return null;
  const focal=Math.min(width*.78,height*1.05),cx=width*.5,cy=height*.43;
  const dx=x-camera.x,dz=z-camera.z,scale=focal/depth;
  return {x:cx+dx*scale,y:cy-dz*scale,scale,depth};
}
// A contact may leave the perspective field of view without ceasing to exist.
// Cues use the same world position as rendering, gravity and swept collisions.
export function cockpitContact(object,seed,camera,width,height){
  const z=objectDepth(object,seed),ahead=object.y-camera.y;
  const point=perspectivePoint({x:object.x,y:object.y,z},camera,width,height);
  const visible=Boolean(point&&point.x>=width*.12&&point.x<=width*.88&&point.y>=55&&point.y<=height*.76);
  let cue=null;
  if(!visible&&ahead>=-object.radius&&ahead<2200){
    const cx=width*.5,cy=height*.43;
    const dx=point?point.x-cx:object.x-camera.x;
    const dy=point?point.y-cy:camera.z-z;
    const vx=dx||0,vy=dy||(ahead<=8?height:1);
    const scale=Math.min(width*.36/Math.max(1,Math.abs(vx)),(vy<0?Math.max(15,cy-65):height*.30)/Math.max(1,Math.abs(vy)));
    cue={x:cx+vx*scale,y:cy+vy*scale,altitude:z-camera.z};
  }
  return {point,visible,cue,z,ahead};
}
