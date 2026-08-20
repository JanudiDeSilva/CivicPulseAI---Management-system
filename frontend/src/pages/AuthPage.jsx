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

  // Redirect after successful login
  useEffect(() => {
    if (session) {
      navigate(
        session.role === "admin"
          ? "/dashboard"
          : "/my-portal",
        { replace: true }
      );
    }
  }, [session, navigate]);

  const handleSignIn = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      if (!loginForm.email || !loginForm.password) {
        throw new Error("Email and password are required.");
      }

      await loginWithPassword({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });

      // Redirect happens automatically when session updates
    } catch (err) {
      setError(
        err?.message ||
          "Unable to sign in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div
        className="glass-card auth-card"
        style={{
          maxWidth: 540,
        }}
      >
        {/* =========================
            ADMIN HEADER
        ========================== */}
        <div
          className="auth-header"
          style={{
            marginBottom: 24,
          }}
        >
          <div>
            <span className="eyebrow">
              CivicPulse AI
            </span>

            <h1>
              Admin Portal
              <br />
              Access
            </h1>

            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                marginTop: 6,
              }}
            >
              Authorized municipal administrator login only.
            </p>
          </div>
        </div>

        {/* =========================
            CITIZEN ACCESS
        ========================== */}
        <div
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.10)",
            border: "1px solid rgba(59, 130, 246, 0.30)",
            borderRadius: 14,
            padding: "18px",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "1rem",
              color: "#93c5fd",
            }}
          >
            Are you a Citizen?
          </h3>

          <p
            style={{
              fontSize: "0.82rem",
              color: "#94a3b8",
              margin: "0 0 14px",
              lineHeight: 1.45,
            }}
          >
            Submit reports directly or track your complaint as a
            guest. No registration is required.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {/* Submit Complaint */}
            <Link
              to="/complaint"
              className="btn btn-primary"
              style={{
                width: "100%",
                justifyContent: "center",
                textAlign: "center",
                textDecoration: "none",
                padding: "10px 12px",
              }}
            >
              Submit Complaint
            </Link>

            {/* Track Status */}
            <Link
              to="/my-portal"
              className="btn btn-secondary"
              style={{
                width: "100%",
                justifyContent: "center",
                textAlign: "center",
                textDecoration: "none",
                padding: "10px 12px",
              }}
            >
              Track Status
            </Link>
          </div>
        </div>

        {/* =========================
            ERROR MESSAGE
        ========================== */}
        {error && (
          <div
            className="auth-error"
            style={{
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* =========================
            ADMIN LOGIN FORM
        ========================== */}
        <form
          onSubmit={handleSignIn}
          className="auth-form"
        >
          {/* Admin Email */}
          <div className="form-group">
            <label className="form-label">
              Admin Email Address
            </label>

            <input
              className="form-input"
              type="email"
              placeholder="e.g. admin@civicpulse.gov"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">
              Password
            </label>

            <input
              className="form-input"
              type="password"
              placeholder="Enter admin password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Login Button */}
          <button
            className="btn btn-primary auth-cta"
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 12,
            }}
          >
            {loading
              ? "Signing in..."
              : "Sign In to Admin Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}