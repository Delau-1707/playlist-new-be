import express from "express";
import { sql } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({
        message: "clientId wajib diisi",
      });
    }

    const history = await sql`
      SELECT
        id,
        source,
        source_id,
        title,
        artist,
        thumbnail_url,
        watched_at
      FROM listening_history
      WHERE client_id = ${clientId}
      ORDER BY watched_at DESC
      LIMIT 100
    `;

    res.json({
      items: history,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { clientId, source, sourceId, title, artist, thumbnail } = req.body;

    if (!clientId || !source || !sourceId || !title) {
      return res.status(400).json({
        message: "clientId, source, sourceId dan title wajib diisi",
      });
    }

    if (!["youtube", "audius"].includes(source)) {
      return res.status(400).json({
        message: "Source tidak valid",
      });
    }

    const [item] = await sql`
      INSERT INTO listening_history (
        client_id,
        source,
        source_id,
        title,
        artist,
        thumbnail_url
      )
      VALUES (
        ${clientId},
        ${source},
        ${sourceId},
        ${title},
        ${artist || null},
        ${thumbnail || null}
      )
      RETURNING *
    `;

    res.status(201).json({
      item,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({
        message: "clientId wajib diisi",
      });
    }

    // id di URL selalu string. Kolomnya BIGSERIAL, jadi kirim nilai non-angka
    // langsung ke query akan memicu error Postgres (500). Validasi dulu
    // supaya balasannya 400 yang jelas.
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: "id tidak valid",
      });
    }

    await sql`
      DELETE FROM listening_history
      WHERE id = ${id}
        AND client_id = ${clientId}
    `;

    res.json({
      message: "History berhasil dihapus",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;
