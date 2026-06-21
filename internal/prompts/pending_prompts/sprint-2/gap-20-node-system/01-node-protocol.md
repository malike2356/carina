# Gap 20 - Prompt 01: Node WebSocket Protocol & Capability Advertisement

**Gap:** 20 Node System & Device Architecture
**Prompt number:** 01 of 04
**Name:** Node WebSocket protocol, capability advertisement, command dispatch
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing (extends existing `infrastructure/node-host/`)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `infrastructure/node-host/ws-server.ts` -- existing node WS server
2. `infrastructure/node-host/ws-transport.ts` -- WS transport layer
3. `infrastructure/device-pairing.ts` -- device auth
4. OpenClaw `src/nodes/` (reference) -- node protocol design

---

## Goal

Replace the basic node WebSocket with a full node protocol.

### Step 1: Node Protocol Types

Extend `infrastructure/node-host/`:

```typescript
// types.ts
export enum NodeCapability {
  CANVAS = 'canvas',
  CANVAS_RENDER = 'canvas.render',
  CAMERA_CAPTURE = 'camera.capture',
  CAMERA_STREAM = 'camera.stream',
  SCREEN_RECORD = 'screen.record',
  LOCATION_GET = 'location.get',
  LOCATION_WATCH = 'location.watch',
  VOICE_WAKE = 'voice.wake',
  TALK_MODE = 'talk.mode',
  NOTIFICATIONS = 'notifications',
  FILE_SYSTEM = 'filesystem',
}

export interface NodeHello {
  type: 'hello';
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'macos' | 'linux' | 'windows' | 'headless';
  capabilities: NodeCapability[];
  auth: {
    token: string; // pairing token (cdv_...)
    nonce?: string; // challenge nonce (see prompt 04)
    signature?: string; // nonce signature
  };
  version: string; // node client version
}

export interface NodeCommand {
  id: string;
  capability: NodeCapability;
  method: string; // e.g., 'capture', 'startRecording', 'getPosition'
  params: Record<string, unknown>;
  timeout?: number;
}

export interface NodeResponse {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}
```

### Step 2: Enhanced Node Server

Rewrite `infrastructure/node-host/ws-server.ts`:

```typescript
export class NodeHostServer {
  private nodes: Map<string, NodeConnection> = new Map();
  private wss: WebSocketServer;

  constructor(port = parseInt(process.env.CARINA_NODE_PORT || '4003')) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    // 1. Wait for hello message (5s timeout)
    const hello = await this.receiveHello(ws);
    if (!hello) {
      ws.close(4001, 'No hello received');
      return;
    }

    // 2. Verify device auth
    const device = await this.verifyDevice(hello.auth.token);
    if (!device) {
      ws.close(4002, 'Device not paired');
      return;
    }

    // 3. Register node
    const conn: NodeConnection = {
      ws,
      deviceId: hello.deviceId,
      deviceName: hello.deviceName,
      platform: hello.platform,
      capabilities: hello.capabilities,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      pendingCommands: new Map(),
    };
    this.nodes.set(hello.deviceId, conn);

    // 4. Advertise capabilities to gateway
    this.emitNodeConnected(hello.deviceId, hello.capabilities);

    // 5. Handle commands + heartbeat
    ws.on('message', (data) => this.handleMessage(conn, data));
    ws.on('close', () => this.handleDisconnect(hello.deviceId));

    // 6. Start heartbeat
    this.startHeartbeat(conn);
  }

  /**
   * Send a command to a node and await response.
   */
  async sendCommand(
    deviceId: string,
    capability: NodeCapability,
    method: string,
    params: Record<string, unknown>,
    timeout = 30000,
  ): Promise<NodeResponse> {
    const conn = this.nodes.get(deviceId);
    if (!conn) throw new Error(`Node ${deviceId} not connected`);

    const id = randomUUID();
    const command: NodeCommand = { id, capability, method, params, timeout };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pendingCommands.delete(id);
        reject(new Error(`Command ${id} timed out after ${timeout}ms`));
      }, timeout);

      conn.pendingCommands.set(id, { resolve, reject, timer });
      conn.ws.send(JSON.stringify({ type: 'command', ...command }));
    });
  }

  /**
   * List connected nodes and their capabilities.
   */
  getConnectedNodes(): NodeInfo[] {
    return Array.from(this.nodes.values()).map(conn => ({
      deviceId: conn.deviceId,
      deviceName: conn.deviceName,
      platform: conn.platform,
      capabilities: conn.capabilities,
      connectedAt: conn.connectedAt,
      uptime: Date.now() - conn.connectedAt,
    }));
  }

  private startHeartbeat(conn: NodeConnection): void {
    conn.heartbeatInterval = setInterval(() => {
      if (Date.now() - conn.lastHeartbeat > 30000) {
        // Node is dead -- disconnect
        conn.ws.terminate();
        clearInterval(conn.heartbeatInterval!);
        this.handleDisconnect(conn.deviceId);
        return;
      }
      conn.ws.ping();
    }, 10000);
  }
}
```

### Step 3: Tool Definitions

Register node tools in `tools/toolset.ts` so agents can use nodes:

```typescript
{
  name: 'node_canvas_render',
  description: 'Render UI on a connected node device Canvas',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'Target node device ID' },
      content: { type: 'object', description: 'A2UI JSON content to render' },
    },
    required: ['deviceId', 'content'],
  },
},
{
  name: 'node_camera_capture',
  description: 'Capture a photo from a connected node camera',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      source: { type: 'string', enum: ['front', 'back'], default: 'back' },
    },
    required: ['deviceId'],
  },
},
{
  name: 'node_location_get',
  description: 'Get current location from a connected node',
  parameters: {
    type: 'object',
    properties: { deviceId: { type: 'string' } },
    required: ['deviceId'],
  },
},
{
  name: 'node_screen_record',
  description: 'Start/stop screen recording on a connected node',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      action: { type: 'string', enum: ['start', 'stop'] },
      duration: { type: 'number', description: 'Max recording seconds (start only)' },
    },
    required: ['deviceId', 'action'],
  },
},
```

### Step 4: CLI Commands

```
carina nodes list [--json]          List connected nodes
carina nodes capabilities <id>      Show node capabilities
carina nodes command <id> <cap> <method> [params]   Send raw command
```

---

## Existing Carina code to integrate with

- `infrastructure/node-host/` -- extend existing WS server
- `infrastructure/device-pairing.ts` -- verify device on connect
- `tools/toolset.ts` -- register node tools
- `cli/commands.ts` -- register `nodes` command group
- `gateway/router.ts` -- emit node connected/disconnected events
