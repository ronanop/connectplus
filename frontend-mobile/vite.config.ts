import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const certPath = path.resolve(__dirname, "../.certs/dev-cert.pem");
const keyPath = path.resolve(__dirname, "../.certs/dev-key.pem");

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
    port: 3001,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
