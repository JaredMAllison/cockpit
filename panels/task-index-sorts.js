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

// Severity, worst first. This view exists to surface rot, so alphabetical
// ordering was actively wrong — it opened on `bound` and buried `orphaned`
// in the middle of the list.
//
//   orphaned  claims a link nothing answers to. Actively false data.
//   partial   half-formed; one side lost its reference.
//   unknown   TTF could not be reached, so the row is unresolved, not sound.
//             Above `bound` because an unverified claim is not a verified one.
//   bound     healthy and participating.
//   unbound   never entered TTF. The silent majority (149 of 181), and not a
//             defect — last, so it cannot bury anything that is.
const BINDING_RANK = { orphaned: 0, partial: 1, unknown: 2, bound: 3, unbound: 4 };

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
    sort: (a, b) => (BINDING_RANK[a._binding] ?? 5) - (BINDING_RANK[b._binding] ?? 5)
                    || _byDue(a, b),
  },
];
