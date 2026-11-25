import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import { toCoreError } from "@/lib/errors";
import type { ApiResponse, Lease } from "@/lib/types";

export async function GET() {
  const adapter = getAdapter();
  try {
    const body: ApiResponse<Lease[]> = { ok: true, source: adapter.mode, data: await adapter.listLeases() };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    const body: ApiResponse<Lease[]> = { ok: false, source: adapter.mode, ...toCoreError(err) };
    return NextResponse.json(body, { status: 502 });
  }
}
