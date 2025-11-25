import { Brain, Terminal, Sparkles, Search } from "lucide-react";
import { SubAgent } from "./agent";
import { Tool } from "@/lib/api";

export type AgentActivity =
  | "thinking"
  | "tool_calling"
  | "analyzing"
  | "searching"
  | "processing";

export interface LogItem {
  message: string;
  duration?: string;
  level?: "info" | "warning" | "error";
}

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, any>;
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
}

export interface UserMessageProps {
  content: string;
  timestamp: Date;
}

export interface AssignmentCanvasProps {
  agents: SubAgent[];
  tools: Tool[];
  onAssign: (toolName: string, agentId: number) => Promise<void>;
  onUnassign: (toolName: string, agentId: number) => Promise<void>;
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
