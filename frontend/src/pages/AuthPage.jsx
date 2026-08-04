import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initialSignup = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  nic: "",
  password: "",
  confirmPassword: "",
};

const initialLogin = {
  email: "",
  password: "",
  role: "user",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { signupUser, requestOtp, loginWithPassword, session } = useAuth();
  const [mode, setMode] = useState("signin");
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [otpMessage, setOtpMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate(session.role === "admin" ? "/dashboard" : "/my-portal", { replace: true });
    }
  }, [session, navigate]);

  const handleSendOtp = (email) => {
    try {
      const payload = requestOtp(email);
      setOtpMessage(`Demo email verification code sent to ${payload.email}. Use code: ${payload.otp}`);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      signupUser(signupForm);
      setMode("signin");
      setOtpMessage("Registration complete. Please sign in with your new email and password.");
      setSignupForm(initialSignup);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      if (!loginForm.email || !loginForm.password) {
        throw new Error("Email and password are required.");
      }

      loginWithPassword(loginForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div>
            <span className="eyebrow">CivicPulse AI</span>
            <h1>Common Portal Access</h1>
          </div>
          <div className="role-toggle">
            <button
              type="button"
              className={mode === "signin" ? "tab active" : "tab"}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === "signup" ? "tab active" : "tab"}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {otpMessage && <div className="auth-success">{otpMessage}</div>}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="auth-form">
            <label className="form-group">
              <span className="form-label">Portal Role</span>
              <select
                className="form-select"
                value={loginForm.role}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">User Portal</option>
                <option value="admin">Admin Portal</option>
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">Email Address</span>
              <input
                className="form-input"
                type="email"
                placeholder="name@example.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Password</span>
              <input
                className="form-input"
                type="password"
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSendOtp(loginForm.email || "admin@civicpulse.local")}
            >
              Send OTP Demo
            </button>

            <button className="btn btn-primary auth-cta" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In to Portal"}
            </button>

            <div className="hint-box">
              <strong>Temporary Admin Access:</strong> admin@civicpulse.local / Admin@123
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="auth-form">
            <div className="grid-2">
              <label className="form-group">
                <span className="form-label">First Name</span>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter first name"
                  value={signupForm.firstName}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Last Name</span>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter last name"
                  value={signupForm.lastName}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </label>
            </div>

            <label className="form-group">
              <span className="form-label">Email Address</span>
              <input
                className="form-input"
                type="email"
                placeholder="name@example.com"
                value={signupForm.email}
                onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>

            <div className="grid-2">
              <label className="form-group">
                <span className="form-label">Phone Number</span>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter phone number"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="form-group">
                <span className="form-label">NIC Number</span>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter NIC"
                  value={signupForm.nic}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, nic: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid-2">
              <label className="form-group">
                <span className="form-label">Password</span>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Create password"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Confirm Password</span>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Confirm password"
                  value={signupForm.confirmPassword}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </label>
            </div>

            <button className="btn btn-primary auth-cta" type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>

            <div className="hint-box">
              <strong>Note:</strong> Admin signup is temporarily disabled. Use the seeded admin account for portal testing.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
