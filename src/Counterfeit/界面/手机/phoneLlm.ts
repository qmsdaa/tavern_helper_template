import { jsonrepair } from 'jsonrepair';
import { buildGenerateExtra, type LlmConfig } from './settings';

export type PhoneLlmTask =
  | 'direct_reply'
  | 'group_reply'
  | 'mainline_ingest'
  | 'context_digest'
  | 'proactive_message'
  | 'forum_batch'
  | 'contact_bio'
  | 'request_batch'
  | 'session_archive';

/** 字符串感知的括号平衡：从 text 中截取第一个完整 {...} 顶层对象，找不到返回 null */
function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJson<T>(text: string): T {
  const cleaned = String(text ?? '')
    .trim()
    // 预设注入的思考块：<!-- begin_of_Subtext_think -->…<!-- end_of_Subtext_think -->、<thinking>…</thinking>
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  // 先整体解析；失败则截取第一个顶层 JSON 对象再修（模型在 JSON 前后输出思考/寒暄的兜底）
  const candidates = [cleaned];
  const extracted = extractFirstJsonObject(cleaned);
  if (extracted && extracted !== cleaned) candidates.push(extracted);
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(jsonrepair(candidate)) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`手机助手 JSON 解析失败${cleaned ? `（前 200 字符：${cleaned.slice(0, 200)}）` : ''}：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function sleep(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`手机助手生成超时（${ms / 1000}s）`)), ms));
}

export async function callPhoneTask<T>(
  task: PhoneLlmTask,
  prompt: string,
  llm: LlmConfig,
): Promise<T> {
  if (typeof generateRaw !== 'function') {
    throw new Error('generateRaw 不可用');
  }
  const taskEnvelope = [
    `[Counterfeit 手机助手独立任务]`,
    `task=${task}`,
    '这是一次无状态、单任务调用。不得假定你记得其他私聊、群聊、论坛或先前调用；只能使用本次提示中明确提供的资料。',
    '严格遵守角色知情范围与参与者可见范围。不要修改关系变量、主线、结局或论坛之外的事实。',
    '只输出符合指定 JSON Schema 的 JSON 对象。不要输出 markdown 围栏、解释、思考过程或注释。',
    '再次提醒：只输出 JSON 对象本身，不要前后缀任何文字。',
    prompt,
  ].join('\n\n');
  // 关键：传 ordered_prompts:['user_input'] + max_chat_history:0，
  // 让 generateRaw 不再注入世界书/角色卡/预设/聊天历史 —— 否则整本都会跟着发出去，
  // 极易触发 max_tokens 截断导致 JSON 修复失败（论坛刷新失败 / 私聊回复报错的根因）。
  const requestId = `${task}:${Date.now().toString(36)}`;
  const rawOrTimeout = await Promise.race([
    generateRaw({
      user_input: taskEnvelope,
      should_silence: true,
      max_chat_history: 0,
      ordered_prompts: [{ role: 'user' as const, content: taskEnvelope }],
      generation_id: requestId,
      ...buildGenerateExtra(llm),
    } as Parameters<typeof generateRaw>[0]),
    sleep(180_000),
  ]);
  const text = typeof rawOrTimeout === 'string' ? rawOrTimeout : String(rawOrTimeout ?? '');
  return parseJson<T>(text);
}

