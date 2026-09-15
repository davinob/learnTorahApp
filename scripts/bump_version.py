#!/usr/bin/env python3
"""Bump pubspec.yaml version before a Play release."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--name",
        help="New version name (x.y.z). If omitted, only the +build number increments.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pubspec = Path("pubspec.yaml")
    text = pubspec.read_text(encoding="utf-8")
    match = re.search(r"^version:\s*([\d.]+)\+(\d+)\s*$", text, re.MULTILINE)
    if not match:
        sys.exit("Could not parse version: line in pubspec.yaml")

    old_name, old_code = match.group(1), int(match.group(2))
    new_name = args.name or old_name
    new_code = old_code + 1
    new_line = f"version: {new_name}+{new_code}"

    if args.dry_run:
        print(f"Would bump {old_name}+{old_code} -> {new_name}+{new_code}")
        return

    pubspec.write_text(
        re.sub(r"^version:\s*.+$", new_line, text, count=1, flags=re.MULTILINE),
        encoding="utf-8",
    )
    print(f"Version: {new_name}+{new_code}")


if __name__ == "__main__":
    main()
