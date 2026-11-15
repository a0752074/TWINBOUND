import {NAVIGATION,clamp} from '../config.js';
import {INSTRUMENTS,RADIOS,configureMission,designChecks,ScienceOperations} from '../mission.js';
import {Navigation} from '../navigation.js';
import {AU,DAY,MS,V,atTime,direction} from '../dynamics.js';
import {relativisticLeg} from '../orbit.js';
import {cite,assumption} from './sources.js';

export const remainingDeltaV=(craft,fuel=craft.maxFuel)=>Navigation.prototype.remainingDV.call({craft},fuel);
export function tradeStudy({level,baseCraft,profile,plan,ephemeris}){
  const craft=configureMission(baseCraft,profile,level.id),m=craft.mission,seconds=NAVIGATION[level.id].playSeconds;
  const physicalDays=level.id==='proxima'?plan.duration/DAY:plan.goalDay;
  const nav={isStar:level.id==='proxima',day:plan.departure??0,startDay:plan.departure??0,stability:100,progress:0,status:'flying',state:plan.initial?.slice()??[0,0,0,0,0,0],targetDistance:level.distance,ephem:ephemeris};
  const leg=nav.isStar?relativisticLeg(level.distance,plan.settings.speed):null,axis=nav.isStar?direction(plan.settings.heading,plan.settings.pitch):null;
  const science=new ScienceOperations(level,craft,nav);let energy=craft.maxEnergy,minEnergy=energy,usedWh=0,observedSeconds=0;
  for(let t=0;t<seconds-1e-9;t+=.25){
    const dt=Math.min(.25,seconds-t),fraction=Math.min(1,(t+dt)/seconds);nav.progress=fraction;nav.day=nav.startDay+fraction*physicalDays;
    if(nav.isStar){const q=leg.sample(fraction);nav.state=[...V.scale(axis,q.distance/AU),...V.scale(axis,q.beta*299792.458/(AU/DAY))];nav.targetDistance=Math.max(0,level.distance-q.distance);}
    else {nav.state=atTime(plan.track,fraction*physicalDays);nav.targetDistance=V.norm(V.sub(nav.state.slice(0,3),ephemeris.body(level.id,nav.day).r))*AU;}
    const load=1800+science.step(dt,energy);usedWh+=load*dt/3600;energy=clamp(energy+(craft.power.generation-load)*dt/3600,0,craft.maxEnergy);minEnergy=Math.min(minEnergy,energy);observedSeconds=t+dt;
    if(energy<=0)break;
  }
  const projection=science.report(energy>0&&plan.good?'arrived':'failed'),checks=designChecks(craft,physicalDays),endRate=science.rateMBps;
  return {schema:'twinbound-trade-study-v1',id:[level.id,m.selection.objective,m.selection.instrument,m.selection.radio,m.selection.launcher,m.selection.budget].join('-'),selection:{level:level.id,kit:{...craft.kit},...m.selection},
    mass:{dryKg:craft.dryMass,propellantKg:craft.maxFuel,wetKg:craft.dryMass+craft.maxFuel,payloadKg:m.instrument.mass,radioKg:m.radio.mass,capacityKg:m.launcher.capacityKg,marginKg:m.launcher.capacityKg-craft.dryMass-craft.maxFuel},
    propulsion:{thrustN:craft.engine.thrust,ispSeconds:craft.engine.isp,initialDeltaVMS:remainingDeltaV(craft),busOnlyDeltaVMS:remainingDeltaV(baseCraft),payloadPenaltyMS:remainingDeltaV(baseCraft)-remainingDeltaV(craft)},
    power:{generationW:craft.power.generation,batteryWh:craft.maxEnergy,baseLoadW:1800,thrusterPeakExtraW:600,instrumentW:m.instrument.powerW,radioW:m.radio.powerW,coastObservationPeakW:1800+m.instrument.powerW+m.radio.powerW,projectedLoadWh:usedWh,endBatteryWh:energy,minBatteryWh:minEnergy,operationsControlSeconds:observedSeconds,timeBasis:'Control seconds; fixed generation; no pickups or thrust'},
    communications:{rateAtOneAU_MBps:m.radio.rateAtAU,rateCapMBps:m.radio.maxMBps,endRateMBps:endRate,endRangeKm:projection.distanceToEarthKm,endLightSeconds:projection.oneWayLightSeconds,receivedMB:projection.receivedMB,inTransitMB:projection.inTransitMB,solarOccultationAtEnd:projection.linkBlockedBySun},
    storage:{capacityMB:m.instrument.storageMB,generatedMB:projection.generatedMB,storedMB:projection.storedMB,droppedMB:projection.droppedMB,transmittedMB:projection.transmittedMB},
    cost:{designUSD:craft.price,capUSD:m.budget,marginUSD:m.budget-craft.price,reserveFractionOfCost:(m.budget-craft.price)/craft.price},
    feasibility:{designChecks:checks,projectedScienceComplete:projection.complete,powerSurvives:energy>0,referenceTrajectoryGood:plan.good,feasibleInStudy:projection.complete&&energy>0,scope:'Projection on the unchanged reference track, without maneuvers, obstacles or pickups; not an observed player outcome.'},
    numericalInputs:{engine:assumption({...craft.engine},'mixed','src/config.js:EQUIPMENT.engine'),hull:assumption({...craft.hull},'mixed','src/config.js:EQUIPMENT.hull'),power:assumption({...craft.power},'mixed','src/config.js:EQUIPMENT.power'),instrument:assumption({...m.instrument},'mixed','src/mission.js:INSTRUMENTS'),radio:assumption({...m.radio},'mixed','src/mission.js:RADIOS'),launcher:assumption({...m.launcher},'mixed','src/mission.js:LAUNCHERS'),budget:assumption(m.budget,'USD','src/mission.js:BUDGETS')},
    projection,source:cite('mdl'),reusedFunctions:['configureMission','designChecks','ScienceOperations.step','ScienceOperations.report','Navigation.remainingDV','atTime','linkGeometry','downlinkRate'],physicalDurationDays:physicalDays,readOnlyAnalysis:true};
}
export function tradeAlternatives(context){return Object.keys(INSTRUMENTS).flatMap(instrument=>Object.keys(RADIOS).map(radio=>tradeStudy({...context,profile:{...context.profile,instrument,radio}})));}
