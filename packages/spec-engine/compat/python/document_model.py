"""Shared Markdown/YAML parsing adapter for documentation checkers."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
from typing import Any, Iterable

try:
    from scripts.document_snapshot import Blocked, Snapshot
except ModuleNotFoundError:
    from document_snapshot import Blocked, Snapshot


@dataclass(frozen=True)
class ParsedDocument:
    path: str
    content_hash: str
    parsed: dict[str, Any]


def _parser_path(root: Path) -> Path:
    path = root / "node" / "parse_markdown.mjs"
    if not path.is_file():
        raise Blocked("Required Markdown parser is missing")
    return path


def parse_texts(root: Path, texts: list[str], *, engineering: bool = False) -> list[dict[str, Any]]:
    command = ["node", str(_parser_path(root)), "--structured"]
    if engineering:
        command.append("--engineering")
    try:
        result = subprocess.run(
            command,
            input=json.dumps(texts),
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
            cwd=root,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Blocked("Required Markdown parser is unavailable or timed out") from error
    if result.returncode:
        raise Blocked("Required Markdown parser failed")
    try:
        values = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise Blocked("Markdown parser returned invalid JSON") from error
    if not isinstance(values, list) or len(values) != len(texts):
        raise Blocked("Markdown parser returned an invalid response shape")
    return values


class DocumentRepository:
    def __init__(self, root: Path, revision: str = "HEAD", *, parser_root: Path | None = None) -> None:
        self.root = root.resolve()
        self.parser_root = (parser_root or Path(__file__).resolve().parents[1]).resolve()
        self.snapshot = Snapshot(self.root, revision)
        self._cache: dict[tuple[str, str], ParsedDocument] = {}
        self._observed: dict[str, str] = {}

    def read(self, path: str) -> str:
        """Read text while preserving its first observed digest for snapshot stability."""
        observed = self._observed.get(path)
        if observed is not None:
            if self.snapshot.mode == "WORKTREE" and self.snapshot.digest(path) != observed:
                raise Blocked("Working-tree input changed during inspection: " + path)
            return self.snapshot.read(path)
        digest = self.snapshot.digest(path)
        text = self.snapshot.read(path)
        self._observed[path] = digest
        return text

    def observed_digests(self) -> dict[str, str]:
        return dict(self._observed)

    def documents(self, paths: Iterable[str], *, engineering: bool = False) -> list[ParsedDocument]:
        ordered = list(paths)
        pending: list[str] = []
        texts: list[str] = []
        results: dict[str, ParsedDocument] = {}
        for path in ordered:
            current_digest = self.snapshot.digest(path)
            observed = self._observed.get(path)
            if observed is not None and current_digest != observed:
                raise Blocked("Working-tree input changed during inspection: " + path)
            digest = observed or current_digest
            if observed is None:
                self._observed[path] = digest
            key = (path, digest)
            cached = self._cache.get(key)
            if cached is not None:
                results[path] = cached
                continue
            pending.append(path)
            texts.append(self.snapshot.read(path))
        if pending:
            for start in range(0, len(pending), 100):
                batch_paths = pending[start:start + 100]
                batch_texts = texts[start:start + 100]
                parsed_values = parse_texts(self.parser_root, batch_texts, engineering=engineering)
                for path, parsed in zip(batch_paths, parsed_values, strict=True):
                    digest = self._observed[path]
                    item = ParsedDocument(path=path, content_hash=digest, parsed=parsed)
                    self._cache[(path, digest)] = item
                    results[path] = item
        return [results[path] for path in ordered]

    def document(self, path: str, *, engineering: bool = False) -> ParsedDocument:
        return self.documents([path], engineering=engineering)[0]

    def assert_unchanged(self) -> None:
        self.snapshot.assert_unchanged(self._observed)
