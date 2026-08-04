import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const llmChatMock = vi.fn();
const scanMock = vi.fn();
const logSelfModEventMock = vi.fn(async () => undefined);
const registerMock = vi.fn();
const saveMock = vi.fn();
const findByCodeHashMock = vi.fn();
const mkdirMock = vi.fn(async () => undefined);
const writeFileMock = vi.fn(async () => undefined);
const unlinkMock = vi.fn(async () => undefined);
const execFileMock = vi.fn();

const SAMPLE_SOURCE = `export const sampleTool = {
  name: 'sample_tool',
  description: 'A sample extension tool for testing purposes only',
  parameters: {},
  execute: async () => ({ ok: true }),
};
`;

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../brain/llm.js', () => ({
  llm: { chat: (...args: unknown[]) => llmChatMock(...args) },
}));

vi.mock('../sandbox/static-scanner.js', () => ({
  scanGeneratedCode: (...args: unknown[]) => scanMock(...args),
}));

vi.mock('../security/self-mod-logger.js', () => ({
  logSelfModEvent: (...args: unknown[]) => logSelfModEventMock(...args),
}));

vi.mock('../tools/registry.js', () => ({
  registry: {
    register: (...args: unknown[]) => registerMock(...args),
    get: vi.fn(),
  },
}));

vi.mock('../tools/dynamic/tool-store.js', () => ({
  RuntimeToolStore: class {
    save = (...args: unknown[]) => saveMock(...args);
    findByCodeHash = (...args: unknown[]) => findByCodeHashMock(...args);
  },
}));

vi.mock('../tools/dynamic/tool-definition.js', () => ({
  createRuntimeToolDefinition: (record: { name: string }) => ({
    name: record.name,
    description: 'mock',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({}),
  }),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    writeFile: (...args: unknown[]) => writeFileMock(...args),
    unlink: (...args: unknown[]) => unlinkMock(...args),
  },
}));

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

function mockExecSuccess() {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
    cb(null, { stdout: 'ok', stderr: '' });
  });
}

function mockExecFail() {
  execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
    const err = new Error('compile failed') as Error & { stdout: string; stderr: string };
    err.stdout = 'error TS';
    err.stderr = '';
    cb(err);
  });
}

describe('requestExtension', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    llmChatMock.mockReset();
    scanMock.mockReset();
    logSelfModEventMock.mockClear();
    mkdirMock.mockClear();
    writeFileMock.mockClear();
    unlinkMock.mockClear();
    execFileMock.mockReset();
    delete process.env.CARINA_MUTATION_EXTENSIONS;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns error when CARINA_MUTATION_EXTENSIONS is not true', async () => {
    const { requestExtension } = await import('./extension-harness.js');
    const result = await requestExtension({
      task: 'build a tool',
      tenantId: 'tenant-1',
      requestedBy: 'operator',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not enabled');
    expect(llmChatMock).not.toHaveBeenCalled();
  });

  it('returns scopeValid=false when static scan fails', async () => {
    process.env.CARINA_MUTATION_EXTENSIONS = 'true';
    llmChatMock.mockResolvedValueOnce({ content: SAMPLE_SOURCE });
    scanMock.mockReturnValueOnce({ safe: false, blocked: ['import statement'] });

    const { requestExtension } = await import('./extension-harness.js');
    const result = await requestExtension({
      task: 'unsafe tool',
      tenantId: 'tenant-1',
      requestedBy: 'operator',
    });

    expect(result.success).toBe(false);
    expect(result.scopeValid).toBe(false);
    expect(result.error).toContain('Static scan blocked');
  });

  it('returns compilePassed=false and no mutationId when compile fails', async () => {
    process.env.CARINA_MUTATION_EXTENSIONS = 'true';
    llmChatMock.mockResolvedValueOnce({ content: SAMPLE_SOURCE });
    scanMock.mockReturnValueOnce({ safe: true, blocked: [] });
    mockExecFail();

    const { requestExtension } = await import('./extension-harness.js');
    const result = await requestExtension({
      task: 'sample tool',
      tenantId: 'tenant-1',
      requestedBy: 'operator',
      runTests: false,
    });

    expect(result.compilePassed).toBe(false);
    expect(result.mutationId).toBeNull();
    expect(result.error).toBe('TypeScript compile failed');
    expect(unlinkMock).toHaveBeenCalled();
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  it('inserts staged row with correct fields when successful', async () => {
    process.env.CARINA_MUTATION_EXTENSIONS = 'true';
    llmChatMock.mockResolvedValueOnce({ content: SAMPLE_SOURCE });
    scanMock.mockReturnValueOnce({ safe: true, blocked: [] });
    mockExecSuccess();
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    const { requestExtension } = await import('./extension-harness.js');
    const result = await requestExtension({
      task: 'sample tool',
      tenantId: 'tenant-1',
      requestedBy: 'operator',
      runTests: false,
    });

    expect(result.success).toBe(true);
    expect(result.mutationId).toBeTruthy();
    expect(result.compilePassed).toBe(true);
    expect(result.scopeValid).toBe(true);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('INSERT INTO extension_mutations');
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain("'staged'");
  });

  it('calls logSelfModEvent EXTENSION_STAGED on success', async () => {
    process.env.CARINA_MUTATION_EXTENSIONS = 'true';
    llmChatMock.mockResolvedValueOnce({ content: SAMPLE_SOURCE });
    scanMock.mockReturnValueOnce({ safe: true, blocked: [] });
    mockExecSuccess();
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    const { requestExtension } = await import('./extension-harness.js');
    await requestExtension({
      task: 'sample tool',
      tenantId: 'tenant-1',
      requestedBy: 'operator',
      runTests: false,
    });

    expect(logSelfModEventMock).toHaveBeenCalledWith('EXTENSION_STAGED', expect.objectContaining({
      tool_name: 'sample_tool',
      compile_passed: true,
    }));
  });
});

describe('approveExtension', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    saveMock.mockReset();
    findByCodeHashMock.mockReset();
    registerMock.mockClear();
    logSelfModEventMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('throws when mutation is not found or not staged', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { approveExtension } = await import('./extension-harness.js');
    await expect(approveExtension('missing-id', 'operator')).rejects.toThrow('No staged extension mutation');
  });

  it('throws when compile_passed=false', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{
        id: 'mut-1',
        file_path: 'src/tools/dynamic/extensions/sample_tool.ts',
        source_code: SAMPLE_SOURCE,
        compile_passed: false,
        test_passed: false,
      }],
    });
    const { approveExtension } = await import('./extension-harness.js');
    await expect(approveExtension('mut-1', 'operator')).rejects.toThrow('Cannot approve: compile failed');
  });

  it('saves to runtime_tools with status=active', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'mut-1',
          file_path: 'src/tools/dynamic/extensions/sample_tool.ts',
          source_code: SAMPLE_SOURCE,
          compile_passed: true,
          test_passed: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    saveMock.mockResolvedValueOnce('tool-id-1');
    findByCodeHashMock.mockResolvedValueOnce({
      name: 'sample_tool',
      sourceCode: SAMPLE_SOURCE,
      parametersJson: '{}',
      sandboxTimeoutMs: 30000,
      sandboxMemoryMb: 128,
    });

    const { approveExtension } = await import('./extension-harness.js');
    await approveExtension('mut-1', 'operator');

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'sample_tool',
      status: 'active',
      category: 'extension',
    }));
  });

  it('registers tool in live registry', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'mut-1',
          file_path: 'src/tools/dynamic/extensions/sample_tool.ts',
          source_code: SAMPLE_SOURCE,
          compile_passed: true,
          test_passed: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    saveMock.mockResolvedValueOnce('tool-id-1');
    findByCodeHashMock.mockResolvedValueOnce({ name: 'sample_tool' });

    const { approveExtension } = await import('./extension-harness.js');
    await approveExtension('mut-1', 'operator');

    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sample_tool' }),
      { toolset: 'generated' },
    );
  });

  it('sets extension_mutations.status to approved', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'mut-1',
          file_path: 'src/tools/dynamic/extensions/sample_tool.ts',
          source_code: SAMPLE_SOURCE,
          compile_passed: true,
          test_passed: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    saveMock.mockResolvedValueOnce('tool-id-1');
    findByCodeHashMock.mockResolvedValueOnce({ name: 'sample_tool' });

    const { approveExtension } = await import('./extension-harness.js');
    await approveExtension('mut-1', 'operator');

    expect(poolQueryMock.mock.calls[1]?.[0]).toContain("status = 'approved'");
    expect(poolQueryMock.mock.calls[1]?.[1]?.[1]).toBe('tool-id-1');
  });
});

describe('rejectExtension', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    unlinkMock.mockClear();
    logSelfModEventMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('sets status to rejected', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ file_path: 'src/tools/dynamic/extensions/sample_tool.ts' }],
    });

    const { rejectExtension } = await import('./extension-harness.js');
    await rejectExtension('mut-1', 'operator');

    expect(poolQueryMock.mock.calls[0]?.[0]).toContain("status = 'rejected'");
    expect(logSelfModEventMock).toHaveBeenCalledWith('EXTENSION_REJECTED', expect.any(Object));
  });

  it('deletes the file from disk', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ file_path: 'src/tools/dynamic/extensions/sample_tool.ts' }],
    });

    const { rejectExtension } = await import('./extension-harness.js');
    await rejectExtension('mut-1', 'operator');

    expect(unlinkMock).toHaveBeenCalled();
  });
});
