import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 15000,
});

// Fetch all reports (with optional filters)
export const fetchReports = (params = {}) =>
  api.get("/reports", { params });

// Fetch aggregated stats
export const fetchStats = () =>
  api.get("/stats");

// Fetch map pins (reports with GPS)
export const fetchMapPins = () =>
  api.get("/map-pins");

// Submit a new complaint
export const submitComplaint = (formData) =>
  api.post("/predict", formData);

// Update a report's status
export const updateReportStatus = (reportId, status) => {
  const fd = new FormData();
  fd.append("status", status);
  return api.patch(`/reports/${reportId}/status`, fd);
};

export default api;