/**
 * applyChanges — 引擎核心：把布局意图 DSL 应用到控件树上的【纯函数】。
 *
 * 预览与正式应用调用同一个实现（PRD 设计决策 D5），保证"预览=应用"。
 * 任何动作执行失败都不抛异常，而是收集进 errors，让上层决定重试或降级。
 */
import type { LayoutAction } from "../../../shared/src/types/dsl.js";
import {
  GROUP_MAX_TARGETS,
  SETPROP_WHITELIST,
  type TreeNode,
} from "../../../shared/src/types/controlTree.js";

export interface ApplyResult {
  tree: TreeNode; // 深拷贝后的新树（原树不可变）
  applied: LayoutAction[];
  errors: Array<{ index: number; change: LayoutAction; error: string }>;
}

function cloneTree(node: TreeNode): TreeNode {
  return { ...node, props: node.props ? { ...node.props } : undefined, children: node.children?.map(cloneTree) };
}

export function findNode(node: TreeNode, id: string): TreeNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function findParent(node: TreeNode, id: string): { parent: TreeNode; index: number } | undefined {
  const children = node.children ?? [];
  const idx = children.findIndex((c) => c.id === id);
  if (idx >= 0) return { parent: node, index: idx };
  for (const child of children) {
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function contains(node: TreeNode, id: string): boolean {
  return findNode(node, id) !== undefined;
}

/** 生成 group 节点 id —— 确定性（差量在升级后的 v2 树上重放需得到一致结果） */
function groupId(title: string, existingIds: Set<string>): string {
  const slug = title.replace(/\s+/g, "-") || "group";
  let id = `group-${slug}`;
  let n = 2;
  while (existingIds.has(id)) id = `group-${slug}-${n++}`;
  return id;
}

function collectIds(node: TreeNode, into: Set<string>): void {
  into.add(node.id);
  for (const c of node.children ?? []) collectIds(c, into);
}

export function applyChanges(tree: TreeNode, changes: LayoutAction[]): ApplyResult {
  const root = cloneTree(tree);
  const applied: LayoutAction[] = [];
  const errors: ApplyResult["errors"] = [];

  changes.forEach((change, index) => {
    const err = (error: string) => errors.push({ index, change, error });
    const action = change.action;

    if (action === "group") {
      const targets = change.targets ?? [];
      if (targets.length < 2) return err("group 至少需要 2 个 targets");
      if (targets.length > GROUP_MAX_TARGETS) return err(`group 最多 ${GROUP_MAX_TARGETS} 个 targets`);
      const parents = new Set<string>();
      for (const t of targets) {
        const loc = findParent(root, t);
        if (!loc) return err(`group target 不存在: ${t}`);
        parents.add(loc.parent.id);
      }
      if (parents.size > 1) return err("group 的 targets 必须在同一个父容器内");
      const loc = findParent(root, targets[0])!;
      const node = groupId(change.title ?? "分组", new Set(collectIdsAll(root)));
      const members = targets.map((t) => {
        const l = findParent(root, t)!;
        const [n] = l.parent.children!.splice(l.index, 1);
        return n;
      });
      // 插到第一个 target 原来的位置
      loc.parent.children!.splice(Math.min(loc.index, loc.parent.children!.length), 0, {
        id: node,
        type: "group",
        label: change.title ?? "分组",
        children: members,
      });
      applied.push(change);
      return;
    }

    const targetId = change.target;
    if (!targetId) return err("缺少 target");
    const targetLoc = findParent(root, targetId);
    if (!targetLoc) return err(`target 不存在: ${targetId}`);
    const targetNode = findNode(root, targetId)!;

    switch (action) {
      case "hide":
      case "show": {
        targetNode.props = { ...targetNode.props, hidden: action === "hide" };
        applied.push(change);
        break;
      }
      case "collapse":
      case "expand": {
        targetNode.props = { ...targetNode.props, collapsed: action === "collapse" };
        applied.push(change);
        break;
      }
      case "rename": {
        if (!change.label?.trim()) return err("rename 缺少 label");
        targetNode.label = change.label.trim();
        applied.push(change);
        break;
      }
      case "setProp": {
        if (!change.prop || !SETPROP_WHITELIST.has(change.prop)) {
          return err(`setProp.prop 必须在白名单内: ${[...SETPROP_WHITELIST].join("/")}`);
        }
        if (change.prop === "layout" && change.value !== "row" && change.value !== "column") {
          return err("setProp layout 只支持 row|column");
        }
        if (change.value === undefined) return err("setProp 缺少 value");
        targetNode.props = { ...targetNode.props, [change.prop]: change.value };
        applied.push(change);
        break;
      }
      case "move":
      case "moveColumn": {
        if (targetId === root.id) return err("不能移动根节点");
        // moveColumn 语义：必须在同一表格内移动
        if (action === "moveColumn") {
          const loc = findParent(root, targetId)!;
          if (loc.parent.type !== "table") return err(`moveColumn 的 target 必须是表格列: ${targetId}`);
        }
        // 解除原位置
        const [node] = targetLoc.parent.children!.splice(targetLoc.index, 1);

        let newParent: TreeNode;
        let insertIndex: number;
        if (action === "moveColumn") {
          newParent = targetLoc.parent; // 列只能在原表格内移动
          if (change.after) {
            const anchorIdx = newParent.children!.findIndex((c) => c.id === change.after);
            if (anchorIdx < 0) return err(`moveColumn.after 不存在: ${change.after}`);
            insertIndex = anchorIdx + 1;
          } else if (change.index) {
            insertIndex = Math.min(Math.max(change.index - 1, 0), newParent.children!.length);
          } else {
            insertIndex = newParent.children!.length;
          }
        } else {
          const anchorId = change.after ?? change.before; // below≡after, above≡before
          if (!anchorId) return err("move 需要 before/after 锚点");
          if (contains(node, anchorId)) return err("锚点不能位于被移动节点的子树内");
          const anchorLoc = findParent(root, anchorId);
          if (!anchorLoc) return err(`锚点不存在: ${anchorId}`);
          newParent = anchorLoc.parent;
          insertIndex = anchorLoc.index + (change.after ? 1 : 0);
        }
        newParent.children!.splice(Math.min(insertIndex, newParent.children!.length), 0, node);
        applied.push(change);
        break;
      }
      default:
        return err(`未知动作: ${action as string}`);
    }
  });

  return { tree: root, applied, errors };
}

function collectIdsAll(root: TreeNode): string[] {
  const ids: string[] = [];
  const walk = (n: TreeNode) => {
    ids.push(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return ids;
}

/** 校验 changes 是否能全部合法应用（不修改原树）；返回错误列表（空 = 全部合法） */
export function validateChanges(tree: TreeNode, changes: LayoutAction[]): string[] {
  const { errors } = applyChanges(tree, changes);
  return errors.map((e) => `#${e.index + 1} ${e.change.action}: ${e.error}`);
}
