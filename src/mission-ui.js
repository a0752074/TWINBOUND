import {fmt,usd,missionTime,G0,NAVIGATION} from './config.js';
import {INSTRUMENTS,RADIOS,LAUNCHERS,BUDGETS,OBJECTIVES,objectivesFor,configureMission,designChecks,normalizeMission} from './mission.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(items,selected)=>Object.entries(items).map(([id,name])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(name)}</option>`).join('');
const checkList=checks=>`<ul class="design-checks">${checks.map(c=>`<li class="${c.pass?'pass':'issue'}"><b>${c.pass?'✓':'!'}</b> ${esc(c.label)}</li>`).join('')}</ul>`;
export function missionEditorHTML(base,profile,level,route) {
  const p=normalizeMission(profile,level.id),craft=configureMission(base,p,level.id),m=craft.mission;
  return `<details class="mission-design" open><summary>SCIENCE BRIEF / ${esc(m.objective.name)}</summary>
  <p class="mission-explainer">${p.instrument===OBJECTIVES[p.objective].instrument?'Compatible instrument selected.':`${esc(m.instrument.name)} measures ${esc(m.instrument.measures)}; this objective requires ${esc(INSTRUMENTS[OBJECTIVES[p.objective].instrument].measures)}.`} Required instrument: <b>${esc(INSTRUMENTS[OBJECTIVES[p.objective].instrument].name)}</b>.</p>
  <div class="mission-fields">
  <label>Science objective<select data-mission="objective">${options(Object.fromEntries(objectivesFor(level.id).map(id=>[id,OBJECTIVES[id].name])),p.objective)}</select></label>
  <label>Science instrument<select data-mission="instrument">${options(Object.fromEntries(Object.entries(INSTRUMENTS).map(([id,v])=>[id,`${v.name} / ${v.mass} kg / ${v.powerW} W`])),p.instrument)}</select></label>
  <label>Communications<select data-mission="radio">${options(Object.fromEntries(Object.entries(RADIOS).map(([id,v])=>[id,`${v.name} / ${v.mass} kg / ${v.powerW} W`])),p.radio)}</select></label>
  <label>Injection service<select data-mission="launcher">${options(Object.fromEntries(Object.entries(LAUNCHERS).map(([id,v])=>[id,`${v.name} / ${v.capacityKg} kg`])),p.launcher)}</select></label>
  <label>Budget cap<select data-mission="budget">${options(Object.fromEntries(Object.entries(BUDGETS).map(([id,v])=>[id,usd(v)])),p.budget)}</select></label>
  <div class="science-requirement"><small>SUCCESS REQUIREMENT</small><strong>${fmt(m.objective.requiredMB,1)} MB ${level.id==='proxima'?'recorded onboard':'received on Earth'}</strong><span>Reach ${esc(level.name)} and satisfy the design checks.</span></div>
  </div>
  <div class="design-totals"><span>Wet mass <b>${fmt(craft.dryMass+craft.maxFuel)} / ${m.launcher.capacityKg} kg</b></span><span>Budget <b>${usd(craft.price)} / ${usd(m.budget)}</b></span><span>Storage <b>${m.instrument.storageMB} MB</b></span><span>Science + radio <b>up to ${m.instrument.powerW+m.radio.powerW} W extra</b></span></div>
  ${checkList(designChecks(craft,route?.goalDay??0))}
  <p class="mission-explainer">You can fly with an unresolved design issue. The flight score stays valid; the mission report will identify the unmet requirement.</p>
  <details class="trade-study"><summary>Compare instrument designs</summary><div class="table-scroll"><table><thead><tr><th>Instrument</th><th>Mass</th><th>Power</th><th>Data / control s</th><th>Cost</th></tr></thead><tbody>${Object.entries(INSTRUMENTS).map(([id,i])=>`<tr class="${p.instrument===id?'chosen':''}"><td>${esc(i.name)}</td><td>${i.mass} kg</td><td>${i.powerW} W</td><td>${i.dataMBps} MB</td><td>${usd(i.price)}</td></tr>`).join('')}</tbody></table></div></details>
  <p class="source-note">Design approach: NASA mission development, Mission Design Lab, CubeSat 101, and Build It Yourself. <button type="button" data-open-sources>Read the sources ↗</button></p></details>`;
}
export function missionBrief(craft) {
  const m=craft.mission;
  return `${m.objective.name} / ${m.objective.requiredMB} MB ${m.selection.objective==='clocks'?'onboard':'science target'}`;
}
export function missionReadinessHTML(craft,level,route){
  const days=level.id==='proxima'?(route?.duration??0)/86400:route?.goalDay??0;
  const checks=designChecks(craft,days),m=craft.mission;
  const endReserve=craft.maxEnergy+(craft.power.generation-1800-m.instrument.powerW-m.radio.powerW)*NAVIGATION[level.id].playSeconds/3600;
  const rows=[
    ['Science Design',checks[0].pass?'Pass':'Fail',checks[0].pass?'Instrument matches the objective':'Choose a compatible instrument to earn science return'],
    ['Launch Capacity',checks[1].pass?'Pass':'Fail',`${fmt(craft.dryMass+craft.maxFuel)} / ${m.launcher.capacityKg} kg`],
    ['Power and Storage',endReserve>0?'Pass':'Warning',endReserve>0?`${m.instrument.storageMB} MB storage`:'Energy pickups may be needed'],
    ['Communications',level.id==='proxima'?'Warning':'Pass',level.id==='proxima'?'Onboard archive; Earth delivery is separate':'Science requires data received on Earth'],
    ['Mission Risks',!route?'Warning':checks.slice(2).some(x=>!x.pass)||!route.good?'Warning':'Pass',!route?'Waiting for trajectory':!checks[2].pass?'Selected budget is below equipment cost':!checks[3].pass?'Planned duration exceeds design lifetime':!route.good?'Trajectory misses the destination':'Reference transfer reaches flyby range']
  ];
  return `<summary>Mission Readiness <span>${rows.filter(x=>x[1]==='Pass').length} / 5 Pass</span></summary><div class="readiness-list">${rows.map(([topic,state,detail])=>`<div><b>${topic}</b><span class="readiness-${state.toLowerCase()}">${state}</span><small>${esc(detail)}</small></div>`).join('')}</div>`;
}
export function engineeringImpactHTML(craft,reference){
  const dv=c=>c.engine.isp*G0*Math.log((c.dryMass+c.maxFuel)/c.dryMass),delta=(a,b,suffix)=>`${a-b>=0?'+':''}${fmt(a-b,0)} ${suffix}`;
  return `${fmt(craft.dryMass+craft.maxFuel)} kg wet mass (${delta(craft.dryMass+craft.maxFuel,reference.dryMass+reference.maxFuel,'kg')}) · ${fmt(dv(craft))} m/s available Δv (${delta(dv(craft),dv(reference),'m/s')}) · ${usd(craft.price)} · Arcade ×${fmt(craft.multiplier,2)}`;
}
export function tradeEstimateHTML(study,previous){
  const creditOf=x=>x.selection.instrument===OBJECTIVES[x.selection.objective].instrument?(x.selection.level==='proxima'?x.projection.storedMB+x.projection.transmittedMB:x.projection.receivedMB):0;
  const credit=creditOf(study);
  const compatiblePrevious=previous?.selection.level===study.selection.level&&previous?.selection.objective===study.selection.objective;
  const before=compatiblePrevious?creditOf(previous):null;
  const change=before===null?'':` (${credit-before>=0?'+':''}${fmt(credit-before,2)} MB vs previous estimate)`;
  return `<small>REFERENCE TRANSFER ESTIMATE</small><p>${fmt(study.mass.wetKg)} kg · ${fmt(study.propulsion.initialDeltaVMS)} m/s Δv · ${study.power.generationW} W generation / up to ${study.power.coastObservationPeakW} W load</p><p>${fmt(credit,2)} MB estimated ${study.selection.level==='proxima'?'onboard archive':'valid Earth receipts'}${esc(change)} · ${fmt(study.storage.droppedMB,2)} MB estimated loss</p><span>Estimate assumes no thrust, obstacles or pickups; actual flight results may differ.</span>`;
}
export function missionReportHTML(r) {
  if(!r)return '';
  return `<article class="science-report"><p class="eyebrow">MISSION DEBRIEF</p><h2>${r.complete?'Science mission complete':'Science mission review'}</h2><p>${esc(r.objective)} / ${esc(r.deliverable)}</p>
  <div class="science-report-grid"><div>${checkList(r.checks)}<p class="mission-explainer">${esc(r.interpretation)}</p></div><div class="design-totals"><span>Science requirement achieved <b>${fmt(r.sciencePercent,1)}%</b></span><span>Generated <b>${fmt(r.generatedMB,2)} MB</b></span><span>Received on Earth <b>${fmt(r.receivedMB,2)} MB</b></span><span>In transit <b>${fmt(r.inTransitMB,2)} MB</b></span><span>Stored onboard <b>${fmt(r.storedMB,2)} MB</b></span><span>Dropped: storage full <b>${fmt(r.droppedMB,2)} MB</b></span><span>One-way light time <b>${r.oneWayLightSeconds<3600?fmt(r.oneWayLightSeconds,1)+' s':missionTime(r.oneWayLightSeconds)}</b></span><span>Science + radio energy <b>${fmt(r.extraEnergyWh,2)} Wh</b></span></div></div>
  <p class="mission-explainer">${esc(r.timeModel)}</p><div class="report-actions"><button class="quiet-button" data-open-sources>NASA data and resource trace ↗</button></div></article>`;
}
export function resourceHTML(manifest,ephemeris) {
  return `<p class="mission-explainer">NASA data and methods used in TWINBOUND.</p>
  <div class="source-data-summary"><b>NASA/JPL Horizons</b><p>${ephemeris?.bodies?.length??11} moving gravity sources · Ecliptic J2000 · Solar System barycenter · TDB · AU and AU/day.</p><p>Data: 2025–2051. Launch dates: 2025-01-01 to 2030-12-31.</p></div>
  <div class="source-cards">${manifest.resources.map(s=>`<article><small>${esc(s.role)}</small><h3><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a></h3><p>${esc(s.implementation)}</p>${s.location?`<p class="source-location">${esc(s.location)}</p>`:''}${s.files?.length?`<details><summary>Technical trace</summary><div class="source-paths"><b>Implementation files</b><ul>${s.files.map(file=>`<li><code>${esc(file)}</code></li>`).join('')}</ul>${s.functions?.length?`<b>Key functions</b><ul>${s.functions.map(fn=>`<li><code>${esc(fn)}</code></li>`).join('')}</ul>`:''}</div></details>`:''}</article>`).join('')}</div>`;
}
