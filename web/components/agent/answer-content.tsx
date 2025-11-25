"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { AnswerContentProps } from "@/types/agent-ui";
import { PatientLink } from "./patient-link";

export function AnswerContent({
  content,
  isLoading,
  isLatest,
  patientReferences,
  sessionId,
}: AnswerContentProps) {
  // Process content to replace patient references with PatientLink components
  const processedContent = React.useMemo(() => {
    if (!patientReferences || patientReferences.length === 0) {
      return content;
    }

    // Sort references by start_index in descending order to replace from end to start
    const sortedRefs = [...patientReferences].sort(
      (a, b) => b.start_index - a.start_index
    );

    let processedText = content;

    // Replace each patient reference with a unique marker that we can identify later
    sortedRefs.forEach((ref, index) => {
      const before = processedText.substring(0, ref.start_index);
      const after = processedText.substring(ref.end_index);
      const marker = `__PATIENT_LINK_${index}__`;
      processedText = before + marker + after;
    });

    return { processedText, references: sortedRefs };
  }, [content, patientReferences]);

  // Custom text renderer to replace markers with PatientLink components
  const renderText = (text: string) => {
    if (
      typeof processedContent === "object" &&
      processedContent.references
    ) {
      const parts: (string | React.ReactElement)[] = [];
      let lastIndex = 0;

      processedContent.references.forEach((ref, index) => {
        const marker = `__PATIENT_LINK_${index}__`;
        const markerIndex = text.indexOf(marker, lastIndex);

        if (markerIndex !== -1) {
          // Add text before marker
          if (markerIndex > lastIndex) {
            parts.push(text.substring(lastIndex, markerIndex));
          }

          // Add PatientLink component
          parts.push(
            <PatientLink
              key={`patient-${ref.patient_id}-${index}`}
              patientId={ref.patient_id}
              patientName={ref.patient_name}
              sessionId={sessionId}
            />
          );

          lastIndex = markerIndex + marker.length;
        }
      });

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts.length > 0 ? parts : text;
    }

    return text;
  };

  const displayContent =
    typeof processedContent === "object"
      ? processedContent.processedText
      : processedContent;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere prose-p:leading-7 prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-pre:my-4 prose-code:text-cyan-400">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ node, inline, className, children, ...props }: any) => {
            return inline ? (
              <code
                className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded text-xs font-mono"
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
          pre: ({ children, ...props }: any) => (
            <pre
              className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-lg overflow-x-auto"
              {...props}
            >
              {children}
            </pre>
          ),
          a: ({ children, ...props }: any) => (
            <a
              className="text-cyan-500 hover:text-cyan-400 underline transition-colors"
              {...props}
            >
              {children}
            </a>
          ),
          // Custom text renderer to handle patient links
          p: ({ children, ...props }: any) => {
            const processChildren = (child: any): any => {
              if (typeof child === "string") {
                return renderText(child);
              }
              if (React.isValidElement(child)) {
                const childProps = child.props as any;
                if (childProps.children) {
                  return React.cloneElement(child, {
                    children: React.Children.map(
                      childProps.children,
                      processChildren
                    ),
                  } as any);
                }
              }
              return child;
            };

            return (
              <p {...props}>
                {React.Children.map(children, processChildren)}
              </p>
            );
          },
        }}
      >
        {displayContent}
      </ReactMarkdown>
      {isLoading && isLatest && (
        <span className="inline-block w-2 h-4 ml-1 bg-cyan-500 animate-pulse" />
      )}
    </div>
  );
}
