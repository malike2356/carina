'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  Bot,
  ChevronRight,
  LayoutGrid,
  Library,
  Monitor,
  Search,
  Settings,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LabCard = {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

const LAB_CARDS: LabCard[] = [
  {
    href: '/aiva/lab/playground',
    title: 'Lab Playground',
    description: 'Try model, system prompt, temperature, thinking level, and tool toggles in one studio console.',
    icon: Sparkles,
  },
  {
    href: '/aiva/dashboard',
    title: 'Workspace dashboard',
    description: 'Open the new overview surface with activity, health, and high-level state.',
    icon: LayoutGrid,
  },
  {
    href: '/aiva/sessions',
    title: 'Session browser',
    description: 'Review the conversation timeline and jump into any thread.',
    icon: Search,
  },
  {
    href: '/aiva/skills',
    title: 'Skills studio',
    description: 'Browse platform skills, custom learning, and reusable automation patterns.',
    icon: Library,
  },
  {
    href: '/aiva/models',
    title: 'Models console',
    description: 'Inspect the active provider stack and the model combinations available here.',
    icon: Bot,
  },
  {
    href: '/aiva/config',
    title: 'Runtime config',
    description: 'See surfaced runtime settings, feature flags, and host metadata.',
    icon: SlidersHorizontal,
  },
  {
    href: '/aiva/workers',
    title: 'Worker canvas',
    description: 'Continue into the worker workspace that actually uses these surfaces.',
    icon: Monitor,
  },
];

export function AivaWorkspaceLab() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Workspace lab
        </div>
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold text-text-primary">Open the new surfaces inside Aiva</h1>
          <p className="text-sm leading-6 text-text-secondary">
            Start with Lab Playground when you want a studio-style experiment console. The rest of this hub keeps
            sessions, skills, models, and runtime config inside the AI-employee OS.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LAB_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.href}
              className="border-border/80 bg-card transition-transform duration-150 hover:-translate-y-0.5 hover:border-accent/40"
            >
              <CardHeader className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-text-secondary">{card.description}</p>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  Open
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle>What changed recently</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-text-secondary">
            <p>1. The workspace overview is now a real page instead of a dead-end redirect.</p>
            <p>2. Sessions, skills, models, and config now have their own surfaces.</p>
            <p>3. The self-improving loop now skips duplicate turns and prunes its ledger.</p>
            <p>4. Scout is kept as a separate product boundary in the copy and docs.</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle>How to use this hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-text-secondary">
            <p>Open Lab Playground to try prompts with model, temperature, thinking, and tool toggles.</p>
            <p>Use sessions when you want the live conversation timeline.</p>
            <p>Use skills and models when you want to inspect the runtime shape of the workspace.</p>
            <p>If you want the worker experience, jump back to the worker canvas at any point.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
