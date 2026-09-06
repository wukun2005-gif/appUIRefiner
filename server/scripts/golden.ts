/**
 * Golden 回归（T2.10）— 9 条用例 × N 轮：
 *   6 条 chips + 2 条自由输入 + 1 条越界拒绝
 *
 * 用法：
 *   npm run golden        # 真调 LLM（需已在模型设置配置好 Provider）
 *   npm run golden:mock   # 离线模式（验证管线外的机制，不调 LLM）
 */
import { runAgentRequest } from "../src/agent/pipeline.js";
import { getEffectiveTree } from "../src/engine/effective.js";
import { applyChanges, findNode } from "../src/engine/applyChanges.js";
import { getBaseVersion } from "../src/engine/store.js";
import { getBaseTree } from "../src/data/apps.js";
import { getDb } from "../src/lib/db.js";
import { initStore } from "../src/engine/store.js";
import type { TreeNode } from "../../shared/src/types/controlTree.js";

// golden 真调模式需要读取模型配置：默认与 dev server 同库（server/data/uirefiner.db）
process.env.DB_PATH = process.env.DB_PATH ?? "server/data/uirefiner.db";

interface GoldenCase {
  id: string;
  appId: string;
  variantId: string;
  message: string;
  /** mock（离线）模式下跳过：自由输入类用例需要真实 LLM */
  mockSkip?: boolean;
  expect:
    | { type: "changes"; assert: (treeAfter: TreeNode) => boolean; desc: string }
    | { type: "clarify" }
    | { type: "reject" };
}

const CASES: GoldenCase[] = [
  {
    id: "A1-按钮挪到表单上方", appId: "appA", variantId: "personal",
    message: "把提交审核按钮从底部挪到表单上方，用户填完就能看到",
    expect: {
      type: "changes",
      desc: "button-submit 成为 panel-form / form-ticket 的兄弟且位于其前",
      assert: (t) => {
        const main = findNode(t, "panel-main");
        const formIdx = main?.children?.findIndex((c) => c.id === "panel-form");
        const btnInForm = findNode(t, "panel-form")?.children?.some((c) => c.id === "button-submit");
        const beforeForm = formIdx !== undefined && formIdx > 0 && main!.children![formIdx - 1].id === "button-submit";
        return btnInForm === true || beforeForm;
      },
    },
  },
  {
    id: "A2-折叠内部备注(先澄清)", appId: "appA", variantId: "personal",
    message: "内部备注是给我们自己看的，折叠起来",
    expect: { type: "clarify" },
  },
  {
    id: "A2确认-执行折叠", appId: "appA", variantId: "personal",
    message: "可以",
    expect: {
      type: "changes",
      desc: "collapsible-internal-note.props.collapsed = true",
      assert: (t) => findNode(t, "collapsible-internal-note")?.props?.collapsed === true,
    },
  },
  {
    id: "A3-表格挪到表单下方", appId: "appA", variantId: "personal",
    message: "把处理记录表格挪到表单下方，整个页面改成上下两块",
    expect: {
      type: "changes",
      desc: "panel-records 在 panel-form 之后且 panel-main layout=column",
      assert: (t) => {
        const main = findNode(t, "panel-main");
        const idx = main?.children?.findIndex((c) => c.id === "panel-records");
        return (
          idx !== undefined && idx > 0 &&
          main!.children![idx - 1].id === "panel-form" &&
          findNode(t, "panel-main")?.props?.layout === "column"
        );
      },
    },
  },
  {
    id: "B1-隐藏成本价与内部备注", appId: "appB", variantId: "sales",
    message: "成本价、内部备注是销售不该看的，藏起来",
    expect: {
      type: "changes",
      desc: "两列 hidden",
      assert: (t) =>
        findNode(t, "col-cost-price")?.props?.hidden === true &&
        findNode(t, "col-internal-note")?.props?.hidden === true,
    },
  },
  {
    id: "B2-付款条件改名账期", appId: "appB", variantId: "sales",
    message: "把'付款条件'改名叫'账期'，我们内部都这么叫",
    expect: {
      type: "changes",
      desc: "field-payment-term.label === 账期",
      assert: (t) => findNode(t, "field-payment-term")?.label === "账期",
    },
  },
  {
    id: "B3-金额列挪到第一列", appId: "appB", variantId: "sales",
    message: "把'金额'列挪到第一列，一打开就能看到每行的价格",
    expect: {
      type: "changes",
      desc: "table-items 第一列为 col-amount",
      assert: (t) => {
        const cols = findNode(t, "table-items")?.children?.map((c) => c.id) ?? [];
        return cols[0] === "col-amount";
      },
    },
  },
  {
    id: "B自由-恢复成本价列", appId: "appB", variantId: "sales",
    message: "把成本价列恢复显示",
    mockSkip: true,
    expect: {
      type: "changes",
      desc: "col-cost-price.props.hidden !== true",
      assert: (t) => findNode(t, "col-cost-price")?.props?.hidden !== true,
    },
  },
  {
    id: "B负-改总金额被拒绝", appId: "appB", variantId: "sales",
    message: "把订单总金额自动加10%",
    expect: { type: "reject" },
  },
];

const round = Number(process.argv.find((a) => a.startsWith("--rounds="))?.split("=")[1] ?? 3);
const mock = process.argv.includes("--mock");

async function main() {
  getDb(); // 初始化 schema（user_settings 等，拷贝自 docStudio）
  initStore();
  let pass = 0;
  let total = 0;
  const failures: string[] = [];

  for (let r = 1; r <= round; r++) {
    console.log(`\n========== 第 ${r}/${round} 轮 ==========`);
    for (const c of CASES) {
      if (mock && c.mockSkip) {
        console.log(`⏭ ${c.id}（离线模式跳过：自由输入需真实 LLM）`);
        continue;
      }
      total += 1;
      let ok = false;
      let detail = "";
      try {
        // 每条用例都在干净树上评估（断言用预览树，不落库）
        const result = await runAgentRequest({
          appId: c.appId,
          variantId: c.variantId,
          message: c.message,
          history: [],
          offline: mock,
        });
        const reply = result.reply;
        if (reply.type !== c.expect.type) {
          detail = `期望 ${c.expect.type}，实际 ${reply.type}${reply.type === "reject" ? `（${reply.reason.slice(0, 60)}…）` : ""}`;
        } else if (reply.type === "changes" && c.expect.type === "changes") {
          // 在干净的 base 树上应用断言（避免轮间状态污染）
          const baseVersion = getBaseVersion(c.appId);
          const base = getBaseTree(c.appId, baseVersion)!;
          const preview = applyChanges(base, reply.changes).tree;
          if (!c.expect.assert(preview)) detail = `动作断言失败：${(c.expect as { desc: string }).desc}`;
          else ok = true;
        } else {
          ok = true;
        }
        if (reply.type === "clarify" && c.expect.type === "clarify") ok = true;
        if (reply.type === "reject" && c.expect.type === "reject") ok = true;
      } catch (e) {
        detail = e instanceof Error ? e.message : String(e);
      }
      if (ok) pass += 1;
      else failures.push(`[R${r}] ${c.id}: ${detail}`);
      console.log(`${ok ? "✅" : "❌"} ${c.id}${detail ? ` — ${detail}` : ""}`);
    }
  }

  console.log(`\n========== 结果：${pass}/${total}（${((pass / total) * 100).toFixed(1)}%） ==========`);
  if (failures.length > 0) {
    console.log("失败明细：");
    for (const f of failures) console.log(`  ${f}`);
  }
  const gate = mock ? 1.0 : 0.9;
  if (pass / total < gate) {
    console.error(`低于门槛 ${(gate * 100).toFixed(0)}%，不允许进入演示排练。`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// 引用避免未使用告警（effective tree 用于后续扩展按当前状态断言）
void getEffectiveTree;
