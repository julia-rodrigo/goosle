"use client";

import { usePrefs } from "@/lib/store";
import { GridSkeleton, VideoGrid } from "@/components/VideoGrid";

export default function Later() {
  const prefs = usePrefs();
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Watch later</h1>
      {prefs ? (
        <VideoGrid
          videos={prefs.watchLater}
          filter={false}
          empty={<p className="py-12 text-center text-muted">Use “⋮ → Save to Watch later” on any video.</p>}
        />
      ) : (
        <GridSkeleton />
      )}
    </section>
  );
}
