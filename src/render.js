import {Random} from './physics.js';
import {clamp} from './config.js';
import {drawRocket,drawPlanet} from './art.js';
import {shipSegment,departureGlyph,projectedLaunch,steerLaunch} from './orbit-view.js';
export function fitCanvas(canvas){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,r.width),h=Math.max(1,r.height);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h,dpr};
}
export class OrbitMap {
  constructor(canvas,state,change){
    this.canvas=canvas;this.state=state;this.change=change;this.projection='xy';this.dragging=false;this.arrow=null;
    canvas.addEventListener('pointerdown',e=>{
      if(!this.arrow)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      if(Math.hypot(x-this.arrow.x,y-this.arrow.y)>180)return;
      this.dragging=true;this.dragArrow={...this.arrow};canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{if(this.dragging)this.move(e);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{this.dragging=false;this.dragArrow=null;});
    canvas.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
      const s=this.state();this.change({heading:clamp(s.settings.heading+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0),0,360),speed:clamp(s.settings.speed+(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*s.level.range[2]*4,...s.level.range)});
    });
  }
  move(e){
    const arrow=this.dragArrow||this.arrow;if(!arrow)return;
    const r=this.canvas.getBoundingClientRect(),dx=e.clientX-r.left-arrow.x,dy=-(e.clientY-r.top-arrow.y),s=this.state();
    const fraction=clamp((Math.hypot(dx,dy)-51)/67,0,1),speed=s.level.range[0]+fraction*(s.level.range[1]-s.level.range[0]);
    this.change(steerLaunch(s.settings,arrow.velocityOffset||[0,0,0],this.projection,Math.atan2(dy,dx)-(arrow.angleOffset||0),speed,s.level.id==='proxima'));
  }
  draw(time=0){
    const {ctx:c,w,h}=fitCanvas(this.canvas),s=this.state(),route=s.route,j=this.projection==='xy'?1:2;
    c.clearRect(0,0,w,h);c.fillStyle='#12182b';c.fillRect(0,0,w,h);
    const glow=c.createRadialGradient(w*.6,h*.55,0,w*.5,h*.5,w*.65);glow.addColorStop(0,'#29334a66');glow.addColorStop(1,'#12182b00');c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.strokeStyle='#8094c712';c.lineWidth=.5;for(let x=25;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=20;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    const stars=new Random(2219);for(let i=0;i<65;i++){c.fillStyle=`rgba(188,203,241,${stars.range(.15,.45)})`;c.beginPath();c.arc(stars.range(15,w-15),stars.range(15,h-15),stars.range(.4,1),0,7);c.fill();}
    if(!route?.points?.length){drawPlanet(c,w*.43,h*.52,31,'earth');c.fillStyle='#7584a1';c.font='10px system-ui';c.textAlign='center';c.fillText('Preparing trajectory',w*.58,h*.55);this.drawArrow(c,w*.43,h*.52,31,s);return;}
    let all=route.points.flatMap(p=>[p.ship,p.target,p.earth]);if(route.frame==='sun')all.push([0,0,0]);
    const xs=all.map(p=>p[0]),ys=all.map(p=>p[j]);let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    const range=Math.max(xmax-xmin,ymax-ymin,1),scale=Math.min((w-130)/(xmax-xmin||range),(h-115)/(ymax-ymin||range));
    const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,map=p=>[w*.5+(p[0]-cx)*scale,h*.51-(p[j]-cy)*scale];
    const drawPath=(key,color,dash=[])=>{
      c.save();c.strokeStyle=color;c.lineWidth=key==='ship'?1.65:.9;c.setLineDash(dash);c.beginPath();
      route.points.forEach((p,i)=>{const [x,y]=map(p[key]);if(!i)c.moveTo(x,y);else if(key==='ship'){
        const control=shipSegment(route.points[i-1],p);c.bezierCurveTo(...map(control[1]),...map(control[2]),x,y);
      }else c.lineTo(x,y);});c.stroke();c.restore();
    };
    drawPath('target','#ae9aca80',[3,5]);if(route.frame==='sun')drawPath('earth','#83b8ca36',[2,6]);
    drawPath('ship','#9ce4cf');
    const first=route.points[0],earth=map(first.earth),target=map(first.target),start=map(first.ship);
    if(route.frame==='sun'){const sun=map([0,0,0]);drawPlanet(c,sun[0],sun[1],17,'sun');c.fillStyle='#b29d82';c.font='8px system-ui';c.textAlign='center';c.fillText('Sun',sun[0],sun[1]+29);}
    c.strokeStyle='#9da9c65c';c.setLineDash([2,4]);c.beginPath();c.moveTo(...earth);c.lineTo(...start);c.stroke();c.setLineDash([]);
    drawPlanet(c,earth[0],earth[1],25,'earth');c.fillStyle='#819ab8';c.font='9px system-ui';c.textAlign='center';c.fillText('Earth',earth[0],earth[1]+41);
    drawPlanet(c,target[0],target[1],s.level.id==='moon'?17:19,s.level.id);c.fillStyle='#bbafcc';c.fillText(s.level.name+' · now',target[0],target[1]+31);
    const encounter=route.encounter;
    if(encounter?.target){const future=map(encounter.target),ship=map(encounter.ship);c.strokeStyle='#cbb2ef';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.arc(future[0],future[1],18,0,7);c.stroke();c.beginPath();c.moveTo(...ship);c.lineTo(...future);c.stroke();c.setLineDash([]);c.fillStyle='#beabd5';c.font='8px system-ui';c.fillText('Predicted encounter',future[0],future[1]-25);c.fillStyle='#b9f5df';c.beginPath();c.arc(ship[0],ship[1],3,0,7);c.fill();}
    const marker=route.points[Math.floor((time*.03%1)*route.points.length)],m=map(marker.ship);c.save();c.shadowBlur=10;c.shadowColor='#9ce4cf';c.fillStyle='#dcfff2';c.beginPath();c.arc(m[0],m[1],2.4,0,7);c.fill();c.restore();
    if(s.level.id==='proxima'&&this.projection==='xz'&&Math.abs(s.settings.heading-90)<1&&Math.abs(s.settings.pitch)<1){c.fillStyle='#a7abc4';c.textAlign='center';c.font='10px system-ui';c.fillText('The route follows Y. Use XY to see the full path.',w*.5,h-56);}
    if(this.glyphCache?.route!==route||this.glyphCache.j!==j||this.glyphCache.w!==w||this.glyphCache.h!==h){
      this.glyphCache={route,j,w,h,glyph:departureGlyph(route.points,map,j,earth)};
    }
    this.drawArrow(c,earth[0],earth[1],25,s,this.glyphCache.glyph);
    c.fillStyle='#5d7297';c.textAlign='left';c.font='8px monospace';c.fillText(this.projection==='xy'?'Y ↑    X →':'Z ↑    X →',18,h-19);
  }
  drawArrow(c,x,y,r,s,glyph){
    const settings=s.route?.settings||s.settings,offset=s.route?.velocityOffset||[0,0,0];
    const v=projectedLaunch(settings,offset,this.projection,s.level.id==='proxima'),angle=Math.atan2(v[1],v[0]);
    if(glyph===null){this.arrow=null;return;}
    const dx=glyph?.dx??Math.cos(angle),dy=glyph?.dy??-Math.sin(angle);
    const ax=glyph?.x??x+dx*(r+14),ay=glyph?.y??y+dy*(r+14),fraction=(settings.speed-s.level.range[0])/(s.level.range[1]-s.level.range[0]);
    const len=51+clamp(fraction,0,1)*67,ex=ax+dx*len,ey=ay+dy*len;
    c.save();c.strokeStyle='#d8c2ff';c.lineWidth=1.5;c.beginPath();c.moveTo(ax,ay);c.lineTo(ex,ey);c.stroke();c.fillStyle='#cfb5ff';c.beginPath();c.arc(ex,ey,5,0,7);c.fill();c.strokeStyle='#c5a9f544';c.lineWidth=1;c.beginPath();c.arc(ex,ey,10,0,7);c.stroke();drawRocket(c,ax,ay,.36,Math.atan2(dy,dx)+Math.PI/2,0);c.restore();
    this.arrow={x:ax,y:ay,r:0,velocityOffset:offset,angleOffset:Math.atan2(-dy,dx)-angle};
  }
}
export class FlightRenderer {
  constructor(canvas,seed){this.canvas=canvas;const r=new Random(seed);this.stars=Array.from({length:140},()=>({x:r.next(),y:r.next(),size:r.range(.5,1.7),depth:r.range(.1,.7),twinkle:r.next()*7}));this.particles=[];this.labels=[];this.shake=0;this.flash=0;this.cameraX=0;this.cameraY=0;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  effect(event){
    const colors={collect:'#a6efd6',hit:'#f8ad9a',near:'#dfc2ff',escape:'#d7b5ff'},color=colors[event.type];
    if(color){const rng=new Random((event.x*13+event.y*7)|0);for(let i=0;i<(this.reduced?5:20);i++){const a=rng.next()*Math.PI*2,v=rng.range(15,100);this.particles.push({x:event.x,y:event.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rng.range(.4,.9),max:.9,color,size:rng.range(1.2,3)});}this.labels.push({x:event.x,y:event.y,text:event.text,life:1.5,color});}
    if(event.type==='hit'){this.shake=this.reduced?0:9;this.flash=.32;}
  }
  draw(f,dt){
    const {ctx:c,w,h}=fitCanvas(this.canvas),scale=clamp(h/1040,.48,1.2),time=f.time;
    const follow=1-Math.exp(-dt*5);this.cameraX+=(f.x-this.cameraX)*follow;this.cameraY+=(f.y-this.cameraY)*follow;
    const map=(x,y)=>[w*.5+(x-this.cameraX)*scale,h*.72-(y-this.cameraY)*scale];
    c.fillStyle='#11172d';c.fillRect(0,0,w,h);
    const neb=c.createRadialGradient(w*.27,h*.25,0,w*.5,h*.4,w*.68);neb.addColorStop(0,f.level.id==='proxima'?'#6b396f30':'#35497738');neb.addColorStop(.6,'#322f5a14');neb.addColorStop(1,'#12172c00');c.fillStyle=neb;c.fillRect(0,0,w,h);
    const neb2=c.createRadialGradient(w*.85,h*.65,0,w*.8,h*.55,w*.38);neb2.addColorStop(0,'#66506a20');neb2.addColorStop(1,'#12172c00');c.fillStyle=neb2;c.fillRect(0,0,w,h);
    for(const star of this.stars){
      const sx=((star.x*w-this.cameraX*star.depth*.08)%w+w)%w,sy=((star.y*h+this.cameraY*star.depth*.1)%h+h)%h;
      c.globalAlpha=clamp(.3+star.depth*.6+Math.sin(time*.4+star.twinkle)*.1,.15,.95);c.fillStyle='#d8e1ff';
      if(f.vy>f.level.speed*1.35){c.strokeStyle='#b8c6e480';c.lineWidth=star.size*.6;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx,sy+clamp(f.vy/f.level.speed*3,2,12));c.stroke();}else{c.beginPath();c.arc(sx,sy,star.size,0,7);c.fill();}
    }c.globalAlpha=1;
    if(f.progress<.15){drawPlanet(c,w*.85,h*1.4+f.progress*h*4,h*.5,'earth',.19*(1-f.progress/.15));}
    if(f.progress>.75){drawPlanet(c,w*.56,h*.16,30+(f.progress-.75)*h*1.1,f.level.id,.12+(f.progress-.75)*1.5);}
    this.shake=Math.max(0,this.shake-dt*30);c.save();if(this.shake){c.translate(Math.sin(time*135)*this.shake,Math.cos(time*170)*this.shake*.5);}
    for(const o of f.objects){const [x,y]=map(o.x,o.y);if(y< -160||y>h+180||x< -180||x>w+180)continue;this.object(c,o,x,y,scale,time);}
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;const [x,y]=map(p.x,p.y);c.globalAlpha=Math.max(0,p.life/p.max);c.fillStyle=p.color;c.beginPath();c.arc(x,y,p.size,0,7);c.fill();}c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    const [rx,ry]=map(f.x,f.y),angle=clamp(f.thrustX*.25+f.vx*.001,-.5,.5);
    if(f.invincible<=0||Math.floor(f.time*12)%2===0){
      c.save();c.shadowColor='#a794ef38';c.shadowBlur=22;drawRocket(c,rx,ry,.82,angle,f.thrustY>.01,time,f.health<f.craft.maxHealth);c.restore();
      if(f.thrustX){c.save();c.fillStyle='#ffd4a1';c.shadowColor='#ffb89c';c.shadowBlur=10;c.beginPath();const side=f.thrustX>0?-1:1;c.moveTo(rx+side*12,ry+8);c.lineTo(rx+side*(28+Math.sin(time*35)*4),ry+11);c.lineTo(rx+side*12,ry+14);c.fill();c.restore();}
    }
    if(f.fuel<=0){c.fillStyle='#dcba91';c.textAlign='center';c.font='9px system-ui';c.fillText('No fuel / coasting',rx,ry+47);}
    for(const l of this.labels){l.life-=dt;const [x,y]=map(l.x,l.y);c.globalAlpha=Math.min(1,l.life*2);c.fillStyle=l.color;c.font='600 11px system-ui';c.textAlign='center';c.fillText(l.text,x,y-32-(1.5-l.life)*22);}c.globalAlpha=1;this.labels=this.labels.filter(l=>l.life>0);c.restore();
    if(this.flash>0){c.fillStyle=`rgba(239,132,133,${this.flash*.38})`;c.fillRect(0,0,w,h);this.flash=Math.max(0,this.flash-dt);}
    // Warning arrows give a readable lead before fast objects enter the view.
    for(const o of f.objects){const [x,y]=map(o.x,o.y);if(y< -35&&y> -320&&o.kind==='hole'){c.fillStyle='#e4afd6';c.font='9px system-ui';c.textAlign='center';c.fillText('▼ Gravity anomaly',clamp(x,80,w-80),118);}}
  }
  object(c,o,x,y,s,t){
    c.save();c.translate(x,y);const r=o.radius*s;
    if(o.kind==='hole'){
      const rg=o.range*s;c.save();c.strokeStyle='#ac87c329';c.setLineDash([3,9]);c.lineWidth=1;c.beginPath();c.arc(0,0,rg,0,7);c.stroke();c.restore();
      const g=c.createRadialGradient(0,0,r*.5,0,0,r*3);g.addColorStop(0,'#d9a9e887');g.addColorStop(.55,'#8655be45');g.addColorStop(1,'#8b52bc00');c.fillStyle=g;c.fillRect(-r*3,-r*3,r*6,r*6);
      c.rotate(-.28);c.strokeStyle='#e0b2e9';c.lineWidth=r*.24;c.beginPath();c.ellipse(0,0,r*1.8,r*.48,0,0,7);c.stroke();c.fillStyle='#080c20';c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='#c29fef';c.lineWidth=1.8;c.beginPath();c.arc(0,0,r*1.08,0,7);c.stroke();c.rotate(t*.3);c.strokeStyle='#f4c7d3a8';c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,r*1.65,r*1.3,0,0,Math.PI*.7);c.stroke();
    }else if(['rock','ice','comet'].includes(o.kind)){
      if(o.kind==='comet'){
        const g=c.createLinearGradient(0,0,-r*2,-r*6);g.addColorStop(0,'#92dcca70');g.addColorStop(1,'#a2d9eb00');c.fillStyle=g;c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(-r*3,-r*3,-r*2,-r*7);c.lineTo(r,0);c.fill();
        if(!o.harvested){c.strokeStyle='#9feacf77';c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.arc(0,0,(o.radius+116)*s,0,7);c.stroke();c.setLineDash([]);for(let k=0;k<4;k++){const a=t*.4+k*Math.PI*.5;c.fillStyle=k%2?'#ffbd8f':'#9ce4cf';c.beginPath();c.arc(Math.cos(a)*r*2.3,Math.sin(a)*r*2.3,3.5,0,7);c.fill();}}
      }
      c.rotate(o.angle);const grad=c.createLinearGradient(-r,-r,r,r);grad.addColorStop(0,o.kind==='ice'?'#b8d2e3':o.kind==='comet'?'#b5d6d0':'#b5a0b3');grad.addColorStop(1,o.kind==='ice'?'#667eaa':'#6a627e');c.fillStyle=grad;c.strokeStyle=o.kind==='ice'?'#d5f4f89c':'#c5b6c04d';c.lineWidth=1;
      c.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rad=r*(.88+.12*Math.sin(i*2.1+o.variant));i?c.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):c.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}c.closePath();c.fill();c.stroke();
      c.fillStyle='#3339533d';c.beginPath();c.ellipse(-r*.3,-r*.25,r*.23,r*.2,0,0,7);c.fill();c.beginPath();c.ellipse(r*.28,r*.23,r*.31,r*.22,-.3,0,7);c.fill();c.strokeStyle='#f4e7eb3d';c.beginPath();c.arc(-r*.3,-r*.25,r*.22,3.1,5.7);c.stroke();
      if(o.kind==='ice'){c.strokeStyle='#d3ecf194';c.beginPath();c.moveTo(-r*.6,0);c.lineTo(0,-r*.2);c.lineTo(r*.3,-r*.7);c.stroke();}
    }else{
      const col=o.kind==='fuel'?'#ffbc8f':o.kind==='repair'?'#c5b2f4':'#9ce4cf';
      c.save();c.shadowBlur=18;c.shadowColor=col;c.fillStyle=col+'20';c.beginPath();c.arc(0,0,r*2,0,7);c.fill();c.restore();
      c.translate(0,Math.sin(t*2+o.id)*3);c.fillStyle=col;c.strokeStyle='#fff9';c.lineWidth=.8;
      if(o.kind==='repair'){c.fillStyle=col;roundRepair(c,r);}else{c.beginPath();c.moveTo(0,-r);c.lineTo(r*.65,-r*.28);c.lineTo(r*.45,r*.6);c.lineTo(0,r);c.lineTo(-r*.6,r*.3);c.lineTo(-r*.65,-r*.35);c.closePath();c.fill();c.stroke();c.strokeStyle='#30345066';c.beginPath();c.moveTo(0,-r);c.lineTo(-r*.12,0);c.lineTo(0,r);c.moveTo(-r*.65,-r*.35);c.lineTo(-r*.12,0);c.lineTo(r*.65,-r*.28);c.stroke();}
      c.fillStyle='#dffcf188';c.beginPath();c.arc(-r*.35,-r*.35,r*.12,0,7);c.fill();
    }c.restore();
  }
}
function roundRepair(c,r){c.beginPath();c.roundRect(-r,-r,r*2,r*2,r*.35);c.fill();c.stroke();c.strokeStyle='#3c3564';c.lineWidth=r*.38;c.beginPath();c.moveTo(-r*.5,0);c.lineTo(r*.5,0);c.moveTo(0,-r*.5);c.lineTo(0,r*.5);c.stroke();}
