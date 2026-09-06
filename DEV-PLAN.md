# UIRefiner Demo 开发计划（依据 PRD.md）

| 项 | 内容 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-06 |
| 前提 | 单人开发，约 4 周 / 20 个工作日（≈19.5 人日，含缓冲）；模型配置从 docStudio 拷贝 |
| 配套文档 | [PRD.md](./PRD.md)（需求与验收） |

---

## 0. 里程碑总览

| 周 | 里程碑 | 对应 PRD |
|---|---|---|
| W1 | 两个可操作的 base app + 模型配置可用（docStudio 体系跑通） | FR-1、§9.1 |
| W2 | Agent 管线端到端：指令→DSL→校验→预览→应用→回滚 + chips | FR-2/3/4/5/6/11、§9.2 |
| W3 | 双路线特性：变体/差量/升级模拟（B）+ diff/导出（A）+ 越界拒绝 | FR-7/8/9/10 |
| W4 | 演示模式/离线兜底/打磨/排练/冻结 | FR-12、§10/§11 |

**开工前置条件**：① docStudio 仓库本地可访问（`/Users/wukun/Documents/tmp/docStudio`）；② 至少一家 LLM 的 API Key（GLM 或 DeepSeek，需支持结构化输出）；③ 确认目标模型能力（`supportsStructuredOutput`）。

---

## 1. 技术栈与仓库结构（与 docStudio 对齐，最大化拷贝）

| 层 | 选型 | 说明 |
|---|---|---|
| 仓库 | npm workspaces：`shared / server / client` | 与 docStudio 同构，拷贝文件零适配 |
| 服务端 | Node + TypeScript + Express | 路由风格与 docStudio `routes/settings.ts` 一致 |
| 数据库 | better-sqlite3 | 沿用 `user_settings` 表存模型配置；新增 `deltas / variants` 表 |
| 客户端 | React + Vite + TypeScript | |
| 校验 | zod（DSL schema 单一定义，导出 JSON Schema 供结构化输出） | 解析兜底用 docStudio 已有的 `jsonrepair` |
| 测试 | vitest（单测/集成）+ golden 回归脚本 | docStudio 已有 vitest 基建可参考 |

```
appUIRefiner/
├─ shared/src/types/
│  ├─ provider.ts            # 【拷贝】docStudio 原文件
│  ├─ controlTree.ts         # 新增：控件树节点类型
│  ├─ dsl.ts                 # 新增：布局意图 DSL + 回复 envelope
│  └─ delta.ts               # 新增：差量 / 变体类型
├─ server/src/
│  ├─ providers/             # 【拷贝】registry.ts / model-capabilities-registry.ts / openai.ts
│  ├─ security/keyStore.ts   # 【拷贝】
│  ├─ lib/settingsReader.ts  # 【拷贝】
│  ├─ routes/
│  │  ├─ settings.ts         # 【拷贝+裁剪】只留 LLM 相关端点
│  │  ├─ agent.ts            # 新增：意图→DSL→应用
│  │  └─ apps.ts             # 新增：树/差量/变体/升级模拟/导出
│  ├─ agent/                 # 新增：contextBuilder / prompts / validator / repair / pipeline
│  ├─ engine/                # 新增：applyChanges（纯函数）/ executors（Route A/B 包装）
│  └─ data/                  # 新增：appA.tree.json / appB.tree.json / appB.tree.v2.json
└─ client/src/
   ├─ components/
   │  ├─ Settings.tsx        # 【拷贝+裁剪】只留 LLM Tab
   │  ├─ AppPicker.tsx       # 新增：应用选择页
   │  ├─ BaseApp.tsx         # 新增：控件树渲染器（两个 base app 共用）
   │  ├─ AIPanel/            # 新增：对话 / chips / 预览 / 历史 / 差量视图 / diff 视图
   └─ lib/modelCatalog.ts   # 【拷贝】
```

---

## 2. 核心数据模型（shared/src/types）

```ts
// controlTree.ts — 控件树节点（两个 base app 通用）
interface TreeNode {
  id: string;                    // 稳定 id，如 "field-internal-note"
  type: "panel" | "form" | "field" | "textarea" | "table"
      | "column" | "button" | "group" | "collapsible";
  label: string;
  props?: Record<string, unknown>;   // 宽度/占位/主题等样式类属性
  children?: TreeNode[];
}

// dsl.ts — 布局意图（封闭词汇表）与 agent 回复 envelope
type LayoutAction =
  | { action: "move";       target: string; before?: string; after?: string; below?: string }
  | { action: "hide" | "show" | "collapse" | "expand"; target: string }
  | { action: "rename";     target: string; label: string }
  | { action: "group";      targets: string[]; title: string }
  | { action: "moveColumn"; target: string; index?: number; after?: string }
  | { action: "setProp";    target: string; prop: string; value: string }; // prop 白名单

type AgentReply =
  | { type: "changes"; changes: LayoutAction[]; note?: string }
  | { type: "clarify"; question: string; candidates?: string[] }
  | { type: "reject";  reason: string };        // 越界/非布局类请求

// delta.ts — 差量与变体
interface Delta   { id: string; appId: string; variantId?: string; changes: LayoutAction[];
                    request: string; createdAt: number; reverted?: boolean }
interface Variant { id: string; appId: string; roleId: "sales" | "finance" | "default"; name: string }
```

---

## 3. API 设计

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/agent/request` | POST | `{appId, roleId, message, history[]}` → `AgentReply`（结构化输出 + 校验修复后返回） |
| `/api/agent/preview` | POST | `{appId, roleId, changes}` → 应用后的树（纯函数预演，与正式应用同一实现） |
| `/api/agent/apply` | POST | `{appId, roleId, changes, request}` → 持久化 Delta 并返回 deltaId |
| `/api/agent/revert` | POST | `{deltaId}` → 标记 reverted，重算 effective tree |
| `/api/apps/:id/tree` | GET | `?variant=` effective tree（base ⊕ 未回滚差量） |
| `/api/apps/:id/base-tree` | GET | 原始树（差量视图的对照基准） |
| `/api/apps/:id/deltas` | GET | 差量清单（App B 按 variant 过滤） |
| `/api/apps/:id/upgrade-simulate` | POST | 仅 App B：base tree 切到 v2，差量自动重放 |
| `/api/apps/:id/export` | GET | 仅 App A：导出变更包 JSON |
| `/api/settings/*` | — | 【拷贝】docStudio 端点：presets / models / verify-model / providers |

---

## 4. 关键设计决策

- **D1 渲染即差量**：base tree（JSON，随代码发布）+ Delta（SQLite）→ effective tree = base ⊕ deltas（顺序应用，revert 即重算）。升级模拟 = 换 base tree 版本，Delta 层不动——证明逻辑与 SAP Flexibility 同构。
- **D2 一个渲染器，两个 base app**：`BaseApp.tsx` 是唯一渲染器；A/B 的区别只在树数据与执行器包装，不写两套界面。
- **D3 执行器接口**：`Executor.apply(tree, changes) / revert(tree, delta)`。Route A 包装器额外写"SDK 差量日志"（供 diff 视图/导出），Route B 包装器按 `variantId` 存取——核心 `applyChanges` 纯函数完全共享。
- **D4 回复 envelope**：LLM 输出统一为 `changes / clarify / reject` 三态，全部纳入结构化输出 schema——"澄清"和"拒绝"是被 schema 约束的合法输出，不是碰运气。
- **D5 预览=应用**：预览调用与正式应用**同一个** `applyChanges` 纯函数，杜绝"预览和实际不一致"。
- **D6 越界拒绝的机制**：schema 无对应动作 → 结构上不可表达；`reject` 态负责给出人话解释。

---

## 5. 任务分解（day-level，单人）

> 格式：`ID (工时) 任务 — DoD`。依赖关系以缩进层级示意，同一周内可按序串行。

### W1 — 地基（5 天）

- **T1.1 (0.5d)** Monorepo 脚手架：workspaces、Vite+React client、Express+TS server、vitest、`npm run dev` 并发启动 — DoD：`/api/health` 通，client 渲染占位页。
- **T1.2 (0.5d)** shared 类型骨架（§2 全部类型）— DoD：`tsc --noEmit` 通过。
- **T1.3 (1d)** 拷贝 docStudio 模型配置（§1 标【拷贝】的全部文件，settings 路由与 Settings.tsx 裁剪到 LLM）— DoD：配置页配 GLM/DeepSeek 任一家 → `verify-model` 通过 → 模型目录返回含 `supportsStructuredOutput` 能力字段。
- **T1.4 (1d)** 控件树渲染器 `BaseApp.tsx`：8 种节点类型 + 企业软件质感的基础样式 — DoD：喂入 JSON 树可渲染完整界面；快照测试。
- **T1.5 (1d)** 两个 base app 的树数据（覆盖 PRD §5.2/§6.2 全部元素，id 稳定）+ 应用选择页（FR-1）— DoD：首页两卡片可进入各自应用，界面与 PRD 截图描述一致。
- **T1.6 (0.5d)** `GET base-tree / tree` API — DoD：curl 取树正确。
- **T1.7 (0.5d)** App B 角色切换器 UI + "适配模式"对照开关占位 — DoD：角色状态可切换（暂无变体差异）。

### W2 — Agent 管线（6 天）

- **T2.1 (0.5d)** `contextBuilder`：effective tree → 紧凑文本（每控件一行：id/类型/标签/位置）— DoD：单测快照；token 估算 < 2k。
- **T2.2 (1d)** DSL zod schema + JSON Schema 导出 + `jsonrepair` 兜底解析 + 结构校验器 — DoD：非法 JSON / 未知动作 / 缺字段用例全过。
- **T2.3 (1d)** 语义校验器：target 存在于控件树、位置引用有效、group targets ≤ 8、setProp prop 白名单 — DoD：用例覆盖各类非法引用。
- **T2.4 (1d)** Prompt 工程：system prompt（DSL 规约+约束）+ 8–10 组 few-shot（含歧义→clarify、业务逻辑→reject 示例）— DoD：6 chips + 2 clarify + 1 reject 手工联调全过。
- **T2.5 (1d)** Repair 循环（错误原文回传，≤2 次）+ 降级 UI（候选控件点选）— DoD：注入坏 target 自动修复；二次失败走点选。
- **T2.6 (1d)** `POST /api/agent/request`（含多轮历史/澄清）+ AI 面板对话 UI（FR-2/3）— DoD：面板发指令→返回变更/澄清/拒绝三种回复正确呈现。
- **T2.7 (1d)** `applyChanges` 纯函数实现全部 9 种动作 + `POST preview` + before/after 预览 UI（FR-5）— DoD：预览确认后界面真实变化；预览与实际一致（同函数）。
- **T2.8 (0.5d)** apply/revert/历史列表（FR-6）+ Delta 持久化 — DoD：逐条撤销正确；刷新后定制仍在。
- **T2.9 (0.5d)** Chips 栏（FR-11）端到端 — DoD：点 chip → 1–3s 加载 → 预览 → 应用，全通。
- **T2.10 (0.5d)** Golden 回归脚本 `scripts/golden.ts`：9 条用例（6 chips + 2 自由输入 + 1 拒绝）× N 轮，输出成功率报告 — DoD：repair 开启后 9/9 通过；支持 mock LLM 模式供 CI。

### W3 — 双路线特性（5 天）

- **T3.1 (1d)** App B 变体体系（FR-7）：Delta 按当前角色落库、变体切换、差量清单视图（对照 base tree）— DoD：销售岗改动→切财务岗恢复完整版→切回仍在；差量清单可读。
- **T3.2 (0.5d)** 升级模拟（FR-8）：`appB.tree.v2.json`（换主题色 + 新增"物流单号"字段）+ 切换端点 — DoD：**回归测试**断言 B1–B3 差量在 v2 上全部生效（这是演示杀手锏，必须是自动化测试）。
- **T3.3 (1d)** App A diff 视图（FR-9）：DSL → 组件配置 diff（标注"SDK 差量"）+ `GET export` 变更包下载 — DoD：diff 可读；导出 JSON 结构稳定。
- **T3.4 (0.5d)** 越界拒绝打磨（FR-10）："把总金额加 10%" 稳定返回 reject + 解释文案 — DoD：golden 用例含此条。
- **T3.5 (1d)** 意图澄清打磨（FR-3 深化）：歧义用例的反问质量与 candidates 点选 — DoD："挪到下面"类用例先反问再执行。
- **T3.6 (1d)** 缓冲（吸收前序超期；优先补 golden 弱项）。

### W4 — 加固与演示（4.5 天）

- **T4.1 (1d)** 演示模式（FR-12）：golden path 引导提示 + 离线兜底开关（预存指令→DSL 映射）— DoD：断网跑通 §10 全脚本，交互路径与在线一致。
- **T4.2 (1d)** 体验打磨：加载指示、错误 toast、空态、面板与 base app 布局细节、模拟标注核查（诚实原则）。
- **T4.3 (1d)** 全流程排练 ×3 + 计时（≤5 min）+ §11 成功标准逐条自查 — DoD：三次排练无翻车；发现项全部修复。
- **T4.4 (1d)** 内部演示 + 修复缓冲。
- **T4.5 (0.5d)** 版本冻结 + README（启动方式、演示指引、离线模式开关说明）。

---

## 6. 测试计划

| 层 | 内容 | 工具 |
|---|---|---|
| 单元 | `applyChanges` 每种动作的正反用例；DSL 结构/语义校验器；contextBuilder 快照 | vitest |
| 回归（机制） | **升级安全**：B1–B3 → upgrade-simulate → 断言差量全部生效（T3.2）；变体隔离：销售/财务互不可见 | vitest |
| 回归（LLM） | Golden：9 用例 × N 轮真调 LLM，成功率报告；mock 模式供 CI | `scripts/golden.ts` |
| 集成 | agent 全链路（mock LLM 注入坏输出 → repair 修复）；settings 拷贝件连通 | vitest integration |
| 验收 | §11 五条成功标准 | 人工 + 排练记录 |

**门槛**：golden 真调成功率 ≥ 90%（repair 前）→ 100%（repair 后）方可进入 W4 排练。

---

## 7. FR ↔ 任务 ↔ 测试 对照

| FR | 任务 | 测试 |
|---|---|---|
| FR-1 选择页 | T1.5 | 手工 |
| FR-2 对话 | T2.6 | golden |
| FR-3 澄清 | T2.4/T2.5/T3.5 | golden + 手工 |
| FR-4 DSL 校验 | T2.2/T2.3 | 单元 |
| FR-5 预览 | T2.7 | 单元 + 手工 |
| FR-6 应用/回滚 | T2.8 | 单元 |
| FR-7 变体 | T3.1 | 回归（机制） |
| FR-8 升级模拟 | T3.2 | 回归（机制）★ |
| FR-9 diff/导出 | T3.3 | 手工 |
| FR-10 越界拒绝 | T2.2/T3.4 | golden |
| FR-11 chips | T2.9 | golden |
| FR-12 演示模式 | T4.1 | 断网演练 |
| §9.1 模型配置 | T1.3 | verify-model 连通 |

---

## 8. 开发期风险与对策

| 风险 | 对策 |
|---|---|
| 目标模型结构化输出兼容性参差（json_schema 支持度不同） | 能力目录按 `supportsStructuredOutput` 过滤；不支持则降级 tool-call；再不行 prompt+`jsonrepair` 兜底——T2.2 设计时预留三档 |
| LLM 输出漂移（同指令不同结果） | TEMPERATURE=0.1；请求缓存；golden 锁定；演示用 chips 即缓存命中最稳路径 |
| `applyChanges` 边界情形（如移动到已隐藏分组内、moveColumn 越界） | T2.3 语义校验逐步补充规则；每个边界发现即补单测 |
| docStudio 拷贝件水土不服（耦合了 knowledge/search 字段） | T1.3 只拷清单内文件；`settingsReader` 中 knowledge/search 分支保留但不会被触发，不做精简重构，降低搬运成本 |
| 单人周期风险 | T3.5 可与 T2.4 合并、T3.3 导出可降级为"复制 JSON"，W3.6/W4.4 为缓冲 |
