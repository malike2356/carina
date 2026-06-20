import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className }: Props) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              {children}
            </a>
          ),
          code: ({ className: cls, children }) => {
            const isBlock = Boolean(cls);
            if (!isBlock) {
              return <code className="bg-zinc-800 px-1 rounded text-xs font-mono">{children}</code>;
            }
            return (
              <code className={`${cls ?? ''} text-xs`}>{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
