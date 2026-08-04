export function triage({ category = "", rawText = "", specificDetails = "" } = {}) {
    const text = `${rawText} ${specificDetails}`.toLowerCase();
    
    let severity = "LOW";
    let priorityScore = 0.3;
    let predictedEscalation = "NO";
    let escalationConfidence = 0.65;

    // Critical keywords
    const criticalKeywords = ["emergency", "trapped", "casualty", "fire", "danger", "burst", "life threatening", "downed line", "electrocution"];
    const highKeywords = ["blocked", "damage", "blackout", "hazard", "collapse"];
    const mediumKeywords = ["leak", "crack", "pothole", "light out", "waste", "stagnant"];

    let matchesCritical = criticalKeywords.some((kw) => text.includes(kw));
    let matchesHigh = highKeywords.some((kw) => text.includes(kw));
    let matchesMedium = mediumKeywords.some((kw) => text.includes(kw));

    if (matchesCritical) {
        severity = "CRITICAL";
        priorityScore = 0.95;
        predictedEscalation = "YES";
        escalationConfidence = 0.92;
    } else if (matchesHigh || category === "power_failure" || category === "road_damage") {
        severity = "HIGH";
        priorityScore = 0.75;
        predictedEscalation = "YES";
        escalationConfidence = 0.72;
    } else if (matchesMedium || category === "street_light" || category === "garbage") {
        severity = "MEDIUM";
        priorityScore = 0.50;
        predictedEscalation = "NO";
        escalationConfidence = 0.80;
    } else {
        severity = "LOW";
        priorityScore = 0.25;
        predictedEscalation = "NO";
        escalationConfidence = 0.85;
    }

    return {
        severity,
        priorityScore: parseFloat(priorityScore.toFixed(2)),
        predictedEscalation,
        escalationConfidence: parseFloat(escalationConfidence.toFixed(2)),
    };
}
