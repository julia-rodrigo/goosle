"use client";

import { useRef, useState } from "react";
import { DEFAULT_SLOP_WORDS, actions, replacePrefs, setPrefs, usePrefs, type Prefs } from "@/lib/store";

export default function Settings() {
  const prefs = usePrefs();
  if (!prefs) return null;
  return (
    <section className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Filters</h1>
        <p className="text-sm text-muted">
          These apply to your feed, search and channel pages. Hidden videos are counted at the top of each page, and you
          can always show them.
        </p>
      </div>

      <Group title="What to hide">
        <Toggle label="Shorts" hint="Vertical clips under a minute." k="hideShorts" prefs={prefs} />
        <Toggle label="AI and slop" hint="Videos matching the phrases below." k="hideSlop" prefs={prefs} />
        <Toggle label="Live streams" k="hideLive" prefs={prefs} />
        <Toggle label="Videos I've already watched" k="hideWatched" prefs={prefs} />
        <label className="flex items-center justify-between gap-4 py-3">
          <span>
            <span className="block font-medium">Minimum length</span>
            <span className="text-sm text-muted">Only applies where the length is known (search results).</span>
          </span>
          <select
            className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm"
            value={prefs.minMinutes}
            onChange={(e) => setPrefs({ minMinutes: Number(e.target.value) })}
          >
            {[0, 2, 5, 10, 20].map((m) => (
              <option key={m} value={m}>{m === 0 ? "Any" : `${m}+ min`}</option>
            ))}
          </select>
        </label>
      </Group>

      <Group title="AI / slop phrases" hint="Matched as whole words in titles, channel names and descriptions.">
        <WordList
          words={prefs.slopWords}
          onChange={(slopWords) => setPrefs({ slopWords })}
          extra={
            <button className="text-sm text-muted underline hover:text-fg" onClick={() => setPrefs({ slopWords: DEFAULT_SLOP_WORDS })}>
              Reset to defaults
            </button>
          }
        />
      </Group>

      <Group title="Blocked words" hint="Anything you never want to see, like a topic, a game or a person.">
        <WordList words={prefs.blockedWords} onChange={(blockedWords) => setPrefs({ blockedWords })} />
      </Group>

      <Group title="Blocked channels" hint="Use “⋮ → Never show this channel” on any video to add one.">
        {prefs.blockedChannels.length === 0 ? (
          <p className="py-2 text-sm text-muted">None yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 py-2">
            {prefs.blockedChannels.map((c) => (
              <span key={c.id} className="chip">
                {c.name || c.id}
                <button aria-label={`Unblock ${c.name}`} className="text-muted hover:text-fg" onClick={() => actions.unblock(c.id)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </Group>

      <Group title="Your data" hint="Everything is stored in this browser. Export it to move to another device.">
        <Backup prefs={prefs} />
      </Group>
    </section>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="mt-2 divide-y divide-line">{children}</div>
    </div>
  );
}

type BoolKey = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

function Toggle({ label, hint, k, prefs }: { label: string; hint?: string; k: BoolKey; prefs: Prefs }) {
  const on = prefs[k];
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => setPrefs({ [k]: e.target.checked })} />
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? "bg-accent" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}

function WordList({ words, onChange, extra }: { words: string[]; onChange: (w: string[]) => void; extra?: React.ReactNode }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-3 py-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const add = draft.split(",").map((w) => w.trim().toLowerCase()).filter((w) => w && !words.includes(w));
          if (add.length) onChange([...words, ...add]);
          setDraft("");
        }}
      >
        <input className="input" placeholder="Add a word or phrase" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn shrink-0" disabled={!draft.trim()}>Add</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <span key={w} className="chip">
            {w}
            <button aria-label={`Remove ${w}`} className="text-muted hover:text-fg" onClick={() => onChange(words.filter((x) => x !== w))}>
              ×
            </button>
          </span>
        ))}
      </div>
      {extra}
    </div>
  );
}

function Backup({ prefs }: { prefs: Prefs }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <button
        className="btn"
        onClick={() => {
          const blob = new Blob([JSON.stringify(prefs, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "goosle-backup.json";
          a.click();
          URL.revokeObjectURL(a.href);
        }}
      >
        Export
      </button>
      <button className="btn" onClick={() => file.current?.click()}>Import</button>
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!data || typeof data !== "object" || !Array.isArray(data.subscriptions)) throw new Error();
            replacePrefs(data);
            setMsg("Imported.");
          } catch {
            setMsg("That file isn't a Goosle backup.");
          }
          e.target.value = "";
        }}
      />
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
