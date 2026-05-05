# Cognitive Prosthetic Cockpit

Unified HUD for the Marlin/LMF stack. OoT Zelda aesthetic. Three sub-screens. No build step.

Served by `cockpit.py` (Python `http.server` static file server) at port 9100. All UI is React via Babel CDN — edit and reload, no compilation.

---

## Sub-screens

| Sub-screen | Key | Contents |
|---|---|---|
| **Quest Status** | `1` | Active projects (left) + Marlin task/mode/ADLs (right) |
| **Map** | `2` | TTF calendar week (left) + Quickhacks panel (right) |
| **Items** | `3` | Vault file browser (left) + Ariel conversation (right) |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `1` / `2` / `3` | Jump to sub-screen |
| `[` / `ArrowLeft` | Previous sub-screen |
| `]` / `ArrowRight` | Next sub-screen |
| `e` | Toggle label edit mode |
| `Escape` | Exit edit mode |

---

## Architecture

React 18 via unpkg CDN + Babel standalone — no build step, no node_modules. All components are `.jsx` files loaded in dependency order by `index.html`. React and ReactDOM are globals.

| File | Role |
|---|---|
| `cockpit.py` | Static file server — path traversal protected, `.jsx` served as `text/javascript` |
| `index.html` | Shell — loads CDN scripts, hooks (plain JS), then all JSX components, then mounts `<App />` |
| `app.jsx` | Root — sub-screen state, keyboard nav, edit mode, ariel cross-panel cite |
| `zelda-frame.jsx` | OoT chrome — top nav bar, shoulder hints, bottom status strip |
| `subscreen-transition.jsx` | 220ms cross-fade + 12px slide between sub-screens |
| `editable.jsx` | Label editing system — `LabelsProvider`, `E` component, template store in localStorage |
| `hooks/usePoll.js` | Generic polling hook — fetches on mount + interval, preserves last-good data on error |
| `hooks/api.js` | Fetch wrappers for all backend endpoints — **only file that differs between instances** |
| `panels/projects.jsx` | Projects sub-screen panel |
| `panels/marlin.jsx` | Marlin state/tasks/ADL panel |
| `panels/ttf.jsx` | TTF calendar week panel |
| `panels/quickhacks.jsx` | Mode switcher + inbox capture panel |
| `panels/vault.jsx` | Vault file browser + on-demand preview |
| `panels/ariel.jsx` | Ariel conversation panel (stubbed until orchestrator API confirmed) |

---

## Running

```bash
# Direct
python3 cockpit.py

# Via systemd user service (auto-starts on login)
systemctl --user enable --now cockpit.service
```

Cockpit serves at `http://0.0.0.0:9100`. Port configurable via `COCKPIT_PORT` env var.

---

## Deploying a new instance (e.g. Jason)

`setup_jason_instance.sh` in the marlin repo handles this:

```bash
sudo bash ~/marlin/setup_jason_instance.sh jason
```

It copies this repo to `/home/jason/git/cockpit/` and overwrites `hooks/api.js` with Jason-specific `HOSTS` pointing to his port-offset services (`:7842`/`:7843`/`:9101`).

---

## Customizing labels

Press `e` to enter edit mode. Click any label text to rename it. Changes persist in `localStorage` under the key `cockpit_labels`. Press `Escape` to cancel an edit, `Enter` to confirm.

Templates (preset label sets) are stored alongside user saves. Three built-in templates ship: **OoT Faithful**, **Cockpit Default**, **Plain English**.

---

## Backend APIs consumed

| Endpoint | Panel |
|---|---|
| `http://localhost:7832/api/state` | Marlin, ZeldaFrame (mode tint) |
| `http://localhost:7832/api/adls` | Marlin |
| `http://localhost:7832/tasks/today` | Marlin |
| `http://localhost:7833/api/projects` | Projects |
| `http://localhost:7833/api/vault/tree` | Vault |
| `http://localhost:7833/api/vault/file?path=...` | Vault |
| `http://localhost:3000/api/events?from=...&to=...` | TTF |
| `http://localhost:8742` | Ariel (stubbed) |

All ports configurable in `hooks/api.js` — change `HOSTS` to match your deployment.
