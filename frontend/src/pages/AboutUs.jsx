import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
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

const FEATURES = [
  {
    icon: "📋",
    title: "One form, one case number",
    body: "Every report gets a category, a location and a case number — no more issues lost in email threads or phone calls that never get logged.",
  },
  {
    icon: "🤖",
    title: "Automatic categorization",
    body: "Selected reports are analyzed on submission and flagged by category and urgency, so nothing time-sensitive sits unread in a queue.",
  },
  {
    icon: "📍",
    title: "Every case is pinned",
    body: "Reports are tied to a real location on a map, so patterns — like a street that keeps flooding — are visible, not anecdotal.",
  },
  {
    icon: "📊",
    title: "Built for the response side",
    body: "Authorities work from a live dashboard of open cases sorted by category, location and status, instead of a shared spreadsheet.",
  },
];

const CATEGORIES = [
  {
    icon: "🌊",
    name: "Flood & Drainage",
    desc: "Blocked drains, standing water, flood risk",
    code: "CAT-01",
  },
  {
    icon: "🛣️",
    name: "Road Damage",
    desc: "Potholes, cracked surfaces, unsafe shoulders",
    code: "CAT-02",
  },
  {
    icon: "♻️",
    name: "Garbage & Waste",
    desc: "Missed collection, illegal dumping, overflow",
    code: "CAT-03",
  },
  {
    icon: "⚡",
    name: "Power Failure",
    desc: "Outages, exposed lines, electrical hazards",
    code: "CAT-04",
  },
  {
    icon: "💡",
    name: "Street Lighting",
    desc: "Broken, flickering or missing street lights",
    code: "CAT-05",
  },
];

export default function About() {
  const { t, lang } = useLang();

  return (
    <main className="about-page" lang={lang}>
      {/* =====================================================
          HERO
      ====================================================== */}
      <section className="about-hero">
        <div className="about-hero-glow" aria-hidden="true"></div>

        <div className="about-hero-content">
          <div className="about-logo-wrapper">
            <LogoIcon className="about-logo" />
          </div>

          <div className="about-eyebrow">{t("about_eyebrow")}</div>

          <h1>
            {t("about_hero_title_1")}
            <span>{t("about_hero_title_2")}</span>
          </h1>

          <p className="about-lede">
            {t("about_lede")}
          </p>

          <div className="about-hero-buttons">
            <Link to="/complaint" className="about-btn about-btn-primary">
              {t("about_cta_report")} <span aria-hidden="true">→</span>
            </Link>
            <Link to="/dashboard" className="about-btn about-btn-secondary">
              {t("about_cta_dashboard")}
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          INTRODUCTION
      ====================================================== */}
      <section className="about-intro">
        <div className="about-container">
          <div className="about-eyebrow">{t("about_eyebrow")}</div>

          <div className="about-intro-grid">
            <div>
              <h2>
                {t("about_intro_heading")} <span>{t("about_intro_heading_2")}</span>
              </h2>
            </div>

            <div className="about-intro-text">
              <p>
                {t("about_intro_p1")}
              </p>
              <p>
                {t("about_intro_p2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ====================================================== */}
      <section className="about-features">
        <div className="about-container">
          <div className="about-section-heading">
            <div className="about-eyebrow">{t("about_eyebrow")}</div>
            <h2>
              <span>{t("about_features_heading")}</span>
            </h2>
            <p>
              {t("about_features_desc")}
            </p>
          </div>

          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="feature-icon" aria-hidden="true">
                  {f.icon}
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          CIVIC CATEGORIES
      ====================================================== */}
      <section className="about-categories">
        <div className="about-container">
          <div className="categories-layout">
            <div className="categories-text">
              <div className="about-eyebrow">{t("about_eyebrow")}</div>
              <h2>
                <span>{t("about_categories_title")}</span>
              </h2>
              <p>
                {t("about_categories_desc")}
              </p>
              <Link to="/complaint" className="about-text-link">
                {t("about_cta_report")} →
              </Link>
            </div>

            <div className="category-list">
              {CATEGORIES.map((c) => (
                <div className="category-card" key={c.name}>
                  <span className="cat-icon" aria-hidden="true">
                    {c.icon}
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <span className="cat-desc">{c.desc}</span>
                  </div>
                  <span className="cat-code">{c.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          MISSION
      ====================================================== */}
      <section className="about-mission">
        <div className="mission-card">
          <div className="about-eyebrow">{t("about_eyebrow")}</div>
          <h2>
            <span>{t("about_mission_title")}</span>
          </h2>
          <p>
            {t("about_mission_p")}
          </p>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ====================================================== */}
      <section className="about-final-cta">
        <div className="cta-card">
          <div>
            <div className="about-eyebrow">{t("about_eyebrow")}</div>
            <h2>{t("about_final_title")}</h2>
            <p>
              {t("about_final_desc")}
            </p>
          </div>

          <Link to="/complaint" className="about-btn about-btn-primary">
            {t("about_cta_report")} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}