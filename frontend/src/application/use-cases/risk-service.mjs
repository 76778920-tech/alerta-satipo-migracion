import { defaultThresholds, defaultWeights, defaultBands, toPositiveNumber, validateModel, calculateRiskWith, classifyRisk as classify } from '../../domain/risk.mjs';
import { validateReport, validateHelp } from '../../domain/account.mjs';
import { reportIncident, helpIncident, simulateSensor } from '../../domain/community.mjs';

/** Backend: puerto de casos de uso; store: KeyValuePort; assets: AssetsPort.
 * Los datos demostrativos se inyectan únicamente desde la composición. */
export function createRiskService({Backend, store, assets, fixtures, entropy}) {
  const {sensors, alerts, defaultIncidents, maintenance, riskTrend} = structuredClone({...fixtures});
  let remoteReports = [], remoteIncidents = [], remoteThresholds = null;
  const severityLabels = { low: 'Baja: humo lejano', medium: 'Media: fuego controlable', high: 'Alta: amenaza a viviendas o chacras' };
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

  const loadThresholds = () => remoteThresholds || ({
    tempCritical: readStoredNumber(STORAGE.temp, colabThresholds.tempCritical),
    smokeCritical: readStoredNumber(STORAGE.smoke, colabThresholds.smokeCritical),
    humidityDry: readStoredNumber(STORAGE.humidity, colabThresholds.humidityDry),
    windRisk: readStoredNumber(STORAGE.wind, colabThresholds.windRisk)
  });

  const saveThresholds = async (thresholds) => {
    if (Backend.cloud) {
      await Backend.saveSettings({temp_critical:thresholds.tempCritical,smoke_critical:thresholds.smokeCritical,humidity_dry:thresholds.humidityDry,wind_risk:thresholds.windRisk});
      remoteThresholds = {...thresholds};
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

  const hasLocalOverrides = () =>
    [STORAGE.temp, STORAGE.smoke, STORAGE.humidity, STORAGE.wind]
      .some((key) => store.get(key) !== null);

  const calculateRisk = (sensor, thresholds = loadThresholds()) =>
    calculateRiskWith(sensor, thresholds, activeWeights);

  const classifyRisk = score => classify(score, activeBands);

  const enrichedSensors = (thresholds = loadThresholds()) =>
    sensors.map((sensor) => ({
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
    if (Backend.cloud) throw new Error('Usa createReport para escribir en servicio remoto.');
    store.set(STORAGE.reports, JSON.stringify(reports.slice(0, 20)));
  };

  const readIncidents = () => {
    if (Backend.cloud) return remoteIncidents;
    const stored = store.get(STORAGE.incidents);
    if (!stored) return [...defaultIncidents];
    try {
      return JSON.parse(stored);
    } catch {
      return [...defaultIncidents];
    }
  };

  const saveIncidents = (incidents) => {
    if (Backend.cloud) throw new Error('Usa updateIncident para escribir en servicio remoto.');
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
    const {reports,incidents,settings} = await Backend.getActivity();
    remoteReports = reports.map(r=>({...r,type:r.observation,createdAt:r.created_at,severityLabel:severityLabels[r.severity]}));
    remoteIncidents = incidents.map(r=>({...r,date:new Date(r.created_at).toLocaleString('es-PE'),zone:r.location,type:r.kind,nodes:[]}));
    remoteThresholds = {tempCritical:Number(settings.temp_critical),smokeCritical:Number(settings.smoke_critical),humidityDry:Number(settings.humidity_dry),windRisk:Number(settings.wind_risk)};
    alerts.splice(0,alerts.length,...incidents.map(r=>({id:r.id,title:r.kind,date:new Date(r.created_at).toLocaleString('es-PE'),zone:r.location,score:r.risk,state:['Validado','Falso positivo'].includes(r.state)?'resolved':r.risk>=76?'critical':'watch',eta:`Estado: ${r.state} · prioridad del reporte, no lectura de sensor`} )));
  };
  const createReport = async report => {
    validateReport(report);
    if (!Backend.cloud) {
      const incidents=readIncidents();
      saveReports([report,...readReports()]);
      saveIncidents([reportIncident(report,prioritySensor(),incidents.length,entropy.now().toISOString()),...incidents]);
      return;
    }
    await Backend.createReport(report);
  };
  const updateIncident = async (id,state,previousState) => {
    if (!Backend.cloud) {saveIncidents(readIncidents().map(r=>r.id===id?{...r,state}:r));return;}
    await Backend.updateState('incidents',id,{state,expectedState:previousState});
  };
  const requestHelp = async ({location,visible,safe,reference}) => {
    if (!Backend.cloud) {
      const priority=prioritySensor();
      validateHelp({location:location || priority?.zone,visible,safe,reference});
      const incidents=readIncidents();
      saveIncidents([helpIncident(priority,incidents.length,entropy.now().toISOString()),...incidents]);
      return;
    }
    return Backend.requestHelp({location,visible,safe,reference});
  };
  const prioritySensor = () => enrichedSensors().sort((a,b)=>b.risk-a.risk)[0];
  const simulateTelemetry = () => {
    if (Backend.cloud) return;
    for (const sensor of sensors) Object.assign(sensor,simulateSensor(sensor,entropy.numbers(5)));
  };
  const simulateNetwork = () => entropy.numbers(1)[0] > 0.12;
  const ready = (async()=>{
    await Backend.ready;
    await initModel();
    if (Backend.cloud) { sensors.length=0; alerts.length=0; maintenance.length=0; }
  })();
  ready.catch(()=>{});

  return {
    STORAGE,
    sensors,
    alerts,
    maintenance,
    riskTrend,
    defaultThresholds,
    ready,
    initModel,
    getModelInfo,
    loadThresholds,
    saveThresholds,
    clearThresholdOverrides,
    hasLocalOverrides,
    calculateRisk,
    classifyRisk,
    enrichedSensors,
    readReports,
    saveReports,
    readIncidents,
    saveIncidents
    ,refresh,createReport,updateIncident,requestHelp,simulateTelemetry,simulateNetwork
  };

}
