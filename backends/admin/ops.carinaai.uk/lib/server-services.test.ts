import { describe, expect, it, vi, beforeEach } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

describe('server-services', () => {
  beforeEach(() => {
    vi.resetModules();
    execFileMock.mockReset();
    execFileMock.mockImplementation((_cmd, _args, cb) => {
      cb(null, {
        stdout: '',
        stderr: '',
      });
    });
  });

  it('rejects systemd services outside the allowlist', async () => {
    const { restartSystemd } = await import('./server-services.js');
    await expect(restartSystemd('nginx')).rejects.toThrow(/allowlist/i);
  });

  it('filters docker containers to the scoped project list', async () => {
    execFileMock.mockImplementationOnce((_cmd, _args, cb) => {
      cb(null, {
        stdout: [
          '{"ID":"1","Names":"/corecarinaaiuk-carina-web-1","Image":"corecarinaaiuk-carina-web","State":"running","Status":"Up","Project":"corecarinaaiuk"}',
          '{"ID":"2","Names":"/propreneur-fpm","Image":"propreneur-v2:latest","State":"running","Status":"Up","Project":"propreneur"}',
          '{"ID":"3","Names":"/tuinapp_app","Image":"tuinapp-web:latest","State":"running","Status":"Up","Project":"tuinapp"}',
          '{"ID":"4","Names":"/scout-console","Image":"consolelabyrinthscoutcom-labyrinth-scout","State":"running","Status":"Up","Project":"scout"}',
        ].join('\n'),
        stderr: '',
      });
    });

    const { getDockerContainers } = await import('./server-services.js');
    const containers = await getDockerContainers();

    expect(containers.map((svc) => svc.name)).toEqual([
      'corecarinaaiuk-carina-web-1',
      'scout-console',
    ]);
  });
});
