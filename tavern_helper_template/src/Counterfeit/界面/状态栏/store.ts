// Counterfeit · 状态栏数据入口（只读）
// 生产：优先读取"所在消息楼层"的 MVU 快照（type:'message' + 本楼层 message_id），
//   翻看历史楼层 / swipe / 重新生成时均跟随该楼层自己的快照；
//   楼层快照缺失（AI 首轮未输出变量更新块、楼层变量桶尚未建立）时临时回退聊天级基线，
//   楼层快照一旦出现即自动切回楼层——绝不固定绑定单一来源，也绝不写回任何变量。
// 预览：仅 ?mock=<场景> 时改用本地 mock 数据，绝不触碰 MVU。
// 说明：不使用 defineMvuDataStore——其变量源在 store 创建时永久固定且带 watch 写回，
//   对只读的状态栏既会锁死数据源又会污染基线变量。
import { Schema } from '../../schema';
import { getMockData, isMockMode } from './mock';

export interface StatusDataStore {
  data: Schema;
}

let live_store: StatusDataStore | null = null;
let mock_store: StatusDataStore | null = null;

/** 读取当前应展示的快照原文：楼层优先，楼层空桶回退聊天级基线；异常安全返回 {} */
function readStatSource(): Record<string, unknown> {
  try {
    const floor = getVariables({ type: 'message', message_id: getCurrentMessageId() });
    const stat = _.get(floor, 'stat_data');
    if (stat && Object.keys(stat).length > 0) {
      return stat;
    }
  } catch {
    /* getCurrentMessageId 仅在楼层 iframe 内可用，mock 预览时绝不求值 */
  }
  try {
    return _.get(getVariables({ type: 'chat' }), 'stat_data', {}) ?? {};
  } catch {
    return {};
  }
}

/** safeParse 容错：脏数据不炸界面，回退为全 prefault 占位 */
function parseSnapshot(source: Record<string, unknown>): Schema {
  const result = Schema.safeParse(source);
  return result.success ? result.data : Schema.parse({});
}

function useLiveStore(): StatusDataStore {
  if (!live_store) {
    const store = reactive({ data: parseSnapshot(readStatSource()) }) as StatusDataStore;
    useIntervalFn(() => {
      const next = parseSnapshot(readStatSource());
      if (!_.isEqual(store.data, next)) {
        store.data = next;
      }
    }, 2000);
    live_store = store;
  }
  return live_store;
}

export function useDataStore(): StatusDataStore {
  if (isMockMode()) {
    if (!mock_store) {
      mock_store = { data: reactive(getMockData()) };
    }
    return mock_store;
  }
  return useLiveStore();
}
