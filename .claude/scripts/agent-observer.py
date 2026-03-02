#!/usr/bin/env python3
"""Fenrir Ledger -- Agent output observer (Norse Messenger Bubble format)

Reads JSONL from stdin, outputs formatted Norse-themed chat bubbles.
Usage: tail -f <agent-output.jsonl> | python3 agent-observer.py [--no-color] [--verbose]

Each JSONL line is a record from a Claude Code subagent session.
This script decodes the structured messages and renders them as
messenger-style chat bubbles with Elder Futhark rune accents.
"""

import json
import os
import sys
import argparse
import textwrap
from datetime import datetime
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Norse ANSI color palette
# ---------------------------------------------------------------------------

class Colors:
    """ANSI 24-bit RGB color codes using the Saga Ledger palette."""

    PARCHMENT = "\033[38;2;240;237;228m"    # Agent text inside bubbles
    GOLD      = "\033[38;2;201;146;10m"     # Agent bubble border
    STONE     = "\033[38;2;138;133;120m"    # Tool bubble border (normal)
    STONE_DIM = "\033[2;38;2;138;133;120m"  # Tool result text (dim)
    RAGNAROK  = "\033[38;2;239;68;68m"      # Error bubble border + text
    ASGARD    = "\033[38;2;10;140;110m"     # Prompt bubble border
    DIM       = "\033[2m"                   # Timestamps
    BOLD      = "\033[1m"                   # Emphasis
    RESET     = "\033[0m"                   # Reset all


class NoColors:
    """No-op colors when --no-color is active."""

    PARCHMENT = ""
    GOLD      = ""
    STONE     = ""
    STONE_DIM = ""
    RAGNAROK  = ""
    ASGARD    = ""
    DIM       = ""
    BOLD      = ""
    RESET     = ""


# ---------------------------------------------------------------------------
# Rune assignments per tool type
# ---------------------------------------------------------------------------

TOOL_RUNES: dict[str, str] = {
    "Read":  "\u16b1",   # Raidho -- journey/search
    "Glob":  "\u16b1",   # Raidho
    "Grep":  "\u16b1",   # Raidho
    "Write": "\u16a0",   # Fehu -- creation/wealth
    "Edit":  "\u16a0",   # Fehu
    "Bash":  "\u16b2",   # Kenaz -- torch/action
}
DEFAULT_TOOL_RUNE = "\u16d6"  # Ehwaz -- partnership


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_terminal_width() -> int:
    """Return terminal column count, defaulting to 100."""
    try:
        return os.get_terminal_size().columns
    except (ValueError, OSError):
        return 100


def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text, appending ellipsis if needed."""
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[:max_len - 1] + "\u2026"


def format_timestamp(ts_str: Optional[str]) -> str:
    """Extract HH:MM:SS from an ISO timestamp string."""
    if not ts_str:
        return ""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.strftime("%H:%M:%S")
    except (ValueError, TypeError):
        return ""


def extract_agent_id(record: dict[str, Any]) -> str:
    """Extract and shorten the agentId field."""
    agent_id = record.get("agentId", "")
    if len(agent_id) > 12:
        return agent_id[:8] + "\u2026"
    return agent_id


def tool_rune(name: str) -> str:
    """Return the Elder Futhark rune for a given tool name."""
    return TOOL_RUNES.get(name, DEFAULT_TOOL_RUNE)


def summarize_tool_params(tool: dict[str, Any]) -> list[str]:
    """Return parameter summary lines for a tool_use block."""
    name = tool.get("name", "unknown")
    inp = tool.get("input", {})

    if name == "Read":
        path = inp.get("file_path", "?")
        return [shorten_path(path)]
    elif name in ("Write", "Edit"):
        path = inp.get("file_path", "?")
        return [shorten_path(path)]
    elif name == "Bash":
        cmd = inp.get("command", "?")
        desc = inp.get("description", "")
        lines = []
        if desc:
            lines.append(desc)
        else:
            lines.append(truncate(cmd, 80))
        return lines
    elif name in ("Glob", "Grep"):
        pattern = inp.get("pattern", "?")
        return [pattern]
    elif name == "WebFetch":
        return [truncate(inp.get("url", "?"), 60)]
    elif name == "WebSearch":
        return [truncate(inp.get("query", "?"), 60)]
    else:
        if inp:
            first_key = next(iter(inp))
            first_val = str(inp[first_key])
            return [f"{first_key}={truncate(first_val, 50)}"]
        return []


def shorten_path(path: str, max_len: int = 50) -> str:
    """Shorten a file path to at most max_len chars, keeping the tail."""
    if len(path) <= max_len:
        return path
    # Keep the last max_len-3 characters with a leading ellipsis
    return "\u2026" + path[-(max_len - 1):]


def summarize_tool_result(result_text: str) -> str:
    """Create a brief summary of a tool result for the result bubble."""
    lines = result_text.strip().splitlines()
    n = len(lines)
    char_count = len(result_text.strip())
    if n == 0:
        return "(empty)"
    if char_count < 60:
        # Short enough to show directly
        return truncate(result_text.strip(), 55)
    return f"{n} lines, {char_count} chars"


# ---------------------------------------------------------------------------
# Bubble renderer
# ---------------------------------------------------------------------------

class BubbleRenderer:
    """Renders Norse messenger-style chat bubbles."""

    def __init__(self, c: Any, term_width: int) -> None:
        self.c = c
        self.term_width = term_width
        # Agent bubbles: up to width - 5
        self.agent_max_width = max(40, term_width - 5)
        # Tool bubbles: max 40 chars wide
        self.tool_max_width = 40

    def _wrap_text(self, text: str, inner_width: int) -> list[str]:
        """Word-wrap text to fit inside a bubble (between borders)."""
        wrapped: list[str] = []
        for paragraph in text.splitlines():
            paragraph = paragraph.strip()
            if not paragraph:
                wrapped.append("")
                continue
            wrapped.extend(textwrap.wrap(
                paragraph,
                width=inner_width,
                break_long_words=True,
                break_on_hyphens=False,
            ))
        return wrapped

    def _build_bubble(
        self,
        header: str,
        body_lines: list[str],
        max_width: int,
        border_color: str,
        text_color: str,
        align: str = "left",
    ) -> list[str]:
        """Build a complete bubble as a list of terminal lines.

        Args:
            header: Text for the top border (e.g. "ᚲ AgentName").
            body_lines: Pre-wrapped text lines for inside the bubble.
            max_width: Maximum total bubble width including borders.
            border_color: ANSI code for the box-drawing chars.
            text_color: ANSI code for the text inside.
            align: "left" or "right" alignment.

        Returns:
            List of strings ready to print.
        """
        c = self.c
        # inner_width = max_width - 4 (for "| " and " |")
        inner_width = max_width - 4
        if inner_width < 10:
            inner_width = 10

        # Re-wrap all body lines to inner_width
        rewrapped: list[str] = []
        for line in body_lines:
            if not line:
                rewrapped.append("")
            else:
                rewrapped.extend(textwrap.wrap(
                    line,
                    width=inner_width,
                    break_long_words=True,
                    break_on_hyphens=False,
                ))

        # Compute actual bubble width from content
        max_content = max(
            (len(line) for line in rewrapped),
            default=0,
        )
        header_len = len(header)
        # bubble_width includes the 4 chars for borders
        bubble_width = min(
            max_width,
            max(max_content, header_len) + 4,
        )
        # Ensure at least header fits
        if bubble_width < header_len + 6:
            bubble_width = min(max_width, header_len + 6)

        actual_inner = bubble_width - 4

        # Build the box lines
        # Top: ╭─ header ──...─╮
        header_dashes = bubble_width - 4 - len(header) - 1
        if header_dashes < 1:
            header_dashes = 1
        top = f"\u256d\u2500 {header} " + "\u2500" * header_dashes + "\u256e"

        # Bottom: ╰──...──╯
        bottom = "\u2570" + "\u2500" * (bubble_width - 2) + "\u256f"

        # Body lines, padded
        body_rendered: list[str] = []
        for line in rewrapped:
            padded = line.ljust(actual_inner)
            body_rendered.append(f"\u2502 {padded} \u2502")

        # Compute left margin for right-alignment
        if align == "right":
            margin = max(0, self.term_width - bubble_width)
        else:
            margin = 0

        pad = " " * margin
        output: list[str] = []
        output.append(f"{pad}{border_color}{top}{c.RESET}")
        for rendered_line in body_rendered:
            # Color the border chars, text gets text_color
            # Split into border prefix, content, border suffix
            output.append(
                f"{pad}{border_color}\u2502 {c.RESET}"
                f"{text_color}{rendered_line[2:-2]}{c.RESET}"
                f"{border_color} \u2502{c.RESET}"
            )
        output.append(f"{pad}{border_color}{bottom}{c.RESET}")
        return output

    def render_header(self, record: dict[str, Any]) -> list[str]:
        """Render the session header bar."""
        c = self.c
        agent_short = extract_agent_id(record)
        branch = record.get("gitBranch", "")
        slug = record.get("slug", "")

        parts = [f"\u16df Agent: {agent_short}"]
        if slug:
            parts.append(slug)
        if branch:
            parts.append(f"branch: {branch}")
        header_text = " \u00b7 ".join(parts)
        bar_len = max(40, len(header_text) + 6)
        bar = "\u2501" * bar_len

        return [
            "",
            f"{c.GOLD}{c.BOLD}{bar}{c.RESET}",
            f"{c.GOLD}{c.BOLD}\u2501\u2501\u2501 {header_text} \u2501\u2501\u2501{c.RESET}",
            f"{c.GOLD}{c.BOLD}{bar}{c.RESET}",
            "",
        ]

    def render_prompt(self, text: str, timestamp: str) -> list[str]:
        """Render the initial prompt bubble (left-aligned, teal border)."""
        c = self.c
        lines = text.strip().splitlines()[:3]
        if len(text.strip().splitlines()) > 3:
            lines.append("\u2026")

        ts_line = f"{c.DIM}[{timestamp}]{c.RESET}" if timestamp else ""
        bubble = self._build_bubble(
            header="\u16df Prompt",
            body_lines=lines,
            max_width=self.agent_max_width,
            border_color=c.ASGARD,
            text_color=c.PARCHMENT,
            align="left",
        )
        result = []
        if ts_line:
            result.append(ts_line)
        result.extend(bubble)
        return result

    def render_agent_text(
        self, text: str, timestamp: str, agent_name: str
    ) -> list[str]:
        """Render agent thinking/speaking bubble (left-aligned, gold border)."""
        c = self.c
        body_lines = text.strip().splitlines()

        ts_line = f"{c.DIM}[{timestamp}]{c.RESET}" if timestamp else ""
        bubble = self._build_bubble(
            header=f"\u16b2 {agent_name}",
            body_lines=body_lines,
            max_width=self.agent_max_width,
            border_color=c.GOLD,
            text_color=c.PARCHMENT,
            align="left",
        )
        result = []
        if ts_line:
            result.append(ts_line)
        result.extend(bubble)
        return result

    def render_tool_call(
        self, tool: dict[str, Any], timestamp: str
    ) -> list[str]:
        """Render a tool call bubble (right-aligned, stone border)."""
        c = self.c
        name = tool.get("name", "unknown")
        rune = tool_rune(name)
        params = summarize_tool_params(tool)

        ts_line = f"{c.DIM}[{timestamp}]{c.RESET}" if timestamp else ""
        bubble = self._build_bubble(
            header=f"{rune} {name}",
            body_lines=params,
            max_width=self.tool_max_width,
            border_color=c.STONE,
            text_color=c.STONE_DIM,
            align="right",
        )
        result = []
        if ts_line:
            # Right-align the timestamp too
            margin = max(0, self.term_width - 12)
            result.append(f"{' ' * margin}{c.DIM}[{timestamp}]{c.RESET}")
        result.extend(bubble)
        return result

    def render_tool_result(
        self,
        result_text: str,
        is_error: bool,
        timestamp: str,
        verbose: bool = False,
    ) -> list[str]:
        """Render a tool result bubble (right-aligned, small)."""
        c = self.c
        if is_error:
            border_color = c.RAGNAROK
            text_color = c.RAGNAROK
            prefix = "\u2718"
        else:
            border_color = c.STONE
            text_color = c.STONE_DIM
            prefix = "\u2713"

        if verbose:
            body = result_text.strip().splitlines()
        else:
            summary = summarize_tool_result(result_text)
            body = [summary]

        bubble = self._build_bubble(
            header=f"{prefix} result",
            body_lines=body,
            max_width=self.tool_max_width,
            border_color=border_color,
            text_color=text_color,
            align="right",
        )
        return bubble

    def render_error(self, text: str, timestamp: str) -> list[str]:
        """Render an error bubble (left-aligned, red border)."""
        c = self.c
        body_lines = text.strip().splitlines()

        ts_line = f"{c.DIM}[{timestamp}]{c.RESET}" if timestamp else ""
        bubble = self._build_bubble(
            header="\u26a0 Error",
            body_lines=body_lines,
            max_width=self.agent_max_width,
            border_color=c.RAGNAROK,
            text_color=c.RAGNAROK,
            align="left",
        )
        result = []
        if ts_line:
            result.append(ts_line)
        result.extend(bubble)
        return result


# ---------------------------------------------------------------------------
# Record processors
# ---------------------------------------------------------------------------

def process_record(
    record: dict[str, Any],
    renderer: BubbleRenderer,
    agent_name: str,
    verbose: bool = False,
) -> list[str]:
    """Process a single JSONL record and return lines to print.

    Args:
        record: Parsed JSON object from one JSONL line.
        renderer: BubbleRenderer instance.
        agent_name: Short agent identifier for bubble headers.
        verbose: If True, show full tool results instead of summaries.

    Returns:
        List of formatted strings to print. Empty list means skip.
    """
    rec_type = record.get("type", "")
    timestamp = format_timestamp(record.get("timestamp"))

    # -------------------------------------------------------------------
    # Skip progress heartbeats
    # -------------------------------------------------------------------
    if rec_type == "progress":
        return []

    # -------------------------------------------------------------------
    # Assistant messages -- agent speaking or calling tools
    # -------------------------------------------------------------------
    if rec_type == "assistant":
        message = record.get("message", {})
        content = message.get("content", [])
        lines: list[str] = []

        if isinstance(content, str):
            lines.extend(renderer.render_agent_text(
                content, timestamp, agent_name
            ))
            return lines

        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "text":
                    text = block.get("text", "").strip()
                    if text:
                        lines.extend(renderer.render_agent_text(
                            text, timestamp, agent_name
                        ))

                elif block_type == "tool_use":
                    lines.extend(renderer.render_tool_call(
                        block, timestamp
                    ))

        return lines

    # -------------------------------------------------------------------
    # User messages -- initial prompt or tool results
    # -------------------------------------------------------------------
    if rec_type == "user":
        message = record.get("message", {})
        content = message.get("content", "")
        tool_use_result = record.get("toolUseResult")

        # Tool result shortcut field
        if tool_use_result is not None:
            result_text = str(tool_use_result)
            is_error = (
                "error" in result_text.lower()
                or "is_error" in result_text.lower()
            )
            return renderer.render_tool_result(
                result_text, is_error, timestamp, verbose
            )

        # Plain string content -- the initial prompt
        if isinstance(content, str):
            return renderer.render_prompt(content, timestamp)

        # Array content -- look for tool_result blocks
        if isinstance(content, list):
            lines = []
            for block in content:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "tool_result":
                    result_content = block.get("content", "")
                    is_error = block.get("is_error", False)

                    if isinstance(result_content, str):
                        lines.extend(renderer.render_tool_result(
                            result_content, is_error, timestamp, verbose
                        ))
            return lines

    return []


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    """Entry point: parse args, read JSONL from stdin, render bubbles."""
    parser = argparse.ArgumentParser(
        description="Fenrir Ledger agent output observer (Norse Messenger Bubbles)"
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI color codes",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show full tool results instead of summaries",
    )
    args = parser.parse_args()

    c = NoColors if args.no_color else Colors
    term_width = get_terminal_width()
    renderer = BubbleRenderer(c, term_width)

    # Track the agent ID for the header -- print once we see the first record
    header_printed = False
    agent_name = "Agent"

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        # Parse JSON -- skip malformed lines silently
        try:
            record = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        # Print header on first valid record
        if not header_printed:
            agent_name = extract_agent_id(record)
            slug = record.get("slug", "")
            if slug:
                agent_name = slug
            for header_line in renderer.render_header(record):
                print(header_line)
                sys.stdout.flush()
            header_printed = True

        # Process and print
        output_lines = process_record(
            record, renderer, agent_name, verbose=args.verbose
        )
        for line in output_lines:
            print(line)
            sys.stdout.flush()


if __name__ == "__main__":
    main()
