"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import {
  Sparkles,
  Activity,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Heart,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PatientWithDetails } from "@/lib/mock-data";

interface HealthOverviewProps {
  patient: PatientWithDetails;
  onRegenerateClick?: () => void;
}

export function HealthOverview({
  patient,
  onRegenerateClick,
}: HealthOverviewProps) {
  const lastVisit = patient.visits?.[0];

  return (
    <div className="space-y-6">
      {/* AI-Generated Health Summary */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-500/5 via-teal-500/5 to-transparent border-cyan-500/20">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 medical-border-glow">
                <Sparkles className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  AI Health Summary
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generated from complete medical history and records
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateClick}
              className="secondary-button gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </Button>
          </div>

          <Separator className="mb-4" />

          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-cyan-500 prose-li:text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {patient.health_summary ||
                "No health summary available. Click 'Regenerate' to generate an AI-powered health overview."}
            </ReactMarkdown>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                Last updated:{" "}
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Visits</p>
              <p className="text-2xl font-bold font-display">
                {patient.visits?.length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Medical Records</p>
              <p className="text-2xl font-bold font-display">
                {patient.records?.length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Calendar className="w-5 h-5 text-teal-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Last Visit</p>
              <p className="text-sm font-medium">
                {lastVisit
                  ? new Date(lastVisit.visit_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Medical History Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Allergies */}
        <Card className="p-5 bg-card/50 border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h3 className="font-display font-semibold">Allergies</h3>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {patient.allergies || "No known allergies"}
          </div>
        </Card>

        {/* Current Medications */}
        <Card className="p-5 bg-card/50 border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-cyan-500" />
            <h3 className="font-display font-semibold">Current Medications</h3>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {patient.current_medications || "No current medications"}
          </div>
        </Card>

        {/* Medical History */}
        <Card className="p-5 bg-card/50 border-border/50 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-teal-500" />
            <h3 className="font-display font-semibold">Medical History</h3>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {patient.medical_history || "No medical history available"}
          </div>
        </Card>

        {/* Family History */}
        <Card className="p-5 bg-card/50 border-border/50 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
            <h3 className="font-display font-semibold">Family History</h3>
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {patient.family_history || "No family history recorded"}
          </div>
        </Card>
      </div>
    </div>
  );
}
