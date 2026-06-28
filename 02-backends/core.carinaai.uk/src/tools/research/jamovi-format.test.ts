import { describe, expect, it } from 'vitest';
import { formatJamoviAsApa } from './jamovi-format.js';

describe('formatJamoviAsApa', () => {
  it('renders APA markdown from Jamovi tables', () => {
    const markdown = formatJamoviAsApa(
      {
        success: true,
        analysisType: 'descriptive',
        tables: [
          {
            title: 'Descriptives',
            header: ['Variable', 'Mean', 'SD'],
            rows: [['age', '25.3', '4.1']],
          },
        ],
        jamovi: { running: true, url: 'http://127.0.0.1:41337', datasetCount: 1 },
      },
      {
        dataFile: '/data/sample.sav',
        analysisType: 'descriptive',
        variables: ['age'],
      },
    );

    expect(markdown).toContain('# Statistical Analysis Results (Jamovi / jmv)');
    expect(markdown).toContain('| Variable | Mean | SD |');
    expect(markdown).toContain('Jamovi session');
  });
});
