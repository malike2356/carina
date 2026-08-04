import { describe, expect, it } from 'vitest';
import { AIVA_HIRE_ACTION, AIVA_HOME_ACTION, AIVA_PRIMARY_NAV } from '@/lib/aiva-nav';

describe('Aiva primary navigation', () => {
  it('orders destinations around daily user workflows', () => {
    expect(AIVA_PRIMARY_NAV.map((item) => item.label)).toEqual([
      'AI Workers',
      'Approvals',
      'Projects',
      'Outreach',
      'Email',
      'Calendar',
      'Bookings',
      'Notes',
      'Documents',
      'Contacts',
      'Research',
      'Analytics',
      'Tools',
      'More',
      'Settings',
    ]);
  });

  it('keeps Companies House out of the primary sidebar', () => {
    expect(AIVA_PRIMARY_NAV.find((item) => item.label === 'Companies House')).toBeUndefined();
  });

  it('routes Contacts to the directory and still highlights settings import', () => {
    const contacts = AIVA_PRIMARY_NAV.find((item) => item.label === 'Contacts');
    expect(contacts?.href).toBe('/contacts');
    expect(contacts?.match('/contacts')).toBe(true);
    expect(contacts?.match('/settings/contacts')).toBe(true);
    expect(contacts?.match('/settings')).toBe(false);
    const more = AIVA_PRIMARY_NAV.find((item) => item.label === 'More');
    expect(more?.match('/settings/contacts')).toBe(false);
  });

  it('keeps Lab under More instead of the primary sidebar', () => {
    expect(AIVA_PRIMARY_NAV.find((item) => item.label === 'Lab')).toBeUndefined();
    const more = AIVA_PRIMARY_NAV.find((item) => item.label === 'More');
    expect(more?.match('/aiva/lab')).toBe(true);
    expect(more?.match('/aiva/lab/playground')).toBe(true);
    expect(more?.match('/aiva/workers')).toBe(false);
  });

  it('puts Home as the sidebar primary action instead of Hire', () => {
    expect(AIVA_HOME_ACTION.label).toBe('Home');
    expect(AIVA_HOME_ACTION.href).toBe('/aiva');
    expect(AIVA_HOME_ACTION.match('/aiva')).toBe(true);
    expect(AIVA_HOME_ACTION.match('/aiva/workers')).toBe(false);
    expect(AIVA_PRIMARY_NAV).not.toContain(AIVA_HOME_ACTION);
  });

  it('keeps hiring as a secondary action for setup', () => {
    expect(AIVA_HIRE_ACTION.label).toBe('Hire AI Worker');
    expect(AIVA_HIRE_ACTION.href).toBe('/aiva/hire');
    expect(AIVA_PRIMARY_NAV).not.toContain(AIVA_HIRE_ACTION);
  });

  it('treats schedules as part of Calendar', () => {
    const calendar = AIVA_PRIMARY_NAV.find((item) => item.label === 'Calendar');

    expect(calendar?.match('/calendar')).toBe(true);
    expect(calendar?.match('/tasks')).toBe(true);
    expect(calendar?.match('/scheduled')).toBe(true);
  });

  it('routes Outreach to the Aiva Outreach Program', () => {
    const outreach = AIVA_PRIMARY_NAV.find((item) => item.label === 'Outreach');
    expect(outreach?.href).toBe('/aiva/outreach');
    expect(outreach?.match('/aiva/outreach')).toBe(true);
    expect(outreach?.match('/aiva/outreach/companies-house')).toBe(true);
    expect(outreach?.match('/outreach')).toBe(true);
    expect(outreach?.match('/companies-house')).toBe(true);
  });
});
