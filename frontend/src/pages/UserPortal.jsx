import { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { syncReports } from "../services/api";

const CATEGORY_META = {
  flood:         { title: "Flood & Drainage",  icon: "🌊" },
  road_damage:   { title: "Road Damages",      icon: "🚗" },
  garbage:       { title: "Garbage & Waste",   icon: "🗑️" },
  power_failure: { title: "Power Outages",     icon: "⚡" },
  street_light:  { title: "Street Lights",     icon: "💡" },
};

const STORAGE_KEY = "civic_pulse_user_complaints";
const POLL_INTERVAL_MS = 10000;

const loadComplaints = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

function mergeServerReport(local, remote) {
  return {
    ...local,
    id: remote.id,
    tracking_id: remote.tracking_id || local.tracking_id,
    status: remote.status || local.status,
    admin_reply: remote.admin_reply ?? null,
    severity: remote.severity || local.severity,
  };
}

function matchesReport(local, remote) {
  return (
    local.id === remote.id ||
    local.tracking_id === remote.tracking_id ||
    local.id === remote.tracking_id ||
    local.tracking_id === remote.id
  );
}

export default function UserPortal() {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState(loadComplaints);
  const [editingId, setEditingId] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [draft, setDraft] = useState({
    district: "",
    city: "",
    area: "",
    description: "",
    phone: "",
  });

  const refreshFromServer = useCallback(async () => {
    const stored = loadComplaints();
    if (stored.length === 0) return;

    const identifiers = stored
      .flatMap((c) => [c.id, c.tracking_id])
      .filter(Boolean);

    if (identifiers.length === 0) return;

    try {
      const { data } = await syncReports([...new Set(identifiers)]);
      const remoteReports = data.reports || [];
      if (remoteReports.length === 0) return;

      const updated = stored.map((local) => {
        const remote = remoteReports.find((r) => matchesReport(local, r));
        return remote ? mergeServerReport(local, remote) : local;
      });

      setComplaints(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setLastSynced(new Date());
    } catch (err) {
      console.error("Failed to sync complaints:", err);
    }
  }, []);

  useEffect(() => {
    refreshFromServer();
    const interval = setInterval(refreshFromServer, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshFromServer]);

  const mine = useMemo(
    () => complaints.filter((item) => item.email === session?.email || item.created_by_email === session?.email),
    [complaints, session]
  );

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      district: item.district || "",
      city: item.city || "",
      area: item.area || "",
      description: item.description || "",
      phone: item.phone || "",
    });
  };

  const saveEdit = (ticketId) => {
    const updated = loadComplaints().map((item) => {
      if (item.id !== ticketId) return item;
      return {
        ...item,
        district: draft.district,
        city: draft.city,
        area: draft.area,
        description: draft.description,
        phone: draft.phone,
      };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setComplaints(updated);
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
        <h1 style={{ marginBottom: 6 }}>My Complaint Portal</h1>
        <p style={{ margin: 0 }}>
          Signed in as <strong>{session?.name}</strong> · {session?.email}
          {lastSynced && (
            <span style={{ marginLeft: 10, fontSize: "0.82rem", color: "#64748b" }}>
              · Live sync: {lastSynced.toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      <div className="grid-2">
        <section className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 18 }}>My Tickets</h2>
          {mine.length === 0 ? (
            <p>No complaints found for your profile yet.</p>
          ) : (
            mine.map((item) => (
              <div key={item.id} className="ticket-card" style={{ marginBottom: 14 }}>
                <div className="ticket-header">
                  <div>
                    <div className="ticket-id">{item.tracking_id || item.id}</div>
                    <div className="ticket-category">
                      {CATEGORY_META[item.category]?.icon || "📋"} {CATEGORY_META[item.category]?.title || item.category}
                    </div>
                  </div>
                  <span className="status-pill">{item.status || "Registered"}</span>
                </div>

                <div className="meta-grid">
                  <div><strong>NIC:</strong> {item.nic || session?.nic || "—"}</div>
                  <div><strong>Severity:</strong> {item.severity || "PENDING"}</div>
                  <div><strong>Area:</strong> {item.area || "—"}</div>
                  <div><strong>Submitted:</strong> {item.submitted_at || "—"}</div>
                </div>

                <div className="ticket-desc">{item.description || "No complaint details saved."}</div>

                {/* ── Official Admin Reply ── */}
                {item.admin_reply ? (
                  <div style={{
                    marginTop: 14,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    boxShadow: "0 0 18px rgba(56,189,248,0.08)",
                  }}>
                    {/* Header bar */}
                    <div style={{
                      background: "linear-gradient(90deg, rgba(26,86,219,0.55) 0%, rgba(56,189,248,0.25) 100%)",
                      padding: "8px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <span style={{ fontSize: "1rem" }}>🏛️</span>
                      <span style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#bae6fd",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}>
                        Official Municipal Response
                      </span>
                      <span style={{
                        marginLeft: "auto",
                        fontSize: "0.7rem",
                        background: "rgba(56,189,248,0.25)",
                        color: "#7dd3fc",
                        border: "1px solid rgba(56,189,248,0.3)",
                        borderRadius: 999,
                        padding: "2px 10px",
                        fontWeight: 600,
                      }}>
                        ✓ Replied
                      </span>
                    </div>
                    {/* Reply body */}
                    <div style={{
                      background: "rgba(15, 30, 60, 0.7)",
                      padding: "12px 16px",
                      fontSize: "0.9rem",
                      color: "#e0f2fe",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {item.admin_reply}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "rgba(100,116,139,0.06)",
                    border: "1px dashed rgba(100,116,139,0.25)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: "1rem", opacity: 0.6 }}>📨</span>
                    <span style={{ fontSize: "0.82rem", color: "#64748b", fontStyle: "italic" }}>
                      Awaiting official reply from the municipal office…
                    </span>
                  </div>
                )}

                <button className="btn btn-secondary" type="button" onClick={() => startEdit(item)}>
                  Edit Complaint
                </button>
              </div>
            ))
          )}
        </section>

        <section className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 18 }}>Update Your Complaint</h2>
          {editingId ? (
            <div className="auth-form">
              <label className="form-group">
                <span className="form-label">District</span>
                <input className="form-input" value={draft.district} onChange={(e) => setDraft((prev) => ({ ...prev, district: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">City</span>
                <input className="form-input" value={draft.city} onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">Area</span>
                <input className="form-input" value={draft.area} onChange={(e) => setDraft((prev) => ({ ...prev, area: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">Phone</span>
                <input className="form-input" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">Complaint Details</span>
                <textarea className="form-textarea" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
              </label>
              <button className="btn btn-primary" type="button" onClick={() => saveEdit(editingId)}>
                Save Changes
              </button>
            </div>
          ) : (
            <p>Select a complaint card to edit the complaint information and location details.</p>
          )}
        </section>
      </div>
    </div>
  );
}
