'use strict';

const experience={selected:{1:'dipole',2:'charge',3:'mixed',4:'field'},clock:0,readout:0,motor:false,omega:0,inertia:.15,damping:.25};
const labScenarios={
  1:[['dipole','Dipolo eléctrico'],['quadrupole','Cuatro cargas'],['potential','Superficies de potencial'],['trajectory','Partícula en el campo']],
  2:[['charge','Carga desde cero'],['discharge','Descarga por resistencia'],['dielectric','Inserción del dieléctrico'],['isolated','Capacitor aislado']],
  3:[['mixed','Red mixta editable'],['parallel','Ramas en paralelo'],['rc','Transitorio RC'],['rlc','Filtro RLC'],['blank','Construcción libre']],
  4:[['field','Imán y líneas de campo'],['wire','Campo de una corriente'],['particle','Trayectoria de Lorentz'],['flux','Flujo a través de una superficie'],['loop','Espira y motor'],['hall','Efecto Hall'],['conductor','Fuerza sobre un conductor']]
};

function syncExperience() {
  const titles={1:['UNIDAD 1 · ELECTROSTÁTICA','Cargas que transforman el espacio.'],2:['UNIDAD 2 · CAPACITANCIA','La energía, entre dos placas.'],3:['UNIDAD 3 · CIRCUITOS','Construye. Conecta. Experimenta.'],4:['UNIDAD 4 · MAGNETISMO','Campos que ponen todo en movimiento.']};
  setText('unit-caption',titles[S.unit][0]);setText('unit-heading',titles[S.unit][1]);
  const container=$('#rail-experiments');
  container.innerHTML='<p>EXPLORAR</p>'+labScenarios[S.unit].map(([id,label])=>`<button data-scenario="${id}" class="${experience.selected[S.unit]===id?'active':''}">${label}</button>`).join('');
  container.querySelectorAll('button').forEach(button=>button.onclick=()=>applyScenario(button.dataset.scenario));
  const mobile=$('#mobile-scenario');
  mobile.innerHTML=labScenarios[S.unit].map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  mobile.value=experience.selected[S.unit];mobile.onchange=event=>applyScenario(event.target.value);
  $('#camera-orbit').disabled=!immersiveScene;
  $('#capture-scene').disabled=!immersiveScene&&S.unit!==3;
  const descriptions={1:'Los trazadores siguen la dirección de E. Edita las fuentes para alterar el campo.',2:'Carga en las placas · energía en el campo · calor en la resistencia.',3:'Cada cable y componente participa en el análisis del circuito.',4:'Vectores, corriente y trayectoria responden a las condiciones del experimento.'};
  setText('live-description',descriptions[S.unit]);
}

function applyScenario(id) {
  experience.selected[S.unit]=id;
  experience.motor=false;experience.omega=0;stopParticle();
  if(S.unit===1) {
    const dipole=[{q:1e-9,p:[-1,0,0]},{q:-1e-9,p:[1,0,0]}];
    S.charges=id==='quadrupole'?[{q:2e-9,p:[-1,1,0]},{q:-2e-9,p:[1,1,0]},{q:-2e-9,p:[-1,-1,0]},{q:2e-9,p:[1,-1,0]}]:dipole;
    Object.assign(S,{lines:true,arrows:true,lineDensity:28,surfaces:id==='potential',heatmap:id==='potential',level:6});
    if(id==='trajectory') Object.assign(S,{launchPosition:[-2,1,0],launchVelocity:[.1,0,0],launchCharge:1,launchMass:1});
    renderControls();update();if(id==='trajectory') play();
  } else if(S.unit===2) {
    Object.assign(S,{A:200,d:2,k:id==='dielectric'?6:1,capInsertion:id==='dielectric'?.5:1,voltage:12,capMode:id==='charge'||id==='dielectric'?'V':id==='discharge'?'R':'Q'});
    const C=capacitorSetup().C;
    const q0=id==='charge'?0:C*S.voltage;
    S.capCharge=q0*1e9;capLive.change=null;startCapacitor(q0,true);
    renderControls();update();
  } else if(S.unit===3) {
    circuitStudio.replace(circuitExample(id));circuitStudio.board.fit();
    if(circuitStudio.physicalScene) circuitStudio.physicalScene.resetView();
  } else {
    S.magMode=id==='wire'?'field':id;
    if(id==='wire') S.source='wire';
    if(id==='field') S.source='dipole';
    if(id==='particle') Object.assign(S,{vx:1.25,vy:0,vz:.45,E:0,B:1,particleQ:1,mass:1,magPosition:[0,0,0],magBx:0,magBy:0,magEx:0,magEz:0});
    if(id==='loop') {magneticLab.angle.loop=90;magneticLab.commutator=true;experience.motor=true;}
    renderControls();update();if(id==='particle') play();
  }
  syncExperience();
}

function tickExperience(dt) {
  if(S.demonstrating) return;
  if(S.unit===4&&S.magMode==='loop'&&experience.motor) {
    const maximum=magneticLab.turns*magneticLab.current*magneticLab.area*magneticLab.field;
    const torque=angle=>-maximum*(magneticLab.commutator?Math.abs(Math.sin(angle)):Math.sin(angle));
    const next=P.rotorStep(magneticLab.angle.loop*Math.PI/180,experience.omega,experience.inertia,experience.damping,dt,torque,Math.abs(maximum));
    experience.omega=next.omega;
    magneticLab.angle.loop=((next.angle*180/Math.PI)%360+360)%360;
    experience.clock+=dt;
    if(experience.clock>.1) {
      experience.clock=0;updateMagneticLab('loop');
      setRangeValue('lab-angle',magneticLab.angle.loop);
      const caption=$('#motor-speed');if(caption) caption.textContent=`${fmt(experience.omega)} rad/s · K = ${fmt(.5*experience.inertia*experience.omega**2)} J`;
    }
  }
  experience.readout+=dt;
  if(experience.readout<.12) return;
  experience.readout=0;
  if(S.unit===2) {
    const value=capacitorLiveValue();
    setText('scene-quantity',`U = ${fmt(value.U*1e9)} nJ`);
    setText('live-clock',S.capMode==='Q'?'Q constante':`t = ${fmt(capLive.elapsed)} s`);
  } else if(S.particle) {
    setText('scene-quantity',`|v| = ${fmt(P.norm(S.particle.v))} m/s`);setText('live-clock',`t = ${fmt(S.t)} s`);
  } else {
    setText('scene-quantity',S.unit===1?`${S.charges.length} fuentes`:S.magMode==='loop'?`ω = ${fmt(experience.omega)} rad/s`:'');
    setText('live-clock',S.unit===4?'B en teslas · F en newtons':'E y V en unidades SI');
  }
}

function renderMotorControls() {
  $('#controls').insertAdjacentHTML('beforeend',`<div class="divider"></div><h2>Movimiento de la espira</h2>
    <div class="buttons"><button id="motor-play" class="on">${experience.motor?'Pausar motor':'Poner en movimiento'}</button><button id="motor-reset">Detener giro</button></div>
    <div class="control-row">${num('motor-inertia','Inercia (kg·m²)',experience.inertia,.001,100,.001)}${num('motor-damping','Rozamiento (N·m·s)',experience.damping,0,10,.01)}</div>
    <p id="motor-speed" class="note">${fmt(experience.omega)} rad/s</p><p class="note">El giro responde a J·dω/dt = τ − bω. El conmutador permite mantener el sentido de la torsión. Ajustar el ángulo detiene el giro.</p>`);
  $('#motor-play').onclick=()=>{experience.motor=!experience.motor;$('#motor-play').textContent=experience.motor?'Pausar motor':'Poner en movimiento';};
  $('#motor-reset').onclick=()=>{experience.motor=false;experience.omega=0;$('#motor-play').textContent='Poner en movimiento';$('#motor-speed').textContent='0 rad/s';};
  bindNum('motor-inertia',value=>{experience.inertia=value;});
  bindNum('motor-damping',value=>{experience.damping=value;});
}

document.getElementById('camera-orbit').onclick=()=>{
  if(!immersiveScene) return;
  immersiveScene.controls.autoRotate=!immersiveScene.controls.autoRotate;
  $('#camera-orbit').setAttribute('aria-pressed',String(immersiveScene.controls.autoRotate));
};
document.getElementById('scene-expand').onclick=()=>{
  const on=document.body.classList.toggle('focus-stage');
  $('#scene-expand').setAttribute('aria-pressed',String(on));
  $('#scene-expand').textContent=on?'Restaurar':'Ampliar';immersiveScene?.resize();dirty=true;
};
document.getElementById('capture-scene').onclick=()=>{
  const source=S.unit===3?(circuitStudio?.physicalScene?.active?circuitStudio.physicalScene.canvas:circuitStudio.board.canvas):immersiveScene?.canvas??canvas;
  if(!source) return;
  const a=document.createElement('a');a.href=source.toDataURL('image/png');a.download=`Electrolab-unidad-${S.unit}.png`;a.click();
};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('focus-stage')) $('#scene-expand').click();
});
