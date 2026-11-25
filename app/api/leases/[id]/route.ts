import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import { toCoreError } from "@/lib/errors";
import { leaseSlugSchema } from "@/lib/schemas";
import type { ApiResponse, Lease } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = leaseSlugSchema.safeParse(id);
  if (!parsed.success) {
    const body: ApiResponse<Lease> = {
      ok: false,
      source: "fake",
      error: "invalid_input",
      hint: "A lease id is 1 to 64 lowercase letters, digits or hyphens, like rua-harmonia-302.",
    };
    return NextResponse.json(body, { status: 400 });
  }

  const adapter = getAdapter();
  try {
    const lease = await adapter.getLease(parsed.data);
    if (!lease) {
      const body: ApiResponse<Lease> = {
        ok: false,
        source: adapter.mode,
        error: "not_found",
        hint: "No lease at the desk has that id.",
      };
      return NextResponse.json(body, { status: 404 });
    }
    const body: ApiResponse<Lease> = { ok: true, source: adapter.mode, data: lease };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    const body: ApiResponse<Lease> = { ok: false, source: adapter.mode, ...toCoreError(err) };
    return NextResponse.json(body, { status: 502 });
  }
}
