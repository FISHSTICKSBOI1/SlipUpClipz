"""Duration and transcript limits. Does not load Qwen."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import unittest

import numpy as np
import soundfile as sf

from reference_audio import (
    MAX_REFERENCE_TEXT_CHARS,
    MAX_WAV_BYTES,
    fit_reference_transcript,
    reference_wav_problem,
)

ROOT = Path(__file__).resolve().parent
VERIFIED_5S = (
    "I'm by the door waiting for you to come back. I thought you were coming "
    "from the other direction, but I guess"
)
VERIFIED_7S = (
    "I'm by the door waiting for you to come back. I thought you were coming "
    "from the other direction, but I guess you went around the building instead."
)


def wav_bytes(seconds: float, sample_rate: int = 24000, channels: int = 1) -> bytes:
    frames = int(round(seconds * sample_rate))
    audio = np.zeros(frames if channels == 1 else (frames, channels), dtype=np.float32)
    buffer = BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


class ReferenceLimitTests(unittest.TestCase):
    def test_accepts_production_lengths(self) -> None:
        for seconds in (0.8, 1.0, 3.1, 5.18, 6.96, 7.0):
            raw = wav_bytes(seconds)
            info = sf.info(BytesIO(raw))
            self.assertIsNone(reference_wav_problem(raw), seconds)
            self.assertLess(len(raw), MAX_WAV_BYTES)
            self.assertEqual(info.frames, int(round(seconds * 24000)))
            self.assertAlmostEqual(info.duration, seconds, places=3)

    def test_rejects_too_short_and_over_seven_seconds(self) -> None:
        self.assertIsNotNone(reference_wav_problem(wav_bytes(0.79)))
        self.assertIsNotNone(reference_wav_problem(wav_bytes(7.01)))
        self.assertIsNotNone(reference_wav_problem(wav_bytes(7.05)))
        self.assertIsNotNone(reference_wav_problem(wav_bytes(10.131)))

    def test_rejects_stereo(self) -> None:
        self.assertIn("mono", reference_wav_problem(wav_bytes(2.0, channels=2)) or "")

    def test_existing_reference_files(self) -> None:
        accepted = {
            "ref-1s.wav": 0.94,
            "ref-3s.wav": 3.06,
            "ref-5s.wav": 5.18,
            "ref-7s.wav": 6.96,
        }
        for name, expected in accepted.items():
            raw = (ROOT / "benchmark-duration" / name).read_bytes()
            info = sf.info(BytesIO(raw))
            self.assertAlmostEqual(info.duration, expected, places=2)
            self.assertEqual(info.channels, 1)
            self.assertLess(len(raw), MAX_WAV_BYTES)
            mono = _mono_pcm(raw)
            self.assertIsNone(reference_wav_problem(mono), name)
            self.assertEqual(sf.info(BytesIO(mono)).frames, info.frames)

        too_long = (ROOT / "benchmark-duration" / "ref-10s.wav").read_bytes()
        info = sf.info(BytesIO(too_long))
        self.assertGreater(info.duration, 7.0)
        self.assertIsNotNone(reference_wav_problem(_mono_pcm(too_long)))

    def test_verified_transcripts_are_not_cut(self) -> None:
        for text in (VERIFIED_5S, VERIFIED_7S):
            fitted, truncated = fit_reference_transcript(text)
            self.assertFalse(truncated)
            self.assertEqual(fitted, text)
            self.assertLess(len(text), MAX_REFERENCE_TEXT_CHARS)

        long_text = "word " * 80
        fitted, truncated = fit_reference_transcript(long_text)
        self.assertTrue(truncated)
        self.assertLessEqual(len(fitted), MAX_REFERENCE_TEXT_CHARS)
        self.assertNotEqual(fitted, long_text.strip())


def _mono_pcm(raw: bytes) -> bytes:
    audio, sample_rate = sf.read(BytesIO(raw), always_2d=True)
    buffer = BytesIO()
    sf.write(buffer, audio[:, 0], sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


if __name__ == "__main__":
    unittest.main()
