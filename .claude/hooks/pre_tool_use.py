#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import sys
from pathlib import Path
from utils.constants import ensure_session_log_dir, fire_and_forget_send_event


def is_env_file_access(tool_name, tool_input):
    """
    Check if any tool is trying to access .env files containing sensitive data.
    """
    if tool_name in ['Read', 'Edit', 'MultiEdit', 'Write', 'Bash']:
        # Check file paths for file-based tools
        if tool_name in ['Read', 'Edit', 'MultiEdit', 'Write']:
            file_path = tool_input.get('file_path', '')
            if '.env' in file_path and not file_path.endswith('.env.sample'):
                return True
        
        # Check bash commands for .env file access
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            # Pattern to detect .env file access (but allow .env.sample)
            env_patterns = [
                r'\b\.env\b(?!\.sample)',  # .env but not .env.sample
                r'cat\s+.*\.env\b(?!\.sample)',  # cat .env
                r'echo\s+.*>\s*\.env\b(?!\.sample)',  # echo > .env
                r'touch\s+.*\.env\b(?!\.sample)',  # touch .env
                r'cp\s+.*\.env\b(?!\.sample)',  # cp .env
                r'mv\s+.*\.env\b(?!\.sample)',  # mv .env
            ]
            
            for pattern in env_patterns:
                if re.search(pattern, command):
                    return True
    
    return False

def deny_tool(reason):
    """
    Deny a tool call using the JSON hookSpecificOutput.permissionDecision pattern.
    Prints JSON to stdout and exits with code 0.
    """
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason
        }
    }
    print(json.dumps(output))
    sys.exit(0)


def summarize_tool_input(tool_name, tool_input):
    """
    Create a summary dict of key fields for the tool, for logging purposes.
    """
    summary = {"tool_name": tool_name}

    if tool_name == 'Bash':
        summary["command"] = tool_input.get("command", "")[:200]
        if tool_input.get("description"):
            summary["description"] = tool_input["description"][:100]
        if tool_input.get("timeout"):
            summary["timeout"] = tool_input["timeout"]
        if tool_input.get("run_in_background"):
            summary["run_in_background"] = True

    elif tool_name == 'Write':
        summary["file_path"] = tool_input.get("file_path", "")
        summary["content_length"] = len(tool_input.get("content", ""))

    elif tool_name == 'Edit':
        summary["file_path"] = tool_input.get("file_path", "")
        summary["replace_all"] = tool_input.get("replace_all", False)

    elif tool_name == 'Read':
        summary["file_path"] = tool_input.get("file_path", "")
        if tool_input.get("offset"):
            summary["offset"] = tool_input["offset"]
        if tool_input.get("limit"):
            summary["limit"] = tool_input["limit"]

    elif tool_name == 'Glob':
        summary["pattern"] = tool_input.get("pattern", "")
        if tool_input.get("path"):
            summary["path"] = tool_input["path"]

    elif tool_name == 'Grep':
        summary["pattern"] = tool_input.get("pattern", "")
        if tool_input.get("path"):
            summary["path"] = tool_input["path"]
        if tool_input.get("glob"):
            summary["glob"] = tool_input["glob"]

    elif tool_name == 'WebFetch':
        summary["url"] = tool_input.get("url", "")
        summary["prompt"] = tool_input.get("prompt", "")[:100]

    elif tool_name == 'WebSearch':
        summary["query"] = tool_input.get("query", "")
        if tool_input.get("allowed_domains"):
            summary["allowed_domains"] = tool_input["allowed_domains"]
        if tool_input.get("blocked_domains"):
            summary["blocked_domains"] = tool_input["blocked_domains"]

    elif tool_name == 'Task':
        summary["description"] = tool_input.get("description", "")[:100]
        summary["subagent_type"] = tool_input.get("subagent_type", "")
        if tool_input.get("model"):
            summary["model"] = tool_input["model"]
        if tool_input.get("run_in_background"):
            summary["run_in_background"] = True
        if tool_input.get("resume"):
            summary["resume"] = tool_input["resume"]

    elif tool_name == 'TaskOutput':
        summary["task_id"] = tool_input.get("task_id", "")
        summary["block"] = tool_input.get("block", True)
        if tool_input.get("timeout"):
            summary["timeout"] = tool_input["timeout"]

    elif tool_name == 'TaskStop':
        summary["task_id"] = tool_input.get("task_id", "")

    elif tool_name == 'SendMessage':
        summary["type"] = tool_input.get("type", "")
        if tool_input.get("recipient"):
            summary["recipient"] = tool_input["recipient"]
        if tool_input.get("summary"):
            summary["summary"] = tool_input["summary"]

    elif tool_name == 'TaskCreate':
        summary["subject"] = tool_input.get("subject", "")[:100]
        if tool_input.get("activeForm"):
            summary["activeForm"] = tool_input["activeForm"]

    elif tool_name == 'TaskGet':
        summary["taskId"] = tool_input.get("taskId", "")

    elif tool_name == 'TaskUpdate':
        summary["taskId"] = tool_input.get("taskId", "")
        if tool_input.get("status"):
            summary["status"] = tool_input["status"]
        if tool_input.get("owner"):
            summary["owner"] = tool_input["owner"]

    elif tool_name == 'TaskList':
        pass  # No params

    elif tool_name == 'TeamCreate':
        summary["team_name"] = tool_input.get("team_name", "")
        if tool_input.get("description"):
            summary["description"] = tool_input["description"][:100]

    elif tool_name == 'TeamDelete':
        pass  # No params

    elif tool_name == 'NotebookEdit':
        summary["notebook_path"] = tool_input.get("notebook_path", "")
        if tool_input.get("cell_type"):
            summary["cell_type"] = tool_input["cell_type"]
        if tool_input.get("edit_mode"):
            summary["edit_mode"] = tool_input["edit_mode"]

    elif tool_name == 'EnterPlanMode':
        pass  # No params

    elif tool_name == 'ExitPlanMode':
        if tool_input.get("allowedPrompts"):
            summary["allowedPrompts_count"] = len(tool_input["allowedPrompts"])

    elif tool_name == 'AskUserQuestion':
        if tool_input.get("questions"):
            summary["questions_count"] = len(tool_input["questions"])

    elif tool_name == 'Skill':
        summary["skill"] = tool_input.get("skill", "")
        if tool_input.get("args"):
            summary["args"] = tool_input["args"][:100]

    elif tool_name.startswith('mcp__'):
        # MCP tools - log the full tool name and available input keys
        summary["mcp_tool"] = tool_name
        summary["input_keys"] = list(tool_input.keys())[:10]

    return summary


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        tool_use_id = input_data.get('tool_use_id', '')

        # Check for .env file access (blocks access to sensitive environment files)
        # COMMENTED OUT: Allows worktree command to create .env files automatically
        # if is_env_file_access(tool_name, tool_input):
        #     deny_tool("Access to .env files containing sensitive data is prohibited. Use .env.sample for template files instead")

        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')

        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'pre_tool_use.json'

        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []

        # Build log entry with tool_use_id and tool summary
        log_entry = {
            "tool_name": tool_name,
            "tool_use_id": tool_use_id,
            "session_id": session_id,
            "hook_event_name": input_data.get("hook_event_name", "PreToolUse"),
            "tool_summary": summarize_tool_input(tool_name, tool_input),
        }

        # Append log entry
        log_data.append(log_entry)

        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Fire-and-forget: send event to observability server (no --summarize on hot path)
        fire_and_forget_send_event(input_data, "PreToolUse")

        sys.exit(0)

    except json.JSONDecodeError:
        # Gracefully handle JSON decode errors
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)

if __name__ == '__main__':
    main()