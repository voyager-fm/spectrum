from pathlib import Path
import tempfile
import unittest
from unittest import mock
import subprocess
import sys

import document_links
from document_links import check_document_links, document_link, document_targets
from document_snapshot import Blocked


def put(root: Path, path: str, text: str) -> None:
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


class SpecificationLinkTests(unittest.TestCase):
    def test_wiki_heading_is_not_a_numbered_markdown_anchor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "target.md", "# Foo\n\n## Foo\n")
            put(root, "README.md", "[[target#Foo-1]]\n\n[valid](target.md#foo-1)\n")
            issues = check_document_links(root)
            self.assertEqual(1, len(issues), issues)
            self.assertIn("missing heading: target.md#Foo-1", issues[0])

    def test_missing_note_embed_is_a_finding(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "README.md", "# Home\n\n![[missing]]\n")
            self.assertEqual(["README.md: missing file: missing.md"], check_document_links(root))

    def test_managed_domain_paths_and_unicode_table_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for domain in ("audio", "video"):
                put(root, f".spectrum/domains/{domain}/domain.md", "# Domain\n\n## 한글 제목\n")
            put(root, ".spectrum/overview.md", "| Link |\n| --- |\n| [[.spectrum/domains/video/domain#한글 제목\\|Label]] |\n")
            self.assertEqual([], check_document_links(root))
            put(root, ".spectrum/overview.md", "[[.spectrum/domains/missing/domain]]")
            self.assertTrue(any("missing file" in issue for issue in check_document_links(root)))

    def test_destinations_share_parser_and_ignore_code_frontmatter_comments(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = "---\ntitle: [[fake]]\n---\n<!-- [[comment]] -->\n\\[[literal]]\n[[.spectrum/real]]\n`[[ignored]]`\n```md\n[[ignored]]\n```"
            self.assertEqual(["real.md"], document_targets(source, Path(".spectrum/source.md"), root))

    def test_unique_short_name_and_asset_extension(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, ".spectrum/unique.md", "# Note")
            self.assertEqual([".spectrum/unique.md", ".spectrum/image.png"], document_targets(
                "[[unique]] [[.spectrum/image.png]]", Path("README.md"), root))

    def test_heading_callback_only_changes_wikilinks(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(["#my-heading", "#Already-Slugged"], document_targets(
                "[[#My Heading]] [normal](#Already-Slugged)", Path("README.md"), Path(directory),
                heading_slug=lambda heading: heading.lower().replace(" ", "-")))

    def test_reference_markdown_links_keep_their_relative_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(["./spec.md"], document_targets(
                "[spec][s]\n\n[s]: ./spec.md\n", Path(".spectrum/source.md"), Path(directory)))

    def test_default_authoring_is_markdown_and_wiki_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = Path(".spectrum/specs/current.md")
            self.assertEqual("[Spec](../a.md)", document_link("Spec", "../a.md", source, root))
            self.assertEqual("[[.spectrum/a#My Heading|Spec]]", document_link(
                "Spec", "../a.md#My Heading", source, root, style="wiki"))
            self.assertEqual("[[#My Heading|Same]]", document_link("Same", "#My Heading", source, root, style="wiki"))
            self.assertEqual("[Contract](../contract.toml)", document_link("Contract", "../contract.toml", source, root, style="wiki"))
            self.assertEqual("[Web](https://example.com/a.md)", document_link("Web", "https://example.com/a.md", source, root, style="wiki"))

    def test_duplicate_short_names_are_explicitly_ambiguous(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, ".spectrum/audio/spec.md", "# Audio")
            put(root, ".spectrum/video/spec.md", "# Video")
            put(root, "README.md", "[[spec]]")
            self.assertTrue(any("Ambiguous" in issue for issue in check_document_links(root)))
            put(root, "README.md", "[[.spectrum/audio/spec]]")
            self.assertEqual([], check_document_links(root))

    def test_managed_dot_directory_markdown_links_are_actually_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "README.md", "[Missing](.spectrum/missing.md)")
            self.assertEqual(["README.md: missing file: .spectrum/missing.md"], check_document_links(root))

    def test_repeated_customer_calls_see_new_notes_and_edits(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            left, right = Path(a), Path(b)
            for root in (left, right):
                put(root, "README.md", "[[unique]]")
            self.assertTrue(check_document_links(left))
            put(left, ".spectrum/unique.md", "# Note")
            self.assertEqual([], check_document_links(left))
            self.assertTrue(check_document_links(right))
            put(left, "README.md", "[[different]]")
            self.assertTrue(check_document_links(left))

    def test_alternative_document_roots_are_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "docs/unique.md", "# Note")
            put(root, "README.md", "[[unique]]")
            self.assertTrue(check_document_links(root))
            self.assertEqual([], check_document_links(root, directories=("docs",)))

    def test_source_symlink_escape_is_blocked_before_reading(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root, foreign = Path(directory), Path(outside)
            put(foreign, "private.md", "# Private")
            (root / ".spectrum").mkdir()
            (root / ".spectrum/escape.md").symlink_to(foreign / "private.md")
            with self.assertRaisesRegex(Blocked, "escapes"):
                check_document_links(root)

    def test_local_targets_outside_repository_are_findings_not_reads(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "README.md", "[Outside](../private.md#secret)\n[[../private#Secret]]")
            issues = check_document_links(root)
            self.assertEqual(2, len(issues), issues)
            self.assertTrue(all("outside repository" in issue for issue in issues))

    def test_external_urls_are_not_local_files_and_bytes_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "README.md"
            before = b"# Home\r\n\r\n[Web](https://example.com/doc.md) [Mail](mailto:demo@example.com)\r\n"
            path.write_bytes(before)
            self.assertEqual([], check_document_links(root))
            self.assertEqual(before, path.read_bytes())

    def test_parser_failure_never_becomes_an_empty_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            put(root, "README.md", "# Home")
            with mock.patch.object(document_links, "_parse_many", side_effect=Blocked("parser unavailable")):
                with self.assertRaisesRegex(Blocked, "parser unavailable"):
                    check_document_links(root)

    def test_cli_distinguishes_no_selection_broken_links_and_invalid_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = Path(document_links.__file__)
            def run(*args):
                return subprocess.run([sys.executable, "-B", str(script), "--root", str(root), *args],
                                      capture_output=True, text=True, check=False)
            empty = run()
            self.assertEqual(0, empty.returncode, empty.stderr)
            self.assertIn("NOT RUN", empty.stdout)
            put(root, ".spectrum/overview.md", "[[missing]]")
            broken = run()
            self.assertEqual(1, broken.returncode, broken.stderr)
            self.assertIn("missing file", broken.stdout)
            blocked = run("--directory", "../outside")
            self.assertEqual(2, blocked.returncode)
            self.assertIn("BLOCKED", blocked.stderr)


if __name__ == "__main__":
    unittest.main()
