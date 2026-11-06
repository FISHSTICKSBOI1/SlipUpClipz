"""Reject generations that are silent, looped, or still going after the line ends.

This does not trim, denoise, or loudness-match the audio. A rejected file is
not returned as a successful clip.
"""

from __future__ import annotations

import numpy as np

SILENCE_DB = -45.0
FRAME_SEC = 0.05
# Longest normal pause in the 0.6B and 1.7B listening clips was 0.60s.
# The broken 8.64s clip had a 1.00s hole and then more noise.
BROKEN_GAP_SEC = 0.80
TAIL_AFTER_GAP_SEC = 0.80
REPEAT_CORRELATION = 0.82


def unusable_reason(audio: np.ndarray, sample_rate: int, text: str) -> str | None:
    """Return a user-facing reason, or None when the clip can be kept."""
    samples = np.asarray(audio, dtype=np.float32)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sample_rate <= 0 or samples.size == 0:
        return "That generation was silent. Try again."
    peak = float(np.max(np.abs(samples)))
    duration = samples.size / sample_rate
    if peak < 0.01 or duration < 0.3:
        return "That generation was silent. Try again."
    if _has_broken_tail(samples, sample_rate):
        return "That generation kept going after the line finished. Try again."
    if duration > _duration_limit(text):
        return "That generation ran much longer than the line. Try again."
    if _repeats_opening(samples, sample_rate):
        return "That generation repeated itself. Try again."
    return None


def _duration_limit(text: str) -> float:
    words = max(1, len(text.split()))
    return max(12.0, words * 0.9)


def _frame_db(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    frame = max(1, int(FRAME_SEC * sample_rate))
    usable = (audio.size // frame) * frame
    if usable < frame:
        return np.empty(0, dtype=np.float32)
    windows = audio[:usable].reshape(-1, frame)
    rms = np.sqrt(np.mean(np.square(windows), axis=1))
    return 20.0 * np.log10(rms + 1e-9)


def _has_broken_tail(audio: np.ndarray, sample_rate: int) -> bool:
    levels = _frame_db(audio, sample_rate)
    if levels.size == 0:
        return False
    silent = levels < SILENCE_DB
    start = None
    for index, is_silent in enumerate(silent):
        if is_silent and start is None:
            start = index
        elif not is_silent and start is not None:
            if _gap_is_broken(start, index, levels.size):
                return True
            start = None
    return False


def _gap_is_broken(start: int, end: int, frame_count: int) -> bool:
    if start == 0:
        return False
    gap = (end - start) * FRAME_SEC
    remaining = (frame_count - end) * FRAME_SEC
    return gap >= BROKEN_GAP_SEC and remaining >= TAIL_AFTER_GAP_SEC


def _repeats_opening(audio: np.ndarray, sample_rate: int) -> bool:
    window = int(sample_rate)
    if window < 1 or audio.size < window * 2:
        return False
    reference = audio[:window]
    reference = reference - float(reference.mean())
    reference_norm = float(np.linalg.norm(reference))
    if reference_norm < 1e-4:
        return False
    hop = max(1, sample_rate // 10)
    for lag in range(window, audio.size - window, hop):
        segment = audio[lag:lag + window]
        segment = segment - float(segment.mean())
        segment_norm = float(np.linalg.norm(segment))
        if segment_norm < 1e-4:
            continue
        correlation = float(np.dot(reference, segment) / (reference_norm * segment_norm))
        if correlation >= REPEAT_CORRELATION:
            return True
    return False
