"""
Flask ML inference for SmartKitchen — expiry risk + urgency scores + pantry insights.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

MODEL_DIR = Path(__file__).resolve().parent / "models"

clf_pipe = None
reg_pipe = None
meta: dict[str, Any] = {}


def load_models() -> None:
    global clf_pipe, reg_pipe, meta
    meta_path = MODEL_DIR / "model_meta.json"
    clf_path = MODEL_DIR / "expiry_risk_clf.joblib"
    reg_path = MODEL_DIR / "urgency_reg.joblib"
    if not clf_path.is_file() or not reg_path.is_file():
        raise RuntimeError(
            "Trained models not found. Run: cd ml-service && pip install -r requirements.txt && python train.py"
        )
    clf_pipe = joblib.load(clf_path)
    reg_pipe = joblib.load(reg_path)
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))


app = Flask(__name__)


@app.before_request
def _ensure_models() -> None:
    if clf_pipe is None or reg_pipe is None:
        load_models()


def row_features(it: dict) -> list[float]:
    cat = it.get("cat") or "Pantry"
    cats = meta.get("categories", ["Bakery", "Produce", "Dairy", "Grains", "Pantry"])
    if cat not in cats:
        cat = "Pantry"
    qty = float(it.get("qty") or 1.0)
    qty_log = float(np.log1p(max(qty, 0.01)))
    perishable = 1.0 if cat in ("Produce", "Dairy", "Bakery") else 0.0
    one = [1.0 if cat == c else 0.0 for c in cats]
    days_left = float(it.get("days_left") or 30.0)
    return [days_left, qty_log, perishable] + one


def build_insights(items_out: list[dict], pantry_items: list[dict]) -> list[str]:
    insights: list[str] = []
    if not pantry_items:
        return ["Add pantry items to unlock ML-based risk scoring."]
    crit = sum(1 for x in items_out if x.get("riskClass") == "critical")
    warn = sum(1 for x in items_out if x.get("riskClass") == "warning")
    dairy = sum(1 for p in pantry_items if p.get("cat") == "Dairy")
    produce = sum(1 for p in pantry_items if p.get("cat") == "Produce")
    n = len(pantry_items)
    if crit > 0:
        insights.append(f"{crit} item(s) predicted as critical risk — prioritize cooking or freezing.")
    if warn > 0 and crit == 0:
        insights.append(f"{warn} item(s) in the warning window; plan meals this week.")
    if n and dairy / n > 0.35:
        insights.append("High dairy share: shorter effective shelf life — check fridge items first.")
    if n and produce / n > 0.4:
        insights.append("Produce-heavy inventory: spoilage risk rises — use leafy greens within a few days.")
    avg_u = float(np.mean([x.get("mlUrgency", 0) for x in items_out])) if items_out else 0.0
    if avg_u > 0.55:
        insights.append("Overall pantry urgency is elevated — consider a focused use-up week.")
    elif avg_u < 0.25 and n >= 4:
        insights.append("Pantry looks stable; good time to restock grains and dry goods.")
    if not insights:
        insights.append("ML model: risk spread looks manageable with current dates and categories.")
    return insights[:5]


@app.route("/health", methods=["GET"])
def health() -> Any:
    ok = clf_pipe is not None and reg_pipe is not None
    return jsonify(
        {
            "ok": ok,
            "service": "smartkitchen-ml",
            "modelVersion": meta.get("version", "unknown"),
        }
    )


@app.route("/predict", methods=["POST"])
def predict() -> Any:
    if clf_pipe is None or reg_pipe is None:
        return jsonify({"ok": False, "error": "Models not loaded"}), 503
    body = request.get_json(silent=True) or {}
    pantry_items = body.get("pantryItems") or []
    labels = meta.get("risk_labels", ["good", "warning", "critical"])
    cols = meta.get("feature_columns")
    if not cols:
        cols = ["days_left", "qty_log", "perishable"] + [
            f"cat_{c}" for c in meta.get("categories", [])
        ]

    per_item: list[dict[str, Any]] = []
    for it in pantry_items:
        if not isinstance(it, dict):
            continue
        feat = row_features(it)
        X = pd.DataFrame([feat], columns=cols)
        proba = clf_pipe.predict_proba(X)[0].tolist()
        pred_idx = int(np.argmax(proba))
        risk_class = labels[pred_idx] if pred_idx < len(labels) else labels[0]
        urgency = float(reg_pipe.predict(X)[0])
        urgency = float(np.clip(urgency, 0.0, 1.0))
        prob_obj = {labels[i]: round(float(proba[i]), 4) for i in range(min(len(labels), len(proba)))}
        per_item.append(
            {
                "name": (it.get("name") or "Item").strip() or "Item",
                "riskClass": risk_class,
                "riskProb": prob_obj,
                "mlUrgency": round(urgency, 4),
                "mlConfidence": round(float(max(proba)), 4),
            }
        )

    if per_item:
        mean_u = float(np.mean([p["mlUrgency"] for p in per_item]))
        crit_n = sum(1 for p in per_item if p["riskClass"] == "critical")
        health_score = max(0, min(100, round(100 * (1 - 0.65 * mean_u - 0.08 * crit_n))))
    else:
        mean_u = 0.0
        health_score = 100

    insight_texts = build_insights(per_item, pantry_items if isinstance(pantry_items, list) else [])

    return jsonify(
        {
            "ok": True,
            "modelVersion": meta.get("version", "1.0.0"),
            "pantryHealthScore": int(health_score),
            "meanUrgency": round(mean_u, 4),
            "perItem": per_item,
            "insights": insight_texts,
        }
    )


if __name__ == "__main__":
    import os

    load_models()
    port = int(os.environ.get("ML_PORT", "5050"))
    app.run(host="127.0.0.1", port=port, debug=False)
