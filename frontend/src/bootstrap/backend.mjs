import { BrowserService } from '../application/use-cases/browser-service.mjs';
import { HttpAdmin, HttpAssets } from '../adapters/out/http.mjs';
import { BrowserStorage, BrowserEntropy } from '../adapters/out/browser.mjs';
import { SimulationService } from '../application/use-cases/simulation-service.mjs';
import { browserPresenter } from '../adapters/in/browser-presenter.mjs';
import catalog from '../adapters/out/report-catalog.json';
import { ProjectFiles } from '../adapters/out/project-files.mjs';
import { ProjectService } from '../application/use-cases/project-service.mjs';
import { Pmv1Service } from '../application/use-cases/pmv1-service.mjs';
import { Pmv1Store } from '../adapters/out/pmv1-store.mjs';

window.SatipoProject = new ProjectService({catalog,files:new ProjectFiles()});
window.SatipoPmv1Files=new ProjectFiles();
window.createPmv1Service=owner=>new Pmv1Service({store:new Pmv1Store(owner),entropy:new BrowserEntropy(),remote:window.SatipoBackend});

const base = new URL('../../', document.currentScript.src);
const presenter = browserPresenter(base);
const assets = new HttpAssets(base, window.fetch.bind(window));
window.SatipoSimulation = new SimulationService({store:new BrowserStorage(window.localStorage),entropy:new BrowserEntropy()});
let service;
const ready = (async () => {
  await assets.config();
  const cloud = false;
  const identity = null;
  service = new BrowserService({cloud, identity, assets,
    profiles: null,
    community: null,
    admin: new HttpAdmin({url:null,publicKey:null,identity,request:window.fetch.bind(window)}),
    session:new BrowserStorage(window.sessionStorage), preferences:new BrowserStorage(window.localStorage)
  });
  if (identity) identity.subscribe(() => {service.signedOut(); presenter.signedOut();});
})();
ready.catch(() => {});
const actions = Object.fromEntries(['identify','login','recover','changePassword','savePreference',
  'listReadings','listOperations','listPredictions','getEnvironment','savePmv1','pmv1History','getActivity','updateState','saveSettings','createReport','requestHelp'
].map(name => [name, async (...args) => {await ready; return service[name](...args);} ]));
window.SatipoBackend = {
  ...actions, ready, escapeHTML:presenter.escapeHTML, fatal:presenter.fatal,
  get cloud() { return service?.cloud || false; },
  get profile() { return service?.profile || null; },
  userName: () => service.userName(), userEmail: () => service.userEmail(),
  preference: (...args) => service.preference(...args),
  async guard(role) { await ready; const decision = await service.allowed(role); if (!decision.allowed) presenter.login(decision.denied); return decision.allowed; },
  async logout() { await ready; await service.logout(); presenter.login(false); }
};
