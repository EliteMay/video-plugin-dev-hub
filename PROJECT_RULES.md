# Project Rules

1. Plugin-specific source does not live in the Hub repository.
2. Each plugin repository is the source of truth for its roadmap and release data.
3. Never use reset, clean, rebase or force push in Hub Git flows.
4. Commit, push, install, uninstall and release require explicit user actions.
5. Test environment is the default deployment target.
6. Delete only files proven to be Hub-managed by an install manifest.
7. Untrusted repositories cannot execute builds or scripts.
8. Renderer receives high-level IPC only; no arbitrary shell.
9. Do not store GitHub tokens or private credentials.
10. Build success and real AviUtl2 verification remain separate.
11. Do not fabricate progress percentages or ETAs.
12. Dark/Night UI is the default product theme.
13. Verification evidence records repository commit, build ID and AviUtl2 version.
14. ChatGPT packs are explicit sanitized exports; source contents are not automatically bundled.
15. GitHub/network failure must not disable local build/test capabilities.
16. SDK/AviUtl2 updates are not assumed compatible until verified.
17. Before developing, modifying, building, or testing an AviUtl2 plugin, review applicable failures and regression guards in `EliteMay/aviutl-plugin-foundation/PROJECT_LEARNINGS.md`, and the target plugin's own learnings when present. Do not assume a previously passing build means AviUtl2 runtime compatibility.
18. When a reproducible high-cost plugin error is understood, record the observed symptoms, evidence, confirmed root cause (or explicitly unresolved hypotheses), fix and regression guard in the affected plugin's `PROJECT_LEARNINGS.md`. Promote cross-plugin lessons to Foundation without mislabeling historical incidents as Foundation bugs. Confirm isolated startup, effect discovery, application and user-visible behavior where relevant.
