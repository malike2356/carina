import fs from 'node:fs/promises';
import path from 'node:path';
import { FLUX_VRAM_MIN_MB, probeComfyUiHardware, SD_VRAM_MIN_MB } from '../hardware.js';
import { readEnvKey } from '../shared.js';
import type { ImageGenProvider, ImageGenGenerateInput, ImageGenGenerateResult, ImageGenModelInfo } from '../types.js';

function comfyBaseUrl(): string {
  return readEnvKey('COMFYUI_URL', 'COMFYUI_BASE_URL') || 'http://127.0.0.1:8188';
}

function workflowPath(): string {
  return readEnvKey('COMFYUI_WORKFLOW_PATH');
}

export const comfyUiImageProvider: ImageGenProvider = {
  name: 'comfyui',
  displayName: 'ComfyUI',

  isAvailable(): boolean {
    return Boolean(comfyBaseUrl() && workflowPath());
  },

  listModels(): ImageGenModelInfo[] {
    return [
      {
        id: 'comfyui-workflow',
        display: 'ComfyUI workflow (COMFYUI_WORKFLOW_PATH)',
        speed: 'varies',
        strengths: 'Local SD/Flux with custom workflow',
        price: 'self-hosted',
      },
    ];
  },

  defaultModel(): string {
    return 'comfyui-workflow';
  },

  getSetupSchema() {
    return {
      name: 'ComfyUI',
      badge: 'local',
      tag: `Needs GPU host (>=${SD_VRAM_MIN_MB / 1024}GB SD, >=${FLUX_VRAM_MIN_MB / 1024}GB Flux)`,
      envVars: [
        { key: 'COMFYUI_URL', prompt: 'ComfyUI base URL', url: 'https://github.com/comfyanonymous/ComfyUI' },
        { key: 'COMFYUI_WORKFLOW_PATH', prompt: 'Exported API workflow JSON path' },
      ],
    };
  },

  async generate(input: ImageGenGenerateInput): Promise<ImageGenGenerateResult> {
    const baseUrl = comfyBaseUrl().replace(/\/$/, '');
    const wfPath = workflowPath();
    if (!wfPath) {
      throw new Error('COMFYUI_WORKFLOW_PATH required for ComfyUI image generation');
    }

    const hardware = await probeComfyUiHardware(baseUrl);
    if (!hardware.reachable) {
      throw new Error(hardware.message);
    }
    if (hardware.profile === 'insufficient') {
      throw new Error(
        `${hardware.message} Use IMAGE_GEN_PROVIDER=fal or Replicate on CPU-only hosts.`,
      );
    }

    const raw = await fs.readFile(wfPath, 'utf8');
    const workflow = JSON.parse(raw) as Record<string, unknown>;
    injectPrompt(workflow, input.prompt);

    const promptRes = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!promptRes.ok) {
      const body = await promptRes.text().catch(() => '');
      throw new Error(`ComfyUI /prompt failed (${promptRes.status}): ${body.slice(0, 300)}`);
    }

    const { prompt_id: promptId } = await promptRes.json() as { prompt_id?: string };
    if (!promptId) throw new Error('ComfyUI returned no prompt_id');

    const imageRef = await pollComfyHistory(baseUrl, promptId);
    const viewUrl = `${baseUrl}/view?${new URLSearchParams({
      filename: imageRef.filename,
      subfolder: imageRef.subfolder,
      type: imageRef.type,
    }).toString()}`;
    const viewRes = await fetch(viewUrl, { signal: AbortSignal.timeout(60_000) });
    if (!viewRes.ok) throw new Error(`ComfyUI /view failed (${viewRes.status})`);

    const buffer = Buffer.from(await viewRes.arrayBuffer());
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;
    return {
      buffer,
      model: `comfyui:${path.basename(wfPath)}`,
      width,
      height,
    };
  },
};

function injectPrompt(workflow: Record<string, unknown>, prompt: string): void {
  for (const node of Object.values(workflow)) {
    if (!node || typeof node !== 'object') continue;
    const row = node as { inputs?: Record<string, unknown>; class_type?: string };
    const inputs = row.inputs;
    if (!inputs) continue;
    if (typeof inputs.text === 'string' || row.class_type?.toLowerCase().includes('clip')) {
      if ('text' in inputs) inputs.text = prompt;
    }
    if (typeof inputs.prompt === 'string') {
      inputs.prompt = prompt;
    }
  }
}

async function pollComfyHistory(
  baseUrl: string,
  promptId: string,
): Promise<{ filename: string; subfolder: string; type: string }> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`ComfyUI history failed (${res.status})`);
    }
    const history = await res.json() as Record<string, {
      outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
    }>;
    const entry = history[promptId];
    const outputs = entry?.outputs ?? {};
    for (const output of Object.values(outputs)) {
      const image = output.images?.[0];
      if (image?.filename) {
        return {
          filename: image.filename,
          subfolder: image.subfolder ?? '',
          type: image.type ?? 'output',
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('ComfyUI generation timed out waiting for output image');
}

export async function getComfyUiHardwareReport() {
  return probeComfyUiHardware(comfyBaseUrl());
}
