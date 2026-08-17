import { useState, useEffect, useCallback } from "react";
import { fetchReports, fetchStats, fetchIncidents, updateReportStatus, updateReportReply, updateIncidentReply } from "../services/api";
import MapView from "../components/MapView";

const CATEGORY_META = {
  flood: { title: "Flood & Drainage", icon: "🌊", color: "#3b82f6", badge: "badge-flood" },
  road_damage: { title: "Road Damages", icon: "🚗", color: "#f59e0b", badge: "badge-road_damage" },
  garbage: { title: "Garbage & Waste", icon: "🗑️", color: "#10b981", badge: "badge-garbage" },
  power_failure: { title: "Power Outages", icon: "⚡", color: "#8b5cf6", badge: "badge-power_failure" },
  street_light: { title: "Street Lights", icon: "💡", color: "#eab308", badge: "badge-street_light" },
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
      {[...Array(8)].map((_, i) => (
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
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [error, setError] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySaving, setReplySaving] = useState(null);
  const [replySuccess, setReplySuccess] = useState(null);
  const [expandedFlood, setExpandedFlood] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [expandedML, setExpandedML] = useState(null);
  const [incidentReplyDrafts, setIncidentReplyDrafts] = useState({});
  const [incidentReplySaving, setIncidentReplySaving] = useState(null);
  const [incidentReplySuccess, setIncidentReplySuccess] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [reportsRes, statsRes, incidentsRes] = await Promise.all([
        fetchReports(), fetchStats(), fetchIncidents()
      ]);
      setComplaints(reportsRes.data.reports || []);
      setStats(statsRes.data);
      setIncidents(incidentsRes.data.incidents || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Could not load live data. Showing cached records.");
      // Fallback: try localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
        if (stored.length > 0) setComplaints(stored);
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

  // Sort by priority (severity score desc) so highest risk appears first
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    const scoreA = a.severity_score ?? a.priority_score ?? 0;
    const scoreB = b.severity_score ?? b.priority_score ?? 0;
    return scoreB - scoreA;
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

  // Send the same reply to ALL reports in a duplicate incident group
  const handleIncidentReplySubmit = async (incidentId) => {
    const replyText = incidentReplyDrafts[incidentId] ?? "";
    setIncidentReplySaving(incidentId);
    try {
      await updateIncidentReply(incidentId, replyText);
      // Update all reports in this incident group
      setComplaints((prev) =>
        prev.map((c) =>
          c.incident_id === incidentId ? { ...c, admin_reply: replyText } : c
        )
      );
      setIncidentReplySuccess(incidentId);
      setTimeout(() => setIncidentReplySuccess(null), 2500);
    } catch (err) {
      console.error("Incident reply save failed:", err);
    } finally {
      setIncidentReplySaving(null);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "left" }}>

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "2.1rem", margin: 0 }}> Admin Dashboard</h1>
          <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time AI triage, priority prediction & duplicate detection.
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
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12, borderColor: "rgba(139,92,246,0.4)", textAlign: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#a78bfa", display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Merged Incidents</span>
            <strong style={{ fontSize: "1.5rem", color: "#a78bfa" }}>{incidents.filter((i) => i.report_count > 1).length}</strong>
          </div>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ fontSize: "0.82rem", padding: "10px 16px", alignSelf: "center" }}
          >
            ↻ Refresh
          </button>
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

      {/* ─── Duplicate Incidents Panel ───────────────────────────────────── */}
      {incidents.filter((i) => i.report_count > 1).length > 0 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 24, borderColor: "rgba(139,92,246,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#a78bfa" }}>
              🧩 Combined Incidents (Duplicate Detection)
            </h3>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Multiple complaints about the same problem merged into one
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {incidents
              .filter((i) => i.report_count > 1)
              .map((inc) => (
                <div
                  key={inc.incident_id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "rgba(139,92,246,0.08)",
                    border: "1px solid rgba(139,92,246,0.3)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: "#e9d5ff", fontSize: "0.85rem" }}>
                      {CATEGORY_META[inc.category]?.icon || "📋"} {CATEGORY_META[inc.category]?.title || inc.category}
                    </span>
                    <span style={{
                      background: "rgba(139,92,246,0.25)", color: "#c4b5fd",
                      borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700
                    }}>
                      {inc.report_count} reports
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    TRK: <strong style={{ color: "#c4b5fd" }}>{inc.report_ids.join(", ").slice(0, 50)}</strong>
                  </div>

                  {/* Individual reports in this incident */}
                  {(inc.reports || []).map((r) => (
                    <div key={r.id} style={{
                      marginTop: 8, padding: "8px 10px", borderRadius: 8,
                      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(139,92,246,0.2)",
                      fontSize: "0.72rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <strong style={{ color: "#c4b5fd" }}>{r.tracking_id}</strong>
                        <span style={{ color: "#94a3b8" }}>{r.name} · {r.submitted_at}</span>
                      </div>
                      <div style={{ color: "#94a3b8", marginTop: 3, fontSize: "0.68rem" }}>
                        {r.specific_details || r.description || "—"}
                      </div>
                      {r.image_url && (
                        <img
                          src={r.image_url}
                          alt="Report"
                          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", marginTop: 4, border: "1px solid #475569" }}
                        />
                      )}
                      {r.admin_reply && (
                        <div style={{ color: "#4ade80", marginTop: 4, fontSize: "0.68rem" }}>
                          ✓ Replied: {r.admin_reply}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Reply to ALL reports in this incident */}
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      rows={2}
                      value={incidentReplyDrafts[inc.incident_id] !== undefined ? incidentReplyDrafts[inc.incident_id] : ""}
                      onChange={(e) => setIncidentReplyDrafts((prev) => ({ ...prev, [inc.incident_id]: e.target.value }))}
                      placeholder={`Reply to all ${inc.report_count} citizens in this incident…`}
                      style={{
                        width: "100%",
                        background: "rgba(15,23,42,0.7)",
                        color: "#e2e8f0",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: "0.75rem",
                        resize: "vertical",
                        display: "block"
                      }}
                    />
                    <button
                      onClick={() => handleIncidentReplySubmit(inc.incident_id)}
                      disabled={incidentReplySaving === inc.incident_id || !incidentReplyDrafts[inc.incident_id]?.trim()}
                      style={{
                        marginTop: 6,
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        borderRadius: 7,
                        border: "none",
                        cursor: (incidentReplySaving === inc.incident_id || !incidentReplyDrafts[inc.incident_id]?.trim()) ? "not-allowed" : "pointer",
                        background: incidentReplySuccess === inc.incident_id
                          ? "rgba(34,197,94,0.25)"
                          : (!incidentReplyDrafts[inc.incident_id]?.trim() ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.2)"),
                        color: incidentReplySuccess === inc.incident_id ? "#4ade80" : (!incidentReplyDrafts[inc.incident_id]?.trim() ? "#64748b" : "#c4b5fd"),
                        transition: "all 0.2s"
                      }}
                    >
                      {incidentReplySaving === inc.incident_id ? "Sending to all…" : incidentReplySuccess === inc.incident_id ? "✓ Sent to all!" : `📨 Reply to all ${inc.report_count} reports`}
                    </button>
                  </div>
                </div>
              ))}
          </div>
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
              Showing {sortedComplaints.length} report{sortedComplaints.length !== 1 ? "s" : ""}
              {activeCategory !== "all" && ` · ${CATEGORY_META[activeCategory]?.title}`}
              {activeStatus !== "All" && ` · ${activeStatus}`}
              <span style={{ marginLeft: 8, color: "#f87171" }}>🔴 = High Priority (CRITICAL/HIGH)</span>
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
        ) : sortedComplaints.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <p style={{ fontSize: "0.95rem" }}>No complaints found for the selected filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={{ padding: "10px 14px" }}>Priority</th>
                  <th style={{ padding: "10px 14px" }}>ID</th>
                  <th style={{ padding: "10px 14px" }}>Citizen</th>
                  <th style={{ padding: "10px 14px" }}>Category</th>
                  <th style={{ padding: "10px 14px" }}>Location</th>
                  <th style={{ padding: "10px 14px" }}>AI Severity</th>
                  <th style={{ padding: "10px 14px" }}>Image</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Duplicates</th>
                  <th style={{ padding: "10px 14px" }}>Reply</th>
                  <th style={{ padding: "10px 14px" }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {sortedComplaints.map((item) => {
                  const catMeta = CATEGORY_META[item.category] || {};
                  const isHighPriority = item.severity === "CRITICAL" || item.severity === "HIGH";
                  const isDuplicate = item.is_duplicate === true;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #1e293b",
                        transition: "background 0.12s",
                        // 🔴 RED HIGHLIGHT for high priority complaints —
                        // the entire row turns red.
                        background: isHighPriority
                          ? "rgba(239, 68, 68, 0.10)"
                          : isDuplicate
                            ? "rgba(139, 92, 246, 0.06)"
                            : "transparent",
                        borderLeft: isHighPriority
                          ? "4px solid rgba(239, 68, 68, 0.8)"
                          : isDuplicate
                            ? "4px solid rgba(139, 92, 246, 0.5)"
                            : "4px solid transparent"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isHighPriority ? "rgba(239, 68, 68, 0.18)" : "rgba(255,255,255,0.025)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = isHighPriority ? "rgba(239, 68, 68, 0.10)" : isDuplicate ? "rgba(139, 92, 246, 0.06)" : "transparent"}
                    >
                      {/* Priority Rank (1 = most critical) */}
                      <td style={{ padding: "14px", textAlign: "center" }}>
                        {item.priority_rank ? (
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: "0.95rem",
                            background: item.priority_rank === 1
                              ? "rgba(239,68,68,0.25)"
                              : item.priority_rank === 2
                                ? "rgba(249,115,22,0.25)"
                                : item.priority_rank === 3
                                  ? "rgba(234,179,8,0.25)"
                                  : "rgba(34,197,94,0.25)",
                            color: item.priority_rank === 1
                              ? "#ef4444"
                              : item.priority_rank === 2
                                ? "#f97316"
                                : item.priority_rank === 3
                                  ? "#eab308"
                                  : "#22c55e",
                            border: `2px solid ${
                              item.priority_rank === 1
                                ? "rgba(239,68,68,0.6)"
                                : item.priority_rank === 2
                                  ? "rgba(249,115,22,0.6)"
                                  : item.priority_rank === 3
                                    ? "rgba(234,179,8,0.6)"
                                    : "rgba(34,197,94,0.6)"
                            }`,
                            margin: "0 auto"
                          }}>
                            {item.priority_rank}
                          </div>
                        ) : (
                          <span style={{ color: "#334155", fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px", fontWeight: 700, color: isHighPriority ? "#ef4444" : "#3b82f6", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {item.tracking_id || item.id?.slice(0, 8)}
                        {isHighPriority && <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "#ef4444" }}>🔴</span>}
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
                        <SeverityPill severity={item.severity} />
                        {item.priority_score > 0 && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                            Risk Score: <strong style={{ color: isHighPriority ? "#f87171" : "#cbd5e1" }}>
                              {((item.severity_score ?? item.priority_score) * 100).toFixed(0)}%
                            </strong>
                          </div>
                        )}
                        {item.category === "flood" && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={() => setExpandedFlood(expandedFlood === item.id ? null : item.id)}
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
                              </div>
                            )}
                          </div>
                        )}
                        {item.category !== "flood" && item.predicted_escalation === "YES" && (
                          <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: 3 }}>⚠ Escalation Risk</div>
                        )}
                        {/* ML Detections for ALL models */}
                        {item.ml_analysis && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={() => setExpandedML(expandedML === item.id ? null : item.id)}
                              style={{ fontSize: "0.7rem", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                            >
                              🤖 Model Detections {expandedML === item.id ? "▲" : "▼"}
                            </button>
                            {expandedML === item.id && (
                              <div style={{ marginTop: 6, padding: "10px", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: "0.75rem" }}>
                                {item.ml_analysis.type === "road_damage" && (
                                  <>
                                    <div style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 6, fontSize: "0.78rem" }}>🚗 YOLOv8 Road Damage Detection</div>
                                    <div style={{ display: "grid", gap: 4 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Manhole Detected:</span>
                                        <span style={{ color: item.ml_analysis.manhole_detected ? "#ef4444" : "#94a3b8", fontWeight: 700 }}>
                                          {item.ml_analysis.manhole_detected ? "Yes — Critical" : "No"}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Damage Score:</span>
                                        <span style={{ color: "#f8fafc", fontWeight: 600 }}>
                                          {(item.ml_analysis.final_image_severity_score * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                      {(item.ml_analysis.detections || []).map((d, i) => (
                                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#cbd5e1" }}>
                                          <span style={{ textTransform: "capitalize" }}>{d.class}</span>
                                          <span>{(d.confidence * 100).toFixed(0)}% · {d.severity_tier}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                {item.ml_analysis.type === "garbage" && (
                                  <>
                                    <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 6, fontSize: "0.78rem" }}>🗑️ Garbage Classification Model</div>
                                    <div style={{ display: "grid", gap: 4 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Predicted Class:</span>
                                        <span style={{ color: "#f8fafc", fontWeight: 700, textTransform: "capitalize" }}>
                                          {item.ml_analysis.predicted_class}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Confidence:</span>
                                        <span style={{ color: "#f8fafc", fontWeight: 600 }}>
                                          {(item.ml_analysis.confidence * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                      {item.ml_analysis.fallback && (
                                        <div style={{ color: "#fbbf24", fontSize: "0.7rem" }}>⚠ Heuristic fallback used</div>
                                      )}
                                    </div>
                                  </>
                                )}
                                {item.ml_analysis.type === "flood" && (
                                  <>
                                    <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 6, fontSize: "0.78rem" }}>🌊 XGBoost Flood AI Model</div>
                                    <div style={{ display: "grid", gap: 4 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Flood Probability:</span>
                                        <span style={{ color: "#f8fafc", fontWeight: 600 }}>
                                          {(item.ml_analysis.flood_probability * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Risk Level:</span>
                                        <span style={{ color: item.ml_analysis.risk_level === "HIGH" ? "#ef4444" : item.ml_analysis.risk_level === "MODERATE" ? "#f97316" : "#eab308", fontWeight: 700 }}>
                                          {item.ml_analysis.risk_level}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Confidence:</span>
                                        <span style={{ color: "#f8fafc" }}>
                                          {(item.ml_analysis.confidence * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* User Uploaded Image */}
                      <td style={{ padding: "14px", textAlign: "center" }}>
                        {item.image_url ? (
                          <div>
                            <img
                              src={item.image_url}
                              alt="User upload"
                              onClick={() => setExpandedImage(expandedImage === item.id ? null : item.id)}
                              style={{
                                width: 48, height: 48, borderRadius: 8, objectFit: "cover",
                                cursor: "pointer", border: "1px solid #475569",
                                transition: "all 0.2s"
                              }}
                            />
                            {expandedImage === item.id && (
                              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setExpandedImage(null)}>
                                <img src={item.image_url} alt="Full view" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12, border: "2px solid #475569" }} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#334155", fontSize: "0.8rem" }}>—</span>
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
                      <td style={{ padding: "14px", fontSize: "0.75rem" }}>
                        {isDuplicate ? (
                          <div style={{
                            padding: "6px 10px", borderRadius: 8,
                            background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)",
                            color: "#c4b5fd"
                          }}>
                            <strong>🧩 Duplicate</strong>
                            <div style={{ fontSize: "0.68rem", marginTop: 3 }}>
                              Match: {(item.duplicate_similarity * 100).toFixed(0)}% · {item.incident_report_count} total
                            </div>
                          </div>
                        ) : item.incident_report_count > 1 ? (
                          <div style={{
                            padding: "6px 10px", borderRadius: 8,
                            background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)",
                            color: "#a78bfa"
                          }}>
                            <strong>📦 Incident #{item.incident_report_count} reports</strong>
                          </div>
                        ) : (
                          <span style={{ color: "#334155" }}>•</span>
                        )}
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
                              onClick={() => handleReplySubmit(item.id)}
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

      {/* Pulse animation for skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}