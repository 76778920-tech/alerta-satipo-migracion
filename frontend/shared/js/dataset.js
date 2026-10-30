/* Datos históricos: valores originales, nunca estimaciones de riesgo en vivo. */
window.SatipoDataset = (() => {
  let readings = [], container, page = 0, filter = 'all', query = '', selected = null, loaded = false, loading = false;
  const size = 12;
  const number = value => typeof value === 'number' && Number.isFinite(value);
  const fmt = (value, unit = '') => number(value) ? `${new Intl.NumberFormat('es-PE',{maximumFractionDigits:3}).format(value)}${unit}` : 'No disponible';
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value)) : 'Fecha no disponible';
  const esc = value => window.SatipoBackend.escapeHTML(value);
  const alarm = value => value === true ? 'Con alarma' : value === false ? 'Sin alarma' : 'Etiqueta no disponible';
  const q = selector => container.querySelector(selector);
  function render() {
    const positive = readings.filter(r=>r.fire_alarm === true).length;
    const negative = readings.filter(r=>r.fire_alarm === false).length;
    const temps = readings.map(r=>r.temperature_c).filter(number);
    const average = temps.length ? temps.reduce((a,b)=>a+b,0)/temps.length : null;
    const invalid = readings.filter(r=>!number(r.source_row)||!number(r.temperature_c)||!number(r.humidity_pct)||r.humidity_pct<0||r.humidity_pct>100||!Number.isFinite(Date.parse(r.recorded_at))||typeof r.fire_alarm!=='boolean').length;
    q('#dataset-summary').textContent = `${readings.length} registros · ${positive} con alarma · ${negative} sin alarma · fuente: ${window.SatipoBackend.cloud?'servicio remoto':'archivo local'}`;
    q('#reading-kpis').innerHTML = [
      ['Lecturas disponibles',readings.length,'Muestra histórica importada'],
      ['Con alarma',positive,'Etiqueta original: Fire Alarm = 1'],
      ['Sin alarma',negative,'Etiqueta original: Fire Alarm = 0'],
      ['Temperatura media',fmt(average,' °C'),`Calculada sobre ${temps.length} lecturas válidas`]
    ].map(([label,value,note])=>`<article class="reading-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
    q('#dataset-quality').textContent = invalid ? `${invalid} registros tienen campos incompletos o inválidos. No se sustituyen por cero.` : readings.length !== 300 ? `Se esperaban 300 registros; hay ${readings.length} disponibles. Revisa la importación.` : '300 registros disponibles · campos principales verificados';
    q('#dataset-quality').classList.toggle('quality-warning',invalid>0||readings.length!==300);
    const filtered = readings.filter(r=>(filter==='all'||(filter==='1'?r.fire_alarm===true:r.fire_alarm===false)) && String(r.source_row??'').includes(query));
    const pages = Math.max(1,Math.ceil(filtered.length/size)); page = Math.min(page,pages-1);
    const rows = filtered.slice(page*size,(page+1)*size);
    q('#dataset-rows').innerHTML = rows.length ? rows.map(r=>`<tr><td><button type="button" class="reading-link" data-reading="${esc(r.source_row)}" aria-label="Ver lectura ${esc(r.source_row)}">#${esc(r.source_row)}</button></td><td>${esc(date(r.recorded_at))}</td><td>${fmt(r.temperature_c,' °C')}</td><td>${fmt(r.humidity_pct,' %')}</td><td>${fmt(r.tvoc_ppb)}</td><td>${fmt(r.eco2_ppm)}</td><td><span class="reading-badge ${r.fire_alarm===true?'alarm':r.fire_alarm===false?'normal':'unknown'}">${alarm(r.fire_alarm)}</span></td></tr>`).join('') : '<tr><td colspan="7" class="reading-empty">No hay lecturas para estos filtros. Prueba otro ID o selecciona «Todas».</td></tr>';
    q('#dataset-position').textContent = filtered.length ? `${page*size+1}–${Math.min((page+1)*size,filtered.length)} de ${filtered.length} · página ${page+1} de ${pages}` : '0 resultados';
    q('#dataset-prev').disabled = page===0;
    q('#dataset-next').disabled = page>=pages-1;
    if(!filtered.some(r=>r.source_row===selected))selected=rows[0]?.source_row??null;
    renderDetail();
    const share=readings.length?positive/readings.length*100:0;
    q('#alarm-share').style.width=`${share}%`;
    q('#alarm-caption').textContent=`${fmt(share)} % de esta muestra tiene etiqueta de alarma. No representa la probabilidad de un incendio actual.`;
  }
  function renderDetail() {
    const row=readings.find(r=>r.source_row===selected);
    const detail=q('#dataset-reading');detail.replaceChildren();
    if(!row){detail.textContent='Selecciona una lectura de la tabla para ver todos sus campos.';return;}
    const title=document.createElement('h3');title.textContent=`Detalle de lectura #${row.source_row}`;detail.append(title);
    const note=document.createElement('p');note.className='reading-muted';note.textContent='Valores conservados del CSV. Las fechas se muestran en UTC.';detail.append(note);
    const fields=[['Fecha UTC',date(row.recorded_at)],['Temperatura',fmt(row.temperature_c,' °C')],['Humedad',fmt(row.humidity_pct,' %')],['TVOC',fmt(row.tvoc_ppb,' ppb')],['eCO₂',fmt(row.eco2_ppm,' ppm')],['Presión',fmt(row.pressure_hpa,' hPa')],['PM1.0',fmt(row.pm1_0)],['PM2.5',fmt(row.pm2_5)],['Raw H2',fmt(row.raw_h2)],['Raw Ethanol',fmt(row.raw_ethanol)],['NC0.5',fmt(row.nc0_5)],['NC1.0',fmt(row.nc1_0)],['NC2.5',fmt(row.nc2_5)],['CNT',fmt(row.cnt)],['Fire Alarm',alarm(row.fire_alarm)]];
    const dl=document.createElement('dl');dl.className='dataset-values';
    fields.forEach(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);});detail.append(dl);
    const foot=document.createElement('p');foot.className='reading-muted';foot.textContent='PM, NC y lecturas Raw: el archivo original no especifica sus unidades en los encabezados.';detail.append(foot);
  }
  async function refresh() {
    if(loading)return false;loading=true;
    q('#dataset-retry').disabled=true;
    q('#dataset-connection').textContent='Consultando lecturas…';
    try {
      const rows=await window.SatipoBackend.listReadings();
      readings=rows;loaded=true;render();
      q('#dataset-connection').textContent=`Consulta completada a las ${new Date().toLocaleTimeString('es-PE')}. Datos históricos, no transmisión en vivo.`;
      q('#dataset-connection').classList.remove('quality-warning');q('#dataset-retry').textContent='Actualizar lecturas';return true;
    } catch {
      q('#dataset-connection').textContent=loaded?'No se pudo actualizar. Se conserva la última consulta; revisa tu conexión y reintenta.':'No se pudieron cargar las lecturas. Revisa tu conexión y pulsa «Reintentar lectura».';
      q('#dataset-connection').classList.add('quality-warning');q('#dataset-retry').textContent='Reintentar lectura';
      if(!loaded){q('#dataset-summary').textContent='Lecturas no disponibles';q('#dataset-rows').innerHTML='<tr><td colspan="7" class="reading-empty">La consulta falló. No se muestran datos simulados.</td></tr>';}
      return false;
    } finally {loading=false;q('#dataset-retry').disabled=false;}
  }
  async function init(target) {
    if(!target)return;container=target;await window.SatipoBackend.ready;
    container.innerHTML=`<div class="reading-heading"><div><p class="reading-eyebrow">BIBLIOTECA DE DATOS</p><h2>Lecturas históricas</h2><p id="dataset-summary">Consultando la muestra…</p></div><span class="source-pill">Smoke Detection IoT</span></div>
      <div id="reading-kpis" class="reading-kpis"></div>
      <div class="reading-context"><div><strong>Una muestra para análisis</strong><p>La alarma es una etiqueta del archivo de origen. Estas lecturas no corresponden a sensores activos en Satipo.</p></div><div class="alarm-distribution"><div class="alarm-track"><span id="alarm-share"></span></div><p id="alarm-caption"></p></div></div>
      <div class="reading-toolbar"><div><label for="dataset-filter">Etiqueta de alarma</label><select id="dataset-filter"><option value="all">Todas las lecturas</option><option value="1">Con alarma</option><option value="0">Sin alarma</option></select></div><div><label for="dataset-search">Buscar ID de origen</label><input id="dataset-search" type="search" placeholder="Ej.: 201" inputmode="numeric"></div><button type="button" id="dataset-retry">Reintentar lectura</button></div>
      <output id="dataset-connection" aria-live="polite" class="reading-muted"></output><p id="dataset-quality" class="reading-muted"></p>
      <div class="readings-scroll" tabindex="0" role="region" aria-label="Tabla de lecturas históricas, desplazable horizontalmente"><table class="readings-table"><thead><tr><th scope="col">ID original</th><th scope="col">Captura (UTC)</th><th scope="col">Temperatura</th><th scope="col">Humedad</th><th scope="col">TVOC (ppb)</th><th scope="col">eCO₂ (ppm)</th><th scope="col">Etiqueta</th></tr></thead><tbody id="dataset-rows"></tbody></table></div>
      <div class="dataset-controls"><button type="button" id="dataset-prev" disabled>← Anterior</button><output id="dataset-position" aria-live="polite">Sin resultados</output><button type="button" id="dataset-next" disabled>Siguiente →</button></div>
      <section id="dataset-reading" class="reading-detail" aria-label="Detalle del registro seleccionado"></section>`;
    q('#dataset-filter').onchange=e=>{filter=e.target.value;page=0;render();};
    q('#dataset-search').oninput=e=>{query=e.target.value.trim();page=0;render();};
    q('#dataset-prev').onclick=()=>{page=Math.max(0,page-1);render();};
    q('#dataset-next').onclick=()=>{page++;render();};
    q('#dataset-retry').onclick=refresh;
    q('#dataset-rows').onclick=e=>{const button=e.target.closest('[data-reading]');if(button){selected=Number(button.dataset.reading);renderDetail();q('#dataset-reading').scrollIntoView({block:'nearest'});}};
    return refresh();
  }
  return {init,refresh,getSnapshot:()=>readings.map(row=>({...row}))};
})();
