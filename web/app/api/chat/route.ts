import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, stream, session_id, patient_id, record_id, user_id, mode } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    // Call Python backend API
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    try {
      const body: Record<string, unknown> = {
        message,
        stream: stream || false,
      };
      if (session_id) body.session_id = session_id;
      if (patient_id) body.patient_id = patient_id;
      if (record_id) body.record_id = record_id;
      if (user_id) body.user_id = user_id;
      if (mode) body.mode = mode;

      const response = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      // If streaming, pass through the stream
      if (stream && response.body) {
        return new NextResponse(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      // Non-streaming response
      const data = await response.json();
      return NextResponse.json(data);
    } catch (backendError) {
      console.error("Backend connection error:", backendError);

      // Fallback to mock response if backend is not available
      const mockResponse = {
        content: `⚠️ Backend not available. Start the Python backend:\n\n1. Set GOOGLE_API_KEY in .env file\n2. Run: python -m src.api.server\n3. Backend will run on http://localhost:8000\n\nYour message: "${message}"`,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(mockResponse);
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Chat API endpoint is running",
  });
}
