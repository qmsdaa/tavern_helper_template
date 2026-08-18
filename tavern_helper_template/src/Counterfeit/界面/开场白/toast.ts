// 轻量 toast：不依赖酒馆环境的 toastr（纯浏览器预览没有该全局变量），自实现以保证两端可用。
export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  text: string;
}

const toasts = ref<ToastItem[]>([]);
let seq = 0;

export function useToasts() {
  return toasts;
}

export function showToast(text: string, type: ToastType = 'info', duration = 2600) {
  const id = ++seq;
  toasts.value.push({ id, type, text });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, duration);
}
