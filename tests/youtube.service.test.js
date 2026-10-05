import test, { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { searchMusic } from "../src/services/youtube.service.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.YOUTUBE_API_KEY;

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalKey === undefined) {
    delete process.env.YOUTUBE_API_KEY;
  } else {
    process.env.YOUTUBE_API_KEY = originalKey;
  }
});

function makeItem(videoId) {
  return {
    id: { videoId },
    snippet: {
      title: `Song ${videoId}`,
      description: "desc",
      channelTitle: "Channel",
      thumbnails: {
        high: { url: "high.jpg" },
        medium: { url: "medium.jpg" },
        default: { url: "default.jpg" },
      },
    },
  };
}

function stubFetch(handler) {
  globalThis.fetch = async (url) =>
    handler(url instanceof URL ? url : new URL(String(url)));
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("searchMusic", () => {
  describe("configuration (negative cases)", () => {
    it("throws when YOUTUBE_API_KEY is missing", async () => {
      delete process.env.YOUTUBE_API_KEY;

      await assert.rejects(
        () => searchMusic("jazz"),
        /YOUTUBE_API_KEY belum diatur/,
      );
    });

    it("does not call fetch when the API key is missing", async () => {
      delete process.env.YOUTUBE_API_KEY;

      let called = false;
      globalThis.fetch = async () => {
        called = true;
        return jsonResponse({ items: [] });
      };

      await assert.rejects(
        () => searchMusic("jazz"),
        /YOUTUBE_API_KEY belum diatur/,
      );
      assert.equal(called, false);
    });
  });

  describe("input validation (negative cases)", () => {
    for (const [label, value] of [
      ["undefined", undefined],
      ["empty string", ""],
      ["single character", "x"],
      ["whitespace only", "  "],
    ]) {
      it(`throws when query is ${label}`, async () => {
        await assert.rejects(() => searchMusic(value), /minimal 2 karakter/);
      });
    }

    it("does not call fetch for invalid input", async () => {
      let called = false;
      globalThis.fetch = async () => {
        called = true;
        return jsonResponse({ items: [] });
      };

      await assert.rejects(() => searchMusic(" "), /minimal 2 karakter/);
      assert.equal(called, false);
    });
  });

  describe("request construction", () => {
    it("builds the URL with all required query parameters", async () => {
      let captured = null;
      stubFetch((url) => {
        captured = url;
        return jsonResponse({ items: [] });
      });

      await searchMusic("jazz");

      assert.equal(
        captured.origin + captured.pathname,
        "https://www.googleapis.com/youtube/v3/search",
      );
      assert.equal(captured.searchParams.get("part"), "snippet");
      assert.equal(captured.searchParams.get("type"), "video");
      assert.equal(captured.searchParams.get("videoEmbeddable"), "true");
      assert.equal(captured.searchParams.get("videoSyndicated"), "true");
      assert.equal(captured.searchParams.get("videoCategoryId"), "10");
      assert.equal(captured.searchParams.get("maxResults"), "12");
      assert.equal(captured.searchParams.get("regionCode"), "ID");
      assert.equal(captured.searchParams.get("q"), "jazz");
      assert.equal(captured.searchParams.get("key"), "test-key");
    });

    it("omits pageToken when it is empty", async () => {
      let captured = null;
      stubFetch((url) => {
        captured = url;
        return jsonResponse({ items: [] });
      });

      await searchMusic("jazz");

      assert.equal(captured.searchParams.has("pageToken"), false);
    });

    it("includes pageToken when provided", async () => {
      let captured = null;
      stubFetch((url) => {
        captured = url;
        return jsonResponse({ items: [] });
      });

      await searchMusic("jazz", "TOKEN123");

      assert.equal(captured.searchParams.get("pageToken"), "TOKEN123");
    });
  });

  describe("response mapping (positive cases)", () => {
    it("maps items into the normalized shape used by SongCard", async () => {
      stubFetch(() => jsonResponse({ items: [makeItem("abc123")] }));

      const result = await searchMusic("jazz");

      assert.equal(result.items.length, 1);
      assert.deepEqual(result.items[0], {
        source: "youtube",
        sourceId: "abc123",
        videoId: "abc123",
        title: "Song abc123",
        description: "desc",
        artist: "Channel",
        channelTitle: "Channel",
        duration: 0,
        streamUrl: null,
        thumbnail: "high.jpg",
      });
      assert.equal(result.nextPageToken, null);
    });

    it("exposes nextPageToken when present", async () => {
      stubFetch(() =>
        jsonResponse({ items: [makeItem("a")], nextPageToken: "NEXT" }),
      );

      const result = await searchMusic("jazz");
      assert.equal(result.nextPageToken, "NEXT");
    });

    it("filters out entries without a videoId", async () => {
      stubFetch(() =>
        jsonResponse({
          items: [
            makeItem("keep1"),
            {
              id: { channelId: "no-video" },
              snippet: { title: "Channel result" },
            },
            { id: {}, snippet: { title: "Empty id" } },
            makeItem("keep2"),
          ],
        }),
      );

      const result = await searchMusic("jazz");
      assert.deepEqual(
        result.items.map((i) => i.videoId),
        ["keep1", "keep2"],
      );
    });
  });

  describe("thumbnail fallbacks (edge cases)", () => {
    it("falls back high -> medium -> default -> null", async () => {
      const withThumbnails = (thumbnails) => ({
        id: { videoId: "v" },
        snippet: {
          title: "t",
          description: "d",
          channelTitle: "c",
          thumbnails,
        },
      });

      stubFetch(() =>
        jsonResponse({
          items: [
            withThumbnails({ high: { url: "h" }, medium: { url: "m" } }),
            withThumbnails({ medium: { url: "m" }, default: { url: "d" } }),
            withThumbnails({ default: { url: "d" } }),
            withThumbnails(undefined),
          ],
        }),
      );

      const result = await searchMusic("jazz");
      assert.equal(result.items[0].thumbnail, "h");
      assert.equal(result.items[1].thumbnail, "m");
      assert.equal(result.items[2].thumbnail, "d");
      assert.equal(result.items[3].thumbnail, null);
    });
  });

  describe("HTTP error propagation (negative cases)", () => {
    it("includes the status and body text in the error", async () => {
      stubFetch(() =>
        jsonResponse({ error: "quotaExceeded" }, { ok: false, status: 403 }),
      );

      await assert.rejects(() => searchMusic("jazz"), /YouTube API error: 403/);
    });

    it("propagates network failures", async () => {
      stubFetch(() => {
        throw new Error("ETIMEDOUT");
      });

      await assert.rejects(() => searchMusic("jazz"), /ETIMEDOUT/);
    });
  });
});
