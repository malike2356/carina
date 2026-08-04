'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolbarDensity = 'compact' | 'full';

interface TiptapToolbarProps {
  editor: Editor;
  density?: ToolbarDensity;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(active && 'is-active')}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="tiptap-toolbar-divider" aria-hidden />;
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined;
  const url = window.prompt('Link URL', previous ?? 'https://');
  if (url === null) return;
  const trimmed = url.trim();
  if (!trimmed) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
}

function addImage(editor: Editor) {
  const url = window.prompt('Image URL (or paste a data URL)');
  if (!url?.trim()) return;
  editor.chain().focus().setImage({ src: url.trim() }).run();
}

function insertTable(editor: Editor) {
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

const FONT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Instrument Sans', value: 'Instrument Sans, ui-sans-serif, system-ui, sans-serif' },
];

export function TiptapToolbar({ editor, density = 'compact' }: TiptapToolbarProps) {
  const full = density === 'full';

  return (
    <div className={cn('tiptap-toolbar', full && 'tiptap-toolbar-full')}>
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarDivider />

      {full ? (
        <>
          <select
            aria-label="Font"
            className="tiptap-toolbar-select"
            value={String(editor.getAttributes('textStyle').fontFamily ?? '')}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                editor.chain().focus().unsetFontFamily().run();
                return;
              }
              editor.chain().focus().setFontFamily(value).run();
            }}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Paragraph style"
            className="tiptap-toolbar-select"
            value={
              editor.isActive('heading', { level: 1 })
                ? 'h1'
                : editor.isActive('heading', { level: 2 })
                  ? 'h2'
                  : editor.isActive('heading', { level: 3 })
                    ? 'h3'
                    : editor.isActive('heading', { level: 4 })
                      ? 'h4'
                      : 'p'
            }
            onChange={(event) => {
              const value = event.target.value;
              const chain = editor.chain().focus();
              if (value === 'p') chain.setParagraph().run();
              if (value === 'h1') chain.toggleHeading({ level: 1 }).run();
              if (value === 'h2') chain.toggleHeading({ level: 2 }).run();
              if (value === 'h3') chain.toggleHeading({ level: 3 }).run();
              if (value === 'h4') chain.toggleHeading({ level: 4 }).run();
            }}
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>
          <ToolbarDivider />
        </>
      ) : (
        <>
          <ToolbarButton
            label="Heading 1"
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      {full ? (
        <>
          <label className="tiptap-toolbar-color" title="Text color">
            <input
              type="color"
              aria-label="Text color"
              value={String(editor.getAttributes('textStyle').color ?? '#111827')}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            />
          </label>
          <ToolbarButton
            label="Highlight"
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            label="Align left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Justify"
            active={editor.isActive({ textAlign: 'justify' })}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      ) : null}

      <ToolbarDivider />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      {full ? (
        <>
          <ToolbarDivider />
          <ToolbarButton label="Link" active={editor.isActive('link')} onClick={() => setLink(editor)}>
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton label="Image" onClick={() => addImage(editor)}>
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton label="Insert table" onClick={() => insertTable(editor)}>
            <TableIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Paragraph"
            active={editor.isActive('paragraph')}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="h-3.5 w-3.5" />
          </ToolbarButton>
          {editor.isActive('table') ? (
            <>
              <ToolbarDivider />
              <ToolbarButton label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                +Col
              </ToolbarButton>
              <ToolbarButton label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
                +Row
              </ToolbarButton>
              <ToolbarButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
                Del table
              </ToolbarButton>
            </>
          ) : null}
        </>
      ) : (
        <>
          <ToolbarButton label="Link" active={editor.isActive('link')} onClick={() => setLink(editor)}>
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
