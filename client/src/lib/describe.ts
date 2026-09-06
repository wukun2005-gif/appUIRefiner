/**
 * 把 LayoutAction 翻译成人话（预览清单 / 差量视图 / diff 行共用）
 */
import type { LayoutAction } from "../../../shared/src/types/dsl";
import type { TreeNode } from "../../../shared/src/types/controlTree";

export function findLabel(tree: TreeNode, id: string): string {
  if (tree.id === id) return tree.label;
  for (const child of tree.children ?? []) {
    const hit = findLabel(child, id);
    if (hit !== id) return hit;
  }
  return id;
}

const TYPE_NAME: Record<string, string> = {
  panel: "区域",
  form: "表单",
  field: "字段",
  textarea: "文本框",
  table: "表格",
  column: "列",
  button: "按钮",
  group: "分组",
  collapsible: "折叠区",
};

export function describeChange(change: LayoutAction, baseTree: TreeNode): string {
  const L = (id?: string) => (id ? findLabel(baseTree, id) : id ?? "");
  const T = (id?: string) => (id ? findLabel(baseTree, id) : "");
  switch (change.action) {
    case "move": {
      const anchor = change.before ? `${L(change.before)}之前` : `${L(change.after)}之后`;
      return `将「${L(change.target)}」移动到 ${anchor}`;
    }
    case "hide":
      return `隐藏「${L(change.target)}」`;
    case "show":
      return `恢复显示「${L(change.target)}」`;
    case "collapse":
      return `折叠「${L(change.target)}」`;
    case "expand":
      return `展开「${L(change.target)}」`;
    case "rename":
      return `「${L(change.target)}」改名为「${change.label}」`;
    case "group":
      return `将 ${change.targets?.map((t) => `「${T(t)}」`).join("、")} 合并为分组「${change.title}」`;
    case "moveColumn":
      return change.after
        ? `表格列「${L(change.target)}」移动到「${L(change.after)}」之后`
        : `表格列「${L(change.target)}」移动到第 ${change.index} 列`;
    case "setProp":
      return `调整「${L(change.target)}」的 ${change.prop} → ${change.value}`;
    default:
      return String(change);
  }
}

export function nodeType(tree: TreeNode, id: string): string {
  const walk = (n: TreeNode): string | undefined => {
    if (n.id === id) return TYPE_NAME[n.type] ?? n.type;
    for (const c of n.children ?? []) {
      const hit = walk(c);
      if (hit) return hit;
    }
  };
  return walk(tree) ?? "";
}
