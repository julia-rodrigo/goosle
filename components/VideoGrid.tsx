"use client";

import { useState } from "react";
import { applyFilters, type HiddenReason } from "@/lib/filters";
import { usePrefs } from "@/lib/store";
import type { Video } from "@/lib/types";
import { VideoCard } from "./VideoCard";

const LABEL: Record<HiddenReason, string> = {
  short: "Shorts",
  slop: "AI / slop",
  "blocked channel": "blocked channels",
  "blocked word": "blocked words",
  live: "live streams",
  "too short": "too short",
  watched: "already watched",
};

export function VideoGrid({ videos, filter = true, empty }: { videos: Video[]; filter?: boolean; empty?: React.ReactNode }) {
  const prefs = usePrefs();
  const [reveal, setReveal] = useState(false);
  if (!prefs) return <GridSkeleton />;

  const { shown, hidden } = filter ? applyFilters(videos, prefs) : { shown: videos, hidden: [] };
  const counts = hidden.reduce<Record<string, number>>((acc, h) => ((acc[LABEL[h.reason]] = (acc[LABEL[h.reason]] || 0) + 1), acc), {});

  return (
    <div className="space-y-6">
      {hidden.length > 0 && (
        <p className="text-sm text-muted">
          Hid {hidden.length}: {Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ")}.{" "}
          <button className="underline hover:text-fg" onClick={() => setReveal((r) => !r)}>
            {reveal ? "Hide them" : "Show anyway"}
          </button>
        </p>
      )}
      {shown.length === 0 && !reveal ? (
        empty ?? <p className="py-12 text-center text-muted">Nothing here.</p>
      ) : (
        <Grid>
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
          {reveal &&
            hidden.map((h) => (
              <VideoCard key={h.video.id} video={h.video} dim note={`Hidden: ${h.reason}${h.detail ? ` ("${h.detail}")` : ""}`} />
            ))}
        </Grid>
      )}
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function GridSkeleton() {
  return (
    <Grid>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-video animate-pulse rounded-xl bg-line" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
        </div>
      ))}
    </Grid>
  );
}
