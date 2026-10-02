import express from "express";
import { sql } from "../db.js";

const router = express.Router();


async function getOrCreatePlaylist(clientId) {
  const existing = await sql`
    SELECT
      id,
      client_id,
      name
    FROM playlists
    WHERE client_id = ${clientId}
      AND name = 'My Playlist'
    LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0];
  }

  const [playlist] = await sql`
    INSERT INTO playlists (
      client_id,
      name
    )
    VALUES (
      ${clientId},
      'My Playlist'
    )
    RETURNING
      id,
      client_id,
      name
  `;

  return playlist;
}


router.get("/", async (req, res) => {
  try {
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({
        message: "clientId wajib diisi",
      });
    }

    const playlist =
      await getOrCreatePlaylist(clientId);

    const items = await sql`
      SELECT
        id,
        source,
        source_id,
        title,
        artist,
        thumbnail_url,
        created_at
      FROM playlist_items
      WHERE playlist_id = ${playlist.id}
      ORDER BY created_at DESC
    `;

    res.json({
      playlist,
      items,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});


router.post("/items", async (req, res) => {
  try {
    const {
      clientId,
      source,
      sourceId,
      title,
      artist,
      thumbnail,
    } = req.body;

    if (
      !clientId ||
      !source ||
      !sourceId ||
      !title
    ) {
      return res.status(400).json({
        message: "Data lagu belum lengkap",
      });
    }

    if (
      !["youtube", "audius"].includes(source)
    ) {
      return res.status(400).json({
        message: "Source tidak valid",
      });
    }

    const playlist =
      await getOrCreatePlaylist(clientId);

    const [item] = await sql`
      INSERT INTO playlist_items (
        playlist_id,
        source,
        source_id,
        title,
        artist,
        thumbnail_url
      )
      VALUES (
        ${playlist.id},
        ${source},
        ${sourceId},
        ${title},
        ${artist || null},
        ${thumbnail || null}
      )
      ON CONFLICT (
        playlist_id,
        source,
        source_id
      )
      DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        thumbnail_url = EXCLUDED.thumbnail_url
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


router.delete("/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({
        message: "clientId wajib diisi",
      });
    }

    await sql`
      DELETE FROM playlist_items pi
      USING playlists p
      WHERE pi.id = ${id}
        AND pi.playlist_id = p.id
        AND p.client_id = ${clientId}
    `;

    res.json({
      message: "Lagu dihapus dari playlist",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});


export default router;