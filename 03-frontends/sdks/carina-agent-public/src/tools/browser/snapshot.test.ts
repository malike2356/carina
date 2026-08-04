import { describe, expect, it } from 'vitest';
import { buildSnapshotFromTree } from './snapshot.js';

describe('buildSnapshotFromTree', () => {
  it('assigns sequential ref IDs to interactive elements', () => {
    const tree = {
      role: 'WebArea',
      children: [
        { role: 'button', name: 'Submit' },
        { role: 'textbox', name: 'Email' },
        { role: 'link', name: 'Home' },
      ],
    };
    const snap = buildSnapshotFromTree(tree, 'full page text');
    expect(snap.elements).toHaveLength(3);
    expect(snap.elements[0].ref).toBe('@e1');
    expect(snap.elements[2].ref).toBe('@e3');
    expect(snap.compact).toContain('@e1');
    expect(snap.compact).toContain('Submit');
  });

  it('truncates snapshots over 8000 characters', () => {
    const long = 'x'.repeat(9000);
    const snap = buildSnapshotFromTree(null, long);
    expect(snap.full.length).toBeLessThanOrEqual(8020);
    expect(snap.full).toContain('[truncated]');
  });
});
