/**
 * AI 改造面板 — 对话 / chips / 预览确认 / 历史回滚 / 差量与 diff 视图 / 变体
 * 两个 base app 共用同一套组件（PRD §4：理解层复用，接入层可插拔）。
 */
import { useCallback, useEffect, useState } from "react";
import { api, type HistoryTurn } from "../lib/api";
import { describeChange } from "../lib/describe";
import type { AppMeta, Delta } from "../../../shared/src/types/delta";
import type { TreeNode } from "../../../shared/src/types/controlTree";
import type { LayoutAction } from "../../../shared/src/types/dsl";

interface ChatMsg extends HistoryTurn {
  kind?: "info" | "clarify" | "reject" | "applied" | "error";
}

interface PreviewState {
  changes: LayoutAction[];
  tree: TreeNode;
  note?: string;
  request: string;
}

export function AIPanel(props: {
  meta: AppMeta;
  variantId: string;
  tree: TreeNode;
  baseTree: TreeNode;
  deltas: Delta[];
  offline: boolean;
  onPreview: (p: PreviewState | null) => void;
  onTreeReplaced: (tree: TreeNode) => void;
  onVariantChange: (v: string) => void;
  onDeltasChanged: () => void;
}) {
  const { meta, variantId, tree, baseTree, deltas, offline } = props;
  const [tab, setTab] = useState<"chat" | "changes">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setMessages([{ role: "assistant", kind: "info", content: `你好，我是 ${meta.name} 的界面定制助手。说一句话，或点上方指令直接体验。` }]);
    setShowDiff(false);
  }, [meta.id, variantId]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setError(null);
    setBusy(true);
    const history: HistoryTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    try {
      const res = await api.agentRequest({ appId: meta.id, variantId, message: msg, history, offline });
      const reply = res.reply;
      if (reply.type === "clarify") {
        setMessages((prev) => [...prev, { role: "assistant", kind: "clarify", content: reply.question }]);
      } else if (reply.type === "reject") {
        setMessages((prev) => [...prev, { role: "assistant", kind: "reject", content: reply.reason }]);
      } else if (res.previewTree) {
        props.onPreview({ changes: reply.changes, tree: res.previewTree, note: reply.note, request: msg });
        setMessages((prev) => [...prev, { role: "assistant", kind: "info", content: `已生成 ${reply.changes.length} 项修改${res.usedOffline ? "（离线兜底）" : ""}${res.repairRounds > 0 ? `，经 ${res.repairRounds} 轮自动修复` : ""}，请在预览中确认。` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", kind: "error", content: "生成结果缺少预览数据，请重试。" }]);
      }
    } catch (e) {
      const msg2 = e instanceof Error ? e.message : String(e);
      setError(msg2);
      setMessages((prev) => [...prev, { role: "assistant", kind: "error", content: `出错了：${msg2}` }]);
    } finally {
      setBusy(false);
    }
  }, [messages, busy, meta.id, variantId, offline, props]);

  const revert = useCallback(async (deltaId: string) => {
    setBusy(true);
    try {
      const res = await api.agentRevert(deltaId);
      props.onTreeReplaced(res.tree);
      props.onDeltasChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [props]);

  const upgrade = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.upgradeSimulate(meta.id, variantId);
      props.onTreeReplaced(res.tree);
      setMessages((prev) => [...prev, { role: "assistant", kind: "applied", content: `⬆️ ${res.note}` }]);
      setTab("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [meta.id, variantId, props]);

  const exportPkg = useCallback(async () => {
    try {
      const pkg = await api.exportPackage(meta.id, variantId);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uirefiner-package-${meta.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [meta.id, variantId]);

  const activeDeltas = deltas.filter((d) => !d.reverted);

  return (
    <aside className="ai-panel">
      <div className="ai-panel-head">
        <div className="ai-title">AI 改造面板 {offline && <span className="badge-offline" title="跳过在线 LLM，使用预存指令映射">离线兜底</span>}</div>
        {meta.variants.length > 1 && (
          <div className="role-switch" title="差量按角色变体保存（路线 B 机制）">
            {meta.variants.map((v) => (
              <button key={v.id} className={v.id === variantId ? "active" : ""} onClick={() => props.onVariantChange(v.id)}>
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ai-tabs">
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>对话</button>
        <button className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>
          变更与差量{activeDeltas.length > 0 ? ` (${activeDeltas.length})` : ""}
        </button>
      </div>

      {tab === "chat" ? (
        <div className="ai-chat">
          <div className="chips">
            {meta.chips.map((chip) => (
              <button key={chip} disabled={busy} className="chip" onClick={() => send(chip)} title="点击直接发送（高频指令）">
                {chip}
              </button>
            ))}
          </div>
          <div className="chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role} ${m.kind ?? ""}`}>{m.content}</div>
            ))}
            {busy && <div className="msg assistant info loading">Agent 正在生成修改…（真实 LLM 延迟 1–3 秒）</div>}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="chat-input">
            <textarea
              rows={2}
              value={input}
              placeholder="想怎么改这个界面？直接说，例如「把XX挪到YY旁边」"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button disabled={busy || !input.trim()} onClick={() => send(input)}>发送</button>
          </div>
        </div>
      ) : (
        <div className="ai-changes">
          {meta.features.upgradeSimulate && (
            <div className="upgrade-box">
              <div className="upgrade-text">
                <b>模拟厂商升级</b>
                <span>让 ERP 换主题并新增「物流单号」字段，验证你的定制全部保留（升级安全）。</span>
              </div>
              <button disabled={busy} onClick={upgrade}>⬆ 模拟升级</button>
            </div>
          )}
          {meta.features.exportPackage && (
            <div className="export-box">
              <span>把当前全部 SDK 差量导出为变更包，交由软件开发商合入标准版。</span>
              <button disabled={busy || activeDeltas.length === 0} onClick={exportPkg}>⬇ 导出变更包</button>
            </div>
          )}
          {meta.features.diffView && (
            <label className="diff-toggle">
              <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
              查看 SDK diff（组件配置差量）
            </label>
          )}
          {activeDeltas.length === 0 && <p className="empty">还没有定制。回到「对话」页说一句话试试。</p>}
          <ul className="delta-list">
            {activeDeltas.map((d) => (
              <li key={d.id}>
                <div className="delta-request">{d.request}</div>
                {showDiff && meta.features.diffView ? (
                  <div className="diff-lines">
                    {d.changes.map((c, i) => <div key={i} className="diff-line">+ {describeChange(c, baseTree)}</div>)}
                  </div>
                ) : (
                  <div className="delta-summary">{d.changes.map((c) => describeChange(c, baseTree)).join("；")}</div>
                )}
                <div className="delta-foot">
                  <span className="delta-time">{new Date(d.createdAt).toLocaleTimeString()}</span>
                  <button disabled={busy} onClick={() => revert(d.id)}>撤销</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
