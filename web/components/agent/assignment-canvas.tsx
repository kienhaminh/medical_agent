"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MiniMap,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SubAgent } from "@/types/agent";
import { Tool } from "@/lib/api";
import { AgentNode } from "./canvas/agent-node";
import { ToolNode } from "./canvas/tool-node";
import { MainAgentNode } from "./canvas/main-agent-node";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssignmentCanvasProps } from "@/types/agent-ui";

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  mainAgent: MainAgentNode,
};

export function AssignmentCanvas({
  agents,
  tools,
  onAssign,
  onUnassign,
}: AssignmentCanvasProps) {
  // Create nodes with horizontal flow layout: Main Agent (left) → Sub-agents (middle) → Tools (right)
  const initialNodes: Node[] = [
    // Main Agent Node on the left
    {
      id: "main-agent",
      type: "mainAgent" as const,
      position: { x: 50, y: 250 },
      data: { name: "Main Agent" } as any,
      draggable: true,
    },
    // Sub-agent nodes in the middle (vertically stacked)
    ...agents.map((agent, index) => ({
      id: `agent-${agent.id}`,
      type: "agent" as const,
      position: { x: 450, y: 100 + index * 200 },
      data: agent as any,
    })),
    // Tool nodes on the right, grouped by assigned agent
    ...tools.map((tool, index) => {
      // If tool is assigned, position it near its agent
      if (tool.assigned_agent_id) {
        const agentIndex = agents.findIndex(
          (a) => a.id === tool.assigned_agent_id
        );
        const toolsForAgent = tools.filter(
          (t) => t.assigned_agent_id === tool.assigned_agent_id
        );
        const toolIndexForAgent = toolsForAgent.findIndex(
          (t) => t.name === tool.name
        );

        return {
          id: `tool-${tool.name}`,
          type: "tool" as const,
          position: {
            x: 850,
            y: 100 + agentIndex * 200 + toolIndexForAgent * 90 - 30,
          },
          data: tool as any,
        };
      }

      // Unassigned tools go at the bottom
      const unassignedTools = tools.filter((t) => !t.assigned_agent_id);
      const unassignedIndex = unassignedTools.findIndex(
        (t) => t.name === tool.name
      );
      return {
        id: `tool-${tool.name}`,
        type: "tool" as const,
        position: {
          x: 850,
          y: 100 + agents.length * 200 + unassignedIndex * 90,
        },
        data: tool as any,
      };
    }),
  ];

  // Create edges: Main Agent → Sub-agents, Sub-agents → Tools
  const initialEdges: Edge[] = [
    // Delegation edges from main agent to all sub-agents
    ...agents.map((agent) => ({
      id: `delegation-${agent.id}`,
      source: "main-agent",
      target: `agent-${agent.id}`,
      animated: false,
      style: {
        stroke: "#06b6d4",
        strokeWidth: 2,
        strokeDasharray: "5,5",
      },
      type: "smoothstep",
    })),
    // Tool assignment edges from sub-agents to their tools
    ...tools
      .filter((tool) => tool.assigned_agent_id)
      .map((tool) => ({
        id: `edge-${tool.name}-${tool.assigned_agent_id}`,
        source: `agent-${tool.assigned_agent_id}`,
        target: `tool-${tool.name}`,
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 2 },
        type: "smoothstep",
      })),
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Only allow connections from agents to tools
      if (
        !connection.source.startsWith("agent-") ||
        !connection.target.startsWith("tool-")
      ) {
        return;
      }

      // Extract agent ID and tool name from the connection
      const agentId = parseInt(connection.source.replace("agent-", ""));
      const toolName = connection.target.replace("tool-", "");

      try {
        await onAssign(toolName, agentId);
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2 },
              type: "smoothstep",
            },
            eds
          )
        );
      } catch (error) {
        console.error("Failed to assign tool:", error);
      }
    },
    [onAssign, setEdges]
  );

  const onEdgeClick = useCallback(
    async (_event: React.MouseEvent, edge: Edge) => {
      // Only allow deletion of tool assignment edges (not delegation edges)
      if (edge.id.startsWith("delegation-")) return;

      // Extract agent ID and tool name from the edge
      const agentId = parseInt(edge.source.replace("agent-", ""));
      const toolName = edge.target.replace("tool-", "");

      try {
        await onUnassign(toolName, agentId);
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      } catch (error) {
        console.error("Failed to unassign tool:", error);
      }
    },
    [onUnassign, setEdges]
  );

  return (
    <div className="w-full h-[700px] rounded-lg border border-border/50 bg-background overflow-hidden">
      <style jsx global>{`
        .react-flow__controls button {
          background-color: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border) / 0.5) !important;
        }
        .react-flow__controls button:hover {
          background-color: hsl(var(--accent)) !important;
        }
        .react-flow__controls button svg {
          fill: #06b6d4 !important;
          color: #06b6d4 !important;
        }
        .react-flow__controls button path {
          fill: #06b6d4 !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls
          className="!bg-card/95 !backdrop-blur-sm !border !border-border/50 !rounded-lg !shadow-lg"
          showZoom
          showFitView
          showInteractive={false}
        />
        <MiniMap
          className="!bg-card/95 !backdrop-blur-sm !border !border-border/50 !rounded-lg !shadow-lg"
          nodeColor={(node) => {
            if (node.type === "mainAgent") return "#06b6d4";
            if (node.type === "agent") return "#8b5cf6";
            return "#10b981";
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
        <Panel
          position="top-left"
          className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 text-sm"
        >
          <p className="text-muted-foreground">
            <strong>Tip:</strong> Drag from an agent to a tool to create an
            assignment
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
