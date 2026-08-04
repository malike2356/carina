'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { prefixInsertedBlock } from './editor-utils';
import { normalizeDocumentHtml } from './markdown-normalize';
import {
  createTiptapExtensions,
  type TiptapContentFormat,
} from './tiptap-extensions';
import type { CarinaEditorHandle } from './types';
import { TiptapToolbar, type ToolbarDensity } from './TiptapToolbar';

interface TiptapCarinaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  showToolbar?: boolean;
  disabled?: boolean;
  contentFormat?: TiptapContentFormat;
  toolbarDensity?: ToolbarDensity;
  pageLayout?: boolean;
}

function getMarkdown(editor: NonNullable<ReturnType<typeof useEditor>>): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return storage.markdown?.getMarkdown?.() ?? editor.getText();
}

function serialize(editor: NonNullable<ReturnType<typeof useEditor>>, format: TiptapContentFormat): string {
  if (format === 'html') return editor.getHTML();
  return getMarkdown(editor);
}

export const TiptapCarinaEditor = forwardRef<CarinaEditorHandle, TiptapCarinaEditorProps>(
  function TiptapCarinaEditor(
    {
      value,
      onChange,
      placeholder,
      minHeight,
      showToolbar = true,
      disabled,
      contentFormat = 'markdown',
      toolbarDensity = 'compact',
      pageLayout = false,
    },
    ref,
  ) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const migratingRef = useRef(false);

    const initialContent =
      contentFormat === 'html'
        ? normalizeDocumentHtml(value)
        : value || '';

    const editor = useEditor({
      extensions: createTiptapExtensions({ placeholder, format: contentFormat }),
      content: initialContent || (contentFormat === 'html' ? '<p></p>' : ''),
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: pageLayout ? 'tiptap-carina-editor tiptap-page-body' : 'tiptap-carina-editor',
        },
      },
      onUpdate: ({ editor: current }) => {
        if (migratingRef.current) return;
        onChangeRef.current(serialize(current, contentFormat));
      },
    });

    useEffect(() => {
      if (!editor) return;
      const current = serialize(editor, contentFormat);
      if (current === value) return;

      if (contentFormat === 'html') {
        const normalized = normalizeDocumentHtml(value);
        if (current === normalized) {
          if (normalized !== value) {
            migratingRef.current = true;
            onChangeRef.current(normalized);
            migratingRef.current = false;
          }
          return;
        }
        migratingRef.current = true;
        editor.commands.setContent(normalized, { emitUpdate: false });
        if (normalized !== value) {
          onChangeRef.current(normalized);
        }
        migratingRef.current = false;
        return;
      }

      editor.commands.setContent(value, { emitUpdate: false });
    }, [editor, value, contentFormat]);

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        if (!editor) return;
        if (contentFormat === 'html') {
          const html = text.includes('<')
            ? text
            : normalizeDocumentHtml(text);
          editor.chain().focus('end').insertContent(html).run();
          onChangeRef.current(serialize(editor, contentFormat));
          return;
        }
        const insertion = prefixInsertedBlock(getMarkdown(editor), text);
        if (!insertion) return;
        editor.chain().focus('end').insertContent(`\n\n${insertion}`).run();
        onChangeRef.current(serialize(editor, contentFormat));
      },
      replaceSelection(text: string) {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const incoming =
          contentFormat === 'html' && !text.includes('<')
            ? normalizeDocumentHtml(text)
            : text;
        if (!empty) {
          editor.chain().focus().deleteRange({ from, to }).insertContent(incoming).run();
        } else {
          editor.commands.setContent(incoming || (contentFormat === 'html' ? '<p></p>' : ''));
        }
        onChangeRef.current(serialize(editor, contentFormat));
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
      getHtml() {
        return editor?.getHTML() ?? '';
      },
      setHtml(html: string) {
        if (!editor) return;
        const normalized = normalizeDocumentHtml(html);
        editor.commands.setContent(normalized || '<p></p>', { emitUpdate: false });
        onChangeRef.current(serialize(editor, contentFormat));
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

    if (pageLayout) {
      return (
        <div
          className="tiptap-page-shell"
          style={minHeight ? { ['--carina-editor-min-height' as string]: minHeight } : undefined}
        >
          {showToolbar ? (
            <div className="tiptap-page-toolbar-sticky">
              <TiptapToolbar editor={editor} density={toolbarDensity} />
            </div>
          ) : null}
          <div className="tiptap-page-canvas">
            <div className="tiptap-page-sheet">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="overflow-hidden rounded-lg border border-border bg-transparent"
        style={minHeight ? { ['--carina-editor-min-height' as string]: minHeight } : undefined}
      >
        {showToolbar ? <TiptapToolbar editor={editor} density={toolbarDensity} /> : null}
        <EditorContent editor={editor} />
      </div>
    );
  },
);
