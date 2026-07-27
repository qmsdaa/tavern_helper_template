// Counterfeit · 状态栏数据入口
// 生产：读取"所在消息楼层"的 MVU 快照（type:'message' + 本楼层 message_id），
//   翻看历史楼层 / swipe / 重新生成时均跟随该楼层自己的快照；状态栏自身不发起任何变量更新。
// 预览：仅 ?mock=<场景> 时改用本地 mock 数据，绝不触碰 MVU。
// 两种来源统一暴露 { data: Schema }（pinia store 与 reactive 对象都按属性访问即得解包后的响应式数据）。
import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';
import { getMockData, isMockMode } from './mock';

export interface StatusDataStore {
  data: Schema;
}

type MvuStoreDefinition = ReturnType<typeof defineMvuDataStore<typeof Schema>>;

let mvu_store: MvuStoreDefinition | null = null;
let mock_store: StatusDataStore | null = null;

function useMvuStore(): StatusDataStore {
  // 惰性创建：getCurrentMessageId() 仅在楼层 iframe 内可用，mock 预览时绝不求值
  if (!mvu_store) {
    mvu_store = defineMvuDataStore<typeof Schema>(Schema, { type: 'message', message_id: getCurrentMessageId() });
  }
  return mvu_store();
}

export function useDataStore(): StatusDataStore {
  if (isMockMode()) {
    if (!mock_store) {
      mock_store = { data: reactive(getMockData()) };
    }
    return mock_store;
  }
  return useMvuStore();
}
