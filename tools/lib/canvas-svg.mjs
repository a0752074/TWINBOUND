// Canvas command recorder for deterministic renderer previews; no browser required.
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export class SVGCanvas {
 constructor(width,height){this.width=width;this.height=height;this.elements=[];this.definitions=[];this.path='';this.stack=[];this.matrix=[1,0,0,1,0,0];this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.globalAlpha=1;this.font='10px monospace';this.textAlign='left';this.dash=[];this.clipId=null;}
 save(){this.stack.push({matrix:this.matrix.slice(),fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,globalAlpha:this.globalAlpha,font:this.font,textAlign:this.textAlign,dash:this.dash.slice(),clipId:this.clipId});}
 restore(){Object.assign(this,this.stack.pop());}
 translate(x,y){this.matrix=multiply(this.matrix,[1,0,0,1,x,y]);}
 rotate(a){this.matrix=multiply(this.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);}
 scale(x,y){this.matrix=multiply(this.matrix,[x,0,0,y,0,0]);}
 setTransform(...m){this.matrix=m;}
 beginPath(){this.path='';}
 moveTo(x,y){this.path+=`M${x} ${y} `;}
 lineTo(x,y){this.path+=`L${x} ${y} `;}
 quadraticCurveTo(...p){this.path+='Q'+p.join(' ')+' ';}
 bezierCurveTo(...p){this.path+='C'+p.join(' ')+' ';}
 roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();}
 closePath(){this.path+='Z ';}
 arc(x,y,r,a,b,reverse=false){this.ellipse(x,y,r,r,0,a,b,reverse);}
 ellipse(x,y,rx,ry,rotation,a,b,reverse=false){let delta=b-a;if(!reverse&&delta<0)delta+=2*Math.PI;if(reverse&&delta>0)delta-=2*Math.PI;delta=Math.sign(delta)*Math.min(Math.abs(delta),2*Math.PI);const count=Math.max(8,Math.ceil(Math.abs(delta)*16));for(let j=0;j<=count;j++){const t=a+delta*j/count,xx=rx*Math.cos(t),yy=ry*Math.sin(t),p=[x+xx*Math.cos(rotation)-yy*Math.sin(rotation),y+xx*Math.sin(rotation)+yy*Math.cos(rotation)];if(j===0&&!this.path)this.moveTo(...p);else this.lineTo(...p);}}
 setLineDash(dash){this.dash=dash;}
 paint(fill,stroke){this.emit(`<path d="${this.path}" fill="${fill?escape(this.fillStyle):'none'}" stroke="${stroke?escape(this.strokeStyle):'none'}" stroke-width="${this.lineWidth}" stroke-dasharray="${this.dash.join(' ')}"/>`);}
 fill(){this.paint(true,false);}
 stroke(){this.paint(false,true);}
 fillRect(x,y,width,height){this.emit(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${escape(this.fillStyle)}"/>`);}
 strokeRect(x,y,width,height){this.emit(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${escape(this.strokeStyle)}" stroke-width="${this.lineWidth}"/>`);}
 fillText(text,x,y){const size=this.font.match(/([\d.]+)px/)?.[1]||10;this.emit(`<text x="${x}" y="${y}" fill="${escape(this.fillStyle)}" font-family="monospace" font-size="${size}" font-weight="${this.font.includes('bold')?'bold':'normal'}" text-anchor="${this.textAlign==='center'?'middle':this.textAlign==='right'?'end':'start'}">${escape(text)}</text>`);}
 clip(){const id='clip'+this.definitions.length;this.definitions.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${this.path}" transform="matrix(${this.matrix.join(' ')})"/></clipPath>`);this.clipId=id;}
 createRadialGradient(x0,y0,r0,x1,y1,r1){return this.gradient('radialGradient',`gradientUnits="userSpaceOnUse" fx="${x0}" fy="${y0}" cx="${x1}" cy="${y1}" r="${r1}"`);}
 createLinearGradient(x0,y0,x1,y1){return this.gradient('linearGradient',`gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"`);}
 gradient(tag,attrs){const id='gradient'+this.definitions.length,index=this.definitions.length,stops=[];this.definitions.push('');return {addColorStop:(offset,color)=>{stops.push(`<stop offset="${offset}" stop-color="${escape(color)}"/>`);this.definitions[index]=`<${tag} id="${id}" ${attrs}>${stops.join('')}</${tag}>`;},toString:()=>`url(#${id})`};}
 emit(element){const transformed=`<g transform="matrix(${this.matrix.join(' ')})" opacity="${this.globalAlpha}">${element}</g>`;this.elements.push(this.clipId?`<g clip-path="url(#${this.clipId})">${transformed}</g>`:transformed);}
 svg(){return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><defs>${this.definitions.join('')}</defs>${this.elements.join('')}</svg>`;}
}
