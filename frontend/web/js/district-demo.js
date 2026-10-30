/* Demostración local: nunca escribe en servicio remoto ni ejecuta el modelo. */
window.SatipoDistrictDemo = (() => {
  let root, scenario=null, history=[];
  const simulation=window.SatipoSimulation;
  const $=s=>root.querySelector(s);
  const escape=s=>window.SatipoBackend.escapeHTML(String(s));
  function generate() {
    const result=simulation.generate($('#demo-profile').value, window.SatipoBackend.profile?.id || 'admin');
    scenario=result.scenario;history=result.history;
    const saved=result.saved;render();
    $('#demo-status').textContent=saved?'Escenario simulado guardado en este navegador. No se crearon incidentes reales.':'Escenario generado; el navegador no permite guardar el historial. Puedes exportarlo.';
  }
  function render() {
    const filter=$('#demo-filter').value;
    const rows=scenario.districts.filter(r=>filter==='Todos'||r.level===filter).sort((a,b)=>b.score-a.score);
    $('#demo-period').textContent=`Escenario ${scenario.id.slice(0,8)} · Creado ${new Date(scenario.generatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'})} (hora de Perú) · Horizonte ilustrativo: 24 horas`;
    $('#demo-summary').innerHTML=['Alto','Medio','Bajo'].map(level=>`<article class="kpi-card"><h4>Nivel ${level.toLowerCase()} simulado</h4><strong>${scenario.districts.filter(r=>r.level===level).length}</strong><small>Distritos de este escenario simulado</small></article>`).join('');
    $('#demo-cards').innerHTML=rows.map(row=>`<article class="operation-card"><small>SIMULACIÓN · UBIGEO ${escape(row.ubigeo)}</small><h3>${escape(row.name)}</h3><span class="badge ${row.level==='Alto'?'alert':row.level==='Medio'?'warn':'good'}">${row.level} · simulado</span><p><strong>${row.score}/100</strong> · Índice demostrativo</p><meter min="0" max="100" value="${row.score}" aria-label="Índice simulado de ${escape(row.name)}">${row.score}</meter><dl class="demo-weather"><dt>Temperatura simulada</dt><dd>${row.temperatureC} °C</dd><dt>Humedad simulada</dt><dd>${row.humidityPct} %</dd><dt>Lluvia simulada · 24 h</dt><dd>${row.rainMm} mm</dd><dt>Viento simulado</dt><dd>${row.windKmh} km/h</dd></dl><p>No representa probabilidad de incendio. ${row.level==='Alto'?'En una demostración, este distrito aparecería primero para revisión.':'Escenario de ejemplo para probar la visualización.'}</p></article>`).join('')||'<p class="empty-state">No hay distritos de ese nivel en este escenario. Puedes generar otro.</p>';
    $('#demo-history').innerHTML=history.map(item=>`<option value="${escape(item.id)}" ${item.id===scenario.id?'selected':''}>${escape(item.profile)} · ${escape(new Date(item.generatedAt).toLocaleString('es-PE',{timeZone:'America/Lima'}))} · ${escape(item.id.slice(0,8))}</option>`).join('');
    $('#demo-count').textContent=`${rows.length} de 9 distritos · Niveles arbitrarios: bajo 0–39, medio 40–69, alto 70–100.`;
  }
  function download() {
    const blob=new Blob([JSON.stringify(scenario,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`SIMULACION-satipo-${scenario.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#demo-status').textContent='Escenario exportado e identificado como SIMULATION_ONLY. No contiene predicciones reales.';
  }
  function init(element) {
    root=element;
    root.innerHTML=`<div class="reading-heading"><div><p class="eyebrow">DEMOSTRACIÓN TERRITORIAL</p><h2>Escenarios por distrito</h2></div><span class="badge warn">SIMULACIÓN · DATOS SIMULADOS</span></div>
    <p class="reference-note"><strong>Condiciones e índices simulados, coherentes entre sí.</strong> Sirven para demostrar el funcionamiento del panel. No proceden del modelo, de NASA ni de sensores; no anuncian incendios reales. Los nombres de los distritos sí corresponden a Satipo. El índice usa una regla ilustrativa: aumenta con calor, sequedad y viento, y disminuye con lluvia. No está validada para pronosticar incendios.</p>
    <p id="demo-period"></p><div id="demo-summary" class="kpis-grid"></div>
    <div class="reading-toolbar"><label for="demo-profile">Escenario a generar</label><select id="demo-profile"><option>Variable</option><option>Seco</option><option>Lluvioso</option></select><label for="demo-filter">Nivel simulado</label><select id="demo-filter"><option>Todos</option><option>Alto</option><option>Medio</option><option>Bajo</option></select><button type="button" id="demo-generate" class="secondary-button">Generar otro escenario</button><button type="button" id="demo-download" class="secondary-button">Exportar simulación</button></div>
    <div class="reading-toolbar"><label for="demo-history">Historial local · últimos 10 escenarios</label><select id="demo-history"></select></div><output id="demo-status" class="operations-status" aria-live="polite"></output><p id="demo-count"></p><div id="demo-cards" class="operation-cards"></div>`;
    $('#demo-filter').addEventListener('change',render);
    $('#demo-generate').addEventListener('click',generate);
    $('#demo-download').addEventListener('click',download);
    $('#demo-history').addEventListener('change',()=>{
      scenario=history.find(item=>item.id===$('#demo-history').value);render();
      $('#demo-status').textContent='Escenario anterior recuperado del navegador. Conserva su fecha original; no representa condiciones actuales.';
    });
    history=simulation.history(window.SatipoBackend.profile?.id || 'admin');
    if(history.length){scenario=history[0];render();$('#demo-status').textContent='Último escenario simulado recuperado del historial local.';}else generate();
  }
  return {init};
})();
