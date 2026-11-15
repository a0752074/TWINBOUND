import {loadEphemeris} from './dynamics.js';
import {presetForDate,predictForDate,predictFuture} from './planning-v10.js';
self.onmessage=async({data})=>{
  try{
    const eph=data.level==='proxima'?null:await loadEphemeris();
    if(data.type==='forecast'){
      const result=predictFuture(eph,data.level,data.day,data.state,data.duration);
      result.sourceRevision=data.revision;
      self.postMessage({type:'forecast',id:data.id,result});return;
    }
    const settings=data.type==='preset'?presetForDate(data.level,data.launchDate,eph):data.settings;
    self.postMessage({type:'plan',id:data.id,settings,result:predictForDate(data.level,settings,eph)});
  }catch(error){self.postMessage({type:data.type==='forecast'?'forecast':'plan',id:data.id,error:error.message});}
};
