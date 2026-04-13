import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params;
  const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
  const res = await fetch(
    `${backendUrl}/api/visits/${visitId}/track`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json(null, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
