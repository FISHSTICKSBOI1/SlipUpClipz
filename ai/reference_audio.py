"""AI Clone reference limits. Importing this module does not load a model."""

from io import BytesIO

import soundfile as sf

MIN_REFERENCE_SEC = 0.8
MAX_REFERENCE_SEC = 7.0
# A clip the app shows as 7.0 seconds can be a fraction of a millisecond
# longer after 24 kHz resampling. This is not a higher product limit.
MAX_REFERENCE_SLACK_SEC = 0.002
MAX_WAV_BYTES = 1024 * 1024
MAX_REFERENCE_TEXT_CHARS = 300


def reference_wav_problem(raw: bytes) -> str | None:
    if len(raw) > MAX_WAV_BYTES or len(raw) < 500:
        return "Invalid WAV reference recording"
    try:
        info = sf.info(BytesIO(raw))
    except (RuntimeError, ValueError):
        return "Could not decode WAV reference audio"
    limit = MAX_REFERENCE_SEC + MAX_REFERENCE_SLACK_SEC
    if info.format != "WAV" or info.channels != 1 or not (MIN_REFERENCE_SEC <= info.duration <= limit):
        return "Reference must be mono WAV, between 0.8 and 7 seconds"
    return None


def fit_reference_transcript(text: str, limit: int = MAX_REFERENCE_TEXT_CHARS) -> tuple[str, bool]:
    """Return the transcript and whether it had to be cut to fit the field."""
    cleaned = text.strip()
    if len(cleaned) <= limit:
        return cleaned, False
    return cleaned[:limit].rstrip(), True
