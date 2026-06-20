import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $messages, $isStreaming, $streamingMessageId, $pendingApproval, $streamRequest, } from '../store/chat.js';
import { openChatStream } from '../lib/gateway-client.js';
import { parseStreamEvent } from '../lib/stream-events.js';
import { saveLocalMessages } from '../lib/session-store.js';
import { notifyApprovalNeeded, notifyError, notifyTaskComplete } from '../lib/notifications.js';
function assistantMessageId(turnId) {
    return `msg-${turnId}`;
}
function applyStreamEvent(event, turnId, sessionId) {
    const msgs = $messages.get();
    const messageId = event.type === 'token' && event.messageId === 'stream'
        ? assistantMessageId(turnId)
        : 'messageId' in event && typeof event.messageId === 'string'
            ? event.messageId
            : assistantMessageId(turnId);
    if (event.type === 'token') {
        const existing = msgs.find((m) => m.id === messageId);
        if (existing) {
            $messages.set(msgs.map((m) => m.id === messageId
                ? { ...m, content: m.content + event.content, isStreaming: true }
                : m));
        }
        else {
            const newMsg = {
                id: messageId,
                role: 'assistant',
                content: event.content,
                timestamp: Date.now(),
                isStreaming: true,
            };
            $messages.set([...msgs, newMsg]);
            $streamingMessageId.set(messageId);
            $isStreaming.set(true);
        }
        return;
    }
    if (event.type === 'thinking') {
        const existing = msgs.find((m) => m.id === messageId);
        if (existing) {
            $messages.set(msgs.map((m) => m.id === messageId
                ? { ...m, thinkingContent: (m.thinkingContent ?? '') + event.content, isStreaming: true }
                : m));
        }
        else {
            $messages.set([
                ...msgs,
                {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    thinkingContent: event.content,
                    timestamp: Date.now(),
                    isStreaming: true,
                },
            ]);
            $streamingMessageId.set(messageId);
            $isStreaming.set(true);
        }
        return;
    }
    if (event.type === 'tool.start') {
        const toolCall = {
            id: event.toolCallId,
            name: event.name,
            args: event.args,
            status: 'running',
        };
        const existing = msgs.find((m) => m.id === messageId);
        if (existing) {
            $messages.set(msgs.map((m) => m.id === messageId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall], isStreaming: true }
                : m));
        }
        else {
            $messages.set([
                ...msgs,
                {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    toolCalls: [toolCall],
                    timestamp: Date.now(),
                    isStreaming: true,
                },
            ]);
            $streamingMessageId.set(messageId);
            $isStreaming.set(true);
        }
        return;
    }
    if (event.type === 'tool.complete') {
        $messages.set(msgs.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) => tc.id === event.toolCallId
                ? { ...tc, result: event.result, durationMs: event.durationMs, status: 'done' }
                : tc),
        })));
        return;
    }
    if (event.type === 'tool.error') {
        $messages.set(msgs.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) => tc.id === event.toolCallId
                ? { ...tc, result: event.error, status: 'error' }
                : tc),
        })));
        return;
    }
    if (event.type === 'message.complete') {
        $messages.set(msgs.map((m) => m.id === messageId ? { ...m, isStreaming: false } : m));
        return;
    }
    if (event.type === 'approval.request') {
        $pendingApproval.set({
            toolName: event.toolName,
            params: event.params,
            reason: event.reason,
            runId: event.runId,
            level: event.level,
        });
        void notifyApprovalNeeded(`${event.toolName}: ${event.reason ?? 'approval required'}`);
        return;
    }
    if (event.type === 'error') {
        const existing = msgs.find((m) => m.id === messageId);
        if (existing) {
            $messages.set(msgs.map((m) => m.id === messageId
                ? { ...m, content: `${m.content}\nError: ${event.message}`.trim(), isStreaming: false }
                : m));
        }
        else {
            $messages.set([
                ...msgs,
                {
                    id: messageId,
                    role: 'assistant',
                    content: event.message,
                    timestamp: Date.now(),
                    isStreaming: false,
                },
            ]);
        }
        $streamingMessageId.set(null);
        $isStreaming.set(false);
        saveLocalMessages(sessionId, $messages.get());
        void notifyError(event.message);
        return;
    }
    if (event.type === 'done') {
        $messages.set($messages.get().map((m) => m.id === assistantMessageId(turnId) ? { ...m, isStreaming: false } : m));
        $streamingMessageId.set(null);
        $isStreaming.set(false);
        saveLocalMessages(sessionId, $messages.get());
        const completed = $messages.get().find((m) => m.id === assistantMessageId(turnId));
        void notifyTaskComplete(completed?.content?.slice(0, 80) || 'Response ready');
    }
}
export function useChatStream() {
    const streamRequest = useStore($streamRequest);
    const esRef = useRef(null);
    useEffect(() => {
        if (!streamRequest)
            return;
        esRef.current?.close();
        const { sessionId, message, turnId } = streamRequest;
        const es = openChatStream({ sessionId, message, turnId });
        esRef.current = es;
        $isStreaming.set(true);
        const handlePayload = (raw, eventName) => {
            const event = parseStreamEvent(raw, eventName);
            if (!event)
                return;
            applyStreamEvent(event, turnId, sessionId);
        };
        es.onmessage = (ev) => {
            handlePayload(ev.data);
        };
        for (const eventName of ['token', 'status', 'meta', 'tool', 'error', 'done']) {
            es.addEventListener(eventName, (ev) => {
                const messageEvent = ev;
                handlePayload(messageEvent.data, eventName);
            });
        }
        es.onerror = () => {
            $isStreaming.set(false);
            $streamingMessageId.set(null);
            es.close();
            esRef.current = null;
        };
        return () => {
            es.close();
            esRef.current = null;
        };
    }, [streamRequest]);
}
