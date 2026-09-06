/**
 * 离线兜底（FR-12 / §13）— 预置指令 → 预存 AgentReply 映射。
 *
 * 演示现场网络/LLM 故障时的保底：交互路径与在线完全一致（仍走预览→应用），
 * 只是跳过在线 LLM。仅支持预置指令原文。
 */
import type { AgentReply } from "../../../shared/src/types/dsl.js";

const OFFLINE_MAP = new Map<string, AgentReply>([
  // App A chips
  [
    "appA|把提交审核按钮从底部挪到表单上方，用户填完就能看到",
    {
      type: "changes",
      changes: [{ action: "move", target: "button-submit", before: "form-ticket" }],
      note: "将「提交审核」按钮移动到表单顶部",
    },
  ],
  [
    "appA|内部备注是给我们自己看的，折叠起来",
    { type: "clarify", question: "折叠后保留「内部备注」标题行、点击可展开，可以吗？" },
  ],
  ["appA|可以", { type: "changes", changes: [{ action: "collapse", target: "collapsible-internal-note" }], note: "「内部备注」已折叠，保留标题行" }],
  [
    "appA|把处理记录表格挪到表单下方，整个页面改成上下两块",
    {
      type: "changes",
      changes: [
        { action: "move", target: "panel-records", after: "panel-form" },
        { action: "setProp", target: "panel-main", prop: "layout", value: "column" },
      ],
      note: "处理记录已移到表单下方，页面改为上下结构",
    },
  ],
  // App B chips
  [
    "appB|成本价、内部备注是销售不该看的，藏起来",
    {
      type: "changes",
      changes: [
        { action: "hide", target: "col-cost-price" },
        { action: "hide", target: "col-internal-note" },
      ],
      note: "已隐藏「成本价」「内部备注」，改动将保存到销售岗变体",
    },
  ],
  [
    "appB|把'付款条件'改名叫'账期'，我们内部都这么叫",
    { type: "changes", changes: [{ action: "rename", target: "field-payment-term", label: "账期" }], note: "「付款条件」已改名为「账期」" },
  ],
  [
    "appB|把'金额'列挪到第一列，一打开就能看到每行的价格",
    { type: "changes", changes: [{ action: "moveColumn", target: "col-amount", index: 1 }], note: "「金额」列已移到第一列" },
  ],
  // 负面演示
  [
    "appB|把订单总金额自动加10%",
    {
      type: "reject",
      reason:
        "这是业务数据变更（修改金额），不属于界面布局调整。我只能改界面的布局与呈现（移动/显隐/改名/分组），不能改动业务数据和计算逻辑。",
    },
  ],
]);

export function offlineLookup(appId: string, message: string): AgentReply | undefined {
  return OFFLINE_MAP.get(`${appId}|${message.trim()}`);
}
