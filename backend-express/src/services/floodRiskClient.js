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

    const response = await fetch(`${ML_SERVICE_URL}/analyze-road-damage`, {
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

/**
 * Predicts priority/severity score for a complaint using the ML service.
 */
export async function predictPriority({
  category,
  raw_text,
  specific_details,
  district,
  district_flood_risk,
  has_photo,
  image_analysis_score,
}) {
  try {
    const { data } = await axios.post(
      `${ML_SERVICE_URL}/predict-priority`,
      {
        category,
        raw_text,
        specific_details: specific_details || "",
        district: district || "",
        district_flood_risk: district_flood_risk || 0,
        has_photo: !!has_photo,
        image_analysis_score: image_analysis_score || 0,
      },
      { timeout: 6000 }
    );
    return data;
  } catch (err) {
    console.error("Priority prediction service error:", err.message);
    return { error: "Could not reach AI priority service", detail: err.message };
  }
}

/**
 * Detects if a complaint is a duplicate of an existing incident.
 */
export async function detectDuplicate({
  complaint_id,
  category,
  raw_text,
  specific_details,
  register = true,
}) {
  try {
    const { data } = await axios.post(
      `${ML_SERVICE_URL}/detect-duplicate`,
      {
        complaint_id,
        category,
        raw_text,
        specific_details: specific_details || "",
        register,
      },
      { timeout: 6000 }
    );
    return data;
  } catch (err) {
    console.error("Duplicate detection service error:", err.message);
    return { error: "Could not reach AI duplicate service", detail: err.message };
  }
}

/**
 * Fetch all detected incidents (duplicate clusters).
 */
export async function fetchIncidents() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/incidents`, { timeout: 3000 });
    return data;
  } catch (err) {
    console.error("Incidents fetch error:", err.message);
    return { incidents: [] };
  }
}
