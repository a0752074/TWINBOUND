// Deterministic look-ahead controller for balance evidence; not shipped as a
// player autopilot. Uses the real Flight, encounters, gravity, fuel and damage.
import {Flight} from '../src/physics.js';
import {Navigation} from '../src/navigation.js';
export function flySample(level,craft,seed,plan,eph){
  const f=new Flight(level,craft,seed,new Navigation(level,plan,eph,craft));
  let target=0;
  for(let i=0;i<48000&&f.status==='playing';i++){
    if(i%4===0){
      const contacts=f.objects.filter(o=>o.y>f.y-60&&o.y<f.y+Math.max(2200,f.vy*9));
      const acceleration=craft.engine.thrust/(craft.dryMass+f.fuel);
      const candidates=[f.x,target,0,...contacts.filter(o=>['fuel','energy','repair'].includes(o.kind)).map(o=>o.x)];
      for(const d of [-500,-320,-180,-90,90,180,320,500])candidates.push(f.x+d);
      const cost=destination=>{
        let x=f.x,v=f.vx,risk=0;
        for(let t=.12;t<8;t+=.12){
          const desired=Math.max(-95,Math.min(95,(destination-x)*1.5)),dv=desired-v;
          const a=Math.abs(dv)>3?Math.sign(dv)*acceleration:0;x+=v*.12+.5*a*.12**2;v+=a*.12;
          for(const o of contacts){
            const dy=o.y+o.vy*t-f.y-f.vy*t,dx=o.x+o.vx*t-x;
            const radius=o.radius+(['rock','ice','comet'].includes(o.kind)?36:o.kind==='hole'?420:28);
            const range=Math.hypot(dx,dy);
            if(['rock','ice','comet','hole'].includes(o.kind)){
              if(range<radius)risk+=(radius-range)**2/(1+t*.3)*(o.kind==='hole'?2:12);
            }else if(range<radius&&t<6){
              const needed=o.kind==='energy'?1-f.energy/craft.maxEnergy:o.kind==='fuel'?1-f.fuel/craft.maxFuel:f.health<craft.maxHealth?.9:0;
              risk-=needed*200/(1+t);
            }
          }
        }
        return risk+Math.abs(destination-f.x)*.035+Math.abs(destination)*.004;
      };
      target=candidates.map(x=>({x,cost:cost(x)})).sort((a,b)=>a.cost-b.cost||Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0].x;
    }
    const desired=Math.max(-95,Math.min(95,(target-f.x)*1.5)),dv=desired-f.vx;
    f.step({left:dv< -3,right:dv>3},1/30);f.events=[];
  }
  return f.snapshot();
}
