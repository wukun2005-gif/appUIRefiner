/**
 * App 根组件 — 应用选择页 ↔ base app 视图（含预览确认栏、角色切换、设置入口、离线开关）
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { AppPicker } from "./components/AppPicker";
import { BaseApp } from "./components/BaseApp";
import { AIPanel } from "./components/AIPanel";
import { Settings } from "./components/Settings";
import type { AppMeta, Delta } from "../../shared/src/types/delta";
import type { TreeNode } from "../../shared/src/types/controlTree";
import type { LayoutAction } from "../../shared/src/types/dsl";

export interface PreviewState {
  changes: LayoutAction[];
  tree: TreeNode;
  note?: string;
  request: string; // 产生这次修改的用户原话（差量记录用）
}

export function App() {
  const [current, setCurrent] = useState<AppMeta | null>(null);
  const [variantId, setVariantId] = useState<string>("personal");
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [baseTree, setBaseTree] = useState<TreeNode | null>(null);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [offline, setOffline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async (meta: AppMeta, v: string) => {
    try {
      const [t, b, d] = await Promise.all([
        api.tree(meta.id, v),
        api.baseTree(meta.id),
        api.deltas(meta.id, v),
      ]);
      setTree(t.tree);
      setBaseTree(b.tree);
      setDeltas(d.deltas);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const openApp = useCallback((meta: AppMeta) => {
    setCurrent(meta);
    setVariantId(meta.variants[0].id);
    setPreview(null);
    setOffline(false);
  }, []);

  useEffect(() => {
    if (current) refreshTree(current, variantId);
  }, [current, variantId, refreshTree]);

  const applyPreview = useCallback(async () => {
    if (!preview || !current) return;
    try {
      const res = await api.agentApply({
        appId: current.id,
        variantId,
        changes: preview.changes,
        request: preview.request,
      });
      setTree(res.tree);
      setPreview(null);
      refreshTree(current, variantId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [preview, current, variantId, refreshTree]);

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  if (!current) {
    return <AppPicker onOpen={openApp} onOpenSettings={() => setShowSettings(true)} />;
  }

  const shownTree = preview?.tree ?? tree;

  return (
    <div className="app-view">
      <header className="app-header">
        <button className="ghost" onClick={() => { setCurrent(null); setPreview(null); }}>← 应用列表</button>
        <div className="app-title">
          <h2>{current.name}</h2>
          <span className="route-badge">{current.route}</span>
        </div>
        <div className="header-actions">
          <label className="offline-toggle" title="演示现场网络/LLM 故障时的兜底：跳过在线模型，用预存的指令→DSL 映射，交互路径不变">
            <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
            离线兜底
          </label>
          <button className="ghost" onClick={() => setShowSettings(true)}>⚙ 模型设置</button>
        </div>
      </header>

      {preview && (
        <div className="preview-bar">
          <span>
            <b>预览（改动后）</b>
            {preview.note ? ` — ${preview.note}` : ""} 确认后才会真正应用并保存为差量。
          </span>
          <div className="preview-actions">
            <button className="primary" onClick={applyPreview}>✓ 应用修改</button>
            <button className="ghost" onClick={() => setPreview(null)}>✕ 放弃</button>
          </div>
        </div>
      )}

      {error && <div className="error global-error">{error}</div>}

      <div className="app-body">
        <div className="app-main">
          {shownTree && <BaseApp tree={shownTree} previewing={Boolean(preview)} />}
        </div>
        {tree && baseTree && (
          <AIPanel
            meta={current}
            variantId={variantId}
            tree={tree}
            baseTree={baseTree}
            deltas={deltas}
            offline={offline}
            onPreview={setPreview}
            onTreeReplaced={(t) => setTree(t)}
            onVariantChange={(v) => { setVariantId(v); setPreview(null); }}
            onDeltasChanged={() => refreshTree(current, variantId)}
          />
        )}
      </div>
    </div>
  );
}
