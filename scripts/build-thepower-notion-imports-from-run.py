#!/usr/bin/env python
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STOPWORDS_ES = {
    "de",
    "la",
    "el",
    "y",
    "en",
    "que",
    "a",
    "los",
    "las",
    "un",
    "una",
    "por",
    "con",
    "para",
    "es",
    "se",
    "del",
    "al",
    "como",
    "más",
    "mas",
    "lo",
    "le",
    "su",
    "yo",
    "tú",
    "tu",
    "mi",
    "me",
    "te",
    "nos",
    "si",
    "no",
}


def load_json(path: Path) -> list[dict[str, Any]] | dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fields = sorted({k for r in rows for k in r.keys()})
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}", text.lower())
    return [w for w in words if w not in STOPWORDS_ES]


def top_keywords(text: str, n: int = 8) -> list[str]:
    counts = Counter(tokenize(text))
    return [w for w, _ in counts.most_common(n)]


def build_decision_rule(transcript: str, keywords: list[str]) -> str:
    text = transcript.lower()
    if "objetivo" in text or "goal" in text:
        return "Si no hay objetivo cuantificado, entonces definir meta numerica y fecha antes de ejecutar."
    if "stakeholder" in text:
        return "Si no hay stakeholder map, entonces no avanzar fase comercial sin responsable y apoyo identificado."
    if "métrica" in text or "kpi" in text or "conversion" in text:
        return "Si no existe KPI leading por etapa, entonces no escalar acciones hasta instrumentar medicion."
    if keywords:
        return f"Si detectas contexto '{keywords[0]}', entonces valida evidencia y define siguiente microcompromiso."
    return "Si faltan datos criticos, entonces ejecutar validacion rapida antes de decidir."


def build_risk(transcript: str) -> str:
    text = transcript.lower()
    if "imposible" in text:
        return "Riesgo de objetivos no creibles sin plan intermedio; puede bloquear ejecucion del equipo."
    if "descargas" in text or "downloads" in text:
        return "Riesgo de foco excesivo en volumen sin calidad de retencion o monetizacion."
    return "Riesgo de ejecutar por intuicion sin criterio trazable a evidencia."


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera CSV Notion desde un run multimodal")
    parser.add_argument("--run-dir", required=True, help="Ruta de run, ej: ...\\runs\\run_YYYYMMDD_HHMMSS")
    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    manifest_path = run_dir / "manifest.csv"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No existe manifest.csv en {run_dir}")

    manifest_rows: list[dict[str, Any]] = []
    with manifest_path.open("r", encoding="utf-8", newline="") as f:
        manifest_rows = list(csv.DictReader(f))

    now = datetime.now(timezone.utc).isoformat()

    sources_rows: list[dict[str, Any]] = []
    evidence_rows: list[dict[str, Any]] = []
    advisor_rows: list[dict[str, Any]] = []

    for row in manifest_rows:
        source_path = row.get("source_path", "")
        domain = row.get("domain", "")
        source_type = row.get("source_type", "")
        output_json = Path(row.get("output_json", ""))
        source_id = re.sub(r"[^a-zA-Z0-9]+", "-", source_path).strip("-").lower()

        sources_rows.append(
            {
                "source_id": source_id,
                "source_path": source_path,
                "domain": domain,
                "source_type": source_type,
                "status_ingest": "Processed",
                "run_dir": str(run_dir),
                "created_at_utc": now,
            }
        )

        payload = load_json(output_json)
        if source_type == "Video":
            chunks = payload if isinstance(payload, list) else []
            joined_transcript_parts: list[str] = []
            joined_ocr_parts: list[str] = []
            for chunk in chunks:
                transcript = str(chunk.get("transcript", "")).strip()
                ocr_text = str(chunk.get("ocr_text", "")).strip()
                joined_transcript_parts.append(transcript)
                joined_ocr_parts.append(ocr_text)
                evidence_rows.append(
                    {
                        "source_id": source_id,
                        "domain": domain,
                        "source_type": "Video",
                        "chunk_index": chunk.get("chunk_index", ""),
                        "t_start": chunk.get("t_start", ""),
                        "t_end": chunk.get("t_end", ""),
                        "transcript": transcript,
                        "ocr_text": ocr_text,
                        "visual_type": chunk.get("visual_type", ""),
                        "visual_summary": chunk.get("visual_summary", ""),
                        "frame_path": chunk.get("frame_path", ""),
                        "evidence_ref": f"{source_path}#t={chunk.get('t_start', '')}-{chunk.get('t_end', '')}",
                        "created_at_utc": now,
                    }
                )
            transcript_all = " ".join(joined_transcript_parts)
            ocr_all = " ".join(joined_ocr_parts)
            keywords = top_keywords(transcript_all + " " + ocr_all, n=8)
            advisor_rows.append(
                {
                    "title": Path(source_path).stem,
                    "domain": domain,
                    "insight_operativo": (
                        "Sintetizar objetivo, palanca de crecimiento y condicion de ejecucion observada en la leccion."
                    ),
                    "decision_rule": build_decision_rule(transcript_all, keywords),
                    "risks": build_risk(transcript_all),
                    "early_signals": "Seguimiento de KPI leading y cumplimiento de microcompromisos por etapa.",
                    "next_24_72h": "Aplicar la regla en un caso real y registrar resultado con metrica.",
                    "metric_impact": "Conversion por etapa, velocidad de ciclo, avance de objetivo.",
                    "evidence_refs": f"{source_path} (chunks: {len(chunks)})",
                    "publish_status": "Draft-AI",
                    "keywords": ", ".join(keywords),
                    "created_at_utc": now,
                }
            )
        elif source_type == "PDF":
            pages = payload if isinstance(payload, list) else []
            full_text_parts: list[str] = []
            for page in pages:
                page_num = page.get("page", "")
                text = str(page.get("text", "")).strip()
                full_text_parts.append(text)
                evidence_rows.append(
                    {
                        "source_id": source_id,
                        "domain": domain,
                        "source_type": "PDF",
                        "chunk_index": page_num,
                        "t_start": "",
                        "t_end": "",
                        "transcript": text,
                        "ocr_text": "",
                        "visual_type": "pdf_page",
                        "visual_summary": "",
                        "frame_path": "",
                        "evidence_ref": f"{source_path}#page={page_num}",
                        "created_at_utc": now,
                    }
                )
            pdf_text = " ".join(full_text_parts)
            if pdf_text.strip():
                keywords = top_keywords(pdf_text, n=8)
                advisor_rows.append(
                    {
                        "title": Path(source_path).stem,
                        "domain": domain,
                        "insight_operativo": "Extraer principios accionables desde material documental y convertirlos en criterio de decision.",
                        "decision_rule": build_decision_rule(pdf_text, keywords),
                        "risks": build_risk(pdf_text),
                        "early_signals": "Validar aplicabilidad del marco en caso real con KPI y ventana temporal definida.",
                        "next_24_72h": "Aplicar una recomendacion del documento en un caso real y registrar resultado.",
                        "metric_impact": "Calidad de decision, velocidad de ejecucion y riesgo evitado.",
                        "evidence_refs": f"{source_path} (pages: {len(pages)})",
                        "publish_status": "Draft-AI",
                        "keywords": ", ".join(keywords),
                        "created_at_utc": now,
                    }
                )
        else:
            # Spreadsheet metadata: card operativa de nivel inicial.
            advisor_rows.append(
                {
                    "title": Path(source_path).stem,
                    "domain": domain,
                    "insight_operativo": "Detectar estructura de metricas y convertirla en uso operativo para decisiones semanales.",
                    "decision_rule": "Si una metrica no tiene definicion, frecuencia y umbral, entonces no usarla para decidir.",
                    "risks": "Riesgo de lectura inconsistente de KPI por falta de definicion operativa.",
                    "early_signals": "Diferencias de interpretacion entre equipos sobre la misma metrica.",
                    "next_24_72h": "Definir diccionario KPI minimo y vincularlo a una decision concreta.",
                    "metric_impact": "Consistencia de reporting y foco de ejecucion.",
                    "evidence_refs": source_path,
                    "publish_status": "Draft-AI",
                    "keywords": "kpi, metricas, reporting, decision",
                    "created_at_utc": now,
                }
            )

    exports_dir = run_dir / "notion_imports"
    write_csv(exports_dir / "sources.csv", sources_rows)
    write_csv(exports_dir / "evidence_chunks.csv", evidence_rows)
    write_csv(exports_dir / "advisor_knowledge_draft.csv", advisor_rows)

    print(f"Notion exports generated in: {exports_dir}")
    print(f" - sources.csv: {len(sources_rows)} rows")
    print(f" - evidence_chunks.csv: {len(evidence_rows)} rows")
    print(f" - advisor_knowledge_draft.csv: {len(advisor_rows)} rows")


if __name__ == "__main__":
    main()
