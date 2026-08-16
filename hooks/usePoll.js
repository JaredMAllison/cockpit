// hooks/usePoll.js — polling hook (plain JS, no JSX required)
// Usage: const { data, error, loading } = usePoll(fetchFn, intervalMs, deps?)
// - Calls fetchFn immediately on mount
// - Re-calls every intervalMs milliseconds
// - On error: keeps last good data, sets error field
// - Cleans up interval on unmount
//
// deps (optional) — extra values that restart the poll and fire an immediate
// fetch when they change. For callers whose fetchFn closes over a changing
// parameter (e.g. a moving date window), reassigning a fetch ref is not
// enough: fetchFn identity is deliberately ignored, so without deps the new
// parameter would not take effect until the next interval tick.
// Keep its LENGTH constant across renders at a given call site, as React
// requires of any dependency list. Omitting it preserves the original
// behaviour exactly — [intervalMs, ...[]] is [intervalMs].

function usePoll(fetchFn, intervalMs, deps = []) {
  const [state, setState] = React.useState({ data: null, error: null, loading: true });

  React.useEffect(() => {
    let mounted = true;
    const run = () =>
      fetchFn()
        .then(data => { if (mounted) setState({ data, error: null, loading: false }); })
        .catch(error => { if (mounted) setState(prev => ({ ...prev, error, loading: false })); });

    run();
    const id = setInterval(run, intervalMs);
    return () => { mounted = false; clearInterval(id); };
  }, [intervalMs, ...deps]);  // fetchFn excluded — callers must pass stable references

  return state;
}
