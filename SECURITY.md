# Security

- Repository registration does not imply trust.
- Untrusted repositories can be inspected but not executed.
- Canonicalize and validate filesystem paths before writes/deletes.
- Renderer cannot supply raw executable paths or shell commands.
- Git credentials are delegated to the system Git credential mechanism.
- ChatGPT exports redact home paths and credentials and omit arbitrary source contents.
- Install/uninstall operations are bounded by explicit managed-file manifests.
