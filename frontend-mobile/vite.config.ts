import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const certPath = path.resolve(__dirname, "../.certs/dev-cert.pem");
const keyPath = path.resolve(__dirname, "../.certs/dev-key.pem");
const hasDevCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "#leave-deps": path.resolve(__dirname, "src/leavePageDeps.ts"),
      "#reimbursement-deps": path.resolve(__dirname, "src/reimbursementPageDeps.ts"),
      "@leaves-ui": path.resolve(__dirname, "../frontend/src/shared/leaves/LeavesPageContent.tsx"),
      "@reimbursement-ui": path.resolve(__dirname, "../frontend/src/shared/reimbursement/ReimbursementPageContent.tsx"),
      "@meeting-rooms-ui": path.resolve(__dirname, "../frontend/src/shared/meetingRooms/MeetingRoomsPageContent.tsx"),
      "#meeting-rooms-deps": path.resolve(__dirname, "src/meetingRoomsPageDeps.ts"),
    },
  },
  server: {
    host: true,
    ...(hasDevCerts
      ? {
          https: {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          },
        }
      : {}),
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
