/**
 * App móvil comunitaria - Sprint 1
 * Nav única, home limpio, banner de red y telemetría en vivo.
 */

const AppModule = (() => {
  const Data = window.SatipoData;
  const B = window.SatipoBackend;
  const esc = B.escapeHTML;
  let thresholds = Data.loadThresholds();
  let currentScreen = "home";
  let networkOnline = true;
  let liveTimer = null;
  let networkTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value;
  };

  const showToast = (message, type = "success") => {
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
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
    }, 2800);
  };

  const sensors = () => Data.enrichedSensors(thresholds);
  const getPrioritySensor = () => sensors().sort((a, b) => b.risk - a.risk)[0];

  const updateClock = () => {
    const timestamp = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    setText("#live-clock", timestamp);
  };

  const renderNetworkBanner = () => {
    const banner = $("#net-banner");
    const label = $("#net-label");
    const dot = $("#net-dot");
    const chip = $("#model-chip");
    if (!banner || !label || !dot) return;
    if (B.cloud) {
      label.textContent = 'servicio remoto · sin telemetría de campo conectada';
      if (chip) chip.textContent = 'Datos históricos';
      return;
    }

    banner.classList.toggle("is-offline", !networkOnline);
    label.textContent = networkOnline
      ? "DEMO · enlace LoRa simulado"
      : "DEMO · enlace simulado interrumpido";
    dot.setAttribute("aria-label", networkOnline ? "En línea" : "Offline");

    if (chip) {
      const info = Data.getModelInfo();
      chip.textContent = info.ok ? `Colab ${info.version}` : "Defaults";
      chip.classList.toggle("is-fallback", !info.ok);
      chip.title = info.ok
        ? `${info.modelId} · exportado ${info.exportedAt || "N/D"}`
        : (info.error || info.notes);
    }
  };

  const renderHome = () => {
    const priority = getPrioritySensor();
    if (!priority) {
      setText('#risk-status', 'Sin telemetría');
      setText('#risk-zone', 'Satipo · vigilancia comunitaria');
      setText('#risk-title', 'Sin sensores de campo conectados');
      setText('#risk-evidence', 'Consulta la muestra histórica debajo. No representa el riesgo actual de tu zona.');
      ['#risk-score','#temp-main','#smoke-main','#wind-main'].forEach(id=>setText(id,'—'));
      $('#risk-meter').style.background='#dce6df';
      $('#risk-score').style.color='#53685b';
      return;
    }
    const risk = Data.classifyRisk(priority.risk);
    const tip = risk.key === "danger"
      ? "No te acerques. Avisa a vecinos y escala apoyo si hay fuego visible."
      : risk.key === "warning"
        ? "Mantén observación y reporta si el humo se acerca a viviendas."
        : "Red estable. Reporta solo si ves algo anómalo en tu zona.";

    setText("#risk-status", risk.label);
    setText("#risk-zone", `${priority.zone} · ${priority.community}`);
    setText("#risk-title", risk.detail);
    setText("#risk-evidence", `Humo ${priority.smoke}% · Temp ${priority.temp.toFixed(1)}°C · ${priority.id}`);
    setText("#risk-score", `${priority.risk}%`);
    setText("#temp-main", `${priority.temp.toFixed(1)}°`);
    setText("#smoke-main", `${priority.smoke}%`);
    setText("#wind-main", `${priority.wind} km/h`);
    setText("#safety-tip", tip);

    const meter = $("#risk-meter");
    if (meter) {
      const color = risk.key === "danger" ? "var(--danger)" : risk.key === "warning" ? "var(--warning)" : "var(--success)";
      meter.style.background = `conic-gradient(${color} 0 ${priority.risk}%, rgba(17,45,31,0.08) 0 100%)`;
    }

    const status = $("#risk-status");
    if (status) status.className = `status-pill ${risk.key}`;

    const hero = $("#risk-hero");
    if (hero) {
      hero.classList.toggle("is-critical", risk.key === "danger");
      hero.classList.toggle("is-watch", risk.key === "warning");
    }
  };

  const renderSensorList = () => {
    const container = $("#map-sensor-list");
    if (!container) return;

    const sorted = sensors().sort((a, b) => b.risk - a.risk);
    if (!sorted.length) {container.textContent='Todavía no hay nodos de campo registrados.';setText('#sensor-count','0 nodos');return;}
    container.innerHTML = sorted.map((sensor) => {
      const risk = Data.classifyRisk(sensor.risk);
      return `
        <div class="sensor-item">
          <div class="sensor-left">
            <span class="sensor-dot ${risk.key === "danger" ? "danger" : risk.key === "warning" ? "warning" : ""}"></span>
            <div class="sensor-info">
              <span class="sensor-name">${sensor.id} · ${sensor.zone}</span>
              <span class="sensor-meta">${sensor.community} · hace ${sensor.lastComm} min</span>
            </div>
          </div>
          <span class="sensor-value">${sensor.risk}%</span>
        </div>`;
    }).join("");

    setText("#sensor-count", `${sorted.length} nodos`);
  };

  const renderMap = () => {
    const container = $("#satipo-map");
    if (!container) return;

    const items = sensors();
    if (!items.length) {container.textContent='Mapa pendiente de conectar a sensores con coordenadas reales.';setText('#map-summary','Sin telemetría');return;}
    container.innerHTML = items.map((sensor) => {
      const risk = Data.classifyRisk(sensor.risk);
      return `<button type="button" class="map-point ${risk.point}" style="left:${sensor.x}%; top:${sensor.y}%" title="${sensor.zone}: ${sensor.risk}%">${sensor.id.replace("N-", "")}</button>`;
    }).join("") + '<div class="map-zone zone-risk"></div>';

    const critical = items.filter((sensor) => sensor.risk >= 76).length;
    const watch = items.filter((sensor) => sensor.risk >= 55 && sensor.risk < 76).length;
    setText("#map-summary", `${critical} crítico · ${watch} vig.`);
  };

  const renderAlertsTimeline = (filter = "all") => {
    const container = $("#alerts-timeline");
    if (!container) return;

    const filtered = filter === "all" ? Data.alerts : Data.alerts.filter((item) => item.state === filter);
    setText("#alert-count", String(filtered.length));

    if (!filtered.length) {
      container.innerHTML = '<li class="empty-state">No hay alertas en este filtro.</li>';
      return;
    }

    container.innerHTML = filtered.map((item) => {
      const tagClass = item.state === "critical" ? "tag-danger" : item.state === "watch" ? "tag-warning" : "tag-normal";
      return `
        <li>
          <div class="info">
            <strong>${esc(item.title)}</strong>
            <time>${esc(item.date)} · ${esc(item.zone)}</time>
            <small>${esc(item.eta)}</small>
          </div>
          <span class="tag ${tagClass}">${item.score}%</span>
        </li>`;
    }).join("");
  };

  const renderSavedReports = () => {
    const container = $("#saved-reports");
    const count = $("#report-count");
    if (!container) return;

    const reports = Data.readReports().filter(r=>!B.cloud || r.user_id===B.profile.id);
    if (count) count.textContent = `${reports.length} enviados`;

    if (!reports.length) {
      container.innerHTML = '<li class="empty-state">Aún no has enviado reportes desde este dispositivo.</li>';
      return;
    }

    container.innerHTML = reports.slice(0, 6).map((report) => {
      const date = new Date(report.createdAt).toLocaleString("es-PE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
      return `<li><span class="date">${date}</span><span>${esc(report.location)} · ${esc(report.severityLabel)}</span></li>`;
    }).join("");
  };

  const screenNavigate = (screenName) => {
    if (!screenName) return;
    currentScreen = screenName;

    $$(".screen").forEach((screen) => {
      const active = screen.id === `screen-${screenName}`;
      screen.classList.toggle("active", active);
      screen.hidden = !active;
    });

    $$("#bottom-nav .nav-item").forEach((item) => {
      const isActive = item.dataset.screen === screenName
        || (screenName === "help" && item.dataset.screen === "home");
      item.classList.toggle("active", isActive);
    });

    if (screenName === "map") {
      renderMap();
      renderSensorList();
    }

    if (screenName === "alerts") {
      renderAlertsTimeline($("#alert-filter")?.value || "all");
    }

    if (screenName === "profile") renderSavedReports();
  };

  const setupNavigation = () => {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-screen]");
      if (!trigger || trigger.tagName === "SECTION") return;
      if (!trigger.classList.contains("nav-item")
        && !trigger.classList.contains("screen-link")
        && !trigger.classList.contains("back-button")) {
        return;
      }
      event.preventDefault();
      screenNavigate(trigger.dataset.screen);
    });

    $("#alert-filter")?.addEventListener("change", (event) => {
      renderAlertsTimeline(event.target.value);
    });
  };

  const setupProfile = () => {
    const userEmail = B.userEmail() || "usuario@satipo.pe";
    const userName = B.userName() || "Usuario";
    setText("#profile-name", userName);
    setText("#profile-role", userEmail);
    setText("#profile-avatar", userName.charAt(0).toUpperCase());

    [
      { key: "notif-push", defaultValue: true },
      { key: "notif-sound", defaultValue: true },
      { key: "share-location", defaultValue: false }
    ].forEach(({ key, defaultValue }) => {
      const input = document.getElementById(key);
      if (!input) return;
      input.checked = B.preference(key, defaultValue);
      input.addEventListener('change', async () => {
        const next=input.checked; input.disabled=true;
        try {
          await B.savePreference(key,next);
          showToast('Preferencia guardada. Las notificaciones y GPS aún no están conectados.','info');
        } catch(error) {input.checked=!next;showToast('No se pudo guardar la preferencia.','error');}
        finally {input.disabled=false;}
      });
    });
  };

  const setupReportForm = () => {
    const form = $("#report-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const location = $("#report-location");
      const type = $("#report-type");
      const severity = $("#report-severity");
      const description = $("#report-description");
      const contact = $("#report-contact");
      const distance = $("#report-distance");

      if (!location.value.trim()) {
        showToast("Indica una referencia de ubicación.", "error");
        location.focus();
        return;
      }

      if (!type.value || !severity.value) {
        showToast("Selecciona observación y severidad.", "warning");
        return;
      }

      if (description.value.trim().length < 20) {
        showToast("Describe un poco más lo que estás viendo.", "error");
        description.focus();
        return;
      }

      const report = {
        location: location.value.trim(),
        type: type.value,
        severity: severity.value,
        severityLabel: severity.options[severity.selectedIndex].text,
        description: description.value.trim(),
        contact: contact.value.trim(),
        distance: distance.value,
        createdAt: new Date().toISOString()
      };

      const button=form.querySelector('[type=submit]');
      button.disabled=true;
      try {
        await Data.createReport(report);
        form.reset();
        try {await Data.refresh();} catch {showToast('Reporte guardado; no se pudo actualizar el historial. Recarga para consultar.','warning');}
        renderSavedReports();
        showToast(B.cloud?'Reporte guardado en servicio remoto y enviado a revisión.':'Reporte guardado en la demostración local.','success');
        screenNavigate('profile');
      } catch(error) {showToast('No se pudo enviar el reporte. Tus datos siguen en el formulario.','error');}
      finally {button.disabled=false;}

    });
  };

  const setupHelpButton = () => {
    $("#send-help-btn")?.addEventListener("click", async () => {
      const checked = ["#confirm-visible", "#confirm-safe", "#confirm-location"]
        .filter((selector) => $(selector)?.checked).length;

      if (checked < 2) {
        showToast("Confirma al menos dos condiciones antes de escalar.", "warning");
        return;
      }

      if(B.cloud) {
        const location=$('#help-location').value.trim();
        if(location.length<3) {showToast('Indica una referencia del lugar.','warning');return;}
        const button=$('#send-help-btn');button.disabled=true;
        try {
          await Data.requestHelp({location,visible:$('#confirm-visible').checked,safe:$('#confirm-safe').checked,reference:$('#confirm-location').checked});
          showToast('Solicitud registrada para revisión. No equivale a un despacho confirmado.','success');
          screenNavigate('home');
        } catch {showToast('No se pudo registrar la solicitud. Intenta otra vez.','error');}
        finally {button.disabled=false;}
        return;
      }
      try {
        await Data.requestHelp({location:$('#help-location')?.value.trim(),visible:$('#confirm-visible').checked,safe:$('#confirm-safe').checked,reference:$('#confirm-location').checked});
      } catch(error) {showToast(error.message,'error');return;}

      showToast("Emergencia escalada al operador. Mantente en zona segura.", "success");
      setTimeout(() => screenNavigate("home"), 600);
    });
  };

  const tickTelemetry = () => {
    if (!networkOnline) return;

    Data.simulateTelemetry();

    thresholds = Data.loadThresholds();
    renderHome();
    updateClock();

    if (currentScreen === "map") {
      renderMap();
      renderSensorList();
    }
  };

  const startLiveSimulation = () => {
    updateClock();
    renderNetworkBanner();
    liveTimer = setInterval(tickTelemetry, 9000);
    networkTimer = setInterval(() => {
      // Simula degradación ocasional de enlace rural
      networkOnline = Data.simulateNetwork();
      renderNetworkBanner();
      if (!networkOnline) {
        showToast("Enlace LoRa intermitente. Usando última lectura local.", "warning");
        setTimeout(() => {
          networkOnline = true;
          renderNetworkBanner();
        }, 4500);
      }
    }, 28000);
  };

  const setupLogout = () => {
    $("#logout-btn")?.addEventListener("click", async () => {
      if (confirm("¿Deseas cerrar sesión?")) {
        try {await B.logout();} catch {showToast("No se pudo cerrar sesión. Intenta otra vez.","error");}
      }
    });
  };

  const init = async () => {
    if (!Data) {
      console.error("SatipoData no cargó. Revisa shared/js/data.js");
      return;
    }

    if (!await B.guard("user")) return;
    await Data.ready;
    await Data.refresh();
    thresholds = Data.loadThresholds();

    renderHome();
    renderAlertsTimeline();
    renderMap();
    renderSensorList();
    renderSavedReports();
    setupNavigation();
    setupProfile();
    setupReportForm();
    setupHelpButton();
    setupLogout();
    screenNavigate("home");
    setText('#data-mode',B.cloud?'Reportes conectados a servicio remoto · muestra histórica separada':'DEMO: sensores, enlace y alertas simulados; datos guardados solo en este navegador.');
    await window.SatipoDataset.init($('#dataset-explorer'));
    if(B.cloud) {updateClock();renderNetworkBanner();} else startLiveSimulation();
  };

  return { init };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    AppModule.init().catch(window.SatipoBackend.fatal);
  });
} else {
  AppModule.init().catch(window.SatipoBackend.fatal);
}
