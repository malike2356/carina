import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { Virtuoso } from 'react-virtuoso';
import { $messages } from '../../store/chat.js';
import AssistantMessage from './AssistantMessage.js';
import StreamingMessage from './StreamingMessage.js';
import UserMessage from './UserMessage.js';
export default function MessageList({ onEditUserMessage }) {
    const messages = useStore($messages);
    const virtuosoRef = useRef(null);
    useEffect(() => {
        if (messages.length > 0) {
            virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
        }
    }, [messages.length, messages[messages.length - 1]?.content]);
    if (messages.length === 0) {
        return (_jsx("div", { className: "flex-1 flex items-center justify-center text-zinc-500 text-sm", children: "Start a conversation" }));
    }
    return (_jsx(Virtuoso, { ref: virtuosoRef, data: messages, className: "flex-1", followOutput: "smooth", itemContent: (_, message) => {
            if (message.role === 'user') {
                return (_jsx(UserMessage, { message: message, onEdit: onEditUserMessage
                        ? (newContent) => onEditUserMessage(message.id, newContent)
                        : undefined }, message.id));
            }
            if (message.isStreaming) {
                return _jsx(StreamingMessage, { message: message }, message.id);
            }
            return _jsx(AssistantMessage, { message: message }, message.id);
        } }));
}
