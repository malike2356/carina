import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './CopyButton';
import { ArtifactCanvas } from './ArtifactCanvas';

function resolveEntityHref(href?: string | null) {
  if (!href || !href.startsWith('#')) return null;

  const entity = href.slice(1);
  const [type, ...rest] = entity.split('-');
  const id = rest.join('-');

  if (!type || !id) return null;

  switch (type) {
    case 'session':
      return `/chat/${id}`;
    case 'document':
      return `/documents/${id}`;
    case 'note':
      return '/documents';
    case 'email':
      return '/email';
    case 'calendar':
      return '/calendar';
    case 'task':
      return '/tasks';
    case 'skill':
      return '/library';
    case 'research':
      return '/research';
    case 'memory':
      return '/library';
    default:
      return null;
  }
}

const components: Components = {
  code({ className, children, ...props }) {
    const code = String(children ?? '').replace(/\n$/, '');
    const language = (className ?? '').replace('language-', '') || 'code';
    const isBlock = Boolean(className);

    if (isBlock && ['artifact', 'canvas', 'diagram'].includes(language)) {
      return (
        <ArtifactCanvas
          content={code}
          language={language as 'artifact' | 'canvas' | 'diagram'}
        />
      );
    }

    if (!isBlock) {
      return (
        <code
          className="rounded bg-code-bg px-1 py-0.5 font-mono text-[0.85em] text-code-text"
          {...props}
        >
          {code}
        </code>
      );
    }

    return (
      <div className="group relative my-3 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between bg-elevated px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase text-text-muted">
            {language}
          </span>
          <CopyButton text={code} size="sm" />
        </div>
        <pre className="overflow-x-auto bg-code-bg p-4 text-sm">
          <code className="whitespace-pre font-mono text-code-text" {...props}>
            {code}
          </code>
        </pre>
      </div>
    );
  },
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-text-primary">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-text-primary">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 text-sm font-medium text-text-primary">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-accent pl-3 text-text-secondary">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-elevated">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-t border-border px-3 py-2 text-xs text-text-primary">
      {children}
    </td>
  ),
  a: ({ href, children }) => {
    const entityHref = resolveEntityHref(href);
    if (entityHref) {
      return (
        <Link href={entityHref} className="text-accent hover:underline">
          {children}
        </Link>
      );
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
  hr: () => <hr className="my-3 border-border" />,
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
