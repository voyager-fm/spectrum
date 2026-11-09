#!/usr/bin/env python3
"""Shared TSV table access and schema-driven validation.

Tables are discovered from `<domain>/**/<TABLE>/data.tsv`; the adjacent `schema.json`
owns column order, required fields, enums, primary keys, and references. Scripts
should read table paths and column semantics from here instead of restating them.

Placeholder rules (AGENTS.md): `-` means not applicable, `TBD` means undecided.
`TBD` is accepted everywhere except primary keys; `-` is rejected for required columns.
A leading `<<AI>> ` draft marker is ignored when validating a cell value.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

DOMAINS = (".spectrum",)
NULL = "-"
TBD = "TBD"
AI_MARKER = "<<AI>>"
PLACEHOLDERS = {NULL, TBD}
_ERROR_WITH_LINE = re.compile(r"^(.*?):\d+: (.*)$")


def read_tsv_header(path: Path) -> list[str]:
    """Read the physical TSV header once, stripping only an optional UTF-8 BOM."""
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        raw = handle.readline()
    if not raw:
        return []
    return next(csv.reader([raw], delimiter="\t"))


def read_tsv_records(path: Path, *, source_text: str | None = None) -> list[tuple[int, dict[str, str], str]]:
    """Return physical lines and raw values, using captured text when provided."""
    if source_text is None:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            lines = handle.readlines()
    else:
        lines = io.StringIO(source_text.removeprefix("\ufeff"), newline="").readlines()
    if not lines:
        return []
    header = next(csv.reader([lines[0]], delimiter="\t"))
    records: list[tuple[int, dict[str, str], str]] = []
    for line_no, raw in enumerate(lines[1:], start=2):
        if not raw.strip():
            records.append((line_no, {}, raw))
            continue
        values = next(csv.reader([raw], delimiter="\t"))
        row = {name: values[index] if index < len(values) else "" for index, name in enumerate(header)}
        records.append((line_no, row, raw))
    return records


def read_tsv_rows(path: Path, *, source_text: str | None = None) -> list[tuple[int, dict[str, str]]]:
    """Compatibility view over read_tsv_records; raw values remain strings."""
    return [(line_no, row) for line_no, row, _raw in read_tsv_records(path, source_text=source_text)]


def serialize_tsv_row(header: list[str], row: dict[str, str]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([row.get(column, "") for column in header])
    return buffer.getvalue()


def strip_ai_marker(value: str) -> str:
    value = value.strip()
    if value.startswith(AI_MARKER):
        return value[len(AI_MARKER) :].strip()
    return value


def split_refs(value: str) -> list[str]:
    return [part.strip() for part in strip_ai_marker(value).split("|") if part.strip()]


@dataclass
class Table:
    name: str
    directory: Path
    data_file: Path | None = None

    @property
    def data_path(self) -> Path:
        return self.data_file or self.directory / "data.tsv"

    @property
    def schema_path(self) -> Path:
        return self.directory / "schema.json"

    @cached_property
    def schema(self) -> dict:
        if not self.schema_path.is_file():
            return {}
        return json.loads(self.schema_path.read_text(encoding="utf-8"))

    @cached_property
    def columns(self) -> list[dict]:
        return list(self.schema.get("columns", []))

    @cached_property
    def primary_key(self) -> list[str]:
        return list(self.schema.get("primary_key", []))

    @cached_property
    def rows(self) -> list[tuple[int, dict[str, str]]]:
        return read_tsv_rows(self.data_path)

    def key_like_columns(self) -> set[str]:
        """Identifier-shaped columns: primary key, enums, and both sides of refs."""
        names = set(self.primary_key)
        for column in self.columns:
            if "enum" in column:
                names.add(column["name"])
            ref = column.get("ref")
            if ref:
                names.update(ref.get("columns") or [column["name"]])
                names.update(ref.get("references") or [])
        return names


def _inside(root: Path, path: Path) -> Path:
    if not path.resolve().is_relative_to(root):
        raise ValueError(f"table or schema path escapes customer root: {path}")
    return path


def discover_tables(root: Path, *, paths: dict[str, str] | None = None,
                    directories: tuple[str, ...] = DOMAINS) -> dict[str, Table]:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"customer root is not a directory: {root}")
    tables: dict[str, Table] = {}
    candidates: list[tuple[str, Path]] = []
    if paths is not None:
        for name, relative in paths.items():
            if not isinstance(name, str) or not name or not isinstance(relative, str):
                raise ValueError("table bindings require non-empty names and relative paths")
            path = Path(relative)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError(f"table path escapes customer root: {relative}")
            candidates.append((name, _inside(root, root / path)))
    else:
        for directory in directories:
            relative = Path(directory)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"discovery directory escapes customer root: {directory}")
            start = _inside(root, root / relative)
            for data_path in sorted(start.rglob("data.tsv")):
                name = data_path.parent.relative_to(root).as_posix()
                candidates.append((name, data_path))
    for name, data_path in candidates:
        _inside(root, data_path)
        _inside(root, data_path.with_name("schema.json"))
        if not data_path.is_file():
            raise ValueError(f"table source is not a file: {data_path}")
        if name in tables:
            raise ValueError(f"duplicate table name {name}")
        tables[name] = Table(name, data_path.parent, data_path)
    return tables


def table_path(root: Path, name: str) -> Path:
    """Resolve a table's data.tsv under `root` (repo or eval fixture root)."""
    table = discover_tables(root).get(name)
    if table is None:
        raise FileNotFoundError(f"table {name} not found under {root}")
    return table.data_path


def table_schema(name: str, root: Path) -> Table:
    """Load a canonical table (schema + rows) from the repository."""
    return discover_tables(root)[name]


@dataclass
class Report:
    root: Path
    errors: list[str] = field(default_factory=list)

    def add(self, table: Table, line: int | None, message: str) -> None:
        path = table.data_path
        where = str(path.relative_to(self.root) if path.is_relative_to(self.root) else path)
        where += f":{line}" if line else ""
        self.errors.append(f"{where}: {message}")


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True


def check_table(table: Table, report: Report) -> None:
    if not table.schema:
        report.add(table, None, "missing schema.json")
        return

    with table.data_path.open("r", encoding="utf-8-sig", newline="") as handle:
        records = list(csv.reader(handle, delimiter="\t"))
    if not records:
        report.add(table, None, "empty TSV")
        return

    header = records[0]
    expected = [column["name"] for column in table.columns]
    if header != expected:
        report.add(table, 1, f"header does not match schema columns: {header} != {expected}")
        return

    seen_keys: dict[tuple[str, ...], int] = {}
    for line, record in enumerate(records[1:], start=2):
        if not any(cell.strip() for cell in record):
            report.add(table, line, "empty row")
            continue
        if len(record) != len(header):
            report.add(table, line, f"expected {len(header)} columns, got {len(record)}")
            continue
        row = dict(zip(header, record))

        if table.primary_key:
            key = tuple(strip_ai_marker(row[name]) for name in table.primary_key)
            if any(value in PLACEHOLDERS | {""} for value in key):
                report.add(table, line, f"primary key cannot be empty, '-' or TBD: {key}")
            elif key in seen_keys:
                report.add(table, line, f"duplicate primary key {key}; first on line {seen_keys[key]}")
            else:
                seen_keys[key] = line

        for column in table.columns:
            name = column["name"]
            value = strip_ai_marker(row[name])
            if value == "":
                report.add(table, line, f"{name}: empty cell; use '-' or TBD")
                continue
            if value == NULL and column.get("required") and NULL not in column.get("enum", []):
                report.add(table, line, f"{name}: required column cannot be '-'")
            if value in PLACEHOLDERS:
                continue
            if "enum" in column and value not in column["enum"]:
                report.add(table, line, f"{name}: {value!r} is not in schema enum {column['enum']}")
            if column.get("type") == "number" and not _is_number(value):
                report.add(table, line, f"{name}: {value!r} is not a number")


def check_refs(table: Table, tables: dict[str, Table], report: Report) -> None:
    for column in table.columns:
        ref = column.get("ref")
        if not ref:
            continue
        target = tables.get(ref["table"])
        if target is None:
            report.add(table, None, f"{column['name']}: ref table {ref['table']} not found")
            continue
        source_cols = ref.get("columns") or [column["name"]]
        target_cols = ref.get("references") or [ref["column"]]
        known = {
            tuple(strip_ai_marker(row.get(name, "")) for name in target_cols) for _, row in target.rows
        }
        for line, row in table.rows:
            if len(source_cols) == 1:
                values = [(value,) for value in split_refs(row.get(source_cols[0], ""))]
            else:
                values = [tuple(strip_ai_marker(row.get(name, "")) for name in source_cols)]
            for value in values:
                if any(part in PLACEHOLDERS | {""} for part in value):
                    continue
                if value not in known:
                    shown = value[0] if len(value) == 1 else value
                    report.add(
                        table,
                        line,
                        f"{column['name']}: {shown!r} not found in {ref['table']}.{'/'.join(target_cols)}",
                    )


def schema_error(table: Table) -> str | None:
    try:
        schema = table.schema
    except (OSError, ValueError) as error:
        return f"invalid schema.json: {error}"
    if not schema:
        return "missing or empty schema.json"
    if not isinstance(schema, dict) or not isinstance(schema.get("columns"), list):
        return "invalid schema.json: columns must be an array"
    columns = schema["columns"]
    if not columns or any(not isinstance(col, dict) or not isinstance(col.get("name"), str)
                          or not col["name"] for col in columns):
        return "invalid schema.json: columns require non-empty names"
    names = [col["name"] for col in columns]
    if len(set(names)) != len(names):
        return "invalid schema.json: duplicate column names"
    key = schema.get("primary_key", [])
    if not isinstance(key, list) or any(not isinstance(name, str) or name not in names for name in key):
        return "invalid schema.json: primary_key must reference declared columns"
    for col in columns:
        if "required" in col and not isinstance(col["required"], bool):
            return "invalid schema.json: required must be boolean"
        if "enum" in col and (not isinstance(col["enum"], list) or any(not isinstance(value, str) for value in col["enum"])):
            return "invalid schema.json: enum must be a string array"
        ref = col.get("ref")
        if ref is None:
            continue
        if not isinstance(ref, dict) or not isinstance(ref.get("table"), str):
            return "invalid schema.json: ref requires a table name"
        source = ref.get("columns", [col["name"]])
        target = ref.get("references", [ref.get("column")])
        if not isinstance(source, list) or not isinstance(target, list) or not source or len(source) != len(target):
            return "invalid schema.json: ref columns/references must have equal nonzero width"
        if any(not isinstance(name, str) or name not in names for name in source) or any(not isinstance(name, str) or not name for name in target):
            return "invalid schema.json: ref has invalid column names"
    return None


def check_tables(root: Path, names: list[str] | None = None, *, paths: dict[str, str] | None = None,
                 directories: tuple[str, ...] = DOMAINS) -> list[str]:
    root = root.resolve()
    tables = discover_tables(root, paths=paths, directories=directories)
    report = Report(root=root)
    invalid: set[str] = set()
    pending = list(names or tables)
    inspected: set[str] = set()
    while pending:
        name = pending.pop()
        if name in inspected or name not in tables:
            continue
        inspected.add(name)
        table = tables[name]
        problem = schema_error(table)
        if problem:
            report.add(table, None, problem)
            invalid.add(name)
        else:
            pending.extend(column["ref"]["table"] for column in table.columns if column.get("ref"))
    for name in set(names or []) - set(tables):
        report.errors.append(f"unknown table {name}")
    for name, table in tables.items():
        if name in invalid or (names and name not in names):
            continue
        check_table(table, report)
        for column in table.columns:
            ref = column.get("ref")
            if not ref or ref["table"] not in tables or ref["table"] in invalid:
                continue
            target = tables[ref["table"]]
            target_names = {col["name"] for col in target.columns}
            if any(key not in target_names for key in (ref.get("references") or [ref["column"]])):
                report.add(table, None, f"{column['name']}: ref target schema column not found")
                break
        else:
            check_refs(table, {key: value for key, value in tables.items() if key not in invalid}, report)
    return report.errors


def error_key(error: str) -> str:
    """Drop the line number so errors from different revisions compare by path + message."""
    match = _ERROR_WITH_LINE.match(error)
    return f"{match.group(1)}: {match.group(2)}" if match else error


def new_errors(errors: list[str], baseline: list[str]) -> list[str]:
    """Multiset difference: errors the baseline does not account for, with full text kept."""
    counts = Counter(error_key(error) for error in errors) - Counter(error_key(error) for error in baseline)
    result: list[str] = []
    seen: Counter = Counter()
    for error in errors:
        key = error_key(error)
        if seen[key] < counts[key]:
            seen[key] += 1
            result.append(error)
    return result


def copy_ref_tables(ref: str, destination: Path, repository: Path,
                    directories: tuple[str, ...] = DOMAINS, paths: dict[str, str] | None = None) -> None:
    """Materialize selected tables of a Git commit for baseline comparison."""
    ref = subprocess.run(["git", "rev-parse", "--verify", "--end-of-options", ref + "^{commit}"],
                         cwd=repository, check=True, capture_output=True, text=True).stdout.strip()
    listing = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", ref],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    selected = set(paths.values()) if paths is not None else {
        path for path in listing if path.endswith("/data.tsv") and
        any(path.startswith(directory.rstrip("/") + "/") for directory in directories)
    }
    for data in sorted(selected & set(listing)):
        table_dir = destination / Path(data).parent
        table_dir.mkdir(parents=True, exist_ok=True)
        content = subprocess.run(
            ["git", "show", f"{ref}:{data}"], cwd=repository, check=True, capture_output=True, text=True
        ).stdout
        (destination / data).write_text(content, encoding="utf-8")
        schema = f"{Path(data).parent.as_posix()}/schema.json"
        shown = subprocess.run(
            ["git", "show", f"{ref}:{schema}"], cwd=repository, check=False, capture_output=True, text=True
        )
        if shown.returncode == 0:
            (table_dir / "schema.json").write_text(shown.stdout, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate TSV tables against their adjacent schema.json")
    parser.add_argument("tables", nargs="*", help="catalog table names to check")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--directory", action="append", help="relative table discovery root (default: .spectrum)")
    parser.add_argument("--table", action="append", default=[], metavar="NAME=PATH", help="explicit table binding")
    parser.add_argument(
        "--baseline",
        metavar="REF",
        help="git ref to compare against (e.g. origin/main); known baseline errors are tolerated, new errors fail",
    )
    args = parser.parse_args(argv)

    paths = None
    if args.table:
        paths = {}
        for binding in args.table:
            name, separator, path = binding.partition("=")
            if not separator or not name or not path or name in paths:
                parser.error("--table requires unique non-empty NAME=PATH bindings")
            paths[name] = path
    directories = tuple(args.directory or DOMAINS)
    if not args.tables and not args.baseline and not discover_tables(args.root, paths=paths, directories=directories):
        print("NOT RUN: no tables selected")
        return 0
    errors = check_tables(args.root, args.tables, paths=paths, directories=directories)
    checked = ", ".join(args.tables) if args.tables else "selected tables"
    if args.baseline:
        if not (args.root / ".git").exists():
            print(f"ERROR --baseline requires a git repository at {args.root}", file=sys.stderr)
            return 2
        with tempfile.TemporaryDirectory() as directory:
            ref_root = Path(directory)
            copy_ref_tables(args.baseline, ref_root, args.root, directories=directories, paths=paths)
            baseline_errors = check_tables(ref_root, args.tables, directories=directories, paths=paths)
        unresolved = new_errors(errors, baseline_errors)
        resolved = len(baseline_errors) - (len(errors) - len(unresolved))
        print(f"Baseline {args.baseline}: {len(baseline_errors)} known error(s), {resolved} resolved")
        for error in unresolved:
            print(f"ERROR {error}")
        if unresolved:
            print(f"FAIL: {len(unresolved)} new error(s) vs {args.baseline} in {checked}")
            return 1
        print(f"OK: no new errors vs {args.baseline} in {checked}")
        return 0
    for error in errors:
        print(f"ERROR {error}")
    print(f"{'FAIL' if errors else 'OK'}: {len(errors)} error(s) in {checked}")
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"BLOCKED: {error}", file=sys.stderr)
        sys.exit(2)
