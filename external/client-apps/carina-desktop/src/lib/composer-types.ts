export type Attachment =
  | {
      kind: 'file';
      id: string;
      name: string;
      path?: string;
      size: number;
      mimeType: string;
      file?: File;
    }
  | {
      kind: 'image';
      id: string;
      name: string;
      path?: string;
      size: number;
      mimeType: string;
      previewUrl: string;
      file?: File;
    }
  | {
      kind: 'url';
      id: string;
      url: string;
      title?: string;
      description?: string;
      favicon?: string;
    };

export type SlashCommand = {
  name: string;
  description: string;
  category: 'builtin' | 'skill' | 'quick';
  trigger: string;
};

export type MentionTarget = {
  id: string;
  name: string;
  type: 'session' | 'agent' | 'skill';
  subtitle?: string;
};

export function formatMessageWithAttachments(text: string, attachments: Attachment[]): string {
  if (attachments.length === 0) return text.trim();
  const attachmentLines = attachments.map((item) => {
    if (item.kind === 'url') {
      return `[${item.title ?? item.url}](${item.url})`;
    }
    if (item.kind === 'image') {
      return `![${item.name}](attachment:${item.name})`;
    }
    return `[file: ${item.name}]`;
  });
  return [text.trim(), ...attachmentLines].filter(Boolean).join('\n\n');
}

export function attachmentFromFile(file: File, path?: string): Attachment {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (file.type.startsWith('image/')) {
    return {
      kind: 'image',
      id,
      name: file.name,
      path,
      size: file.size,
      mimeType: file.type,
      previewUrl: URL.createObjectURL(file),
      file,
    };
  }
  return {
    kind: 'file',
    id,
    name: file.name,
    path,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    file,
  };
}
