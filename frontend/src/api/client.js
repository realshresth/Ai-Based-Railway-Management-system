import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rrms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Message to show on screen for a failed request (includes the server's "detail" when present).
export function errMsg(err, fallback) {
  const d = err.response?.data;
  if (d?.error) return d.detail ? `${d.error} ${d.detail}` : d.error;
  if (err.request) return "Couldn't reach the server. Is the backend running?";
  return fallback;
}

export default api;
