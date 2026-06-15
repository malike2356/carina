import type { CatalogEntry, ServeBackend, ServeCommands } from './types.js';

const BACKEND_ENV: Record<ServeBackend, Record<string, string>> = {
  ollama: {
    OLLAMA_ENABLED: 'true',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434/v1',
  },
  'llama.cpp': {
    LLAMACPP_ENABLED: 'true',
    LLAMACPP_BASE_URL: 'http://127.0.0.1:8080/v1',
  },
  vllm: {
    VLLM_ENABLED: 'true',
    VLLM_BASE_URL: 'http://127.0.0.1:8000/v1',
  },
  'lm-studio': {
    LMSTUDIO_ENABLED: 'true',
    LMSTUDIO_BASE_URL: 'http://127.0.0.1:1234/v1',
  },
};

function ollamaTag(entry: CatalogEntry): string {
  return entry.ollamaTag ?? entry.id;
}

function ggufFilename(entry: CatalogEntry): string {
  const parts = entry.downloadUrl.split('/');
  return parts[parts.length - 1] ?? `${entry.id}.gguf`;
}

function buildOllama(entry: CatalogEntry): ServeCommands {
  const tag = ollamaTag(entry);
  return {
    download: [`ollama pull ${tag}`],
    serve: [`ollama run ${tag}`],
    envKeys: {
      ...BACKEND_ENV.ollama,
      OLLAMA_MODEL: tag,
    },
    notes: ['Ollama must be installed: https://ollama.com/download'],
  };
}

function buildLlamaCpp(entry: CatalogEntry): ServeCommands {
  const file = ggufFilename(entry);
  return {
    download: [`wget -O ${file} "${entry.downloadUrl}"`],
    serve: [`./server -m ${file} --port 8080`],
    envKeys: {
      ...BACKEND_ENV['llama.cpp'],
      LLAMACPP_MODEL: 'default',
    },
    notes: [
      'Build llama.cpp server from https://github.com/ggerganov/llama.cpp',
      'Run the server command from the directory containing the GGUF file.',
    ],
  };
}

function buildVllm(entry: CatalogEntry): ServeCommands {
  const modelPath = entry.downloadUrl.replace('/resolve/main/', '/tree/main/');
  return {
    download: [`# Download weights from ${modelPath}`],
    serve: [`vllm serve ${entry.displayName} --port 8000`],
    envKeys: {
      ...BACKEND_ENV.vllm,
      VLLM_MODEL: entry.id,
    },
    notes: ['vLLM works best with safetensors/AWQ models. GGUF requires conversion.'],
  };
}

function buildLmStudio(entry: CatalogEntry): ServeCommands {
  const file = ggufFilename(entry);
  return {
    download: [`wget -O ${file} "${entry.downloadUrl}"`],
    serve: ['# Load the GGUF file in LM Studio and start the local server on port 1234'],
    envKeys: {
      ...BACKEND_ENV['lm-studio'],
      LMSTUDIO_MODEL: 'local-model',
    },
    notes: ['LM Studio: https://lmstudio.ai/'],
  };
}

export function buildServeCommands(entry: CatalogEntry, via?: ServeBackend): ServeCommands {
  const backend = via ?? entry.serveVia[0] ?? 'ollama';
  if (!entry.serveVia.includes(backend)) {
    throw new Error(`Model ${entry.id} does not support ${backend}. Options: ${entry.serveVia.join(', ')}`);
  }
  switch (backend) {
    case 'ollama': return buildOllama(entry);
    case 'llama.cpp': return buildLlamaCpp(entry);
    case 'vllm': return buildVllm(entry);
    case 'lm-studio': return buildLmStudio(entry);
    default: return buildOllama(entry);
  }
}

export function formatEnvBlock(envKeys: Record<string, string>): string[] {
  return [
    '# Add to ~/.carina/.env or your shell environment:',
    ...Object.entries(envKeys).map(([k, v]) => `${k}=${v}`),
    'CARINA_LOCAL_LLM_ENABLED=true',
  ];
}

export async function executeServeCommands(
  commands: ServeCommands,
  confirm: (prompt: string) => Promise<boolean>,
): Promise<void> {
  const all = [...commands.download, ...commands.serve].filter((c) => !c.startsWith('#'));
  const preview = all.map((c) => `  ${c}`).join('\n');
  const ok = await confirm(`Run these commands?\n${preview}\n(yes/no): `);
  if (!ok) return;

  const { execSync } = await import('node:child_process');
  for (const cmd of all) {
    execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
  }
}
