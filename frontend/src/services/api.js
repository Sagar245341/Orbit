import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("orbit_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getApiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const location = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
      const message = typeof item.msg === "string" ? item.msg : "Invalid value";
      return location ? `${location}: ${message}` : message;
    }).join("; ");
  }
  if (typeof detail?.message === "string") return detail.message;
  if (error?.code === "ECONNABORTED") return "The request timed out. Please try again.";
  if (!error?.response) return "Could not reach the chat server. Check your connection and try again.";
  return `Request failed (${error.response.status}). Please try again.`;
}
