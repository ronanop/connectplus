import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;

    if (status === 401) {
      useAuthStore.getState().clearUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);
