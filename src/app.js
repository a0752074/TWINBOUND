import {LEVELS,EQUIPMENT,DEFAULT_KIT,VERSION,DURATION,buildCraft,clamp,fmt,usd,clock,distanceLabel,missionTime} from './config.js';
import {Flight,seedFrom} from './physics.js';
import {relativisticLeg} from './orbit.js';
import {PHOTOS} from './photos.js';
import {planetSVG,drawRocket,drawPlanet} from './art.js';
import {OrbitMap,FlightRenderer,fitCanvas} from './render.js';
import {readSave,writeSave,readPlayerSave,writePlayerSave,recordFlight} from './storage.js';
import {AudioEngine} from './audio.js';
import {loadEphemeris,todayLocal} from './dynamics.js';
import {Navigation} from './navigation.js';
import {CockpitRenderer} from './cockpit.js';
import {cockpitGuidance} from './flight-3d.js';
import {configureMission,normalizeMission,AI_DISCLOSURE} from './mission.js';
import {missionEditorHTML,missionBrief,resourceHTML,missionReadinessHTML,engineeringImpactHTML,tradeEstimateHTML} from './mission-ui.js';
import {makeFlightRecord,newFlightId} from './flight-record.js';
import {missionDebriefHTML} from './flight-report.js';
import {FlightArchive,FlightService} from './flight-service.js';
import {CommunityUI} from './community-ui.js';

const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=readSave();
let activePlayer='',activeFlightId='',community=null,analysisWorker=null,tradeTicket=0,lastTrade=null,tradeTimer=null;
const tradeCache=new Map(),tradeRequests=new Map(),archive=new FlightArchive();
const service=new FlightService(archive);
const resourceManifest=fetch('data/nasa-resources.json').then(r=>{if(!r.ok)throw Error('Cannot load resource trace');return r.json();});
resourceManifest.catch(()=>{});
const audio=new AudioEngine(save.sound);
let level=LEVELS.find(l=>l.id===save.level)||LEVELS[0],launchDate=todayLocal(),settings={...level.default,launchDate},craft=configureMission(buildCraft(save.kit),save.missions?.[level.id],level.id),route=null,draft={...save.kit};
let cockpitRenderer=null,startingGame=false;
let screen='hangar',flight=null,renderer=null,paused=false,lastFrame=0,accumulator=0,hudTime=0,lastToastAt=0,gameFinished=false;
let trajectoryTimer,requestId=0,worker=null,toastTimer,flightToastTimer,starLeg=null,lastRecord=null,lastReward=null,lastResultMeta=null,missionDraft=null;
let ephemeris=null,ephemerisReady=loadEphemeris().then(e=>{ephemeris=e;return e;}),pendingStart=false,planPending=true,forecastTicket=0,forecastPending=false,forecastElapsed=0;
ephemerisReady.catch(e=>notify(e.message));
const held={left:false,right:false,up:false,down:false,reverse:false,rise:false,fall:false,coast:false};
const originalTutorial=$('tutorialHint').innerHTML;
let keyboardHeld={...held},touchHeld={...held};
const map=new OrbitMap($('orbitCanvas'),()=>({level,settings,route}),changes=>{Object.assign(settings,changes);syncSliders();scheduleTrajectory();});

function notify(message){clearTimeout(toastTimer);$('globalToast').textContent=message;$('globalToast').hidden=false;toastTimer=setTimeout(()=>$('globalToast').hidden=true,4500);}
function persist(){if(!(activePlayer?writePlayerSave(activePlayer,save):writeSave(save)))notify('Settings cannot be saved on this device. You can still play.');}
function updateCollectionCount(){$('albumCount').textContent=save.photos.length+(save.completed.includes('pluto')?1:0);}
function renderLevels(){
  $('levelCards').innerHTML=LEVELS.map(l=>`<button class="level-card ${l.id===level.id?'selected':''}" data-level="${l.id}" aria-pressed="${l.id===level.id}" style="--planet-color:${l.color}">${planetSVG(l.id)}<div><span class="level-index">DESTINATION ${l.number}</span><strong>${l.name}</strong><span class="level-en">${l.en}</span><span class="level-difficulty"><span class="difficulty-pips">${[1,2,3,4].map(i=>`<i class="${i<=l.rank?'on':''}"></i>`).join('')}</span>${l.difficulty}</span></div>${save.completed.includes(l.id)?'<span class="completed-mark">✓ Arrived</span>':''}${l.id===level.id?'<i class="selected-dot"></i>':''}</button>`).join('');
}
function selectLevel(id){
  level=LEVELS.find(l=>l.id===id)||LEVELS[0];settings={...level.default,launchDate};route=null;requestId++;save.level=id;persist();
  renderLevels();syncSliders();renderMission();renderKit();scheduleTrajectory(15,true);audio.play('click');
}
function syncSliders(){
  const range=level.range;$('speed').min=range[0];$('speed').max=range[1];$('speed').step=range[2];
  for(const key of ['heading','speed','pitch']){const el=$(key);el.value=settings[key];el.style.setProperty('--fill',100*(settings[key]-Number(el.min))/(Number(el.max)-Number(el.min))+'%');}
  $('headingOut').textContent=fmt(settings.heading,1)+'°';$('pitchOut').textContent=fmt(settings.pitch,1)+'°';
  $('speedLabel').textContent=level.id==='proxima'?'Cruise speed limit':'Injection speed';$('speedOut').textContent=level.id==='proxima'?fmt(settings.speed,3)+' c':fmt(settings.speed,3)+' km/s';
}
function renderMission(){
  $('missionNumber').textContent='MISSION '+level.number;$('missionName').textContent=level.name;$('missionDifficulty').textContent=level.difficulty;
  $('missionDescription').textContent=level.detail;
  $('orbitFrame').textContent=level.orbit==='nbody'?'3D gravity model':'Relativistic journey';
  $('orbitModel').textContent=level.orbit==='nbody'?'NASA/JPL HORIZONS · 11-BODY GRAVITY':'1g PROPER ACCELERATION · SPECIAL RELATIVITY';
  $('orbitFootnote').textContent=level.orbit==='nbody'?'Launch epoch: 00:00 TDB. Flight starts after orbit injection. Pluto uses its system barycenter.':'Ideal external drive: 1g acceleration, cruise, and 1g deceleration. Local controls affect route stability.';
  $('playDuration').innerHTML=({moon:'4–6',mars:'6–9',pluto:'8–12',proxima:'10–15'})[level.id]+'<span>min</span>';
  $('orbitMetrics').innerHTML='<div><small>Closest approach</small><strong>Calculating</strong></div><div><small>Encounter time</small><strong>—</strong></div><div><small>Forecast</small><strong>Planning</strong></div>';
}
function renderKit(){
  craft=configureMission(buildCraft(save.kit),save.missions?.[level.id],level.id);
  $('kitPills').innerHTML=Object.entries(EQUIPMENT).map(([k,c])=>`<span class="kit-pill"><span style="color:${c.color}">${k==='engine'?'↟':k==='hull'?'◇':'ϟ'}</span>${c.name}<b>${c.items[craft.kit[k]].tier}</b></span>`).join('');
  $('missionBrief').textContent=missionBrief(craft);
  $('kitPrice').textContent=usd(craft.price);$('kitMultiplier').textContent='×'+fmt(craft.multiplier,2);renderReadiness();
}
function renderReadiness(){$('missionReadiness').innerHTML=missionReadinessHTML(craft,level,route);}
function requestTrade(){
  clearTimeout(tradeTimer);const id=++tradeTicket;
  if(!route){$('tradeEstimate').textContent='Finish trajectory planning to compare science return.';return;}
  const key=JSON.stringify([level.id,settings,draft,missionDraft]);
  if(tradeCache.has(key)){const result=tradeCache.get(key);$('tradeEstimate').innerHTML=tradeEstimateHTML(result,lastTrade);lastTrade=result;return;}
  $('tradeEstimate').textContent='Estimating science return…';
  tradeTimer=setTimeout(()=>{
    try{
      if(!analysisWorker){analysisWorker=new Worker(new URL('./mission-analysis-worker.js',import.meta.url),{type:'module'});analysisWorker.onmessage=({data})=>{
        const key=tradeRequests.get(data.id);tradeRequests.delete(data.id);if(data.result&&key){tradeCache.set(key,data.result);if(tradeCache.size>30)tradeCache.delete(tradeCache.keys().next().value);}
        if(data.id!==tradeTicket)return;
        if(data.error){$('tradeEstimate').textContent='Science estimate unavailable. You can still fly this design.';return;}
        $('tradeEstimate').innerHTML=tradeEstimateHTML(data.result,lastTrade);lastTrade=data.result;
      };analysisWorker.onerror=()=>{$('tradeEstimate').textContent='Science estimate unavailable.';};}
      tradeRequests.set(id,key);analysisWorker.postMessage({id,type:'trade',level:level.id,kit:{...draft},profile:{...missionDraft},plan:route});
    }catch{$('tradeEstimate').textContent='Science estimate unavailable.';}
  },100);
}
function ensureWorker(){
  if(worker)return worker;
  try{
    worker=new Worker(new URL('./trajectory-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(data.type==='forecast'){
        if(data.id!==forecastTicket)return;forecastPending=false;
        if(!data.error&&screen==='flight')flight?.navigation?.setForecast(data.result);return;
      }
      if(data.id!==requestId)return;$('orbitBusy').hidden=true;planPending=false;
      if(data.error){route=null;pendingStart=false;$('startBtn').disabled=true;$('orbitMetrics').innerHTML=`<div><small>Forecast</small><strong class="warning">No forecast</strong></div><div class="forecast-error"><small>Date or data range</small><strong>${esc(data.error)}</strong></div><div><small>Change the date</small><strong>Recalculate</strong></div>`;return;}
      settings={...data.settings};launchDate=settings.launchDate;syncSliders();route=data.result;$('startBtn').disabled=false;renderTrajectoryMetrics();
      if(pendingStart){pendingStart=false;startGame();}
    };
    worker.onerror=()=>{$('orbitBusy').hidden=true;planPending=false;route=null;pendingStart=false;$('startBtn').disabled=true;notify('Trajectory loading failed. Reload the page and try again.');};
    return worker;
  }catch{notify('Trajectory workers are unavailable. Use a current Chrome, Edge, or Firefox browser.');return null;}
}
function scheduleTrajectory(delay=180,preset=false){
  clearTimeout(trajectoryTimer);const id=++requestId;planPending=true;$('orbitBusy').hidden=false;$('startBtn').disabled=false;
  trajectoryTimer=setTimeout(()=>{const w=ensureWorker();if(w)w.postMessage({id,type:preset?'preset':'plan',level:level.id,launchDate,settings:{...settings,launchDate}});},delay);
}
function renderTrajectoryMetrics(){
  renderReadiness();
  let status=route.collision?'Collision predicted':route.good?'Within flyby range':'Misses target';
  if(level.id==='proxima'){
    $('orbitMetrics').innerHTML=`<div><small>Earth elapsed time</small><strong>${missionTime(route.duration)}</strong></div><div><small>Onboard elapsed time</small><strong>${missionTime(route.properDuration)}</strong></div><div><small>Trajectory preview</small><strong class="${route.good?'good':'warning'}">${route.good?'Aligned':'Misses target'}</strong></div>`;
  }else $('orbitMetrics').innerHTML=`<div><small>Closest approach</small><strong>${distanceLabel(route.closest)}</strong></div><div><small>Encounter time</small><strong>${missionTime(route.closestTime)}</strong></div><div><small>Forecast</small><strong class="${route.good?'good':'warning'}">${status}</strong></div>`;
}
function openEquipment(){draft={...save.kit};missionDraft=normalizeMission(save.missions?.[level.id],level.id);renderEquipment();$('equipmentDialog').showModal();}
function renderEquipment(){
  const dc=configureMission(buildCraft(draft),missionDraft,level.id);
  $('missionDesign').innerHTML=missionEditorHTML(buildCraft(draft),missionDraft,level,route);
  $('equipmentOptions').innerHTML=Object.entries(EQUIPMENT).map(([key,category])=>`<section class="equipment-section"><h3><span style="color:${category.color}">${key==='engine'?'↟':key==='hull'?'◇':'ϟ'}</span>${category.name}<small>Compare performance, mass, and score</small></h3><div class="equipment-row">${category.items.map((item,i)=>`<button class="equipment-item ${draft[key]===i?'selected':''}" data-equipment="${key}" data-tier="${i}" aria-pressed="${draft[key]===i}"><div><span class="tier">${item.tier}</span><span class="item-check">${draft[key]===i?'✓':'○'}</span></div><h4>${item.name}</h4><p class="tag">${item.tag}</p><p class="item-stats">${item.detail}</p><p class="item-note">${item.note}</p><div class="item-price"><span>${usd(item.price)}</span><small>${item.bonus?'Score +'+Math.round(item.bonus*100)+'%':'Base score'}</small></div></button>`).join('')}</div></section>`).join('');
  $('billLines').innerHTML=`<div class="bill-line"><span>Base spacecraft and injection service</span><span>${usd(120000)}</span></div>`+Object.entries(EQUIPMENT).map(([key,c])=>`<div class="bill-line"><span>${c.name} · ${c.items[draft[key]].name}</span><span>${usd(c.items[draft[key]].price)}</span></div>`).join('');
  $('billLines').innerHTML+=`<div class="bill-line"><span>Science instrument / ${dc.mission.instrument.name}</span><span>${usd(dc.mission.instrument.price)}</span></div><div class="bill-line"><span>Communications / ${dc.mission.radio.name}</span><span>${usd(dc.mission.radio.price)}</span></div><div class="bill-line"><span>Injection service upgrade</span><span>${usd(dc.mission.launcher.extraCost)}</span></div>`;
  $('billTotal').textContent=usd(dc.price);$('billMultiplier').textContent='×'+fmt(dc.multiplier,2);
  $('equipmentImpact').textContent=engineeringImpactHTML(dc,craft);requestTrade();
}
function syncFlightMode(){const active=Boolean(flight?.pilot3D?.active);$('modeBtn').textContent=active?'3D COCKPIT':'2D VIEW';$('modeBtn').setAttribute('aria-pressed',String(active));$('touchControls').hidden=active;$('touch3DControls').hidden=!active;$('caption2D').hidden=active;$('caption3D').hidden=!active;$('threeDBonus').hidden=!flight?.pilot3D;$('tutorialHint').innerHTML=active?'<b>Fly in three dimensions.</b><span>W/S forward/reverse · A/D left/right · Q/E descend/ascend.<br>Space cuts thrust. Use short burns and follow course guidance.</span>':originalTutorial;}
function toggleFlightMode(){if(screen!=='flight'||paused||gameFinished)return;const active=!flight.pilot3D?.active;flight.setFlightMode(active?'3d':'2d');if(active){if(!cockpitRenderer)cockpitRenderer=new CockpitRenderer($('gameCanvas'),flight.seed);cockpitRenderer.effects=[];}else{renderer.cameraX=flight.x;renderer.cameraY=flight.y;renderer.particles=[];renderer.labels=[];renderer.flash=0;renderer.shake=0;}clearInput();syncFlightMode();updateHUD();audio.play('click');$('gameCanvas').focus({preventScroll:true});}
$('modeBtn').onclick=toggleFlightMode;
function clearInput(){keyboardHeld=Object.fromEntries(Object.keys(held).map(k=>[k,false]));touchHeld={...keyboardHeld};for(const k of Object.keys(held))held[k]=false;document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'));}
function applyInput(){for(const k of Object.keys(held))held[k]=keyboardHeld[k]||touchHeld[k];}
function setScreen(next){
  screen=next;$('hangar').hidden=next!=='hangar';$('flightScreen').hidden=next!=='flight';$('resultScreen').hidden=next!=='result';
  document.body.classList.toggle('flying',next==='flight');$('footer').hidden=next==='flight';
  $('albumBtn').disabled=next==='flight';community?.flightState(next==='flight');window.scrollTo({top:0,behavior:'instant'});
}
async function startGame(){
  if(startingGame)return;
  if(!activePlayer){community?.welcome();return;}
  if(screen==='flight'&&!gameFinished)return;
  if(planPending){pendingStart=true;notify('Preparing the trajectory for this date. Flight will start when it is ready.');return;}
  if(!route){notify('Choose an available date and finish trajectory planning first.');return;}
  startingGame=true;
  if(level.id!=='proxima'&&!ephemeris){try{await ephemerisReady;}catch(e){startingGame=false;notify(e.message);return;}}
  for(const d of document.querySelectorAll('dialog[open]'))d.close();clearInput();
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];craft=configureMission(buildCraft(save.kit),save.missions?.[level.id],level.id);
  try{flight=new Flight(level,craft,seed,new Navigation(level,route,ephemeris,craft));activeFlightId=newFlightId();}catch(e){startingGame=false;notify(e.message);return;}
  renderer=new FlightRenderer($('gameCanvas'),seed);cockpitRenderer=null;syncFlightMode();forecastTicket++;forecastPending=false;forecastElapsed=0;
  starLeg=level.id==='proxima'?relativisticLeg(level.distance,settings.speed):null;paused=false;gameFinished=false;accumulator=0;hudTime=0;lastFrame=performance.now();
  $('flightDestination').textContent=level.en;$('liveMultiplier').textContent='×'+fmt(craft.multiplier*level.score,2);
  $('clocks').hidden=level.id!=='proxima';$('tutorialHint').hidden=false;$('flightToast').hidden=true;clearTimeout(flightToastTimer);
  $('healthCells').innerHTML=Array.from({length:craft.maxHealth},()=>'<i></i>').join('');
  setScreen('flight');audio.unlock();audio.play('start');updateHUD();$('gameCanvas').focus({preventScroll:true});startingGame=false;
}
function updateHUD(){
  if(!flight)return;const f=flight;
  $('score').textContent=String(Math.floor(f.totalScore)).padStart(6,'0');$('comboLabel').hidden=f.combo<2;$('comboLabel').querySelector('b').textContent=f.combo;
  const nav=f.navigation;
  $('mileage').textContent=distanceLabel(nav.distanceKm);$('flightTimer').textContent='Flight progress '+fmt(f.progress*100,1)+'%';
  $('fuelValue').textContent=fmt(f.fuel,1)+' kg';$('energyValue').textContent=fmt(f.energy,1)+' Wh';
  $('healthValue').textContent=f.health+'/'+craft.maxHealth+' · Damage '+Math.round((1-f.health/craft.maxHealth)*100)+'%';
  for(const [id,fraction] of [['fuelBar',f.fuel/craft.maxFuel],['energyBar',f.energy/craft.maxEnergy]]){$(id).style.width=100*fraction+'%';$(id).classList.toggle('low',fraction<.2);}
  $('healthCells').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('empty',i>=f.health));
  $('stabilityValue').textContent=fmt(f.stability,0)+'%';$('stabilityBar').style.width=f.stability+'%';$('stabilityBar').classList.toggle('warning',f.stability>=30&&f.stability<60);$('stabilityBar').classList.toggle('low',f.stability<30);
  const hint=f.pilot3D?.active?cockpitGuidance(nav):nav.guidance;$('navigationHint').hidden=!hint;
  if(hint){$('navigationArrow').textContent=({left:'←',right:'→',up:'↑',coast:'↓',rise:'↑',fall:'↓'})[hint];$('navigationHintText').textContent=f.pilot3D?.active?({left:'LEFT / A',right:'RIGHT / D',up:'FORWARD / W',coast:'COAST / SPACE',rise:'ASCEND / E',fall:'DESCEND / Q'})[hint]:hint==='coast'?'Coast':'Correct course';}
  $('journeyFill').style.width=f.progress*100+'%';$('journeyRocket').style.left=`calc(${f.progress*100}% - 7px)`;
  $('phaseName').textContent=f.phaseName();$('tutorialHint').hidden=f.time>16;
  const thrust=Math.hypot(f.thrustX,f.thrustY,f.pilot3D?.active?f.pilot3D.thrustZ:0)>.01;$('engineState').classList.toggle('active',thrust||nav.lastAutoThrottle>0);$('engineState').innerHTML='<i></i>'+(thrust?'Thrusting / using fuel':nav.lastAutoThrottle>0?'Navigation trim / using fuel':f.fuel<=0?'No fuel / coasting':'Coasting / no fuel use');
  $('localSpeed').textContent='Speed relative to route '+fmt(nav.localSpeed,1)+' m/s';
  if(f.science){
    const sc=f.science,report=sc.report(),star=nav.isStar,mb=report.sciencePercent;
    $('scienceHud').textContent=`SCIENCE ${fmt(mb)}% · ${sc.observing?'Observing':'Cruising'} · ${star?'Onboard archive':'Earth received'} ${fmt(star?sc.storedMB+sc.transmittedMB:sc.receivedMB,2)} MB${sc.geometry.blocked?' · Link blocked':''}`;
    const previous=f.scienceEvents||{observing:false,full:false,blocked:false,received:false};
    const current={observing:sc.observing,full:sc.droppedMB>1e-6,blocked:sc.geometry.blocked,received:!star&&sc.receivedMB>=sc.design.objective.requiredMB};
    const message=current.full&&!previous.full?'Storage full':current.blocked&&!previous.blocked?'Earth communication blocked':current.received&&!previous.received?'Science data received':current.observing&&!previous.observing?'Science observation active':null;
    if(message)eventToast({type:'science',text:message});f.scienceEvents=current;
  }
  if(f.pilot3D){$('threeDBonus').textContent='3D BONUS +'+fmt(f.pilot3D.bonus,0);}
  if(nav.isStar){$('earthClock').textContent=missionTime(nav.earthTime||0);$('shipClock').textContent=missionTime(nav.shipTime||0);}
}
function eventToast(event){
  const priority=['warning','hit','phase','escape','notice','gravity'].includes(event.type);
  if(!priority&&flight.time-lastToastAt<1)return;
  lastToastAt=flight.time;clearTimeout(flightToastTimer);$('flightToast').textContent=event.text;
  $('flightToast').className='flight-toast '+(event.type==='collect'?'collect':['phase','escape'].includes(event.type)?'phase':'');$('flightToast').hidden=false;
  flightToastTimer=setTimeout(()=>$('flightToast').hidden=true,priority?3200:1500);
}
function pauseGame(){if(screen!=='flight'||paused||gameFinished)return;paused=true;clearInput();audio.play('click');$('pauseDialog').showModal();}
function resumeGame(){if(screen!=='flight')return;$('pauseDialog').close();paused=false;accumulator=0;lastFrame=performance.now();clearInput();audio.unlock();$('gameCanvas').focus({preventScroll:true});}
function stopGame(){if(!flight||gameFinished)return;flight.finish('aborted','Flight ended by player');$('pauseDialog').close();finishGame();}
async function finishGame(){
  if(gameFinished)return;gameFinished=true;paused=false;clearInput();
  const r=makeFlightRecord(flight,{playerId:activePlayer,flightId:activeFlightId,launch:settings,plan:route,ephemeris});
  const success=r.status==='arrived',photos=success?PHOTOS.filter(p=>p.target===r.level):[];
  const photo=photos.find(p=>!save.photos.includes(p.id))||photos[(save.records.filter(x=>x.level===r.level&&x.status==='arrived').length)%Math.max(1,photos.length)]||null;
  const meta=recordFlight(save,r,photo);persist();lastRecord=r;lastReward=photo;lastResultMeta=meta;updateCollectionCount();renderResults(r,photo,meta);audio.play(success?'arrived':'failed');
  setScreen('result');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  try{await archive.put(r);await community.updateSaveStatus();}catch(error){$('resultSaveStatus').textContent=error.message;notify(error.message);}
}
function renderResults(r,photo,meta){
  const success=r.status==='arrived',title=success?`Hello, ${level.name}.`:'Flight complete.';
  const reward=photo?`<small>${meta.isNewPhoto?'NEW POSTCARD':'MISSION POSTCARD'}</small><img src="${photo.local_url}" alt="${esc(photo.title)}"><h3>${esc(photo.title)}</h3><p>Archived observation<br>${esc(photo.credit)}</p><a href="${photo.source_url}" target="_blank" rel="noreferrer">View NASA source image ↗</a>`:`<small>${success?'ARRIVAL CARD':'NEXT TIME, A LITTLE FURTHER'}</small><div class="photo-empty">${planetSVG(level.id)}<h3>${success?'Pluto arrival card':'Your next postcard is waiting.'}</h3><p>${success?'This destination has an arrival card. Your mission record has been saved.':'Reach the destination to unlock its collection.'}</p></div>`;
  $('resultScreen').innerHTML=`<div class="results"><div class="result-heading"><p class="eyebrow">${success?'DESTINATION REACHED':'FLIGHT COMPLETE'} / ${level.en}</p><h1 id="resultTitle">${title}</h1><p>${success?'Destination reached. Review your science return below.':esc(r.reason)+'. Adjust your design and try again.'}</p></div><div class="result-layout"><article class="result-main"><div class="result-art"><canvas id="resultCanvas" aria-label="Rocket and destination illustration"></canvas></div><div class="result-score"><small>FINAL SCORE</small><strong>${fmt(r.totalScore)}</strong><div class="final-breakdown"><span>Original Arcade Score <b>${fmt(r.arcadeScore)}</b></span><span>NASA Mission Bonus <b>+${fmt(r.missionBonus)}</b></span><span>Science Mission Grade <b>${esc(r.missionGrade)}</b></span><span>Mission Result <b>${r.missionComplete?'Complete':success?'Arrived / science incomplete':'Incomplete'}</b></span></div>${r.threeDSeconds>0?`<p class="cockpit-score-breakdown">Base ${fmt(r.baseScore)} + 3D bonus ${fmt(r.threeDBonus,0)}</p>`:''}${meta.isBest?'<span class="result-record">✦ New personal best</span>':'<span class="result-record">Every flight counts</span>'}<p>Equipment ×${fmt(r.multiplier,2)} · Destination ×${fmt(level.score,2)}<br>Survival, pickups, near misses, and combos${success?' · Includes arrival bonus':''}</p></div><div class="result-stats"><div><small>Physical path length</small><strong>${distanceLabel(r.distance)}</strong></div><div><small>Play time</small><strong>${clock(r.time)}</strong></div><div><small>Near misses</small><strong>${r.nearMisses}</strong></div><div><small>Best combo</small><strong>${r.maxCombo} COMBO</strong></div>${r.earthTime!==undefined?`<div><small>Earth time / ideal journey</small><strong>${missionTime(r.earthTime)}</strong></div><div><small>Onboard time / ideal journey</small><strong>${missionTime(r.shipTime)}</strong></div>`:''}</div></article><aside class="result-side"><div class="result-photo">${reward}</div><div class="flight-recap"><h3>Flight recap</h3><div class="recap-row"><span>Supplies collected</span><b>${r.collected}</b></div><div class="recap-row"><span>Direct impacts</span><b>${r.hits}</b></div><div class="recap-row"><span>Gravity traps escaped</span><b>${r.blackholesEscaped}</b></div><div class="recap-row"><span>Fuel remaining</span><b>${fmt(r.fuel,1)} kg</b></div><div class="recap-row"><span>Energy remaining</span><b>${fmt(r.energy,1)} Wh</b></div><div class="recap-row"><span>Route stability</span><b>${fmt(r.stability??100)}%</b></div><div class="recap-row"><span>Simulated elapsed time</span><b>${missionTime((r.navigation?.simulatedDays||0)*86400)}</b></div><div class="recap-row"><span>Equipment cost</span><b>${usd(r.price)}</b></div></div></aside></div>${missionDebriefHTML(r)}<div class="result-actions"><button class="primary-button" id="returnBtn">Choose destination ↗</button><button class="secondary-button" id="againBtn">Fly this design again</button></div><p class="result-fine" id="resultSaveStatus" data-flight-id="${esc(r.flightId)}">Saving flight…</p><button class="quiet-button result-leaderboard" id="resultLeaderboardBtn">Local Leaderboard ↗</button></div>`;
  $('resultLeaderboardBtn').onclick=()=>{community.level=r.level;community.show('leaderboard');};
  $('returnBtn').onclick=()=>{setScreen('hangar');renderLevels();};$('againBtn').onclick=startGame;
  requestAnimationFrame(()=>{
    const {ctx:c,w,h}=fitCanvas($('resultCanvas'));const rand=seedFrom(String(r.seed));
    for(let i=0;i<35;i++){const x=((rand>>>i%20)*(.137+i))%1*w,y=((i*79.13)%h);c.fillStyle=i%3?'#a4b8e052':'#d4b5f78c';c.beginPath();c.arc(x,y,i%3?.7:1.6,0,7);c.fill();}
    drawPlanet(c,w*.68,h*.56,46,level.id,.85);drawRocket(c,w*.39,h*.6,1.1,success?.4:-.22,success?1:0,r.time,!success);
    if(success){c.fillStyle='#d9c5fa';c.font='18px system-ui';c.fillText('✦',w*.25,h*.32);c.font='12px system-ui';c.fillText('✧',w*.53,h*.25);}
  });
}
function renderAlbum(){
  const known=PHOTOS.filter(p=>save.photos.includes(p.id));
  let html=known.map(p=>`<article class="photo-card"><img src="${p.local_url}" alt="${esc(p.title)}" loading="lazy"><div><h3>${esc(p.title)}</h3><p>${esc(p.kind)}<br>${esc(p.credit)}</p><a href="${p.source_url}" target="_blank" rel="noreferrer">Source image and credits ↗</a></div></article>`).join('');
  for(const l of LEVELS){
    if(l.id==='pluto'&&save.completed.includes('pluto'))html+=`<article class="album-locked">${planetSVG('pluto')}<b>Pluto / arrival card ✓</b><p>Mission completed. No archived photo is bundled for this destination.</p></article>`;
    else if(!known.some(p=>p.target===l.id))html+=`<article class="album-locked">${planetSVG(l.id)}<b>${l.name} · Awaiting your arrival</b><p>Reach ${l.name}<br>${l.id==='pluto'?'Unlock an arrival card':'Unlock an archived observation'}</p></article>`;
  }
  $('albumGrid').innerHTML=html;
}
function showHelp(science=false){if(screen==='flight'&&!paused)pauseGame();$('helpDialog').showModal();$('scienceDetails').open=science;}
function toggleSound(){audio.enabled=!audio.enabled;save.sound=audio.enabled;persist();audio.unlock();audio.play('click');renderSound();}
function renderSound(){$('soundBtn').setAttribute('aria-pressed',String(audio.enabled));$('soundBtn').setAttribute('aria-label',audio.enabled?'Mute sound':'Enable sound');$('soundBtn').style.color=audio.enabled?'#9ce4cf':'#a0a7bf';$('soundBtn').textContent=audio.enabled?'♫':'♪';}

// Event handlers stay on the single application page.
$('levelCards').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(b)selectLevel(b.dataset.level);});
for(const key of ['heading','speed','pitch'])$(key).addEventListener('input',()=>{settings[key]=Number($(key).value);syncSliders();scheduleTrajectory();});
$('presetBtn').onclick=()=>{scheduleTrajectory(10,true);audio.play('click');};
$('launchDate').value=launchDate;
$('launchDate').addEventListener('change',()=>{launchDate=$('launchDate').value;settings.launchDate=launchDate;pendingStart=false;scheduleTrajectory(10);});
$('viewBtn').onclick=()=>{map.projection=map.projection==='xy'?'xz':'xy';$('viewBtn').textContent=map.projection==='xy'?'Top XY ↗':'Side XZ ↗';$('projectionNote').textContent=map.projection==='xy'?'Top projection / checks use 3D distance':'Side projection / out-of-plane angle';};
$('equipmentBtn').onclick=openEquipment;
$('equipmentOptions').addEventListener('click',e=>{const b=e.target.closest('[data-equipment]');if(b){draft[b.dataset.equipment]=Number(b.dataset.tier);renderEquipment();audio.play('click');}});
$('missionDesign').addEventListener('change',e=>{const field=e.target.dataset.mission;if(!field)return;missionDraft[field]=e.target.value;renderEquipment();document.querySelector(`[data-mission="${field}"]`).focus();});
$('saveEquipment').onclick=()=>{save.kit={...draft};save.missions[level.id]=normalizeMission(missionDraft,level.id);persist();renderKit();$('equipmentDialog').close();audio.play('click');};
$('startBtn').onclick=startGame;$('pauseBtn').onclick=pauseGame;$('resumeBtn').onclick=resumeGame;$('quitBtn').onclick=stopGame;
$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resumeGame();});
async function showSources(){if(screen==='flight'&&!paused)pauseGame();if(!$('sourcesDialog').open)$('sourcesDialog').showModal();try{$('sourcesContent').innerHTML=resourceHTML(await resourceManifest,ephemeris?.meta);}catch(e){$('sourcesContent').textContent=e.message;}}
$('sourcesBtn').onclick=showSources;
document.addEventListener('click',e=>{if(e.target.closest('[data-open-sources]'))showSources();});
$('helpBtn').onclick=()=>showHelp();$('scienceBtn').onclick=()=>showHelp(true);$('soundBtn').onclick=toggleSound;
$('albumBtn').onclick=()=>{renderAlbum();$('albumDialog').showModal();};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog:not(#pauseDialog)').forEach(d=>d.addEventListener('click',e=>{if(d.id==='playerDialog'||e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('flightScreen').requestFullscreen();}catch{notify('Fullscreen is unavailable. You can continue playing.');}};
const keyMap2D={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
const keyMap3D={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'reverse',a:'left',d:'right',w:'up',s:'reverse',q:'fall',e:'rise',' ':'coast'};
const flightKeyMap=()=>flight?.pilot3D?.active?keyMap3D:keyMap2D;
window.addEventListener('keydown',e=>{
  if(screen!=='flight')return;const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(key==='v'&&!e.repeat){e.preventDefault();toggleFlightMode();return;}
  const keyMap=flightKeyMap();
  if((key==='p'||key==='Escape')&&!e.repeat){if($('helpDialog').open||$('sourcesDialog').open)return;e.preventDefault();paused?resumeGame():pauseGame();return;}
  if(keyMap[key]){e.preventDefault();if(!paused){keyboardHeld[keyMap[key]]=true;applyInput();}}
});
window.addEventListener('keyup',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key,keyMap=flightKeyMap();if(keyMap[key]){keyboardHeld[keyMap[key]]=false;applyInput();if(screen==='flight')e.preventDefault();}});
for(const b of document.querySelectorAll('[data-key]')){
  b.addEventListener('pointerdown',e=>{if(screen!=='flight'||paused)return;e.preventDefault();b.setPointerCapture(e.pointerId);touchHeld[b.dataset.key]=true;applyInput();b.classList.add('pressed');audio.unlock();});
  const release=()=>{touchHeld[b.dataset.key]=false;applyInput();b.classList.remove('pressed');};for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,release);
}
window.addEventListener('blur',()=>{clearInput();if(screen==='flight'&&!paused)pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(screen==='flight'&&!paused)pauseGame();}});
window.addEventListener('beforeunload',e=>{if(screen==='flight'&&!gameFinished){e.preventDefault();e.returnValue='';}});

function frame(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.25):0;lastFrame=now;
  if(screen==='hangar')map.draw(now/1000);
  else if(screen==='flight'&&flight){
    if(!paused&&!gameFinished){
      accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps++<32){flight.step(held,1/120);accumulator-=1/120;if(flight.status!=='playing')break;}
      for(const ev of flight.events.splice(0)){if(flight.pilot3D?.active)cockpitRenderer?.effect(ev);else renderer.effect(ev);audio.play(ev.type);if(!['arrived','failed','aborted'].includes(ev.type))eventToast(ev);}
      hudTime+=dt;if(hudTime>.065){updateHUD();hudTime=0;}
      forecastElapsed+=dt;
      if(forecastElapsed>=3&&!forecastPending&&flight.status==='playing'){
        const q=flight.navigation.forecastRequest();if(q){forecastPending=true;forecastElapsed=0;ensureWorker()?.postMessage({type:'forecast',id:++forecastTicket,...q});}
      }
      if(flight.status!=='playing'){updateHUD();finishGame();}
    }
    if(screen==='flight'){if(flight.pilot3D?.active)cockpitRenderer.draw(flight,paused?0:dt);else renderer.draw(flight,paused?0:dt);}
  }
  requestAnimationFrame(frame);
}
community=new CommunityUI({archive,service,canSwitch:()=>screen!=='flight',legacyRecords:()=>save.legacyRecords||save.records.filter(r=>!r.scoreVersion),onPlayer:id=>{
  activePlayer=id;const profile=readPlayerSave(id);for(const key of Object.keys(save))delete save[key];Object.assign(save,profile);
  level=LEVELS.find(l=>l.id===save.level)||LEVELS[0];settings={...level.default,launchDate};route=null;pendingStart=false;audio.enabled=save.sound;lastTrade=null;
  renderLevels();renderMission();renderKit();syncSliders();renderSound();updateCollectionCount();setScreen('hangar');scheduleTrajectory(10,true);persist();
}});
renderLevels();renderMission();renderKit();syncSliders();renderSound();updateCollectionCount();scheduleTrajectory(10,true);requestAnimationFrame(frame);community.welcome();
if(location.protocol==='file:')notify('Extract the ZIP, then use start_windows.bat or python run.py to start the game.');
