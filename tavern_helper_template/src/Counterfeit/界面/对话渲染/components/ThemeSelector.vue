<template>
  <section class="mb-5">
    <h3 class="text-sm font-semibold text-[#a5737f] mb-2 tracking-wide">主题</h3>
    <div class="flex gap-2">
      <button
        v-for="t in themes"
        :key="t.id"
        class="flex-1 py-1.5 text-xs rounded-lg border transition"
        :class="config.theme === t.id ? 'bg-[#e87a90] text-white border-[#e87a90]' : 'bg-white text-[#5b4a4f] border-[#e3d3d8] hover:border-[#e87a90]'"
        @click="updateConfig({ theme: t.id })"
      >
        {{ t.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBubbleStore } from '../store';
const { config, updateConfig } = useBubbleStore();

const themes = [
  { id: 'parchment', label: '羊皮纸' },
  { id: 'dark', label: '暗夜' },
  { id: 'green', label: '豆沙绿' },
];
</script>
