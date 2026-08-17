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
    label: "Flood & Drainage Issue",
    icon: "🌊",
    image: floodImg,
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(59, 130, 246, 0.4)",
    badgeClass: "badge-flood",
    description: "Waterlogging, river overflow, blocked storm drains, or flash flood risk"
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
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
 
  const queryCat = searchParams.get("category");
  const initialCategory = ISSUE_CATEGORIES.some((c) => c.id === queryCat) ? queryCat : "";
 
  const [form, setForm] = useState({
    category: initialCategory,
    name: "",
    phone: "",
    district: "",
    city: "",
    area: "",
    description: ""
  });
 
  const [categoryDetails, setCategoryDetails] = useState({
    // Flood
    floodDepth: "Knee Deep (1 - 2 ft)",
    drainageStatus: "Blocked Storm Drain / Drain Grate",
    affectedImpact: "Residential Houses & Yard Areas",
    waterEntering: "Yes - Ground Floor Inundated",
 
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
 
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [countdown, setCountdown] = useState(5);
 
  // --- ADDED: AI garbage classification state ---
  const [garbageResult, setGarbageResult] = useState(null);
  const [garbageLoading, setGarbageLoading] = useState(false);
  const [garbageError, setGarbageError] = useState(null);
  const GARBAGE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";
  // --- END ADDED ---
 
  const currentCategory = ISSUE_CATEGORIES.find((c) => c.id === form.category);
 
  useEffect(() => {
    if (!session) {
      navigate("/login");
    }
  }, [session, navigate]);
 
  // Keep form category synced if URL query parameter changes
  useEffect(() => {
    if (queryCat && ISSUE_CATEGORIES.some((c) => c.id === queryCat) && queryCat !== form.category) {
      setForm((prev) => ({ ...prev, category: queryCat }));
    }
  }, [queryCat]);
 
  // --- ADDED: clear AI result if the user switches away from the Garbage category ---
  useEffect(() => {
    if (form.category !== "garbage") {
      setGarbageResult(null);
      setGarbageError(null);
    }
  }, [form.category]);
  // --- END ADDED ---
 
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
 
  // Helper to format category-specific summary string for storage & display
  const getCategorySpecificSummary = () => {
    switch (form.category) {
      case "flood":
        return `Depth: ${categoryDetails.floodDepth} | Cause: ${categoryDetails.drainageStatus} | Zone: ${categoryDetails.affectedImpact} | Water in Houses: ${categoryDetails.waterEntering}`;
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
 
  // Auto-redirect timer to Home page after submission
  useEffect(() => {
    let timer;
    if (submissionSuccess) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate("/");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [submissionSuccess, navigate]);
 
  // GPS Geolocation Handler - Optional Current Location Auto-Detect
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
        setLocationStatus("Unable to retrieve location. Please check browser permissions or type location below.");
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };
 
  // --- ADDED: run the uploaded photo through the AI garbage classifier ---
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
  // --- END ADDED ---
 
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
 
      // --- ADDED: auto-run AI garbage classification, only for the Garbage category ---
      if (form.category === "garbage") {
        classifyGarbagePhoto(file);
      } else {
        setGarbageResult(null);
        setGarbageError(null);
      }
      // --- END ADDED ---
    }
  };

  const handleDetachPhoto = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPhoto(null);
    setPhotoPreview(null);
    setGarbageResult(null);
    setGarbageError(null);
    const fileInput = document.getElementById("photo-upload-input");
    if (fileInput) {
      fileInput.value = "";
    }
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
 
    const trackingId = "CP-" + Math.floor(100000 + Math.random() * 900000);
    const specificSummary = getCategorySpecificSummary();
 
    const data = new FormData();
    Object.keys(form).forEach((key) => {
      data.append(key, form[key]);
    });
    data.append("specific_details", specificSummary);
 
    if (location) {
      data.append("latitude", location.latitude);
      data.append("longitude", location.longitude);
    }
 
    if (photo) {
      data.append("photo", photo);
    }
 
    // Persist ticket details to localStorage for Admin Dashboard
    const newComplaintRecord = {
      id: trackingId,
      tracking_id: trackingId,
      name: form.name,
      phone: form.phone,
      email: session?.email || "guest@civicpulse.local",
      created_by_email: session?.email || "guest@civicpulse.local",
      nic: session?.nic || "",
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
 
    // Persist to localStorage for instant optimistic update on Dashboard
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
      // POST to real backend — get AI triage result
      const response = await submitComplaint(data);
      const serverData = response.data;
 
      // Update localStorage record with server-assigned values
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
              }
            : c
        );
        localStorage.setItem("civic_pulse_user_complaints", JSON.stringify(updated));
      } catch (_) {}
 
      setLoading(false);
      setCountdown(5);
      setSubmissionSuccess({
        trackingId: serverData.tracking_id || trackingId,
        category: form.category,
        severity: serverData.severity || "PENDING",
        priorityScore: serverData.priority_score,
        predictedEscalation: serverData.predicted_escalation,
        isActualDamage: serverData.is_actual_damage,
        mlAnalysis: serverData.ml_analysis,
        status: serverData.status || "Registered",
        categoryLabel: currentCategory.label,
        categoryIcon: currentCategory.icon,
        name: form.name,
        phone: form.phone,
        district: form.district,
        city: form.city,
        area: form.area,
        specificSummary,
        date: new Date().toLocaleString()
      });
    } catch (err) {
      // Backend unreachable — show informative failure instead of fake ML results.
      console.warn("Backend unavailable:", err);
      setLoading(false);
      alert(
        "⚠️ Could not reach the CivicPulse server right now.\n\n" +
        "Your complaint was saved locally, but AI triage needs the server.\n" +
        "Please try again in a moment."
      );
      navigate("/");
    }
  };
 
  const handleRedirectNow = () => {
    navigate("/");
  };
 
  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {!currentCategory && !submissionSuccess ? (
        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: "1.75rem", marginBottom: 8, color: "#f8fafc" }}>Select Complaint Category</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Please select the type of issue you want to report.</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {ISSUE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setSearchParams({ category: cat.id }, { replace: true });
                  setForm(prev => ({ ...prev, category: cat.id }));
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
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.4s ease"
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        fontSize: 18,
                        background: "rgba(11, 17, 32, 0.75)",
                        backdropFilter: "blur(6px)",
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(255, 255, 255, 0.15)"
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
      ) : currentCategory ? (
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    fontSize: "0.85rem",
                    borderRadius: 8,
                    cursor: "pointer"
                  }}
                >
                  ← Back to All Categories
                </button>
                <span className={`category-badge ${currentCategory.badgeClass}`} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <img src={currentCategory.image} alt={currentCategory.label} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                  <span>{currentCategory.icon}</span> {currentCategory.label}
                </span>
              </div>
              <h2 style={{ fontSize: "1.75rem", margin: 0 }}>Lodge Citizen Complaint</h2>
              <p style={{ marginTop: 4, color: "var(--text-muted)" }}>Select issue category and location details for fast municipal action.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSearchParams({ category: val }, { replace: true });
                    setForm((prev) => ({ ...prev, category: val }));
                  } else {
                    setSearchParams({}, { replace: true });
                    setForm((prev) => ({ ...prev, category: "" }));
                  }
                }}
                style={{ fontSize: "0.85rem", padding: "6px 12px", width: "auto", cursor: "pointer" }}
              >
                <option value="">-- Change Category --</option>
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: currentCategory.bg,
                  border: `1px solid ${currentCategory.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  transition: "all 0.3s ease",
                  flexShrink: 0
                }}
              >
                {currentCategory.icon}
              </div>
            </div>
          </div>

 

        {/* Optional GPS Location Auto-Detect Bar */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
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
              <strong style={{ fontSize: "0.95rem", color: "#f8fafc" }}>Use My Current GPS Location (Optional)</strong>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2 }}>
              {locationStatus || "Reporting from the incident site? Click to auto-fill location, or type location manually below."}
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
            {locating ? "🛰️ Detecting..." : location ? "✓ Current Location Synced" : "📍 Auto-Detect My Location"}
          </button>
        </div>
 
        <form onSubmit={handleSubmit}>
          {/* Static Complaint Category Display (Dropdown removed as requested) */}
          <div className="form-group">
            <label className="form-label">
              Category
            </label>
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "var(--bg-input)",
                border: `1px solid ${currentCategory.border}`,
                borderRadius: "var(--radius-md)",
                color: "var(--text-main)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{currentCategory.icon}</span>
                <span style={{ fontSize: "0.98rem" }}>{currentCategory.label}</span>
              </div>
              <span className={`category-badge ${currentCategory.badgeClass}`} style={{ fontSize: "0.75rem" }}>
                Specific Complaint Type
              </span>
            </div>
          </div>
 
          {/* Citizen Details */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Enter your full name"
                value={form.name}
                onChange={handleChange}
                className="form-input"
              />
            </div>
 
            <div className="form-group">
              <label className="form-label">
                Contact Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="Enter contact phone number"
                value={form.phone}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>
 
          {/* Location Details: District, City, and Specific Area */}
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">
                District *
              </label>
              <input
                type="text"
                name="district"
                required
                placeholder="District"
                value={form.district}
                onChange={handleChange}
                className="form-input"
              />
            </div>
 
            <div className="form-group">
              <label className="form-label">
                City / Town *
              </label>
              <input
                type="text"
                name="city"
                required
                placeholder="City / Main Town"
                value={form.city}
                onChange={handleChange}
                className="form-input"
              />
            </div>
 
            <div className="form-group">
              <label className="form-label">
                Specific Area / Suburb *
              </label>
              <input
                type="text"
                name="area"
                required
                placeholder="Specific Area / Suburb"
                value={form.area}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>
 
          {/* DYNAMIC CATEGORY-SPECIFIC FORM FIELDS */}
          <div
            style={{
              backgroundColor: currentCategory.bg,
              border: `1px solid ${currentCategory.border}`,
              borderRadius: 14,
              padding: "20px 22px",
              marginBottom: 24,
              transition: "all 0.3s ease"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                borderBottom: `1px solid ${currentCategory.border}`,
                paddingBottom: 10
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{currentCategory.icon}</span>
                <h3 style={{ fontSize: "1.08rem", margin: 0, color: "var(--text-main)", fontWeight: 700 }}>
                  {currentCategory.label} — Specific Incident Details
                </h3>
              </div>
              <span
                className={`category-badge ${currentCategory.badgeClass}`}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                Category Dynamic Form
              </span>
            </div>
 
            {/* FLOOD SPECIFIC FIELDS */}
            {form.category === "flood" && (
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Water Depth / Flood Level *
                  </label>
                  <select
                    name="floodDepth"
                    value={categoryDetails.floodDepth}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Ankle Deep (< 1 ft)">Ankle Deep (&lt; 1 ft) — Minor</option>
                    <option value="Knee Deep (1 - 2 ft)">Knee Deep (1 - 2 ft) — Moderate</option>
                    <option value="Waist Deep (2 - 4 ft)">Waist Deep (2 - 4 ft) — Severe</option>
                    <option value="Critical Inundation / Submerged Houses (> 4 ft)">
                      Critical Inundation / Submerged Houses (&gt; 4 ft)
                    </option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Primary Drainage Condition *
                  </label>
                  <select
                    name="drainageStatus"
                    value={categoryDetails.drainageStatus}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Blocked Storm Drain / Drain Grate">Blocked Storm Drain / Drain Grate</option>
                    <option value="Canal or River Overflow">Canal or River Overflow</option>
                    <option value="Culvert Blocked by Debris / Trash">Culvert Blocked by Debris / Trash</option>
                    <option value="Inadequate Main Drain Capacity">Inadequate Main Drain Capacity</option>
                    <option value="Flash Flood Surface Runoff">Flash Flood Surface Runoff</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Primary Affected Zone *
                  </label>
                  <select
                    name="affectedImpact"
                    value={categoryDetails.affectedImpact}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Residential Houses & Yard Areas">Residential Houses &amp; Yard Areas</option>
                    <option value="Main Highway / Vehicle Traffic Halted">Main Highway / Vehicle Traffic Halted</option>
                    <option value="Commercial Market / Shops">Commercial Market / Shops</option>
                    <option value="School or Medical Center Access">School or Medical Center Access</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Is Water Entering Buildings/Houses? *
                  </label>
                  <select
                    name="waterEntering"
                    value={categoryDetails.waterEntering}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Yes - Ground Floor Inundated">Yes - Ground Floor Inundated</option>
                    <option value="No - Limited to Roads/Yards">No - Limited to Roads/Yards</option>
                    <option value="Risk Impending (Rising Rapidly)">Risk Impending (Rising Rapidly)</option>
                  </select>
                </div>
              </div>
            )}
 
            {/* GARBAGE & WASTE SPECIFIC FIELDS */}
            {form.category === "garbage" && (
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Waste Dump / Bin Condition *
                  </label>
                  <select
                    name="dumpsterStatus"
                    value={categoryDetails.dumpsterStatus}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Overflowing Municipal Trash Bin">Overflowing Municipal Trash Bin</option>
                    <option value="Illegal Open Waste Dumping Site">Illegal Open Waste Dumping Site</option>
                    <option value="Uncollected Scheduled Household Bags">Uncollected Scheduled Household Bags</option>
                    <option value="Waste Accumulation in Storm Drain/Canal">Waste Accumulation in Storm Drain/Canal</option>
                    <option value="Open Burning Waste Hazard">Open Burning Waste Hazard</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Uncollected Time Duration *
                  </label>
                  <select
                    name="accumulationDuration"
                    value={categoryDetails.accumulationDuration}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="1 - 2 Days">1 - 2 Days</option>
                    <option value="3 - 5 Days">3 - 5 Days</option>
                    <option value="Over 1 Week">Over 1 Week</option>
                    <option value="Chronic Ongoing Dumping Site (> 1 Month)">Chronic Ongoing Dumping Site (&gt; 1 Month)</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Primary Health & Environmental Hazard *
                  </label>
                  <select
                    name="healthHazard"
                    value={categoryDetails.healthHazard}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Severe Foul Odor & Pest Infestation (Flies/Rats)">Severe Foul Odor &amp; Pest Infestation (Flies/Rats)</option>
                    <option value="Blocking Roadway / Sidewalk Access">Blocking Roadway / Sidewalk Access</option>
                    <option value="Stagnant Leachate / Disease Risk">Stagnant Leachate / Disease Risk</option>
                    <option value="Fire & Smoke Danger">Fire &amp; Smoke Danger</option>
                  </select>
                </div>
              </div>
            )}
 
            {/* ROAD DAMAGE SPECIFIC FIELDS */}
            {form.category === "road_damage" && (
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Surface Damage Type *
                  </label>
                  <select
                    name="damageType"
                    value={categoryDetails.damageType}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Deep Pothole / Crater">Deep Pothole / Crater</option>
                    <option value="Asphalt Subsidence / Caved-in Surface">Asphalt Subsidence / Caved-in Surface</option>
                    <option value="Broken / Missing Manhole Cover">Broken / Missing Manhole Cover</option>
                    <option value="Extensive Road Surface Cracking">Extensive Road Surface Cracking</option>
                    <option value="Loose Gravel / Hazardous Debris">Loose Gravel / Hazardous Debris</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Estimated Pothole / Damage Size *
                  </label>
                  <select
                    name="potholeSize"
                    value={categoryDetails.potholeSize}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Small (< 1 foot wide)">Small (&lt; 1 foot wide)</option>
                    <option value="Medium (1 - 3 feet wide)">Medium (1 - 3 feet wide)</option>
                    <option value="Large (> 3 feet / Deep Crater)">Large (&gt; 3 feet / Deep Crater)</option>
                    <option value="Multi-lane Hazardous Stretch">Multi-lane Hazardous Stretch</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Road Type / Classification *
                  </label>
                  <select
                    name="roadClass"
                    value={categoryDetails.roadClass}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Main Arterial Road / Expressway">Main Arterial Road / Expressway</option>
                    <option value="Residential Neighborhood Street">Residential Neighborhood Street</option>
                    <option value="Commercial / Market Area Road">Commercial / Market Area Road</option>
                    <option value="Bridge / Flyover Access Ramp">Bridge / Flyover Access Ramp</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Immediate Hazard / Risk Level *
                  </label>
                  <select
                    name="hazardLevel"
                    value={categoryDetails.hazardLevel}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Vehicle Axle / Tire Damage Reported">Vehicle Axle / Tire Damage Reported</option>
                    <option value="Extreme Hazard for Motorcycles / Bicycles">Extreme Hazard for Motorcycles / Bicycles</option>
                    <option value="Severe Traffic Bottleneck / Congestion">Severe Traffic Bottleneck / Congestion</option>
                    <option value="Pedestrian Trip & Fall Risk">Pedestrian Trip &amp; Fall Risk</option>
                  </select>
                </div>
              </div>
            )}
 
            {/* POWER FAILURE SPECIFIC FIELDS */}
            {form.category === "power_failure" && (
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Extent / Scope of Outage *
                  </label>
                  <select
                    name="outageScope"
                    value={categoryDetails.outageScope}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Single Residential House / Compound">Single Residential House / Compound</option>
                    <option value="Entire Street / Neighborhood Block">Entire Street / Neighborhood Block</option>
                    <option value="Commercial Zone / Industrial Area">Commercial Zone / Industrial Area</option>
                    <option value="Substation Feeder Level Blackout">Substation Feeder Level Blackout</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Observed Electrical Fault *
                  </label>
                  <select
                    name="outageSymptom"
                    value={categoryDetails.outageSymptom}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Total Power Blackout (No Supply)">Total Power Blackout (No Supply)</option>
                    <option value="Single Phase Loss / Voltage Drop">Single Phase Loss / Voltage Drop</option>
                    <option value="Transformer Sparking / Explosion Noise">Transformer Sparking / Explosion Noise</option>
                    <option value="Downed Power Line / Broken Pole">Downed Power Line / Broken Pole</option>
                    <option value="Frequent Intermittent Tripping">Frequent Intermittent Tripping</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Critical Safety Hazard *
                  </label>
                  <select
                    name="criticalDanger"
                    value={categoryDetails.criticalDanger}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Fallen Live Wire on Ground / Tree">Fallen Live Wire on Ground / Tree (High Risk!)</option>
                    <option value="Transformer Fire or Thick Smoke">Transformer Fire or Thick Smoke</option>
                    <option value="Sparking Junction Box on Pole">Sparking Junction Box on Pole</option>
                    <option value="No Immediate Wire Hazard">No Immediate Wire Hazard</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Duration of Current Outage *
                  </label>
                  <select
                    name="outageDuration"
                    value={categoryDetails.outageDuration}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Under 1 Hour">Under 1 Hour</option>
                    <option value="1 - 3 Hours">1 - 3 Hours</option>
                    <option value="3 - 8 Hours">3 - 8 Hours</option>
                    <option value="Over 12 Hours / Overnight">Over 12 Hours / Overnight</option>
                  </select>
                </div>
              </div>
            )}
 
            {/* BROKEN STREET LIGHT SPECIFIC FIELDS */}
            {form.category === "street_light" && (
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Lighting Fault Type *
                  </label>
                  <select
                    name="lightFault"
                    value={categoryDetails.lightFault}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Streetlight Completely Dark / Out">Streetlight Completely Dark / Out</option>
                    <option value="Flickering / Intermittent Bulb">Flickering / Intermittent Bulb</option>
                    <option value="Pole Leaning / Physical Damage">Pole Leaning / Physical Damage</option>
                    <option value="Exposed Wiring / Open Base Box">Exposed Wiring / Open Base Box</option>
                    <option value="Light ON continuously during day">Light ON continuously during day</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Fixtures Affected *
                  </label>
                  <select
                    name="lightsCount"
                    value={categoryDetails.lightsCount}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Single Pole">Single Pole</option>
                    <option value="2 - 4 Poles in Sequence">2 - 4 Poles in Sequence</option>
                    <option value="Entire Street Block / Dark Road">Entire Street Block / Dark Road</option>
                    <option value="Public Park / Community Area">Public Park / Community Area</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Dark Area Security Risk *
                  </label>
                  <select
                    name="securityRisk"
                    value={categoryDetails.securityRisk}
                    onChange={handleDetailChange}
                    className="form-select"
                  >
                    <option value="Dark Alley / High Crime Vulnerability">Dark Alley / High Crime Vulnerability</option>
                    <option value="Busy Pedestrian Crossing / Intersection">Busy Pedestrian Crossing / Intersection</option>
                    <option value="School Zone or Hospital Approach">School Zone or Hospital Approach</option>
                    <option value="Standard Residential Street">Standard Residential Street</option>
                  </select>
                </div>
 
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">
                    Pole ID Tag / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    name="poleTag"
                    placeholder="e.g. SL-104 (printed on pole base)"
                    value={categoryDetails.poleTag}
                    onChange={handleDetailChange}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>
 
          {/* Complaint Description */}
          <div className="form-group">
            <label className="form-label">
              Complaint Description &amp; Details *
            </label>
            <textarea
              name="description"
              required
              rows={4}
              placeholder={`Describe the ${currentCategory.label.toLowerCase()} issue in detail (landmark, street name, hazard level, observed impact)...`}
              value={form.description}
              onChange={handleChange}
              className="form-textarea"
            />
          </div>
 
          {/* Image / Attachment Upload */}
          <div className="form-group">
            <label className="form-label">
              Upload Photo Evidence (Optional)
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
                onChange={handlePhotoChange}
                style={{ display: "none" }}
                id="photo-upload-input"
              />
              <label htmlFor="photo-upload-input" style={{ cursor: "pointer", display: "block" }}>
                {photoPreview ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", maxWidth: 450, margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <img
                        src={photoPreview}
                        alt="Preview"
                        style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover", border: "1px solid #475569" }}
                      />
                      <div style={{ textAlign: "left" }}>
                        <p style={{ fontWeight: 600, color: "#f8fafc", margin: 0, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo?.name || "Image file"}</p>
                        <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                          {photo ? `${(photo.size / 1024).toFixed(1)} KB • ` : ""}Click to change photo
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDetachPhoto}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = "rgba(239, 68, 68, 0.35)";
                        e.target.style.color = "#fca5a5";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "rgba(239, 68, 68, 0.2)";
                        e.target.style.color = "#f87171";
                      }}
                    >
                      ✕ Detach
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📸</div>
                    <p style={{ color: "#f8fafc", fontWeight: 600, margin: 0 }}>Click to attach an image file</p>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>PNG, JPG, or WEBP up to 10MB</p>
                  </div>
                )}
              </label>
            </div>
 
            {/* --- AI Waste Analysis Panel (garbage category only) --- */}

            {/* Loading state */}
            {form.category === "garbage" && garbageLoading && (
              <div
                style={{
                  marginTop: 14,
                  padding: "14px 18px",
                  borderRadius: 12,
                  backgroundColor: "rgba(5, 150, 105, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#6ee7b7",
                  fontSize: "0.88rem"
                }}
              >
                <span style={{ fontSize: 20, animation: "spin 1.2s linear infinite", display: "inline-block" }}>⏳</span>
                <span>🤖 Analysing photo with AI waste classifier…</span>
              </div>
            )}

            {/* Error state */}
            {form.category === "garbage" && garbageError && (
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 16px",
                  borderRadius: 12,
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: "0.85rem"
                }}
              >
                ⚠️ AI classification unavailable: {garbageError}
              </div>
            )}

            {/* Full AI Waste Analysis result */}
            {form.category === "garbage" && garbageResult && garbageResult.all_class_scores && (() => {
              // Derive sorted entries, filter to >= 1% threshold
              const allSorted = Object.entries(garbageResult.all_class_scores)
                .sort(([, a], [, b]) => b - a);
              const otherPredictions = allSorted.filter(
                ([className, score]) => className !== garbageResult.predicted_class && score >= 0.01
              );

              const ScoreRow = ({ className, score, isTop }) => {
                const pct = (score * 100).toFixed(1);
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{
                        fontSize: "0.82rem",
                        color: isTop ? "#a7f3d0" : "#cbd5e1",
                        fontWeight: isTop ? 700 : 500,
                        textTransform: "capitalize"
                      }}>
                        {className}
                      </span>
                      <span style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: isTop ? "#6ee7b7" : "#94a3b8"
                      }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: 4,
                        background: isTop
                          ? "linear-gradient(90deg, #059669, #34d399)"
                          : "linear-gradient(90deg, #334155, #475569)",
                        transition: "width 0.6s ease"
                      }} />
                    </div>
                  </div>
                );
              };

              return (
                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(16, 185, 129, 0.45)",
                    backgroundColor: "rgba(5, 150, 105, 0.07)",
                    boxShadow: "0 4px 24px rgba(5, 150, 105, 0.12)"
                  }}
                >
                  {/* Panel header */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(5, 150, 105, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%)",
                    borderBottom: "1px solid rgba(16, 185, 129, 0.3)",
                    padding: "13px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}>
                    <span style={{ fontSize: 20 }}>🤖</span>
                    <span style={{ fontWeight: 700, fontSize: "0.97rem", color: "#ecfdf5", letterSpacing: "0.01em" }}>
                      AI Waste Analysis
                    </span>
                  </div>

                  <div style={{ padding: "14px 18px 4px" }}>
                    {/* Top prediction */}
                    <div style={{
                      fontSize: "0.75rem",
                      color: "#6ee7b7",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 600,
                      marginBottom: 8
                    }}>
                      Top Prediction
                    </div>
                    <div style={{
                      padding: "10px 12px",
                      borderRadius: 9,
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      marginBottom: 14
                    }}>
                      <ScoreRow
                        className={garbageResult.predicted_class}
                        score={garbageResult.confidence}
                        isTop={true}
                      />
                    </div>

                    {/* Other meaningful predictions */}
                    {otherPredictions.length > 0 && (
                      <>
                        <div style={{
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                          marginBottom: 8
                        }}>
                          Other Possible Predictions
                        </div>
                        {otherPredictions.map(([className, score]) => (
                          <ScoreRow key={className} className={className} score={score} isTop={false} />
                        ))}
                      </>
                    )}
                  </div>

                  {/* Disclaimer note */}
                  <div style={{
                    margin: "10px 18px 14px",
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid rgba(51, 65, 85, 0.6)",
                    fontSize: "0.72rem",
                    color: "#64748b",
                    lineHeight: 1.55
                  }}>
                    ℹ️ These percentages represent the AI model's classification scores. They do not represent the physical quantity or percentage of material in the image.
                  </div>
                </div>
              );
            })()}
            {/* --- END AI Waste Analysis Panel --- */}
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
              marginTop: 12,
              backgroundColor: currentCategory.color,
              borderColor: currentCategory.color
            }}
          >
            {loading ? "Submitting..." : `Submit ${currentCategory.label} Report`}
          </button>
        </form>
        </div>
      ) : null}
 
      {/* Success Modal Pop-up with Auto-Redirect */}
      {submissionSuccess && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: 540,
              width: "100%",
              padding: 36,
              textAlign: "center",
              backgroundColor: "#1e293b",
              borderColor: "#34d399",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "rgba(52, 211, 153, 0.15)",
                border: "2px solid #34d399",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                margin: "0 auto 16px"
              }}
            >
              ✅
            </div>
 
            <h3 style={{ fontSize: "1.75rem", margin: "0 0 8px", color: "#f8fafc" }}>
              Complaint Submitted Successfully!
            </h3>
 
            <p style={{ fontSize: "0.95rem", color: "#94a3b8", marginBottom: 16 }}>
              Your ticket details have been dispatched and added to the Admin Dashboard.
            </p>
 
            <div
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 20,
                fontSize: "0.85rem",
                color: "#60a5fa"
              }}
            >
              🏠 Redirecting to Home Page in <strong>{countdown} seconds...</strong>
            </div>
 
            {/* Complaint Summary Pill */}
            <div
              style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: 16,
                textAlign: "left",
                marginBottom: 24
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>TRACKING REFERENCE</span>
                <strong style={{ color: "#3b82f6", fontSize: "0.9rem" }}>{submissionSuccess.trackingId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>CATEGORY</span>
                <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: "0.88rem" }}>
                  {submissionSuccess.categoryIcon} {submissionSuccess.categoryLabel}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>LOCATION</span>
                <span style={{ color: "#f8fafc", fontSize: "0.88rem" }}>
                  {[submissionSuccess.area, submissionSuccess.city, submissionSuccess.district].filter(Boolean).join(", ")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", flexShrink: 0 }}>SPECIFIC DETAILS</span>
                <span style={{ color: "#cbd5e1", fontSize: "0.82rem", textAlign: "right" }}>
                  {submissionSuccess.specificSummary}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>SUBMITTED AT</span>
                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{submissionSuccess.date}</span>
              </div>
              {/* AI Triage Results */}
              {submissionSuccess.severity && submissionSuccess.severity !== "PENDING" && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e3058" }}>
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    🤖 AI Triage Result
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "4px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 700,
                      background: submissionSuccess.severity === "CRITICAL" ? "rgba(239,68,68,0.18)" : submissionSuccess.severity === "HIGH" ? "rgba(249,115,22,0.18)" : submissionSuccess.severity === "MEDIUM" ? "rgba(234,179,8,0.18)" : "rgba(34,197,94,0.18)",
                      color: submissionSuccess.severity === "CRITICAL" ? "#ef4444" : submissionSuccess.severity === "HIGH" ? "#f97316" : submissionSuccess.severity === "MEDIUM" ? "#eab308" : "#22c55e",
                      border: `1px solid ${submissionSuccess.severity === "CRITICAL" ? "rgba(239,68,68,0.4)" : submissionSuccess.severity === "HIGH" ? "rgba(249,115,22,0.4)" : submissionSuccess.severity === "MEDIUM" ? "rgba(234,179,8,0.4)" : "rgba(34,197,94,0.4)"}`
                    }}>
                      {submissionSuccess.severity} SEVERITY
                    </span>
                    {submissionSuccess.predictedEscalation && (
                      <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, background: "rgba(100,116,139,0.18)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" }}>
                        {submissionSuccess.predictedEscalation === "Likely to Escalate" ? "⚠️" : submissionSuccess.predictedEscalation === "Monitor Closely" ? "👁️" : "✓"} {submissionSuccess.predictedEscalation}
                      </span>
                    )}
                    {submissionSuccess.status && (
                      <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                        {submissionSuccess.status}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {submissionSuccess.category === "road_damage" && submissionSuccess.mlAnalysis && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e3058", textAlign: "left" }}>
                  <div style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: 700, marginBottom: 8 }}>
                    🚗 YOLOv8 Road Damage Detection
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#e2e8f0", marginBottom: 6 }}>
                    Manhole Detected: <strong style={{ color: submissionSuccess.mlAnalysis.manhole_detected ? "#ef4444" : "#94a3b8" }}>
                      {submissionSuccess.mlAnalysis.manhole_detected ? "Yes — Critical Priority" : "No"}
                    </strong>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {submissionSuccess.mlAnalysis.detections.map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#cbd5e1" }}>
                        <span style={{ textTransform: "capitalize" }}>{d.class}</span>
                        <span>{(d.confidence * 100).toFixed(0)}% confidence · {d.severity_tier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
 
            <button
              type="button"
              onClick={handleRedirectNow}
              className="btn btn-primary"
              style={{ width: "100%", backgroundColor: "#2563eb", borderColor: "#2563eb" }}
            >
              Go to Home Page Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}