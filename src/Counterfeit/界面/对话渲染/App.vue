<template>
  <div class="relative">
    <button class="absolute top-0 right-0 text-xl leading-none text-[#a5737f] hover:text-[#c05a72]" @click="closePanel">×</button>
    <h2 class="text-base font-bold text-[#c05a72] mb-4 tracking-widest">🌸 对话气泡 · Counterfeit</h2>

    <label class="flex items-center gap-2 text-xs mb-5 cursor-pointer">
      <input type="checkbox" :checked="config.enabled" @change="updateConfig({ enabled: ($event.target as HTMLInputElement).checked })" />
      <span>启用对话气泡渲染与格式注入</span>
    </label>

    <ThemeSelector />
    <FontControls />
    <AvatarManager />

    <p class="mt-4 text-[11px] text-[#a08a90] leading-relaxed">
      主题、字号、行距调整会实时生效；头像 URL 与上传图均保存在浏览器本地，不上传服务器。
    </p>
  </div>
</template>

<script setup lang="ts">
import { useBubbleStore } from './store';
import ThemeSelector from './components/ThemeSelector.vue';
import FontControls from './components/FontControls.vue';
import AvatarManager from './components/AvatarManager.vue';

const { config, updateConfig, closePanel } = useBubbleStore();
</script>
