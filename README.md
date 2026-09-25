# Video Plugin Dev Hub

A Windows Electron workspace for developing AviUtl2 plugins and scripts from one place.

## Goal

Reduce the normal development loop:

```text
GitHub → build tools → AviUtl2 → verification → logs/screenshots → ChatGPT → Git
```

The Hub manages repositories, environment checks, builds, test deployment, verification evidence and release preparation. Each plugin remains in its own repository and is the source of truth for its code and roadmap.

## Initial target

- AviUtl2 native plugins: `.aui2`, `.auo2`, `.auf2`, `.mod2`, `.aux2`
- AviUtl2 scripts
- `.au2pkg.zip` packaging
- Windows x64

## Safety principles

- No automatic `reset`, `clean`, `rebase` or force push
- No arbitrary shell API exposed to the renderer
- Untrusted repositories cannot build, run or install
- Development artifacts go to an isolated test environment by default
- The Hub only removes files it owns through an install manifest
- Build success and real AviUtl2 verification are separate states
- Dark UI is the default

## Repositories

- Hub: `EliteMay/video-plugin-dev-hub`
- Shared starter/foundation: `EliteMay/aviutl-plugin-foundation`
- Plugin source: one repository per plugin

## Development

```powershell
npm install
npm test
npm run dev
```

Windows installer:

```powershell
npm run build:win
```

See `REQUIREMENTS.md`, `ARCHITECTURE.md`, `PROJECT_RULES.md` and `ROADMAP.md`.
