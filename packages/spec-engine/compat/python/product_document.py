"""Captured Markdown metadata/section reads and proposed source-preserving edits."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Any

from document_model import parse_texts

PARSER_ROOT = Path(__file__).resolve().parents[1]


def parse_document(text: str) -> dict[str, Any]:
    """Parse with the installed adapter; retain no source or AST between calls."""
    return parse_texts(PARSER_ROOT, [text])[0]


def _metadata_strings_from_parsed(parsed: dict[str, Any]) -> dict[str, str]:
    if parsed.get("metadata_error"):
        raise ValueError("Invalid YAML frontmatter: " + parsed["metadata_error"])
    if parsed.get("frontmatter_range") is None:
        return {}
    metadata = parsed.get("metadata")
    if not isinstance(metadata, dict):
        raise ValueError("Frontmatter must be a mapping")
    result: dict[str, str] = {}
    for key, value in metadata.items():
        if value is None:
            result[str(key)] = ""
        elif isinstance(value, (str, int, float, bool)):
            result[str(key)] = str(value)
        else:
            raise ValueError(f"Frontmatter field {key!r} must be a scalar")
    return result


def metadata_strings(text: str) -> dict[str, str]:
    return _metadata_strings_from_parsed(parse_document(text))


@dataclass(frozen=True)
class MetadataParseResult:
    metadata: dict[str, str] | None
    error: str | None


@dataclass(frozen=True)
class ProductDocument:
    """A captured source and its parser result, owned by one read-only audit."""

    text: str
    parsed: dict[str, Any]
    metadata: MetadataParseResult

    def section_body(self, heading: str) -> str | None:
        return _section_body(self.text, self.parsed, heading)


def parse_documents_many(
    texts: list[str], *, batch_size: int = 100
) -> list[ProductDocument]:
    """Retain the batch AST without introducing a process-global or persistent cache."""
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")
    results: list[ProductDocument] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        parsed_batch = parse_texts(PARSER_ROOT, batch)
        for text, parsed in zip(batch, parsed_batch, strict=True):
            try:
                metadata = MetadataParseResult(_metadata_strings_from_parsed(parsed), None)
            except ValueError as error:
                metadata = MetadataParseResult(None, str(error))
            results.append(ProductDocument(text, parsed, metadata))
    return results


def metadata_results_many(
    texts: list[str], *, batch_size: int = 100
) -> list[MetadataParseResult]:
    """Parse captured documents while preserving each document's parse outcome."""
    return [document.metadata for document in parse_documents_many(texts, batch_size=batch_size)]


def metadata_strings_many(
    texts: list[str], *, batch_size: int = 100
) -> list[dict[str, str]]:
    """Fail-fast compatibility view over metadata_results_many()."""
    results = metadata_results_many(texts, batch_size=batch_size)
    metadata_items: list[dict[str, str]] = []
    for index, result in enumerate(results):
        if result.error is not None:
            raise ValueError(f"Document {index}: {result.error}")
        metadata_items.append(result.metadata or {})
    return metadata_items


def _slice_bytes(text: str, range_value: dict[str, int] | None) -> str:
    if range_value is None:
        return ""
    data = text.encode("utf-8")
    return data[range_value["start"]:range_value["end"]].decode("utf-8")


def section_records(text: str, level: int = 2) -> list[dict[str, Any]]:
    return [section for section in parse_document(text).get("sections", []) if section.get("level") == level]


def _section_body(text: str, parsed: dict[str, Any], heading: str) -> str | None:
    matches = [
        section for section in parsed.get("sections", [])
        if section.get("level") == 2 and section.get("title") == heading
    ]
    if not matches:
        return None
    if len(matches) > 1:
        raise ValueError(f"Duplicate section heading: {heading}")
    return _slice_bytes(text, matches[0].get("body_range")).strip("\r\n")


def section_body(text: str, heading: str) -> str | None:
    return _section_body(text, parse_document(text), heading)


def section_lines(text: str) -> tuple[list[str], dict[str, list[str]]]:
    headings: list[str] = []
    sections: dict[str, list[str]] = {}
    for section in section_records(text):
        heading = str(section["title"])
        if heading in sections:
            raise ValueError(f"Duplicate section heading: {heading}")
        headings.append(heading)
        sections[heading] = _slice_bytes(text, section.get("body_range")).strip("\r\n").splitlines()
    return headings, sections


def h1_title(text: str) -> str | None:
    matches = section_records(text, level=1)
    if not matches:
        return None
    if len(matches) > 1:
        raise ValueError("Document has multiple H1 headings")
    return str(matches[0]["title"])


def _patch_bytes(text: str, patches: list[tuple[int, int, bytes]]) -> str:
    original = text.encode("utf-8")
    data = original
    source_length = len(data)
    ordered = sorted(patches, key=lambda item: item[0], reverse=True)
    last_start = len(data) + 1
    for start, end, replacement in ordered:
        if not (0 <= start <= end <= source_length) or end > last_start:
            raise ValueError("Overlapping or invalid source patch")
        # Byte offsets must also be UTF-8 character boundaries in the original source.
        try:
            original[:start].decode("utf-8")
            original[:end].decode("utf-8")
            replacement.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError("Invalid UTF-8 source patch") from error
        data = data[:start] + replacement + data[end:]
        last_start = start
    return data.decode("utf-8")


def _frontmatter_closing_offset(text: str) -> int:
    offset = 0
    for index, line in enumerate(text.splitlines(keepends=True)):
        if index > 0 and line.rstrip("\r\n") == "---":
            return offset
        offset += len(line.encode("utf-8"))
    raise ValueError("YAML frontmatter is not closed")


def patch_frontmatter_fields(text: str, updates: dict[str, str]) -> tuple[str, list[str]]:
    """Patch scalar fields in place and append missing scalar fields before the closing delimiter."""
    if not updates:
        return text, []
    parsed = parse_document(text)
    if parsed.get("metadata_error"):
        raise ValueError("Invalid YAML frontmatter: " + parsed["metadata_error"])
    if parsed.get("frontmatter_range") is None:
        raise ValueError("Missing YAML frontmatter")
    metadata = _metadata_strings_from_parsed(parsed)
    fields = {field["key"]: field for field in parsed.get("metadata_fields", [])}
    patches: list[tuple[int, int, bytes]] = []
    changed: list[str] = []
    missing: list[tuple[str, str]] = []
    for key, value in updates.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise ValueError("Frontmatter updates must use string keys and values")
        if key not in metadata:
            if re.fullmatch(r"[A-Za-z0-9_-]+", key) is None:
                raise ValueError(f"Frontmatter field cannot be safely inserted: {key!r}")
            missing.append((key, value))
            changed.append(key)
            continue
        if metadata[key] == value:
            continue
        field = fields.get(key)
        if not field:
            raise ValueError(f"Frontmatter field cannot be safely patched in place: {key}")
        replacement = json.dumps(value, ensure_ascii=False).encode("utf-8")
        if field.get("empty"):
            source_range = field.get("value_range")
            if not source_range:
                raise ValueError(f"Frontmatter field cannot be safely patched in place: {key}")
            data = text.encode("utf-8")
            if source_range["start"] > 0 and data[source_range["start"] - 1:source_range["start"]] == b":":
                replacement = b" " + replacement
            if field.get("has_inline_comment"):
                replacement += b" "
            patches.append((source_range["start"], source_range["end"], replacement))
            changed.append(key)
            continue
        if not field.get("editable"):
            raise ValueError(f"Frontmatter field cannot be safely patched in place: {key}")
        source_range = field["value_range"]
        patches.append((source_range["start"], source_range["end"], replacement))
        changed.append(key)
    if missing:
        eol = "\r\n" if text.startswith("---\r\n") else "\n"
        insertion = "".join(
            f"{key}: {json.dumps(value, ensure_ascii=False)}{eol}"
            for key, value in missing
        ).encode("utf-8")
        offset = _frontmatter_closing_offset(text)
        patches.append((offset, offset, insertion))
    updated = _patch_bytes(text, patches)
    if changed:
        # The parser's editable ranges cover single-line scalars. Reject a proposed
        # edit if a multiline/ambiguous YAML source would change other values.
        expected = metadata | updates
        if metadata_strings(updated) != expected:
            raise ValueError("Frontmatter fields cannot be safely patched in place")
    return updated, changed


def replace_h1_title(text: str, new_title: str) -> tuple[str, bool]:
    matches = section_records(text, level=1)
    if not matches:
        return text, False
    if len(matches) > 1:
        raise ValueError("Document has multiple H1 headings")
    source_range = matches[0].get("heading_range")
    if source_range is None:
        raise ValueError("H1 source range is unavailable")
    old = _slice_bytes(text, source_range)
    ending = "\r\n" if old.endswith("\r\n") else "\n" if old.endswith("\n") else ""
    replacement = ("# " + new_title + ending).encode("utf-8")
    updated = _patch_bytes(text, [(source_range["start"], source_range["end"], replacement)])
    return updated, updated != text


def replace_section_body(text: str, heading: str, new_body: str) -> tuple[str, bool]:
    matches = [section for section in section_records(text) if section.get("title") == heading]
    if not matches:
        return text, False
    if len(matches) > 1:
        raise ValueError(f"Duplicate section heading: {heading}")
    source_range = matches[0].get("body_range")
    if source_range is None:
        raise ValueError(f"Section source range is unavailable: {heading}")
    eol = "\r\n" if "\r\n" in text else "\n"
    at_eof = source_range["end"] == len(text.encode("utf-8"))
    suffix = eol if at_eof else eol + eol
    replacement = (eol + new_body.strip() + suffix).encode("utf-8")
    updated = _patch_bytes(text, [(source_range["start"], source_range["end"], replacement)])
    return updated, updated != text
