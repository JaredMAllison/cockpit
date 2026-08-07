// panels/terminal.jsx — Sub-screen: embedded ttyd terminal
// NOT REGISTERED: absent from index.html's script list and referenced nowhere.
// Kept as reference. ttydPort must come from /api/operator — never hardcode a
// port here; a guessed port opens another operator's shell.

function TerminalPanel({ ttydPort }) {
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState(false);

  if (!ttydPort) return null;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a0e0c' }}>
      <iframe
        src={`http://localhost:${ttydPort}`}
        onLoad={() => setReady(true)}
        onError={() => setError(true)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}

      />
    </div>
  );
}
