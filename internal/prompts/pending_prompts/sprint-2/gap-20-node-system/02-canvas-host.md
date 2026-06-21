# Gap 20 - Prompt 02: Canvas Host & A2UI Rendering Pipeline

**Gap:** 20 Node System & Device Architecture
**Prompt number:** 02 of 04
**Name:** Canvas rendering pipeline, A2UI host, artifact display
**Primary agent:** Claude Code (server) / Cursor (mobile Canvas client)
**Estimated hours:** 3-4 h
**Depends on:** 01-node-protocol.md

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

1. `infrastructure/node-host/` -- node protocol from prompt 01
2. `gateway/web-chat-turn.ts` -- ChatTurnRegistry (Canvas extends this pattern)
3. OpenClaw `src/nodes/canvas.ts` (reference)

---

## Goal

Build a Canvas rendering pipeline. When the agent generates an artifact
(HTML page, SVG diagram, data table, React component), it renders on a
connected node's Canvas rather than just in the chat.

### Step 1: Canvas Host (Server Side)

Create `infrastructure/node-host/canvas-host.ts`:

```typescript
export interface CanvasArtifact {
  id: string;
  type: 'html' | 'svg' | 'markdown' | 'react' | 'image' | 'json-table';
  content: string;
  title?: string;
  metadata?: {
    width?: number;
    height?: number;
    interactive?: boolean;
    refreshInterval?: number; // auto-refresh (dashboard mode)
  };
  createdAt: number;
  sessionId: string;
}

export class CanvasHost {
  private artifacts: Map<string, CanvasArtifact> = new Map();
  private nodeHost: NodeHostServer;

  constructor(nodeHost: NodeHostServer) {
    this.nodeHost = nodeHost;
  }

  /**
   * Push an artifact to a specific node's Canvas.
   */
  async pushToNode(
    deviceId: string,
    artifact: CanvasArtifact,
  ): Promise<{ artifactId: string; rendered: boolean }> {
    this.artifacts.set(artifact.id, artifact);

    const response = await this.nodeHost.sendCommand(
      deviceId,
      NodeCapability.CANVAS_RENDER,
      'render',
      {
        artifactId: artifact.id,
        type: artifact.type,
        content: artifact.content,
        title: artifact.title,
        metadata: artifact.metadata,
      },
      15000,
    );

    return {
      artifactId: artifact.id,
      rendered: response.ok,
    };
  }

  /**
   * Push to all connected nodes with Canvas capability.
   */
  async pushToAll(artifact: CanvasArtifact): Promise<string[]> {
    const canvasNodes = this.nodeHost.getConnectedNodes()
      .filter(n => n.capabilities.includes(NodeCapability.CANVAS_RENDER));

    const results = await Promise.allSettled(
      canvasNodes.map(node => this.pushToNode(node.deviceId, artifact))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.rendered)
      .map(r => r.value.artifactId);
  }

  /**
   * Update an existing artifact (for live dashboards).
   */
  async updateArtifact(artifactId: string, newContent: string): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    artifact.content = newContent;
    // Push update to all nodes that have this artifact
    // ... (broadcast update to relevant nodes)
  }

  getArtifact(artifactId: string): CanvasArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  listArtifacts(sessionId: string): CanvasArtifact[] {
    return Array.from(this.artifacts.values())
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}
```

### Step 2: A2UI Host Route

Serve Canvas content at `/__carina__/canvas/`:

```typescript
// In gateway/router.ts or a separate express router:
app.get('/__carina__/canvas/:artifactId', (req, res) => {
  const artifact = canvasHost.getArtifact(req.params.artifactId);
  if (!artifact) return res.status(404).send('Artifact not found');

  switch (artifact.type) {
    case 'html':
      res.type('html').send(artifact.content);
      break;
    case 'svg':
      res.type('image/svg+xml').send(artifact.content);
      break;
    case 'markdown':
      // Render markdown to HTML
      const html = markdownToHtml(artifact.content);
      res.type('html').send(wrapHtml(html, artifact.title));
      break;
    case 'json-table':
      res.json({ type: 'table', data: JSON.parse(artifact.content) });
      break;
    default:
      res.type('text/plain').send(artifact.content);
  }
});
```

### Step 3: Agent Tool for Canvas

```typescript
{
  name: 'canvas_push',
  description: 'Push an artifact to a user device Canvas for richer display',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['html', 'svg', 'markdown', 'react', 'image', 'json-table'] },
      content: { type: 'string' },
      title: { type: 'string' },
      deviceId: { type: 'string', description: 'Target device (omit for all connected)' },
    },
    required: ['type', 'content'],
  },
}
```

### Step 4: Mobile Canvas Client (Cursor task)

The iOS/Android apps need a Canvas view:
- Connects to gateway via WebSocket (same as chat)
- Listens for `canvas.render` commands
- Renders HTML in WKWebView/Android WebView
- Supports interactive mode (React components via JSBridge)
- Pull-to-refresh for live dashboard artifacts

---

## Existing Carina code to integrate with

- `infrastructure/node-host/` -- node protocol (prompt 01)
- `gateway/router.ts` -- serve /__carina__/canvas/
- `tools/toolset.ts` -- register `canvas_push` tool
- `external/client-apps/carinaMobile/` -- mobile Canvas view
- `external/client-apps/app.carinaai.uk/` -- web Canvas view
