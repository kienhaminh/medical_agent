import { NextRequest, NextResponse } from "next/server";

// This is a catch-all proxy for /api/patients/* routes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyToPythonBackend(request, resolvedParams.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyToPythonBackend(request, resolvedParams.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyToPythonBackend(request, resolvedParams.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyToPythonBackend(request, resolvedParams.path);
}

async function proxyToPythonBackend(
  request: NextRequest,
  pathSegments: string[]
) {
  try {
    const pythonBackendUrl =
      process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

    // Reconstruct the full path
    const path = pathSegments?.length ? pathSegments.join("/") : "";
    const url = `${pythonBackendUrl}/api/patients${path ? `/${path}` : ""}`;

    console.log(`Proxying ${request.method} request to: ${url}`);

    // Get the request body if it exists
    let body = null;
    if (request.method !== "GET" && request.method !== "DELETE") {
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          body = await request.json();
          console.log("Request body:", body);
        } catch (e) {
          console.log("No JSON body or invalid JSON");
        }
      } else if (contentType?.includes("multipart/form-data")) {
        // For file uploads, we need to handle FormData differently
        // For now, we'll skip this and handle it separately
        console.log("FormData detected - skipping proxy");
        return NextResponse.json(
          { error: "File uploads not supported through proxy" },
          { status: 400 }
        );
      }
    }

    const response = await fetch(url, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Backend API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Backend proxy error:", error);
    return NextResponse.json(
      { error: `Failed to connect to backend: ${error}` },
      { status: 500 }
    );
  }
}
