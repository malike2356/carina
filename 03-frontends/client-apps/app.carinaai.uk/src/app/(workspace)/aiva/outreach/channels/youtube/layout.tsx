import type { ReactNode } from 'react';
import { YouTubeChannelTabNav } from '@/components/youtube-channel/YouTubeChannelTabNav';

export default function YouTubeChannelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 pt-5 pb-0">
        <h1 className="text-base font-semibold text-text-primary">YouTube Channel</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Outreach content channel. Scripts and scheduling exist; YouTube publish needs a completed MP4. Part of the Outreach Program.
        </p>
        <p className="mt-1 text-xs">
          <a href="/aiva/outreach" className="text-accent underline">Back to Outreach Program</a>
        </p>
        <YouTubeChannelTabNav />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
