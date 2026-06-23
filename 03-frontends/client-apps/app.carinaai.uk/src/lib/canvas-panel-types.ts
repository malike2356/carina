export type CanvasPanelLanguage = 'artifact' | 'canvas' | 'diagram' | 'code';

export type CanvasPanelPayload = {
  content: string;
  language: CanvasPanelLanguage;
  title?: string;
};
