import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBridgeEnabled = vi.fn(() => false);
const mockWritesEnabled = vi.fn(() => false);
const mockResolveBinding = vi.fn(() => null as { tenantSlug: string; apiKey: string } | null);
const mockGetSession = vi.fn(() => undefined as import('../types/index.js').WorkerContext | undefined);

vi.mock('../workers/aiva-feature-flags.js', () => ({
  isPropreneurBridgeEnabled: () => mockBridgeEnabled(),
  isPropreneurBridgeWritesEnabled: () => mockWritesEnabled(),
}));

vi.mock('../workers/worker-bridge-store.js', () => ({
  resolvePropreneurBinding: (...args: unknown[]) => mockResolveBinding(...args),
}));

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: (...args: unknown[]) => mockGetSession(...args),
  setWorkerSessionContext: vi.fn(),
  clearWorkerSessionContext: vi.fn(),
  applyWorkerSkillPacks: vi.fn(() => () => {}),
}));

vi.mock('../skills/index.js', () => ({
  isSkillAllowedForActivePacks: () => true,
}));

vi.mock('./scout-fleet.js', () => ({
  getAgentDirective: async () => ({ paused: false }),
  reportAivaEvent: async () => {},
}));

vi.mock('./worker-store.js', () => ({
  countActivityInWindow: async () => 0,
  countEscalationsInWindow: async () => 0,
  createEscalation: async () => {},
  getWorkerByChannel: async () => null,
  logActivity: async () => {},
}));

describe('aiva-message-handler Propreneur bridge tools', () => {
  const sessionId = 'test-bridge-session';
  const workerContext = {
    worker: {
      id: 'worker-bridge-1',
      skillPacks: ['property-uk'],
    },
    personaPrompt: 'Test persona',
  } as import('../types/index.js').WorkerContext;

  beforeEach(() => {
    mockBridgeEnabled.mockReturnValue(false);
    mockWritesEnabled.mockReturnValue(false);
    mockResolveBinding.mockReturnValue(null);
    mockGetSession.mockImplementation((id: string) => (id === sessionId ? workerContext : undefined));
  });

  it('blocks propreneur-get-* tools when bridge flag is off', async () => {
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('propreneur-get-portfolio', sessionId)).toBe(false);
    expect(isToolAllowedForWorker('propreneur-get-deals', sessionId)).toBe(false);
  });

  it('blocks propreneur tools when flag on but worker is not bound', async () => {
    mockBridgeEnabled.mockReturnValue(true);
    mockResolveBinding.mockReturnValue(null);
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('propreneur-get-portfolio', sessionId)).toBe(false);
  });

  it('allows propreneur read tools when flag on and worker has binding', async () => {
    mockBridgeEnabled.mockReturnValue(true);
    mockResolveBinding.mockReturnValue({ tenantSlug: 'xelox', apiKey: 'bridge-key' });
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('propreneur-get-portfolio', sessionId)).toBe(true);
    expect(isToolAllowedForWorker('propreneur-get-email-activity', sessionId)).toBe(true);
  });

  it('blocks write tools when PROPREENEUR_BRIDGE_WRITES is off', async () => {
    mockBridgeEnabled.mockReturnValue(true);
    mockWritesEnabled.mockReturnValue(false);
    mockResolveBinding.mockReturnValue({ tenantSlug: 'xelox', apiKey: 'bridge-key' });
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('propreneur-propose-deal', sessionId)).toBe(false);
  });

  it('allows write tools when bridge and writes flags on and worker bound', async () => {
    mockBridgeEnabled.mockReturnValue(true);
    mockWritesEnabled.mockReturnValue(true);
    mockResolveBinding.mockReturnValue({ tenantSlug: 'xelox', apiKey: 'bridge-key' });
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('propreneur-propose-deal', sessionId)).toBe(true);
  });

  it('allows non-bridge tools for property-uk workers', async () => {
    const { isToolAllowedForWorker } = await import('./aiva-message-handler.js');
    expect(isToolAllowedForWorker('remember', sessionId)).toBe(true);
  });
});

describe('propreneur write tools', () => {
  it('createPropreneurWriteTools sets requiresConfirmation', async () => {
    const { createPropreneurWriteTools } = await import('../tools/propreneur-portfolio.js');
    const tools = createPropreneurWriteTools('session-1');
    expect(tools.every((t) => t.requiresConfirmation === true)).toBe(true);
    expect(tools.map((t) => t.name)).toEqual([
      'propreneur-propose-deal',
      'propreneur-propose-compliance-update',
      'propreneur-propose-financial-log',
    ]);
  });
});
