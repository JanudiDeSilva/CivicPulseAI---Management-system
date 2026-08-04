import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  {
    id: "flood",
    titleKey: "cat_flood",
    icon: "🌊",
    desc_en: "Report flash flooding, overflowing canals, and clogged drainage systems.",
    desc_si: "ආකස්මික ගංවතුර, ඉදිරිකරණ ඇළ ගලා යාම සහ අවහිර ජල කාණු පද්ධති වාර්තා කරන්න.",
    badge: "badge-flood",
  },
  {
    id: "road_damage",
    titleKey: "cat_road",
    icon: "🚗",
    desc_en: "Log hazardous potholes, damaged asphalt, or caved municipal roads.",
    desc_si: "භයානක ගිලෙන ස්ථාන, හානි වූ ඇස්ෆල්ට් හෝ ගිලූ නාගරික මාර්ග ලෝගු කරන්න.",
    badge: "badge-road_damage",
  },
  {
    id: "garbage",
    titleKey: "cat_garbage",
    icon: "🗑️",
    desc_en: "Report illegal waste dumping, missed collections, and unhygienic waste piles.",
    desc_si: "නීති විරෝධී කසළ ඉවත් කිරීම, මඟ හැරුණු එකතු කිරීම් සහ අනාරෝග්‍යකර කසළ ගොඩ වාර්තා කරන්න.",
    badge: "badge-garbage",
  },
  {
    id: "power_failure",
    titleKey: "cat_power",
    icon: "⚡",
    desc_en: "Report local blackouts, fallen lines, and transformer malfunction emergencies.",
    desc_si: "දේශීය ව්‍යසනකාරී ක්ෂේත්‍ර, ඇද වැටුණු රේඛා සහ ට්‍රාන්ස්ෆෝමර් දෝෂ හදිසි අවස්ථා වාර්තා කරන්න.",
    badge: "badge-power_failure",
  },
  {
    id: "street_light",
    titleKey: "cat_light",
    icon: "💡",
    desc_en: "Report non-functional streetlights and dark hazards in residential neighborhoods.",
    desc_si: "ක්‍රියා නොකරන වීදි ලාම්පු සහ නේවාසික ප්‍රදේශවල අඳුරු භයානකතා වාර්තා කරන්න.",
    badge: "badge-street_light",
  }
];

const STATS = [
  { value: "12,400+", labelKey: "home_stats_complaints", icon: "📋" },
  { value: "38 min", labelKey: "home_stats_response", icon: "⏱️" },
  { value: "94%", labelKey: "home_stats_resolved", icon: "✅" },
  { value: "25", labelKey: "home_stats_districts", icon: "🗺️" },
];

export default function Home() {
  const { t, lang } = useLang();
  const { session } = useAuth();

  return (
    <div style={{ textAlign: "center", maxWidth: 1100, margin: "0 auto" }}>
      {/* Hero Section */}
      <section style={{ padding: "44px 0 32px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 18px",
            borderRadius: 999,
            backgroundColor: "var(--cat-flood-bg)",
            border: "1px solid var(--cat-flood-border)",
            color: "var(--accent-pulse)",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: 22
          }}
        >
          ⚡ {t("home_hero_badge")}
        </div>

        <h1 style={{ fontSize: "3rem", fontWeight: 800, marginBottom: 16 }}>
          {t("home_hero_title")}
        </h1>

        <p style={{ fontSize: "1.12rem", color: "var(--text-muted)", maxWidth: 700, margin: "0 auto 32px", lineHeight: 1.7 }}>
          {t("home_hero_subtitle")}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <Link to={session ? "/complaint?category=flood" : "/login"} className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "1.05rem" }}>
            📢 {t("home_report_btn")}
          </Link>
          <Link to="/dashboard" className="btn btn-secondary" style={{ padding: "14px 28px", fontSize: "1.05rem" }}>
            📊 {t("home_dashboard_btn")}
          </Link>
        </div>
      </section>

      {/* Stats Strip */}
      <section style={{ padding: "12px 0 36px" }}>
        <div
          className="glass-card"
          style={{
            padding: "20px 32px",
            display: "flex",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: 16
          }}
        >
          {STATS.map((s) => (
            <div key={s.labelKey} style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)" }}>{s.value}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 500 }}>{t(s.labelKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Category Grid */}
      <section style={{ padding: "8px 0 36px" }}>
        <div style={{ textAlign: "left", marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.75rem", marginBottom: 8 }}>{t("home_categories_title")}</h2>
          <p>
            {lang === "si"
              ? "ක්ෂණික AI ත්‍රිආජ් සහිත ව්‍යුහගත පැමිණිල්ලක් ඉදිරිපත් කිරීමට ගැටළු වර්ගයක් තෝරන්න."
              : "Choose an issue category below to submit a structured complaint with instant AI triage."}
          </p>
        </div>

        <div className="grid-5">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="glass-card"
              style={{
                textAlign: "left",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{cat.icon}</div>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 8, color: "var(--text-main)" }}>
                  {t(cat.titleKey)}
                </h3>
                <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 16 }}>
                  {lang === "si" ? cat.desc_si : cat.desc_en}
                </p>
              </div>
              <Link
                to={session ? `/complaint?category=${cat.id}` : "/login"}
                className="btn btn-secondary"
                style={{ fontSize: "0.83rem", padding: "8px 12px", width: "100%", justifyContent: "space-between" }}
              >
                {lang === "si" ? "ගැටළුව වාර්තා කරන්න" : "Report Issue"} <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section
        className="glass-card"
        style={{ marginTop: 8, marginBottom: 32, textAlign: "left", padding: 36 }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: 24 }}>{t("home_how_title")}</h2>
        <div className="grid-3">
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--brand-blue-light)", marginBottom: 8 }}>
              01.
            </div>
            <h4 style={{ color: "var(--text-main)", marginBottom: 6 }}>{t("home_step1_title")}</h4>
            <p style={{ fontSize: "0.88rem" }}>{t("home_step1_desc")}</p>
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#7c3aed", marginBottom: 8 }}>02.</div>
            <h4 style={{ color: "var(--text-main)", marginBottom: 6 }}>{t("home_step2_title")}</h4>
            <p style={{ fontSize: "0.88rem" }}>{t("home_step2_desc")}</p>
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10b981", marginBottom: 8 }}>03.</div>
            <h4 style={{ color: "var(--text-main)", marginBottom: 6 }}>{t("home_step3_title")}</h4>
            <p style={{ fontSize: "0.88rem" }}>{t("home_step3_desc")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}