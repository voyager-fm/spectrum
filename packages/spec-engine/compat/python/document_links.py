"""Resolve and validate specification links without project-specific path policy."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
from urllib.parse import unquote

from document_model import parse_texts
from document_snapshot import Blocked

PARSER_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIRECTORIES = (".spectrum",)


def _inside(root: Path, path: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise Blocked(f"Document path escapes repository root: {path}")
    return resolved


def _notes(root: Path, directories=DEFAULT_DIRECTORIES) -> tuple[Path, ...]:
    root = root.resolve()
    if not root.is_dir():
        raise Blocked("Document root must be a directory")
    notes = set(root.glob("*.md"))
    for directory in directories:
        relative = Path(directory)
        if relative.is_absolute() or ".." in relative.parts:
            raise Blocked("Document discovery directory escapes repository root")
        base = _inside(root, root / relative)
        notes.update(base.rglob("*.md"))
    for note in notes:
        _inside(root, note)
    return tuple(sorted(notes))


def _parse_many(texts):
    return parse_texts(PARSER_ROOT, list(texts))


def _references(text: str, source_path: Path, root: Path, parsed=None, notes=None,
                directories=DEFAULT_DIRECTORIES):
    root = Path(root).resolve()
    source = _inside(root, root / source_path)
    document = parsed if parsed is not None else _parse_many([text])[0]
    for destination, wiki in document["references"]:
        if not wiki:
            yield unquote(destination), False
            continue
        file, separator, heading = destination.partition("#")
        if file:
            file = file if Path(file).suffix else file + ".md"
            target = (source.parent if file.startswith(("./", "../")) else root) / file
            if not target.is_file() and "/" not in file:
                candidates = notes if notes is not None else _notes(root, directories)
                matches = [note for note in candidates if note.name == file]
                if len(matches) > 1:
                    raise Blocked(f"Ambiguous document name: {file}")
                if matches:
                    target = matches[0]
            file = Path(os.path.relpath(target, source.parent)).as_posix()
        yield file + separator + heading, True


def document_targets(text: str, source_path: Path, root: Path, heading_slug=None,
                     *, directories=DEFAULT_DIRECTORIES) -> list[str]:
    targets = []
    for destination, wiki in _references(text, source_path, root, directories=directories):
        file, separator, heading = destination.partition("#")
        if wiki and heading_slug is not None:
            heading = heading_slug(heading)
        targets.append(file + separator + heading)
    return targets


def document_link(label: str, target: str, source_path: Path, root: Path, *, style="markdown") -> str:
    if style not in ("markdown", "wiki"):
        raise ValueError("Link style must be markdown or wiki")
    if style == "markdown":
        label = label.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")
        return f"[{label}]({target})"
    file, separator, heading = target.partition("#")
    if ":" in file or (file and not file.endswith(".md")):
        return f"[{label}]({target})"
    root = Path(root).resolve()
    source = _inside(root, root / source_path)
    if file:
        relative = _inside(root, source.parent / file).relative_to(root)
        file = relative.as_posix()[:-3]
    return f"[[{file}{separator}{heading}|{label.replace('|', '&#124;')}]]"


def check_document_links(root: Path, *, directories=DEFAULT_DIRECTORIES) -> list[str]:
    root = root.resolve()
    notes = _notes(root, directories)
    texts = {note: note.read_text(encoding="utf-8") for note in notes}
    if not notes:
        return []
    parsed = dict(zip(notes, _parse_many(list(texts.values())), strict=True))
    headings = {}
    issues = []
    for source in notes:
        try:
            references = list(_references(texts[source], source, root, parsed[source], notes, directories))
        except Blocked as error:
            issues.append(f"{source.relative_to(root)}: {error}")
            continue
        for destination, wiki in references:
            file, _, fragment = destination.partition("#")
            if not wiki and (":" in file or file.startswith("//")):
                continue
            target = (source.parent / file).resolve() if file else source
            if not target.is_relative_to(root):
                issues.append(f"{source.relative_to(root)}: target outside repository: {destination}")
                continue
            if not wiki and target.suffix != ".md":
                continue
            if not target.is_file():
                issues.append(f"{source.relative_to(root)}: missing file: {destination}")
            elif fragment and target.suffix == ".md":
                if target not in headings:
                    document = parsed.get(target)
                    if document is None:
                        document = _parse_many([target.read_text(encoding="utf-8")])[0]
                    headings[target] = ({title.casefold() for title in document["titles"]}, set(document["ids"]))
                available = headings[target][0 if wiki else 1]
                if (fragment.casefold() if wiki else fragment) not in available:
                    issues.append(f"{source.relative_to(root)}: missing heading: {destination}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Markdown and Wikilink specification destinations")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--directory", action="append")
    args = parser.parse_args()
    directories = tuple(args.directory or DEFAULT_DIRECTORIES)
    try:
        notes = _notes(args.root, directories)
        issues = check_document_links(args.root, directories=directories)
    except (Blocked, OSError) as error:
        print(f"BLOCKED: {error}", file=sys.stderr)
        return 2
    print("\n".join(issues) if issues else f"Checked {len(notes)} documents" if notes else "NOT RUN: no documents selected")
    return int(bool(issues))


if __name__ == "__main__":
    sys.exit(main())
