import { useEffect, useState } from 'react';
import { getProviders, saveProviderKey, switchProvider, testProviderKey } from '../../../lib/gateway-client.js';

const PROVIDERS = ['deepseek', 'anthropic', 'openai', 'gemini', 'groq'];

export default function ModelsSettingsPage() {
  const [active, setActive] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    void getProviders().then((data) => {
      setProviders(data.providers);
      setActive(data.active);
    });
    setSystemPrompt(localStorage.getItem('carina_system_prompt') ?? '');
  }, []);

  async function handleSwitch(provider: string) {
    await switchProvider(provider);
    setActive(provider);
  }

  async function handleTest(provider: string) {
    const result = await testProviderKey(provider, keys[provider] ?? '');
    setStatus((prev) => ({ ...prev, [provider]: result.ok ? 'Valid' : (result.message ?? 'Invalid') }));
  }

  async function handleSaveKey(provider: string) {
    await saveProviderKey(provider, keys[provider] ?? '');
    setStatus((prev) => ({ ...prev, [provider]: 'Saved via gateway' }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Active model</h2>
        <select
          value={active}
          onChange={(e) => void handleSwitch(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg"
        >
          {(providers.length ? providers : PROVIDERS).map((provider) => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Provider API keys</h2>
        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <div key={provider} className="rounded-lg border border-zinc-800 p-3">
              <label className="text-xs uppercase tracking-wide text-zinc-500">{provider}</label>
              <input
                type="password"
                value={keys[provider] ?? ''}
                onChange={(e) => setKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg"
                placeholder="Stored via gateway"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void handleTest(provider)} className="text-xs border border-zinc-700 rounded px-2 py-1">Test</button>
                <button type="button" onClick={() => void handleSaveKey(provider)} className="text-xs bg-indigo-600 text-white rounded px-2 py-1">Save</button>
                <span className="text-xs text-zinc-500 self-center">{status[provider]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Model defaults</h2>
        <label className="block text-xs text-zinc-500 mb-1">Temperature ({temperature})</label>
        <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full" />
        <label className="block text-xs text-zinc-500 mt-3 mb-1">Max tokens</label>
        <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg" />
        <label className="block text-xs text-zinc-500 mt-3 mb-1">System prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            localStorage.setItem('carina_system_prompt', e.target.value);
          }}
          rows={5}
          className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg"
        />
      </section>
    </div>
  );
}
