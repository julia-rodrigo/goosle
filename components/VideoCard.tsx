"use client";

import Link from "next/link";
import { useState } from "react";
import { actions, usePrefs } from "@/lib/store";
import { compact, timeAgo } from "@/lib/format";
import { thumbnail, type Video } from "@/lib/types";

export function VideoCard({ video, note, dim }: { video: Video; note?: string; dim?: boolean }) {
  const prefs = usePrefs();
  const [menu, setMenu] = useState(false);
  const saved = prefs?.watchLater.some((w) => w.id === video.id);
  const watched = prefs?.history.some((h) => h.id === video.id);
  const subscribed = prefs?.subscriptions.some((s) => s.id === video.channelId);

  const meta = [
    video.views !== undefined ? `${compact(video.views)} views` : video.viewsText,
    video.published ? timeAgo(video.published) : video.publishedText,
  ].filter(Boolean);

  return (
    <article className={`group relative flex flex-col gap-2 ${dim ? "opacity-50 hover:opacity-100" : ""}`}>
      <Link href={`/watch/${video.id}`} className="relative block aspect-video overflow-hidden rounded-xl bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnail(video.id)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {video.duration}
          </span>
        )}
        {video.isLive && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">LIVE</span>
        )}
        {watched && <span className="absolute inset-x-0 bottom-0 h-1 bg-accent" title="Watched" />}
      </Link>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/watch/${video.id}`} className="line-clamp-2 font-medium leading-snug hover:underline">
            {video.title}
          </Link>
          {video.channelId ? (
            <Link href={`/channel/${video.channelId}`} className="mt-0.5 block truncate text-sm text-muted hover:text-fg">
              {video.channelName}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-sm text-muted">{video.channelName}</p>
          )}
          {meta.length > 0 && <p className="text-sm text-muted">{meta.join(" · ")}</p>}
          {note && <p className="mt-1 text-xs text-accent">{note}</p>}
        </div>

        <div className="relative shrink-0">
          <button
            className="rounded-full px-2 py-1 text-muted hover:bg-panel hover:text-fg"
            aria-label="Video options"
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
          >
            ⋮
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-10 w-48 overflow-hidden rounded-xl border border-line bg-panel py-1 text-sm shadow-lg">
              <MenuItem onClick={() => actions.toggleLater(video)}>{saved ? "Remove from Watch later" : "Save to Watch later"}</MenuItem>
              {video.channelId && !subscribed && (
                <MenuItem onClick={() => actions.subscribe({ id: video.channelId, name: video.channelName })}>
                  Subscribe to channel
                </MenuItem>
              )}
              {video.channelId && (
                <MenuItem onClick={() => actions.block({ id: video.channelId, name: video.channelName })}>
                  Never show this channel
                </MenuItem>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="block w-full px-3 py-2 text-left hover:bg-bg">
      {children}
    </button>
  );
}
