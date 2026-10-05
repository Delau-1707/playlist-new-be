import express from "express";
import { Readable } from "node:stream";

import { searchAudius } from "../services/audius.service.js";

const router = express.Router();


router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json({
        message: "Query pencarian minimal 2 karakter",
      });
    }

    const items = await searchAudius(q);

    res.json({
      items,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});


router.get("/stream/:trackId", async (req, res) => {
  try {
    const { trackId } = req.params;

    if (!trackId) {
      return res.status(400).json({
        message: "trackId wajib diisi",
      });
    }

    if (!process.env.AUDIUS_BEARER_TOKEN) {
      return res.status(500).json({
        message: "AUDIUS_BEARER_TOKEN belum diatur",
      });
    }

    const url =
      `https://api.audius.co/v1/tracks/` +
      `${encodeURIComponent(trackId)}/stream`;

    const response = await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${process.env.AUDIUS_BEARER_TOKEN}`,
      },
    });

    if (!response.ok || !response.body) {
      return res.status(response.status || 500).json({
        message: "Gagal mengambil audio dari Audius",
      });
    }

    const contentType =
      response.headers.get("content-type");

    const contentLength =
      response.headers.get("content-length");

    if (contentType) {
      res.setHeader(
        "Content-Type",
        contentType
      );
    }

    if (contentLength) {
      res.setHeader(
        "Content-Length",
        contentLength
      );
    }

    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );

    const nodeStream = Readable.fromWeb(
      response.body
    );

    nodeStream.on("error", (error) => {
      console.error(error);

      if (!res.headersSent) {
        res.status(500).json({
          message: "Gagal melakukan streaming Audius",
        });

        return;
      }

      res.destroy(error);
    });

    res.on("close", () => {
      nodeStream.destroy();
    });

    nodeStream.pipe(res);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal melakukan streaming Audius",
    });
  }
});


export default router;