import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JplEphemeris} from '../../src/dynamics.js';
import {presetForDate,predictForDate} from '../../src/planning-v10.js';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const writeJSON=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
export function diskEphemeris(){const base=path.join(ROOT,'data/horizons_v10'),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'))),buffers={};for(const b of manifest.bodies){const data=fs.readFileSync(path.join(base,b.file));buffers[b.name]=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}return new JplEphemeris(manifest,buffers);}
export function referencePlan(level,date,ephemeris){const settings=presetForDate(level.id,date,ephemeris);return predictForDate(level.id,settings,level.id==='proxima'?null:ephemeris);}
