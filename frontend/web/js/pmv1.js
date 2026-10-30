window.SatipoPmv1=(()=>{
  async function init(root){
    const B=window.SatipoBackend,esc=B.escapeHTML,app=window.createPmv1Service(B.profile?.id||'demo');let timer=null,busy=false,page=0,rows=[];
    root.innerHTML=`<p class="eyebrow">PMV1 · EXPERIMENTO DE SOFTWARE</p><h2>Cinco variables e inferencia local</h2>
      <p class="reference-note">Modelo entrenado con datos sintéticos. Humo y gas son índices de señal 0–100, no ppm ni probabilidad de incendio. Los niveles no están validados para protección de personas.</p>
      <p>Normal: escenario de referencia. Advertencia: escenario intermedio que requiere revisión. Emergencia: escenario simulado de mayor intensidad; no confirma fuego real.</p>
      <div class="reading-toolbar"><label>Escenario <select id="pmv1-scenario"><option>Normal</option><option>Advertencia</option><option>Emergencia</option></select></label>
      <button id="pmv1-once" class="secondary-button">Leer una vez</button><button id="pmv1-ten" class="secondary-button">Probar 10 lecturas</button>
      <button id="pmv1-start" class="secondary-button">Iniciar cada 2 segundos</button><button id="pmv1-stop" class="secondary-button" disabled>Detener</button>
      <button id="pmv1-sync" class="secondary-button">Sincronizar con servicio remoto</button></div>
      <p id="pmv1-status" role="status">Cargando historial local…</p><div id="pmv1-current" class="kpis-grid"></div>
      <p id="pmv1-count"></p><div class="readings-scroll" tabindex="0" role="region" aria-label="Lecturas PMV1"><table><thead><tr><th>Fecha / origen</th><th>Temp. °C</th><th>Humedad %</th><th>Humo índice</th><th>Gas índice</th><th>Polvo PM2.5 µg/m³</th><th>Nivel</th><th>Guardado</th></tr></thead><tbody id="pmv1-rows"></tbody></table></div>
      <button id="pmv1-prev" class="secondary-button">Anterior</button> <button id="pmv1-next" class="secondary-button">Siguiente</button>
      <p><label>Importar lecturas capturadas por USB (JSON) <input id="pmv1-file" type="file" accept="application/json,.json"></label></p>
      <p>El historial se guarda en este navegador para esta cuenta. Sincronizar requiere conexión y la migración PMV1 en servicio remoto. Cerrar la página detiene la adquisición. Borrar datos del navegador elimina las lecturas locales no sincronizadas.</p>
      <p>Evaluación sintética independiente: 900 ejemplos, 15 falsas alarmas entre 300 normales y 23 emergencias clasificadas como otro nivel. Exactitud 90,22 %. No describe sensores físicos ni incendios forestales.</p>`;
    const $=s=>root.querySelector(s),levelClass=l=>l==='Normal'?'good':l==='Advertencia'?'warn':'alert';
    function render(){
      page=Math.min(page,Math.max(0,Math.ceil(rows.length/15)-1));
      $('#pmv1-count').textContent=`${rows.length} registros completos · ${rows.filter(r=>!r.synced).length} pendientes de sincronizar · página ${page+1}`;
      $('#pmv1-rows').innerHTML=rows.slice(page*15,page*15+15).map(r=>{const v=r.reading.values;return `<tr><td>${esc(r.reading.observed_at)}<br>${r.reading.source==='simulation'?'SIMULACIÓN':'SENSOR · experimental'}</td>${['temperature_c','humidity_pct','smoke_index','gas_index','dust_ugm3'].map(k=>`<td>${v[k]}</td>`).join('')}<td><span class="badge ${levelClass(r.prediction.level)}">${esc(r.prediction.level)}</span></td><td>${r.synced?'Local + servicio remoto':'Solo local'}</td></tr>`;}).join('');
      $('#pmv1-prev').disabled=page===0;$('#pmv1-next').disabled=(page+1)*15>=rows.length;
      const last=rows[0];$('#pmv1-current').innerHTML=last?`<article class="kpi-card"><h4>Último resultado experimental</h4><strong class="badge ${levelClass(last.prediction.level)}">${esc(last.prediction.level)}</strong><small>${esc(last.prediction.model_version)}</small></article>`:'';
    }
    async function refresh(){rows=await app.history();render();}
    async function run(action){if(busy)return;busy=true;try{await action();await refresh();}catch(e){$('#pmv1-status').textContent=e.message||'No se pudo completar la operación.';}finally{busy=false;}}
    async function capture(){await app.capture($('#pmv1-scenario').value);$('#pmv1-status').textContent='Cinco variables validadas, evaluadas y guardadas localmente.';}
    function stop(){clearTimeout(timer);timer=null;$('#pmv1-start').disabled=false;$('#pmv1-stop').disabled=true;}
    async function tick(){if(timer===null)return;await run(capture);if(timer!==null)timer=setTimeout(tick,2000);}
    $('#pmv1-once').addEventListener('click',()=>run(capture));
    $('#pmv1-ten').addEventListener('click',()=>run(async()=>{for(let i=0;i<10;i++)await app.capture($('#pmv1-scenario').value);$('#pmv1-status').textContent='Prueba completada: 10 de 10 registros con sus cinco variables guardadas.';}));
    $('#pmv1-start').addEventListener('click',()=>{timer=setTimeout(tick,0);$('#pmv1-start').disabled=true;$('#pmv1-stop').disabled=false;});
    $('#pmv1-stop').addEventListener('click',()=>{stop();$('#pmv1-status').textContent='Adquisición detenida.';});
    $('#pmv1-sync').addEventListener('click',()=>run(async()=>{const count=await app.synchronize();$('#pmv1-status').textContent=`${count} registros confirmados por servicio remoto.`;}));
    $('#pmv1-file').addEventListener('change',event=>run(async()=>{const records=await window.SatipoPmv1Files.read(event.target.files[0]);await app.importRecords(records);$('#pmv1-status').textContent=`${records.length} lecturas importadas y evaluadas localmente.`;}));
    $('#pmv1-prev').addEventListener('click',()=>{page--;render();});$('#pmv1-next').addEventListener('click',()=>{page++;render();});
    window.addEventListener('pagehide',stop);await refresh();$('#pmv1-status').textContent='Listo. La inferencia funciona sin red después de cargar esta pantalla.';
  }
  return {init};
})();
