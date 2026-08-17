import { Link } from "react-router-dom";
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
  return (
    <main className="about-page">
      {/* =====================================================
          HERO
      ====================================================== */}
      <section className="about-hero">
        <div className="about-hero-glow" aria-hidden="true"></div>

        <div className="about-hero-content">
          <div className="about-logo-wrapper">
            <LogoIcon className="about-logo" />
          </div>

          <div className="about-eyebrow">Civic Intelligence Platform</div>

          <h1>
            See the problem.
            <span>Get it to the right desk.</span>
          </h1>

          <p className="about-lede">
            CivicPulse AI turns a photo and a pin on the map into a
            structured case file — categorized, located and routed to the
            department that can actually act on it.
          </p>

          <div className="about-hero-buttons">
            <Link to="/complaint" className="about-btn about-btn-primary">
              Report an issue <span aria-hidden="true">→</span>
            </Link>
            <Link to="/dashboard" className="about-btn about-btn-secondary">
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          INTRODUCTION
      ====================================================== */}
      <section className="about-intro">
        <div className="about-container">
          <div className="about-eyebrow">About CivicPulse AI</div>

          <div className="about-intro-grid">
            <div>
              <h2>
                Built for the space between <span>a citizen and city hall.</span>
              </h2>
            </div>

            <div className="about-intro-text">
              <p>
                CivicPulse AI is a civic-reporting platform that replaces
                scattered phone calls and hallway complaints with a single,
                searchable record. One photo, one location, one case number
                per issue.
              </p>
              <p>
                Whether it's a pothole on the school run or a transformer
                that's been sparking for a week, every report follows the
                same path: submitted, located, reviewed, and handed to the
                office responsible for fixing it.
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
            <div className="about-eyebrow">What it does</div>
            <h2>
              A structured way to <span>report and respond.</span>
            </h2>
            <p>
              Four parts working together — reporting, triage, mapping and
              dashboards — so a filed report doesn't just disappear.
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
              <div className="about-eyebrow">Issue types</div>
              <h2>
                One form for <span>every kind of problem.</span>
              </h2>
              <p>
                Each category asks the questions relevant to that issue, so
                the department on the other end gets what it actually needs
                — not a generic complaint box.
              </p>
              <Link to="/complaint" className="about-text-link">
                Start a report →
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
          <div className="about-eyebrow">Why this exists</div>
          <h2>
            Every report deserves <span>a paper trail.</span>
          </h2>
          <p>
            Most civic complaints disappear into inboxes and phone logs with
            no way to follow up later. CivicPulse AI gives every report a
            case number, a location and a status, so citizens can see what
            happened to what they filed, and departments have a record of
            how they responded.
          </p>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ====================================================== */}
      <section className="about-final-cta">
        <div className="cta-card">
          <div>
            <div className="about-eyebrow">Got something to report?</div>
            <h2>Start with what you see.</h2>
            <p>
              A pothole, a broken light, a garbage pile that's been there for
              weeks — if it affects your street, it belongs in the system.
            </p>
          </div>

          <Link to="/complaint" className="about-btn about-btn-primary">
            Report an issue <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}