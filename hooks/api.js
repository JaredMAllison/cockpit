// hooks/api.js — fetch wrappers, one function per endpoint
// HOSTS — update these if services run on different ports or hosts.

const HOSTS = {
  marlin:   'http://localhost:7832',
  projects: 'http://localhost:7833',
  ttf:      'http://localhost:8000',
  ariel:    'http://localhost:8002',
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
function fetchProjectsTree()  { return _fetch(`${HOSTS.projects}/api/projects/tree`); }
function fetchProjectFile(pid, rel) {
  const url = `${HOSTS.projects}/api/projects/${pid}/file?path=${encodeURIComponent(rel)}`;
  return fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
      return r.text();
    });
}
function fetchProjectAdls(pid) { return _fetch(`${HOSTS.projects}/api/projects/${pid}/adls`); }
function fetchProjectTasks(pid) { return _fetch(`${HOSTS.projects}/api/projects/${pid}/tasks`); }
function fetchProjectEvents(pid) { return _fetch(`${HOSTS.projects}/api/projects/${pid}/events`); }
function fetchTtfEvents(from, to) { return _fetch(`${HOSTS.ttf}/api/events?from=${from}&to=${to}`); }
function postTtfEvent(event) {
  return fetch(`${HOSTS.ttf}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}
function patchTtfEvent(id, changes) {
  return fetch(`${HOSTS.ttf}/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}
function deleteTtfEvent(id) {
  return fetch(`${HOSTS.ttf}/api/events/${id}`, { method: 'DELETE' });
}
function fetchMarlinMode() { return _fetch(`${HOSTS.marlin}/mode`); }
function postMarlinMode(id) {
  return fetch(`${HOSTS.marlin}/mode?set=${id}`, { method: 'GET', redirect: 'manual' });
}
function fetchMarlinDone(task) {
  return fetch(`${HOSTS.marlin}/done?task=${encodeURIComponent(task)}`, { redirect: 'manual' });
}
function fetchMarlinDefer(task) {
  return fetch(`${HOSTS.marlin}/defer?task=${encodeURIComponent(task)}`, { redirect: 'manual' });
}
function fetchMarlinSnooze(task, minutes) {
  return fetch(`${HOSTS.marlin}/snooze?task=${encodeURIComponent(task)}&minutes=${minutes}`, { redirect: 'manual' });
}
function fetchMarlinTodayTasks() { return _fetch(`${HOSTS.marlin}/tasks/today`); }
function fetchMarlinAdlLog() { return _fetch(`${HOSTS.marlin}/api/adl-log`); }
function fetchMarlinAdlToday() { return _fetch(`${HOSTS.marlin}/api/adl-today`); }
function fetchMarlinProjects() { return _fetch(`${HOSTS.marlin}/api/projects`); }
function fetchMarlinProjectTree(pid) { return _fetch(`${HOSTS.marlin}/api/projects/${pid}/tree`); }
function fetchMarlinProjectFile(pid, rel) {
  const url = `${HOSTS.marlin}/api/projects/${pid}/file?path=${encodeURIComponent(rel)}`;
  return fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
      return r.text();
    });
}
function fetchMarlinProjectAdls(pid) { return _fetch(`${HOSTS.marlin}/api/projects/${pid}/adls`); }
function fetchMarlinProjectTasks(pid) { return _fetch(`${HOSTS.marlin}/api/projects/${pid}/tasks`); }
function fetchMarlinProjectEvents(pid) { return _fetch(`${HOSTS.marlin}/api/projects/${pid}/events`); }