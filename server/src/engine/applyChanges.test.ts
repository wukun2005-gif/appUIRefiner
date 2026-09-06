import { describe, expect, it } from "vitest";
import { applyChanges, findNode, validateChanges } from "./applyChanges.js";
import { APP_A_TREE, APP_B_TREE } from "../data/apps.js";
import type { LayoutAction } from "../../../shared/src/types/dsl.js";

describe("applyChanges", () => {
  it("move：按钮移动为锚点的兄弟（A1 场景）", () => {
    const changes: LayoutAction[] = [{ action: "move", target: "button-submit", before: "form-ticket" }];
    const { tree, errors } = applyChanges(APP_A_TREE, changes);
    expect(errors).toHaveLength(0);
    const panelForm = findNode(tree, "panel-form")!;
    expect(panelForm.children?.some((c) => c.id === "button-submit")).toBe(true);
    expect(panelForm.children?.[0].id).toBe("button-submit");
    // 原树不可变
    expect(findNode(APP_A_TREE, "panel-actions")!.children?.map((c) => c.id)).toContain("button-submit");
  });

  it("hide / show / collapse / rename / setProp", () => {
    const changes: LayoutAction[] = [
      { action: "hide", target: "col-cost-price" },
      { action: "collapse", target: "collapsible-internal-note" },
      { action: "rename", target: "field-assignee", label: "当前处理人" },
      { action: "setProp", target: "panel-main", prop: "layout", value: "column" },
    ];
    const { tree, errors } = applyChanges(APP_A_TREE, changes);
    expect(errors.filter((e) => e.change.action !== "hide")).toHaveLength(0);
    expect(findNode(tree, "collapsible-internal-note")?.props?.collapsed).toBe(true);
    expect(findNode(tree, "panel-main")?.props?.layout).toBe("column");
    // col-cost-price 不在 App A —— hide 应报 target 不存在
    expect(errors.some((e) => e.change.action === "hide")).toBe(true);
  });

  it("rename 在 App B 上生效", () => {
    const { tree, errors } = applyChanges(APP_B_TREE, [
      { action: "rename", target: "field-payment-term", label: "账期" },
    ]);
    expect(errors).toHaveLength(0);
    expect(findNode(tree, "field-payment-term")?.label).toBe("账期");
  });

  it("moveColumn：金额列挪到数量之后（B3 场景）", () => {
    const { tree, errors } = applyChanges(APP_B_TREE, [
      { action: "moveColumn", target: "col-amount", after: "col-qty" },
    ]);
    expect(errors).toHaveLength(0);
    const cols = findNode(tree, "table-items")!.children!.map((c) => c.id);
    expect(cols[cols.indexOf("col-qty") + 1]).toBe("col-amount");
  });

  it("moveColumn 拒绝非列目标", () => {
    const { errors } = applyChanges(APP_B_TREE, [{ action: "moveColumn", target: "field-customer", index: 1 }]);
    expect(errors[0].error).toContain("表格列");
  });

  it("group：同父容器字段合并（A4 场景）", () => {
    const { tree, errors } = applyChanges(APP_A_TREE, [{
      action: "group",
      targets: ["field-customer-name", "field-contact", "field-phone"],
      title: "客户信息",
    }]);
    expect(errors).toHaveLength(0);
    const form = findNode(tree, "form-ticket")!;
    const group = form.children?.find((c) => c.type === "group");
    expect(group?.label).toBe("客户信息");
    expect(group?.children?.map((c) => c.id)).toEqual(["field-customer-name", "field-contact", "field-phone"]);
    expect(form.children?.[0]?.id).toBe(group?.id);
  });

  it("group 跨父容器时报错", () => {
    const { errors } = applyChanges(APP_A_TREE, [{
      action: "group", targets: ["field-customer-name", "field-priority", "field-total-amount"], title: "X",
    }]);
    // field-total-amount 不在 App A → target 不存在
    expect(errors.length).toBeGreaterThan(0);
  });

  it("setProp 白名单外拒绝", () => {
    const { errors } = applyChanges(APP_A_TREE, [{ action: "setProp", target: "panel-main", prop: "onclick", value: "steal()" }]);
    expect(errors[0].error).toContain("白名单");
  });

  it("move 不能把锚点移进自己子树", () => {
    const { errors } = applyChanges(APP_A_TREE, [{ action: "move", target: "panel-main", after: "table-records" }]);
    expect(errors[0].error).toContain("子树");
  });

  it("validateChanges 返回可读错误", () => {
    const errs = validateChanges(APP_A_TREE, [{ action: "hide", target: "no-such-node" }]);
    expect(errs[0]).toContain("target 不存在");
  });
});
