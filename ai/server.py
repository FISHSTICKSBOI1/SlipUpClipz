"""SlipUpClipz local Qwen voice-generation prototype.

The desktop app starts this process after speaker consent and stops that
same process when AI Clone has been idle. Preview WAVs are session-owned
temporary files. Launch it by hand from the ai folder only when a
development script needs the server already running:

    .\\.venv\\Scripts\\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8765

The app sends 0.8–7 second PCM WAV reference clips from its clip library. Reference
recordings are removed as soon as inference finishes; generated WAVs are stored
in ai/outputs until that session releases them. For local development only. Before release,
add proper per-session authentication and a packaged model/worker lifecycle.
"""

from datetime import datetime
from io import BytesIO
import os
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
import uuid

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

from generation_guard import unusable_reason
from reference_audio import (
    MAX_REFERENCE_TEXT_CHARS,
    fit_reference_transcript,
    reference_wav_problem,
)
from server_temp_outputs import (
    recover_orphan_session_temps,
    temp_output_filename,
    unlink_owned_temp,
)

app = FastAPI(title="SlipUpClipz AI Engine")
# Set only for the worker this app starts. A manual dev server leaves it empty
# and stays usable by local scripts. The desktop app will not talk to that server.
WORKER_TOKEN = os.environ.get("SLIPUPCLIPZ_AI_TOKEN", "").strip()


@app.middleware("http")
async def require_owned_worker(request, call_next):
    if WORKER_TOKEN and request.headers.get("x-slipupclipz-worker") != WORKER_TOKEN:
        return JSONResponse(status_code=403, content={"detail": "SlipUpClipz voice worker required"})
    return await call_next(request)


folder = Path(__file__).resolve().parent
output_dir = Path(os.environ.get("SLIPUPCLIPZ_AI_OUTPUT", str(folder / "outputs")))
output_dir.mkdir(parents=True, exist_ok=True)
model_lock = Lock()
# Abandoned tmp-*.wav leftovers only. Active or recent files stay.
recover_orphan_session_temps(output_dir)
whisper_model: WhisperModel | None = None

def local_qwen_dir() -> str:
    """Use the snapshot copied with the voice engine. A repo id makes Qwen call Hugging Face."""
    explicit = os.environ.get("SLIPUPCLIPZ_QWEN_DIR", "").strip()
    if explicit and os.path.isdir(explicit):
        return explicit
    cache = os.environ.get("HF_HUB_CACHE", "").strip()
    if not cache:
        home = os.environ.get("HF_HOME", "").strip()
        if home:
            cache = os.path.join(home, "hub")
    repo = os.path.join(cache, "models--Qwen--Qwen3-TTS-12Hz-0.6B-Base") if cache else ""
    ref = os.path.join(repo, "refs", "main") if repo else ""
    if ref and os.path.isfile(ref):
        snapshot = os.path.join(repo, "snapshots", Path(ref).read_text(encoding="utf-8").strip())
        if os.path.isdir(snapshot):
            return snapshot
    return "Qwen/Qwen3-TTS-12Hz-0.6B-Base"


# 0.6B Base is the production voice clone. The 1.7B checkpoint is not loaded.
print("Loading Qwen3-TTS 0.6B...")
model_load_started = time.perf_counter()
if not torch.cuda.is_available():
    print(
        "AI Voice Clip Cloning needs a supported NVIDIA GPU and a current NVIDIA driver. "
        "The CUDA development toolkit is not required."
    )
    raise SystemExit(1)
qwen_dir = local_qwen_dir()
print("Voice model directory:", qwen_dir)
try:
    model = Qwen3TTSModel.from_pretrained(
        qwen_dir,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
        local_files_only=True,
    )
except Exception as exc:
    print("The voice engine failed to load:", repr(exc))
    raise SystemExit(1) from exc
print(f"SlipUpClipz AI engine ready! model_load_s={time.perf_counter() - model_load_started:.2f}")

# CPU-only so the GPU stays dedicated to TTS. Loaded once at startup.
try:
    print("Loading local transcription model (tiny.en, CPU int8)...")
    whisper_load_started = time.perf_counter()
    whisper_model = WhisperModel(
        os.environ.get("SLIPUPCLIPZ_WHISPER_MODEL", "tiny.en"),
        device="cpu",
        compute_type="int8",
    )
    print(f"Transcription model ready. whisper_load_s={time.perf_counter() - whisper_load_started:.2f}")
except Exception as exc:
    whisper_model = None
    print("Transcription model failed to load:", repr(exc))


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    ref_text: str = Field(min_length=1, max_length=MAX_REFERENCE_TEXT_CHARS)


def require_desktop_client(x_slipupclipz_client: str | None) -> None:
    # Prototype CSRF guard: a normal cross-origin webpage cannot silently send
    # the required custom header. This is NOT authentication for public release.
    if x_slipupclipz_client != "electron":
        raise HTTPException(status_code=403, detail="SlipUpClipz desktop app required")


def validate_reference_wav(raw: bytes) -> None:
    problem = reference_wav_problem(raw)
    if problem:
        raise HTTPException(status_code=400, detail=problem)


def transcribe_reference(reference_path: Path) -> dict[str, object]:
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Transcription is unavailable")

    # No VAD: 0.8–7s clips are still short enough that VAD can drop real speech.
    with model_lock:
        segments, _info = whisper_model.transcribe(
            str(reference_path),
            language="en",
            vad_filter=False,
            beam_size=1,
            best_of=1,
            temperature=0,
            condition_on_previous_text=False,
        )
        collected = list(segments)

    parts: list[str] = []
    logprobs: list[float] = []
    compression_ratios: list[float] = []
    for segment in collected:
        piece = (segment.text or "").strip()
        no_speech_prob = float(segment.no_speech_prob)
        avg_logprob = float(segment.avg_logprob)
        # These clips often get a moderately high no-speech score even when
        # someone spoke. Drop a segment only when the model is confident it is
        # silence. Do not treat extra segments as extra speakers.
        if no_speech_prob >= 0.85 and avg_logprob < -1.0:
            continue
        if piece:
            parts.append(piece)
            logprobs.append(avg_logprob)
            compression_ratios.append(float(segment.compression_ratio))

    text, truncated = fit_reference_transcript(" ".join(parts))

    has_speech_text = any(ch.isalpha() for ch in text)
    no_speech = not has_speech_text

    unclear = False
    if has_speech_text:
        avg_logprob = sum(logprobs) / len(logprobs) if logprobs else 0.0
        max_compression = max(compression_ratios) if compression_ratios else 0.0
        if avg_logprob < -1.2 or max_compression > 2.4:
            unclear = True

    return {"text": text, "noSpeech": no_speech, "unclear": unclear, "truncated": truncated}


# Listening test preferred 1.05 over 0.70 and 0.90. Change these together after another test.
VOICE_CLONE_TEMPERATURE = 1.05
VOICE_CLONE_SUBTALKER_TEMPERATURE = 1.05

# Other sampling matches the development comparison. The loaded model's generate_config wins when present.
PRODUCTION_SAMPLING_FALLBACK = {
    "do_sample": True,
    "top_k": 50,
    "top_p": 1.0,
    "repetition_penalty": 1.05,
    "subtalker_dosample": True,
    "subtalker_top_k": 50,
    "subtalker_top_p": 1.0,
    "max_new_tokens": 2048,
}
COMPARE_TEMPERATURES = (0.7, 0.9, 1.05)

# Development listening tests only. synthesize() does not read these.
DEV_MATCHED_SEEDS = (1105, 2209, 3317, 4408, 5502)
DEV_TALKER_TEMPERATURE = 1.05
DEV_SUBTALKER_BASELINE = 1.05
DEV_SUBTALKER_CANDIDATE = 0.90


def production_sampling() -> dict[str, object]:
    """Sampling currently used by voice cloning, except temperature."""
    configured = getattr(model, "generate_defaults", None) or {}
    resolved: dict[str, object] = {}
    for key, fallback in PRODUCTION_SAMPLING_FALLBACK.items():
        value = configured.get(key) if isinstance(configured, dict) else None
        resolved[key] = fallback if value is None else value
    return resolved


def inspect_reference_wav(raw: bytes) -> dict[str, object]:
    """Describe the clip that will be cloned. Does not alter the audio."""
    audio, sample_rate = sf.read(BytesIO(raw), always_2d=False, dtype="float32")
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    audio = np.asarray(audio, dtype=np.float32)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    clipped = int(np.count_nonzero(np.abs(audio) >= 0.999))
    rms = float(np.sqrt(np.mean(np.square(audio)))) if audio.size else 0.0
    silent = np.abs(audio) < 0.02
    silence_ratio = float(np.mean(silent)) if audio.size else 1.0

    def edge_silence(mask: np.ndarray) -> float:
        count = 0
        for is_silent in mask:
            if not is_silent:
                break
            count += 1
        return count / sample_rate if sample_rate else 0.0

    return {
        "durationSec": round(float(audio.size / sample_rate) if sample_rate else 0.0, 3),
        "sampleRate": int(sample_rate),
        "peak": round(peak, 4),
        "clippedSamples": clipped,
        "rms": round(rms, 4),
        "silenceRatio": round(silence_ratio, 3),
        "leadingSilenceSec": round(edge_silence(silent), 3),
        "trailingSilenceSec": round(edge_silence(silent[::-1]), 3),
    }


def compare_temperatures(text: str, ref_text: str, reference_path: Path) -> dict[str, object]:
    """Development comparison. Does not change the production generation endpoint."""
    sampling = production_sampling()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    outputs: list[dict[str, object]] = []

    # One reference encoding, then three sequential samples. Never batched together.
    with model_lock:
        prompt = model.create_voice_clone_prompt(
            ref_audio=str(reference_path),
            ref_text=ref_text,
            x_vector_only_mode=False,
        )
        for temperature in COMPARE_TEMPERATURES:
            filename = f"compare-{stamp}-t{temperature:.2f}.wav"
            output_path = output_dir / filename
            wavs, sample_rate = model.generate_voice_clone(
                text=text,
                language="English",
                voice_clone_prompt=prompt,
                **sampling,
                temperature=temperature,
                subtalker_temperature=temperature,
            )
            sf.write(str(output_path), wavs[0], sample_rate)
            outputs.append({
                "temperature": temperature,
                "subtalkerTemperature": temperature,
                "filename": filename,
                "path": str(output_path),
            })
            del wavs
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    return {"sampling": sampling, "outputs": outputs}


def reseed_generation(seed: int) -> None:
    """Start both CPU and CUDA generators at the same seed before one sample."""
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def dev_voice_matrix(
    jobs: list[tuple[str, str]],
    ref_text: str,
    reference_path: Path,
    variants: list[dict[str, object]],
    seeds: tuple[int, ...],
    stamp: str,
    prefix: str,
) -> dict[str, object]:
    """Sequential development generations. One shared voice prompt, one sample at a time."""
    sampling = production_sampling()
    outputs: list[dict[str, object]] = []
    with model_lock:
        prompt = model.create_voice_clone_prompt(
            ref_audio=str(reference_path),
            ref_text=ref_text,
            x_vector_only_mode=False,
        )
        for sentence, text in jobs:
            for seed in seeds:
                for variant in variants:
                    reseed_generation(int(seed))
                    started = time.perf_counter()
                    temperature = float(variant["temperature"])
                    subtalker = float(variant["subtalkerTemperature"])
                    non_streaming = bool(variant["nonStreaming"])
                    wavs, sample_rate = model.generate_voice_clone(
                        text=text,
                        language="English",
                        voice_clone_prompt=prompt,
                        non_streaming_mode=non_streaming,
                        **sampling,
                        temperature=temperature,
                        subtalker_temperature=subtalker,
                    )
                    elapsed = time.perf_counter() - started
                    condition = str(variant["condition"])
                    if prefix == "nonstream":
                        filename = (
                            f"nonstream-{stamp}-{condition}-talker{temperature:.2f}"
                            f"-sub{subtalker:.2f}-seed{int(seed)}-{sentence}.wav"
                        )
                    else:
                        filename = (
                            f"subtalker-{stamp}-{condition}-talker{temperature:.2f}"
                            f"-sub{subtalker:.2f}-seed{int(seed)}-{sentence}.wav"
                        )
                    output_path = output_dir / filename
                    sf.write(str(output_path), wavs[0], sample_rate)
                    outputs.append({
                        "condition": condition,
                        "sentence": sentence,
                        "seed": int(seed),
                        "temperature": temperature,
                        "subtalkerTemperature": subtalker,
                        "nonStreaming": non_streaming,
                        "seconds": round(elapsed, 2),
                        "filename": filename,
                        "path": str(output_path),
                        "sampleRate": int(sample_rate),
                    })
                    del wavs
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
    return {
        "sampling": sampling,
        "seeds": [int(seed) for seed in seeds],
        "outputs": outputs,
        "productionTemperature": VOICE_CLONE_TEMPERATURE,
        "productionSubtalkerTemperature": VOICE_CLONE_SUBTALKER_TEMPERATURE,
    }


def temp_output_path(session_id: str) -> Path:
    try:
        return output_dir / temp_output_filename(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid generation session.") from exc


def synthesize(text: str, ref_text: str, reference_path: Path, session_id: str = "") -> Path:
    # Qwen is not thread-safe on one GPU. Serialize all inference requests.
    lock_started = time.perf_counter()
    with model_lock:
        lock_wait_s = time.perf_counter() - lock_started
        infer_started = time.perf_counter()
        wavs, sample_rate = model.generate_voice_clone(
            text=text,
            language="English",
            ref_audio=str(reference_path),
            ref_text=ref_text,
            x_vector_only_mode=False,
            **production_sampling(),
            temperature=VOICE_CLONE_TEMPERATURE,
            subtalker_temperature=VOICE_CLONE_SUBTALKER_TEMPERATURE,
        )
        audio = np.asarray(wavs[0])
        infer_s = time.perf_counter() - infer_started
        reason = unusable_reason(audio, int(sample_rate), text)
        if reason:
            print("Rejected generation:", reason)
            raise HTTPException(status_code=422, detail=reason)
        output_path = temp_output_path(session_id) if session_id else output_dir / f"{uuid.uuid4().hex}.wav"
        write_started = time.perf_counter()
        sf.write(str(output_path), audio, sample_rate)
        print(
            "Generation timing "
            f"lock_wait_s={lock_wait_s:.2f} "
            f"infer_s={infer_s:.2f} "
            f"wav_write_s={time.perf_counter() - write_started:.2f} "
            f"text_chars={len(text)}"
        )
    return output_path


@app.get("/health")
def health():
    return {
        "status": "ready",
        "model": "Qwen3-TTS-0.6B",
        "transcriptionReady": whisper_model is not None,
        "authorized": bool(WORKER_TOKEN),
    }


@app.post("/generate", response_class=FileResponse)
def generate_legacy(request: GenerateRequest):
    """Retains the browser /docs test using ai/reference.wav."""
    reference_audio = folder / "reference.wav"
    if not reference_audio.is_file():
        raise HTTPException(status_code=400, detail="reference.wav was not found")
    return FileResponse(
        str(synthesize(request.text, request.ref_text, reference_audio)),
        media_type="audio/wav",
        filename="generated.wav",
    )


@app.post("/generate-from-clip", response_class=FileResponse)
async def generate_from_clip(
    reference_audio: UploadFile = File(...),
    text: str = Form(...),
    ref_text: str = Form(...),
    temporary: str = Form(default=""),
    session_id: str = Form(default=""),
    x_slipupclipz_client: str | None = Header(default=None, alias="X-SlipUpClipz-Client"),
):
    require_desktop_client(x_slipupclipz_client)
    text, ref_text = text.strip(), ref_text.strip()
    if not (1 <= len(text) <= 500 and 1 <= len(ref_text) <= MAX_REFERENCE_TEXT_CHARS):
        raise HTTPException(status_code=400, detail="Invalid speech text or reference transcript")

    raw = await reference_audio.read(1024 * 1024 + 1)
    await reference_audio.close()
    validate_reference_wav(raw)

    # Never keep a copy of the person's reference voice in our output directory.
    with TemporaryDirectory(prefix="slipupclipz-ref-") as temp_dir:
        reference_path = Path(temp_dir) / "reference.wav"
        reference_path.write_bytes(raw)
        try:
            output_path = synthesize(text, ref_text, reference_path, session_id.strip())
        except HTTPException:
            raise
        except Exception as exc:
            print("Qwen generation failed:", repr(exc))
            raise HTTPException(status_code=500, detail="Voice generation failed. Check Python server logs.") from exc

    # Preview bytes are returned to the app. The WAV stays only while that session still owns it.
    if temporary == "1":
        audio = output_path.read_bytes()
        if not unlink_owned_temp(output_path, output_dir, session_id.strip()):
            print("Left non-session generation in place:", output_path)
        return Response(content=audio, media_type="audio/wav")

    return FileResponse(
        str(output_path),
        media_type="audio/wav",
        filename="generated.wav",
    )


@app.post("/dev/compare-temperatures")
def compare_temperatures_endpoint(
    reference_audio: UploadFile = File(...),
    text: str = Form(...),
    ref_text: str = Form(...),
    x_slipupclipz_client: str | None = Header(default=None, alias="X-SlipUpClipz-Client"),
):
    """Local development only. The desktop app does not call this."""
    require_desktop_client(x_slipupclipz_client)
    text, ref_text = text.strip(), ref_text.strip()
    if not (1 <= len(text) <= 500 and 1 <= len(ref_text) <= MAX_REFERENCE_TEXT_CHARS):
        raise HTTPException(status_code=400, detail="Invalid speech text or reference transcript")

    raw = reference_audio.file.read(1024 * 1024 + 1)
    reference_audio.file.close()
    validate_reference_wav(raw)
    reference_report = inspect_reference_wav(raw)

    with TemporaryDirectory(prefix="slipupclipz-compare-") as temp_dir:
        reference_path = Path(temp_dir) / "reference.wav"
        reference_path.write_bytes(raw)
        try:
            transcript = transcribe_reference(reference_path)
        except Exception as exc:
            print("Comparison transcript failed:", repr(exc))
            transcript = {"text": "", "noSpeech": False, "unclear": False, "error": "Transcription failed"}
        try:
            compared = compare_temperatures(text, ref_text, reference_path)
        except Exception as exc:
            print("Temperature comparison failed:", repr(exc))
            raise HTTPException(status_code=500, detail="Voice comparison failed. Check Python server logs.") from exc

    automatic = str(transcript.get("text") or "").strip()
    words = text.split()
    return {
        **compared,
        "reference": reference_report,
        "transcript": {
            "supplied": ref_text,
            "automatic": automatic,
            "noSpeech": bool(transcript.get("noSpeech")),
            "unclear": bool(transcript.get("unclear")),
            "differs": " ".join(automatic.lower().split()) != " ".join(ref_text.lower().split()),
        },
        "target": {"characters": len(text), "words": len(words)},
    }


def dev_trials(trials: int) -> tuple[int, ...]:
    if not 2 <= trials <= 5:
        raise HTTPException(status_code=400, detail="Use 2 to 5 trials")
    return DEV_MATCHED_SEEDS[:trials]


def dev_speech_text(value: str, label: str, limit: int) -> str:
    value = value.strip()
    if not 1 <= len(value) <= limit:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    return value


def dev_reference_bytes(reference_audio: UploadFile) -> tuple[bytes, dict[str, object]]:
    raw = reference_audio.file.read(1024 * 1024 + 1)
    reference_audio.file.close()
    validate_reference_wav(raw)
    return raw, inspect_reference_wav(raw)


def dev_transcript_report(reference_path: Path, ref_text: str) -> dict[str, object]:
    try:
        transcript = transcribe_reference(reference_path)
    except Exception as exc:
        print("Comparison transcript failed:", repr(exc))
        transcript = {"text": "", "noSpeech": False, "unclear": False}
    automatic = str(transcript.get("text") or "").strip()
    return {
        "supplied": ref_text,
        "automatic": automatic,
        "noSpeech": bool(transcript.get("noSpeech")),
        "unclear": bool(transcript.get("unclear")),
        "differs": " ".join(automatic.lower().split()) != " ".join(ref_text.lower().split()),
    }


@app.post("/dev/compare-subtalker")
def compare_subtalker_endpoint(
    reference_audio: UploadFile = File(...),
    text: str = Form(...),
    text_long: str = Form(...),
    ref_text: str = Form(...),
    trials: int = Form(default=3),
    x_slipupclipz_client: str | None = Header(default=None, alias="X-SlipUpClipz-Client"),
):
    """Local development only. Compare subtalker 1.05 with 0.90. The app does not call this."""
    require_desktop_client(x_slipupclipz_client)
    text = dev_speech_text(text, "short target sentence", 500)
    text_long = dev_speech_text(text_long, "long target sentence", 500)
    ref_text = dev_speech_text(ref_text, "reference transcript", MAX_REFERENCE_TEXT_CHARS)
    seeds = dev_trials(trials)
    raw, reference_report = dev_reference_bytes(reference_audio)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    variants = [
        {
            "condition": "A",
            "temperature": DEV_TALKER_TEMPERATURE,
            "subtalkerTemperature": DEV_SUBTALKER_BASELINE,
            "nonStreaming": False,
        },
        {
            "condition": "B",
            "temperature": DEV_TALKER_TEMPERATURE,
            "subtalkerTemperature": DEV_SUBTALKER_CANDIDATE,
            "nonStreaming": False,
        },
    ]
    with TemporaryDirectory(prefix="slipupclipz-subtalker-") as temp_dir:
        reference_path = Path(temp_dir) / "reference.wav"
        reference_path.write_bytes(raw)
        transcript = dev_transcript_report(reference_path, ref_text)
        try:
            compared = dev_voice_matrix(
                [("short", text), ("long", text_long)],
                ref_text,
                reference_path,
                variants,
                seeds,
                stamp,
                "subtalker",
            )
        except Exception as exc:
            print("Subtalker comparison failed:", repr(exc))
            raise HTTPException(status_code=500, detail="Voice comparison failed. Check Python server logs.") from exc
    return {
        "experiment": "subtalker",
        **compared,
        "reference": reference_report,
        "transcript": transcript,
        "sentences": {"short": text, "long": text_long},
    }


@app.post("/dev/compare-nonstreaming")
def compare_nonstreaming_endpoint(
    reference_audio: UploadFile = File(...),
    text: str = Form(...),
    ref_text: str = Form(...),
    trials: int = Form(default=3),
    x_slipupclipz_client: str | None = Header(default=None, alias="X-SlipUpClipz-Client"),
):
    """Local development only. Compare streaming text with the full sentence in view."""
    require_desktop_client(x_slipupclipz_client)
    text = dev_speech_text(text, "target sentence", 500)
    ref_text = dev_speech_text(ref_text, "reference transcript", MAX_REFERENCE_TEXT_CHARS)
    seeds = dev_trials(trials)
    raw, reference_report = dev_reference_bytes(reference_audio)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    variants = [
        {
            "condition": "off",
            "temperature": DEV_TALKER_TEMPERATURE,
            "subtalkerTemperature": DEV_SUBTALKER_BASELINE,
            "nonStreaming": False,
        },
        {
            "condition": "on",
            "temperature": DEV_TALKER_TEMPERATURE,
            "subtalkerTemperature": DEV_SUBTALKER_BASELINE,
            "nonStreaming": True,
        },
    ]
    with TemporaryDirectory(prefix="slipupclipz-nonstream-") as temp_dir:
        reference_path = Path(temp_dir) / "reference.wav"
        reference_path.write_bytes(raw)
        transcript = dev_transcript_report(reference_path, ref_text)
        try:
            compared = dev_voice_matrix(
                [("long", text)],
                ref_text,
                reference_path,
                variants,
                seeds,
                stamp,
                "nonstream",
            )
        except Exception as exc:
            print("Non-streaming comparison failed:", repr(exc))
            raise HTTPException(status_code=500, detail="Voice comparison failed. Check Python server logs.") from exc
    return {
        "experiment": "nonstreaming",
        **compared,
        "reference": reference_report,
        "transcript": transcript,
        "sentences": {"long": text},
    }


@app.post("/transcribe-from-clip")
async def transcribe_from_clip(
    reference_audio: UploadFile = File(...),
    x_slipupclipz_client: str | None = Header(default=None, alias="X-SlipUpClipz-Client"),
):
    require_desktop_client(x_slipupclipz_client)

    raw = await reference_audio.read(1024 * 1024 + 1)
    await reference_audio.close()
    validate_reference_wav(raw)

    with TemporaryDirectory(prefix="slipupclipz-asr-") as temp_dir:
        reference_path = Path(temp_dir) / "reference.wav"
        reference_path.write_bytes(raw)
        try:
            return transcribe_reference(reference_path)
        except HTTPException:
            raise
        except Exception as exc:
            print("Transcription failed:", repr(exc))
            raise HTTPException(
                status_code=500,
                detail="Transcription failed. Enter the words manually.",
            ) from exc
