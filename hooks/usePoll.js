// hooks/usePoll.js — polling hook (plain JS, no JSX required)
// Usage: const { data, error, loading } = usePoll(fetchFn, intervalMs)
// - Calls fetchFn immediately on mount
// - Re-calls every intervalMs milliseconds
// - On error: keeps last good data, sets error field
// - Cleans up interval on unmount

function usePoll(fetchFn, intervalMs) {
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
  }, [intervalMs]);  // fetchFn excluded — callers must pass stable references

  return state;
}
