/**
 * LLM 回复的 zod 校验（§9.2 第三道防线的结构层）。
 *
 * 结构化输出的 envelope schema 在 shared 的 AGENT_REPLY_JSON_SCHEMA（宽松），
 * 这里做精确校验：动作词汇表封闭 + 各回复态的必备字段。
 */
import { z } from "zod";
import type { AgentReply, LayoutAction } from "../../../shared/src/types/dsl.js";

export const LayoutActionZ = z.object({
  action: z.enum([
    "move",
    "hide",
    "show",
    "collapse",
    "expand",
    "rename",
    "group",
    "moveColumn",
    "setProp",
  ]),
  target: z.string().optional(),
  targets: z.array(z.string()).optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  index: z.number().int().min(1).optional(),
  label: z.string().optional(),
  title: z.string().optional(),
  prop: z.string().optional(),
  value: z.string().optional(),
});

export const AgentReplyZ = z.object({
  type: z.enum(["changes", "clarify", "reject"]),
  changes: z.array(LayoutActionZ).optional(),
  note: z.string().optional(),
  question: z.string().optional(),
  reason: z.string().optional(),
});

/** 结构校验（词汇表 + envelope 完整性）；返回错误列表（空 = 合法），并给出规范化结果 */
export function parseReply(raw: unknown): { reply?: AgentReply; issues: string[] } {
  const parsed = AgentReplyZ.safeParse(raw);
  if (!parsed.success) {
    return { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const r = parsed.data;
  if (r.type === "changes") {
    if (!r.changes || r.changes.length === 0) return { issues: ["type=changes 但 changes 为空"] };
    return { reply: { type: "changes", changes: r.changes as LayoutAction[], note: r.note }, issues: [] };
  }
  if (r.type === "clarify") {
    if (!r.question?.trim()) return { issues: ["type=clarify 但缺少 question"] };
    return { reply: { type: "clarify", question: r.question.trim() }, issues: [] };
  }
  if (!r.reason?.trim()) return { issues: ["type=reject 但缺少 reason"] };
  return { reply: { type: "reject", reason: r.reason.trim() }, issues: [] };
}
