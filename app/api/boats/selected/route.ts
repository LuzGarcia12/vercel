import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = (globalThis.crypto as any)?.randomUUID?.() ?? String(Date.now());

  try {
    const body = await req.json().catch(() => ({}));
    const boatIds = Array.isArray(body?.boatIds) ? body.boatIds : [];

    const url = process.env.N8N_WEBHOOK_SELECTED_URL;
    if (!url) {
      console.error(`[${requestId}] missing env N8N_WEBHOOK_SELECTED_URL`);
      return NextResponse.json(
        { ok: false, error: "missing env N8N_WEBHOOK_SELECTED_URL", requestId },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] sending to n8n`, url, `ids=${boatIds.length}`);

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ boatIds }),
    });

    const text = await upstream.text();
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    console.log(
      `[${requestId}] n8n status=${upstream.status} ok=${upstream.ok} body=${text.slice(0, 250)}`
    );

    // importante: devolvemos el status real de n8n (así ves si es 404, 500, etc.)
    return NextResponse.json(
      { ok: upstream.ok, upstreamStatus: upstream.status, data, requestId },
      { status: upstream.status }
    );
  } catch (err: any) {
    console.error(`[${requestId}] route error`, err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "route error", requestId },
      { status: 500 }
    );
  }
}
