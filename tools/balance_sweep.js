// A developer smoke controller, not a player feature or a guarantee of fairness.
// It uses the same generated objects, resource consumption and collision rules.
import {Flight} from '../src/physics.js';
import {LEVELS,buildCraft} from '../src/config.js';
import {Navigation} from '../src/navigation.js';
export function simulateWithPilot(level,seed,kit={engine:2,hull:2,power:2},context){
  if(!context)throw Error('v10 balance tests require the actual JPL plan and ephemeris.');
  const craft=context.craft||buildCraft(kit),f=new Flight(level,craft,seed,new Navigation(level,context.plan,context.eph,craft));let target=0;
  for(let i=0;i<48000&&f.status==='playing';i++){
    if(i%3===0){
      target=f.x;let danger=null,best=0;
      const ahead=f.objects.filter(o=>o.y>f.y-10&&o.y<f.y+f.vy*4.5);
      const pickup=ahead.filter(o=>(o.kind==='fuel'&&f.fuel/f.craft.maxFuel<.7)||(o.kind==='energy'&&f.energy/f.craft.maxEnergy<.65)||(o.kind==='repair'&&f.health<f.craft.maxHealth)).sort((a,b)=>a.y-b.y)[0];
      if(pickup&&Math.abs(pickup.x-f.x)<230)target=pickup.x;
      for(const o of ahead.filter(o=>['rock','ice','comet','hole'].includes(o.kind))){
        const t=(o.y-f.y)/(f.vy-o.vy),dx=f.x+f.vx*t-(o.x+o.vx*t),radius=o.kind==='hole'?170:o.radius+45;
        if(t<3&&Math.abs(dx)<radius){const risk=(3-t)*(radius-Math.abs(dx));if(risk>best){best=risk;danger=o;}}
      }
      if(danger){const side=(f.x+f.vx*.5)<danger.x?-1:1;target=danger.x+side*(danger.kind==='hole'?260:danger.radius+66);}
    }
    const desired=Math.max(-100,Math.min(100,(target-f.x)*1.8)),dv=desired-f.vx;
    f.step({left:dv< -8,right:dv>8},1/30);f.events=[];
  }
  return f.snapshot();
}
if(process.argv[1]?.endsWith('balance_sweep.js')){
  const {eph,getPlan}=await import('../tests/helpers.js');
  const records=LEVELS.flatMap(l=>[12,77].map(seed=>simulateWithPilot(l,seed,{engine:2,hull:2,power:2},{eph,plan:getPlan(l.id)})));
  console.table(records.map(r=>({level:r.level,seed:r.seed,status:r.status,seconds:Math.round(r.time),score:r.score,hits:r.hits,collected:r.collected})));
}
