import {C, G0, clamp} from './config.js';
import {AU, DAY, V} from './dynamics.js';

// Tutorial equipment values are design assumptions, not NASA hardware specifications.
export const INSTRUMENTS = {
  camera: {name:'Survey camera', mass:12, powerW:65, dataMBps:.12, price:80000, storageMB:32, measures:'visible imaging'},
  spectrometer: {name:'Imaging spectrometer', mass:28, powerW:210, dataMBps:.4, price:280000, storageMB:64, measures:'spectral composition'},
  magnetometer: {name:'Fields and particles package', mass:8, powerW:35, dataMBps:.045, price:60000, storageMB:16, measures:'local environment'},
  clock: {name:'Clock comparison package', mass:6, powerW:25, dataMBps:.025, price:75000, storageMB:16, measures:'elapsed proper time'}
};
export const RADIOS = {
  compact: {name:'Compact radio', mass:7, powerW:45, price:45000, rateAtAU:.8, maxMBps:.25},
  dish: {name:'High-gain radio', mass:19, powerW:160, price:150000, rateAtAU:12, maxMBps:1.2}
};
export const LAUNCHERS = {
  shared: {name:'Shared injection service', capacityKg:650, extraCost:0},
  dedicated: {name:'Dedicated injection service', capacityKg:1100, extraCost:350000}
};
export const BUDGETS = {lean:1600000, expanded:3500000};
export const OBJECTIVES = {
  imaging: {name:'Map visible features', instrument:'camera', requiredMB:2, deliverable:'A visible-light flyby survey'},
  composition: {name:'Compare surface composition', instrument:'spectrometer', requiredMB:6, deliverable:'A spectral composition survey'},
  environment: {name:'Measure the local environment', instrument:'magnetometer', requiredMB:1, deliverable:'An in-situ fields and particles record'},
  clocks: {name:'Compare Earth and onboard clocks', instrument:'clock', requiredMB:.5, deliverable:'An onboard record of the ideal relativistic journey'}
};
const SCENARIOS = {
  moon: {objectives:['imaging','composition','environment'], rangeKm:200000, maxDays:20},
  mars: {objectives:['imaging','composition','environment'], rangeKm:50000000, maxDays:365.25*3},
  pluto: {objectives:['imaging','composition','environment'], rangeKm:2000000000, maxDays:365.25*20},
  proxima: {objectives:['clocks','environment'], rangeKm:Infinity, maxDays:365.25*50}
};
export const AI_DISCLOSURE = {
  tools:['OpenAI ChatGPT / Codex'],
  use:'Extensive code implementation, revision, testing, English localization and documentation assistance.',
  data:'NASA/JPL ephemerides and credited archive images retain their original provenance.',
  provenance:'Technical sources: docs/NASA_RESOURCES.md. Development credits: docs/AI_USAGE.md.'
};
export const RESOURCE_IDS = ['jpl-horizons','mission-development','mission-design-lab','cubesat-101','telescope-game','concept-maturity'];
export function objectivesFor(levelId) {return SCENARIOS[levelId].objectives;}
export function normalizeMission(profile,levelId) {
  const allowed=objectivesFor(levelId),objective=allowed.includes(profile?.objective)?profile.objective:allowed[0];
  return {
    objective,
    instrument: Object.hasOwn(INSTRUMENTS,profile?.instrument)?profile.instrument:OBJECTIVES[objective].instrument,
    radio: Object.hasOwn(RADIOS,profile?.radio)?profile.radio:'dish',
    launcher: Object.hasOwn(LAUNCHERS,profile?.launcher)?profile.launcher:'shared',
    budget: Object.hasOwn(BUDGETS,profile?.budget)?profile.budget:'lean'
  };
}
export function configureMission(base,profile,levelId) {
  const selection=normalizeMission(profile,levelId),instrument=INSTRUMENTS[selection.instrument],radio=RADIOS[selection.radio],launcher=LAUNCHERS[selection.launcher];
  const mission={selection,objective:OBJECTIVES[selection.objective],instrument,radio,launcher,budget:BUDGETS[selection.budget],scenario:SCENARIOS[levelId],resourceIds:RESOURCE_IDS};
  return {...base,mission,dryMass:base.dryMass+instrument.mass+radio.mass,price:base.price+instrument.price+radio.price+launcher.extraCost};
}
export function designChecks(craft,durationDays=0) {
  const m=craft.mission;
  return [
    {id:'instrument',label:'Instrument matches the science objective',pass:OBJECTIVES[m.selection.objective].instrument===m.selection.instrument},
    {id:'mass',label:'Wet mass fits the injection service',pass:craft.dryMass+craft.maxFuel<=m.launcher.capacityKg},
    {id:'budget',label:'Design stays within the selected budget',pass:craft.price<=m.budget},
    {id:'lifetime',label:'Planned duration fits the scenario lifetime',pass:durationDays<=m.scenario.maxDays}
  ];
}
export function linkGeometry(navigation) {
  if(!navigation)return {distanceKm:0,blocked:false};
  if(navigation.isStar)return {distanceKm:V.norm(navigation.state.slice(0,3))*AU,blocked:false};
  const r=navigation.state.slice(0,3),earth=navigation.ephem.body('earth',navigation.day).r,sun=navigation.ephem.body('sun',navigation.day).r;
  const line=V.sub(earth,r),l2=V.dot(line,line),u=l2?V.dot(V.sub(sun,r),line)/l2:0;
  const solarMissKm=V.norm(V.sub(V.add(r,V.scale(line,clamp(u,0,1))),sun))*AU;
  return {distanceKm:V.norm(line)*AU,blocked:u>0&&u<1&&solarMissKm<695700};
}
export function downlinkRate(radio,distanceKm,blocked=false) {
  return blocked?0:Math.min(radio.maxMBps,radio.rateAtAU/Math.max(.01,distanceKm/AU)**2);
}

export class ScienceOperations {
  constructor(level,craft,navigation) {
    this.level=level;this.craft=craft;this.navigation=navigation;this.design=craft.mission;
    this.generatedMB=0;this.storedMB=0;this.transmittedMB=0;this.receivedMB=0;this.droppedMB=0;
    this.exposureSeconds=0;this.operationsSeconds=0;this.powerWh=0;this.packets=[];this.packetHead=0;this.pendingMB=0;
    this.geometry=linkGeometry(navigation);this.geometryClock=0;this.packetClock=0;this.observing=false;
    this.rateMBps=0;this.extraPowerW=0;this.lightSeconds=this.geometry.distanceKm/(C/1000);
  }
  receive() {
    const day=this.navigation?.day??0;
    while(this.packetHead<this.packets.length&&this.packets[this.packetHead].receiveDay<=day+1e-12) {
      this.receivedMB+=this.packets[this.packetHead++].mb;
    }
    if(this.packetHead>128){this.packets.splice(0,this.packetHead);this.packetHead=0;}
  }
  step(dt,energyWh) {
    const n=this.navigation,m=this.design;if(!n||dt<=0)return 0;
    this.operationsSeconds+=dt;this.geometryClock+=dt;this.packetClock+=dt;
    if(this.geometryClock>=.25){this.geometry=linkGeometry(n);this.geometryClock=0;}
    this.lightSeconds=this.geometry.distanceKm/(C/1000);
    this.receive();
    // Mission operations use control seconds, matching the existing energy economy.
    // Propagation delay alone uses the trajectory's physical TDB clock.
    this.observing=energyWh>.02&&n.stability>20&&(n.isStar?n.progress>.2:n.targetDistance<=m.scenario.rangeKm);
    let powerW=0;
    if(this.observing) {
      powerW+=m.instrument.powerW;this.exposureSeconds+=dt;
      const produced=m.instrument.dataMBps*dt,accepted=Math.min(produced,Math.max(0,m.instrument.storageMB-this.storedMB));
      this.generatedMB+=produced;this.storedMB+=accepted;this.droppedMB+=produced-accepted;
    }
    this.rateMBps=energyWh>.02?downlinkRate(m.radio,this.geometry.distanceKm,this.geometry.blocked):0;
    const sent=Math.min(this.storedMB,this.rateMBps*dt);
    if(sent>0){this.storedMB-=sent;this.transmittedMB+=sent;this.pendingMB+=sent;powerW+=m.radio.powerW;}
    if(this.packetClock>=.25||n.status!=='flying') {
      if(this.pendingMB>0){this.packets.push({mb:this.pendingMB,receiveDay:n.day+this.lightSeconds/DAY});this.pendingMB=0;}
      this.packetClock=0;
    }
    this.extraPowerW=powerW;this.powerWh+=powerW*dt/3600;
    return powerW;
  }
  report(status='playing') {
    this.receive();
    const m=this.design,n=this.navigation,compatible=OBJECTIVES[m.selection.objective].instrument===m.selection.instrument;
    const archivedMB=this.storedMB+this.transmittedMB,creditedMB=compatible?(n?.isStar?archivedMB:this.receivedMB):0;
    const checks=designChecks(this.craft,(n?.day??0)-(n?.startDay??0));
    checks.push({id:'arrival',label:'Spacecraft reached the destination',pass:status==='arrived'});
    checks.push({id:'science',label:n?.isStar?'Required observations recorded onboard':'Required science data received on Earth',pass:creditedMB+1e-9>=m.objective.requiredMB});
    return {
      objective:m.objective.name,deliverable:m.objective.deliverable,selection:{...m.selection},
      checks,complete:checks.every(c=>c.pass),sciencePercent:clamp(creditedMB/m.objective.requiredMB*100,0,100),
      requiredMB:m.objective.requiredMB,generatedMB:this.generatedMB,storedMB:this.storedMB,transmittedMB:this.transmittedMB,
      receivedMB:this.receivedMB,inTransitMB:Math.max(0,this.transmittedMB-this.receivedMB),droppedMB:this.droppedMB,
      exposureControlSeconds:this.exposureSeconds,extraEnergyWh:this.powerWh,oneWayLightSeconds:this.lightSeconds,
      distanceToEarthKm:this.geometry.distanceKm,linkBlockedBySun:this.geometry.blocked,rateMBps:this.rateMBps,
      wetMassKg:this.craft.dryMass+this.craft.maxFuel,injectionCapacityKg:m.launcher.capacityKg,
      designCostUSD:this.craft.price,budgetUSD:m.budget,initialDeltaVMS:this.craft.engine.isp*G0*Math.log((this.craft.dryMass+this.craft.maxFuel)/this.craft.dryMass),
      resourceIds:RESOURCE_IDS,
      interpretation:n?.isStar?'Ideal interstellar demonstration; science completion uses an onboard archive. Earth delivery is reported separately.':'Educational flyby mission. Science completion requires data received before the end of the flight.',
      timeModel:'Data rates, exposure and power use active control seconds; packet propagation uses physical TDB days. Continuous ground access except solar occultation. Rates and equipment values are tutorial assumptions.'
    };
  }
}
