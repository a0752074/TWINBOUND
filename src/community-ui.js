import {LEVELS,fmt} from './config.js';
import {lastPlayer,rememberPlayer,normalizePlayerId} from './flight-service.js';
import {flightReportHTML} from './flight-report.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'});};
export class CommunityUI {
  constructor({archive,service,onPlayer,canSwitch,legacyRecords}){
    Object.assign(this,{archive,service,onPlayer,canSwitch,legacyRecords});this.playerId='';this.level='moon';this.view='leaderboard';this.offset=0;this.ticket=0;
    $('playerForm').addEventListener('submit',e=>{e.preventDefault();this.enter();});
    $('playerDialog').addEventListener('cancel',e=>{if(!this.playerId)e.preventDefault();});
    $('switchPlayerBtn').onclick=()=>{if(this.canSwitch())this.welcome();};
    $('leaderboardBtn').onclick=()=>this.show('leaderboard');$('recordsBtn').onclick=()=>this.show('history');
    $('boardTabs').innerHTML=LEVELS.map(l=>`<button data-board-level="${l.id}" class="board-tab">${l.name}</button>`).join('');
    $('boardTabs').addEventListener('click',e=>{const b=e.target.closest('[data-board-level]');if(b){this.level=b.dataset.boardLevel;this.view='leaderboard';this.offset=0;this.refresh();}});
    $('myFlightsBtn').onclick=()=>{this.view='history';this.offset=0;this.refresh();};
    $('localBoardBtn').onclick=()=>{this.view='leaderboard';this.offset=0;this.refresh();};
    $('legacyFlightsBtn').onclick=()=>{this.view='legacy';this.offset=0;this.refresh();};
    $('boardRefreshBtn').onclick=()=>this.refresh();
    $('boardPrevBtn').onclick=()=>{this.offset=Math.max(0,this.offset-50);this.refresh();};
    $('boardNextBtn').onclick=()=>{this.offset+=50;this.refresh();};
    for(const id of ['recordList','ownBest'])$(id).addEventListener('click',e=>{const b=e.target.closest('[data-flight-id]');if(b)this.openFlight(b.dataset.flightId);});
  }
  welcome(){if(!this.canSwitch())return;$('playerInput').value=this.playerId||lastPlayer();$('playerError').textContent='';if(!$('playerDialog').open)$('playerDialog').showModal();$('playerInput').focus();}
  enter(){
    if(!this.canSwitch())return;
    try{const id=normalizePlayerId($('playerInput').value);this.onPlayer(id);this.playerId=id;rememberPlayer(id);$('playerTag').textContent=id;$('playerDialog').close();}
    catch(error){$('playerError').textContent=error.message;}
  }
  flightState(flying){for(const id of ['switchPlayerBtn','leaderboardBtn','recordsBtn'])$(id).disabled=flying;}
  async updateSaveStatus(){
    const current=$('resultSaveStatus');if(!current)return;
    const row=await this.archive.get(current.dataset.flightId);
    current.textContent=row?'Flight saved':'Saving flight…';
  }
  show(view='leaderboard'){if(!this.canSwitch())return;this.view=view;this.offset=0;$('recordsDialog').showModal();this.refresh();}
  row(r,rank='—'){
    const l=LEVELS.find(x=>x.id===r.level),result=r.status==='arrived'?(r.missionComplete?'Arrival + science complete':'Arrived / science incomplete'):r.status==='aborted'?'Ended by player':r.reason||'Flight complete';
    return `<tr><td>${esc(r.rank??rank)}</td><td><button class="flight-record-link" data-flight-id="${esc(r.flightId)}">${esc(r.playerId)} ↗</button></td><td>${esc(l?.name||r.level)}</td><td><b>${Number.isFinite(r.totalScore)?fmt(r.totalScore):'Legacy'}</b></td><td>${esc(r.missionGrade||'—')}</td><td>${esc(result)}</td><td>${date(r.date)}</td></tr>`;
  }
  table(rows){return `<div class="table-scroll"><table class="leaderboard-table"><thead><tr><th>Rank</th><th>Player ID / Flight report</th><th>Destination</th><th>Final Score</th><th>Science Mission Grade</th><th>Mission Result</th><th>Date</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
  async refresh(){
    const ticket=++this.ticket,view=this.view,offset=this.offset;
    $('boardTitle').textContent=view==='leaderboard'?'Local Leaderboard':view==='history'?'My Flights':'Legacy Flight History';
    $('boardHint').textContent=view==='leaderboard'?'Compete with players on this device.':view==='history'?`All flights for ${this.playerId} on this device.`:'Original scoring records.';
    $('boardTabs').hidden=view!=='leaderboard';$('boardPagination').hidden=view!=='history';$('ownBest').innerHTML='';$('boardStatus').textContent='Loading…';$('recordList').innerHTML='';
    $('boardPrevBtn').disabled=offset===0;$('boardNextBtn').disabled=true;
    for(const b of $('boardTabs').querySelectorAll('[data-board-level]'))b.setAttribute('aria-pressed',String(b.dataset.boardLevel===this.level));
    try{
      if(view==='legacy'){
        const rows=this.legacyRecords().filter(r=>!r.scoreVersion);
        $('boardStatus').textContent='Legacy scoring / excluded from Final Score rankings';
        $('recordList').innerHTML=rows.length?rows.map(r=>`<div class="record-row"><span>${esc(r.level)}<small>${date(r.date)}</small></span><b>${fmt(r.score)}</b><span>${esc(r.status)}<small>Original Arcade Score</small></span></div>`).join(''):'<p class="empty-records">No legacy flights in this profile.</p>';
        return;
      }
      if(view==='leaderboard'){
        const result=await this.service.leaderboard(this.level,this.playerId);if(ticket!==this.ticket)return;
        $('recordList').innerHTML=result.rows.length?this.table(result.rows.map(r=>this.row(r))):'<p class="empty-records">No flights for this destination yet.</p>';
        $('boardStatus').textContent=`Top 50 / one best flight per player · ${result.total} players`;
        $('ownBest').innerHTML=result.ownBest?`<p class="mission-explainer">Your best · Rank ${result.ownBest.rank} · <button class="flight-record-link" data-flight-id="${esc(result.ownBest.flightId)}">${fmt(result.ownBest.totalScore)} · View report ↗</button></p>`:'<p class="mission-explainer">Your best: no flight for this destination yet.</p>';
      }else{
        const result=await this.service.history(this.playerId,offset);if(ticket!==this.ticket)return;
        $('recordList').innerHTML=result.rows.length?this.table(result.rows.map(r=>this.row(r))):'<p class="empty-records">No flights saved on this device for this player.</p>';
        $('boardStatus').textContent=`${result.total} flights saved on this device`;
        $('boardNextBtn').disabled=offset+50>=result.total;
      }
    }catch(error){if(ticket!==this.ticket)return;$('boardStatus').textContent=error.message;$('recordList').innerHTML='<p class="empty-records">Could not read saved flights. Keep this page open and try again.</p>';}
  }
  async openFlight(id){
    if(!this.canSwitch())return;
    $('flightReportContent').textContent='Loading flight report…';$('flightReportDialog').showModal();
    try{$('flightReportContent').innerHTML=flightReportHTML(await this.service.flight(id));}
    catch(error){$('flightReportContent').textContent=error.message;}
  }
}
