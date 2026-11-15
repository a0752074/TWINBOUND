import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {buildCraft,LEVELS} from '../src/config.js';
import {configureMission} from '../src/mission.js';
import {Navigation} from '../src/navigation.js';
import {Flight} from '../src/physics.js';
import {makeFlightRecord,newFlightId} from '../src/flight-record.js';
import {eph,getPlan,advance} from '../tests/helpers.js';
const records=[];
for(const [levelId,seconds] of [['moon',10],['moon',20],['moon',1000],['mars',1000],['pluto',1000],['proxima',1000]]){
 const level=LEVELS.find(l=>l.id===levelId),c=configureMission(buildCraft({engine:2,hull:2,power:2}),{launcher:'dedicated',budget:'expanded'},levelId),plan=getPlan(levelId,'2026-11-14'),f=new Flight(level,c,77,new Navigation(level,plan,eph,c));
 f.objects=[];f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=Infinity;
 if(seconds===20)f.setFlightMode('3d');advance(f,seconds);if(f.status==='playing')f.finish('aborted','Flight ended by player');
 records.push(makeFlightRecord(f,{playerId:'fixture',flightId:newFlightId(),launch:plan.settings,plan,ephemeris:eph}));
}
fs.writeFileSync(process.argv[2],JSON.stringify(records,null,2)+'\n');
console.log('Six actual controlled-flight records generated for API integration tests.');
