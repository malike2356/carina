'use client';

import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';

interface TiptapToolbarProps {
  editor: Editor;
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(active && 'is-active')}
    >
      {label}
    </button>
  );
}

export function TiptapToolbar({ editor }: TiptapToolbarProps) {
  return (
    <div className="tiptap-toolbar">
      <ToolbarButton
        label="B"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="H1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="H2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="List"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1."
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Code"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
    </div>
  );
}
