# Architecture

## Process boundary

```text
Renderer
  │ narrow IPC + sender / payload validation
Preload
  │ contextBridge capability surface
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
├ diagnostics/
└ logs/
```

Plugin source and roadmap remain in their plugin repositories.

## State separation

Repository, build, install, runtime, verification and release states are separate. A successful build cannot silently promote verification or release state.

## Future adapters

Target-specific behavior is isolated behind an AviUtl2 adapter so another video editor can be added later without rewriting Git, evidence and desktop foundation logic.


## Desktop security boundary

The BrowserWindow uses context isolation, sandboxing and no Node integration. Privileged IPC is accepted only from the current application renderer, unexpected navigation/new windows are denied, and runtime permission requests default to deny. The renderer receives only explicit preload capabilities.
