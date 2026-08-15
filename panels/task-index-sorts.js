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
