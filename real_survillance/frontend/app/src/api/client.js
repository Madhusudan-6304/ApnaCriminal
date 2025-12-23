import axios from "axios";

// Vite env
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 30000,
});

// helpers to manage Authorization header globally
export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common["Authorization"];
  }
}

export function clearAuthToken() {
  delete client.defaults.headers.common["Authorization"];
}

// On module load: if a token already exists in localStorage (page refresh case),
// use it so axios already sends Authorization on first request.
try {
  const saved = localStorage.getItem("token");
  if (saved) {
    setAuthToken(saved);
  }
} catch (e) {
  // localStorage may be unavailable in some environments — ignore
  // (no-op)
}

export default client;
