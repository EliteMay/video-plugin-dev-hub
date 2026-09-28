# Test Strategy

## Automated layers

- Node unit tests for settings, parsers, validation and redaction
- IPC contract tests as high-level capabilities are added
- Windows GitHub Actions for tests + installer build
- Foundation sample configure/build once Phase 4 begins

## Human verification

Windows/AviUtl2 checks are tracked separately from CI:
- application launch
- installer install/uninstall
- window restore
- update flow
- AviUtl2 detection
- plugin install/load
- plugin behavior
- save/reload behavior

A green CI run never means an AviUtl2 runtime test has happened.

## Required regressions

- required fields never make Cancel/close unusable
- dirty repository never auto-pulls
- untrusted repository cannot execute
- unrelated installed files are never deleted
- malformed settings recover from backup
- offline state does not block local-only capabilities
- renderer failure does not delete user state and recovery reload remains available
- unexpected renderer IPC sender and oversized IPC payloads are rejected
- renderer pages keep restrictive CSP and deny unexpected navigation / permissions
- updater keeps explicit check → download → restart/install states and manual Release fallback
- settings schema migration keeps previous user settings and last-known-good backup
- diagnostic export remains sanitized and diagnostic logs remain bounded / clearable
- new plugin wizard rejects invalid Repository names and occupied destinations
- new plugin wizard distinguishes GitHub CLI missing / unauthenticated states
- generated plugin metadata uses the selected AviUtl2 plugin type
- generated plugin repositories record Foundation version / commit and preserve plugin-owned README / Roadmap
- new plugin creation never marks the generated Repository trusted automatically
