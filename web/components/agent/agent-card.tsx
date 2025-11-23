"use client";

import { useState } from "react";
import { Copy, Edit, MoreVertical, Power, Trash, Wrench } from "lucide-react";
import * as Icons from "lucide-react";
import { SubAgent } from "@/types/agent";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toggleAgent, deleteAgent, cloneAgent } from "@/lib/api";
import { AgentFormDialog } from "./agent-form-dialog";
import { ToolAssignmentDialog } from "./tool-assignment-dialog";
import { toast } from "sonner";

interface AgentCardProps {
  agent: SubAgent;
  onUpdate: (updatedAgent?: SubAgent) => void;
  onDelete: () => void;
}

export function AgentCard({ agent, onUpdate, onDelete }: AgentCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showToolsDialog, setShowToolsDialog] = useState(false);

  // Get icon component
  const IconComponent = (Icons as any)[agent.icon] || Icons.Bot;

  const handleToggle = async (enabled: boolean) => {
    try {
      setIsToggling(true);
      await toggleAgent(agent.id, enabled);
      toast.success(`Agent ${enabled ? "enabled" : "disabled"}`);
      // Pass the updated agent to parent for optimistic update
      onUpdate({ ...agent, enabled });
    } catch (error) {
      toast.error("Failed to toggle agent");
      console.error(error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleClone = async () => {
    try {
      await cloneAgent(agent.id);
      toast.success("Agent cloned successfully");
      onUpdate();
    } catch (error) {
      toast.error("Failed to clone agent");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agent.id);
      toast.success("Agent deleted");
      onDelete();
    } catch (error) {
      toast.error("Failed to delete agent");
      console.error(error);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
        {/* Background gradient based on agent color */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: `linear-gradient(135deg, ${agent.color}22 0%, transparent 100%)`,
          }}
        />

        <div className="relative p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div
              className="p-3 rounded-xl"
              style={{
                backgroundColor: `${agent.color}15`,
              }}
            >
              <IconComponent
                className="h-6 w-6"
                style={{ color: agent.color }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={agent.enabled}
                onCheckedChange={handleToggle}
                disabled={isToggling}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowToolsDialog(true)}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Manage Tools
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleClone}>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{agent.name}</h3>
              {agent.is_template && (
                <Badge variant="secondary" className="text-xs">
                  Template
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {agent.description}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="capitalize"
                style={{ borderColor: agent.color }}
              >
                {agent.role.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" />
              <span>0 tools</span>
            </div>

            <Badge variant={agent.enabled ? "default" : "secondary"}>
              {agent.enabled ? "Active" : "Disabled"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      <AgentFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        agent={agent}
        onSuccess={() => {
          setShowEditDialog(false);
          onUpdate();
        }}
      />

      <ToolAssignmentDialog
        open={showToolsDialog}
        onOpenChange={setShowToolsDialog}
        agent={agent}
        onSuccess={onUpdate}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agent.name}"? This action
              cannot be undone and will remove all tool assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
