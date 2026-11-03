import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

api.interceptors.request.use((config) => {
  const token =
    typeof localStorage === "undefined"
      ? null
      : localStorage.getItem("kurio.session");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

