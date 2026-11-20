"use client";

import { use, useEffect, useState } from "react";
import { actions, usePrefs } from "@/lib/store";
import { getJSON } from "@/lib/fetcher";
import type { ChannelPage } from "@/lib/types";
import { GridSkeleton, VideoGrid } from "@/components/VideoGrid";

export default function Channel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const prefs = usePrefs();
  const [data, setData] = useState<ChannelPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJSON<ChannelPage>(`/api/channel/${id}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const subscribed = prefs?.subscriptions.some((s) => s.id === id);
  const blocked = prefs?.blockedChannels.some((b) => b.id === id);
  const name = data?.channel.name ?? "";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-2xl font-semibold">{name || "Channel"}</h1>
        {data &&
          (subscribed ? (
            <button className="btn" onClick={() => actions.unsubscribe(id)}>Subscribed ✓</button>
          ) : (
            <button className="btn-primary" onClick={() => actions.subscribe(data.channel)}>Subscribe</button>
          ))}
        {data &&
          (blocked ? (
            <button className="btn" onClick={() => actions.unblock(id)}>Unblock</button>
          ) : (
            <button className="btn" onClick={() => actions.block({ id, name })}>Never show this channel</button>
          ))}
        <a className="btn" href={`https://www.youtube.com/channel/${id}`} target="_blank" rel="noreferrer">
          Open on YouTube ↗
        </a>
      </div>
      {error && <p className="text-accent">{error}</p>}
      <p className="text-sm text-muted">Latest uploads</p>
      {data ? <VideoGrid videos={data.videos} filter={!blocked} /> : !error && <GridSkeleton />}
    </section>
  );
}
