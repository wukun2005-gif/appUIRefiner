/**
 * 客户端 API 封装 — 类型从 shared 源码直接引入（与 docStudio 同构的 monorepo 布局）
 */
import type { AppMeta, ChangePackage, Delta } from "../../../shared/src/types/delta";
import type { TreeNode } from "../../../shared/src/types/controlTree";
import type { AgentReply, LayoutAction } from "../../../shared/src/types/dsl";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export const api = {
  health: () => j<{ ok: boolean }>("/api/health"),
  apps: () => j<{ ok: boolean; apps: AppMeta[] }>("/api/apps"),
  tree: (appId: string, variantId: string) =>
    j<{ ok: boolean; tree: TreeNode; baseVersion: string; variant: string }>(
      `/api/apps/${appId}/tree?variant=${encodeURIComponent(variantId)}`,
    ),
  baseTree: (appId: string) =>
    j<{ ok: boolean; tree: TreeNode; baseVersion: string }>(`/api/apps/${appId}/base-tree`),
  deltas: (appId: string, variantId: string) =>
    j<{ ok: boolean; deltas: Delta[] }>(`/api/apps/${appId}/deltas?variant=${encodeURIComponent(variantId)}`),
  agentRequest: (body: { appId: string; variantId: string; message: string; history: HistoryTurn[]; offline: boolean }) =>
    j<{ ok: boolean; reply: AgentReply; previewTree?: TreeNode; usedOffline: boolean; repairRounds: number }>(
      "/api/agent/request",
      { method: "POST", body: JSON.stringify(body) },
    ),
  agentApply: (body: { appId: string; variantId: string; changes: LayoutAction[]; request: string }) =>
    j<{ ok: boolean; delta: Delta; tree: TreeNode }>("/api/agent/apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  agentRevert: (deltaId: string) =>
    j<{ ok: boolean; tree: TreeNode }>("/api/agent/revert", {
      method: "POST",
      body: JSON.stringify({ deltaId }),
    }),
  upgradeSimulate: (appId: string, variantId: string) =>
    j<{ ok: boolean; baseVersion: string; tree: TreeNode; note: string }>(`/api/apps/${appId}/upgrade-simulate`, {
      method: "POST",
      body: JSON.stringify({ variantId }),
    }),
  exportPackage: (appId: string, variantId: string) =>
    j<ChangePackage>(`/api/apps/${appId}/export?variant=${encodeURIComponent(variantId)}`),
};
