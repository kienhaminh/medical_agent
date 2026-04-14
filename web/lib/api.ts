const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api`;

// --- Auth API ---

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: "doctor" | "admin";
  department?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Invalid credentials");
  }
  return res.json();
}

export async function getMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export interface Patient {
  id: number;
  name: string;
  dob: string;
  gender: string;
  created_at: string;
}

export interface Tool {
  id: number;
  name: string;
  symbol: string;
  description?: string;
  tool_type: "function" | "api";
  code?: string;
  api_endpoint?: string;
  api_request_payload?: string;
  api_request_example?: string;
  api_response_payload?: string;
  api_response_example?: string;
  enabled?: boolean;
  test_passed?: boolean;
  scope?: "global" | "assignable" | "both";
  category?: string;
  assigned_agent_id?: number | null;
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  record_type: "text" | "image" | "pdf";
  title: string;
  description?: string;
  content?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
}

export type SegmentationResult =
  | {
      status: "success";
      patient_id: string; // MCP echoes the patient_id as a string
      input: {
        modalities_provided: string[];
        shape_zyx: [number, number, number];
        slice_index: number;
      };
      model: {
        architecture: string;
        device: string;
      };
      prediction: {
        pred_classes_in_slice: number[];
      };
      artifacts: {
        overlay_image: { url: string };
        predmask_image: { url: string };
        pred_mask_3d?: { url: string; format: string };
      };
      /** Supabase Storage URL patterns for pre-generated slices. Replace {z} with slice index. */
      slice_url_pattern?: {
        mri: string;
        mask: string;
      } | null;
    }
  | { status: "error" | "unknown"; [key: string]: unknown };

export interface Imaging {
  id: number;
  patient_id: number;
  title: string;
  description?: string;
  image_type: string;
  original_url: string;
  preview_url: string;
  group_id?: number;
  segmentation_result?: SegmentationResult | null;
  slice_index?: number | null;
  aligned_preview_url?: string | null;
  volume_depth?: number | null;
  created_at: string;
}

export interface ImageGroup {
  id: number;
  patient_id: number;
  name: string;
  created_at: string;
}

export interface PatientDetail extends Patient {
  records?: MedicalRecord[];
  imaging?: Imaging[];
  image_groups?: ImageGroup[];
}

export async function getPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_BASE_URL}/patients`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json();
}

export async function getPatient(id: number): Promise<PatientDetail> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}`);
  if (!res.ok) throw new Error("Failed to fetch patient");
  return res.json();
}

export async function runSegmentation(
  patientId: number,
  imagingId: number
): Promise<Imaging> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/segment`,
    { method: "POST" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Segmentation failed");
  }
  return res.json();
}

export async function runSegmentationAsync(
  patientId: number,
  imagingId: number,
  opts?: { userId?: string; sessionId?: number | null },
): Promise<{ status: string; imaging_id: number }> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/segment-async`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: opts?.userId ?? null,
        session_id: opts?.sessionId ?? null,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Segment-async failed: ${res.status}`);
  }
  return res.json();
}

export async function createPatient(
  data: Omit<Patient, "id" | "created_at">
): Promise<Patient> {
  const res = await fetch(`${API_BASE_URL}/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create patient");
  return res.json();
}

export async function getTools(): Promise<Tool[]> {
  const res = await fetch(`${API_BASE_URL}/tools`);
  if (!res.ok) throw new Error("Failed to fetch tools");
  return res.json();
}

export async function createTool(
  tool: Omit<Tool, "assigned_agent_id" | "id">
): Promise<Tool> {
  const res = await fetch(`${API_BASE_URL}/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
  if (!res.ok) throw new Error("Failed to create tool");
  return res.json();
}

export async function updateTool(
  id: number,
  tool: Partial<Tool>
): Promise<Tool> {
  if (!id || id === undefined || isNaN(id)) {
    throw new Error(
      "Tool ID is required and must be a valid number. Please refresh the page and try again."
    );
  }

  const url = `${API_BASE_URL}/tools/${id}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to update tool: ${res.status} ${errorText}`);
  }
  return res.json();
}

export async function deleteTool(id: number): Promise<void> {
  if (!id || id === undefined || isNaN(id)) {
    throw new Error(
      "Tool ID is required and must be a valid number. Please refresh the page and try again."
    );
  }

  const res = await fetch(`${API_BASE_URL}/tools/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete tool");
}

export interface ToolTestRequest {
  tool_type: "function" | "api";
  code?: string;
  api_endpoint?: string;
  api_request_payload?: string;
  arguments: Record<string, any>;
}

export interface ToolTestResponse {
  result?: string;
  error?: string;
  status: "success" | "error";
}

export async function testTool(
  data: ToolTestRequest
): Promise<ToolTestResponse> {
  const res = await fetch(`${API_BASE_URL}/tools/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to test tool");
  return res.json();
}

// Medical Records API
export async function getPatientRecords(
  patientId: number
): Promise<MedicalRecord[]> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records`);
  if (!res.ok) throw new Error("Failed to fetch patient records");
  return res.json();
}

export async function createImageGroup(
  patientId: number,
  name: string
): Promise<ImageGroup> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/image-groups`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  if (!res.ok) throw new Error("Failed to create image group");
  return res.json();
}

export async function getImageGroups(patientId: number): Promise<ImageGroup[]> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/image-groups`);
  if (!res.ok) throw new Error("Failed to fetch image groups");
  return res.json();
}

export async function addTextRecord(
  patientId: number,
  data: { title: string; content: string; description?: string }
): Promise<MedicalRecord> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add text record");
  return res.json();
}

export async function deleteRecord(recordId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete record");
}

export async function getPatientImaging(patientId: number): Promise<Imaging[]> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/imaging`);
  if (!res.ok) throw new Error("Failed to fetch imaging records");
  return res.json();
}

export async function deleteImagingRecord(
  patientId: number,
  imagingId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) throw new Error("Failed to delete imaging record");
}

// --- Agent API ---

export interface AgentConfig {
  name: string;
  role: string;
  description: string;
  color: string;
  icon: string;
  is_template: boolean;
  tools: string[];
}

export async function getAgents(): Promise<AgentConfig[]> {
  const res = await fetch(`${API_BASE_URL}/agents`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

// --- Chat Session API ---

export interface ChatSession {
  id: number;
  title: string;
  agent_id: number | null;
  agent_name: string | null;
  message_count: number;
  preview: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  tool_calls: string | null;
  reasoning: string | null;
  patient_references: string | null;
  created_at: string;
  // Background task fields
  status?: string; // 'pending' | 'streaming' | 'completed' | 'error' | 'interrupted'
  task_id?: string | null;
  logs?: string | null;
  streaming_started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  last_updated_at?: string | null;
  token_usage?: string | null; // JSON string of token usage
}

export interface ChatTaskResponse {
  task_id: string;
  message_id: number;
  session_id: number;
  status: string;
}

export interface TaskStatusResponse {
  task_id: string;
  status: string; // 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY'
  message_id: number;
  content_preview: string | null;
  error: string | null;
  result: any | null;
}

export interface ChatSessionCreate {
  title: string;
  agent_id: number | null;
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions`);
  if (!res.ok) throw new Error("Failed to fetch chat sessions");
  return res.json();
}

export async function getChatSession(sessionId: number): Promise<ChatSession> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch chat session");
  return res.json();
}

export async function getSessionMessages(
  sessionId: number
): Promise<ChatMessage[]> {
  const res = await fetch(
    `${API_BASE_URL}/chat/sessions/${sessionId}/messages`
  );
  if (!res.ok) throw new Error("Failed to fetch session messages");
  return res.json();
}

export async function createChatSession(
  data: ChatSessionCreate
): Promise<ChatSession> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create chat session");
  return res.json();
}

export async function deleteChatSession(sessionId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete chat session");
}

// ===== Direct Streaming Chat (no Celery/Redis required) =====

export type DirectStreamEvent =
  | { type: "session"; session_id: number }
  | StreamEvent;

/**
 * Stream a chat message directly via POST SSE, bypassing Celery/Redis.
 * Parses SSE from /api/chat and normalizes events into StreamEvent shape.
 */
export async function* streamChatDirect(data: {
  message: string;
  patient_id?: number | null;
  session_id?: number | null;
  user_id?: string;
  signal?: AbortSignal;
}): AsyncGenerator<DirectStreamEvent> {
  const { signal, ...body } = data;
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to send message");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(raw); } catch { continue; }

        if (parsed.session_id !== undefined) {
          yield { type: "session", session_id: parsed.session_id as number };
        } else if (parsed.done) {
          yield { type: "done" };
          return;
        } else if (parsed.error) {
          yield { type: "error", message: parsed.error as string };
          return;
        } else if (parsed.chunk !== undefined) {
          yield { type: "content", content: parsed.chunk as string };
        } else if (parsed.tool_call) {
          const tc = parsed.tool_call as Record<string, unknown>;
          yield { type: "tool_call", id: tc.id as string, tool: tc.tool as string, args: tc.args };
        } else if (parsed.tool_result) {
          const tr = parsed.tool_result as Record<string, unknown>;
          yield { type: "tool_result", id: tr.id as string, result: tr.result as string };
        } else if (parsed.reasoning !== undefined) {
          yield { type: "reasoning", content: parsed.reasoning as string };
        } else if (parsed.log !== undefined) {
          yield { type: "log", content: parsed.log };
        } else if (parsed.usage) {
          yield { type: "usage", usage: parsed.usage };
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

// ===== New Task-Based Chat Methods =====

export interface SendMessageRequest {
  message: string;
  user_id?: string;
  patient_id?: number | null;
  record_id?: number | null;
  visit_id?: number | null;
  session_id?: number | null;
}

/**
 * Send a chat message and dispatch background task for processing.
 * Returns immediately with task_id and message_id.
 */
export async function sendChatMessage(
  data: SendMessageRequest
): Promise<ChatTaskResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to send message");
  }
  return res.json();
}

/**
 * Get the status of a Celery task.
 */
export async function getTaskStatus(
  taskId: string
): Promise<TaskStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/tasks/${taskId}/status`);
  if (!res.ok) throw new Error("Failed to fetch task status");
  return res.json();
}

/**
 * Stream message updates via Server-Sent Events.
 * Polls database for message updates and closes when completed.
 */
export type StreamEvent =
  | { type: "chunk"; content: string }
  | { type: "content"; content: string } // New event type from backend
  | {
      type: "status";
      status: string;
      content?: string;
      tool_calls?: any[];
      reasoning?: string;
      logs?: any[];
      patient_references?: any[];
      error_message?: string;
      usage?: any;
    }
  | { type: "tool_call"; tool: string; id: string; args: any }
  | { type: "tool_result"; id: string; result: string }
  | { type: "reasoning"; content: string }
  | { type: "log"; content: any }
  | { type: "patient_references"; patient_references: any[] }
  | { type: "usage"; usage: any }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Stream message updates via Server-Sent Events.
 * Polls database for message updates and closes when completed.
 */
export function streamMessageUpdates(
  messageId: number,
  onEvent: (event: StreamEvent) => void,
  onError: (error: Error) => void
): () => void {
  const eventSource = new EventSource(
    `${API_BASE_URL}/chat/messages/${messageId}/stream`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.done || data.type === "done") {
        eventSource.close();
        onEvent({ type: "done" });
        return;
      }

      if (data.error && !data.type) {
        eventSource.close();
        onError(new Error(data.error));
        return;
      }

      // Handle new event format
      if (data.type) {
        onEvent(data as StreamEvent);
      } else {
        // Legacy format (if any) or fallback
        // onUpdate(data);
        // For now, we assume backend only sends typed events or we map them
        if (data.content) onEvent({ type: "chunk", content: data.content });
        if (data.status)
          onEvent({ type: "status", status: data.status, ...data });
      }
    } catch (err) {
      onError(err as Error);
    }
  };

  eventSource.onerror = (err) => {
    eventSource.close();
    onError(new Error("Stream connection error"));
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

/**
 * Cancel a running agent task for a message.
 */
export async function cancelMessage(messageId: number): Promise<void> {
  await fetch(`${API_BASE_URL}/chat/messages/${messageId}/cancel`, {
    method: "POST",
  });
}

/**
 * Poll for message updates using exponential backoff.
 * More efficient than continuous SSE for completed messages.
 */
export async function pollMessageStatus(
  sessionId: number,
  messageId: number,
  onUpdate: (message: ChatMessage) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  options: {
    initialDelay?: number;
    maxDelay?: number;
    maxAttempts?: number;
  } = {}
): Promise<() => void> {
  const { initialDelay = 1000, maxDelay = 10000, maxAttempts = 60 } = options;

  let delay = initialDelay;
  let attempts = 0;
  let cancelled = false;

  const poll = async () => {
    if (cancelled || attempts >= maxAttempts) {
      onError(new Error("Polling timeout"));
      return;
    }

    attempts++;

    try {
      // Fetch all messages to get the latest status
      const messages = await getSessionMessages(sessionId);
      const message = messages.find((m) => m.id === messageId);

      if (!message) {
        onError(new Error("Message not found"));
        return;
      }

      // Send update
      onUpdate(message);

      // Check if completed
      if (
        message.status === "completed" ||
        message.status === "error" ||
        message.status === "interrupted"
      ) {
        onComplete();
        return;
      }

      // Continue polling with exponential backoff
      delay = Math.min(delay * 1.5, maxDelay);
      setTimeout(poll, delay);
    } catch (err) {
      onError(err as Error);
    }
  };

  // Start polling
  setTimeout(poll, delay);

  // Return cancel function
  return () => {
    cancelled = true;
  };
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  message_count: number;
}

export async function getUsageStats(): Promise<UsageStats> {
  const res = await fetch(`${API_BASE_URL}/usage/stats`);
  if (!res.ok) throw new Error("Failed to fetch usage stats");
  return res.json();
}

export interface ErrorLog {
  id: number;
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  component: string;
  details: string;
  session_id?: number;
}

export async function getErrorLogs(limit: number = 50): Promise<ErrorLog[]> {
  const res = await fetch(`${API_BASE_URL}/usage/errors?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch error logs");
  return res.json();
}

// --- Visit types ---

export interface DepartmentInfo {
  name: string;
  label: string;
  capacity: number;
  is_open: boolean;
  color: string;
  icon: string;
  current_patient_count: number;
  queue_length: number;
  status: "IDLE" | "OK" | "BUSY" | "CRITICAL";
}

export interface RoomInfo {
  id: number;
  room_number: string;
  department_name: string;
  current_visit_id: number | null;
  patient_name: string | null;
  chief_complaint: string | null;
  checked_in_at: string | null;
}

export interface HospitalStats {
  active_patients: number;
  departments_at_capacity: number;
  avg_wait_minutes: number;
  discharged_today: number;
}

export interface Visit {
  id: number;
  visit_id: string;
  patient_id: number;
  status: string;
  confidence: number | null;
  routing_suggestion: string[] | null;
  routing_decision: string[] | null;
  chief_complaint: string | null;
  intake_session_id: number | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  current_department: string | null;
  queue_position: number | null;
  clinical_notes: string | null;
  assigned_doctor: string | null;
}

export interface VisitDetail extends Visit {
  patient_name: string;
  patient_dob: string;
  patient_gender: string;
  intake_notes: string | null;
}

export interface VisitListItem extends Visit {
  patient_name: string;
  urgency_level?: "routine" | "urgent" | "critical" | null;
  wait_minutes?: number;
}

// --- Visit API functions ---

export async function createVisit(patientId: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create visit");
  }
  return response.json();
}

export async function listVisits(params?: {
  status?: string;
  patient_id?: number;
  limit?: number;
  offset?: number;
}): Promise<Visit[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.patient_id) searchParams.set("patient_id", String(params.patient_id));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/visits${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch visits");
  return response.json();
}

export async function getVisit(id: number): Promise<VisitDetail> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}`);
  if (!response.ok) throw new Error("Failed to fetch visit");
  return response.json();
}

export async function routeVisit(
  id: number,
  routingDecision: string[],
  reviewedBy: string
): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/route`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_decision: routingDecision,
      reviewed_by: reviewedBy,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to route visit");
  }
  return response.json();
}

export async function listActiveVisits(department?: string): Promise<VisitListItem[]> {
  const params = new URLSearchParams({ exclude_status: "completed", limit: "500" });
  if (department) params.set("department", department);
  const response = await fetch(`${API_BASE_URL}/visits?${params}`);
  if (!response.ok) throw new Error("Failed to fetch active visits");
  return response.json();
}

export async function getVisitBrief(visitId: number): Promise<{ brief: string }> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/brief`);
  if (!response.ok) throw new Error("Failed to fetch visit brief");
  return response.json();
}

export async function checkInVisit(id: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/check-in`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to check in visit");
  }
  return response.json();
}

export async function completeVisit(id: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/complete`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to complete visit");
  }
  return response.json();
}

// --- Department API ---

export async function listDepartments(): Promise<DepartmentInfo[]> {
  const response = await fetch(`${API_BASE_URL}/departments`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch departments");
  }
  return response.json();
}

export async function listRooms(): Promise<RoomInfo[]> {
  const response = await fetch(`${API_BASE_URL}/rooms`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch rooms");
  }
  return response.json();
}

export async function updateDepartment(
  name: string,
  update: { capacity?: number; is_open?: boolean }
): Promise<DepartmentInfo> {
  const response = await fetch(`${API_BASE_URL}/departments/${name}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update department");
  }
  return response.json();
}

export async function transferVisit(
  visitId: number,
  targetDepartment: string
): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_department: targetDepartment }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to transfer visit");
  }
  return response.json();
}

export async function getHospitalStats(): Promise<HospitalStats> {
  const response = await fetch(`${API_BASE_URL}/hospital/stats`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch hospital stats");
  }
  return response.json();
}

// --- Doctor Portal API ---

export async function searchPatients(query: string): Promise<Patient[]> {
  const response = await fetch(`${API_BASE_URL}/patients?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Failed to search patients");
  return response.json();
}

export async function getVisitsByDepartment(
  department: string,
  status?: string
): Promise<VisitListItem[]> {
  const params = new URLSearchParams({ department });
  if (status) params.set("status", status);
  const response = await fetch(`${API_BASE_URL}/visits?${params}`);
  if (!response.ok) throw new Error("Failed to fetch department visits");
  return response.json();
}

export async function assignVisitDoctor(visitId: number, doctorName: string): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assigned_doctor: doctorName }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to assign doctor");
  }
  return response.json();
}

export async function saveClinicalNotes(
  visitId: number,
  clinicalNotes: string,
  assignedDoctor?: string
): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clinical_notes: clinicalNotes,
      ...(assignedDoctor && { assigned_doctor: assignedDoctor }),
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save clinical notes");
  }
  return response.json();
}

// --- Differential Diagnosis API ---

export interface DiagnosisItem {
  name: string;
  icd10: string;
  likelihood: "High" | "Medium" | "Low";
  evidence: string;
  red_flags: string[];
}

export interface DDxResponse {
  visit_id: number;
  chief_complaint?: string;
  diagnoses: DiagnosisItem[];
  error?: string;
}

export async function getDifferentialDiagnosis(visitId: number): Promise<DDxResponse> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/ddx`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to generate differential diagnosis");
  return response.json();
}

// --- Shift Handoff API ---

export interface HandoffResponse {
  document: string;
  patient_count: number;
  department?: string;
}

export async function getShiftHandoff(department?: string): Promise<HandoffResponse> {
  const url = department
    ? `${API_BASE_URL}/visits/handoff?department=${encodeURIComponent(department)}`
    : `${API_BASE_URL}/visits/handoff`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to generate shift handoff");
  return response.json();
}

// --- Officer Portal API ---

export interface ExtendedHospitalStats extends HospitalStats {
  total_beds: number;
  occupied_beds: number;
  occupancy_rate: number;
  visits_by_status: Record<string, number>;
}

export async function getExtendedStats(): Promise<ExtendedHospitalStats> {
  const response = await fetch(`${API_BASE_URL}/hospital/extended-stats`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch extended stats");
  }
  return response.json();
}

