import {VERSION} from './config.js';
import {AI_DISCLOSURE} from './mission.js';
import {calculateMissionScore,missionReview} from './mission-score.js';
import {planElements} from './research/mission-viz.js';

export function newFlightId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const s=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export function makeFlightRecord(flight,{playerId,flightId,launch,plan,ephemeris,trajectoryAnalysis=null}){
  const r=flight.snapshot(),c=flight.craft;
  if(!trajectoryAnalysis){try{trajectoryAnalysis=planElements({plan,level:flight.level,ephemeris});}catch(error){trajectoryAnalysis={status:'Unavailable',reason:error.message};}}
  Object.assign(r,{release:VERSION,gameVersion:VERSION,playerId,flightId,aiAssistance:AI_DISCLOSURE,
    launch:{...launch},trajectory:plan?{model:plan.model,closest:plan.closest,good:plan.good,closestTime:plan.closestTime,near:plan.near}:null,
    spacecraft:{kit:{...c.kit},engine:c.engine.name,hull:c.hull.name,power:c.power.name,instrument:c.mission.instrument.name,radio:c.mission.radio.name,launcher:c.mission.launcher.name,mission:{...c.mission.selection},budget:c.mission.budget,totalCost:c.price,multiplier:c.multiplier,maxFuel:c.maxFuel,maxEnergy:c.maxEnergy,wetMass:c.dryMass+c.maxFuel},
    telemetry:{minEnergy:flight.minEnergy,maxProgress:flight.maxProgress},arcadeLedger:structuredClone(flight.scoreLedger),trajectoryAnalysis,
    baseScore:Math.round(flight.score),threeDBonus:Math.round(flight.totalScore)-Math.round(flight.score),threeDSeconds:flight.pilot3D?.activeSeconds??0});
  if(flight.navigation?.isStar){r.earthTime=flight.navigation.earthTime;r.shipTime=flight.navigation.shipTime;r.starBeta=flight.navigation.leg.beta;}
  r.missionScore=calculateMissionScore(r,c);
  for(const key of ['scoreVersion','arcadeScore','missionBonus','totalScore','missionGrade','missionComplete'])r[key]=r.missionScore[key];
  r.review=missionReview(r,c,r.missionScore);
  // Keep record.score as the original arcade score for legacy callers.
  return r;
}
