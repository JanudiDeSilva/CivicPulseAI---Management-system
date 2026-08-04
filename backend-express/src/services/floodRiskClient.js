import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";

/**
 * Calls the ML microservice using only what a citizen complaint form provides
 * (district, place_name, GPS). The Python side fills in the rest from the
 * district lookup table + live rainfall.
 */
export async function getFloodRiskFromComplaint({ district, place_name, latitude, longitude }) {
  if (!district) return null; // model needs at least a district to look anything up

  try {
    const { data } = await axios.post(
      `${ML_SERVICE_URL}/predict-from-complaint`,
      { district, place_name, latitude, longitude },
      { timeout: 6000 }
    );

    if (data.error) {
      console.warn("Flood risk lookup warning:", data.error);
      return null;
    }

    return data; // { flood_occurrence, flood_probability, risk_level, confidence }
  } catch (err) {
    console.error("ML service unreachable:", err.message);
    return null; // caller must handle a null result gracefully
  }
}