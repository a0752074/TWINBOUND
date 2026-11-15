import {LEVELS,buildCraft} from './config.js';
import {loadEphemeris} from './dynamics.js';
import {tradeStudy} from './research/trade-study.js';
import {planElements} from './research/mission-viz.js';
self.onmessage=async({data})=>{
  try{
    const level=LEVELS.find(x=>x.id===data.level),ephemeris=level.id==='proxima'?null:await loadEphemeris();
    const context={level,ephemeris,plan:data.plan};
    const result=data.type==='trade'?tradeStudy({...context,baseCraft:buildCraft(data.kit),profile:data.profile}):planElements(context);
    self.postMessage({id:data.id,type:data.type,result});
  }catch(error){self.postMessage({id:data.id,type:data.type,error:error.message});}
};
