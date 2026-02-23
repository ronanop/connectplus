import { config } from "dotenv";
config();

import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { registerPresalesCron } from "./utils/presalesCron";

const initialPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
let currentPort = initialPort;

const server = http.createServer(app);
registerPresalesCron();
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on("connection", () => {
  // socket connections will be wired later
});

const startServer = (port: number): void => {
  server.listen(port, () => {
    console.log(`Backend API running on port ${port}`);
  });
};

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = currentPort + 1;
    console.error(`Port ${currentPort} is in use, retrying on port ${nextPort}...`);
    currentPort = nextPort;
    startServer(currentPort);
  } else {
    console.error("Server error:", error);
    process.exit(1);
  }
});

startServer(currentPort);
