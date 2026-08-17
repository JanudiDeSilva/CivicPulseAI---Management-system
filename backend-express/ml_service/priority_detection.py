"""
CivicPulse Priority Prediction & Duplicate Detection Service.

This module provides:
1. Priority Prediction - ML-based severity scoring for citizen complaints using
   TF-IDF text features + categorical risk factors.
2. Duplicate Detection - TF-IDF + cosine similarity clustering to detect when
   multiple citizens report the same problem in different words, so admins
   see ONE combined incident.
"""

import re
import math
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ============================================================
# CATEGORY RISK WEIGHTS
# ============================================================
# Base risk contribution per category (higher = more inherently risky).
# These are domain priors, not hardcoded predictions.

CATEGORY_RISK = {
    "flood":        0.65,
    "road_damage":  0.72,
    "garbage":      0.45,
    "power_failure": 0.80,
    "street_light": 0.35,
    "other":        0.40,
}

# ============================================================
# SEVERITY KEYWORD SIGNALS
# ============================================================
# Each keyword group maps to a weighted risk contribution.
# These are feature signals fed into the score, not outputs.

CRITICAL_SIGNALS = [
    "emergency", "trapped", "casualty", "fire", "danger",
    "burst", "life threatening", "death", "injured", "injury",
    "electrocution", "electrocuted", "downed line", "live wire",
    "fallen wire", "explosion", "exploding", "submerged",
    "drowning", "collapse", "collapsed", "structural damage",
    "gas leak", "toxic", "critical", "intensive care",
    "trapped under", "unconscious", "ambulance",
]

HIGH_SIGNALS = [
    "blocked", "damage", "blackout", "hazard", "hazardous",
    "flooding", "overflow", "severe", "heavy rain", "inundat",
    "water entering", "waist deep", "pothole", "crater",
    "manhole", "broken pipe", "main road", "highway",
    "sparking", "transformer", "caved", "caved-in",
    "sinkhole", "dark road", "no light", "pitch black",
]

MEDIUM_SIGNALS = [
    "leak", "crack", "cracked", "potholes", "light out",
    "waste", "stagnant", "garbage", "overflowing", "foul odor",
    "smell", "rats", "pest", "flicker", "flickering",
    "partial", "intermittent", "slow draining", "drainage",
    "waterlogging", "mosquito", "dengue",
]

# ============================================================
# TEXT NORMALIZATION
# ============================================================

STOPWORDS = set(
    """
    a an and are as at be but by for from has he her his i if in is it its
    of on or that the their them they this to was we with you your our
    my me up out over under about into after before during off down
    please kind help want need let know regarding issue problem complaint
    report there here where when how what which who whom
    """.split()
)


def normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> list:
    """Return filtered tokens without stopwords."""
    tokens = normalize_text(text).split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 2]


# ============================================================
# PRIORITY PREDICTION (Supervised-style scoring using
# TF-IDF text features + category priors + district risk)
# ============================================================

class PriorityPredictor:
    """Predicts a severity score 0..1 for a complaint.

    Uses a weighted ensemble of:
      - TF-IDF cosine similarity to known critical/high/medium signal texts.
      - Category prior risk.
      - Keyword signal hits.
      - District-level flood baseline when available.
    """

    def __init__(self):
        self.tfidf = TfidfVectorizer(
            analyzer="word",
            tokenizer=tokenize,
            preprocessor=normalize_text,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=5000,
        )
        # Signal corpus built lazily on first use.
        self._signal_corpus = None
        self._signal_labels = None
        self._signal_matrix = None

    def _build_signal_corpus(self):
        """Build the reference corpus from keyword signals."""
        if self._signal_corpus is not None:
            return

        corpus = []
        labels = []

        # Each critical signal becomes a reference document.
        for s in CRITICAL_SIGNALS:
            corpus.append(s)
            labels.append("critical")

        for s in HIGH_SIGNALS:
            corpus.append(s)
            labels.append("high")

        for s in MEDIUM_SIGNALS:
            corpus.append(s)
            labels.append("medium")

        self._signal_corpus = corpus
        self._signal_labels = labels

        # Fit TF-IDF once and store.
        self.tfidf.fit(corpus)
        self._signal_matrix = self.tfidf.transform(corpus)

    def predict(
        self,
        *,
        category: str,
        raw_text: str = "",
        specific_details: str = "",
        district: str = "",
        district_flood_risk: float = 0.0,
        has_photo: bool = False,
        image_analysis_score: float = 0.0,
    ) -> dict:
        """Compute severity score for a complaint.

        Returns:
        {
          "severity_score": float 0..1,
          "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          "confidence": float 0..1,
          "signals_found": { "critical": [...], "high": [...], "medium": [...] },
          "category_risk": float,
          "district_risk": float,
          "text_risk": float,
          "photo_risk": float,
        }
        """
        self._build_signal_corpus()

        combined_text = f"{raw_text} {specific_details}"

        # --------------------------------------------------------
        # 1. TF-IDF text similarity to signal corpus
        # --------------------------------------------------------
        text_vec = self.tfidf.transform([combined_text])

        similarities = cosine_similarity(
            text_vec,
            self._signal_matrix
        )[0]

        # Weighted similarity by signal severity
        text_risk = 0.0
        signal_hits = defaultdict(list)

        for idx, sim in enumerate(similarities):
            label = self._signal_labels[idx]

            if sim < 0.12:
                continue

            if label == "critical":
                weight = 1.0
                text_risk = max(text_risk, sim * 0.95)
            elif label == "high":
                weight = 0.75
                text_risk = max(text_risk, sim * 0.72)
            else:
                weight = 0.5
                text_risk = max(text_risk, sim * 0.45)

            signal_hits[label].append(
                self._signal_corpus[idx]
            )

        # Keyword hit booster (captures exact matches that TF-IDF
        # may dilute in short texts)
        keyword_boost = 0.0
        kw_matches = {"critical": [], "high": [], "medium": []}

        normalized = normalize_text(combined_text)

        for kw in CRITICAL_SIGNALS:
            if kw in normalized:
                kw_matches["critical"].append(kw)
                keyword_boost = max(keyword_boost, 0.85)

        for kw in HIGH_SIGNALS:
            if kw in normalized:
                kw_matches["high"].append(kw)
                keyword_boost = max(keyword_boost, 0.65)

        for kw in MEDIUM_SIGNALS:
            if kw in normalized:
                kw_matches["medium"].append(kw)
                keyword_boost = max(keyword_boost, 0.4)

        # Merge signal hits from both methods
        for level in ("critical", "high", "medium"):
            seen = set(signal_hits[level])
            for x in kw_matches[level]:
                if x not in seen:
                    signal_hits[level].append(x)

        text_risk = max(text_risk, keyword_boost)

        # --------------------------------------------------------
        # 2. Category prior
        # --------------------------------------------------------
        category_risk = CATEGORY_RISK.get(
            category,
            CATEGORY_RISK["other"]
        )

        # --------------------------------------------------------
        # 3. District flood baseline
        # --------------------------------------------------------
        district_risk = float(
            district_flood_risk or 0.0
        )
        if district_risk <= 0 and district:
            district_risk = 0.15  # mild unknown-district baseline

        # --------------------------------------------------------
        # 4. Photo / image score
        # --------------------------------------------------------
        photo_risk = float(
            image_analysis_score or 0.0
        )
        if has_photo and photo_risk <= 0:
            photo_risk = 0.1  # photo present provides some signal

        # --------------------------------------------------------
        # Combine into final score
        # --------------------------------------------------------
        # Weighted ensemble:
        #   40% text, 25% category, 15% district, 20% photo
        raw_score = (
            text_risk * 0.40
            + category_risk * 0.25
            + district_risk * 0.15
            + photo_risk * 0.20
        )

        # Any critical keyword directly floors the score
        if kw_matches["critical"] or signal_hits["critical"]:
            raw_score = max(raw_score, 0.82)

        # Number of high signals adds a small boost
        high_count = (
            len(signal_hits["high"])
            + len(kw_matches["high"])
        )
        if high_count >= 2:
            raw_score = min(1.0, raw_score + 0.08)

        severity_score = round(
            float(np.clip(raw_score, 0.0, 1.0)),
            4
        )

        # --------------------------------------------------------
        # 5. Risk level mapping
        # --------------------------------------------------------
        if severity_score >= 0.80:
            risk_level = "CRITICAL"
        elif severity_score >= 0.60:
            risk_level = "HIGH"
        elif severity_score >= 0.35:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # --------------------------------------------------------
        # 6. Confidence
        # --------------------------------------------------------
        # Confidence is higher when the signal is clear.
        signal_count = (
            len(signal_hits["critical"])
            + len(signal_hits["high"])
            + len(signal_hits["medium"])
        )

        if signal_count >= 3:
            confidence = 0.90
        elif signal_count == 2:
            confidence = 0.82
        elif signal_count == 1:
            confidence = 0.70
        elif text_risk > 0.3:
            confidence = 0.60
        else:
            confidence = 0.45

        confidence = round(confidence, 4)

        return {
            "severity_score": severity_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "signals_found": {
                "critical": signal_hits["critical"],
                "high": signal_hits["high"],
                "medium": signal_hits["medium"],
            },
            "category_risk": round(category_risk, 4),
            "district_risk": round(district_risk, 4),
            "text_risk": round(text_risk, 4),
            "photo_risk": round(photo_risk, 4),
        }


# ============================================================
# DUPLICATE DETECTION (Unsupervised clustering using
# TF-IDF + cosine similarity)
# ============================================================

class DuplicateDetector:
    """Detects duplicate complaints about the same problem.

    Maintains an in-memory corpus of all submitted complaints.
    When a new complaint arrives, its text is compared against
    the corpus using a hybrid of:
      - TF-IDF cosine similarity
      - Token/keyword overlap (Jaccard-like)
    If the combined score exceeds the threshold, the complaint
    is flagged as a duplicate of the best-matching cluster.
    """

    SIMILARITY_THRESHOLD = 0.45

    def __init__(self):
        # incident_id -> {"complaints": [document strings]}
        self.incidents = {}
        self.tfidf = TfidfVectorizer(
            analyzer="word",
            tokenizer=tokenize,
            preprocessor=normalize_text,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=5000,
            min_df=1,
        )
        self._corpus = []
        self._incident_of_doc = []  # incident_id per document
        self._matrix = None
        self._fitted = False

    def _rebuild_matrix(self):
        if not self._corpus:
            self._matrix = None
            self._fitted = False
            return
        self._matrix = self.tfidf.fit_transform(self._corpus)
        self._fitted = True

    @staticmethod
    def _token_overlap(doc_a: str, doc_b: str) -> float:
        """Jaccard-style token overlap score between two documents."""
        tokens_a = set(tokenize(doc_a))
        tokens_b = set(tokenize(doc_b))

        if not tokens_a or not tokens_b:
            return 0.0

        intersection = tokens_a.intersection(tokens_b)
        union = tokens_a.union(tokens_b)

        # Jaccard similarity
        jaccard = len(intersection) / len(union)

        # Emphasis on shared tokens (even in different order)
        shared_ratio = len(intersection) / max(
            len(tokens_a),
            len(tokens_b)
        )

        # Combine: 60% Jaccard + 40% shared-ratio
        return 0.6 * jaccard + 0.4 * shared_ratio

    def register_complaint(
        self,
        *,
        complaint_id: str,
        incident_id: str,
        category: str,
        raw_text: str,
        specific_details: str = "",
    ) -> None:
        """Add a complaint to the corpus and index it."""
        doc = f"{category} {raw_text} {specific_details}".strip()
        self._corpus.append(doc)
        self._incident_of_doc.append(incident_id)

        if incident_id not in self.incidents:
            self.incidents[incident_id] = {
                "category": category,
                "complaints": [],
                "texts": [],
                "report_ids": [],
            }

        self.incidents[incident_id]["complaints"].append(
            complaint_id
        )
        self.incidents[incident_id]["texts"].append(doc)

        self._rebuild_matrix()

    def detect_duplicate(
        self,
        *,
        category: str,
        raw_text: str,
        specific_details: str = "",
    ) -> dict:
        """Check if the given complaint is a duplicate.

        Returns:
        {
          "is_duplicate": bool,
          "similarity_score": float 0..1,
          "matched_incident_id": str | null,
          "matched_report_ids": [str],
          "matched_text": str | null,
        }
        """
        if not self._corpus:
            return {
                "is_duplicate": False,
                "similarity_score": 0.0,
                "matched_incident_id": None,
                "matched_report_ids": [],
                "matched_text": None,
            }

        doc = f"{category} {raw_text} {specific_details}".strip()

        # Build a combined vectorizer that includes the new doc
        # so it gets the same feature space.
        all_docs = self._corpus + [doc]
        vec = TfidfVectorizer(
            analyzer="word",
            tokenizer=tokenize,
            preprocessor=normalize_text,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=5000,
            min_df=1,
        )
        matrix = vec.fit_transform(all_docs)

        query_vec = matrix[-1]  # the new doc
        corpus_vec = matrix[:-1]

        tfidf_similarities = cosine_similarity(
            query_vec,
            corpus_vec
        )[0]

        # Combine TF-IDF with token overlap
        combined_scores = []
        for idx in range(len(self._corpus)):
            overlap = self._token_overlap(
                doc,
                self._corpus[idx]
            )
            tfidf_score = float(
                tfidf_similarities[idx]
            )
            # Hybrid: 70% TF-IDF + 30% token overlap
            combined = 0.7 * tfidf_score + 0.3 * overlap
            combined_scores.append(combined)

        best_idx = int(np.argmax(combined_scores))
        best_score = float(combined_scores[best_idx])

        if (
            best_score >= self.SIMILARITY_THRESHOLD
            and best_idx < len(self._incident_of_doc)
        ):
            matched_incident = self._incident_of_doc[best_idx]
            incident_data = self.incidents.get(
                matched_incident,
                {}
            )

            return {
                "is_duplicate": True,
                "similarity_score": round(best_score, 4),
                "matched_incident_id": matched_incident,
                "matched_report_ids": incident_data.get(
                    "report_ids",
                    []
                ),
                "matched_text": self._corpus[best_idx],
            }

        return {
            "is_duplicate": False,
            "similarity_score": round(best_score, 4),
            "matched_incident_id": None,
            "matched_report_ids": [],
            "matched_text": None,
        }

    def get_incident(self, incident_id: str) -> dict | None:
        return self.incidents.get(incident_id)

    def list_incidents(self) -> list:
        """Return all incidents with aggregated report counts."""
        result = []
        for iid, data in self.incidents.items():
            result.append({
                "incident_id": iid,
                "category": data["category"],
                "report_count": len(data["complaints"]),
                "report_ids": data["complaints"],
            })
        return result


# ============================================================
# SINGLETON INSTANCES
# ============================================================

_priority_predictor = PriorityPredictor()
_duplicate_detector = DuplicateDetector()


def get_priority_predictor() -> PriorityPredictor:
    return _priority_predictor


def get_duplicate_detector() -> DuplicateDetector:
    return _duplicate_detector