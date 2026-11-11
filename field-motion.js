'use strict';

let fieldPhase=0, fieldMotion=true, nextFieldPaint=0;
const fieldMeasurements=new Map();

function showFieldEnergy(kind,value,context) {
  if(S.demonstrating) return;
  const panel=$('#energy-panel');
  panel.hidden=false;
  if(panel.dataset.content!==kind) {
    panel.dataset.content=kind;
    const particle=kind==='electric'||kind==='lorentz';
    panel.innerHTML=`<div class="energy-head"><div><h3>${kind==='electric'?'Energía de la partícula de prueba':kind==='lorentz'?'Trabajo sobre la partícula':'Energía del campo magnético'}</h3><p id="field-energy-summary"></p></div>
      ${kind==='lorentz'?'':'<div class="energy-actions"><button id="field-motion">Pausar trazadores</button></div>'}</div>
      <div class="field-energy-stats"></div><p id="field-energy-change" class="energy-change" hidden></p>`;
    if(particle) panel.querySelector('.field-energy-stats').innerHTML=kind==='electric'?
      '<div><span>Cinética K</span><strong id="field-kinetic"></strong></div><div><span>Potencial U de la partícula</span><strong id="field-potential"></strong></div><div><span>Total K + U</span><strong id="field-total"></strong></div>':
      '<div><span>Cinética K</span><strong id="field-kinetic"></strong></div><div><span>Trabajo eléctrico ΔK</span><strong id="field-work"></strong></div><div><span>Trabajo magnético</span><strong>0 µJ</strong></div>';
    const button=$('#field-motion');
    if(button) button.onclick=()=>{fieldMotion=!fieldMotion;setText('field-motion',fieldMotion?'Pausar trazadores':'Activar trazadores');dirty=true;};
  }
  const button=$('#field-motion');
  if(button) button.textContent=fieldMotion?'Pausar trazadores':'Activar trazadores';
  if(kind==='lorentz') setText('field-energy-summary','El campo eléctrico puede cambiar la rapidez. El campo magnético cambia la dirección del movimiento.');
  else {
    const old=fieldMeasurements.get(kind);
    const sameProbe=old?.context===context;
    const change=sameProbe && old.value!==value ? {before:old.value,after:value}:sameProbe?old.change:null;
    fieldMeasurements.set(kind,{value,context,change});
    const units=kind==='electric'?'nJ':'µJ/m³';
    const reading=(x)=>x===null?'—':`${fmt(x)} ${units}`;
    const uniform=kind==='magnetic'&&S.magMode!=='field';
    const description=kind==='electric'?'Energía potencial de la carga de prueba si se coloca en P':uniform?'Densidad de energía del campo uniforme':'Densidad de energía magnética en P';
    const tracer=uniform&&S.magMode!=='flux'?'Los puntos siguen la corriente.':'Los trazadores indican el sentido del campo.';
    setText('field-energy-summary',`${description} · ${reading(value)}. ${tracer}`);
    const delta=$('#field-energy-change');
    delta.hidden=!change||change.before===null||change.after===null;
    if(!delta.hidden) delta.textContent=`Antes ${reading(change.before)} · Ahora ${reading(change.after)} · Δ ${reading(change.after-change.before)}`;
  }
  updateFieldEnergy();
}

function updateFieldEnergy() {
  const kinetic=$('#field-kinetic');
  if(!kinetic || $('#energy-panel').hidden) return;
  if(S.unit===1) {
    const position=S.particle?.p??S.launchPosition;
    const speed=S.particle?.v??S.launchVelocity;
    const V=P.electric(S.charges,position).V;
    const K=.5*S.launchMass*P.dot(speed,speed);
    const U=V===null?null:S.launchCharge*V;
    kinetic.textContent=`${fmt(K)} nJ`;
    setText('field-potential',U===null?'—':`${fmt(U)} nJ`);
    setText('field-total',U===null?'—':`${fmt(K+U)} nJ`);
  } else if(S.unit===4&&S.magMode==='particle') {
    const initial=[S.vx,S.vy,S.vz],v=S.particle?.v??initial;
    const K=.5*S.mass*P.dot(v,v);
    const difference=K-.5*S.mass*P.dot(initial,initial);
    kinetic.textContent=`${fmt(K)} µJ`;
    setText('field-work',`${fmt(Math.abs(difference)<1e-12?0:difference)} µJ`);
  }
}

function tickFieldMotion(dt) {
  if(!fieldMotion || (S.unit!==1&&S.unit!==4)) return;
  if(!sceneLines.length && !(S.unit===4&&Object.hasOwn(magneticLabTitles,S.magMode))) return;
  fieldPhase+=dt;
  if(fieldPhase>=nextFieldPaint) {nextFieldPaint=fieldPhase+1/32;dirty=true;}
}

function fieldTracer(points,offset,color,reverse=false) {
  if(points.length<2) return;
  const progress=((fieldPhase*.42+offset)%1+1)%1;
  const i=(reverse?1-progress:progress)*(points.length-1);
  const lo=Math.floor(i),hi=Math.min(lo+1,points.length-1);
  const a=points[lo],b=points[hi];
  const p=P.add(a,P.mul(P.sub(b,a),i-lo));
  const [x,y]=project(p);
  ctx.beginPath();ctx.arc(x,y,4.3,0,2*Math.PI);ctx.fillStyle=color+'50';ctx.fill();
  ctx.beginPath();ctx.arc(x,y,2,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
}
