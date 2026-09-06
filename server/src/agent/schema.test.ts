import { describe, expect, it } from "vitest";
import { LayoutActionZ, parseReply } from "./schema.js";
import { serializeTree } from "./contextBuilder.js";
import { offlineLookup } from "./offline.js";
import { APP_A_TREE } from "../data/apps.js";

describe("agent schema", () => {
  it("接受合法 changes 回复", () => {
    const { reply, issues } = parseReply({
      type: "changes",
      changes: [{ action: "rename", target: "field-payment-term", label: "账期" }],
      note: "ok",
    });
    expect(issues).toHaveLength(0);
    expect(reply?.type).toBe("changes");
  });

  it("拒绝词汇表外的动作", () => {
    const { issues } = parseReply({ type: "changes", changes: [{ action: "updateAmount", target: "x" }] });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("changes 为空 / clarify 缺 question / reject 缺 reason 均报错", () => {
    expect(parseReply({ type: "changes", changes: [] }).issues.length).toBeGreaterThan(0);
    expect(parseReply({ type: "clarify" }).issues.length).toBeGreaterThan(0);
    expect(parseReply({ type: "reject" }).issues.length).toBeGreaterThan(0);
  });

  it("LayoutActionZ 拒绝未知动作枚举", () => {
    expect(LayoutActionZ.safeParse({ action: "delete", target: "x" }).success).toBe(false);
  });
});

describe("contextBuilder", () => {
  it("序列化包含 id/类型/标签/缩进与状态标注", () => {
    const s = serializeTree(APP_A_TREE);
    expect(s).toContain("panel panel-main");
    expect(s).toContain("「内部备注」");
    expect(s).toContain("layout=row");
    const lines = s.split("\n");
    expect(lines[0]).not.toMatch(/^ /);
    expect(lines[1]?.startsWith("  ")).toBe(true);
  });
});

describe("offline 兜底", () => {
  it("chips 原文命中", () => {
    expect(offlineLookup("appB", "成本价、内部备注是销售不该看的，藏起来")?.type).toBe("changes");
    expect(offlineLookup("appA", "内部备注是给我们自己看的，折叠起来")?.type).toBe("clarify");
    expect(offlineLookup("appA", "可以")?.type).toBe("changes");
  });
  it("未命中返回 undefined", () => {
    expect(offlineLookup("appA", "随便说点什么")).toBeUndefined();
  });
});
