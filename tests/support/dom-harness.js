// A small in-process DOM adapter for application-flow tests. It has no layout,
// Canvas rasterization, browser security model, or network implementation.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Worker as NodeWorker} from 'node:worker_threads';
import {webcrypto} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url),workers=[];
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
class Element {
  constructor(tag,attrs={},doc){this.tagName=tag.toLowerCase();this.attributes=attrs;this.doc=doc;this.children=[];this.parentElement=null;this.handlers={};this.style={setProperty(){}};this.value=attrs.value??'';this.min=attrs.min;this.max=attrs.max;this.hidden=Object.hasOwn(attrs,'hidden');this.disabled=Object.hasOwn(attrs,'disabled');this.open=false;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));this.classes=new Set((attrs.class||'').split(/\s+/).filter(Boolean));this.classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),toggle:(k,force)=>{const on=force??!this.classes.has(k);on?this.classes.add(k):this.classes.delete(k);return on;}};if(attrs.id)doc?.ids.set(attrs.id,this);}
  get id(){return this.attributes.id||'';}
  get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
  set textContent(s){this.text=String(s);this.children=[];}
  set innerHTML(html){this.text='';this.html=html;this.children=[];parse(html,this,this.doc);}
  get innerHTML(){return this.html||'';}
  addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
  dispatch(type,extra={}){const event={target:this,preventDefault(){},...extra};for(let el=this;el;el=el.parentElement){if(type==='click')el.onclick?.(event);for(const handler of el.handlers[type]||[])handler(event);}}
  click(){if(!this.disabled)this.dispatch('click');}
  focus(){this.doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  setPointerCapture(){}
  getContext(){if(!this.context){const methods={createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:text=>({width:String(text).length*7})};this.context=new Proxy(methods,{get:(obj,key)=>key in obj?obj[key]:(...args)=>{if(args.some(x=>typeof x==='number'&&!Number.isFinite(x)))throw Error('Non-finite Canvas coordinate: '+key);},set:(obj,key,value)=>{obj[key]=value;return true;}});}return this.context;}
  getBoundingClientRect(){return {left:0,top:0,right:900,bottom:700,width:900,height:700};}
  matches(selector){
    if(selector==='dialog:not(#pauseDialog)')return this.tagName==='dialog'&&this.attributes.id!=='pauseDialog';
    if(selector==='dialog[open]')return this.tagName==='dialog'&&this.open;
    if(selector.startsWith('#'))return this.attributes.id===selector.slice(1);
    if(selector.startsWith('.'))return this.classes.has(selector.slice(1));
    const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if(attr)return Object.hasOwn(this.attributes,attr[1])&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]);
    return this.tagName===selector;
  }
  closest(selector){for(let el=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
  querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function parse(html,parent,doc){
  const stack=[parent],voids=new Set(['meta','link','input','img','br','hr','source','area','base','wbr']);
  for(const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/([\w-]+)\s*>|<([\w-]+)\b([^>]*)>|([^<]+)/g)){
    if(match[1]){for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===match[1]){stack.length=i;break;}}
    else if(match[2]){
      const attrs={};for(const a of match[3].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');
      const el=new Element(match[2],attrs,doc),p=stack.at(-1);el.parentElement=p;p.children.push(el);
      if(!voids.has(el.tagName)&&!match[3].endsWith('/'))stack.push(el);
    }else if(match[4]){const el=new Element('#text',{},doc);el.text=decode(match[4]);el.parentElement=stack.at(-1);stack.at(-1).children.push(el);}
  }
  for(const select of parent.querySelectorAll('select'))select.value=select.children.find(c=>Object.hasOwn(c.attributes,'selected'))?.attributes.value??select.children.find(c=>c.tagName==='option')?.attributes.value??'';
}
export async function setupDOM(){
  const doc=new Element('document');doc.doc=doc;doc.ids=new Map();doc.getElementById=id=>doc.ids.get(id)||null;doc.createElement=tag=>new Element(tag,{},doc);doc.fullscreenElement=null;
  parse(await readFile(new URL('index.html',ROOT),'utf8'),doc,doc);doc.body=doc.querySelector('body');
  const windowEvents={};globalThis.document=doc;globalThis.window={addEventListener(type,fn){(windowEvents[type]??=[]).push(fn);},dispatchEvent(event){event.preventDefault??=()=>{};for(const fn of windowEvents[event.type]||[])fn(event);},scrollTo(){},matchMedia:()=>({matches:false}),devicePixelRatio:1};globalThis.location={protocol:'http:'};
  const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});let nextFrame=null;globalThis.requestAnimationFrame=callback=>{nextFrame=callback;return 0;};
  globalThis.fetch=async url=>{const resource=url instanceof URL?url:new URL(url,ROOT);if(resource.protocol!=='file:')throw Error('Unexpected network access');return new Response(await readFile(fileURLToPath(resource)));};
  globalThis.Worker=class{constructor(url){this.worker=new NodeWorker(new URL('worker-adapter.js',import.meta.url),{workerData:{entry:url.href}});workers.push(this.worker);this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',e=>this.onerror?.(e));}postMessage(data){this.worker.postMessage(data);}};
  const downloads=[];URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:in-process-test';};URL.revokeObjectURL=()=>{};
  return {doc,downloads,tick:now=>nextFrame?.(now),close:async()=>Promise.all(workers.map(w=>w.terminate()))};
}
export async function until(predicate,timeout=20000){const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error('Application flow timed out');await new Promise(r=>setTimeout(r,10));}}
