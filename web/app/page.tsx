import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Brain, Eye, Lock, Zap, Sliders } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Clinical Futurism Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dot matrix medical grid */}
        <div className="absolute inset-0 dot-matrix-bg opacity-40" />

        {/* Gradient overlay */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-teal-500/10 via-transparent to-transparent" />

        {/* Geometric medical shapes */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 border border-cyan-500/20 rounded-full" />
        <div
          className="absolute bottom-1/3 left-1/4 w-48 h-48 border-2 border-teal-500/10"
          style={{ transform: "rotate(45deg)" }}
        />

        {/* Scanning line effect */}
        <div className="scan-line absolute inset-0" />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-xl bg-background/50">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 shrink-0">
                  <Image
                    src="/logo.png"
                    alt="MediNexus Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="font-display text-lg font-bold tracking-wider bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  MEDI-NEXUS
                </span>
              </div>
              <nav className="flex gap-8 items-center">
                <Link href="/agent">
                  <Button
                    size="sm"
                    className="bg-linear-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-xs font-semibold tracking-wider px-4 h-8 shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30"
                  >
                    GO TO CHAT
                  </Button>
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 lg:px-8">
          <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-24">
            <div className="max-w-5xl mx-auto text-center space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm medical-border-glow">
                <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                <span className="font-display text-xs tracking-widest text-cyan-500">
                  AI-POWERED MEDICAL INTELLIGENCE
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="font-display text-6xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
                <span className="block bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
                  Medical Intelligence,
                </span>
                <span className="block mt-2 bg-linear-to-r from-cyan-500 via-teal-500 to-cyan-600 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                  Evolved
                </span>
              </h1>

              {/* Subtitle */}
              <p className="font-body text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                Multi-modal AI assistant for healthcare professionals. Analyze
                patient records with vision AI, semantic search, and dynamic
                tool orchestration.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                <Link href="/patient">
                  <Button
                    size="lg"
                    className="primary-button text-sm tracking-wider h-12 px-8"
                  >
                    ACCESS PATIENT DASHBOARD →
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="secondary-button text-sm tracking-wider h-12 px-8"
                  asChild
                >
                  <Link href="#features">VIEW CAPABILITIES</Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
                <div className="space-y-2">
                  <div className="font-display text-4xl font-bold text-cyan-500">
                    Multi-Modal
                  </div>
                  <div className="font-body text-sm text-muted-foreground">
                    Text, Images & PDFs
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-display text-4xl font-bold text-teal-500">
                    100%
                  </div>
                  <div className="font-body text-sm text-muted-foreground">
                    On-Premise
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-display text-4xl font-bold text-cyan-500">
                    24/7
                  </div>
                  <div className="font-body text-sm text-muted-foreground">
                    AI Consultation
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <section id="features" className="py-24">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16 space-y-4">
                <h2 className="font-display text-4xl lg:text-5xl font-bold">
                  Advanced{" "}
                  <span className="bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                    Medical Capabilities
                  </span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Built for modern healthcare with extensible AI tools and
                  privacy-first architecture
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  {
                    title: "Multi-Modal Analysis",
                    description:
                      "Process text records, MRI/X-Ray images, and lab PDFs with specialized AI models for comprehensive patient insights.",
                    icon: Brain,
                    color: "cyan",
                  },
                  {
                    title: "Semantic Medical History",
                    description:
                      "RAG-powered context retrieval across patient timeline. AI remembers and connects relevant medical history automatically.",
                    icon: Activity,
                    color: "teal",
                  },
                  {
                    title: "Dynamic Tool Registry",
                    description:
                      "Enable or disable AI capabilities on demand through an intuitive UI. No code changes, instant updates.",
                    icon: Sliders,
                    color: "purple",
                  },
                  {
                    title: "Vision AI Integration",
                    description:
                      "Automated anomaly detection in medical imaging. Supports MRI, X-Ray, and other diagnostic images.",
                    icon: Eye,
                    color: "green",
                  },
                  {
                    title: "Privacy-First Architecture",
                    description:
                      "100% on-premise processing. All patient data, images, and vectors stored locally. HIPAA-compliant design.",
                    icon: Lock,
                    color: "cyan",
                  },
                  {
                    title: "Real-Time Consultation",
                    description:
                      "Stream AI analysis as you review records. Context-aware suggestions based on current patient view.",
                    icon: Zap,
                    color: "teal",
                  },
                ].map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <Card
                      key={index}
                      className="record-card group"
                      style={{
                        animationDelay: `${index * 100}ms`,
                      }}
                    >
                      <div
                        className={`inline-flex p-3 rounded-xl bg-${feature.color}-500/10 mb-4 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <Icon className={`w-6 h-6 text-${feature.color}-500`} />
                      </div>
                      <h3 className="font-display text-xl font-semibold mb-3">
                        {feature.title}
                      </h3>
                      <p className="font-body text-muted-foreground leading-relaxed text-sm">
                        {feature.description}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Tech Stack Section */}
          <section className="py-24 border-t border-border/50">
            <div className="max-w-5xl mx-auto text-center space-y-12">
              <div className="space-y-4">
                <h2 className="font-display text-4xl lg:text-5xl font-bold">
                  Enterprise-Grade{" "}
                  <span className="bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                    Tech Stack
                  </span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Built with modern technologies for reliability, scalability,
                  and security
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { name: "Next.js 16", desc: "App Router" },
                  { name: "Python 3.12", desc: "FastAPI" },
                  { name: "LangGraph", desc: "AI Orchestration" },
                  { name: "PostgreSQL", desc: "pgvector" },
                ].map((tech, index) => (
                  <div
                    key={index}
                    className="p-6 border border-border/50 rounded-xl bg-card/30 hover:bg-card/50 transition-all hover:scale-105 hover:border-cyan-500/50 group"
                  >
                    <div className="font-display text-base font-bold mb-1 group-hover:text-cyan-500 transition-colors">
                      {tech.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tech.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 space-y-4">
                <Link href="/patient">
                  <Button
                    size="lg"
                    className="primary-button text-sm tracking-wider h-14 px-12 text-base"
                  >
                    START MANAGING PATIENTS →
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground">
                  Or{" "}
                  <Link href="/agent" className="text-cyan-500 hover:underline">
                    try the AI agent
                  </Link>{" "}
                  to see it in action
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-24 backdrop-blur-xl bg-background/50">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="py-12 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 shrink-0">
                  <Image
                    src="/logo.png"
                    alt="MediNexus Logo"
                    width={32}
                    height={32}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <span className="font-display text-sm font-bold tracking-wider bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  MEDI-NEXUS
                </span>
              </div>
              <div className="font-body text-sm text-muted-foreground">
                Medical Intelligence for Healthcare Professionals
              </div>
              <div className="flex gap-6">
                <Link
                  href="/patient"
                  className="font-body text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Patients
                </Link>
                <Link
                  href="/agent"
                  className="font-body text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  AI Agent
                </Link>
                <Link
                  href="/agent/tools"
                  className="font-body text-sm text-muted-foreground hover:text-cyan-500 transition-colors"
                >
                  Tools
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
