import express from "express";
import { searchMusic } from "../services/youtube.service.js";
import { sendServerError } from "../utils/httpError.js";

const router = express.Router();

router.get("/search", async (req, res) => {
  try {
    const { q, pageToken } = req.query;

    if (typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json({
        message: "Query pencarian minimal 2 karakter",
      });
    }

    const result = await searchMusic(
      q,
      typeof pageToken === "string" ? pageToken : ""
    );

    res.json(result);
  } catch (error) {
    sendServerError(res, error, "Gagal mencari video di YouTube");
  }
});

export default router;