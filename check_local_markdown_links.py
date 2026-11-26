"""Offline, read-only checker for local Markdown file links (no HTTP requests)."""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\s*\)")
SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
FENCE = re.compile(r"^\s*(`{3,}|~{3,})")


def missing_links(root: Path, markdown: Path) -> list[str]:
    failures = []
    fence_char = None
    fence_len = 0
    for number, line in enumerate(markdown.read_text(encoding="utf-8").splitlines(), 1):
        fence = FENCE.match(line)
        if fence:
            token = fence.group(1)
            if fence_char is None:
                fence_char, fence_len = token[0], len(token)
            elif token[0] == fence_char and len(token) >= fence_len:
                fence_char, fence_len = None, 0
            continue
        if fence_char is not None:
            continue
        for match in LINK.finditer(line):
            target = (match.group(1) or match.group(2)).strip()
            if not target or target.startswith(("#", "//")) or SCHEME.match(target):
                continue
            path = unquote(urlsplit(target).path)
            if not path:
                continue
            resolved = (root / path.lstrip("/")) if path.startswith("/") else (markdown.parent / path)
            if not resolved.exists():
                failures.append(f"{markdown.relative_to(root)}:{number}: {target}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.root.resolve()
    tracked = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--", "*.md", "**/*.md"],
        capture_output=True, check=True,
    ).stdout
    paths = sorted({root / p.decode("utf-8") for p in tracked.split(b"\0") if p})
    failures = []
    for path in paths:
        if path.is_file():
            failures.extend(missing_links(root, path))
    print(f"Checked {len(paths)} tracked Markdown files for local targets.")
    for failure in failures:
        print(f"MISSING {failure}")
    print(f"Missing local link targets: {len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
