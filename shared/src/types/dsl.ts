/**
 * 布局意图 DSL — LLM 输出的封闭词汇表 + agent 回复 envelope。
 *
 * 安全设计：动作集合封闭且 schema 强校验，业务逻辑类变更（改数据、改计算、
 * 改流程）在本 DSL 中【不可表达】——这是越界拒绝的机制基础（PRD §8/§9.2）。
 */

export type LayoutActionType =
  | "move"
  | "hide"
  | "show"
  | "collapse"
  | "expand"
  | "rename"
  | "group"
  | "moveColumn"
  | "setProp";

export interface LayoutAction {
  action: LayoutActionType;
  /** 目标控件 id（group 动作除外，其用 targets） */
  target?: string;
  /** group 动作：被合并的字段 id 列表 */
  targets?: string[];
  /** move：插入到锚点控件之前/之后（成为其兄弟节点） */
  before?: string;
  after?: string;
  /** moveColumn：目标列索引（从 1 开始；与 after 二选一） */
  index?: number;
  /** rename：新标签 */
  label?: string;
  /** group：分组标题 */
  title?: string;
  /** setProp：属性名（白名单）与值 */
  prop?: string;
  value?: string;
}

/** LLM 回复 envelope —— changes / clarify / reject 三态，全部受 schema 约束 */
export type AgentReply =
  | { type: "changes"; changes: LayoutAction[]; note?: string }
  | { type: "clarify"; question: string }
  | { type: "reject"; reason: string };

export const AGENT_REPLY_TYPES = ["changes", "clarify", "reject"] as const;

/** 供 LLM 结构化输出用的宽松 envelope schema（strict:false，精校验交给 zod + 修复循环） */
export const AGENT_REPLY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["changes", "clarify", "reject"] },
    changes: {
      type: "array",
      items: { type: "object" },
    },
    note: { type: "string" },
    question: { type: "string" },
    reason: { type: "string" },
  },
  required: ["type"],
};
