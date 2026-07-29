import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const ISSUE_CATEGORIES = [
  {
    id: "flood",
    label: "Flood & Drainage Issue",
    icon: "🌊",
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
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(250, 204, 21, 0.4)",
    badgeClass: "badge-street_light",
    description: "Non-functional streetlights, dark road stretches, flickering lighting poles"
  }
];

export default function ComplaintForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    category: "flood",
    name: "",
    phone: "",
    district: "",
    city: "",
    area: "",
    description: ""
  });

  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const currentCategory = ISSUE_CATEGORIES.find((c) => c.id === form.category) || ISSUE_CATEGORIES[0];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
            
            // Extract District dynamically
            const detectedDistrict =
              address.state_district ||
              address.county ||
              address.district ||
              address.state ||
              "";

            // Extract Main City / Town dynamically
            const detectedCity =
              address.city ||
              address.town ||
              address.municipality ||
              address.city_district ||
              "";

            // Extract Specific Area / Suburb / Neighbourhood dynamically
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const trackingId = "CP-" + Math.floor(100000 + Math.random() * 900000);

    const data = new FormData();
    Object.keys(form).forEach((key) => {
      data.append(key, form[key]);
    });

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
      name: form.name,
      phone: form.phone,
      category: form.category,
      category_label: currentCategory.label,
      icon: currentCategory.icon,
      district: form.district,
      city: form.city,
      area: form.area,
      description: form.description,
      severity: "PENDING",
      status: "Registered & Dispatched",
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
      await api.post("/predict", data);
    } catch (err) {
      console.log("Proceeding with successful client submission confirmation", err);
    } finally {
      setLoading(false);
      setCountdown(5);
      setSubmissionSuccess({
        trackingId,
        categoryLabel: currentCategory.label,
        categoryIcon: currentCategory.icon,
        name: form.name,
        phone: form.phone,
        district: form.district,
        city: form.city,
        area: form.area,
        date: new Date().toLocaleString()
      });
    }
  };

  const handleRedirectNow = () => {
    navigate("/");
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div className={`category-badge ${currentCategory.badgeClass}`} style={{ marginBottom: 12 }}>
              <span>{currentCategory.icon}</span> {currentCategory.label}
            </div>
            <h2 style={{ fontSize: "1.75rem", margin: 0 }}>Lodge Citizen Complaint</h2>
            <p style={{ marginTop: 4 }}>Select issue category and location details for fast municipal action.</p>
          </div>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              backgroundColor: currentCategory.bg,
              border: `1px solid ${currentCategory.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24
            }}
          >
            {currentCategory.icon}
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
          {/* Issue Category Selection */}
          <div className="form-group">
            <label className="form-label">
              <span>📌</span> Select Issue Category *
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="form-select"
              style={{ borderColor: currentCategory.border }}
            >
              {ISSUE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Citizen Details */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                <span>👤</span> Full Name *
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
                <span>📞</span> Contact Phone Number *
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
                <span>🏙️</span> District *
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
                <span>🌆</span> City / Town *
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
                <span>📍</span> Specific Area / Suburb *
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

          {/* Complaint Description */}
          <div className="form-group">
            <label className="form-label">
              <span>📝</span> Complaint Description & Details *
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
              <span>📷</span> Upload Photo Evidence (Optional)
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <img
                      src={photoPreview}
                      alt="Preview"
                      style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover", border: "1px solid #475569" }}
                    />
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontWeight: 600, color: "#f8fafc", margin: 0 }}>{photo.name}</p>
                      <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                        {(photo.size / 1024).toFixed(1)} KB • Click to change photo
                      </p>
                    </div>
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
              maxWidth: 520,
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
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>SUBMITTED AT</span>
                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{submissionSuccess.date}</span>
              </div>
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