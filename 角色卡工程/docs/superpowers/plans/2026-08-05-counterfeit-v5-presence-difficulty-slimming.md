# Counterfeit v5 重构实施计划：在场门控 + 恋爱难度三档 + 约束瘦身

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ①四主角角色条目不再常驻、严格按在场触发（省 token）；②新增恋爱难度三档（简单+10/普通+3/困难+1，全模式生效）；③删除重复约束与日程重复数据，全卡瘦身。

**Architecture:** 门控全部走「内容级 `@@if` fail-closed 指令 + EJS 变量求值」既有架构（`build_tools/verify_ejs_condition_guards.mjs` 守卫，tripwire 173→177）。在场判断以 `characters.<规范全名>.present` 为唯一事实源；POV/free 四选一模式由开场白 commit 预建四主角全量记录 + 场景推进时按场景条目「POV适配·在场」置位，custom 模式用「记录未建档 → fail-open」覆盖首遇缺口。难度为 `stat_data.difficulty` 新变量（schema/initvar/EJS define/更新规则/攻略难度条目/开场白 UI 五处同步）。日程数据合并进「开放世界在场注入」单一条目，删 5 个日程文件。

**Tech Stack:** SillyTavern Tavern Card v3 · tavern-helper 提示词模板插件（@@if/EJS）· MVU + Zod 4 · Vue 3 + webpack（tavern_helper_template 工程）· Node.js（verify 脚本 + forge）· Python（前端重内嵌）

**关键约定：**
- 规范全名：`比企谷八幡`、`雪之下雪乃`、`由比滨结衣`、`拉芙希妮·都柏林`（MVU 记录键）
- 卡工程根：`cards/Counterfeit/`（下文相对路径均以此为基准，除非注明）
- 前端源码双份：`tavern_helper_template/src/...`（真工程，构建用）与 `cards/tavern_helper_template_src/...`（镜像，必须同步）
- 运行时 schema 三份同步：`schema.ts`（根）→ `tavern_helper_template_src/Counterfeit/schema.ts`（镜像）→ `脚本/Zod.txt`（打包副本）
- 用户已拍板：里程碑=事件增量×2 封顶15、负向同表；难度选择全模式出现；日程文件删除不留脏文件；在场门控采用「commit 预建 + 未建档 fail-open」方案

---

## 文件地图

| 文件 | 职责 | 任务 |
|---|---|---|
| `tavern-cards-state.json` | forge 状态（manifest，条目注册与 @@if） | T3/T4/T5/T6 |
| `世界书/变量/initvar.yaml` | MVU 初始变量（中性骨架） | T2 |
| `schema.ts`（根）+ `tavern_helper_template_src/Counterfeit/schema.ts` | zod schema 源 | T2 |
| `脚本/Zod.txt` | 运行时 schema（打包副本） | T2 |
| `世界书/MVU/更新规则.yaml` | 机制宪法：难度表/bond/romance/场景在场置位/初始关系表 | T3/T5 |
| `世界书/EJS预处理/EJS预处理.txt` | EJS 变量 define | T2 |
| `世界书/机制/攻略难度.yaml` | 恋爱难度三档条目（≤1800 字符·禁词守卫） | T4 |
| `世界书/扮演准则/扮演准则.yaml` | 权威扮演规则（瘦身+引用更新） | T4/T7 |
| `世界书/EJS预处理/玩家身份路由.txt` | 身份映射（瘦身去重） | T7 |
| `世界书/EJS预处理/POV分幕滤镜.txt` | 观察滤镜（瘦身去重） | T7 |
| `世界书/EJS预处理/开放世界在场注入.txt` | free 模式在场计算（吞并日程数据） | T6 |
| `世界书/角色/{四人}/基础信息.yaml·性格调色盘.yaml·三面性.yaml·二次解释.yaml` | 四主角人设（被门控对象，本体不动） | T3 |
| `世界书/角色/{五人}/日程.yaml` ×5 | 冗余日程（删除） | T6 |
| `build_tools/verify_ejs_condition_guards.mjs` | 门控守卫（tripwire 173→177 + 上下文） | T8 |
| `tavern_helper_template/src/Counterfeit/界面/开场白/{store.ts,copy.yaml,copy.ts,ModeSelect.vue}` + 镜像 | 开场白 UI：难度选择 + 全量预建 + 场景1在场 | T2/T5 |
| `.cardrc.json`（工作区根） | 发布物指认 | T9 |
| `docs/权威/README.md`（工作区根）、`AGENTS.md`、`memory/` | 文档同步 | T10 |

---

## Task 1: 基线备份

**Files:**
- Create: `backups/v5-presence-difficulty-before-20260805/`（目录）

- [ ] **Step 1: 复制基线文件**

```powershell
$dst = "backups\v5-presence-difficulty-before-20260805"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "tavern-cards-state.json" "$dst\" -Force
Copy-Item "schema.ts" "$dst\" -Force
Copy-Item "脚本\Zod.txt" "$dst\" -Force
Copy-Item "世界书\MVU\更新规则.yaml" "$dst\" -Force
Copy-Item "世界书\机制\攻略难度.yaml" "$dst\" -Force
Copy-Item "世界书\扮演准则\扮演准则.yaml" "$dst\" -Force
Copy-Item "世界书\EJS预处理\玩家身份路由.txt" "$dst\" -Force
Copy-Item "世界书\EJS预处理\POV分幕滤镜.txt" "$dst\" -Force
Copy-Item "世界书\EJS预处理\开放世界在场注入.txt" "$dst\" -Force
Copy-Item "世界书\变量\initvar.yaml" "$dst\" -Force
Get-ChildItem "世界书\角色" -Recurse -Filter "*.yaml" | Copy-Item -Destination $dst -Force
```

- [ ] **Step 2: 记录当前校验基线**

```powershell
node build_tools\verify_ejs_condition_guards.mjs; node build_tools\verify_romance_guide_split.mjs
```

Expected: 两条均输出 `verified` / `verified`（当前应为 173 与通过）。任何现有失败先解决再开工。

---

## Task 2: difficulty 变量贯通（schema → initvar → EJS define → 前端 store/UI）

**Files:**
- Modify: `schema.ts`（根）、`tavern_helper_template_src/Counterfeit/schema.ts`（镜像）
- Modify: `脚本/Zod.txt`
- Modify: `世界书/变量/initvar.yaml`
- Modify: `世界书/EJS预处理/EJS预处理.txt`
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/store.ts` + 镜像 `tavern_helper_template_src/Counterfeit/界面/开场白/store.ts`
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/copy.yaml` + 镜像
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/copy.ts` + 镜像
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/ModeSelect.vue` + 镜像

- [ ] **Step 1: schema.ts 两处加 difficulty**

在 `mode` / `current_pov` / `custom_protagonist` 三字段之后、`current_scene` 之前插入（两处 schema.ts 内容一致）：

```ts
  // ── 恋爱难度（开场白 commit 写入·仅开局可定）──
  difficulty: z.enum(['简单', '普通', '困难']).nullable().prefault(null),
```

- [ ] **Step 2: 重新生成 脚本/Zod.txt**

保留第 1 行 `import { registerMvuSchema } ...` 与文件尾 `$(() => { registerMvuSchema(Schema); });` 块，中间整体替换为新的 `schema.ts` 内容（删除 `export type Schema = ...` 行），UTF-8 无 BOM 写回。用 Python 精确拼接：

```python
import re, pathlib
root = pathlib.Path(r"cards/Counterfeit")
zod = root / "脚本/Zod.txt"
schema = (root / "schema.ts").read_text(encoding="utf-8")
schema_body = "\n".join(l for l in schema.splitlines() if not l.startswith("export type"))
text = zod.read_text(encoding="utf-8")
import_line, tail = text.split("\n", 1)
tail = tail[tail.index("$(() =>"):]
zod.write_text(import_line + "\n" + schema_body.rstrip() + "\n\n\n" + tail, encoding="utf-8", newline="\n")
```

验证：`python -c "import re; t=open(r'cards/Counterfeit/脚本/Zod.txt',encoding='utf-8').read(); print('difficulty' in t, t.count('$(() =>'))"` → `True 1`

- [ ] **Step 3: initvar.yaml 加中性字段**

`世界书/变量/initvar.yaml` 在 `mode: null` 之后加一行：

```yaml
difficulty: null
```

- [ ] **Step 4: EJS预处理.txt define**

`世界书/EJS预处理/EJS预处理.txt` 在 `define('mode', ...)` 行之前加：

```
define('difficulty', getvar('stat_data.difficulty', { defaults: null }));
```

- [ ] **Step 5: 开场白 store.ts 加难度状态与 commit**

`tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`（改完同步到 `tavern_helper_template_src/` 镜像）：

a) 在 `export type GameMode = 'story' | 'open';` 下加：

```ts
/** 恋爱难度：开局定档·commit 写入 stat_data.difficulty·全模式生效 */
export type DifficultyKey = '简单' | '普通' | '困难';
```

b) 在 `const selectedPov = ref<PovKey | null>(null);` 下加：

```ts
const difficulty = ref<DifficultyKey>('普通');
```

c) `summaryBlock` 的 pov 分支 opening_setup 行与 custom 分支 opening_setup 行各加属性：

```ts
`<opening_setup mode="${statMode}" pov="${info.key}" diff="${difficulty.value}" name="${escapeAttr(info.name)}">`,
```
```ts
`<opening_setup mode="${statMode}" diff="${difficulty.value}" name="${escapeAttr(form.name.trim())}">`,
```

d) `buildStat` 内 `stat.mode = ...` 行后加：

```ts
stat.difficulty = difficulty.value;
```

e) store 返回对象（`selectedPov,` 附近）加导出：

```ts
    difficulty,
```

- [ ] **Step 6: copy.yaml/copy.ts 加难度文案**

`tavern_helper_template/src/Counterfeit/界面/开场白/copy.yaml`（同步镜像）在 `modes:` 段之后插入：

```yaml
# ---------- 恋爱难度（全模式可选·仅开局定档） ----------
difficulty:
  简单:
    label: 简单
    desc: 事件羁绊+10 · 判定宽松 · 轻松体验剧情
  普通:
    label: 普通
    desc: 事件羁绊+3 · 标准判定 · 推荐
  困难:
    label: 困难
    desc: 事件羁绊+1 · 判定严格 · 慢热深水
```

`copy.ts`（同步镜像）加：

```ts
export interface DifficultyCopy {
  label: string;
  desc: string;
}

export type DifficultyKey = '简单' | '普通' | '困难';
export const DIFFICULTY_LIST: DifficultyKey[] = ['简单', '普通', '困难'];
export const DIFFICULTY_COPY = COPY.difficulty as Record<DifficultyKey, DifficultyCopy>;
```

并在 `interface CopyFile` 中加 `difficulty: Record<string, DifficultyCopy>;`。

- [ ] **Step 7: ModeSelect.vue 加难度选择行**

`tavern_helper_template/src/Counterfeit/界面/开场白/ModeSelect.vue`（同步镜像）：

a) `<template>` 中 `.game-mode-tabs` 与 `.plugin-warning` 之后、`.pov-grid` 之前插入：

```vue
    <div class="difficulty-row">
      <span class="diff-title">恋爱难度</span>
      <button
        v-for="d in DIFFICULTY_LIST"
        :key="d"
        class="diff-tab"
        :class="{ active: store.difficulty === d }"
        @click="store.difficulty = d"
      >
        <span class="diff-label">{{ DIFFICULTY_COPY[d].label }}</span>
        <span class="diff-desc">{{ DIFFICULTY_COPY[d].desc }}</span>
      </button>
    </div>
```

b) `<script setup>` 中 import 加：

```ts
import { DIFFICULTY_COPY, DIFFICULTY_LIST, MODE_COPY, POV_LIST } from './copy';
```

c) `<style scoped>` 追加：

```scss
.difficulty-row {
  width: 100%;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
}

.diff-title {
  font-size: 13px;
  color: var(--c-text-muted);
  letter-spacing: 2px;
  flex-shrink: 0;
}

.diff-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 6px 8px;
  border-radius: 9px;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &.active {
    border-color: var(--c-primary);
    box-shadow: 0 0 0 1px var(--c-primary);
  }

  &:hover {
    border-color: var(--c-primary);
  }
}

.diff-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text);
  letter-spacing: 1px;
}

.diff-desc {
  font-size: 10px;
  color: var(--c-text-muted);
  line-height: 1.4;
  text-align: center;
}
```

- [ ] **Step 8: 同步镜像目录**

将改动的 4 个前端文件从 `tavern_helper_template/src/Counterfeit/界面/开场白/` 复制到 `cards/tavern_helper_template_src/Counterfeit/界面/开场白/`（schema.ts 的镜像同步已在 Step 1 完成）。

验证：`git -C tavern_helper_template diff --stat` 应显示 4 个文件变更（构建在 T9 进行）。

---

## Task 3: 四主角在场门控（manifest 9+4 条 @@if）

**Files:**
- Modify: `tavern-cards-state.json`（`entryManifest.角色` 下 13 条目）

**门控公式（13 条统一模式，仅规范全名与 current_pov 键不同）：**

- 基础信息 / 性格调色盘 / 二次解释（9 条：`比企谷八幡_基础信息` `雪之下雪乃_基础信息` `由比滨结衣_基础信息` `拉芙希妮_基础信息` `比企谷八幡_性格调色盘` `雪之下雪乃_性格调色盘` `由比滨结衣_性格调色盘` `拉芙希妮_性格调色盘` `拉芙希妮_二次解释`）：

```
@@if typeof mode !== "undefined" && ((current_pov === "hachiman") || (typeof characters !== "undefined" && (!("比企谷八幡" in characters) || characters["比企谷八幡"].present === true)))
```

- 三面性（4 条：`比企谷八幡_三面性` 等；POV 剧本模式其余主角三面性永不加载=POV 锁）：

```
@@if typeof mode !== "undefined" && ((current_pov === "hachiman") || (mode !== "pov" && typeof characters !== "undefined" && (!("比企谷八幡" in characters) || characters["比企谷八幡"].present === true)))
```

按角色替换：`hachiman`→`比企谷八幡`、`yukino`→`雪之下雪乃`、`yui`→`由比滨结衣`、`laff`→`拉芙希妮·都柏林`。

**语义（写进本任务完成注释，供后续维护）：**
1. `current_pov === 本人`：POV 剧本 / free 四选一的玩家本人恒载（内心触发机制依赖三面性）。
2. 记录存在 → 严格 `present === true`。
3. 记录未建档 → fail-open（首遇/初见覆盖；custom 模式在首遇前与旧行为一致）。
4. `mode === "pov"` 时非本人三面性恒不载（POV 锁语义强化）。
5. 首次导入（MVU 未初始化）→ `typeof mode !== "undefined"` 为 false → fail-closed。

- [ ] **Step 1: 写 Python 补丁脚本并执行**

`C:\Users\1\AppData\Local\Temp\opencode\apply_presence_gates.py`：

```python
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
PATH = r'D:\由我们所书\我的青春恋爱物语果然有问题 Counterfeit\cards\Counterfeit\tavern-cards-state.json'
with open(PATH, encoding='utf-8') as f:
    data = json.load(f)
role = data['entryManifest']['角色']
spec = {
    '比企谷八幡': ('hachiman', ['基础信息', '性格调色盘', '三面性']),
    '雪之下雪乃': ('yukino', ['基础信息', '性格调色盘', '三面性']),
    '由比滨结衣': ('yui', ['基础信息', '性格调色盘', '三面性']),
    '拉芙希妮·都柏林': ('laff', ['基础信息', '性格调色盘', '三面性', '二次解释']),
}
POV = {'hachiman': '比企谷八幡', 'yukino': '雪之下雪乃', 'yui': '由比滨结衣', 'laff': '拉芙希妮·都柏林'}
for name, (key, parts) in spec.items():
    for part in parts:
        entry_name = f'{name}_{part}'
        entry = role[entry_name]
        tri = part == '三面性'
        cond = f'@@if typeof mode !== "undefined" && ((current_pov === "{key}") || ({"mode !== "pov" && " if tri else ""}typeof characters !== "undefined" && (!("{name}" in characters) || characters["{name}"].present === true)))'
        contents = entry['contents']
        if contents and contents[0].get('content', '').startswith('@@if'):
            contents[0] = {'content': cond}
        else:
            contents.insert(0, {'content': cond})
        print('gated', entry_name)
with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('done')
```

执行：`python C:\Users\1\AppData\Local\Temp\opencode\apply_presence_gates.py` → 应打印 13 行 `gated ...`。

- [ ] **Step 2: 抽查门控落位**

用 Python 打印 5 条样本（拉芙三面性/雪乃基础信息/八幡调色盘/结衣三面性/拉芙二次解释）的 `contents[0].content`，人工核对公式与角色键。

---

## Task 4: 攻略难度.yaml 重写（三档表）

**Files:**
- Modify: `世界书/机制/攻略难度.yaml`（整文件替换）
- Modify: `世界书/扮演准则/扮演准则.yaml`（攻略层引用行）

- [ ] **Step 1: 整文件替换 攻略难度.yaml**

```yaml
<%_
const guideMode = getvar('stat_data.mode', { defaults: null });
const guideDiff = getvar('stat_data.difficulty', { defaults: null });
const diff = guideDiff || '普通';
_%>
<%_ if (guideMode === 'free' || guideMode === 'pov' || guideMode === 'custom') { _%>
恋爱难度（开场白选定·stat_data.difficulty·仅开局定档·缺失按普通）:
  简单: 单次有效互动+10·重大里程碑+15·判定宽松——日常关怀、主动陪伴、明显在意即计
  普通: 单次有效互动+3·重大里程碑+6·只计该角色实际感知的显著互动
  困难: 单次有效互动+1·重大里程碑+2·判定吝啬——普通寒暄、同场、礼貌回应、初见好奇一律不加值
  通用: 负向证据按同表扣减·重复刷同类不累计·AI把数值阶段转译为可观察的语言、距离、主动性与破例行为·正文不报数值
  判定: 各角色有效互动/负面证据/commitment翻转见其性格调色盘"角色关系判定"段·难度只改数值速度与判定宽严·不改阶段阈值、romance证据门槛与commitment规则
  边界: 多线并行时各角色只根据自己实际感知的事实反应·本条目与MVU更新规则冲突时以更新规则为准
<%_ } _%>
```

- [ ] **Step 2: 扮演准则 攻略层引用更新**

`世界书/扮演准则/扮演准则.yaml` 第 20 行（游玩态②·攻略层）改为：

```yaml
     攻略层: 恋爱难度与关系数值见"机制/攻略难度.yaml"三档表·具体角色判定见其调色盘"角色关系判定"段·数值增减铁律以更新规则为准·AI 不在正文报数值
```

- [ ] **Step 3: 守卫回归**

```powershell
node build_tools\verify_romance_guide_split.mjs
```

Expected: `Romance guide split verified: common=...chars, targets=14`（common ≤1800；禁词 羁绊线/永久锁/romance恒0/血缘锁/毕业前锁/不可翻转恋人/恋爱线开放/上限40 未命中；14 目标文件 `角色关系判定:` 保留）。

---

## Task 5: 更新规则（难度表 + 场景在场置位 + 初始关系表四主角全量预建）

**Files:**
- Modify: `世界书/MVU/更新规则.yaml`
- Modify: `tavern_helper_template/src/Counterfeit/界面/开场白/store.ts` + 镜像（INITIAL_RELATIONS / SCENE1_PRESENT）

- [ ] **Step 1: 更新规则 加 difficulty 段**

在 `custom_protagonist:` 段之后、`current_scene:` 段之前插入：

```yaml
  difficulty:
    check:
      - 仅开场白 commit 写入（简单|普通|困难）·存档内不变·开局定档
      - 旧存档缺失或为 null 时按普通处理
```

- [ ] **Step 2: 更新规则 current_scene 加「场景在场置位」**

`current_scene:` 段中「每次生成结束时…判断是否推进」之后、`场景仍有待玩家回应的…保持不变` 之前插入一条：

```yaml
      - 推进至新场景时·同步按新场景条目的"POV适配"在场标记置位四主角 present：在场: true 的已建档角色置 true（尚未建档的四主角记录此时按 record_creation 建档并置 true）·其余角色不动；同场景内的进出仍按 present 原规则逐楼维护
```

- [ ] **Step 3: 更新规则 bond 改难度表**

`characters.${规范全名}.relationship.bond:` 的 check 列表整体替换为：

```yaml
    check:
      - 表示熟悉、信任与情感亲近的综合程度，不等于恋爱
      - 只有本楼发生被该角色实际感知的显著互助、坦诚、守约、伤害、背叛或关系修复时才更新：difficulty=简单 +10·普通 +3·困难 +1（difficulty 缺失按普通）
      - 重大且不可替代的关系里程碑=事件增量×2 封顶15（简单+15·普通+6·困难+2）
      - 负向证据按同一难度表扣减·普通寒暄、同场、加好友、聊天次数、礼貌回应或重复刷同类互动不更新
      - 变化必须能在Analysis中指出本楼的具体关系证据
```

- [ ] **Step 4: 更新规则 romance 改难度表**

`characters.${规范全名}.relationship.romance:` 的 check 列表整体替换为：

```yaml
    check:
      - 表示该角色与玩家之间已经显现的恋爱倾向，与bond独立
      - 仅明确的暧昧试探、吃醋、告白倾向、约会语境、亲密边界变化或被双方感知的浪漫里程碑才按难度表更新：difficulty=简单 +10·普通 +3·困难 +1（difficulty 缺失按普通）·重大确认=事件增量×2 封顶15
      - 负向证据按同一难度表扣减·友情、照顾、依赖、信任、外貌描写或玩家单方面想象不得自动增加
      - commitment=仅朋友时不得因普通亲密增加；只有角色明确重新打开恋爱可能性后才可调整
```

- [ ] **Step 5: 更新规则 初始关系表 扩展四主角全量预建**

`初始关系表` 段的 check 列表整体替换为：

```yaml
    check:
      - 本表数值已在开局写入变量·AI 无需也不得以本表重建记录；表内角色登场时仅将 present 置 true·不得重置数值
      - 预建名单：四主角全量预建（含跨POV未列出的角色：拉芙希妮对全部POV均开局初见·恒 bond=0/romance=0/known=false·其记录同样预建）·其余角色按各POV既有名单：
        pov=八幡→雪乃/结衣/小町/户冢/平冢/三浦/海老名/川崎；pov=雪乃→八幡/结衣/阳乃/平冢/拉芙希妮；pov=结衣→八幡/雪乃/三浦/海老名/户冢/川崎/小町/平冢；pov=拉芙→爱布拉娜/雪乃/八幡/结衣（后三人 bond=0/romance=0/known=false）
      - 场景1在场预置：yukinoPOV 拉芙希妮 present=true·laffPOV 雪乃 present=true（由开场白 commit 写入）
      - 表外角色按默认起步（bond=0·romance=0·known按原规则）；一色、爱布拉娜（非拉芙POV）、鹤见留美等有意不入表·按初见处理
      - 拉芙希妮对所有POV均为开局当日初见的转学生·恒 bond=0/romance=0/known=false；雪乃POV不例外——初见的注意、好奇与相似感只记录为known/bond变化或叙事备注，不构成romance证据；romance从0起步，仅由此后双方可感知的恋爱互动累积
      - 初始值是起点不是保底·可增可减；free+自建模式无预建行·全部按默认起步
```

- [ ] **Step 6: store.ts 初始关系表与场景1在场预置**

`tavern_helper_template/src/Counterfeit/界面/开场白/store.ts`（同步镜像）：

a) `INITIAL_RELATIONS.hachiman` 末尾加：

```ts
    拉芙希妮·都柏林: { display: '拉芙希妮', bond: 0, romance: 0, known: false },
```

b) `INITIAL_RELATIONS.yui` 末尾加：

```ts
    拉芙希妮·都柏林: { display: '拉芙希妮', bond: 0, romance: 0, known: false },
```

c) `INITIAL_RELATIONS.laff` 替换为：

```ts
  laff: {
    爱布拉娜: { display: '爱布拉娜', bond: 70, romance: 25, known: true },
    雪之下雪乃: { display: '雪乃', bond: 0, romance: 0, known: false },
    比企谷八幡: { display: '八幡', bond: 0, romance: 0, known: false },
    由比滨结衣: { display: '结衣', bond: 0, romance: 0, known: false },
  },
```

d) `INITIAL_RELATIONS` 定义之后加：

```ts
/** 场景1在场预置（与更新规则"初始关系表"同步）：POV 剧本模式开局即与玩家同教室的角色 */
const SCENE1_PRESENT: Partial<Record<PovKey, string[]>> = {
  yukino: ['拉芙希妮·都柏林'],
  laff: ['雪之下雪乃'],
};
```

e) `buildStat` 中 `stat.characters = ...` 行之后加：

```ts
            if (isPov && selectedPov.value) {
              for (const n of SCENE1_PRESENT[selectedPov.value] ?? []) {
                if (stat.characters[n]) stat.characters[n].present = true;
              }
            }
```

- [ ] **Step 7: 守卫回归**

```powershell
node build_tools\verify_ejs_condition_guards.mjs
```

Expected: 暂时仍为 173 通过（T8 改守卫后变 177）。YAML 键无删改，其余校验不受影响。

---

## Task 6: 日程合并（在场注入吞并 + 删 5 文件）

**Files:**
- Modify: `世界书/EJS预处理/开放世界在场注入.txt`
- Delete: `世界书/角色/比企谷八幡/日程.yaml`、`世界书/角色/雪之下雪乃/日程.yaml`、`世界书/角色/由比滨结衣/日程.yaml`、`世界书/角色/拉芙希妮/日程.yaml`、`世界书/角色/一色彩羽/日程.yaml`
- Modify: `tavern-cards-state.json`（删 uid 222-226）

- [ ] **Step 1: 在场注入加撞见锚点与天气联动**

`世界书/EJS预处理/开放世界在场注入.txt`：

a) `owSchedule` 对象定义之后加两个常量：

```js
const owAnchors = {
  '比企谷八幡': '撞见锚点：河岸自动贩卖机（放学路）·校门口车棚（早晨压线）·书店（周末下午）',
  '雪之下雪乃': '撞见锚点：奉仕部教室（放课后）·公寓楼下超市（傍晚采购）·图书馆（午休/周末）',
  '由比滨结衣': '撞见锚点：河岸遛狗路线（早晨/傍晚）·奉仕部教室（放课后）·车站前（周末下午）',
  '拉芙希妮·都柏林': '撞见锚点：海侧散步道（早晨/傍晚）·图书馆外文区（午休/周末）·书店外文区（周末）',
  '一色彩羽': '撞见锚点：足球场（放课后部活）·中庭（午休）·车站前（傍晚）',
};
const owWeather = {
  '比企谷八幡': '雨:电车通勤·心情低·酷暑:室外活动压缩',
  '雪之下雪乃': '雨:车内通勤·酷暑:户外段缩短',
  '由比滨结衣': '雨:遛狗改短线·酷暑:点心练习改晚间',
  '拉芙希妮·都柏林': '雨:海侧散步取消·酷暑:窗帘全天合拢',
  '一色彩羽': '雨:改室内社交·酷暑:防晒流程加长',
};
```

b) `owLines` 构建循环改为附带锚点：

```js
  for (const name of Object.keys(owSchedule)) {
    if (name === owPovName) continue;
    const act = (owSchedule[name][owBucket] || {})[owEffectiveSlot];
    const anchor = owAnchors[name];
    if (act) owLines.push('- ' + name + ': ' + act + (anchor ? '（' + anchor + '）' : ''));
  }
```

c) 输出块末尾（`</open_world_presence>` 之前）加天气联动行：

```
天气联动（正文设定天气后按此调整日常）：<%- Object.entries(owWeather).filter(([n]) => n !== owPovName).map(([n, w]) => n + '·' + w).join(' / ') %>
```

- [ ] **Step 2: 删 5 个日程文件与 manifest 条目**

```powershell
Remove-Item "世界书\角色\比企谷八幡\日程.yaml","世界书\角色\雪之下雪乃\日程.yaml","世界书\角色\由比滨结衣\日程.yaml","世界书\角色\拉芙希妮\日程.yaml","世界书\角色\一色彩羽\日程.yaml" -Force
```

Python 删 manifest：`entryManifest['角色']` 中删除键 `比企谷八幡_日程` `雪之下雪乃_日程` `由比滨结衣_日程` `拉芙希妮_日程` `一色彩羽_日程`（uid 222-226），写回（ensure_ascii=False, indent=1）。

验证：`python -c "import json; d=json.load(open(r'tavern-cards-state.json',encoding='utf-8')); print(sum(1 for v in d['entryManifest'].values() for _ in v))"` → `224`（229-5）。

- [ ] **Step 3: 守卫临时检查**

```powershell
node build_tools\verify_ejs_condition_guards.mjs
```

Expected: 此时会因 tripwire（173 vs 实际 168）失败——属预期，T8 统一更新。

---

## Task 7: 约束瘦身（重复 POV 锁/内心机制文本）

**Files:**
- Modify: `世界书/EJS预处理/玩家身份路由.txt`
- Modify: `世界书/EJS预处理/POV分幕滤镜.txt`
- Modify: `世界书/扮演准则/扮演准则.yaml`（禁则与称呼规范去重）

- [ ] **Step 1: 玩家身份路由 瘦身**

`世界书/EJS预处理/玩家身份路由.txt` 的 pov 分支内，删除第 19 行「视点锁定」整段长文，替换为：

```
视点锁定: 与"扮演准则"运行时POV锁一致——<%- playerPovNames[playerPov] %>是唯一视点主角·叙事镜头只贴在其观察范围与内心层·其余角色仅呈现可观察的外部言行·禁写其内心·其完整内心线属多周目真相
```

同时删除第 21 行「内心层」段的「只在该角色三面性"触发条件"命中时出现，未命中时靠外部细节承载」重复说明（该机制权威在扮演准则·内心触发机制段），保留身份/人称/叙事分工部分。

- [ ] **Step 2: POV分幕滤镜 瘦身**

`世界书/EJS预处理/POV分幕滤镜.txt` 第 20 行「镜头纪律」段替换为：

```
镜头纪律: 滤镜决定当前POV角色能感知到什么·内心按其三面性"触发条件"命中时写·未命中靠外部细节承载；非<user>角色只呈现可观察的外部言行·禁写其内心。完整POV锁/内心触发机制见"扮演准则"。
```

- [ ] **Step 3: 扮演准则 禁则与称呼规范去重**

`世界书/扮演准则/扮演准则.yaml`：

a) 禁则第 6 条 `'"苇草"称呼=拉芙主动授予的关系物证·场景134授权·仅及雪乃一人（可用但非必须用·节制使用）；八幡始终称"都柏林"·结衣始终称"拉芙希妮酱"·教师不变·任何人不得自行改用"苇草"'` 替换为：

```
  - '"苇草"=拉芙主动授予·场景134起仅雪乃可用（节制）·称呼权限全表见下方"角色称呼规范"·不得自行改用'
```

b) 「角色称呼规范」段的拉芙行保留原样（已是唯一权威全表）。

- [ ] **Step 4: 回归校验**

```powershell
node build_tools\verify_ejs_condition_guards.mjs  # 预期仍失败于 tripwire（T8 更新）
```

并全文搜索确认无残留「不得借内心泄漏隐藏信息」等被删句子的悬空引用（`grep "内心触发机制" 世界书/EJS预处理/` 应仍命中扮演准则引用句）。

---

## Task 8: verify 守卫脚本更新（tripwire 173→177 + 在场上下文）

**Files:**
- Modify: `build_tools/verify_ejs_condition_guards.mjs`

- [ ] **Step 1: tripwire 更新**

第 29-38 行替换为：

```js
// 门控总数 tripwire：改动门控数量时必须同步这里，防止误增/误删条目门控。
// 当前构成 177 = 150 场景条目（mode==="pov" && current_scene===N）
//             + 8  仅剧本模式（还火事件·伦敦据点·家族势力·爱布拉娜基础信息·NPC 四人）
//             + 1  还火真相（pov+laff+场景阈值）
//             + 1  爱布拉娜调色盘（pov || free）
//             + 1  爱布拉娜三面性（pov && current_pov==="laff"）
//             + 4  四主角三面性（POV锁+在场：current_pov===本人 或 非pov且在场/未建档）
//             + 3  配角三面性（开放世界专用：mode!=="pov"）
//             + 9  四主角基础信息/性格调色盘/拉芙二次解释（在场门控：current_pov===本人 或 在场/未建档）
assert.equal(conditions.length, 177, 'unexpected state-level @@if condition count');
```

- [ ] **Step 2: RUNTIME_CONTEXTS 加在场变量**

第 42-49 行替换为：

```js
// 运行时可能出现的规范上下文。每个门控至少要在其中之一为真，
// 否则它是一个永不激活的死条目。
// characters 模拟四主角记录：pov 上下文全员 present=false（验证 POV 本人恒载、其余禁载），
// free/custom 上下文全员 present=true（验证在场分支可激活）。
const ALL_CHARS = ['比企谷八幡', '雪之下雪乃', '由比滨结衣', '拉芙希妮·都柏林'];
const ctxChars = (presentList) =>
  Object.fromEntries(ALL_CHARS.map((n) => [n, { present: presentList.includes(n) }]));
const RUNTIME_CONTEXTS = [
  { label: 'pov/laff', vars: { mode: 'pov', current_pov: 'laff', characters: ctxChars([]) } },
  { label: 'pov/yukino', vars: { mode: 'pov', current_pov: 'yukino', characters: ctxChars([]) } },
  { label: 'pov/hachiman', vars: { mode: 'pov', current_pov: 'hachiman', characters: ctxChars([]) } },
  { label: 'pov/yui', vars: { mode: 'pov', current_pov: 'yui', characters: ctxChars([]) } },
  { label: 'free', vars: { mode: 'free', characters: ctxChars(ALL_CHARS) } },
  { label: 'custom', vars: { mode: 'custom', characters: ctxChars(ALL_CHARS) } },
];
```

- [ ] **Step 3: 全量守卫回归**

```powershell
node build_tools\verify_ejs_condition_guards.mjs
```

Expected: `EJS condition guards verified: 177`。同时跑 `node build_tools\verify_romance_guide_split.mjs` 与 `node build_tools\verify_scene_fields.mjs` 确认无回归。

---

## Task 9: 前端构建 + 重内嵌 + 全量校验 + 打包发布

**Files:**
- Build: `tavern_helper_template`（webpack.opening.config.ts）
- Modify: `脚本/开场白挂载.js`（由 pack_embedded_frontends.py 重写）
- Create: 新发布卡 PNG + 更新 `.cardrc.json` artifact

- [ ] **Step 1: 构建开场白前端**

```powershell
cd D:\由我们所书\我的青春恋爱物语果然有问题 Counterfeit\tavern_helper_template
npx webpack --config webpack.opening.config.ts --mode production
```

Expected: 构建成功、dist 出现（`dist/Counterfeit/界面/开场白/index.html`），输出含 difficulty 字样。

- [ ] **Step 2: 重内嵌前端**

```powershell
cd D:\由我们所书\我的青春恋爱物语果然有问题 Counterfeit\cards\Counterfeit
python build_tools\pack_embedded_frontends.py
node build_tools\verify_embedded_frontends.mjs
node build_tools\test_opening_mounter.mjs
```

Expected: 三条均通过；`脚本/开场白挂载.js` 已含新 dist。

- [ ] **Step 3: 全量校验**

```powershell
node build_tools\verify_ejs_condition_guards.mjs   # 177
node build_tools\verify_romance_guide_split.mjs    # common ≤1800·14 targets
node build_tools\verify_scene_fields.mjs           # 150 场字段
node C:\Users\1\.claude\skills\tavern-cards\scripts\tavern-cards-forge.mjs validate-mvu Counterfeit
```

- [ ] **Step 4: 临时打包抽查**

```powershell
node C:\Users\1\.claude\skills\tavern-cards\scripts\tavern-cards-forge.mjs pack Counterfeit --output D:\tmp\Counterfeit-v5-check.png
```

解包抽查：`unpack` 到临时目录，确认 ①四主角条目 contents[0] 带新 @@if ②`difficulty` 出现在 Zod.txt/schema ③无日程条目 ④开场白挂载.js 含「恋爱难度」。

- [ ] **Step 5: 正式发布**

版本号（用户已确认）：**v0.5.0-preview**（功能更新未完，暂不转正）。

```powershell
node C:\Users\1\.claude\skills\tavern-cards\scripts\tavern-cards-forge.mjs pack Counterfeit --output "Counterfeit-v0.5.0-preview-20260805.png"
```

更新工作区根 `.cardrc.json` 的 `projects.Counterfeit.artifact` 指向新文件名；旧 PNG 移入 `cards/Counterfeit/archive/`。

---

## Task 10: 文档同步

**Files:**
- Modify: `AGENTS.md`（工作区根）
- Modify: `docs/权威/README.md`（工作区根，按该文档自身「更新规则」同步）
- Modify: `memory/v5-planning.md`

- [ ] **Step 1: AGENTS.md 更新**
- 卡版本：`v0.4.6` → 新版本号与导出卡文件名；发布物整理条目追加本次改动摘要。
- 「运行时条目门控」段：门控总数 173→177；门控构成补「四主角基础信息/性格调色盘/拉芙二次解释=在场门控」「三面性=POV锁+在场」。
- 「当前进度」：世界书条目 229→224；补「恋爱难度三档（stat_data.difficulty·简单+10/普通+3/困难+1·全模式）」；补「日程条目已并入开放世界在场注入」。
- 开场白段：模式选择屏含恋爱难度三选一。

- [ ] **Step 2: docs/权威/README.md 同步**
按权威文件自身规则更新任务→文件映射与条目清单（重点：新增 difficulty 变量链路、13 条门控变更、5 条日程删除）。

- [ ] **Step 3: memory/v5-planning.md 更新**
新增「E 档 · 已完成（2026-08-05）」小节：在场门控（省 token 量以实测为准，预计典型场景省 5-10k tok/轮）、难度三档、约束瘦身、日程合并；B2 常驻池瘦身项标记完成。

- [ ] **Step 4: 终验**

```powershell
node build_tools\verify_ejs_condition_guards.mjs; node build_tools\verify_romance_guide_split.mjs
```

Expected: `177` 与 `verified`。

---

## 自检

**Spec 覆盖：**
- ① 在场门控 → T3（13 条 @@if）+ T5（commit 预建/场景在场置位）+ T2（schema 贯通）✓
- ② 难度三档 → T2（变量+UI）+ T4（条目）+ T5（更新规则表）✓（用户确认：里程碑×2 封顶15、负向同表、全模式出现）
- ③ 约束瘦身 → T7（身份路由/分幕滤镜/禁则）+ T4（攻略难度去重）+ T6（日程合并）✓
- 日程文件删除（不留脏文件）→ T6 ✓
- 校验与打包 → T8/T9 ✓；文档 → T10 ✓

**已知边界（写入完成报告）：**
- custom 模式在玩家首遇某主角前，其条目仍按关键词触发（记录未建档 fail-open）——与旧行为一致，无回归。
- POV 模式场景切换后新主角登场的首楼：由「场景推进在场置位」规则覆盖；若主 AI 漏执行置位，首楼可能缺该角色条目（角色一览+场景条目兜底）。
- 简单模式 +10 可能快速触顶 bond=100，属设计意图（速度差异）。
