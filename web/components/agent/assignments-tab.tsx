"use client";

import { AlertCircle } from "lucide-react";

export function AssignmentsTab() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Assignment Matrix</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        The assignment matrix view will be implemented here. For now, you can manage
        tool assignments from the Agents tab using the "Manage Tools" option on each agent card.
      </p>
    </div>
  );
}
