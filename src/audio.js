export class AudioEngine {
  constructor(enabled=false){this.enabled=enabled;this.context=null;}
  unlock(){
    if(!this.enabled)return;
    try{if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{}
  }
  note(frequency=440,duration=.15,volume=.025,delay=0,type='sine'){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const a=this.context,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(a.destination);o.start(t);o.stop(t+duration+.02);
  }
  play(kind){
    if(kind==='collect'){this.note(659,.15);this.note(988,.22,.02,.07);}
    else if(kind==='near'){this.note(784,.1,.015);this.note(1047,.14,.015,.06);}
    else if(kind==='hit'){this.note(130,.22,.045,0,'triangle');this.note(87,.25,.03,.03,'triangle');}
    else if(kind==='warning'){this.note(330,.2,.025);this.note(330,.2,.025,.26);}
    else if(kind==='arrived'){[523,659,784,1047].forEach((f,i)=>this.note(f,.5,.025,i*.11));}
    else if(kind==='failed'){[392,330,220].forEach((f,i)=>this.note(f,.35,.025,i*.16,'triangle'));}
    else if(kind==='start'){[392,523,784].forEach((f,i)=>this.note(f,.25,.02,i*.08));}
    else this.note(620,.07,.01);
  }
}
