import fs from 'node:fs';
import {VERSION,LEVELS,EQUIPMENT,buildCraft} from '../src/config.js';
import {INSTRUMENTS,RADIOS,LAUNCHERS,BUDGETS,OBJECTIVES,objectivesFor,configureMission} from '../src/mission.js';
import {SCORE_VERSION,LEVEL_BONUS_CAPS,costBenchmarks} from '../src/mission-score.js';
const rules={gameVersion:VERSION,scoreVersion:SCORE_VERSION,bonusCaps:LEVEL_BONUS_CAPS,equipment:EQUIPMENT,instruments:INSTRUMENTS,radios:RADIOS,launchers:LAUNCHERS,budgets:BUDGETS,objectives:OBJECTIVES,
  levels:Object.fromEntries(LEVELS.map(l=>[l.id,{objectives:objectivesFor(l.id),range:l.range,multiplier:l.score,maxDays:configureMission(buildCraft({}),{},l.id).mission.scenario.maxDays}])),
  costBenchmarks:Object.fromEntries(LEVELS.flatMap(l=>objectivesFor(l.id).map(o=>[l.id+':'+o,costBenchmarks(l.id,o)])))};
const output=new URL('../data/mission-score-rules.json',import.meta.url);
if(process.argv.includes('--check')){if(JSON.stringify(JSON.parse(fs.readFileSync(output)))!==JSON.stringify(rules))throw Error('Server scoring rules differ from the JavaScript source. Run node tools/export_score_rules.mjs.');}
else fs.writeFileSync(output,JSON.stringify(rules,null,2)+'\n');
console.log('Scoring rules '+(process.argv.includes('--check')?'verified.':'exported.'));
