import { NextRequest, NextResponse } from "next/server";

const pythonBackendUrl =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const body = await request.json();
    const response = await fetch(
      `${pythonBackendUrl}/api/chat/${sessionId}/form-response`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: detail },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Backend not available" },
      { status: 502 }
    );
  }
}
