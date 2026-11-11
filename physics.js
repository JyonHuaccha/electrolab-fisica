/* Núcleo físico en SI. Sin dependencias; compartido por la interfaz y las pruebas. */
(function(root,factory){const p=factory();if(typeof module==='object')module.exports=p;else root.Physics=p;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS0=8.8541878128e-12,K=1/(4*Math.PI*EPS0),MU0=4*Math.PI*1e-7;
  const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]);
  const mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function electric(charges,p,cutoff=0.075){
    let E=[0,0,0],V=0;
    for(const c of charges){if(c.q===0)continue;const r=sub(p,c.p),d=norm(r);if(d<cutoff)return {E:null,V:null,singular:true};E=add(E,mul(r,K*c.q/(d*d*d)));V+=K*c.q/d;}
    return {E,V,singular:false};
  }
  function capacitor(A,d,k,V,insertion=1){if(A<=0||d<=0||k<1||insertion<0||insertion>1)throw Error('Área y separación positivas; κ ≥ 1; inserción entre 0 y 1.');const C=EPS0*(1+(k-1)*insertion)*A/d,Q=C*V;return {C,Q,U:.5*C*V*V,E:V/d};}
  function network(R,V,type){
    if(!R.length||R.some(x=>!(x>0)))throw Error('Resistencias positivas.');
    const parallel=xs=>1/xs.reduce((s,x)=>s+1/x,0);
    const req=type==='series'?R.reduce((s,x)=>s+x,0):type==='parallel'?parallel(R):R[0]+parallel(R.slice(1));
    const I=V/req,vs=type==='series'?R.map(r=>I*r):type==='parallel'?R.map(()=>V):[I*R[0],...R.slice(1).map(()=>V-I*R[0])];
    return {req,I,P:V*I,rows:R.map((r,i)=>({R:r,V:vs[i],I:vs[i]/r,P:vs[i]**2/r}))};
  }
  function rc(R,C,V,t,discharge=false){const tau=R*C,e=Math.exp(-t/tau),vc=V*(discharge?e:1-e);return {tau,V:vc,Q:C*vc,I:(discharge?-1:1)*V/R*e,U:.5*C*vc*vc};}
  // Exact RC response from arbitrary initial charge. An open switch has R = Infinity.
  function capacitorTransient(C, R, source, initialCharge, t) {
    const initialVoltage = initialCharge / C;
    const tau = R * C;
    const difference = source - initialVoltage;
    const progress = -Math.expm1(-t / tau);
    const transferred = C * difference * progress;
    const Q = initialCharge + transferred;
    const V = Q / C;
    const heat = .5 * C * difference ** 2 * -Math.expm1(-2 * t / tau);
    return {Q, V, U: .5 * Q * V, I: difference * Math.exp(-t / tau) / R,
      tau, heat, supplied: source * transferred};
  }
  function wire(p,I,cutoff=.08){const r2=p[0]**2+p[1]**2;if(r2<cutoff**2)return null;return mul([-p[1],p[0],0],MU0*I/(2*Math.PI*r2));}
  function dipole(p,m,cutoff=.30){const r=norm(p);if(r<cutoff)return null;const n=mul(p,1/r);return mul(sub(mul(n,3*dot(m,n)),m),MU0/(4*Math.PI*r**3));}
  function force(q,v,E,B){return mul(add(E,cross(v,B)),q);}
  function magneticFlux(field, areaVector) {
    return dot(field, areaVector);
  }
  function conductorForce(current, lengthVector, field) {
    return mul(cross(lengthVector, field), current);
  }
  function currentLoop(current, turns, areaVector, field) {
    const moment = mul(areaVector, turns * current);
    return {moment, torque: cross(moment, field), energy: -dot(moment, field)};
  }
  function rotorStep(angle,omega,inertia,damping,dt,torque,maximumTorque) {
    const steps=Math.max(1,Math.ceil(dt/Math.min(.003,.05/Math.sqrt(Math.max(maximumTorque/inertia,1)))));
    const h=dt/steps;
    for(let i=0;i<steps;i++) {
      omega=(omega+torque(angle)*h/inertia)/(1+damping*h/inertia);
      angle+=omega*h;
    }
    return {angle,omega};
  }
  // I en x, B en y y diferencia de potencial V(+z) − V(−z).
  function hallVoltage(current, fieldY, thickness, density, carrierCharge) {
    return current * fieldY / (density * carrierCharge * thickness);
  }
  // Boris simétrico: deriva media, impulso E/2, rotación B, impulso E/2, deriva media.
  function step(state,q,m,dt,field){
    const half=add(state.p,mul(state.v,dt/2)),f=field(half);if(!f||!f.E||!f.B)return null;
    const vm=add(state.v,mul(f.E,q*dt/(2*m))),t=mul(f.B,q*dt/(2*m)),s=mul(t,2/(1+dot(t,t)));
    const vp=add(vm,cross(vm,t)),v=add(add(vm,cross(vp,s)),mul(f.E,q*dt/(2*m)));
    return {p:add(half,mul(v,dt/2)),v};
  }
  function trace(seed,field,sign=1,h=.065,steps=320){let p=seed.slice(),out=[p];for(let i=0;i<steps;i++){
    const a=field(p);if(!a||norm(a)<1e-18)break;const mid=add(p,mul(a,sign*h/(2*norm(a)))),b=field(mid);if(!b||norm(b)<1e-18)break;
    p=add(p,mul(b,sign*h/norm(b)));if(norm(p)>7)break;out.push(p);
  }return out;}
  // Marching tetrahedra: intersección lineal de un nivel de potencial en cada tetraedro.
  function isosurface(charges,level,n=15,bound=3.2){
    const points=[],vals=[],id=(i,j,k)=>(i*(n+1)+j)*(n+1)+k;
    for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)for(let k=0;k<=n;k++){const p=[i,j,k].map(x=>-bound+2*bound*x/n);points.push(p);vals.push(electric(charges,p).V);}
    const cache=new Map(),triangles=[],corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
      const ix=corners.map(c=>id(i+c[0],j+c[1],k+c[2]));
      for(const tet of tets){const ids=tet.map(t=>ix[t]);if(ids.some(t=>vals[t]===null))continue;const cuts=[];
        for(const [a,b] of edges){const ia=ids[a],ib=ids[b],va=vals[ia],vb=vals[ib];if((va<level)===(vb<level))continue;const key=[Math.min(ia,ib),Math.max(ia,ib)].join(':');if(!cache.has(key)){let lo=0,hi=1;const delta=sub(points[ib],points[ia]);for(let iter=0;iter<9;iter++){const mid=(lo+hi)/2,v=electric(charges,add(points[ia],mul(delta,mid))).V;if(v===null)break;if((v<level)===(va<level))lo=mid;else hi=mid;}cache.set(key,add(points[ia],mul(delta,(lo+hi)/2)));}cuts.push(cache.get(key));}
        if(cuts.length===3)triangles.push(cuts);if(cuts.length===4)triangles.push([cuts[0],cuts[1],cuts[2]],[cuts[1],cuts[3],cuts[2]]);
      }
    }return triangles;
  }
  return {EPS0,K,MU0,add,sub,mul,dot,norm,cross,electric,capacitor,network,rc,capacitorTransient,wire,dipole,force,magneticFlux,conductorForce,currentLoop,rotorStep,hallVoltage,step,trace,isosurface};
});
