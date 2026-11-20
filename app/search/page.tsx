"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getJSON } from "@/lib/fetcher";
import type { SearchResult } from "@/lib/types";
import { GridSkeleton, VideoGrid } from "@/components/VideoGrid";

function Results() {
  const q = useSearchParams().get("q") ?? "";
  const [data, setData] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    setData(null);
    setError("");
    getJSON<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">{q ? `Results for “${q}”` : "Search"}</h1>
      {error && <p className="text-accent">{error}</p>}
      {q && !error && (data ? <VideoGrid videos={data.videos} /> : <GridSkeleton />)}
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Results />
    </Suspense>
  );
}
