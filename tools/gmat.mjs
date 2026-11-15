import fs from 'node:fs';
import path from 'node:path';
import {GMAT_CASE,gmatReference,gmatScript,compareGmat} from '../src/research/gmat.js';
import {ROOT,writeJSON} from './lib/research-io.mjs';
const command=process.argv[2]||'prepare',out=path.resolve(command==='prepare'?(process.argv[3]||path.join(ROOT,'data/evidence/gmat')):(process.argv[5]||'gmat-comparison'));
try{
 if(command==='prepare'){
  writeJSON(path.join(out,'case.json'),GMAT_CASE);writeJSON(path.join(out,'twinbound-reference.json'),gmatReference());fs.writeFileSync(path.join(out,'benchmark.script'),gmatScript());
  writeJSON(path.join(out,'status.json'),{status:'Not Executed',reason:'GMAT R2025a was not available in the build environment. Script, model assumptions and local reference are preparation only; no GMAT raw output or independent orbit result is claimed.'});console.log('Prepared GMAT benchmark. Status: Not Executed.');
 }else if(command==='compare'){
  if(!process.argv[3]||!process.argv[4])throw Error('Usage: node tools/gmat.mjs compare GMAT_RAW.csv VERIFIED_MODEL.json [OUTPUT_DIRECTORY]');
  const lines=fs.readFileSync(process.argv[3],'utf8').split(/\r?\n/).filter(s=>s.trim()&&!s.startsWith('%'));
  const rows=lines.map(line=>line.trim().split(/[,\s]+/).map(Number)).filter(row=>row.length===7&&row.every(Number.isFinite)).map(row=>({seconds:row[0],state:row.slice(1)}));
  const metadata=JSON.parse(fs.readFileSync(process.argv[4])),report=compareGmat(gmatReference(),rows,metadata);
  writeJSON(path.join(out,'comparison.json'),report);fs.mkdirSync(out,{recursive:true});fs.copyFileSync(process.argv[3],path.join(out,'external_raw.csv'));writeJSON(path.join(out,'verified-model.json'),metadata);console.log(JSON.stringify({status:report.status,positionMaxKm:report.positionMaxKm,velocityMaxKmS:report.velocityMaxKmS},null,2));
 }else throw Error('Commands: prepare [OUTPUT_DIRECTORY] | compare GMAT_RAW.csv VERIFIED_MODEL.json [OUTPUT_DIRECTORY]');
}catch(error){console.error(error.message);process.exitCode=1;}
