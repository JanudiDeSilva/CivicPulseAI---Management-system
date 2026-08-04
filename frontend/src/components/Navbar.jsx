import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import logoSvg from "../assets/logo.svg?raw";

function LogoIcon({ className }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
      aria-label="CivicPulse AI Logo"
    />
  );
}

export default function Navbar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { lang, switchLang, t } = useLang();
  const { session, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar-root">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <LogoIcon className="navbar-logo" />
          <div>
            <div className="navbar-title">
              CivicPulse <span>AI</span>
            </div>
            <div className="navbar-subtitle">{t("nav_subtitle")}</div>
          </div>
        </Link>

        <nav className="navbar-nav">
          {session?.role === "admin" ? (
            <Link to="/dashboard" className={`navbar-link${isActive("/dashboard") ? " active" : ""}`}>
              {t("nav_dashboard")}
            </Link>
          ) : (
            <>
              <Link to="/" className={`navbar-link${isActive("/") ? " active" : ""}`}>
                {t("nav_home")}
              </Link>
              <Link to="/complaint" className={`navbar-link${isActive("/complaint") ? " active" : ""}`}>
                {t("nav_complaint")}
              </Link>
              {session?.role === "user" && (
                <Link to="/my-portal" className={`navbar-link${isActive("/my-portal") ? " active" : ""}`}>
                  My Portal
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="navbar-controls">
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              id="lang-en-btn"
              onClick={() => switchLang("en")}
              className={`ctrl-btn${lang === "en" ? " active" : ""}`}
              title="Switch to English"
            >
              EN
            </button>
            <button
              id="lang-si-btn"
              onClick={() => switchLang("si")}
              className={`ctrl-btn${lang === "si" ? " active" : ""}`}
              title="සිංහලට මාරු කරන්න"
            >
              සි
            </button>
          </div>

          <div style={{ width: 1, height: 22, background: "var(--border-color)", margin: "0 2px" }} />

          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="ctrl-btn"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{ fontSize: "1rem", padding: "7px 12px" }}
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          {session ? (
            <>
              <span className="auth-status-chip">{session.role === "admin" ? "Admin" : "User"}</span>
              <button className="btn btn-secondary" type="button" onClick={logout} style={{ padding: "8px 12px" }}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{ padding: "8px 14px" }}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}