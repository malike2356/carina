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
    process.env.OPS_DOCKER_PROJECTS = 'corecarinaaiuk,scout';
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
    delete process.env.OPS_DOCKER_PROJECTS;
  });

  it('scopes ops to a single white-label stack when configured', async () => {
    process.env.CARINA_WHITE_LABEL_STACK = 'acme-agents';
    delete process.env.OPS_DOCKER_PROJECTS;
    delete process.env.CARINA_DOCKER_PROJECTS;

    const { getDockerScopeInfo } = await import('./server-services.js');
    expect(getDockerScopeInfo()).toEqual({
      allowedProjects: ['acme-agents'],
      whiteLabelStack: 'acme-agents',
      source: 'white-label',
    });

    execFileMock.mockImplementationOnce((_cmd, _args, cb) => {
      cb(null, {
        stdout: [
          '{"ID":"1","Names":"/acme-agents-carina-web-1","Image":"acme-web","State":"running","Status":"Up","Project":"acme-agents"}',
          '{"ID":"2","Names":"/corecarinaaiuk-carina-web-1","Image":"core-web","State":"running","Status":"Up","Project":"corecarinaaiuk"}',
        ].join('\n'),
        stderr: '',
      });
    });

    const { getDockerContainers } = await import('./server-services.js');
    const containers = await getDockerContainers();
    expect(containers.map((svc) => svc.name)).toEqual(['acme-agents-carina-web-1']);

    delete process.env.CARINA_WHITE_LABEL_STACK;
  });

  it('prefers explicit OPS_DOCKER_PROJECTS over white-label stack env', async () => {
    process.env.OPS_DOCKER_PROJECTS = 'scoped-only';
    process.env.CARINA_WHITE_LABEL_STACK = 'acme-agents';

    const { getDockerScopeInfo } = await import('./server-services.js');
    expect(getDockerScopeInfo()).toEqual({
      allowedProjects: ['scoped-only'],
      source: 'explicit',
    });

    delete process.env.OPS_DOCKER_PROJECTS;
    delete process.env.CARINA_WHITE_LABEL_STACK;
  });

  it('hides containers whose project and name are outside the allowlist', async () => {
    const { isAllowedDockerContainer } = await import('./server-services.js');
    expect(isAllowedDockerContainer('acme-agents-carina-web-1', 'acme-agents', ['acme-agents'])).toBe(true);
    expect(isAllowedDockerContainer('corecarinaaiuk-carina-web-1', 'corecarinaaiuk', ['acme-agents'])).toBe(false);
    expect(isAllowedDockerContainer('other-stack-web-1', 'other-stack', ['acme-agents'])).toBe(false);
  });
});
