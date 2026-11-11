'use strict';

const magneticLabTitles = {
  flux: 'Flujo magnético y ley de Gauss',
  conductor: 'Fuerza sobre un conductor',
  loop: 'Espira y motor de corriente directa',
  hall: 'Efecto Hall'
};

const magneticLab = {
  field: 1,
  angle: {flux: 0, conductor: 90, loop: 90},
  current: 2,
  area: 1,
  length: 1,
  turns: 1,
  closed: false,
  commutator: false,
  hallCurrent: 1,
  hallField: 0.5,
  thickness: 1,
  density: 10,
  carrier: 'negative'
};

const magneticColors = {field:'#83c9b6', normal:'#f0cf83', current:'#efb78b', force:'#ed937d', moment:'#9fc8ff'};

function renderMagneticLab(mode) {
  const m = magneticLab;
  const control = (id, caption, value, min, max, step, unit, change) => ({
    html: range(id, caption, value, min, max, step, unit),
    bind() {
      onRange(id,value => {
        change(value);
        if(id==='lab-angle'&&mode==='loop') {
          experience.motor=false;experience.omega=0;
          if($('#motor-play')) $('#motor-play').textContent='Poner en movimiento';
          if($('#motor-speed')) $('#motor-speed').textContent='0 rad/s';
        }
        update();
      });
    }
  });
  const controls = [];
  const field = (axis, key) => controls.push(control('lab-field', `Campo B en ${axis}`, m[key], -3, 3, .1, 'T', value => m[key] = value));
  const current = (key, caption = 'Corriente I') => controls.push(control('lab-current', caption, m[key], -10, 10, .1, 'A', value => m[key] = value));
  let extras = '';
  let note;
  if (mode === 'hall') {
    field('y', 'hallField');
    current('hallCurrent', 'Corriente convencional I en x');
    controls.push(control('lab-thickness', 'Espesor en y', m.thickness, .1, 5, .1, 'mm', value => m.thickness = value));
    extras = `<div class="control"><label for="lab-carrier">Portadores</label>${select('lab-carrier', [['negative','Electrones (−e)'],['positive','Huecos (+e)']],m.carrier)}</div>
      <div class="control">${num('lab-density','Densidad n (×10²² m⁻³)',m.density,.1,100000000,.1)}</div>`;
    note = 'La corriente circula en x y el campo atraviesa la placa en y. Se mide V(+z) − V(−z). El modelo supone un solo tipo de portador.';
  } else {
    field('z', 'field');
    const angleCaption = mode === 'conductor' ? 'Ángulo del alambre desde +z' : 'Ángulo de la normal desde +z';
    controls.push(control('lab-angle', angleCaption, m.angle[mode], 0, mode === 'loop' ? 360 : 180, 1, '°', value => m.angle[mode] = value));
    if (mode === 'conductor') {
      current('current');
      controls.push(control('lab-length','Longitud en el campo',m.length,.1,4,.1,'m',value => m.length = value));
      note = 'El ángulo orienta el tramo de alambre. Cambia el signo de I o de B para invertir la fuerza.';
    } else {
      controls.push(control('lab-area',mode === 'flux' ? 'Área de una cara' : 'Área por vuelta',m.area,.1,4,.1,'m²',value => m.area = value));
      if (mode === 'flux') {
        extras = `<label class="check"><input id="lab-closed" type="checkbox" ${m.closed?'checked':''}> Medir en un cubo cerrado</label>`;
        note = 'La normal indica el sentido positivo del flujo. A 90°, el campo es paralelo al plano.';
      } else {
        current('current');
        controls.push(control('lab-turns','Número de vueltas',m.turns,1,20,1,'',value => m.turns = value));
        extras = `<label class="check"><input id="lab-commutator" type="checkbox" ${m.commutator?'checked':''}> Activar conmutador ideal</label>`;
        note = 'Compara la torsión a distintos ángulos y pon la espira en movimiento. El conmutador invierte la corriente cada media vuelta.';
      }
    }
  }
  $('#controls').insertAdjacentHTML('beforeend',controls.map(item => item.html).join('') + extras + `<p class="note">${note}</p>`);
  controls.forEach(item => item.bind());
  if (mode === 'hall') {
    bindNum('lab-density', value => m.density = value);
    $('#lab-carrier').onchange = event => {m.carrier = event.target.value; update();};
  }
  if (mode === 'flux') $('#lab-closed').onchange = event => {m.closed = event.target.checked; update();};
  if (mode === 'loop') {
    $('#lab-commutator').onchange = event => {m.commutator = event.target.checked; update();};
    renderMotorControls();
  }
}

function magneticLabGeometry(mode) {
  const angle = magneticLab.angle[mode] * Math.PI / 180;
  const clean = value => Math.abs(value) < 1e-12 ? 0 : value;
  const sine = clean(Math.sin(angle));
  const cosine = clean(Math.cos(angle));
  return {normal:[sine,0,cosine], tangent:[cosine,0,-sine], vertical:[0,1,0], sine};
}

function magneticLabResult(mode) {
  const m = magneticLab;
  if (mode === 'hall') {
    const thickness = m.thickness * 1e-3;
    const density = m.density * 1e22;
    const charge = (m.carrier === 'negative' ? -1 : 1) * 1.602176634e-19;
    return {voltage:P.hallVoltage(m.hallCurrent,m.hallField,thickness,density,charge), thickness, density, charge};
  }
  const geometry = magneticLabGeometry(mode);
  const field = [0,0,m.field];
  const areaVector = P.mul(geometry.normal,m.area);
  if (mode === 'flux') {
    const faceFluxes = [geometry.normal,geometry.tangent,geometry.vertical].map(direction => {
      const area = P.mul(direction,m.area);
      return [P.magneticFlux(field,area),P.magneticFlux(field,P.mul(area,-1))];
    });
    return {...geometry, faceFluxes, netFlux:faceFluxes.flat().reduce((sum,flux)=>sum+flux,0)};
  }
  if (mode === 'conductor') return {...geometry, force:P.conductorForce(m.current,P.mul(geometry.normal,m.length),field)};
  const effectiveCurrent = m.commutator ? m.current * Math.sign(geometry.sine) : m.current;
  return {...geometry, effectiveCurrent, ...P.currentLoop(effectiveCurrent,m.turns,areaVector,field)};
}

function updateMagneticLab(mode) {
  const m = magneticLab;
  const r = magneticLabResult(mode);
  const metrics = $('#metrics');
  const legend = $('#legend');
  const arrowKey = (label, color) => `<span style="color:${color}">→ ${label}</span>`;
  if (mode === 'hall') {
    metrics.innerHTML = metric('VOLTAJE HALL',fmt(r.voltage*1000),'mV','V(+z) − V(−z)') +
      metric('CAMPO Bᵧ',fmt(m.hallField),'T') + metric('CORRIENTE Iₓ',fmt(m.hallCurrent),'A') +
      metric('BORDE A MAYOR POTENCIAL',r.voltage === 0 ? 'Iguales' : r.voltage > 0 ? '+z' : '−z','');
    legend.innerHTML = arrowKey('B',magneticColors.field) + arrowKey('I',magneticColors.current);
    setText('observation','Con I y B fijos, cambiar el signo del portador invierte la polaridad Hall. Si I o B es cero, la diferencia de potencial transversal desaparece.');
    theory('Voltaje transversal en una placa','En equilibrio, el campo eléctrico transversal compensa la fuerza magnética sobre los portadores. El espesor t se mide en la dirección y.','Vᴴ = I Bᵧ / (n q t)','Diferencia V(+z) − V(−z)','E⃗ᴴ = −v⃗d × B⃗','Equilibrio transversal');
    return [{I_x_A:m.hallCurrent,B_y_T:m.hallField,t_m:r.thickness,n_m3:r.density,q_C:r.charge,V_mas_z_menos_menos_z_V:r.voltage}];
  }

  legend.innerHTML = arrowKey('B',magneticColors.field);
  const inputs = {B_z_T:m.field,angulo_desde_mas_z_grados:m.angle[mode]};
  if (mode === 'flux') {
    const [[normal,opposite], [side,otherSide], [top,bottom]] = r.faceFluxes;
    if (m.closed) {
      const pair = (title,a,b) => metric(title,`${fmt(a)} / ${fmt(b)}`,'Wb','Flujo en caras opuestas');
      metrics.innerHTML = metric('FLUJO NETO',fmt(r.netFlux),'Wb') + pair('FRENTE Y FONDO',normal,opposite) +
        pair('CARAS LATERALES',side,otherSide) + pair('ARRIBA Y ABAJO',top,bottom);
    } else {
      metrics.innerHTML = metric('FLUJO MAGNÉTICO',fmt(normal),'Wb') + metric('CAMPO Bz',fmt(m.field),'T') +
        metric('ÁREA',fmt(m.area),'m²') + metric('ÁNGULO DESDE +z',fmt(m.angle.flux),'°');
    }
    legend.innerHTML += arrowKey('Normal de referencia',magneticColors.normal);
    setText('observation',m.closed ? 'Cada cara tiene una cara opuesta con flujo de signo contrario. La suma de las seis caras del cubo es cero.' : 'Gira la superficie de 0° a 180°. El flujo pasa de positivo a negativo si B apunta hacia +z. A 90° se anula.');
    theory('Flujo y ley de Gauss del magnetismo','El flujo usa la proyección del campo sobre la normal de la superficie. En el cubo las normales apuntan hacia afuera y el flujo neto es cero.','Φᴮ = B⃗ · A⃗','Superficie plana en un campo uniforme','∮ B⃗ · dA⃗ = 0','Superficie cerrada');
    const row = {...inputs,A_m2:m.area,superficie:m.closed?'cubo':'plano',flujo_cara_ref_Wb:normal,flujo_total_Wb:m.closed?r.netFlux:normal};
    return [m.closed ? {...row,flujo_cara_opuesta_Wb:opposite,flujo_lateral_1_Wb:side,flujo_lateral_2_Wb:otherSide,flujo_superior_Wb:top,flujo_inferior_Wb:bottom} : row];
  }
  if (mode === 'conductor') {
    metrics.innerHTML = metric('FUERZA MAGNÉTICA',fmt(P.norm(r.force)),'N') + metric('COMPONENTE Fy',fmt(r.force[1]),'N') +
      metric('CORRIENTE',fmt(m.current),'A') + metric('LONGITUD',fmt(m.length),'m');
    legend.innerHTML += arrowKey('I',magneticColors.current) + arrowKey('F',magneticColors.force);
    setText('observation','Compara el alambre paralelo a B con el perpendicular. En el primer caso la fuerza es cero. En el segundo, su magnitud es máxima.');
    theory('Fuerza magnética en un conductor','La corriente convencional fija el sentido del vector I L⃗. El campo externo es uniforme en todo el tramo recto.','F⃗ = I L⃗ × B⃗','Dirección por la regla de la mano derecha','|F| = |I| L |B| sen θ','Magnitud de la fuerza');
    return [{...inputs,I_A:m.current,L_m:m.length,Fx_N:r.force[0],Fy_N:r.force[1],Fz_N:r.force[2]}];
  }
  metrics.innerHTML = metric('TORSIÓN τᵧ',fmt(r.torque[1]),'N·m') + metric('MOMENTO MAGNÉTICO',fmt(P.norm(r.moment)),'A·m²') +
    metric('CORRIENTE EN LA ESPIRA',fmt(r.effectiveCurrent),'A') + metric('ENERGÍA POTENCIAL',fmt(r.energy),'J','U = −μ⃗ · B⃗');
  legend.innerHTML += arrowKey('I',magneticColors.current) + arrowKey('μ',magneticColors.moment) + arrowKey('τ',magneticColors.force);
  setText('observation',m.commutator ? 'El conmutador invierte I cada media vuelta. Para un mismo sentido de B, la torsión conserva su sentido entre los puntos de conmutación.' : 'En un campo uniforme la fuerza neta sobre la espira es cero. El par de fuerzas puede hacerla girar. La torsión cambia de signo entre 90° y 270°.');
  theory('Momento magnético y par de torsión','La normal de referencia sigue el sentido de la corriente positiva. El conmutador ideal invierte la corriente cada media vuelta y la anula en los puntos de conmutación.','μ⃗ = N I A⃗','Momento magnético','τ⃗ = μ⃗ × B⃗','Par de torsión');
  return [{...inputs,N:m.turns,A_m2:m.area,I_espira_A:r.effectiveCurrent,conmutador:m.commutator,tau_y_Nm:r.torque[1],U_J:r.energy}];
}

function magneticVector(start, vector, length, color, caption) {
  const magnitude = P.norm(vector);
  if (magnitude < 1e-12) return;
  const tip = P.add(start,P.mul(vector,length/magnitude));
  arrow(start,tip,color,2);
  if (caption) label(tip,caption,color,14);
}

function drawMagneticLab(mode) {
  const m = magneticLab;
  const r = magneticLabResult(mode);
  const colors = magneticColors;
  if (mode === 'hall') {
    const point = (x,z) => [x,0,z];
    poly([point(-2,-1),point(2,-1),point(2,1),point(-2,1)],'#5f8b8170','#a2cbbb');
    magneticVector([-.8,0,0],[m.hallCurrent,0,0],1.55,colors.current,'I');
    if(fieldMotion&&m.hallCurrent) for(const offset of [0,.33,.67]) fieldTracer([point(-1.9,0),point(1.9,0)],offset,'#ffe3ad',m.hallCurrent<0);
    if (S.mode3d) {
      magneticVector([-1.6,0,0],[0,m.hallField,0],1.55,colors.field,'B');
    } else if (m.hallField !== 0) {
      label([-1.6,0,0],m.hallField>0?'B ⊗':'B ⊙',colors.field,16);
    }
    label(point(2.15,0),'+x','#d69b8b',12);
    label(point(-2,1.2),'+z','#91bdd3',12);
    for (const side of [-1,1]) {
      const pos = point(1.55,side);
      const sign = Math.sign(r.voltage)*side;
      ball(pos,8,sign>0?'#ec927d':sign<0?'#80c8ef':'#a2b9ad',sign>0?'+':sign<0?'−':'');
      label(point(1.78,side),side>0?'V(+z)':'V(−z)','#dbebe4',12);
    }
    return;
  }

  for (const x of [-2.65,2.65]) {
    magneticVector([x,-.6,-Math.sign(m.field)*.8],[0,0,m.field],1.6,colors.field,'B');
  }
  if (mode === 'conductor') {
    const end = P.mul(r.normal,m.length/2);
    line([P.mul(end,-1),end],'#a9bcb0',5);
    const offset = [0,.2,0];
    const currentStart = P.add(P.mul(end,-.75*Math.sign(m.current)),offset);
    magneticVector(currentStart,P.mul(r.normal,m.current),m.length*.75,colors.current,'I');
    if(fieldMotion&&m.current) fieldTracer([P.mul(end,-1),end],0,'#ffe3ad',m.current<0);
    magneticVector([0,0,0],r.force,1.5,colors.force,'F');
    return;
  }

  const half = Math.sqrt(m.area)/2;
  const face = depth => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) =>
    P.add(P.add(P.mul(r.tangent,x*half),P.mul(r.vertical,y*half)),P.mul(r.normal,depth)));
  const corners = face(mode === 'flux' && m.closed ? half : 0);
  if (mode === 'flux') {
    if(fieldMotion&&m.field) for(const x of [-1.3,0,1.3]) for(const y of [-.7,.7]) fieldTracer([[x,y,-2],[x,y,2]],(x+y)*.2,'#9ff5d9',m.field<0);
    if (m.closed) {
      const opposite = face(-half);
      line([...opposite,opposite[0]],'#a2cbbb',1.5);
      corners.forEach((corner,i) => line([corner,opposite[i]],'#a2cbbb',1.5));
    }
    poly(corners,'#68b7a150','#a2cbbb');
    line([...corners,corners[0]],'#a2cbbb',1.5);
    const normalStart = P.mul(r.normal,m.closed?half:0);
    magneticVector(normalStart,r.normal,1.25,colors.normal,'n');
    return;
  }

  line([...corners,corners[0]],'#a9bcb0',4);
  if(fieldMotion&&r.effectiveCurrent) for(const offset of [0,.25,.5,.75]) fieldTracer([...corners,corners[0]],offset,'#ffe3ad',r.effectiveCurrent<0);
  for (let i=0;i<corners.length;i++) {
    const a = corners[i], b = corners[(i+1)%corners.length];
    const edge = P.sub(b,a);
    magneticVector(P.add(a,P.mul(edge,r.effectiveCurrent<0?.7:.3)),P.mul(edge,r.effectiveCurrent),P.norm(edge)*.35,colors.current);
  }
  magneticVector([0,0,0],r.moment,1.3,colors.moment,'μ');
  magneticVector([0,0,0],r.torque,1.65,colors.force,'τ');
}
