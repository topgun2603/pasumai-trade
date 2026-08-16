import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Domain tests only.
 *
 * Everything under test here is pure logic — money arithmetic, transition
 * guards, validators — so it runs in Node with no DOM and no Next runtime.
 * Component tests, when they come, will need their own environment.
 *
 * `functions/src` is included for the same reason. The notification triggers
 * are adapters, but the decision they apply — who hears about a settled
 * bargain, which buyers hear about a new lot — is a rule, and it is pure. It
 * would be untestable sitting inside a trigger closure, so it does not sit
 * there; `functions/src/events.ts` imports nothing from Firebase and runs here
 * with everything else.
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
    include: ["lib/**/*.test.ts", "functions/src/**/*.test.ts"],
  },
});
