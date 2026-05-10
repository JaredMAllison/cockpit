# Changelog

## 2026-05-08 — InkBlotter + deployment polish

- InkBlotter panel: multi-tool creative surface (sketch, notes, docs, diagrams) with vault write API
- TTF panel: improved event display and interaction
- Generic PII-safe system prompt in ai-chat panel
- USB deployment pipeline: `build-jsx.sh` compiles JSX via Babel for prod, `init.py` wizard added
- Cross-platform bootstrap: RAM/disk preflight, `download-deps.bat` for Windows
- Corner flourish alignment fix (BUG-001b)

## 2026-05-05 — Genuine Ariel integration

- Ariel chat panel wired to real POST /chat endpoint with local turn history
- File citations from orchestrator `files_read` tracking — click switches to Items subscreen
- Activity indicator with client-side elapsed timer
- ThreadedHTTPServer for non-blocking health checks during inference
- Port normalized to 8742; stale worktree processes cleaned up

## 2026-05-03 — Vault browser + Quickhacks

- Vault file tree panel with on-demand file preview
- Quickhacks panel: mode switcher + inbox capture
- Arrow key sub-screen navigation
- Edit mode for label customization with localStorage persistence

## 2026-05-01 — Initial release

- Three-panel layout: Quest Status, Map, Items
- Keyboard nav (1/2/3, [, ])
- Zelda OoT chrome (top bar, shoulder buttons, bottom strip)
- 220ms cross-fade transition between sub-screens
- Marlin state/tasks/ADL integration
- TTF calendar week view (iframe)
- Project dashboard panel
