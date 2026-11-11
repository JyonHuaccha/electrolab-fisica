'use strict';

const circuitPresets = {
  mixed:'Red mixta', series:'Resistencias en serie', parallel:'Ramas en paralelo', bridge:'Puente resistivo', rc:'Carga de un capacitor',
  rlc:'Filtro RLC en alterna', blank:'Circuito vacío'
};

function circuitExample(preset) {
  const draft={parts:[],wires:[],settings:{mode:'dc',frequency:1000,duration:.5,samples:240}};
  if(preset==='blank') return CircuitModel.normalize(draft);
  const add=(type,id,x,y,rotation=0,properties={})=>{
    draft.parts.push({...CircuitModel.part(type,id,x,y,id),rotation,...properties});
  };
  const link=(a,b)=>draft.wires.push({a,b});
  if(preset==='bridge') {
    add('V','V1',108,228,90,{value:12});
    add('G','GND',108,398);
    add('J','J0',108,84);
    link('V1:0','J0:0');link('V1:1','GND:0');
    for(const [side,x,top,bottom] of [[0,318,100,100],[1,600,100,200]]) {
      const topNode=`J${side*3+1}`,midNode=`J${side*3+2}`,bottomNode=`J${side*3+3}`;
      const topPart=`R${side*2+1}`,bottomPart=`R${side*2+2}`;
      add('J',topNode,x,84); add('J',midNode,x,230); add('J',bottomNode,x,376);
      add('R',topPart,x,152,90,{value:top});add('R',bottomPart,x,300,90,{value:bottom});
      link(`${topNode}:0`,`${topPart}:0`);link(`${topPart}:1`,`${midNode}:0`);
      link(`${midNode}:0`,`${bottomPart}:0`);link(`${bottomPart}:1`,`${bottomNode}:0`);
    }
    add('R','R5',459,230,0,{value:100});
    link('J0:0','J1:0');link('J1:0','J4:0');link('GND:0','J3:0');link('J3:0','J6:0');
    link('J2:0','R5:0');link('R5:1','J5:0');
    return CircuitModel.normalize(draft);
  }
  add('V','V1',120,216,90,{value:12,amplitude:2});
  add('G','GND',120,354);
  link('V1:1','GND:0');
  if(preset==='parallel' || preset==='mixed') {
    add('J','J1',preset==='parallel'?300:444,108);
    add('J','J2',600,108);
    add('J','J3',preset==='parallel'?300:444,332);
    add('J','J4',600,332);
    if(preset==='mixed') {
      add('R','R1',288,108,0,{value:100});
      link('V1:0','R1:0'); link('R1:1','J1:0');
      add('R','R2',444,216,90,{value:200});
      add('R','R3',600,216,90,{value:300});
      link('J1:0','R2:0'); link('R2:1','J3:0');
      link('J2:0','R3:0'); link('R3:1','J4:0');
    } else {
      add('J','J5',450,108); add('J','J6',450,332);
      add('J','J7',120,108);
      link('V1:0','J7:0'); link('J7:0','J1:0');
      add('R','R1',300,216,90,{value:100}); add('R','R2',450,216,90,{value:200}); add('R','R3',600,216,90,{value:300});
      link('J1:0','R1:0'); link('R1:1','J3:0'); link('J5:0','R2:0'); link('R2:1','J6:0');
      link('J2:0','R3:0'); link('R3:1','J4:0');
      link('J1:0','J5:0'); link('J5:0','J2:0'); link('J3:0','J6:0'); link('J6:0','J4:0');
    }
    if(preset==='mixed') {link('J1:0','J2:0'); link('J3:0','J4:0');}
    link('J3:0','GND:0');
  } else {
    const firstValue=preset==='series'?100:preset==='rc'?1000:100;
    add('R','R1',288,108,0,{value:firstValue});
    link('V1:0','R1:0');
    let right='R1:1';
    if(preset==='series') {
      add('R','R2',480,108,0,{value:200}); link(right,'R2:0'); right='R2:1';
      add('R','R3',636,216,90,{value:300}); link(right,'R3:0'); right='R3:1';
    } else {
      if(preset==='rlc') {
        add('L','L1',468,108,0,{value:.01}); link(right,'L1:0'); right='L1:1';
        draft.settings.mode='ac';
        draft.settings.frequency=1600;
      } else {
        draft.settings.mode='time';
        draft.parts[0].value=0;
        draft.parts[0].amplitude=12;
        draft.parts[0].signal='step';
      }
      add('C','C1',624,216,90,{value:preset==='rc'?.0001:.000001});
      link(right,'C1:0'); right='C1:1';
    }
    add('J','J1',preset==='series'?636:624,332);
    link(right,'J1:0'); link('J1:0','GND:0');
  }
  return CircuitModel.normalize(draft);
}

function circuitNumber(value,unit='',precision=4) {
  if(!Number.isFinite(value)) return '—';
  if(Math.abs(value)<1e-13) return `0${unit?' '+unit:''}`;
  const magnitude=Math.abs(value);
  const exponent=Math.min(9,Math.max(-12,3*Math.floor(Math.log10(magnitude)/3)));
  const prefixes={[-12]:'p',[-9]:'n',[-6]:'µ',[-3]:'m',0:'',3:'k',6:'M',9:'G'};
  const number=Number((value/(10**exponent)).toPrecision(precision));
  return unit ? `${number.toLocaleString('es-CO',{maximumFractionDigits:5})} ${prefixes[exponent]}${unit}`
    : value.toLocaleString('es-CO',{maximumSignificantDigits:precision});
}

const circuitEscape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

class CircuitStudio {
  constructor(root) {
    this.root=root;
    this.undoStack=[];
    this.redoStack=[];
    this.probe='';
    this.quantity='voltage';
    this.dcPlot='nodes';
    this.sweepVoltage=12;
    this.sample=0;
    this.visualRevision=0;
    this.showNets=true;
    this.selected=null;
    this.pending=null;
    this.pendingRoute=[];
    this.routeWire=null;
    this.model=this.load();
    this.flow=new CircuitFlow(this);
    const first=this.model.parts.find(part=>part.type==='R')??this.model.parts.find(part=>!CircuitModel.types[part.type].single);
    if(first) this.selected={kind:'part',id:first.id};
    this.render();
    this.refresh();
    if(typeof LabScene3D!=='undefined') this.$('#studio-physical').click();
  }

  $(selector) {return this.root.querySelector(selector);}
  load() {
    if(new URLSearchParams(location.search).has('tour')) return circuitExample('mixed');
    try {
      const saved=localStorage.getItem('electrolab-circuit-v1');
      if(saved) return CircuitModel.normalize(JSON.parse(saved));
    } catch { /* An invalid or inaccessible local copy falls back to the mixed example. */ }
    return circuitExample('mixed');
  }

  store() {
    if(new URLSearchParams(location.search).has('tour')) return;
    try {localStorage.setItem('electrolab-circuit-v1',JSON.stringify(this.model));} catch { /* JSON export remains available. */ }
  }

  render() {
    const options=Object.entries(circuitPresets).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
    const icons={R:'∿',C:'⊣⊢',L:'∩∩',V:'±',I:'↑',S:'╱',G:'⏚',J:'•'};
    const palette=Object.entries(CircuitModel.types).map(([key,spec])=>
      `<button type="button" data-part="${key}" aria-label="Añadir ${spec.name.toLowerCase()}"><span aria-hidden="true">${icons[key]}</span><strong>${spec.name}</strong><i aria-hidden="true">+</i></button>`).join('');
    this.root.innerHTML=`
      <div class="studio-heading"><div><p class="panel-kicker">UNIDAD 3 / ELECTRÓNICA</p><h2>Banco de circuitos</h2><p>Coloca componentes, conecta sus bornes y mide tu circuito.</p></div>
        <div class="studio-files"><button id="studio-import" type="button">Abrir JSON</button><button id="studio-save" type="button">Guardar JSON</button><input id="studio-file" type="file" accept=".json,application/json" hidden></div></div>
      <div class="studio-grid">
        <aside class="studio-card studio-palette"><h3>Componentes</h3><div class="component-palette">${palette}</div>
          <div class="studio-example"><label for="studio-example">Abrir un ejemplo</label><select id="studio-example"><option value="">Selecciona una plantilla</option>${options}</select></div>
          <details class="studio-connection"><summary>Conectar por nombre</summary><label for="connect-a">Borne de origen</label><select id="connect-a"></select><label for="connect-b">Borne de destino</label><select id="connect-b"></select><button id="connect-go" type="button">Unir bornes</button></details>
        </aside>
        <section class="studio-card studio-board"><div class="board-toolbar"><span class="board-title"><i></i> Esquema eléctrico</span><div class="board-actions">
          <button id="studio-undo" type="button" aria-label="Deshacer" title="Deshacer">↶</button><button id="studio-redo" type="button" aria-label="Rehacer" title="Rehacer">↷</button>
          <button id="studio-physical" type="button" aria-pressed="false">Montaje 3D</button><button id="studio-zoomout" type="button" aria-label="Alejar">−</button><button id="studio-zoomin" type="button" aria-label="Acercar">+</button><button id="studio-fit" type="button">Ajustar vista</button></div></div>
          <div class="board-viewport"><canvas id="circuit-canvas" tabindex="0" aria-label="Esquema editable. Pulsa un borne, fija puntos del cable con clics y termina en otro borne."></canvas><div id="circuit-physical" hidden></div>
            <div class="board-overlay"><label><input id="studio-nets" type="checkbox" checked> Nodos</label><span id="board-count"></span></div>
          </div><div class="board-footer" id="board-message" role="status">Pulsa un borne, fija el recorrido con clics y termina en otro borne. Esc cancela. Rueda acerca. Botón central desplaza.</div>
        </section>
        <aside class="studio-card studio-inspector"><h3>Propiedades</h3><label for="studio-part">Seleccionar componente o cable</label><select id="studio-part"></select><div id="part-details"></div></aside>
      </div>
      <section class="energy-panel circuit-energy" aria-label="Energía del circuito"><div class="energy-head"><div><h3>Flujo eléctrico y energía</h3><p>Puntos en los cables · corriente convencional. Luz ámbar · disipación. Halo turquesa · energía en C o L.</p></div>
        <div class="energy-actions"><button id="flow-play" type="button">Pausar flujo</button><button id="flow-rewind" type="button">Volver al inicio</button><label for="flow-speed">Ritmo <select id="flow-speed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div></div>
        <div class="circuit-energy-stats"><div><span><i class="energy-dot source"></i> Potencia neta de fuentes</span><strong id="flow-source"></strong></div><div><span><i class="energy-dot heat"></i> Potencia disipada</span><strong id="flow-heat"></strong></div><div><span><i class="energy-dot stored"></i> Energía almacenada</span><strong id="flow-stored"></strong></div></div>
        <p class="energy-change" id="flow-change" hidden></p></section>
      <section class="studio-card studio-analysis" aria-label="Análisis eléctrico"><div class="analysis-heading"><div><h3>Analizador</h3><p id="analysis-description"></p></div>
        <div class="analysis-modes" aria-label="Tipo de análisis"><button type="button" data-analysis="dc">CC</button><button type="button" data-analysis="ac">CA</button><button type="button" data-analysis="time">Transitorio</button></div></div>
        <div id="analysis-settings"></div><div id="analysis-status" role="status"></div><div id="analysis-stats"></div>
        <div class="studio-results"><section class="scope-panel"><div class="scope-header"><h4 id="scope-title">Voltajes de nodo</h4><div id="scope-controls"><select id="scope-dc" aria-label="Gráfica en corriente continua"><option value="nodes">Nodos</option><option value="ohm">Ley de Ohm</option></select><select id="scope-part" aria-label="Componente del gráfico"></select><select id="scope-quantity" aria-label="Magnitud del gráfico"><option value="voltage">Voltaje</option><option value="current">Corriente</option></select></div></div>
          <canvas id="circuit-scope" aria-label="Gráfica de las mediciones eléctricas"></canvas><div id="scope-time"></div></section>
          <section class="readings-panel"><h4>Mediciones por componente</h4><p id="measurement-convention"></p><div id="circuit-readings"></div><details class="node-readings"><summary>Ver voltajes de todos los nodos</summary><div id="circuit-nodes"></div></details></section></div>
      </section>`;
    this.board=new CircuitBoard(this.$('#circuit-canvas'),{
      state:()=>this, select:selection=>this.select(selection), connect:(a,b)=>this.connect(a,b),
      pin:id=>this.choosePin(id), waypoint:point=>this.addWaypoint(point),
      routed:(id,before,after)=>this.routed(id,before,after), moved:(id,before,after)=>this.moved(id,before,after),
      valueLabel:p=>this.valueLabel(p)
    });
    this.flow.bind();
    this.$('#studio-physical').onclick=()=>{
      const host=this.$('#circuit-physical');
      const open=host.hidden;
      if(open&&!this.physicalScene) {
        try {
          this.physicalScene=new LabScene3D(host,()=>({studio:this,revision:this.visualRevision}),{
            circuit:true,onSelect:id=>this.select({kind:'part',id})
          });
        } catch(error) {this.message('La vista tridimensional requiere WebGL. Puedes seguir editando el esquema.');return;}
      }
      host.hidden=!open;
      this.$('#circuit-canvas').hidden=open;
      this.$('#studio-physical').textContent=open?'Editar esquema':'Montaje 3D';
      this.$('.board-title').innerHTML=`<i></i> ${open?'Montaje físico':'Esquema eléctrico'}`;
      this.$('#studio-physical').setAttribute('aria-pressed',String(open));
      this.$('#studio-zoomout').disabled=open;
      this.$('#studio-zoomin').disabled=open;
      if(open) {this.physicalScene.active=true;this.physicalScene.resize();}
      else {this.physicalScene.active=false;this.board.resize();}
      this.message(open?'Arrastra para girar el montaje. Selecciona un componente para editar sus propiedades.':'Pulsa un borne y fija puntos con clics. Termina en otro borne. Retroceso retira el último punto y Esc cancela. Los cruces de cables se unen solo por bornes.');
    };
    new ResizeObserver(()=>this.drawScope()).observe(this.$('#circuit-scope'));
    this.root.querySelectorAll('[data-part]').forEach(button=>button.onclick=()=>this.add(button.dataset.part));
    this.root.querySelectorAll('[data-analysis]').forEach(button=>button.onclick=()=>this.setMode(button.dataset.analysis));
    this.$('#studio-example').onchange=event=>{
      const key=event.target.value;
      if(key){this.replace(circuitExample(key));event.target.value='';this.board.fit();this.message(`${circuitPresets[key]} cargado.`);}
    };
    this.$('#studio-part').onchange=event=>{
      const [kind,id]=event.target.value.split(':');
      this.select(id?{kind,id}:null);
    };
    this.$('#studio-undo').onclick=()=>this.undo();
    this.$('#studio-redo').onclick=()=>this.redo();
    this.$('#studio-fit').onclick=()=>{if(this.physicalScene?.active)this.physicalScene.resetView();else this.board.fit();};
    this.$('#studio-zoomout').onclick=()=>this.board.changeZoom(1/1.25);
    this.$('#studio-zoomin').onclick=()=>this.board.changeZoom(1.25);
    this.$('#studio-nets').onchange=event=>{this.showNets=event.target.checked;this.board.draw();};
    this.$('#connect-go').onclick=()=>this.connect(this.$('#connect-a').value,this.$('#connect-b').value);
    this.$('#scope-part').onchange=event=>{this.probe=event.target.value;this.drawScope();};
    this.$('#scope-quantity').onchange=event=>{this.quantity=event.target.value;this.drawScope();};
    this.$('#scope-dc').onchange=event=>{this.dcPlot=event.target.value;this.renderResults();};
    this.$('#studio-save').onclick=()=>this.download(JSON.stringify(this.model,null,2),'circuito-electrolab.json','application/json');
    this.$('#studio-import').onclick=()=>this.$('#studio-file').click();
    this.$('#studio-file').onchange=async event=>{
      const file=event.target.files[0];
      if(!file) return;
      try {
        if(file.size>512000) throw new Error('El archivo supera 512 KB.');
        this.replace(CircuitModel.normalize(JSON.parse(await file.text())));
        this.board.fit();
        this.message('Circuito importado.');
      } catch(error) {this.message(`No se pudo abrir el circuito. ${error.message}`);}
      event.target.value='';
    };
    this.$('#circuit-canvas').addEventListener('keydown',event=>{
      if(event.key==='Escape') {
        this.pending=null;this.pendingRoute=[];this.routeWire=null;this.message('Conexión cancelada.');this.board.draw();
      }
      if(this.pending && ['Backspace','Delete'].includes(event.key)) {
        event.preventDefault();this.pendingRoute.pop();
        this.message('Último punto retirado. Continúa el recorrido o pulsa Esc para cancelarlo.');
        this.board.draw();return;
      }
      if(event.key==='Delete' && this.selected){event.preventDefault();this.removeSelected();}
    });
  }

  replace(next) {
    this.selected=null;
    this.pending=null;
    this.pendingRoute=[];
    this.routeWire=null;
    this.probe='';
    if(!this.commit(model=>Object.assign(model,next))) {
      this.renderChoices();this.renderResults();this.board.draw();
    }
  }

  commit(change,{keepInspector=false,keepSettings=false,record=true,compare=true}={}) {
    const draft=JSON.parse(JSON.stringify(this.model));
    change(draft);
    const normalized=CircuitModel.normalize(draft);
    if(JSON.stringify(normalized)===JSON.stringify(this.model)) return false;
    if(record) {
      this.undoStack.push(this.model);
      if(this.undoStack.length>60) this.undoStack.shift();
    }
    this.redoStack=[];
    const before=compare?this.flow.snapshot():null;
    const mode=this.model.settings.mode;
    const sample=this.sample;
    this.model=normalized;
    this.store();
    this.refresh({keepInspector,keepSettings,compare,mode,before,sample});
    return true;
  }

  undo() {
    if(!this.undoStack.length) return;
    this.redoStack.push(this.model);
    this.restore(this.undoStack.pop());
    this.message('Cambio deshecho.');
  }

  redo() {
    if(!this.redoStack.length) return;
    this.undoStack.push(this.model);
    this.restore(this.redoStack.pop());
    this.message('Cambio rehecho.');
  }

  restore(model) {
    const before=this.flow.snapshot(),mode=this.model.settings.mode,sample=this.sample;
    this.model=model; this.selected=null; this.pending=null;this.pendingRoute=[];this.routeWire=null;
    this.store();this.refresh({compare:true,mode,before,sample});
  }

  add(type) {
    if(this.model.parts.length>=CircuitModel.maxParts){this.message('Alcanzaste el límite de 48 componentes.');return;}
    let i=1;
    while(this.model.parts.some(p=>p.id===type+i)) i++;
    const id=type+i;
    const center=this.board.ready?this.board.worldPoint([this.board.width/2,this.board.height/2]):[340,210];
    const occupied=(x,y)=>this.model.parts.some(p=>Math.abs(p.x-x)<80 && Math.abs(p.y-y)<54);
    let x=Math.round(center[0]/12)*12,y=Math.round(center[1]/12)*12;
    for(let attempt=0;attempt<18 && occupied(x,y);attempt++) {
      const ring=1+Math.floor(attempt/8),angle=attempt*Math.PI/4;
      x=Math.round((center[0]+ring*108*Math.cos(angle))/12)*12;
      y=Math.round((center[1]+ring*84*Math.sin(angle))/12)*12;
    }
    this.selected={kind:'part',id};
    this.commit(model=>model.parts.push(CircuitModel.part(type,id,x,y,type==='G'?'GND':id)));
    this.message(`${this.valueName(id)} colocado. Conecta sus bornes para incluirlo en el análisis.`);
  }

  moved(id,before,after) {
    const original=this.model.parts.find(p=>p.id===id);
    [original.x,original.y]=before;
    this.commit(model=>{const p=model.parts.find(p=>p.id===id);[p.x,p.y]=after;},{compare:false});
  }

  routed(id,before,after) {
    this.model.wires.find(wire=>wire.id===id).points=before;
    this.commit(model=>{model.wires.find(wire=>wire.id===id).points=after;},{compare:false});
    this.message('Recorrido del cable actualizado.');
  }

  beginWireRoute(id) {
    const wire=this.model.wires.find(w=>w.id===id);
    if(!wire) return;
    this.pending=wire.a;this.pendingRoute=[];this.routeWire=id;
    this.message('Nuevo recorrido del cable. Fija puntos con clics y termina en el borne de destino. Esc cancela.');
    this.board.draw();
  }

  addWaypoint(point) {
    if(!this.pending) return;
    if(this.pendingRoute.length>=64) {this.message('Alcanzaste los 64 puntos. Termina en un borne o retira un punto con Retroceso.');return;}
    const snapped=point.map(value=>Math.max(-2496,Math.min(2496,Math.round(value/12)*12)));
    const last=this.pendingRoute[this.pendingRoute.length-1];
    if(!last||snapped[0]!==last[0]||snapped[1]!==last[1]) this.pendingRoute.push(snapped);
    this.message(`${this.pendingRoute.length} puntos fijados. Clic para continuar, borne para terminar, Retroceso para retirar y Esc para cancelar.`);
    this.board.draw();
  }

  valueName(id) {return this.model.parts.find(p=>p.id===id)?.label ?? id;}
  pinName(pin) {
    const [id,index]=pin.split(':');
    const part=this.model.parts.find(p=>p.id===id);
    if(!part) return pin;
    return `${part.label} · ${CircuitModel.types[part.type].single?'borne':index==='0'?'A':'B'}`;
  }

  valueLabel(part) {
    if(part.type==='G'||part.type==='J') return '';
    if(part.type==='S') return part.closed?'Cerrado':'Abierto';
    const units={R:'Ω',C:'F',L:'H',V:'V',I:'A'};
    const value=this.model.settings.mode==='ac'&&CircuitModel.types[part.type].source?part.amplitude:part.value;
    return circuitNumber(value,units[part.type],3);
  }

  select(selection) {
    this.selected=selection;
    if(selection?.kind==='part') {
      const p=this.model.parts.find(part=>part.id===selection.id);
      if(p && !CircuitModel.types[p.type].single) this.probe=p.id;
    }
    this.renderChoices();this.renderResults();this.board.draw();
  }

  choosePin(pin) {
    if(!this.pending) {
      this.pending=pin;
      this.pendingRoute=[];this.routeWire=null;
      this.message(`${this.pinName(pin)} seleccionado. Haz clic para fijar el recorrido y termina en otro borne. Esc cancela.`);
    } else if(this.pending===pin) {
      this.pending=null;
      this.pendingRoute=[];
      this.routeWire=null;
      this.message('Conexión cancelada.');
    } else {
      this.connect(this.pending,pin);
    }
    this.board.draw();
  }

  connect(a,b) {
    const terminals=new Set(this.model.parts.flatMap(CircuitModel.pins));
    if(a===b || !terminals.has(a) || !terminals.has(b)){this.message('Selecciona dos bornes distintos.');return;}
    const editing=this.model.wires.find(w=>w.id===this.routeWire);
    if(this.model.wires.some(w=>w!==editing&&((w.a===a&&w.b===b)||(w.a===b&&w.b===a)))){this.message('Esos bornes ya están conectados.');return;}
    if(!editing&&this.model.wires.length>=CircuitModel.maxWires){this.message('Alcanzaste el límite de 160 cables.');return;}
    const points=this.pending===a?this.pendingRoute.map(point=>[...point]):[];
    this.pending=null;this.pendingRoute=[];this.routeWire=null;
    this.selected={kind:'wire',id:editing?.id??`w${this.model.wires.length+1}`};
    this.commit(model=>{
      if(editing) {
        const wire=model.wires.find(w=>w.id===editing.id);
        wire.a=a;wire.b=b;
        if(points.length) wire.points=points;else delete wire.points;
      } else model.wires.push(points.length?{a,b,points}:{a,b});
    },{compare:!editing||editing.a!==a||editing.b!==b});
    this.message(`Cable conectado entre ${this.pinName(a)} y ${this.pinName(b)}.`);
  }

  removeSelected() {
    if(!this.selected) return;
    const {kind,id}=this.selected;
    this.selected=null;this.pending=null;this.pendingRoute=[];this.routeWire=null;
    this.commit(model=>{
      if(kind==='part') model.parts=model.parts.filter(p=>p.id!==id);
      model.wires=model.wires.filter(w=>kind==='wire'?w.id!==id:!w.a.startsWith(id+':')&&!w.b.startsWith(id+':'));
    });
    this.message(kind==='part'?'Componente eliminado con sus cables.':'Cable eliminado.');
  }

  message(text) {this.$('#board-message').textContent=text;}

  renderChoices(keepInspector=false) {
    const option=(value,label)=>`<option value="${circuitEscape(value)}">${circuitEscape(label)}</option>`;
    const select=this.$('#studio-part');
    select.innerHTML=option('','Elige en el esquema o la lista')+
      this.model.parts.map(p=>option(`part:${p.id}`,`${p.label} · ${CircuitModel.types[p.type].name}`)).join('')+
      this.model.wires.map(w=>option(`wire:${w.id}`,`${w.id.toUpperCase()} · ${this.pinName(w.a)} ↔ ${this.pinName(w.b)}`)).join('');
    if(this.selected) select.value=`${this.selected.kind}:${this.selected.id}`;
    const terminals=this.model.parts.flatMap(CircuitModel.pins);
    for(const id of ['connect-a','connect-b']) {
      const field=this.$('#'+id),previous=field.value;
      field.innerHTML=option('','Elige un borne')+terminals.map(pin=>option(pin,this.pinName(pin))).join('');
      if(terminals.includes(previous)) field.value=previous;
    }
    this.$('#connect-go').disabled=terminals.length<2;
    if(!keepInspector) this.renderInspector();
  }

  renderInspector() {
    const panel=this.$('#part-details');
    const selection=this.selected;
    if(!selection) {
      panel.innerHTML='<p class="inspector-empty">Selecciona un componente para cambiar sus valores, o un cable para cambiar sus bornes.</p>';
      return;
    }
    if(selection.kind==='wire') {
      const wire=this.model.wires.find(w=>w.id===selection.id);
      if(!wire){panel.innerHTML='';return;}
      const terminals=this.model.parts.flatMap(CircuitModel.pins);
      const choices=pin=>terminals.map(value=>`<option value="${value}" ${value===pin?'selected':''}>${circuitEscape(this.pinName(value))}</option>`).join('');
      panel.innerHTML=`<p class="inspector-type">Cable ${wire.id.toUpperCase()}</p>
        <label for="wire-a">Borne A del cable</label><select id="wire-a">${choices(wire.a)}</select>
        <label for="wire-b">Borne B del cable</label><select id="wire-b">${choices(wire.b)}</select>
        <button id="wire-apply" type="button">Aplicar conexión</button>
        <button id="wire-route" type="button">Redibujar recorrido</button>
        ${wire.points?.length?`<p class="note">${wire.points.length} puntos fijados. Arrastra sus cuadrados en el esquema para ajustar la forma.</p><button id="wire-auto" type="button">Recorrido automático</button>`:''}
        <button id="part-remove" class="danger-button" type="button">Eliminar cable</button>`;
      this.$('#wire-apply').onclick=()=>{
        const a=this.$('#wire-a').value,b=this.$('#wire-b').value;
        try {this.commit(model=>Object.assign(model.wires.find(w=>w.id===wire.id),{a,b}));this.message('Bornes del cable actualizados.');}
        catch(error){this.message(error.message);}
      };
      this.$('#part-remove').onclick=()=>this.removeSelected();
      this.$('#wire-route').onclick=()=>this.beginWireRoute(wire.id);
      if(this.$('#wire-auto')) this.$('#wire-auto').onclick=()=>this.commit(model=>{
        delete model.wires.find(w=>w.id===wire.id).points;
      },{compare:false});
      return;
    }
    const p=this.model.parts.find(part=>part.id===selection.id);
    if(!p){panel.innerHTML='';return;}
    const spec=CircuitModel.types[p.type];
    const field=(key,caption,value,min,max)=>`<label for="prop-${key}">${caption}</label><input id="prop-${key}" data-property="${key}" type="number" step="any" value="${value}" min="${min}" max="${max}" required>`;
    const displayValue=(value,scale)=>Number((value/scale).toPrecision(11));
    const netFor=pin=>this.result?.netNames[pin]??'—';
    let fields='';
    if(!spec.single) {
      const min=spec.source?-1e6:p.type==='C'||p.type==='L'?1e-12:1e-6;
      const max=spec.source?1e6:p.type==='C'||p.type==='L'?1e3:1e10;
      const label=p.type==='S'?'Resistencia al cerrar':spec.source?'Valor en CC / nivel base':spec.name;
      fields+=field('value',`${label} (${spec.unit})`,displayValue(p.value,spec.scale),min/spec.scale,max/spec.scale);
    }
    if(spec.source) {
      fields+=`<label for="prop-signal">Forma de onda en el tiempo</label><select id="prop-signal" data-property="signal">
        ${[['constant','Constante'],['step','Escalón'],['sine','Senoidal'],['pulse','Pulsos']].map(([key,name])=>`<option value="${key}" ${key===p.signal?'selected':''}>${name}</option>`).join('')}</select>`;
      fields+=field('amplitude',`Amplitud pico CA / señal (${spec.unit})`,displayValue(p.amplitude,spec.scale),0,1e6/spec.scale);
      fields+=field('frequency','Frecuencia de la señal (Hz)',p.frequency,.001,1e8)+field('phase','Fase (°)',p.phase,-360,360);
      if(p.signal==='pulse') fields+=field('duty','Ciclo activo (%)',p.duty,1,99);
    }
    if(p.type==='C'||p.type==='L') {
      const initialScale=p.type==='L'?1e-3:1;
      fields+=field('initial',p.type==='C'?'Voltaje inicial A−B (V)':'Corriente inicial A→B (mA)',displayValue(p.initial,initialScale),-1e6/initialScale,1e6/initialScale);
    }
    if(p.type==='S') fields+=`<label class="studio-check"><input id="prop-closed" data-property="closed" type="checkbox" ${p.closed?'checked':''}> Interruptor cerrado</label>`;
    panel.innerHTML=`<p class="inspector-type">${spec.name}</p><label for="prop-label">Nombre</label>
      <input id="prop-label" type="text" maxlength="22" value="${circuitEscape(p.label)}" data-property="label" required>${fields}
      <p class="pin-reading">${CircuitModel.pins(p).map((pin,index)=>`${spec.single?'Borne':index===0?'A':'B'} · ${netFor(pin)}`).join('　')}</p>
      ${spec.single?'':'<div id="part-live" aria-label="Medición del componente seleccionado"></div>'}
      ${p.type==='C'?'<p id="capacitor-explanation" class="note"></p><button id="capacitor-transient" type="button">Ver carga / descarga</button>':''}
      <details class="studio-position"><summary>Posición y orientación</summary><div class="studio-coordinates">${field('x','X',p.x,-2500,2500)}${field('y','Y',p.y,-2500,2500)}</div>
      ${spec.single?'':`<label for="prop-rotation">Giro</label><select id="prop-rotation" data-property="rotation">${[0,90,180,270].map(value=>`<option value="${value}" ${value===p.rotation?'selected':''}>${value}°</option>`).join('')}</select>`}</details>
      <div class="part-actions">${spec.single?'':'<button id="part-rotate" type="button">↻ Girar 90°</button>'}<button id="part-remove" class="danger-button" type="button">Eliminar componente</button></div>`;
    panel.querySelectorAll('[data-property]').forEach(input=>{
      const live=input.type==='number'||input.type==='text';
      let recorded=false;
      input.addEventListener(live?'input':'change',()=>{
        if(!input.checkValidity() || (input.type==='text'&&!input.value.trim())) return;
        const key=input.dataset.property;
        let value=input.type==='checkbox'?input.checked:input.value;
        if(input.type==='number'||key==='rotation') value=Number(value);
        if(key==='value'||key==='amplitude') value*=spec.scale;
        if(key==='initial'&&p.type==='L') value*=1e-3;
        const changed=this.editPart(p.id,key,value,{keepInspector:live,record:!recorded});
        if(live && changed) recorded=true;
      });
      if(live) input.addEventListener('blur',()=>{
        recorded=false;
        if(!input.checkValidity()) input.reportValidity();
      });
    });
    if(!spec.single) this.$('#part-rotate').onclick=()=>this.editPart(p.id,'rotation',(p.rotation+90)%360);
    if(p.type==='C') this.$('#capacitor-transient').onclick=()=>this.previewCapacitor(p.id);
    this.$('#part-remove').onclick=()=>this.removeSelected();
  }

  editPart(id,key,value,options) {
    const positionWasOpen=this.$('.studio-position')?.open;
    const changed=this.commit(model=>{model.parts.find(p=>p.id===id)[key]=value;},options);
    if(positionWasOpen && this.$('.studio-position')) this.$('.studio-position').open=true;
    return changed;
  }

  setMode(mode) {this.commit(model=>model.settings.mode=mode);}

  previewCapacitor(id) {
    const tau=CircuitModel.capacitorTimeConstant(this.model,id);
    this.probe=id;this.quantity='current';this.flow.running=true;
    this.commit(model=>{
      model.settings.mode='time';
      if(tau!==null) model.settings.duration=Math.min(1000,Math.max(.000001,6*tau));
      model.settings.samples=Math.max(360,model.settings.samples);
    });
    this.message('Transitorio desde el voltaje inicial configurado. La gráfica muestra la corriente de este capacitor.');
  }

  capacitorExplanation(part,value) {
    const note=this.$('#capacitor-explanation'),button=this.$('#capacitor-transient');
    if(!note||!button) return;
    const a=this.result?.netNames[`${part.id}:0`],b=this.result?.netNames[`${part.id}:1`];
    const sameNode=a!==undefined&&a===b;
    const mode=this.model.settings.mode;
    button.hidden=mode!=='dc';button.disabled=!value||sameNode;
    if(!value) note.textContent='Falta un potencial definido en sus bornes. Conecta ambos extremos al circuito para medirlo.';
    else if(sameNode) note.textContent=`Los dos bornes están en ${a}. Tienen el mismo potencial y el voltaje entre placas es cero.`;
    else if(mode==='dc') note.textContent='CC muestra el estado estabilizado. El capacitor puede conservar voltaje y energía con I = 0 A y P = 0 W. Usa Ver carga / descarga para observar la corriente durante el transitorio.';
    else if(mode==='ac') note.textContent='En CA, P es la potencia media. En un capacitor ideal puede valer cero mientras circula corriente y se intercambia energía con el circuito.';
    else note.textContent='Durante el transitorio, I y P cambian. P positiva indica energía que entra al capacitor y P negativa indica energía que entrega.';
  }

  refresh({keepInspector=false,keepSettings=false,compare=false,mode,before,sample=0}={}) {
    this.visualRevision++;
    const preservePlayback=!compare && this.result;
    this.problem='';
    try {this.result=CircuitModel.analyze(this.model);} catch(error) {this.result=null;this.problem=error.message;}
    const matching=mode===this.model.settings.mode;
    if(compare) {
      this.sample=Math.min(sample,(this.result?.frames.length??1)-1);
      this.flow.previous=matching?{before,after:this.flow.snapshot(),mode}:null;
    }
    if(!preservePlayback) {
      this.sample=this.flow.running?0:Math.max(0,(this.result?.frames.length??1)-1);
      this.flow.time=this.flow.running?0:7;
      this.flow.phases.clear();
    }
    this.$('#studio-undo').disabled=!this.undoStack.length;
    this.$('#studio-redo').disabled=!this.redoStack.length;
    const count=this.model.parts.filter(p=>!CircuitModel.types[p.type].single).length;
    this.$('#board-count').textContent=`${count} componentes · ${this.model.wires.length} cables`;
    this.renderChoices(keepInspector);
    if(!keepSettings) this.renderSettings();
    else if(this.$('#analysis-step')) this.$('#analysis-step').textContent=`Δt = ${circuitNumber(this.model.settings.duration/this.model.settings.samples,'s')}`;
    this.renderResults();
    this.board.draw();
  }

  renderSettings() {
    const {mode,frequency,duration,samples}=this.model.settings;
    this.root.querySelectorAll('[data-analysis]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.analysis===mode)));
    this.$('#analysis-description').textContent={dc:'Punto de operación con fuentes constantes.',ac:'Respuesta sinusoidal y desfase a una frecuencia común.',time:'Evolución del circuito a partir de sus condiciones iniciales.'}[mode];
    const settings=this.$('#analysis-settings');
    if(mode==='ac') {
      settings.innerHTML=`<label>Frecuencia de análisis (Hz) <input type="number" data-setting="frequency" value="${frequency}" min="0.001" max="100000000" step="any" required></label>`;
    } else if(mode==='time') {
      settings.innerHTML=`<label>Duración (s) <input type="number" data-setting="duration" value="${duration}" min="0.000001" max="1000" step="any" required></label>
        <label>Muestras <input type="number" data-setting="samples" value="${samples}" min="40" max="900" step="1" required></label>
        <span id="analysis-step">Δt = ${circuitNumber(duration/samples,'s')}</span>`;
    } else settings.innerHTML='';
    settings.querySelectorAll('input').forEach(input=>{
      let recorded=false;
      input.oninput=()=>{
        if(!input.checkValidity()) return;
        const changed=this.commit(model=>model.settings[input.dataset.setting]=Number(input.value),{keepSettings:true,record:!recorded});
        if(changed) recorded=true;
      };
      input.onblur=()=>{recorded=false;if(!input.checkValidity())input.reportValidity();};
    });
  }

  pairText(pair,unit) {
    if(this.model.settings.mode!=='ac') return circuitNumber(pair[0],unit);
    const amplitude=CircuitModel.magnitude(pair);
    return `${circuitNumber(amplitude,unit)}${amplitude>1e-13?` ∠ ${circuitNumber(CircuitModel.phase(pair))}°`:''}`;
  }

  renderResults() {
    const result=this.result,mode=this.model.settings.mode;
    const status=this.$('#analysis-status');
    const parts=this.model.parts.filter(p=>!CircuitModel.types[p.type].single);
    const ohm=mode==='dc'&&this.dcPlot==='ohm';
    const candidates=ohm?parts.filter(p=>p.type==='R'||(p.type==='S'&&p.closed)):parts;
    if((mode!=='dc'||ohm) && !candidates.some(p=>p.id===this.probe)) this.probe=candidates.find(p=>p.type==='C')?.id??candidates[0]?.id??'';
    this.$('#scope-part').innerHTML=candidates.map(p=>`<option value="${p.id}">${circuitEscape(p.label)}</option>`).join('');
    this.$('#scope-part').value=this.probe;
    this.$('#scope-dc').hidden=mode!=='dc';
    this.$('#scope-dc').value=this.dcPlot;
    this.$('#scope-part').hidden=(mode==='dc'&&!ohm)||!candidates.length;
    this.$('#scope-quantity').hidden=mode==='dc'||!parts.length;
    this.$('#scope-title').textContent={dc:ohm?'Corriente frente a voltaje':'Voltajes de nodo',ac:'Un ciclo de la señal',time:'Osciloscopio'}[mode];
    this.$('#measurement-convention').textContent=mode==='ac'?'Amplitud pico y fase. P es potencia media.':'Voltaje A−B y corriente A→B. P positiva significa absorción.';
    this.$('#scope-time').innerHTML=mode==='time'&&result?`<label for="scope-cursor">Cursor <output id="scope-cursor-value"></output></label><input id="scope-cursor" type="range" min="0" max="${result.frames.length-1}" value="${this.sample}">`:ohm?`<label for="sweep-voltage">Límite de voltaje (V)</label><input id="sweep-voltage" type="number" min="0.001" max="1000000" step="any" value="${this.sweepVoltage}" required>`:'';
    const cursor=this.$('#scope-cursor');
    if(cursor) cursor.oninput=()=>{
      this.flow.running=false;
      this.flow.time=7*Number(cursor.value)/result.frames.length;
      this.flow.selectSample(Number(cursor.value));this.board.draw();
    };
    const sweep=this.$('#sweep-voltage');
    if(sweep) sweep.oninput=()=>{if(sweep.checkValidity()){this.sweepVoltage=Number(sweep.value);this.drawScope();}};
    if(this.problem) {
      status.className='analysis-warning';
      status.textContent=this.problem;
    } else if(result?.floating) {
      status.className='analysis-warning';
      status.textContent=`${result.floating} ${result.floating===1?'nodo sin potencial definido':'nodos sin potencial definido'} en este modo. Revisa bornes sueltos y ramas abiertas.`;
    } else if(mode==='time'&&parts.some(p=>CircuitModel.types[p.type].source && ['sine','pulse'].includes(p.signal) && p.frequency*this.model.settings.duration/this.model.settings.samples>.05)) {
      status.className='analysis-warning';
      status.textContent='La señal rápida tiene menos de 20 muestras por ciclo. Aumenta las muestras o reduce la duración para distinguir su forma.';
    } else {
      status.className='analysis-good';
      status.textContent='Solución calculada';
    }
    this.renderFrame();
  }

  renderFrame() {
    this.flow.sync();
    const result=this.result;
    const frame=result?.frames[this.sample];
    const parts=this.model.parts.filter(p=>!CircuitModel.types[p.type].single);
    const row=(cells)=>`<tr>${cells.map((cell,i)=>i?`<td>${cell}</td>`:`<th scope="row">${cell}</th>`).join('')}</tr>`;
    const live=this.$('#part-live');
    if(live) {
      const value=frame?.values[this.selected?.id];
      const part=parts.find(p=>p.id===this.selected?.id);
      const entries=value?[
        ['Voltaje',this.pairText(value.voltage,'V')],['Corriente',this.pairText(value.current,'A')],['Potencia',circuitNumber(value.power,'W')]
      ]:[];
      if(value&&part?.type==='C') {
        const ac=this.model.settings.mode==='ac';
        const voltage=ac?CircuitModel.magnitude(value.voltage):value.voltage[0];
        entries.push([ac?'Energía media':'Energía almacenada',circuitNumber(.5*part.value*voltage**2*(ac?.5:1),'J')]);
      }
      live.innerHTML=entries.length?entries.map(([name,reading])=>`<span>${name}</span><strong>${reading}</strong>`).join(''):'<span>Medición pendiente</span>';
      if(part?.type==='C') this.capacitorExplanation(part,value);
    }
    if(!frame) {
      this.$('#analysis-stats').innerHTML='';
      this.$('#circuit-readings').innerHTML='<p class="inspector-empty">Las mediciones se muestran cuando el análisis tiene una solución.</p>';
      this.$('#circuit-nodes').innerHTML='';
      this.drawScope();return;
    }
    const power=parts.reduce((sum,p)=>sum-(CircuitModel.types[p.type].source?frame.values[p.id]?.power??0:0),0);
    const stat=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
    this.$('#analysis-stats').innerHTML=stat('Nodos con potencial',`${result.grounded} / ${result.nodes}`)+
      stat('Ramas analizadas',String(Object.keys(frame.values).length))+
      stat('Potencia neta de fuentes',circuitNumber(power,'W'))+
      stat(result.mode==='time'?'Tiempo del cursor':result.mode==='ac'?'Frecuencia':'Referencia',result.mode==='time'?circuitNumber(frame.time,'s'):result.mode==='ac'?circuitNumber(this.model.settings.frequency,'Hz'):'GND');
    this.$('#circuit-readings').innerHTML=`<table><thead><tr><th>Componente</th><th>Voltaje</th><th>Corriente</th><th>Potencia</th></tr></thead><tbody>${parts.map(p=>{
      const value=frame.values[p.id];
      const name=`<button type="button" class="reading-part" data-reading="${p.id}">${circuitEscape(p.label)}</button>`;
      if(!value) return row([name,'—','—','—']);
      return row([name,this.pairText(value.voltage,'V'),this.pairText(value.current,'A'),circuitNumber(value.power,'W')]);
    }).join('')}</tbody></table>`;
    this.$('#circuit-readings').querySelectorAll('[data-reading]').forEach(button=>button.onclick=()=>this.select({kind:'part',id:button.dataset.reading}));
    this.$('#circuit-nodes').innerHTML=`<table><thead><tr><th>Nodo</th><th>Potencial</th></tr></thead><tbody>${Object.entries(frame.voltages).map(([name,value])=>row([name,value?this.pairText(value,'V'):'Flotante'])).join('')}</tbody></table>`;
    const cursor=this.$('#scope-cursor-value');
    if(cursor) cursor.textContent=circuitNumber(frame.time,'s');
    this.drawScope();
  }

  drawScope() {
    const canvas=this.$('#circuit-scope');
    if(!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    const width=canvas.clientWidth,height=canvas.clientHeight,ratio=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)) {
      canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    }
    const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
    c.fillStyle='#0b1425';c.fillRect(0,0,width,height);
    c.font='11px Segoe UI';c.textBaseline='middle';
    const result=this.result,frame=result?.frames[this.sample];
    const label=(value,x,y,color='#a8bad7',align='left')=>{c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y);};
    if(this.model.settings.mode==='dc'&&this.dcPlot==='ohm') {
      this.drawOhm(c,width,height,label,frame);
      return;
    }
    if(!frame) {label('Esperando una solución',width/2,height/2,'#a8bad7','center');return;}
    const {mode}=result;
    const accent='#86dcff';
    if(mode==='dc') {
      const nodes=Object.entries(frame.voltages).filter(([,v])=>v!==null).slice(0,8);
      const maximum=Math.max(1e-15,...nodes.map(([,v])=>Math.abs(v[0])));
      const center=width/2,rowHeight=(height-38)/Math.max(1,nodes.length);
      c.strokeStyle='#4b6083';c.beginPath();c.moveTo(center,14);c.lineTo(center,height-16);c.stroke();
      nodes.forEach(([name,v],index)=>{
        const length=v[0]/maximum*Math.max(25,width/2-76),y=16+(index+.5)*rowHeight;
        c.fillStyle=length<0?'#c1aaff':accent;c.fillRect(Math.min(center,center+length),y-5,Math.abs(length)||1,10);
        label(name,12,y);label(circuitNumber(v[0],'V'),width-12,y,'#dce9fc','right');
      });
      return;
    }
    const measurement=frame.values[this.probe];
    if(!measurement) {label('Elige un componente conectado',width/2,height/2,'#a8bad7','center');return;}
    const unit=this.quantity==='voltage'?'V':'A';
    const duration=mode==='ac'?1/this.model.settings.frequency:this.model.settings.duration;
    let points;
    if(mode==='ac') {
      const [re,im]=measurement[this.quantity];
      points=Array.from({length:141},(_,i)=>{const k=i/140,a=2*Math.PI*k;return [duration*k,re*Math.cos(a)-im*Math.sin(a)];});
    } else points=result.frames.map(sample=>[sample.time,sample.values[this.probe][this.quantity][0]]);
    const values=points.map(point=>point[1]);
    const low=Math.min(0,...values),high=Math.max(0,...values),range=high-low||1;
    const left=57,right=width-14,top=15,bottom=height-30;
    const x=t=>left+t/duration*(right-left),y=value=>bottom-(value-low)/range*(bottom-top);
    for(let i=0;i<=4;i++) {
      const py=top+i*(bottom-top)/4;
      c.strokeStyle='#223551';c.beginPath();c.moveTo(left,py);c.lineTo(right,py);c.stroke();
      label(circuitNumber(high-i*range/4,unit,2),left-7,py,'#a8bad7','right');
    }
    for(let i=0;i<=4;i++) {
      const px=left+i*(right-left)/4;
      c.strokeStyle='#223551';c.beginPath();c.moveTo(px,top);c.lineTo(px,bottom);c.stroke();
      if(width>320||i%2===0) label(circuitNumber(duration*i/4,'s',2),px,bottom+14,'#a8bad7',i===4?'right':'center');
    }
    c.beginPath();points.forEach(([t,v],i)=>i?c.lineTo(x(t),y(v)):c.moveTo(x(t),y(v)));
    c.strokeStyle=accent;c.lineWidth=2.2;c.stroke();
    if(mode==='time') {
      const px=x(frame.time),py=y(measurement[this.quantity][0]);
      c.strokeStyle='#d0baff';c.setLineDash([4,4]);c.beginPath();c.moveTo(px,top);c.lineTo(px,bottom);c.stroke();c.setLineDash([]);
      c.fillStyle='#e2d3ff';c.beginPath();c.arc(px,py,4,0,2*Math.PI);c.fill();
    }
  }

  drawOhm(context,width,height,label,frame) {
    const part=this.model.parts.find(item=>item.id===this.probe);
    if(!part){label('Añade una resistencia para ver I = V/R',width/2,height/2,'#a8bad7','center');return;}
    const limit=this.sweepVoltage,maxCurrent=limit/part.value;
    const l=57,r=width-12,t=19,b=height-29;
    const x=value=>l+(value+limit)/(2*limit)*(r-l);
    const y=value=>b-(value+maxCurrent)/(2*maxCurrent)*(b-t);
    for(const ratio of [-1,0,1]) {
      const px=x(limit*ratio),py=y(maxCurrent*ratio);
      context.strokeStyle=ratio===0?'#547094':'#273b5b';
      context.beginPath();context.moveTo(px,t);context.lineTo(px,b);context.moveTo(l,py);context.lineTo(r,py);context.stroke();
      label(circuitNumber(limit*ratio,'V',2),px,b+13,'#a8bad7',ratio===1?'right':ratio===0?'center':'left');
      label(circuitNumber(maxCurrent*ratio,'A',2),l-6,py,'#a8bad7','right');
    }
    context.beginPath();context.moveTo(l,b);context.lineTo(r,t);context.strokeStyle='#86dcff';context.lineWidth=2.2;context.stroke();
    const value=frame?.values[part.id];
    if(value && Math.abs(value.voltage[0])<=limit) {
      context.beginPath();context.arc(x(value.voltage[0]),y(value.current[0]),4,0,2*Math.PI);
      context.fillStyle='#e2d3ff';context.fill();
    }
    label(`R = ${circuitNumber(part.value,'Ω')}`,l+7,t+7,'#c0d9f5');
  }

  exportData() {
    if(!this.result){this.message('Resuelve el circuito para exportar mediciones.');return;}
    const columns=['modo','t_s','componente','voltaje_real_V','voltaje_imag_V','corriente_real_A','corriente_imag_A','potencia_W'];
    const mode=this.model.settings.mode;
    const csvCell=value=>typeof value==='string'?`"${(/^[=+\-@]/.test(value)?"'":"")+value.replace(/"/g,'""')}"`:String(value);
    const rows=[columns.join(';')];
    for(const frame of this.result.frames) {
      for(const [id,m] of Object.entries(frame.values)) {
        rows.push([mode,frame.time,this.valueName(id),...m.voltage,...m.current,m.power].map(csvCell).join(';'));
      }
    }
    this.download('\uFEFF'+rows.join('\n'),'mediciones-circuito.csv','text/csv;charset=utf-8');
  }

  download(data,filename,mime) {
    const url=URL.createObjectURL(new Blob([data],{type:mime}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
