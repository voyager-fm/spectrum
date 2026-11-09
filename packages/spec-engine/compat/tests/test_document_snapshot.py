from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.document_snapshot import Blocked, Snapshot


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True)
    return result.stdout.strip()


class DocumentSnapshotTests(unittest.TestCase):
    def repo(self) -> tuple[tempfile.TemporaryDirectory, Path]:
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        git(root, "init")
        git(root, "config", "user.email", "fixture@example.com")
        git(root, "config", "user.name", "Fixture")
        (root / "doc.md").write_text("committed\n", encoding="utf-8")
        git(root, "add", "doc.md")
        git(root, "commit", "-m", "fixture")
        return tmp, root

    def test_commit_index_and_worktree_are_distinct(self) -> None:
        tmp, root = self.repo()
        with tmp:
            (root / "doc.md").write_text("staged\n", encoding="utf-8")
            git(root, "add", "doc.md")
            (root / "doc.md").write_text("worktree\n", encoding="utf-8")
            self.assertEqual("committed\n", Snapshot(root, "HEAD").read("doc.md"))
            self.assertEqual("staged\n", Snapshot(root, "INDEX").read("doc.md"))
            self.assertEqual("worktree\n", Snapshot(root, "WORKTREE").read("doc.md"))

    def test_worktree_change_after_read_is_blocked(self) -> None:
        tmp, root = self.repo()
        with tmp:
            snapshot = Snapshot(root, "WORKTREE")
            digest = snapshot.digest("doc.md")
            (root / "doc.md").write_text("changed\n", encoding="utf-8")
            with self.assertRaises(Blocked):
                snapshot.assert_unchanged({"doc.md": digest})

    def test_secret_path_is_not_read(self) -> None:
        tmp, root = self.repo()
        with tmp:
            (root / ".env").write_text("secret\n", encoding="utf-8")
            with self.assertRaises(Blocked):
                Snapshot(root, "WORKTREE").read(".env")


if __name__ == "__main__":
    unittest.main()
