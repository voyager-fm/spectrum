import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from tsv_tables import check_tables, discover_tables, error_key, new_errors, read_tsv_records, read_tsv_rows, table_path


def write_table(root, relative, columns, rows, primary_key):
    directory = root / relative
    directory.mkdir(parents=True)
    (directory / "schema.json").write_text(
        json.dumps({"primary_key": primary_key, "columns": columns}), encoding="utf-8"
    )
    lines = ["\t".join(column["name"] for column in columns), *("\t".join(row) for row in rows)]
    (directory / "data.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")


REGION_COLUMNS = [
    {"name": "window_id", "required": True},
    {
        "name": "parent_region_id",
        "ref": {
            "table": "REGIONS",
            "columns": ["window_id", "parent_region_id"],
            "references": ["window_id", "region_id"],
        },
    },
    {"name": "region_id", "required": True},
    {"name": "key", "required": True},
    {"name": "level", "type": "number"},
    {"name": "status", "enum": ["drafted", "shipped"]},
    {"name": "refs", "ref": {"table": "ACTIONS", "column": "action_id"}},
]


class TsvTableCaptureTest(unittest.TestCase):
    def test_captured_text_preserves_file_reader_values_and_physical_lines(self):
        texts = [
            "",
            '\ufeffkey\tvalue\textra\r\none\t"two\tquoted"\t\r\n\r\nshort\t spaced \rthree\tTBD\t<<AI>> -',
            "key\tvalue\nlarge\t" + "x" * 140000 + "\n",
        ]
        previous_limit = csv.field_size_limit(10 * 1024 * 1024)
        try:
            for text in texts:
                with self.subTest(length=len(text)), tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "data.tsv"
                    path.write_bytes(text.encode("utf-8"))
                    expected = read_tsv_records(path)
                    with path.open("r", encoding="utf-8", newline="") as handle:
                        captured = handle.read()
                    path.unlink()
                    self.assertEqual(expected, read_tsv_records(path, source_text=captured))
                    self.assertEqual([(line, row) for line, row, _ in expected],
                                     read_tsv_rows(path, source_text=captured))
        finally:
            csv.field_size_limit(previous_limit)


class TsvTablesTest(unittest.TestCase):
    def check(self, region_rows):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_table(root, ".spectrum/A/ACTIONS", [{"name": "action_id", "required": True}], [["open"], ["close"]], ["action_id"])
            write_table(root, ".spectrum/B/REGIONS", REGION_COLUMNS, region_rows, ["key"])
            return check_tables(root, paths={"ACTIONS": ".spectrum/A/ACTIONS/data.tsv", "REGIONS": ".spectrum/B/REGIONS/data.tsv"})

    def test_valid_rows_and_placeholders_pass(self):
        self.assertEqual(
            self.check(
                [
                    ["w", "-", "root", "w", "1", "shipped", "open|close"],
                    ["w", "root", "child", "w.child", "TBD", "<<AI>> TBD", "-"],
                ]
            ),
            [],
        )

    def test_reports_schema_violations(self):
        errors = self.check(
            [
                ["w", "-", "root", "w", "one", "released", "open|missing"],
                ["w", "ghost", "child", "w", "2", "drafted", "TBD"],
                ["-", "root", "leaf", "TBD", "3", "drafted", "-"],
            ]
        )
        messages = [error.split(": ", 1)[1] for error in errors]
        self.assertIn("level: 'one' is not a number", messages)
        self.assertIn("status: 'released' is not in schema enum ['drafted', 'shipped']", messages)
        self.assertIn("window_id: required column cannot be '-'", messages)
        self.assertIn("duplicate primary key ('w',); first on line 2", messages)
        self.assertIn("primary key cannot be empty, '-' or TBD: ('TBD',)", messages)
        self.assertIn("refs: 'missing' not found in ACTIONS.action_id", messages)
        self.assertIn("parent_region_id: ('w', 'ghost') not found in REGIONS.window_id/region_id", messages)

    def test_header_must_match_schema_order(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_table(root, ".spectrum/A/ACTIONS", [{"name": "action_id"}, {"name": "label"}], [], ["action_id"])
            (root / ".spectrum/A/ACTIONS/data.tsv").write_text("label\taction_id\n", encoding="utf-8")
            self.assertEqual(len(check_tables(root)), 1)
            self.assertIn("header does not match", check_tables(root)[0])

    def test_discovers_tables_without_schema_for_fixture_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".spectrum/catalog/items").mkdir(parents=True)
            (root / ".spectrum/catalog/items/data.tsv").write_text("id\n", encoding="utf-8")
            self.assertEqual(set(discover_tables(root)), {".spectrum/catalog/items"})
            self.assertEqual(
                table_path(root, ".spectrum/catalog/items"), (root / ".spectrum/catalog/items/data.tsv").resolve()
            )

    def test_error_key_keeps_path_and_message_without_line(self):
        self.assertEqual(
            error_key("docs/A/data.tsv:99: primary key cannot be empty, '-' or TBD: ('TBD',)"),
            "docs/A/data.tsv: primary key cannot be empty, '-' or TBD: ('TBD',)",
        )
        self.assertEqual(error_key("docs/A/data.tsv: missing schema.json"), "docs/A/data.tsv: missing schema.json")

    def test_new_errors_ignore_line_shifts_and_count_multiset(self):
        baseline = [
            f"docs/A/data.tsv:{line}: primary key cannot be empty, '-' or TBD: ('TBD',)"
            for line in range(80, 91)  # 11 known errors
        ]
        current = [
            f"docs/A/data.tsv:{line}: primary key cannot be empty, '-' or TBD: ('TBD',)"
            for line in range(79, 90)  # same 11, shifted by the removed column
        ]
        current.append("docs/B/data.tsv:2: status: 'implemented' is not in schema enum ['idea', 'drafted']")
        self.assertEqual(new_errors(current, baseline), [current[-1]])
        self.assertEqual(new_errors(baseline, current), [])


if __name__ == "__main__":
    unittest.main()
