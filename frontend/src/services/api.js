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
export const updateReportStatus = (reportId, status) =>
  api.patch(`/reports/${reportId}/status`, { status });

// Send admin reply to a report
export const updateReportReply = (reportId, reply) =>
  api.patch(`/reports/${reportId}/reply`, { reply });

// Fetch a single report by id or tracking id
export const fetchReport = (reportId) =>
  api.get(`/reports/${reportId}`);

// Batch sync status + admin replies for user portal polling
export const syncReports = (identifiers) =>
  api.post("/reports/sync", { identifiers });

// Track single complaint as guest (ID + Phone)
export const trackGuestComplaint = (tracking_id, phone) =>
  api.post("/reports/track-guest", { tracking_id, phone });

// Fetch complaints by phone number (for OTP authenticated light accounts)
export const fetchReportsByPhone = (phone) =>
  api.get(`/reports/by-phone/${encodeURIComponent(phone)}`);

// Delete a report
export const deleteComplaint = (reportId) =>
  api.delete(`/reports/${reportId}`);

export default api;