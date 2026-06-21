import { describe, expect, it } from 'vitest';
import { getTrajectoryRecorder, truncateTrajectoryResult } from './trajectory-recorder.js';

describe('trajectory-recorder', () => {
  it('truncates long tool results', () => {
    const long = 'x'.repeat(3000);
    const { value, truncated } = truncateTrajectoryResult(long);
    expect(truncated).toBe(true);
    expect(String(value).length).toBeLessThanOrEqual(2000);
  });

  it('records steps and completes bundles', () => {
    const recorder = getTrajectoryRecorder();
    const bundle = recorder.startBundle('sess-traj', 'test-model');
    recorder.recordStep('sess-traj', {
      type: 'tool_call',
      toolName: 'read_file',
      toolParams: { path: '/tmp/x' },
    });
    recorder.recordStep('sess-traj', {
      type: 'tool_result',
      toolName: 'read_file',
      result: 'ok',
      durationMs: 12,
    });
    const completed = recorder.completeBundle('sess-traj');
    expect(completed?.bundleId).toBe(bundle.bundleId);
    expect(completed?.metadata.totalToolCalls).toBe(1);
    expect(recorder.exportBundle(bundle.bundleId)).toContain('read_file');
  });
});
