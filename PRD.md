# PRD：UIRefiner 概念验证 Demo（路线 A + 路线 B）

| 项 | 内容 |
|---|---|
| 版本 | v0.1（Demo PRD） |
| 日期 | 2026-09-06 |
| 目标读者 | 产品、开发、演示对象（投资人/管理层/潜在客户） |
| 一句话定位 | 用一个 5 分钟可讲完的演示，证明"自然语言改造既有软件界面"在两条接入路线上都成立 |

---

## 1. 背景与 Demo 目标

### 1.1 要说服的命题

> 用户对自己在用的行业软件界面不满意时，可以直接用自然语言让 agent 把界面改成想要的样子——且改动安全、可回滚、可持久化。

竞品调研结论（详见附录）：目前市面上没有产品完整覆盖"改造**既有运行中软件**"这个场景。最接近的是 SAP Fiori 的 Adapt UI（手工无代码适配，无自然语言）和 CopilotKit（agent 改 UI，但只面向集成了 SDK 的新应用）。本 Demo 的任务是把"自然语言"这一层加到"存量软件适配"这个已被验证有付费意愿的场景上。

### 1.2 Demo 要传达的三个核心信息

1. **两条接入路线都可行**：A = 给有源码的自研 Web 应用集成 SDK；B = 通过软件厂商已有的适配层（以 SAP 式"差量机制"为原型）改造存量 ERP。
2. **安全是设计出来的，不是承诺出来的**：LLM 只输出受控的布局意图 DSL，结构上不可能碰业务逻辑；预览-确认-回滚全链路。
3. **改造是"差量"而非"重写"**：原始应用不被修改，个人/角色的定制以差量形式叠加，软件升级不失效。

### 1.3 非目标（本次 Demo 明确不做）

- 不接入真实存量软件（两个 base app 均为高保真模拟）；
- 不做路线 C（闭源桌面软件的 overlay 重排）；
- 不做权限治理、多人协作、审计合规；
- 不追求 LLM 的长尾指令泛化能力，预置指令集之外可礼貌拒绝。

---

## 2. 演示对象与整体叙事

**给谁看**：潜在客户（企业 IT / 业务部门负责人）、软件厂商、投资决策者。

**核心叙事**（30 秒版本）：

> 行业软件的界面是厂商决定的，但用的人是千差万别的。我们做了一个 AI 界面改造 agent：对自研 Web 应用，它以 SDK 形式集成（路线 A）；对 SAP 这类有适配机制的存量 ERP，它走厂商适配层（路线 B）。用户说一句话，agent 生成受控的布局变更清单，预览确认后生效，改动保存为差量，升级不丢。

### 2.1 与 Excel Copilot / Claude for Excel 的本质区别（预答质疑）

演示中最可能出现的质疑："这不是和 Excel Copilot / Claude for Excel 一样吗？"必须当场把 frame 纠正过来——两者改的东西根本不同：

| 维度 | Excel Copilot / Claude for Excel | UIRefiner |
|---|---|---|
| 改造对象 | 用户**自有文档里的数据**：单元格、公式、格式、图表（[Claude for Excel](https://claudeinexcel.com/) 官方能力即分析工作簿/生成公式/排错） | 用户**无权修改的应用软件界面本身**：按钮、字段、布局、分组 |
| 用户能否手工做到 | 能。Excel 本来就是网格编辑器，挪列/排序人人会，AI 只是省事 | **不能**。没有源码和权限，你拖不动 ERP 里的按钮、藏不掉厂商设定的字段——这正是产品存在的前提 |
| 改动的归属与范围 | 留在你自己的文件里，只影响你自己 | 差量按角色/部门持久化，全组共享，且厂商升级后依然生效 |
| 风险约束 | 几乎没有下游风险 | 必须保持事件绑定、校验规则、权限边界、升级安全——DSL + 差量机制就是为此而设 |

一句话收束：**Copilot 帮你"做表格"，UIRefiner 帮你"改软件"。** 表格类指令最容易唤起 Excel 类比，因此 chips 选型必须执行 §3 的差异化原则。

---

## 3. Base App 的选择依据

选择标准：① 大众能秒懂的业务场景；② 恰好落在竞品已验证的改造用例范围内（字段显隐/移动/改名/表格列序/角色变体）；③ 两条路线的机制差异能被明显演示出来。

竞品用例对照（SAP Key User Adaptation 官方能力）：隐藏或新增字段/分组、拖拽移动控件（含表格列）、改标签、按业务角色保存变体。**本 Demo 的两个场景全部落在这个范围内，等于站在竞品验证过的需求上做增量创新。**

**高频指令 chips 的选型原则（v0.2）**：差异化优先于使用频率。① 每条 chip 必须首先是"文档/表格类工具（Excel Copilot、Claude for Excel）结构上做不到"的操作——改造对象是应用界面本身，而不是用户自有的数据文件；② 表格列级操作每个应用至多一条"裸操作"，且必须用应用级机制（角色变体/全组持久化/升级安全）包裹呈现；③ 检验标准：如果观众看完某条指令后说"这在 Excel 里也能做"，这条指令就不能进 chips。

---

## 4. Demo 总体结构

```
┌─────────────────────────────────────────────┐
│  ① 应用选择页（首页）                          │
│     [App A: 售后工单系统]   [App B: 销售订单ERP] │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  ② Base App 界面（高保真模拟，可真实操作）        │
│  ┌──────────────────────┐  ┌─────────────┐  │
│  │                      │  │ AI 改造面板   │  │
│  │   既有软件界面        │  │ (对话+预览+   │  │
│  │   （右侧悬浮面板）     │  │  变体管理)    │  │
│  └──────────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────┘
```

AI 改造面板为两个应用**共用同一套组件**，仅执行器（Route A Executor / Route B Executor）不同——这本身就是一个演示点：理解层复用，接入层可插拔。

---

## 5. Base App A：售后工单系统（体现路线 A）

### 5.1 场景设定

> 一家设备厂商自研的 Web 版售后工单系统（React 技术栈，有源码，已集成 UIRefiner SDK）。客服主管觉得默认界面不顺手，想让 AI 按自己团队的习惯改。

选择理由：工单/审批系统人人用过，零解释成本；它是典型"自研 Web 应用"，是路线 A 的标准画像。

### 5.2 初始界面（模拟）

- 顶部：标题栏 + 状态筛选标签（待处理/处理中/已关闭）
- 主体左侧：工单详情表单——客户信息（客户名/联系人/电话）、问题描述（大文本框）、内部备注、优先级、处理人
- 主体右侧：处理记录表格（时间/处理人/动作/备注）
- 底部：操作按钮区【提交审核】【转派】【关闭工单】

### 5.3 高频指令（Pick-up chips）与预置演示指令（golden path）

AI 面板输入框上方常驻 3 条**高频指令 chips**（A1–A3，调研依据见附录 B），点击即直接发送；输入框始终可自由输入相同或其他任意指令（A4 为自由输入示例）。

| # | 用户说 | Agent 做什么 | 展示机制点 | 呈现方式 |
|---|---|---|---|---|
| A1 | "把提交审核按钮从底部挪到表单上方，用户填完就能看到" | move(btn-submit, before=问题大文本框之后) | 对应用户原始 idea 的"编辑框在上按钮在下" | chip |
| A2 | "内部备注是给我们自己看的，折叠起来" | collapse(field-internal-note)（并反问确认"折叠后默认展示标题行可以吗"） | 意图澄清 | chip |
| A3 | "把处理记录表格挪到表单下方，整个页面改成上下两块" | move(panel-records, below=panel-form) | 跨区域结构重排——文档/表格类工具无法表达的应用级操作 | chip |
| A4 | "客户名、联系人、电话合并成一个分组，标题叫'客户信息'" | group(3 fields, title=客户信息) | 分组重排 | 自由输入 |

> v0.2 修订：原 A3"状态列放第一列"为表格类操作，容易触发"这不就是 Excel Copilot"的错误类比，已按 §3 选型原则替换为跨区域结构重排；表格列重排降为自由输入示例。

### 5.4 路线 A 独有的机制展示

1. **代码/配置 diff 视图**：每条指令应用后，面板可切换"变更清单"视图，展示 DSL 条目对应的组件配置 diff（Demo 中以配置差量代表源码差量，UI 上如实标注"SDK 差量"）。给软件厂商看时讲："这部分可以编译成代码补丁发版给所有客户。"
2. **即时热更新**：确认后界面即时刷新，无需重新加载——体现"SDK 内置执行器"。
3. **反向输出**：一键"导出变更包"，把本次所有差量导出为 JSON（模拟发给开发商合入标准版的流程）。

---

## 6. Base App B：销售订单 ERP（体现路线 B）

### 6.1 场景设定

> 一家贸易公司用的存量 ERP 销售订单模块（模拟 SAP Fiori 风格，厂商提供 Adapt 层，UIRefiner 以"自然语言适配前端"的身份接入）。销售部想要一个简化版界面；同时演示"厂商升级后定制不丢"。

选择理由：ERP 表单是所有企业客户都懂的场景，且字段显隐/改名/角色变体正是 SAP Adapt UI 被客户大量使用的功能——需求已被验证。

### 6.2 初始界面（模拟）

- 标准销售订单表单：订单头（客户/订单日期/付款条件/币别）+ 行项目表格（物料/数量/单价/金额/成本价/内部备注）
- 右上角：角色切换器（销售岗 / 财务岗）——用于演示变体
- 面板内：厂商版"适配模式"开关（模拟 Adapt UI，作为对照：传统方式要点选拖拽，AI 方式说一句话）

### 6.3 高频指令（Pick-up chips）与预置演示指令（golden path）

同样常驻 3 条高频指令 chips（B1–B3，调研依据见附录 B），点击直接发送；自由输入保留（B4 为面板按钮）。

| # | 用户说 | Agent 做什么 | 展示机制点 | 呈现方式 |
|---|---|---|---|---|
| B1 | "成本价、内部备注是销售不该看的，藏起来" | hide(col-cost-price) × 2（并提示"已按销售岗变体保存"） | 字段隐藏 + 自动落到当前角色变体（SAP 生态使用最多的适配动作） | chip |
| B2 | "把'付款条件'改名叫'账期'，我们内部都这么叫" | rename(field-payment-term, 账期) | 改标签（key user 高频用例） | chip |
| B3 | "把'金额'列挪到第一列，一打开就能看到每行的价格" | moveColumn(col-amount, index=1) | 表格列重排（初始第一列是"物料"，改动肉眼可见），以**应用级包裹**呈现：改动即存入销售岗变体、全组生效、升级不丢——对照"Excel 里挪列只是改你自己的文件" | chip |
| B4 | （点厂商升级模拟按钮）—— | base app 换肤+新增一个"物流单号"字段 | **升级安全**：所有定制仍然生效 | 面板按钮 |

### 6.4 路线 B 独有的机制展示

1. **差量可视化**：面板可查看"本次定制实际保存了什么"——一份可读的差量清单（对比：原始应用零修改）。这是对 IT 部门最有说服力的一屏。
2. **角色变体**：B1–B3 的改动自动保存为"销售岗变体"；切换到财务岗，界面恢复完整版。讲法："同一个系统，每个角色有自己的界面。"
3. **升级安全模拟**：一键让厂商应用"升级"（换主题色 + 新增字段），所有变体差量继续生效——对应 SAP Flexibility 的升级安全卖点，但用 AI 一步到位。
4. **权限边界（负面演示，杀手锏）**：用户说"把订单总金额自动加 10%"，agent 明确拒绝并解释："这属于业务逻辑变更，不在界面适配允许范围内。" —— 安全不是没做，而是**结构上做不到**。

---

## 7. 核心功能需求（FR）

| 编号 | 功能 | 优先级 | 说明 |
|---|---|---|---|
| FR-1 | 应用选择页 | P0 | 两个 base app 卡片，标注路线 A/B 与一句话介绍 |
| FR-2 | 对话式改造 | P0 | 右侧面板输入自然语言；支持连续对话（"再往下挪一点"） |
| FR-3 | 意图澄清 | P0 | 指令有歧义时 agent 反问（每场演示至少触发 1 次以展示） |
| FR-4 | DSL 生成与校验 | P0 | LLM 输出布局意图 DSL；schema 校验失败自动重试 |
| FR-5 | 预览与确认 | P0 | 应用前展示 before/after 对比 + 差量清单，用户点"应用"才生效 |
| FR-6 | 应用与回滚 | P0 | 即时生效；每次应用可单独撤销；历史记录列表 |
| FR-7 | 变体管理（仅 App B） | P0 | 角色切换 + 变体保存/切换 |
| FR-8 | 升级安全模拟（仅 App B） | P1 | 一键升级按钮 + 定制保留效果 |
| FR-9 | diff 视图（仅 App A） | P1 | DSL → 组件配置差量展示；导出变更包 |
| FR-10 | 越界拒绝 | P0 | 非布局类指令统一拒绝并解释（预置 1 条触发词） |
| FR-11 | 高频指令 Pick-up 栏 | P0 | 每个应用内置 3 条调研得出高频请求 chips，点击直接发送；chips 用掉后可重复出现；输入框自由输入不受影响（§5.3 / §6.3） |
| FR-12 | 演示模式 | P1 | 引导式推进（下一步提示），供演讲者流畅跑完 golden path |

---

## 8. 布局意图 DSL（已定方案，此处定稿词汇表）

```jsonc
// 动作词汇表（封闭集合，schema 强校验）
// move | hide | show | rename | group | moveColumn | collapse | expand | setProp(限样式类)
[
  { "action": "move",       "target": "btn-submit",     "before": "field-desc" },
  { "action": "hide",       "target": "field-cost" },
  { "action": "rename",     "target": "field-payterm",  "label": "账期" },
  { "action": "moveColumn", "target": "col-status",     "index": 1 },
  { "action": "group",      "targets": ["f1","f2","f3"], "title": "客户信息" },
  { "action": "collapse",   "target": "field-note" }
]
```

校验规则：动作必须来自封闭词汇表；target 必须存在于当前应用的控件树；越界动作（改数据/改逻辑）在 schema 层即不可表达。

---

## 9. 技术方案概要

- **两个 base app**：React 按声明式 UI 描述（JSON 控件树）渲染——这样"差量"天然可实现：改造 = 对控件树打补丁。App A 走 SDK 执行器，App B 走适配层执行器（含变体存储与升级模拟钩子）。
- **Agent 管线**：用户输入 → LLM（含控件树上下文 + few-shot DSL 示例）→ DSL JSON → schema 校验（失败重试 ≤2 次）→ 预览渲染 → 用户确认 → 执行器应用 → 差量持久化。
- **可操作性原则**：Demo 是可真实操作的应用，不是预录播放/动画。每条指令端到端真执行（真调 LLM、真改控件树状态、真持久化差量），改动后的界面可继续正常操作（按钮可点、表单可填、表格可筛选）——"证明改造后的软件仍然是个软件"本身就是演示的一部分。唯一的"等待"是点击指令后 LLM 生成 DSL 的 1–3 秒真实延迟（以加载指示呈现）。风险预案中的"离线兜底"（§13）也只是把在线 LLM 换成预存的指令→DSL 映射，交互路径与真执行完全一致，绝不退化为播放。
- **诚实原则**：所有"模拟厂商机制"（升级、适配层）在 UI 上如实标注"模拟"，Demo 的可信度来自机制真实，不靠伪装。

### 9.1 模型配置（拷贝 docStudio / i-Write 的模型配置体系）

不用环境变量式静态配置，直接复用 docStudio 已实现并验证过的"模型设置"产品能力（源码位于 `/Users/wukun/Documents/tmp/docStudio`，该体系本就是从 patentExaminator 迁移复用的，Demo 是第三个复用方）：

- **预置 Provider 目录**：kimi / glm / deepseek / qwen / minimax / volcengine / bailian / gemini / bedrock / openrouter / opencode / mimo 共 12 家（`shared/src/types/provider.ts` 的 `ProviderId` 集合），每家带预置 baseUrl 与 Key 占位提示。
- **每家 Provider 的连接配置**（`ProviderConnection`）：baseUrl（可覆盖）、API Key、模型列表（静态目录或在线拉取）、默认模型（"设为默认"）、模型回退链（拖拽排序）、启用开关、按 Provider 的模型回退开关；另有全局 Provider 级回退开关（`enableProviderFallback`）。
- **模型能力目录**：静态模型目录带能力元数据（contextWindow / maxOutputTokens / isReasoning / supportsVision / **supportsStructuredOutput** / supportsFunctionCalling / rpm·rpd·tpm 限速 / 推荐标记）。DSL 管线只允许选择 `supportsStructuredOutput`（或 supportsFunctionCalling）为真的模型——§9.2 第一道防线的前置条件由目录层直接保证。
- **验证闭环**：保存前对所选模型逐个**真实调用验证**（`POST /providers/:id/verify-model`，含函数调用能力探测），以"已验证"标记展示，杜绝"配了 Key 但现场跑不通"。
- **存储与运行时**：SQLite `user_settings` 表（key = `provider_all`，值为 JSON AppSettings）+ 内存 Key 缓存（`keyStore.ts`）+ 带失效机制的设置缓存（`settingsReader.ts`）；运行时按 providerPreference 顺序 + 默认模型 + 回退链路由请求，每家 Provider 一个 OpenAI 兼容 adapter（`registry.ts`）。
- **服务端 API**（照搬 `routes/settings.ts`）：`GET /providers/presets`、`GET /providers/models`（静态目录）、`POST /providers/:id/models`（在线拉取模型列表）、`POST /providers/:id/verify-model`（验证）、`POST /providers`（保存）。
- **客户端 UI**：Settings 页"模型"Tab——Provider 卡片（展开/拖拽排序/启停）+ Key 表单 + 模型多选 + 默认模型与回退链拖拽 + 验证结果反馈；`useModelCatalog` hook 带缓存。
- **对 Demo 的裁剪**：只搬 LLM Tab；Search / Knowledge / Profile 等 Tab 不搬。可拷贝文件清单：`shared/src/types/provider.ts`、`server/src/providers/{registry, model-capabilities-registry, openai}.ts`、`server/src/security/keyStore.ts`、`server/src/lib/settingsReader.ts`、`server/src/routes/settings.ts`（裁剪）、`client/src/lib/modelCatalog.ts`、`client/src/components/Settings.tsx`（裁剪 LLM Tab）。
- **与管线的衔接（保留原设计）**：调用形态仍为薄编排单次调用（仅澄清与校验重试多一轮）；上下文仍传紧凑控件树（id/类型/标签/位置）；TEMPERATURE 固定 0.1 作为管线级默认，不暴露给用户。

### 9.2 LLM 正确产出 DSL 的四道防线

1. **结构化输出（出生即合法）**：调用时传入 DSL schema，服务端约束生成——动作只可能来自封闭枚举，非法 JSON 在语法层即不可能产生；越界指令（改业务逻辑）在 schema 中不可表达。
2. **Prompt 工程（教会它）**：system prompt 含 DSL 规约 + 8–10 组 few-shot，覆盖标准写法、歧义写法（此时输出澄清反问而非猜测，即 FR-3 的实现机制）与拒绝示例。
3. **校验与修复（安检）**：schema 校验 → 语义校验（target 必须存在于控件树、位置引用有效）→ 失败时把错误信息原文回传模型自动重试（≤2 次）→ 仍失败降级为"候选控件让用户点选"，绝不静默硬套。
4. **人在环中（保底）**：预览-确认-回滚（FR-5/6）将任何理解偏差的代价封顶在"预览时被用户看见并否决"。

工程保障：① **golden 回归**——6 条 chips 指令即回归用例，演示前批量跑 N 次统计成功率，不达标不上场；② **请求缓存**——同请求（同应用状态）复用上次结果，提速且稳定。

---

## 10. 5 分钟演示脚本（golden path）

| 时间 | 动作 | 讲述要点 |
|---|---|---|
| 0:00–0:30 | 应用选择页 | "两条路线，一套 agent。" |
| 0:30–2:30 | App A：点 chips A1→A2→A3，自由输入 A4，展示 diff 视图与导出 | "自研应用，SDK 集成，改动可打包发版。" |
| 2:30–4:30 | App B：点 chips B1→B2→B3，切角色看变体，B4 升级模拟 | "存量 ERP，走厂商适配层，差量叠加，升级不丢。" |
| 4:30–5:00 | 负面演示 + 预答质疑："把总金额加10%" → 拒绝；若被问"和 Excel Copilot / Claude for Excel 有什么区别"，用 §2.1 收束 | "安全是结构性的：改逻辑这件事，DSL 里根本不存在。他改的是你自己的表格数据；我们改的是你改不了的应用本身。" |

---

## 11. 成功标准

1. 演示对象在无讲解情况下能复述两条路线的区别（访谈验证）；
2. 全部预置指令在演示环境中 100% 成功，单条端到端 ≤ 5 秒；
3. 负面演示触发后观众能说出"为什么安全"；
4. 演示后访谈中，无人自发将产品类比为"Excel Copilot 的企业版"；若出现该类比，§2.1 的对比能当场纠正；
5. 完整脚本排练 ≤ 5 分钟。

---

## 12. 里程碑（约 4 周）

| 周 | 交付 |
|---|---|
| W1 | DSL 定稿 + 两个 base app（声明式渲染）+ 应用选择页 |
| W2 | Agent 管线（LLM→DSL→校验→预览→应用→回滚） |
| W3 | 路线 B：变体/差量视图/升级模拟；路线 A：diff 视图/导出 |
| W4 | 演示模式、负面演示、脚本排练与打磨 |

---

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| LLM 生成的 DSL 不稳定 | few-shot + schema 校验 + 重试；预置指令兜底 |
| Demo 被质疑"只是模拟" | 差量机制真实实现（模拟的只是"厂商应用"本身）；UI 如实标注 |
| 观众追问路线 C（任意闭源软件） | 准备一句话回应：路线 C 技术上走 overlay，本期先验证商业上最短路径的 A/B |
| 演示现场网络/LLM 故障 | docStudio 体系自带的多 Provider 回退链（主模型挂了自动切备用）；演示模式内置本地缓存的指令→DSL 映射，可离线跑通 golden path |

---

## 附录 A：竞品场景依据

- SAP Key User Adaptation 官方能力（隐藏/移动字段、表格列拖拽、改标签、按角色变体）：[SAP Community: Key User Adaptation](https://community.sap.com/t5/technology-blog-posts-by-sap/key-user-adaptation-powerful-new-features-amp-seamless-transition-to/ba-p/14350093)、[SAP Fiori Key User Extensibility](https://www.scribd.com/document/844573479/SAP-Fiori-for-SAP-S-4HANA-What-is-Key-User-Extensibility)
- CopilotKit/AG-UI（agent 修改既有前端 state，需集成 SDK）：[AG-UI 协议发布](https://www.copilotkit.ai/blog/introducing-ag-ui-the-protocol-where-agents-meet-users)、[Generative UI 文档](https://docs.copilotkit.ai/concepts/generative-ui-overview)
- 结论：本 Demo 两个场景均落在竞品已验证的用例范围内，创新点 = 自然语言 agent + 受控 DSL + 双路线统一体验。

## 附录 B：高频指令选择依据（调研结论）

公开渠道没有"各定制动作使用率"的精确统计，但多来源交叉验证后方向高度一致，据此为每个场景选出 3 条最高频、最有共识的指令：

1. **字段隐藏/显隐是使用最频繁的适配动作**：SAP 官方将"更改字段可见性"列为 key user 最常用适配之一（[SAP Community: Key User Extensibility](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-fiori-for-sap-s-4hana-what-is-key-user-extensibility-and-who-are-your/ba-p/13560372)）；多家软件厂商（MachForm、ManageEngine ServiceDesk Plus、SplendidCRM 等）公开称"按条件显隐字段"是其收到最多的功能请求之一；企业 UX 研究指出复杂界面迫使熟练员工自行绕路，正是"藏掉用不到的字段"诉求的根源（[Stephanie Walter: Enterprise UX](https://stephaniewalter.design/blog/overcoming-challenges-in-enterprise-ux/)）。
2. **表格列显隐/重排是企业数据表格的基线预期**：SAP Fiori 设计系统把"显示/隐藏列 + 拖拽重排列"列为表格个性化的核心能力（[SAP Fiori Design System: Table Personalization](https://www.sap.com/design-system/fiori-design-web/v1-71/foundations/best-practices/ui-elements/tables/overview-table-personalization)）；企业表格库 AG Grid 直接把列显隐/重排工具面板作为标配（AG Grid Columns Tool Panel）；Appian 社区常见需求即"用户自行选择网格列的可见与顺序"（[Appian Community](https://community.appian.com/user-experience-design-16/user-preference-to-show-hide-reorder-columns-of-a-grid-1507)）。
3. **改标签/按角色保存变体是 key user 适配的高频用例**：key user 可"customize, add, hide, remove or reorganize fields"并为全员/角色创建默认变体（[sapfi.eu](https://sapfi.eu/en/how-to-customize-an-standard-fiori-apps/)、[SAP Community: key users create default app settings](https://community.sap.com/t5/technology-blog-posts-by-sap/sap-fiori-for-sap-s-4hana-yes-key-users-can-create-default-app-settings-for/ba-p/13553897)）。
4. **表单摩擦是量化背景**：Baymard Institute 基于 20 万小时 UX 研究的统计库记录了表单杂乱/字段过多的摩擦成本，支撑"简化表单"类指令的现实价值（Baymard 40+ UX statistics）。

对照到 Demo：
- App A chips = 按钮位置重排（创始人原始场景 + 表单布局研究）＋ 字段折叠（显隐类）＋ 表格列重排（基线预期）；
- App B chips = 字段隐藏（使用最频繁）＋ 改标签（key user 高频）＋ 表格列重排（基线预期）；
- 诚实声明：三条指令的选择依据是"多来源共识"而非使用率百分比，公开数据中不存在后者。
- **v0.2 修订**：经"与 Excel Copilot / Claude for Excel 差异化"评审（§2.1），App A 的表格列 chips 已替换为跨区域结构重排；表格类指令的保留与包裹原则见 §3。频率调研结论保持有效——表格操作高频，但它们不是本产品与文档类 AI 工具的差异点，故不作 chips 首选。
