import type { Prefs } from "./store";
import type { Video } from "./types";

export type HiddenReason = "short" | "slop" | "blocked channel" | "blocked word" | "live" | "too short" | "watched";

function seconds(d?: string) {
  if (!d) return undefined;
  return d.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
}

function matchWord(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.find((w) => {
    const word = w.trim().toLowerCase();
    if (!word) return false;
    // Whole-word/phrase match, so "sora" doesn't hide "Soraya" and "#ai" doesn't hide "#aircraft".
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(t);
  });
}

/** Why a video should be hidden under the current settings, or null to show it. */
export function hiddenReason(v: Video, p: Prefs): { reason: HiddenReason; detail?: string } | null {
  if (p.blockedChannels.some((b) => b.id === v.channelId)) return { reason: "blocked channel" };
  if (p.hideShorts && v.isShort) return { reason: "short" };
  if (p.hideLive && v.isLive) return { reason: "live" };

  const text = `${v.title}\n${v.channelName}\n${v.description ?? ""}`;
  const blocked = matchWord(text, p.blockedWords);
  if (blocked) return { reason: "blocked word", detail: blocked };
  if (p.hideSlop) {
    const slop = matchWord(text, p.slopWords);
    if (slop) return { reason: "slop", detail: slop };
  }

  const secs = seconds(v.duration);
  if (p.minMinutes > 0 && secs !== undefined && secs < p.minMinutes * 60) return { reason: "too short" };
  if (p.hideWatched && p.history.some((h) => h.id === v.id)) return { reason: "watched" };
  return null;
}

export function applyFilters(videos: Video[], p: Prefs) {
  const shown: Video[] = [];
  const hidden: { video: Video; reason: HiddenReason; detail?: string }[] = [];
  for (const v of videos) {
    const r = hiddenReason(v, p);
    if (r) hidden.push({ video: v, ...r });
    else shown.push(v);
  }
  return { shown, hidden };
}
