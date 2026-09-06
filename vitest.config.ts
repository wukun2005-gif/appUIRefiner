import { defineConfig } from "vitest/config";

// 测试使用内存数据库（db.ts 支持:memory:），避免污染演示数据
process.env.DB_PATH = ":memory:";

export default defineConfig({
  test: {
    include: ["server/src/**/*.test.ts", "shared/src/**/*.test.ts"],
    environment: "node",
  },
});
