import {NAVIGATION,G0,C,clamp} from './config.js';
import {relativisticLeg} from './orbit.js';
import {AU,DAY,MS,V,atTime,interpolateState,localBasis,propagate,encounterBetween,collisionBody,direction} from './dynamics.js';

// Health is a deliberately smoothed risk indicator, not an orbital invariant.
export function stabilityStep(health,filteredRisk,rawRisk,dt){
  const risk=filteredRisk+(clamp(rawRisk,0,6)-filteredRisk)*(1-Math.exp(-dt/2.5));
  const change=risk<.48?1.8*(1-risk/.48):risk>.58?-(.12+Math.min(4.8,(risk-.58)*1.65)):0;
  return {health:clamp(health+change*dt,0,100),risk};
}
export class Navigation {
  constructor(level,plan,ephem,craft,options={}){
    if(!plan||plan.launchDate!==plan.settings?.launchDate)throw Error('Launch date and trajectory differ; recalculate the plan');
    this.level=level;this.plan=plan;this.ephem=ephem;this.craft=craft;this.config=NAVIGATION[level.id];
    this.isStar=level.id==='proxima';this.state=plan.initial?.slice()||[0,0,0,0,0,0];this.startDay=plan.departure??0;this.day=this.startDay;
    this.elapsed=0;this.progress=0;this.distanceKm=0;this.stability=100;this.risk=0;this.rawRisk=0;this.status='flying';this.targetDistance=Infinity;
    this.localSpeed=0;this.autoFuelUsed=0;this.autoBurnSeconds=0;this.playerBurnSeconds=0;this.lastAutoThrottle=0;this.burns=[];this.history=[];
    this.future=null;this.maneuverRevision=0;this.forecastClock=0;this.checkClock=0;this.guidance=null;this.nearestTarget=Infinity;this.maxStep=options.maxStep;this.rtol=options.rtol??1e-10;
    this.localR=[0,0,0];this.localV=[0,0,0];this.correction=[0,0,0];
    if(this.isStar){
      this.leg=relativisticLeg(level.distance,plan.settings.speed);this.warp=this.leg.duration/this.config.playSeconds;
      this.basis={forward:[0,1,0],right:[1,0,0],normal:[0,0,1]};this.starDirection=direction(plan.settings.heading,plan.settings.pitch);this.targetDistance=level.distance;
    }else{
      if(!ephem)throw Error('Ephemeris data have not loaded');this.goalDays=Math.max(plan.goalDay,plan.settings.durationDays*.4);
      this.warp=this.goalDays*DAY/this.config.playSeconds;
      this.basis=localBasis(ephem,level,this.day,this.state);this.referenceTrack=plan.track;
      this.goalState=atTime(plan.track,plan.goalDay);
      this.progressTrack=plan.track.filter(p=>p.t<plan.goalDay).map(p=>({t:p.t,y:p.y}));this.progressTrack.push({t:plan.goalDay,y:this.goalState});
      let length=0;this.progressPoints=this.progressTrack.map((p,i)=>{
        const origin=ephem.body(level.id==='moon'?'earth':'sun',this.startDay+p.t).r,r=V.sub(p.y.slice(0,3),origin);
        if(i)length+=V.norm(V.sub(r,this.progressPointsPlaceholder))*AU;this.progressPointsPlaceholder=r;return {r,length,t:p.t};
      });this.referenceLength=length;delete this.progressPointsPlaceholder;
      this.targetDistance=V.norm(V.sub(this.state.slice(0,3),ephem.body(level.id,this.day).r))*AU;
    }
    this.updateMetrics(craft.maxFuel,0);
  }
  reference(){return atTime(this.referenceTrack,clamp(this.day-this.startDay,0,this.referenceTrack.at(-1).t));}
  remainingDV(fuel){return this.craft.engine.isp*G0*Math.log((this.craft.dryMass+Math.max(0,fuel))/this.craft.dryMass);}
  transform(x,y,z=0){return V.add(V.add(V.scale(this.basis.right,x),V.scale(this.basis.forward,y)),V.scale(this.basis.normal,z));}
  automaticBurn(fuel,dt,userThrottle){
    this.lastAutoThrottle=0;
    if(this.isStar||fuel<=0||userThrottle>.95||this.status!=='flying')return null;
    const n=V.dot(this.correction,this.basis.normal),r=V.dot(this.correction,this.basis.right),t=V.dot(this.correction,this.basis.forward);
    // Normal axis is unavailable to the player. In-plane assistance is limited
    // to genuinely small corrections and never handles a large deliberate burn.
    const remaining=Math.max(DAY*.25,(this.startDay+this.plan.goalDay-this.day)*DAY),deadband=clamp(this.level.near*1000*.08/remaining,.04,6);
    const small=this.plan.good&&this.localSpeed<this.config.assistSpeed&&V.norm(this.correction)<this.config.assistCorrection&&(this.positionRatio||0)<.9&&this.remainingDV(fuel)>V.norm(this.correction)*1.2;
    const requested=V.add(V.scale(this.basis.normal,Math.abs(n)>deadband?n:0),small?V.add(V.scale(this.basis.right,Math.abs(r)>deadband?r*.08:0),V.scale(this.basis.forward,Math.abs(t)>deadband?t*.08:0)):[0,0,0]);
    if(V.norm(requested)<.05)return null;
    const throttle=Math.min(.012,1-userThrottle),rate=this.craft.engine.thrust/(this.craft.engine.isp*G0),used=Math.min(fuel,rate*throttle*dt);
    const dv=this.craft.engine.isp*G0*Math.log((this.craft.dryMass+fuel)/(this.craft.dryMass+fuel-used));
    this.lastAutoThrottle=throttle;this.autoFuelUsed+=used;this.autoBurnSeconds+=dt*throttle;
    return {used,dv:V.scale(V.unit(requested),Math.min(dv,V.norm(requested))),throttle};
  }
  advance(dt,control,fuel){
    if(this.status!=='flying')return;this.elapsed+=dt;
    const dv=control.dv||[0,0,0],burning=V.norm(dv)>0,burnDays=burning?dt/DAY:0;
    if(control.player)this.playerBurnSeconds+=dt;
    if(burning){this.future=null;this.maneuverRevision++;this.burns.push({realTime:this.elapsed,day:this.day,durationSeconds:dt,deltaV:dv.slice(),player:Boolean(control.player),auto:control.auto||0});if(this.burns.length>128)this.burns.shift();}
    if(this.isStar){
      this.localR=V.add(this.localR,V.scale(V.add(this.localV,V.scale(dv,.5)),dt));this.localV=V.add(this.localV,dv);
      const before=this.leg.sample(clamp((this.day-this.startDay)*DAY/this.leg.duration,0,1));
      this.day+=dt*this.warp/DAY;const f=clamp((this.day-this.startDay)*DAY/this.leg.duration,0,1),q=this.leg.sample(f);
      const position=V.add(V.scale(this.starDirection,q.distance),V.scale(this.localR,.001));this.state=[...V.scale(position,1/AU),...V.scale(this.starDirection,q.beta*C/MS)];
      this.distanceKm=q.distance;this.earthTime=q.earth;this.shipTime=q.ship;this.progress=clamp(V.dot(position,[0,1,0])/this.level.distance,0,1);
      this.targetDistance=V.norm(V.sub(position,[0,this.level.distance,0]));this.nearestTarget=Math.min(this.nearestTarget,this.targetDistance);
      this.localSpeed=V.norm(this.localV);
      if(f>=1&&this.targetDistance<=this.plan.near&&V.norm(this.localR)<this.config.positionKm*1000*2&&this.stability>0)this.status='arrived';
    }else{
      // A finite, active-second burn is followed by compressed coasting.
      // Propellant is never multiplied by warp. No position or velocity snap.
      if(burning){
        const central=this.level.id==='moon'?'earth':'sun',before=V.sub(this.state.slice(0,3),this.ephem.body(central,this.day).r);
        const g=this.ephem.acceleration(this.day,this.state.slice(0,3)),oldV=this.state.slice(3),kick=V.scale(dv,1/MS);
        for(let j=0;j<3;j++){this.state[j]+=oldV[j]*burnDays+.5*g[j]*burnDays*burnDays+.5*kick[j]*burnDays;this.state[j+3]+=g[j]*burnDays+kick[j];}
        this.day+=burnDays;
        const after=V.sub(this.state.slice(0,3),this.ephem.body(central,this.day).r);this.distanceKm+=V.norm(V.sub(after,before))*AU;
      }
      const coastDays=Math.max(0,dt*this.warp/DAY-burnDays),start=this.day;
      const track=propagate(this.ephem,start,this.state,coastDays,{moon:this.level.id==='moon',maxStep:this.maxStep,rtol:this.rtol});
      let final=track.at(-1),arrived=null;
      for(let i=1;i<track.length;i++){
        const a=track[i-1],b=track[i],bodyA=this.ephem.body(this.level.id,start+a.t),bodyB=this.ephem.body(this.level.id,start+b.t);
        const da=V.norm(V.sub(a.y.slice(0,3),bodyA.r))*AU,db=V.norm(V.sub(b.y.slice(0,3),bodyB.r))*AU;
        this.nearestTarget=Math.min(this.nearestTarget,da,db);
        // Broad-phase bound admits possible between-step encounters, including
        // a whole arrival sphere crossed during one compressed game frame.
        const travel=V.norm(V.sub(b.y.slice(0,3),a.y.slice(0,3)))*AU+V.norm(V.sub(bodyB.r,bodyA.r))*AU;
        if(Math.min(da,db)<this.level.near+travel){
          const q=encounterBetween(this.ephem,this.level.id,start,a,b);this.nearestTarget=Math.min(this.nearestTarget,q.distance);
          if(q.distance<=this.level.near){arrived=q;final={t:q.t,y:q.y};break;}
        }
      }
      const central=this.level.id==='moon'?'earth':'sun';
      for(let i=1;i<track.length;i++){
        if(track[i-1].t>=final.t)break;const a=track[i-1],b=track[i].t<=final.t?track[i]:final;
        const ra=V.sub(a.y.slice(0,3),this.ephem.body(central,start+a.t).r),rb=V.sub(b.y.slice(0,3),this.ephem.body(central,start+b.t).r);
        this.distanceKm+=V.norm(V.sub(rb,ra))*AU;
      }
      this.state=final.y.slice();this.day=start+final.t;
      this.targetDistance=V.norm(V.sub(this.state.slice(0,3),this.ephem.body(this.level.id,this.day).r))*AU;
      if(arrived)this.status='arrived';
      else if(collisionBody(this.ephem,this.day,this.state))this.status='collision';
      else if(final.t<coastDays-1e-9)this.status='numerical';
      this.checkClock+=dt;
      if(this.checkClock>=.1||this.status!=='flying'){this.updateMetrics(fuel,this.checkClock);this.checkClock=0;}
    }
    if(this.isStar)this.updateMetrics(fuel,dt);
    if(this.stability<=0)this.status='lost';
    if(this.status==='arrived')this.progress=1;
    if(this.history.length===0||this.elapsed-this.history.at(-1).realTime>=1)this.history.push({realTime:this.elapsed,day:this.day,state:this.state.slice(),stability:this.stability,progress:this.progress,targetKm:this.targetDistance});
  }
  updateMetrics(fuel,dt){
    if(this.future?.day<this.day)this.future=null;
    if(this.isStar){
      this.targetRelativePositionKm=V.sub(V.scale(this.state.slice(0,3),AU),[0,this.level.distance,0]);this.targetRelativeVelocityMS=V.scale(this.state.slice(3),MS);
    }else{
      const target=this.ephem.body(this.level.id,this.day);this.targetRelativePositionKm=V.scale(V.sub(this.state.slice(0,3),target.r),AU);this.targetRelativeVelocityMS=V.scale(V.sub(this.state.slice(3),target.v),MS);
    }
    this.barycentricSpeedMS=V.norm(this.state.slice(3))*MS;
    let positionRatio,velocityRatio,forecastRatio,required;
    if(this.isStar){
      const error=V.norm(this.localR)/1000,angle=V.norm(V.sub(this.starDirection,[0,1,0]));
      positionRatio=error/this.config.positionKm;velocityRatio=this.localSpeed/this.config.velocityMS;forecastRatio=angle*70+V.norm(V.add(this.localR,V.scale(this.localV,8)))/1000/this.config.forecastKm;
      this.correction=V.scale(V.add(V.scale(this.localR,.015),this.localV),-1);required=V.norm(this.correction);
    }else{
      const reference=this.reference(),dr=V.sub(this.state.slice(0,3),reference.slice(0,3)),dv=V.scale(V.sub(this.state.slice(3),reference.slice(3)),MS);
      this.basis=localBasis(this.ephem,this.level,this.day,reference);this.localSpeed=V.norm(dv);
      const cross=V.sub(dr,V.scale(this.basis.forward,V.dot(dr,this.basis.forward))),remaining=Math.max(DAY*.25,(this.startDay+this.plan.goalDay-this.day)*DAY);
      const stage=1.15-.35*clamp(this.progress,0,1);
      positionRatio=(V.norm(cross)+Math.abs(V.dot(dr,this.basis.forward))*.15)*AU/(this.config.positionKm*stage);this.positionRatio=positionRatio;
      velocityRatio=this.localSpeed/this.config.velocityMS;
      const lineError=V.norm(V.add(V.scale(dr,AU),V.scale(dv,remaining/1000)));
      const predicted=this.future?Math.max(this.future.closest-this.level.near,0):Math.max(0,this.plan.closest-this.level.near)+lineError;
      forecastRatio=predicted/this.config.forecastKm;
      this.correction=V.scale(V.add(dv,V.scale(dr,AU*1000/remaining)),-1);required=V.norm(this.correction);
      const central=this.ephem.body(this.level.id==='moon'?'earth':'sun',this.day).r,current=V.sub(this.state.slice(0,3),central);
      let nearest=Infinity,arc=0;
      for(let i=1;i<this.progressPoints.length;i++){
        const a=this.progressPoints[i-1],b=this.progressPoints[i],delta=V.sub(b.r,a.r),d2=V.dot(delta,delta),fraction=d2?clamp(V.dot(V.sub(current,a.r),delta)/d2,0,1):0;
        const d=V.norm(V.sub(current,V.add(a.r,V.scale(delta,fraction))));
        if(d<nearest){nearest=d;arc=a.length+(b.length-a.length)*fraction;}
      }
      this.progress=clamp(arc/Math.max(1,this.referenceLength),0,1);
    }
    const needed=Math.max(0,required-6),budget=this.remainingDV(fuel),fuelRatio=needed>0?needed/Math.max(12,budget):0;
    // A large long-range miss can still be a small, affordable delta-v repair.
    // Do not treat an ordinary short evasive burn as an unrecoverable trajectory.
    if(!this.isStar&&this.localSpeed<this.config.assistSpeed&&required<this.config.assistCorrection&&positionRatio<.9&&budget>required*1.2)forecastRatio*=.2;
    this.rawRisk=.27*positionRatio+.21*velocityRatio+.4*forecastRatio+.12*fuelRatio;
    if(this.isStar&&(this.day-this.startDay)*DAY>=this.leg.duration&&this.targetDistance>this.plan.near)this.rawRisk=Math.max(this.rawRisk,1.2+.2*this.targetDistance/this.plan.near);
    const health=stabilityStep(this.stability,this.risk,this.rawRisk,dt);this.stability=health.health;this.risk=health.risk;
    const side=V.dot(this.correction,this.basis.right),forward=V.dot(this.correction,this.basis.forward);
    this.guidance=this.rawRisk>.58&&required>2?Math.abs(side)>Math.max(forward,0)*.7?(side<0?'left':'right'):forward>0?'up':'coast':null;
  }
  setForecast(result){if(result&&Number.isFinite(result.closest)&&(result.sourceRevision===undefined||result.sourceRevision===this.maneuverRevision)&&result.day>=this.day)this.future=result;}
  forecastRequest(){if(this.isStar||this.status!=='flying')return null;return {level:this.level.id,day:this.day,state:this.state.slice(),revision:this.maneuverRevision,duration:Math.max(.05,this.startDay+this.plan.goalDay*1.12-this.day)};}
  summary(){return {launchDate:this.plan.launchDate,model:this.isStar?'ideal-relativistic':'JPL-DE441 + Newtonian 11-body',simulatedDays:this.day-this.startDay,stability:this.stability,physicalState:this.state.slice(),localSpeed:this.localSpeed,barycentricSpeedMS:this.barycentricSpeedMS,targetRelativePositionKm:this.targetRelativePositionKm,targetRelativeVelocityMS:this.targetRelativeVelocityMS,closestKm:this.nearestTarget,targetKm:this.targetDistance,forecast:this.future,autoFuelUsed:this.autoFuelUsed,playerBurnSeconds:this.playerBurnSeconds,autoBurnSeconds:this.autoBurnSeconds,progress:this.progress,actualDistanceKm:this.distanceKm,earthTime:this.earthTime,shipTime:this.shipTime,history:this.history.filter((_,i)=>i%Math.max(1,Math.ceil(this.history.length/64))===0),burns:this.burns};}
}
