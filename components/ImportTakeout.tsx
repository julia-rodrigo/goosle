"use client";

import { useRef, useState } from "react";
import { setPrefs } from "@/lib/store";
import type { Channel } from "@/lib/types";

/**
 * Imports subscriptions.csv from Google Takeout
 * (takeout.google.com → YouTube → subscriptions). Columns: Channel Id, Channel Url, Channel Title.
 */
export function ImportTakeout() {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  async function onFile(f: File) {
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim());
    const found: Channel[] = [];
    for (const line of lines) {
      const id = line.match(/UC[\w-]{22}/)?.[0];
      if (!id) continue; // header or junk
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
      const name = cells[2]?.trim() || cells.find((c) => c && !c.includes(id))?.trim() || id;
      found.push({ id, name });
    }
    if (!found.length) {
      setMsg("No channels found. Pick the subscriptions.csv file from your Takeout download.");
      return;
    }
    let added = 0;
    setPrefs((p) => {
      const have = new Set(p.subscriptions.map((s) => s.id));
      const fresh = found.filter((c) => !have.has(c.id) && (have.add(c.id), true));
      added = fresh.length;
      return { subscriptions: [...p.subscriptions, ...fresh].sort((a, b) => a.name.localeCompare(b.name)) };
    });
    setMsg(`Imported ${added} new channel${added === 1 ? "" : "s"}.`);
  }

  return (
    <div className="rounded-2xl border border-dashed border-line p-4 text-sm">
      <p className="font-medium">Bring your YouTube subscriptions</p>
      <p className="mt-1 text-muted">
        Go to{" "}
        <a className="underline" href="https://takeout.google.com/settings/takeout/custom/youtube" target="_blank" rel="noreferrer">
          Google Takeout
        </a>
        , export only “subscriptions”, unzip it, and pick <code>subscriptions.csv</code>.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn" onClick={() => file.current?.click()}>Choose subscriptions.csv</button>
        {msg && <span className="text-muted">{msg}</span>}
      </div>
      <input
        ref={file}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
