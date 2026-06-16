'use client';

import { useTransition } from 'react';
import { removeByokKey } from '@/lib/actions';
import { KeyRow } from '@/components/vault/KeyRow';

export function DeleteKeyButton({
  keyId,
  provider,
  keyHint,
}: {
  keyId: string;
  provider: string;
  keyHint: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <KeyRow
      provider={provider}
      keyHint={keyHint}
      onDelete={() => {
        startTransition(async () => {
          await removeByokKey(keyId);
        });
      }}
      disabled={pending}
    />
  );
}
