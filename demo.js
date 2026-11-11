'use strict';
const chapters=[
 {id:'dipole',unit:1,scenario:'dipole',title:'El campo eléctrico responde a las cargas',text:'Las líneas salen de las cargas positivas y entran en las negativas. A mitad de la escena duplicamos una carga: el campo y las mediciones cambian.',guide:'EDITAR · Carga, signo y posición de cada fuente'},
 {id:'quadrupole',unit:1,scenario:'quadrupole',title:'Superposición de cuatro cargas',text:'El campo total es la suma vectorial de los campos individuales. Las líneas y los vectores revelan cómo se reorganiza el espacio.',guide:'OBSERVAR · Dirección de E y distribución de las fuentes'},
 {id:'potential',unit:1,scenario:'potential',title:'Superficies equipotenciales',text:'Cada superficie reúne puntos con el mismo potencial. El mapa de color permite comparar zonas positivas, negativas y de potencial cercano a cero.',guide:'ACTIVAR · Superficies de potencial y mapa de color'},
 {id:'trajectory',unit:1,scenario:'trajectory',title:'Una partícula dentro del campo eléctrico',text:'La carga de prueba acelera por la fuerza F = qE. En Condiciones de lanzamiento puedes editar su posición, velocidad, carga y masa.',guide:'EXPERIMENTAR · Lanzar, pausar y cambiar las condiciones iniciales'},
 {id:'charge',unit:2,scenario:'charge',title:'Cómo se carga un capacitor',text:'La fuente mueve carga hacia las placas. Crecen el campo y la energía almacenada, mientras disminuye la corriente. Parte de la energía se transforma en calor.',guide:'PULSAR · Conectar batería · Observar carga y energía'},
 {id:'discharge',unit:2,scenario:'discharge',title:'El capacitor entrega su energía',text:'Al descargar por la resistencia, la fuente queda desconectada. Disminuyen la carga, el voltaje y el campo; aumenta el calor acumulado en R.',guide:'PULSAR · Descargar por R · Comparar energía y calor'},
 {id:'dielectric',unit:2,scenario:'dielectric',title:'Insertar un dieléctrico cambia la respuesta',text:'Aumentamos la inserción del material del 50 % al 100 %. Con batería conectada se mantiene el voltaje y cambian la capacitancia, la carga y la energía.',guide:'EDITAR · Material, porcentaje insertado, área y separación'},
 {id:'isolated',unit:2,scenario:'isolated',title:'Capacitor aislado: la carga se conserva',text:'Duplicamos la separación entre placas. Al conservarse Q y disminuir C, aumenta el voltaje. El cambio de energía corresponde al trabajo sobre las placas.',guide:'COMPARAR · Aislar placas y modificar la geometría'},
 {id:'series',unit:3,scenario:'series',title:'Circuito en serie y ley de Ohm',text:'Inicialmente Req = 600 Ω e I = 20 mA. Cambiamos R1 de 100 Ω a 300 Ω: la resistencia total aumenta y la corriente disminuye a 15 mA.',guide:'EDITAR · Seleccionar un componente y escribir su resistencia'},
 {id:'parallel',unit:3,scenario:'parallel',title:'Ramas en paralelo y división de corriente',text:'Todas las ramas tienen el mismo voltaje. Al aumentar R3 de 300 Ω a 600 Ω disminuyen su corriente y la potencia total que entrega la fuente.',guide:'OBSERVAR · Las bifurcaciones y la corriente de cada cable'},
 {id:'mixed',unit:3,scenario:'mixed',physical:true,title:'La misma red en montaje 3D y esquema',text:'El montaje usa las conexiones reales del editor. Pasamos al esquema y quitamos el cable entre J1 y J2: una rama se desconecta y cambia la potencia.',guide:'CAMBIAR · Montaje 3D / Editar esquema · Modificar conexiones'},
 {id:'builder',unit:3,scenario:'blank',title:'Construcción libre y recorrido de los cables',text:'Unimos los bornes progresivamente. Para elegir la forma: borne de origen, clics que fijan puntos y borne de destino. Los puntos guardados se pueden arrastrar.',guide:'CABLEAR · Retroceso retira un punto · Esc cancela · Deshacer restaura'},
 {id:'rc',unit:3,scenario:'rc',title:'Corriente durante la carga y la descarga RC',text:'Primero C1 se carga; después parte de 12 V y se descarga por R1. El osciloscopio muestra la corriente. En CC estabilizada puede tener voltaje con I = 0.',guide:'ANALIZAR · Transitorio · Voltaje inicial · Energía de C1'},
 {id:'rlc',unit:3,scenario:'rlc',physical:true,title:'Filtro RLC en corriente alterna',text:'R, L y C responden a la frecuencia. Cambiamos el análisis de 1600 Hz a 800 Hz. La corriente invierte su sentido y los elementos reactivos intercambian energía.',guide:'EDITAR · Frecuencia, inductancia y capacitancia · Ver amplitud y fase'},
 {id:'field',unit:4,scenario:'field',title:'Campo magnético de un imán',text:'Las líneas exteriores salen del polo norte y entran por el sur. El modelo dipolar aproxima el campo exterior y excluye la región próxima al centro.',guide:'EXPLORAR · Girar la cámara y mover el punto de medición'},
 {id:'wire',unit:4,scenario:'wire',title:'Una corriente genera campo magnético',text:'El campo rodea al conductor. Invertimos la corriente de +5 A a −5 A: se invierte B y el sentido de sus trazadores. Su intensidad disminuye con la distancia.',guide:'COMPROBAR · Regla de la mano derecha · B = μ₀I / (2πr)'},
 {id:'circle',unit:4,scenario:'particle',title:'Fuerza de Lorentz: órbita circular',text:'Con velocidad perpendicular a B y sin campo eléctrico, la fuerza curva la trayectoria. No hace trabajo: cambia la dirección, pero se conserva la rapidez.',guide:'AJUSTAR · q = 1 µC · m = 1 mg · v = 1 m/s · B = 1 T'},
 {id:'helix',unit:4,scenario:'particle',title:'Una componente paralela produce una hélice',text:'La velocidad perpendicular produce el giro; la componente paralela al campo mantiene el avance. La combinación forma una trayectoria helicoidal.',guide:'EDITAR · Componente vᶻ · Comparar radio y paso de la hélice'},
 {id:'crossed',unit:4,scenario:'particle',title:'Campos cruzados y selector de velocidad',text:'E apunta en +y y B en +z. Con v = E/B = 1 m/s, las fuerzas eléctrica y magnética se compensan y la partícula avanza en línea recta.',guide:'COMPARAR · F = q(E + v × B) · Cambiar velocidad o campo'},
 {id:'flux',unit:4,scenario:'flux',title:'Flujo magnético y una superficie cerrada',text:'Giramos la normal de la superficie para cambiar Φ = BA cos θ. Después activamos el cubo: los flujos que entran y salen se cancelan; el flujo neto es cero.',guide:'MEDIR · Ángulo de la normal · Flujo en cada cara del cubo'},
 {id:'conductor',unit:4,scenario:'conductor',title:'Fuerza magnética sobre un conductor',text:'Un tramo con corriente dentro de B experimenta una fuerza. Invertimos I de +2 A a −2 A y se invierte la fuerza. Si el tramo es paralelo a B, la fuerza es cero.',guide:'VARIAR · Corriente, longitud y ángulo · F = IL × B'},
 {id:'loop',unit:4,scenario:'loop',title:'Espira y motor de corriente directa',text:'La torsión hace girar la espira. El conmutador invierte la corriente para sostener el sentido del giro. Puedes ajustar vueltas, área, inercia y rozamiento.',guide:'CONTROLAR · Poner en movimiento · Pausar · Detener giro'},
 {id:'hall',unit:4,scenario:'hall',title:'Efecto Hall y signo de los portadores',text:'La fuerza magnética separa las cargas dentro del material y genera un voltaje transversal. Cambiamos electrones por huecos: la polaridad Hall se invierte.',guide:'EDITAR · Portador, corriente, campo, espesor y densidad'},
 {id:'files',unit:3,scenario:'mixed',title:'Guardar, comparar y presentar los resultados',text:'Guardar JSON conserva componentes, conexiones y recorridos. Abrir JSON recupera el circuito; Exportar CSV guarda las mediciones. El manual y el informe acompañan la exposición.',guide:'ENTREGAR · Esquema JSON · Mediciones CSV · Captura PNG · Manual'}
];
const $=selector=>document.querySelector(selector),out=$('#video'),g=out.getContext('2d'),frame=$('#lab');
const state={recording:false,recorder:null,stream:null,chunks:[],timer:null,started:0,last:-1,seconds:16,url:null,savedFrames:new Set(),failed:false};
let seekSource=null,seekURL=null;
function lines(text,x,y,width,size=21,color='#d4dfef',height=30) {
  g.font=`${size}px Segoe UI`;g.fillStyle=color;let line='';
  for(const word of text.split(' ')) {if(line&&g.measureText(line+word).width>width){g.fillText(line.trim(),x,y);line='';y+=height;}line+=word+' ';}
  if(line)g.fillText(line.trim(),x,y);
}
function time(value){return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;}
function paint(elapsed) {
  const index=Math.min(chapters.length-1,Math.floor(elapsed/state.seconds)),local=elapsed-index*state.seconds,chapter=chapters[index];
  const engine=frame.contentWindow.labTour;
  if(index!==state.last){engine.apply(chapter);state.last=index;}
  engine.advance(local*16/state.seconds);
  const shot=engine.snapshot();
  g.fillStyle='#090f1d';g.fillRect(0,0,1280,720);
  g.fillStyle='#70e6cd';g.font='600 14px Segoe UI';g.fillText(`ELECTROLAB  /  UNIDAD ${chapter.unit}`,28,28);
  g.fillStyle='#a7b7d1';g.textAlign='right';g.fillText(`${String(index+1).padStart(2,'0')} / ${chapters.length} CAPÍTULOS`,1252,28);g.textAlign='left';
  g.fillStyle='#f1f5ff';g.font='600 29px Segoe UI';g.fillText(chapter.title,28,73);
  g.fillStyle='#101e34';g.fillRect(24,98,910,444);g.fillRect(950,98,306,444);
  if(!shot.source?.width||!shot.source?.height)throw new Error('La escena todavía no tiene una imagen disponible.');
  const scale=Math.min(910/shot.source.width,444/shot.source.height),w=shot.source.width*scale,h=shot.source.height*scale;
  g.drawImage(shot.source,24+(910-w)/2,98+(444-h)/2,w,h);
  if(shot.graph?.width&&(chapter.unit===2||chapter.unit===3&&['rc','rlc'].includes(chapter.id))) {
    g.fillStyle='#0b1425';g.fillRect(32,430,894,104);g.drawImage(shot.graph,38,433,882,98);
  }
  shot.metrics.slice(0,4).forEach((metric,i)=>{
    g.fillStyle='#748ba9';g.font='13px Segoe UI';g.fillText(metric.label,969,132+i*92);
    lines(metric.value.replace(/\s+/g,' '),969,167+i*92,268,23,'#bbf3e3',28);
  });
  if(shot.detail){g.fillStyle='#102e35';g.fillRect(32,506,894,27);g.fillStyle='#9de7d8';g.font='13px Segoe UI';g.fillText(shot.detail,44,525);}
  g.fillStyle='#f0ca83';g.font='600 15px Segoe UI';g.fillText(chapter.guide,28,571);
  lines(chapter.text,28,610,1220,21,'#d2deef',30);
  const total=chapters.length*state.seconds;
  g.fillStyle='#243149';g.fillRect(28,687,1224,4);g.fillStyle='#70e6cd';g.fillRect(28,687,1224*Math.min(elapsed/total,1),4);
  g.fillStyle='#778ba8';g.font='12px Segoe UI';g.fillText('Escenas del simulador · modelos educativos ideales · sin locución',28,711);
  g.textAlign='right';g.fillText(`${time(elapsed)} / ${time(total)}`,1252,711);g.textAlign='left';
  if(new URLSearchParams(location.search).has('guardar')&&local>state.seconds*.8&&!state.savedFrames.has(index)) {
    state.savedFrames.add(index);out.toBlob(blob=>fetch(`/__frame/${index}`,{method:'POST',body:blob}).catch(()=>{}),'image/png');
  }
}
function waitForEngine(){return new Promise((resolve,reject)=>{
  const start=performance.now();let poll;
  const check=()=>{
    try {if(frame.contentWindow?.labTour){clearInterval(poll);resolve();return;}}
    catch {clearInterval(poll);reject(new Error('El navegador impide acceder al laboratorio. Abre la grabación desde HTTP local.'));return;}
    if(performance.now()-start>30000){clearInterval(poll);reject(new Error('El laboratorio no terminó de cargar. Recarga la página e inténtalo de nuevo.'));}
  };
  poll=setInterval(check,150);check();
});}
function recordingType(){
  for(const type of ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'])if(MediaRecorder.isTypeSupported(type))return type;
  throw new Error('No hay un formato WebM de grabación compatible en este navegador. Usa Chrome o Edge.');
}
function release(){clearInterval(state.timer);state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;state.recording=false;$('#record').disabled=false;$('#stop').hidden=true;}
async function finish(mime) {
  release();
  if(!state.chunks.length){$('#status').textContent='La grabación no produjo datos. Vuelve a intentarlo con la prueba rápida.';return;}
  const blob=new Blob(state.chunks,{type:mime});
  if(seekURL)URL.revokeObjectURL(seekURL);seekURL=null;seekSource=null;
  if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);
  const player=$('#playback'),download=$('#download');player.src=state.url;player.load();download.href=state.url;download.download='electrolab_funcionamiento_completo.webm';
  $('#playback-note').textContent='Nueva grabación lista. Puedes reproducirla aquí o descargarla.';
  const prefix=state.failed?'Grabación interrumpida; se conservaron los tramos disponibles.':'Grabación terminada.';
  $('#status').textContent=`${prefix} Archivo de ${(blob.size/1e6).toFixed(1)} MB. Usa Descargar video completo.`;
  if(new URLSearchParams(location.search).has('guardar')) {
    try{
      const response=await fetch('/__video',{method:'POST',headers:{'Content-Type':'video/webm'},body:blob});
      if(!response.ok)throw new Error('El servidor no pudo guardar el archivo.');
      $('#status').textContent=`${prefix} Video guardado en la carpeta del proyecto. ${(blob.size/1e6).toFixed(1)} MB.`;
    }catch(error){$('#status').textContent+=` ${error.message} Puedes usar el enlace de descarga.`;}
  }
}
$('#record').onclick=async()=>{
  if(state.recording)return;
  if(!['http:','https:'].includes(location.protocol)){$('#status').textContent='Para crear otra grabación, sirve la carpeta dist por HTTP y abre esta página desde localhost. El video ya generado se reproduce arriba sin servidor.';return;}
  if(!out.captureStream||!window.MediaRecorder){$('#status').textContent='Este navegador no admite la grabación. Usa Chrome o Edge; el video ya generado se puede descargar arriba.';return;}
  $('#record').disabled=true;$('#status').textContent='Preparando las escenas del laboratorio…';
  try {
    if(!frame.getAttribute('src'))frame.src='index.html?tour=1';await waitForEngine();
    Object.assign(state,{seconds:Number($('#length').value),last:-1,chunks:[],savedFrames:new Set(),failed:false});paint(0);
    const mime=recordingType();state.stream=out.captureStream(20);
    state.recorder=new MediaRecorder(state.stream,{mimeType:mime,videoBitsPerSecond:1800000});
    state.recorder.ondataavailable=event=>{if(event.data.size)state.chunks.push(event.data);};
    state.recorder.onstop=()=>finish(mime);
    state.recorder.onerror=event=>{state.failed=true;$('#status').textContent=event.error?.message??'La grabación se interrumpió.';if(state.recorder.state!=='inactive')state.recorder.stop();else release();};
    state.recorder.start(1000);state.started=performance.now();state.recording=true;$('#stop').hidden=false;
    $('#progress').max=chapters.length*state.seconds;
    state.timer=setInterval(()=>{
      const elapsed=(performance.now()-state.started)/1000,total=chapters.length*state.seconds;
      try {paint(Math.min(elapsed,total-.001));$('#progress').value=Math.min(elapsed,total);$('#status').textContent=`Grabando ${time(elapsed)} / ${time(total)} · ${chapters[state.last].title}. Mantén esta pestaña visible.`;
        if(elapsed>=total&&state.recorder.state!=='inactive')state.recorder.stop();
      }catch(error){state.failed=true;$('#status').textContent=error.message;if(state.recorder.state!=='inactive')state.recorder.stop();}
    },50);
  }catch(error){release();$('#status').textContent=error.message;}
};
$('#stop').onclick=()=>{if(state.recorder?.state==='recording')state.recorder.stop();};
$('#playback').onerror=()=>{$('#playback-note').textContent='No se encontró el video en esta copia. Extrae el ZIP completo conservando las carpetas o crea una grabación desde HTTP local.';};
function mediaReady(player) {
  if(player.readyState>=1)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const clean=()=>{clearTimeout(timeout);player.removeEventListener('loadedmetadata',ready);player.removeEventListener('error',failed);};
    const ready=()=>{clean();resolve();},failed=()=>{clean();reject(new Error('No se pudo cargar el video.'));};
    const timeout=setTimeout(()=>{clean();reject(new Error('El video no terminó de cargar.'));},30000);
    player.addEventListener('loadedmetadata',ready,{once:true});player.addEventListener('error',failed,{once:true});
  });
}
async function jumpToChapter(index) {
  const player=$('#playback'),target=index*(state.url?state.seconds:16);
  try {
    await mediaReady(player);
    // Basic local HTTP servers may not implement byte ranges. A Blob remains fully seekable.
    if(target>0&&/^https?:/.test(location.protocol)&&!player.currentSrc.startsWith('blob:')&&
      (!player.seekable.length||player.seekable.end(player.seekable.length-1)<target)) {
      $('#playback-note').textContent='Preparando el video para saltar entre capítulos…';
      if(!seekSource)seekSource=fetch(player.currentSrc).then(response=>{
        if(!response.ok)throw new Error('No se pudo cargar el video completo.');return response.blob();
      }).then(blob=>{seekURL=URL.createObjectURL(blob);return seekURL;}).catch(error=>{seekSource=null;throw error;});
      const url=await seekSource;
      if(player.src!==url){player.src=url;player.load();}
      await mediaReady(player);
    }
    player.currentTime=target;await player.play();
    $('#playback-note').textContent=`Capítulo ${index+1}: ${chapters[index].title}.`;
    player.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(error){$('#playback-note').textContent=`${error.message} Puedes descargar el MP4 y abrirlo directamente.`;}
}
chapters.forEach((chapter,index)=>{
  const item=document.createElement('li'),button=document.createElement('button');
  button.type='button';button.textContent=`${time(index*16)} · ${chapter.title}`;
  button.onclick=()=>jumpToChapter(index);
  item.append(button);$('#chapters').append(item);
});
