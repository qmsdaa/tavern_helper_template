// 主线桥（事件总线）挂载工厂 —— 纯逻辑，无 Vue/酒馆全局依赖，可在 node:test 中直接测试。
// 修复点：
//   ① 手机脚本初始化后自动挂载（不要求玩家先打开一次手机界面）；
//   ② API（eventOn/tavern_events）尚未就绪时有界重试，绝不无限重试；
//   ③ armed 标志保证事件只注册一次，重复调用不产生重复监听。

export interface BridgeEvent {
  /** 酒馆事件名（MESSAGE_SENT 等），由环境提供 */
  name: string;
}

export interface MainlineBridgeHandlers {
  onMessageSent: (messageId: number) => void;
  onMessageReceived: (messageId: number, type?: string) => void;
  onMessageEdited: (messageId: number) => void;
  onMessageSwiped: (messageId: number) => void;
  onMessageDeleted: (messageId: number) => void;
  onMvuUpdateEnded: () => void;
  onChatChanged: () => void;
}

export interface MainlineBridgeEnv {
  /** 每次尝试时实时读取 eventOn（API 注入晚于脚本初始化时也能拿到） */
  getEventOn: () => ((event: string, handler: (messageId: number, type?: string) => void) => unknown) | undefined;
  /** 每次尝试时实时读取 tavern_events 常量表 */
  getTavernEvents: () => Record<string, string> | undefined;
  /** API 就绪判定（默认：eventOn 与 tavern_events 都可用） */
  isApiReady?: () => boolean;
  /** 调度一次重试（返回句柄） */
  schedule: (fn: () => void, delayMs: number) => unknown;
  /** 取消一次已调度的重试 */
  cancel: (handle: unknown) => void;
  /** 有界重试次数（默认 30 次 × 3s = 90s） */
  maxAttempts?: number;
  /** 重试间隔（默认 3000ms） */
  retryDelayMs?: number;
}

export interface MainlineBridge {
  /** 挂载（幂等）：API 未就绪时进入有界重试 */
  arm: () => void;
  /** 是否已完成注册 */
  isArmed: () => boolean;
  /** 当前已消耗的重试次数（测试可观察） */
  retryCount: () => number;
  /** 当前是否仍在等待重试 */
  isWaiting: () => boolean;
  /** 取消未完成的重试并释放状态（聊天切换/页面卸载时调用） */
  dispose: () => void;
}

const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_RETRY_DELAY_MS = 3000;

export function createMainlineBridge(env: MainlineBridgeEnv, handlers: MainlineBridgeHandlers): MainlineBridge {
  const maxAttempts = env.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = env.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let armed = false;
  let retries = 0;
  let pending: unknown = null;
  let disposed = false;

  const isReady = () => {
    if (env.isApiReady) return env.isApiReady();
    return typeof env.getEventOn() === 'function' && typeof env.getTavernEvents() === 'object' && env.getTavernEvents() !== null;
  };

  const register = (): boolean => {
    const eventOn = env.getEventOn();
    const events = env.getTavernEvents();
    if (!eventOn || !events) return false;
    try {
      eventOn(events.MESSAGE_SENT, messageId => handlers.onMessageSent(Number(messageId)));
      eventOn(events.MESSAGE_RECEIVED, (messageId, type) => handlers.onMessageReceived(Number(messageId), type));
      eventOn(events.MESSAGE_EDITED, messageId => handlers.onMessageEdited(Number(messageId)));
      eventOn(events.MESSAGE_SWIPED, messageId => handlers.onMessageSwiped(Number(messageId)));
      eventOn(events.MESSAGE_DELETED, messageId => handlers.onMessageDeleted(Number(messageId)));
      eventOn('mag_variable_update_ended', () => handlers.onMvuUpdateEnded());
      eventOn(events.CHAT_CHANGED, () => handlers.onChatChanged());
      armed = true;
      return true;
    } catch {
      // 注册途中抛错视为未挂载，走重试
      return false;
    }
  };

  const scheduleRetry = () => {
    if (disposed || pending !== null) return;
    retries += 1;
    pending = env.schedule(() => {
      pending = null;
      if (disposed || armed) return;
      if (register()) {
        return;
      }
      if (retries < maxAttempts) {
        scheduleRetry();
      } else {
        console.warn(`[手机·主线桥] API 长时间未就绪，已停止重试（${maxAttempts} 次）`);
      }
    }, retryDelayMs);
  };

  return {
    arm() {
      if (disposed) return;
      if (armed) return; // 幂等：绝不重复注册
      if (isReady() && register()) {
        console.info('[手机·主线桥] 已挂载');
        return;
      }
      scheduleRetry();
    },
    isArmed: () => armed,
    retryCount: () => retries,
    isWaiting: () => pending !== null,
    dispose() {
      disposed = true;
      if (pending !== null) {
        env.cancel(pending);
        pending = null;
      }
    },
  };
}
