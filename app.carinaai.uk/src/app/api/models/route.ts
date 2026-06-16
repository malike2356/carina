import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';

const PROVIDER_MODELS: Record<string, Array<{ model: string; label: string }>> = {
  deepseek: [
    { model: 'deepseek-chat', label: 'DeepSeek Chat' },
    { model: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
  openai: [
    { model: 'gpt-4o', label: 'GPT-4o' },
    { model: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { model: 'o3-mini', label: 'o3 Mini' },
  ],
  groq: [
    { model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { model: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
  openrouter: [
    { model: 'deepseek/deepseek-chat', label: 'DeepSeek via OpenRouter' },
    { model: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { model: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
  ],
  together: [
    { model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
  ],
  mistral: [
    { model: 'mistral-small-latest', label: 'Mistral Small' },
    { model: 'mistral-large-latest', label: 'Mistral Large' },
  ],
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const data = keys.flatMap((key) =>
    (PROVIDER_MODELS[key.provider] ?? []).map((model) => ({
      provider: key.provider,
      model: model.model,
      label: model.label,
    })),
  );

  return NextResponse.json({ data });
}
