'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CarinaEditor } from '@/components/editor';
import { cn } from '@/lib/utils';
import {
  getProfileStarterTemplate,
  PROFILE_STARTER_TEMPLATES,
} from '@/lib/profile-templates';

export type ProfileBuilderValues = {
  name: string;
  slug: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
};

type ModelOption = {
  provider: string;
  model: string;
  label: string;
};

type ProfileBuilderProps = {
  mode: 'create' | 'edit';
  profileId?: string;
  initialValues?: ProfileBuilderValues;
  initialTemplateId?: string;
};

const EMPTY_VALUES: ProfileBuilderValues = {
  name: '',
  slug: '',
  description: '',
  systemPrompt: '',
  provider: '',
  model: '',
};

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function ProfileBuilder({
  mode,
  profileId,
  initialValues,
  initialTemplateId,
}: ProfileBuilderProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileBuilderValues>(EMPTY_VALUES);
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const template = initialTemplateId ? getProfileStarterTemplate(initialTemplateId) : null;
    if (mode === 'create' && template) {
      setValues({
        ...EMPTY_VALUES,
        name: template.name === 'Blank' ? '' : template.name,
        slug: template.id === 'blank' ? '' : slugFromName(template.name),
        description: template.description,
        systemPrompt: template.systemPrompt,
      });
      setSelectedTemplateId(template.id);
      setSlugTouched(template.id !== 'blank');
      return;
    }

    if (initialValues) {
      setValues(initialValues);
      setSlugTouched(true);
    }
  }, [initialTemplateId, initialValues, mode]);

  useEffect(() => {
    void fetch('/api/models', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { data?: ModelOption[] }) => setModels(data.data ?? []))
      .catch(() => setModels([]));
  }, []);

  const modelsForProvider = useMemo(
    () => models.filter((entry) => entry.provider === values.provider),
    [models, values.provider],
  );

  function updateName(name: string) {
    setValues((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugFromName(name),
    }));
  }

  function applyTemplate(templateId: string) {
    const template = getProfileStarterTemplate(templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setValues((current) => ({
      ...current,
      name: template.id === 'blank' ? current.name : template.name,
      slug:
        template.id === 'blank'
          ? current.slug
          : slugTouched
            ? current.slug
            : slugFromName(template.name),
      description: template.description,
      systemPrompt: template.systemPrompt,
    }));
    if (template.id !== 'blank') {
      setSlugTouched(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: values.name,
      slug: values.slug,
      description: values.description || null,
      systemPrompt: values.systemPrompt,
      provider: values.provider || null,
      model: values.model || null,
    };

    try {
      const res = await fetch(
        mode === 'create' ? '/api/workspace/profiles' : `/api/workspace/profiles/${profileId}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'create' ? { action: 'create', ...payload } : payload,
          ),
        },
      );
      const data = (await res.json()) as { error?: string; data?: { id?: string } };
      if (!res.ok) {
        throw new Error(data.error ?? 'Unable to save profile');
      }
      router.push('/profiles');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/profiles">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">
              {mode === 'create' ? 'New profile' : 'Edit profile'}
            </h1>
            <p className="text-xs text-text-muted">
              Build a workspace persona with its own system prompt and optional model defaults.
            </p>
          </div>
          <Button type="submit" form="profile-builder-form" disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : mode === 'create' ? 'Create profile' : 'Save changes'}
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <form
        id="profile-builder-form"
        className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[0.9fr_1.1fr]"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="space-y-6">
          {mode === 'create' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Starter template</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {PROFILE_STARTER_TEMPLATES.map((template) => {
                  const active = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-accent/40 bg-accent-dim/20'
                          : 'border-border bg-elevated hover:border-accent/30',
                      )}
                    >
                      <p className="text-sm font-medium text-text-primary">{template.name}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{template.description}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-text-muted">
                Optional. New chats opened with this profile can start with a preferred provider and model.
              </p>
              <div className="space-y-2">
                <Label htmlFor="profile-provider">Provider</Label>
                <select
                  id="profile-provider"
                  aria-label="Provider"
                  value={values.provider}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      provider: event.target.value,
                      model: '',
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">Workspace default</option>
                  {[...new Set(models.map((entry) => entry.provider))].map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-model">Model</Label>
                <select
                  id="profile-model"
                  aria-label="Model"
                  value={values.model}
                  disabled={!values.provider}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, model: event.target.value }))
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                >
                  <option value="">Workspace default</option>
                  {modelsForProvider.map((entry) => (
                    <option key={`${entry.provider}-${entry.model}`} value={entry.model}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={values.name}
                  onChange={(event) => updateName(event.target.value)}
                  placeholder="Research assistant"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-slug">Slug</Label>
                <Input
                  id="profile-slug"
                  value={values.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setValues((current) => ({ ...current, slug: event.target.value }));
                  }}
                  placeholder="research-assistant"
                  maxLength={64}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-description">Description</Label>
                <Input
                  id="profile-description"
                  value={values.description}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Shown in the profile switcher"
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Persona</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="profile-system-prompt">System prompt</Label>
                <CarinaEditor
                  value={values.systemPrompt}
                  onChange={(systemPrompt) =>
                    setValues((current) => ({ ...current, systemPrompt }))
                  }
                  placeholder="Describe how Carina should behave under this profile."
                  minHeight="18rem"
                  variant="compact"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
