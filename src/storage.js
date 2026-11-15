import {LEVELS,buildCraft} from './config.js';
const KEY='twinbound-v10-little-expedition';
export const emptySave=()=>({version:10,kit:{engine:1,hull:1,power:1},level:'moon',sound:false,missions:{},records:[],best:{},photos:[],completed:[]});
export function readSave(){
  try{
    const a=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('twinbound-v9-little-expedition')||'null');if(!a||![9,10].includes(a.version))return emptySave();
    const validIds=LEVELS.map(l=>l.id),save={...emptySave(),...a,version:10};
    save.missions=a.missions&&typeof a.missions==='object'&&!Array.isArray(a.missions)?a.missions:{};
    save.kit=buildCraft(a.kit).kit;save.level=validIds.includes(a.level)?a.level:'moon';
    save.records=(Array.isArray(a.records)?a.records:[]).filter(r=>validIds.includes(r.level)&&Number.isFinite(r.score)&&r.score>=0&&Number.isFinite(r.time)).slice(0,30);
    save.photos=(Array.isArray(a.photos)?a.photos:[]).filter(x=>typeof x==='string').slice(0,30);
    save.completed=(Array.isArray(a.completed)?a.completed:[]).filter(x=>validIds.includes(x));
    save.best=Object.fromEntries(Object.entries(a.best||{}).filter(([id,r])=>validIds.includes(id)&&r&&Number.isFinite(r.score)&&r.score>=0));
    return save;
  }catch{return emptySave();}
}
export function writeSave(save){try{localStorage.setItem(KEY,JSON.stringify(save));return true;}catch{return false;}}
export function readPlayerSave(playerId){
  try{
    const value=localStorage.getItem('twinbound-v103-profile-'+playerId);
    if(value)return {...emptySave(),...JSON.parse(value)};
    const owner=localStorage.getItem('twinbound-v103-legacy-owner');
    if(!owner){localStorage.setItem('twinbound-v103-legacy-owner',playerId);const s=readSave();s.legacyRecords=s.records.filter(r=>!r.scoreVersion);return s;}
    if(owner===playerId){const s=readSave();s.legacyRecords=s.records.filter(r=>!r.scoreVersion);return s;}
    return {...emptySave(),legacyRecords:[]};
  }catch{return emptySave();}
}
export function writePlayerSave(playerId,save){try{localStorage.setItem('twinbound-v103-profile-'+playerId,JSON.stringify(save));return true;}catch{return false;}}
export function recordFlight(save,record,photo){
  const previous=save.best[record.level],comparable=previous?.scoreVersion===record.scoreVersion;
  const isBest=(record.totalScore??record.score)>(comparable?(previous?.totalScore??previous?.score??0):0);
  save.records=[record,...save.records].slice(0,30);
  if(isBest)save.best[record.level]=record;
  if(record.status==='arrived'&&!save.completed.includes(record.level))save.completed.push(record.level);
  let isNewPhoto=false;
  if(photo&&record.status==='arrived'&&!save.photos.includes(photo.id)){save.photos.push(photo.id);isNewPhoto=true;}
  return {isBest,isNewPhoto};
}
