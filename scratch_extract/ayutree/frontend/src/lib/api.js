import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach bearer token from localStorage as a fallback for cross-origin cookies
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ayu_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export function formatErr(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const formatInr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 250'><rect width='100%25' height='100%25' fill='%23F3EFE6'/><g fill='%23C2A878'><circle cx='100' cy='100' r='14'/><path d='M70 150 Q100 110 130 150 T190 150 V250 H10 V150 Q40 110 70 150z'/></g></svg>";

export const safeImg = (src) => (src && src.trim() !== "" ? src : PLACEHOLDER_IMG);
