import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LEVELS,buildCraft} from '../src/config.js';
import {configureMission} from '../src/mission.js';
import {Navigation} from '../src/navigation.js';
import {Flight} from '../src/physics.js';
import {predictForDate} from '../src/planning-v10.js';
import {requirementsTrace,cubeSatReview,maturityReview} from '../src/research/requirements.js';
import {tradeAlternatives} from '../src/research/trade-study.js';
import {missionVizExport} from '../src/research/mission-viz.js';
import {ROOT,writeJSON,diskEphemeris,referencePlan} from './lib/research-io.mjs';

export function analyzeMission({record,plan,craft,level,ephemeris},out){
  const context={level,plan,ephemeris,baseCraft:buildCraft(record.kit),profile:record.science.selection};
  const trace=requirementsTrace({craft,record,plan}),trades=tradeAlternatives(context),cubeSat=cubeSatReview({craft,record,plan,trace}),maturity=maturityReview({craft,record,trace,trades,cubeSat}),viz=missionVizExport(context);
  writeJSON(path.join(out,'record.json'),record);writeJSON(path.join(out,'requirements.json'),trace);writeJSON(path.join(out,'cubesat-review.json'),cubeSat);writeJSON(path.join(out,'maturity.json'),maturity);writeJSON(path.join(out,'mission-viz.json'),viz);
  for(const study of trades)writeJSON(path.join(out,'trade-studies',study.id+'.json'),study);
  writeJSON(path.join(out,'trade-studies/index.json'),{schema:'twinbound-trade-index-v1',alternatives:trades.map(t=>({id:t.id,selection:t.selection,feasibleInStudy:t.feasibility.feasibleInStudy,deltaVMS:t.propulsion.initialDeltaVMS,endEnergyWh:t.power.endBatteryWh,receivedMB:t.communications.receivedMB}))});
  if(viz.initial){
    fs.writeFileSync(path.join(out,'mission-viz-actual-track.csv'),'epoch_jd_tdb,x_km,y_km,z_km\n'+viz.osculatingStates.map(q=>[q.epochJD,...q.positionKm].join(',')).join('\n')+'\n');
    fs.writeFileSync(path.join(out,'mission-viz-osculating-ellipse.csv'),'x_km,y_km,z_km\n'+viz.tutorialEllipsePointsKm.map(p=>p.join(',')).join('\n')+'\n');
  }
  return {level:level.id,status:record.status,scienceComplete:record.science.complete,traceAligned:trace.alignedWithGame,requirementsPass:trace.requirements.filter(r=>r.passed).length,requirementsFail:trace.requirements.filter(r=>!r.passed).map(r=>r.requirementId),tradeAlternatives:trades.length,officialCML:maturity.officialCML,vizStatus:viz.initial?'Analyzed':viz.status};
}
export function controlledMission(level,ephemeris,incompatible=false){
  const plan=referencePlan(level,'2026-11-14',ephemeris),objective=level.id==='mars'?'composition':level.id==='proxima'?'clocks':'imaging';
  const profile={objective,instrument:incompatible?'camera':objective==='composition'?'spectrometer':objective==='clocks'?'clock':'camera',launcher:'dedicated',budget:'expanded',radio:'dish'},craft=configureMission(buildCraft({engine:2,hull:2,power:2}),profile,level.id),f=new Flight(level,craft,12,new Navigation(level,plan,ephemeris,craft));
  f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;
  while(f.status==='playing'&&f.time<1500){f.step({},1/30);f.events=[];}
  const record=f.snapshot();record.launch={...plan.settings};record.validationScenario={seed:12,randomEncounters:false,playerThrust:false,controlStepSeconds:1/30};
  return {level,ephemeris,plan,craft,record};
}
const command=process.argv[2]||'generate';
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
  try{
    const ephemeris=diskEphemeris();
    if(command==='generate'){
      const out=path.resolve(process.argv[3]||path.join(ROOT,'data/evidence')),results=[];
      for(const level of LEVELS)results.push(analyzeMission(controlledMission(level,ephemeris),path.join(out,level.id)));
      results.push({...analyzeMission(controlledMission(LEVELS[1],ephemeris,true),path.join(out,'mars-incompatible')),scenario:'incompatible-instrument'});
      writeJSON(path.join(out,'summary.json'),{schema:'twinbound-evidence-summary-v1',execution:'Executed with the actual game dynamics and science classes',scenario:'Controlled coast flight; random encounters disabled. Study alternatives project the reference path.',results});
      console.log(JSON.stringify(results,null,2));
    }else if(command==='analyze'){
      if(!process.argv[3])throw Error('Usage: node tools/research.mjs analyze MISSION_REPORT.json [OUTPUT_DIRECTORY]');
      const record=JSON.parse(fs.readFileSync(process.argv[3])),level=LEVELS.find(l=>l.id===record.level);if(!level||!record.science||!record.launch)throw Error('Use a complete exported mission report with launch settings and science data.');
      const craft=configureMission(buildCraft(record.kit),record.science.selection,level.id);if(craft.price!==record.price)throw Error('Record equipment does not match the current parameter set.');
      const plan=predictForDate(level.id,record.launch,level.id==='proxima'?null:ephemeris),out=path.resolve(process.argv[4]||'mission-analysis');
      console.log(JSON.stringify(analyzeMission({record,level,craft,plan,ephemeris},out),null,2));
    }else throw Error('Commands: generate [OUTPUT_DIRECTORY] | analyze MISSION_REPORT.json [OUTPUT_DIRECTORY]');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
