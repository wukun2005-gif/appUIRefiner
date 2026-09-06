/**
 * BaseApp — 控件树渲染器（两个 base app 共用一个，PRD 设计决策 D2）。
 * 所有定制差量应用后的 effective tree 都由它渲染。
 */
import { useEffect, useState } from "react";
import type { TreeNode } from "../../../shared/src/types/controlTree";

/** 表格示例数据（演示用；未匹配的列显示 "—"） */
const SAMPLE_ROWS: Record<string, Array<Record<string, string>>> = {
  "table-records": [
    { "col-time": "09:02", "col-operator": "王工", "col-action": "接单", "col-status": "处理中", "col-note": "-" },
    { "col-time": "11:47", "col-operator": "李工", "col-action": "上门维修", "col-status": "处理中", "col-note": "已更换模块" },
    { "col-time": "昨天 15:40", "col-operator": "张工", "col-action": "电话回访", "col-status": "已处理", "col-note": "客户确认正常" },
  ],
  "table-items": [
    { "col-material": "变频器 V6", "col-qty": "2", "col-unit": "台", "col-price": "¥3,200", "col-amount": "¥6,400", "col-cost-price": "¥2,750", "col-internal-note": "-", "col-logistics-no": "SF1023456789" },
    { "col-material": "传感器 S2", "col-qty": "10", "col-unit": "个", "col-price": "¥180", "col-amount": "¥1,800", "col-cost-price": "¥120", "col-internal-note": "紧急补货", "col-logistics-no": "YT5590123456" },
    { "col-material": "控制面板 P1", "col-qty": "1", "col-unit": "套", "col-price": "¥5,600", "col-amount": "¥5,600", "col-cost-price": "¥4,900", "col-internal-note": "-", "col-logistics-no": "JDV7701234567" },
  ],
};

function CollapsibleNode({ node, children }: { node: TreeNode; children?: React.ReactNode }) {
  const [open, setOpen] = useState(!node.props?.collapsed);
  useEffect(() => setOpen(!node.props?.collapsed), [node.props?.collapsed]);
  return (
    <div className={`ui-collapsible ${open ? "open" : ""}`}>
      <button type="button" className="ui-collapsible-head" onClick={() => setOpen(!open)}>
        <span className={`caret ${open ? "down" : "right"}`}>▸</span>
        {node.label}
      </button>
      {open && <div className="ui-collapsible-body">{children}</div>}
    </div>
  );
}

function RenderNode({ node }: { node: TreeNode }) {
  if (node.props?.hidden) return null;
  const children = node.children ?? [];
  const visibleChildren = children.filter((c) => !c.props?.hidden);

  switch (node.type) {
    case "panel": {
      const layout = node.props?.layout ?? "column";
      return (
        <section className={`ui-panel panel-${node.id}`}>
          <h3 className="ui-panel-title">{node.label}</h3>
          <div className={`ui-panel-body layout-${layout}`}>{children.map((c) => <RenderNode key={c.id} node={c} />)}</div>
        </section>
      );
    }
    case "form":
      return <div className="ui-form">{children.map((c) => <RenderNode key={c.id} node={c} />)}</div>;
    case "field":
      return (
        <label className="ui-field">
          <span className="ui-field-label">{node.label}</span>
          <input type="text" placeholder={node.props?.placeholder ?? `请输入${node.label}`} />
        </label>
      );
    case "textarea":
      return (
        <label className="ui-field">
          <span className="ui-field-label">{node.label}</span>
          <textarea rows={3} placeholder={node.props?.placeholder ?? `请输入${node.label}`} />
        </label>
      );
    case "table": {
      const cols = visibleChildren.filter((c) => c.type === "column");
      const rows = SAMPLE_ROWS[node.id] ?? [{}, {}, {}];
      return (
        <table className="ui-table">
          <thead>
            <tr>{cols.map((c) => <th key={c.id}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{cols.map((c) => <td key={c.id}>{row[c.id] ?? "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "column":
      return null; // 列只在 table 内渲染
    case "button":
      return <button type="button" className="ui-btn">{node.label}</button>;
    case "group":
      return (
        <fieldset className="ui-group">
          <legend>{node.label}</legend>
          <div className="ui-group-body">{children.map((c) => <RenderNode key={c.id} node={c} />)}</div>
        </fieldset>
      );
    case "collapsible":
      return <CollapsibleNode node={node}>{visibleChildren.map((c) => <RenderNode key={c.id} node={c} />)}</CollapsibleNode>;
    default:
      return null;
  }
}

export function BaseApp({ tree, previewing }: { tree: TreeNode; previewing?: boolean }) {
  const theme = tree.props?.theme ?? "teal";
  return (
    <div className={`baseapp theme-${theme} ${previewing ? "previewing" : ""}`}>
      {tree.children?.map((c) => <RenderNode key={c.id} node={c} />)}
    </div>
  );
}
