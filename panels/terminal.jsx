// panels/terminal.jsx — Sub-screen: embedded ttyd terminal
// Connects to user ttyd service on port 7682 via iframe.

function TerminalPanel() {
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState(false);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a0e0c' }}>
      <iframe
        src="http://localhost:7682"
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
