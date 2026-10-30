(() => {
  // frontend/src/application/ports/in/browser-use-cases.mjs
  var BrowserUseCases = class {
    async savePmv1(input) {
      throw new Error("BrowserUseCases.savePmv1");
    }
    async pmv1History() {
      throw new Error("BrowserUseCases.pmv1History");
    }
    async identify() {
      throw new Error("BrowserUseCases.identify");
    }
    async login(credentials) {
      throw new Error("BrowserUseCases.login");
    }
    async logout() {
      throw new Error("BrowserUseCases.logout");
    }
    async recover(email) {
      throw new Error("BrowserUseCases.recover");
    }
    async changePassword(password) {
      throw new Error("BrowserUseCases.changePassword");
    }
    async savePreference(key, value) {
      throw new Error("BrowserUseCases.savePreference");
    }
    async listReadings() {
      throw new Error("BrowserUseCases.listReadings");
    }
    async listOperations() {
      throw new Error("BrowserUseCases.listOperations");
    }
    async listPredictions() {
      throw new Error("BrowserUseCases.listPredictions");
    }
    async getActivity() {
      throw new Error("BrowserUseCases.getActivity");
    }
    async updateState(kind, id, input) {
      throw new Error("BrowserUseCases.updateState");
    }
    async saveSettings(settings) {
      throw new Error("BrowserUseCases.saveSettings");
    }
    async createReport(report) {
      throw new Error("BrowserUseCases.createReport");
    }
    async requestHelp(input) {
      throw new Error("BrowserUseCases.requestHelp");
    }
  };

  // frontend/src/domain/account.mjs
  var preferenceFields = Object.freeze({
    "notif-push": "notif_push",
    "notif-sound": "notif_sound",
    "share-location": "share_location"
  });
  function preferenceField(key, value) {
    if (!Object.hasOwn(preferenceFields, key) || typeof value !== "boolean") throw new Error("Preferencia inv\xE1lida.");
    return preferenceFields[key];
  }
  function requireAdmin(profile) {
    if (!profile || profile.role !== "admin") {
      const error = new Error("Acceso denegado. Esta p\xE1gina es exclusiva para administradores autorizados.");
      error.code = "FORBIDDEN";
      throw error;
    }
    return profile;
  }
  function validateReport(report) {
    if (!report || typeof report.location !== "string" || !report.location.trim() || typeof report.description !== "string" || report.description.trim().length < 20 || !["low", "medium", "high"].includes(report.severity) || typeof report.type !== "string" || !report.type.trim()) throw new Error("Reporte incompleto o inv\xE1lido.");
    return report;
  }
  function validateHelp(input) {
    if (!input || typeof input.location !== "string" || !input.location.trim() || typeof input.visible !== "boolean" || typeof input.safe !== "boolean" || typeof input.reference !== "boolean" || input.location.trim().length < 3 || [input.visible, input.safe, input.reference].filter(Boolean).length < 2) throw new Error("Confirma al menos dos condiciones y una referencia del lugar.");
    return input;
  }

  // frontend/src/domain/historical.mjs
  function validatePredictions(value) {
    if (!value || !Array.isArray(value.rows) || value.rows.length !== 60 || value.evaluation?.train_rows !== 240 || value.evaluation?.test_rows !== 60 || typeof value.version !== "string") throw new Error("Resultados incompletos.");
    const ids = /* @__PURE__ */ new Set();
    for (const row of value.rows) {
      if (!Number.isInteger(row.source_row) || ids.has(row.source_row) || typeof row.actual !== "boolean" || typeof row.predicted !== "boolean" || !Number.isFinite(row.score) || row.score < 0 || row.score > 1 || !Number.isFinite(Date.parse(row.recorded_at))) throw new Error("Resultados inv\xE1lidos.");
      ids.add(row.source_row);
    }
    return value;
  }
  function validateReadings(rows) {
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object") || new Set(rows.map((r) => r.source_row)).size !== rows.length) throw new Error("Formato de lecturas inv\xE1lido");
    return rows;
  }
  function validateOperations(value) {
    const { nodes, links, cases, maintenance } = value;
    if (!Array.isArray(nodes) || !Array.isArray(links) || !Array.isArray(cases) || !Array.isArray(maintenance) || nodes.length !== 6 || links.length !== 300 || new Set(links.map((r) => r.source_row)).size !== 300 || links.some((r) => !r.smoke_readings) || nodes.some((n) => links.filter((l) => l.node_id === n.id).length !== 50)) throw new Error("La relaci\xF3n de nodos y lecturas est\xE1 incompleta.");
    return value;
  }

  // frontend/src/domain/environment.mjs
  function validateEnvironment(data) {
    const statuses = ["ok", "unavailable", "not_configured", "partial"];
    if (data?.version !== 1 || !Number.isFinite(Date.parse(data.retrieved_at)) || !data.territory || !Array.isArray(data.territory.bbox) || data.territory.bbox.length !== 4 || !data.territory.bbox.every(Number.isFinite)) throw Error("Respuesta ambiental inv\xE1lida.");
    for (const name of ["weather", "fires"]) if (!data[name] || !statuses.includes(data[name].status) || !Array.isArray(data[name].rows)) throw Error("Proveedor inv\xE1lido.");
    if (data.weather.rows.length > 9 || data.fires.rows.length > 5e4) throw Error("Respuesta demasiado grande.");
    for (const row of data.weather.rows) {
      if (typeof row.location?.id !== "string" || typeof row.location.name !== "string" || !Number.isFinite(Date.parse(row.observed_at)) || row.kind !== "weather_model" || !row.values) throw Error("Meteorolog\xEDa inv\xE1lida.");
      if (!Number.isFinite(row.location.latitude) || !Number.isFinite(row.location.longitude) || !Number.isFinite(row.interval_seconds) || row.interval_seconds <= 0) throw Error("Ubicaci\xF3n o intervalo inv\xE1lidos.");
      for (const key of ["temperature_c", "humidity_pct", "rain_mm", "wind_kmh"]) if (row.values[key] !== null && !Number.isFinite(row.values[key])) throw Error("Medici\xF3n inv\xE1lida.");
    }
    for (const row of data.fires.rows) {
      if (typeof row.source !== "string" || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90 || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180 || !Number.isFinite(row.frp_mw) || row.frp_mw < 0 || !Number.isFinite(Date.parse(row.observed_at)) || !["l", "n", "h"].includes(row.confidence) || row.confirmed_fire !== false) throw Error("Detecci\xF3n inv\xE1lida.");
    }
    return data;
  }

  // frontend/src/application/use-cases/browser-service.mjs
  var BrowserService = class extends BrowserUseCases {
    constructor({ identity, profiles, community, admin, assets: assets2, session, preferences, cloud }) {
      super();
      Object.assign(this, { identity, profiles, community, admin, assets: assets2, session, preferences, cloud });
      this.profile = null;
    }
    async identify() {
      if (!this.cloud) return null;
      const user = await this.identity.currentUser();
      if (!user) {
        this.signedOut();
        return null;
      }
      this.profile = await this.profiles.find(user);
      if (!this.profile) {
        this.signedOut();
        return null;
      }
      this.session.set("userRole", this.profile.role);
      this.session.set("userEmail", this.profile.email);
      this.session.set("userName", this.profile.name);
      return this.profile;
    }
    signedOut() {
      this.profile = null;
      this.session.clear();
    }
    async login(credentials) {
      if (!this.cloud) throw new Error("Este acceso requiere la conexi\xF3n administrativa configurada.");
      await this.identity.signIn(credentials);
      const profile = await this.identify();
      try {
        return requireAdmin(profile);
      } catch (error) {
        await this.logout();
        throw error;
      }
    }
    async allowed(role) {
      const profile = this.cloud ? await this.identify() : { role: this.session.get("userRole") };
      if (!profile?.role) return { allowed: false, denied: false };
      if (role === "admin" && profile.role !== "admin") {
        await this.logout();
        return { allowed: false, denied: true };
      }
      return { allowed: true, denied: false };
    }
    async logout() {
      try {
        if (this.cloud) await this.identity.signOut();
      } finally {
        this.signedOut();
      }
    }
    async recover(email) {
      if (!this.cloud) throw new Error("La recuperaci\xF3n requiere conexi\xF3n.");
      return this.identity.recover(email);
    }
    async changePassword(password) {
      requireAdmin(await this.identify());
      if (typeof password !== "string" || password.length < 8) throw new Error("La contrase\xF1a debe tener al menos 8 caracteres.");
      return this.identity.changePassword(password);
    }
    userName() {
      return this.profile?.name || this.session.get("userName");
    }
    userEmail() {
      return this.profile?.email || this.session.get("userEmail");
    }
    preference(key, fallback) {
      if (!Object.hasOwn(preferenceFields, key)) throw new Error("Preferencia inv\xE1lida.");
      const value = this.cloud ? this.profile?.[preferenceFields[key]] : this.preferences.get(`satipo-${key}`);
      return value == null ? fallback : value === true || value === "true";
    }
    async savePreference(key, value) {
      const field = preferenceField(key, value);
      if (this.cloud) {
        if (!this.profile) throw new Error("Inicia sesi\xF3n nuevamente.");
        await this.profiles.updatePreference(this.profile.id, field, value);
        this.profile[field] = value;
      } else this.preferences.set(`satipo-${key}`, String(value));
    }
    async listReadings() {
      const rows = !this.cloud ? await this.assets.readings() : this.profile?.role === "user" ? await this.community.readings() : await this.admin.readings();
      return validateReadings(rows);
    }
    async listOperations() {
      return validateOperations(await this.admin.operations());
    }
    async getEnvironment() {
      return validateEnvironment(await this.admin.environment());
    }
    async savePmv1(reading) {
      return this.admin.savePmv1(reading);
    }
    async pmv1History() {
      return this.admin.pmv1History();
    }
    async listPredictions() {
      return validatePredictions(await this.admin.predictions());
    }
    async getActivity() {
      return this.profile?.role === "user" ? this.community.activity(this.profile.id) : this.admin.activity();
    }
    async updateState(kind, id, input) {
      return this.admin.updateState(kind, id, input);
    }
    async saveSettings(settings) {
      return this.admin.saveSettings(settings);
    }
    async createReport(report) {
      validateReport(report);
      if (!this.profile) throw new Error("Inicia sesi\xF3n nuevamente.");
      return this.community.createReport(this.profile.id, report);
    }
    async requestHelp(input) {
      return this.community.requestHelp(validateHelp(input));
    }
  };

  // frontend/src/application/ports/out/gateways.mjs
  var AdminPort = class {
    async savePmv1(input) {
      throw new Error("AdminPort.savePmv1");
    }
    async pmv1History() {
      throw new Error("AdminPort.pmv1History");
    }
    async environment() {
      throw new Error("AdminPort.environment");
    }
    async readings() {
      throw new Error("AdminPort.readings");
    }
    async operations() {
      throw new Error("AdminPort.operations");
    }
    async predictions() {
      throw new Error("AdminPort.predictions");
    }
    async activity() {
      throw new Error("AdminPort.activity");
    }
    async updateState(kind, id, input) {
      throw new Error("AdminPort.updateState");
    }
    async saveSettings(settings) {
      throw new Error("AdminPort.saveSettings");
    }
  };
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

  // frontend/src/adapters/out/http.mjs
  var HttpAdmin = class extends AdminPort {
    constructor({ url, publicKey, identity, request }) {
      super();
      Object.assign(this, { url, publicKey, identity, request });
    }
    async send(path, method = "GET", body) {
      if (!this.url) throw new Error("API administrativa no configurada.");
      const token = await this.identity.accessToken();
      if (!token) throw new Error("Inicia sesi\xF3n nuevamente.");
      const response = await this.request(this.url.replace(/\/$/, "") + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, apikey: this.publicKey, "Content-Type": "application/json" },
        ...body === void 0 ? {} : { body: JSON.stringify(body) }
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Respuesta inv\xE1lida de la API.");
      }
      if (!response.ok) throw new Error(payload.error || "No se pudo consultar la API administrativa.");
      return payload;
    }
    readings() {
      return this.send("/readings");
    }
    environment() {
      return this.send("/environment");
    }
    savePmv1(reading) {
      return this.send("/pmv1", "PATCH", reading);
    }
    pmv1History() {
      return this.send("/pmv1");
    }
    operations() {
      return this.send("/operations");
    }
    predictions() {
      return this.send("/predictions");
    }
    activity() {
      return this.send("/activity");
    }
    updateState(kind, id, input) {
      return this.send(`/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, "PATCH", input);
    }
    saveSettings(settings) {
      return this.send("/settings", "PATCH", settings);
    }
  };
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

  // frontend/src/domain/simulation.mjs
  var districts = [{ "ubigeo": "120601", "name": "SATIPO" }, { "ubigeo": "120602", "name": "COVIRIALI" }, { "ubigeo": "120603", "name": "LLAYLLA" }, { "ubigeo": "120604", "name": "MAZAMARI" }, { "ubigeo": "120605", "name": "PAMPA HERMOSA" }, { "ubigeo": "120606", "name": "PANGOA" }, { "ubigeo": "120607", "name": "RIO NEGRO" }, { "ubigeo": "120608", "name": "RIO TAMBO" }, { "ubigeo": "120609", "name": "VIZCATAN DEL ENE" }];
  function generateScenario(scenarioProfile, random, now, id) {
    if (!["Seco", "Variable", "Lluvioso"].includes(scenarioProfile)) throw new Error("Perfil de simulaci\xF3n inv\xE1lido.");
    return {
      type: "SIMULATION_ONLY",
      notice: "Condiciones e \xEDndice simulados. No es un pron\xF3stico ni una alerta real.",
      version: 2,
      profile: scenarioProfile,
      id,
      generatedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + 864e5).toISOString(),
      horizonHours: 24,
      districts: districts.map((district, i) => {
        const u = (k) => random[i * 4 + k];
        const dry = scenarioProfile === "Seco", wet = scenarioProfile === "Lluvioso";
        const temperatureC = Math.round((dry ? 28 + u(0) * 8 : wet ? 20 + u(0) * 7 : 23 + u(0) * 9) * 10) / 10;
        const humidityPct = Math.round(dry ? 25 + u(1) * 30 : wet ? 75 + u(1) * 23 : 45 + u(1) * 40);
        const rainMm = Math.round((dry ? u(2) * 2 : wet ? 8 + u(2) * 27 : u(2) * 12) * 10) / 10;
        const windKmh = Math.round(4 + u(3) * 24);
        const score = Math.round(Math.max(0, Math.min(100, (temperatureC - 18) * 2 + (100 - humidityPct) * 0.55 + windKmh * 0.7 - rainMm * 2)));
        return { ...district, temperatureC, humidityPct, rainMm, windKmh, score, level: score >= 70 ? "Alto" : score >= 40 ? "Medio" : "Bajo" };
      })
    };
  }
  function validHistory(saved) {
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item.version === 2 && item.type === "SIMULATION_ONLY" && typeof item.id === "string" && Number.isFinite(Date.parse(item.generatedAt)) && ["Seco", "Variable", "Lluvioso"].includes(item.profile) && Array.isArray(item.districts) && item.districts.length === 9 && new Set(item.districts.map((r) => r.ubigeo)).size === 9 && item.districts.every((r) => districts.some((d) => d.ubigeo === r.ubigeo) && ["score", "temperatureC", "humidityPct", "rainMm", "windKmh"].every((k) => Number.isFinite(r[k])) && r.score >= 0 && r.score <= 100 && ["Alto", "Medio", "Bajo"].includes(r.level))).slice(0, 10);
  }

  // frontend/src/application/use-cases/simulation-service.mjs
  var SimulationService = class {
    constructor({ store, entropy }) {
      this.store = store;
      this.entropy = entropy;
    }
    history(actor) {
      try {
        return validHistory(JSON.parse(this.store.get(`satipo-demo-v2:${actor}`) || "[]"));
      } catch {
        return [];
      }
    }
    generate(profile, actor) {
      const scenario = generateScenario(profile, this.entropy.numbers(36), this.entropy.now(), this.entropy.id());
      const history = [scenario, ...this.history(actor).filter((item) => item.id !== scenario.id)].slice(0, 10);
      let saved = true;
      try {
        this.store.set(`satipo-demo-v2:${actor}`, JSON.stringify(history));
      } catch {
        saved = false;
      }
      return { scenario, history, saved };
    }
  };

  // frontend/src/adapters/in/browser-presenter.mjs
  function browserPresenter(base2) {
    const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const login = (denied) => location.replace(new URL(`shared/login.html${denied ? "?access=denied" : ""}`, base2));
    function fatal(error) {
      console.error("No se pudo iniciar el aplicativo:", error?.message);
      const box = document.createElement("main");
      box.style.cssText = "padding:40px;max-width:650px;margin:auto;font-family:Arial";
      const title = document.createElement("h1");
      title.textContent = "No se pudo conectar";
      const message = document.createElement("p");
      message.textContent = "Revisa la conexi\xF3n y la configuraci\xF3n de servicio remoto. No se han sustituido los datos por una simulaci\xF3n.";
      const retry = document.createElement("button");
      retry.textContent = "Reintentar";
      retry.onclick = () => location.reload();
      const link = document.createElement("a");
      link.href = new URL("shared/login.html", base2);
      link.textContent = " Volver al acceso";
      box.append(title, message, retry, link);
      document.body.replaceChildren(box);
    }
    return { escapeHTML, login, fatal, signedOut() {
      if (!location.pathname.endsWith("/login.html")) login(false);
    } };
  }

  // frontend/src/adapters/out/report-catalog.json
  var report_catalog_default = {
    version: "report-20261022-pmv1-20261026",
    source: {
      title: "Informe final del proyecto \xB7 Grupo 04",
      date: "2026-10-22",
      pages: 19
    },
    adaptation: "PMV1 ampliado con simulaci\xF3n de cinco variables, inferencia local y firmware ESP32-S3 preparado. El usuario a\xFAn no tiene componentes; pruebas f\xEDsicas y exportaci\xF3n Edge Impulse pendientes. La integraci\xF3n de API ambientales se mantiene separada.",
    requirements: [
      {
        id: "RF-01",
        title: "Recopilar variables ambientales",
        page: 8,
        status: "Parcial",
        evidence: [
          "colab/PMV1_cinco_variables.ipynb",
          "frontend/web/js/pmv1.js",
          "firmware/pmv1/src/main.cpp"
        ],
        gap: "Cinco variables completas, adquisici\xF3n peri\xF3dica y prueba de diez lecturas implementadas. Firmware compilado; no hay placa ni sensores para validaci\xF3n f\xEDsica."
      },
      {
        id: "RF-02",
        title: "Procesar localmente",
        page: 8,
        status: "Parcial",
        evidence: [
          "backend/domain/pmv1.mjs",
          "firmware/pmv1/include/generated_model.h",
          "tests/browser_hexagonal.py"
        ],
        gap: "Inferencia local de \xE1rbol propio probada sin red en navegador. Firmware compilado. Falta exportaci\xF3n real Edge Impulse y ejecuci\xF3n sin Internet en ESP32-S3."
      },
      {
        id: "RF-03",
        title: "Analizar m\xFAltiples variables",
        page: 8,
        status: "Parcial",
        evidence: [
          "colab/PMV1_cinco_variables.ipynb",
          "frontend/web/js/pmv1.js",
          "firmware/pmv1/src/main.cpp"
        ],
        gap: "Cinco variables completas, adquisici\xF3n peri\xF3dica y prueba de diez lecturas implementadas. Firmware compilado; no hay placa ni sensores para validaci\xF3n f\xEDsica."
      },
      {
        id: "RF-04",
        title: "Detectar condiciones de riesgo",
        page: 8,
        status: "Parcial",
        evidence: [
          "scripts/train_pmv1.py",
          "colab/pmv1/evaluation.json"
        ],
        gap: "Tres clases entrenadas con cinco variables sint\xE9ticas; test independiente de 900 registros. Sin validaci\xF3n con incendios reales ni sensores calibrados."
      },
      {
        id: "RF-05",
        title: "Clasificar Normal/Advertencia/Emergencia",
        page: 8,
        status: "Parcial",
        evidence: [
          "scripts/train_pmv1.py",
          "colab/pmv1/evaluation.json"
        ],
        gap: "Tres clases entrenadas con cinco variables sint\xE9ticas; test independiente de 900 registros. Sin validaci\xF3n con incendios reales ni sensores calibrados."
      },
      {
        id: "RF-06",
        title: "Generar alertas locales",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Panel con indicadores demostrativos; no hay alertamiento autom\xE1tico operativo, LED ni buzzer. Definir el canal sustituto en la variante por API."
      },
      {
        id: "RF-07",
        title: "Transmitir alertas inal\xE1mbricas",
        page: 8,
        status: "Adaptado",
        evidence: [
          "acquisition/adapters/http.py",
          "acquisition/application/service.py"
        ],
        gap: "Transporte HTTP y cola con confirmaci\xF3n reemplazan el plan BLE/LoRaWAN para esta variante. Falta receptor real. No implica cumplimiento del enlace f\xEDsico original."
      },
      {
        id: "RF-08",
        title: "Registrar mediciones y eventos",
        page: 8,
        status: "Parcial",
        evidence: [
          "servicio remoto/migrations/202610260001_pmv1.sql",
          "tests/pmv1.test.mjs",
          "tests/pmv1_live.mjs"
        ],
        gap: "Cuatro tablas, l\xEDmites, transacci\xF3n e idempotencia; persistencia remota comprobada tras reabrir sesi\xF3n. Falta aceptaci\xF3n con dispositivo f\xEDsico."
      },
      {
        id: "RF-09",
        title: "Visualizar estado y alertas en m\xF3vil",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/web/index.html",
          "frontend/mobile/index.html"
        ],
        gap: "Interfaz web y c\xF3digo m\xF3vil local existentes; no hay aplicaci\xF3n Flutter/Android validada. El panel permite inspeccionar exportaciones API sin mezclarlas con sensores reales."
      },
      {
        id: "RF-10",
        title: "Registrar usuarios",
        page: 8,
        status: "Pendiente",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs"
        ],
        gap: "El acceso vigente permite solo administradores previamente autorizados. El informe propone registro pero no define aprobaci\xF3n ni alta p\xFAblica; se conserva la restricci\xF3n existente."
      },
      {
        id: "RF-11",
        title: "Autenticar usuarios",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RF-12",
        title: "Gestionar permisos por tipo",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RF-13",
        title: "Cerrar sesi\xF3n",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RF-14",
        title: "Consultar historial",
        page: 8,
        status: "Parcial",
        evidence: [
          "acquisition/adapters/sqlite.py",
          "acquisition/__main__.py",
          "tests/acquisition_test.py"
        ],
        gap: "SQLite conserva lecturas, predicciones opcionales y eventos; consulta sin Internet en equipo local. No es SQLite en Android ni PWA offline. Falta API real y evaluaci\xF3n de retenci\xF3n."
      },
      {
        id: "RF-15",
        title: "Proveer datos para evaluar desempe\xF1o",
        page: 8,
        status: "Parcial",
        evidence: [
          "colab/Alerta_Satipo_300_predicciones.ipynb",
          "backend/adapters/out/prediction-results.json"
        ],
        gap: "Existe evaluaci\xF3n de 300 lecturas. La PoC de 62 630 est\xE1 reportada en el PDF; faltan notebook y artefactos originales para reproducirla."
      },
      {
        id: "RNF-01",
        title: "Tiempo de respuesta",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-02",
        title: "Consumo eficiente de recursos",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-03",
        title: "Comunicaci\xF3n oportuna",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-04",
        title: "Funcionamiento sin Internet",
        page: 8,
        status: "Parcial",
        evidence: [
          "backend/domain/pmv1.mjs",
          "firmware/pmv1/include/generated_model.h",
          "tests/browser_hexagonal.py"
        ],
        gap: "Inferencia local de \xE1rbol propio probada sin red en navegador. Firmware compilado. Falta exportaci\xF3n real Edge Impulse y ejecuci\xF3n sin Internet en ESP32-S3."
      },
      {
        id: "RNF-05",
        title: "Continuidad de operaci\xF3n",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-06",
        title: "Conservaci\xF3n de registros",
        page: 8,
        status: "Parcial",
        evidence: [
          "servicio remoto/migrations/202610260001_pmv1.sql",
          "tests/pmv1.test.mjs",
          "tests/pmv1_live.mjs"
        ],
        gap: "Cuatro tablas, l\xEDmites, transacci\xF3n e idempotencia; persistencia remota comprobada tras reabrir sesi\xF3n. Falta aceptaci\xF3n con dispositivo f\xEDsico."
      },
      {
        id: "RNF-07",
        title: "Interfaz comprensible",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-08",
        title: "Diferenciaci\xF3n clara del riesgo",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-09",
        title: "Protecci\xF3n de credenciales",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RNF-10",
        title: "Control de acceso",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RNF-11",
        title: "Gesti\xF3n de sesiones",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original."
      },
      {
        id: "RNF-12",
        title: "Protecci\xF3n de informaci\xF3n",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "Requiere aceptaci\xF3n y evidencia espec\xEDfica; no se presume cumplido."
      },
      {
        id: "RNF-13",
        title: "Compatibilidad Android",
        page: 8,
        status: "Parcial",
        evidence: [
          "frontend/web/index.html",
          "frontend/mobile/index.html"
        ],
        gap: "Interfaz web y c\xF3digo m\xF3vil local existentes; no hay aplicaci\xF3n Flutter/Android validada. El panel permite inspeccionar exportaciones API sin mezclarlas con sensores reales."
      },
      {
        id: "RNF-14",
        title: "Modularidad",
        page: 8,
        status: "Parcial",
        evidence: [
          "docs/ARQUITECTURA_HEXAGONAL.md",
          "tests/python_architecture_test.py",
          "tests/frontend-hexagonal.test.mjs"
        ],
        gap: "N\xFAcleos separados y repositorio Git. La ampliaci\xF3n API requiere mantener pruebas de integraci\xF3n y revisiones."
      },
      {
        id: "RNF-15",
        title: "Control de versiones",
        page: 8,
        status: "Parcial",
        evidence: [
          "docs/ARQUITECTURA_HEXAGONAL.md",
          "tests/python_architecture_test.py",
          "tests/frontend-hexagonal.test.mjs"
        ],
        gap: "N\xFAcleos separados y repositorio Git. La ampliaci\xF3n API requiere mantener pruebas de integraci\xF3n y revisiones."
      },
      {
        id: "RNF-16",
        title: "Exportaci\xF3n de datos",
        page: 8,
        status: "Parcial",
        evidence: [
          "acquisition/__main__.py",
          "frontend/web/js/admin.js"
        ],
        gap: "Exportaci\xF3n JSON implementada; faltan criterios de aceptaci\xF3n originales y prueba con usuario."
      },
      {
        id: "HU-001",
        title: "Registro de usuario",
        page: 9,
        status: "Pendiente",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs"
        ],
        gap: "El acceso vigente permite solo administradores previamente autorizados. El informe propone registro pero no define aprobaci\xF3n ni alta p\xFAblica; se conserva la restricci\xF3n existente.",
        pmv: "PMV3",
        requirements: [
          "RF-10"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-002",
        title: "Inicio de sesi\xF3n",
        page: 9,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original.",
        pmv: "PMV3",
        requirements: [
          "RF-11"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-003",
        title: "Acceso seg\xFAn rol",
        page: 9,
        status: "Parcial",
        evidence: [
          "frontend/src/application/use-cases/browser-service.mjs",
          "backend/application/use-cases/admin-service.mjs",
          "servicio remoto/migrations/202609230001_initial.sql"
        ],
        gap: "Autenticaci\xF3n, autorizaci\xF3n y cierre implementados para el panel. Falta validar recorrido de usuarios finales Android y aceptaci\xF3n del backlog original.",
        pmv: "PMV3",
        requirements: [
          "RF-12"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-004",
        title: "Captura ambiental",
        page: 9,
        status: "Parcial",
        evidence: [
          "colab/PMV1_cinco_variables.ipynb",
          "frontend/web/js/pmv1.js",
          "firmware/pmv1/src/main.cpp"
        ],
        gap: "Cinco variables completas, adquisici\xF3n peri\xF3dica y prueba de diez lecturas implementadas. Firmware compilado; no hay placa ni sensores para validaci\xF3n f\xEDsica.",
        pmv: "PMV1",
        requirements: [
          "RF-01"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-005",
        title: "Integraci\xF3n de variables",
        page: 9,
        status: "Parcial",
        evidence: [
          "colab/PMV1_cinco_variables.ipynb",
          "frontend/web/js/pmv1.js",
          "firmware/pmv1/src/main.cpp"
        ],
        gap: "Cinco variables completas, adquisici\xF3n peri\xF3dica y prueba de diez lecturas implementadas. Firmware compilado; no hay placa ni sensores para validaci\xF3n f\xEDsica.",
        pmv: "PMV1",
        requirements: [
          "RF-03"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-006",
        title: "Procesamiento local",
        page: 9,
        status: "Parcial",
        evidence: [
          "backend/domain/pmv1.mjs",
          "firmware/pmv1/include/generated_model.h",
          "tests/browser_hexagonal.py"
        ],
        gap: "Inferencia local de \xE1rbol propio probada sin red en navegador. Firmware compilado. Falta exportaci\xF3n real Edge Impulse y ejecuci\xF3n sin Internet en ESP32-S3.",
        pmv: "PMV1",
        requirements: [
          "RF-02"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-007",
        title: "Detecci\xF3n de riesgo",
        page: 9,
        status: "Parcial",
        evidence: [
          "scripts/train_pmv1.py",
          "colab/pmv1/evaluation.json"
        ],
        gap: "Tres clases entrenadas con cinco variables sint\xE9ticas; test independiente de 900 registros. Sin validaci\xF3n con incendios reales ni sensores calibrados.",
        pmv: "PMV1",
        requirements: [
          "RF-04"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-008",
        title: "Clasificaci\xF3n de riesgo",
        page: 9,
        status: "Parcial",
        evidence: [
          "scripts/train_pmv1.py",
          "colab/pmv1/evaluation.json"
        ],
        gap: "Tres clases entrenadas con cinco variables sint\xE9ticas; test independiente de 900 registros. Sin validaci\xF3n con incendios reales ni sensores calibrados.",
        pmv: "PMV1",
        requirements: [
          "RF-05"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-009",
        title: "Alerta visual",
        page: 9,
        status: "Pendiente",
        evidence: [],
        gap: "Panel con indicadores demostrativos; no hay alertamiento autom\xE1tico operativo, LED ni buzzer. Definir el canal sustituto en la variante por API.",
        pmv: "PMV2",
        requirements: [
          "RF-06"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-010",
        title: "Alerta sonora",
        page: 9,
        status: "Pendiente",
        evidence: [],
        gap: "Panel con indicadores demostrativos; no hay alertamiento autom\xE1tico operativo, LED ni buzzer. Definir el canal sustituto en la variante por API.",
        pmv: "PMV2",
        requirements: [
          "RF-06"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-011",
        title: "Env\xEDo por BLE",
        page: 9,
        status: "Adaptado",
        evidence: [
          "acquisition/adapters/http.py",
          "acquisition/application/service.py"
        ],
        gap: "Transporte HTTP y cola con confirmaci\xF3n reemplazan el plan BLE/LoRaWAN para esta variante. Falta receptor real. No implica cumplimiento del enlace f\xEDsico original.",
        pmv: "PMV2",
        requirements: [
          "RF-07"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-012",
        title: "Comunicaci\xF3n a largo alcance",
        page: 9,
        status: "Adaptado",
        evidence: [
          "acquisition/adapters/http.py",
          "acquisition/application/service.py"
        ],
        gap: "Transporte HTTP y cola con confirmaci\xF3n reemplazan el plan BLE/LoRaWAN para esta variante. Falta receptor real. No implica cumplimiento del enlace f\xEDsico original.",
        pmv: "PMV3",
        requirements: [
          "RF-07"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-013",
        title: "Visualizar estado actual",
        page: 9,
        status: "Parcial",
        evidence: [
          "frontend/web/index.html",
          "frontend/mobile/index.html"
        ],
        gap: "Interfaz web y c\xF3digo m\xF3vil local existentes; no hay aplicaci\xF3n Flutter/Android validada. El panel permite inspeccionar exportaciones API sin mezclarlas con sensores reales.",
        pmv: "PMV2",
        requirements: [
          "RF-09"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-014",
        title: "Consultar historial",
        page: 9,
        status: "Parcial",
        evidence: [
          "acquisition/adapters/sqlite.py",
          "acquisition/__main__.py",
          "tests/acquisition_test.py"
        ],
        gap: "SQLite conserva lecturas, predicciones opcionales y eventos; consulta sin Internet en equipo local. No es SQLite en Android ni PWA offline. Falta API real y evaluaci\xF3n de retenci\xF3n.",
        pmv: "PMV3",
        requirements: [
          "RF-14"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-015",
        title: "Registrar evento",
        page: 9,
        status: "Parcial",
        evidence: [
          "servicio remoto/migrations/202610260001_pmv1.sql",
          "tests/pmv1.test.mjs",
          "tests/pmv1_live.mjs"
        ],
        gap: "Cuatro tablas, l\xEDmites, transacci\xF3n e idempotencia; persistencia remota comprobada tras reabrir sesi\xF3n. Falta aceptaci\xF3n con dispositivo f\xEDsico.",
        pmv: "PMV1",
        requirements: [
          "RF-08"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-016",
        title: "Consultar offline",
        page: 9,
        status: "Parcial",
        evidence: [
          "acquisition/adapters/sqlite.py",
          "acquisition/__main__.py",
          "tests/acquisition_test.py"
        ],
        gap: "SQLite conserva lecturas, predicciones opcionales y eventos; consulta sin Internet en equipo local. No es SQLite en Android ni PWA offline. Falta API real y evaluaci\xF3n de retenci\xF3n.",
        pmv: "PMV3",
        requirements: [
          "RF-08",
          "RF-14"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-017",
        title: "Exportar informaci\xF3n",
        page: 9,
        status: "Parcial",
        evidence: [
          "acquisition/__main__.py",
          "frontend/web/js/admin.js"
        ],
        gap: "Exportaci\xF3n JSON implementada; faltan criterios de aceptaci\xF3n originales y prueba con usuario.",
        pmv: "PMV3",
        requirements: [
          "RF-15"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "HU-018",
        title: "Evaluar desempe\xF1o",
        page: 9,
        status: "Parcial",
        evidence: [
          "colab/Alerta_Satipo_300_predicciones.ipynb",
          "backend/adapters/out/prediction-results.json"
        ],
        gap: "Existe evaluaci\xF3n de 300 lecturas. La PoC de 62 630 est\xE1 reportada en el PDF; faltan notebook y artefactos originales para reproducirla.",
        pmv: "PMV3",
        requirements: [
          "RF-15"
        ],
        mapping: "Correspondencia propuesta en esta integraci\xF3n; los ID y PMV proceden del informe."
      },
      {
        id: "RP-01",
        title: "Normal / Advertencia / Emergencia",
        page: 8,
        status: "Parcial",
        evidence: [
          "scripts/train_pmv1.py",
          "colab/pmv1/evaluation.json"
        ],
        gap: "Tres clases entrenadas con cinco variables sint\xE9ticas; test independiente de 900 registros. Sin validaci\xF3n con incendios reales ni sensores calibrados."
      },
      {
        id: "RP-02",
        title: "Condici\xF3n compatible con incendio: 0 / 1",
        page: 8,
        status: "Parcial",
        evidence: [
          "colab/Alerta_Satipo_300_predicciones.ipynb"
        ],
        gap: "Clasificaci\xF3n experimental externa; no validaci\xF3n territorial ni inferencia API operativa."
      },
      {
        id: "RP-03",
        title: "Condici\xF3n an\xF3mala: 0 / 1",
        page: 8,
        status: "Pendiente",
        evidence: [],
        gap: "La perturbaci\xF3n de datos no constituye un detector independiente de anomal\xEDas."
      }
    ],
    experiments: {
      report: {
        provenance: "Valores transcritos del PDF, p\xE1ginas 15\u201316. No ejecutados ni reproducidos en esta integraci\xF3n.",
        rows: 62630,
        features: 9,
        train: 50104,
        test: 12526,
        models: [
          {
            name: "Random Forest",
            accuracy: 0.9976,
            f1_macro: 0.9971,
            recall_alarm: 0.999
          },
          {
            name: "\xC1rbol",
            accuracy: 0.9896,
            f1_macro: 0.9873,
            recall_alarm: 0.9895
          },
          {
            name: "Regresi\xF3n log\xEDstica",
            accuracy: 0.7775,
            f1_macro: 0.6383,
            recall_alarm: 0.9781
          },
          {
            name: "Baseline",
            accuracy: 0.7146,
            f1_macro: 0.4168,
            recall_alarm: 1
          }
        ],
        temporal: {
          f1_macro: 0.6869,
          recall_alarm: 0.8465
        },
        noise_2_percent: {
          f1_macro: 0.8351,
          recall_alarm: 0.8638
        },
        confusion_matrix: [
          [
            3554,
            21
          ],
          [
            9,
            8942
          ]
        ],
        colab_latency_ms: 45.965
      },
      repository: {
        rows: 300,
        train: 240,
        test: 60,
        correct: 54,
        false_negatives: 5,
        false_positives: 1,
        artifact: "backend/adapters/out/prediction-results.json"
      }
    },
    management: {
      weeks: 16,
      sprints: 8,
      tasks_reported: 43,
      administrative_progress_reported: 37.5349,
      physical_acceptance: false,
      note: "Cifras del informe; no avance calculado a partir del c\xF3digo.",
      milestones: [
        {
          id: "PMV1",
          weeks: "1\u20136",
          scope: "Adquisici\xF3n, tratamiento y primeras pruebas"
        },
        {
          id: "PMV2",
          weeks: "7\u201312",
          scope: "Modelo, alertas y visualizaci\xF3n"
        },
        {
          id: "PMV3",
          weeks: "13\u201316",
          scope: "Comunicaci\xF3n, usuarios, historial, offline y evaluaci\xF3n integral"
        }
      ]
    },
    risks: [
      "Datos externos no representativos de Satipo",
      "Variables o unidades incompatibles con el modelo",
      "Falsos negativos y falsas alarmas",
      "Interrupci\xF3n de API, cuotas o cambios de contrato",
      "P\xE9rdida de conectividad: no hay nuevas lecturas offline",
      "Exposici\xF3n de credenciales o informaci\xF3n personal"
    ],
    missing_evidence: [
      "Notebook y exportaciones originales de la PoC de 62 630 filas",
      "Backlog original con Given/When/Then",
      "Libro Gantt con las 43 actividades",
      "API seleccionada y su contrato",
      "Modelo apto para las variables del proveedor",
      "Pruebas con usuarios, experto y actas de aceptaci\xF3n",
      "Proyecto Flutter o decisi\xF3n de mantener solo web"
    ]
  };

  // frontend/src/adapters/out/project-files.mjs
  var ProjectFiles = class {
    async read(file) {
      if (!file || file.size > 1e7) throw Error("Selecciona un JSON de hasta 10 MB.");
      return JSON.parse(await file.text());
    }
    download(name, data) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }
  };

  // frontend/src/domain/acquisition.mjs
  var units = { temperature_c: "degC", humidity_pct: "%", tvoc_ppb: "ppb", eco2_ppm: "ppm", pm1_0: "ug/m3", pm2_5: "ug/m3", nc0_5: "#/cm3", nc1_0: "#/cm3", nc2_5: "#/cm3", pm10: "ug/m3", wind_kmh: "km/h", rain_mm: "mm" };
  function validateAcquisitionExport(value) {
    if (value?.schema_version !== 1 || value.operational !== false || !Array.isArray(value.rows) || value.rows.length > 1e4) throw Error("Exportaci\xF3n API incompatible. Usa python -m acquisition export.");
    const keys = /* @__PURE__ */ new Set();
    for (const row of value.rows) {
      const r = row?.reading;
      if (!r || !["weather", "smoke"].includes(r.kind) || r.provenance !== "api" || !r.values || !r.units || Array.isArray(r.values) || !Object.keys(r.values).length) throw Error("Lectura API inv\xE1lida.");
      for (const name of ["source", "external_id", "node_id"]) if (typeof r[name] !== "string" || !r[name].trim() || r[name].length > 200) throw Error("Identificador inv\xE1lido.");
      if (typeof r.observed_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(r.observed_at) || !Number.isFinite(Date.parse(r.observed_at))) throw Error("Fecha sin zona horaria o inv\xE1lida.");
      const key = JSON.stringify([r.source, r.external_id]);
      if (keys.has(key)) throw Error("Lecturas duplicadas.");
      keys.add(key);
      for (const [name, n] of Object.entries(r.values)) if (!Object.hasOwn(units, name) || units[name] !== r.units[name] || typeof n !== "number" || !Number.isFinite(n) || name !== "temperature_c" && n < 0 || name === "humidity_pct" && n > 100) throw Error("Variable, rango o unidad incompatible.");
      if (row.prediction !== null) {
        const p = row.prediction;
        if (!p || r.kind !== "smoke" || p.operational !== false || typeof p.alarm !== "boolean" || typeof p.score !== "number" || !Number.isFinite(p.score) || p.score < 0 || p.score > 1 || typeof p.model_version !== "string" || !p.model_version.trim() || p.risk_level !== null || p.anomaly !== null) throw Error("Predicci\xF3n experimental inv\xE1lida.");
      }
    }
    return value;
  }

  // frontend/src/application/use-cases/project-service.mjs
  var ProjectService = class {
    constructor({ catalog, files }) {
      this.catalog = catalog;
      this.files = files;
      this.rows = [];
    }
    requirements({ type = "", status = "", query = "" } = {}) {
      const term = query.trim().toLocaleLowerCase("es");
      return this.catalog.requirements.filter((r) => (!type || r.id.startsWith(type + "-")) && (!status || r.status === status) && (!term || `${r.id} ${r.title} ${r.gap}`.toLocaleLowerCase("es").includes(term)));
    }
    async importReadings(file) {
      this.rows = [];
      this.rows = validateAcquisitionExport(await this.files.read(file)).rows;
      return this.rows;
    }
    exportCatalog() {
      this.files.download("satipo-trazabilidad-informe.json", this.catalog);
    }
  };

  // frontend/src/domain/pmv1-model.mjs
  var pmv1_model_default = { "version": "pmv1-synthetic-tree-v1", "features": ["temperature_c", "humidity_pct", "smoke_index", "gas_index", "dust_ugm3"], "labels": ["Normal", "Advertencia", "Emergencia"], "experimental": true, "left": [1, 2, 3, 4, 5, 6, -1, -1, -1, 10, 11, -1, -1, -1, 15, 16, 17, -1, -1, 20, -1, -1, 23, -1, -1, 26, 27, 28, 29, -1, -1, 32, -1, -1, -1, 36, -1, -1, 39, 40, 41, 42, 43, -1, -1, 46, -1, -1, 49, 50, -1, -1, -1, 54, 55, 56, -1, -1, -1, 60, -1, -1, 63, 64, 65, 66, -1, -1, -1, 70, 71, -1, -1, -1, 75, 76, 77, -1, -1, -1, 81, 82, -1, -1, 85, -1, -1], "right": [38, 25, 14, 9, 8, 7, -1, -1, -1, 13, 12, -1, -1, -1, 22, 19, 18, -1, -1, 21, -1, -1, 24, -1, -1, 35, 34, 31, 30, -1, -1, 33, -1, -1, -1, 37, -1, -1, 62, 53, 48, 45, 44, -1, -1, 47, -1, -1, 52, 51, -1, -1, -1, 59, 58, 57, -1, -1, -1, 61, -1, -1, 74, 69, 68, 67, -1, -1, -1, 73, 72, -1, -1, -1, 80, 79, 78, -1, -1, -1, 84, 83, -1, -1, 86, -1, -1], "feature": [2, 3, 1, 4, 2, 0, -2, -2, -2, 0, 3, -2, -2, -2, 0, 0, 2, -2, -2, 4, -2, -2, 4, -2, -2, 1, 3, 4, 0, -2, -2, 0, -2, -2, -2, 4, -2, -2, 3, 4, 2, 2, 4, -2, -2, 0, -2, -2, 1, 0, -2, -2, -2, 0, 4, 4, -2, -2, -2, 2, -2, -2, 2, 4, 0, 1, -2, -2, -2, 1, 1, -2, -2, -2, 0, 1, 3, -2, -2, -2, 1, 2, -2, -2, 2, -2, -2], "threshold": [28.470335960388184, 33.222251892089844, 47.2463321685791, 48.10173416137695, 17.44183349609375, 30.688135147094727, -2, -2, -2, 33.925771713256836, 17.45177936553955, -2, -2, -2, 39.31193733215332, 35.715349197387695, 22.361757278442383, -2, -2, 50.21355438232422, -2, -2, 49.19426918029785, -2, -2, 64.57579803466797, 76.20793914794922, 21.544191360473633, 35.03434181213379, -2, -2, 47.51317024230957, -2, -2, -2, 57.331966400146484, -2, -2, 54.29111289978027, 191.45748901367188, 77.3489875793457, 33.8106575012207, 39.54125213623047, -2, -2, 52.38118553161621, -2, -2, 41.92910575866699, 44.519968032836914, -2, -2, -2, 40.05462074279785, 248.16212463378906, 216.69742584228516, -2, -2, -2, 62.16301155090332, -2, -2, 52.44999885559082, 179.8333282470703, 48.66708755493164, 26.094680786132812, -2, -2, -2, 46.145559310913086, 35.28714179992676, -2, -2, -2, 35.289249420166016, 49.433441162109375, 65.02591323852539, -2, -2, -2, 43.723520278930664, 57.1257438659668, -2, -2, 60.688093185424805, -2, -2], "scores": [[0.334, 0.33266666666666667, 0.3333333333333333], [0.7937551355792933, 0.19967132292522596, 0.00657354149548069], [0.9205103042198234, 0.07948969578017664, 0], [0.576271186440678, 0.423728813559322, 0], [0.8260869565217391, 0.17391304347826086, 0], [0.92, 0.08, 0], [0.9736842105263158, 0.02631578947368421, 0], [0.75, 0.25, 0], [0.5789473684210527, 0.42105263157894735, 0], [0.22448979591836735, 0.7755102040816326, 0], [0.36666666666666664, 0.6333333333333333, 0], [0.5, 0.5, 0], [0.21428571428571427, 0.7857142857142857, 0], [0, 1, 0], [0.9655937846836848, 0.03440621531631521, 0], [0.9827784156142365, 0.01722158438576349, 0], [0.9914841849148418, 0.00851581508515815, 0], [0.9972972972972973, 0.002702702702702703, 0], [0.9390243902439024, 0.06097560975609756, 0], [0.8367346938775511, 0.16326530612244897, 0], [0.9714285714285714, 0.02857142857142857, 0], [0.5, 0.5, 0], [0.4666666666666667, 0.5333333333333333, 0], [0.8571428571428571, 0.14285714285714285, 0], [0.125, 0.875, 0], [0.1414141414141414, 0.8181818181818182, 0.04040404040404041], [0.06172839506172839, 0.8888888888888888, 0.04938271604938271], [0.06711409395973154, 0.9194630872483222, 0.013422818791946308], [0.2692307692307692, 0.7307692307692307, 0], [0.5, 0.5, 0], [0.07142857142857142, 0.9285714285714286, 0], [0.024390243902439025, 0.959349593495935, 0.016260162601626018], [0.02702702702702703, 0.972972972972973, 0], [0, 0.8333333333333334, 0.16666666666666666], [0, 0.5384615384615384, 0.46153846153846156], [0.5, 0.5, 0], [0.9230769230769231, 0.07692307692307693, 0], [0.2608695652173913, 0.7391304347826086, 0], [0.020190689848569827, 0.42344363432417276, 0.5563656758272574], [0.04580152671755725, 0.7659033078880407, 0.18829516539440203], [0.05239520958083832, 0.8592814371257484, 0.08832335329341318], [0.05663430420711974, 0.8996763754045307, 0.043689320388349516], [0.25892857142857145, 0.7410714285714286, 0], [0.6363636363636364, 0.36363636363636365, 0], [0.10126582278481013, 0.8987341772151899, 0], [0.011857707509881422, 0.9347826086956522, 0.0533596837944664], [0.012219959266802445, 0.9490835030549899, 0.03869653767820774], [0, 0.4666666666666667, 0.5333333333333333], [0, 0.36, 0.64], [0, 0.17647058823529413, 0.8235294117647058], [0, 0.375, 0.625], [0, 0, 1], [0, 0.75, 0.25], [0.00847457627118644, 0.23728813559322035, 0.7542372881355932], [0.02631578947368421, 0.631578947368421, 0.34210526315789475], [0.04, 0.84, 0.12], [0.07692307692307693, 0.9230769230769231, 0], [0, 0.75, 0.25], [0, 0.23076923076923078, 0.7692307692307693], [0, 0.05, 0.95], [0, 0.2222222222222222, 0.7777777777777778], [0, 0, 1], [0, 0.1534603811434303, 0.8465396188565697], [0, 0.5573770491803278, 0.4426229508196721], [0, 0.7661290322580645, 0.23387096774193547], [0, 0.8737864077669902, 0.1262135922330097], [0, 0.5, 0.5], [0, 0.9230769230769231, 0.07692307692307693], [0, 0.23809523809523808, 0.7619047619047619], [0, 0.11864406779661017, 0.8813559322033898], [0, 0.02127659574468085, 0.9787234042553191], [0, 0, 1], [0, 0.08333333333333333, 0.9166666666666666], [0, 0.5, 0.5], [0, 0.06265356265356266, 0.9373464373464373], [0, 0.25925925925925924, 0.7407407407407407], [0, 0.17647058823529413, 0.8235294117647058], [0, 0.6111111111111112, 0.3888888888888889], [0, 0.09900990099009901, 0.900990099009901], [0, 0.875, 0.125], [0, 0.023564064801178203, 0.9764359351988218], [0, 0.0034662045060658577, 0.9965337954939342], [0, 0.05555555555555555, 0.9444444444444444], [0, 0, 1], [0, 0.13725490196078433, 0.8627450980392157], [0, 0.4, 0.6], [0, 0.07317073170731707, 0.926829268292683]] };

  // frontend/src/domain/pmv1.mjs
  var ApplicationError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  };
  var bounds = [[-20, 80], [0, 100], [0, 100], [0, 100], [0, 1e3]];
  function validatePmv1(input) {
    const fail = () => {
      throw new ApplicationError("VALIDATION", "Registro PMV1 inv\xE1lido: se requieren cinco variables completas y dentro de rango.");
    };
    if (!input || Array.isArray(input) || !input.values || Array.isArray(input.values)) fail();
    if (input.device_prediction && input.device_prediction.model_version !== pmv1_model_default.version)
      throw new ApplicationError("VALIDATION", "La exportaci\xF3n del dispositivo usa otro modelo. Se requiere integrar y validar esa versi\xF3n antes de importar sus lecturas.");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(input.id) || !uuid.test(input.node_id) || !["simulation", "sensor"].includes(input.source)) fail();
    if (typeof input.observed_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(input.observed_at) || !Number.isFinite(Date.parse(input.observed_at))) fail();
    if (Object.keys(input.values).length !== 5) fail();
    const values = {};
    pmv1_model_default.features.forEach((key, i) => {
      const value = input.values[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < bounds[i][0] || value > bounds[i][1]) fail();
      values[key] = value;
    });
    return { id: input.id, node_id: input.node_id, source: input.source, observed_at: new Date(input.observed_at).toISOString(), values };
  }
  function evaluatePmv1(input) {
    const reading = validatePmv1(input), x = pmv1_model_default.features.map((key) => Math.fround(reading.values[key]));
    let n = 0;
    while (pmv1_model_default.left[n] >= 0) n = x[pmv1_model_default.feature[n]] <= pmv1_model_default.threshold[n] ? pmv1_model_default.left[n] : pmv1_model_default.right[n];
    const scores = pmv1_model_default.scores[n], index = scores.indexOf(Math.max(...scores));
    return {
      reading,
      prediction: { level: pmv1_model_default.labels[index], scores, model_version: pmv1_model_default.version, experimental: true },
      alert: index === 0 ? null : { level: pmv1_model_default.labels[index], channel: "software", experimental: true }
    };
  }

  // frontend/src/application/use-cases/pmv1-service.mjs
  var Pmv1Service = class {
    constructor({ store, entropy, remote }) {
      Object.assign(this, { store, entropy, remote });
    }
    async capture(scenario = "Normal") {
      const bases = { Normal: [25, 70, 10, 12, 15], Advertencia: [34, 48, 45, 42, 90], Emergencia: [52, 25, 85, 82, 260] };
      if (!bases[scenario]) throw Error("Escenario inv\xE1lido");
      const noise = this.entropy.numbers(5), base2 = bases[scenario];
      const values = Object.fromEntries(["temperature_c", "humidity_pct", "smoke_index", "gas_index", "dust_ugm3"].map((key, i) => [key, Math.round((base2[i] + (noise[i] - 0.5) * (i === 4 ? 10 : 4)) * 100) / 100]));
      return this.ingest({ id: this.entropy.id(), node_id: "00000000-0000-4000-8000-000000000001", source: "simulation", observed_at: this.entropy.now().toISOString(), values });
    }
    async ingest(input) {
      const record = evaluatePmv1(input);
      await this.store.put({ ...record, synced: false });
      return record;
    }
    history() {
      return this.store.all();
    }
    async importRecords(records) {
      if (!Array.isArray(records) || !records.length || records.length > 1e3) throw Error("Se requieren de 1 a 1000 lecturas.");
      const evaluated = records.map((r) => ({ ...evaluatePmv1(r), synced: false }));
      if (new Set(evaluated.map((r) => r.reading.id)).size !== evaluated.length) throw Error("Hay identificadores duplicados.");
      await this.store.putMany(evaluated);
    }
    async synchronize() {
      let synced = 0;
      const rows = await this.store.all();
      for (const row of rows.filter((r) => !r.synced)) {
        const ack = await this.remote.savePmv1(row.reading);
        if (ack?.id !== row.reading.id) throw Error("Confirmaci\xF3n de sincronizaci\xF3n inv\xE1lida");
        await this.store.ack(row.reading.id);
        synced++;
      }
      return synced;
    }
  };

  // frontend/src/adapters/out/pmv1-store.mjs
  var Pmv1Store = class {
    constructor(owner) {
      this.owner = owner;
      this.db = null;
    }
    async open() {
      if (this.db) return this.db;
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("satipo-pmv1-" + this.owner, 1);
        req.onupgradeneeded = () => req.result.createObjectStore("records", { keyPath: "reading.id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(Error("No se pudo abrir el historial local"));
      });
      return this.db;
    }
    async put(record) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        tx.objectStore("records").add(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(Error("No se guard\xF3 la lectura: ID repetido o almacenamiento no disponible."));
      });
    }
    async putMany(records) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        for (const r of records) tx.objectStore("records").add(r);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(Error("Lote rechazado: identificador repetido o fallo de almacenamiento."));
      });
    }
    async all() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const r = db.transaction("records").objectStore("records").getAll();
        r.onsuccess = () => resolve(r.result.sort((a, b) => b.reading.observed_at.localeCompare(a.reading.observed_at)));
        r.onerror = () => reject(Error("No se pudo leer el historial"));
      });
    }
    async ack(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite"), store = tx.objectStore("records"), r = store.get(id);
        r.onsuccess = () => {
          if (r.result) store.put({ ...r.result, synced: true });
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(Error("No se pudo confirmar el registro local"));
      });
    }
  };

  // frontend/src/bootstrap/backend.mjs
  window.SatipoProject = new ProjectService({ catalog: report_catalog_default, files: new ProjectFiles() });
  window.SatipoPmv1Files = new ProjectFiles();
  window.createPmv1Service = (owner) => new Pmv1Service({ store: new Pmv1Store(owner), entropy: new BrowserEntropy(), remote: window.SatipoBackend });
  var base = new URL("../../", document.currentScript.src);
  var presenter = browserPresenter(base);
  var assets = new HttpAssets(base, window.fetch.bind(window));
  window.SatipoSimulation = new SimulationService({ store: new BrowserStorage(window.localStorage), entropy: new BrowserEntropy() });
  var service;
  var ready = (async () => {
    await assets.config();
    const cloud = false;
    const identity = null;
    service = new BrowserService({
      cloud,
      identity,
      assets,
      profiles: null,
      community: null,
      admin: new HttpAdmin({ url: null, publicKey: null, identity, request: window.fetch.bind(window) }),
      session: new BrowserStorage(window.sessionStorage),
      preferences: new BrowserStorage(window.localStorage)
    });
    if (identity) identity.subscribe(() => {
      service.signedOut();
      presenter.signedOut();
    });
  })();
  ready.catch(() => {
  });
  var actions = Object.fromEntries([
    "identify",
    "login",
    "recover",
    "changePassword",
    "savePreference",
    "listReadings",
    "listOperations",
    "listPredictions",
    "getEnvironment",
    "savePmv1",
    "pmv1History",
    "getActivity",
    "updateState",
    "saveSettings",
    "createReport",
    "requestHelp"
  ].map((name) => [name, async (...args) => {
    await ready;
    return service[name](...args);
  }]));
  window.SatipoBackend = {
    ...actions,
    ready,
    escapeHTML: presenter.escapeHTML,
    fatal: presenter.fatal,
    get cloud() {
      return service?.cloud || false;
    },
    get profile() {
      return service?.profile || null;
    },
    userName: () => service.userName(),
    userEmail: () => service.userEmail(),
    preference: (...args) => service.preference(...args),
    async guard(role) {
      await ready;
      const decision = await service.allowed(role);
      if (!decision.allowed) presenter.login(decision.denied);
      return decision.allowed;
    },
    async logout() {
      await ready;
      await service.logout();
      presenter.login(false);
    }
  };
})();
