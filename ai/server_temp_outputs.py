"""Session-owned AI preview WAV helpers. Safe to import without loading Qwen."""

from __future__ import annotations

from pathlib import Path
import json
import os
import re
import time
import uuid

WORKER_CLAIM_NAME = "ai-worker.claim"

ORPHAN_AGE_SECONDS = 15 * 60

SESSION_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
OUTPUT_TOKEN_PATTERN = re.compile(r"^[0-9a-f]{32}$", re.IGNORECASE)
PROTECTED_OUTPUT_PREFIXES = ("compare-", "nonstream-", "subtalker-", "reference")


def is_protected_ai_output(filename: str) -> bool:
    name = Path(filename).name.lower()
    return name.startswith(PROTECTED_OUTPUT_PREFIXES) or name.endswith(
        (".bin", ".json", ".pt", ".safetensors")
    )


def is_session_temp_wav(filename: str, session_id: str) -> bool:
    name = Path(filename).name.lower()
    if is_protected_ai_output(name):
        return False
    expected = f"tmp-{session_id.lower()}-"
    token = name[len(expected):-4] if name.startswith(expected) and name.endswith(".wav") else ""
    return bool(OUTPUT_TOKEN_PATTERN.fullmatch(token))


def temp_output_filename(session_id: str, token: str | None = None) -> str:
    if not SESSION_ID_PATTERN.fullmatch(session_id):
        raise ValueError("Invalid generation session.")
    chosen = token or uuid.uuid4().hex
    if not OUTPUT_TOKEN_PATTERN.fullmatch(chosen):
        raise ValueError("Could not name the generated audio.")
    return f"tmp-{session_id}-{chosen}.wav"


def is_orphan_session_temp_wav(filename: str) -> bool:
    name = Path(filename).name.lower()
    if is_protected_ai_output(name) or not name.startswith("tmp-") or not name.endswith(".wav"):
        return False
    body = name[4:-4]
    parts = body.rsplit("-", 1)
    if len(parts) != 2:
        return False
    session_id, token = parts
    return bool(SESSION_ID_PATTERN.fullmatch(session_id) and OUTPUT_TOKEN_PATTERN.fullmatch(token))


def file_is_unlocked(path: Path) -> bool:
    try:
        fd = os.open(path, os.O_RDWR)
        os.close(fd)
        return True
    except OSError:
        return False


def temp_file_is_abandoned(path: Path, now: float | None = None) -> bool:
    try:
        age = (now if now is not None else time.time()) - path.stat().st_mtime
    except OSError:
        return False
    return age >= ORPHAN_AGE_SECONDS and file_is_unlocked(path)


def unlink_owned_temp(path: Path, output_dir: Path, session_id: str = "") -> bool:
    resolved = path.resolve()
    output_root = output_dir.resolve()
    if resolved.parent != output_root:
        return False
    name = resolved.name
    owned = is_session_temp_wav(name, session_id) if session_id else is_orphan_session_temp_wav(name)
    if not owned:
        return False
    try:
        resolved.unlink(missing_ok=True)
        return True
    except OSError:
        print("Could not remove temporary generation:", resolved)
        return False


def pid_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except OSError:
        return False


def other_active_worker_holds_claim(output_dir: Path) -> bool:
    claim_path = output_dir.resolve().parent / WORKER_CLAIM_NAME
    if not claim_path.is_file():
        return False
    try:
        data = json.loads(claim_path.read_text(encoding="utf-8"))
        worker_pid = int(data.get("workerPid") or 0)
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return False
    return worker_pid != os.getpid() and pid_is_alive(worker_pid)


def recover_orphan_session_temps(output_dir: Path, now: float | None = None) -> list[str]:
    removed: list[str] = []
    if not output_dir.is_dir() or other_active_worker_holds_claim(output_dir):
        return removed
    for path in output_dir.iterdir():
        if not path.is_file() or not is_orphan_session_temp_wav(path.name):
            continue
        if not temp_file_is_abandoned(path, now):
            continue
        if unlink_owned_temp(path, output_dir):
            removed.append(path.name)
    return removed
