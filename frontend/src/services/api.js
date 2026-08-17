import axios from "axios";

const api = axios.create({
  baseURL: "/", // Use proxy
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add error interceptor for better debugging
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    return Promise.reject(error);
  }
);

// ML Service API (Python/FastAPI) - for direct AI service calls
const mlApi = axios.create({
  baseURL: "http://127.0.0.1:8001",
  timeout: 15000,
});

// Export ML API for direct access to AI services
export { mlApi };

// Add ML service direct access functions
export const mlService = {
  predictGarbage: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await mlApi.post("/predict-garbage", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },
  
  predictRoadDamage: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await mlApi.post("/analyze-road-damage", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },

  getFloodRisk: async (data) => {
    const response = await mlApi.post("/predict-from-complaint", data);
    return response.data;
  }
};

// Authentication API
export const authService = {
  register: async (userData) => {
    const response = await api.post("/register", userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post("/login", credentials);
    return response.data;
  },

  requestOtp: async (email) => {
    const response = await api.post("/otp/request", { email });
    return response.data;
  },

  getUser: async (userId) => {
    const response = await api.get(`/user/${userId}`);
    return response.data;
  }
};

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