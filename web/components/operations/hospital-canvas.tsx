// web/components/operations/hospital-canvas.tsx
"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type OnNodeDrag,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Node, Edge } from "@xyflow/react";

import { ReceptionNode } from "./canvas/reception-node";
import { DepartmentNode } from "./canvas/department-node";
import { DischargeNode } from "./canvas/discharge-node";
import { FlowEdge } from "./canvas/flow-edge";
import { TransferEdge } from "./canvas/transfer-edge";
import { onNodeDragStop } from "./use-hospital-canvas";
import { transferVisit } from "@/lib/api";

const nodeTypes: NodeTypes = {
  reception: ReceptionNode,
  department: DepartmentNode,
  discharge: DischargeNode,
};

const edgeTypes: EdgeTypes = {
  flow: FlowEdge,
  transfer: TransferEdge,
};

interface HospitalCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodeClick?: (nodeId: string) => void;
  onRefresh?: () => void;
}

export function HospitalCanvas({ initialNodes, initialEdges, onNodeClick, onRefresh }: HospitalCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data updates from polling
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
    onNodeDragStop(node.id, node.position);
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleTransfer = useCallback(async (visitId: number, targetDept: string) => {
    try {
      await transferVisit(visitId, targetDept);
      onRefresh?.();
    } catch (err) {
      console.error("Transfer failed:", err instanceof Error ? err.message : "Transfer failed");
      onRefresh?.(); // snap back by re-fetching
    }
  }, [onRefresh]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          position="bottom-right"
          style={{ background: "#161b22", borderColor: "rgba(255,255,255,0.1)" }}
        />
        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            if (node.type === "reception") return "#00d9ff";
            if (node.type === "discharge") return "#10b981";
            return (node.data as { department?: { color?: string } })?.department?.color || "#6366f1";
          }}
          style={{ background: "#0d1117", borderColor: "rgba(255,255,255,0.06)" }}
        />
        <Background variant={BackgroundVariant.Dots} color="rgba(0,217,255,0.05)" gap={40} />
      </ReactFlow>
    </div>
  );
}
