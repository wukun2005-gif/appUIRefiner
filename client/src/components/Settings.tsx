/**
 * 模型设置（裁剪自 docStudio 的 Settings.tsx LLM Tab，API 契约与拖拽机制保持一致）
 * - 12 家预置 Provider；每家：启停 / baseUrl / API Key / 模型勾选 / 默认模型 / 真实验证
 * - Provider 卡片可拖拽排序（localStorage 持久化，docStudio 同款机制）
 * - 已勾选模型构成回退链，可拖拽排序；「设默认」= 置顶链首（docStudio 同款语义）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModelCatalog } from "../lib/modelCatalog";

const PROVIDER_ORDER_KEY = "uirefiner-provider-order";
const FORMS_DRAFT_KEY = "uirefiner-forms-draft";

function loadProviderOrder(): string[] {
  try {
    const saved = localStorage.getItem(PROVIDER_ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveProviderOrder(order: string[]) {
  try {
    localStorage.setItem(PROVIDER_ORDER_KEY, JSON.stringify(order));
  } catch { /* ignore */ }
}

/** 表单草稿：输入即暂存本机，刷新后恢复（点「保存」才写服务端） */
function loadFormsDraft(): Record<string, Partial<ProviderForm>> | null {
  try {
    const saved = localStorage.getItem(FORMS_DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function saveFormsDraft(forms: Record<string, ProviderForm>) {
  try {
    localStorage.setItem(FORMS_DRAFT_KEY, JSON.stringify(forms));
  } catch { /* ignore */ }
}

interface ProviderForm {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  modelIds: string[]; // 勾选 + 拖拽形成的模型回退链（首项 = 链首）
  defaultModelId: string;
}

interface PresetProvider {
  id: string;
  displayName: string;
  desc: string;
  baseUrl: string;
  keyPlaceholder: string;
}

interface VerifyState {
  ok: boolean;
  error?: string;
}

export function Settings({ onClose }: { onClose: () => void }) {
  const { catalog } = useModelCatalog();
  const [presets, setPresets] = useState<PresetProvider[]>([]);
  const [forms, setForms] = useState<Record<string, ProviderForm>>({});
  const [liveModels, setLiveModels] = useState<Record<string, string[]>>({});
  const [verifies, setVerifies] = useState<Record<string, VerifyState>>({});
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);

  // 拖拽状态（docStudio 同款 refs 方案）
  const [providerOrder, setProviderOrder] = useState<string[]>(loadProviderOrder);
  const dragProviderItem = useRef<number | null>(null);
  const dragProviderOver = useRef<number | null>(null);
  const dragChainItem = useRef<{ providerId: string; index: number } | null>(null);
  const dragChainOver = useRef<{ providerId: string; index: number } | null>(null);
  const [dragOverProviderIdx, setDragOverProviderIdx] = useState<number | null>(null);
  const [dragOverChainIdx, setDragOverChainIdx] = useState<number | null>(null);
  const [modelQuery, setModelQuery] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const presetRes = await fetch("/api/settings/providers/presets").then((r) => r.json());
      setPresets(presetRes.presets ?? []);
      const saved = await fetch("/api/settings").then((r) => r.json());
      const all = saved.settings?.provider_all as { providers?: Array<Record<string, unknown>> } | undefined;
      const next: Record<string, ProviderForm> = {};
      for (const p of presetRes.presets ?? [] as PresetProvider[]) {
        const conf = all?.providers?.find((x) => x.providerId === p.id);
        next[p.id] = {
          enabled: Boolean(conf?.enabled),
          baseUrl: (conf?.baseUrl as string) || p.baseUrl,
          apiKey: (conf?.apiKeyRef as string) || "",
          modelIds: (conf?.modelIds as string[]) ?? [],
          defaultModelId: (conf?.defaultModelId as string) || "",
        };
      }
      // 本机草稿覆盖服务端配置（草稿 = 用户最新输入，含未点保存的内容）
      const draft = loadFormsDraft();
      if (draft) {
        for (const p of presetRes.presets ?? [] as PresetProvider[]) {
          const d = draft[p.id];
          if (d) next[p.id] = { ...next[p.id], ...d };
        }
      }
      setForms(next);
      setLoaded(true);
    })().catch((e) => {
      setToast({ ok: false, text: `加载配置失败：${e.message}` });
      setLoaded(true);
    });
  }, []);

  // 任何表单变化都自动写入本机草稿（等首次加载完成，避免空表单覆盖草稿）
  useEffect(() => {
    if (loaded) saveFormsDraft(forms);
  }, [forms, loaded]);

  const update = useCallback((id: string, patch: Partial<ProviderForm>) => {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const toggleModel = useCallback((id: string, modelId: string) => {
    setForms((prev) => {
      const f = prev[id];
      const has = f.modelIds.includes(modelId);
      const modelIds = has ? f.modelIds.filter((m) => m !== modelId) : [...f.modelIds, modelId];
      const defaultModelId = f.defaultModelId === modelId ? "" : f.defaultModelId;
      return { ...prev, [id]: { ...f, modelIds, defaultModelId } };
    });
  }, []);

  // ── 设为默认模型：置顶回退链（docStudio 语义） ──
  const handleSelectDefault = useCallback((providerId: string, modelId: string) => {
    setForms((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      const rest = current.modelIds.filter((m) => m !== modelId);
      return { ...prev, [providerId]: { ...current, defaultModelId: modelId, modelIds: [modelId, ...rest] } };
    });
  }, []);

  // ── 模型回退链拖拽排序 ──
  const handleChainDragStart = (providerId: string, index: number) => {
    dragChainItem.current = { providerId, index };
  };
  const handleChainDragEnd = () => {
    dragChainItem.current = null;
    dragChainOver.current = null;
    setDragOverChainIdx(null);
  };
  const handleChainDragOver = (e: React.DragEvent, providerId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragChainOver.current = { providerId, index };
    setDragOverChainIdx(index);
  };
  const handleChainDrop = (providerId: string) => {
    const from = dragChainItem.current;
    const to = dragChainOver.current;
    dragChainItem.current = null;
    dragChainOver.current = null;
    setDragOverChainIdx(null);
    if (!from || !to || from.providerId !== providerId || from.index === to.index) return;
    setForms((prev) => {
      const current = prev[providerId];
      if (!current) return prev;
      const list = [...current.modelIds];
      const [moved] = list.splice(from.index, 1);
      if (moved !== undefined) list.splice(to.index, 0, moved);
      return { ...prev, [providerId]: { ...current, modelIds: list } };
    });
  };

  // ── Provider 卡片拖拽排序 ──
  const sortedPresets = useMemo(() => {
    const inOrder = providerOrder
      .map((id) => presets.find((p) => p.id === id))
      .filter((p): p is PresetProvider => Boolean(p));
    const rest = presets.filter((p) => !providerOrder.includes(p.id));
    return [...inOrder, ...rest];
  }, [presets, providerOrder]);

  const handleProviderDragStart = (index: number) => {
    dragProviderItem.current = index;
  };
  const handleProviderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragProviderOver.current = index;
    setDragOverProviderIdx(index);
  };
  const handleProviderDrop = () => {
    const from = dragProviderItem.current;
    const to = dragProviderOver.current;
    dragProviderItem.current = null;
    dragProviderOver.current = null;
    setDragOverProviderIdx(null);
    if (from === null || to === null || from === to) return;
    const newOrder = sortedPresets.map((p) => p.id);
    const [moved] = newOrder.splice(from, 1);
    if (moved !== undefined) newOrder.splice(to, 0, moved);
    setProviderOrder(newOrder);
    saveProviderOrder(newOrder);
  };
  const handleProviderDragEnd = () => {
    dragProviderItem.current = null;
    dragProviderOver.current = null;
    setDragOverProviderIdx(null);
  };

  const fetchModels = useCallback(async (id: string) => {
    const f = forms[id];
    if (!f.apiKey) {
      setToast({ ok: false, text: "请先填写该 Provider 的 API Key，再在线拉取模型列表" });
      return;
    }
    setLoadingModel(id);
    try {
      const res = await fetch(`/api/settings/providers/${id}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: f.apiKey, baseUrl: f.baseUrl || undefined }),
      }).then((r) => r.json());
      if (res.ok) {
        setLiveModels((prev) => ({ ...prev, [id]: res.models }));
        setToast({ ok: true, text: `${id} 在线获取到 ${res.models.length} 个模型` });
      } else {
        setToast({ ok: false, text: `获取失败：${res.error ?? `HTTP ${res.status}`}` });
      }
    } catch (e) {
      setToast({ ok: false, text: `请求失败：${e instanceof Error ? e.message : String(e)}（请确认 server 正在运行，终端里 npm run dev 是否正常）` });
    } finally {
      setLoadingModel(null);
    }
  }, [forms]);

  const verify = useCallback(async (id: string) => {
    const f = forms[id];
    const modelId = f.defaultModelId || f.modelIds[0];
    if (!f.apiKey || !modelId) {
      setToast({ ok: false, text: "请先填写 API Key 并勾选模型" });
      return;
    }
    try {
      const res = await fetch(`/api/settings/providers/${id}/verify-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: f.apiKey, baseUrl: f.baseUrl || undefined, modelId }),
      }).then((r) => r.json());
      setVerifies((prev) => ({ ...prev, [id]: { ok: Boolean(res.ok), error: res.error } }));
      if (res.ok) setToast({ ok: true, text: `${id}/${modelId} 验证通过` });
    } catch (e) {
      setToast({ ok: false, text: `验证请求失败：${e instanceof Error ? e.message : String(e)}` });
    }
  }, [forms]);

  // 组装保存载荷（自动保存与手动保存共用）
  const buildPayload = useCallback(() => {
    return {
      providers: presets.map((p) => {
        const f = forms[p.id];
        return {
          providerId: p.id,
          apiKey: f.apiKey,
          baseUrl: f.baseUrl || undefined,
          modelIds: f.modelIds,
          defaultModelId: f.defaultModelId || f.modelIds[0] || "",
          modelFallbacks: f.modelIds,
          enabled: f.enabled && Boolean(f.apiKey) && f.modelIds.length > 0,
          enableModelFallback: f.modelIds.length > 1,
        };
      }),
      enableProviderFallback: true,
      _source: "uirefiner-settings",
    };
  }, [presets, forms]);

  // 写服务端；silent = 自动保存（成功不弹 toast，只更新状态点）
  const persist = useCallback(
    async (silent: boolean) => {
      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error ?? `HTTP ${res.status}`);
      if (silent) setAutoSavedAt(new Date());
      else setToast({ ok: true, text: "已保存。回到应用即可开始对话。" });
    },
    [buildPayload],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await persist(false);
    } catch (e) {
      setToast({ ok: false, text: `保存失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setSaving(false);
    }
  }, [persist]);

  // 自动保存：表单变化停顿 0.8s 后写入服务端（首次加载完成前不触发）
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      persist(true).catch((e) =>
        setToast({ ok: false, text: `自动保存失败：${e instanceof Error ? e.message : String(e)}` }),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [forms, loaded, persist]);

  const selectable = useMemo(
    () => (id: string): string[] => {
      const set = new Set<string>([...(catalog[id] ?? []).map((m) => m.id), ...(liveModels[id] ?? [])]);
      return [...set];
    },
    [catalog, liveModels],
  );

  /** 模型搜索：大小写不敏感的子串匹配，如 "qwen3.8" 命中 "qwen3.8-27b" */
  const matchesQuery = useCallback((modelId: string, q: string) => {
    if (!q) return true;
    return modelId.toLowerCase().includes(q.toLowerCase());
  }, []);

  /** 命中片段高亮 */
  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + q.length)}</mark>
        {text.slice(i + q.length)}
      </>
    );
  };

  return (
    <div className="settings-overlay">
      <div className="settings">
        <header className="settings-head">
          <h2>模型设置</h2>
          <p className="hint">
            与 docStudio 相同的配置体系：填写 Key → 勾选模型（勾选顺序即回退链）→ 设默认 → 验证。
            卡片和回退链均支持<b>拖拽排序</b>。所有输入<b>自动保存到服务端</b>（停顿约 1 秒即写入，刷新/重启不丢），本机另有草稿兜底。DSL 管线只会使用「设为默认」的模型。
          </p>
          <button className="ghost close" onClick={onClose}>✕ 关闭</button>
        </header>
        {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
        <div className="provider-list">
          {sortedPresets.map((p, idx) => {
            const f = forms[p.id];
            if (!f) return null;
            const models = selectable(p.id);
            const v = verifies[p.id];
            const chain = f.modelIds;
            return (
              <details key={p.id} className="provider-card" open={f.enabled}>
                <summary
                  draggable
                  onDragStart={() => handleProviderDragStart(idx)}
                  onDragOver={(e) => handleProviderDragOver(e, idx)}
                  onDragEnd={handleProviderDragEnd}
                  onDrop={handleProviderDrop}
                  className={dragOverProviderIdx === idx ? "drag-over" : ""}
                >
                  <span className="drag-handle" title="拖拽调整卡片顺序">⠿</span>
                  <label onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => update(p.id, { enabled: e.target.checked })}
                    />
                  </label>
                  <b>{p.displayName}</b>
                  <span className="provider-desc">{p.desc}</span>
                  {v && <span className={`verify-badge ${v.ok ? "ok" : "err"}`}>{v.ok ? "已验证 ✓" : "验证失败"}</span>}
                </summary>
                <div className="provider-body">
                  <label className="row">
                    <span>Base URL</span>
                    <input value={f.baseUrl} onChange={(e) => update(p.id, { baseUrl: e.target.value })} />
                  </label>
                  <label className="row">
                    <span>API Key</span>
                    <input type="password" placeholder={p.keyPlaceholder} value={f.apiKey} onChange={(e) => update(p.id, { apiKey: e.target.value })} />
                  </label>
                  <div className="row">
                    <span>可选模型（勾选加入回退链）</span>
                    <input
                      className="model-search"
                      placeholder="搜索模型，如 qwen3.8"
                      value={modelQuery[p.id] ?? ""}
                      onChange={(e) => setModelQuery((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button className="ghost small" disabled={loadingModel === p.id} onClick={() => fetchModels(p.id)}>
                      {loadingModel === p.id ? "获取中…" : "在线拉取"}
                    </button>
                  </div>
                  <div className="model-grid">
                    {models.length === 0 && <span className="hint">暂无模型目录，填 Key 后可在线拉取</span>}
                    {(() => {
                      const q = (modelQuery[p.id] ?? "").trim();
                      const filtered = models.filter((m) => matchesQuery(m, q));
                      if (models.length > 0 && filtered.length === 0) {
                        return (
                          <span className="hint">
                            无匹配「{q}」的模型（共 {models.length} 个）。可尝试更短关键字，或点「在线拉取」获取最新列表。
                          </span>
                        );
                      }
                      return filtered.map((m) => {
                        const info = (catalog[p.id] ?? []).find((x) => x.id === m);
                        const checked = chain.includes(m);
                        return (
                          <label key={m} className={`model-item ${checked ? "checked" : ""}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleModel(p.id, m)} />
                            <span className="model-id">{highlight(m, q)}</span>
                            {info?.supportsStructuredOutput && <span className="cap" title="支持结构化输出（DSL 管线推荐）">SO</span>}
                            {info?.supportsFunctionCalling && <span className="cap" title="支持函数调用">FC</span>}
                            {f.defaultModelId === m && <span className="cap default">默认</span>}
                            {checked && f.defaultModelId !== m && (
                              <button className="ghost small" onClick={(e) => { e.preventDefault(); handleSelectDefault(p.id, m); }}>
                                设默认
                              </button>
                            )}
                          </label>
                        );
                      });
                    })()}
                  </div>
                  {models.length > 0 && (
                    <div className="model-count">
                      显示 {models.filter((m) => matchesQuery(m, (modelQuery[p.id] ?? "").trim())).length} / {models.length} 个模型
                    </div>
                  )}
                  {chain.length > 0 && (
                    <div className="chain-box">
                      <div className="chain-title">
                        回退链（{chain.length} 项，可拖拽排序）：带「默认」标记的模型为管线首选；其余按此顺序依次作为回退
                      </div>
                      <ul className="chain-list">
                        {chain.map((m, ci) => (
                          <li
                            key={m}
                            draggable
                            onDragStart={() => handleChainDragStart(p.id, ci)}
                            onDragOver={(e) => handleChainDragOver(e, p.id, ci)}
                            onDragEnd={handleChainDragEnd}
                            onDrop={() => handleChainDrop(p.id)}
                            className={`chain-item ${dragOverChainIdx === ci ? "drag-over" : ""}`}
                          >
                            <span className="drag-handle" title="拖拽调整回退顺序">⠿</span>
                            <span className="chain-index">{ci + 1}</span>
                            <span className="model-id">{m}</span>
                            {f.defaultModelId === m && <span className="cap default">默认</span>}
                            {f.defaultModelId !== m && (
                              <button className="ghost small" onClick={() => handleSelectDefault(p.id, m)}>设默认</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="provider-actions">
                    <button className="ghost small" onClick={() => verify(p.id)}>验证模型连通</button>
                    {v && !v.ok && <span className="verify-err">{v.error}</span>}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
        <footer className="settings-foot">
          {autoSavedAt && (
            <span className="autosaved" title="所有输入已自动写入服务端">
              ✓ 已自动保存 {autoSavedAt.toLocaleTimeString()}
            </span>
          )}
          <button disabled={saving} onClick={save}>{saving ? "保存中…" : "立即保存"}</button>
        </footer>
      </div>
    </div>
  );
}
