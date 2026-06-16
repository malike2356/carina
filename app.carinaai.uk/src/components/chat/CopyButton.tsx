'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

export function CopyButton({
  text,
  size = 'md',
}: {
  text: string;
  size?: 'sm' | 'md';
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <IconButton label={copied ? 'Copied' : 'Copy'} size={size} onClick={copy}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-accent" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </IconButton>
  );
}
