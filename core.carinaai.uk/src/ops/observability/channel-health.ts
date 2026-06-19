import {
  getChannelPolicyFlags,
  getChannelStatusReports,
  type ChannelStatusReport,
} from '../../gateway/channels/channel-status.js';

export type ChannelHealthSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    connected: number;
    configured: number;
    partial: number;
    degraded: number;
    disabled: number;
    unsupported: number;
  };
  channels: ChannelStatusReport[];
  policies: ReturnType<typeof getChannelPolicyFlags>;
};

export function buildChannelHealthSnapshot(): ChannelHealthSnapshot {
  const channels = getChannelStatusReports();
  const summary = {
    total: channels.length,
    connected: 0,
    configured: 0,
    partial: 0,
    degraded: 0,
    disabled: 0,
    unsupported: 0,
  };

  for (const channel of channels) {
    if (channel.state === 'connected') summary.connected += 1;
    if (channel.state === 'configured') summary.configured += 1;
    if (channel.state === 'partial') {
      summary.partial += 1;
      summary.degraded += 1;
    }
    if (channel.state === 'error') summary.degraded += 1;
    if (channel.state === 'disabled') summary.disabled += 1;
    if (channel.state === 'unsupported') summary.unsupported += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    channels,
    policies: getChannelPolicyFlags(),
  };
}
