import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const baseURL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url ?? "");
    const isAuthProbe = reqUrl.includes("/api/auth/me");
    const isLoginAttempt =
      reqUrl.includes("/api/auth/login") || reqUrl.includes("/api/auth/login/microsoft/callback");

    if (status === 401 && !isLoginAttempt) {
      useAuthStore.getState().clearUser();
      if (!isAuthProbe && typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);
