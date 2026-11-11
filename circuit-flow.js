'use strict';

class CircuitFlow {
  constructor(studio) {
    this.studio=studio;
    this.running=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.speed=1;
    this.time=0;
    this.stepClock=0;
    this.readoutClock=0;
    this.phases=new Map();
    this.previous=null;
    this.current=null;
    this.wires={};
  }

  bind() {
    const {studio}=this;
    studio.$('#flow-play').onclick=()=>{
      this.running=!this.running;
      if(this.running && studio.result?.mode==='time' && studio.sample>=studio.result.frames.length-1) this.rewind();
      this.paint();
    };
    studio.$('#flow-rewind').onclick=()=>{this.rewind();this.sync();studio.board.draw();};
    studio.$('#flow-speed').onchange=event=>{this.speed=Number(event.target.value);};
  }

  rewind() {
    this.time=0;
    this.phases.clear();
    if(this.studio.result?.mode==='time') this.selectSample(0);
  }

  snapshot() {
    const {studio}=this;
    return CircuitModel.energyFrame(studio.model,studio.result,studio.sample)?.totals??null;
  }

  selectSample(index) {
    const {studio}=this;
    studio.sample=index;
    const cursor=studio.$('#scope-cursor');
    if(cursor) cursor.value=index;
    studio.renderFrame();
  }

  sync() {
    const {studio}=this;
    this.current=CircuitModel.energyFrame(studio.model,studio.result,studio.sample,2*Math.PI*this.time/4);
    this.wires=this.current?CircuitModel.wireCurrents(studio.model,this.current.parts):{};
    this.paint();
  }

  paint() {
    const {studio}=this;
    const now=this.current?.totals;
    for(const [key,unit] of [['source','W'],['heat','W'],['stored','J']]) {
      studio.$(`#flow-${key}`).textContent=now?circuitNumber(now[key],unit):'—';
    }
    studio.$('#flow-play').textContent=this.running?'Pausar flujo':'Reproducir flujo';
    studio.$('#flow-rewind').disabled=studio.result?.mode==='dc'||!studio.result;
    const status=studio.$('#flow-change');
    const comparison=this.previous;
    status.hidden=!comparison;
    if(comparison) {
      const after=comparison.after;
      const before=comparison.before;
      const fmtDelta=(key,unit)=>`${after[key]-before[key]>=1e-13?'+':''}${circuitNumber(after[key]-before[key],unit)}`;
      const readings=after&&before?[['Fuentes','source','W'],['Disipación','heat','W'],['Almacenada','stored','J']].map(([label,key,unit])=>
        `${label} ${circuitNumber(before[key],unit)} → ${circuitNumber(after[key],unit)} (Δ ${fmtDelta(key,unit)})`):[];
      status.textContent=readings.length?`Última edición${comparison.mode==='ac'?' (promedios del ciclo)':''} · ${readings.join(' · ')}`:
        'Última edición · se requiere una solución antes y después para calcular el cambio de energía.';
    }
  }

  tick(dt) {
    const {studio}=this;
    if(!this.running||!studio.result) return;
    this.stepClock+=dt;
    if(this.stepClock<.027) return;
    const elapsed=this.stepClock*this.speed;
    this.stepClock=0;
    this.time+=elapsed;
    this.readoutClock+=elapsed;
    const {mode,frames}=studio.result;
    if(mode==='time') {
      const next=Math.min(frames.length-1,Math.floor(this.time/7*frames.length));
      if(next!==studio.sample && this.readoutClock>=.09) {
        this.selectSample(next);
        this.readoutClock=0;
      }
      if(this.time>=7) {this.running=false;this.selectSample(frames.length-1);}
    } else if(mode==='ac') {
      this.current=CircuitModel.energyFrame(studio.model,studio.result,0,2*Math.PI*this.time/4);
      this.wires=CircuitModel.wireCurrents(studio.model,this.current.parts);
    }
    for(const [id,amps] of Object.entries(this.wires)) {
      if(Math.abs(amps)<1e-13) continue;
      const pace=28+100*Math.sqrt(Math.abs(amps)/(Math.abs(amps)+.015));
      this.phases.set(id,((this.phases.get(id)??0)+Math.sign(amps)*pace*elapsed)%56);
    }
    if(this.readoutClock>=.09 || !this.running) {this.readoutClock=0;this.paint();}
    studio.board.draw();
  }
}
