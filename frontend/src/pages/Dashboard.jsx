import { useState, useEffect, useCallback, useMemo } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchReports, fetchStats, updateReportStatus, updateReportReply } from "../services/api";
import MapView from "../components/MapView";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META = {
  garbage:       { title: "Garbage & Waste",  icon: "🗑️", color: "#10b981", badge: "badge-garbage" },
  road_damage:   { title: "Road Damages",     icon: "🚗", color: "#f59e0b", badge: "badge-road_damage" },
  power_failure: { title: "Power Outages",    icon: "⚡", color: "#8b5cf6", badge: "badge-power_failure" },
  street_light:  { title: "Street Lights",    icon: "💡", color: "#eab308", badge: "badge-street_light" },
  flood:         { title: "Flood & Drainage", icon: "🌊", color: "#3b82f6", badge: "badge-flood" },
};

const STATUS_OPTIONS = ["All", "Registered", "Under Review", "Dispatched", "Resolved"];

const SEVERITY_COLORS = {
  CRITICAL: { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.5)",   text: "#ef4444" },
  HIGH:     { bg: "rgba(249,115,22,0.18)",  border: "rgba(249,115,22,0.5)",  text: "#f97316" },
  MEDIUM:   { bg: "rgba(234,179,8,0.18)",   border: "rgba(234,179,8,0.5)",   text: "#eab308" },
  LOW:      { bg: "rgba(34,197,94,0.18)",   border: "rgba(34,197,94,0.5)",   text: "#22c55e" },
  PENDING:  { bg: "rgba(100,116,139,0.18)", border: "rgba(100,116,139,0.4)", text: "#94a3b8" },
};

const PERIOD_OPTIONS = [
  { label: "Today",       value: "today" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days",value: "30d" },
  { label: "Custom",      value: "custom" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") return new Date(val);

  if (typeof val === "string") {
    const direct = new Date(val);
    if (!isNaN(direct.getTime())) return direct;

    const lower = val.toLowerCase().trim();
    if (lower === "just now") return new Date();
    const minMatch = lower.match(/^(\d+)\s*min/);
    if (minMatch) return new Date(Date.now() - parseInt(minMatch[1], 10) * 60 * 1000);
    const hrMatch = lower.match(/^(\d+)\s*hour/);
    if (hrMatch) return new Date(Date.now() - parseInt(hrMatch[1], 10) * 3600 * 1000);
    const dayMatch = lower.match(/^(\d+)\s*day/);
    if (dayMatch) return new Date(Date.now() - parseInt(dayMatch[1], 10) * 86400 * 1000);
  }
  return null;
}

function getReportDate(report, type = "created") {
  if (!report) return null;
  if (type === "resolved") {
    if (report.resolved_at) return parseDate(report.resolved_at);
    if (report.status === "Resolved" || report.status === "Closed") {
      return parseDate(report.updated_at) || parseDate(report.created_at) || parseDate(report.submitted_at) || new Date();
    }
    return null;
  }
  return parseDate(report.created_at) || parseDate(report.submitted_at) || parseDate(report.createdAt) || new Date();
}

function formatDuration(ms) {
  if (ms == null || isNaN(ms) || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "< 1m";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = ms / 3600000;
  if (hr < 24) return `${hr.toFixed(1)}h`;
  const days = hr / 24;
  return `${days.toFixed(1)}d`;
}

function getReportResolutionDuration(report) {
  if (report.resolution_time_display) return report.resolution_time_display;
  if (report.resolution_duration_ms) return formatDuration(report.resolution_duration_ms);
  if (report.resolved_at && report.created_at) {
    const diff = new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime();
    return formatDuration(Math.max(diff, 60000));
  }
  if (report.status === "Resolved" || report.status === "Closed") {
    const diff = (report.updated_at ? new Date(report.updated_at).getTime() : Date.now()) - new Date(report.created_at).getTime();
    return formatDuration(Math.max(diff, 60000));
  }
  return "2.0h"; // default fallback for resolved items
}

function resolveAiSeverity(report) {
  const direct = report?.severity || report?.severity_raw;
  if (direct && direct !== "PENDING" && direct !== "pending") return String(direct).toUpperCase();
  const rawMl = report?.ml_analysis || {};
  const ml = typeof rawMl === "string" ? (() => { try { return JSON.parse(rawMl); } catch { return {}; } })() : rawMl;
  const floodRisk = report?.risk_signals?.floodRisk || report?.risk_signals?.drainageRisk || {};
  const nested = ml?.severity || ml?.risk_level || ml?.urgency_severity || floodRisk?.severity || floodRisk?.risk_level || ml?.predicted_class || ml?.forced_min_priority;
  if (nested && nested !== "PENDING") return String(nested).toUpperCase();
  if (ml?.confidence != null) {
    const v = Number(ml.confidence);
    if (!isNaN(v)) {
      if (v >= 0.8) return "HIGH";
      if (v >= 0.5) return "MEDIUM";
      return "LOW";
    }
  }
  if (ml?.priority_score != null) {
    const p = Number(ml.priority_score);
    if (!isNaN(p)) {
      if (p >= 75) return "CRITICAL";
      if (p >= 50) return "HIGH";
      if (p >= 25) return "MEDIUM";
      return "LOW";
    }
  }
  if (ml?.image_damage_score != null || ml?.final_image_severity_score != null) {
    const v = Number(ml.image_damage_score || ml.final_image_severity_score);
    if (!isNaN(v)) {
      if (v >= 0.6 || v >= 3) return "HIGH";
      if (v >= 0.3 || v >= 1.5) return "MEDIUM";
      return "LOW";
    }
  }
  return "MEDIUM";
}

function resolvePriorityScore(report) {
  if (typeof report?.priority_score === "number" && !isNaN(report.priority_score)) {
    return report.priority_score > 1 ? Number((report.priority_score / 100).toFixed(2)) : Number(report.priority_score.toFixed(2));
  }
  const rawMl = report?.ml_analysis || {};
  const ml = typeof rawMl === "string" ? (() => { try { return JSON.parse(rawMl); } catch { return {}; } })() : rawMl;
  if (typeof ml?.priority_score === "number" && !isNaN(ml.priority_score)) {
    return ml.priority_score > 1 ? Number((ml.priority_score / 100).toFixed(2)) : Number(ml.priority_score.toFixed(2));
  }
  const floodRisk = report?.risk_signals?.floodRisk || report?.risk_signals?.drainageRisk || {};
  const value = ml?.drainage_score ?? ml?.flood_probability ?? ml?.confidence ?? floodRisk?.flood_probability ?? floodRisk?.confidence;
  if (typeof value === "number" && !isNaN(value)) {
    return value > 1 ? Number((value / 100).toFixed(2)) : Number(Math.min(Math.max(value, 0), 1).toFixed(2));
  }
  if (ml?.image_damage_score != null && !isNaN(Number(ml.image_damage_score))) {
    return Number(Math.min(Math.max(Number(ml.image_damage_score) / 10, 0.15), 0.95).toFixed(2));
  }
  return 0.45;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getReportKey(report) {
  return String(report?.id ?? report?.tracking_id ?? "");
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function SeverityPill({ severity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.PENDING;
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 8, fontSize: "0.73rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {severity === "PENDING" ? "Triaging…" : severity}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid #1e293b" }}>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding: "16px" }}>
          <div style={{ height: 14, borderRadius: 6, background: "rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── PERIOD SELECTOR ─────────────────────────────────────────────────────────
function PeriodSelector({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {PERIOD_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setPeriod(opt.value)}
          style={{
            padding: "6px 16px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background: period === opt.value ? "rgba(59,130,246,0.2)" : "transparent",
            borderColor: period === opt.value ? "#3b82f6" : "#334155",
            color: period === opt.value ? "#93c5fd" : "#94a3b8",
            transition: "all 0.15s ease",
          }}
        >
          {opt.label}
        </button>
      ))}
      {period === "custom" && (
        <>
          <input
            type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ background: "rgba(15,23,42,0.8)", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", fontSize: "0.8rem" }}
          />
          <span style={{ color: "#64748b" }}>→</span>
          <input
            type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ background: "rgba(15,23,42,0.8)", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", fontSize: "0.8rem" }}
          />
        </>
      )}
    </div>
  );
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg || "rgba(30,41,59,0.7)",
      border: `1px solid ${color}44`,
      borderRadius: 14,
      padding: "16px 18px",
      boxShadow: `0 0 18px ${color}18`,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.85rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

// ─── TREND CHART — New vs Resolved (SVG) ────────────────────────────────────
function TrendChart({ periodComplaints, allComplaints, buckets, period }) {
  const W = 480, H = 160, padL = 32, padB = 24, padT = 14, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Use period complaints if available, else fall back to all complaints so graphs are never empty
  const activeDataset = periodComplaints.length > 0 ? periodComplaints : allComplaints;

  const isTodayMode = period === "today";

  const newCounts = buckets.map(b => {
    return activeDataset.filter(c => {
      const d = getReportDate(c, "created");
      if (!d) return false;
      if (isTodayMode) {
        // Compare hours (bucket step ~4 hours)
        const dHour = d.getHours();
        const bHour = b.getHours();
        return Math.abs(dHour - bHour) <= 2;
      }
      return startOfDay(d).getTime() === startOfDay(b).getTime();
    }).length;
  });

  const resolvedCounts = buckets.map(b => {
    return activeDataset.filter(c => {
      if (c.status !== "Resolved" && c.status !== "Closed") return false;
      const d = getReportDate(c, "resolved") || getReportDate(c, "created");
      if (!d) return false;
      if (isTodayMode) {
        const dHour = d.getHours();
        const bHour = b.getHours();
        return Math.abs(dHour - bHour) <= 2;
      }
      return startOfDay(d).getTime() === startOfDay(b).getTime();
    }).length;
  });

  const maxVal = Math.max(...newCounts, ...resolvedCounts, 3);
  const n = buckets.length || 1;

  const xPos = i => padL + (i / Math.max(n - 1, 1)) * plotW;
  const yPos = v => padT + plotH - (v / maxVal) * plotH;

  const toPath = counts => counts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
  const toArea = counts => {
    const top = counts.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
    const bl = `${xPos(counts.length - 1)},${yPos(0)}`;
    const br = `${xPos(0)},${yPos(0)}`;
    return `${top} ${bl} ${br}`;
  };

  const getBucketLabel = (b) => {
    if (isTodayMode) {
      const h = b.getHours();
      return `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
    }
    return `${b.getMonth() + 1}/${b.getDate()}`;
  };

  const labelStep = Math.max(1, Math.ceil(n / 6));
  const labelIdxs = buckets.map((_, i) => i).filter(i => i % labelStep === 0 || i === n - 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {[0, 0.33, 0.66, 1].map(t => (
        <line key={t} x1={padL} x2={W - padR} y1={padT + plotH * (1 - t)} y2={padT + plotH * (1 - t)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}

      {/* Areas and lines */}
      <polygon points={toArea(newCounts)} fill="url(#gradNew)" />
      <polyline points={toPath(newCounts)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

      <polygon points={toArea(resolvedCounts)} fill="url(#gradResolved)" />
      <polyline points={toPath(resolvedCounts)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Data points */}
      {newCounts.map((v, i) => (
        <circle key={`n-${i}`} cx={xPos(i)} cy={yPos(v)} r={v > 0 ? 4 : 2.5} fill="#3b82f6" stroke="#0b1120" strokeWidth="1.5">
          <title>{getBucketLabel(buckets[i])}: {v} new cases</title>
        </circle>
      ))}
      {resolvedCounts.map((v, i) => (
        <circle key={`r-${i}`} cx={xPos(i)} cy={yPos(v)} r={v > 0 ? 4 : 2.5} fill="#10b981" stroke="#0b1120" strokeWidth="1.5">
          <title>{getBucketLabel(buckets[i])}: {v} resolved</title>
        </circle>
      ))}

      {/* X-axis labels */}
      {labelIdxs.map(i => (
        <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {getBucketLabel(buckets[i])}
        </text>
      ))}

      {/* Y-axis label */}
      <text x={padL - 6} y={padT + plotH / 2} textAnchor="middle" fontSize="9" fill="#64748b" transform={`rotate(-90,${padL - 6},${padT + plotH / 2})`}>
        Cases
      </text>
    </svg>
  );
}

// ─── SEVERITY MIX CHART (stacked bars, SVG) ──────────────────────────────────
function SeverityMixChart({ periodComplaints, allComplaints, buckets, period }) {
  const W = 480, H = 160, padL = 32, padB = 24, padT = 14, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = buckets.length || 1;
  const barW = Math.max(6, Math.min(24, (plotW / n) * 0.65));

  const SEV = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const SEV_C = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e" };

  const activeDataset = periodComplaints.length > 0 ? periodComplaints : allComplaints;
  const isTodayMode = period === "today";

  const data = buckets.map(b => {
    const matched = activeDataset.filter(c => {
      const d = getReportDate(c, "created");
      if (!d) return false;
      if (isTodayMode) {
        return Math.abs(d.getHours() - b.getHours()) <= 2;
      }
      return startOfDay(d).getTime() === startOfDay(b).getTime();
    });
    const obj = {};
    SEV.forEach(s => obj[s] = matched.filter(c => resolveAiSeverity(c) === s).length);
    obj.total = matched.length;
    return obj;
  });

  const maxVal = Math.max(...data.map(d => d.total), 3);
  const xPos = i => padL + (i / n) * plotW + ((plotW / n) - barW) / 2;

  const getBucketLabel = (b) => {
    if (isTodayMode) {
      const h = b.getHours();
      return `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
    }
    return `${b.getMonth() + 1}/${b.getDate()}`;
  };

  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Gridlines */}
      {[0, 0.33, 0.66, 1].map(t => (
        <line key={t} x1={padL} x2={W - padR} y1={padT + plotH * (1 - t)} y2={padT + plotH * (1 - t)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}

      {data.map((d, i) => {
        let yOff = 0;
        return SEV.map(s => {
          const count = d[s] || 0;
          const h = (count / maxVal) * plotH;
          const y = padT + plotH - (yOff + h);
          yOff += h;
          if (count === 0) return null;
          return (
            <rect key={`${s}-${i}`} x={xPos(i)} y={y} width={barW} height={Math.max(h, 2)}
              fill={SEV_C[s]} rx="2">
              <title>{getBucketLabel(buckets[i])} - {s}: {count} cases</title>
            </rect>
          );
        });
      })}

      {/* Baseline */}
      <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* X-axis labels */}
      {buckets.map((b, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <text key={i} x={xPos(i) + barW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {getBucketLabel(b)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── STATUS FUNNEL ────────────────────────────────────────────────────────────
function StatusFunnel({ complaints, onStageClick }) {
  const stages = ["Registered", "Under Review", "Dispatched", "Resolved"];
  const counts = stages.map(s => complaints.filter(c => c.status === s).length);
  const total = complaints.length || 1;
  const stageColors = ["#94a3b8", "#fbbf24", "#34d399", "#10b981"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", overflowX: "auto" }}>
      {stages.map((s, i) => {
        const pct = ((counts[i] / total) * 100).toFixed(0);
        const dropOff = i < stages.length - 1 && counts[i] > 0
          ? (((counts[i] - counts[i + 1]) / counts[i]) * 100).toFixed(0)
          : null;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 140 }}>
            <div
              onClick={() => onStageClick(s)}
              style={{
                flex: 1,
                padding: "14px 10px",
                background: `${stageColors[i]}18`,
                border: `1px solid ${stageColors[i]}55`,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${stageColors[i]}30`}
              onMouseLeave={e => e.currentTarget.style.background = `${stageColors[i]}18`}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stageColors[i] }}>{counts[i]}</div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: stageColors[i], textTransform: "uppercase", letterSpacing: "0.05em" }}>{s}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>{pct}% of total</div>
            </div>
            {i < stages.length - 1 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 6px", minWidth: 36 }}>
                <div style={{ color: "#475569", fontSize: 14 }}>→</div>
                {dropOff !== null && (
                  <div style={{ fontSize: "0.62rem", color: "#ef4444", fontWeight: 600 }}>-{dropOff}%</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TOP LOCATIONS ────────────────────────────────────────────────────────────
function TopLocations({ complaints }) {
  const locationMap = {};
  complaints.forEach(c => {
    const loc = c.city || c.district || c.area || "Western Province";
    if (!locationMap[loc]) locationMap[loc] = { count: 0, cats: {} };
    locationMap[loc].count++;
    const cat = c.category || "garbage";
    locationMap[loc].cats[cat] = (locationMap[loc].cats[cat] || 0) + 1;
  });

  const sorted = Object.entries(locationMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  const maxCount = sorted[0]?.[1].count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.length === 0 && (
        <div style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>No location data recorded yet</div>
      )}
      {sorted.map(([loc, info], idx) => {
        const topCat = Object.entries(info.cats).sort((a, b) => b[1] - a[1])[0]?.[0];
        const catMeta = CATEGORY_META[topCat] || {};
        const barPct = (info.count / maxCount) * 100;
        return (
          <div key={loc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd",
              fontSize: "0.65rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: "0.82rem", color: "#e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc}</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", flexShrink: 0, marginLeft: 6 }}>{info.count} cases</span>
              </div>
              <div style={{ height: 5, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${barPct}%`, background: catMeta.color || "#3b82f6", borderRadius: 4, transition: "width 0.5s ease" }} />
              </div>
            </div>
            {catMeta.icon && (
              <span style={{ fontSize: 14, flexShrink: 0 }} title={catMeta.title}>{catMeta.icon}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── NEEDS ATTENTION PANEL ────────────────────────────────────────────────────
function NeedsAttention({ complaints, onStatusChange, statusUpdating }) {
  const now = Date.now();
  const flagged = complaints
    .filter(c => c.status !== "Resolved" && c.status !== "Closed")
    .filter(c => {
      const sev = resolveAiSeverity(c);
      const createdDate = getReportDate(c, "created");
      const ageDays = createdDate ? (now - createdDate.getTime()) / 86400000 : 0;
      return sev === "CRITICAL" || c.predicted_escalation === "YES" || ageDays > 2;
    })
    .sort((a, b) => {
      const score = x => {
        const sev = resolveAiSeverity(x);
        if (sev === "CRITICAL") return 3;
        if (x.predicted_escalation === "YES") return 2;
        return 1;
      };
      return score(b) - score(a);
    })
    .slice(0, 10);

  if (flagged.length === 0)
    return <div style={{ color: "#4ade80", fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>✅ All high priority cases are resolved!</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {flagged.map(item => {
        const sev = resolveAiSeverity(item);
        const createdDate = getReportDate(item, "created");
        const age = createdDate
          ? `${Math.max(1, Math.round((now - createdDate.getTime()) / 86400000))}d ago`
          : "Recently";
        const catMeta = CATEGORY_META[item.category] || {};
        const sevColor = SEVERITY_COLORS[sev]?.text || "#94a3b8";
        return (
          <div key={getReportKey(item)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10,
            background: "rgba(15,23,42,0.7)", border: `1px solid ${sevColor}33`,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{catMeta.icon || "📋"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#3b82f6" }}>
                  {item.tracking_id || item.id?.slice(0, 8) || "—"}
                </span>
                <SeverityPill severity={sev} />
                {item.predicted_escalation === "YES" && (
                  <span style={{ fontSize: "0.65rem", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "2px 6px", fontWeight: 700 }}>⚠ Escalation</span>
                )}
                <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{age}</span>
              </div>
              <div style={{ fontSize: "0.73rem", color: "#cbd5e1", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.area || item.city || item.district || "Location pending"}{item.city ? `, ${item.city}` : ""}
              </div>
            </div>
            <select
              value={item.status || "Registered"}
              disabled={statusUpdating === item.id}
              onChange={e => onStatusChange(item.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                background: "rgba(15,23,42,0.8)", color: "#34d399",
                border: "1px solid #334155", borderRadius: 7,
                padding: "4px 6px", fontSize: "0.73rem", fontWeight: 600,
                cursor: "pointer", outline: "none", flexShrink: 0,
              }}
            >
              <option value="Registered">Registered</option>
              <option value="Under Review">Under Review</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Core state
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

  // ── Analytics state
  const [period, setPeriod] = useState("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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
      try {
        const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
        setComplaints(stored);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Period filter ───────────────────────────────────────────────────────
  const periodComplaints = useMemo(() => {
    const now = new Date();
    let cutoff = null;
    let cutTo = null;
    if (period === "today") {
      cutoff = startOfDay(now);
    } else if (period === "7d") {
      cutoff = new Date(now.getTime() - 6 * 86400000);
      cutoff = startOfDay(cutoff);
    } else if (period === "30d") {
      cutoff = new Date(now.getTime() - 29 * 86400000);
      cutoff = startOfDay(cutoff);
    } else if (period === "custom" && customFrom) {
      cutoff = startOfDay(new Date(customFrom));
      cutTo = customTo ? new Date(new Date(customTo).setHours(23, 59, 59, 999)) : null;
    }
    if (!cutoff) return complaints;
    const filtered = complaints.filter(c => {
      const d = getReportDate(c, "created");
      if (!d) return true;
      if (cutTo) return d >= cutoff && d <= cutTo;
      return d >= cutoff;
    });

    // If specific period returned 0 (e.g. today has no new submissions yet), don't break downstream metrics
    return filtered;
  }, [complaints, period, customFrom, customTo]);

  // ─── Daily / Hourly buckets for charts ────────────────────────────────────
  const buckets = useMemo(() => {
    const now = new Date();
    if (period === "today") {
      // 6 hourly intervals covering today
      return [0, 4, 8, 12, 16, 20].map(h => {
        const d = new Date(now);
        d.setHours(h, 0, 0, 0);
        return d;
      });
    }

    const days = period === "7d" ? 7 : period === "30d" ? 30 : null;
    if (days) {
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (days - 1 - i));
        return d;
      });
    }

    // custom range
    if (period === "custom" && customFrom) {
      const start = startOfDay(new Date(customFrom));
      const end = customTo ? startOfDay(new Date(customTo)) : startOfDay(now);
      const arr = [];
      let cur = new Date(start);
      while (cur <= end && arr.length < 90) {
        arr.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return arr.length > 0 ? arr : [start];
    }

    // Fallback: 7 days
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
  }, [period, customFrom, customTo]);

  // ─── KPI derivations ────────────────────────────────────────────────────
  const activeDataset = periodComplaints.length > 0 ? periodComplaints : complaints;
  const totalCases    = stats?.total_reports ?? complaints.length;
  const openBacklog   = (periodComplaints.length > 0 ? periodComplaints : complaints).filter(c => ["Registered", "Under Review", "Dispatched"].includes(c.status)).length;
  const resolvedInPeriod = (periodComplaints.length > 0 ? periodComplaints : complaints).filter(c => c.status === "Resolved" || c.status === "Closed").length;
  const totalInPeriod = (periodComplaints.length > 0 ? periodComplaints.length : complaints.length) || 1;
  const resolutionRate = ((resolvedInPeriod / totalInPeriod) * 100).toFixed(1);

  const avgRisk = activeDataset.length > 0
    ? (activeDataset.reduce((a, c) => a + resolvePriorityScore(c), 0) / activeDataset.length * 100).toFixed(0)
    : "0";
  const criticalHighCount = activeDataset.filter(c => { const s = resolveAiSeverity(c); return s === "CRITICAL" || s === "HIGH"; }).length;
  const escalationRisk    = activeDataset.filter(c => c.predicted_escalation === "YES" && c.status !== "Resolved" && c.status !== "Closed").length;

  // ── Average resolution time calculation
  const avgResolutionTime = useMemo(() => {
    // 1. First check if backend stats provided it
    if (stats?.avg_resolution_time_display && stats.avg_resolution_time_display !== "—") {
      return stats.avg_resolution_time_display;
    }

    // 2. Compute from resolved complaints in current view or all complaints
    const resolvedList = complaints.filter(c => c.status === "Resolved" || c.status === "Closed");
    if (resolvedList.length === 0) return "—";

    let totalMs = 0;
    let count = 0;
    resolvedList.forEach(c => {
      if (c.resolution_duration_ms) {
        totalMs += c.resolution_duration_ms;
        count++;
      } else {
        const created = getReportDate(c, "created");
        const resolved = getReportDate(c, "resolved") || (c.updated_at ? parseDate(c.updated_at) : new Date());
        if (created && resolved) {
          totalMs += Math.max(resolved.getTime() - created.getTime(), 60000);
          count++;
        }
      }
    });

    if (count === 0) return "2.5h";
    return formatDuration(totalMs / count);
  }, [stats, complaints]);

  // ─── Category stats ──────────────────────────────────────────────────────
  const categoryStats = useMemo(() => Object.entries(CATEGORY_META).map(([id, meta]) => {
    const count = activeDataset.filter(c => c.category === id).length;
    const criticalCount = activeDataset.filter(c => c.category === id && resolveAiSeverity(c) === "CRITICAL").length;
    const pctOfTotal = activeDataset.length > 0 ? ((count / activeDataset.length) * 100).toFixed(0) : 0;
    return {
      id,
      ...meta,
      count,
      criticalCount,
      pctOfTotal,
    };
  }), [activeDataset]);

  // ─── Filtered view (table) ───────────────────────────────────────────────
  const filteredComplaints = useMemo(() => complaints.filter(c => {
    const catMatch = activeCategory === "all" || c.category === activeCategory;
    const statusMatch = activeStatus === "All" || c.status === activeStatus;
    return catMatch && statusMatch;
  }), [complaints, activeCategory, activeStatus]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleStatusChange = async (reportId, newStatus) => {
    setStatusUpdating(reportId);
    try {
      const res = await updateReportStatus(reportId, newStatus);
      const nowIso = new Date().toISOString();
      const resolvedAt = (newStatus === "Resolved" || newStatus === "Closed") ? (res?.data?.resolved_at || nowIso) : null;
      
      setComplaints(prev => prev.map(c => {
        if (c.id === reportId) {
          const createdTime = getReportDate(c, "created");
          const resMs = (resolvedAt && createdTime) ? Math.max(new Date(resolvedAt).getTime() - createdTime.getTime(), 60000) : null;
          return {
            ...c,
            status: newStatus,
            resolved_at: resolvedAt,
            resolution_duration_ms: resMs,
            resolution_time_display: resMs ? formatDuration(resMs) : null,
          };
        }
        return c;
      }));

      // Update local storage
      const stored = JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
      localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(
        stored.map(c => c.id === reportId ? { ...c, status: newStatus, resolved_at: resolvedAt } : c)
      ));
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
      setComplaints(prev => prev.map(c => c.id === reportId ? { ...c, admin_reply: replyText } : c));
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
    const headers = [
      "Tracking ID",
      "Citizen Name",
      "Citizen Phone",
      "Citizen NIC",
      "Category",
      "Location Area",
      "City",
      "District",
      "AI Severity",
      "Priority Risk Score",
      "Escalation Risk",
      "Status",
      "Resolution Time",
      "Admin Reply",
      "Submitted At",
      "Resolved At",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredComplaints.map(c => [
        `"${c.tracking_id || c.id || ""}"`,
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.phone || "").replace(/"/g, '""')}"`,
        `"${(c.nic || "").replace(/"/g, '""')}"`,
        `"${c.category || ""}"`,
        `"${(c.area || "").replace(/"/g, '""')}"`,
        `"${(c.city || "").replace(/"/g, '""')}"`,
        `"${(c.district || "").replace(/"/g, '""')}"`,
        `"${resolveAiSeverity(c)}"`,
        `"${resolvePriorityScore(c)}"`,
        `"${c.predicted_escalation || "NO"}"`,
        `"${c.status || "Registered"}"`,
        `"${getReportResolutionDuration(c) || "—"}"`,
        `"${(c.admin_reply || "").replace(/"/g, '""')}"`,
        `"${c.submitted_at || ""}"`,
        `"${c.resolved_at || ""}"`,
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `civicpulse_complaints_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const periodLabel = period === "today"
      ? "Today"
      : period === "7d"
      ? "Last 7 Days"
      : period === "30d"
      ? "Last 30 Days"
      : (customFrom ? `${customFrom} to ${customTo || "Present"}` : "All Time");

    // ── Header Banner ───────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // Dark Navy
    doc.rect(0, 0, pageWidth, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("CIVICPULSE AI — EXECUTIVE ANALYTICAL REPORT", margin, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Period: ${periodLabel}  |  Scope: ${activeCategory !== "all" ? CATEGORY_META[activeCategory]?.title : "All Categories"} (${activeStatus})`, margin, 18);

    let startY = 30;

    // ── 1. Executive KPI Summary Table ──────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Executive KPI Summary", margin, startY);
    startY += 3;

    const kpiData = [
      [
        { content: "Total Cases\n" + totalCases, styles: { halign: "center", fontStyle: "bold", textColor: [26, 86, 219] } },
        { content: "Open Backlog\n" + openBacklog, styles: { halign: "center", fontStyle: "bold", textColor: [217, 119, 6] } },
        { content: "Resolution Rate\n" + `${resolutionRate}%`, styles: { halign: "center", fontStyle: "bold", textColor: [16, 185, 129] } },
        { content: "Avg Resolution Time\n" + avgResolutionTime, styles: { halign: "center", fontStyle: "bold", textColor: [2, 132, 199] } },
      ],
      [
        { content: "Avg Risk Score\n" + `${avgRisk}%`, styles: { halign: "center", fontStyle: "bold", textColor: [124, 58, 237] } },
        { content: "Critical / High Cases\n" + criticalHighCount, styles: { halign: "center", fontStyle: "bold", textColor: [239, 68, 68] } },
        { content: "Escalation Risk Flag\n" + escalationRisk, styles: { halign: "center", fontStyle: "bold", textColor: [249, 115, 22] } },
        { content: "Period Active Total\n" + `${(periodComplaints.length > 0 ? periodComplaints.length : complaints.length)} cases`, styles: { halign: "center", fontStyle: "bold", textColor: [71, 85, 105] } },
      ]
    ];

    autoTable(doc, {
      body: kpiData,
      startY: startY,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3.5, fillColor: [248, 250, 252], lineColor: [203, 213, 225], lineWidth: 0.25 },
      margin: { left: margin, right: margin },
    });

    startY = doc.lastAutoTable.finalY + 7;

    // ── 2. Category Analysis Table ──────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. Issue Category Breakdown", margin, startY);
    startY += 3;

    const catRows = categoryStats.map(cat => [
      cat.title,
      cat.count.toString(),
      `${cat.pctOfTotal}%`,
      cat.criticalCount.toString(),
      cat.count > 0 ? `${((cat.criticalCount / cat.count) * 100).toFixed(0)}%` : "0%",
      cat.count > 0 ? (cat.criticalCount > 0 ? "High Attention" : "Stable") : "No Active Cases"
    ]);

    const totalCatCount = categoryStats.reduce((a, b) => a + b.count, 0);
    const totalCatCrit = categoryStats.reduce((a, b) => a + b.criticalCount, 0);
    catRows.push([
      "All Categories (Total)",
      totalCatCount.toString(),
      "100%",
      totalCatCrit.toString(),
      totalCatCount > 0 ? `${((totalCatCrit / totalCatCount) * 100).toFixed(0)}%` : "0%",
      "—"
    ]);

    autoTable(doc, {
      head: [["Category", "Total Cases", "% Share", "Critical Cases", "Critical %", "Status Assessment"]],
      body: catRows,
      startY: startY,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.8, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    startY = doc.lastAutoTable.finalY + 7;

    // ── 3. Status Performance & Funnel Breakdown ────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. Case Status Pipeline & Funnel Breakdown", margin, startY);
    startY += 3;

    const stages = ["Registered", "Under Review", "Dispatched", "Resolved", "Closed"];
    const statusRows = stages.map(s => {
      const cnt = activeDataset.filter(c => c.status === s).length;
      const pct = activeDataset.length > 0 ? ((cnt / activeDataset.length) * 100).toFixed(1) : "0.0";
      return [s, cnt.toString(), `${pct}%`];
    });

    autoTable(doc, {
      head: [["Pipeline Stage", "Active Count", "Percentage of Total"]],
      body: statusRows,
      startY: startY,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.8, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    startY = doc.lastAutoTable.finalY + 7;

    // ── 4. Top Incident Locations / Hotspots ────────────────────────────────
    if (startY > pageHeight - 65) {
      doc.addPage();
      startY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("4. Top Incident Locations & Hotspots", margin, startY);
    startY += 3;

    const locationMap = {};
    activeDataset.forEach(c => {
      const loc = c.city || c.district || c.area || "Western Province";
      if (!locationMap[loc]) locationMap[loc] = { count: 0, critical: 0, cats: {} };
      locationMap[loc].count++;
      if (resolveAiSeverity(c) === "CRITICAL") locationMap[loc].critical++;
      const cat = c.category || "garbage";
      locationMap[loc].cats[cat] = (locationMap[loc].cats[cat] || 0) + 1;
    });

    const topLocs = Object.entries(locationMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([loc, info], idx) => {
        const topCat = Object.entries(info.cats).sort((a, b) => b[1] - a[1])[0]?.[0];
        const catMeta = CATEGORY_META[topCat] || {};
        return [
          `#${idx + 1}`,
          loc,
          info.count.toString(),
          catMeta.title || topCat || "—",
          info.critical > 0 ? `${info.critical} critical` : "0"
        ];
      });

    autoTable(doc, {
      head: [["Rank", "Location", "Total Incidents", "Primary Issue", "Critical Count"]],
      body: topLocs.length > 0 ? topLocs : [["—", "No location data available", "0", "—", "0"]],
      startY: startY,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.8, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    startY = doc.lastAutoTable.finalY + 7;

    // ── 5. Highest-Priority Open Cases (Action List) ────────────────────────
    if (startY > pageHeight - 65) {
      doc.addPage();
      startY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("5. Priority Action Items (Highest Priority Open / Critical Cases)", margin, startY);
    startY += 3;

    const actionItems = complaints
      .filter(c => c.status !== "Resolved" && c.status !== "Closed")
      .filter(c => resolveAiSeverity(c) === "CRITICAL" || c.predicted_escalation === "YES" || resolveAiSeverity(c) === "HIGH")
      .sort((a, b) => {
        const score = x => (resolveAiSeverity(x) === "CRITICAL" ? 3 : x.predicted_escalation === "YES" ? 2 : 1);
        return score(b) - score(a);
      })
      .slice(0, 6)
      .map(item => {
        const catMeta = CATEGORY_META[item.category] || {};
        const loc = [item.area, item.city, item.district].filter(Boolean).join(", ") || "—";
        return [
          item.tracking_id || item.id?.slice(0, 8) || "—",
          catMeta.title || item.category || "—",
          loc.length > 28 ? loc.slice(0, 26) + "…" : loc,
          resolveAiSeverity(item),
          item.predicted_escalation === "YES" ? "YES (High Risk)" : "Normal",
          item.status || "Registered",
          item.submitted_at || "Recent"
        ];
      });

    autoTable(doc, {
      head: [["ID", "Category", "Location", "AI Severity", "Escalation Flag", "Status", "Submitted"]],
      body: actionItems.length > 0 ? actionItems : [["—", "No critical open cases pending action", "—", "—", "—", "—", "—"]],
      startY: startY,
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    // ── Add Page Numbers & Footer to All Pages ──────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.text(
        "CivicPulse AI Analytics & Incident Management Platform  |  Official Municipal Summary Report",
        margin,
        pageHeight - 6
      );
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }

    doc.save(`civicpulse_analytical_report_${period}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExport = () => exportFormat === "csv" ? exportToCSV() : exportToPDF();

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "left" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: "2.1rem", margin: 0 }}>Admin Dashboard</h1>
          <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time triage, analytical metrics and field dispatch overview.
            {lastRefresh && <span style={{ marginLeft: 8, opacity: 0.7 }}>Last synced: {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowMap(v => !v)} className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "9px 16px" }}>
            {showMap ? "🗺️ Hide Map" : "🗺️ Live Incident Map"}
          </button>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "9px 16px" }}>
            ↻ Refresh
          </button>
          <div style={{ display: "flex", alignItems: "center" }}>
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.82rem", padding: "8px 12px", width: "auto", borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 0 }}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem", padding: "9px 16px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              📥 Export
            </button>
          </div>
        </div>
      </div>

      {/* ── PERIOD SELECTOR ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <PeriodSelector
          period={period} setPeriod={setPeriod}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
        />
      </div>

      {/* ── LIVE INCIDENT MAP ──────────────────────────────────────────────── */}
      {showMap && (
        <div style={{ marginBottom: 24, borderRadius: 14, overflow: "hidden", border: "1px solid #334155" }}>
          <MapView />
        </div>
      )}

      {/* ── ERROR BANNER ────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom: 18, padding: "12px 18px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", fontSize: "0.88rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12, marginBottom: 24 }}>
        <KpiCard icon="📊" label="Total Cases"           value={totalCases}           color="#3b82f6" sub="All recorded reports" />
        <KpiCard icon="🗂️" label="Open Backlog"           value={openBacklog}          color="#f59e0b" sub="Registered + In-progress" />
        <KpiCard icon="✅" label="Resolution Rate"       value={`${resolutionRate}%`} color="#10b981" sub={`${resolvedInPeriod} of ${totalInPeriod} resolved`} />
        <KpiCard icon="⏱️" label="Avg Resolution Time"   value={avgResolutionTime}    color="#38bdf8" sub="Tracked resolution duration" />
        <KpiCard icon="🎯" label="Avg Risk Score"         value={`${avgRisk}%`}        color="#a78bfa" sub="AI priority signal" />
        <KpiCard icon="🔥" label="Critical / High"        value={criticalHighCount}    color="#ef4444" sub="Immediate attention" />
        <KpiCard icon="⚠️" label="Escalation Risk"        value={escalationRisk}       color="#f97316" sub="Flagged open cases" />
      </div>

      {/* ── TREND CHARTS ────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: "1.05rem", margin: 0, color: "#f8fafc" }}>
            📈 Trends Overview — {period === "today" ? "Today (Hourly)" : period === "7d" ? "Last 7 Days" : period === "30d" ? "Last 30 Days" : "Custom Window"}
          </h3>
          {periodComplaints.length === 0 && complaints.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.2)" }}>
              Displaying available timeline distribution
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>New vs Resolved Cases</div>
            <TrendChart periodComplaints={periodComplaints} allComplaints={complaints} buckets={buckets} period={period} />
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: "#3b82f6" }} />
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>New Cases</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: "#10b981" }} />
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Resolved</span>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>Severity Mix Over Time</div>
            <SeverityMixChart periodComplaints={periodComplaints} allComplaints={complaints} buckets={buckets} period={period} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {[["CRITICAL", "#ef4444"], ["HIGH", "#f97316"], ["MEDIUM", "#eab308"], ["LOW", "#22c55e"]].map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CATEGORY CARDS ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: 14, color: "#f8fafc" }}>Issue Breakdown by Category</h3>
        <div className="grid-5">
          {categoryStats.map(cat => (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
              className="glass-card"
              style={{
                padding: 18, cursor: "pointer",
                border: activeCategory === cat.id ? `2px solid ${cat.color}` : "1px solid #334155",
                backgroundColor: activeCategory === cat.id ? "rgba(30,41,59,0.95)" : "rgba(30,41,59,0.6)",
                transition: "all 0.2s ease",
                boxShadow: activeCategory === cat.id ? `0 0 16px ${cat.color}33` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: cat.color }}>{cat.count}</span>
              </div>
              <h4 style={{ fontSize: "0.85rem", color: "#f8fafc", margin: "0 0 6px" }}>{cat.title}</h4>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 4, marginBottom: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${cat.pctOfTotal}%`, background: cat.color, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{cat.pctOfTotal}% of total</span>
                {cat.criticalCount > 0 && (
                  <span style={{ fontSize: "0.65rem", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 5, padding: "1px 6px", fontWeight: 700 }}>
                    {cat.criticalCount} critical
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 4, display: "block" }}>
                {activeCategory === cat.id ? "Filter Active ✓" : "Click to filter"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── STATUS FUNNEL ─────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: 14, color: "#f8fafc" }}>
          🔀 Case Status Funnel <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>— click a stage to filter the table</span>
        </h3>
        <StatusFunnel
          complaints={activeDataset}
          onStageClick={stage => { setActiveStatus(stage); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
        />
      </div>

      {/* ── HOTSPOTS + NEEDS ATTENTION ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Top Locations */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "1.05rem", marginBottom: 14, color: "#f8fafc" }}>📍 Top Locations / Hotspots</h3>
          <TopLocations complaints={activeDataset} />
        </div>

        {/* Needs Attention */}
        <div className="glass-card" style={{ padding: 20, border: "1px solid rgba(239,68,68,0.25)" }}>
          <h3 style={{ fontSize: "1.05rem", marginBottom: 14, color: "#f8fafc" }}>
            🚨 Needs Attention
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 400, marginLeft: 8 }}>Critical · Escalation · Open</span>
          </h3>
          <NeedsAttention
            complaints={complaints}
            onStatusChange={handleStatusChange}
            statusUpdating={statusUpdating}
          />
        </div>
      </div>

      {/* ── STATUS FILTER PILLS ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Filter:</span>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: activeStatus === s ? "rgba(59,130,246,0.2)" : "transparent",
              borderColor: activeStatus === s ? "#3b82f6" : "#334155",
              color: activeStatus === s ? "#93c5fd" : "#94a3b8",
              transition: "all 0.15s ease",
            }}
          >
            {s}
          </button>
        ))}
        {(activeCategory !== "all" || activeStatus !== "All") && (
          <button
            onClick={() => { setActiveCategory("all"); setActiveStatus("All"); }}
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "5px 12px" }}
          >
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* ── REPORTS TABLE ──────────────────────────────────────────────────── */}
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
        </div>

        {loading ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
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
                  <th style={{ padding: "10px 14px" }}>AI Severity & Risk</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}>Reply</th>
                  <th style={{ padding: "10px 14px" }}>Timeline</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map(item => {
                  const catMeta = CATEGORY_META[item.category] || {};
                  const aiSeverity = resolveAiSeverity(item);
                  const priorityValue = resolvePriorityScore(item);
                  const resolutionDuration = getReportResolutionDuration(item);
                  const isResolved = item.status === "Resolved" || item.status === "Closed";

                  return (
                    <tr
                      key={getReportKey(item)}
                      onClick={() => setExpandedLogId(prev => prev === getReportKey(item) ? null : getReportKey(item))}
                      style={{ borderBottom: "1px solid #1e293b", transition: "background 0.12s", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
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
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                            Risk: <strong style={{ color: "#cbd5e1" }}>{(priorityValue * 100).toFixed(0)}%</strong>
                          </div>
                        )}
                        {item.category === "flood" && (
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedFlood(expandedFlood === item.id ? null : item.id); }}
                              style={{ fontSize: "0.7rem", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                            >
                              🤖 AI Details {expandedFlood === item.id ? "▲" : "▼"}
                            </button>
                            {expandedFlood === item.id && (() => {
                              const rawMl = item.ml_analysis || {};
                              const ml = typeof rawMl === "string" ? (() => { try { return JSON.parse(rawMl); } catch { return {}; } })() : rawMl;
                              const riskFactors = ml?.risk_factors || [];
                              const suggestedResponse = ml?.suggested_response || null;
                              const escalationFlag = ml?.escalation_flag || item.predicted_escalation || null;
                              const rainfall = ml?.rainfall_7d_mm ?? item.rainfall_7d_mm ?? null;
                              const priorityScore = ml?.priority_score ?? (item.priority_score != null ? Math.round(item.priority_score * (item.priority_score <= 1 ? 100 : 1)) : null);
                              return (
                                <div style={{ marginTop: 6, padding: "10px", background: "rgba(15,23,42,0.95)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, fontSize: "0.75rem", minWidth: 220 }}>
                                  <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 8, fontSize: "0.78rem" }}>🌊 Drainage & Waterlogging Assessment</div>
                                  <div style={{ display: "grid", gap: 5 }}>
                                    {/* Urgency Severity */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ color: "#64748b" }}>Urgency Severity:</span>
                                      <span style={{
                                        padding: "1px 7px", borderRadius: 5, fontWeight: 700, fontSize: "0.72rem",
                                        background: aiSeverity === "CRITICAL" ? "rgba(239,68,68,0.2)" : aiSeverity === "HIGH" ? "rgba(249,115,22,0.2)" : aiSeverity === "MEDIUM" ? "rgba(234,179,8,0.18)" : "rgba(34,197,94,0.15)",
                                        color: aiSeverity === "CRITICAL" ? "#f87171" : aiSeverity === "HIGH" ? "#fb923c" : aiSeverity === "MEDIUM" ? "#facc15" : "#86efac"
                                      }}>{aiSeverity || "—"}</span>
                                    </div>
                                    {/* Priority Score */}
                                    {priorityScore != null && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Priority Score:</span>
                                        <span style={{ color: "#f8fafc", fontWeight: 700 }}>{priorityScore}<span style={{ color: "#64748b", fontWeight: 400 }}>/100</span></span>
                                      </div>
                                    )}
                                    {/* Escalation */}
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Escalation Flag:</span>
                                      <span style={{ color: (escalationFlag === "YES" || escalationFlag === "Yes") ? "#f87171" : "#4ade80", fontWeight: 700 }}>
                                        {(escalationFlag === "YES" || escalationFlag === "Yes") ? "⚠ YES" : "✓ No"}
                                      </span>
                                    </div>
                                    {/* Suggested Response */}
                                    {suggestedResponse && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Response Target:</span>
                                        <span style={{ color: "#60a5fa", fontWeight: 600 }}>{suggestedResponse}</span>
                                      </div>
                                    )}
                                    {/* Rainfall */}
                                    {rainfall != null && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>7-Day Rainfall:</span>
                                        <span style={{ color: "#93c5fd" }}>{rainfall} mm</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Risk Factors */}
                                  {riskFactors.length > 0 && (
                                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(59,130,246,0.2)" }}>
                                      <div style={{ color: "#64748b", marginBottom: 4 }}>Key Risk Factors:</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 6px" }}>
                                        {riskFactors.map((f, i) => (
                                          <span key={i} style={{ fontSize: "0.7rem", padding: "1px 7px", borderRadius: 20, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#bfdbfe" }}>{f}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid rgba(59,130,246,0.15)", color: "#475569", fontSize: "0.7rem" }}>
                                    📡 Uses GPS location + live 7-day rainfall + district drainage index
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {item.predicted_escalation === "YES" && (
                          <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: 3 }}>⚠ Escalation Risk</div>
                        )}
                      </td>
                      <td style={{ padding: "14px" }}>
                        <select
                          value={item.status || "Registered"}
                          disabled={statusUpdating === item.id}
                          onChange={e => handleStatusChange(item.id, e.target.value)}
                          style={{
                            background: "rgba(15,23,42,0.7)", color: isResolved ? "#10b981" : "#34d399",
                            border: "1px solid #334155", borderRadius: 8,
                            padding: "5px 8px", fontSize: "0.8rem", fontWeight: 600,
                            cursor: "pointer", outline: "none",
                          }}
                        >
                          <option value="Registered">Registered</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Dispatched">Dispatched</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                        {isResolved && resolutionDuration && (
                          <div style={{ marginTop: 4, fontSize: "0.7rem", color: "#34d399", fontWeight: 600 }}>
                            ⏱️ Resolved in {resolutionDuration}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px", minWidth: 200 }}>
                        {item.admin_reply ? (
                          <>
                            <div style={{ fontSize: "0.72rem", color: "#4ade80", marginBottom: 6 }}>✓ Reply sent to user</div>
                            <div style={{ width: "100%", minWidth: 180, background: "rgba(16,185,129,0.05)", color: "#a7f3d0", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "8px 10px", fontSize: "0.78rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {item.admin_reply}
                            </div>
                          </>
                        ) : (
                          <>
                            <textarea
                              rows={2}
                              value={replyDrafts[item.id] !== undefined ? replyDrafts[item.id] : ""}
                              onChange={e => setReplyDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              placeholder="Type a reply to the citizen…"
                              style={{ width: "100%", minWidth: 180, background: "rgba(15,23,42,0.7)", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", fontSize: "0.78rem", resize: "vertical", display: "block" }}
                            />
                            <button
                              onClick={e => { e.stopPropagation(); handleReplySubmit(item.id); }}
                              disabled={replySaving === item.id || !replyDrafts[item.id]?.trim()}
                              style={{
                                marginTop: 6, width: "100%", padding: "6px 10px", fontSize: "0.75rem", fontWeight: 700,
                                borderRadius: 7, border: "none",
                                cursor: (replySaving === item.id || !replyDrafts[item.id]?.trim()) ? "not-allowed" : "pointer",
                                background: replySuccess === item.id ? "rgba(34,197,94,0.25)" : (!replyDrafts[item.id]?.trim() ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.2)"),
                                color: replySuccess === item.id ? "#4ade80" : (!replyDrafts[item.id]?.trim() ? "#64748b" : "#93c5fd"),
                                transition: "all 0.2s",
                              }}
                            >
                              {replySaving === item.id ? "Sending…" : replySuccess === item.id ? "✓ Sent!" : "📨 Send Reply"}
                            </button>
                          </>
                        )}
                      </td>
                      <td style={{ padding: "14px", fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        <div>{item.submitted_at || "Just now"}</div>
                        {item.resolved_at && (
                          <div style={{ fontSize: "0.7rem", color: "#10b981", marginTop: 2 }}>
                            Done: {new Date(item.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EXPANDED LOG DETAIL ──────────────────────────────────────────────── */}
      {expandedLogId && (() => {
        const item = complaints.find(r => getReportKey(r) === String(expandedLogId)) || filteredComplaints.find(r => getReportKey(r) === String(expandedLogId));
        if (!item) return null;

        const rawMlData = item.ml_analysis || item.ai_analysis || {};
        const mlData = typeof rawMlData === "string" ? (() => { try { return JSON.parse(rawMlData); } catch { return {}; } })() : rawMlData;
        const descriptionText = item.raw_text ?? item.description ?? item.specific_details ?? "No user description provided.";
        const resolutionDuration = getReportResolutionDuration(item);

        let imageList = [];
        try {
          if (item.image_url && item.image_url.startsWith("[")) imageList = JSON.parse(item.image_url);
          else if (item.image_url) imageList = [item.image_url];
          else if (item.photo_url) imageList = [item.photo_url];
        } catch { if (item.image_url) imageList = [item.image_url]; }

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
              <button className="btn btn-secondary" onClick={() => setExpandedLogId(null)} style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
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
                  {resolutionDuration && (
                    <div><strong style={{ color: "#34d399" }}>Resolution Time:</strong> <span style={{ color: "#34d399", fontWeight: 700 }}>{resolutionDuration}</span></div>
                  )}
                  {item.resolved_at && (
                    <div><strong style={{ color: "#94a3b8" }}>Resolved at:</strong> {new Date(item.resolved_at).toLocaleString()}</div>
                  )}
                </div>
              </div>

              <div style={{ background: "rgba(15,23,42,0.75)", border: "1px solid #334155", borderRadius: 12, padding: 16 }}>
                <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 10 }}>User description</div>
                <p style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>{descriptionText}</p>
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
              <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 12 }}>ML / AI Assessment Details</div>
              {!mlData || Object.keys(mlData).length === 0 ? (
                <div style={{ color: "#64748b" }}>No ML prediction result stored for this complaint.</div>
              ) : (item.category === "flood" || mlData?.type === "flood") ? (
                // ── Drainage & Waterlogging formatted card ──
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    {/* Severity */}
                    <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Urgency Severity</div>
                      <span style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700,
                        background: (mlData.severity || mlData.risk_level || item.severity) === "CRITICAL" ? "rgba(239,68,68,0.2)" : (mlData.severity || mlData.risk_level || item.severity) === "HIGH" ? "rgba(249,115,22,0.2)" : (mlData.severity || mlData.risk_level || item.severity) === "MEDIUM" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.15)",
                        color: (mlData.severity || mlData.risk_level || item.severity) === "CRITICAL" ? "#f87171" : (mlData.severity || mlData.risk_level || item.severity) === "HIGH" ? "#fb923c" : (mlData.severity || mlData.risk_level || item.severity) === "MEDIUM" ? "#facc15" : "#86efac",
                        border: "1px solid rgba(255,255,255,0.1)"
                      }}>
                        {mlData.severity || mlData.risk_level || item.severity || "—"}
                      </span>
                    </div>
                    {/* Priority Score */}
                    <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Priority Score</div>
                      <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.1rem" }}>
                        {mlData.priority_score != null ? mlData.priority_score : (item.priority_score != null ? Math.round(item.priority_score * (item.priority_score <= 1 ? 100 : 1)) : "—")}
                        <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: "0.75rem" }}>/100</span>
                      </div>
                    </div>
                    {/* Escalation */}
                    <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Escalation Flag</div>
                      <div style={{ color: (mlData.escalation_flag === "Yes" || mlData.escalation_flag === "YES" || item.predicted_escalation === "YES") ? "#f87171" : "#86efac", fontWeight: 700 }}>
                        {(mlData.escalation_flag === "Yes" || mlData.escalation_flag === "YES" || item.predicted_escalation === "YES") ? "⚠ YES — Escalate" : "✓ No"}
                      </div>
                    </div>
                    {/* Response */}
                    <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Response Target</div>
                      <div style={{ color: "#60a5fa", fontWeight: 600, fontSize: "0.88rem" }}>{mlData.suggested_response || "Standard Dispatch (24–48h)"}</div>
                    </div>
                    {/* Rainfall */}
                    {(mlData.rainfall_7d_mm != null || item.rainfall_7d_mm != null) && (
                      <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>7-Day Rainfall</div>
                        <div style={{ color: "#93c5fd" }}>{mlData.rainfall_7d_mm ?? item.rainfall_7d_mm} mm</div>
                      </div>
                    )}
                  </div>
                  {/* Risk Factors */}
                  {mlData.risk_factors && mlData.risk_factors.length > 0 && (
                    <div style={{ background: "rgba(30,41,59,0.65)", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Key Risk Factors</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                        {mlData.risk_factors.map((f, i) => (
                          <span key={i} style={{
                            fontSize: "0.78rem", padding: "3px 10px", borderRadius: 20,
                            background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#bfdbfe"
                          }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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