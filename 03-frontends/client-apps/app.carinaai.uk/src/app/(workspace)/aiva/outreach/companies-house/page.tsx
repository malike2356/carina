'use client';

import { CompaniesHousePage } from '@/components/companies-house/CompaniesHouseWorkspace';

export default function OutreachCompaniesHousePage() {
  return (
    <div className="w-full max-w-none" style={{ width: '100%', maxWidth: 'none' }}>
      <CompaniesHousePage embedded />
    </div>
  );
}
