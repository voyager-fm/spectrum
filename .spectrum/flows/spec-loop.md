# Self-specification loop
1. Read Spectrum's .spectrum and current implementation.
2. Detect a gap with evidence from deterministic validation, tests or human feedback.
3. Propose a bounded ChangeSet with unchanged acceptance criteria unless explicitly approved.
4. Human reviews exact diff and evidence.
5. Apply only approved changes against the matching revision and file hashes.
6. Run type checks, tests and spec checks; record failures as failures.
7. Reopen remaining gaps as a new proposal. Never declare document approval to be implementation success.

Today steps 1 and deterministic checks in step 6 are executable. Proposal generation and apply/review UI remain planned. Maximum automated repair attempts: 2, then stop for review.
