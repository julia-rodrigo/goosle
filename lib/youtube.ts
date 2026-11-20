import "server-only";
import type { Channel, ChannelPage, SearchResult, Video, VideoDetails } from "./types";

/**
 * Server-side access to YouTube data.
 *
 * Two sources:
 *  - Public, key-free endpoints: channel RSS feeds, oEmbed, and the public
 *    channel/results pages. Enough for a subscription feed and basic search.
 *  - The official YouTube Data API v3, used when YOUTUBE_API_KEY is set.
 *    More reliable search and richer video details.
 */

const API_KEY = process.env.YOUTUBE_API_KEY?.trim() || "";
const API = "https://www.googleapis.com/youtube/v3";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const hasApiKey = () => API_KEY.length > 0;

const CHANNEL_ID_RE = /^UC[\w-]{22}$/;
const VIDEO_ID_RE = /^[\w-]{11}$/;

export const isChannelId = (s: string) => CHANNEL_ID_RE.test(s);
export const isVideoId = (s: string) => VIDEO_ID_RE.test(s);

async function get(url: string, revalidate = 600) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${new URL(url).pathname}`);
  return res;
}

async function api<T>(path: string, params: Record<string, string>, revalidate = 600): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: API_KEY });
  const res = await fetch(`${API}/${path}?${qs}`, { next: { revalidate } });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `YouTube API ${res.status}`);
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) : "";
};

/** ISO-8601 duration (PT1H2M3S) -> "1:02:03" */
function isoDuration(iso?: string) {
  if (!iso) return undefined;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  const h = Number(m[1] || 0) * 24 + Number(m[2] || 0);
  const min = Number(m[3] || 0);
  const s = Number(m[4] || 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
}

function durationSeconds(d?: string) {
  if (!d) return undefined;
  return d.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
}

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

/** Latest ~15 uploads of a channel from its public RSS feed. No key needed. */
export async function channelFeed(channelId: string): Promise<ChannelPage> {
  if (!isChannelId(channelId)) throw new Error("Invalid channel id");
  const xml = await (
    await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, 900)
  ).text();

  const head = xml.split("<entry>")[0];
  const channel: Channel = {
    id: channelId,
    name: tag(head, "title"),
  };

  const videos: Video[] = xml
    .split("<entry>")
    .slice(1)
    .map((entry) => {
      const id = tag(entry, "yt:videoId");
      const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] || "";
      const views = entry.match(/<media:statistics views="(\d+)"/)?.[1];
      return {
        id,
        title: tag(entry, "title"),
        channelId,
        channelName: tag(entry, "name") || channel.name,
        published: tag(entry, "published"),
        views: views ? Number(views) : undefined,
        description: tag(entry, "media:description"),
        isShort: link.includes("/shorts/"),
      } satisfies Video;
    })
    .filter((v) => v.id);

  return { channel, videos };
}

/**
 * Turn whatever the user typed (a channel URL, @handle, or UC… id) into a
 * channel. Uses the API when available, otherwise reads the public page.
 */
export async function resolveChannel(input: string): Promise<Channel> {
  let q = input.trim();
  if (!q) throw new Error("Enter a channel URL, @handle or channel id");

  // Pull the useful part out of a URL.
  try {
    if (/^https?:\/\//.test(q) || q.includes("youtube.com/")) {
      const u = new URL(q.startsWith("http") ? q : `https://${q}`);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "channel" && parts[1]) q = parts[1];
      else if (parts[0]?.startsWith("@")) q = parts[0];
      else if ((parts[0] === "c" || parts[0] === "user") && parts[1]) q = `${parts[0]}/${parts[1]}`;
    }
  } catch {
    /* not a URL, use as typed */
  }

  if (isChannelId(q)) {
    const { channel } = await channelFeed(q);
    return channel;
  }

  const handle = q.startsWith("@") || q.includes("/") ? q : `@${q}`;

  if (hasApiKey() && handle.startsWith("@")) {
    const r = await api<{ items?: ApiChannel[] }>("channels", {
      part: "snippet",
      forHandle: handle,
    });
    const c = r.items?.[0];
    if (c) return fromApiChannel(c);
  }

  // Key-free: read the canonical channel id from the public page.
  const html = await (await get(`https://www.youtube.com/${handle}`, 86400)).text();
  const id =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ||
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error(`Couldn't find a channel for "${input}"`);
  const name = decodeXml(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "");
  const avatar = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
  return { id, name: name || handle, handle: handle.startsWith("@") ? handle : undefined, avatar };
}

type ApiChannel = {
  id: string;
  snippet: { title: string; customUrl?: string; thumbnails?: Record<string, { url: string }> };
};

function fromApiChannel(c: ApiChannel): Channel {
  const t = c.snippet.thumbnails;
  return {
    id: c.id,
    name: c.snippet.title,
    handle: c.snippet.customUrl,
    avatar: t?.medium?.url || t?.default?.url,
  };
}

/* ------------------------------------------------------------------ */
/* Videos                                                              */
/* ------------------------------------------------------------------ */

type ApiVideo = {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    tags?: string[];
    liveBroadcastContent?: string;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
};

function fromApiVideo(v: ApiVideo): VideoDetails {
  const duration = isoDuration(v.contentDetails?.duration);
  const secs = durationSeconds(duration);
  return {
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    channelId: v.snippet.channelId,
    channelName: v.snippet.channelTitle,
    published: v.snippet.publishedAt,
    duration,
    views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
    likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
    tags: v.snippet.tags,
    isLive: v.snippet.liveBroadcastContent === "live",
    // The API has no "is short" flag; very short videos are almost always Shorts.
    isShort: secs !== undefined && secs > 0 && secs <= 60,
  };
}

async function apiVideos(ids: string[]): Promise<VideoDetails[]> {
  if (!ids.length) return [];
  const r = await api<{ items: ApiVideo[] }>("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    maxResults: "50",
  });
  return r.items.map(fromApiVideo);
}

/** Title/channel for the watch page. API when available, oEmbed otherwise. */
export async function videoDetails(id: string): Promise<VideoDetails> {
  if (!isVideoId(id)) throw new Error("Invalid video id");
  if (hasApiKey()) {
    const [v] = await apiVideos([id]);
    if (v) return v;
  }
  const o = await (
    await get(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`, 3600)
  ).json();
  const author: string = o.author_url || "";
  let channelId = author.match(/\/channel\/(UC[\w-]{22})/)?.[1] || "";
  if (!channelId && author) {
    try {
      channelId = (await resolveChannel(author)).id;
    } catch {
      /* channel link is optional */
    }
  }
  return { id, title: o.title, channelName: o.author_name, channelId };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export async function search(q: string): Promise<SearchResult> {
  if (hasApiKey()) {
    const r = await api<{ items: { id: { videoId?: string } }[] }>(
      "search",
      { part: "snippet", q, type: "video", maxResults: "40", safeSearch: "none" },
      3600,
    );
    const ids = r.items.map((i) => i.id.videoId).filter(Boolean) as string[];
    return { videos: await apiVideos(ids), source: "api" };
  }
  return { videos: await searchPage(q), source: "page" };
}

/**
 * Key-free fallback: read the public results page. Shorts shelves, ads and
 * "people also watched" blocks are dropped; only plain video results remain.
 * This depends on YouTube's page layout and may need updating if it changes.
 */
async function searchPage(q: string): Promise<Video[]> {
  const html = await (
    await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`, 3600)
  ).text();
  const raw = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/)?.[1];
  if (!raw) throw new Error("Search is unavailable right now. Add a YOUTUBE_API_KEY for reliable search.");
  const data = JSON.parse(raw);

  const out: Video[] = [];
  const seen = new Set<string>();

  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const obj = o as Record<string, any>;
    for (const [k, v] of Object.entries(obj)) {
      // Skip shelves of Shorts and "related" style blocks entirely.
      if (k === "reelShelfRenderer" || k === "shelfRenderer" || k === "shortsLockupViewModel") continue;
      if (k === "adSlotRenderer" || k === "promotedSparklesWebRenderer") continue;
      if (k === "lockupViewModel" && v?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
        const video = fromLockup(v);
        if (video && !seen.has(video.id)) {
          seen.add(video.id);
          out.push(video);
        }
        continue;
      }
      if (k === "videoRenderer" && v?.videoId) {
        const video = fromVideoRenderer(v);
        if (!seen.has(video.id)) {
          seen.add(video.id);
          out.push(video);
        }
        continue;
      }
      walk(v);
    }
  };
  walk(data?.contents?.twoColumnSearchResultsRenderer?.primaryContents ?? data);
  return out;
}

function fromLockup(v: any): Video | null {
  const id: string = v.contentId;
  if (!isVideoId(id)) return null;
  const meta = v.metadata?.lockupMetadataViewModel;
  const json = JSON.stringify(v);
  const texts: string[] = [];
  for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
    for (const part of row.metadataParts ?? []) if (part?.text?.content) texts.push(part.text.content);
  }
  const channelName =
    json.match(/"a11yLabel":"Go to channel ([^"]+)"/)?.[1] ||
    texts.find((t) => !/views?|ago|watching|Streamed/i.test(t)) ||
    "";
  return {
    id,
    title: meta?.title?.content ?? "",
    channelId: json.match(/"browseId":"(UC[\w-]{22})"/)?.[1] ?? "",
    channelName,
    viewsText: texts.find((t) => /views?|watching/i.test(t)),
    publishedText: texts.find((t) => /ago/i.test(t)),
    duration: json.match(/"text":"(\d{1,2}(?::\d{2}){1,2})"/)?.[1],
    isLive: /"LIVE"|BADGE_STYLE_TYPE_LIVE|THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE/.test(json),
  };
}

function fromVideoRenderer(v: any): Video {
  const text = (t: any): string => t?.simpleText ?? t?.runs?.map((r: any) => r.text).join("") ?? "";
  return {
    id: v.videoId,
    title: text(v.title),
    channelId: v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? "",
    channelName: text(v.ownerText),
    viewsText: text(v.viewCountText),
    publishedText: text(v.publishedTimeText),
    duration: text(v.lengthText) || undefined,
    description: v.detailedMetadataSnippets?.[0]?.snippetText ? text(v.detailedMetadataSnippets[0].snippetText) : undefined,
  };
}
