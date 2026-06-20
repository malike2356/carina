import { useState } from 'react';
import type { ChatMessage } from '../../store/chat.js';
import MessageMetadata from './MessageMetadata.js';

interface Props {
  message: ChatMessage;
  onEdit?: (newContent: string) => void;
}

export default function UserMessage({ message, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  function handleCopy() {
    void navigator.clipboard.writeText(message.content);
  }

  function handleSaveEdit() {
    if (draft.trim() && onEdit) {
      onEdit(draft.trim());
    }
    setEditing(false);
  }

  return (
    <div className="group flex gap-3 px-4 py-3 justify-end">
      <div className="max-w-[80%]">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
              >
                Send edit
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-zinc-100 whitespace-pre-wrap">
            {message.content}
          </div>
        )}
        <div className="flex justify-end items-center">
          <MessageMetadata timestamp={message.timestamp} onCopy={handleCopy} />
          {!editing && onEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
