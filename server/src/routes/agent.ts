/**
 * /api/agent — 自然语言改造入口：request（LLM/离线 → DSL）、apply、revert
 */
import { Router } from "express";
import type { LayoutAction } from "../../../shared/src/types/dsl.js";
import { getAppMeta } from "../data/apps.js";
import { getEffectiveTree } from "../engine/effective.js";
import { validateChanges } from "../engine/applyChanges.js";
import { addDelta, getDelta, markReverted } from "../engine/store.js";
import { runAgentRequest } from "../agent/pipeline.js";
import type { HistoryTurn } from "../agent/prompts.js";
import { logger } from "../lib/logger.js";

export const agentRouter = Router();

agentRouter.post("/request", async (req, res) => {
  try {
    const { appId, variantId, message, history, offline } = req.body as {
      appId: string;
      variantId: string;
      message: string;
      history?: HistoryTurn[];
      offline?: boolean;
    };
    if (!appId || !variantId || !message?.trim()) {
      res.status(400).json({ ok: false, error: "appId / variantId / message 必填" });
      return;
    }
    if (!getAppMeta(appId)) {
      res.status(404).json({ ok: false, error: `Unknown app: ${appId}` });
      return;
    }
    const result = await runAgentRequest({
      appId,
      variantId,
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      offline: Boolean(offline),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Agent] request 失败: ${msg}`);
    res.status(500).json({ ok: false, error: msg });
  }
});

agentRouter.post("/apply", (req, res) => {
  try {
    const { appId, variantId, changes, request } = req.body as {
      appId: string;
      variantId: string;
      changes: LayoutAction[];
      request: string;
    };
    if (!appId || !variantId || !Array.isArray(changes) || changes.length === 0) {
      res.status(400).json({ ok: false, error: "appId / variantId / changes 必填" });
      return;
    }
    const { tree } = getEffectiveTree(appId, variantId);
    const errors = validateChanges(tree, changes);
    if (errors.length > 0) {
      res.status(400).json({ ok: false, error: "存在无法应用的变更", errors });
      return;
    }
    const delta = addDelta(appId, variantId, changes, request ?? "");
    const after = getEffectiveTree(appId, variantId);
    res.json({ ok: true, delta, tree: after.tree });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Agent] apply 失败: ${msg}`);
    res.status(500).json({ ok: false, error: msg });
  }
});

agentRouter.post("/revert", (req, res) => {
  try {
    const { deltaId } = req.body as { deltaId: string };
    const delta = getDelta(deltaId);
    if (!delta) {
      res.status(404).json({ ok: false, error: `delta 不存在: ${deltaId}` });
      return;
    }
    markReverted(deltaId);
    const after = getEffectiveTree(delta.appId, delta.variantId);
    res.json({ ok: true, tree: after.tree });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Agent] revert 失败: ${msg}`);
    res.status(500).json({ ok: false, error: msg });
  }
});
