# Security

- Repository registration does not imply trust.
- Untrusted repositories can be inspected but not executed.
- Canonicalize and validate filesystem paths before writes/deletes.
- Renderer cannot supply raw executable paths or shell commands.
- Git credentials are delegated to the system Git credential mechanism.
- ChatGPT exports redact home paths and credentials and omit arbitrary source contents.
- Install/uninstall operations are bounded by explicit managed-file manifests.
- Privileged IPC accepts requests only from the current application renderer and rejects oversized payloads.
- Renderer pages use restrictive CSP; unexpected navigation, new windows and runtime permission requests are denied.
- External browser opening is limited to fixed application-owned support destinations.
