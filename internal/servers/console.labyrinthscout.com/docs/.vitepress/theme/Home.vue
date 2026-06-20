<script setup lang="ts">
import { useData, withBase } from 'vitepress';

interface FeatureRow {
  title: string;
  details: string;
}

const { frontmatter } = useData();

const features = (frontmatter.value.features ?? []) as FeatureRow[];

const paths = [
  {
    title: 'Getting started',
    description: 'Deploy Scout, install the SDK, and verify your first events.',
    href: withBase('/getting-started'),
  },
  {
    title: 'Carina integration',
    description: 'Pair Scout with Carina using setup wizard or environment variables.',
    href: withBase('/integration/carina'),
  },
  {
    title: 'API reference',
    description: 'Events, heartbeat, kill switch, honeypots, and public trust endpoints.',
    href: withBase('/api/events'),
  },
];
</script>

<template>
  <div class="scout-docs-home">
    <section class="scout-docs-hero">
      <div class="scout-docs-hero__inner">
        <p class="scout-docs-eyebrow">Labyrinth Scout documentation</p>
        <h1>Your AI agent can act. <span>Scout makes it accountable.</span></h1>
        <p class="scout-docs-lead">
          {{ frontmatter.hero?.tagline ?? frontmatter.tagline ?? 'Security control plane for autonomous AI agents: prompt guard, kill switch, honeypots, and live monitoring.' }}
        </p>
        <div class="scout-docs-actions">
          <a class="scout-docs-btn scout-docs-btn--primary" :href="withBase('/getting-started')">Get started</a>
          <a class="scout-docs-btn scout-docs-btn--ghost" :href="withBase('/integration/carina')">Carina integration</a>
          <a class="scout-docs-btn scout-docs-btn--ghost" href="https://labyrinthscout.com" target="_blank" rel="noopener noreferrer">Marketing site</a>
        </div>
      </div>
    </section>

    <section class="scout-docs-paths">
      <h2>Start here</h2>
      <div class="scout-docs-paths__grid">
        <a
          v-for="path in paths"
          :key="path.href"
          class="scout-docs-path-card"
          :href="path.href"
        >
          <strong>{{ path.title }}</strong>
          <span>{{ path.description }}</span>
        </a>
      </div>
    </section>

    <section v-if="features.length" class="scout-docs-features">
      <div class="scout-docs-features__inner">
        <h2>What Scout controls</h2>
        <p>Production governance for agents you ship with Carina or any custom stack.</p>
        <div class="scout-docs-features__grid">
          <article v-for="feature in features" :key="feature.title" class="scout-docs-feature">
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.details }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="scout-docs-cta-band">
      <p>Need hosted Scout with a private console URL? See pricing on the marketing site.</p>
      <a class="scout-docs-btn scout-docs-btn--primary" href="https://labyrinthscout.com#pricing" target="_blank" rel="noopener noreferrer">
        View Scout Monitor and Pro
      </a>
    </section>
  </div>
</template>
