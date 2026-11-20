import { NextResponse } from "next/server";
import { search } from "@/lib/youtube";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) return NextResponse.json({ videos: [], source: "page" });
  try {
    return NextResponse.json(await search(q));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
