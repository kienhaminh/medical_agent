"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
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
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode } from "./canvas/agent-node";
import { ToolNode } from "./canvas/tool-node";
import { MainAgentNode } from "./canvas/main-agent-node";
import { CustomEdge } from "./canvas/custom-edge";
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
  // Separate core agents (negative IDs) from regular agents
  const coreAgents = useMemo(() => agents.filter((a) => a.id < 0), [agents]);
  const regularAgents = useMemo(() => agents.filter((a) => a.id > 0), [agents]);
  const allAgents = useMemo(() => [...coreAgents, ...regularAgents], [coreAgents, regularAgents]);

  // Find tools for core agents by matching symbols
  const coreAgentTools = useMemo(() => {
    const result: Array<{ agentId: number; tool: typeof tools[0] }> = [];
    coreAgents.forEach((agent) => {
      if (agent.tools && agent.tools.length > 0) {
        agent.tools.forEach((toolSymbol) => {
          const tool = tools.find((t) => t.symbol === toolSymbol);
          if (tool) {
            result.push({ agentId: agent.id, tool });
          }
        });
      }
    });
    return result;
  }, [coreAgents, tools]);

  // Calculate positions for all nodes
  const agentCount = allAgents.length;
  const maxToolsPerAgent = Math.max(
    ...allAgents.map((agent) => {
      if (agent.id < 0) {
        // Core agent - count tools by symbol
        const coreTools = coreAgentTools.filter(
          (ct) => ct.agentId === agent.id
        );
        return coreTools.length;
      } else {
        // Regular agent - count assigned tools
        return tools.filter((t) => t.assigned_agent_id === agent.id).length;
      }
    }),
    0
  );

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
    ...allAgents.map((agent, index) => ({
      id: `agent-${agent.id}`,
      type: "agent" as const,
      position: { x: 450, y: 100 + index * 200 },
      data: { ...agent, isCoreAgent: agent.id < 0 } as any,
    })),
    // Tool nodes on the right, grouped by assigned agent
    ...tools.map((tool) => {
      // Check if tool belongs to a core agent
      const coreToolMatch = coreAgentTools.find(
        (ct) => ct.tool.id === tool.id
      );
      if (coreToolMatch) {
        const agentIndex = allAgents.findIndex(
          (a) => a.id === coreToolMatch.agentId
        );
        const toolsForAgent = coreAgentTools.filter(
          (ct) => ct.agentId === coreToolMatch.agentId
        );
        const toolIndexForAgent = toolsForAgent.findIndex(
          (ct) => ct.tool.id === tool.id
        );

        return {
          id: `tool-${tool.id}`,
          type: "tool" as const,
          position: {
            x: 850,
            y: 100 + agentIndex * 200 + toolIndexForAgent * 150 - 30,
          },
          data: { ...tool, isCoreTool: true } as any,
        };
      }

      // If tool is assigned to a regular agent, position it near its agent
      if (tool.assigned_agent_id) {
        const agentIndex = allAgents.findIndex(
          (a) => a.id === tool.assigned_agent_id
        );
        const toolsForAgent = tools.filter(
          (t) => t.assigned_agent_id === tool.assigned_agent_id
        );
        const toolIndexForAgent = toolsForAgent.findIndex(
          (t) => t.id === tool.id
        );

        return {
          id: `tool-${tool.id}`,
          type: "tool" as const,
          position: {
            x: 850,
            y: 100 + agentIndex * 200 + toolIndexForAgent * 150 - 30,
          },
          data: tool as any,
        };
      }

      // Unassigned tools go at the bottom
      const unassignedTools = tools.filter(
        (t) => !t.assigned_agent_id && !coreAgentTools.find((ct) => ct.tool.id === t.id)
      );
      const unassignedIndex = unassignedTools.findIndex(
        (t) => t.id === tool.id
      );
      return {
        id: `tool-${tool.id}`,
        type: "tool" as const,
        position: {
          x: 850,
          y: 100 + agentCount * 200 + unassignedIndex * 150,
        },
        data: tool as any,
      };
    }),
  ];

  // Create edges: Main Agent → Sub-agents, Sub-agents → Tools
  const initialEdges: Edge[] = [
    // Delegation edges from main agent to all sub-agents
    ...allAgents.map((agent) => ({
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
    // Tool assignment edges from regular sub-agents to their tools
    ...tools
      .filter((tool) => tool.assigned_agent_id && tool.assigned_agent_id > 0)
      .map((tool) => ({
        id: `edge-${tool.id}-${tool.assigned_agent_id}`,
        source: `agent-${tool.assigned_agent_id}`,
        target: `tool-${tool.id}`,
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 2 },
        type: "custom",
        data: {
          agentId: tool.assigned_agent_id,
          toolId: tool.id,
          toolName: tool.name,
          isCoreTool: false,
        },
      })),
    // Tool edges from core agents to their tools (read-only, no delete)
    ...coreAgentTools.map(({ agentId, tool }) => ({
      id: `edge-core-${tool.id}-${agentId}`,
      source: `agent-${agentId}`,
      target: `tool-${tool.id}`,
      animated: true,
      style: { stroke: "#f59e0b", strokeWidth: 2 }, // Orange color for core agent tools
      type: "custom",
      data: {
        agentId,
        toolId: tool.id,
        toolName: tool.name,
        isCoreTool: true, // Mark as core tool (read-only)
      },
    })),
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const initializedRef = useRef(false);

  // Handler for edge deletion - stable function that doesn't depend on edges
  const handleEdgeDelete = useCallback(
    async (edgeId: string, agentId: number, toolId: number, isCoreTool?: boolean) => {
      // Only allow deletion of tool assignment edges (not delegation edges)
      if (edgeId.startsWith("delegation-")) return;
      
      // Don't allow deletion of core agent tool edges
      if (isCoreTool || edgeId.startsWith("edge-core-")) {
        return;
      }

      try {
        await onUnassign(toolId, agentId);

        // Update the tool node data immediately
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === `tool-${toolId}`) {
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
            const edgeData = edge.data as any;
            return {
              ...edge,
              data: {
                ...edgeData,
                onDelete: (edgeId: string, agentId: number, toolId: number) =>
                  handleEdgeDelete(
                    edgeId,
                    agentId,
                    toolId,
                    edgeData.isCoreTool
                  ),
              },
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
      let toolId: number;
      let toolName: string;

      // Allow connections from agents to tools OR from tools to agents
      if (
        connection.source.startsWith("agent-") &&
        connection.target.startsWith("tool-")
      ) {
        // Agent → Tool
        agentId = parseInt(connection.source.replace("agent-", ""));
        toolId = parseInt(connection.target.replace("tool-", ""));
      } else if (
        connection.source.startsWith("tool-") &&
        connection.target.startsWith("agent-")
      ) {
        // Tool → Agent (reverse direction)
        agentId = parseInt(connection.target.replace("agent-", ""));
        toolId = parseInt(connection.source.replace("tool-", ""));
      } else {
        // Invalid connection
        return;
      }

      // Don't allow connections to/from core agents (they have fixed tool assignments)
      if (agentId < 0) {
        return;
      }

      // Find tool to get its name (assignTool still uses tool_name)
      const tool = tools.find((t) => t.id === toolId);
      if (!tool) return;
      
      // Don't allow assigning core tools to regular agents
      const isCoreTool = coreAgentTools.some((ct) => ct.tool.id === toolId);
      if (isCoreTool) {
        return;
      }
      
      toolName = tool.name;

      try {
        await onAssign(toolName, agentId);

        // Update the tool node data immediately
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === `tool-${toolId}`) {
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
                toolId,
                toolName,
                isCoreTool: false,
                onDelete: (edgeId: string, agentId: number, toolId: number) =>
                  handleEdgeDelete(edgeId, agentId, toolId, false),
              },
            },
            eds
          )
        );
      } catch (error) {
        console.error("Failed to assign tool:", error);
      }
    },
    [onAssign, setNodes, setEdges, handleEdgeDelete, tools, coreAgentTools]
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
        connectionMode={ConnectionMode.Loose}
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
            if (node.type === "tool") {
              const toolData = node.data as any;
              if (toolData?.enabled === false) return "#ef4444";
            }
            return "#10b981";
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
        <Panel
          position="top-left"
          className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 text-sm"
        >
          <p className="text-muted-foreground">
            <strong>Tip:</strong> Drag between agents and tools to create
            assignments. Hover over connections to disconnect.
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
