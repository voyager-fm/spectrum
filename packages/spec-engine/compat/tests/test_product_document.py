from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))

import product_document
from product_document import (
    h1_title,
    metadata_results_many,
    metadata_strings,
    metadata_strings_many,
    parse_document,
    parse_documents_many,
    patch_frontmatter_fields,
    replace_h1_title,
    replace_section_body,
    section_body,
    section_lines,
)


class ProductDocumentTests(unittest.TestCase):
    def test_batch_documents_retain_ast_for_metadata_and_section_reads(self) -> None:
        source = "---\nlabel: sample\n---\n\n# Example\n\n## Source\n\nReal source.\n"
        with mock.patch.object(product_document, "parse_texts", wraps=product_document.parse_texts) as parser:
            documents = parse_documents_many([source, "---\nlabel: [\n---\n"])
            self.assertEqual("sample", documents[0].metadata.metadata["label"])
            self.assertEqual("Real source.", documents[0].section_body("Source"))
            self.assertIn("Invalid YAML frontmatter", documents[1].metadata.error)
            self.assertIsNone(documents[0].section_body("Missing"))
            self.assertEqual(1, parser.call_count)

    def test_metadata_batching_bounds_real_parser_processes(self) -> None:
        texts = ["---\nlabel: sample\n---\n\n# Example\n"] * 205
        with mock.patch.object(product_document, "parse_texts", wraps=product_document.parse_texts) as parser:
            metadata = metadata_strings_many(texts, batch_size=100)
        self.assertEqual([{"label": "sample"}] * 205, metadata)
        self.assertEqual(3, parser.call_count)

    def test_empty_batch_and_invalid_batch_sizes(self) -> None:
        with mock.patch.object(product_document, "parse_texts", wraps=product_document.parse_texts) as parser:
            self.assertEqual([], parse_documents_many([]))
            self.assertEqual(0, parser.call_count)
        for size in (0, -1):
            with self.subTest(size=size), self.assertRaisesRegex(ValueError, "batch_size must be positive"):
                parse_documents_many([], batch_size=size)

    def test_batch_metadata_preserves_per_document_parse_errors(self) -> None:
        results = metadata_results_many(
            ["---\nlabel: first\n---\n", "---\nlabel: [\n---\n", "---\nlabel: last\n---\n"],
            batch_size=2,
        )
        self.assertEqual({"label": "first"}, results[0].metadata)
        self.assertIsNone(results[0].error)
        self.assertIsNone(results[1].metadata)
        self.assertIn("Invalid YAML frontmatter", results[1].error)
        self.assertEqual({"label": "last"}, results[2].metadata)
        with self.assertRaisesRegex(ValueError, "Document 1: Invalid YAML frontmatter"):
            metadata_strings_many(["# Plain\n", "---\nlabel: [\n---\n"])

    def test_repeated_parse_does_not_share_mutable_customer_ast(self) -> None:
        source = "---\nlabel: original\n---\n\n## Notes\n\nOriginal.\n"
        parsed = parse_document(source)
        parsed["metadata"]["label"] = "modified by caller"
        parsed["sections"].clear()
        self.assertEqual({"label": "original"}, metadata_strings(source))
        self.assertEqual("Original.", section_body(source, "Notes"))

    def test_installed_parser_works_outside_a_customer_or_source_checkout(self) -> None:
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as temporary:
            try:
                os.chdir(temporary)
                self.assertEqual({"label": "任意"}, metadata_strings("---\nlabel: 任意\n---\n"))
            finally:
                os.chdir(previous)

    def test_minimal_frontmatter_patch_preserves_unknown_metadata_and_comment(self) -> None:
        source = '---\nlabel: "any document"\n# keep this comment\nowner: "Ada"\ncustom_key: "keep"\n---\n\n# Title\n\n## Source\n\nOriginal.\n'
        updated, changed = patch_frontmatter_fields(source, {"owner": "Grace"})
        self.assertEqual(["owner"], changed)
        self.assertEqual(source.replace('owner: "Ada"', 'owner: "Grace"'), updated)
        self.assertEqual("any document", metadata_strings(updated)["label"])

    def test_frontmatter_value_patch_preserves_inline_comment(self) -> None:
        source = '---\nowner: Ada # reviewer note\ncustom_key: "keep # literal"\n---\n\n# Title\n'
        updated, changed = patch_frontmatter_fields(source, {"owner": "Grace"})
        self.assertEqual(["owner"], changed)
        self.assertEqual(source.replace("owner: Ada", 'owner: "Grace"'), updated)

    def test_empty_frontmatter_scalar_patch_preserves_inline_comment(self) -> None:
        source = "---\nmenu: # reviewer note\n---\n\n# Title\n"
        updated, changed = patch_frontmatter_fields(source, {"menu": "File > Open"})
        self.assertEqual(["menu"], changed)
        self.assertEqual(source.replace("menu: #", 'menu: "File > Open" #'), updated)
        self.assertEqual("File > Open", metadata_strings(updated)["menu"])

    def test_existing_empty_frontmatter_scalar_is_filled_in_place(self) -> None:
        source = '---\nmenu:\n# keep this comment\ncustom_key: "keep"\n---\n\n# Title\n'
        updated, changed = patch_frontmatter_fields(source, {"menu": "File > Open"})
        self.assertEqual(["menu"], changed)
        self.assertEqual(source.replace("menu:\n", 'menu: "File > Open"\n'), updated)
        self.assertEqual("File > Open", metadata_strings(updated)["menu"])

    def test_missing_frontmatter_field_is_inserted_without_rewriting_existing_content(self) -> None:
        source = '---\n# keep this comment\nowner: "Ada"\ncustom_key: "keep"\n---\n\n# Title\n'
        updated, changed = patch_frontmatter_fields(source, {"menu": "File > Open"})
        self.assertEqual(["menu"], changed)
        self.assertEqual(source.replace('\n---\n\n#', '\nmenu: "File > Open"\n---\n\n#'), updated)

    def test_unicode_crlf_metadata_edits_preserve_every_other_byte(self) -> None:
        source = "---\r\nlabel: '설계 📘'\r\nowner: '이름' # café\r\n---\r\n\r\n# 日本語\r\n\r\n~~~text\r\n## Fake\r\n~~~\r\n"
        updated, changed = patch_frontmatter_fields(source, {"owner": 'Zoë "Q"', "extra": "한글"})
        expected = source.replace("owner: '이름'", 'owner: "Zoë \\"Q\\""').replace(
            "\r\n---\r\n\r\n#", '\r\nextra: "한글"\r\n---\r\n\r\n#'
        )
        self.assertEqual(["owner", "extra"], changed)
        self.assertEqual(expected.encode("utf-8"), updated.encode("utf-8"))
        self.assertEqual('Zoë "Q"', metadata_strings(updated)["owner"])

    def test_quoted_hashes_and_apostrophes_are_not_comments(self) -> None:
        for value in ('"Ada # literal"', "'Ada''s # literal'"):
            source = f"---\nowner: {value} # keep\n---\n"
            updated, _ = patch_frontmatter_fields(source, {"owner": "Grace"})
            self.assertEqual('---\nowner: "Grace" # keep\n---\n', updated)

    def test_scalar_metadata_conversion_is_explicit(self) -> None:
        source = "---\nempty:\ncount: 2\nratio: 1.5\nenabled: true\nlabel: arbitrary\n---\n"
        self.assertEqual({"empty": "", "count": "2", "ratio": "1.5", "enabled": "True", "label": "arbitrary"}, metadata_strings(source))
        self.assertEqual({}, metadata_strings("# No metadata\n"))

    def test_non_scalar_frontmatter_is_not_lossily_converted(self) -> None:
        for content in ("items:\n  - one", "items: {key: value}", "- one"):
            with self.subTest(content=content), self.assertRaises(ValueError):
                metadata_strings(f"---\n{content}\n---\n\n# Title\n")

    def test_invalid_missing_and_duplicate_yaml_are_not_patched(self) -> None:
        for source in ("# Plain\n", "---\nowner: [\n---\n", "---\nowner: one\nowner: two\n---\n"):
            with self.subTest(source=source), self.assertRaises(ValueError):
                patch_frontmatter_fields(source, {"owner": "new"})

    def test_unsupported_scalar_source_forms_are_not_partially_rewritten(self) -> None:
        for value in ("|\n  old", ">\n  old", "&anchor old", "first\n  second", '"first\n  second"'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                patch_frontmatter_fields(f"---\nowner: {value}\n---\n", {"owner": "new"})

    def test_unsafe_inserted_keys_and_non_string_updates_are_rejected(self) -> None:
        for updates in ({"bad\nkey": "value"}, {"key: nested": "value"}, {"owner": ["value"]}, {1: "value"}):
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                patch_frontmatter_fields("---\nowner: original\n---\n", updates)

    def test_noop_metadata_patch_preserves_source_quoting(self) -> None:
        source = "---\nowner: 'Ada' # keep\n---\n"
        self.assertEqual((source, []), patch_frontmatter_fields(source, {"owner": "Ada"}))
        self.assertEqual((source, []), patch_frontmatter_fields(source, {}))

    def test_section_patch_ignores_fenced_fake_heading(self) -> None:
        source = "# Title\n\n~~~markdown\n## Source\nFake\n~~~\n\n## Source\n\nReal\n"
        self.assertEqual("Real", section_body(source, "Source"))
        updated, changed = replace_section_body(source, "Source", "Replacement")
        self.assertTrue(changed)
        self.assertEqual(source.replace("\nReal\n", "\nReplacement\n"), updated)
        self.assertEqual("Replacement", section_body(updated, "Source"))

    def test_section_replacement_preserves_unicode_crlf_neighbors_and_protected_blocks(self) -> None:
        prefix = "# 設計\r\n\r\n```md\r\n## Notes\r\nFake\r\n```\r\n\r\n## Notes\r\n"
        suffix = "## Keep\r\n\r\n<!-- keep -->\r\n\r\n    ## Indented\r\n"
        source = prefix + "\r\nOld 📘\r\n\r\n" + suffix
        updated, changed = replace_section_body(source, "Notes", "New café")
        self.assertTrue(changed)
        self.assertEqual(prefix + "\r\nNew café\r\n\r\n" + suffix, updated)
        self.assertEqual("New café", section_body(updated, "Notes"))

    def test_section_readers_include_nested_heading_content(self) -> None:
        source = "# Title\n\n## Notes\n\nBody\n\n### Detail\n\nNested\n\n## End\n\nLast\n"
        self.assertEqual("Body\n\n### Detail\n\nNested", section_body(source, "Notes"))
        headings, sections = section_lines(source)
        self.assertEqual(["Notes", "End"], headings)
        self.assertEqual(["Body", "", "### Detail", "", "Nested"], sections["Notes"])

    def test_duplicate_sections_are_rejected_by_reads_and_edits(self) -> None:
        source = "## Notes\n\nOne\n\n## Notes\n\nTwo\n"
        for call in (lambda: section_body(source, "Notes"), lambda: section_lines(source), lambda: replace_section_body(source, "Notes", "New")):
            with self.assertRaisesRegex(ValueError, "Duplicate section heading"):
                call()

    def test_h1_edit_preserves_utf8_crlf_and_remaining_source(self) -> None:
        source = "---\r\nlabel: 任意\r\n---\r\n\r\n# 舊標題\r\n\r\n## Notes\r\n\r\nKeep\r\n"
        self.assertEqual("舊標題", h1_title(source))
        updated, changed = replace_h1_title(source, "New 📘")
        self.assertTrue(changed)
        self.assertEqual(source.replace("# 舊標題", "# New 📘"), updated)
        self.assertEqual(("# New", True), replace_h1_title("# Old", "New"))
        with self.assertRaisesRegex(ValueError, "multiple H1"):
            replace_h1_title("# One\n\n# Two\n", "New")
        with self.assertRaisesRegex(ValueError, "multiple H1"):
            h1_title("# One\n\n# Two\n")

    def test_missing_headings_are_noops(self) -> None:
        source = "Plain text\n"
        self.assertIsNone(h1_title(source))
        self.assertIsNone(section_body(source, "Missing"))
        self.assertEqual((source, False), replace_h1_title(source, "New"))
        self.assertEqual((source, False), replace_section_body(source, "Missing", "New"))

    def test_composed_proposals_are_idempotent_and_do_not_write_customer_file(self) -> None:
        source = '---\nowner: "Ada"\n---\n\n# Old\n\n## Notes\n\nOld\n'
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "spec.md"
            path.write_bytes(source.encode("utf-8"))
            updated, _ = patch_frontmatter_fields(source, {"owner": "Grace"})
            updated, _ = replace_h1_title(updated, "New")
            updated, _ = replace_section_body(updated, "Notes", "New")
            self.assertEqual(source.encode("utf-8"), path.read_bytes())
        self.assertEqual((updated, []), patch_frontmatter_fields(updated, {"owner": "Grace"}))
        self.assertEqual((updated, False), replace_h1_title(updated, "New"))
        self.assertEqual((updated, False), replace_section_body(updated, "Notes", "New"))

    def test_invalid_overlapping_and_split_utf8_patch_ranges_are_rejected(self) -> None:
        for patches in ([(-1, 0, b"x")], [(0, 99, b"x")], [(2, 1, b"x")], [(0, 3, b"x"), (2, 4, b"y")], [(1, 2, b"x")]):
            with self.subTest(patches=patches), self.assertRaises(ValueError):
                product_document._patch_bytes("📘text", patches)
        # Earlier offsets are relative to the original source even if later edits shrink it.
        self.assertEqual("AX", product_document._patch_bytes("abcdef", [(0, 1, b"A"), (1, 6, b"X")]))


if __name__ == "__main__":
    unittest.main()
