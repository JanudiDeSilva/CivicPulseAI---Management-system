import { useEffect, useState } from "react";
import { fetchMapPins } from "../services/api";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const CATEGORY_COLORS = {
  flood:         "#3b82f6",
  road_damage:   "#f59e0b",
  garbage:       "#10b981",
  power_failure: "#8b5cf6",
  street_light:  "#eab308",
};

const SEVERITY_RADIUS = {
  CRITICAL: 14,
  HIGH:     10,
  MEDIUM:   7,
  LOW:      5,
  PENDING:  5,
};

const SEVERITY_OPACITY = {
  CRITICAL: 0.9,
  HIGH:     0.75,
  MEDIUM:   0.6,
  LOW:      0.5,
  PENDING:  0.4,
};

function PulseFitBounds({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length > 0) {
      const bounds = pins.map((p) => [p.latitude, p.longitude]);
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 }); }
      catch (_) {}
    }
  }, [pins, map]);
  return null;
}

/** Leaflet needs invalidateSize after the container becomes visible / resizes. */
function MapResizeFix({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
    });
    return () => cancelAnimationFrame(id);
  }, [map, trigger]);
  return null;
}

export default function MapView() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const DEFAULT_CENTER = [7.8731, 80.7718];
  const DEFAULT_ZOOM = 7;

  const loadPins = () => {
    setLoading(true);
    setError(null);
    fetchMapPins()
      .then((res) => {
        setPins(res.data.pins || []);
      })
      .catch((err) => {
        console.error("Map pins fetch failed:", err);
        setError("Could not load map pins. The map is still visible — try refreshing pins.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPins();
  }, []);

  const pinsWithCoords = pins.filter(
    (p) => p.latitude != null && p.longitude != null &&
           !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const showEmptyOverlay = !loading && !error && pinsWithCoords.length === 0;

  return (
    <div className="map-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16 }}>
      {/* Header */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid #1e3058", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>🗺️ Live Incident Map</h3>
          <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {loading ? "Loading pins…" : `${pinsWithCoords.length} geotagged report${pinsWithCoords.length !== 1 ? "s" : ""} visible`}
          </p>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "capitalize" }}>
                {cat.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 22px",
          background: "rgba(239,68,68,0.12)",
          borderBottom: "1px solid rgba(239,68,68,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#fca5a5" }}>{error}</p>
          <button
            type="button"
            onClick={loadPins}
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "5px 12px", flexShrink: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Map — always mounted so Leaflet tiles stay visible */}
      <div style={{ position: "relative", height: 440 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%", background: "#0b1120" }}
          zoomControl={true}
        >
          <MapResizeFix trigger={loading} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {pinsWithCoords.length > 0 && <PulseFitBounds pins={pinsWithCoords} />}

          {pinsWithCoords.map((pin) => {
            const color = CATEGORY_COLORS[pin.category] || "#94a3b8";
            const radius = SEVERITY_RADIUS[pin.severity] || 6;
            const opacity = SEVERITY_OPACITY[pin.severity] || 0.5;

            return (
              <CircleMarker
                key={pin.id}
                center={[pin.latitude, pin.longitude]}
                radius={radius}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: opacity,
                  weight: pin.severity === "CRITICAL" ? 2.5 : 1.5,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontFamily: "Inter, sans-serif" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: "0.9rem" }}>
                      {pin.icon} {pin.tracking_id || pin.id?.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: "0.8rem", marginBottom: 3 }}>
                      <strong>Category:</strong> {pin.category?.replace("_", " ")}
                    </div>
                    <div style={{ fontSize: "0.8rem", marginBottom: 3 }}>
                      <strong>Severity:</strong>{" "}
                      <span style={{ color: pin.severity === "CRITICAL" ? "#ef4444" : pin.severity === "HIGH" ? "#f97316" : "#94a3b8", fontWeight: 700 }}>
                        {pin.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", marginBottom: 3 }}>
                      <strong>Status:</strong> {pin.status}
                    </div>
                    {(pin.area || pin.city) && (
                      <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 4 }}>
                        📍 {[pin.area, pin.city, pin.district].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {showEmptyOverlay && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(11,17,32,0.55)", pointerEvents: "none",
          }}>
            <div style={{ textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
              <p style={{ margin: 0 }}>No geotagged reports yet.</p>
              <p style={{ fontSize: "0.8rem", margin: "4px 0 0" }}>Submit a complaint with GPS location to see pins.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
