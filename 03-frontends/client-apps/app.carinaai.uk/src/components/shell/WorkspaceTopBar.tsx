'use client';

import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { ThemeSwitcher } from '@/components/shell/ThemeSwitcher';
import { WorkspaceAccountMenu } from '@/components/shell/WorkspaceAccountMenu';

type WorkspaceTopBarProps = {
  userEmail: string;
  userName: string;
};

export function WorkspaceTopBar({ userEmail, userName }: WorkspaceTopBarProps) {
  return (
    <header className="relative z-[80] hidden min-h-14 items-center border-b border-border bg-surface/95 px-12 backdrop-blur lg:flex xl:px-16">
      <div className="min-w-0 flex-1">
        <Breadcrumb embedded />
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-2">
        <ThemeSwitcher showLabel={false} syncApi />
        <WorkspaceAccountMenu userEmail={userEmail} userName={userName} />
      </div>
    </header>
  );
}
