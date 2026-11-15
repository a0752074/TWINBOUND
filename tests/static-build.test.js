import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),python=process.env.PYTHON||'python';
async function files(dir,prefix=''){const all=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())all.push(...await files(path.join(dir,e.name),rel+'/'));else all.push(rel);}return all;}
test('static build serves every complete asset byte-for-byte under a repository subpath, with no API/config dependency',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'twinbound-static-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const build=spawnSync(python,['tools/build_static.py','--output',temp],{cwd:root,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 const deployed=await files(temp);assert.ok(deployed.includes('.nojekyll'));assert.ok(!deployed.includes('server.py'));assert.ok(!deployed.includes('runtime-config.js'));
 for(const file of ['data/horizons_v10/manifest.json','src/trajectory-worker.js','src/mission-analysis-worker.js','src/cockpit.js','src/audio.js','docs/PHYSICS.md'])assert.ok(deployed.includes(file),file);
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/TWINBOUND/'))throw Error('Wrong root');const filename=path.join(temp,decodeURIComponent(url.pathname.slice(11))||'index.html');const bytes=await fs.readFile(filename);res.end(bytes);}catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/TWINBOUND/`;
 for(const file of deployed){const response=await fetch(new URL(file,base));assert.equal(response.status,200,file);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await fs.readFile(path.join(temp,file)),file);}
 for(const file of deployed.filter(f=>f.endsWith('.js'))){const source=await fs.readFile(path.join(temp,file),'utf8');assert.ok(!/['"`]\/api\//.test(source),file);
  for(const match of source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)){const url=new URL(match[1],new URL(file,base));assert.ok(url.pathname.startsWith('/TWINBOUND/'));assert.equal((await fetch(url)).status,200,url.href);}
 }
 const page=await fs.readFile(path.join(temp,'index.html'),'utf8');for(const m of page.matchAll(/(?:src|href)="([^"#]+)"/g)){if(m[1].startsWith('http'))continue;assert.equal((await fetch(new URL(m[1],base))).status,200,m[1]);}
 assert.ok(!page.includes('runtime-config'));assert.equal((await fetch(new URL('api/leaderboard',base))).status,404);
 const workflow=await fs.readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');assert.ok(workflow.includes('branches: [main]'));assert.ok(workflow.includes('path: dist'));assert.ok(!workflow.includes('API_BASE'));
});
test('normal Python launcher serves the full static game without importing the former API or creating a database',async t=>{
 const child=spawn(python,['run.py','--no-browser','--port','0','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
 let output='';const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Launcher timed out')),10000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code));});});
 const response=await fetch(url);assert.equal(response.status,200);assert.ok((await response.text()).includes('Local Leaderboard'));
 const js=await fetch(url+'/src/trajectory-worker.js');assert.equal(js.status,200);assert.ok(js.headers.get('content-type').includes('javascript'));
 assert.equal((await fetch(url+'/api/health')).status,404);assert.ok(!output.includes('Shared records'));
 const source=await fs.readFile(path.join(root,'run.py'),'utf8');assert.ok(!source.includes('from server import'));assert.ok(!source.includes('sqlite'));
});
