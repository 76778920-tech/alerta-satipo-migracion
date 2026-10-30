/* Operación demostrativa persistente, separada de reportes e incidentes reales. */
window.SatipoOperations = (() => {
  const B=window.SatipoBackend, esc=B.escapeHTML;
  let snapshot=null;
  const date=value=>new Date(value).toLocaleString('es-PE',{timeZone:'UTC'});
  const number=value=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(value);
  const note='Demostración vinculada a las 300 lecturas históricas. Los nodos son lotes virtuales de 50 registros, no dispositivos instalados. No se conocen ubicación, batería ni señal.';
  function setup(){
    document.querySelector('[data-view="nodes"]').textContent='Nodos virtuales';
    for(const name of ['nodes','maintenance']) document.querySelector(`#view-${name}`).innerHTML=`<section class="ops-panel" id="demo-${name}"></section>`;
    document.querySelector('#view-incidents').insertAdjacentHTML('afterbegin','<section class="ops-panel" id="demo-cases"></section>');
    for(const name of ['nodes','cases','maintenance']) document.querySelector(`#demo-${name}`).innerHTML=`<h2>${{nodes:'Nodos virtuales',cases:'Casos de revisión históricos',maintenance:'Mantenimiento demostrativo'}[name]}</h2><p class="reference-note">${note}</p><output class="operations-status" aria-live="polite">Consultando servicio remoto…</output><button type="button" class="secondary-button operations-retry">Actualizar</button><div class="operations-body"></div>`;
    document.querySelectorAll('.operations-retry').forEach(b=>b.onclick=refresh);
    document.addEventListener('change',async e=>{
      const input=e.target.closest('[data-operation]');if(!input)return;
      const previous=input.dataset.previous;input.disabled=true;
      try{
        const kind=input.dataset.operation==='demo_cases'?'cases':'maintenance';
        await B.updateState(kind,input.dataset.node,{state:input.value,expectedState:previous});
        await refresh();
      }catch(error){input.value=previous;status(error.message||'No se pudo guardar. Reintenta.',true);}
      finally{input.disabled=false;}
    });
    return refresh();
  }
  function status(message,error=false){document.querySelectorAll('#demo-nodes .operations-status, #demo-cases .operations-status, #demo-maintenance .operations-status').forEach(e=>{e.textContent=message;e.classList.toggle('quality-warning',error);});}
  function control(table,item,states){return `<label>Estado de ${esc(item.node_id)} <select data-operation="${table}" data-node="${esc(item.node_id)}" data-previous="${esc(item.state)}">${states.map(s=>`<option ${s===item.state?'selected':''}>${s}</option>`).join('')}</select></label>`;}
  function render(){
    const {nodes,links,cases,maintenance}=snapshot;
    const groups=nodes.map(node=>{
      const rows=links.filter(r=>r.node_id===node.id).map(r=>r.smoke_readings).sort((a,b)=>a.source_row-b.source_row);
      const alarms=rows.filter(r=>r.fire_alarm);
      const dates=rows.map(r=>Date.parse(r.recorded_at));
      return {...node,rows,alarms,range:`${date(Math.min(...dates))} — ${date(Math.max(...dates))} UTC`};
    });
    const body=name=>document.querySelector(`#demo-${name} .operations-body`);
    const evidence=g=>`<details><summary>Ver ${g.rows.length} IDs originales vinculados</summary><p class="source-ids">${g.rows.map(r=>esc(r.source_row)).join(', ')}</p></details>`;
    body('nodes').innerHTML=`<p><strong>${nodes.length} nodos virtuales · ${links.length} lecturas vinculadas</strong></p><div class="operation-cards">${groups.map(g=>`<article class="operation-card"><span class="source-pill">LOTE HISTÓRICO</span><h3>${esc(g.id)}</h3><p>${g.rows.length} lecturas · ${g.alarms.length} con alarma · ${g.rows.length-g.alarms.length} sin alarma</p><p>Temperatura media: <strong>${number(g.rows.reduce((n,r)=>n+r.temperature_c,0)/g.rows.length)} °C</strong></p><p class="reading-muted">${g.range}</p>${evidence(g)}</article>`).join('')}</div>`;
    body('cases').innerHTML=`<p>Un caso por lote con etiquetas positivas: <strong>${cases.length} casos</strong> agrupan <strong>${groups.reduce((n,g)=>n+g.alarms.length,0)} lecturas con alarma</strong>. No representan incendios confirmados ni episodios continuos.</p><div class="operation-cards">${cases.map(item=>{const g=groups.find(n=>n.id===item.node_id);return `<article class="operation-card"><span class="source-pill">REVISIÓN HISTÓRICA</span><h3>CASO-${esc(g.id)}</h3><p>Nodo ${esc(g.id)} · ${g.alarms.length} etiquetas Fire Alarm = 1 de ${g.rows.length} lecturas.</p><p class="reading-muted">${g.range}</p>${control('demo_cases',item,['Pendiente','En revisión','Revisado'])}${evidence(g)}</article>`;}).join('')}</div>`;
    body('maintenance').innerHTML=`<p>Plan preventivo propuesto para los ${nodes.length} lotes. El CSV no contiene averías, visitas, técnicos ni fechas de mantenimiento. Los estados registran el trabajo de demostración del administrador.</p><div class="operation-cards">${maintenance.map(item=>{const g=groups.find(n=>n.id===item.node_id);return `<article class="operation-card"><span class="source-pill">TAREA SIMULADA</span><h3>MT-${esc(g.id)}</h3><p>${esc(item.task)}</p><p>Base: ${g.rows.length} lecturas, ${g.alarms.length} etiquetas positivas.</p><p class="reading-muted">Responsable y fecha de visita: sin asignar.</p>${control('demo_maintenance',item,['Pendiente','En progreso','Completada'])}${evidence(g)}</article>`;}).join('')}</div>`;
  }
  async function refresh(){
    document.querySelectorAll('.operations-retry').forEach(b=>b.disabled=true);
    try{
      const {nodes,links,cases,maintenance}=await B.listOperations();
      snapshot={nodes,links,cases,maintenance};render();status(`Datos y estados consultados ${new Date().toLocaleString('es-PE',{timeZone:'America/Lima'})} (Perú). Estados compartidos en servicio remoto; lecturas históricas, no telemetría actual.`);
    }catch(error){status(`No se pudieron actualizar estas secciones. ${snapshot?'Se conserva la última consulta. ':''}Pulsa Actualizar para reintentar.`,true);}
    finally{document.querySelectorAll('.operations-retry').forEach(b=>b.disabled=false);}
  }
  return {setup,refresh,getSnapshot:()=>snapshot};
})();
