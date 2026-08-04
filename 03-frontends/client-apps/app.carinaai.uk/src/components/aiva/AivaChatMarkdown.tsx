'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Strip leaked tool/debug noise from historical chat bubbles. */
export function scrubAivaChatContent(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\[using [^\]]+\][ \t]*\n?/gim, '')
    .replace(/\n[ \t]*\[using [^\]]+\][ \t]*(?=\n|$)/gim, '\n')
    .replace(/\n?\n?Working set from this turn \(tool evidence; prefer over older memory notes\):[\s\S]*$/i, '')
    .replace(/\n?\n?Working set updated \(\d+ tool results\)\. Full evidence is in ACTIVE WORKING SET for follow-ups\.?/gi, '')
    .replace(/^\[Cost preflight:[^\]]*\]\s*/i, '')
    .replace(/\n?\[Durable memory demoted:[^\]]*\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u2014|\u2013/g, ';')
    .trim();
}

const components: Components = {
  h1: ({ children }) => (
    <h3 className="mb-2 mt-3 text-[15px] font-semibold tracking-tight text-text-primary first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-3 text-[15px] font-semibold tracking-tight text-text-primary first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 mt-2.5 text-sm font-semibold text-text-primary first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 text-sm leading-relaxed text-text-primary last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2.5 list-disc space-y-1 pl-4 text-sm leading-relaxed last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 list-decimal space-y-1 pl-4 text-sm leading-relaxed last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="marker:text-text-muted">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-accent underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const block = Boolean(className);
    if (block) {
      return (
        <code className={cn('block whitespace-pre-wrap font-mono text-[12px] text-text-secondary', className)}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-overlay/70 px-1 py-0.5 font-mono text-[12px] text-text-secondary">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2.5 overflow-x-auto rounded-lg border border-border bg-base/80 px-3 py-2 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2.5 border-l-2 border-accent/40 pl-3 text-sm text-text-secondary last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/70" />,
};

export function AivaChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const cleaned = scrubAivaChatContent(content);
  if (!cleaned) return null;

  return (
    <div className={cn('aiva-chat-md max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
