"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { AnswerContentProps } from "@/types/agent-ui";
import { PatientLink } from "./patient-link";
import { ConsultationCard, isConsultationSynthesis } from "@/components/doctor/consultation-card";

export function AnswerContent({
  content,
  isLoading,
  isLatest,
  patientReferences,
  sessionId,
}: AnswerContentProps) {
  // Preprocess content to convert standalone image URLs to markdown images
  const processedContent = React.useMemo(() => {
    // Regular expression to match image URLs (not already in markdown syntax)
    const imageUrlRegex =
      /(?<!\]\()https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico)(?:\?[^\s<>"]*)?(?!\))/gi;

    return content.replace(imageUrlRegex, (url) => {
      // Check if URL is already part of markdown image syntax by looking at context
      // This is a simple check - if preceded by ]( then it's already markdown
      return `![Image](${url})`;
    });
  }, [content]);

  // Function to render text with patient links using provided indices
  const renderTextWithPatientLinks = (text: string) => {
    if (!patientReferences || patientReferences.length === 0) {
      return text;
    }

    // Sort references by start_index to process them in order
    const sortedReferences = [...patientReferences].sort(
      (a, b) => a.start_index - b.start_index
    );

    // Build the parts array with text and PatientLink components
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    sortedReferences.forEach((ref, idx) => {
      // Add text before this patient reference
      if (ref.start_index > lastIndex) {
        parts.push(text.substring(lastIndex, ref.start_index));
      }

      // Add PatientLink component
      parts.push(
        <PatientLink
          key={`patient-${ref.patient_id}-${idx}`}
          patientId={ref.patient_id}
          patientName={ref.patient_name}
          sessionId={sessionId}
        />
      );

      lastIndex = ref.end_index;
    });

    // Add any remaining text after the last patient reference
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const processChildren = (child: React.ReactNode): React.ReactNode => {
    if (typeof child === "string") {
      return renderTextWithPatientLinks(child);
    }
    if (React.isValidElement(child)) {
      const childProps = child.props as { children?: React.ReactNode };
      if (childProps.children) {
        return React.cloneElement(child as React.ReactElement<{ children?: React.ReactNode }>, {
          children: React.Children.map(childProps.children, processChildren),
        });
      }
    }
    return child;
  };

  const markdownComponents: Components = {
    code: ({ node: _node, className, children, ...props }) => {
      const inline = !className?.startsWith("language-");
      return inline ? (
        <code
          className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono"
          {...props}
        >
          {children}
        </code>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className="bg-primary/5 border border-primary/20 p-4 rounded-lg overflow-x-auto"
        {...props}
      >
        {children}
      </pre>
    ),
    a: ({ children, ...props }) => (
      <a
        className="text-primary hover:text-primary underline transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    img: ({ node: _node, alt, src, ...props }) => (
      <span className="block my-4">
        <img
          src={src}
          alt={alt || "Image"}
          className="max-w-full h-auto rounded-lg border border-primary/20 shadow-lg"
          loading="lazy"
          {...props}
        />
        {alt && alt !== "Image" && (
          <span className="block text-xs text-muted-foreground mt-2 italic text-center">
            {alt}
          </span>
        )}
      </span>
    ),
    p: ({ children, ...props }) => (
      <p {...props}>{React.Children.map(children, processChildren)}</p>
    ),
    li: ({ children, ...props }) => (
      <li {...props}>{React.Children.map(children, processChildren)}</li>
    ),
  };

  // Render team consultation synthesis as a structured card (after all hooks).
  // Defer until streaming is complete to avoid rendering a partial synthesis.
  if (isConsultationSynthesis(content) && !(isLoading && isLatest)) {
    return <ConsultationCard content={content} />;
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere prose-p:leading-7 prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-pre:my-4 prose-code:text-primary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
      {isLoading && isLatest && (
        <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
      )}
    </div>
  );
}
