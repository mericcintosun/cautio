import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, Lease } from "@/lib/types";

export async function GET() {
  const adapter = getAdapter();
  const body: ApiResponse<Lease[]> = { ok: true, source: adapter.mode, data: await adapter.listLeases() };
  return NextResponse.json(body, { status: 200 });
}
