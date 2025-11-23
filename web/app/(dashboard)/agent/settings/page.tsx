"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Wrench, Network } from "lucide-react";
import { AgentsTab } from "@/components/agent/agents-tab";
import { ToolsTab } from "@/components/agent/tools-tab";
import { AssignmentsTab } from "@/components/agent/assignments-tab";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("agents");

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-teal-500 bg-clip-text text-transparent">
          Settings & Configuration
        </h1>
        <p className="text-muted-foreground">
          Manage AI agents, tools, and their assignments
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Network className="h-4 w-4" />
            Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-6">
          <AgentsTab />
        </TabsContent>

        <TabsContent value="tools" className="mt-6">
          <ToolsTab />
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          <AssignmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
