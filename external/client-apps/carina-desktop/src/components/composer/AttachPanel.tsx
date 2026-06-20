import type { Attachment } from '../../lib/composer-types.js';
import AttachmentPreview from './AttachmentPreview.js';

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export default function AttachPanel({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-3 py-2">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
}
