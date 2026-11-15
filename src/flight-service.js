import {newFlightId} from './flight-record.js';
import {LEVELS} from './config.js';
import {SCORE_VERSION} from './mission-score.js';
export {newFlightId};
export function normalizePlayerId(value){
  const id=String(value??'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{1,19}$/.test(id))throw Error('Use 2–20 letters, numbers, underscores or hyphens. Start with a letter or number.');
  return id;
}
const SESSION='twinbound-v103-player';
export function lastPlayer(){try{return localStorage.getItem(SESSION)||'';}catch{return '';}}
export function rememberPlayer(id){try{localStorage.setItem(SESSION,id);}catch{/* Playing remains available. */}}

export class FlightArchive {
  constructor(){this.memory=new Map();this.key='twinbound-v103-flights';this.db=null;}
  async open(){
    if(this.db)return this.db;
    if(!globalThis.indexedDB)return null;
    this.db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('twinbound-flight-archive',1);
      request.onupgradeneeded=()=>{const store=request.result.createObjectStore('flights',{keyPath:'flightId'});store.createIndex('playerId','playerId');store.createIndex('state','state');};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Local flight storage is unavailable.'));
    });return this.db;
  }
  async edit(id,fn){
    const db=await this.open();
    if(!db){
      let rows;try{rows=JSON.parse(localStorage.getItem(this.key)||'{}');}catch{rows={};}
      const row=fn(rows[id]);rows[id]=row;
      try{localStorage.setItem(this.key,JSON.stringify(rows));}catch{this.memory.set(id,row);throw Error('Device storage is full. Free space and keep this page open to preserve the report.');}
      return row;
    }
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('flights','readwrite'),store=tx.objectStore('flights'),request=store.get(id);let result;
      request.onsuccess=()=>{try{result=fn(request.result);store.put(result);}catch(error){tx.abort();reject(error);}};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Could not save the flight on this device.'));tx.onabort=()=>reject(Error('Local flight save was interrupted.'));
    });
  }
  async put(record){return this.edit(record.flightId,old=>old||{flightId:record.flightId,playerId:record.playerId,state:'saved',error:'',record});}
  async mark(id,state,error=''){return this.edit(id,row=>{if(!row)throw Error('Local flight not found.');return {...row,state,error};});}
  async all({playerId,state}={}){
    const db=await this.open();let rows;
    if(!db){try{rows=Object.values(JSON.parse(localStorage.getItem(this.key)||'{}'));}catch{rows=[];}for(const row of this.memory.values())if(!rows.some(x=>x.flightId===row.flightId))rows.push(row);}
    else rows=await new Promise((resolve,reject)=>{const tx=db.transaction('flights'),store=tx.objectStore('flights'),request=playerId?store.index('playerId').getAll(playerId):state?store.index('state').getAll(state):store.getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Could not read local flights.'));});
    return rows.filter(x=>(!playerId||x.playerId===playerId)&&(!state||x.state===state)).sort((a,b)=>b.record.date.localeCompare(a.record.date)||a.flightId.localeCompare(b.flightId));
  }
  async get(id){
    if(this.memory.has(id))return this.memory.get(id);
    const db=await this.open();if(!db)return (await this.all()).find(x=>x.flightId===id)||null;
    return new Promise((resolve,reject)=>{const r=db.transaction('flights').objectStore('flights').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(Error('Could not read local flight.'));});
  }
}

// Stable across reloads and independent of which player is active.
const compareText=(a,b)=>a<b?-1:a>b?1:0;
export function compareFlights(a,b){
  return b.totalScore-a.totalScore || b.missionBonus-a.missionBonus ||
    compareText(a.date,b.date) || compareText(a.flightId,b.flightId);
}
function rankedRecord(r){
  return r?.scoreVersion===SCORE_VERSION && LEVELS.some(l=>l.id===r.level) &&
    typeof r.playerId==='string' && typeof r.flightId==='string' && typeof r.date==='string' &&
    Number.isFinite(r.totalScore) && Number.isFinite(r.arcadeScore) && Number.isFinite(r.missionBonus);
}
// All reads use this browser's original archive. No API or upload queue.
export class FlightService {
  constructor(archive){this.archive=archive;}
  async leaderboard(level,playerId){
    const best=new Map();
    for(const {record:r} of await this.archive.all()){
      if(!rankedRecord(r)||r.level!==level)continue;
      let id;try{id=normalizePlayerId(r.playerId);}catch{continue;}
      const candidate={...r,playerId:id},old=best.get(id);
      if(!old||compareFlights(candidate,old)<0)best.set(id,candidate);
    }
    const ranked=[...best.values()].sort(compareFlights).map((r,i)=>({...r,rank:i+1}));
    return {rows:ranked.slice(0,50),total:ranked.length,ownBest:ranked.find(r=>r.playerId===playerId)||null};
  }
  async history(playerId,offset=0){
    const rows=await this.archive.all({playerId});
    return {rows:rows.slice(offset,offset+50).map(r=>r.record),total:rows.length};
  }
  async flight(id){
    const row=await this.archive.get(id);
    if(!row)throw Error('This flight is not saved on this device.');
    return row.record;
  }
}
