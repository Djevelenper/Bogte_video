import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io logic for signaling
  // We'll use a single room for everyone for this "instant" app
  const ROOM_ID = "global-room";

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", () => {
      socket.join(ROOM_ID);
      // Notify others that a new user joined
      socket.to(ROOM_ID).emit("user-joined", socket.id);
      
      // Send the list of existing users to the new user
      const clients = io.sockets.adapter.rooms.get(ROOM_ID);
      const users = clients ? Array.from(clients).filter(id => id !== socket.id) : [];
      socket.emit("all-users", users);
    });

    socket.on("signal", (data: { to: string; signal: any }) => {
      // Relay signaling data (offer, answer, ice-candidate) to a specific user
      io.to(data.to).emit("signal", {
        from: socket.id,
        signal: data.signal
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      socket.to(ROOM_ID).emit("user-left", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
