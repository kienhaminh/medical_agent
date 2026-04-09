"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { AnswerContentProps } from "@/types/agent-ui";
import { PatientLink } from "./patient-link";
import { ConsultationCard, isConsultationSynthesis } from "@/components/doctor/consultation-card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Streaming-safe image with skeleton loading state
// ---------------------------------------------------------------------------

function StreamingImage({ src, alt }: { src?: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset whenever the src changes (URL becomes complete / updates)
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  return (
    <span className="block my-4">
      {/* Skeleton shown while the image is in-flight */}
      {!loaded && !error && (
        <span className="block h-48 w-full rounded-lg bg-muted/50 border border-border/40 animate-pulse" />
      )}
      {/* Error state */}
      {error && (
        <span className="block h-16 w-full rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center text-xs text-muted-foreground/50">
          Image unavailable
        </span>
      )}
      {/* Actual image — hidden until loaded */}
      <img
        src={src}
        alt={alt ?? "Image"}
        className={cn(
          "max-w-full h-auto rounded-lg border border-border/50 shadow-sm transition-opacity duration-300",
          loaded ? "opacity-100" : "hidden"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {loaded && alt && alt !== "Image" && (
        <span className="block text-[11px] text-muted-foreground/60 mt-1.5 text-center font-mono">
          {alt}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Patient-link injection
// ---------------------------------------------------------------------------

function usePatientLinkRenderer(
  patientReferences: AnswerContentProps["patientReferences"],
  sessionId: AnswerContentProps["sessionId"]
) {
  return React.useCallback(
    (text: string): React.ReactNode => {
      if (!patientReferences?.length) return text;

      const sorted = [...patientReferences].sort((a, b) => a.start_index - b.start_index);
      const parts: (string | React.ReactElement)[] = [];
      let cursor = 0;

      for (const [i, ref] of sorted.entries()) {
        if (ref.start_index > cursor) parts.push(text.slice(cursor, ref.start_index));
        parts.push(
          <PatientLink
            key={`patient-${ref.patient_id}-${i}`}
            patientId={ref.patient_id}
            patientName={ref.patient_name}
            sessionId={sessionId}
          />
        );
        cursor = ref.end_index;
      }
      if (cursor < text.length) parts.push(text.slice(cursor));
      return parts;
    },
    [patientReferences, sessionId]
  );
}

function injectIntoChildren(
  children: React.ReactNode,
  inject: (text: string) => React.ReactNode
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") return inject(child);
    if (React.isValidElement(child)) {
      const p = child.props as { children?: React.ReactNode };
      if (p.children) {
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          { children: injectIntoChildren(p.children, inject) }
        );
      }
    }
    return child;
  });
}

// ---------------------------------------------------------------------------
// Markdown component map — design-system tokens throughout
// ---------------------------------------------------------------------------

function buildComponents(
  injectPatientLinks: (text: string) => React.ReactNode
): Components {
  const withLinks = (children: React.ReactNode) =>
    injectIntoChildren(children, injectPatientLinks);

  return {
    // ── Headings ────────────────────────────────────────────────────────────
    h1: ({ children, ...props }) => (
      <h1
        className="font-display text-xl font-semibold tracking-tight text-foreground mt-6 mb-3 first:mt-0"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        className="font-display text-lg font-semibold tracking-tight text-foreground mt-5 mb-2.5 first:mt-0"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="font-display text-base font-semibold text-foreground mt-4 mb-2 first:mt-0"
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4
        className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0"
        {...props}
      >
        {children}
      </h4>
    ),

    // ── Body ────────────────────────────────────────────────────────────────
    p: ({ children, ...props }) => (
      <p className="leading-7 text-sm text-foreground my-2.5 first:mt-0" {...props}>
        {withLinks(children)}
      </p>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic text-foreground/80" {...props}>
        {children}
      </em>
    ),

    // ── Lists ───────────────────────────────────────────────────────────────
    ul: ({ children, ...props }) => (
      <ul className="my-3 space-y-1 pl-5 list-disc marker:text-muted-foreground/50 text-sm" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-3 space-y-1 pl-5 list-decimal marker:text-muted-foreground/50 text-sm" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="text-sm text-foreground leading-6" {...props}>
        {withLinks(children)}
      </li>
    ),

    // ── Code ────────────────────────────────────────────────────────────────
    code: ({ className, children, ...props }) => {
      const isBlock = className?.startsWith("language-");
      return isBlock ? (
        <code className={`${className ?? ""} font-mono text-xs`} {...props}>
          {children}
        </code>
      ) : (
        <code
          className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className="my-4 rounded-lg border border-border bg-muted/40 p-4 overflow-x-auto text-xs font-mono"
        {...props}
      >
        {children}
      </pre>
    ),

    // ── Blockquote ──────────────────────────────────────────────────────────
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-3 border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground italic"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // ── Horizontal rule ─────────────────────────────────────────────────────
    hr: ({ ...props }) => (
      <hr className="my-5 border-0 border-t border-border/60" {...props} />
    ),

    // ── Links ───────────────────────────────────────────────────────────────
    a: ({ children, ...props }) => (
      <a
        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),

    // ── Images ──────────────────────────────────────────────────────────────
    img: ({ alt, src }) => <StreamingImage src={src} alt={alt} />,

    // ── Tables ──────────────────────────────────────────────────────────────
    table: ({ children, ...props }) => (
      <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-muted/50 border-b border-border" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="divide-y divide-border/50" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr className="hover:bg-muted/20 transition-colors" {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }) => (
      <th
        className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-3 py-2 text-sm text-foreground" {...props}>
        {children}
      </td>
    ),
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnswerContent({
  content,
  isLoading,
  isLatest,
  patientReferences,
  sessionId,
}: AnswerContentProps) {
  const injectPatientLinks = usePatientLinkRenderer(patientReferences, sessionId);

  // Pre-process markdown content:
  // 1. Auto-promote bare image URLs to markdown image syntax
  // 2. During streaming, strip incomplete image markdown (no closing paren)
  //    so the partial URL doesn't flash as raw text while streaming
  const processedContent = React.useMemo(() => {
    const bareImageUrl =
      /(?<!\]\()https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico)(?:\?[^\s<>"]*)?(?!\))/gi;
    let result = content.replace(bareImageUrl, (url) => `![Image](${url})`);

    if (isLoading && isLatest) {
      // Remove any trailing incomplete image syntax, e.g. ![alt](http://...
      result = result.replace(/!\[[^\]]*\]\([^)]*$/, "");
    }

    return result;
  }, [content, isLoading, isLatest]);

  const components = React.useMemo(
    () => buildComponents(injectPatientLinks),
    [injectPatientLinks]
  );

  // Render team consultation synthesis as a structured card once streaming ends
  if (isConsultationSynthesis(content) && !(isLoading && isLatest)) {
    return <ConsultationCard content={content} />;
  }

  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
      {isLoading && isLatest && (
        <span className="inline-block w-1.5 h-[1em] ml-0.5 bg-primary align-middle animate-pulse rounded-sm" />
      )}
    </div>
  );
}
