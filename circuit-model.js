/* Linear lumped-element analysis. Values and time are in SI units. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object') module.exports = model;
  else root.CircuitModel = model;
})(globalThis, function () {
  'use strict';

  const types = {
    R: {name:'Resistencia', unit:'Ω', scale:1, value:1000},
    C: {name:'Capacitor', unit:'µF', scale:1e-6, value:0.0001},
    L: {name:'Inductor', unit:'mH', scale:1e-3, value:0.01},
    V: {name:'Fuente de voltaje', unit:'V', scale:1, value:12, source:true},
    I: {name:'Fuente de corriente', unit:'mA', scale:1e-3, value:0.01, source:true},
    S: {name:'Interruptor', unit:'Ω', scale:1, value:0.05},
    G: {name:'Tierra', single:true},
    J: {name:'Unión', single:true}
  };
  const maxParts = 48;
  const maxWires = 160;
  const pins = part => types[part.type].single ? [`${part.id}:0`] : [`${part.id}:0`,`${part.id}:1`];
  const between = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

  function part(type, id, x, y, label) {
    const spec = types[type];
    return {type,id,x,y,label,rotation:0,value:spec.value ?? 0,closed:true,signal:'constant',
      amplitude:type==='I'?.01:1, frequency:50, phase:0, duty:50, initial:0};
  }

  function normalize(input) {
    if (!input || !Array.isArray(input.parts) || !Array.isArray(input.wires)) throw new Error('El archivo debe contener componentes y conexiones.');
    if (input.parts.length > maxParts || input.wires.length > maxWires) throw new Error(`El límite es de ${maxParts} componentes y ${maxWires} cables.`);
    const ids = new Set();
    const parts = input.parts.map(raw => {
      if (!raw || !Object.hasOwn(types,raw.type) || typeof raw.id !== 'string' || !/^[a-zA-Z0-9_-]{1,36}$/.test(raw.id) || ids.has(raw.id)) {
        throw new Error('Hay un componente sin identificador válido o repetido.');
      }
      ids.add(raw.id);
      const base = part(raw.type,raw.id,0,0,raw.type);
      const spec = types[raw.type];
      const range = spec.source ? [-1e6,1e6] : raw.type==='C' || raw.type==='L' ? [1e-12,1e3] : [1e-6,1e10];
      return {...base,
        label:typeof raw.label==='string' && raw.label.trim() ? raw.label.trim().slice(0,22) : base.label,
        x:between(raw.x,-2500,2500,0), y:between(raw.y,-2500,2500,0),
        rotation:((Math.round(between(raw.rotation,-1e6,1e6,0)/90)*90)%360+360)%360,
        value:spec.single ? 0 : between(raw.value,...range,base.value),
        amplitude:between(raw.amplitude,0,1e6,base.amplitude),
        frequency:between(raw.frequency,.001,1e8,50),
        phase:between(raw.phase,-360,360,0), duty:between(raw.duty,1,99,50),
        initial:between(raw.initial,-1e6,1e6,0), closed:raw.closed!==false,
        signal:['constant','step','sine','pulse'].includes(raw.signal) ? raw.signal : 'constant'
      };
    });
    const terminals = new Set(parts.flatMap(pins));
    const pairs = new Set();
    const wires = input.wires.map((wire,index) => {
      if (!wire || !terminals.has(wire.a) || !terminals.has(wire.b) || wire.a===wire.b) throw new Error('Un cable tiene un borne inexistente o conecta un borne consigo mismo.');
      const pair = [wire.a,wire.b].sort().join('|');
      if (pairs.has(pair)) throw new Error('Hay dos cables entre los mismos bornes.');
      pairs.add(pair);
      const normalized={id:`w${index+1}`,a:wire.a,b:wire.b};
      if(wire.points!==undefined) {
        if(!Array.isArray(wire.points)||wire.points.length>64||wire.points.some(point=>
          !Array.isArray(point)||point.length!==2||point.some(value=>!Number.isFinite(value)||Math.abs(value)>2500))) {
          throw new Error('El recorrido de un cable debe tener hasta 64 puntos con coordenadas entre −2500 y 2500.');
        }
        if(wire.points.length) normalized.points=wire.points.map(point=>[...point]);
      }
      return normalized;
    });
    const config = input.settings ?? {};
    const settings = {
      mode:['dc','ac','time'].includes(config.mode) ? config.mode : 'dc',
      frequency:between(config.frequency,.001,1e8,1000),
      duration:between(config.duration,.000001,1000,.5),
      samples:Math.round(between(config.samples,40,900,240))
    };
    return {version:1,parts,wires,settings};
  }

  function nets(circuit) {
    const parent = new Map(circuit.parts.flatMap(pins).map(pin => [pin,pin]));
    function root(pin) {
      if (parent.get(pin) !== pin) parent.set(pin,root(parent.get(pin)));
      return parent.get(pin);
    }
    function join(a,b) {parent.set(root(a),root(b));}
    for (const wire of circuit.wires) join(wire.a,wire.b);
    const grounds = circuit.parts.filter(p => p.type==='G');
    for (const p of grounds.slice(1)) join(pins(grounds[0])[0],pins(p)[0]);
    const reference = grounds.length ? root(pins(grounds[0])[0]) : null;
    const byPin = Object.fromEntries([...parent.keys()].map(pin => [pin,root(pin)]));
    return {byPin,reference};
  }

  // Scaled partial pivoting is used once per matrix, including a whole transient run.
  function factor(matrix) {
    const n = matrix.length;
    const scale = matrix.map(row => Math.max(...row.map(Math.abs)));
    const permutation = Array.from({length:n},(_,i)=>i);
    for (let i=0;i<n;i++) {
      let pivot = i;
      for (let j=i+1;j<n;j++) {
        if (Math.abs(matrix[j][i])/(scale[j]||1) > Math.abs(matrix[pivot][i])/(scale[pivot]||1)) pivot=j;
      }
      if (Math.abs(matrix[pivot][i]) <= 1e-13*(scale[pivot]||1)) {
        throw new Error('El circuito no tiene una solución única. Revisa fuentes ideales en paralelo, cortocircuitos o lazos de inductores en CC.');
      }
      [matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];
      [scale[i],scale[pivot]]=[scale[pivot],scale[i]];
      [permutation[i],permutation[pivot]]=[permutation[pivot],permutation[i]];
      for (let j=i+1;j<n;j++) {
        matrix[j][i] /= matrix[i][i];
        for (let k=i+1;k<n;k++) matrix[j][k] -= matrix[j][i]*matrix[i][k];
      }
    }
    return rhs => {
      const x = permutation.map(i => rhs[i]);
      for (let i=0;i<n;i++) for (let j=0;j<i;j++) x[i]-=matrix[i][j]*x[j];
      for (let i=n-1;i>=0;i--) {
        for (let j=i+1;j<n;j++) x[i]-=matrix[i][j]*x[j];
        x[i]/=matrix[i][i];
      }
      return x;
    };
  }

  const sum = ([ar,ai],[br,bi]) => [ar+br,ai+bi];
  const minus = ([ar,ai],[br,bi]) => [ar-br,ai-bi];
  const times = ([ar,ai],[br,bi]) => [ar*br-ai*bi,ar*bi+ai*br];
  const magnitude = pair => Math.hypot(...pair);
  const phase = ([real,imag]) => Math.atan2(imag,real)*180/Math.PI;
  const zero = () => [0,0];

  function source(p, mode, t) {
    const angle = p.phase*Math.PI/180;
    if (mode==='ac') return [p.amplitude*Math.cos(angle),p.amplitude*Math.sin(angle)];
    if (mode==='dc' || p.signal==='constant') return [p.value,0];
    if (p.signal==='step') return [p.value+p.amplitude,0];
    if (p.signal==='sine') return [p.value+p.amplitude*Math.sin(2*Math.PI*p.frequency*t+angle),0];
    const cycles = t*p.frequency+p.phase/360;
    return [p.value+(cycles-Math.floor(cycles)<p.duty/100?p.amplitude:0),0];
  }

  function isOpen(p, mode) {
    return (p.type==='S' && !p.closed) || (p.type==='C' && mode==='dc');
  }

  function analyze(input) {
    const circuit = normalize(input);
    const {mode,frequency,duration,samples} = circuit.settings;
    const {byPin,reference} = nets(circuit);
    if (reference===null) throw new Error('Coloca una tierra y conéctala al nodo de referencia del circuito.');
    const components = circuit.parts.filter(p => !types[p.type].single).map(p => {
      const [a,b] = pins(p).map(pin => byPin[pin]);
      return {...p,a,b};
    });
    const reachable = new Set([reference]);
    // Current sources prescribe current, so they do not fix the relative voltage of floating nodes.
    let changed;
    do {
      changed=false;
      for (const p of components) {
        if (p.type==='I' || isOpen(p,mode) || reachable.has(p.a)===reachable.has(p.b)) continue;
        reachable.add(p.a); reachable.add(p.b); changed=true;
      }
    } while (changed);

    const nodes = [...new Set(Object.values(byPin))];
    const names = new Map([[reference,'GND']]);
    nodes.filter(node=>node!==reference).forEach((node,i)=>names.set(node,`N${i+1}`));
    const activeNodes = [...reachable].filter(node=>node!==reference);
    const nodeIndex = new Map(activeNodes.map((node,i)=>[node,i]));
    const ideal = components.filter(p => reachable.has(p.a) && reachable.has(p.b) && (p.type==='V' || (p.type==='L' && mode==='dc')));
    if (ideal.some(p=>p.a===p.b)) throw new Error('Una fuente ideal de voltaje o un inductor en CC tiene sus dos bornes en el mismo nodo.');
    const idealIndex = new Map(ideal.map((p,i)=>[p.id,activeNodes.length+i]));
    const dimension = activeNodes.length+ideal.length;
    const complex = mode==='ac';
    const size = complex?dimension*2:dimension;
    const matrix = Array.from({length:size},()=>new Float64Array(size));
    const dt = duration/samples;
    const omega = 2*Math.PI*frequency;
    const active = [];
    for (const p of components) {
      if (!reachable.has(p.a) || !reachable.has(p.b)) continue;
      const a=nodeIndex.get(p.a), b=nodeIndex.get(p.b), extra=idealIndex.get(p.id);
      let admittance=zero();
      if (p.type==='R' || (p.type==='S' && p.closed)) admittance=[1/p.value,0];
      if (p.type==='C' && mode==='ac') admittance=[0,omega*p.value];
      if (p.type==='C' && mode==='time') admittance=[p.value/dt,0];
      if (p.type==='L' && mode==='ac') admittance=[0,-1/(omega*p.value)];
      if (p.type==='L' && mode==='time') admittance=[dt/p.value,0];
      active.push({...p,a,b,extra,admittance});
      const stamp=(row,col,real,imag=0)=>{
        if (row===undefined || col===undefined) return;
        matrix[row][col]+=real;
        if (complex) {
          matrix[row+dimension][col+dimension]+=real;
          matrix[row][col+dimension]-=imag;
          matrix[row+dimension][col]+=imag;
        }
      };
      if (extra!==undefined) {
        stamp(a,extra,1); stamp(b,extra,-1); stamp(extra,a,1); stamp(extra,b,-1);
      } else {
        const [g,k]=admittance;
        stamp(a,a,g,k); stamp(b,b,g,k); stamp(a,b,-g,-k); stamp(b,a,-g,-k);
      }
    }

    const solve = factor(matrix);
    const history = new Map(components.map(p=>[p.id,p.initial]));
    const frames=[];
    for (let i=0;i<(mode==='time'?samples:1);i++) {
      const time=mode==='time'?(i+1)*dt:0;
      const rhs=new Float64Array(size);
      const currents=new Map();
      const addRhs=(index,value,sign=1)=>{
        if(index===undefined) return;
        rhs[index]+=sign*value[0];
        if(complex) rhs[index+dimension]+=sign*value[1];
      };
      for (const p of active) {
        if (p.extra!==undefined) {
          addRhs(p.extra,p.type==='V'?source(p,mode,time):zero());
          continue;
        }
        let fixed=p.type==='I'?source(p,mode,time):zero();
        if (mode==='time' && p.type==='C') fixed=[-p.admittance[0]*history.get(p.id),0];
        if (mode==='time' && p.type==='L') fixed=[history.get(p.id),0];
        currents.set(p.id,fixed);
        addRhs(p.a,fixed,-1); addRhs(p.b,fixed);
      }
      const x=solve(rhs);
      const at=index=>index===undefined?zero():[x[index],complex?x[index+dimension]:0];
      const values=Object.create(null);
      for (const p of active) {
        const voltage=minus(at(p.a),at(p.b));
        const current=p.extra===undefined?sum(times(p.admittance,voltage),currents.get(p.id)):at(p.extra);
        const power=(voltage[0]*current[0]+voltage[1]*current[1])*(complex?.5:1);
        values[p.id]={voltage,current,power};
        if (mode==='time' && p.type==='C') history.set(p.id,voltage[0]);
        if (mode==='time' && p.type==='L') history.set(p.id,current[0]);
      }
      const voltages=Object.fromEntries(nodes.map(node=>[names.get(node),reachable.has(node)?at(nodeIndex.get(node)):null]));
      frames.push({time,values,voltages});
    }
    const floating = nodes.length-reachable.size;
    return {mode,frames,floating,grounded:reachable.size,nodes:nodes.length,
      netNames:Object.fromEntries(Object.entries(byPin).map(([pin,node])=>[pin,names.get(node)]))};
  }

  function capacitorTimeConstant(input,id) {
    const circuit=normalize(input),capacitor=circuit.parts.find(p=>p.id===id&&p.type==='C');
    if(!capacitor) return null;
    // A one-ampere test source measures the resistance seen by C with the independent sources deactivated.
    const parts=circuit.parts.map(p=>p===capacitor?{...p,type:'I',value:1}:types[p.type].source?{...p,value:0}:p);
    try {
      const result=analyze({...circuit,parts,settings:{...circuit.settings,mode:'dc'}});
      const voltage=result.frames[0].values[id]?.voltage[0];
      const resistance=-voltage;
      return Number.isFinite(resistance)&&resistance>1e-12?resistance*capacitor.value:null;
    } catch {return null;}
  }

  function energyFrame(circuit, result, sample, angle=null) {
    const frame=result?.frames[sample];
    if(!frame) return null;
    const ac=result.mode==='ac';
    const instant=ac && angle!==null;
    const wave=([real,imag])=>instant?real*Math.cos(angle)-imag*Math.sin(angle):real;
    const square=pair=>ac&&!instant?magnitude(pair)**2/2:wave(pair)**2;
    const totals={source:0,heat:0,stored:0};
    const parts=Object.create(null);
    for(const p of circuit.parts) {
      const value=frame.values[p.id];
      if(!value) continue;
      const current=wave(value.current);
      const power=instant?wave(value.voltage)*current:value.power;
      const energy=p.type==='C'?.5*p.value*square(value.voltage):p.type==='L'?.5*p.value*square(value.current):0;
      if(types[p.type].source) totals.source-=power;
      if(p.type==='R'||p.type==='S') totals.heat+=power;
      totals.stored+=energy;
      parts[p.id]={current,power,energy};
    }
    return {parts,totals};
  }

  // On a bridge edge, KCL uniquely determines current even when other wires form a loop.
  // Currents in a cycle of ideal wires are undetermined and intentionally omitted.
  function wireCurrents(circuit, values) {
    const graph=new Map(circuit.parts.flatMap(pins).map(pin=>[pin,[]]));
    const injection=new Map();
    const grounds=circuit.parts.filter(p=>p.type==='G');
    const edges=[...circuit.wires,...grounds.slice(1).map((g,i)=>({id:`ground-${i}`,a:pins(grounds[0])[0],b:pins(g)[0],virtual:true}))];
    for(const edge of edges) {
      graph.get(edge.a).push(edge);graph.get(edge.b).push(edge);
    }
    for(const p of circuit.parts) {
      if(!values[p.id]) continue;
      const [a,b]=pins(p),{current}=values[p.id];
      injection.set(a,-current);injection.set(b,current);
    }
    const entry=new Map(), result=Object.create(null);
    function visit(pin,parent=null) {
      const order=entry.size;
      entry.set(pin,order);
      let low=order, net=injection.get(pin)??0;
      for(const edge of graph.get(pin)) {
        if(edge===parent) continue;
        const next=pin===edge.a?edge.b:edge.a;
        if(entry.has(next)) {low=Math.min(low,entry.get(next));continue;}
        const branch=visit(next,edge);
        low=Math.min(low,branch.low);net+=branch.net;
        if(branch.low>order && !edge.virtual) result[edge.id]=pin===edge.a?-branch.net:branch.net;
      }
      return {low,net};
    }
    for(const pin of graph.keys()) if(!entry.has(pin)) visit(pin);
    return result;
  }

  return {types,maxParts,maxWires,pins,part,normalize,analyze,magnitude,phase,energyFrame,wireCurrents,capacitorTimeConstant};
});
