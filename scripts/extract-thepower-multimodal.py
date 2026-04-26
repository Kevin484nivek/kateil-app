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
from pypdf import PdfReader
from rapidocr_onnxruntime import RapidOCR


VIDEO_EXTENSIONS = {".mp4", ".mkv"}
PDF_EXTENSIONS = {".pdf"}
SHEET_EXTENSIONS = {".xlsx"}


@dataclass
class SourceFile:
    path: Path
    domain: str
    source_type: str


def run_command(command: list[str]) -> str:
    proc = subprocess.run(command, capture_output=True, text=True, check=True)
    return proc.stdout.strip()


def get_video_duration_seconds(video_path: Path) -> float:
    output = run_command(
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
    return float(output)


def sanitize_slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "untitled"


def discover_sources(source_root: Path, max_sources: int, skip_sources: int = 0) -> list[SourceFile]:
    sources: list[SourceFile] = []
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        if "__MACOSX" in path.parts or path.name.startswith("._"):
            continue
        ext = path.suffix.lower()
        if ext in VIDEO_EXTENSIONS:
            source_type = "Video"
        elif ext in PDF_EXTENSIONS:
            source_type = "PDF"
        elif ext in SHEET_EXTENSIONS:
            source_type = "Spreadsheet"
        else:
            continue
        top = path.relative_to(source_root).parts[0]
        domain = "MBA" if top == "MBA" else "Sales" if top == "ThePowerSales" else "Other"
        sources.append(SourceFile(path=path, domain=domain, source_type=source_type))

    type_priority = {"Video": 0, "PDF": 1, "Spreadsheet": 2}
    sources.sort(key=lambda s: (type_priority.get(s.source_type, 99), str(s.path)))
    if skip_sources < 0:
        skip_sources = 0
    if skip_sources:
        sources = sources[skip_sources:]
    if max_sources:
        return sources[:max_sources]
    return sources


def build_frame_timestamps(
    duration_seconds: float,
    first_window_seconds: int,
    frame_every_seconds_early: int,
    frame_every_seconds_late: int,
) -> list[float]:
    timestamps: list[float] = []
    t = 0.0
    while t < min(duration_seconds, float(first_window_seconds)):
        timestamps.append(round(t, 3))
        t += float(frame_every_seconds_early)
    t = float(first_window_seconds)
    while t < duration_seconds:
        timestamps.append(round(t, 3))
        t += float(frame_every_seconds_late)
    if not timestamps:
        timestamps.append(0.0)
    return timestamps


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
    has_table_words = any(token in text_blob for token in ["tabla", "table", "fila", "columna"])
    has_chart_words = any(token in text_blob for token in ["kpi", "growth", "conversion", "%", "ratio"])
    has_canvas_words = any(token in text_blob for token in ["canvas", "segment", "propuesta de valor", "funnel"])

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
        f"Lineas detectadas: {line_count}. Densidad de bordes: {edge_density:.3f}. "
        "Interpretacion preliminar para revision humana."
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
        windows.append(
            {
                "chunk_index": idx,
                "t_start": round(t, 3),
                "t_end": round(end, 3),
                "transcript": "",
            }
        )
        t = end
        idx += 1

    segment_list = list(segments)
    for segment in segment_list:
        for window in windows:
            overlap = max(0.0, min(segment.end, window["t_end"]) - max(segment.start, window["t_start"]))
            if overlap > 0:
                window["transcript"] = (window["transcript"] + " " + segment.text.strip()).strip()
    return windows


def extract_ocr_for_frames(frame_paths: list[Path], ocr_engine: RapidOCR) -> list[list[str]]:
    all_lines: list[list[str]] = []
    for frame_path in frame_paths:
        result = ocr_engine(str(frame_path))
        lines: list[str] = []
        if result and result[0]:
            for item in result[0]:
                if len(item) >= 2 and item[1]:
                    lines.append(str(item[1]))
        all_lines.append(lines)
    return all_lines


def process_video(
    src: SourceFile,
    output_root: Path,
    chunk_seconds: int,
    model_name: str,
    ocr_engine: RapidOCR,
    run_id: str,
    first_window_seconds: int,
    frame_every_seconds_early: int,
    frame_every_seconds_late: int,
) -> dict[str, Any]:
    rel = src.path.name
    slug = sanitize_slug(src.path.stem)
    source_dir = output_root / "runs" / run_id / src.domain / "video" / slug
    frames_dir = source_dir / "frames"
    source_dir.mkdir(parents=True, exist_ok=True)

    chunks = transcribe_to_chunks(src.path, chunk_seconds=chunk_seconds, model_name=model_name)
    duration_seconds = chunks[-1]["t_end"] if chunks else get_video_duration_seconds(src.path)
    frame_timestamps = build_frame_timestamps(
        duration_seconds=duration_seconds,
        first_window_seconds=first_window_seconds,
        frame_every_seconds_early=frame_every_seconds_early,
        frame_every_seconds_late=frame_every_seconds_late,
    )
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

        visual_type_counts = Counter([cf["visual_type"] for cf in chunk_frames])
        visual_type = visual_type_counts.most_common(1)[0][0] if visual_type_counts else "unknown"
        visual_summary = (
            f"Frames analizados en chunk: {len(chunk_frames)}. "
            f"Tipo visual dominante: {visual_type}. "
            f"Resumen frame inicial: {chunk_frames[0]['visual_summary']}"
        )

        ocr_text_joined = " | ".join(
            [line for cf in chunk_frames for line in cf["ocr_lines"] if line]
        )
        frame_paths_joined = " | ".join([cf["frame_path"] for cf in chunk_frames])
        frame_timestamps_joined = " | ".join([str(cf["timestamp"]) for cf in chunk_frames])

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
                "ocr_text": ocr_text_joined,
                "visual_type": visual_type,
                "visual_summary": visual_summary,
                "frame_path": chunk_frames[0]["frame_path"],
                "frame_paths": frame_paths_joined,
                "frame_timestamps": frame_timestamps_joined,
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


def process_pdf(src: SourceFile, output_root: Path, run_id: str) -> dict[str, Any]:
    slug = sanitize_slug(src.path.stem)
    source_dir = output_root / "runs" / run_id / src.domain / "pdf" / slug
    source_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(src.path))
    pages: list[dict[str, Any]] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        pages.append(
            {
                "source_path": str(src.path),
                "source_type": "PDF",
                "domain": src.domain,
                "page": i,
                "text": text,
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
            }
        )

    output_json = source_dir / "pdf_pages.json"
    output_json.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "source_path": str(src.path),
        "source_type": "PDF",
        "domain": src.domain,
        "pages": len(pages),
        "output_json": str(output_json),
    }


def process_sheet(src: SourceFile, output_root: Path, run_id: str) -> dict[str, Any]:
    # Mantiene trazabilidad sin tocar el origen; extracción avanzada de XLSX se puede ampliar en v2.
    slug = sanitize_slug(src.path.stem)
    source_dir = output_root / "runs" / run_id / src.domain / "spreadsheet" / slug
    source_dir.mkdir(parents=True, exist_ok=True)
    metadata = {
        "source_path": str(src.path),
        "source_type": "Spreadsheet",
        "domain": src.domain,
        "file_size_bytes": src.path.stat().st_size,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    output_json = source_dir / "sheet_metadata.json"
    output_json.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "source_path": str(src.path),
        "source_type": "Spreadsheet",
        "domain": src.domain,
        "output_json": str(output_json),
    }


def write_manifest(rows: list[dict[str, Any]], output_root: Path, run_id: str) -> Path:
    manifest_path = output_root / "runs" / run_id / "manifest.csv"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = sorted({key for row in rows for key in row.keys()})
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Extracción multimodal ThePower -> capa raw")
    parser.add_argument("--source-root", default=r"C:\Users\kevin\Documents\ThePower")
    parser.add_argument("--output-root", default=r"C:\Users\kevin\Documents\Playground\data\thepower\multimodal")
    parser.add_argument("--max-sources", type=int, default=3)
    parser.add_argument("--skip-sources", type=int, default=0)
    parser.add_argument("--chunk-seconds", type=int, default=20)
    parser.add_argument("--whisper-model", default="small")
    parser.add_argument("--first-window-seconds", type=int, default=30)
    parser.add_argument("--frame-every-seconds-early", type=int, default=3)
    parser.add_argument("--frame-every-seconds-late", type=int, default=15)
    args = parser.parse_args()

    source_root = Path(args.source_root)
    output_root = Path(args.output_root)
    run_id = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    output_root.mkdir(parents=True, exist_ok=True)

    sources = discover_sources(
        source_root,
        max_sources=args.max_sources,
        skip_sources=args.skip_sources,
    )
    ocr_engine = RapidOCR()
    manifest_rows: list[dict[str, Any]] = []

    for src in sources:
        if src.source_type == "Video":
            row = process_video(
                src=src,
                output_root=output_root,
                chunk_seconds=args.chunk_seconds,
                model_name=args.whisper_model,
                ocr_engine=ocr_engine,
                run_id=run_id,
                first_window_seconds=args.first_window_seconds,
                frame_every_seconds_early=args.frame_every_seconds_early,
                frame_every_seconds_late=args.frame_every_seconds_late,
            )
        elif src.source_type == "PDF":
            row = process_pdf(src=src, output_root=output_root, run_id=run_id)
        elif src.source_type == "Spreadsheet":
            row = process_sheet(src=src, output_root=output_root, run_id=run_id)
        else:
            continue
        manifest_rows.append(row)

    manifest_path = write_manifest(manifest_rows, output_root=output_root, run_id=run_id)
    print(f"Run completed: {run_id}")
    print(f"Sources processed: {len(manifest_rows)}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
