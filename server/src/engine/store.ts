/**
 * 差量存储 — SQLite（ui_deltas 表）+ base 版本（复用 docStudio 的 user_settings 表）。
 *
 * 差量按 (appId, variantId) 归属；effective tree = base ⊕ 未回滚差量（按创建顺序）。
 */
import type { LayoutAction } from "../../../shared/src/types/dsl.js";
import type { Delta } from "../../../shared/src/types/delta.js";
import { dbRun, dbGet, dbAll } from "../lib/dbQuery.js";
import { logger } from "../lib/logger.js";

let initialized = false;

export function initStore(): void {
  if (initialized) return;
  dbRun(
    `CREATE TABLE IF NOT EXISTS ui_deltas (
      id         TEXT PRIMARY KEY,
      app_id     TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      changes    TEXT NOT NULL,
      request    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      reverted   INTEGER NOT NULL DEFAULT 0
    )`,
    [],
    false, // DDL 关闭审计（dbRun 的审计会读旧值，DDL 无表可读）
  );
  initialized = true;
  logger.info("[Store] ui_deltas ready");
}

export function addDelta(appId: string, variantId: string, changes: LayoutAction[], request: string): Delta {
  initStore();
  const delta: Delta = {
    id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    appId,
    variantId,
    changes,
    request,
    createdAt: Date.now(),
  };
  dbRun(
    "INSERT INTO ui_deltas (id, app_id, variant_id, changes, request, created_at, reverted) VALUES (?, ?, ?, ?, ?, ?, 0)",
    [delta.id, appId, variantId, JSON.stringify(changes), request, delta.createdAt],
  );
  return delta;
}

export function listDeltas(appId: string, variantId?: string): Delta[] {
  initStore();
  const rows = variantId
    ? dbAll<{ id: string; app_id: string; variant_id: string; changes: string; request: string; created_at: number; reverted: number }>(
        "SELECT * FROM ui_deltas WHERE app_id = ? AND variant_id = ? ORDER BY created_at ASC",
        [appId, variantId],
      )
    : dbAll<{ id: string; app_id: string; variant_id: string; changes: string; request: string; created_at: number; reverted: number }>(
        "SELECT * FROM ui_deltas WHERE app_id = ? ORDER BY created_at ASC",
        [appId],
      );
  return rows.map((r) => ({
    id: r.id,
    appId: r.app_id,
    variantId: r.variant_id,
    changes: JSON.parse(r.changes) as LayoutAction[],
    request: r.request,
    createdAt: r.created_at,
    reverted: r.reverted === 1,
  }));
}

export function getDelta(deltaId: string): Delta | undefined {
  initStore();
  const r = dbGet<{ id: string; app_id: string; variant_id: string; changes: string; request: string; created_at: number; reverted: number }>(
    "SELECT * FROM ui_deltas WHERE id = ?",
    [deltaId],
  );
  if (!r) return undefined;
  return {
    id: r.id,
    appId: r.app_id,
    variantId: r.variant_id,
    changes: JSON.parse(r.changes) as LayoutAction[],
    request: r.request,
    createdAt: r.created_at,
    reverted: r.reverted === 1,
  };
}

export function markReverted(deltaId: string): void {
  initStore();
  dbRun("UPDATE ui_deltas SET reverted = 1 WHERE id = ?", [deltaId]);
}

// ── base 版本（升级模拟用，存 user_settings 表） ─────────────────

export function getBaseVersion(appId: string): string {
  const row = dbGet<{ value: string }>("SELECT value FROM user_settings WHERE key = ?", [`base_version_${appId}`]);
  return row?.value ?? "v1";
}

export function setBaseVersion(appId: string, version: string): void {
  dbRun(
    `INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [`base_version_${appId}`, version],
  );
}
