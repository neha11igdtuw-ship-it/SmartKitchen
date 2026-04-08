#!/usr/bin/env python3
"""
Train pantry expiry-risk models from synthetic data (rule-based labels + noise).
Outputs joblib bundles for the FastAPI inference server.

Usage (from ml-service/):
  python3 -m venv .venv && source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt
  python train.py
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_DIR = Path(__file__).resolve().parent / "models"
CATEGORIES = ["Bakery", "Produce", "Dairy", "Grains", "Pantry"]
RISK_LABELS = ["good", "warning", "critical"]  # 0, 1, 2

RNG = np.random.default_rng(42)


def cat_vec(cat: str) -> list[float]:
    return [1.0 if cat == c else 0.0 for c in CATEGORIES]


def rule_risk(days_left: float) -> int:
    if days_left <= 3:
        return 2
    if days_left <= 7:
        return 1
    return 0


def rule_urgency(days_left: float, perishable: int) -> float:
    """0 = low urgency, 1 = act now."""
    d = max(-5.0, min(120.0, days_left))
    base = 1.0 - min(1.0, (d + 2) / 35.0)
    boost = 0.15 * perishable
    return float(np.clip(base * (0.75 + 0.25 * perishable) + boost * 0.2, 0.0, 1.0))


def build_synthetic(n_samples: int = 12_000) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    rows = []
    y_risk = []
    y_urg = []
    for _ in range(n_samples):
        cat = random.choice(CATEGORIES)
        perishable = 1 if cat in ("Produce", "Dairy", "Bakery") else 0
        days = float(RNG.integers(-3, 90))
        qty = float(RNG.uniform(0.2, 25.0))
        qty_log = np.log1p(qty)

        # Label noise (realistic OCR / user date errors)
        days_noisy = days + RNG.normal(0, 1.2)
        r = rule_risk(days_noisy)
        if RNG.random() < 0.04:
            r = int(np.clip(r + RNG.choice([-1, 0, 1]), 0, 2))

        u = rule_urgency(days_noisy, perishable) + float(RNG.normal(0, 0.04))
        u = float(np.clip(u, 0.0, 1.0))

        feat = [days_noisy, qty_log, float(perishable)] + cat_vec(cat)
        rows.append(feat)
        y_risk.append(r)
        y_urg.append(u)

    cols = ["days_left", "qty_log", "perishable"] + [f"cat_{c}" for c in CATEGORIES]
    X = pd.DataFrame(rows, columns=cols)
    return X, np.array(y_risk), np.array(y_urg)


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    X, y_risk, y_urg = build_synthetic()

    X_train, X_test, yr_train, yr_test, yu_train, yu_test = train_test_split(
        X, y_risk, y_urg, test_size=0.15, random_state=42, stratify=y_risk
    )

    clf = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=96,
                    max_depth=12,
                    min_samples_leaf=2,
                    class_weight="balanced",
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    clf.fit(X_train, yr_train)
    acc = float((clf.predict(X_test) == yr_test).mean())
    print(f"Expiry risk classifier test accuracy: {acc:.4f}")

    reg = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "gb",
                GradientBoostingRegressor(
                    n_estimators=120,
                    max_depth=4,
                    learning_rate=0.08,
                    random_state=42,
                ),
            ),
        ]
    )
    reg.fit(X_train, yu_train)
    mae = float(np.mean(np.abs(reg.predict(X_test) - yu_test)))
    print(f"Urgency regressor test MAE: {mae:.4f}")

    meta = {
        "version": "1.0.0",
        "risk_labels": RISK_LABELS,
        "categories": CATEGORIES,
        "feature_columns": list(X.columns),
        "metrics": {"risk_accuracy": acc, "urgency_mae": mae},
    }

    joblib.dump(clf, MODEL_DIR / "expiry_risk_clf.joblib")
    joblib.dump(reg, MODEL_DIR / "urgency_reg.joblib")
    (MODEL_DIR / "model_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote models to {MODEL_DIR}")


if __name__ == "__main__":
    main()
