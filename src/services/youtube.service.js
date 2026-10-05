import "dotenv/config";

export async function searchMusic(query, pageToken = "") {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY belum diatur");
  }

  if (!query || query.trim().length < 2) {
    throw new Error("Query pencarian minimal 2 karakter");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");

  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("regionCode", "ID");
  url.searchParams.set("relevanceLanguage", "id");
  url.searchParams.set("q", query);

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`YouTube API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    items: data.items
      .filter((item) => item.id?.videoId)
      .map((item) => {
        const videoId = item.id.videoId;

        return {
          source: "youtube",

          sourceId: videoId,

          videoId,

          title: item.snippet.title,
          description: item.snippet.description,
          artist: item.snippet.channelTitle,
          channelTitle: item.snippet.channelTitle,
          duration: 0,
          streamUrl: null,
          thumbnail:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url ||
            null,
        };
      }),
    nextPageToken: data.nextPageToken || null,
  };
}
