"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SubAgent } from "@/types/agent";
import { getAgents } from "@/lib/api";
import { AgentCard } from "./agent-card";
import { AgentFormDialog } from "./agent-form-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentsTab() {
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = agents;

    if (searchQuery) {
      filtered = filtered.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterEnabled !== null) {
      filtered = filtered.filter((agent) => agent.enabled === filterEnabled);
    }

    setFilteredAgents(filtered);
  }, [agents, searchQuery, filterEnabled]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await getAgents();
      setAgents(data);
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentCreated = () => {
    loadAgents();
    setShowCreateDialog(false);
  };

  const handleAgentUpdated = (updatedAgent?: SubAgent) => {
    if (updatedAgent) {
      // Optimistically update the local state without reloading
      setAgents((prevAgents) =>
        prevAgents.map((agent) =>
          agent.id === updatedAgent.id ? updatedAgent : agent
        )
      );
    } else {
      // Fallback to reloading if no updated agent is provided
      loadAgents();
    }
  };

  const handleAgentDeleted = () => {
    loadAgents();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filterEnabled === null ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterEnabled(null)}
            >
              All
              <Badge variant="secondary" className="ml-2">
                {agents.length}
              </Badge>
            </Button>
            <Button
              variant={filterEnabled === true ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterEnabled(true)}
            >
              Enabled
              <Badge variant="secondary" className="ml-2">
                {agents.filter((a) => a.enabled).length}
              </Badge>
            </Button>
            <Button
              variant={filterEnabled === false ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterEnabled(false)}
            >
              Disabled
              <Badge variant="secondary" className="ml-2">
                {agents.filter((a) => !a.enabled).length}
              </Badge>
            </Button>
          </div>
        </div>

        {/* Create Button */}
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No agents found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery || filterEnabled !== null
              ? "Try adjusting your filters or search query"
              : "Get started by creating your first AI specialist"}
          </p>
          {!searchQuery && filterEnabled === null && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onUpdate={handleAgentUpdated}
              onDelete={handleAgentDeleted}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <AgentFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleAgentCreated}
      />
    </div>
  );
}
