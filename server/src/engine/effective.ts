/**
 * effective tree — base(按版本) ⊕ 未回滚差量（按创建顺序重放）。
 * 升级模拟 = base 换版本后重放差量（升级安全的机制核心）。
 */
import type { TreeNode } from "../../../shared/src/types/controlTree.js";
import { getBaseTree } from "../data/apps.js";
import { applyChanges } from "./applyChanges.js";
import { getBaseVersion, listDeltas } from "./store.js";
import { logger } from "../lib/logger.js";

export function getEffectiveTree(appId: string, variantId: string): { tree: TreeNode; baseVersion: string } {
  const baseVersion = getBaseVersion(appId);
  let tree = getBaseTree(appId, baseVersion);
  if (!tree) {
    // 兜底：版本数据缺失时回 v1
    tree = getBaseTree(appId, "v1")!;
  }
  const deltas = listDeltas(appId, variantId).filter((d) => !d.reverted);
  for (const delta of deltas) {
    const result = applyChanges(tree, delta.changes);
    if (result.errors.length > 0) {
      logger.warn(
        `[Effective] delta ${delta.id} 有 ${result.errors.length} 个动作未生效: ${result.errors.map((e) => e.error).join("; ")}`,
      );
    }
    tree = result.tree;
  }
  return { tree, baseVersion };
}
