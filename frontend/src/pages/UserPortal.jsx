import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { syncReports, deleteComplaint, trackGuestComplaint, fetchReportsByPhone } from "../services/api";

const CATEGORY_META = {
  flood:         { title: "Drainage & Waterlogging", icon: "🌊" },
  road_damage:   { title: "Road Damages",            icon: "🚗" },
  garbage:       { title: "Garbage & Waste",         icon: "🗑️" },
  power_failure: { title: "Power Outages",           icon: "⚡" },
  street_light:  { title: "Street Lights",           icon: "💡" },
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
    admin_reply: remote.admin_reply ?? local.admin_reply ?? null,
    severity: remote.severity || local.severity,
    resolved_at: remote.resolved_at || local.resolved_at || null,
    resolution_time_display: remote.resolution_time_display || local.resolution_time_display || null,
    image_url: remote.image_url || local.image_url || local.photo_url || null,
    photo_url: remote.photo_url || remote.image_url || local.photo_url || local.image_url || null,
    ml_analysis: remote.ml_analysis || local.ml_analysis || null,
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
  const { session, requestMobileOtp, loginWithMobileOtp, logout } = useAuth();
  const [searchParams] = useSearchParams();

  // URL query pre-fills
  const initialId = searchParams.get("id") || "";
  const initialPhone = searchParams.get("phone") || "";

  // Guest Tracking State
  const [trackIdInput, setTrackIdInput] = useState(initialId);
  const [trackPhoneInput, setTrackPhoneInput] = useState(initialPhone);
  const [guestReport, setGuestReport] = useState(null);
  const [guestTrackingError, setGuestTrackingError] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  // OTP Login State
  const [otpPhone, setOtpPhone] = useState(initialPhone);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedDemoOtp, setGeneratedDemoOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Active Complaints List State
  const [complaints, setComplaints] = useState(loadComplaints);
  const [lastSynced, setLastSynced] = useState(null);

  // Auto-run guest lookup if URL params are present
  useEffect(() => {
    if (initialId && initialPhone) {
      handleTrackGuest(initialId, initialPhone);
    }
  }, [initialId, initialPhone]);

  // Guest Single-Complaint Tracking
  const handleTrackGuest = async (tId = trackIdInput, tPhone = trackPhoneInput) => {
    if (!tId?.trim() || !tPhone?.trim()) {
      setGuestTrackingError("Please enter both Complaint ID and Mobile Number.");
      return;
    }

    setGuestLoading(true);
    setGuestTrackingError("");

    try {
      // 1. Try real server lookup
      const res = await trackGuestComplaint(tId.trim(), tPhone.trim());
      if (res.data?.report) {
        setGuestReport(res.data.report);
        setGuestLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Server guest lookup error, checking local store:", err);
    }

    // 2. Fallback to local storage
    const stored = loadComplaints();
    const cleanPhone = String(tPhone).replace(/\D/g, "");
    const found = stored.find(c => {
      const idMatch = c.id === tId.trim() || c.tracking_id === tId.trim();
      const repPhone = String(c.phone || "").replace(/\D/g, "");
      const phoneMatch = !cleanPhone || !repPhone || repPhone.endsWith(cleanPhone) || cleanPhone.endsWith(repPhone) || cleanPhone.slice(-7) === repPhone.slice(-7);
      return idMatch && phoneMatch;
    });

    if (found) {
      setGuestReport(found);
    } else {
      setGuestTrackingError("No complaint found matching this Complaint ID and Mobile Number. Please check your details.");
    }
    setGuestLoading(false);
  };

  // OTP Login Handlers
  const handleSendOtp = () => {
    if (!otpPhone?.trim()) {
      setOtpError("Please enter your mobile number.");
      return;
    }
    try {
      setOtpLoading(true);
      setOtpError("");
      const payload = requestMobileOtp(otpPhone);
      setGeneratedDemoOtp(payload.otp);
      setOtpSent(true);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (!otpCode?.trim()) {
      setOtpError("Please enter the 6-digit verification code.");
      return;
    }
    try {
      setOtpLoading(true);
      setOtpError("");
      loginWithMobileOtp(otpPhone, otpCode);
      setOtpSent(false);
      setOtpCode("");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Sync logged in user complaints
  const refreshFromServer = useCallback(async () => {
    const stored = loadComplaints();

    // If logged in via phone, fetch server reports for that phone
    if (session?.phone) {
      try {
        const phoneRes = await fetchReportsByPhone(session.phone);
        const serverReports = phoneRes.data?.reports || [];
        if (serverReports.length > 0) {
          const merged = [...stored];
          serverReports.forEach(srv => {
            const idx = merged.findIndex(l => matchesReport(l, srv));
            if (idx >= 0) {
              merged[idx] = mergeServerReport(merged[idx], srv);
            } else {
              merged.push(srv);
            }
          });
          setComplaints(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          setLastSynced(new Date());
          return;
        }
      } catch (err) {
        console.warn("Failed phone sync:", err);
      }
    }

    if (stored.length === 0) return;
    const identifiers = stored.flatMap(c => [c.id, c.tracking_id]).filter(Boolean);
    if (identifiers.length === 0) return;

    try {
      const { data } = await syncReports([...new Set(identifiers)]);
      const remoteReports = data.reports || [];
      if (remoteReports.length === 0) return;

      const updated = stored.map(local => {
        const remote = remoteReports.find(r => matchesReport(local, r));
        return remote ? mergeServerReport(local, remote) : local;
      });

      setComplaints(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setLastSynced(new Date());
    } catch (err) {
      console.error("Failed to sync complaints:", err);
    }
  }, [session]);

  useEffect(() => {
    refreshFromServer();
    const interval = setInterval(refreshFromServer, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshFromServer]);

  // Filter complaints for current user
  const userComplaints = useMemo(() => {
    if (!session) return [];
    const cleanUserPhone = session.phone ? String(session.phone).replace(/\D/g, "") : "";
    return complaints.filter(item => {
      if (session.email && (item.email === session.email || item.created_by_email === session.email)) return true;
      if (cleanUserPhone) {
        const cleanItemPhone = String(item.phone || "").replace(/\D/g, "");
        if (cleanItemPhone && (cleanItemPhone.endsWith(cleanUserPhone) || cleanUserPhone.endsWith(cleanItemPhone) || cleanUserPhone.slice(-7) === cleanItemPhone.slice(-7))) {
          return true;
        }
      }
      return false;
    });
  }, [complaints, session]);

  const handleDeleteComplaint = async (ticketId) => {
    const idToDelete = String(ticketId);
    if (!window.confirm("Remove this complaint from your view?")) return;

    try {
      await deleteComplaint(idToDelete);
    } catch (_) {}

    const updated = loadComplaints().filter(item => item.id !== idToDelete && item.tracking_id !== idToDelete);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setComplaints(updated);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "left" }}>

      {/* ── HEADER ── */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: "2rem", margin: "0 0 6px" }}>Citizen Complaint &amp; Tracking Portal</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {session ? (
              <>
                Logged in as <strong>{session.name || session.phone}</strong> · {session.phone || session.email}
                {lastSynced && (
                  <span style={{ marginLeft: 10, fontSize: "0.8rem", color: "#64748b" }}>
                    · Live sync: {lastSynced.toLocaleTimeString()}
                  </span>
                )}
              </>
            ) : (
              "Track your complaint status instantly using your Complaint ID &amp; Mobile Number, or sign in via mobile OTP."
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/complaint" className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "8px 16px" }}>
            + Lodge New Complaint
          </Link>
          {session && (
            <button onClick={logout} className="btn btn-secondary" style={{ fontSize: "0.85rem", padding: "8px 14px" }}>
              Logout
            </button>
          )}
        </div>
      </div>

      {/* ── GUEST TRACKING FORM (Accessible without login) ── */}
      <div className="glass-card" style={{ padding: 22, marginBottom: 24, border: "1px solid rgba(59, 130, 246, 0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Track a Complaint (No Account Required)</h2>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 16px 0" }}>
          Enter the Complaint ID (from your confirmation screen or SMS) along with your mobile number to check real-time triage, dispatch, and municipal replies.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.78rem" }}>Complaint Reference ID</label>
            <input
              type="text"
              placeholder="e.g. CP-123456"
              value={trackIdInput}
              onChange={(e) => setTrackIdInput(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.88rem" }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.78rem" }}>Registered Mobile Number</label>
            <input
              type="tel"
              placeholder="e.g. 077 123 4567"
              value={trackPhoneInput}
              onChange={(e) => setTrackPhoneInput(e.target.value)}
              className="form-input"
              style={{ fontSize: "0.88rem" }}
            />
          </div>

          <button
            type="button"
            onClick={() => handleTrackGuest()}
            disabled={guestLoading || !trackIdInput.trim() || !trackPhoneInput.trim()}
            className="btn btn-primary"
            style={{ padding: "10px 20px", fontSize: "0.88rem", height: 42, justifyContent: "center" }}
          >
            {guestLoading ? "Searching..." : "Track Status →"}
          </button>
        </div>

        {guestTrackingError && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.85rem" }}>
            ⚠️ {guestTrackingError}
          </div>
        )}

        {/* Guest Search Result Card */}
        {guestReport && (
          <div style={{ marginTop: 20, borderRadius: 12, border: "1px solid #3b82f6", background: "rgba(15, 23, 42, 0.8)", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14, borderBottom: "1px solid #334155", paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Complaint Status Check
                </span>
                <h3 style={{ margin: "2px 0 0", color: "#60a5fa", fontSize: "1.3rem" }}>
                  {guestReport.tracking_id || guestReport.id}
                </h3>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700,
                  background: guestReport.status === "Resolved" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                  color: guestReport.status === "Resolved" ? "#34d399" : "#fbbf24",
                  border: `1px solid ${guestReport.status === "Resolved" ? "#10b981" : "#f59e0b"}`
                }}>
                  {guestReport.status || "Registered"}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14, fontSize: "0.83rem" }}>
              <div><strong style={{ color: "#94a3b8" }}>Category:</strong> <span style={{ color: "#f8fafc" }}>{guestReport.category_label || guestReport.category}</span></div>
              <div><strong style={{ color: "#94a3b8" }}>Location:</strong> <span style={{ color: "#f8fafc" }}>{[guestReport.area, guestReport.city, guestReport.district].filter(Boolean).join(", ")}</span></div>
              <div><strong style={{ color: "#94a3b8" }}>AI Severity:</strong> <span style={{ color: guestReport.severity === "CRITICAL" ? "#ef4444" : "#eab308", fontWeight: 700 }}>{guestReport.severity || "PENDING"}</span></div>
              <div><strong style={{ color: "#94a3b8" }}>Registered:</strong> <span style={{ color: "#64748b" }}>{guestReport.submitted_at || "Recent"}</span></div>
              {guestReport.resolution_time_display && (
                <div><strong style={{ color: "#34d399" }}>Resolved in:</strong> <span style={{ color: "#34d399", fontWeight: 700 }}>{guestReport.resolution_time_display}</span></div>
              )}
            </div>

            <div style={{ fontSize: "0.85rem", color: "#e2e8f0", background: "rgba(30,41,59,0.5)", padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Description:</div>
              {guestReport.description || guestReport.raw_text || "No description provided."}
            </div>

            {/* Official Municipal Reply */}
            {guestReport.admin_reply ? (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(56, 189, 248, 0.4)", background: "rgba(15,23,42,0.9)" }}>
                <div style={{ background: "linear-gradient(90deg, rgba(26,86,219,0.6) 0%, rgba(56,189,248,0.3) 100%)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🏛️</span>
                  <strong style={{ fontSize: "0.8rem", color: "#bae6fd", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Official Municipal Response
                  </strong>
                </div>
                <div style={{ padding: "12px 14px", color: "#e0f2fe", fontSize: "0.85rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {guestReport.admin_reply}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontStyle: "italic" }}>
                ℹ️ Field officers are currently reviewing this incident. Any updates or replies from municipal staff will appear here.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── IF NOT LOGGED IN: OPTIONAL MOBILE OTP SIGN-IN CARD ── */}
      {!session && (
        <div className="glass-card" style={{ padding: 22, marginBottom: 24, background: "linear-gradient(135deg, rgba(30,58,138,0.25) 0%, rgba(15,23,42,0.6) 100%)", border: "1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#93c5fd" }}>
              Optional: Track All Your Past Complaints in One Place
            </h2>
          </div>
          <p style={{ fontSize: "0.83rem", color: "#94a3b8", margin: "0 0 16px 0" }}>
            Want to see all complaints submitted from your mobile number? Enter your number to receive a quick SMS verification code. No email or password needed.
          </p>

          {!otpSent ? (
            <div style={{ display: "flex", gap: 10, maxWidth: 460 }}>
              <input
                type="tel"
                placeholder="Enter Mobile Number (e.g. 0771234567)"
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
                className="form-input"
                style={{ fontSize: "0.88rem" }}
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpLoading || !otpPhone.trim()}
                className="btn btn-secondary"
                style={{ flexShrink: 0, padding: "8px 16px", fontSize: "0.85rem" }}
              >
                {otpLoading ? "Sending OTP..." : "Send SMS OTP"}
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 460 }}>
              <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginBottom: 6 }}>
                Enter the 6-digit code sent to {otpPhone} (Demo OTP: <strong>{generatedDemoOtp || "123456"}</strong>):
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="form-input"
                  style={{ fontSize: "0.9rem" }}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || !otpCode.trim()}
                  className="btn btn-primary"
                  style={{ flexShrink: 0, padding: "8px 18px", fontSize: "0.85rem" }}
                >
                  {otpLoading ? "Verifying..." : "Verify & Unlock"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(""); }}
                style={{ fontSize: "0.74rem", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", marginTop: 6, textDecoration: "underline" }}
              >
                Change mobile number
              </button>
            </div>
          )}
          {otpError && <div style={{ fontSize: "0.78rem", color: "#f87171", marginTop: 8 }}>{otpError}</div>}
        </div>
      )}

      {/* ── LOGGED-IN CITIZEN COMPLAINT LIST ── */}
      {session && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: "1.3rem", margin: 0 }}>
              My Complaints ({userComplaints.length})
            </h2>
            <button onClick={refreshFromServer} className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "6px 12px" }}>
              ↻ Sync Status
            </button>
          </div>

          {userComplaints.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: "0.95rem" }}>No complaints recorded under this mobile number yet.</p>
              <Link to="/complaint" className="btn btn-primary" style={{ marginTop: 8, fontSize: "0.85rem" }}>
                + Submit a Complaint
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {userComplaints.map((item) => (
                <div key={item.id} className="ticket-card" style={{ border: "1px solid #334155", borderRadius: 12, padding: 18, background: "rgba(15,23,42,0.7)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#3b82f6", fontSize: "1.05rem" }}>
                        {item.tracking_id || item.id}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#cbd5e1", marginTop: 2 }}>
                        {CATEGORY_META[item.category]?.icon || "📋"} {CATEGORY_META[item.category]?.title || item.category}
                      </div>
                    </div>
                    <span style={{
                      padding: "4px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700,
                      background: item.status === "Resolved" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                      color: item.status === "Resolved" ? "#34d399" : "#fbbf24",
                      border: `1px solid ${item.status === "Resolved" ? "#10b981" : "#f59e0b"}`
                    }}>
                      {item.status || "Registered"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, fontSize: "0.8rem", color: "#94a3b8", marginBottom: 12 }}>
                    <div>Location: <strong style={{ color: "#cbd5e1" }}>{[item.area, item.city, item.district].filter(Boolean).join(", ") || "—"}</strong></div>
                    <div>Severity: <strong style={{ color: item.severity === "CRITICAL" ? "#ef4444" : "#cbd5e1" }}>{item.severity || "PENDING"}</strong></div>
                    <div>Submitted: <strong style={{ color: "#cbd5e1" }}>{item.submitted_at || "—"}</strong></div>
                    {item.resolution_time_display && (
                      <div>Resolution: <strong style={{ color: "#34d399" }}>{item.resolution_time_display}</strong></div>
                    )}
                  </div>

                  <div style={{ fontSize: "0.83rem", color: "#e2e8f0", background: "rgba(30,41,59,0.4)", padding: "10px 12px", borderRadius: 8, marginBottom: 12 }}>
                    {item.description || item.raw_text || "No description provided."}
                  </div>

                  {/* Official Admin Reply */}
                  {item.admin_reply && (
                    <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(56, 189, 248, 0.4)", background: "rgba(15,23,42,0.85)" }}>
                      <div style={{ background: "rgba(26,86,219,0.3)", padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, color: "#bae6fd", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>🏛️</span> Official Municipal Response
                      </div>
                      <div style={{ padding: "10px 12px", color: "#e0f2fe", fontSize: "0.82rem", whiteSpace: "pre-wrap" }}>
                        {item.admin_reply}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteComplaint(item.id || item.tracking_id)}
                      style={{
                        padding: "5px 10px", borderRadius: 6,
                        border: "1px solid rgba(248, 113, 113, 0.3)",
                        background: "rgba(127, 29, 29, 0.15)",
                        color: "#fca5a5", fontSize: "0.72rem", cursor: "pointer"
                      }}
                    >
                      Remove from list
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
