"use client";

import { useState } from "react";
import { actions } from "@/lib/store";
import { getJSON } from "@/lib/fetcher";
import type { Channel } from "@/lib/types";

export function AddChannel({ autoFocus }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const inputs = q.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!inputs.length) return;
    setBusy(true);
    setMsg(null);
    const added: string[] = [];
    const failed: string[] = [];
    for (const input of inputs) {
      try {
        const c = await getJSON<Channel>(`/api/channel/resolve?q=${encodeURIComponent(input)}`);
        actions.subscribe(c);
        added.push(c.name);
      } catch {
        failed.push(input);
      }
    }
    setBusy(false);
    setQ(failed.join(", "));
    setMsg({
      ok: failed.length === 0,
      text: [added.length && `Added ${added.join(", ")}.`, failed.length && `Couldn't find ${failed.join(", ")}.`]
        .filter(Boolean)
        .join(" "),
    });
  }

  return (
    <form onSubmit={add} className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="@handle, channel link, or several separated by commas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Channel to subscribe to"
        />
        <button className="btn-primary shrink-0" disabled={busy || !q.trim()}>
          {busy ? "Adding…" : "Subscribe"}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-muted" : "text-accent"}`}>{msg.text}</p>}
    </form>
  );
}
