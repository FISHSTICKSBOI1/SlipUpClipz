"""Temporary AI output naming and cleanup. Does not load Qwen."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch
import json
import os
import tempfile
import time
import unittest
import uuid

import server_temp_outputs as temps


class TempOutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.session = str(uuid.uuid4())
        self.other = str(uuid.uuid4())
        self.token = uuid.uuid4().hex

    def _old_mtime(self) -> float:
        return time.time() - temps.ORPHAN_AGE_SECONDS - 30

    def test_import_re_and_protected_helper_exist(self) -> None:
        self.assertTrue(hasattr(temps, "re"))
        self.assertTrue(callable(temps.is_protected_ai_output))
        self.assertTrue(temps.is_protected_ai_output("compare-20260101-t1.05.wav"))
        self.assertTrue(temps.is_protected_ai_output("nonstream-matrix.wav"))
        self.assertTrue(temps.is_protected_ai_output("model.safetensors"))
        self.assertFalse(temps.is_protected_ai_output(f"tmp-{self.session}-{self.token}.wav"))

    def test_successful_temporary_generation_unlinks_owned_file(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output_dir = Path(folder)
            owned = output_dir / f"tmp-{self.session}-{self.token}.wav"
            owned.write_bytes(b"RIFF")
            self.assertTrue(temps.unlink_owned_temp(owned, output_dir, self.session))
            self.assertFalse(owned.exists())

    def test_failed_generation_does_not_need_a_file_and_interrupted_owned_temps_can_be_removed(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output_dir = Path(folder)
            leftover = output_dir / f"tmp-{self.session}-{self.token}.wav"
            leftover.write_bytes(b"RIFF")
            os.utime(leftover, (self._old_mtime(), self._old_mtime()))
            removed = temps.recover_orphan_session_temps(output_dir)
            self.assertEqual(removed, [leftover.name])
            self.assertFalse(leftover.exists())

    def test_does_not_delete_another_session_or_files_outside_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output_dir = Path(folder) / "outputs"
            outside = Path(folder) / "outside"
            output_dir.mkdir()
            outside.mkdir()
            other = output_dir / f"tmp-{self.other}-{self.token}.wav"
            historical = output_dir / f"{'a' * 32}.wav"
            escaped = outside / f"tmp-{self.session}-{self.token}.wav"
            other.write_bytes(b"RIFF")
            historical.write_bytes(b"RIFF")
            escaped.write_bytes(b"RIFF")
            self.assertFalse(temps.unlink_owned_temp(other, output_dir, self.session))
            self.assertFalse(temps.unlink_owned_temp(historical, output_dir, self.session))
            self.assertFalse(temps.unlink_owned_temp(escaped, output_dir, self.session))
            self.assertTrue(other.exists())
            self.assertTrue(historical.exists())
            self.assertTrue(escaped.exists())

    def test_server_calls_orphan_recovery_without_loading_qwen(self) -> None:
        source = Path(__file__).with_name("server.py").read_text(encoding="utf-8")
        self.assertIn("from server_temp_outputs import", source)
        self.assertIn("recover_orphan_session_temps(output_dir)", source)
        self.assertIn("import re", Path(__file__).with_name("server_temp_outputs.py").read_text(encoding="utf-8"))

    def test_crash_recovery_only_removes_abandoned_tmp_session_wavs(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output_dir = Path(folder)
            orphan = output_dir / f"tmp-{self.other}-{uuid.uuid4().hex}.wav"
            recent = output_dir / f"tmp-{self.session}-{self.token}.wav"
            historical = output_dir / f"{'b' * 32}.wav"
            benchmark = output_dir / "compare-20260101-t1.05.wav"
            orphan.write_bytes(b"RIFF")
            recent.write_bytes(b"RIFF")
            historical.write_bytes(b"RIFF")
            benchmark.write_bytes(b"RIFF")
            os.utime(orphan, (self._old_mtime(), self._old_mtime()))
            removed = temps.recover_orphan_session_temps(output_dir)
            self.assertEqual(removed, [orphan.name])
            self.assertFalse(orphan.exists())
            self.assertTrue(recent.exists())
            self.assertTrue(historical.exists())
            self.assertTrue(benchmark.exists())

    def test_recovery_skips_locked_or_foreign_active_worker_files(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output_dir = Path(folder) / "outputs"
            output_dir.mkdir()
            locked = output_dir / f"tmp-{self.other}-{uuid.uuid4().hex}.wav"
            locked.write_bytes(b"RIFF")
            os.utime(locked, (self._old_mtime(), self._old_mtime()))
            with patch.object(temps, "file_is_unlocked", return_value=False):
                removed = temps.recover_orphan_session_temps(output_dir)
            self.assertEqual(removed, [])
            self.assertTrue(locked.exists())

            claim = Path(folder) / temps.WORKER_CLAIM_NAME
            claim.write_text(
                json.dumps({"ownerPid": os.getppid(), "workerPid": os.getppid()}),
                encoding="utf-8",
            )
            removed = temps.recover_orphan_session_temps(output_dir)
            self.assertEqual(removed, [])
            self.assertTrue(locked.exists())


if __name__ == "__main__":
    unittest.main()
