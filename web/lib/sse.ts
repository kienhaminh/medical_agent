"use client";

export type SsePayload = Record<string, unknown>;

/**
 * Parse SSE payloads across arbitrary network chunk boundaries.
 * Large JSON events such as form_request do not fit in a single read reliably.
 */
export function createSseParser(onPayload: (payload: SsePayload) => void) {
  let buffer = "";

  return (chunk: string) => {
    buffer += chunk;

    const rawEvents = buffer.split("\n\n");
    buffer = rawEvents.pop() ?? "";

    for (const rawEvent of rawEvents) {
      const data = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");

      if (!data) continue;

      try {
        onPayload(JSON.parse(data) as SsePayload);
      } catch {
        // Ignore malformed events.
      }
    }
  };
}
