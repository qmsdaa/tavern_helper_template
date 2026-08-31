<template>
  <section class="mb-5 space-y-3">
    <h3 class="text-sm font-semibold text-[#a5737f] tracking-wide">排版</h3>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>气泡字号</span>
        <span class="text-[#c05a72] font-medium">{{ config.bubbleFontSize }}px</span>
      </div>
      <input
        type="range" min="12" max="22" step="0.5"
        :value="config.bubbleFontSize"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ bubbleFontSize: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>旁白字号</span>
        <span class="text-[#c05a72] font-medium">{{ config.narrativeFontSize }}px</span>
      </div>
      <input
        type="range" min="12" max="22" step="0.5"
        :value="config.narrativeFontSize"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ narrativeFontSize: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>行距</span>
        <span class="text-[#c05a72] font-medium">{{ config.lineHeight }}</span>
      </div>
      <input
        type="range" min="1.4" max="2.0" step="0.05"
        :value="config.lineHeight"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>头像大小</span>
        <span class="text-[#c05a72] font-medium">{{ config.avatarSize }}px</span>
      </div>
      <input
        type="range" min="36" max="72" step="2"
        :value="config.avatarSize"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ avatarSize: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBubbleStore } from '../store';
const { config, updateConfig } = useBubbleStore();
</script>
