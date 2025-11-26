/**
 * TypeScript types for multi-agent system
 */

export interface SubAgent {
  id: number;
  name: string;
  role:
    | "imaging"
    | "lab_results"
    | "drug_interaction"
    | "clinical_text"
    | string;
  description: string;
  system_prompt: string;
  enabled: boolean;
  color: string;
  icon: string;
  is_template: boolean;
  parent_template_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface SubAgentCreate {
  name: string;
  role: string;
  description: string;
  system_prompt: string;
  color?: string;
  icon?: string;
  is_template?: boolean;
  parent_template_id?: number | null;
}

export interface SubAgentUpdate {
  name?: string;
  role?: string;
  description?: string;
  system_prompt?: string;
  color?: string;
  icon?: string;
  enabled?: boolean;
}

export interface Tool {
  id: number;
  name: string;
  description?: string;
  enabled?: boolean;
  scope?: "global" | "assignable" | "both";
  category?: string;
  assigned_agent_id?: number | null;
}

export interface AgentToolAssignment {
  agent_id: number;
  tool_name: string;
}

export interface AgentWithTools extends SubAgent {
  tools: Tool[];
  tool_count: number;
}

export interface AssignmentMatrixItem {
  id: number;
  agent: SubAgent;
  tool: Tool;
  enabled: boolean;
  created_at: string;
}
