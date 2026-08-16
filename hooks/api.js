// hooks/api.js — fetch wrappers, one function per endpoint
// HOSTS — update these if services run on different ports or hosts.

const HOSTS = {
  marlin:   'http://localhost:7832',
  projects: 'http://localhost:7833',
  // :3000 is the canonical TTF — _ttf.md declares it and /ttf-push writes
  // there, so every ttf_id in the vault refers to this instance's ids.
  // :8000 and :8501 are separate, divergent databases (witnessed 2026-08-15).
  ttf:      'http://localhost:3000',
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
function fetchAllTasks() { return _fetch(`${HOSTS.marlin}/api/tasks`); }
function markAdlDone(title) {
  return fetch(`${HOSTS.marlin}/done?task=${encodeURIComponent(title)}`, { redirect: 'manual' }).catch(() => {});
}
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

// InkBlotter write API — goes to cockpit server (port 9100)
function writeVaultFile(path, content) {
  return fetch(`/api/vault/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  }).then(r => r.json());
}
function appendInbox(text) {
  return fetch(`/api/vault/append-inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).then(r => r.json());
}