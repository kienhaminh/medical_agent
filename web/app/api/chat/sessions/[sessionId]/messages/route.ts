import { NextRequest, NextResponse } from "next/server";

const pythonBackendUrl =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const response = await fetch(
      `${pythonBackendUrl}/api/chat/sessions/${sessionId}/messages`
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
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
