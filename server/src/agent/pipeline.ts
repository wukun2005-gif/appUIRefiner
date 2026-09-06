/**
 * Agent 管线（§9 Agent 管线 / §9.2 四道防线）：
 *
 *   用户输入 → 控件树上/下文 → LLM（结构化输出）→ jsonrepair → zod 结构校验
 *   → 语义校验（target 存在性）→ 失败带错误原文回传重试（≤2 次）→ AgentReply
 *
 * 模型配置完全复用 docStudio 体系（settingsReader + registry 三级回退）。
 */
import { jsonrepair } from "jsonrepair";
import { registry } from "../providers/registry.js";
import { readSettingsFromDb } from "../lib/settingsReader.js";
import { logger } from "../lib/logger.js";
import type { AgentReply } from "../../../shared/src/types/dsl.js";
import type { TreeNode } from "../../../shared/src/types/controlTree.js";
import { getAppMeta, getBaseTree } from "../data/apps.js";
import { getEffectiveTree } from "../engine/effective.js";
import { applyChanges } from "../engine/applyChanges.js";
import { parseReply } from "./schema.js";
import { buildContextMessage } from "./contextBuilder.js";
import { SYSTEM_PROMPT, buildMessages, type HistoryTurn } from "./prompts.js";
import { offlineLookup } from "./offline.js";

export interface AgentRequestInput {
  appId: string;
  variantId: string;
  message: string;
  history: HistoryTurn[];
  offline?: boolean;
}

export interface AgentRequestResult {
  reply: AgentReply;
  previewTree?: TreeNode;
  usedOffline: boolean;
  repairRounds: number;
}

const MAX_REPAIR_ROUNDS = 2;
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.1;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(jsonrepair(trimmed));
  }
}

function resolveModelPreference(): {
  providerPreference: string[];
  modelId: string;
  providerApiKeys: Record<string, string>;
  providerBaseUrls: Record<string, string>;
} | { error: string } {
  const settings = readSettingsFromDb();
  const providerPreference = settings.providerPreference ?? [];
  if (providerPreference.length === 0 || !settings.providerApiKeys || Object.keys(settings.providerApiKeys).length === 0) {
    return { error: "尚未配置模型：请点击右上角「模型设置」，配置任一 Provider 的 API Key 与模型后保存。" };
  }
  const primary = providerPreference[0];
  const modelId = settings.modelId || settings.modelFallbacks?.[primary]?.[0] || "";
  if (!modelId) {
    return { error: "尚未选择模型：请到「模型设置」为 Provider 勾选模型并设为默认。" };
  }
  return {
    providerPreference,
    modelId,
    providerApiKeys: settings.providerApiKeys,
    providerBaseUrls: settings.providerBaseUrls ?? {},
  };
}

export async function runAgentRequest(input: AgentRequestInput): Promise<AgentRequestResult> {
  const meta = getAppMeta(input.appId);
  if (!meta) throw new Error(`Unknown app: ${input.appId}`);
  const { tree } = getEffectiveTree(input.appId, input.variantId);

  // 离线兜底：跳过 LLM，其余路径不变
  if (input.offline) {
    const cached = offlineLookup(input.appId, input.message);
    const reply: AgentReply =
      cached ?? { type: "reject", reason: "离线模式仅支持预置指令（点击输入框上方的指令按钮）。" };
    return { reply, previewTree: reply.type === "changes" ? applyChanges(tree, reply.changes).tree : undefined, usedOffline: true, repairRounds: 0 };
  }

  const pref = resolveModelPreference();
  if ("error" in pref) {
    return { reply: { type: "reject", reason: pref.error }, usedOffline: false, repairRounds: 0 };
  }

  const contextMessage = buildContextMessage(tree, meta.name);
  let messages = buildMessages(SYSTEM_PROMPT, contextMessage, input.history ?? [], input.message);
  let repairRounds = 0;
  let lastIssues: string[] = [];

  while (repairRounds <= MAX_REPAIR_ROUNDS) {
    const { response } = await registry.runWithFallback(
      pref.providerPreference,
      {
        modelId: pref.modelId,
        apiKey: pref.providerApiKeys[pref.providerPreference[0]] ?? "",
        messages,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
        responseFormat: {
          type: "json_schema",
          json_schema: { name: "uirefiner_reply", strict: false, schema: { type: "object" } as Record<string, unknown> },
        },
      },
      undefined,
      undefined,
      pref.providerApiKeys,
      pref.providerBaseUrls,
    );

    if (response.error || !response.text) {
      logger.warn(`[Pipeline] LLM 错误: ${response.error?.code} ${response.error?.message}`);
      return {
        reply: { type: "reject", reason: `模型调用失败：${response.error?.message ?? "空响应"}。可开启离线模式重试预置指令。` },
        usedOffline: false,
        repairRounds,
      };
    }

    let parsed: { reply?: AgentReply; issues: string[] };
    try {
      parsed = parseReply(extractJson(response.text));
    } catch (e) {
      parsed = { issues: [`输出不是合法 JSON：${e instanceof Error ? e.message : String(e)}`] };
    }

    if (parsed.reply && parsed.reply.type === "changes") {
      // 语义校验：target / 锚点必须存在于当前控件树
      const semanticErrors = applyChanges(tree, parsed.reply.changes).errors;
      if (semanticErrors.length === 0) {
        return {
          reply: parsed.reply,
          previewTree: applyChanges(tree, parsed.reply.changes).tree,
          usedOffline: false,
          repairRounds,
        };
      }
      lastIssues = semanticErrors.map((e) => `动作 #${e.index + 1} (${e.change.action}): ${e.error}`);
    } else if (parsed.reply) {
      // clarify / reject 无需语义校验
      return { reply: parsed.reply, usedOffline: false, repairRounds };
    } else {
      lastIssues = parsed.issues;
    }

    // 修复轮：把错误原文回传给模型（§9.2 第三道防线）
    repairRounds += 1;
    if (repairRounds > MAX_REPAIR_ROUNDS) break;
    logger.info(`[Pipeline] 修复轮 ${repairRounds}: ${lastIssues.join("; ")}`);
    messages = [
      ...messages,
      { role: "assistant", content: response.text },
      {
        role: "user",
        content: `你的输出存在以下问题：\n${lastIssues.map((i) => `- ${i}`).join("\n")}\n请重新只输出一个符合规则的 JSON。可用控件 id 见最开始的控件树。`,
      },
    ];
  }

  return {
    reply: {
      type: "reject",
      reason: `连续 ${MAX_REPAIR_ROUNDS + 1} 次未能生成合法修改（最后问题：${lastIssues.join("; ")}）。请换个说法，或点击指令按钮使用预置指令。`,
    },
    usedOffline: false,
    repairRounds,
  };
}

/** 供 golden 脚本复用：跳过离线判断的直接调用入口即 runAgentRequest（offline:false） */
export { getBaseTree };
