const API_BASE_URL = "http://localhost:8000/api";

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

export interface PatientVisit {
  id: number;
  patient_id: number;
  visit_date: string;
  visit_type: string; // 'routine' | 'emergency' | 'follow-up' | 'consultation'
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  notes: string;
  vital_signs?: {
    temperature?: string;
    blood_pressure?: string;
    heart_rate?: string;
    respiratory_rate?: string;
    oxygen_saturation?: string;
    weight?: string;
    height?: string;
  };
  doctor_name: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface MedicalRecord {
  id: number;
  patient_id: number;
  visit_id?: number; // Link to specific visit
  record_type: "text" | "image" | "pdf";
  title: string;
  description?: string;
  content?: string; // For text records
  file_url?: string; // For image/pdf records
  file_type?: string; // 'mri' | 'xray' | 'ct_scan' | 'ultrasound' | 'lab_report' | 'other'
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Imaging {
  id: number;
  patient_id: number;
  title: string;
  description?: string;
  image_type: string;
  original_url: string;
  preview_url: string;
  group_id?: number;
  created_at: string;
}

export interface ImageGroup {
  id: number;
  patient_id: number;
  name: string;
  created_at: string;
}

export interface PatientDetail extends Patient {
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  family_history?: string;
  health_summary?: string; // AI-generated overview
  health_summary_updated_at?: string; // Last generation timestamp
  health_summary_status?: "pending" | "generating" | "completed" | "error";
  health_summary_task_id?: string;
  records?: MedicalRecord[];
  imaging?: Imaging[];
  image_groups?: ImageGroup[];
  visits?: PatientVisit[];
}

export async function getPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_BASE_URL}/patients`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json();
}

export async function getPatient(id: number): Promise<Patient> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}`);
  if (!res.ok) throw new Error("Failed to fetch patient");
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
export async function getPatientDetail(id: number): Promise<PatientDetail> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}/detail`);
  if (!res.ok) throw new Error("Failed to fetch patient detail");
  return res.json();
}

export async function getPatientRecords(
  patientId: number
): Promise<MedicalRecord[]> {
  const res = await fetch(`${API_BASE_URL}/patients/${patientId}/records`);
  if (!res.ok) throw new Error("Failed to fetch patient records");
  return res.json();
}

export async function uploadMedicalRecord(
  patientId: number,
  file: File,
  metadata: { title: string; description?: string; file_type?: string }
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", metadata.title);
  if (metadata.description)
    formData.append("description", metadata.description);
  if (metadata.file_type) formData.append("file_type", metadata.file_type);

  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/records/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  if (!res.ok) throw new Error("Failed to upload medical record");
  return res.json();
}

export async function uploadImagingRecord(
  patientId: number,
  file: File,
  metadata: { title: string; image_type: string; group_id?: number }
): Promise<Imaging> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", metadata.title);
  formData.append("image_type", metadata.image_type);
  if (metadata.group_id)
    formData.append("group_id", metadata.group_id.toString());

  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  if (!res.ok) throw new Error("Failed to upload imaging record");
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

export interface HealthSummaryResponse {
  patient_id: number;
  health_summary?: string;
  health_summary_updated_at?: string;
  status: "pending" | "generating" | "completed" | "error";
  task_id?: string;
}

export interface UploadResponse {
  success: boolean;
  record: MedicalRecord;
}

/**
 * Regenerate AI health summary for a patient (Background Task).
 * Returns immediately with task_id. UI should stream updates.
 */
export async function regenerateHealthSummary(
  patientId: number
): Promise<HealthSummaryResponse> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/generate-summary`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to generate health summary");
  }
  return res.json();
}

/**
 * Stream health summary generation updates via Server-Sent Events.
 */
export function streamHealthSummaryUpdates(
  patientId: number,
  onChunk: (content: string) => void,
  onStatus: (status: string) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): () => void {
  const eventSource = new EventSource(
    `${API_BASE_URL}/patients/${patientId}/summary-stream`
  );

  let accumulatedContent = "";

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "done") {
        eventSource.close();
        onComplete();
        return;
      }

      if (data.error) {
        eventSource.close();
        onError(new Error(data.error));
        return;
      }

      if (data.type === "status") {
        onStatus(data.status);
        if (data.summary) {
          accumulatedContent = data.summary;
          onChunk(data.summary);
        }
      } else if (data.type === "chunk") {
        accumulatedContent += data.content;
        onChunk(data.content);
      } else if (data.type === "error") {
        eventSource.close();
        onError(new Error(data.message));
      }
    } catch (err) {
      console.error("Error parsing SSE data:", err);
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

// --- Agent API ---
import type {
  SubAgent,
  SubAgentCreate,
  SubAgentUpdate,
  AgentToolAssignment,
  AssignmentMatrixItem,
} from "@/types/agent";

export async function getAgents(): Promise<SubAgent[]> {
  const res = await fetch(`${API_BASE_URL}/agents`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function getAgent(id: number): Promise<SubAgent> {
  const res = await fetch(`${API_BASE_URL}/agents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch agent");
  return res.json();
}

export async function createAgent(data: SubAgentCreate): Promise<SubAgent> {
  const res = await fetch(`${API_BASE_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to create agent");
  }
  return res.json();
}

export async function updateAgent(
  id: number,
  data: SubAgentUpdate
): Promise<SubAgent> {
  const res = await fetch(`${API_BASE_URL}/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update agent");
  }
  return res.json();
}

export async function deleteAgent(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/agents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete agent");
}

export async function toggleAgent(
  id: number,
  enabled: boolean
): Promise<SubAgent> {
  const res = await fetch(`${API_BASE_URL}/agents/${id}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to toggle agent");
  return res.json();
}

export async function cloneAgent(id: number): Promise<SubAgent> {
  const res = await fetch(`${API_BASE_URL}/agents/${id}/clone`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to clone agent");
  return res.json();
}

// --- Tool Assignment API ---

export async function getAgentTools(agentId: number): Promise<Tool[]> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/tools`);
  if (!res.ok) throw new Error("Failed to fetch agent tools");
  return res.json();
}

export async function assignTool(
  agentId: number,
  toolName: string
): Promise<AgentToolAssignment> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_name: toolName }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to assign tool");
  }
  return res.json();
}

export async function unassignTool(
  agentId: number,
  toolId: number
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/tools/${toolId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to unassign tool");
}

export async function bulkUpdateAgentTools(
  agentId: number,
  toolNames: string[]
): Promise<AgentToolAssignment[]> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/tools`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_names: toolNames }),
  });
  if (!res.ok) throw new Error("Failed to update agent tools");
  return res.json();
}

export async function getAssignments(): Promise<AssignmentMatrixItem[]> {
  const res = await fetch(`${API_BASE_URL}/agent-tool-assignments`);
  if (!res.ok) throw new Error("Failed to fetch assignments");
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

// ===== New Task-Based Chat Methods =====

export interface SendMessageRequest {
  message: string;
  user_id?: string;
  patient_id?: number | null;
  record_id?: number | null;
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
