import { useState, useEffect, useCallback } from "react";
import { fetchReports, fetchStats, updateReportStatus } from "../services/api";
import MapView from "../components/MapView";

const CATEGORY_META = {
  flood:         { title: "Flood & Drainage",  icon: "🌊", color: "#3b82f6", badge: "badge-flood" },
  road_damage:   { title: "Road Damages",      icon: "🚗", color: "#f59e0b", badge: "badge-road_damage" },
  garbage:       { title: "Garbage & Waste",   icon: "🗑️", color: "#10b981", badge: "badge-garbage" },
  power_failure: { title: "Power Outages",     icon: "⚡", color: "#8b5cf6", badge: "badge-power_failure" },
  street_light:  { title: "Street Lights",     icon: "💡", color: "#eab308", badge: "badge-street_light" },
};

const STATUS_OPTIONS = ["All", "Registered", "Under Review", "Dispatched", "Resolved"];

const SEVERITY_COLORS = {
  CRITICAL: { bg: "rgba(239, 68, 68, 0.18)", border: "rgba(239, 68, 68, 0.5)", text: "#ef4444" },
  HIGH:     { bg: "rgba(249, 115, 22, 0.18)", border: "rgba(249, 115, 22, 0.5)", text: "#f97316" },
  MEDIUM:   { bg: "rgba(234, 179, 8, 0.18)",  border: "rgba(234, 179, 8, 0.5)",  text: "#eab308" },
  LOW:      { bg: "rgba(34, 197, 94, 0.18)",  border: "rgba(34, 197, 94, 0.5)",  text: "#22c55e" },
  PENDING:  { bg: "rgba(100, 116, 139, 0.18)", border: "rgba(100, 116, 139, 0.4)", text: "#94a3b8" },
};

function SeverityPill({ severity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.PENDING;
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 8, fontSize: "0.73rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`
    }}>
      {severity === "PENDING" ? "⏳ Triaging…" : severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const colorMap = {
    "Dispatched":    "#34d399",
    "Resolved":      "#10b981",
    "Under Review":  "#fbbf24",
    "Registered":    "#94a3b8",
    "Closed":        "#64748b",
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
  const [activeStatus, setActiveStatus]   = useState("All");
  const [complaints, setComplaints]        = useState([]);
  const [stats, setStats]                  = useState(null);
  const [loading, setLoading]              = useState(true);
  const [lastRefresh, setLastRefresh]      = useState(null);
  const [showMap, setShowMap]              = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [error, setError]                  = useState(null);

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
        if (stored.length > 0) setComplaints(stored);
      } catch (_) {}
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

  const handleReplySave = (reportId, replyText) => {
    const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
    const updated = stored.map((c) => (c.id === reportId ? { ...c, reply: replyText } : c));
    localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
    setComplaints(updated);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "left" }}>

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "2.1rem", margin: 0 }}>Municipal Admin Dashboard</h1>
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
                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid #1e293b", transition: "background 0.12s" }}
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
                      <td style={{ padding: "14px" }}>
                        <SeverityPill severity={item.severity} />
                        {item.priority_score > 0 && (
                          <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 3 }}>
                            Score: {(item.priority_score * 100).toFixed(0)}%
                          </div>
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
                      <td style={{ padding: "14px" }}>
                        <textarea
                          rows={2}
                          defaultValue={item.reply || ""}
                          onBlur={(e) => handleReplySave(item.id, e.target.value)}
                          style={{
                            width: "100%",
                            minWidth: 180,
                            background: "rgba(15,23,42,0.7)",
                            color: "#e2e8f0",
                            border: "1px solid #334155",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: "0.78rem",
                            resize: "vertical"
                          }}
                        />
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