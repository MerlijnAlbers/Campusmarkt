import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ draait onder Playwright (npm run test:e2e), niet onder Vitest.
    exclude: ["node_modules/**", "e2e/**"],
  },
});
