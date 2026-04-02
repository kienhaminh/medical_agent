const API_BASE_URL = "http://localhost:8000/api";

export interface TranscriptResponse {
  text: string;
  source: "whisper" | "browser";
}

export async function transcribeAudio(
  visitId: number,
  audioBlob: Blob
): Promise<TranscriptResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(
    `${API_BASE_URL}/visits/${visitId}/transcribe`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Transcription failed");
  }

  return response.json();
}

export async function saveTranscript(
  visitId: number,
  text: string
): Promise<TranscriptResponse> {
  const response = await fetch(
    `${API_BASE_URL}/visits/${visitId}/transcript`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save transcript");
  }

  return response.json();
}
