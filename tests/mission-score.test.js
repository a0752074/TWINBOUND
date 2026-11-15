import test from 'node:test';import assert from 'node:assert/strict';
import {LEVELS,buildCraft} from '../src/config.js';
import {configureMission,designChecks,OBJECTIVES} from '../src/mission.js';
import {calculateMissionScore,costBenchmarks,LEVEL_BONUS_CAPS} from '../src/mission-score.js';
import {Flight} from '../src/physics.js';
function setup(level='moon',kit={engine:0,hull:0,power:0},selection={}){
 const c=configureMission(buildCraft(kit),{launcher:'dedicated',budget:'expanded',...selection},level),required=c.mission.objective.requiredMB;
 const science={selection:c.mission.selection,requiredMB:required,generatedMB:required*2,receivedMB:required,transmittedMB:required,storedMB:required,droppedMB:0,inTransitMB:0,exposureControlSeconds:50};
 const r={level,status:'arrived',score:12345,fuel:c.maxFuel*.25,energy:c.maxEnergy*.3,telemetry:{maxProgress:1,minEnergy:c.maxEnergy*.25},navigation:{progress:1,simulatedDays:5},science};return {c,r};
}
test('formula exactly preserves arcade score and uses independently capped NASA components',()=>{
 for(const l of LEVELS){const {c,r}=setup(l.id),s=calculateMissionScore(r,c),expected=.15*s.p*s.R+.20*s.p*s.E+.60*s.D+.05*s.F*s.C;assert.equal(s.quality,expected);assert.equal(s.arcadeScore,r.score);assert.equal(s.totalScore,r.score+s.missionBonus);assert.equal(s.missionBonus,Math.round(LEVEL_BONUS_CAPS[l.id]*expected));assert.ok(s.cap>0);assert.equal(s.missionComplete,true);}
});
test('wrong instruments, half data, and in-transit packets use the actual science criterion',()=>{
 const {c,r}=setup('mars',undefined,{objective:'composition',instrument:'camera'});let s=calculateMissionScore(r,c);assert.equal(s.D,0);assert.equal(s.F,0);assert.equal(s.C,0);
 const good=setup('moon');good.r.science.receivedMB=good.r.science.requiredMB/2;s=calculateMissionScore(good.r,good.c);assert.equal(s.D,.5);assert.equal(s.F,0);
 good.r.science.receivedMB=0;good.r.science.inTransitMB=good.r.science.transmittedMB;s=calculateMissionScore(good.r,good.c);assert.equal(s.D,0);assert.equal(s.C,0);
});
test('energy history, storage loss, fuel exhaustion, and absent observations affect engineering',()=>{
 const {c,r}=setup();r.telemetry.minEnergy=0;r.energy=c.maxEnergy;r.fuel=0;r.science.droppedMB=r.science.generatedMB/2;let s=calculateMissionScore(r,c);assert.equal(s.batteryHealth,0);assert.equal(s.fuelHealth,0);assert.equal(s.dataIntegrity,.5);assert.equal(s.E,.125);
 r.science.generatedMB=0;r.science.exposureControlSeconds=0;s=calculateMissionScore(r,c);assert.equal(s.dataIntegrity,0);assert.equal(s.D,0);assert.equal(s.F,0);
});
test('lower-cost awards require arrival, science, valid design; player budget cannot inflate cost efficiency',()=>{
 const a=setup('moon',{engine:0,hull:0,power:0},{launcher:'shared'}),b=setup('moon',{engine:2,hull:2,power:2});
 let sa=calculateMissionScore(a.r,a.c),sb=calculateMissionScore(b.r,b.c);assert.ok(sa.C>sb.C);assert.equal(sa.E,sb.E);assert.equal(sa.D,sb.D);
 const lean=setup('moon',{engine:0,hull:0,power:0},{launcher:'shared',budget:'lean'});assert.equal(calculateMissionScore(lean.r,lean.c).C,sa.C);
 for(const status of ['failed','aborted']){a.r.status=status;sa=calculateMissionScore(a.r,a.c);assert.equal(sa.C,0);assert.equal(sa.F,0);assert.ok(sa.D>0);}
 a.r.status='arrived';a.r.science.receivedMB=0;assert.equal(calculateMissionScore(a.r,a.c).C,0);
});
test('early aborts cannot earn full design or engineering credit; archive counts only the Proxima criterion',()=>{
 const {c,r}=setup();r.status='aborted';r.telemetry.maxProgress=.02;r.science.receivedMB=0;let s=calculateMissionScore(r,c);assert.ok(s.quality<.01);
 const star=setup('proxima');star.r.science.receivedMB=0;star.r.science.transmittedMB=0;star.r.science.storedMB=star.r.science.requiredMB;s=calculateMissionScore(star.r,star.c);assert.equal(s.D,1);assert.equal(s.F,1);
});
test('recalculation, repeats, Combo and mode toggles do not multiply or accumulate mission awards',()=>{
 const {c,r}=setup();const original=calculateMissionScore(r,c);for(let i=0;i<50;i++){r.maxCombo=i*100;r.threeDSeconds=i;assert.deepEqual(calculateMissionScore(r,c),original);}
 const f=new Flight(LEVELS[0],c,12);f.points(80);const before=f.totalScore;for(let i=0;i<100;i++){f.setFlightMode('3d');f.setFlightMode('2d');}assert.equal(f.totalScore,before);
});
test('cost baselines enumerate existing qualifying combinations and handle invalid or degenerate inputs',()=>{
 const b=costBenchmarks('moon','imaging');assert.ok(b.validDesigns>0);assert.ok(b.referenceCost>b.minimumValidCost);assert.equal(costBenchmarks('moon','invalid').validDesigns,0);
 for(const l of LEVELS){const {c,r}=setup(l.id);for(const p of [-10,0,.5,1,10,NaN]){r.telemetry.maxProgress=p;const s=calculateMissionScore(r,c);for(const k of ['quality','missionBonus','totalScore','E','D','C','p'])assert.ok(Number.isFinite(s[k]));assert.ok(s.quality>=0&&s.quality<=1);}}
});
