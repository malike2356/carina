import { GovernanceSidebarCard } from '@/components/aiva/GovernanceSidebarCard';

export default function AivaGovernancePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Governance</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Scout governance is included with every Aiva subscription. All AI Employees are monitored automatically.
        </p>
      </div>
      <GovernanceSidebarCard />
      <p className="text-sm text-text-secondary">
        Configure custom thresholds under Settings, or open the Scout dashboard to review audit events and kill switches.
      </p>
    </div>
  );
}
