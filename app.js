'use strict';
const P=Physics,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const S={unit:1,mode3d:true,yaw:-.4,pitch:.38,zoom:1,charges:[{q:1e-9,p:[-1,0,0]},{q:-1e-9,p:[1,0,0]}],lines:true,surfaces:false,arrows:true,level:6,probe:[0,1,0],A:200,d:2,k:1,voltage:12,capMode:'V',topology:'series',R:[100,200,300],supply:12,rcR:10000,rcC:100,rcTime:1,discharge:false,magMode:'field',source:'dipole',current:5,moment:10,particleQ:1,mass:1,B:1,E:0,vx:1,vy:0,vz:.35,run:false,t:0,trail:[],particle:null,stopReason:''};
let sceneLines=[],triangles=[],lastRows=[],lastResult={},dirty=true,frameTime=0,visualRevision=0;
Object.assign(S,{launchPosition:[-2,1,0],launchVelocity:[1,0,0],launchCharge:1,launchMass:1,
  heatmap:false,lineDensity:28,capCharge:1.062502538,capGraph:'C',capResistance:10000,capSpeed:1,capClock:'auto',capInsertion:1,magPosition:[0,0,0],magBx:0,magBy:0,magEx:0,magEz:0,timeScale:1});
let circuitStudio;
let immersiveScene=null;
const canvas=$('#scene'),ctx=canvas.getContext('2d');
function fmt(x,d=3){if(x===null||!Number.isFinite(x))return 'Indefinido';if(x===0)return '0';return Math.abs(x)<.001||Math.abs(x)>=1e5?x.toExponential(2):Number(x.toPrecision(d)).toLocaleString('es',{maximumFractionDigits:6});}
const metric=(name,value,unit,sub='')=>`<div class="metric"><label>${name}</label><strong>${value} <span style="font-size:11px;font-weight:400">${unit}</span></strong><small>${sub}</small></div>`;
const range=editableRange;
const num=(id,label,value,min,max,step=1)=>`<div><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${Number.isInteger(step)?step:'any'}" required></div>`;
function setText(id,text){$('#'+id).textContent=text;}
function select(id,options,value){return `<select id="${id}">${options.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select>`;}
function heading(t,sub){return `<h2>${t}</h2><p class="sub">${sub}</p>`;}
function bindRange(id,key=id,after){onRange(id,value=>{S[key]=value;if(after)after(value);else update();});}
function bindNum(id,callback){const el=$('#'+id);el.addEventListener('input',()=>{if(!el.checkValidity()||el.value==='')return;callback(Number(el.value));update();});}
function cameraReset(){S.yaw=-.4;S.pitch=.38;S.zoom=1;dirty=true;}
function stopParticle(){S.run=false;S.particle=null;S.trail=[];S.t=0;S.stopReason='';const b=$('#play');if(b){b.textContent='▶ Iniciar';if(S.unit===1||S.unit===4)b.onclick=play;}}
function renderControls(){
  const el=$('#controls');
  if(S.unit===1){el.innerHTML=heading('Distribución de cargas','Ajusta hasta diez cargas y coloca el punto de medición en el espacio.')+`<div class="buttons"><button id="dipole">Dipolo</button><button id="single">Carga única</button><button id="same">Dos positivas</button></div><div id="charges"></div><button id="addcharge" class="secondary" style="width:100%">+ Añadir carga</button><div class="divider"></div><label class="check"><input type="checkbox" id="lines" ${S.lines?'checked':''}> Líneas de campo</label><label class="check"><input type="checkbox" id="arrows" ${S.arrows?'checked':''}> Vectores del campo</label><label class="check"><input type="checkbox" id="surfaces" ${S.surfaces?'checked':''}> Superficies equipotenciales ±V</label><label class="check"><input type="checkbox" id="heatmap" ${S.heatmap?'checked':''}> Mapa de potencial en el plano XY</label>`+range('level','Nivel equipotencial',S.level,2,25,1,'V')+range('lineDensity','Líneas por fuente',S.lineDensity,6,32,1)+`<div class="divider"></div><h2>Punto de medición</h2><div class="control-row">${S.probe.map((v,i)=>num('probe'+i,['x (m)','y (m)','z (m)'][i],v,-5,5,.1)).join('')}</div>`+renderElectricLaunch()+`<div class="buttons"><button id="play" class="on">▶ Lanzar partícula</button><button id="cleartrail">Limpiar trayectoria</button></div><p class="note">Las fuentes permanecen fijas. El cálculo se detiene a 7,5 cm de una carga.</p>`;
    chargeEditor();
    $('#addcharge').onclick=()=>{
      if(S.charges.length>=10) return;
      const occupied=[S.probe,...S.charges.map(charge=>charge.p)];
      const spots=[.7,-.7,1.4,-1.4,2.1,-2.1,2.8,-2.8,0].flatMap(x=>[1,-1,2].map(y=>[x,y,0]));
      const position=spots.find(point=>occupied.every(other=>P.norm(P.sub(point,other))>=.25));
      S.charges.push({q:1e-9,p:position});stopParticle();chargeEditor();update();
    };
    for(const [id,charges] of Object.entries({dipole:[{q:1e-9,p:[-1,0,0]},{q:-1e-9,p:[1,0,0]}],single:[{q:1e-9,p:[0,0,0]}],same:[{q:1e-9,p:[-1,0,0]},{q:1e-9,p:[1,0,0]}]}))$('#'+id).onclick=()=>{S.charges=charges.map(c=>({q:c.q,p:[...c.p]}));stopParticle();chargeEditor();update();};
    for(const key of ['lines','arrows','surfaces','heatmap'])$('#'+key).onchange=e=>{S[key]=e.target.checked;if(key==='heatmap'&&S.heatmap)setView(false);update();};
    bindRange('level');bindRange('lineDensity','lineDensity',value=>{S.lineDensity=Math.round(value);update();});
    S.probe.forEach((_,i)=>bindNum('probe'+i,v=>S.probe[i]=v));
    bindVector('electric-p',S.launchPosition);bindVector('electric-v',S.launchVelocity);
    bindNum('electric-q',value=>{S.launchCharge=value;stopParticle();});
    bindNum('electric-m',value=>{S.launchMass=value;stopParticle();});
    $('#play').onclick=play;$('#cleartrail').onclick=()=>{stopParticle();update();};
  }else if(S.unit===2){
    if(!S.demonstrating){renderCapacitorControls(el);return;}
    el.innerHTML=heading('Capacitor de placas','Cambia la geometría y observa la respuesta del sistema.')+range('A','Área de cada placa',S.A,50,1000,10,'cm²')+range('d','Separación',S.d,.5,10,.1,'mm')+`<div class="control"><label for="material">Material</label>${select('material',[['1','Vacío · κ = 1'],['2.1','Teflón · κ = 2,1'],['4','Papel ideal · κ = 4'],['6','Vidrio ideal · κ = 6'],['custom','Personalizado']],String(S.k))}</div>`+range('k','Permitividad relativa κ',S.k,1,100,.1)+`<div class="control"><label for="capMode">Condición del experimento</label>${select('capMode',[['V','Batería conectada · V constante'],['Q','Aislado · Q constante']],S.capMode)}</div>`+(S.capMode==='Q'&&!S.demonstrating?`<div class="control">${num('capCharge','Carga fija en cada placa (nC)',S.capCharge,0,20000,.1)}</div>`:range('voltage','Voltaje de la fuente',S.voltage,0,100,.1,'V'))+`<p class="note">La placa aislada conserva la carga que ingreses. La gráfica varía la distancia y conserva los demás parámetros.</p>`;
    const chargeMode=S.capMode==='Q'&&!S.demonstrating;
    if(chargeMode) bindNum('capCharge',value=>S.capCharge=value);
    else bindRange('voltage');
    for(const k of ['A','d','k'])bindRange(k,k,()=>{if(k==='k')$('#material').value=['1','2.1','4','6'].includes(String(S.k))?String(S.k):'custom';update();});
    $('#material').value=['1','2.1','4','6'].includes(String(S.k))?String(S.k):'custom';
    $('#material').onchange=e=>{if(e.target.value!=='custom'){S.k=Number(e.target.value);setRangeValue('k',S.k);update();}};
    $('#capMode').onchange=e=>{
      const next=e.target.value;
      if(next==='Q' && S.capMode==='V') S.capCharge=capacitorResult().Q*1e9;
      S.capMode=next;renderControls();update();
    };
  }else if(S.unit===3){
    el.innerHTML=heading('Constructor de circuitos','Elige una conexión y ajusta cada resistencia. Fuentes y cables ideales.')+`<div class="control"><label for="topology">Conexión</label>${select('topology',[['series','Resistencias en serie'],['parallel','Resistencias en paralelo'],['mixed','Mixto · R₁ + (R₂ ∥ R₃ …)'],['rc','Circuito R C con fuente']],S.topology)}</div>`+range('supply','Fuente de voltaje',S.supply,0,24,.5,'V')+(S.topology==='rc'?range('rcR','Resistencia',S.rcR,1000,50000,1000,'Ω')+range('rcC','Capacitancia',S.rcC,10,1000,10,'μF')+range('rcTime','Tiempo transcurrido',S.rcTime,0,10,.01,'s')+`<label class="check"><input id="discharge" type="checkbox" ${S.discharge?'checked':''}> Descargar desde V inicial</label><div class="buttons"><button id="play">▶ Iniciar</button><button id="rcrestart">↺ Tiempo cero</button></div><p class="note">Carga desde Vc(0) = 0. Descarga desde Vc(0) = V inicial, con la batería desconectada. τ = RC.</p>`:`<div id="resistors">${S.R.map((r,i)=>range('R'+i,'Resistencia R'+(i+1),r,10,1000,10,'Ω')).join('')}</div><div class="buttons"><button id="addR">+ Resistencia</button><button id="removeR">− Resistencia</button></div><div id="branchresults"></div><p class="note">Entre 2 y 6 resistencias. En mixto, R₁ está en serie con el paralelo de las restantes. Los resultados de cada componente se muestran en la tabla.</p>`);
    $('#topology').onchange=e=>{S.topology=e.target.value;stopParticle();renderControls();update();};bindRange('supply');
    if(S.topology==='rc'){for(const k of ['rcR','rcC','rcTime'])bindRange(k);$('#discharge').onchange=e=>{S.discharge=e.target.checked;update();};$('#play').onclick=()=>{S.run=!S.run;$('#play').textContent=S.run?'Ⅱ Pausar':'▶ Iniciar';};$('#rcrestart').onclick=()=>{S.rcTime=0;updateRcControl();update();};}
    else {S.R.forEach((_,i)=>onRange('R'+i,value=>{S.R[i]=value;update();}));$('#addR').onclick=()=>{if(S.R.length<6){S.R.push(100);renderControls();update();}};$('#removeR').onclick=()=>{if(S.R.length>2){S.R.pop();renderControls();update();}};}
  }else{
    const experiments = [['field','Campo de imán o corriente'],['particle','Trayectoria en campos E y B'],...Object.entries(magneticLabTitles)];
    el.innerHTML = heading('Fuerza y campo magnético','Unidad 4 · Capítulo 27 de Sears y Zemansky') +
      `<div class="control"><label for="magMode">Experimento</label>${select('magMode',experiments,S.magMode)}</div>`;
    $('#magMode').onchange=e=>{S.magMode=e.target.value;stopParticle();renderControls();update();};
    if (Object.hasOwn(magneticLabTitles,S.magMode)) {
      renderMagneticLab(S.magMode);
      return;
    }
    const experimentControls = S.magMode==='field'
      ? `<div class="control"><label for="source">Fuente de campo</label>${select('source',[['dipole','Imán · aproximación dipolar'],['wire','Conductor rectilíneo largo']],S.source)}</div>`
        + range('current','Corriente del conductor',S.current,-10,10,.5,'A')
        + range('moment','Momento del imán',S.moment,-20,20,1,'A·m²')
        + `<div class="divider"></div><h2>Punto de medición</h2><div class="control-row">${S.probe.map((v,i)=>num('probe'+i,['x (m)','y (m)','z (m)'][i],v,-5,5,.1)).join('')}</div><p class="note">Imán modelado por un dipolo puntual orientado en z. Se excluye r &lt; 0,30 m. El alambre infinito se orienta en z. Se excluye un radio menor de 0,08 m.</p>`
      : `<div class="buttons"><button id="circle">Órbita circular</button><button id="helix">Hélice</button><button id="crossed">E y B cruzados</button><button id="selector">Selector v = E/B</button></div>`
        + range('particleQ','Carga de prueba',S.particleQ,-2,2,.1,'μC')
        + range('mass','Masa',S.mass,.1,5,.1,'mg')
        + range('B','Campo Bᶻ',S.B,-3,3,.1,'T')
        + range('E','Campo Eᵧ',S.E,-3,3,.1,'V/m')
        + range('vx','Velocidad inicial vx',S.vx,-3,3,.1,'m/s')
        + range('vz','Velocidad inicial vz',S.vz,-3,3,.1,'m/s')
        + renderMagneticLaunch()+range('timeScale','Ritmo de la simulación',S.timeScale,.1,3,.1,'×')
        + `<div class="buttons"><button id="play" class="on">▶ Iniciar</button><button id="restart">↺ Reiniciar</button></div><p class="note">Los campos se mantienen uniformes. Al cambiar las condiciones físicas se reinicia la trayectoria.</p>`;
    el.insertAdjacentHTML('beforeend',experimentControls);
    if(S.magMode==='field'){$('#source').onchange=e=>{S.source=e.target.value;update();};for(const k of ['current','moment'])bindRange(k);S.probe.forEach((_,i)=>bindNum('probe'+i,v=>S.probe[i]=v));}
    else {
      for(const k of ['particleQ','mass','B','E','vx','vz']) bindRange(k,k,()=>{stopParticle();update();});
      bindRange('timeScale');
      bindVector('lorentz-p',S.magPosition);
      for(const [id,key] of Object.entries({'lorentz-vy':'vy','lorentz-bx':'magBx','lorentz-by':'magBy','lorentz-ex':'magEx','lorentz-ez':'magEz'})) {
        bindNum(id,value=>{S[key]=value;stopParticle();});
      }
      $('#play').onclick=play;
      $('#restart').onclick=()=>{stopParticle();update();};
      const examples={circle:{E:0,B:1,vx:1,vz:0},helix:{E:0,B:1,vx:1,vz:.6},crossed:{E:.5,B:1,vx:1,vz:0},selector:{E:1,B:1,vx:1,vz:0}};
      for(const [id,values] of Object.entries(examples)) $('#'+id).onclick=()=>{
        Object.assign(S,values,{particleQ:1,mass:1,vy:0,magBx:0,magBy:0,magEx:0,magEz:0,magPosition:[0,0,0]});
        stopParticle();renderControls();update();
      };
    }
  }
}
function chargeEditor(){
  $('#charges').innerHTML=S.charges.map((c,i)=>`<div class="charge"><div class="charge-head"><b style="color:${c.q>=0?'#c65b47':'#318bb8'}">${c.q>=0?'+':'−'} Carga ${i+1}</b><button data-remove="${i}" aria-label="Eliminar carga ${i+1}" ${S.charges.length===1?'disabled':''}>×</button></div><div class="control-row">${num('q'+i,'q (nC)',Number((c.q*1e9).toFixed(2)),-10,10,.1)}${c.p.map((v,j)=>num('c'+i+'p'+j,['x','y','z'][j],v,-3,3,.1)).join('')}</div></div>`).join('');
  S.charges.forEach((c,i)=>{bindNum('q'+i,v=>{c.q=v*1e-9;stopParticle();});c.p.forEach((_,j)=>bindNum('c'+i+'p'+j,v=>{c.p[j]=v;stopParticle();}));});
  $$('[data-remove]').forEach(b=>b.onclick=()=>{if(S.charges.length>1){S.charges.splice(Number(b.dataset.remove),1);stopParticle();chargeEditor();update();}});$('#addcharge').disabled=S.charges.length>=10;
}
function update(){
  if(S.unit===3 && !S.demonstrating) return;
  sceneLines=[];triangles=[];dirty=true;lastRows=[];
  visualRevision++;
  $('#energy-panel').hidden=true;
  $('#cap-switcher').hidden=true;
  $('.experiment').dataset.unit=S.unit;
  if(S.unit!==2 && !(S.unit===4 && S.magMode==='particle')) auxiliaryValues([]);
  const magneticTitle = magneticLabTitles[S.magMode] ?? (S.magMode==='field'?'Líneas de campo magnético':'Trayectoria bajo la fuerza de Lorentz');
  const titles={1:'Cargas, campo y potencial',2:'Capacitor de placas paralelas',3:S.topology==='rc'?'Carga y descarga de un capacitor':'Circuito con resistencias',4:magneticTitle};
  setText('scene-title',titles[S.unit]);
  $('.view-buttons').style.visibility=S.unit===3?'hidden':'visible';
  updateSceneHint();
  if(S.unit===1){
    const f=p=>P.electric(S.charges,p).E;
    if(S.lines){const sources=S.charges.filter(c=>c.q>0),use=sources.length?sources:S.charges.filter(c=>c.q<0);for(const c of use)for(let i=0;i<S.lineDensity;i++){const z=1-2*(i+.5)/S.lineDensity,a=i*2.39996323,r=Math.sqrt(1-z*z),seed=P.add(c.p,P.mul([r*Math.cos(a),r*Math.sin(a),z],.11));sceneLines.push({points:P.trace(seed,f,c.q>=0?1:-1),color:'#85bde6b0',arrows:true,reverse:c.q<0});}}
    if(S.surfaces)for(const level of [-S.level,S.level])triangles.push(...P.isosurface(S.charges,level).map(t=>({points:t,color:level>0?'#e8887360':'#72bae860'})));
    const r=P.electric(S.charges,S.probe);lastResult={point_m:S.probe,E_V_m:r.E,potential_V:r.V,charges:S.charges};lastRows=S.charges.map((c,i)=>({carga:i+1,q_C:c.q,x_m:c.p[0],y_m:c.p[1],z_m:c.p[2],sonda_x_m:S.probe[0],sonda_y_m:S.probe[1],sonda_z_m:S.probe[2],potencial_sonda_V:r.V,Ex_sonda_N_C:r.E?.[0],Ey_sonda_N_C:r.E?.[1],Ez_sonda_N_C:r.E?.[2]}));
    $('#metrics').innerHTML=metric('POTENCIAL EN P',fmt(r.V),'V','Referencia V = 0 en el infinito')+metric('CAMPO EN P',fmt(r.E?P.norm(r.E):null),'N/C','1 N/C = 1 V/m')+metric('CARGAS ACTIVAS',S.charges.length,'/ 10','q en nC; posición en m')+metric('TIEMPO SIMULADO',fmt(S.t),'s',S.stopReason||'Punto P marcado en amarillo');
    if(r.E) auxiliaryValues(r.E.map((value,i)=>[['Eₓ','Eᵧ','E_z'][i],`${fmt(value)} N/C`]));
    showFieldEnergy('electric',r.V===null?null:S.launchCharge*r.V,`${S.probe.join(',')}:${S.launchCharge}`);
    setText('observation',r.singular?'P está dentro de la zona excluida de una carga. Mueve el punto para calcular E y V.':'El campo es vectorial y el potencial es escalar. En el centro de un dipolo, el potencial puede ser cero aunque el campo no lo sea. Las flechas muestran la dirección que seguiría una carga positiva.');
    theory('Superposición de campos eléctricos','Cada carga aporta un campo y un potencial. El simulador suma los campos por componentes y los potenciales con su signo. Las superficies ±V se calculan en tres dimensiones. La zona cercana a cada carga se excluye para evitar la singularidad del modelo puntual.','E⃗ = k Σ qᵢ r⃗ᵢ / rᵢ³','Campo eléctrico','V = k Σ qᵢ / rᵢ','Potencial eléctrico');
    $('#legend').innerHTML='<span style="color:#ec927d">● Carga +</span><span style="color:#80c8ef">● Carga −</span><br><span style="color:#8bc7b6">→ Campo E</span><span style="color:#edce7e">● Punto P</span>';
  }else if(S.unit===2){
    const r=capacitorResult(),V=r.V;lastResult={...r,mode:S.capMode,A_m2:S.A*1e-4,d_m:S.d*1e-3,k:S.k,insertion:S.capInsertion,V};lastRows=[lastResult];
    const live=!S.demonstrating;
    const liveValue=(id,value)=>live?`<span class="cap-metric-value" id="cap-metric-${id}">${fmt(value)}</span>`:fmt(value);
    $('#metrics').innerHTML=metric('CAPACITANCIA',fmt(r.C*1e12),'pF','Inserción '+fmt(S.capInsertion*100)+' %')+metric('CARGA EN CADA PLACA',liveValue('charge',r.Q*1e9),'nC','Magnitud de ±Q')+metric('ENERGÍA ALMACENADA',liveValue('energy',r.U*1e9),'nJ','U = ½ C V²')+metric('CAMPO ENTRE PLACAS',liveValue('field',r.E/1000),'kV/m',live?'<span id="cap-metric-voltage"></span>':'Voltaje real: '+fmt(V)+' V');
    if(live) renderCapacitorLive();
    renderCapacitorGraph();
    setText('observation',S.capMode==='R'?'Durante la descarga disminuyen la carga, el voltaje y el campo. La energía que pierde el campo reaparece como calor acumulado en la resistencia.':S.capMode==='V'?'La corriente fluye hasta que el voltaje del capacitor se acerca al de la fuente. Al insertar un dieléctrico aumenta la capacitancia y la batería redistribuye carga.':'Al aislar las placas, la carga se mantiene. Al aumentar κ crece C y bajan el voltaje, el campo y la energía U = Q²/(2C).');
    theory('Geometría, material y energía','El dieléctrico cubre la fracción x del área entre placas y llena la separación. Un cambio de geometría o material se modela como instantáneo y puede intercambiar energía con quien lo realiza. Después comienza un tramo RC con la nueva capacitancia. La separación está ampliada en el dibujo.','C = (ε₀A/d)[1 + (κ−1)x]','Capacitancia con inserción x','U = ½ C V²','Energía');$('#legend').innerHTML='Placa positiva <span style="color:#ec927d">●</span> Placa negativa <span style="color:#80c8ef">●</span><br>Turquesa · campo E · Ámbar · corriente';
  }else if(S.unit===3){
    if(S.topology==='rc'){
      const r=P.rc(S.rcR,S.rcC*1e-6,S.supply,S.rcTime,S.discharge);lastResult={...r,t:S.rcTime};lastRows=Array.from({length:101},(_,i)=>({t_s:i*5*r.tau/100,...P.rc(S.rcR,S.rcC*1e-6,S.supply,i*5*r.tau/100,S.discharge)}));
      $('#metrics').innerHTML=metric('VOLTAJE DEL CAPACITOR',fmt(r.V),'V')+metric('CORRIENTE',fmt(r.I*1000),'mA','Signo respecto al sentido de carga')+metric('CONSTANTE DE TIEMPO',fmt(r.tau),'s','τ = RC')+metric('ENERGÍA',fmt(r.U*1000),'mJ','t = '+fmt(S.rcTime)+' s');
      setText('observation',S.discharge?'Durante la descarga, el capacitor entrega energía a la resistencia. Al cabo de τ, Vc conserva aproximadamente el 36,8 % del valor inicial.':'Durante la carga, Vc aumenta y la corriente disminuye. En t = τ el voltaje llega al 63,2 % de la fuente; hacia 5τ supera el 99 %.');
      theory('Respuesta temporal de un circuito R C','La resistencia limita la corriente al conectar la fuente. La capacitancia fija cuánta carga se almacena por voltio. El simulador evalúa la solución exponencial exacta para una carga o descarga ideal.','V꜀ = V₀ (1 − e⁻ᵗ/ᴿᶜ)','Carga desde cero','V꜀ = V₀ e⁻ᵗ/ᴿᶜ','Descarga');
    }else{
      const r=P.network(S.R,S.supply,S.topology);lastResult=r;lastRows=r.rows;
      $('#metrics').innerHTML=metric('RESISTENCIA EQUIVALENTE',fmt(r.req),'Ω')+metric('CORRIENTE DE LA FUENTE',fmt(r.I*1000),'mA')+metric('POTENCIA ENTREGADA',fmt(r.P),'W')+metric('COMPONENTES',S.R.length,'resistencias');
      $('#branchresults').innerHTML=`<table class="results-table"><tr><th></th><th>V</th><th>mA</th><th>W</th></tr>${r.rows.map((x,i)=>`<tr><td>R${i+1}</td><td>${fmt(x.V)}</td><td>${fmt(x.I*1000)}</td><td>${fmt(x.P)}</td></tr>`).join('')}</table>`;
      setText('observation',S.topology==='series'?'En serie todas las resistencias llevan la misma corriente. La suma de sus caídas de voltaje coincide con el voltaje de la fuente.':S.topology==='parallel'?'En paralelo todas las resistencias tienen el mismo voltaje. La corriente de la fuente es la suma de las corrientes de las ramas.':'La corriente de la fuente atraviesa R₁ y luego se divide entre las ramas en paralelo. La potencia total coincide con la suma de potencias disipadas.');
      theory('Ley de Ohm y conservación de energía','Las resistencias son óhmicas y no cambian con la temperatura. Las conexiones se resuelven por reducción de resistencias equivalentes. La gráfica muestra I frente a V para la resistencia equivalente actual.','V = I R','Ley de Ohm','P = V I = I²R','Potencia disipada');
    }$('#legend').innerHTML='';
  }else if(Object.hasOwn(magneticLabTitles,S.magMode)){
    lastRows = updateMagneticLab(S.magMode);
    showFieldEnergy('magnetic',((S.magMode==='hall'?magneticLab.hallField:magneticLab.field)**2/(2*P.MU0))*1e6,S.magMode);
  }else if(S.magMode==='field'){
    const f=p=>S.source==='wire'?P.wire(p,S.current):P.dipole(p,[0,0,S.moment]);
    if(S.source==='wire'){for(const z of [-2,0,2])for(const r of [.6,1.2,2,2.8]){const points=Array.from({length:101},(_,i)=>{const a=i/100*2*Math.PI*(S.current>=0?1:-1);return [r*Math.cos(a),r*Math.sin(a),z];});if(S.current!==0)sceneLines.push({points,color:'#80c6b6',arrows:true});}}
    else if(S.moment!==0)for(let a=0;a<10;a++)for(const theta of [.25,.45,.65]){const seed=[.34*Math.sin(theta)*Math.cos(a*2*Math.PI/10),.34*Math.sin(theta)*Math.sin(a*2*Math.PI/10),.34*Math.cos(theta)];sceneLines.push({points:P.trace(seed,f,S.moment>0?1:-1,.045,500),color:'#80c6b6',arrows:true,reverse:S.moment<0});}
    const B=f(S.probe);lastResult={B_T:B,point_m:S.probe,source:S.source,current_A:S.current,moment_Am2:S.moment};lastRows=[{x_m:S.probe[0],y_m:S.probe[1],z_m:S.probe[2],Bx_T:B?.[0],By_T:B?.[1],Bz_T:B?.[2]}];
    showFieldEnergy('magnetic',B?P.dot(B,B)*1e6/(2*P.MU0):null,`field:${S.probe.join(',')}`);
    $('#metrics').innerHTML=metric('CAMPO EN P',fmt(B?P.norm(B)*1e6:null),'μT')+metric('COMPONENTE Bx',fmt(B?B[0]*1e6:null),'μT')+metric('COMPONENTE By',fmt(B?B[1]*1e6:null),'μT')+metric('COMPONENTE Bz',fmt(B?B[2]*1e6:null),'μT');
    setText('observation',!B?'P está dentro de la región excluida del modelo. Aleja el punto de medición.':S.source==='wire'?'El campo rodea el conductor. El pulgar de la mano derecha indica el sentido de la corriente y los dedos el sentido de B. Al duplicar la distancia, B se reduce a la mitad.':'El modelo dipolar describe el campo exterior lejos del imán. Al invertir el momento magnético se invierte el campo. Las líneas exteriores salen por el norte y entran por el sur.');
    theory('Campos creados por corrientes e imanes','El conductor ideal es infinito y apunta en z. El imán es una aproximación dipolar con momento magnético en z; no representa con precisión el interior ni las proximidades de una barra real. μ₀ se aproxima por 4π × 10⁻⁷ H/m.','B = μ₀ I / (2πr)','Conductor recto','B⃗ = μ₀ [3(m⃗·r̂)r̂ − m⃗] / (4πr³)','Dipolo magnético');$('#legend').innerHTML='→ Campo B · <span style="color:#edce7e">● Punto P</span><br>Orientación de fuente en el eje z';
  }else{
    updateParticleMetrics();theory('Fuerza de Lorentz y trayectoria','El campo eléctrico cambia la energía cinética. La fuerza magnética es perpendicular a la velocidad y no realiza trabajo. La trayectoria se integra con el método de Boris y un paso que limita el ángulo de giro y el desplazamiento.','F⃗ = q (E⃗ + v⃗ × B⃗)','Fuerza total','r = m v⊥ / |q|B','Radio de Larmor para E = 0');
    showFieldEnergy('lorentz');
    $('#legend').innerHTML='<span style="color:#8bdcd0">→ Campo B</span><span style="color:#b9aaff">→ Campo E</span><br><span style="color:#f5c477">● Partícula</span> · Trayectoria en metros';
  }
}
function theory(title,text,a,al,b,bl){setText('theory-title',title);setText('theory-text',text);$('#equations').innerHTML=`<div>${a}<small>${al}</small></div><div>${b}<small>${bl}</small></div>`;}
function updateParticleMetrics(){
  const initialV=[S.vx,S.vy,S.vz],v=S.particle?S.particle.v:initialV;
  const q=S.particleQ*1e-6,m=S.mass*1e-6,{E,B}=lorentzFields();
  const b=P.norm(B),omega=Math.abs(q)*b/m;
  const F=P.force(q,v,E,B),initialF=P.force(q,initialV,E,B);
  const radius=omega>0?P.norm(P.cross(initialV,B))/(b*omega):null;
  const period=omega>0?2*Math.PI/omega:null;
  const pitch=period===null?null:Math.abs(P.dot(initialV,B)/b)*period;
  const energy=.5*m*P.dot(v,v);
  $('#metrics').innerHTML=metric('RAPIDEZ',fmt(P.norm(v)),'m/s')+metric('FUERZA TOTAL',fmt(P.norm(F)*1e6),'μN')+metric('RADIO CON E = 0',fmt(radius),'m','Según v⊥ inicial')+metric('ENERGÍA CINÉTICA',fmt(energy*1e6),'μJ','t = '+fmt(S.t)+' s');
  auxiliaryValues([['|B|',`${fmt(b)} T`],['Período magnético',period===null?'—':`${fmt(period)} s`],['Paso helicoidal con E = 0',pitch===null?'—':`${fmt(pitch)} m`]]);
  let observation='El campo eléctrico puede cambiar la rapidez. El campo magnético curva la trayectoria y la fuerza total se recalcula a cada paso.';
  if(q===0) observation='Con carga nula la partícula conserva su velocidad inicial.';
  else if(P.norm(E)===0 && b>0) observation='Con E = 0, la energía cinética se conserva. La velocidad perpendicular a B produce el giro y la componente paralela produce una hélice.';
  else if(P.norm(initialF)<1e-12) observation='La fuerza inicial es cero para estos vectores. La partícula conserva su velocidad inicial en los campos uniformes.';
  setText('observation',S.stopReason||observation);
}
function play(){if(!S.particle){S.particle={p:[...(S.unit===1?S.launchPosition:S.magPosition)],v:S.unit===1?[...S.launchVelocity]:[S.vx,S.vy,S.vz]};S.trail=[{t:0,p:[...S.particle.p],v:[...S.particle.v]}];S.t=0;S.stopReason='';}S.run=!S.run;$('#play').textContent=S.run?'Ⅱ Pausar':'▶ Continuar';dirty=true;}
function updateRcControl(){setRangeValue('rcTime',S.rcTime);}
function tick(dt){
  if(!S.run)return;
  if(S.unit===3&&S.topology==='rc'){S.rcTime=Math.min(10,S.rcTime+dt);updateRcControl();if(S.rcTime>=10){S.run=false;$('#play').textContent='▶ Iniciar';}update();return;}
  if(!S.particle)return;const isElectric=S.unit===1,q=isElectric?S.launchCharge*1e-9:S.particleQ*1e-6,m=isElectric?S.launchMass*1e-9:S.mass*1e-6;
  const uniform=lorentzFields();
  const field=p=>isElectric?{E:P.electric(S.charges,p).E,B:[0,0,0]}:uniform;
  let remaining=Math.min(dt,.04)*(isElectric?1:S.timeScale);let count=0;
  while(remaining>1e-12&&count++<250){const f=field(S.particle.p);if(!f.E){endTrajectory('La partícula llegó a la zona excluida de una carga.');break;}
    const speed=P.norm(S.particle.v),omega=Math.abs(q)*P.norm(f.B)/m,acc=Math.abs(q)*P.norm(f.E)/m,h=Math.min(remaining,.005,.025/Math.max(omega,1e-9),.015/Math.max(speed,1e-9),Math.sqrt(.01/Math.max(acc,1e-9)));
    const next=P.step(S.particle,q,m,h,field);if(!next){endTrajectory('La partícula llegó a la zona excluida.');break;}S.particle=next;S.t+=h;remaining-=h;
    if(!next.p.every(Number.isFinite)||P.norm(next.p)>12){endTrajectory('La partícula salió del dominio de 12 m. Reinicia para otro lanzamiento.');break;}
  }
  S.trail.push({t:S.t,p:[...S.particle.p],v:[...S.particle.v]});if(S.trail.length>=5000)endTrajectory('Se alcanzó el límite de 5000 puntos. Exporta los datos y reinicia.');
  if(S.unit===4)updateParticleMetrics();else {const metrics=$$('#metrics .metric');if(metrics[3]){metrics[3].querySelector('strong').textContent=fmt(S.t)+' s';metrics[3].querySelector('small').textContent=S.stopReason||`Partícula de prueba ${fmt(S.launchCharge)} nC`;}}dirty=true;
  updateFieldEnergy();
}
function endTrajectory(reason){S.run=false;S.stopReason=reason;if($('#play'))$('#play').textContent='↺ Reiniciar';if($('#play'))$('#play').onclick=()=>{stopParticle();if(S.unit===1||S.unit===4)$('#play').onclick=play;play();};}
// Proyección perspectiva de geometría tridimensional real, con rotación orbital.
function project(p){if(!S.mode3d && S.unit===4 && S.magMode==='hall') p=[p[0],p[2],p[1]];const cy=Math.cos(S.yaw),sy=Math.sin(S.yaw),cp=Math.cos(S.pitch),sp=Math.sin(S.pitch);let x=p[0]*cy-p[2]*sy,z=p[0]*sy+p[2]*cy,y=p[1]*cp-z*sp;z=p[1]*sp+z*cp;const scale=Math.min(canvas.clientWidth/8.3,canvas.clientHeight/6.6)*S.zoom,pers=S.mode3d?10/Math.max(2,10+z):1;return [canvas.clientWidth/2+x*scale*pers,canvas.clientHeight/2-y*scale*pers,z];}
function line(points,color='#48665b',width=1,dash=[]){if(points.length<2)return;ctx.beginPath();points.forEach((p,i)=>{const a=project(p);if(i===0)ctx.moveTo(a[0],a[1]);else ctx.lineTo(a[0],a[1]);});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function label(p,text,color='#9ab7ac',size=10){
  const [x,y]=project(p),width=canvas.clientWidth,height=canvas.clientHeight;
  if(x < -12 || x > width+12 || y < -12 || y > height+12) return;
  ctx.fillStyle=color;ctx.font=`${size}px Segoe UI`;ctx.textAlign='left';
  const left=Math.max(5,Math.min(width-ctx.measureText(text).width-5,x+5));
  ctx.fillText(text,left,Math.max(size+3,Math.min(height-5,y-5)));
}
function arrow(a,b,color='#78baaa',width=1){const p=project(a),q=project(b),length=Math.hypot(q[0]-p[0],q[1]-p[1]);if(length<2)return;line([a,b],color,width);const ang=Math.atan2(q[1]-p[1],q[0]-p[0]),head=Math.min(8,Math.max(4,length*.36));ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(q[0]-head*Math.cos(ang-.47),q[1]-head*Math.sin(ang-.47));ctx.lineTo(q[0]-head*Math.cos(ang+.47),q[1]-head*Math.sin(ang+.47));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function ball(p,r,color,text=''){const a=project(p);const gradient=ctx.createRadialGradient(a[0]-r*.3,a[1]-r*.4,1,a[0],a[1],r);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.2,color);gradient.addColorStop(1,color);ctx.beginPath();ctx.arc(a[0],a[1],r,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill();if(text){ctx.fillStyle='#12332d';ctx.font='bold '+r+'px Segoe UI';ctx.textAlign='center';ctx.fillText(text,a[0],a[1]+r*.35);ctx.textAlign='left';}}
function poly(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.4;ctx.stroke();}}
function grid(){
  const p=(x,y)=>S.unit===2&&S.mode3d?[x,-2.3,y]:[x,y,0];
  for(let i=-4;i<=4;i++){
    const shade=i===0?'#486386':'#2c415e';
    line([p(i,-4),p(i,4)],shade);line([p(-4,i),p(4,i)],shade);
  }
  if(S.unit===2) return;
  const axes=[[[3.6,0,0],'x','#e5a895'],[[0,3,0],'y','#a5dbc8']];
  if(S.mode3d) axes.push([[0,0,3],'z','#aab8ff']);
  for(const [tip,axis,color] of axes){arrow([0,0,0],tip,color+'90');label(tip,axis+' (m)',color,11);}
}
function drawFieldLines(){
  for(const [index,l] of sceneLines.entries()) {
    line(l.points,l.color,1);
    if(l.arrows) for(let i=20;i<l.points.length;i+=55){const a=l.points[i-2],b=l.points[i];arrow(l.reverse?b:a,l.reverse?a:b,l.color);}
    if(!S.demonstrating && fieldMotion && index%2===0) fieldTracer(l.points,index*.318,S.unit===4?'#9ff5d9':'#a9dbff',l.reverse);
  }
}
function drawElectric(){
  if(!S.mode3d&&(S.surfaces||S.heatmap)){for(let x=-3.5;x<3.5;x+=.18)for(let y=-3;y<3;y+=.18){const v=P.electric(S.charges,[x,y,0]).V;if(v===null)continue;const alpha=Math.min(.53,Math.log1p(Math.abs(v))*.11);poly([[x,y,0],[x+.18,y,0],[x+.18,y+.18,0],[x,y+.18,0]],v>0?`rgba(255,132,111,${alpha})`:`rgba(98,152,255,${alpha})`);}}
  triangles.sort((a,b)=>project(b.points[0])[2]-project(a.points[0])[2]);for(const t of triangles)poly(t.points,t.color,t.color.slice(0,7)+'35');drawFieldLines();
  if(S.arrows)for(let x=-3;x<=3;x++)for(let y=-2;y<=2;y++){const p=[x,y,0],E=P.electric(S.charges,p).E;if(!E||P.norm(E)<1e-12)continue;arrow(p,P.add(p,P.mul(E,.27/P.norm(E))),'#88c0ad99');}
  for(const c of [...S.charges].sort((a,b)=>project(b.p)[2]-project(a.p)[2])){
    const color=c.q>0?'#ff9e86':c.q<0?'#8fbdff':'#c2ccdc';
    const [x,y]=project(c.p),radius=Math.min(18,11+Math.sqrt(Math.abs(c.q*1e9)));
    ctx.beginPath();ctx.arc(x,y,radius+5,0,2*Math.PI);ctx.strokeStyle=color+'54';ctx.lineWidth=1;ctx.stroke();
    ball(c.p,radius,color,c.q>0?'+':c.q<0?'−':'0');label(P.add(c.p,[.18,.18,0]),fmt(c.q*1e9)+' nC','#dae7ff',11);
  }
  ball(S.probe,5,'#edce7e');label(S.probe,'P','#edce7e');
  const probe=P.electric(S.charges,S.probe);
  if(S.arrows && probe.E) magneticVector(S.probe,probe.E,.68,'#f1d68f','E');
}
function drawCapacitor(){
  const half=Math.min(2.35,1.5*Math.sqrt(S.A/200)),sep=.38+S.d*.115;
  const state=S.demonstrating?capacitorResult():capacitorLiveValue();
  const {V,Q}=state;
  const field=Math.min(1,Math.sqrt(Math.abs(V/S.d)/6));
  const charge=Math.min(1,Math.sqrt(Math.abs(Q)/1.0625e-9));
  const corners=(y,scale=1)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[x*half*scale,y,z*half*scale]);
  function plate(y,color,sign) {
    const face=corners(y),edge=corners(y-.085);
    poly([face[2],face[3],edge[3],edge[2]],color+'9a',color);
    poly([face[1],face[2],edge[2],edge[1]],color+'76',color);
    poly(face,color+'70',color);
    line([...face,face[0]],color,1.5);
    ctx.save();ctx.globalAlpha=charge;
    const positions=[0,-.64,.64,-.33,.33];
    for(const x of positions.slice(0,Math.ceil(charge*positions.length))) {
      for(const z of S.mode3d?[-.62,0,.62]:[0]) label([x*half,y,z*half],sign,color,14);
    }
    ctx.restore();
  }
  if(!S.demonstrating) drawCapacitorConnection(half,sep,state);
  plate(-sep,'#8cc9ff','−');
  if(S.k>1){
    const insertion=S.demonstrating?1:S.capInsertion;
    const shift=point=>[point[0]-2*half*(1-insertion),point[1],point[2]];
    const lower=corners(-sep*.75,.91).map(shift),upper=corners(sep*.75,.91).map(shift);
    poly([lower[2],lower[3],upper[3],upper[2]],'#a486ff33','#b9a7f2');
    poly([lower[1],lower[2],upper[2],upper[1]],'#a486ff20','#b9a7f2');
    poly(upper,'#ae91ff20','#b9a7f2');
    label([-half*.68-2*half*(1-insertion),0,half*.92],`κ = ${fmt(S.k)} · ${fmt(insertion*100)} %`,'#dacfff',13);
  }
  ctx.save();ctx.globalAlpha=field;
  const upper=corners(sep*.81,.95),lower=corners(-sep*.81,.95);
  poly([upper[2],upper[3],lower[3],lower[2]],'#59f5dd21');
  poly([upper[1],upper[2],lower[2],lower[1]],'#59f5dd15');
  for(const x of [-.65,0,.65]) for(const z of S.mode3d?[-.65,0,.65]:[0]) arrow([x*half,sep*.83,z*half],[x*half,-sep*.83,z*half],'#8ae8e2',1.45);
  ctx.restore();
  plate(sep,'#ffb489','+');
  const ruler=half+.28;
  line([[ruler,-sep,0],[ruler,sep,0]],'#d5dfff',1,[4,3]);
  for(const y of [-sep,sep]) line([[ruler-.09,y,0],[ruler+.09,y,0]],'#d5dfff',1.3);
  label([ruler,0,0],`${fmt(S.d)} mm`,'#d5dfff',12);
  label([-half,-sep-.31,half],`A = ${fmt(S.A)} cm²`,'#bacfed',12);
  label([-half,sep+.25,-half],`${fmt(V)} V`,'#ffccab',13);
}
function drawMagnetic(){if(Object.hasOwn(magneticLabTitles,S.magMode)){drawMagneticLab(S.magMode);return;}if(S.magMode==='field'){drawFieldLines();if(S.source==='wire'){line([[0,0,-3],[0,0,3]],'#edbc6c',5);if(S.current!==0)arrow([0,0,0],[0,0,2*Math.sign(S.current)],'#ffe0a0',3);label([0,0,3],fmt(S.current)+' A','#edbc6c',12);}else{line([[0,0,-.30],[0,0,0]],S.moment>=0?'#80c8ef':'#ec927d',18);line([[0,0,0],[0,0,.30]],S.moment>=0?'#ec927d':'#80c8ef',18);label([0,0,.4],S.moment>=0?'N':'S','#e8bda6',12);label([0,0,-.4],S.moment>=0?'S':'N','#a5cfdf',12);}ball(S.probe,5,'#edce7e');label(S.probe,'P','#edce7e');}
  else {const {E,B}=lorentzFields();for(const x of [-2,0,2])for(const y of [-2,0,2])magneticVector([x,y,0],B,.72,'#8bdcd08e','');for(const x of [-2.65,2.65])magneticVector([x,-.95,0],E,1.55,'#b9aaffc0','E');if(!S.particle)ball(S.magPosition,7,'#f5c477');}}
function drawTrail(){if(S.trail.length>1){line(S.trail.map(x=>x.p),'#f5c477',2);ball(S.particle.p,7,'#f5c477');const v=S.particle.v;if(P.norm(v)>0)arrow(S.particle.p,P.add(S.particle.p,P.mul(v,.55/P.norm(v))),'#fff0ae',1.5);}}
function drawCircuit(){const w=canvas.clientWidth,h=canvas.clientHeight,s=Math.min(w/720,h/400),ox=(w-720*s)/2,oy=(h-400*s)/2;ctx.save();ctx.translate(ox,oy);ctx.scale(s,s);
  const text=(x,y,t,color='#b4d4c5',size=12)=>{ctx.fillStyle=color;ctx.font=size+'px Segoe UI';ctx.fillText(t,x,y);};
  const path=pts=>{ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle='#7ab3a1';ctx.lineWidth=2;ctx.stroke();};
  const resistor=(x,y,i,horizontal=true,value=S.R[i])=>{ctx.save();ctx.translate(x,y);if(!horizontal)ctx.rotate(Math.PI/2);ctx.fillStyle='#203e36';ctx.strokeStyle='#8dbaa7';ctx.lineWidth=2;ctx.fillRect(-22,-10,44,20);ctx.strokeRect(-22,-10,44,20);ctx.restore();text(x-22,y-20,'R'+(i+1)+' · '+value+' Ω','#d1e5d9',10);};
  const source=()=>{path([[80,100],[80,170]]);path([[80,230],[80,300]]);ctx.strokeStyle='#ecbe77';ctx.beginPath();ctx.arc(80,200,30,0,Math.PI*2);ctx.stroke();text(74,195,'+','#ecbe77',18);text(75,218,'−','#ecbe77',18);text(20,255,S.supply+' V','#ecbe77',13);};
  source();
  if(S.topology==='rc'){
    path([[80,100],[210,100]]);resistor(232,100,0,true,S.rcR);path([[254,100],[480,100],[480,180]]);path([[480,220],[480,300],[80,300]]);path([[453,180],[507,180]]);path([[453,220],[507,220]]);text(520,205,S.rcC+' μF','#d1e5d9');text(520,228,'C','#d1e5d9');if(S.discharge){ctx.fillStyle='#112c2c';ctx.fillRect(115,90,45,20);path([[116,100],[155,80]]);text(105,70,'Fuente desconectada','#ecbe77',10);path([[165,100],[165,300]]);}
    const tau=S.rcR*S.rcC*1e-6;chart(300,335,350,50,Array.from({length:80},(_,i)=>[i/79,P.rc(S.rcR,S.rcC*1e-6,1,i/79*5*tau,S.discharge).V]),'t / 5τ','Vc / V₀',S.rcTime/(5*tau));
  }else{
    const n=S.R.length;if(S.topology==='series'){path([[80,100],[620,100],[620,300],[80,300]]);S.R.forEach((_,i)=>resistor(180+i*380/Math.max(n-1,1),100,i));}
    else if(S.topology==='parallel'){path([[80,100],[620,100]]);path([[80,300],[620,300]]);S.R.forEach((_,i)=>{const x=190+i*390/(n-1);path([[x,100],[x,300]]);resistor(x,200,i,false);});}
    else {path([[80,100],[620,100]]);resistor(175,100,0);path([[80,300],[620,300]]);S.R.slice(1).forEach((_,i)=>{const x=310+i*290/Math.max(n-2,1);path([[x,100],[x,300]]);resistor(x,200,i+1,false);});}
    const r=P.network(S.R,S.supply,S.topology);chart(270,335,370,50,[[0,0],[1,1]],'V (0–24)','I (0–'+fmt(24/r.req*1000)+' mA)',S.supply/24);
  }ctx.restore();
}
function chart(x,y,w,h,points,xlabel,ylabel,marker){ctx.strokeStyle='#5b7a6e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.strokeStyle='#edbc6c';ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(x+a*w,y-b*h):ctx.moveTo(x+a*w,y-b*h));ctx.stroke();ctx.fillStyle='#b6cebe';ctx.font='10px Segoe UI';ctx.fillText(xlabel,x+w-70,y+18);ctx.fillText(ylabel,x-20,y-h-8);if(marker>=0&&marker<=1){const yy=S.topology==='rc'?P.rc(S.rcR,S.rcC*1e-6,1,marker*5*S.rcR*S.rcC*1e-6,S.discharge).V:marker;ctx.fillStyle='#f4d385';ctx.beginPath();ctx.arc(x+marker*w,y-yy*h,4,0,2*Math.PI);ctx.fill();}}
function draw(){if(immersiveScene&&!S.demonstrating){dirty=false;return;}const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(!w||!h){dirty=false;return;}if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const bg=ctx.createRadialGradient(w*.51,h*.48,10,w*.51,h*.48,Math.max(w,h)*.67);bg.addColorStop(0,'#203b64');bg.addColorStop(.54,'#152641');bg.addColorStop(1,'#0a1327');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  if(S.unit===3)drawCircuit();else {if(S.unit!==4 || S.magMode!=='hall')grid();if(S.unit===1)drawElectric();if(S.unit===2)drawCapacitor();if(S.unit===4)drawMagnetic();drawTrail();}dirty=false;
}
function syncStudio(){
  const open=S.unit===3&&!S.demonstrating;
  $('#circuit-studio').hidden=!open;
  $('.workspace').hidden=open;
  $('.theory').hidden=open;
  if(open && !circuitStudio) circuitStudio=new CircuitStudio($('#circuit-studio'));
  return open;
}
function switchUnit(unit){
  stopParticle();S.unit=unit;cameraReset();setView(S.mode3d);
  if(unit===2&&!S.demonstrating&&!capLive.transition) startCapacitor(0,!reducedLabMotion);
  if(unit===2&&S.mode3d) S.pitch=.57;
  $$('[data-unit]').forEach(b=>b.setAttribute('aria-selected',String(Number(b.dataset.unit)===unit)));
  if(!syncStudio()){renderControls();update();}
  if(!S.demonstrating) {
    history.replaceState(null,'',`#unidad-${unit}`);
    syncExperience();
    window.scrollTo({top:0,behavior:'instant'});
  }
}
$$('[data-unit]').forEach(b=>b.onclick=()=>switchUnit(Number(b.dataset.unit)));
$('#view3d').onclick=()=>setView(true);$('#view2d').onclick=()=>setView(false);$('#resetview').onclick=()=>{cameraReset();if(!S.mode3d){S.yaw=0;S.pitch=0;}immersiveScene?.resetView(S.mode3d,S.unit===2?'capacitor':S.magMode);dirty=true;};
function updateSceneHint() {
  setText('tag',S.unit===3?'CIRCUITO IDEAL':S.mode3d?'ESPACIO TRIDIMENSIONAL':'PROYECCIÓN 2D');
  if (S.unit === 3) {
    setText('hint','Voltajes en V · Corrientes en A · Resistencias en Ω');
    return;
  }
  const hall = S.unit === 4 && S.magMode === 'hall';
  const plane = hall ? 'xz' : 'xy';
  const view = S.mode3d ? 'Arrastra para girar' : `Proyección sobre ${plane}`;
  const scale = hall ? 'Placa esquemática' : S.unit===2 ? 'Geometría esquemática' : 'Ejes en metros';
  setText('hint',`${view} · Rueda para acercar · ${scale}`);
}
function setView(is3d){S.mode3d=is3d;S.yaw=is3d?-.4:0;S.pitch=is3d?.38:0;for(const [id,on] of [['view3d',is3d],['view2d',!is3d]]){$('#'+id).classList.toggle('active',on);$('#'+id).setAttribute('aria-pressed',String(on));}updateSceneHint();dirty=true;}
let drag=null;canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('pointermove',e=>{if(drag&&S.mode3d){S.yaw+=(e.clientX-drag[0])*.008;S.pitch=Math.max(-1.4,Math.min(1.4,S.pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];dirty=true;}});canvas.addEventListener('wheel',e=>{e.preventDefault();S.zoom=Math.max(.35,Math.min(3,S.zoom*Math.exp(-e.deltaY*.001)));dirty=true;},{passive:false});window.addEventListener('resize',()=>dirty=true);
$('#export').onclick=()=>{if(S.unit===3&&!S.demonstrating){circuitStudio.exportData();return;}let rows=S.unit===2&&!S.demonstrating?capacitorTimelineRows():lastRows;if(S.trail.length)rows=S.trail.map(x=>({t_s:x.t,x_m:x.p[0],y_m:x.p[1],z_m:x.p[2],vx_m_s:x.v[0],vy_m_s:x.v[1],vz_m_s:x.v[2]}));if(!rows.length)return;const keys=Object.keys(rows[0]),csv='\uFEFF'+keys.join(';')+'\n'+rows.map(r=>keys.map(k=>typeof r[k]==='object'?JSON.stringify(r[k]):r[k]??'').join(';')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fisica_unidad_'+S.unit+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function animate(now){
  const dt=frameTime?Math.min((now-frameTime)/1000,.05):0;frameTime=now;
  if(!S.demonstrating){
    tick(dt);
    if(S.unit===2) tickCapacitor(dt);
    if(S.unit===3) circuitStudio?.flow.tick(dt);
    tickFieldMotion(dt);
    if(immersiveScene && S.unit!==3) immersiveScene.frame(dt);
    if(S.unit===3) circuitStudio?.physicalScene?.frame(dt);
    tickExperience(dt);
  }
  if(dirty)draw();requestAnimationFrame(animate);
}
const openMagnetism = location.hash === '#unidad-4';
if (openMagnetism) S.magMode = 'flux';
const reducedLabMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
fieldMotion=!reducedLabMotion;
try {
  immersiveScene=new LabScene3D($('#webgl-host'),()=>({
    state:S,lines:sceneLines,triangles,physics:P,format:fmt,revision:visualRevision,
    magnetic:magneticLab,magneticResult:Object.hasOwn(magneticLabTitles,S.magMode)?magneticLabResult(S.magMode):null,
    capacitor:S.unit===2?capacitorLiveValue():null,capRunning:capLive.running,motion:fieldMotion
  }));
  canvas.hidden=true;
  document.body.classList.add('has-webgl');
} catch(error) {
  console.warn('La escena usa la visualización Canvas disponible.',error);
  $('#webgl-host').hidden=true;
  $('#render-status').textContent='Visualización Canvas';
}
const openingUnit=Number(location.hash.match(/^#unidad-([1-4])$/)?.[1]??1);
switchUnit(openingUnit);
requestAnimationFrame(animate);
// Interfaz pública utilizada por la demostración grabable incluida en el proyecto.
window.labDemo={apply(config){canvas.hidden=false;$('#webgl-host').hidden=true;stopParticle();Object.assign(S,config);S.demonstrating=true;cameraReset();syncStudio();renderControls();update();if(config.launch)play();},frame(dt,yaw){tick(dt);if(S.unit!==3)S.yaw=yaw;draw();},snapshot(){return {unit:S.unit,t:S.t,caption:$('#scene-title').textContent,metrics:[...document.querySelectorAll('.metric')].map(x=>({label:x.querySelector('label').textContent,value:x.querySelector('strong').textContent})),observation:$('#observation').textContent};}};
