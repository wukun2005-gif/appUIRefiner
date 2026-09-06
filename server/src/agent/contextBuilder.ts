/**
 * contextBuilder（T2.1）— effective tree → 紧凑文本控件树（每控件一行）。
 *
 * 给 LLM 的 target 引用提供"有据可依"的控件清单：id / 类型 / 标签 / 状态。
 */
import type { TreeNode } from "../../../shared/src/types/controlTree.js";

export function serializeTree(root: TreeNode): string {
  const lines: string[] = [];
  const walk = (node: TreeNode, depth: number) => {
    const indent = "  ".repeat(depth);
    const state: string[] = [];
    if (node.props?.hidden) state.push("已隐藏");
    if (node.props?.collapsed) state.push("已折叠");
    if (node.type === "panel" && node.props?.layout) state.push(`layout=${node.props.layout}`);
    const stateText = state.length > 0 ? `（${state.join("，")}）` : "";
    lines.push(`${indent}${node.type} ${node.id} 「${node.label}」${stateText}`);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(root, 0);
  return lines.join("\n");
}

export function buildContextMessage(tree: TreeNode, appName: string): string {
  return [
    `【当前界面控件树 — ${appName}】`,
    "缩进表示层级；修改 target 只能引用下列 id：",
    serializeTree(tree),
  ].join("\n");
}
