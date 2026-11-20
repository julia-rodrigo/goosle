"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { actions, usePrefs } from "@/lib/store";
import { getJSON } from "@/lib/fetcher";
import { compact, timeAgo } from "@/lib/format";
import type { VideoDetails } from "@/lib/types";
import { VideoCard } from "@/components/VideoCard";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const prefs = usePrefs();
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVideo(null);
    setError("");
    getJSON<VideoDetails>(`/api/video/${id}`)
      .then((v) => {
        if (cancelled) return;
        setVideo(v);
        actions.watched({ id: v.id, title: v.title, channelId: v.channelId, channelName: v.channelName, duration: v.duration });
        document.title = `${v.title} · Goosle`;
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const subscribed = video && prefs?.subscriptions.some((s) => s.id === video.channelId);
  const saved = prefs?.watchLater.some((w) => w.id === id);
  const upNext = prefs?.watchLater.filter((w) => w.id !== id).slice(0, 6) ?? [];

  // youtube-nocookie: no tracking cookies until you press play.
  // rel=0: the end screen only shows the same channel, not random recommendations.
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&iv_load_policy=3&playsinline=1&modestbranding=1`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            key={id}
            src={src}
            title={video?.title ?? "Video player"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        {error && <p className="text-accent">{error}</p>}

        {video && (
          <>
            <h1 className="text-xl font-semibold leading-snug">{video.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {video.channelId ? (
                <Link href={`/channel/${video.channelId}`} className="mr-2 font-medium hover:underline">
                  {video.channelName}
                </Link>
              ) : (
                <span className="mr-2 font-medium">{video.channelName}</span>
              )}
              {video.channelId &&
                (subscribed ? (
                  <button className="btn" onClick={() => actions.unsubscribe(video.channelId)}>Subscribed ✓</button>
                ) : (
                  <button className="btn-primary" onClick={() => actions.subscribe({ id: video.channelId, name: video.channelName })}>
                    Subscribe
                  </button>
                ))}
              <button className="btn" onClick={() => actions.toggleLater(video)}>{saved ? "Saved ✓" : "Watch later"}</button>
              <a className="btn" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">
                Open on YouTube ↗
              </a>
            </div>

            {(video.views !== undefined || video.published || video.description) && (
              <div className="rounded-2xl bg-panel p-4 text-sm">
                <p className="font-medium">
                  {[video.views !== undefined && `${compact(video.views)} views`, video.published && timeAgo(video.published)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {video.description && (
                  <>
                    <p className={`mt-2 whitespace-pre-wrap break-words ${more ? "" : "line-clamp-3"}`}>{video.description}</p>
                    <button className="mt-1 font-medium text-muted hover:text-fg" onClick={() => setMore((m) => !m)}>
                      {more ? "Show less" : "Show more"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <aside className="space-y-4">
        {upNext.length > 0 ? (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Up next from Watch later</h2>
            <div className="space-y-6">
              {upNext.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            No recommendations here, on purpose. Save videos to Watch later and they&apos;ll show up in this spot.
          </p>
        )}
      </aside>
    </div>
  );
}
