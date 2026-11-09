from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys

from tsv_tables import check_tables, discover_tables, new_errors


def put(root: Path, path: str, text: str) -> None:
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def table(root: Path, path: str, columns: list[dict], rows: list[list[str]], key: list[str]) -> None:
    put(root, path, "\t".join(column["name"] for column in columns) + "\n" +
        "".join("\t".join(row) + "\n" for row in rows))
    put(root, str(Path(path).with_name("schema.json")), json.dumps({"columns": columns, "primary_key": key}))


class TableValidationTests(unittest.TestCase):
    def test_customer_root_needs_no_package_identity_or_fixed_product_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            table(root, ".spectrum/domains/audio/items/data.tsv",
                  [{"name": "id", "required": True}, {"name": "state", "enum": ["ready"]}],
                  [["001", "broken"]], ["id"])
            errors = check_tables(root)
            self.assertTrue(any("not in schema enum" in error for error in errors), errors)
            self.assertFalse((root / "package.json").exists())

    def test_markdown_only_project_has_no_table_requirement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, ".spectrum/domains/audio/domain.md", "# Audio\n")
            self.assertEqual({}, discover_tables(root))
            self.assertEqual([], check_tables(root))

    def test_qualified_names_preserve_two_domains_with_identical_folder_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for domain in ("audio", "video"):
                table(root, f".spectrum/domains/{domain}/features/data.tsv", [{"name": "id"}], [["001"]], ["id"])
            catalog = discover_tables(root)
            self.assertEqual(2, len(catalog))
            self.assertEqual(2, len({item.name for item in catalog.values()}))
            self.assertEqual([], check_tables(root))

    def test_explicit_paths_support_arbitrary_filenames_and_composite_references(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            table(root, "data/parents/records.tsv", [{"name": "group"}, {"name": "id"}], [["a", "001"]], ["group", "id"])
            table(root, "data/children/values.tsv", [{"name": "id"}, {"name": "group"},
                  {"name": "parent", "ref": {"table": "sample:parents", "columns": ["group", "parent"],
                    "references": ["group", "id"]}}], [["child", "wrong", "001"]], ["id"])
            paths = {"sample:parents": "data/parents/records.tsv", "sample:children": "data/children/values.tsv"}
            errors = check_tables(root, paths=paths)
            self.assertTrue(any("not found in sample:parents.group/id" in error for error in errors), errors)

    def test_source_and_schema_symlink_escapes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory)
            foreign = Path(outside)
            table(foreign, "items/data.tsv", [{"name": "id"}], [["001"]], ["id"])
            (root / ".spectrum").mkdir()
            (root / ".spectrum/escape").symlink_to(foreign / "items", target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink|escape"):
                discover_tables(root, paths={"sample:escape": ".spectrum/escape/data.tsv"})
            put(root, ".spectrum/inside/data.tsv", "id\n001\n")
            (root / ".spectrum/inside/schema.json").symlink_to(foreign / "items/schema.json")
            with self.assertRaisesRegex(ValueError, "escape"):
                discover_tables(root)

    def test_malformed_schema_is_reported_instead_of_a_traceback_or_empty_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, ".spectrum/items/data.tsv", "id\n001\n")
            for raw in ("{", "null", '{"columns":[{"name":"id"}],"primary_key":["missing"]}'):
                with self.subTest(schema=raw):
                    put(root, ".spectrum/items/schema.json", raw)
                    errors = check_tables(root)
                    self.assertTrue(any("schema" in error for error in errors), errors)

    def test_placeholder_marker_semantics_and_input_bytes_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = ".spectrum/items/data.tsv"
            table(root, path, [{"name": "id"}, {"name": "value", "required": True, "enum": ["-", "ready"]}],
                  [["001", "<<AI>> ready"], ["002", "-"], ["TBD", "TBD"]], ["id"])
            before = (root / path).read_bytes()
            errors = check_tables(root)
            self.assertTrue(any("primary key cannot" in error for error in errors), errors)
            self.assertFalse(any("not in schema enum" in error or "required column" in error for error in errors), errors)
            self.assertEqual(before, (root / path).read_bytes())

    def test_baseline_comparison_retains_multiset_semantics(self):
        self.assertEqual(["a.tsv:2: invalid"], new_errors(
            ["a.tsv:2: invalid", "a.tsv:3: invalid"], ["a.tsv:99: invalid"]))

    def test_bom_crlf_and_a_table_without_a_primary_key_are_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = ".spectrum/items/data.tsv"
            table(root, path, [{"name": "id"}, {"name": "value"}], [["001", "one"], ["001", "two"]], [])
            source = root / path
            source.write_bytes(b"\xef\xbb\xbfid\tvalue\r\n001\tone\r\n001\ttwo\r\n")
            before = source.read_bytes()
            self.assertEqual([], check_tables(root))
            self.assertEqual(before, source.read_bytes())

    def test_selecting_one_table_does_not_validate_an_unrelated_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            table(root, ".spectrum/good/data.tsv", [{"name": "id"}], [["001"]], ["id"])
            put(root, ".spectrum/unrelated/data.tsv", "id\n001\n")
            put(root, ".spectrum/unrelated/schema.json", "{")
            self.assertEqual([], check_tables(root, [".spectrum/good"]))

    def test_each_customer_call_observes_its_own_current_values(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            left, right = Path(a), Path(b)
            for root, state in ((left, "ready"), (right, "wrong")):
                table(root, ".spectrum/items/data.tsv", [{"name": "id"}, {"name": "state", "enum": ["ready"]}],
                      [["001", state]], ["id"])
            self.assertEqual([], check_tables(left))
            self.assertTrue(check_tables(right))
            put(left, ".spectrum/items/data.tsv", "id\tstate\n001\twrong\n")
            self.assertTrue(check_tables(left))

    def cli(self, root: Path, *args: str):
        script = Path(__file__).resolve().parents[1] / "python/tsv_tables.py"
        return subprocess.run([sys.executable, "-B", str(script), "--root", str(root), *args],
                              capture_output=True, text=True, check=False)

    def test_cli_distinguishes_no_selection_violations_and_blocked_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = self.cli(root)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("NOT RUN", result.stdout)
            table(root, ".spectrum/items/data.tsv", [{"name": "id"}], [["TBD"]], ["id"])
            result = self.cli(root)
            self.assertEqual(1, result.returncode, result.stderr)
            self.assertIn("primary key cannot", result.stdout)
            result = self.cli(root, "--directory", "../outside")
            self.assertEqual(2, result.returncode)
            self.assertIn("BLOCKED", result.stderr)

    def test_cli_baseline_ignores_line_shifts_but_rejects_an_extra_violation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = ".spectrum/items/data.tsv"
            table(root, path, [{"name": "id"}, {"name": "state", "enum": ["ready"]}], [["001", "wrong"]], ["id"])
            for args in [("init",), ("config", "user.email", "fixture@example.com"),
                         ("config", "user.name", "Fixture"), ("add", "."), ("commit", "-m", "fixture")]:
                subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)
            put(root, path, "id\tstate\n002\tready\n001\twrong\n")
            result = self.cli(root, "--baseline", "HEAD")
            self.assertEqual(0, result.returncode, result.stderr + result.stdout)
            put(root, path, "id\tstate\n002\tready\n001\twrong\n003\twrong\n")
            result = self.cli(root, "--baseline", "HEAD")
            self.assertEqual(1, result.returncode, result.stderr + result.stdout)
            self.assertIn("1 new error", result.stdout)


if __name__ == "__main__":
    unittest.main()
