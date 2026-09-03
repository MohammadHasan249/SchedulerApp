import { defineConfig } from "vitest/config";
import path from "path";

// Separate from vitest.config.ts on purpose: eval files (`*.eval.ts`) hit the
// real AI Gateway and cost real tokens, so they must never be swept up by the
// default `npm test` / `vitest run` glob. Run explicitly via `npm run eval:ai`.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.eval.?(c|m)[jt]s?(x)"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    // Live model calls are slower than unit tests, and running them
    // concurrently multiplies AI Gateway load/cost for no benefit here.
    testTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@scheduler/database": path.resolve(__dirname, "../../packages/database/src"),
      "@scheduler/database/schema": path.resolve(__dirname, "../../packages/database/src/schema/index.ts"),
      "@scheduler/types": path.resolve(__dirname, "../../packages/types/src"),
      "@scheduler/api-client": path.resolve(__dirname, "../../packages/api-client/src"),
    },
  },
});
