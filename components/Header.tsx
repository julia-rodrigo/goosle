"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/later", label: "Watch later" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Filters" },
];

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  return (
    <form
      role="search"
      className="flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (!v) return;
        // Pasting a video link goes straight to it.
        const id = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1];
        router.push(id ? `/watch/${id}` : `/search?q=${encodeURIComponent(v)}`);
      }}
    >
      <input
        className="input"
        type="search"
        placeholder="Search, or paste a video link"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search videos"
      />
    </form>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-white">
            ▶
          </span>
          <span className="hidden sm:inline">goosle</span>
        </Link>
        <Suspense fallback={<div className="flex-1" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                active ? "bg-fg text-bg" : "text-muted hover:bg-panel hover:text-fg"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
