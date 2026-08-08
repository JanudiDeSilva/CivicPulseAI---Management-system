import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function GarbageClassifier() {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/predict-garbage`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Failed to classify image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2>Report Garbage Accumulation</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {preview && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setPreview(null);
                setResult(null);
                setError(null);
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                  fileInput.value = "";
                }
              }}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: "0.75rem",
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
          <img
            src={preview}
            alt="preview"
            style={{ maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
          />
        </div>
      )}

      {loading && <p>Classifying image...</p>}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: 12, padding: 12, background: "#f4f4f4", borderRadius: 8 }}>
          <p>
            <strong>Detected type:</strong> {result.predicted_class}
          </p>
          <p>
            <strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}

export default GarbageClassifier;