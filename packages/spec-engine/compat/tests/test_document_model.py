from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from document_model import DocumentRepository, parse_texts
from document_snapshot import Blocked

ROOT = Path(__file__).resolve().parents[1]


class DocumentModelTests(unittest.TestCase):
    def test_raw_text_read_is_included_in_worktree_stability(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "-C", str(root), "init"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "fixture@example.com"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Fixture"], check=True)
            path = root / "docs/catalog/data.tsv"
            path.parent.mkdir(parents=True)
            path.write_text("interaction_id\nsample-001\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "fixture"], check=True, capture_output=True)

            repository = DocumentRepository(root, "WORKTREE")
            self.assertIn("sample-001", repository.read("docs/catalog/data.tsv"))
            path.write_text("interaction_id\nsample-002\n", encoding="utf-8")
            with self.assertRaisesRegex(Blocked, "Working-tree input changed during inspection"):
                repository.assert_unchanged()

    def parse(self, text: str) -> dict:
        return parse_texts(ROOT, [text])[0]

    def test_second_document_parse_cannot_replace_first_worktree_digest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "-C", str(root), "init"], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "fixture@example.com"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Fixture"], check=True)
            path = root / "doc.md"
            path.write_text("---\nstatus: drafted\n---\n\n# First\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-m", "fixture"], check=True, capture_output=True)

            repository = DocumentRepository(root, "WORKTREE")
            repository.document("doc.md")
            first = repository.observed_digests()["doc.md"]
            path.write_text("---\nstatus: planned\n---\n\n# Second\n", encoding="utf-8")
            with self.assertRaisesRegex(Blocked, "Working-tree input changed during inspection"):
                repository.document("doc.md", engineering=True)
            self.assertEqual(first, repository.observed_digests()["doc.md"])

    def test_fenced_heading_is_not_a_real_section(self) -> None:
        parsed = self.parse(
            "---\nstatus: drafted\n---\n\n# Title\n\n"
            "## Intent\n\nReal.\n\n"
            "~~~markdown\n## Source\nnot real\n~~~\n\n"
            "## Source\n\nReal source.\n"
        )
        titles = [section["title"] for section in parsed["sections"] if section["level"] == 2]
        self.assertEqual(["Intent", "Source"], titles)
        self.assertTrue(parsed["protected_ranges"])

    def test_frontmatter_ranges_preserve_utf8_offsets(self) -> None:
        source = "---\nstatus: drafted\nsummary: \"한글 😀\"\n---\n\n# 제목\n"
        parsed = self.parse(source)
        fields = {field["key"]: field for field in parsed["metadata_fields"]}
        value_range = fields["summary"]["value_range"]
        encoded = source.encode("utf-8")
        self.assertEqual('"한글 😀"'.encode("utf-8"), encoded[value_range["start"]:value_range["end"]])
        self.assertTrue(fields["summary"]["editable"])

    def test_malformed_yaml_is_reported_not_silently_empty(self) -> None:
        parsed = self.parse("---\nstatus: [\n---\n\n# Title\n")
        self.assertIn("metadata_error", parsed)
        self.assertEqual({}, parsed["metadata"])

    def test_links_have_structured_source_ranges(self) -> None:
        parsed = self.parse("# Title\n\nSee [[docs/example|Example]] and [site](https://example.com).\n")
        self.assertEqual(2, len(parsed["links"]))
        self.assertTrue(all(link["range"] for link in parsed["links"]))


if __name__ == "__main__":
    unittest.main()
