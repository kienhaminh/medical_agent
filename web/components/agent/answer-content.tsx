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
  // Preprocess content to convert standalone image URLs to markdown images
  const processedContent = React.useMemo(() => {
    // Regular expression to match image URLs (not already in markdown syntax)
    const imageUrlRegex = /(?<!\]\()https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico)(?:\?[^\s<>"]*)?(?!\))/gi;

    return content.replace(imageUrlRegex, (url) => {
      // Check if URL is already part of markdown image syntax by looking at context
      // This is a simple check - if preceded by ]( then it's already markdown
      return `![Image](${url})`;
    });
  }, [content]);

  // Create a map of patient names to their info for quick lookup
  const patientMap = React.useMemo(() => {
    console.log("AnswerContent - patientReferences:", patientReferences);
    if (!patientReferences || patientReferences.length === 0) {
      return new Map();
    }

    const map = new Map();
    patientReferences.forEach(ref => {
      console.log("Adding to patientMap:", ref.patient_name, "ID:", ref.patient_id);
      map.set(ref.patient_name, {
        patientId: ref.patient_id,
        patientName: ref.patient_name
      });
    });
    console.log("PatientMap created with", map.size, "entries");
    return map;
  }, [patientReferences]);

  // Function to render text with patient links
  const renderTextWithPatientLinks = (text: string) => {
    if (patientMap.size === 0) {
      return text;
    }

    // Find all patient name matches with their positions
    const matches: Array<{
      start: number;
      end: number;
      patientId: number;
      patientName: string;
    }> = [];

    patientMap.forEach((patientInfo, patientName) => {
      // Escape special regex characters in patient name
      const escapedName = patientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + patientName.length,
          patientId: patientInfo.patientId,
          patientName: patientInfo.patientName,
        });
      }
    });

    // If no matches found, return original text
    if (matches.length === 0) {
      return text;
    }

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    // Build the parts array with text and PatientLink components
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    matches.forEach((match, idx) => {
      // Add text before this match
      if (match.start > lastIndex) {
        parts.push(text.substring(lastIndex, match.start));
      }

      // Add PatientLink component
      parts.push(
        <PatientLink
          key={`patient-${match.patientId}-${idx}`}
          patientId={match.patientId}
          patientName={match.patientName}
          sessionId={sessionId}
        />
      );

      lastIndex = match.end;
    });

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

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
          img: ({ node, alt, src, ...props }: any) => (
            <span className="block my-4">
              <img
                src={src}
                alt={alt || "Image"}
                className="max-w-full h-auto rounded-lg border border-cyan-500/20 shadow-lg"
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
          // Custom text renderer to handle patient links
          p: ({ children, ...props }: any) => {
            const processChildren = (child: any): any => {
              if (typeof child === "string") {
                return renderTextWithPatientLinks(child);
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
              <p {...props}>{React.Children.map(children, processChildren)}</p>
            );
          },
          li: ({ children, ...props }: any) => {
            const processChildren = (child: any): any => {
              if (typeof child === "string") {
                return renderTextWithPatientLinks(child);
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
              <li {...props}>
                {React.Children.map(children, processChildren)}
              </li>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isLoading && isLatest && (
        <span className="inline-block w-2 h-4 ml-1 bg-cyan-500 animate-pulse" />
      )}
    </div>
  );
}
