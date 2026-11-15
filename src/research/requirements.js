import {designChecks,OBJECTIVES} from '../mission.js';
import {cite} from './sources.js';

const identifiers={instrument:'REQ-SCI-001',mass:'REQ-LAUNCH-001',budget:'REQ-COST-001',lifetime:'REQ-OPS-001',arrival:'REQ-NAV-001',science:'REQ-DATA-001'};
export function requirementsTrace({craft,record,plan}){
  if(!craft?.mission||!record?.science)throw Error('A configured craft and science mission record are required.');
  const m=craft.mission,s=record.science,days=record.navigation?.simulatedDays??0;
  const gameChecks=s.checks,preflight=designChecks(craft,days),measurements={
    instrument:{actual:m.selection.instrument,operator:'equals',expected:OBJECTIVES[m.selection.objective].instrument,units:'instrument ID'},
    mass:{actual:craft.dryMass+craft.maxFuel,operator:'<=',expected:m.launcher.capacityKg,units:'kg'},
    budget:{actual:craft.price,operator:'<=',expected:m.budget,units:'USD'},
    lifetime:{actual:days,operator:'<=',expected:m.scenario.maxDays,units:'TDB days'},
    arrival:{actual:record.status,operator:'equals',expected:'arrived',units:'flight status',targetDistanceKm:record.navigation?.targetKm??null,flybyToleranceKm:plan?.near??null},
    science:{actual:(m.selection.instrument===m.objective.instrument)?(record.level==='proxima'?s.storedMB+s.transmittedMB:s.receivedMB):0,operator:'>=',expected:m.objective.requiredMB,units:'MB',delivery:record.level==='proxima'?'Onboard archive':'Received on Earth',inTransitMB:s.inTransitMB}
  };
  const requirements=gameChecks.map(c=>({
    requirementId:identifiers[c.id]??'REQ-'+c.id.toUpperCase(),scienceGoal:m.objective.name,description:c.label,
    measurableCondition:measurements[c.id],verificationMethod:['instrument','mass','budget','lifetime'].includes(c.id)?'Analysis using the existing designChecks function':'Inspection of the existing ScienceOperations.report and flight result',
    result:c.pass?'Pass':'Fail',passed:c.pass,enforcement:'Existing game rule',
    evidence:{recordField:'science.checks.'+c.id,designSelection:{...m.selection}},
    sources:[cite('development',[10,13,18,19]),...(c.id==='mass'?[cite('cubesat',[27,29],'2.7 Mission Coordination; 2.9 Flight-Specific Documentation')]:[])],
    thresholdOrigin:c.id==='arrival'?'Existing game flyby criterion':'Educational Assumption / existing mission configuration'
  }));
  const contradictions=preflight.filter(c=>gameChecks.find(g=>g.id===c.id)?.pass!==c.pass).map(c=>c.id);
  const scienceCheck=gameChecks.find(c=>c.id==='science');
  if(scienceCheck&&scienceCheck.pass!==(measurements.science.actual+1e-9>=measurements.science.expected))contradictions.push('science');
  if(s.complete!==gameChecks.every(c=>c.pass))contradictions.push('complete');
  return {schema:'twinbound-requirements-v1',scienceGoal:{id:m.selection.objective,name:m.objective.name,deliverable:m.objective.deliverable},missionResults:{status:record.status,originalMissionComplete:s.complete,flightScore:record.score},requirements,alignedWithGame:contradictions.length===0,contradictions,decisionAuthority:'ScienceOperations.report; this trace does not change the game result or score',sources:[cite('development',[8,10,13,18,19])]};
}

export function cubeSatReview({craft,record,plan,trace}){
  const s=record.science,m=craft.mission,checks=[];
  const add=(id,topic,condition,passed,pages,section,details,enforcement='Analysis only')=>checks.push({id,topic,condition,result:passed?'Pass':'Fail',passed,details,enforcement,sources:[cite('cubesat',pages,section)]});
  add('CS-CONOPS','Concept of operations','A selected goal, injection epoch, operations duration and delivery mode are defined',Boolean(m.objective.name&&plan.launchDate&&Number.isFinite(plan.duration)&&s.selection),[19,37],'2.1 Concept Development; 2.16 Mission Operations',{goal:m.objective.name,launchDate:plan.launchDate,physicalDurationDays:plan.duration/86400,delivery:record.level==='proxima'?'Onboard':'Earth'});
  add('CS-REQ','Requirements','Every existing mission check has a measured condition and source',trace.requirements.every(r=>r.measurableCondition&&r.sources.length>0)&&trace.alignedWithGame,[27,29,33],'2.7 Mission Coordination; 2.9 Documentation; 2.12 Mission Readiness Reviews',{requirementIds:trace.requirements.map(r=>r.requirementId),alignment:trace.alignedWithGame});
  add('CS-LAUNCH','Launch accommodation','Wet mass <= selected service capacity',craft.dryMass+craft.maxFuel<=m.launcher.capacityKg,[27,29],'2.7 Mission Coordination; 2.9 Flight-Specific Documentation',{wetMassKg:craft.dryMass+craft.maxFuel,capacityKg:m.launcher.capacityKg,capacityClassification:'Educational Assumption'},'Existing mass check');
  add('CS-POWER','Spacecraft resources','Final stored energy is positive and within battery capacity',record.energy>0&&record.energy<=craft.maxEnergy+1e-8,[23,25],'2.4 CubeSat Design',{energyWh:record.energy,capacityWh:craft.maxEnergy,scope:'Control-time energy economy; no multi-year energy autonomy claim'});
  const dataError=Math.abs(s.generatedMB-s.storedMB-s.transmittedMB-s.droppedMB);
  add('CS-DATA','Spacecraft resources','Generated = stored + transmitted + dropped, within 1e-7 MB; storage <= capacity',dataError<1e-7&&s.storedMB<=m.instrument.storageMB+1e-8,[23,37],'2.4 CubeSat Design; 2.16 Mission Operations',{balanceErrorMB:dataError,storedMB:s.storedMB,capacityMB:m.instrument.storageMB});
  add('CS-GROUND','Ground communications','The mission delivery criterion uses actual receipts or the stated interstellar archive',record.science.checks.find(c=>c.id==='science').pass,[30,37],'2.10 Ground Station Design, Development, and Testing; 2.16 Mission Operations',{receivedMB:s.receivedMB,inTransitMB:s.inTransitMB,oneWayLightSeconds:s.oneWayLightSeconds,delivery:record.level==='proxima'?'Onboard archive':'Ground receipt'},'Existing science check');
  add('CS-OPS','Mission operations','The result includes a finite duration, flight status, state and resource account',Number.isFinite(record.time)&&record.navigation?.physicalState?.length===6&&Number.isFinite(record.fuelUsed),[37],'2.16 Mission Operations',{status:record.status,controlSeconds:record.time,physicalDays:record.navigation?.simulatedDays,fuelUsedKg:record.fuelUsed});
  const reserve=(m.budget-craft.price)/craft.price;
  add('CS-RESERVE','Cost reserve','Available budget reserve >= 10% of design cost (advisory)',reserve>=.1,[21],'2.2 Securing Funding',{reserveFractionOfCost:reserve,recommendation:'The document recommends reserves when possible; the cost denominator is the project convention.'});
  add('CS-VERIFY','Design verification','A measured trace and final result are present',trace.alignedWithGame&&trace.requirements.length===6,[33,61],'2.12 Mission Readiness Reviews; 6 Flight Certification Documentation',{traceSchema:trace.schema,requirements:trace.requirements.length});
  return {schema:'twinbound-cubesat-review-v1',checks,conOps:['Define science goal','Check spacecraft and injection service','Propagate and navigate','Observe and store','Transmit and receive','Evaluate science delivery'],notApplicable:[
    {item:'1U/3U/6U form factor, dispenser envelope and deployment hardware',reason:'The game uses a generic spacecraft and fictional injection services; no CubeSat-standard hardware model exists.',source:cite('cubesat',[12,13,14],'1.1 CubeSats; 1.2 Dispenser Systems')},
    {item:'RF licenses, environmental qualification, acceptance testing and flight certification',reason:'These real-world hardware and regulatory processes are outside the simulation.',source:cite('cubesat',[28,61],'2.8 Regulatory Licensing; 6 Flight Certification Documentation')}
  ],scope:'Document-derived educational systems checks; no NASA flight certification, CubeSat qualification, or new gameplay requirement'};
}

export function maturityReview({craft,record,trace,trades,cubeSat}){
  const rows=[
    {area:'Mission Concept',complete:Boolean(craft.mission.objective.deliverable),evidence:{scienceGoal:craft.mission.objective.name,deliverable:craft.mission.objective.deliverable},pages:[2,5]},
    {area:'Feasibility',complete:trace.alignedWithGame&&trace.requirements.filter(r=>['REQ-LAUNCH-001','REQ-COST-001','REQ-SCI-001'].includes(r.requirementId)).every(r=>r.passed),evidence:{gameChecks:record.science.checks},pages:[2,3]},
    {area:'Trade Study',complete:trades.length>1,evidence:{alternatives:trades.length,studyIds:trades.map(t=>t.id)},pages:[2,3,10]},
    {area:'Requirements',complete:trace.alignedWithGame&&trace.requirements.every(r=>r.measurableCondition),evidence:{ids:trace.requirements.map(r=>r.requirementId)},pages:[5,11]},
    {area:'Verification Evidence',complete:record.status==='arrived'&&record.science.complete&&trace.alignedWithGame,evidence:{status:record.status,scienceComplete:record.science.complete,requirementsPassed:trace.requirements.filter(r=>r.passed).length},pages:[11,14]}
  ].map(r=>({...r,status:r.complete?'Complete':'Open',source:cite('cml',r.pages),officialCML:null}));
  const risks=[...trace.requirements.filter(r=>!r.passed).map(r=>({id:r.requirementId,description:r.description})),...cubeSat.checks.filter(c=>!c.passed).map(c=>({id:c.id,description:c.topic})),{id:'MODEL-TIME',description:'Mixed control-time resource economy and TDB propagation; not a continuous engineering mission model.'},{id:'HARDWARE',description:'Hardware performance, prices and service capacities are educational assumptions.'},{id:'INDEPENDENT-REVIEW',description:'No independent flight-hardware review or complete CML matrix assessment.'}];
  rows.push({area:'Unresolved Risks',complete:false,status:'Open',evidence:risks,source:cite('cml',[11,14]),officialCML:null});
  return {schema:'twinbound-maturity-v1',assessment:'Simplified CML-informed evidence checklist',officialCML:null,rows,unresolvedRisks:risks,scope:'Evidence completeness only. No official level, 80% threshold, quality certification, or score modifier is assigned.'};
}
