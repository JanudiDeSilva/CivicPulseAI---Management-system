import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initialLogin = {
  email: "",
  password: "",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { loginWithPassword, session } = useAuth();
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate(session.role === "admin" ? "/dashboard" : "/my-portal", { replace: true });
    }
  }, [session, navigate]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (!loginForm.email || !loginForm.password) {
        throw new Error("Admin email and password are required.");
      }

      // Hardcoded Admin login credentials verification
      if (
        loginForm.email.trim().toLowerCase() !== "onethrajanu2003@gmail.com" ||
        loginForm.password !== "janudi"
      ) {
        throw new Error("Invalid admin credentials. Please use the authorized email and password.");
      }

      // Pass it through AuthContext loginWithPassword to set session
      loginWithPassword({
        email: loginForm.email.trim(),
        password: loginForm.password,
        role: "admin",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="glass-card auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-header" style={{ marginBottom: 20 }}>
          <div>
            <span className="eyebrow">CivicPulse AI</span>
            <h1>Admin Portal Access</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>
              Authorized municipal administrator login only.
            </p>
          </div>
        </div>

        {/* Guest access notice */}
        <div style={{
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}>
          <div>
            <strong style={{ fontSize: "0.82rem", color: "#93c5fd" }}>Are you a Citizen?</strong>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "2px 0 0 0", lineHeight: 1.4 }}>
              Submit reports directly or track live status as a guest. No registration is required.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/complaint" className="btn btn-primary" style={{ fontSize: "0.75rem", padding: "6px 12px", flex: 1, justifyContent: "center" }}>
              Lodge Complaint
            </Link>
            <Link to="/my-portal" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "6px 12px", flex: 1, justifyContent: "center" }}>
              Track Status
            </Link>
          </div>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSignIn} className="auth-form">
          <div className="form-group">
            <span className="form-label">Admin Email Address</span>
            <input
              className="form-input"
              type="email"
              placeholder="e.g. admin@civicpulse.gov"
              value={loginForm.email}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <span className="form-label">Password</span>
            <input
              className="form-input"
              type="password"
              placeholder="Enter admin password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>

          <button className="btn btn-primary auth-cta" type="submit" disabled={loading} style={{ width: "100%", marginTop: 12 }}>
            {loading ? "Verifying..." : "Sign In to Admin Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
