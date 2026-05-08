#!/usr/bin/env bash
# build-jsx.sh — Compile all .jsx files to .js using Babel.
# Run from cockpit repo root before building the USB package.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${1:-compiled}"
mkdir -p "$OUT"/{panels,hooks}

echo "Compiling JSX → JS..."

# Hooks (plain JS — just copy)
for f in hooks/*.js; do
  cp "$f" "$OUT/hooks/"
done

# JSX files — Babel compile
for f in app.jsx editable.jsx subscreen-transition.jsx zelda-frame.jsx; do
  npx babel --presets=@babel/preset-react "$f" > "$OUT/${f%.jsx}.js"
  echo "  $f → $OUT/${f%.jsx}.js"
done

for f in panels/*.jsx; do
  name=$(basename "$f")
  npx babel --presets=@babel/preset-react "$f" > "$OUT/panels/${name%.jsx}.js"
  echo "  $f → $OUT/panels/${name%.jsx}.js"
done

# Generate production index.html (no CDN Babel, loads compiled .js)
echo "Generating $OUT/index.html..."
python3 -c "
import re
with open('$ROOT/index.html') as f:
    html = f.read()

# Strip Babel CDN script
html = re.sub(
    r'<script src=\"https://unpkg\.com/@babel/standalone/babel\.min\.js\".*?</script>',
    '',
    html
)

# Change type=\"text/babel\" to regular script, .jsx → .js
html = html.replace('type=\"text/babel\"', '')
html = html.replace('.jsx\"', '.js\"')

with open('$OUT/index.html', 'w') as f:
    f.write(html)
"

echo "Done. Compiled output in: $OUT/"
