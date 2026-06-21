import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $currentSessionId } from '../../store/session.js';
import { $isStreaming } from '../../store/chat.js';
import SessionHeader from '../../components/SessionHeader.js';
import MessageList from '../../components/chat/MessageList.js';
import ApprovalDialog from '../../components/chat/ApprovalDialog.js';
import Composer from '../../components/composer/Composer.js';
import { useSessionActions } from '../../hooks/use-session-actions.js';
import type { Attachment } from '../../lib/composer-types.js';

interface Props {
  onNeedSession: () => void;
}

export default function ChatPage({ onNeedSession }: Props) {
  const currentSessionId = useStore($currentSessionId);
  const isStreaming = useStore($isStreaming);
  const { submitMessage, editUserMessage } = useSessionActions();

  useEffect(() => {
    if (!currentSessionId) onNeedSession();
  }, [currentSessionId, onNeedSession]);

  if (!currentSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Select a session or start a new one
      </div>
    );
  }

  return (
    <>
      <SessionHeader />
      <MessageList onEditUserMessage={editUserMessage} />
      <Composer
        sessionId={currentSessionId}
        onSubmit={(content: string, attachments: Attachment[]) => {
          if (isStreaming) return;
          submitMessage(content, attachments);
        }}
        disabled={isStreaming}
      />
      <ApprovalDialog sessionId={currentSessionId} />
    </>
  );
}
