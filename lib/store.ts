"use client";

import { useSyncExternalStore } from "react";
import type { Channel, Video } from "./types";

/**
 * Everything personal lives in this browser's localStorage. No account,
 * no server-side profile, nothing to track. Export/import in Settings
 * moves it between devices.
 */

export type Prefs = {
  subscriptions: Channel[];
  blockedChannels: Pick<Channel, "id" | "name">[];
  blockedWords: string[];
  slopWords: string[];
  hideShorts: boolean;
  hideSlop: boolean;
  hideLive: boolean;
  hideWatched: boolean;
  minMinutes: number;
  watchLater: Video[];
  history: (Video & { watchedAt: string })[];
};

/** Phrases that usually mean mass-produced or AI-generated content. Editable in Settings. */
export const DEFAULT_SLOP_WORDS = [
  "ai generated",
  "ai-generated",
  "made with ai",
  "made by ai",
  "#ai",
  "#aiart",
  "#aivideo",
  "#aigenerated",
  "ai art",
  "ai music",
  "ai song",
  "ai cover",
  "ai voice",
  "ai animation",
  "ai story",
  "ai video",
  "ai movie",
  "ai trailer",
  "midjourney",
  "stable diffusion",
  "sora",
  "veo 3",
  "suno",
  "udio",
  "chatgpt wrote",
  "reddit stories",
  "#redditstories",
  "text to speech",
];

const DEFAULTS: Prefs = {
  subscriptions: [],
  blockedChannels: [],
  blockedWords: [],
  slopWords: DEFAULT_SLOP_WORDS,
  hideShorts: true,
  hideSlop: true,
  hideLive: false,
  hideWatched: false,
  minMinutes: 0,
  watchLater: [],
  history: [],
};

const KEY = "goosle:prefs:v1";
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function load(): Prefs {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache!;
}

export function setPrefs(update: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  const current = load();
  const patch = typeof update === "function" ? update(current) : update;
  cache = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked; keep in memory for this session */
  }
  listeners.forEach((l) => l());
}

export function replacePrefs(next: Partial<Prefs>) {
  cache = { ...DEFAULTS, ...next };
  setPrefs({});
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns null during server render / before hydration. */
export function usePrefs(): Prefs | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export const actions = {
  subscribe(c: Channel) {
    setPrefs((p) => ({
      subscriptions: p.subscriptions.some((s) => s.id === c.id)
        ? p.subscriptions
        : [...p.subscriptions, c].sort((a, b) => a.name.localeCompare(b.name)),
      blockedChannels: p.blockedChannels.filter((b) => b.id !== c.id),
    }));
  },
  unsubscribe(id: string) {
    setPrefs((p) => ({ subscriptions: p.subscriptions.filter((s) => s.id !== id) }));
  },
  block(c: Pick<Channel, "id" | "name">) {
    setPrefs((p) => ({
      blockedChannels: p.blockedChannels.some((b) => b.id === c.id) ? p.blockedChannels : [...p.blockedChannels, c],
      subscriptions: p.subscriptions.filter((s) => s.id !== c.id),
    }));
  },
  unblock(id: string) {
    setPrefs((p) => ({ blockedChannels: p.blockedChannels.filter((b) => b.id !== id) }));
  },
  toggleLater(v: Video) {
    setPrefs((p) => ({
      watchLater: p.watchLater.some((w) => w.id === v.id)
        ? p.watchLater.filter((w) => w.id !== v.id)
        : [v, ...p.watchLater],
    }));
  },
  watched(v: Video) {
    setPrefs((p) => ({
      history: [{ ...v, watchedAt: new Date().toISOString() }, ...p.history.filter((h) => h.id !== v.id)].slice(0, 500),
    }));
  },
  clearHistory() {
    setPrefs({ history: [] });
  },
};
