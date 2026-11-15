let svgId=0;
export function planetSVG(kind,extra=''){
  const id='p'+(++svgId),colors={moon:['#e5e4f0','#9daac9'],mars:['#f5bc92','#ba6b60'],pluto:['#e7cfc0','#9b869f'],proxima:['#ffd0a7','#d67c9f'],earth:['#92c5dd','#46759c']},c=colors[kind]||colors.moon;
  const spots=kind==='moon'?'<g fill="#8995b4" opacity=".45"><circle cx="36" cy="30" r="9"/><circle cx="63" cy="57" r="12"/><circle cx="32" cy="63" r="5"/><circle cx="66" cy="30" r="4"/><circle cx="48" cy="45" r="3"/></g>':kind==='mars'?'<g fill="#9d5661" opacity=".4"><path d="M15 42q24-8 39 2t34-7l4 16q-20 2-33-4T12 56Z"/><ellipse cx="64" cy="68" rx="14" ry="7"/><ellipse cx="45" cy="24" rx="13" ry="5"/></g><path d="M39 12q13-5 23 2l-6 7-15-2Z" fill="#f8ded4"/>':kind==='pluto'?'<path d="M42 43q13-12 23 3 14-13 19-1 6 14-19 30-25-16-23-32" fill="#f7e1cf" opacity=".9"/><path d="M10 28q14 12 30 5l-7 15-20-1Z" fill="#87778f" opacity=".5"/>':kind==='earth'?'<g fill="#8bc5b0"><path d="m22 25 16-4 13 10-5 12-11 2-8 17-9-15Z"/><path d="m58 19 14 12 8 3-4 18-12 1-4-16-8-1Z"/><path d="m55 64 17-4 7 12-16 7Z"/></g><path d="M14 41q35-13 71-1M27 65q20-8 46-5" stroke="#d4e7ec" stroke-width="3" fill="none" opacity=".55"/>':'<g stroke="#ffe1c8" stroke-width="2" opacity=".5"><path d="m50 3 2 8m35 12-6 5M95 51l-8 1M15 20l7 6M7 56l8-1M29 90l4-8M67 91l-3-7"/></g>';
  return `<svg class="planet-art ${extra}" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="30%" cy="25%" r="80%"><stop stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></radialGradient><clipPath id="${id}c"><circle cx="50" cy="50" r="36"/></clipPath></defs>${kind==='proxima'?'<circle cx="50" cy="50" r="43" fill="#e8a1b6" opacity=".08"/>':''}<g clip-path="url(#${id}c)"><circle cx="50" cy="50" r="36" fill="url(#${id})"/>${spots}<path d="M68 14a36 36 0 0 1-39 68 38 38 0 0 0 39-68" fill="#141a39" opacity=".18"/></g><path d="M22 29a36 36 0 0 1 21-14" stroke="#fff" stroke-width="1.5" fill="none" opacity=".35"/>${kind==='proxima'?'<path d="m17 10 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#f5c8db"/>':''}</svg>`;
}
export function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
export function drawRocket(ctx,x,y,scale=1,angle=0,thrust=0,time=0,damaged=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  if(thrust){
    const pulse=1+.18*Math.sin(time*41);ctx.save();ctx.shadowColor='#ffbd87';ctx.shadowBlur=15;
    const g=ctx.createLinearGradient(0,20,0,68*pulse);g.addColorStop(0,'#fff1cb');g.addColorStop(.5,'#ffbe88');g.addColorStop(1,'#f989a000');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(-9,22);ctx.quadraticCurveTo(-12,40,0,64*pulse);ctx.quadraticCurveTo(12,40,9,22);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff1c8';ctx.beginPath();ctx.moveTo(-4,24);ctx.quadraticCurveTo(-4,37,0,45);ctx.quadraticCurveTo(5,37,4,24);ctx.fill();ctx.restore();
  }
  ctx.fillStyle='#a99ad6';ctx.beginPath();ctx.moveTo(-13,4);ctx.quadraticCurveTo(-27,12,-26,31);ctx.lineTo(-11,23);ctx.fill();ctx.beginPath();ctx.moveTo(13,4);ctx.quadraticCurveTo(27,12,26,31);ctx.lineTo(11,23);ctx.fill();
  const body=ctx.createLinearGradient(-16,0,15,0);body.addColorStop(0,'#d9d7e8');body.addColorStop(.45,'#fcf4e7');body.addColorStop(1,'#c3c3dc');ctx.fillStyle=body;
  ctx.beginPath();ctx.moveTo(-15,23);ctx.lineTo(-15,-7);ctx.quadraticCurveTo(-15,-30,0,-40);ctx.quadraticCurveTo(15,-30,15,-7);ctx.lineTo(15,23);ctx.quadraticCurveTo(0,29,-15,23);ctx.fill();
  ctx.fillStyle='#c4aff0';ctx.beginPath();ctx.moveTo(-12,-19);ctx.quadraticCurveTo(-8,-34,0,-40);ctx.quadraticCurveTo(9,-33,12,-19);ctx.quadraticCurveTo(0,-23,-12,-19);ctx.fill();
  ctx.strokeStyle='#98a5c3';ctx.lineWidth=2;ctx.fillStyle='#27354d';ctx.beginPath();ctx.arc(0,-4,10,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.save();ctx.beginPath();ctx.arc(0,-4,8.3,0,Math.PI*2);ctx.clip();ctx.fillStyle='#a9dfd5';ctx.fillRect(-9,-13,18,18);
  ctx.fillStyle='#e8e5f5';ctx.beginPath();ctx.ellipse(0,-1,6.4,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#374563';roundRect(ctx,-4,-4,8,6,2.5);ctx.fill();ctx.fillStyle='#d1edee';ctx.fillRect(-2.5,-2,1.3,1.5);ctx.fillRect(1,-2,1.3,1.5);ctx.fillStyle='#eab3c4';ctx.beginPath();ctx.arc(-5,0,1.6,0,7);ctx.arc(5,0,1.6,0,7);ctx.fill();ctx.restore();
  ctx.strokeStyle='#fff9';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-4,8.5,3.5,5.1);ctx.stroke();ctx.fillStyle='#b0a1d1';roundRect(ctx,-12,18,24,7,2);ctx.fill();ctx.fillStyle='#756d9b';roundRect(ctx,-8,25,16,4,2);ctx.fill();
  ctx.fillStyle='#a69abc';ctx.beginPath();ctx.arc(0,11,1.2,0,7);ctx.fill();
  if(damaged){ctx.strokeStyle='#8d789a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(9,7);ctx.lineTo(4,11);ctx.lineTo(9,16);ctx.lineTo(5,19);ctx.stroke();}
  ctx.restore();
}
export function drawPlanet(ctx,x,y,r,kind='moon',alpha=1){
  ctx.save();ctx.globalAlpha=alpha;const colors={moon:['#d4d9eb','#677b9e'],mars:['#e8aa86','#a65856'],pluto:['#d5bcad','#73647e'],earth:['#6fa9cf','#29486e'],sun:['#ffe2a0','#eb9c76'],proxima:['#ffc3a6','#ae5b83']},c=colors[kind]||colors.moon;
  const g=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.05,x,y,r);g.addColorStop(0,c[0]);g.addColorStop(1,c[1]);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  if(kind==='earth'){
    ctx.fillStyle='#82b5a4';ctx.beginPath();ctx.moveTo(x-r*.8,y-r*.35);ctx.lineTo(x-r*.2,y-r*.65);ctx.lineTo(x+r*.1,y-r*.17);ctx.lineTo(x-r*.3,y+r*.23);ctx.lineTo(x-r*.45,y+r*.7);ctx.lineTo(x-r*.68,y+r*.15);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+r*.5,y+r*.23,r*.21,r*.37,.4,0,7);ctx.fill();ctx.strokeStyle='#b1d1dd88';ctx.lineWidth=r*.07;ctx.beginPath();ctx.moveTo(x-r,y);ctx.quadraticCurveTo(x,y-r*.2,x+r,y+r*.1);ctx.stroke();
  }else if(kind==='mars'){
    ctx.fillStyle='#8c515344';ctx.beginPath();ctx.ellipse(x+r*.1,y+r*.1,r*.86,r*.14,-.15,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(x-r*.1,y+r*.5,r*.5,r*.18,.1,0,7);ctx.fill();
  }else{
    ctx.fillStyle='#283c5c30';for(const [dx,dy,s] of [[-.4,-.3,.22],[.35,.25,.29],[-.35,.5,.13],[.4,-.5,.11]]){ctx.beginPath();ctx.arc(x+r*dx,y+r*dy,r*s,0,7);ctx.fill();}
  }
  ctx.restore();
}
