import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId =
    (globalThis.crypto as any)?.randomUUID?.() ?? String(Date.now());

  try {
    const body = await req.json().catch(() => null);

    const url = process.env.N8N_WEBHOOK_PROPOSAL_URL;
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "missing env N8N_WEBHOOK_PROPOSAL_URL", requestId },
        { status: 500 }
      );
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

    const text = await upstream.text().catch(() => "");
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    return NextResponse.json(
      { ok: upstream.ok, upstreamStatus: upstream.status, data, requestId },
      { status: upstream.status }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "route error", requestId },
      { status: 500 }
    );
  }
}
