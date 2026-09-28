# Requirements

## Product goal

Video Plugin Dev Hub manages the AviUtl2 plugin development loop from one Windows desktop app: repository state, toolchain checks, builds, test deployment, manual verification, evidence export and release preparation.

## Source of truth

- Hub behavior: this repository
- Shared starter/foundation: `EliteMay/aviutl-plugin-foundation`
- Plugin code / roadmap / compatibility: each plugin repository

## Required product areas

1. Electron desktop foundation
2. Multi-project registry and safe Git flow
3. AviUtl2 / compiler / CMake / SDK detection
4. Debug and Release build orchestration
5. Isolated AviUtl2 test environments
6. Managed install / uninstall / rollback
7. User verification with screenshots and version evidence
8. Sanitized ChatGPT handoff packs
9. Foundation-based new plugin wizard
10. CI / package / release gate

## New plugin wizard requirements

- Projectが0件でも「新規作成」から開始できる
- GitHub CLIの導入 / 認証状態をHub内で確認できる
- GitHub認証TokenをHub自身では保存・読取しない
- Plugin名、Repository名、種類、公開設定、PC保存先を指定できる
- `EliteMay/aviutl-plugin-foundation` を取得し、Foundation Version / Commitを記録する
- `plugin-project.json` と初期Roadmapを生成する
- GitHub Repository作成、初回Commit / Push、Hub登録まで1操作で完了する
- 作成したRepositoryを自動で信頼済みにしない
- 作成途中で失敗した場合、既存Repositoryや他のFolderを削除しない
- Projectが0件のChatGPT連携画面から新規作成へ移動できる

## Desktop foundation requirements

- Dark mode by default
- Settings schema with atomic writes and last-known-good backup
- Window position/size restore with visible-screen clamping
- Single instance lock
- Bounded local log
- Renderer crash recovery
- Offline state separated from local capabilities
- Stable GitHub Release updater with explicit check → download → restart/install flow and manual Release fallback
- Settings screen for startup update preference and support folders
- One-click sanitized diagnostics export, bounded logs and clear/open support actions
- Renderer IPC sender validation, bounded payloads, restrictive CSP and blocked unexpected navigation
- Renderer crash recovery with an in-app reload action
- No invented ETA when progress cannot be measured

## Safety

Automatic Git updates are allowed only for a registered repository on the expected branch with expected origin and a clean working tree. Only fetch + fast-forward pull are automatic.

Never automate:
- reset
- clean
- rebase
- force push
- destructive checkout
- commit/push without explicit user action

Untrusted repositories may be inspected but may not build, run or install.

## Completion principle

Build success is not equivalent to AviUtl2 verification. Stable release requires CI plus explicit runtime verification appropriate to the plugin.
