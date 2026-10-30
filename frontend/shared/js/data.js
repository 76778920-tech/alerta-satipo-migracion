(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // frontend/src/domain/risk.mjs
  var defaultThresholds = {
    tempCritical: 39,
    smokeCritical: 65,
    humidityDry: 38,
    windRisk: 18
  };
  var defaultWeights = {
    temp: 30,
    smoke: 34,
    humidity: 18,
    wind: 14,
    recencyMax: 4,
    recencyMin: 1,
    recencyFreshMinutes: 5
  };
  var defaultBands = {
    critical: 76,
    watch: 55
  };
  var toPositiveNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  };
  var validateModel = (payload) => {
    if (!payload || typeof payload !== "object") {
      throw new Error("JSON vac\xEDo o inv\xE1lido");
    }
    const thresholds = payload.thresholds || {};
    const weights = payload.weights || {};
    const bands = payload.bands || {};
    const nextThresholds = {
      tempCritical: toPositiveNumber(thresholds.tempCritical, defaultThresholds.tempCritical),
      smokeCritical: toPositiveNumber(thresholds.smokeCritical, defaultThresholds.smokeCritical),
      humidityDry: toPositiveNumber(thresholds.humidityDry, defaultThresholds.humidityDry),
      windRisk: toPositiveNumber(thresholds.windRisk, defaultThresholds.windRisk)
    };
    const nextWeights = {
      temp: toPositiveNumber(weights.temp, defaultWeights.temp),
      smoke: toPositiveNumber(weights.smoke, defaultWeights.smoke),
      humidity: toPositiveNumber(weights.humidity, defaultWeights.humidity),
      wind: toPositiveNumber(weights.wind, defaultWeights.wind),
      recencyMax: toPositiveNumber(weights.recencyMax, defaultWeights.recencyMax),
      recencyMin: toPositiveNumber(weights.recencyMin, defaultWeights.recencyMin),
      recencyFreshMinutes: toPositiveNumber(weights.recencyFreshMinutes, defaultWeights.recencyFreshMinutes)
    };
    const nextBands = {
      critical: toPositiveNumber(bands.critical, defaultBands.critical),
      watch: toPositiveNumber(bands.watch, defaultBands.watch)
    };
    if (nextBands.watch >= nextBands.critical) {
      throw new Error("bands.watch debe ser menor que bands.critical");
    }
    const probe = calculateRiskWith(
      { temp: 30, smoke: 40, humidity: 50, wind: 10, lastComm: 3 },
      nextThresholds,
      nextWeights
    );
    if (!Number.isFinite(probe)) {
      throw new Error("El scoring del modelo produjo un valor no num\xE9rico");
    }
    return {
      thresholds: nextThresholds,
      weights: nextWeights,
      bands: nextBands,
      modelId: String(payload.modelId || "satipo-risk-v1"),
      version: String(payload.schemaVersion || "1.0.0"),
      source: String(payload.source || "google-colab"),
      exportedAt: payload.exportedAt || null,
      notes: String(payload.notes || "Modelo Colab cargado.")
    };
  };
  var calculateRiskWith = (sensor, thresholds, weights) => {
    const lastSeen = sensor.lastComm ?? sensor.lastSeen ?? 99;
    const temp = Math.min(sensor.temp / thresholds.tempCritical, 1) * weights.temp;
    const smoke = Math.min(sensor.smoke / thresholds.smokeCritical, 1) * weights.smoke;
    const dryness = Math.max((thresholds.humidityDry - sensor.humidity) / thresholds.humidityDry, 0) * weights.humidity;
    const wind = Math.min(sensor.wind / thresholds.windRisk, 1) * weights.wind;
    const recency = lastSeen <= weights.recencyFreshMinutes ? weights.recencyMax : weights.recencyMin;
    return Math.round(temp + smoke + dryness + wind + recency);
  };
  var classifyRisk = (score, activeBands) => {
    if (score >= activeBands.critical) {
      return {
        text: "Cr\xEDtico",
        label: "Riesgo cr\xEDtico",
        className: "alert",
        key: "danger",
        point: "danger",
        detail: "Activar verificaci\xF3n comunitaria y ruta de respuesta."
      };
    }
    if (score >= activeBands.watch) {
      return {
        text: "Vigilancia",
        label: "Vigilancia alta",
        className: "warn",
        key: "warning",
        point: "warning",
        detail: "Mantener observaci\xF3n, confirmar con reportes locales."
      };
    }
    return {
      text: "Normal",
      label: "Estable",
      className: "good",
      key: "safe",
      point: "safe",
      detail: "Sin se\xF1ales cr\xEDticas en la red cercana."
    };
  };

  // frontend/src/domain/account.mjs
  var preferenceFields = Object.freeze({
    "notif-push": "notif_push",
    "notif-sound": "notif_sound",
    "share-location": "share_location"
  });
  function validateReport(report) {
    if (!report || typeof report.location !== "string" || !report.location.trim() || typeof report.description !== "string" || report.description.trim().length < 20 || !["low", "medium", "high"].includes(report.severity) || typeof report.type !== "string" || !report.type.trim()) throw new Error("Reporte incompleto o inv\xE1lido.");
    return report;
  }
  function validateHelp(input) {
    if (!input || typeof input.location !== "string" || !input.location.trim() || typeof input.visible !== "boolean" || typeof input.safe !== "boolean" || typeof input.reference !== "boolean" || input.location.trim().length < 3 || [input.visible, input.safe, input.reference].filter(Boolean).length < 2) throw new Error("Confirma al menos dos condiciones y una referencia del lugar.");
    return input;
  }

  // frontend/src/domain/community.mjs
  function reportIncident(report, priority, count, date) {
    return {
      id: `INC-${String(450 + count).padStart(3, "0")}`,
      date,
      zone: report.location,
      type: `Reporte comunitario: ${report.type}`,
      nodes: priority ? [priority.id] : [],
      risk: { high: 82, medium: 64, low: 41 }[report.severity] || 60,
      state: "Nuevo",
      owner: "Cola comunitaria",
      source: "mobile"
    };
  }
  function helpIncident(priority, count, date) {
    if (!priority) throw new Error("No hay datos demostrativos disponibles.");
    return {
      id: `INC-${String(460 + count).padStart(3, "0")}`,
      date,
      zone: priority.zone,
      type: "Escalamiento de emergencia",
      nodes: [priority.id],
      risk: Math.max(priority.risk, 85),
      state: "Nuevo",
      owner: "Respuesta inmediata",
      source: "mobile-help"
    };
  }
  function simulateSensor(sensor, values) {
    const jitter = (value, amount, min, max, random) => Math.min(max, Math.max(min, Number((value + (random * amount * 2 - amount)).toFixed(1))));
    return {
      ...sensor,
      temp: jitter(sensor.temp, 0.4, 26, 42, values[0]),
      smoke: Math.round(jitter(sensor.smoke, 2.5, 10, 90, values[1])),
      humidity: Math.round(jitter(sensor.humidity, 1.8, 20, 75, values[2])),
      wind: Math.round(jitter(sensor.wind, 1.2, 4, 28, values[3])),
      lastComm: Math.max(1, Math.min(14, sensor.lastComm + (values[4] > 0.7 ? 1 : -1)))
    };
  }

  // frontend/src/application/use-cases/risk-service.mjs
  function createRiskService({ Backend, store, assets, fixtures, entropy }) {
    const { sensors: sensors2, alerts: alerts2, defaultIncidents: defaultIncidents2, maintenance: maintenance2, riskTrend: riskTrend2 } = structuredClone({ ...fixtures });
    let remoteReports = [], remoteIncidents = [], remoteThresholds = null;
    const severityLabels = { low: "Baja: humo lejano", medium: "Media: fuego controlable", high: "Alta: amenaza a viviendas o chacras" };
    const STORAGE = {
      reports: "satipo-reports",
      incidents: "satipo-incidents",
      temp: "satipo-temp-threshold",
      smoke: "satipo-smoke-threshold",
      humidity: "satipo-humidity-threshold",
      wind: "satipo-wind-threshold"
    };
    const modelMeta = {
      loaded: false,
      ok: false,
      source: "defaults",
      modelId: "satipo-risk-defaults",
      version: "0.0.0",
      exportedAt: null,
      notes: "Defaults locales (modelo Colab no cargado).",
      error: null
    };
    let activeWeights = { ...defaultWeights };
    let activeBands = { ...defaultBands };
    let colabThresholds = { ...defaultThresholds };
    const readStoredNumber = (key, fallback) => {
      const raw = store.get(key);
      if (raw === null || raw === "") return fallback;
      return toPositiveNumber(raw, fallback);
    };
    const loadThresholds = () => remoteThresholds || {
      tempCritical: readStoredNumber(STORAGE.temp, colabThresholds.tempCritical),
      smokeCritical: readStoredNumber(STORAGE.smoke, colabThresholds.smokeCritical),
      humidityDry: readStoredNumber(STORAGE.humidity, colabThresholds.humidityDry),
      windRisk: readStoredNumber(STORAGE.wind, colabThresholds.windRisk)
    };
    const saveThresholds = async (thresholds) => {
      if (Backend.cloud) {
        await Backend.saveSettings({ temp_critical: thresholds.tempCritical, smoke_critical: thresholds.smokeCritical, humidity_dry: thresholds.humidityDry, wind_risk: thresholds.windRisk });
        remoteThresholds = { ...thresholds };
        return;
      }
      store.set(STORAGE.temp, String(thresholds.tempCritical));
      store.set(STORAGE.smoke, String(thresholds.smokeCritical));
      store.set(STORAGE.humidity, String(thresholds.humidityDry));
      store.set(STORAGE.wind, String(thresholds.windRisk));
    };
    const clearThresholdOverrides = async () => {
      if (Backend.cloud) return saveThresholds(colabThresholds);
      store.remove(STORAGE.temp);
      store.remove(STORAGE.smoke);
      store.remove(STORAGE.humidity);
      store.remove(STORAGE.wind);
    };
    const hasLocalOverrides = () => [STORAGE.temp, STORAGE.smoke, STORAGE.humidity, STORAGE.wind].some((key) => store.get(key) !== null);
    const calculateRisk = (sensor, thresholds = loadThresholds()) => calculateRiskWith(sensor, thresholds, activeWeights);
    const classifyRisk2 = (score) => classifyRisk(score, activeBands);
    const enrichedSensors = (thresholds = loadThresholds()) => sensors2.map((sensor) => ({
      ...sensor,
      lastSeen: sensor.lastComm,
      risk: calculateRisk(sensor, thresholds)
    }));
    const getModelInfo = () => ({
      ...modelMeta,
      thresholds: { ...colabThresholds },
      weights: { ...activeWeights },
      bands: { ...activeBands },
      effectiveThresholds: loadThresholds(),
      hasLocalOverrides: hasLocalOverrides()
    });
    const readReports = () => {
      if (Backend.cloud) return remoteReports;
      try {
        return JSON.parse(store.get(STORAGE.reports) || "[]");
      } catch {
        return [];
      }
    };
    const saveReports = (reports) => {
      if (Backend.cloud) throw new Error("Usa createReport para escribir en servicio remoto.");
      store.set(STORAGE.reports, JSON.stringify(reports.slice(0, 20)));
    };
    const readIncidents = () => {
      if (Backend.cloud) return remoteIncidents;
      const stored = store.get(STORAGE.incidents);
      if (!stored) return [...defaultIncidents2];
      try {
        return JSON.parse(stored);
      } catch {
        return [...defaultIncidents2];
      }
    };
    const saveIncidents = (incidents) => {
      if (Backend.cloud) throw new Error("Usa updateIncident para escribir en servicio remoto.");
      store.set(STORAGE.incidents, JSON.stringify(incidents));
    };
    const applyValidatedModel = (validated) => {
      colabThresholds = validated.thresholds;
      activeWeights = validated.weights;
      activeBands = validated.bands;
      modelMeta.ok = true;
      modelMeta.source = validated.source;
      modelMeta.modelId = validated.modelId;
      modelMeta.version = validated.version;
      modelMeta.exportedAt = validated.exportedAt;
      modelMeta.notes = validated.notes;
      modelMeta.error = null;
    };
    const initModel = async () => {
      try {
        const payload = await assets.model();
        const validated = validateModel(payload);
        applyValidatedModel(validated);
      } catch (error) {
        modelMeta.ok = false;
        modelMeta.source = "defaults";
        modelMeta.modelId = "satipo-risk-defaults";
        modelMeta.version = "0.0.0";
        modelMeta.notes = "Usando defaults locales. El JSON de Colab no se pudo cargar.";
        modelMeta.error = error?.message || String(error);
        colabThresholds = { ...defaultThresholds };
        activeWeights = { ...defaultWeights };
        activeBands = { ...defaultBands };
      } finally {
        modelMeta.loaded = true;
      }
      return getModelInfo();
    };
    const refresh = async () => {
      if (!Backend.cloud) return;
      const { reports, incidents, settings } = await Backend.getActivity();
      remoteReports = reports.map((r) => ({ ...r, type: r.observation, createdAt: r.created_at, severityLabel: severityLabels[r.severity] }));
      remoteIncidents = incidents.map((r) => ({ ...r, date: new Date(r.created_at).toLocaleString("es-PE"), zone: r.location, type: r.kind, nodes: [] }));
      remoteThresholds = { tempCritical: Number(settings.temp_critical), smokeCritical: Number(settings.smoke_critical), humidityDry: Number(settings.humidity_dry), windRisk: Number(settings.wind_risk) };
      alerts2.splice(0, alerts2.length, ...incidents.map((r) => ({ id: r.id, title: r.kind, date: new Date(r.created_at).toLocaleString("es-PE"), zone: r.location, score: r.risk, state: ["Validado", "Falso positivo"].includes(r.state) ? "resolved" : r.risk >= 76 ? "critical" : "watch", eta: `Estado: ${r.state} \xB7 prioridad del reporte, no lectura de sensor` })));
    };
    const createReport = async (report) => {
      validateReport(report);
      if (!Backend.cloud) {
        const incidents = readIncidents();
        saveReports([report, ...readReports()]);
        saveIncidents([reportIncident(report, prioritySensor(), incidents.length, entropy.now().toISOString()), ...incidents]);
        return;
      }
      await Backend.createReport(report);
    };
    const updateIncident = async (id, state, previousState) => {
      if (!Backend.cloud) {
        saveIncidents(readIncidents().map((r) => r.id === id ? { ...r, state } : r));
        return;
      }
      await Backend.updateState("incidents", id, { state, expectedState: previousState });
    };
    const requestHelp = async ({ location, visible, safe, reference }) => {
      if (!Backend.cloud) {
        const priority = prioritySensor();
        validateHelp({ location: location || priority?.zone, visible, safe, reference });
        const incidents = readIncidents();
        saveIncidents([helpIncident(priority, incidents.length, entropy.now().toISOString()), ...incidents]);
        return;
      }
      return Backend.requestHelp({ location, visible, safe, reference });
    };
    const prioritySensor = () => enrichedSensors().sort((a, b) => b.risk - a.risk)[0];
    const simulateTelemetry = () => {
      if (Backend.cloud) return;
      for (const sensor of sensors2) Object.assign(sensor, simulateSensor(sensor, entropy.numbers(5)));
    };
    const simulateNetwork = () => entropy.numbers(1)[0] > 0.12;
    const ready = (async () => {
      await Backend.ready;
      await initModel();
      if (Backend.cloud) {
        sensors2.length = 0;
        alerts2.length = 0;
        maintenance2.length = 0;
      }
    })();
    ready.catch(() => {
    });
    return {
      STORAGE,
      sensors: sensors2,
      alerts: alerts2,
      maintenance: maintenance2,
      riskTrend: riskTrend2,
      defaultThresholds,
      ready,
      initModel,
      getModelInfo,
      loadThresholds,
      saveThresholds,
      clearThresholdOverrides,
      hasLocalOverrides,
      calculateRisk,
      classifyRisk: classifyRisk2,
      enrichedSensors,
      readReports,
      saveReports,
      readIncidents,
      saveIncidents,
      refresh,
      createReport,
      updateIncident,
      requestHelp,
      simulateTelemetry,
      simulateNetwork
    };
  }

  // frontend/src/application/ports/out/gateways.mjs
  var KeyValuePort = class {
    get(key) {
      throw new Error("KeyValuePort.get");
    }
    set(key, value) {
      throw new Error("KeyValuePort.set");
    }
    remove(key) {
      throw new Error("KeyValuePort.remove");
    }
    clear() {
      throw new Error("KeyValuePort.clear");
    }
  };
  var AssetsPort = class {
    async model() {
      throw new Error("AssetsPort.model");
    }
    async readings() {
      throw new Error("AssetsPort.readings");
    }
  };
  var EntropyPort = class {
    now() {
      throw new Error("EntropyPort.now");
    }
    id() {
      throw new Error("EntropyPort.id");
    }
    numbers(count) {
      throw new Error("EntropyPort.numbers");
    }
  };

  // frontend/src/adapters/out/browser.mjs
  var BrowserStorage = class extends KeyValuePort {
    constructor(storage) {
      super();
      this.storage = storage;
    }
    get(key) {
      return this.storage.getItem(key);
    }
    set(key, value) {
      this.storage.setItem(key, value);
    }
    remove(key) {
      this.storage.removeItem(key);
    }
    clear() {
      this.storage.clear();
    }
  };
  var BrowserEntropy = class extends EntropyPort {
    now() {
      return /* @__PURE__ */ new Date();
    }
    id() {
      return crypto.randomUUID();
    }
    numbers(count) {
      return [...crypto.getRandomValues(new Uint32Array(count))].map((value) => value / 4294967296);
    }
  };

  // frontend/src/adapters/out/http.mjs
  var HttpAssets = class extends AssetsPort {
    constructor(base2, request) {
      super();
      this.base = base2;
      this.request = request;
    }
    async read(path) {
      const response = await this.request(new URL(path, this.base), { cache: "no-store" });
      if (!response.ok) throw new Error(`Recurso no disponible: ${path}`);
      return response.json();
    }
    model() {
      return this.read("shared/models/satipo_umbrales.json");
    }
    readings() {
      return this.read("data/smoke_detection_300.json");
    }
    config() {
      return this.read("config/public.json");
    }
  };

  // frontend/src/adapters/out/demo-data.mjs
  var demo_data_exports = {};
  __export(demo_data_exports, {
    alerts: () => alerts,
    defaultIncidents: () => defaultIncidents,
    maintenance: () => maintenance,
    riskTrend: () => riskTrend,
    sensors: () => sensors
  });
  var sensors = [
    { id: "N-01", zone: "Satipo Sur", community: "San Francisco", type: "Sensor multimodal", temp: 38.6, smoke: 72, humidity: 31, wind: 21, battery: 86, lastComm: 2, rssi: -89, x: 64, y: 44 },
    { id: "N-02", zone: "Mazamari", community: "Los Pinos", type: "Gateway LoRa", temp: 33.2, smoke: 48, humidity: 42, wind: 17, battery: 78, lastComm: 4, rssi: -92, x: 38, y: 54 },
    { id: "N-03", zone: "Pangoa", community: "Micaela", type: "Sensor multimodal", temp: 34.8, smoke: 55, humidity: 36, wind: 16, battery: 62, lastComm: 6, rssi: -96, x: 73, y: 68 },
    { id: "N-04", zone: "R\xEDo Tambo", community: "Puerto Prado", type: "Sensor multimodal", temp: 30.4, smoke: 29, humidity: 58, wind: 12, battery: 91, lastComm: 3, rssi: -84, x: 28, y: 28 },
    { id: "N-05", zone: "Coviriali", community: "Bajo Tziriari", type: "Sensor multimodal", temp: 29.7, smoke: 25, humidity: 61, wind: 9, battery: 94, lastComm: 2, rssi: -81, x: 50, y: 31 },
    { id: "N-06", zone: "Pampa Hermosa", community: "Santa Rosa", type: "Sensor multimodal", temp: 35.1, smoke: 51, humidity: 34, wind: 19, battery: 53, lastComm: 9, rssi: -101, x: 55, y: 72 },
    { id: "N-07", zone: "Llaylla", community: "Alto Kiatari", type: "Sensor multimodal", temp: 28.9, smoke: 19, humidity: 64, wind: 8, battery: 88, lastComm: 5, rssi: -86, x: 19, y: 62 },
    { id: "N-08", zone: "San Mart\xEDn de Pangoa", community: "Kivinaki", type: "Repetidor solar", temp: 31.6, smoke: 33, humidity: 49, wind: 13, battery: 69, lastComm: 12, rssi: -107, x: 82, y: 30 }
  ];
  var alerts = [
    { id: "A-1042", date: "Hoy 08:42", zone: "Satipo Sur", title: "Humo y subida t\xE9rmica sostenida", score: 88, state: "critical", eta: "Patrulla sugerida: 12 min" },
    { id: "A-1041", date: "Hoy 08:10", zone: "Pampa Hermosa", title: "Viento acelera en zona seca", score: 63, state: "watch", eta: "Seguimiento autom\xE1tico" },
    { id: "A-1040", date: "Ayer 17:35", zone: "Pangoa", title: "Humo intermitente validado por comunidad", score: 71, state: "critical", eta: "Cerrado por lluvia local" },
    { id: "A-1039", date: "Ayer 10:15", zone: "Mazamari", title: "Quema agr\xEDcola reportada", score: 44, state: "resolved", eta: "Falso positivo confirmado" },
    { id: "A-1038", date: "Hace 2 d\xEDas", zone: "R\xEDo Tambo", title: "Sensor sin anomal\xEDas", score: 22, state: "resolved", eta: "Sin acci\xF3n requerida" }
  ];
  var defaultIncidents = [
    { id: "INC-442", date: "2026-09-04 08:42", zone: "Satipo Sur", type: "Humo + calor", nodes: ["N-01", "N-03"], risk: 88, state: "Nuevo", owner: "Operador 1" },
    { id: "INC-441", date: "2026-09-04 08:10", zone: "Pampa Hermosa", type: "Viento en zona seca", nodes: ["N-06"], risk: 63, state: "En revisi\xF3n", owner: "Brigada Norte" },
    { id: "INC-440", date: "2026-09-03 17:35", zone: "Pangoa", type: "Reporte comunitario", nodes: ["N-03"], risk: 71, state: "Validado", owner: "Defensa Civil" },
    { id: "INC-439", date: "2026-09-03 10:15", zone: "Mazamari", type: "Quema agr\xEDcola", nodes: ["N-02"], risk: 44, state: "Falso positivo", owner: "Serenazgo" }
  ];
  var maintenance = [
    { node: "N-06", task: "Revisar bater\xEDa y panel", priority: "Alta", assigned: "Carlos", state: "Pendiente", due: "Hoy" },
    { node: "N-08", task: "Elevar antena repetidora", priority: "Media", assigned: "Ana", state: "En progreso", due: "Ma\xF1ana" },
    { node: "N-03", task: "Calibrar MQ-2 y DHT22", priority: "Media", assigned: "Pedro", state: "Pendiente", due: "05 sep" },
    { node: "N-05", task: "Limpieza preventiva", priority: "Baja", assigned: "Rosa", state: "Completada", due: "Ayer" }
  ];
  var riskTrend = [32, 38, 41, 49, 58, 63, 70, 76, 82, 88];

  // frontend/src/bootstrap/data.mjs
  var base = new URL("../../", document.currentScript.src);
  window.SatipoData = createRiskService({
    Backend: window.SatipoBackend,
    store: new BrowserStorage(window.localStorage),
    assets: new HttpAssets(base, window.fetch.bind(window)),
    entropy: new BrowserEntropy(),
    fixtures: demo_data_exports
  });
})();
