'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  linkPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { prefixInsertedBlock } from './editor-utils';
import type { CarinaEditorHandle } from './types';

interface MdxCarinaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  showToolbar?: boolean;
  disabled?: boolean;
}

export const MdxCarinaEditor = forwardRef<CarinaEditorHandle, MdxCarinaEditorProps>(
  function MdxCarinaEditor({ value, onChange, placeholder, minHeight, showToolbar = true, disabled }, ref) {
    const editorRef = useRef<MDXEditorMethods>(null);
    const valueRef = useRef(value);

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (editor.getMarkdown() !== value) {
        editor.setMarkdown(value);
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        const editor = editorRef.current;
        if (!editor) return;
        const insertion = prefixInsertedBlock(editor.getMarkdown(), text);
        if (!insertion) return;
        editor.focus();
        editor.insertMarkdown(insertion);
        onChange(editor.getMarkdown());
      },
      replaceSelection(text: string) {
        const editor = editorRef.current;
        if (!editor) return;
        const selection = editor.getSelectionMarkdown().trim();
        if (selection) {
          const current = editor.getMarkdown();
          const next = current.replace(selection, text.trim());
          editor.setMarkdown(next);
          onChange(next);
          return;
        }
        editor.setMarkdown(text);
        onChange(text);
      },
      getSelection() {
        return editorRef.current?.getSelectionMarkdown().trim() ?? '';
      },
      focus() {
        editorRef.current?.focus();
      },
    }));

    return (
      <div style={minHeight ? { ['--carina-editor-min-height' as string]: minHeight } : undefined}>
        <MDXEditor
          ref={editorRef}
          markdown={value}
          readOnly={disabled}
          placeholder={placeholder}
          contentEditableClassName="prose prose-invert max-w-none text-text-primary"
          onChange={(markdown, initialNormalize) => {
            valueRef.current = markdown;
            if (!initialNormalize) {
              onChange(markdown);
            }
          }}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            linkPlugin(),
            markdownShortcutPlugin(),
            ...(showToolbar
              ? [
                  toolbarPlugin({
                    toolbarContents: () => (
                      <>
                        <UndoRedo />
                        <BoldItalicUnderlineToggles />
                        <BlockTypeSelect />
                        <ListsToggle />
                        <CreateLink />
                      </>
                    ),
                  }),
                ]
              : []),
          ]}
        />
      </div>
    );
  },
);
