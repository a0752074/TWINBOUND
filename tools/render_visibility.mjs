// Actual Canvas drawing commands recorded as SVG, not a browser screenshot.
import fs from 'node:fs';
import {LEVELS,buildCraft} from '../src/config.js';
import {Flight} from '../src/physics.js';
import {Flight as BaselineFlight} from '../tests/fixtures/v102/physics.js';
import {CockpitRenderer} from '../src/cockpit.js';
import {SVGCanvas} from './lib/canvas-svg.mjs';
const output=new URL('../docs/images/',import.meta.url);fs.mkdirSync(output,{recursive:true});
for(const [name,Type] of [['fixed',Flight],['old-plane',BaselineFlight]])for(const [size,w,h] of [['desktop',1400,840],['mobile',390,700]]){
 const f=new Type(LEVELS[1],buildCraft({engine:2,hull:2,power:2}),77);f.setFlightMode('3d');f.pilot3D.z=50000;f.pilot3D.vz=35;f.time=30;f.progress=.3;f.nextSpawn=f.nextSupply=f.nextComet=f.nextHole=0;f.director(1/30);
 const canvas=new SVGCanvas(w,h);new CockpitRenderer(null,77).drawScene(canvas,w,h,f,1/60);
 const svg=canvas.svg();if(/NaN|Infinity/.test(svg))throw Error('Invalid geometry.');
 fs.writeFileSync(new URL(`visibility-${name}-${size}.svg`,output),svg);
}
console.log('Recorded four actual cockpit command previews at +50,000 m.');
