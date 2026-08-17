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
    title: {
      en: "One form, one case number",
      si: "එක් පෝරමයක්, එක් නඩු අංකයක්"
    },
    body: {
      en: "Every report gets a category, a location and a case number — no more issues lost in email threads or phone calls that never get logged.",
      si: "සෑම වාර්තාවක්ම වර්ගයක්, ස්ථානයක් සහ නඩු අංකයක් ලබා ගනී — ඊමේල් හා දුරකථන ඇමතුම් මගින් නැති වූ ගැටළු තවදුරටත් නැත."
    }
  },
  {
    icon: "🤖",
    title: {
      en: "Automatic categorization",
      si: "ස්වයංක්‍රීය වර්ගීකරණය"
    },
    body: {
      en: "Selected reports are analyzed on submission and flagged by category and urgency, so nothing time-sensitive sits unread in a queue.",
      si: "තෝරාගත් වාර්තා ඉදිරිපත් වූ විගස විශ්ලේෂණය කර වර්ගය සහ අත්‍යවශ්‍යතාව අනුව ලකුණු කරයි, එමඟින් කාලය සීමිත ගැටළු අනුපියව බලා නොසිටී."
    }
  },
  {
    icon: "📍",
    title: {
      en: "Every case is pinned",
      si: "සෑම නඩුවක්ම සිතියම මත ඇත"
    },
    body: {
      en: "Reports are tied to a real location on a map, so patterns — like a street that keeps flooding — are visible, not anecdotal.",
      si: "වාර්තා සත්‍ය ස්ථානයක් හා සම්බන්ධ වන බැවින් ගංවතුරයක් නැවත නැවත සිදුවන වීදියක් වැනි රටාවන් දෘශ්‍යමාන වේ."
    }
  },
  {
    icon: "📊",
    title: {
      en: "Built for the response side",
      si: "ප්‍රතිචාර කර්මාන්තයට සහාය දෙන බව"
    },
    body: {
      en: "Authorities work from a live dashboard of open cases sorted by category, location and status, instead of a shared spreadsheet.",
      si: "අධිකාරිවරුන් වර්ගය, ස්ථානය සහ තත්ත්වය අනුව සකස් කර ඇති සජීවී උපකරණ පුවරුවෙන් වැඩ කරති, බෙදාගත් spreadsheet එකක් නොවේ."
    }
  },
];

const CATEGORIES = [
  {
    icon: "🌊",
    name: {
      en: "Flood & Drainage",
      si: "ගංවතුර සහ ජල බැස්සීම"
    },
    desc: {
      en: "Blocked drains, standing water, flood risk",
      si: "අවහිර ජල කාණු, සිටින ජලය, ගංවතුර අවදානම"
    },
    code: "CAT-01",
  },
  {
    icon: "🛣️",
    name: {
      en: "Road Damage",
      si: "මාර්ග හානි"
    },
    desc: {
      en: "Potholes, cracked surfaces, unsafe shoulders",
      si: "ගිල්වන මාර්ග, කැඩුණු පෘෂ්ඨ, අනාරක්ෂිත පැත්ත"
    },
    code: "CAT-02",
  },
  {
    icon: "♻️",
    name: {
      en: "Garbage & Waste",
      si: "කසළ සහ අපද්‍රව්‍ය"
    },
    desc: {
      en: "Missed collection, illegal dumping, overflow",
      si: "කළින් නොගත් එකතුව, නීතිවිරෝධී ඉවත් කිරීම, ඉක්මවා යාම"
    },
    code: "CAT-03",
  },
  {
    icon: "⚡",
    name: {
      en: "Power Failure",
      si: "විදුලි බිඳ වැටීම"
    },
    desc: {
      en: "Outages, exposed lines, electrical hazards",
      si: "විදුලි බිඳවැටීම්, නිරාවරණය වූ රේඛා, විදුලි භයානකතා"
    },
    code: "CAT-04",
  },
  {
    icon: "💡",
    name: {
      en: "Street Lighting",
      si: "වීදි ලාම්පු"
    },
    desc: {
      en: "Broken, flickering or missing street lights",
      si: "කැඩුණු, පිපිරෙන හෝ නොමැති වීදි ලාම්පු"
    },
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
          <div className="about-eyebrow">{t("about_intro_label")}</div>

          <div className="about-intro-grid">
            <div>
              <h2>
                {t("about_intro_heading_1")} <span>{t("about_intro_heading_2")}</span>
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
            <div className="about-eyebrow">{t("about_what_it_does")}</div>
            <h2>
              <span>{t("about_features_title")}</span>
            </h2>
            <p>
              {t("about_features_desc")}
            </p>
          </div>

          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title.en || f.title.si}>
                <span className="feature-icon" aria-hidden="true">
                  {f.icon}
                </span>
                <h3>{f.title[lang]}</h3>
                <p>{f.body[lang]}</p>
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
              <div className="about-eyebrow">{t("about_issue_types")}</div>
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
                <div className="category-card" key={c.code}>
                  <span className="cat-icon" aria-hidden="true">
                    {c.icon}
                  </span>
                  <div>
                    <strong>{c.name[lang]}</strong>
                    <span className="cat-desc">{c.desc[lang]}</span>
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
          <div className="about-eyebrow">{t("about_mission_label")}</div>
          <h2>
            <span>{t("about_mission_title")}</span>
          </h2>
          <p>
            {t("about_mission_desc")}
          </p>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ====================================================== */}
      <section className="about-final-cta">
        <div className="cta-card">
          <div>
            <div className="about-eyebrow">{t("about_final_label")}</div>
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