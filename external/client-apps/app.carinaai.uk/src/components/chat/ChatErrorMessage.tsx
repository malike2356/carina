'use client';

import Link from 'next/link';
import type { ChatErrorCode } from '@/lib/chat-errors';

interface ChatErrorMessageProps {
  message: string;
  code?: ChatErrorCode;
}

export function ChatErrorMessage({ message, code }: ChatErrorMessageProps) {
  if (code === 'NO_BYOK_KEYS') {
    return (
      <p className="text-sm text-danger">
        Add at least one provider key before chatting.{' '}
        <Link href="/settings/keys" className="font-medium underline underline-offset-2">
          Go to Settings &gt; Keys
        </Link>
      </p>
    );
  }

  if (code === 'CORE_PROXY_FAILED') {
    return (
      <p className="text-sm text-danger">
        Carina could not reach the agent backend. Check Settings or try again. If you self-host
        core, set <code className="text-xs">CARINA_USE_CORE_PROXY=false</code> on the cloud app
        until ops auth is configured.
      </p>
    );
  }

  return <p className="text-sm text-danger">{message}</p>;
}
