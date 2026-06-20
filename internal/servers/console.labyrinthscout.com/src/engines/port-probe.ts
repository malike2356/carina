import net from 'node:net';
import type { EngineFinding } from './types.js';

const TOP_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 445, 993, 995, 3306, 3389, 5432, 8080, 8443];

export async function probeTopPorts(host: string, timeoutMs = 2_000): Promise<number[]> {
  const open: number[] = [];
  await Promise.all(
    TOP_PORTS.map(async (port) => {
      const isOpen = await probePort(host, port, timeoutMs);
      if (isOpen) open.push(port);
    }),
  );
  return open.sort((a, b) => a - b);
}

function probePort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    const done = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

export function portFindings(openPorts: number[], target: string): EngineFinding[] {
  return openPorts.map((port) => ({
    tool: 'nmap',
    findingType: 'open_port',
    severity: 'info',
    title: `Open port ${port} on ${target}`,
    description: `TCP port ${port} is reachable on ${target}.`,
    rawData: { port, protocol: 'tcp', host: target },
  }));
}
