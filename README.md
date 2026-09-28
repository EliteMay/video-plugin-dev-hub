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

## 新しいPluginを作る

左メニューの **「新規作成」** から、Plugin名・Repository名・種類・保存先を指定して新しいProjectを作成できます。

HubはGitHub CLIの認証を利用し、Foundation取得、初期Roadmap / `plugin-project.json` 生成、GitHub Repository作成、初回Push、Hub登録までまとめて行います。GitHubのTokenをHub自身へ入力・保存する必要はありません。

## Repositories

- Hub: `EliteMay/video-plugin-dev-hub`
- Shared starter/foundation: `EliteMay/aviutl-plugin-foundation`
- Plugin source: one repository per plugin

## Download

通常利用では **GitHub Releases の Latest から Setup.exe をダウンロード**します。

- Actions の Artifact を開く必要はありません。
- ZIP 展開も不要です。
- Setup.exe を実行してインストールします。
- Hub 本体の更新も GitHub Releases を基準にします。

Latest Release:
https://github.com/EliteMay/video-plugin-dev-hub/releases/latest

## Development

```powershell
npm install
npm test
npm run dev
```

ローカルでWindows installerを作る場合:

```powershell
npm run build:win
```

See `REQUIREMENTS.md`, `ARCHITECTURE.md`, `PROJECT_RULES.md` and `ROADMAP.md`.
