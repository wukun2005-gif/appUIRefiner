/**
 * 应用选择页（FR-1）— 两条路线的两张卡片
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AppMeta } from "../../../shared/src/types/delta";

export function AppPicker({ onOpen, onOpenSettings }: { onOpen: (meta: AppMeta) => void; onOpenSettings: () => void }) {
  const [apps, setApps] = useState<AppMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.apps().then((r) => setApps(r.apps)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="picker">
      <header className="picker-header">
        <div>
          <h1>UIRefiner</h1>
          <p className="sub">用自然语言，把既有软件的界面改成你想要的样子</p>
        </div>
        <button className="ghost" onClick={onOpenSettings}>⚙ 模型设置</button>
      </header>
      <p className="picker-narrative">
        两条接入路线，一套 Agent：对<b>自研 Web 应用</b>以 SDK 形式集成（路线 A）；对有<b>厂商适配层</b>的存量 ERP
        写入差量（路线 B）。改动可预览、可回滚、按角色持久化、软件升级不丢。
      </p>
      {error && <p className="error">加载失败：{error}（请确认 server 已启动）</p>}
      <div className="picker-cards">
        {apps.map((app) => (
          <button key={app.id} className={`card route-${app.id}`} onClick={() => onOpen(app)}>
            <span className="route-badge">{app.route}</span>
            <h2>{app.name}</h2>
            <p>{app.desc}</p>
            <div className="card-features">
              {app.features.diffView && <span>SDK 差量 diff</span>}
              {app.features.exportPackage && <span>导出变更包</span>}
              {app.features.upgradeSimulate && <span>角色变体</span>}
              {app.features.upgradeSimulate && <span>升级安全模拟</span>}
            </div>
            <span className="card-enter">进入 →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
