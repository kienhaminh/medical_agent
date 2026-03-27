"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, AlertCircle, Stethoscope, Shield, Settings } from "lucide-react";

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setError("");
    setIsSubmitting(true);
    try {
      await login(username.trim(), password.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError("");
    setIsSubmitting(true);
    try {
      await login(user, pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 dot-matrix-bg opacity-30" />
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-teal-500/5" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 mb-4">
            <Image
              src="/logo.png"
              alt="MediNexus Logo"
              width={64}
              height={64}
              className="object-contain"
              unoptimized
            />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
            MEDI-NEXUS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hospital Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold mb-6 text-center">Staff Login</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !username.trim() || !password.trim()}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Quick Login Buttons */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">
              Quick access (development)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => quickLogin("doctor", "doctor123")}
                disabled={isSubmitting}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border px-3 py-3 text-xs transition-all hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-50"
              >
                <Stethoscope className="w-5 h-5" />
                Doctor
              </button>
              <button
                onClick={() => quickLogin("officer", "officer123")}
                disabled={isSubmitting}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border px-3 py-3 text-xs transition-all hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-50"
              >
                <Shield className="w-5 h-5" />
                Officer
              </button>
              <button
                onClick={() => quickLogin("admin", "admin123")}
                disabled={isSubmitting}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border px-3 py-3 text-xs transition-all hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-50"
              >
                <Settings className="w-5 h-5" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
