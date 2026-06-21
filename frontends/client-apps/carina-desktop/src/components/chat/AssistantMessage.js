import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ThinkingBlock from './ThinkingBlock.js';
import ToolCallBlock from './ToolCallBlock.js';
import MarkdownContent from './MarkdownContent.js';
import MessageMetadata from './MessageMetadata.js';
export default function AssistantMessage({ message }) {
    function handleCopy() {
        void navigator.clipboard.writeText(message.content);
    }
    return (_jsxs("div", { className: "group flex gap-3 px-4 py-3", children: [_jsx("div", { className: "w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5", children: "C" }), _jsxs("div", { className: "flex-1 min-w-0", children: [message.thinkingContent && (_jsx(ThinkingBlock, { content: message.thinkingContent, isStreaming: message.isStreaming })), message.toolCalls?.map((tc) => (_jsx(ToolCallBlock, { toolCall: tc }, tc.id))), message.content && (_jsx(MarkdownContent, { content: message.content })), message.isStreaming && !message.content && !message.thinkingContent && (_jsx("span", { className: "inline-block w-2 h-4 bg-zinc-400 animate-pulse" })), _jsx(MessageMetadata, { timestamp: message.timestamp, onCopy: handleCopy })] })] }));
}
