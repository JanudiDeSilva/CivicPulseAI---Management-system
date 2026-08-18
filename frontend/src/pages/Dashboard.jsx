import { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchReports, fetchStats, updateReportStatus, updateReportReply } from "../services/api";
import MapView from "../components/MapView";

const CATEGORY_META = {
  garbage: {
    title: "Garbage & Waste",
    icon: "🗑️",
    color: "#10b981",
    badge: "badge-garbage",
  },

  road_damage: {
    title: "Road Damages",
    icon: "🚗",
    color: "#f59e0b",
    badge: "badge-road_damage",
  },

  power_failure: {
    title: "Power Outages",
    icon: "⚡",
    color: "#8b5cf6",
    badge: "badge-power_failure",
  },

  street_light: {
    title: "Street Lights",
    icon: "💡",
    color: "#eab308",
    badge: "badge-street_light",
  },

  flood: {
    title: "Flood & Drainage",
    icon: "🌊",
    color: "#3b82f6",
    badge: "badge-flood",
  },
};

const STATUS_OPTIONS = ["All", "Registered", "Under Review", "Dispatched", "Resolved"];

const SEVERITY_COLORS = {
  CRITICAL: { bg: "rgba(239, 68, 68, 0.18)", border: "rgba(239, 68, 68, 0.5)", text: "#ef4444" },
  HIGH: { bg: "rgba(249, 115, 22, 0.18)", border: "rgba(249, 115, 22, 0.5)", text: "#f97316" },
  MEDIUM: { bg: "rgba(234, 179, 8, 0.18)", border: "rgba(234, 179, 8, 0.5)", text: "#eab308" },
  LOW: { bg: "rgba(34, 197, 94, 0.18)", border: "rgba(34, 197, 94, 0.5)", text: "#22c55e" },
  PENDING: { bg: "rgba(100, 116, 139, 0.18)", border: "rgba(100, 116, 139, 0.4)", text: "#94a3b8" },
};

function SeverityPill({ severity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.PENDING;
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 8, fontSize: "0.73rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`
    }}>
      {severity === "PENDING" ? "Triaging…" : severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const colorMap = {
    "Dispatched": "#34d399",
    "Resolved": "#10b981",
    "Under Review": "#fbbf24",
    "Registered": "#94a3b8",
    "Closed": "#64748b",
  };
  return (
    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: colorMap[status] || "#94a3b8" }}>
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid #1e293b" }}>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: "16px" }}>
          <div style={{
            height: 14, borderRadius: 6, background: "rgba(255,255,255,0.06)",
            animation: "pulse 1.5s ease-in-out infinite"
          }} />
        </td>
      ))}
    </tr>
  );
}

export default function Dashboard() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("All");
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [error, setError] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySaving, setReplySaving] = useState(null);
  const [replySuccess, setReplySuccess] = useState(null);
  const [expandedFlood, setExpandedFlood] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [exportFormat, setExportFormat] = useState("csv");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [reportsRes, statsRes] = await Promise.all([fetchReports(), fetchStats()]);
      setComplaints(reportsRes.data.reports || []);
      setStats(statsRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Could not load live data. Showing cached records.");
      // Fallback: try localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
        setComplaints(stored);
      } catch (_) { }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Filtered view ────────────────────────────────────────────────────────
  const filteredComplaints = complaints.filter((c) => {
    const catMatch = activeCategory === "all" || c.category === activeCategory;
    const statusMatch = activeStatus === "All" || c.status === activeStatus;
    return catMatch && statusMatch;
  });

  // ─── Category stats (from DB stats or computed from complaints) ───────────
  const categoryStats = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id,
    ...meta,
    count: stats ? (stats.by_category[id] ?? 0) : complaints.filter((c) => c.category === id).length,
  }));

  const totalComplaints = stats?.total_reports ?? complaints.length;
  const criticalHighCount = stats?.critical_high_count ?? complaints.filter(
    (c) => c.severity === "CRITICAL" || c.severity === "HIGH"
  ).length;
  const resolvedCount = stats?.resolved_count ?? complaints.filter((c) => c.status === "Resolved").length;

  const getReportKey = (report) => String(report?.id ?? report?.tracking_id ?? "");

  const resolveAiSeverity = (report) => {
    const direct = report?.severity || report?.severity_raw;
    if (direct && direct !== "PENDING") return String(direct).toUpperCase();

    const rawMl = report?.ml_analysis || {};
    const ml = typeof rawMl === "string" ? (() => { try { return JSON.parse(rawMl); } catch { return {}; } })() : rawMl;
    const floodRisk = report?.risk_signals?.floodRisk || {};
    const nested = ml?.risk_level || ml?.severity || floodRisk?.risk_level || ml?.predicted_class || ml?.forced_min_priority;
    if (nested) return String(nested).toUpperCase();

    if (ml?.confidence != null) {
      const value = Number(ml.confidence);
      if (value >= 0.8) return "HIGH";
      if (value >= 0.5) return "MEDIUM";
      return "LOW";
    }

    if (ml?.image_damage_score != null || ml?.final_image_severity_score != null) {
      const value = Number(ml.image_damage_score || ml.final_image_severity_score);
      if (value >= 0.6 || value >= 3) return "HIGH";
      if (value >= 0.3 || value >= 1.5) return "MEDIUM";
      return "LOW";
    }

    return "PENDING";
  };

  const resolvePriorityScore = (report) => {
    if (typeof report?.priority_score === "number") return report.priority_score;

    const ml = report?.ml_analysis || {};
    const floodRisk = report?.risk_signals?.floodRisk || {};
    const value = ml?.flood_probability ?? ml?.confidence ?? floodRisk?.flood_probability ?? floodRisk?.confidence;

    if (typeof value === "number") return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
    if (ml?.image_damage_score != null) {
      return Number(Math.min(Math.max(Number(ml.image_damage_score) / 10, 0.15), 0.95).toFixed(2));
    }
    return 0;
  };

  // ─── Status update handler ────────────────────────────────────────────────
  const handleStatusChange = async (reportId, newStatus) => {
    setStatusUpdating(reportId);
    try {
      await updateReportStatus(reportId, newStatus);
      setComplaints((prev) =>
        prev.map((c) => (c.id === reportId ? { ...c, status: newStatus } : c))
      );
      const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
      const updated = stored.map((c) => (c.id === reportId ? { ...c, status: newStatus } : c));
      localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleReplySubmit = async (reportId) => {
    const replyText = replyDrafts[reportId] ?? "";
    setReplySaving(reportId);
    try {
      await updateReportReply(reportId, replyText);
      setComplaints((prev) =>
        prev.map((c) => (c.id === reportId ? { ...c, admin_reply: replyText } : c))
      );
      setReplySuccess(reportId);
      setTimeout(() => setReplySuccess(null), 2500);
    } catch (err) {
      console.error("Reply save failed:", err);
    } finally {
      setReplySaving(null);
    }
  };

  const exportToCSV = () => {
    if (!filteredComplaints.length) return;
    
    const headers = ["ID", "Citizen Name", "Phone", "Category", "Location", "Severity", "Priority Score", "Status", "Submitted At"];
    const csvContent = [
      headers.join(","),
      ...filteredComplaints.map(c => [
        c.tracking_id || c.id,
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.phone || "").replace(/"/g, '""')}"`,
        c.category,
        `"${[c.area, c.city, c.district].filter(Boolean).join(", ")}"`,
        resolveAiSeverity(c),
        resolvePriorityScore(c),
        c.status,
        `"${c.submitted_at || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `complaints_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!filteredComplaints.length) return;
    
    const doc = new jsPDF();
    doc.text("CivicPulse AI Complaints Report", 14, 15);
    
    const headers = [["ID", "Citizen Name", "Category", "Location", "Severity", "Status"]];
    const data = filteredComplaints.map(c => [
      c.tracking_id || c.id,
      c.name || "N/A",
      c.category,
      [c.area, c.city, c.district].filter(Boolean).join(", "),
      resolveAiSeverity(c),
      c.status
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`complaints_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExport = () => {
    if (exportFormat === "csv") {
      exportToCSV();
    } else {
      exportToPDF();
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "left" }}>

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "2.1rem", margin: 0 }}> Admin Dashboard</h1>
          <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time triage and field dispatch overview.
            {lastRefresh && (
              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                Last synced: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* KPI Cards */}
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12, textAlign: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Cases</span>
            <strong style={{ fontSize: "1.5rem", color: "#f8fafc" }}>{totalComplaints}</strong>
          </div>
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12, borderColor: "rgba(239,68,68,0.4)", textAlign: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#f87171", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Critical / High</span>
            <strong style={{ fontSize: "1.5rem", color: "#ef4444" }}>{criticalHighCount}</strong>
          </div>
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12, borderColor: "rgba(34,197,94,0.4)", textAlign: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#4ade80", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resolved</span>
            <strong style={{ fontSize: "1.5rem", color: "#22c55e" }}>{resolvedCount}</strong>
          </div>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ fontSize: "0.82rem", padding: "10px 16px", alignSelf: "center" }}
          >
            ↻ Refresh
          </button>
          
          <div style={{ display: "flex", alignItems: "center", marginLeft: 4 }}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.82rem", padding: "8px 12px", width: "auto", borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 0 }}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem", padding: "10px 16px", alignSelf: "center", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              📥 Export
            </button>
          </div>
        </div>
      </div>

      {/* ─── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          marginBottom: 20, padding: "12px 18px", borderRadius: 10,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
          color: "#f87171", fontSize: "0.88rem"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ─── Category Cards ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: "1.1rem", marginBottom: 14, color: "#f8fafc" }}>Issue Breakdown by Category</h3>
        <div className="grid-5">
          {categoryStats.map((cat) => (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
              className="glass-card"
              style={{
                padding: 20, cursor: "pointer",
                border: activeCategory === cat.id ? `2px solid ${cat.color}` : "1px solid #334155",
                backgroundColor: activeCategory === cat.id ? "rgba(30,41,59,0.95)" : "rgba(30,41,59,0.6)",
                transition: "all 0.2s ease",
                boxShadow: activeCategory === cat.id ? `0 0 16px ${cat.color}33` : "none"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 26 }}>{cat.icon}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: cat.color }}>{cat.count}</span>
              </div>
              <h4 style={{ fontSize: "0.9rem", color: "#f8fafc", margin: 0 }}>{cat.title}</h4>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {activeCategory === cat.id ? "Filter Active ✓" : "Click to filter"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Map Toggle ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowMap((v) => !v)}
          className="btn btn-secondary"
          style={{ fontSize: "0.85rem", padding: "9px 20px" }}
        >
          {showMap ? "🗂️ Hide Map" : "🗺️ Show Live Incident Map"}
        </button>
      </div>

      {showMap && (
        <div style={{ marginBottom: 28 }}>
          <MapView />
        </div>
      )}

      {/* ─── Status Filters ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: activeStatus === s ? "rgba(59,130,246,0.2)" : "transparent",
              borderColor: activeStatus === s ? "#3b82f6" : "#334155",
              color: activeStatus === s ? "#93c5fd" : "#94a3b8",
              transition: "all 0.15s ease"
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ─── Reports Table ────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Incident Logs</h3>
            <p style={{ fontSize: "0.83rem", marginTop: 3, color: "var(--text-muted)" }}>
              Showing {filteredComplaints.length} report{filteredComplaints.length !== 1 ? "s" : ""}
              {activeCategory !== "all" && ` · ${CATEGORY_META[activeCategory]?.title}`}
              {activeStatus !== "All" && ` · ${activeStatus}`}
            </p>
          </div>
          {(activeCategory !== "all" || activeStatus !== "All") && (
            <button
              onClick={() => { setActiveCategory("all"); setActiveStatus("All"); }}
              className="btn btn-secondary"
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <p style={{ fontSize: "0.95rem" }}>No complaints found for the selected filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={{ padding: "10px 14px" }}>ID</th>
                  <th style={{ padding: "10px 14px" }}>Citizen</th>
                  <th style={{ padding: "10px 14px" }}>Category</th>
                  <th style={{ padding: "10px 14px" }}>Location</th>
                  <th style={{ padding: "10px 14px" }}>AI Severity</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Reply</th>
                  <th style={{ padding: "10px 14px" }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((item) => {
                  const catMeta = CATEGORY_META[item.category] || {};
                  const aiSeverity = resolveAiSeverity(item);
                  const priorityValue = resolvePriorityScore(item);
                  return (
                    <tr
                      key={getReportKey(item)}
                      onClick={() => setExpandedLogId((prev) => (prev === getReportKey(item) ? null : getReportKey(item)))}
                      style={{ borderBottom: "1px solid #1e293b", transition: "background 0.12s", cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "14px", fontWeight: 700, color: "#3b82f6", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {item.tracking_id || item.id?.slice(0, 8)}
                      </td>
                      <td style={{ padding: "14px" }}>
                        <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.88rem" }}>{item.name || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>NIC: {item.nic || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.phone || ""}</div>
                      </td>
                      <td style={{ padding: "14px" }}>
                        <span className={`category-badge ${catMeta.badge || ""}`}>
                          {catMeta.icon || "📋"} {item.category_label || catMeta.title || item.category}
                        </span>
                      </td>
                      <td style={{ padding: "14px", fontSize: "0.85rem", color: "#cbd5e1" }}>
                        <div>{item.area || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {[item.city, item.district].filter(Boolean).join(", ")}
                        </div>
                      </td>
                      <td style={{ padding: "14px", minWidth: 180 }}>
                        <SeverityPill severity={aiSeverity} />
                        {priorityValue > 0 && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                            Risk Score: <strong style={{ color: "#cbd5e1" }}>{(priorityValue * 100).toFixed(0)}%</strong>
                          </div>
                        )}
                        {item.category === "flood" && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedFlood(expandedFlood === item.id ? null : item.id);
                              }}
                              style={{ fontSize: "0.7rem", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                            >
                              🤖 ML Details {expandedFlood === item.id ? "▲" : "▼"}
                            </button>
                            {expandedFlood === item.id && (
                              <div style={{ marginTop: 6, padding: "10px", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, fontSize: "0.75rem" }}>
                                <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 6, fontSize: "0.78rem" }}>🌊 XGBoost Flood AI Model</div>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Flood Risk Level:</span>
                                    <span style={{ color: item.severity === "CRITICAL" ? "#ef4444" : item.severity === "HIGH" ? "#f97316" : "#eab308", fontWeight: 700 }}>{item.severity}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Flood Probability:</span>
                                    <span style={{ color: "#f8fafc", fontWeight: 600 }}>{(item.priority_score * 100).toFixed(1)}%</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Flood Predicted:</span>
                                    <span style={{ color: item.predicted_escalation === "YES" ? "#ef4444" : "#4ade80", fontWeight: 700 }}>{item.predicted_escalation || "—"}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Confidence:</span>
                                    <span style={{ color: "#f8fafc" }}>{item.escalation_confidence ? (item.escalation_confidence * 100).toFixed(0) + "%" : "—"}</span>
                                  </div>
                                </div>
                                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(59,130,246,0.2)", color: "#64748b", fontSize: "0.72rem" }}>
  {/* Model Inputs */}
  { (item.elevation_m != null || item.distance_to_river_m != null || item.rainfall_7d_mm != null || item.monthly_rainfall_mm != null || item.population_density_per_km2 != null || item.ndvi != null || item.ndwi != null) ? (
    <div style={{ display: "grid", gap: "4px", marginTop: 4 }}>
      {item.elevation_m != null && <div><strong>Elevation:</strong> {item.elevation_m} m</div>}
      {item.distance_to_river_m != null && <div><strong>Dist. to River:</strong> {item.distance_to_river_m} m</div>}
      {item.rainfall_7d_mm != null && <div><strong>Rainfall (7d):</strong> {item.rainfall_7d_mm} mm</div>}
      {item.monthly_rainfall_mm != null && <div><strong>Monthly Rainfall:</strong> {item.monthly_rainfall_mm} mm</div>}
      {item.population_density_per_km2 != null && <div><strong>Population Density:</strong> {item.population_density_per_km2} /km²</div>}
      {item.ndvi != null && <div><strong>NDVI:</strong> {item.ndvi}</div>}
      {item.ndwi != null && <div><strong>NDWI:</strong> {item.ndwi}</div>}
    </div>
  ) : (
    <div>📡 Model inputs: district geo-features, live 7‑day rainfall from Open‑Meteo, elevation, distance to river, soil type, NDVI/NDWI indices & population density.</div>
  )}
</div>
                              </div>
                            )}
                          </div>
                        )}
                        {item.category !== "flood" && item.predicted_escalation === "YES" && (
                          <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: 3 }}>⚠ Escalation Risk</div>
                        )}
                      </td>
                      <td style={{ padding: "14px" }}>
                        <select
                          value={item.status || "Registered"}
                          disabled={statusUpdating === item.id}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          style={{
                            background: "rgba(15,23,42,0.7)", color: "#34d399",
                            border: "1px solid #334155", borderRadius: 8,
                            padding: "5px 8px", fontSize: "0.8rem", fontWeight: 600,
                            cursor: "pointer", outline: "none"
                          }}
                        >
                          <option value="Registered">Registered</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Dispatched">Dispatched</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td style={{ padding: "14px", minWidth: 200 }}>
                        {item.admin_reply ? (
                          <>
                            <div style={{ fontSize: "0.72rem", color: "#4ade80", marginBottom: 6, display: "flex", alignItems: "center", gap: "4px" }}>
                              <span>✓ Reply sent to user</span>
                            </div>
                            <div style={{
                              width: "100%",
                              minWidth: 180,
                              background: "rgba(16, 185, 129, 0.05)",
                              color: "#a7f3d0",
                              border: "1px solid rgba(16, 185, 129, 0.2)",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: "0.78rem",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word"
                            }}>
                              {item.admin_reply}
                            </div>
                          </>
                        ) : (
                          <>
                            <textarea
                              rows={2}
                              value={replyDrafts[item.id] !== undefined ? replyDrafts[item.id] : ""}
                              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              onClick={(event) => event.stopPropagation()}
                              placeholder="Type a reply to the citizen…"
                              style={{
                                width: "100%",
                                minWidth: 180,
                                background: "rgba(15,23,42,0.7)",
                                color: "#e2e8f0",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: "0.78rem",
                                resize: "vertical",
                                display: "block"
                              }}
                            />
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReplySubmit(item.id);
                              }}
                              disabled={replySaving === item.id || !replyDrafts[item.id]?.trim()}
                              style={{
                                marginTop: 6,
                                width: "100%",
                                padding: "6px 10px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                borderRadius: 7,
                                border: "none",
                                cursor: (replySaving === item.id || !replyDrafts[item.id]?.trim()) ? "not-allowed" : "pointer",
                                background: replySuccess === item.id
                                  ? "rgba(34,197,94,0.25)"
                                  : (!replyDrafts[item.id]?.trim() ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.2)"),
                                color: replySuccess === item.id ? "#4ade80" : (!replyDrafts[item.id]?.trim() ? "#64748b" : "#93c5fd"),
                                transition: "all 0.2s"
                              }}
                            >
                              {replySaving === item.id ? "Sending…" : replySuccess === item.id ? "✓ Sent!" : "📨 Send Reply"}
                            </button>
                          </>
                        )}
                      </td>
                      <td style={{ padding: "14px", fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {item.submitted_at || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {expandedLogId && (() => {
        const item = complaints.find((report) => getReportKey(report) === String(expandedLogId)) || filteredComplaints.find((report) => getReportKey(report) === String(expandedLogId));
        if (!item) return null;

        const rawMlData = item.ml_analysis || item.ai_analysis || {};
        const mlData = typeof rawMlData === "string" ? (() => { try { return JSON.parse(rawMlData); } catch { return {}; } })() : rawMlData;
        const descriptionText = item.raw_text ?? item.description ?? item.specific_details ?? "No user description provided.";
        const summaryText = descriptionText || "No user description provided.";
        
        let imageList = [];
        try {
          if (item.image_url && item.image_url.startsWith("[")) {
            imageList = JSON.parse(item.image_url);
          } else if (item.image_url) {
            imageList = [item.image_url];
          } else if (item.photo_url) {
            imageList = [item.photo_url];
          }
        } catch (e) {
          if (item.image_url) imageList = [item.image_url];
        }

        const formattedImages = imageList.map(url => 
          url.startsWith("http") ? url : `http://127.0.0.1:8000${url.startsWith("/") ? url : `/${url}`}`
        );

        return (
          <div className="glass-card" style={{ marginTop: 20, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: "0.72rem", letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase" }}>Complaint detail</div>
                <h3 style={{ margin: "6px 0 0" }}>{item.tracking_id || item.id}</h3>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setExpandedLogId(null)}
                style={{ fontSize: "0.8rem", padding: "8px 12px" }}
              >
                Close preview
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              <div style={{ background: "rgba(15,23,42,0.75)", border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
                <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 10 }}>Citizen details</div>
                <div style={{ display: "grid", gap: 8, color: "#e2e8f0" }}>
                  <div><strong style={{ color: "#94a3b8" }}>Name:</strong> {item.name || "—"}</div>
                  <div><strong style={{ color: "#94a3b8" }}>Phone:</strong> {item.phone || "—"}</div>
                  <div><strong style={{ color: "#94a3b8" }}>NIC:</strong> {item.nic || "—"}</div>
                  <div><strong style={{ color: "#94a3b8" }}>Category:</strong> {item.category_label || item.category || "—"}</div>
                  <div><strong style={{ color: "#94a3b8" }}>Location:</strong> {item.area || "—"}{item.city || item.district ? `, ${[item.city, item.district].filter(Boolean).join(", ")}` : ""}</div>
                  <div><strong style={{ color: "#94a3b8" }}>Status:</strong> {item.status || "Registered"}</div>
                  <div><strong style={{ color: "#94a3b8" }}>Severity:</strong> {item.severity || "PENDING"}</div>
                </div>
              </div>

              <div style={{ background: "rgba(15,23,42,0.75)", border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
                <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 10 }}>User description</div>
                <p style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>{summaryText}</p>
              </div>

              <div style={{ background: "rgba(15,23,42,0.75)", border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
                <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 10 }}>Uploaded image(s)</div>
                {formattedImages.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {formattedImages.map((src, idx) => (
                      <img key={idx} src={src} alt={`Complaint upload ${idx + 1}`} style={{ width: "100%", maxWidth: 320, height: 220, objectFit: "cover", borderRadius: 10, border: "1px solid #475569" }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>No uploaded images</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 18, background: "rgba(15,23,42,0.75)", border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
              <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 12 }}>ML prediction details</div>
              {!mlData || Object.keys(mlData).length === 0 ? (
                <div style={{ color: "#64748b" }}>No ML prediction result stored for this complaint.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {Object.entries(mlData).map(([key, value]) => (
                    <div key={key} style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{key}</div>
                      <div style={{ color: "#f8fafc", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}