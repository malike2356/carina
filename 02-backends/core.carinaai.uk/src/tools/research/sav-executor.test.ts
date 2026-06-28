import { describe, expect, it } from 'vitest';
import {
  formatDataPreviewTable,
  formatSavReadMarkdown,
  formatSpvReadMarkdown,
} from './sav-executor.js';

describe('formatSavReadMarkdown', () => {
  it('renders variable metadata and preview table', () => {
    const markdown = formatSavReadMarkdown({
      file: '/data/sample.sav',
      rows: 100,
      columns: 2,
      variables: [
        {
          name: 'gender',
          type: 'int64',
          label: 'Gender',
          measure: 'nominal',
          missing_count: 1,
          value_labels: { '1': 'Male', '2': 'Female' },
        },
        { name: 'age', type: 'float64', label: 'Age', measure: 'scale' },
      ],
      data: [{ gender: 1, age: 25.3 }],
      data_row_count: 1,
    });

    expect(markdown).toContain('## /data/sample.sav');
    expect(markdown).toContain('**gender**');
    expect(markdown).toContain('Values: 1=Male, 2=Female');
    expect(markdown).toContain('| gender | age |');
  });
});

describe('formatDataPreviewTable', () => {
  it('returns placeholder when no rows exist', () => {
    expect(formatDataPreviewTable([], [])).toBe('_No data rows._');
  });
});

describe('formatSpvReadMarkdown', () => {
  it('renders tables and text blocks', () => {
    const markdown = formatSpvReadMarkdown({
      file: '/data/output.spv',
      tables: [{ title: 'Descriptives', rows: [['age', '25.3']] }],
      text: ['Analysis completed'],
    });

    expect(markdown).toContain('#### Descriptives');
    expect(markdown).toContain('Analysis completed');
  });
});
