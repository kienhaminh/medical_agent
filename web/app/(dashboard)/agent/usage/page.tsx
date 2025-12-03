"use client";

import { useEffect, useState } from "react";
import {
  getUsageStats,
  getErrorLogs,
  type UsageStats,
  type ErrorLog,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Database,
  Clock,
  Loader2,
} from "lucide-react";

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
      } catch (error) {
        console.error("Failed to load usage data:", error);
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

  // Calculate estimated cost (Mock calculation: $5 per 1M input, $15 per 1M output)
  const inputCost = ((stats?.prompt_tokens || 0) / 1000000) * 5;
  const outputCost = ((stats?.completion_tokens || 0) / 1000000) * 15;
  const totalCost = inputCost + outputCost;

  const totalTokens = stats?.total_tokens || 0;
  const inputTokens = stats?.prompt_tokens || 0;
  const outputTokens = stats?.completion_tokens || 0;
  const requestCount = stats?.message_count || 0;

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

          <TabsContent value="usage" className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="record-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10">
                    <Activity className="w-6 h-6 text-cyan-500" />
                  </div>
                  <Badge variant="secondary" className="medical-badge-text">
                    Total
                  </Badge>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {(totalTokens / 1000000).toFixed(4)}M
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total Tokens
                  </p>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-medium">
                      {(inputTokens / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-medium">
                      {(outputTokens / 1000).toFixed(1)}K
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="record-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-green-500/10">
                    <DollarSign className="w-6 h-6 text-green-500" />
                  </div>
                  <Badge variant="secondary" className="medical-badge-xray">
                    Estimate
                  </Badge>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    ${totalCost.toFixed(4)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Estimated Cost
                  </p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs text-green-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>Based on current usage</span>
                  </div>
                </div>
              </Card>

              <Card className="record-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Database className="w-6 h-6 text-purple-500" />
                  </div>
                  <Badge variant="secondary" className="medical-badge-lab">
                    Activity
                  </Badge>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {requestCount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total Messages
                  </p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Avg Tokens/Msg:
                    </span>
                    <span className="font-medium">
                      {requestCount > 0
                        ? (totalTokens / requestCount).toFixed(0)
                        : 0}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Detailed Breakdown */}
            <Card className="record-card">
              <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                Token Usage Breakdown
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Input Tokens
                    </span>
                    <span className="text-sm font-medium">
                      {inputTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalTokens > 0
                            ? (inputTokens / totalTokens) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Output Tokens
                    </span>
                    <span className="text-sm font-medium">
                      {outputTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalTokens > 0
                            ? (outputTokens / totalTokens) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Cost Breakdown */}
            <Card className="record-card">
              <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-green-500 rounded-full" />
                Cost Analysis
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Input Processing ($5.00/1M)
                  </span>
                  <span className="text-sm font-medium">
                    ${inputCost.toFixed(4)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Output Generation ($15.00/1M)
                  </span>
                  <span className="text-sm font-medium">
                    ${outputCost.toFixed(4)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold">Total Estimated</span>
                  <span className="text-lg font-bold text-cyan-500">
                    ${totalCost.toFixed(4)}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-6">
            {/* Error Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="record-card border-red-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {errorLogs.filter((e) => e.level === "error").length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Critical Errors
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="record-card border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-yellow-500/10">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {errorLogs.filter((e) => e.level === "warning").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Warnings</p>
                  </div>
                </div>
              </Card>

              <Card className="record-card">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-cyan-500/10">
                    <Activity className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {stats?.message_count
                        ? (
                            ((stats.message_count - errorLogs.length) /
                              stats.message_count) *
                            100
                          ).toFixed(1)
                        : 100}
                      %
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Success Rate
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Error Logs */}
            <Card className="record-card">
              <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-red-500 rounded-full" />
                Recent Logs
              </h2>
              <div className="space-y-4">
                {errorLogs.map((error) => (
                  <div
                    key={error.id}
                    className="border border-border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            error.level === "error"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-cyan-500/10 text-cyan-500"
                          }
                        >
                          {error.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">
                          {error.component}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{error.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {error.details}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
