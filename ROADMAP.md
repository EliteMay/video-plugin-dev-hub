# Roadmap

## Phase 1 — Electron Desktop Foundation

- [x] Electron application shell
- [x] Dark UI
- [x] Settings schema and atomic backup
- [x] Window state persistence
- [x] Single instance behavior
- [x] Bounded logs
- [x] Diagnostics surface
- [x] Renderer recovery
- [x] Offline/online indicator
- [x] Stable updater foundation
- [x] Explicit update download / restart-install flow
- [x] Settings screen and startup update preference
- [x] One-click diagnostics export / bounded log controls
- [x] IPC sender validation / CSP / navigation and permission hardening
- [x] Renderer recovery reload action
- [x] Windows installer CI validation
- [ ] Windows real-machine verification

## Phase 2 — Projects / Git

- [x] Project registry
- [x] Repository validation
- [x] Clone and safe sync
- [x] Local change explanation and changed-file preview
- [x] GitHub save flow
- [x] Roadmap parser and current task

## Phase 3 — AviUtl2 Environment

- [x] AviUtl2 detection + manual selection
- [x] MSVC / Windows SDK / CMake detection
- [x] Plugin SDK metadata from plugin-project.json
- [x] Compatibility state (AviUtl2 executable version reading remains future refinement)

## Phase 4 — Build

- [x] CMake configure
- [x] Debug / Release build
- [x] Artifact discovery and SHA-256
- [x] Compiler diagnostics
- [x] Build history

## Phase 5 — Test Deploy

- [x] Test environment registry
- [x] Managed install/update/uninstall
- [x] Rollback
- [x] AviUtl2 launch observation

## Phase 6 — Verification / AI handoff

- [x] Step results and memo
- [x] Screenshot evidence
- [x] Version-linked verification
- [x] ChatGPT batch export

## Phase 7 — Foundation / Release

- [x] New plugin wizard
  - [x] GitHub CLI readiness / login guidance
  - [x] Foundation-based project scaffold
  - [x] GitHub Repository create + initial push
  - [x] Automatic Hub registration
  - [x] Empty-state CTA from ChatGPT handoff
- [ ] Foundation update flow
- [ ] .au2pkg.zip packaging
- [ ] CI artifacts
- [ ] Stable release gate
