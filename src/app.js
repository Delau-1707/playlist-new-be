import express from "express";
import cors from "cors";

import youtubeRoutes from "./routes/youtube.routes.js";
import audiusRoutes from "./routes/audius.routes.js";
import historyRoutes from "./routes/history.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";
import { sendServerError } from "./utils/httpError.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Izinkan request tanpa origin (Postman, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const allowed = [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://playlist-new.vercel.app",
        "https://playlist-new-be.vercel.app",
      ].filter(Boolean);

      const isVercelPreview =
        /^https:\/\/playlist-new[a-z0-9-]*\.vercel\.app$/.test(
          origin
        );

      if (allowed.includes(origin) || isVercelPreview) {
        return callback(null, true);
      }

      return callback(new Error(`Origin tidak diizinkan: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    message: "Backend berjalan",
  });
});

app.use("/api/youtube", youtubeRoutes);
app.use("/api/audius", audiusRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/playlist", playlistRoutes);

// Route /api yang tidak dikenal -> balas JSON, bukan halaman HTML bawaan.
app.use((req, res) => {
  res.status(404).json({
    message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler terakhir. Tanpa ini Express membalas HTML untuk body JSON yang
// rusak atau error tak terduga, sehingga frontend yang mengharapkan JSON gagal
// membaca pesannya.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);

  const isBadJson =
    error.type === "entity.parse.failed" ||
    error instanceof SyntaxError;

  if (isBadJson) {
    return res.status(400).json({
      message: "Body JSON tidak valid",
    });
  }

  sendServerError(res, error);
});

export default app;