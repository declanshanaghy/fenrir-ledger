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

    Args:
        input_data:  The original stdin dict received by the hook.
        event_type:  Hook event name (e.g. "PreToolUse").
        source_app:  Value for --source-app (default "fenrir-ledger").
        extra_args:  Optional list of additional CLI flags
                     (e.g. ["--summarize", "--add-chat"]).
    """
    try:
        cmd = [
            "uv", "run", _SEND_EVENT_SCRIPT,
            "--source-app", source_app,
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
        # Write the JSON payload and close stdin so the child can proceed.
        proc.stdin.write(json.dumps(input_data).encode("utf-8"))
        proc.stdin.close()
        # Do NOT call proc.wait() — fire and forget.
    except Exception:
        # Never block Claude Code even if spawning fails.
        pass