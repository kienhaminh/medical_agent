"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface AnswerContentProps {
  content: string;
  isLoading?: boolean;
  isLatest?: boolean;
}

export function AnswerContent({ content, isLoading, isLatest }: AnswerContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere prose-p:leading-7 prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-pre:my-4 prose-code:text-cyan-400">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ node, inline, className, children, ...props }: any) => {
            return inline ? (
              <code className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }: any) => (
            <pre className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-lg overflow-x-auto" {...props}>
              {children}
            </pre>
          ),
          a: ({ children, ...props }: any) => (
            <a className="text-cyan-500 hover:text-cyan-400 underline transition-colors" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isLoading && isLatest && (
        <span className="inline-block w-2 h-4 ml-1 bg-cyan-500 animate-pulse" />
      )}
    </div>
  );
}
