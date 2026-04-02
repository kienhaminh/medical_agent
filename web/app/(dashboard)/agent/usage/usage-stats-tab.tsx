"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, DollarSign, TrendingUp, Database, Clock } from "lucide-react";
import type { UsageStats } from "@/lib/api";

interface UsageStatsTabProps {
  stats: UsageStats;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export function UsageStatsTab({ stats, inputCost, outputCost, totalCost }: UsageStatsTabProps) {
  const totalTokens = stats.total_tokens || 0;
  const inputTokens = stats.prompt_tokens || 0;
  const outputTokens = stats.completion_tokens || 0;
  const requestCount = stats.message_count || 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="record-card">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <Badge variant="clinical">Total</Badge>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">
              {(totalTokens / 1000000).toFixed(4)}M
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total Tokens</p>
            <Separator className="my-3" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Input:</span>
              <span className="font-medium">{(inputTokens / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-muted-foreground">Output:</span>
              <span className="font-medium">{(outputTokens / 1000).toFixed(1)}K</span>
            </div>
          </div>
        </Card>

        <Card className="record-card">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <Badge variant="xray">Estimate</Badge>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">${totalCost.toFixed(4)}</p>
            <p className="text-sm text-muted-foreground mt-1">Estimated Cost</p>
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
            <Badge variant="lab">Activity</Badge>
          </div>
          <div>
            <p className="text-3xl font-bold text-foreground">{requestCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Messages</p>
            <Separator className="my-3" />
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Avg Tokens/Msg:</span>
              <span className="font-medium">
                {requestCount > 0 ? (totalTokens / requestCount).toFixed(0) : 0}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Token Usage Breakdown */}
      <Card className="record-card">
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-primary rounded-full" />
          Token Usage Breakdown
        </h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Input Tokens</span>
              <span className="text-sm font-medium">{inputTokens.toLocaleString()}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Output Tokens</span>
              <span className="text-sm font-medium">{outputTokens.toLocaleString()}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0}%` }}
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
            <span className="text-sm text-muted-foreground">Input Processing ($5.00/1M)</span>
            <span className="text-sm font-medium">${inputCost.toFixed(4)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Output Generation ($15.00/1M)</span>
            <span className="text-sm font-medium">${outputCost.toFixed(4)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold">Total Estimated</span>
            <span className="text-lg font-bold text-primary">${totalCost.toFixed(4)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
