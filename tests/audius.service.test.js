import test, { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { searchAudius } from "../src/services/audius.service.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeTrack(overrides = {}) {
  return {
    id: 12345,
    title: "Midnight Drive",
    is_streamable: true,
    duration: 210,
    user: { name: "DJ Nova", handle: "@djnova" },
    artwork: {
      "480x480": "https://cdn.audius.co/480.jpg",
      "150x150": "https://cdn.audius.co/150.jpg",
    },
    stream: { url: "https://stream.audius.co/track.mp3" },
    ...overrides,
  };
}

function stubFetch(handler) {
  globalThis.fetch = async (url) =>
    handler(url instanceof URL ? url : new URL(String(url)));
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe("searchAudius", () => {
  describe("input validation (negative cases)", () => {
    for (const [label, value] of [
      ["undefined", undefined],
      ["null", null],
      ["empty string", ""],
      ["single character", "a"],
      ["whitespace only", "     "],
    ]) {
      it(`throws when query is ${label}`, async () => {
        await assert.rejects(() => searchAudius(value), /minimal 2 karakter/);
      });
    }

    it("does not call fetch when validation fails", async () => {
      let called = false;
      stubFetch(() => {
        called = true;
        return jsonResponse({ data: [] });
      });

      await assert.rejects(() => searchAudius(" "), /minimal 2 karakter/);
      assert.equal(
        called,
        false,
        "fetch should not be reached for invalid input",
      );
    });
  });

  describe("request construction", () => {
    it("hits the Audius search endpoint with trimmed query and limit=12", async () => {
      let captured = null;
      stubFetch((url) => {
        captured = url;
        return jsonResponse({ data: [] });
      });

      await searchAudius("  jazz  ");

      assert.equal(
        captured.origin + captured.pathname,
        "https://api.audius.co/v1/tracks/search",
      );
      assert.equal(captured.searchParams.get("query"), "jazz");
      assert.equal(captured.searchParams.get("limit"), "12");
    });

    it("accepts a query at the minimum boundary of exactly 2 characters", async () => {
      let called = false;
      stubFetch(() => {
        called = true;
        return jsonResponse({ data: [] });
      });

      await searchAudius("ab");
      assert.equal(called, true);
    });
  });

  describe("response mapping (positive cases)", () => {
    it("maps a fully populated track to the normalized shape", async () => {
      stubFetch(() => jsonResponse({ data: [makeTrack()] }));

      const result = await searchAudius("jazz");

      assert.equal(result.length, 1);
      assert.deepEqual(result[0], {
        source: "audius",
        sourceId: "12345",
        title: "Midnight Drive",
        artist: "DJ Nova",
        thumbnail: "https://cdn.audius.co/480.jpg",
        duration: 210,
        streamUrl: "https://stream.audius.co/track.mp3",
      });
    });

    it("preserves list order and maps every track", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [
            makeTrack({ id: 1, title: "First" }),
            makeTrack({ id: 2, title: "Second" }),
            makeTrack({ id: 3, title: "Third" }),
          ],
        }),
      );

      const result = await searchAudius("jazz");
      assert.deepEqual(
        result.map((t) => t.title),
        ["First", "Second", "Third"],
      );
    });

    it("stringifies a numeric sourceId", async () => {
      stubFetch(() => jsonResponse({ data: [makeTrack({ id: 998877 })] }));

      const [track] = await searchAudius("jazz");
      assert.equal(track.sourceId, "998877");
      assert.equal(typeof track.sourceId, "string");
    });
  });

  describe("filtering and fallbacks (edge cases)", () => {
    it("excludes tracks that are not streamable", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [
            makeTrack({ id: 1, is_streamable: true }),
            makeTrack({ id: 2, is_streamable: false }),
          ],
        }),
      );

      const result = await searchAudius("jazz");
      assert.equal(result.length, 1);
      assert.equal(result[0].sourceId, "1");
    });

    it("excludes tracks whose is_streamable flag is missing entirely", async () => {
      const track = makeTrack();
      delete track.is_streamable;

      stubFetch(() => jsonResponse({ data: [track] }));
      assert.deepEqual(await searchAudius("jazz"), []);
    });

    it("returns an empty array when there are no results", async () => {
      stubFetch(() => jsonResponse({ data: [] }));
      assert.deepEqual(await searchAudius("zzzznotfound"), []);
    });

    it("falls back from user.name to user.handle to 'Unknown Artist'", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [
            makeTrack({ user: { name: "DJ Nova", handle: "@djnova" } }),
            makeTrack({ user: { handle: "@handleonly" } }),
            makeTrack({ user: { name: "", handle: "" } }),
            makeTrack({ user: undefined }),
          ],
        }),
      );

      const result = await searchAudius("jazz");
      assert.equal(result[0].artist, "DJ Nova");
      assert.equal(result[1].artist, "@handleonly");
      assert.equal(result[2].artist, "Unknown Artist");
      assert.equal(result[3].artist, "Unknown Artist");
    });

    it("prefers the 480x480 artwork, then 150x150, then null", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [
            makeTrack({ artwork: { "480x480": "big", "150x150": "small" } }),
            makeTrack({ artwork: { "150x150": "small" } }),
            makeTrack({ artwork: { other: "x" } }),
            makeTrack({ artwork: undefined }),
          ],
        }),
      );

      const result = await searchAudius("jazz");
      assert.equal(result[0].thumbnail, "big");
      assert.equal(result[1].thumbnail, "small");
      assert.equal(result[2].thumbnail, null);
      assert.equal(result[3].thumbnail, null);
    });

    it("defaults duration to 0 when falsy", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [
            makeTrack({ duration: 0 }),
            makeTrack({ duration: null }),
            makeTrack({ duration: 90 }),
          ],
        }),
      );

      const result = await searchAudius("jazz");
      assert.equal(result[0].duration, 0);
      assert.equal(result[1].duration, 0);
      assert.equal(result[2].duration, 90);
    });

    it("defaults streamUrl to null when the stream is absent", async () => {
      stubFetch(() =>
        jsonResponse({
          data: [makeTrack({ stream: undefined }), makeTrack({ stream: {} })],
        }),
      );

      const result = await searchAudius("jazz");
      assert.equal(result[0].streamUrl, null);
      assert.equal(result[1].streamUrl, null);
    });
  });

  describe("HTTP error propagation (negative cases)", () => {
    for (const status of [503, 429, 404]) {
      it(`throws with the status code on HTTP ${status}`, async () => {
        stubFetch(() => jsonResponse({}, { ok: false, status }));
        await assert.rejects(
          () => searchAudius("jazz"),
          new RegExp(`Audius API error: ${status}`),
        );
      });
    }

    it("propagates network failures from fetch", async () => {
      stubFetch(() => {
        throw new Error("ECONNREFUSED");
      });

      await assert.rejects(() => searchAudius("jazz"), /ECONNREFUSED/);
    });
  });
});
