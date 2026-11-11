'use strict';

function editableRange(id,caption,value,min,max,step,unit='') {
  const numericStep=['lineDensity','lab-turns'].includes(id)?1:'any';
  return `<div class="control"><div class="value-line"><label for="${id}">${caption}</label>
    <input id="${id}-number" type="number" aria-label="${caption} exacto" min="${min}" max="${max}" step="${numericStep}" value="${value}" required>
    <span class="value-unit">${unit}</span></div><output id="${id}-out" class="range-visual-output" aria-hidden="true">${value} ${unit}</output>
    <input id="${id}" type="range" data-unit="${unit}" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${caption}"></div>`;
}

function setRangeValue(id,value,updateNumber=true) {
  const slider=$('#'+id),number=$('#'+id+'-number'),output=$('#'+id+'-out');
  if(slider) slider.value=value;
  if(number&&updateNumber) number.value=Number(value.toPrecision(11));
  if(output) output.textContent=`${fmt(value)} ${slider.dataset.unit??''}`.trim();
}

function onRange(id,handler) {
  const slider=$('#'+id),number=$('#'+id+'-number');
  slider.addEventListener('input',()=>{
    const value=Number(slider.value);
    setRangeValue(id,value);
    handler(value);
  });
  number.addEventListener('input',()=>{
    if(!number.checkValidity()||number.value==='') return;
    const value=Number(number.value);
    setRangeValue(id,value,false);
    handler(value);
  });
}

function vectorInputs(prefix,caption,values,min,max) {
  return `<p>${caption}</p><div class="control-row">${values.map((value,i)=>num(prefix+i,['x','y','z'][i],value,min,max,.01)).join('')}</div>`;
}

function renderElectricLaunch() {
  return `<details class="advanced-control"><summary>Condiciones de lanzamiento</summary>
    ${vectorInputs('electric-p','Posición inicial (m)',S.launchPosition,-6,6)}
    ${vectorInputs('electric-v','Velocidad inicial (m/s)',S.launchVelocity,-20,20)}
    <p>Partícula de prueba</p><div class="control-row">${num('electric-q','Carga (nC)',S.launchCharge,-50,50,.01)}
    ${num('electric-m','Masa (µg)',S.launchMass,.01,1000,.01)}</div></details>`;
}

function bindVector(prefix,vector) {
  vector.forEach((_,i)=>bindNum(prefix+i,value=>{vector[i]=value;stopParticle();}));
}

function renderMagneticLaunch() {
  return `<details class="advanced-control"><summary>Vectores y posición inicial</summary>
    ${vectorInputs('lorentz-p','Posición inicial (m)',S.magPosition,-6,6)}
    <p>Componente adicional de velocidad</p>${num('lorentz-vy','vᵧ (m/s)',S.vy,-3,3,.01)}
    <p>Componentes adicionales de B (T)</p><div class="control-row">${num('lorentz-bx','Bₓ',S.magBx,-3,3,.01)}${num('lorentz-by','Bᵧ',S.magBy,-3,3,.01)}</div>
    <p>Componentes adicionales de E (V/m)</p><div class="control-row">${num('lorentz-ex','Eₓ',S.magEx,-3,3,.01)}${num('lorentz-ez','E_z',S.magEz,-3,3,.01)}</div></details>`;
}

function lorentzFields() {return {E:[S.magEx,S.E,S.magEz],B:[S.magBx,S.magBy,S.B]};}

function capacitorResult(distance=S.d) {
  const area=S.A*1e-4,spacing=distance*1e-3;
  const C=P.capacitor(area,spacing,S.k,1,S.capInsertion).C;
  const fixedCharge=S.demonstrating?P.capacitor(.02,.002,1,S.voltage).Q:capacitorLiveValue().Q;
  const V=S.capMode==='V'?S.voltage:fixedCharge/C;
  return {...P.capacitor(area,spacing,S.k,V,S.capInsertion),V};
}

function auxiliaryValues(entries) {
  const region=$('#aux-readout');
  region.hidden=!entries.length;
  region.dataset.content='values';
  region.innerHTML=entries.length?`<div class="aux-values">${entries.map(([caption,value])=>`<span>${caption} <strong>${value}</strong></span>`).join('')}</div>`:'';
}

function renderCapacitorGraph() {
  const region=$('#aux-readout');
  region.hidden=false;
  if(region.dataset.content!=='capacitor') {
    region.dataset.content='capacitor';
    region.innerHTML='<div class="cap-plot"><h3>Respuesta al variar la separación</h3><select id="cap-plot-magnitude" aria-label="Magnitud de la gráfica"><option value="C">Capacitancia</option><option value="E">Campo eléctrico</option><option value="U">Energía</option><option value="V">Voltaje</option></select><canvas id="cap-plot-canvas" aria-label="Respuesta del capacitor según la separación entre placas"></canvas></div>';
    $('#cap-plot-magnitude').value=S.capGraph;
    $('#cap-plot-magnitude').onchange=event=>{S.capGraph=event.target.value;drawCapacitorGraph();};
  }
  drawCapacitorGraph();
}

function drawCapacitorGraph() {
  const chart=$('#cap-plot-canvas');
  if(!chart || !chart.clientWidth) return;
  const w=chart.clientWidth,h=chart.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
  if(chart.width!==Math.round(w*dpr)||chart.height!==Math.round(h*dpr)) {
    chart.width=Math.round(w*dpr);chart.height=Math.round(h*dpr);
  }
  const context=chart.getContext('2d');
  context.setTransform(dpr,0,0,dpr,0,0);
  context.fillStyle='#0b1426';context.fillRect(0,0,w,h);
  const {scale,unit}={C:{scale:1e12,unit:'pF'},E:{scale:.001,unit:'kV/m'},U:{scale:1e9,unit:'nJ'},V:{scale:1,unit:'V'}}[S.capGraph];
  const maxDistance=Math.max(10,S.d*1.1);
  const points=Array.from({length:91},(_,i)=>.5+(maxDistance-.5)*i/90).map(distance=>[distance,capacitorResult(distance)[S.capGraph]*scale]);
  const maximum=Math.max(1e-12,...points.map(point=>point[1]));
  const l=67,r=w-16,t=13,b=h-24;
  const x=d=>l+(d-.5)/(maxDistance-.5)*(r-l), y=v=>b-v/maximum*(b-t);
  context.font='11px Segoe UI';context.textAlign='right';context.textBaseline='middle';
  for(let i=0;i<=3;i++) {
    const v=maximum*(3-i)/3,py=y(v);
    context.strokeStyle='#243755';context.beginPath();context.moveTo(l,py);context.lineTo(r,py);context.stroke();
    context.fillStyle='#a9bdd8';context.fillText(`${fmt(v,2)} ${unit}`,l-7,py);
  }
  context.beginPath();points.forEach(([d,v],i)=>i?context.lineTo(x(d),y(v)):context.moveTo(x(d),y(v)));
  context.strokeStyle='#8addff';context.lineWidth=2;context.stroke();
  const currentX=x(S.d),currentY=y(capacitorResult()[S.capGraph]*scale);
  context.strokeStyle='#baabff';context.lineWidth=1;context.setLineDash([4,4]);context.beginPath();context.moveTo(currentX,t);context.lineTo(currentX,b);context.stroke();context.setLineDash([]);
  context.fillStyle='#e3d8ff';context.beginPath();context.arc(currentX,currentY,4,0,2*Math.PI);context.fill();
  context.fillStyle='#aec2e2';context.fillText(`${fmt(maxDistance,3)} mm`,r,b+13);
  context.textAlign='left';context.fillText('0,5 mm',l,b+13);
}
