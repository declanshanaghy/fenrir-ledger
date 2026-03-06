#!/usr/bin/env python3
"""Tests for the rm command detection logic in pre_tool_use.py."""

import sys
import os
import importlib.util
import types

# Import just the functions we need without triggering the full module import chain
_hooks_dir = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("_pre_tool_use_raw", os.path.join(_hooks_dir, "pre_tool_use.py"))

# Read the source and exec only the functions we need (avoids utils.constants import)
import re
_source = open(os.path.join(_hooks_dir, "pre_tool_use.py")).read()

# Extract the two functions we need by exec-ing them with minimal globals
_ns = {"re": re, "__builtins__": __builtins__}
# Extract function source blocks
for func_name in ["_split_compound_command", "is_dangerous_rm_command"]:
    start = _source.index(f"def {func_name}(")
    # Find the next top-level def or end of file
    next_def = _source.find("\ndef ", start + 1)
    if next_def == -1:
        func_source = _source[start:]
    else:
        func_source = _source[start:next_def]
    exec(func_source, _ns)

is_dangerous_rm_command = _ns["is_dangerous_rm_command"]

ALLOWED = ['trees/']


def test(description, command, expected_dangerous, allowed_dirs=None):
    if allowed_dirs is None:
        allowed_dirs = ALLOWED
    result = is_dangerous_rm_command(command, allowed_dirs)
    status = "PASS" if result == expected_dangerous else "FAIL"
    label = "BLOCKED" if result else "ALLOWED"
    expected_label = "BLOCKED" if expected_dangerous else "ALLOWED"
    if status == "FAIL":
        print(f"  {status}: {description}")
        print(f"         Command:  {command}")
        print(f"         Expected: {expected_label}, Got: {label}")
    else:
        print(f"  {status}: {description} → {label}")
    return status == "PASS"


def main():
    passed = 0
    failed = 0
    results = []

    print("=== Single file deletes (should be ALLOWED) ===")
    results.append(test("rm single file in repo", "rm specs/foo.md", False))
    results.append(test("rm file with hyphens in name", "rm specs/dev-setup-restructure-orchestration.md", False))
    results.append(test("rm file with dots", "rm some.file.txt", False))
    results.append(test("rm with -f flag (no recursive)", "rm -f specs/foo.md", False))
    results.append(test("rm with -i flag", "rm -i old-file.txt", False))

    print("\n=== Git commands (should be ALLOWED) ===")
    results.append(test("git rm file", "git rm specs/foo.md", False))
    results.append(test("git rm with -f", "git rm -f specs/foo.md", False))
    results.append(test("git rm cached", "git rm --cached specs/foo.md", False))
    results.append(test("git clean -fd", "git clean -fd", False))
    results.append(test("git clean -fxd", "git clean -fxd", False))

    print("\n=== Catastrophic deletes (should be BLOCKED) ===")
    results.append(test("rm -rf /", "rm -rf /", True))
    results.append(test("rm -rf ~", "rm -rf ~", True))
    results.append(test("rm -rf ~/", "rm -rf ~/", True))
    results.append(test("rm -rf .", "rm -rf .", True))
    results.append(test("rm -rf ..", "rm -rf ..", True))
    results.append(test("rm -rf /*", "rm -rf /*", True))
    results.append(test("rm -fr /", "rm -fr /", True))
    results.append(test("rm -Rf /", "rm -Rf /", True))
    results.append(test("rm --recursive --force /", "rm --recursive --force /", True))
    results.append(test("rm --force --recursive /", "rm --force --recursive /", True))
    results.append(test("rm -r -f /tmp", "rm -r -f /tmp", True))

    print("\n=== Allowed directory deletes (should be ALLOWED) ===")
    results.append(test("rm -rf trees/my-worktree", "rm -rf trees/my-worktree", False))
    results.append(test("rm -rf ./trees/my-worktree", "rm -rf ./trees/my-worktree", False))
    results.append(test("rm -rf trees/foo trees/bar", "rm -rf trees/foo trees/bar", False))

    print("\n=== Bulk directory deletes in repo (should be BLOCKED) ===")
    results.append(test("rm -rf development/", "rm -rf development/", True))
    results.append(test("rm -rf src/", "rm -rf src/", True))
    results.append(test("rm -rf node_modules/", "rm -rf node_modules/", True))

    print("\n=== Compound commands ===")
    results.append(test("safe && dangerous", "echo hi && rm -rf /", True))
    results.append(test("git rm in compound", "git rm foo.md && echo done", False))
    results.append(test("mixed: allowed tree + dangerous", "rm -rf trees/foo && rm -rf /", True))

    print("\n=== Edge cases ===")
    results.append(test("sudo rm -rf /", "sudo rm -rf /", True))
    results.append(test("empty command", "", False))
    results.append(test("no rm at all", "ls -la", False))
    results.append(test("rm with no args", "rm", False))

    # The original bug: filenames with hyphens and dots falsely triggering detection
    print("\n=== Original bug: filenames with hyphens/dots ===")
    results.append(test(
        "rm file with -restructure in name (was falsely blocked)",
        "rm specs/dev-setup-restructure-orchestration.md",
        False
    ))
    results.append(test(
        "git rm file with -restructure in name (was falsely blocked)",
        "git rm specs/dev-setup-restructure-orchestration.md",
        False
    ))

    passed = sum(1 for r in results if r)
    failed = sum(1 for r in results if not r)
    total = len(results)

    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)
    else:
        print("All tests passed!")
        sys.exit(0)


if __name__ == '__main__':
    main()
