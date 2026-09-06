# UIRefiner Demo

用自然语言改造既有软件界面的概念验证 Demo（路线 A + 路线 B），依据 [PRD.md](./PRD.md) 与 [DEV-PLAN.md](./DEV-PLAN.md) 实现。

**它是怎么实现的？（面向非技术读者的图文介绍）：[docs/how-it-works.html](./docs/how-it-works.html)** —— 也可在 demo 首页点击"它是怎么实现的？"直接查看（dev 模式下由 Vite 托管于 `/how-it-works.html`）。

## 启动

```bash
npm install   # 首次
npm run dev   # 根目录一条命令：同时启动 server(:3001) 与 client(:5173)
```

浏览器打开 **http://localhost:5173**。

## 首次使用：配置模型（约 1 分钟）

1. 右上角 **⚙ 模型设置**（与 docStudio 相同的配置体系，12 家预置 Provider）；
2. 展开任一家（推荐 GLM / DeepSeek），填 API Key → 勾选模型（勾选顺序即回退链）→ **设默认** → **验证模型连通**；
3. 打开该 Provider 的启用开关 → **保存全部配置**。

## 演示路径（5 分钟 golden path）

1. 选择 **售后工单系统**（路线 A），依次点击 3 条指令 chips：
   - 挪提交按钮 → 预览 → 应用（「变更与差量」页可看 SDK diff、可导出变更包）；
   - 折叠内部备注 → 触发**意图澄清** → 回复"可以" → 应用；
   - 处理记录挪到表单下方 → 应用；
2. 返回选择 **销售订单 ERP**（路线 B）：
   - 点 3 条 chips（藏字段 / 改名 / 列移动）→ 应用，注意自动落到**销售岗变体**；
   - 右上角切到**财务岗** → 完整界面；切回销售岗 → 定制还在；
   - 「变更与差量」页点 **⬆ 模拟升级** → 厂商换肤+新增「物流单号」，**全部定制保留**；
3. 负面演示：手动输入「把订单总金额自动加10%」→ Agent **拒绝**并解释（业务逻辑变更在 DSL 中不可表达）。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动（server + client） |
| `npm run typecheck` | TS 类型检查（server+shared / client） |
| `npm test` | 单元测试（含升级安全回归） |
| `npm run golden:mock` | Golden 回归·离线模式（不调 LLM，须 100%） |
| `npm run golden` | Golden 回归·真调 LLM（≥90%  repair 前，须先配置模型） |

离线兜底：应用页右上角打开「离线兜底」开关，跳过在线 LLM，使用预存指令→DSL 映射（仅支持预置指令原文），交互路径与在线完全一致。
