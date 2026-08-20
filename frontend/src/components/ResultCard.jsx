export default function ResultCard({ result }) {
  if (!result) return null;

  const categoryMap = {
    flood: { icon: "🌊", label: "Drainage & Waterlogging", badge: "badge-flood", color: "#3b82f6" },
    road_damage: { icon: "🚗", label: "Road Damage", badge: "badge-road_damage", color: "#f59e0b" },
    garbage: { icon: "🗑️", label: "Garbage & Waste", badge: "badge-garbage", color: "#10b981" },
    power_failure: { icon: "⚡", label: "Power Failure", badge: "badge-power_failure", color: "#8b5cf6" },
    street_light: { icon: "💡", label: "Broken Street Light", badge: "badge-street_light", color: "#eab308" }
  };

  const catKey = result.category || "flood";
  const categoryInfo = categoryMap[catKey] || categoryMap.flood;

  const severityClass = 
    result.severity?.toLowerCase() === "critical" || result.severity?.toLowerCase() === "high" || result.drainage_risk?.toLowerCase() === "high" || result.flood_risk?.toLowerCase() === "high"
      ? "severity-high"
      : result.severity?.toLowerCase() === "medium"
      ? "severity-medium"
      : "severity-low";

  return (
    <div
      className="glass-card"
      style={{
        marginTop: 28,
        border: "1px solid #334155",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        textAlign: "left"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #334155",
          paddingBottom: 16,
          marginBottom: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontSize: 28,
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {categoryInfo.icon}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.3rem", color: "#f8fafc" }}>AI Risk & Severity Triage Result</h3>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              Tracking ID: <strong style={{ color: "#3b82f6" }}>{result.tracking_id || "CP-892401"}</strong>
            </span>
          </div>
        </div>

        <span className={`category-badge ${categoryInfo.badge}`}>
          {categoryInfo.icon} {result.category_label || categoryInfo.label}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {/* Severity */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: 16,
            borderRadius: 12,
            border: "1px solid #334155"
          }}
        >
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 6 }}>AI SEVERITY RATING</p>
          <span className={`severity-pill ${severityClass}`}>
            {result.severity || result.flood_risk || "HIGH"}
          </span>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
            Priority Score: <strong>{result.ai_priority_score || 85} / 100</strong>
          </p>
        </div>

        {/* Location & GPS */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: 16,
            borderRadius: 12,
            border: "1px solid #334155"
          }}
        >
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 6 }}>GPS COORDINATES</p>
          <p style={{ fontWeight: 600, color: "#60a5fa", fontSize: "0.9rem", margin: 0 }}>
            📍 {result.location_coords || "Captured Location"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            Nominatim Reverse Geocoded
          </p>
        </div>

        {/* Weather Enrichment */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: 16,
            borderRadius: 12,
            border: "1px solid #334155"
          }}
        >
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 6 }}>LIVE WEATHER CONDITION</p>
          <p style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.88rem", margin: 0 }}>
            {result.weather_summary || "☀️ Normal Weather"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
            Open-Meteo Forecast Synced
          </p>
        </div>
      </div>

      {result.summary && (
        <div
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: 12,
            padding: 16,
            color: "#cbd5e1",
            fontSize: "0.9rem"
          }}
        >
          🤖 <strong>AI Triage Assessment:</strong> {result.summary}
        </div>
      )}
    </div>
  );
}