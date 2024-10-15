import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://127.0.0.1/:5173" },
});

io.on("connection", (socket) => {
  console.log(`new client connected `, socket.id);

  socket.on("message", (message) => {
    socket.broadcast.emit("message", message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });
});
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
