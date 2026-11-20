import { NextResponse } from "next/server";
import { channelFeed, isChannelId } from "@/lib/youtube";
import type { Video } from "@/lib/types";

// GET /api/feed?ids=UC…,UC…  ->  newest uploads from those channels, newest first.
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(isChannelId)
    .slice(0, 200);

  const results = await Promise.allSettled(ids.map((id) => channelFeed(id)));
  const videos: Video[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => (r.status === "fulfilled" ? videos.push(...r.value.videos) : failed.push(ids[i])));
  videos.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  return NextResponse.json({ videos, failed });
}
