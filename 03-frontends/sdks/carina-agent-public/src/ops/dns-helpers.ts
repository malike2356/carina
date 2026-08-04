import { exec } from 'child_process';
import dns from 'dns/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type DnsLookupResult = {
  hostname: string;
  addresses: string[];
  cname?: string[];
  txt?: string[];
  error?: string;
};

export async function lookupHostname(hostname: string): Promise<DnsLookupResult> {
  const result: DnsLookupResult = { hostname, addresses: [] };
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    result.addresses = [...v4, ...v6];
    result.cname = await dns.resolveCname(hostname).catch(() => undefined);
    const txtRows = await dns.resolveTxt(hostname).catch(() => [] as string[][]);
    if (txtRows.length > 0) {
      result.txt = txtRows.map((row) => row.join(''));
    }
    if (result.addresses.length === 0) {
      const looked = await dns.lookup(hostname, { all: true }).catch(() => [] as Array<{ address: string; family: number }>);
      result.addresses = looked.map((row) => row.address);
    }
    if (result.addresses.length === 0 && !result.cname?.length) {
      result.error = 'No DNS records found';
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

export type TailscalePeer = {
  hostname: string;
  dnsName: string;
  ips: string[];
  online: boolean;
  os?: string;
};

export type TailscaleStatus = {
  available: boolean;
  self?: { hostname: string; dnsName: string; ips: string[] };
  peers: TailscalePeer[];
  magicDnsSuffix?: string;
  error?: string;
};

export async function tailscaleStatus(): Promise<TailscaleStatus> {
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 8000 });
    const data = JSON.parse(stdout) as {
      Self?: { HostName?: string; DNSName?: string; TailscaleIPs?: string[] };
      Peer?: Record<string, {
        HostName?: string;
        DNSName?: string;
        TailscaleIPs?: string[];
        Online?: boolean;
        OS?: string;
      }>;
      MagicDNSSuffix?: string;
    };
    const peers: TailscalePeer[] = [];
    for (const peer of Object.values(data.Peer ?? {})) {
      peers.push({
        hostname: peer.HostName ?? '',
        dnsName: peer.DNSName ?? '',
        ips: peer.TailscaleIPs ?? [],
        online: Boolean(peer.Online),
        os: peer.OS,
      });
    }
    return {
      available: true,
      self: data.Self
        ? {
            hostname: data.Self.HostName ?? '',
            dnsName: data.Self.DNSName ?? '',
            ips: data.Self.TailscaleIPs ?? [],
          }
        : undefined,
      peers,
      magicDnsSuffix: data.MagicDNSSuffix,
    };
  } catch (err) {
    return {
      available: false,
      peers: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function suggestMagicDnsHostname(shortName: string, suffix?: string): string {
  const base = shortName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  if (suffix) return `${base}.${suffix}`;
  return `${base}.ts.net`;
}

export async function resolveTailscaleHost(hostname: string): Promise<DnsLookupResult> {
  const status = await tailscaleStatus();
  if (!status.available) {
    return { hostname, addresses: [], error: status.error ?? 'Tailscale CLI not available' };
  }
  const peer = status.peers.find(
    (p) => p.hostname === hostname || p.dnsName === hostname || p.dnsName.startsWith(`${hostname}.`),
  );
  if (peer) {
    return { hostname, addresses: peer.ips };
  }
  if (status.self && (status.self.hostname === hostname || status.self.dnsName.includes(hostname))) {
    return { hostname, addresses: status.self.ips };
  }
  const magic = status.magicDnsSuffix
    ? suggestMagicDnsHostname(hostname, status.magicDnsSuffix)
    : hostname;
  return lookupHostname(magic);
}
