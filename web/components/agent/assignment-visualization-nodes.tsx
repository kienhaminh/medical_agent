"use client";

import {
  Position,
  Handle,
  NodeProps,
  Node,
  Edge,
} from "@xyflow/react";
import dagre from "dagre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Wrench, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubAgent, Tool } from "@/types/agent";

// --- Custom Node Components ---

export const MainAgentNode = (_props: NodeProps) => {
  return (
    <Card className="w-64 border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/20">
      <Handle type="source" position={Position.Right} className="bg-cyan-500!" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BrainCircuit className="h-5 w-5 text-cyan-500" />
          Main Agent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Orchestrator</p>
        <div className="mt-2 flex gap-2">
          <Badge variant="outline" className="bg-background/50 text-[10px]">Router</Badge>
          <Badge variant="outline" className="bg-background/50 text-[10px]">Global Scope</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export const SubAgentNode = ({ data }: NodeProps) => {
  const { agent } = data as { agent: SubAgent };
  return (
    <Card
      className="w-64 transition-all hover:shadow-md"
      style={{ borderColor: `${agent.color}50`, backgroundColor: `${agent.color}10` }}
    >
      <Handle type="target" position={Position.Left} className="bg-muted-foreground!" />
      <Handle type="source" position={Position.Right} className="bg-muted-foreground!" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" style={{ color: agent.color }} />
          {agent.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
        <Badge variant="secondary" className="mt-2 text-[10px]">{agent.role}</Badge>
      </CardContent>
    </Card>
  );
};

export const ToolNode = ({ data }: NodeProps) => {
  const { tool, agentColor } = data as { tool: Tool; agentColor?: string };
  const isAssigned = !!tool.assigned_agent_id;

  return (
    <Card
      className={cn("w-56 text-sm transition-all", isAssigned ? "border-l-4" : "border-dashed opacity-70")}
      style={isAssigned ? { borderLeftColor: agentColor || "#e2e8f0" } : {}}
    >
      <Handle type="target" position={Position.Left} className="bg-muted-foreground!" />
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium" title={tool.name}>{tool.name}</span>
        </div>
        {tool.scope === "global" && (
          <Badge variant="outline" className="text-[10px] h-5 px-1">Global</Badge>
        )}
      </div>
    </Card>
  );
};

// --- Layout Helper ---

const nodeWidth = 280;
const nodeHeight = 150;
const ranksep = 150;
const nodesep = 50;

export function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep, nodesep });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const height = node.type === "tool" ? 60 : nodeHeight;
    const width = node.type === "tool" ? 240 : nodeWidth - 10;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id);
    return {
      ...node,
      position: { x: n.x - n.width / 2, y: n.y - n.height / 2 },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
}
