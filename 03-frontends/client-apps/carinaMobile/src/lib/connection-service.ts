import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type ConnectionState = 'connected' | 'disconnected' | 'closing' | 'connecting';

export interface ConnectionStateEvent {
  state: ConnectionState;
  url?: string;
  error?: string;
  code?: number;
  reason?: string;
}

export interface MessageReceivedEvent {
  raw: string;
}

export interface AgentEvent {
  event: string;
  data: unknown;
}

type NativeConnectionModule = {
  startService?: (wsUrl: string) => Promise<void>;
  stopService?: () => Promise<void>;
  startConnection?: (wsUrl: string) => Promise<void>;
  stopConnection?: () => Promise<void>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const NativeModule: NativeConnectionModule | undefined =
  Platform.OS === 'android'
    ? NativeModules.CarinaConnectionService
    : NativeModules.CarinaBackgroundConnection;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

const agentEventHandlers = new Set<(event: AgentEvent) => void>();

function parseEventPayload<T>(raw: unknown): T {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as T;
  }
  return raw as T;
}

export function isBackgroundConnectionAvailable(): boolean {
  return Boolean(NativeModule);
}

export function registerAgentEventHandler(handler: (event: AgentEvent) => void): () => void {
  agentEventHandlers.add(handler);
  return () => {
    agentEventHandlers.delete(handler);
  };
}

export const ConnectionService = {
  async start(wsUrl: string): Promise<void> {
    if (!NativeModule) {
      console.warn('[ConnectionService] Native module not available (Expo Go or web)');
      return;
    }

    if (Platform.OS === 'android' && NativeModule.startService) {
      await NativeModule.startService(wsUrl);
      return;
    }

    if (NativeModule.startConnection) {
      await NativeModule.startConnection(wsUrl);
    }
  },

  async stop(): Promise<void> {
    if (!NativeModule) return;

    if (Platform.OS === 'android' && NativeModule.stopService) {
      await NativeModule.stopService();
      return;
    }

    if (NativeModule.stopConnection) {
      await NativeModule.stopConnection();
    }
  },

  onConnectionStateChange(
    handler: (event: ConnectionStateEvent) => void,
  ): EmitterSubscription | null {
    return (
      emitter?.addListener('connection_state_change', (raw: unknown) => {
        handler(parseEventPayload<ConnectionStateEvent>(raw));
      }) ?? null
    );
  },

  onMessageReceived(
    handler: (event: MessageReceivedEvent) => void,
  ): EmitterSubscription | null {
    return (
      emitter?.addListener('message_received', (raw: unknown) => {
        handler(parseEventPayload<MessageReceivedEvent>(raw));
      }) ?? null
    );
  },

  onAgentEvent(handler: (event: AgentEvent) => void): EmitterSubscription | null {
    return (
      emitter?.addListener('agent_event', (raw: unknown) => {
        const event = parseEventPayload<AgentEvent>(raw);
        handler(event);
        for (const registered of agentEventHandlers) {
          registered(event);
        }
      }) ?? null
    );
  },
};
