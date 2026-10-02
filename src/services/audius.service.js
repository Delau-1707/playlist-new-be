export async function searchAudius(query) {
  if (!query || query.trim().length < 2) {
    throw new Error(
      "Query pencarian minimal 2 karakter"
    );
  }

  const url = new URL(
    "https://api.audius.co/v1/tracks/search"
  );

  url.searchParams.set(
    "query",
    query.trim()
  );

  url.searchParams.set(
    "limit",
    "12"
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Audius API error: ${response.status}`
    );
  }

  const data = await response.json();

  return data.data
    .filter((track) => track.is_streamable)
    .map((track) => ({
      source: "audius",
      sourceId: String(track.id),
      title: track.title,

      artist:
        track.user?.name ||
        track.user?.handle ||
        "Unknown Artist",

      thumbnail:
        track.artwork?.["480x480"] ||
        track.artwork?.["150x150"] ||
        null,

      duration: track.duration || 0,

      streamUrl:
        track.stream?.url || null,
    }));
}