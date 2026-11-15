import {DURATION,G0,clamp} from '../../../src/config.js';
import {V} from '../../../src/dynamics.js';
import {ScienceOperations} from '../../../src/mission.js';
import {createPilot3D,objectDepth,segmentDistance3D,COCKPIT_BONUS_RATE} from '../../../src/flight-3d.js';

// The original local coordinates are the action presentation layer.
// Navigation owns the authoritative 3D state, physical distance and arrival.
export class Random {
  constructor(seed){this.state=(seed>>>0)||0x6d2b79f5;}
  next(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296;}
  range(a,b){return a+(b-a)*this.next();}
  int(a,b){return Math.floor(this.range(a,b+1));}
}
export function seedFrom(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function segmentDistance(px,py,ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,d=dx*dx+dy*dy;
  const t=d?clamp(((px-ax)*dx+(py-ay)*dy)/d,0,1):0;
  return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}
export class Flight {
  constructor(level,craft,seed,navigation=null) {
    this.level=level;this.craft=craft;this.seed=seed>>>0;this.rng=new Random(seed);
    this.time=0;this.x=0;this.y=0;this.vx=0;this.vy=level.speed;
    this.fuel=craft.maxFuel;this.energy=craft.maxEnergy;this.health=craft.maxHealth;
    this.score=0;this.localDistance=0;this.progress=0;this.objects=[];this.events=[];
    this.status='playing';this.reason='';this.combo=0;this.comboUntil=0;this.invincible=0;
    this.nextSpawn=4;this.nextSupply=2.8;this.nextComet=22;this.nextHole=level.id==='mars'?165:110;
    this.collected=0;this.nearMisses=0;this.hits=0;this.fuelUsed=0;this.energyCollected=0;this.fuelCollected=0;
    this.blackholesEscaped=0;this.maxCombo=0;this.idCounter=0;this.thrustX=0;this.thrustY=0;this.phase=0;
    this.lowFuel=false;this.lowPower=false;this.clearance=1;
    this.navigation=navigation;this.stability=100;this.localSpeed=0;
    this.science=craft.mission&&navigation?new ScienceOperations(level,craft,navigation):null;
    // Place the first energy pickup on the departure lane.
    this.add('energy',0,level.speed*4.8,{radius:13});
  }
  add(kind,x,y,extra={}) {
    const o={id:++this.idCounter,kind,x,y,vx:0,vy:0,radius:22,spin:this.rng.range(-.7,.7),angle:this.rng.range(0,6.28),variant:this.rng.int(0,3),...extra};
    this.objects.push(o);return o;
  }
  emit(type,text,extra={}){this.events.push({type,text,x:this.x,y:this.y,...(this.pilot3D?.active?{z:this.pilot3D.z}:{}),...extra});}
  setFlightMode(mode){if(!['2d','3d'].includes(mode))throw Error('Unknown flight mode');if(mode==='3d'&&!this.pilot3D)this.pilot3D=createPilot3D();if(this.pilot3D)this.pilot3D.active=mode==='3d';}
  get totalScore(){return this.score+(this.pilot3D?.bonus||0);}
  points(amount){const before=this.score;this.score+=amount*this.level.score*this.craft.multiplier*(1+Math.min(this.combo,12)*.035);if(this.pilot3D?.active)this.pilot3D.bonus+=(this.score-before)*COCKPIT_BONUS_RATE;}
  finish(status,reason){if(this.status!=='playing')return;this.status=status;this.reason=reason;this.emit(status,reason);}
  phaseName(){return ['Departure lane','Rock field','Stardust drift','Deep-space lane','Final approach'][this.phase];}
  director(dt) {
    const t=this.time, d=this.level.density, ramp=.55+.85*t/DURATION;
    const phase=Math.min(4,Math.floor(t/120));
    if(phase!==this.phase){this.phase=phase;this.emit('phase',this.phaseName());this.points(180);}
    if(t>=this.nextSpawn){
      // Exponentially distributed arrivals (Poisson process) with a paced floor.
      this.nextSpawn=t+Math.max(.38,-Math.log(Math.max(1e-6,1-this.rng.next()))/(1.1*d*ramp))+.55;
      const ahead=Math.max(780,this.vy*4.5);
      const count=t>100&&this.rng.next()<.28*d?this.rng.int(2,3):1;
      const predicted=this.x+clamp(this.vx*2,-280,280),base=predicted+this.rng.range(-400,400);
      for(let i=0;i<count;i++){
        // Clusters are broken, with no full-screen walls or offscreen attacks.
        const radius=this.rng.range(18,34+10*t/DURATION);
        const fast=t>70&&this.rng.next()<.17;
        this.add(fast?'ice':'rock',base+i*110,this.y+ahead+i*90,{radius,vx:this.rng.range(-10,10),vy:fast?-this.rng.range(25,65):0});
      }
    }
    if(t>=this.nextSupply){
      this.nextSupply=t+this.rng.range(7.5,12.5);
      // Bias supplies toward the resource currently running low.
      let kind=this.rng.next()<.52?'fuel':'energy';
      if(this.fuel/this.craft.maxFuel<.22)kind='fuel';
      else if(this.energy/this.craft.maxEnergy<.25)kind='energy';
      else if(this.health<this.craft.maxHealth&&this.rng.next()<.22)kind='repair';
      const side=this.rng.range(-210,210);
      this.add(kind,this.x+clamp(this.vx*1.4,-200,200)+side,this.y+Math.max(760,this.vy*4.2),{radius:13});
    }
    if(t>=this.nextComet){
      this.nextComet=t+this.rng.range(31,42);
      this.add('comet',this.x+this.rng.range(-260,260),this.y+Math.max(1000,this.vy*5.2),{radius:27,vx:this.rng.range(-15,15),vy:-18,deposit:0});
      this.emit('notice','Comet supply: skim the glow and avoid the core');
    }
    if(this.level.blackholes&&t>=this.nextHole&&this.progress<.97){
      this.nextHole=t+this.rng.range(82,112);
      const side=this.rng.next()<.5?-1:1;
      this.add('hole',this.x+side*this.rng.range(155,240),this.y+Math.max(1450,this.vy*7),{radius:35,mu:1.45e6+this.level.rank*1.4e5,range:610,entered:false});
      this.emit('warning','Gravity anomaly! Turn early and keep fuel for escape');
    }
  }
  step(input,dt) {
    if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,1/30);
    const ox=this.x,oy=this.y,depth=this.pilot3D,three=Boolean(depth?.active),oz=depth?.z||0;this.time+=dt;
    if(three)depth.activeSeconds+=dt;
    this.invincible=Math.max(0,this.invincible-dt);
    if(this.time>this.comboUntil)this.combo=0;
    let ix=(input.right?1:0)-(input.left?1:0),iy=input.up?1:0,iz=0;
    if(three){iy-=(input.reverse?1:0);iz=(input.rise?1:0)-(input.fall?1:0);}
    const coast=Boolean(input.down||(three&&input.coast));
    if(coast){ix=0;iy=0;iz=0;}
    const norm=three?Math.hypot(ix,iy,iz):Math.hypot(ix,iy);if(norm>1){ix/=norm;iy/=norm;iz/=norm;}
    // A displayed cruise governor cuts forward thrust above the safe speed.
    // It never removes existing momentum, and never suppresses lateral thrust.
    if(this.vy>this.level.speed*2.25&&(!three||iy>0))iy=0;
    const throttle=Math.min(1,three?Math.hypot(ix,iy,iz):Math.hypot(ix,iy));
    const oldFuel=this.fuel,available=Math.min(this.fuel,this.craft.engine.thrust/(this.craft.engine.isp*G0)*throttle*dt);
    const fuelFraction=throttle?available/(this.craft.engine.thrust/(this.craft.engine.isp*G0)*throttle*dt):0;
    this.thrustX=ix*fuelFraction;this.thrustY=iy*fuelFraction;
    if(three)depth.thrustZ=iz*fuelFraction;
    const mass=this.craft.dryMass+this.fuel-available/2;
    let ax=this.craft.engine.thrust/mass*this.thrustX,ay=this.craft.engine.thrust/mass*this.thrustY,gx=0,gy=0,az=three?this.craft.engine.thrust/mass*depth.thrustZ:0,gz=0;
    this.fuel=Math.max(0,this.fuel-available);this.fuelUsed+=available;
    for(const o of this.objects){
      if(o.kind!=='hole')continue;
      const dx=o.x-this.x,dy=o.y-this.y,dz=three?objectDepth(o,this.seed)-depth.z:0,r=three?Math.hypot(dx,dy,dz):Math.hypot(dx,dy);
      if(r<o.range&&r>o.radius){
        const hx=o.mu*dx/(r*r*r),hy=o.mu*dy/(r*r*r);ax+=hx;ay+=hy;gx+=hx;gy+=hy;
        if(three){const hz=o.mu*dz/(r*r*r);az+=hz;gz+=hz;}
        if(!o.entered){o.entered=true;this.emit('gravity','Gravity deflection / thrust away from the trap');}
      }
      if(o.entered&&!o.escaped&&this.y>o.y+o.range&&r>o.range){o.escaped=true;this.blackholesEscaped++;this.points(700);this.emit('escape','Gravity trap escaped +700');}
    }
    this.x+=this.vx*dt+.5*ax*dt*dt;this.y+=this.vy*dt+.5*ay*dt*dt;
    this.vx+=ax*dt;this.vy+=ay*dt;
    if(three){depth.z+=depth.vz*dt+.5*az*dt*dt;depth.vz+=az*dt;}
    this.localDistance+=three?Math.hypot(this.x-ox,this.y-oy,depth.z-oz):Math.hypot(this.x-ox,this.y-oy);
    let auto=null;
    if(this.navigation){
      try{
        const nav=this.navigation,actualDV=available?this.craft.engine.isp*G0*Math.log((this.craft.dryMass+oldFuel)/(this.craft.dryMass+this.fuel)):0;
        const player=throttle?nav.transform(ix/throttle*actualDV,iy/throttle*actualDV,three?iz/throttle*actualDV:0):[0,0,0];
        auto=coast?null:nav.automaticBurn(this.fuel,dt,throttle*fuelFraction);
        if(coast)nav.lastAutoThrottle=0;
        if(auto){this.fuel-=auto.used;this.fuelUsed+=auto.used;}
        const virtual=nav.transform(gx*dt,gy*dt,three?gz*dt:0),dv=V.add(V.add(player,auto?.dv||[0,0,0]),virtual);
        nav.advance(dt,{dv,player:actualDV>0,auto:auto?.used||0},this.fuel);
        this.progress=nav.progress;this.stability=nav.stability;this.localSpeed=nav.localSpeed;
      }catch(error){this.finish('failed',error.message);}
    }
    const scienceLoad=this.science?.step(dt,this.energy)||0;
    const load=1800+(throttle*fuelFraction+(auto?.throttle||0))*600+scienceLoad;
    this.energy=clamp(this.energy+(this.craft.power.generation-load)*dt/3600,0,this.craft.maxEnergy);
    this.points(13*dt);
    for(const o of this.objects){
      const oldx=o.x,oldy=o.y;o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;
      // Swept relative collision avoids tunneling at high closing speed.
      const objectZ=three?objectDepth(o,this.seed):0;
      const near=three?segmentDistance3D([ox-oldx,oy-oldy,oz-objectZ],[this.x-o.x,this.y-o.y,depth.z-objectZ]):segmentDistance(0,0,ox-oldx,oy-oldy,this.x-o.x,this.y-o.y);
      const distance=three?Math.hypot(this.x-o.x,this.y-o.y,depth.z-objectZ):Math.hypot(this.x-o.x,this.y-o.y),body=o.radius+11;
      if(o.kind==='hole'){
        if(near<body){this.health=0;this.finish('failed','Entered the black hole capture zone');break;}
      }else if(['rock','ice','comet'].includes(o.kind)){
        if(o.kind==='comet'&&distance>body+3&&distance<o.radius+116&&!o.harvested){
          o.deposit+=dt;
          if(o.deposit>.16){o.harvested=true;this.collect('comet',o);}
        }
        if(near<body&&this.invincible<=0&&!o.hit){
          o.hit=true;this.health--;this.hits++;this.combo=0;this.invincible=1.9;
          this.emit('hit','Hull damage -1',{x:o.x,y:o.y});
          if(this.health<=0){this.finish('failed','Hull destroyed; flight ended');break;}
        }else if(!o.hit&&!o.nearMissed&&distance<body+36&&this.y>o.y&&distance>=body){
          o.nearMissed=true;this.nearMisses++;this.chain();this.points(90);this.emit('near','Near miss +90',{x:o.x,y:o.y});
        }
      }else if(near<o.radius+29&&!o.taken){o.taken=true;this.collect(o.kind,o);}
    }
    this.objects=this.objects.filter(o=>!o.taken&&o.y>this.y-650&&Math.abs(o.x-this.x)<2200);
    if(this.energy<=0)this.finish('failed','Battery depleted; flight ended');
    if(this.fuel/this.craft.maxFuel<.18&&!this.lowFuel){this.lowFuel=true;this.emit('warning','Low fuel / collect orange fuel crystals');}
    if(this.fuel/this.craft.maxFuel>.28)this.lowFuel=false;
    if(this.energy/this.craft.maxEnergy<.2&&!this.lowPower){this.lowPower=true;this.emit('warning','Low energy / collect green energy crystals');}
    if(this.energy/this.craft.maxEnergy>.32)this.lowPower=false;
    if(this.status==='playing'){
      this.director(dt);
      const nav=this.navigation;
      if(nav?.status==='lost')this.finish('failed','Course deviation exceeds the mission limit');
      else if(nav?.status==='collision')this.finish('failed','Collision with a celestial body');
      else if(nav?.status==='numerical')this.finish('failed','Trajectory integration stopped; replan the flight');
      else if(nav?.status==='arrived'){this.points(2000);this.finish('arrived','Arrived '+this.level.name+'!');}
    }
  }
  chain(){this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.comboUntil=this.time+12;}
  collect(kind,o) {
    this.collected++;this.chain();let text='';
    if(kind==='fuel'||kind==='comet'){
      const amount=Math.min(this.craft.maxFuel-this.fuel,kind==='comet'?this.craft.maxFuel*.42:this.craft.maxFuel*.28);
      this.fuel+=amount;this.fuelCollected+=amount;text=`Fuel +${Math.round(amount)} kg`;
    }
    if(kind==='energy'||kind==='comet'){
      const amount=Math.min(this.craft.maxEnergy-this.energy,kind==='comet'?48:38);
      this.energy+=amount;this.energyCollected+=amount;text+=(text?' · ':'')+`Energy +${Math.round(amount)} Wh`;
    }
    if(kind==='repair'){const amount=Math.min(1,this.craft.maxHealth-this.health);this.health+=amount;text=amount?'Hull repaired +1':'Hull intact / points awarded';}
    this.points(kind==='comet'?250:80);this.emit('collect',text,{x:o.x,y:o.y,kind});
  }
  snapshot(){return {version:10,level:this.level.id,seed:this.seed,date:new Date().toISOString(),status:this.status,reason:this.reason,time:this.time,score:Math.round(this.totalScore),distance:this.navigation?.distanceKm??this.localDistance/1000,localDistance:this.localDistance,fuel:this.fuel,energy:this.energy,health:this.health,hits:this.hits,collected:this.collected,nearMisses:this.nearMisses,maxCombo:this.maxCombo,blackholesEscaped:this.blackholesEscaped,price:this.craft.price,multiplier:this.craft.multiplier,kit:{...this.craft.kit},fuelUsed:this.fuelUsed,stability:this.stability,navigation:this.navigation?.summary(),science:this.science?.report(this.status),...(this.pilot3D?{flightMode:this.pilot3D.active?'3d':'2d',baseScore:Math.round(this.score),threeDBonus:Math.round(this.totalScore)-Math.round(this.score),threeDBonusRaw:this.pilot3D.bonus,threeDSeconds:this.pilot3D.activeSeconds,localDepth:{position:this.pilot3D.z,velocity:this.pilot3D.vz}}:{})};}
}
