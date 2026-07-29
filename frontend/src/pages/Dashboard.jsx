import { useState, useEffect } from "react";

const SAMPLE_COMPLAINTS = [
  {
    id: "CP-912041",
    name: "Saman Perera",
    phone: "+94 77 123 4567",
    category: "flood",
    category_label: "Flood & Drainage",
    icon: "🌊",
    district: "Colombo",
    city: "Colombo",
    area: "Baseline Road, Dematagoda",
    severity: "CRITICAL",
    status: "Dispatched",
    submitted_at: "10 mins ago"
  },
  {
    id: "CP-883102",
    name: "Anura Jayasinghe",
    phone: "+94 71 987 6543",
    category: "road_damage",
    category_label: "Road Damage",
    icon: "🚗",
    district: "Galle",
    city: "Galle",
    area: "Matara Road Junction",
    severity: "HIGH",
    status: "Under Review",
    submitted_at: "35 mins ago"
  },
  {
    id: "CP-754291",
    name: "Kamal De Silva",
    phone: "+94 76 555 1212",
    category: "garbage",
    category_label: "Garbage & Waste",
    icon: "🗑️",
    district: "Kandy",
    city: "Kandy",
    area: "Market Square Ward 3",
    severity: "MEDIUM",
    status: "Scheduled",
    submitted_at: "1 hour ago"
  },
  {
    id: "CP-632190",
    name: "Nimali Fernando",
    phone: "+94 72 333 4455",
    category: "power_failure",
    category_label: "Power Failure",
    icon: "⚡",
    district: "Gampaha",
    city: "Negombo",
    area: "Negombo Main Street",
    severity: "CRITICAL",
    status: "Dispatched",
    submitted_at: "2 hours ago"
  },
  {
    id: "CP-521908",
    name: "Ruwan Bandaranaike",
    phone: "+94 70 888 9900",
    category: "street_light",
    category_label: "Broken Street Light",
    icon: "💡",
    district: "Kurunegala",
    city: "Kurunegala",
    area: "Hospital Road",
    severity: "LOW",
    status: "Resolved",
    submitted_at: "4 hours ago"
  }
];

const CATEGORY_META = {
  flood: { title: "Flood & Drainage", icon: "🌊", color: "#3b82f6", badge: "badge-flood" },
  road_damage: { title: "Road Damages", icon: "🚗", color: "#f59e0b", badge: "badge-road_damage" },
  garbage: { title: "Garbage Waste", icon: "🗑️", color: "#10b981", badge: "badge-garbage" },
  power_failure: { title: "Power Outages", icon: "⚡", color: "#8b5cf6", badge: "badge-power_failure" },
  street_light: { title: "Street Lights", icon: "💡", color: "#eab308", badge: "badge-street_light" }
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [complaints, setComplaints] = useState([]);

  // Load complaints: user-submitted (localStorage) + sample data
  useEffect(() => {
    const loadComplaints = () => {
      try {
        const storedStr = localStorage.getItem("civic_pulse_user_complaints");
        const userComplaints = storedStr ? JSON.parse(storedStr) : [];
        setComplaints([...userComplaints, ...SAMPLE_COMPLAINTS]);
      } catch {
        setComplaints(SAMPLE_COMPLAINTS);
      }
    };
    loadComplaints();

    // Also re-check on window focus so dashboard refreshes if complaint was just submitted
    window.addEventListener("focus", loadComplaints);
    return () => window.removeEventListener("focus", loadComplaints);
  }, []);

  const filteredComplaints = activeTab === "all"
    ? complaints
    : complaints.filter(c => c.category === activeTab);

  // Compute live category counts from all complaints
  const categoryStats = Object.entries(CATEGORY_META).map(([id, meta]) => ({
    id,
    ...meta,
    count: complaints.filter(c => c.category === id).length
  }));

  const criticalCount = complaints.filter(c =>
    c.severity === "CRITICAL" || c.severity === "HIGH"
  ).length;

  return (
    <div style={{ maxWidth: 1150, margin: "0 auto", textAlign: "left" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "2.25rem", margin: 0 }}>Municipal Admin Dashboard</h1>
          <p style={{ marginTop: 4 }}>Real-time triage and field dispatch overview for citizen complaints.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12 }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>TOTAL COMPLAINTS</span>
            <strong style={{ fontSize: "1.4rem", color: "#f8fafc" }}>{complaints.length} Cases</strong>
          </div>
          <div className="glass-card" style={{ padding: "10px 18px", borderRadius: 12, borderColor: "rgba(239, 68, 68, 0.4)" }}>
            <span style={{ fontSize: "0.75rem", color: "#f87171", display: "block" }}>CRITICAL / HIGH RISK</span>
            <strong style={{ fontSize: "1.4rem", color: "#ef4444" }}>{criticalCount} Active</strong>
          </div>
        </div>
      </div>

      {/* 5 Issue Category Cards */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: 16, color: "#f8fafc" }}>Issue Breakdown by Category</h3>
        <div className="grid-5">
          {categoryStats.map((cat) => (
            <div
              key={cat.id}
              onClick={() => setActiveTab(activeTab === cat.id ? "all" : cat.id)}
              className="glass-card"
              style={{
                padding: 20,
                cursor: "pointer",
                border: activeTab === cat.id ? `2px solid ${cat.color}` : "1px solid #334155",
                backgroundColor: activeTab === cat.id ? "rgba(30, 41, 59, 0.95)" : "rgba(30, 41, 59, 0.6)",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: cat.color }}>{cat.count}</span>
              </div>
              <h4 style={{ fontSize: "0.95rem", color: "#f8fafc", margin: 0 }}>{cat.title}</h4>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {activeTab === cat.id ? "Filter Active ✓" : "Click to filter"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Complaints Table Section */}
      <div className="glass-card" style={{ padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0 }}>Recent Incident Logs</h3>
            <p style={{ fontSize: "0.85rem", marginTop: 2 }}>
              Showing {filteredComplaints.length} report{filteredComplaints.length !== 1 ? "s" : ""} sorted by submission time
            </p>
          </div>
          {activeTab !== "all" && (
            <button
              onClick={() => setActiveTab("all")}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
            >
              Clear Filter (Show All)
            </button>
          )}
        </div>

        {filteredComplaints.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <p>No complaints found for this category.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "0.85rem" }}>
                  <th style={{ padding: "12px 16px" }}>TRACKING ID</th>
                  <th style={{ padding: "12px 16px" }}>CITIZEN</th>
                  <th style={{ padding: "12px 16px" }}>CATEGORY</th>
                  <th style={{ padding: "12px 16px" }}>LOCATION</th>
                  <th style={{ padding: "12px 16px" }}>SEVERITY</th>
                  <th style={{ padding: "12px 16px" }}>STATUS</th>
                  <th style={{ padding: "12px 16px" }}>SUBMITTED</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #1e293b",
                      transition: "background 0.15s ease"
                    }}
                  >
                    <td style={{ padding: "16px", fontWeight: 700, color: "#3b82f6", fontSize: "0.9rem" }}>
                      {item.id}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{item.phone}</div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span className={`category-badge badge-${item.category}`}>
                        {item.icon} {item.category_label}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "0.88rem", color: "#cbd5e1" }}>
                      <div>{item.area}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {[item.city, item.district].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span
                        style={
                          item.severity === "PENDING"
                            ? {
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                background: "rgba(100, 116, 139, 0.2)",
                                color: "#94a3b8",
                                border: "1px solid rgba(100, 116, 139, 0.4)"
                              }
                            : {}
                        }
                        className={item.severity !== "PENDING" ? `severity-pill ${
                          item.severity === "CRITICAL" || item.severity === "HIGH"
                            ? "severity-high"
                            : item.severity === "MEDIUM"
                            ? "severity-medium"
                            : "severity-low"
                        }` : ""}
                      >
                        {item.severity === "PENDING" ? "⏳ Pending AI" : item.severity}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontWeight: 600, fontSize: "0.85rem", color: "#34d399" }}>
                      {item.status}
                    </td>
                    <td style={{ padding: "16px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {item.submitted_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}