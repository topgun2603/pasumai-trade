import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled Cloud Functions. `firebase deploy` rebuilds it from source on
    // the way up, so it is output rather than code — and it is CommonJS, which
    // this config rightly forbids in anything hand-written.
    "functions/lib/**",
  ]),
]);

export default eslintConfig;
