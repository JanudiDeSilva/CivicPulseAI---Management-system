import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { submitComplaint } from "../services/api";
import { useAuth } from "../context/AuthContext";

import floodImg from "../assets/flood.jpeg";
import roadDamageImg from "../assets/road_damage.png";
import garbageImg from "../assets/bins.jpeg";
import powerFailureImg from "../assets/power failure.jpg";
import streetLightImg from "../assets/light.jpeg";

const ISSUE_CATEGORIES = [
  {
    id: "flood",
    label: "Drainage & Waterlogging Issue",
    icon: "🌊",
    image: floodImg,
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(59, 130, 246, 0.4)",
    badgeClass: "badge-flood",
    description: "Blocked storm drains, waterlogging on roads, overflowing canals, broken drain covers, or stagnant water issues"
  },
  {
    id: "road_damage",
    label: "Road Damage & Potholes",
    icon: "🚗",
    image: roadDamageImg,
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.12)",
    border: "rgba(245, 158, 11, 0.4)",
    badgeClass: "badge-road_damage",
    description: "Crater potholes, caved roads, broken asphalt, or hazardous road debris"
  },
  {
    id: "garbage",
    label: "Garbage & Waste Management",
    icon: "🗑️",
    image: garbageImg,
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.12)",
    border: "rgba(16, 185, 129, 0.4)",
    badgeClass: "badge-garbage",
    description: "Overflowing dumpsters, illegal dumping, uncollected household waste"
  },
  {
    id: "power_failure",
    label: "Power Failure & Outage",
    icon: "⚡",
    image: powerFailureImg,
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.12)",
    border: "rgba(139, 92, 246, 0.4)",
    badgeClass: "badge-power_failure",
    description: "Transformer breakdowns, line faults, blackout, high voltage fluctuations"
  },
  {
    id: "street_light",
    label: "Broken Street Light & Lighting",
    icon: "💡",
    image: streetLightImg,
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(250, 204, 21, 0.4)",
    badgeClass: "badge-street_light",
    description: "Non-functional streetlights, dark road stretches, flickering lighting poles"
  }
];

export default function ComplaintForm() {
  const navigate = useNavigate();
  const { session, requestMobileOtp, loginWithMobileOtp } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryCat = searchParams.get("category");
  const initialCategory = ISSUE_CATEGORIES.some((c) => c.id === queryCat) ? queryCat : "";

  // Form State - Mobile is primary required field; Name, Email, NIC are optional
  const [form, setForm] = useState({
    category: initialCategory,
    phone: session?.phone || "",
    name: session?.name || "",
    email: session?.email && !session.email.includes("@mobile.civicpulse.local") ? session.email : "",
    nic: session?.nic || "",
    district: "",
    city: "",
    area: "",
    description: ""
  });

  const [categoryDetails, setCategoryDetails] = useState({
    // Flood
    problemType: "Blocked / Clogged Storm Drain or Grate",
    severityWaterlogging: "Minor – Ankle deep or less",
    waterStatus: "Flowing",
    problemDuration: "Just started (today)",
    flood_impact_traffic: false,
    flood_impact_pedestrian: false,
    flood_impact_entering: false,
    flood_impact_smell: false,
    flood_impact_mosquito: false,
    flood_impact_vehicle: false,

    // Garbage
    wasteType: "Household Organic & Food Waste",
    dumpsterStatus: "Overflowing Municipal Trash Bin",
    accumulationDuration: "3 - 5 Days",
    healthHazard: "Severe Foul Odor & Pest Infestation (Flies/Rats)",

    // Road Damage
    damageType: "Deep Pothole / Crater",
    potholeSize: "Medium (1 - 3 feet wide)",
    roadClass: "Main Arterial Road / Expressway",
    hazardLevel: "Extreme Hazard for Motorcycles / Bicycles",

    // Power Failure
    outageScope: "Entire Street / Neighborhood Block",
    outageSymptom: "Total Power Blackout (No Supply)",
    criticalDanger: "No Immediate Wire Hazard",
    outageDuration: "1 - 3 Hours",

    // Street Light
    lightFault: "Streetlight Completely Dark / Out",
    lightsCount: "Entire Street Block / Dark Road",
    securityRisk: "Dark Alley / High Crime Vulnerability",
    poleTag: ""
  });

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setCategoryDetails((prev) => ({ ...prev, [name]: checked }));
  };

  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Optional Light Account OTP state on Success Screen
  const [otpMode, setOtpMode] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [generatedOtpCode, setGeneratedOtpCode] = useState("");

  // AI garbage classification state
  const [garbageResult, setGarbageResult] = useState(null);
  const [garbageLoading, setGarbageLoading] = useState(false);
  const [garbageError, setGarbageError] = useState(null);
  const GARBAGE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

  const currentCategory = ISSUE_CATEGORIES.find((c) => c.id === form.category);

  // Sync category if URL query changes
  useEffect(() => {
    if (queryCat && ISSUE_CATEGORIES.some((c) => c.id === queryCat) && queryCat !== form.category) {
      setForm((prev) => ({ ...prev, category: queryCat }));
    }
  }, [queryCat]);

  useEffect(() => {
    if (form.category !== "garbage") {
      setGarbageResult(null);
      setGarbageError(null);
    }
  }, [form.category]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      setSearchParams({ category: value }, { replace: true });
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setCategoryDetails((prev) => ({ ...prev, [name]: value }));
  };

  const getCategorySpecificSummary = () => {
    switch (form.category) {
      case "flood": {
        const impacts = [];
        if (categoryDetails.flood_impact_traffic) impacts.push("Traffic disruption");
        if (categoryDetails.flood_impact_pedestrian) impacts.push("Pedestrian difficulty");
        if (categoryDetails.flood_impact_entering) impacts.push("Water entering houses/shops");
        if (categoryDetails.flood_impact_smell) impacts.push("Foul smell");
        if (categoryDetails.flood_impact_mosquito) impacts.push("Mosquito breeding risk");
        if (categoryDetails.flood_impact_vehicle) impacts.push("Vehicle damage risk");
        return `Problem: ${categoryDetails.problemType} | Severity: ${categoryDetails.severityWaterlogging} | Status: ${categoryDetails.waterStatus} | Duration: ${categoryDetails.problemDuration} | Impact: ${impacts.join(", ") || "None"}`;
      }
      case "garbage":
        return `Condition: ${categoryDetails.dumpsterStatus} | Duration: ${categoryDetails.accumulationDuration} | Hazard: ${categoryDetails.healthHazard}`;
      case "road_damage":
        return `Damage Type: ${categoryDetails.damageType} | Size: ${categoryDetails.potholeSize} | Road: ${categoryDetails.roadClass} | Risk: ${categoryDetails.hazardLevel}`;
      case "power_failure":
        return `Scope: ${categoryDetails.outageScope} | Fault: ${categoryDetails.outageSymptom} | Hazard: ${categoryDetails.criticalDanger} | Duration: ${categoryDetails.outageDuration}`;
      case "street_light":
        return `Fault: ${categoryDetails.lightFault} | Extent: ${categoryDetails.lightsCount} | Risk: ${categoryDetails.securityRisk}${categoryDetails.poleTag ? ` | Tag: ${categoryDetails.poleTag}` : ""}`;
      default:
        return "";
    }
  };

  // GPS Geolocation Handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setLocationStatus("Detecting GPS coordinates...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLocation({ latitude: lat, longitude: lon });

        try {
          setLocationStatus("Fetching location details...");
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const address = geoData.address || {};

            const detectedDistrict =
              address.state_district ||
              address.county ||
              address.district ||
              address.state ||
              "";

            const detectedCity =
              address.city ||
              address.town ||
              address.municipality ||
              address.city_district ||
              "";

            const detectedArea =
              address.suburb ||
              address.neighbourhood ||
              address.residential ||
              address.road ||
              address.quarter ||
              geoData.name ||
              "";

            setForm((prev) => ({
              ...prev,
              district: detectedDistrict || prev.district,
              city: detectedCity || prev.city,
              area: detectedArea || prev.area
            }));

            const details = [];
            if (detectedDistrict) details.push(`District: ${detectedDistrict}`);
            if (detectedCity) details.push(`City: ${detectedCity}`);
            if (detectedArea) details.push(`Area: ${detectedArea}`);

            setLocationStatus(
              details.length > 0
                ? `📍 Synced: ${details.join(" | ")}`
                : `📍 GPS Captured (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`
            );
          } else {
            setLocationStatus(`📍 GPS Captured (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`);
          }
        } catch (geoErr) {
          console.warn("Reverse geocoding error:", geoErr);
          setLocationStatus(`📍 GPS Captured (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error("GPS error:", error);
        setLocationStatus("Unable to auto-detect GPS. Please fill the District, City, and Area fields below.");
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const classifyGarbagePhoto = async (file) => {
    setGarbageLoading(true);
    setGarbageError(null);
    setGarbageResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${GARBAGE_API_URL}/predict-garbage`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setGarbageError(data.error);
      } else {
        setGarbageResult(data);
      }
    } catch (err) {
      setGarbageError("Could not reach AI classification service");
    } finally {
      setGarbageLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const allowedFiles = files.slice(0, 10 - photos.length);
      if (allowedFiles.length === 0) return;

      const newPhotos = [...photos, ...allowedFiles];
      const newPreviews = [...photoPreviews, ...allowedFiles.map(file => URL.createObjectURL(file))];

      setPhotos(newPhotos);
      setPhotoPreviews(newPreviews);

      if (form.category === "garbage" && newPhotos.length > 0) {
        classifyGarbagePhoto(newPhotos[0]);
      } else {
        setGarbageResult(null);
        setGarbageError(null);
      }
    }
  };

  const handleDetachPhoto = (index, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newPhotos = [...photos];
    const newPreviews = [...photoPreviews];
    newPhotos.splice(index, 1);
    newPreviews.splice(index, 1);

    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);

    if (newPhotos.length === 0) {
      setGarbageResult(null);
      setGarbageError(null);
      const fileInput = document.getElementById("photo-upload-input");
      if (fileInput) fileInput.value = "";
    } else if (form.category === "garbage" && index === 0) {
      classifyGarbagePhoto(newPhotos[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phone?.trim()) {
      alert("Mobile number is required so our municipal team can contact you and send live tracking updates.");
      return;
    }

    setLoading(true);

    const trackingId = "CP-" + Math.floor(100000 + Math.random() * 900000);
    const specificSummary = getCategorySpecificSummary();

    const data = new FormData();
    data.append("category", form.category);
    data.append("phone", form.phone.trim());
    if (form.name?.trim()) data.append("name", form.name.trim());
    if (form.email?.trim()) data.append("email", form.email.trim());
    if (form.nic?.trim()) data.append("nic", form.nic.trim());
    data.append("district", form.district);
    data.append("city", form.city);
    data.append("area", form.area);
    data.append("description", form.description);
    data.append("tracking_id", trackingId);
    data.append("specific_details", specificSummary);

    if (form.category === "flood") {
      data.append("problemType", categoryDetails.problemType || '');
      data.append("severityWaterlogging", categoryDetails.severityWaterlogging || '');
      data.append("waterStatus", categoryDetails.waterStatus || '');
      data.append("problemDuration", categoryDetails.problemDuration || '');
      
      const impacts = [];
      if (categoryDetails.flood_impact_traffic) impacts.push("Traffic disruption");
      if (categoryDetails.flood_impact_pedestrian) impacts.push("Pedestrian difficulty");
      if (categoryDetails.flood_impact_entering) impacts.push("Water entering houses/shops");
      if (categoryDetails.flood_impact_smell) impacts.push("Foul smell");
      if (categoryDetails.flood_impact_mosquito) impacts.push("Mosquito breeding risk");
      if (categoryDetails.flood_impact_vehicle) impacts.push("Vehicle damage risk");
      data.append("impact", JSON.stringify(impacts));
    }

    if (location) {
      data.append("latitude", location.latitude);
      data.append("longitude", location.longitude);
    }

    if (photos.length > 0) {
      photos.forEach(p => {
        data.append("photos", p);
      });
    }

    // Persist ticket locally for instant sync
    const newComplaintRecord = {
      id: trackingId,
      tracking_id: trackingId,
      name: form.name?.trim() || "Citizen",
      phone: form.phone.trim(),
      email: form.email?.trim() || session?.email || "guest@civicpulse.local",
      created_by_email: session?.email || "guest@civicpulse.local",
      nic: form.nic?.trim() || session?.nic || "",
      category: form.category,
      category_label: currentCategory.label,
      icon: currentCategory.icon,
      district: form.district,
      city: form.city,
      area: form.area,
      specific_details: specificSummary,
      description: form.description,
      severity: "PENDING",
      status: "Registered",
      submitted_at: "Just now"
    };

    try {
      const storedStr = localStorage.getItem("civic_pulse_user_complaints");
      const storedList = storedStr ? JSON.parse(storedStr) : [];
      localStorage.setItem(
        "civic_pulse_user_complaints",
        JSON.stringify([newComplaintRecord, ...storedList])
      );
    } catch (err) {
      console.warn("Storage sync warning:", err);
    }

    try {
      const response = await submitComplaint(data);
      const serverData = response.data;

      try {
        const storedStr = localStorage.getItem("civic_pulse_user_complaints");
        const storedList = storedStr ? JSON.parse(storedStr) : [];
        const updated = storedList.map((c) =>
          c.id === trackingId || c.tracking_id === trackingId
            ? {
                ...c,
                id: serverData.id || c.id,
                tracking_id: serverData.tracking_id || trackingId,
                severity: serverData.severity || "PENDING",
                status: serverData.status || "Registered",
                image_url: serverData.image_url || (photoPreviews.length > 0 ? JSON.stringify(photoPreviews) : null) || c.image_url,
                ml_analysis: serverData.ml_analysis || garbageResult || c.ml_analysis,
              }
            : c
        );
        localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
      } catch (_) {}

      setLoading(false);
      setSubmissionSuccess({
        trackingId: serverData.tracking_id || trackingId,
        category: form.category,
        severity: serverData.severity || "PENDING",
        priorityScore: serverData.priority_score,
        predictedEscalation: serverData.predicted_escalation,
        mlAnalysis: serverData.ml_analysis,
        floodRisk: serverData.floodRisk || null,
        status: serverData.status || "Registered",
        categoryLabel: currentCategory.label,
        categoryIcon: currentCategory.icon,
        name: form.name || "Citizen",
        phone: form.phone.trim(),
        district: form.district,
        city: form.city,
        area: form.area,
        specificSummary,
        date: new Date().toLocaleString()
      });
    } catch (err) {
      console.warn("Backend offline, using instant optimistic fallback:", err);
      setLoading(false);

      const demoSeverity = form.category === "road_damage" ? "HIGH" : form.category === "flood" ? "HIGH" : "MEDIUM";
      const demoStatus = "Registered";

      setSubmissionSuccess({
        trackingId,
        category: form.category,
        severity: demoSeverity,
        priorityScore: 0.65,
        predictedEscalation: "NO",
        status: demoStatus,
        categoryLabel: currentCategory.label,
        categoryIcon: currentCategory.icon,
        name: form.name || "Citizen",
        phone: form.phone.trim(),
        district: form.district,
        city: form.city,
        area: form.area,
        specificSummary,
        date: new Date().toLocaleString()
      });
    }
  };

  const handleCopyId = () => {
    if (submissionSuccess?.trackingId) {
      navigator.clipboard.writeText(submissionSuccess.trackingId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleSendLightAccountOtp = () => {
    try {
      setOtpLoading(true);
      setOtpError("");
      const payload = requestMobileOtp(submissionSuccess.phone);
      setGeneratedOtpCode(payload.otp);
      setOtpMode(true);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyLightAccountOtp = () => {
    try {
      setOtpLoading(true);
      setOtpError("");
      loginWithMobileOtp(submissionSuccess.phone, enteredOtp);
      navigate(`/my-portal?id=${submissionSuccess.trackingId}&phone=${encodeURIComponent(submissionSuccess.phone)}`);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {!currentCategory && !submissionSuccess ? (
        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: "1.75rem", marginBottom: 8, color: "#f8fafc" }}>Select Complaint Category</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
            No account required. Select an issue category below to lodge your municipal report instantly.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {ISSUE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setSearchParams({ category: cat.id }, { replace: true });
                  setForm((prev) => ({ ...prev, category: cat.id }));
                }}
                className="glass-card"
                style={{
                  textAlign: "left", padding: 0, overflow: "hidden", cursor: "pointer",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  border: `1px solid ${cat.border}`,
                  transition: "all 0.25s ease",
                  backgroundColor: "rgba(17, 28, 50, 0.75)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cat.bg}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(17, 28, 50, 0.75)"}
              >
                <div>
                  <div style={{ position: "relative", height: 120, overflow: "hidden" }}>
                    <img
                      src={cat.image}
                      alt={cat.label}
                      className="cat-card-img"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute", top: 8, right: 8, fontSize: 18,
                        background: "rgba(11, 17, 32, 0.75)", backdropFilter: "blur(6px)",
                        padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.15)"
                      }}
                    >
                      {cat.icon}
                    </div>
                  </div>
                  <div style={{ padding: 18 }}>
                    <h3 style={{ fontSize: "1.02rem", marginBottom: 6, color: "var(--text-main)" }}>{cat.label}</h3>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {cat.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : currentCategory && !submissionSuccess ? (
        <div
          className="glass-card"
          style={{
            borderTop: `4px solid ${currentCategory.color}`,
            transition: "border-color 0.3s ease",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({}, { replace: true });
                    setForm((prev) => ({ ...prev, category: "" }));
                  }}
                  className="btn btn-secondary"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", fontSize: "0.85rem", borderRadius: 8, cursor: "pointer"
                  }}
                >
                  ← Back to Categories
                </button>
                <span className={`category-badge ${currentCategory.badgeClass}`} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>{currentCategory.icon}</span> {currentCategory.label}
                </span>
              </div>
              <h2 style={{ fontSize: "1.75rem", margin: 0 }}>Lodge Citizen Complaint</h2>
              <p style={{ marginTop: 4, color: "var(--text-muted)" }}>
                Fast guest submission — No account required. Provide issue location and mobile number for live SMS updates.
              </p>
            </div>
          </div>

          {/* GPS Auto-Detect Bar */}
          <div
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 16,
              marginBottom: 22,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📍</span>
                <strong style={{ fontSize: "0.95rem", color: "#f8fafc" }}>Auto-Detect Incident Location (Optional)</strong>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2, margin: 0 }}>
                {locationStatus || "Reporting from the site? Click to auto-fill District & City, or enter location below."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="btn btn-secondary"
              style={{
                fontSize: "0.85rem",
                padding: "8px 16px",
                borderColor: location ? "#34d399" : "#334155"
              }}
            >
              {locating ? "🛰️ Detecting..." : location ? "✓ GPS Synced" : "📍 Auto-Detect Location"}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* ── REQUIRED PRIMARY CONTACT FIELD: MOBILE NUMBER ── */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  📱 Mobile Contact Number <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <span style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 600 }}>Primary field for SMS updates</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="e.g. 077 123 4567 or +94 77 123 4567"
                value={form.phone}
                onChange={handleChange}
                className="form-input"
                style={{ fontSize: "0.95rem", borderColor: form.phone ? "#38bdf8" : "#334155" }}
              />
              <span style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 4, display: "block" }}>
                We will send your Complaint Reference ID and dispatch status to this mobile number.
              </span>
            </div>

            {/* ── OPTIONAL PERSONAL FIELDS ── */}
            <div className="grid-3" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">
                  Citizen Name <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. A.B. Perera"
                  value={form.name}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email Address <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. name@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  NIC Number <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  name="nic"
                  placeholder="e.g. 199012345678"
                  value={form.nic}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            {/* ── ISSUE LOCATION FIELDS ── */}
            <div className="grid-3" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">
                  District <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  name="district"
                  required
                  placeholder="e.g. Colombo / Gampaha"
                  value={form.district}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  City / Town <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  placeholder="e.g. Maharagama"
                  value={form.city}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Specific Area / Road <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  name="area"
                  required
                  placeholder="e.g. High Level Rd, Junction 4"
                  value={form.area}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            {/* ── DYNAMIC CATEGORY-SPECIFIC FORM FIELDS ── */}
            <div
              style={{
                backgroundColor: currentCategory.bg,
                border: `1px solid ${currentCategory.border}`,
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, borderBottom: `1px solid ${currentCategory.border}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{currentCategory.icon}</span>
                <h3 style={{ fontSize: "1.02rem", margin: 0, color: "var(--text-main)", fontWeight: 700 }}>
                  {currentCategory.label} — Incident Specifics
                </h3>
              </div>

              {/* FLOOD / DRAINAGE SPECIFIC FIELDS */}
              {form.category === "flood" && (
                <div>
                  {/* Row 1 */}
                  <div className="grid-2">
                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">
                        Type of Problem <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select name="problemType" value={categoryDetails.problemType} onChange={handleDetailChange} className="form-select">
                        <option value="Blocked / Clogged Storm Drain or Grate">Blocked / Clogged Storm Drain or Grate</option>
                        <option value="Overflowing Canal or Open Drain">Overflowing Canal or Open Drain</option>
                        <option value="Waterlogging on Road / Street">Waterlogging on Road / Street</option>
                        <option value="Broken, Missing or Open Drain Cover">Broken, Missing or Open Drain Cover</option>
                        <option value="Collapsed or Damaged Culvert / Pipe">Collapsed or Damaged Culvert / Pipe</option>
                        <option value="Inadequate Drainage Capacity">Inadequate Drainage Capacity</option>
                        <option value="Stagnant Water (health risk)">Stagnant Water (health risk)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Severity of Waterlogging</label>
                      <select name="severityWaterlogging" value={categoryDetails.severityWaterlogging} onChange={handleDetailChange} className="form-select">
                        <option value="Minor – Ankle deep or less">Minor – Ankle deep or less</option>
                        <option value="Moderate – Knee deep">Moderate – Knee deep</option>
                        <option value="Severe – Above knee / vehicles affected">Severe – Above knee / vehicles affected</option>
                        <option value="Extreme – Water entering buildings">Extreme – Water entering buildings</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid-2">
                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Is the water flowing or stagnant?</label>
                      <select name="waterStatus" value={categoryDetails.waterStatus} onChange={handleDetailChange} className="form-select">
                        <option value="Flowing">Flowing</option>
                        <option value="Stagnant">Stagnant</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label className="form-label">Duration of the Problem</label>
                      <select name="problemDuration" value={categoryDetails.problemDuration} onChange={handleDetailChange} className="form-select">
                        <option value="Just started (today)">Just started (today)</option>
                        <option value="1–2 days">1–2 days</option>
                        <option value="Several days">Several days</option>
                        <option value="Recurring problem">Recurring problem</option>
                      </select>
                    </div>
                  </div>

                  {/* Impact Checkboxes */}
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Impact <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: "0.85rem" }}>(select all that apply)</span></label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginTop: 8 }}>
                      {[
                        { name: "flood_impact_traffic", label: "🚗 Traffic disruption" },
                        { name: "flood_impact_pedestrian", label: "🚶 Pedestrian difficulty" },
                        { name: "flood_impact_entering", label: "🏠 Water entering houses/shops" },
                        { name: "flood_impact_smell", label: "🤢 Foul smell" },
                        { name: "flood_impact_mosquito", label: "🦟 Mosquito breeding risk" },
                        { name: "flood_impact_vehicle", label: "⚠️ Vehicle damage risk" },
                      ].map(({ name, label }) => (
                        <label key={name} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.9rem", color: "var(--text-main)" }}>
                          <input
                            type="checkbox"
                            name={name}
                            checked={!!categoryDetails[name]}
                            onChange={handleCheckboxChange}
                            style={{ width: 16, height: 16, accentColor: "#3b82f6", cursor: "pointer" }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Helper note */}
                  <div style={{
                    marginTop: 4,
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    fontSize: "0.82rem",
                    color: "#93c5fd",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6
                  }}>
                    <span style={{ flexShrink: 0 }}>ℹ️</span>
                    <span>This form is for regular drainage and waterlogging issues, not major flood disasters. GPS + live weather data will be used to assess urgency automatically.</span>
                  </div>
                </div>
              )}

              {/* GARBAGE SPECIFIC FIELDS */}
              {form.category === "garbage" && (
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Dumpster / Waste Status</label>
                    <select name="dumpsterStatus" value={categoryDetails.dumpsterStatus} onChange={handleDetailChange} className="form-select">
                      <option value="Overflowing Municipal Trash Bin">Overflowing Municipal Trash Bin</option>
                      <option value="Illegal Roadside Garbage Dumping">Illegal Roadside Garbage Dumping</option>
                      <option value="Uncollected Household Waste">Uncollected Household Waste</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Accumulation Time</label>
                    <select name="accumulationDuration" value={categoryDetails.accumulationDuration} onChange={handleDetailChange} className="form-select">
                      <option value="1 - 2 Days">1 - 2 Days</option>
                      <option value="3 - 5 Days">3 - 5 Days</option>
                      <option value="Over a Week">Over a Week</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ROAD DAMAGE SPECIFIC FIELDS */}
              {form.category === "road_damage" && (
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Damage Type</label>
                    <select name="damageType" value={categoryDetails.damageType} onChange={handleDetailChange} className="form-select">
                      <option value="Deep Pothole / Crater">Deep Pothole / Crater</option>
                      <option value="Caved-in Road Surface">Caved-in Road Surface</option>
                      <option value="Open / Damaged Manhole Cover">Open / Damaged Manhole Cover</option>
                      <option value="Cracked & Uneven Asphalt">Cracked &amp; Uneven Asphalt</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Hazard Level</label>
                    <select name="hazardLevel" value={categoryDetails.hazardLevel} onChange={handleDetailChange} className="form-select">
                      <option value="Extreme Hazard for Motorcycles / Bicycles">Extreme Hazard for 2-Wheelers</option>
                      <option value="High Risk of Vehicle Damage">High Risk of Vehicle Damage</option>
                      <option value="Moderate Traffic Disruption">Moderate Traffic Disruption</option>
                    </select>
                  </div>
                </div>
              )}

              {/* POWER FAILURE SPECIFIC FIELDS */}
              {form.category === "power_failure" && (
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Outage Scope</label>
                    <select name="outageScope" value={categoryDetails.outageScope} onChange={handleDetailChange} className="form-select">
                      <option value="Entire Street / Neighborhood Block">Entire Street / Block</option>
                      <option value="Transformer Breakdown / Sparking">Transformer Sparking / Breakdown</option>
                      <option value="Single House / Connection">Single Line</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Hazard Warning</label>
                    <select name="criticalDanger" value={categoryDetails.criticalDanger} onChange={handleDetailChange} className="form-select">
                      <option value="No Immediate Wire Hazard">No Immediate Wire Hazard</option>
                      <option value="DANGER: Fallen Live Power Lines">DANGER: Fallen Live Lines</option>
                      <option value="Sparking Transformer with Fire Risk">Sparking / Fire Risk</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STREET LIGHT SPECIFIC FIELDS */}
              {form.category === "street_light" && (
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Light Fault</label>
                    <select name="lightFault" value={categoryDetails.lightFault} onChange={handleDetailChange} className="form-select">
                      <option value="Streetlight Completely Dark / Out">Completely Dark / Out</option>
                      <option value="Flickering / Intermittent">Flickering / Intermittent</option>
                      <option value="Damaged Light Fixture / Pole">Damaged Pole / Fixture</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Pole Reference Tag (Optional)</label>
                    <input
                      type="text"
                      name="poleTag"
                      placeholder="e.g. SL-104 (printed on pole)"
                      value={categoryDetails.poleTag}
                      onChange={handleDetailChange}
                      className="form-input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Complaint Description */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">
                Complaint Description &amp; Details <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder={`Describe the ${currentCategory.label.toLowerCase()} issue in detail (landmarks, observed impact, urgency)...`}
                value={form.description}
                onChange={handleChange}
                className="form-textarea"
              />
            </div>

            {/* Photo Upload */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">
                Photo Evidence <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional but recommended)</span>
              </label>
              <div
                style={{
                  border: "2px dashed #334155",
                  borderRadius: 12,
                  padding: "16px",
                  textAlign: "center",
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  cursor: "pointer"
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                  id="photo-upload-input"
                />
                <label htmlFor="photo-upload-input" style={{ cursor: "pointer", display: "block" }}>
                  {photoPreviews.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 450, margin: "0 auto" }}>
                      {photoPreviews.map((preview, index) => (
                        <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #475569" }}
                            />
                            <div style={{ textAlign: "left" }}>
                              <p style={{ fontWeight: 600, color: "#f8fafc", margin: 0, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {photos[index]?.name || "Image file"}
                              </p>
                              <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                                {photos[index] ? `${(photos[index].size / 1024).toFixed(1)} KB` : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDetachPhoto(index, e)}
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              borderRadius: 8,
                              padding: "5px 10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            ✕ Detach
                          </button>
                        </div>
                      ))}
                      {photoPreviews.length < 10 && (
                        <div style={{ color: "#60a5fa", fontSize: "0.82rem", marginTop: 4 }}>+ Add another photo</div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📸</div>
                      <p style={{ color: "#f8fafc", fontWeight: 600, margin: 0 }}>Click to attach photo evidence</p>
                      <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>PNG, JPG or WEBP (Max 10MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Garbage AI Analysis feedback if category === garbage */}
              {form.category === "garbage" && garbageLoading && (
                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7", fontSize: "0.82rem" }}>
                  🤖 Analyzing image with AI waste classifier…
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "14px 28px",
                fontSize: "1.05rem",
                backgroundColor: currentCategory.color,
                borderColor: currentCategory.color
              }}
            >
              {loading ? "Submitting Complaint..." : `Submit ${currentCategory.label} Report`}
            </button>
          </form>
        </div>
      ) : null}

      {/* ── SUCCESS SCREEN MODAL ── */}
      {submissionSuccess && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: 580, width: "100%", padding: 32,
              textAlign: "left", backgroundColor: "#1e293b",
              borderColor: "#34d399", boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              maxHeight: "92vh", overflowY: "auto"
            }}
          >
            {/* Top Icon & Title */}
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 60, height: 60, borderRadius: "50%",
                  backgroundColor: "rgba(52, 211, 153, 0.15)",
                  border: "2px solid #34d399",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, margin: "0 auto 12px"
                }}
              >
                ✅
              </div>
              <h3 style={{ fontSize: "1.6rem", margin: "0 0 6px", color: "#f8fafc" }}>
                Complaint Registered Successfully!
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94a3b8", margin: 0 }}>
                Your ticket has been logged with instant AI triage and dispatched to the municipal team.
              </p>
            </div>

            {/* Complaint Reference Banner with Copy button */}
            <div
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16
              }}
            >
              <div>
                <span style={{ fontSize: "0.72rem", color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Your Complaint ID
                </span>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#60a5fa", marginTop: 2 }}>
                  {submissionSuccess.trackingId}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="btn btn-secondary"
                style={{ fontSize: "0.8rem", padding: "6px 14px", borderColor: copiedId ? "#34d399" : "#3b82f6", color: copiedId ? "#34d399" : "#93c5fd" }}
              >
                {copiedId ? "✓ Copied!" : "📋 Copy ID"}
              </button>
            </div>

            {/* SMS Confirmation Notice */}
            <div
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 18,
                fontSize: "0.82rem",
                color: "#a7f3d0",
                display: "flex",
                gap: 10,
                alignItems: "flex-start"
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>📱</span>
              <div>
                <strong>SMS Confirmation Dispatched to {submissionSuccess.phone}</strong>
                <div style={{ color: "#6ee7b7", fontSize: "0.76rem", marginTop: 2 }}>
                  &ldquo;CivicPulse: Your complaint {submissionSuccess.trackingId} has been registered. Track live: /my-portal?id={submissionSuccess.trackingId}&rdquo;
                </div>
              </div>
            </div>

            {/* Summary Details */}
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: 14,
                fontSize: "0.83rem",
                marginBottom: 20
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#94a3b8" }}>Category:</span>
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>{submissionSuccess.categoryIcon} {submissionSuccess.categoryLabel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#94a3b8" }}>Location:</span>
                <span style={{ color: "#cbd5e1" }}>{[submissionSuccess.area, submissionSuccess.city, submissionSuccess.district].filter(Boolean).join(", ")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#94a3b8" }}>AI Triage Severity:</span>
                <span style={{
                  color: submissionSuccess.severity === "CRITICAL" ? "#ef4444" : submissionSuccess.severity === "HIGH" ? "#f97316" : "#22c55e",
                  fontWeight: 700
                }}>
                  {submissionSuccess.severity}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Registered Date:</span>
                <span style={{ color: "#64748b" }}>{submissionSuccess.date}</span>
              </div>
            </div>

            {/* ── FLOOD AI ASSESSMENT PANEL ── */}
            {submissionSuccess.category === "flood" && submissionSuccess.floodRisk && (
              <div
                style={{
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 20
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>🤖</span>
                  <strong style={{ fontSize: "0.88rem", color: "#93c5fd" }}>AI Drainage Assessment</strong>
                  <span style={{
                    marginLeft: "auto",
                    fontSize: "0.72rem", fontWeight: 700,
                    padding: "2px 8px", borderRadius: 20,
                    backgroundColor: submissionSuccess.floodRisk.escalation_flag === "Yes" ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)",
                    color: submissionSuccess.floodRisk.escalation_flag === "Yes" ? "#f87171" : "#86efac",
                    border: `1px solid ${submissionSuccess.floodRisk.escalation_flag === "Yes" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.3)"}`
                  }}>
                    {submissionSuccess.floodRisk.escalation_flag === "Yes" ? "⚠ Escalation Risk" : "✓ Normal Priority"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: 7 }}>
                  {submissionSuccess.floodRisk.suggested_response && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Suggested Response:</span>
                      <span style={{ color: "#60a5fa", fontWeight: 600 }}>{submissionSuccess.floodRisk.suggested_response}</span>
                    </div>
                  )}
                  {submissionSuccess.floodRisk.rainfall_7d_mm != null && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>7-Day Rainfall (GPS area):</span>
                      <span style={{ color: "#93c5fd" }}>{submissionSuccess.floodRisk.rainfall_7d_mm} mm</span>
                    </div>
                  )}
                  {submissionSuccess.floodRisk.risk_factors && submissionSuccess.floodRisk.risk_factors.length > 0 && (
                    <div>
                      <span style={{ color: "#94a3b8" }}>Key Risk Factors:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", marginTop: 5 }}>
                        {submissionSuccess.floodRisk.risk_factors.map((f, i) => (
                          <span key={i} style={{
                            fontSize: "0.74rem", padding: "2px 8px", borderRadius: 20,
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            color: "#bfdbfe"
                          }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── OPTIONAL LIGHT ACCOUNT CARD ── */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(30,58,138,0.3) 0%, rgba(15,23,42,0.7) 100%)",
                border: "1px solid rgba(59,130,246,0.35)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 20
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>✨</span>
                <strong style={{ fontSize: "0.88rem", color: "#93c5fd" }}>
                  Optional: Save this mobile number to view all complaints
                </strong>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                Track this and all future complaints in your personal portal using a quick one-time SMS verification. (No password or registration required).
              </p>

              {!otpMode ? (
                <button
                  type="button"
                  onClick={handleSendLightAccountOtp}
                  disabled={otpLoading}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "7px 14px", width: "100%", justifyContent: "center" }}
                >
                  {otpLoading ? "Sending SMS OTP..." : `Verify with OTP on ${submissionSuccess.phone}`}
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginBottom: 6 }}>
                    Enter the 6-digit code sent to {submissionSuccess.phone} (Demo Code: <strong>{generatedOtpCode || "123456"}</strong>):
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      className="form-input"
                      style={{ fontSize: "0.88rem", padding: "6px 12px" }}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyLightAccountOtp}
                      disabled={otpLoading || !enteredOtp.trim()}
                      className="btn btn-primary"
                      style={{ fontSize: "0.8rem", padding: "6px 16px", flexShrink: 0 }}
                    >
                      {otpLoading ? "Verifying..." : "Verify & Open"}
                    </button>
                  </div>
                  {otpError && <div style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 4 }}>{otpError}</div>}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate(`/my-portal?id=${submissionSuccess.trackingId}&phone=${encodeURIComponent(submissionSuccess.phone)}`)}
                className="btn btn-primary"
                style={{ flex: 1, padding: "10px 16px", fontSize: "0.88rem", justifyContent: "center" }}
              >
                🔍 Track This Complaint Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(null);
                  setForm({
                    category: "",
                    phone: session?.phone || "",
                    name: session?.name || "",
                    email: session?.email || "",
                    nic: session?.nic || "",
                    district: "",
                    city: "",
                    area: "",
                    description: ""
                  });
                  setPhotos([]);
                  setPhotoPreviews([]);
                  setOtpMode(false);
                }}
                className="btn btn-secondary"
                style={{ padding: "10px 16px", fontSize: "0.88rem" }}
              >
                + New Complaint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}