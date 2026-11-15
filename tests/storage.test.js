import test from 'node:test';import assert from 'node:assert/strict';
import {readSave,writeSave,emptySave} from '../src/storage.js';
test('v9 scores, kit, photos and records migrate without deleting the original save',()=>{
  const old={...emptySave(),version:9,records:[{version:9,level:'moon',score:12345,time:600}],photos:['PIA13008'],completed:['moon'],kit:{engine:0,hull:1,power:2}},m=new Map([['twinbound-v9-little-expedition',JSON.stringify(old)]]);
  const previous=globalThis.localStorage;globalThis.localStorage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
  try{const save=readSave();assert.equal(save.version,10);assert.equal(save.records[0].score,12345);assert.deepEqual(save.photos,old.photos);assert.deepEqual(save.kit,old.kit);assert.equal(writeSave(save),true);assert.ok(m.has('twinbound-v10-little-expedition'));assert.ok(m.has('twinbound-v9-little-expedition'));}finally{globalThis.localStorage=previous;}
});
