import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/api/src/**/test/**/*.spec.ts",
      "apps/web/src/**/test/**/*.spec.ts",
    ],
    coverage: {
      provider: "istanbul",
      reporter: ["json"],
      reportsDirectory: "./coverage",
      include: ["apps/api/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: [
        "**/test/**",
        "**/*.spec.ts",
        "**/dist/**",
        "**/*.d.ts",
        "apps/web/src/routeTree.gen.ts",
      ],
    },
  },
});
