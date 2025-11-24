"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, Bot } from "lucide-react";
import { AssignmentCanvas } from "./assignment-canvas";
import { ToolCreatePanel } from "./canvas/tool-create-panel";
import { AgentCreatePanel } from "./canvas/agent-create-panel";
import { getAgents, getTools, assignTool, unassignTool } from "@/lib/api";
import type { SubAgent } from "@/types/agent";
import type { Tool } from "@/lib/api";
import { Network } from "lucide-react";

export function AssignmentsTab() {
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToolCreate, setShowToolCreate] = useState(false);
  const [showAgentCreate, setShowAgentCreate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [agentsData, toolsData] = await Promise.all([
        getAgents(),
        getTools(),
      ]);
      setAgents(agentsData);
      setTools(toolsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(toolName: string, agentId: number) {
    await assignTool(agentId, toolName);
    await loadData();
  }

  async function handleUnassign(toolName: string, agentId: number) {
    await unassignTool(agentId, toolName);
    await loadData();
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-[700px] border rounded-lg border-dashed">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-full bg-cyan-500/10 animate-pulse">
              <Network className="w-8 h-8 text-cyan-500" />
            </div>
            <p className="text-muted-foreground">Loading canvas...</p>
          </div>
        </div>
      ) : agents.length === 0 && tools.length === 0 ? (
        <div className="flex items-center justify-center h-[700px] border rounded-lg border-dashed">
          <div className="text-center space-y-4">
            <div className="inline-flex p-6 rounded-full bg-muted">
              <Network className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">No Data Yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                Create your first tool or agent to get started.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => setShowToolCreate(true)} variant="outline">
                  <Wrench className="w-4 h-4 mr-2" />
                  Create Tool
                </Button>
                <Button onClick={() => setShowAgentCreate(true)} className="primary-button">
                  <Bot className="w-4 h-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Overlay Action Buttons */}
          <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowToolCreate(true)}
              className="bg-card/95 backdrop-blur-sm border border-border/50 hover:bg-card shadow-lg gap-2"
              variant="outline"
            >
              <Wrench className="w-4 h-4" />
              New Tool
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAgentCreate(true)}
              className="primary-button shadow-lg gap-2"
            >
              <Bot className="w-4 h-4" />
              New Agent
            </Button>
          </div>

          <AssignmentCanvas
            agents={agents}
            tools={tools}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
          />
          
          <ToolCreatePanel
            isOpen={showToolCreate}
            onClose={() => setShowToolCreate(false)}
            onSuccess={loadData}
          />
          
          <AgentCreatePanel
            isOpen={showAgentCreate}
            onClose={() => setShowAgentCreate(false)}
            onSuccess={loadData}
          />
        </div>
      )}
    </div>
  );
}
