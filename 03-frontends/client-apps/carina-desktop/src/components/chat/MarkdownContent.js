import { jsx as _jsx } from "react/jsx-runtime";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
export default function MarkdownContent({ content, className }) {
    return (_jsx("div", { className: `prose prose-invert prose-sm max-w-none ${className ?? ''}`, children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHighlight], components: {
                a: ({ href, children }) => (_jsx("a", { href: href, target: "_blank", rel: "noreferrer", className: "text-blue-400 hover:underline", children: children })),
                code: ({ className: cls, children }) => {
                    const isBlock = Boolean(cls);
                    if (!isBlock) {
                        return _jsx("code", { className: "bg-zinc-800 px-1 rounded text-xs font-mono", children: children });
                    }
                    return (_jsx("code", { className: `${cls ?? ''} text-xs`, children: children }));
                },
            }, children: content }) }));
}
