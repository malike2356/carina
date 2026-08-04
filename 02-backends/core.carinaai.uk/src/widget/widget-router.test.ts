import { describe, expect, it } from 'vitest';
import { isPublicHostedPath } from '../gateway/web-auth.js';

describe('widget public paths', () => {
  it('allows widget.js and widget API without auth', () => {
    expect(isPublicHostedPath('/widget.js')).toBe(true);
    expect(isPublicHostedPath('/api/widget/00000000-0000-4000-8000-000000000001/config')).toBe(true);
  });
});
