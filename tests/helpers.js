import fs from 'node:fs';
import {JplEphemeris} from '../src/dynamics.js';
import {presetForDate,predictForDate} from '../src/planning-v10.js';
import {LEVELS,buildCraft} from '../src/config.js';
import {Navigation} from '../src/navigation.js';
import {Flight} from '../src/physics.js';
const base=new URL('../data/horizons_v10/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base))),buffers={};
for(const b of manifest.bodies){const q=fs.readFileSync(new URL(b.file,base));buffers[b.name]=q.buffer.slice(q.byteOffset,q.byteOffset+q.byteLength);}
export const eph=new JplEphemeris(manifest,buffers);
const cache=new Map();
export function getPlan(id='moon',date='2026-11-12'){
  const key=id+date;if(!cache.has(key)){const s=presetForDate(id,date,eph);cache.set(key,predictForDate(id,s,id==='proxima'?null:eph));}return cache.get(key);
}
export function linkedFlight(id='moon',options={}){
  const level=LEVELS.find(l=>l.id===id),craft=buildCraft(options.kit||{engine:2,hull:2,power:2}),nav=new Navigation(level,options.plan||getPlan(id),eph,craft,options);
  const f=new Flight(level,craft,options.seed??12,nav);
  if(options.encounters!==true){f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;}
  return f;
}
export function advance(f,seconds,input={},step=1/30){let t=0;while(t<seconds-1e-8&&f.status==='playing'){const dt=Math.min(step,seconds-t);f.step(typeof input==='function'?input(f):input,dt);f.events=[];t+=dt;}return f;}
