import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resourceHTML} from '../src/mission-ui.js';
const root=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('data/nasa-resources.json',root)));
test('NASA resource cards show concise uses and verifiable code traces',()=>{
 const html=resourceHTML(manifest);for(const r of manifest.resources){assert.ok(r.implementation.length<190,r.id);for(const file of r.files)assert.ok(fs.existsSync(new URL(file,root)),file);assert.ok(html.includes(r.title));}
 for(const text of ['offline','read-only','not executed','does not','No NASA service','Canadian Space Agency','General Mission Analysis Tool'])assert.ok(!html.toLowerCase().includes(text.toLowerCase()),text);
 assert.ok(html.includes('Implementation files'));assert.ok(html.includes('src/dynamics.js'));assert.ok(html.includes('Technical trace'));
 const page=fs.readFileSync(new URL('index.html',root),'utf8');assert.ok(!page.includes('Model documentation'));assert.ok(!page.includes('syncRetryBtn'));assert.ok(page.includes('Local Leaderboard'));
});
