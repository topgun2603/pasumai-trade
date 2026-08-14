import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Domain tests only.
 *
 * Everything under test here is pure logic — money arithmetic, transition
 * guards, validators — so it runs in Node with no DOM and no Next runtime.
 * Component tests, when they come, will need their own environment.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws on import outside a React Server Component, which
      // is exactly its job — but it also makes server-side validators
      // untestable. Next resolves it to an empty module under the
      // `react-server` condition; do the same here.
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
