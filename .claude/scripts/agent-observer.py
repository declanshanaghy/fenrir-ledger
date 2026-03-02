#!/usr/bin/env python3
"""Fenrir Ledger — Agent output observer

Reads JSONL from stdin, outputs formatted color-coded text.
Usage: tail -f <agent-output.jsonl> | python3 agent-observer.py [--no-color] [--verbose]

Each JSONL line is a record from a Claude Code subagent session.
This script decodes the structured messages and renders them as
readable, color-coded terminal output.
"""

import json
import sys
import argparse
from datetime import datetime
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Norse ANSI color palette
# ---------------------------------------------------------------------------

class Colors:
    """ANSI 24-bit RGB color codes using the Saga Ledger palette."""

    PARCHMENT  = "\033[38;2;240;237;228m"   # Agent text output
    GOLD       = "\033[38;2;201;146;10m"     # Tool calls / accents
    STONE      = "\033[2;38;2;138;133;120m"  # Tool results (dim)
    RAGNAROK   = "\033[38;2;239;68;68m"      # Errors
    ASGARD     = "\033[38;2;10;140;110m"     # Progress markers
    HATI       = "\033[38;2;245;158;11m"     # Warnings / amber
    DIM        = "\033[2m"                   # Timestamps
    BOLD       = "\033[1m"                   # Emphasis
    RESET      = "\033[0m"                   # Reset all


class NoColors:
    """No-op colors when --no-color is active."""

    PARCHMENT  = ""
    GOLD       = ""
    STONE      = ""
    RAGNAROK   = ""
    ASGARD     = ""
    HATI       = ""
    DIM        = ""
    BOLD       = ""
    RESET      = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text to max_len characters, appending ellipsis if needed."""
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[:max_len - 1] + "\u2026"


def truncate_lines(text: str, max_lines: int = 3, max_chars: int = 200) -> str:
    """Truncate to max_lines and max_chars total."""
    lines = text.strip().splitlines()
    kept = lines[:max_lines]
    result = "\n".join(kept)
    if len(lines) > max_lines:
        result += f"\n  \u2026 ({len(lines) - max_lines} more lines)"
    return truncate(result, max_chars)


def format_timestamp(ts_str: Optional[str]) -> str:
    """Extract HH:MM:SS from an ISO timestamp string."""
    if not ts_str:
        return ""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.strftime("%H:%M:%S")
    except (ValueError, TypeError):
        return ""


def extract_agent_id(record: dict) -> str:
    """Extract and shorten the agentId field."""
    agent_id = record.get("agentId", "")
    if len(agent_id) > 12:
        return agent_id[:8] + "\u2026"
    return agent_id


def summarize_tool_use(tool: dict) -> str:
    """Build a one-line summary of a tool_use content block."""
    name = tool.get("name", "unknown")
    inp = tool.get("input", {})

    if name == "Read":
        path = inp.get("file_path", "?")
        return f"{name}({path})"
    elif name in ("Write", "Edit"):
        path = inp.get("file_path", "?")
        return f"{name}({path})"
    elif name == "Bash":
        cmd = inp.get("command", "?")
        return f"{name}({truncate(cmd, 100)})"
    elif name in ("Glob", "Grep"):
        pattern = inp.get("pattern", "?")
        return f"{name}({pattern})"
    elif name == "WebFetch":
        url = inp.get("url", "?")
        return f"{name}({truncate(url, 80)})"
    elif name == "WebSearch":
        query = inp.get("query", "?")
        return f"{name}({truncate(query, 80)})"
    else:
        # Show first key=value from input
        if inp:
            first_key = next(iter(inp))
            first_val = str(inp[first_key])
            return f"{name}({first_key}={truncate(first_val, 60)})"
        return f"{name}()"


# ---------------------------------------------------------------------------
# Record processors
# ---------------------------------------------------------------------------

def process_record(record: dict, c: Any, verbose: bool = False) -> list[str]:
    """Process a single JSONL record and return lines to print.

    Args:
        record: Parsed JSON object from one JSONL line.
        c: Color class (Colors or NoColors).
        verbose: If True, show full tool results instead of truncated.

    Returns:
        List of formatted strings to print. Empty list means skip.
    """
    rec_type = record.get("type", "")
    timestamp = format_timestamp(record.get("timestamp"))
    ts_prefix = f"{c.DIM}[{timestamp}]{c.RESET} " if timestamp else ""

    # -----------------------------------------------------------------------
    # Skip progress heartbeats
    # -----------------------------------------------------------------------
    if rec_type == "progress":
        return []

    # -----------------------------------------------------------------------
    # Assistant messages — the agent is speaking or calling tools
    # -----------------------------------------------------------------------
    if rec_type == "assistant":
        message = record.get("message", {})
        content = message.get("content", [])
        lines: list[str] = []

        if isinstance(content, str):
            # Plain string content from assistant
            lines.append(f"{ts_prefix}{c.PARCHMENT}{truncate(content)}{c.RESET}")
            return lines

        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "text":
                    text = block.get("text", "").strip()
                    if text:
                        lines.append(
                            f"{ts_prefix}{c.PARCHMENT}{text}{c.RESET}"
                        )

                elif block_type == "tool_use":
                    summary = summarize_tool_use(block)
                    lines.append(
                        f"{ts_prefix}{c.GOLD}\U0001f527 {summary}{c.RESET}"
                    )

        return lines

    # -----------------------------------------------------------------------
    # User messages — initial prompt or tool results coming back
    # -----------------------------------------------------------------------
    if rec_type == "user":
        message = record.get("message", {})
        content = message.get("content", "")
        tool_use_result = record.get("toolUseResult")

        # Tool result shortcut field
        if tool_use_result is not None:
            result_text = str(tool_use_result)
            if "error" in result_text.lower() or "is_error" in result_text.lower():
                color = c.RAGNAROK
                prefix = "\u2718"
            else:
                color = c.STONE
                prefix = "\u2190"

            if verbose:
                display = result_text
            else:
                display = truncate_lines(result_text, max_lines=3, max_chars=200)

            lines = []
            for i, line in enumerate(display.splitlines()):
                if i == 0:
                    lines.append(f"{ts_prefix}{color}  {prefix} {line}{c.RESET}")
                else:
                    lines.append(f"{ts_prefix}{color}    {line}{c.RESET}")
            return lines

        # Plain string content — the initial prompt
        if isinstance(content, str):
            return [
                f"{ts_prefix}{c.ASGARD}PROMPT: "
                f"{truncate(content)}{c.RESET}"
            ]

        # Array content — look for tool_result blocks
        if isinstance(content, list):
            lines = []
            for block in content:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "tool_result":
                    result_content = block.get("content", "")
                    is_error = block.get("is_error", False)

                    if is_error:
                        color = c.RAGNAROK
                        prefix = "\u2718"
                    else:
                        color = c.STONE
                        prefix = "\u2190"

                    if isinstance(result_content, str):
                        if verbose:
                            display = result_content
                        else:
                            display = truncate_lines(
                                result_content, max_lines=3, max_chars=200
                            )
                        for i, line in enumerate(display.splitlines()):
                            if i == 0:
                                lines.append(
                                    f"{ts_prefix}{color}  {prefix} {line}{c.RESET}"
                                )
                            else:
                                lines.append(
                                    f"{ts_prefix}{color}    {line}{c.RESET}"
                                )
            return lines

    return []


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fenrir Ledger agent output observer"
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI color codes",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show full tool results instead of truncated",
    )
    args = parser.parse_args()

    c = NoColors if args.no_color else Colors

    # Track the agent ID for the header — print once we see the first record
    header_printed = False

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        # Parse JSON — skip malformed lines silently
        try:
            record = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        # Print header on first valid record
        if not header_printed:
            agent_short = extract_agent_id(record)
            slug = record.get("slug", "")
            branch = record.get("gitBranch", "")
            header_parts = [f"Agent: {agent_short}"]
            if slug:
                header_parts.append(slug)
            if branch:
                header_parts.append(f"branch:{branch}")
            header_text = " | ".join(header_parts)
            bar = "\u2501" * max(40, len(header_text) + 6)
            print(f"\n{c.GOLD}{c.BOLD}{bar}{c.RESET}")
            print(f"{c.GOLD}{c.BOLD}\u2501\u2501\u2501 {header_text} \u2501\u2501\u2501{c.RESET}")
            print(f"{c.GOLD}{c.BOLD}{bar}{c.RESET}\n")
            header_printed = True

        # Process and print
        output_lines = process_record(record, c, verbose=args.verbose)
        for line in output_lines:
            print(line)
            sys.stdout.flush()


if __name__ == "__main__":
    main()
