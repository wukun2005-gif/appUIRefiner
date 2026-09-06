/**
 * UIRefiner Demo 服务端入口
 *
 * 路由挂载：
 *   /api/settings — 【拷贝自 docStudio】模型配置（presets/models/verify-model/providers）
 *   /api/agent    — 自然语言 → DSL → 校验/修复 → 预览/应用/回滚
 *   /api/apps     — base app 树 / 差量 / 变体 / 升级模拟 / 导出
 */
import express from "express";
import cors from "cors";
import { settingsRouter } from "./routes/settings.js";
import { agentRouter } from "./routes/agent.js";
import { appsRouter } from "./routes/apps.js";
import { logger } from "./lib/logger.js";
import { getDb } from "./lib/db.js";
import { initStore } from "./engine/store.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "uirefiner-server", time: new Date().toISOString() });
});

app.use("/api/settings", settingsRouter);
app.use("/api/agent", agentRouter);
app.use("/api/apps", appsRouter);

// 启动即初始化 DB schema（user_settings 来自 docStudio 拷贝件，ui_deltas 为本 Demo 新增）
getDb();
initStore();

app.listen(PORT, () => {
  logger.info(`[UIRefiner] server listening on http://localhost:${PORT}`);
});
