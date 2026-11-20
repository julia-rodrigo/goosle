"use client";

import Link from "next/link";
import { actions, usePrefs } from "@/lib/store";
import { AddChannel } from "@/components/AddChannel";
import { ImportTakeout } from "@/components/ImportTakeout";

export default function Subscriptions() {
  const prefs = usePrefs();
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted">These are the only channels in your feed. They&apos;re stored in this browser.</p>
      </div>
      <AddChannel />
      <ImportTakeout />
      {prefs && prefs.subscriptions.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {prefs.subscriptions.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-line text-sm font-semibold">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <Link href={`/channel/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {c.name}
                {c.handle && <span className="ml-2 text-sm font-normal text-muted">{c.handle}</span>}
              </Link>
              <button className="btn" onClick={() => actions.unsubscribe(c.id)}>Unsubscribe</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
