'use strict';

class CircuitBoard {
  constructor(canvas, actions) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.actions = actions;
    this.zoom = 1;
    this.origin = [0,0];
    this.ready = false;
    this.pointer = null;
    this.drag = null;
    this.palette = ['#65d8ff','#a89cff','#ffbc7a','#6ee8c2','#f4a9d3','#b5d5fe'];
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', event => this.down(event));
    canvas.addEventListener('pointermove', event => this.move(event));
    canvas.addEventListener('pointerup', event => this.up(event));
    canvas.addEventListener('pointercancel', () => this.cancel());
    canvas.addEventListener('pointerleave', () => {if(!this.drag){this.pointer=null;this.draw();}});
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.changeZoom(Math.exp(-event.deltaY*.0015), this.screenPoint(event));
    }, {passive:false});
  }

  resize() {
    const {clientWidth:width,clientHeight:height}=this.canvas;
    if(!width || !height) return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    const oldWidth=this.width,oldHeight=this.height;
    this.width=width; this.height=height; this.ratio=ratio;
    this.canvas.width=Math.round(width*ratio);
    this.canvas.height=Math.round(height*ratio);
    if(!this.ready) this.fit();
    else {
      this.origin[0]+=(width-oldWidth)/2;
      this.origin[1]+=(height-oldHeight)/2;
      this.draw();
    }
  }

  fit() {
    if(!this.width || !this.height) {this.ready=false;return;}
    const {parts,wires}=this.actions.state().model;
    const anchors=wires.flatMap(wire=>wire.points??[]);
    const xs=[...parts.map(p=>p.x),...anchors.map(p=>p[0])],ys=[...parts.map(p=>p.y),...anchors.map(p=>p[1])];
    const minX=xs.length?Math.min(...xs)-80:0, maxX=xs.length?Math.max(...xs)+80:690;
    const minY=ys.length?Math.min(...ys)-80:0, maxY=ys.length?Math.max(...ys)+80:420;
    this.zoom=Math.max(.17,Math.min(1.5,(this.width-34)/(maxX-minX),(this.height-28)/(maxY-minY)));
    this.origin=[this.width/2-(minX+maxX)/2*this.zoom,this.height/2-(minY+maxY)/2*this.zoom];
    this.ready=true;
    this.draw();
  }

  changeZoom(factor, anchor=[this.width/2,this.height/2]) {
    if(!this.ready) return;
    const world=this.worldPoint(anchor);
    this.zoom=Math.max(.16,Math.min(3,this.zoom*factor));
    this.origin=anchor.map((value,i)=>value-world[i]*this.zoom);
    this.draw();
  }

  screenPoint(event) {
    const rect=this.canvas.getBoundingClientRect();
    return [event.clientX-rect.left,event.clientY-rect.top];
  }

  worldPoint(point) {return point.map((value,i)=>(value-this.origin[i])/this.zoom);}

  position(part, index) {
    if(part.type==='J') return {x:part.x,y:part.y,dx:0,dy:0};
    if(part.type==='G') return {x:part.x,y:part.y-22,dx:0,dy:-1};
    const direction=index===0?-1:1;
    const angle=part.rotation*Math.PI/180;
    const dx=direction*Math.round(Math.cos(angle)),dy=direction*Math.round(Math.sin(angle));
    return {x:part.x+48*dx,y:part.y+48*dy,dx,dy};
  }

  terminals(parts) {
    return Object.fromEntries(parts.flatMap(part=>CircuitModel.pins(part).map((pin,index)=>[pin,this.position(part,index)])));
  }

  wirePoints(a,b,waypoints=[],manual=false) {
    if(manual || waypoints.length) {
      const points=[[a.x,a.y]];
      let horizontal=!!a.dx;
      const append=point=>{
        const last=points[points.length-1];
        if(point[0]!==last[0]||point[1]!==last[1]) points.push([...point]);
      };
      const segment=point=>{
        const last=points[points.length-1];
        const corner=horizontal?[point[0],last[1]]:[last[0],point[1]];
        append(corner);append(point);
        if(points.length>1) {
          const tail=points[points.length-2];
          horizontal=tail[1]===point[1];
        }
      };
      append([a.x+24*(a.dx||0),a.y+24*(a.dy||0)]);
      for(const point of waypoints) segment(point);
      const approach=[b.x+24*(b.dx||0),b.y+24*(b.dy||0)];
      if(b.dx) horizontal=false;
      if(b.dy) horizontal=true;
      segment(approach);append([b.x,b.y]);
      return points;
    }
    if(a.x===b.x || a.y===b.y) return [[a.x,a.y],[b.x,b.y]];
    if(!a.dx && !a.dy && b.dx) return [[a.x,a.y],[a.x,b.y],[b.x,b.y]];
    if(!a.dx && !a.dy && b.dy) return [[a.x,a.y],[b.x,a.y],[b.x,b.y]];
    if(a.dy && !b.dy) return [[a.x,a.y],[a.x,b.y],[b.x,b.y]];
    if(a.dx && !b.dx) return [[a.x,a.y],[b.x,a.y],[b.x,b.y]];
    if(a.dy && b.dy) {
      const y=(a.y+b.y)/2;
      return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];
    }
    const x=(a.x+b.x)/2;
    return [[a.x,a.y],[x,a.y],[x,b.y],[b.x,b.y]];
  }

  hit(point) {
    const {model}=this.actions.state();
    const terminals=this.terminals(model.parts);
    const radius=14/this.zoom;
    let pinHit=null,nearest=radius;
    for(const [pin,p] of Object.entries(terminals)) {
      const distance=Math.hypot(point[0]-p.x,point[1]-p.y);
      if(distance<nearest){pinHit=pin;nearest=distance;}
    }
    if(pinHit) return {kind:'pin',id:pinHit};
    const selection=this.actions.state().selected;
    const selectedWire=selection?.kind==='wire'?model.wires.find(w=>w.id===selection.id):null;
    const anchor=selectedWire?.points?.findIndex(p=>Math.hypot(point[0]-p[0],point[1]-p[1])<10/this.zoom);
    if(anchor>=0) return {kind:'waypoint',id:selectedWire.id,index:anchor};
    for(const p of [...model.parts].reverse()) {
      if(Math.hypot(point[0]-p.x,point[1]-p.y)<Math.max(25,11/this.zoom)) return {kind:'part',id:p.id};
    }
    for(const w of [...model.wires].reverse()) {
      const points=this.wirePoints(terminals[w.a],terminals[w.b],w.points);
      for(let i=1;i<points.length;i++) {
        const [x,y]=points[i-1],[u,v]=points[i];
        const dx=u-x,dy=v-y;
        const t=Math.min(1,Math.max(0,((point[0]-x)*dx+(point[1]-y)*dy)/(dx*dx+dy*dy||1)));
        if(Math.hypot(point[0]-x-t*dx,point[1]-y-t*dy)<8/this.zoom) return {kind:'wire',id:w.id};
      }
    }
    return null;
  }

  down(event) {
    if(event.button!==0 && event.button!==1) return;
    this.canvas.setPointerCapture(event.pointerId);
    const screen=this.screenPoint(event),point=this.worldPoint(screen),hit=this.hit(point);
    this.pointer=point;
    if(event.button===0 && this.actions.state().pending) {
      this.drag={kind:'route',screen,moved:false};
    } else if(event.button===1 || !hit) {
      this.drag={kind:'pan',screen,origin:[...this.origin],moved:false};
    } else if(hit.kind==='pin') {
      this.drag={kind:'pin',pin:hit.id,screen,moved:false};
    } else if(hit.kind==='part') {
      this.actions.select(hit);
      const part=this.actions.state().model.parts.find(p=>p.id===hit.id);
      this.drag={kind:'part',part,point,original:[part.x,part.y],moved:false};
    } else if(hit.kind==='waypoint') {
      const wire=this.actions.state().model.wires.find(w=>w.id===hit.id);
      this.drag={kind:'waypoint',wire,index:hit.index,original:wire.points.map(point=>[...point]),point,moved:false};
    } else {
      this.actions.select(hit);
    }
    this.draw();
  }

  move(event) {
    const screen=this.screenPoint(event);
    this.pointer=this.worldPoint(screen);
    const drag=this.drag;
    if(drag?.kind==='pan') {
      const delta=screen.map((value,i)=>value-drag.screen[i]);
      drag.moved ||= Math.hypot(...delta)>3;
      if(drag.moved) this.origin=drag.origin.map((value,i)=>value+delta[i]);
    } else if(drag?.kind==='part') {
      const delta=this.pointer.map((value,i)=>value-drag.point[i]);
      drag.moved ||= Math.hypot(...delta)*this.zoom>3;
      if(drag.moved) {
        const grid=value=>Math.min(2496,Math.max(-2496,Math.round(value/12)*12));
        drag.part.x=grid(drag.original[0]+delta[0]);
        drag.part.y=grid(drag.original[1]+delta[1]);
      }
    } else if(drag?.kind==='waypoint') {
      drag.moved ||= Math.hypot(this.pointer[0]-drag.point[0],this.pointer[1]-drag.point[1])*this.zoom>3;
      if(drag.moved) drag.wire.points[drag.index]=this.pointer.map(value=>Math.max(-2496,Math.min(2496,Math.round(value/12)*12)));
    } else if(drag?.kind==='pin') {
      drag.moved ||= Math.hypot(screen[0]-drag.screen[0],screen[1]-drag.screen[1])>5;
    }
    this.draw();
  }

  up(event) {
    const drag=this.drag;
    this.drag=null;
    if(drag?.kind==='part' && drag.moved) {
      const {part,original}=drag;
      this.actions.moved(part.id,original,[part.x,part.y]);
    } else if(drag?.kind==='waypoint' && drag.moved) {
      this.actions.routed(drag.wire.id,drag.original,drag.wire.points.map(point=>[...point]));
    } else if(drag?.kind==='route') {
      const point=this.worldPoint(this.screenPoint(event)),hit=this.hit(point);
      if(hit?.kind==='pin') this.actions.pin(hit.id);
      else this.actions.waypoint(point);
    } else if(drag?.kind==='pin') {
      const hit=this.hit(this.worldPoint(this.screenPoint(event)));
      if(drag.moved && hit?.kind==='pin' && hit.id!==drag.pin) this.actions.connect(drag.pin,hit.id);
      else if(!drag.moved) this.actions.pin(drag.pin);
      else {
        this.actions.pin(drag.pin);
        this.actions.waypoint(this.worldPoint(this.screenPoint(event)));
      }
    } else if(drag?.kind==='pan' && !drag.moved) {
      this.actions.select(null);
    }
    this.draw();
  }

  cancel() {
    if(this.drag?.kind==='part') {
      [this.drag.part.x,this.drag.part.y]=this.drag.original;
    }
    if(this.drag?.kind==='waypoint') this.drag.wire.points=this.drag.original;
    this.drag=null;
    this.pointer=null;
    this.draw();
  }

  path(points,color,width,dash=[]) {
    const c=this.context;
    c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.strokeStyle=color;
    c.lineWidth=width;
    c.setLineDash(dash);
    c.stroke();
    c.setLineDash([]);
  }

  circle(x,y,radius,fill,stroke,width=1.7) {
    const c=this.context;
    c.beginPath();c.arc(x,y,radius,0,Math.PI*2);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}
  }

  text(value,x,y,color,font,align='center') {
    const c=this.context;
    c.font=font;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(value,x,y);
  }

  symbol(p,color) {
    const c=this.context;
    const path=(points,width=2.5)=>this.path(points,color,width);
    if(p.type==='G') {
      path([[0,-22],[0,-2]]); path([[-13,-2],[13,-2]]); path([[-9,4],[9,4]]); path([[-4,10],[4,10]]);
      return;
    }
    if(p.type==='J') {this.circle(0,0,5,color);return;}
    if(p.type==='R') {
      path([[-48,0],[-26,0],[-21,-8],[-13,8],[-5,-8],[3,8],[11,-8],[19,8],[26,0],[48,0]]);
    } else if(p.type==='C') {
      path([[-48,0],[-6,0]]);path([[6,0],[48,0]]);path([[-6,-13],[-6,13]]);path([[6,-13],[6,13]]);
    } else if(p.type==='L') {
      path([[-48,0],[-24,0]]);path([[24,0],[48,0]]);
      c.beginPath(); c.moveTo(-24,0);
      for(let i=0;i<4;i++) c.arc(-18+i*12,0,6,Math.PI,2*Math.PI);
      c.strokeStyle=color;c.lineWidth=2.5;c.stroke();
    } else if(p.type==='S') {
      path([[-48,0],[-18,0]]);path([[18,0],[48,0]]);
      path([[-18,0],[p.closed?18:14,p.closed?0:-17]]);
      this.circle(-18,0,3,'#0d192d',color);this.circle(18,0,3,'#0d192d',color);
    } else {
      path([[-48,0],[-19,0]]);path([[19,0],[48,0]]);this.circle(0,0,19,'#111c32',color,2.4);
      if(p.type==='V') {
        path([[-10,0],[-3,0]],1.7);path([[-6.5,-3.5],[-6.5,3.5]],1.7);path([[4,0],[11,0]],1.7);
      } else {
        path([[-10,0],[10,0],[4,-4]],1.7);path([[10,0],[4,4]],1.7);
      }
    }
  }

  drawCurrent(points,current,phase) {
    if(Math.abs(current??0)<1e-13) return;
    const spacing=56;
    let offset=((phase??0)%spacing+spacing)%spacing;
    const strength=Math.sqrt(Math.abs(current)/(Math.abs(current)+.005));
    const radius=(2+1.5*strength)/this.zoom;
    for(let i=1;i<points.length;i++) {
      const [a,b]=[points[i-1],points[i]];
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!length) continue;
      while(offset<length) {
        const s=offset/length,x=a[0]+s*(b[0]-a[0]),y=a[1]+s*(b[1]-a[1]);
        this.circle(x,y,radius*2,'#8ceeff48');
        this.circle(x,y,radius,'#d9fbff');
        offset+=spacing;
      }
      offset-=length;
    }
  }

  draw() {
    if(!this.ready) return;
    const c=this.context,{width,height,ratio,zoom,origin}=this;
    const {model,selected,pending,result,showNets,flow}=this.actions.state();
    c.setTransform(ratio,0,0,ratio,0,0);
    c.fillStyle='#0b1425';c.fillRect(0,0,width,height);
    const halo=c.createRadialGradient(width*.53,height*.38,12,width*.53,height*.38,Math.max(width,height)*.68);
    halo.addColorStop(0,'#14243d');halo.addColorStop(1,'#0b1425');c.fillStyle=halo;c.fillRect(0,0,width,height);
    const step=Math.max(12,24*zoom);
    const ox=((origin[0]%step)+step)%step,oy=((origin[1]%step)+step)%step;
    c.fillStyle='#30415c';
    for(let x=ox;x<width;x+=step) for(let y=oy;y<height;y+=step) c.fillRect(x,y,1.25,1.25);
    c.save();c.translate(...origin);c.scale(zoom,zoom);c.lineCap='round';c.lineJoin='round';
    const terminals=this.terminals(model.parts);
    const wireColor=pin=>{
      const net=result?.netNames[pin];
      if(!net) return '#82a6cf';
      if(net==='GND') return '#82b1aa';
      return this.palette[(Number(net.slice(1))-1)%this.palette.length]||'#82a6cf';
    };
    for(const wire of model.wires) {
      const points=this.wirePoints(terminals[wire.a],terminals[wire.b],wire.points);
      const active=selected?.kind==='wire'&&selected.id===wire.id;
      this.path(points,'#0b1425',6/zoom);
      this.path(points,active?'#fff1a8':wireColor(wire.a),(active?3.5:2)/zoom);
      this.drawCurrent(points,flow.wires[wire.id],flow.phases.get(wire.id));
      if(active) for(const point of wire.points??[]) {
        c.fillStyle='#fff1a8';c.strokeStyle='#0b1425';c.lineWidth=1/zoom;
        c.fillRect(point[0]-4/zoom,point[1]-4/zoom,8/zoom,8/zoom);
        c.strokeRect(point[0]-4/zoom,point[1]-4/zoom,8/zoom,8/zoom);
      }
    }
    for(const p of model.parts) {
      const active=selected?.kind==='part'&&selected.id===p.id;
      const color=active?'#fff1a8':CircuitModel.types[p.type].source?'#c1b5ff':'#e4efff';
      c.save();c.translate(p.x,p.y);
      const reading=flow.current?.parts[p.id];
      if(reading) {
        const [magnitude,tint]=p.type==='C'||p.type==='L'?[reading.energy,'#74f2dc']:
          CircuitModel.types[p.type].source?[Math.max(0,-reading.power),'#cbb6ff']:[Math.max(0,reading.power),'#ffb27d'];
        const strength=Math.min(1,Math.log1p(magnitude*1e7)/16);
        if(strength>.01) {
          c.save();c.globalAlpha=strength;
          const glow=c.createRadialGradient(0,0,2,0,0,39/zoom);
          glow.addColorStop(0,tint+'8c');glow.addColorStop(1,tint+'00');
          this.circle(0,0,39/zoom,glow);c.restore();
        }
      }
      if(p.type!=='J'&&p.type!=='G'&&active) {
        this.circle(0,0,27,'#293557','#8c84c4',1/zoom);
      }
      if(!CircuitModel.types[p.type].single) c.rotate(p.rotation*Math.PI/180);
      this.symbol(p,color);c.restore();
      if(p.type!=='J') {
        const vertical=p.rotation%180!==0 && !CircuitModel.types[p.type].single;
        const offsetY=p.type==='G'?24:vertical?-9:-23;
        const offsetX=vertical?25:0;
        const align=vertical?'left':'center';
        const fontSize=Math.min(23,Math.max(13,11/zoom));
        this.text(p.label,p.x+offsetX,p.y+offsetY,color,`600 ${fontSize}px Segoe UI`,align);
        const value=this.actions.valueLabel(p);
        if(value) this.text(value,p.x+offsetX,p.y+(vertical?offsetY+fontSize+3:22),'#b3c3dd',`${fontSize-1}px Segoe UI`,align);
      }
      CircuitModel.pins(p).forEach(pin=>{
        const pos=terminals[pin];
        const hot=(this.drag?.kind==='pin'?this.drag.pin:pending)===pin;
        this.circle(pos.x,pos.y,(hot?6:3.6)/zoom,hot?'#fff1a8':p.type==='J'?wireColor(pin):'#0b1425',wireColor(pin),1.55/zoom);
      });
      if(showNets && p.type==='J') {
        const name=result?.netNames[`${p.id}:0`];
        if(name) this.text(name,p.x+10/zoom,p.y-10/zoom,wireColor(`${p.id}:0`),`${10/zoom}px Segoe UI`,'left');
      }
    }
    const start=this.drag?.kind==='pin'?this.drag.pin:pending;
    if(start && terminals[start] && this.pointer) {
      const a=terminals[start],b={x:this.pointer[0],y:this.pointer[1],dx:0,dy:0};
      const anchors=this.actions.state().pendingRoute??[];
      this.path(this.wirePoints(a,b,anchors,true),'#fff1a8',2/zoom,[6/zoom,5/zoom]);
      for(const point of anchors) this.circle(point[0],point[1],4/zoom,'#fff1a8','#0b1425',1/zoom);
    }
    c.restore();
  }
}
