// 自动保存状态机 —— 纯逻辑，无 Vue 依赖，可在 node:test 中直接测试。
// persistPhone 的可观察保存结果：idle / saving / saved / error + lastSavedAt + lastError。
// 串行化：并发调用排队，不互相打断；每次保存使用调用时捕获的 payload 快照。

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveTracker<T> {
  readonly state: SaveState;
  readonly lastSavedAt: number | null;
  readonly lastError: string | null;
  /** 保存 payload；返回 'saved' 或 'error'（不抛异常） */
  save: (payload: T) => Promise<'saved' | 'error'>;
  /** 手动复位为 idle（界面隐藏提示时调用） */
  reset: () => void;
}

export function createSaveTracker<T>(
  write: (payload: T) => Promise<void> | void,
  options: { now?: () => number } = {},
): SaveTracker<T> {
  const now = options.now ?? (() => Date.now());
  let state: SaveState = 'idle';
  let lastSavedAt: number | null = null;
  let lastError: string | null = null;
  let chain: Promise<void> = Promise.resolve();

  return {
    get state() {
      return state;
    },
    get lastSavedAt() {
      return lastSavedAt;
    },
    get lastError() {
      return lastError;
    },
    async save(payload: T) {
      state = 'saving';
      const run = chain.then(async () => {
        try {
          await write(payload);
          state = 'saved';
          lastSavedAt = now();
          lastError = null;
        } catch (error) {
          state = 'error';
          lastError = error instanceof Error ? error.message : String(error);
          console.warn('[手机·存档] 自动保存失败', error);
        }
      });
      chain = run.catch(() => undefined);
      await run;
      return state === 'saved' ? 'saved' : 'error';
    },
    reset() {
      state = 'idle';
    },
  };
}
