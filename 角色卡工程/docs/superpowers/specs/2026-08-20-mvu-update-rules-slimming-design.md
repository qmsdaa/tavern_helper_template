# MVU 更新规则瘦身设计

## 目标

在不改变 Counterfeit 既有变量语义、剧情门控和存档兼容性的前提下，降低 `[mvu_update]变量更新规则` 每轮常驻提示词体积，并修复角色卡运行时 Schema 与前端 Schema 的 `custom_protagonist.participation` 漂移。

## 现状

- `世界书/MVU/更新规则.yaml` 为 constant system 条目，源文件 353 行、15,323 字符。
- 条目同时承载开局 commit 文档、不可变字段说明、主线推进、DLC 身份、自由世界、角色关系、成长旗标、Ω/九锤和尾声菜单规则。
- 所有战役、模式和 POV 每轮都收到全部规则。
- `角色卡工程/schema.ts` 与 `脚本/Zod.txt` 缺少 `participation`，而前端 Schema 和 EJS 路由依赖该字段。

## 方案

采用平衡压缩方案：保留一个注册条目和一个源文件，通过 EJS 段落控制只渲染当前存档需要的规则，同时压缩常驻核心。此次不新增运行时自动更新脚本，避免扩大存档迁移和事件时序风险。

### 常驻核心

常驻内容只包含：证据边界、不可写容器、角色规范全名、关系难度表、世界/玩家自由语义、动态角色建档、present/known、关系、记忆和穿搭规则。

移除由开场脚本独占管理的开局 commit 说明、初始关系表和不可变字段逐项规则。输出格式继续禁止更新未列出的字段，运行时已有身份补丁清洗逻辑继续兜底。

### 条件规则

- 主线剧本块：仅 `campaign_id=main` 且 `mode=pov`，或剧情自建具有 `participation.track` 时渲染；包含 `current_scene`、主线完成和剧本日期同步。
- 自由模式块：仅 `mode=free` 或无剧情参与轨道的 custom 时渲染；包含日期和时段自由流动规则。
- DLC 身份块：仅对应 DLC 渲染，并按稳定意识处理 transformation/body swap。
- 拉芙 Ω 块：仅主线拉芙 POV 渲染。
- 成长旗标块：为保持自由世界与 DLC 继承存档的既有语义，继续常驻；共享一次性和证据规则只声明一次，各字段只保留独有判据。
- 尾声块：仅 `mainline_completed=true` 且 `branch_choice=null` 时渲染。

EJS 直接使用 `getvar('stat_data...')` 在条目内部读取当前状态，不新增全局 `define()` 名称，避免污染现有 EJS 预处理命名空间。

### Schema 一致性

以现有前端 `ParticipationSchema` 为事实来源，同步到角色卡根 `schema.ts`，随后重新内联到 `脚本/Zod.txt`。字段结构为：

- `track`: `member | classmate | outsider`
- `note`: string，默认空字符串
- participation 整体允许 null，默认 null

### 输出格式

保留 UpdateVariable、Analysis 和 JSONPatch 契约，但删除完整角色对象示例，改为最小字段更新和数组插入示例。默认对象仍由 Schema prefault 和角色建档规则约束。

## 不在本次范围

- 不重命名 `phone` 或 `collection`。
- 不重做变量列表的 AI 可见投影。
- 不新增确定性 hammer/日期/结局菜单运行时自动化。
- 不改变 bond/romance 数值、成长旗标定义、场景完成语义或结局资格条件。

## 验收标准

1. 根 Schema、前端 Schema 与 Zod.txt 均含同构 participation 定义。
2. 更新规则源码明显缩小，且渲染后不存在开局 commit/初始关系表常驻说明。
3. 主线、free、两个 DLC、拉芙 POV 和尾声条件能产生正确规则分支。
4. MVU 初始变量校验通过。
5. v0.6 contract、EJS guard、场景、关系指南及关键运行时测试通过。
6. 新产物能够 pack，并在 fresh readback 中保留更新规则、Zod 和条目清单。
