import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../context/LanguageContext";
import logoSvg from "../assets/logo.svg?raw";

function LogoIcon({ className }) {
  // Inline SVG so currentColor inherits the CSS variable
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

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar-root">
      <div className="navbar-inner">
        {/* Brand / Logo */}
        <Link to="/" className="navbar-brand">
          <LogoIcon className="navbar-logo" />
          <div>
            <div className="navbar-title">
              CivicPulse <span>AI</span>
            </div>
            <div className="navbar-subtitle">{t("nav_subtitle")}</div>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          <Link to="/" className={`navbar-link${isActive("/") ? " active" : ""}`}>
            {t("nav_home")}
          </Link>
          <Link to="/complaint" className={`navbar-link${isActive("/complaint") ? " active" : ""}`}>
            {t("nav_complaint")}
          </Link>
          <Link to="/dashboard" className={`navbar-link${isActive("/dashboard") ? " active" : ""}`}>
            {t("nav_dashboard")}
          </Link>
        </nav>

        {/* Controls: Language + Theme */}
        <div className="navbar-controls">
          {/* Language Switcher */}
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

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: "var(--border-color)", margin: "0 2px" }} />

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="ctrl-btn"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{ fontSize: "1rem", padding: "7px 12px" }}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
  );
}