/**
 * Panel web administrativo (carpeta /web).
 * Usa SatipoData de /shared para sensores, umbrales, reportes e incidentes.
 */

const AdminModule = (() => {
  const Data = window.SatipoData;
  const B = window.SatipoBackend;
  const esc = B.escapeHTML;
  let thresholds = Data.loadThresholds();
  let incidents = Data.readIncidents();

  const $ = (selector) => document.querySelector(selector);

  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value;
  };

  const showToast = (message, type = "success") => {
    let container = document.getElementById("admin-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "admin-toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  };

  const enrichedSensors = () => Data.enrichedSensors(thresholds);

  const renderKpis = () => {
    const items = enrichedSensors();
    const active = items.filter((sensor) => sensor.lastComm <= 10).length;
    const critical = items.filter((sensor) => sensor.risk >= 76).length;
    const avgRisk = Math.round(items.reduce((sum, sensor) => sum + sensor.risk, 0) / (items.length || 1));
    const avgBattery = Math.round(items.reduce((sum, sensor) => sum + sensor.battery, 0) / (items.length || 1));
    const communityReports = Data.readReports().length;

    const kpis = B.cloud ? [
      {label:'Reportes consultados',value:communityReports,detail:'Hasta 200 registros recientes'},
      {label:'Incidentes abiertos',value:incidents.filter(r=>!['Validado','Falso positivo'].includes(r.state)).length,detail:'Dentro de los incidentes consultados'},
      {label:'Sensores de campo',value:'Sin conexión',detail:'No se recibe telemetría en vivo'}
    ] : [
      { label: "Riesgo promedio", value: items.length ? `${avgRisk}%` : "Sin datos", detail: !items.length ? "Sin sensores conectados" : critical ? `${critical} nodo crítico` : "Sin nodos críticos" },
      { label: "Nodos activos", value: `${active}/${items.length}`, detail: "Última lectura menor a 10 min" },
      { label: "Batería media", value: items.length ? `${avgBattery}%` : "Sin datos", detail: "Solar LiFePO4" },
      { label: "Incidentes abiertos", value: incidents.filter((item) => item.state !== "Falso positivo" && item.state !== "Validado").length, detail: `${communityReports} reportes desde mobile` }
    ];

    const grid = $("#kpis-grid");
    if (!grid) return;

    grid.innerHTML = kpis.map((item) => `
      <article class="kpi-card">
        <h4>${item.label}</h4>
        <strong>${item.value}</strong>
        <small>${item.detail}</small>
      </article>`).join("");
  };

  const renderAdminMap = () => {
    const map = $("#admin-map");
    if (!map) return;
    if (!enrichedSensors().length) {map.textContent='No hay sensores georreferenciados conectados.';setText('#ops-summary','Sin telemetría');return;}

    map.innerHTML = enrichedSensors().map((sensor) => {
      const risk = Data.classifyRisk(sensor.risk);
      return `<button type="button" class="map-point ${risk.point}" style="left:${sensor.x}%; top:${sensor.y}%" title="${sensor.id} ${sensor.zone}: ${sensor.risk}%">${sensor.id.replace("N-", "")}</button>`;
    }).join("") + '<div class="map-zone zone-risk"></div>';

    const highest = enrichedSensors().sort((a, b) => b.risk - a.risk)[0];
    setText("#ops-summary", highest ? `${highest.zone} ${highest.risk}%` : "Sin sensores de campo conectados");
  };

  const renderTriage = () => {
    const list = $("#triage-list");
    if (!list) return;
    if(!enrichedSensors().length){list.innerHTML='<li class="empty-state">No hay lecturas de campo para priorizar.</li>';return;}

    list.innerHTML = enrichedSensors()
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5)
      .map((sensor) => {
        const risk = Data.classifyRisk(sensor.risk);
        return `
          <li>
            <div>
              <strong>${sensor.zone}</strong>
              <span>${sensor.id} - ${sensor.community}</span>
            </div>
            <span class="badge ${risk.className}">${sensor.risk}%</span>
          </li>`;
      }).join("");
  };

  const renderCommunityReports = () => {
    const box = $("#community-reports");
    if (!box) return;

    const reports = Data.readReports().slice(0, 4);
    if (!reports.length) {
      box.innerHTML = "<li class=\"empty-state\">Sin reportes recientes desde la app móvil.</li>";
      return;
    }

    box.innerHTML = reports.map((report) => {
      const date = new Date(report.createdAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      return `<li><strong>${esc(report.location)}</strong><span>${esc(report.severityLabel)} · ${date}</span></li>`;
    }).join("");
  };

  const renderSensorTable = () => {
    const table = $("#sensor-table");
    if (!table) return;
    if(!enrichedSensors().length){table.innerHTML='<tr><td colspan="8" class="empty-state">No hay telemetría de campo disponible.</td></tr>';setText('#telemetry-updated','Sin lecturas de campo');return;}

    table.innerHTML = enrichedSensors()
      .sort((a, b) => b.risk - a.risk)
      .map((sensor) => {
        const risk = Data.classifyRisk(sensor.risk);
        return `
          <tr>
            <td><strong>${sensor.id}</strong></td>
            <td>${sensor.zone}</td>
            <td>${sensor.smoke}%</td>
            <td>${sensor.temp.toFixed(1)} C</td>
            <td>${sensor.humidity}%</td>
            <td>${sensor.wind} km/h</td>
            <td><strong>${sensor.risk}%</strong></td>
            <td><span class="badge ${risk.className}">${risk.text}</span></td>
          </tr>`;
      }).join("");

    setText("#telemetry-updated", `Actualizado ${new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`);
  };

  const renderNodesTable = (query = "") => {
    const table = $("#nodes-table");
    if (!table) return;

    const normalizedQuery = query.trim().toLowerCase();
    const rows = enrichedSensors().filter((sensor) => {
      const haystack = `${sensor.id} ${sensor.zone} ${sensor.community} ${sensor.type}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    if(!rows.length){table.innerHTML='<tr><td colspan="8" class="empty-state">No hay nodos disponibles. La muestra histórica no incluye dispositivos georreferenciados.</td></tr>';return;}
    table.innerHTML = rows.map((sensor) => {
      const risk = Data.classifyRisk(sensor.risk);
      return `
        <tr>
          <td><strong>${sensor.id}</strong></td>
          <td>${sensor.zone}<br><small>${sensor.community}</small></td>
          <td>${sensor.type}</td>
          <td><span class="badge ${risk.className}">${risk.text}</span></td>
          <td>Hace ${sensor.lastComm} min</td>
          <td>${sensor.battery}%</td>
          <td>${sensor.rssi} dBm</td>
          <td><button class="link-button node-action" type="button" data-node="${sensor.id}">Diagnosticar</button></td>
        </tr>`;
    }).join("");
  };

  const renderIncidentsTable = (filter = "Todos") => {
    const table = $("#incidents-table");
    if (!table) return;

    const rows = filter === "Todos" ? incidents : incidents.filter((item) => item.state === filter);
    if(!rows.length){table.innerHTML='<tr><td colspan="8" class="empty-state">No hay incidentes para este filtro.</td></tr>';return;}
    table.innerHTML = rows.map((incident) => {
      const risk = Data.classifyRisk(incident.risk);
      const stateClass = incident.state === "Validado" ? "good" : incident.state === "Falso positivo" ? "good" : incident.state === "En revisión" ? "warn" : "alert";
      return `
        <tr>
          <td>${esc(incident.date)}</td>
          <td>${esc(incident.zone)}</td>
          <td>${esc(incident.type)}</td>
          <td>${esc(incident.nodes.join(", "))}</td>
          <td><span class="badge ${risk.className}">${incident.risk}%</span></td>
          <td><span class="badge ${stateClass}">${esc(incident.state)}</span></td>
          <td>${esc(incident.owner)}</td>
          <td><button class="link-button incident-action" type="button" data-id="${esc(incident.id)}">Avanzar</button></td>
        </tr>`;
    }).join("");
  };

  const renderMaintenanceBoard = () => {
    const board = $("#maintenance-board");
    if (!board) return;
    if (!Data.maintenance.length) {board.textContent='No hay un módulo de mantenimiento conectado todavía.';return;}

    board.innerHTML = Data.maintenance.map((item) => {
      const priority = item.priority === "Alta" ? "alert" : item.priority === "Media" ? "warn" : "good";
      return `
        <article class="maintenance-card">
          <div>
            <strong>${item.node}</strong>
            <span>${item.task}</span>
          </div>
          <div class="maintenance-meta">
            <span class="badge ${priority}">${item.priority}</span>
            <small>${item.assigned} - ${item.due}</small>
          </div>
          <progress value="${item.state === "Completada" ? 100 : item.state === "En progreso" ? 55 : 15}" max="100"></progress>
        </article>`;
    }).join("");
  };

  const renderAll = () => {
    incidents = Data.readIncidents();
    renderKpis();
    renderAdminMap();
    renderTriage();
    renderCommunityReports();
    renderSensorTable();
    renderNodesTable($("#node-search")?.value || "");
    renderIncidentsTable($("#incident-filter")?.value || "Todos");
    renderMaintenanceBoard();
  };

  const setupViewNavigation = () => {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const viewName = link.dataset.view;
        document.querySelectorAll(".view-section").forEach((view) => view.classList.remove("active"));
        document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
        document.getElementById(`view-${viewName}`)?.classList.add("active");
        link.classList.add("active");
        document.querySelectorAll('.nav-link').forEach(item=>item.removeAttribute('aria-current'));
        link.setAttribute('aria-current','page');
        setText('#view-title',link.textContent.trim());
        document.querySelector('.admin-content').scrollTop=0;
      });
    });
  };

  const setupFiltersAndActions = () => {
    $("#incident-filter")?.addEventListener("change", (event) => renderIncidentsTable(event.target.value));
    $("#node-search")?.addEventListener("input", (event) => renderNodesTable(event.target.value));

    document.addEventListener("click", async (event) => {
      const incidentButton = event.target.closest(".incident-action");
      if (incidentButton) {
        const incident=incidents.find(item=>item.id===incidentButton.dataset.id);
        if(!incident) return;
        const state=incident.state==='Nuevo'?'En revisión':incident.state==='En revisión'?'Validado':incident.state;
        incidentButton.disabled=true;
        try {
          await Data.updateIncident(incident.id,state,incident.state);
          await Data.refresh();renderAll();showToast('Estado del incidente actualizado.','success');
        } catch(error) {showToast(error.message||'No se pudo actualizar. Sincroniza e intenta otra vez.','error');}
        finally {incidentButton.disabled=false;}

      }

      const nodeButton = event.target.closest(".node-action");
      if (nodeButton) {
        const sensor = enrichedSensors().find((item) => item.id === nodeButton.dataset.node);
        if (sensor) {
          showToast(`${sensor.id}: RSSI ${sensor.rssi} dBm, batería ${sensor.battery}%, riesgo ${sensor.risk}%.`, "info");
        }
      }
    });

    $("#plan-maintenance-btn")?.addEventListener("click", () => {
      showToast("La planificación de visitas todavía no está implementada.", "info");
    });

    $("#refresh-ops-btn")?.addEventListener("click", async () => {
      $('#refresh-ops-btn').disabled=true;
      try {await Data.refresh();thresholds=Data.loadThresholds();renderAll();const ok=await window.SatipoDataset.refresh();if(B.cloud)await window.SatipoOperations.refresh();showToast(ok?'Reportes y lecturas actualizados.':'Reportes actualizados; no se pudieron actualizar las lecturas.',ok?'info':'warning');}
      catch {showToast('No se pudo sincronizar. Se conserva la última vista.','error');}
      finally {$('#refresh-ops-btn').disabled=false;}
    });
  };

  const renderModelStatus = () => {
    const info = Data.getModelInfo();
    const label = info.ok
      ? `${info.modelId} · v${info.version}${info.hasLocalOverrides ? " · con ajustes locales" : ""}`
      : "Defaults locales (JSON Colab no cargado)";
    setText("#model-status-label", label);
    setText("#model-notes", info.notes + (info.error ? ` Detalle: ${info.error}` : ""));
  };

  const setupSettingsForm = () => {
    const form = $("#settings-form");
    if (!form) return;

    $("#temp-threshold").value = thresholds.tempCritical;
    $("#smoke-threshold").value = thresholds.smokeCritical;
    $("#humidity-threshold").value = thresholds.humidityDry;
    $("#wind-threshold").value = thresholds.windRisk;
    renderModelStatus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      thresholds = {
        tempCritical: Number($("#temp-threshold").value),
        smokeCritical: Number($("#smoke-threshold").value),
        humidityDry: Number($("#humidity-threshold").value),
        windRisk: Number($("#wind-threshold").value)
      };

      const button=form.querySelector('[type=submit]');button.disabled=true;
      try {await Data.saveThresholds(thresholds);renderAll();renderModelStatus();showToast('Umbrales guardados. No se aplican a la etiqueta del CSV.','success');}
      catch {thresholds=Data.loadThresholds();showToast('No se pudieron guardar los umbrales.','error');}
      finally {button.disabled=false;}
    });

    $('#reset-colab-model-btn')?.addEventListener('click', async () => {
      try {await Data.clearThresholdOverrides();}
      catch {showToast('No se pudo restaurar el modelo.','error');return;}
      thresholds = Data.loadThresholds();
      $("#temp-threshold").value = thresholds.tempCritical;
      $("#smoke-threshold").value = thresholds.smokeCritical;
      $("#humidity-threshold").value = thresholds.humidityDry;
      $("#wind-threshold").value = thresholds.windRisk;
      renderAll();
      renderModelStatus();
      showToast("Umbrales restaurados al modelo exportado desde Colab.", "info");
    });
  };

  const setupExport = () => {
    $("#export-admin-btn")?.addEventListener("click", () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        model: Data.getModelInfo(),
        thresholds,
        sensors: enrichedSensors(),
        incidents,
        communityReports: Data.readReports()
        ,historicalReadings: window.SatipoDataset.getSnapshot(),
        demonstration: window.SatipoOperations.getSnapshot()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "alerta-satipo-operacion.json";
      link.click();
      URL.revokeObjectURL(link.href);
      showToast("Datos operativos exportados.", "success");
    });
  };

  const setupLogoutAdmin = () => {
    $("#logout-admin-btn")?.addEventListener("click", async () => {
      if (confirm("¿Deseas cerrar sesión?")) {
        try {await B.logout();} catch {showToast("No se pudo cerrar sesión.","error");}
      }
    });
  };

  const displayUserInfo = () => {
    const userEmail = B.userEmail();
    const userName = B.userName();
    setText(".admin-user", userName || userEmail || "Admin - Satipo");
  };

  const init = async () => {
    if (!Data) {
      console.error("SatipoData no cargó. Revisa shared/js/data.js");
      return;
    }

    if (!await B.guard("admin")) return;
    await Data.ready;
    await Data.refresh();
    thresholds = Data.loadThresholds();
    incidents = Data.readIncidents();
    displayUserInfo();
    renderAll();
    setupViewNavigation();
    setupFiltersAndActions();
    setupSettingsForm();
    setupExport();
    setupLogoutAdmin();
    if(B.cloud){document.querySelector('.admin-grid').hidden=true;document.querySelector('#sensor-table').closest('.ops-panel').hidden=true;if($('#plan-maintenance-btn'))$('#plan-maintenance-btn').disabled=true;}
    setText('#data-mode',B.cloud?'servicio remoto conectado · reportes e incidentes persistentes · sin sensores de campo conectados':'DEMO: sensores, incidentes y enlace simulados en este navegador.');
    window.SatipoForecast.init($('#forecast-explorer'));
    window.SatipoDistrictDemo.init($('#district-demo'));
    window.SatipoPredictions.init($('#prediction-explorer'));
    window.SatipoProjectView.init($('#project-explorer'));
    window.SatipoEnvironment.init($('#environment-explorer'));
    await window.SatipoPmv1.init($('#pmv1-explorer'));
    await window.SatipoDataset.init($('#dataset-explorer'));
    if(B.cloud) await window.SatipoOperations.setup();
  };

  return { init };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    AdminModule.init().catch(window.SatipoBackend.fatal);
  });
} else {
  AdminModule.init().catch(window.SatipoBackend.fatal);
}
