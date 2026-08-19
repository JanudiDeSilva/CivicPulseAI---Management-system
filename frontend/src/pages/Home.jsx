import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { fetchStats } from "../services/api";

// Import category images & UI background picture
import floodImg from "../assets/flood.jpeg";
import roadDamageImg from "../assets/road_damage.png";
import garbageImg from "../assets/bins.jpeg";
import powerFailureImg from "../assets/power failure.jpg";
import streetLightImg from "../assets/light.jpeg";
import cityBgImg from "../assets/city_background.png";
import communityImg from "../assets/community_help.png";

const CATEGORIES = [
  {
    id: "flood",
    titleKey: "cat_flood",
    icon: "🌊",
    image: floodImg,
    desc_en: "Report flash flooding, overflowing canals, and clogged drainage systems.",
    desc_si: "ආකස්මික ගංවතුර, ඉදිරිකරණ ඇළ ගලා යාම සහ අවහිර ජල කාණු පද්ධති වාර්තා කරන්න.",
    badge: "badge-flood",
  },
  {
    id: "road_damage",
    titleKey: "cat_road",
    icon: "🚗",
    image: roadDamageImg,
    desc_en: "Log hazardous potholes, damaged asphalt, or caved municipal roads.",
    desc_si: "භයානක ගිලෙන ස්ථාන, හානි වූ ඇස්ෆල්ට් හෝ ගිලූ නාගරික මාර්ග ලෝගු කරන්න.",
    badge: "badge-road_damage",
  },
  {
    id: "garbage",
    titleKey: "cat_garbage",
    icon: "🗑️",
    image: garbageImg,
    desc_en: "Report illegal waste dumping, missed collections, and unhygienic waste piles.",
    desc_si: "නීති විරෝධී කසළ ඉවත් කිරීම, මඟ හැරුණු එකතු කිරීම් සහ අනාරෝග්‍යකර කසළ ගොඩ වාර්තා කරන්න.",
    badge: "badge-garbage",
  },
  {
    id: "power_failure",
    titleKey: "cat_power",
    icon: "⚡",
    image: powerFailureImg,
    desc_en: "Report local blackouts, fallen lines, and transformer malfunction emergencies.",
    desc_si: "දේශීය ව්‍යසනකාරී ක්ෂේත්‍ර, ඇද වැටුණු රේඛා සහ ට්‍රාන්ස්ෆෝමර් දෝෂ හදිසි අවස්ථා වාර්තා කරන්න.",
    badge: "badge-power_failure",
  },
  {
    id: "street_light",
    titleKey: "cat_light",
    icon: "💡",
    image: streetLightImg,
    desc_en: "Report non-functional streetlights and dark hazards in residential neighborhoods.",
    desc_si: "ක්‍රියා නොකරන වීදි ලාම්පු සහ නේවාසික ප්‍රදේශවල අඳුරු භයානකතා වාර්තා කරන්න.",
    badge: "badge-street_light",
  }
];

export default function Home() {
  const { t, lang } = useLang();
  const { session } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div style={{ textAlign: "center", maxWidth: 1100, margin: "0 auto" }}>
      {/* Hero Section with Smart City Background Image */}
      <div
        className="hero-bg-section"
        style={{ backgroundImage: `url(${cityBgImg})` }}
      >
        <section className="hero-bg-overlay">
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
            <Link to="/complaint?category=flood" className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "1.05rem" }}>
              📢 {t("home_report_btn")}
            </Link>
            <Link to="/my-portal" className="btn btn-secondary" style={{ padding: "14px 28px", fontSize: "1.05rem" }}>
              🔍 Track Complaint
            </Link>
          </div>
        </section>
      </div>

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
          {[
            {
              icon: "📋",
              value: statsLoading ? null : stats ? stats.total_reports.toLocaleString() : "—",
              label: t("home_stats_complaints"),
            },
            {
              icon: "✅",
              value: statsLoading ? null : stats ? `${stats.resolved_percent}%` : "—",
              label: t("home_stats_resolved"),
            },
            {
              icon: "📂",
              value: statsLoading ? null : stats ? stats.open_count.toLocaleString() : "—",
              label: "Active Cases",
            },
            {
              icon: "🗺️",
              value: statsLoading ? null : stats ? stats.districts_covered : "—",
              label: t("home_stats_districts"),
            },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{
                fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)",
                minWidth: 60, minHeight: "2rem",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {s.value === null ? (
                  <span style={{
                    display: "inline-block", width: 60, height: 28,
                    borderRadius: 6,
                    background: "rgba(56,189,248,0.08)",
                    animation: "pulse 1.4s ease-in-out infinite"
                  }} />
                ) : s.value}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Category Grid with 5 Category Images */}
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
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ position: "relative", height: 130, overflow: "hidden" }}>
                  <img
                    src={cat.image}
                    alt={t(cat.titleKey)}
                    className="cat-card-img"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      fontSize: 20,
                      background: "rgba(11, 17, 32, 0.75)",
                      backdropFilter: "blur(6px)",
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.15)"
                    }}
                  >
                    {cat.icon}
                  </div>
                </div>
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: "1.05rem", marginBottom: 8, color: "var(--text-main)" }}>
                    {t(cat.titleKey)}
                  </h3>
                  <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 16 }}>
                    {lang === "si" ? cat.desc_si : cat.desc_en}
                  </p>
                </div>
              </div>
              <div style={{ padding: "0 20px 20px 20px" }}>
                <Link
                  to={`/complaint?category=${cat.id}`}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.83rem", padding: "8px 12px", width: "100%", justifyContent: "space-between" }}
                >
                  {lang === "si" ? "ගැටළුව වාර්තා කරන්න" : "Report Issue"} <span>→</span>
                </Link>
              </div>
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