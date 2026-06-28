'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { prefixInsertedBlock } from './editor-utils';
import type { CarinaEditorHandle } from './types';
import { TiptapToolbar } from './TiptapToolbar';

interface TiptapCarinaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  showToolbar?: boolean;
  disabled?: boolean;
}

function getMarkdown(editor: NonNullable<ReturnType<typeof useEditor>>): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return storage.markdown?.getMarkdown?.() ?? editor.getText();
}

export const TiptapCarinaEditor = forwardRef<CarinaEditorHandle, TiptapCarinaEditorProps>(
  function TiptapCarinaEditor({ value, onChange, placeholder, minHeight, showToolbar = true, disabled }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Markdown.configure({
          html: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: value,
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'tiptap-carina-editor',
          'data-placeholder': placeholder ?? 'Start writing...',
        },
      },
      onUpdate: ({ editor: current }) => {
        onChange(getMarkdown(current));
      },
    });

    useEffect(() => {
      if (!editor) return;
      const current = getMarkdown(editor);
      if (current !== value) {
        editor.commands.setContent(value);
      }
    }, [editor, value]);

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        if (!editor) return;
        const insertion = prefixInsertedBlock(getMarkdown(editor), text);
        if (!insertion) return;
        editor.chain().focus('end').insertContent(`\n\n${insertion}`).run();
        onChange(getMarkdown(editor));
      },
      replaceSelection(text: string) {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (!empty) {
          editor.chain().focus().deleteRange({ from, to }).insertContent(text).run();
        } else {
          editor.commands.setContent(text);
        }
        onChange(getMarkdown(editor));
      },
      getSelection() {
        if (!editor) return '';
        const { from, to, empty } = editor.state.selection;
        if (empty) return '';
        return editor.state.doc.textBetween(from, to, '\n\n').trim();
      },
      focus() {
        editor?.chain().focus().run();
      },
    }));

    if (!editor) {
      return (
        <div
          className="tiptap-carina-editor rounded-lg border border-border text-sm text-text-muted"
          style={{ minHeight: minHeight ?? '50vh' }}
        >
          Loading editor...
        </div>
      );
    }

    return (
      <div
        className="overflow-hidden rounded-lg border border-border bg-transparent"
        style={minHeight ? { ['--carina-editor-min-height' as string]: minHeight } : undefined}
      >
        {showToolbar ? <TiptapToolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
    );
  },
);
