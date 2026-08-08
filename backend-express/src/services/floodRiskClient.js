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

export async function predictGarbage(fileBuffer, originalname, mimetype) {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimetype || "image/jpeg" });
    formData.append("file", blob, originalname || "garbage.jpg");

    const response = await fetch(`${ML_SERVICE_URL}/predict-garbage`, {
      method: "POST",
      body: formData,
    });
    return await response.json();
  } catch (err) {
    console.error("ML garbage service error:", err.message);
    return { error: "Could not reach AI classification service", detail: err.message };
  }
}

export async function predictRoadDamage(fileBuffer, originalname, mimetype, category) {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimetype || "image/jpeg" });
    formData.append("file", blob, originalname || "roaddamage.jpg");
    formData.append("category", category || "pothole");

    const response = await fetch(`${ML_SERVICE_URL}/predict-road-damage`, {
      method: "POST",
      body: formData,
    });
    return await response.json();
  } catch (err) {
    console.error("ML road damage service error:", err.message);
    return { error: "Could not reach AI classification service", detail: err.message };
  }
}

export async function getGarbageModelStatus() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/garbage-model-status`, { timeout: 3000 });
    return data;
  } catch (err) {
    return { model_loaded: false, load_error: err.message };
  }
}

export async function getRoadDamageModelStatus() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/road-damage-model-status`, { timeout: 3000 });
    return data;
  } catch (err) {
    return { model_loaded: false, load_error: err.message };
  }
}