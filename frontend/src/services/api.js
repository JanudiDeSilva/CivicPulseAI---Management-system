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

// Fetch all detected duplicate incidents (combined complaints)
export const fetchIncidents = () =>
  api.get("/duplicate-incidents");

// Submit a new complaint
export const submitComplaint = (formData) =>
  api.post("/predict", formData);

// Update a report's status
export const updateReportStatus = (reportId, status) =>
  api.patch(`/reports/${reportId}/status`, { status });

// Send admin reply to a report
export const updateReportReply = (reportId, reply) =>
  api.patch(`/reports/${reportId}/reply`, { reply });

// Send the same admin reply to ALL reports in a duplicate incident group
export const updateIncidentReply = (incidentId, reply) =>
  api.post(`/incidents/${incidentId}/reply`, { reply });

// Fetch a single report by id or tracking id
export const fetchReport = (reportId) =>
  api.get(`/reports/${reportId}`);

// Batch sync status + admin replies for user portal polling
export const syncReports = (identifiers) =>
  api.post("/reports/sync", { identifiers });

export default api;