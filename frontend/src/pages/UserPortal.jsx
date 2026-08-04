import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const CATEGORY_META = {
  flood:         { title: "Flood & Drainage",  icon: "🌊" },
  road_damage:   { title: "Road Damages",      icon: "🚗" },
  garbage:       { title: "Garbage & Waste",   icon: "🗑️" },
  power_failure: { title: "Power Outages",     icon: "⚡" },
  street_light:  { title: "Street Lights",     icon: "💡" },
};

const loadComplaints = () => {
  try {
    return JSON.parse(localStorage.getItem("civic_pulse_user_complaints") || "[]");
  } catch {
    return [];
  }
};

export default function UserPortal() {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState(loadComplaints);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    district: "",
    city: "",
    area: "",
    description: "",
    phone: "",
  });

  // Pull fresh data from backend to get admin_reply from DB
  useEffect(() => {
    const stored = loadComplaints();
    if (stored.length === 0) return;
    const ids = stored.map((c) => c.id).filter(Boolean);
    Promise.allSettled(ids.map((id) => api.get(`/reports/${id}`)))
      .then((results) => {
        const updated = stored.map((c) => {
          const match = results.find((r) => r.status === "fulfilled" && r.value.data.id === c.id);
          if (match) return { ...c, admin_reply: match.value.data.admin_reply || null, status: match.value.data.status || c.status };
          return c;
        });
        setComplaints(updated);
        localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
      });
  }, []);

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

    localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
    setComplaints(updated);
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
        <h1 style={{ marginBottom: 6 }}>My Complaint Portal</h1>
        <p style={{ margin: 0 }}>Signed in as <strong>{session?.name}</strong> · {session?.email}</p>
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

                {item.admin_reply && (
                  <div className="reply-box" style={{ marginTop: 10, padding: "10px 14px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.75rem", color: "#93c5fd", fontWeight: 700, marginBottom: 4 }}>📨 Official Admin Reply:</div>
                    <div style={{ fontSize: "0.88rem", color: "#e2e8f0" }}>{item.admin_reply}</div>
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
