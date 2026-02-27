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

  // Simple in-memory lobby for discovery
  // Note: On Vercel, this is per-instance and ephemeral.
  // For a real production app, use Redis or a database.
  const lobby: Record<string, { peers: Set<string>, lastUpdate: number }> = {};

  app.use(express.json());

  app.post("/api/announce", (req, res) => {
    const { peerId, room } = req.body;
    if (!lobby[room]) {
      lobby[room] = { peers: new Set(), lastUpdate: Date.now() };
    }
    lobby[room].peers.add(peerId);
    lobby[room].lastUpdate = Date.now();
    res.json({ success: true });
  });

  app.get("/api/peers", (req, res) => {
    const room = (req.query.room as string) || "global";
    const peers = lobby[room] ? Array.from(lobby[room].peers) : [];
    res.json({ peers });
  });

  // Cleanup old rooms
  setInterval(() => {
    const now = Date.now();
    Object.keys(lobby).forEach(room => {
      if (now - lobby[room].lastUpdate > 60000) { // 1 minute inactivity
        delete lobby[room];
      }
    });
  }, 30000);

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
