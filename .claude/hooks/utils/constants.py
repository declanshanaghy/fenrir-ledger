#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
Constants and shared utilities for Claude Code Hooks.
"""

import json
import os
import subprocess
import threading
from pathlib import Path

# Base directory for all logs
# Default is 'logs' in the current working directory
LOG_BASE_DIR = os.environ.get("CLAUDE_HOOKS_LOG_DIR", "logs")

def get_session_log_dir(session_id: str) -> Path:
    """
    Get the log directory for a specific session.
    
    Args:
        session_id: The Claude session ID
        
    Returns:
        Path object for the session's log directory
    """
    return Path(LOG_BASE_DIR) / session_id

def ensure_session_log_dir(session_id: str) -> Path:
    """
    Ensure the log directory for a session exists.

    Args:
        session_id: The Claude session ID

    Returns:
        Path object for the session's log directory
    """
    log_dir = get_session_log_dir(session_id)
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


# Absolute path to send_event.py, resolved once at import time.
_SEND_EVENT_SCRIPT = str(Path(__file__).resolve().parent.parent / "send_event.py")


def _write_and_close(proc: subprocess.Popen, payload_bytes: bytes) -> None:
    """Write payload to subprocess stdin in a background thread.

    Runs as a daemon thread so the parent hook returns immediately even when
    the payload exceeds the OS pipe buffer (~64 KB on macOS).
    """
    try:
        proc.stdin.write(payload_bytes)
        proc.stdin.close()
    except Exception:
        pass


def _get_git_branch() -> str:
    """Get current git branch name, or empty string on failure."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=3,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def _resolve_source_app(input_data: dict, default: str) -> str:
    """Build a dynamic source_app for subagents: {agent}-{branch}-{sid_short}.

    Resolution order for agent name:
      1. CLAUDE_AGENT_NAME env var
      2. input_data["agent_type"]

    The first 8 chars of the session_id are appended to disambiguate
    multiple agents of the same type running on the same branch.

    If an agent identity is detected, returns "{agent}-{branch}-{sid}" (or
    just "{agent}" if the branch can't be determined).  Otherwise returns
    *default*.
    """
    agent = (
        os.environ.get("CLAUDE_AGENT_NAME", "")
        or input_data.get("agent_type", "")
    )
    if not agent:
        return default

    branch = _get_git_branch()
    session_id = input_data.get("session_id", "")
    sid_short = session_id[:8] if session_id else ""

    base = f"{agent}-{branch}" if branch else agent
    return f"{base}-{sid_short}" if sid_short else base


def fire_and_forget_send_event(
    input_data: dict,
    event_type: str,
    source_app: str = "fenrir-ledger",
    extra_args: list = None,
) -> None:
    """
    Spawn send_event.py as a fire-and-forget subprocess.

    The child process inherits the current environment but its stdin is fed
    the JSON-serialised *input_data*.  The parent does **not** wait for the
    child to finish — this keeps the hook fast.

    The pipe write is performed on a daemon thread to avoid blocking the
    parent when the payload exceeds the OS pipe buffer size.

    When running as a subagent (detected via CLAUDE_AGENT_NAME env var or
    input_data["agent_type"]), source_app is automatically overridden to
    "{agent}-{branch}" for observability identification.

    Args:
        input_data:  The original stdin dict received by the hook.
        event_type:  Hook event name (e.g. "PreToolUse").
        source_app:  Value for --source-app (default "fenrir-ledger").
        extra_args:  Optional list of additional CLI flags
                     (e.g. ["--summarize", "--add-chat"]).
    """
    try:
        resolved_app = _resolve_source_app(input_data, source_app)
        cmd = [
            "uv", "run", _SEND_EVENT_SCRIPT,
            "--source-app", resolved_app,
            "--event-type", event_type,
        ]
        if extra_args:
            cmd.extend(extra_args)

        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            # Detach from the parent so we don't block on it.
            start_new_session=True,
        )
        # Write the JSON payload on a daemon thread so the parent returns
        # immediately even for payloads larger than the OS pipe buffer.
        payload_bytes = json.dumps(input_data).encode("utf-8")
        writer = threading.Thread(
            target=_write_and_close,
            args=(proc, payload_bytes),
            daemon=True,
        )
        writer.start()
        # Don't join — daemon thread dies when parent exits.
    except Exception:
        # Never block Claude Code even if spawning fails.
        pass
