/**
 * 升级安全回归（T3.2 ★）—— 演示杀手锏必须是自动化测试：
 * base tree 切到 v2（厂商新增"物流单号"列 + 换主题）后，
 * 销售岗变体的全部差量（B1/B2/B3 golden 动作）重放依然生效。
 */
import { describe, expect, it } from "vitest";
import { applyChanges, findNode } from "./applyChanges.js";
import { getBaseTree } from "../data/apps.js";
import type { LayoutAction } from "../../../shared/src/types/dsl.js";

/** golden B1–B3 的差量（与 offline.ts 保持一致） */
const SALES_DELTAS: LayoutAction[][] = [
  [{ action: "hide", target: "col-cost-price" }, { action: "hide", target: "col-internal-note" }],
  [{ action: "rename", target: "field-payment-term", label: "账期" }],
  [{ action: "moveColumn", target: "col-amount", after: "col-qty" }],
];

function replay(base: ReturnType<typeof getBaseTree>) {
  let tree = base!;
  for (const changes of SALES_DELTAS) {
    tree = applyChanges(tree, changes).tree;
  }
  return tree;
}

describe("升级安全（App B v1 → v2 差量重放）", () => {
  it("v1 上差量生效", () => {
    const tree = replay(getBaseTree("appB", "v1"));
    expect(findNode(tree, "col-cost-price")?.props?.hidden).toBe(true);
    expect(findNode(tree, "col-internal-note")?.props?.hidden).toBe(true);
    expect(findNode(tree, "field-payment-term")?.label).toBe("账期");
    const cols = findNode(tree, "table-items")!.children!.map((c) => c.id);
    expect(cols[cols.indexOf("col-qty") + 1]).toBe("col-amount");
  });

  it("v2（厂商升级）上差量依然生效，且新增字段保留", () => {
    const v2 = getBaseTree("appB", "v2")!;
    // 升级点确认：新列 + 主题变化
    expect(findNode(v2, "col-logistics-no")).toBeDefined();
    expect(v2.props?.theme).toBe("indigo");

    const tree = replay(v2);
    expect(findNode(tree, "col-cost-price")?.props?.hidden).toBe(true);
    expect(findNode(tree, "col-internal-note")?.props?.hidden).toBe(true);
    expect(findNode(tree, "field-payment-term")?.label).toBe("账期");
    const cols = findNode(tree, "table-items")!.children!.map((c) => c.id);
    expect(cols[cols.indexOf("col-qty") + 1]).toBe("col-amount");
    // 厂商新增的列没有被定制误伤
    expect(findNode(tree, "col-logistics-no")?.props?.hidden).toBeFalsy();
  });
});
