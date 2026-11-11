'use strict';

// The video uses the actual interactive scenes in an isolated, non-persistent session.
if(new URLSearchParams(location.search).has('tour')) {
  let stage='',changed=false,drawn=0;
  const circuitView=physical=>{
    if(!!circuitStudio.physicalScene?.active!==physical) circuitStudio.$('#studio-physical').click();
    circuitStudio.board.fit();
  };
  window.labTour={
    apply(config) {
      stage=config.id;changed=false;drawn=0;
      S.demonstrating=false;fieldMotion=true;
      switchUnit(config.unit);applyScenario(config.scenario);
      if(config.unit===3) {
        circuitStudio.replace(circuitExample(config.scenario));
        circuitView(config.physical===true);
        circuitStudio.flow.running=true;circuitStudio.flow.rewind();
        if(config.scenario==='rc') {
          circuitStudio.selected={kind:'part',id:'C1'};
          circuitStudio.probe='C1';circuitStudio.quantity='current';
          circuitStudio.renderChoices();circuitStudio.renderResults();
          circuitStudio.flow.speed=.5;
        } else circuitStudio.flow.speed=1;
        if(config.scenario==='rlc') {circuitStudio.probe='C1';circuitStudio.quantity='voltage';circuitStudio.renderResults();}
      }
      if(config.id==='builder') {
        const model=circuitExample('rc');model.wires=[];
        model.settings={mode:'dc',frequency:1000,duration:.5,samples:360};
        model.parts.find(p=>p.id==='V1').value=12;
        model.parts.find(p=>p.id==='V1').signal='constant';
        circuitStudio.replace(model);circuitView(false);circuitStudio.board.fit();
      }
      if(config.id==='circle') {Object.assign(S,{vx:1,vy:0,vz:0,E:0,B:1});stopParticle();play();}
      if(config.id==='crossed') {Object.assign(S,{vx:1,vy:0,vz:0,E:1,B:1});stopParticle();play();}
      if(config.unit===4) {
        Object.assign(magneticLab,{field:1,current:2,area:1,length:1,turns:1,closed:false,hallCurrent:1,hallField:.5,thickness:1,density:10,carrier:'negative'});
        if(config.scenario==='loop') {magneticLab.angle.loop=90;experience.motor=true;}
        if(config.scenario==='conductor') magneticLab.angle.conductor=90;
        if(config.scenario==='flux') magneticLab.angle.flux=0;
        update();
      }
      if(immersiveScene) {immersiveScene.controls.autoRotate=config.unit!==3&&config.scenario!=='particle';immersiveScene.resize();}
      if(circuitStudio?.physicalScene) circuitStudio.physicalScene.controls.autoRotate=config.physical===true;
      renderControlsIfNeeded(config.unit);
      const scene=config.unit===3?circuitStudio.physicalScene:immersiveScene;
      if(scene?.active&&(config.unit===2||config.unit===4||config.physical)) {
        scene.frame(0);
        scene.camera.position.sub(scene.controls.target).multiplyScalar(.78).add(scene.controls.target);
        scene.controls.update();scene.frame(0);
      }
    },
    advance(local) {
      if(stage==='builder') {
        const links=circuitExample('rc').wires;
        const wanted=Math.min(links.length,Math.floor(local/1.5));
        if(wanted>drawn) {
          circuitStudio.commit(model=>{model.wires=links.slice(0,wanted).map(w=>({...w}));});drawn=wanted;
          const last=circuitStudio.model.wires.at(-1);
          if(last) circuitStudio.select({kind:'wire',id:last.id});
        }
        if(local>11&&!changed&&drawn===links.length) {
          changed=true;
          const wire=circuitStudio.model.wires.find(w=>w.a==='C1:1');
          if(wire) {circuitStudio.beginWireRoute(wire.id);circuitStudio.addWaypoint([756,264]);circuitStudio.addWaypoint([756,384]);circuitStudio.connect(wire.a,wire.b);}
          circuitStudio.board.fit();
        }
      }
      if(local>=8&&!changed&&stage!=='builder') {
        changed=true;
        if(stage==='dipole') {S.charges[0].q=2e-9;renderControls();update();}
        if(stage==='charge') {capLive.elapsed=6*capLive.transition.R*capLive.transition.C;capLive.running=false;renderCapacitorLive();}
        if(stage==='dielectric') changeCapacitor(()=>{S.capInsertion=1;},{rebuild:true,describe:true});
        if(stage==='isolated') changeCapacitor(()=>{S.d=4;},{rebuild:true,describe:true});
        if(stage==='series') circuitStudio.editPart('R1','value',300);
        if(stage==='parallel') circuitStudio.editPart('R3','value',600);
        if(stage==='mixed') {
          circuitView(false);const wire=circuitStudio.model.wires.find(w=>w.a==='J1:0'&&w.b==='J2:0');
          if(wire) {circuitStudio.select({kind:'wire',id:wire.id});circuitStudio.removeSelected();}
        }
        if(stage==='rc') {
          circuitStudio.commit(model=>{
            const source=model.parts.find(p=>p.type==='V');source.value=0;source.amplitude=0;source.signal='constant';
            model.parts.find(p=>p.type==='C').initial=12;
          });
          circuitStudio.flow.rewind();circuitStudio.flow.running=true;
        }
        if(stage==='rlc') circuitStudio.commit(model=>{model.settings.frequency=800;});
        if(stage==='wire') {S.current=-5;renderControls();update();}
        if(stage==='flux') {magneticLab.closed=true;renderControls();update();}
        if(stage==='conductor') {magneticLab.current=-2;renderControls();update();}
        if(stage==='hall') {magneticLab.carrier='positive';renderControls();update();}
      }
      if(stage==='flux'&&local<8) {magneticLab.angle.flux=Math.min(180,local/8*180);updateMagneticLab('flux');}
      if(S.unit===3) {
        if(circuitStudio.physicalScene?.active)circuitStudio.physicalScene.frame(0);
        else circuitStudio.board.draw();
      } else if(immersiveScene) immersiveScene.frame(0);else draw();
    },
    snapshot() {
      const circuit=S.unit===3;
      let source=circuit?(circuitStudio.physicalScene?.active?circuitStudio.physicalScene.canvas:circuitStudio.board.canvas):immersiveScene?.canvas??canvas;
      let metrics;
      if(circuit) {
        const totals=circuitStudio.flow.current?.totals;
        metrics=[{label:'Potencia de las fuentes',value:totals?circuitNumber(totals.source,'W'):'—'},
          {label:'Calor por segundo en R',value:totals?circuitNumber(totals.heat,'W'):'—'},
          {label:'Energía almacenada',value:totals?circuitNumber(totals.stored,'J'):'—'},
          {label:'Análisis',value:{dc:'CC · estabilizado',time:'Transitorio',ac:'CA · '+circuitNumber(circuitStudio.model.settings.frequency,'Hz')}[circuitStudio.model.settings.mode]}];
      } else metrics=[...document.querySelectorAll('.metric')].slice(0,4).map(el=>({label:el.querySelector('label').textContent,value:el.querySelector('strong').textContent}));
      return {source,metrics,graph:circuit?circuitStudio.$('#circuit-scope'):S.unit===2?$('#cap-time-plot'):null,
        detail:stage==='rc'?(changed?'DESCARGA · C1 entrega energía a R1':'CARGA · C1 recibe energía de la fuente'):stage==='builder'?`${drawn} conexiones · clics fijan la forma del cable`:null};
    }
  };
  function renderControlsIfNeeded(unit) {if(unit!==3){renderControls();update();}}
}
