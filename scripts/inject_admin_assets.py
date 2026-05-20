#!/usr/bin/env python3
"""
Inject the admin.css link and admin.js script tag into every
HTML file under assets/html.

Idempotent: running it twice does NOT duplicate the tags. It
detects an existing reference to admin.css / admin.js and skips
the file in that case.

Usage:
    python3 scripts/inject_admin_assets.py            # runs in CWD
    python3 scripts/inject_admin_assets.py --dry-run

The script is intentionally generic: it figures out the relative
path to ./css/admin.css and ./js/admin.js for each HTML file
based on its depth under assets/html (so files at the root use
'css/...' and files inside Bereshit/ use '../css/...').
"""

import argparse
import os
import re
import sys
from pathlib import Path


HTML_ROOT_HINT = os.path.join("assets", "html")


def find_html_root(start: Path) -> Path:
    """Find the assets/html folder by walking up from `start`."""
    cur = start.resolve()
    for _ in range(6):
        candidate = cur / "assets" / "html"
        if candidate.is_dir():
            return candidate
        cur = cur.parent
    raise SystemExit(f"Could not find assets/html starting from {start}")


def relative_prefix(html_file: Path, html_root: Path) -> str:
    """Compute the '../' prefix needed to reach html_root from html_file's folder."""
    depth = len(html_file.parent.resolve().relative_to(html_root.resolve()).parts)
    return "../" * depth if depth else "./"


HEAD_OPEN_RE = re.compile(r"<head\b[^>]*>", re.IGNORECASE)
HTML_OPEN_RE = re.compile(r"<html\b[^>]*>", re.IGNORECASE)
ADMIN_CSS_RE = re.compile(r"admin\.css", re.IGNORECASE)
ADMIN_JS_RE = re.compile(r"admin\.js", re.IGNORECASE)


def build_tags(prefix: str) -> str:
    css = f"<link rel='stylesheet' type='text/css' href='{prefix}css/admin.css'>"
    js = f"<script src='{prefix}js/admin.js'></script>"
    return f"{css}{js}"


def patch_file(path: Path, html_root: Path, dry_run: bool) -> str:
    """Returns one of: 'patched', 'skipped-already', 'skipped-no-head', 'skipped-error'."""
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1")

    if ADMIN_CSS_RE.search(text) and ADMIN_JS_RE.search(text):
        return "skipped-already"

    prefix = relative_prefix(path, html_root)
    tags = build_tags(prefix)

    head_match = HEAD_OPEN_RE.search(text)
    if head_match:
        insert_at = head_match.end()
        new_text = text[:insert_at] + tags + text[insert_at:]
    else:
        # No <head>: inject right after <html...> or at the very top.
        html_match = HTML_OPEN_RE.search(text)
        if html_match:
            insert_at = html_match.end()
            new_text = text[:insert_at] + "<head>" + tags + "</head>" + text[insert_at:]
        else:
            new_text = "<head>" + tags + "</head>" + text

    if not dry_run:
        path.write_text(new_text, encoding="utf-8")
    return "patched"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(),
                        help="Project root (defaults to CWD).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Don't write files, just report.")
    args = parser.parse_args()

    html_root = find_html_root(args.root)
    print(f"[inject_admin_assets] html root: {html_root}")

    counts = {"patched": 0, "skipped-already": 0, "skipped-no-head": 0}
    for path in sorted(html_root.rglob("*.html")):
        result = patch_file(path, html_root, args.dry_run)
        counts[result] = counts.get(result, 0) + 1
        if result == "patched":
            print(f"  + {path.relative_to(html_root)}")
        elif result == "skipped-already":
            pass  # quiet
        else:
            print(f"  ? {path.relative_to(html_root)} -> {result}")

    print(f"[inject_admin_assets] done. {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
