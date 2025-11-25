/**
 * Shared constants for agent components
 */

export const TOOL_CATEGORIES = [
  { value: "medical", label: "Medical" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "research", label: "Research" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
] as const;

export type ToolCategoryValue = (typeof TOOL_CATEGORIES)[number]["value"];
