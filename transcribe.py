# Transcribes the CLS demo videos locally with faster-whisper.
# Usage: python transcribe.py "video1.mp4" "video2.mp4" ...   -> transcripts/<name>.txt
import pathlib, sys, time
import av, numpy as np
from faster_whisper import WhisperModel

def load(path):   # 16 kHz mono float32; our own decode because this PyAV build rejects faster-whisper's open() args
    chunks, res = [], av.AudioResampler(format="s16", layout="mono", rate=16000)
    with av.open(path) as c:
        for frame in c.decode(audio=0):
            chunks += [f.to_ndarray().reshape(-1) for f in res.resample(frame)]
    chunks += [f.to_ndarray().reshape(-1) for f in res.resample(None)]
    return np.concatenate(chunks).astype(np.float32) / 32768.0

PROMPT = ("Nursing clinical skills demonstration. Mr John Luke, NHI DGY 2963, born 16 December 1942. "
          "Preceptor, wristband, tympanic thermometer, radial pulse, respirations, brachial artery, stethoscope, "
          "systolic, diastolic, paracetamol, metoprolol succinate, PO, qid, Ask, Build, Check.")
out_dir = pathlib.Path(__file__).parent / "transcripts"
out_dir.mkdir(exist_ok=True)
model = WhisperModel("small.en", device="cpu", compute_type="int8")

for video in sys.argv[1:]:
    src = pathlib.Path(video)
    out = out_dir / (src.stem + ".txt")
    t0 = time.time()
    segments, info = model.transcribe(load(str(src)), beam_size=5, vad_filter=True, initial_prompt=PROMPT)
    with out.open("w", encoding="utf-8") as f:
        for s in segments:
            f.write(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {s.text.strip()}\n")
            f.flush()
    print(f"{src.name}: {info.duration / 60:.1f} min of audio in {(time.time() - t0) / 60:.1f} min -> {out.name}", flush=True)
