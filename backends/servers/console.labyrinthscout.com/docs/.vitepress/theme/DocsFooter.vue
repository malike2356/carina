<script setup lang="ts">
import { useData, withBase } from 'vitepress';

const { theme } = useData();

const columns = [
  {
    title: 'Guide',
    links: [
      { label: 'Getting started', href: withBase('/getting-started') },
      { label: 'Configuration', href: withBase('/configuration') },
      { label: 'Dashboard', href: withBase('/dashboard') },
      { label: 'Threat model', href: withBase('/security/threat-model') },
    ],
  },
  {
    title: 'Reference',
    links: [
      { label: 'API events', href: withBase('/api/events') },
      { label: 'Node SDK', href: withBase('/sdk/node') },
      { label: 'Carina integration', href: withBase('/integration/carina') },
      { label: 'Public trust API', href: withBase('/api/public-trust') },
    ],
  },
  {
    title: 'VERLOX',
    links: [
      { label: 'Scout marketing', href: 'https://labyrinthscout.com' },
      { label: 'Scout pricing', href: 'https://labyrinthscout.com#pricing' },
      { label: 'Carina docs', href: 'https://docs.carinaai.uk' },
      { label: 'MIT License', href: 'https://github.com/verlox/labyrinth-scout/blob/main/LICENSE' },
    ],
  },
];

const year = new Date().getFullYear();
const message = theme.value.footer?.message ?? 'MIT Licensed. Built by VERLOX Ltd.';
const copyright = theme.value.footer?.copyright ?? `Copyright ${year} VERLOX Ltd`;
</script>

<template>
  <footer class="VPFooter docs-family-footer-wrap">
    <div class="docs-family-footer">
      <div v-for="column in columns" :key="column.title">
        <p class="docs-family-footer__title">{{ column.title }}</p>
        <ul class="docs-family-footer__links">
          <li v-for="link in column.links" :key="link.label">
            <a :href="link.href">{{ link.label }}</a>
          </li>
        </ul>
      </div>
    </div>
    <p class="docs-family-footer__copyright">{{ message }} {{ copyright }}.</p>
  </footer>
</template>

<style scoped>
.docs-family-footer-wrap {
  border-top: 1px solid rgba(34, 211, 238, 0.08);
}
</style>
