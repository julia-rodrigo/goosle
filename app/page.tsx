"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "@/lib/store";
import { getJSON } from "@/lib/fetcher";
import type { Video } from "@/lib/types";
import { GridSkeleton, VideoGrid } from "@/components/VideoGrid";
import { AddChannel } from "@/components/AddChannel";
import { ImportTakeout } from "@/components/ImportTakeout";

export default function FeedPage() {
  const prefs = usePrefs();
  const ids = prefs?.subscriptions.map((s) => s.id).join(",");
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    setError("");
    const list = ids.split(",");
    const chunks = Array.from({ length: Math.ceil(list.length / 40) }, (_, i) => list.slice(i * 40, i * 40 + 40));
    Promise.all(chunks.map((c) => getJSON<{ videos: Video[] }>(`/api/feed?ids=${c.join(",")}`)))
      .then((rs) => {
        if (cancelled) return;
        const all = rs.flatMap((r) => r.videos);
        all.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
        setVideos(all);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ids, reload]);

  if (!prefs) return <GridSkeleton />;

  if (prefs.subscriptions.length === 0) {
    return (
      <section className="mx-auto max-w-xl space-y-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Only the channels you choose.</h1>
        <p className="text-muted">
          Your feed is just the newest uploads from channels you subscribe to here, in the order they came out.
          No recommendations, no Shorts, nothing picked for you by an algorithm.
        </p>
        <div className="space-y-4 text-left">
          <AddChannel autoFocus />
          <ImportTakeout />
        </div>
        <p className="text-sm text-muted">Or search for something above, and subscribe from any video.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Latest from your {prefs.subscriptions.length} channels</h1>
        <button className="btn" onClick={() => setReload((r) => r + 1)}>Refresh</button>
      </div>
      {error && <p className="text-accent">{error}</p>}
      {videos ? (
        <VideoGrid videos={videos} empty={<p className="py-12 text-center text-muted">No new uploads.</p>} />
      ) : (
        <GridSkeleton />
      )}
    </section>
  );
}
