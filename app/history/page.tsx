"use client";

import { actions, usePrefs } from "@/lib/store";
import { GridSkeleton, VideoGrid } from "@/components/VideoGrid";

export default function History() {
  const prefs = usePrefs();
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">History</h1>
        {prefs && prefs.history.length > 0 && (
          <button className="btn" onClick={() => confirm("Clear your watch history?") && actions.clearHistory()}>
            Clear history
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Kept only in this browser. It&apos;s never used to recommend anything.</p>
      {prefs ? (
        <VideoGrid
          videos={prefs.history}
          filter={false}
          empty={<p className="py-12 text-center text-muted">Nothing watched yet.</p>}
        />
      ) : (
        <GridSkeleton />
      )}
    </section>
  );
}
