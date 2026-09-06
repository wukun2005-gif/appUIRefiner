/**
 * 差量（Delta）与变体（Variant）— 用户定制的持久化形态。
 *
 * 原始应用（base tree）零修改；所有定制 = 差量清单，按变体（角色）叠加。
 * 升级安全：base tree 换版本后，差量重放依然生效（SAP Flexibility 同构）。
 */

import type { LayoutAction } from "./dsl.js";

export interface Delta {
  id: string;
  appId: string;
  /** 所属变体；App A 固定 "personal"，App B 为角色变体（sales / finance） */
  variantId: string;
  changes: LayoutAction[];
  /** 产生这条差量的原始用户请求（用于历史展示） */
  request: string;
  createdAt: number;
  reverted?: boolean;
}

export type RoleId = "sales" | "finance";

export interface VariantMeta {
  id: string;
  name: string;
  roleId?: RoleId;
}

/** App 元信息（选择页 / 面板头部所需） */
export interface AppMeta {
  id: "appA" | "appB";
  name: string;
  route: "A · SDK 接入" | "B · 厂商适配层";
  desc: string;
  /** 变体列表；单变体应用（App A）也显式给出，简化客户端逻辑 */
  variants: VariantMeta[];
  /** 高频指令 chips（点击直接发送） */
  chips: string[];
  features: {
    diffView: boolean; // App A：SDK 差量 diff 视图
    exportPackage: boolean; // App A：导出变更包
    upgradeSimulate: boolean; // App B：一键升级模拟
  };
}

/** 导出变更包（App A：模拟发给软件开发商合入标准版的 JSON） */
export interface ChangePackage {
  appId: string;
  exportedAt: string;
  note: string;
  deltas: Array<{ id: string; request: string; changes: LayoutAction[] }>;
}
