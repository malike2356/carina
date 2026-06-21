import type { ChannelName } from './channels/channel-adapter.interface.js';
import { bindSessionDelivery, getSessionDelivery } from '../agents/cron-delivery-registry.js';
import { channelRegistry } from './channels/channel-registry.js';
import { getIdentityResolver } from './identity-resolver.js';
import {
  getSessionIdentityState,
  updateSessionDocking,
} from './session-identity-prefs.js';

export type DockResult =
  | { success: true; dockedTo: string; dockedFrom: string }
  | { success: false; error: string };

export class ChannelDocking {
  async dock(
    sessionId: string,
    canonicalUserId: string,
    targetChannel: ChannelName,
  ): Promise<DockResult> {
    const targetIdentity = await getIdentityResolver().resolveToChannel(
      canonicalUserId,
      targetChannel,
    );
    if (!targetIdentity) {
      return {
        success: false,
        error: `No linked identity on ${targetChannel}. Use /link first.`,
      };
    }

    const state = getSessionIdentityState(sessionId);
    if (!state) {
      return { success: false, error: 'Session identity not found.' };
    }

    const oldChannel = state.replyChannel;
    const oldDelivery = getSessionDelivery(sessionId);

    updateSessionDocking(sessionId, {
      dockedFrom: oldChannel,
      dockedAt: Date.now(),
      replyChannel: targetChannel,
      replyConversationId: targetIdentity.channelUserId,
      replyThreadId: oldDelivery?.threadId,
    });

    bindSessionDelivery(sessionId, {
      channel: targetChannel,
      conversationId: targetIdentity.channelUserId,
      threadId: oldDelivery?.threadId,
    });

    await this.sendDockNotice(sessionId, oldChannel, targetChannel, 'moved');

    return {
      success: true,
      dockedTo: targetChannel,
      dockedFrom: oldChannel,
    };
  }

  async undock(sessionId: string): Promise<DockResult> {
    const state = getSessionIdentityState(sessionId);
    if (!state?.dockedFrom) {
      return { success: false, error: 'Session is not docked.' };
    }

    const original = state.dockedFrom as ChannelName;
    const identity = await getIdentityResolver().resolveToChannel(
      state.canonicalUserId,
      original,
    );
    if (!identity) {
      return { success: false, error: `No linked identity on ${original}.` };
    }

    const current = state.replyChannel;
    updateSessionDocking(sessionId, {
      replyChannel: original,
      replyConversationId: identity.channelUserId,
      dockedFrom: undefined,
      dockedAt: undefined,
    });

    bindSessionDelivery(sessionId, {
      channel: original,
      conversationId: identity.channelUserId,
      threadId: state.replyThreadId,
    });

    await this.sendDockNotice(sessionId, current, original, 'returned');

    return {
      success: true,
      dockedTo: original,
      dockedFrom: current,
    };
  }

  listDockableChannels(canonicalUserId: string, currentChannel: string): Promise<string[]> {
    return getIdentityResolver()
      .getIdentities(canonicalUserId)
      .then((rows) => rows
        .map((row) => row.channel)
        .filter((channel) => channel !== currentChannel));
  }

  private async sendDockNotice(
    sessionId: string,
    fromChannel: string,
    toChannel: string,
    kind: 'moved' | 'returned',
  ): Promise<void> {
    const text = kind === 'moved'
      ? `[Dock] Reply stream moved from ${fromChannel} to ${toChannel}.`
      : `[Dock] Reply stream returned to ${toChannel}.`;

    for (const channel of [fromChannel, toChannel] as ChannelName[]) {
      const adapter = channelRegistry.getByName(channel);
      const delivery = getSessionDelivery(sessionId);
      if (!adapter || !delivery) continue;
      try {
        await adapter.sendMessage(delivery.conversationId, text, {
          threadId: delivery.threadId,
        });
      } catch {
        // best-effort announcement
      }
    }
  }
}

let docking: ChannelDocking | null = null;

export function getChannelDocking(): ChannelDocking {
  docking ??= new ChannelDocking();
  return docking;
}
