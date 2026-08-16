# TTF Task Index Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cockpit panel that lists vault tasks, sorts them through a declarative registry, and drives the TTF belt to a selected task's balloon — making the Marlin↔TTF binding visible and firm.

**Architecture:** Three repos, strictly sequenced. TTF gets an API-404 guard and a real `GET /api/events/:id` (both are live defects today). Marlin's `webhook.py` gains `GET /api/tasks`, a pure vault read that never talks to TTF. The cockpit panel joins the two client-side on `external_id`, so the task list still renders when TTF is down.

**Tech Stack:** Python 3.12 + stdlib `http.server` (Marlin) · Node/Express + vitest (TTF) · React 18 via CDN + Babel, no build step (cockpit)

**Spec:** No separate spec document. The design was settled in session on 2026-08-15 and is captured in the Design Decisions section below. Operator specified the panel shape directly; the `external_id` discovery replaced the original join design.

---

## Global Constraints

- **Canonical task↔event binding is `external_id`, a vault-relative path** — `"Tasks/move-alexs-tv.md"`. Verified on the live TTF instance: 62 of 152 events carry one. Join on this, **not** on `ttf_id`. A path is human-legible, resolvable without a lookup table, and survives a database rebuild.
- **Marlin never calls TTF.** `webhook.py` stays a pure vault read. All joining happens in the browser.
- **Sorts are a UI registry, not server behaviour.** The endpoint returns raw fields; the panel decides views. Adding a sort must never require a backend change.
- **`ttf_id` is read-only in the vault** (`Marlin/CLAUDE.md` Conventions). This plan reads it and never writes it.
- **Cockpit dev is `:9110` (live tree); prod is `:9100` (baked image).** Editing the tree changes dev immediately and prod not at all. Per `marlin-adr-055`, production images build only from a committed ref — **no prod rebuild is in scope for this plan.**
- **Cockpit has no test harness** (`package.json` declares no `test` script). Cockpit verification is manual against `:9110` with explicit steps. Adding vitest to cockpit is a separate decision and is deliberately not smuggled in here.
- **Prefer real files over mocks.** The existing `tests/test_webhook_api.py` mostly mocks the function under test and asserts the mock; do not copy that pattern. New tests build real frontmatter in `tmp_path`.
- **Branch strategy:** one worktree per repo, off each repo's `main`. Cockpit worktree already exists at `~/git/cockpit/.worktrees/task-index` on `feat/ttf-task-index`.

---

## Design Decisions

Recorded here because there is no separate spec.

**Why the panel exists.** Operator, 2026-08-15: *"I envision a list that selecting moves TTF to that event… The menu would have a few sorts/views pre-established… A hero frame for whatever is 'Now Surfacing'."* Purpose is to root TTF in the vault and create firm contracts — not to replace the TTF view.

**Why this does not violate `marlin-adr-002` (one task at a time).** `marlin-adr-054` scoped ADR-002 to the *push* channel; ambient surfaces may be lists. This panel is ambient. It must therefore never acquire a demand — no prompts, no modal offers — and must be **stably sorted**, because re-ordering content on every poll forces a full re-read per glance, which is an attention demand by other means.

**Why this is not `marlin-adr-057`'s state map.** ADR-057 specs cockpit panel five as a derived state map covering *"the state no census can fix"* — branch state, sync drift, backup age — and explicitly excludes the task census. This is a different panel. They are complementary, not duplicates.

**Two live defects this plan fixes.** Both fail silently:
1. `GET /api/events/:id` returns **HTTP 200 with `text/html`** — `server.js`'s SPA catch-all swallows unmatched API paths. A false 200 is worse than a 404: health checks pass and callers parse a web page. The `/marlin-open` skill's Phase B fallback does exactly this today.
2. `cockpit/hooks/api.js` defines `patchTtfEvent()` calling `PATCH /api/events/:id`, which **404s** — no PATCH route exists. TTF's CORS header advertises `PATCH` in `Access-Control-Allow-Methods`, so the header lies about the surface.

**Why no PATCH is added.** YAGNI. The panel reads and navigates; it does not write to TTF in v1. `PUT /:id` already exists and works. The dead `patchTtfEvent()` is deleted rather than given a backend.

---

## File Structure

| File | Responsibility |
|---|---|
| `the-time-factory/server.js` | Add an API-404 guard before the SPA catch-all |
| `the-time-factory/src/backend/routes/events.js` | Add `GET /:id` |
| `the-time-factory/test/events-integration.test.js` | Extend — route existence and content-type |
| `marlin/webhook.py` | Add `task_row()`, `iter_task_frontmatter()`, `get_all_tasks()`, and the `api/tasks` route branch |
| `marlin/tests/test_task_index_api.py` | New — real-file tests for the three functions |
| `cockpit/hooks/api.js` | Add `fetchAllTasks()`; delete dead `patchTtfEvent()` |
| `cockpit/panels/task-index-sorts.js` | New — pure sort registry, no React |
| `cockpit/panels/task-index.jsx` | New — the panel component |
| `cockpit/app.jsx` | Lift `focusTtfDate` state; wire panel → TTF |
| `cockpit/panels/ttf.jsx` | Accept `focusDate` prop; call existing `ctrl.warpTo()` |
| `cockpit/index.html` | Script tags for the two new files |

---

# Phase 1 — TTF (repo: `~/git/the-time-factory`)

⚠️ **Before starting:** `server.js` has an **uncommitted** change in the main tree (adds `http://localhost:9100 http://localhost:9110` to the CSP `frame-ancestors`). It is unrelated to this work but touches the same file. Create the worktree from `main`, and do not attempt to carry that change across.

### Task 1: API paths 404 instead of returning the SPA

**Files:**
- Modify: `server.js` (immediately before the `app.get('/{*path}')` catch-all, currently line 61)
- Test: `test/events-integration.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: any unmatched `/api/*` request returns HTTP 404 with `Content-Type: application/json` and body `{"error":"Not found"}`

- [ ] **Step 1: Write the failing test**

Append to `test/events-integration.test.js`:

```javascript
describe('API 404 guard', () => {
  it('returns JSON 404 for an unmatched /api path, not the SPA', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error).toBe('Not found');
  });

  it('does not swallow non-API paths', async () => {
    const res = await request(app).get('/some/spa/route');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });
});
```

If `request` and `app` are not already imported in that file, match the imports the existing tests in it use rather than inventing new ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- events-integration`
Expected: FAIL — the first test receives status 200 and `text/html`, because the SPA catch-all is currently handling it.

- [ ] **Step 3: Write minimal implementation**

In `server.js`, insert immediately **before** the existing `app.get('/{*path}', ...)` catch-all:

```javascript
// Unmatched API paths must 404 as JSON. Without this the SPA catch-all below
// returns index.html with HTTP 200 for any bad /api/* path — a false success
// that health checks pass and callers parse as data.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- events-integration`
Expected: PASS, both cases. Then run the full suite: `npm test` — expected: all pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add server.js test/events-integration.test.js
git commit -m "fix(api): unmatched /api paths 404 as JSON instead of returning the SPA

The SPA catch-all handled any unmatched path including /api/*, so a bad API
path returned index.html with HTTP 200. A false 200 is worse than a 404:
health checks pass and callers parse a web page as data. The /marlin-open
skill's Phase B fallback hits this today."
```

---

### Task 2: `GET /api/events/:id`

**Files:**
- Modify: `src/backend/routes/events.js`
- Test: `test/events-integration.test.js`

**Interfaces:**
- Consumes: Task 1's guard (so a missing route is now provably a 404)
- Produces: `GET /api/events/:id` → 200 with the single event object; 404 JSON when no event has that id

- [ ] **Step 1: Write the failing test**

```javascript
describe('GET /api/events/:id', () => {
  it('returns the single event as JSON', async () => {
    const created = await request(app).post('/api/events').send({
      title: 'Fetch me by id', date: '2026-08-15',
    });
    const id = created.body.id;
    const res = await request(app).get(`/api/events/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe('Fetch me by id');
  });

  it('404s for an unknown id', async () => {
    const res = await request(app).get('/api/events/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- events-integration`
Expected: FAIL — first case gets 404 from Task 1's guard (previously it was a misleading 200).

- [ ] **Step 3: Write minimal implementation**

In `src/backend/routes/events.js`, add above `router.put('/:id', ...)` (currently line 147).

Data access is `better-sqlite3` directly — `db.prepare(...)`, no repository layer. `router.get('/')` returns `SELECT *` rows untransformed, so a single-row select produces an identically shaped object. The `UUID_RE` guard and the `try`/`catch` mirror `router.delete('/:id')` at line 197:

```javascript
// GET /api/events/:id — single event by id
router.get('/:id', (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid event ID format' });
  }
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
```

⚠️ Placement matters: it must come **after** `router.get('/')` so the list route is not shadowed.

Note the id guard changes one test expectation — an unknown *but well-formed* UUID gives 404, while a malformed id gives 400. The test in Step 1 uses a well-formed all-zeros UUID for exactly this reason.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — expected: full suite passes.

- [ ] **Step 5: Verify against the live instance**

```bash
ID=$(curl -s "http://localhost:3000/api/events?from=2026-01-01&to=2026-12-31" \
     | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -i "http://localhost:3000/api/events/$ID" | head -3
```

Expected: `HTTP/1.1 200` and `Content-Type: application/json`. Before this task it was 200 `text/html`.

⚠️ **Use only GET while verifying.** Do not probe with PUT/POST/DELETE against the live instance — TTF holds real calendar data and PUT will mutate `updated_at` even with an empty body.

- [ ] **Step 6: Commit**

```bash
git add src/backend/routes/events.js test/events-integration.test.js
git commit -m "feat(api): add GET /api/events/:id

Two consumers already assumed this route existed: the /marlin-open skill's
Phase B fallback, and any caller resolving a ttf_id. It never did."
```

---

# Phase 2 — Marlin (repo: `~/marlin`)

### Task 3: `task_row()` — pure frontmatter → row transform

**Files:**
- Modify: `webhook.py` (add near `get_today_tasks`, around line 108)
- Test: `marlin/tests/test_task_index_api.py` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `task_row(path: Path, fm: dict) -> dict` with exactly these keys:
  `slug, title, status, project, goal_date, available_from, context, duration, duration_minutes, start_time, end_time, ttf_id, recurrence, external_id`

- [ ] **Step 1: Write the failing test**

Create `tests/test_task_index_api.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import webhook


def test_task_row_extracts_and_normalises():
    fm = {
        "title": "PCP follow-up",
        "status": "queued",
        "project": '"[[health-vault]]"',
        "goal_date": "2026-08-21",
        "context": "business-hours",
        "duration": "medium",
        "ttf_id": "abc-123",
    }
    row = webhook.task_row(Path("/x/Tasks/pcp-followup-liu.md"), fm)

    assert row["slug"] == "pcp-followup-liu"
    assert row["title"] == "PCP follow-up"
    assert row["project"] == "health-vault"       # brackets and quotes stripped
    assert row["context"] == ["business-hours"]   # always a list
    assert row["external_id"] == "Tasks/pcp-followup-liu.md"
    assert row["available_from"] is None          # absent keys are None, not missing


def test_task_row_handles_list_context_and_missing_project():
    fm = {"title": "Loose task", "status": "active", "context": ["computer", "any-time"]}
    row = webhook.task_row(Path("/x/Tasks/loose.md"), fm)

    assert row["project"] == ""
    assert row["context"] == ["computer", "any-time"]
    assert row["ttf_id"] is None


def test_task_row_strips_inline_comment_from_project():
    # An agent once wrote prose into this field; the value must still resolve.
    fm = {"title": "T", "project": '"[[marlin]]"   # note that Projects/marlin.md does not exist'}
    row = webhook.task_row(Path("/x/Tasks/t.md"), fm)
    assert row["project"] == "marlin"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/marlin && python3 -m pytest tests/test_task_index_api.py -v`
Expected: FAIL — `AttributeError: module 'webhook' has no attribute 'task_row'`

- [ ] **Step 3: Write minimal implementation**

Add to `webhook.py`:

```python
def _clean_project(raw) -> str:
    """Reduce a project: value to a bare stem.

    Tolerates every form found in the vault: quoted, wikilinked, path-prefixed,
    and one case where an agent appended a prose comment to the value.
    """
    v = str(raw or "").strip()
    if "#" in v:
        v = v.split("#", 1)[0].strip()
    v = v.strip("'\"").strip()
    if v.startswith("[[") and v.endswith("]]"):
        v = v[2:-2].strip()
    v = v.split("|")[0]
    if v.startswith("Projects/"):
        v = v[len("Projects/"):]
    if v.endswith(".md"):
        v = v[:-3]
    return v.strip()


def _as_list(raw) -> list[str]:
    """context: may be a scalar or a list in the vault. Always return a list."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    return [p.strip() for p in str(raw).split(",") if p.strip()]


def task_row(path: Path, fm: dict) -> dict:
    """Pure transform: one task's frontmatter -> one API row. No I/O."""
    def s(key):
        v = fm.get(key)
        return None if v is None else str(v)

    return {
        "slug":             path.stem,
        "title":            str(fm.get("title") or path.stem),
        "status":           str(fm.get("status") or ""),
        "project":          _clean_project(fm.get("project")),
        "goal_date":        s("goal_date"),
        "available_from":   s("available_from"),
        "context":          _as_list(fm.get("context")),
        "duration":         str(fm.get("duration") or ""),
        "duration_minutes": fm.get("duration_minutes"),
        "start_time":       s("start_time"),
        "end_time":         s("end_time"),
        "ttf_id":           s("ttf_id"),
        "recurrence":       s("recurrence"),
        "external_id":      f"Tasks/{path.name}",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_task_index_api.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add webhook.py tests/test_task_index_api.py
git commit -m "feat(api): task_row() pure frontmatter-to-row transform

Separated from I/O so it is testable without a vault. Tolerates every
project: form present in the real vault, including a value with an inline
prose comment an agent wrote into it."
```

---

### Task 4: `iter_task_frontmatter()` and `get_all_tasks()` with an mtime cache

**Files:**
- Modify: `webhook.py`
- Test: `marlin/tests/test_task_index_api.py`

**Interfaces:**
- Consumes: `task_row(path, fm)` from Task 3
- Produces:
  - `iter_task_frontmatter(root: Path)` → yields `(Path, dict)` for every `*.md` whose frontmatter parses
  - `get_all_tasks(root: Path | None = None, include_closed: bool = False) -> list[dict]` → list of `task_row` dicts, sorted by `slug`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_task_index_api.py`:

```python
def _write_task(dirpath: Path, slug: str, **fields) -> Path:
    lines = ["---", "type: task"]
    for k, v in fields.items():
        lines.append(f"{k}: {v}")
    lines += ["---", "", "body text", ""]
    p = dirpath / f"{slug}.md"
    p.write_text("\n".join(lines), encoding="utf-8")
    return p


def test_get_all_tasks_excludes_closed_by_default(tmp_path):
    _write_task(tmp_path, "open-one", title="Open one", status="queued")
    _write_task(tmp_path, "closed-one", title="Closed one", status="done")
    _write_task(tmp_path, "killed-one", title="Killed one", status="cancelled")

    rows = webhook.get_all_tasks(tmp_path)
    slugs = [r["slug"] for r in rows]

    assert slugs == ["open-one"]


def test_get_all_tasks_can_include_closed(tmp_path):
    _write_task(tmp_path, "a-open", title="A", status="queued")
    _write_task(tmp_path, "b-done", title="B", status="done")

    rows = webhook.get_all_tasks(tmp_path, include_closed=True)

    assert [r["slug"] for r in rows] == ["a-open", "b-done"]


def test_get_all_tasks_skips_files_without_frontmatter(tmp_path):
    _write_task(tmp_path, "good", title="Good", status="queued")
    (tmp_path / "no-frontmatter.md").write_text("just a body\n", encoding="utf-8")

    rows = webhook.get_all_tasks(tmp_path)

    assert [r["slug"] for r in rows] == ["good"]


def test_get_all_tasks_is_sorted_stably(tmp_path):
    for slug in ["zebra", "alpha", "mango"]:
        _write_task(tmp_path, slug, title=slug, status="queued")

    rows = webhook.get_all_tasks(tmp_path)

    assert [r["slug"] for r in rows] == ["alpha", "mango", "zebra"]
```

Stable ordering is not cosmetic — `marlin-adr-054` requires ambient surfaces to be stable, because re-sorting on every poll forces a full re-read per glance.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_task_index_api.py -v`
Expected: FAIL — `module 'webhook' has no attribute 'get_all_tasks'`

- [ ] **Step 3: Write minimal implementation**

```python
CLOSED_STATUSES = {"done", "cancelled"}

_task_cache: dict = {"stamp": None, "rows": []}


def iter_task_frontmatter(root: Path):
    """I/O only: yield (path, frontmatter) for each parseable task file."""
    for path in sorted(root.glob("*.md")):
        fm = read_frontmatter(path)
        if isinstance(fm, dict) and fm:
            yield path, fm


def _dir_stamp(root: Path) -> tuple:
    """Cheap change signature: file count plus newest mtime."""
    mtimes = [e.stat().st_mtime for e in os.scandir(root) if e.name.endswith(".md")]
    return (len(mtimes), max(mtimes) if mtimes else 0)


def get_all_tasks(root: Path | None = None, include_closed: bool = False) -> list[dict]:
    """All tasks as API rows, sorted by slug. Cached on directory mtime.

    Cached because the cockpit polls every 30s and re-parsing ~250 YAML blocks
    each time is real CPU on the host that runs the whole stack. The cache
    invalidates the moment any task file changes.
    """
    root = root or VAULT
    use_cache = root == VAULT and not include_closed
    if use_cache:
        stamp = _dir_stamp(root)
        if _task_cache["stamp"] == stamp:
            return _task_cache["rows"]

    rows = []
    for path, fm in iter_task_frontmatter(root):
        status = str(fm.get("status") or "")
        if not include_closed and status in CLOSED_STATUSES:
            continue
        rows.append(task_row(path, fm))
    rows.sort(key=lambda r: r["slug"])

    if use_cache:
        _task_cache["stamp"] = stamp
        _task_cache["rows"] = rows
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_task_index_api.py -v`
Expected: 7 passed.

- [ ] **Step 5: Verify the cache actually invalidates**

Append and run:

```python
def test_cache_invalidates_when_a_file_changes(tmp_path, monkeypatch):
    monkeypatch.setattr(webhook, "VAULT", tmp_path)
    webhook._task_cache["stamp"] = None

    _write_task(tmp_path, "first", title="First", status="queued")
    assert len(webhook.get_all_tasks()) == 1

    _write_task(tmp_path, "second", title="Second", status="queued")
    assert len(webhook.get_all_tasks()) == 2
```

Run: `python3 -m pytest tests/test_task_index_api.py -v`
Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add webhook.py tests/test_task_index_api.py
git commit -m "feat(api): get_all_tasks() with mtime-keyed cache

Split into I/O (iter_task_frontmatter) and assembly (get_all_tasks) so each
is testable alone. Cached because the cockpit polls every 30s; re-parsing
~250 YAML blocks per poll is real CPU on the host running the whole stack.
Stable slug ordering is required by marlin-adr-054 for ambient surfaces."
```

---

### Task 5: Wire the `api/tasks` route

**Files:**
- Modify: `webhook.py` — `do_GET`, immediately after the existing `api/adls` branch (currently ~line 458)
- Test: `marlin/tests/test_task_index_api.py`

**Interfaces:**
- Consumes: `get_all_tasks()` from Task 4
- Produces: `GET /api/tasks` → `{"generated": iso8601, "count": int, "tasks": [row, …]}`

- [ ] **Step 1: Write the failing test**

```python
def test_api_tasks_payload_shape(tmp_path, monkeypatch):
    monkeypatch.setattr(webhook, "VAULT", tmp_path)
    webhook._task_cache["stamp"] = None
    _write_task(tmp_path, "only-task", title="Only", status="queued", goal_date="2026-08-21")

    rows = webhook.get_all_tasks()
    payload = {"generated": "x", "count": len(rows), "tasks": rows}

    assert payload["count"] == 1
    task = payload["tasks"][0]
    for key in ("slug", "title", "status", "project", "goal_date",
                "available_from", "context", "duration", "duration_minutes",
                "start_time", "end_time", "ttf_id", "recurrence", "external_id"):
        assert key in task, f"missing key: {key}"
    assert task["external_id"] == "Tasks/only-task.md"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_task_index_api.py::test_api_tasks_payload_shape -v`
Expected: PASS only once Task 4 is in place — if it fails, Task 4 is incomplete. This test guards the contract the cockpit depends on.

- [ ] **Step 3: Add the route**

In `do_GET`, after the `api/adls` branch:

```python
        # ── API: all tasks (cockpit task-index panel) ──
        if action == "api/tasks":
            rows = get_all_tasks()
            self._json({
                "generated": datetime.now().isoformat(timespec="seconds"),
                "count": len(rows),
                "tasks": rows,
            })
            return
```

- [ ] **Step 4: Restart and verify against the real vault**

```bash
systemctl --user restart marlin-webhook.service
sleep 2
curl -s http://localhost:7832/api/tasks | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('count:', d['count'])
print('with ttf_id:', sum(1 for t in d['tasks'] if t['ttf_id']))
print('sample:', json.dumps(d['tasks'][0], indent=2))
"
```

Expected: `count` around 188, `with ttf_id` around 61. Both numbers were witnessed on 2026-08-15; a large divergence means something is wrong.

- [ ] **Step 5: Commit**

```bash
git add webhook.py tests/test_task_index_api.py
git commit -m "feat(api): GET /api/tasks serving all open tasks with frontmatter

Nothing previously served the full task list; /tasks/today was the only
task endpoint. Returns external_id (a vault path) so consumers can join
against TTF without depending on ttf_id."
```

---

# Phase 3 — Cockpit (repo: `~/git/cockpit`, worktree `.worktrees/task-index`)

⚠️ No test harness exists here. Every task below ends with **manual verification against `:9110`**, which serves the live tree.

### Task 6: API client — add `fetchAllTasks`, remove dead `patchTtfEvent`

**Files:**
- Modify: `hooks/api.js`

**Interfaces:**
- Produces: `fetchAllTasks()` → Promise of `{generated, count, tasks[]}`

- [ ] **Step 1: Confirm `patchTtfEvent` really is unused**

```bash
cd ~/git/cockpit/.worktrees/task-index
grep -rn "patchTtfEvent" --include=*.js --include=*.jsx . | grep -v node_modules
```

Expected: exactly one hit — its definition in `hooks/api.js`. **If any caller exists, stop and do not delete it**; report instead, because removing it would break a live surface.

- [ ] **Step 2: Add the fetcher and delete the dead function**

In `hooks/api.js`, add beside the other Marlin fetchers:

```javascript
function fetchAllTasks() { return _fetch(`${HOSTS.marlin}/api/tasks`); }
```

Then delete the whole `patchTtfEvent` function. TTF has no PATCH route — it 404s — and the panel does not write to TTF.

- [ ] **Step 3: Verify from the browser console at `http://localhost:9110`**

```javascript
fetchAllTasks().then(d => console.log(d.count, d.tasks[0]));
```

Expected: a count near 188 and a row object with the 14 keys.

- [ ] **Step 4: Commit**

```bash
git add hooks/api.js
git commit -m "feat(api): add fetchAllTasks; drop dead patchTtfEvent

patchTtfEvent called PATCH /api/events/:id, which does not exist and 404s.
TTF's CORS header advertises PATCH, which is what made it look real."
```

---

### Task 7: Sort registry (pure, no React)

**Files:**
- Create: `panels/task-index-sorts.js`
- Modify: `index.html` — add the script tag before the panels

**Interfaces:**
- Produces: `window.TASK_SORTS` — an array of `{id, label, group(task) -> string, sort(a, b) -> number}`

- [ ] **Step 1: Create the registry**

```javascript
// panels/task-index-sorts.js — declarative sort/view registry.
// Adding a view is one object here. No backend change is ever required.

const _byString = key => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''));

// Undated tasks sort last rather than first — an empty goal_date is "no
// deadline", not "overdue since the epoch".
function _byDue(a, b) {
  const A = a.goal_date || '9999-99-99';
  const B = b.goal_date || '9999-99-99';
  return A === B ? _byString('title')(a, b) : A.localeCompare(B);
}

const DURATION_RANK = { short: 0, medium: 1, long: 2, '': 3 };

window.TASK_SORTS = [
  {
    id: 'due', label: 'Due',
    group: t => t.goal_date || 'no date',
    sort: _byDue,
  },
  {
    id: 'category', label: 'Category',
    group: t => t.project || '(no project)',
    sort: (a, b) => _byString('project')(a, b) || _byDue(a, b),
  },
  {
    id: 'duration', label: 'Duration',
    group: t => t.duration || '(unset)',
    sort: (a, b) => (DURATION_RANK[a.duration] ?? 3) - (DURATION_RANK[b.duration] ?? 3)
                    || _byDue(a, b),
  },
  {
    id: 'status', label: 'Status',
    group: t => t.status || '(unset)',
    sort: (a, b) => _byString('status')(a, b) || _byDue(a, b),
  },
  {
    id: 'binding', label: 'Binding',
    group: t => t._binding,           // set by the panel's join, see Task 8
    sort: (a, b) => _byString('_binding')(a, b) || _byDue(a, b),
  },
];
```

Every sort falls through to `_byDue` then title, so ordering is **total** — no two renders can disagree. `marlin-adr-054` requires ambient surfaces to be stable.

- [ ] **Step 2: Register the script**

In `index.html`, add before the panel scripts:

```html
<script src="panels/task-index-sorts.js"></script>
```

- [ ] **Step 3: Verify in the browser console at `:9110`**

```javascript
TASK_SORTS.map(s => s.id)   // ["due","category","duration","status","binding"]
```

- [ ] **Step 4: Commit**

```bash
git add panels/task-index-sorts.js index.html
git commit -m "feat(panel): declarative sort registry for the task index

Sorts are a UI concern; the endpoint returns raw fields. Adding a view is
one object. Every comparator falls through to due-date then title so
ordering is total and renders cannot disagree (marlin-adr-054)."
```

---

### Task 8: The panel

**Files:**
- Create: `panels/task-index.jsx`
- Modify: `index.html`

**Interfaces:**
- Consumes: `fetchAllTasks` (Task 6), `window.TASK_SORTS` (Task 7), existing `usePoll`, `fetchState`, `fetchTtfEvents`
- Produces: `<TaskIndexPanel onFocusDate={fn} />` — calls `onFocusDate(isoDateString)` when a row with a date is selected

- [ ] **Step 1: Create the panel**

```jsx
// panels/task-index.jsx — vault task list, TTF index, Now Surfacing hero.
// Ambient surface (marlin-adr-054): shows many rows, demands nothing.

function TaskIndexPanel({ onFocusDate }) {
  const [sortId, setSortId] = React.useState('due');
  const [selected, setSelected] = React.useState(null);

  const { data: taskData, error: taskErr } = usePoll(fetchAllTasks, 30000);
  const { data: stateData }               = usePoll(fetchState, 30000);

  const today = new Date().toISOString().slice(0, 10);
  const ttfFetch = React.useRef(() => fetchTtfEvents('2026-01-01', '2027-12-31'));
  const { data: ttfData, error: ttfErr } = usePoll(() => ttfFetch.current(), 60000);

  // Join on external_id — a vault path, not a uuid. Survives ttf_id loss and
  // needs no lookup table. TTF being down degrades binding to "unknown"
  // rather than failing the whole panel.
  const bound = React.useMemo(() => {
    const set = new Set((ttfData || []).map(e => e.external_id).filter(Boolean));
    return set;
  }, [ttfData]);

  const rows = React.useMemo(() => {
    const sort = (window.TASK_SORTS.find(s => s.id === sortId) || window.TASK_SORTS[0]);
    return (taskData?.tasks || [])
      .map(t => ({
        ...t,
        _binding: ttfErr ? 'unknown'
                : bound.has(t.external_id) ? 'bound'
                : t.ttf_id ? 'orphaned' : 'unbound',
      }))
      .sort(sort.sort);
  }, [taskData, bound, sortId, ttfErr]);

  function pick(t) {
    setSelected(t.slug);
    if (t.goal_date && onFocusDate) onFocusDate(t.goal_date);
  }

  const BIND_MARK = { bound: '⛓', orphaned: '✕', unbound: '○', unknown: '·' };
  const BIND_COLOR = { bound: '#6c9a5a', orphaned: '#c95a52', unbound: '#5a5249', unknown: '#5a5249' };

  return (
    <div style={{ background: '#0e0c0a', color: '#e8e3d8', fontFamily: '"Berkeley Mono","JetBrains Mono",ui-monospace,monospace', fontSize: 11, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1d1a16', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          <E path="panel.taskIndex" fallback="Task Index"/>
        </span>
        <span style={{ fontSize: 10, color: '#5a5249' }}>
          {rows.length}{taskErr ? ' ⚠' : ''}
        </span>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '2px solid #1d1a16', borderLeft: '3px solid #6c9a5a', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#5a5249', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>now surfacing</div>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>{stateData?.last_surfaced_task || '—'}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid #1d1a16', flexShrink: 0, flexWrap: 'wrap' }}>
        {window.TASK_SORTS.map(s => (
          <button key={s.id} onClick={() => setSortId(s.id)}
            style={{ background: s.id === sortId ? '#1d1a16' : 'transparent',
                     color: s.id === sortId ? '#e8e3d8' : '#5a5249',
                     border: '1px solid #1d1a16', padding: '2px 8px', fontSize: 9,
                     textTransform: 'uppercase', letterSpacing: 0.5,
                     cursor: 'pointer', fontFamily: 'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', padding: '4px 16px 12px' }}>
        {rows.map(t => (
          <div key={t.slug} onClick={() => pick(t)}
            style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0',
                     borderBottom: '1px solid #1d1a16', cursor: 'pointer',
                     background: selected === t.slug ? '#1d1a16' : 'transparent' }}>
            <span style={{ color: BIND_COLOR[t._binding], flexShrink: 0, width: 10 }}>{BIND_MARK[t._binding]}</span>
            <span style={{ color: '#9a9286', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            <span style={{ color: '#5a5249', fontSize: 10, flexShrink: 0 }}>{t.goal_date || ''}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: '#5a5249', paddingTop: 8 }}>no tasks</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the script**

In `index.html`, beside the other panels:

```html
<script type="text/babel" src="panels/task-index.jsx"></script>
```

- [ ] **Step 3: Manual verification at `:9110`**

Temporarily render it in place of `QuickhacksPanel` in `app.jsx` and confirm all of:
- the list populates, roughly 188 rows
- each sort button re-orders and the order is stable across two 30-second polls
- the Now Surfacing hero matches `curl -s localhost:7832/api/state`
- roughly 61 rows show `⛓`
- **stop TTF** (`systemctl --user stop the-time-factory`) and confirm the list still renders with every row showing `·`, then restart it

That last check is the point of the client-side join. If the panel goes blank, the join is wrong.

- [ ] **Step 4: Commit**

```bash
git add panels/task-index.jsx index.html
git commit -m "feat(panel): task index with binding state and Now Surfacing hero

Joins tasks to TTF events client-side on external_id (a vault path), so a
TTF outage degrades binding to unknown instead of emptying the panel."
```

---

### Task 9: Wire selection to the TTF belt

**Files:**
- Modify: `app.jsx` — sub-screen 2 composition and root state
- Modify: `panels/ttf.jsx` — accept `focusDate`, call the existing `ctrl.warpTo()`

**Interfaces:**
- Consumes: `TaskIndexPanel`'s `onFocusDate(iso)`; `useTtfBeltController`'s existing `warpTo(offset)` (`hooks/ttf-belt-controller.jsx:61`)
- Produces: selecting a dated row moves the TTF belt to that day

- [ ] **Step 1: Accept the prop in `ttf.jsx`**

Inside `TtfPanel`, after `const ctrl = useTtfBeltController(...)`:

```jsx
  // Drive the belt from outside. warpTo has existed since the belt controller
  // was written and had no caller until now.
  React.useEffect(() => {
    if (!props.focusDate) return;
    const target = H.parseDate(props.focusDate);
    const base   = H.parseDate(today);
    const offset = Math.round((target - base) / 86400000);
    ctrl.warpTo(offset);
  }, [props.focusDate]);
```

- [ ] **Step 2: Lift the state in `app.jsx`**

Add beside the other root state (near line 48):

```jsx
  const [focusTtfDate, setFocusTtfDate] = React.useState(null);
```

Then change sub-screen 2 so the index sits in the right rail:

```jsx
    <div style={{ width: 300, flexShrink: 0 }}>
      <TaskIndexPanel onFocusDate={(d) => { setFocusTtfDate(d); setActive('map'); }} />
    </div>
```

and pass the prop to the TTF panel on that screen:

```jsx
    <TtfPanel focusDate={focusTtfDate} />
```

This mirrors the proven `onCiteFile` → `arielFile` → `highlightedFile` wire already in `app.jsx:40`.

- [ ] **Step 3: Manual verification at `:9110`**

- press `2` for the Map sub-screen
- click a task dated within the belt's `-3`/`+10` window → the belt animates to that day
- click a task dated outside that window → **expected: nothing visible happens.** The window is hardcoded at `ttf.jsx:34-35`. This is a known limitation, not a bug in this task.
- click a task with no `goal_date` → nothing happens, by design

- [ ] **Step 4: Commit**

```bash
git add app.jsx panels/ttf.jsx
git commit -m "feat(panel): selecting a task warps the TTF belt to its date

warpTo() has existed at ttf-belt-controller.jsx:61 since the belt was built
and never had a caller. Wired via the same lift-to-app pattern already used
for Ariel's cite-file into the vault panel."
```

---

## Known limitations, deliberately not fixed here

- **The TTF belt window is hardcoded `-3`/`+10` days** (`ttf.jsx:34-35`). Selecting a task outside it silently does nothing. Widening the window changes fetch volume and belt rendering, and belongs in its own change.
- **TTF's `category` field remains freeform** — 38 distinct values across 152 events, with case-collision pairs and one event whose category is raw leaked frontmatter (`goal_date: 2026-07-30`) from `/ttf-push`. The vault side was normalised on 2026-08-15; the TTF side was not. Out of scope; needs its own ADR on taxonomy authority.
- **Prod (`:9100`) is not rebuilt.** Everything here verifies against dev only. Per `marlin-adr-055` a prod image builds only from a committed ref, and that is a separate deliberate act.
- **No cockpit test harness.** Phase 3 is manually verified. Adding vitest is a real improvement and a separate decision.
- **`GET /api/events` already supports `?source=` and `?modified_since=`** (`events.js:60-76`) and this plan uses neither. The panel fetches a wide date range and filters client-side. If the event count grows, `?source=marlin` narrows the fetch and `?modified_since=` enables incremental polling — both already implemented, both currently unused by any consumer. Worth reaching for before optimising anything else.

## Verification — end to end

After all nine tasks:

```bash
# 1. TTF serves a single event as JSON, and bad API paths 404
ID=$(curl -s "http://localhost:3000/api/events?from=2026-01-01&to=2026-12-31" \
     | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -o /dev/null -w "single event: %{http_code} %{content_type}\n" "http://localhost:3000/api/events/$ID"
curl -s -o /dev/null -w "bad api path: %{http_code}\n" "http://localhost:3000/api/nope"

# 2. Marlin serves the full task list
curl -s http://localhost:7832/api/tasks | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('tasks:', d['count'], '| bound:', sum(1 for t in d['tasks'] if t['ttf_id']))"

# 3. Panel — open http://localhost:9110, press 2, click a dated task,
#    confirm the belt moves.
```

Expected: `200 application/json`, `404`, roughly 188 tasks and 61 bound, and a belt that moves.
