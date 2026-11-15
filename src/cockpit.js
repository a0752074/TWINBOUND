import {clamp,fmt} from './config.js';
import {Random} from './physics.js';
import {fitCanvas} from './render.js';
import {drawPlanet} from './art.js';
import {objectDepth,perspectivePoint,cockpitContact} from './flight-3d.js';

function polygon(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
export class CockpitRenderer {
  constructor(canvas,seed){this.canvas=canvas;const rng=new Random(seed^0x3d17a2);this.stars=Array.from({length:210},()=>({x:rng.next(),y:rng.next(),r:rng.range(.4,1.5),depth:rng.range(.15,1),phase:rng.range(0,7)}));this.effects=[];this.bank=0;}
  effect(e){if(['collect','hit','near','escape'].includes(e.type))this.effects.push({...e,life:1.1});if(this.effects.length>40)this.effects.shift();}
  draw(f,dt){const {ctx:c,w,h}=fitCanvas(this.canvas);this.drawScene(c,w,h,f,dt);}
  drawScene(c,w,h,f,dt=0){
    const state=f.pilot3D||{z:0,vz:0,bonus:0,activeSeconds:0},time=f.time,camera={x:f.x,y:f.y,z:state.z};
    c.fillStyle='#080e22';c.fillRect(0,0,w,h);
    const neb=c.createRadialGradient(w*.68,h*.30,2,w*.58,h*.35,w*.64);neb.addColorStop(0,'#33356588');neb.addColorStop(.4,'#1a2b4a66');neb.addColorStop(1,'#080e2200');c.fillStyle=neb;c.fillRect(0,0,w,h);
    glow(c,w*.15,h*.37,w*.50,'#70426a24');glow(c,w*.83,h*.58,w*.40,'#397f9222');
    this.bank+=(clamp(-f.vx/1900,-.075,.075)-this.bank)*(1-Math.exp(-dt*4));
    c.save();c.translate(w*.5,h*.43);c.rotate(this.bank);c.translate(-w*.5,-h*.43);
    for(const star of this.stars){
      const x=((star.x*w-f.x*star.depth*.045)%w+w)%w,y=((star.y*h+f.y*star.depth*.025+state.z*star.depth*.04)%h+h)%h;
      c.globalAlpha=.3+star.depth*.55+Math.sin(time*.45+star.phase)*.1;c.fillStyle=star.depth>.8?'#fff1df':'#b9d2fa';
      c.beginPath();c.arc(x,y,star.r,0,Math.PI*2);c.fill();
      if(f.vy>f.level.speed*1.4){c.strokeStyle='#a5d6e85c';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+(x-w*.5)*.009,y+(y-h*.43)*.009);c.stroke();}
    }c.globalAlpha=1;
    const planetRadius=22+Math.pow(clamp(f.progress,0,1),3)*Math.min(w,h)*.22;
    drawPlanet(c,w*.72,h*.25,planetRadius,f.level.id,.4+f.progress*.55);
    c.save();c.strokeStyle='#91cabf20';c.lineWidth=.7;c.setLineDash([2,12]);
    for(const z of [-300,0,300]){
      const points=[0,1,2,3,4].map(i=>perspectivePoint({x:camera.x-650+i*325,y:camera.y+850,z:camera.z+z},camera,w,h));
      c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
    }c.restore();
    const objects=f.objects.map(o=>({o,z:objectDepth(o,f.seed),p:perspectivePoint({x:o.x,y:o.y,z:objectDepth(o,f.seed)},camera,w,h)})).filter(q=>q.p&&q.p.depth<5200).sort((a,b)=>b.p.depth-a.p.depth);
    for(const {o,z,p} of objects){const r=Math.min(Math.max(o.radius*p.scale,1.4),Math.max(w,h));if(p.x< -r*4||p.x>w+r*4||p.y< -r*4||p.y>h+r*4)continue;this.object(c,o,p,r,time,z-camera.z);}
    for(const e of this.effects){
      e.life-=dt;const p=perspectivePoint({x:e.x,y:e.y+100,z:e.z??camera.z},camera,w,h);if(!p)continue;
      c.globalAlpha=clamp(e.life,0,1);const color=e.type==='hit'?'#f5a18f':e.type==='collect'?'#9ce4cf':'#d9c4ff';glow(c,p.x,p.y,48,color+'40');
      c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,(1.2-e.life)*45+8,0,7);c.stroke();
    }this.effects=this.effects.filter(e=>e.life>0);c.globalAlpha=1;c.restore();
    const cx=w*.5,cy=h*.43;c.strokeStyle='#a9eedb9c';c.lineWidth=1;
    for(const side of [-1,1]){c.beginPath();c.moveTo(cx+side*10,cy);c.lineTo(cx+side*22,cy);c.stroke();c.beginPath();c.moveTo(cx,cy+side*10);c.lineTo(cx,cy+side*18);c.stroke();}
    c.fillStyle='#d2fff0';c.beginPath();c.arc(cx,cy,1.5,0,7);c.fill();
    c.textAlign='center';c.font='9px monospace';c.fillStyle='#a6c3db';c.fillText('3D COCKPIT  /  THREE-AXIS RCS',cx,34);
    if(f.stability<60){c.fillStyle='#ffb294';c.fillText('COURSE DEVIATION  /  FOLLOW GUIDANCE',cx,cy+58);}
    this.cockpit(c,w,h,f,state);
    this.contacts(c,w,h,f,camera);
  }
  contacts(c,w,h,f,camera){
    const color=o=>o.kind==='hole'?'#dfaff5':['rock','ice','comet'].includes(o.kind)?'#f2b59b':o.kind==='fuel'?'#ffc099':'#9ce4cf';
    c.save();c.font='9px monospace';c.textAlign='center';
    for(const o of f.objects){
      const q=cockpitContact(o,f.seed,camera,w,h);if(!q.cue)continue;
      const p=q.cue;c.fillStyle=color(o);c.strokeStyle=color(o);c.lineWidth=1;
      c.beginPath();c.moveTo(p.x,p.y-5);c.lineTo(p.x+4,p.y+3);c.lineTo(p.x-4,p.y+3);c.closePath();c.stroke();
      c.fillText(q.altitude>0?'↑':'↓',p.x,p.y+(q.altitude>0?18:-10));
    }
    // A compact top-down reference keeps the 2D encounter stream readable
    // while perspective objects pass above, below or beside the window.
    const rw=w<640?104:144,rh=w<640?72:82,x=18,y=h*.72-rh;
    c.fillStyle='#0c172bdf';c.strokeStyle='#5c7c9870';c.lineWidth=1;
    c.beginPath();c.roundRect(x,y,rw,rh,7);c.fill();c.stroke();
    c.textAlign='left';c.fillStyle='#8baec7';c.font='7px monospace';c.fillText('LOCAL CONTACTS / ΔZ',x+8,y+12);
    const px=x+rw*.5,py=y+rh-12;
    c.strokeStyle='#7193a338';c.beginPath();c.moveTo(px,y+19);c.lineTo(px,py);c.stroke();
    for(const o of f.objects){
      const ahead=o.y-camera.y;if(ahead< -650||ahead>1800)continue;
      const dx=clamp((o.x-camera.x)/650,-1,1)*(rw*.44),dy=ahead/1800*(rh-28);
      const dz=objectDepth(o,f.seed)-camera.z;
      c.strokeStyle=color(o);c.fillStyle=color(o);c.globalAlpha=Math.abs(dz)>250?.55:1;
      c.beginPath();c.arc(px+dx,clamp(py-dy,y+20,y+rh-6),o.kind==='hole'?3.4:2.2,0,7);c.stroke();
      if(Math.abs(dz)<80)c.fill();
    }
    c.globalAlpha=1;c.fillStyle='#e5f9f1';polygon(c,[[px,py-4],[px+3,py+3],[px-3,py+3]],'#e5f9f1');
    c.restore();
  }
  object(c,o,p,r,time,height){
    const x=p.x,y=p.y;
    if(o.kind==='hole'){
      glow(c,x,y,r*5,'#9657c940');c.save();c.translate(x,y);c.rotate(-.30+Math.sin(time*.3)*.06);
      for(let j=4;j>=1;j--){c.strokeStyle=['','#ffc7a5a0','#ef9fc57c','#b397e66b','#6d80c535'][j];c.lineWidth=r*(j===1?.16:.06);c.beginPath();c.ellipse(0,0,r*(2.3+j*.25),r*(.44+j*.07),0,0,7);c.stroke();}
      c.fillStyle='#050615';c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='#dbb6ec';c.lineWidth=Math.max(1,r*.04);c.stroke();c.restore();return;
    }
    if(['energy','fuel','repair'].includes(o.kind)){
      const color=o.kind==='energy'?'#9ce4cf':o.kind==='fuel'?'#ffc099':'#cab7ff';glow(c,x,y,r*4,color+'39');
      c.save();c.translate(x,y);c.rotate(time*.5+o.angle);c.strokeStyle=color+'70';c.lineWidth=1;c.beginPath();c.ellipse(0,0,r*1.7,r*.9,.5,0,7);c.stroke();
      polygon(c,[[0,-r],[r*.65,-r*.1],[r*.35,r*.9],[-r*.4,r*.65],[-r*.7,-r*.2]],color+'b8',color);
      polygon(c,[[0,-r],[r*.65,-r*.1],[0,r*.23],[-r*.7,-r*.2]],'#efffffa0');c.restore();
      if(r>6){c.fillStyle='#111c2c';c.font=`bold ${Math.max(10,r*.7)}px monospace`;c.textAlign='center';c.fillText(o.kind==='energy'?'ϟ':o.kind==='fuel'?'◈':'+',x,y+r*.25);}
      return;
    }
    if(o.kind==='comet'){
      const tail=c.createLinearGradient(x,y,x+r*6,y-r*3);tail.addColorStop(0,'#a4def3a0');tail.addColorStop(1,'#a6cfff00');
      polygon(c,[[x-r,y],[x+r*6,y-r*3.8],[x+r*4,y-r*.6],[x,y+r]],tail);
      glow(c,x,y,r*4.4,'#99cce14f');c.strokeStyle='#a1d9e750';c.lineWidth=1;c.beginPath();c.arc(x,y,r*3,0,7);c.stroke();
    }
    const shade=c.createRadialGradient(x-r*.4,y-r*.4,r*.1,x+r*.3,y+r*.3,r*1.3);
    shade.addColorStop(0,o.kind==='ice'?'#b4d3e9':'#adacb5');shade.addColorStop(.5,o.kind==='ice'?'#54758f':'#686b7e');shade.addColorStop(1,'#20263e');
    const points=Array.from({length:11},(_,j)=>{const a=j/11*Math.PI*2+o.angle,shape=.82+.13*Math.sin(j*13.7+o.variant*7);return [x+Math.cos(a)*r*shape,y+Math.sin(a)*r*shape];});
    polygon(c,points,shade,o.kind==='ice'?'#b1d5e777':'#a1abc44a');
    polygon(c,[points[1],points[3],[x-r*.1,y+r*.08],points[8]],'#ced7ec18');
    c.strokeStyle='#0c172c45';c.lineWidth=Math.max(1,r*.035);
    for(const k of [1,4,7]){c.beginPath();c.moveTo(...points[k]);c.lineTo(x+r*.13*Math.sin(k),y+r*.15*Math.cos(k));c.lineTo(...points[(k+2)%11]);c.stroke();}
    if(r>13&&p.depth<650){c.textAlign='center';c.font='8px monospace';c.fillStyle='#b4bfd3';c.fillText(`${Math.round(p.depth)} m  /  ${height>=0?'+':''}${Math.round(height)} Z`,x,y+r+15);}
  }
  cockpit(c,w,h,f,s){
    const edge=c.createLinearGradient(0,h*.7,0,h);edge.addColorStop(0,'#17223aee');edge.addColorStop(1,'#070c1d');
    polygon(c,[[0,h],[0,h*.12],[w*.035,h*.18],[w*.13,h*.76],[w*.28,h*.84],[w*.72,h*.84],[w*.87,h*.76],[w*.965,h*.18],[w,h*.12],[w,h]],edge,'#344962');
    polygon(c,[[0,h*.93],[w*.18,h*.81],[w*.32,h*.87],[w*.68,h*.87],[w*.82,h*.81],[w,h*.93],[w,h],[0,h]],'#0d1529','#4a6381');
    c.strokeStyle='#7ce4ca61';c.lineWidth=1.3;c.beginPath();c.moveTo(w*.035,h*.18);c.lineTo(w*.14,h*.77);c.lineTo(w*.29,h*.85);c.moveTo(w*.965,h*.18);c.lineTo(w*.86,h*.77);c.lineTo(w*.71,h*.85);c.stroke();
    const bx=w*.34,by=h*.88,bw=w*.32,bh=h*.105;
    polygon(c,[[bx,by+bh],[bx+6,by],[bx+bw-6,by],[bx+bw,by+bh]],'#122234','#55718c');
    c.textAlign='center';c.font='8px monospace';c.fillStyle='#8fa9c4';c.fillText('LOCAL VERTICAL',w*.5,by+15);
    c.font=`${Math.max(12,Math.min(19,w*.017))}px monospace`;c.fillStyle='#b5f3df';c.fillText(`${fmt(s.z,0)} m  /  ${fmt(s.vz,1)} m/s`,w*.5,by+34);
    c.font='8px monospace';c.fillStyle='#b8a8e8';c.fillText(`3D BONUS  +${fmt(s.bonus,0)}`,w*.5,by+bh-7);
    if(w>640){
      c.textAlign='left';c.font='9px monospace';c.fillStyle='#a7b6d2';c.fillText('RCS / TRANSLATION',w*.1,h*.93);c.font='8px monospace';c.fillStyle='#729cb4';c.fillText('W S  /  A D  /  Q E',w*.1,h*.96);
      c.textAlign='right';c.fillStyle=f.stability<60?'#ffba9e':'#9ce4cf';c.fillText(`ROUTE ${Math.round(f.stability)}%`,w*.9,h*.93);c.fillStyle='#7f99b9';c.fillText('SPACE / COAST',w*.9,h*.96);
      for(const [x,value,color]of [[w*.27,clamp((s.vz+50)/100,0,1),'#9adfcf'],[w*.73,f.stability/100,f.stability<40?'#f5b090':'#b6a4ee']]){
        c.strokeStyle='#4a65835c';c.lineWidth=2;c.beginPath();c.arc(x,h*.933,22,Math.PI*.75,Math.PI*2.25);c.stroke();
        c.strokeStyle=color;c.beginPath();c.arc(x,h*.933,22,Math.PI*.75,Math.PI*.75+Math.PI*1.5*value);c.stroke();
        c.fillStyle='#8ca5c0';c.font='7px monospace';c.textAlign='center';c.fillText(x<w*.5?'Z VEL':'ROUTE',x,h*.941);
      }
    }
    const thrust=Math.hypot(f.thrustX,f.thrustY,s.thrustZ)>.01;
    if(thrust){glow(c,w*.5,h*1.03,w*.20,'#fac79a38');c.fillStyle='#ffc599';c.beginPath();c.arc(w*.5,h*.855,2.3,0,7);c.fill();}
  }
}
