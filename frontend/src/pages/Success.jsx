import { Link } from "react-router-dom";

export default function Success() {
  return (
    <div style={{ maxWidth: 640, margin: "60px auto", textAlign: "center" }}>
      <div className="glass-card" style={{ padding: 48 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            margin: "0 auto 24px"
          }}
        >
          ✅
        </div>

        <h2 style={{ fontSize: "2rem", marginBottom: 12 }}>Complaint Registered!</h2>
        
        <p style={{ fontSize: "1.02rem", color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
          Your complaint has been logged and triaged with instant AI classification.
          Field officers from the relevant municipal department have been notified.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <Link to="/my-portal" className="btn btn-primary" style={{ padding: "12px 24px" }}>
            🔍 Track Complaint Status
          </Link>
          <Link to="/complaint" className="btn btn-secondary" style={{ padding: "12px 24px" }}>
            + Lodge Another Complaint
          </Link>
          <Link to="/" className="btn btn-secondary" style={{ padding: "12px 20px" }}>
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}