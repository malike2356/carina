<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import DocsFooter from './DocsFooter.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <DocsFooter />
    </template>
  </Layout>
</template>
