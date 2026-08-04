'use client';

import dynamic from 'next/dynamic';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';
import { EditorEngineSwitch } from './EditorEngineSwitch';
import { useEditorEngine } from './use-editor-engine';
import type { CarinaEditorHandle, CarinaEditorProps } from './types';
import './carina-editor-theme.css';

function EditorLoading({ minHeight }: { minHeight: string }) {
  return (
    <div
      className="rounded-lg border border-border p-4 text-sm text-text-muted"
      style={{ minHeight }}
    >
      Loading editor...
    </div>
  );
}

const MdxCarinaEditor = dynamic(
  () => import('./MdxCarinaEditor').then((mod) => mod.MdxCarinaEditor),
  {
    ssr: false,
    loading: () => <EditorLoading minHeight="8rem" />,
  },
);

const TiptapCarinaEditor = dynamic(
  () => import('./TiptapCarinaEditor').then((mod) => mod.TiptapCarinaEditor),
  {
    ssr: false,
    loading: () => <EditorLoading minHeight="8rem" />,
  },
);

export const CarinaEditor = forwardRef<CarinaEditorHandle, CarinaEditorProps>(
  function CarinaEditor(
    {
      value,
      onChange,
      placeholder,
      className,
      minHeight,
      variant = 'default',
      engine: controlledEngine,
      defaultEngine = 'mdx',
      onEngineChange,
      showEngineSwitch = true,
      showToolbar = true,
      disabled = false,
      contentFormat = 'markdown',
      toolbarDensity = 'compact',
      pageLayout = false,
    },
    ref,
  ) {
    const resolvedMinHeight = minHeight ?? (variant === 'compact' ? '8rem' : '50vh');
    const { engine: storedEngine, setEngine, hydrated } = useEditorEngine(defaultEngine);
    const engine = controlledEngine ?? storedEngine;
    const mdxRef = useRef<CarinaEditorHandle>(null);
    const tiptapRef = useRef<CarinaEditorHandle>(null);

    const activeRef = engine === 'mdx' ? mdxRef : tiptapRef;

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        activeRef.current?.insertText(text);
      },
      replaceSelection(text: string) {
        activeRef.current?.replaceSelection(text);
      },
      getSelection() {
        return activeRef.current?.getSelection() ?? '';
      },
      focus() {
        activeRef.current?.focus();
      },
      getHtml() {
        return activeRef.current?.getHtml?.() ?? '';
      },
      setHtml(html: string) {
        activeRef.current?.setHtml?.(html);
      },
    }));

    function handleEngineChange(next: typeof engine) {
      if (!controlledEngine) {
        setEngine(next);
      }
      onEngineChange?.(next);
    }

    return (
      <div
        className={cn(
          'carina-editor-root flex flex-col gap-2',
          variant === 'compact' && 'carina-editor-compact',
          pageLayout && 'carina-editor-page',
          className,
        )}
      >
        {showEngineSwitch && hydrated && (
          <div
            className={cn(
              'flex items-center gap-2',
              variant === 'default' ? 'justify-between' : 'justify-end',
            )}
          >
            {variant === 'default' ? (
              <p className="text-[10px] text-text-muted">
                Switch between MDX markdown and Tiptap rich text. Content stays in markdown.
              </p>
            ) : null}
            <EditorEngineSwitch
              engine={engine}
              onChange={handleEngineChange}
              disabled={disabled}
            />
          </div>
        )}

        {engine === 'mdx' ? (
          <MdxCarinaEditor
            key="mdx"
            ref={mdxRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            minHeight={resolvedMinHeight}
            showToolbar={showToolbar}
            disabled={disabled}
          />
        ) : (
          <TiptapCarinaEditor
            key={`tiptap-${contentFormat}-${pageLayout ? 'page' : 'plain'}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            minHeight={resolvedMinHeight}
            showToolbar={showToolbar}
            disabled={disabled}
            contentFormat={contentFormat}
            toolbarDensity={toolbarDensity}
            pageLayout={pageLayout}
            ref={tiptapRef}
          />
        )}
      </div>
    );
  },
);

export type { CarinaEditorHandle, CarinaEditorProps, EditorEngine } from './types';
