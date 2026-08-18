<template>
  <div v-if="info" class="pov-confirm">
    <h2 class="screen-title">确认你的视角</h2>

    <div class="confirm-card card">
      <div class="portrait-side">
        <img :src="portraitUrl(info.portrait)" :alt="info.name" draggable="false" />
      </div>
      <div class="detail-side">
        <h3 class="name">{{ info.name }}</h3>
        <span class="role-tag">{{ info.role }}</span>
        <div class="row">
          <span class="label">简介</span>
          <p class="value">{{ info.tagline }}</p>
        </div>
        <div v-if="info.exclusive" class="row exclusive">
          <span class="label"><i class="fa-solid fa-star"></i> 独占内容</span>
          <p class="value">{{ info.exclusive }}</p>
        </div>
        <div class="actions">
          <button class="btn-primary" @click="store.toOpening()">以此视角开始</button>
          <button class="btn-ghost" @click="store.backToMode()">重新选择</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { portraitUrl } from './data';
import { useOpeningStore } from './store';

const store = useOpeningStore();
const info = computed(() => store.povInfo);

// 直接从地址栏等情况绕过选择到达本屏时，退回模式选择
onMounted(() => {
  if (!store.povInfo) {
    store.backToMode();
  }
});
</script>

<style lang="scss" scoped>
.pov-confirm {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 40px;
}

.screen-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 4px;
  margin-bottom: 24px;
}

.confirm-card {
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.portrait-side {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 300px;
  background: linear-gradient(180deg, var(--c-surface) 0%, var(--c-bg-deep) 100%);
  overflow: hidden;

  img {
    height: 290px;
    width: auto;
    object-fit: contain;
    object-position: bottom;
    user-select: none;
  }
}

.detail-side {
  padding: 20px 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.name {
  font-size: 22px;
  font-weight: 800;
}

.role-tag {
  align-self: flex-start;
  padding: 3px 12px;
  border-radius: var(--radius-button);
  background: var(--c-primary-soft);
  color: var(--c-primary-strong);
  font-size: 13px;
  font-weight: 600;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 13px;
  color: var(--c-text-muted);
}

.exclusive .label {
  color: var(--c-warning);
}

.value {
  font-size: 15px;
  line-height: 1.7;
}

.actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;

  .btn-primary {
    font-size: 16px;
  }

  .btn-ghost {
    align-self: center;
  }
}

@media (min-width: 560px) {
  .confirm-card {
    max-width: 560px;
    flex-direction: row;
  }

  .portrait-side {
    width: 45%;
    height: auto;
    min-height: 340px;

    img {
      height: 320px;
    }
  }

  .detail-side {
    width: 55%;
    justify-content: center;
  }
}
</style>
