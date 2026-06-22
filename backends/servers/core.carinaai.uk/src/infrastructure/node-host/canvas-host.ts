import { randomUUID } from 'node:crypto';
import { NodeCapability } from './node-protocol.js';
import { getNodeHostServer } from './node-host-server.js';

export interface CanvasArtifact {
  id: string;
  type: 'html' | 'svg' | 'markdown' | 'react' | 'image' | 'json-table';
  content: string;
  title?: string;
  metadata?: {
    width?: number;
    height?: number;
    interactive?: boolean;
    refreshInterval?: number;
  };
  createdAt: number;
  sessionId: string;
  renderedOn: Set<string>;
}

export class CanvasHost {
  private artifacts = new Map<string, CanvasArtifact>();

  async pushToNode(
    deviceId: string,
    artifact: CanvasArtifact,
  ): Promise<{ artifactId: string; rendered: boolean }> {
    this.artifacts.set(artifact.id, artifact);

    try {
      const response = await getNodeHostServer().sendCommand(
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
        15_000,
      );
      if (response.ok) {
        artifact.renderedOn.add(deviceId);
      }
      return { artifactId: artifact.id, rendered: response.ok };
    } catch {
      return { artifactId: artifact.id, rendered: false };
    }
  }

  async pushToAll(artifact: CanvasArtifact): Promise<string[]> {
    const nodes = getNodeHostServer()
      .getConnectedNodes()
      .filter((node) => node.capabilities.includes(NodeCapability.CANVAS_RENDER));

    const results = await Promise.allSettled(
      nodes.map((node) => this.pushToNode(node.deviceId, artifact)),
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ artifactId: string; rendered: boolean }> =>
        result.status === 'fulfilled' && result.value.rendered)
      .map((result) => result.value.artifactId);
  }

  async updateArtifact(artifactId: string, newContent: string): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);
    artifact.content = newContent;

    await Promise.allSettled(
      Array.from(artifact.renderedOn).map((deviceId) =>
        getNodeHostServer().sendCommand(
          deviceId,
          NodeCapability.CANVAS_RENDER,
          'update',
          { artifactId, content: newContent },
          15_000,
        ),
      ),
    );
  }

  getArtifact(artifactId: string): CanvasArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  listArtifacts(sessionId: string): CanvasArtifact[] {
    return Array.from(this.artifacts.values())
      .filter((artifact) => artifact.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  createArtifact(input: {
    type: CanvasArtifact['type'];
    content: string;
    title?: string;
    sessionId: string;
    metadata?: CanvasArtifact['metadata'];
  }): CanvasArtifact {
    const artifact: CanvasArtifact = {
      id: randomUUID(),
      type: input.type,
      content: input.content,
      title: input.title,
      metadata: input.metadata,
      createdAt: Date.now(),
      sessionId: input.sessionId,
      renderedOn: new Set(),
    };
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }
}

let host: CanvasHost | null = null;

export function getCanvasHost(): CanvasHost {
  host ??= new CanvasHost();
  return host;
}

export function resetCanvasHostForTests(): void {
  host = null;
}
