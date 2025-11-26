import { SubAgent } from "./agent";
import { Tool } from "@/lib/api";
import { MessageRole } from "@/types/enums";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  reasoning?: string;
  logs?: LogItem[];
  patientReferences?: PatientReference[];
  tokenUsage?: TokenUsage;
}

export type AgentActivity =
  | "thinking"
  | "tool_calling"
  | "analyzing"
  | "searching"
  | "processing";

export interface LogItem {
  message?: string;
  duration?: string;
  level?: "info" | "warning" | "error";
  timestamp?: string;
  type?: string;
  content?: unknown;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface SubAgentConsultation {
  agent: string;
  response: string;
}

export interface AgentProcessContainerProps {
  reasoning?: string;
  toolCalls?: ToolCall[];
  logs?: LogItem[];
  isLatest?: boolean;
  isLoading?: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  tokenUsage?: TokenUsage;
}

export interface ThinkingProgressProps {
  reasoning: string;
  logs?: LogItem[];
}

export interface ToolCallItemProps {
  toolCall: ToolCall;
}

export interface SubAgentConsultationItemProps {
  consultation: SubAgentConsultation;
}

export interface AgentMessageProps {
  content?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  logs?: LogItem[];
  timestamp: Date;
  isLoading?: boolean;
  isLatest?: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  patientReferences?: PatientReference[];
  sessionId?: string;
  tokenUsage?: TokenUsage;
}

export interface UserMessageProps {
  content: string;
}

export interface AssignmentCanvasProps {
  agents: SubAgent[];
  tools: Tool[];
  onAssign: (toolName: string, agentId: number) => Promise<void>;
  onUnassign: (toolId: number, agentId: number) => Promise<void>;
}

export interface AgentCreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface ToolCreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface AgentCardProps {
  agent: SubAgent;
  onUpdate: (updatedAgent?: SubAgent) => void;
  onDelete: () => void;
}

export interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: SubAgent;
  onSuccess: () => void;
}

export interface ToolAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: SubAgent;
  onSuccess: () => void;
}

export interface ToolCallLogProps {
  toolCalls: ToolCall[];
}

export interface PatientReference {
  patient_id: number;
  patient_name: string;
  start_index: number;
  end_index: number;
}

export interface AnswerContentProps {
  content: string;
  isLoading?: boolean;
  isLatest?: boolean;
  patientReferences?: PatientReference[];
  sessionId?: string;
}
