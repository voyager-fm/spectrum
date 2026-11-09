# Repository snapshots

`document_snapshot.py` supplies read-only file views for document inspection. Its
input is an explicit Git repository root and revision; it does not assume product
directories, document IDs, lifecycle enums, a product language or a client runtime.

Supported primitives include commit/index/worktree file views, UTF-8 text reads,
digests and explicit worktree stability checks. Secret paths and unsupported source
symlinks are rejected. Consumers must call the relevant stability check; this module
does not supply an immutable filesystem transaction or a hosted execution sandbox.

Run the regressions from the Spectrum repository root:

```sh
node scripts/test-document-snapshot.ts
```

The runner creates an isolated test layout, runs the three snapshot regressions,
and removes the temporary directory. It needs Python 3.11+ (default `python3.11`;
override with `SPECTRUM_PYTHON`) and Git. No package installation is required.
