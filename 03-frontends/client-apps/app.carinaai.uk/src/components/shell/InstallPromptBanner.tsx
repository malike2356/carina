'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'carina-pwa-install-dismissed';

export function InstallPromptBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setHidden(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        return;
      }
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
    setEvent(null);
  }

  if (!event || hidden) return null;
  const installEvent = event;

  async function install() {
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setEvent(null);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xl">
      <div className="mb-3 flex items-start gap-3">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Install Carina</p>
          <p className="text-xs text-text-secondary">
            Add the workspace to your device for faster access and offline loading.
          </p>
        </div>
        <IconButton label="Dismiss" size="sm" onClick={dismiss}>
          <X className="h-3 w-3" />
        </IconButton>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void install()} size="sm">
          Install
        </Button>
        <Button variant="outline" size="sm" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
