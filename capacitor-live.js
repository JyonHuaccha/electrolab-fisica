'use strict';

const capLive = {phase:0, elapsed:0, running:false, transition:null, change:null, nextPaint:0};

function renderCapacitorControls(element) {
  element.innerHTML=heading('Capacitor de placas','Modifica el material, la geometría y la resistencia del circuito.')+
    range('A','Área de cada placa',S.A,50,1000,10,'cm²')+range('d','Separación',S.d,.5,10,.1,'mm')+
    `<div class="control"><label for="material">Material entre placas</label>${select('material',[
      ['1','Vacío · κ = 1'],['2.1','Teflón · κ = 2,1'],['4','Papel ideal · κ = 4'],['6','Vidrio ideal · κ = 6'],['custom','Personalizado']
    ],String(S.k))}</div>`+range('k','Permitividad relativa κ',S.k,1,100,.1)+range('capInsertion','Dieléctrico insertado',S.capInsertion*100,0,100,1,'%')+
    '<div class="divider"></div>'+
    `<div class="control">${num('capResistance','Resistencia del circuito (MΩ)',S.capResistance,.001,1e7,.001)}</div>`+
    range('voltage','Voltaje de la batería',S.voltage,0,100,.1,'V')+
    (S.capMode==='Q'?`<div class="control">${num('capCharge','Carga fija por placa (nC)',Number(S.capCharge.toPrecision(10)),0,20000,.1)}</div>`:'')+
    '<p class="note">En tiempo real puedes comparar cuánto tarda la descarga al cambiar R. Usa el ritmo ajustado para observar transitorios muy rápidos o muy lentos.</p>';
  const setMaterial=()=>{$('#material').value=['1','2.1','4','6'].includes(String(S.k))?String(S.k):'custom';};
  setMaterial();
  for(const key of ['A','d','k']) onRange(key,value=>changeCapacitor(()=>{S[key]=value;setMaterial();},{describe:true}));
  onRange('capInsertion',value=>changeCapacitor(()=>{S.capInsertion=value/100;},{describe:true}));
  $('#material').onchange=event=>{
    if(event.target.value==='custom') return;
    changeCapacitor(()=>{S.k=Number(event.target.value);setRangeValue('k',S.k);},{describe:true});
  };
  onRange('voltage',value=>{
    if(S.capMode==='V') changeCapacitor(()=>{S.voltage=value;},{describe:true});
    else S.voltage=value;
  });
  $('#capResistance').oninput=event=>{
    const input=event.target;
    if(input.checkValidity() && input.value!=='') changeCapacitor(()=>{S.capResistance=Number(input.value);});
  };
  if(S.capMode==='Q') $('#capCharge').oninput=event=>{
    const input=event.target;
    if(input.checkValidity() && input.value!=='') changeCapacitor(()=>{S.capCharge=Number(input.value);},{setCharge:true,describe:true});
  };
}

function capacitorSetup() {
  const C = P.capacitor(S.A*1e-4,S.d*1e-3,S.k,0,S.capInsertion).C;
  return {C, R:S.capMode==='Q' ? Infinity : S.capResistance*1e6,
    source:S.capMode==='V' ? S.voltage : 0};
}

function capacitorLiveValue(time=capLive.elapsed) {
  const setup = capLive.transition ?? {...capacitorSetup(), q0:0};
  return P.capacitorTransient(setup.C,setup.R,setup.source,setup.q0,time);
}

function startCapacitor(q0=0, run=true) {
  capLive.transition = {...capacitorSetup(),q0};
  capLive.elapsed = 0;
  capLive.phase = 0;
  capLive.nextPaint = 0;
  const start = capacitorLiveValue();
  capLive.running = run && Math.abs(start.I)>0 && S.capMode!=='Q';
}

function changeCapacitor(edit,{rebuild=false, setCharge=false, describe=false}={}) {
  if(S.demonstrating) {edit();if(rebuild) renderControls();update();return;}
  const before = capacitorLiveValue();
  edit();
  const q = setCharge ? S.capCharge*1e-9 : before.Q;
  S.capCharge = q*1e9;
  startCapacitor(q);
  const after = capacitorLiveValue();
  capLive.change = null;
  if(describe) {
    const C = capLive.transition.C;
    const final = S.capMode==='Q' ? after.U : .5*C*capLive.transition.source**2;
    capLive.change = {before:before.U,after:after.U,final};
  }
  if(rebuild) renderControls();
  update();
}

function setCapacitorMode(mode) {
  if(S.capMode===mode) return;
  changeCapacitor(()=>{S.capMode=mode;},{rebuild:true});
}

function renderCapacitorLive() {
  const panel = $('#energy-panel');
  const switcher = $('#cap-switcher');
  switcher.hidden=false;
  if(!switcher.childElementCount) {
    switcher.innerHTML=`<button id="cap-connect" data-cap-mode="V">Conectar batería</button><button id="cap-use" data-cap-mode="R">Descargar por R</button><button id="cap-isolate" data-cap-mode="Q">Aislar placas</button>`;
    switcher.querySelectorAll('[data-cap-mode]').forEach(button=>button.onclick=()=>setCapacitorMode(button.dataset.capMode));
  }
  switcher.querySelectorAll('[data-cap-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.capMode===S.capMode)));
  panel.hidden = false;
  if(panel.dataset.content!=='capacitor') {
    panel.dataset.content='capacitor';
    panel.innerHTML=`<div class="energy-head"><div><h3>Carga y descarga en vivo</h3><p id="cap-status" role="status"></p></div></div>
      <div class="cap-live-grid"><div class="energy-meters">
        <div><span><i class="energy-dot stored"></i> Energía en el campo</span><strong id="cap-stored"></strong><meter id="cap-stored-bar" min="0" max="1" value="0" aria-label="Fracción de energía almacenada"></meter></div>
        <div><span><i class="energy-dot heat"></i> Calor en R</span><strong id="cap-heat"></strong><meter id="cap-heat-bar" min="0" max="1" value="0" aria-label="Fracción convertida en calor"></meter></div>
        <div><span><i class="energy-dot source"></i> Energía neta de batería</span><strong id="cap-source"></strong></div>
        <div><span title="Positiva al entrar en la placa positiva">Corriente del circuito</span><strong id="cap-current"></strong></div>
      </div><div class="energy-chart"><canvas id="cap-time-plot" aria-label="Energía en el capacitor y calor acumulado en la resistencia a lo largo del tiempo"></canvas><label for="cap-timeline"><span>Tiempo del tramo</span><output id="cap-elapsed"></output></label><input id="cap-timeline" type="range" min="0" max="8" step="0.01" value="0" aria-label="Tiempo del tramo en múltiplos de tau"></div></div>
      <div class="energy-actions cap-playback"><button id="cap-play">Pausar</button><button id="cap-replay">Repetir tramo</button><button id="cap-empty">Vaciar capacitor</button><label for="cap-clock">Reloj <select id="cap-clock"><option value="auto">Ajustado a τ</option><option value="real">Tiempo real</option></select></label><label for="cap-speed">Ritmo <select id="cap-speed"><option value="0.5">0,5×</option><option value="1">1×</option><option value="2">2×</option></select></label></div>
      <p id="cap-change" class="energy-change" hidden></p>`;
    $('#cap-play').onclick=()=>{
      if(capLive.running) capLive.running=false;
      else if(capLive.elapsed>=8*capacitorLiveValue().tau) startCapacitor(capLive.transition.q0);
      else capLive.running=true;
      paintCapacitorLive();
    };
    $('#cap-replay').onclick=()=>{startCapacitor(capLive.transition.q0);paintCapacitorLive();};
    $('#cap-empty').onclick=()=>{
      S.capMode='Q';S.capCharge=0;capLive.change=null;startCapacitor(0,false);renderControls();update();
    };
    $('#cap-speed').value=S.capSpeed;
    $('#cap-speed').onchange=event=>{S.capSpeed=Number(event.target.value);};
    $('#cap-clock').value=S.capClock;
    $('#cap-clock').onchange=event=>{S.capClock=event.target.value;};
    $('#cap-timeline').oninput=event=>{
      capLive.running=false;
      capLive.elapsed=Number(event.target.value)*capacitorLiveValue().tau;
      capLive.nextPaint=0;
      paintCapacitorLive();
    };
  }
  const change = $('#cap-change');
  change.hidden=!capLive.change;
  if(capLive.change) {
    const {before,after,final}=capLive.change;
    change.textContent=`Antes: ${capEnergy(before)} · Justo después: ${capEnergy(after)} · Al estabilizarse: ${capEnergy(final)}`;
  }
  paintCapacitorLive();
}

function capEnergy(value) {return `${fmt(value*1e9)} nJ`;}

function paintCapacitorLive() {
  if(!$('#cap-play')) return;
  const r = capacitorLiveValue();
  const {C,q0,source} = capLive.transition;
  const initial = .5*q0**2/C;
  const final = .5*C*source**2;
  const maxEnergy = Math.max(initial, final, r.heat, 1e-30);
  const isolated = S.capMode==='Q';
  const hasCurrent = !isolated && Math.abs(source-q0/C)>1e-12;
  const atEnd = capLive.elapsed>=8*r.tau;
  const status = isolated ? 'Aislado · la carga se conserva.' : !hasCurrent || atEnd ?
    (S.capMode==='V' ? 'Conectado · en equilibrio, la corriente tiende a cero.' : 'Descarga completada · corriente prácticamente nula.') :
    (r.I>0 ? 'Cargando · el campo entre placas gana energía.' : 'Descargando · la resistencia transforma energía en calor.');
  if($('#cap-status').textContent!==status) setText('cap-status',status);
  setText('cap-stored',capEnergy(r.U));setText('cap-heat',capEnergy(r.heat));setText('cap-source',capEnergy(r.supplied));
  setText('cap-current',`${fmt(r.I*1e9)} nA`);
  $('#cap-stored-bar').value=r.U/maxEnergy;$('#cap-heat-bar').value=r.heat/maxEnergy;
  $('#cap-play').disabled=!hasCurrent;$('#cap-replay').disabled=!hasCurrent;
  $('#cap-timeline').disabled=!hasCurrent;
  if(hasCurrent) $('#cap-timeline').value=capLive.elapsed/r.tau;
  else $('#cap-timeline').value=0;
  setText('cap-play',capLive.running?'Pausar':atEnd?'Reproducir':'Continuar');
  setText('cap-elapsed',isolated?'Circuito abierto':`${fmt(capLive.elapsed)} s · τ = ${fmt(r.tau)} s`);
  setText('cap-metric-charge',fmt(r.Q*1e9));setText('cap-metric-energy',fmt(r.U*1e9));
  setText('cap-metric-field',fmt(r.V/S.d));setText('cap-metric-voltage',`Entre placas: ${fmt(r.V)} V`);
  drawCapacitorTimePlot(r);
  dirty=true;
}

function drawCapacitorTimePlot(current) {
  const plot = $('#cap-time-plot');
  const width = plot.clientWidth, height = plot.clientHeight;
  if(!width || !height) return;
  const dpr = Math.min(2,devicePixelRatio||1);
  if(plot.width!==Math.round(width*dpr)||plot.height!==Math.round(height*dpr)) {
    plot.width=Math.round(width*dpr);plot.height=Math.round(height*dpr);
  }
  const g = plot.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,width,height);
  const open = S.capMode==='Q';
  const data=Array.from({length:65},(_,i)=>open?current:capacitorLiveValue(8*current.tau*i/64));
  const max=Math.max(...data.map(p=>Math.max(p.U,p.heat)),1e-30);
  g.font='10px Segoe UI';
  const labels=[0,.5,1].map(fraction=>[max*fraction,capEnergy(max>1e-29?max*fraction:0)]);
  const left=Math.ceil(Math.max(...labels.map(([,label])=>g.measureText(label).width)))+8;
  const right=width-12,top=12,bottom=height-21;
  if(right<=left) return;
  const x=i=>left+(right-left)*i/64,y=v=>bottom-(bottom-top)*v/max;
  g.fillStyle='#afc7e7';g.textAlign='right';
  for(const [v,label] of labels) {
    g.strokeStyle='#2e4667';g.beginPath();g.moveTo(left,y(v));g.lineTo(right,y(v));g.stroke();
    g.fillText(label,left-5,y(v)+3);
  }
  for(const [key,color] of [['U','#74f2dc'],['heat','#ffb27d']]) {
    g.beginPath();data.forEach((p,i)=>i?g.lineTo(x(i),y(p[key])):g.moveTo(x(i),y(p[key])));
    g.strokeStyle=color;g.lineWidth=1.8;g.stroke();
    const marker=x(open?0:Math.min(64,8*capLive.elapsed/current.tau));
    g.beginPath();g.arc(marker,y(current[key]),3.5,0,2*Math.PI);g.fillStyle=color;g.fill();
  }
  g.fillStyle='#afc7e7';g.textAlign='left';g.fillText('0',left,bottom+14);
  g.textAlign='right';g.fillText(open?'Aislado':'8τ',right,bottom+14);
}

function tickCapacitor(dt) {
  if(!capLive.running) return;
  const r=capacitorLiveValue();
  const secondsPerSecond=S.capClock==='real'?1:r.tau;
  capLive.elapsed=Math.min(8*r.tau,capLive.elapsed+dt*secondsPerSecond*S.capSpeed);
  const initial=Math.abs((capLive.transition.source-capLive.transition.q0/capLive.transition.C)/capLive.transition.R);
  capLive.phase+=Math.sign(r.I)*dt*(.22+1.1*Math.sqrt(Math.abs(r.I)/initial));
  if(capLive.elapsed>=8*r.tau) capLive.running=false;
  if(!capLive.running || capLive.elapsed>=capLive.nextPaint) {
    capLive.nextPaint=capLive.elapsed+.075*r.tau;paintCapacitorLive();
  }
  dirty=true;
}

function capacitorTimelineRows() {
  const {tau}=capacitorLiveValue();
  const sample=Number.isFinite(tau)?Array.from({length:129},(_,i)=>8*tau*i/128):[0];
  return sample.map(t=>({t_s:t,...capacitorLiveValue(t)}));
}

function drawCapacitorConnection(half,sep,state) {
  const x=-half-.66;
  const leads=[[[-half,sep,0],[x,sep,0],[x,.19,0]],[[x,-.19,0],[x,-sep,0],[-half,-sep,0]]];
  const wired=S.capMode!=='Q';
  for(const lead of leads) line(lead,'#6485ae',2);
  if(!wired) {
    line([[x,-.19,0],[x-.20,.13,0]],'#b6c8e2',2);
    ball([x,.19,0],3,'#b6c8e2');
    label([x-.22,-.25,0],'Abierto','#b6c8e2',10);
    return;
  }
  const r0=Math.abs((capLive.transition.source-capLive.transition.q0/capLive.transition.C)/capLive.transition.R);
  const strength=r0>0?Math.min(1,Math.abs(state.I)/r0):0;
  if(S.capMode==='V') {
    line([[x-.16,.09,0],[x+.16,.09,0]],'#f9d17f',2.5);
    line([[x-.09,-.09,0],[x+.09,-.09,0]],'#f9d17f',2.5);
    line([[x,.19,0],[x,.09,0]],'#6485ae',2);
    line([[x,-.09,0],[x,-.19,0]],'#6485ae',2);
    const resistor=Array.from({length:9},(_,i)=>[x+.12+.043*i,sep+(i===0||i===8?0:i%2?.06:-.06),0]);
    line(resistor,'#ffb27d',2+2*strength);
    label([x+.23,sep+.14,0],'R','#ffba94',10);
    label([x-.12,-.32,0],'Fuente','#f9d17f',10);
  } else {
    const resistor=Array.from({length:9},(_,i)=>[x+(i===0||i===8?0:i%2?.09:-.09),.19-i*.0475,0]);
    ctx.save();ctx.shadowColor='#ff905d';ctx.shadowBlur=25*strength;
    line(resistor,'#ffb27d',2+3*strength);ctx.restore();
    label([x-.09,-.34,0],'R','#ffba94',12);
  }
  if(strength<.001) return;
  ctx.save();ctx.globalAlpha=.19+.81*Math.sqrt(strength);
  for(const [index,lead] of leads.entries()) {
    const lengths=lead.slice(1).map((point,i)=>P.norm(P.sub(point,lead[i])));
    for(const offset of [0,.42]) {
      let distance=((index*.2+offset-capLive.phase)%1+1)%1*(lengths[0]+lengths[1]);
      const segment=distance<lengths[0]?0:1;
      if(segment) distance-=lengths[0];
      const a=lead[segment],b=lead[segment+1];
      ball(P.add(a,P.mul(P.sub(b,a),distance/lengths[segment])),2+2*strength,'#ffeab0');
    }
  }
  ctx.restore();
}
