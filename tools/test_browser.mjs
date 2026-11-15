// Optional real-browser integration suite. No browser dependency is needed to play.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {flySample} from './balance_pilot.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.env.PYTHON||'python',['tools/build_static.py'],{cwd:root,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.bin':'application/octet-stream','.md':'text/plain'};
const requests=[],apiRequests=[],failures=[],errors=[],checks=[];
const pass=(name,detail={})=>{checks.push({name,status:'pass',...detail});console.log('PASS',name);};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');requests.push(url.pathname);
  if(url.pathname.includes('/api/'))apiRequests.push(url.pathname);
  try{
    if(!url.pathname.startsWith('/TWINBOUND/'))throw Error('Outside repository prefix');
    const relative=decodeURIComponent(url.pathname.slice('/TWINBOUND/'.length))||'index.html';
    const filename=path.resolve(root,'dist',relative);if(!filename.startsWith(path.resolve(root,'dist')+path.sep))throw Error('Invalid path');
    const bytes=await fs.readFile(filename);res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');res.end(bytes);
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/TWINBOUND/`;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
 await page.goto(base);await page.locator('#playerDialog').waitFor({state:'visible'});
 const enter=async id=>{await page.fill('#playerInput',id);await page.click('#playerForm button[type=submit]');await page.locator('#playerDialog').waitFor({state:'hidden'});};
 const planned=()=>page.waitForFunction(()=>document.getElementById('orbitBusy').hidden&&!document.getElementById('startBtn').disabled,{},{timeout:90000});
 const archive=()=>page.evaluate(async()=>{const {FlightArchive}=await import('./src/flight-service.js');return new FlightArchive().all();});
 const close=async selector=>page.locator(selector+' .close-dialog').click();
 await page.fill('#playerInput','bad id');await page.click('#playerForm button[type=submit]');assert.ok(await page.locator('#playerError').innerText());
 await enter(' Alice ');await planned();assert.equal(await page.locator('#playerTag').innerText(),'alice');
 pass('Player ID validation and normalization');
 await fs.mkdir(path.join(root,'..','browser-qa'),{recursive:true});
 await page.screenshot({path:path.join(root,'..','browser-qa','home.png'),fullPage:true});
 await page.click('#sourcesBtn');await page.waitForFunction(()=>document.querySelectorAll('#sourcesContent .source-cards article').length>0);
 const resourceText=await page.locator('#sourcesContent').innerText();assert.ok(!/offline|read-only|Canadian Space Agency|General Mission Analysis Tool/i.test(resourceText));
 await page.locator('#sourcesContent summary').first().click();assert.ok(await page.locator('#sourcesContent').innerText().then(s=>s.includes('src/dynamics.js')));
 await page.screenshot({path:path.join(root,'..','browser-qa','resources.png'),fullPage:true});await close('#sourcesDialog');
 pass('Resource cards, expandable file traces and retained source links');
 await page.click('#equipmentBtn');await page.waitForFunction(()=>document.getElementById('tradeEstimate').innerText.includes('REFERENCE TRANSFER ESTIMATE'),{},{timeout:90000});
 assert.ok((await page.locator('#missionDesign select').count())===5);await page.click('#saveEquipment');
 pass('Mission editor and real analysis Worker estimate');
 await page.click('#soundBtn');
 const playEnd=async(level,player)=>{
   if(player){await page.click('#switchPlayerBtn');await enter(player);}
   await page.click(`[data-level="${level}"]`);await planned();
   await page.click('#startBtn');await page.locator('#flightScreen').waitFor({state:'visible'});assert.equal(await page.locator('#switchPlayerBtn').isDisabled(),true);
   const fuelBefore=await page.locator('#fuelValue').innerText();
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
   await page.click('#modeBtn');assert.equal(await page.locator('#modeBtn').innerText(),'3D COCKPIT');
   await page.keyboard.down('q');await page.waitForTimeout(200);await page.keyboard.up('q');
   assert.notEqual(await page.locator('#fuelValue').innerText(),fuelBefore);
   if(level==='moon')await page.screenshot({path:path.join(root,'..','browser-qa','cockpit.png'),fullPage:true});
   await page.keyboard.press('v');assert.equal(await page.locator('#modeBtn').innerText(),'2D VIEW');
   await page.click('#pauseBtn');await page.click('#resumeBtn');await page.click('#pauseBtn');await page.click('#quitBtn');
   await page.waitForFunction(()=>document.getElementById('resultSaveStatus')?.textContent==='Flight saved');
   const rows=await archive(),r=rows[0].record;assert.equal(r.level,level);assert.ok(r.fuelUsed>0);assert.ok(r.threeDSeconds>0);assert.equal(r.totalScore,r.arcadeScore+r.missionBonus);assert.equal(rows[0].state,'saved');
   assert.ok(r.navigation.physicalState.length===6);assert.ok(r.science.checks.length===6);
   await page.click('#returnBtn');return r;
 };
 const alice=await playEnd('moon'),bob=await playEnd('moon','Bob');
 assert.equal(alice.playerId,'alice');assert.equal(bob.playerId,'bob');
 pass('A and B end real UI flights; 2D/3D, thrust, pause, sound and complete auto-save');
 await page.click('#leaderboardBtn');await page.waitForFunction(()=>document.querySelectorAll('#recordList tbody tr').length===2);
 assert.ok((await page.locator('#recordList').innerText()).includes('alice'));assert.ok((await page.locator('#recordList').innerText()).includes('bob'));
 await close('#recordsDialog');await page.click('#switchPlayerBtn');await enter('ALICE');await page.click('#leaderboardBtn');
 await page.locator(`[data-flight-id="${bob.flightId}"]`).first().click();await page.waitForFunction(()=>document.getElementById('flightReportContent').innerText.includes('bob'));
 assert.ok((await page.locator('#flightReportContent').innerText()).includes('Spacecraft Configuration'));await close('#flightReportDialog');
 await page.click('#myFlightsBtn');await page.waitForFunction(()=>document.querySelectorAll('#recordList tbody tr').length===1);assert.ok(!(await page.locator('#recordList').innerText()).includes('bob'));await close('#recordsDialog');
 pass('Local table, another player’s full report and isolated My Flights');
 for(const level of ['mars','pluto','proxima'])await playEnd(level);
 pass('All four destination forecasts and actual launch/end flows without Python/API');
 // Real IndexedDB assertions, in a temporary browser context only.
 const indexed=await page.evaluate(async({seed})=>{
   const {FlightArchive,FlightService}=await import('./src/flight-service.js'),a=new FlightArchive(),s=new FlightService(a);
   const copy=(id,playerId,totalScore,level='moon',extra={})=>({...structuredClone(seed),flightId:id,playerId,totalScore,arcadeScore:totalScore-10,missionBonus:10,level,...extra});
   await a.put(copy('qa-a-best','alice',100000));await a.put(copy('qa-b','bob',90000));await a.put(copy('qa-a-low','alice',80000));
   let board=await s.leaderboard('moon','alice');const lowerKeeps=board.ownBest.flightId==='qa-a-best';
   await a.put(copy('qa-a-high','alice',110000));board=await s.leaderboard('moon','alice');const higherWins=board.ownBest.flightId==='qa-a-high';
   await a.put(copy('qa-legacy','legacy',9999999,'moon',{scoreVersion:undefined}));
   await a.put(copy('qa-old','older',85000));await a.mark('qa-old','pending');
   for(const [id,playerId] of [['qa-tie-z','tie-z'],['qa-tie-a','tie-a']])await a.put(copy(id,playerId,75000));
   const ties1=(await s.leaderboard('moon','alice')).rows.map(r=>r.flightId),ties2=(await new FlightService(new FlightArchive()).leaderboard('moon','alice')).rows.map(r=>r.flightId);
   const all=await a.all(),hist=await s.history('alice');
   const detached=await s.flight('qa-b');
   return {lowerKeeps,higherWins,legacyExcluded:!ties1.includes('qa-legacy'),oldIncluded:ties1.includes('qa-old'),tiesStable:JSON.stringify(ties1)===JSON.stringify(ties2)&&ties1.indexOf('qa-tie-a')<ties1.indexOf('qa-tie-z'),all:all.length,history:hist.total,detached:detached.playerId,byLevel:await Promise.all(['moon','mars','pluto','proxima'].map(async l=>(await s.leaderboard(l,'alice')).rows.length))};
 },{seed:alice});
 for(const k of ['lowerKeeps','higherWins','legacyExcluded','oldIncluded','tiesStable'])assert.equal(indexed[k],true,k);assert.equal(indexed.detached,'bob');assert.equal(indexed.all,13);assert.equal(indexed.history,7);assert.deepEqual(indexed.byLevel,[5,1,1,1]);
 pass('IndexedDB best-score updates, ties, legacy exclusion, old entries and complete histories',indexed);
 await page.reload();await enter('alice');await planned();await page.click('#leaderboardBtn');await page.waitForFunction(()=>document.getElementById('recordList').innerText.includes('110,000'));
 await page.screenshot({path:path.join(root,'..','browser-qa','leaderboard.png'),fullPage:true});await close('#recordsDialog');
 assert.equal((await archive()).length,13);pass('Page reload preserves real IndexedDB records');
 const separate=await browser.newContext(),other=await separate.newPage();await other.goto(base);const independent=await other.evaluate(async()=>{const {FlightArchive}=await import('./src/flight-service.js');return (await new FlightArchive().all()).length;});assert.equal(independent,0);await separate.close();pass('Separate browser profile has an independent IndexedDB archive');
 // End-to-end numerical runs use the unchanged real encounter pilot, not mocked arrival/data.
 const fullRuns=await page.evaluate(async({pilotSource})=>{
   const {LEVELS,buildCraft}=await import('./src/config.js'),{configureMission}=await import('./src/mission.js'),{Flight}=await import('./src/physics.js'),{Navigation}=await import('./src/navigation.js');
   const {loadEphemeris}=await import('./src/dynamics.js'),{presetForDate,predictForDate}=await import('./src/planning-v10.js'),{makeFlightRecord}=await import('./src/flight-record.js');
   const {FlightArchive}=await import('./src/flight-service.js'),ephem=await loadEphemeris();
   const pilot=new Function('Flight','Navigation',`return (${pilotSource.replace('return f.snapshot();','return f;')});`)(Flight,Navigation);
   const rows=[];
   for(const l of LEVELS){
     const settings=presetForDate(l.id,'2026-11-14',ephem),plan=predictForDate(l.id,settings,l.id==='proxima'?null:ephem);
     const craft=configureMission(buildCraft({engine:2,hull:2,power:2}),{launcher:'dedicated',budget:'expanded'},l.id);
     const f=pilot(l,craft,12,plan,ephem);if(f.status==='playing')throw Error('Pilot did not finish '+l.id);
     const r=makeFlightRecord(f,{playerId:'numerical-qa',flightId:crypto.randomUUID(),launch:settings,plan,ephemeris:ephem});await new FlightArchive().put(r);
     rows.push({level:l.id,status:r.status,science:r.missionComplete,totalScore:r.totalScore,arcadeScore:r.arcadeScore,missionBonus:r.missionBonus,generatedMB:r.science.generatedMB,receivedMB:r.science.receivedMB,storedMB:r.science.storedMB,seconds:r.time,collected:r.collected});
   }return rows;
 },{pilotSource:flySample.toString()});
 for(const r of fullRuns){assert.equal(r.totalScore,r.arcadeScore+r.missionBonus);assert.ok(r.seconds>0);assert.ok(r.generatedMB>=0);}
 assert.ok(fullRuns.some(r=>r.status==='arrived'&&r.science));pass('Four complete unmodified engine/pilot flights, measured science, scoring and IndexedDB save',{runs:fullRuns});
 // Observe more than the old retry interval without waiting 30 real seconds.
 await page.clock.install();await page.clock.fastForward(31000);assert.equal(apiRequests.length,0);pass('No score API requests, including beyond former 30-second retry interval');
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1}),mobilePage=await mobile.newPage();await mobilePage.goto(base);await mobilePage.fill('#playerInput','mobile');await mobilePage.click('#playerForm button[type=submit]');
 await mobilePage.waitForFunction(()=>document.getElementById('orbitBusy').hidden,{},{timeout:90000});assert.equal(await mobilePage.locator('#leaderboardBtn').isVisible(),true);
 await mobilePage.screenshot({path:path.join(root,'..','browser-qa','mobile.png'),fullPage:true});assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);await mobile.close();pass('Mobile layout keeps leaderboard accessible without horizontal overflow');
 for(const worker of ['trajectory-worker.js','mission-analysis-worker.js'])assert.ok(requests.includes('/TWINBOUND/src/'+worker),worker);
 assert.ok(requests.some(p=>p.startsWith('/TWINBOUND/data/horizons_v10/')&&p.endsWith('.bin')));assert.ok(requests.some(p=>p.startsWith('/TWINBOUND/assets/')));
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(apiRequests,[]);
 pass('Repository subpath loads real Workers, data, assets with no browser errors or missing requests');
 const report={browser:await browser.version(),date:new Date().toISOString(),site:'Local static HTTP server at /TWINBOUND/; no API',checks,apiRequests,failures,errors};
 await fs.writeFile(path.join(root,'data/validation/browser-v1031.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`PASS: ${checks.length} real-browser checks; no API requests.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
