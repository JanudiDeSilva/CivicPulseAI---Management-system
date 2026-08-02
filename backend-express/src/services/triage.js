// ─── Category-Specific Scoring Tables ──────────────────────────────────────
const FLOOD_DEPTH_SCORES = {
    "Waist Deep": 1.0, "Chest Deep": 1.0, "Knee Deep": 0.75,
    "Ankle Deep": 0.45, "Surface Water": 0.25,
};
const FLOOD_WATER_ENTERING_SCORES = {
    "Yes - Ground Floor Inundated": 1.0,
    "Yes - Approaching Ground Floor": 0.85,
    "No - Road Level Only": 0.35,
};
const ROAD_DAMAGE_TYPE_SCORES = {
    "Road Collapse / Sinkhole": 1.0, "Deep Pothole / Crater": 0.85,
    "Multiple Potholes": 0.70, "Surface Crack / Subsidence": 0.50, "Minor Crack": 0.25,
};
const ROAD_HAZARD_LEVEL_SCORES = {
    "Extreme Hazard for Motorcycles / Bicycles": 1.0,
    "Hazardous for All Vehicles": 0.85, "Moderate Hazard": 0.55, "Minor Inconvenience": 0.25,
};
const GARBAGE_HEALTH_HAZARD_SCORES = {
    "Severe Foul Odor & Pest Infestation (Flies/Rats)": 1.0,
    "Strong Odor / Pest Presence": 0.80, "Moderate Odor": 0.50, "Minor Inconvenience": 0.25,
};
const GARBAGE_DURATION_SCORES = {
    "More than 2 Weeks": 1.0, "1 - 2 Weeks": 0.85, "3 - 5 Days": 0.60,
    "1 - 2 Days": 0.35, "Less than 1 Day": 0.15,
};
const POWER_SYMPTOM_SCORES = {
    "Total Power Blackout (No Supply)": 1.0, "Intermittent Power Cuts": 0.75,
    "High Voltage Fluctuations": 0.85, "Partial Supply (Some Phases)": 0.55, "Low Voltage Only": 0.35,
};
const POWER_DANGER_SCORES = {
    "Live Wire on Ground / Water": 1.0, "Fallen Transformer": 1.0,
    "Sparking / Burning Smell": 0.90, "No Immediate Wire Hazard": 0.25,
};
const STREET_LIGHT_SECURITY_SCORES = {
    "Dark Alley / High Crime Vulnerability": 1.0, "School / Hospital Zone Dark": 0.90,
    "Pedestrian Crossing Dark": 0.75, "Residential Street Dark": 0.50, "Minor Dark Spot": 0.25,
};

// ─── Keyword Scoring ────────────────────────────────────────────────────────
const CRITICAL_KEYWORDS = [
    "collapsed", "collapse", "sinkhole", "drowning", "trapped", "electrocuted",
    "live wire", "fire", "explosion", "emergency", "danger", "hazard", "flood",
    "swept away", "chest deep", "waist deep", "blackout", "rat", "disease",
    "transformer", "fallen pole", "sparking", "injury", "accident", "death",
];
const HIGH_KEYWORDS = [
    "overflow", "blocked drain", "knee deep", "pothole", "crater",
    "foul odor", "pest", "high voltage", "flickering", "no light", "dark road",
    "interrupted", "multiple houses", "entire street", "hospital",
];
const MEDIUM_KEYWORDS = [
    "ankle deep", "slow drain", "cracked road", "debris", "garbage pile",
    "intermittent", "partial supply", "few lights", "school", "junction",
];

function keywordScore(text) {
    if (!text) return 0.0;
    const t = text.toLowerCase();
    if (CRITICAL_KEYWORDS.some((kw) => t.includes(kw))) return 1.0;
    if (HIGH_KEYWORDS.some((kw) => t.includes(kw))) return 0.75;
    if (MEDIUM_KEYWORDS.some((kw) => t.includes(kw))) return 0.5;
    return 0.2;
}

function scoreFromDict(value, scoreMap) {
    if (!value) return 0.0;
    const v = value.toLowerCase();
    for (const [key, score] of Object.entries(scoreMap)) {
        const k = key.toLowerCase();
        if (v.includes(k) || k.includes(v)) return score;
    }
    return 0.0;
}

// ─── Per-Category Structured Scoring ───────────────────────────────────────
const scoreFlood = (d) =>
    scoreFromDict(d, FLOOD_DEPTH_SCORES) * 0.6 + scoreFromDict(d, FLOOD_WATER_ENTERING_SCORES) * 0.4;
const scoreRoad = (d) =>
    scoreFromDict(d, ROAD_DAMAGE_TYPE_SCORES) * 0.5 + scoreFromDict(d, ROAD_HAZARD_LEVEL_SCORES) * 0.5;
const scoreGarbage = (d) =>
    scoreFromDict(d, GARBAGE_HEALTH_HAZARD_SCORES) * 0.6 + scoreFromDict(d, GARBAGE_DURATION_SCORES) * 0.4;
const scorePower = (d) =>
    scoreFromDict(d, POWER_SYMPTOM_SCORES) * 0.45 + scoreFromDict(d, POWER_DANGER_SCORES) * 0.55;
const scoreStreetLight = (d) => scoreFromDict(d, STREET_LIGHT_SECURITY_SCORES);

const CATEGORY_SCORERS = {
    flood: scoreFlood,
    road_damage: scoreRoad,
    garbage: scoreGarbage,
    power_failure: scorePower,
    street_light: scoreStreetLight,
};

// ─── Main Triage Function ──────────────────────────────────────────────────
export function triage({ category, rawText, specificDetails }) {
    const scorer = CATEGORY_SCORERS[category];
    const structuredScore = scorer ? scorer(specificDetails || "") : 0.0;

    const combinedText = `${rawText || ""} ${specificDetails || ""}`;
    const kwScore = keywordScore(combinedText);

    const composite = structuredScore * 0.65 + kwScore * 0.35;
    const priorityScore = Math.round(Math.min(Math.max(composite, 0.0), 1.0) * 10000) / 10000;

    let severity;
    if (priorityScore >= 0.75) severity = "CRITICAL";
    else if (priorityScore >= 0.55) severity = "HIGH";
    else if (priorityScore >= 0.30) severity = "MEDIUM";
    else severity = "LOW";

    let predictedEscalation, escalationConfidence;
    if (priorityScore >= 0.70) {
        predictedEscalation = "Likely to Escalate";
        escalationConfidence = Math.round(Math.min(priorityScore + 0.10, 1.0) * 10000) / 10000;
    } else if (priorityScore >= 0.45) {
        predictedEscalation = "Monitor Closely";
        escalationConfidence = priorityScore;
    } else {
        predictedEscalation = "Stable";
        escalationConfidence = Math.round((1.0 - priorityScore) * 10000) / 10000;
    }

    return { severity, priorityScore, predictedEscalation, escalationConfidence };
}