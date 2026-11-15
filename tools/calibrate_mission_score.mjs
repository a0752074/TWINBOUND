// Reproducible game-balance evidence. No points, pickups or health are injected.
import fs from 'node:fs';
import {LEVELS,buildCraft} from '../src/config.js';
import {configureMission} from '../src/mission.js';
import {eph,getPlan} from '../tests/helpers.js';
import {flySample} from './balance_pilot.mjs';
const records=[];
for(const level of LEVELS){
  for(const kit of [{engine:0,hull:0,power:0},{engine:1,hull:1,power:1},{engine:2,hull:2,power:2}])for(const seed of [12,77,429]){
    const craft=configureMission(buildCraft(kit),{launcher:'dedicated',budget:'expanded'},level.id);
    const r=flySample(level,craft,seed,getPlan(level.id,'2026-11-14'),eph);
    records.push({level:level.id,seed,kit,status:r.status,reason:r.reason,arcadeScore:r.score,seconds:r.time,collected:r.collected,hits:r.hits,sciencePercent:r.science.sciencePercent});
    console.log(JSON.stringify(records.at(-1)));
  }
}
const median=a=>{const b=a.slice().sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const levels=Object.fromEntries(LEVELS.map(l=>{
  const all=records.filter(r=>r.level===l.id),success=all.filter(r=>r.status==='arrived');
  return [l.id,{samples:all.length,arrivals:success.length,failures:all.length-success.length,medianSuccessfulArcade:success.length?median(success.map(r=>r.arcadeScore)):null,suggestedBonusCap:success.length?Math.round(median(success.map(r=>r.arcadeScore))*.6):null}];
}));
const report={date:new Date().toISOString(),baseline:'Unchanged v10.2 arcade formula; v10.3 observation telemetry and 3D visibility correction do not affect these 2D runs',launchDate:'2026-11-14',controller:'tools/balance_pilot.mjs',stepSeconds:1/30,seeds:[12,77,429],modes:['2d'],assumptions:'A deterministic smoke pilot is a repeatable balancing sample, not a human difficulty or fairness guarantee.',records,levels};
fs.writeFileSync(new URL('../data/validation/mission-score-calibration.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(levels,null,2));
