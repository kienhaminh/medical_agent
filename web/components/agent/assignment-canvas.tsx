"use client";

import { useCallback, useEffect, useRef } from "react";
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
import { CustomEdge } from "./canvas/custom-edge";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssignmentCanvasProps } from "@/types/agent-ui";

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  mainAgent: MainAgentNode,
};

const edgeTypes = {
  custom: CustomEdge,
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
            y: 100 + agentIndex * 200 + toolIndexForAgent * 150 - 30,
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
          y: 100 + agents.length * 200 + unassignedIndex * 150,
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
      animated: true,
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
        type: "custom",
        data: {
          agentId: tool.assigned_agent_id,
          toolName: tool.name,
        },
      })),
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const initializedRef = useRef(false);

  // Handler for edge deletion - stable function that doesn't depend on edges
  const handleEdgeDelete = useCallback(
    async (edgeId: string, agentId: number, toolName: string) => {
      // Only allow deletion of tool assignment edges (not delegation edges)
      if (edgeId.startsWith("delegation-")) return;

      try {
        await onUnassign(toolName, agentId);

        // Update the tool node data immediately
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === `tool-${toolName}`) {
              return {
                ...node,
                data: {
                  ...node.data,
                  assigned_agent_id: null,
                },
              };
            }
            return node;
          })
        );

        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      } catch (error) {
        console.error("Failed to unassign tool:", error);
      }
    },
    [onUnassign, setNodes, setEdges]
  );

  // Update edges with onDelete handler once after mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.type === "custom") {
            return {
              ...edge,
              data: { ...edge.data, onDelete: handleEdgeDelete },
            };
          }
          return edge;
        })
      );
    }
  }, [handleEdgeDelete, setEdges]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      let agentId: number;
      let toolName: string;

      // Allow connections from agents to tools OR from tools to agents
      if (
        connection.source.startsWith("agent-") &&
        connection.target.startsWith("tool-")
      ) {
        // Agent → Tool
        agentId = parseInt(connection.source.replace("agent-", ""));
        toolName = connection.target.replace("tool-", "");
      } else if (
        connection.source.startsWith("tool-") &&
        connection.target.startsWith("agent-")
      ) {
        // Tool → Agent (reverse direction)
        agentId = parseInt(connection.target.replace("agent-", ""));
        toolName = connection.source.replace("tool-", "");
      } else {
        // Invalid connection
        return;
      }

      try {
        await onAssign(toolName, agentId);

        // Update the tool node data immediately
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === `tool-${toolName}`) {
              return {
                ...node,
                data: {
                  ...node.data,
                  assigned_agent_id: agentId,
                },
              };
            }
            return node;
          })
        );

        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2 },
              type: "custom",
              data: {
                agentId,
                toolName,
                onDelete: handleEdgeDelete,
              },
            },
            eds
          )
        );
      } catch (error) {
        console.error("Failed to assign tool:", error);
      }
    },
    [onAssign, setNodes, setEdges, handleEdgeDelete]
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-background"
        connectionMode="loose"
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
            <strong>Tip:</strong> Drag between agents and tools to create assignments. Hover over connections to disconnect.
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
