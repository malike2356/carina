import { useEffect, useState } from 'react';
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  loadAppearance,
  saveAppearance,
  type AppearanceSettings,
} from '../../../lib/appearance.js';
import { getAutostartEnabled, setAutostartEnabled } from '../../../lib/autostart.js';

const ACCENTS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308'];

export default function AppearanceSettingsPage() {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    const loaded = loadAppearance();
    setSettings(loaded);
    applyAppearance(loaded);
    void getAutostartEnabled().then(setAutostart);
  }, []);

  function update(patch: Partial<AppearanceSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAppearance(next);
    applyAppearance(next);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Theme</h2>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <button key={theme} type="button" onClick={() => update({ theme })} className={`px-3 py-1.5 text-sm rounded ${settings.theme === theme ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
              {theme}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Font size</h2>
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map((fontSize) => (
            <button key={fontSize} type="button" onClick={() => update({ fontSize })} className={`px-3 py-1.5 text-sm rounded ${settings.fontSize === fontSize ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
              {fontSize}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Density</h2>
        <div className="flex gap-2">
          {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
            <button key={density} type="button" onClick={() => update({ density })} className={`px-3 py-1.5 text-sm rounded ${settings.density === density ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
              {density}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Accent color</h2>
        <div className="flex gap-2">
          {ACCENTS.map((accent) => (
            <button key={accent} type="button" onClick={() => update({ accent })} className="h-8 w-8 rounded-full border border-zinc-700" style={{ backgroundColor: accent }} aria-label={accent} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Launch at login</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(event) => {
              const next = event.target.checked;
              setAutostart(next);
              void setAutostartEnabled(next);
            }}
          />
          Start Carina when you sign in
        </label>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-zinc-100 mb-2">Message timestamps</h2>
        <select value={settings.timestamps} onChange={(e) => update({ timestamps: e.target.value as AppearanceSettings['timestamps'] })} className="px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg">
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="hidden">Hidden</option>
        </select>
      </section>
    </div>
  );
}
