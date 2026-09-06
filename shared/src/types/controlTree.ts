/**
 * 控件树节点类型 — 两个 base app 通用的声明式 UI 描述。
 *
 * 设计要点：界面 = JSON 树 → 运行时渲染。"差量改造" = 对树打补丁，
 * 因此树本身不可变（base 随代码发布），所有用户定制都以 Delta 叠加。
 */

export type TreeNodeType =
  | "panel" // 区域容器（layout: row | column）
  | "form" // 表单容器（纵向排列字段）
  | "field" // 单行输入字段
  | "textarea" // 多行文本
  | "table" // 表格（children = 列）
  | "column" // 表格列（仅作为 table 的直接子节点有意义）
  | "button" // 按钮
  | "group" // 字段分组（带标题的卡片）
  | "collapsible"; // 可折叠区域（标题行 + 内容）

export interface TreeNode {
  id: string; // 稳定 id，如 "field-internal-note"；Delta 的 target 引用此 id
  type: TreeNodeType;
  label: string;
  props?: TreeNodeProps;
  children?: TreeNode[];
}

/** 渲染与行为相关的属性；setProp 动作只能写入 prop 白名单中的键 */
export interface TreeNodeProps {
  hidden?: boolean; // hide/show 动作写入
  collapsed?: boolean; // collapse/expand 动作写入（仅 collapsible）
  layout?: "row" | "column"; // 仅 panel：子节点排布方向
  width?: string; // CSS 宽度（如 "60%"）
  align?: "left" | "center" | "right";
  placeholder?: string;
  theme?: string; // 仅根节点：主题色标记（升级模拟会用）
}

/** setProp 允许写入的属性白名单（越界 = 校验失败） */
export const SETPROP_WHITELIST: ReadonlySet<string> = new Set([
  "layout",
  "width",
  "align",
  "placeholder",
]);

/** group 动作允许合并的最大字段数 */
export const GROUP_MAX_TARGETS = 8;
