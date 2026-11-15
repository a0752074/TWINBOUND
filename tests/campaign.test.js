import test from 'node:test';import assert from 'node:assert/strict';
import {simulateWithPilot} from '../tools/balance_sweep.js';import {LEVELS} from '../src/config.js';
import {emptySave,recordFlight} from '../src/storage.js';import {PHOTOS} from '../src/photos.js';import {eph,getPlan} from './helpers.js';
test('actual JPL mission with random v9 encounters reaches the real Moon and unlocks the matching photo',()=>{
  const r=simulateWithPilot(LEVELS[0],12,{engine:2,hull:2,power:2},{eph,plan:getPlan('moon')});
  assert.equal(r.status,'arrived');assert.ok(r.time>240&&r.time<360);assert.ok(r.collected>0);assert.ok(r.fuelUsed>0);assert.ok(r.score>3000);assert.ok(r.navigation.targetKm<=LEVELS[0].near);
  const save=emptySave(),photo=PHOTOS.find(p=>p.target===r.level);recordFlight(save,r,photo);assert.equal(save.photos[0],photo.id);assert.equal(save.completed[0],'moon');
});
