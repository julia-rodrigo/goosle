export type Video = {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  published?: string; // ISO date, when known
  publishedText?: string; // e.g. "3 days ago", when only text is known
  views?: number;
  viewsText?: string;
  duration?: string; // "12:34"
  description?: string;
  isShort?: boolean;
  isLive?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  handle?: string;
  avatar?: string;
};

export type ChannelPage = {
  channel: Channel;
  videos: Video[];
};

export type SearchResult = {
  videos: Video[];
  source: "api" | "page";
};

export type VideoDetails = Video & {
  likes?: number;
  tags?: string[];
};

export function thumbnail(id: string, quality: "mq" | "hq" = "mq") {
  return `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;
}
