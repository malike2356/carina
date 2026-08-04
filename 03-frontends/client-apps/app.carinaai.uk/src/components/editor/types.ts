export type EditorEngine = 'mdx' | 'tiptap';

export const EDITOR_ENGINE_STORAGE_KEY = 'carina-editor-engine';

export interface CarinaEditorHandle {
  insertText: (text: string) => void;
  replaceSelection: (text: string) => void;
  getSelection: () => string;
  focus: () => void;
  getHtml?: () => string;
  setHtml?: (html: string) => void;
}

export type CarinaEditorVariant = 'default' | 'compact';

export type { TiptapContentFormat } from './tiptap-extensions';
export type { ToolbarDensity } from './TiptapToolbar';

export interface CarinaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  variant?: CarinaEditorVariant;
  engine?: EditorEngine;
  defaultEngine?: EditorEngine;
  onEngineChange?: (engine: EditorEngine) => void;
  showEngineSwitch?: boolean;
  showToolbar?: boolean;
  disabled?: boolean;
  /** TipTap serialization. Documents use html; compact surfaces keep markdown. */
  contentFormat?: import('./tiptap-extensions').TiptapContentFormat;
  toolbarDensity?: import('./TiptapToolbar').ToolbarDensity;
  /** Word-like page canvas (Documents). */
  pageLayout?: boolean;
}
