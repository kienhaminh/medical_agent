"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getAgents, getTools } from "@/lib/api";
import { toast } from "sonner";
import {
  MainAgentNode,
  SubAgentNode,
  ToolNode,
  getLayoutedElements,
} from "./assignment-visualization-nodes";

function AssignmentFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(
    () => ({
      mainAgent: MainAgentNode,
      subAgent: SubAgentNode,
      tool: ToolNode,
    }),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsData, toolsData] = await Promise.all([
          getAgents(),
          getTools(),
        ]);
        const agents = agentsData.filter((a) => a.enabled);
        const tools = toolsData;

        const initialNodes: Node[] = [];
        const initialEdges: Edge[] = [];

        // 1. Main Agent Node
        initialNodes.push({
          id: "main-agent",
          type: "mainAgent",
          data: { label: "Main Agent" },
          position: { x: 0, y: 0 }, // Layout will fix this
        });

        // 2. Sub Agent Nodes & Edges from Main Agent
        agents.forEach((agent) => {
          const agentNodeId = `agent-${agent.id}`;
          initialNodes.push({
            id: agentNodeId,
            type: "subAgent",
            data: { agent },
            position: { x: 0, y: 0 },
          });

          initialEdges.push({
            id: `edge-main-${agentNodeId}`,
            source: "main-agent",
            target: agentNodeId,
            animated: true,
            style: { stroke: "#06b6d4" },
          });
        });

        // 3. Tool Nodes & Edges
        // Separate assigned and unassigned(global) for better visual grouping if we wanted,
        // but Dagre handles graph logic.
        tools.forEach((tool) => {
          const toolNodeId = `tool-${tool.name}`;
          const assignedAgent = tool.assigned_agent_id
            ? agents.find((a) => a.id === tool.assigned_agent_id)
            : null;

          initialNodes.push({
            id: toolNodeId,
            type: "tool",
            data: {
              tool,
              agentColor: assignedAgent?.color,
            },
            position: { x: 0, y: 0 },
          });

          if (assignedAgent) {
            initialEdges.push({
              id: `edge-${assignedAgent.id}-${tool.name}`,
              source: `agent-${assignedAgent.id}`,
              target: toolNodeId,
              style: { stroke: assignedAgent.color },
            });
          } else if (tool.scope === "global" || tool.scope === "both") {
            // Optional: Link global tools to Main Agent?
            // It might clutter the graph if there are many.
            // Let's add them but maybe with a lighter style.
            // initialEdges.push({
            //     id: `edge-main-${tool.name}`,
            //     source: 'main-agent',
            //     target: toolNodeId,
            //     style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
            //     animated: false,
            // });
          }
        });

        // Calculate Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(initialNodes, initialEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Fit view after a short delay to allow rendering
        setTimeout(() => {
          window.requestAnimationFrame(() => {
            fitView();
          });
        }, 100);
      } catch {
        toast.error("Failed to load assignment visualization");
      }
    }

    fetchData();
  }, [setNodes, setEdges, fitView]);

  return (
    <div className="h-[600px] w-full border rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#94a3b8" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function AssignmentVisualization() {
  return (
    <ReactFlowProvider>
      <AssignmentFlow />
    </ReactFlowProvider>
  );
}
