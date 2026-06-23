/** Maps Carina compliance control IDs to Scout SOC2 TSC control IDs. */
export const CARINA_TO_SCOUT_CONTROLS: Record<string, string[]> = {
  'soc2-cc6.1': ['CC6.1', 'CC6.2', 'CC6.3'],
  'soc2-cc6.6': ['CC6.4', 'CC6.6'],
  'soc2-cc6.7': ['CC6.5', 'CC6.7'],
  'soc2-cc7.1': ['CC7.5', 'CC8.1'],
  'soc2-cc7.2': ['CC7.1', 'CC7.2', 'CC4.1'],
  'soc2-cc8.1': ['CC6.8', 'CC8.1'],
  'soc2-cc9.1': ['CC5.1', 'CC3.1', 'CC5.2'],
  'iso-a.5.1': ['CC1.1', 'CC2.1', 'CC5.3'],
  'iso-a.9.2': ['CC6.1', 'CC6.3'],
  'iso-a.12.4': ['CC7.1', 'CC4.1'],
  'iso-a.12.6.1': ['CC6.8'],
  'iso-a.14.2': ['CC7.5', 'CC8.1'],
  'iso-a.8.9': ['CC5.2', 'CC3.4'],
  'iso-a.10.1': ['CC6.4'],
  'iso-a.16.1': ['CC7.2'],
  'gdpr-art6': ['CC1.4', 'CC2.3'],
  'gdpr-art17': ['CC6.5'],
  'gdpr-art25': ['CC5.1'],
  'gdpr-art30': ['CC2.3', 'CC3.1'],
  'gdpr-art32': ['CC6.4', 'CC6.6'],
  'gdpr-art33': ['CC7.2', 'CC4.2'],
};

export function scoutControlsForCarinaId(carinaControlId: string): string[] {
  return CARINA_TO_SCOUT_CONTROLS[carinaControlId] ?? [];
}
