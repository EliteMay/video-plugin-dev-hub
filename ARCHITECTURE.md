# Architecture

## Process boundary

```text
Renderer
  │ narrow IPC
Preload
  │
Main Process
  ├ ProjectRegistry
  ├ GitService
  ├ ToolchainService
  ├ BuildService
  ├ DeployService
  ├ RuntimeService
  ├ VerificationService
  ├ HandoffService
  ├ DiagnosticsService
  ├ TrustService
  └ UpdateService
```

The renderer never receives direct Node filesystem, child_process, raw shell or credential access.

## Persistent data

Electron userData stores application-owned state below `hub-data/`.

```text
hub-data/
├ settings.json
├ settings.backup.json
├ projects.json
├ trust.json
├ verification/
├ build-history/
├ install-manifests/
├ screenshots/
├ chatgpt-packs/
└ logs/
```

Plugin source and roadmap remain in their plugin repositories.

## State separation

Repository, build, install, runtime, verification and release states are separate. A successful build cannot silently promote verification or release state.

## Future adapters

Target-specific behavior is isolated behind an AviUtl2 adapter so another video editor can be added later without rewriting Git, evidence and desktop foundation logic.
