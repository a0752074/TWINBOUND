import {LEVELS,buildCraft,clamp} from './config.js';
import {BUDGETS,OBJECTIVES,RADIOS,LAUNCHERS,configureMission,designChecks} from './mission.js';

export const SCORE_VERSION='10.3.0-1';
// Fixed at 60% of the successful-run median in mission-score-calibration.json.
export const LEVEL_BONUS_CAPS=Object.freeze({moon:9960,mars:22636,pluto:31204,proxima:48866});
const unit=x=>Number.isFinite(x)?clamp(x,0,1):0;
const benchmarks=new Map();
export function costBenchmarks(levelId,objective){
  const key=levelId+':'+objective;if(benchmarks.has(key))return benchmarks.get(key);
  const costs=[];
  if(!OBJECTIVES[objective])return {minimumValidCost:0,referenceCost:0,validDesigns:0};
  for(let engine=0;engine<3;engine++)for(let hull=0;hull<3;hull++)for(let power=0;power<3;power++)for(const radio of Object.keys(RADIOS))for(const launcher of Object.keys(LAUNCHERS)){
    const c=configureMission(buildCraft({engine,hull,power}),{objective,instrument:OBJECTIVES[objective].instrument,radio,launcher,budget:'expanded'},levelId);
    if(c.mission.selection.objective===objective&&designChecks(c,0).every(x=>x.pass))costs.push(c.price);
  }
  costs.sort((a,b)=>a-b);const n=costs.length,m=Math.floor(n/2);
  const result=Object.freeze({minimumValidCost:costs[0]??0,referenceCost:n?(n%2?costs[m]:(costs[m-1]+costs[m])/2):0,validDesigns:n,referenceBudget:BUDGETS.expanded});
  benchmarks.set(key,result);return result;
}
export function scienceReturn(report,levelId){
  if(!report)return {creditedMB:0,fraction:0};
  const s=report.selection,compatible=OBJECTIVES[s?.objective]?.instrument===s?.instrument;
  const produced=report.generatedMB>0&&report.exposureControlSeconds>0;
  const archived=report.storedMB+report.transmittedMB;
  const creditedMB=compatible&&produced?Math.max(0,levelId==='proxima'?archived:report.receivedMB):0;
  return {creditedMB,fraction:report.requiredMB>0?unit(creditedMB/report.requiredMB):0};
}
// Pure arithmetic over a frozen flight record and the existing design rules.
// No UI state, Combo, equipment multiplier, clicks, or database access.
export function calculateMissionScore(record,craft){
  if(!Number.isFinite(record.score)||record.score<0)throw Error('A finite non-negative Arcade Score is required.');
  const s=record.science,p=unit(record.telemetry?.maxProgress??record.navigation?.progress??0);
  const checks=craft?.mission?designChecks(craft,record.navigation?.simulatedDays??0):[];
  const R=checks.length?checks.filter(x=>x.pass).length/checks.length:0;
  const batteryHealth=unit((record.telemetry?.minEnergy??0)/(craft.maxEnergy*.2));
  const fuelHealth=unit(record.fuel/(craft.maxFuel*.2));
  const dataIntegrity=s?.generatedMB>0?unit(1-s.droppedMB/s.generatedMB):0;
  const E=.40*batteryHealth+.35*fuelHealth+.25*dataIntegrity;
  const {creditedMB,fraction:D}=scienceReturn(s,record.level);
  const F=record.status==='arrived'&&checks.length>0&&checks.every(x=>x.pass)&&creditedMB+1e-9>=(s?.requiredMB??Infinity)?1:0;
  const baseline=costBenchmarks(record.level,craft.mission.selection.objective),den=baseline.referenceCost-baseline.minimumValidCost;
  const C=F&&den>0?unit((baseline.referenceCost-craft.price)/den):0;
  const contributions={design:.15*p*R,engineering:.20*p*E,science:.60*D,cost:.05*F*C};
  const quality=unit(Object.values(contributions).reduce((a,b)=>a+b,0)),cap=LEVEL_BONUS_CAPS[record.level]??0;
  const missionBonus=Math.round(cap*quality),arcadeScore=record.score;
  const missionGrade=F?(quality>=.9?'A':quality>=.75?'B':'C'):D>0?'Partial':'No return';
  return {scoreVersion:SCORE_VERSION,arcadeScore,missionBonus,totalScore:arcadeScore+missionBonus,missionGrade,missionComplete:Boolean(F),quality,cap,p,R,E,D,F,C,creditedMB,batteryHealth,fuelHealth,dataIntegrity,contributions,costBaseline:baseline,designChecks:checks};
}
export function missionReview(record,craft,score){
  const good=[],limited=[],next=[],s=record.science;
  if(record.status==='arrived')good.push('Reached the destination within its flyby tolerance.');
  else {limited.push(record.reason||'The flight ended before arrival.');next.push(record.stability<60?'Use shorter burns and follow course guidance.':'Reach the destination to complete the navigation requirement.');}
  if(score.D>=1)good.push(`${record.level==='proxima'?'Onboard archive':'Earth receipts'} met the ${s.requiredMB} MB science target.`);
  else {limited.push(`Valid science return: ${score.creditedMB.toFixed(2)} of ${s.requiredMB} MB.`);}
  for(const c of score.designChecks.filter(c=>!c.pass)){
    limited.push(c.label+'.');
    next.push(({instrument:`Select ${OBJECTIVES[craft.mission.selection.objective].instrument} for this objective.`,mass:'Choose a lighter spacecraft or the dedicated injection service.',budget:'Reduce equipment cost or choose a budget that covers this design.',lifetime:'Choose a shorter transfer or a different launch date.'})[c.id]);
  }
  if(s.droppedMB>1e-6){limited.push(`${s.droppedMB.toFixed(2)} MB lost because storage was full.`);next.push('Compare the high-gain radio to empty storage more quickly.');}
  if(s.inTransitMB>0&&score.D<1&&record.level!=='proxima'){limited.push(`${s.inTransitMB.toFixed(2)} MB was still in transit at flight end.`);next.push('Compare a higher-rate radio or an earlier observation window; in-transit data earns no Earth-return credit.');}
  if(score.batteryHealth<1){limited.push(`Lowest battery reserve: ${record.telemetry.minEnergy.toFixed(1)} Wh.`);next.push('Choose more battery capacity or collect energy before the battery runs low.');}
  if(score.fuelHealth<1){limited.push(`Fuel reserve: ${record.fuel.toFixed(1)} kg.`);next.push('Use short burns, coast between maneuvers, and collect fuel.');}
  if(s.exposureControlSeconds<=0)next.push('Stay on course until the spacecraft enters its science observation window.');
  if(score.batteryHealth===1)good.push('Battery reserve stayed above the 20% game threshold.');
  if(score.F&&score.C>0)good.push('A qualifying lower-cost design earned a cost-efficiency bonus.');
  if(!next.length)next.push('Compare a lower-cost qualifying design while preserving science return and resource reserves.');
  return {good,limited,next:[...new Set(next)]};
}
