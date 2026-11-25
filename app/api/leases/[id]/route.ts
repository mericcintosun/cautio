import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, Lease } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adapter = getAdapter();
  const lease = await adapter.getLease(id);
  if (!lease) {
    const body: ApiResponse<Lease> = { ok: false, source: adapter.mode, error: "No lease with that id" };
    return NextResponse.json(body, { status: 404 });
  }
  const body: ApiResponse<Lease> = { ok: true, source: adapter.mode, data: lease };
  return NextResponse.json(body, { status: 200 });
}
