"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, AlertCircle, DollarSign, TrendingUp, Database, Clock } from "lucide-react";

export default function AgentConfigurationPage() {
  // Mock data - will be replaced by actual API calls
  const [usageData] = useState({
    totalTokens: 1247893,
    inputTokens: 897234,
    outputTokens: 350659,
    estimatedCost: 12.45,
    requestCount: 3421,
    avgResponseTime: 1.23,
  });

  const [errorLogs] = useState([
    {
      id: 1,
      timestamp: "2025-01-21T10:30:00Z",
      level: "error",
      message: "Failed to connect to vector database",
      component: "RAG Service",
      details: "Connection timeout after 30s",
    },
    {
      id: 2,
      timestamp: "2025-01-21T09:15:00Z",
      level: "warning",
      message: "High token usage detected",
      component: "LLM Service",
      details: "Request used 8500 tokens (above 8000 threshold)",
    },
    {
      id: 3,
      timestamp: "2025-01-21T08:45:00Z",
      level: "error",
      message: "Tool execution failed",
      component: "Agent Orchestrator",
      details: "Vision AI tool returned 500 error",
    },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
            Configuration & Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Track usage, monitor errors, and manage system configuration
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
                    {(usageData.totalTokens / 1000000).toFixed(2)}M
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total Tokens</p>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-medium">{(usageData.inputTokens / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-medium">{(usageData.outputTokens / 1000).toFixed(0)}K</span>
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
                    ${usageData.estimatedCost.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Estimated Cost</p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs text-green-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>+12% from last month</span>
                  </div>
                </div>
              </Card>

              <Card className="record-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Database className="w-6 h-6 text-purple-500" />
                  </div>
                  <Badge variant="secondary" className="medical-badge-lab">
                    Performance
                  </Badge>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {usageData.requestCount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total Requests</p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Avg:</span>
                    <span className="font-medium">{usageData.avgResponseTime}s</span>
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
                    <span className="text-sm text-muted-foreground">Input Tokens</span>
                    <span className="text-sm font-medium">{usageData.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full"
                      style={{ width: `${(usageData.inputTokens / usageData.totalTokens) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Output Tokens</span>
                    <span className="text-sm font-medium">{usageData.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full"
                      style={{ width: `${(usageData.outputTokens / usageData.totalTokens) * 100}%` }}
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
                  <span className="text-sm text-muted-foreground">LLM API Calls</span>
                  <span className="text-sm font-medium">$9.80</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vector Database</span>
                  <span className="text-sm font-medium">$1.50</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vision AI Compute</span>
                  <span className="text-sm font-medium">$1.15</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold">Total Estimated</span>
                  <span className="text-lg font-bold text-cyan-500">${usageData.estimatedCost.toFixed(2)}</span>
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
                    <p className="text-2xl font-bold">8</p>
                    <p className="text-sm text-muted-foreground">Critical Errors</p>
                  </div>
                </div>
              </Card>

              <Card className="record-card border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-yellow-500/10">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">23</p>
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
                    <p className="text-2xl font-bold">99.2%</p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Error Logs */}
            <Card className="record-card">
              <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-red-500 rounded-full" />
                Recent Error Logs
              </h2>
              <div className="space-y-4">
                {errorLogs.map((error) => (
                  <div key={error.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            error.level === "error"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }
                        >
                          {error.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">{error.component}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{error.message}</p>
                    <p className="text-xs text-muted-foreground">{error.details}</p>
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
