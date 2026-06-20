import { jsx as _jsx } from "react/jsx-runtime";
import AttachmentPreview from './AttachmentPreview.js';
export default function AttachPanel({ attachments, onRemove }) {
    if (attachments.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-2 border-b border-zinc-800 px-3 py-2", children: attachments.map((attachment) => (_jsx(AttachmentPreview, { attachment: attachment, onRemove: () => onRemove(attachment.id) }, attachment.id))) }));
}
