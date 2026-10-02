import express from "express";
import { searchMusic } from "../services/youtube.service.js";

const router = express.Router();

router.get("/search", async (req, res) => {
  try {
    const { q, pageToken } = req.query;

    const result = await searchMusic(q, pageToken);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;