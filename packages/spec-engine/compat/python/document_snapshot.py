"""Read-only Git snapshots shared by documentation validators."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess


class Blocked(RuntimeError):
    """Required evidence could not be inspected; never translate into a pass."""


def git(root: Path, *args: str) -> bytes:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            check=False,
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Blocked("Git evidence is unavailable") from error
    if result.returncode:
        raise Blocked("Git evidence command failed: " + (args[0] if args else "git"))
    return result.stdout


def relative_path(value: str) -> bool:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        return False
    path = PurePosixPath(value)
    return not path.is_absolute() and ".." not in path.parts and str(path) == value and value != "."


def is_secret_path(path: str) -> bool:
    return any(
        part == ".env" or (part.startswith(".env.") and part != ".env.example")
        for part in PurePosixPath(path).parts
    )


class Snapshot:
    """One declared commit, index, or working-tree view. No checkout or code execution."""

    def __init__(self, root: Path, revision: str = "HEAD") -> None:
        self.root = root.resolve()
        actual = Path(git(self.root, "rev-parse", "--show-toplevel").decode().strip()).resolve()
        if actual != self.root:
            raise Blocked("Snapshot path must be the repository root")
        self.mode = revision if revision in ("INDEX", "WORKTREE") else "COMMIT"
        self.cache: dict[str, str] = {}
        self.entries: dict[str, tuple[str, str]] = {}
        if self.mode == "COMMIT":
            self.revision = git(
                self.root,
                "rev-parse",
                "--verify",
                "--end-of-options",
                revision + "^{commit}",
            ).decode().strip()
            raw = git(self.root, "ls-tree", "-r", "-z", self.revision)
            for record in raw.split(b"\0"):
                if not record:
                    continue
                header, name = record.split(b"\t", 1)
                mode, _kind, sha = header.decode().split()
                self.entries[name.decode()] = (mode, sha)
        else:
            raw = git(self.root, "ls-files", "--stage", "-z")
            for record in raw.split(b"\0"):
                if not record:
                    continue
                header, name = record.split(b"\t", 1)
                mode, sha, stage = header.decode().split()
                if stage != "0":
                    raise Blocked("Unmerged index cannot supply a coherent snapshot")
                self.entries[name.decode()] = (mode, sha)
            if self.mode == "WORKTREE":
                for name in git(
                    self.root, "ls-files", "--others", "--exclude-standard", "-z"
                ).split(b"\0"):
                    if name:
                        self.entries[name.decode()] = ("100644", "untracked")
                self.revision = "WORKTREE:" + git(self.root, "rev-parse", "HEAD").decode().strip()
            else:
                self.revision = "INDEX:" + hashlib.sha256(raw).hexdigest()

    def files(self) -> list[str]:
        if self.mode != "WORKTREE":
            return sorted(self.entries)
        return sorted(
            path
            for path in self.entries
            if (self.root / path).exists() or (self.root / path).is_symlink()
        )

    def exists(self, path: str) -> bool:
        if not relative_path(path) or is_secret_path(path):
            raise Blocked("Unsafe or secret source path is not inspected")
        if self.mode == "WORKTREE":
            target = self.root / path
            if not target.resolve().is_relative_to(self.root) or target.is_symlink():
                raise Blocked("Symlink source evidence is unsupported")
            return target.exists()
        if path in self.entries and self.entries[path][0] == "120000":
            raise Blocked("Symlink source evidence is unsupported")
        return path in self.entries or any(item.startswith(path + "/") for item in self.entries)

    def read_bytes(self, path: str) -> bytes:
        if not relative_path(path) or is_secret_path(path):
            raise Blocked("Unsafe or secret source path is not inspected")
        if self.mode == "WORKTREE":
            target = self.root / path
            if not target.resolve().is_relative_to(self.root) or target.is_symlink():
                raise Blocked("Symlink source evidence is unsupported")
            try:
                return target.read_bytes()
            except OSError as error:
                raise Blocked("Source file cannot be read") from error
        entry = self.entries.get(path)
        if entry is None or entry[0] not in ("100644", "100755"):
            raise Blocked("Source must be a regular tracked file, not a symlink/gitlink")
        return git(self.root, "cat-file", "blob", entry[1])

    def read(self, path: str) -> str:
        if path in self.cache:
            return self.cache[path]
        data = self.read_bytes(path)
        if len(data) > 2_000_000:
            raise Blocked("Source exceeds the text inspection limit")
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise Blocked("Source is not UTF-8 text") from error
        self.cache[path] = text
        return text

    def digest(self, path: str) -> str:
        return hashlib.sha256(self.read_bytes(path)).hexdigest()

    def scoped_entries(self, paths: list[str]) -> dict[str, tuple[str, str]]:
        result: dict[str, tuple[str, str]] = {}
        for path in self.files():
            if is_secret_path(path) or not any(
                path == prefix or path.startswith(prefix + "/") for prefix in paths
            ):
                continue
            mode, sha = self.entries[path]
            if self.mode == "WORKTREE":
                target = self.root / path
                if target.is_symlink() or not target.resolve().is_relative_to(self.root):
                    raise Blocked("Watched source includes an unsupported symlink")
                if target.is_dir():
                    result[path] = (mode, sha)
                    continue
                data = target.read_bytes()
                sha = hashlib.sha1(
                    b"blob " + str(len(data)).encode() + b"\0" + data
                ).hexdigest()
                mode = "100755" if target.stat().st_mode & 0o111 else "100644"
            result[path] = (mode, sha)
        return result

    def assert_unchanged(self, observed: dict[str, str]) -> None:
        if self.mode != "WORKTREE":
            return
        for path, expected in observed.items():
            if not self.exists(path) or self.digest(path) != expected:
                raise Blocked("Working-tree input changed during inspection: " + path)


def scope_digest(entries: dict[str, tuple[str, str]]) -> str:
    return hashlib.sha256(
        json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
