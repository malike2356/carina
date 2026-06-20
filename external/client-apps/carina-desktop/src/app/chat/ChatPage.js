import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $currentSessionId } from '../../store/session.js';
import { $isStreaming } from '../../store/chat.js';
import SessionHeader from '../../components/SessionHeader.js';
import MessageList from '../../components/chat/MessageList.js';
import ApprovalDialog from '../../components/chat/ApprovalDialog.js';
import Composer from '../../components/composer/Composer.js';
import { useSessionActions } from '../../hooks/use-session-actions.js';
export default function ChatPage({ onNeedSession }) {
    const currentSessionId = useStore($currentSessionId);
    const isStreaming = useStore($isStreaming);
    const { submitMessage, editUserMessage } = useSessionActions();
    useEffect(() => {
        if (!currentSessionId)
            onNeedSession();
    }, [currentSessionId, onNeedSession]);
    if (!currentSessionId) {
        return (_jsx("div", { className: "flex-1 flex items-center justify-center text-zinc-500", children: "Select a session or start a new one" }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(SessionHeader, {}), _jsx(MessageList, { onEditUserMessage: editUserMessage }), _jsx(Composer, { sessionId: currentSessionId, onSubmit: (content, attachments) => {
                    if (isStreaming)
                        return;
                    submitMessage(content, attachments);
                }, disabled: isStreaming }), _jsx(ApprovalDialog, { sessionId: currentSessionId })] }));
}
