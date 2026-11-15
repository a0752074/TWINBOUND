import test from 'node:test';import assert from 'node:assert/strict';
import {Flight} from '../src/physics.js';import {CockpitRenderer} from '../src/cockpit.js';import {LEVELS,buildCraft} from '../src/config.js';import {SVGCanvas} from '../tools/lib/canvas-svg.mjs';
test('the actual 3D drawing routine renders valid finite geometry at desktop and mobile sizes',()=>{
 for(const [w,h]of [[1400,840],[390,700],[320,568]]){const f=new Flight(LEVELS[0],buildCraft({engine:1,hull:1,power:1}),77);f.setFlightMode('3d');f.progress=.6;f.time=25;f.add('rock',10,3,{z:0,radius:40});f.add('hole',20,500,{z:10,radius:35});f.add('comet',40,700,{z:30,radius:30});f.add('repair',-10,300,{z:-20,radius:13});const recorder=new SVGCanvas(w,h);new CockpitRenderer(null,77).drawScene(recorder,w,h,f,1/60);const svg=recorder.svg();assert.ok(svg.includes('3D COCKPIT'));assert.ok(svg.includes('LOCAL VERTICAL'));assert.ok(!/NaN|Infinity/.test(svg));assert.equal(recorder.stack.length,0);}
});
