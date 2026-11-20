import { NextResponse } from "next/server";
import { resolveChannel } from "@/lib/youtube";

// GET /api/channel/resolve?q=@handle | URL | UC…
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  try {
    return NextResponse.json(await resolveChannel(q.slice(0, 300)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
