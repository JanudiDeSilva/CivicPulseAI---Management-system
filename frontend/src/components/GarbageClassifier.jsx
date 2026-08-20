import { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8001";

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

  const handleDetach = () => {
    setPreview(null);
    setResult(null);
    setError(null);

    const fileInput = document.querySelector(
      'input[type="file"]'
    );

    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Convert class name to nice display text
  const formatClassName = (name) => {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  // Get scores and sort highest → lowest
  const sortedScores = result?.all_class_scores
    ? Object.entries(result.all_class_scores)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    : [];

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Report Garbage Accumulation</h2>

      {/* Upload */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Image Preview */}
      {preview && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={handleDetach}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Detach
            </button>
          </div>

          <img
            src={preview}
            alt="Garbage preview"
            style={{
              width: "100%",
              maxHeight: 300,
              objectFit: "contain",
              marginTop: 10,
              borderRadius: 10,
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 8,
            background: "rgba(37, 99, 235, 0.12)",
            color: "#93c5fd",
          }}
        >
          🤖 Analyzing image with AI...
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#f87171",
          }}
        >
          ⚠️ AI analysis unavailable: {error}
        </div>
      )}

      {/* AI Result */}
      {result && !error && (
        <div
          style={{
            marginTop: 18,
            padding: 18,
            background: "#0f1b2d",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            borderRadius: 12,
            color: "#e5e7eb",
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            🤖 AI Waste Analysis
          </div>

          {/* Primary Detection */}
          <div
            style={{
              padding: 15,
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.10)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                color: "#94a3b8",
                marginBottom: 5,
              }}
            >
              PRIMARY DETECTION
            </div>

            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              ♻️ {formatClassName(result.predicted_class)}
            </div>

            <div
              style={{
                marginTop: 5,
                color: "#34d399",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              {(result.confidence * 100).toFixed(1)}% confidence
            </div>
          </div>

          {/* All Class Scores */}
          {sortedScores.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                Model Scores
              </div>

              {sortedScores.map(([className, score]) => {
                const percentage = score * 100;

                return (
                  <div
                    key={className}
                    style={{
                      marginBottom: 13,
                    }}
                  >
                    {/* Label + Percentage */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "#cbd5e1",
                        }}
                      >
                        {formatClassName(className)}
                      </span>

                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color:
                            className === result.predicted_class
                              ? "#60a5fa"
                              : "#94a3b8",
                        }}
                      >
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: 7,
                        background: "#1e293b",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            percentage,
                            100
                          )}%`,
                          height: "100%",
                          background:
                            className === result.predicted_class
                              ? "#3b82f6"
                              : "#64748b",
                          borderRadius: 10,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Explanation */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid rgba(148, 163, 184, 0.15)",
              fontSize: "0.75rem",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            ℹ️ These percentages represent the AI model's
            classification scores. They indicate how strongly the
            model associates the image with each waste category;
            they do not represent the physical percentage or
            quantity of each material in the image.
          </div>
        </div>
      )}
    </div>
  );
}

export default GarbageClassifier;