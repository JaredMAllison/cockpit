// hooks/api.js — fetch wrappers, one function per endpoint
// HOSTS is the only thing that changes between Jared's and Jason's deployments.

const HOSTS = {
  marlin:   'http://localhost:7832',
  projects: 'http://localhost:7833',
  ttf:      'http://localhost:3000',
  ariel:    'http://10.0.0.78:8742',
};

function _fetch(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
    return r.json();
  });
}

function fetchState()         { return _fetch(`${HOSTS.marlin}/api/state`); }
function fetchTodayTasks()    { return _fetch(`${HOSTS.marlin}/tasks/today`); }
function fetchAdls()          { return _fetch(`${HOSTS.marlin}/api/adls`); }
function fetchProjects()      { return _fetch(`${HOSTS.projects}/api/projects`); }
function fetchVaultTree()     { return _fetch(`${HOSTS.projects}/api/vault/tree`); }
function fetchVaultFile(path) {
  const url = `${HOSTS.projects}/api/vault/file?path=${encodeURIComponent(path)}`;
  return fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
      return r.text();  // vault files are markdown text, not JSON
    });
}
function fetchTtfEvents() {
  const d     = new Date();
  const pad   = n => String(n).padStart(2, '0');
  const today = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  const week  = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
  return _fetch(`${HOSTS.ttf}/api/events?from=${today}&to=${week}`);
}
function fetchArielTurns() { return Promise.resolve([]); }  // stubbed until Ariel API confirmed
