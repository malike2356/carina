import { CyberToolsCheatsheet } from '@/components/security/CyberToolsCheatsheet';

export const dynamic = 'force-dynamic';

export default function SecurityToolsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <CyberToolsCheatsheet />
    </div>
  );
}
