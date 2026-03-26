"use client";

import { useEffect, useState } from "react";
import { getUsageStats, getErrorLogs, type UsageStats, type ErrorLog } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UsageStatsTab } from "./usage-stats-tab";
import { ErrorTrackingTab } from "./error-tracking-tab";

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, errorsData] = await Promise.all([
          getUsageStats(),
          getErrorLogs(),
        ]);
        setStats(statsData);
        setErrorLogs(errorsData);
      } catch {
        toast.error("Failed to load usage data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  // Estimated cost: $5/1M input, $15/1M output
  const inputCost = ((stats?.prompt_tokens || 0) / 1000000) * 5;
  const outputCost = ((stats?.completion_tokens || 0) / 1000000) * 15;
  const totalCost = inputCost + outputCost;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
            Usage & Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Track token usage, costs, and system performance
          </p>
        </div>

        <Tabs defaultValue="usage" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="usage">Usage & Costs</TabsTrigger>
            <TabsTrigger value="errors">Error Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            {stats && (
              <UsageStatsTab
                stats={stats}
                inputCost={inputCost}
                outputCost={outputCost}
                totalCost={totalCost}
              />
            )}
          </TabsContent>

          <TabsContent value="errors">
            <ErrorTrackingTab errorLogs={errorLogs} stats={stats} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
