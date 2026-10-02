import express from "express";
import cors from "cors";

import youtubeRoutes from "./routes/youtube.routes.js";
import audiusRoutes from "./routes/audius.routes.js";
import historyRoutes from "./routes/history.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

export default app;