/**
 * /api/apps — base app 元信息 / 树 / 差量 / 升级模拟 / 导出
 */
import { Router } from "express";
import { APP_METAS, getAppMeta, getBaseTree, APP_LATEST_VERSION } from "../data/apps.js";
import { getEffectiveTree } from "../engine/effective.js";
import { listDeltas, setBaseVersion, getBaseVersion } from "../engine/store.js";
import type { ChangePackage } from "../../../shared/src/types/delta.js";
import { logger } from "../lib/logger.js";

export const appsRouter = Router();

appsRouter.get("/", (_req, res) => {
  res.json({ ok: true, apps: APP_METAS });
});

appsRouter.get("/:id/tree", (req, res) => {
  const meta = getAppMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: `Unknown app: ${req.params.id}` });
    return;
  }
  const variant = (req.query.variant as string) || meta.variants[0].id;
  const { tree, baseVersion } = getEffectiveTree(meta.id, variant);
  res.json({ ok: true, tree, baseVersion, variant });
});

appsRouter.get("/:id/base-tree", (req, res) => {
  const meta = getAppMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: `Unknown app: ${req.params.id}` });
    return;
  }
  const baseVersion = getBaseVersion(meta.id);
  const tree = getBaseTree(meta.id, baseVersion) ?? getBaseTree(meta.id, "v1")!;
  res.json({ ok: true, tree, baseVersion });
});

appsRouter.get("/:id/deltas", (req, res) => {
  const meta = getAppMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: `Unknown app: ${req.params.id}` });
    return;
  }
  const variant = (req.query.variant as string) || meta.variants[0].id;
  res.json({ ok: true, deltas: listDeltas(meta.id, variant) });
});

/** 升级模拟（仅 App B）：base tree 切到最新版，差量重放（FR-8） */
appsRouter.post("/:id/upgrade-simulate", (req, res) => {
  const meta = getAppMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: `Unknown app: ${req.params.id}` });
    return;
  }
  if (!meta.features.upgradeSimulate) {
    res.status(400).json({ ok: false, error: "该应用不支持升级模拟（仅路线 B 的 App B 提供）" });
    return;
  }
  const variantId = (req.body?.variantId as string) || meta.variants[0].id;
  const target = APP_LATEST_VERSION[meta.id];
  setBaseVersion(meta.id, target);
  const { tree, baseVersion } = getEffectiveTree(meta.id, variantId);
  logger.info(`[Apps] ${meta.id} 升级模拟 → base=${target}, variant=${variantId}`);
  res.json({ ok: true, baseVersion, tree, note: "厂商应用已升级（模拟）：新增「物流单号」字段并更新主题，你的所有定制仍然生效。" });
});

/** 导出变更包（仅 App A）：把当前全部差量导出为 JSON（FR-9） */
appsRouter.get("/:id/export", (req, res) => {
  const meta = getAppMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: `Unknown app: ${req.params.id}` });
    return;
  }
  if (!meta.features.exportPackage) {
    res.status(400).json({ ok: false, error: "该应用不支持导出变更包（仅路线 A 的 App A 提供）" });
    return;
  }
  const variantId = (req.query.variant as string) || meta.variants[0].id;
  const pkg: ChangePackage = {
    appId: meta.id,
    exportedAt: new Date().toISOString(),
    note: "UIRefiner SDK 变更包：可直接交由软件开发商合入标准版",
    deltas: listDeltas(meta.id, variantId)
      .filter((d) => !d.reverted)
      .map((d) => ({ id: d.id, request: d.request, changes: d.changes })),
  };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="uirefiner-package-${meta.id}.json"`);
  res.send(JSON.stringify(pkg, null, 2));
});
