import { useEffect, useState } from 'react';
import { getChannels } from '../../../lib/gateway-client.js';

const CHANNEL_TYPES = ['telegram', 'discord', 'slack', 'whatsapp', 'email'];

export default function ChannelsSettingsPage() {
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type: string; status: string }>>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState('telegram');
  const [token, setToken] = useState('');
  const [channelName, setChannelName] = useState('');

  useEffect(() => {
    void getChannels().then(setChannels);
  }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Channels</h2>
        <button type="button" onClick={() => { setWizardOpen(true); setStep(1); }} className="text-xs bg-indigo-600 text-white rounded px-2 py-1">
          Add channel
        </button>
      </div>
      {channels.length === 0 ? (
        <p className="text-sm text-zinc-500">No channels configured. Use the wizard or `carina gateway channels` on the host.</p>
      ) : (
        <div className="space-y-2">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-lg border border-zinc-800 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-100">{channel.name}</p>
                <p className="text-xs text-zinc-500">{channel.type} | {channel.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {wizardOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Add channel (step {step}/4)</h3>
            {step === 1 && (
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-3 w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg">
                {CHANNEL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            )}
            {step === 2 && (
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bot token or webhook URL" className="mt-3 w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg" />
            )}
            {step === 3 && <p className="mt-3 text-xs text-zinc-400">Test message wiring uses gateway channel endpoints when available.</p>}
            {step === 4 && (
              <input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Channel name" className="mt-3 w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg" />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setWizardOpen(false)} className="text-xs text-zinc-400">Cancel</button>
              <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))} className="text-xs bg-indigo-600 text-white rounded px-2 py-1">
                {step === 4 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
