# CLI output formats

Status: implemented local output adapters; live Actions execution is separate evidence.

`check` supports json, text and github formats. `list` supports json and text.
Omitting the flag preserves the existing JSON object or raw spec array. Formatting
does not change structural findings, warning visibility, or checker exit status.

Text is line-oriented and renders repository-provided control characters visibly.
It separates structural results, document review, declared implementation and AC
annotations; checked boxes are not executed-test evidence.

GitHub format emits one escaped error/warning command per finding and a structural
summary. Unsafe file attributes are omitted. Percent, newlines and property separators
cannot create additional workflow commands. No network calls or writes are made.
Unknown formats and github-for-list fail explicitly.

Owning formatter, CLI-process and standalone-bundle regressions cover default JSON
compatibility, human output, annotation escaping, error exits and a customer root
without workspace dependencies. No live GitHub workflow run is implied by string tests.
