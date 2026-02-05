#!/usr/bin/env python3
"""
Context Sentry — Claude Code PreToolUse / PreCompact hook.

Monitors transcript size and injects a reminder into Claude's context
when it grows large, instructing Claude to update CHECKPOINT.md and
HANDOFF.md before proceeding.

Environment variables:
  CONTEXT_SENTRY_THRESHOLD_KB      — transcript size threshold (default 200)
  CONTEXT_SENTRY_BACKOFF_MIN       — minutes between repeated warnings (default 10)
  CONTEXT_SENTRY_BACKOFF_DELTA_KB  — additional growth before re-warning (default 50)
  CONTEXT_SENTRY_DEBUG             — set to "1" for extra stderr diagnostics

State file: .claude/.context_sentry_state.json (auto-created, gitignored)
Runtime artifacts: docs/_runtime/CHECKPOINT.md, docs/_runtime/HANDOFF.md (gitignored)
"""

import json
import os
import sys
import time

THRESHOLD_KB = int(os.environ.get("CONTEXT_SENTRY_THRESHOLD_KB", "200"))
BACKOFF_MINUTES = int(os.environ.get("CONTEXT_SENTRY_BACKOFF_MIN", "10"))
BACKOFF_DELTA_KB = int(os.environ.get("CONTEXT_SENTRY_BACKOFF_DELTA_KB", "50"))
DEBUG = os.environ.get("CONTEXT_SENTRY_DEBUG", "") == "1"

CHECKPOINT_SENTINELS = ("CHECKPOINT.md", "HANDOFF.md")
RUNTIME_DIR = "docs/_runtime"

PROJECT_DIR = os.environ.get(
    "CLAUDE_PROJECT_DIR",
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)
STATE_PATH = os.path.join(PROJECT_DIR, ".claude", ".context_sentry_state.json")

CONTEXT_MESSAGE = """\
**Context Sentry Warning** — Transcript has grown large ({size_kb} KB, threshold {threshold_kb} KB).

Before proceeding with this tool call, you MUST update the following files:

1. `docs/_runtime/CHECKPOINT.md` — Record:
   - Key decisions and invariants established so far
   - What has been completed (files created/modified, features implemented)
   - What is in progress or next
   - Critical file paths and their purposes

2. `docs/_runtime/HANDOFF.md` — Record:
   - Concrete next steps (numbered, actionable)
   - Explicit do-not list (things to avoid or that are out of scope)
   - Verification checklist (how to confirm current state is correct)

Create the `docs/_runtime/` directory if it does not exist.
Write these files NOW, then continue with the original tool call.\
"""


def _debug(msg: str) -> None:
    """Print to stderr only when CONTEXT_SENTRY_DEBUG=1."""
    if DEBUG:
        print(f"[context-sentry] {msg}", file=sys.stderr)


def _is_checkpoint_write(hook_input: dict) -> bool:
    """Return True if this tool call targets CHECKPOINT.md or HANDOFF.md."""
    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    if tool_name in ("Write", "Edit"):
        file_path = tool_input.get("file_path", "")
        return any(s in file_path for s in CHECKPOINT_SENTINELS)

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        return any(s in command for s in CHECKPOINT_SENTINELS)

    return False


def _read_state() -> dict:
    """Read persisted backoff state. Returns empty dict on any error."""
    try:
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _write_state(state: dict) -> None:
    """Persist backoff state."""
    try:
        os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
        with open(STATE_PATH, "w") as f:
            json.dump(state, f, indent=2)
    except OSError:
        pass


def _should_suppress(transcript_size_kb: float) -> bool:
    """Check backoff: suppress if recently warned and no significant growth."""
    state = _read_state()
    last_triggered = state.get("last_triggered_ts", 0)
    last_size_kb = state.get("last_triggered_size_kb", 0)

    elapsed_min = (time.time() - last_triggered) / 60
    growth_kb = transcript_size_kb - last_size_kb

    if elapsed_min < BACKOFF_MINUTES and growth_kb < BACKOFF_DELTA_KB:
        _debug(
            f"suppressed: elapsed={elapsed_min:.1f}min growth={growth_kb:.0f}KB"
        )
        return True
    return False


def _record_trigger(transcript_size_kb: float) -> None:
    """Record that we triggered a warning."""
    _write_state(
        {
            "last_triggered_ts": time.time(),
            "last_triggered_size_kb": transcript_size_kb,
        }
    )


def main() -> None:
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        _debug("failed to parse stdin JSON")
        sys.exit(0)

    # Self-trigger guard: don't nag when Claude is writing checkpoint files
    if _is_checkpoint_write(hook_input):
        _debug("self-trigger guard: checkpoint write detected, skipping")
        sys.exit(0)

    # Get transcript path and check size
    transcript_path = hook_input.get("transcript_path")
    if not transcript_path:
        _debug("no transcript_path in hook input")
        sys.exit(0)

    if not isinstance(transcript_path, str):
        _debug(f"transcript_path is not a string: {type(transcript_path)}")
        sys.exit(0)

    try:
        size_bytes = os.path.getsize(transcript_path)
    except (OSError, TypeError):
        _debug(f"cannot stat transcript: {transcript_path}")
        sys.exit(0)

    size_kb = size_bytes / 1024

    if size_kb < THRESHOLD_KB:
        _debug(f"below threshold: {int(size_kb)}KB < {THRESHOLD_KB}KB")
        sys.exit(0)

    # Backoff check
    if _should_suppress(size_kb):
        sys.exit(0)

    # Threshold exceeded and not suppressed — emit warning
    _record_trigger(size_kb)

    event_name = hook_input.get("hook_event_name", "PreToolUse")
    message = CONTEXT_MESSAGE.format(size_kb=int(size_kb), threshold_kb=THRESHOLD_KB)

    # Always print trigger trace to stderr (visible in verbose/debug mode)
    print(
        f"[context-sentry] TRIGGERED: transcript={int(size_kb)}KB "
        f"threshold={THRESHOLD_KB}KB backoff={BACKOFF_MINUTES}min",
        file=sys.stderr,
    )

    output = {
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": message,
        }
    }

    json.dump(output, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
