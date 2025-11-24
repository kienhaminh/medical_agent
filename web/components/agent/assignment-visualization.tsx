"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Position,
  Handle,
  NodeProps,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { getAgents, getTools } from "@/lib/api";
import { SubAgent, Tool } from "@/types/agent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Wrench, BrainCircuit, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Custom Nodes ---

const MainAgentNode = ({ data }: NodeProps) => {
  return (
    <Card className="w-64 border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/20">
      <Handle
        type="source"
        position={Position.Right}
        className="bg-cyan-500!"
      />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BrainCircuit className="h-5 w-5 text-cyan-500" />
          Main Agent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Orchestrator</p>
        <div className="mt-2 flex gap-2">
          <Badge variant="outline" className="bg-background/50 text-[10px]">
            Router
          </Badge>
          <Badge variant="outline" className="bg-background/50 text-[10px]">
            Global Scope
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

const SubAgentNode = ({ data }: NodeProps) => {
  const { agent } = data as { agent: SubAgent };
  return (
    <Card
      className="w-64 transition-all hover:shadow-md"
      style={{
        borderColor: `${agent.color}50`,
        backgroundColor: `${agent.color}10`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-muted-foreground!"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="bg-muted-foreground!"
      />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" style={{ color: agent.color }} />
          {agent.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
        <Badge variant="secondary" className="mt-2 text-[10px]">
          {agent.role}
        </Badge>
      </CardContent>
    </Card>
  );
};

const ToolNode = ({ data }: NodeProps) => {
  const { tool, agentColor } = data as { tool: Tool; agentColor?: string };
  const isAssigned = !!tool.assigned_agent_id;

  return (
    <Card
      className={cn(
        "w-56 text-sm transition-all",
        isAssigned ? "border-l-4" : "border-dashed opacity-70"
      )}
      style={isAssigned ? { borderLeftColor: agentColor || "#e2e8f0" } : {}}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-muted-foreground!"
      />
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium" title={tool.name}>
            {tool.name}
          </span>
        </div>
        {tool.scope === "global" && (
          <Badge variant="outline" className="text-[10px] h-5 px-1">
            Global
          </Badge>
        )}
      </div>
    </Card>
  );
};

// --- Layout Helper ---

const nodeWidth = 280;
const nodeHeight = 150; // Approx max height
const ranksep = 150; // Horizontal gap
const nodesep = 50; // Vertical gap

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep, nodesep });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    // Use approximate dimensions if not measured yet, or distinct ones per type
    const height = node.type === "tool" ? 60 : 150;
    const width = node.type === "tool" ? 240 : 270;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2, // Dagre gives center, ReactFlow needs top-left
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};

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
      } catch (error) {
        console.error("Failed to fetch data:", error);
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
