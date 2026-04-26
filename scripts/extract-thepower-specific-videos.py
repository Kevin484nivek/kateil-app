#!/usr/bin/env python
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from faster_whisper import WhisperModel
from rapidocr_onnxruntime import RapidOCR


@dataclass
class SourceFile:
    path: Path
    domain: str
    source_type: str = "Video"


def run_command(command: list[str]) -> str:
    proc = subprocess.run(command, capture_output=True, text=True, check=True)
    return proc.stdout.strip()


def get_video_duration_seconds(video_path: Path) -> float:
    out = run_command(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ]
    )
    return float(out)


def sanitize_slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "untitled"


def build_frame_timestamps(duration_seconds: float, every_seconds: int) -> list[float]:
    ts: list[float] = []
    t = 0.0
    while t < duration_seconds:
        ts.append(round(t, 3))
        t += float(every_seconds)
    if not ts:
        ts = [0.0]
    return ts


def extract_frames(video_path: Path, frame_timestamps: list[float], frames_dir: Path) -> list[dict[str, Any]]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    frames: list[dict[str, Any]] = []
    for idx, ts in enumerate(frame_timestamps, start=1):
        out_file = frames_dir / f"frame_{idx:04d}.jpg"
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-ss",
                str(ts),
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                str(out_file),
            ],
            check=True,
        )
        frames.append({"frame_index": idx, "timestamp": ts, "path": out_file})
    return frames


def interpret_frame(frame_path: Path, ocr_lines: list[str]) -> dict[str, Any]:
    img = cv2.imread(str(frame_path))
    if img is None:
        return {"visual_type": "unknown", "visual_summary": "No se pudo leer el frame."}
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80, minLineLength=80, maxLineGap=10)
    line_count = 0 if lines is None else len(lines)
    text_blob = " ".join(ocr_lines).lower()

    has_table_words = any(t in text_blob for t in ["tabla", "table", "fila", "columna"])
    has_chart_words = any(t in text_blob for t in ["kpi", "growth", "conversion", "%", "ratio"])
    has_canvas_words = any(t in text_blob for t in ["canvas", "segment", "propuesta de valor", "funnel"])

    if has_table_words:
        visual_type = "table"
    elif has_chart_words:
        visual_type = "chart_or_metrics"
    elif has_canvas_words or line_count > 80:
        visual_type = "diagram_or_framework"
    elif len(ocr_lines) >= 6:
        visual_type = "text_slide"
    else:
        visual_type = "mixed_visual"

    visual_summary = (
        f"Tipo visual estimado: {visual_type}. "
        f"Lineas detectadas: {line_count}. Densidad de bordes: {edge_density:.3f}."
    )
    return {"visual_type": visual_type, "visual_summary": visual_summary}


def transcribe_to_chunks(video_path: Path, chunk_seconds: int, model_name: str) -> list[dict[str, Any]]:
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(video_path), language="es", vad_filter=True)
    duration = info.duration or get_video_duration_seconds(video_path)
    windows: list[dict[str, Any]] = []
    t = 0.0
    idx = 1
    while t < duration:
        end = min(duration, t + chunk_seconds)
        windows.append({"chunk_index": idx, "t_start": round(t, 3), "t_end": round(end, 3), "transcript": ""})
        t = end
        idx += 1

    segs = list(segments)
    for seg in segs:
        for w in windows:
            overlap = max(0.0, min(seg.end, w["t_end"]) - max(seg.start, w["t_start"]))
            if overlap > 0:
                w["transcript"] = (w["transcript"] + " " + seg.text.strip()).strip()
    return windows


def extract_ocr_for_frames(frame_paths: list[Path], ocr_engine: RapidOCR) -> list[list[str]]:
    out: list[list[str]] = []
    for frame_path in frame_paths:
        result = ocr_engine(str(frame_path))
        lines: list[str] = []
        if result and result[0]:
            for item in result[0]:
                if len(item) >= 2 and item[1]:
                    lines.append(str(item[1]))
        out.append(lines)
    return out


def process_video(
    src: SourceFile,
    source_root: Path,
    output_root: Path,
    chunk_seconds: int,
    model_name: str,
    ocr_engine: RapidOCR,
    run_id: str,
    frame_every_seconds: int,
) -> dict[str, Any]:
    rel = src.path.name
    slug = sanitize_slug(src.path.stem)
    source_dir = output_root / "runs" / run_id / src.domain / "video" / slug
    frames_dir = source_dir / "frames"
    source_dir.mkdir(parents=True, exist_ok=True)

    chunks = transcribe_to_chunks(src.path, chunk_seconds=chunk_seconds, model_name=model_name)
    duration_seconds = chunks[-1]["t_end"] if chunks else get_video_duration_seconds(src.path)
    frame_timestamps = build_frame_timestamps(duration_seconds, every_seconds=frame_every_seconds)
    frame_records = extract_frames(src.path, frame_timestamps, frames_dir)
    frame_paths = [r["path"] for r in frame_records]
    ocr_lines_per_frame = extract_ocr_for_frames(frame_paths, ocr_engine=ocr_engine)

    frame_analysis: list[dict[str, Any]] = []
    for record, ocr_lines in zip(frame_records, ocr_lines_per_frame):
        visual = interpret_frame(record["path"], ocr_lines)
        frame_analysis.append(
            {
                "frame_index": record["frame_index"],
                "timestamp": record["timestamp"],
                "frame_path": str(record["path"]),
                "ocr_lines": ocr_lines,
                "visual_type": visual["visual_type"],
                "visual_summary": visual["visual_summary"],
            }
        )

    evidence_rows: list[dict[str, Any]] = []
    for chunk in chunks:
        chunk_frames = [
            fa
            for fa in frame_analysis
            if (fa["timestamp"] >= chunk["t_start"] and fa["timestamp"] < chunk["t_end"])
            or (fa["timestamp"] == duration_seconds and chunk["t_end"] == duration_seconds)
        ]
        if not chunk_frames:
            chunk_frames = [min(frame_analysis, key=lambda fa: abs(fa["timestamp"] - ((chunk["t_start"] + chunk["t_end"]) / 2)))]
        visual_counts = Counter([cf["visual_type"] for cf in chunk_frames])
        visual_type = visual_counts.most_common(1)[0][0] if visual_counts else "unknown"

        evidence_rows.append(
            {
                "source_path": str(src.path),
                "source_name": rel,
                "domain": src.domain,
                "source_type": "Video",
                "chunk_index": chunk["chunk_index"],
                "t_start": chunk["t_start"],
                "t_end": chunk["t_end"],
                "transcript": chunk["transcript"],
                "ocr_text": " | ".join([line for cf in chunk_frames for line in cf["ocr_lines"] if line]),
                "visual_type": visual_type,
                "visual_summary": f"Frames en chunk: {len(chunk_frames)}. Tipo dominante: {visual_type}",
                "frame_path": chunk_frames[0]["frame_path"],
                "frame_paths": " | ".join([cf["frame_path"] for cf in chunk_frames]),
                "frame_timestamps": " | ".join([str(cf["timestamp"]) for cf in chunk_frames]),
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
            }
        )

    output_json = source_dir / "evidence_chunks.json"
    output_json.write_text(json.dumps(evidence_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "source_path": str(src.path),
        "source_type": "Video",
        "domain": src.domain,
        "chunks": len(evidence_rows),
        "frames": len(frame_analysis),
        "output_json": str(output_json),
    }


def write_manifest(rows: list[dict[str, Any]], output_root: Path, run_id: str) -> Path:
    manifest_path = output_root / "runs" / run_id / "manifest.csv"
    fieldnames = sorted({k for r in rows for k in r.keys()})
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Procesa videos específicos ThePower con captura densa.")
    parser.add_argument("--source-root", default=r"C:\Users\kevin\Documents\ThePower")
    parser.add_argument("--output-root", default=r"C:\Users\kevin\Documents\Playground\data\thepower\multimodal")
    parser.add_argument("--videos", nargs="+", required=True)
    parser.add_argument("--chunk-seconds", type=int, default=20)
    parser.add_argument("--whisper-model", default="small")
    parser.add_argument("--frame-every-seconds", type=int, default=3)
    args = parser.parse_args()

    source_root = Path(args.source_root)
    output_root = Path(args.output_root)
    run_id = datetime.now().strftime("run_%Y%m%d_%H%M%S")

    sources: list[SourceFile] = []
    for v in args.videos:
        p = Path(v)
        if not p.exists():
            raise FileNotFoundError(f"No existe: {p}")
        rel = p.relative_to(source_root)
        top = rel.parts[0] if rel.parts else "Other"
        domain = "MBA" if top == "MBA" else "Sales" if top == "ThePowerSales" else "Other"
        sources.append(SourceFile(path=p, domain=domain))

    ocr_engine = RapidOCR()
    rows: list[dict[str, Any]] = []
    for s in sources:
        rows.append(
            process_video(
                src=s,
                source_root=source_root,
                output_root=output_root,
                chunk_seconds=args.chunk_seconds,
                model_name=args.whisper_model,
                ocr_engine=ocr_engine,
                run_id=run_id,
                frame_every_seconds=args.frame_every_seconds,
            )
        )
    manifest_path = write_manifest(rows, output_root, run_id)
    print(f"Run completed: {run_id}")
    print(f"Sources processed: {len(rows)}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()

