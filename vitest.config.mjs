import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      exclude: [
        "coverage/**",
        "dist/**",
        "node_modules/**",
        "src/test/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
      ],
      reporter: ["text", "json-summary"],
    },
  },
});
