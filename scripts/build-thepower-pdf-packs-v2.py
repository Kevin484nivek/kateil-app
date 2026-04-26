#!/usr/bin/env python
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer


STOPWORDS = {
    "de",
    "la",
    "el",
    "los",
    "las",
    "y",
    "o",
    "en",
    "un",
    "una",
    "que",
    "con",
    "por",
    "para",
    "es",
    "se",
    "del",
    "al",
    "como",
    "más",
    "muy",
    "pero",
    "esto",
    "esta",
    "este",
    "hay",
}

TEMPLATE_HINTS = ("template", "plantilla", "worksheet", "elevator", "canvas", "checklist")


@dataclass
class SourceRecord:
    source_path: Path
    source_type: str
    domain: str
    output_json: Path
    run_id: str
    run_dt: datetime


def sanitize_slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "untitled"


def parse_run_dt(run_id: str) -> datetime:
    # run_YYYYMMDD_HHMMSS
    return datetime.strptime(run_id, "run_%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)


def collect_latest_records(runs_root: Path) -> dict[str, SourceRecord]:
    latest: dict[str, SourceRecord] = {}
    for manifest in runs_root.rglob("manifest.csv"):
        run_id = manifest.parent.name
        if not run_id.startswith("run_"):
            continue
        run_dt = parse_run_dt(run_id)
        with manifest.open("r", encoding="utf-8", newline="") as f:
            rows = csv.DictReader(f)
            for row in rows:
                source_path = row.get("source_path", "").strip()
                output_json = row.get("output_json", "").strip()
                source_type = row.get("source_type", "").strip()
                domain = row.get("domain", "").strip() or "Other"
                if not source_path or not output_json or not source_type:
                    continue
                current = latest.get(source_path)
                if current and current.run_dt >= run_dt:
                    continue
                latest[source_path] = SourceRecord(
                    source_path=Path(source_path),
                    source_type=source_type,
                    domain=domain,
                    output_json=Path(output_json),
                    run_id=run_id,
                    run_dt=run_dt,
                )
    return latest


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def split_sentences(text: str) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []
    chunks = re.split(r"(?<=[\.\!\?])\s+", text)
    return [c.strip() for c in chunks if len(c.strip()) > 30]


def extract_keywords(text: str, top_n: int = 10) -> list[str]:
    words = re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}", text.lower())
    words = [w for w in words if w not in STOPWORDS]
    counts = Counter(words)
    return [w for w, _ in counts.most_common(top_n)]


def extractive_summary(text: str, max_sentences: int = 5) -> list[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []
    words = [w for w in re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}", text.lower()) if w not in STOPWORDS]
    freq = Counter(words)
    scored: list[tuple[int, float, str]] = []
    for idx, sentence in enumerate(sentences):
        ws = [w for w in re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}", sentence.lower()) if w not in STOPWORDS]
        if not ws:
            continue
        score = sum(freq[w] for w in ws) / max(1, len(ws))
        scored.append((idx, score, sentence))
    if not scored:
        return sentences[:max_sentences]
    picked = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
    picked_sorted = sorted(picked, key=lambda x: x[0])
    return [p[2] for p in picked_sorted]


def classify_domain_module(source_path: Path, source_root: Path) -> tuple[str, str]:
    rel = source_path.relative_to(source_root)
    parts = rel.parts
    domain = parts[0] if len(parts) > 0 else "Other"
    module = parts[1] if len(parts) > 1 else "Unsorted"
    return domain, module


def ahash(frame_path: Path) -> int | None:
    img = cv2.imread(str(frame_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    resized = cv2.resize(img, (8, 8), interpolation=cv2.INTER_AREA)
    mean = resized.mean()
    bits = (resized > mean).flatten()
    value = 0
    for b in bits:
        value = (value << 1) | int(bool(b))
    return value


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def select_keyframes(evidence_rows: list[dict[str, Any]], max_frames: int = 10) -> list[dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    for row in evidence_rows:
        visual_type = row.get("visual_type", "unknown")
        ocr_text = normalize_text(row.get("ocr_text", ""))
        chunk_ts = float(row.get("t_start", 0.0))

        frame_paths = []
        frame_timestamps = []
        if row.get("frame_paths"):
            frame_paths = [p.strip() for p in str(row.get("frame_paths", "")).split("|") if p.strip()]
            frame_timestamps = [t.strip() for t in str(row.get("frame_timestamps", "")).split("|") if t.strip()]
        elif row.get("frame_path"):
            frame_paths = [str(row["frame_path"]).strip()]
            frame_timestamps = [str(chunk_ts)]

        for idx, fp in enumerate(frame_paths):
            ts = chunk_ts
            if idx < len(frame_timestamps):
                try:
                    ts = float(frame_timestamps[idx])
                except ValueError:
                    ts = chunk_ts
            c = candidates.get(fp)
            ocr_len = len(ocr_text)
            item = {
                "path": fp,
                "timestamp": ts,
                "visual_type": visual_type,
                "ocr_text": ocr_text,
                "ocr_len": ocr_len,
            }
            if c is None or (item["ocr_len"], item["timestamp"]) > (c["ocr_len"], c["timestamp"]):
                candidates[fp] = item

    ordered = sorted(candidates.values(), key=lambda x: x["timestamp"])
    if not ordered:
        return []

    groups: list[list[dict[str, Any]]] = []
    prev_hash: int | None = None
    for item in ordered:
        h = ahash(Path(item["path"]))
        item["hash"] = h
        if not groups:
            groups.append([item])
            prev_hash = h
            continue
        similar = False
        if prev_hash is not None and h is not None and hamming(prev_hash, h) <= 6:
            similar = True
        if similar:
            groups[-1].append(item)
        else:
            groups.append([item])
        prev_hash = h

    reduced: list[dict[str, Any]] = []
    for group in groups:
        best = max(group, key=lambda x: (x["ocr_len"], x["timestamp"]))
        reduced.append(best)

    if len(reduced) <= max_frames:
        return reduced

    # Keep first and last + top scored middle frames.
    first = reduced[0]
    last = reduced[-1]
    middle = reduced[1:-1]

    def score(item: dict[str, Any]) -> float:
        bonus = 0.0
        if item["visual_type"] in {"diagram_or_framework", "table", "chart_or_metrics"}:
            bonus += 30.0
        return float(item["ocr_len"]) + bonus

    ranked = sorted(middle, key=score, reverse=True)
    keep_middle = max(0, max_frames - 2)
    picked = sorted(ranked[:keep_middle], key=lambda x: x["timestamp"])
    return [first] + picked + [last]


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="H1Blue",
            parent=styles["Heading1"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0B3A53"),
        )
    )
    styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyText"], fontSize=9, leading=12))
    return styles


def safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        sanitized = text.encode("cp1252", errors="replace").decode("cp1252", errors="replace")
        print(sanitized)


def build_video_pack(record: SourceRecord, out_pdf: Path, source_root: Path) -> dict[str, Any]:
    evidence_rows = load_json(record.output_json)
    transcript = normalize_text(" ".join(row.get("transcript", "") for row in evidence_rows))
    ocr_blob = normalize_text(" ".join(row.get("ocr_text", "") for row in evidence_rows))
    summary = extractive_summary(transcript or ocr_blob, max_sentences=6)
    keywords = extract_keywords(transcript or ocr_blob, top_n=10)
    keyframes = select_keyframes(evidence_rows, max_frames=10)

    risk = "Riesgo de ejecutar sin evidencia suficiente o sin criterio compartido de decisión."
    if "precio" in (transcript + " " + ocr_blob).lower():
        risk = "Riesgo de competir solo por precio sin diferenciar propuesta de valor."
    if "pipeline" in (transcript + " " + ocr_blob).lower():
        risk = "Riesgo de pipeline inestable por falta de cadencia y seguimiento."

    action = "Definir una decisión concreta para las próximas 24-72h y validarla con evidencia del contenido."
    if "prospe" in transcript.lower():
        action = "Bloquear 2 sesiones de prospección en 48h y revisar métricas de respuesta."
    elif "canvas" in (transcript + " " + ocr_blob).lower():
        action = "Completar versión 1 del canvas con 3 hipótesis críticas y plan de validación en 72h."

    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(out_pdf),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
    )
    story: list[Any] = []
    story.append(Paragraph(f"Lesson Pack - {record.source_path.stem}", styles["Title"]))
    story.append(Paragraph(f"Fuente: {record.source_path}", styles["BodySmall"]))
    story.append(Paragraph(f"Run: {record.run_id} | Dominio: {record.domain}", styles["BodySmall"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Resumen Ejecutivo", styles["H1Blue"]))
    if summary:
        bullets = ListFlowable(
            [ListItem(Paragraph(s, styles["BodyText"])) for s in summary],
            bulletType="bullet",
            leftIndent=14,
        )
        story.append(bullets)
    else:
        story.append(Paragraph("No se pudo extraer resumen textual suficiente.", styles["BodyText"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Keywords Operativas", styles["H1Blue"]))
    story.append(Paragraph(", ".join(keywords) if keywords else "Sin keywords detectables", styles["BodyText"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Riesgo Principal", styles["H1Blue"]))
    story.append(Paragraph(risk, styles["BodyText"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Acción 24-72h", styles["H1Blue"]))
    story.append(Paragraph(action, styles["BodyText"]))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Capturas Clave", styles["H1Blue"]))
    if not keyframes:
        story.append(Paragraph("No hay capturas disponibles para esta fuente.", styles["BodyText"]))
    for kf in keyframes:
        fp = Path(kf["path"])
        if not fp.exists():
            continue
        story.append(Paragraph(f"t={kf['timestamp']:.1f}s | {kf['visual_type']}", styles["BodySmall"]))
        try:
            img = Image(str(fp))
            max_w = 17.5 * cm
            max_h = 8.7 * cm
            ratio = min(max_w / img.drawWidth, max_h / img.drawHeight)
            img.drawWidth *= ratio
            img.drawHeight *= ratio
            story.append(img)
        except Exception:
            story.append(Paragraph(f"No se pudo incrustar imagen: {fp}", styles["BodySmall"]))
        snippet = (kf.get("ocr_text") or "").strip()
        if snippet:
            story.append(Paragraph(f"OCR: {snippet[:350]}", styles["BodySmall"]))
        story.append(Spacer(1, 8))

    doc.build(story)
    rel_domain, rel_module = classify_domain_module(record.source_path, source_root)
    return {
        "source_path": str(record.source_path),
        "source_type": record.source_type,
        "domain": rel_domain,
        "module": rel_module,
        "lesson_pack_pdf": str(out_pdf),
        "run_id": record.run_id,
    }


def build_pdf_source_pack(record: SourceRecord, out_pdf: Path, source_root: Path) -> dict[str, Any]:
    pages = load_json(record.output_json)
    text = normalize_text(" ".join(p.get("text", "") for p in pages))
    summary = extractive_summary(text, max_sentences=6)
    keywords = extract_keywords(text, top_n=10)
    name_l = record.source_path.name.lower()
    is_template = any(h in name_l for h in TEMPLATE_HINTS)

    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(out_pdf),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
    )
    story: list[Any] = []
    story.append(Paragraph(f"Reference Pack - {record.source_path.stem}", styles["Title"]))
    story.append(Paragraph(f"Fuente: {record.source_path}", styles["BodySmall"]))
    story.append(Paragraph(f"Run: {record.run_id} | Dominio: {record.domain}", styles["BodySmall"]))
    story.append(Spacer(1, 8))

    if is_template:
        story.append(Paragraph("Tipo de documento: Plantilla", styles["H1Blue"]))
        story.append(Paragraph("Se conserva como plantilla original. No se reescribe su contenido.", styles["BodyText"]))
        story.append(Spacer(1, 8))

    story.append(Paragraph("Resumen Ejecutivo", styles["H1Blue"]))
    if summary:
        bullets = ListFlowable(
            [ListItem(Paragraph(s, styles["BodyText"])) for s in summary],
            bulletType="bullet",
            leftIndent=14,
        )
        story.append(bullets)
    else:
        story.append(Paragraph("Sin texto extraíble significativo.", styles["BodyText"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Keywords", styles["H1Blue"]))
    story.append(Paragraph(", ".join(keywords) if keywords else "Sin keywords detectables", styles["BodyText"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Extractos de páginas", styles["H1Blue"]))
    top_pages = sorted(pages, key=lambda x: len((x.get("text") or "").strip()), reverse=True)[:5]
    for p in top_pages:
        page_no = p.get("page", "?")
        snippet = normalize_text(p.get("text", ""))[:850]
        if not snippet:
            continue
        story.append(Paragraph(f"Página {page_no}", styles["BodySmall"]))
        story.append(Paragraph(snippet, styles["BodySmall"]))
        story.append(Spacer(1, 6))

    doc.build(story)
    rel_domain, rel_module = classify_domain_module(record.source_path, source_root)
    return {
        "source_path": str(record.source_path),
        "source_type": record.source_type,
        "domain": rel_domain,
        "module": rel_module,
        "lesson_pack_pdf": str(out_pdf),
        "run_id": record.run_id,
        "is_template": str(is_template),
    }


def build_sheet_pack(record: SourceRecord, out_pdf: Path, source_root: Path) -> dict[str, Any]:
    metadata = load_json(record.output_json)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(str(out_pdf), pagesize=A4)
    story: list[Any] = []
    story.append(Paragraph(f"Spreadsheet Pack - {record.source_path.stem}", styles["Title"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"Ruta origen: {record.source_path}", styles["BodyText"]))
    story.append(Paragraph(f"Tamaño bytes: {metadata.get('file_size_bytes', 'n/a')}", styles["BodyText"]))
    story.append(Paragraph("Tipo: plantilla/referencia operativa.", styles["BodyText"]))
    doc.build(story)
    rel_domain, rel_module = classify_domain_module(record.source_path, source_root)
    return {
        "source_path": str(record.source_path),
        "source_type": record.source_type,
        "domain": rel_domain,
        "module": rel_module,
        "lesson_pack_pdf": str(out_pdf),
        "run_id": record.run_id,
    }


def build_module_catalog(
    module: tuple[str, str],
    rows: list[dict[str, Any]],
    out_pdf: Path,
) -> None:
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    doc = SimpleDocTemplate(str(out_pdf), pagesize=A4)
    domain, module_name = module
    story: list[Any] = []
    story.append(Paragraph(f"Módulo Pack - {domain} / {module_name}", styles["Title"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"Fuentes incluidas: {len(rows)}", styles["BodyText"]))
    story.append(Spacer(1, 8))
    for r in sorted(rows, key=lambda x: x["source_path"]):
        story.append(Paragraph(Path(r["source_path"]).name, styles["BodySmall"]))
        story.append(Paragraph(f"Pack: {r['lesson_pack_pdf']}", styles["BodySmall"]))
        story.append(Spacer(1, 4))
    doc.build(story)


def main() -> None:
    parser = argparse.ArgumentParser(description="Construye packs PDF completos reutilizando extracción multimodal.")
    parser.add_argument("--source-root", default=r"C:\Users\kevin\Documents\ThePower")
    parser.add_argument("--runs-root", default=r"C:\Users\kevin\Documents\Playground\data\thepower\multimodal\runs")
    parser.add_argument("--output-root", default=r"C:\Users\kevin\Documents\Playground\data\thepower\pdf_packs")
    parser.add_argument("--max-sources", type=int, default=0, help="0 = todas")
    args = parser.parse_args()

    source_root = Path(args.source_root)
    runs_root = Path(args.runs_root)
    output_root = Path(args.output_root)
    run_id = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    run_dir = output_root / run_id
    lesson_dir = run_dir / "lesson_packs"
    module_dir = run_dir / "module_packs"
    run_dir.mkdir(parents=True, exist_ok=True)

    latest = collect_latest_records(runs_root)
    records = sorted(latest.values(), key=lambda r: str(r.source_path))
    if args.max_sources > 0:
        records = records[: args.max_sources]

    manifest_rows: list[dict[str, Any]] = []
    for idx, record in enumerate(records, start=1):
        rel = record.source_path.relative_to(source_root)
        target = lesson_dir / rel.parent / f"{sanitize_slug(record.source_path.stem)}.pdf"
        try:
            if record.source_type == "Video":
                row = build_video_pack(record, target, source_root)
            elif record.source_type == "PDF":
                row = build_pdf_source_pack(record, target, source_root)
            elif record.source_type == "Spreadsheet":
                row = build_sheet_pack(record, target, source_root)
            else:
                continue
            row["build_index"] = idx
            manifest_rows.append(row)
            safe_print(f"[{idx}/{len(records)}] OK {record.source_type} -> {target}")
        except Exception as exc:  # noqa: BLE001
            manifest_rows.append(
                {
                    "source_path": str(record.source_path),
                    "source_type": record.source_type,
                    "domain": record.domain,
                    "module": "",
                    "lesson_pack_pdf": "",
                    "run_id": record.run_id,
                    "error": str(exc),
                    "build_index": idx,
                }
            )
            safe_print(f"[{idx}/{len(records)}] ERROR {record.source_path}: {exc}")

    # Module-level catalogs
    by_module: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in manifest_rows:
        if r.get("lesson_pack_pdf"):
            by_module[(r.get("domain", "Other"), r.get("module", "Unsorted"))].append(r)
    for mod, rows in by_module.items():
        domain_slug = sanitize_slug(mod[0])
        module_slug = sanitize_slug(mod[1])
        out_pdf = module_dir / domain_slug / f"{module_slug}.pdf"
        build_module_catalog(mod, rows, out_pdf)

    manifest_path = run_dir / "pdf_packs_manifest.csv"
    fieldnames = sorted({k for row in manifest_rows for k in row.keys()})
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    summary = {
        "run_id": run_id,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "sources_total": len(records),
        "packs_ok": sum(1 for r in manifest_rows if r.get("lesson_pack_pdf")),
        "packs_error": sum(1 for r in manifest_rows if r.get("error")),
        "manifest_csv": str(manifest_path),
        "lesson_packs_dir": str(lesson_dir),
        "module_packs_dir": str(module_dir),
    }
    summary_path = run_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    safe_print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
